/* @module-capsule */
(function($imports){
/* 里世界 3D · 全屏与触屏界面 */
'use strict';

/* 外壳：安卓版（GeckoView）打开 ?app=android。安卓版没有「进入全屏」按钮（一直是全屏），横屏由原生来锁 */
var APP_SHELL=(function(){ try{ return /[?&]app=android(?:&|$)/.test(location.search)?'android':''; }catch(e){ return ''; } })();
/* 自动横屏（设置「操作」，默认开）：安卓版发给 App 内的本机服务（/__app/orientation），由原生锁成横屏或跟随系统；
   网页版只在手机上、全屏时试着锁（浏览器不支持就算了） */
/* 安卓版：把音乐开关和音量告诉 App，下次打开时签名动画的音乐照这个来（App 自己记住） */
var APP_AUDIO_SENT='';
function applyAppAudio(){
  if(APP_SHELL!=='android') return;
  var S=$imports.SET||{}, q='music='+(S.amb===0||S.amb===false?0:1)+'&vol='+Math.round(+S.vol||0);
  if(q===APP_AUDIO_SENT) return; APP_AUDIO_SENT=q;
  try{ fetch('/__app/audio?'+q,{cache:'no-store'}).catch(function(){}); }catch(e){}
}
function applyOrientation(){
  var want=!($imports.SET&&$imports.SET.autoLand===0);
  if(APP_SHELL==='android'){
    try{ fetch('/__app/orientation?mode='+(want?'landscape':'any'),{cache:'no-store'}).catch(function(){}); }catch(e){}
    return want;
  }
  try{
    var so=window.screen&&window.screen.orientation;
    if(!so) return false;
    if(!want){ if(so.unlock) so.unlock(); return false; }
    if(IS_TOUCH&&fullscreenElement()&&so.lock) so.lock('landscape').catch(function(){});
  }catch(e){}
  return want;
}
var IS_TOUCH=(function(){
  /* 触屏笔记本也有触摸能力；优先按主要指针决定初始界面。 */
  if(window.matchMedia){
    if(window.matchMedia('(pointer: fine)').matches) return false;
    if(window.matchMedia('(pointer: coarse)').matches) return true;
  }
  return !!('ontouchstart' in window||navigator.maxTouchPoints>0);
})();
var FULLSCREEN={busy:false,resizeFrame:0};
function isStandalone(){
  return !!(navigator.standalone||(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches));
}
function fullscreenElement(){return document.fullscreenElement||document.webkitFullscreenElement;}
function fullscreenSupported(){
  var el=document.documentElement;
  return !!((el.requestFullscreen&&document.fullscreenEnabled!==false)||
    (el.webkitRequestFullscreen&&document.webkitFullscreenEnabled!==false));
}
function appleTouchDevice(){
  return /iPad|iPhone|iPod/.test(navigator.userAgent)||
    (navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
}
function syncFullscreenUI(){
  var button=document.getElementById('fullscreen-toggle');if(!button)return;
  var active=!!fullscreenElement(),standalone=isStandalone()&&!fullscreenSupported();
  var text=active?'退出全屏':standalone?'全屏运行中':fullscreenSupported()?'进入全屏':'全屏说明';
  var label=FULLSCREEN.busy?'切换中…':text;
  if(button.textContent!==label)button.textContent=label;
  button.disabled=FULLSCREEN.busy||standalone;
  button.setAttribute('aria-pressed',String(active||standalone));
  button.setAttribute('aria-label',text);button.title=text;
  button.hidden=!!(APP_SHELL==='android'||$imports.PRO.on||$imports.S.dead||$imports.S.screen==='end'||$imports.PC.on||$imports.PHONE.on||$imports.UI.chooseOpen||
    ($imports.UI.openPanel&&$imports.UI.openPanel!=='pause'&&$imports.UI.openPanel!=='set'));
  var hint=document.getElementById('mios');
  if(hint)hint.style.display=IS_TOUCH&&!fullscreenSupported()&&!isStandalone()?'block':'none';
}
function refreshViewport(){
  if(FULLSCREEN.resizeFrame)cancelAnimationFrame(FULLSCREEN.resizeFrame);
  FULLSCREEN.resizeFrame=requestAnimationFrame(function(){
    FULLSCREEN.resizeFrame=0;
    if($imports.GLR.renderer)(0,$imports.resizeGL)();
    TouchLayout.apply();
  });
}
function goFullscreen(){
  if(FULLSCREEN.busy)return Promise.resolve(false);
  if(!fullscreenElement()&&!fullscreenSupported()){
    (0,$imports.toast)(isStandalone()?'当前已从主屏幕以全屏方式运行。':appleTouchDevice()?
      '此浏览器不支持网页全屏，请用「分享 → 添加到主屏幕」后打开。':
      '当前浏览器不支持或未允许网页全屏；可使用浏览器的全屏功能。');
    syncFullscreenUI();return Promise.resolve(false);
  }
  FULLSCREEN.busy=true;(0,$imports.resetInputState)();(0,$imports.releaseMouseLook)();syncFullscreenUI();
  var result,exiting=!!fullscreenElement();
  try{
    if(exiting){
      var exit=document.fullscreenElement?document.exitFullscreen:(document.webkitExitFullscreen||document.exitFullscreen);
      if(!exit)throw new Error('Fullscreen exit unavailable');
      result=exit.call(document);
    }else{
      var el=document.documentElement;
      result=(el.requestFullscreen&&document.fullscreenEnabled!==false)?el.requestFullscreen({navigationUI:'hide'}):el.webkitRequestFullscreen();
    }
  }catch(e){result=Promise.reject(e);}
  return Promise.resolve(result).then(function(){ if(!exiting) applyOrientation(); return true;},function(){
    (0,$imports.toast)(exiting?'退出全屏失败，请重试或使用浏览器退出。':'未能进入全屏，请再次点击按钮；在内嵌页面中可尝试用浏览器单独打开。');
    return false;
  }).then(function(ok){
    FULLSCREEN.busy=false;syncFullscreenUI();refreshViewport();
    if((0,$imports.playerInputAllowed)())document.getElementById('cv').focus({preventScroll:true});
    (0,$imports.resumeMouseLook)();return ok;
  });
}
function initMobileShell(){
  TouchLayout.apply();
  /* 只有横竖屏真的换了才清掉正在按的摇杆：地址栏收起、软键盘之类的小幅尺寸变化不该打断移动 */
  var portrait=innerHeight>=innerWidth;
  window.addEventListener('resize',function(){
    var now=innerHeight>=innerWidth;if(now!==portrait){portrait=now;(0,$imports.resetInputState)();}
    TouchLayout.apply();
  });
  function fullscreenChanged(){syncFullscreenUI();refreshViewport();}
  document.addEventListener('fullscreenchange',fullscreenChanged);
  document.addEventListener('webkitfullscreenchange',fullscreenChanged);
  window.addEventListener('orientationchange',function(){(0,$imports.resetInputState)();refreshViewport();});
  if(window.visualViewport)window.visualViewport.addEventListener('resize',refreshViewport);
  // 禁止游戏手势触发页面缩放，同时保留菜单、背包和设置的原生滚动。
  ['gesturestart','gesturechange','gestureend'].forEach(function(type){
    document.addEventListener(type,function(e){
      if((e.target.id==='cv'||(e.target.closest&&e.target.closest('#touch')))&&e.cancelable)e.preventDefault();
    },{passive:false});
  });
  syncFullscreenUI();
  if(APP_SHELL) document.body.classList.add('app-'+APP_SHELL);
  applyOrientation();                                           /* 安卓版：按设置告诉 App 锁横屏还是跟随系统 */
  applyAppAudio();
}
function updateTouchUI(){
  var el=document.getElementById('touch');if(!el)return;
  var on=IS_TOUCH&&(0,$imports.playerInputAllowed)(),want=on?'block':'none';
  if(el.style.display!==want){
    var wasOn=el.style.display==='block';el.style.display=want;
    if(wasOn&&!on)(0,$imports.resetInputState)();
    if(on)TouchLayout.apply();
    if(typeof $imports.DEV!=='undefined'&&$imports.DEV.on){ try{ $imports.Dev.fitPanel(); }catch(e){} }   /* 触屏控件出现 / 收起：横屏的调试面板重新让开它们 */
  }
  (0,$imports.updateInputUI)();syncFullscreenUI();
}

/* 布局使用相对位置保存；命中区始终至少 44px，旋转后重新约束。 */
var TouchLayout={rects:{},
  defaults:{stick:{x:22,y:84},tAct:{x:80,y:87},ttop:{x:80,y:8}},
  position:function(id){return $imports.SET.touchLayout&&$imports.SET.touchLayout[id]||(this.native||{})[id]||this.defaults[id];},
  apply:function(){
    var w=window.innerWidth,h=window.innerHeight,scale=$imports.SET.touchSize/100;
    var container=document.getElementById('touch'),oldDisplay=container.style.display,oldVisibility=container.style.visibility;
    container.style.display='block';container.style.visibility='hidden';
    ['stick','tAct','ttop','tside','knob','tBook','tPause'].forEach(function(id){
      var s=document.getElementById(id).style;
      ['left','right','top','bottom','width','height','min-width','flex'].forEach(function(k){s.removeProperty(k);});
    });
    this.native={};this.rects={};
    ['stick','tAct','ttop'].forEach(function(id){var r=document.getElementById(id).getBoundingClientRect();TouchLayout.native[id]={x:(r.x+r.width/2)/w*100,y:(r.y+r.height/2)/h*100};TouchLayout.rects[id]={x:r.x,y:r.y,w:r.width,h:r.height};});
    if(!$imports.SET.touchLayout&&$imports.SET.touchSize===100){container.style.display=oldDisplay;container.style.visibility=oldVisibility;this.paint();return;}
    var cs=getComputedStyle(document.documentElement),safe=function(k){return parseFloat(cs.getPropertyValue(k))||0;};
    var left=8+safe('--sl'),right=w-8-safe('--sr'),top=8+safe('--st'),bottom=h-8-safe('--sb');
    var baseRects=this.rects,placed=[];this.rects={};
    var fullscreen=document.getElementById('fullscreen-toggle').getBoundingClientRect();
    if(IS_TOUCH&&fullscreen.width)placed.push({x:fullscreen.x,y:fullscreen.y,w:fullscreen.width,h:fullscreen.height});
    /* 快捷栏在 HUD 层，覆盖摇杆时会误用物品；按当前 CSS 布局预留整排的命中区。 */
    var hot=document.getElementById('hot').getBoundingClientRect();
    if(IS_TOUCH&&hot.width&&hot.height)placed.push({x:hot.x,y:hot.y,w:hot.width,h:hot.height});
    ['stick','tAct','ttop','tside'].forEach(function(id){
      var el=document.getElementById(id);if(!el)return;
      var base=baseRects[id],size=id==='tside'?58:Math.min(Math.max(44,(base.w||100)*scale),right-left,id==='stick'?h*.48:id==='tAct'?h*.4:right-left);
      var height=id==='ttop'?Math.max(44,Math.min((base.h||52)*scale,bottom-top)):size,p=TouchLayout.position(id);
      if(id==='tside'){var act=TouchLayout.rects.tAct;p={x:(act.x+act.w-29)/w*100,y:(act.y-36)/h*100};}
      var width=Math.max(44,size),x=(0,$imports.clamp)(w*p.x/100-width/2,left,right-width),y=(0,$imports.clamp)(h*p.y/100-height/2,top,bottom-height);
      function clear(nx,ny){return placed.every(function(r){return nx+width+8<=r.x||nx>=r.x+r.w+8||ny+height+8<=r.y||ny>=r.y+r.h+8;});}
      if(!clear(x,y)){
        var best=null;for(var cy=top;cy<=bottom-height;cy+=8)for(var cx=left;cx<=right-width;cx+=8){
          if(clear(cx,cy)){var dist=Math.hypot(cx-x,cy-y);if(!best||dist<best.d)best={x:cx,y:cy,d:dist};}
        }
        if(best){x=best.x;y=best.y;}
      }
      var r={x:x,y:y,w:width,h:height};placed.push(r);TouchLayout.rects[id]=r;
      el.style.left=x+'px';el.style.top=y+'px';el.style.right='auto';el.style.bottom='auto';el.style.width=width+'px';el.style.height=height+'px';
      if(id==='stick'){
        var knob=document.getElementById('knob'),ks=width*.36;knob.style.width=ks+'px';knob.style.height=ks+'px';knob.style.left=(width-ks)/2+'px';knob.style.top=(height-ks)/2+'px';
      }else if(id==='ttop')Array.from(el.children).forEach(function(b){b.style.minWidth='44px';b.style.height=height+'px';b.style.flex='1';b.style.width='auto';});
    });
    container.style.display=oldDisplay;container.style.visibility=oldVisibility;
    this.paint();
  },
  /* 设置里的示意图：外框按当前屏幕比例，选中的那个按键描黄铜色 */
  paint:function(){
    var target=document.getElementById('layoutTarget');if(!target)return;
    var id=target.value,p=this.position(id),x=document.getElementById('layoutX'),y=document.getElementById('layoutY');
    x.value=Math.round(p.x);y.value=Math.round(p.y);
    var xv=document.getElementById('layoutXValue'),yv=document.getElementById('layoutYValue');
    if(xv)xv.textContent=Math.round(p.x)+'%';if(yv)yv.textContent=Math.round(p.y)+'%';
    Array.prototype.forEach.call(document.querySelectorAll('#layoutSeg button'),function(b){var on=b.getAttribute('data-control')===id;b.classList.toggle('on',on);b.setAttribute('aria-pressed',String(on));});
    var preview=document.getElementById('layoutPreview');
    if(preview&&preview.parentElement&&preview.parentElement.clientWidth){        /* 按当前屏幕比例缩小成示意图，最高 230px */
      var ratio=window.innerWidth/Math.max(1,window.innerHeight),pw=preview.parentElement.clientWidth,ph=Math.min(230,pw/ratio);
      preview.style.width=Math.round(ph*ratio)+'px';preview.style.height=Math.round(ph)+'px';
    }
    Object.keys(this.rects).forEach(function(key){var r=TouchLayout.rects[key],node=document.querySelector('#layoutPreview [data-control="'+key+'"]');if(!node)return;
      node.style.left=(r.x/window.innerWidth*100)+'%';node.style.top=(r.y/window.innerHeight*100)+'%';node.style.width=(r.w/window.innerWidth*100)+'%';node.style.height=(r.h/window.innerHeight*100)+'%';
      node.classList.toggle('on',key===id);});
  },
  pick:function(id){if(!this.defaults[id])return;document.getElementById('layoutTarget').value=id;this.paint();},
  change:function(axis,value){
    var id=document.getElementById('layoutTarget').value;if(!this.defaults[id]||(axis!=='x'&&axis!=='y'))return;
    var p=this.position(id);$imports.SET.touchLayout=$imports.SET.touchLayout||{};$imports.SET.touchLayout[id]={x:p.x,y:p.y};$imports.SET.touchLayout[id][axis]=(0,$imports.clamp)(Number(value)||0,0,100);
    (0,$imports.resetInputState)();this.apply();(0,$imports.saveSet)();
  },
  reset:function(){$imports.SET.touchLayout=null;$imports.SET.touchSize=100;(0,$imports.resetInputState)();(0,$imports.applyComfort)();(0,$imports.paintSet)();(0,$imports.saveSet)();}
};

/* @module-exports */
GameModules.publish("game3d/js/mobile.js",{
"APP_SHELL":{get:function(){return APP_SHELL;},set:function($value){APP_SHELL=$value;}},
"APP_AUDIO_SENT":{get:function(){return APP_AUDIO_SENT;},set:function($value){APP_AUDIO_SENT=$value;}},
"applyAppAudio":{get:function(){return applyAppAudio;},set:function($value){applyAppAudio=$value;}},
"applyOrientation":{get:function(){return applyOrientation;},set:function($value){applyOrientation=$value;}},
"IS_TOUCH":{get:function(){return IS_TOUCH;},set:function($value){IS_TOUCH=$value;}},
"FULLSCREEN":{get:function(){return FULLSCREEN;},set:function($value){FULLSCREEN=$value;}},
"isStandalone":{get:function(){return isStandalone;},set:function($value){isStandalone=$value;}},
"fullscreenElement":{get:function(){return fullscreenElement;},set:function($value){fullscreenElement=$value;}},
"fullscreenSupported":{get:function(){return fullscreenSupported;},set:function($value){fullscreenSupported=$value;}},
"appleTouchDevice":{get:function(){return appleTouchDevice;},set:function($value){appleTouchDevice=$value;}},
"syncFullscreenUI":{get:function(){return syncFullscreenUI;},set:function($value){syncFullscreenUI=$value;}},
"refreshViewport":{get:function(){return refreshViewport;},set:function($value){refreshViewport=$value;}},
"goFullscreen":{get:function(){return goFullscreen;},set:function($value){goFullscreen=$value;}},
"initMobileShell":{get:function(){return initMobileShell;},set:function($value){initMobileShell=$value;}},
"updateTouchUI":{get:function(){return updateTouchUI;},set:function($value){updateTouchUI=$value;}},
"TouchLayout":{get:function(){return TouchLayout;},set:function($value){TouchLayout=$value;}}
});
})(GameModules.imports("game3d/js/mobile.js"));
