/* 里世界 3D · 材质库
   按材质分开，每种一张灰度颜色图和一张高度图（高度图在这里算成法线贴图）。
   贴图是离线生成的（tools/textures/build_textures.py → game3d/assets/textures_512.js、textures_1024.js，WebP），
   无缝平铺、固定不变；贴图坐标按世界坐标投影：同一种材质在相邻物体之间是连续的。
   贴图都是灰度的，颜色仍然来自顶点色，所以外形和配色保持原样。叶片卡、污渍图集仍是现场画的（带透明）。 */
'use strict';

/* key: [贴图种类, 一张贴图覆盖多少米, 高光强度, 高光颜色] */
var MAT_DEF={
  plaster:  ['plaster', 2.4, 0,  0x000000],   /* 室内墙面、楼外白色线脚 */
  tile:     ['tile',    1.2, 6,  0x181818],   /* 室内地砖 */
  terrazzo: ['terrazzo',2.0, 8,  0x1c1c1c],   /* 走廊、楼梯的水磨石 */
  ceiling:  ['ceiling', 1.2, 0,  0x000000],   /* 矿棉吊顶 */
  wood:     ['wood',    1.0, 4,  0x161210],   /* 课桌面、门、讲台 */
  metal:    ['metal',   0.8, 40, 0x6a6e72],   /* 桌腿、柜子、车身、栏杆 */
  plastic:  ['plain',   1.0, 14, 0x2a2a2a],   /* 椅子、显示器、垃圾桶 */
  fabric:   ['fabric',  0.6, 0,  0x000000],   /* 被子、床垫、窗帘 */
  brick:    ['brick',   2.4, 0,  0x000000],   /* 外墙砖 */
  concrete: ['concrete',3.0, 0,  0x000000],   /* 车库、屋面、台阶、围墙基座 */
  stone:    ['stone',   2.0, 2,  0x101010],   /* 石材：雕塑、台阶边、门柱 */
  board:    ['board',   2.0, 0,  0x000000],   /* 黑板、白板 */
  grass:    ['grass',   3.0, 0,  0x000000],
  leaf:     ['leaf',    1.6, 0,  0x000000],
  bark:     ['bark',    0.8, 0,  0x000000],
  paper:    ['paper',   0.5, 0,  0x000000],
  dark:     [null,      1.0, 0,  0x000000],   /* 不要纹理的暗面：窗洞、阴影里 */
  glass:    [null,      1.0, 60, 0x8a9aa4],   /* 玻璃：半透明、高光 */
  /* 地面：多边形偏移往后推，家具脚下的阴影、标线才不会和地面打架 */
  ftile:    ['tile',    1.2, 6,  0x181818, 2],
  fterrazzo:['terrazzo',2.0, 8,  0x1c1c1c, 2],
  fconcrete:['concrete',3.0, 0,  0x000000, 2],
  fstone:   ['stone',   2.0, 2,  0x101010, 2],
  fwood:    ['wood',    1.2, 6,  0x161210, 2],
  fgrass:   ['grass',   3.0, 0,  0x000000, 4],
  fpave:    [null,      1.0, 0,  0x000000, 1],
  decal:    [null,      1.0, 0,  0x000000, -2], /* 贴在地上的阴影、标线、水渍 */
  fjoint:   [null,      1.0, 0,  0x000000, 2],  /* 室外铺地的砖缝 */
  paving:   ['concrete',1.6, 0,  0x000000],     /* 室外铺地的方砖 */
  court:    [null,      1.0, 2,  0x101010],     /* 球场、跑道的面层 */
  foliage:  ['foliage', 1.0, 0,  0x000000],     /* 树冠、灌木的叶片卡：一簇叶子的贴图，透明处镂空 */
  dead:     [null,      1.0, 30, 0x30363a],     /* 熄掉的灯管：灰白的磨砂面，有一点反光 */
  grime:    ['grime',   1.0, 0,  0x000000]      /* 污渍贴花：水渍、霉斑、手印、蹭痕（四格图集，带透明） */
};
var MATS={}, TEXS={};

function texSize(){ return Quality.get().texture; }
/* 每张贴图最大 1024（离线贴图包的最大一档）；「真实」档也用 1024，省显存 */
function matTexSize(){ return Math.min(texSize(),1024); }

/* ---- 离线贴图包：TEX_PACK(分辨率, {种类: [颜色图, 高度图]})。流畅、均衡、精细读 512 的，超精细、真实读 1024 的。
   开局在这里同步插进页面（和模型包一样，file:// 也行），图片解码完（页面 load 之前）才算读好；
   游戏里换到更细的一档时后台读，读好以后整批换掉贴图。还没有包时颜色图先用平均亮度的纯色、不加法线。 */
var TEXP={packs:{},loading:{}};
var TEX_MEAN={plaster:231,tile:218,terrazzo:213,ceiling:223,wood:213,metal:205,plain:220,fabric:208,brick:182,
  concrete:199,stone:206,board:74,grass:194,leaf:173,bark:167,paper:236};
function texPackRes(){ return texSize()>512?1024:512; }
function TEX_PACK(res,data){
  var P={res:res,img:{},left:0,ready:false};
  TEXP.packs[res]=P; delete TEXP.loading[res];
  function done(){ if(--P.left===0){ P.ready=true; texPackReady(res); } }
  Object.keys(data).forEach(function(k){
    P.img[k]=data[k].map(function(src){ var im=new Image(); P.left++; im.onload=done; im.onerror=done; im.src=src; return im; });
  });
}
/* 这一种材质现在能用的图：先要当前画质那一档，没读好就用别的已读好的 */
function texPackImg(kind,j){
  function ok(P){ var a=P&&P.ready&&P.img[kind]; return !!(a&&a[j]&&a[j].naturalWidth); }
  var P=TEXP.packs[texPackRes()], r;
  if(ok(P)) return P.img[kind][j];
  for(r in TEXP.packs) if(ok(TEXP.packs[r])) return TEXP.packs[r].img[kind][j];
  return null;
}
function texPackBest(){ var b=0, r; for(r in TEXP.packs) if(TEXP.packs[r].ready&&+r>b) b=+r; return b; }
/* 当前画质要的那一档还没有（已经有更细的就不用读） */
function texPackWant(){
  var res=texPackRes();
  if(TEXP.packs[res]||TEXP.loading[res]||texPackBest()>=res||typeof document==='undefined') return;
  TEXP.loading[res]=1;
  var s=document.createElement('script'); s.src=ASSETS_BASE+'textures_'+res+'.js'; s.async=true;
  s.onerror=function(){ delete TEXP.loading[res]; };
  document.head.appendChild(s);
}
function texBootFinished(res){if(!TEXP.packs[res])delete TEXP.loading[res];}
/* 一档读好了：已经建好的材质换上新贴图 */
function texPackReady(){ if(MAT_TEX_SIZE) matRefreshQuality(true); }
function texParams(t,aniso){
  t.wrapS=THREE.RepeatWrapping; t.wrapT=THREE.RepeatWrapping;
  try{ t.anisotropy=Math.min(aniso,GLR.renderer.capabilities.getMaxAnisotropy()); }catch(e){ t.anisotropy=Math.min(aniso,4); }
  t.generateMipmaps=true; t.minFilter=THREE.LinearMipmapLinearFilter; t.magFilter=THREE.LinearFilter;
  return t;
}
function makeMatTex(kind){
  var SZ=matTexSize(), cv=document.createElement('canvas'); cv.width=SZ; cv.height=SZ;
  var c=cv.getContext('2d'); if(!c) return null;
  var im=texPackImg(kind,0);
  if(im){ c.imageSmoothingEnabled=true; c.imageSmoothingQuality='high'; c.drawImage(im,0,0,SZ,SZ); }
  else{ var v=TEX_MEAN[kind]||220; c.fillStyle='rgb('+v+','+v+','+v+')'; c.fillRect(0,0,SZ,SZ); }
  var t=texParams(new THREE.CanvasTexture(cv),8);
  t.colorSpace=THREE.SRGBColorSpace;
  return t;
}
/* 一簇叶子（带透明通道）：中间密、边上稀，叶子一片片有深有浅，几根细枝 */
function makeFoliageTex(){
  var SZ=Math.max(128,Math.min(512,texSize())), cv=document.createElement('canvas'); cv.width=SZ; cv.height=SZ;
  var c=cv.getContext('2d'), i, k=SZ/256;
  function R(){ return Math.random(); }
  c.clearRect(0,0,SZ,SZ);
  c.strokeStyle='rgba(70,60,50,1)'; c.lineWidth=1.2*k;
  for(i=0;i<7;i++){ var a=R()*6.283; c.beginPath(); c.moveTo(SZ/2,SZ/2); c.lineTo(SZ/2+Math.cos(a)*SZ*0.4,SZ/2+Math.sin(a)*SZ*0.4); c.stroke(); }
  for(i=0;i<520;i++){
    var t=i/520, ang=R()*6.283, rad=Math.sqrt(R())*SZ*0.45*(0.75+0.25*Math.sin(ang*3+1.3));
    var x=SZ/2+Math.cos(ang)*rad, y=SZ/2+Math.sin(ang)*rad*0.92;
    var v=Math.round(120+t*100+R()*35); v=v>255?255:v;                  /* 先画深的（里层），后画浅的（外层） */
    c.fillStyle='rgb('+v+','+v+','+v+')';
    c.beginPath(); c.ellipse(x,y,(5+R()*5)*k,(2.2+R()*2.2)*k,R()*3.14,0,6.283); c.fill();
  }
  var t=new THREE.CanvasTexture(cv);
  t.wrapS=THREE.ClampToEdgeWrapping; t.wrapT=THREE.ClampToEdgeWrapping;
  t.generateMipmaps=true; t.minFilter=THREE.LinearMipmapLinearFilter; t.magFilter=THREE.LinearFilter;
  t.colorSpace=THREE.SRGBColorSpace;
  return t;
}
/* 污渍图集：2×2 格——左上水渍（一圈圈晕开、边上一道深的水线）、右上霉斑（一片细密的点）、
   左下手印（掌心 + 五个指头，往下拖出几道）、右下蹭痕（一道道短的刮擦）。白色画、颜色由顶点色给 */
function makeGrimeTex(){
  var SZ=Math.max(256,Math.min(512,texSize())), cv=document.createElement('canvas'); cv.width=SZ; cv.height=SZ;
  var c=cv.getContext('2d'), h=SZ/2, k=h/256, i, j;
  function R(){ return Math.random(); }
  c.clearRect(0,0,SZ,SZ);
  /* 水渍 */
  for(i=0;i<9;i++){
    var x=h*0.5+(R()-0.5)*h*0.30, y=h*0.5+(R()-0.5)*h*0.30, r=(40+R()*55)*k;
    var g=c.createRadialGradient(x,y,0,x,y,r); g.addColorStop(0,'rgba(255,255,255,0.22)'); g.addColorStop(0.8,'rgba(255,255,255,0.32)'); g.addColorStop(1,'rgba(255,255,255,0)');
    c.fillStyle=g; c.beginPath(); c.arc(x,y,r,0,6.283); c.fill();
    c.strokeStyle='rgba(255,255,255,'+(0.40+R()*0.3).toFixed(2)+')'; c.lineWidth=(1.5+R()*2.5)*k;
    c.beginPath(); for(j=0;j<=24;j++){ var a=j/24*6.283, rr=r*(0.80+0.12*Math.sin(a*3+i)+R()*0.05); c[j?'lineTo':'moveTo'](x+Math.cos(a)*rr,y+Math.sin(a)*rr); } c.stroke();
  }
  /* 霉斑 */
  for(i=0;i<1400;i++){
    var a2=R()*6.283, d=Math.pow(R(),0.7)*h*0.44, mx=h+h*0.5+Math.cos(a2)*d, my=h*0.5+Math.sin(a2)*d*0.8+d*0.2;
    c.fillStyle='rgba(255,255,255,'+(0.45+R()*0.55*(1-d/(h*0.44))).toFixed(2)+')';
    c.beginPath(); c.arc(mx,my,(0.6+R()*2.2)*k*(1-d/(h*0.5)+0.3),0,6.283); c.fill();
  }
  /* 手印 */
  var px=h*0.5, py=h+h*0.56;
  c.fillStyle='rgba(255,255,255,0.78)';
  c.beginPath(); c.ellipse(px,py,26*k,32*k,0,0,6.283); c.fill();
  [[-22,-50,-0.35,26],[-8,-62,-0.1,34],[7,-64,0.05,36],[21,-56,0.2,31],[32,-14,0.9,22]].forEach(function(f){
    c.save(); c.translate(px+f[0]*k,py+f[1]*k); c.rotate(f[2]); c.beginPath(); c.ellipse(0,0,6*k,f[3]*0.55*k,0,0,6.283); c.fill(); c.restore();
  });
  for(i=0;i<4;i++){ c.fillStyle='rgba(255,255,255,'+(0.25+R()*0.2).toFixed(2)+')'; var dx=px+(-14+i*9)*k; c.fillRect(dx,py+20*k,(2+R()*2)*k,(30+R()*55)*k); }   /* 往下淌 */
  /* 蹭痕 */
  for(i=0;i<70;i++){
    var sx=h+h*0.12+R()*h*0.76, sy=h+h*0.12+R()*h*0.76, sa=(R()-0.5)*0.8, sl=(10+R()*40)*k;
    c.strokeStyle='rgba(255,255,255,'+(0.10+R()*0.35).toFixed(2)+')'; c.lineWidth=(0.8+R()*2.2)*k;
    c.beginPath(); c.moveTo(sx,sy); c.lineTo(sx+Math.cos(sa)*sl,sy+Math.sin(sa)*sl); c.stroke();
  }
  var t=new THREE.CanvasTexture(cv);
  t.wrapS=THREE.ClampToEdgeWrapping; t.wrapT=THREE.ClampToEdgeWrapping;
  t.generateMipmaps=true; t.minFilter=THREE.LinearMipmapLinearFilter; t.magFilter=THREE.LinearFilter;
  t.colorSpace=THREE.SRGBColorSpace;
  return t;
}
function matTex(kind){
  if(kind==='grime'){ if(!TEXS[kind]) TEXS[kind]=makeGrimeTex(); return TEXS[kind]; }      /* 贴花离不开贴图（关贴图也要） */
  if(kind==='foliage'){ if(!TEXS[kind]) TEXS[kind]=makeFoliageTex(); return TEXS[kind]; }    /* 叶片卡离不开贴图（关贴图也要） */
  if(!kind||NOTEX) return null;
  if(!TEXS[kind]) TEXS[kind]=makeMatTex(kind);
  return TEXS[kind];
}

/* ---- 浮雕：每种贴图配一张高度图，算成法线贴图 ----
   砖缝、地砖缝、吊顶的分格和针孔、混凝土的裂缝和气孔、木纹、树皮……光从侧面照过来时有起伏，
   不再像印在平面上的花纹。高度图和颜色图是同一次生成的，灰缝、砖的位置对得上。
   分辨率是颜色贴图的一半（法线变化平缓，看不出来），「流畅」档不用。乳胶漆墙、磨光的水磨石只给一点点。 */
var RELIEF={   /* 种类: 强度（normalScale） */
  plaster:0.10, tile:0.9, terrazzo:0.35, ceiling:0.35, wood:0.45, metal:0.18, fabric:0.9,
  brick:1.1, concrete:0.35, stone:0.3, grass:0.5, leaf:0.6, bark:1.2
};
function makeMatHeight(kind){
  var im=texPackImg(kind,1); if(!im) return null;
  var SZ=Math.max(128,matTexSize()>>1), cv=document.createElement('canvas'); cv.width=SZ; cv.height=SZ;
  var c=cv.getContext('2d'); if(!c) return null;
  c.imageSmoothingEnabled=true; c.imageSmoothingQuality='high'; c.drawImage(im,0,0,SZ,SZ);
  return cv;
}
/* 高度图 → 法线贴图（OpenGL 约定：绿色朝 +V；画布的 y 向下，V 向上） */
function heightToNormal(cv){
  var SZ=cv.width, c=cv.getContext('2d'), src=c.getImageData(0,0,SZ,SZ).data, out=c.createImageData(SZ,SZ), d=out.data, x, y;
  var H=new Float32Array(SZ*SZ), i;
  for(i=0;i<SZ*SZ;i++) H[i]=src[i*4]/255;
  var s=SZ/128;                                            /* 不同分辨率下坡度一致 */
  for(y=0;y<SZ;y++) for(x=0;x<SZ;x++){
    var xl=(x+SZ-1)%SZ, xr=(x+1)%SZ, yu=(y+SZ-1)%SZ, yd=(y+1)%SZ;
    var dx=(H[y*SZ+xr]-H[y*SZ+xl])*s, dy=(H[yd*SZ+x]-H[yu*SZ+x])*s;
    var nx=-dx, ny=dy, nz=1, l=Math.sqrt(nx*nx+ny*ny+nz*nz), o=(y*SZ+x)*4;
    d[o]=(nx/l*0.5+0.5)*255; d[o+1]=(ny/l*0.5+0.5)*255; d[o+2]=(nz/l*0.5+0.5)*255; d[o+3]=255;
  }
  var nc=document.createElement('canvas'); nc.width=SZ; nc.height=SZ; nc.getContext('2d').putImageData(out,0,0);
  return nc;
}
function matNormal(kind){
  if(!kind||NOTEX||!Quality.get().relief||!RELIEF[kind]) return null;
  var key='n:'+kind;
  if(TEXS[key]===undefined){
    var h=null; try{ h=makeMatHeight(kind); }catch(e){ h=null; }
    if(!h){ TEXS[key]=null; return null; }
    var t=new THREE.CanvasTexture(heightToNormal(h));
    t.wrapS=THREE.RepeatWrapping; t.wrapT=THREE.RepeatWrapping;
    try{ t.anisotropy=Math.min(4,GLR.renderer.capabilities.getMaxAnisotropy()); }catch(e){ t.anisotropy=2; }
    t.generateMipmaps=true; t.minFilter=THREE.LinearMipmapLinearFilter; t.magFilter=THREE.LinearFilter;
    t.colorSpace=THREE.NoColorSpace;
    TEXS[key]=t;
  }
  return TEXS[key];
}
/* 材质保持引用稳定；分辨率变更（或读好了更细的贴图包：force）时替换贴图并释放旧贴图，不累积四套 GPU 资源。 */
var MAT_TEX_SIZE=0;
function matRefreshQuality(force){
  texPackWant();
  if(!force&&MAT_TEX_SIZE===texSize())return;
  var old=TEXS;TEXS={};
  if(MAT_TEX_SIZE===texSize()) ['foliage','grime'].forEach(function(k){ if(old[k]){ TEXS[k]=old[k]; delete old[k]; } });   /* 现场画的两张尺寸没变就留着 */
  MAT_TEX_SIZE=texSize();
  Object.keys(MATS).forEach(function(k){
    var m=MATS[k],kind=(MAT_DEF[k]||MAT_DEF.plaster)[0];
    if(m.map)m.map=matTex(kind);
    if(m.isMeshPhongMaterial){m.normalMap=matNormal(kind);if(m.normalMap)m.normalScale.set(RELIEF[kind],RELIEF[kind]);}
    m.needsUpdate=true;
  });
  Object.keys(MATS_PBR).forEach(function(k){
    var m=MATS_PBR[k],kind=(MAT_DEF[k]||MAT_DEF.plaster)[0];
    if(m.map)m.map=matTex(k==='foliage'||k==='grime'?k:kind);
    if(m.normalMap!==undefined&&k!=='foliage'&&k!=='grime'&&k!=='glass'){m.normalMap=matNormal(kind);if(m.normalMap)m.normalScale.set(RELIEF[kind]*1.4,RELIEF[kind]*1.4);}
    m.needsUpdate=true;
  });
  Object.keys(old).forEach(function(k){if(old[k])old[k].dispose();});
}
/* 「真实」档的物理材质：粗糙度、金属度按原来的高光换算，法线贴图更深，吃环境反射（scene.environment）。
   单独一套缓存：切回别的档位时仍用原来的那批，不来回改同一个材质。发光、窗外天光这些不吃光的材质两边共用。 */
var MATS_PBR={}, PBR_SKIP={emit:1,emitDying:1,lamp:1,litwin:1,sky:1};
function matPBR(key){
  if(MATS_PBR[key]) return MATS_PBR[key];
  var d=MAT_DEF[key]||MAT_DEF.plaster, m, o;
  var rough=Math.max(0.22,Math.min(0.96,1-Math.sqrt((d[2]||0)/90))), metal=(key==='metal')?0.7:0;
  if(key==='glass'){
    m=new THREE.MeshStandardMaterial({vertexColors:true,transparent:true,opacity:0.34,roughness:0.05,metalness:0,depthWrite:false,envMapIntensity:1.4});
  }else if(key==='grime'){
    m=new THREE.MeshStandardMaterial({vertexColors:true,map:matTex('grime'),transparent:true,depthWrite:false,roughness:1,metalness:0,
      polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4});
  }else if(key==='foliage'){
    m=new THREE.MeshStandardMaterial({vertexColors:true,map:matTex('foliage'),alphaTest:0.42,roughness:0.82,metalness:0});
  }else{
    o={vertexColors:true,roughness:rough,metalness:metal,envMapIntensity:0.55};
    var t=matTex(d[0]); if(t) o.map=t;
    var nt=matNormal(d[0]); if(nt){ o.normalMap=nt; var ns=RELIEF[d[0]]*1.4; o.normalScale=new THREE.Vector2(ns,ns); }
    if(d[4]){ o.polygonOffset=true; o.polygonOffsetFactor=d[4]; o.polygonOffsetUnits=d[4]*2; }
    m=new THREE.MeshStandardMaterial(o);
  }
  m.userData.shared=true;
  MATS_PBR[key]=m;
  return m;
}
/* 共享材质：所有房间、室外都用同一批，切场景时不销毁（userData.shared） */
function matOf(key){
  if(!MAT_TEX_SIZE){ MAT_TEX_SIZE=texSize(); texPackWant(); }
  if(Quality.get().pbr&&!PBR_SKIP[key]) return matPBR(key);
  if(MATS[key]) return MATS[key];
  var d=MAT_DEF[key]||MAT_DEF.plaster, m;
  if(key==='glass'){
    m=new THREE.MeshPhongMaterial({vertexColors:true,transparent:true,opacity:0.42,shininess:d[2],specular:d[3],depthWrite:false});
  }else if(key==='grime'){
    m=new THREE.MeshLambertMaterial({vertexColors:true,map:matTex('grime'),transparent:true,depthWrite:false,
      polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4});
  }else if(key==='emitDying'){
    m=new THREE.MeshBasicMaterial({vertexColors:true,fog:true});                            /* 快坏的灯管：lighting.js 每帧调颜色 */
  }else if(key==='emit'){
    m=new THREE.MeshBasicMaterial({vertexColors:true,fog:true});
  }else if(key==='lamp'){
    m=new THREE.MeshBasicMaterial({vertexColors:true,fog:true}); GLR.lampHeadMat=m;      /* 路灯灯头：颜色由 lampTick() 调 */
  }else if(key==='litwin'){
    m=new THREE.MeshBasicMaterial({vertexColors:true,fog:true}); GLR.winLitMat=m;        /* 夜里亮着的窗 */
  }else if(key==='foliage'){
    m=new THREE.MeshPhongMaterial({vertexColors:true,map:matTex('foliage'),alphaTest:0.42,shininess:0,specular:0x000000});
  }else if(key==='sky'){
    /* 窗外的天光：白天亮、夜里暗，颜色由 lampTick() 每帧调 */
    m=new THREE.MeshBasicMaterial({vertexColors:true,fog:true});
    GLR.winSkyMat=m;
  }else{
    var o={vertexColors:true,shininess:d[2],specular:d[3]};
    var t=matTex(d[0]); if(t) o.map=t;
    var nt=matNormal(d[0]); if(nt){ o.normalMap=nt; var ns=RELIEF[d[0]]; o.normalScale=new THREE.Vector2(ns,ns); }
    if(d[4]){ o.polygonOffset=true; o.polygonOffsetFactor=d[4]; o.polygonOffsetUnits=d[4]*2; }
    m=new THREE.MeshPhongMaterial(o);
  }
  m.userData.shared=true;
  MATS[key]=m;
  return m;
}
function matUV(key){ var d=MAT_DEF[key]; return d?d[1]:2.4; }
/* 开局要的那一档贴图包：照存档里的画质（assets.js 的 bootQuality），解析到这里就同步插进页面 */
(function(){
  if(typeof document==='undefined'||!document.write) return;
  var res=Quality.get(bootQuality()).texture>512?1024:512;
  TEXP.loading[res]=1;
  document.write('<script src="'+ASSETS_BASE+'textures_'+res+'.js" onerror="texBootFinished('+res+')" onload="texBootFinished('+res+')"><\/script>');
})();
