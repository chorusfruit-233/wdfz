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
function traceAdd(id){
  if(!id) return;
  var d=AN.data||{}, t=null, room=(S.mode==='in')?S.room:null;
  if(id==='rain'||id==='raindots') t={k:'puddle',x:S.x,y:S.y};
  else if(id==='leak'&&d.pts) t={k:'stain',pts:d.pts.slice(0,5)};
  else if(id==='rite'&&d.c) t={k:'chalkring',x:d.c.x,y:d.c.y};
  else if(id==='moth'&&d.src) t={k:'moths',x:d.src.x,y:d.src.y};
  else if(id==='exercise'&&d.src) t={k:'rows',x:d.src.x,y:d.src.y};
  else if(id==='twin'&&d.x!==undefined) t={k:'feet',x:d.x,y:d.y,a:Math.atan2(S.y-d.y,S.x-d.x)};
  else if(id==='roster'&&d.rx!==undefined) t={k:'paper',x:d.rx,y:d.ry};
  else if(id==='hand') t={k:'handprint',x:S.x,y:S.y};
  else if(id==='necker') t={k:'fence',x:BOUND.x1*SC-6,y:S.y};
  else if(id==='feast') t={k:'bowl',x:S.x,y:S.y};
  else if(id==='chalk') t={k:'dust',x:S.x,y:S.y};
  if(!t) return;
  t.room=room;
  RT.traces=RT.traces||[];
  RT.traces.push(t);
  while(RT.traces.length>40) RT.traces.shift();
  tracesBuild(true);
}
function tracesBuild(force){
  var key=(S.mode==='in'?S.room:'out')+'|'+((RT.traces&&RT.traces.length)||0);
  if(!force&&TR.key===key&&TR.g&&TR.g.parent) return;
  if(TR.g){ try{ GLR.scene.remove(TR.g); }catch(e){} }
  TR.key=key;
  var g=new THREE.Group(); TR.g=g;
  var room=(S.mode==='in')?S.room:null, R=room?INTERIORS[room]:null;
  function W(x,y){ return worldToScene(x,y,R); }
  function C(c,r){ return R?W(R.ox+c*R.tw,R.oy+r*R.th):{x:0,z:0}; }
  var mDark=anfxMat(0x101418,0.55), mWet=anfxMat(0x18242a,0.62), mChalk=anfxMat(0xd8d4cc,0.35),
      mPale=anfxMat(0xb8b2a0,0.85), mRed=anfxMat(0x3a1210,0.7);
  function flat(m,w,d,x,z,rot,y){ var o=anfxBox(g,m,w,0.004,d,x,y||0.016,z); if(rot) o.rotation.y=rot; return o; }
  function footprints(x,z,a,n,gap){
    for(var i=0;i<n;i++){
      var fx=x+Math.cos(a)*i*gap, fz=z+Math.sin(a)*i*gap, side=(i%2?1:-1)*0.12;
      flat(mDark,0.11,0.26,fx-Math.sin(a)*side,fz+Math.cos(a)*side,-a+Math.PI/2);
    }
  }
  var list=TRACE_STATIC.concat(RT.traces||[]), i, j, t;
  for(i=0;i<list.length;i++){
    t=list[i];
    if((t.room||null)!==room) continue;
    var p=(t.c!==undefined)?C(t.c,t.r):(t.x!==undefined?W(t.x,t.y):null);
    if(t.k==='puddle'){ for(j=0;j<6;j++){ var pp=new THREE.Mesh(new THREE.CircleGeometry(0.5+hash2(j,i)*0.9,10),mWet); pp.rotation.x=-Math.PI/2; pp.position.set(p.x+(hash2(i,j)-0.5)*7,0.018,p.z+(hash2(j+3,i)-0.5)*7); g.add(pp); } }
    else if(t.k==='stain'){ for(j=0;j<t.pts.length;j++){ var sp=W(t.pts[j].x,t.pts[j].y); var c1=new THREE.Mesh(new THREE.CircleGeometry(0.7,10),mWet); c1.rotation.x=-Math.PI/2; c1.position.set(sp.x,0.018,sp.z); g.add(c1); anfxBox(g,anfxMat(0x2a2420,0.6),0.9,0.01,0.7,sp.x,2.985,sp.z); } }
    else if(t.k==='chalkring'){ for(j=0;j<30;j++){ if(hash2(i,j)<0.3) continue; var ra=j/30*6.283; var sg=flat(mChalk,0.28,0.05,p.x+Math.cos(ra)*2.1,p.z+Math.sin(ra)*2.1,-ra+Math.PI/2); } for(j=0;j<4;j++){ var ca=j/4*6.283+0.6; anfxBox(g,mPale,0.12,0.03,0.12,p.x+Math.cos(ca)*1.6,0.03,p.z+Math.sin(ca)*1.6); } }
    else if(t.k==='moths'){ for(j=0;j<40;j++) flat(mDark,0.05,0.03,p.x+(hash2(i,j)-0.5)*5,p.z+(hash2(j,i+7)-0.5)*5,hash2(j,3)*6); }
    else if(t.k==='rows'){ for(j=0;j<6;j++) footprints(p.x-5+j*2.0,p.z-2,Math.PI/2,7,0.62); }
    else if(t.k==='feet'){ footprints(p.x,p.z,t.a||0,9,0.6); }
    else if(t.k==='paper'){ for(j=0;j<7;j++) flat(mPale,0.18,0.12,p.x+(hash2(i,j)-0.5)*1.6,p.z+(hash2(j,i)-0.5)*1.6,hash2(j,i+1)*6); flat(mRed,0.16,0.012,p.x,p.z,0.4,0.02); }
    else if(t.k==='handprint'){ for(j=0;j<3;j++) flat(mWet,0.14,0.18,p.x+j*0.35,p.z+(j%2)*0.2,0.3*j); }
    else if(t.k==='fence'){ for(j=0;j<6;j++) anfxBox(g,mDark,0.02,0.18,0.14,p.x+0.02,0.6+hash2(i,j)*0.7,p.z-1.5+j*0.6); }
    else if(t.k==='bowl'){ anfxBox(g,anfxMat(0xe8e2d4,1.0),0.16,0.08,0.16,p.x+0.6,0.04,p.z); anfxBox(g,anfxMat(0x3a2a1a,1.0),0.012,0.2,0.012,p.x+0.6,0.14,p.z); }
    else if(t.k==='dust'){ for(j=0;j<14;j++) flat(mChalk,0.08,0.08,p.x+(hash2(i,j)-0.5)*1.4,p.z+(hash2(j,i)-0.5)*1.4,0); }
    else if(t.k==='scratch'){ for(j=0;j<5;j++) anfxBox(g,anfxMat(0x3a302c,0.85),0.012,0.9-j*0.08,0.02,p.x,1.1+j*0.03,p.z+j*0.07); }
    else if(t.k==='drag'){ for(j=0;j<26;j++){ flat(mDark,0.12,0.42,p.x+j*0.55,p.z-0.2,Math.PI/2); flat(mDark,0.12,0.42,p.x+j*0.55,p.z+0.2,Math.PI/2); } }
    else if(t.k==='wetfeet'){ footprints(p.x,p.z,Math.PI,10,0.58); }
    else if(t.k==='outline'){
      var seg=[[0,0.95,0.5,0],[0,0.1,0.06,0.5],[-0.22,-0.4,0.06,0.9],[0.22,-0.4,0.06,0.9],[-0.42,0.45,0.06,0.7],[0.42,0.45,0.06,0.7]];
      for(j=0;j<seg.length;j++) flat(mChalk,seg[j][2]||0.06,seg[j][3]||0.06,p.x+seg[j][0],p.z+seg[j][1],0);
      var hd=new THREE.Mesh(new THREE.RingGeometry(0.16,0.2,14),mChalk); hd.rotation.x=-Math.PI/2; hd.position.set(p.x,0.017,p.z+1.25); g.add(hd);
    }
    else if(t.k==='shoe'){ anfxBox(g,anfxMat(0xe8e8e2,1.0),0.11,0.09,0.27,p.x,0.045,p.z).rotation.y=0.7; anfxBox(g,anfxMat(0x6a1a14,1.0),0.11,0.01,0.27,p.x,0.093,p.z).rotation.y=0.7; }
    else if(t.k==='hands'){ for(j=0;j<4;j++) anfxBox(g,anfxMat(0x8a9aa0,0.5),0.14,0.18,0.01,p.x-0.6+j*0.38,1.2+(j%2)*0.3,p.z); }
  }
  GLR.scene.add(g);
}
/* 低 SAN 的幻觉：视野边上站着一个人，你一转过去看，他就不在了 */
var HALLU={g:null,t:0,next:12,life:0};
function hallucTick(dt){
  var on=(S.screen==='play'&&!S.dead&&!PAUSE.on&&S.san<32&&!AN.active&&!UI.anyOpen());
  if(!HALLU.g){
    HALLU.g=new THREE.Group();
    anfxFigure(HALLU.g,new THREE.MeshBasicMaterial({color:0x040506,fog:true}),0,0,1.05,false);
    HALLU.g.visible=false; GLR.scene.add(HALLU.g);
  }
  if(HALLU.g.parent!==GLR.scene) GLR.scene.add(HALLU.g);
  if(!on){ HALLU.g.visible=false; return; }
  if(HALLU.g.visible){
    HALLU.life-=dt;
    var hp=HALLU.g.position, cp=GLR.cam.position;
    var aTo=Math.atan2(hp.z-cp.z,hp.x-cp.x);
    if(angDiff(aTo,S.ang)<0.22||HALLU.life<=0){ HALLU.g.visible=false; HALLU.next=rnd(10,26)*(0.5+S.san/64); }
    return;
  }
  HALLU.next-=dt;
  if(HALLU.next>0) return;
  /* 放在视野边缘 50°～65°、8–14 米外，站得住的地方 */
  var side=Math.random()<0.5?-1:1, k;
  for(k=0;k<6;k++){
    var a=S.ang+side*rnd(0.85,1.15), dist=rnd(70,125);
    var wx=S.x+Math.cos(a)*dist, wy=S.y+Math.sin(a)*dist;
    if(solidAt(wx,wy)) continue;
    var p=anfxW2S(wx,wy);
    HALLU.g.position.set(p.x,0,p.z);
    HALLU.g.rotation.y=Math.atan2(GLR.cam.position.x-p.x,GLR.cam.position.z-p.z);
    HALLU.g.visible=true; HALLU.life=rnd(2.5,5);
    break;
  }
  HALLU.next=4;
}
