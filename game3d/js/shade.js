/* @module-capsule */
(function($imports){
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
function shadeWantShadows(){ return ($imports.QUALITY|0)>=2; }
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
  if(!$imports.GLR.renderer) return;
  var on=shadeWantShadows();
  if(SHADE.shadows!==on){
    SHADE.shadows=on;
    $imports.GLR.renderer.shadowMap.enabled=on;
    $imports.GLR.renderer.shadowMap.type=$imports.THREE.PCFSoftShadowMap;
    /* 打开 / 关掉阴影要重编着色器 */
    $imports.GLR.scene.traverse(function(o){ if(o.material){ (Array.isArray(o.material)?o.material:[o.material]).forEach(function(m){ m.needsUpdate=true; }); } });
  }
  var m=$imports.GLR.moon;
  m.castShadow=on;
  if(on){
    shadeSize(m,Math.min($imports.Quality.get().shadow,$imports.GLR.renderer.capabilities.maxTextureSize));
    var sc=m.shadow.camera; sc.left=-30; sc.right=30; sc.top=30; sc.bottom=-30; sc.near=1; sc.far=90;
    sc.updateProjectionMatrix();
    m.shadow.bias=-0.0006; m.shadow.normalBias=0.04;
    if(!m.target.parent) $imports.GLR.scene.add(m.target);
  }else{
    shadeRelease(m);shadeRelease($imports.GLR.torch);
    /* 不跟随玩家时，日月光按相对于原点的方向照射。 */
    m.target.position.set(0,0,0);
    m.target.updateMatrixWorld();
  }
  $imports.GLR.torch.castShadow=on;
  if(on)shadeSize($imports.GLR.torch,Math.min($imports.Quality.get().torchShadow,$imports.GLR.renderer.capabilities.maxTextureSize));
  shadeRoomLights();
  shadeMarkMesh($imports.GLR.roomMesh); shadeMarkMesh($imports.GLR.outMesh);
}
/* 超精细只让距相机最近的一盏顶灯投影，限制点光源的六面阴影开销。 */
function shadeRoomLights(){
  var lights=$imports.GLR.roomLights||[],size=$imports.Quality.get().ceilingShadow,best=-1,dist=Infinity;
  lights.forEach(function(l,i){
    var d=l.position.distanceToSquared($imports.GLR.cam.position);
    if(size&&l.position.y>=2&&l.position.y<=4&&d<dist){dist=d;best=i;}
  });
  lights.forEach(function(l,i){
    l.castShadow=i===best;
    if(l.castShadow){
      /* PointLight 的图集为 4×2 面；尺寸仍须服从设备上限。 */
      shadeSize(l,Math.min(size,Math.floor($imports.GLR.renderer.capabilities.maxTextureSize/4)));
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
  if(!SHADE.shadows||!$imports.GLR.moon) return;
  var c=$imports.GLR.cam.position, m=$imports.GLR.moon, d=m.position.clone().normalize();
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
  var t=new $imports.THREE.CanvasTexture(cv);
  SHADE[key]=t; return t;
}

/* ---------- 窗光光柱 ---------- */
var SHAFT_ACC=null;            /* buildRoomGeometry 期间收集窗户：{x,z,nx,nz,w,y0,y1} */
function shaftNote(x,z,nx,nz,w,y0,y1){ if(SHAFT_ACC) SHAFT_ACC.push({x:x,z:z,nx:nx,nz:nz,w:w,y0:y0,y1:y1}); }
function shadeBuildRoom(R){
  shadeClearRoom();
  if(($imports.QUALITY|0)<1||!R||!R.shafts||!R.shafts.length) return;
  if(!SHADE.shaftMat) SHADE.shaftMat=new $imports.THREE.MeshBasicMaterial({map:shadeTex('shaft'),color:0xfff1d6,transparent:true,opacity:0,
    blending:$imports.THREE.AdditiveBlending,depthWrite:false,side:$imports.THREE.DoubleSide,fog:true});
  var grp=new $imports.THREE.Group(), i, w;
  for(i=0;i<R.shafts.length;i++){
    w=R.shafts[i];
    /* 从窗口往屋里、往下斜：太阳从窗外高处照进来 */
    var reach=Math.max(2.2,w.y1/0.9), fy=Math.max(0.02,w.y1-reach*0.9);   /* 斜 42° 落到地上 */
    var ix=w.nx, iz=w.nz, tx=-iz, tz=ix, hw=w.w/2;
    var p=[
      [w.x-tx*hw,w.y1,w.z-tz*hw],[w.x+tx*hw,w.y1,w.z+tz*hw],
      [w.x+tx*hw+ix*reach,fy,w.z+tz*hw+iz*reach],
      [w.x-tx*hw+ix*reach,fy,w.z-tz*hw+iz*reach]];
    var g=new $imports.THREE.BufferGeometry();
    g.setAttribute('position',new $imports.THREE.Float32BufferAttribute([].concat(p[0],p[1],p[2],p[0],p[2],p[3]),3));
    g.setAttribute('uv',new $imports.THREE.Float32BufferAttribute([0,1,1,1,1,0,0,1,1,0,0,0],2));
    var me=new $imports.THREE.Mesh(g,SHADE.shaftMat); me.renderOrder=3; grp.add(me);
  }
  SHADE.shaftGrp=grp; $imports.GLR.scene.add(grp);
}
function shadeClearRoom(){
  if(SHADE.shaftGrp){ $imports.GLR.scene.remove(SHADE.shaftGrp); SHADE.shaftGrp.traverse(function(o){ if(o.geometry) o.geometry.dispose(); }); SHADE.shaftGrp=null; }
  SHADE.pools.forEach(function(p){ $imports.GLR.scene.remove(p); if(p.material) p.material.dispose(); });
  SHADE.pools=[];
}
/* ---------- 灯下光斑（addRoomLights 之后调） ---------- */
var POOL_GEO=null;
function shadeBuildPools(){
  SHADE.pools.forEach(function(p){ $imports.GLR.scene.remove(p); if(p.material) p.material.dispose(); });
  SHADE.pools=[];
  if(!$imports.GLR.roomLights||$imports.Engine.sceneView().mode!=='in') return;
  if(!POOL_GEO){ POOL_GEO=new $imports.THREE.PlaneGeometry(1,1); POOL_GEO.rotateX(-$imports.PI/2); }
  $imports.GLR.roomLights.forEach(function(L,i){
    if(L.position.y<2||L.position.y>4) return;            /* 只给顶灯（钟楼上头那盏不算） */
    var m=new $imports.THREE.MeshBasicMaterial({map:shadeTex('pool'),color:L.color.clone(),transparent:true,opacity:0,
      blending:$imports.THREE.AdditiveBlending,depthWrite:false,fog:true});
    var p=new $imports.THREE.Mesh(POOL_GEO,m);
    var r=Math.min(4.2,(L.distance||12)*0.26);
    p.scale.set(r,1,r); p.position.set(L.position.x,0.015,L.position.z); p.renderOrder=2;
    p.userData.i=i; $imports.GLR.scene.add(p); SHADE.pools.push(p);
  });
}
/* 每帧：光柱跟天色，光斑跟着灯 */
function shadeTick(st){
  shadeFollow();
  if($imports.Quality.get().ceilingShadow)shadeRoomLights();
  if(SHADE.shaftMat){
    var day=st?st.day:0, k=st&&st.indoor?day:0;
    var dust=0.92+0.08*Math.sin(($imports.GLR.time||0)*0.7);
    SHADE.shaftMat.opacity=0.26*k*dust*(1-0.8*($imports.GLR.patrolRed||0))*(1-0.6*($imports.GLR.overcast||0));
  }
  SHADE.pools.forEach(function(p){
    var L=$imports.GLR.roomLights[p.userData.i], base=$imports.GLR.roomLightBase[p.userData.i]||1;
    if(!L){ p.visible=false; return; }
    p.material.opacity=(0,$imports.clamp)(L.intensity/base,0,1.2)*0.10;
    p.material.color.copy(L.color);
  });
}

/* @module-exports */
GameModules.publish("game3d/js/shade.js",{
"SHADE":{get:function(){return SHADE;},set:function($value){SHADE=$value;}},
"shadeWantShadows":{get:function(){return shadeWantShadows;},set:function($value){shadeWantShadows=$value;}},
"shadeRelease":{get:function(){return shadeRelease;},set:function($value){shadeRelease=$value;}},
"shadeSize":{get:function(){return shadeSize;},set:function($value){shadeSize=$value;}},
"shadeApplyQuality":{get:function(){return shadeApplyQuality;},set:function($value){shadeApplyQuality=$value;}},
"shadeRoomLights":{get:function(){return shadeRoomLights;},set:function($value){shadeRoomLights=$value;}},
"shadeMarkMesh":{get:function(){return shadeMarkMesh;},set:function($value){shadeMarkMesh=$value;}},
"shadeFollow":{get:function(){return shadeFollow;},set:function($value){shadeFollow=$value;}},
"shadeTex":{get:function(){return shadeTex;},set:function($value){shadeTex=$value;}},
"SHAFT_ACC":{get:function(){return SHAFT_ACC;},set:function($value){SHAFT_ACC=$value;}},
"shaftNote":{get:function(){return shaftNote;},set:function($value){shaftNote=$value;}},
"shadeBuildRoom":{get:function(){return shadeBuildRoom;},set:function($value){shadeBuildRoom=$value;}},
"shadeClearRoom":{get:function(){return shadeClearRoom;},set:function($value){shadeClearRoom=$value;}},
"POOL_GEO":{get:function(){return POOL_GEO;},set:function($value){POOL_GEO=$value;}},
"shadeBuildPools":{get:function(){return shadeBuildPools;},set:function($value){shadeBuildPools=$value;}},
"shadeTick":{get:function(){return shadeTick;},set:function($value){shadeTick=$value;}}
});
})(GameModules.imports("game3d/js/shade.js"));
