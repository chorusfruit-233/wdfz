/* 里世界 3D · 粉笔记号：画面（模块 chalk-marks）
   每种图案一张手画的粉笔贴图（线条有断续、颗粒），贴在地上或墙面上；受场景光照（黑暗里要用手电才看得清）。
   场景换了（进出房间）重新摆当前地方的记号；画 / 擦以后立刻刷新。 */
'use strict';

var ChalkFx={g:null, place:undefined, tex:{}, mats:{}, geo:null,
  texture:function(sym){
    if(ChalkFx.tex[sym]) return ChalkFx.tex[sym];
    var cv=document.createElement('canvas'); cv.width=cv.height=128;
    var c=cv.getContext('2d'); if(!c) return null;
    var seed=0; for(var i=0;i<sym.length;i++) seed=seed*31+sym.charCodeAt(i);
    function rnd(){ seed=(seed*1103515245+12345)&0x7fffffff; return seed/0x7fffffff; }
    function J(v){ return v+(rnd()-0.5)*5; }
    /* 每一笔画两遍：外面一圈灰的粉笔灰（白墙上也看得出形状），里面是白的（暗处看得清） */
    c.lineCap='round'; c.lineJoin='round';
    var pass=0, STYLE=[['rgba(70,72,76,0.55)',17],['rgba(245,243,236,0.95)',9]];
    function stroke(){ c.strokeStyle=STYLE[pass][0]; c.lineWidth=STYLE[pass][1]; c.stroke(); }
    function line(pts){ c.beginPath(); c.moveTo(J(pts[0][0]),J(pts[0][1])); for(var k=1;k<pts.length;k++) c.lineTo(J(pts[k][0]),J(pts[k][1])); stroke(); }
    function arrow(dir){                                         /* dir：0 上、1 右、2 左 */
      var P=dir===0?[[64,108],[64,22]]:dir===1?[[18,64],[108,64]]:[[110,64],[20,64]];
      line(P);
      var tip=P[1], b=dir===0?[[36,50],[92,50]]:dir===1?[[80,36],[80,92]]:[[48,36],[48,92]];
      line([b[0],tip,b[1]]);
    }
    function draw(){
      var s0=seed;                                               /* 两遍用同一串抖动：灰边和白芯对得上 */
      if(sym==='x'){ line([[24,24],[104,104]]); line([[104,24],[24,104]]); }
      else if(sym==='up') arrow(0);
      else if(sym==='right') arrow(1);
      else if(sym==='left') arrow(2);
      else if(sym==='o'){ c.beginPath(); c.ellipse(64,64,40+(rnd()-0.5)*4,38+(rnd()-0.5)*4,rnd()*0.4,0.2,Math.PI*2.06); stroke(); }
      else if(sym==='tri'){ line([[64,18],[110,104],[18,104],[64,18]]); }
      else if(sym==='q'){ c.beginPath(); c.arc(64,46,24,Math.PI*1.1,Math.PI*2.35); stroke(); line([[70,70],[64,82]]); c.beginPath(); c.arc(64,104,pass?4:7,0,7); c.fillStyle=STYLE[pass][0]; c.fill(); }
      else if(sym==='bar'){ line([[22,22],[106,22]]); line([[64,22],[64,106]]); line([[64,62],[100,62]]); line([[34,58],[34,106]]); line([[16,106],[112,106]]); }
      seed=s0;
    }
    pass=0; draw(); pass=1; draw();
    /* 粉笔的颗粒：随机擦掉一些点 */
    c.globalCompositeOperation='destination-out';
    for(i=0;i<900;i++){ c.fillStyle='rgba(0,0,0,'+(0.2+rnd()*0.7)+')'; c.fillRect(rnd()*128,rnd()*128,1+rnd()*2,1+rnd()*2); }
    c.globalCompositeOperation='source-over';
    var t=new THREE.CanvasTexture(cv);
    t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4;
    ChalkFx.tex[sym]=t;
    return t;
  },
  material:function(sym,old){
    var key=sym+(old?':old':'');
    if(ChalkFx.mats[key]) return ChalkFx.mats[key];
    var t=ChalkFx.texture(sym); if(!t) return null;
    var m=new THREE.MeshLambertMaterial({map:t,transparent:true,opacity:old?0.5:0.92,color:old?0xd6ccb4:0xffffff,
      depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3,fog:true});
    ChalkFx.mats[key]=m;
    return m;
  },
  clear:function(){
    if(ChalkFx.g&&ChalkFx.g.parent) ChalkFx.g.parent.remove(ChalkFx.g);
    ChalkFx.g=null; ChalkFx.place=undefined;
  },
  /* 摆当前地方（某个房间 / 室外）的全部记号 */
  build:function(){
    if(typeof GLR==='undefined'||!GLR.scene) return;
    ChalkFx.clear();
    var room=S.mode==='in'?S.room:null, R=room?INTERIORS[room]:null;
    if(room&&!R) return;
    if(!ChalkFx.geo) ChalkFx.geo=new THREE.PlaneGeometry(1,1);
    var g=new THREE.Group(); g.name='chalk-marks'; g.userData.worldPart=true;   /* 属于场景：死亡演出藏场景时一起藏 */
    ChalkMarks.visible(room).forEach(function(m){
      var mat=ChalkFx.material(m.s,!!m.old); if(!mat) return;
      var mesh=new THREE.Mesh(ChalkFx.geo,mat), p=worldToScene(m.x,m.y,R), j=hash2(Math.abs(m.n)*3+1,m.s.length*7);
      mesh.rotation.order='YXZ';
      if(m.face==='floor'){
        var sz=0.8*(0.92+0.16*j);
        mesh.position.set(p.x,m.h+0.012,p.z);
        mesh.rotation.set(-Math.PI/2,Math.atan2(-Math.cos(m.a),-Math.sin(m.a))+(j-0.5)*0.16,0);
        mesh.scale.set(sz,sz,1);
      }else{
        var sw=0.6*(0.92+0.16*j), nx=Math.cos(m.a), nz=Math.sin(m.a);
        mesh.position.set(p.x+nx*0.012,(m.f||0)+m.h,p.z+nz*0.012);
        mesh.rotation.set(0,Math.atan2(nx,nz),(j-0.5)*0.14);
        mesh.scale.set(sw,sw,1);
      }
      mesh.renderOrder=2;
      g.add(mesh);
    });
    GLR.scene.add(g);
    ChalkFx.g=g; ChalkFx.place=room;
  },
  refresh:function(){ if(ChalkFx.place!==undefined||ChalkFx.g) ChalkFx.build(); },
  count:function(){ return ChalkFx.g?ChalkFx.g.children.length:0; }
};
GameModules.on('sceneBuilt',function(){ ChalkFx.build(); },{owner:'chalk-marks'});
GameModules.on('clearWorld',function(){ ChalkFx.clear(); },{owner:'chalk-marks'});
