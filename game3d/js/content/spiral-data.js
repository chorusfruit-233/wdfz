/* @module-capsule */
(function($imports){
/* 旋梯的共享尺寸与平台开口；模拟与模型共用。 */
'use strict';
var SPIRAL={
  room:'bell1',
  cx:0, cz:-1.0,            /* 柱子中心 */
  rCol:0.55, rIn:0.75, rOut:2.6,
  turnH:3.2, turns:2,       /* 每圈升 3.2 米，转两圈 */
  steps:16,                 /* 每圈台阶数 */
  th0:Math.PI/2,            /* 楼梯口在柱子正南 */
  enter:[-0.30,0.50],       /* 地面上能踏上第一级的角度范围（相对楼梯口） */
  hole:3.9,                 /* 顶上平台在楼梯上方留的口子（弧度）：以前只留 0.62，最后小半圈楼梯离平台底不到 1.7 米，走上去头就穿进石板里 */
  arrive:0.62               /* 口子里只有靠楼梯顶这一段能从平台走回楼梯，其余一圈是栏杆 */
};
SPIRAL.amax=SPIRAL.turns*$imports.TAU;
SPIRAL.topH=SPIRAL.turns*SPIRAL.turnH;
SPIRAL.wallH=SPIRAL.topH+3.4;
function spTopOffset(th){
  var d=((th-SPIRAL.th0-SPIRAL.amax)%$imports.TAU+$imports.TAU)%$imports.TAU;
  return d>0?d-$imports.TAU:0;
}
/* @module-exports */
GameModules.publish("game3d/js/content/spiral-data.js",{
"SPIRAL":{get:function(){return SPIRAL;},set:function($value){SPIRAL=$value;}},
"spTopOffset":{get:function(){return spTopOffset;},set:function($value){spTopOffset=$value;}}
});
})(GameModules.imports("game3d/js/content/spiral-data.js"));
