/* Three.js 场景生命周期、灯光与相机。 */
'use strict';
/* ---- 场景缓存 ----
   房间、室外的模型只和画质、门开没开有关，每次进出都整个重建很浪费（室外一次一两百毫秒）。
   离开时把网格从场景里拿掉、释放显存（geometry.dispose 只删显卡上的缓冲，数据还在），
   再回来直接用，显卡那边自动重新上传。最多留室外 + 最近 3 个房间；换画质、换贴图分辨率时清空。
   门扇单独成块，回来时按当时开没开重建（room.js 的 roomDoorRefresh）。 */
var SCENE_CACHE={key:'',out:null,rooms:{},order:[]};
var SCENE_CACHE_ROOMS=3;
/* 换新局或读档时从当前 SAN 起步；同一局内仍按帧平滑变化。 */
ThreeBackend.resetSan=function(value){
  GLR.sanSense=clamp(Number.isFinite(value)?value/100:1,0,1);
  if(GLR.postMat) GLR.postMat.uniforms.uSan.value=GLR.sanSense;
};
function sceneCacheKey(){ return QUALITY+'|'+(NOTEX?1:0); }
function disposeGroup(g,keepData){return ThreeBackend.disposeGroup(g,keepData);}
function sceneCacheCheck(){
  var k=sceneCacheKey(); if(SCENE_CACHE.key===k) return;
  sceneCacheClear(); SCENE_CACHE.key=k;
}
function sceneCacheClear(){
  var id;
  if(SCENE_CACHE.out&&SCENE_CACHE.out!==GLR.outMesh) disposeGroup(SCENE_CACHE.out);
  for(id in SCENE_CACHE.rooms) if(SCENE_CACHE.rooms[id]!==GLR.roomMesh) disposeGroup(SCENE_CACHE.rooms[id]);
  if(GLR.outMesh) GLR.outMesh.userData.uncached=1;            /* 正在用的这份离开时直接销毁 */
  if(GLR.roomMesh) GLR.roomMesh.userData.uncached=1;
  SCENE_CACHE.out=null; SCENE_CACHE.rooms={}; SCENE_CACHE.order=[]; SCENE_CACHE.key='';
}
function sceneCacheRoom(id,g){
  var previous=SCENE_CACHE.rooms[id];
  if(previous&&previous!==g)disposeGroup(previous);
  SCENE_CACHE.rooms[id]=g;
  SCENE_CACHE.order=SCENE_CACHE.order.filter(function(x){ return x!==id; }); SCENE_CACHE.order.push(id);
  while(SCENE_CACHE.order.length>SCENE_CACHE_ROOMS){
    var old=SCENE_CACHE.order.shift(), og=SCENE_CACHE.rooms[old]; delete SCENE_CACHE.rooms[old];
    if(og&&og!==GLR.roomMesh) disposeGroup(og);
  }
}
function releaseSceneMesh(g){
  var cached=!g.userData.uncached&&(g===SCENE_CACHE.out||SCENE_CACHE.rooms[g.userData.roomId]===g);
  disposeGroup(g,cached);
}

ThreeBackend.disposeGroup=function(g,keepData){
  if(!g)return;
  var geometries=new Set(),materials=new Set();
  g.traverse(function(o){
    if(o.isInstancedMesh&&!keepData)o.dispose();          /* 实例矩阵、实例颜色的显存；几何体是各房间共用的 */
    if(o.geometry&&!(o.geometry.userData&&o.geometry.userData.shared))geometries.add(o.geometry);
    if(!keepData&&o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(function(m){if(!(m.userData&&m.userData.shared))materials.add(m);});
  });
  geometries.forEach(function(g){g.dispose();});materials.forEach(function(m){m.dispose();});
};
ThreeBackend.clearWorld=function(){
  var i;
  if(typeof APPAR!=='undefined'&&APPAR.g)APPAR.g.visible=false;
  if(GLR.roamFig){GLR.scene.remove(GLR.roamFig);ThreeBackend.disposeGroup(GLR.roamFig);GLR.roamFig=null;}
  if(typeof TR!=='undefined'&&TR.g){GLR.scene.remove(TR.g);ThreeBackend.disposeGroup(TR.g);TR.g=null;TR.key='';}
  try{ shadeClearRoom(); }catch(e){}
  if(GLR.roomMesh){ GLR.scene.remove(GLR.roomMesh); releaseSceneMesh(GLR.roomMesh); GLR.roomMesh=null; }
  if(GLR.outMesh){ GLR.scene.remove(GLR.outMesh); releaseSceneMesh(GLR.outMesh); GLR.outMesh=null; }
  if(GLR.roomLights){
    for(i=0;i<GLR.roomLights.length;i++){GLR.roomLights[i].dispose();GLR.scene.remove(GLR.roomLights[i]);}
    GLR.roomLights=[]; GLR.roomLightBase=[]; GLR.roomLightCol=[];
    try{ FLK_PREV=[]; }catch(e){}
  }
};
/* 仅替换静态模型，避免切档重置同学位置、堵门、追逐、异象、门和计时器。 */
ThreeBackend.applyQuality=function(){
  ThreeBackend.resize();sceneCacheClear();sceneCacheCheck();matRefreshQuality();
  var old=GLR.roomMesh||GLR.outMesh;
  if(old){
    GLR.scene.remove(old);ThreeBackend.disposeGroup(old);
    if(GLR.roomMesh){
      var R=INTERIORS[S.room];
      GLR.roomMesh=buildRoomGeometry(R);GLR.scene.add(GLR.roomMesh);
      shadeBuildRoom(R);shadeBuildPools();
    }else{
      GLR.outMesh=buildOutdoorGeometry();GLR.outMesh.userData.__outworld=1;GLR.scene.add(GLR.outMesh);
    }
  }
  GLR.scene.traverse(function(o){
    var d=o.geometry&&o.geometry.userData;
    if(d&&d.figKind)o.geometry=figGeo(d.figKind);
    if(d&&d.fxKind)o.geometry=fxGeo(d.fxKind);
    if(d&&d.patGear)o.geometry=patGearGeo();
    if(d&&d.cup)o.geometry=cupGeo();
  });
  if(GLR.roomMesh){GLR.roomMesh.userData.roomId=S.room;GLR.roomMesh.userData.roomData=INTERIORS[S.room];sceneCacheRoom(S.room,GLR.roomMesh);}
  if(GLR.outMesh){SCENE_CACHE.out=GLR.outMesh;GLR.outMesh.userData.layout={solid:OUT_SOLID,lamps:OUT_LAMPS};}
  shadeApplyQuality();
};
ThreeBackend.addRoomLights=function(R){
  var W=R.cols*TTILE*U2M, H=R.rows*TTILE*U2M, i;
  function addLight(x,y,z,col,inten,dist,decay){
    var pl=new THREE.PointLight(col,inten,dist,decay);
    pl.position.set(x,y,z);
    GLR.scene.add(pl);
    GLR.roomLights.push(pl);
    GLR.roomLightBase.push(inten);
    (GLR.roomLightCol||(GLR.roomLightCol=[])).push(new THREE.Color(col));
  }
  var teach=R.host==='teach'&&R.floor>=1&&R.floor<=5;
  var spec=ROOM_LIGHTS[R.id]||ROOM_LIGHTS[teach?'teach':R.host]||ROOM_LIGHTS.default;
  spec.forEach(function(v){
    var x=v[0],z=v[2];
    if(v[6]==='room'){x*=W;z*=H;}
    if(v[6]==='tile'){x=x*TTILE*U2M-W/2;z=z*TTILE*U2M-H/2;}
    addLight(x,v[1],z,v[3],LCFG.ptI*v[4],v[5],2);
  });
  if(teach)addLight(0,2.75,18.5*TTILE*U2M-H/2,0xf2dcc0,LCFG.ptI*1.2,18,2);
  if(teach||(R.host==='lab'&&R.floor>=1&&R.floor<=5)){
    var liftCol=teach?20.5:10.5;
    addLight(liftCol*TTILE*U2M-W/2,2.65,(R.rows-1.5)*TTILE*U2M-H/2,0xe2eeec,LCFG.ptI*0.65,10,2);
  }
  if(R.host==='bell'&&R.spiral){
    addLight(SPIRAL.cx,SPIRAL.topH/2,SPIRAL.cz+2,0xd8b080,LCFG.ptI*0.5,9,2);
    addLight(SPIRAL.cx,SPIRAL.topH+2.6,SPIRAL.cz,0xc8d0d8,LCFG.ptI*0.8,10,2);
  }
};
ThreeBackend.enterRoom=function(roomId){
  clearWorldMesh();sceneCacheCheck();
  var R=INTERIORS[roomId],cached=SCENE_CACHE.rooms[roomId];
  if(cached&&cached.userData.roomData===R){GLR.roomMesh=cached;roomDoorRefresh(R);}
  else{GLR.roomMesh=buildRoomGeometry(R);GLR.roomMesh.userData.roomId=roomId;GLR.roomMesh.userData.roomData=R;}
  sceneCacheRoom(roomId,GLR.roomMesh);
  GLR.scene.add(GLR.roomMesh);
  if(roomId==='garage1'){
    GLR.roamFig=buildRoamFigure();
    if(GLR.roamFig){ GLR.roamFig.visible=false; GLR.scene.add(GLR.roamFig); }
  }
  var dens=roomId==='garage1'?0.082:0.050;
  GLR.scene.fog=new THREE.FogExp2(FOG_COL,dens);
  addRoomLights(R);
  try{ shadeMarkMesh(GLR.roomMesh); shadeBuildRoom(R); shadeBuildPools(); }catch(e){}
  try{ tracesBuild(); }catch(e){}
  try{ ncBuild(R); }catch(e){}
  try{ skipClear(); }catch(e){}
};
ThreeBackend.enterOutside=function(){
  clearWorldMesh();sceneCacheCheck();
  try{ ncClear(); }catch(e){}      /* 出去就没有同班同学了 */
  if(SCENE_CACHE.out){GLR.outMesh=SCENE_CACHE.out;OUT_SOLID=GLR.outMesh.userData.layout.solid;OUT_LAMPS=GLR.outMesh.userData.layout.lamps;}
  else{
    GLR.outMesh=buildOutdoorGeometry();GLR.outMesh.userData.__outworld=1;
    GLR.outMesh.userData.layout={solid:OUT_SOLID,lamps:OUT_LAMPS};SCENE_CACHE.out=GLR.outMesh;
  }
  GLR.scene.add(GLR.outMesh);
  try{ shadeMarkMesh(GLR.outMesh); }catch(e){}
  GLR.scene.fog=new THREE.FogExp2(FOG_COL,0.020);
  GLR.skyHour=-1; refreshSky();
  GLR.lampPick=0;
  try{ tracesBuild(); }catch(e){}
};

ThreeBackend.syncCamera=function(dt,view){
  var p;
  if(S.mode==='in'){
    var R=INTERIORS[S.room];
    p=worldToScene(S.x,S.y,R);
  }else{
    p=worldToScene(S.x,S.y,null);
  }
  var bob=0;
  if(S.moving&&!S.seated){
    S.walkPhase+=dt*(S.run?13.5:8.5);
    bob=Math.sin(S.walkPhase)*(S.run?0.052:0.030);
  }
  var dyOff=0, dzOff=0, shake=0;
  if(S.dead){
    var k=S.deadT||0;
    shake=Math.max(0,1-k*0.5);
  }
  if(GLR.gazeShake&&!S.dead) shake=Math.max(shake,GLR.gazeShake);   /* 被盯着的时候，镜头在抖 */
  if(typeof SHAKE_ON!=='undefined' && !SHAKE_ON) shake=0;
  if(shake>0){
    dyOff+=(Math.random()-0.5)*0.06*shake;
  }
  if(typeof SHAKE_ON!=='undefined' && !SHAKE_ON){ bob=0; }
  var eyeTarget=S.seated?1.12:EYE;
  S.eyeH=(S.eyeH===undefined)?EYE:S.eyeH;
  S.eyeH+= (eyeTarget-S.eyeH)*Math.min(1,dt*9);
  var cameraLift=view?view.eyeLift:S.eyeLift;
  GLR.cam.position.set(p.x, S.eyeH+bob+dyOff+(cameraLift||0)+(S.floorY||0), p.z+dzOff);   /* floorY：钟楼楼梯上的高度 */
  var targetFov=72+(S.run&&S.moving?9:0);
  S.fov=lerp(S.fov,targetFov,Math.min(1,dt*8));
  /* 超宽屏的近平面角不能越过角色碰撞圆。普通屏保持原来的 0.08 米。 */
  var tan=Math.tan(S.fov*PI/360),near=Math.min(0.08,PRAD*U2M/(1.3*Math.sqrt(1+tan*tan*(1+GLR.cam.aspect*GLR.cam.aspect))));
  if(Math.abs(GLR.cam.fov-S.fov)>0.01||Math.abs(GLR.cam.near-near)>0.0001){
    GLR.cam.fov=S.fov;GLR.cam.near=near;GLR.cam.updateProjectionMatrix();
    GLR.postMat.uniforms.uNear.value=near;
  }
  var angle=view?view.ang:S.ang, spitch=(view?view.pitch:S.pitch)+(S.seated?-0.06:0);
  var dir=new THREE.Vector3(Math.cos(angle)*Math.cos(spitch),Math.sin(spitch),Math.sin(angle)*Math.cos(spitch));
  /* 目标点也要跟着死亡演出的升降走，否则镜头一沉就变成仰视 */
  GLR.cam.lookAt(p.x+dir.x, S.eyeH+bob+dir.y+(cameraLift||0)+(S.floorY||0), p.z+dir.z);
};

ThreeBackend.draw=function(dt){
  if(!GLR.renderer) return;
  if(S.dead){ GLR.hurt=Math.min(0.85,GLR.hurt+dt*0.12); }
  else { GLR.hurt=Math.max(0,GLR.hurt-dt*0.6); }
  GLR.flash=Math.max(0, (GLR.flash||0)-dt*1.7);
  updateLighting();
  if(typeof CUT!=='undefined'&&CUT.on) cutTick(dt);        /* 结局演出：镜头由 cutscene.js 摆 */
  if(GLR.dust){
    GLR.dustT=(GLR.dustT||0)+dt;
    GLR.dust.position.set(GLR.cam.position.x,0,GLR.cam.position.z);
    GLR.dust.rotation.y=GLR.dustT*0.015;
    GLR.dust.position.y=Math.sin(GLR.dustT*0.25)*0.08;
  }
  if(GLR.roamFig){
    if(S.mode==='in'&&S.room==='garage1'&&typeof ROAM!=='undefined'&&ROAM.on&&ROAM.x>-1e5){
      var rp=worldToScene(ROAM.x,ROAM.y,INTERIORS['garage1']);
      GLR.roamFig.visible=true;
      GLR.roamFig.position.set(rp.x,0,rp.z);
      GLR.roamFig.lookAt(GLR.cam.position.x,0,GLR.cam.position.z);
    } else { GLR.roamFig.visible=false; }
  }
  var debugFrozen=typeof DEV!=='undefined'&&DEV.on&&DEV.freeze;
  /* 调试暂停冻结异象和环境幻觉；主动触发的死亡演出仍可预览。 */
  try{ if(!debugFrozen||(typeof ANFX!=='undefined'&&ANFX.kind==='death'))anfxUpdate(dt); }catch(e){}
  try{ if(!debugFrozen)smileTick(dt); }catch(e){}
  try{ patRender(); }catch(e){}
  try{ handsTick(dt); }catch(e){}
  try{ if(!debugFrozen)hallucTick(dt); }catch(e){}
  try{ if(!debugFrozen)apparTick(dt); }catch(e){}
  GLR.cam.updateMatrixWorld();
  entFace();
  var u=GLR.postMat.uniforms;
  u.uTime.value=GLR.time;
  var preview=VisualState.deathAnim;
  if(preview){
    preview.t=Math.min(preview.dur,preview.t+dt);
    u.uDm.value=preview.mode;u.uDt.value=preview.t/preview.dur;
    if(preview.t>=preview.dur){VisualState.deathAnim=null;u.uDm.value=0;u.uDt.value=0;}
  }else{u.uDm.value=0;u.uDt.value=0;}
  var _fnOn=(S.fn&&S.fn.on&&S.fn.v<72)?1:0;
  GLR.fnNorm=GLR.fnNorm===undefined?0:GLR.fnNorm;
  GLR.fnNorm+= (_fnOn-GLR.fnNorm)*Math.min(1,dt*1.6);
  u.uFx.value=Math.max(GLR.fnNorm,(GLR.worldNorm||0),(GLRTEST.nofx?1:0));
  GLR.gaze=(GLR.gaze||0)+((GLR.gazeT||0)-(GLR.gaze||0))*Math.min(1,dt*2.4);
  u.uGaze.value=GLR.gaze;
  u.uHurt.value=GLR.hurt;
  u.uFlash.value=GLR.flash;
  u.uExpo.value=(GLR.dayExpo===undefined)?1:GLR.dayExpo;
  u.uRed.value=GLR.patrolRed||0;
  var targetSan=clamp(S.san/100,0,1);
  GLR.sanSense=GLR.sanSense===undefined?targetSan:GLR.sanSense+(targetSan-GLR.sanSense)*(1-Math.exp(-dt*2));
  u.uSan.value=GLR.sanSense;
  if(GLRTEST.nopost){
    GLR.renderer.setRenderTarget(null);
    GLR.renderer.render(GLR.scene,GLR.cam);
    ThreeBackend.drawHands();
    return;
  }
  GLR.renderer.setRenderTarget(GLR.rt);
  GLR.renderer.clear();
  GLR.renderer.render(GLR.scene,GLR.cam);
  ThreeBackend.drawHands();
  GLR.renderer.setRenderTarget(null);
  GLR.renderer.render(GLR.postScene,GLR.postCam);
};
/* 手持物使用独立目标，保留世界深度供 AO 读取，再在后期合成。 */
ThreeBackend.drawHands=function(){
  var root=GLR.handRoot,r=GLR.renderer;
  var on=!!(root&&root.visible);
  GLR.postMat.uniforms.uHands.value=on?1:0;
  if(!on)return;
  root.matrix.copy(GLR.cam.matrixWorld);root.matrixWorldNeedsUpdate=true;
  if(GLRTEST.nopost){
    var clear=r.autoClear;r.autoClear=false;r.clearDepth();
    r.render(GLR.handScene,GLR.cam);r.autoClear=clear;return;
  }
  var color=r.getClearColor(new THREE.Color()),alpha=r.getClearAlpha();
  r.setRenderTarget(GLR.handRT);r.setClearColor(0x000000,0);
  r.clear();r.render(GLR.handScene,GLR.cam);
  r.setClearColor(color,alpha);r.setRenderTarget(GLR.rt);
};

ThreeBackend.captureMenu=function(){
    var cv=document.getElementById('cv');
    var c=GLR.cam, yaw=-0.35;
    c.position.set(66.7,7.0,133.3);
    c.fov=74; c.updateProjectionMatrix();
    c.lookAt(66.7+Math.cos(yaw)*12, 6.4, 133.3+Math.sin(yaw)*12);
    var u=GLR.postMat.uniforms;
    u.uTime.value=0.6; u.uHurt.value=0; u.uFlash.value=0; u.uSan.value=0.62;u.uHands.value=0;
    GLR.renderer.setRenderTarget(GLR.rt);
    GLR.renderer.clear();
    GLR.renderer.render(GLR.scene,c);
    GLR.renderer.setRenderTarget(null);
    GLR.renderer.render(GLR.postScene,GLR.postCam);
    return cv.toDataURL('image/jpeg',0.84);
};
