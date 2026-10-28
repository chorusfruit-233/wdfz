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
     离开座位，SAN 和违规涨得更快；异象只出教室里的那几种；
     一场考完，大部分时间坐着的，给一次 SAN。 */
var EXAM_AN={stare:1,chalk:1,repeat:1,roster:1,shifting:1,broad:1};
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
    if(S.tsec>=1500) S.tsec=440;
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
function updateSystems(dt){
  if(S.dead||S.screen!=='play') return;
  var rate=rateAt(S.tsec), _t0=S.tsec;
  advanceGameTime(dt*rate/60);
  if(_t0<BEAST_T0&&S.tsec>=BEAST_T0&&S.mode==='in'&&INTERIORS[S.room]&&INTERIORS[S.room].host==='teach')
    os('我：……秒针忽然走得很慢。走廊里所有的声音都被拖长了。',4,OS_KEEP);

  try{ fnTick(dt); }catch(e){}
  if(S.exam&&(S.tsec>=LIGHTS_OUT||S.tsec<440)){ examEnd(); os('我：熄灯了。今天的考试结束了。',3.4); }
  examTick(dt);
  var exam=examNow();

  var nw=needWhere(S.tsec);
  if(nw==='教室'){
    var ek=exam?1.8:1;                        /* 考试时离开座位扣得更快 */
    if(S.seated){ S.san+=0.42*dt; }
    else if(inClassroomHere()){ S.san-=0.9*dt*dif().san*ek; }
    else { S.san-=2.4*dt*dif().san*ek; }
  }else if(nw==='宿舍'){
    if(inDorm()){ S.san+=0.22*dt; }
    else { S.san-=1.4*dt*dif().san; }
  }else if(nw==='操场'){
    if(onField()){ S.san+=0.5*dt; }
    else { S.san-=1.2*dt*dif().san; }
  }else{
    S.san+=0.8*dt;
  }
  S.san=clamp(S.san,0,100);
  if(S.san<=0&&!S.dead) kill('你在一个不该睡着的地方睡着了。梦里有人一直在叫你的名字，叫得很温柔。','vignette');

  var wrong=false;
  if(nw==='教室'&&!atMySeat()) wrong=true;
  else if(nw==='宿舍'&&!inDorm()) wrong=true;
  else if(nw==='操场'&&!onField()) wrong=true;
  var vioMul=1;
  if(nw==='教室') vioMul=exam?2.4:1.4;
  if(S.mode==='out'&&isNight()) vioMul*=0.5;
  S.wrong=wrong;
  /* 熄灯后即使在宿舍也会累积违规；在室外仍沿用原来的夜间倍率。 */
  if(wrong||nw==='宿舍'){ S.viol+=dt*0.85*vioMul; }
  else { S.viol=Math.max(0,S.viol-dt*3.2); }
  try{ skipTick(dt); }catch(e){}
  try{ ncUpdate(dt); }catch(e){}
  S.viol=clamp(S.viol,0,100);
  if(S.viol>=100&&!S.dead) killViol();

  if(S.seated&&nw==='教室') S.tt+=1.5*dt;
  else if(inDorm()&&S.tsec>=EVENING) S.tt+=1.0*dt;
  else S.tt=Math.max(0,S.tt-0.35*dt);
  S.tt=clamp(S.tt,0,100);
  if(S.tt>=100&&!S.hiddenLatch){ S.hiddenLatch=true; S.hiddenWindow=3.2; }
  if(S.hiddenLatch){
    S.hiddenWindow-=dt;
    if(S.hiddenWindow<=0&&!S.dead&&!S.hiddenAsked){
      S.hiddenAsked=true;
      askHiddenChoice();
    }
  }
  var tier=Math.floor(S.tt/20);
  if(tier>0&&tier!==S.ttTier){
    S.ttTier=tier;
    var lines=['我：最近睡得挺好。铃一响就醒，不用闹钟。醒的时候，我已经坐在位子上了。',
      '我：课表不用看了。我知道下一节是什么。我还知道下下节、下下下节。',
      '我：……今天几号来着？黑板右上角的日期，我从来没见它变过。',
      '我：走廊里的人走得真整齐。我低头看了一眼——我的脚也在跟着拍子。',
      '我：座位表上，我的名字在哪一格？……哪一格都是我的名字。',
      '我：我好像一直都在这里。在我转来之前，就在这里。'];
    if(tier<=6) os(lines[tier-1],4.4);
  }
  if(S.tt<100) S.hiddenLatch=false;

  dangerTick(dt);
  roamTick(dt);
  try{ patTick(dt); }catch(e){}
}

function askHiddenChoice(){
  PAUSE.on=true;
  UI.choice('第 3 节。我的位子空着。\n全班都转过头来，等我坐回去。',[
    {label:'回教室去',fn:function(){ S.tt=86; S.hiddenLatch=false; S.hiddenAsked=false; PAUSE.on=false; }},
    {label:'……',fn:function(){ S.hiddenAsked=false; kill('你在自己的位子上坐好了。椅子很合身，像是照着你做的。这一次，不用再起来了。','names'); }}
  ]);
}

function killViol(){
  if(Math.random()<0.5) kill('有人从后面按住了你的肩膀。然后是第二只手，第三只。它们都很耐心，一点一点把你按回该在的地方。','grip');
  else kill('地板变软了。你往下沉，沉得很慢，慢到你能听清头顶上那一声上课铃。','floor');
}

var ROAM_LIT_NEED=1.6, ROAM_REACH=26, ROAM_CAR=200;
var ROAM={on:false,x:0,y:0,cd:0,seen:0,litAcc:0,stage:'approach',waitT:0,lureTold:0};
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
  if(!(USE.torch||USE.phone)) return false;
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
        if(dist2(bx,by,S.x,S.y)>250*250){ ok=true; break; }
      }
      if(!ok){ /* 房间太小兜底：放到离玩家最远的角 */
        var cs=[[R.ox+30,R.oy+30],[R.ox+R.w-30,R.oy+30],[R.ox+30,R.oy+R.h-30],[R.ox+R.w-30,R.oy+R.h-30]];
        var best=-1;
        for(var i=0;i<4;i++){ var d=dist2(cs[i][0],cs[i][1],S.x,S.y); if(d>best){best=d;bx=cs[i][0];by=cs[i][1];} }
      }
      ROAM.x=bx; ROAM.y=by; ROAM.stage='approach';
      if(!ROAM.backTold){ ROAM.backTold=1; os('我：……后面又有脚步声了。',3.8); }
    }
    return;
  }
  ROAM.cd-=dt;
  if(lit){
    ROAM.cd=Math.max(ROAM.cd,0.55);
    var bdx=ROAM.x-S.x, bdy=ROAM.y-S.y, bd=Math.hypot(bdx,bdy)||1;
    ROAM.x+=bdx/bd*13*dt; ROAM.y+=bdy/bd*13*dt;
  }else if(ROAM.cd<=0){
    /* 以前每 1.15–2.45 秒挪一步，平均比走路还慢，跑起来就能甩开，直接冲过去开车。
       现在近了、或者听见你在跑，就挪得比你跑得还快：只能拿光把它定住。 */
    var near=Math.hypot(S.x-ROAM.x,S.y-ROAM.y)<220;
    ROAM.cd=(S.run||near)?rnd(0.55,0.95):rnd(0.9,1.5);
    SFX.step();
    var tx=lure?lure.x:S.x, ty=lure?lure.y:S.y;
    var dx=tx-ROAM.x, dy=ty-ROAM.y, dl=Math.hypot(dx,dy)||1, step=Math.min(34,dl);
    var nx=ROAM.x+dx/dl*step, ny=ROAM.y+dy/dl*step;
    if(!solidAtInterior(R,nx,ROAM.y)) ROAM.x=nx;
    if(!solidAtInterior(R,ROAM.x,ny)) ROAM.y=ny;
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
