/* 里世界 3D · 电梯预制件 v2（无机房乘客电梯；按真实结构比例，带倒角/圆管/内凹面板）
   纯数据生成器：不碰 THREE、不碰 DOM。
   每个部件是 {kind, part, type:'box'|'cyl'|'rod', ...}：
     box：x,y,z 中心 + sx,sy,sz 尺寸
     cyl：x,y,z 底面圆心 + rb,rt,h,nseg（锥台/圆柱）
     rod：x0,y0,z0 → x1,y1,z1 + r0,r1,nseg（任意方向圆管）
   游戏里 box→K.box、cyl→K.cyl、rod→K.rod；离线 tools/render_elevator.mjs 自己光栅化。

   坐标：原点在井道中心、1F 地面；+z 朝电梯厅，+y 向上，单位米。
   竖向：底坑 −1.4 → 地面 0 → 轿厢 0…2.3 → 机房梁 3.33 → 井道顶 4.35。
   横向：井道净空 2.0×2.0；轿厢 1.6×1.5、前脸 0.80、后背 −0.70；
        对重 0.5×0.28×1.2 在轿厢正后方 z=−0.85；层门 z=0.94，轿门 z=0.85，中缝 4mm。 */
'use strict';

var EV_SPEC={
  shaftW:2.2, shaftD:2.2, wallT:0.10,
  carW:1.6, carD:1.5, carH:2.3, carCZ:0.05,
  carWall:0.05,
  doorW:0.9, doorH:2.1, doorT:0.04, doorGap:0.004,
  sillD:0.09, sillH:0.06,
  floorH:3.2, shaftTop:4.35, pitDepth:1.4,
  cwtW:0.5, cwtD:0.28, cwtH:1.2, cwtZ:-0.85,
  railW:0.09, railD:0.06, railT:0.014,
  machineY:3.45
};

var EV_COL={
  /* 轿厢里的灯比走廊亮得多，原来的高亮灰一照就发白。
     这里整体压暗一档、拉开钢面与烤漆门的层次，读起来才像不锈钢 + 哑光烤漆 */
  steel:0x98a3a2, steelDark:0x5f6b6a, steelHi:0xc2ccca,
  paint:0xdbe0de, paintDark:0xc2c8c6, paintDeep:0x9aa09e,
  rubber:0x1a1f20, rail:0x1f2527, railHi:0x333b3e,
  concrete:0x83837f, concreteDark:0x6b6b64,
  lamp:0xeef2ec, glass:0x0f1416, led:0xffb257, ledGreen:0x7fe0a8, cable:0x171d1f,
  brass:0xb8975c
};

function evBox(a,kind,part,x,y,z,sx,sy,sz,col){
  a.push({type:'box',kind:kind,part:part,x:x,y:y,z:z,sx:sx,sy:sy,sz:sz,col:col});
}
/* 圆柱/锥台：底面圆心 (x,y,z)，高 h（沿 +y） */
function evCyl(a,kind,part,x,y,z,rb,rt,h,nseg,col){
  a.push({type:'cyl',kind:kind,part:part,x:x,y:y,z:z,rb:rb,rt:rt,h:h,nseg:nseg||16,col:col});
}
/* 圆管：任意两点之间 */
function evRod(a,kind,part,x0,y0,z0,x1,y1,z1,r0,r1,nseg,col){
  a.push({type:'rod',kind:kind,part:part,x0:x0,y0:y0,z0:z0,x1:x1,y1:y1,z1:z1,r0:r0,r1:r1,nseg:nseg||8,col:col});
}
/* 带倒角的板：中间主体 + 四周一圈 45° 斜台（用两级台阶近似，避免纯方盒的硬边） */
function evPlate(a,kind,part,x,y,z,sx,sy,sz,col,chamfer){
  var c=chamfer||0.012;
  evBox(a,kind,part,x,y,z,sx,sy,sz,col);
  evBox(a,kind,part+'_c1',x,y,z,sx-c*1.2,sy+c*0.9,sz-c*1.2,col);
  evBox(a,kind,part+'_c2',x,y,z,sx-c*2.4,sy+c*1.7,sz-c*2.4,col);
}
/* 一排螺栓（小圆柱），沿 x 或 z 排列 */
function evBolts(a,kind,part,n,ax,ay,az,dx,dy,dz,r,col){
  for(var i=0;i<n;i++) evCyl(a,kind,part+i,ax+dx*i,ay+dy*i,az+dz*i,r,r,0.012,10,col);
}

/* ---- 井道：混凝土壁（带壁厚端面）、门口过梁、底坑、机房梁 ---- */
function evShaft(b,s){
  var top=s.shaftTop, bot=-s.pitDepth, h=top-bot, yc=(top+bot)/2;
  var ox=s.shaftW/2, oz=s.shaftD/2, t=s.wallT;
  evBox(b,'shaft','shaftWallBack',0,yc,-oz+t/2,s.shaftW,h,t,EV_COL.concrete);
  evBox(b,'shaft','shaftWallL',-ox+t/2,yc,0,t,h,s.shaftD,EV_COL.concreteDark);
  evBox(b,'shaft','shaftWallR', ox-t/2,yc,0,t,h,s.shaftD,EV_COL.concreteDark);
  var side=(s.shaftW-s.doorW)/2;
  evBox(b,'shaft','shaftWallFrontL',-(s.doorW/2+side/2),yc, oz-t/2,side,h,t,EV_COL.concrete);
  evBox(b,'shaft','shaftWallFrontR', (s.doorW/2+side/2),yc, oz-t/2,side,h,t,EV_COL.concrete);
  var lintelH=top-s.doorH;
  evBox(b,'shaft','shaftLintel',0,s.doorH+lintelH/2, oz-t/2,s.doorW,lintelH,t,EV_COL.concrete);
  /* 门洞内衬：不锈钢护边，带 15mm 折边（这是门口看着不像"挖了个洞"的关键） */
  ['L','R'].forEach(function(sd,i){
    var sx=i?1:-1;
    evBox(b,'landing','doorReveal'+sd,sx*(s.doorW/2+0.008),s.doorH/2, oz-t/2,0.016,s.doorH,t*0.9,EV_COL.steel);
  });
  evBox(b,'landing','doorRevealT',0,s.doorH+0.008, oz-t/2,s.doorW,0.016,t*0.9,EV_COL.steel);
  evBox(b,'shaft','pitFloor',0,bot+0.05,0,s.shaftW,0.1,s.shaftD,EV_COL.concreteDark);
  /* 机房梁：工字梁（上翼缘 + 腹板 + 下翼缘） */
  var by=s.machineY-0.12;
  evBox(b,'shaft','machineBeamTop',0,by+0.07,-0.35,s.shaftW-2*t,0.04,0.72,EV_COL.steelDark);
  evBox(b,'shaft','machineBeamWeb',0,by,-0.35,s.shaftW-2*t,0.10,0.10,EV_COL.steelDark);
  evBox(b,'shaft','machineBeamBot',0,by-0.07,-0.35,s.shaftW-2*t,0.04,0.72,EV_COL.steelDark);
}

/* ---- 导轨：T 型（腹板 + 轨头 + 压板 + 螺栓），支架每 1.5 米 ---- */
function evRails(b,s){
  var top=s.shaftTop, bot=-s.pitDepth, H=top-bot, yc=(top+bot)/2, i, k;
  var carRailZ=-0.75, xs=[-0.86,0.86];
  for(i=0;i<2;i++){
    evBox(b,'shaft','carRailWeb'+i,xs[i],yc,carRailZ,s.railT,H,s.railD,EV_COL.rail);
    evBox(b,'shaft','carRailHead'+i,xs[i],yc,carRailZ+s.railD/2,s.railW,H,0.016,EV_COL.railHi);
    /* 轨头两侧压板 */
    evBox(b,'shaft','carRailClipT'+i,xs[i],yc,carRailZ+s.railD/2+0.012,s.railW,0.02,0.012,EV_COL.steelDark);
  }
  for(i=0;i<2;i++){
    var xc=-0.30+i*0.60;
    evBox(b,'shaft','cwtRailWeb'+i,xc,yc,-0.88,s.railT,H,s.railD,EV_COL.rail);
    evBox(b,'shaft','cwtRailHead'+i,xc,yc,-0.88+s.railD/2,s.railW,H,0.016,EV_COL.railHi);
  }
  for(k=0;k<4;k++){
    var sy=-s.pitDepth+0.9+k*1.5;
    for(i=0;i<2;i++){
      /* 支架：横臂 + 斜撑（从导轨接到井道壁，长度控制在 0.25 米内，不会拉出一根长线） */
      evBox(b,'shaft','railBracket'+k+'_'+i,xs[i]+(i?0.14:-0.14),sy,carRailZ,0.30,0.05,0.05,EV_COL.steelDark);
      evRod(b,'shaft','railBrace'+k+'_'+i,xs[i],sy+0.14,carRailZ+0.05,xs[i],sy,carRailZ-0.22,0.008,0.008,6,EV_COL.steelDark);
      evBolts(b,'shaft','railBolt'+k+'_'+i,2,xs[i]+(i?0.06:-0.06),sy,carRailZ+0.02,0.0,0.0,0.0,0.008,EV_COL.steelHi);
    }
    evBox(b,'shaft','cwtBracket'+k,0,sy,-0.88,0.74,0.05,0.05,EV_COL.steelDark);
  }
}

/* ---- 轿厢：底、顶、四面壁（带内凹护板）、框架、门机 ---- */
function evCar(b,s){
  var W=s.carW, D=s.carD, H=s.carH, t=s.carWall, cz=s.carCZ;
  var front=cz+D/2, back=cz-D/2, i;
  /* 轿底：结构板 + 防滑地板（带凹槽）+ 四周踢脚 */
  evBox(b,'car','carSillPlate',0,0.03,cz,W,0.06,D,EV_COL.steelDark);
  evBox(b,'car','carFloor',0,0.075,cz,W-0.06,0.03,D-0.06,EV_COL.rubber);
  for(i=0;i<4;i++){
    var fz=-0.5+i*0.32;
    evBox(b,'car','floorGroove'+i,0,0.092,cz+fz,W-0.16,0.004,0.02,EV_COL.rail);
  }
  evBox(b,'car','floorBorderF',0,0.094,front-0.05,W-0.06,0.005,0.03,EV_COL.steelHi);
  /* 轿顶：承重板 + 灯片 + 边框 + 通风槽 + 检修口 */
  evBox(b,'car','carRoof',0,H-0.04,cz,W,0.08,D,EV_COL.steel);
  evBox(b,'car','carRoofFrame',0,H-0.075,cz,W-0.04,0.02,D-0.04,EV_COL.steelDark);
  evBox(b,'car','carLamp',0,H-0.086,cz+0.06,0.62,0.02,0.46,EV_COL.lamp);
  evBox(b,'car','carLampTrim',0,H-0.083,cz+0.06,0.68,0.012,0.52,EV_COL.steelDark);
  for(i=0;i<5;i++) evBox(b,'car','ventSlot'+i,-0.18+i*0.09,H-0.096,cz-0.42,0.05,0.02,0.16,EV_COL.rail);
  evBox(b,'car','carVent',0,H-0.098,cz-0.42,0.52,0.03,0.20,EV_COL.steelDark);
  /* 后壁 + 两侧壁：外层板 + 内凹护板（中央下凹 8mm，边缘有收口） */
  evBox(b,'car','carBackWall',0,H/2,back+t/2,W,H,t,EV_COL.steel);
  evBox(b,'car','carBackPanel',0,1.30,back+t+0.006,W-0.18,1.75,0.012,EV_COL.steelHi);
  evBox(b,'car','carBackSeam',0,0.40,back+t+0.004,W-0.10,0.012,0.010,EV_COL.steelDark);
  evBox(b,'car','carSideWallL',-W/2+t/2,H/2,cz,t,H,D,EV_COL.steel);
  evBox(b,'car','carSideWallR', W/2-t/2,H/2,cz,t,H,D,EV_COL.steel);
  evBox(b,'car','carSidePanelL',-W/2+t+0.006,1.30,cz,0.012,1.75,D-0.20,EV_COL.steelHi);
  evBox(b,'car','carSidePanelR', W/2-t-0.006,1.30,cz,0.012,1.75,D-0.20,EV_COL.steelHi);
  /* 前壁：门洞两侧 + 过梁（带回风口） */
  var side=(W-s.doorW)/2;
  evBox(b,'car','carFrontL',-(s.doorW/2+side/2),H/2,front-t/2,side,H,t,EV_COL.steel);
  evBox(b,'car','carFrontR', (s.doorW/2+side/2),H/2,front-t/2,side,H,t,EV_COL.steel);
  var lintelH=H-s.doorH;
  evBox(b,'car','carLintel',0,s.doorH+lintelH/2,front-t/2,s.doorW,lintelH,t,EV_COL.steel);
  /* 轿门：两扇，每扇「外框 + 内凹板 + 竖向压筋」——不是一块平板 */
  var leafW=(s.doorW-s.doorGap)/2, dz=front+0.03;
  [-1,1].forEach(function(sg){
    var nm=sg<0?'doorLeft':'doorRight';
    var lx=sg*(leafW/2+s.doorGap/2);
    evBox(b,'car',nm,lx,s.doorH/2,dz,leafW,s.doorH,s.doorT,EV_COL.paint);
    evBox(b,'car',nm+'_inset',lx,s.doorH/2,dz+0.022,leafW-0.09,s.doorH-0.16,0.006,EV_COL.paintDeep);
    evBox(b,'car',nm+'_edgeL',lx-sg*(leafW/2-0.012),s.doorH/2,dz+0.018,0.012,s.doorH-0.06,0.010,EV_COL.steelDark);
    evBox(b,'car',nm+'_ribTop',lx,1.86,dz+0.026,leafW-0.12,0.02,0.006,EV_COL.paintDark);
    evBox(b,'car',nm+'_ribBot',lx,0.32,dz+0.026,leafW-0.12,0.02,0.006,EV_COL.paintDark);
  });
  /* 框架：上下梁、四根立柱、拉杆、导靴 */
  evBox(b,'shaft','carFrameTop',0,H+0.10,cz,W+0.16,0.12,0.12,EV_COL.steelDark);
  evBox(b,'shaft','carFrameBottom',0,-0.06,cz,W+0.16,0.12,0.12,EV_COL.steelDark);
  for(i=0;i<2;i++){
    var sx=i?1:-1;
    evBox(b,'shaft','carFramePost'+(i?1:0),sx*(W/2+0.05),H/2,cz,0.08,H,0.08,EV_COL.steelDark);
    evBox(b,'shaft','carFrameTie'+(i?1:0),sx*(W/2+0.05),H+0.10,cz-0.45,0.06,0.06,0.9,EV_COL.steelDark);
    evCyl(b,'shaft','carGuideShoe'+(i?1:0),sx*(W/2+0.02),-0.02,-0.75,0.05,0.05,0.10,10,EV_COL.railHi);
  }
  /* 门机：底座 + 导轨 + 电机（圆筒）+ 皮带轮 + 皮带 */
  evBox(b,'shaft','doorOperatorBase',0,H+0.16,front-0.12,W*0.72,0.06,0.16,EV_COL.steelDark);
  evBox(b,'shaft','doorOperatorRail',0,H+0.24,front-0.06,W*0.62,0.03,0.03,EV_COL.steelHi);
  evCyl(b,'shaft','doorOperatorMotor',-0.34,H+0.22,front-0.12,0.075,0.075,0.17,14,EV_COL.steel);
  evCyl(b,'shaft','doorOperatorPulley',0.30,H+0.24,front-0.12,0.05,0.05,0.03,14,EV_COL.steelDark);
  evBox(b,'shaft','doorOperatorBelt',0,H+0.30,front-0.12,0.62,0.008,0.02,EV_COL.cable);
  evBox(b,'shaft','carTopGuard',0,H+0.62,back+0.06,W,0.04,0.03,EV_COL.steelDark);
}

/* ---- 层门（每层一套）：门套（带 45° 收口）、地坎（带凹槽）、双扇层门 ---- */
function evLanding(b,s,level){
  var z=0.94, leafW=(s.doorW-s.doorGap)/2, y=level*s.floorH, i;
  /* 门套：左右立柱 + 上沿，各带折边与螺栓 */
  [-1,1].forEach(function(sg){
    var jx=sg*(s.doorW/2+0.045);
    evBox(b,'landing','doorJamb'+(sg<0?'L':'R'),jx,y+s.doorH/2+0.02,z+0.05,0.09,s.doorH+0.09,0.11,EV_COL.steel);
    evBox(b,'landing','doorJambFace'+(sg<0?'L':'R'),jx-sg*0.052,y+s.doorH/2+0.02,z+0.10,0.014,s.doorH+0.05,0.012,EV_COL.steelHi);
    evBolts(b,'landing','jambBolt'+(sg<0?'L':'R'),3,jx,y+0.35,z+0.108,0,0.62,0,0.008,EV_COL.steelDark);
  });
  evBox(b,'landing','doorJambTop',0,y+s.doorH+0.06,z+0.05,s.doorW+0.19,0.09,0.11,EV_COL.steel);
  evBox(b,'landing','doorJambTopFace',0,y+s.doorH+0.02,z+0.10,s.doorW+0.15,0.012,0.012,EV_COL.steelHi);
  /* 地坎：底座 + 两条导槽（门在槽里滑，不是浮在地上） */
  evBox(b,'landing','sill',0,y+s.sillH/2,z+0.01,s.doorW+0.12,s.sillH,s.sillD,EV_COL.steelHi);
  evBox(b,'landing','sillGrooveL',-(s.doorW/4),y+s.sillH+0.001,z+0.01,s.doorW/2-0.02,0.008,0.022,EV_COL.rail);
  evBox(b,'landing','sillGrooveR', (s.doorW/4),y+s.sillH+0.001,z+0.01,s.doorW/2-0.02,0.008,0.022,EV_COL.rail);
  evBox(b,'landing','sillRubber',0,y+0.012,z+0.055,s.doorW+0.10,0.024,0.02,EV_COL.rubber);
  /* 层门：外框 + 内凹 + 压筋 + 门边密封条 */
  [-1,1].forEach(function(sg){
    var nm=sg<0?'landingDoorLeft':'landingDoorRight';
    var lx=sg*(leafW/2+s.doorGap/2);
    evBox(b,'landing',nm,lx,y+s.doorH/2,z,leafW,s.doorH,s.doorT,EV_COL.paint);
    evBox(b,'landing',nm+'_inset',lx,y+s.doorH/2,z-0.022,leafW-0.09,s.doorH-0.16,0.006,EV_COL.paintDeep);
    evBox(b,'landing',nm+'_edge',lx-sg*(leafW/2-0.010),y+s.doorH/2,z-0.018,0.010,s.doorH-0.06,0.010,EV_COL.steelDark);
    evBox(b,'landing',nm+'_seal',lx-sg*(leafW/2-0.004),y+s.doorH/2,z+0.021,0.006,s.doorH-0.03,0.004,EV_COL.rubber);
    evBox(b,'landing',nm+'_ribTop',lx,y+1.86,z-0.026,leafW-0.12,0.02,0.006,EV_COL.paintDark);
    evBox(b,'landing',nm+'_ribBot',lx,y+0.32,z-0.026,leafW-0.12,0.02,0.006,EV_COL.paintDark);
  });
}

/* ---- 电梯厅：外呼按钮（带灯圈）、楼层显示屏（带边框与两位数码管）、方向灯、到站灯 ---- */
function evHall(b,s,level,label){
  var y=level*s.floorH, x=s.doorW/2+0.32, z=1.04;
  evBox(b,'landing','hallPlate',x,y+1.20,z,0.13,0.26,0.03,EV_COL.steel);
  evBox(b,'landing','hallPlateFace',x,y+1.20,z+0.018,0.11,0.24,0.008,EV_COL.steelHi);
  /* 上下按钮：按钮座（圆柱）+ 键帽 + 灯圈 */
  [[1,'hallUp',y+1.275],[-1,'hallDown',y+1.125]].forEach(function(it){
    evCyl(b,'hall',it[1]+'Base',x,it[2],z+0.024,0.026,0.026,0.010,16,EV_COL.steelDark);
    evCyl(b,'hall',it[1],x,it[2],z+0.030,0.020,0.020,0.012,16,EV_COL.paint);
    evCyl(b,'hall',it[1]+'Led',x,it[2],z+0.040,0.013,0.013,0.004,14,EV_COL.led);
  });
  /* 显示屏：黑镜面板 + 不锈钢边框 + 两位七段数字（按当前楼层生成，居中）
     左 0.055 / 右 0.055 对称排布；label 形如 '3F'，取第一个字符做楼层数字 */
  evBox(b,'landing','displayFrame',0,y+s.doorH+0.20,z+0.045,0.54,0.21,0.035,EV_COL.steel);
  evBox(b,'landing','displayPanel',0,y+s.doorH+0.20,z+0.064,0.46,0.16,0.012,EV_COL.glass);
  var SEGP={'1':[[0,0.030],[0.010,-0.030]],'2':[[-0.010,0.030],[0.010,0.030],[-0.010,0.006],[0.010,0.006],[-0.010,-0.030],[0.010,-0.030]],
            '3':[[0.010,0.030],[0.010,0.006],[0.010,-0.030]],'4':[[-0.010,0.030],[0.010,0.030],[0.010,0.006]],
            '5':[[-0.010,0.030],[0.010,0.030],[-0.010,0.006],[0.010,-0.030]],
            'F':[[-0.010,0.030],[0.010,0.030],[-0.010,0.006]]};
  function digit(cx0,ch){
    var pat=SEGP[ch]||SEGP['F'], i, p;
    for(i=0;i<pat.length;i++){
      p=pat[i];
      evBox(b,'hall','seg_'+cx0+'_'+i,cx0+p[0],y+s.doorH+0.20+p[1],z+0.072,0.016,0.007,0.004,EV_COL.led);
    }
  }
  digit(-0.055,(label||'1')[0]);
  digit(0.055,'F');
  /* 方向灯：左右各一组上下箭头，完全对称 */
  [-1,1].forEach(function(sg){
    evBox(b,'hall','dirUp'+sg,sg*0.20,y+s.doorH+0.232,z+0.072,0.030,0.020,0.004,EV_COL.ledGreen);
    evBox(b,'hall','dirDn'+sg,sg*0.20,y+s.doorH+0.168,z+0.072,0.030,0.020,0.004,EV_COL.ledGreen);
  });
  /* 到站灯：居中横条（原来是圆柱，透视下容易看成偏一边） */
  evBox(b,'hall','hallLantern',0,y+s.doorH+0.355,z+0.03,0.54,0.055,0.030,EV_COL.led);
  evBox(b,'hall','hallLanternCap',0,y+s.doorH+0.392,z+0.03,0.56,0.018,0.036,EV_COL.steelDark);
}

/* ---- 轿厢内装：操纵盘（圆钮 + 灯圈 + 铭牌）、扶手（圆管 + 支架）、轿内屏 ---- */
function evCarFittings(b,s){
  var W=s.carW, D=s.carD, H=s.carH, cz=s.carCZ, front=cz+D/2;
  var px=W/2-0.055, pz=front-0.60, i;
  /* 操纵盘：底板 + 内凹面板 + 上沿铭牌 */
  evBox(b,'car','carPanelPlate',px,1.33,pz,0.030,1.24,0.28,EV_COL.steel);
  evBox(b,'car','carPanelFace',px-0.018,1.33,pz,0.008,1.16,0.24,EV_COL.steelHi);
  evBox(b,'car','carPanelBrand',px-0.022,1.86,pz,0.004,0.05,0.14,EV_COL.steelDark);
  /* 5 个楼层按钮：座圈 + 键帽 + 灯点（圆柱，不是方块） */
  for(i=0;i<5;i++){
    var by=1.74-i*0.105;
    evCyl(b,'car','floorButton'+i,px-0.026,by,pz,0.024,0.024,0.010,16,EV_COL.steelDark);
    evCyl(b,'car','floorButtonCap'+i,px-0.026,by,pz+0.010,0.018,0.018,0.012,16,EV_COL.paint);
    evCyl(b,'car','floorLed'+i,px-0.026,by,pz+0.022,0.008,0.008,0.003,12,EV_COL.led);
  }
  evBox(b,'car','floorButtons',px-0.026,1.34,pz,0.024,0.56,0.11,EV_COL.steelDark);
  /* 开门 / 关门 / 报警：三个圆钮 + 图标条 */
  [[-0.075,'doorOpenButton',EV_COL.paint],[0,'doorCloseButton',EV_COL.paint],[0.085,'alarmButton',0xe28a6a]].forEach(function(it){
    var bz=pz+it[0];
    evCyl(b,'car',it[1]+'Base',px-0.026,1.10,bz,0.022,0.022,0.010,14,EV_COL.steelDark);
    evCyl(b,'car',it[1],px-0.026,1.10,bz+0.010,0.016,0.016,0.012,14,it[2]);
  });
  /* 轿内显示屏 + 方向灯（门上过梁内侧） */
  evBox(b,'car','carDisplayFrame',0,H-0.24,front-0.10,0.36,0.14,0.03,EV_COL.steel);
  evBox(b,'car','carDisplayPanel',0,H-0.24,front-0.082,0.30,0.10,0.012,EV_COL.glass);
  evBox(b,'car','display',-0.06,H-0.24,front-0.074,0.11,0.07,0.006,EV_COL.led);
  evBox(b,'car','directionLamp',0.10,H-0.24,front-0.074,0.07,0.05,0.006,EV_COL.ledGreen);
  /* 扶手：三面圆管 + 每个支架两头有座 */
  var hr=0.019, hy=0.92;
  evRod(b,'car','handrailBack',-W/2+0.14,hy,cz-D/2+0.085,W/2-0.14,hy,cz-D/2+0.085,hr,hr,10,EV_COL.steelHi);
  evRod(b,'car','handrailL',-W/2+0.085,hy,cz-D/2+0.14,-W/2+0.085,hy,cz+D/2-0.16,hr,hr,10,EV_COL.steelHi);
  evRod(b,'car','handrailR', W/2-0.085,hy,cz-D/2+0.14, W/2-0.085,hy,cz+D/2-0.16,hr,hr,10,EV_COL.steelHi);
  [[-0.62,'B1'],[0.02,'B2'],[0.62,'B3']].forEach(function(it){
    evCyl(b,'car','handrailBracket'+it[1],it[0],hy,cz-D/2+0.055,0.012,0.012,0.03,8,EV_COL.steelDark);
  });
}

/* ---- 机械：对重、曳引机、钢丝绳、导向轮、限速器、缓冲器、控制柜、随行电缆 ---- */
function evMachine(b,s){
  var y=s.machineY, i;
  /* 对重：框架（四角立柱 + 上下压板）+ 8 块配重（每块两侧露出缝）+ 导靴 */
  evBox(b,'shaft','cwtFrame',0,0.66,s.cwtZ,s.cwtW+0.02,s.cwtH+0.12,s.cwtD+0.02,EV_COL.steelDark);
  for(i=0;i<8;i++){
    evBox(b,'shaft','cwtBlock'+i,0,0.13+i*0.14,s.cwtZ,s.cwtW,0.12,s.cwtD,EV_COL.rail);
    evBox(b,'shaft','cwtSeam'+i,0,0.20+i*0.14,s.cwtZ,s.cwtW+0.006,0.006,s.cwtD+0.006,EV_COL.railHi);
  }
  evBox(b,'shaft','cwtTopPlate',0,1.30,s.cwtZ,s.cwtW+0.04,0.03,s.cwtD+0.04,EV_COL.steelHi);
  [-1,1].forEach(function(sg){ evCyl(b,'shaft','cwtShoe'+(sg<0?'L':'R'),sg*(s.cwtW/2),0.06,s.cwtZ,0.03,0.03,0.12,8,EV_COL.railHi); });
  /* 曳引机：机座 + 机身（圆筒）+ 端盖 + 制动器 + 曳引轮（带绳槽）+ 导向轮 */
  evBox(b,'shaft','machineBase',0,y+0.02,-0.35,0.62,0.06,0.50,EV_COL.steelDark);
  evRod(b,'shaft','tractionMachine',-0.36,y+0.20,-0.35,0.30,y+0.20,-0.35,0.19,0.19,16,EV_COL.steel);
  evCyl(b,'shaft','machineEndCap',0.30,y+0.01,-0.35,0.16,0.16,0.02,16,EV_COL.steelDark);
  evBox(b,'shaft','machineBrake',-0.30,y+0.40,-0.35,0.14,0.10,0.22,EV_COL.steelDark);
  evCyl(b,'shaft','tractionSheave',0,y+0.30,-0.35,0.17,0.17,0.13,18,EV_COL.steelDark);
  for(i=0;i<6;i++) evBox(b,'shaft','sheaveGroove'+i,-0.10+i*0.04,y+0.30,-0.35,0.012,0.18,0.135,EV_COL.cable);
  evCyl(b,'shaft','divertSheave',0,y+0.14,-0.86,0.13,0.13,0.09,16,EV_COL.steelDark);
  evBox(b,'shaft','divertBracket',0,y+0.02,-0.86,0.30,0.05,0.06,EV_COL.steelDark);
  /* 钢丝绳：6 根，竖直段 + 上下绳头（锥套） */
  for(i=0;i<6;i++){
    var rx=-0.125+i*0.05;
    evRod(b,'shaft','ropeCar'+i,rx,y+0.28,-0.02,rx,2.44,-0.02,0.008,0.008,6,EV_COL.cable);
    evRod(b,'shaft','ropeCwt'+i,rx,y+0.12,-0.86,rx,1.32,-0.86,0.008,0.008,6,EV_COL.cable);
    evCyl(b,'shaft','ropeSocketC'+i,rx,2.40,-0.02,0.016,0.016,0.06,8,EV_COL.steelDark);
    evCyl(b,'shaft','ropeSocketW'+i,rx,1.28,-0.86,0.016,0.016,0.06,8,EV_COL.steelDark);
  }
  /* 限速器（圆轮 + 机座 + 绳） */
  evBox(b,'shaft','governorBase',0.62,y-0.02,0.45,0.18,0.16,0.18,EV_COL.steelDark);
  evCyl(b,'shaft','governor',0.62,y+0.14,0.45,0.065,0.065,0.05,14,EV_COL.steel);
  evRod(b,'shaft','governorRope',0.62,y+0.10,0.52,0.62,1.20,0.52,0.008,0.008,6,EV_COL.cable);
  /* 缓冲器：缸体（圆柱）+ 活塞杆 + 弹簧圈 + 底板 */
  [[-0.45,'bufferCarL'],[0.45,'bufferCarR'],[0,'bufferCwt']].forEach(function(it){
    var by=-s.pitDepth+0.14+(it[1]==='bufferCwt'?0.02:0);
    evCyl(b,'shaft',it[1],it[0],by,-(it[1]==='bufferCwt'?s.cwtZ*-1:0.50)*1,0.075,0.075,0.42,12,EV_COL.rail);
    evCyl(b,'shaft',it[1]+'Rod',it[0],by+0.42,-(it[1]==='bufferCwt'?s.cwtZ*-1:0.50)*1,0.035,0.035,0.20,10,EV_COL.steelHi);
    evCyl(b,'shaft',it[1]+'Spring',it[0],by+0.30,-(it[1]==='bufferCwt'?s.cwtZ*-1:0.50)*1,0.095,0.095,0.06,12,EV_COL.steelDark);
    evCyl(b,'shaft',it[1]+'Base',it[0],-s.pitDepth+0.10,-(it[1]==='bufferCwt'?s.cwtZ*-1:0.50)*1,0.13,0.13,0.05,12,EV_COL.steelDark);
  });
  /* 控制柜：柜体 + 柜门缝 + 铰链 + 把手 + 散热栅（薄板） */
  evBox(b,'shaft','controlCabinet',1.30,0.80,0.45,0.30,1.60,0.60,EV_COL.steel);
  evBox(b,'shaft','controlDoor',1.145,0.80,0.45,0.012,1.50,0.52,EV_COL.steelHi);
  evBox(b,'shaft','controlPanel',1.135,0.98,0.45,0.008,0.46,0.38,EV_COL.steelDark);
  for(i=0;i<5;i++) evBox(b,'shaft','controlLouver'+i,1.135,0.28+i*0.05,0.45,0.006,0.02,0.30,EV_COL.rail);
  evCyl(b,'shaft','controlHandle',1.135,0.80,0.72,0.012,0.012,0.10,8,EV_COL.brass);
  /* 随行电缆：从轿底到井道壁的一段垂弧（用圆管折线近似） */
  var cx0=-0.72, cy0=2.02, cz0=-0.95;
  for(i=0;i<6;i++){
    var t0=i/6, t1=(i+1)/6;
    var y0=cy0-t0*1.7, y1=cy0-t1*1.7;
    var zz0=cz0+Math.sin(t0*2.6)*0.10, zz1=cz0+Math.sin(t1*2.6)*0.10;
    evRod(b,'shaft','travelCable'+i,cx0,y0,zz0,cx0,y1,zz1,0.016,0.016,6,EV_COL.cable);
  }
}

function buildElevatorPrefab(opts){
  opts=opts||{};
  var spec=Object.assign({},EV_SPEC,opts.spec||{});
  var view=opts.view||'landing';
  var boxes=[];
  if(view==='all'||view==='shaft'){ evShaft(boxes,spec); evRails(boxes,spec); }
  if(view==='all'||view==='car'){ evCar(boxes,spec); evCarFittings(boxes,spec); }
  if(view==='all'||view==='car'||view==='landing'){ evLanding(boxes,spec,0); evHall(boxes,spec,0,opts.label||'1F'); }
  if(view==='landing'){
    evBox(boxes,'shaft','hallWallL',-1.02,1.6,0.98,0.36,3.2,0.12,EV_COL.concrete);
    evBox(boxes,'shaft','hallWallR', 1.02,1.6,0.98,0.36,3.2,0.12,EV_COL.concrete);
    evBox(boxes,'shaft','hallWallTop',0,2.98,0.98,2.4,0.44,0.12,EV_COL.concrete);
  }
  if(view==='all') evMachine(boxes,spec);

  var colliders=[
    {name:'carFloorCollider',x:0,y:0,z:spec.carCZ,sx:spec.carW,sy:0.12,sz:spec.carD},
    {name:'doorCollider',x:0,y:0,z:0.95,sx:spec.doorW,sy:0.2,sz:0.3},
    {name:'carWallBack',x:0,y:1.15,z:spec.carCZ-spec.carD/2+0.03,sx:spec.carW,sy:2.3,sz:0.06},
    {name:'carWallL',x:-spec.carW/2+0.03,y:1.15,z:spec.carCZ,sx:0.06,sy:2.3,sz:spec.carD},
    {name:'carWallR',x: spec.carW/2-0.03,y:1.15,z:spec.carCZ,sx:0.06,sy:2.3,sz:spec.carD}
  ];
  var parts={};
  boxes.forEach(function(bp){ if(bp.part) parts[bp.part]=bp; });
  return {spec:spec,boxes:boxes,parts:parts,colliders:colliders};
}
