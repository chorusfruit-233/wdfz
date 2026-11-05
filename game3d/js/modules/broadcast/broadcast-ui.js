/* @module-capsule */
(function($imports){
/* Non-pausing microphone panel. Commands go through Broadcast, never through player state. */
'use strict';
var BroadcastUI=(function(){
  var on=false,root=null,signature='';
  function init(){
    if(root)return;
    root=document.createElement('section');root.id='broadcast-panel';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-label','广播站话筒');
    root.innerHTML='<header><b>广播站 · 话筒</b><button type="button" id="radio-close" aria-label="离开话筒">离开</button></header>'+
      '<p id="radio-status" aria-live="polite"></p><label>手中的稿纸<select id="radio-paper"></select></label><p id="radio-page"></p>'+
      '<progress id="radio-progress" value="0" max="20"></progress><button type="button" id="radio-read">按住朗读 · 空格</button>'+
      '<small>松开会重读当前段。广播响起时巡察者会来调查；先停播，再躲藏或从另一扇门离开。</small>';
    document.body.appendChild(root);
    root.querySelector('#radio-close').onclick=close;
    var read=root.querySelector('#radio-read');
    read.addEventListener('pointerdown',function(e){if(read.disabled)return;e.preventDefault();try{read.setPointerCapture(e.pointerId);}catch(ignore){}$imports.Broadcast.hold(true);});
    ['pointerup','pointercancel','lostpointercapture'].forEach(function(name){read.addEventListener(name,function(){$imports.Broadcast.hold(false);});});
    root.querySelector('#radio-paper').onchange=function(e){$imports.Broadcast.select(e.target.value);};
    root.addEventListener('pointerdown',function(e){e.stopPropagation();});
  }
  function open(){init();on=true;signature='';$imports.INPUT.freeCursor=true;(0,$imports.resetInputState)();(0,$imports.releaseMouseLook)();paint();root.querySelector('#radio-read').focus({preventScroll:true});}
  function close(){on=false;$imports.Broadcast.stop();if(root)root.hidden=true;(0,$imports.resumeMouseLook)();}
  function paint(){
    if(!root)return;
    if(!$imports.GamePolicy.simulationAllowed((0,$imports.gameInputContext)()))$imports.Broadcast.stop();
    if($imports.S.screen!=='play'||$imports.S.dead||!$imports.Broadcast.nearStation()){on=false;$imports.Broadcast.stop();}
    root.hidden=!on||$imports.PAUSE.on||$imports.UI.anyOpen();if(root.hidden)return;
    if($imports.Broadcast.state().phase==='bell'){close();return;}
    var b=$imports.Broadcast.state(),r=$imports.Broadcast.reading(),ids=['notice1','notice2','notice3','notice4','notice_fake'].filter($imports.hasItem),key=ids.join('|');
    if(signature!==key){signature=key;var sel=root.querySelector('select');sel.textContent='';ids.forEach(function(id){var o=document.createElement('option');o.value=id;o.textContent=$imports.ITEMS[id].n+' · '+(id==='notice_fake'?'红笔／第 0 天':'蓝黑／第二天');sel.appendChild(o);});}
    root.querySelector('select').value=b.selected;
    var p=b.selected==='notice_fake'?$imports.BroadcastRules.paper(0,true):$imports.BroadcastRules.paper(+b.selected.slice(-1)-1,false);
    root.querySelector('#radio-page').textContent=p.ink+' · '+p.date+'：'+p.text;
    root.querySelector('#radio-status').textContent=b.phase==='bell'?'长铃已响，跟随同学从北门离校。':$imports.Broadcast.reason()||('已播完 '+b.completed+'/4 段 · '+(r.held?'正在播音，门禁已报告这个房间。':'从当前这一段开头朗读。'));
    var bar=root.querySelector('progress');bar.max=r.seconds;bar.value=r.progress;
    var btn=root.querySelector('#radio-read');btn.disabled=!!$imports.Broadcast.reason()||b.phase==='bell'||!ids.length;
    btn.textContent=r.held?'正在朗读 · 松开停播':'按住朗读 · 空格';
  }
  document.addEventListener('keydown',function(e){
    if(!on||root.hidden)return;
    if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();return;}
    if(e.code==='Space'&&!(e.target.matches&&e.target.matches('select,input,textarea'))){e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)$imports.Broadcast.hold(true);}
  },true);
  document.addEventListener('keyup',function(e){if(on&&e.code==='Space'){e.preventDefault();$imports.Broadcast.hold(false);}},true);
  window.addEventListener('blur',function(){$imports.Broadcast.hold(false);});
  document.addEventListener('visibilitychange',function(){if(document.hidden)$imports.Broadcast.hold(false);});
  GameModules.on('boot',init,{owner:'broadcast'});GameModules.on('frame',paint,{owner:'broadcast'});
  GameModules.on('boundary',function(){on=false;if(root)root.hidden=true;},{owner:'broadcast'});
  GameModules.on('leaveRoom',function(){on=false;$imports.Broadcast.stop();if(root)root.hidden=true;},{owner:'broadcast'});
  return {open:open,close:close,paint:paint,isOpen:function(){return on;}};
})();

/* @module-exports */
GameModules.publish("game3d/js/modules/broadcast/broadcast-ui.js",{
"BroadcastUI":{get:function(){return BroadcastUI;},set:function($value){BroadcastUI=$value;}}
});
})(GameModules.imports("game3d/js/modules/broadcast/broadcast-ui.js"));
