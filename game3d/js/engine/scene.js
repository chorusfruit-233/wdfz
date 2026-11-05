/* @module-capsule */
(function($imports){
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
$imports.ThreeBackend.resetSan=function(value){
  $imports.GLR.sanSense=(0,$imports.clamp)(Number.isFinite(value)?value/100:1,0,1);
  if($imports.GLR.postMat) $imports.GLR.postMat.uniforms.uSan.value=$imports.GLR.sanSense;
};
function sceneCacheKey(){ return $imports.QUALITY+'|'+($imports.NOTEX?1:0); }
function disposeGroup(g,keepData){return $imports.ThreeBackend.disposeGroup(g,keepData);}
function sceneCacheCheck(){
  var k=sceneCacheKey(); if(SCENE_CACHE.key===k) return;
  sceneCacheClear(); SCENE_CACHE.key=k;
}
function sceneCacheClear(){
  var id;
  if(SCENE_CACHE.out&&SCENE_CACHE.out!==$imports.GLR.outMesh) disposeGroup(SCENE_CACHE.out);
  for(id in SCENE_CACHE.rooms) if(SCENE_CACHE.rooms[id]!==$imports.GLR.roomMesh) disposeGroup(SCENE_CACHE.rooms[id]);
  if($imports.GLR.outMesh) $imports.GLR.outMesh.userData.uncached=1;            /* 正在用的这份离开时直接销毁 */
  if($imports.GLR.roomMesh) $imports.GLR.roomMesh.userData.uncached=1;
  SCENE_CACHE.out=null; SCENE_CACHE.rooms={}; SCENE_CACHE.order=[]; SCENE_CACHE.key='';
}
function sceneCacheRoom(id,g){
  var previous=SCENE_CACHE.rooms[id];
  if(previous&&previous!==g)disposeGroup(previous);
  SCENE_CACHE.rooms[id]=g;
  SCENE_CACHE.order=SCENE_CACHE.order.filter(function(x){ return x!==id; }); SCENE_CACHE.order.push(id);
  while(SCENE_CACHE.order.length>SCENE_CACHE_ROOMS){
    var old=SCENE_CACHE.order.shift(), og=SCENE_CACHE.rooms[old]; delete SCENE_CACHE.rooms[old];
    if(og&&og!==$imports.GLR.roomMesh) disposeGroup(og);
  }
}
function releaseSceneMesh(g){
  var cached=!g.userData.uncached&&(g===SCENE_CACHE.out||SCENE_CACHE.rooms[g.userData.roomId]===g);
  disposeGroup(g,cached);
}

$imports.ThreeBackend.disposeGroup=function(g,keepData){
  if(!g)return;
  var geometries=new Set(),materials=new Set();
  g.traverse(function(o){
    if(o.isInstancedMesh&&!keepData)o.dispose();          /* 实例矩阵、实例颜色的显存；几何体是各房间共用的 */
    if(o.geometry&&!(o.geometry.userData&&o.geometry.userData.shared))geometries.add(o.geometry);
    if(!keepData&&o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(function(m){if(!(m.userData&&m.userData.shared))materials.add(m);});
  });
  geometries.forEach(function(g){g.dispose();});
  materials.forEach(function(m){
    if(m.userData&&m.userData.disposeMap&&m.map)m.map.dispose();   /* 房间自己的文字贴图（铭牌、车牌）：material.dispose 不会顺带释放 */
    m.dispose();
  });
};
$imports.ThreeBackend.clearWorld=function(){
  $imports.ThreeBackend.endStage();
  var i;
  if(typeof $imports.APPAR!=='undefined'&&$imports.APPAR.g)$imports.APPAR.g.visible=false;
  if($imports.GLR.roamFig){$imports.GLR.scene.remove($imports.GLR.roamFig);$imports.ThreeBackend.disposeGroup($imports.GLR.roamFig);$imports.GLR.roamFig=null;}
  if(typeof $imports.TR!=='undefined'&&$imports.TR.g){$imports.GLR.scene.remove($imports.TR.g);$imports.ThreeBackend.disposeGroup($imports.TR.g);$imports.TR.g=null;$imports.TR.key='';}
  try{ (0,$imports.shadeClearRoom)(); }catch(e){}
  GameModules.emit('clearWorld');                      /* 模块自己的场景物件（粉笔记号）在这里撤 */
  if($imports.GLR.roomMesh){ $imports.GLR.scene.remove($imports.GLR.roomMesh); releaseSceneMesh($imports.GLR.roomMesh); $imports.GLR.roomMesh=null; }
  if($imports.GLR.outMesh){ $imports.GLR.scene.remove($imports.GLR.outMesh); releaseSceneMesh($imports.GLR.outMesh); $imports.GLR.outMesh=null; }
  if($imports.GLR.roomLights){
    for(i=0;i<$imports.GLR.roomLights.length;i++){$imports.GLR.roomLights[i].dispose();$imports.GLR.scene.remove($imports.GLR.roomLights[i]);}
    $imports.GLR.roomLights=[]; $imports.GLR.roomLightBase=[]; $imports.GLR.roomLightCol=[];
    try{ $imports.FLK_PREV=[]; }catch(e){}
  }
};
/* 仅替换静态模型，避免切档重置同学位置、堵门、追逐、异象、门和计时器。 */
$imports.ThreeBackend.applyQuality=function(){
  var staged=!!$imports.VisualState.stage;$imports.ThreeBackend.endStage();
  $imports.ThreeBackend.resize();sceneCacheClear();sceneCacheCheck();(0,$imports.matRefreshQuality)();
  var old=$imports.GLR.roomMesh||$imports.GLR.outMesh;
  if(old){
    $imports.GLR.scene.remove(old);$imports.ThreeBackend.disposeGroup(old);
    if($imports.GLR.roomMesh){
      var R=$imports.INTERIORS[$imports.S.room];
      $imports.GLR.roomMesh=(0,$imports.buildRoomGeometry)(R);$imports.GLR.scene.add($imports.GLR.roomMesh);
      (0,$imports.shadeBuildRoom)(R);(0,$imports.shadeBuildPools)();
    }else{
      $imports.GLR.outMesh=(0,$imports.buildOutdoorGeometry)();$imports.GLR.outMesh.userData.__outworld=1;$imports.GLR.scene.add($imports.GLR.outMesh);
    }
  }
  $imports.GLR.scene.traverse(function(o){
    var d=o.geometry&&o.geometry.userData;
    if(d&&d.figKind)o.geometry=(0,$imports.figGeo)(d.figKind);
    if(d&&d.fxKind)o.geometry=(0,$imports.fxGeo)(d.fxKind);
    if(d&&d.patGear)o.geometry=(0,$imports.patGearGeo)();
    if(d&&d.cupPart){
      var cm=(0,$imports.cupMats)();
      o.geometry=(0,$imports.cupPartGeo)(d.cupPart);
      o.material=d.cupPart==='wall'?cm.paint:d.cupPart==='lid'?cm.lid:cm.plain;
    }
  });
  if($imports.GLR.roomMesh){$imports.GLR.roomMesh.userData.roomId=$imports.S.room;$imports.GLR.roomMesh.userData.roomData=$imports.INTERIORS[$imports.S.room];sceneCacheRoom($imports.S.room,$imports.GLR.roomMesh);}
  if($imports.GLR.outMesh){SCENE_CACHE.out=$imports.GLR.outMesh;$imports.GLR.outMesh.userData.layout={lamps:$imports.OUT_LAMPS};}
  (0,$imports.shadeApplyQuality)();
  if(staged)$imports.ThreeBackend.beginOutsideStage();
};
$imports.ThreeBackend.addRoomLights=function(R){
  var W=R.cols*$imports.TTILE*$imports.U2M, H=R.rows*$imports.TTILE*$imports.U2M, i;
  function addLight(x,y,z,col,inten,dist,decay){
    var pl=new $imports.THREE.PointLight(col,inten,dist,decay);
    pl.position.set(x,y,z);
    $imports.GLR.scene.add(pl);
    $imports.GLR.roomLights.push(pl);
    $imports.GLR.roomLightBase.push(inten);
    ($imports.GLR.roomLightCol||($imports.GLR.roomLightCol=[])).push(new $imports.THREE.Color(col));
  }
  if(R.stairwell){
    var s=$imports.StairWorld.config(R.id),floor=Math.min(s.rooms.length-2,Math.floor(($imports.S.floorY||0)/s.rise));
    [[1.8,2.35,-1.18],[1.8,s.rise/2+2.35,7.05],[1.8,s.rise+2.35,-1.18]].forEach(function(p){addLight(p[0],floor*s.rise+p[1],p[2],0xc4d5bc,$imports.LCFG.ptI*1.1,10,2);});
    return;
  }
  var teach=!R.stairwell&&R.host==='teach'&&R.floor>=1&&R.floor<=5;
  var spec=$imports.ROOM_LIGHTS[R.id]||$imports.ROOM_LIGHTS[teach?'teach':R.host]||$imports.ROOM_LIGHTS.default;
  spec.forEach(function(v){
    var x=v[0],z=v[2];
    if(v[6]==='room'){x*=W;z*=H;}
    if(v[6]==='tile'){x=x*$imports.TTILE*$imports.U2M-W/2;z=z*$imports.TTILE*$imports.U2M-H/2;}
    addLight(x,v[1],z,v[3],$imports.LCFG.ptI*v[4],v[5],2);
  });
  if(teach)addLight(0,2.75,18.5*$imports.TTILE*$imports.U2M-H/2,0xf2dcc0,$imports.LCFG.ptI*1.2,18,2);
  if(teach||(R.host==='lab'&&R.floor>=1&&R.floor<=5)){
    var liftCol=teach?20.5:10.5;
    addLight(liftCol*$imports.TTILE*$imports.U2M-W/2,2.65,(R.rows-1.5)*$imports.TTILE*$imports.U2M-H/2,0xe2eeec,$imports.LCFG.ptI*0.65,10,2);
  }
  if(R.host==='bell'&&R.spiral){
    addLight($imports.SPIRAL.cx,$imports.SPIRAL.topH/2,$imports.SPIRAL.cz+2,0xd8b080,$imports.LCFG.ptI*0.5,9,2);
    addLight($imports.SPIRAL.cx,$imports.SPIRAL.topH+2.6,$imports.SPIRAL.cz,0xc8d0d8,$imports.LCFG.ptI*0.8,10,2);
  }
};
$imports.ThreeBackend.enterRoom=function(roomId){
  (0,$imports.clearWorldMesh)();sceneCacheCheck();
  var R=$imports.INTERIORS[roomId],cached=SCENE_CACHE.rooms[roomId];
  if(cached&&cached.userData.roomData===R){$imports.GLR.roomMesh=cached;(0,$imports.roomDoorRefresh)(R);}
  else{$imports.GLR.roomMesh=(0,$imports.buildRoomGeometry)(R);$imports.GLR.roomMesh.userData.roomId=roomId;$imports.GLR.roomMesh.userData.roomData=R;}
  sceneCacheRoom(roomId,$imports.GLR.roomMesh);
  $imports.GLR.scene.add($imports.GLR.roomMesh);
  if(roomId==='garage1'){
    $imports.GLR.roamFig=(0,$imports.buildRoamFigure)();
    if($imports.GLR.roamFig){ $imports.GLR.roamFig.visible=false; $imports.GLR.scene.add($imports.GLR.roamFig); }
  }
  var dens=roomId==='garage1'?0.082:0.050;
  $imports.GLR.scene.fog=new $imports.THREE.FogExp2($imports.FOG_COL,dens);
  (0,$imports.addRoomLights)(R);
  try{ (0,$imports.shadeMarkMesh)($imports.GLR.roomMesh); (0,$imports.shadeBuildRoom)(R); (0,$imports.shadeBuildPools)(); }catch(e){}
  try{ (0,$imports.tracesBuild)(); }catch(e){}
  try{ (0,$imports.ncBuild)(R); }catch(e){}
  try{ (0,$imports.skipClear)(); }catch(e){}
  GameModules.emit('sceneBuilt',roomId);              /* 模块在新场景里摆自己的东西 */
};
$imports.ThreeBackend.enterOutside=function(){
  (0,$imports.clearWorldMesh)();sceneCacheCheck();
  try{ (0,$imports.ncClear)(); }catch(e){}      /* 出去就没有同班同学了 */
  if(SCENE_CACHE.out){$imports.GLR.outMesh=SCENE_CACHE.out;$imports.OUT_LAMPS=$imports.GLR.outMesh.userData.layout.lamps;}
  else{
    $imports.GLR.outMesh=(0,$imports.buildOutdoorGeometry)();$imports.GLR.outMesh.userData.__outworld=1;
    $imports.GLR.outMesh.userData.layout={lamps:$imports.OUT_LAMPS};SCENE_CACHE.out=$imports.GLR.outMesh;
  }
  $imports.GLR.scene.add($imports.GLR.outMesh);
  try{ (0,$imports.shadeMarkMesh)($imports.GLR.outMesh); }catch(e){}
  $imports.GLR.scene.fog=new $imports.THREE.FogExp2($imports.FOG_COL,0.020);
  $imports.GLR.skyHour=-1; (0,$imports.refreshSky)();
  $imports.GLR.lampPick=0;
  try{ (0,$imports.tracesBuild)(); }catch(e){}
  GameModules.emit('sceneBuilt',null);
};

/* 结局舞台只替换可见对象与灯光上下文，不传送正式玩家，也不重置碰撞或同学状态。 */
$imports.ThreeBackend.beginOutsideStage=function(){
  if($imports.VisualState.stage)return $imports.VisualState.stage;
  var mesh=SCENE_CACHE.out,owned=false,lamps,oldLamps=$imports.OUT_LAMPS,oldOut=$imports.OUTX;
  if(mesh){lamps=mesh.userData.layout.lamps;}
  else{
    try{mesh=(0,$imports.buildOutdoorGeometry)();lamps=$imports.OUT_LAMPS;owned=true;}
    finally{$imports.OUT_LAMPS=oldLamps;$imports.OUTX=oldOut;}
  }
  var stage={mode:'out',room:null,mesh:mesh,owned:owned,lamps:lamps,hidden:[],parent:mesh.parent,visible:mesh.visible,fog:$imports.GLR.scene.fog};
  $imports.GLR.scene.children.slice().forEach(function(o){
    if(o!==mesh&&o!==$imports.CUT.grp&&(o.isGroup||o===$imports.GLR.marker||($imports.GLR.roomLights||[]).indexOf(o)>=0)){
      stage.hidden.push({object:o,visible:o.visible});o.visible=false;
    }
  });
  mesh.visible=true;$imports.GLR.scene.add(mesh);$imports.VisualState.stage=stage;
  $imports.GLR.scene.fog=new $imports.THREE.FogExp2($imports.FOG_COL,0.020);$imports.GLR.lampPick=0;
  return stage;
};
$imports.ThreeBackend.endStage=function(){
  var stage=$imports.VisualState.stage;if(!stage)return;
  $imports.VisualState.stage=null;
  if(stage.parent)stage.parent.add(stage.mesh);else $imports.GLR.scene.remove(stage.mesh);
  stage.mesh.visible=stage.visible;
  stage.hidden.forEach(function(saved){saved.object.visible=saved.visible;});
  $imports.GLR.scene.fog=stage.fog;$imports.GLR.lampPick=0;
  if(stage.owned)$imports.ThreeBackend.disposeGroup(stage.mesh);
};

$imports.ThreeBackend.syncCamera=function(dt,view){
  var p, camera=$imports.VisualState.camera;
  if($imports.S.mode==='in'){
    var R=$imports.INTERIORS[$imports.S.room];
    p=(0,$imports.worldToScene)($imports.S.x,$imports.S.y,R);
  }else{
    p=(0,$imports.worldToScene)($imports.S.x,$imports.S.y,null);
  }
  var bob=0;
  if($imports.S.moving&&!$imports.S.seated){
    camera.walkPhase+=dt*($imports.S.run?13.5:8.5);
    bob=Math.sin(camera.walkPhase)*($imports.S.run?0.052:0.030);
  }
  var dyOff=0, dzOff=0, shake=0;
  if($imports.S.dead){
    var k=$imports.S.deadT||0;
    shake=Math.max(0,1-k*0.5);
  }
  if($imports.GLR.gazeShake&&!$imports.S.dead) shake=Math.max(shake,$imports.GLR.gazeShake);   /* 被盯着的时候，镜头在抖 */
  if(typeof $imports.SHAKE_ON!=='undefined' && !$imports.SHAKE_ON) shake=0;
  if(shake>0){
    dyOff+=($imports.PresentationRandom.next()-0.5)*0.06*shake;
  }
  if(typeof $imports.SHAKE_ON!=='undefined' && !$imports.SHAKE_ON){ bob=0; }
  var eyeTarget=$imports.S.seated?1.12:$imports.EYE;
  camera.eyeH=(camera.eyeH===undefined)?$imports.EYE:camera.eyeH;
  camera.eyeH+= (eyeTarget-camera.eyeH)*Math.min(1,dt*9);
  var cameraLift=view?view.eyeLift:$imports.S.eyeLift;
  $imports.GLR.cam.position.set(p.x, camera.eyeH+bob+dyOff+(cameraLift||0)+($imports.S.floorY||0), p.z+dzOff);   /* floorY：钟楼楼梯上的高度 */
  var targetFov=72+($imports.S.run&&$imports.S.moving?9:0);
  camera.fov=(0,$imports.lerp)(camera.fov,targetFov,Math.min(1,dt*8));
  /* 超宽屏的近平面角不能越过角色碰撞圆。普通屏保持原来的 0.08 米。 */
  var tan=Math.tan(camera.fov*$imports.PI/360),near=Math.min(0.08,$imports.PRAD*$imports.U2M/(1.3*Math.sqrt(1+tan*tan*(1+$imports.GLR.cam.aspect*$imports.GLR.cam.aspect))));
  if(Math.abs($imports.GLR.cam.fov-camera.fov)>0.01||Math.abs($imports.GLR.cam.near-near)>0.0001){
    $imports.GLR.cam.fov=camera.fov;$imports.GLR.cam.near=near;$imports.GLR.cam.updateProjectionMatrix();
    $imports.GLR.postMat.uniforms.uNear.value=near;
  }
  var angle=view?view.ang:$imports.S.ang, spitch=(view?view.pitch:$imports.S.pitch)+($imports.S.seated?-0.06:0);
  var dir=new $imports.THREE.Vector3(Math.cos(angle)*Math.cos(spitch),Math.sin(spitch),Math.sin(angle)*Math.cos(spitch));
  /* 目标点也要跟着死亡演出的升降走，否则镜头一沉就变成仰视 */
  $imports.GLR.cam.lookAt(p.x+dir.x, camera.eyeH+bob+dir.y+(cameraLift||0)+($imports.S.floorY||0), p.z+dir.z);
};

$imports.ThreeBackend.draw=function(dt){
  if(!$imports.GLR.renderer) return;
  $imports.GLR.renderer.info.reset();
  if($imports.S.dead){ $imports.GLR.hurt=Math.min(0.85,$imports.GLR.hurt+dt*0.12); }
  else { $imports.GLR.hurt=Math.max(0,$imports.GLR.hurt-dt*0.6); }
  $imports.GLR.flash=Math.max(0, ($imports.GLR.flash||0)-dt*1.7);
  (0,$imports.updateLighting)();
  if(typeof $imports.CUT!=='undefined'&&$imports.CUT.on) (0,$imports.cutTick)(dt);        /* 结局演出：镜头由 cutscene.js 摆 */
  if($imports.GLR.dust){
    $imports.GLR.dustT=($imports.GLR.dustT||0)+dt;
    $imports.GLR.dust.position.set($imports.GLR.cam.position.x,0,$imports.GLR.cam.position.z);
    $imports.GLR.dust.rotation.y=$imports.GLR.dustT*0.015;
    $imports.GLR.dust.position.y=Math.sin($imports.GLR.dustT*0.25)*0.08;
  }
  if($imports.GLR.roamFig){
    if(!$imports.VisualState.stage&&$imports.S.mode==='in'&&$imports.S.room==='garage1'&&typeof $imports.ROAM!=='undefined'&&$imports.ROAM.on&&$imports.ROAM.x>-1e5){
      var rp=(0,$imports.worldToScene)($imports.ROAM.x,$imports.ROAM.y,$imports.INTERIORS['garage1']);
      $imports.GLR.roamFig.visible=true;
      $imports.GLR.roamFig.position.set(rp.x,0,rp.z);
      $imports.GLR.roamFig.lookAt($imports.GLR.cam.position.x,0,$imports.GLR.cam.position.z);
    } else { $imports.GLR.roamFig.visible=false; }
  }
  var debugFrozen=typeof $imports.DEV!=='undefined'&&$imports.DEV.on&&$imports.DEV.freeze;
  /* 调试暂停冻结异象和环境幻觉；主动触发的死亡演出仍可预览。 */
  try{ if(!debugFrozen||(typeof $imports.ANFX!=='undefined'&&$imports.ANFX.kind==='death'))(0,$imports.anfxUpdate)(dt); }catch(e){}
  try{ if(!debugFrozen)(0,$imports.smileTick)(dt); }catch(e){}
  try{ (0,$imports.patRender)(); }catch(e){}
  try{ (0,$imports.handsTick)(dt); }catch(e){}
  try{ if(!debugFrozen)(0,$imports.hallucTick)(dt); }catch(e){}
  try{ if(!debugFrozen)(0,$imports.apparTick)(dt); }catch(e){}
  $imports.GLR.cam.updateMatrixWorld();
  (0,$imports.entFace)();
  var u=$imports.GLR.postMat.uniforms;
  u.uTime.value=$imports.GLR.time;
  var preview=$imports.VisualState.deathAnim;
  if(preview){
    preview.t=Math.min(preview.dur,preview.t+dt);
    u.uDm.value=preview.mode;u.uDt.value=preview.t/preview.dur;
    if(preview.t>=preview.dur){$imports.VisualState.deathAnim=null;u.uDm.value=0;u.uDt.value=0;}
  }else{u.uDm.value=0;u.uDt.value=0;}
  var _fnOn=($imports.S.fn&&$imports.S.fn.on&&$imports.S.fn.v<72)?1:0;
  $imports.GLR.fnNorm=$imports.GLR.fnNorm===undefined?0:$imports.GLR.fnNorm;
  $imports.GLR.fnNorm+= (_fnOn-$imports.GLR.fnNorm)*Math.min(1,dt*1.6);
  u.uFx.value=Math.max($imports.GLR.fnNorm,($imports.GLR.worldNorm||0),($imports.GLRTEST.nofx?1:0));
  $imports.GLR.gaze=($imports.GLR.gaze||0)+(($imports.GLR.gazeT||0)-($imports.GLR.gaze||0))*Math.min(1,dt*2.4);
  u.uGaze.value=$imports.GLR.gaze;
  u.uHurt.value=$imports.GLR.hurt;
  u.uFlash.value=$imports.SET.reduceFlash?Math.min(.08,$imports.GLR.flash):$imports.GLR.flash;
  u.uExpo.value=($imports.GLR.dayExpo===undefined)?1:$imports.GLR.dayExpo;
  u.uRed.value=$imports.GLR.patrolRed||0;
  var sense=typeof $imports.Sensory!=='undefined'?$imports.Sensory.view():{warp:0,tunnel:0,focus:0};
  u.uSan.value=(0,$imports.clamp)($imports.S.san/100,0,1);
  /* SAN 视觉分级（计划 12.9 第二轮）：扭曲、视野变小、模糊、对不上焦、失色、灯晕、呼吸（和呼吸声同相）、
     心跳收缩（和心跳声同拍）、重影、黑屏闪烁 */
  u.uWarp.value=sense.warp;u.uTunnel.value=sense.tunnel||0;u.uBlur.value=sense.blur||0;u.uFocus.value=sense.focus;
  u.uDrain.value=sense.drain||0;u.uHalo.value=sense.halo||0;u.uBreath.value=sense.inhale||0;
  u.uPulse.value=sense.pulse||0;u.uGhost.value=sense.ghost||0;u.uBlack.value=sense.black||0;
  if(sense.ghostDir)u.uGhostDir.value.set(sense.ghostDir[0],sense.ghostDir[1]);
  if($imports.GLRTEST.nopost){
    $imports.GLR.renderer.setRenderTarget(null);
    $imports.GLR.renderer.render($imports.GLR.scene,$imports.GLR.cam);
    $imports.ThreeBackend.drawHands();
    return;
  }
  $imports.ThreeBackend.updateSceneMipmaps();
  $imports.GLR.renderer.setRenderTarget($imports.GLR.rt);
  $imports.GLR.renderer.render($imports.GLR.scene,$imports.GLR.cam);
  $imports.ThreeBackend.drawHands();
  $imports.GLR.renderer.setRenderTarget(null);
  $imports.ThreeBackend.drawPost();
};
/* 手持物使用独立目标，保留世界深度供 AO 读取，再在后期合成。 */
$imports.ThreeBackend.drawHands=function(){
  var root=$imports.GLR.handRoot,r=$imports.GLR.renderer;
  var on=!!(root&&root.visible);
  $imports.GLR.postMat.uniforms.uHands.value=on?1:0;
  if(!on)return;
  root.matrix.copy($imports.GLR.cam.matrixWorld);root.matrixWorldNeedsUpdate=true;
  if($imports.GLRTEST.nopost){
    var clear=r.autoClear;r.autoClear=false;r.clearDepth();
    r.render($imports.GLR.handScene,$imports.GLR.cam);r.autoClear=clear;return;
  }
  var color=r.getClearColor(new $imports.THREE.Color()),alpha=r.getClearAlpha();
  r.setRenderTarget($imports.GLR.handRT);r.setClearColor(0x000000,0);
  r.render($imports.GLR.handScene,$imports.GLR.cam);
  r.setClearColor(color,alpha);r.setRenderTarget($imports.GLR.rt);
};

$imports.ThreeBackend.captureMenu=function(){
    $imports.GLR.renderer.info.reset();
    var cv=$imports.GLR.renderer.domElement;
    var c=$imports.GLR.cam, yaw=-0.35;
    c.position.set(66.7,7.0,133.3);
    c.fov=74; c.updateProjectionMatrix();
    c.lookAt(66.7+Math.cos(yaw)*12, 6.4, 133.3+Math.sin(yaw)*12);
    var u=$imports.GLR.postMat.uniforms;
    u.uTime.value=0.6; u.uHurt.value=0; u.uFlash.value=0; u.uSan.value=0.62;u.uHands.value=0;
    $imports.ThreeBackend.updateSceneMipmaps();
    $imports.GLR.renderer.setRenderTarget($imports.GLR.rt);
    $imports.GLR.renderer.render($imports.GLR.scene,c);
    $imports.GLR.renderer.setRenderTarget(null);
    $imports.ThreeBackend.drawPost();
    return cv.toDataURL('image/jpeg',0.84);
};

/* @module-exports */
GameModules.publish("game3d/js/engine/scene.js",{
"SCENE_CACHE":{get:function(){return SCENE_CACHE;},set:function($value){SCENE_CACHE=$value;}},
"SCENE_CACHE_ROOMS":{get:function(){return SCENE_CACHE_ROOMS;},set:function($value){SCENE_CACHE_ROOMS=$value;}},
"sceneCacheKey":{get:function(){return sceneCacheKey;},set:function($value){sceneCacheKey=$value;}},
"disposeGroup":{get:function(){return disposeGroup;},set:function($value){disposeGroup=$value;}},
"sceneCacheCheck":{get:function(){return sceneCacheCheck;},set:function($value){sceneCacheCheck=$value;}},
"sceneCacheClear":{get:function(){return sceneCacheClear;},set:function($value){sceneCacheClear=$value;}},
"sceneCacheRoom":{get:function(){return sceneCacheRoom;},set:function($value){sceneCacheRoom=$value;}},
"releaseSceneMesh":{get:function(){return releaseSceneMesh;},set:function($value){releaseSceneMesh=$value;}}
});
})(GameModules.imports("game3d/js/engine/scene.js"));
