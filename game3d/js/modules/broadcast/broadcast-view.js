/* @module-capsule */
(function($imports){
/* Station props and the departing students. Presentation only; collision comes from the room recipe. */
'use strict';
var BroadcastView=(function(){
  var group=null,room=null,crowdGroup=null,people=[];
  function material(c){return new $imports.THREE.MeshBasicMaterial({color:c,fog:true});}
  function box(parent,w,h,d,c,x,y,z){var m=new $imports.THREE.Mesh(new $imports.THREE.BoxGeometry(w,h,d),material(c));m.position.set(x||0,y||0,z||0);parent.add(m);return m;}
  function label(text,width,height,color){
    var cv=document.createElement('canvas');cv.width=768;cv.height=256;var ctx=cv.getContext('2d');
    ctx.fillStyle='#171f1e';ctx.fillRect(0,0,cv.width,cv.height);ctx.fillStyle=color||'#e4dfc7';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 47px sans-serif';
    text.split('\n').forEach(function(line,i,lines){ctx.fillText(line,384,128+(i-(lines.length-1)/2)*62,730);});
    var t=new $imports.THREE.CanvasTexture(cv);t.colorSpace=$imports.THREE.SRGBColorSpace;
    var mat=new $imports.THREE.MeshBasicMaterial({map:t,fog:false});mat.userData.disposeMap=true;
    return new $imports.THREE.Mesh(new $imports.THREE.PlaneGeometry(width||1,height||.3),mat);
  }
  function clear(){if(group){$imports.GLR.scene.remove(group);$imports.ThreeBackend.disposeGroup(group);}group=null;room=null;
    if(crowdGroup){$imports.GLR.scene.remove(crowdGroup);$imports.ThreeBackend.disposeGroup(crowdGroup);}crowdGroup=null;people=[];}
  function point(id,at){var R=$imports.INTERIORS[id];return (0,$imports.worldToScene)(R.ox+(at[0]+.5)*R.tw,R.oy+(at[1]+.5)*R.th,R);}
  function build(){
    clear();if($imports.S.mode!=='in')return;room=$imports.S.room;group=new $imports.THREE.Group();group.name='broadcast-props';group.userData.fuseStatus=$imports.Broadcast.state().fuse;group.userData.worldPart=true;$imports.GLR.scene.add(group);
    var C=$imports.BROADCAST_CFG;
    if(room===C.room){
      C.doors.forEach(function(at){var p=point(room,at),sign=label('广播站\n钥匙：夜间保安岗',1.1,.45);sign.position.set(p.x,2.35,p.z+.54);group.add(sign);});
      var p=point(room,C.station);
      box(group,.30,.20,.24,0x253731,p.x+.3,1.08,p.z-.1);box(group,.29,.035,.012,0xb75538,p.x+.3,1.12,p.z+.027);
      box(group,.1,.025,.1,0x161b1c,p.x-.2,.98,p.z);
      var neck=new $imports.THREE.Mesh(new $imports.THREE.CylinderGeometry(.013,.013,.32,8),material(0x77847f));neck.position.set(p.x-.2,1.15,p.z);group.add(neck);
      var mic=box(group,.07,.16,.07,0x1b2928,p.x-.2,1.36,p.z);
      for(var i=0;i<4;i++)box(group,.073,.008,.008,0x8d9b95,p.x-.2,1.31+i*.025,p.z+.038);
      var book=label('播音记录本\n第二天 · 第八节后',.43,.22);book.rotation.x=-Math.PI/2;book.position.set(p.x+.02,.98,p.z+.2);group.add(book);
      var warning=label($imports.Broadcast.state().fuse?'功放已修复\n话筒：整理通知稿':'功放保险丝已烧\n备用件：体育器材室',1.6,.45);warning.position.set(p.x,1.85,p.z-.6);group.add(warning);
    }
    var src=C.sources.find(function(s){return s.room===room;});
    if(src){var q=point(room,src.at),tag=label(src.title,.85,.26);tag.position.set(q.x,1.8,q.z+.45);group.add(tag);}
    if(room===C.archiveKey.room){var k=point(room,C.archiveKey.at),tag2=label('钥匙：教导处通知档案',1.1,.24);tag2.position.set(k.x,1.25,k.z+.35);group.add(tag2);}
    if(room===C.fuse.room){var f=point(room,C.fuse.at),tag3=label('广播功放 · 备用保险丝',1.1,.26);tag3.position.set(f.x,1.65,f.z+.4);group.add(tag3);}
  }
  function scene(){if($imports.S.mode==='in'&&room!==$imports.S.room)build();else if($imports.S.mode==='out'&&room)clear();}
  function frame(){
    scene();if(group&&room===$imports.BROADCAST_CFG.room&&group.userData.fuseStatus!==$imports.Broadcast.state().fuse)build();var p=$imports.Broadcast.crowd(),show=p&&$imports.S.mode==='out'&&$imports.S.screen==='play';
    if(!show){if(crowdGroup)crowdGroup.visible=false;return;}
    if(!crowdGroup){crowdGroup=new $imports.THREE.Group();crowdGroup.name='departing-students';crowdGroup.userData.worldPart=true;$imports.GLR.scene.add(crowdGroup);
      var mat=material(0x303c3d);for(var i=0;i<16;i++){var g=new $imports.THREE.Group(),m=(0,$imports.figMesh)('person',mat,1);g.add(m);box(g,.23,.3,.1,0x1a232b,0,1.1,-.15);crowdGroup.add(g);people.push(g);}}
    crowdGroup.visible=true;
    people.forEach(function(g,i){var a=p.angle,behind=Math.floor(i/2)*5.5,side=(i%2?1:-1)*3.1;
      var x=p.x-Math.cos(a)*behind-Math.sin(a)*side,y=p.y-Math.sin(a)*behind+Math.cos(a)*side;
      if($imports.Collision.depth(x,y,2.7)>1e-7){x=p.x-Math.cos(a)*behind;y=p.y-Math.sin(a)*behind;}
      var q=(0,$imports.worldToScene)(x,y,null);g.position.set(q.x,0,q.z);g.rotation.y=Math.PI/2-a;
      g.position.y=.015*Math.sin((60-p.left)*6+i);});
  }
  function classmates(f,dt){
    var ud=f.userData||{};if(ud.teacher)return;
    if($imports.Broadcast.state().phase!=='bell'){
      if(ud.broadcast){ud.broadcast=false;f.visible=true;ud.radioPath=null;ud.radioIndex=0;f.position.set(ud.hx,0,ud.hz);f.rotation.y=ud.ty;ud.mesh.geometry=(0,$imports.figGeo)('sit');ud.stood=0;ud.standing=0;}
      return;
    }
    if(!ud.mesh)return;
    if(!ud.broadcast){ud.broadcast=true;ud.mesh.geometry=(0,$imports.figGeo)('person');}
    var R=$imports.INTERIORS[$imports.S.room],target=$imports.PatrolNav.graph().nodes[$imports.S.room+':stairs'];if(!target)return true;
    if(!ud.radioPath){var start=$imports.PatrolNav.snap(R.id,$imports.PatrolNav.point(R.id,R.cx+ud.hx/$imports.U2M,R.cy+ud.hz/$imports.U2M));ud.radioPath=start&&$imports.PatrolNav.path(start,target);ud.radioIndex=0;}
    var path=ud.radioPath;
    if(path&&path.length){var step=Math.min(path.length-1,ud.radioIndex||0),q=(0,$imports.worldToScene)(path[step].x,path[step].y,R),dx=q.x-f.position.x,dz=q.z-f.position.z,d=Math.hypot(dx,dz);
      if(d<.1){ud.radioIndex=step+1;if(ud.radioIndex>=path.length)f.visible=false;}
      else{var k=Math.min(1,dt*1.4/d);f.position.x+=dx*k;f.position.z+=dz*k;f.rotation.y=Math.atan2(-dx,-dz);}}
    return true;
  }
  GameModules.on('sceneBuilt',build,{owner:'broadcast'});GameModules.on('clearWorld',clear,{owner:'broadcast'});
  GameModules.on('frame',frame,{owner:'broadcast'});GameModules.on('classmateScene',classmates,{owner:'broadcast'});
  GameModules.on('boundary',clear,{owner:'broadcast'});
  return {label:label,box:box,clear:clear,frame:frame,group:function(){return group;},crowd:function(){return crowdGroup;}};
})();

/* @module-exports */
GameModules.publish("game3d/js/modules/broadcast/broadcast-view.js",{
"BroadcastView":{get:function(){return BroadcastView;},set:function($value){BroadcastView=$value;}}
});
})(GameModules.imports("game3d/js/modules/broadcast/broadcast-view.js"));
