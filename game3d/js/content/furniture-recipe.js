/* @module-capsule */
(function($imports){
/* 里世界 3D · 家具与室内设施
   每种格子字符一个摆放函数：FURN[ch](c, x, y, cx, cz)
     c  —— 当前房间的上下文（Kit、尺寸、坐标换算、碰撞登记、接触阴影）
     x,y —— 网格坐标；cx,cz —— 这一格中心（米，房间中心为原点）
   模型都在 Blender 里建（tools/blender/assets：classroom / office / lab / misc / dorm / vehicles），
   这里只管摆：放在哪、转多少、按格子坐标挑款式和颜色（被子、车身、货架上的东西）、登记碰撞和接触阴影。
   占地、高度沿用原来的，碰撞由模型带的碰撞代理算（kit.js 的 Kit.asset）。 */
'use strict';

var FURN={};
var C_DESK=0x86653c, C_SEAT=0x785b34, C_FRAME=0x3a3f44, C_STEEL=0x9aa4a8, C_DARKP=0x2e3438;

/* 电梯门、轿厢面板和白色空间出口共用交互格，实体碰撞由同一格登记。 */
FURN.J=function(c,x,y,cx,cz){
  var K=c.K,isDream=c.R.host==='dream';
  if(isDream){
    K.box('plain',cx,1.35,cz,0.14,2.7,0.94,0xe9f7ff,1);
    K.box('plain',cx-0.09,1.4,cz,0.03,2.2,0.70,0x8ec6d1,1);
  }else if(c.R.host==='lift'){ (0,$imports.liftCabin)(c,x,y,cx,cz); return; }   /* 轿厢：model/lift.js */
  else { (0,$imports.liftLanding)(c,x,y,cx,cz); return; }                         /* 走廊上的电梯门：model/lift.js */
  c.solid(cx,cz,c.tw,c.th);
};
FURN.j=function(c,x,y,cx,cz){
  var K=c.K;
  K.box('plain',cx,1.25,cz,.80,2.5,.12,0x111a17,1);
  K.box('plain',cx-.40,1.25,cz,.08,2.5,.22,0x5b6b61,1);
  K.box('plain',cx+.40,1.25,cz,.08,2.5,.22,0x5b6b61,1);
  K.box('plain',cx,2.50,cz,.88,.08,.22,0x5b6b61,1);
  c.solid(cx,cz,c.tw,c.th);
};
FURN.u=function(c,x,y,cx,cz){
  c.K.box('plain',cx,.32,cz,.5,.64,.45,0x38443a,1);
  c.K.box('plain',cx,.67,cz,.42,.06,.34,0xc4bda4,1);
};

/* 一把学生椅（Blender 建模：弯木椅面、弯靠背、钢管架）。正面朝 -z（人面向 -z 坐） */
function chairModel(K,x,z,rot,seatY){
  K.asset(seatY>0.45?'chair_student_tall':'chair_student',x,0,z,rot||0);
}
/* 办公转椅：五星脚、气杆、软垫、靠背、扶手。正面朝 -z */
function officeChair(K,x,z,rot){ K.asset('chair_office',x,0,z,rot||0); }

/* 教学楼教室的课桌、椅子：位置由 ClassroomLayout 给（桌子朝西的黑板，同桌两张拼在一起）；别的房间在格子中心、朝北。
   返回米（房间中心为原点）：桌子中心 dx/dz、椅子中心 chx/chz、转角 rot（模型的人朝 -z 坐） */
function deskPlace(c,x,y,cx,cz){
  if(c.R.host==='teach'&&$imports.ClassroomLayout.isDesk(x,y)){
    var d=$imports.ClassroomLayout.deskAt(x,y), ch=$imports.ClassroomLayout.chairAt(x,y);
    return {dx:cx+(d.x-x-0.5)*c.tw, dz:cz+(d.y-y-0.5)*c.th, chx:cx+(ch.x-x-0.5)*c.tw, chz:cz+(ch.y-y-0.5)*c.th, rot:Math.PI/2};
  }
  return {dx:cx, dz:cz-0.10, chx:cx, chz:cz+0.30, rot:0};
}
/* 桌面上的东西（在课桌的局部坐标里，人在 +z）：高中生的桌子——前沿一排书立着（书立夹着），一摞练习册、卷子、水杯、笔。
   流畅档少摆一些：一摞书和卷子减半；别的教室（不是自己班）只有两成桌子立着书、不放水杯——一层 192 张桌子，手机上顶点数要控制 */
function deskTop(K,x,y,own){
  var hh=(0,$imports.hash2)(x*3+7,y*5+11), h2=(0,$imports.hash2)(y*7+3,x*11+5), top=0.7575, low=(0,$imports.lodLow)(), sparse=low&&!own;
  if(hh>(sparse?0.82:0.15)) (0,$imports.propBooksUpright)(K,(h2-0.5)*0.1+0.04,top,-0.175,0.26+hh*0.2,x*7+y*3,0);
  if(hh>0.42&&(!low||hh>0.71)) K.box('paper',(hh-0.7)*0.18,top+0.003,0.07,0.25,0.004,0.18,0xe6ece6,1.0);   /* 卷子 */
  if(h2>0.55&&(!low||h2>0.78)) (0,$imports.propBookPile)(K,0.22,top,0.06,2+((h2*10)|0)%3,x*7+y);
  if(h2<0.35&&!sparse) (0,$imports.propBottle)(K,-0.30,top,-0.17,[0x8ab8d8,0xd8a8b8,0xa8d0a0,0xe0e0d8][(x+y)%4],0.20);
  if(hh<0.30&&!low) K.rod('plastic',-0.2,top+0.006,0.05,-0.05,top+0.006,0.08,0.006,0.006,6,0x2a4a8a);  /* 一支笔 */
}

/* ---- 课桌（教学楼）/ 办公工位（行政楼） ---- */
FURN.d=function(c,x,y,cx,cz){
  var K=c.K;
  if(c.R.host==='admin'){
    c.R.stats.cubicle++;
    /* 人坐在北边（-z），面朝隔板；显示器屏幕朝人 */
    K.asset('cubicle_admin',cx,0,cz,0);
    officeChair(K,cx,cz-0.50,Math.PI);
    c.ao(cx,cz,0.98,0.90,0.9);
    return;
  }
  c.R.stats.desk++; c.R.stats.chair++;
  var p=deskPlace(c,x,y,cx,cz);
  K.frame(p.dx,p.dz,p.rot);
  K.asset('desk_student',0,0,0,0);                                               /* 木纹桌面、钢框、可调高的腿、铁皮桌斗、挂钩 */
  var L=$imports.ClassroomLayout;
  deskTop(K,x,y,c.R.host!=='teach'||(c.R.id===L.ownSeat.room&&L.classAt(x,y)===L.ownSeat.classId));
  K.unframe();
  chairModel(K,p.chx,p.chz,p.rot,0.44);
  c.ao((p.dx+p.chx)/2,(p.dz+p.chz)/2,p.rot?0.92:0.96,p.rot?0.82:0.70,1.0);   /* 桌子加椅子的接触阴影 */
};
/* 座位（能坐下的那张）：教学楼教室里和别的课桌一样带一张桌子；本人座位的桌面只放一排书和一支笔，不挡看黑板的视线 */
FURN.P=function(c,x,y,cx,cz){
  if(c.R.stats) c.R.stats.seat++;
  var K=c.K;
  if(c.R.host==='teach'&&$imports.ClassroomLayout.isDesk(x,y)){
    var p=deskPlace(c,x,y,cx,cz);
    K.frame(p.dx,p.dz,p.rot);
    K.asset('desk_student',0,0,0,0);
    (0,$imports.propBooksUpright)(K,-0.22,0.7575,-0.175,0.30,x*7+y*3,0);
    K.rod('plastic',0.08,0.7635,0.06,0.22,0.7635,0.09,0.006,0.006,6,0x2a4a8a);
    K.unframe();
    chairModel(K,p.chx,p.chz,p.rot,0.46);
    c.ao((p.dx+p.chx)/2,(p.dz+p.chz)/2,0.92,0.82,1.0);
    return;
  }
  chairModel(K,cx,cz,0,0.46);
  c.ao(cx,cz,0.5,0.5,0.7);
};
/* 讲台：木柜体（正面朝学生），老师那面开口；台上教案、粉笔盒、板擦。
   教学楼教室的讲台在中线上（ClassroomLayout.podiumAt），比格子中心往南半格，转 90° 对着全班 */
FURN.T=function(c,x,y,cx,cz){
  var L=$imports.ClassroomLayout, i=c.R.host==='teach'?L.classAt(x,y):-1;
  if(i>=0){
    var pa=L.podiumAt(i), px=cx+(pa.x-x-0.5)*c.tw, pz=cz+(pa.y-y-0.5)*c.th;
    c.ao(px,pz,0.8,0.9,0.9);
    c.K.asset('podium',px,0,pz,Math.PI/2);
    return;
  }
  c.ao(cx,cz,0.9,0.8,0.9);
  c.K.asset('podium',cx,0,cz,c.R.host==='teach'?Math.PI/2:0);
};
/* ---- 车库里的车（三厢轿车，车头朝 +x），车尾两块挡车器 ---- */
var CAR_COLS=[0x39424a,0x4a3a36,0x2e3a44,0x5a5e62,0x30343a];
FURN.V=function(c,x,y,cx,cz){
  var K=c.K, col=CAR_COLS[(x*3+y)%5], g=c.R.grid, k2;
  /* 车身 3.78×1.78 米，比一格大得多：前后左右两格内有柱子就往反方向让 0.4 米 */
  for(k2=-2;k2<=2;k2++){
    if(g[y+1]&&g[y+1][x+k2]==='#'){ cz-=0.40; break; }
    if(g[y-1]&&g[y-1][x+k2]==='#'){ cz+=0.40; break; }
  }
  c.ao(cx,cz,3.9,2.3,1.0);
  /* 车头的蓝牌：盖在车模型自带的空白牌照上（模型里牌照前面在 x=1.899、高 0.40），号码和钥匙环、调查笔记一致 */
  if(c.view&&c.view.carPlate)c.meshes.push(c.view.carPlate(x,y,cx+1.9025,0.40,cz));
  c.solid(cx,cz,3.70,1.85);              /* 碰撞按整个车身，不止一格 */
  K.frame(cx,cz,0);
  K.asset('car_sedan',0,0,0,0,{tint:{body:col}});
  K.asset('wheel_stop',-2.02,0,-0.52,0);
  K.asset('wheel_stop',-2.02,0,0.52,0);
  K.unframe();
};
/* ---- 宿舍床：上下铺铁架床，床垫枕头，被子叠成长条或豆腐块（颜色按格子挑） ---- */
var QUILT_COLS=[0x7a8a96,0x8a7a6a,0x6a7a8a,0x9a8a7a,0x6a8a7a];
FURN.b=function(c,x,y,cx,cz){
  var K=c.K, R=c.R, bdir;
  if(R.grid[y-1]&&R.grid[y-1][x]==='#') bdir=1;
  else if(R.grid[y+1]&&R.grid[y+1][x]==='#') bdir=-1;
  else bdir=(cz<0)?1:-1;
  var bw=0.92, bl=1.62, bcz=cz+bdir*(bl-1)*0.5;
  /* 和旁边那张床挨着的一侧不装梯子、不装护栏 */
  var nbL=(R.grid[y][x-1]==='b'), nbR=(R.grid[y][x+1]==='b');
  c.ao(cx,bcz,bw*0.98,bl*0.98,0.9);
  c.solid(cx,bcz,bw*0.94,bl);
  /* 床离墙留 16 厘米（墙上有窗台、窗帘），碰撞照旧按整个占地；床头朝 -z */
  K.frame(cx,bcz+bdir*0.08,bdir>0?0:Math.PI);
  K.asset((nbL&&nbR)?'bunk_frame_n':(nbR?'bunk_frame_l':'bunk_frame_r'),0,0,0,0);
  [0.30,1.38].forEach(function(y0,lv){
    K.asset('bed_mattress',0,y0,0,0);
    K.asset((0,$imports.hash2)(x+lv*7,y)>0.3?'quilt_folded':'quilt_block',0,y0,0,0,{tint:{q:QUILT_COLS[(x*3+y*5+lv)%5]}});
  });
  K.unframe();
};
/* ---- 实验楼 ---- */
FURN.q=function(c,x,y,cx,cz){ c.ao(cx,cz,0.96,0.82,0.9); c.K.asset('bench_physics',cx,0,cz,0); };          /* 物理实验台 */
FURN.n=function(c,x,y,cx,cz){ c.ao(cx,cz,0.92,0.80,0.9); c.K.asset('desk_computer',cx,0,cz,0); officeChair(c.K,cx,cz+0.48,0); };   /* 学生机 */
FURN.x=function(c,x,y,cx,cz){ c.ao(cx,cz,0.7,0.6,0.7); c.K.asset('map_stand',cx,0,cz,0); };                /* 地理挂图架 */
/* ---- 音乐教室：第一个 'p' 是立式钢琴（琴背靠墙）和琴凳，其余是圆琴凳 ---- */
FURN.p=function(c,x,y,cx,cz){
  var K=c.K, R=c.R;
  if(c.pianoPlaced){
    K.asset('stool_piano',cx,0,cz,0);
    c.ao(cx,cz,0.4,0.4,0.6);
    return;
  }
  c.pianoPlaced=1;
  var rot=0;
  if(R.grid[y-1]&&R.grid[y-1][x]==='#') rot=Math.PI;
  else if(R.grid[y+1]&&R.grid[y+1][x]==='#') rot=0;
  else if(R.grid[y]&&R.grid[y][x-1]==='#') rot=-Math.PI/2;
  else if(R.grid[y]&&R.grid[y][x+1]==='#') rot=Math.PI/2;
  var pD=0.62, back=0.5-pD*0.5;
  c.ao(cx,cz,1.5,1.0,0.85);
  if(Math.abs(Math.sin(rot))<0.5) c.solid(cx,cz-Math.cos(rot)*back,1.48,pD+0.04); else c.solid(cx-Math.sin(rot)*back,cz,pD+0.04,1.48);
  K.frame(cx,cz,rot);                        /* 局部：琴背在 -z（靠墙），人坐在 +z */
  K.asset('piano_upright',0,0,0,0);
  K.asset('piano_bench',0,0,-back+0.88,0);
  K.unframe();
};
/* ---- 'K'：行政楼的大办公桌 / 实验楼的教师演示台 ---- */
FURN.K=function(c,x,y,cx,cz){
  var K=c.K;
  if(c.R.host==='admin'){
    var adw=1.15, add=0.86;
    if(c.R.grid[y][x-1]==='#') cx+=0.10;           /* 桌子比一格宽：靠西墙时往东让一点 */
    c.ao(cx,cz,adw*1.02,add*1.02,0.9);
    c.solid(cx,cz,adw,add);
    K.asset('desk_office',cx,0,cz,0);
    officeChair(K,cx,cz+add*0.78,0);
    return;
  }
  c.ao(cx,cz,1.30*1.02,0.82*1.02,0.9);
  c.solid(cx,cz,1.30,0.82);
  K.asset('bench_demo',cx,0,cz,0);
};
FURN.C=function(c,x,y,cx,cz){ c.ao(cx,cz,0.92,0.92,0.9); c.K.asset('centrifuge',cx,0,cz,0); };            /* 离心机 */
FURN.N=function(c,x,y,cx,cz){ c.ao(cx,cz,0.8,0.8,0.85); c.K.asset('microscope_stand',cx,0,cz,0); };        /* 显微镜 */
FURN.Z=function(c,x,y,cx,cz){ c.ao(cx,cz,0.95,0.95,0.9); c.K.asset('physics_apparatus',cx,0,cz,0); };      /* 杠杆 + 单摆（玩法里它能"预报"下一次） */
FURN.Y=function(c,x,y,cx,cz){ c.ao(cx,cz,0.8,0.8,0.85); c.K.asset('globe',cx,0,cz,0); };                    /* 地球仪 */
/* ---- 食堂：'t' 连体餐桌、'k' 打饭台（菜按位置换） / 保安岗的值班台 ---- */
FURN.t=function(c,x,y,cx,cz){ c.ao(cx,cz,0.9,0.86,0.9); c.K.asset('canteen_table',cx,0,cz,0); };
var FOODS=[[0x8a5a2a,0x6a3a1a],[0x4a7a2a,0x3a6a22],[0xe8e2d0,0xd8d0c0],[0xd8a83a,0xc84a2a]];
FURN.k=function(c,x,y,cx,cz){
  var K=c.K;
  c.ao(cx,cz,0.9,0.86,0.9);
  if(c.R.host==='guard'){ K.asset('counter_guard',cx,0,cz,0); return; }
  K.asset('counter_serving',cx,0,cz,0);
  var f1=FOODS[(x+y)%4], f2=FOODS[(x*3+y+1)%4];
  K.asset('food_pan_fill',cx-0.20,0.935,cz+0.04,0,{tint:{a:f1[0],b:f1[1]}});
  K.asset('food_pan_fill',cx+0.20,0.935,cz+0.04,Math.PI,{tint:{a:f2[0],b:f2[1]}});
};
/* ---- 机房 ---- */
FURN.f=function(c,x,y,cx,cz){ c.ao(cx,cz,0.9,0.8,0.85); c.K.asset('server_rack',cx,0,cz,(0,$imports.hash2)(x,y)>0.5?Math.PI:0); };   /* 服务器机柜 */
FURN.Q=function(c,x,y,cx,cz){ c.ao(cx,cz,0.9,0.8,0.85); c.K.asset('server_console',cx,0,cz,0); };          /* 门禁控制台 */
/* ---- 货架：器材室放球，别处放纸箱（哪层哪格有、是哪种按格子坐标定） ---- */
FURN.R=function(c,x,y,cx,cz){
  var K=c.K, k, j;
  c.ao(cx,cz,0.86,0.72,0.8);
  K.asset('shelf_metal',cx,0,cz,0);
  for(k=0;k<4;k++){
    var sy=0.106+k*0.56;
    for(j=0;j<3;j++){
      if((0,$imports.hash2)(x*7+k,y*3+j)<0.35) continue;
      var bx=cx-0.26+j*0.26;
      if(c.R.id==='gear1') K.asset(['ball_basket','ball_soccer','ball_volley'][(j+k)%3],bx,sy,cz,(0,$imports.hash2)(j,k)*6.28);
      else K.asset('carton_'+((j+k+x)%3),bx,sy,cz+((0,$imports.hash2)(k,j+y)-0.5)*0.06,((0,$imports.hash2)(j,x+k)-0.5)*0.12);
    }
  }
};
FURN.l=function(c,x,y,cx,cz){ c.ao(cx,cz,0.96,0.92,0.9); c.K.asset('bench_chem',cx,0,cz,0); };             /* 化学实验台（带凳子） */
FURN.w=function(c,x,y,cx,cz){ c.ao(cx,cz,0.8,0.7,0.8); c.K.asset('washbasin',cx,0,cz,0); };               /* 洗手台 */
FURN.v=function(c,x,y,cx,cz){ c.K.asset('cabinet_tall',cx,0,cz,0); };                                     /* 铁皮立柜 */
FURN.D=function(c,x,y,cx,cz){ c.ao(cx,cz,0.8,0.7,0.8); c.K.asset('terminal_data',cx,0,cz,0); };            /* 数据终端 / 门禁管理终端 */
FURN.X=function(c,x,y,cx,cz){ c.ao(cx,cz,0.9,0.9,0.9); c.K.asset('bin_wheelie',cx,0,cz,0); };             /* 带轮子的大垃圾桶 */
/* ---- 厕所隔间：两侧隔板 + 一扇关着的门，门缝底下看得见蹲坑的台阶 ---- */
FURN.B=function(c,x,y,cx,cz){ c.K.asset('toilet_stall',cx,0,cz,0); };
FURN.G=FURN.B;
/* ---- 钟楼的铜钟：横梁吊着（梁的长短看房间），旁边吊着撞木 ---- */
FURN.U=function(c,x,y,cx,cz){
  var K=c.K;
  K.bevel('wood',cx,2.82,cz,c.beamW||2.6,0.18,0.22,0x3a2a1c,1.0,0.03);              /* 横梁 */
  K.asset('bell_bronze',cx,0,cz,0);
  c.ao(cx,cz,1.5,1.5,0.8);
  c.solid(cx,cz,1.3,1.3);
};
/* ---- 供桌：香炉、白蜡烛、一碗插着筷子的饭、剪掉脸的照片 ---- */
FURN.A=function(c,x,y,cx,cz){
  c.ao(cx,cz,1.3,0.8,0.9);
  c.K.asset('altar_table',cx,0,cz,0);
  c.solid(cx,cz,1.3,0.7);
};
/* ---- 连廊入口（'L'）：门垫 + 吊牌（吊高到 2.65 米以上：巡察者 2.6 米高） ---- */
FURN.L=function(c,x,y,cx,cz){
  var K=c.K;
  K.g('decal').quad(cx-0.45,cz-0.35,cx+0.45,cz-0.35,cx+0.45,cz+0.35,cx-0.45,cz+0.35,0.004,0x6a2a22);
  K.asset('sign_hanging',cx,$imports.WALLH-3.0,cz,0);
};
/* 没有专门模型的字符：一个按原色的倒角块（不该出现，留着兜底） */
function furnFallback(c,x,y,cx,cz,ch){
  var colName=$imports.PALETTE_NAME[ch];
  if(colName) c.K.bevel('plastic',cx,0.4,cz,0.85,0.8,0.85,$imports.PALETTE[colName]||$imports.PALETTE.wall,1.0,0.03);
}

/* @module-exports */
GameModules.publish("game3d/js/content/furniture-recipe.js",{
"FURN":{get:function(){return FURN;},set:function($value){FURN=$value;}},
"C_DESK":{get:function(){return C_DESK;},set:function($value){C_DESK=$value;}},
"C_SEAT":{get:function(){return C_SEAT;},set:function($value){C_SEAT=$value;}},
"C_FRAME":{get:function(){return C_FRAME;},set:function($value){C_FRAME=$value;}},
"C_STEEL":{get:function(){return C_STEEL;},set:function($value){C_STEEL=$value;}},
"C_DARKP":{get:function(){return C_DARKP;},set:function($value){C_DARKP=$value;}},
"chairModel":{get:function(){return chairModel;},set:function($value){chairModel=$value;}},
"officeChair":{get:function(){return officeChair;},set:function($value){officeChair=$value;}},
"deskPlace":{get:function(){return deskPlace;},set:function($value){deskPlace=$value;}},
"deskTop":{get:function(){return deskTop;},set:function($value){deskTop=$value;}},
"CAR_COLS":{get:function(){return CAR_COLS;},set:function($value){CAR_COLS=$value;}},
"QUILT_COLS":{get:function(){return QUILT_COLS;},set:function($value){QUILT_COLS=$value;}},
"FOODS":{get:function(){return FOODS;},set:function($value){FOODS=$value;}},
"furnFallback":{get:function(){return furnFallback;},set:function($value){furnFallback=$value;}}
});
})(GameModules.imports("game3d/js/content/furniture-recipe.js"));
