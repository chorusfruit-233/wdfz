/* 里世界 3D · 设置 */
'use strict';

var SET={vol:70,sub:1,q:1,shake:1,amb:1,bright:100,grain:1,mouseSense:100,touchSense:100,textSize:100,touchSize:100,touchLayout:null};
var COMFORT_LIMITS={mouseSense:[25,250],touchSense:[25,250],textSize:[85,150],touchSize:[85,125]};
function normalizeComfort(){
  Object.keys(COMFORT_LIMITS).forEach(function(k){var v=Number(SET[k]),lim=COMFORT_LIMITS[k];SET[k]=Number.isFinite(v)?clamp(v,lim[0],lim[1]):100;});
  var layout=SET.touchLayout;
  if(!layout||typeof layout!=='object'||Array.isArray(layout)){SET.touchLayout=null;return;}
  var clean={};['stick','tAct','ttop'].forEach(function(k){var p=layout[k];if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y))clean[k]={x:clamp(p.x,0,100),y:clamp(p.y,0,100)};});
  SET.touchLayout=clean;
}
function lookSensitivity(touch){return (touch?SET.touchSense:SET.mouseSense)/100;}
function applyComfort(){
  normalizeComfort();document.documentElement.style.setProperty('--read-scale',SET.textSize/100);
  if(typeof TouchLayout!=='undefined')TouchLayout.apply();
}
var SHAKE_ON=true, SUB_MULT=1.0, AMB_ON=true;
function applyBrightness(){
  var bright=Number(SET.bright)||100;
  ['mb','sBr'].forEach(function(id){ var sl=document.getElementById(id); if(sl) sl.value=String(bright); });
  var bv=document.getElementById('sBrV'); if(bv) bv.textContent=String(bright);
  Engine.brightness(bright/100);
}
function loadSet(){
  try{
    var s=localStorage.getItem('zw3d_set');
    if(s){ var o=JSON.parse(s); for(var k in o) if(SET.hasOwnProperty(k)) SET[k]=o[k]; }
    else if(IS_TOUCH) SET.q=0;          /* 手机第一次打开：性能优先 */
  }catch(e){}
  SHAKE_ON=!!SET.shake; SUB_MULT=[0.6,1.0,1.6][SET.sub]||1.0; AMB_ON=!!SET.amb;
  try{ document.body.classList.toggle('noshake',!SHAKE_ON); }catch(e){}
  QUALITY=SET.q=Quality.normalize(SET.q);
  try{ var mq=document.getElementById('mq'); if(mq) mq.value=String(QUALITY); }catch(e){}
  try{ SFX.setVol(SET.vol/100); }catch(e){}
  applyBrightness();
  Engine.grain(SET.grain?1:0);
  applyComfort();
}
function saveSet(){ try{ localStorage.setItem('zw3d_set',JSON.stringify(SET)); }catch(e){} }
function paintSet(){
  Object.keys(COMFORT_LIMITS).forEach(function(k){var el=document.getElementById(k),value=document.getElementById(k+'Value');if(el)el.value=SET[k];if(value)value.textContent=SET[k]+'%';});
  if(typeof TouchLayout!=='undefined')TouchLayout.paint();
  var v=document.getElementById('sVol'); if(v) v.value=SET.vol;
  var vv=document.getElementById('sVolV'); if(vv) vv.textContent=SET.vol;
  [['sSub',SET.sub],['sQ',SET.q],['sShake',SET.shake?0:1],['sAmb',SET.amb?0:1],['sGrain',SET.grain?0:1]].forEach(function(p){
    var el=document.getElementById(p[0]); if(!el) return;
    var bs=el.querySelectorAll('button');
    for(var i=0;i<bs.length;i++) bs[i].className=(i===p[1])?'on':'';
  });
}
var Settings={
  comfort:function(key,value){if(!COMFORT_LIMITS[key])return;SET[key]=Number(value);applyComfort();paintSet();saveSet();},
  resetComfort:function(){Object.keys(COMFORT_LIMITS).forEach(function(k){SET[k]=100;});SET.touchLayout=null;applyComfort();paintSet();saveSet();toast('操作与文字设置已恢复默认');},
  vol:function(v){ SET.vol=+v; try{ SFX.setVol(SET.vol/100); }catch(e){} 
    var e=document.getElementById('sVolV'); if(e) e.textContent=SET.vol; saveSet(); },
  sub:function(i){ SET.sub=i; SUB_MULT=[0.6,1.0,1.6][i]; paintSet(); saveSet(); },
  bright:function(v){
    SET.bright=+v;
    applyBrightness();
    saveSet();
  },
  q:function(i){
    SET.q=QUALITY=Quality.normalize(i);paintSet();saveSet();
    var mq=document.getElementById('mq');if(mq)mq.value=String(QUALITY);
    Engine.applyQuality();
    toast(Quality.get().label);
  },
  shake:function(off){ SET.shake=off?0:1; SHAKE_ON=!off; document.body.classList.toggle('noshake',!SHAKE_ON); paintSet(); saveSet(); },
  amb:function(on){ SET.amb=on; AMB_ON=!!on; paintSet(); saveSet(); if(on) SFX.ambient(); else SFX.stopAmbient(); },
  grain:function(on){ SET.grain=on?1:0; Engine.grain(SET.grain); paintSet(); saveSet(); }
};
