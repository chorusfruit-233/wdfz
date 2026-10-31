/* 里世界 3D · 课表规则、SAN、违规、危险区、车库里的东西 */
'use strict';

function inClassroomHere(){
  if(S.mode!=='in') return false;
  var R=INTERIORS[S.room];
  if(!R||R.host!=='teach') return false;
  if(R.floor<1||R.floor>5) return false;
  var row=Math.floor((S.y-R.oy)/R.th);
  return row>=1&&row<=14;
}
function inDorm(){
  if(S.mode!=='in') return false;
  var R=INTERIORS[S.room];
  return !!R && (R.host==='dormN'||R.host==='dormS');
}
function onField(){
  if(S.mode!=='out') return false;
  var mx=S.x/SC,my=S.y/SC;
  var ids=['field','court2','track','bad2','bad3'];
  for(var i=0;i<ids.length;i++){
    var o=objById(ids[i]);
    if(o&&mx>o.x-6&&mx<o.x+o.w+6&&my>o.y-6&&my<o.y+o.h+6) return true;
  }
  return false;
}
function currentPlaceName(){
  if(S.mode==='out') return '武大附中 · 校园';
  var R=INTERIORS[S.room];
  return R?('武大附中 · '+R.name):'武大附中';
}
function atMySeat(){
  if(!inClassroomHere()||S.room!=='teach1') return false;
  return S.seated;
}
function nearestSeat(){
  if(S.mode!=='in') return null;
  var R=INTERIORS[S.room];
  if(!R||R.host!=='teach'||R.floor!==1) return null;
  var col=Math.floor((S.x-R.ox)/R.tw), row=Math.floor((S.y-R.oy)/R.th);
  if(tileAt(R,S.x,S.y)==='P') return {col:col,row:row};
  if(row>0&&tileAt(R,R.ox+(col+0.5)*R.tw,R.oy+(row-1+0.5)*R.th)==='P') return {col:col,row:row-1};
  if(row<R.rows-1&&tileAt(R,R.ox+(col+0.5)*R.tw,R.oy+(row+1+0.5)*R.th)==='P') return {col:col,row:row+1};
  return null;
}

var VIO_ON=0;

/* ---------- 考试模式 ----------
   在钟楼顶上撞钟以后，当天剩下的所有"在教室"的时段（上课和晚自习）都变成考试，到熄灯为止：
     离开座位，违规涨得更快；异象只出教室里的那几种；
     一场考完，大部分时间坐着的，给一次 SAN。
   考试时能出的异象见 anomaly.js 注册表里的 exam（派生出 EXAM_AN）。 */
function examStart(){
  if(isNight()){ os('我：钟声荡出去，很快就被夜吞掉了。整座学校都睡着，没有人回应。',4); return; }
  S.exam=true; S.examCur=null; S.examSeat=0; S.examTot=0;
  os('我：钟声一圈一圈荡开。过了很久，广播里有人慢慢地念：「今天剩下的课，全部改为考试。请回到自己的座位。」',6,OS_KEEP);
  toast('考试模式 · 今天剩下的课都是考试，熄灯后结束');
}
function examEnd(){ S.exam=false; S.examCur=null; S.examSeat=0; S.examTot=0; }
function examNow(){ return !!S.exam&&needWhere(S.tsec)==='教室'; }
function examTick(dt){
  if(!S.exam) return;
  var p=periodAt(S.tsec), cur=(p[3]==='教室')?p[0]:null;
  if(cur!==S.examCur){
    if(S.examCur!==null&&S.examTot>4){                 /* 上一场结束：交卷 */
      if(S.examSeat/S.examTot>=0.7){ S.san=Math.min(100,S.san+15); os('我：交卷了。监考的人从我桌上收走卷子，没有看我。……可我记得我写了什么。',4.4); toast('考完一场 · SAN +15'); }
      else os('我：这一场我没坐住。收上去的卷子里，我那一张只有名字，名字被人画了一个圈。',4.4);
    }
    S.examCur=cur; S.examSeat=0; S.examTot=0;
    if(cur!==null) os(S.seated?'我：铃响了。卷子发下来了，我那张的姓名栏里，已经有人替我写好了名字。':'我：铃响了。卷子已经发到了每个人桌上，包括我那张空着的位子。',3.6);
  }
  if(cur!==null){ S.examTot+=dt; if(S.seated&&atMySeat()) S.examSeat+=dt; }
}
/* 日数沿用 22:30 切换，01:00 跳到同一日的 07:20。冷却使用连续的游戏分钟。 */
function gameClock(){
  var day=Math.max(1,S.day||1), late=S.tsec>=LIGHTS_OUT+10&&day>1;
  return (day-1-(late?1:0))*1440+S.tsec;
}
function advanceGameTime(minutes){
  var remaining=Math.max(0,minutes||0);
  while(remaining>0){
    var before=S.tsec, step=Math.min(remaining,Math.max(0,1500-before));
    S.tsec+=step; remaining-=step;
    if(typeof Inspection!=='undefined')Inspection.cross(S.day,before,S.tsec);
    if(S.day===1&&S.fn&&!S.fn.note&&S.tsec>=LIGHTS_OUT){
      S.fn.note=true;
      os('我：口袋里多了一张对折的纸。上面写着——灯前看字字如旧，月下认人人已非。　　　　　——笑时莫出声。',8);
    }
    if(S.exam&&before<LIGHTS_OUT&&S.tsec>=LIGHTS_OUT){ examEnd(); os('我：熄灯了。今天的考试结束了。',3.4); }
    if((before<LIGHTS_OUT+10&&S.tsec>=LIGHTS_OUT+10)||(S.day===1&&before>=LIGHTS_OUT+10)){
      S.day=(S.day||1)+1;
      if(S.day===2){
        os('我：……今天几号来着？我想不起来了。',4);
        if(S.fn&&S.fn.note&&!S.fn.on&&S.fn.n===0){
          S.fn.on=true; S.fn.v=0; S.fn.next=10; S.fn.used={}; S.fn.n=0; S.fn.left=4; S.fn.done=false;
          try{ fadeTo(function(){}); }catch(e){}
          setTimeout(function(){ try{ os('我：第二天。所有东西都回到了原来的位置，颜色也回来了。',5.5); }catch(e){} },1200);
          setTimeout(function(){ try{ fnPeopleBuild(); }catch(e){} },1800);
        }
      }
    }
    if(S.tsec>=1500-1e-9) S.tsec=440;
    else if(step<=0) break;
  }
}
function rewindGameTime(minutes){
  var remaining=Math.max(0,minutes||0);
  while(remaining>0){
    if(S.tsec<=440) S.tsec=1500;
    var before=S.tsec, step=Math.min(remaining,S.tsec-440);
    S.tsec-=step; remaining-=step;
    if(before>=LIGHTS_OUT+10&&S.tsec<LIGHTS_OUT+10&&S.day>1) S.day--;
  }
}
/* 每个时段规定待在哪里（needWhere 的四种结果）：在不在该在的地方、SAN 每秒怎么变 */
var NEED_RULE={
  '教室':{
    there:function(){ return atMySeat(); },
    san:function(dt){ if(atMySeat()) S.san+=0.42*dt; }
  },
  '宿舍':{
    there:function(){ return inDorm(); },
    san:function(dt){ if(inDorm()) S.san+=0.22*dt; }
  },
  '操场':{
    there:function(){ return onField(); },
    san:function(dt){ if(onField()) S.san+=0.5*dt; }
  },
  '自由':{
    there:function(){ return true; },
    san:function(dt){ S.san+=0.8*dt; }
  }
};
/* 同化值每满 20 说一句 */
var TT_LINES=['我：最近睡得挺好。铃一响就醒，不用闹钟。醒的时候，我已经坐在位子上了。',
  '我：课表不用看了。我知道下一节是什么。我还知道下下节、下下下节。',
  '我：……今天几号来着？黑板右上角的日期，我从来没见它变过。',
  '我：走廊里的人走得真整齐。我低头看了一眼——我的脚也在跟着拍子。',
  '我：座位表上，我的名字在哪一格？……哪一格都是我的名字。',
  '我：我好像一直都在这里。在我转来之前，就在这里。'];
/* 跨时段时分段消耗真实秒；不能把整步时间按旧时速推进，尤其是 11:45 的慢速窗。 */
function clockTick(dt){
  var left=Math.max(0,dt);
  while(left>1e-9){
    var t0=S.tsec, boundary=periodAt(t0)[1];
    if(t0<BEAST_SLOW_T0-1e-9)boundary=Math.min(boundary,BEAST_SLOW_T0);
    else if(t0<BEAST_SLOW_T1-1e-9)boundary=Math.min(boundary,BEAST_SLOW_T1);
    var rate=rateAt(t0), seconds=Math.max(0,(boundary-t0)*60/rate);
    if(seconds<1e-9){advanceGameTime(1e-8);continue;}
    var used=Math.min(left,seconds);
    advanceGameTime(used===seconds?boundary-t0:used*rate/60);left-=used;
  }
}
function sanityStage(value){var n=value===undefined?S.san:value;return n>60?0:n>30?1:n>12?2:3;}
var SAN_FEEL=['呼吸平稳','有些恍惚','心跳很乱','快撑不住了'];
function staminaMax(){return 40+0.6*clamp(Number.isFinite(S.san)?S.san:100,0,100);}
function capStamina(){S.stam=clamp(Number.isFinite(S.stam)?S.stam:0,0,staminaMax());}
function restoreStamina(amount){S.stam=Math.min(staminaMax(),S.stam+amount);capStamina();}
function settleSan(){
  S.san=clamp(Number.isFinite(S.san)?S.san:100,0,100);capStamina();
  if(S.san<=0&&!S.dead){kill('你一直撑着的那根弦，断了。','vignette');if(!S.dead&&S.san<=0)S.san=1;}
}
/* 仅保留日常恢复；危险环境、异象和躲避巡察者期间不能由课表恢复抵消伤害。 */
function sanTick(dt,rule,exam){
  if(S.san<=0){settleSan();if(S.dead)return;}
  if(!dangerAt()&&!AN.active&&!PAT.locked&&!HIDE.on&&!(typeof Inspection!=='undefined'&&Inspection.active()))rule.san(dt,exam);
  if(S.pillT>0){var pd=Math.min(dt,S.pillT);S.san+=PILL_RATE*pd;S.pillT-=pd;}
  if(PAT.state==='walk'&&(PAT.locked||HIDE.on))S.san-=dt*(PAT.locked?0.35:0.18);
  settleSan();
}
function addViolation(amount,source){
  if(amount>0&&(onLeave()||(eveningActivity(S.tsec)&&source!=='inspection')))return;
  S.viol=clamp(S.viol+amount,0,100);
}
/* 违规：不在该在的地方（或熄灯后）就涨，否则慢慢降；请假中不算 */
function violTick(dt,nw,rule,exam){
  if(typeof Inspection!=='undefined'&&Inspection.active()){
    S.wrong=!inClassroomHere();leaveTick();try{ncUpdate(dt);}catch(e){}return;
  }
  var wrong=!rule.there();
  var vioMul=1;
  if(nw==='教室') vioMul=exam?2.4:1.4;
  if(S.mode==='out'&&isNight()) vioMul*=0.5;
  /* 熄灯后即使在宿舍也会累积违规；在室外仍沿用原来的夜间倍率。 */
  if(onLeave()||eveningActivity(S.tsec)) wrong=false;                      /* 请假中：不用待在规定的地方 */
  S.wrong=wrong;
  leaveTick();
  if(!onLeave()&&!eveningActivity(S.tsec)&&(wrong||nw==='宿舍')){ addViolation(dt*0.85*vioMul); }
  else { S.viol=Math.max(0,S.viol-dt*3.2); }
  try{ skipTick(dt); }catch(e){}
  try{ ncUpdate(dt); }catch(e){}
  S.viol=clamp(S.viol,0,100);
  /* 违规记满不再直接死：班主任在本子上划一笔，之后请假条批不下来，直到违规降下去 */
  if(S.viol>=100&&!RT.violFull){
    RT.violFull=1;
    os('我：走廊那头，班主任看了我一眼，在本子上划了一笔。违规记满了——以后的请假条，他不会再签。',5,OS_KEEP);
    toast('违规已满 · 不能请假');
  }else if(RT.violFull&&S.viol<60) RT.violFull=0;
}
/* 同化：坐得住、按时回宿舍就涨；满值直接融入。 */
function ttTick(dt,nw){
  if(S.tt>=100){resolveAssimilation();return;}
  if(typeof Inspection!=='undefined'&&Inspection.active())return;
  if(S.seated&&nw==='教室') S.tt+=1.5*dt;
  else if(inDorm()&&S.tsec>=EVENING) S.tt+=1.0*dt;
  else S.tt=Math.max(0,S.tt-0.35*dt);
  S.tt=clamp(S.tt,0,100);
  if(S.tt>=100){
    resolveAssimilation();return;
  }
  var tier=Math.floor(S.tt/20);
  if(tier>0&&tier!==S.ttTier){
    S.ttTier=tier;
    if(tier<=6) os(TT_LINES[tier-1],4.4);
  }
  if(S.tt<100) S.hiddenLatch=false;
}
function updateSystems(dt){
  if(S.dead||S.screen!=='play') return;
  clockTick(dt);
  try{ patEndIfInvalid(); }catch(e){}
  try{ fnTick(dt); }catch(e){}
  if(typeof Inspection!=='undefined')Inspection.tick(dt);
  if(S.dead)return;
  if(S.exam&&(S.tsec>=LIGHTS_OUT||S.tsec<440)){ examEnd(); os('我：熄灯了。今天的考试结束了。',3.4); }
  examTick(dt);
  var exam=examNow(), nw=needWhere(S.tsec), rule=NEED_RULE[nw];
  sanTick(dt,rule,exam);
  if(S.dead)return;
  violTick(dt,nw,rule,exam);
  ttTick(dt,nw);
  if(S.dead)return;
  dangerTick(dt);
  roamTick(dt);
  try{ patTick(dt); }catch(e){}
  settleSan();
}

function resolveAssimilation(){
  S.hiddenLatch=false;S.hiddenAsked=false;S.hiddenWindow=0;
  if(S.dead)return;
  kill('你在自己的位子上坐好了。椅子很合身，像是照着你做的。这一次，不用再起来了。','names');
  /* 免疫、药丸或调试无敌挡下后回落，避免每帧再次触发；不提供人为脱身选项。 */
  if(!S.dead){S.tt=86;S.ttTier=4;}
}

/* 请假：两个小时（游戏时间）内不用待在规定的地方，巡察者也不管。RT.leaveUntil 用连续的游戏分钟 */
var LEAVE_MIN=120;
function onLeave(){ return !!RT.leaveUntil&&gameClock()<RT.leaveUntil; }
function leaveLeft(){ return onLeave()?Math.ceil(RT.leaveUntil-gameClock()):0; }
function leaveTick(){
  if(RT.leaveUntil&&!onLeave()){ RT.leaveUntil=0; os('我：假条上写的时间到了。我得回到该在的地方去。',3.6,OS_KEEP); }
}
function useLeave(){
  if(S.viol>=100||RT.violFull){ os('我：违规记满了。班主任看都不会看这张假条。',3); toast('违规已满 · 不能请假'); return; }
  if(onLeave()){ os('我：已经请过假了，还剩 '+leaveLeft()+' 分钟。',2.6); return; }
  RT.leaveUntil=gameClock()+LEAVE_MIN;
  removeItem('leave');
  os('我：我把日期填上了。字迹和班主任的签名一模一样——好像本来就是我写的。',4);
  toast('请假 '+LEAVE_MIN+' 分钟 · 不用待在规定的地方，巡察者也不管你');
}

var ROAM_LIT_NEED=1.6, ROAM_REACH=26, ROAM_CAR=200;
var ROAM={on:false,x:0,y:0,cd:0,seen:0,litAcc:0,stage:'approach',waitT:0,lureTold:0};
/* 车库里那个人使用约 0.28 米身体半径，与玩家共用圆形障碍检测。 */
function roamBlocked(R,x,y){
  return Collision.depth(x,y,2.5,R)>1e-7;
}
function roamMove(R,dx,dy){
  var n=Math.max(1,Math.ceil(Math.hypot(dx,dy)/1.25));dx/=n;dy/=n;
  for(var i=0;i<n;i++){
    if(!roamBlocked(R,ROAM.x+dx,ROAM.y))ROAM.x+=dx;
    if(!roamBlocked(R,ROAM.x,ROAM.y+dy))ROAM.y+=dy;
  }
}
function dangerAt(){
  if(S.mode==='in'){
    if(S.room==='garage1') return 'garage';
    if(S.room==='trash1') return 'trash';
    return null;
  }
  if(isNight()) return 'night';
  return null;
}
function roamReset(){
  var R=INTERIORS['garage1']; if(!R) return;
  ROAM.x=R.ox+R.w*0.42; ROAM.y=R.oy+R.h*0.5;
  ROAM.cd=6.5; ROAM.on=true; ROAM.stage='approach';
  ROAM.litAcc=0; ROAM.waitT=0; ROAM.seen=0; ROAM.lureTold=0; ROAM.toldSpot=0;
}
/* 它还在车道上、离你不远：车门一开就被它抓住 */
function roamGuardsCar(){
  return ROAM.on&&ROAM.stage==='approach'&&Math.hypot(S.x-ROAM.x,S.y-ROAM.y)<ROAM_CAR;
}
function roamLit(){
  if(!USE.torch) return false;
  var dx=ROAM.x-S.x, dy=ROAM.y-S.y;
  if(dx*dx+dy*dy>260*260) return false;
  return angDiff(Math.atan2(dy,dx),S.ang)<PI/3;
}
function roamTick(dt){
  if(RT.carLeaving>0) RT.carLeaving-=dt;
  var dg=dangerAt();
  if(dg!=='garage'||!INTERIORS['garage1']){ ROAM.on=false; RT.lure=null; return; }
  if(RT.carLeaving>0){ ROAM.on=false; return; }
  if(!ROAM.on) roamReset();
  var R=INTERIORS['garage1'];
  var lure=RT.lure;
  if(lure){ lure.t-=dt; if(lure.t<=0){ RT.lure=null; lure=null; } }
  var lit=roamLit();
  if(lit) ROAM.litAcc+=dt; else ROAM.litAcc=Math.max(0,ROAM.litAcc-dt*0.35);

  if(ROAM.litAcc>=ROAM_LIT_NEED){
    ROAM.litAcc=0; ROAM.stage='wait'; ROAM.waitT=rnd(4.5,8);
    ROAM.x=-1e6; ROAM.y=-1e6;
    if(!ROAM.goneTold){ ROAM.goneTold=1; os('我：光扫过去，它就没了。',3.6); }
    return;
  }
  if(ROAM.stage==='wait'){
    if(lit) ROAM.waitT=0;
    ROAM.waitT-=dt;
    if(ROAM.waitT<=0){
      var ok=false,bx=0,by=0;
      for(var t=0;t<12;t++){
        var a=rnd(0,TAU), far=rnd(300,460);
        bx=clamp(S.x+Math.cos(a)*far,R.ox+24,R.ox+R.w-24);
        by=clamp(S.y+Math.sin(a)*far,R.oy+24,R.oy+R.h-24);
        if(dist2(bx,by,S.x,S.y)>250*250&&!roamBlocked(R,bx,by)){ ok=true; break; }
      }
      if(!ok){ /* 兜底仍须在可站立的车道里，不能直接塞进墙角或车内。 */
        var best=-1;
        for(var row=1;row<R.rows-1;row++)for(var col=1;col<R.cols-1;col++){
          var px=R.ox+(col+0.5)*R.tw,py=R.oy+(row+0.5)*R.th,d=dist2(px,py,S.x,S.y);
          if(d>best&&!roamBlocked(R,px,py)){best=d;bx=px;by=py;ok=true;}
        }
      }
      if(!ok){ROAM.waitT=1;return;}
      ROAM.x=bx; ROAM.y=by; ROAM.stage='approach';
      if(!ROAM.backTold){ ROAM.backTold=1; os('我：……后面又有脚步声了。',3.8); }
    }
    return;
  }
  ROAM.cd-=dt;
  if(lit){
    ROAM.cd=Math.max(ROAM.cd,0.55);
    var bdx=ROAM.x-S.x, bdy=ROAM.y-S.y, bd=Math.hypot(bdx,bdy)||1;
    roamMove(R,bdx/bd*13*dt,bdy/bd*13*dt);
  }else if(ROAM.cd<=0){
    /* 以前每 1.15–2.45 秒挪一步，平均比走路还慢，跑起来就能甩开，直接冲过去开车。
       现在近了、或者听见你在跑，就挪得比你跑得还快：只能拿光把它定住。 */
    var near=Math.hypot(S.x-ROAM.x,S.y-ROAM.y)<220;
    ROAM.cd=(S.run||near)?rnd(0.55,0.95):rnd(0.9,1.5);
    SFX.step();
    var tx=lure?lure.x:S.x, ty=lure?lure.y:S.y;
    var dx=tx-ROAM.x, dy=ty-ROAM.y, dl=Math.hypot(dx,dy)||1, step=Math.min(34,dl);
    roamMove(R,dx/dl*step,dy/dl*step);
    if(lure&&!ROAM.lureTold){ ROAM.lureTold=1; os('我：那东西停了一下，脚步朝硬币落地的方向去了。',3.6); }
  }
  var ddx=S.x-ROAM.x, ddy=S.y-ROAM.y;
  var dist=Math.sqrt(ddx*ddx+ddy*ddy);
  if(dist<150){ S.san-=dt*1.1; if(!ROAM.seen){ ROAM.seen=1; os('我：车道那头有东西。它不是走路的姿势。',5); } }
  if(dist<230&&!ROAM.toldSpot){ ROAM.toldSpot=1; os('我：车道中间有个高的东西站着。它没在动。',4.4); }
  if(dist<ROAM_REACH&&!lit&&ROAM.litAcc<ROAM_LIT_NEED*0.5&&S.enterCool<=0){
    kill('你在黑暗里撞上了它。它很高，很冷，一直站在车道中间，等你自己走过去。','grip');
  }
}
var DANGER={garage:{san:0.55},trash:{san:0.40},night:{san:0.30}};
function dangerTick(dt){
  var dg=dangerAt(); if(!dg) return;
  var k=(S.talent==='night'&&(dg==='night'||dg==='garage'))?0.55:1;
  S.san-=dt*DANGER[dg].san*k;
  if(!S.dangerSeen) S.dangerSeen={};
  if(!S.dangerSeen[dg]){
    S.dangerSeen[dg]=1;
    if(dg==='garage') os('我：车库里没有灯。只有最里面那盏在闪——闪的节奏，像有人在开关。',4.6);
    else if(dg==='trash') os('我：垃圾房的味道不对。太干净了。像刚刚被人舔过一遍。',4.2);
    else os('我：熄灯了。外面的路灯还亮着，可是它们照不到地面。这种时候还在外面走，是要被记下来的。',4.8);
  }
}
