/* 里世界 3D · 第一人称的手和手里的东西
   打开手电、撑开雨伞、玩手机时，画面下方能看见自己的手和手里的东西：
     雨伞 —— 左手（伞面在头顶上）
     手电 —— 右手
     手机 —— 哪只手空着就拿在哪只（都占着就揣回兜里，屏幕光照旧）
   手按真实比例搭：手腕、手掌（大鱼际、小鱼际、掌指关节的骨节）、四指各三节、指甲、两节的拇指，
   外面是校服袖子和衬衫袖口。每种拿法一个姿势，几何体只生成一次。
   模型挂在相机上，走路时跟着轻轻晃。 */
'use strict';

var HANDS={built:false,L:null,R:null,items:{},meshes:{L:null,R:null}};
var HAND_GEO={};

/* ---- 向量小工具 ---- */
function hAdd(a,b){ return [a[0]+b[0],a[1]+b[1],a[2]+b[2]]; }
function hSub(a,b){ return [a[0]-b[0],a[1]-b[1],a[2]-b[2]]; }
function hMul(a,s){ return [a[0]*s,a[1]*s,a[2]*s]; }
function hDot(a,b){ return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
function hCross(a,b){ return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]; }
function hNorm(a){ var l=Math.sqrt(hDot(a,a))||1; return [a[0]/l,a[1]/l,a[2]/l]; }
function hMix(a,b,t){ return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t]; }
/* 顶点色要线性值（材质 color 会做颜色管理，顶点色不会） */
function hCol(hex){ var c=new THREE.Color(hex); return [c.r,c.g,c.b]; }
/* 交给 Kit 的颜色：Kit 把整数当线性值，先换好 */
function linHex(h){ var c=hCol(h); return (Math.round(c[0]*255)<<16)|(Math.round(c[1]*255)<<8)|Math.round(c[2]*255); }

/* ---- 带顶点色的网格：先把点换到 grip 坐标（tf），三角形按法线自动定朝向 ---- */
function HMesh(tf){ this.P=[]; this.N=[]; this.C=[]; this.I=[]; this.tf=tf||null; }
HMesh.prototype.v=function(p,n,c){
  if(this.tf){ p=this.tf.p(p); n=this.tf.n(n); }
  this.P.push(p[0],p[1],p[2]); this.N.push(n[0],n[1],n[2]); this.C.push(c[0],c[1],c[2]);
  return this.P.length/3-1;
};
HMesh.prototype.tri=function(a,b,c){
  var P=this.P, N=this.N;
  var e1=[P[b*3]-P[a*3],P[b*3+1]-P[a*3+1],P[b*3+2]-P[a*3+2]], e2=[P[c*3]-P[a*3],P[c*3+1]-P[a*3+1],P[c*3+2]-P[a*3+2]];
  var fn=hCross(e1,e2), vn=[N[a*3]+N[b*3]+N[c*3],N[a*3+1]+N[b*3+1]+N[c*3+1],N[a*3+2]+N[b*3+2]+N[c*3+2]];
  if(hDot(fn,vn)<0) this.I.push(a,c,b); else this.I.push(a,b,c);
};
HMesh.prototype.quad=function(a,b,c,d){ this.tri(a,b,c); this.tri(a,c,d); };
/* 一圈椭圆截面：中心 p、切向 T、上向 U、半径 a（侧向）b（上向） */
HMesh.prototype.ring=function(p,T,U,a,b,seg,col){
  var Sd=hCross(T,U), out=[], k;
  for(k=0;k<seg;k++){
    var th=k/seg*TAU, c=Math.cos(th), s=Math.sin(th);
    var pos=hAdd(p,hAdd(hMul(Sd,a*c),hMul(U,b*s)));
    var nrm=hNorm(hAdd(hMul(Sd,c/a),hMul(U,s/b)));
    out.push(this.v(pos,nrm,col));
  }
  return out;
};
HMesh.prototype.join=function(r0,r1){
  for(var k=0,n=r0.length;k<n;k++){ var k1=(k+1)%n; this.quad(r0[k],r0[k1],r1[k1],r1[k]); }
};
/* 圆头：从截面往外收成半个椭球 */
HMesh.prototype.cap=function(r,p,T,U,a,b,len,seg,col){
  var prev=r, i;
  for(i=1;i<=3;i++){
    var ph=i/4*PI/2, cs=Math.cos(ph);
    var rr=this.ring(hAdd(p,hMul(T,len*Math.sin(ph))),T,U,a*cs,b*cs,seg,col);
    for(var k=0;k<rr.length;k++){            /* 法线往外偏，圆头才不发平 */
      var j=rr[k]*3, n=hNorm([this.N[j]*cs+T[0]*Math.sin(ph),this.N[j+1]*cs+T[1]*Math.sin(ph),this.N[j+2]*cs+T[2]*Math.sin(ph)]);
      this.N[j]=n[0]; this.N[j+1]=n[1]; this.N[j+2]=n[2];
    }
    this.join(prev,rr); prev=rr;
  }
  var tip=this.v(hAdd(p,hMul(T,len)),T,col);
  for(var k2=0,n2=prev.length;k2<n2;k2++) this.tri(prev[k2],prev[(k2+1)%n2],tip);
};
/* 沿一串点扫出管子。pts: [{p, a, b, up, c}]；cap0 / cap1：两头是否收圆头（数值是圆头长度占半径的比例） */
HMesh.prototype.sweep=function(pts,seg,cap0,cap1){
  var n=pts.length, rings=[], Ts=[], Us=[], i;
  for(i=0;i<n;i++){
    var T=hNorm(i===0?hSub(pts[1].p,pts[0].p):i===n-1?hSub(pts[n-1].p,pts[n-2].p):hSub(pts[i+1].p,pts[i-1].p));
    var up=pts[i].up||[0,1,0], U=hNorm(hSub(up,hMul(T,hDot(up,T))));
    Ts.push(T); Us.push(U);
    rings.push(this.ring(pts[i].p,T,U,pts[i].a,pts[i].b,seg,pts[i].c));
    if(i>0) this.join(rings[i-1],rings[i]);
  }
  var q;
  if(cap0){ q=pts[0]; this.cap(rings[0],q.p,hMul(Ts[0],-1),Us[0],q.a,q.b,cap0*(q.a+q.b)/2,seg,q.c); }
  if(cap1){ q=pts[n-1]; this.cap(rings[n-1],q.p,Ts[n-1],Us[n-1],q.a,q.b,cap1*(q.a+q.b)/2,seg,q.c); }
};
/* 斜着放的椭球：三根半轴向量 */
HMesh.prototype.ellipsoid=function(c,ax,ay,az,col,seg){
  seg=seg||10; var rows=Math.max(4,Math.round(seg*0.6)), grid=[], i, j;
  var la=hDot(ax,ax), lb=hDot(ay,ay), lc=hDot(az,az);
  for(j=0;j<=rows;j++){
    var ph=j/rows*PI, row=[];
    for(i=0;i<seg;i++){
      var th=i/seg*TAU, ex=Math.sin(ph)*Math.cos(th), ey=Math.cos(ph), ez=Math.sin(ph)*Math.sin(th);
      var p=hAdd(c,hAdd(hMul(ax,ex),hAdd(hMul(ay,ey),hMul(az,ez))));
      var n=hNorm(hAdd(hMul(ax,ex/la),hAdd(hMul(ay,ey/lb),hMul(az,ez/lc))));
      row.push(this.v(p,n,col));
    }
    grid.push(row);
  }
  for(j=0;j<rows;j++) for(i=0;i<seg;i++){
    var i1=(i+1)%seg;
    if(j===0) this.tri(grid[0][i],grid[1][i1],grid[1][i]);
    else if(j===rows-1) this.tri(grid[j][i],grid[j][i1],grid[j+1][i]);
    else this.quad(grid[j][i],grid[j][i1],grid[j+1][i1],grid[j+1][i]);
  }
};
HMesh.prototype.geometry=function(mirror){
  var P=new Float32Array(this.P), N=new Float32Array(this.N), I=this.I.slice(), k;
  if(mirror){
    for(k=0;k<P.length;k+=3){ P[k]=-P[k]; N[k]=-N[k]; }
    for(k=0;k<I.length;k+=3){ var t=I[k+1]; I[k+1]=I[k+2]; I[k+2]=t; }
  }
  var g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(P,3));
  g.setAttribute('normal',new THREE.BufferAttribute(N,3));
  g.setAttribute('color',new THREE.BufferAttribute(new Float32Array(this.C),3));
  g.setIndex(I);
  g.computeBoundingSphere();
  return g;
};

/* ---- 手的骨架 ----
   手的坐标（右手）：l 从手腕指向指根，n 手背朝外，w 指向拇指一侧；原点在手腕中心，单位米。
   换成右手系的坐标是 [l, n, -w]。 */
function handAt(l,n,w){ return [l,n,-w]; }
var HAND_FINGERS=[            /* 指根位置 (l, w)、三节长度、粗细 */
  {l:0.084,w: 0.026,len:[0.041,0.024,0.019],r:0.0089},     /* 食指 */
  {l:0.088,w: 0.008,len:[0.045,0.027,0.020],r:0.0092},     /* 中指 */
  {l:0.085,w:-0.010,len:[0.042,0.026,0.019],r:0.0087},     /* 无名指 */
  {l:0.077,w:-0.027,len:[0.033,0.020,0.017],r:0.0075}      /* 小指 */
];
var HAND_SKIN={skin:0xc9997c,dark:0xb8876c,palm:0xd2a58c,nail:0xdcb7aa,knuckle:0xbf8d73,cuff:0xd8dde0,sleeve:0x1c2a3a,sleeve2:0x16212e};
/* 一根手指：points 是关节点（指根→指尖），dors 是每个点的指背方向 */
function handFinger(M,pts,dors,r,C){
  var seq=[], i;
  for(i=0;i<pts.length;i++){
    var k=i/(pts.length-1), rr=r*(1-0.2*k), col=(i===1||i===2)?C.dark:C.skin;
    seq.push({p:pts[i],a:rr*1.08,b:rr*0.92,up:dors[i],c:col});
    if(i<pts.length-1){                                  /* 每节中间收细一点：指节才鼓得出来 */
      var mid=hMix(pts[i],pts[i+1],0.5), rm=r*(1-0.2*(i+0.5)/(pts.length-1))*0.93;
      seq.push({p:mid,a:rm*1.08,b:rm*0.9,up:hNorm(hAdd(dors[i],dors[i+1])),c:C.skin});
    }
  }
  M.sweep(seq,10,0,0.9);
  var n=pts.length, d=hNorm(hSub(pts[n-1],pts[n-2])), up=dors[n-1];            /* 指甲：贴在末节背面 */
  var side=hNorm(hCross(d,up)), rt=r*0.8;
  M.ellipsoid(hAdd(hMix(pts[n-2],pts[n-1],0.62),hMul(up,rt*0.86)),hMul(d,rt*1.0),hMul(up,rt*0.22),hMul(side,rt*0.8),C.nail,8);
}
/* 手掌、腕、指根骨节 */
function handPalm(M,C){
  var U=[0,1,0];
  M.sweep([
    {p:handAt(-0.012,0.000,0.000),a:0.026,b:0.018,up:U,c:C.skin},
    {p:handAt( 0.012,0.000,0.002),a:0.034,b:0.0175,up:U,c:C.skin},
    {p:handAt( 0.040,0.000,0.000),a:0.040,b:0.0160,up:U,c:C.skin},
    {p:handAt( 0.066,0.000,-0.001),a:0.042,b:0.0145,up:U,c:C.skin},
    {p:handAt( 0.080,0.000,-0.001),a:0.040,b:0.0125,up:U,c:C.skin}
  ],14,0,0.7);
  M.ellipsoid(handAt(0.026,-0.009,0.022),handAt(0.026,0,0.006),handAt(0,0.012,0),handAt(-0.004,0,0.016),C.palm,10);     /* 大鱼际 */
  M.ellipsoid(handAt(0.036,-0.007,-0.027),handAt(0.030,0,0),handAt(0,0.011,0),handAt(0,0,0.012),C.palm,10);             /* 小鱼际 */
  for(var i=0;i<HAND_FINGERS.length;i++){                                                                /* 手背上的指根骨节 */
    var f=HAND_FINGERS[i];
    M.ellipsoid(handAt(f.l-0.005,0.0030,f.w),handAt(0.010,0,0),handAt(0,0.0075,0),handAt(0,0,f.r*1.05),C.knuckle,8);
  }
  M.ellipsoid(handAt(-0.006,0.004,-0.022),handAt(0.008,0,0),handAt(0,0.007,0),handAt(0,0,0.007),C.skin,6);            /* 腕骨的小鼓包 */
}
/* 拇指：腕掌关节 → 掌指关节 → 指间关节 → 指尖 */
function handThumb(M,pts,dors,C){
  var seq=[{p:pts[0],a:0.016,b:0.013,up:dors[0],c:C.palm}];
  seq.push({p:hMix(pts[0],pts[1],0.5),a:0.0135,b:0.0115,up:hNorm(hAdd(dors[0],dors[1])),c:C.skin});
  seq.push({p:pts[1],a:0.0115,b:0.0105,up:dors[1],c:C.dark});
  seq.push({p:hMix(pts[1],pts[2],0.5),a:0.0105,b:0.0095,up:hNorm(hAdd(dors[1],dors[2])),c:C.skin});
  seq.push({p:pts[2],a:0.0105,b:0.0092,up:dors[2],c:C.dark});
  seq.push({p:pts[3],a:0.0092,b:0.0078,up:dors[3],c:C.skin});
  M.sweep(seq,10,0,0.9);
  var d=hNorm(hSub(pts[3],pts[2])), up=dors[3], side=hNorm(hCross(d,up));
  M.ellipsoid(hAdd(hMix(pts[2],pts[3],0.6),hMul(up,0.0072)),hMul(d,0.0085),hMul(up,0.0018),hMul(side,0.0072),C.nail,8);
}
/* 小臂和袖子：从手腕往回 back（单位向量）方向伸出去 */
function handSleeve(M,back,C){
  var up=hNorm(hSub([0,1,0],hMul(back,back[1])));
  function at(d){ return hMul(back,d); }
  M.sweep([
    {p:at(-0.004),a:0.026,b:0.0185,up:up,c:C.skin},
    {p:at(0.030),a:0.028,b:0.021,up:up,c:C.skin},
    {p:at(0.062),a:0.031,b:0.024,up:up,c:C.skin}
  ],12,0,0);
  /* 衬衫袖口（白）露出一圈，外面是外套袖子：袖口里面压一圈暗色，看着有厚度 */
  M.sweep([
    {p:at(0.048),a:0.0335,b:0.027,up:up,c:C.cuff},
    {p:at(0.062),a:0.0345,b:0.028,up:up,c:C.cuff},
    {p:at(0.078),a:0.035,b:0.029,up:up,c:C.cuff}
  ],14,0,0);
  var seq=[], i;
  for(i=0;i<=9;i++){                                                       /* 外套袖子：一路往回变粗，中间几道褶 */
    var d=0.068+i*0.04, wob=(i>0&&i<9)?((i%2)?0.004:-0.002):0;
    seq.push({p:hAdd(at(d),hMul(up,(i%3===1)?0.002:0)),a:0.046+i*0.0035+wob,b:0.040+i*0.0032+wob*0.6,up:up,c:(i%2)?C.sleeve2:C.sleeve});
  }
  M.sweep(seq,16,0,0);
  M.sweep([{p:at(0.0685),a:0.046,b:0.040,up:up,c:C.sleeve2},{p:at(0.0665),a:0.036,b:0.0295,up:up,c:C.sleeve2}],16,0,0);   /* 袖口的边 */
}

/* 一根手指绕着圆柱握住：C 是指根所在平面里圆柱的中心（l, n），R 是指心到圆柱轴的距离 */
function wrapFinger(f,Cl,Cn,R){
  var m=[f.l,0], pts=[handAt(f.l-0.012,0,f.w),handAt(f.l,0,f.w)], dors=[[0,1,0],[0,1,0]];
  var dx=Cl-m[0], dy=Cn-m[1], d=Math.sqrt(dx*dx+dy*dy), L1=f.len[0];
  /* 第一节：从指根出发，落到圆上（两圆求交，取靠前的那个交点） */
  var a=(L1*L1-R*R+d*d)/(2*d), h=Math.sqrt(Math.max(0,L1*L1-a*a));
  var bx=m[0]+a*dx/d, by=m[1]+a*dy/d;
  var p1=[bx+h*dy/d,by-h*dx/d], p1b=[bx-h*dy/d,by+h*dx/d];
  if(p1b[0]>p1[0]) p1=p1b;
  var ang=Math.atan2(p1[1]-Cn,p1[0]-Cl), cur=p1, i;
  var list=[p1];
  for(i=1;i<3;i++){ ang-=2*Math.asin(Math.min(1,f.len[i]/(2*R))); cur=[Cl+R*Math.cos(ang),Cn+R*Math.sin(ang)]; list.push(cur); }
  for(i=0;i<list.length;i++){
    pts.push(handAt(list[i][0],list[i][1],f.w));
    var r=hNorm([list[i][0]-Cl,list[i][1]-Cn]); dors.push([r[0],r[1],0]);
  }
  dors[1]=hNorm(hAdd(dors[1],dors[2]));
  return {pts:pts,dors:dors};
}
/* 按指节弯曲角度摆一根手指（在 l-n 平面里往掌心弯），spread 是往两边张开的角度 */
function bendFinger(f,ang,spread){
  var p=[f.l,0,f.w], th=0, pts=[handAt(f.l-0.012,0,f.w),handAt(p[0],p[1],p[2])], dors=[[0,1,0],[0,1,0]], i, sp=spread||0;
  for(i=0;i<3;i++){
    th+=ang[i];
    var dl=Math.cos(th)*Math.cos(sp), dn=-Math.sin(th), dw=Math.cos(th)*Math.sin(sp);
    p=[p[0]+dl*f.len[i],p[1]+dn*f.len[i],p[2]+dw*f.len[i]];
    pts.push(handAt(p[0],p[1],p[2])); dors.push([Math.sin(th),Math.cos(th),0]);
  }
  dors[1]=hNorm(hAdd(dors[1],dors[2]));
  return {pts:pts,dors:dors};
}
/* 小臂往回的方向：dev 是手往小指一侧偏（尺偏）的角度，ext 是手背往后翘（背伸）的角度 */
function handForearm(dev,ext){
  return hMul(hNorm(handAt(Math.cos(dev)*Math.cos(ext),-Math.sin(ext),Math.sin(dev))),-1);
}
/* 拿法：grip 圆柱的中心、轴向（手的坐标）、半径；手指、拇指的摆法 */
var HAND_POSES={
  /* 握手电：剑柄式，拇指压在筒身上面，筒身斜穿过掌心（食指那头在前） */
  torch:{rc:0.0235,tilt:0.8,dev:0.5,ext:0},
  /* 握伞柄：一样是拳，柄细一点 */
  brolly:{rc:0.017,tilt:0.5,dev:0.3,ext:0.2},
  /* 托手机：手机斜躺在掌心，四指从背后绕过来扣住一条长边，拇指搭在屏幕边上 */
  phone:{phone:true,dev:0.5,ext:-0.2}
};
function handGripFrame(pose){
  /* 圆柱轴：从小指根部那头斜着穿到食指根部，跟指根连线成 tilt 角 */
  var t=pose.tilt, g=hNorm(handAt(Math.sin(t),0,Math.cos(t))), c=handAt(0.058,-(0.0145+pose.rc+0.0015),0);
  return {g:g,c:c};
}
function handBuild(poseName){
  var C={}, k, pose=HAND_POSES[poseName];
  for(k in HAND_SKIN) C[k]=hCol(HAND_SKIN[k]);
  var tf=null, frame=null;
  if(!pose.phone){
    frame=handGripFrame(pose);
    /* grip 坐标：圆柱轴朝 -z，拇指那一面（筒身的"上面"）朝 +y，手背朝 +x */
    var Z=hMul(frame.g,-1), Y=hNorm(hCross(Z,[0,1,0])); Y=hMul(Y,-1);
    if(hDot(Y,handAt(-1,0,1))<0) Y=hMul(Y,-1);
    var X=hCross(Y,Z), c0=frame.c;
    tf={p:function(p){ var d=hSub(p,c0); return [hDot(d,X),hDot(d,Y),hDot(d,Z)]; },
        n:function(n){ return [hDot(n,X),hDot(n,Y),hDot(n,Z)]; },
        inv:function(v){ return hAdd(hAdd(hMul(X,v[0]),hMul(Y,v[1])),hMul(Z,v[2])); }};
  }else{
    /* 手机：手的坐标直接当 grip 坐标，原点在手机中心 */
    var pc=handAt(0.058,-0.026,0.034);
    tf={p:function(p){ return hSub(p,pc); },n:function(n){ return n; },inv:function(v){ return v; }};
  }
  var M=new HMesh(tf), i;
  handPalm(M,C);
  if(!pose.phone){
    var R0=pose.rc, g=frame.g, c=frame.c;
    for(i=0;i<HAND_FINGERS.length;i++){
      var f=HAND_FINGERS[i], s=(-f.w-c[2])/g[2];                 /* 圆柱轴走到这根手指所在平面的位置 */
      var fw=wrapFinger(f,c[0]+g[0]*s,c[1],R0+f.r*1.02);
      handFinger(M,fw.pts,fw.dors,f.r,C);
    }
    /* 拇指：贴着筒身的上面，顺着轴往前压 */
    var top=hNorm(hCross(g,[0,1,0])); if(hDot(top,handAt(-1,0,1))<0) top=hMul(top,-1);
    var Rt=R0+0.0095, base=hAdd(c,hMul(top,Rt));
    var tp=[handAt(0.010,-0.010,0.020),hAdd(base,hMul(g,-0.004)),hAdd(base,hMul(g,0.028)),hAdd(hAdd(base,hMul(g,0.052)),hMul(top,-0.002))];
    var td=[handAt(0,1,0.4),top,top,top];
    for(i=0;i<td.length;i++) td[i]=hNorm(td[i]);
    handThumb(M,tp,td,C);
    handSleeve(M,handForearm(pose.dev,pose.ext),C);
  }else{
    for(i=0;i<HAND_FINGERS.length;i++){                         /* 四指从手机背后绕过远处那条长边，指肚搭在屏幕边上 */
      var f2=HAND_FINGERS[i], bf=bendFinger(f2,[1.40-i*0.04,1.62,0.12+i*0.05],(i-1.5)*-0.05);
      handFinger(M,bf.pts,bf.dors,f2.r,C);
    }
    handThumb(M,[handAt(0.010,-0.010,0.020),handAt(0.022,-0.030,0.045),handAt(0.031,-0.040,0.071),handAt(0.038,-0.041,0.094)],
              [hNorm(handAt(0,1,0.4)),hNorm(handAt(0,-1,0.6)),hNorm(handAt(0,-1,0.1)),hNorm(handAt(0,-1,0))],C);
    handSleeve(M,handForearm(HAND_POSES.phone.dev,HAND_POSES.phone.ext),C);
  }
  return M;
}
function handGeo(side,pose){
  var key=pose+'|'+side;
  if(!HAND_GEO[key]) HAND_GEO[key]=handBuild(pose).geometry(side<0);
  return HAND_GEO[key];
}

/* ---- 手里的东西：都以握持中心为原点 ---- */
function handMat(col,basic){ return basic?new THREE.MeshBasicMaterial({color:col,fog:false}):new THREE.MeshLambertMaterial({color:col}); }
function vcMat(side){ return new THREE.MeshLambertMaterial({vertexColors:true,side:side||THREE.FrontSide}); }
/* 手电：尾盖、带防滑纹的握把、往前张开的灯头、反光杯和灯珠；沿 -z 朝前，握把中段在原点 */
function buildTorch(){
  var torch=new THREE.Group();
  var TK=new Kit(), tp=[[0.0,0],[0.017,0],[0.021,0.004],[0.0225,0.012],[0.0225,0.03]], q;
  for(q=0;q<7;q++) tp.push([0.0238,0.036+q*0.019],[0.0222,0.045+q*0.019]);            /* 握把上一圈圈防滑纹 */
  tp.push([0.0225,0.172],[0.0225,0.182],[0.026,0.196],[0.034,0.222],[0.036,0.236],[0.036,0.248],[0.031,0.250]);
  TK.lathe('metal',0,0,0,tp,20,linHex(0x2a2e33),1.0);
  TK.cyl('metal',0,0.236,0,0.0365,0.0365,0.006,20,linHex(0x4a4f55),1.0,false);              /* 灯头前面一圈亮边 */
  TK.box('metal',0.0232,0.118,0,0.006,0.016,0.011,linHex(0x7a2a22),1.1);                     /* 开关按钮 */
  TK.box('metal',-0.0236,0.06,0,0.003,0.05,0.006,linHex(0x15181b),1.0);                     /* 挂绳扣 */
  var tb=new THREE.Mesh(TK.mergedGeometry(),new THREE.MeshLambertMaterial({vertexColors:true}));
  tb.rotation.x=-PI/2; tb.position.z=0.105; torch.add(tb);
  var refl=new THREE.Mesh(new THREE.CylinderGeometry(0.029,0.012,0.022,18,1,true),new THREE.MeshLambertMaterial({color:0x8a8e92,side:THREE.BackSide}));
  refl.rotation.x=-PI/2; refl.position.z=0.105-0.236; torch.add(refl);                       /* 反光杯 */
  var tl=new THREE.Mesh(new THREE.CircleGeometry(0.030,18),handMat(0xfff2c8,true)); tl.position.z=0.105-0.247; tl.rotation.y=PI; torch.add(tl);
  var led=new THREE.Mesh(new THREE.CircleGeometry(0.007,10),handMat(0xffffff,true)); led.position.z=0.105-0.2465; led.rotation.y=PI; torch.add(led);
  torch.userData.lens=tl; torch.userData.led=led;
  return torch;
}
/* 手机：圆角机身、屏幕和黑边、背面摄像头、侧键；屏幕朝 +n 的反方向（对着自己） */
function buildPhone(){
  var phone=new THREE.Group(), K=new Kit();
  K.bevel('plastic',0,0,0,0.068,0.008,0.136,linHex(0x15171a),1,0.006);                      /* 机身：x 宽，z 长，y 厚（屏幕朝 -y） */
  K.bevel('plastic',0,-0.0042,0,0.064,0.001,0.132,linHex(0x050607),1,0.004);                 /* 屏幕玻璃的黑边 */
  K.bevel('metal',-0.018,0.0045,-0.050,0.022,0.002,0.024,linHex(0x22252a),1,0.004);          /* 背面摄像头模组 */
  K.cyl('metal',-0.023,0.0055,-0.055,0.0045,0.0045,0.0015,10,linHex(0x08090a),1);
  K.cyl('metal',-0.013,0.0055,-0.045,0.0045,0.0045,0.0015,10,linHex(0x08090a),1);
  K.box('metal',0.0345,0,-0.02,0.002,0.003,0.016,linHex(0x2a2d31),1);                       /* 侧键 */
  K.box('metal',0.0345,0,0.01,0.002,0.003,0.010,linHex(0x2a2d31),1);
  var body=new THREE.Mesh(K.mergedGeometry(),new THREE.MeshLambertMaterial({vertexColors:true}));
  phone.add(body);
  var ps=new THREE.Mesh(new THREE.PlaneGeometry(0.059,0.124),handMat(0x9fd0e8,true));
  ps.rotation.x=PI/2; ps.position.y=-0.0049; phone.add(ps);
  phone.userData.screen=ps;
  /* 长边（z）顺着拇指方向，宽（x）横在掌心，屏幕朝 -y：正好是手机姿势的坐标 */
  return phone;
}
/* 雨伞：伞柄是握持点，伞杆沿 -z（整组转成朝上）；八片伞面在伞骨之间往下塌一点，下面看得见伞骨和撑杆 */
function buildBrolly(){
  var brolly=new THREE.Group(), K=new Kit(), i;
  var shaftLen=0.98, top=-shaftLen, ribN=8, R=0.62, drop=0.22;
  K.rod('metal',0,0,0.05,0,0,top-0.04,0.0075,0.0065,8,linHex(0x3a3d40),1);                 /* 伞杆 */
  K.rod('plastic',0,0,0.055,0,0,-0.07,0.016,0.016,12,linHex(0x22180f),1);                  /* 泡棉握把 */
  for(i=0;i<=8;i++){                                                                        /* J 形弯钩 */
    var a0=i/8*PI, a1=(i+1)/8*PI, rr=0.036;
    if(i===8) break;
    K.rod('plastic',rr-rr*Math.cos(a0),0,0.055+rr*Math.sin(a0),rr-rr*Math.cos(a1),0,0.055+rr*Math.sin(a1),0.012,0.012,8,linHex(0x22180f),1);
  }
  K.cyl('metal',0,0,0,0.011,0.011,0.03,8,linHex(0x55595e),1);                              /* 下巢 */
  var runZ=top+0.28;
  for(i=0;i<ribN;i++){                                                                      /* 伞骨、撑杆 */
    var a=i/ribN*TAU+PI/ribN, cx=Math.cos(a), cy=Math.sin(a);
    K.rod('metal',0,0,top+0.01,cx*R*0.98,cy*R*0.98,top+drop,0.003,0.0025,4,linHex(0x2b2d30),1);
    K.rod('metal',0,0,runZ,cx*R*0.5,cy*R*0.5,top+drop*0.5+0.012,0.0025,0.0022,4,linHex(0x2b2d30),1);
    K.blob('plastic',cx*R,cy*R,top+drop+0.004,0.007,0.007,0.009,linHex(0x0e0f10),1,5);    /* 伞骨尖的小帽 */
  }
  K.cyl('metal',0,0,runZ-0.02,0.013,0.013,0.04,8,linHex(0x3a3d40),1);
  var frame=new THREE.Mesh(K.mergedGeometry(),new THREE.MeshLambertMaterial({vertexColors:true}));
  brolly.add(frame);
  /* 伞面：每片在两根伞骨之间，中间往下塌 */
  var M=new HMesh(null), seg=6, rows=7, cDark=hCol(0x14202e), cEdge=hCol(0x101a26), grid, r2, s2;
  for(i=0;i<ribN;i++){
    var aa=i/ribN*TAU+PI/ribN, ab=(i+1)/ribN*TAU+PI/ribN;
    grid=[];
    for(r2=0;r2<=rows;r2++){
      var row=[], u=r2/rows;
      for(s2=0;s2<=seg;s2++){
        var v=s2/seg, an=aa+(ab-aa)*v, sag=Math.sin(v*PI)*0.035*u;
        var rad=R*u*(1-0.06*Math.sin(v*PI)*u), z=top+drop*Math.pow(u,1.35)+sag;
        var p=[Math.cos(an)*rad,Math.sin(an)*rad,z], n=hNorm([Math.cos(an)*0.45*u,Math.sin(an)*0.45*u,-1]);
        row.push(M.v(p,n,u>0.95?cEdge:cDark));
      }
      grid.push(row);
    }
    for(r2=0;r2<rows;r2++) for(s2=0;s2<seg;s2++) M.quad(grid[r2][s2],grid[r2][s2+1],grid[r2+1][s2+1],grid[r2+1][s2]);
  }
  var canopy=new THREE.Mesh(M.geometry(false),vcMat(THREE.DoubleSide));
  brolly.add(canopy);
  K=new Kit(); K.cyl('plastic',0,0,0,0.012,0.006,0.05,8,linHex(0x0e0f10),1);              /* 伞顶 */
  var tip=new THREE.Mesh(K.mergedGeometry(),new THREE.MeshLambertMaterial({vertexColors:true}));
  tip.rotation.x=-PI/2; tip.position.z=top+0.01; brolly.add(tip);
  return brolly;
}
/* 每只手每种拿法的摆放（相机坐标，x 右 y 上 -z 前）：位置、旋转 */
var HAND_PLACE={
  torch:{p:[0.17,-0.24,-0.40],r:[0.40,-0.05,0.35]},
  brolly:{p:[0.21,-0.27,-0.40],r:[1.22,-0.05,0.1]},
  phone:{p:[0.09,-0.16,-0.32],r:[1.2,0.0,2.8]}
};
function handArm(side){
  var g=new THREE.Group();
  var mesh=new THREE.Mesh(handGeo(side,'torch'),new THREE.MeshLambertMaterial({vertexColors:true}));
  g.add(mesh);
  HANDS.meshes[side<0?'L':'R']=mesh;
  g.userData.side=side;
  return g;
}
function buildHands(){
  if(HANDS.built||!GLR.cam) return;
  HANDS.built=true;
  HANDS.L=handArm(-1); HANDS.R=handArm(1);
  HANDS.items={torch:buildTorch(),phone:buildPhone(),brolly:buildBrolly()};
  /* 手单独放一个场景，渲染层独立绘制再合成（engine/scene.js）：贴着墙也不会被截断。
     灯光照着主场景的环境光、天光、身边的补光每帧抄一份。 */
  var hs=new THREE.Scene(), root=new THREE.Group();
  root.matrixAutoUpdate=false; root.visible=false; root.userData.overlay=true;
  HANDS.amb=new THREE.AmbientLight(0xffffff,0); HANDS.hemi=new THREE.HemisphereLight(0xffffff,0x000000,0);
  HANDS.near=new THREE.PointLight(0xffffff,0,3,1.5); HANDS.near.position.set(0.1,0.25,0.1);
  hs.add(HANDS.amb); hs.add(HANDS.hemi); root.add(HANDS.near); hs.add(root);
  GLR.handScene=hs; GLR.handRoot=root;
  [HANDS.L,HANDS.R].forEach(function(h){ h.visible=false; root.add(h); });
}
/* 让 hand 拿着 item：换成对应的手势，物品挂到这只手上，摆到这种拿法的位置 */
function handHold(hand,item){
  var it=HANDS.items[item]; if(!it) return;
  var side=hand.userData.side, mesh=HANDS.meshes[side<0?'L':'R'];
  if(hand.userData.pose!==item){
    mesh.geometry=handGeo(side,item);
    hand.userData.pose=item;
    var pl=HAND_PLACE[item];
    hand.userData.base=[side*pl.p[0],pl.p[1],pl.p[2]];
    hand.rotation.set(pl.r[0],side*pl.r[1],side*pl.r[2]);
  }
  if(it.parent!==hand){ if(it.parent) it.parent.remove(it); hand.add(it); }
  it.scale.x=(item==='brolly'||side>0)?1:-1;       /* 物件跟着手镜像（雨伞是对称的，不用） */
  it.visible=true;
}
function handsTick(dt){
  if(!GLR.cam) return;
  buildHands();
  var show=S.screen==='play'&&!S.dead&&!HIDE.on&&!(typeof CUT!=='undefined'&&CUT.on);
  var torchOn=show&&USE.torch&&hasItem('torch'), brollyOn=show&&USE.brollyShield&&hasItem('brolly'), phoneOn=show&&typeof PHONE!=='undefined'&&PHONE.on;       /* 手机只在玩小游戏时拿在手上 */
  var it=HANDS.items, leftUse=null, rightUse=null;
  if(brollyOn) leftUse='brolly';
  if(torchOn) rightUse='torch';
  if(phoneOn){ if(!leftUse) leftUse='phone'; else if(!rightUse) rightUse='phone'; }
  for(var k in it) it[k].visible=false;
  HANDS.L.visible=!!leftUse; HANDS.R.visible=!!rightUse;
  GLR.handRoot.visible=!!(leftUse||rightUse);
  if(GLR.handRoot.visible){
    HANDS.amb.color.copy(GLR.amb.color); HANDS.amb.intensity=GLR.amb.intensity;
    HANDS.hemi.color.copy(GLR.hemi.color); HANDS.hemi.groundColor.copy(GLR.hemi.groundColor); HANDS.hemi.intensity=GLR.hemi.intensity;
    HANDS.near.color.copy(GLR.camLight.color); HANDS.near.intensity=GLR.camLight.intensity*0.35+(USE.torch?0.45:0);
  }
  if(leftUse) handHold(HANDS.L,leftUse);
  if(rightUse) handHold(HANDS.R,rightUse);
  /* 走路时轻轻晃，跑起来晃得大一点 */
  var ph=S.walkPhase||0, amp=S.moving?(S.run?0.018:0.009):0.002;
  [HANDS.L,HANDS.R].forEach(function(h,i){
    var b=h.userData.base; if(!b) return;
    var q=ph+i;
    h.position.set(b[0]+Math.sin(q)*amp,b[1]+Math.abs(Math.cos(q))*amp,b[2]);
  });
  var lit=!!USE.torch;
  it.torch.userData.lens.material.color.setHex(lit?0xfff2c8:0x30343a);
  it.torch.userData.led.material.color.setHex(lit?0xffffff:0x3a3e44);
}
