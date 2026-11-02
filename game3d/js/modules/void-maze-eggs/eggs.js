/* 里世界 3D · 虚空迷宫的彩蛋：判定（模块 void-maze-eggs，规则层，不碰画面）
   内部内容：不进玩家 Wiki（CLAUDE.md 彩蛋保密规则）。
   ① 反色：站在桥边、不动、低头盯着下面的虚空看 3 秒多，整个画面突然反色一下；反色的那一瞬间，白下来的虚空里站着一个人，
      抬头看着你。同一趟里两次之间至少隔 150 秒。
   ② 黑影：三个固定位置，玩家走到对应的地方、面朝那边时出现一个全黑的人影；看着它一会儿、走近、或者过一会儿，它就不见了。
      每个位置每一趟只出现一次。不伤人、不扣 SAN（「不是所有异常都致命」）。
   触发条件都是确定的（位置、朝向、时长），不随机。结果只以「已经发生的事实」通过 mazeEvent 钩子发出去，
   画面和声音由 eggs-fx.js 接手。 */
'use strict';

var MAZE_EGG_CFG={
  invert:{pitch:-0.85, stare:3.2, dur:1.15, cooldown:150, reach:3.2},
  /* 位置是迷宫的场景米（见 modules/void-maze/maze-data.js）；zone=[x0,x1,z0,z1,脚下高度]；face 是人影面朝的方向；
     view：玩家朝向与人影方向的夹角小于它才出现；look：盯着看这么久消失；near：走到这么近消失；timeout：最多停留秒数 */
  shadows:[
    {id:'bridge', x:-9,  z:-17,  h:0,    face:0,            zone:[-4.2,-1,-18,-16,0],    view:1.1, look:1.3, near:0,   timeout:14, cue:'steps'},
    {id:'tower',  x:13,  z:-9,   h:5.5,  face:Math.PI/2,    zone:[12,14,0,2,8],          view:0.9, look:1.2, near:0,   timeout:12, cue:'whisper'},
    {id:'exit',   x:-3,  z:36.3, h:-8,   face:-Math.PI/2,   zone:[-4,-2,27.6,31,-8],     view:1.0, look:1.0, near:5.2, timeout:12, cue:'steps'},
    /* 第三轮的新结构：走过窄梁到了对面平台，回头——梁的起点站着一个人；柱林深处，两排柱子之间 */
    {id:'catwalk',x:16.5,z:-27.6,h:4,    face:-Math.PI/2,   zone:[16,22,-38,-35,4],      view:0.8, look:1.2, near:0,   timeout:12, cue:'whisper'},
    {id:'pillars',x:20,  z:31.5, h:0,    face:Math.PI,      zone:[8,11.5,13,20,0],       view:0.9, look:1.1, near:6,   timeout:14, cue:'steps'}
  ]
};

var VoidMazeEggs=(function(){
  var C=MAZE_EGG_CFG;
  var E={stare:0, invertT:0, cool:0, seen:{}, active:null};
  function reset(){
    if(E.active) GameModules.emit('mazeEvent',{kind:'shadowHide',id:E.active.id,how:'leave'});
    if(E.invertT>0) GameModules.emit('mazeEvent',{kind:'invertEnd'});
    E.stare=0; E.invertT=0; E.cool=0; E.seen={}; E.active=null;
  }
  function eye(){ return S.eyeH||EYE; }
  /* 低头看的那一点（世界坐标）下面是不是虚空 */
  function gazeVoid(){
    var pitch=S.pitch||0;
    if(pitch>C.invert.pitch) return null;
    var d=Math.min(C.invert.reach,eye()/Math.tan(-pitch))/U2M;
    var gx=S.x+Math.cos(S.ang)*d, gy=S.y+Math.sin(S.ang)*d;
    return VoidMaze.floorAt(gx,gy)===null?{x:gx,y:gy}:null;
  }
  function tickInvert(dt){
    if(E.invertT>0){
      E.invertT-=dt;
      if(E.invertT<=0){ E.invertT=0; GameModules.emit('mazeEvent',{kind:'invertEnd'}); }
      return;
    }
    if(E.cool>0){ E.cool=Math.max(0,E.cool-dt); E.stare=0; return; }
    var g=(!S.moving&&!VoidMaze.MZ.air)?gazeVoid():null;
    E.stare=g?E.stare+dt:0;
    if(E.stare<C.invert.stare) return;
    E.stare=0; E.invertT=C.invert.dur; E.cool=C.invert.cooldown;
    var p=VoidMaze.toScene(g.x,g.y);
    Playtest.event('彩蛋','反色');
    GameModules.emit('mazeEvent',{kind:'invert',dur:C.invert.dur,x:p.x,z:p.z,fy:S.floorY||0});
  }
  function spot(id){ for(var i=0;i<C.shadows.length;i++) if(C.shadows[i].id===id) return C.shadows[i]; return null; }
  function bearing(p,s){ return Math.atan2(s.z-p.z,s.x-p.x); }
  function tickShadows(dt){
    var p=VoidMaze.toScene(S.x,S.y), fy=S.floorY||0, s;
    if(E.active){
      var a=E.active; s=spot(a.id); a.t+=dt;
      var dist=Math.hypot(s.x-p.x,s.z-p.z), how=null;
      if(angDiff(bearing(p,s),S.ang)<0.24&&dist<20) a.look+=dt;
      if(a.look>=s.look) how='look';
      else if(s.near&&dist<s.near) how='near';
      else if(a.t>=s.timeout) how='time';
      if(how){
        E.seen[a.id]=1; E.active=null;
        GameModules.emit('mazeEvent',{kind:'shadowHide',id:a.id,how:how});
      }
      return;
    }
    for(var i=0;i<C.shadows.length;i++){
      s=C.shadows[i];
      if(E.seen[s.id]) continue;
      var z=s.zone;
      if(p.x<z[0]||p.x>z[1]||p.z<z[2]||p.z>z[3]||Math.abs(fy-z[4])>0.6) continue;
      if(angDiff(bearing(p,s),S.ang)>s.view) continue;
      E.active={id:s.id,t:0,look:0};
      Playtest.event('彩蛋','黑影:'+s.id);
      GameModules.emit('mazeEvent',{kind:'shadowShow',id:s.id,x:s.x,z:s.z,h:s.h,face:s.face,cue:s.cue});
      return;
    }
  }
  function tick(dt){
    if(!(dt>0)||S.dead||!VoidMaze.here()||!VoidMaze.MZ.ready||VoidMaze.MZ.respawning) return;
    tickInvert(dt);
    tickShadows(dt);
  }
  var own={owner:'void-maze-eggs'};
  GameModules.on('tick',tick,own);
  GameModules.on('leaveRoom',function(from,to){ if(from===MAZE_CFG.room&&to!==MAZE_CFG.room) reset(); },own);
  GameModules.on('reset',reset,own);                          /* 新局（GameModules.resetAll） */
  GameModules.on('boundary',reset,own);                       /* 新局 / 回菜单（Lifecycle.boundary） */
  return {E:E, reset:reset, gazeVoid:gazeVoid, spot:spot};
})();
