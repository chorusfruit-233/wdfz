/* @module-capsule */
(function($imports){
/* 会话应用入口：新局、恢复、退出和界面模式。旧 Game/freshState 名称保留为兼容 API。 */
'use strict';

var introT1=0;
function clearIntroTimers(){
  $imports.Lifecycle.renew('intro');
  introT1=0;
  var el=document.getElementById('sub');
  if(el){ el.style.opacity='0'; $imports.Lifecycle.scope('intro').timeout(function(){ if(!$imports.DLG.open) el.style.display='none'; },240); }
  $imports.DLG.open=false; $imports.DLG.timer=0; $imports.DLG.keep=false; $imports.DLG.queue.length=0;
}
var FRESH_TALENT=null;           /* 新局要用的天赋：选择界面确认后才填，freshState 用完即清 */
function freshState(diff){
  $imports.Lifecycle.boundary('new-session');
  $imports.ExplorationMap.clear();
  document.getElementById('notequery').value='';
  (0,$imports.buildInteriorData)();
  (0,$imports.buildRoomBounds)();
  $imports.S.screen='play';
  $imports.S.diff=diff||'easy';
  $imports.S.seat=null;
  $imports.Talent.begin(FRESH_TALENT&&FRESH_TALENT.id,FRESH_TALENT&&FRESH_TALENT.origin); FRESH_TALENT=null;   /* 天赋：开局前选好的（talents.js） */
  $imports.S.tsec=700; $imports.S.day=1;
  $imports.S.san=100; $imports.S.viol=0; $imports.S.stam=100; $imports.S.tired=false; $imports.S.snackT=0; $imports.S.pillT=0; $imports.S.tt=0; $imports.S.ttTier=0;
  $imports.Engine.resetSan($imports.S.san);
  $imports.S.actCool={};                                   /* 免疫用没用过记在 talentState（S.immuneUsed 只是旧字段的别名） */
  $imports.S.exam=false; $imports.S.examCur=null; $imports.S.examSeat=0; $imports.S.examTot=0;
  try{ (0,$imports.patReset)(); }catch(e){}
  $imports.S.bag=[]; $imports.S.hot=[null,null]; $imports.S.bagSel=0;
  $imports.S.spots={}; $imports.S.clues={}; $imports.S.notes={}; $imports.S.marks={};
  $imports.S.dead=false; $imports.S.death=null; $imports.S.deadT=0; $imports.S.eyeLift=0; $imports.S.deathView=null; $imports.S.seated=false; $imports.S.intro=0;
  $imports.S.fn={v:0,on:false,note:false,n:0,next:0,shown:false};
  $imports.S.mode='out'; $imports.S.room=null;
  $imports.S.x=$imports.GATE_N.x*$imports.SC; $imports.S.y=($imports.GATE_N.y+40)*$imports.SC;
  $imports.S.ang=$imports.PI/2; $imports.S.pitch=0; $imports.S.eyeH=$imports.EYE;
  $imports.S.hiddenLatch=false; $imports.S.hiddenAsked=false; $imports.S.hiddenWindow=0; $imports.S.dangerSeen={};
  $imports.RT=(0,$imports.newRT)(); $imports.USE={torch:false,phone:false,brollyShield:false}; $imports.OPENDOORS={}; (0,$imports.syncUseState)();
  try{ $imports.PHONE.stop(); $imports.PHONE.cool=0; $imports.MONO.t=30; $imports.MONO.recent=[]; }catch(e){}
  $imports.AN.id=null; $imports.AN.active=false; $imports.AN.next=($imports.S.diff==='hard')?40:60; $imports.AN.rained=false; $imports.AN.cool={}; $imports.AN.lastBig=false; $imports.AN.t=0; $imports.AN.acc=0;
  $imports.AN.pre=null; $imports.AN.preNext=0; $imports.AN.locked=false; $imports.AN.lockWait=0;
  $imports.ROAM.on=false;
  $imports.ENTS=[]; $imports.PAUSE.on=false; document.body.classList.remove('paused');
  document.getElementById('menu').style.display='none';
  document.getElementById('die').style.display='none';
  var _tel=document.getElementById('talent'); if(_tel) _tel._set=false;
  var _hot=document.getElementById('hot'); if(_hot) _hot._sig='';
  GameModules.resetAll();                        /* 模块和 Mod 的本局状态（粉笔记号、迷宫计时……）清空 */
  if(!$imports.running){ $imports.running=true; $imports.lastT=0; }
}
var pendingAssetStart=null;
function waitForGameAssets(start){
  if($imports.Assets.anyReady())return false;
  pendingAssetStart=start;var assetScope=$imports.Lifecycle.renew('asset-start');(0,$imports.assetNotice)('正在加载模型……',true);
  $imports.Assets.load($imports.Assets.want(),assetScope.guard(function(lod){
    if(!pendingAssetStart)return;
    if($imports.Assets.anyReady()&&$imports.S.screen==='menu'){
      var ready=pendingAssetStart;pendingAssetStart=null;ready();
    }else if(lod===null)pendingAssetStart=null;
  }));
  return true;
}
var Game={
  /* 选完难度先选天赋（《天赋系统重构》5.1）：只有点「开始」才初始化新局、覆盖旧存档 */
  pickTalent:function(diff,mode){ $imports.TalentPick.open(diff,mode||'normal'); },
  start:function(diff,opt){
    if(waitForGameAssets(function(){Game.start(diff,opt);}))return;
    try{
    FRESH_TALENT=opt&&opt.talent?{id:opt.talent,origin:opt.origin||'selected'}:null;
    if(opt&&opt.mode==='speedrun'){ if(!$imports.Speedrun.active()) $imports.Speedrun.arm(diff); $imports.Dev.clearModifiers(); }   /* 普通局留下的快跑 / 无敌 / 关读条不带进速通 */
    else $imports.Speedrun.disarm();                                    /* 普通新局：回到普通存档槽 */
    freshState(diff);
    GameModules.emit('newGame',{diff:diff,mode:opt&&opt.mode==='speedrun'?'speedrun':'normal'});   /* 模块：只在新开局（不含读档）时做的事 */
    $imports.Playtest.event('开始新局',diff);
    var R1=$imports.INTERIORS['teach1'];
    /* 淡入要等一会儿：这段时间里人还算站在北门，会被当成"去过北门"。先把人放到座位上。 */
    $imports.S.mode='in'; $imports.S.room='teach1'; var seat=$imports.ClassroomLayout.anchor(R1,$imports.ClassroomLayout.ownSeat);$imports.S.x=seat.x;$imports.S.y=seat.y;$imports.S.seated=true;$imports.S.seat=$imports.ClassroomLayout.seat('teach1',$imports.MY_COL,$imports.MY_ROW);
    (0,$imports.enterRoom)('teach1',{x:$imports.S.x, y:$imports.S.y, ang:$imports.ClassroomLayout.ownSeat.facing, seated:true});
    (0,$imports.syncCamera)(0);
    clearIntroTimers();
    /* 开场 CG（opening.js）：第一次完整版、看过的短版，随时可跳过；演完或跳过都在同一个座位、同一个视角交还控制 */
    try{ $imports.Opening.play(); }catch(e){ try{ (0,$imports.proShow)(); }catch(_e){} }
    $imports.SFX.resume();
    /* 开局先把死亡演出、结局过场要用的着色器编好（第一次进场景、前情提要的时候顿一下，不在死的那一刻顿） */
    $imports.Lifecycle.scope('session').timeout(function(){ try{ $imports.DeathCG.warm(); }catch(e){} },700);
    $imports.Lifecycle.scope('session').timeout(function(){ try{ if($imports.running&&typeof $imports.cupMats==='function') (0,$imports.cupMats)(); }catch(e){} },12000);   /* 清华水杯的油画：游戏跑起来以后再画（约几十毫秒），第一次见到杯子时不用现画 */
    }catch(e){ try{ (0,$imports.showErr)('Game.start: '+e.message); }catch(_e){} }
  },
  continue_:function(){
    if(waitForGameAssets(function(){Game.continue_();}))return;
    $imports.Speedrun.disarm();                                         /* 速通不能读档接着跑；「继续上次」只读普通存档 */
    var d=(0,$imports.loadGame)();
    if(!d){ (0,$imports.toast)('没有存档'); return; }
    clearIntroTimers();
    freshState(d.diff);
    d=(0,$imports.applySave)(d);
    (0,$imports.restoreSavePresentation)();
    $imports.Engine.resetSan($imports.S.san);
    function restoreAnomalyFX(){
      if($imports.PAT.state==='walk'&&$imports.PAT.room===(0,$imports.patRoomHere)())(0,$imports.patAddFig)();
      if(!$imports.AN.id||!$imports.AN.active) return;
      try{
        if($imports.HAS_FX[$imports.AN.id]) (0,$imports.anfxSpawn)($imports.AN.id,$imports.S.x,$imports.S.y);      /* 和 anOn 共用一张表：以前这里另抄了一份，新异象（水杯、雨点成字）读档后看不见 */
      }catch(e){}
      if($imports.AN.id==='roster'&&!$imports.AN.data.done&&Number.isFinite(d.anChoiceMs)) (0,$imports.useRoster)(d.anChoiceMs);
    }
    if($imports.S.mode==='in'&&$imports.S.room) (0,$imports.enterRoom)($imports.S.room,{x:$imports.S.x,y:$imports.S.y,ang:$imports.S.ang,seated:$imports.S.seated,spiral:d.spiral,stairHeight:$imports.S.floorY,restoreVisit:true},restoreAnomalyFX);
    else { $imports.S.mode='out'; $imports.S.room=null; (0,$imports.enterWorldOut)(); (0,$imports.syncCamera)(0); restoreAnomalyFX(); }
    $imports.Lifecycle.scope('session').timeout(function(){ try{ $imports.DeathCG.warm(); }catch(e){} },700);
    $imports.Lifecycle.scope('session').timeout(function(){ try{ if($imports.running&&typeof $imports.cupMats==='function') (0,$imports.cupMats)(); }catch(e){} },12000);   /* 清华水杯的油画：游戏跑起来以后再画（约几十毫秒），第一次见到杯子时不用现画 */
    var _tel2=document.getElementById('talent'); if(_tel2) _tel2._set=false;
    var _hot2=document.getElementById('hot'); if(_hot2) _hot2._sig='';
    $imports.SFX.resume();
  },
  pause:function(){
    document.getElementById('stayDay').textContent='留校第 '+$imports.S.day+' 天';
    try{ (0,$imports.paintSet)(); }catch(e){}
    if($imports.S.screen!=='play'||$imports.S.dead||$imports.PAUSE.on)return;
    $imports.PAUSE.on=true;
    var pt=document.getElementById('ptalent');
    if(pt)pt.textContent=$imports.Talent.pauseText();                     /* 任何状态都重新生成，不留上一次的文字 */
    var pk=document.getElementById('pkeys');
    if(pk) pk.innerHTML=$imports.IS_TOUCH?
      '<span>左下摇杆</span>移动（推到底就是跑）<span>右侧滑动</span>环视<span>交互键</span>上面写着能做的事<span>手册</span>背包 · 思索 · 笔记 · 地图':
      '<span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span>移动<span><kbd>Shift</kbd></span>奔跑<span><kbd>E</kbd></span>交互<span><kbd>F</kbd></span>手电'+
      '<span><kbd>1</kbd><kbd>2</kbd></span>快捷栏<span><kbd>G</kbd></span>丢弃选中<span><kbd>Tab</kbd></span>背包<span><kbd>H</kbd></span>思索<span><kbd>J</kbd></span>笔记<span><kbd>M</kbd></span>地图'+
      '<span><kbd>Alt</kbd></span>放出鼠标，游戏不暂停；点画面收回';
    if(pk&&$imports.CarChase.active())pk.textContent=$imports.IS_TOUCH?'驾驶：摇杆向前加速、左右转向、向后刹车。':'驾驶：W / ↑ 加速，A D / ← → 转向，S / ↓ 刹车。';
    document.body.classList.add('paused');
    try{ $imports.Playtest.paint(); }catch(e){}
    $imports.UI.open('pause');
  },
  pauseToggle:function(){
    if($imports.PAUSE.on)Game.resume();else Game.pause();
  },
  resume:function(){
    if($imports.S.screen!=='play'||$imports.S.dead)return;
    $imports.UI.closePanelAll();(0,$imports.resetInputState)();
    $imports.PAUSE.on=false; document.body.classList.remove('paused');
    if($imports.running){$imports.lastT=performance.now();$imports.accum=0;}
    (0,$imports.resumeMouseLook)();(0,$imports.updateTouchUI)();
  },
  saveNow:function(){
    if((0,$imports.saveGame)()) (0,$imports.toast)('已保存');
    else (0,$imports.toast)('保存失败');
    Game.resume();
  },
  quit:function(){
    if(typeof $imports.CarChase!=='undefined'&&$imports.CarChase.active()){(0,$imports.autoSave)();$imports.CarChase.clearVisual();}
    $imports.Lifecycle.boundary('menu');
    $imports.running=true;
    $imports.S.screen='menu'; $imports.S.dead=false;
    $imports.PAUSE.on=false;document.body.classList.remove('paused');
    if(!$imports.MENU_PHOTO)$imports.Lifecycle.scope('session').timeout($imports.captureMenuPhoto,320);
    ['pause','die','bag','note','think','mapv','choices'].forEach(function(id){
      var e=document.getElementById(id); if(e) e.style.display='none';
    });
    var es=document.getElementById('ends'); if(es) es.remove();
    document.getElementById('menu').style.display='block';
    document.getElementById('sub').style.display='none';
    (0,$imports.paintMenuSave)();
  }
};

/* 清理注册表只在应用组合层接线。模块内部字段由模块自己的清理函数处理。 */
$imports.Lifecycle.register('pending-start',function(){pendingAssetStart=null;});
$imports.Lifecycle.register('prologue',function(){(0,$imports.proCancel)();});
$imports.Lifecycle.register('cutscene',function(){if($imports.CUT.on){$imports.CUT.done=null;(0,$imports.cutFinish)();}});
$imports.Lifecycle.register('death',function(){$imports.S.deadId=($imports.S.deadId||0)+1;$imports.DEATH_PENDING=null;});
$imports.Lifecycle.register('preview',function(){if($imports.DevLock.on)$imports.DevLock.close();if($imports.DEV.on)$imports.Dev.close(false);$imports.Dev.clearPreview();$imports.Dev.clearAnimation();});
$imports.Lifecycle.register('world-effects',function(){$imports.CarChase.clearVisual();$imports.Inspection.clearFx();(0,$imports.fnPeopleClear)();$imports.Engine.resetFakeNormal();$imports.VisualState.worldNorm=0;(0,$imports.anfxClear)();});
$imports.Lifecycle.register('lesson',function(){$imports.LESSON.waiting=null;$imports.LESSON.close(false);});
$imports.Lifecycle.register('interaction',function(){(0,$imports.clearSearch)();(0,$imports.resetInputState)();(0,$imports.releaseMouseLook)();$imports.UI.closePanelAll();$imports.UI.closeChoice();});
$imports.Lifecycle.register('patrol',function(){(0,$imports.patReset)();});
$imports.Lifecycle.register('dread',function(){$imports.Dread.reset();});
$imports.Lifecycle.register('classmates',function(){$imports.Classmates.reset();$imports.NC.done=false;(0,$imports.ncClear)();(0,$imports.skipClear)();});
$imports.Lifecycle.register('spiral',function(){(0,$imports.spiralReset)();});
$imports.Lifecycle.register('phone',function(){$imports.PHONE.stop();});
$imports.Lifecycle.register('computer',function(){$imports.PCGAME.cancel();});
$imports.Lifecycle.register('intro',function(){clearIntroTimers();});
$imports.Lifecycle.register('game-modules',function(reason){GameModules.emit('boundary',reason);});   /* 模块和 Mod：上一局的画面、计时在这里收掉 */
$imports.Lifecycle.register('opening',function(){$imports.Opening.cancel();});                 /* 新局开场 CG：没演完的直接收掉 */
$imports.Lifecycle.register('day-decor',function(){$imports.DayDecor.clear();});               /* 校庆横幅 */
$imports.Lifecycle.register('speedrun',function(reason){                            /* 速通中途回菜单：记放弃，丢掉速通的存档槽 */
  if(reason!=='menu')return;
  $imports.Speedrun.fail('abandoned','quit');
  if($imports.RUN_MODE==='speedrun')(0,$imports.clearSave)();
  $imports.RUN_MODE='normal';$imports.Speedrun.paintHud(true);
});

/* @module-exports */
GameModules.publish("game3d/js/app/session.js",{
"introT1":{get:function(){return introT1;},set:function($value){introT1=$value;}},
"clearIntroTimers":{get:function(){return clearIntroTimers;},set:function($value){clearIntroTimers=$value;}},
"FRESH_TALENT":{get:function(){return FRESH_TALENT;},set:function($value){FRESH_TALENT=$value;}},
"freshState":{get:function(){return freshState;},set:function($value){freshState=$value;}},
"pendingAssetStart":{get:function(){return pendingAssetStart;},set:function($value){pendingAssetStart=$value;}},
"waitForGameAssets":{get:function(){return waitForGameAssets;},set:function($value){waitForGameAssets=$value;}},
"Game":{get:function(){return Game;},set:function($value){Game=$value;}}
});
})(GameModules.imports("game3d/js/app/session.js"));
