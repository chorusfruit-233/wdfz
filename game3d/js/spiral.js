/* 里世界 3D · 钟楼的旋转楼梯
   以前钟楼和别的楼一样，上下楼是按 E 选楼层"传送"。现在钟楼中间一根石柱，
   楼梯绕着柱子转两圈上到顶，人真的一步一步走上去：走在楼梯上，镜头跟着台阶升高。
   顶上是平台和那口钟。

   地图仍是平面网格，高度单独算：
     SP.state  'ground' 地面 / 'stair' 楼梯上 / 'top' 顶上平台
     SP.a      在楼梯上绕过的角度（0 = 楼梯口，SPIRAL.amax = 顶）
   楼梯口朝南（朝门），角度往 +θ 方向（俯视顺时针）上升。坐标都是房间场景坐标（米，房间中心为原点）。 */
'use strict';

var SPIRAL={
  room:'bell1',
  cx:0, cz:-1.0,            /* 柱子中心 */
  rCol:0.55, rIn:0.75, rOut:2.6,
  turnH:3.2, turns:2,       /* 每圈升 3.2 米，转两圈 */
  steps:16,                 /* 每圈台阶数 */
  th0:Math.PI/2,            /* 楼梯口在柱子正南 */
  enter:[-0.30,0.50],       /* 地面上能踏上第一级的角度范围（相对楼梯口） */
  hole:0.62                 /* 顶上平台在最后一段楼梯上方留的口子（弧度） */
};
SPIRAL.amax=SPIRAL.turns*TAU;
SPIRAL.topH=SPIRAL.turns*SPIRAL.turnH;
SPIRAL.wallH=SPIRAL.topH+3.4;

var SP={state:'ground',a:0,th:0};

function spWrap(a){ return ((a+PI)%TAU+TAU)%TAU-PI; }
function spPolar(R,wx,wy){
  var p=worldToScene(wx,wy,R), dx=p.x-SPIRAL.cx, dz=p.z-SPIRAL.cz;
  return {r:Math.sqrt(dx*dx+dz*dz), th:Math.atan2(dz,dx)};
}
function spiralHere(){ return S.mode==='in'&&S.room===SPIRAL.room; }
function spiralReset(){ SP.state='ground'; SP.a=0; SP.th=0; S.floorY=0; }

/* 碰撞：按玩家现在所处的层判断某一点能不能站 */
function spiralSolid(R,wx,wy){
  var q=spPolar(R,wx,wy), ring=(q.r>=SPIRAL.rIn&&q.r<=SPIRAL.rOut);
  if(SP.state==='ground'){
    if(q.r<SPIRAL.rIn) return true;                         /* 柱子 */
    if(!ring) return false;
    var d=spWrap(q.th-SPIRAL.th0);
    return !(d>=SPIRAL.enter[0]&&d<=SPIRAL.enter[1]);      /* 楼梯底下是实心的，只有楼梯口能踏上去 */
  }
  if(SP.state==='stair'){
    var a=SP.a+spWrap(q.th-SP.th);
    if(a>=SPIRAL.amax) return q.r>SPIRAL.rOut;              /* 走上顶层平台 */
    if(q.r<SPIRAL.rIn) return true;
    if(q.r>SPIRAL.rOut) return a>0.35;                      /* 只有最下面一两级能从侧面迈下去，再往上有栏杆 */
    return false;
  }
  return q.r>SPIRAL.rOut;                                   /* 顶层：四周是栏杆 */
}
/* 移动之后更新所处的层和高度 */
function spiralUpdate(){
  if(!spiralHere()){ if(S.floorY) S.floorY=0; SP.state='ground'; return; }
  var R=INTERIORS[S.room], q=spPolar(R,S.x,S.y), ring=(q.r>=SPIRAL.rIn&&q.r<=SPIRAL.rOut);
  if(SP.state==='ground'){
    var d=spWrap(q.th-SPIRAL.th0);
    if(ring&&d>=SPIRAL.enter[0]&&d<=SPIRAL.enter[1]){ SP.state='stair'; SP.a=d; }
  }else if(SP.state==='stair'){
    SP.a+=spWrap(q.th-SP.th);
    if(SP.a<SPIRAL.enter[0]||(SP.a<0.35&&q.r>SPIRAL.rOut)){ SP.state='ground'; SP.a=0; }
    else if(SP.a>=SPIRAL.amax){
      SP.state='top'; SP.a=SPIRAL.amax;
      if(!RT.bellTopTold){ RT.bellTopTold=1; os('我：楼梯到头了。钟就挂在头顶，铜锈的味道很重。',3.6); }
    }
  }else{
    var dh=spWrap(q.th-(SPIRAL.th0+SPIRAL.amax));
    if(ring&&dh<=0&&dh>=-SPIRAL.hole){ SP.state='stair'; SP.a=SPIRAL.amax+dh; }   /* 从口子走回楼梯 */
  }
  SP.th=q.th;
  S.floorY=SP.state==='top'?SPIRAL.topH:(SP.state==='stair'?clamp(SP.a,0,SPIRAL.amax)/TAU*SPIRAL.turnH:0);
}
/* 站在顶上、离钟够近 */
function bellReach(){
  if(!spiralHere()||SP.state!=='top') return false;
  return spPolar(INTERIORS[S.room],S.x,S.y).r<2.1;
}

/* ---- 建模：柱子、台阶、栏杆、顶层平台和钟 ---- */
function buildSpiral(c){
  var K=c.K, s=SPIRAL, i, n=s.steps*s.turns, da=TAU/s.steps, rise=s.turnH/s.steps;
  var rm=(s.rIn+s.rOut)/2, len=s.rOut-s.rIn;
  K.cyl('stone',s.cx,0,s.cz,s.rCol+0.08,s.rCol,s.topH,16,0x7a746a,1.0);              /* 中间的石柱 */
  K.cyl('stone',s.cx,0,s.cz,s.rCol+0.22,s.rCol+0.18,0.25,16,0x6a645a,0.95);
  for(i=0;i<n;i++){
    var a=s.th0+(i+0.5)*da, h=(i+1)*rise;
    var x=s.cx+Math.cos(a)*rm, z=s.cz+Math.sin(a)*rm;
    /* Kit 的 frame 旋转：局部 x 轴转到 (cos, -sin)。台阶长边沿半径方向 */
    K.frame(x,z,-a,0);
    K.box('stone',0,h-0.07,0,len,0.14,rm*da*1.08,shadeHex(0x8a8478,(i&1)?1.0:0.92),1.0);
    K.box('stone',0,h-0.30,0,len*0.92,0.32,rm*da*0.9,0x5a544c,0.85);                  /* 台阶底下的石梁 */
    K.box('metal',len/2-0.06,h+0.45,0,0.04,0.90,0.04,0x2a2622,1.0);                      /* 外侧栏杆柱 */
    K.unframe();
    if(i>0){
      var a0=s.th0+(i-0.5)*da, h0=i*rise;
      K.rod('wood',s.cx+Math.cos(a0)*(s.rOut-0.06),h0+0.92,s.cz+Math.sin(a0)*(s.rOut-0.06),
                   s.cx+Math.cos(a)*(s.rOut-0.06),h+0.92,s.cz+Math.sin(a)*(s.rOut-0.06),0.03,0.03,5,0x4a3626);   /* 扶手 */
    }
  }
  /* 顶层平台：一圈扇形石板，最后一段楼梯上方留口子 */
  var segs=40, sa=TAU/segs, top=s.topH, tEnd=s.th0+s.amax;
  K.cyl('stone',s.cx,top-0.16,s.cz,s.rIn+0.02,s.rIn+0.02,0.16,16,0x6e685e,1.0);
  for(i=0;i<segs;i++){
    var am=i*sa+sa/2, d=spWrap(am-tEnd);
    if(d<=0&&d>=-s.hole) continue;
    K.frame(s.cx+Math.cos(am)*rm,s.cz+Math.sin(am)*rm,-am,0);
    K.box('stone',0,top-0.08,0,len,0.16,rm*sa*1.12,0x7e786c,1.0);
    K.box('metal',len/2-0.05,top+0.5,0,0.04,1.0,0.04,0x2a2622,1.0);
    K.unframe();
    var a1=i*sa, a2=(i+1)*sa;
    K.rod('wood',s.cx+Math.cos(a1)*(s.rOut-0.05),top+0.98,s.cz+Math.sin(a1)*(s.rOut-0.05),
                 s.cx+Math.cos(a2)*(s.rOut-0.05),top+0.98,s.cz+Math.sin(a2)*(s.rOut-0.05),0.03,0.03,5,0x4a3626);
  }
  /* 钟：挂在平台上方的横梁上（沿用 FURN.U 的造型，整体抬到平台高度） */
  var cc={K:K,R:c.R,ao:function(){},solid:function(){}};
  K.frame(0,0,0,top); FURN.U(cc,0,0,s.cx,s.cz); K.unframe();
  K.box('wood',s.cx-1.25,top+1.45,s.cz,0.18,2.9,0.18,0x3a2a1c,1.0);                     /* 吊钟木架的两根立柱 */
  K.box('wood',s.cx+1.25,top+1.45,s.cz,0.18,2.9,0.18,0x3a2a1c,1.0);
}
