/* 里世界 3D · 室外布局与道具 */
'use strict';

/* ================= 室外布局 =================
   以前主路、绿篱、花坛、路灯全沿 x=514 一条线摆，直接穿过篮球场、羽毛球场、行政楼和小跑道。
   现在路走在楼与楼之间；树、灯、花坛、长椅都过一遍 outFree() 避让检查。
   坐标都是"地图单位"（M() 换成米）。 */
var OUTX={treeN:0};
var OUT_SOLID=[];       /* 室外的实心物：{x0,y0,x1,y1}，地图单位 */
var ROADS=[
  [470,97,548,207],    /* 北门广场 */
  [395,188,720,207],   /* 北侧东西向 */
  [690,188,718,1252],  /* 东干道 */
  [398,207,422,505],   /* 操场东侧 */
  [352,505,394,999],   /* 西侧 */
  [204,612,352,636],   /* 西小门 */
  [352,987,718,999],   /* 教学楼前 */
  [375,999,398,1290],  /* 宿舍西侧，通南门 */
  [398,1148,548,1172], /* 两栋宿舍之间，到食堂西门 */
  [398,1234,718,1252], /* 南宿舍门前 */
  [718,1124,792,1142]  /* 到垃圾房 */
];
function M(v){ return v*SC*U2M; }
function inRect(mx,my,r,pad){ pad=pad||0; return mx>r[0]-pad&&mx<r[2]+pad&&my>r[1]-pad&&my<r[3]+pad; }
function onRoad(mx,my,pad){ for(var i=0;i<ROADS.length;i++) if(inRect(mx,my,ROADS[i],pad)) return true; return false; }
function inObj(mx,my,pad,lawnOk){
  for(var i=0;i<OBJ.length;i++){
    var o=OBJ[i];
    if(lawnOk&&o.k==='garden') continue;
    if(mx>o.x-pad&&mx<o.x+o.w+pad&&my>o.y-pad&&my<o.y+o.h+pad) return true;
  }
  return false;
}
function nearGate(mx,my,r){
  return dist2(mx,my,GATE_N.x,GATE_N.y)<r*r||dist2(mx,my,GATE_W.x,GATE_W.y)<r*r||dist2(mx,my,GATE_S.x,GATE_S.y)<r*r;
}
/* 楼前的柱廊 / 门廊在楼的矩形外面，也要让开 */
function apronOf(o){
  var p=(o.open1f?13:8);
  if(o.k!=='roof') return null;
  return [o.x-4,o.y-4,o.x+o.w+4,o.y+o.h+p];
}
function outFree(mx,my,pad,roadPad){
  if(mx<BOUND.x0+6||my<BOUND.y0+6||mx>BOUND.x1-6||my>BOUND.y1-6) return false;
  if(inObj(mx,my,pad)) return false;
  if(onRoad(mx,my,roadPad===undefined?pad:roadPad)) return false;
  if(nearGate(mx,my,24)) return false;
  for(var i=0;i<OBJ.length;i++){ var a=apronOf(OBJ[i]); if(a&&inRect(mx,my,a,pad)) return false; }
  for(i=0;i<OUT_SOLID.length;i++){ var q=OUT_SOLID[i]; if(mx>q.x0-pad&&mx<q.x1+pad&&my>q.y0-pad&&my<q.y1+pad) return false; }
  return true;
}
function addSolidM(cx,cz,hw,hd){          /* 以米为单位登记一个实心矩形 */
  var k=1/(SC*U2M);
  OUT_SOLID.push({x0:(cx-hw)*k,y0:(cz-hd)*k,x1:(cx+hw)*k,y1:(cz+hd)*k});
}
/* ---- 树：分段的树干、几根主枝、几团椭球树冠（以前全是方块） ---- */
function buildTree(K, tx, tz, seed, lod){
  var r=function(k){ return hash2(seed*13+k, k*7+3); };
  var th=2.0+r(17)*1.3;                    /* 分枝高度 2.0–3.3m */
  var lean=(r(23)-0.5)*0.5;
  var lay=[[0x2b3f2e,0x36523a,0x3f5f3f],[0x264a2c,0x2f5733,0x3a6a3c],[0x2f4a32,0x3d5f3e,0x4a7048]][Math.floor(r(11)*3)];
  var i, topX=tx+lean*th*0.30, topZ=tz+lean*th*0.18;
  K.rod('bark',tx,0,tz,topX,th,topZ,0.22,0.15,lod>0?7:5,0x4a3c2e,1.0);              /* 树干 */
  K.cyl('bark',tx,0,tz,0.30,0.22,0.25,7,0x4a3c2e,0.95);                              /* 根部 */
  K.box('concrete',tx,0.04,tz,1.2,0.08,1.2,0x8a847a,1.0);                            /* 树池 */
  K.g('decal').quad(tx-0.5,tz-0.5,tx+0.5,tz-0.5,tx+0.5,tz+0.5,tx-0.5,tz+0.5,0.081,0x3a2e22);
  var nb=lod>0?4:2;
  for(i=0;i<nb;i++){
    var a=i*(6.283/nb)+r(30+i)*1.1;
    var len=1.0+r(40+i)*1.0, up=0.34+r(50+i)*0.36;
    var bx=topX+Math.cos(a)*len, by=th+len*up, bz=topZ+Math.sin(a)*len;
    K.rod('bark',topX,th-0.1,topZ,bx,by,bz,0.10,0.05,5,0x3d3227,0.98);
    if(lod>0){                                             /* 主枝中段再岔出两根细枝 */
      for(var tw=0;tw<2;tw++){
        var f=0.45+tw*0.3, ta=a+(tw?0.7:-0.7)+(r(110+i*3+tw)-0.5)*0.6, tl=0.45+r(120+i*3+tw)*0.5;
        var sx=topX+(bx-topX)*f, sy=th-0.1+(by-th+0.1)*f, sz=topZ+(bz-topZ)*f;
        K.rod('bark',sx,sy,sz,sx+Math.cos(ta)*tl,sy+tl*0.55,sz+Math.sin(ta)*tl,0.04,0.018,4,0x3a2f25,0.96);
      }
    }
  }
  /* 落叶：树池周围一圈，黄绿褐几种 */
  if(lod>0){
    var nl=lod>1?16:9, LD=K.g('decal'), leafCol=[0x6a5a2a,0x7a6630,0x4a5a30,0x5a4426];
    for(i=0;i<nl;i++){
      var la=r(130+i)*6.283, lr=0.7+r(140+i)*1.8, lx=tx+Math.cos(la)*lr, lz=tz+Math.sin(la)*lr, ls=0.05+r(150+i)*0.05, lo=r(160+i)*3.14;
      var c1=Math.cos(lo)*ls, s1=Math.sin(lo)*ls;
      LD.quad(lx-c1,lz-s1*0.5, lx-s1*0.5,lz+c1, lx+c1,lz+s1*0.5, lx+s1*0.5,lz-c1, 0.012+i*0.0002, leafCol[i%4]);
    }
  }
  var cw=3.6+r(41)*2.0, nc=lod>1?11:(lod>0?6:4);
  for(i=0;i<nc;i++){
    var ca=r(60+i)*6.283;
    var cr=(0.10+r(70+i)*0.50)*cw*0.5;
    var cy=th+1.0+r(80+i)*2.0;
    var cs=(0.55+r(90+i)*0.45)*cw*(lod>1?0.34:0.40);
    K.blob('leaf',topX+Math.cos(ca)*cr, cy, topZ+Math.sin(ca)*cr, cs, cs*0.78, cs, lay[i%3], 0.93+r(100+i)*0.16, lod>0?7:5, 0.35, seed*7+i);
  }
  if(lod>1) K.blob('leaf',topX,th+1.6,topZ,cw*0.36,cw*0.26,cw*0.36,lay[0],0.72,7,0.3,seed*7+40);   /* 里层一团暗的，冠子不透光 */
}
function addOutdoorProps(K, x0, y0, x1, y1){
  var i, j, q=QUALITY|0;
  /* ---- 草地：整片打底，按 6 米一格做一点深浅 ---- */
  var gs=6, gx, gz, L=K.g('fgrass');
  for(gx=x0; gx<x1; gx+=gs){
    for(gz=y0; gz<y1; gz+=gs){
      var ex=Math.min(gx+gs,x1), ez=Math.min(gz+gs,y1);
      var hv=hash2((gx*7)|0,(gz*13)|0);
      L.quad(gx,ez, ex,ez, ex,gz, gx,gz, 0.000, shadeHex(hv<0.5?0x45603a:0x4d6a40, 0.86+hv*0.22));
    }
  }
  /* ---- 路和楼前铺装：1.2 米一块的方砖（混凝土纹理），砖缝深一点 ---- */
  function pave(r,col){
    var ax=M(r[0]), az=M(r[1]), bx=M(r[2]), bz=M(r[3]), t=1.2, a, b, P=K.g('paving');
    K.g('fjoint').quad(ax,bz, bx,bz, bx,az, ax,az, 0.004, 0x55534e);
    for(a=ax; a<bx-0.05; a+=t){
      for(b=az; b<bz-0.05; b+=t){
        var qa=a+0.04, qb=Math.min(a+t,bx)-0.04, qc=b+0.04, qd=Math.min(b+t,bz)-0.04;
        if(qb<=qa||qd<=qc) continue;
        var sh=0.92+0.12*hash2((a*5)|0,(b*7)|0);
        P.quad(qa,qd, qb,qd, qb,qc, qa,qc, 0.008, shadeHex(col,sh));
      }
    }
  }
  for(i=0;i<ROADS.length;i++) pave(ROADS[i],0xb0aca4);          /* 混凝土纹理本身会压暗一点，颜色调亮补回来 */
  for(i=0;i<OBJ.length;i++){ var ap=apronOf(OBJ[i]); if(ap&&OBJ[i].id!=='garage') pave(ap,0xbcb7ae); }
  /* ---- 路缘石：只在路边挨着草地的地方立 ---- */
  function paved(mx,my){
    if(onRoad(mx,my,0)) return true;
    for(var k=0;k<OBJ.length;k++){ var a2=apronOf(OBJ[k]); if(a2&&inRect(mx,my,a2,0)) return true; if(OBJ[k].k!=='roof'&&inRect(mx,my,[OBJ[k].x,OBJ[k].y,OBJ[k].x+OBJ[k].w,OBJ[k].y+OBJ[k].h],0)) return true; }
    return false;
  }
  for(i=0;i<ROADS.length;i++){
    var r=ROADS[i], e;
    var edges=[[r[0],r[1],r[2],r[1],0,-1],[r[0],r[3],r[2],r[3],0,1],[r[0],r[1],r[0],r[3],-1,0],[r[2],r[1],r[2],r[3],1,0]];
    for(e=0;e<4;e++){
      var E=edges[e], len=Math.hypot(E[2]-E[0],E[3]-E[1]), st=4, run0=-1, k2;
      var N=Math.max(1,Math.floor(len/st));
      for(k2=0;k2<=N;k2++){
        var tt=k2/N, sx=E[0]+(E[2]-E[0])*tt, sy=E[1]+(E[3]-E[1])*tt;
        var outside=!paved(sx+E[4]*3,sy+E[5]*3)&&sx>BOUND.x0+3&&sx<BOUND.x1-3&&sy>BOUND.y0+3&&sy<BOUND.y1-3;
        if(outside&&run0<0) run0=tt;
        if((!outside||k2===N)&&run0>=0){
          var t1=outside?tt:(k2-1)/N;
          if(t1>run0){
            var ax3=E[0]+(E[2]-E[0])*run0, ay3=E[1]+(E[3]-E[1])*run0, bx3=E[0]+(E[2]-E[0])*t1, by3=E[1]+(E[3]-E[1])*t1;
            var cxm=M((ax3+bx3)/2), czm=M((ay3+by3)/2);
            if(E[4]===0) K.bevel('concrete',cxm,0.07,czm,M(Math.abs(bx3-ax3))+0.15,0.14,0.16,0xb4b0a6,1.0,0.02);
            else K.bevel('concrete',cxm,0.07,czm,0.16,0.14,M(Math.abs(by3-ay3))+0.15,0xb4b0a6,1.0,0.02);
          }
          run0=-1;
        }
      }
    }
  }

  /* ---- 花园：一座不锈钢雕塑（几根斜杆托着一个环）+ 校训牌 ---- */
  (function(){
    var gx=M(535), gz=M(1040);
    K.bevel('stone',gx,0.30,gz,24.0,0.60,3.0,0xb8b2a8,1.0,0.06);
    addSolidM(gx,gz,12.0,1.5);
    var sx3=gx-12.0;
    K.bevel('stone',sx3,0.30,gz,2.8,0.42,2.8,0xa8a298,1.0,0.05);
    K.rod('metal',sx3,0.5,gz,sx3+0.4,3.4,gz+0.2,0.12,0.06,8,0x9aa0a4,1.1);
    K.rod('metal',sx3,0.5,gz,sx3-0.6,2.6,gz-0.3,0.10,0.05,8,0x9aa0a4,1.05);
    var k; for(k=0;k<16;k++){ var a=k/16*6.283, b=(k+1)/16*6.283;
      K.rod('metal',sx3+0.4+Math.cos(a)*0.9,3.4+Math.sin(a)*0.9,gz+0.2,sx3+0.4+Math.cos(b)*0.9,3.4+Math.sin(b)*0.9,gz+0.2,0.07,0.07,6,0xb8c0c4,1.15); }
    addSolidM(sx3,gz,1.4,1.4);
    K.bevel('stone',gx,1.35,gz+1.6,11.0,1.9,0.34,0xcfc9be,1.0,0.04);                 /* 校训牌的底板 */
    K.bevel('stone',gx,0.17,gz+1.6,11.6,0.34,0.9,0xa8a298,1.0,0.04);
    K.box('metal',gx,0.42,gz+1.6,11.4,0.10,0.16,0x9aa0a4,1.0);
    addSolidM(gx,gz+1.6,5.8,0.5);
    K.g('fpave').quad(M(400),M(1036), M(670),M(1036), M(670),M(1030), M(400),M(1030), 0.014, 0x9a948a);
    K.g('fpave').quad(M(532),M(1078), M(538),M(1078), M(538),M(1000), M(532),M(1000), 0.014, 0x9a948a);
  })();

  /* ---- 花坛：砖砌一圈，土，一丛丛花 ---- */
  var beds=[[440,1016],[630,1016],[440,1062],[630,1062],[462,1008],[608,1008],[740,560],[740,760],[330,560],[660,140],[440,145]];
  var flowerCols=[0xb24a4a,0xc8a24a,0xa85a8a,0xd8d4e8,0xc86a3a];
  for(i=0;i<beds.length;i++){
    var fmx=beds[i][0], fmy=beds[i][1];
    if(!inObj(fmx,fmy,0,true)&&!outFree(fmx,fmy,4,3)&&!(inRect(fmx,fmy,[400,1000,670,1078],0))) continue;
    if(onRoad(fmx,fmy,3)) continue;
    var fx0=M(fmx), fz0=M(fmy);
    K.box('brick',fx0,0.20,fz0-0.65,2.8,0.40,0.12,0x8a8478,1.0);
    K.box('brick',fx0,0.20,fz0+0.65,2.8,0.40,0.12,0x8a8478,1.0);
    K.box('brick',fx0-1.34,0.20,fz0,0.12,0.40,1.18,0x8a8478,1.0);
    K.box('brick',fx0+1.34,0.20,fz0,0.12,0.40,1.18,0x8a8478,1.0);
    K.box('concrete',fx0,0.38,fz0,2.56,0.04,1.18,0x3a2b22,1.0);                        /* 土 */
    var fj;
    for(fj=0;fj<(q>0?14:7);fj++){
      var fxx=fx0-1.1+(fj%7)*0.36, fzz=fz0+(fj<7?-0.25:0.25)+(hash2(i,fj)-0.5)*0.12;
      K.rod('leaf',fxx,0.40,fzz,fxx,0.52,fzz,0.03,0.02,4,0x4a6a3a,1.0);
      K.blob('leaf',fxx,0.56,fzz,0.09,0.06,0.09,flowerCols[(i+fj)%5],1.05,5,0.4,i*13+fj);
    }
    addSolidM(fx0,fz0,1.4,0.7);
  }

  /* ---- 旗杆：北门广场东侧 ---- */
  (function(){
    var fx=M(538), fz=M(160);
    K.bevel('stone',fx,0.15,fz,2.2,0.30,2.2,0xb2ada4,1.0,0.04);
    K.bevel('stone',fx,0.38,fz,1.4,0.16,1.4,0xc2bdb4,1.0,0.03);
    K.cyl('metal',fx,0.46,fz,0.09,0.05,10.0,8,0xb8bcbe,1.06);
    K.blob('metal',fx,10.5,fz,0.10,0.10,0.10,0xc8a24a,1.2,6);
    K.box('fabric',fx+0.8,9.6,fz,1.6,1.0,0.02,0xc0362c,1.0);
    K.rod('metal',fx+0.06,0.5,fz,fx+0.06,10.4,fz,0.006,0.006,3,0xd8d8d0);           /* 绳子 */
    addSolidM(fx,fz,1.1,1.1);
  })();

  /* ---- 宣传栏 ---- */
  function board(mx,my){
    var bx=M(mx), bz=M(my);
    K.frame(bx,bz,Math.PI/2);
    K.rod('metal',-2.0,0,0,-2.0,2.3,0,0.05,0.05,6,0x2a3238);
    K.rod('metal', 2.0,0,0, 2.0,2.3,0,0.05,0.05,6,0x2a3238);
    K.bevel('metal',0,1.35,0,4.1,1.5,0.10,0x2a3238,1.0,0.02);
    K.box('paper',0,1.35,0.06,3.9,1.3,0.01,0xd8d2c4,1.0);
    var k; for(k=0;k<6;k++) K.box('paper',-1.6+k*0.64,1.35+(hash2(k,mx)-0.5)*0.4,0.067,0.52,0.70,0.004,[0xe8e4dc,0xc8d8e0,0xd8c8a8][k%3],1);
    K.box('glass',0,1.35,0.08,3.9,1.3,0.01,0xb8c8d0,1.1);
    K.bevel('plastic',0,2.20,0,4.5,0.14,0.5,0x8b3a2e,1.0,0.03);
    K.unframe();
    addSolidM(bx,bz,0.2,2.1);
  }
  board(686,560);
  board(686,880);

  /* ---- 路灯：杆子 + 弯臂 + 灯头（灯头单独一种自发光材质） ---- */
  var lampSeen=[];
  function lampOK(mx,my){
    for(var k=0;k<lampSeen.length;k++) if(dist2(mx,my,lampSeen[k][0],lampSeen[k][1])<70*70) return false;
    return outFree(mx,my,3,2);
  }
  for(i=0;i<ROADS.length;i++){
    var rr=ROADS[i], horiz=(rr[2]-rr[0])>(rr[3]-rr[1]);
    var L0=horiz?rr[0]:rr[1], L1=horiz?rr[2]:rr[3], st2=90, t3;
    for(t3=L0+20; t3<L1-10; t3+=st2){
      var cand=horiz?[[t3,rr[1]-5],[t3,rr[3]+5]]:[[rr[0]-5,t3],[rr[2]+5,t3]];
      for(j=0;j<2;j++){
        var ci=(j+i)%2, lmx=cand[ci][0], lmy=cand[ci][1];
        if(!lampOK(lmx,lmy)) continue;
        lampSeen.push([lmx,lmy]);
        var lx=M(lmx), lz=M(lmy);
        var dx=horiz?0:(ci?-1:1), dz=horiz?(ci?-1:1):0;            /* 灯臂伸向路面 */
        K.cyl('metal',lx,0,lz,0.16,0.14,0.5,8,0x3a4146,1.0);
        K.cyl('metal',lx,0.5,lz,0.08,0.05,4.4,8,0x252c31,1.0);
        K.rod('metal',lx,4.85,lz,lx+dx*0.9,4.95,lz+dz*0.9,0.035,0.03,5,0x252c31);
        var hx=lx+dx*0.95, hz=lz+dz*0.95;
        K.bevel('metal',hx,4.90,hz,0.62,0.12,0.36,0x2a3238,1.0,0.03);
        K.g('lamp').box(hx,4.82,hz,0.50,0.04,0.26,0xffffff,1.0);
        OUT_LAMPS.push({x:hx,y:4.82,z:hz});
        addSolidM(lx,lz,0.2,0.2);
        break;
      }
    }
  }

  /* ---- 长椅（板条 + 铸铁腿）+ 圆形垃圾桶 ---- */
  var benchSpots=[[420,1020],[650,1020],[420,1070],[650,1070],[730,300],[730,640],[730,960],[380,700],[340,250],[600,1210]];
  for(i=0;i<benchSpots.length;i++){
    var bmx=benchSpots[i][0], bmy=benchSpots[i][1];
    var inGarden=inRect(bmx,bmy,[400,1000,670,1078],0);
    if(!inGarden&&!outFree(bmx,bmy,3,1)) continue;
    var px2=M(bmx), pz2=M(bmy), sl;
    for(sl=0;sl<4;sl++) K.bevel('wood',px2,0.44,pz2-0.18+sl*0.12,2.0,0.04,0.09,0x7a5434,1.0,0.01);
    for(sl=0;sl<3;sl++) K.bevel('wood',px2,0.62+sl*0.12,pz2-0.30-sl*0.02,2.0,0.08,0.03,0x7a5434,0.95,0.01);
    var lg;
    for(lg=-1;lg<=1;lg+=2){
      K.box('metal',px2+lg*0.85,0.22,pz2,0.06,0.44,0.46,0x2a2622,0.9);
      K.rod('metal',px2+lg*0.85,0.42,pz2-0.22,px2+lg*0.85,0.90,pz2-0.34,0.03,0.03,5,0x2a2622);
    }
    addSolidM(px2,pz2,1.0,0.3);
    K.cyl('plastic',px2+1.5,0,pz2,0.28,0.30,0.88,10,0x2f5a3a,1.0);
    K.cyl('metal',px2+1.5,0.88,pz2,0.31,0.26,0.08,10,0x272e33,1.0);
    K.box('dark',px2+1.5,0.70,pz2+0.29,0.18,0.12,0.02,0x111418,1);
    addSolidM(px2+1.5,pz2,0.3,0.3);
  }

  /* ---- 绿篱：分段，中间留口子，实心 ---- */
  function hedgeSeg(ax,az,bx,bz){
    var hx=(ax+bx)/2, hz=(az+bz)/2;
    var hw=Math.max(0.7,Math.abs(bx-ax)), hd=Math.max(0.7,Math.abs(bz-az));
    K.bevel('leaf',hx,0.42,hz,hw,0.84,hd,0x2c4a30,0.96,0.12);
    K.bevel('leaf',hx,0.86,hz,hw*0.94,0.10,hd*0.94,0x385a38,1.06,0.04);
    addSolidM(hx,hz,hw/2,hd/2);
  }
  function hedgeLine(mxa,mya,mxb,myb){
    var len=Math.hypot(mxb-mxa,myb-mya), seg=36, gap=18, t4;
    for(t4=0;t4+seg<=len;t4+=seg+gap){
      var ta=t4/len, tb=(t4+seg)/len;
      var ax4=mxa+(mxb-mxa)*ta, ay4=mya+(myb-mya)*ta, bx4=mxa+(mxb-mxa)*tb, by4=mya+(myb-mya)*tb;
      var ok=true, s5;
      for(s5=0;s5<=4;s5++){ var u=s5/4; if(!outFree(ax4+(bx4-ax4)*u,ay4+(by4-ay4)*u,2,1)){ ok=false; break; } }
      if(ok) hedgeSeg(M(ax4),M(ay4),M(bx4),M(by4));
    }
  }
  hedgeLine(724,215,724,1110);      /* 东干道东侧 */
  hedgeLine(684,215,684,505);
  hedgeLine(210,110,210,600);       /* 西墙内侧 */
  hedgeLine(820,110,820,1280);      /* 东墙内侧 */
  hedgeLine(420,1284,820,1284);     /* 南墙内侧 */

  /* ---- 树：沿路两侧一排 + 草地上零散几丛 ---- */
  var maxTrees=[45,100,170][q]||100, trees=[], lod=q;
  function treeOK(mx,my){
    if(!outFree(mx,my,10,7)) return false;
    for(var k=0;k<trees.length;k++) if(dist2(mx,my,trees[k][0],trees[k][1])<26*26) return false;
    for(k=0;k<lampSeen.length;k++) if(dist2(mx,my,lampSeen[k][0],lampSeen[k][1])<16*16) return false;
    return true;
  }
  for(i=0;i<ROADS.length&&trees.length<maxTrees*0.65;i++){
    var r2=ROADS[i], hz2=(r2[2]-r2[0])>(r2[3]-r2[1]);
    var A0=hz2?r2[0]:r2[1], A1=hz2?r2[2]:r2[3], t5;
    for(t5=A0+14; t5<A1-8 && trees.length<maxTrees*0.65; t5+=34){
      var cs2=hz2?[[t5,r2[1]-12],[t5,r2[3]+12]]:[[r2[0]-12,t5],[r2[2]+12,t5]];
      for(j=0;j<2;j++) if(treeOK(cs2[j][0],cs2[j][1])) trees.push(cs2[j]);
    }
  }
  for(i=0;i<900&&trees.length<maxTrees;i++){
    var tmx=BOUND.x0+10+hash2(i,211)*(BOUND.x1-BOUND.x0-20);
    var tmy=BOUND.y0+10+hash2(i,223)*(BOUND.y1-BOUND.y0-20);
    if(treeOK(tmx,tmy)) trees.push([tmx,tmy]);
  }
  for(i=0;i<trees.length;i++){
    var tx=M(trees[i][0]), tz=M(trees[i][1]);
    buildTree(K,tx,tz,i*7+3,lod);
    addSolidM(tx,tz,0.3,0.3);
  }
  OUTX.treeN=trees.length;

  /* ---- 灌木：草地上一小团一小团 ---- */
  var shrubN=[10,24,40][q]||24, made=0;
  for(i=0;i<400&&made<shrubN;i++){
    var smx=BOUND.x0+12+hash2(i,131)*(BOUND.x1-BOUND.x0-24);
    var smy=BOUND.y0+12+hash2(i,137)*(BOUND.y1-BOUND.y0-24);
    if(!outFree(smx,smy,6,4)) continue;
    var stx=M(smx), stz=M(smy), si;
    for(si=0;si<3;si++){
      var sc2=0.55+hash2(i*3+si,149)*0.45;
      K.blob('leaf',stx+(si-1)*0.42, sc2*0.45, stz+(si%2?0.30:-0.26), sc2*0.62, sc2*0.50, sc2*0.62, si%2?0x2a4a2e:0x315a34, 0.95+si*0.04, 6, 0.35, i*3+si);
    }
    addSolidM(stx,stz,0.8,0.6);
    made++;
  }
}
/* 草丛：一个 InstancedMesh，一次绘制；"流畅"画质不画 */
function addGrass(grp){
  var q=QUALITY|0; if(q<1) return;
  var N=q>1?9000:4200;
  var geo=new THREE.BufferGeometry();
  var P=[], C=[], k;
  for(k=0;k<3;k++){
    var a=k*1.047, cx=Math.cos(a)*0.09, cz=Math.sin(a)*0.09;
    P.push(-cx,0,-cz, cx,0,cz, 0,0.19,0);
    C.push(0.55,0.62,0.45, 0.55,0.62,0.45, 0.85,0.92,0.70);
  }
  geo.setAttribute('position',new THREE.Float32BufferAttribute(P,3));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(C,3));
  geo.computeVertexNormals();
  var mat=new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide});
  var im=new THREE.InstancedMesh(geo,mat,N);
  var m4=new THREE.Matrix4(), qq=new THREE.Quaternion(), sv=new THREE.Vector3(), pv=new THREE.Vector3(), up=new THREE.Vector3(0,1,0);
  var col=new THREE.Color(), n=0, tries=0;
  while(n<N&&tries<N*4){
    tries++;
    var mx=BOUND.x0+6+Math.random()*(BOUND.x1-BOUND.x0-12), my=BOUND.y0+6+Math.random()*(BOUND.y1-BOUND.y0-12);
    if(inObj(mx,my,2,false)||onRoad(mx,my,1)) continue;
    var skip=false;
    for(var i=0;i<OBJ.length;i++){ var a2=apronOf(OBJ[i]); if(a2&&inRect(mx,my,a2,1)){ skip=true; break; } }
    if(skip) continue;
    pv.set(M(mx),0,M(my));
    qq.setFromAxisAngle(up,Math.random()*6.283);
    var s=0.7+Math.random()*0.9; sv.set(s,s*(0.8+Math.random()*0.6),s);
    m4.compose(pv,qq,sv);
    im.setMatrixAt(n,m4);
    col.setRGB(0.40+Math.random()*0.14,0.52+Math.random()*0.14,0.30+Math.random()*0.08);
    im.setColorAt(n,col);
    n++;
  }
  im.count=n;
  im.instanceMatrix.needsUpdate=true;
  if(im.instanceColor) im.instanceColor.needsUpdate=true;
  im.frustumCulled=false;
  grp.add(im);
}
