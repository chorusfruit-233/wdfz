/* 《网安仙人》公开真结局：隔离校园舞台，不写玩家位置。 */
'use strict';
CUT_DEF.cyber={dur:16,setup:function(d){
  Engine.beginOutsideStage();
  d.base=cutW2S(560,1008);var x=d.base.x,z=d.base.z;
  d.servers=cutAdd(new THREE.Group());d.lights=[];
  var K=new Kit(),ctx={K:K,R:INTERIORS.lab3,ao:function(){},solid:function(){}};
  for(var i=0;i<4;i++){
    FURN.f(ctx,i,0,x-2+i*1.15,z);
    var lamp=new THREE.Mesh(new THREE.BoxGeometry(.09,.09,.025),cutBasic(0x92ecad));lamp.position.set(x-2+i*1.15,1.6,z+.5);d.servers.add(lamp);d.lights.push(lamp);
  }
  d.servers.add(K.build());
  d.hall=cutAdd(new THREE.Group());var H=new Kit();
  H.box('fterrazzo',x,-.05,z-3,5,.1,12,0x9caaa0,1);
  H.box('plaster',x-2.5,1.6,z-3,.15,3.2,12,0xb1b3a6,1);H.box('plaster',x+2.5,1.6,z-3,.15,3.2,12,0xb1b3a6,1);
  H.box('emit',x,3,z-3,1.8,.06,8,0xe0ead9,1);d.hall.add(H.build());
  var figure=cutFigure(0x040605,1.12);figure.add(figMesh('teacher',cutBasic(0x141814),1.12));figure.position.set(x,0,z-3);d.hall.add(figure);d.hall.visible=false;
  var canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;var c=canvas.getContext('2d');
  c.fillStyle='#101b18';c.fillRect(0,0,1024,512);c.fillStyle='#c9e7d4';c.font='30px sans-serif';
  ['AnthroPrank AI（安抄派智能）','校园试点：控制系统已终止','部署报告：2026 年首次异常  /  纸质档案：1987 年','断开控制链之后，仍有未签发的回执','“注销”：转交上层保管'].forEach(function(line,j){c.fillText(line,40,74+j*82);});
  d.screen=new THREE.Mesh(new THREE.PlaneGeometry(5.4,2.7),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas)}));
  d.screen.position.set(x,1.9,z-1);d.screen=cutAdd(d.screen);d.screen.visible=false;
  try{SFX.stopAmbient();SFX.click();}catch(e){}
},frame:function(k,d){
  var t=k*16,x=d.base.x,z=d.base.z;
  d.servers.visible=t<3;d.hall.visible=t>=3&&t<7;d.screen.visible=t>=7&&t<11;
  if(t<3){d.lights.forEach(function(l,i){l.material.color.setHex(t>(i+1)*.5?0x111d17:0x92ecad);});cutLook(x,1.65,z+4-t*.2,x,1.2,z);}
  else if(t<7){cutLook(x,1.65,z+4-(t-3)*.18,x,1.55,z-3);GLR.worldNorm=(t-3)/4;}
  else if(t<11){cutLook(x,1.9,z+4.4,x,1.9,z-1);}
  else{d.hall.visible=false;GLR.worldNorm=1;cutLook(x,2+(t-11)*.14,z+5+(t-11),x,3,z-28);if(!d.soft){d.soft=true;try{SFX.wake();}catch(e){}}}
  cutFade(t>15?(t-15):0);
}};
