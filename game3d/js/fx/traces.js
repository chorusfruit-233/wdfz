/* @module-capsule */
(function($imports){
/* 里世界 3D · 异常的痕迹、低 SAN 幻觉 */
'use strict';

/* ---------- 异常的痕迹 ----------
   异象过去以后，地上会留下点东西：积水、粉笔圈的残迹、死掉的飞蛾、一行行脚印……
   记在存档里（RT.traces），回到那个地方还能看见。另外有几处从一开始就在的痕迹。 */
var TR={g:null,key:''};
var TRACE_STATIC=[
  {k:'scratch', room:'teach1', c:56.98,r:17.2},     /* 厕所门口墙上一道道指甲印 */
  {k:'drag',    room:'garage1',c:40,   r:13.5},     /* 车库：拖过去的两道鞋印 */
  {k:'wetfeet', room:'dorm1',  c:38,   r:7.5},      /* 宿舍楼梯口：湿脚印，只有来的方向 */
  {k:'outline', room:'teach6', c:20,   r:6},        /* 天台：粉笔画的人形 */
  {k:'shoe',    room:null,     x:288,  y:428},      /* 操场边：一只白球鞋 */
  {k:'hands',   room:'lab1',   c:24,   r:16.01}      /* 实验楼一楼：玻璃上的手印，从外面按的 */
];
function tracesBuild(force){
  var key=($imports.S.mode==='in'?$imports.S.room:'out')+'|'+(($imports.RT.traces&&$imports.RT.traces.length)||0);
  if(!force&&TR.key===key&&TR.g&&TR.g.parent) return;
  if(TR.g){$imports.GLR.scene.remove(TR.g);$imports.ThreeBackend.disposeGroup(TR.g);}
  TR.key=key;
  var g=new $imports.THREE.Group(); TR.g=g;
  var room=($imports.S.mode==='in')?$imports.S.room:null, R=room?$imports.INTERIORS[room]:null;
  function W(x,y){ return (0,$imports.worldToScene)(x,y,R); }
  function C(c,r){ return R?W(R.ox+c*R.tw,R.oy+r*R.th):{x:0,z:0}; }
  var mDark=(0,$imports.anfxMat)(0x101418,0.55), mWet=(0,$imports.anfxMat)(0x18242a,0.62), mChalk=(0,$imports.anfxMat)(0xd8d4cc,0.35),
      mPale=(0,$imports.anfxMat)(0xb8b2a0,0.85), mRed=(0,$imports.anfxMat)(0x3a1210,0.7);
  function flat(m,w,d,x,z,rot,y){ var o=(0,$imports.anfxBox)(g,m,w,0.004,d,x,y||0.016,z); if(rot) o.rotation.y=rot; return o; }
  function footprints(x,z,a,n,gap){
    for(var i=0;i<n;i++){
      var fx=x+Math.cos(a)*i*gap, fz=z+Math.sin(a)*i*gap, side=(i%2?1:-1)*0.12;
      flat(mDark,0.11,0.26,fx-Math.sin(a)*side,fz+Math.cos(a)*side,-a+Math.PI/2);
    }
  }
  var list=TRACE_STATIC.concat($imports.RT.traces||[]), i, j, t;
  for(i=0;i<list.length;i++){
    t=list[i];
    if((t.room||null)!==room) continue;
    var p=(t.c!==undefined)?C(t.c,t.r):(t.x!==undefined?W(t.x,t.y):null);
    if(t.k==='puddle'){ for(j=0;j<6;j++){ var pp=new $imports.THREE.Mesh(new $imports.THREE.CircleGeometry(0.5+(0,$imports.hash2)(j,i)*0.9,10),mWet); pp.rotation.x=-Math.PI/2; pp.position.set(p.x+((0,$imports.hash2)(i,j)-0.5)*7,0.018,p.z+((0,$imports.hash2)(j+3,i)-0.5)*7); g.add(pp); } }
    else if(t.k==='stain'){ for(j=0;j<t.pts.length;j++){ var sp=W(t.pts[j].x,t.pts[j].y); var c1=new $imports.THREE.Mesh(new $imports.THREE.CircleGeometry(0.7,10),mWet); c1.rotation.x=-Math.PI/2; c1.position.set(sp.x,0.018,sp.z); g.add(c1); (0,$imports.anfxBox)(g,(0,$imports.anfxMat)(0x2a2420,0.6),0.9,0.01,0.7,sp.x,2.985,sp.z); } }
    else if(t.k==='chalkring'){ for(j=0;j<30;j++){ if((0,$imports.hash2)(i,j)<0.3) continue; var ra=j/30*6.283; var sg=flat(mChalk,0.28,0.05,p.x+Math.cos(ra)*2.1,p.z+Math.sin(ra)*2.1,-ra+Math.PI/2); } for(j=0;j<4;j++){ var ca=j/4*6.283+0.6; (0,$imports.anfxBox)(g,mPale,0.12,0.03,0.12,p.x+Math.cos(ca)*1.6,0.03,p.z+Math.sin(ca)*1.6); } }
    else if(t.k==='moths'){ for(j=0;j<40;j++) flat(mDark,0.05,0.03,p.x+((0,$imports.hash2)(i,j)-0.5)*5,p.z+((0,$imports.hash2)(j,i+7)-0.5)*5,(0,$imports.hash2)(j,3)*6); }
    else if(t.k==='rows'){ for(j=0;j<6;j++) footprints(p.x-5+j*2.0,p.z-2,Math.PI/2,7,0.62); }
    else if(t.k==='feet'){ footprints(p.x,p.z,t.a||0,9,0.6); }
    else if(t.k==='paper'){ for(j=0;j<7;j++) flat(mPale,0.18,0.12,p.x+((0,$imports.hash2)(i,j)-0.5)*1.6,p.z+((0,$imports.hash2)(j,i)-0.5)*1.6,(0,$imports.hash2)(j,i+1)*6); flat(mRed,0.16,0.012,p.x,p.z,0.4,0.02); }
    else if(t.k==='handprint'){ for(j=0;j<3;j++) flat(mWet,0.14,0.18,p.x+j*0.35,p.z+(j%2)*0.2,0.3*j); }
    else if(t.k==='fence'){ for(j=0;j<6;j++) (0,$imports.anfxBox)(g,mDark,0.02,0.18,0.14,p.x+0.02,0.6+(0,$imports.hash2)(i,j)*0.7,p.z-1.5+j*0.6); }
    else if(t.k==='cup'){                               /* 摔瘪的保温杯躺在地上，地砖砸出一个白印 */
      var cgy=(0,$imports.cupGroundY)(p.x,p.z), cm=(0,$imports.cupModel)(false); cm.scale.set(2.2,2.2,1.7); cm.rotation.set(0,(0,$imports.hash2)(i,7)*6.28,Math.PI/2); cm.position.set(p.x,cgy+0.07,p.z); g.add(cm);
      var la=(0,$imports.hash2)(i,11)*6.28, ld=(0,$imports.cupLidMesh)(); ld.scale.setScalar(2.2); ld.rotation.set(0,la,Math.PI/2);                /* 淡紫色的盖子滚在一边 */
      ld.position.set(p.x+Math.cos(la+1.2)*0.9,cgy+$imports.CUP_DIM.lidR*2.2,p.z+Math.sin(la+1.2)*0.9); g.add(ld);
      flat((0,$imports.anfxMat)(0xd8d4cc,0.5),0.22,0.18,p.x+0.05,p.z-0.02,(0,$imports.hash2)(i,3)*3,cgy+0.014);
    }
    else if(t.k==='bowl'){ (0,$imports.anfxBox)(g,(0,$imports.anfxMat)(0xe8e2d4,1.0),0.16,0.08,0.16,p.x+0.6,0.04,p.z); (0,$imports.anfxBox)(g,(0,$imports.anfxMat)(0x3a2a1a,1.0),0.012,0.2,0.012,p.x+0.6,0.14,p.z); }
    else if(t.k==='dust'){ for(j=0;j<14;j++) flat(mChalk,0.08,0.08,p.x+((0,$imports.hash2)(i,j)-0.5)*1.4,p.z+((0,$imports.hash2)(j,i)-0.5)*1.4,0); }
    else if(t.k==='scratch'){ for(j=0;j<5;j++) (0,$imports.anfxBox)(g,(0,$imports.anfxMat)(0x3a302c,0.85),0.012,0.9-j*0.08,0.02,p.x,1.1+j*0.03,p.z+j*0.07); }
    else if(t.k==='drag'){ for(j=0;j<26;j++){ flat(mDark,0.12,0.42,p.x+j*0.55,p.z-0.2,Math.PI/2); flat(mDark,0.12,0.42,p.x+j*0.55,p.z+0.2,Math.PI/2); } }
    else if(t.k==='wetfeet'){ footprints(p.x,p.z,Math.PI,10,0.58); }
    else if(t.k==='outline'){
      var seg=[[0,0.95,0.5,0],[0,0.1,0.06,0.5],[-0.22,-0.4,0.06,0.9],[0.22,-0.4,0.06,0.9],[-0.42,0.45,0.06,0.7],[0.42,0.45,0.06,0.7]];
      for(j=0;j<seg.length;j++) flat(mChalk,seg[j][2]||0.06,seg[j][3]||0.06,p.x+seg[j][0],p.z+seg[j][1],0);
      var hd=new $imports.THREE.Mesh(new $imports.THREE.RingGeometry(0.16,0.2,14),mChalk); hd.rotation.x=-Math.PI/2; hd.position.set(p.x,0.017,p.z+1.25); g.add(hd);
    }
    else if(t.k==='shoe'){ (0,$imports.anfxBox)(g,(0,$imports.anfxMat)(0xe8e8e2,1.0),0.11,0.09,0.27,p.x,0.045,p.z).rotation.y=0.7; (0,$imports.anfxBox)(g,(0,$imports.anfxMat)(0x6a1a14,1.0),0.11,0.01,0.27,p.x,0.093,p.z).rotation.y=0.7; }
    else if(t.k==='hands'){ for(j=0;j<4;j++) (0,$imports.anfxBox)(g,(0,$imports.anfxMat)(0x8a9aa0,0.5),0.14,0.18,0.01,p.x-0.6+j*0.38,1.2+(j%2)*0.3,p.z); }
  }
  $imports.GLR.scene.add(g);
}
/* 低 SAN 的幻觉：视野边上站着一个人，你一转过去看，他就不在了 */
var HALLU={g:null,t:0,next:12,life:0};
function hallucTick(dt){
  var on=($imports.S.screen==='play'&&!$imports.S.dead&&!$imports.PAUSE.on&&$imports.S.san<32&&!$imports.AN.active&&!$imports.UI.anyOpen());
  if(!HALLU.g){
    HALLU.g=new $imports.THREE.Group();
    (0,$imports.anfxFigure)(HALLU.g,new $imports.THREE.MeshBasicMaterial({color:0x040506,fog:true}),0,0,1.05,false);
    HALLU.g.visible=false; $imports.GLR.scene.add(HALLU.g);
  }
  if(HALLU.g.parent!==$imports.GLR.scene) $imports.GLR.scene.add(HALLU.g);
  if(!on){ HALLU.g.visible=false; return; }
  if(HALLU.g.visible){
    HALLU.life-=dt;
    var hp=HALLU.g.position, cp=$imports.GLR.cam.position;
    var aTo=Math.atan2(hp.z-cp.z,hp.x-cp.x);
    if((0,$imports.angDiff)(aTo,$imports.S.ang)<0.22||HALLU.life<=0){ HALLU.g.visible=false; HALLU.next=$imports.PresentationRandom.range(10,26)*(0.5+$imports.S.san/64); }
    return;
  }
  HALLU.next-=dt;
  if(HALLU.next>0) return;
  /* 放在视野边缘 50°～65°、8–14 米外，站得住的地方 */
  var side=$imports.PresentationRandom.next()<0.5?-1:1, k;
  for(k=0;k<6;k++){
    var a=$imports.S.ang+side*$imports.PresentationRandom.range(0.85,1.15), dist=$imports.PresentationRandom.range(70,125);
    var wx=$imports.S.x+Math.cos(a)*dist, wy=$imports.S.y+Math.sin(a)*dist;
    if((0,$imports.solidAt)(wx,wy)) continue;
    var p=(0,$imports.anfxW2S)(wx,wy);
    HALLU.g.position.set(p.x,0,p.z);
    HALLU.g.rotation.y=Math.atan2($imports.GLR.cam.position.x-p.x,$imports.GLR.cam.position.z-p.z);
    HALLU.g.visible=true; HALLU.life=$imports.PresentationRandom.range(2.5,5);
    break;
  }
  HALLU.next=4;
}
/* 远处的人影（不看 SAN 也会有）：隔一两分钟，正前方走廊 / 路的尽头站着一个黑影，一动不动地朝着你。
   走近到 6 米多、手电照到它、或者盯着它看超过一秒多，它就不在了；再过一会儿自己也会不见。
   只是吓人，不扣 SAN、不算异象；有异象、被巡察者盯着、打开界面时不出现。 */
var APPAR={g:null,next:40,life:0,stare:0};
function apparTick(dt){
  var on=($imports.S.screen==='play'&&!$imports.S.dead&&!$imports.PAUSE.on&&!$imports.AN.active&&!$imports.UI.anyOpen()&&!$imports.PatrolWorld.localChase()&&!$imports.HIDE.on&&!(typeof $imports.PHONE!=='undefined'&&$imports.PHONE.on));
  if(!APPAR.g){
    APPAR.g=new $imports.THREE.Group();
    (0,$imports.anfxFigure)(APPAR.g,new $imports.THREE.MeshBasicMaterial({color:0x030405,fog:true}),0,0,1.0,false,'person');
    APPAR.g.visible=false; $imports.GLR.scene.add(APPAR.g);
  }
  if(APPAR.g.parent!==$imports.GLR.scene){ $imports.GLR.scene.add(APPAR.g); APPAR.g.visible=false; }   /* 换了场景：不跟过去 */
  if(!on){ APPAR.g.visible=false; return; }
  var dark=($imports.S.mode==='in')||(typeof $imports.dayLight==='function'&&(0,$imports.dayLight)()<0.4);   /* 白天的室外不出现 */
  if(APPAR.g.visible){
    APPAR.life-=dt;
    var hp=APPAR.g.position, cp=$imports.GLR.cam.position, dx=hp.x-cp.x, dz=hp.z-cp.z, dist=Math.hypot(dx,dz);
    var look=(0,$imports.angDiff)(Math.atan2(dz,dx),$imports.S.ang);
    if(look<0.10) APPAR.stare+=dt; else APPAR.stare=Math.max(0,APPAR.stare-dt*0.5);
    var lit=(typeof $imports.USE!=='undefined'&&$imports.USE.torch&&look<0.16);
    if(dist<6.5||lit||APPAR.stare>1.3||APPAR.life<=0){
      APPAR.g.visible=false;
      APPAR.next=$imports.PresentationRandom.range(50,120)*(0.6+0.4*(0,$imports.clamp)($imports.S.san,0,100)/100);
      if(look<0.5){ try{ $imports.SFX.vanish(); }catch(e){} }
    }
    return;
  }
  APPAR.next-=dt;
  if(APPAR.next>0) return;
  APPAR.next=6;                                      /* 这次没找到地方：过一会儿再试 */
  if(!dark) return;
  /* 10–16 米外、视线里没有遮挡、站得住的点里，挑离顶灯 / 路灯最近的：站在一小片光里，黑影才看得出来 */
  var k, best=null, bestS=1e9, LT=($imports.S.mode==='in')?($imports.GLR.roomLights||[]).map(function(L){ return L.position; }):(typeof $imports.OUT_LAMPS!=='undefined'?$imports.OUT_LAMPS:[]);
  for(k=0;k<10;k++){
    var a=$imports.S.ang+($imports.PresentationRandom.next()-0.5)*0.5, d, ok, s2;
    for(d=145;d>=90;d-=11){
      ok=true;
      for(s2=12;s2<=d;s2+=6){ if((0,$imports.solidAt)($imports.S.x+Math.cos(a)*s2,$imports.S.y+Math.sin(a)*s2)){ ok=false; break; } }
      if(!ok) continue;
      var wx=$imports.S.x+Math.cos(a)*d, wy=$imports.S.y+Math.sin(a)*d;
      if((0,$imports.solidAt)(wx+4,wy)||(0,$imports.solidAt)(wx-4,wy)||(0,$imports.solidAt)(wx,wy+4)||(0,$imports.solidAt)(wx,wy-4)) continue;
      var q=(0,$imports.anfxW2S)(wx,wy), sc=6, li;
      for(li=0;li<LT.length;li++) sc=Math.min(sc,Math.hypot(LT[li].x-q.x,LT[li].z-q.z));
      sc+=$imports.PresentationRandom.next()*0.8;
      if(sc<bestS){ bestS=sc; best=[wx,wy]; }
    }
  }
  if(!best) return;
  var p=(0,$imports.anfxW2S)(best[0],best[1]);
  APPAR.g.position.set(p.x,0,p.z);
  APPAR.g.rotation.y=Math.atan2($imports.GLR.cam.position.x-p.x,$imports.GLR.cam.position.z-p.z);
  APPAR.g.visible=true; APPAR.life=$imports.PresentationRandom.range(3,6); APPAR.stare=0;
}

GameModules.on('tracesChanged',function(){tracesBuild(true);},{owner:'fx'});

/* @module-exports */
GameModules.publish("game3d/js/fx/traces.js",{
"TR":{get:function(){return TR;},set:function($value){TR=$value;}},
"TRACE_STATIC":{get:function(){return TRACE_STATIC;},set:function($value){TRACE_STATIC=$value;}},
"tracesBuild":{get:function(){return tracesBuild;},set:function($value){tracesBuild=$value;}},
"HALLU":{get:function(){return HALLU;},set:function($value){HALLU=$value;}},
"hallucTick":{get:function(){return hallucTick;},set:function($value){hallucTick=$value;}},
"APPAR":{get:function(){return APPAR;},set:function($value){APPAR=$value;}},
"apparTick":{get:function(){return apparTick;},set:function($value){apparTick=$value;}}
});
})(GameModules.imports("game3d/js/fx/traces.js"));
