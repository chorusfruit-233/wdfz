/* @module-capsule */
(function($imports){
/* 学生会检查的模型与消散动画；只消费检查快照。 */
'use strict';
var INSPECT_FX={group:null,room:null,points:null,scatter:null};
var InspectionView={
clearFx:function(){
    if(INSPECT_FX.group){
      if($imports.GLR.scene)$imports.GLR.scene.remove(INSPECT_FX.group);
      $imports.ThreeBackend.disposeGroup(INSPECT_FX.group);
    }
    INSPECT_FX.group=null;INSPECT_FX.room=null;INSPECT_FX.points=null;INSPECT_FX.scatter=null;
  },
buildFx:function(c){
    InspectionView.clearFx();
    if(!$imports.GLR.scene||c.excused)return;
    var group=new $imports.THREE.Group(),room=$imports.S.mode==='in'?$imports.INTERIORS[$imports.S.room]:null,player=(0,$imports.worldToScene)($imports.S.x,$imports.S.y,room);
    c.points.forEach(function(point){
      var pos=(0,$imports.worldToScene)(point.x,point.y,room),figure=new $imports.THREE.Group();
      figure.add((0,$imports.figMesh)('person',new $imports.THREE.MeshBasicMaterial({color:0x030405,fog:true,transparent:true,opacity:1}),1));
      figure.position.set(pos.x,$imports.S.floorY||0,pos.z);group.add(figure);
      var dx=pos.x-player.x,dz=pos.z-player.z,len=Math.hypot(dx,dz)||1;
      figure.userData.scatterX=dx/len;figure.userData.scatterZ=dz/len;
    });
    $imports.GLR.scene.add(group);INSPECT_FX.group=group;INSPECT_FX.room=c.room;INSPECT_FX.points=c.points;
  },
scatterTick:function(dt,animation){
    var group=INSPECT_FX.group;INSPECT_FX.scatter=animation;
    if(!animation||!group)return;
    if(INSPECT_FX.room!==($imports.S.mode==='in'?$imports.S.room:'out')){InspectionView.clearFx();return;}
    var alpha=Math.max(0,1-animation.t/animation.duration);
    group.children.forEach(function(figure){
      figure.position.x+=figure.userData.scatterX*dt*1.5;
      figure.position.z+=figure.userData.scatterZ*dt*1.5;
      figure.traverse(function(o){if(o.material)o.material.opacity=alpha;});
    });
    if(animation.t>=animation.duration)InspectionView.clearFx();
  },
  sync:function(c){if(!INSPECT_FX.group||INSPECT_FX.points!==c.points)InspectionView.buildFx(c);},
  finish:function(animation){INSPECT_FX.scatter=animation;}
};

/* @module-exports */
GameModules.publish("game3d/js/fx/inspection-fx.js",{
"INSPECT_FX":{get:function(){return INSPECT_FX;},set:function($value){INSPECT_FX=$value;}},
"InspectionView":{get:function(){return InspectionView;},set:function($value){InspectionView=$value;}}
});
})(GameModules.imports("game3d/js/fx/inspection-fx.js"));
