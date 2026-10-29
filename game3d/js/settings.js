/* 里世界 3D · 设置 */
'use strict';

var SET={vol:70,sub:1,q:1,shake:1,amb:1,bright:100,engine:'auto',fpsAsk:1};
var SHAKE_ON=true, SUB_MULT=1.0, AMB_ON=true;
function applyBrightness(){
  var bright=Number(SET.bright)||100;
  ['mb','sBr'].forEach(function(id){ var sl=document.getElementById(id); if(sl) sl.value=String(bright); });
  var bv=document.getElementById('sBrV'); if(bv) bv.textContent=String(bright);
  if(GLR.postMat) GLR.postMat.uniforms.uBright.value=Math.max(0.4,Math.min(2.0,bright/100));
}
function loadSet(){
  try{
    var s=localStorage.getItem('zw3d_set');
    if(s){ var o=JSON.parse(s); for(var k in o) if(SET.hasOwnProperty(k)) SET[k]=o[k]; }
    else if(IS_TOUCH) SET.q=0;          /* 手机第一次打开：性能优先 */
  }catch(e){}
  SHAKE_ON=!!SET.shake; SUB_MULT=[0.6,1.0,1.6][SET.sub]||1.0; AMB_ON=!!SET.amb;
  QUALITY=qualityValid(SET.q); SET.q=QUALITY;
  if(['auto','three','babylon'].indexOf(SET.engine)<0) SET.engine='auto';
  try{ var mq=document.getElementById('mq'); if(mq) mq.value=String(QUALITY); }catch(e){}
  try{ SFX.setVol(SET.vol/100); }catch(e){}
  applyBrightness();
}
function saveSet(){ try{ localStorage.setItem('zw3d_set',JSON.stringify(SET)); }catch(e){} }
function paintSet(){
  var v=document.getElementById('sVol'); if(v) v.value=SET.vol;
  var vv=document.getElementById('sVolV'); if(vv) vv.textContent=SET.vol;
  var eng=document.getElementById('sEngV'); if(eng) eng.textContent=gfxEngineLabel();
  [['sSub',SET.sub],['sQ',SET.q],['sEng',['auto','three','babylon'].indexOf(SET.engine)],['sShake',SET.shake?0:1],['sAmb',SET.amb?0:1]].forEach(function(p){
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
    i=qualityValid(i);
    var texChanged=QPROF[i].texSize!==QP().texSize||QPROF[i].relief!==QP().relief;
    SET.q=i; QUALITY=i; paintSet(); saveSet();
    try{ var mq=document.getElementById('mq'); if(mq) mq.value=String(i); }catch(e){}
    if(texChanged) MAT_RESET_PENDING=true;         /* 贴图分辨率变了：下次建场景时材质重新生成 */
    try{ GFX.select(); }catch(e){}
    try{ resizeGL(); }catch(e){}
    try{ shadeApplyQuality(); }catch(e){}
    /* 室内：不重建房间（人和同学都不动），光柱和灯下光斑当场换；分段数、贴图等下次进房间生效。
       室外：画质决定树、草、灌木的数量，当场重建 */
    try{ if(S.screen==='play'&&S.mode==='in'&&INTERIORS[S.room]){ shadeBuildRoom(INTERIORS[S.room]); shadeBuildPools(); } }catch(e){}
    try{ if(S.screen==='play'&&S.mode==='out') enterWorldOut(); }catch(e){}
    FPSW.low=0; FPSW.asked=false;
    toast(QP().tip); },
  engine:function(i){
    SET.engine=['auto','three','babylon'][i]||'auto'; saveSet();
    try{ GFX.select(); }catch(e){}
    paintSet();
    toast('渲染引擎：'+gfxEngineLabel()); },
  shake:function(off){ SET.shake=off?0:1; SHAKE_ON=!off; paintSet(); saveSet(); },
  amb:function(on){ SET.amb=on; AMB_ON=!!on; paintSet(); saveSet(); if(on) SFX.ambient(); else SFX.stopAmbient(); }
};

/* 设置里那一行显示「现在实际在用哪个引擎」 */
function gfxEngineLabel(){
  var want=qualityEngine(), cur=(typeof GFX!=='undefined')?GFX.name():'three';
  var nm={three:'Three.js',babylon:'Babylon.js'};
  if(typeof GFX!=='undefined'&&GFX.loading) return '正在加载 '+nm[GFX.loading]+'…';
  if(typeof GFX!=='undefined'&&GFX.failed[want]) return nm.three+'（'+nm[want]+' 不可用）';
  return nm[cur]+((SET.engine||'auto')==='auto'?'（按画质自动）':'');
}
