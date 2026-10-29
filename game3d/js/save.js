/* 里世界 3D · 存档 */
'use strict';

/* 存档字段表：每一组把"存"和"读"写在一起，加字段只改一处，不会存了忘读、读了忘存。
   读档按表的顺序执行：时钟要先于冷却时间的换算，背包要先于手持状态，模式 / 房间要先于车库里那个东西。
   clockVersion 2 起时钟按"天 * 1440 + 当天分钟"连续计；更早的存档读进来时换算一次。 */
function saveNum(v,lo,hi){ return Number.isFinite(v)?clamp(v,lo,hi):0; }
function saveObj(v){ return (v&&typeof v==='object'&&!Array.isArray(v))?Object.assign({},v):{}; }
var SAVE_SCHEMA=[
  { /* 位置和时钟 */
    save:function(d){ d.mode=S.mode; d.room=S.room; d.x=S.x; d.y=S.y; d.ang=S.ang; d.pitch=S.pitch; d.tsec=S.tsec; d.day=S.day; d.diff=S.diff; },
    load:function(d){
      S.mode=d.mode||'out'; S.room=d.room||null;
      S.x=d.x; S.y=d.y; S.ang=d.ang||0; S.pitch=d.pitch||0;
      S.tsec=d.tsec; S.day=d.day;
      if(d.clockVersion!==2&&S.tsec>=0&&S.tsec<60) S.tsec+=1440;
    }
  },
  { /* 身体：SAN、违规、体力、士力架 / 药片 / 手机的剩余时间 */
    save:function(d){
      d.san=S.san; d.viol=S.viol; d.stam=S.stam; d.tired=!!S.tired;
      d.snackT=Math.max(0,S.snackT||0); d.pillT=Math.max(0,S.pillT||0); d.phoneCool=Math.max(0,PHONE.cool||0);
    },
    load:function(d){
      S.san=d.san; S.viol=d.viol; S.stam=d.stam;
      S.tired=(typeof d.tired==='boolean')?d.tired:S.stam<=6;
      S.snackT=saveNum(d.snackT,0,SNACK_SEC); S.pillT=saveNum(d.pillT,0,PILL_SEC); PHONE.cool=saveNum(d.phoneCool,0,PH_COOL);
    }
  },
  { /* 设施冷却（按连续时钟记） */
    save:function(d){ d.actCool=S.actCool||{}; },
    load:function(d){
      S.actCool=saveObj(d.actCool);
      if(d.clockVersion!==2){
        var oldClock=(d.day||1)*1440+d.tsec, newClock=gameClock();
        Object.keys(S.actCool).forEach(function(k){ if(Number.isFinite(S.actCool[k])) S.actCool[k]=newClock+Math.max(0,S.actCool[k]-oldClock); });
      }
    }
  },
  { /* 天赋免疫、课表违规的计时与档位 */
    save:function(d){ d.immuneUsed=!!S.immuneUsed; d.tt=S.tt; d.ttTier=S.ttTier; },
    load:function(d){ S.immuneUsed=!!d.immuneUsed; S.tt=d.tt||0; S.ttTier=d.ttTier||0; }
  },
  { /* 考试模式 */
    save:function(d){ d.exam=!!S.exam; d.examCur=S.examCur; d.examSeat=S.examSeat||0; d.examTot=S.examTot||0; },
    load:function(d){ S.exam=!!d.exam; S.examCur=(d.examCur===undefined)?null:d.examCur; S.examSeat=d.examSeat||0; S.examTot=d.examTot||0; }
  },
  { /* 背包、快捷栏、天赋、搜过的地方、线索、坐着没有 */
    save:function(d){ d.bag=S.bag; d.hot=S.hot; d.talent=S.talent; d.spots=S.spots; d.clues=S.clues; d.seated=S.seated; },
    load:function(d){
      S.bag=d.bag||[]; S.hot=d.hot||[null,null];
      S.talent=d.talent||S.talent; S.spots=d.spots||{}; S.clues=d.clues||{};
      S.seated=!!d.seated;
    }
  },
  { /* 隐藏的选择：读档后重新给出还没回答的那一次 */
    save:function(d){ d.hiddenAsked=S.hiddenAsked; d.hiddenLatch=S.hiddenLatch; d.hiddenWindow=Number.isFinite(S.hiddenWindow)?S.hiddenWindow:0; },
    load:function(d){
      S.hiddenLatch=!!d.hiddenLatch; S.hiddenAsked=false;
      S.hiddenWindow=Number.isFinite(d.hiddenWindow)?d.hiddenWindow:(S.hiddenLatch?3.2:0);
      if(d.hiddenAsked&&S.hiddenLatch) S.hiddenWindow=0;
    }
  },
  { /* 假正常 */
    save:function(d){ d.fn=S.fn; },
    load:function(d){ if(d.fn) S.fn=Object.assign({v:0,on:false,note:false,n:0,next:0,shown:false},d.fn); }
  },
  { /* 剧情标志、手里用着的东西、开着的门 */
    save:function(d){ d.rt=RT; d.use=USE; d.openDoors=OPENDOORS; },
    load:function(d){
      if(d.rt) RT=Object.assign(newRT(),d.rt);
      if(d.use) USE=d.use;
      syncUseState();
      if(d.openDoors) OPENDOORS=d.openDoors;
    }
  },
  { /* 异象：正在发生的那一个、节奏、预报、冷却；没答完的选择读档后重新问，剩下的时间接着算 */
    save:function(d){
      d.anRained=AN.rained; d.anCool=AN.cool;
      d.anId=AN.id; d.anT=AN.t; d.anAcc=AN.acc;
      d.anData=(function(){ try{ return JSON.parse(JSON.stringify(AN.data||{})); }catch(e){ return {}; } })();
      d.anNext=AN.next; d.anLastBig=AN.lastBig; d.anPre=AN.pre; d.anPreNext=AN.preNext;
      d.anLocked=!!AN.locked; d.anLockWait=AN.lockWait||0;
      d.anChoiceMs=(AN.active&&UI.chooseOpen&&UI.choiceTimer)?Math.max(0,UI.choiceDeadline-performance.now()):null;
    },
    load:function(d){
      AN.id=d.anId||null; AN.t=d.anT||0; AN.acc=d.anAcc||0;
      AN.data=(d.anData&&typeof d.anData==='object')?d.anData:{};
      AN.next=(typeof d.anNext==='number')?d.anNext:45;
      AN.rained=!!d.anRained; AN.cool=d.anCool||{};
      if(d.clockVersion!==2){
        var savedClock=gameClock();
        Object.keys(AN.cool).forEach(function(k){
          if(Number.isFinite(AN.cool[k])) AN.cool[k]=savedClock-((S.tsec-AN.cool[k]+1440)%1440);
        });
      }
      AN.pre=d.anPre||null; AN.preNext=d.anPreNext||0; AN.locked=!!d.anLocked; AN.lockWait=d.anLockWait||0;
      AN.lastBig=!!d.anLastBig; AN.active=!!d.anId;
      if(AN.active&&AN.data.asked&&AN.data.chosen===null&&['turn','hand','repeat','cold'].indexOf(AN.id)>=0){
        AN.data.asked=false;
        if(Number.isFinite(d.anChoiceMs)) AN.data.choiceRemaining=d.anChoiceMs;
      }
      AN.sub=0;
    }
  },
  { /* 车库里那个东西（只在车库里存）；钟楼旋梯上的位置（进房间时由 enterRoom 读） */
    save:function(d){
      d.roam=(S.mode==='in'&&S.room==='garage1')?Object.assign({},ROAM):null;
      d.spiral=spiralHere()?{state:SP.state,a:SP.a,th:SP.th}:null;
    },
    load:function(d){ if(S.mode==='in'&&S.room==='garage1'&&d.roam&&typeof d.roam==='object') Object.assign(ROAM,d.roam); }
  }
];
function saveGame(){
  try{
    var d={v:1, clockVersion:2};
    SAVE_SCHEMA.forEach(function(f){ f.save(d); });
    localStorage.setItem('wdfz3d',JSON.stringify(d));
    return true;
  }catch(e){ return false; }
}
/* 把存档里的数据写回游戏状态（调用前先 freshState） */
function applySave(d){
  SAVE_SCHEMA.forEach(function(f){ f.load(d); });
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
  if(!el) return;
  var seen=endsSeen(), ids=Object.keys(ENDINGS), got=[];
  for(var i=0;i<ids.length;i++) if(seen[ids[i]]) got.push(ENDINGS[ids[i]].t+(ENDINGS[ids[i]].true?'（真）':ENDINGS[ids[i]].fake?'（假）':''));
  el.textContent=got.length?'已见结局 '+got.length+' / '+ids.length+'　'+got.join(' '):'';
  el.style.display=got.length?'block':'none';
}
