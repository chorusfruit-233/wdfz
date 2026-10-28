/* 里世界 3D · 全屏与触屏界面 */
'use strict';

var IS_TOUCH=(function(){
  return !!((window.matchMedia&&window.matchMedia('(pointer:coarse)').matches)||
    'ontouchstart' in window||navigator.maxTouchPoints>0);
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
  button.hidden=!!(PRO.on||S.dead||S.screen==='end'||PC.on||UI.chooseOpen||
    (UI.openPanel&&UI.openPanel!=='pause'&&UI.openPanel!=='set'));
  var hint=document.getElementById('mios');
  if(hint)hint.style.display=IS_TOUCH&&!fullscreenSupported()&&!isStandalone()?'block':'none';
}
function refreshViewport(){
  if(FULLSCREEN.resizeFrame)cancelAnimationFrame(FULLSCREEN.resizeFrame);
  FULLSCREEN.resizeFrame=requestAnimationFrame(function(){
    FULLSCREEN.resizeFrame=0;
    if(GLR.renderer)resizeGL();
  });
}
function goFullscreen(){
  if(FULLSCREEN.busy)return Promise.resolve(false);
  if(!fullscreenElement()&&!fullscreenSupported()){
    toast(isStandalone()?'当前已从主屏幕以全屏方式运行。':appleTouchDevice()?
      '此浏览器不支持网页全屏，请用「分享 → 添加到主屏幕」后打开。':
      '当前浏览器不支持或未允许网页全屏；可使用浏览器的全屏功能。');
    syncFullscreenUI();return Promise.resolve(false);
  }
  FULLSCREEN.busy=true;resetInputState();releaseMouseLook();syncFullscreenUI();
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
  return Promise.resolve(result).then(function(){return true;},function(){
    toast(exiting?'退出全屏失败，请重试或使用浏览器退出。':'未能进入全屏，请再次点击按钮；在内嵌页面中可尝试用浏览器单独打开。');
    return false;
  }).then(function(ok){
    FULLSCREEN.busy=false;syncFullscreenUI();refreshViewport();
    if(playerInputAllowed())document.getElementById('cv').focus({preventScroll:true});
    resumeMouseLook();return ok;
  });
}
function initMobileShell(){
  function fullscreenChanged(){syncFullscreenUI();refreshViewport();}
  document.addEventListener('fullscreenchange',fullscreenChanged);
  document.addEventListener('webkitfullscreenchange',fullscreenChanged);
  window.addEventListener('orientationchange',function(){resetInputState();refreshViewport();});
  if(window.visualViewport)window.visualViewport.addEventListener('resize',refreshViewport);
  // 禁止游戏手势触发页面缩放，同时保留菜单、背包和设置的原生滚动。
  ['gesturestart','gesturechange','gestureend'].forEach(function(type){
    document.addEventListener(type,function(e){
      if((e.target.id==='cv'||(e.target.closest&&e.target.closest('#touch')))&&e.cancelable)e.preventDefault();
    },{passive:false});
  });
  syncFullscreenUI();
}
function updateTouchUI(){
  var el=document.getElementById('touch');if(!el)return;
  var on=IS_TOUCH&&playerInputAllowed(),want=on?'block':'none';
  if(el.style.display!==want){
    var wasOn=el.style.display==='block';el.style.display=want;
    if(wasOn&&!on)resetInputState();
  }
  updateInputUI();syncFullscreenUI();
}
