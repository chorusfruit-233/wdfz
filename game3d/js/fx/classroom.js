/* @module-capsule */
(function($imports){
/* 里世界 3D · 教室里的同学、黑板预告、逃课手写字 */
'use strict';

var ANW={on:false,grp:null,room:null,t:0,segs:[],key:''};
var SEG_MAP={
  '0':'abcdef','1':'bc','2':'abged','3':'abgcd','4':'fgbc',
  '5':'afgcd','6':'afgecd','7':'abc','8':'abcdefg','9':'abcdfg'
};
function anwClear(){
  if(ANW.grp){ try{ $imports.GLR.scene.remove(ANW.grp); }catch(e){} }
  ANW.on=false; ANW.grp=null; ANW.segs=[]; ANW.t=0; ANW.key=''; ANW.room=null;
}
function anwSeg(grp,plane,cu,cv,su,sv,mk){
  var t=0.022;                       /* 笔画粗细 */
  var SX=Math.abs(plane.ux)*su+Math.abs(plane.vx)*sv+Math.abs(plane.nx)*t;
  var SY=Math.abs(plane.uy)*su+Math.abs(plane.vy)*sv+Math.abs(plane.ny)*t;
  var SZ=Math.abs(plane.uz)*su+Math.abs(plane.vz)*sv+Math.abs(plane.nz)*t;
  var px=plane.ox+plane.ux*cu+plane.vx*cv+plane.nx*t*1.4;
  var py=plane.oy+plane.uy*cu+plane.vy*cv+plane.ny*t*1.4;
  var pz=plane.oz+plane.uz*cu+plane.vz*cv+plane.nz*t*1.4;
  var m=(0,$imports.anfxBox)(grp,mk,Math.max(0.012,SX),Math.max(0.012,SY),Math.max(0.012,SZ),px,py,pz);
  m.visible=false;
  m.userData={d:ANW.segs.length*0.045};
  ANW.segs.push(m);
  return m;
}
var SEG_UV={
  a:[0.5,1.0,1.0,0.16], d:[0.5,0.0,1.0,0.16], g:[0.5,0.5,1.0,0.16],
  f:[0.0,0.75,0.16,0.42], b:[1.0,0.75,0.16,0.42],
  e:[0.0,0.25,0.16,0.42], c:[1.0,0.25,0.16,0.42]
};
function anwGlyph(grp,plane,ch,u0,v0,w,h,mk){
  var t=Math.max(0.02,h*0.085);          /* 笔画粗细 */
  if(ch===':'){
    anwSeg(grp,plane,u0+w*0.5,v0+h*0.70,t*1.5,t*1.5,mk);
    anwSeg(grp,plane,u0+w*0.5,v0+h*0.32,t*1.5,t*1.5,mk);
    return;
  }
  var codes=SEG_MAP[ch]||'', k, c, uv;
  for(k=0;k<codes.length;k++){
    c=codes.charAt(k); uv=SEG_UV[c]; if(!uv) continue;
    if(c==='a'||c==='d'||c==='g') anwSeg(grp,plane,u0+w*uv[0],v0+h*uv[1],w*0.92,t,mk);
    else anwSeg(grp,plane,u0+w*uv[0],v0+h*uv[1],t,h*0.40,mk);
  }
}
function anwSpot(R){
  if(!R) return {kind:'floor'};
  var ca=Math.cos($imports.S.ang), sa=Math.sin($imports.S.ang), nx=0, nz=0;
  if(Math.abs(ca)>=Math.abs(sa)) nx=ca>=0?1:-1; else nz=sa>=0?1:-1;
  var sx=Math.floor(($imports.S.x-R.ox)/R.tw), sy=Math.floor(($imports.S.y-R.oy)/R.th), d, cx2, cy2;
  for(d=1;d<=6;d++){
    cx2=sx+nx*d; cy2=sy+nz*d;
    if(cx2<0||cy2<0||cx2>=R.cols||cy2>=R.rows) return {kind:'floor'};
    if(R.grid[cy2][cx2]==='#') return {kind:'wall', c:cx2, r:cy2, nx:nx, nz:nz, d:d};
  }
  return {kind:'floor'};
}
function anwSpawn(){
  var p=(0,$imports.anfxW2S)($imports.S.x,$imports.S.y);
  var R=($imports.S.mode==='in')?$imports.INTERIORS[$imports.S.room]:null;
  var spot=anwSpot(R);
  var grp=new $imports.THREE.Group();
  ANW.grp=grp; ANW.on=true; ANW.t=0; ANW.segs=[]; ANW.room=$imports.S.room;
  var mk=(0,$imports.anfxMat)(0xe9eee6,0.94);          /* 粉笔白 */
  var txt=(0,$imports.fmtClock)(Math.round($imports.S.tsec+$imports.AN.next*(0,$imports.rateAt)($imports.S.tsec)/60));   /* 预告的是"钟点"（AN.next 是真实秒数） */
  ANW.text=txt;
  var plane, i, w=0.20, h=0.30, gap=0.06;
  var total=0;
  for(i=0;i<txt.length;i++) total+=(txt.charAt(i)===':')?(w*0.5+gap):(w+gap);
  if(spot.kind==='wall'){
    var nnx=-spot.nx, nnz=-spot.nz;
    var wx=R.ox+(spot.c+0.5)*R.tw+nnx*R.tw*0.5;
    var wy=R.oy+(spot.r+0.5)*R.th+nnz*R.th*0.5;
    /* 写在教室黑板上（西墙、板面范围内）：要浮在板面前面（板面离墙 8 厘米），不然被黑板挡住；整行字不超出板面 */
    var bc=$imports.ClassroomLayout.boardRow+0.5, ci=$imports.ClassroomLayout.classAt(spot.c+1,spot.r), bz=Math.abs(spot.r+0.5-bc);
    var teachBoard=(R.host==='teach'&&spot.nx===-1&&ci>=0&&spot.c+1===$imports.ClassroomLayout.spans[ci][0]&&bz<2.3);
    if(teachBoard) wy=R.oy+Math.max(bc-1.6,Math.min(bc+1.6,spot.r+0.5))*R.th;
    var sp=(0,$imports.worldToScene)(wx,wy,R);
    var deep=teachBoard?0.095:0.035;
    var baseY=teachBoard?1.55:1.42;
    var ux=0,uz=0;
    if(nnx!==0){ ux=0; uz=-nnx; } else { ux=nnz; uz=0; }
    plane={ox:sp.x+nnx*deep, oy:baseY, oz:sp.z+nnz*deep,
      ux:ux,uy:0,uz:uz, vx:0,vy:1,vz:0, nx:nnx,ny:0,nz:nnz};
    var u0=-total*0.5;
    for(i=0;i<txt.length;i++){
      var ch=txt.charAt(i);
      anwGlyph(grp,plane,ch,u0,0,w,h,mk);
      u0+=(ch===':')?(w*0.5+gap):(w+gap);
    }
  }else{
    var snap=Math.round($imports.S.ang/(Math.PI/2))*(Math.PI/2);
    var fx=Math.cos(snap), fz=Math.sin(snap);
    var bx=p.x+fx*2.0, bz=p.z+fz*2.0;
    plane={ox:bx, oy:0.014, oz:bz,
      ux:-fz, uy:0, uz:fx,          /* 右 */
      vx:fx,  vy:0, vz:fz,          /* 前 */
      nx:0, ny:1, nz:0};
    var u1=-total*0.5;
    for(i=0;i<txt.length;i++){
      var ch2=txt.charAt(i);
      anwGlyph(grp,plane,ch2,u1,0,w,h,mk);
      u1+=(ch2===':')?(w*0.5+gap):(w+gap);
    }
  }
  $imports.GLR.scene.add(grp);
}

function anwTick(dt){
  if(!(0,$imports.anwVisible)()){ if(ANW.on) anwClear(); return; }
  var key=Math.round($imports.S.tsec+$imports.AN.next*(0,$imports.rateAt)($imports.S.tsec)/60)+'|'+($imports.S.room||'out');
  if(!ANW.on||ANW.key!==key||ANW.room!==$imports.S.room){ anwClear(); ANW.key=key; anwSpawn(); }
  ANW.t+=dt;
  for(var i=0;i<ANW.segs.length;i++){
    var m=ANW.segs[i];
    if(!m.visible&&ANW.t>=(m.userData.d||0)) m.visible=true;
  }
}

var NC={grp:null,list:[],room:null,matN:null,matS:null,normal:false,t:0,said:false};
/* 仅供旧调试工具兼容；画面不再拥有占座和堵门判定。 */
Object.defineProperties(NC,{
  occ:{enumerable:true,get:function(){return $imports.Classmates.layout($imports.INTERIORS[NC.room]).occupied;}},
  blocking:{enumerable:true,get:function(){return $imports.Classmates.state.blocking;},set:function(v){$imports.Classmates.setBlocking(v);}}
});
function ncClear(){
  if(NC.grp){$imports.GLR.scene.remove(NC.grp);$imports.ThreeBackend.disposeGroup(NC.grp);}
  NC.grp=null; NC.list=[]; NC.room=null; NC.normal=false; NC.t=0;
}
/* 坐在课桌前、两只手搭在桌面上的同学。人形正面朝 +z，这里转半圈：整组正面朝 -z（朝黑板） */
function ncSeatFigure(mat,x,y,z,rotY){
  var g=new $imports.THREE.Group();
  var me=(0,$imports.figMesh)('sit',mat,1); me.rotation.y=Math.PI;
  g.add(me);
  g.position.set(x,y||0,z);
  g.rotation.y=rotY||0;
  g.userData={hx:x,hz:z,ty:rotY||0,standing:0,mesh:me};
  return g;
}
function ncBuild(R){
  ncClear();
  if(!R||R.stairwell||R.host!=='teach'||R.floor<1||R.floor>5) return;
  NC.room=R.id;
  NC.matN=new $imports.THREE.MeshBasicMaterial({color:0x39454f,fog:true});
  NC.matS=new $imports.THREE.MeshBasicMaterial({color:0x080b0d,fog:true});
  var shadow=(NC.done||(0,$imports.proSeen)());
  NC.normal=!shadow;
  NC.grp=new $imports.THREE.Group();
  $imports.GLR.scene.add(NC.grp);
  /* 同学坐在椅子上（位置和坐下时人在的地方一样，见 ClassroomLayout.chairAt），面朝西边的黑板 */
  $imports.Classmates.layout(R).seats.forEach(function(seat){
    var ch=$imports.ClassroomLayout.chairAt(seat.c,seat.r),sp=(0,$imports.worldToScene)(R.ox+(ch.x+.02)*R.tw,R.oy+ch.y*R.th,R);
    var fig=ncSeatFigure(NC.normal?NC.matN:NC.matS,sp.x,0,sp.z,$imports.PI/2);
    NC.grp.add(fig);NC.list.push(fig);
  });
  /* 自己班的老师：站在讲台和黑板之间，面朝全班（人形正面朝 +z，转 90° 朝 +x） */
  NC.teacher=null;
  if(R.id===$imports.ClassroomLayout.ownSeat.room){
    var ts=$imports.ClassroomLayout.teacherSpot($imports.ClassroomLayout.ownSeat.classId),tw=(0,$imports.worldToScene)(R.ox+ts.x*R.tw,R.oy+ts.y*R.th,R);
    var tg=new $imports.THREE.Group();
    tg.add((0,$imports.figMesh)('teacher',NC.normal?NC.matN:NC.matS,1));
    tg.position.set(tw.x,0,tw.z);
    tg.rotation.y=$imports.PI/2;
    tg.userData={hx:tw.x,hz:tw.z,ty:$imports.PI/2,standing:1,teacher:1};
    NC.grp.add(tg); NC.list.push(tg);
    NC.teacher=tg;
  }
  NC.t=0; NC.said=false;
}
function ncFlip(){
  if(!NC.list||!NC.list.length||!NC.matS) return;
  var i,k,f;
  for(i=0;i<NC.list.length;i++){
    f=NC.list[i];
    if(!f.children) continue;
    for(k=0;k<f.children.length;k++) f.children[k].material=NC.matS;
  }
  NC.normal=false; NC.done=true;
  try{ $imports.GLR.flash=Math.min(0.55,($imports.GLR.flash||0)+0.4); }catch(e){}
}
/* ncFlip 的反向：同学（和讲台边的老师）换回正常的样子。死亡档案室重看完整版开场时用——
   开场看过以后，教室一搭好同学就是里世界的样子，而完整版前三段演的是正常的第四节。不闪白，不改 NC.done */
function ncRestore(){
  if(!NC.list||!NC.list.length||!NC.matN) return false;
  var i,k,f;
  for(i=0;i<NC.list.length;i++){
    f=NC.list[i];
    if(!f.children) continue;
    for(k=0;k<f.children.length;k++) f.children[k].material=NC.matN;
  }
  NC.normal=true;
  return true;
}
function ncUpdate(dt){
  if(!NC.grp||!NC.room) return;
  if($imports.S.mode!=='in'||$imports.S.room!==NC.room){ ncClear(); return; }
  NC.t+=dt;
  var i,f,ch;
  if(NC.normal&&!$imports.PRO.on&&NC.t>20) ncFlip();
  var v=$imports.S.viol||0;
  var p=(0,$imports.anfxW2S)($imports.S.x,$imports.S.y);
  var door=$imports.Classmates.state.room===NC.room?$imports.Classmates.state.door:null;
  NC.doorP=door?(0,$imports.worldToScene)(door.x,door.y,$imports.INTERIORS[NC.room]):null;
  var staring=($imports.AN.active&&$imports.AN.id==='stare');
  for(i=0;i<NC.list.length;i++){
    f=NC.list[i];
    var ud=f.userData||{};
    if(staring&&v<70){                                   /* 全体回头：一起转过来，快 */
      var wantS=Math.atan2(f.position.x-p.x,f.position.z-p.z);   /* 模型的脸朝 -z */
      var curS=f.rotation.y||0;
      var dS=((wantS-curS+Math.PI*3)%(Math.PI*2))-Math.PI;
      f.rotation.y=curS+dS*Math.min(1,dt*6);
      /* 转过来正对着你的时候站起来：坐着扭头看人，看起来很滑稽 */
      if(ud.mesh&&!ud.stood&&Math.abs(dS)<0.35){ ud.stood=1; ud.stareStood=1; ud.mesh.geometry=(0,$imports.figGeo)('person'); }
      continue;
    }
    if(ud.stareStood&&!staring){                         /* 异象过去了，原来坐着的坐回去 */
      ud.stareStood=0;
      if(v<35&&ud.mesh){ ud.stood=0; ud.standing=0; ud.mesh.geometry=(0,$imports.figGeo)('sit'); }
    }
    if(v>=35&&v<70){
      var want=Math.atan2(ud.hx-p.x,ud.hz-p.z);
      var cur=f.rotation.y||0;
      var d=((want-cur+Math.PI*3)%(Math.PI*2))-Math.PI;
      f.rotation.y=cur+d*Math.min(1,dt*2.2);
      continue;
    }
    if(v<35){ continue; }
    var tx, tz;
    if(v>=92&&NC.doorP){
      var a2=(i/Math.max(1,NC.list.length))*6.283;
      tx=NC.doorP.x+Math.cos(a2)*0.55;
      tz=NC.doorP.z+Math.sin(a2)*0.55;
    }else{
      var a3=(i/Math.max(1,NC.list.length))*6.283+0.4;
      var rad=1.9+(i%3)*0.28;
      tx=p.x+Math.cos(a3)*rad;
      tz=p.z+Math.sin(a3)*rad;
    }
    if(ud.standing<1) ud.standing=Math.min(1,ud.standing+dt*0.8);
    if(ud.mesh&&ud.standing>0.5&&!ud.stood){ ud.stood=1; ud.mesh.geometry=(0,$imports.figGeo)('person'); }   /* 站起来：换成站姿（以前是把坐姿整体抬高 30 公分） */
    var dx=tx-f.position.x, dz=tz-f.position.z, dl=Math.hypot(dx,dz);
    if(dl>0.08){
      var sp=Math.min(dl,dt*(v>=92?1.9:1.2));
      f.position.x+=dx/dl*sp; f.position.z+=dz/dl*sp;
    }
    var wy2=Math.atan2(f.position.x-p.x,f.position.z-p.z);
    var d3=((wy2-(f.rotation.y||0)+Math.PI*3)%(Math.PI*2))-Math.PI;
    f.rotation.y=(f.rotation.y||0)+d3*Math.min(1,dt*2.5);
  }

}

var SKIP={grp:null,list:[],t:0,room:null,tex:{}};
var SKIP_TEXT=['不要逃课','回去上课','这节是数学','老师在等你','点名了','你又迟到了','回去'];
function handTex(text){
  if(SKIP.tex[text]) return SKIP.tex[text];
  try{
    var cv=document.createElement('canvas'); cv.width=680; cv.height=150;
    var c=cv.getContext('2d'); if(!c) return null;
    c.clearRect(0,0,680,150);
    c.textBaseline='middle';
    var chars=text.split(''), x=26, i;
    for(i=0;i<chars.length;i++){
      var sz=58+$imports.PresentationRandom.next()*18;
      c.save();
      c.translate(x, 76+($imports.PresentationRandom.next()-0.5)*16);
      c.rotate(($imports.PresentationRandom.next()-0.5)*0.24);
      c.font='italic '+Math.round(sz)+'px "KaiTi","STKaiti","Kaiti SC","SimSun",serif';
      c.fillStyle='rgba(233,227,213,'+(0.72+$imports.PresentationRandom.next()*0.28).toFixed(2)+')';
      c.fillText(chars[i],0,0);
      c.restore();
      x+=sz*0.96;
    }
    var t=new $imports.THREE.CanvasTexture(cv);
    if(t.colorSpace!==undefined&&$imports.THREE.SRGBColorSpace) t.colorSpace=$imports.THREE.SRGBColorSpace;
    SKIP.tex[text]=t;
    return t;
  }catch(e){ return null; }
}
function skipClear(){
  if(SKIP.grp){ try{ $imports.GLR.scene.remove(SKIP.grp); }catch(e){} }
  SKIP.grp=null; SKIP.list=[]; SKIP.t=0; SKIP.room=null;
}
function skipSpawn(){
  try{
    if(!SKIP.grp){ SKIP.grp=new $imports.THREE.Group(); $imports.GLR.scene.add(SKIP.grp); }
    var txt=SKIP_TEXT[Math.floor($imports.PresentationRandom.next()*SKIP_TEXT.length)];
    var tex=handTex(txt); if(!tex) return;
    var p=(0,$imports.anfxW2S)($imports.S.x,$imports.S.y);
    var R=($imports.S.mode==='in')?$imports.INTERIORS[$imports.S.room]:null;
    var ang=$imports.PresentationRandom.next()*6.283, rad=1.4+$imports.PresentationRandom.next()*3.3;
    var mat=new $imports.THREE.MeshBasicMaterial({map:tex,transparent:true,opacity:0.0,depthWrite:false,fog:true});
    var m=new $imports.THREE.Mesh(new $imports.THREE.PlaneGeometry(1.75,0.39),mat);
    var onWall=false;
    if(R&&$imports.PresentationRandom.next()<0.45){
      var tx=$imports.S.x+Math.cos(ang)*rad*(1/Math.max(0.001,R.tw/R.tw)), ty=$imports.S.y+Math.sin(ang)*rad;
      var ws=null;
      try{ ws=(0,$imports.wallFaceSnap)(R,$imports.S.x+Math.cos(ang)*rad, $imports.S.y+Math.sin(ang)*rad); }catch(e){}
      if(ws){
        m.position.set(ws.s.x, 1.15+$imports.PresentationRandom.next()*0.5, ws.s.z);
        if(ws.nx) m.rotation.y=ws.nx>0?Math.PI/2:-Math.PI/2;
        else m.rotation.y=ws.nz>0?0:Math.PI;
        onWall=true;
      }
    }
    if(!onWall){
      m.position.set(p.x+Math.cos(ang)*rad, 0.016+$imports.PresentationRandom.next()*0.004, p.z+Math.sin(ang)*rad);
      m.rotation.x=-Math.PI/2;
      m.rotation.z=$imports.PresentationRandom.next()*6.283;
    }
    m.userData={life:0};
    SKIP.grp.add(m); SKIP.list.push(m);
    while(SKIP.list.length>28){
      var old=SKIP.list.shift();
      try{ SKIP.grp.remove(old); }catch(e){}
    }
  }catch(e){}
}
function skipTick(dt){
  if($imports.S.screen!=='play'||$imports.S.dead){ if(SKIP.list.length) skipClear(); return; }
  var v=$imports.S.viol||0;
  if(!$imports.S.wrong||v<12){
    if(SKIP.list.length&&v<8) skipClear();
    return;
  }
  if(SKIP.room!==$imports.S.room){ skipClear(); SKIP.room=$imports.S.room; }
  var i,m;
  for(i=0;i<SKIP.list.length;i++){
    m=SKIP.list[i];
    if(m.material){ m.material.opacity=Math.min(0.92,(m.material.opacity||0)+dt*1.6); }
    m.userData.life=(m.userData.life||0)+dt;
  }
  SKIP.t-=dt;
  if(SKIP.t>0) return;
  SKIP.t=Math.max(1.0,5.6-v*0.048);
  skipSpawn();
}

function ensureMarker(){
  if($imports.GLR.marker) return $imports.GLR.marker;
  try{
    var cv=document.createElement('canvas'); cv.width=64; cv.height=64;
    var c=cv.getContext('2d'); if(!c) return null;
    c.strokeStyle='rgba(190,245,215,0.95)'; c.lineWidth=5;
    c.beginPath(); c.arc(32,32,19,0,6.2832); c.stroke();
    c.fillStyle='rgba(190,245,215,0.9)';
    c.beginPath(); c.moveTo(32,20); c.lineTo(42,32); c.lineTo(32,44); c.lineTo(22,32);
    c.closePath(); c.fill();
    var t=new $imports.THREE.CanvasTexture(cv);
    if(t&&t.colorSpace!==undefined&&$imports.THREE.SRGBColorSpace) t.colorSpace=$imports.THREE.SRGBColorSpace;
    var m=new $imports.THREE.Mesh(new $imports.THREE.PlaneGeometry(0.26,0.26),
      new $imports.THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false,depthTest:false,opacity:0.92}));
    m.renderOrder=999;
    $imports.GLR.scene.add(m);
    $imports.GLR.marker=m;
    return m;
  }catch(e){ return null; }
}

GameModules.on('frame',function(dt){
  if($imports.GamePolicy.simulationAllowed((0,$imports.gameInputContext)())&&!$imports.S.dead){ncUpdate(dt);if(!$imports.Inspection.active())skipTick(dt);}
},{owner:'fx'});

/* @module-exports */
GameModules.publish("game3d/js/fx/classroom.js",{
"ANW":{get:function(){return ANW;},set:function($value){ANW=$value;}},
"SEG_MAP":{get:function(){return SEG_MAP;},set:function($value){SEG_MAP=$value;}},
"anwClear":{get:function(){return anwClear;},set:function($value){anwClear=$value;}},
"anwSeg":{get:function(){return anwSeg;},set:function($value){anwSeg=$value;}},
"SEG_UV":{get:function(){return SEG_UV;},set:function($value){SEG_UV=$value;}},
"anwGlyph":{get:function(){return anwGlyph;},set:function($value){anwGlyph=$value;}},
"anwSpot":{get:function(){return anwSpot;},set:function($value){anwSpot=$value;}},
"anwSpawn":{get:function(){return anwSpawn;},set:function($value){anwSpawn=$value;}},
"anwTick":{get:function(){return anwTick;},set:function($value){anwTick=$value;}},
"NC":{get:function(){return NC;},set:function($value){NC=$value;}},
"ncClear":{get:function(){return ncClear;},set:function($value){ncClear=$value;}},
"ncSeatFigure":{get:function(){return ncSeatFigure;},set:function($value){ncSeatFigure=$value;}},
"ncBuild":{get:function(){return ncBuild;},set:function($value){ncBuild=$value;}},
"ncFlip":{get:function(){return ncFlip;},set:function($value){ncFlip=$value;}},
"ncRestore":{get:function(){return ncRestore;},set:function($value){ncRestore=$value;}},
"ncUpdate":{get:function(){return ncUpdate;},set:function($value){ncUpdate=$value;}},
"SKIP":{get:function(){return SKIP;},set:function($value){SKIP=$value;}},
"SKIP_TEXT":{get:function(){return SKIP_TEXT;},set:function($value){SKIP_TEXT=$value;}},
"handTex":{get:function(){return handTex;},set:function($value){handTex=$value;}},
"skipClear":{get:function(){return skipClear;},set:function($value){skipClear=$value;}},
"skipSpawn":{get:function(){return skipSpawn;},set:function($value){skipSpawn=$value;}},
"skipTick":{get:function(){return skipTick;},set:function($value){skipTick=$value;}},
"ensureMarker":{get:function(){return ensureMarker;},set:function($value){ensureMarker=$value;}}
});
})(GameModules.imports("game3d/js/fx/classroom.js"));
