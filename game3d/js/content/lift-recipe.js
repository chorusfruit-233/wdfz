/* @module-capsule */
(function($imports){
/* 里世界 3D · 电梯建模（电梯厅、轿厢）
   在 PR #24 的程序化预制件（model/elevator-prefab.js：EV_SPEC 尺寸、EV_COL 配色、门套 / 地坎 / 外呼盒 / 楼层屏 /
   操纵盘 / 扶手等零件）基础上，接进本仓库的房间生成：全部走 Kit 图元，和房间一起合批、按画质分段、进穿模检查。
   对预制件做的调整：
     - 只取看得见的部件：电梯厅用门套、地坎、外呼盒、楼层屏和到站灯；轿厢用轿壁、护板、吊顶灯、操纵盘、扶手、
       轿内屏。井道壁、导轨、对重、钢丝绳、曳引机、缓冲器、门机这些永远被墙和轿壁挡住，不再生成；
     - 层门与轿门自己做：预制件里两种门的内凹装饰面板都朝向看不见的一侧（层门朝井道、轿门朝外），这里改为朝向
       走廊 / 轿厢里面；层门做成单独的两扇网格，电梯到达本层时向两侧滑开，门后是一节亮着灯的轿厢；
     - 摆放：电梯门格是 1 米厚的墙格，层门平面退进墙面 10 厘米，门扇滑开时藏进两侧墙体；外呼盒、楼层屏、到站灯
       各自贴在墙面上（不再整体后移，免得屏幕陷进墙里或悬在墙外）；
     - 轿厢房间按真实尺寸（轿厢 1.6 × 1.5 米、门 0.9 米）布置，轿壁登记碰撞，玩家只在轿厢里活动；
     - 流畅档省掉螺栓、压筋、数码管段这类小零件。 */
'use strict';

var LIFT_DOOR_Z=0.40;            /* 层门平面在门格局部坐标里的位置（墙面在 +0.5） */
var LIFT_DOOR_HALF=0.47;         /* 门洞两侧门框之间的半宽（碰撞；门扇 0.9 米宽） */
var LIFT_GLIMPSE={front:0.37, back:-1.05, top:2.20};   /* 门后看得见的那一节轿厢 */

var LIFT_ON_WALL=/^(hall(Up|Down)|jambBolt|handrailBracket)/;
var LIFT_PANEL_BTN=/^(floorButton|floorLed|doorOpenButton|doorCloseButton|alarmButton)/;
function liftLow(){ return ($imports.Quality.get().segments||1)<0.75; }
/* 小零件：最大边长不到 3 厘米 */
function liftTiny(b){
  if(b.type==='box') return Math.max(b.sx,b.sy,b.sz)<0.03;
  if(b.type==='cyl') return Math.max(b.rb,b.rt)*2<0.03&&b.h<0.03;
  return false;
}
function liftMat(col){
  if(col===$imports.EV_COL.led||col===$imports.EV_COL.ledGreen||col===$imports.EV_COL.lamp) return 'emit';
  if(col===$imports.EV_COL.glass) return 'dark';
  if(col===$imports.EV_COL.rubber||col===$imports.EV_COL.cable) return 'plastic';
  if(col===$imports.EV_COL.paint||col===$imports.EV_COL.paintDark||col===$imports.EV_COL.paintDeep) return 'plastic';   /* 烤漆面 */
  return 'metal';
}
/* 把预制件图元画进当前 Kit 坐标系：dz / dy 是整体平移；low 档跳过小零件。
   小零件（螺栓、按钮帽）一律不进碰撞占地：它们只在高画质才建，进了占地就会让五档画质的碰撞不一样 */
function liftEmit(K,parts,dz,dy){
  var low=liftLow(), cap=K.cap;
  parts.forEach(function(b){
    var tiny=liftTiny(b);
    if(low&&tiny) return;
    K.cap=tiny?null:cap;
    var m=liftMat(b.col), sh=m==='emit'?1:0.96;
    if(b.type==='cyl'&&LIFT_ON_WALL.test(b.part))                    /* 墙上的按钮、螺栓、支架：轴沿墙面法线（+z），不是竖着 */
      K.rod(m,b.x,b.y+dy,b.z+dz,b.x,b.y+dy,b.z+dz+b.h,b.rb,b.rt,(0,$imports.lodSeg)(b.nseg||12,6),b.col,sh);
    else if(b.type==='cyl') K.cyl(m,b.x,b.y+dy,b.z+dz,b.rb,b.rt,b.h,(0,$imports.lodSeg)(b.nseg||12,6),b.col,sh);
    else if(b.type==='rod') K.rod(m,b.x0,b.y0+dy,b.z0+dz,b.x1,b.y1+dy,b.z1+dz,b.r0,b.r1,(0,$imports.lodSeg)(b.nseg||6,4),b.col,sh);
    else K.box(m,b.x,b.y+dy,b.z+dz,b.sx,b.sy,b.sz,b.col,sh);
  });
  K.cap=cap;
}
/* 门格朝哪一侧开：返回走得进去的那个邻格方向 [dc,dr]（列、行） */
function liftOpenSide(R,x,y){
  var D=[[0,-1],[0,1],[-1,0],[1,0]], i;
  for(i=0;i<4;i++){
    var row=R.grid[y+D[i][1]], ch=row&&row[x+D[i][0]];
    if(ch&&ch!=='#') return D[i];
  }
  return null;
}
/* 局部坐标（Kit.frame 的约定）→ 房间坐标 */
function liftToRoom(cx,cz,rot,lx,lz){
  var c=Math.cos(rot), s=Math.sin(rot);
  return {x:cx+lx*c+lz*s, z:cz-lx*s+lz*c};
}
/* 局部坐标里的矩形登记成碰撞（rot 只取 0 / ±90° / 180°） */
function liftSolid(c,cx,cz,rot,x0,x1,z0,z1){
  var a=liftToRoom(cx,cz,rot,x0,z0), b=liftToRoom(cx,cz,rot,x1,z1);
  c.solid((a.x+b.x)/2,(a.z+b.z)/2,Math.abs(b.x-a.x),Math.abs(b.z-a.z));
}
/* 一扇门：门板 + 朝 face 一侧（+1 为局部 +z）的内凹板、上下压筋、对口边条。原点在门扇中心 */
function liftLeaf(K,leafW,face,sg){
  var s=$imports.EV_SPEC, H=s.doorH, T=s.doorT, low=liftLow();
  K.box('plastic',0,H/2,0,leafW,H,T,$imports.EV_COL.paint,0.98);
  K.box('plastic',0,H/2,face*(T/2+0.003),leafW-0.09,H-0.16,0.006,$imports.EV_COL.paintDeep,0.96);
  if(!low){
    K.box('plastic',0,1.86,face*(T/2+0.006),leafW-0.12,0.02,0.006,$imports.EV_COL.paintDark,0.96);
    K.box('plastic',0,0.32,face*(T/2+0.006),leafW-0.12,0.02,0.006,$imports.EV_COL.paintDark,0.96);
  }
  K.box('metal',-sg*(leafW/2-0.006),H/2,0,0.012,H-0.04,T+0.004,$imports.EV_COL.steelDark,0.96);   /* 对口那条边 */
}

/* 一组墙上零件：整体平移到背面贴住墙面（局部 z=+0.5） */
function liftOnWall(K,P,re,dy){
  var parts=P.boxes.filter(function(b){ return re.test(b.part); });
  if(!parts.length) return;
  var back=Math.min.apply(null,parts.map(function(b){ return b.type==='box'?b.z-b.sz/2:b.z; }));
  liftEmit(K,parts,0.502-back,dy||0);
}
/* ---------- 电梯厅：走廊墙上的电梯门 ---------- */
function liftLanding(c,x,y,cx,cz){
  var K=c.K, R=c.R, TH=c.theme, s=$imports.EV_SPEC, d=liftOpenSide(R,x,y);
  if(!d){ c.solid(cx,cz,c.tw,c.th); return; }
  var rot=Math.atan2(d[0],d[1]);                                  /* 局部 +z 朝走廊 */
  var P=(0,$imports.buildElevatorPrefab)({view:'landing',label:(R.floor||1)+'F'});
  K.frame(cx,cz,rot);
  /* 门洞以上整格是墙（过梁），过梁底面贴一块不锈钢顶板；门后井道里那一节轿厢由 liftDecor 画（它在楼层网格外面） */
  var DTOP=s.doorH+0.02, G=LIFT_GLIMPSE;
  K.box(TH.wallMat||'plaster',0,(DTOP+$imports.WALLH)/2,0,1,$imports.WALLH-DTOP,1,TH.wall,0.94);
  K.box('metal',0,DTOP-0.006,(G.front-0.5)/2,0.98,0.012,G.front+0.5,$imports.EV_COL.steelHi,1.0);
  /* 门套、地坎：层门平面对齐 LIFT_DOOR_Z（预制件里在 z=0.94） */
  var dz=LIFT_DOOR_Z-0.94;
  liftEmit(K,P.boxes.filter(function(b){ return b.kind==='landing'&&/^(doorJamb|jambBolt|sill)/.test(b.part); }),dz,0);
  /* 门顶上的楼层屏、到站灯：背面贴在墙面（+0.5）上；门旁边墙上的外呼盒由 liftDecor 画（它装在隔壁那格墙上） */
  liftOnWall(K,P,/^(displayFrame|displayPanel|seg_|dirUp|dirDn)/,0.03);
  liftOnWall(K,P,/^hallLantern/,0.03);
  K.unframe();
  /* 门格只留两侧门框挡人：门洞挡不挡由门的开度决定（elevator.js 的 doorDepth），门开着时可以直接走进门后的轿厢 */
  liftSolid(c,cx,cz,rot,-0.5,-LIFT_DOOR_HALF,-0.5,0.5);
  liftSolid(c,cx,cz,rot,LIFT_DOOR_HALF,0.5,-0.5,0.5);
  /* 两扇层门单独成网格：电梯到这一层时向两侧滑开（LiftDoors.tick） */
  if(c.view&&c.view.liftLeaves)c.view.liftLeaves(c,cx,cz,rot);
}

/* ---------- 轿厢 ----------
   门格（J）只放两扇关着的轿门；轿厢本身（轿壁、护板、吊顶、操纵盘、扶手、碰撞）由 liftDecor 当作房间布置来画：
   它占的是门格后面那几格，不属于门格这一件家具。 */
function liftCabinFrame(R,x,y){
  var d=liftOpenSide(R,x,y); if(!d) return null;
  return {rot:Math.atan2(-d[0],-d[1]), dz:-0.5-($imports.EV_SPEC.carCZ+$imports.EV_SPEC.carD/2), dy:-0.08};   /* 局部 +z 朝轿门外；前壁内侧落在门格内侧面 */
}
/* 楼层电梯门后的那节轿厢：和轿厢房间用同一个相对门格的位置（局部 +z 朝走廊），两边一模一样，换场景时看不出来 */
function liftAnnexFrame(R,x,y){
  var d=liftOpenSide(R,x,y); if(!d) return null;
  return {rot:Math.atan2(d[0],d[1]), dz:-0.5-($imports.EV_SPEC.carCZ+$imports.EV_SPEC.carD/2), dy:-0.08};
}
function liftCabin(c,x,y,cx,cz){
  var K=c.K, s=$imports.EV_SPEC, F=liftCabinFrame(c.R,x,y);
  c.solid(cx,cz,c.tw,c.th);
  if(!F) return;
  var leafW=(s.doorW-s.doorGap)/2, doorZ=s.carCZ+s.carD/2+0.03+F.dz;
  K.frame(cx,cz,F.rot);
  [-1,1].forEach(function(sg){                                    /* 轿门（关着）：装饰面朝轿厢里面 */
    var old=K.sub(sg*(leafW/2+s.doorGap/2),doorZ,0,0);
    liftLeaf(K,leafW,-1,sg);
    K.restore(old);
  });
  K.unframe();
}
function liftCabinBody(c,x,y,cx,cz,F,annex){
  var K=c.K, s=$imports.EV_SPEC; F=F||liftCabinFrame(c.R,x,y); if(!F) return;
  var rot=F.rot, dz=F.dz, dy=F.dy;
  var P=(0,$imports.buildElevatorPrefab)({view:'car',label:'1F'});
  K.frame(cx,cz,rot);
  liftEmit(K,P.boxes.filter(function(b){ return b.kind==='car'&&!/^door(Left|Right)/.test(b.part)&&!LIFT_PANEL_BTN.test(b.part); }),dz,dy);
  /* 操纵盘：五个楼层键 + 开门 / 关门 / 报警，键面朝轿厢里面（侧壁法线 −x） */
  var face=P.parts.carPanelFace, px=face.x-face.sx/2, pz=face.z+dz, low=liftLow(), sg=(0,$imports.lodSeg)(14,6), i;
  function button(y,z,cap,lamp){
    K.rod('metal',px,y+dy,z,px-0.010,y+dy,z,0.024,0.024,sg,$imports.EV_COL.steelDark,0.96);
    K.rod('plastic',px-0.010,y+dy,z,px-0.020,y+dy,z,0.018,0.018,sg,cap,0.98);
    if(lamp&&!low) K.rod('emit',px-0.020,y+dy,z,px-0.023,y+dy,z,0.008,0.008,sg,$imports.EV_COL.led,1);
  }
  K.box('metal',px-0.002,1.42+dy,pz,0.004,0.82,0.19,0x3b4346,0.96);          /* 深色拉丝面板（略凸出护板）：按钮从轿壁上一眼看得出来 */
  K.box('metal',px-0.002,1.10+dy,pz+0.005,0.004,0.09,0.25,0x3b4346,0.96);
  for(i=0;i<5;i++) button(1.74-i*0.105,pz,$imports.EV_COL.paint,true);
  button(1.10,pz-0.075,$imports.EV_COL.paint,false); button(1.10,pz,$imports.EV_COL.paint,false); button(1.10,pz+0.085,0xe28a6a,false);
  K.unframe();
  /* 轿壁的碰撞：人只能在 1.5 × 1.4 米的轿厢里面走 */
  var hw=s.carW/2-s.carWall, back=s.carCZ-s.carD/2+s.carWall+dz, fr=-0.5-s.carWall-0.01;
  liftSolid(c,cx,cz,rot,-1.6,-hw,back-1,0);
  liftSolid(c,cx,cz,rot,hw,1.6,back-1,0);
  liftSolid(c,cx,cz,rot,-1.6,1.6,back-1,back);
  if(annex){                                                      /* 楼层门后那节：前壁中间留门洞 */
    liftSolid(c,cx,cz,rot,-1.6,-LIFT_DOOR_HALF,fr,-0.5);
    liftSolid(c,cx,cz,rot,LIFT_DOOR_HALF,1.6,fr,-0.5);
  }else liftSolid(c,cx,cz,rot,-1.6,1.6,fr,-0.5);
}
/* 电梯厅门后：门洞里那一段（两侧护板、地面），再往里是整节轿厢（和轿厢房间里的一样，可以走进去）。
   以前这里只画看得见的一节（LIFT_GLIMPSE），人进不去 */
function liftShaft(c,x,y,cx,cz){
  var K=c.K, d=liftOpenSide(c.R,x,y); if(!d) return;
  var G=LIFT_GLIMPSE, s=$imports.EV_SPEC, DTOP=s.doorH+0.02, F=liftAnnexFrame(c.R,x,y);
  K.frame(cx,cz,Math.atan2(d[0],d[1]));
  K.box('plastic',0,0.006,(G.front-0.5)/2,0.98,0.012,G.front+0.5,$imports.EV_COL.rubber,0.9);          /* 门洞地面（两道门之间） */
  [-1,1].forEach(function(sx){                                    /* 门洞两侧护板：墙格里那段到门顶 */
    K.box('metal',sx*0.488,DTOP/2,(G.front-0.5)/2,0.016,DTOP,G.front+0.5,$imports.EV_COL.steelHi,0.92);
  });
  K.unframe();
  liftCabinBody(c,x,y,cx,cz,F,true);
  /* 轿门：和层门一起开关（LiftDoors.tick） */
  if(c.view&&c.view.liftCabinLeaves)c.view.liftCabinLeaves(c,cx,cz,F.rot,s.carCZ+s.carD/2+0.03+F.dz);
}
/* 门旁边墙上的外呼盒（上下两个按钮、灯圈） */
function liftHallPlate(c,x,y,cx,cz){
  var d=liftOpenSide(c.R,x,y); if(!d) return;
  var K=c.K, P=(0,$imports.buildElevatorPrefab)({view:'landing',label:(c.R.floor||1)+'F'});
  K.frame(cx,cz,Math.atan2(d[0],d[1]));
  liftOnWall(K,P,/^(hallPlate|hallUp|hallDown)/);
  K.unframe();
}
/* roomDecor 调用：楼层走廊画井道里的轿厢，轿厢房间画整节轿厢 */
function liftDecor(c){
  var R=c.R, x, y;
  for(y=0;y<R.rows;y++) for(x=0;x<R.cols;x++){
    if(R.grid[y][x]!=='J') continue;
    if(R.host==='lift') liftCabinBody(c,x,y,c.CX(x),c.CZ(y));
    else if(R.host==='teach'||R.host==='lab'){ liftShaft(c,x,y,c.CX(x),c.CZ(y)); liftHallPlate(c,x,y,c.CX(x),c.CZ(y)); }
  }
}

/* ---------- 层门动画 ---------- */

/* @module-exports */
GameModules.publish("game3d/js/content/lift-recipe.js",{
"LIFT_DOOR_Z":{get:function(){return LIFT_DOOR_Z;},set:function($value){LIFT_DOOR_Z=$value;}},
"LIFT_DOOR_HALF":{get:function(){return LIFT_DOOR_HALF;},set:function($value){LIFT_DOOR_HALF=$value;}},
"LIFT_GLIMPSE":{get:function(){return LIFT_GLIMPSE;},set:function($value){LIFT_GLIMPSE=$value;}},
"LIFT_ON_WALL":{get:function(){return LIFT_ON_WALL;},set:function($value){LIFT_ON_WALL=$value;}},
"LIFT_PANEL_BTN":{get:function(){return LIFT_PANEL_BTN;},set:function($value){LIFT_PANEL_BTN=$value;}},
"liftLow":{get:function(){return liftLow;},set:function($value){liftLow=$value;}},
"liftTiny":{get:function(){return liftTiny;},set:function($value){liftTiny=$value;}},
"liftMat":{get:function(){return liftMat;},set:function($value){liftMat=$value;}},
"liftEmit":{get:function(){return liftEmit;},set:function($value){liftEmit=$value;}},
"liftOpenSide":{get:function(){return liftOpenSide;},set:function($value){liftOpenSide=$value;}},
"liftToRoom":{get:function(){return liftToRoom;},set:function($value){liftToRoom=$value;}},
"liftSolid":{get:function(){return liftSolid;},set:function($value){liftSolid=$value;}},
"liftLeaf":{get:function(){return liftLeaf;},set:function($value){liftLeaf=$value;}},
"liftOnWall":{get:function(){return liftOnWall;},set:function($value){liftOnWall=$value;}},
"liftLanding":{get:function(){return liftLanding;},set:function($value){liftLanding=$value;}},
"liftCabinFrame":{get:function(){return liftCabinFrame;},set:function($value){liftCabinFrame=$value;}},
"liftAnnexFrame":{get:function(){return liftAnnexFrame;},set:function($value){liftAnnexFrame=$value;}},
"liftCabin":{get:function(){return liftCabin;},set:function($value){liftCabin=$value;}},
"liftCabinBody":{get:function(){return liftCabinBody;},set:function($value){liftCabinBody=$value;}},
"liftShaft":{get:function(){return liftShaft;},set:function($value){liftShaft=$value;}},
"liftHallPlate":{get:function(){return liftHallPlate;},set:function($value){liftHallPlate=$value;}},
"liftDecor":{get:function(){return liftDecor;},set:function($value){liftDecor=$value;}}
});
})(GameModules.imports("game3d/js/content/lift-recipe.js"));
