/* @module-capsule */
(function($imports){
/* 里世界 3D · 课表规则、SAN、违规、危险区、车库里的东西 */
'use strict';
$imports.PlayerStats.bind(function(){return $imports.S;});
/* 稳定的日历命令入口；原函数名保留给尚未迁移的调用者。 */
var GameTime={now:gameClock,advance:advanceGameTime,rewind:rewindGameTime,tick:clockTick};

function inClassroomHere(){
  if($imports.S.mode!=='in') return false;
  var R=$imports.INTERIORS[$imports.S.room];
  if(!R||R.stairwell||R.host!=='teach') return false;
  if(R.floor<1||R.floor>5) return false;
  var row=Math.floor(($imports.S.y-R.oy)/R.th), L=$imports.ClassroomLayout;   /* 教室占的行见 domain/classroom-layout.js */
  return row>=L.rows[0]&&row<=L.rows[1];
}
function inDorm(){
  if($imports.S.mode!=='in') return false;
  var R=$imports.INTERIORS[$imports.S.room];
  return !!R && (R.host==='dormN'||R.host==='dormS');
}
function onField(){
  if($imports.S.mode!=='out') return false;
  var mx=$imports.S.x/$imports.SC,my=$imports.S.y/$imports.SC;
  var ids=['field','court2','track','bad2','bad3'];
  for(var i=0;i<ids.length;i++){
    var o=(0,$imports.objById)(ids[i]);
    if(o&&mx>o.x-6&&mx<o.x+o.w+6&&my>o.y-6&&my<o.y+o.h+6) return true;
  }
  return false;
}
function currentPlaceName(){
  if($imports.S.mode==='out') return '武大附中 · 校园';
  var R=$imports.INTERIORS[$imports.S.room];
  if(R&&R.stairwell)return '武大附中 · '+R.name+' · '+(Math.floor($imports.S.floorY/$imports.StairWorld.config(R.id).rise)+1)+'F 附近';
  return R?('武大附中 · '+R.name):'武大附中';
}
function atMySeat(){
  return $imports.S.mode==='in'&&!$imports.S.dead&&$imports.ClassroomLayout.atOwn($imports.S,$imports.INTERIORS[$imports.S.room]);
}
function nearestSeat(){
  if($imports.S.mode!=='in') return null;
  var R=$imports.INTERIORS[$imports.S.room];
  if(!R||R.host!=='teach'||R.floor!==1) return null;
  var col=Math.floor(($imports.S.x-R.ox)/R.tw), row=Math.floor(($imports.S.y-R.oy)/R.th);
  if((0,$imports.tileAt)(R,$imports.S.x,$imports.S.y)==='P') return {col:col,row:row};
  if(row>0&&(0,$imports.tileAt)(R,R.ox+(col+0.5)*R.tw,R.oy+(row-1+0.5)*R.th)==='P') return {col:col,row:row-1};
  if(row<R.rows-1&&(0,$imports.tileAt)(R,R.ox+(col+0.5)*R.tw,R.oy+(row+1+0.5)*R.th)==='P') return {col:col,row:row+1};
  return null;
}

var VIO_ON=0;

/* ---------- 考试模式 ----------
   在钟楼顶上撞钟以后，当天剩下的所有"在教室"的时段（上课和晚自习）都变成考试，到熄灯为止：
     离开座位，违规涨得更快；异象只出教室里的那几种；
     一场考完，大部分时间坐着的，给一次 SAN。
   考试时能出的异象见 anomaly.js 注册表里的 exam（派生出 EXAM_AN）。 */
function examStart(){
  if((0,$imports.isNight)()){ (0,$imports.os)('我：钟声荡出去，很快就被夜吞掉了。整座学校都睡着，没有人回应。',4); return; }
  $imports.S.exam=true; $imports.S.examCur=null; $imports.S.examSeat=0; $imports.S.examTot=0;
  (0,$imports.gameFact)('exam',{phase:'start'});
  (0,$imports.os)('我：钟声一圈一圈荡开。过了很久，广播里有人慢慢地念：「今天剩下的课，全部改为考试。请回到自己的座位。」',6,$imports.OS_KEEP);
  (0,$imports.toast)('考试模式 · 今天剩下的课都是考试，熄灯后结束');
}
function examEnd(){ $imports.S.exam=false; $imports.S.examCur=null; $imports.S.examSeat=0; $imports.S.examTot=0; }
function examNow(){ return !!$imports.S.exam&&(0,$imports.needWhere)($imports.S.tsec)==='教室'; }
function examTick(dt){
  if(!$imports.S.exam) return;
  var p=(0,$imports.periodAt)($imports.S.tsec), cur=(p[3]==='教室')?p[0]:null;
  if(cur!==$imports.S.examCur){
    if($imports.S.examCur!==null&&$imports.S.examTot>4){                 /* 上一场结束：交卷 */
      (0,$imports.gameFact)('exam',{phase:'paper',pass:$imports.S.examSeat/$imports.S.examTot>=0.7,day:$imports.S.day});
      if($imports.S.examSeat/$imports.S.examTot>=0.7){ $imports.PlayerStats.changeSan(15,'systems',{max:100}); (0,$imports.os)('我：交卷了。监考的人从我桌上收走卷子，没有看我。……可我记得我写了什么。',4.4); (0,$imports.toast)('这一场考完了'); }
      else (0,$imports.os)('我：这一场我没坐住。收上去的卷子里，我那一张只有名字，名字被人画了一个圈。',4.4);
    }
    $imports.S.examCur=cur; $imports.S.examSeat=0; $imports.S.examTot=0;
    if(cur!==null) (0,$imports.os)($imports.S.seated?'我：铃响了。卷子发下来了，我那张的姓名栏里，已经有人替我写好了名字。':'我：铃响了。卷子已经发到了每个人桌上，包括我那张空着的位子。',3.6);
  }
  if(cur!==null){ $imports.S.examTot+=dt; if($imports.S.seated&&atMySeat()) $imports.S.examSeat+=dt; }
}
/* 日数沿用 22:30 切换，01:00 跳到同一日的 07:20。冷却使用连续的游戏分钟。 */
function gameClock(){
  return $imports.GameTimeRules.continuous($imports.S.day,$imports.S.tsec,$imports.LIGHTS_OUT);
}
function advanceGameTime(minutes){
  if(typeof $imports.CampusPressure!=='undefined')$imports.CampusPressure.observe();
  var remaining=$imports.GameTimeRules.amount(minutes);
  while(remaining>0){
    var slice=$imports.GameTimeRules.forwardSlice($imports.S.tsec,$imports.S.day,remaining,$imports.LIGHTS_OUT),before=slice.from,step=slice.used;
    $imports.S.tsec=slice.to; remaining=slice.remaining;
    if(typeof $imports.Inspection!=='undefined')$imports.Inspection.cross($imports.S.day,before,$imports.S.tsec);
    if($imports.S.day===1&&$imports.S.fn&&!$imports.S.fn.note&&$imports.S.tsec>=$imports.LIGHTS_OUT){
      $imports.S.fn.note=true;
      (0,$imports.os)('我：口袋里多了一张对折的纸。上面写着——灯前看字字如旧，月下认人人已非。　　　　　——笑时莫出声。',8);
    }
    if($imports.S.exam&&before<$imports.LIGHTS_OUT&&$imports.S.tsec>=$imports.LIGHTS_OUT){ examEnd(); (0,$imports.os)('我：熄灯了。今天的考试结束了。',3.4); }
    if(slice.day!==$imports.S.day){
      $imports.S.day=slice.day;
      (0,$imports.gameFact)('day',{day:$imports.S.day});
      if($imports.S.day===2){
        (0,$imports.os)('我：……今天几号来着？我想不起来了。',4);
        if($imports.S.fn&&$imports.S.fn.note&&!$imports.S.fn.on&&$imports.S.fn.n===0){
          $imports.S.fn.on=true; $imports.S.fn.v=0; $imports.S.fn.next=10; $imports.S.fn.used={}; $imports.S.fn.n=0; $imports.S.fn.left=4; $imports.S.fn.done=false;
          try{ (0,$imports.fadeTo)(function(){}); }catch(e){}
          $imports.Lifecycle.scope('session').timeout(function(){ (0,$imports.os)('我：第二天。所有东西都回到了原来的位置，颜色也回来了。',5.5); },1200);
          $imports.Lifecycle.scope('scene').timeout(function(){ (0,$imports.fnPeopleBuild)(); },1800);
        }
      }
    }
    if(slice.time!==$imports.S.tsec) $imports.S.tsec=slice.time;
    else if(step<=0) break;
  }
  if(typeof $imports.CampusPressure!=='undefined')$imports.CampusPressure.observe();
}
function rewindGameTime(minutes){
  if(typeof $imports.CampusPressure!=='undefined')$imports.CampusPressure.observe();
  var remaining=$imports.GameTimeRules.amount(minutes);
  while(remaining>0){
    var slice=$imports.GameTimeRules.backwardSlice($imports.S.tsec,$imports.S.day,remaining,$imports.LIGHTS_OUT);
    $imports.S.tsec=slice.to; $imports.S.day=slice.day; remaining=slice.remaining;
  }
}
/* 每个时段规定待在哪里（needWhere 的四种结果）：在不在该在的地方、SAN 每秒怎么变 */
var NEED_RULE={
  '教室':{
    there:function(){ return atMySeat(); },
    san:function(dt){ if(atMySeat()) $imports.PlayerStats.changeSan(0.42*dt,'systems'); }
  },
  '宿舍':{
    there:function(){ return inDorm(); },
    san:function(dt){ if(inDorm()) $imports.PlayerStats.changeSan(0.22*dt,'systems'); }
  },
  '操场':{
    there:function(){ return onField(); },
    san:function(dt){ if(onField()) $imports.PlayerStats.changeSan(0.5*dt,'systems'); }
  },
  '自由':{
    there:function(){ return true; },
    san:function(dt){ $imports.PlayerStats.changeSan(0.8*dt,'systems'); }
  }
};
/* 同化值每满 20 说一句 */
var TT_LINES=['我：最近睡得挺好。铃一响就醒，不用闹钟。醒的时候，我已经坐在位子上了。',
  '我：课表不用看了。我知道下一节是什么。我还知道下下节、下下下节。',
  '我：……今天几号来着？黑板右上角的日期，我从来没见它变过。',
  '我：走廊里的人走得真整齐。我低头看了一眼——我的脚也在跟着拍子。',
  '我：座位表上，我的名字在哪一格？……哪一格都是我的名字。',
  '我：我好像一直都在这里。在我转来之前，就在这里。'];
/* 坐着的时候越过 60、80：提醒落在椅子上——站起来就能缓下来 */
var TT_SEAT={3:'我：……今天几号来着？我想站起来看一眼黑板，椅子没让我起来。',
  4:'我：腿麻了。不对——是腿不想动。椅子贴着我的背，像是不想让我起来。'};
/* 跨时段时分段消耗真实秒；不能把整步时间按旧时速推进，尤其是 11:45 的慢速窗。 */
function clockTick(dt){
  var room=$imports.S.mode==='in'?$imports.INTERIORS[$imports.S.room]:null;
  if(room&&room.noClock)return;
  var left=$imports.GameTimeRules.amount(dt);
  while(left>1e-9){
    var t0=$imports.S.tsec, boundary=(0,$imports.clockBoundary)(t0);
    var slice=$imports.GameTimeRules.realTimeSlice(t0,left,boundary,(0,$imports.rateAt)(t0));
    advanceGameTime(slice.minutes);
    if(!slice.nudge)left-=slice.seconds;
  }
}
function sanityStage(value){return $imports.StatRules.sanityStage(value===undefined?$imports.S.san:value);}

function staminaMax(){return $imports.PlayerStats.staminaMax();}
function capStamina(){$imports.PlayerStats.capStamina();}
function restoreStamina(amount){$imports.PlayerStats.restoreStamina(amount);}
function settleSan(){
  $imports.PlayerStats.settle();
  if($imports.S.san<=0&&!$imports.S.dead){(0,$imports.kill)('你一直撑着的那根弦，断了。','vignette','san');if(!$imports.S.dead&&$imports.S.san<=0)$imports.PlayerStats.setSan(1,'death-prevented');}
}
/* 仅保留日常恢复；危险环境、异象和躲避巡察者期间不能由课表恢复抵消伤害。 */
function sanTick(dt,rule,exam){
  if($imports.S.san<=0){settleSan();if($imports.S.dead)return;}
  if(!dangerAt()&&!$imports.AN.active&&!$imports.PatrolWorld.localThreat()&&!$imports.HIDE.on&&!(typeof $imports.Inspection!=='undefined'&&$imports.Inspection.active()))rule.san(dt*$imports.CampusPressure.current().passive,exam);
  if($imports.S.pillT>0){var pd=Math.min(dt,$imports.S.pillT);$imports.PlayerStats.changeSan($imports.PILL_RATE*pd,'systems');$imports.S.pillT-=pd;}
  settleSan();
}
function addViolation(amount,source){
  $imports.PlayerStats.addViolation(amount,source,onLeave()||(0,$imports.eveningActivity)($imports.S.tsec));
}
/* 同学注视的数值判定只查询逻辑状态，不依赖模型是否加载。 */
function ncPressureTick(dt){
  if((0,$imports.ncPressureState)()&&$imports.S.viol>=70&&!$imports.S.dead)$imports.PlayerStats.changeSan(-dt*0.12,'classroom-stare',{min:1});
}
/* 普通课堂与课间操不按离席秒数处罚；巡察发现、两次集合、考试和熄灯各自结算。 */
function violTick(dt,nw,rule,exam){
  if(typeof $imports.Inspection!=='undefined'&&$imports.Inspection.active()){
    $imports.S.wrong=!inClassroomHere();leaveTick();try{$imports.Classmates.tick();ncPressureTick(dt);}catch(e){}return;
  }
  var wrong=!rule.there();
  if(!exam&&(nw==='教室'||nw==='操场'))wrong=false;
  var vioMul=1;
  if(nw==='教室') vioMul=exam?2.4:1.4;
  if($imports.S.mode==='out'&&(0,$imports.isNight)()) vioMul*=0.5;
  /* 熄灯后即使在宿舍也会累积违规；在室外仍沿用原来的夜间倍率。 */
  if(onLeave()||(0,$imports.eveningActivity)($imports.S.tsec)) wrong=false;                      /* 请假中：不用待在规定的地方 */
  $imports.S.wrong=wrong;
  leaveTick();
  if(!onLeave()&&!(0,$imports.eveningActivity)($imports.S.tsec)&&(wrong||nw==='宿舍')){ addViolation(dt*0.85*vioMul); }
  else { $imports.PlayerStats.changeViolation(-dt*3.2,'decay',{min:0}); }
  try{ $imports.Classmates.tick();ncPressureTick(dt); }catch(e){}
  $imports.PlayerStats.setViolation($imports.S.viol,'settle',{min:0,max:100});
  /* 违规记满不再直接死：班主任在本子上划一笔，之后请假条批不下来，直到违规降下去 */
  if($imports.S.viol>=100&&!$imports.RT.violFull){
    $imports.RT.violFull=1;
    (0,$imports.os)('我：走廊那头，班主任看了我一眼，在本子上划了一笔。违规记满了——以后的请假条，他不会再签。',5,$imports.OS_KEEP);
    (0,$imports.toast)('违规已满 · 不能请假');
  }else if($imports.RT.violFull&&$imports.S.viol<60) $imports.RT.violFull=0;
}
/* 同化速率（每真实秒）：坐在教室里涨、夜里待在宿舍涨，其余时间回落。 */
var TT_CFG={seat:0.26,dorm:0.22,decay:0.6};   /* 20 分钟课表：保留久坐风险，避免压短课间后第一天早晨就被迫融入。 */
/* 同化：坐得住、按时回宿舍就涨；满值直接融入。 */
function ttTick(dt,nw){
  if($imports.S.tt>=100){resolveAssimilation();return;}
  if(typeof $imports.Inspection!=='undefined'&&$imports.Inspection.active())return;
  if($imports.S.seated&&nw==='教室') $imports.PlayerStats.changeAssimilation(TT_CFG.seat*dt,'classroom');
  else if(inDorm()&&$imports.S.tsec>=$imports.EVENING) $imports.PlayerStats.changeAssimilation(TT_CFG.dorm*dt,'dorm');
  else if(!($imports.RT.midnightMeal&&gameClock()<$imports.RT.midnightMeal.until)) $imports.PlayerStats.changeAssimilation(-TT_CFG.decay*dt,'decay',{min:0});   /* 午夜食堂吃过一碗：到天亮前不回落 */
  $imports.PlayerStats.setAssimilation($imports.S.tt,'settle',{min:0,max:100});
  if($imports.S.tt>=100){
    resolveAssimilation();return;
  }
  var tier=Math.floor($imports.S.tt/20);
  if(tier>0&&tier!==$imports.S.ttTier){
    $imports.S.ttTier=tier;
    if($imports.S.seated&&TT_SEAT[tier]) (0,$imports.os)(TT_SEAT[tier],4.6);
    else if(tier<=6) (0,$imports.os)(TT_LINES[tier-1],4.4);
  }
  if($imports.S.tt<100) $imports.S.hiddenLatch=false;
}
function updateSystems(dt,clockAdvanced){
  if($imports.S.dead||$imports.S.screen!=='play') return;
  if(!clockAdvanced)clockTick(dt);
  (0,$imports.patEndIfInvalid)();
  try{ (0,$imports.fnTick)(dt); }catch(e){}
  if(typeof $imports.Inspection!=='undefined')$imports.Inspection.tick(dt);
  if($imports.S.dead)return;
  if($imports.S.exam&&($imports.S.tsec>=$imports.LIGHTS_OUT||$imports.S.tsec<440)){ examEnd(); (0,$imports.os)('我：熄灯了。今天的考试结束了。',3.4); }
  examTick(dt);
  var exam=examNow(), nw=(0,$imports.needWhere)($imports.S.tsec), rule=NEED_RULE[nw];
  sanTick(dt,rule,exam);
  if($imports.S.dead)return;
  violTick(dt,nw,rule,exam);
  ttTick(dt,nw);
  if($imports.S.dead)return;
  dangerTick(dt);
  roamTick(dt);

  settleSan();
}

function resolveAssimilation(){
  $imports.S.hiddenLatch=false;$imports.S.hiddenAsked=false;$imports.S.hiddenWindow=0;
  if($imports.S.dead)return;
  (0,$imports.kill)('你在自己的位子上坐好了。椅子很合身，像是照着你做的。这一次，不用再起来了。','names','assimilation');
  /* 免疫、药丸或调试无敌挡下后回落，避免每帧再次触发；不提供人为脱身选项。 */
  if(!$imports.S.dead){$imports.PlayerStats.setAssimilation(86,'death-prevented');$imports.S.ttTier=4;}
}

/* 请假：两个小时（游戏时间）内不用待在规定的地方，巡察者也不管。RT.leaveUntil 用连续的游戏分钟 */
var LEAVE_MIN=180;
function onLeave(){ return !!$imports.RT.leaveUntil&&gameClock()<$imports.RT.leaveUntil; }
function leaveLeft(){ return onLeave()?Math.ceil($imports.RT.leaveUntil-gameClock()):0; }
function leaveTick(){
  if($imports.RT.leaveUntil&&!onLeave()){ $imports.RT.leaveUntil=0; (0,$imports.os)('我：假条上写的时间到了。接下来要避开巡察，留意集合广播。',3.6,$imports.OS_KEEP); }
}
function useLeave(){
  if($imports.S.viol>=100||$imports.RT.violFull){ (0,$imports.os)('我：违规记满了。班主任看都不会看这张假条。',3); (0,$imports.toast)('违规已满 · 不能请假'); return; }
  if(onLeave()){ (0,$imports.os)('我：已经请过假了，还剩 '+leaveLeft()+' 分钟。',2.6); return; }
  $imports.RT.leaveUntil=gameClock()+LEAVE_MIN;
  (0,$imports.removeItem)('leave');
  (0,$imports.os)('我：我把日期填上了。字迹和班主任的签名一模一样——好像本来就是我写的。',4);
  (0,$imports.toast)('请假 '+LEAVE_MIN+' 分钟 · 不用待在规定的地方，巡察者也不管你');
}

var ROAM_LIT_NEED=1.6, ROAM_REACH=26, ROAM_CAR=200;
var ROAM={on:false,x:0,y:0,cd:0,seen:0,litAcc:0,stage:'approach',waitT:0,lureTold:0};
/* 车库里那个人使用约 0.28 米身体半径，与玩家共用圆形障碍检测。 */
function roamBlocked(R,x,y){
  return $imports.Collision.depth(x,y,2.5,R)>1e-7;
}
function roamMove(R,dx,dy){
  var n=Math.max(1,Math.ceil(Math.hypot(dx,dy)/1.25));dx/=n;dy/=n;
  for(var i=0;i<n;i++){
    if(!roamBlocked(R,ROAM.x+dx,ROAM.y))ROAM.x+=dx;
    if(!roamBlocked(R,ROAM.x,ROAM.y+dy))ROAM.y+=dy;
  }
}
function dangerAt(){
  if($imports.S.mode==='in'){
    if($imports.S.room==='garage1') return 'garage';
    if($imports.S.room==='trash1') return 'trash';
    if($imports.S.room==='portal_tunnel') return 'tunnel';
    return null;
  }
  if((0,$imports.isNight)()) return 'night';
  return null;
}
function roamReset(){
  var R=$imports.INTERIORS['garage1']; if(!R) return;
  ROAM.x=R.ox+R.w*0.42; ROAM.y=R.oy+R.h*0.5;
  ROAM.cd=6.5; ROAM.on=true; ROAM.stage='approach';
  ROAM.litAcc=0; ROAM.waitT=0; ROAM.seen=0; ROAM.lureTold=0; ROAM.toldSpot=0;
}
/* 它还在车道上、离你不远：车门一开就被它抓住 */
function roamGuardsCar(){
  return ROAM.on&&ROAM.stage==='approach'&&Math.hypot($imports.S.x-ROAM.x,$imports.S.y-ROAM.y)<ROAM_CAR;
}
function roamLit(){
  if(!$imports.USE.torch) return false;
  var dx=ROAM.x-$imports.S.x, dy=ROAM.y-$imports.S.y;
  if(dx*dx+dy*dy>260*260) return false;
  return (0,$imports.angDiff)(Math.atan2(dy,dx),$imports.S.ang)<$imports.PI/3;
}
function roamTick(dt){
  if($imports.RT.carLeaving>0) $imports.RT.carLeaving-=dt;
  var dg=dangerAt();
  if(dg!=='garage'||!$imports.INTERIORS['garage1']){ ROAM.on=false; $imports.RT.lure=null; return; }
  if($imports.RT.carLeaving>0){ ROAM.on=false; return; }
  if(!ROAM.on) roamReset();
  var R=$imports.INTERIORS['garage1'];
  var lure=$imports.RT.lure;
  if(lure){ lure.t-=dt; if(lure.t<=0){ $imports.RT.lure=null; lure=null; } }
  var lit=roamLit();
  if(lit) ROAM.litAcc+=dt; else ROAM.litAcc=Math.max(0,ROAM.litAcc-dt*0.35);

  if(ROAM.litAcc>=ROAM_LIT_NEED){
    (0,$imports.gameFact)('garage',{what:'torch'});
    ROAM.litAcc=0; ROAM.stage='wait'; ROAM.waitT=(0,$imports.rnd)(4.5,8);
    ROAM.x=-1e6; ROAM.y=-1e6;
    if(!ROAM.goneTold){ ROAM.goneTold=1; (0,$imports.os)('我：光扫过去，它就没了。',3.6); }
    return;
  }
  if(ROAM.stage==='wait'){
    if(lit) ROAM.waitT=0;
    ROAM.waitT-=dt;
    if(ROAM.waitT<=0){
      var ok=false,bx=0,by=0;
      for(var t=0;t<12;t++){
        var a=(0,$imports.rnd)(0,$imports.TAU), far=(0,$imports.rnd)(300,460);
        bx=(0,$imports.clamp)($imports.S.x+Math.cos(a)*far,R.ox+24,R.ox+R.w-24);
        by=(0,$imports.clamp)($imports.S.y+Math.sin(a)*far,R.oy+24,R.oy+R.h-24);
        if((0,$imports.dist2)(bx,by,$imports.S.x,$imports.S.y)>250*250&&!roamBlocked(R,bx,by)){ ok=true; break; }
      }
      if(!ok){ /* 兜底仍须在可站立的车道里，不能直接塞进墙角或车内。 */
        var best=-1;
        for(var row=1;row<R.rows-1;row++)for(var col=1;col<R.cols-1;col++){
          var px=R.ox+(col+0.5)*R.tw,py=R.oy+(row+0.5)*R.th,d=(0,$imports.dist2)(px,py,$imports.S.x,$imports.S.y);
          if(d>best&&!roamBlocked(R,px,py)){best=d;bx=px;by=py;ok=true;}
        }
      }
      if(!ok){ROAM.waitT=1;return;}
      ROAM.x=bx; ROAM.y=by; ROAM.stage='approach';
      if(!ROAM.backTold){ ROAM.backTold=1; (0,$imports.os)('我：……后面又有脚步声了。',3.8); }
    }
    return;
  }
  ROAM.cd-=dt;
  if(lit){
    ROAM.cd=Math.max(ROAM.cd,0.55);
    var bdx=ROAM.x-$imports.S.x, bdy=ROAM.y-$imports.S.y, bd=Math.hypot(bdx,bdy)||1;
    roamMove(R,bdx/bd*13*dt,bdy/bd*13*dt);
  }else if(ROAM.cd<=0){
    /* 以前每 1.15–2.45 秒挪一步，平均比走路还慢，跑起来就能甩开，直接冲过去开车。
       现在近了、或者听见你在跑，就挪得比你跑得还快：只能拿光把它定住。 */
    var near=Math.hypot($imports.S.x-ROAM.x,$imports.S.y-ROAM.y)<220;
    ROAM.cd=($imports.S.run||near)?(0,$imports.rnd)(0.55,0.95):(0,$imports.rnd)(0.9,1.5);
    $imports.SFX.step();
    var tx=lure?lure.x:$imports.S.x, ty=lure?lure.y:$imports.S.y;
    var dx=tx-ROAM.x, dy=ty-ROAM.y, dl=Math.hypot(dx,dy)||1, step=Math.min(34,dl);
    roamMove(R,dx/dl*step,dy/dl*step);
    if(lure&&!ROAM.lureTold){ ROAM.lureTold=1; (0,$imports.os)('我：那东西停了一下，脚步朝硬币落地的方向去了。',3.6); }
  }
  var ddx=$imports.S.x-ROAM.x, ddy=$imports.S.y-ROAM.y;
  var dist=Math.sqrt(ddx*ddx+ddy*ddy);
  if(dist<150){ (0,$imports.sanDrain)(1.1,dt,'systems'); if(!ROAM.seen){ ROAM.seen=1; (0,$imports.os)('我：车道那头有东西。它不是走路的姿势。',5); } }
  if(dist<230&&!ROAM.toldSpot){ ROAM.toldSpot=1; (0,$imports.os)('我：车道中间有个高的东西站着。它没在动。',4.4); }
  if(dist<ROAM_REACH&&!lit&&ROAM.litAcc<ROAM_LIT_NEED*0.5&&$imports.S.enterCool<=0){
    (0,$imports.kill)('你在黑暗里撞上了它。它很高，很冷，一直站在车道中间，等你自己走过去。','grip','garage');
  }
}
var DANGER={garage:{san:0.55},trash:{san:0.40},night:{san:0.30},tunnel:{san:0.60}};
function dangerTick(dt){
  var dg=dangerAt(); if(!dg) return;
  var k=(dg==='night'||dg==='garage')?$imports.Talent.modifier('danger.'+dg):1;   /* 暗处适应：只管车库和夜里室外的环境消耗 */
  (0,$imports.sanDrain)(DANGER[dg].san*k*$imports.CampusPressure.current().danger,dt,'systems');   /* 留校越久危险区越耗；校庆日的减半在 sanDrain 里 */
  if(!$imports.S.dangerSeen) $imports.S.dangerSeen={};
  if(!$imports.S.dangerSeen[dg]){
    $imports.S.dangerSeen[dg]=1;
    if(dg==='garage') (0,$imports.os)('我：车库里没有灯。只有最里面那盏在闪——闪的节奏，像有人在开关。',4.6);
    else if(dg==='trash') (0,$imports.os)('我：垃圾房的味道不对。太干净了。像刚刚被人舔过一遍。',4.2);
    else if(dg==='tunnel') (0,$imports.os)('我：不想靠近。脚下的黑色黏液像是在呼吸。',4.2);
    else (0,$imports.os)('我：熄灯了。外面的路灯还亮着，可是它们照不到地面。这种时候还在外面走，是要被记下来的。',4.8);
  }
}

/* @module-exports */
GameModules.publish("game3d/js/systems.js",{
"GameTime":{get:function(){return GameTime;},set:function($value){GameTime=$value;}},
"inClassroomHere":{get:function(){return inClassroomHere;},set:function($value){inClassroomHere=$value;}},
"inDorm":{get:function(){return inDorm;},set:function($value){inDorm=$value;}},
"onField":{get:function(){return onField;},set:function($value){onField=$value;}},
"currentPlaceName":{get:function(){return currentPlaceName;},set:function($value){currentPlaceName=$value;}},
"atMySeat":{get:function(){return atMySeat;},set:function($value){atMySeat=$value;}},
"nearestSeat":{get:function(){return nearestSeat;},set:function($value){nearestSeat=$value;}},
"VIO_ON":{get:function(){return VIO_ON;},set:function($value){VIO_ON=$value;}},
"examStart":{get:function(){return examStart;},set:function($value){examStart=$value;}},
"examEnd":{get:function(){return examEnd;},set:function($value){examEnd=$value;}},
"examNow":{get:function(){return examNow;},set:function($value){examNow=$value;}},
"examTick":{get:function(){return examTick;},set:function($value){examTick=$value;}},
"gameClock":{get:function(){return gameClock;},set:function($value){gameClock=$value;}},
"advanceGameTime":{get:function(){return advanceGameTime;},set:function($value){advanceGameTime=$value;}},
"rewindGameTime":{get:function(){return rewindGameTime;},set:function($value){rewindGameTime=$value;}},
"NEED_RULE":{get:function(){return NEED_RULE;},set:function($value){NEED_RULE=$value;}},
"TT_LINES":{get:function(){return TT_LINES;},set:function($value){TT_LINES=$value;}},
"TT_SEAT":{get:function(){return TT_SEAT;},set:function($value){TT_SEAT=$value;}},
"clockTick":{get:function(){return clockTick;},set:function($value){clockTick=$value;}},
"sanityStage":{get:function(){return sanityStage;},set:function($value){sanityStage=$value;}},
"staminaMax":{get:function(){return staminaMax;},set:function($value){staminaMax=$value;}},
"capStamina":{get:function(){return capStamina;},set:function($value){capStamina=$value;}},
"restoreStamina":{get:function(){return restoreStamina;},set:function($value){restoreStamina=$value;}},
"settleSan":{get:function(){return settleSan;},set:function($value){settleSan=$value;}},
"sanTick":{get:function(){return sanTick;},set:function($value){sanTick=$value;}},
"addViolation":{get:function(){return addViolation;},set:function($value){addViolation=$value;}},
"ncPressureTick":{get:function(){return ncPressureTick;},set:function($value){ncPressureTick=$value;}},
"violTick":{get:function(){return violTick;},set:function($value){violTick=$value;}},
"TT_CFG":{get:function(){return TT_CFG;},set:function($value){TT_CFG=$value;}},
"ttTick":{get:function(){return ttTick;},set:function($value){ttTick=$value;}},
"updateSystems":{get:function(){return updateSystems;},set:function($value){updateSystems=$value;}},
"resolveAssimilation":{get:function(){return resolveAssimilation;},set:function($value){resolveAssimilation=$value;}},
"LEAVE_MIN":{get:function(){return LEAVE_MIN;},set:function($value){LEAVE_MIN=$value;}},
"onLeave":{get:function(){return onLeave;},set:function($value){onLeave=$value;}},
"leaveLeft":{get:function(){return leaveLeft;},set:function($value){leaveLeft=$value;}},
"leaveTick":{get:function(){return leaveTick;},set:function($value){leaveTick=$value;}},
"useLeave":{get:function(){return useLeave;},set:function($value){useLeave=$value;}},
"ROAM_LIT_NEED":{get:function(){return ROAM_LIT_NEED;},set:function($value){ROAM_LIT_NEED=$value;}},
"ROAM_REACH":{get:function(){return ROAM_REACH;},set:function($value){ROAM_REACH=$value;}},
"ROAM_CAR":{get:function(){return ROAM_CAR;},set:function($value){ROAM_CAR=$value;}},
"ROAM":{get:function(){return ROAM;},set:function($value){ROAM=$value;}},
"roamBlocked":{get:function(){return roamBlocked;},set:function($value){roamBlocked=$value;}},
"roamMove":{get:function(){return roamMove;},set:function($value){roamMove=$value;}},
"dangerAt":{get:function(){return dangerAt;},set:function($value){dangerAt=$value;}},
"roamReset":{get:function(){return roamReset;},set:function($value){roamReset=$value;}},
"roamGuardsCar":{get:function(){return roamGuardsCar;},set:function($value){roamGuardsCar=$value;}},
"roamLit":{get:function(){return roamLit;},set:function($value){roamLit=$value;}},
"roamTick":{get:function(){return roamTick;},set:function($value){roamTick=$value;}},
"DANGER":{get:function(){return DANGER;},set:function($value){DANGER=$value;}},
"dangerTick":{get:function(){return dangerTick;},set:function($value){dangerTick=$value;}}
});
})(GameModules.imports("game3d/js/systems.js"));
