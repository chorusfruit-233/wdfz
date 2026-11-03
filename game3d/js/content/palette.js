/* @module-capsule */
(function($imports){
/* 场景配色数据；不是渲染实例状态。 */
'use strict';
var PALETTE={
  wall:0xbdb7ad, wall2:0xb0aaa0, floor:0x928e88, floor2:0x9c9892,
  desk:0x86653c, seat:0x785b34, podium:0x765a35, bed:0x9fa8b0,
  table:0x8f7350, counter:0x9a7648, shelf:0xa8a196, cabinet:0x9d9488,
  lab:0xb0b6b8, basin:0xc2c8cb, rack:0x9aa0a4, car:0x8a9298,
  data:0x8f9aa2, trash:0x8e9288, stair:0xb8b4ad, door:0x6b4a33,
  outside:0x74706b, roof:0xc8918a, garden:0x6f9464, field:0x4f7d4a,
  court:0x9a8f86, track:0x8a6a58, link:0x8b3a2e
};
var BRICK=0xbe7d74;
var BRICK_D=0xb87f78;
var WHITEBAND=0xe8e4de;
var BASE_GREY=0xd6d2cb;
var WIN_DARK=0x33454e;
var STONE=0xb8ae9c;
var TREE_DARK=0x2f4a32, TREE_MID=0x3d5f3e, TREE_LITE=0x4a7048;
var PALETTE_NAME={
  '#':'wall','S':'stair','O':'door','L':'link','M':'link','T':'podium',
  'd':'desk','P':'seat','B':'wall2','G':'wall2','R':'shelf','b':'bed',
  't':'table','k':'counter','f':'cabinet','l':'lab','w':'basin','v':'rack',
  'c':'car','D':'data','X':'trash','=':'door','.':'floor'
};
/* @module-exports */
GameModules.publish("game3d/js/content/palette.js",{
"PALETTE":{get:function(){return PALETTE;},set:function($value){PALETTE=$value;}},
"BRICK":{get:function(){return BRICK;},set:function($value){BRICK=$value;}},
"BRICK_D":{get:function(){return BRICK_D;},set:function($value){BRICK_D=$value;}},
"WHITEBAND":{get:function(){return WHITEBAND;},set:function($value){WHITEBAND=$value;}},
"BASE_GREY":{get:function(){return BASE_GREY;},set:function($value){BASE_GREY=$value;}},
"WIN_DARK":{get:function(){return WIN_DARK;},set:function($value){WIN_DARK=$value;}},
"STONE":{get:function(){return STONE;},set:function($value){STONE=$value;}},
"TREE_DARK":{get:function(){return TREE_DARK;},set:function($value){TREE_DARK=$value;}},
"TREE_MID":{get:function(){return TREE_MID;},set:function($value){TREE_MID=$value;}},
"TREE_LITE":{get:function(){return TREE_LITE;},set:function($value){TREE_LITE=$value;}},
"PALETTE_NAME":{get:function(){return PALETTE_NAME;},set:function($value){PALETTE_NAME=$value;}}
});
})(GameModules.imports("game3d/js/content/palette.js"));
