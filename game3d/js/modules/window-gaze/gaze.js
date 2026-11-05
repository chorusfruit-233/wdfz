/* @module-capsule */
(function($imports){
/* 里世界 3D · 窗户内的视线（计划《规则怪谈、纸飞机与窗内视线》第 5 节，普通模式的本体异象，id window_gaze）
   · 只出现在真实的外墙窗上：窗的位置和 content/room-recipe.js 开窗的规则一样（行政楼、实验楼、宿舍、食堂、保安岗、器材室）。
   · 前兆：窗后有呼吸声（声音字幕「窗后 · 呼吸声」）；窗格里亮起一双很安静的眼睛，背后有个不动的人影。持续 WG.life 秒或你离开这间屋。
   · 接触：视线和它的夹角 < 12°、距离 2–18 米、中间没有墙，持续 0.35 秒 → 被吸住：视角被往窗口拉（限幅，持续往外拖就能挣开），
     SAN 每秒掉 2，连续盯 2 秒以后每秒掉 4（走 sanDrain，校庆减半）。
   · 脱离：低头超过 35° 或偏开超过 28° 持续 0.6 秒，或者被墙、门挡住（立刻断）。断开就不再掉 SAN，再看要重新累计。
   · 被它耗尽 SAN：死因「窗户内的视线」（window_gaze，专属死亡演出在 gaze-death.js）。药丸、免疫照旧挡一次（kill 里处理）。
   · 调度：开局 WG.first 运行秒后才可能有；之后每次间隔 WG.gap 秒区间里随机；遇到检查、追逐、别的异象、过场就往后排。
   表现只读：眼睛、人影在 frame 里摆；判定、拉视角、扣 SAN 在 tick。 */
'use strict';

var WG={first:240,gap:[300,480],life:28,near:2,far:18,cone:12,hold:0.35,breakAng:28,breakDown:35,breakHold:0.6,pull:1.1,drain:2,drainHard:4,hardAfter:2,eye:1.62};
var WindowGaze=(function(){
  var own={owner:'window-gaze'}, HOSTS={admin:1,lab:1,dormN:1,dormS:1,canteen:1,guard:1}, CACHE={};
  function st(){ var s=$imports.RT.windowGaze; if(!s||typeof s!=='object') s=$imports.RT.windowGaze={next:WG.first,ev:null,n:0,escaped:0}; return s; }
  function room(){ return $imports.S.mode==='in'?$imports.INTERIORS[$imports.S.room]:null; }
  /* 这间屋子外墙上的窗（和 room-recipe 一样的规则） */
  function windows(R){
    if(!R||!(HOSTS[R.host]||R.id==='gear1')) return [];
    if(CACHE[R.id]&&CACHE[R.id].grid===R.grid) return CACHE[R.id].list;
    var W=R.cols, H=R.rows, list=[];
    for(var side=0;side<2;side++){
      var rr=side?H-1:0, inner=side?H-2:1, nz=side?-1:1;
      for(var x=2;x<W-2;x+=3){
        if(R.grid[rr][x]!=='#'||R.grid[rr][x-1]!=='#'||R.grid[rr][x+1]!=='#') continue;
        var ic=R.grid[inner][x];
        if(ic==='#'||ic==='S'||R.grid[inner][x-1]==='#'||R.grid[inner][x+1]==='#') continue;
        if(R.grid[inner][x-1]==='S'||R.grid[inner][x+1]==='S'||ic==='O') continue;
        list.push({c:x,r:rr,nz:nz,x:R.ox+(x+0.5)*R.tw,y:R.oy+(side?(H-1):1)*R.th});
      }
    }
    CACHE[R.id]={grid:R.grid,list:list}; return list;
  }
  /* 玩家到窗之间有没有墙（门、办公室的高柜、上下铺也算挡） */
  var TALL={'#':1,'S':1,'=':1,'d':1,'K':1,'b':1,'f':1};
  function clear(R,w){
    var x0=($imports.S.x-R.ox)/R.tw, y0=($imports.S.y-R.oy)/R.th, x1=(w.x-R.ox)/R.tw, y1=(w.y-R.oy)/R.th+w.nz*0.15;
    var n=Math.ceil(Math.hypot(x1-x0,y1-y0)*3);
    for(var i=1;i<n;i++){ var t=i/n, c=Math.floor(x0+(x1-x0)*t), r=Math.floor(y0+(y1-y0)*t), ch=(R.grid[r]||[])[c]; if(TALL[ch]) return false; }
    return true;
  }
  function geom(w){
    var dx=(w.x-$imports.S.x)*$imports.U2M, dy=(w.y-$imports.S.y)*$imports.U2M, dz=WG.eye-($imports.EYE+($imports.S.floorY||0)), d=Math.hypot(dx,dy);
    var p=$imports.S.pitch||0, vx=Math.cos(p)*Math.cos($imports.S.ang), vy=Math.cos(p)*Math.sin($imports.S.ang), vz=Math.sin(p);
    var len=Math.hypot(d,dz)||1, dot=(vx*dx+vy*dy+vz*dz)/len;
    return {d:d, ang:Math.acos(Math.max(-1,Math.min(1,dot)))*180/Math.PI, yaw:Math.atan2(dy,dx), pitch:Math.atan2(dz,d)};
  }
  function busy(){
    if($imports.AN.active||$imports.CUT.on||$imports.PHONE.on||$imports.HIDE.on) return true;
    try{ if(typeof $imports.Inspection!=='undefined'&&$imports.Inspection.quiet()) return true; }catch(e){}
    try{ if($imports.PatrolWorld.localChase()) return true; }catch(e){}
    try{ if(typeof $imports.PaperPlane!=='undefined'){ var ps=$imports.PaperPlane.state(); if(ps.ev||(ps.calmUntil&&($imports.Mechanics?$imports.Mechanics.activePlaySeconds:0)<ps.calmUntil)) return true; } }catch(e){}   /* 纸飞机事件中、送回后 20 秒内不出 */
    return false;
  }
  function start(R){
    var cand=windows(R).filter(function(w){ var g=geom(w); return g.d>=WG.near+1&&g.d<=WG.far&&g.ang>25&&clear(R,w); });
    if(!cand.length) return false;
    var w=cand[Math.floor($imports.GameRandom.next()*cand.length)];
    var s=st(); s.n++; s.ev={room:R.id,c:w.c,r:w.r,t:0,contact:0,pull:0,away:0,pulled:0,id:'g'+s.n};
    try{ var g=geom(w); $imports.SoundCaptions.publish('threat.breath',{caption:'窗后 · 呼吸声',place:{pan:Math.sin(g.yaw-$imports.S.ang),m:g.d,behind:Math.cos(g.yaw-$imports.S.ang)<0}}); }catch(e){}
    (0,$imports.gameFact)('gaze',{what:'start'});
    return true;
  }
  function stop(why){
    var s=st(), e=s.ev; if(!e) return;
    if(e.pulled&&why!=='death'&&!e.escaped){ e.escaped=1; s.escaped++; (0,$imports.gameFact)('gaze',{what:'escape'}); }
    s.ev=null; s.next=($imports.Mechanics?$imports.Mechanics.activePlaySeconds:0)+WG.gap[0]+$imports.GameRandom.next()*(WG.gap[1]-WG.gap[0]);
    if(why==='end') (0,$imports.os)('我：窗玻璃上留下一块雾。雾上没有掌纹。',3.2);
  }
  function current(){ var e=st().ev, R=room(); if(!e||!R||R.id!==e.room) return null; var w=windows(R).filter(function(x){ return x.c===e.c&&x.r===e.r; })[0]; return w?{e:e,w:w,R:R}:null; }
  function tick(dt){
    if(!(dt>0)||$imports.S.dead||$imports.S.screen!=='play') return;
    var s=st(), R=room(), now=$imports.Mechanics?$imports.Mechanics.activePlaySeconds:0;
    if(!s.ev){
      if(R&&windows(R).length&&now>=s.next&&!busy()){ if(!start(R)) s.next=now+20; }
      return;
    }
    var cur=current(); if(!cur){ stop('left'); return; }
    var e=cur.e, w=cur.w; e.t+=dt;
    if(e.t>=WG.life&&!e.pull){ stop('end'); return; }
    var g=geom(w), see=clear(R,w)&&g.d>=WG.near&&g.d<=WG.far;
    if(!see){ if(e.pull) e.pull=0; e.contact=0; e.away=0; if(e.pulled) stop('blocked'); return; }
    if(!e.pull){
      e.contact=g.ang<WG.cone?e.contact+dt:0;
      if(e.contact>=WG.hold){ e.pull=0.001; e.pulled=1; (0,$imports.gameFact)('gaze',{what:'contact'}); (0,$imports.os)('我：……窗里有一双眼睛。我挪不开眼。',3,$imports.OS_FORCE); }
      return;
    }
    /* 被吸住：拉视角（限幅）、掉 SAN、看能不能挣开 */
    var away=g.ang>WG.breakAng||($imports.S.pitch||0)<-WG.breakDown*Math.PI/180;
    e.away=away?e.away+dt:0;
    if(e.away>=WG.breakHold){ stop('escape'); (0,$imports.os)('我：我低着头退开了。那双眼睛没有跟过来。',3); return; }
    e.pull+=dt;
    var k=Math.min(1,WG.pull*dt), dy=Math.atan2(Math.sin(g.yaw-$imports.S.ang),Math.cos(g.yaw-$imports.S.ang));
    if(!away){ $imports.S.ang+=Math.max(-k,Math.min(k,dy)); $imports.S.pitch=($imports.S.pitch||0)+Math.max(-k*0.6,Math.min(k*0.6,g.pitch-($imports.S.pitch||0))); }
    var rate=e.pull>WG.hardAfter?WG.drainHard:WG.drain;
    if(away) return;
    if($imports.S.san-rate*dt*$imports.DayEvents.drainMul()<=0){
      $imports.PlayerStats.setSan(0,'window_gaze');
      (0,$imports.kill)('窗里那双眼睛一直没有眨。我也是。','window_gaze','window_gaze');
      if($imports.S.dead) stop('death'); else stop('saved');
      return;
    }
    (0,$imports.sanDrain)(rate,dt,'window_gaze');
  }
  GameModules.on('tick',tick,own);
  GameModules.on('leaveRoom',function(){ if(st().ev) stop('left'); },own);
  GameModules.on('newGame',function(){ $imports.RT.windowGaze=null; },own);
  /* ---------- 表现：窗格里的眼睛和人影 ---------- */
  var F={grp:null,key:'',eyes:null};
  function clearFx(){ if(F.grp){ if(F.grp.parent) F.grp.parent.remove(F.grp); try{ $imports.ThreeBackend.disposeGroup(F.grp); }catch(e){} } F.grp=null; F.key=''; F.eyes=null; }
  function frame(){
    var cur=$imports.S.screen==='play'||$imports.S.screen==='cut'?current():null;
    var key=cur&&$imports.GLR.scene&&$imports.GLR.roomMesh?cur.e.id+':'+$imports.GLR.roomMesh.uuid:'';
    if(key!==F.key){ clearFx(); if(!key) return;
      var T=$imports.THREE, g=new T.Group(); g.name='window-gaze';
      var p=(0,$imports.worldToScene)(cur.w.x,cur.w.y,cur.R), z=p.z+cur.w.nz*0.16;      /* 贴着玻璃屋里这一面（窗帘、玻璃都挡不住） */
      var body=(0,$imports.figMesh)('person',new T.MeshBasicMaterial({color:0x0b0d0f,fog:false}),1); body.position.set(p.x,-0.05,p.z-cur.w.nz*0.35); body.rotation.y=cur.w.nz>0?0:Math.PI; g.add(body);
      var eyes=new T.Group(), em=new T.MeshBasicMaterial({color:0xe8e4d4,fog:false});
      [-0.045,0.045].forEach(function(dx){ var e=new T.Mesh(new T.SphereGeometry(0.014,10,8),em); e.scale.set(1.5,0.8,0.4); e.position.x=dx; eyes.add(e); });
      eyes.position.set(p.x,WG.eye,z); g.add(eyes);
      $imports.GLR.scene.add(g); F.grp=g; F.key=key; F.eyes=eyes;
    }
    if(F.eyes){ var me=(0,$imports.worldToScene)($imports.S.x,$imports.S.y,cur.R); F.eyes.lookAt(me.x,$imports.EYE,me.z); }   /* 眼睛跟着你 */
  }
  GameModules.on('frame',frame,own);
  GameModules.on('clearWorld',clearFx,own);
  GameModules.on('boundary',clearFx,own);
  if(typeof $imports.DEATH_SOURCES!=='undefined') $imports.DEATH_SOURCES.window_gaze={cause:'窗里那双眼睛一直盯着我，我一直没有移开视线，精神被它耗尽了。',hint:'窗后有呼吸声时，别直视那扇窗：低头、偏开，或者退到墙后面。'};
  if(typeof $imports.DEATH_HINTS!=='undefined') $imports.DEATH_HINTS.window_gaze='窗后有呼吸声时别直视，低头或退到墙后。';
  return {WG:WG, state:st, windows:windows, start:start, stop:stop, current:current, geom:geom, clear:clear, active:function(){ return !!current(); }};
})();

/* @module-exports */
GameModules.publish("game3d/js/modules/window-gaze/gaze.js",{
"WG":{get:function(){return WG;},set:function($value){WG=$value;}},
"WindowGaze":{get:function(){return WindowGaze;},set:function($value){WindowGaze=$value;}}
});
})(GameModules.imports("game3d/js/modules/window-gaze/gaze.js"));
