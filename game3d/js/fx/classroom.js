/* 里世界 3D · 教室里的同学、黑板预告、逃课手写字 */
'use strict';

var ANW={on:false,grp:null,room:null,t:0,segs:[],key:''};
var SEG_MAP={
  '0':'abcdef','1':'bc','2':'abged','3':'abgcd','4':'fgbc',
  '5':'afgcd','6':'afgecd','7':'abc','8':'abcdefg','9':'abcdfg'
};
function anwClear(){
  if(ANW.grp){ try{ GLR.scene.remove(ANW.grp); }catch(e){} }
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
  var m=anfxBox(grp,mk,Math.max(0.012,SX),Math.max(0.012,SY),Math.max(0.012,SZ),px,py,pz);
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
  var ca=Math.cos(S.ang), sa=Math.sin(S.ang), nx=0, nz=0;
  if(Math.abs(ca)>=Math.abs(sa)) nx=ca>=0?1:-1; else nz=sa>=0?1:-1;
  var sx=Math.floor((S.x-R.ox)/R.tw), sy=Math.floor((S.y-R.oy)/R.th), d, cx2, cy2;
  for(d=1;d<=6;d++){
    cx2=sx+nx*d; cy2=sy+nz*d;
    if(cx2<0||cy2<0||cx2>=R.cols||cy2>=R.rows) return {kind:'floor'};
    if(R.grid[cy2][cx2]==='#') return {kind:'wall', c:cx2, r:cy2, nx:nx, nz:nz, d:d};
  }
  return {kind:'floor'};
}
function anwSpawn(){
  var p=anfxW2S(S.x,S.y);
  var R=(S.mode==='in')?INTERIORS[S.room]:null;
  var spot=anwSpot(R);
  var grp=new THREE.Group();
  ANW.grp=grp; ANW.on=true; ANW.t=0; ANW.segs=[]; ANW.room=S.room;
  var mk=anfxMat(0xe9eee6,0.94);          /* 粉笔白 */
  var txt=fmtClock(Math.round(S.tsec+AN.next*rateAt(S.tsec)/60));   /* 预告的是"钟点"（AN.next 是真实秒数） */
  ANW.text=txt;
  var plane, i, w=0.20, h=0.30, gap=0.06;
  var total=0;
  for(i=0;i<txt.length;i++) total+=(txt.charAt(i)===':')?(w*0.5+gap):(w+gap);
  if(spot.kind==='wall'){
    var nnx=-spot.nx, nnz=-spot.nz;
    var wx=R.ox+(spot.c+0.5)*R.tw+nnx*R.tw*0.5;
    var wy=R.oy+(spot.r+0.5)*R.th+nnz*R.th*0.5;
    var sp=worldToScene(wx,wy,R);
    var teachBoard=(R.host==='teach'&&spot.r===0);
    var deep=teachBoard?0.20:0.035;
    var baseY=teachBoard?1.52:1.42;
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
    var snap=Math.round(S.ang/(Math.PI/2))*(Math.PI/2);
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
  GLR.scene.add(grp);
  if(S.diff==='easy'&&AN.pre&&!RT.preTold){
    RT.preTold=1;
    os('我：这个时间……我梦见过。',3.4);
  }
}
function anwTick(dt){
  var show=(S.screen==='play'&&!S.dead&&!PAUSE.on&&!AN.active&&AN.next>0&&AN.next<=8&&!UI.anyOpen());
  if(!show){ if(ANW.on) anwClear(); return; }
  var key=Math.round(S.tsec+AN.next*rateAt(S.tsec)/60)+'|'+(S.room||'out');
  if(!ANW.on||ANW.key!==key||ANW.room!==S.room){ anwClear(); ANW.key=key; anwSpawn(); }
  ANW.t+=dt;
  for(var i=0;i<ANW.segs.length;i++){
    var m=ANW.segs[i];
    if(!m.visible&&ANW.t>=(m.userData.d||0)) m.visible=true;
  }
}

var NC={grp:null,list:[],occ:{},room:null,blocking:false,matN:null,matS:null,normal:false,t:0,said:false};
function ncClear(){
  if(NC.grp){ try{ GLR.scene.remove(NC.grp); }catch(e){} }
  NC.grp=null; NC.list=[]; NC.occ={}; NC.room=null; NC.blocking=false; NC.normal=false; NC.t=0;
}
function ncOccupied(c,r){
  if(!NC.occ) return false;
  return !!NC.occ[c+','+r];
}
/* 坐在课桌前、两只手搭在桌面上的同学。人形正面朝 +z，这里转半圈：整组正面朝 -z（朝黑板） */
function ncSeatFigure(mat,x,y,z,rotY){
  var g=new THREE.Group();
  var me=figMesh('sit',mat,1); me.rotation.y=Math.PI;
  g.add(me);
  g.position.set(x,y||0,z);
  g.rotation.y=rotY||0;
  g.userData={hx:x,hz:z,ty:rotY||0,standing:0,mesh:me};
  return g;
}
function ncBuild(R){
  ncClear();
  if(!R||R.host!=='teach'||R.floor<1||R.floor>5) return;
  NC.room=R.id;
  NC.matN=new THREE.MeshBasicMaterial({color:0x39454f,fog:true});
  NC.matS=new THREE.MeshBasicMaterial({color:0x080b0d,fog:true});
  var shadow=(NC.done||proSeen());
  NC.normal=!shadow;
  NC.grp=new THREE.Group();
  GLR.scene.add(NC.grp);
  var c, r2, ch;
  var seeded=0;
  for(r2=1;r2<R.rows-1&&seeded<34;r2++){
    for(c=1;c<R.cols-1&&seeded<34;c++){
      ch=R.grid[r2][c];
      if(ch!=='d') continue;
      if(R.id==='teach1'&&Math.abs(c-48)<=1&&Math.abs(r2-6)<=1) continue;
      if(Math.random()<0.42) continue;
      var wx=R.ox+(c+0.5)*R.tw, wy=R.oy+(r2+0.5+0.32)*R.th;
      var sp=worldToScene(wx,wy,R);
      var fig=ncSeatFigure(NC.normal?NC.matN:NC.matS, sp.x, 0, sp.z, 0);
      NC.grp.add(fig);
      NC.list.push(fig);
      NC.occ[c+','+r2]=1;
      seeded++;
    }
  }
  var tc=null,tr=null,cc,rr;
  for(rr=1;rr<R.rows&&!tc;rr++) for(cc=1;cc<R.cols&&!tc;cc++) if(R.grid[rr][cc]==='T'){ tc=cc; tr=rr; }
  if(tc!==null){
    var tw=worldToScene(R.ox+(tc+0.5)*R.tw, R.oy+(tr+1.6)*R.th, R);
    var tg=new THREE.Group();
    tg.add(figMesh('teacher',NC.matN,1));                         /* 讲台边的老师，面朝全班（+z） */
    tg.position.set(tw.x,0,tw.z);
    tg.rotation.y=0;
    tg.userData={hx:tw.x,hz:tw.z,ty:0,standing:1};
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
  try{ GLR.flash=Math.min(0.55,(GLR.flash||0)+0.4); }catch(e){}
}
function ncUpdate(dt){
  if(!NC.grp||!NC.room) return;
  if(S.mode!=='in'||S.room!==NC.room){ ncClear(); return; }
  NC.t+=dt;
  var i,f,ch;
  if(NC.normal&&!PRO.on&&NC.t>20) ncFlip();
  var v=S.viol||0;
  var p=anfxW2S(S.x,S.y);
  var doorP=null;
  if(v>=92&&!NC.doorP){
    var R=INTERIORS[S.room];
    var best=null,bd=1e9,cc2,rr2;
    if(R) for(rr2=1;rr2<R.rows-1;rr2++) for(cc2=1;cc2<R.cols-1;cc2++){
      if(R.grid[rr2][cc2]!=='=') continue;
      var d2=Math.abs(cc2*R.tw+R.ox-S.x)+Math.abs(rr2*R.th+R.oy-S.y);
      if(d2<bd){ bd=d2; best=[cc2,rr2]; }
    }
    if(best) NC.doorP=worldToScene(INTERIORS[S.room].ox+(best[0]+0.5)*INTERIORS[S.room].tw,
                                   INTERIORS[S.room].oy+(best[1]+0.5)*INTERIORS[S.room].th, INTERIORS[S.room]);
  }
  if(v<80) NC.doorP=null;
  NC.blocking=(v>=92&&!!NC.doorP);
  var staring=(AN.active&&AN.id==='stare');
  for(i=0;i<NC.list.length;i++){
    f=NC.list[i];
    var ud=f.userData||{};
    if(staring&&v<70){                                   /* 全体回头：一起转过来，快 */
      var wantS=Math.atan2(f.position.x-p.x,f.position.z-p.z);   /* 模型的脸朝 -z */
      var curS=f.rotation.y||0;
      var dS=((wantS-curS+Math.PI*3)%(Math.PI*2))-Math.PI;
      f.rotation.y=curS+dS*Math.min(1,dt*6);
      /* 转过来正对着你的时候站起来：坐着扭头看人，看起来很滑稽 */
      if(ud.mesh&&!ud.stood&&Math.abs(dS)<0.35){ ud.stood=1; ud.stareStood=1; ud.mesh.geometry=figGeo('person'); }
      continue;
    }
    if(ud.stareStood&&!staring){                         /* 异象过去了，原来坐着的坐回去 */
      ud.stareStood=0;
      if(v<35&&ud.mesh){ ud.stood=0; ud.standing=0; ud.mesh.geometry=figGeo('sit'); }
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
    if(ud.mesh&&ud.standing>0.5&&!ud.stood){ ud.stood=1; ud.mesh.geometry=figGeo('person'); }   /* 站起来：换成站姿（以前是把坐姿整体抬高 30 公分） */
    var dx=tx-f.position.x, dz=tz-f.position.z, dl=Math.hypot(dx,dz);
    if(dl>0.08){
      var sp=Math.min(dl,dt*(v>=92?1.9:1.2));
      f.position.x+=dx/dl*sp; f.position.z+=dz/dl*sp;
    }
    var wy2=Math.atan2(f.position.x-p.x,f.position.z-p.z);
    var d3=((wy2-(f.rotation.y||0)+Math.PI*3)%(Math.PI*2))-Math.PI;
    f.rotation.y=(f.rotation.y||0)+d3*Math.min(1,dt*2.5);
  }
  if(v>=70&&!S.dead){
    S.san=Math.max(1,S.san-dt*0.12);
    if(!NC.said){ NC.said=true; os('我：他们都在看着我。可是没有人说话。',4.2); }
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
      var sz=58+Math.random()*18;
      c.save();
      c.translate(x, 76+(Math.random()-0.5)*16);
      c.rotate((Math.random()-0.5)*0.24);
      c.font='italic '+Math.round(sz)+'px "KaiTi","STKaiti","Kaiti SC","SimSun",serif';
      c.fillStyle='rgba(233,227,213,'+(0.72+Math.random()*0.28).toFixed(2)+')';
      c.fillText(chars[i],0,0);
      c.restore();
      x+=sz*0.96;
    }
    var t=new THREE.CanvasTexture(cv);
    if(t.colorSpace!==undefined&&THREE.SRGBColorSpace) t.colorSpace=THREE.SRGBColorSpace;
    SKIP.tex[text]=t;
    return t;
  }catch(e){ return null; }
}
function skipClear(){
  if(SKIP.grp){ try{ GLR.scene.remove(SKIP.grp); }catch(e){} }
  SKIP.grp=null; SKIP.list=[]; SKIP.t=0; SKIP.room=null;
}
function skipSpawn(){
  try{
    if(!SKIP.grp){ SKIP.grp=new THREE.Group(); GLR.scene.add(SKIP.grp); }
    var txt=SKIP_TEXT[Math.floor(Math.random()*SKIP_TEXT.length)];
    var tex=handTex(txt); if(!tex) return;
    var p=anfxW2S(S.x,S.y);
    var R=(S.mode==='in')?INTERIORS[S.room]:null;
    var ang=Math.random()*6.283, rad=1.4+Math.random()*3.3;
    var mat=new THREE.MeshBasicMaterial({map:tex,transparent:true,opacity:0.0,depthWrite:false,fog:true});
    var m=new THREE.Mesh(new THREE.PlaneGeometry(1.75,0.39),mat);
    var onWall=false;
    if(R&&Math.random()<0.45){
      var tx=S.x+Math.cos(ang)*rad*(1/Math.max(0.001,R.tw/R.tw)), ty=S.y+Math.sin(ang)*rad;
      var ws=null;
      try{ ws=wallFaceSnap(R,S.x+Math.cos(ang)*rad, S.y+Math.sin(ang)*rad); }catch(e){}
      if(ws){
        m.position.set(ws.s.x, 1.15+Math.random()*0.5, ws.s.z);
        if(ws.nx) m.rotation.y=ws.nx>0?Math.PI/2:-Math.PI/2;
        else m.rotation.y=ws.nz>0?0:Math.PI;
        onWall=true;
      }
    }
    if(!onWall){
      m.position.set(p.x+Math.cos(ang)*rad, 0.016+Math.random()*0.004, p.z+Math.sin(ang)*rad);
      m.rotation.x=-Math.PI/2;
      m.rotation.z=Math.random()*6.283;
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
  if(S.screen!=='play'||S.dead){ if(SKIP.list.length) skipClear(); return; }
  var v=S.viol||0;
  if(!S.wrong||v<12){
    if(SKIP.list.length&&v<8) skipClear();
    return;
  }
  if(SKIP.room!==S.room){ skipClear(); SKIP.room=S.room; }
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
  if(GLR.marker) return GLR.marker;
  try{
    var cv=document.createElement('canvas'); cv.width=64; cv.height=64;
    var c=cv.getContext('2d'); if(!c) return null;
    c.strokeStyle='rgba(190,245,215,0.95)'; c.lineWidth=5;
    c.beginPath(); c.arc(32,32,19,0,6.2832); c.stroke();
    c.fillStyle='rgba(190,245,215,0.9)';
    c.beginPath(); c.moveTo(32,20); c.lineTo(42,32); c.lineTo(32,44); c.lineTo(22,32);
    c.closePath(); c.fill();
    var t=new THREE.CanvasTexture(cv);
    if(t&&t.colorSpace!==undefined&&THREE.SRGBColorSpace) t.colorSpace=THREE.SRGBColorSpace;
    var m=new THREE.Mesh(new THREE.PlaneGeometry(0.26,0.26),
      new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false,depthTest:false,opacity:0.92}));
    m.renderOrder=999;
    GLR.scene.add(m);
    GLR.marker=m;
    return m;
  }catch(e){ return null; }
}
