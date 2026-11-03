/* @module-capsule */
(function($imports){
/* 里世界 3D · 虚空迷宫：碰撞、高度、坠落、SAN、出口（模块 void-maze）
   布局在 maze-data.js，模型在 maze-model.js。这里不碰渲染对象。

   身体：脚底高度 S.floorY，向上 MAZE_CFG.head 米；平面上是半径 PRAD 的圆。
   脚下：体素顶面或楼梯 / 平台面里，不高于「脚 + 迈步高度」的最高那个。
   走出边缘就开始往下掉；掉到 voidY 以下 = 掉进虚空：扣一点 SAN，在出生区域里随机一处重来。 */
'use strict';

var VoidMaze=(function(){
  var C=$imports.MAZE_CFG, NX=C.cols, NZ=C.rows, NY=C.ny, X0=C.x0, Z0=C.z0, Y0=C.y0;
  var V=null;                                   /* 体素：1 = 实心 */
  var MZ={t:0,falls:0,air:false,vy:0,respawning:false,pending:null,soundT:20,told:{},ready:false};   /* ready：进房间、定好高度以后才算物理 */

  function idx(ix,iy,iz){ return (iy*NZ+iz)*NX+ix; }
  function fill(b,val){
    var ix,iy,iz,x0=b[0]-X0,x1=b[1]-X0,y0=b[2]-Y0,y1=b[3]-Y0,z0=b[4]-Z0,z1=b[5]-Z0;
    for(iy=Math.max(0,y0);iy<Math.min(NY,y1);iy++)
      for(iz=Math.max(0,z0);iz<Math.min(NZ,z1);iz++)
        for(ix=Math.max(0,x0);ix<Math.min(NX,x1);ix++) V[idx(ix,iy,iz)]=val;
  }
  function build(){
    if(V) return V;
    V=new Uint8Array(NX*NY*NZ); V.fill(1);
    $imports.MAZE_AIR.forEach(function(a){ fill(a.b,0); });
    $imports.MAZE_SOLID.forEach(function(s){ fill(s.b,1); });
    return V;
  }
  /* 体素世界外面：往下是虚空（空的），四周和上面是实心 */
  function cell(ix,iy,iz){
    if(iy<0) return 0;
    if(ix<0||iz<0||ix>=NX||iz>=NZ||iy>=NY) return 1;
    return V[idx(ix,iy,iz)];
  }
  function room(){ return $imports.INTERIORS[C.room]; }
  function here(){ return $imports.S.mode==='in'&&$imports.S.room===C.room; }
  /* 世界坐标（游戏单位）↔ 场景米 */
  function toScene(wx,wy){ var R=room(); return {x:(wx-R.ox)*$imports.U2M-R.cols*0.5, z:(wy-R.oy)*$imports.U2M-R.rows*0.5}; }
  function toWorld(x,z){ var R=room(); return {x:R.ox+(x+R.cols*0.5)/$imports.U2M, y:R.oy+(z+R.rows*0.5)/$imports.U2M}; }

  /* 楼梯 / 平台在 (x,z) 处的面高；不在上面返回 null */
  function walkH(p,x,z){
    if(x<p.x0-1e-6||x>p.x1+1e-6||z<p.z0-1e-6||z>p.z1+1e-6) return null;
    if(p.t==='plat') return p.h;
    var a=p.ax==='x'?x:z, k=(0,$imports.clamp)((a-p.a0)/(p.a1-p.a0),0,1);
    return p.h0+(p.h1-p.h0)*k;
  }
  /* 脚下最高的面（不高于 maxY）；没有就是 −Infinity（虚空） */
  function groundAt(x,z,maxY){
    build();
    var best=-Infinity, ix=Math.floor(x-X0), iz=Math.floor(z-Z0), iy;
    if(ix>=0&&iz>=0&&ix<NX&&iz<NZ){
      for(iy=Math.min(NY-1,Math.floor(maxY-Y0-1+1e-9));iy>=0;iy--){
        if(V[idx(ix,iy,iz)]){ best=Y0+iy+1; break; }
      }
    }
    for(var i=0;i<$imports.MAZE_WALK.length;i++){
      var h=walkH($imports.MAZE_WALK[i],x,z);
      if(h!==null&&h<=maxY+1e-9&&h>best) best=h;
    }
    return best;
  }
  function rectDepth(x,z,r,x0,z0,x1,z1){ return $imports.Collision.rectDepth(x,z,r,x0,z0,x1,z1); }
  /* 身体（脚高 fy）在 (x,z)、半径 r 时嵌进实心多深（米）。r = 0 时就是「这一点挡不挡」 */
  function depthAt(x,z,r,fy){
    build();
    var lo=fy+C.step, hi=fy+C.head, total=0, ix, iy, iz;
    var ix0=Math.floor(x-r-X0), ix1=Math.floor(x+r-X0), iz0=Math.floor(z-r-Z0), iz1=Math.floor(z+r-Z0);
    var iy0=Math.floor(lo-Y0), iy1=Math.floor(hi-Y0-1e-9);
    for(iy=iy0;iy<=iy1;iy++) for(iz=iz0;iz<=iz1;iz++) for(ix=ix0;ix<=ix1;ix++){
      if(!cell(ix,iy,iz)) continue;
      var cx0=X0+ix, cz0=Z0+iz;
      total+=r>0?rectDepth(x,z,r,cx0,cz0,cx0+1,cz0+1):((x>=cx0&&x<cx0+1&&z>=cz0&&z<cz0+1)?1:0);
    }
    for(var i=0;i<$imports.MAZE_WALK.length;i++){
      var p=$imports.MAZE_WALK[i];
      if(x+r<p.x0||x-r>p.x1||z+r<p.z0||z-r>p.z1) continue;
      var top=walkH(p,(0,$imports.clamp)(x,p.x0,p.x1),(0,$imports.clamp)(z,p.z0,p.z1)), bot=top-0.3;
      if(top<=lo||bot>=hi) continue;
      total+=r>0?rectDepth(x,z,r,p.x0,p.z0,p.x1,p.z1):((x>=p.x0&&x<=p.x1&&z>=p.z0&&z<=p.z1)?1:0);
    }
    return total;
  }

  /* ---------- 房间接口（world.js / collision.js 会调） ---------- */
  function collide(wx,wy,r){
    var p=toScene(wx,wy);
    return depthAt(p.x,p.z,r*$imports.U2M,$imports.S.floorY||0)/$imports.U2M;
  }
  function solid(wx,wy){
    var p=toScene(wx,wy);
    return depthAt(p.x,p.z,0,$imports.S.floorY||0)>0;
  }
  /* 每走一小步：贴地（上下楼梯）或开始踩空 */
  function moved(){
    if(!here()||MZ.air||MZ.respawning||!MZ.ready) return;
    var p=toScene($imports.S.x,$imports.S.y), fy=$imports.S.floorY||0, g=groundAt(p.x,p.z,fy+C.step);
    if(g>=fy-C.snap) $imports.S.floorY=g;
    else { MZ.air=true; MZ.vy=0; }
  }
  function spawnPoint(){
    var sp=C.spawn, i, x, z;
    for(i=0;i<40;i++){
      x=sp.x0+$imports.GameRandom.next()*(sp.x1-sp.x0); z=sp.z0+$imports.GameRandom.next()*(sp.z1-sp.z0);
      if(Math.abs(groundAt(x,z,sp.h+C.step)-sp.h)<1e-6&&depthAt(x,z,$imports.PRAD*$imports.U2M+0.05,sp.h)===0) break;
    }
    var w=toWorld(x,z);
    return {x:w.x,y:w.y,ang:Math.floor($imports.GameRandom.next()*4)*Math.PI/2+Math.PI/4,maze:{fy:sp.h}};
  }
  /* 进房间时定高度（doEnterRoom 在防卡位之前调用） */
  function onEnter(spawn){
    MZ.air=false; MZ.vy=0; MZ.respawning=false; MZ.ready=true;
    var fy=null;
    if(spawn&&spawn.maze&&Number.isFinite(spawn.maze.fy)) fy=spawn.maze.fy;
    else if(spawn&&spawn.restoreVisit&&MZ.pending&&Number.isFinite(MZ.pending.fy)) fy=MZ.pending.fy;
    MZ.pending=null;
    if(fy!==null){
      var p=toScene($imports.S.x,$imports.S.y), g=groundAt(p.x,p.z,fy+C.step);
      if(g>-Infinity&&Math.abs(g-fy)<=C.snap&&depthAt(p.x,p.z,$imports.PRAD*$imports.U2M,g)===0){ $imports.S.floorY=g; return; }
    }
    var s=spawnPoint();                                 /* 没给落点、或者存档里的位置站不住：回出生区域 */
    $imports.S.x=s.x; $imports.S.y=s.y; $imports.S.ang=s.ang; $imports.S.floorY=s.maze.fy;
  }

  /* ---------- 坠落、虚空、SAN ---------- */
  function respawn(){
    var s=spawnPoint();
    $imports.S.x=s.x; $imports.S.y=s.y; $imports.S.ang=s.ang; $imports.S.pitch=0; $imports.S.floorY=s.maze.fy;
    MZ.air=false; MZ.vy=0; MZ.respawning=false;
    try{ (0,$imports.resetInputState)(); }catch(e){}
    (0,$imports.os)(MZ.falls>1?'我：又回到了这里。四面还是那几堵白墙。':'我：……我站在一开始的地方。身上没有伤，心跳得很快。',3.4,$imports.OS_FORCE);
    (0,$imports.autoSave)();
  }
  function fallIntoVoid(){
    if(MZ.respawning) return;
    MZ.respawning=true; MZ.falls++;
    $imports.PlayerStats.changeSan(-C.fallSan,'void-maze-fall',{min:0});      /* 数值只经 PlayerStats 写（模块边界） */
    $imports.Playtest.event('坠入虚空',MZ.falls);
    if($imports.S.san<=0){
      (0,$imports.kill)('我一直往下掉，掉到忘了自己是从哪里开始掉的。','abyss','void_fall');
      if($imports.S.dead){ MZ.respawning=false; return; }
      if($imports.S.san<=0) $imports.PlayerStats.setSan(1,'death-prevented');   /* 药丸 / 天赋 / 调试无敌挡下了：照常回到出生区域 */
    }
    try{ $imports.SFX.deep(); }catch(e){}
    (0,$imports.fadeTo)(function(){ if(here()&&!$imports.S.dead) respawn(); else MZ.respawning=false; });
  }
  function drainRate(t){ return C.drainBase+C.drainGrow*t; }
  function tick(dt){
    if(!here()||$imports.S.dead||!(dt>0)||!MZ.ready) return;            /* 读档后、淡入进房间之前不算（那时高度还没恢复） */
    MZ.t+=dt;
    $imports.PlayerStats.changeSan(-drainRate(MZ.t)*dt,'void-maze',{min:0});   /* 越久掉得越快：满 SAN 大约 20 分钟掉完 */
    if($imports.S.san<=0){
      (0,$imports.kill)('黑暗里，我已经想不起自己是从哪扇门进来的。','void','void_lost');
      if($imports.S.dead) return;
      if($imports.S.san<=0) $imports.PlayerStats.setSan(1,'death-prevented');   /* 被挡下了（与 settleSan 相同的处理） */
    }
    if(!MZ.told.long&&MZ.t>300){ MZ.told.long=1; (0,$imports.os)('我：在这里待得越久，越难想起外面是什么样子。得找到门。',3.6); }
    ambience(dt);
    var p=toScene($imports.S.x,$imports.S.y), fy=$imports.S.floorY||0;
    if(MZ.air){
      MZ.vy=Math.max(-C.maxFall,MZ.vy-C.gravity*dt);
      var ny=fy+MZ.vy*dt, g=groundAt(p.x,p.z,fy+1e-6);
      if(g>-Infinity&&ny<=g){
        $imports.S.floorY=g; MZ.air=false;
        if(MZ.vy<-7){ try{ $imports.SFX.step(); $imports.SFX.step(); }catch(e){} (0,$imports.os)('我：重重摔在下面的平台上。还好，没掉下去。',2.6); }
        MZ.vy=0;
      }else $imports.S.floorY=ny;
      if($imports.S.floorY<C.voidY) fallIntoVoid();
    }else if(!MZ.respawning){
      var g2=groundAt(p.x,p.z,fy+C.step);
      if(g2<fy-C.snap){ MZ.air=true; MZ.vy=0; }
    }
  }
  /* 声音先行：远处偶尔有动静，方向不定，大多什么都不是 */
  function ambience(dt){
    MZ.soundT-=dt;
    if(MZ.soundT>0) return;
    MZ.soundT=24+$imports.GameRandom.next()*36;
    var kinds=['steps','knock','door','whisper'];
    try{ $imports.SFX.dread(kinds[Math.floor($imports.GameRandom.next()*kinds.length)],{pan:$imports.GameRandom.next()*2-1,k:0.25+$imports.GameRandom.next()*0.3,muffled:true,behind:$imports.GameRandom.next()<0.4}); }catch(e){}
  }

  /* ---------- 出口和地上的粉笔 ---------- */
  function nearExit(){
    if(!here()||MZ.air) return null;
    var p=toScene($imports.S.x,$imports.S.y), fy=$imports.S.floorY||0;
    for(var i=0;i<C.exits.length;i++){
      var e=C.exits[i];
      if(Math.abs(fy-e.h)<1.2&&Math.hypot(p.x-e.x,p.z-e.z)<1.7) return e;
    }
    return null;
  }
  function nearChalk(){
    if(!here()||MZ.air) return false;
    var p=toScene($imports.S.x,$imports.S.y);
    return Math.abs(($imports.S.floorY||0)-C.chalk.h)<0.6&&Math.hypot(p.x-C.chalk.x,p.z-C.chalk.z)<1.3;
  }
  /* 出口 1：回到上电梯的那一层；出口 2：另一栋楼同一层的电梯厅 */
  function leave(id){
    var ride=$imports.Elevator.recover();
    if(ride.phase!=='dream') ride.phase='dream';
    var floor=ride.origin||1;
    if(id==='exit2'){
      var lift=$imports.Elevator.state(ride.host); lift.phase='idle'; lift.floor=floor; lift.remaining=0;
      ride.host=ride.host==='teach'?'lab':'teach';
    }
    $imports.Playtest.event('离开虚空迷宫',id);
    (0,$imports.gameFact)('maze',{what:'leave',exit:id});
    $imports.Elevator.arrive(floor);
    (0,$imports.os)(id==='exit2'?'我：推开门，外面是另一栋楼的电梯厅。回头看，只有一扇普通的电梯门。':
      '我：推开门，是我上电梯的那一层。身后的门变回了电梯门，指示灯一格一格地暗下去。',4,$imports.OS_FORCE);
  }
  function enter(button){
    var s=spawnPoint();
    MZ.t=0; MZ.told={};
    (0,$imports.doEnterRoom)(C.room,s);
    (0,$imports.os)('我：门外不是走廊。很黑，四周是一块块方方正正的白色墙面。身后的电梯门合上了，然后就不见了。',4.5,$imports.OS_FORCE);
  }

  /* ---------- 死在迷宫里：自己的死因（复盘提示、调查记录、死亡档案）和墓志铭；演出在 maze-death.js ----------
     死亡档案的两条（void_lost / void_fall）登记在 death-archive.js，标了 secret：没在迷宫里死过就完全不出现 */
  if(typeof $imports.DEATH_SOURCES!=='undefined'){
    $imports.DEATH_SOURCES.void_lost={cause:'在白色的迷宫里待得太久，理智被一点点耗尽了：待得越久，掉得越快。',
      hint:'迷宫里不能久留。出口是门缝漏着淡蓝色光的暗门，都不在出发的那一层，要走楼梯上下；用粉笔在拐角做记号，免得兜回原地。'};
    $imports.DEATH_SOURCES.void_fall={cause:'理智所剩无几的时候又掉进了虚空。每掉下去一次，都会再扣一点理智。',
      hint:'理智低的时候别走没有栏杆的窄梁和断口，宁可绕远路；走窄的地方先停下转好方向，再一步步往前走。'};
  }
  if(typeof $imports.DFX_EPI!=='undefined'){ $imports.DFX_EPI.void='你从那扇门前走过了很多次。'; $imports.DFX_EPI.abyss='下面站着的，是刚进来的你。'; }

  /* ---------- 存档：只在迷宫里时存高度和计时 ---------- */
  GameModules.persistent('void-maze',{
    save:function(){ return here()?{t:MZ.t,falls:MZ.falls,fy:$imports.S.floorY||0,told:MZ.told}:null; },
    load:function(d){
      if(!d||typeof d!=='object') return;
      MZ.t=Number.isFinite(d.t)?(0,$imports.clamp)(d.t,0,7200):0; MZ.falls=Number.isFinite(d.falls)?d.falls:0;
      MZ.told=(d.told&&typeof d.told==='object')?d.told:{};
      MZ.pending={fy:Number.isFinite(d.fy)?d.fy:0}; MZ.ready=false;
    },
    reset:function(){ MZ.t=0; MZ.falls=0; MZ.air=false; MZ.vy=0; MZ.respawning=false; MZ.pending=null; MZ.told={}; MZ.soundT=20; MZ.ready=false; }
  });

  /* ---------- 钩子 ---------- */
  var own={owner:'void-maze'};
  GameModules.on('interiors',function(){
    var g=(0,$imports.blank)(C.cols,C.rows,'.'); (0,$imports.border)(g,C.cols,C.rows,'#');
    var R=(0,$imports.mkFloor)(C.room,C.name,'dream',1,g);
    R.build=function(RR){ return (0,$imports.buildVoidMaze)(RR); };
    R.collide=collide; R.solid=solid; R.moved=moved; R.onEnter=onEnter;
    R.ownHeight=true; R.noMap=true; R.noClock=true;
    if(typeof $imports.ROOM_LIGHTS!=='undefined') $imports.ROOM_LIGHTS[C.room]=C.lights;
  },own);
  /* 之前来过的人留下的粉笔记号（不存档，画得淡）：阶梯塔顶的死路、北桥的断口前、西桥厅的尽头 */
  GameModules.on('boot',function(){
    if(typeof $imports.ChalkMarks==='undefined') return;
    function W(x,z){ return toWorld(x,z); }
    var a=W(13,1.97), b=W(2.6,-32), c=W(-20.6,-5);
    var list=[
      {face:'wall',x:a.x,y:a.y,h:1.5,f:8,a:-Math.PI/2,s:'x'},
      {face:'floor',x:b.x,y:b.y,h:4,a:Math.PI,s:'x'},
      {face:'floor',x:c.x,y:c.y,h:0,a:-Math.PI/2,s:'q'}
    ];
    /* 回环：四个拐角地上都有前人画的箭头，全顺着同一个方向——跟着走只会绕回原地 */
    [[-10,28,Math.PI],[-20,28,Math.PI/2],[-20,36,0],[-10,36,-Math.PI/2]].forEach(function(p){ var w=W(p[0],p[1]); list.push({face:'floor',x:w.x,y:w.y,h:-8,a:p[2],s:'up'}); });
    /* 柱林：入口这一侧几根柱子上刻着「正」字，像有人在数自己绕了几圈 */
    [[9.98,13.5],[9.98,19.5],[12.98,22.5]].forEach(function(p){ var w=W(p[0],p[1]); list.push({face:'wall',x:w.x,y:w.y,h:1.35,f:0,a:Math.PI,s:'bar'}); });
    /* 窄梁对面的平台：一个问号 */
    var d=W(19,-36.6); list.push({face:'floor',x:d.x,y:d.y,h:4,a:-Math.PI/2,s:'q'});
    $imports.ChalkMarks.preset(C.room,list);
  },own);
  GameModules.on('tick',tick,own);
  GameModules.on('leaveRoom',function(from,to){
    if(from===C.room&&to!==C.room){ MZ.t=0; MZ.air=false; MZ.vy=0; MZ.respawning=false; MZ.told={}; MZ.ready=false; }
  },own);
  GameModules.on('interact',function(){
    var e=nearExit();
    if(e){ leave(e.id); return true; }
    if(nearChalk()){
      if((0,$imports.hasItem)('chalk')) (0,$imports.os)('我：地上还有半截粉笔。我身上已经有一支了。',2.6);
      else if((0,$imports.addItem)('chalk')) (0,$imports.os)('我：半截粉笔，断口很新。也许能在墙上留个记号。',3.2);
      return true;
    }
    return false;
  },own);
  GameModules.on('hint',function(){
    var e=nearExit(); if(e) return '推开门（'+e.name+'）';
    if(nearChalk()&&!(0,$imports.hasItem)('chalk')) return '捡起粉笔';
    return null;
  },own);
  GameModules.on('clockText',function(){ return here()?'???':undefined; },own);
  GameModules.on('mapBlocked',function(){ return here()?'我：打开地图，纸上什么也没有。这里不在任何一张图上。':undefined; },own);
  GameModules.on('itemUse',function(id){
    if(!here()) return false;
    if(id==='watch'){ (0,$imports.os)('我：表盘上的指针一圈一圈地转，停不下来。现在是几点？',3); (0,$imports.toast)('???'); return true; }
    if(id==='map'||id==='atlas'){ (0,$imports.os)('我：图上找不到这里。纸是白的。',2.6); return true; }
    return false;
  },own);
  GameModules.on('lightState',function(st){
    if(!here()) return;
    st.amb=C.amb; st.hemi=C.hemi; st.dir=0; st.ptK=1; st.steady=true;
    st.fog={r:C.fog.r,g:C.fog.g,b:C.fog.b,density:C.fog.density};
  },own);

  return {
    MZ:MZ, build:build, cell:cell, groundAt:groundAt, depthAt:depthAt, here:here,
    toScene:toScene, toWorld:toWorld, spawnPoint:spawnPoint, enter:enter, leave:leave,
    nearExit:nearExit, drainRate:drainRate, respawn:respawn,
    /* 粉笔记号用：某一点的地面高度（虚空返回 null） */
    floorAt:function(wx,wy){ var p=toScene(wx,wy), g=groundAt(p.x,p.z,($imports.S.floorY||0)+C.step); return g>-Infinity&&g>=($imports.S.floorY||0)-1.5?g:null; }
  };
})();

/* @module-exports */
GameModules.publish("game3d/js/modules/void-maze/maze.js",{
"VoidMaze":{get:function(){return VoidMaze;},set:function($value){VoidMaze=$value;}}
});
})(GameModules.imports("game3d/js/modules/void-maze/maze.js"));
