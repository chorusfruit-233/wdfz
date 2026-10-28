/* 里世界 3D · 设置 */
'use strict';

var SET={vol:70,sub:1,q:1,shake:1,amb:1,bright:100};
var SHAKE_ON=true, SUB_MULT=1.0, AMB_ON=true;
function loadSet(){
  try{
    var s=localStorage.getItem('zw3d_set');
    if(s){ var o=JSON.parse(s); for(var k in o) if(SET.hasOwnProperty(k)) SET[k]=o[k]; }
    else if(IS_TOUCH) SET.q=0;          /* 手机第一次打开：性能优先 */
  }catch(e){}
  SHAKE_ON=!!SET.shake; SUB_MULT=[0.6,1.0,1.6][SET.sub]||1.0; AMB_ON=!!SET.amb;
  QUALITY=(SET.q===0||SET.q===2)?SET.q:1;
  try{ var mq=document.getElementById('mq'); if(mq) mq.value=String(QUALITY); }catch(e){}
  try{ SFX.setVol(SET.vol/100); }catch(e){}
  try{ if(GLR.postMat) GLR.postMat.uniforms.uBright.value=Math.max(0.4,Math.min(2.0,(SET.bright||100)/100)); }catch(e){}
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
    try{ if(GLR.postMat) GLR.postMat.uniforms.uBright.value=Math.max(0.4,Math.min(2.0,+v/100)); }catch(e){}
    saveSet();
  },
  q:function(i){ SET.q=i; QUALITY=i; paintSet(); saveSet();
    try{ resizeGL(); }catch(e){}
    try{ shadeApplyQuality(); }catch(e){}
    /* 画质同时决定树、草、灌木的数量：在室外就当场重建 */
    try{ if(S.screen==='play'&&S.mode==='out') enterWorldOut(); }catch(e){}
    toast(['流畅：少树、无草、低分辨率','均衡','精细：更多树和草'][i]); },
  shake:function(off){ SET.shake=off?0:1; SHAKE_ON=!off; paintSet(); saveSet(); },
  amb:function(on){ SET.amb=on; AMB_ON=!!on; paintSet(); saveSet(); if(on) SFX.ambient(); else SFX.stopAmbient(); }
};
