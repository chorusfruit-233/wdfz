/* @module-capsule */
(function($imports){
/* 里世界 3D · 主循环、HUD、开始 / 继续 / 退出、启动 */
'use strict';



var lastT=0, accum=0, running=false,dtG=.016;
function frame(t){
  requestAnimationFrame(frame);
  if(!running) { lastT=t; return; }
  var dt=(t-lastT)/1000; lastT=t;
  dtG=dt;
  $imports.Playtest.frame(dt);
  $imports.QualityWatch.tick(dtG,$imports.GamePolicy.simulationAllowed((0,$imports.gameInputContext)())&&!document.hidden);
  /* 允许一秒内的慢帧按真实时间补齐固定步；更长的卡顿仍有上限，避免恢复时跑出大量积压。 */
  accum+=Math.min(dt,1);
  var step=1/60, guard=0;
  while(accum>=step&&guard++<60){
    try{ update(step);$imports.LESSON.fastForward(step); }catch(e){ try{ showErr('update: '+e.message); }catch(_e){} break; }
    accum-=step;
  }
  try{ (0,$imports.render)(Math.min(dt,0.25)); }catch(e){ try{ showErr('render: '+e.message); }catch(_e){} }
}
function update(dt){return $imports.AppSimulation.update(dt);}








/* 界面节点每帧都要用：取一次存起来（节点被换掉时重新取） */







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
  (0,$imports.loadSet)();
  try{ if($imports.IS_TOUCH&&document.body&&document.body.classList) document.body.classList.add('touch'); }catch(e){}
  try{ (0,$imports.initMobileShell)(); }catch(e){}
  try{ if((location.search||'').indexOf('dev')>=0) $imports.Lifecycle.scope('session').timeout(function(){ try{ $imports.Dev.open(); }catch(e){} }, 500); }catch(e){}
  try{
    if((location.search||'').indexOf('nocss')>=0){
      ['vig','scan','fade','flash'].forEach(function(id){
        var e=document.getElementById(id); if(e) e.style.display='none';
      });
    }
  }catch(e){}
  (0,$imports.buildInteriorData)();
  (0,$imports.buildRoomBounds)();
  (0,$imports.initGL)();
  (0,$imports.applyBrightness)();
  try{ (0,$imports.shadeApplyQuality)(); }catch(e){}
  (0,$imports.initInput)();
  try{ (0,$imports.initPcTouch)(); }catch(e){}
  (0,$imports.paintMenuSave)();
  GameModules.emit('boot');                       /* 模块和 Mod：界面、渲染都已就绪 */
  requestAnimationFrame(frame);
  $imports.Lifecycle.scope('session').timeout($imports.captureMenuPhoto,420); /* 先让菜单画出来，再拍那张照片 */
}
/* 时钟冻结的房间（R.noClock，例如虚空迷宫）：游戏钟不走 */

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot);
else boot();

/* @module-exports */
GameModules.publish("game3d/js/main.js",{
"lastT":{get:function(){return lastT;},set:function($value){lastT=$value;}},
"accum":{get:function(){return accum;},set:function($value){accum=$value;}},
"running":{get:function(){return running;},set:function($value){running=$value;}},
"dtG":{get:function(){return dtG;},set:function($value){dtG=$value;}},
"frame":{get:function(){return frame;},set:function($value){frame=$value;}},
"update":{get:function(){return update;},set:function($value){update=$value;}},
"ERR_SHOWN":{get:function(){return ERR_SHOWN;},set:function($value){ERR_SHOWN=$value;}},
"showErr":{get:function(){return showErr;},set:function($value){showErr=$value;}},
"boot":{get:function(){return boot;},set:function($value){boot=$value;}}
});
})(GameModules.imports("game3d/js/main.js"));
