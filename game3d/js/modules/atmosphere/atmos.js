/* @module-capsule */
(function($imports){
/* 里世界 3D · 全局氛围 A1–A7（计划《电梯直通、新天赋、新结局与恐怖氛围》第 7 节）
   没有事件发生的时候，整所学校也让人不安。全部是氛围：不扣数值、不致死、不改异象、巡察者、检查、课表和任何隐藏触发的判定；
   不进攻略（Wiki 不写，第 8 节对照表）。判定和状态在这里，画面在 atmos-fx.js（只读这里）。
   · A1 太安静了：白天的校园底噪（远处的车、鸟、操场的哨声）从第二天起一样一样消失；
       异象到来前 6–3.3 秒有一半的时候先整片安静几秒（字幕「周围突然安静了」）。
   · A2 灯的层次：每层走廊有一段灯管坏掉的暗区，只剩应急指示牌的绿光（atmos-fx.js；固定，读档一致）。
   · A3 同学的注视：第二天起，走进一间坐着同学的教室，偶尔所有人一起转头看你，再一起转回去；
       离开以后再回来，空座位多了一个。每间教室一天最多一次、全校一天最多 3 次，按「天 + 教室」定，读档不刷。
   · A4 窗外：教室的窗外（教学楼走廊外墙不开窗）偶尔远远站着一个一动不动的人影，看第二眼就不见了。
   · A5 铃声走调：第二天起下课铃整体低下去（第二天半个半音，第三天起一个半音），熄灯前那一遍更低、更慢。
   · A6 物件错位：走廊里的拖把和水桶在你没看着、离你 8 米外时换了位置；被巡察者碰歪的顺着走廊方向，没来由的转过来对着你。
   · A7 天色与色调：第二天起傍晚提前、整体更冷更暗一点。
   A3、A4、A6 都过现有的惊吓预算（Dread.allow / Dread.note），同一区域有冷却；检查、异象、假正常、演出时不出现。 */
'use strict';

var ATMOS_CFG={
  hushLead:[3.3,6], hushChance:0.5, hushSec:3.4,                 /* A1：异象前的空白段 */
  campusGap:[16,38],                                             /* A1：白天底噪的间隔（真实秒） */
  stareChance:0.45, stareMax:3, stareTurn:0.6, stareHold:1.5,    /* A3 */
  windowChance:0.35, windowMin:[24,38],                          /* A4：每次进走廊抽一次；距离（米） */
  shiftMin:8, shiftChance:0.6,                                   /* A6 */
  bellDrop:[0,0.5,1], nightBellDrop:1.6, nightBellAt:1320        /* A5：半音；熄灯前（22:00 起）那一遍 */
};
var Atmos=(function(){
  var C=ATMOS_CFG, own={owner:'atmosphere'};
  var A={campusT:12,hushFor:null,hush:0,stare:null,window:null,lastCls:null,lastWin:null};
  function st(){ if(!$imports.RT.atmos||typeof $imports.RT.atmos!=='object') $imports.RT.atmos={stares:{},shift:{},seats:{},said:{}}; var a=$imports.RT.atmos;
    ['stares','shift','seats','said'].forEach(function(k){ if(!a[k]||typeof a[k]!=='object') a[k]={}; }); return a; }
  function hash(s){ return (0,$imports.lhashStr)(String(s)+':'+(typeof $imports.Mechanics!=='undefined'?$imports.Mechanics.runSeed:'')); }
  function busy(){
    if((0,$imports.dreadBusy)()||$imports.DREAD.slice) return true;
    if(typeof $imports.Broadcast!=='undefined'&&($imports.Broadcast.reading().held||$imports.Broadcast.state().phase==='bell'))return true;
    if($imports.AN.active) return true;
    if(typeof $imports.Inspection!=='undefined'&&$imports.Inspection.pending()) return true;
    if(typeof $imports.FN_P!=='undefined'&&$imports.FN_P.grp) return true;                  /* 假正常进行时 */
    return false;
  }
  function floorRoom(){ var R=$imports.S.mode==='in'?$imports.INTERIORS[$imports.S.room]:null; return R&&(R.host==='teach'||R.host==='lab')&&R.floor>=1&&R.floor<=5&&!R.stairwell?R:null; }
  /* 当前所在格：教学楼的教室按列分成四间（直接用 ClassroomLayout 的分法） */
  function cell(R){ return {c:Math.floor(($imports.S.x-R.ox)/R.tw), r:Math.floor(($imports.S.y-R.oy)/R.th)}; }
  function classAt(R,c,r){
    if(!R||R.host!=='teach') return null;
    var row=R.grid[r]; if(!row) return null;
    var ch=row[c]; if(ch==='#'||ch==='='||ch===undefined) return null;
    /* 门格那一排（=）以上是教室 */
    /* 按 ClassroomLayout 的教室列范围认（以前数「被 # 隔开的列段」：教学楼二楼西头为连廊②打通的过道被当成了第 0 间，后面全错一位） */
    var k=$imports.ClassroomLayout.classAt(c,r);
    return k>=0?R.id+':'+k:null;
  }
  function inCorridor(R){
    var p=cell(R), doorRow=-1;
    for(var y=0;y<R.rows;y++){ if(R.grid[y].indexOf('=')>=0){ doorRow=y; } }
    return doorRow>=0&&p.r>doorRow;
  }

  /* ---------- A1 ---------- */
  var CAMPUS=['whistle','car','bird'];                             /* 第二天少哨声，第三天少车，第四天起只剩偶尔的鸟 */
  function campusKinds(){ var d=Math.max(1,$imports.S.day|0); return CAMPUS.slice(Math.min(2,d-1)); }
  function campusTick(dt){
    if(A.hush>0||$imports.AN.active||busy()||$imports.S.tsec<420||$imports.S.tsec>=1080) return;                            /* 白天才有 */
    A.campusT-=dt; if(A.campusT>0) return;
    A.campusT=C.campusGap[0]+$imports.PresentationRandom.next()*(C.campusGap[1]-C.campusGap[0]);
    var kinds=campusKinds(); if(!kinds.length) return;
    if($imports.S.day>=4&&$imports.PresentationRandom.next()<0.6) return;             /* 第四天起：偶尔一声鸟，大多数时候什么都没有 */
    var k=kinds[Math.floor($imports.PresentationRandom.next()*kinds.length)], indoor=$imports.S.mode==='in';
    try{ $imports.SoundPlayer.play('campus.'+k,{pan:$imports.PresentationRandom.range(-0.8,0.8),k:indoor?0.45:0.85,lp:indoor?0.35:1}); }catch(e){}
  }
  function hushTick(){
    if(!$imports.AN.active&&$imports.AN.next>0&&$imports.AN.next<=3&&A.preFor!==$imports.AN.next0&&!busy()){A.preFor=$imports.AN.next0;A.hush=3;$imports.SFX.duck(3);$imports.SoundCaptions.publish('world.silence',{source:'atmos-pre'});}
    if($imports.S.day<2||$imports.AN.active||!($imports.AN.next>0)) return;
    if($imports.AN.next>C.hushLead[1]||$imports.AN.next<C.hushLead[0]||A.hushFor===$imports.AN.next0) return;
    A.hushFor=$imports.AN.next0;
    if(busy()||hash('hush:'+$imports.S.day+':'+$imports.AN.next0)>=C.hushChance) return;
    A.hush=C.hushSec;
    try{ $imports.SFX.duck(C.hushSec); }catch(e){}
    try{ $imports.SoundCaptions.publish('world.silence',{source:'atmos-hush'}); }catch(e){}
    $imports.Dread.note('hush',0);
  }

  /* ---------- A3 ---------- */
  function stareTick(dt){
    var R=floorRoom(); if(!R||R.host!=='teach'){ A.lastCls=null; return; }
    var p=cell(R), cls=classAt(R,p.c,p.r), a=st();
    if(cls===A.lastCls) return;
    var prev=A.lastCls; A.lastCls=cls;
    if(!cls) return;
    if($imports.S.day<2||($imports.S.viol||0)>=35||busy())return;
    var key=$imports.S.day+':'+cls,today=Object.keys(a.stares).filter(function(k){return k.indexOf($imports.S.day+':')===0&&a.stares[k]>0;}).length;
    if(a.stares[key]>0||today>=C.stareMax)return;
    /* A return can change one other seat. It consumes the same daily and regional budget as turning. */
    if(a.left&&a.left[cls]===$imports.S.day&&hash('seat:'+key)<.35){
      if(!$imports.Dread.allow(1))return;
      a.seats[key]=1+Math.floor(hash('seatN:'+key)*7);a.stares[key]=2;
      $imports.Dread.note('vacancy',1,{cls:cls});clearRevisit();return;
    }
    if(a.stares[key]===0)return;
    if(hash('stare:'+key)>=C.stareChance){a.stares[key]=0;return;}
    var ci=+cls.split(':')[1],span=$imports.ClassroomLayout.spans[ci];
    if(!span)return;
    var x=R.ox+(span[0]+5)*R.tw,y=R.oy+11*R.th;
    if(Math.cos(Math.atan2(y-$imports.S.y,x-$imports.S.x)-$imports.S.ang)<.15)return;
    if(!$imports.Dread.allow(1))return;
    a.stares[key]=1;A.stare={cls:cls,room:R.id,t:0};
    $imports.Dread.note('stare',1,{cls:cls});clearRevisit();
    $imports.SFX.dread('chair',{pan:0,k:.45,caption:'椅子一起轻响了一声'});
  }
  function clearRevisit(){
    $imports.DREAD.visitFx=null;$imports.DREAD.echo=false;$imports.DREAD.leftAt=0;
    if(typeof $imports.DreadFx!=='undefined')$imports.DreadFx.clear();
  }

  /* 离开教室时记一下：下次回来时才可能少一个人 */
  function leftTick(){
    var a=st(); if(!a.left) a.left={};
    var R=floorRoom(); if(!R) return;
    var p=cell(R), cls=classAt(R,p.c,p.r);
    if(A.inCls&&A.inCls!==cls) a.left[A.inCls]=$imports.S.day;
    A.inCls=cls;
  }

  /* ---------- A4：教室北墙窗外，远处站着一个人（教学楼走廊外墙是宣传栏、不开窗，所以放在教室的窗外） ---------- */
  function windowTick(){
    var R=floorRoom(); if(!R||R.host!=='teach'){ A.lastWin=null; return; }
    var p=cell(R), cls=classAt(R,p.c,p.r);
    if(cls===A.lastWin) return;
    A.lastWin=cls; if(!cls) return;
    if(A.window&&A.window.cls===cls) return;
    if(A.stare||$imports.S.tsec<420||busy()||(0,$imports.gameAge)()<90) return;
    var visit=($imports.RT.visits&&$imports.RT.visits[$imports.S.day+':'+R.id])||1;
    if(hash('win:'+$imports.S.day+':'+cls+':'+visit)>=C.windowChance||!$imports.Dread.allow(1)) return;
    var target=(0,$imports.objWorld)((0,$imports.objById)('lab'));
    A.window={room:R.id,cls:cls,seed:hash('winP:'+$imports.S.day+':'+cls+':'+visit),seen:0,gone:false,anchor:{x:target.x+target.w*.5,y:target.y+target.h*.5,height:16.2}};
    $imports.Dread.note('window',1);
  }

  /* ---------- A6 ---------- */
  function shiftTick(){
    var R=floorRoom(); if(!R||$imports.S.day<2) return;
    var a=st(), key=$imports.S.day+':'+R.id;
    if(a.shift[key]!==undefined) return;
    if(typeof $imports.AtmosFx==='undefined'||!$imports.AtmosFx.canShift(C.shiftMin)) return;
    if(busy()) return;
    if(hash('shift:'+key)>=C.shiftChance){ a.shift[key]=0; return; }
    if(!$imports.Dread.allow(1)) return;
    /* 巡察者最近从这一层走过（它在这一层、或刚离开不久）：顺着走廊被推开；否则转过来对着你 */
    var patrol=A.patSeen&&A.patSeen.room===R.id&&(0,$imports.gameAge)()-A.patSeen.t<8;
    if(!a.shiftPose)a.shiftPose={};
    var spot=$imports.AtmosFx.propWorld(),dx=patrol?A.patSeen.dx:$imports.S.x-spot.x,dy=patrol?A.patSeen.dy:$imports.S.y-spot.y,len=Math.hypot(dx,dy)||1;
    a.shiftPose[key]={dx:dx/len,dy:dy/len,angle:Math.atan2(dx,dy)};
    a.shift[key]=patrol?'push':'face';
    $imports.Dread.note('shift',1,{kind:a.shift[key]});
    if(hash('shiftS:'+key)<0.5){
      try{ $imports.SFX.dread('chair',{pan:0,k:0.3,caption:'身后 · 拖动的声音'}); }catch(e){}
    }
    A.shiftNew=key;
  }
  function shiftNotice(){
    var a=st();
    if(!A.shiftNew||a.said.shift) return;
    if(typeof $imports.AtmosFx!=='undefined'&&$imports.AtmosFx.seesShifted()){
      a.said.shift=1; A.shiftNew=null;
      (0,$imports.os)('我：……拖把刚才不在这儿吧？',3.2);
    }
  }

  function tick(dt){
    if(!(dt>0)||$imports.S.screen!=='play'||$imports.S.dead) return;
    if(A.hush>0) A.hush=Math.max(0,A.hush-dt);
    var old=A.patLast,spot=typeof $imports.AtmosFx!=='undefined'?$imports.AtmosFx.propWorld():null;
    if(old&&spot&&$imports.PAT.state==='walk'&&$imports.PAT.room===$imports.S.room&&old.room===$imports.PAT.room&&Math.hypot($imports.PAT.x-spot.x,$imports.PAT.y-spot.y)<18){
      var dx=$imports.PAT.x-old.x,dy=$imports.PAT.y-old.y;if(Math.hypot(dx,dy)>.001)A.patSeen={room:$imports.PAT.room,t:(0,$imports.gameAge)(),dx:dx,dy:dy};
    }
    A.patLast={room:$imports.PAT.room,x:$imports.PAT.x,y:$imports.PAT.y};
    if(A.stare){A.stare.t+=dt;if(busy()||A.stare.room!==$imports.S.room||($imports.S.viol||0)>=35||A.stare.t>=2*C.stareTurn+C.stareHold)A.stare=null;}
    if(A.window&&!A.window.gone){if(busy())A.window=null;else if(A.windowLook)A.window.seen+=dt;else if(A.window.seen>=.8)A.window.gone=true;}
    campusTick(dt);hushTick(); leftTick(); stareTick(dt); windowTick(); shiftTick(); shiftNotice();
  }

  /* ---------- A5：铃声 ---------- */
  function bellTune(kind){
    if(kind==='start') return undefined;
    var d=Math.max(1,$imports.S.day|0), semi=C.bellDrop[Math.min(C.bellDrop.length-1,d-1)];
    var night=$imports.S.tsec>=C.nightBellAt, rate=1;
    if(night&&d>=2){ semi+=C.nightBellDrop; rate=0.9; }
    if(!(semi>0)) return undefined;
    return {tail:Math.pow(2,-semi/12),tailLength:night&&d>=2?1.8:1,caption:night?'下课铃，拖得很长，最后一个音沉了下去':'下课铃，最后一个音低了一点'};
  }

  /* ---------- A7：天色 ---------- */
  function light(st2){
    if($imports.S.screen!=='play'||$imports.VisualState.stageHour!==null||$imports.S.room==='lift_dream'||$imports.S.room==='portal_tunnel')return;
    var h=(($imports.S.tsec%1440)+1440)%1440/60, k=Math.min(1,($imports.S.day-1)/2);
    var dusk=k*0.35*smooth(15.5,18,h)*(1-smooth(19.5,20.5,h));        /* 傍晚提前：下午三点半起就暗下去 */
    st2.day=Math.max(0,st2.day*(1-dusk));
    var cold=1-0.07*k;                                                  /* 整体更冷、更暗一点 */
    st2.amb*=cold*(1-.4*dusk);st2.hemi*=cold*(1-.4*dusk);
    var warm=.10*smooth(15,17,h)*(1-smooth(17.5,19,h)),cool=(.04*k+.10*smooth(17.5,21,h));
    st2.atmosTint=[1+warm-cool,1-cool*.2,1-warm+cool];
    st2.atmosFog=1+.10*smooth(16,22,h)+k*.07;
  }
  function smooth(a,b,x){ var t=(0,$imports.clamp)((x-a)/(b-a),0,1); return t*t*(3-2*t); }

  GameModules.on('tick',tick,own);
  GameModules.on('bellTune',bellTune,own);
  GameModules.on('lightState',light,own);
  GameModules.on('enterRoom',function(){ A.lastCls=null; A.lastWin=null; A.inCls=null; if(A.window&&(!$imports.S.room||A.window.room!==$imports.S.room)) A.window=null; },own);
  GameModules.on('boundary',function(){ A.stare=null; A.window=null; A.hush=0; A.hushFor=null;A.preFor=null; A.lastCls=null; A.lastWin=null; A.inCls=null; A.shiftNew=null;A.patSeen=null;A.patLast=null; },own);
  GameModules.on('reset',function(){ A.campusT=12; A.stare=null; A.window=null; A.hush=0; A.hushFor=null;A.preFor=null; A.lastCls=null; A.lastWin=null; A.inCls=null; A.shiftNew=null;A.patSeen=null;A.patLast=null; },own);

  /* 表现层只读：没有记录时给一份空的，不往 RT 里写 */
  var EMPTY={stares:{},shift:{},seats:{},said:{},shiftPose:{}};
  function peek(){ var a=$imports.RT.atmos; return a&&typeof a==='object'?{stares:a.stares||{},shift:a.shift||{},seats:a.seats||{},said:a.said||{},shiftPose:a.shiftPose||{}}:EMPTY; }
  return {A:A,observeWindow:function(looking){A.windowLook=!!looking;},cfg:C, state:st, peek:peek, hash:hash, classAt:classAt, inCorridor:inCorridor, campusKinds:campusKinds, bellTune:bellTune, busy:busy, floorRoom:floorRoom};
})();

/* @module-exports */
GameModules.publish("game3d/js/modules/atmosphere/atmos.js",{
"ATMOS_CFG":{get:function(){return ATMOS_CFG;},set:function($value){ATMOS_CFG=$value;}},
"Atmos":{get:function(){return Atmos;},set:function($value){Atmos=$value;}}
});
})(GameModules.imports("game3d/js/modules/atmosphere/atmos.js"));
