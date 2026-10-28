/* 里世界 3D · 天光、雾、路灯 */
'use strict';

/* ---------- 天光：一条太阳曲线管所有东西 ----------
   以前天空、环境光、雾各有各的时间表：天空 19:48 就黑透了，环境光要到 20:50 才暗，
   雾却一直是近黑色 —— 白天远处的楼全成了黑剪影。现在全部从 sunAt() 取值，
   日出 6:00，日落 18:36，前后各有一段霞光。 */
var SUN_RISE=6.0, SUN_SET=18.6;
function hourNow(){ return (((S.tsec%1440)+1440)%1440)/60; }
function smooth01(a,b,x){ var t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); }
function sunAt(h){
  var span=SUN_SET-SUN_RISE;
  var e=Math.sin(PI*(h-SUN_RISE)/span);            /* 太阳高度：白天 0..1，夜里为负 */
  var day=smooth01(-0.10,0.32,e);                  /* 0 = 夜，1 = 白天 */
  var gold=smooth01(-0.24,0.0,e)*(1-smooth01(0.06,0.42,e))*0.55;   /* 霞光：隔着云，只透出一点暗红 */
  var t=clamp((h-SUN_RISE)/span,0,1), az=PI*t;
  return { e:e, day:day, gold:gold, night:1-day,
    dir:[Math.cos(az), 0.10+Math.max(0,e)*1.2, 0.55*Math.sin(az)] };   /* 东升（+x）→ 南 → 西落 */
}
function skyBucket(){
  var s=sunAt(hourNow());
  if(s.day>0.7) return 'day';
  if(s.day>0.08) return 'dusk';
  return 'night';
}
var SKY_NIGHT=['#03060a','#070c11','#0c141a','#111b22'];
/* 白天是阴天：一整块压低的铅灰云层，顶上略深，地平线发白发灰，几乎看不出蓝 */
var SKY_DAY  =['#4f5961','#66707a','#848c93','#9aa0a3'];
var SKY_GOLD =['#2a2f3c','#4c4852','#7d6559','#94776a'];
function hex2rgb(h){
  return [parseInt(h.substr(1,2),16),parseInt(h.substr(3,2),16),parseInt(h.substr(5,2),16)];
}
var SKY_STORM=['#2a3036','#353d43','#444c52','#4e575d'];
function skyRGB(hour){
  var s=sunAt(hour), out=[], j, k, oc=(typeof GLR!=='undefined'&&GLR.overcast)||0;
  for(j=0;j<4;j++){
    var n=hex2rgb(SKY_NIGHT[j]), d=hex2rgb(SKY_DAY[j]), g=hex2rgb(SKY_GOLD[j]), st=hex2rgb(SKY_STORM[j]), c=[];
    for(k=0;k<3;k++){
      var v=n[k]+(d[k]-n[k])*s.day;
      v=v+(g[k]-v)*s.gold*0.85;
      v=v+(st[k]*(0.30+0.70*s.day)-v)*oc*0.9;          /* 下雨：压成铅灰 */
      c.push(Math.round(v));
    }
    out.push(c);
  }
  return out;
}
function skyColorsAt(hour){
  return skyRGB(hour).map(function(c){ return 'rgb('+c[0]+','+c[1]+','+c[2]+')'; });
}
function makeSky(arg){
  try{
    var cv=document.createElement('canvas');
    cv.width=2; cv.height=256;
    var c=cv.getContext('2d');
    if(!c) return null;
    var h=(typeof arg==='number')?arg:(arg==='night'?0:(arg==='dusk'?18.7:12));
    var cols=skyColorsAt(h);
    var gr=c.createLinearGradient(0,0,0,256);
    gr.addColorStop(0.00,cols[0]);
    gr.addColorStop(0.62,cols[1]);
    gr.addColorStop(0.88,cols[2]);
    gr.addColorStop(1.00,cols[3]);
    c.fillStyle=gr; c.fillRect(0,0,2,256);
    var t=new THREE.CanvasTexture(cv);
    t.colorSpace=THREE.SRGBColorSpace;
    return t;
  }catch(e){ return null; }
}
function refreshSky(){
  var q=Math.round(hourNow()*20)/20+Math.round((GLR.overcast||0)*10)*100;   /* 每 3 分钟一档；阴云另算 */
  if(GLR.skyHour===q&&GLR.skyTex) return;
  GLR.skyHour=q;
  GLR.skyBucket=skyBucket();
  if(GLR.skyTex&&GLR.skyTex.dispose) GLR.skyTex.dispose();
  GLR.skyTex=makeSky(hourNow());
  if(GLR.skyTex) GLR.scene.background=GLR.skyTex;
}
function dayLight(){ return sunAt(hourNow()).day; }
/* 白天室外的画面亮度减半（render.js 后期里乘 GLR.dayExpo）。屋里的灯保持原亮度，但会闪 */
var DAY_K=0.5;
var LCFG={
  ptI:26, ptDist:14, ptDecay:2.0,
  lampI:15, lampDist:15,
  camI:1.6, camIk:1.4, camDist:12, camDecay:1.5
};
var MOON_DIR=[-0.42,0.80,0.43];
var _lc1=null,_lc2=null;
function mixRGB(a,b,t){ return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t]; }
function lightState(){
  var sun=sunAt(hourNow());
  var indoor=(S.mode==='in');
  var roof=indoor&&S.room==='teach6';
  if(roof) indoor=false;                     /* 天台上头顶就是天 */
  var day=sun.day;
  var wn=(typeof GLR!=='undefined'&&GLR.worldNorm)?GLR.worldNorm:0;
  if(wn>0) day=day+(1-day)*0.6*wn;           /* "正常世界"那一段总是亮一点 */
  var fnl=(S.fn&&S.fn.on&&S.fn.v<72)?1:0;
  if(fnl) day=Math.max(day,0.85);
  var st={ day:day, gold:sun.gold, sun:sun, indoor:indoor };
  if(indoor){
    var g=(S.room==='garage1');
    st.amb = g?0.06:(0.15+0.22*day);
    st.hemi= g?0.04:(0.08+0.17*day);
    st.dir = g?0.03:(0.05+0.20*day);
    st.ptK = g?1:(0.42+0.58*day);            /* 夜里的灯还亮着，只是暗、会闪 */
  }else{
    st.amb = 0.07+0.22*day;
    st.hemi= 0.10+0.40*day;
    st.dir = day>0.02 ? (0.15+0.42*day) : 0.15;   /* 云层后面的太阳：光是散的，影子很淡 */
    st.ptK = 1;
  }
  return st;
}
function updateLighting(){
  var ocT=(typeof AN!=='undefined'&&AN.active&&(AN.id==='rain'||AN.id==='raindots'))?1:0;
  GLR.overcast=(GLR.overcast||0)+(ocT-(GLR.overcast||0))*Math.min(1,(dtG||0.016)*0.6);
  try{ refreshSky(); }catch(e){}
  if(!GLR.amb) return;
  var s=lightState(), i, sun=s.sun, oc=GLR.overcast;
  var gz=1-0.88*(GLR.gaze||0);              /* 被"目光"盯着的时候，屋里一下子暗下去 */
  GLR.amb.intensity=s.amb*(1-0.25*oc)*gz;
  GLR.hemi.intensity=s.hemi*(1-0.30*oc)*gz;
  GLR.moon.intensity=s.dir*(1-0.70*oc)*gz;
  /* 颜色：白天偏暖白，霞光橙，夜里月光偏蓝 */
  var sunCol=mixRGB([0.86,0.88,0.90],[0.92,0.66,0.50],sun.gold);    /* 阴天的光偏冷、发灰 */
  var dc=mixRGB([0.55,0.66,0.86],sunCol,smooth01(0.0,0.35,s.day));
  GLR.moon.color.setRGB(dc[0],dc[1],dc[2]);
  var hs=mixRGB([0.16,0.21,0.30],[0.70,0.74,0.78],s.day), hg=mixRGB([0.05,0.05,0.06],[0.34,0.34,0.31],s.day);
  hs=mixRGB(hs,[0.86,0.62,0.50],sun.gold*0.5);
  GLR.hemi.color.setRGB(hs[0],hs[1],hs[2]); GLR.hemi.groundColor.setRGB(hg[0],hg[1],hg[2]);
  var ac=mixRGB([0.36,0.40,0.50],[0.46,0.48,0.50],s.day);
  GLR.amb.color.setRGB(ac[0],ac[1],ac[2]);
  if(s.day>0.02&&!s.indoor){
    GLR.moon.position.set(sun.dir[0]*16, sun.dir[1]*16, sun.dir[2]*16);
  }else{
    GLR.moon.position.set(MOON_DIR[0]*16, MOON_DIR[1]*16, MOON_DIR[2]*16);
  }
  /* 雾：室外跟着地平线的天色走，白天薄、夜里厚；室内是屋里那种暗 */
  var fog=GLR.scene.fog;
  if(fog){
    if(!s.indoor){
      var hz=skyRGB(hourNow())[3];
      var fk=0.86;
      var fr=hz[0]/255*fk, fgc=hz[1]/255*fk, fb=hz[2]/255*fk;
      var dens=0.030+(0.0115-0.030)*s.day;    /* 白天也有一层潮气，远处的楼发灰 */
      if(AN&&AN.active&&AN.id==='rain'){ dens+=0.030; fr=fr*0.6+0.09; fgc=fgc*0.6+0.10; fb=fb*0.6+0.12; }
      if(S.mode==='in') dens*=1.4;            /* 天台：雾近一点，楼底下看不清 */
      fog.color.setRGB(fr,fgc,fb,THREE.SRGBColorSpace);
      fog.density=dens;
    }else{
      fog.color.setHex(FOG_COL);
      fog.density=(S.room==='garage1')?0.082:0.050;
    }
  }
  var tt=GLR.time||0;
  var pf=GLR.patrolFlick||0, pr=GLR.patrolRed||0, sum=0;
  for(i=0;i<GLR.roomLights.length;i++){
    var base=GLR.roomLightBase[i]*s.ptK;
    var flick=roomFlicker(i,tt,s.day);
    if(pf>0) flick*=1-pf*(1-patrolBeat(tt));            /* 巡察者要来了：所有灯一起按节拍闪 */
    sum+=flick;
    GLR.roomLights[i].intensity=base*Math.max(0.05,flick)*(1+0.3*pr)*gz;
    var bc=GLR.roomLightCol&&GLR.roomLightCol[i];
    if(bc) GLR.roomLights[i].color.setRGB(bc.r+(1-bc.r)*pr, bc.g*(1-0.92*pr), bc.b*(1-0.95*pr));   /* 被它盯上：灯变红 */
  }
  /* 灯盘本身（自发光材质）跟着一起闪、一起变红 */
  var em=(typeof MATS!=='undefined')&&MATS.emit;
  if(em){ var k=GLR.roomLights.length?clamp(sum/GLR.roomLights.length,0.2,1):1; em.color.setRGB(k,k*(1-0.9*pr),k*(1-0.92*pr)); }
  lampTick(s);
  /* 室外（含天台）按天色压曝光：正午乘 DAY_K，夜里不变；"正常世界"那一段不压 */
  var wn=GLR.worldNorm||0;
  GLR.dayExpo=s.indoor?1:1-(1-DAY_K)*sun.day*(1-wn);
  GLR.camLight.intensity=(LCFG.camI+LCFG.camIk*s.day)*gz;
}
/* 灯的闪烁：一直有一点点抖；每盏灯隔一阵会接触不良地连闪几下；夜里偶尔整盏暗一下 */
function lhash(a,b){ var x=Math.sin(a*127.1+b*311.7)*43758.5453; return x-Math.floor(x); }
function roomFlicker(i,tt,day){
  var ph=i*2.7;
  var f=0.93+0.07*Math.sin(tt*7.3+ph)+0.03*Math.sin(tt*23.1+ph*1.7);
  var seg=Math.floor((tt+ph*3)/7), r=lhash(seg,i);
  if(r<0.5){                                             /* 这 7 秒里有一次：0.4–1.1 秒的连闪 */
    var at=lhash(seg,i+17)*5.5, len=0.4+lhash(seg,i+31)*0.7, u=(tt+ph*3)-seg*7-at;
    if(u>0&&u<len) f*=(Math.sin(u*90)>0.1)?1:0.12;
  }
  if(day<0.3&&Math.sin(tt*0.37+ph*5.3)>0.985) f*=0.15;
  return f;
}
/* 巡察者出现前的节拍：两下短闪、一下长暗，像心跳 */
function patrolBeat(tt){
  var u=(tt*0.9)%1;
  return (u<0.08||(u>0.16&&u<0.24))?0.1:(u>0.5&&u<0.7?0.25:1);
}
/* 路灯：灯头在夜里自发光；离镜头最近的几盏配一盏真点光（数量固定，避免切场景时重编着色器） */
var OUT_LAMPS=[];
function lampTick(s){
  var night=s.indoor?0:1-s.day;
  if(GLR.lampHeadMat){
    var c0=[0.36,0.40,0.42], c1=[1.0,0.86,0.62];
    var lc=mixRGB(c0,c1,smooth01(0.15,0.7,night));
    GLR.lampHeadMat.color.setRGB(lc[0],lc[1],lc[2]);
  }
  if(GLR.winSkyMat){                       /* 室内窗玻璃里透进来的天光 */
    var sk=skyRGB(hourNow())[2], dk=s.day;
    var kk=0.55+0.45*dk;
    GLR.winSkyMat.color.setRGB(sk[0]/255*kk,sk[1]/255*kk,sk[2]/255*kk,THREE.SRGBColorSpace);
  }
  if(GLR.winLitMat){
    var wc=mixRGB([0.20,0.27,0.31],[0.95,0.78,0.48],smooth01(0.2,0.8,night));
    GLR.winLitMat.color.setRGB(wc[0],wc[1],wc[2]);
  }
  if(!GLR.lampPool) return;
  var i, L=GLR.lampPool;
  if(S.mode!=='out'||night<0.05||!OUT_LAMPS.length){
    for(i=0;i<L.length;i++) L[i].intensity=0;
    return;
  }
  GLR.lampPick=(GLR.lampPick||0)-dtG;
  if(GLR.lampPick<=0){
    GLR.lampPick=0.35;
    var cx=GLR.cam.position.x, cz=GLR.cam.position.z;
    var best=OUT_LAMPS.slice().sort(function(a,b){
      return ((a.x-cx)*(a.x-cx)+(a.z-cz)*(a.z-cz))-((b.x-cx)*(b.x-cx)+(b.z-cz)*(b.z-cz));
    });
    for(i=0;i<L.length;i++){ var b=best[i]; if(b) L[i].position.set(b.x,b.y-0.25,b.z); L[i].userData.on=!!b; }
  }
  var tt=GLR.time||0;
  for(i=0;i<L.length;i++){
    var fl=1;
    if(i===1&&Math.sin(tt*1.7)>0.93) fl=0.25+0.5*Math.abs(Math.sin(tt*31));   /* 总有一盏接触不良 */
    if((GLR.patrolFlick||0)>0) fl*=1-GLR.patrolFlick*(1-patrolBeat(tt));     /* 夜里巡察者在室外：路灯也按节拍闪 */
    L[i].intensity=L[i].userData.on?LCFG.lampI*smooth01(0.15,0.7,night)*fl:0;
  }
}
