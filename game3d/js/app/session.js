/* 会话应用入口：新局、恢复、退出和界面模式。旧 Game/freshState 名称保留为兼容 API。 */
'use strict';

var introT1=0;
function clearIntroTimers(){
  Lifecycle.renew('intro');
  introT1=0;
  var el=document.getElementById('sub');
  if(el){ el.style.opacity='0'; Lifecycle.scope('intro').timeout(function(){ if(!DLG.open) el.style.display='none'; },240); }
  DLG.open=false; DLG.timer=0; DLG.keep=false; DLG.queue.length=0;
}
var FRESH_TALENT=null;           /* 新局要用的天赋：选择界面确认后才填，freshState 用完即清 */
function freshState(diff){
  Lifecycle.boundary('new-session');
  ExplorationMap.clear();
  document.getElementById('notequery').value='';
  buildInteriorData();
  buildRoomBounds();
  S.screen='play';
  S.diff=diff||'easy';
  Talent.begin(FRESH_TALENT&&FRESH_TALENT.id,FRESH_TALENT&&FRESH_TALENT.origin); FRESH_TALENT=null;   /* 天赋：开局前选好的（talents.js） */
  S.tsec=700; S.day=1;
  S.san=100; S.viol=0; S.stam=100; S.tired=false; S.snackT=0; S.pillT=0; S.tt=0; S.ttTier=0;
  Engine.resetSan(S.san);
  S.actCool={};                                   /* 免疫用没用过记在 talentState（S.immuneUsed 只是旧字段的别名） */
  S.exam=false; S.examCur=null; S.examSeat=0; S.examTot=0;
  try{ patReset(); PAT.next=45; }catch(e){}
  S.bag=[]; S.hot=[null,null]; S.bagSel=0;
  S.spots={}; S.clues={}; S.notes={}; S.marks={};
  S.dead=false; S.death=null; S.deadT=0; S.eyeLift=0; S.deathView=null; S.seated=false; S.intro=0;
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
  document.getElementById('menu').style.display='none';
  document.getElementById('die').style.display='none';
  var _tel=document.getElementById('talent'); if(_tel) _tel._set=false;
  var _hot=document.getElementById('hot'); if(_hot) _hot._sig='';
  GameModules.resetAll();                        /* 模块和 Mod 的本局状态（粉笔记号、迷宫计时……）清空 */
  if(!running){ running=true; lastT=0; }
}
var pendingAssetStart=null;
function waitForGameAssets(start){
  if(Assets.anyReady())return false;
  pendingAssetStart=start;var assetScope=Lifecycle.renew('asset-start');assetNotice('正在加载模型……',true);
  Assets.load(Assets.want(),assetScope.guard(function(lod){
    if(!pendingAssetStart)return;
    if(Assets.anyReady()&&S.screen==='menu'){
      var ready=pendingAssetStart;pendingAssetStart=null;ready();
    }else if(lod===null)pendingAssetStart=null;
  }));
  return true;
}
var Game={
  /* 选完难度先选天赋（《天赋系统重构》5.1）：只有点「开始」才初始化新局、覆盖旧存档 */
  pickTalent:function(diff,mode){ TalentPick.open(diff,mode||'normal'); },
  start:function(diff,opt){
    if(waitForGameAssets(function(){Game.start(diff,opt);}))return;
    try{
    FRESH_TALENT=opt&&opt.talent?{id:opt.talent,origin:opt.origin||'selected'}:null;
    if(opt&&opt.mode==='speedrun'){ if(!Speedrun.active()) Speedrun.arm(diff); Dev.clearModifiers(); }   /* 普通局留下的快跑 / 无敌 / 关读条不带进速通 */
    else Speedrun.disarm();                                    /* 普通新局：回到普通存档槽 */
    freshState(diff);
    GameModules.emit('newGame',{diff:diff,mode:opt&&opt.mode==='speedrun'?'speedrun':'normal'});   /* 模块：只在新开局（不含读档）时做的事 */
    Playtest.event('开始新局',diff);
    var R1=INTERIORS['teach1'];
    /* 淡入要等一会儿：这段时间里人还算站在北门，会被当成"去过北门"。先把人放到座位上。 */
    S.mode='in'; S.room='teach1'; S.x=R1.ox+48.5*9; S.y=R1.oy+6.5*9; S.seated=true;
    enterRoom('teach1',{x:S.x, y:S.y, ang:-PI/2, seated:true});
    syncCamera(0);
    clearIntroTimers();
    /* 开场 CG（opening.js）：第一次完整版、看过的短版，随时可跳过；演完或跳过都在同一个座位、同一个视角交还控制 */
    try{ Opening.play(); }catch(e){ try{ proShow(); }catch(_e){} }
    SFX.resume();
    /* 开局先把死亡演出、结局过场要用的着色器编好（第一次进场景、前情提要的时候顿一下，不在死的那一刻顿） */
    Lifecycle.scope('session').timeout(function(){ try{ DeathCG.warm(); }catch(e){} },700);
    Lifecycle.scope('session').timeout(function(){ try{ if(running&&typeof cupMats==='function') cupMats(); }catch(e){} },12000);   /* 清华水杯的油画：游戏跑起来以后再画（约几十毫秒），第一次见到杯子时不用现画 */
    }catch(e){ try{ showErr('Game.start: '+e.message); }catch(_e){} }
  },
  continue_:function(){
    if(waitForGameAssets(function(){Game.continue_();}))return;
    Speedrun.disarm();                                         /* 速通不能读档接着跑；「继续上次」只读普通存档 */
    var d=loadGame();
    if(!d){ toast('没有存档'); return; }
    clearIntroTimers();
    freshState(d.diff);
    d=applySave(d);
    restoreSavePresentation();
    Engine.resetSan(S.san);
    function restoreAnomalyFX(){
      if(PAT.state==='walk'){
        var room=PAT.room==='out'?null:INTERIORS[PAT.room];
        if(Collision.depth(PAT.x,PAT.y,PAT_BODY/U2M,room)>1e-7)patReset();
        else patAddFig();
      }
      if(!AN.id||!AN.active) return;
      try{
        if(HAS_FX[AN.id]) anfxSpawn(AN.id,S.x,S.y);      /* 和 anOn 共用一张表：以前这里另抄了一份，新异象（水杯、雨点成字）读档后看不见 */
      }catch(e){}
      if(AN.id==='roster'&&!AN.data.done&&Number.isFinite(d.anChoiceMs)) useRoster(d.anChoiceMs);
    }
    if(S.mode==='in'&&S.room) enterRoom(S.room,{x:S.x,y:S.y,ang:S.ang,seated:S.seated,spiral:d.spiral,restoreVisit:true},restoreAnomalyFX);
    else { S.mode='out'; S.room=null; enterWorldOut(); syncCamera(0); restoreAnomalyFX(); }
    Lifecycle.scope('session').timeout(function(){ try{ DeathCG.warm(); }catch(e){} },700);
    Lifecycle.scope('session').timeout(function(){ try{ if(running&&typeof cupMats==='function') cupMats(); }catch(e){} },12000);   /* 清华水杯的油画：游戏跑起来以后再画（约几十毫秒），第一次见到杯子时不用现画 */
    var _tel2=document.getElementById('talent'); if(_tel2) _tel2._set=false;
    var _hot2=document.getElementById('hot'); if(_hot2) _hot2._sig='';
    SFX.resume();
  },
  pause:function(){
    try{ paintSet(); }catch(e){}
    if(S.screen!=='play'||S.dead||PAUSE.on)return;
    PAUSE.on=true;
    var pt=document.getElementById('ptalent');
    if(pt)pt.textContent=Talent.pauseText();                     /* 任何状态都重新生成，不留上一次的文字 */
    var pk=document.getElementById('pkeys');
    if(pk) pk.innerHTML=IS_TOUCH?
      '<span>左下摇杆</span>移动（推到底就是跑）<span>右侧滑动</span>环视<span>交互键</span>上面写着能做的事<span>手册</span>背包 · 思索 · 笔记 · 地图':
      '<span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span>移动<span><kbd>Shift</kbd></span>奔跑<span><kbd>E</kbd></span>交互<span><kbd>F</kbd></span>手电'+
      '<span><kbd>1</kbd><kbd>2</kbd></span>快捷栏<span><kbd>G</kbd></span>丢弃选中<span><kbd>Tab</kbd></span>背包<span><kbd>H</kbd></span>思索<span><kbd>J</kbd></span>笔记<span><kbd>M</kbd></span>地图'+
      '<span><kbd>Alt</kbd></span>放出鼠标，游戏不暂停；点画面收回';
    if(pk&&CarChase.active())pk.textContent=IS_TOUCH?'驾驶：摇杆向前加速、左右转向、向后刹车。':'驾驶：W / ↑ 加速，A D / ← → 转向，S / ↓ 刹车。';
    document.body.classList.add('paused');
    try{ Playtest.paint(); }catch(e){}
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
    if(typeof CarChase!=='undefined'&&CarChase.active()){autoSave();CarChase.clearVisual();}
    Lifecycle.boundary('menu');
    running=true;
    S.screen='menu'; S.dead=false;
    PAUSE.on=false;document.body.classList.remove('paused');
    if(!MENU_PHOTO)Lifecycle.scope('session').timeout(captureMenuPhoto,320);
    ['pause','die','bag','note','think','mapv','choices'].forEach(function(id){
      var e=document.getElementById(id); if(e) e.style.display='none';
    });
    var es=document.getElementById('ends'); if(es) es.remove();
    document.getElementById('menu').style.display='block';
    document.getElementById('sub').style.display='none';
    paintMenuSave();
  }
};

/* 清理注册表只在应用组合层接线。模块内部字段由模块自己的清理函数处理。 */
Lifecycle.register('pending-start',function(){pendingAssetStart=null;});
Lifecycle.register('prologue',function(){proCancel();});
Lifecycle.register('cutscene',function(){if(CUT.on){CUT.done=null;cutFinish();}});
Lifecycle.register('death',function(){S.deadId=(S.deadId||0)+1;DEATH_PENDING=null;});
Lifecycle.register('preview',function(){if(DEV.on)Dev.close(false);Dev.clearPreview();Dev.clearAnimation();});
Lifecycle.register('world-effects',function(){CarChase.clearVisual();Inspection.clearFx();fnPeopleClear();Engine.resetFakeNormal();VisualState.worldNorm=0;anfxClear();});
Lifecycle.register('lesson',function(){LESSON.waiting=null;LESSON.close(false);});
Lifecycle.register('interaction',function(){clearSearch();resetInputState();releaseMouseLook();UI.closePanelAll();UI.closeChoice();});
Lifecycle.register('patrol',function(){patReset();});
Lifecycle.register('dread',function(){Dread.reset();});
Lifecycle.register('classmates',function(){NC.done=false;ncClear();skipClear();});
Lifecycle.register('spiral',function(){spiralReset();});
Lifecycle.register('phone',function(){PHONE.stop();});
Lifecycle.register('computer',function(){PCGAME.cancel();});
Lifecycle.register('intro',function(){clearIntroTimers();});
Lifecycle.register('game-modules',function(reason){GameModules.emit('boundary',reason);});   /* 模块和 Mod：上一局的画面、计时在这里收掉 */
Lifecycle.register('opening',function(){Opening.cancel();});                 /* 新局开场 CG：没演完的直接收掉 */
Lifecycle.register('day-decor',function(){DayDecor.clear();});               /* 校庆横幅 */
Lifecycle.register('speedrun',function(reason){                            /* 速通中途回菜单：记放弃，丢掉速通的存档槽 */
  if(reason!=='menu')return;
  Speedrun.fail('abandoned','quit');
  if(RUN_MODE==='speedrun')clearSave();
  RUN_MODE='normal';Speedrun.paintHud(true);
});
