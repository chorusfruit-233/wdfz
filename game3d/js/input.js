/* @module-capsule */
(function($imports){
/* 里世界 3D · 键鼠与触屏输入、玩家移动 */
'use strict';

var KEY={}, TOUCH={dx:0,dy:0,run:false,active:false};
var LOOKDRAG={on:false,x:0,y:0};
var INPUT={mode:'mouse',lookId:null,lookType:null,stickId:null,stickCenter:null,
  dragDistance:0,blockClickUntil:0,lastTouchAt:-1000,wantsLock:false,
  lockPending:false,lockToken:0,hadLock:false,unlockedAt:-1000,freeCursor:false,
  touchHandled:false};   /* 这一次触摸已经由游戏处理过（松指触发了按钮，或按下时跳过了演出）：浏览器随后补发的 click 一律吞掉 */

function devOwnsInput(target){
  return !!(typeof $imports.DEV!=='undefined'&&$imports.DEV.on&&target&&target.closest&&target.closest('#dev'));
}
function devInputBlocked(){
  return typeof $imports.DEV!=='undefined'&&$imports.DEV.on&&($imports.DEV.freeze||!!$imports.DEV.drag);
}
/* 平台适配入口：策略只接收值，不读取 DOM 或持有这些系统。 */
function gameInputContext(target,editing){
  return {hidden:document.hidden,rendererBusy:!$imports.Engine.ready(),terminal:!!(typeof $imports.TerminalUI!=='undefined'&&$imports.TerminalUI.on),screen:$imports.S.screen,dead:!!$imports.S.dead,prologue:!!(typeof $imports.PRO!=='undefined'&&$imports.PRO.on),
    paused:!!$imports.PAUSE.on,panelOpen:!!$imports.UI.anyOpen(),choice:!!$imports.UI.chooseOpen,
    computer:!!(typeof $imports.PC!=='undefined'&&$imports.PC.on),phone:!!(typeof $imports.PHONE!=='undefined'&&$imports.PHONE.on),
    lesson:!!(typeof $imports.LESSON!=='undefined'&&$imports.LESSON.on),
    broadcast:!!(typeof $imports.BroadcastUI!=='undefined'&&$imports.BroadcastUI.isOpen()),
    debugFrozen:!!(typeof $imports.DEV!=='undefined'&&(($imports.DEV.on&&$imports.DEV.freeze)||$imports.DEV.locking)),   /* 输调试密码时也冻结 */
    debugDragging:!!(typeof $imports.DEV!=='undefined'&&$imports.DEV.on&&$imports.DEV.drag),
    intro:$imports.S.intro>0,driving:!!(typeof $imports.CarChase!=='undefined'&&$imports.CarChase.active()),
    deathPending:!!(typeof $imports.DEATH_PENDING!=='undefined'&&$imports.DEATH_PENDING),
    moduleInput:GameModules.first('ownsPlayerInput')===true,
    keepSimulation:GameModules.first('keepSimulation')===true,                   /* 模块要求打开面板时世界照走（被抓住的那一秒） */                     /* 模块接管了操作（纸飞机的阅读和飞行） */
    targetDebug:devOwnsInput(target),editing:!!editing};
}
function playerInputAllowed(){
  return $imports.GamePolicy.playerAllowed(gameInputContext());
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
  KEY={};endLook();endStick();TOUCH.run=false;$imports.S.moving=false;$imports.S.run=false;
}
window.__resetInput=resetInputState;

function releaseMouseLook(){
  INPUT.lockToken++;INPUT.lockPending=false;
  if(pointerIsLocked()&&document.exitPointerLock){try{document.exitPointerLock();}catch(e){}}
}
function requestMouseLook(){
  if(typeof $imports.CarChase!=='undefined'&&$imports.CarChase.active())return Promise.resolve(false);
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
  var changed=!$imports.IS_TOUCH;
  INPUT.mode='touch';INPUT.lastTouchAt=performance.now();INPUT.blockClickUntil=INPUT.lastTouchAt+800;
  $imports.IS_TOUCH=true;document.body.classList.add('touch');
  if(pointerIsLocked()||INPUT.lockPending)releaseMouseLook();
  if(changed)(0,$imports.updateTouchUI)();
}
function useMouseInput(){
  INPUT.mode='mouse';INPUT.blockClickUntil=0;
  if($imports.IS_TOUCH){
    $imports.IS_TOUCH=false;document.body.classList.remove('touch');
    (0,$imports.updateTouchUI)();
  }
}
function updateInputUI(){
  var hint=document.getElementById('lookhint');
  if(hint)hint.hidden=!(playerInputAllowed()&&INPUT.mode==='mouse'&&!pointerIsLocked());
}
function physicalKey(e){
  var codes={KeyW:'w',KeyA:'a',KeyS:'s',KeyD:'d',KeyE:'e',KeyF:'f',KeyG:'g',
    KeyH:'h',KeyJ:'j',KeyM:'m',KeyR:'r',KeyV:'v',Digit1:'1',Digit2:'2',Digit3:'3',Backquote:'`'};
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
  INPUT.mode=$imports.IS_TOUCH?'touch':'mouse';
  var cv=document.getElementById('cv'),stick=document.getElementById('stick');
  initTouchActivation();
  document.addEventListener('focusin',function(e){
    if(devOwnsInput(e.target)){resetInputState();releaseMouseLook();(0,$imports.updateTouchUI)();}
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
      (0,$imports.updateTouchUI)();
    }
    var owner=$imports.GamePolicy.inputOwner(gameInputContext());
    if(owner==='cutscene'){
      /* 按下就跳过演出；松指后补发的 click 会落在随后出现的结局界面按钮上，要吞掉 */
      if(e.pointerType==='touch'||e.pointerType==='pen')INPUT.touchHandled=true;
      (0,$imports.cutSkip)(); return;
    }
    if($imports.S.screen==='replay'&&typeof $imports.ArchiveReplay!=='undefined'&&$imports.ArchiveReplay.on){
      /* 死亡档案回放：按下就结束，补发的 click 不能点到随后出现的档案卡片上 */
      if(e.pointerType==='touch'||e.pointerType==='pen')INPUT.touchHandled=true;
      $imports.ArchiveReplay.skip(); return;
    }
    /* 死亡演出中：按下跳到结果（死亡界面或惊醒）；补发的 click 同样不能点到随后出现的按钮 */
    if(owner==='death'){
      if((0,$imports.deathSkip)()&&(e.pointerType==='touch'||e.pointerType==='pen'))INPUT.touchHandled=true;
      return;
    }
    if(e.pointerType==='touch'||e.pointerType==='pen')useTouchInput();
    else if(INPUT.lookType!=='touch'&&INPUT.lookType!=='pen'&&INPUT.stickId===null)useMouseInput();
  },{capture:true,passive:true});
  window.addEventListener('keydown',function(e){
    if(typeof $imports.TerminalUI!=='undefined'&&$imports.TerminalUI.on){if(e.key==='Escape'){e.preventDefault();$imports.TerminalUI.close();}return;}
    var k=physicalKey(e);
    var editing=e.target.matches('input,select,textarea,[contenteditable="true"]');
    if(typeof $imports.DevLock!=='undefined'&&$imports.DevLock.on){$imports.DevLock.key(e);return;}   /* 调试密码键盘打开时，按键只给它 */
    if(e.key==='F2'&&(!editing||$imports.DEV.on)){e.preventDefault();if(!e.repeat&&typeof $imports.Dev!=='undefined')$imports.Dev.toggle();return;}
    if(freeCursorKey(e)&&!editing&&$imports.S.screen==='play'&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey){
      e.preventDefault();if(!e.repeat)toggleFreeCursor(e);return;
    }
    if(devOwnsInput(e.target)){
      if(k==='tab')$imports.Dev.focusTrap(e);
      if(k==='escape'){e.preventDefault();if(!e.repeat)$imports.Dev.close();}
      return;
    }
    if(k==='escape'&&$imports.DEV.on&&$imports.DEV.freeze){e.preventDefault();if(!e.repeat)$imports.Dev.close();return;}
    if(editing){
      if(k!=='escape')return;
      e.target.blur();
    }
    var owner=$imports.GamePolicy.inputOwner(gameInputContext());
    if(owner==='cutscene'){
      if(k===' '||k==='enter'||k==='escape'){e.preventDefault();if(!e.repeat)(0,$imports.cutSkip)();}
      return;
    }
    if(owner==='prologue'){
      if(k===' '||k==='enter'){e.preventDefault();if(!e.repeat)(0,$imports.proNext)();}
      return;
    }
    if(owner==='death'&&(k===' '||k==='enter'||k==='escape')){   /* 跳过死亡演出 */
      e.preventDefault();if(!e.repeat)(0,$imports.deathSkip)();return;
    }
    if($imports.S.screen!=='play'||$imports.S.dead||e.ctrlKey||e.metaKey||e.altKey)return;
    if(k==='escape'){
      e.preventDefault();if(e.repeat)return;
      if($imports.PC.on){$imports.PCGAME.stop();return;}
      if($imports.PHONE.on){$imports.PHONE.stop();return;}
      if($imports.LESSON.on){$imports.LESSON.close(true);return;}
      if($imports.UI.openPanel==='set'){$imports.UI.close('set',false);if($imports.PAUSE.on)$imports.UI.open('pause');return;}
      if($imports.UI.openPanel&&$imports.UI.openPanel!=='pause'){$imports.UI.close($imports.UI.openPanel);return;}
      if($imports.PAUSE.on&&performance.now()-INPUT.unlockedAt<200)return;
      $imports.Game.pauseToggle();return;
    }
    if(k===' '&&e.target.closest('button,a,[role="button"]'))return;
    if(owner==='computer'){
      if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].indexOf(k)>=0){KEY[k]=true;e.preventDefault();}
      return;
    }
    if(owner==='lesson'){if(/^[1-3]$/.test(k)){e.preventDefault();if(!e.repeat)$imports.LESSON.answer(+k-1);}return;}
    if(owner==='phone'){
      if([' ','w','arrowup','enter'].indexOf(k)>=0){e.preventDefault();if(!e.repeat)$imports.PHONE.flap();}
      return;
    }
    if(owner==='choice'&&/^[1-9]$/.test(k)){e.preventDefault();if(!e.repeat)$imports.UI.choiceKey(+k);return;}
    if(owner==='pause'||owner==='blocked'||owner==='choice')return;
    if(owner==='driving'){
      if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].indexOf(k)>=0){e.preventDefault();KEY[k]=true;}
      return;
    }
    if(['tab','h','j','m'].indexOf(k)>=0){
      e.preventDefault();if(!e.repeat)$imports.UI.toggle({tab:'bag',h:'think',j:'note',m:'mapv'}[k]);return;
    }
    if(!playerInputAllowed())return;
    if(['w','a','s','d',' ','arrowup','arrowdown','arrowleft','arrowright'].indexOf(k)>=0)e.preventDefault();
    KEY[k]=true;if(e.repeat)return;
    if(k==='e')(0,$imports.tryInteract)();
    if(k==='v')$imports.Elevator.closeDoor();
    if(k==='r'&&!$imports.Investigation.openDesk())$imports.LESSON.open();
    if(k==='f')(0,$imports.toggleTorch)();
    if(k==='g')(0,$imports.dropSelected)();
    if(k==='1')(0,$imports.useHot)(0);
    if(k==='2')(0,$imports.useHot)(1);
  },{passive:false});
  window.addEventListener('keyup',function(e){
    KEY[physicalKey(e)]=false;
    /* 单按 Alt 松开时，部分浏览器会把焦点移到自己的菜单栏，之后按键就进不了游戏 */
    if(e.key==='Alt'&&$imports.S.screen==='play')e.preventDefault();
  });

  var proEl=document.getElementById('pro');
  if(proEl)proEl.addEventListener('click',function(e){
    e.stopPropagation();
    if($imports.GamePolicy.inputOwner(gameInputContext())==='prologue')(0,$imports.proNext)();
  });
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
    $imports.S.ang+=(0,$imports.clamp)(mx,-maxDelta,maxDelta)*.0022*(0,$imports.lookSensitivity)(false);
    $imports.S.pitch=(0,$imports.clamp)($imports.S.pitch-(0,$imports.clamp)(my,-maxDelta,maxDelta)*.0022*(0,$imports.lookSensitivity)(false),-1.25,1.25);
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
    var sense=(0,$imports.lookSensitivity)(INPUT.lookType!=='mouse');
    $imports.S.ang+=dx*.0042*sense;$imports.S.pitch=(0,$imports.clamp)($imports.S.pitch-dy*.0042*sense,-1.25,1.25);
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
  document.getElementById('tAct').addEventListener('click',function(){if(playerInputAllowed())(0,$imports.tryInteract)();});
  document.getElementById('tPause').addEventListener('click',function(){if(!$imports.PAUSE.on)$imports.Game.pause();});

  document.addEventListener('pointerlockchange',function(){
    var locked=pointerIsLocked(),wasLocked=INPUT.hadLock;INPUT.hadLock=locked;
    if(locked){
      INPUT.freeCursor=false;
      if(INPUT.mode!=='mouse'||!playerInputAllowed()){releaseMouseLook();return;}
      if(INPUT.lookType==='mouse')endLook();
    }else if(INPUT.freeCursor){
      INPUT.freeCursor=false;INPUT.unlockedAt=performance.now();resetInputState();   /* 按 Alt 放出来的：不暂停 */
    }else if(wasLocked&&INPUT.mode==='mouse'&&playerInputAllowed()&&!devOwnsInput(document.activeElement)&&!(typeof $imports.FULLSCREEN!=='undefined'&&$imports.FULLSCREEN.busy)){
      INPUT.unlockedAt=performance.now();resetInputState();$imports.Game.pause();
    }
    updateInputUI();
  });
  document.addEventListener('pointerlockerror',function(){INPUT.lockPending=false;updateInputUI();});
  function leaveGame(){
    resetInputState();
    if(playerInputAllowed())$imports.Game.pause();
    releaseMouseLook();
  }
  window.addEventListener('blur',leaveGame);
  document.addEventListener('visibilitychange',function(){$imports.lastT=performance.now();$imports.accum=0;if(document.hidden)leaveGame();});
  window.addEventListener('contextmenu',function(e){if(e.target===cv)e.preventDefault();});
}

function updatePlayer(dt){
  if($imports.S.dead||$imports.S.screen!=='play'||($imports.S.intro||0)>0)return;
  var snack=$imports.ActiveEffects.snackSeconds>0;
  var boosted=Math.min(dt,$imports.ActiveEffects.snackSeconds);
  (0,$imports.capStamina)();
  if($imports.HIDE.on){ $imports.S.moving=false; $imports.S.run=false; (0,$imports.restoreStamina)(11*dt); (0,$imports.syncCamera)(dt); return; }   /* 躲在柜子里：不能动 */
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
  if($imports.S.stam<=6)$imports.S.tired=true;
  else if($imports.S.stam>=STAM_BACK)$imports.S.tired=false;
  $imports.S.run=wantRun&&(!$imports.S.tired||snack)&&(fw!==0||sd!==0)&&GameModules.first('runBlocked')!==true;   /* 模块可以禁止奔跑（重伤） */
  var mag=Math.hypot(fw,sd);
  if($imports.S.seated&&mag>.08)(0,$imports.leaveSeat)();
  $imports.S.moving=mag>.08&&!$imports.S.seated;
  if($imports.S.moving){
    var spd=$imports.S.run?SPD_RUN:SPD_WALK;
    var runAfter=wantRun&&!$imports.S.tired;
    if(snack&&dt>0)spd=((wantRun?SPD_RUN:SPD_WALK)*boosted*1.5+(runAfter?SPD_RUN:SPD_WALK)*(dt-boosted))/dt;
    if(typeof $imports.DEV!=='undefined'&&$imports.DEV.fast)spd*=2.6;
    var _sm=GameModules.first('moveSpeedMul'); if(typeof _sm==='number'&&_sm>0)spd*=_sm;   /* 模块的速度倍率（受伤） */
    if(mag>1){fw/=mag;sd/=mag;}
    var ca=Math.cos($imports.S.ang),sa=Math.sin($imports.S.ang),x=$imports.S.x,y=$imports.S.y;
    (0,$imports.moveBy)((ca*fw-sa*sd)*spd*dt,(sa*fw+ca*sd)*spd*dt,dt);
    $imports.S.moving=Math.hypot($imports.S.x-x,$imports.S.y-y)>.0001;
  }
  if($imports.S.moving&&!$imports.S.seated){
    $imports.S.stepT=($imports.S.stepT||0)-dt;
    if($imports.S.stepT<=0){$imports.S.stepT=($imports.S.run?.30:.46)/(snack?1.5:1);$imports.SFX.step();}
  }else $imports.S.stepT=0;
  if($imports.S.run&&$imports.S.moving){
    if(!$imports.S.tired)$imports.PlayerStats.changeStamina(-STAM_RUN*Math.max(0,dt-boosted),'running',{min:0});
    else (0,$imports.restoreStamina)(STAM_REST*Math.max(0,dt-boosted));
  }
  else (0,$imports.restoreStamina)(STAM_REST*dt);
  if($imports.S.enterCool>0)$imports.S.enterCool-=dt;
  (0,$imports.syncCamera)(dt);
}
/* 体力（《校园直通、翻越受伤与国际交流》Q5 真人确认，2026-11-05）：跑 8／运行秒、不跑恢复 12／运行秒、跑空后回到 30 才能再跑 */
var SPD_WALK=21,SPD_RUN=36.4,SNACK_SEC=30,STAM_BACK=30,STAM_RUN=8,STAM_REST=12;

/* @module-exports */
GameModules.publish("game3d/js/input.js",{
"KEY":{get:function(){return KEY;},set:function($value){KEY=$value;}},
"TOUCH":{get:function(){return TOUCH;},set:function($value){TOUCH=$value;}},
"LOOKDRAG":{get:function(){return LOOKDRAG;},set:function($value){LOOKDRAG=$value;}},
"INPUT":{get:function(){return INPUT;},set:function($value){INPUT=$value;}},
"devOwnsInput":{get:function(){return devOwnsInput;},set:function($value){devOwnsInput=$value;}},
"devInputBlocked":{get:function(){return devInputBlocked;},set:function($value){devInputBlocked=$value;}},
"gameInputContext":{get:function(){return gameInputContext;},set:function($value){gameInputContext=$value;}},
"playerInputAllowed":{get:function(){return playerInputAllowed;},set:function($value){playerInputAllowed=$value;}},
"pointerIsLocked":{get:function(){return pointerIsLocked;},set:function($value){pointerIsLocked=$value;}},
"releaseCapture":{get:function(){return releaseCapture;},set:function($value){releaseCapture=$value;}},
"endLook":{get:function(){return endLook;},set:function($value){endLook=$value;}},
"endStick":{get:function(){return endStick;},set:function($value){endStick=$value;}},
"resetInputState":{get:function(){return resetInputState;},set:function($value){resetInputState=$value;}},
"releaseMouseLook":{get:function(){return releaseMouseLook;},set:function($value){releaseMouseLook=$value;}},
"requestMouseLook":{get:function(){return requestMouseLook;},set:function($value){requestMouseLook=$value;}},
"freeCursorKey":{get:function(){return freeCursorKey;},set:function($value){freeCursorKey=$value;}},
"toggleFreeCursor":{get:function(){return toggleFreeCursor;},set:function($value){toggleFreeCursor=$value;}},
"resumeMouseLook":{get:function(){return resumeMouseLook;},set:function($value){resumeMouseLook=$value;}},
"useTouchInput":{get:function(){return useTouchInput;},set:function($value){useTouchInput=$value;}},
"useMouseInput":{get:function(){return useMouseInput;},set:function($value){useMouseInput=$value;}},
"updateInputUI":{get:function(){return updateInputUI;},set:function($value){updateInputUI=$value;}},
"physicalKey":{get:function(){return physicalKey;},set:function($value){physicalKey=$value;}},
"initTouchActivation":{get:function(){return initTouchActivation;},set:function($value){initTouchActivation=$value;}},
"initInput":{get:function(){return initInput;},set:function($value){initInput=$value;}},
"updatePlayer":{get:function(){return updatePlayer;},set:function($value){updatePlayer=$value;}},
"SPD_WALK":{get:function(){return SPD_WALK;},set:function($value){SPD_WALK=$value;}},
"SPD_RUN":{get:function(){return SPD_RUN;},set:function($value){SPD_RUN=$value;}},
"SNACK_SEC":{get:function(){return SNACK_SEC;},set:function($value){SNACK_SEC=$value;}},
"STAM_BACK":{get:function(){return STAM_BACK;},set:function($value){STAM_BACK=$value;}},
"STAM_RUN":{get:function(){return STAM_RUN;},set:function($value){STAM_RUN=$value;}},
"STAM_REST":{get:function(){return STAM_REST;},set:function($value){STAM_REST=$value;}}
});
})(GameModules.imports("game3d/js/input.js"));
