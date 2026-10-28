/* 纯表现：异象精灵、路人、巡察者和交互标记。 */
'use strict';
var ENTS=[];
function entAdd(color,w,h,x,y,z){
  var geo=new THREE.PlaneGeometry(w,h);
  var mat=new THREE.MeshBasicMaterial({color:color,transparent:true,opacity:0.85,side:THREE.DoubleSide,depthWrite:false});
  var m=new THREE.Mesh(geo,mat);
  m.position.set(x,y,z);
  GLR.scene.add(m);
  ENTS.push(m);
  return m;
}
function entClear(){
  for(var i=0;i<ENTS.length;i++){ GLR.scene.remove(ENTS[i]); ENTS[i].geometry.dispose(); ENTS[i].material.dispose(); }
  ENTS=[];
}
function entFace(){
  for(var i=0;i<ENTS.length;i++){
    ENTS[i].quaternion.copy(GLR.cam.quaternion);
  }
}


var FN_P={grp:null,room:null,mat:null};
function fnPeopleClear(){
  if(FN_P.grp){GLR.scene.remove(FN_P.grp);ThreeBackend.disposeGroup(FN_P.grp);}
  FN_P.grp=null; FN_P.room=null;
}
function fnPeopleBuild(){
  fnPeopleClear();
  if(S.mode!=='in'||!S.room) return;
  var R=INTERIORS[S.room]; if(!R) return;
  if(!FN_P.mat){FN_P.mat=new THREE.MeshBasicMaterial({color:0x41505c,fog:true});FN_P.mat.userData.shared=true;}
  var g=new THREE.Group();
  GLR.scene.add(g); FN_P.grp=g; FN_P.room=S.room;
  var p=anfxW2S(S.x,S.y), made=0, c,r2,tries=0;
  while(made<4&&tries++<160){
    c=1+Math.floor(Math.random()*(R.cols-2));
    r2=1+Math.floor(Math.random()*(R.rows-2));
    var ch=R.grid[r2][c];
    if(ch==='#'||ch==='='||ch==='O'||ch==='S'||ch==='L') continue;
    var w=worldToScene(R.ox+(c+0.5)*R.tw,R.oy+(r2+0.5)*R.th,R);
    var d=Math.hypot(w.x-p.x,w.z-p.z);
    if(d<2.2||d>7.5) continue;
    var fg=new THREE.Group();
    fg.add(figMesh('person',FN_P.mat,1));
    fg.position.set(w.x,0,w.z);
    fg.rotation.y=Math.atan2(p.x-w.x,p.z-w.z);                 /* 正面（+z）朝着你 */
    g.add(fg);
    made++;
  }
}
function fnPeopleTick(){
  var on=(S.fn&&S.fn.on&&S.fn.v<72);
  if(!on){ if(FN_P.grp) fnPeopleClear(); return; }
  if(FN_P.room!==S.room) fnPeopleBuild();
}

var PAT_GEAR={};
function patGearGeo(){
  var key=Quality.get().segments;
  if(PAT_GEAR[key]) return PAT_GEAR[key];
  var K=new Kit(), m='dark', coat=0x1c2026, sp=FIG_SPEC.teacher, t=sp.thin;
  var hipY=sp.leg, sh=hipY+sp.torso, hx=sp.w/2, hy=sh+sp.neck+sp.head*0.5, s;
  K.bevel(m,0,(sh+hipY)/2,0,0.36,sh-hipY,0.25,coat,1,0.06);                 /* 大衣上身 */
  K.bevel(m,0,(hipY+0.50)/2,0,0.37,hipY-0.50,0.27,coat,1,0.05);              /* 下摆到膝下 */
  K.bevel(m,0,(hipY+0.50)/2-0.12,0,0.40,0.62,0.29,coat,1,0.05);              /* 往下张开一点 */
  K.box(m,0,0.95,0.146,0.012,0.88,0.01,0x050607,1);                          /* 前襟开衩 */
  for(s=0;s<5;s++) K.box('metal',0.04,1.45+s*0.14,0.128,0.025,0.025,0.012,0x8a7a50,1);   /* 一排扣子 */
  K.cyl(m,0,sh-0.06,0,0.12,0.085,0.14,10,coat,1,false);                      /* 立领 */
  for(s=-1;s<=1;s+=2) K.blob(m,s*hx*0.86,sh-0.02,0,0.1,0.07,0.1,coat,1,6);   /* 垫肩 */
  K.box(m,0,hipY+0.10,0,0.385,0.05,0.265,0x050607,1);           /* 腰带 */
  /* 大檐帽 */
  K.cyl(m,0,hy+0.06,0.0,0.135,0.14,0.07,12,0x0a0c0f,1);
  K.cyl(m,0,hy+0.13,0.01,0.14,0.165,0.035,12,0x0d1014,1);
  K.bevel(m,0,hy+0.07,0.14,0.22,0.018,0.13,0x050607,1,0.006);               /* 帽檐 */
  K.box('metal',0,hy+0.10,0.143,0.05,0.03,0.008,0x5a4a1e,1);                 /* 帽徽，旧得发乌 */
  /* 左臂红袖章 */
  var ax=-hx*0.95, up=sp.arm*0.47, y0=sh-0.05-up*0.25, y1=sh-0.05-up*0.55;
  K.rod(m,ax-0.005,y0,0.004,ax-0.012,y1,0.008,0.062*t,0.06*t,10,0x7a120c,1);
  K.box('paper',ax-0.062,(y0+y1)/2,0.01,0.004,0.045,0.035,0xb8a070,1);       /* 袖章上的字 */
  /* 右手夹板 */
  var hxr=hx*0.95+0.04, hyr=sh-0.05-sp.arm-0.05;
  K.bevel(m,hxr+0.05,hyr+0.14,0.06,0.018,0.34,0.25,0x2a2118,1,0.006);
  K.box('paper',hxr+0.06,hyr+0.12,0.06,0.004,0.28,0.21,0x77736a,1);
  K.box('metal',hxr+0.062,hyr+0.29,0.06,0.012,0.03,0.09,0x50565a,1);       /* 夹子 */
  PAT_GEAR[key]=K.mergedGeometry();
  PAT_GEAR[key].userData={shared:true,patGear:true};
  return PAT_GEAR[key];
}
function patAddFig(){
  patRemoveFig();
  try{
    var g=new THREE.Group();
    var body=figMesh('teacher',new THREE.MeshBasicMaterial({color:0x040506,fog:true}),1.12);
    g.add(body);
    var gear=new THREE.Mesh(patGearGeo(),new THREE.MeshBasicMaterial({vertexColors:true,color:0x555555,fog:true})   /* 顶点色当线性值用，整体压暗 */);
    gear.scale.setScalar(1.12); g.add(gear);
    var em=new THREE.MeshBasicMaterial({color:0xff2a1a,fog:false});
    for(var s=-1;s<=1;s+=2){ var e=new THREE.Mesh(new THREE.SphereGeometry(0.035,6,4),em); e.position.set(s*0.065,2.6,0.15); g.add(e); }
    g.userData.eye=em;
    GLR.patFig=g; GLR.scene.add(g);
  }catch(e){ GLR.patFig=null; }
}
function patRemoveFig(){if(GLR.patFig){GLR.scene.remove(GLR.patFig);ThreeBackend.disposeGroup(GLR.patFig);GLR.patFig=null;}}
function patRender(){
  var g=GLR.patFig; if(!g) return;
  if(PAT.state!=='walk'){ g.visible=false; return; }
  var p=PAT.room==='out'?worldToScene(PAT.x,PAT.y,null):worldToScene(PAT.x,PAT.y,INTERIORS[PAT.room]);
  g.visible=true; g.position.set(p.x,PAT.room==='out'?0:0,p.z);
  g.lookAt(GLR.cam.position.x,0,GLR.cam.position.z);  /* 人形正面朝 +z，lookAt 正好让它面朝你 */
  if(g.userData.eye) g.userData.eye.color.setRGB(1,PAT.locked?0.05:0.25,PAT.locked?0.02:0.12);
}

function updateMarker(dt){
  var m=GLR.marker||ensureMarker();
  if(!m) return;
  if(S.mode!=='in'||S.dead||S.screen!=='play'||PAUSE.on||(typeof UI!=='undefined'&&UI.anyOpen())){ m.visible=false; return; }
  markT-=dt;
  if(markT<=0){
    markT=0.1;
    var hit=nearWorld(24);
    if(!hit){ m.visible=false; GLR.markHit=null; return; }
    GLR.markHit=hit;
    var R=INTERIORS[S.room];
    var p=worldToScene(hit.x,hit.y,R);
    var hy=Math.min(2.55,(typeof furnH==='function'?furnH(hit.ch):0.9)+0.22);
    m.position.set(p.x,hy,p.z);
    m.visible=true;
  }
  if(m.visible&&GLR.markHit){
    m.quaternion.copy(GLR.cam.quaternion);
    var pu=1+0.09*Math.sin((GLR.time||0)*4.2);
    m.scale.set(pu,pu,pu);
  }
}
