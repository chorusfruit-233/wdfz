/* 里世界 3D · 键鼠与触屏输入、玩家移动 */
'use strict';

var KEY={}, TOUCH={dx:0,dy:0,run:false,active:false};
var LOOKDRAG={on:false,x:0,y:0};
var INPUT={mode:'mouse',lookId:null,lookType:null,stickId:null,stickCenter:null,
  dragDistance:0,blockClickUntil:0,lastTouchAt:-1000,wantsLock:false,
  lockPending:false,lockToken:0,hadLock:false,unlockedAt:-1000,freeCursor:false,
  touchHandled:false};   /* 这一次触摸已经由游戏处理过（松指触发了按钮，或按下时跳过了演出）：浏览器随后补发的 click 一律吞掉 */

function devOwnsInput(target){
  return !!(typeof DEV!=='undefined'&&DEV.on&&target&&target.closest&&target.closest('#dev'));
}
function devInputBlocked(){
  return typeof DEV!=='undefined'&&DEV.on&&(DEV.freeze||!!DEV.drag);
}
function playerInputAllowed(){
  return S.screen==='play'&&!S.dead&&!PAUSE.on&&!UI.anyOpen()&&
    !(typeof PRO!=='undefined'&&PRO.on)&&!(typeof PC!=='undefined'&&PC.on)&&!(typeof PHONE!=='undefined'&&PHONE.on)&&
    !(typeof LESSON!=='undefined'&&LESSON.on)&&!devInputBlocked()&&!(S.intro>0);
}
function pointerIsLocked(){return document.pointerLockElement===document.getElementById('cv');}
function releaseCapture(el,id){
  if(el&&id!==null&&el.hasPointerCapture&&el.hasPointerCapture(id)){
    try{el.releasePointerCapture(id);}catch(e){}
  }
}
function endLook(){
  var id=INPUT.lookId;
  INPUT.lookId=null;INPUT.lookType=null;LOOKDRAG.on=false;
  releaseCapture(document.getElementById('cv'),id);
}
function endStick(){
  var id=INPUT.stickId;INPUT.stickId=null;INPUT.stickCenter=null;
  TOUCH.active=false;TOUCH.dx=TOUCH.dy=0;
  var knob=document.getElementById('knob');if(knob)knob.style.transform='';
  releaseCapture(document.getElementById('stick'),id);
}
function resetInputState(){
  KEY={};endLook();endStick();TOUCH.run=false;S.moving=false;S.run=false;
}
window.__resetInput=resetInputState;

function releaseMouseLook(){
  INPUT.lockToken++;INPUT.lockPending=false;
  if(pointerIsLocked()&&document.exitPointerLock){try{document.exitPointerLock();}catch(e){}}
}
function requestMouseLook(){
  if(typeof CarChase!=='undefined'&&CarChase.active())return Promise.resolve(false);
  if(INPUT.mode!=='mouse'||!playerInputAllowed()||devOwnsInput(document.activeElement))return Promise.resolve(false);
  var cv=document.getElementById('cv');
  INPUT.wantsLock=true;
  if(pointerIsLocked())return Promise.resolve(true);
  if(!cv.requestPointerLock||INPUT.lockPending)return Promise.resolve(false);
  INPUT.lockPending=true;var token=++INPUT.lockToken,result;
  try{result=cv.requestPointerLock();}catch(e){INPUT.lockPending=false;return Promise.resolve(false);}
  return Promise.resolve(result).then(function(){
    if(token!==INPUT.lockToken||INPUT.mode!=='mouse'||!playerInputAllowed()){
      /* 锁定落地时已经不需要了（比如刚按了 Alt）：悄悄放开，不算玩家切出 */
      if(pointerIsLocked()){INPUT.freeCursor=true;releaseMouseLook();}return false;
    }
    INPUT.lockPending=false;return pointerIsLocked();
  },function(){
    if(token===INPUT.lockToken)INPUT.lockPending=false;
    /* 拒绝锁定仍可拖动，不能打断正在进行的触屏手势。 */
    return false;
  });
}
/* Alt 或 ` 键：只把鼠标光标放出来，游戏照常运行、不弹暂停菜单（调试浮窗、截图时用）。
   Esc 仍然是暂停。之后点一下画面（或再按 `）恢复环视；Alt 是修饰键，浏览器不让它重新锁定鼠标。 */
function freeCursorKey(e){
  return e.key==='Alt'||e.code==='AltLeft'||e.code==='AltRight'||e.code==='Backquote';
}
function toggleFreeCursor(e){
  if(pointerIsLocked()||INPUT.lockPending){
    var locked=pointerIsLocked();
    INPUT.freeCursor=locked;INPUT.wantsLock=false;resetInputState();releaseMouseLook();
    updateInputUI();return true;
  }
  if(e.code==='Backquote'&&INPUT.mode==='mouse'&&playerInputAllowed()){requestMouseLook();return true;}
  return false;
}
function resumeMouseLook(){
  if(INPUT.wantsLock&&INPUT.mode==='mouse'&&playerInputAllowed())requestMouseLook();
}
function useTouchInput(){
  var changed=!IS_TOUCH;
  INPUT.mode='touch';INPUT.lastTouchAt=performance.now();INPUT.blockClickUntil=INPUT.lastTouchAt+800;
  IS_TOUCH=true;document.body.classList.add('touch');
  if(pointerIsLocked()||INPUT.lockPending)releaseMouseLook();
  if(changed)updateTouchUI();
}
function useMouseInput(){
  INPUT.mode='mouse';INPUT.blockClickUntil=0;
  if(IS_TOUCH){
    IS_TOUCH=false;document.body.classList.remove('touch');
    updateTouchUI();
  }
}
function updateInputUI(){
  var hint=document.getElementById('lookhint');
  if(hint)hint.hidden=!(playerInputAllowed()&&INPUT.mode==='mouse'&&!pointerIsLocked());
}
function physicalKey(e){
  var codes={KeyW:'w',KeyA:'a',KeyS:'s',KeyD:'d',KeyE:'e',KeyF:'f',KeyG:'g',
    KeyH:'h',KeyJ:'j',KeyM:'m',KeyR:'r',Digit1:'1',Digit2:'2',Digit3:'3',Backquote:'`'};
  return codes[e.code]||e.key.toLowerCase();
}
function initTouchActivation(){
  var taps=new Map(),lastTarget=null,lastParent=null,lastIndex=-1,lastBagIndex=-1,lastTime=-1000,lastDone=-1000;
  var selector='button,.close,.hslot,.idea,#bag .s';
  function control(target){return target.closest?target.closest(selector):null;}
  function bagIndex(el){
    var slot=el&&el.closest?el.closest('#bags .s'):null;
    return slot&&slot.parentElement?Array.prototype.indexOf.call(slot.parentElement.children,slot):-1;
  }
  document.addEventListener('pointerdown',function(e){
    if(e.pointerType!=='touch'&&e.pointerType!=='pen')return;
    /* 新的一次触摸开始：上一次触摸补发的 click 一定已经派发过了（浏览器按顺序派发输入事件） */
    INPUT.touchHandled=false;
    var el=control(e.target);
    if(el&&!el.disabled)taps.set(e.pointerId,{el:el,x:e.clientX,y:e.clientY});
  },{capture:true,passive:true});
  document.addEventListener('pointermove',function(e){
    var tap=taps.get(e.pointerId);
    if(tap&&Math.hypot(e.clientX-tap.x,e.clientY-tap.y)>10)taps.delete(e.pointerId);
  },{capture:true,passive:true});
  document.addEventListener('pointercancel',function(e){taps.delete(e.pointerId);},{capture:true,passive:true});
  document.addEventListener('pointerup',function(e){
    var tap=taps.get(e.pointerId);taps.delete(e.pointerId);
    if(!tap||!tap.el.isConnected||tap.el.disabled||control(e.target)!==tap.el)return;
    lastTarget=tap.el;lastParent=tap.el.parentElement;
    lastIndex=lastParent?Array.prototype.indexOf.call(lastParent.children,tap.el):-1;
    lastBagIndex=bagIndex(tap.el);lastTime=performance.now();
    // 用松指事件触发按钮：浏览器在一次视角滑动后可能不再发送兼容 click。
    // pointerup 保留真实用户激活，全屏请求仍可在这里同步发起。
    tap.el.click();
    /* 这次触摸已经处理过了。以前只按时间窗吞补发的 click：进房间、坐下这类操作会在之后再排一段很重的
       工作（淡出后建场景），手机上补发的 click 被拖到窗口外，同一个键就被按了两次。现在按「这一次触摸」吞，
       不管它拖了多久；时间窗留作兜底 */
    INPUT.touchHandled=true;
    lastDone=performance.now();
  },{capture:true,passive:true});
  document.addEventListener('click',function(e){
    var touch=e.pointerType==='touch'||e.pointerType==='pen'||
      (e.sourceCapabilities&&e.sourceCapabilities.firesTouchEvents)||(!e.pointerType&&e.detail>0);
    var target=control(e.target);
    /* 背包点选会重建格子；浏览器的兼容 click 可能落在同一位置的新节点上。 */
    var same=target===lastTarget||(lastTarget&&!lastTarget.isConnected&&target&&
      ((lastParent&&lastParent===target.parentElement&&lastIndex===Array.prototype.indexOf.call(lastParent.children,target))||
       (lastBagIndex>=0&&bagIndex(target)===lastBagIndex)));
    /* 松指刚处理过一次：补发的 click 不管落在哪个按钮上都吞掉（按钮处理后弹出的选择框、
       换出来的面板正好在手指下面时，以前会被这次补发的 click 再点一下） */
    var ghost=(target||e.target===document.getElementById('cv'))&&performance.now()-lastDone<800;
    if(e.isTrusted&&touch&&(INPUT.touchHandled||(same&&performance.now()-lastTime<600)||ghost)){
      INPUT.touchHandled=false;
      e.preventDefault();e.stopImmediatePropagation();
    }
  },true);
  window.addEventListener('blur',function(){taps.clear();});
}
function initInput(){
  INPUT.mode=IS_TOUCH?'touch':'mouse';
  var cv=document.getElementById('cv'),stick=document.getElementById('stick');
  initTouchActivation();
  document.addEventListener('focusin',function(e){
    if(devOwnsInput(e.target)){resetInputState();releaseMouseLook();updateTouchUI();}
  });
  document.addEventListener('pointerdown',function(e){
    /* 调试浮窗只接管自己的控件；点回游戏时，同一次手势就能重新移动或转向。 */
    if(devOwnsInput(e.target)){
      if(e.pointerType==='touch'||e.pointerType==='pen')useTouchInput();else useMouseInput();
      resetInputState();releaseMouseLook();return;
    }
    if(devOwnsInput(document.activeElement)){
      document.activeElement.blur();
      if(e.target===cv||(e.target.closest&&e.target.closest('#touch')))cv.focus({preventScroll:true});
      updateTouchUI();
    }
    if(S.screen==='cut'){
      /* 按下就跳过演出；松指后补发的 click 会落在随后出现的结局界面按钮上，要吞掉 */
      if(e.pointerType==='touch'||e.pointerType==='pen')INPUT.touchHandled=true;
      cutSkip(); return;
    }
    if(S.screen==='replay'&&typeof ArchiveReplay!=='undefined'&&ArchiveReplay.on){
      /* 死亡档案回放：按下就结束，补发的 click 不能点到随后出现的档案卡片上 */
      if(e.pointerType==='touch'||e.pointerType==='pen')INPUT.touchHandled=true;
      ArchiveReplay.skip(); return;
    }
    /* 死亡演出中：按下跳到结果（死亡界面或惊醒）；补发的 click 同样不能点到随后出现的按钮 */
    if(S.dead&&typeof DEATH_PENDING!=='undefined'&&DEATH_PENDING){
      if(deathSkip()&&(e.pointerType==='touch'||e.pointerType==='pen'))INPUT.touchHandled=true;
      return;
    }
    if(e.pointerType==='touch'||e.pointerType==='pen')useTouchInput();
    else if(INPUT.lookType!=='touch'&&INPUT.lookType!=='pen'&&INPUT.stickId===null)useMouseInput();
  },{capture:true,passive:true});
  window.addEventListener('keydown',function(e){ routeKey(e);   },{passive:false});
  window.addEventListener('keyup',function(e){
    KEY[physicalKey(e)]=false;
    /* 单按 Alt 松开时，部分浏览器会把焦点移到自己的菜单栏，之后按键就进不了游戏 */
    if(e.key==='Alt'&&S.screen==='play')e.preventDefault();
  });

  var proEl=document.getElementById('pro');
  if(proEl)proEl.addEventListener('click',function(e){e.stopPropagation();proNext();});
  cv.addEventListener('click',function(e){
    if(!playerInputAllowed()||INPUT.mode!=='mouse'||
      (e.pointerType&&e.pointerType!=='mouse')||
      (e.sourceCapabilities&&e.sourceCapabilities.firesTouchEvents)||
      performance.now()<INPUT.blockClickUntil)return;
    requestMouseLook();
  });
  var maxDelta=160;
  document.addEventListener('mousemove',function(e){
    if(!pointerIsLocked()||INPUT.mode!=='mouse'||!playerInputAllowed()||devOwnsInput(document.activeElement))return;
    var mx=e.movementX||0,my=e.movementY||0;
    if(!isFinite(mx)||!isFinite(my))return;
    S.ang+=clamp(mx,-maxDelta,maxDelta)*.0022*lookSensitivity(false);
    S.pitch=clamp(S.pitch-clamp(my,-maxDelta,maxDelta)*.0022*lookSensitivity(false),-1.25,1.25);
  });
  cv.addEventListener('pointerdown',function(e){
    if(!playerInputAllowed()||e.button>0)return;
    var touch=e.pointerType==='touch'||e.pointerType==='pen';
    if(touch){if(INPUT.lookType==='mouse')endLook();}
    else{if(INPUT.lookId!==null||pointerIsLocked())return;INPUT.mode='mouse';}
    if(INPUT.lookId!==null)return; // 第二根手指不能夺走已有视角手势。
    INPUT.lookId=e.pointerId;INPUT.lookType=e.pointerType||'mouse';INPUT.dragDistance=0;
    LOOKDRAG.on=true;LOOKDRAG.x=e.clientX;LOOKDRAG.y=e.clientY;
    try{cv.setPointerCapture(e.pointerId);}catch(err){}
    cv.focus({preventScroll:true});
  });
  window.addEventListener('pointermove',function(e){
    if(!LOOKDRAG.on||e.pointerId!==INPUT.lookId)return;
    if(!playerInputAllowed()){endLook();return;}
    if(INPUT.lookType==='mouse'&&(pointerIsLocked()||e.buttons===0)){endLook();return;}
    var dx=e.clientX-LOOKDRAG.x,dy=e.clientY-LOOKDRAG.y;
    LOOKDRAG.x=e.clientX;LOOKDRAG.y=e.clientY;
    // 全屏/旋转屏幕造成的坐标突变只丢弃这一帧，下一帧仍能继续转向。
    if(Math.abs(dx)>maxDelta||Math.abs(dy)>maxDelta)return;
    INPUT.dragDistance+=Math.hypot(dx,dy);
    var sense=lookSensitivity(INPUT.lookType!=='mouse');
    S.ang+=dx*.0042*sense;S.pitch=clamp(S.pitch-dy*.0042*sense,-1.25,1.25);
  },{passive:true});
  function lookEnd(e){
    if(e.pointerId!==INPUT.lookId)return;
    if(INPUT.lookType!=='mouse'||INPUT.dragDistance>4)INPUT.blockClickUntil=performance.now()+400;
    endLook();
  }
  window.addEventListener('pointerup',lookEnd);
  window.addEventListener('pointercancel',lookEnd);
  cv.addEventListener('lostpointercapture',lookEnd);
  window.addEventListener('pointerout',function(e){
    if(e.pointerId===INPUT.lookId&&INPUT.lookType==='mouse'&&!e.relatedTarget)endLook();
  });

  if(stick){
    function moveStick(e){
      if(INPUT.stickId!==e.pointerId)return;
      if(!playerInputAllowed()){endStick();return;}
      var dx=e.clientX-INPUT.stickCenter.x,dy=e.clientY-INPUT.stickCenter.y;
      var radius=INPUT.stickCenter.radius,d=Math.hypot(dx,dy);
      if(d>radius){dx*=radius/d;dy*=radius/d;}
      document.getElementById('knob').style.transform='translate('+dx+'px,'+dy+'px)';
      TOUCH.dx=dx/radius;TOUCH.dy=dy/radius;TOUCH.active=true;
    }
    stick.addEventListener('pointerdown',function(e){
      if((e.pointerType!=='touch'&&e.pointerType!=='pen')||!playerInputAllowed()||INPUT.stickId!==null)return;
      useTouchInput();INPUT.stickId=e.pointerId;
      var r=stick.getBoundingClientRect(),knob=document.getElementById('knob');
      INPUT.stickCenter={x:r.left+r.width/2,y:r.top+r.height/2,radius:(r.width-knob.offsetWidth)/2};
      try{stick.setPointerCapture(e.pointerId);}catch(err){}
      moveStick(e);e.stopPropagation();
    });
    window.addEventListener('pointermove',moveStick,{passive:true});
    function stickEnd(e){if(e.pointerId===INPUT.stickId)endStick();}
    window.addEventListener('pointerup',stickEnd);
    window.addEventListener('pointercancel',stickEnd);
    stick.addEventListener('lostpointercapture',stickEnd);
  }
  /* 手机上不再单独放奔跑键：摇杆推到底就是跑 */
  document.getElementById('tAct').addEventListener('click',function(){if(playerInputAllowed())tryInteract();});
  document.getElementById('tPause').addEventListener('click',function(){if(!PAUSE.on)Game.pause();});

  document.addEventListener('pointerlockchange',function(){
    var locked=pointerIsLocked(),wasLocked=INPUT.hadLock;INPUT.hadLock=locked;
    if(locked){
      INPUT.freeCursor=false;
      if(INPUT.mode!=='mouse'||!playerInputAllowed()){releaseMouseLook();return;}
      if(INPUT.lookType==='mouse')endLook();
    }else if(INPUT.freeCursor){
      INPUT.freeCursor=false;INPUT.unlockedAt=performance.now();resetInputState();   /* 按 Alt 放出来的：不暂停 */
    }else if(wasLocked&&INPUT.mode==='mouse'&&playerInputAllowed()&&!devOwnsInput(document.activeElement)&&!(typeof FULLSCREEN!=='undefined'&&FULLSCREEN.busy)){
      INPUT.unlockedAt=performance.now();resetInputState();Game.pause();
    }
    updateInputUI();
  });
  document.addEventListener('pointerlockerror',function(){INPUT.lockPending=false;updateInputUI();});
  function leaveGame(){
    resetInputState();
    if(playerInputAllowed())Game.pause();
    releaseMouseLook();
  }
  window.addEventListener('blur',leaveGame);
  document.addEventListener('visibilitychange',function(){if(document.hidden)leaveGame();});
  window.addEventListener('contextmenu',function(e){if(e.target===cv)e.preventDefault();});
}

function updatePlayer(dt){
  if(S.dead||S.screen!=='play'||(S.intro||0)>0)return;
  var snack=(S.snackT||0)>0;
  if(snack) S.snackT=Math.max(0,S.snackT-dt);
  capStamina();
  if(HIDE.on){ S.moving=false; S.run=false; restoreStamina(11*dt); syncCamera(dt); return; }   /* 躲在柜子里：不能动 */
  var locked=!playerInputAllowed(),fw=0,sd=0;
  if(!locked){
    if(KEY.w||KEY.arrowup)fw++;
    if(KEY.s||KEY.arrowdown)fw--;
    if(KEY.a||KEY.arrowleft)sd--;
    if(KEY.d||KEY.arrowright)sd++;
    if(TOUCH.active){fw-=TOUCH.dy;sd+=TOUCH.dx;}
  }
  var stickFull=TOUCH.active&&Math.hypot(TOUCH.dx,TOUCH.dy)>.96;
  var wantRun=(KEY.shift||TOUCH.run||stickFull)&&!locked;
  /* 士力架：这几秒里体力空了也能跑，跑也不掉体力。躲柜子时世界照走，计时也要继续。 */
  /* 跑空以后要喘过气（回到 STAM_BACK）才能再跑。以前体力一回到 6 以上就又跑起来，
     马上又掉下去，按着疾跑（或手机摇杆推到底）时就一顿一顿地在跑和走之间来回切。 */
  if(S.stam<=6)S.tired=true;
  else if(S.stam>=STAM_BACK)S.tired=false;
  S.run=wantRun&&(!S.tired||snack)&&(fw!==0||sd!==0);
  var mag=Math.hypot(fw,sd);
  if(S.seated&&mag>.08)S.seated=false;
  S.moving=mag>.08&&!S.seated;
  if(S.moving){
    var spd=S.run?SPD_RUN:SPD_WALK;
    if(typeof DEV!=='undefined'&&DEV.fast)spd*=2.6;
    if(mag>1){fw/=mag;sd/=mag;}
    var ca=Math.cos(S.ang),sa=Math.sin(S.ang),x=S.x,y=S.y;
    moveBy((ca*fw-sa*sd)*spd*dt,(sa*fw+ca*sd)*spd*dt,dt);
    S.moving=Math.hypot(S.x-x,S.y-y)>.0001;
  }
  if(S.moving&&!S.seated){
    S.stepT=(S.stepT||0)-dt;
    if(S.stepT<=0){S.stepT=S.run?.30:.46;SFX.step();}
  }else S.stepT=0;
  if(S.run&&S.moving){if(!snack)S.stam=Math.max(0,S.stam-17*dt);}
  else restoreStamina(11*dt);
  if(S.enterCool>0)S.enterCool-=dt;
  syncCamera(dt);
}
var SPD_WALK=21,SPD_RUN=36.4,SNACK_SEC=30,STAM_BACK=35;

/* ---------- 键盘分派表（计划「项目解耦与模块化」5.1 / M1）----------
   按下一个键时从上往下找第一个 match 的上下文接手；run 返回 false 表示「处理了一部分，交给下一层」。
   最近一次接手的上下文记在 INPUT.route（调试面板状态页显示），表本身导出为 KEY_ROUTES。
   与改造前的 if 链逐条对应，只调了一处顺序（A-01）：过场（S.screen==='cut'，开场 CG、结局演出）排在旧的文字前情提要
   （PRO.on）前面。开场演出时为了冻结世界 PRO.on 也是真的，以前空格被 proNext() 接走，开场跳不过去。
   触屏 / 鼠标点击的分派还在各自的监听里（迁移见计划第 10 节）。 */
var SKIP_KEYS={' ':1,enter:1,escape:1};
var MOVE_KEYS=['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'];
var KEY_ROUTES=[
  {id:'dev-toggle', desc:'F2：打开 / 关闭调试面板',
    match:function(c){ return c.e.key==='F2'&&(!c.editing||DEV.on); },
    run:function(c){ c.e.preventDefault(); if(!c.e.repeat&&typeof Dev!=='undefined') Dev.toggle(); }},
  {id:'free-cursor', desc:'Alt / `：放出或收回鼠标（游戏不暂停）',
    match:function(c){ return freeCursorKey(c.e)&&!c.editing&&S.screen==='play'&&!c.e.ctrlKey&&!c.e.metaKey&&!c.e.shiftKey; },
    run:function(c){ c.e.preventDefault(); if(!c.e.repeat) toggleFreeCursor(c.e); }},
  {id:'dev-panel', desc:'焦点在调试面板里：Tab 留在面板内，Esc 关闭',
    match:function(c){ return devOwnsInput(c.e.target); },
    run:function(c){ if(c.k==='tab') Dev.focusTrap(c.e); if(c.k==='escape'){ c.e.preventDefault(); if(!c.e.repeat) Dev.close(); } }},
  {id:'dev-freeze', desc:'调试冻结时：Esc 关闭面板',
    match:function(c){ return c.k==='escape'&&DEV.on&&DEV.freeze; },
    run:function(c){ c.e.preventDefault(); if(!c.e.repeat) Dev.close(); }},
  {id:'editing', desc:'输入框里打字；Esc 离开输入框后继续往下分派',
    match:function(c){ return c.editing; },
    run:function(c){ if(c.k!=='escape') return true; c.e.target.blur(); return false; }},
  {id:'cutscene', desc:'过场（开场 CG、结局演出）：空格 / 回车 / Esc 跳过',
    match:function(){ return S.screen==='cut'; },
    run:function(c){ if(SKIP_KEYS[c.k]){ c.e.preventDefault(); cutSkip(); } }},
  {id:'prologue', desc:'文字前情提要：空格 / 回车翻页',
    match:function(){ return PRO.on; },
    run:function(c){ if(c.k===' '||c.k==='enter'){ c.e.preventDefault(); if(!c.e.repeat) proNext(); } }},
  {id:'death-skip', desc:'死亡演出：空格 / 回车 / Esc 跳过',
    match:function(c){ return S.dead&&typeof DEATH_PENDING!=='undefined'&&DEATH_PENDING&&!!SKIP_KEYS[c.k]; },
    run:function(c){ c.e.preventDefault(); if(!c.e.repeat) deathSkip(); }},
  {id:'not-playing', desc:'不在游玩中，或按着 Ctrl / ⌘ / Alt：不接',
    match:function(c){ return S.screen!=='play'||S.dead||c.e.ctrlKey||c.e.metaKey||c.e.altKey; },
    run:function(){}},
  {id:'escape', desc:'Esc：依次关电脑、手机、课堂、设置、手册，最后暂停 / 继续',
    match:function(c){ return c.k==='escape'; },
    run:function(c){
      c.e.preventDefault(); if(c.e.repeat) return;
      if(PC.on){ PCGAME.stop(); return; }
      if(PHONE.on){ PHONE.stop(); return; }
      if(LESSON.on){ LESSON.close(true); return; }
      if(UI.openPanel==='set'){ UI.close('set',false); if(PAUSE.on) UI.open('pause'); return; }
      if(UI.openPanel&&UI.openPanel!=='pause'){ UI.close(UI.openPanel); return; }
      if(PAUSE.on&&performance.now()-INPUT.unlockedAt<200) return;
      Game.pauseToggle();
    }},
  {id:'button-space', desc:'焦点在按钮上：空格交给按钮自己',
    match:function(c){ return c.k===' '&&!!c.e.target.closest('button,a,[role="button"]'); },
    run:function(){}},
  {id:'pc', desc:'机房电脑小游戏：方向键',
    match:function(){ return PC.on; },
    run:function(c){ if(MOVE_KEYS.indexOf(c.k)>=0){ KEY[c.k]=true; c.e.preventDefault(); } }},
  {id:'lesson', desc:'课堂短任务：1–3 选答案',
    match:function(){ return LESSON.on; },
    run:function(c){ if(/^[1-3]$/.test(c.k)){ c.e.preventDefault(); if(!c.e.repeat) LESSON.answer(+c.k-1); } }},
  {id:'phone', desc:'手机纸飞机：空格 / W / ↑ / 回车往上飘',
    match:function(){ return PHONE.on; },
    run:function(c){ if([' ','w','arrowup','enter'].indexOf(c.k)>=0){ c.e.preventDefault(); if(!c.e.repeat) PHONE.flap(); } }},
  {id:'choice', desc:'选择框：数字键直接选',
    match:function(c){ return UI.chooseOpen&&!PAUSE.on&&/^[1-9]$/.test(c.k); },
    run:function(c){ c.e.preventDefault(); if(!c.e.repeat) UI.choiceKey(+c.k); }},
  {id:'blocked', desc:'暂停、调试拦截、选择框、开局倒计时：不接游戏键',
    match:function(){ return PAUSE.on||devInputBlocked()||UI.chooseOpen||S.intro>0; },
    run:function(){}},
  {id:'car', desc:'驾驶逃脱：方向键',
    match:function(){ return typeof CarChase!=='undefined'&&CarChase.active(); },
    run:function(c){ if(MOVE_KEYS.indexOf(c.k)>=0){ c.e.preventDefault(); KEY[c.k]=true; } }},
  {id:'journal', desc:'Tab / H / J / M：手册的背包、思索、笔记、地图',
    match:function(c){ return ['tab','h','j','m'].indexOf(c.k)>=0; },
    run:function(c){ c.e.preventDefault(); if(!c.e.repeat) UI.toggle({tab:'bag',h:'think',j:'note',m:'mapv'}[c.k]); }},
  {id:'player', desc:'游玩：移动、E 交互、R 课桌 / 课堂、F 手电、G 丢弃、1 / 2 快捷栏',
    match:function(){ return true; },
    run:function(c){
      var k=c.k, e=c.e;
      if(!playerInputAllowed()) return;
      if(['w','a','s','d',' ','arrowup','arrowdown','arrowleft','arrowright'].indexOf(k)>=0) e.preventDefault();
      KEY[k]=true; if(e.repeat) return;
      if(k==='e') tryInteract();
      if(k==='r'&&!Investigation.openDesk()) LESSON.open();
      if(k==='f') toggleTorch();
      if(k==='g') dropSelected();
      if(k==='1') useHot(0);
      if(k==='2') useHot(1);
    }}
];
function routeKey(e){
  var c={e:e,k:physicalKey(e),editing:!!(e.target&&e.target.matches&&e.target.matches('input,select,textarea,[contenteditable="true"]'))};
  for(var i=0;i<KEY_ROUTES.length;i++){
    var r=KEY_ROUTES[i];
    if(!r.match(c)) continue;
    INPUT.route=r.id;
    if(r.run(c)!==false) return r.id;
  }
  return null;
}
