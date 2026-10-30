/* 里世界 3D · 场景切换、碰撞、移动、镜头 */
'use strict';

function clearWorldMesh(){ return Engine.clearWorld(); }
function addRoomLights(R){ return Engine.addRoomLights(R); }
function enterWorldRoom(roomId){ return Engine.enterRoom(roomId); }
function enterWorldOut(){ return Engine.enterOutside(); }

function worldToScene(wx,wy,roomR){
  if(roomR){
    var tw=TTILE*U2M, th=TTILE*U2M;
    return { x:(wx-roomR.ox)*U2M-roomR.cols*tw*0.5, z:(wy-roomR.oy)*U2M-roomR.rows*th*0.5 };
  }
  return { x:wx*U2M, z:wy*U2M };
}

function teachFrontZ(){
  var t=null,i;
  for(i=0;i<OBJ.length;i++) if(OBJ[i].id==='teach'){ t=OBJ[i]; break; }
  if(!t) return (GATE_N.y*SC)*U2M;
  return ((t.y+t.h)*SC)*U2M;
}


function buildRoomBounds(){
  for(var id in INTERIORS){
    var R=INTERIORS[id];
    var o=objById(R.host);
    R.w=R.cols*R.tw; R.h=R.rows*R.th;
    if(o){
      var hc={x:o.x*SC+o.w*SC/2, y:o.y*SC+o.h*SC/2};
      R.ox=hc.x-R.w/2; R.oy=hc.y-R.h/2;
    }else{ R.ox=0; R.oy=0; }
    R.cx=R.ox+R.w/2; R.cy=R.oy+R.h/2;
  }
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
  var t=tileAt(R,wx,wy);
  if(t==='='){
    if(typeof NC!=='undefined'&&NC&&NC.blocking&&NC.room===R.id) return true;   /* 他们堵在门口 */
    return !doorIsOpen(R,wx,wy);
  }
  if(isSolidCh(t)) return true;
  /* stairExtra / propExtra 是米；这里以前直接拿世界单位去比（差 9 倍），楼梯井的挡墙等于没有 */
  var lx=(wx-R.ox-R.w*0.5)*U2M, lz=(wy-R.oy-R.h*0.5)*U2M, si, sb;
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
  if(R.spiral&&typeof spiralSolid==='function'&&spiralSolid(R,wx,wy)) return true;
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
  var mx=wx/SC, my=wy/SC, i;
  if(mx<BOUND.x0+4||my<BOUND.y0+4||mx>BOUND.x1-4||my>BOUND.y1-4) return true;
  for(i=0;i<OBJ.length;i++){
    var o=OBJ[i];
    if(o.k!=='roof') continue;
    if(mx>o.x&&mx<o.x+o.w&&my>o.y&&my<o.y+o.h) return true;
  }
  for(i=0;i<OUT_SOLID.length;i++){
    var q=OUT_SOLID[i];
    if(mx>q.x0&&mx<q.x1&&my>q.y0&&my<q.y1) return true;
  }
  return false;
}
var PRAD=3.0;      /* 世界单位的玩家半径 */
function solidAt(wx,wy){
  if(S.mode==='in'){
    var R=INTERIORS[S.room]; if(!R) return true;
    return solidAtInterior(R,wx,wy);
  }
  return solidAtOutdoor(wx,wy);
}
function canStand(wx,wy){
  return Collision.depth(wx,wy,PRAD)<1e-7;
}
function moveBy(dx,dy,dt){
  if(!Number.isFinite(dx)||!Number.isFinite(dy))return;
  var n=Math.max(1,Math.ceil((dt||1/60)*Physics.hz),Math.ceil(Math.hypot(dx,dy)/(PRAD*0.5)));
  dx/=n;dy/=n;
  for(var i=0;i<n;i++){
    var before=Collision.depth(S.x,S.y,PRAD),nx=S.x+dx,ny=S.y+dy;
    var ax=Collision.depth(nx,S.y,PRAD);
    if(ax<1e-7||ax<before-1e-7){S.x=nx;before=ax;}
    var ay=Collision.depth(S.x,ny,PRAD);
    if(ay<1e-7||ay<before-1e-7)S.y=ny;
    spiralUpdate();
  }
}

function doorWorld(o){
  var f=o.door||'s';
  if(f==='w') return { x:o.x*SC-26, y:(o.y+o.h/2)*SC };
  if(f==='e') return { x:(o.x+o.w)*SC+26, y:(o.y+o.h/2)*SC };
  if(f==='n') return { x:o.x*SC+o.w*SC/2, y:o.y*SC-26 };
  return { x:o.x*SC+o.w*SC/2, y:(o.y+o.h)*SC+26 };
}
function showBanner(txt){
  var el=document.getElementById('banner');
  if(!el) return;
  el.textContent=txt; el.style.opacity='1';
  clearTimeout(el._t);
  el._t=setTimeout(function(){ el.style.opacity='0'; },1800);
}
function fadeTo(fn){
  var f=document.getElementById('fade');
  if(!f){ fn(); return; }
  f.style.transition='opacity .16s ease'; f.style.opacity='1';
  setTimeout(function(){
    try{ fn(); }catch(e){ try{ console.error(e); }catch(_e){} }
    f.style.transition='opacity .30s ease'; f.style.opacity='0';
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
function unstick(){
  try{
    if(S.mode!=='in'||S.seated||HIDE.on) return;
    var R=INTERIORS[S.room]; if(!R) return;
    if(!solidAt(S.x,S.y)) return;
    var c=Math.floor((S.x-R.ox)/R.tw), r=Math.floor((S.y-R.oy)/R.th), rad, dr, dc;
    for(rad=1; rad<=12; rad++){
      for(dr=-rad; dr<=rad; dr++){
        for(dc=-rad; dc<=rad; dc++){
          if(Math.abs(dr)!==rad && Math.abs(dc)!==rad) continue;
          var rr=r+dr, cc=c+dc;
          if(rr<0||cc<0||rr>=R.rows||cc>=R.cols) continue;
          var wx=R.ox+(cc+0.5)*R.tw, wy=R.oy+(rr+0.5)*R.th;
          if(!solidAt(wx,wy)){ S.x=wx; S.y=wy; return; }
        }
      }
    }
  }catch(e){}
}
function doEnterRoom(id,spawn){
  try{ anfxClear(); }catch(e){}
  try{ spiralReset(); }catch(e){}
  var R=INTERIORS[id]; if(!R) return;
  S.mode='in'; S.room=id;
  if(spawn){                                  /* 显式指定落点（开局坐座位） */
    S.x=spawn.x; S.y=spawn.y; if(spawn.ang!==undefined) S.ang=spawn.ang;
    S.enterCool=0.9;
  }else if(id==='garage1'){
    S.x=R.ox+R.w-5*R.tw; S.y=R.oy+13*R.th;
    ROAM.on=false; ROAM.litAcc=0; S.ang=-PI/2;
    S.enterCool=1.4;
  }else{
    S.x=R.ox+R.w/2; S.y=R.oy+R.h-2*R.th;
    S.enterCool=0.9;
  }
  if(!(spawn&&spawn.seated)) S.seated=false;
  else S.seated=true;
  if(R.spiral&&spawn&&spawn.spiral) spiralRestore(spawn.spiral);
  var via=ENTER_VIA; ENTER_VIA=null;
  enterWorldRoom(id);
  if(!spawn){
    var en=null;
    try{ en=entryNear(R, via==='stair'?['S']:['O']); if(!en) en=entryNear(R,['O','S','L']); }catch(e){}
    if(en){ S.x=en.x; S.y=en.y; S.ang=en.ang; }
  }
  try{ unstick(); }catch(e){}
  VisualState.hurt=0;
  showBanner(INTERIORS[id].name);
  onEnterRoom(id);
  autoSave();
}
function exitRoom(){ fadeTo(function(){ doExitRoom(); }); }
function doExitRoom(){
  try{ anfxClear(); }catch(e){}
  var R=INTERIORS[S.room]; if(!R) return;
  var o=objById(R.host);
  S.mode='out'; S.room=null; S.seated=false;
  try{ spiralReset(); }catch(e){}
  showBanner('武大附中 · 校园');
  if(o){ var d=doorWorld(o); S.x=d.x; S.y=d.y; }
  S.enterCool=1.0;
  enterWorldOut();
  autoSave();
}

function syncCamera(dt,view){ return Engine.syncCamera(dt,view); }
