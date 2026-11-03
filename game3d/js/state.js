/* @module-capsule */
(function($imports){
/* 里世界 3D · 游戏状态 */
'use strict';

var S={
  screen:'menu', mode:'out', room:null,
  x:$imports.GATE_N.x*$imports.SC, y:($imports.GATE_N.y+60)*$imports.SC,
  ang:-$imports.PI/2, pitch:0,
  tsec:700, day:1, diff:'easy',
  san:100, viol:0, stam:100, tt:0,
  seated:false, dead:false, death:null, deadT:0,
  talent:'code', bag:[], hot:[null,null], bagSel:0,
  moving:false, run:false, walkPhase:0, bob:0, enterCool:0,
  hiddenLatch:false, hiddenWindow:0,
  immuneUsed:false, rosterSolved:false, rained:false,
  spots:{}, clues:{}, notes:{}, marks:{},
  rt:{},
  fov:72, sprinting:false
};
var RT={};   /* 剧情标志，随存档走 */

function newRT(){
  return {deskUsed:{}, pendingLoot:{}, hwTaken:false, hwGiven:false, key:false, plate:false,
    carPlates:[], carFuel:[], carUsed:false, carLeaving:0, hacked:false, data:false,
    trash:false, beast:false, beastDrop:false, dropped:[], clue:0, rained:false,
    anaSeen:{}, lure:null, piano:{}, endTrap:null, dayRhythmVersion:1, outing:null, studySkipped:0,
    pressureClock:700, pressureSeen:0};
}

/* @module-exports */
GameModules.publish("game3d/js/state.js",{
"S":{get:function(){return S;},set:function($value){S=$value;}},
"RT":{get:function(){return RT;},set:function($value){RT=$value;}},
"newRT":{get:function(){return newRT;},set:function($value){newRT=$value;}}
});
})(GameModules.imports("game3d/js/state.js"));
