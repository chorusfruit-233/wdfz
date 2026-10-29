/* 共享地面物品的 Three.js 表现。逻辑归属和拾取结果由房主决定。 */
'use strict';
ThreeBackend.worldItemActors=Object.create(null);
ThreeBackend.worldItems=function(drops){
  var self=this,keep=Object.create(null);
  drops.forEach(function(d){
    keep[d.id]=true;
    var a=self.worldItemActors[d.id];
    if(!a){
      var material=new THREE.MeshBasicMaterial({color:0xb5d9b4,fog:true});
      var mesh=new THREE.Mesh(new THREE.BoxGeometry(.22,.16,.18),material);
      var label=remoteLabel(ITEMS[d.type]?ITEMS[d.type].n:d.type);
      label.sprite.position.y=.5;label.sprite.scale.multiplyScalar(.65);
      mesh.add(label.sprite);mesh.visible=false;GLR.scene.add(mesh);
      a={mesh:mesh,label:label};self.worldItemActors[d.id]=a;
    }
    a.drop=d;
  });
  Object.keys(this.worldItemActors).forEach(function(id){if(!keep[id])self.worldItemRemove(id);});
};
ThreeBackend.worldItemRemove=function(id){
  var a=this.worldItemActors[id];if(!a)return;
  GLR.scene.remove(a.mesh);a.mesh.geometry.dispose();a.mesh.material.dispose();
  a.label.sprite.material.dispose();a.label.texture.dispose();delete this.worldItemActors[id];
};
ThreeBackend.worldItemsClear=function(){
  var self=this;Object.keys(this.worldItemActors).forEach(function(id){self.worldItemRemove(id);});
};
ThreeBackend.worldItemsTick=function(zone,waiting){
  var actors=this.worldItemActors;
  Object.keys(actors).forEach(function(id){
    var a=actors[id],d=a.drop;
    a.mesh.visible=!waiting&&d.zone===zone;
    if(!a.mesh.visible)return;
    var p=worldToScene(d.x,d.y,zone==='out'?null:INTERIORS[zone]);
    a.mesh.position.set(p.x,d.floor+.12,p.z);
  });
};
