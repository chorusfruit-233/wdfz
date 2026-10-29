/* 里世界 3D · 室内建模
   buildRoomGeometry(R) —— 根据网格生成一层楼：
     地面（按房间换材质：教室地砖、走廊水磨石、车库混凝土……）
     墙：相邻的墙格合并成大块（以前逐格方块，一层楼上千个），露在外面的一侧加踢脚、墙裙、腰线
     吊顶 + 灯盘、门（门框、门套、带小窗的门扇、把手、门牌；开着的门会转开）、楼梯、出口
     家具（见 furniture.js）和每种房间自己的布置（黑板、窗、储物柜、管道、通风橱……）
   副作用：R.stairExtra / R.propExtra（碰撞，米）和 R.stats。 */
'use strict';

function roomTheme(R){
  return Object.assign({floor:'ftile',fcol:PALETTE.floor,wall:PALETTE.wall,wallMat:'plaster',low:0x8b867e,
    skirt:0x242c32,ceil:0x9a9e9e,ceilMat:'ceiling',rail:0x6a5a48},ROOM_THEMES[R.id]||ROOM_THEMES[R.host]||{});
}

function buildRoomGeometry(R){
  S.__pianoPlaced=0;
  SHAFT_ACC=[];                    /* 收集窗户，给光影模块画窗光 */
  R.stats={desk:0, cubicle:0, chair:0, seat:0};
  R.stairExtra=[];                 /* 以前每进一次房间都往里追加一遍，越积越多 */
  R.propExtra=[];                  /* 大件家具的真实占地（米，房间中心为原点） */
  R.foot={};                       /* 每格家具模型在人身高范围内的占地矩形（米），碰撞用它 */
  var W=R.cols,H=R.rows,tw=TTILE*U2M,th=TTILE*U2M;
  var halfW=W*tw*0.5, halfH=H*th*0.5;
  var isRoof=(R.host==='teach'&&R.floor===6);
  var RWH=R.spiral?SPIRAL.wallH:WALLH;           /* 钟楼里面是通高的 */
  /* 贴地朝下的面不建；有吊顶的房间，贴吊顶朝上的面也不建；顶点多的材质按 16 米切块 */
  var K=new Kit({cull:isRoof?{floor:0.002}:{floor:0.002,ceil:RWH-0.002},chunk:16});
  var TH=roomTheme(R);
  function CX(c){ return (c+0.5)*tw-halfW; }
  function CZ(r){ return (r+0.5)*th-halfH; }
  var c={R:R,K:K,W:W,H:H,tw:tw,th:th,halfW:halfW,halfH:halfH,CX:CX,CZ:CZ,theme:TH,doors:[],meshes:[],RWH:RWH,
    solid:function(cx,cz,sx,sz){ R.propExtra.push({x0:cx-sx/2,x1:cx+sx/2,z0:cz-sz/2,z1:cz+sz/2}); },
    ao:function(cx,cz,sx,sz,s){ K.g('decal').aoPatch(cx,cz,sx,sz,s); }};
  function G(y,x){ return (y>=0&&x>=0&&y<H&&x<W)?R.grid[y][x]:null; }

  /* ---- 楼梯井要挖掉的墙格 ---- */
  var STAIR_CUT={};
  (function(){
    var cx2,cy2;
    for(cy2=0;cy2<H;cy2++) for(cx2=0;cx2<W;cx2++){
      if(R.grid[cy2][cx2]!=='S') continue;
      if((cx2>0&&R.grid[cy2][cx2-1]==='S')||(cy2>0&&R.grid[cy2-1][cx2]==='S')) continue;
      var si=stairInfo(R,cx2,cy2);
      if(si.block!==-1) continue;
      var ii, mx2, my2;
      for(ii=0;ii<(si.longX?si.gw:si.gd);ii++){
        mx2=cx2+si.dx+(si.longX?ii:0); my2=cy2+si.dy+(si.longX?0:ii);
        if(mx2>=0&&my2>=0&&mx2<W&&my2<H&&R.grid[my2][mx2]==='#') STAIR_CUT[mx2+','+my2]=1;
      }
    }
  })();
  function isWall(x,y){ return G(y,x)==='#'&&!STAIR_CUT[x+','+y]; }

  /* ---- 地面：每格一块，棋盘格深浅；教学楼走廊换水磨石 ---- */
  var fy, fx;
  for(fy=0;fy<H;fy++) for(fx=0;fx<W;fx++){
    var fm=TH.floor, fcol=TH.fcol;
    if(R.host==='teach'&&!isRoof&&fy>=16) fm='fterrazzo';
    if(R.id==='lab3'&&fx>34&&fy<15){ fcol=0x7a8086; }                 /* 网络中心：防静电地板 */
    var chk=((fx+fy)&1)?1.0:0.93;
    var shf=chk*(0.96+0.06*hash2(fx+7,fy+13));
    var qx0=-halfW+fx*tw, qz0=-halfH+fy*th;
    K.g(fm).quad(qx0,qz0+th, qx0+tw,qz0+th, qx0+tw,qz0, qx0,qz0, 0, shadeHex(fcol,shf));
  }
  /* ---- 吊顶 ---- */
  if(!isRoof){
    K.g(TH.ceilMat).quadN([-halfW,RWH,-halfH],[halfW,RWH,-halfH],[halfW,RWH,halfH],[-halfW,RWH,halfH],0,-1,0,TH.ceil);
  }

  /* ---- 墙：贪心合并成矩形块 ---- */
  var used={}, x, y;
  for(y=0;y<H;y++) for(x=0;x<W;x++){
    if(!isWall(x,y)||used[x+','+y]) continue;
    var w=1, h=1, ok, k;
    while(x+w<W&&isWall(x+w,y)&&!used[(x+w)+','+y]) w++;
    for(;;){
      if(y+h>=H) break;
      ok=true;
      for(k=0;k<w;k++) if(!isWall(x+k,y+h)||used[(x+k)+','+(y+h)]){ ok=false; break; }
      if(!ok) break;
      h++;
    }
    var a, b;
    for(b=0;b<h;b++) for(a=0;a<w;a++) used[(x+a)+','+(y+b)]=1;
    var wcx=CX(x)+(w-1)*tw/2, wcz=CZ(y)+(h-1)*th/2;
    K.g(TH.wallMat).boxFaces(wcx,RWH/2,wcz,w*tw,RWH,h*th,TH.wall,0.94,isRoof?'nsewu':'nsew');
    if(isRoof) K.box('concrete',wcx,WALLH+0.04,wcz,w*tw+0.08,0.08,h*th+0.08,0xb8b4ac,1.0);   /* 女儿墙压顶 */
  }
  /* ---- 墙脚：踢脚线 + 墙裙 + 腰线，只沿露在外面的那一侧，连续的一段合成一根 ---- */
  if(!isRoof){
    var DIRS=[[0,-1,'n'],[0,1,'s'],[-1,0,'w'],[1,0,'e']], di;
    function exposed(xx,yy,d){
      if(!isWall(xx,yy)) return false;
      var n=G(yy+d[1],xx+d[0]);
      return n!==null&&n!=='#'&&n!=='='&&n!=='O'&&n!=='S'&&!STAIR_CUT[(xx+d[0])+','+(yy+d[1])];
    }
    function trim(x0,y0,x1,y1,d){             /* x0..x1 / y0..y1 是同一条边上连续的墙格 */
      var horiz=(d[1]!==0), len=(horiz?(x1-x0+1):(y1-y0+1))*tw;
      var mx=horiz?(CX(x0)+CX(x1))/2:CX(x0)+d[0]*tw/2, mz=horiz?CZ(y0)+d[1]*th/2:(CZ(y0)+CZ(y1))/2;
      function band(y,h,dep,col,mat){ if(horiz) K.box(mat,mx,y,mz+d[1]*dep/2,len,h,dep,col,1); else K.box(mat,mx+d[0]*dep/2,y,mz,dep,h,len,col,1); }
      band(0.06,0.12,0.016,TH.skirt,'plastic');
      band(0.36,0.48,0.008,TH.low,'plaster');
      band(0.615,0.04,0.022,TH.rail,'wood');
    }
    for(di=0;di<4;di++){
      var d=DIRS[di];
      if(d[1]!==0){
        for(y=0;y<H;y++){ var run=-1; for(x=0;x<=W;x++){ var e=(x<W)&&exposed(x,y,d); if(e&&run<0) run=x; if(!e&&run>=0){ trim(run,y,x-1,y,d); run=-1; } } }
      }else{
        for(x=0;x<W;x++){ var run2=-1; for(y=0;y<=H;y++){ var e2=(y<H)&&exposed(x,y,d); if(e2&&run2<0) run2=y; if(!e2&&run2>=0){ trim(x,run2,x,y-1,d); run2=-1; } } }
      }
    }
  }

  /* ---- 逐格：门、出口、楼梯、家具 ---- */
  for(y=0;y<H;y++){
    for(x=0;x<W;x++){
      var ch=R.grid[y][x]; if(ch===undefined||ch==='.'||ch==='#') continue;
      var cx=CX(x), cz=CZ(y);
      if(ch==='=') { roomDoor(c,x,y,cx,cz); continue; }
      if(ch==='O') { roomExit(c,x,y,cx,cz); continue; }
      if(ch==='S') { roomStairs(c,x,y,cx,cz); continue; }
      K.cap=[];
      if(FURN[ch]) FURN[ch](c,x,y,cx,cz);
      else furnFallback(c,x,y,cx,cz,ch);
      if(K.cap.length&&FOOT_SKIP.indexOf(ch)<0) R.foot[x+','+y]=footMerge(K.cap);
      K.cap=null;
    }
  }
  roomDecor(c,isRoof);
  if(R.spiral){
    for(y=0;y<H;y++) for(x=0;x<W;x++) if(R.grid[y][x]==='O')       /* 门洞上方补到顶 */
      K.box(TH.wallMat,CX(x),(WALLH+RWH)/2,CZ(y),tw,RWH-WALLH,th,TH.wall,0.94);
    buildSpiral(c);
  }
  R.shafts=SHAFT_ACC||[]; SHAFT_ACC=null;
  R.doorSpecs=c.doors;
  var grp=K.build();
  grp.add(buildDoorLeaves(R));
  c.meshes.forEach(function(m){ grp.add(m); });                 /* 黑板上的粉笔字这种单独的网格 */
  return grp;
}

/* ---- 门：墙厚 1 米，门洞两侧有门套；门扇在 +z 一侧（走廊那边）；开着的门扇转 90° 贴在门洞边 ---- */
function roomDoor(c,x,y,cx,cz){
  var K=c.K, R=c.R;
  var l=R.grid[y][x-1], r=R.grid[y][x+1];
  var horiz=(l==='#'||l==='='||r==='#'||r==='=');
  K.frame(cx,cz,horiz?0:Math.PI/2);
  var DTOP=2.10, TH=c.theme;
  K.g(TH.wallMat).boxFaces(0,(DTOP+WALLH)/2,0,1,WALLH-DTOP,1,TH.wall,0.94,'ns');                  /* 过梁（底面被下面的门框木条整个盖住，不画，免得两面重合闪烁） */
  var dbl=(l==='='), dbr=(r==='=');                                                              /* 双开门：只在外侧立门套 */
  if(!dbl) K.bevel('wood',-0.47,DTOP/2,0,0.06,DTOP,1.0,0x3d474e,1.06,0.01);
  if(!dbr) K.bevel('wood', 0.47,DTOP/2,0,0.06,DTOP,1.0,0x3d474e,1.06,0.01);
  K.box('wood',0,DTOP+0.03,0,1.0,0.06,1.0,0x3d474e,1.06);
  var s;
  for(s=-1;s<=1;s+=2){                                                                           /* 门套线（两面） */
    if(!dbl) K.box('wood',-0.53,(DTOP+0.08)/2,s*0.507,0.07,DTOP+0.08,0.014,0x4a545c,1.1);
    if(!dbr) K.box('wood', 0.53,(DTOP+0.08)/2,s*0.507,0.07,DTOP+0.08,0.014,0x4a545c,1.1);
    K.box('wood',0,DTOP+0.11,s*0.507,1.13,0.07,0.014,0x4a545c,1.1);
  }
  K.box('stone',0,0.01,0,0.94,0.02,1.0,0x5a6268,1.05);                                         /* 门槛 */
  if(R.host==='teach'||R.host==='lab'||R.host==='admin'||R.host==='dormN'||R.host==='dormS'){     /* 门牌 */
    if(!dbl){ K.box('plastic',-0.1,2.32,0.52,0.36,0.14,0.02,0xe8e4dc,1.05); K.box('dark',-0.1,2.32,0.531,0.26,0.06,0.002,0x2a3a4a,1); }
  }
  K.unframe();
  /* 门扇单独成一块（buildDoorLeaf）：开门时只重建这一扇，不用整层楼重建 */
  if(c.doors) c.doors.push({x:x,y:y,cx:cx,cz:cz,horiz:horiz,dbl:dbl,dbr:dbr});
}
/* 门扇：关着的在门洞里；开着的转 90° 贴着门洞边。一间房所有的门扇画进同一个 Kit（只多几次绘制） */
function buildDoorLeaf(K,R,d){
  var isOpen=(typeof OPENDOORS!=='undefined')?!!OPENDOORS[doorKeyAt(R,d.x,d.y)]:false;
  var dbl=d.dbl, dbr=d.dbr;
  K.frame(d.cx,d.cz,d.horiz?0:Math.PI/2);
  var hingeX=dbl?0.47:-0.43, sw=dbl?-1:1;                     /* 双开门的右扇铰链在右边 */
  if(dbr&&!dbl){ hingeX=-0.47; sw=1; }
  var lw=0.86, lz=0.38, lh=2.04;
  if(!isOpen){
    var lx=hingeX+sw*lw/2;
    K.bevel('wood',lx,lh/2+0.01,lz,lw,lh,0.045,0x222a30,1.0,0.008);                              /* 门扇 */
    K.box('glass',lx,1.55,lz,0.28,0.42,0.05,0x5a7080,1.0);                                       /* 门上的小窗 */
    K.box('dark',lx,1.55,lz,0.30,0.44,0.03,0x0a0e10,1.0);
    K.box('metal',lx,0.15,lz+0.024,lw*0.9,0.22,0.004,0x6a7276,1.1);                              /* 踢脚板 */
    var hx=hingeX+sw*(lw-0.10);
    K.cyl('metal',hx,1.0,lz+0.03,0.025,0.025,0.012,8,0x8d9aa2,1.25);
    K.rod('metal',hx,1.02,lz+0.05,hx-sw*0.12,1.02,lz+0.05,0.01,0.01,5,0x8d9aa2,1.25);           /* 把手 */
    K.cyl('metal',hx,1.0,lz-0.042,0.025,0.025,0.012,8,0x8d9aa2,1.25);
    K.rod('metal',hx,1.02,lz-0.06,hx-sw*0.12,1.02,lz-0.06,0.01,0.01,5,0x8d9aa2,1.25);
  }else{
    var oz=lz+lw/2;                                                                               /* 转开，贴着门洞 */
    K.bevel('wood',hingeX+sw*0.03,lh/2+0.01,oz,0.045,lh,lw,0x222a30,1.0,0.008);
    K.box('glass',hingeX+sw*0.03,1.55,oz,0.05,0.42,0.28,0x5a7080,1.0);
  }
  K.unframe();
}
function buildDoorLeaves(R){
  var K=new Kit({cull:{floor:0.002}});
  (R.doorSpecs||[]).forEach(function(d){ buildDoorLeaf(K,R,d); });
  var g=K.build(); g.name='doorleaves';
  return g;
}
/* 开门 / 读档以后：只把门扇按 OPENDOORS 重建（以前整层楼重建）；x、y 留着兼容调用处 */
function roomDoorRefresh(R,x,y){
  var grp=GLR.roomMesh; if(!grp||!R||!R.doorSpecs) return;
  var old=grp.getObjectByName('doorleaves');
  if(old){ grp.remove(old); old.traverse(function(o){ if(o.geometry) o.geometry.dispose(); }); }
  var g=buildDoorLeaves(R);
  try{ shadeMarkMesh(g); }catch(e){}
  grp.add(g);
}
/* ---- 外墙上的出口：门框 + 两扇玻璃门 + 推杠 + 门上的安全出口灯 ---- */
function roomExit(c,x,y,cx,cz){
  var K=c.K, R=c.R, W=c.W, H=c.H;
  var onB=(y===0||y===H-1||x===0||x===W-1);
  if(!onB) return;
  var vert=(x===0||x===W-1), sgn=(x===0||y===0)?-1:1;
  var rot=vert?(sgn>0?Math.PI/2:-Math.PI/2):(sgn>0?0:Math.PI);
  K.frame(cx,cz,rot);                       /* 局部 +z 朝外 */
  var TH=c.theme;
  K.g(TH.wallMat).boxFaces(0,(2.30+WALLH)/2,0,1,WALLH-2.30,1,TH.wall,0.94,'nsd');               /* 门头 */
  K.bevel('metal',-0.46,1.15,0.30,0.08,2.30,0.16,0x39424a,1.05,0.01);
  K.bevel('metal', 0.46,1.15,0.30,0.08,2.30,0.16,0x39424a,1.05,0.01);
  K.bevel('metal',0,2.26,0.30,1.0,0.08,0.16,0x39424a,1.05,0.01);
  K.box('glass',-0.215,1.12,0.30,0.40,2.12,0.02,0x6a8a9a,1.0);                                  /* 玻璃（能看见外面的天） */
  K.box('glass', 0.215,1.12,0.30,0.40,2.12,0.02,0x6a8a9a,1.0);
  K.box('sky',0,1.12,0.36,0.86,2.14,0.004,0xffffff,0.55);
  K.box('metal',0,1.12,0.30,0.04,2.18,0.05,0x39424a,1.0);
  K.rod('metal',-0.40,1.02,0.24,-0.04,1.02,0.24,0.016,0.016,6,0xb8c0c2,1.2);                    /* 推杠 */
  K.rod('metal', 0.04,1.02,0.24, 0.40,1.02,0.24,0.016,0.016,6,0xb8c0c2,1.2);
  K.box('emit',0,2.48,-0.505,0.42,0.16,0.04,0x37c47a,1.0);                                       /* 安全出口 */
  K.box('emit',-0.12,2.48,-0.53,0.08,0.10,0.004,0xe8ffe8,1.0);
  K.box('fconcrete',0,0.01,0.35,1.0,0.02,0.4,0x7a7a72,1.0);
  K.unframe();
}
/* ---- 楼梯：踏步（水磨石 + 防滑条 + 踢面）、两侧栏杆和木扶手、梯井挡墙 ---- */
/* 不按模型占地挡人的：门垫吊牌（L）、讲台旁的东西走得过去的那些在这里列 */
var FOOT_SKIP=['L'];
/* 合并：被别的矩形整个包住的去掉，剩下的按面积从大到小，碰撞先查大的 */
function footMerge(L){
  var out=[], i, j;
  L.sort(function(a,b){ return (b.x1-b.x0)*(b.z1-b.z0)-(a.x1-a.x0)*(a.z1-a.z0); });
  for(i=0;i<L.length;i++){
    var a=L[i], inside=false;
    for(j=0;j<out.length;j++){ var b=out[j]; if(a.x0>=b.x0-0.01&&a.x1<=b.x1+0.01&&a.z0>=b.z0-0.01&&a.z1<=b.z1+0.01){ inside=true; break; } }
    if(!inside) out.push(a);
  }
  return out;
}
function roomStairs(c,x,y,cx,cz){
  var K=c.K, R=c.R, tw=c.tw, th=c.th;
  if((x>0&&R.grid[y][x-1]==='S')||(y>0&&R.grid[y-1][x]==='S')) return;   /* 一组只建一次 */
  var sInfo=stairInfo(R,x,y);
  var gw=sInfo.gw, gd=sInfo.gd, longX=sInfo.longX;
  cx=cx+(gw-1)*tw*0.5; cz=cz+(gd-1)*th*0.5;
  var ax=longX?'z':'x';
  var dxs=sInfo.dx, dys=sInfo.dy, bestBlock=sInfo.block;
  var maxRun=(bestBlock===-2)?2.60:1.30;
  var tread=0.26, rise=0.158;
  var nR=Math.max(4,Math.min(10,Math.round(maxRun/tread)));
  var baseOff=-0.5;
  var wid=(longX?gw:gd)*tw, halfW2=wid*0.5-0.05;
  var st2, runOff, hgt;
  function P(off){ return {x:cx+(ax==='x'?dxs*off:0), z:cz+(ax==='z'?dys*off:0)}; }
  function bx(off,y,along,h,across,col,sh,mat){
    var p=P(off);
    K.box(mat||'fterrazzo',p.x,y,p.z, ax==='z'?across:along, h, ax==='z'?along:across, col, sh);
  }
  for(st2=0; st2<nR; st2++){
    runOff=baseOff+st2*tread+tread*0.5; hgt=(st2+1)*rise;
    bx(runOff,hgt-0.02,tread,0.04,wid,PALETTE.stair,1.04-st2*0.008,'terrazzo');                 /* 踏面 */
    bx(runOff,(hgt-0.04)/2,tread,Math.max(0.02,hgt-0.04),wid*0.999,0x8a8680,0.95,'concrete');   /* 下面的实心 */
    bx(runOff-tread*0.44,hgt-0.003,0.05,0.008,wid*0.96,0x5a5e60,1.0,'metal');                     /* 防滑条 */
    bx(runOff-tread*0.5+0.004,hgt-rise/2,0.008,rise-0.04,wid,0xd8d4cc,1.0,'plaster');            /* 踢面 */
  }
  /* 栏杆：每两级一根立杆，顶上一根连续的木扶手。扶手到 2.2 米就停：
     再往上会穿过楼梯下沿那道 2.3 米高的梁（以前最上面两级的扶手和立杆都插进梁里） */
  var s2, railTop=2.20-0.92;
  for(s2=-1;s2<=1;s2+=2){
    var pts=[];
    for(st2=0; st2<nR; st2++){
      runOff=baseOff+st2*tread+tread*0.5; hgt=(st2+1)*rise;
      if(hgt>railTop) break;
      var p=P(runOff), side=s2*halfW2;
      var px=p.x+(ax==='z'?side:0), pz=p.z+(ax==='x'?side:0);
      if(st2%2===0) K.rod('metal',px,hgt,pz,px,hgt+0.92,pz,0.016,0.016,5,0x6d7376,1.0);
      pts.push([px,hgt+0.92,pz]);
    }
    if(pts.length>1){
      var a=pts[0], b=pts[pts.length-1];
      K.rod('wood',a[0],a[1],a[2],b[0],b[1],b[2],0.03,0.03,6,0x8b3a2e,1.06);
      K.rod('metal',a[0],a[1]-0.45,a[2],b[0],b[1]-0.45,b[2],0.01,0.01,4,0x6d7376);
    }
  }
  var shaftD=nR*tread, farOff=baseOff+shaftD;
  bx(farOff+0.06,WALLH*0.5,0.12,WALLH,wid,0x0d1114,0.75,'dark');                             /* 不再比梯井宽：旁边墙上有门时会插进门框 */                         /* 梯井尽头：黑的 */
  var midOff=baseOff+shaftD*0.5, mp=P(midOff), TH=c.theme;
  /* 梯井两侧的挡墙：那一侧本来就是墙（或门）就不再建，以前贴着外墙那面会把墙上的门框、窗戳穿 */
  function sideOpen(sd){
    var k, off, p2, gx, gy, ch;
    for(k=0;k<3;k++){
      off=baseOff+shaftD*(k+0.5)/3; p2=P(off);
      if(ax==='z') p2.x+=sd*(halfW2+0.11); else p2.z+=sd*(halfW2+0.11);
      gx=Math.floor((p2.x+c.halfW)/tw); gy=Math.floor((p2.z+c.halfH)/th);
      ch=R.grid[gy]&&R.grid[gy][gx];
      if(ch&&ch!=='#'&&ch!=='='&&ch!=='O') return true;
    }
    return false;
  }
  var sd2;
  for(sd2=-1;sd2<=1;sd2+=2){
    if(!sideOpen(sd2)) continue;
    /* 只建在楼梯自己那几格里：梯井伸进后面墙里的那一截有墙挡着，挡墙再往里伸会戳穿墙上的门框 */
    var runCells=(bestBlock===-2)?99:(ax==='z'?gd*th:gw*tw), sLo=Math.max(Math.min(baseOff,farOff),-runCells*0.5), sHi=Math.min(Math.max(baseOff,farOff),runCells*0.5);
    var sp2=P((sLo+sHi)*0.5), sLen=sHi-sLo;
    if(ax==='z') K.box(TH.wallMat,sp2.x+sd2*(halfW2+0.11),WALLH*0.5,sp2.z,0.12,WALLH,sLen,PALETTE.wall,sd2<0?0.88:0.82);
    else K.box(TH.wallMat,sp2.x,WALLH*0.5,sp2.z+sd2*(halfW2+0.11),sLen,WALLH,0.12,PALETTE.wall,sd2<0?0.88:0.82);
  }
  bx(midOff,2.30-0.07,shaftD,0.14,wid+0.14,0x2c3034,0.72,'concrete');                        /* 楼梯下沿的梁 */
  bx(baseOff-0.06,(2.30+WALLH)*0.5,0.10,WALLH-2.30,wid+0.10,PALETTE.wall,0.90,TH.wallMat);
  var c0=Math.min(baseOff, farOff), c1=Math.max(baseOff, farOff);
  var ex0,ex1,ez0,ez1;
  if(ax==='z'){ ex0=cx-halfW2-0.18; ex1=cx+halfW2+0.18; ez0=cz+Math.min(dys*c0,dys*c1); ez1=cz+Math.max(dys*c0,dys*c1); }
  else { ez0=cz-halfW2-0.18; ez1=cz+halfW2+0.18; ex0=cx+Math.min(dxs*c0,dxs*c1); ex1=cx+Math.max(dxs*c0,dxs*c1); }
  R.stairExtra.push({x0:ex0,x1:ex1,z0:ez0,z1:ez1});
}

/* 一扇嵌在墙里的窗：内侧窗框 + 透进天光的玻璃 + 窗台。nx/nz 是窗朝屋里的方向 */
function wallWindow(K,x,z,nx,nz,w,y0,y1,mull){
  var rot=Math.atan2(nx,nz);                    /* 局部 +z 朝屋里 */
  shaftNote(x,z,nx,nz,w,y0,y1);
  K.frame(x,z,rot);
  var h=y1-y0, ym=(y0+y1)/2;
  K.box('sky',0,ym,0.004,w,h,0.004,0xffffff,0.9);
  K.box('metal',0,y1+0.03,0.03,w+0.10,0.06,0.06,0x9aa4a8,1.05);
  K.box('metal',0,y0-0.02,0.07,w+0.16,0.04,0.14,0xd8d4cc,1.0);                             /* 窗台 */
  K.box('metal',-w/2-0.03,ym,0.03,0.06,h+0.06,0.06,0x9aa4a8,1.05);
  K.box('metal', w/2+0.03,ym,0.03,0.06,h+0.06,0.06,0x9aa4a8,1.05);
  var k, n=mull||2;
  for(k=1;k<n;k++) K.box('metal',-w/2+w*k/n,ym,0.025,0.04,h,0.04,0x9aa4a8,1.05);
  K.box('metal',0,y0+h*0.62,0.025,w,0.035,0.04,0x9aa4a8,1.05);
  K.unframe();
}
/* 吸顶灯盘：金属框 + 发光面 */
function ceilingLight(K,x,z,lw,ld,rot,state){
  K.frame(x,z,rot||0);
  K.box('metal',0,WALLH-0.025,0,lw+0.08,0.05,ld+0.08,0x9aa4a8,1.0);
  K.g(lampMat(state)).quadN([-lw/2,WALLH-0.052,-ld/2],[lw/2,WALLH-0.052,-ld/2],[lw/2,WALLH-0.052,ld/2],[-lw/2,WALLH-0.052,ld/2],0,-1,0,state==='off'?0x8a9094:0xdcecf4);
  K.unframe();
}

/* ---- 每种房间自己的布置 ---- */
function roomDecor(c,isRoof){
  var K=c.K, R=c.R, W=c.W, H=c.H, tw=c.tw, th=c.th, halfW=c.halfW, halfH=c.halfH, CX=c.CX, CZ=c.CZ, i, x;
  var teachFl=(R.host==='teach'&&R.floor>=1&&R.floor<=5);

  /* 外墙上的窗（教学楼教室前墙是黑板，走廊外墙是宣传栏，不开） */
  var winHosts={admin:1,lab:1,dormN:1,dormS:1,canteen:1,guard:1};
  if(winHosts[R.host]||R.id==='gear1'){
    var rr, side;
    for(side=0;side<2;side++){
      rr=side?H-1:0;
      var inner=side?H-2:1, nz=side?-1:1;
      for(x=2;x<W-2;x+=3){
        if(R.grid[rr][x]!=='#'||R.grid[rr][x-1]!=='#'||R.grid[rr][x+1]!=='#') continue;
        var ic=R.grid[inner][x];
        if(ic==='#'||ic==='S'||R.grid[inner][x-1]==='#'||R.grid[inner][x+1]==='#') continue;
        if(R.grid[inner][x-1]==='S'||R.grid[inner][x+1]==='S') continue;     /* 窗有 1.5 米宽：旁边一格是楼梯也不开，梯井的梁会插进窗里 */
        if(R.grid[inner][x]==='O') continue;
        wallWindow(K,CX(x),CZ(rr)+nz*th*0.5,0,nz,1.5,1.0,2.25,2);
        if(R.host==='dormN'||R.host==='dormS'||R.host==='admin'){                 /* 宿舍、办公室挂窗帘（拉在两边） */
          var ccol=(R.host==='admin')?0x8a8e88:[0x5a7a9a,0x9a7a5a,0x7a8a6a,0xb8a890,0x8a6a7a][(x*7+rr)%5];
          propCurtains(K,CX(x),CZ(rr)+nz*th*0.5,nz>0?0:Math.PI,1.5,1.02,2.42,ccol,x+rr);
        }
      }
    }
  }

  /* 实验楼（机房以外）：顶上走管道，墙角一个洗眼器 */
  if(R.host==='lab'&&R.floor<=5&&R.id!=='lab3'){
    var lz2=-halfH+1.0;
    K.rod('metal',-W*0.48,2.86,lz2+0.55,W*0.48,2.86,lz2+0.55,0.05,0.05,8,0x8a9298,1.05);
    K.rod('metal',-W*0.48,2.74,lz2+1.15,W*0.48,2.74,lz2+1.15,0.035,0.035,8,0xb46a3a,1.05);
    for(x=-20;x<=20;x+=8){ K.box('metal',x,2.92,lz2+0.55,0.04,0.12,0.04,0x6a7276,1); K.box('metal',x,2.85,lz2+1.15,0.04,0.22,0.04,0x6a7276,1); }
    if(R.floor===2){
      /* 通风橱：靠在第一间、最后一间的南墙上 */
      var fh, hoodC=[3.5,43.5];
      for(fh=0;fh<2;fh++){
        var fx=-halfW+hoodC[fh]*tw, fz=-halfH+15*th-0.46;
        K.bevel('metal',fx,0.45,fz,1.90,0.90,0.86,0x6f7a80,1.05,0.015);
        K.bevel('stone',fx,0.92,fz,1.94,0.04,0.88,0x39434a,1.0,0.01);
        K.box('glass',fx,1.42,fz-0.40,1.60,0.90,0.02,0x9fc4d8,1.25);                          /* 玻璃拉门 */
        K.box('dark',fx,1.42,fz+0.02,1.70,0.96,0.76,0x1a2026,1.0);                            /* 里面 */
        K.bevel('metal',fx,2.10,fz,1.94,0.40,0.90,0x6f7a80,1.05,0.015);
        K.cyl('metal',fx,2.30,fz,0.14,0.12,0.70,10,0x8a9298,1.0);                             /* 排风管 */
        K.box('metal',fx,1.88,fz-0.42,1.70,0.03,0.03,0x4a545a,1.1);
        c.solid(fx,fz,1.9,0.9);
      }
    }
    K.rod('plastic',-halfW+1.0,0,-halfH+1.2,-halfW+1.0,1.0,-halfH+1.2,0.04,0.04,6,0x5aa07a,1.1);   /* 洗眼器 */
    K.cyl('plastic',-halfW+1.0,1.0,-halfH+1.4,0.12,0.08,0.06,10,0x5aa07a,1.1);
  }

  /* 连廊：两侧整排窗，地上一条导视带 */
  if(R.host==='c1'||R.host==='c2'){
    var cy2;
    for(cy2=1;cy2<H-1;cy2+=2){
      var wz2=CZ(cy2)+0.5;
      wallWindow(K,-halfW+tw,wz2,1,0,1.8,0.95,2.40,2);
      wallWindow(K, halfW-tw,wz2,-1,0,1.8,0.95,2.40,2);
    }
    K.g('decal').quad(-0.15,-(H-2)*th*0.48,0.15,-(H-2)*th*0.48,0.15,(H-2)*th*0.48,-0.15,(H-2)*th*0.48,0.006,0x59636b);
  }

  if(teachFl){
    var zWallS=-halfH+15*th;            /* 教室南墙（走廊那侧） */
    var zWallN=-halfH+21*th;            /* 走廊南外墙 */
    /* 走廊中线：虚线 */
    var sx;
    for(sx=1;sx<W-1;sx+=2) K.g('decal').quad(-halfW+sx*tw,-halfH+18.45*th,-halfW+(sx+1)*tw,-halfH+18.45*th,-halfW+(sx+1)*tw,-halfH+18.55*th,-halfW+sx*tw,-halfH+18.55*th,0.006,0x59636b);
    /* 储物柜：一组四门，门缝、把手、通风孔 */
    var lx;
    for(lx=3;lx<W-3;lx+=4){
      if(lx>=56&&lx<=61) continue;
      var lcx=-halfW+(lx+0.5)*tw, lz=zWallS+th+0.24;
      K.bevel('metal',lcx,0.86,lz,0.86,1.72,0.42,0x39424a,0.98,0.01);
      var dk;
      for(dk=0;dk<4;dk++){
        var dxl=lcx-0.32+dk*0.215;
        K.box('dark',dxl+0.107,0.86,lz+0.211,0.004,1.60,0.004,0x1a2026,1);
        K.box('metal',dxl+0.07,1.05,lz+0.215,0.02,0.10,0.012,0x8a949a,1.2);
        K.box('dark',dxl,1.55,lz+0.212,0.12,0.03,0.002,0x1a2026,1);
        K.box('dark',dxl,1.50,lz+0.212,0.12,0.03,0.002,0x1a2026,1);
      }
      c.solid(lcx, lz, 0.86, 0.42);
    }
    /* 走廊外墙：宣传栏 + 消防栓箱 */
    var bx2;
    for(bx2=6;bx2<W-6;bx2+=13){
      var bb0=Math.floor(bx2+1.3), bbOK=true, bi;
      for(bi=-1;bi<=1;bi++){ var brow=R.grid.length-1; if(!R.grid[brow]||R.grid[brow][bb0+bi]!=='#'){ bbOK=false; break; } }
      if(!bbOK) continue;
      var bcx2=-halfW+(bx2+0.5)*tw;
      K.bevel('metal',bcx2,1.85,zWallN-0.04,2.6,0.98,0.06,0x1a2126,1.0,0.01);
      K.box('paper',bcx2,1.85,zWallN-0.075,2.5,0.90,0.01,0x8e9a94,1.0);
      for(bi=0;bi<5;bi++) K.box('paper',bcx2-1.0+bi*0.5,1.85+(hash2(bi,bx2)-0.5)*0.3,zWallN-0.082,0.38,0.5,0.004,[0xe8e4dc,0xd8c8a8,0xc8d8e0][bi%3],1);
      K.box('glass',bcx2,1.85,zWallN-0.09,2.5,0.90,0.01,0xb8c8d0,1.1);
      var fxb=-halfW+(bx2+7.5)*tw;
      K.bevel('metal',fxb,0.95,zWallN-0.08,0.70,0.90,0.16,0x7a3a33,1.0,0.01);
      K.box('glass',fxb,1.0,zWallN-0.162,0.40,0.50,0.004,0xb8c8d0,1.1);
      K.box('paper',fxb,1.33,zWallN-0.162,0.5,0.08,0.002,0xe8e4dc,1);
    }
    /* 走廊顶上的梁 */
    var bmz=18.5*th-halfH, bmx;
    for(bmx=0;bmx<W;bmx+=7) K.box('concrete',CX(bmx),2.86,bmz,0.22,0.28,th*4.6,0xb4afa6,0.96);
    /* 教室：黑板、高窗、后墙的钟和黑板报、讲台上方的广播 */
    for(i=0;i<CLS_SPAN.length;i++){
      var c0=CLS_SPAN[i][0], c1b=CLS_SPAN[i][1];
      var bcx=(CX(c0)+CX(c1b))/2, bwid=(c1b-c0+1)*tw*0.72, wz=-halfH+tw;
      K.bevel('metal',bcx,1.70,wz+0.04,bwid+0.12,1.17,0.06,0x8a9298,1.0,0.012);           /* 黑板边框 */
      K.box('board',bcx,1.70,wz+0.075,bwid,1.05,0.01,0x2a3a34,1.0);
      K.box('metal',bcx,1.15,wz+0.12,bwid+0.12,0.04,0.14,0x6a7276,1.0);                    /* 粉笔槽 */
      K.box('plastic',bcx-0.6,1.18,wz+0.11,0.08,0.015,0.015,0xe8e8e0,1);
      K.box('plastic',bcx-0.5,1.18,wz+0.13,0.06,0.015,0.015,0xd86a6a,1);
      K.bevel('wood',bcx+0.8,1.19,wz+0.12,0.16,0.05,0.07,0x3a3028,1,0.01);                  /* 板擦 */
      var hwid=(c1b-c0+1)*tw*0.82, mu;
      K.box('sky',bcx,2.63,wz+0.007,hwid,0.46,0.004,0xffffff,0.9);                         /* 高窗 */
      shaftNote(bcx,wz,0,1,hwid,2.40,2.86);
      K.box('metal',bcx,2.89,wz+0.03,hwid+0.16,0.06,0.06,0x39434a,1.0);
      K.box('metal',bcx,2.37,wz+0.05,hwid+0.16,0.06,0.10,0x39434a,1.0);
      for(mu=1;mu<5;mu++) K.box('metal',bcx-hwid/2+(hwid/5)*mu,2.63,wz+0.03,0.045,0.50,0.05,0x39434a,1.05);
      K.bevel('plastic',bcx,2.62,wz+0.06,0.10,0.001,0.10,0x2a2a2a,1,0);
      K.bevel('plastic',bcx+bwid/2+0.35,2.55,wz+0.08,0.24,0.32,0.14,0x2a2e32,1,0.02);      /* 广播喇叭 */
      K.box('dark',bcx+bwid/2+0.35,2.55,wz+0.152,0.18,0.24,0.004,0x0a0c0e,1);
      var zS=zWallS-0.04;                                                                   /* 后墙内表面 */
      K.rod('plastic',bcx,2.58,zS+0.02,bcx,2.58,zS-0.05,0.29,0.29,16,0x1b1f22,1.0);        /* 钟 */
      K.rod('paper',bcx,2.58,zS-0.05,bcx,2.58,zS-0.055,0.25,0.25,16,0xc6cfcb,1.0);
      K.box('dark',bcx,2.64,zS-0.06,0.025,0.16,0.004,0x22282a,1);
      K.box('dark',bcx+0.05,2.58,zS-0.06,0.11,0.025,0.004,0x22282a,1);
      var bbx=CX(c0)+1.25;                                                                  /* 黑板报，让开门 */
      K.bevel('board',bbx,1.55,zWallS-0.02,2.2,1.05,0.04,0x23302a,1.0,0.01);
      var bk;
      for(bk=0;bk<6;bk++) K.box('emit',bbx-0.8+bk*0.3,1.75-((bk*7)%4)*0.12,zWallS-0.042,0.20+hash2(bk,i)*0.1,0.03,0.002,[0xe8e0c8,0xd8a0a0,0xa8c8e0][bk%3],0.55);
      classroomExtras(c,i,c0,c1b,bcx,wz,zWallS);
    }
    corridorExtras(c,zWallS,zWallN);
  }

  if(R.id==='gear1'){
    /* 一张乒乓球台 + 角落里一筐篮球 */
    var ttx=1.9, ttz=0.1, lx2, lz3;
    K.bevel('wood',ttx,0.76,ttz,1.52,0.04,2.74,0x1f3f6e,1.15,0.008);
    K.box('paper',ttx,0.781,ttz,0.02,0.002,2.70,0xe8e8e8,1.0);
    K.box('paper',ttx-0.75,0.781,ttz,0.02,0.002,2.70,0xe8e8e8,1.0);
    K.box('paper',ttx+0.75,0.781,ttz,0.02,0.002,2.70,0xe8e8e8,1.0);
    for(lx2=-1;lx2<=1;lx2+=2) for(lz3=-1;lz3<=1;lz3+=2) K.rod('metal',ttx+lx2*0.62,0,ttz+lz3*1.10,ttx+lx2*0.62,0.74,ttz+lz3*1.10,0.025,0.025,6,0x3a3f42);
    K.box('fabric',ttx,0.86,ttz,1.60,0.15,0.01,0xd8d8d2,0.95);                            /* 球网 */
    K.rod('metal',ttx-0.80,0.76,ttz,ttx-0.80,0.94,ttz,0.012,0.012,5,0x3a3f42);
    K.rod('metal',ttx+0.80,0.76,ttz,ttx+0.80,0.94,ttz,0.012,0.012,5,0x3a3f42);
    c.solid(ttx,ttz,1.52,2.74);
    K.bevel('metal',-2.4,0.30,1.4,0.8,0.6,0.6,0x5a5f62,1.0,0.02);
    var bb3;
    for(bb3=0;bb3<4;bb3++) K.blob('plastic',-2.6+(bb3%2)*0.4,0.71,1.25+((bb3>>1)*0.3),0.12,0.12,0.12,0xc0602a,1.0,8);
    c.solid(-2.4,1.4,0.8,0.6);
  }

  if(R.id==='garage1'){
    /* 车位线、柱子上的黄黑警示带、顶上的管道 */
    var gy, gxx;
    for(gxx=0;gxx<W;gxx++) for(gy=0;gy<H;gy++){
      if(R.grid[gy][gxx]==='V'){
        var vx=CX(gxx), vz=CZ(gy);
        K.g('decal').quad(vx-2.2,vz-1.3,vx+2.2,vz-1.3,vx+2.2,vz-1.22,vx-2.2,vz-1.22,0.006,0xd8d4c4);
        K.g('decal').quad(vx-2.2,vz+1.22,vx+2.2,vz+1.22,vx+2.2,vz+1.3,vx-2.2,vz+1.3,0.006,0xd8d4c4);
        K.g('decal').quad(vx-2.28,vz-1.3,vx-2.2,vz-1.3,vx-2.2,vz+1.3,vx-2.28,vz+1.3,0.006,0xd8d4c4);
      }
      if(R.grid[gy][gxx]==='#'&&gxx>0&&gy>0&&gxx<W-1&&gy<H-1){
        var pcx=CX(gxx), pcz=CZ(gy), kb;
        for(kb=0;kb<4;kb++) K.box('plastic',pcx,0.15+kb*0.25,pcz,1.02,0.12,1.02,kb%2?0x1a1a18:0xc8a830,1.0);
      }
    }
    for(gy=3;gy<H-2;gy+=7){
      K.rod('metal',-halfW+1,2.82,CZ(gy),halfW-1,2.82,CZ(gy),0.08,0.08,8,0x4a4e50);             /* 排风管 */
      K.rod('metal',-halfW+1,2.90,CZ(gy)+1.2,halfW-1,2.90,CZ(gy)+1.2,0.035,0.035,8,0xa83228,1.0); /* 消防喷淋管（红） */
      if(!lodLow()) for(gxx=-halfW+3;gxx<halfW-2;gxx+=3){
        K.rod('metal',gxx,2.90,CZ(gy)+1.2,gxx,2.80,CZ(gy)+1.2,0.012,0.012,6,0xa83228,1.0);
        K.lathe('metal',gxx,2.76,CZ(gy)+1.2,[[0.0,0],[0.03,0.01],[0.012,0.04]],8,0xc8b06a,1.2);  /* 喷头 */
      }
    }
    K.g('decal').quad(-halfW+1,CZ(13)-0.06,halfW-4,CZ(13)-0.06,halfW-4,CZ(13)+0.06,-halfW+1,CZ(13)+0.06,0.006,0xc8b24a);   /* 车道中线 */
  }

  toiletTiles(c);
  if(R.host==='admin') officePlants(c);
  if(!isRoof&&R.host!=='bell') roomDecay(c);
  /* 吸顶灯盘 */
  if(!isRoof&&R.host!=='bell'){
    /* 灯管：真开着灯的地方（world.js 的点光源）亮着，别处的熄着或快坏了——一层楼不会是整整齐齐一片亮 */
    if(teachFl){
      var nl=0;
      for(x=3;x<W-3;x+=9){ var near=Math.abs(CX(x))<10; ceilingLight(K,CX(x),CZ(18),1.8,0.24,0,near?(nl++===1?'dying':'on'):((x/9|0)%2?'dying':'off')); }
      var cs=CLS_SPAN, ci, LIT={5:1,21:1,45:1};
      for(ci=0;ci<cs.length;ci++){                       /* 教室：吊装的护眼灯，两排各三盏；没开灯的教室全熄着，只剩一盏在抽 */
        var mx=(CX(cs[ci][0])+CX(cs[ci][1]))/2, lr, lc, lit=!!LIT[cs[ci][0]];
        for(lr=0;lr<2;lr++) for(lc=-1;lc<=1;lc++){
          var dying=((lr*3+lc+1+ci*2)%6)===4;
          propHangLamp(K,mx+lc*2.2,CZ(lr?10:4),1.2,0.22,WALLH,2.68,Math.PI/2,dying?'dying':(lit?'on':'off'));
        }
      }
    }else if(R.id!=='garage1'){
      var nk=0;
      for(x=3;x<W-3;x+=9) ceilingLight(K,CX(x),CZ(Math.floor(H*0.5)),1.8,0.24,0,(nk++%3===2)?'dying':'on');
    }else{
      ceilingLight(K,CX(W-6),CZ(13),1.2,0.20,0);       /* 车库最里面那一盏 */
    }
  }
}

/* ---- 教室里的东西：吊扇、投影机、烟感、柜式空调、卫生角、垃圾桶、开关插座、墙上的标语框 ----
   c0..c1b：这间教室的列；bcx：黑板中心；wz：前墙（黑板那面）内表面；zWallS：后墙内表面 */
function classroomExtras(c,i,c0,c1b,bcx,wz,zWallS){
  var K=c.K, CX=c.CX, CZ=c.CZ, xl=CX(c0)-0.5, xr=CX(c1b)+0.5, mx=(xl+xr)/2;
  propCeilFan(K,mx-1.8,CZ(7),WALLH,i*3+1); propCeilFan(K,mx+1.8,CZ(7),WALLH,i*3+2);
  c.meshes.push(chalkBoard(bcx,1.70,wz+0.0815,(c1b-c0+1)*0.72*0.96,0.98,(c.R.floor||1)*7+i));
  propProjector(K,mx,CZ(6),WALLH,0);
  propSmoke(K,mx,CZ(8.5),WALLH);
  /* 前面左边角上一台柜式空调 */
  propACCabinet(K,xl+0.30,wz,0); c.solid(xl+0.30,wz+0.15,0.52,0.32);
  /* 后面右边角：卫生角 + 垃圾桶 */
  var cz2=zWallS;
  propCleaning(K,xr-0.62,cz2,Math.PI); c.solid(xr-0.62,cz2-0.22,1.0,0.44);
  K.lathe('plastic',xr-1.45,0,cz2-0.22,[[0.15,0],[0.19,0.55],[0.20,0.56]],14,0x3a6a4a,1.0);
  K.lathe('dark',xr-1.45,0.50,cz2-0.22,[[0.0,0],[0.18,0]],12,0x1a1e1c,1.0);
  c.solid(xr-1.45,cz2-0.22,0.42,0.42);
  /* 后门旁的开关、前墙下的插座 */
  var dx=CX(c0+4)+0.5;
  propSwitch(K,dx+0.28,1.35,zWallS,Math.PI,3);
  propSocket(K,mx+2.9,0.30,wz,0); propSocket(K,mx-2.9,0.30,wz,0);
  /* 两侧墙上的标语框（名人名言、课程表、班级公约） */
  var papers=[0xe8d8a8,0xc8d8e0,0xe0d0c0], k;
  for(k=0;k<2;k++){
    propFrame(K,xl,1.75,CZ(5+k*5),Math.PI/2,0.62,0.82,papers[(i+k)%3],0x3a3028,i*4+k);
    propFrame(K,xr,1.75,CZ(5+k*5),-Math.PI/2,0.62,0.82,papers[(i+k+1)%3],0x3a3028,i*4+k+2);
  }
}
/* ---- 教学楼走廊：楼梯口和出口挂的安全出口灯、应急灯、饮水机、分类垃圾桶、监控、烟感 ---- */
function corridorExtras(c,zWallS,zWallN){
  var K=c.K, R=c.R, CX=c.CX, CZ=c.CZ, W=c.W, H=c.H, x, k;
  var zc=(zWallS+1+zWallN)/2;
  /* 楼梯、出口：在格子 21 行（南外墙）上。门洞前面吊一块双面的出口灯，顺着走廊的方向看得见 */
  for(x=0;x<W-1;x++){
    var ch=R.grid[H-1][x];
    if((ch==='S'||ch==='O')&&R.grid[H-1][x+1]===ch&&(x===0||R.grid[H-1][x-1]!==ch)){
      var sx=CX(x)+0.5, sz=zWallN-0.6;
      K.rod('metal',sx,2.80,sz-0.1,sx,WALLH,sz-0.1,0.004,0.004,4,0x9aa0a4,1.0);
      K.rod('metal',sx,2.80,sz+0.1,sx,WALLH,sz+0.1,0.004,0.004,4,0x9aa0a4,1.0);
      propExitSign(K,sx,2.72,sz-0.022,0,ch==='O'); propExitSign(K,sx,2.72,sz+0.022,Math.PI,ch==='O');
    }
  }
  /* 应急灯：教室门之间、走廊北墙上 */
  for(k=0;k<CLS_SPAN.length;k++) propEmergencyLight(K,CX(CLS_SPAN[k][0])+1.0,2.62,zWallS+1,0);
  /* 厕所隔墙外面：饮水机 + 分类垃圾桶 */
  var tx=-1;
  for(x=W-2;x>0;x--) if(R.grid[H-5]&&R.grid[H-5][x]==='#'&&R.grid[H-5][x-1]==='.'){ tx=x; break; }
  if(tx>0){
    var fx=CX(tx)-0.5;
    propWaterDispenser(K,fx-0.19,CZ(H-5),-Math.PI/2); c.solid(fx-0.19,CZ(H-5),0.36,0.36);
    propBinPair(K,fx-0.19,CZ(H-6)+0.1,-Math.PI/2); c.solid(fx-0.19,CZ(H-6)+0.1,0.36,0.82);
  }
  propCamDome(K,CX(2),CZ(H-5),WALLH); propCamDome(K,CX(W-8),CZ(H-5),WALLH);
  for(x=8;x<W-6;x+=9) propSmoke(K,CX(x),zc,WALLH);
}

/* ---- 厕所：隔间附近（3 格内）露在外面的墙面贴 1.6 米高的白瓷砖 ---- */
function toiletTiles(c){
  var R=c.R, K=c.K, W=c.W, H=c.H, CX=c.CX, CZ=c.CZ, x, y, near={}, any=false;
  for(y=0;y<H;y++) for(x=0;x<W;x++) if(R.grid[y][x]==='B'||R.grid[y][x]==='G'){
    any=true; var a, b; for(b=-3;b<=3;b++) for(a=-3;a<=3;a++) near[(x+a)+','+(y+b)]=1;
  }
  if(!any) return;
  var D=[[0,-1],[0,1],[-1,0],[1,0]], d;
  for(y=0;y<H;y++) for(x=0;x<W;x++){
    if(R.grid[y][x]!=='#') continue;
    for(d=0;d<4;d++){
      var nx=x+D[d][0], ny=y+D[d][1], ch=R.grid[ny]&&R.grid[ny][nx];
      if(!ch||ch==='#'||ch==='='||ch==='O'||ch==='S'||!near[nx+','+ny]) continue;
      var fx=CX(x)+D[d][0]*0.5, fz=CZ(y)+D[d][1]*0.5;
      if(D[d][1]!==0) K.box('tile',fx,0.80,fz+D[d][1]*0.006,1.0,1.6,0.012,0xe8ecea,1.0);
      else K.box('tile',fx+D[d][0]*0.006,0.80,fz,0.012,1.6,1.0,0xe8ecea,1.0);
    }
  }
}
/* ---- 行政楼：每间办公室靠前墙的角上一盆绿植 ---- */
function officePlants(c){
  var R=c.R, K=c.K, W=c.W, CX=c.CX, CZ=c.CZ, x;
  for(x=1;x<W-1;x++){
    if(R.grid[1][x-1]!=='#'||R.grid[1][x]!=='.') continue;
    if(R.grid[2]&&R.grid[2][x]!=='.') continue;
    var px=CX(x)-0.18, pz=CZ(1)-0.18;
    propPlant(K,px,pz,1.1,x); c.solid(px,pz,0.38,0.38);
  }
}

/* ---- 黑板上的粉笔字 ----
   大部分是平常的（值日、课表、作业、倒计时），有几块不太对。字一笔笔有点断（粉笔的颗粒），擦过的地方留着白印。
   贴图、材质按内容缓存，所有楼层共用，不随房间销毁 */
var CHALK_TEXTS=[
  ['值日生：周  林','今日课表：语文 数学 英语 物理 自习'],
  ['距 离 高 考 还 有  0  天'],
  ['今天的作业：','数一数，班上到底有几个人'],
  ['晚自习 19:00 — 22:00','保持安静'],
  ['点名：到 到 到 到 到 到 到 到 到','到'],
  ['第三排靠窗那个座位','不要坐'],
  ['不 要 回 头'],
  ['放学后不要留在教室','（再说一遍：不要留在教室）'],
  ['数学作业：P.83  1—12 题','明天早读前交'],
  ['他一直坐在最后一排','你们看不见吗']
];
var CHALK_MAT={};
function chalkBoard(x,y,z,w,h,seed){
  var lines=CHALK_TEXTS[seed%CHALK_TEXTS.length], key=lines.join('|');
  var m=CHALK_MAT[key];
  if(!m){
    var cv=document.createElement('canvas'); cv.width=1024; cv.height=Math.round(1024*h/w);
    var g=cv.getContext('2d'), H=cv.height, i, j;
    g.clearRect(0,0,1024,H);
    for(i=0;i<4;i++){ g.fillStyle='rgba(255,255,255,0.025)'; g.beginPath(); g.ellipse(Math.random()*1024,Math.random()*H,120+Math.random()*200,30+Math.random()*50,(Math.random()-0.5)*0.4,0,6.283); g.fill(); }   /* 擦过的白印 */
    var fs=Math.round(H/(lines.length+1.6)*0.62), red=/不要|回头|看不见|0  天/.test(key);
    g.font='600 '+fs+'px "KaiTi","STKaiti","Kaiti SC","Noto Serif SC","SimSun",serif'; g.textBaseline='middle';
    for(i=0;i<lines.length;i++){
      var ly=H*(i+1)/(lines.length+1), lx=60+Math.random()*30;
      for(j=0;j<3;j++){ g.fillStyle=(red&&i===lines.length-1&&lines.length>1)?'rgba(220,120,110,0.55)':'rgba(236,236,228,0.55)'; g.fillText(lines[i],lx+(Math.random()-0.5)*2.5,ly+(Math.random()-0.5)*2.5); }
    }
    g.globalCompositeOperation='destination-out';                 /* 粉笔的断续：随机擦掉一些点 */
    for(i=0;i<5000;i++){ g.fillStyle='rgba(0,0,0,'+(0.3+Math.random()*0.7).toFixed(2)+')'; g.fillRect(Math.random()*1024,Math.random()*H,1.5,1.5); }
    g.globalCompositeOperation='source-over';
    var t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4;
    m=new THREE.MeshLambertMaterial({map:t,transparent:true,depthWrite:false});
    m.userData.shared=true;
    CHALK_MAT[key]=m;
  }
  var me=new THREE.Mesh(new THREE.PlaneGeometry(w,h),m);
  me.position.set(x,y,z);
  return me;
}
/* ---- 破败：吊顶上的水渍、掉下来半块的吊顶板、墙脚的霉斑、墙上往下淌的水痕、几只手印、地上散落的纸和蹭痕、洗手池边的水 ----
   都是贴花（没有碰撞、不挡路），位置按房间 id 固定，每次进来一样 */
function roomDecay(c){
  var K=c.K, R=c.R, W=c.W, H=c.H, CX=c.CX, CZ=c.CZ, RWH=c.RWH||WALLH, x, y, d;
  var sd=0, i; for(i=0;i<R.id.length;i++) sd=sd*31+R.id.charCodeAt(i); sd=Math.abs(sd)%9973;
  var low=lodLow(), kq=low?0.5:1, garage=(R.id==='garage1');
  function hz(a,b,k){ return hash2(a*13+sd+(k||0)*101,b*17+sd*3); }
  function G(yy,xx){ return (yy>=0&&xx>=0&&yy<H&&xx<W)?R.grid[yy][xx]:null; }
  /* 吊顶水渍 */
  for(y=1;y<H-1;y++) for(x=1;x<W-1;x++){
    if(G(y,x)!=='.') continue;
    if(hz(x,y,1)<0.035*kq) propDecal(K,0,'d',CX(x)+hz(x,y,2)-0.5,RWH-0.002,CZ(y)+hz(x,y,3)-0.5,0.8+hz(x,y,4)*1.0,0.8+hz(x,y,5)*0.9,garage?0x3a3428:0x6e5a3c,hz(x,y,6)*6.28);
  }
  /* 墙：脚下的霉斑、顶上往下淌的水痕、偶尔一只手印 */
  var D=[[0,-1,'s'],[0,1,'n'],[-1,0,'e'],[1,0,'w']];
  for(y=0;y<H;y++) for(x=0;x<W;x++){
    if(G(y,x)!=='#') continue;
    for(d=0;d<4;d++){
      var nx=x+D[d][0], ny=y+D[d][1], ch=G(ny,nx);
      if(!ch||ch==='#'||ch==='='||ch==='O'||ch==='S') continue;
      var fx=CX(x)+D[d][0]*0.503, fz=CZ(y)+D[d][1]*0.503, f=D[d][2], r1=hz(x*4+d,y,7);
      if(r1<0.07*kq) propDecal(K,1,f,fx,0.95+hz(x,y+d,8)*0.25,fz,0.6+hz(x,d,9)*0.5,0.55+hz(d,y,10)*0.3,0x1c261a);
      else if(r1<0.12*kq) propDecal(K,0,f,fx,RWH-0.45,fz,0.7+hz(x,d,11)*0.5,0.9,garage?0x2a2620:0x5a4a32);
      else if(r1<0.135&&!garage) propDecal(K,2,f,fx,1.15+hz(x,d,12)*0.3,fz,0.20,0.26,0x3a1812);
    }
  }
  /* 地上：散落的纸、蹭痕；洗手池周围的水 */
  for(y=1;y<H-1;y++) for(x=1;x<W-1;x++){
    var gc=G(y,x);
    if(gc==='w'){ propDecal(K,0,'u',CX(x)+0.2,0.005,CZ(y)+0.45,1.1,0.8,0x1a2228,hz(x,y,13)*6.28); continue; }
    if(gc!=='.') continue;
    var r2=hz(x,y,14);
    if(!garage&&r2<0.025*kq) propFloorPaper(K,CX(x)+hz(x,y,15)-0.5,CZ(y)+hz(x,y,16)-0.5,hz(x,y,17)*6.28,(x+y)|0);
    else if(r2>0.95-0.05*kq) propDecal(K,3,'u',CX(x),0.0045,CZ(y),0.9,0.9,0x2a2622,hz(x,y,18)*6.28);
  }
  /* 教学楼走廊：掉了一块的吊顶，半块板吊下来，一根电线垂着 */
  if(R.host==='teach'&&R.floor>=1&&R.floor<=5){
    [5,23,41].forEach(function(col,k){
      if(hz(col,k,19)>0.66) return;
      var hx=Math.round(CX(col)/0.6)*0.6+0.3, hzc=Math.round(CZ(17)/0.6)*0.6+0.3;
      K.g('dark').face([[hx-0.3,RWH-0.003,hzc-0.3],[hx+0.3,RWH-0.003,hzc-0.3],[hx+0.3,RWH-0.003,hzc+0.3],[hx-0.3,RWH-0.003,hzc+0.3]],[0,-1,0],[0.02,0.02,0.025]);
      var a=0.85, z1=hzc-0.29+0.58*Math.cos(a), y1=RWH-0.01-0.58*Math.sin(a), P=[[hx-0.28,RWH-0.01,hzc-0.29],[hx+0.28,RWH-0.01,hzc-0.29],[hx+0.28,y1,z1],[hx-0.28,y1,z1]];
      var cb=K.g('plastic'), rgb=cb._rgb(0xa8acac,1.0);
      cb.face(P,[0,-Math.cos(a),Math.sin(a)],rgb);                               /* 板面朝下、朝走廊 */
      cb.face([P[1],P[0],P[3],P[2]],[0,Math.cos(a),-Math.sin(a)],cb._rgb(0x6a6e6e,0.8));
      K.rod('dark',hx+0.12,RWH-0.01,hzc+0.1,hx+0.18,2.72,hzc+0.18,0.006,0.006,4,0x15181a,1);   /* 垂下来的电线 */
      propDecal(K,0,'d',hx+0.2,RWH-0.002,hzc+0.2,1.6,1.4,0x5a4a32,1.3);
    });
  }
}
