/* @module-capsule */
(function($imports){
/* 里世界 3D · 镜中慢半拍（《校园怪谈创意提案》C5，给「镜子」死法一个真实触发，已确认）
   教学楼洗手池上方的镜子里能看到自己的轮廓（不做实时反射：一个低模轮廓贴在镜面前，回放最近的位姿）。按 SAN 分四档：
   0 档（SAN ≥ 70）和你同步；1 档（40–70）慢半拍（0.5 秒）；2 档（20–40）你转身走开，它还面向你；
   3 档（< 20）它先动——抬起一只手。这时还继续盯着看 3 秒，才会触发「镜子」死亡演出（死因「镜子里那个，先动的手。」）。
   别看、离开、先把 SAN 回上来再来，都能躲开。常规 HUD 不显示 SAN，这里就是画面上的分级反馈。 */
'use strict';

var MirrorLag=(function(){
  var own={owner:'campus-tales'}, F={room:null,grp:null,mirrors:[],active:null,buf:[],t:0,stare:0,raise:0};
  var CFG={near:2.6,face:0.6,stareDie:3,lag:0.5};
  function tier(){ var s=$imports.S.san; return s>=70?0:s>=40?1:s>=20?2:3; }
  function clear(){ if(F.grp){ if(F.grp.parent) F.grp.parent.remove(F.grp); try{ $imports.ThreeBackend.disposeGroup(F.grp); }catch(e){} } F.grp=null; F.room=null; F.mirrors=[]; F.active=null; F.buf=[]; F.stare=0; F.raise=0; }
  /* 洗手池（w 格）紧挨着墙的那一面挂镜子：只看网格，判定和画面共用 */
  var SPOT_CACHE={};
  function spots(R){
    if(!R) return [];
    if(SPOT_CACHE[R.id]&&SPOT_CACHE[R.id].grid===R.grid) return SPOT_CACHE[R.id].list;
    var D=[[0,-1],[1,0],[0,1],[-1,0]], list=[];
    for(var r=1;r<R.rows-1;r++) for(var c=1;c<R.cols-1;c++){
      if(R.grid[r][c]!=='w') continue;
      for(var k=0;k<4;k++){ if(R.grid[r+D[k][1]][c+D[k][0]]!=='#') continue;
        list.push({c:c,r:r,dx:D[k][0],dy:D[k][1],nx:-D[k][0],nz:-D[k][1],wx:R.ox+(c+0.5)*R.tw,wy:R.oy+(r+0.5)*R.th}); break; }
    }
    SPOT_CACHE[R.id]={grid:R.grid,list:list}; return list;
  }
  function nearest(R){
    var best=null, bd=1e9; spots(R).forEach(function(m){ var d=Math.hypot($imports.S.x-m.wx,$imports.S.y-m.wy)*$imports.U2M; if(d<bd){ bd=d; best=m; } });
    return best?{m:best,d:bd}:null;
  }
  function build(R){
    clear(); F.room=R.id; F.grp=new $imports.THREE.Group(); F.grp.name='mirror-lag'; $imports.GLR.scene.add(F.grp);
    spots(R).forEach(function(sp){
        var c=sp.c, r=sp.r, D=[[sp.dx,sp.dy]], k=0;
        var w=(0,$imports.worldToScene)(R.ox+(c+0.5+D[k][0]*0.47)*R.tw,R.oy+(r+0.5+D[k][1]*0.47)*R.th,R), nx=sp.nx, nz=sp.nz;
        var g=new $imports.THREE.Group(); g.position.set(w.x,1.5,w.z); g.rotation.y=Math.atan2(nx,nz);
        var glass=new $imports.THREE.Mesh(new $imports.THREE.PlaneGeometry(0.62,0.82),new $imports.THREE.MeshLambertMaterial({color:0x8d999b,emissive:0x1b2224}));
        var frame=new $imports.THREE.Mesh(new $imports.THREE.BoxGeometry(0.68,0.88,0.02),new $imports.THREE.MeshLambertMaterial({color:0x3a3f42})); frame.position.z=-0.012;
        var fig=new $imports.THREE.Group(), body=(0,$imports.figMesh)('person',new $imports.THREE.MeshBasicMaterial({color:0x1d2326,fog:true}),1); body.scale.z=0.04; fig.add(body);
        var arm=new $imports.THREE.Mesh(new $imports.THREE.BoxGeometry(0.09,0.62,0.04),new $imports.THREE.MeshBasicMaterial({color:0x1d2326,fog:true})); arm.position.set(0.27,1.3,0); arm.geometry.translate(0,0.31,0); arm.visible=false; fig.add(arm);
        fig.scale.setScalar(0.42); fig.position.set(0,-0.62,0.012);
        g.add(frame); g.add(glass); g.add(fig); F.grp.add(g);
        F.mirrors.push({g:g,fig:fig,arm:arm,nx:nx,nz:nz,c:c,r:r,wx:sp.wx,wy:sp.wy});
    });
  }
  function facing(m){ var fx=Math.cos($imports.S.ang), fy=Math.sin($imports.S.ang); return -(fx*m.nx+fy*m.nz); }   /* 1 = 正对镜子 */
  function frame(dt){
    var R=$imports.S.mode==='in'?$imports.INTERIORS[$imports.S.room]:null;
    if(!R||R.host!=='teach'||!$imports.GLR.scene||$imports.S.dead){ if(F.grp) clear(); return; }
    if(F.room!==R.id||!F.grp||!F.grp.parent) build(R);
    dt=dt||0; F.t+=dt;
    var best=null, bd=1e9;
    F.mirrors.forEach(function(m){ var d=Math.hypot($imports.S.x-m.wx,$imports.S.y-m.wy)*$imports.U2M; m.fig.visible=d<CFG.near*1.6; if(d<bd){ bd=d; best=m; } });
    F.active=best&&bd<CFG.near*1.6?best:null;
    if(!F.active) return;
    var m=F.active, t=tier(), lat=(($imports.S.x-m.wx)*(-m.nz)+($imports.S.y-m.wy)*m.nx)*$imports.U2M, fc=facing(m);
    F.buf.push([F.t,lat,fc]); while(F.buf.length>2&&F.buf[1][0]<F.t-1.2) F.buf.shift();
    var lag=t>=1?CFG.lag:0, p=F.buf[0];
    for(var i=F.buf.length-1;i>=0;i--){ if(F.buf[i][0]<=F.t-lag){ p=F.buf[i]; break; } }
    m.fig.position.x=-(0,$imports.clamp)(p[1],-0.6,0.6)*0.42;                                   /* 镜像：左右相反 */
    m.fig.rotation.y=(t>=2||p[2]>0)?0:Math.PI;                                      /* 2 档起你走开了它还面向你 */
    m.arm.visible=F.raise>0.02; m.arm.rotation.z=-2.6*F.raise;                       /* 它先抬起手（F.raise 由判定那边推进） */
  }
  /* 判定在模拟步里：3 档、它的手抬起来以后，还离得近、正对着看 3 秒 → 镜子 */
  function tick(dt){
    var R=$imports.S.mode==='in'?$imports.INTERIORS[$imports.S.room]:null, n=R&&R.host==='teach'?nearest(R):null;
    if(!(dt>0)||$imports.S.dead||$imports.S.screen!=='play'||!n||n.d>CFG.near*1.6){ F.stare=0; F.raise=Math.max(0,F.raise-(dt||0)*2); return; }
    var m=n.m, d=n.d, see=d<CFG.near&&facing(m)>CFG.face;
    F.raise=tier()>=3&&see?Math.min(1,F.raise+dt*0.9):Math.max(0,F.raise-dt*2);       /* 3 档：看着它，它先抬手 */
    if(tier()>=3&&F.raise>=0.95&&see){
      F.stare+=dt;
      if(F.stare>=CFG.stareDie){ F.stare=0; (0,$imports.kill)('镜子里那个，先动的手。','mirror','mirror'); }
    }else F.stare=0;
  }
  GameModules.on('frame',frame,own);
  GameModules.on('tick',tick,own);
  GameModules.on('clearWorld',clear,own);
  GameModules.on('boundary',clear,own);
  if(typeof $imports.DEATH_SOURCES!=='undefined') $imports.DEATH_SOURCES.mirror={cause:'镜子里的轮廓先抬起了手，你还一直看着它。',hint:'镜子里的它先动了，就别再看；先把精神缓回来。'};
  if(typeof $imports.DEATH_HINTS!=='undefined') $imports.DEATH_HINTS.mirror='镜子里的它先动了，就别再看。';
  return {F:F, tier:tier, CFG:CFG, spots:spots};
})();

/* @module-exports */
GameModules.publish("game3d/js/modules/campus-tales/mirror.js",{
"MirrorLag":{get:function(){return MirrorLag;},set:function($value){MirrorLag=$value;}}
});
})(GameModules.imports("game3d/js/modules/campus-tales/mirror.js"));
