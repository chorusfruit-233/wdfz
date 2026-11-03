/* @module-capsule */
(function($imports){
/* 里世界 3D · 钟楼的旋转楼梯
   以前钟楼和别的楼一样，上下楼是按 E 选楼层"传送"。现在钟楼中间一根石柱，
   楼梯绕着柱子转两圈上到顶，人真的一步一步走上去：走在楼梯上，镜头跟着台阶升高。
   顶上是平台和那口钟。

   地图仍是平面网格，高度单独算：
     SP.state  'ground' 地面 / 'stair' 楼梯上 / 'top' 顶上平台
     SP.a      在楼梯上绕过的角度（0 = 楼梯口，SPIRAL.amax = 顶）
   楼梯口朝南（朝门），角度往 +θ 方向（俯视顺时针）上升。坐标都是房间场景坐标（米，房间中心为原点）。 */
'use strict';






var SP={state:'ground',a:0,th:0};

function spWrap(a){ return ((a+$imports.PI)%$imports.TAU+$imports.TAU)%$imports.TAU-$imports.PI; }
/* 平台开口超过半圈，须保留到楼梯顶的整圈负偏角，不能用 ±π 的最短角差。 */

function spPolar(R,wx,wy){
  var p=(0,$imports.worldToScene)(wx,wy,R), dx=p.x-$imports.SPIRAL.cx, dz=p.z-$imports.SPIRAL.cz;
  return {r:Math.sqrt(dx*dx+dz*dz), th:Math.atan2(dz,dx)};
}
function spiralHere(){ return $imports.S.mode==='in'&&$imports.S.room===$imports.SPIRAL.room; }
function spiralReset(){ SP.state='ground'; SP.a=0; SP.th=0; $imports.S.floorY=0; }
/* 相同的平面坐标可能位于两圈楼梯或平台：读档时须在碰撞和防卡位之前恢复层数。 */
function spiralRestore(saved){
  if(!saved||['ground','stair','top'].indexOf(saved.state)<0||
     !Number.isFinite(saved.a)||!Number.isFinite(saved.th)||
     saved.a<$imports.SPIRAL.enter[0]||saved.a>$imports.SPIRAL.amax) return false;
  SP.state=saved.state;
  SP.a=saved.state==='top'?$imports.SPIRAL.amax:(saved.state==='ground'?0:saved.a);
  SP.th=saved.th;
  $imports.S.floorY=SP.state==='top'?$imports.SPIRAL.topH:(SP.state==='stair'?(0,$imports.clamp)(SP.a,0,$imports.SPIRAL.amax)/$imports.TAU*$imports.SPIRAL.turnH:0);
  return true;
}

/* 碰撞：按玩家现在所处的层判断某一点能不能站 */
function spiralSolid(R,wx,wy){
  var q=spPolar(R,wx,wy), ring=(q.r>=$imports.SPIRAL.rIn&&q.r<=$imports.SPIRAL.rOut);
  if(SP.state==='ground'){
    if(q.r<$imports.SPIRAL.rIn) return true;                         /* 柱子 */
    if(!ring) return false;
    var d=spWrap(q.th-$imports.SPIRAL.th0);
    return !(d>=$imports.SPIRAL.enter[0]&&d<=$imports.SPIRAL.enter[1]);      /* 楼梯底下是实心的，只有楼梯口能踏上去 */
  }
  if(SP.state==='stair'){
    var a=SP.a+spWrap(q.th-SP.th);
    if(q.r<$imports.SPIRAL.rIn) return true;
    if(a>=$imports.SPIRAL.amax) return q.r>$imports.SPIRAL.rOut;              /* 走上顶层平台 */
    if(q.r>$imports.SPIRAL.rOut) return a>0.35;                      /* 只有最下面一两级能从侧面迈下去，再往上有栏杆 */
    return false;
  }
  var dh=(0,$imports.spTopOffset)(q.th);
  if(ring&&dh<=0&&dh>=-$imports.SPIRAL.hole) return dh<-$imports.SPIRAL.arrive;   /* 楼梯口上方 */
  return q.r>$imports.SPIRAL.rOut||q.r<$imports.SPIRAL.rIn;                   /* 顶层：四周是栏杆，中间是钟 */
}
/* 移动之后更新所处的层和高度 */
function spiralUpdate(){
  if(!spiralHere()){
    var R0=$imports.S.mode==='in'?$imports.INTERIORS[$imports.S.room]:null;
    if($imports.S.floorY&&!(R0&&R0.ownHeight)) $imports.S.floorY=0;                 /* 自己管高度的房间（虚空迷宫）不在这里清零 */
    SP.state='ground'; return;
  }
  var R=$imports.INTERIORS[$imports.S.room], q=spPolar(R,$imports.S.x,$imports.S.y), ring=(q.r>=$imports.SPIRAL.rIn&&q.r<=$imports.SPIRAL.rOut);
  if(SP.state==='ground'){
    var d=spWrap(q.th-$imports.SPIRAL.th0);
    if(ring&&d>=$imports.SPIRAL.enter[0]&&d<=$imports.SPIRAL.enter[1]){ SP.state='stair'; SP.a=d; }
  }else if(SP.state==='stair'){
    SP.a+=spWrap(q.th-SP.th);
    if(SP.a<$imports.SPIRAL.enter[0]||(SP.a<0.35&&q.r>$imports.SPIRAL.rOut)){ SP.state='ground'; SP.a=0; }
    else if(SP.a>=$imports.SPIRAL.amax){
      SP.state='top'; SP.a=$imports.SPIRAL.amax;
      if(!$imports.RT.bellTopTold){ $imports.RT.bellTopTold=1; (0,$imports.os)('我：楼梯到头了。钟就挂在头顶，铜锈的味道很重。',3.6); }
    }
  }else{
    var dh=(0,$imports.spTopOffset)(q.th);
    if(ring&&dh<=0&&dh>=-$imports.SPIRAL.arrive){ SP.state='stair'; SP.a=$imports.SPIRAL.amax+dh; }   /* 从口子走回楼梯 */
  }
  SP.th=q.th;
  $imports.S.floorY=SP.state==='top'?$imports.SPIRAL.topH:(SP.state==='stair'?(0,$imports.clamp)(SP.a,0,$imports.SPIRAL.amax)/$imports.TAU*$imports.SPIRAL.turnH:0);
}
/* 站在顶上、离钟够近 */
function bellReach(){
  if(!spiralHere()||SP.state!=='top') return false;
  return spPolar($imports.INTERIORS[$imports.S.room],$imports.S.x,$imports.S.y).r<2.1;
}


/* @module-exports */
GameModules.publish("game3d/js/spiral.js",{
"SP":{get:function(){return SP;},set:function($value){SP=$value;}},
"spWrap":{get:function(){return spWrap;},set:function($value){spWrap=$value;}},
"spPolar":{get:function(){return spPolar;},set:function($value){spPolar=$value;}},
"spiralHere":{get:function(){return spiralHere;},set:function($value){spiralHere=$value;}},
"spiralReset":{get:function(){return spiralReset;},set:function($value){spiralReset=$value;}},
"spiralRestore":{get:function(){return spiralRestore;},set:function($value){spiralRestore=$value;}},
"spiralSolid":{get:function(){return spiralSolid;},set:function($value){spiralSolid=$value;}},
"spiralUpdate":{get:function(){return spiralUpdate;},set:function($value){spiralUpdate=$value;}},
"bellReach":{get:function(){return bellReach;},set:function($value){bellReach=$value;}}
});
})(GameModules.imports("game3d/js/spiral.js"));
