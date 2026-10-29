/* 远端玩家的 Three.js 表现；位置与房间状态由联机层提供。 */
'use strict';
ThreeBackend.remoteActors=Object.create(null);

function remoteLabel(name){
  var canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;
  var c=canvas.getContext('2d');
  c.fillStyle='rgba(3,12,8,.72)';c.fillRect(0,4,256,52);
  c.fillStyle='#e1f3e8';c.font='bold 26px sans-serif';c.textAlign='center';
  c.fillText(name,128,40,240);
  var texture=new THREE.CanvasTexture(canvas);
  var mat=new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:true,depthWrite:false,fog:true});
  var sprite=new THREE.Sprite(mat);sprite.position.y=2.05;sprite.scale.set(1.5,.375,1);
  return {sprite:sprite,texture:texture};
}
ThreeBackend.remotePose=function(id,pose,name){
  var a=this.remoteActors[id];
  if(!a){
    var material=new THREE.MeshBasicMaterial({color:0x96c7ac,fog:true});
    var mesh=figMesh('person',material,1),label=remoteLabel(name);
    mesh.add(label.sprite);mesh.visible=false;GLR.scene.add(mesh);
    a={mesh:mesh,label:label,pose:null,zone:null,seated:false};this.remoteActors[id]=a;
  }
  a.pose=pose;
};
ThreeBackend.remoteRemove=function(id){
  var a=this.remoteActors[id];if(!a)return;
  if(GLR.scene)GLR.scene.remove(a.mesh);
  a.mesh.material.dispose();a.label.sprite.material.dispose();a.label.texture.dispose();
  delete this.remoteActors[id];
};
ThreeBackend.remoteClear=function(){
  var self=this;Object.keys(this.remoteActors).forEach(function(id){self.remoteRemove(id);});
};
ThreeBackend.remoteTick=function(dt,zone,waiting){
  var actors=this.remoteActors;
  Object.keys(actors).forEach(function(id){
    var a=actors[id],p=a.pose;
    if(!p||!p.visible||p.zone!==zone||waiting){a.mesh.visible=false;return;}
    var R=zone==='out'?null:INTERIORS[zone];if(zone!=='out'&&!R){a.mesh.visible=false;return;}
    var pos=worldToScene(p.x,p.y,R),m=a.mesh;
    if(a.zone!==p.zone||Math.hypot(m.position.x-pos.x,m.position.z-pos.z)>8){
      m.position.set(pos.x,p.floor,pos.z);a.zone=p.zone;
    }else{
      var blend=1-Math.exp(-Math.max(0,dt)*12);
      m.position.x+=(pos.x-m.position.x)*blend;m.position.y+=(p.floor-m.position.y)*blend;
      m.position.z+=(pos.z-m.position.z)*blend;
    }
    if(a.seated!==p.seated){
      a.seated=p.seated;m.geometry=figGeo(p.seated?'sit':'person');
      a.label.sprite.position.y=p.seated?1.55:2.05;
    }
    m.rotation.y=Math.PI/2-p.angle;m.visible=true;
  });
};
