/* 储物柜、角色外观和旧巡察 API；世界权威在 modules/patrol-world。 */
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
  HIDE.seen=!!(PAT.state==='walk'&&patSees()&&(PAT.permanent||patEligible()&&!patIgnores()));   /* 当着它的面钻进去，等于没躲（要在 HIDE.on 之前算） */
  if(HIDE.seen)PatrolWorld.observeLocker(hit.c,hit.r);
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

/* 兼容名称；不会在换场景时重生或清除永久策略。 */
var PAT={},PAT_SPEED=16,PAT_CHASE=31,PAT_SEE=135,PAT_CATCH=19,PAT_BODY=.30,PAT_NAV_N=4;
var PAT_CFG={lostSearch:true,lostLinger:3,lockerMemory:true,memLinger:4,noise:false};
function patRoomHere(){return S.mode==='in'?S.room:'out';}
function patReset(keepHiding){
  patRemoveFig();VisualState.patrolFlick=0;VisualState.patrolRed=0;
  if(typeof PatrolWorld!=='undefined')PatrolWorld.reset();else patRemoveFig();
  if(!keepHiding){HIDE.on=false;HIDE.seen=false;var el=document.getElementById('hideslits');if(el)el.style.display='none';}
}
function patEligible(){return PatrolWorld.eligible();}
function patIgnores(){return !PAT.permanent&&PatrolWorld.exempt();}
function patSees(){return PatrolWorld.sees();}
function patLOS(){return PatrolNav.los(PatrolWorld.position(),PatrolNav.point(patRoomHere(),S.x,S.y,S.floorY));}
function patTick(dt){PatrolWorld.tick(dt);}
function patEnd(){if(!PAT.permanent)PatrolWorld.clearChase();}
function patEndIfInvalid(){if(!PAT.permanent&&(!patEligible()||patIgnores()))PatrolWorld.clearChase();}
function patStart(){patReset(true);}
function patAppear(){if(!PAT.version)PatrolWorld.reset();}
function patPath(x,y){return PatrolNav.path(PatrolWorld.position(),PatrolNav.point(PAT.room,x,y,PAT.fy));}
function patNav(R){return PatrolNav.grid(R.id);}
function patNodeOf(R,x,y){var n=PatrolNav.grid(R.id);return [Math.floor((x-n.ox)/n.step),Math.floor((y-n.oy)/n.step)];}
function patNodeW(R,i,j){var n=PatrolNav.grid(R.id);return {x:n.ox+(i+.5)*n.step,y:n.oy+(j+.5)*n.step};}
function patFree(R,n,i,j){return PatrolNav.free(R.id,i,j);}
function patNavFree(R,x,y){var n=patNodeOf(R,x,y);return PatrolNav.free(R.id,n[0],n[1]);}
