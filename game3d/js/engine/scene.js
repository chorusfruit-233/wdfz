/* Three.js 场景生命周期、灯光与相机。 */
'use strict';
ThreeBackend.disposeGroup=function(g){
  if(!g)return;
  var geometries=new Set(),materials=new Set();
  g.traverse(function(o){
    if(o.geometry&&!(o.geometry.userData&&o.geometry.userData.shared))geometries.add(o.geometry);
    if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(function(m){if(!(m.userData&&m.userData.shared))materials.add(m);});
  });
  geometries.forEach(function(g){g.dispose();});materials.forEach(function(m){m.dispose();});
};
ThreeBackend.clearWorld=function(){
  var i;
  if(GLR.roamFig){GLR.scene.remove(GLR.roamFig);ThreeBackend.disposeGroup(GLR.roamFig);GLR.roamFig=null;}
  if(typeof TR!=='undefined'&&TR.g){GLR.scene.remove(TR.g);ThreeBackend.disposeGroup(TR.g);TR.g=null;TR.key='';}
  try{ shadeClearRoom(); }catch(e){}
  if(GLR.roomMesh){ GLR.scene.remove(GLR.roomMesh); ThreeBackend.disposeGroup(GLR.roomMesh); GLR.roomMesh=null; }
  if(GLR.outMesh){ GLR.scene.remove(GLR.outMesh); ThreeBackend.disposeGroup(GLR.outMesh); GLR.outMesh=null; }
  if(GLR.roomLights){
    for(i=0;i<GLR.roomLights.length;i++){GLR.roomLights[i].dispose();GLR.scene.remove(GLR.roomLights[i]);}
    GLR.roomLights=[]; GLR.roomLightBase=[]; GLR.roomLightCol=[];
    try{ FLK_PREV=[]; }catch(e){}
  }
};
/* 仅替换静态模型，避免切档重置同学位置、堵门、追逐、异象、门和计时器。 */
ThreeBackend.applyQuality=function(){
  ThreeBackend.resize();matRefreshQuality();
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
  if(R.host==='bell'&&R.spiral){
    addLight(SPIRAL.cx,SPIRAL.topH/2,SPIRAL.cz+2,0xd8b080,LCFG.ptI*0.5,9,2);
    addLight(SPIRAL.cx,SPIRAL.topH+2.6,SPIRAL.cz,0xc8d0d8,LCFG.ptI*0.8,10,2);
  }
};
ThreeBackend.enterRoom=function(roomId){
  clearWorldMesh();
  var R=INTERIORS[roomId];
  GLR.roomMesh=buildRoomGeometry(R);
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
  clearWorldMesh();
  try{ ncClear(); }catch(e){}      /* 出去就没有同班同学了 */
  GLR.outMesh=buildOutdoorGeometry();
  GLR.outMesh.userData=GLR.outMesh.userData||{};
  GLR.outMesh.userData.__outworld=1;
  GLR.scene.add(GLR.outMesh);
  try{ shadeMarkMesh(GLR.outMesh); }catch(e){}
  GLR.scene.fog=new THREE.FogExp2(FOG_COL,0.020);
  GLR.skyHour=-1; refreshSky();
  GLR.lampPick=0;
  try{ tracesBuild(); }catch(e){}
};

ThreeBackend.syncCamera=function(dt){
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
    if(S.death==='floor'||S.death==='deep'){ dyOff=-Math.min(1.25,k*0.62); }
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
  GLR.cam.position.set(p.x, S.eyeH+bob+dyOff+(S.eyeLift||0)+(S.floorY||0), p.z+dzOff);   /* floorY：钟楼楼梯上的高度 */
  var targetFov=72+(S.run&&S.moving?9:0);
  S.fov=lerp(S.fov,targetFov,Math.min(1,dt*8));
  /* 超宽屏的近平面角不能越过角色碰撞圆。普通屏保持原来的 0.08 米。 */
  var tan=Math.tan(S.fov*PI/360),near=Math.min(0.08,PRAD*U2M/(1.3*Math.sqrt(1+tan*tan*(1+GLR.cam.aspect*GLR.cam.aspect))));
  if(Math.abs(GLR.cam.fov-S.fov)>0.01||Math.abs(GLR.cam.near-near)>0.0001){
    GLR.cam.fov=S.fov;GLR.cam.near=near;GLR.cam.updateProjectionMatrix();
    GLR.postMat.uniforms.uNear.value=near;
  }
  var spitch=S.pitch+(S.seated?-0.06:0);
  var dir=new THREE.Vector3(Math.cos(S.ang)*Math.cos(spitch),Math.sin(spitch),Math.sin(S.ang)*Math.cos(spitch));
  GLR.cam.lookAt(p.x+dir.x, S.eyeH+bob+dir.y+(S.floorY||0), p.z+dir.z);
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
  try{ anfxUpdate(dt); }catch(e){}
  try{ smileTick(dt); }catch(e){}
  try{ patRender(); }catch(e){}
  try{ handsTick(dt); }catch(e){}
  try{ hallucTick(dt); }catch(e){}
  GLR.cam.updateMatrixWorld();
  entFace();
  var u=GLR.postMat.uniforms;
  u.uTime.value=GLR.time;
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
  u.uSan.value=clamp(S.san/100,0,1);
  if(typeof GLRTEST!=='undefined'&&GLRTEST.nopost){
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
