/* @module-capsule */
(function($imports){
/* Coordinate frame transforms keep the threshold continuous on both sides. */
'use strict';
var StairView=(function(){
  var previews=[],group=null;
  function build(R){var s=$imports.StairWorld.config(R.id),K=new $imports.Kit({chunk:16,inst:1});(0,$imports.stairwellRecipe)(K,s);var g=K.build();
    s.rooms.forEach(function(id,f){var sign=(0,$imports.signMesh)(id==='out'?'校园出口':$imports.INTERIORS[id].name,1.2,.3,'#263b32','#d8dbcd');sign.position.set(0,f*s.rise+2.35,-1.17);g.add(sign);});return g;}
  function clear(){previews.forEach(function(g){if(g.parent)g.parent.remove(g);$imports.ThreeBackend.disposeGroup(g);});previews=[];group=null;}
  function attach(id){
    clear();var R=$imports.INTERIORS[id];
    if(R&&R.stairwell){group=$imports.GLR.roomMesh;refresh();return;}
    var parent=R?$imports.GLR.roomMesh:$imports.GLR.outMesh;if(!parent)return;
    if(parent.userData.stairPreviews)return;
    parent.userData.stairPreviews=true;
    $imports.STAIR_LAYOUT.forEach(function(s){var level=s.rooms.indexOf(id||'out');if(level<0)return;
      var p=$imports.StairWorld.port(s,level);if(!p)return;var pos=(0,$imports.worldToScene)(p.x,p.y,R),K=new $imports.Kit({chunk:16,inst:1});(0,$imports.stairwellRecipe)(K,s);var shaft=K.build();
      shaft.position.set(pos.x+2.8*p.n[0],-level*s.rise,pos.z+2.8*p.n[1]);shaft.rotation.y=-$imports.StairWorld.turn(p.n);parent.add(shaft);
    });
  }
  function refresh(){
    if(!group||!$imports.StairWorld.here())return;
    var s=$imports.StairWorld.config($imports.S.room),level=Math.round(($imports.S.floorY||0)/s.rise);
    var base=Math.min(s.rooms.length-2,Math.floor(($imports.S.floorY||0)/s.rise))*s.rise;
    $imports.GLR.roomLights.forEach(function(light,i){light.position.y=base+[2.35,s.rise/2+2.35,s.rise+2.35][i];});
    var want=[level];if(level<s.rooms.length-1)want.push(level+1);else if(level>0)want.push(level-1);
    previews=previews.filter(function(g){if(want.includes(g.userData.previewLevel))return true;if(g.parent)g.parent.remove(g);$imports.ThreeBackend.disposeGroup(g);return false;});
    want.forEach(function(f){
      if(previews.some(function(g){return g.userData.previewLevel===f;}))return;
      var id=s.rooms[f],R=$imports.INTERIORS[id],p=$imports.StairWorld.port(s,f),mesh;
      if(R)mesh=(0,$imports.buildRoomGeometry)(R);else{
        var oldLamps=$imports.OUT_LAMPS,oldOut=$imports.OUTX;
        try{mesh=(0,$imports.buildOutdoorGeometry)();}finally{$imports.OUT_LAMPS=oldLamps;$imports.OUTX=oldOut;}
      }
      var pp=(0,$imports.worldToScene)(p.x,p.y,R||null),theta=$imports.StairWorld.turn(p.n),cos=Math.cos(theta),sin=Math.sin(theta);
      mesh.rotation.y=theta;mesh.position.set(-(cos*pp.x+sin*pp.z),f*s.rise,-2.8-(-sin*pp.x+cos*pp.z));
      mesh.userData.previewLevel=f;group.add(mesh);previews.push(mesh);
    });
  }
  GameModules.on('sceneBuilt',attach,{owner:'stairwell'});GameModules.on('clearWorld',clear,{owner:'stairwell'});
  GameModules.on('frame',refresh,{owner:'stairwell'});
  return {build:build,clear:clear,refresh:refresh};
})();

/* @module-exports */
GameModules.publish("game3d/js/fx/stairwell-view.js",{
"StairView":{get:function(){return StairView;},set:function($value){StairView=$value;}}
});
})(GameModules.imports("game3d/js/fx/stairwell-view.js"));
