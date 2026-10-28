/* 里世界 3D · 存档 */
'use strict';

function saveGame(){
  try{
    var d={
      v:1, mode:S.mode, room:S.room, x:S.x, y:S.y, ang:S.ang, pitch:S.pitch,
      tsec:S.tsec, day:S.day, diff:S.diff, san:S.san, viol:S.viol, stam:S.stam, tt:S.tt,
      tired:!!S.tired, snackT:Math.max(0,S.snackT||0),
      actCool:S.actCool||{}, immuneUsed:!!S.immuneUsed,
      spiral:spiralHere()?{state:SP.state,a:SP.a,th:SP.th}:null,
      bag:S.bag, hot:S.hot, talent:S.talent, spots:S.spots, clues:S.clues,
      seated:S.seated, ttTier:S.ttTier, hiddenAsked:S.hiddenAsked,
      hiddenLatch:S.hiddenLatch,
      rt:RT, use:USE, anRained:AN.rained, anCool:AN.cool,
      openDoors:OPENDOORS,
      anId:AN.id, anT:AN.t, anAcc:AN.acc,
      anData:(function(){ try{ return JSON.parse(JSON.stringify(AN.data||{})); }catch(e){ return {}; } })(),
      anNext:AN.next, anLastBig:AN.lastBig,
      fn:S.fn,
      exam:!!S.exam, examCur:S.examCur, examSeat:S.examSeat||0, examTot:S.examTot||0
    };
    localStorage.setItem('wdfz3d',JSON.stringify(d));
    return true;
  }catch(e){ return false; }
}
function loadGame(){
  try{
    var raw=localStorage.getItem('wdfz3d');
    if(!raw) return null;
    return JSON.parse(raw);
  }catch(e){ return null; }
}

/* 以前只有暂停菜单里能手动存档，死了、结局了存档也还在：「梦魇」可以读档重来。
   现在进出房间、预知梦醒来时自动存；死透了或者打出结局就删档。 */
function autoSave(){
  if(S.screen==='play'&&!S.dead) saveGame();
}
function clearSave(){
  try{ localStorage.removeItem('wdfz3d'); }catch(e){}
}
/* 拿到过的结局单独记，不跟存档一起删 */
var ENDS_KEY='wdfz3d_ends';
function endsSeen(){
  try{ var d=JSON.parse(localStorage.getItem(ENDS_KEY)||'{}'); return (d&&typeof d==='object')?d:{}; }catch(e){ return {}; }
}
function endMark(id){
  var d=endsSeen(); d[id]=1;
  try{ localStorage.setItem(ENDS_KEY,JSON.stringify(d)); }catch(e){}
}
function paintMenuSave(){
  var sc=document.getElementById('btncont');
  if(sc) sc.style.display=loadGame()?'block':'none';
  var el=document.getElementById('mends');
  if(!el||typeof ENDINGS==='undefined') return;
  var seen=endsSeen(), ids=Object.keys(ENDINGS), got=[];
  for(var i=0;i<ids.length;i++) if(seen[ids[i]]) got.push(ENDINGS[ids[i]].t+(ENDINGS[ids[i]].true?'（真）':ENDINGS[ids[i]].fake?'（假）':''));
  el.textContent=got.length?'已见结局 '+got.length+' / '+ids.length+'　'+got.join(' '):'';
  el.style.display=got.length?'block':'none';
}
