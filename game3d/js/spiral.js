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
  hole:3.9,                 /* 顶上平台在楼梯上方留的口子（弧度）：以前只留 0.62，最后小半圈楼梯离平台底不到 1.7 米，走上去头就穿进石板里 */
  arrive:0.62               /* 口子里只有靠楼梯顶这一段能从平台走回楼梯，其余一圈是栏杆 */
};
SPIRAL.amax=SPIRAL.turns*TAU;
SPIRAL.topH=SPIRAL.turns*SPIRAL.turnH;
SPIRAL.wallH=SPIRAL.topH+3.4;

var SP={state:'ground',a:0,th:0};

function spWrap(a){ return ((a+PI)%TAU+TAU)%TAU-PI; }
/* 平台开口超过半圈，须保留到楼梯顶的整圈负偏角，不能用 ±π 的最短角差。 */
function spTopOffset(th){
  var d=((th-SPIRAL.th0-SPIRAL.amax)%TAU+TAU)%TAU;
  return d>0?d-TAU:0;
}
function spPolar(R,wx,wy){
  var p=worldToScene(wx,wy,R), dx=p.x-SPIRAL.cx, dz=p.z-SPIRAL.cz;
  return {r:Math.sqrt(dx*dx+dz*dz), th:Math.atan2(dz,dx)};
}
function spiralHere(){ return S.mode==='in'&&S.room===SPIRAL.room; }
function spiralReset(){ SP.state='ground'; SP.a=0; SP.th=0; S.floorY=0; }
/* 相同的平面坐标可能位于两圈楼梯或平台：读档时须在碰撞和防卡位之前恢复层数。 */
function spiralRestore(saved){
  if(!saved||['ground','stair','top'].indexOf(saved.state)<0||
     !Number.isFinite(saved.a)||!Number.isFinite(saved.th)||
     saved.a<SPIRAL.enter[0]||saved.a>SPIRAL.amax) return false;
  SP.state=saved.state;
  SP.a=saved.state==='top'?SPIRAL.amax:(saved.state==='ground'?0:saved.a);
  SP.th=saved.th;
  S.floorY=SP.state==='top'?SPIRAL.topH:(SP.state==='stair'?clamp(SP.a,0,SPIRAL.amax)/TAU*SPIRAL.turnH:0);
  return true;
}

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
    if(q.r<SPIRAL.rIn) return true;
    if(a>=SPIRAL.amax) return q.r>SPIRAL.rOut;              /* 走上顶层平台 */
    if(q.r>SPIRAL.rOut) return a>0.35;                      /* 只有最下面一两级能从侧面迈下去，再往上有栏杆 */
    return false;
  }
  var dh=spTopOffset(q.th);
  if(ring&&dh<=0&&dh>=-SPIRAL.hole) return dh<-SPIRAL.arrive;   /* 楼梯口上方 */
  return q.r>SPIRAL.rOut||q.r<SPIRAL.rIn;                   /* 顶层：四周是栏杆，中间是钟 */
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
    var dh=spTopOffset(q.th);
    if(ring&&dh<=0&&dh>=-SPIRAL.arrive){ SP.state='stair'; SP.a=SPIRAL.amax+dh; }   /* 从口子走回楼梯 */
  }
  SP.th=q.th;
  S.floorY=SP.state==='top'?SPIRAL.topH:(SP.state==='stair'?clamp(SP.a,0,SPIRAL.amax)/TAU*SPIRAL.turnH:0);
}
/* 站在顶上、离钟够近 */
function bellReach(){
  if(!spiralHere()||SP.state!=='top') return false;
  return spPolar(INTERIORS[S.room],S.x,S.y).r<2.1;
}

