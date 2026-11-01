/* 里世界 3D · 异象「清华水杯」的画面
   贴着教学楼 / 行政楼 / 实验楼的外墙走的时候，头顶四楼的窗台上有一只白色的杯子（淡紫色的盖子）：
     晃 —— 先在窗台上晃几下（叮叮当当），给你一点时间反应；
     掉 —— 按真实重力往下掉（约 1.5 秒），地上一圈影子越来越深，标出它要砸的地方；
     落 —— 砸在地上弹一下、摔瘪，杯盖滚开，几块碎漆溅出去。
   状态都在 AN.data 里（phase / tf / lx,ly / wall），判定在 anomaly.js。 */
'use strict';

var CUP_H=10.6;          /* 四楼窗台离地（米）：教学楼每层 3.2 米 */
var CUP_R=0.95;          /* 砸中半径（米），地上的影子就画这么大 */
function cupFallTime(){ return Math.sqrt(2*CUP_H/9.8); }

/* ---------- 杯子本身（照着实物做） ----------
   白色哑光的锥形随行杯，下大半圈是一幅油画：紫蓝的天、白云、松树和二校门（门楣上「清華園」）；
   画的上沿是一圈云朵形的金边，背面两丛松树之间空出一个 V 形的白，金色竖写「清華」两个字。
   杯口和内胆是不锈钢，最底下一圈银灰色的底圈；淡紫色的扣盖，带喝水口和滑盖。
   模型包不带这种专用贴图，所以杯子在这里车削建模，画是现画的一张画布贴图（开局十几秒后顺手画好，同一局只画一次）。
   尺寸按真杯子（米）：高 17 厘米，杯口直径约 9 厘米，杯底约 7 厘米。 */
var CUP_DIM={h:0.170,band:0.010,rb:0.0345,rt:0.0448,rim:0.0425,inBot:0.016,lidY:0.166,lidR:0.0462,lidH:0.022};
var CUP_GEO={}, CUP_MAT={}, CUP_TEX={};
function cupSeg(){ return Math.max(16,Math.round(28*Quality.get().segments)); }
/* 贴图宽度：游戏里杯子在屏幕上最多两百来像素高，512 就够；超精细、真实档用 1024 */
function cupTexW(){ return (Quality.get().texture||512)>=1024?1024:512; }

/* 画：u 绕杯身一圈（0→1，从 +z 那一面往 +x 转），v 从底圈上沿（0）到杯口（1）。V 形空白在 u=0.5，二校门在 u=0.82 */
function cupPaintCanvas(W){
  var H=Math.round(W*0.625), cv=document.createElement('canvas'); cv.width=W; cv.height=H;
  var g=cv.getContext('2d'), sc=W/1024, seed=1101, i, j;
  function rnd(){ seed=(seed*1664525+1013904223)>>>0; return seed/4294967296; }
  function X(u){ return u*W; }
  function Y(v){ return (1-v)*H; }
  function pick(a){ return a[Math.floor(rnd()*a.length)]; }
  function stroke(x,y,len,ang,wid,col,al){
    g.globalAlpha=al; g.strokeStyle=col; g.lineWidth=wid; g.lineCap='round';
    g.beginPath(); g.moveTo(x,y); g.lineTo(x+Math.cos(ang)*len,y+Math.sin(ang)*len); g.stroke();
  }
  /* 白色哑光的底，带一点点颗粒 */
  g.fillStyle='#efeeea'; g.fillRect(0,0,W,H);
  for(i=0;i<1800;i++){ g.globalAlpha=0.05; g.fillStyle=rnd()<0.5?'#d8d6d0':'#ffffff'; g.fillRect(rnd()*W,rnd()*H,1.6*sc,1.6*sc); }
  g.globalAlpha=1;

  /* 画的上沿：一圈云朵；背面（u=0.5）两丛松树之间往下凹成 V */
  var bumps=[], u0=0;
  while(u0<1.02){ var w=0.022+rnd()*0.03; bumps.push({c:u0+w*0.6,w:w,h:0.035+rnd()*0.06}); u0+=w*(1.0+rnd()*0.5); }
  function cloud(u){
    var best=0.6, k;
    for(k=0;k<bumps.length;k++){ var b=bumps[k], d=Math.min(Math.abs(u-b.c),Math.abs(u+1-b.c),Math.abs(u-1-b.c))/b.w; if(d<1) best=Math.max(best,0.6+b.h*Math.sqrt(1-d*d)); }
    return best;
  }
  function jag(u){ var t=(u*95)%1; return 0.028*(t<0.5?t*2:2-t*2); }          /* 松枝的锯齿 */
  function topV(u){ var vEdge=0.30+3.7*Math.abs(u-0.5)+jag(u); return Math.min(cloud(u),vEdge); }
  var edge=[];
  for(i=0;i<=W;i+=2*sc) edge.push([i,Y(topV(i/W))]);
  edge.push([W,Y(topV(1))]);
  g.save();
  g.beginPath(); g.moveTo(0,H); edge.forEach(function(p){ g.lineTo(p[0],p[1]); }); g.lineTo(W,H); g.closePath(); g.clip();

  /* 天：上面深一点的紫蓝，往下发白；斜着的短笔触 */
  var sky=g.createLinearGradient(0,Y(0.95),0,Y(0.2));
  sky.addColorStop(0,'#8389d6'); sky.addColorStop(0.55,'#a19fe0'); sky.addColorStop(1,'#c4bde9');
  g.fillStyle=sky; g.fillRect(0,0,W,H);
  var skyCols=['#7c84d0','#9599dd','#aaa6e4','#c3bdee','#8b87cf','#a4b1e6','#b8b2ea'];
  for(i=0;i<2600;i++){ var sx=rnd()*W, sy=Y(0.2+rnd()*0.8); stroke(sx,sy,(6+rnd()*14)*sc,-0.55+rnd()*0.3,(2+rnd()*2.5)*sc,pick(skyCols),0.35+rnd()*0.3); }
  /* 云：一团团白里带紫的笔触 */
  function cloudPuff(cu,cv2,ru,rv,n){
    for(var k=0;k<n;k++){
      var a=rnd()*6.283, d=Math.sqrt(rnd());
      var x=X(cu)+Math.cos(a)*d*ru*W, y=Y(cv2)+Math.sin(a)*d*rv*H*0.7;
      g.globalAlpha=0.55+rnd()*0.35; g.fillStyle=pick(['#f6f4fc','#ece9f8','#ddd8f3','#ffffff']);
      g.beginPath(); g.ellipse(x,y,(6+rnd()*12)*sc,(4+rnd()*7)*sc,-0.3+rnd()*0.6,0,6.283); g.fill();
    }
    for(var k2=0;k2<n/3;k2++){ var x2=X(cu)+(rnd()-0.5)*ru*W*1.6, y2=Y(cv2)+rv*H*0.35*rnd(); stroke(x2,y2,(8+rnd()*10)*sc,-0.2+rnd()*0.4,(2+rnd()*2)*sc,'#b5afe0',0.45); }
  }
  [[0.74,0.58,0.05,0.05],[0.86,0.62,0.06,0.06],[0.95,0.55,0.04,0.05],[0.06,0.6,0.05,0.06],[0.16,0.52,0.06,0.05],[0.27,0.62,0.05,0.05],[0.79,0.48,0.04,0.04]].forEach(function(c){ cloudPuff(c[0],c[1],c[2],c[3],90); });

  /* 远处的一溜树丛 */
  for(i=0;i<420;i++){ var tu=rnd(), tv=0.14+rnd()*0.14; g.globalAlpha=0.7; g.fillStyle=pick(['#3d5a58','#47665c','#53705e','#36504f']);
    g.beginPath(); g.ellipse(X(tu),Y(tv),(5+rnd()*8)*sc,(4+rnd()*7)*sc,0,0,6.283); g.fill(); }

  /* 松树：一笔笔往下垂的枝叶，暗绿里夹着蓝绿和向光一侧的黄绿；树梢细长，枝头偶尔一点金 */
  var PD=['#1d3a33','#234238','#2b4a40','#30503f','#264536','#203f3c'], PM=['#3f6450','#4b6f57','#557a5c','#3c5f5a'],
      PL=['#6f9470','#86a678','#9db683','#b5c48f'], PS=['#2f4b5a','#3d5468','#58608e','#4a5f80'];
  function pine(cu,base,top,hw){
    var x=X(cu), yb=Y(base), yt=Y(top), h=yb-yt, tiers=22, k, q;
    stroke(x,yb,h*0.96,-Math.PI/2,2.4*sc,'#3b2b22',0.8);
    for(k=0;k<tiers;k++){
      var f=k/(tiers-1), y=yb-h*(0.08+0.9*f), wd=hw*W*Math.pow(1-f,0.85)*(0.7+rnd()*0.6)+1.5*sc;
      for(q=0;q<12;q++){
        var side=q%2?1:-1, len=wd*(0.45+rnd()*0.65), dr=0.18+rnd()*0.45;
        stroke(x+side*rnd()*wd*0.15,y+(rnd()-0.5)*h*0.025,len,side>0?dr:Math.PI-dr,(2+rnd()*2.6)*sc,pick(PD),0.88);
      }
      for(q=0;q<5;q++){ var mx=x+(rnd()-0.3)*wd*0.9; stroke(mx,y+(rnd()-0.5)*h*0.02,wd*(0.25+rnd()*0.4),0.2+rnd()*0.4,(1.6+rnd()*1.8)*sc,pick(PM),0.8); }
      for(q=0;q<4;q++){ var lx=x+rnd()*wd*0.85; stroke(lx,y+(rnd()-0.6)*h*0.02,wd*(0.15+rnd()*0.3),0.15+rnd()*0.35,(1.3+rnd()*1.4)*sc,pick(PL),0.75); }
      for(q=0;q<3;q++){ var sx2=x-rnd()*wd*0.85; stroke(sx2,y+(rnd()-0.5)*h*0.02,wd*(0.15+rnd()*0.3),Math.PI-0.2-rnd()*0.4,(1.3+rnd()*1.4)*sc,pick(PS),0.6); }
      if(rnd()<0.3){ g.globalAlpha=0.95; g.fillStyle=pick(['#e0b64e','#f0d27c']); g.beginPath(); g.arc(x+(rnd()-0.5)*wd*1.6,y,(1.1+rnd()*1.3)*sc,0,6.283); g.fill(); }
    }
    stroke(x,yt+h*0.06,h*0.08,-Math.PI/2,1.6*sc,pick(PD),0.9);                                 /* 树梢 */
  }
  [[0.44,0.06,0.66,0.045],[0.40,0.06,0.76,0.05],[0.35,0.06,0.70,0.045],[0.30,0.07,0.60,0.035],
   [0.56,0.06,0.64,0.045],[0.60,0.06,0.78,0.05],[0.65,0.06,0.82,0.055],[0.70,0.06,0.72,0.045],
   [0.74,0.08,0.70,0.03],[0.905,0.09,0.62,0.03],[0.945,0.09,0.50,0.024],[0.04,0.09,0.56,0.03],[0.21,0.09,0.50,0.03]
  ].forEach(function(p){ pine(p[0],p[1],p[2],p[3]); });

  /* 二校门：白色的门，正中大拱门，两对柱子，门楣上「清華園」 */
  var gx=X(0.82), gw=0.155*W, gb=Y(0.08), gt=Y(0.53), gh=gb-gt;
  g.globalAlpha=1;
  g.fillStyle='#e9ebf2'; g.fillRect(gx-gw/2,gt+gh*0.18,gw,gh*0.82);                          /* 墙身 */
  g.fillStyle='#e3e6ef'; g.fillRect(gx-gw*0.36,gt+gh*0.06,gw*0.72,gh*0.14);                  /* 上面的一段 */
  g.fillStyle='#eef0f6'; g.beginPath(); g.moveTo(gx-gw*0.2,gt+gh*0.06); g.lineTo(gx,gt-gh*0.02); g.lineTo(gx+gw*0.2,gt+gh*0.06); g.closePath(); g.fill();
  g.fillStyle='#d7dbe8'; g.fillRect(gx-gw/2,gt+gh*0.18,gw,gh*0.035);                          /* 檐口 */
  g.fillStyle='#c4c9dc'; g.fillRect(gx-gw/2,gt+gh*0.30,gw,gh*0.02);
  /* 大拱门：里面是一条林荫道，尽头一点红 */
  var aw=gw*0.26, ab=gb, at=gt+gh*0.42;
  g.fillStyle='#2b4537'; g.beginPath(); g.moveTo(gx-aw/2,ab); g.lineTo(gx-aw/2,at+aw/2); g.arc(gx,at+aw/2,aw/2,Math.PI,0); g.lineTo(gx+aw/2,ab); g.closePath(); g.fill();
  g.fillStyle='#4f7255'; for(i=0;i<40;i++){ g.globalAlpha=0.6; g.fillRect(gx-aw/2+rnd()*aw,at+rnd()*(ab-at)*0.7,2*sc,2*sc); }
  g.globalAlpha=1; g.fillStyle='#c46a72'; g.fillRect(gx-aw*0.18,ab-gh*0.2,aw*0.36,gh*0.1);
  g.fillStyle='#d9cfc6'; g.beginPath(); g.moveTo(gx-aw*0.12,ab); g.lineTo(gx-aw*0.03,ab-gh*0.1); g.lineTo(gx+aw*0.03,ab-gh*0.1); g.lineTo(gx+aw*0.12,ab); g.closePath(); g.fill();
  /* 柱子：两对，阴影一侧带蓝灰 */
  [-0.4,-0.3,0.3,0.4].forEach(function(o){
    var cx=gx+o*gw; g.fillStyle='#f3f4f8'; g.fillRect(cx-gw*0.03,gt+gh*0.22,gw*0.06,gh*0.78);
    g.fillStyle='#8f97ba'; g.fillRect(cx+gw*0.012,gt+gh*0.24,gw*0.016,gh*0.74);
  });
  /* 两边小拱门 */
  [-1,1].forEach(function(sgn){ var sx=gx+sgn*gw*0.35; g.fillStyle='#3a5444'; g.beginPath(); g.moveTo(sx-gw*0.035,gb); g.lineTo(sx-gw*0.035,gb-gh*0.26); g.arc(sx,gb-gh*0.26,gw*0.035,Math.PI,0); g.lineTo(sx+gw*0.035,gb); g.closePath(); g.fill(); });
  /* 门楣上的字：从右往左读「清華園」 */
  g.fillStyle='#f2f2f6'; g.fillRect(gx-gw*0.19,gt+gh*0.235,gw*0.38,gh*0.06);
  g.fillStyle='#2c2d3a'; g.font='bold '+Math.round(gh*0.05)+'px "Noto Serif CJK SC","Noto Serif SC","Songti SC","SimSun",serif';
  g.textAlign='center'; g.textBaseline='middle';
  g.fillText('園 華 清',gx,gt+gh*0.266);
  for(i=0;i<260;i++){ stroke(gx+(rnd()-0.5)*gw,gt+gh*(0.2+rnd()*0.8),(3+rnd()*6)*sc,Math.PI/2+(rnd()-0.5)*0.3,(1.2+rnd()*1.2)*sc,pick(['#c9cee0','#b3bbd6','#ffffff','#a9b2d4']),0.4); }
  for(i=0;i<60;i++){ stroke(gx-gw/2+rnd()*gw*0.18,gt+gh*(0.25+rnd()*0.7),(3+rnd()*5)*sc,Math.PI/2,(1.4+rnd())*sc,pick(['#9aa3c8','#8b93bb']),0.45); }   /* 背光一侧 */
  g.globalAlpha=1; g.fillStyle='#d6d8e2'; g.fillRect(gx-gw*0.52,gb-gh*0.03,gw*1.04,gh*0.03);                                      /* 台阶 */

  /* 地：粉紫和浅绿的草地，零星小花 */
  var gr=g.createLinearGradient(0,Y(0.13),0,H);
  gr.addColorStop(0,'#cdbfd8'); gr.addColorStop(1,'#d9b9cf');
  g.globalAlpha=1; g.fillStyle=gr; g.fillRect(0,Y(0.12),W,H-Y(0.12));
  for(i=0;i<900;i++){ var fx=rnd()*W, fy=Y(rnd()*0.12); stroke(fx,fy,(5+rnd()*10)*sc,-0.15+rnd()*0.3,(1.6+rnd()*2)*sc,pick(['#e3c4d8','#b8cfa8','#9fbd96','#d8a9c6','#c6b8e2']),0.55); }
  for(i=0;i<120;i++){ g.globalAlpha=0.85; g.fillStyle=pick(['#f6eef4','#eab3cc','#f3e2a6']); g.beginPath(); g.arc(rnd()*W,Y(rnd()*0.1),(1+rnd()*1.4)*sc,0,6.283); g.fill(); }
  /* 金色的小点：撒在树丛里 */
  for(i=0;i<70;i++){ var du=rnd(); if(du>0.76&&du<0.88) continue; g.globalAlpha=0.95; g.fillStyle=pick(['#d9ae45','#efcf78']); g.beginPath(); g.arc(X(du),Y(0.15+rnd()*0.5),(1+rnd()*1.6)*sc,0,6.283); g.fill(); }
  g.restore();

  /* 金边：沿着画的上沿描一圈（暗金打底、亮金压线、一点高光） */
  [[4.6,'#93722a',1],[2.4,'#e3bd62',1],[0.9,'#fff0bd',0.7]].forEach(function(L){
    g.globalAlpha=L[2]; g.strokeStyle=L[1]; g.lineWidth=L[0]*sc; g.lineJoin='round';
    g.beginPath(); edge.forEach(function(p,k){ if(k) g.lineTo(p[0],p[1]); else g.moveTo(p[0],p[1]); }); g.stroke();
  });
  /* V 形空白里，金色竖写「清華」 */
  var fs=Math.round(H*0.115);
  g.globalAlpha=1; g.textAlign='center'; g.textBaseline='middle';
  g.font='bold '+fs+'px "STXingkai","STKaiti","Kaiti SC","KaiTi","Noto Serif CJK SC","Noto Serif SC","Songti SC",serif';
  [['清',0.71],['華',0.56]].forEach(function(c){
    var cy=Y(c[1]), gg=g.createLinearGradient(0,cy-fs/2,0,cy+fs/2);
    gg.addColorStop(0,'#f6dc8c'); gg.addColorStop(0.5,'#d2a446'); gg.addColorStop(1,'#a77d2c');
    g.lineWidth=1.6*sc; g.strokeStyle='#8a6a26'; g.strokeText(c[0],X(0.5),cy);
    g.fillStyle=gg; g.fillText(c[0],X(0.5),cy);
  });
  g.globalAlpha=1;
  return cv;
}
function cupPaintTex(){
  var W=cupTexW();
  if(CUP_TEX[W]) return CUP_TEX[W];
  var t=new THREE.CanvasTexture(cupPaintCanvas(W));
  t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4;
  CUP_TEX[W]=t; return t;
}
/* 画着油画的杯身：带 u/v 的车削面；顶点色是固定一侧来光的明暗（材质不受场景灯光影响，照样看得出是圆的） */
function cupWallGeo(seg){
  var D=CUP_DIM, n=6, pts=[], i;
  for(i=0;i<=n;i++){ var f=i/n; pts.push(new THREE.Vector2(D.rb+(D.rt-D.rb)*f,D.band+(D.h-0.002-D.band)*f)); }
  var geo=new THREE.LatheGeometry(pts,seg);
  var N=geo.attributes.normal, C=new Float32Array(N.count*3), L=[0.55,0.42,0.72], ll=Math.hypot(L[0],L[1],L[2]);
  for(i=0;i<N.count;i++){
    var d=(N.getX(i)*L[0]+N.getY(i)*L[1]+N.getZ(i)*L[2])/ll, b=0.66+0.26*Math.max(0,d);
    C[i*3]=b; C[i*3+1]=b; C[i*3+2]=b*0.99;
  }
  geo.setAttribute('color',new THREE.BufferAttribute(C,3));
  return geo;
}
/* 车削但两头不封口（建模工具的 lathe 会自动封两端，杯口、内胆就被盖死了）；剖面从下往上法线朝外、从上往下朝里；
   剖面的端点半径为 0 时自然收成一个面 */
function cupLathe(K,prof,seg,col){
  var G=K.g('dark'), rgb=G._rgb(col,1.0), i, k;
  for(i=0;i<prof.length-1;i++){
    var p0=prof[i], p1=prof[i+1], dr=p1[0]-p0[0], dh=p1[1]-p0[1], L=Math.sqrt(dr*dr+dh*dh)||1, n0=dh/L, n1=-dr/L;
    for(k=0;k<seg;k++){
      var a0=k/seg*6.2832, a1=(k+1)/seg*6.2832, am=(a0+a1)/2, c0=Math.cos(a0), s0=Math.sin(a0), c1=Math.cos(a1), s1=Math.sin(a1);
      var pts=[[c0*p0[0],p0[1],s0*p0[0]],[c0*p1[0],p1[1],s0*p1[0]],[c1*p1[0],p1[1],s1*p1[0]],[c1*p0[0],p0[1],s1*p0[0]]];
      var fn=[Math.cos(am)*n0,n1,Math.sin(am)*n0], vn=[[c0*n0,n1,s0*n0],[c0*n0,n1,s0*n0],[c1*n0,n1,s1*n0],[c1*n0,n1,s1*n0]];
      if(p0[0]<1e-4) G.face([pts[0],pts[1],pts[2]],fn,rgb,false,[vn[0],vn[1],vn[2]]);
      else if(p1[0]<1e-4) G.face([pts[0],pts[1],pts[3]],fn,rgb,false,[vn[0],vn[1],vn[3]]);
      else G.face(pts,fn,rgb,false,vn);
    }
  }
}
/* 不画画的部分：银灰的底圈、不锈钢的杯口和内胆（越往下越暗）、内胆底的同心圆 */
function cupPartsGeo(seg){
  var D=CUP_DIM, K=new Kit(), m='dark';
  cupLathe(K,[[0,0],[0.0322,0],[0.0336,0.0014],[0.0339,D.band],[D.rb,D.band+0.0002]],seg,0xc4c7cb);                      /* 杯底和底圈 */
  cupLathe(K,[[D.rt,D.h-0.0024],[D.rt+0.0003,D.h-0.0008],[D.rt-0.0006,D.h+0.0002],[D.rim+0.0006,D.h+0.0002],[D.rim,D.h-0.0012]],seg,0xeef0f2);   /* 杯口 */
  var r=function(y){ return D.rim-(D.rim-0.0322)*(D.h-0.0012-y)/(D.h-0.0012-D.inBot); };
  cupLathe(K,[[D.rim,D.h-0.0012],[r(0.15),0.15]],seg,0xd5d8dc);                                                          /* 内胆：从上往下，法线朝里 */
  cupLathe(K,[[r(0.15),0.15],[r(0.13),0.13]],seg,0xb3b7bc);
  cupLathe(K,[[r(0.13),0.13],[r(0.07),0.07]],seg,0x8a8f95);
  cupLathe(K,[[r(0.07),0.07],[0.0322,D.inBot]],seg,0x60656b);
  cupLathe(K,[[0.0322,D.inBot],[0.0192,D.inBot]],seg,0x6d7278);                                                         /* 内胆底 */
  cupLathe(K,[[0.0192,D.inBot],[0.0186,D.inBot+0.0012],[0,D.inBot+0.0012]],seg,0x989da3);                               /* 中间凸起的一圈 */
  K.cyl(m,0,D.inBot+0.0012,0,0.0052,0.0052,0.0003,Math.max(8,Math.round(seg/2)),0x5d6268,1.0);                         /* 底上压的小标 */
  return K.mergedGeometry();
}
/* 淡紫色的扣盖：盖住杯口的一圈裙边、收圆的顶、略凹的盖面，一侧喝水口和滑盖；盖子里面颜色深一点 */
function cupLidGeo(seg){
  var D=CUP_DIM, K=new Kit(), m='dark', H=D.lidH, R=D.lidR;
  cupLathe(K,[[R-0.0008,0],[R,0.0018],[R+0.0002,H-0.006],[R-0.0008,H-0.0018],[R-0.0028,H],[R-0.0062,H],[R-0.0072,H-0.0012],[0,H-0.0012]],seg,0xcdbcf0);
  cupLathe(K,[[D.rt+0.0004,H-0.0035],[D.rt+0.0004,0.0006],[R-0.0008,0]],seg,0xa595cc);                                  /* 裙边里面 */
  cupLathe(K,[[0,H-0.0035],[D.rt+0.0004,H-0.0035]],seg,0x9a8bc2);                                                       /* 盖子底面（朝下） */
  K.box(m,0,H-0.0009,R-0.0145,0.0175,0.0008,0.0062,0x3a3347,1.0);                                                       /* 喝水口 */
  K.box(m,0,H-0.0004,R-0.0245,0.012,0.0018,0.0095,0xe2d8f6,1.0);                                                        /* 滑盖 */
  K.cyl(m,0,H-0.0012,0,0.0105,0.0105,0.0006,Math.max(10,Math.round(seg/2)),0xbfaee6,1.0);                               /* 盖面中间一圈压纹 */
  return K.mergedGeometry();
}
function cupPartGeo(part){
  var seg=cupSeg(), key=part+'|'+seg;
  if(CUP_GEO[key]) return CUP_GEO[key];
  var g=part==='wall'?cupWallGeo(seg):part==='lid'?cupLidGeo(seg):cupPartsGeo(seg);
  g.userData={shared:true,cupPart:part};
  CUP_GEO[key]=g; return g;
}
/* 开局预热用：和油画材质同一个着色器，但贴图只有一个像素——不用为了编着色器去画那张画 */
var CUP_WARM=null;
function cupWarmMat(){
  if(CUP_WARM) return CUP_WARM;
  var t=new THREE.DataTexture(new Uint8Array([239,238,234,255]),1,1); t.colorSpace=THREE.SRGBColorSpace; t.needsUpdate=true;
  CUP_WARM=new THREE.MeshBasicMaterial({map:t,vertexColors:true,fog:true}); CUP_WARM.userData.shared=true;
  return CUP_WARM;
}
function cupMats(){
  var W=cupTexW();
  if(CUP_MAT[W]) return CUP_MAT[W];
  var paint=new THREE.MeshBasicMaterial({map:cupPaintTex(),vertexColors:true,fog:true});
  var plain=new THREE.MeshBasicMaterial({vertexColors:true,color:0xd8d8d8,fog:true});
  var lid=new THREE.MeshBasicMaterial({vertexColors:true,color:0xf2f2f2,fog:true});                   /* 和 plain 同一个着色器，只是亮一点 */
  paint.userData.shared=true; plain.userData.shared=true; lid.userData.shared=true;
  CUP_MAT[W]={paint:paint,plain:plain,lid:lid}; return CUP_MAT[W];
}
/* 一只完整的杯子：原点在杯底中心，杯口朝 +y；userData.lid 是盖子（落地时藏起来，换一个单独的盖子滚开） */
function cupModel(withLid){
  var M=cupMats(), g=new THREE.Group();
  g.add(new THREE.Mesh(cupPartGeo('wall'),M.paint));
  g.add(new THREE.Mesh(cupPartGeo('parts'),M.plain));
  if(withLid!==false){ var lid=cupLidMesh(); lid.position.y=CUP_DIM.lidY; g.add(lid); g.userData.lid=lid; }
  return g;
}
function cupLidMesh(){ return new THREE.Mesh(cupPartGeo('lid'),cupMats().lid); }
function cupMesh(){ return cupModel(true); }
/* 落点的地面高度：路、球场、楼前铺装都比草地高一点，影子和杯子要放在最上面那层 */
var CUP_RAY=null;
function cupGroundY(x,z){
  var g=GLR.outMesh||GLR.roomMesh; if(!g) return 0;
  if(!CUP_RAY) CUP_RAY=new THREE.Raycaster();
  CUP_RAY.set(new THREE.Vector3(x,1.5,z),new THREE.Vector3(0,-1,0)); CUP_RAY.far=2;
  var h=CUP_RAY.intersectObject(g,true);
  return h.length?h[0].point.y:0;
}

function cupFxSpawn(grp){
  var d=AN.data, w=d.wall; if(!w) return;
  var st={};
  /* 窗台：外墙上离你最近的那一点，往外挑 0.2 米 */
  var p=anfxW2S(w.x*SC,w.y*SC), nx=w.nx, nz=w.ny;
  st.sill={x:p.x+nx*0.2,z:p.z+nz*0.2};
  var cup=cupMesh(); cup.scale.setScalar(2.2);                      /* 夸大一点：十米外抬头也要看得见 */
  cup.position.set(st.sill.x,CUP_H+0.02,st.sill.z); grp.add(cup); st.cup=cup;
  /* 地上的影子：外圈是砸中范围，里圈越来越黑 */
  var sg=new THREE.CircleGeometry(1,24); sg.rotateX(-PI/2);
  st.ring=new THREE.Mesh(sg,new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0,depthWrite:false,fog:true}));
  st.core=new THREE.Mesh(sg,new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0,depthWrite:false,fog:true}));
  st.ring.scale.set(CUP_R,1,CUP_R); st.ring.visible=false; st.core.visible=false;
  st.ring.renderOrder=2; st.core.renderOrder=2;
  grp.add(st.ring); grp.add(st.core);
  /* 杯盖、碎漆：落地时才出现（盖子横着滚，所以套一层只管朝向的组） */
  st.lidWrap=new THREE.Group(); st.lid=cupLidMesh(); st.lid.scale.setScalar(2.2); st.lid.rotation.z=PI/2;
  st.lidWrap.add(st.lid); st.lidWrap.visible=false; grp.add(st.lidWrap);
  st.chips=[];
  var cms=[new THREE.MeshBasicMaterial({color:0xd6d4cf,fog:true}),new THREE.MeshBasicMaterial({color:0x8d90cf,fog:true})], i;   /* 白漆和画上的紫蓝 */
  for(i=0;i<7;i++){
    var c=new THREE.Mesh(new THREE.BoxGeometry(0.03,0.006,0.02),cms[i%2]); c.visible=false; grp.add(c);
    var a=i/7*PI*2+Math.random()*0.6;
    c.userData={vx:Math.cos(a)*(1.2+Math.random()*1.6),vz:Math.sin(a)*(1.2+Math.random()*1.6),vy:1.2+Math.random()*1.6};
    st.chips.push(c);
  }
  ANFX.cup=st;
}
function cupFxUpdate(dt){
  var st=ANFX.cup, d=AN.data; if(!st||!d) return;
  var t=AN.t, cup=st.cup;
  if(d.phase===0){                                                  /* 在窗台上晃 */
    var k=clamp(t/(d.wob||1),0,1);
    cup.rotation.z=Math.sin(t*26)*0.18*k; cup.rotation.x=Math.sin(t*19)*0.1*k;
    cup.position.set(st.sill.x,CUP_H+0.02+Math.abs(Math.sin(t*26))*0.02*k,st.sill.z);
    return;
  }
  var land=anfxW2S(d.lx,d.ly), FALL=cupFallTime();
  if(st.gy===undefined) st.gy=cupGroundY(land.x,land.z);
  var gy=st.gy;
  st.ring.position.set(land.x,gy+0.012,land.z); st.core.position.set(land.x,gy+0.013,land.z);
  if(d.phase===1){                                                  /* 往下掉：横着滑向落点，翻着跟头 */
    var u=clamp((t-d.tf)/FALL,0,1);
    cup.position.set(st.sill.x+(land.x-st.sill.x)*u, gy+(CUP_H-gy)*(1-u*u)+0.02, st.sill.z+(land.z-st.sill.z)*u);
    cup.rotation.x+=dt*9; cup.rotation.z+=dt*5;
    st.ring.visible=true; st.core.visible=true;
    st.ring.material.opacity=0.30+0.30*u;
    var cr=CUP_R*(0.25+0.6*u); st.core.scale.set(cr,1,cr); st.core.material.opacity=0.40+0.50*u*u;
    return;
  }
  /* 落地：弹一下就躺下，摔瘪；淡紫色的杯盖脱出来滚开；碎漆溅出去 */
  var e=t-d.tl;
  if(!st.landed){
    st.landed=true;
    cup.rotation.set(0,Math.random()*PI*2,PI/2); cup.scale.set(2.2,2.2,1.7);
    if(cup.userData.lid) cup.userData.lid.visible=false;
    st.lidA=Math.random()*PI*2;
    st.lidWrap.visible=true; st.lidWrap.rotation.y=Math.atan2(Math.cos(st.lidA),Math.sin(st.lidA));   /* 盖子侧躺，朝滚的方向 */
    st.chips.forEach(function(c){ c.visible=true; c.position.set(land.x,gy+0.05,land.z); });
  }
  var bounce=Math.max(0,Math.sin(Math.min(e,0.35)/0.35*PI))*0.18*(1-Math.min(1,e/0.35));
  cup.position.set(land.x,gy+0.07+bounce,land.z);
  var roll=Math.min(e,1.2);
  st.lidWrap.position.set(land.x+Math.cos(st.lidA)*roll*0.9,gy+CUP_DIM.lidR*2.2,land.z+Math.sin(st.lidA)*roll*0.9);
  st.lid.rotation.x+=dt*(e<1.2?8:0);
  st.chips.forEach(function(c){
    var v=c.userData, fl=gy+0.012; if(c.position.y<=fl&&v.vy<=0) return;
    v.vy-=9.8*dt; c.position.x+=v.vx*dt; c.position.z+=v.vz*dt; c.position.y=Math.max(fl,c.position.y+v.vy*dt);
    if(c.position.y<=fl){ v.vx=0; v.vz=0; v.vy=0; }
  });
  st.ring.material.opacity=Math.max(0,0.4-e*0.5); st.core.material.opacity=Math.max(0,0.75-e*0.8);
}
