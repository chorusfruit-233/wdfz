/* 里世界 3D · 渲染后端：Babylon.js（「超精细」默认用它）
   做法是「镜像」：游戏逻辑照旧往 three.js 的场景图里摆东西，这里每帧把场景图同步进 Babylon 再画。
   所以建模、房间生成、特效都只写一份，换引擎不用改游戏逻辑。

   同步的内容：
     · 网格：BufferGeometry → Babylon Geometry（同一份几何体共用一份），顶点色 RGB → RGBA；
       InstancedMesh → thin instance；Points → 点云；LineSegments → 线；Sprite → 永远朝向镜头的面片
     · 材质：MeshBasic → 不受光；Lambert / Phong → PBR（漫反射 + 按高光强度换算的粗糙度），
       透明、叠加混合、不写深度、多边形偏移、双面都照搬；CanvasTexture → DynamicTexture（sRGB 先转线性）
     · 灯：环境光 / 天光 → 半球光；平行光、点光、聚光灯照搬，点光按「平方反比 + 距离窗口」衰减（和 three.js 一致）
     · 雾（指数平方）、背景色、相机（视图矩阵直接用 three.js 的）
     · 手里的东西（GLR.handScene）放在第 1 渲染组：先清深度再画，不会插进墙里
   比 Three.js 多的：屏幕空间环境光遮蔽（SSAO2）、4096 软阴影（月光 / 太阳、手电、离你最近的那盏顶灯）、FXAA 抗锯齿。
   最后过同一段后期着色器（从 GLR.postMat 原样搬过来），所以色调、SAN 抖动、红光这些和 Three.js 后端一致。

   亮度换算（用一块反照率 0.5 的平面、单独一盏灯在两个引擎里读像素校过）：
     three.js（物理正确光照）所有灯的漫反射都除以 π；Babylon 的 PBR 点光、平行光、聚光灯也除 π，半球光不除，
     所以只有环境光 / 天光乘 1/π。材质要输出线性颜色（applyByPostProcess），否则 PBR 会先转一次 gamma，后期再转一次就发白。
   tools/engine_compare.py 会把两边画同一个画面比较平均亮度。 */
'use strict';

(function(){
  var B=null;            /* BABYLON 命名空间（库加载以后才有） */
  var BK={engine:null,scene:null,cam:null,cv:null,frameNo:0,
          nodes:{},geos:{},mats:{},texs:{},lights:{},shadow:{},post:null,ssao:null,fxaa:null};
  var INV_PI=1/Math.PI;
  /* 各类灯的亮度换算系数（tools/engine_compare.py 对着 three.js 校出来的） */
  var KL={hemi:1.1,point:1.15,dir:1,spot:1};      /* 环境光遮蔽、顶灯阴影会压暗一点，这里补回来，整体亮度和 three.js 差在 10% 以内 */

  function col3(c,k){ k=(k===undefined)?1:k; return new B.Color3(c.r*k,c.g*k,c.b*k); }
  function setCol3(dst,c,k){ k=(k===undefined)?1:k; dst.r=c.r*k; dst.g=c.g*k; dst.b=c.b*k; }

  /* ---------- 贴图 ---------- */
  var SRGB_LUT=null;
  function lut(){
    if(SRGB_LUT) return SRGB_LUT;
    SRGB_LUT=new Uint8ClampedArray(256);
    for(var i=0;i<256;i++){ var c=i/255; SRGB_LUT[i]=Math.round(255*(c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4))); }
    return SRGB_LUT;
  }
  function texOf(t){
    if(!t||!t.image) return null;
    var e=BK.texs[t.uuid];
    if(e&&e.ver===t.version){ e.used=BK.frameNo; return e.bt; }
    var img=t.image, w=img.width||img.videoWidth||0, h=img.height||img.videoHeight||0;
    if(!w||!h) return null;
    if(!e){
      var bt=new B.DynamicTexture('t'+t.uuid,{width:w,height:h},BK.scene,true,B.Texture.TRILINEAR_SAMPLINGMODE);
      bt.wrapU=(t.wrapS===THREE.RepeatWrapping)?B.Texture.WRAP_ADDRESSMODE:B.Texture.CLAMP_ADDRESSMODE;
      bt.wrapV=(t.wrapT===THREE.RepeatWrapping)?B.Texture.WRAP_ADDRESSMODE:B.Texture.CLAMP_ADDRESSMODE;
      bt.anisotropicFilteringLevel=8;
      e=BK.texs[t.uuid]={bt:bt,ver:-1};
    }
    var ctx=e.bt.getContext();
    ctx.clearRect(0,0,w,h);
    try{ ctx.drawImage(img,0,0,w,h); }catch(err){}
    e.bt.gammaSpace=(t.colorSpace===THREE.SRGBColorSpace);   /* sRGB 贴图由着色器转线性（和 three.js 一样），其余按原值 */
    e.bt.update(t.flipY!==false);
    e.bt.hasAlpha=true;
    e.ver=t.version; e.used=BK.frameNo;
    return e.bt;
  }

  /* ---------- 几何体 ---------- */
  function attrArray(a,size){
    if(!a) return null;
    if(!a.isInterleavedBufferAttribute&&a.itemSize===size&&a.array instanceof Float32Array&&!a.normalized) return a.array;   /* 压缩格式（8 位法线、半精度颜色）逐个换算 */
    var n=a.count, out=new Float32Array(n*size), i, k;
    var get=[a.getX,a.getY,a.getZ,a.getW];
    for(i=0;i<n;i++) for(k=0;k<size;k++) out[i*size+k]=k<a.itemSize?get[k].call(a,i):(k===3?1:0);
    return out;
  }
  function geoVer(g){
    var v=0, k; for(k in g.attributes) v+=g.attributes[k].version*(k.length+1);
    return v+(g.index?g.index.version*7:0);
  }
  function geoOf(g,lines){
    var e=BK.geos[g.uuid], ver=geoVer(g);
    if(e&&e.ver===ver){ e.used=BK.frameNo; return e.bg; }
    var pos=g.attributes.position; if(!pos) return null;
    var vd=new B.VertexData(), n=pos.count;
    vd.positions=attrArray(pos,3);
    if(g.attributes.normal) vd.normals=attrArray(g.attributes.normal,3);
    if(g.attributes.uv) vd.uvs=attrArray(g.attributes.uv,2);
    if(g.attributes.color){
      var c=g.attributes.color, ca=new Float32Array(n*4), i;
      for(i=0;i<n;i++){ ca[i*4]=c.getX(i); ca[i*4+1]=c.getY(i); ca[i*4+2]=c.getZ(i); ca[i*4+3]=c.itemSize>3?c.getW(i):1; }
      vd.colors=ca;
    }
    if(g.index) vd.indices=g.index.array;
    else{ var ix=new Uint32Array(n); for(var j=0;j<n;j++) ix[j]=j; vd.indices=ix; }
    if(!vd.normals&&!lines){ vd.normals=new Float32Array(n*3); B.VertexData.ComputeNormals(vd.positions,vd.indices,vd.normals); }
    if(e){                                             /* 内容变了（雨丝、点云每帧在动）：原地更新 */
      try{
        if(e.n===n){
          e.bg.updateVerticesData(B.VertexBuffer.PositionKind,vd.positions,false,false);
          if(vd.colors) e.bg.updateVerticesData(B.VertexBuffer.ColorKind,vd.colors,false,false);
          if(vd.normals&&g.attributes.normal) e.bg.updateVerticesData(B.VertexBuffer.NormalKind,vd.normals,false,false);
          e.ver=ver; e.used=BK.frameNo; return e.bg;
        }
      }catch(err){}
      e.bg.dispose();
    }
    var bg=new B.Geometry('g'+g.uuid,BK.scene,vd,true);
    BK.geos[g.uuid]={bg:bg,ver:ver,n:n,used:BK.frameNo};
    return bg;
  }

  /* ---------- 材质 ---------- */
  function unlitOf(m){ return !!(m.isMeshBasicMaterial||m.isLineBasicMaterial||m.isPointsMaterial||m.isSpriteMaterial); }
  function matOfThree(m,kind){
    var key=m.uuid+'|'+kind, e=BK.mats[key], bm;
    if(!e){
      bm=new B.PBRMaterial('m'+key,BK.scene);
      bm.imageProcessingConfiguration=BK.ipc;           /* 每个材质挂同一份「线性输出」配置：场景那份会被环境光遮蔽的预渲染改掉 */
      if(unlitOf(m)) bm.unlit=true;                    /* 不受光：颜色 = 颜色 × 贴图 × 顶点色 */
      else{
        bm.metallic=null; bm.roughness=null;
        bm.maxSimultaneousLights=16;
        bm.usePhysicalLightFalloff=true;
        bm.environmentIntensity=0;
        bm.useSpecularOverAlpha=false; bm.useRadianceOverAlpha=false;
      }
      if(kind==='points'){ bm.pointsCloud=true; bm.pointSize=Math.max(1.5,(m.size||1)*120); }
      if(kind==='lines') bm.fillMode=B.Material.LineListDrawMode;
      e=BK.mats[key]={bm:bm};
    }
    bm=e.bm; e.used=BK.frameNo;
    var unlit=unlitOf(m), opa=m.opacity===undefined?1:m.opacity;
    setCol3(bm.albedoColor,m.color);
    if(!unlit){
      var sh=m.shininess||0, sp=m.specular;
      if(sp&&sh>0){ setCol3(bm.reflectivityColor,sp,0.6); bm.microSurface=Math.min(0.95,1-Math.sqrt(2/(sh+2))); }
      else{ bm.reflectivityColor.set(0,0,0); bm.microSurface=0; }              /* three.js 里没高光的（Lambert / 高光 0）：这边也不要菲涅耳反光 */
      if(m.emissive){ setCol3(bm.emissiveColor,m.emissive,m.emissiveIntensity===undefined?1:m.emissiveIntensity); }
    }
    var tx=m.map?texOf(m.map):null;
    if(bm.albedoTexture!==tx) bm.albedoTexture=tx;
    var nt=(!unlit&&m.normalMap)?texOf(m.normalMap):null;     /* 浮雕：法线贴图（没有切线数据，两边都按屏幕导数算切线空间） */
    if(bm.bumpTexture!==nt) bm.bumpTexture=nt;
    if(nt){ nt.level=m.normalScale?m.normalScale.x:1; bm.invertNormalMapY=BK.flipNY!==false; }
    bm.alpha=m.transparent?opa:1;
    var add=(m.blending===THREE.AdditiveBlending);
    bm.alphaMode=add?B.Engine.ALPHA_ADD:B.Engine.ALPHA_COMBINE;
    bm.transparencyMode=(m.transparent||add)?B.Material.MATERIAL_ALPHABLEND:(m.alphaTest>0?B.Material.MATERIAL_ALPHATEST:B.Material.MATERIAL_OPAQUE);
    if(tx&&(m.transparent||m.alphaTest>0)){ tx.hasAlpha=true; bm.useAlphaFromAlbedoTexture=true; }
    bm.disableDepthWrite=(m.depthWrite===false);
    bm.depthFunction=(m.depthTest===false)?B.Engine.ALWAYS:0;
    /* 两边对「正面」的绕序约定相反（镜像过来的视图矩阵是右手系）：three.js 的 FrontSide 在这里要剔除 Babylon 眼里的「正面」 */
    var dbl=(m.side===THREE.DoubleSide);
    bm.backFaceCulling=!dbl&&!BK.noCull;
    bm.cullBackFaces=(m.side===THREE.BackSide);
    if(!unlit) bm.twoSidedLighting=dbl;
    bm.fogEnabled=(m.fog!==false);
    bm.wireframe=!!m.wireframe;
    bm.zOffset=m.polygonOffset?(m.polygonOffsetFactor||0):0;
    bm.zOffsetUnits=m.polygonOffset?(m.polygonOffsetUnits||0):0;
    return bm;
  }

  /* ---------- 网格 ---------- */
  var tmpM=null, tmpS=null, tmpQ=null, tmpP=null;
  function placeFrom(o,node){
    tmpM=B.Matrix.FromArray(o.matrixWorld.elements);
    if(!node.rotationQuaternion) node.rotationQuaternion=new B.Quaternion();
    tmpM.decompose(node.scaling,node.rotationQuaternion,node.position);
  }
  var SPRITE_GEO=null;
  function nodeFor(o,group){
    var kind=o.isInstancedMesh?'inst':(o.isPoints?'points':((o.isLineSegments||o.isLine)?'lines':(o.isSprite?'sprite':'mesh')));
    var e=BK.nodes[o.uuid];
    if(e&&e.kind!==kind){ e.mesh.dispose(); delete BK.nodes[o.uuid]; e=null; }
    if(!e){
      var mesh=new B.Mesh('n'+o.uuid,BK.scene);
      mesh.rotationQuaternion=new B.Quaternion();
      mesh.isPickable=false; mesh.doNotSyncBoundingInfo=false;
      e=BK.nodes[o.uuid]={mesh:mesh,kind:kind,geo:null};
      if(kind==='sprite') mesh.billboardMode=B.Mesh.BILLBOARDMODE_ALL;
    }
    e.used=BK.frameNo;
    var mesh=e.mesh, g=o.geometry, bg;
    if(kind==='sprite'){
      if(!SPRITE_GEO){ var vd=B.VertexData.CreatePlane({size:1}); SPRITE_GEO=new B.Geometry('spriteQuad',BK.scene,vd,false); }
      bg=SPRITE_GEO;
    }else bg=g?geoOf(g,kind==='lines'):null;
    if(!bg){ mesh.setEnabled(false); return null; }
    if(e.geo!==bg){ bg.applyToMesh(mesh); e.geo=bg; }
    var m=Array.isArray(o.material)?o.material[0]:o.material;
    if(!m||m.visible===false){ mesh.setEnabled(false); return null; }
    mesh.material=matOfThree(m,kind==='inst'?'mesh':kind);
    mesh.useVertexColors=!!m.vertexColors&&!!(g&&g.attributes&&g.attributes.color);
    mesh.hasVertexAlpha=false;
    mesh.renderingGroupId=group;
    mesh.alphaIndex=o.renderOrder||0;
    mesh.alwaysSelectAsActiveMesh=(o.frustumCulled===false)||kind==='inst'||kind==='points'||kind==='lines';
    mesh.receiveShadows=!!o.receiveShadow;
    e.cast=!!o.castShadow;
    placeFrom(o,mesh);
    if(kind==='sprite'){ mesh.rotationQuaternion=null; mesh.rotation.set(0,0,(m.rotation||0)); }
    if(kind==='inst'){
      var cnt=o.count, arr=o.instanceMatrix.array, v=o.instanceMatrix.version;
      if(e.iv!==v||e.icnt!==cnt){
        if(!e.ibuf||e.ibuf.length!==arr.length){ e.ibuf=new Float32Array(arr.length); mesh.thinInstanceSetBuffer('matrix',e.ibuf,16,false); }
        e.ibuf.set(arr); mesh.thinInstanceBufferUpdated('matrix');
        mesh.thinInstanceCount=cnt; e.iv=v; e.icnt=cnt;
        mesh.thinInstanceRefreshBoundingInfo(false);
      }
      if(o.instanceColor&&e.cv!==o.instanceColor.version){
        var ic=o.instanceColor.array, n=ic.length/3, ca=new Float32Array(n*4), i;
        for(i=0;i<n;i++){ ca[i*4]=ic[i*3]; ca[i*4+1]=ic[i*3+1]; ca[i*4+2]=ic[i*3+2]; ca[i*4+3]=1; }
        mesh.thinInstanceSetBuffer('color',ca,4,true); e.cv=o.instanceColor.version;
      }
    }
    mesh.setEnabled(true);
    return mesh;
  }

  /* ---------- 灯 ---------- */
  function lightFor(o){
    var e=BK.lights[o.uuid], L;
    if(!e){
      var s=BK.scene, p=new B.Vector3(0,0,0);
      if(o.isAmbientLight||o.isHemisphereLight) L=new B.HemisphericLight('l'+o.uuid,new B.Vector3(0,1,0),s);
      else if(o.isDirectionalLight) L=new B.DirectionalLight('l'+o.uuid,new B.Vector3(0,-1,0),s);
      else if(o.isSpotLight) L=new B.SpotLight('l'+o.uuid,p,new B.Vector3(0,0,-1),1,1,s);
      else if(o.isPointLight) L=new B.PointLight('l'+o.uuid,p,s);
      else return null;
      L.falloffType=B.Light.FALLOFF_GLTF;
      e=BK.lights[o.uuid]={L:L};
    }
    L=e.L; e.used=BK.frameNo;
    /* Babylon 的 PBR：点光、平行光、聚光灯的漫反射已经除了 π，和 three.js 一样；半球光没除，这里补上 */
    var I=o.intensity;
    if(o.isAmbientLight){ setCol3(L.diffuse,o.color); setCol3(L.groundColor,o.color); L.specular.set(0,0,0); L.intensity=I*INV_PI*KL.hemi; }
    else if(o.isHemisphereLight){ setCol3(L.diffuse,o.color); setCol3(L.groundColor,o.groundColor); L.specular.set(0,0,0); L.intensity=I*INV_PI*KL.hemi; }
    else{
      setCol3(L.diffuse,o.color); setCol3(L.specular,o.color);
      var wp=new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
      L.position.set(wp.x,wp.y,wp.z);
      if(o.isDirectionalLight||o.isSpotLight){
        var tp=new THREE.Vector3().setFromMatrixPosition(o.target.matrixWorld), d=tp.sub(wp).normalize();
        L.direction.set(d.x,d.y,d.z);
      }
      if(o.isPointLight||o.isSpotLight){
        L.range=o.distance>0?o.distance:1e4;
        /* three.js 的 decay 不是 2 的（路灯 1.6、身边补光）：按 1 米处相同、到 range 一半处相同折中成一个系数 */
        var dk=o.decay===undefined?2:o.decay, half=Math.max(1,L.range*0.5);
        L.intensity=I*(dk===2?1:Math.pow(half,2-dk))*(o.isSpotLight?KL.spot:KL.point);
      }else L.intensity=I*KL.dir;
      if(o.isSpotLight){ L.angle=o.angle*2; L.exponent=Math.max(1,2*(1-(o.penumbra||0))*8); }
    }
    /* 室内的月光 / 太阳：three.js 开着阴影时被天花板整个挡住；这边室内不算它的阴影，直接关掉，效果一样 */
    if(o===GLR.moon&&S.mode==='in') L.intensity=0;
    L.setEnabled(L.intensity>0);
    return L;
  }

  /* ---------- 阴影 ---------- */
  function shadowFor(key,L,size,kind){
    var e=BK.shadow[key];
    if(e&&(e.L!==L||e.size!==size)){ e.gen.dispose(); delete BK.shadow[key]; e=null; }
    if(!e){
      var gen=new B.ShadowGenerator(size,L,true);
      if(kind==='point') gen.usePoissonSampling=true;     /* 立方体阴影不支持 PCF（会和平面阴影抢同一个采样器） */
      else{ gen.usePercentageCloserFiltering=true; gen.filteringQuality=B.ShadowGenerator.QUALITY_HIGH; }
      gen.bias=kind==='point'?0.004:0.0008; gen.normalBias=0.02;
      gen.transparencyShadow=false;
      if(kind==='dir'){ L.autoUpdateExtends=false; L.autoCalcShadowZBounds=false; }
      e=BK.shadow[key]={gen:gen,L:L,size:size};
    }
    e.used=BK.frameNo;
    return e.gen;
  }
  function updateShadows(casters){
    var want=QP().shadows, size=QP().shadowMap||2048, k;
    var live={};
    if(want){
      /* 月光 / 太阳：只罩住人身边 30 米（和 three.js 的 shade.js 一样） */
      var moon=GLR.moon&&BK.lights[GLR.moon.uuid];
      if(moon&&GLR.moon.intensity>0&&S.mode==='out'){
        var g=shadowFor('moon',moon.L,size,'dir'); live.moon=1;
        var sc=GLR.moon.shadow&&GLR.moon.shadow.camera;
        var L=moon.L; L.orthoLeft=sc?sc.left:-30; L.orthoRight=sc?sc.right:30; L.orthoTop=sc?sc.top:30; L.orthoBottom=sc?sc.bottom:-30;
        L.shadowMinZ=sc?sc.near:1; L.shadowMaxZ=sc?sc.far:90;
        g.getShadowMap().renderList=casters;
      }
      var tl=GLR.torch&&BK.lights[GLR.torch.uuid];
      if(tl&&GLR.torch.intensity>0&&USE.torch){ var g2=shadowFor('torch',tl.L,Math.min(2048,size),'spot'); live.torch=1; g2.getShadowMap().renderList=casters; tl.L.shadowMinZ=0.2; tl.L.shadowMaxZ=20; }
      /* 顶灯投影：离镜头最近、亮着的那一盏（立方体阴影要画 6 遍场景，只开一盏） */
      if(S.mode==='in'&&GLR.roomLights&&GLR.roomLights.length&&!BK.noCeil){
        var cp=GLR.cam.position, best=null, bd=1e9;
        GLR.roomLights.forEach(function(pl){ if(pl.intensity<=0) return; var d=pl.position.distanceToSquared(cp); if(d<bd){ bd=d; best=pl; } });
        var be=best&&BK.lights[best.uuid];
        if(be){ var g3=shadowFor('ceil',be.L,1024,'point'); live.ceil=1; g3.getShadowMap().renderList=casters; be.L.shadowMinZ=0.1; be.L.shadowMaxZ=be.L.range; }
      }
    }
    for(k in BK.shadow) if(!live[k]){ BK.shadow[k].gen.dispose(); delete BK.shadow[k]; }
  }

  /* ---------- 后期：把 three.js 后端的那段着色器原样搬过来 ---------- */
  function buildPost(){
    var src=GLR.postMat.fragmentShader
      .replace('uniform sampler2D tDiffuse;','uniform sampler2D textureSampler;\n#define tDiffuse textureSampler\n')
      .replace('varying vec2 vUv;','varying vec2 vUV;\n#define vUv vUV\n');
    B.Effect.ShadersStore.wdfzFragmentShader=src;
    var U=GLR.postMat.uniforms, names=Object.keys(U).filter(function(k){ return k!=='tDiffuse'; });
    var pp=new B.PostProcess('wdfz','wdfz',names.slice(),null,1.0,BK.cam,B.Texture.BILINEAR_SAMPLINGMODE,BK.engine,false);
    pp.onApply=function(fx){
      names.forEach(function(k){
        var v=U[k].value;
        if(typeof v==='number') fx.setFloat(k,v);
        else if(v&&v.isVector2) fx.setFloat2(k,v.x,v.y);
      });
    };
    return pp;
  }

  /* ---------- 同步 ---------- */
  function walk(root,group,casters){
    root.updateMatrixWorld();
    (function rec(o,vis){
      vis=vis&&o.visible!==false;
      if(o.isLight){ if(vis) lightFor(o); else { var le=BK.lights[o.uuid]; if(le){ le.used=BK.frameNo; le.L.setEnabled(false); } } }
      else if(o.isMesh||o.isPoints||o.isLine||o.isSprite){
        if(vis){ var m=nodeFor(o,group); if(m&&o.castShadow&&group===0) casters.push(m); }
        else{ var ne=BK.nodes[o.uuid]; if(ne){ ne.used=BK.frameNo; ne.mesh.setEnabled(false); } }
      }
      var ch=o.children, i; for(i=0;i<ch.length;i++) rec(ch[i],vis);
    })(root,true);
  }
  function gc(){
    var lim=BK.frameNo-90, k, t=[[BK.nodes,'mesh'],[BK.lights,'L'],[BK.mats,'bm'],[BK.geos,'bg'],[BK.texs,'bt']];
    t.forEach(function(p){ var D=p[0]; for(k in D) if(D[k].used<lim){ try{ D[k][p[1]].dispose(); }catch(e){} delete D[k]; } });
  }
  function syncCamera(){
    var c=GLR.cam, cam=BK.cam;
    c.updateMatrixWorld();
    cam.fov=c.fov*Math.PI/180; cam.minZ=c.near; cam.maxZ=c.far;
    BK.view=B.Matrix.FromArray(c.matrixWorldInverse.elements);
    var p=new THREE.Vector3().setFromMatrixPosition(c.matrixWorld);
    cam.position.set(p.x,p.y,p.z);
    if(cam._globalPosition) cam._globalPosition.set(p.x,p.y,p.z);
  }
  function syncEnv(){
    var s=BK.scene, f=GLR.scene.fog, bg=GLR.scene.background;
    if(f&&f.isFogExp2){ s.fogMode=B.Scene.FOGMODE_EXP2; s.fogDensity=f.density; setCol3(s.fogColor,f.color); }
    else if(f&&f.isFog){ s.fogMode=B.Scene.FOGMODE_LINEAR; s.fogStart=f.near; s.fogEnd=f.far; setCol3(s.fogColor,f.color); }
    else s.fogMode=B.Scene.FOGMODE_NONE;
    if(bg&&bg.isColor) s.clearColor.set(bg.r,bg.g,bg.b,1);
  }

  GFX.register('babylon',{
    ready:function(){ return typeof BABYLON!=='undefined'; },
    init:function(){
      B=BABYLON;
      var cv=document.createElement('canvas'), main=document.getElementById('cv');
      cv.id='cvb';
      cv.style.cssText='position:fixed;left:0;top:0;width:100%;height:100%;display:block;pointer-events:none;';
      if(main&&main.parentNode) main.parentNode.insertBefore(cv,main); else document.body.appendChild(cv);
      if(main){ var z=getComputedStyle(main).zIndex; if(z&&z!=='auto') cv.style.zIndex=String(Math.max(0,(+z)-1)); }
      BK.cv=cv;
      var eng=new B.Engine(cv,false,{preserveDrawingBuffer:true,stencil:true,antialias:false,premultipliedAlpha:false,powerPreference:'high-performance'},false);
      if(!eng||!eng._gl) throw new Error('WebGL 不可用');
      BK.engine=eng;
      var s=new B.Scene(eng);
      s.useRightHandedSystem=true;
      /* 材质输出线性颜色（不在材质里转 gamma），色调、gamma 交给后面那段后期着色器 */
      s.imageProcessingConfiguration.applyByPostProcess=true; s.imageProcessingConfiguration.isEnabled=true;
      BK.ipc=new B.ImageProcessingConfiguration(); BK.ipc.applyByPostProcess=true; BK.ipc.isEnabled=true;
      s.skipPointerMovePicking=true; s.autoClear=true; s.autoClearDepthAndStencil=true;
      s.ambientColor=new B.Color3(0,0,0);
      s.setRenderingAutoClearDepthStencil(1,true,true,true);   /* 第 1 组（手里的东西）画之前清深度 */
      BK.scene=s;
      var cam=new B.FreeCamera('cam',new B.Vector3(0,1.6,0),s);
      cam.inputs.clear(); cam.fovMode=B.Camera.FOVMODE_VERTICAL_FIXED;
      /* 视图矩阵直接用 three.js 相机的（它的位置、朝向、晃动都由游戏逻辑算好了） */
      cam._isSynchronizedViewMatrix=function(){ return false; };
      cam._getViewMatrix=function(){ if(BK.view) this._computedViewMatrix.copyFrom(BK.view); return this._computedViewMatrix; };
      BK.cam=cam; s.activeCamera=cam;
      if(B.SSAO2RenderingPipeline&&B.SSAO2RenderingPipeline.IsSupported){
        try{
          var ss=new B.SSAO2RenderingPipeline('ssao',s,{ssaoRatio:0.6,blurRatio:1},[cam],false);
          ss.radius=0.6; ss.totalStrength=0.85; ss.base=0.15; ss.samples=16; ss.maxZ=40; ss.minZAspect=0.2; ss.expensiveBlur=true; ss.bilateralSamples=16;
          BK.ssao=ss; BK.ssaoOn=true;
        }catch(e){ BK.ssao=null; }
      }
      BK.post=buildPost();
      BK.fxaa=new B.FxaaPostProcess('fxaa',1.0,cam,B.Texture.BILINEAR_SAMPLINGMODE,eng,false);
    },
    activate:function(){
      if(BK.cv) BK.cv.style.display='block';
      var cv=document.getElementById('cv'); if(cv) cv.style.opacity='0';   /* three.js 的画布留着收鼠标、触屏 */
      GLR.renderer.setRenderTarget(null); GLR.renderer.setClearColor(0x000000,0); GLR.renderer.clear();
    },
    deactivate:function(){
      if(BK.cv) BK.cv.style.display='none';
      var cv=document.getElementById('cv'); if(cv) cv.style.opacity='';
      for(var k in BK.shadow){ BK.shadow[k].gen.dispose(); delete BK.shadow[k]; }
    },
    configure:function(){
      var P=QP();
      if(BK.ssao&&BK.ssaoOn!==!!P.ssao){
        try{
          var mgr=BK.scene.postProcessRenderPipelineManager;
          if(P.ssao) mgr.attachCamerasToRenderPipeline('ssao',BK.cam); else mgr.detachCamerasFromRenderPipeline('ssao',BK.cam);
          BK.ssaoOn=!!P.ssao;
        }catch(e){}
      }
      if(BK.fxaa) BK.fxaa.alwaysForcePOT=false;
    },
    resize:function(){
      if(!BK.engine) return;
      var r=Math.min(window.devicePixelRatio||1,QP().pixelRatio);
      BK.engine.setHardwareScalingLevel(1/r);
      BK.engine.resize();
    },
    frame:function(){
      BK.frameNo++;
      var casters=[];
      if(GLR.handRoot&&GLR.handRoot.visible){ GLR.handRoot.matrix.copy(GLR.cam.matrixWorld); GLR.handRoot.matrixWorldNeedsUpdate=true; }
      syncCamera(); syncEnv();
      walk(GLR.scene,0,casters);
      if(GLR.handScene) walk(GLR.handScene,1,[]);
      /* 这一帧场景图里已经没有的（换了房间、特效结束）：马上藏起来，过 90 帧再回收 */
      var k; for(k in BK.nodes) if(BK.nodes[k].used!==BK.frameNo) BK.nodes[k].mesh.setEnabled(false);
      for(k in BK.lights) if(BK.lights[k].used!==BK.frameNo) BK.lights[k].L.setEnabled(false);
      updateShadows(casters);
      if(BK.frameNo%60===0) gc();
      BK.engine.beginFrame();
      BK.scene.render();
      BK.engine.endFrame();
    },
    isReady:function(){ return !!BK.scene&&BK.scene.isReady(); },
    _bk:BK, _kl:KL,
    stats:function(){ return {meshes:Object.keys(BK.nodes).length,lights:Object.keys(BK.lights).length,mats:Object.keys(BK.mats).length,shadows:Object.keys(BK.shadow),ssao:!!BK.ssao}; }
  });
})();
