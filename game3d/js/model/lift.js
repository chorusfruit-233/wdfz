/* @module-capsule */
(function($imports){
/* 电梯门动画；配方见 content/lift-recipe.js。 */
'use strict';
function liftLandingLeaves(c,cx,cz,rot){
  var s=$imports.EV_SPEC,R=c.R;
  var leafW=(s.doorW-s.doorGap)/2;
  [-1,1].forEach(function(sg){
    /* 按关着时的真实位置建模（穿模审查看到的就是它真正在的地方），开门只整体平移 */
    var LK=new $imports.Kit(); LK.frame(cx,cz,rot);
    var old=LK.sub(sg*(leafW/2+s.doorGap/2),$imports.LIFT_DOOR_Z,0,0);
    (0,$imports.liftLeaf)(LK,leafW,1,sg); LK.restore(old);
    var g=LK.build(), o=(0,$imports.liftToRoom)(0,0,rot,sg*(leafW+0.02),0);
    g.name='lift-leaf'; g.userData={liftLeaf:true,host:R.host,floor:R.floor,ox:o.x,oz:o.z};
    c.meshes.push(g);
  });
}
var LiftDoors={mesh:null,list:[],k:0,
  tick:function(dt){
    var g=typeof $imports.GLR!=='undefined'?$imports.GLR.roomMesh:null;
    if(!g||$imports.S.mode!=='in'){ LiftDoors.mesh=null; LiftDoors.list=[]; return; }
    if(LiftDoors.mesh!==g){
      LiftDoors.mesh=g; LiftDoors.list=[];
      g.traverse(function(o){ if(o.userData&&o.userData.liftLeaf) LiftDoors.list.push(o); });
      LiftDoors.k=LiftDoors.target();                              /* 进房间时直接摆到位，不从关着开始滑 */
    }
    if(!LiftDoors.list.length) return;
    var t=LiftDoors.target(), sp=Math.min(1,dt/0.9);
    LiftDoors.k+=Math.max(-sp,Math.min(sp,t-LiftDoors.k));
    var e=LiftDoors.k*LiftDoors.k*(3-2*LiftDoors.k);
    LiftDoors.list.forEach(function(o){
      var u=o.userData; o.position.x=u.ox*e; o.position.z=u.oz*e;
    });
  },
  target:function(){
    var R=$imports.INTERIORS[$imports.S.room];
    if(!R||typeof $imports.Elevator==='undefined'||!$imports.Elevator.doorOpen) return 0;
    return $imports.Elevator.doorOpen(R.host,R.floor);
  }
};

/* @module-exports */
GameModules.publish("game3d/js/model/lift.js",{
"liftLandingLeaves":{get:function(){return liftLandingLeaves;},set:function($value){liftLandingLeaves=$value;}},
"LiftDoors":{get:function(){return LiftDoors;},set:function($value){LiftDoors=$value;}}
});
})(GameModules.imports("game3d/js/model/lift.js"));
