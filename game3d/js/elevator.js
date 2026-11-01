/* 里世界 3D · 电梯
   教学楼、实验楼各一台：呼梯 → 等待 → 进轿厢 → 选层 → 运行 → 开门到达。
   轿厢是一个普通房间（'elevcar'），碰撞、灯光、存档与其它房间同一套；
   面板那一格写 'W'，按 E 弹出楼层选择，键盘 1–5 也能选，手机上直接点。

   「错误的电梯」：每次进轿厢有 8% 会多出一个本楼不存在的按钮（B4），每局最多一次；
   按了它 SAN −12，门开以后不是楼层，是白色几何迷宫（maze.js）。 */
'use strict';

var ELEV={
  stage:'idle',        /* idle / arrive / close / ride / open */
  t:0, id:null, from:null, to:null, rideLeft:0,
  wrong:false, usedWrong:false, rides:0
};
var ELEV_CABIN='elevcar';
/* 坐电梯的时间成本：0.4 游戏分钟；走楼梯是 1 分钟，所以坐电梯省时间 */
var ELEV_COST_MIN=0.4;
var ELEV_DEF={
  teach:{name:'教学楼', door:{r:21,c:11,face:-1}, wrong:'B4',
         floors:['teach1','teach2','teach3','teach4','teach5'], labels:['1F','2F','3F','4F','5F']},
  admin:{name:'行政楼', door:{r:19,c:9,face:-1}, wrong:'B4',
         floors:['admin1','admin2','admin3','admin4','admin5'], labels:['1F','2F','3F','4F','5F']},
  lab:{name:'实验楼', door:{r:19,c:6,face:-1}, wrong:'B4',
       floors:['lab1','lab2','lab3','lab4','lab5'], labels:['1F','2F','3F','4F','5F']}
};
/* face：门所在墙相对走廊的方向。-1 = 门在南墙上（人站在北侧、面朝南）。 */
var ELEV_T={arrive:2.5, close:0.8, perFloor:1.1, open:0.9};
var ELEV_WRONG_P=0.08;      /* 每次进轿厢的触发概率 */
var ELEV_DEV_FORCE=false;   /* 调试面板：强制每次都出错误电梯 */

function elevForRoom(roomId){
  for(var k in ELEV_DEF){ if(ELEV_DEF[k].floors.indexOf(roomId)>=0) return k; }
  return null;
}
/* 面板楼层顺序：常驻乱序，按楼栋固定 */
var ELEV_ORDER={teach:[3,0,4,1,2], lab:[1,4,2,0,3], admin:[2,4,0,3,1]};
/* 错误电梯的面板形态：'few' 缺层 / 'many' 爆量 / 'mess' 乱码；每趟开面板时定一次 */
var ELEV_WRONG_KIND=null;
function elevWrongKind(){
  if(!ELEV_WRONG_KIND){
    var r=Math.random();
    ELEV_WRONG_KIND=(r<0.34)?'few':((r<0.67)?'many':'mess');
  }
  return ELEV_WRONG_KIND;
}

/* 某一层电梯门前的落点：站在走廊一侧、面朝门 */
function elevDoorSpawn(roomId){
  var R=INTERIORS[roomId]; if(!R) return null;
  var key=elevForRoom(roomId), d=key?ELEV_DEF[key].door:null;
  if(!d) return null;
  var face=d.face||-1;                     /* -1：走廊在门的北侧（门朝北），人站在北侧、面朝南 */
  var y=R.oy+(d.r+0.5+face*1.6)*R.th;
  return {x:R.ox+(d.c+0.5)*R.tw, y:y, ang:face<0?PI/2:-PI/2};
}
function elevFloorLabel(roomId){
  var key=elevForRoom(roomId);
  if(!key) return '';
  var i=ELEV_DEF[key].floors.indexOf(roomId);
  return i>=0?ELEV_DEF[key].labels[i]:'';
}
/* 轿厢：4×4 米的金属盒子，北墙上是面板，南边是门 */
function buildElevatorCabin(){
  if(INTERIORS[ELEV_CABIN]) return INTERIORS[ELEV_CABIN];
  if(typeof ROOM_THEMES!=='undefined'&&!ROOM_THEMES.elev){
    ROOM_THEMES.elev={floor:'fconcrete',fcol:0x6d7472,wall:0x8b9391,wallMat:'metal',low:0x5c6462,
      skirt:0x3e4644,ceil:0xa4acaa,ceilMat:'metal',rail:0x7a8280};
  }
  if(typeof ROOM_LIGHTS!=='undefined'&&!ROOM_LIGHTS.elev){
    /* 轿厢只有 2 米见方，原来 1.5 的强度直接把内壁打到纯白（截图上整片过曝）。
       降到 0.6，让钢面和门板的分界能看出来 */
    ROOM_LIGHTS.elev=[[0,2.58,0,0xffe9c8,0.6,6,'room']];
  }
  var g=[];
  /* 4×4：内部 2×2 格（2 米），刚好容下 1.6×1.5 的轿厢，玩家不会被墙夹住 */
  for(var r=0;r<4;r++){
    var row=[];
    for(var c=0;c<4;c++) row.push((r===0||r===3||c===0||c===3)?'#':'.');
    g.push(row);
  }
  g[0][1]='W';        /* 面板 */
  g[3][1]='O';        /* 门：出去就回到上电梯的那一层 */
  var R=mkFloor(ELEV_CABIN,'电梯','elev',0,g);
  R.small=true;
  return R;
}
/* 呼梯：在走廊按 E，等 2.5 秒门开，自动进轿厢 */
function elevCall(roomId){
  var key=elevForRoom(roomId);
  if(!key){ os('我：这不是电梯按钮。',2.0); return; }
  if(ELEV.stage!=='idle'){ os('我：电梯还在动。'+(ELEV.stage==='ride'?'轿厢里有人。':'等一等。'),2.4); return; }
  /* 呼梯：门保持关着等（不要先命令它关一次，否则会看到门先合上再打开） */
  ELEV.stage='arrive'; ELEV.t=ELEV_T.arrive; ELEV.id=key; ELEV.from=roomId; ELEV.to=null; ELEV.wrong=false;
  try{ SFX.click(); }catch(e){}
  os('我：按了一下。按钮亮起来，头顶的楼层数开始往下走。',3.0);
}
/* 进轿厢：决定这一趟是不是「错误的电梯」 */
function elevOpenCabin(){
  if(typeof elevDoorSet==='function') elevDoorSet(1);
  buildElevatorCabin();
  var key=ELEV.id, def=ELEV_DEF[key];
  ELEV.rides++;
  ELEV.wrong=false;                      /* 每一趟都要重新判定，不能沿用上一趟的结果 */
  if(!ELEV.usedWrong&&(ELEV_DEV_FORCE||Math.random()<ELEV_WRONG_P)){
    ELEV.wrong=true; ELEV.usedWrong=true;
  }
  var R=INTERIORS[ELEV_CABIN];
  /* 落在轿厢正中（4×4 房间的内部中心），面朝轿门；以前用 2.5/3.0 格是按 5×5 房间写的，
     换成 4×4 之后会落到门框里，人就被碰撞盒夹住了 */
  enterRoom(ELEV_CABIN,{x:R.ox+2*R.tw, y:R.oy+2*R.th, ang:PI/2});
  S.floorY=0;
  try{ SFX.door(); }catch(e){}
  os(ELEV.wrong?
    '我：门开了。\n轿厢里的按钮板上有两个亮着的数字——一个是我按的楼层，另一个是「'+def.wrong+'」。这栋楼没有地下四层。':
    '我：门开了。轿厢比走廊还窄，金属壁上有一道一道的划痕。按 E 选楼层。',5,OS_FORCE);
}
/* 面板：弹出楼层选择。错误电梯会多一个不存在的楼层 */
function elevPanel(){
  var key=ELEV.id||'teach', def=ELEV_DEF[key], opts=[], i;

  /* ---- 错误电梯：面板是坏的，而且没有「先出去」——只能按键走流程 ---- */
  if(ELEV.wrong){
    var kind=elevWrongKind(), pool=['B4','7F','?','-2','9','FF'], n, lab;
    if(kind==='few'){
      n=2+((Math.random()*2)|0);
      for(i=0;i<n;i++){
        lab=(i===0)?def.wrong:pool[(Math.random()*pool.length)|0];
        opts.push({label:'按「'+lab+'」',fn:function(){ ELEV_GO(-1); }});
      }
      os('我：面板上只剩两三个键，边上是空的。',2.6);
    }else if(kind==='many'){
      n=12+((Math.random()*6)|0);
      for(i=0;i<n;i++){
        lab=(i===0)?def.wrong:(''+(1+((Math.random()*9)|0))+'F');
        opts.push({label:'按「'+lab+'」',fn:function(){ ELEV_GO(-1); }});
      }
      os('我：按钮挤成一片，编号重复，字都糊在一起。',2.8);
    }else{
      n=5+((Math.random()*3)|0);
      for(i=0;i<n;i++){
        lab=(i===0)?def.wrong:pool[(Math.random()*pool.length)|0];
        opts.push({label:'按「'+lab+'」',fn:function(){ ELEV_GO(-1); }});
      }
      os('我：楼层排得没有道理，同一个数字出现了两次。',2.8);
    }
    UI.choice('面板上的字在动。不管按哪个，门都不会开。',opts);
    return;
  }

  /* ---- 正常电梯：楼层顺序常驻乱序（按楼栋固定，背不下来） ---- */
  var ord=ELEV_ORDER[key]||[0,1,2,3,4];
  for(i=0;i<ord.length;i++){
    (function(li){
      var here=ELEV.from===def.floors[li];
      opts.push({label:(here?'（本层）':'')+def.labels[li]+' '+INTERIORS[def.floors[li]].name.split(' · ')[0],
        fn:function(){ ELEV_GO(li); }});
    })(ord[i]);
  }
  if(opts.length>9) opts.length=9;
  opts.push({label:'算了，先出去',fn:function(){ UI.closeChoice(); elevLeaveCabin(); }});
  UI.choice('按钮板上只有几个数字，边角磨得发白。',opts);
}/* 选层：idx = -1 表示按了那个不存在的楼层 */
function ELEV_GO(idx){
  UI.closeChoice();
  var def=ELEV_DEF[ELEV.id||'teach'];
  if(idx<0){
    S.san=Math.max(0,S.san-12);
    try{ SFX.sting&&SFX.sting(); }catch(e){}
    ELEV.stage='open'; ELEV.t=ELEV_T.open;
    whiteEnter();                       /* 门开以后不是楼层 */
    return;
  }
  var target=def.floors[idx];
  if(!target){ return; }
  if(target===ELEV.from){
    os('我：就是这一层。门开了又关上。',2.4);
    if(typeof elevDoorSet==='function') elevDoorSet(1);
    ELEV.stage='open'; ELEV.t=ELEV_T.open; return;
  }
  var n=Math.abs(idx-def.floors.indexOf(ELEV.from));
  if(typeof elevDoorSet==='function') elevDoorSet(0);
  ELEV.stage='close'; ELEV.t=ELEV_T.close; ELEV.to=target; ELEV.rideLeft=ELEV_T.perFloor*Math.max(1,n);
  try{ SFX.door(); }catch(e){}
  os('我：门合上了。'+(n>1?'电梯往上走了一段，又走了一段。':'电梯动了一下。'),3.0);
}
/* 出去：回到上电梯的那一层（不走楼层选择） */
function elevLeaveCabin(){
  if(typeof elevDoorSet==='function') elevDoorSet(0);   /* 走了就把门带上 */
  var back=ELEV.from||'teach1';
  ELEV.stage='idle'; ELEV.t=0; ELEV.wrong=false; ELEV.to=null;
  var sp=elevDoorSpawn(back);
  enterRoom(back,sp?{x:sp.x,y:sp.y,ang:sp.ang}:undefined);
  S.floorY=0;
  try{ SFX.door(); }catch(e){}
  os('我：门开着，我又走回走廊。电梯在我身后合上了。',3.2);
}
/* 每帧推进：呼梯等待 / 关门 / 运行 / 开门 */
function elevTick(dt){
  if(typeof elevDoorTick==='function') elevDoorTick(dt);
  if(ELEV.stage==='idle') return;
  ELEV.t-=dt;
  if(ELEV.t>0) return;
  if(ELEV.stage==='arrive'){
    ELEV.stage='idle';
    /* 人还不在门口就不自动进轿厢：走开了就等于没赶上这一趟 */
    var sp0=elevDoorSpawn(ELEV.from||'');
    if(sp0&&Math.sqrt(dist2(sp0.x,sp0.y,S.x,S.y))>9*2.2){
      os('我：电梯到这一层了。门开了一会儿，又合上了。',3.0);
      return;
    }
    elevOpenCabin();
    return;
  }
  if(ELEV.stage==='close'){
    var d=ELEV.rideLeft||ELEV_T.perFloor;
    ELEV.stage='ride'; ELEV.t=d;
    if(typeof advanceGameTime==='function') advanceGameTime(ELEV_COST_MIN);
    try{ SFX.rumble&&SFX.rumble(); }catch(e){}
    return;
  }
  if(ELEV.stage==='ride'){
    ELEV.stage='open'; ELEV.t=ELEV_T.open;
    if(typeof elevDoorSet==='function') elevDoorSet(1);      /* 到站：门滑开 */
    var sp=elevDoorSpawn(ELEV.to);
    if(sp){
      var to=ELEV.to;
      ELEV.from=to;
      enterRoom(to,{x:sp.x,y:sp.y,ang:sp.ang});
      S.floorY=0;
      os('我：门开了。这一层是「'+elevFloorLabel(to)+'」。走廊里的灯管一明一暗。',3.6);
    }
    try{ SFX.door(); }catch(e){}
    return;
  }
  if(ELEV.stage==='open'){
    ELEV.stage='idle'; ELEV.t=0; ELEV.wrong=false;
    return;
  }
}
/* ---------------- 建模：把电梯预制件画进房间 ----------------
   预制件的坐标是「井道中心为原点、+z 朝电梯厅、单位米」。
   画进房间时按 face 旋转：face=-1 表示门在南墙、电梯厅在门北侧，需要绕 Y 转 180°。 */
var ELEVDOOR={open:0,target:0,landing:[],car:[],matP:null};
function evMatKey(col){
  if(typeof EV_COL==='undefined') return 'metal';
  if(col===EV_COL.concrete||col===EV_COL.concreteDark) return 'concrete';
  if(col===EV_COL.rubber) return 'plastic';
  if(col===EV_COL.rail||col===EV_COL.cable) return 'metal';
  return 'metal';
}
/* 轿厢内部：把预制件的 car 视图铺进轿厢房间，并补上碰撞（房间墙在 2.5 米外，不加会走出轿厢） */
function buildElevatorInterior(c,R){
  if(typeof buildElevatorPrefab!=='function') return;
  var s=EV_SPEC, cx=0, cz=-s.carCZ;             /* 轿厢中心对齐房间中心 */
  var usedAsset=false;
  if(typeof elevAssetBuild==='function'){
    usedAsset=elevAssetBuild(c,'car',cx,cz,1);
    if(usedAsset&&typeof elevAssetDoors==='function') elevAssetDoors('car',c,cx,cz,1);
  }
  if(!usedAsset){
    elevEmitPrefab(c,'car',cx,cz,1);
    elevBuildPanels('car',c,cx,cz,1);
  }
  var hw=s.carW/2, hd=s.carD/2;
  c.solid(cx,cz-hd+0.03,s.carW,0.08);           /* 后壁 */
  c.solid(cx-hw+0.03,cz,0.08,s.carD);           /* 左壁 */
  c.solid(cx+hw-0.03,cz,0.08,s.carD);           /* 右壁 */
  var side=(s.carW-s.doorW)/2;
  c.solid(cx-(s.doorW/2+side/2),cz+hd-0.04,side,0.10);   /* 门洞两侧 */
  c.solid(cx+(s.doorW/2+side/2),cz+hd-0.04,side,0.10);
}

function elevEmitPrefab(c,kind,cx,cz,face){
  if(typeof buildElevatorPrefab!=='function') return null;
  /* 新房间的层门一律从关闭状态开始（上一趟到站后门是开的，状态会残留） */
  if(kind==='landing'&&typeof ELEVDOOR!=='undefined'){ ELEVDOOR.open=0; ELEVDOOR.target=0; }
  var P=buildElevatorPrefab({view:kind,label:(typeof elevDisplayLabel==='function')?elevDisplayLabel():'1F'});
  var f=face||-1, skip={};
  /* 摆放对齐（这是"看着不对"的根因，不是模型本身）：
     预制件里层门平面在局部 z=+0.94；W 只占一格（1 米），走廊侧墙面在格心 -0.5 米处。
     要门正好贴在墙面上：cz-(0.94+zoff)=cz-0.5 → zoff=-0.44。
     这样门面停在墙面上，外呼板/显示屏（局部 z 更大）自然凸到走廊这一侧。 */
  var zoff=(kind==='landing')?-0.44:0;
  /* 门板单独做成可动网格，这里跳过它们 */
  ['doorLeft','doorRight','landingDoorLeft','landingDoorRight'].forEach(function(k){skip[k]=1;});
  P.boxes.forEach(function(b){
    if(skip[b.part]) return;
    var m=evMatKey(b.col);
    if(b.type==='cyl'){
      c.K.cyl(m, cx+b.x*f, b.y, cz+(b.z+zoff)*f, b.rb, b.rt, b.h, b.nseg||12, b.col, 1.0);
    }else if(b.type==='rod'){
      c.K.rod(m, cx+b.x0*f, b.y0, cz+b.z0*f, cx+b.x1*f, b.y1, cz+b.z1*f, b.r0, b.r1, b.nseg||6, b.col, 1.0);
    }else{
      c.K.box(m, cx+b.x*f, b.y, cz+(b.z+zoff)*f, b.sx, b.sy, b.sz, b.col, 1.0);
    }
  });
  return P;
}
/* 两扇门板：独立网格，供开门/关门动画平移 */
function elevBuildPanels(which,c,cx,cz,face){
  var s=EV_SPEC, leafW=(s.doorW-s.doorGap)/2, f=face||-1;
  /* 门板必须和门套/门楣用同一个摆放偏移：层门平面局部 z=0.94，减去 zoff 0.44 才是墙面位置。
     以前这里写死 0.94，没吃到 zoff，门板就飘在墙面外 44cm —— 看着像"门板不在上面"。 */
  var baseZ=(which==='car')?(s.carCZ+s.carD/2+0.03):(0.94-0.44);
  ELEVDOOR[which]=[];
  if(typeof THREE==='undefined'||typeof GLR==='undefined'||!GLR.scene||!c.meshes){
    /* 没有 THREE（离线渲染 / 极端降级）：直接交给 Kit 画成静态门板，保证门永远在 */
    for(var k=0;k<2;k++){
      var hx=(k===0?-1:1)*(leafW/2+s.doorGap/2);
      c.K.box('metal', cx+hx*f, s.doorH/2, cz+baseZ*f, leafW, s.doorH, s.doorT, EV_COL.paint, 1.0);
    }
    return;
  }
  if(!ELEVDOOR.matP) ELEVDOOR.matP=new THREE.MeshLambertMaterial({color:EV_COL.paint});
  for(var i=0;i<2;i++){
    var geom=new THREE.BoxGeometry(leafW,s.doorH,s.doorT);
    var m=new THREE.Mesh(geom,ELEVDOOR.matP);
    var home=(i===0?-1:1)*(leafW/2+s.doorGap/2);
    m.userData.baseX=cx+home*f;
    m.userData.slide=(i===0?-1:1)*0.45*f;      /* 往两侧滑 0.45 米 */
    m.position.set(m.userData.baseX,s.doorH/2,cz+baseZ*f);
    c.meshes.push(m);
    ELEVDOOR[which].push(m);
  }
}
/* 开门/关门：0=关，1=全开 */
function elevDoorTick(dt){
  var d=ELEVDOOR, k, i, m;
  d.open+=(d.target-d.open)*Math.min(1,dt*7);
  if(Math.abs(d.target-d.open)<0.002) d.open=d.target;
  for(k=0;k<2;k++){
    var arr=k?'car':'landing';
    for(i=0;i<d[arr].length;i++){
      m=d[arr][i];
      if(!m.parent){ d[arr].splice(i,1); i--; continue; }
      m.position.x=m.userData.baseX+m.userData.slide*d.open;
    }
  }
}
function elevDoorSet(open){ ELEVDOOR.target=open?1:0; }
function elevHere(){ return S.mode==='in'&&S.room===ELEV_CABIN; }

/* ---------------- 与上游接口对接 ----------------
   上游（chorusfruit-233/wdfz）的电梯交互入口是瓦片 'J'：
     interact.js: if(ch==='J'){ Elevator.interact(); return; }
     dev.js / dread.js 还会用 Elevator.tick / inRide / cancel。
   我的实现在 ELEV_* 这一套上，这里做一层薄适配，别让上游调用方报错。 */
var Elevator={
  state:function(){ return {stage:ELEV.stage,id:ELEV.id,from:ELEV.from,to:ELEV.to,wrong:ELEV.wrong}; },
  inRide:function(){ return S.mode==='in'&&S.room===ELEV_CABIN; },
  cancel:function(){ ELEV.stage='idle'; ELEV.t=0; if(typeof elevDoorSet==='function') elevDoorSet(0); },
  interact:function(){
    if(S.mode==='in'&&S.room===ELEV_CABIN){ elevPanel(); return; }
    elevCall(S.room);
  },
  tick:function(dt){ elevTick(dt); },
  recover:function(){ ELEV.stage='idle'; ELEV.t=0; },
  unsafe:function(){ return false; }
};

/* 电梯厅：走廊上的 'J' 瓦片画成我的 landing 预制件（门套/地坎/外呼/数字屏/到站灯） */
function elevLandingTile(c,x,y,cx,cz){
  var R=c.R;
  var north=R.grid[y-1]&&R.grid[y-1][x]==='#';
  var south=!R.grid[y+1]||R.grid[y+1][x]==='#';
  var face=north?1:(south?-1:0);
  if(!face){ return false; }
  var ok=false;
  if(typeof elevEmitPrefab==='function'){
    ok=!!elevEmitPrefab(c,'landing',cx,cz,face);
    if(typeof elevBuildPanels==='function') elevBuildPanels('landing',c,cx,cz,face);
  }
  if(ok) c.solid(cx,cz,c.tw*0.95,c.th*0.35);
  return ok;
}
if(typeof FURN!=='undefined'){
  FURN.J=function(c,x,y,cx,cz){ elevLandingTile(c,x,y,cx,cz); };
}
