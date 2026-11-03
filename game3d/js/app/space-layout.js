/* @module-capsule */
(function($imports){
/* 世界空间的唯一碰撞快照。初始化在 initGL 之前；渲染只重建自己的草稿。 */
'use strict';
var OUT_SOLID=[];
var SpaceLayout={
  rooms:new WeakMap(),outsideReady:false,
  ensureRoom:function(room){
    var cached=SpaceLayout.rooms.get(room);
    if(cached&&cached.grid===room.grid)return cached;
    var draft=Object.assign({},room),kit=new $imports.SpatialKit($imports.CollisionAssets);
    if(room.build){draft.foot={};draft.propExtra=[];draft.stairExtra=[];draft.stats={desk:0,cubicle:0,chair:0,seat:0};}
    else (0,$imports.buildRoomRecipe)(draft,kit,{});
    ['foot','propExtra','stairExtra','stats'].forEach(function(key){room[key]=draft[key];});
    cached={grid:room.grid,foot:room.foot,propExtra:room.propExtra,stairExtra:room.stairExtra};SpaceLayout.rooms.set(room,cached);return cached;
  },
  ensureOutside:function(){
    if(SpaceLayout.outsideReady)return;
    var k=new $imports.SpatialKit($imports.CollisionAssets),scale=$imports.SC*$imports.U2M;
    (0,$imports.addOutdoorProps)(k,$imports.BOUND.x0*scale,$imports.BOUND.y0*scale,$imports.BOUND.x1*scale,$imports.BOUND.y1*scale);
    $imports.OBJ.forEach(function(o){
      var w=(0,$imports.objWorld)(o),px=(w.x+w.w/2)*$imports.U2M,pz=(w.y+w.h/2)*$imports.U2M,sw=w.w*$imports.U2M,sd=w.h*$imports.U2M;
      if(o.id==='garw')(0,$imports.garagePed)(k,px,pz,sw,sd);
      else if(o.k==='field')(0,$imports.fieldModel)(k,o,px,pz,sw,sd);
      else if(['court','track','garden'].indexOf(o.k)>=0)(0,$imports.courtModel)(k,o,px,pz,sw,sd);
      (0,$imports.addStructureSolids)(k,o,px,pz,sw,sd,scale);              /* 柱廊、连廊落地柱、车棚棚下的钢架和车 */
    });
    OUT_SOLID=k.solids;SpaceLayout.outsideReady=true;
  },
  invalidate:function(){SpaceLayout.rooms=new WeakMap();SpaceLayout.outsideReady=false;}
};

/* @module-exports */
GameModules.publish("game3d/js/app/space-layout.js",{
"OUT_SOLID":{get:function(){return OUT_SOLID;},set:function($value){OUT_SOLID=$value;}},
"SpaceLayout":{get:function(){return SpaceLayout;},set:function($value){SpaceLayout=$value;}}
});
})(GameModules.imports("game3d/js/app/space-layout.js"));
