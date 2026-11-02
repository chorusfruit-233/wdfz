/* 《网安仙人》公开真结局：隔离校园舞台，不写玩家位置。 */
'use strict';
CUT_DEF.cyber={dur:16,setup:function(d){
  Engine.beginOutsideStage();
  d.base=cutW2S(560,1008);var x=d.base.x,z=d.base.z;
  d.servers=cutAdd(new THREE.Group());d.lights=[];
  var K=new Kit();
  for(var i=0;i<4;i++){
    /* 复用机柜实体，换掉常亮的资源包指示灯，由演出独立控制。 */
    K.asset('server_rack',x-1.8+i*1.2,0,z,0,{merge:true,mat:{emit:''}});
    for(var j=0;j<5;j++){
      var lamp=new THREE.Mesh(new THREE.BoxGeometry(.045,.045,.025),cutBasic(0x92ecad));
      lamp.position.set(x-1.95+i*1.2,1.75-j*.28,z+.415);d.servers.add(lamp);d.lights.push({mesh:lamp,rack:i});
    }
  }
  d.servers.add(K.build());
  d.room=cutAdd(new THREE.Group());var B=new Kit();
  B.box('fterrazzo',x,-.05,z+1.5,8,.1,10,0x8d9694,1);
  B.box('plaster',x,1.8,z-2.8,8,3.6,.15,0x9aa8a1,1);
  B.box('plaster',x-4,1.8,z+1.5,.15,3.6,10,0x9aa8a1,1);B.box('plaster',x+4,1.8,z+1.5,.15,3.6,10,0x9aa8a1,1);
  B.box('plaster',x,3.6,z+1.5,8,.1,10,0x89928d,1);
  B.box('emit',x,3.5,z+1.5,1.5,.06,.25,0xbfd5c5,1);d.room.add(B.build());
  var roomLight=new THREE.PointLight(0xd5e7d9,1.1,14,1);roomLight.position.set(x,2.9,z+2);d.room.add(roomLight);
  d.hall=cutAdd(new THREE.Group());var H=new Kit();
  H.box('fterrazzo',x,-.05,z-2,5,.1,14,0x9caaa0,1);
  H.box('plaster',x-2.5,1.6,z-2,.15,3.2,14,0xb1b3a6,1);H.box('plaster',x+2.5,1.6,z-2,.15,3.2,14,0xb1b3a6,1);
  H.box('plaster',x,1.6,z-9,5,3.2,.15,0xa7b0a4,1);H.box('plaster',x,3.2,z-2,5,.1,14,0xa4afa4,1);
  for(var h=0;h<3;h++)H.box('emit',x,3.1,z+2-h*4,1.4,.06,.22,0xe0ead9,1);
  d.hall.add(H.build());var hallLight=new THREE.PointLight(0xe0ead9,1.2,18,1);hallLight.position.set(x,2.7,z);d.hall.add(hallLight);
  var figure=new THREE.Group();figure.add(figMesh('teacher',cutBasic(0x141814),1.12));
  var gear=new THREE.Mesh(patGearGeo(),new THREE.MeshBasicMaterial({vertexColors:true,color:0x777777,fog:true}));gear.scale.setScalar(1.12);figure.add(gear);
  figure.position.set(x,0,z-3);d.hall.add(figure);d.hall.visible=false;
  var portrait=GLR.cam.aspect<.8,canvas=document.createElement('canvas');canvas.width=portrait?1024:2048;canvas.height=portrait?1280:1152;
  var c=canvas.getContext('2d');c.fillStyle='#101b18';c.fillRect(0,0,canvas.width,canvas.height);c.fillStyle='#c9e7d4';
  var lines=portrait?['AnthroPrank AI','安抄派智能 · 校园试点','','控制系统已终止','','部署报告：2026 年首次异常','旧纸质档案：1987 年','','控制链已断开','仍有未签发的回执','','“注销”：转交上层保管']:
    ['AnthroPrank AI / 安抄派智能','校园试点：控制系统已终止','','部署报告：2026 年首次异常','旧纸质档案：1987 年','控制链断开后仍有未签发的回执','“注销”：转交上层保管'];
  c.font=(portrait?'52':'86')+'px sans-serif';lines.forEach(function(line,j){c.fillText(line,portrait?64:90,(portrait?110:140)+j*(portrait?94:140));});
  var texture=new THREE.CanvasTexture(canvas);texture.generateMipmaps=false;texture.minFilter=THREE.LinearFilter;
  d.screen=new THREE.Mesh(new THREE.PlaneGeometry(portrait?1.8:5.6,portrait?2.25:3.15),new THREE.MeshBasicMaterial({map:texture,toneMapped:false,fog:false}));
  d.screenY=portrait?1.65:1.9;d.screenDistance=portrait?2.8:4.9;
  d.screen.position.set(x,d.screenY,z);d.screen=cutAdd(d.screen);d.screen.visible=false;
  try{SFX.stopAmbient();d.broadcast=SoundPlayer.play('anomaly.broad',{k:.55});Lifecycle.scope('cutscene').own(function(){SoundPlayer.fade(d.broadcast);});}catch(e){}
},frame:function(k,d){
  var t=k*16,x=d.base.x,z=d.base.z;
  if(t>=1.8&&!d.broadcastCut){d.broadcastCut=true;SoundPlayer.fade(d.broadcast);}
  if(VisualState.stage)VisualState.stage.mesh.visible=t>=11;
  d.servers.visible=t<3;d.room.visible=t<3||t>=7&&t<11;d.hall.visible=t>=3&&t<7;d.screen.visible=t>=7&&t<11;
  if(t<3){d.lights.forEach(function(l){l.mesh.material.color.setHex(t>(l.rack+1)*.5?0x111d17:0x92ecad);});cutLook(x,1.65,z+4-t*.2,x,1.2,z);}
  else if(t<7){cutLook(x,1.65,z+4-(t-3)*.18,x,1.55,z-3);GLR.worldNorm=(t-3)/4;}
  else if(t<11){cutLook(x,d.screenY,z+d.screenDistance,x,d.screenY,z);}
  else{GLR.worldNorm=1;cutLook(x,2+(t-11)*.14,z+5+(t-11),x,3,z-28);if(!d.soft){d.soft=true;try{SFX.wake();}catch(e){}}}
  cutFade(t>15?(t-15):0);
}};
