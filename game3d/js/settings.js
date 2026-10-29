/* 里世界 3D · 设置 */
'use strict';

var SET={vol:70,sub:1,q:1,shake:1,amb:1,bright:100};
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
  QUALITY=SET.q=Quality.normalize(SET.q);
  try{ var mq=document.getElementById('mq'); if(mq) mq.value=String(QUALITY); }catch(e){}
  try{ SFX.setVol(SET.vol/100); }catch(e){}
  applyBrightness();
}
function saveSet(){ try{ localStorage.setItem('zw3d_set',JSON.stringify(SET)); }catch(e){} }
function paintSet(){
  var v=document.getElementById('sVol'); if(v) v.value=SET.vol;
  var vv=document.getElementById('sVolV'); if(vv) vv.textContent=SET.vol;
  [['sSub',SET.sub],['sQ',SET.q],['sShake',SET.shake?0:1],['sAmb',SET.amb?0:1]].forEach(function(p){
    var el=document.getElementById(p[0]); if(!el) return;
    var bs=el.querySelectorAll('button');
    for(var i=0;i<bs.length;i++) bs[i].className=(i===p[1])?'on':'';
  });
}
var Settings={
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
  shake:function(off){ SET.shake=off?0:1; SHAKE_ON=!off; paintSet(); saveSet(); },
  amb:function(on){ SET.amb=on; AMB_ON=!!on; paintSet(); saveSet(); if(on) SFX.ambient(); else SFX.stopAmbient(); }
};
