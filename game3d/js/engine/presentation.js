/* @module-capsule */
(function($imports){
/* 纯表现：异象精灵、路人、巡察者和交互标记。 */
'use strict';
var ENTS=[];
function entAdd(color,w,h,x,y,z){
  var geo=new $imports.THREE.PlaneGeometry(w,h);
  var mat=new $imports.THREE.MeshBasicMaterial({color:color,transparent:true,opacity:0.85,side:$imports.THREE.DoubleSide,depthWrite:false});
  var m=new $imports.THREE.Mesh(geo,mat);
  m.position.set(x,y,z);
  $imports.GLR.scene.add(m);
  ENTS.push(m);
  return m;
}
function entClear(){
  for(var i=0;i<ENTS.length;i++){ $imports.GLR.scene.remove(ENTS[i]); ENTS[i].geometry.dispose(); ENTS[i].material.dispose(); }
  ENTS=[];
}
function entFace(){
  for(var i=0;i<ENTS.length;i++){
    ENTS[i].quaternion.copy($imports.GLR.cam.quaternion);
  }
}


var FN_P={grp:null,room:null,mat:null};
function fnPeopleClear(){
  if(FN_P.grp){$imports.GLR.scene.remove(FN_P.grp);$imports.ThreeBackend.disposeGroup(FN_P.grp);}
  FN_P.grp=null; FN_P.room=null;
}
function fnPeopleBuild(){
  fnPeopleClear();
  if($imports.S.mode!=='in'||!$imports.S.room) return;
  var R=$imports.INTERIORS[$imports.S.room]; if(!R) return;
  if(!FN_P.mat){FN_P.mat=new $imports.THREE.MeshBasicMaterial({color:0x41505c,fog:true});FN_P.mat.userData.shared=true;}
  var g=new $imports.THREE.Group();
  $imports.GLR.scene.add(g); FN_P.grp=g; FN_P.room=$imports.S.room;
  var p=(0,$imports.anfxW2S)($imports.S.x,$imports.S.y), made=0, c,r2,tries=0;
  while(made<4&&tries++<160){
    c=1+Math.floor($imports.PresentationRandom.next()*(R.cols-2));
    r2=1+Math.floor($imports.PresentationRandom.next()*(R.rows-2));
    var ch=R.grid[r2][c];
    if(ch==='#'||ch==='='||ch==='O'||ch==='S'||ch==='L') continue;
    var w=(0,$imports.worldToScene)(R.ox+(c+0.5)*R.tw,R.oy+(r2+0.5)*R.th,R);
    var d=Math.hypot(w.x-p.x,w.z-p.z);
    if(d<2.2||d>7.5) continue;
    var fg=new $imports.THREE.Group();
    fg.add((0,$imports.figMesh)('person',FN_P.mat,1));
    fg.position.set(w.x,0,w.z);
    fg.rotation.y=Math.atan2(p.x-w.x,p.z-w.z);                 /* 正面（+z）朝着你 */
    g.add(fg);
    made++;
  }
}
function fnPeopleTick(){
  var on=($imports.S.fn&&$imports.S.fn.on&&$imports.S.fn.v<72);
  if(!on){ if(FN_P.grp) fnPeopleClear(); return; }
  if(FN_P.room!==$imports.S.room) fnPeopleBuild();
}

var PAT_GEAR={};
function patGearGeo(){
  var ag=(0,$imports.figAssetGeo)('pat_gear','patGear',true); if(ag) return ag;      /* 大衣、大檐帽、袖章、夹板（figures.py） */
  var key=$imports.Quality.get().segments;
  if(PAT_GEAR[key]) return PAT_GEAR[key];
  var K=new $imports.Kit(), m='dark', coat=0x1c2026, sp=$imports.FIG_SPEC.teacher, t=sp.thin;
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
function patEnsureFig(){if(!$imports.GLR.patFig)patAddFig();}
function patAddFig(){
  patRemoveFig();
  try{
    var g=new $imports.THREE.Group();
    var body=(0,$imports.figMesh)('teacher',new $imports.THREE.MeshBasicMaterial({color:0x040506,fog:true}),1.12);
    g.add(body);
    var gear=new $imports.THREE.Mesh(patGearGeo(),new $imports.THREE.MeshBasicMaterial({vertexColors:true,color:0x555555,fog:true})   /* 顶点色当线性值用，整体压暗 */);
    gear.scale.setScalar(1.12); g.add(gear);
    $imports.GLR.patFig=g; $imports.GLR.scene.add(g);
  }catch(e){ $imports.GLR.patFig=null; }
}
function patRemoveFig(){if($imports.GLR.patFig){$imports.GLR.scene.remove($imports.GLR.patFig);$imports.ThreeBackend.disposeGroup($imports.GLR.patFig);$imports.GLR.patFig=null;}}
function patRender(){
  var g=$imports.GLR.patFig; if(!g) return;
  if($imports.VisualState.stage||$imports.PAT.state!=='walk'||$imports.PAT.room!==(0,$imports.patRoomHere)()||$imports.PAT.transition){ g.visible=false; return; }
  var p=$imports.PAT.room==='out'?(0,$imports.worldToScene)($imports.PAT.x,$imports.PAT.y,null):(0,$imports.worldToScene)($imports.PAT.x,$imports.PAT.y,$imports.INTERIORS[$imports.PAT.room]);
  g.visible=true; g.position.set(p.x,$imports.PAT.fy||0,p.z);
  g.lookAt($imports.GLR.cam.position.x,0,$imports.GLR.cam.position.z);  /* 人形正面朝 +z，lookAt 正好让它面朝你 */
}

function updateMarker(dt){
  var m=$imports.GLR.marker||(0,$imports.ensureMarker)();
  if(!m) return;
  if($imports.S.mode!=='in'||$imports.S.dead||$imports.S.screen!=='play'||$imports.PAUSE.on||(typeof $imports.UI!=='undefined'&&$imports.UI.anyOpen())){ m.visible=false; return; }
  $imports.markT-=dt;
  if($imports.markT<=0){
    $imports.markT=0.1;
    var hit=(0,$imports.nearWorld)(24);
    if(!hit){ m.visible=false; $imports.GLR.markHit=null; return; }
    $imports.GLR.markHit=hit;
    var R=$imports.INTERIORS[$imports.S.room];
    var p=(0,$imports.worldToScene)(hit.x,hit.y,R);
    var hy=Math.min(2.55,(typeof $imports.furnH==='function'?(0,$imports.furnH)(hit.ch):0.9)+0.22);
    m.position.set(p.x,hy,p.z);
    m.visible=true;
  }
  if(m.visible&&$imports.GLR.markHit){
    m.quaternion.copy($imports.GLR.cam.quaternion);
    var pu=1+0.09*Math.sin(($imports.GLR.time||0)*4.2);
    m.scale.set(pu,pu,pu);
  }
}

/* @module-exports */
GameModules.publish("game3d/js/engine/presentation.js",{
"ENTS":{get:function(){return ENTS;},set:function($value){ENTS=$value;}},
"entAdd":{get:function(){return entAdd;},set:function($value){entAdd=$value;}},
"entClear":{get:function(){return entClear;},set:function($value){entClear=$value;}},
"entFace":{get:function(){return entFace;},set:function($value){entFace=$value;}},
"FN_P":{get:function(){return FN_P;},set:function($value){FN_P=$value;}},
"fnPeopleClear":{get:function(){return fnPeopleClear;},set:function($value){fnPeopleClear=$value;}},
"fnPeopleBuild":{get:function(){return fnPeopleBuild;},set:function($value){fnPeopleBuild=$value;}},
"fnPeopleTick":{get:function(){return fnPeopleTick;},set:function($value){fnPeopleTick=$value;}},
"PAT_GEAR":{get:function(){return PAT_GEAR;},set:function($value){PAT_GEAR=$value;}},
"patGearGeo":{get:function(){return patGearGeo;},set:function($value){patGearGeo=$value;}},
"patEnsureFig":{get:function(){return patEnsureFig;},set:function($value){patEnsureFig=$value;}},
"patAddFig":{get:function(){return patAddFig;},set:function($value){patAddFig=$value;}},
"patRemoveFig":{get:function(){return patRemoveFig;},set:function($value){patRemoveFig=$value;}},
"patRender":{get:function(){return patRender;},set:function($value){patRender=$value;}},
"updateMarker":{get:function(){return updateMarker;},set:function($value){updateMarker=$value;}}
});
})(GameModules.imports("game3d/js/engine/presentation.js"));
