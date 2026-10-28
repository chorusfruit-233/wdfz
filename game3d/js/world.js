/* 里世界 3D · 场景切换、碰撞、移动、镜头 */
'use strict';

function clearWorldMesh(){
  var i;
  function disposeGroup(g){
    if(!g) return;
    if(g.geometry&&g.geometry.dispose) g.geometry.dispose();
    if(g.material&&g.material.dispose&&!(g.material.userData&&g.material.userData.shared)) g.material.dispose();   /* 共享材质（materials.js）不能销毁 */
    if(g.children){ for(var k=0;k<g.children.length;k++) disposeGroup(g.children[k]); }
  }
  if(GLR.roamFig){ GLR.scene.remove(GLR.roamFig); GLR.roamFig=null; }
  if(typeof TR!=='undefined'&&TR.g){ try{ GLR.scene.remove(TR.g); }catch(e){} TR.g=null; TR.key=''; }
  if(GLR.roomMesh){ GLR.scene.remove(GLR.roomMesh); disposeGroup(GLR.roomMesh); GLR.roomMesh=null; }
  if(GLR.outMesh){ GLR.scene.remove(GLR.outMesh); disposeGroup(GLR.outMesh); GLR.outMesh=null; }
  if(GLR.roomLights){
    for(i=0;i<GLR.roomLights.length;i++) GLR.scene.remove(GLR.roomLights[i]);
    GLR.roomLights=[]; GLR.roomLightBase=[];
  }
}
function addRoomLights(R){
  var W=R.cols*TTILE*U2M, H=R.rows*TTILE*U2M, i;
  function addLight(x,y,z,col,inten,dist,decay){
    var pl=new THREE.PointLight(col,inten,dist,decay);
    pl.position.set(x,y,z);
    GLR.scene.add(pl);
    GLR.roomLights.push(pl);
    GLR.roomLightBase.push(inten);
  }
  if(R.host==='teach'&&R.floor>=1&&R.floor<=5){
    var spans2=[[5,11],[21,27],[45,51]];
    for(i=0;i<spans2.length;i++){
      var cxm=((spans2[i][0]+spans2[i][1])/2+0.5)*TTILE*U2M - W*0.5;
      addLight(cxm, 2.75, (7.5)*TTILE*U2M - H*0.5, 0xffe9c8, LCFG.ptI*1.55, 16, 2.0);
    }
    addLight(0, 2.75, (18.5)*TTILE*U2M - H*0.5, 0xf2dcc0, LCFG.ptI*1.2, 18, 2.0);
    return;
  }
  if(R.id==='lab3'){
    /* 学生机房是冷白的日光灯；隔壁上锁的网络中心只有机柜的红光 */
    addLight(-16, 2.70, -2.0, 0xc8dce8, LCFG.ptI*1.3, 18, 2.0);
    addLight( -3, 2.70, -2.0, 0xc8dce8, LCFG.ptI*1.1, 18, 2.0);
    addLight( 17, 2.60, -2.5, 0x8a2418, LCFG.ptI*1.6, 16, 2.0);
    addLight(0, 2.60, H*0.40, 0xc07a4a, LCFG.ptI*0.8, 14, 2.0);
    return;
  }
  if(R.host==='bell'){                                            /* 底下只有蜡烛；楼顶从钟口漏下一点天光 */
    addLight(0,2.4,2.5,0xffa860,LCFG.ptI*0.9,12,2.0);
    if(R.spiral){ addLight(SPIRAL.cx,SPIRAL.topH/2,SPIRAL.cz+2.0,0xd8b080,LCFG.ptI*0.5,9,2.0); addLight(SPIRAL.cx,SPIRAL.topH+2.6,SPIRAL.cz,0xc8d0d8,LCFG.ptI*0.8,10,2.0); }
    return;
  }
  if(R.host==='trash'){ addLight(0,2.6,0,0xb8d0a8,LCFG.ptI*0.7,10,2.0); return; }
  var n=2;
  for(i=0;i<n;i++){
    var lx=(i/(n-1||1)-0.5)*W*0.66;
    var lz=(i%2?0.28:-0.24)*H;
    addLight(lx, 2.75, lz, i%2?0xffe9c8:0xf2dcc0, LCFG.ptI*1.7, 16, 2.0);
  }
}
function enterWorldRoom(roomId){
  clearWorldMesh();
  var R=INTERIORS[roomId];
  GLR.roomMesh=buildRoomGeometry(R);
  GLR.scene.add(GLR.roomMesh);
  if(roomId==='garage1'){
    GLR.roamFig=buildRoamFigure();
    if(GLR.roamFig){ GLR.roamFig.visible=false; GLR.scene.add(GLR.roamFig); }
  }
  var dens=roomId==='garage1'?0.082:0.050;
  GLR.scene.fog=new THREE.FogExp2(FOG_COL,dens);
  addRoomLights(R);
  try{ tracesBuild(); }catch(e){}
  try{ ncBuild(R); }catch(e){}
  try{ skipClear(); }catch(e){}
}
function enterWorldOut(){
  clearWorldMesh();
  try{ ncClear(); }catch(e){}      /* 出去就没有同班同学了 */
  GLR.outMesh=buildOutdoorGeometry();
  GLR.outMesh.userData=GLR.outMesh.userData||{};
  GLR.outMesh.userData.__outworld=1;
  GLR.scene.add(GLR.outMesh);
  GLR.scene.fog=new THREE.FogExp2(FOG_COL,0.020);
  GLR.skyHour=-1; refreshSky();
  GLR.lampPick=0;
  try{ tracesBuild(); }catch(e){}
}

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
  if(solidAt(wx,wy)) return false;
  if(!solidAt(wx+PRAD,wy)) { if(!solidAt(wx-PRAD,wy)) { if(!solidAt(wx,wy+PRAD)) { if(!solidAt(wx,wy-PRAD)) return true; } } }
  return false;
}
function moveBy(dx,dy){
  var stuck=!canStand(S.x,S.y);
  var nx=S.x+dx, ny=S.y+dy;
  if(stuck||canStand(nx,S.y)) S.x=nx;
  if(stuck||canStand(S.x,ny)) S.y=ny;
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
function enterRoom(id,spawn){ fadeTo(function(){ doEnterRoom(id,spawn); }); }
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
    if(S.mode!=='in') return;
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
  var via=ENTER_VIA; ENTER_VIA=null;
  enterWorldRoom(id);
  if(!spawn){
    var en=null;
    try{ en=entryNear(R, via==='stair'?['S']:['O']); if(!en) en=entryNear(R,['O','S','L']); }catch(e){}
    if(en){ S.x=en.x; S.y=en.y; S.ang=en.ang; }
  }
  try{ unstick(); }catch(e){}
  GLR.hurt=0;
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

function syncCamera(dt){
  var p;
  if(S.mode==='in'){
    var R=INTERIORS[S.room];
    p=worldToScene(S.x,S.y,R);
  }else{
    p=worldToScene(S.x,S.y,null);
  }
  var bob=0;
  if(S.moving&&!S.seated){
    S.walkPhase+=dt*(S.run?13.5:8.5);
    bob=Math.sin(S.walkPhase)*(S.run?0.052:0.030);
  }
  var dyOff=0, dzOff=0, shake=0;
  if(S.dead){
    var k=S.deadT||0;
    if(S.death==='floor'||S.death==='deep'){ dyOff=-Math.min(1.25,k*0.62); }
    shake=Math.max(0,1-k*0.5);
  }
  if(GLR.gazeShake&&!S.dead) shake=Math.max(shake,GLR.gazeShake);   /* 被盯着的时候，镜头在抖 */
  if(typeof SHAKE_ON!=='undefined' && !SHAKE_ON) shake=0;
  if(shake>0){
    dyOff+=(Math.random()-0.5)*0.06*shake;
  }
  if(typeof SHAKE_ON!=='undefined' && !SHAKE_ON){ bob=0; }
  var eyeTarget=S.seated?1.12:EYE;
  S.eyeH=(S.eyeH===undefined)?EYE:S.eyeH;
  S.eyeH+= (eyeTarget-S.eyeH)*Math.min(1,dt*9);
  GLR.cam.position.set(p.x, S.eyeH+bob+dyOff+(S.eyeLift||0)+(S.floorY||0), p.z+dzOff);   /* floorY：钟楼楼梯上的高度 */
  var targetFov=72+(S.run&&S.moving?9:0);
  S.fov=lerp(S.fov,targetFov,Math.min(1,dt*8));
  if(Math.abs(GLR.cam.fov-S.fov)>0.01){ GLR.cam.fov=S.fov; GLR.cam.updateProjectionMatrix(); }
  var spitch=S.pitch+(S.seated?-0.06:0);
  var dir=new THREE.Vector3(Math.cos(S.ang)*Math.cos(spitch),Math.sin(spitch),Math.sin(S.ang)*Math.cos(spitch));
  GLR.cam.lookAt(p.x+dir.x, S.eyeH+bob+dir.y+(S.floorY||0), p.z+dir.z);
}
