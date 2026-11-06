/* @module-capsule */
(function($imports){
/* 里世界 3D · 设置 */
'use strict';

/* rv：图形模式设置的版本。2026-11-05 起默认 WebGL，不再默认先试 WebGPU；没有 rv 的旧设置（当时默认是「自动」）一律改成 WebGL，之后玩家自己选的照存 */
var SET={renderer:'webgl',rv:1,distortion:2,reduceFlash:0,soundCaptions:1,vol:70,sub:1,q:1,shake:1,amb:1,bright:100,grain:1,mouseSense:100,touchSense:100,textSize:100,touchSize:100,touchLayout:null,autoLand:1};   /* autoLand：自动横屏（2026-11-06，默认开） */
var COMFORT_LIMITS={mouseSense:[25,250],touchSense:[25,250],textSize:[85,150],touchSize:[85,125]};
function normalizeComfort(){
  if(!['auto','webgl'].includes(SET.renderer))SET.renderer='webgl';
  ['distortion','soundCaptions'].forEach(function(k){if(![0,1,2].includes(SET[k]))SET[k]=k==='distortion'?2:1;});
  SET.reduceFlash=SET.reduceFlash===1?1:0;
  SET.autoLand=SET.autoLand===0?0:1;
  Object.keys(COMFORT_LIMITS).forEach(function(k){var v=Number(SET[k]),lim=COMFORT_LIMITS[k];SET[k]=Number.isFinite(v)?(0,$imports.clamp)(v,lim[0],lim[1]):100;});
  var layout=SET.touchLayout;
  if(!layout||typeof layout!=='object'||Array.isArray(layout)){SET.touchLayout=null;return;}
  var clean={};['stick','tAct','ttop'].forEach(function(k){var p=layout[k];if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y))clean[k]={x:(0,$imports.clamp)(p.x,0,100),y:(0,$imports.clamp)(p.y,0,100)};});
  SET.touchLayout=clean;
}
function lookSensitivity(touch){return (touch?SET.touchSense:SET.mouseSense)/100;}
function applyComfort(){
  normalizeComfort();document.documentElement.style.setProperty('--read-scale',SET.textSize/100);
  if(typeof $imports.TouchLayout!=='undefined')$imports.TouchLayout.apply();
}
var SHAKE_ON=true, SUB_MULT=1.0, AMB_ON=true;
function applyBrightness(){
  var bright=Number(SET.bright)||100;
  ['mb','sBr'].forEach(function(id){ var sl=document.getElementById(id); if(sl) sl.value=String(bright); });
  var bv=document.getElementById('sBrV'); if(bv) bv.textContent=String(bright);
  $imports.Engine.brightness(bright/100);
}
function loadSet(){
  try{
    var s=localStorage.getItem('zw3d_set');
    if(s){ var o=JSON.parse(s); for(var k in o) if(SET.hasOwnProperty(k)) SET[k]=o[k]; if(o.rv!==1){ SET.renderer='webgl'; SET.rv=1; } }
    else if($imports.IS_TOUCH) SET.q=0;          /* 手机第一次打开：性能优先 */
  }catch(e){}
  if(!s||!o||o.distortion===undefined)SET.distortion=!SET.shake?0:matchMedia('(prefers-reduced-motion: reduce)').matches?1:2;
  if(!s||!o||o.reduceFlash===undefined)SET.reduceFlash=matchMedia('(prefers-reduced-motion: reduce)').matches?1:0;
  if(!s||!o||o.soundCaptions===undefined)SET.soundCaptions=1;
  normalizeComfort();
  SHAKE_ON=!!SET.shake; SUB_MULT=[0.6,1.0,1.6][SET.sub]||1.0; AMB_ON=!!SET.amb;
  try{ document.body.classList.toggle('noshake',!SHAKE_ON); }catch(e){}
  $imports.QUALITY=SET.q=$imports.Quality.normalize(SET.q);
  try{ var mq=document.getElementById('mq'); if(mq) mq.value=String($imports.QUALITY); }catch(e){}
  try{ $imports.SFX.setVol(SET.vol/100); }catch(e){}
  applyBrightness();
  $imports.Engine.grain(SET.grain?1:0);
  applyComfort();
}
function saveSet(){ try{ localStorage.setItem('zw3d_set',JSON.stringify(SET)); }catch(e){} }
function paintSet(){
  var mode=document.getElementById('sRenderer');if(mode)mode.value=SET.renderer;
  var rendererLabel=document.getElementById('rendererCurrent');
  if(rendererLabel){var state=$imports.Engine.status();rendererLabel.textContent='当前：'+(state.backend==='webgpu'?'WebGPU':state.backend==='webgl'?'WebGL 2':'正在准备')+' · 选择在下次打开游戏时生效';}
  Object.keys(COMFORT_LIMITS).forEach(function(k){var el=document.getElementById(k),value=document.getElementById(k+'Value');if(el)el.value=SET[k];if(value)value.textContent=SET[k]+'%';});
  if(typeof $imports.TouchLayout!=='undefined')$imports.TouchLayout.paint();
  var v=document.getElementById('sVol'); if(v) v.value=SET.vol;
  var vv=document.getElementById('sVolV'); if(vv) vv.textContent=SET.vol;
  [['sDistortion',2-SET.distortion],['sReduceFlash',1-SET.reduceFlash],['sSoundCaptions',SET.soundCaptions],['sSub',SET.sub],['sQ',SET.q],['sShake',SET.shake?0:1],['sAmb',SET.amb?0:1],['sGrain',SET.grain?0:1],['sAutoLand',SET.autoLand?0:1]].forEach(function(p){
    var el=document.getElementById(p[0]); if(!el) return;
    var bs=el.querySelectorAll('button');
    for(var i=0;i<bs.length;i++) bs[i].className=(i===p[1])?'on':'';
  });
}
var Settings={
  renderer:function(value){SET.renderer=value;SET.rv=1;normalizeComfort();saveSet();paintSet();},
  /* 主菜单的「设置」：和暂停里是同一个面板；从主菜单打开时「返回」回到主菜单，不显示「返回游戏」 */
  fromMenu:false,
  openFromMenu:function(){Settings.fromMenu=true;paintSet();document.body.classList.add('setmenu');var g=document.getElementById('setResume');if(g)g.hidden=true;$imports.UI.open('set');},
  back:function(){$imports.UI.close('set',false);document.body.classList.remove('setmenu');var g=document.getElementById('setResume');if(g)g.hidden=false;if(Settings.fromMenu){Settings.fromMenu=false;var b=document.getElementById('btnset');if(b)b.focus();return;}if($imports.PAUSE.on)$imports.UI.open('pause');},
  reload:function(){location.reload();},
  retryRenderer:function(){SET.renderer='webgl';saveSet();var url=new URL(location.href);url.searchParams.set('renderer','webgl');location.assign(url.href);},
  sensory:function(key,value){if(!['distortion','reduceFlash','soundCaptions'].includes(key))return;SET[key]=value;normalizeComfort();paintSet();saveSet();if(typeof $imports.SoundCaptions!=='undefined')$imports.SoundCaptions.paint();},
  comfort:function(key,value){if(!COMFORT_LIMITS[key])return;SET[key]=Number(value);applyComfort();paintSet();saveSet();},
  resetComfort:function(){Object.keys(COMFORT_LIMITS).forEach(function(k){SET[k]=100;});SET.touchLayout=null;applyComfort();paintSet();saveSet();(0,$imports.toast)('操作与文字设置已恢复默认');},
  vol:function(v){ SET.vol=+v; try{ $imports.SFX.setVol(SET.vol/100); }catch(e){}
    var e=document.getElementById('sVolV'); if(e) e.textContent=SET.vol; saveSet(); try{ (0,$imports.applyAppAudio)(); }catch(e2){} },
  sub:function(i){ SET.sub=i; SUB_MULT=[0.6,1.0,1.6][i]; paintSet(); saveSet(); },
  bright:function(v){
    SET.bright=+v;
    applyBrightness();
    saveSet();
  },
  q:function(i){
    SET.q=$imports.QUALITY=$imports.Quality.normalize(i);paintSet();saveSet();
    var mq=document.getElementById('mq');if(mq)mq.value=String($imports.QUALITY);
    $imports.Engine.applyQuality();
    (0,$imports.toast)($imports.Quality.get().label);
  },
  /* 自动横屏：安卓版由原生锁横屏；网页版在手机上全屏时尽量锁横屏（mobile.js 的 applyOrientation） */
  autoLand:function(off){ SET.autoLand=off?0:1; paintSet(); saveSet(); try{ (0,$imports.applyOrientation)(); }catch(e){} },
  shake:function(off){ SET.shake=off?0:1; SHAKE_ON=!off; document.body.classList.toggle('noshake',!SHAKE_ON); paintSet(); saveSet(); },
  amb:function(on){ SET.amb=on; AMB_ON=!!on; paintSet(); saveSet(); if(on) $imports.SFX.ambient(); else $imports.SFX.stopAmbient(); try{ (0,$imports.applyAppAudio)(); }catch(e){} },
  grain:function(on){ SET.grain=on?1:0; $imports.Engine.grain(SET.grain); paintSet(); saveSet(); }
};

/* @module-exports */
GameModules.publish("game3d/js/settings.js",{
"SET":{get:function(){return SET;},set:function($value){SET=$value;}},
"COMFORT_LIMITS":{get:function(){return COMFORT_LIMITS;},set:function($value){COMFORT_LIMITS=$value;}},
"normalizeComfort":{get:function(){return normalizeComfort;},set:function($value){normalizeComfort=$value;}},
"lookSensitivity":{get:function(){return lookSensitivity;},set:function($value){lookSensitivity=$value;}},
"applyComfort":{get:function(){return applyComfort;},set:function($value){applyComfort=$value;}},
"SHAKE_ON":{get:function(){return SHAKE_ON;},set:function($value){SHAKE_ON=$value;}},
"SUB_MULT":{get:function(){return SUB_MULT;},set:function($value){SUB_MULT=$value;}},
"AMB_ON":{get:function(){return AMB_ON;},set:function($value){AMB_ON=$value;}},
"applyBrightness":{get:function(){return applyBrightness;},set:function($value){applyBrightness=$value;}},
"loadSet":{get:function(){return loadSet;},set:function($value){loadSet=$value;}},
"saveSet":{get:function(){return saveSet;},set:function($value){saveSet=$value;}},
"paintSet":{get:function(){return paintSet;},set:function($value){paintSet=$value;}},
"Settings":{get:function(){return Settings;},set:function($value){Settings=$value;}}
});
})(GameModules.imports("game3d/js/settings.js"));
