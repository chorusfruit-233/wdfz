/* @module-capsule */
(function($imports){
/* 里世界 3D · 场景切换、碰撞、移动、镜头 */
'use strict';

function clearWorldMesh(){ return $imports.Engine.clearWorld(); }
function addRoomLights(R){ return $imports.Engine.addRoomLights(R); }
function enterWorldRoom(roomId){ return $imports.Engine.enterRoom(roomId); }
function enterWorldOut(){ return $imports.Engine.enterOutside(); }

function worldToScene(wx,wy,roomR){
  if(roomR){
    var tw=$imports.TTILE*$imports.U2M, th=$imports.TTILE*$imports.U2M;
    return { x:(wx-roomR.ox)*$imports.U2M-roomR.cols*tw*0.5, z:(wy-roomR.oy)*$imports.U2M-roomR.rows*th*0.5 };
  }
  return { x:wx*$imports.U2M, z:wy*$imports.U2M };
}

function teachFrontZ(){
  var t=null,i;
  for(i=0;i<$imports.OBJ.length;i++) if($imports.OBJ[i].id==='teach'){ t=$imports.OBJ[i]; break; }
  if(!t) return ($imports.GATE_N.y*$imports.SC)*$imports.U2M;
  return ((t.y+t.h)*$imports.SC)*$imports.U2M;
}


function buildRoomBounds(){
  for(var id in $imports.INTERIORS){
    var R=$imports.INTERIORS[id];
    var o=(0,$imports.objById)(R.host);
    R.w=R.cols*R.tw; R.h=R.rows*R.th;
    if(o){
      var hc={x:o.x*$imports.SC+o.w*$imports.SC/2, y:o.y*$imports.SC+o.h*$imports.SC/2};
      R.ox=hc.x-R.w/2; R.oy=hc.y-R.h/2;
    }else{ R.ox=0; R.oy=0; }
    R.cx=R.ox+R.w/2; R.cy=R.oy+R.h/2;
    $imports.SpaceLayout.ensureRoom(R);
  }
  $imports.SpaceLayout.ensureOutside();
}

function tileAt(R,wx,wy){
  var c=Math.floor((wx-R.ox)/R.tw), r=Math.floor((wy-R.oy)/R.th);
  if(r<0||c<0||r>=R.rows||c>=R.cols) return '#';
  return R.grid[r][c];
}
var FURN_SOLID={'d':0.78,'T':0.86,'t':0.76,'k':0.82,'f':0.78,'b':0.34,
                'l':0.90,'V':0.82,'q':0.90,'n':0.70,'R':0.84,'c':0.34,'p':0.78,'x':0.60,
                'K':0.84,'C':0.78,'N':0.62,'Z':0.74,'Y':0.52,
                /* 以前这些都能直接穿过去：垃圾桶、终端、洗手台、隔间、服务器、货架 */
                'X':0.86,'D':0.72,'w':0.80,'B':0.94,'G':0.94,'Q':0.82,'v':0.72,'A':0.80};
function solidAtInterior(R,wx,wy){
  if(R.stairwell)return $imports.StairWorld.depth(R.id,wx,wy,0,$imports.S.floorY)>0;
  var t=tileAt(R,wx,wy);
  if(t==='='){
    if($imports.Classmates.blocked(R.id,wx,wy)) return true;   /* 他们堵在门口 */
    return !(0,$imports.doorIsOpen)(R,wx,wy);
  }
  if((0,$imports.isSolidCh)(t)&&!(t==='S'&&$imports.StairWorld.doorwayFree(R,wx,wy))) return true;
  /* stairExtra / propExtra 是米；这里以前直接拿世界单位去比（差 9 倍），楼梯井的挡墙等于没有 */
  var lx=(wx-R.ox-R.w*0.5)*$imports.U2M, lz=(wy-R.oy-R.h*0.5)*$imports.U2M, si, sb;
  if(R&&R.stairExtra){
    for(si=0;si<R.stairExtra.length;si++){
      sb=R.stairExtra[si];
      if(lx>sb.x0&&lx<sb.x1&&lz>sb.z0&&lz<sb.z1) return true;
    }
  }
  if(R&&R.propExtra){
    for(si=0;si<R.propExtra.length;si++){
      sb=R.propExtra[si];
      if(lx>sb.x0&&lx<sb.x1&&lz>sb.z0&&lz<sb.z1) return true;
    }
  }
  if(R.spiral&&typeof $imports.spiralSolid==='function'&&(0,$imports.spiralSolid)(R,wx,wy)) return true;
  if(R.solid&&R.solid(wx,wy)) return true;                    /* 自带碰撞的房间（模块提供，例如虚空迷宫按高度判断） */
  if(R.foot){                        /* 房间建过模型：按模型真实占地（本格和周围一圈的家具都可能伸过来） */
    var c0=Math.floor((wx-R.ox)/R.tw), r0=Math.floor((wy-R.oy)/R.th), dc, dr, F, fi;
    for(dr=-1;dr<=1;dr++) for(dc=-1;dc<=1;dc++){
      F=R.foot[(c0+dc)+','+(r0+dr)]; if(!F) continue;
      for(fi=0;fi<F.length;fi++){ sb=F[fi]; if(lx>sb.x0&&lx<sb.x1&&lz>sb.z0&&lz<sb.z1) return true; }
    }
    return false;
  }
  var f=FURN_SOLID[t];
  if(f!==undefined){
    var c=Math.floor((wx-R.ox)/R.tw), r=Math.floor((wy-R.oy)/R.th);
    var cx=R.ox+(c+0.5)*R.tw, cy=R.oy+(r+0.5)*R.th;
    if(Math.abs(wx-cx)<R.tw*f/2 && Math.abs(wy-cy)<R.th*f/2) return true;
  }
  return false;
}
function solidAtOutdoor(wx,wy){
  var mx=wx/$imports.SC, my=wy/$imports.SC, i;
  if(mx<$imports.BOUND.x0+4||my<$imports.BOUND.y0+4||mx>$imports.BOUND.x1-4||my>$imports.BOUND.y1-4) return true;
  for(i=0;i<$imports.OBJ.length;i++){
    var o=$imports.OBJ[i];
    if(o.k!=='roof'||o.open) continue;                       /* 开敞的棚子（车棚）按 OUT_SOLID 里的钢架和车挡人 */
    if(mx>o.x&&mx<o.x+o.w&&my>o.y&&my<o.y+o.h) return true;
  }
  for(i=0;i<$imports.OUT_SOLID.length;i++){
    var q=$imports.OUT_SOLID[i];
    if(mx>q.x0&&mx<q.x1&&my>q.y0&&my<q.y1) return true;
  }
  return false;
}
var PRAD=3.0;      /* 世界单位的玩家半径 */
function solidAt(wx,wy){
  if($imports.S.mode==='in'){
    var R=$imports.INTERIORS[$imports.S.room]; if(!R) return true;
    return solidAtInterior(R,wx,wy);
  }
  return solidAtOutdoor(wx,wy);
}
function canStand(wx,wy){
  return $imports.Collision.depth(wx,wy,PRAD)<1e-7;
}
function moveBy(dx,dy,dt){
  if(!Number.isFinite(dx)||!Number.isFinite(dy))return;
  var n=Math.max(1,Math.ceil((dt||1/60)*$imports.Physics.hz),Math.ceil(Math.hypot(dx,dy)/(PRAD*0.5)));
  dx/=n;dy/=n;
  var MR=$imports.S.mode==='in'?$imports.INTERIORS[$imports.S.room]:null;
  for(var i=0;i<n;i++){
    var before=$imports.Collision.depth($imports.S.x,$imports.S.y,PRAD),nx=$imports.S.x+dx,ny=$imports.S.y+dy;
    var ax=$imports.Collision.depth(nx,$imports.S.y,PRAD);
    if(ax<1e-7||ax<before-1e-7){$imports.S.x=nx;before=ax;}
    var ay=$imports.Collision.depth($imports.S.x,ny,PRAD);
    if(ay<1e-7||ay<before-1e-7)$imports.S.y=ny;
    var beforeAngle=$imports.S.ang;$imports.StairWorld.moved();
    var da=$imports.S.ang-beforeAngle;if(da){var ndx=dx*Math.cos(da)-dy*Math.sin(da);dy=dx*Math.sin(da)+dy*Math.cos(da);dx=ndx;}
    (0,$imports.spiralUpdate)();
    MR=$imports.S.mode==='in'?$imports.INTERIORS[$imports.S.room]:null;
    if(MR&&MR.moved)MR.moved();                               /* 房间自己的高度（台阶、坠落）：每一小步之后更新 */
  }
}

function doorWorld(o){
  var f=o.door||'s';
  if(f==='w') return { x:o.x*$imports.SC-26, y:(o.y+o.h/2)*$imports.SC };
  if(f==='e') return { x:(o.x+o.w)*$imports.SC+26, y:(o.y+o.h/2)*$imports.SC };
  if(f==='n') return { x:o.x*$imports.SC+o.w*$imports.SC/2, y:o.y*$imports.SC-26 };
  return { x:o.x*$imports.SC+o.w*$imports.SC/2, y:(o.y+o.h)*$imports.SC+26 };
}
function showBanner(txt){
  var el=document.getElementById('banner');
  if(!el) return;
  el.textContent=txt; el.style.opacity='1';
  el._t=$imports.Lifecycle.renew('banner').timeout(function(){ el.style.opacity='0'; },1800);
}
function fadeTo(fn){
  var transition=$imports.Lifecycle.renew('transition');
  var f=document.getElementById('fade');
  if(!f){ fn(); return; }
  transition.own(function(){f.style.opacity='0';});
  f.style.transition='opacity .16s ease'; f.style.opacity='1';
  transition.timeout(function(){
    try{ fn(); }catch(e){$imports.Lifecycle.report('scene-transition',e);}
    if(transition.active()){f.style.transition='opacity .30s ease'; f.style.opacity='0';}
  },170);
}
var ENTER_VIA=null;          /* 'stair' / 'out'：决定进楼后站在哪 */
function enterRoom(id,spawn,afterEnter){ fadeTo(function(){ doEnterRoom(id,spawn); if(afterEnter) afterEnter(); }); }
/* 找门口 / 楼梯口旁边一格能站的地方，并面朝屋里 */
function entryNear(R,chs){
  var r,c,k,best=null;
  var dirs=[[0,-1],[0,1],[-1,0],[1,0]];
  for(r=0;r<R.rows&&!best;r++) for(c=0;c<R.cols&&!best;c++){
    if(chs.indexOf(R.grid[r][c])<0) continue;
    for(k=0;k<4&&!best;k++){
      for(var st=1;st<=3;st++){
        var rr=r+dirs[k][1]*st, cc=c+dirs[k][0]*st;
        if(rr<1||cc<1||rr>=R.rows-1||cc>=R.cols-1) break;
        var ch=R.grid[rr][cc];
        if(ch==='#'||ch==='S') break;
        if(ch!=='.') continue;
        var wx=R.ox+(cc+0.5)*R.tw, wy=R.oy+(rr+0.5)*R.th;
        if(solidAtInterior(R,wx,wy)) continue;
        best={x:wx,y:wy,ang:Math.atan2(dirs[k][1],dirs[k][0])};
        break;
      }
    }
  }
  return best;
}
/* A seated body overlaps its chair. Stand into the adjacent aisle, never through the desk in front. */
function leaveSeat(){
  if(!$imports.S.seated)return false;
  var R=$imports.S.mode==='in'?$imports.INTERIORS[$imports.S.room]:null,seat=$imports.S.seat,facing=seat?seat.facing:$imports.S.ang;
  $imports.S.seated=false;$imports.S.seat=null;
  if(!R||canStand($imports.S.x,$imports.S.y))return true;
  var dirs=[facing+Math.PI/2,facing-Math.PI/2,facing+Math.PI];
  function pathClear(x,y){
    for(var j=1;j<=8;j++){
      var px=$imports.S.x+(x-$imports.S.x)*j/8,py=$imports.S.y+(y-$imports.S.y)*j/8,ch=tileAt(R,px,py);
      if(ch==='#'||ch==='S'||ch==='='&&!(0,$imports.doorIsOpen)(R,px,py))return false;
    }
    return true;
  }
  for(var radius=6;radius<=10.5;radius+=.5)for(var k=0;k<dirs.length;k++){
    var x=$imports.S.x+Math.cos(dirs[k])*radius,y=$imports.S.y+Math.sin(dirs[k])*radius;
    if(!canStand(x,y)||!pathClear(x,y))continue;
    /* 刚好站得下的那一点贴着桌沿，一迈步就卡在桌角上：再往过道里让一点（最多 3 个单位，一路都站得下才让） */
    for(var extra=.5;extra<=3;extra+=.5){
      var x2=$imports.S.x+Math.cos(dirs[k])*(radius+extra),y2=$imports.S.y+Math.sin(dirs[k])*(radius+extra);
      if(!canStand(x2,y2)||!pathClear(x2,y2))break;
      x=x2;y=y2;
    }
    $imports.S.x=x;$imports.S.y=y;return true;
  }
  return true;
}
function unstick(){
  try{
    if($imports.S.mode!=='in'||$imports.S.seated||$imports.HIDE.on) return;
    var R=$imports.INTERIORS[$imports.S.room]; if(!R) return;
    if(!solidAt($imports.S.x,$imports.S.y)) return;
    var c=Math.floor(($imports.S.x-R.ox)/R.tw), r=Math.floor(($imports.S.y-R.oy)/R.th), rad, dr, dc;
    for(rad=1; rad<=12; rad++){
      for(dr=-rad; dr<=rad; dr++){
        for(dc=-rad; dc<=rad; dc++){
          if(Math.abs(dr)!==rad && Math.abs(dc)!==rad) continue;
          var rr=r+dr, cc=c+dc;
          if(rr<0||cc<0||rr>=R.rows||cc>=R.cols) continue;
          var wx=R.ox+(cc+0.5)*R.tw, wy=R.oy+(rr+0.5)*R.th;
          if(!solidAt(wx,wy)){ $imports.S.x=wx; $imports.S.y=wy; return; }
        }
      }
    }
  }catch(e){}
}
/* 场景进入立即校正；后续只在模拟运行时检查，渲染和暂停不移动玩家。 */
function repairPlayerPlacement(dt){
  if($imports.S.mode!=='in'||$imports.S.dead||$imports.HIDE.on)return;
  $imports.S.stuckT=($imports.S.stuckT||0)+dt;
  if($imports.S.stuckT>0.5){$imports.S.stuckT=0;if(solidAt($imports.S.x,$imports.S.y))unstick();}
}
function doEnterRoom(id,spawn){
  var R=$imports.INTERIORS[id]; if(!R) return;
  $imports.SpaceLayout.ensureRoom(R);
  $imports.Lifecycle.scope('transition').cancel();
  $imports.Lifecycle.renew('scene');
  GameModules.emit('leaveRoom',$imports.S.mode==='in'?$imports.S.room:null,id);
  if(typeof $imports.FN_P!=='undefined'&&$imports.FN_P.grp&&$imports.FN_P.room!==id)(0,$imports.fnPeopleClear)();
  try{ (0,$imports.anfxClear)(); }catch(e){}
  try{ (0,$imports.spiralReset)(); }catch(e){}
  $imports.S.mode='in'; $imports.S.room=id;
  if(spawn){                                  /* 显式指定落点（开局坐座位） */
    $imports.S.x=spawn.x; $imports.S.y=spawn.y; if(spawn.ang!==undefined) $imports.S.ang=spawn.ang;
    $imports.S.enterCool=spawn&&spawn.seamless?0:0.9;
  }else if(id==='garage1'){
    $imports.S.x=R.ox+R.w-5*R.tw; $imports.S.y=R.oy+13*R.th;
    $imports.ROAM.on=false; $imports.ROAM.litAcc=0; $imports.S.ang=-$imports.PI/2;
    $imports.S.enterCool=1.4;
  }else{
    $imports.S.x=R.ox+R.w/2; $imports.S.y=R.oy+R.h-2*R.th;
    $imports.S.enterCool=spawn&&spawn.seamless?0:0.9;
  }
  if(!(spawn&&spawn.seated)){$imports.S.seated=false;$imports.S.seat=null;}
  else{$imports.S.seated=true;var sc=Math.floor(($imports.S.x-R.ox)/R.tw),sr=Math.floor(($imports.S.y-R.oy)/R.th);$imports.S.seat=$imports.ClassroomLayout.seat(R.id,sc,sr);if(!$imports.ClassroomLayout.valid($imports.S.seat,R)){$imports.S.seat=null;$imports.S.seated=false;}}
  if(R.spiral&&spawn&&spawn.spiral) (0,$imports.spiralRestore)(spawn.spiral);
  if(R.onEnter) R.onEnter(spawn||null);                      /* 房间自己的落点和高度：要在防卡位之前定下来 */
  var via=ENTER_VIA; ENTER_VIA=null;
  $imports.Classmates.enter();
  enterWorldRoom(id);
  if(!spawn){
    var en=null;
    try{ en=entryNear(R, via==='stair'?['S']:['O']); if(!en) en=entryNear(R,['O','S','L']); }catch(e){}
    if(en){ $imports.S.x=en.x; $imports.S.y=en.y; $imports.S.ang=en.ang; }
  }
  try{ unstick(); }catch(e){}
  $imports.VisualState.hurt=0;
  if(!(spawn&&spawn.seamless))showBanner($imports.INTERIORS[id].name);
  (0,$imports.onEnterRoom)(id,!!(spawn&&spawn.restoreVisit));
  (0,$imports.autoSave)();
}
function exitRoom(){ fadeTo(function(){ doExitRoom(); }); }
function doExitRoom(){
  var R=$imports.INTERIORS[$imports.S.room]; if(!R) return;
  $imports.Lifecycle.scope('transition').cancel();
  $imports.Lifecycle.renew('scene');
  GameModules.emit('leaveRoom',$imports.S.mode==='in'?$imports.S.room:null,null);
  if(typeof $imports.FN_P!=='undefined'&&$imports.FN_P.grp)(0,$imports.fnPeopleClear)();
  try{ (0,$imports.anfxClear)(); }catch(e){}
  var o=(0,$imports.objById)(R.host);
  try{ $imports.Dread.enter(null); }catch(e){}
  $imports.S.mode='out'; $imports.S.room=null; $imports.S.seated=false;$imports.S.seat=null;
  $imports.Classmates.enter();
  try{ (0,$imports.spiralReset)(); }catch(e){}
  showBanner('武大附中 · 校园');
  if(o){ var d=doorWorld(o); $imports.S.x=d.x; $imports.S.y=d.y; }
  $imports.S.enterCool=1.0;
  enterWorldOut();
  (0,$imports.autoSave)();
}

function syncCamera(dt,view){ return $imports.Engine.syncCamera(dt,view); }

function roomClockFrozen(){ var R=$imports.S.mode==='in'?$imports.INTERIORS[$imports.S.room]:null; return !!(R&&R.noClock); }

/* 旧工具的室外避让查询，内部配方必须显式传入自己的草稿。 */
function outFree(mx,my,pad,roadPad){return (0,$imports.outFreeInLayout)(mx,my,pad,roadPad,$imports.OUT_SOLID);}

/* @module-exports */
GameModules.publish("game3d/js/world.js",{
"clearWorldMesh":{get:function(){return clearWorldMesh;},set:function($value){clearWorldMesh=$value;}},
"addRoomLights":{get:function(){return addRoomLights;},set:function($value){addRoomLights=$value;}},
"enterWorldRoom":{get:function(){return enterWorldRoom;},set:function($value){enterWorldRoom=$value;}},
"enterWorldOut":{get:function(){return enterWorldOut;},set:function($value){enterWorldOut=$value;}},
"worldToScene":{get:function(){return worldToScene;},set:function($value){worldToScene=$value;}},
"teachFrontZ":{get:function(){return teachFrontZ;},set:function($value){teachFrontZ=$value;}},
"buildRoomBounds":{get:function(){return buildRoomBounds;},set:function($value){buildRoomBounds=$value;}},
"tileAt":{get:function(){return tileAt;},set:function($value){tileAt=$value;}},
"FURN_SOLID":{get:function(){return FURN_SOLID;},set:function($value){FURN_SOLID=$value;}},
"solidAtInterior":{get:function(){return solidAtInterior;},set:function($value){solidAtInterior=$value;}},
"solidAtOutdoor":{get:function(){return solidAtOutdoor;},set:function($value){solidAtOutdoor=$value;}},
"PRAD":{get:function(){return PRAD;},set:function($value){PRAD=$value;}},
"solidAt":{get:function(){return solidAt;},set:function($value){solidAt=$value;}},
"canStand":{get:function(){return canStand;},set:function($value){canStand=$value;}},
"moveBy":{get:function(){return moveBy;},set:function($value){moveBy=$value;}},
"doorWorld":{get:function(){return doorWorld;},set:function($value){doorWorld=$value;}},
"showBanner":{get:function(){return showBanner;},set:function($value){showBanner=$value;}},
"fadeTo":{get:function(){return fadeTo;},set:function($value){fadeTo=$value;}},
"ENTER_VIA":{get:function(){return ENTER_VIA;},set:function($value){ENTER_VIA=$value;}},
"enterRoom":{get:function(){return enterRoom;},set:function($value){enterRoom=$value;}},
"entryNear":{get:function(){return entryNear;},set:function($value){entryNear=$value;}},
"leaveSeat":{get:function(){return leaveSeat;},set:function($value){leaveSeat=$value;}},
"unstick":{get:function(){return unstick;},set:function($value){unstick=$value;}},
"repairPlayerPlacement":{get:function(){return repairPlayerPlacement;},set:function($value){repairPlayerPlacement=$value;}},
"doEnterRoom":{get:function(){return doEnterRoom;},set:function($value){doEnterRoom=$value;}},
"exitRoom":{get:function(){return exitRoom;},set:function($value){exitRoom=$value;}},
"doExitRoom":{get:function(){return doExitRoom;},set:function($value){doExitRoom=$value;}},
"syncCamera":{get:function(){return syncCamera;},set:function($value){syncCamera=$value;}},
"roomClockFrozen":{get:function(){return roomClockFrozen;},set:function($value){roomClockFrozen=$value;}},
"outFree":{get:function(){return outFree;},set:function($value){outFree=$value;}}
});
})(GameModules.imports("game3d/js/world.js"));
