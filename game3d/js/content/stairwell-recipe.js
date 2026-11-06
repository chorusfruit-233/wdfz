/* @module-capsule */
(function($imports){
/* Visible treads and collision share StairGeometry's surfaces and bounds. */
'use strict';
function stairwellRecipe(K,s){
  var list=$imports.StairGeometry.surfaces(s.rooms.length,s.rise),top=(s.rooms.length-1)*s.rise+3,door=$imports.StairGeometry.config.door,T=.22;
  list.forEach(function(p){
    var slope=p.h0!==p.h1,n=slope?Math.ceil(Math.abs(p.h1-p.h0)/.16):1,d=(p.z1-p.z0)/n;
    if(!slope){
      /* 平台：楼梯口那一格（门洞前后各半米）走廊不铺地，由这里补上；再往外是走廊自己的地面，不叠在一起闪 */
      var z0=Math.max(p.z0,door-.5),z1=p.z1;
      K.box('fterrazzo',(p.x0+p.x1)/2,p.h0-T/2,(z0+z1)/2,p.x1-p.x0,T,z1-z0,0x8a8880,1);
      return;
    }
    /* 梯段是实心的：每一级是一块梯形（上面是踏面，下面顺着整段的斜底板），侧面和底面连成一整块，从下面、侧面看都不是悬空的台阶 */
    var o=K.sub((p.x0+p.x1)/2,0,-Math.PI/2,0);
    for(var i=0;i<n;i++){
      var za=p.z0+i*d,zb=za+d,h=$imports.StairGeometry.height(p,(za+zb)/2);
      var sa=$imports.StairGeometry.height(p,za)-T,sb=$imports.StairGeometry.height(p,zb)-T;
      if(d<0){var t=za;za=zb;zb=t;t=sa;sa=sb;sb=t;}
      K.prism('plaster',0,0,0,[[za,sa],[zb,sb],[zb,h-.03],[za,h-.03]],p.x1-p.x0,0x8c8f88,.95);
    }
    /* 两侧的侧梁：顺着斜线的一条板，盖住每一级的侧面，上沿高出斜线 6 厘米；按级分段（连成一条，包围盒贴着梁，扶手不算穿模） */
    [p.x0,p.x1].forEach(function(x){
      var q=K.sub(x,0,-Math.PI/2,0);
      for(var k=0;k<n;k++){
        var a=p.z0+k*d,b=a+d,ha=$imports.StairGeometry.height(p,a),hb=$imports.StairGeometry.height(p,b);
        K.prism('plaster',0,0,0,[[a,ha-T],[b,hb-T],[b,hb+.06],[a,ha+.06]],.05,0x80847c,.9);
      }
      K.restore(q);
    });
    K.restore(o);
    for(i=0;i<n;i++){
      var z=p.z0+(i+.5)*d;h=$imports.StairGeometry.height(p,z);
      K.box('fterrazzo',(p.x0+p.x1)/2,h-.015,z,p.x1-p.x0+.02,.03,Math.abs(d)+.004,0x8a8880,1);   /* 踏面 */
      K.box('metal',(p.x0+p.x1)/2,h+.003,z-d*.45,p.x1-p.x0,.012,.025,0x9d9069,1);
    }
    [p.x0,p.x1].forEach(function(x){
      K.rod('metal',x,p.h0+.95,p.z0,x,p.h1+.95,p.z1,.035,.035,6,0x6a6c61,1);
      for(var j=0;j<=6;j++){var z=p.z0+(p.z1-p.z0)*j/6,h=$imports.StairGeometry.height(p,z);K.rod('metal',x,h+.06,z,x,h+.95,z,.018,.018,5,0x52594e,1);}   /* 立在侧梁上 */
    });
  });
  /* 一楼：楼梯底下铺满地面；第二段梯段下面（走不进去的那块）用一道墙封起来，像个楼梯底下的储物间 */
  K.box('fterrazzo',0,-T/2,4,4.4,T,6.4,0x7f7d76,1);
  if(s.rooms.length>1){
    K.box('plaster',.95,(s.rise-T)/2,.87,2.5,s.rise-T,.14,0x7c8178,1);
    K.box('wood',1.25,1.0,.79,.8,2.0,.04,0x5c4a3a,1);                                   /* 储物间的门（锁着） */
  }
  K.box('plaster',-2.27,top/2,3,.14,top,8.4,0x7c8178,.8);
  K.box('plaster',2.27,top/2,3,.14,top,8.4,0x7c8178,.8);
  K.box('plaster',0,top/2,7.27,4.68,top,.14,0x7c8178,.9);
  for(var f=0;f<s.rooms.length;f++){
    var h=f*s.rise;
    [-1.55,1.55].forEach(function(x){K.box('plaster',x,h+1.5,-1.27,1.4,3,.14,0x7c8178,1);});
    K.box('plaster',0,h+2.65,-1.27,1.7,.7,.14,0x7c8178,1);
    K.box('emit',1.8,h+2.35,-1.18,.38,.10,.04,0xaac8b0,1);
    if(f<s.rooms.length-1)K.box('emit',1.8,h+s.rise/2+2.35,7.18,.38,.10,.04,0xaac8b0,1);
    if(f>0)K.rod('metal',-.3,h+.95,.8,.3,h+.95,.8,.03,.03,6,0x6a6c61,1);   /* 一楼那里是墙 */
  }
}

/* @module-exports */
GameModules.publish("game3d/js/content/stairwell-recipe.js",{
"stairwellRecipe":{get:function(){return stairwellRecipe;},set:function($value){stairwellRecipe=$value;}}
});
})(GameModules.imports("game3d/js/content/stairwell-recipe.js"));
