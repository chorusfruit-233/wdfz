/* 里世界 3D · 渲染器：WebGL、后期着色器、窗口尺寸 */
'use strict';

var U2M=1/9;
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

var PALETTE={
  wall:0xbdb7ad, wall2:0xb0aaa0, floor:0x928e88, floor2:0x9c9892,
  desk:0x86653c, seat:0x785b34, podium:0x765a35, bed:0x9fa8b0,
  table:0x8f7350, counter:0x9a7648, shelf:0xa8a196, cabinet:0x9d9488,
  lab:0xb0b6b8, basin:0xc2c8cb, rack:0x9aa0a4, car:0x8a9298,
  data:0x8f9aa2, trash:0x8e9288, stair:0xb8b4ad, door:0x6b4a33,
  outside:0x74706b, roof:0xc8918a, garden:0x6f9464, field:0x4f7d4a,
  court:0x9a8f86, track:0x8a6a58, link:0x8b3a2e
};
var BRICK=0xbe7d74;        /* 砖红主体 */
var BRICK_D=0xb87f78;      /* 砖红暗部 */
var WHITEBAND=0xe8e4de;    /* 每层白横带 */
var BASE_GREY=0xd6d2cb;    /* 底层浅灰 */
var WIN_DARK=0x33454e;     /* 窗洞 */
var STONE=0xb8ae9c;        /* 毛石基座 */
var TREE_DARK=0x2f4a32, TREE_MID=0x3d5f3e, TREE_LITE=0x4a7048;
var PALETTE_NAME={
  '#':'wall','S':'stair','O':'door','L':'link','M':'link','T':'podium',
  'd':'desk','P':'seat','B':'wall2','G':'wall2','R':'shelf','b':'bed',
  't':'table','k':'counter','f':'cabinet','l':'lab','w':'basin','v':'rack',
  'c':'car','D':'data','X':'trash','=':'door','.':'floor'
};
var FOG_COL=0x232a2e;   /* 原来是 0x1a1e20：远处几乎等于黑，看走廊尽头会"忽然变暗" */
var SKY_COL=0x1e2a33;


function initGL(){ return Engine.boot(); }
function resizeGL(){ return Engine.resize(); }
