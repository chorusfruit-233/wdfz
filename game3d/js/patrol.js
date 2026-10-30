/* 里世界 3D · 巡察者、储物柜、校长办公室
   巡察者：上课和考试的时候在各栋楼里游荡，抓不在座位上的人；夜里也会出现在室外。
     出现之前，屋里的灯会按心跳一样的节拍一明一暗（lighting.js 的 VisualState.patrolFlick）；
     它看见你一会儿就锁定你，灯一下子全红（VisualState.patrolRed），然后追过来，被抓到就死。
   怎么躲：
     · 跑出它的视线，跟丢 2.5 秒它就放弃；
     · 提前钻进储物柜（H）。被它看见你钻进去的话，没用；
     · 难的那个：被锁定以后背对着它、一动不动站 2.5 秒，它会从你身边走过去。
   校长办公室（行政楼 5F）：抽屉里有车钥匙和机房钥匙（每个容器 45%），但巡察者常驻、异象也来得勤。 */
'use strict';

/* ---------- 储物柜 ---------- */
var LOCKER_CELLS={
  teach:[[12,16],[28,16],[44,16]],
  admin:[[9,17],[25,17],[41,17]],
  lab:[[10,16],[28,16],[37,16]]
};
function placeLockers(){
  var id, R, cells, i;
  for(id in INTERIORS){
    R=INTERIORS[id];
    if(R.host==='teach'&&R.floor>5) continue;
    cells=LOCKER_CELLS[R.host]; if(!cells) continue;
    for(i=0;i<cells.length;i++){
      var c=cells[i][0], r=cells[i][1];
      if(R.grid[r]&&R.grid[r][c]==='.'&&R.grid[r+1]&&R.grid[r+1][c]==='.') R.grid[r][c]='H';
    }
  }
  var P=INTERIORS.admin5;
  if(P){
    P.name='行政楼 5F · 校长办公室'; P.principal=true;
    [[8,1],[24,1],[40,1]].forEach(function(q){ if(P.grid[q[1]][q[0]]==='.'&&P.grid[q[1]+1][q[0]]==='.') P.grid[q[1]][q[0]]='H'; });
  }
}
FURN_SOLID.H=0.82;
/* 一人高的铁皮储物柜，门朝南（+z），门上有一排百叶缝 */
FURN.H=function(c,x,y,cx,cz){
  var K=c.K;
  c.ao(cx,cz,0.9,0.8,0.85);
  K.bevel('metal',cx,1.0,cz-0.05,0.82,2.0,0.62,0x45525a,1.0,0.02);
  K.box('metal',cx,1.0,cz+0.262,0.74,1.9,0.01,0x56646c,1.05);
  var q; for(q=0;q<6;q++) K.box('dark',cx,1.62+q*0.045,cz+0.27,0.42,0.018,0.006,0x0a0c0e,1);
  K.box('metal',cx+0.28,1.0,cz+0.275,0.03,0.16,0.02,0xa8b0b4,1.2);                     /* 把手 */
};

/* 售货机：玻璃门、一格格货架、亮着的灯条，背靠东墙、面朝西（-x） */
FURN_SOLID.M=0.86;
FURN.M=function(c,x,y,cx,cz){
  var K=c.K;
  c.ao(cx,cz,0.95,0.95,0.85);
  K.bevel('metal',cx+0.05,0.95,cz,0.8,1.9,0.86,0xb03a2a,1.0,0.02);
  K.box('glass',cx-0.36,1.1,cz-0.08,0.02,1.3,0.6,0x9ab8c8,1.0);
  var q; for(q=0;q<5;q++){ K.box('metal',cx-0.2,0.6+q*0.26,cz-0.08,0.3,0.02,0.58,0x8a8a86,1.0);
    K.box('emit',cx-0.2,0.66+q*0.26,cz-0.08,0.14,0.1,0.5,[0xe0c040,0x7fb0c8,0xd08a4a,0x7fe0a0,0xc86a6a][q],1); }
  K.box('emit',cx-0.37,1.85,cz,0.02,0.08,0.7,0xdcecf4,1);                                /* 灯条 */
  K.box('dark',cx-0.37,0.25,cz-0.08,0.02,0.18,0.5,0x0a0a0a,1);                           /* 出货口 */
};
var HIDE={on:false,c:0,r:0,seen:false,t:0};
function lockerFront(R,c,r){ return {x:R.ox+(c+0.5)*R.tw, y:R.oy+(r+1.5)*R.th}; }
function hideIn(hit){
  var R=INTERIORS[S.room];
  HIDE.seen=!!(PAT.state==='walk'&&PAT.locked&&patSees());   /* 当着它的面钻进去，等于没躲（要在 HIDE.on 之前算） */
  HIDE.on=true; HIDE.c=hit.c; HIDE.r=hit.r; HIDE.t=0;
  S.x=R.ox+(hit.c+0.5)*R.tw; S.y=R.oy+(hit.r+0.62)*R.th; S.ang=PI/2; S.pitch=0;
  resetInputState();
  var el=document.getElementById('hideslits'); if(el) el.style.display='block';
  try{ SFX.door(); }catch(e){}
  os(HIDE.seen?'我：我钻进了柜子。……它看见了。脚步声没有停，正朝这边来。':'我：我钻进储物柜，把门带上。铁皮上一排缝，外面的光一条一条的。',3.4);
}
function hideOut(){
  var R=INTERIORS[S.room];
  HIDE.on=false;
  var el=document.getElementById('hideslits'); if(el) el.style.display='none';
  if(R){ var f=lockerFront(R,HIDE.c,HIDE.r); S.x=f.x; S.y=f.y; }
  try{ SFX.door(); }catch(e){}
  os('我：我推开柜门出来。',1.6);
}

/* ---------- 巡察者 ---------- */
var PAT={state:'idle',next:45,t:0,x:0,y:0,room:null,lock:0,locked:false,lost:0,still:0,tx:0,ty:0,stuck:0,walkT:0,step:0};
var PAT_SPEED=16, PAT_CHASE=31, PAT_SEE=135, PAT_CATCH=19;
function patReset(keepHiding){
  patRemoveFig();
  PAT.blinkCD=0.8;PAT.afterBlink=0;
  PAT.state='idle'; PAT.t=0; PAT.lock=0; PAT.locked=false; PAT.lost=0; PAT.still=0; PAT.room=null;
  VisualState.patrolFlick=0; VisualState.patrolRed=0;
  if(HIDE.on&&!keepHiding){ HIDE.on=false; var el=document.getElementById('hideslits'); if(el) el.style.display='none'; }
}
function patRoomHere(){ return S.mode==='in'?S.room:'out'; }
/* 现在这个地方，它会不会来 */
function patEligible(){
  if(S.dead||S.screen!=='play') return false;
  if(isNight())return S.mode==='out';
  if(S.mode==='in'){
    var R=INTERIORS[S.room]; if(!R) return false;
    if(R.principal) return true;                                    /* 校长办公室：一直在 */
    if(R.host!=='teach'&&R.host!=='admin'&&R.host!=='lab') return false;
    if(R.host==='teach'&&R.floor>5) return false;
    return needWhere(S.tsec)==='教室';
  }
  return isNight();
}
function patInterval(){
  var R=S.mode==='in'?INTERIORS[S.room]:null, b;
  if(R&&R.principal) b=rnd(14,24);
  else if(S.mode==='out') b=rnd(40,70);
  else b=rnd(30,55);
  if(S.diff==='hard') b*=0.75;
  return b;
}
function patSolid(x,y){
  if(PAT.room==='out') return solidAtOutdoor(x,y);
  var R=INTERIORS[PAT.room]; if(!R) return true;
  var t=tileAt(R,x,y);
  if(t==='#') return true;
  if(t==='=') return !doorIsOpen(R,x,y);
  return !!FURN_SOLID[t]&&t!=='P';
}
/* 视线：一路走过去不碰墙（室外是楼） */
function patLOS(){
  var dx=S.x-PAT.x, dy=S.y-PAT.y, d=Math.hypot(dx,dy), n=Math.ceil(d/3), i;
  for(i=1;i<n;i++){
    var x=PAT.x+dx*i/n, y=PAT.y+dy*i/n;
    if(PAT.room==='out'){ if(solidAtOutdoor(x,y)) return false; }
    else{ var t=tileAt(INTERIORS[PAT.room],x,y); if(t==='#'||(t==='='&&!doorIsOpen(INTERIORS[PAT.room],x,y))) return false; }
  }
  return true;
}
function patSees(){
  if(PAT.state!=='walk'||HIDE.on) return false;
  return Math.hypot(S.x-PAT.x,S.y-PAT.y)<PAT_SEE&&patLOS();
}
/* 规规矩矩坐在自己座位上的人，它不管 */
function patIgnores(){ return (S.seated&&needWhere(S.tsec)==='教室'&&atMySeat())||onLeave(); }   /* 请假中它也不管你 */
/* 室内寻路：网格上 BFS，走格子中心。以前走直线，一碰到教室的墙就卡在原地 */
function patWalkable(R,c,r){
  if(r<0||c<0||r>=R.rows||c>=R.cols) return false;
  var t=R.grid[r][c];
  if(t==='.'||t==='P') return true;
  if(t==='=') return doorIsOpen(R,R.ox+(c+0.5)*R.tw,R.oy+(r+0.5)*R.th);
  return false;
}
/* ---- 细网格寻路 ----
   以前在 1 米的格子上走格子中心，身体（半径 0.28 米）会擦过办公椅、机房的桌椅。
   现在每格切成 4×4 个 0.25 米的小格：墙、楼梯、家具的真实占地（R.foot）往外胀一个身体半径，
   胀进去的小格不能走；门按开没开实时判断。路径找到以后拉直，拐角不会切进家具。 */
var PAT_NAV_N=4, PAT_BODY=0.30;
function patNav(R){
  if(R.patNav&&R.patNav.foot===R.foot) return R.patNav;
  var N=PAT_NAV_N, W=R.cols*N, H=R.rows*N, cm=R.tw*U2M, blk=new Uint8Array(W*H), door=new Uint8Array(W*H);
  var hw=R.cols*cm/2, hh=R.rows*cm/2, r=PAT_BODY, c, rr;
  function stamp(x0,x1,z0,z1){          /* 房间左上角为原点的米 */
    var i0=Math.max(0,Math.floor((x0-r)/cm*N-0.5)), i1=Math.min(W-1,Math.ceil((x1+r)/cm*N-0.5));
    var j0=Math.max(0,Math.floor((z0-r)/cm*N-0.5)), j1=Math.min(H-1,Math.ceil((z1+r)/cm*N-0.5)), i, j;
    for(j=j0;j<=j1;j++) for(i=i0;i<=i1;i++){
      var mx=(i+0.5)*cm/N, mz=(j+0.5)*cm/N;
      if(mx>x0-r&&mx<x1+r&&mz>z0-r&&mz<z1+r) blk[i+j*W]=1;
    }
  }
  for(rr=0;rr<R.rows;rr++) for(c=0;c<R.cols;c++){
    var t=R.grid[rr][c];
    if(t==='='){ var a, b; for(b=0;b<N;b++) for(a=0;a<N;a++) door[c*N+a+(rr*N+b)*W]=1; continue; }
    if(isSolidCh(t)||t==='O') stamp(c*cm,(c+1)*cm,rr*cm,(rr+1)*cm);
    else if(!R.foot&&FURN_SOLID[t]!==undefined&&t!=='P'){ var f=FURN_SOLID[t]; stamp((c+0.5-f/2)*cm,(c+0.5+f/2)*cm,(rr+0.5-f/2)*cm,(rr+0.5+f/2)*cm); }
  }
  function stampM(L){ (L||[]).forEach(function(q){ stamp(q.x0+hw,q.x1+hw,q.z0+hh,q.z1+hh); }); }
  if(R.foot) for(var k in R.foot) stampM(R.foot[k]);
  stampM(R.propExtra); stampM(R.stairExtra);
  R.patNav={W:W,H:H,blk:blk,door:door,foot:R.foot,cm:cm};
  return R.patNav;
}
function patNodeOf(R,wx,wy){ var N=PAT_NAV_N; return [Math.floor((wx-R.ox)/R.tw*N),Math.floor((wy-R.oy)/R.th*N)]; }
function patNodeW(R,i,j){ var N=PAT_NAV_N; return {x:R.ox+(i+0.5)*R.tw/N, y:R.oy+(j+0.5)*R.th/N}; }
function patFree(R,nv,i,j){
  if(i<0||j<0||i>=nv.W||j>=nv.H) return false;
  var k=i+j*nv.W;
  if(nv.blk[k]) return false;
  if(nv.door[k]){ var p=patNodeW(R,i,j); return doorIsOpen(R,p.x,p.y); }
  return true;
}
/* 离 (i,j) 最近的能走的小格（站在家具边上、柜门前时用） */
function patSnap(R,nv,i,j){
  if(patFree(R,nv,i,j)) return [i,j];
  var rad, a, b, best=null, bd=1e9;
  for(rad=1;rad<=6&&!best;rad++){
    for(b=-rad;b<=rad;b++) for(a=-rad;a<=rad;a++){
      if(Math.max(Math.abs(a),Math.abs(b))!==rad||!patFree(R,nv,i+a,j+b)) continue;
      var d=a*a+b*b; if(d<bd){ bd=d; best=[i+a,j+b]; }
    }
  }
  return best;
}
/* 两个小格之间直线走过去全是能走的。线两侧各再看四分之一格：拉直的路不贴着胀开的家具占地抄近路
   （家具占地按模型的碰撞代理算，斜着的椅背比方块深，以前只看线上的格子会从它的角上擦过去） */
function patClear(R,nv,a,b){
  var n=Math.ceil(Math.max(Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1]))*4), k, di, dj;
  for(k=1;k<n;k++){
    var u=k/n, fi=a[0]+(b[0]-a[0])*u, fj=a[1]+(b[1]-a[1])*u;
    for(di=-0.25;di<=0.25;di+=0.5) for(dj=-0.25;dj<=0.25;dj+=0.5)
      if(!patFree(R,nv,Math.round(fi+di),Math.round(fj+dj))) return false;
  }
  return true;
}
function patPath(tx,ty){
  var R=INTERIORS[PAT.room], nv=patNav(R), W=nv.W;
  var s0=patNodeOf(R,PAT.x,PAT.y), t0=patNodeOf(R,tx,ty);
  var s=patSnap(R,nv,s0[0],s0[1]), t=patSnap(R,nv,t0[0],t0[1]);
  if(!s||!t) return null;
  var sk=s[0]+s[1]*W, tk=t[0]+t[1]*W, prev=new Int32Array(nv.W*nv.H).fill(-2), q=[sk], head=0, k;
  var D=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  prev[sk]=-1;
  while(head<q.length){
    k=q[head++]; if(k===tk) break;
    var i=k%W, j=(k-i)/W, d;
    for(d=0;d<8;d++){
      var ni=i+D[d][0], nj=j+D[d][1], nk=ni+nj*W;
      if(ni<0||nj<0||ni>=W||nj>=nv.H||prev[nk]!==-2||!patFree(R,nv,ni,nj)) continue;
      if(d>=4&&(!patFree(R,nv,i+D[d][0],j)||!patFree(R,nv,i,j+D[d][1]))) continue;   /* 斜着走不贴角 */
      prev[nk]=k; q.push(nk);
    }
  }
  if(prev[tk]===-2) return null;
  var nodes=[]; k=tk;
  while(k!==-1){ nodes.unshift([k%W,(k-k%W)/W]); k=prev[k]; }
  /* 拉直：从当前点能直线走到的最远一个就跳过去 */
  /* 先走到起点格中心，重规划时才不会从格子边缘抄近路切进门框。 */
  var path=[patNodeW(R,nodes[0][0],nodes[0][1])], cur=0;
  while(cur<nodes.length-1){
    var nx=nodes.length-1;
    while(nx>cur+1&&!patClear(R,nv,nodes[cur],nodes[nx])) nx--;
    path.push(patNodeW(R,nodes[nx][0],nodes[nx][1])); cur=nx;
  }
  if(t0[0]===t[0]&&t0[1]===t[1]&&path.length) path[path.length-1]={x:tx,y:ty};
  return path;
}
/* 内部用：某个世界坐标点（按细网格）能不能走 */
function patNavFree(R,wx,wy){ var nv=patNav(R), n=patNodeOf(R,wx,wy); return patFree(R,nv,n[0],n[1]); }
/* 出现的位置：从你脚下能走到的地方里，挑远的那一批之一 */
function patFarSpot(){
  var R=INTERIORS[PAT.room], nv=patNav(R), W=nv.W, D=[[1,0],[-1,0],[0,1],[0,-1]];
  var p0=patNodeOf(R,S.x,S.y), st=patSnap(R,nv,p0[0],p0[1]);
  if(!st) return null;
  var dist=new Int32Array(W*nv.H).fill(-1), q=[st[0]+st[1]*W], head=0, out=[];
  dist[q[0]]=0;
  while(head<q.length){
    var k=q[head++], i=k%W, j=(k-i)/W; out.push(k);
    for(var d=0;d<4;d++){
      var ni=i+D[d][0], nj=j+D[d][1], nk=ni+nj*W;
      if(ni<0||nj<0||ni>=W||nj>=nv.H||dist[nk]>=0||!patFree(R,nv,ni,nj)) continue;
      dist[nk]=dist[k]+1; q.push(nk);
    }
  }
  if(out.length<2) return null;
  out.sort(function(a,b){ return dist[b]-dist[a]; });
  var pk=out[Math.floor(Math.random()*Math.max(1,Math.floor(out.length*0.15)))];
  return patNodeW(R,pk%W,(pk-pk%W)/W);
}
function patPickSpot(far){
  if(far&&PAT.room!=='out') return patFarSpot();
  var best=null, bd=-1, k;
  for(k=0;k<40;k++){
    var x, y;
    if(PAT.room==='out'){
      var a=rnd(0,TAU), r=far?rnd(260,420):rnd(60,240);
      x=S.x+Math.cos(a)*r; y=S.y+Math.sin(a)*r;
      if(Collision.depth(x,y,PAT_BODY/U2M)>1e-7) continue;
    }else{
      var R=INTERIORS[PAT.room], c, r2;
      if(!far&&Math.random()<0.6){               /* 一多半时候往你附近转 */
        c=Math.floor((S.x-R.ox)/R.tw+rnd(-9,9)); r2=Math.floor((S.y-R.oy)/R.th+rnd(-5,5));
      }else{ c=Math.floor(rnd(1,R.cols-1)); r2=Math.floor(rnd(1,R.rows-1)); }
      if(!patWalkable(R,c,r2)||!patNavFree(R,R.ox+(c+0.5)*R.tw,R.oy+(r2+0.5)*R.th)) continue;
      if(!far&&!patPath(R.ox+(c+0.5)*R.tw,R.oy+(r2+0.5)*R.th)) continue;
      x=R.ox+(c+0.5)*R.tw; y=R.oy+(r2+0.5)*R.th;
    }
    var d=Math.hypot(x-S.x,y-S.y);
    if(!far) return {x:x,y:y};
    if(d>bd){ bd=d; best={x:x,y:y}; }
  }
  return best;
}
function patStart(){
  PAT.room=patRoomHere(); PAT.state='warn'; PAT.t=0;
  os(PAT.room==='out'?'我：远处的路灯，一盏接一盏地按着拍子闪。':'我：灯开始一明一暗地闪。两下短的，一下长的，像有人在数拍子。',4,OS_KEEP);
}
function patAppear(){
  var p=patPickSpot(true); if(!p){ patReset(true); PAT.next=10; return; }
  PAT.blinkCD=0.8;PAT.afterBlink=0;
  PAT.x=p.x; PAT.y=p.y; PAT.state='walk'; PAT.t=0; PAT.walkT=0; PAT.lock=0; PAT.locked=false;
  var q=patPickSpot(false)||p; PAT.tx=q.x; PAT.ty=q.y;
  patAddFig();
  PAT.path=null;
  os('我：那边多了一个很高的人影。我眨了一下眼，它已经站在更近的地方。',4.2,OS_KEEP);
}
function patEnd(msg){
  if(msg) os(msg,3.2);
  patReset(S.mode==='in'&&PAT.room===S.room);
  PAT.next=patInterval();
}
/* 以完整路径验证一跳，视觉上瞬移，碰撞仍沿路径细分；关门或薄障碍不能穿过。 */
function patBlink(distance){
  var R=PAT.room==='out'?null:INTERIORS[PAT.room],route;
  if(R){route=patPath(PAT.tx,PAT.ty);if(!route)return false;}
  else route=[{x:PAT.tx,y:PAT.ty}];
  var oldX=PAT.x,oldY=PAT.y,left=distance;
  for(var i=0;i<route.length&&left>1e-5;i++){
    var dx=route[i].x-PAT.x,dy=route[i].y-PAT.y,len=Math.hypot(dx,dy);
    if(len<1e-5)continue;
    var step=Math.min(left,len),n=Math.max(1,Math.ceil(step/1.1)),mx=dx/len*step/n,my=dy/len*step/n;
    for(var j=0;j<n;j++){
      if(Collision.depth(PAT.x+mx,PAT.y+my,PAT_BODY/U2M,R)>1e-7){
        if(R)return Math.hypot(PAT.x-oldX,PAT.y-oldY)>0.01;
        if(Collision.depth(PAT.x+mx,PAT.y,PAT_BODY/U2M)<=1e-7)PAT.x+=mx;
        if(Collision.depth(PAT.x,PAT.y+my,PAT_BODY/U2M)<=1e-7)PAT.y+=my;
        continue;
      }
      PAT.x+=mx;PAT.y+=my;
    }
    left-=step;
  }
  return Math.hypot(PAT.x-oldX,PAT.y-oldY)>0.01;
}
/* 先清理失效巡察，再结算 SAN；patTick 也调用此检查以覆盖直接更新。 */
function patEndIfInvalid(){
  if(PAT.state==='idle')return false;
  var here=patRoomHere();
  if(PAT.room!==here){
    if(PAT.room==='out'||here==='out'||PAT.state==='walk') patEnd(PAT.locked?'我：门在身后合上。脚步声停在了门外。':null);
    else patEnd(null);
    return true;
  }
  /* 时段或地点不再允许巡察时，预警和追逐都立即结束；坐回座位或请假仍走躲避规则。 */
  if(!patEligible()){
    patEnd(PAT.state==='walk'&&S.mode==='in'&&!isNight()&&S.screen==='play'&&!S.dead?
      '我：铃响了。灯一下子正常了，走廊又空了。':null);
    return true;
  }
  return false;
}
function patTick(dt){
  if(patEndIfInvalid())return;
  PAT.afterBlink=Math.max(0,(PAT.afterBlink||0)-dt);
  if(PAT.state==='idle'){
    VisualState.patrolFlick=Math.max(0,(VisualState.patrolFlick||0)-dt); VisualState.patrolRed=Math.max(0,(VisualState.patrolRed||0)-dt);
    if(!patEligible()||patIgnores()) return;
    PAT.next-=dt;
    if(PAT.next<=0) patStart();
    return;
  }
  PAT.t+=dt;
  if(PAT.state==='warn'){
    VisualState.patrolFlick=Math.min(1,PAT.t/1.2);
    if(PAT.t>3.6) patAppear();
    return;
  }
  /* walk */
  PAT.walkT+=dt;
  VisualState.patrolFlick=PAT.locked?0.35:0.7;
  var d=Math.hypot(S.x-PAT.x,S.y-PAT.y), sees=patSees()&&!patIgnores();
  if(!PAT.locked){
    if(sees) PAT.lock+=dt*(d<60?2.2:1.1);
    else PAT.lock=Math.max(0,PAT.lock-dt*0.5);
    if(PAT.lock>=1&&hasItem('seal')){       /* 符纸：替你挡一次 */
      removeItem('seal');
      patEnd('我：口袋里的符纸一下子烫起来，烧成了灰。它的头转过来，又转了回去，像是什么也没看见。');
      return;
    }
    if(PAT.lock>=1){
      PAT.locked=true; PAT.lost=0; PAT.still=0;
      os('我：灯一下子全红了。它转过头来。它看见我了。',3.4,OS_FORCE);
      try{ SFX.anomaly&&SFX.anomaly('turn'); }catch(e){}
    }
  }
  VisualState.patrolRed=clamp((VisualState.patrolRed||0)+(PAT.locked?dt*3:-dt*2),0,1);
  if(PAT.locked){
    if(!sees&&(!HIDE.on||!HIDE.seen)) PAT.lost+=dt; else PAT.lost=0;
    if(PAT.lost>2.5){
      PAT.locked=false; PAT.lock=0;
      os('我：红光一点一点褪下去。它停下来，在听。',3.2);
    }
    /* 难的逃法：背对它，一动不动 */
    var face=angDiff(Math.atan2(PAT.y-S.y,PAT.x-S.x),S.ang);
    if(!HIDE.on&&!S.moving&&face>PI*2/3&&d<90) PAT.still+=dt; else PAT.still=0;
    if(PAT.still>2.5){
      patEnd('我：它从我身边走了过去。近得我听得见它在数我的呼吸。……然后灯亮回来了。');
      return;
    }
  }
  /* 平时停住，只在短促的脚步后瞬移一小段；背对静止的逃脱窗口中不逼近。 */
  PAT.blinkCD=(PAT.blinkCD===undefined?0.8:PAT.blinkCD)-dt;
  if(PAT.blinkCD<=0){
    var interval=PAT.locked?0.75:1.1;
    PAT.blinkCD=interval;
    if(PAT.locked){
      var target=HIDE.on&&HIDE.seen&&PAT.room!=='out'?lockerFront(INTERIORS[PAT.room],HIDE.c,HIDE.r):{x:S.x,y:S.y};
      PAT.tx=target.x;PAT.ty=target.y;
    }
    if(PAT.still<=0||HIDE.on){
      var moved=patBlink((PAT.locked?PAT_CHASE:PAT_SPEED)*interval);
      if(moved)PAT.afterBlink=0.22;
      var arrived=Math.hypot(PAT.tx-PAT.x,PAT.ty-PAT.y)<6;
      if(!PAT.locked&&(arrived||!moved)){var next=patPickSpot(false);if(next){PAT.tx=next.x;PAT.ty=next.y;}}
    }
  }
  PAT.step-=dt;
  if(PAT.step<=0&&d<200){                                        /* 脚步：按它在你哪一边分左右声道，背后的发闷 */
    PAT.step=PAT.locked?0.32:0.7;
    var rel=Math.atan2(PAT.y-S.y,PAT.x-S.x)-S.ang;
    try{ SFX.patStep(Math.sin(rel)*0.9,Math.pow(1-d/200,1.4),Math.cos(rel)<-0.2,PAT.locked); }catch(e){}
  }
  d=Math.hypot(S.x-PAT.x,S.y-PAT.y);
  if(PAT.afterBlink<=0&&d<PAT_CATCH&&patLOS()&&!patIgnores()&&(!HIDE.on||HIDE.seen)&&!S.dead){
    kill(HIDE.on?'柜门被拉开了。外面没有光，只有它弯下来的脸，和一只伸进来的手。'
                :'一只手从后面按住了我的头顶，很轻，像在点名。灯全红了。我被它带走了，带回了那个空着的座位。','grip');
    return;
  }
  if(!PAT.locked&&PAT.walkT>45) patEnd('我：灯恢复了。脚步声往楼梯那边去了。');
}

/* ---------- 模型：比老师还高的无面黑影 ---------- */
/* 巡察者的行头（和 teacher 人形同一套比例，再整体放大 1.12）：
   过膝的长大衣、立领、一排扣子；大檐帽；左臂一圈红袖章；右手夹着点名用的夹板。 */
