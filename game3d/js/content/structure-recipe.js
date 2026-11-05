/* @module-capsule */
(function($imports){
/* 里世界 3D · 室外构筑物的布局：柱廊立柱、连廊落地柱、电动车棚（钢架与停着的电动车）
   位置只在这里算一次，建模（model/building.js）和碰撞（app/space-layout.js）共用，画面和碰撞一定一致。
   以前这些只在建模里画、没进碰撞配方：人能站进柱子里，车棚却按整块屋顶挡人（空气墙）。
   单位是米；px / pz 是对象中心，sw / sd 是宽和深，与 model/building.js 的建模函数同一套参数。 */
'use strict';
var STRUCTURE_CFG={
  colonnade:{depth:2.6,step:4.2,minCols:4,doorGap:3.2,half:0.31},      /* 柱身 0.46 米见方，石底座 0.62 米：碰撞按底座 */
  link:{n:3,inset:0.4,half:0.21},                                         /* 连廊落地柱 0.42 米见方，每侧 n+1 根 */
  shed:{frame:0.42,frameStep:4,frameHalf:0.225,bikeX:-0.10,bikeStep:1.1,bikeStart:0.8,bikeSkip:0.28,bikeHalfX:0.76,bikeHalfZ:0.29}
};
/* 教学楼 / 行政楼 / 实验楼南面一层的架空柱廊：正中让出大门 */
function colonnadeColumns(px,pz,sw,sd){
  var C=STRUCTURE_CFG.colonnade,n=Math.max(C.minCols,Math.round(sw/C.step)),out=[],i;
  for(i=0;i<=n;i++){
    var x=px-sw/2+(sw/n)*i;
    if(Math.abs(x-px)<C.doorGap)continue;
    out.push({x:x,z:pz+sd/2+C.depth/2});
  }
  return out;
}
/* 教学楼（连续校园 A1，按室内重建）：外壳就是室内 63×22 格（1 格 1 米），室内坐标只差一个平移（OBJ.ic）。
   南侧二到五层是敞开的外廊：教室块的南墙退到走廊北墙后面（第 15.7 格，比室内墙面往里 0.3 米，从走廊里看不到两层墙打架）；
   两部楼梯（室内第 6、55 列南墙）和电梯（第 20 列）的井道从南墙往外伸，是楼前的三座塔，碰撞和模型共用这里的尺寸（米）。 */
var TEACH_SOUTH={cols:63,rows:22,gallery:15.7,east:57,stairs:[{col:6,top:19.6},{col:55,top:16.9}],lift:{col:20,top:17.6},
  towerHalf:2.4,towerOut:9.6,liftHalf:1.15,liftOut:2.3};
function teachSouth(px,pz,sw,sd){
  var C=TEACH_SOUTH,t=sw/C.cols,x0=px-sw/2,z0=pz-sd/2,zs=pz+sd/2;
  var towers=C.stairs.map(function(s){return {x:x0+(s.col+1)*t,z0:zs,z1:zs+C.towerOut,half:C.towerHalf,top:s.top,kind:'stair'};});
  towers.push({x:x0+(C.lift.col+0.5)*t,z0:zs,z1:zs+C.liftOut,half:C.liftHalf,top:C.lift.top,kind:'lift'});
  return {t:t,x0:x0,z0:z0,zs:zs,gz:z0+C.gallery*t,ge0:x0+t,ge1:x0+C.east*t,towers:towers};
}
/* 连廊两侧落地的砖柱 */
function linkPillars(px,pz,sw,sd){
  var C=STRUCTURE_CFG.link,out=[],i;
  for(i=0;i<=C.n;i++){
    var x=px-sw/2+(sw/C.n)*i;
    out.push({x:x,z:pz-sd/2+C.inset});
    out.push({x:x,z:pz+sd/2-C.inset});
  }
  return out;
}
/* 电动车棚：门式钢架沿长边排开（两根柱子在 ±0.42 宽处，8 米宽时就是 ±3.36 米），一排电动车停在中线偏左；
   有的车位空着（按车位号的哈希）。棚下右侧是一条通道，左侧窄一些，都能走人。 */
function shedLayout(px,pz,sw,sd){
  var C=STRUCTURE_CFG.shed,n=Math.max(5,Math.round(sd/C.frameStep)),frames=[],bikes=[],i,bn=Math.floor(sd/C.bikeStep);
  for(i=0;i<=n;i++)frames.push(pz-sd*0.46+i*(sd*0.92/n));
  for(i=0;i<bn;i++){
    if((0,$imports.hash2)(i,57)<C.bikeSkip)continue;
    bikes.push({i:i,x:px+sw*C.bikeX,z:pz-sd/2+C.bikeStart+i*C.bikeStep});
  }
  return {frames:frames,bikes:bikes,colX:[px-sw*C.frame,px+sw*C.frame]};
}
/* 碰撞：在室外碰撞配方（SpatialKit）里按上面的布局登记实心矩形；scale 是米到地图单位的换算 */
function addStructureSolids(K,o,px,pz,sw,sd,scale){
  var C=STRUCTURE_CFG;
  if(o.k==='roof'&&o.open1f)colonnadeColumns(px,pz,sw,sd).forEach(function(c){K.solidM(c.x,c.z,C.colonnade.half,C.colonnade.half,scale);});
  if(o.k==='link')linkPillars(px,pz,sw,sd).forEach(function(c){K.solidM(c.x,c.z,C.link.half,C.link.half,scale);});
  if(o.id==='teach')teachSouth(px,pz,sw,sd).towers.forEach(function(b){K.solidM(b.x,(b.z0+b.z1)/2,b.half,(b.z1-b.z0)/2,scale);});   /* 楼前的楼梯塔、电梯井 */
  if(o.id==='shed'){
    var L=shedLayout(px,pz,sw,sd);
    L.frames.forEach(function(z){L.colX.forEach(function(x){K.solidM(x,z,C.shed.frameHalf,C.shed.frameHalf,scale);});});
    L.bikes.forEach(function(b){K.solidM(b.x,b.z,C.shed.bikeHalfX,C.shed.bikeHalfZ,scale);});
  }
}

/* @module-exports */
GameModules.publish("game3d/js/content/structure-recipe.js",{
"STRUCTURE_CFG":{get:function(){return STRUCTURE_CFG;},set:function($value){STRUCTURE_CFG=$value;}},
"colonnadeColumns":{get:function(){return colonnadeColumns;},set:function($value){colonnadeColumns=$value;}},
"TEACH_SOUTH":{get:function(){return TEACH_SOUTH;},set:function($value){TEACH_SOUTH=$value;}},
"teachSouth":{get:function(){return teachSouth;},set:function($value){teachSouth=$value;}},
"linkPillars":{get:function(){return linkPillars;},set:function($value){linkPillars=$value;}},
"shedLayout":{get:function(){return shedLayout;},set:function($value){shedLayout=$value;}},
"addStructureSolids":{get:function(){return addStructureSolids;},set:function($value){addStructureSolids=$value;}}
});
})(GameModules.imports("game3d/js/content/structure-recipe.js"));
