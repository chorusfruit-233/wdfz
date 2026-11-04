/* @module-capsule */
(function($imports){
/* 里世界 3D · 室内建模
   buildRoomGeometry(R) —— 根据网格生成一层楼：
     地面（按房间换材质：教室地砖、走廊水磨石、车库混凝土……）
     墙：相邻的墙格合并成大块（以前逐格方块，一层楼上千个），露在外面的一侧加踢脚、墙裙、腰线
     吊顶 + 灯盘、门（门框、门套、带小窗的门扇、把手、门牌；开着的门会转开）、楼梯、出口
     家具（见 furniture.js）和每种房间自己的布置（黑板、窗、储物柜、管道、通风橱……）
   副作用：R.stairExtra / R.propExtra（碰撞，米）和 R.stats。 */
'use strict';

function roomTheme(R){
  return Object.assign({floor:'ftile',fcol:$imports.PALETTE.floor,wall:$imports.PALETTE.wall,wallMat:'plaster',low:0x8b867e,
    skirt:0x242c32,ceil:0x9a9e9e,ceilMat:'ceiling',rail:0x6a5a48},$imports.ROOM_THEMES[R.id]||$imports.ROOM_THEMES[R.host]||{});
}

function buildRoomRecipe(R,K,view){
  view=view||{};
  var shafts=[];K.noteShaft=function(x,z,nx,nz,w,y0,y1){shafts.push({x:x,z:z,nx:nx,nz:nz,w:w,y0:y0,y1:y1});};                    /* 收集窗户，给光影模块画窗光 */
  R.stats={desk:0, cubicle:0, chair:0, seat:0};
  R.stairExtra=[];                 /* 以前每进一次房间都往里追加一遍，越积越多 */
  R.propExtra=[];                  /* 大件家具的真实占地（米，房间中心为原点） */
  R.foot={};                       /* 每格家具模型在人身高范围内的占地矩形（米），碰撞用它 */
  var W=R.cols,H=R.rows,tw=$imports.TTILE*$imports.U2M,th=$imports.TTILE*$imports.U2M;
  var halfW=W*tw*0.5, halfH=H*th*0.5;
  var isRoof=(R.host==='teach'&&R.floor===6);
  var RWH=R.spiral?$imports.SPIRAL.wallH:$imports.WALLH;           /* 钟楼里面是通高的 */
  /* 贴地朝下的面不建；有吊顶的房间，贴吊顶朝上的面也不建；顶点多的材质按 16 米切块；重复多的模型实例化 */
  var TH=roomTheme(R);
  function CX(c){ return (c+0.5)*tw-halfW; }
  function CZ(r){ return (r+0.5)*th-halfH; }
  var c={R:R,K:K,W:W,H:H,tw:tw,th:th,halfW:halfW,halfH:halfH,CX:CX,CZ:CZ,theme:TH,doors:[],meshes:view.meshes?[]:null,view:view,RWH:RWH,
    solid:function(cx,cz,sx,sz){ R.propExtra.push({x0:cx-sx/2,x1:cx+sx/2,z0:cz-sz/2,z1:cz+sz/2}); },
    ao:function(cx,cz,sx,sz,s){ K.g('decal').aoPatch(cx,cz,sx,sz,s); }};
  function G(y,x){ return (y>=0&&x>=0&&y<H&&x<W)?R.grid[y][x]:null; }

  /* ---- 楼梯井要挖掉的墙格 ---- */
  var STAIR_CUT={};
  (function(){
    var cx2,cy2;
    for(cy2=0;cy2<H;cy2++) for(cx2=0;cx2<W;cx2++){
      if(R.grid[cy2][cx2]!=='S'||$imports.STAIR_LAYOUT.some(function(s){return s.rooms.includes(R.id);})) continue;
      if((cx2>0&&R.grid[cy2][cx2-1]==='S')||(cy2>0&&R.grid[cy2-1][cx2]==='S')) continue;
      var si=(0,$imports.stairInfo)(R,cx2,cy2);
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
    var shf=chk*(0.96+0.06*(0,$imports.hash2)(fx+7,fy+13));
    var qx0=-halfW+fx*tw, qz0=-halfH+fy*th;
    K.g(fm).quad(qx0,qz0+th, qx0+tw,qz0+th, qx0+tw,qz0, qx0,qz0, 0, (0,$imports.shadeHex)(fcol,shf));
  }
  /* 只画贴地的警戒线，不产生碰撞。范围直接取报警表，避免画面与判定分离。 */
  $imports.PATROL_ZONES.forEach(function(z){
    if(z.scene!==R.id||!z.marked)return;
    var x0=z.c0*tw-halfW,x1=z.c1*tw-halfW,z0=z.r0*th-halfH,z1=z.r1*th-halfH;
    var band=K.g('decal'),width=.045,col=0xc7a34b;
    function stripe(a,b,d,e){band.quad(a,e,d,e,d,b,a,b,.008,col);}
    stripe(x0,z0,x1,z0+width);stripe(x0,z1-width,x1,z1);
    stripe(x0,z0,x0+width,z1);stripe(x1-width,z0,x1,z1);
  });
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
    if(isRoof) K.box('concrete',wcx,$imports.WALLH+0.04,wcz,w*tw+0.08,0.08,h*th+0.08,0xb8b4ac,1.0);   /* 女儿墙压顶 */
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
      if($imports.FURN[ch]) $imports.FURN[ch](c,x,y,cx,cz);
      else (0,$imports.furnFallback)(c,x,y,cx,cz,ch);
      if(K.cap.length&&FOOT_SKIP.indexOf(ch)<0) R.foot[x+','+y]=footMerge(K.cap);
      K.cap=null;
    }
  }
  roomDecor(c,isRoof);
  if(R.spiral){
    for(y=0;y<H;y++) for(x=0;x<W;x++) if(R.grid[y][x]==='O')       /* 门洞上方补到顶 */
      K.box(TH.wallMat,CX(x),($imports.WALLH+RWH)/2,CZ(y),tw,RWH-$imports.WALLH,th,TH.wall,0.94);
    (0,$imports.buildSpiral)(c);
  }
  R.shafts=shafts;
  R.doorSpecs=c.doors;
  if(view.signs)view.signs(c,G,isWall);
  return c;
}

/* 模块自带模型的房间（R.build，例如虚空迷宫）：不按网格建墙和地面，只把副作用字段清干净 */


/* ---- 门：墙厚 1 米，门洞两侧有门套；门扇在 +z 一侧（走廊那边）；开着的门扇转 90° 贴在门洞边 ---- */
function roomDoor(c,x,y,cx,cz){
  var K=c.K, R=c.R;
  var l=R.grid[y][x-1], r=R.grid[y][x+1];
  var horiz=(l==='#'||l==='='||r==='#'||r==='=');
  K.frame(cx,cz,horiz?0:Math.PI/2);
  var DTOP=2.10, TH=c.theme;
  K.g(TH.wallMat).boxFaces(0,(DTOP+$imports.WALLH)/2,0,1,$imports.WALLH-DTOP,1,TH.wall,0.94,'ns');                  /* 过梁（底面被下面的门头整个盖住，不画，免得两面重合闪烁） */
  var dbl=(l==='='), dbr=(r==='=');                                                              /* 双开门：只在外侧立门套 */
  K.asset('door_frame_'+(dbl?(dbr?'0':'r'):(dbr?'l':'lr')),0,0,0,0);                             /* 门套（带挡门条）、门头、两面的门套线、门槛石 */
  if((R.host==='teach'||R.host==='lab'||R.host==='admin'||R.host==='dormN'||R.host==='dormS')&&!dbl)  /* 门牌 */
    K.asset('door_plate',-0.1,2.32,0.51,0);
  K.unframe();
  /* 门扇单独成一块（buildDoorLeaf）：开门时只重建这一扇，不用整层楼重建 */
  if(c.doors) c.doors.push({x:x,y:y,cx:cx,cz:cz,horiz:horiz,dbl:dbl,dbr:dbr});
}
/* 门扇：关着的在门洞里；开着的转 90° 贴着门洞边。一间房所有的门扇画进同一个 Kit（只多几次绘制） */


/* 开门 / 读档以后：只把门扇按 OPENDOORS 重建（以前整层楼重建）；x、y 留着兼容调用处 */

/* ---- 外墙上的出口：门框 + 两扇玻璃门 + 推杠 + 门上的安全出口灯 ---- */
function roomExit(c,x,y,cx,cz){
  var K=c.K, R=c.R, W=c.W, H=c.H;
  var onB=(y===0||y===H-1||x===0||x===W-1);
  if(!onB) return;
  var vert=(x===0||x===W-1), sgn=(x===0||y===0)?-1:1;
  var rot=vert?(sgn>0?Math.PI/2:-Math.PI/2):(sgn>0?0:Math.PI);
  K.frame(cx,cz,rot);                       /* 局部 +z 朝外 */
  var TH=c.theme;
  K.g(TH.wallMat).boxFaces(0,(2.30+$imports.WALLH)/2,0,1,$imports.WALLH-2.30,1,TH.wall,0.94,'nsd');               /* 门头 */
  K.asset('exit_door',0,0,0,0);                                                                  /* 铝框玻璃门、推杠、透进来的天光、安全出口灯、门外的水泥台 */
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
  if($imports.STAIR_LAYOUT.some(function(s){return s.rooms.includes(c.R.id);}))return;
  var K=c.K, R=c.R, tw=c.tw, th=c.th;
  if((x>0&&R.grid[y][x-1]==='S')||(y>0&&R.grid[y-1][x]==='S')) return;   /* 一组只建一次 */
  var sInfo=(0,$imports.stairInfo)(R,x,y);
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
  /* 一级踏步的模型：局部 -z 是往上走的方向，原点在踏面前沿、踢面底 */
  var stepRot=ax==='z'?(dys>0?Math.PI:0):(dxs>0?-Math.PI/2:Math.PI/2);
  for(st2=0; st2<nR; st2++){
    runOff=baseOff+st2*tread+tread*0.5; hgt=(st2+1)*rise;
    var fp=P(baseOff+st2*tread);
    K.asset('stair_step',fp.x,st2*rise,fp.z,stepRot);                                           /* 水磨石踏面、防滑铜条、踢面 */
    bx(runOff,(hgt-0.04)/2,tread,Math.max(0.02,hgt-0.04),wid*0.999,0x8a8680,0.95,'concrete');   /* 下面的实心 */
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
      if(st2%2===0) K.asset('stair_baluster',px,hgt,pz,0);
      pts.push([px,hgt+0.92,pz]);
    }
    if(pts.length>1){
      var a=pts[0], b=pts[pts.length-1];
      K.rod('wood',a[0],a[1]+0.012,a[2],b[0],b[1]+0.012,b[2],0.03,0.03,(0,$imports.lodLow)()?6:12,0x8b3a2e,1.06);
      K.rod('metal',a[0],a[1]-0.45,a[2],b[0],b[1]-0.45,b[2],0.01,0.01,4,0x6d7376);
    }
  }
  var shaftD=nR*tread, farOff=baseOff+shaftD;
  bx(farOff+0.06,$imports.WALLH*0.5,0.12,$imports.WALLH,wid,0x0d1114,0.75,'dark');                             /* 不再比梯井宽：旁边墙上有门时会插进门框 */                         /* 梯井尽头：黑的 */
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
    if(ax==='z') K.box(TH.wallMat,sp2.x+sd2*(halfW2+0.11),$imports.WALLH*0.5,sp2.z,0.12,$imports.WALLH,sLen,$imports.PALETTE.wall,sd2<0?0.88:0.82);
    else K.box(TH.wallMat,sp2.x,$imports.WALLH*0.5,sp2.z+sd2*(halfW2+0.11),sLen,$imports.WALLH,0.12,$imports.PALETTE.wall,sd2<0?0.88:0.82);
  }
  bx(midOff,2.30-0.07,shaftD,0.14,wid+0.14,0x2c3034,0.72,'concrete');                        /* 楼梯下沿的梁 */
  bx(baseOff-0.06,(2.30+$imports.WALLH)*0.5,0.10,$imports.WALLH-2.30,wid+0.10,$imports.PALETTE.wall,0.90,TH.wallMat);
  var c0=Math.min(baseOff, farOff), c1=Math.max(baseOff, farOff);
  var ex0,ex1,ez0,ez1;
  if(ax==='z'){ ex0=cx-halfW2-0.18; ex1=cx+halfW2+0.18; ez0=cz+Math.min(dys*c0,dys*c1); ez1=cz+Math.max(dys*c0,dys*c1); }
  else { ez0=cz-halfW2-0.18; ez1=cz+halfW2+0.18; ex0=cx+Math.min(dxs*c0,dxs*c1); ex1=cx+Math.max(dxs*c0,dxs*c1); }
  R.stairExtra.push({x0:ex0,x1:ex1,z0:ez0,z1:ez1});
}

/* 一扇嵌在墙里的窗（1.5 米或 1.8 米宽，高度跟着宽度那一款）。nx/nz 是窗朝屋里的方向 */
function wallWindow(K,x,z,nx,nz,w,y0,y1,mull){
  var rot=Math.atan2(nx,nz);                    /* 局部 +z 朝屋里 */
  K.noteShaft(x,z,nx,nz,w,y0,y1);
  K.asset(w>1.6?'window_in_180':'window_in_150',x,0,z,rot);                                      /* 外框、两扇推拉窗、透进来的天光、石窗台 */
}
/* 吸顶灯盘（1.8 米 / 1.2 米）：铝框、磨砂发光面；state 同吊装灯 */
function ceilingLight(K,x,z,lw,ld,rot,state){
  K.asset(lw>1.5?'light_panel_180':'light_panel_120',x,$imports.WALLH-3,z,rot||0,(0,$imports.lampOpt)(state));
}

/* ---- 每种房间自己的布置 ---- */
function roomDecor(c,isRoof){
  var K=c.K, R=c.R, W=c.W, H=c.H, tw=c.tw, th=c.th, halfW=c.halfW, halfH=c.halfH, CX=c.CX, CZ=c.CZ, i, x;
  var teachFl=(R.host==='teach'&&R.floor>=1&&R.floor<=5);
  if(R.host==='lift'){ (0,$imports.liftDecor)(c); return; }                     /* 轿厢：model/lift.js */
  if(R.host==='teach'||R.host==='lab') (0,$imports.liftDecor)(c);               /* 电梯门后井道里的那一节轿厢 */
  if(R.host==='tunnel'){
    for(i=2;i<H-2;i+=3){
      K.box('plain',CX(3+(i%3)),.014,CZ(i),1.3,.02,1.8,0x0c1510,1);
      K.box('plain',CX(1),1.2,CZ(i),.03,1.8,.35,0x101d15,1);
      K.box('plain',CX(W-2),1.6,CZ(i+1),.03,1.2,.25,0x101d15,1);
    }
  }

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
          (0,$imports.propCurtains)(K,CX(x),CZ(rr)+nz*th*0.5,nz>0?0:Math.PI,1.5,1.02,2.42,ccol,x+rr);
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
        K.asset('fume_hood',fx,0,fz,0);                                                             /* 下柜、台面、玻璃拉门、上柜、排风管 */
        c.solid(fx,fz,1.9,0.9);
      }
    }
    K.asset('eyewash',-halfW+1.0,0,-halfH+1.2,0);                                                   /* 洗眼器 */
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
      K.asset('locker_bank_4',lcx,0,lz,0);                                                          /* 四门储物柜：门缝、百叶、号码牌、锁、拉手 */
      c.solid(lcx, lz, 0.86, 0.42);
    }
    /* 走廊外墙：宣传栏 + 消防栓箱 */
    var bx2;
    for(bx2=6;bx2<W-6;bx2+=13){
      var bb0=Math.floor(bx2+1.3), bbOK=true, bi;
      for(bi=-1;bi<=1;bi++){ var brow=R.grid.length-1; if(!R.grid[brow]||R.grid[brow][bb0+bi]!=='#'){ bbOK=false; break; } }
      if(!bbOK) continue;
      var bcx2=-halfW+(bx2+0.5)*tw;
      K.asset('board_bulletin',bcx2,1.85,zWallN,Math.PI);                                           /* 宣传栏：软木底板、几张通知、玻璃 */
      K.asset('hydrant_box',-halfW+(bx2+7.5)*tw,0.95,zWallN,Math.PI);                               /* 消防栓箱 */
    }
    /* 走廊顶上的梁 */
    var bmz=18.5*th-halfH, bmx;
    for(bmx=0;bmx<W;bmx+=7) K.box('concrete',CX(bmx),2.86,bmz,0.22,0.28,th*4.6,0xb4afa6,0.96);
    /* 教室：黑板在西墙，北墙开窗，后墙黑板报（布局见 domain/classroom-layout.js） */
    for(i=0;i<$imports.CLS_SPAN.length;i++) classroomWest(c,i,$imports.CLS_SPAN[i][0],$imports.CLS_SPAN[i][1]);
    corridorExtras(c,zWallS,zWallN);
  }

  if(R.id==='gear1'){
    /* 一张乒乓球台 + 角落里一筐篮球 */
    var ttx=1.9, ttz=0.1;
    K.asset('pingpong_table',ttx,0,ttz,0);
    c.solid(ttx,ttz,1.52,2.74);
    K.asset('ball_crate',-2.4,0,1.4,0);
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
        K.asset('pillar_bands',CX(gxx),0,CZ(gy),0);
      }
    }
    for(gy=3;gy<H-2;gy+=7){
      K.rod('metal',-halfW+1,2.82,CZ(gy),halfW-1,2.82,CZ(gy),0.08,0.08,8,0x4a4e50);             /* 排风管 */
      K.rod('metal',-halfW+1,2.90,CZ(gy)+1.2,halfW-1,2.90,CZ(gy)+1.2,0.035,0.035,8,0xa83228,1.0); /* 消防喷淋管（红） */
      if(!(0,$imports.lodLow)()) for(gxx=-halfW+3;gxx<halfW-2;gxx+=3) K.asset('sprinkler',gxx,0,CZ(gy)+1.2,0);   /* 喷头 */
    }
    K.g('decal').quad(-halfW+1,CZ(13)-0.06,halfW-4,CZ(13)-0.06,halfW-4,CZ(13)+0.06,-halfW+1,CZ(13)+0.06,0.006,0xc8b24a);   /* 车道中线 */
  }

  toiletTiles(c);
  if(R.host==='admin') officePlants(c);
  if(!isRoof&&R.host!=='bell'&&viewDetail(c))c.view.decay(c);
  /* 吸顶灯盘 */
  if(!isRoof&&R.host!=='bell'){
    /* 灯管：真开着灯的地方（world.js 的点光源）亮着，别处的熄着或快坏了——一层楼不会是整整齐齐一片亮 */
    if(teachFl){
      var nl=0;
      for(x=3;x<W-3;x+=9){ var near=Math.abs(CX(x))<10; ceilingLight(K,CX(x),CZ(18),1.8,0.24,0,near?(nl++===1?'dying':'on'):((x/9|0)%2?'dying':'off')); }
      var cs=$imports.CLS_SPAN, ci, LIT={5:1,21:1,45:1};
      for(ci=0;ci<cs.length;ci++) classroomLamps(c,ci,cs[ci][0],!!LIT[cs[ci][0]]);   /* 教室的护眼灯和黑板灯 */
    }else if(R.id!=='garage1'){
      var nk=0;
      for(x=3;x<W-3;x+=9) ceilingLight(K,CX(x),CZ(Math.floor(H*0.5)),1.8,0.24,0,(nk++%3===2)?'dying':'on');
    }else{
      ceilingLight(K,CX(W-6),CZ(13),1.2,0.20,0);       /* 车库最里面那一盏 */
    }
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
      K.rod('metal',sx,2.80,sz-0.1,sx,$imports.WALLH,sz-0.1,0.004,0.004,4,0x9aa0a4,1.0);
      K.rod('metal',sx,2.80,sz+0.1,sx,$imports.WALLH,sz+0.1,0.004,0.004,4,0x9aa0a4,1.0);
      (0,$imports.propExitSign)(K,sx,2.72,sz-0.022,0,ch==='O'); (0,$imports.propExitSign)(K,sx,2.72,sz+0.022,Math.PI,ch==='O');
    }
  }
  /* 应急灯：教室门之间、走廊北墙上 */
  for(k=0;k<$imports.CLS_SPAN.length;k++) (0,$imports.propEmergencyLight)(K,CX($imports.CLS_SPAN[k][0])+1.0,2.62,zWallS+1,0);
  /* 厕所隔墙外面：饮水机 + 分类垃圾桶 */
  var tx=-1;
  for(x=W-2;x>0;x--) if(R.grid[H-5]&&R.grid[H-5][x]==='#'&&R.grid[H-5][x-1]==='.'){ tx=x; break; }
  if(tx>0){
    var fx=CX(tx)-0.5;
    (0,$imports.propWaterDispenser)(K,fx-0.19,CZ(H-5),-Math.PI/2); c.solid(fx-0.19,CZ(H-5),0.36,0.36);
    (0,$imports.propBinPair)(K,fx-0.19,CZ(H-6)+0.1,-Math.PI/2); c.solid(fx-0.19,CZ(H-6)+0.1,0.36,0.82);
  }
  (0,$imports.propCamDome)(K,CX(2),CZ(H-5),$imports.WALLH); (0,$imports.propCamDome)(K,CX(W-8),CZ(H-5),$imports.WALLH);
  for(x=8;x<W-6;x+=9) (0,$imports.propSmoke)(K,CX(x),zc,$imports.WALLH);
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
    (0,$imports.propPlant)(K,px,pz,1.1,x); c.solid(px,pz,0.38,0.38);
  }
}

/* ---- 黑板上的粉笔字 ----
   大部分是平常的（值日、课表、作业、倒计时），有几块不太对。字一笔笔有点断（粉笔的颗粒），擦过的地方留着白印。
   贴图、材质按内容缓存，所有楼层共用，不随房间销毁 */



/* ---- 破败：吊顶上的水渍、掉下来半块的吊顶板、墙脚的霉斑、墙上往下淌的水痕、几只手印、地上散落的纸和蹭痕、洗手池边的水 ----
   都是贴花（没有碰撞、不挡路），位置按房间 id 固定，每次进来一样 */


/* ---- 场景里能读的字：楼层铭牌、连廊吊牌上的字、车库排号吊牌、车牌、讲台上的移交单 ----
   五档画质都保留（是能拿来判断路线的场景信息），都不改碰撞。
   全部用受光照的材质：黑处要靠灯或手电才看得清，不会像以前那样在黑暗里自己发亮。
   每块贴图只属于这一份房间模型，房间模型释放时一起释放（material.userData.disposeMap）。 */










/* 搪瓷楼层铭牌：左边深蓝色块写楼层，右边中文和英文 */

/* 连廊吊牌：原来是一块空白的牌子，补上字 */

/* 车库排号吊牌：深灰底、上沿黄黑斜纹、琥珀色字 */

/* 小型汽车号牌：蓝底白字白边，440×140 毫米 */

/* 讲台上的钥匙移交单：红色印刷的表格，蓝黑墨水手写，盖了教务处的章 */



/* 车牌（家具里的车调用）：贴在车头，朝 +x */



function viewDetail(c){return !!c.view.decay;}

/* ---- 教室（黑板在西墙）：纵向、横向的分区见 domain/classroom-layout.js ----
   i 第几间，c0..c1 这一间的列。X(t)/Z(t)：格子坐标（可带小数）换成米 */
function classroomWest(c,i,c0,c1){
  var K=c.K, L=$imports.ClassroomLayout, seed=(c.R.floor||1)*7+i;
  function X(t){ return t*c.tw-c.halfW; }
  function Z(t){ return t*c.th-c.halfH; }
  var xw=X(c0), xe=X(c1+1), zn=Z(1), zs=Z(15), zb=Z(L.boardRow+0.5);
  /* 前墙（西）：黑板（字由表现层贴）、广播喇叭、两个插座；西北角柜式空调，西南角（前门边）饮水机 */
  K.asset('blackboard',xw,1.70,zb,Math.PI/2);                                                     /* 铝框、板面、粉笔槽、粉笔、板擦 */
  if(c.view.board){ var b=c.view.board(xw+0.082,1.70,zb,4.8,0.98,seed); b.rotation.y=Math.PI/2; c.meshes.push(b); }
  K.asset('speaker_box',xw+0.02,2.55,zb+3.35,Math.PI/2);
  (0,$imports.propSocket)(K,xw+0.02,0.30,zb-2.95,Math.PI/2); (0,$imports.propSocket)(K,xw+0.02,0.30,zb+2.95,Math.PI/2);
  (0,$imports.propACCabinet)(K,xw,Z(1.6),Math.PI/2); c.solid(xw+0.16,Z(1.6),0.32,0.52);
  (0,$imports.propWaterDispenser)(K,xw+0.20,Z(14.55),Math.PI/2); c.solid(xw+0.20,Z(14.55),0.36,0.36);
  /* 北墙（外墙）：三扇推拉窗，窗帘收在两边 */
  [1.3,3.5,5.7].forEach(function(dx,k){
    var wx=X(c0+dx);
    wallWindow(K,wx,zn,0,1,1.5,1.0,2.25,2);
    (0,$imports.propCurtains)(K,wx,zn,0,1.5,1.02,2.42,[0x5a7a9a,0x66788a,0x58708a][(i+k)%3],seed*3+k);
  });
  /* 后墙（东）：黑板报居中、上面挂钟，两边各一幅名言；东南角卫生角，旁边垃圾桶 */
  K.asset('board_news',xe,1.55,zb,-Math.PI/2);                                                    /* 彩色粉笔的大标题、两栏小字、角上的花 */
  K.asset('clock_wall',xe-0.02,2.58,zb,-Math.PI/2);
  (0,$imports.propFrame)(K,xe,1.70,Z(4.2),-Math.PI/2,0.62,0.82,0xe8d8a8,0x3a3028,i*4+1);
  (0,$imports.propFrame)(K,xe,1.70,Z(10.8),-Math.PI/2,0.62,0.82,0xc8d8e0,0x3a3028,i*4+2);
  (0,$imports.propCleaning)(K,X(c0+6.5),zs,Math.PI); c.solid(X(c0+6.5),zs-0.21,0.94,0.42);       /* 水桶、拖把、扫把、簸箕，靠在南墙上 */
  K.asset('bin_classroom',xe-0.27,0,Z(13.95),0); c.solid(xe-0.27,Z(13.95),0.42,0.42);             /* 垃圾桶（套着黑色垃圾袋） */
  /* 南墙（走廊那边）：前门边的开关，两扇门中间挂两幅班级公约 */
  (0,$imports.propSwitch)(K,X(c0+2.3),1.35,zs,Math.PI,3);
  (0,$imports.propFrame)(K,X(c0+3.1),1.75,zs,Math.PI,0.62,0.82,0xe0d0c0,0x3a3028,i*4+3);
  (0,$imports.propFrame)(K,X(c0+4.1),1.75,zs,Math.PI,0.62,0.82,0xe8d8a8,0x3a3028,i*4);
  /* 顶上：两台吊扇、对着黑板的投影机、烟感（和灯错开，见 classroomLamps） */
  (0,$imports.propCeilFan)(K,X(c0+4.1),Z(4.5),$imports.WALLH,i*3+1); (0,$imports.propCeilFan)(K,X(c0+4.1),Z(10.5),$imports.WALLH,i*3+2);
  (0,$imports.propProjector)(K,X(c0+2.6),zb,$imports.WALLH,Math.PI/2);
  (0,$imports.propSmoke)(K,X(c0+4.1),zb,$imports.WALLH);
}
/* ---- 教室的灯：护眼灯顺着前后方向 4 × 2 盏，黑板前两盏黑板灯；lit 是开着灯的那几间（没开的全熄着，只剩一盏在抽） ---- */
function classroomLamps(c,i,c0,lit){
  var K=c.K;
  function X(t){ return t*c.tw-c.halfW; }
  function Z(t){ return t*c.th-c.halfH; }
  [3.0,6.0,9.0,12.0].forEach(function(t,a){
    [3.0,5.2].forEach(function(dx,b){
      var dying=((a*2+b+i*3)%8)===5;
      (0,$imports.propHangLamp)(K,X(c0+dx),Z(t),1.2,0.22,$imports.WALLH,2.68,0,dying?'dying':(lit?'on':'off'));
    });
  });
  /* 两盏黑板灯；流畅档只给自己班挂（一层 6 间，手机上顶点数要控制） */
  if(!(0,$imports.lodLow)()||(c.R.id===$imports.ClassroomLayout.ownSeat.room&&i===$imports.ClassroomLayout.ownSeat.classId))
    [6.2,8.8].forEach(function(t){ (0,$imports.propHangLamp)(K,X(c0+0.75),Z(t),1.2,0.22,$imports.WALLH,2.68,Math.PI/2,lit?'on':'off'); });
}

/* @module-exports */
GameModules.publish("game3d/js/content/room-recipe.js",{
"roomTheme":{get:function(){return roomTheme;},set:function($value){roomTheme=$value;}},
"buildRoomRecipe":{get:function(){return buildRoomRecipe;},set:function($value){buildRoomRecipe=$value;}},
"roomDoor":{get:function(){return roomDoor;},set:function($value){roomDoor=$value;}},
"roomExit":{get:function(){return roomExit;},set:function($value){roomExit=$value;}},
"FOOT_SKIP":{get:function(){return FOOT_SKIP;},set:function($value){FOOT_SKIP=$value;}},
"footMerge":{get:function(){return footMerge;},set:function($value){footMerge=$value;}},
"roomStairs":{get:function(){return roomStairs;},set:function($value){roomStairs=$value;}},
"wallWindow":{get:function(){return wallWindow;},set:function($value){wallWindow=$value;}},
"ceilingLight":{get:function(){return ceilingLight;},set:function($value){ceilingLight=$value;}},
"roomDecor":{get:function(){return roomDecor;},set:function($value){roomDecor=$value;}},
"corridorExtras":{get:function(){return corridorExtras;},set:function($value){corridorExtras=$value;}},
"toiletTiles":{get:function(){return toiletTiles;},set:function($value){toiletTiles=$value;}},
"officePlants":{get:function(){return officePlants;},set:function($value){officePlants=$value;}},
"viewDetail":{get:function(){return viewDetail;},set:function($value){viewDetail=$value;}},
"classroomWest":{get:function(){return classroomWest;},set:function($value){classroomWest=$value;}},
"classroomLamps":{get:function(){return classroomLamps;},set:function($value){classroomLamps=$value;}}
});
})(GameModules.imports("game3d/js/content/room-recipe.js"));
