/* @module-capsule */
(function($imports){
/* 里世界 3D · 隐藏结局《盗梦空间》（内部彩蛋，计划 docs/plan/盗梦空间.md；不进玩家 Wiki）
   · 陀螺（top）：北宿舍二楼第一间宿舍的桌上，一局一个。
   · 睡觉（宿舍床「躺一会儿」，冷却结束以后）：
       上课时间：当天第一次在上课时去睡，抽一次 20%（每天只抽一次，用户确认）；没抽中，这一天上课时都睡不着（不花时间、不回 SAN）。
       真正睡着时，背包里有陀螺、今天还没进过梦：上课时 10%、不上课 5%（用户确认）进梦。没进梦就照常睡觉结算。
   · 梦（dream_top）：一座灰白的迷宫，有能看清边缘的黑坑。时间不走、不刷异象、没有巡察者。
       在梦里用陀螺：第一次转的时候抽 50%，结果固定（读档、再转都不变）——一直转（不倒）或倒下。
       不倒：掉进坑里（梦里死）→ 隐藏结局；走到出口，门后还是这条走廊。
       倒下：走到出口 → 隐藏结局；掉进坑里 → 在宿舍床上醒来，按两倍睡觉结算一次。
       还没转就掉下去：按失败（倒下）醒来（用户确认）。还没转就到出口：门把手转不动。
   · 失败醒来只结算一次：90 游戏分钟、SAN ＝ 普通睡觉在醒来那一刻的实际恢复 ×2（上限 100）、违规 +15（照现有豁免）、
     体力、200 分钟冷却和一次 rest 事实；结算编号存档，读档不重复。
   · 结局：triggerEnding('inception')，演出在 dream-cut.js。 */
'use strict';

var INCEPTION_CFG={classSleep:0.20,dreamClass:0.10,dreamFree:0.05,spinStand:0.5,failMinutes:90,sleepSan:26,failViolation:15,cooldown:200,
  room:'dream_top',topRoom:'dorm2',topCell:{c:5,r:3},fallTime:1.4};
var INCEPTION_MAZE=[
  '#######################',
  '#S....#.......#.......#',
  '#.###.#.#####.#.#####.#',
  '#.#...#.#ppp#...#...#.#',
  '#.#.###.#.p.#####.#.#.#',
  '#.#.....#.p.......#.#.#',
  '#.#######.#########.#.#',
  '#.....pp..#.......#...#',
  '#####.#####.#####.#####',
  '#.....#ppppp#...#.....#',
  '#.###.#.....#.#.#####.#',
  '#.#...#.###.#.#.......#',
  '#.#.###.#.#...#######.#',
  '#.#.....#.#ppp#.......#',
  '#.#######.#####.#####.#',
  '#.........#.........#E#',
  '#######################'];
var Inception=(function(){
  var own={owner:'inception'}, C=INCEPTION_CFG;
  var PITS={}, START=null, EXIT=null;
  INCEPTION_MAZE.forEach(function(row,r){ for(var c=0;c<row.length;c++){ var ch=row[c]; if(ch==='p') PITS[c+','+r]=1; if(ch==='S') START={c:c,r:r}; if(ch==='E') EXIT={c:c,r:r}; } });
  function st(){ var s=$imports.RT.inception; if(!s||typeof s!=='object') s=$imports.RT.inception={top:0,classDay:{},entered:{},dream:null,settled:{}};
    s.classDay=s.classDay||{}; s.entered=s.entered||{}; s.settled=s.settled||{}; return s; }
  function inDream(){ return $imports.S.mode==='in'&&$imports.S.room===C.room; }
  function classNow(){ var p=(0,$imports.periodAt)($imports.S.tsec); return p&&p[3]==='教室'&&!(0,$imports.isNight)(); }
  function rnd(){ return $imports.GameRandom.next(); }
  function R(){ return $imports.INTERIORS[C.room]; }
  function cellOf(){ var r=R(); return {c:Math.floor(($imports.S.x-r.ox)/r.tw),r:Math.floor(($imports.S.y-r.oy)/r.th)}; }
  function at(cell){ var r=R(); return {x:r.ox+(cell.c+0.5)*r.tw,y:r.oy+(cell.r+0.5)*r.th}; }
  /* ---------- 梦这间屋子 ---------- */
  GameModules.on('interiors',function(){
    var g=INCEPTION_MAZE.map(function(row){ return row.replace(/[pSE]/g,'.').split(''); });
    var r=(0,$imports.mkFloor)(C.room,'？？？','dream',1,g,false);
    r.noClock=true; r.noMap=true; r.noAnomaly=true;
  },own);
  /* ---------- 入睡 ---------- */
  function enterDream(){
    var s=st(), d=$imports.S.day;
    s.entered[d]=1;
    s.dream={day:d,spin:null,id:'d'+d+':'+Math.round($imports.S.tsec),from:{room:$imports.S.room,x:$imports.S.x,y:$imports.S.y,ang:$imports.S.ang,floorY:$imports.S.floorY||0},falling:0};
    (0,$imports.gameFact)('inception',{what:'enter'});
    (0,$imports.os)('我：我闭上眼睛。床板往下陷，陷得很深，一直往下。',4);
    try{ (0,$imports.fadeTo)(function(){ placeInDream(); }); }catch(e){ placeInDream(); }
  }
  function placeInDream(){
    (0,$imports.doEnterRoom)(C.room);
    var p=at(START); $imports.S.x=p.x; $imports.S.y=p.y; $imports.S.ang=0; $imports.S.floorY=0;
    try{ (0,$imports.syncCamera)(0); }catch(e){}
    try{ (0,$imports.autoSave)(); }catch(e){}
  }
  GameModules.on('restAct',function(key){
    if(key!=='sleep') return undefined;
    var s=st(), d=$imports.S.day, cls=classNow();
    if(cls){
      if(s.classDay[d]===undefined) s.classDay[d]=rnd()<C.classSleep?1:0;
      if(!s.classDay[d]){ (0,$imports.os)('我：我躺下了。隔着几栋楼也听得见上课的声音。我睡不着。',3.4); return true; }
    }
    if((0,$imports.hasItem)('top')&&!s.entered[d]&&rnd()<(cls?C.dreamClass:C.dreamFree)){ enterDream(); return true; }
    return undefined;
  },own);
  /* ---------- 陀螺 ---------- */
  function nearTop(){ var r=$imports.INTERIORS[C.topRoom]; return !!r&&$imports.S.mode==='in'&&$imports.S.room===C.topRoom&&!($imports.RT.inception||{}).top&&Math.hypot($imports.S.x-(r.ox+(C.topCell.c+0.5)*r.tw),$imports.S.y-(r.oy+(C.topCell.r+0.5)*r.th))<1.5*r.tw; }
  GameModules.on('hint',function(){
    if(nearTop()) return '桌上的陀螺';
    if(inDream()){ var c=cellOf(); if(EXIT&&Math.abs(c.c-EXIT.c)+Math.abs(c.r-EXIT.r)<=1) return '那扇门'; }
    return undefined;
  },own);
  GameModules.on('interact',function(){
    if(nearTop()){
      if(!(0,$imports.addItem)('top')) return true;          /* 背包满：东西留在桌上 */
      st().top=1; (0,$imports.os)('我：桌上有一个铜陀螺，底下磨得很亮。宿舍里没有人认它。',3.6); return true;
    }
    if(inDream()){ var c=cellOf(); if(EXIT&&Math.abs(c.c-EXIT.c)+Math.abs(c.r-EXIT.r)<=1){ atExit(true); return true; } }
    return undefined;
  },own);
  function spin(){
    var s=st(), dr=s.dream;
    if(!inDream()||!dr){ (0,$imports.os)('我：我在桌上转了一下陀螺。它转了一会儿，晃了晃，倒了。',3.4); return true; }
    if(!dr.spin){ dr.spin=rnd()<C.spinStand?'stand':'fall'; (0,$imports.gameFact)('inception',{what:'spin',spin:dr.spin}); try{ (0,$imports.autoSave)(); }catch(e){} }
    (0,$imports.os)(dr.spin==='stand'?'我：我蹲下来转陀螺。它转起来了，一直转，一直转，一点要停的意思都没有。':'我：我蹲下来转陀螺。它转了几圈，晃了晃，倒了。',4.4,$imports.OS_FORCE);
    return true;
  }
  GameModules.on('itemUse',function(id){ return id==='top'?spin():undefined; },own);
  GameModules.on('clockText',function(){ return inDream()?'??:??':undefined; },own);
  GameModules.on('mapBlocked',function(){ return inDream()?'我：这里没有地图。走廊一直在变。':undefined; },own);
  /* ---------- 出口和坑 ---------- */
  function atExit(asked){
    var dr=st().dream; if(!dr||dr.falling) return;
    if(!dr.spin){ if(asked) (0,$imports.os)('我：门把手转不动。……我还没确认过，这里是不是梦。',3.4); return; }
    if(dr.spin==='fall'){ succeed('exit'); return; }
    (0,$imports.os)('我：我推开门。门后面，还是这条走廊。',3.4,$imports.OS_FORCE);
    var p=at(START); $imports.S.x=p.x; $imports.S.y=p.y; try{ (0,$imports.syncCamera)(0); }catch(e){}
  }
  GameModules.on('tick',function(dt){
    if(!inDream()||$imports.S.dead||$imports.S.screen!=='play') return;
    var dr=st().dream; if(!dr){ wake(false); return; }
    if(dr.falling){
      dr.falling+=dt; $imports.S.eyeLift=-Math.min(6,dr.falling*dr.falling*4);
      if(dr.falling>=C.fallTime){ $imports.S.eyeLift=0; if(dr.spin==='stand') succeed('fall'); else wake(true); }
      return;
    }
    var c=cellOf();
    if(PITS[c.c+','+c.r]){ dr.falling=0.001; (0,$imports.gameFact)('inception',{what:'fall',spin:dr.spin||null}); (0,$imports.os)('我：脚下一空——',1.6,$imports.OS_FORCE); return; }
    if(EXIT&&c.c===EXIT.c&&c.r===EXIT.r) atExit(false);
  },own);
  /* ---------- 两种结局 ---------- */
  function succeed(how){
    var s=st(); s.dream=null; $imports.S.eyeLift=0;
    (0,$imports.gameFact)('inception',{what:'ending',how:how});
    try{ $imports.Speedrun.proof('inception'); }catch(e){}
    (0,$imports.triggerEnding)('inception');
  }
  function wake(fell){
    var s=st(), dr=s.dream, from=dr&&dr.from||{room:'dorm1',x:null,y:null};
    var id=dr?dr.id:null; s.dream=null; $imports.S.eyeLift=0;
    (0,$imports.doEnterRoom)(from.room);
    if(from.x!==null){ $imports.S.x=from.x; $imports.S.y=from.y; $imports.S.ang=from.ang||0; $imports.S.floorY=from.floorY||0; }
    try{ (0,$imports.syncCamera)(0); }catch(e){}
    if(id&&!s.settled[id]){
      s.settled[id]=1;
      (0,$imports.advanceGameTime)(C.failMinutes);
      var gain=$imports.CampusPressure.restGain(C.sleepSan)*2;
      $imports.PlayerStats.changeSan(gain,'inception',{max:100});
      $imports.PlayerStats.addViolation(C.failViolation,'inception',(0,$imports.onLeave)());
      (0,$imports.restoreStamina)(25);
      $imports.S.actCool=$imports.S.actCool||{}; $imports.S.actCool.sleep=(0,$imports.gameClock)()+C.cooldown;
      (0,$imports.gameFact)('rest',{key:'sleep'});
      (0,$imports.gameFact)('inception',{what:'wake',fell:!!fell});
      (0,$imports.os)('我：我猛地坐起来。还是宿舍的床。窗外的天色不对——我睡了很久。',4.6);
    }
    try{ (0,$imports.autoSave)(); }catch(e){}
  }
  /* ---------- 表现：坑的黑和边、出口的门、桌上的陀螺、转着的陀螺（只读状态） ---------- */
  var F={grp:null,top:null,spinner:null,room:''};
  function clear(){ if(F.grp){ if(F.grp.parent) F.grp.parent.remove(F.grp); try{ $imports.ThreeBackend.disposeGroup(F.grp); }catch(e){} } F.grp=null; F.top=null; F.spinner=null; F.room=''; }
  function topMesh(){
    var T=$imports.THREE, g=new T.Group(), m=new T.MeshLambertMaterial({color:0xb08a4a,emissive:0x2a1d0a});
    var body=new T.Mesh(new T.ConeGeometry(0.05,0.07,16),m); body.rotation.x=Math.PI; body.position.y=0.035; g.add(body);
    var cap=new T.Mesh(new T.CylinderGeometry(0.05,0.05,0.012,16),m); cap.position.y=0.075; g.add(cap);
    var stem=new T.Mesh(new T.CylinderGeometry(0.008,0.008,0.04,8),m); stem.position.y=0.1; g.add(stem); return g;
  }
  function build(){
    var T=$imports.THREE, g=new T.Group(); g.name='inception';
    if(inDream()){
      var r=R(), black=new T.MeshBasicMaterial({color:0x000000,fog:false}), rim=new T.MeshBasicMaterial({color:0xd8dde2,fog:false});
      Object.keys(PITS).forEach(function(k){ var a=k.split(','), w=at({c:+a[0],r:+a[1]}), p=(0,$imports.worldToScene)(w.x,w.y,r);
        var hole=new T.Mesh(new T.PlaneGeometry(1.0,1.0),black); hole.rotation.x=-Math.PI/2; hole.position.set(p.x,0.012,p.z); g.add(hole);
        [[0,-0.5,1,0.03],[0,0.5,1,0.03],[-0.5,0,0.03,1],[0.5,0,0.03,1]].forEach(function(e){ var nb=+a[0]+(e[2]<0.5?(e[0]<0?-1:1):0), nr=+a[1]+(e[3]<0.5?(e[1]<0?-1:1):0);
          if(PITS[nb+','+nr]) return; var s=new T.Mesh(new T.PlaneGeometry(e[2],e[3]),rim); s.rotation.x=-Math.PI/2; s.position.set(p.x+e[0],0.014,p.z+e[1]); g.add(s); });
      });
      if(EXIT){ var w2=at(EXIT), q=(0,$imports.worldToScene)(w2.x,w2.y,r), door=new T.Mesh(new T.BoxGeometry(0.9,2.05,0.06),new T.MeshLambertMaterial({color:0x6b5a44,emissive:0x1a140c}));
        door.position.set(q.x,1.03,q.z+0.47); g.add(door);
        var knob=new T.Mesh(new T.SphereGeometry(0.035,10,8),new T.MeshLambertMaterial({color:0xc9b27a,emissive:0x2a2414})); knob.position.set(q.x+0.32,1.0,q.z+0.43); g.add(knob); }
      F.spinner=topMesh(); F.spinner.visible=false; g.add(F.spinner);
    }else{
      var tr=$imports.INTERIORS[C.topRoom], tw=(0,$imports.worldToScene)(tr.ox+(C.topCell.c+0.5)*tr.tw,tr.oy+(C.topCell.r+0.5)*tr.th,tr);
      F.top=topMesh(); F.top.position.set(tw.x+0.1,0.76,tw.z); g.add(F.top);
    }
    $imports.GLR.scene.add(g); F.grp=g; F.room=$imports.S.room;
  }
  function frame(dt){
    var want=$imports.S.mode==='in'&&!!$imports.GLR.scene&&!!$imports.GLR.roomMesh&&$imports.S.screen!=='menu'&&(inDream()||($imports.S.room===C.topRoom&&!($imports.RT.inception||{}).top));
    if(!want){ if(F.grp) clear(); return; }
    if(!F.grp||!F.grp.parent||F.room!==$imports.S.room) { clear(); build(); }
    var dr=($imports.RT.inception||{}).dream;
    if(F.spinner){
      F.spinner.visible=!!(dr&&dr.spin);
      if(dr&&dr.spin){ var fx=Math.cos($imports.S.ang), fy=Math.sin($imports.S.ang), p=(0,$imports.worldToScene)($imports.S.x+fx*9,$imports.S.y+fy*9,R());
        F.spinner.position.set(p.x,0,p.z);
        if(dr.spin==='stand'){ F.spinner.rotation.set(0,F.spinner.rotation.y+(dt||0)*22,0); }
        else F.spinner.rotation.set(0,0,1.25); }
    }
  }
  GameModules.on('frame',frame,own);
  GameModules.on('clearWorld',clear,own);
  GameModules.on('boundary',clear,own);
  /* 冷启动：在梦里读档，但梦的状态没了（旧档、坏档）——醒回宿舍，不发奖励 */
  GameModules.on('enterRoom',function(id){ if(id===C.room&&!st().dream){ var s=st(); s.dream={day:$imports.S.day,spin:'fall',id:null,from:{room:'dorm1',x:null,y:null},falling:0}; } },own);
  return {CFG:C, state:st, inDream:inDream, classNow:classNow, enter:enterDream, spin:spin, wake:wake, succeed:succeed, PITS:PITS, START:START, EXIT:EXIT, at:at, nearTop:nearTop};
})();
if(typeof $imports.ITEMS!=='undefined'&&!$imports.ITEMS.top) $imports.ITEMS.top={n:'陀螺',d:'铜的，底下磨得很亮。在桌上转，它总会倒。'};

/* @module-exports */
GameModules.publish("game3d/js/modules/inception/dream.js",{
"INCEPTION_CFG":{get:function(){return INCEPTION_CFG;},set:function($value){INCEPTION_CFG=$value;}},
"INCEPTION_MAZE":{get:function(){return INCEPTION_MAZE;},set:function($value){INCEPTION_MAZE=$value;}},
"Inception":{get:function(){return Inception;},set:function($value){Inception=$value;}}
});
})(GameModules.imports("game3d/js/modules/inception/dream.js"));
