/* @module-capsule */
(function($imports){
/* 里世界 3D · 渲染器：WebGL、后期着色器、窗口尺寸 */
'use strict';


var GLR={};
var NOTEX=(typeof location!=='undefined'&&location.search)?(location.search.indexOf('notex')>=0):false;
var DEV_HIDE={canopy:0,sign:0,link:0,fence:0};
var GLRTEST=(function(){
  var q=(typeof location!=='undefined'&&location.search)?location.search:'';
  return {
    nopost: q.indexOf('nopost')>=0,
    nofx: q.indexOf('nofx')>=0,
    hq: q.indexOf('hq')>=0
  };
})();


        /* 砖红主体 */
      /* 砖红暗部 */
    /* 每层白横带 */
    /* 底层浅灰 */
     /* 窗洞 */
        /* 毛石基座 */


var FOG_COL=0x232a2e;   /* 原来是 0x1a1e20：远处几乎等于黑，看走廊尽头会"忽然变暗" */
var SKY_COL=0x1e2a33;


function initGL(){ return $imports.Engine.boot(); }
function resizeGL(){ return $imports.Engine.resize(); }

/* @module-exports */
GameModules.publish("game3d/js/render.js",{
"GLR":{get:function(){return GLR;},set:function($value){GLR=$value;}},
"NOTEX":{get:function(){return NOTEX;},set:function($value){NOTEX=$value;}},
"DEV_HIDE":{get:function(){return DEV_HIDE;},set:function($value){DEV_HIDE=$value;}},
"GLRTEST":{get:function(){return GLRTEST;},set:function($value){GLRTEST=$value;}},
"FOG_COL":{get:function(){return FOG_COL;},set:function($value){FOG_COL=$value;}},
"SKY_COL":{get:function(){return SKY_COL;},set:function($value){SKY_COL=$value;}},
"initGL":{get:function(){return initGL;},set:function($value){initGL=$value;}},
"resizeGL":{get:function(){return resizeGL;},set:function($value){resizeGL=$value;}}
});
})(GameModules.imports("game3d/js/render.js"));
