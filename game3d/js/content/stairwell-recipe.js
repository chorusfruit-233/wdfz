/* @module-capsule */
(function($imports){
/* Visible treads and collision share StairGeometry's surfaces and bounds. */
'use strict';
function stairwellRecipe(K,s){
  var list=$imports.StairGeometry.surfaces(s.rooms.length,s.rise),top=(s.rooms.length-1)*s.rise+3;
  list.forEach(function(p){
    var slope=p.h0!==p.h1,n=slope?Math.ceil(Math.abs(p.h1-p.h0)/.16):1,d=(p.z1-p.z0)/n;
    for(var i=0;i<n;i++){
      var z=p.z0+(i+.5)*d,h=$imports.StairGeometry.height(p,z);
      K.box('fterrazzo',(p.x0+p.x1)/2,h-.11,z,p.x1-p.x0,.22,d,0x8a8880,1);
      if(slope)K.box('metal',(p.x0+p.x1)/2,h+.003,z-d*.45,p.x1-p.x0,.012,.025,0x9d9069,1);
    }
    if(slope){
      [p.x0,p.x1].forEach(function(x){
        K.rod('metal',x,p.h0+.95,p.z0,x,p.h1+.95,p.z1,.035,.035,6,0x6a6c61,1);
        for(var j=0;j<=6;j++){var z=p.z0+(p.z1-p.z0)*j/6,h=$imports.StairGeometry.height(p,z);K.rod('metal',x,h,z,x,h+.95,z,.018,.018,5,0x52594e,1);}
      });
    }
  });
  K.box('plaster',-2.27,top/2,3,.14,top,8.4,0x7c8178,.8);
  K.box('plaster',2.27,top/2,3,.14,top,8.4,0x7c8178,.8);
  K.box('plaster',0,top/2,7.27,4.68,top,.14,0x7c8178,.9);
  for(var f=0;f<s.rooms.length;f++){
    var h=f*s.rise;
    [-1.55,1.55].forEach(function(x){K.box('plaster',x,h+1.5,-1.27,1.4,3,.14,0x7c8178,1);});
    K.box('plaster',0,h+2.65,-1.27,1.7,.7,.14,0x7c8178,1);
    K.box('emit',1.8,h+2.35,-1.18,.38,.10,.04,0xaac8b0,1);
    if(f<s.rooms.length-1)K.box('emit',1.8,h+s.rise/2+2.35,7.18,.38,.10,.04,0xaac8b0,1);
    K.rod('metal',-.3,h+.95,.8,.3,h+.95,.8,.03,.03,6,0x6a6c61,1);
  }
}

/* @module-exports */
GameModules.publish("game3d/js/content/stairwell-recipe.js",{
"stairwellRecipe":{get:function(){return stairwellRecipe;},set:function($value){stairwellRecipe=$value;}}
});
})(GameModules.imports("game3d/js/content/stairwell-recipe.js"));
