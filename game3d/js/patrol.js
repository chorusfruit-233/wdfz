/* 里世界 3D · 巡察者、储物柜、校长办公室
   巡察者：上课和考试的时候在各栋楼里游荡，抓不在座位上的人；夜里也会出现在室外。
     出现之前，屋里的灯会按心跳一样的节拍一明一暗（lighting.js 的 GLR.patrolFlick）；
     它看见你一会儿就锁定你，灯一下子全红（GLR.patrolRed），然后追过来，被抓到就死。
   怎么躲：
     · 跑出它的视线，跟丢 2.5 秒它就放弃；
     · 提前钻进储物柜（H）。被它看见你钻进去的话，没用；
     · 难的那个：被锁定以后背对着它、一动不动站 2.5 秒，它会从你身边走过去。
   校长办公室（行政楼 5F）：抽屉里有车钥匙和机房钥匙（每个容器 18%），但巡察者常驻、异象也来得勤。 */
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
  PAT.state='idle'; PAT.t=0; PAT.lock=0; PAT.locked=false; PAT.lost=0; PAT.still=0; PAT.room=null;
  GLR.patrolFlick=0; GLR.patrolRed=0;
  if(HIDE.on&&!keepHiding){ HIDE.on=false; var el=document.getElementById('hideslits'); if(el) el.style.display='none'; }
}
function patRoomHere(){ return S.mode==='in'?S.room:'out'; }
/* 现在这个地方，它会不会来 */
function patEligible(){
  if(S.dead||S.screen!=='play') return false;
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
function patIgnores(){ return S.seated&&needWhere(S.tsec)==='教室'&&atMySeat(); }
/* 室内寻路：网格上 BFS，走格子中心。以前走直线，一碰到教室的墙就卡在原地 */
function patWalkable(R,c,r){
  if(r<0||c<0||r>=R.rows||c>=R.cols) return false;
  var t=R.grid[r][c];
  if(t==='.'||t==='P') return true;
  if(t==='=') return doorIsOpen(R,R.ox+(c+0.5)*R.tw,R.oy+(r+0.5)*R.th);
  return false;
}
function patPath(tx,ty){
  var R=INTERIORS[PAT.room];
  var c0=Math.floor((PAT.x-R.ox)/R.tw), r0=Math.floor((PAT.y-R.oy)/R.th);
  var c1=Math.floor((tx-R.ox)/R.tw), r1=Math.floor((ty-R.oy)/R.th);
  if(!patWalkable(R,c1,r1)) return null;
  var W=R.cols, prev={}, q=[c0+r0*W], head=0, k=c0+r0*W, D=[[1,0],[-1,0],[0,1],[0,-1]];
  prev[k]=-1;
  while(head<q.length){
    k=q[head++];
    if(k===c1+r1*W) break;
    var c=k%W, r=(k-c)/W;
    for(var i=0;i<4;i++){
      var nc=c+D[i][0], nr=r+D[i][1], nk=nc+nr*W;
      if(prev[nk]!==undefined||!patWalkable(R,nc,nr)) continue;
      prev[nk]=k; q.push(nk);
    }
  }
  if(prev[c1+r1*W]===undefined) return null;
  var path=[]; k=c1+r1*W;
  while(k!==-1&&k!==c0+r0*W){ var cc=k%W; path.unshift({x:R.ox+(cc+0.5)*R.tw,y:R.oy+((k-cc)/W+0.5)*R.th}); k=prev[k]; }
  return path;
}
/* 出现的位置：从你脚下能走到的格子里，挑远的那一批之一 */
function patFarSpot(){
  var R=INTERIORS[PAT.room], W=R.cols, D=[[1,0],[-1,0],[0,1],[0,-1]];
  var c0=Math.floor((S.x-R.ox)/R.tw), r0=Math.floor((S.y-R.oy)/R.th), seen={}, q=[[c0,r0,0]], head=0, out=[];
  seen[c0+r0*W]=1;
  while(head<q.length){
    var e=q[head++]; out.push(e);
    for(var i=0;i<4;i++){
      var nc=e[0]+D[i][0], nr=e[1]+D[i][1], nk=nc+nr*W;
      if(seen[nk]||!patWalkable(R,nc,nr)) continue;
      seen[nk]=1; q.push([nc,nr,e[2]+1]);
    }
  }
  if(out.length<2) return null;
  out.sort(function(a,b){ return b[2]-a[2]; });
  var pick=out[Math.floor(Math.random()*Math.max(1,Math.floor(out.length*0.15)))];
  return {x:R.ox+(pick[0]+0.5)*R.tw, y:R.oy+(pick[1]+0.5)*R.th};
}
function patPickSpot(far){
  if(far&&PAT.room!=='out') return patFarSpot();
  var best=null, bd=-1, k;
  for(k=0;k<40;k++){
    var x, y;
    if(PAT.room==='out'){
      var a=rnd(0,TAU), r=far?rnd(260,420):rnd(60,240);
      x=S.x+Math.cos(a)*r; y=S.y+Math.sin(a)*r;
      if(solidAtOutdoor(x,y)) continue;
    }else{
      var R=INTERIORS[PAT.room], c, r2;
      if(!far&&Math.random()<0.6){               /* 一多半时候往你附近转 */
        c=Math.floor((S.x-R.ox)/R.tw+rnd(-9,9)); r2=Math.floor((S.y-R.oy)/R.th+rnd(-5,5));
      }else{ c=Math.floor(rnd(1,R.cols-1)); r2=Math.floor(rnd(1,R.rows-1)); }
      if(!patWalkable(R,c,r2)) continue;
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
  PAT.x=p.x; PAT.y=p.y; PAT.state='walk'; PAT.t=0; PAT.walkT=0; PAT.lock=0; PAT.locked=false;
  var q=patPickSpot(false)||p; PAT.tx=q.x; PAT.ty=q.y;
  patAddFig();
  PAT.path=null;
  os('我：走廊那头多了一个人。很高，走路一点声音都没有。它在一间一间地往里看。',4.2,OS_KEEP);
}
function patEnd(msg){
  if(msg) os(msg,3.2);
  patReset(S.mode==='in'&&PAT.room===S.room);
  PAT.next=patInterval();
}
function patTick(dt){
  var here=patRoomHere();
  if(PAT.state!=='idle'&&PAT.room!==here){
    if(PAT.room==='out'||here==='out'||PAT.state==='walk') patEnd(PAT.locked?'我：门在身后合上。脚步声停在了门外。':null);
    else patEnd(null);
    return;
  }
  if(PAT.state==='idle'){
    GLR.patrolFlick=Math.max(0,(GLR.patrolFlick||0)-dt); GLR.patrolRed=Math.max(0,(GLR.patrolRed||0)-dt);
    if(!patEligible()||patIgnores()) return;
    PAT.next-=dt;
    if(PAT.next<=0) patStart();
    return;
  }
  PAT.t+=dt;
  if(PAT.state==='warn'){
    GLR.patrolFlick=Math.min(1,PAT.t/1.2);
    if(PAT.t>3.6) patAppear();
    return;
  }
  /* walk */
  PAT.walkT+=dt;
  GLR.patrolFlick=PAT.locked?0.35:0.7;
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
  GLR.patrolRed=clamp((GLR.patrolRed||0)+(PAT.locked?dt*3:-dt*2),0,1);
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
  /* 走路：锁定了就直奔你（躲进柜子被看见，它去开柜门），否则在各处转 */
  var sp=PAT_SPEED, tx, ty;
  if(PAT.locked){
    sp=PAT_CHASE*(PAT.still>0?0.35:1);
    /* 被看见时去柜门前，而不是向不可行走的柜子格直线穿墙。 */
    var target=HIDE.on&&HIDE.seen&&PAT.room!=='out'?lockerFront(INTERIORS[PAT.room],HIDE.c,HIDE.r):{x:S.x,y:S.y};
    PAT.tx=target.x; PAT.ty=target.y;
  }
  if(PAT.room!=='out'){
    PAT.repath=(PAT.repath||0)-dt;
    if(!PAT.path||!PAT.path.length||PAT.repath<=0){
      PAT.repath=PAT.locked?0.5:3;
      var route=patPath(PAT.tx,PAT.ty);
      PAT.pathBlocked=!route; PAT.path=route||[];
      if(!PAT.path.length&&!PAT.locked){
        var q0=patPickSpot(false);
        if(q0){ PAT.tx=q0.x; PAT.ty=q0.y; route=patPath(q0.x,q0.y); PAT.pathBlocked=!route; PAT.path=route||[]; }
      }
    }
    var wp=PAT.path[0]||(PAT.pathBlocked?{x:PAT.x,y:PAT.y}:{x:PAT.tx,y:PAT.ty});
    if(PAT.path.length&&Math.hypot(wp.x-PAT.x,wp.y-PAT.y)<3){ PAT.path.shift(); wp=PAT.path[0]||{x:PAT.tx,y:PAT.ty}; }
    if(PAT.locked&&d<14&&!HIDE.on&&!PAT.pathBlocked&&patLOS()){ wp={x:S.x,y:S.y}; }
    tx=wp.x; ty=wp.y;
  }else{ tx=PAT.tx; ty=PAT.ty; }
  var dx=tx-PAT.x, dy=ty-PAT.y, dl=Math.hypot(dx,dy)||1, st=Math.min(dl,sp*dt);
  var mvx=dx/dl*st, mvy=dy/dl*st, moved=false;
  if(PAT.room!=='out'){ PAT.x+=mvx; PAT.y+=mvy; moved=true; }        /* 室内沿格子中心走，不会穿墙 */
  else{
    if(!patSolid(PAT.x+mvx,PAT.y)){ PAT.x+=mvx; moved=true; }
    if(!patSolid(PAT.x,PAT.y+mvy)){ PAT.y+=mvy; moved=true; }
  }
  var arrived=Math.hypot(PAT.tx-PAT.x,PAT.ty-PAT.y)<6;
  if(!PAT.locked&&(arrived||!moved)){ var q=patPickSpot(false); if(q){ PAT.tx=q.x; PAT.ty=q.y; PAT.path=null; } }
  PAT.step-=dt;
  if(PAT.step<=0&&d<200){                                        /* 脚步：按它在你哪一边分左右声道，背后的发闷 */
    PAT.step=PAT.locked?0.32:0.7;
    var rel=Math.atan2(PAT.y-S.y,PAT.x-S.x)-S.ang;
    try{ SFX.patStep(Math.sin(rel)*0.9,Math.pow(1-d/200,1.4),Math.cos(rel)<-0.2,PAT.locked); }catch(e){}
  }
  if(d<PAT_CATCH&&patLOS()&&!patIgnores()&&(!HIDE.on||HIDE.seen)&&!S.dead){
    kill(HIDE.on?'柜门被拉开了。外面没有光，只有它弯下来的脸，和一只伸进来的手。'
                :'一只手从后面按住了我的头顶，很轻，像在点名。灯全红了。我被它带走了，带回了那个空着的座位。','grip');
    return;
  }
  if(!PAT.locked&&PAT.walkT>45) patEnd('我：灯恢复了。脚步声往楼梯那边去了。');
  if(!PAT.locked&&!patEligible()) patEnd('我：铃响了。灯一下子正常了，走廊又空了。');
}

/* ---------- 模型：比老师还高的黑影，两点红光 ---------- */
function patAddFig(){
  patRemoveFig();
  try{
    var g=new THREE.Group();
    var body=figMesh('teacher',new THREE.MeshBasicMaterial({color:0x040506,fog:true}),1.12);
    g.add(body);
    var em=new THREE.MeshBasicMaterial({color:0xff2a1a,fog:false});
    for(var s=-1;s<=1;s+=2){ var e=new THREE.Mesh(new THREE.SphereGeometry(0.035,6,4),em); e.position.set(s*0.065,2.6,0.15); g.add(e); }
    g.userData.eye=em;
    GLR.patFig=g; GLR.scene.add(g);
  }catch(e){ GLR.patFig=null; }
}
function patRemoveFig(){ if(GLR.patFig){ try{ GLR.scene.remove(GLR.patFig); }catch(e){} GLR.patFig=null; } }
function patRender(){
  var g=GLR.patFig; if(!g) return;
  if(PAT.state!=='walk'){ g.visible=false; return; }
  var p=PAT.room==='out'?worldToScene(PAT.x,PAT.y,null):worldToScene(PAT.x,PAT.y,INTERIORS[PAT.room]);
  g.visible=true; g.position.set(p.x,PAT.room==='out'?0:0,p.z);
  g.lookAt(GLR.cam.position.x,0,GLR.cam.position.z);  /* 人形正面朝 +z，lookAt 正好让它面朝你 */
  if(g.userData.eye) g.userData.eye.color.setRGB(1,PAT.locked?0.05:0.25,PAT.locked?0.02:0.12);
}
