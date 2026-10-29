/* 里世界 3D · 光影
   · 实时阴影：只在「精细」画质打开（每帧要多画一遍场景）。
       室外：太阳 / 月光是一盏平行光，阴影相机跟着人走，只照身边 30 米；
       室内：手电（聚光灯）投影。
   · 窗光：白天，窗户往屋里斜斜地打下一道光柱（叠加混合的半透明面片，带一点浮尘的抖动）。
   · 灯下光斑：每盏顶灯在地上投一块柔和的光斑，跟着灯一起闪，巡察者锁定时一起变红。
   这些都只是面片，不吃性能；「流畅」画质下不画光柱。 */
'use strict';

var SHADE={shadows:false,shaftMat:null,shaftGrp:null,pools:[],poolTex:null,shaftTex:null};

/* ---------- 实时阴影 ---------- */
function shadeWantShadows(){ return (QUALITY|0)>=2; }
function shadeRelease(light){
  if(light.shadow.map){light.shadow.map.dispose();light.shadow.map=null;}
  if(light.shadow.mapPass){light.shadow.mapPass.dispose();light.shadow.mapPass=null;}
}
function shadeSize(light,size){
  if(light.shadow.mapSize.x===size)return;
  shadeRelease(light);
  light.shadow.mapSize.set(size,size);
}
function shadeApplyQuality(){
  if(!GLR.renderer) return;
  var on=shadeWantShadows();
  if(SHADE.shadows!==on){
    SHADE.shadows=on;
    GLR.renderer.shadowMap.enabled=on;
    GLR.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    /* 打开 / 关掉阴影要重编着色器 */
    GLR.scene.traverse(function(o){ if(o.material){ (Array.isArray(o.material)?o.material:[o.material]).forEach(function(m){ m.needsUpdate=true; }); } });
  }
  var m=GLR.moon;
  m.castShadow=on;
  if(on){
    shadeSize(m,Math.min(Quality.get().shadow,GLR.renderer.capabilities.maxTextureSize));
    var sc=m.shadow.camera; sc.left=-30; sc.right=30; sc.top=30; sc.bottom=-30; sc.near=1; sc.far=90;
    sc.updateProjectionMatrix();
    m.shadow.bias=-0.0006; m.shadow.normalBias=0.04;
    if(!m.target.parent) GLR.scene.add(m.target);
  }else{
    shadeRelease(m);shadeRelease(GLR.torch);
    /* 不跟随玩家时，日月光按相对于原点的方向照射。 */
    m.target.position.set(0,0,0);
    m.target.updateMatrixWorld();
  }
  GLR.torch.castShadow=on;
  if(on)shadeSize(GLR.torch,Math.min(Quality.get().torchShadow,GLR.renderer.capabilities.maxTextureSize));
  shadeRoomLights();
  shadeMarkMesh(GLR.roomMesh); shadeMarkMesh(GLR.outMesh);
}
/* 超精细只让距相机最近的一盏顶灯投影，限制点光源的六面阴影开销。 */
function shadeRoomLights(){
  var lights=GLR.roomLights||[],size=Quality.get().ceilingShadow,best=-1,dist=Infinity;
  lights.forEach(function(l,i){
    var d=l.position.distanceToSquared(GLR.cam.position);
    if(size&&l.position.y>=2&&l.position.y<=4&&d<dist){dist=d;best=i;}
  });
  lights.forEach(function(l,i){
    l.castShadow=i===best;
    if(l.castShadow){
      /* PointLight 的图集为 4×2 面；尺寸仍须服从设备上限。 */
      shadeSize(l,Math.min(size,Math.floor(GLR.renderer.capabilities.maxTextureSize/4)));
      l.shadow.camera.near=0.15;l.shadow.camera.far=l.distance||18;
      l.shadow.bias=-0.001;l.shadow.normalBias=0.025;
    }else shadeRelease(l);
  });
}
/* 新建好的场景网格：精细画质下投影、接收阴影 */
function shadeMarkMesh(g){
  if(!g) return;
  var on=SHADE.shadows;
  g.traverse(function(o){ if(o.isMesh){ o.castShadow=on; o.receiveShadow=on; } });
}
/* 平行光跟着人：阴影只算身边一块 */
function shadeFollow(){
  if(!SHADE.shadows||!GLR.moon) return;
  var c=GLR.cam.position, m=GLR.moon, d=m.position.clone().normalize();
  m.target.position.set(c.x,0,c.z);
  m.position.set(c.x+d.x*40,d.y*40,c.z+d.z*40);
  m.target.updateMatrixWorld();
}

/* ---------- 共用的渐变贴图 ---------- */
function shadeTex(kind){
  var key=kind==='pool'?'poolTex':'shaftTex';
  if(SHADE[key]) return SHADE[key];
  var cv=document.createElement('canvas'); cv.width=64; cv.height=64;
  var c=cv.getContext('2d'), g;
  if(kind==='pool'){
    g=c.createRadialGradient(32,32,0,32,32,32);
    g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(0.45,'rgba(255,255,255,0.45)'); g.addColorStop(1,'rgba(255,255,255,0)');
    c.fillStyle=g; c.fillRect(0,0,64,64);
  }else{
    g=c.createLinearGradient(0,0,0,64);                 /* 光柱：靠窗那头亮，往下淡出；左右两边也淡 */
    g.addColorStop(0,'rgba(255,255,255,0.9)'); g.addColorStop(1,'rgba(255,255,255,0)');
    c.fillStyle=g; c.fillRect(0,0,64,64);
    var h=c.createLinearGradient(0,0,64,0);
    h.addColorStop(0,'rgba(0,0,0,1)'); h.addColorStop(0.18,'rgba(0,0,0,0)'); h.addColorStop(0.82,'rgba(0,0,0,0)'); h.addColorStop(1,'rgba(0,0,0,1)');
    c.globalCompositeOperation='destination-out'; c.fillStyle=h; c.fillRect(0,0,64,64);
  }
  var t=new THREE.CanvasTexture(cv);
  SHADE[key]=t; return t;
}

/* ---------- 窗光光柱 ---------- */
var SHAFT_ACC=null;            /* buildRoomGeometry 期间收集窗户：{x,z,nx,nz,w,y0,y1} */
function shaftNote(x,z,nx,nz,w,y0,y1){ if(SHAFT_ACC) SHAFT_ACC.push({x:x,z:z,nx:nx,nz:nz,w:w,y0:y0,y1:y1}); }
function shadeBuildRoom(R){
  shadeClearRoom();
  if((QUALITY|0)<1||!R||!R.shafts||!R.shafts.length) return;
  if(!SHADE.shaftMat) SHADE.shaftMat=new THREE.MeshBasicMaterial({map:shadeTex('shaft'),color:0xfff1d6,transparent:true,opacity:0,
    blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,fog:true});
  var grp=new THREE.Group(), i, w;
  for(i=0;i<R.shafts.length;i++){
    w=R.shafts[i];
    /* 从窗口往屋里、往下斜：太阳从窗外高处照进来 */
    var reach=Math.max(2.2,w.y1/0.9), fy=Math.max(0.02,w.y1-reach*0.9);   /* 斜 42° 落到地上 */
    var ix=w.nx, iz=w.nz, tx=-iz, tz=ix, hw=w.w/2;
    var p=[
      [w.x-tx*hw,w.y1,w.z-tz*hw],[w.x+tx*hw,w.y1,w.z+tz*hw],
      [w.x+tx*hw+ix*reach,fy,w.z+tz*hw+iz*reach],
      [w.x-tx*hw+ix*reach,fy,w.z-tz*hw+iz*reach]];
    var g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute([].concat(p[0],p[1],p[2],p[0],p[2],p[3]),3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute([0,1,1,1,1,0,0,1,1,0,0,0],2));
    var me=new THREE.Mesh(g,SHADE.shaftMat); me.renderOrder=3; grp.add(me);
  }
  SHADE.shaftGrp=grp; GLR.scene.add(grp);
}
function shadeClearRoom(){
  if(SHADE.shaftGrp){ GLR.scene.remove(SHADE.shaftGrp); SHADE.shaftGrp.traverse(function(o){ if(o.geometry) o.geometry.dispose(); }); SHADE.shaftGrp=null; }
  SHADE.pools.forEach(function(p){ GLR.scene.remove(p); if(p.material) p.material.dispose(); });
  SHADE.pools=[];
}
/* ---------- 灯下光斑（addRoomLights 之后调） ---------- */
var POOL_GEO=null;
function shadeBuildPools(){
  SHADE.pools.forEach(function(p){ GLR.scene.remove(p); if(p.material) p.material.dispose(); });
  SHADE.pools=[];
  if(!GLR.roomLights||S.mode!=='in') return;
  if(!POOL_GEO){ POOL_GEO=new THREE.PlaneGeometry(1,1); POOL_GEO.rotateX(-PI/2); }
  GLR.roomLights.forEach(function(L,i){
    if(L.position.y<2||L.position.y>4) return;            /* 只给顶灯（钟楼上头那盏不算） */
    var m=new THREE.MeshBasicMaterial({map:shadeTex('pool'),color:L.color.clone(),transparent:true,opacity:0,
      blending:THREE.AdditiveBlending,depthWrite:false,fog:true});
    var p=new THREE.Mesh(POOL_GEO,m);
    var r=Math.min(4.2,(L.distance||12)*0.26);
    p.scale.set(r,1,r); p.position.set(L.position.x,0.015,L.position.z); p.renderOrder=2;
    p.userData.i=i; GLR.scene.add(p); SHADE.pools.push(p);
  });
}
/* 每帧：光柱跟天色，光斑跟着灯 */
function shadeTick(st){
  shadeFollow();
  if(Quality.get().ceilingShadow)shadeRoomLights();
  if(SHADE.shaftMat){
    var day=st?st.day:0, k=st&&st.indoor?day:0;
    var dust=0.92+0.08*Math.sin((GLR.time||0)*0.7);
    SHADE.shaftMat.opacity=0.26*k*dust*(1-0.8*(GLR.patrolRed||0))*(1-0.6*(GLR.overcast||0));
  }
  SHADE.pools.forEach(function(p){
    var L=GLR.roomLights[p.userData.i], base=GLR.roomLightBase[p.userData.i]||1;
    if(!L){ p.visible=false; return; }
    p.material.opacity=clamp(L.intensity/base,0,1.2)*0.10;
    p.material.color.copy(L.color);
  });
}
