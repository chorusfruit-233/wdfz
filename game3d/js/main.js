/* 里世界 3D · 主循环、HUD、开始 / 继续 / 退出、启动 */
'use strict';

function onEnterRoom(id){
  if(id==='garage1') os('我：车库里没有灯。空气是潮的，有一股铁和机油的味道。远处有水在滴。',3.6);
  spotTick();
}

var lastT=0, accum=0, running=false;
function frame(t){
  requestAnimationFrame(frame);
  if(!running) { lastT=t; return; }
  var dt=(t-lastT)/1000; lastT=t;
  dtG=dt;
  if(dt>0.25) dt=0.25;
  accum+=dt;
  var step=1/60, guard=0;
  while(accum>=step&&guard++<6){
    try{ update(step); }catch(e){ try{ showErr('update: '+e.message); }catch(_e){} break; }
    accum-=step;
  }
  try{ render(dt); }catch(e){ try{ showErr('render: '+e.message); }catch(_e){} }
}
function update(dt){
  PHONE.checkInterrupt();
  if(S.screen!=='play') return;
  if(PRO.on) return;                     /* 前情提要期间世界不动 */
  GLR.time+=dt;
  updateDialog(dt);
  if(S.dead){
    S.deadT+=dt;
    try{ syncCamera(dt); }catch(e){}
    return;
  }
  if(PAUSE.on||UI.anyOpen()||PC.on){ return; }   /* 玩电脑的时候世界也停着，免得以为安全时被扣 SAN */
  updatePlayer(dt);                              /* 手机屏蔽移动输入，体力和计时仍正常更新 */
  try{ PHONE.tick(dt); }catch(e){}
  try{ searchTick(dt); }catch(e){}
  updateSystems(dt);
  anDrive(dt);
  PHONE.checkInterrupt();                         /* 世界更新中可能死亡、开始异象或打开选择 */
  try{ monoTick(dt); }catch(e){}
  spotTick();
}
function render(dt){
  if(!GLR.renderer) return;
  if(S.dead){ GLR.hurt=Math.min(0.85,GLR.hurt+dt*0.12); }
  else { GLR.hurt=Math.max(0,GLR.hurt-dt*0.6); }
  GLR.flash=Math.max(0, (GLR.flash||0)-dt*1.7);
  updateLighting();
  if(typeof CUT!=='undefined'&&CUT.on) cutTick(dt);        /* 结局演出：镜头由 cutscene.js 摆 */
  if(GLR.dust){
    GLR.dustT=(GLR.dustT||0)+dt;
    GLR.dust.position.set(GLR.cam.position.x,0,GLR.cam.position.z);
    GLR.dust.rotation.y=GLR.dustT*0.015;
    GLR.dust.position.y=Math.sin(GLR.dustT*0.25)*0.08;
  }
  if(GLR.roamFig){
    if(S.mode==='in'&&S.room==='garage1'&&typeof ROAM!=='undefined'&&ROAM.on&&ROAM.x>-1e5){
      var rp=worldToScene(ROAM.x,ROAM.y,INTERIORS['garage1']);
      GLR.roamFig.visible=true;
      GLR.roamFig.position.set(rp.x,0,rp.z);
      GLR.roamFig.lookAt(GLR.cam.position.x,0,GLR.cam.position.z);
    } else { GLR.roamFig.visible=false; }
  }
  try{ anfxUpdate(dt); }catch(e){}
  try{ smileTick(dt); }catch(e){}
  try{ patRender(); }catch(e){}
  try{ handsTick(dt); }catch(e){}
  try{ hallucTick(dt); }catch(e){}
  try{ apparTick(dt); }catch(e){}
  try{ PCGAME.tick(dt); }catch(e){}
  try{ updateIntro(dt); }catch(e){}
  try{
    if(S.mode==='in'&&!S.dead&&!HIDE.on){
      S.stuckT=(S.stuckT||0)+dt;
      if(S.stuckT>0.5){
        S.stuckT=0;
        if(typeof solidAt==='function'&&solidAt(S.x,S.y)){ unstick(); }
      }
    }
  }catch(e){}
  try{ if(DEV.on) Dev.pos(); }catch(e){}
  try{ if(DEV.on&&GLR.time%0.4<0.05) Dev.look(); }catch(e){}
  try{ if(typeof AMB_ON!=='undefined'){ if(AMB_ON&&S.screen==='play'){ if(!SFX._ambOn){ SFX.ambient(); SFX._ambOn=true; } } else if(!AMB_ON&&SFX._ambOn){ SFX.stopAmbient(); SFX._ambOn=false; } } }catch(e){}
  try{ SFX.tick(dt); }catch(e){}
  GLR.cam.updateMatrixWorld();
  entFace();
  var u=GLR.postMat.uniforms;
  u.uTime.value=GLR.time;
  var _fnOn=(S.fn&&S.fn.on&&S.fn.v<72)?1:0;
  GLR.fnNorm=GLR.fnNorm===undefined?0:GLR.fnNorm;
  GLR.fnNorm+= (_fnOn-GLR.fnNorm)*Math.min(1,dt*1.6);
  u.uFx.value=Math.max(GLR.fnNorm,(GLR.worldNorm||0),(GLRTEST.nofx?1:0));
  GLR.gaze=(GLR.gaze||0)+((GLR.gazeT||0)-(GLR.gaze||0))*Math.min(1,dt*2.4);
  u.uGaze.value=GLR.gaze;
  u.uHurt.value=GLR.hurt;
  u.uFlash.value=GLR.flash;
  u.uExpo.value=(GLR.dayExpo===undefined)?1:GLR.dayExpo;
  u.uRed.value=GLR.patrolRed||0;
  u.uSan.value=clamp(S.san/100,0,1);
  GFX.frame(dt);                                  /* 用哪个引擎画由渲染层决定（gfx/） */
  fpsWatch(dt);
  updateHUD();
  try{ drawMini(dt); }catch(e){}
}
/* 性能保护：玩的时候帧率连续 8 秒低于这一档的下限，就问要不要降一档（只问一次，可以选「别再问」） */
var FPSW={acc:0,n:0,low:0,asked:false};
function fpsWatch(dt){
  if(S.screen!=='play'||!running||UI.anyOpen()||PAUSE.on||!SET.fpsAsk) { FPSW.acc=0; FPSW.n=0; return; }
  var floor=QP().fpsFloor; if(!floor||QUALITY===0||FPSW.asked) return;
  FPSW.acc+=dtG||dt; FPSW.n++;
  if(FPSW.acc<2) return;
  var fps=FPSW.n/FPSW.acc; FPSW.acc=0; FPSW.n=0;
  FPSW.low=fps<floor?FPSW.low+2:Math.max(0,FPSW.low-2);
  if(FPSW.low<8) return;
  FPSW.asked=true;
  var down=QPROF[QUALITY-1];
  try{ releaseMouseLook&&releaseMouseLook(); }catch(e){}
  UI.choice('画面有点卡（大约每秒 '+Math.round(fps)+' 帧）。要从「'+QP().name+'」降到「'+down.name+'」吗？',[
    {label:'降到「'+down.name+'」',fn:function(){ Settings.q(QUALITY-1); }},
    {label:'先不用',fn:function(){}},
    {label:'别再问了',fn:function(){ SET.fpsAsk=0; saveSet(); }}
  ]);
}
var miniT=0;
function drawMini(dt){
  miniT-=dt;
  if(miniT>0) return;
  miniT=0.18;
  var cv=document.getElementById('mini');
  if(!cv||!cv.getContext) return;
  var c=cv.getContext('2d'); if(!c) return;
  if(!c||!c.clearRect) return;
  var W=cv.width, H=cv.height;
  var bw=BOUND.x1-BOUND.x0, bh=BOUND.y1-BOUND.y0;
  var sc=Math.min((W-8)/bw,(H-8)/bh);
  var ox=4+(W-8-bw*sc)/2, oy=4+(H-8-bh*sc)/2;
  function X(v){ return ox+(v-BOUND.x0)*sc; }
  function Y(v){ return oy+(v-BOUND.y0)*sc; }
  c.clearRect(0,0,W,H);
  c.strokeStyle='rgba(120,180,150,.32)'; c.lineWidth=1;
  c.strokeRect(X(BOUND.x0),Y(BOUND.y0),bw*sc,bh*sc);
  c.fillStyle='rgba(170,180,170,.22)';
  for(var ri=0;ri<ROADS.length;ri++){ var rd=ROADS[ri]; c.fillRect(X(rd[0]),Y(rd[1]),(rd[2]-rd[0])*sc,(rd[3]-rd[1])*sc); }
  for(var i=0;i<OBJ.length;i++){
    var o=OBJ[i];
    if(o.k==='roof') c.fillStyle='rgba(190,125,116,.55)';
    else if(o.k==='link') c.fillStyle='rgba(139,58,46,.55)';
    else if(o.k==='field'||o.k==='court'||o.k==='track') c.fillStyle='rgba(90,140,90,.32)';
    else c.fillStyle='rgba(110,140,110,.24)';
    c.fillRect(X(o.x),Y(o.y),o.w*sc,o.h*sc);
  }
  var px=X(S.x/SC), py=Y(S.y/SC);
  /* 室内坐标不是室外地图上的位置（在车库里点会落到行政楼上）：室内就标在所在那栋楼上 */
  var R=S.mode==='in'?INTERIORS[S.room]:null, ho=R?objById(R.host):null;
  if(ho){ px=X(ho.x+ho.w/2); py=Y(ho.y+ho.h/2); }
  c.fillStyle='#79c8a4';
  c.beginPath(); c.arc(px,py,2.6,0,6.283); c.fill();
  c.strokeStyle='rgba(121,200,164,.85)'; c.lineWidth=1.4;
  c.beginPath(); c.moveTo(px,py);
  c.lineTo(px+Math.cos(S.ang)*9,py+Math.sin(S.ang)*9); c.stroke();
}
var hudT=0;
var AN_NAME={rain:'大暴雨',moth:'蛾群',turn:'被拍肩膀',broad:'广播点名',bell13:'钟敲十三下',
  exercise:'操场做操',bells:'车棚齐鸣',hand:'隔间递手',repeat:'你作业交了吗',chalk:'黑板上的字',
  loop:'无尽的走廊',roster:'被划掉的名字',leak:'天花板渗水',rite:'实验楼仪式',cold:'冷库',
  shifting:'窗外的楼在动',stare:'全体回头',lamps:'熄灯后的走廊灯',feast:'食堂盛宴',
  necker:'围墙外的行人',shadow:'影子慢一拍',twin:'天台的第二个你',raindots:'雨点成字',cup:'清华水杯'};

var markT=0, dtG=0.016;
function updateMarker(dt){
  var m=GLR.marker||ensureMarker();
  if(!m) return;
  if(S.mode!=='in'||S.dead||S.screen!=='play'||PAUSE.on||(typeof UI!=='undefined'&&UI.anyOpen())){ m.visible=false; return; }
  markT-=dt;
  if(markT<=0){
    markT=0.1;
    var hit=nearWorld(24);
    if(!hit){ m.visible=false; GLR.markHit=null; return; }
    GLR.markHit=hit;
    var R=INTERIORS[S.room];
    var p=worldToScene(hit.x,hit.y,R);
    var hy=Math.min(2.55,(typeof furnH==='function'?furnH(hit.ch):0.9)+0.22);
    m.position.set(p.x,hy,p.z);
    m.visible=true;
  }
  if(m.visible&&GLR.markHit){
    m.quaternion.copy(GLR.cam.quaternion);
    var pu=1+0.09*Math.sin((GLR.time||0)*4.2);
    m.scale.set(pu,pu,pu);
  }
}
function updateIntro(dt){
  if(!(S.intro>0)) return;
  S.intro-=dt;
  var b=document.getElementById('banner');
  if(!b) return;
  if(S.intro>0){
    b.textContent=String(Math.ceil(S.intro));
    b.style.opacity='1';
    b.style.fontSize='64px';
  }else{
    b.textContent='';
    b.style.opacity='0';
    b.style.fontSize='';
  }
}
function updateHUD(){
  var san=document.getElementById('sanbar');
  if(san){
    san.style.width=clamp(S.san,0,100)+'%';
    san.style.background=S.san>60?'#79c8a4':(S.san>30?'#c8b24a':'#c8554a');
  }
  document.getElementById('clock').textContent=fmtClock(S.tsec);
  var _sc=document.getElementById('secclock');                /* 手表 / 秒表天赋：右上角显示到秒 */
  if(_sc){ var _hs=hasSeconds(); _sc.hidden=!_hs; if(_hs) _sc.textContent=fmtClockS(S.tsec); }
  var cr=document.getElementById('cross');
  if(cr){ cr.style.display=playerInputAllowed()?'block':'none'; }
  var sn=document.getElementById('sannum');
  if(sn) sn.textContent=Math.round(S.san);
  try{ anwTick(dtG); }catch(e){}
  try{ updateMarker(dtG); }catch(e){}
  document.getElementById('place').textContent=currentPlaceName();
  var p=periodAt(S.tsec);
  var _pe=document.getElementById('period');
  _pe.textContent=onLeave()?('请假中 · 还剩 '+leaveLeft()+' 分钟'):((S.exam&&p[3]==='教室')?('考试 · '+p[2]):(p[2]+' · '+needWhere(S.tsec)));
  /* 时段前面的小圆点：绿 = 在该在的地方；黄 = 不在，违规在涨；蓝 = 请假中；红 = 考试 */
  var _pc=onLeave()?'leave':(S.wrong?'warn':(S.exam&&p[3]==='教室'?'exam':'ok'));
  if(_pe.className!==_pc) _pe.className=_pc;
  var sw=document.getElementById('stamwrap');
  if(sw){ var _sn=(S.snackT||0)>0;          /* 士力架起效时，体力条变成金色的剩余时间 */
    var _sr=document.getElementById('stamrow'), _show=(S.stam<99.5||_sn);
    if(_sr&&_sr.hidden===_show) _sr.hidden=!_show;
    var _sb=document.getElementById('stambar');
    _sb.style.width=(_sn?clamp(S.snackT/SNACK_SEC*100,0,100):clamp(S.stam,0,100))+'%';
    _sb.style.background=_sn?'#d8b45a':(S.tired?'#b0705a':''); }   /* 喘气时变红，回到能跑才变回蓝 */
  UI.renderHot();
  updateTouchUI();
  var pr=document.getElementById('prompt');
  var hint='';
  /* 字幕显示时也要给提示：字幕很频繁，以前站在门口常常看不到"E 开门" */
  if(!S.dead&&S.screen==='play'&&!UI.anyOpen()&&!PAUSE.on){
    var _R=S.mode==='in'?INTERIORS[S.room]:null, _h0=_R?nearWorld(24):null;
    /* 和 tryInteract 的先后一致：设施、恢复 SAN 的动作排在"坐下"前面 */
    var _first=_h0&&(FAC_CD[_h0.ch]!==undefined||sanActFor(_R,_h0));
    if(HIDE.on) hint='E 出来';
    else if(bellReach()) hint='E 撞钟';
    else if(nearRoster()) hint='E 那张名单';
    else if(S.seated) hint='E 站起来';
    else if(_R&&!_first&&hit2_seatNear(_R)) hint='E 坐下';
    else if(S.mode==='in'){
      var h=nearWorld(24);
      if(h){
        if(h.ch==='='){
          var _nd=doorLockNeed(INTERIORS[S.room],h.c,h.r);
          hint=(_nd&&!hasItem(_nd))?'E 开门（锁着）':'E 开门';
        }
        else if(h.ch==='O') hint='E 出去';
        else if(h.ch==='H') hint='E 躲进柜子';
        else if(h.ch==='M') hint=hasItem('coin')?'E 投币（售货机）':'E 售货机';
        else if(INTERIORS[S.room].host==='canteen'&&(h.ch==='k'||h.ch==='t')&&!mealNow()) hint=hasItem('coin')?'E 投币买饭':'E 打饭窗口';
      else if(h.ch==='L') hint='E 走连廊';
      else if(h.ch==='Q') hint='E 看服务器终端';
        else if(h.ch==='S') hint='E 上下楼';
        else if(h.ch==='P') hint='E 坐下';
        else if(h.ch==='c') hint='E 上车';
        else if(h.ch==='D') hint=(S.room==='lab3')?'E 门禁管理终端':'E 使用终端';
        else if(h.ch==='X') hint='E 钻进去';
        else if(h.ch==='K') hint=(INTERIORS[S.room]&&INTERIORS[S.room].host==='admin')?'E 看办公桌':'E 看实验台';
        else if(h.ch==='Z') hint='E 放开单摆';
        else if(h.ch==='C') hint='E 开离心机';
        else if(h.ch==='N') hint='E 看显微镜';
        else if(h.ch==='Y') hint='E 转地球仪';
        else if(h.ch==='p') hint='E 弹琴';
        else if(h.ch==='U') hint='E 撞钟';
        else if(h.ch==='A') hint='E 看供桌';
        else if(h.ch==='x') hint='E 看挂图';
        else if(h.ch==='V') hint='E 上车';
        else if(h.ch==='B'||h.ch==='G') hint='E 隔间';
        else if(h.ch==='w') hint='E 洗把脸';
        else if(h.ch==='b') hint=(sanActFor(INTERIORS[S.room],h)?'E 躺一会儿':'E 床');
        else if(h.ch==='n') hint='E 用电脑';
        else hint='E 翻找';
      }
    }else{
      var nb=nearWorld(0);
      var oact=nb?null:sanActFor(null,null);
      if(nb) hint='E 进入 '+nb.obj.n;
      else if(oact) hint='E '+SAN_ACTS[oact].n+'（SAN +'+SAN_ACTS[oact].san+'，'+SAN_ACTS[oact].min+' 分钟）';
      else if(Math.sqrt(dist2(GATE_N.x*SC,GATE_N.y*SC,S.x,S.y))<70) hint='E 校门';
      else if(Math.sqrt(dist2(GATE_W.x*SC,GATE_W.y*SC,S.x,S.y))<70) hint='E 西小门';
      else if(Math.sqrt(dist2(GATE_S.x*SC,GATE_S.y*SC,S.x,S.y))<70) hint='E 南门';
    }
  }
  var label=hint.replace(/^E /,'');
  if(pr){
    if(hint){ if(pr._l!==label){ pr._l=label; pr.innerHTML='<kbd>E</kbd>'+label; } pr.style.display='block'; }
    else { pr._l=''; pr.style.display='none'; }
  }
  /* 触屏：交互键上直接写当前能做的事（「坐下」「开门」…），没有可做的事就变暗 */
  var ta=document.getElementById('tActL');
  if(ta){
    var short=label.replace(/（.*$/,'').replace(/^进入 /,'进 ')||'交互';
    if(ta.textContent!==short){ ta.textContent=short; ta.parentNode.className='tbtn'+(label?' live':'')+(short.length>4?' long':''); }
  }
  var tt=document.getElementById('tTorch');
  if(tt){ var tc='tsm'+(USE.torch?' on':'')+(hasItem('torch')?'':' off'); if(tt.className!==tc) tt.className=tc; }
}

var introT1=0;
function clearIntroTimers(){
  if(introT1){ clearTimeout(introT1); introT1=0; }
  var el=document.getElementById('sub');
  if(el){ el.style.opacity='0'; setTimeout(function(){ if(!DLG.open) el.style.display='none'; },240); }
  DLG.open=false; DLG.timer=0; DLG.keep=false; DLG.queue.length=0;
}
function freshState(diff){
  clearSearch();
  resetInputState();releaseMouseLook();UI.closePanelAll();UI.closeChoice();
  spiralReset();
  buildInteriorData();
  buildRoomBounds();
  S.screen='play';
  S.diff=diff||'easy';
  var t=TAL_KEYS[Math.floor(Math.random()*TAL_KEYS.length)];
  S.talent=t;
  S.tsec=700; S.day=1;
  S.san=100; S.viol=0; S.stam=100; S.tired=false; S.snackT=0; S.pillT=0; S.tt=0; S.ttTier=0;
  S.actCool={}; S.immuneUsed=false;
  S.exam=false; S.examCur=null; S.examSeat=0; S.examTot=0;
  try{ patReset(); PAT.next=45; }catch(e){}
  S.bag=[]; S.hot=[null,null]; S.bagSel=0;
  S.spots={}; S.clues={}; S.notes={}; S.marks={};
  S.dead=false; S.death=null; S.deadT=0; S.eyeLift=0; S.seated=false; S.intro=0;
  S.fn={v:0,on:false,note:false,n:0,next:0,shown:false};
  S.mode='out'; S.room=null;
  S.x=GATE_N.x*SC; S.y=(GATE_N.y+40)*SC;
  S.ang=PI/2; S.pitch=0; S.eyeH=EYE;
  S.hiddenLatch=false; S.hiddenAsked=false; S.hiddenWindow=0; S.dangerSeen={};
  RT=newRT(); USE={torch:false,phone:false,brollyShield:false}; OPENDOORS={}; syncUseState();
  try{ PHONE.stop(); PHONE.cool=0; MONO.t=30; MONO.recent=[]; }catch(e){}
  AN.id=null; AN.active=false; AN.next=(S.diff==='hard')?40:60; AN.rained=false; AN.cool={}; AN.lastBig=false; AN.t=0; AN.acc=0;
  AN.pre=null; AN.preNext=0; AN.locked=false; AN.lockWait=0;
  ROAM.on=false;
  ENTS=[]; PAUSE.on=false; document.body.classList.remove('paused');
  try{ NC.done=false; ncClear(); }catch(e){}
  try{ skipClear(); }catch(e){}
  try{ anfxClear(); }catch(e){}
  document.getElementById('menu').style.display='none';
  document.getElementById('die').style.display='none';
  var _tel=document.getElementById('talent'); if(_tel) _tel._set=false;
  var _hot=document.getElementById('hot'); if(_hot) _hot._sig='';
  if(!running){ running=true; lastT=0; }
}
var Game={
  start:function(diff){
    try{
    freshState(diff);
    var R1=INTERIORS['teach1'];
    /* 淡入要等一会儿：这段时间里人还算站在北门，会被当成"去过北门"。先把人放到座位上。 */
    S.mode='in'; S.room='teach1'; S.x=R1.ox+48.5*9; S.y=R1.oy+6.5*9; S.seated=true;
    enterRoom('teach1',{x:S.x, y:S.y, ang:-PI/2, seated:true});
    syncCamera(0);
    clearIntroTimers();
    var firstTime=false;
    try{ firstTime=!proSeen(); }catch(e){}
    if(firstTime){
      setTimeout(function(){ try{ proShow(); }catch(e){} },320);
    }else{
      try{ GLR.worldNorm=0; }catch(e){}      /* 老玩家直接进里世界，没有"正常世界"那一段 */
      setTimeout(function(){ try{ os('我：今天和昨天没有什么不一样。每一天，都和昨天没有什么不一样。',4.0); }catch(e){} },2400);
      introT1=setTimeout(function(){ os('我：兜里有一张学生证。照片上的人我不认识，可是班号、学号，都是我的。',4.8); },6800);
      os('我：11:40。第四节。我坐在自己的位子上——至少，名牌上写的是我的名字。',4.8);
    }
    SFX.resume();
    }catch(e){ try{ showErr('Game.start: '+e.message); }catch(_e){} }
  },
  continue_:function(){
    var d=loadGame();
    if(!d){ toast('没有存档'); return; }
    clearIntroTimers();
    freshState(d.diff);
    S.mode=d.mode||'out'; S.room=d.room||null;
    S.x=d.x; S.y=d.y; S.ang=d.ang||0; S.pitch=d.pitch||0;
    S.tsec=d.tsec; S.day=d.day; S.san=d.san; S.viol=d.viol; S.stam=d.stam;
    if(d.clockVersion!==2&&S.tsec>=0&&S.tsec<60) S.tsec+=1440;
    S.tired=(typeof d.tired==='boolean')?d.tired:S.stam<=6;
    S.snackT=Number.isFinite(d.snackT)?clamp(d.snackT,0,SNACK_SEC):0;
    S.pillT=Number.isFinite(d.pillT)?clamp(d.pillT,0,PILL_SEC):0;
    PHONE.cool=Number.isFinite(d.phoneCool)?clamp(d.phoneCool,0,PH_COOL):0;
    S.actCool=(d.actCool&&typeof d.actCool==='object'&&!Array.isArray(d.actCool))?Object.assign({},d.actCool):{};
    if(d.clockVersion!==2){
      var oldClock=(d.day||1)*1440+d.tsec, newClock=gameClock();
      Object.keys(S.actCool).forEach(function(k){ if(Number.isFinite(S.actCool[k])) S.actCool[k]=newClock+Math.max(0,S.actCool[k]-oldClock); });
    }
    S.immuneUsed=!!d.immuneUsed;
    S.tt=d.tt||0; S.ttTier=d.ttTier||0;
    S.exam=!!d.exam; S.examCur=(d.examCur===undefined)?null:d.examCur; S.examSeat=d.examSeat||0; S.examTot=d.examTot||0;
    S.bag=d.bag||[]; S.hot=d.hot||[null,null];
    S.talent=d.talent||S.talent; S.spots=d.spots||{}; S.clues=d.clues||{};
    S.seated=!!d.seated;
    S.hiddenLatch=!!d.hiddenLatch; S.hiddenAsked=false;
    S.hiddenWindow=Number.isFinite(d.hiddenWindow)?d.hiddenWindow:(S.hiddenLatch?3.2:0);
    if(d.hiddenAsked&&S.hiddenLatch) S.hiddenWindow=0; /* 读档后重新呈现尚未回答的选择 */
    if(d.fn) S.fn=Object.assign({v:0,on:false,note:false,n:0,next:0,shown:false},d.fn);
    if(d.rt) RT=Object.assign(newRT(),d.rt);
    if(d.use) USE=d.use;
    syncUseState();
    if(d.openDoors) OPENDOORS=d.openDoors;
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
    if(S.mode==='in'&&S.room==='garage1'&&d.roam&&typeof d.roam==='object') Object.assign(ROAM,d.roam);
    function restoreAnomalyFX(){
      if(!AN.id||!AN.active) return;
      try{
        if(HAS_FX[AN.id]) anfxSpawn(AN.id,S.x,S.y);      /* 和 anOn 共用一张表：以前这里另抄了一份，新异象（水杯、雨点成字）读档后看不见 */
      }catch(e){}
      if(AN.id==='roster'&&!AN.data.done&&Number.isFinite(d.anChoiceMs)) useRoster(d.anChoiceMs);
    }
    if(S.mode==='in'&&S.room) enterRoom(S.room,{x:S.x,y:S.y,ang:S.ang,seated:S.seated,spiral:d.spiral},restoreAnomalyFX);
    else { S.mode='out'; S.room=null; enterWorldOut(); syncCamera(0); restoreAnomalyFX(); }
    var _tel2=document.getElementById('talent'); if(_tel2) _tel2._set=false;
    var _hot2=document.getElementById('hot'); if(_hot2) _hot2._sig='';
    SFX.resume();
  },
  pause:function(){
    try{ paintSet(); }catch(e){}
    if(S.screen!=='play'||S.dead||PAUSE.on)return;
    PAUSE.on=true;
    var pt=document.getElementById('ptalent');
    if(pt&&TALENTS[S.talent])pt.textContent='天赋 · '+TALENTS[S.talent].n+'　'+TALENTS[S.talent].d;
    var pk=document.getElementById('pkeys');
    if(pk) pk.innerHTML=IS_TOUCH?
      '<span>左下摇杆</span>移动（推到底就是跑）<span>右侧滑动</span>环视<span>交互键</span>上面写着能做的事<span>手册</span>背包 · 思索 · 笔记 · 地图':
      '<span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span>移动<span><kbd>Shift</kbd></span>奔跑<span><kbd>E</kbd></span>交互<span><kbd>F</kbd></span>手电'+
      '<span><kbd>1</kbd><kbd>2</kbd></span>快捷栏<span><kbd>G</kbd></span>丢弃选中<span><kbd>Tab</kbd></span>背包<span><kbd>H</kbd></span>思索<span><kbd>J</kbd></span>笔记<span><kbd>M</kbd></span>地图';
    document.body.classList.add('paused');
    UI.open('pause');
  },
  pauseToggle:function(){
    if(PAUSE.on)Game.resume();else Game.pause();
  },
  resume:function(){
    if(S.screen!=='play'||S.dead)return;
    UI.closePanelAll();resetInputState();
    PAUSE.on=false; document.body.classList.remove('paused');
    if(running){lastT=performance.now();accum=0;}
    resumeMouseLook();updateTouchUI();
  },
  saveNow:function(){
    if(saveGame()) toast('已保存');
    else toast('保存失败');
    Game.resume();
  },
  quit:function(){
    running=true;
    clearSearch();
    try{ patReset(); }catch(e){}
    clearIntroTimers();
    S.screen='menu'; S.dead=false;
    PHONE.stop();
    resetInputState();releaseMouseLook();
    try{ if(!MENU_PHOTO) setTimeout(captureMenuPhoto,320); }catch(e){}
    try{ if(CUT.on){ CUT.done=null; cutFinish(); } }catch(e){}
    GLR.worldNorm=0;
    PAUSE.on=false;document.body.classList.remove('paused');UI.closePanelAll();UI.closeChoice();
    ['pause','die','bag','note','think','mapv','choices'].forEach(function(id){
      var e=document.getElementById(id); if(e) e.style.display='none';
    });
    var es=document.getElementById('ends'); if(es) es.remove();
    document.getElementById('menu').style.display='block';
    document.getElementById('sub').style.display='none';
    paintMenuSave();
  }
};
var MENU_PHOTO=null, PHOTO_TRIED=false;
function captureMenuPhoto(){
  if(PHOTO_TRIED) return;
  if(typeof S==='undefined'||S.screen!=='menu'){ PHOTO_TRIED=true; return; }
  PHOTO_TRIED=true;
  try{
    if(typeof GLR==='undefined'||!GLR.renderer||!GLR.postScene) return;
    var cv=document.getElementById('cv'), menu=document.getElementById('menu');
    if(!cv||!menu||!cv.toDataURL) return;
    var saveT=S.tsec;
    S.tsec=1338;                                  /* 22:18 —— 菜单那张照片是夜里拍的 */
    enterWorldOut();
    var c=GLR.cam, yaw=-0.35;
    c.position.set(66.7,7.0,133.3);
    c.fov=74; c.updateProjectionMatrix();
    c.lookAt(66.7+Math.cos(yaw)*12, 6.4, 133.3+Math.sin(yaw)*12);
    var u=GLR.postMat.uniforms;
    u.uTime.value=0.6; u.uHurt.value=0; u.uFlash.value=0; u.uSan.value=0.62;
    GLR.renderer.setRenderTarget(GLR.rt);
    GLR.renderer.clear();
    GLR.renderer.render(GLR.scene,c);
    GLR.renderer.setRenderTarget(null);
    GLR.renderer.render(GLR.postScene,GLR.postCam);
    var url=cv.toDataURL('image/jpeg',0.84);
    if(url&&url.length>20000){
      MENU_PHOTO=url;
      menu.style.backgroundImage='radial-gradient(ellipse at 72% 42%,rgba(10,18,22,.34),rgba(3,6,9,.92) 62%),url('+url+')';
      menu.style.backgroundSize='cover';
      menu.style.backgroundPosition='center 58%';
      menu.style.backgroundColor='#04070a';
    }
    S.tsec=saveT;
    clearWorldMesh();                             /* 菜单里不留实时场景 */
    S.mode='in'; S.room=null;
  }catch(e){}
}

var ERR_SHOWN=false;
function showErr(msg){
  if(ERR_SHOWN) return;
  ERR_SHOWN=true;
  try{
    var el=document.getElementById('errbox');
    if(!el){
      el=document.createElement('div'); el.id='errbox';
      el.style.cssText='position:fixed;left:0;right:0;top:0;z-index:99999;background:#3a0d0d;color:#ffd9d0;'+
        'font:12px/1.7 Consolas,monospace;padding:10px 14px;white-space:pre-wrap;max-height:46%;overflow:auto;'+
        'border-bottom:2px solid #a33;';
      document.body.appendChild(el);
    }
    el.textContent='【运行错误】'+msg+'\n（把这一行发给开发者）';
  }catch(e){}
}
try{
  window.addEventListener('error',function(e){
    showErr((e.message||'unknown')+'  @'+(e.filename||'')+':'+(e.lineno||0));
  });
  window.addEventListener('unhandledrejection',function(e){
    var r=e&&e.reason, msg=String((r&&r.message)||r||'unknown');
    /* 这些是浏览器策略问题，不是游戏出错 */
    if(/pointer lock|fullscreen|user gesture|NotAllowedError|SecurityError|AudioContext|play\(\)/i.test(msg)) return;
    showErr('Promise: '+msg);
  });
}catch(e){}

function boot(){
  loadSet();
  try{ if(IS_TOUCH&&document.body&&document.body.classList) document.body.classList.add('touch'); }catch(e){}
  try{ initMobileShell(); }catch(e){}
  try{ if((location.search||'').indexOf('dev')>=0) setTimeout(function(){ try{ Dev.open(); }catch(e){} }, 500); }catch(e){}
  try{
    if((location.search||'').indexOf('nocss')>=0){
      ['vig','scan','fade','flash'].forEach(function(id){
        var e=document.getElementById(id); if(e) e.style.display='none';
      });
    }
  }catch(e){}
  buildInteriorData();
  buildRoomBounds();
  initGL();
  GFX.select();
  applyBrightness();
  try{ shadeApplyQuality(); }catch(e){}
  initInput();
  try{ initPcTouch(); }catch(e){}
  paintMenuSave();
  requestAnimationFrame(frame);
  setTimeout(captureMenuPhoto,420);               /* 先让菜单画出来，再拍那张照片 */
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot);
else boot();
