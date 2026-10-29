/* 里世界 3D · 键鼠与触屏输入、玩家移动 */
'use strict';

var KEY={}, TOUCH={dx:0,dy:0,run:false,active:false};
var LOOKDRAG={on:false,x:0,y:0};
var INPUT={mode:'mouse',lookId:null,lookType:null,stickId:null,stickCenter:null,
  dragDistance:0,blockClickUntil:0,lastTouchAt:-1000,wantsLock:false,
  lockPending:false,lockToken:0,hadLock:false,unlockedAt:-1000};

function playerInputAllowed(){
  return S.screen==='play'&&!S.dead&&!PAUSE.on&&!UI.anyOpen()&&
    !(typeof PRO!=='undefined'&&PRO.on)&&!(typeof PC!=='undefined'&&PC.on)&&!(typeof PHONE!=='undefined'&&PHONE.on)&&
    !(typeof DEV!=='undefined'&&DEV.on)&&!(S.intro>0);
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
  if(INPUT.mode!=='mouse'||!playerInputAllowed())return Promise.resolve(false);
  var cv=document.getElementById('cv');
  INPUT.wantsLock=true;
  if(pointerIsLocked())return Promise.resolve(true);
  if(!cv.requestPointerLock||INPUT.lockPending)return Promise.resolve(false);
  INPUT.lockPending=true;var token=++INPUT.lockToken,result;
  try{result=cv.requestPointerLock();}catch(e){INPUT.lockPending=false;return Promise.resolve(false);}
  return Promise.resolve(result).then(function(){
    if(token!==INPUT.lockToken||INPUT.mode!=='mouse'||!playerInputAllowed()){
      if(pointerIsLocked())releaseMouseLook();return false;
    }
    INPUT.lockPending=false;return pointerIsLocked();
  },function(){
    if(token===INPUT.lockToken)INPUT.lockPending=false;
    /* 拒绝锁定仍可拖动，不能打断正在进行的触屏手势。 */
    return false;
  });
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
    KeyH:'h',KeyJ:'j',KeyM:'m',Digit1:'1',Digit2:'2'};
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
    /* 记下按钮处理完的时刻：坐下、进房间这类操作在手机上可能跑上大半秒，
       浏览器补发的那次 click 要等它跑完才派发，按松指时刻算会超出窗口，于是同一个键被按了两次 */
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
    if(e.isTrusted&&touch&&((same&&performance.now()-lastTime<600)||ghost)){
      e.preventDefault();e.stopImmediatePropagation();
    }
  },true);
  window.addEventListener('blur',function(){taps.clear();});
}
function initInput(){
  INPUT.mode=IS_TOUCH?'touch':'mouse';
  var cv=document.getElementById('cv'),stick=document.getElementById('stick');
  initTouchActivation();
  document.addEventListener('pointerdown',function(e){
    if(typeof S!=='undefined'&&S.screen==='cut'){ cutSkip(); return; }
    if(e.pointerType==='touch'||e.pointerType==='pen')useTouchInput();
    else if(INPUT.lookType!=='touch'&&INPUT.lookType!=='pen'&&INPUT.stickId===null)useMouseInput();
  },{capture:true,passive:true});
  window.addEventListener('keydown',function(e){
    var k=physicalKey(e);
    if(e.target.matches('input,select,textarea,[contenteditable="true"]')){
      if(k!=='escape')return;
      e.target.blur();
    }
    if(e.key==='F2'){e.preventDefault();if(!e.repeat&&typeof Dev!=='undefined')Dev.toggle();return;}
    if(PRO.on){
      if(k===' '||k==='enter'){e.preventDefault();if(!e.repeat)proNext();}
      return;
    }
    if(S.screen==='cut'){ if(k===' '||k==='enter'||k==='escape'){e.preventDefault();cutSkip();} return; }   /* 跳过结局演出 */
    if(S.screen!=='play'||S.dead||e.ctrlKey||e.metaKey||e.altKey)return;
    if(k==='escape'){
      e.preventDefault();if(e.repeat)return;
      if(PC.on){PCGAME.stop();return;}
      if(PHONE.on){PHONE.stop();return;}
      if(DEV.on){Dev.close();return;}
      if(UI.openPanel==='set'){UI.close('set',false);if(PAUSE.on)UI.open('pause');return;}
      if(UI.openPanel&&UI.openPanel!=='pause'){UI.close(UI.openPanel);return;}
      if(PAUSE.on&&performance.now()-INPUT.unlockedAt<200)return;
      Game.pauseToggle();return;
    }
    if(k===' '&&e.target.closest('button,a,[role="button"]'))return;
    if(PC.on){
      if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].indexOf(k)>=0){KEY[k]=true;e.preventDefault();}
      return;
    }
    if(PHONE.on){
      if([' ','w','arrowup','enter'].indexOf(k)>=0){e.preventDefault();if(!e.repeat)PHONE.flap();}
      return;
    }
    if(UI.chooseOpen&&!PAUSE.on&&/^[1-9]$/.test(k)){e.preventDefault();if(!e.repeat)UI.choiceKey(+k);return;}
    if(PAUSE.on||DEV.on||UI.chooseOpen||S.intro>0)return;
    if(['tab','h','j','m'].indexOf(k)>=0){
      e.preventDefault();if(!e.repeat)UI.toggle({tab:'bag',h:'think',j:'note',m:'mapv'}[k]);return;
    }
    if(!playerInputAllowed())return;
    if(['w','a','s','d',' ','arrowup','arrowdown','arrowleft','arrowright'].indexOf(k)>=0)e.preventDefault();
    KEY[k]=true;if(e.repeat)return;
    if(k==='e')tryInteract();
    if(k==='f')toggleTorch();
    if(k==='g')dropSelected();
    if(k==='1')useHot(0);
    if(k==='2')useHot(1);
  },{passive:false});
  window.addEventListener('keyup',function(e){KEY[physicalKey(e)]=false;});

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
    if(!pointerIsLocked()||INPUT.mode!=='mouse'||!playerInputAllowed())return;
    var mx=e.movementX||0,my=e.movementY||0;
    if(!isFinite(mx)||!isFinite(my))return;
    S.ang+=clamp(mx,-maxDelta,maxDelta)*.0022;
    S.pitch=clamp(S.pitch-clamp(my,-maxDelta,maxDelta)*.0022,-1.25,1.25);
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
    S.ang+=dx*.0042;S.pitch=clamp(S.pitch-dy*.0042,-1.25,1.25);
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
      if(INPUT.mode!=='mouse'||!playerInputAllowed()){releaseMouseLook();return;}
      if(INPUT.lookType==='mouse')endLook();
    }else if(wasLocked&&INPUT.mode==='mouse'&&playerInputAllowed()&&!(typeof FULLSCREEN!=='undefined'&&FULLSCREEN.busy)){
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
  if(typeof HIDE!=='undefined'&&HIDE.on){ S.moving=false; S.run=false; S.stam=Math.min(100,S.stam+11*dt); syncCamera(dt); return; }   /* 躲在柜子里：不能动 */
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
  else S.stam=Math.min(100,S.stam+11*dt);
  if(S.enterCool>0)S.enterCool-=dt;
  syncCamera(dt);
}
var SPD_WALK=21,SPD_RUN=36.4,SNACK_SEC=30,STAM_BACK=35;
