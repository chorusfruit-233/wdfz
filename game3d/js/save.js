/* @module-capsule */
(function($imports){
/* 里世界 3D · 存档 */
'use strict';

/* 存档字段表：每一组把"存"和"读"写在一起，加字段只改一处，不会存了忘读、读了忘存。
   读档按表的顺序执行：时钟要先于冷却时间的换算，背包要先于手持状态，模式 / 房间要先于车库里那个东西。
   clockVersion 2 起时钟按"天 * 1440 + 当天分钟"连续计；更早的存档读进来时换算一次。 */
function saveNum(v,lo,hi){ return Number.isFinite(v)?(0,$imports.clamp)(v,lo,hi):0; }
function saveObj(v){ return (v&&typeof v==='object'&&!Array.isArray(v))?Object.assign({},v):{}; }
var SAVE_DIAGNOSTIC=null;
function saveReport(stage,error){
  SAVE_DIAGNOSTIC={stage:stage,message:error&&error.message?error.message:String(error)};
}
var GameStorage=$imports.StorageAdapter.create(function(){return localStorage;},function(e){saveReport(e.operation,e.error);});
function prepareSave(d){return $imports.SaveData.prepare(d,{lightsOut:$imports.LIGHTS_OUT,rooms:$imports.INTERIORS,items:$imports.ITEMS});}
var SAVE_SCHEMA=[
  { /* 位置和时钟 */
    save:function(d){ d.mode=$imports.S.mode; d.room=$imports.S.room; d.x=$imports.S.x; d.y=$imports.S.y; d.ang=$imports.S.ang; d.pitch=$imports.S.pitch; d.tsec=$imports.S.tsec; d.day=$imports.S.day; d.diff=$imports.S.diff;d.layoutVersion=$imports.ClassroomLayout.version;d.stairwell=$imports.StairWorld.here()?{id:$imports.S.room,height:$imports.S.floorY}:null; },
    load:function(d){
      $imports.S.mode=d.mode||'out'; $imports.S.room=d.room||null;
      $imports.S.x=d.x; $imports.S.y=d.y; $imports.S.ang=d.ang||0; $imports.S.pitch=d.pitch||0;
      $imports.S.tsec=d.tsec; $imports.S.day=d.day;
    }
  },
  { /* 身体：SAN、违规、体力、士力架 / 药片 / 手机的剩余时间 */
    save:function(d){
      d.san=$imports.S.san; d.viol=$imports.S.viol; d.stam=$imports.S.stam; d.tired=!!$imports.S.tired;
      d.snackT=Math.max(0,$imports.S.snackT||0); d.pillT=Math.max(0,$imports.S.pillT||0); d.phoneCool=Math.max(0,$imports.PHONE.cool||0);
    },
    load:function(d){
      $imports.S.san=saveNum(d.san,0,100); $imports.S.viol=saveNum(d.viol,0,100); $imports.S.stam=saveNum(d.stam,0,(0,$imports.staminaMax)());
      $imports.S.tired=(typeof d.tired==='boolean')?d.tired:$imports.S.stam<=6;
      $imports.S.snackT=saveNum(d.snackT,0,$imports.SNACK_SEC); $imports.S.pillT=saveNum(d.pillT,0,$imports.PILL_SEC); $imports.PHONE.cool=saveNum(d.phoneCool,0,$imports.PH_COOL);
    }
  },
  { /* 设施冷却（按连续时钟记） */
    save:function(d){ d.actCool=$imports.S.actCool||{}; },
    load:function(d){
      $imports.S.actCool=saveObj(d.actCool);
    }
  },
  { /* 天赋免疫、课表违规的计时与档位 */
    save:function(d){ d.immuneUsed=!!$imports.S.immuneUsed; d.tt=$imports.S.tt; d.ttTier=$imports.S.ttTier; },          /* immuneUsed 只为旧版本读档保留，从 talentState 派生 */
    load:function(d){ $imports.S.tt=saveNum(d.tt,0,100); $imports.S.ttTier=d.ttTier||0; }
  },
  { /* 考试模式 */
    save:function(d){ d.exam=!!$imports.S.exam; d.examCur=$imports.S.examCur; d.examSeat=$imports.S.examSeat||0; d.examTot=$imports.S.examTot||0; },
    load:function(d){ $imports.S.exam=!!d.exam; $imports.S.examCur=(d.examCur===undefined)?null:d.examCur; $imports.S.examSeat=d.examSeat||0; $imports.S.examTot=d.examTot||0; }
  },
  { /* 背包、快捷栏、天赋、搜过的地方、线索、坐着没有 */
    save:function(d){ d.bag=$imports.S.bag; d.hot=$imports.S.hot; d.talent=$imports.Talent.id(); d.talentState=$imports.Talent.serialize(); d.spots=$imports.S.spots; d.clues=$imports.S.clues; d.seated=$imports.S.seated;d.seat=$imports.S.seat; },
    load:function(d){
      $imports.S.bag=d.bag||[]; $imports.S.hot=d.hot||[null,null];
      $imports.Talent.normalizeSaved(d); $imports.S.spots=d.spots||{}; $imports.S.clues=d.clues||{};       /* 天赋 ID 校验与迁移：未知 / 缺失 → 没有天赋，不沿用读档前的值 */
      $imports.S.seated=!!d.seated;$imports.S.seat=null;
      var R=$imports.INTERIORS[$imports.S.room],own=$imports.ClassroomLayout.ownSeat;
      if($imports.S.seated&&$imports.ClassroomLayout.valid(d.seat,R)&&Math.hypot($imports.S.x-$imports.ClassroomLayout.anchor(R,d.seat).x,$imports.S.y-$imports.ClassroomLayout.anchor(R,d.seat).y)<=1.5)$imports.S.seat=$imports.ClassroomLayout.seat(R.id,d.seat.col,d.seat.row);
      else if($imports.S.seated&&$imports.S.room===own.room&&R){var p=$imports.ClassroomLayout.anchor(R,own);if(Math.hypot($imports.S.x-p.x,$imports.S.y-p.y)<=1.5)$imports.S.seat=$imports.ClassroomLayout.seat(R.id,own.col,own.row);}
      if(!$imports.S.seat)$imports.S.seated=false;
    }
  },
  { /* 老存档的同化选择已取消：保留同化值，首个有效更新按满值结果结算。 */
    save:function(d){ d.hiddenAsked=false; d.hiddenLatch=false; d.hiddenWindow=0; },
    load:function(){ $imports.S.hiddenLatch=false;$imports.S.hiddenAsked=false;$imports.S.hiddenWindow=0; }
  },
  { /* 假正常 */
    save:function(d){ d.fn=$imports.S.fn; },
    load:function(d){ if(d.fn) $imports.S.fn=Object.assign({v:0,on:false,note:false,n:0,next:0,shown:false},d.fn); }
  },
  { /* 剧情标志、手里用着的东西、开着的门 */
    save:function(d){ d.rt=$imports.RT; d.use=$imports.USE; d.openDoors=$imports.OPENDOORS; },
    load:function(d){
      if(d.rt){$imports.RT=Object.assign((0,$imports.newRT)(),d.rt);$imports.RT.dayRhythmVersion=d.rt.dayRhythmVersion||0;}
      $imports.DayEvents.afterLoad(d);                                  /* 旧存档：读进来的那天不补特殊日 */
      if(d.use) $imports.USE=d.use;
      (0,$imports.normalizeUseState)();
      if(d.openDoors) $imports.OPENDOORS=d.openDoors;
    }
  },
  { /* 异象：正在发生的那一个、节奏、预报、冷却；没答完的选择读档后重新问，剩下的时间接着算 */
    save:function(d){
      d.anRained=$imports.AN.rained; d.anCool=$imports.AN.cool;
      d.anId=$imports.AN.id; d.anT=$imports.AN.t; d.anAcc=$imports.AN.acc;
      d.anData=(function(){ try{ return JSON.parse(JSON.stringify($imports.AN.data||{})); }catch(e){ return {}; } })();
      d.anNext=$imports.AN.next; d.anLastBig=$imports.AN.lastBig; d.anPre=$imports.AN.pre; d.anPreNext=$imports.AN.preNext;
      d.anLocked=!!$imports.AN.locked; d.anLockWait=$imports.AN.lockWait||0;
      d.anChoiceMs=($imports.AN.active&&$imports.UI.chooseOpen&&$imports.UI.choiceTimer)?Math.max(0,$imports.UI.choiceDeadline-performance.now()):null;
    },
    load:function(d){
      $imports.AN.id=d.anId||null; $imports.AN.t=d.anT||0; $imports.AN.acc=d.anAcc||0;
      $imports.AN.data=(d.anData&&typeof d.anData==='object')?d.anData:{};
      $imports.AN.next=(typeof d.anNext==='number')?d.anNext:45;
      $imports.AN.rained=!!d.anRained; $imports.AN.cool=d.anCool||{};
      $imports.AN.pre=d.anPre||null; $imports.AN.preNext=d.anPreNext||0; $imports.AN.locked=!!d.anLocked; $imports.AN.lockWait=d.anLockWait||0;
      $imports.AN.lastBig=!!d.anLastBig; $imports.AN.active=!!d.anId;
      if($imports.AN.active&&$imports.AN.data.asked&&$imports.AN.data.chosen===null&&['turn','hand','repeat','cold'].indexOf($imports.AN.id)>=0){
        $imports.AN.data.asked=false;
        if(Number.isFinite(d.anChoiceMs)) $imports.AN.data.choiceRemaining=d.anChoiceMs;
      }
      $imports.AN.sub=0;
    }
  },
  { /* 躲藏与被发现状态跟随巡察存档；缺少此字段的旧档仍按未躲藏恢复。 */
    save:function(d){d.hiding=$imports.HIDE.on?{c:$imports.HIDE.c,r:$imports.HIDE.r,seen:$imports.HIDE.seen,t:$imports.HIDE.t}:null;},
    load:function(d){
      var h=d.hiding,R=$imports.S.mode==='in'&&$imports.INTERIORS[$imports.S.room];
      $imports.HIDE.on=!!(h&&R&&Number.isInteger(h.c)&&Number.isInteger(h.r)&&R.grid[h.r]&&R.grid[h.r][h.c]==='H');
      if($imports.HIDE.on){$imports.HIDE.c=h.c;$imports.HIDE.r=h.r;$imports.HIDE.seen=!!h.seen;$imports.HIDE.t=saveNum(h.t,0,1e8);}
    }
  },
  { /* 车库里那个东西（只在车库里存）；钟楼旋梯上的位置（进房间时由 enterRoom 读） */
    save:function(d){
      d.roam=($imports.S.mode==='in'&&$imports.S.room==='garage1')?Object.assign({},$imports.ROAM):null;
      d.spiral=(0,$imports.spiralHere)()?{state:$imports.SP.state,a:$imports.SP.a,th:$imports.SP.th}:null;
    },
    load:function(d){ if($imports.S.mode==='in'&&$imports.S.room==='garage1'&&d.roam&&typeof d.roam==='object') Object.assign($imports.ROAM,d.roam); }
  },
  { /* 模块和 Mod 的状态：各自登记（GameModules.persistent / Mod 的 persist），按 id 存在 d.mods 里 */
    save:function(d){ d.mods=GameModules.saveAll(); },
    load:function(d){ GameModules.loadAll(d.mods); }
  }
];
/* 速通用单独的存档槽，不覆盖、不删除普通模式的「继续上次」 */
/* 独立普通槽（规则怪谈计划第 4.1、15.2 节）：主存档是规则怪谈局、而这次 DLC 没加载（关掉了或 ?nomod）时，
   新开的普通局写进 wdfz3d_plain，规则存档原样留着；不能在 DLC 关着的时候读规则存档接着玩。 */
var SAVE_PLAIN=false;
var SaveSlots={
  MAIN:'wdfz3d', PLAIN:'wdfz3d_plain',
  usePlain:function(on){ SAVE_PLAIN=!!on; },
  plain:function(){ return SAVE_PLAIN; },
  peek:function(key){ try{ var r=GameStorage.read(key); return r.ok&&r.value?prepareSave(JSON.parse(r.value)):null; }catch(e){ return null; } },
  isRules:function(d){ return !!(d&&d.rt&&d.rt.rulesMode&&d.rt.rulesMode.v); },
  rulesLoaded:function(){ try{ return GameModules.mods().some(function(m){ return m.id==='campus-rules'&&m.status==='active'; }); }catch(e){ return false; } },
  /* 主存档是规则局，而规则怪谈没加载：读主存档要先问一下 */
  mainLocked:function(){ return !SaveSlots.rulesLoaded()&&SaveSlots.isRules(SaveSlots.peek(SaveSlots.MAIN)); }
};
function saveSlot(){
  if(typeof $imports.RUN_MODE!=='undefined'&&$imports.RUN_MODE==='speedrun') return 'wdfz3d_speedrun_slot';
  return SAVE_PLAIN?SaveSlots.PLAIN:SaveSlots.MAIN;
}
function saveGame(){
  try{
    $imports.CampusPressure.observe();
    var d={v:1, clockVersion:2};
    SAVE_SCHEMA.forEach(function(f){ f.save(d); });
    return GameStorage.write(saveSlot(),JSON.stringify(prepareSave(d)));   /* 速通写自己的存档槽 */
  }catch(e){ saveReport('save',e);return false; }
}
/* 把存档里的数据写回游戏状态（调用前先 freshState） */
function applySave(d){
  d=prepareSave(d);                         /* 校验和迁移先完成，再改当前会话；不修改调用者的数据 */
  SAVE_SCHEMA.forEach(function(f){ f.load(d); });
  $imports.Investigation.migrate();
  $imports.SchoolDay.restore();
  $imports.Mechanics.migrate(d);
  $imports.CampusPressure.restore();
  $imports.StairWorld.restore(d);
  migrateSchoolLayout(d);
  try{ $imports.Elevator.fixCabinPosition(); }catch(e){}          /* 旧存档站在旧轿厢外围的：放回现在的轿厢正中 */
  return d;
}
/* 规则恢复之后由应用流程调用；applySave 本身不构建模型、操纵 DOM 或设置灯光。 */
function restoreSavePresentation(){
  if(typeof $imports.Sensory!=='undefined')$imports.Sensory.reset();
  var el=document.getElementById('hideslits');if(el)el.style.display=$imports.HIDE.on?'block':'none';
  $imports.VisualState.patrolRed=$imports.PatrolWorld.localChase()?1:0;
  $imports.Engine.torch($imports.USE.torch);
}
function loadGame(){
  try{
    var result=GameStorage.read(saveSlot());
    if(!result.ok||!result.value)return null;
    return prepareSave(JSON.parse(result.value));
  }catch(e){ saveReport('load',e);return null; }
}

/* 以前只有暂停菜单里能手动存档，死了、结局了存档也还在：「梦魇」可以读档重来。
   现在进出房间、预知梦醒来时自动存；死透了或者打出结局就删档。 */
function autoSave(){
  if($imports.S.screen==='play'&&!$imports.S.dead) saveGame();
}
function clearSave(){
  GameStorage.remove(saveSlot());
}
/* 拿到过的结局单独记，不跟存档一起删 */
var ENDS_KEY='wdfz3d_ends';
function endsSeen(){
  try{ var result=GameStorage.read(ENDS_KEY),d=JSON.parse(result.value||'{}'); return $imports.SaveData.record(d)?d:{}; }catch(e){ saveReport('read-endings',e);return {}; }
}
function endMark(id){
  var d=endsSeen(); d[id]=1;
  GameStorage.write(ENDS_KEY,JSON.stringify(d));
}
function paintMenuSave(){
  var sc=document.getElementById('btncont');
  if(sc) sc.style.display=(loadGame()||SaveSlots.peek(SaveSlots.MAIN)||SaveSlots.peek(SaveSlots.PLAIN))?'block':'none';
  var el=document.getElementById('mends');
  if(!el) return;
  var seen=endsSeen(), ids=Object.keys($imports.ENDINGS), got=[];
  for(var i=0;i<ids.length;i++) if(seen[ids[i]]) got.push($imports.ENDINGS[ids[i]].t+($imports.ENDINGS[ids[i]].true?'（真）':$imports.ENDINGS[ids[i]].fake?'（假）':''));
  el.textContent=got.length?'已见结局 '+got.length+' / '+ids.length+'　'+got.join(' '):'公开真结局：闸门 · 白名单 · 门 · 网安仙人（未解锁）';
  el.style.display='block';
}

function migrateSchoolLayout(d){
  var L=$imports.ClassroomLayout;
  if((d.layoutVersion||0)>=L.version)return;
  /* 教室门：走廊那面墙（第 rows[1]+1 行）上记着开着、但现在已经不是门的格子（布局 1 的双开门、布局 2–3 的单门），
     换成最近的那扇新门开着 */
  var wallRow=L.rows[1]+1, doorCells=[];
  for(var di=0;di<L.spans.length;di++)L.doors(di).forEach(function(p){doorCells.push(p);});
  for(var f=1;f<=5;f++){
    var TR=$imports.INTERIORS['teach'+f];
    Object.keys($imports.OPENDOORS).forEach(function(k){
      var m=/^teach[1-5]:(\d+):(\d+)$/.exec(k);
      if(!m||k.indexOf(TR.id+':')!==0||+m[2]!==wallRow)return;
      var col=+m[1];
      if(TR.grid[wallRow]&&TR.grid[wallRow][col]==='=')return;
      delete $imports.OPENDOORS[k];
      var best=null;
      doorCells.forEach(function(p){ if(!best||Math.abs(p[0]-col)<Math.abs(best[0]-col))best=p; });
      if(best&&Math.abs(best[0]-col)<=6)$imports.OPENDOORS[(0,$imports.doorKeyAt)(TR,best[0],best[1])]=1;
    });
  }
  /* 旧档坐在旧本人座位上的：坐到新教室里的本人座位 */
  var own=L.ownSeat;
  if(d.seated&&d.seat&&L.legacyOwnSeats.indexOf(d.seat.seatId)>=0&&$imports.S.mode==='in'&&$imports.S.room===own.room&&!$imports.HIDE.on){
    var OR=$imports.INTERIORS[own.room],a=L.anchor(OR,own);
    $imports.S.x=a.x;$imports.S.y=a.y;$imports.S.seated=true;$imports.S.seat=L.seat(own.room,own.col,own.row);
    saveReport('layout','旧本人座位已换成新教室里的本人座位');
  }
  var room=$imports.S.mode==='in'&&$imports.INTERIORS[$imports.S.room];
  if(room&&!room.stairwell&&!$imports.S.seated&&!$imports.HIDE.on){
    $imports.SpaceLayout.ensureRoom(room);
    if($imports.Collision.depth($imports.S.x,$imports.S.y,$imports.PRAD)>1e-7){
      var oldCol=Math.floor(($imports.S.x-room.ox)/room.tw),oldRow=Math.floor(($imports.S.y-room.oy)/room.th);
      var cls=/^teach[1-5]$/.test(room.id)?$imports.ClassroomLayout.classAt(oldCol,oldRow):-1,spots=[];
      for(var r=1;r<room.rows-1;r++)for(var c=1;c<room.cols-1;c++){
        if(room.grid[r][c]!=='.'||(cls>=0&&$imports.ClassroomLayout.classAt(c,r)!==cls))continue;
        var x=room.ox+(c+.5)*room.tw,y=room.oy+(r+.5)*room.th;
        if($imports.Collision.depth(x,y,$imports.PRAD)<1e-7)spots.push({x:x,y:y,d:Math.hypot(x-$imports.S.x,y-$imports.S.y)});
      }
      spots.sort(function(a,b){return a.d-b.d||a.y-b.y||a.x-b.x;});
      if(spots.length){$imports.S.x=spots[0].x;$imports.S.y=spots[0].y;saveReport('layout','旧场景落点已移到附近可站立区域');}
    }
  }
  var current=$imports.RT.inspection&&$imports.RT.inspection.current;
  if(current&&!current.result){current.excused=(0,$imports.onLeave)();current.compliant=!current.excused&&(0,$imports.atMySeat)();current.result=current.excused?'excused':current.compliant?'present':'absent';if(current.excused)current.points=[];}
}

/* @module-exports */
GameModules.publish("game3d/js/save.js",{
"saveNum":{get:function(){return saveNum;},set:function($value){saveNum=$value;}},
"saveObj":{get:function(){return saveObj;},set:function($value){saveObj=$value;}},
"SAVE_DIAGNOSTIC":{get:function(){return SAVE_DIAGNOSTIC;},set:function($value){SAVE_DIAGNOSTIC=$value;}},
"saveReport":{get:function(){return saveReport;},set:function($value){saveReport=$value;}},
"GameStorage":{get:function(){return GameStorage;},set:function($value){GameStorage=$value;}},
"prepareSave":{get:function(){return prepareSave;},set:function($value){prepareSave=$value;}},
"SAVE_SCHEMA":{get:function(){return SAVE_SCHEMA;},set:function($value){SAVE_SCHEMA=$value;}},
"SAVE_PLAIN":{get:function(){return SAVE_PLAIN;},set:function($value){SAVE_PLAIN=$value;}},
"SaveSlots":{get:function(){return SaveSlots;},set:function($value){SaveSlots=$value;}},
"saveSlot":{get:function(){return saveSlot;},set:function($value){saveSlot=$value;}},
"saveGame":{get:function(){return saveGame;},set:function($value){saveGame=$value;}},
"applySave":{get:function(){return applySave;},set:function($value){applySave=$value;}},
"restoreSavePresentation":{get:function(){return restoreSavePresentation;},set:function($value){restoreSavePresentation=$value;}},
"loadGame":{get:function(){return loadGame;},set:function($value){loadGame=$value;}},
"autoSave":{get:function(){return autoSave;},set:function($value){autoSave=$value;}},
"clearSave":{get:function(){return clearSave;},set:function($value){clearSave=$value;}},
"ENDS_KEY":{get:function(){return ENDS_KEY;},set:function($value){ENDS_KEY=$value;}},
"endsSeen":{get:function(){return endsSeen;},set:function($value){endsSeen=$value;}},
"endMark":{get:function(){return endMark;},set:function($value){endMark=$value;}},
"paintMenuSave":{get:function(){return paintMenuSave;},set:function($value){paintMenuSave=$value;}},
"migrateSchoolLayout":{get:function(){return migrateSchoolLayout;},set:function($value){migrateSchoolLayout=$value;}}
});
})(GameModules.imports("game3d/js/save.js"));
