/* @module-capsule */
(function($imports){
/* 里世界 3D · 电梯里的「满员」（内部，计划《电梯直通、新天赋、新结局与恐怖氛围》第 6 节）
   彩蛋异常：照 CLAUDE.md 最高规则只写内部文档和测试，不进玩家 Wiki（tests/test_wiki_secrets.py 有禁止词）。
   触发：跨进轿厢的那一刻（电梯的 liftBoard 钩子）抽 1%，和「错误的电梯」互斥；写在乘梯记录上一起存档，读档不重抽。
     开局 60 秒（模拟秒）内、学生会检查待处理、异象进行中、巡察者正在本层追你时都不抽。
   线索：每节轿厢操纵盘旁都贴着「超载时，请最后进入的乘客离开。」（model/lift.js 的 liftNotice，平时就看得到）。
   过程：选了楼层、门关上要出发时（liftDepart 钩子）不出发：超载蜂鸣、显示屏跳成「满员」、门重新打开；
     灯一闪一闪，身后很多人在呼吸（字幕「〔身后 · 很近〕很多人在呼吸」）；门开着 6 秒，操纵盘按了没反应。
     · 走出去：门关上，电梯载着「满员」的轿厢自己往上走（指示灯在一个没有的楼层停了一下）。化解：+20、隐藏成就「最后一个进来的人」。
     · 留在里面：门关上，死亡演出「满员」（crowd-death.js）。
   画面（显示屏、灯、呼吸声）在 crowd-fx.js，只读这里的状态。数值不碰：不扣 SAN。 */
'use strict';

var LIFT_CROWD_CFG={chance:0.01, minRun:60, open:6, gone:1.2, beepAt:0, breathAt:0.7};
var LiftCrowd=(function(){
  var C=LIFT_CROWD_CFG, CR={run:0}, own={owner:'lift-crowd'};
  function st(){ return $imports.RT.liftCrowd||null; }
  function eligible(ride){
    if(!ride||ride.rare) return false;                                  /* 和错误的电梯互斥 */
    if(CR.run<C.minRun) return false;
    if($imports.AN.active) return false;
    if(typeof $imports.Inspection!=='undefined'&&$imports.Inspection.pending()) return false;
    if(typeof $imports.PatrolWorld!=='undefined'&&$imports.PatrolWorld.localChase&&$imports.PatrolWorld.localChase()) return false;
    return true;
  }
  function inCabinOf(c){
    var R=$imports.S.mode==='in'?$imports.INTERIORS[$imports.S.room]:null;
    return !!R&&R.host===c.host&&R.floor===c.floor&&$imports.Elevator.inCabin(R);
  }
  /* 门关上要出发时：满员。蜂鸣、显示屏、重新开门 */
  function start(ride,host){
    ride.crowd=2;
    $imports.RT.liftCrowd={phase:'full',host:host,floor:ride.origin,t:C.open,age:0,said:0};
    var lift=$imports.Elevator.state(host); lift.dir=1; lift.hold=C.open+1;
    (0,$imports.gameFact)('anomaly',{phase:'start',id:'crowd',name:'满员'});
    $imports.Playtest.event('满员',host+ride.origin);
    (0,$imports.os)('〔超载蜂鸣〕显示屏跳成了「满员」。门又开了。',3.2,$imports.OS_FORCE);
  }
  /* 走出去了：门关上，电梯自己走 */
  function resolve(c){
    c.phase='gone'; c.t=C.gone;
    var lift=$imports.Elevator.state(c.host); if(lift.door>0){ lift.dir=-1; lift.hold=0; }
    (0,$imports.gameFact)('anomaly',{phase:'end',id:'crowd',name:'满员',survived:true,lethal:false});
    $imports.Playtest.event('满员化解',c.host+c.floor);
  }
  function sendAway(c){
    var lift=$imports.Elevator.state(c.host);
    lift.phase='waiting'; lift.target=c.floor<5?5:1; lift.remaining=$imports.ELEVATOR_CONFIG.wait+Math.abs(lift.target-c.floor)*$imports.ELEVATOR_CONFIG.perFloor;
    lift.door=0; lift.dir=0; lift.hold=0;
    $imports.RT.liftCrowd=null;
    if($imports.S.mode==='in'&&$imports.S.room===c.host+c.floor) (0,$imports.os)('〔电梯〕门合上，它自己往上走了。楼层灯一格一格跳，在一个没有的楼层停了一下。',3.6);
  }
  function die(c){
    $imports.RT.liftCrowd=null;
    var ride=$imports.RT.elevatorRide; if(ride) ride.crowd=0;
    (0,$imports.kill)('电梯里一直很挤。','crowd','crowd');
    if(!$imports.S.dead) (0,$imports.gameFact)('anomaly',{phase:'end',id:'crowd',name:'满员',survived:false,saved:true});   /* 药丸、天赋、调试无敌挡下了：不算化解；人还在轿厢里，再按一次楼层照常出发 */
  }
  function tick(dt){
    if($imports.S.screen==='play'&&!$imports.S.dead) CR.run+=dt;
    var c=st(); if(!c) return;
    if(!(dt>0)||$imports.S.dead) return;
    c.age=(c.age||0)+dt;
    var lift=$imports.Elevator.state(c.host);
    if(c.phase==='gone'){
      c.t-=dt;
      if(inCabinOf(c)){ $imports.RT.liftCrowd=null; return; }                     /* 又走回去了：这一趟算新上的电梯，照常 */
      if(lift.door>0&&lift.dir===0){ lift.dir=-1; lift.hold=0; }          /* 门不等满 4 秒：人一出来就关（门口有人照样会重开） */
      if(c.t<=0&&lift.door<=0.001) sendAway(c);
      else if(c.t<=-4) sendAway(c);
      return;
    }
    if(!inCabinOf(c)){                                                   /* 出了轿厢（离开门槛、换了场景）：化解 */
      if(!$imports.RT.elevatorRide||$imports.RT.elevatorRide.host!==c.host||$imports.RT.elevatorRide.phase!=='cabin'){ resolve(c); return; }
    }
    if(!c.said&&c.age>=C.breathAt){ c.said=1; (0,$imports.os)('〔身后 · 很近〕很多人在呼吸。',4.2,$imports.OS_FORCE); }
    if(c.phase==='full'){
      c.t-=dt;
      if(lift.dir<0) lift.dir=1;                                          /* 6 秒里门一直开着 */
      lift.hold=Math.max(lift.hold,0.5);
      if(c.t<=0){ c.phase='closing'; lift.dir=-1; lift.hold=0; }
    }
  }

  GameModules.on('liftBoard',function(ride){
    if(!ride) return;
    ride.crowd=0;
    if(eligible(ride)&&$imports.GameRandom.next()<C.chance) ride.crowd=1;
  },own);
  GameModules.on('liftDepart',function(ride,host){
    var c=st();
    if(c&&c.host===host){
      if(c.phase==='closing'){ die(c); return true; }
      return c.phase!=='gone';
    }
    if(ride&&ride.crowd===1){ start(ride,host); return true; }
    return undefined;
  },own);
  GameModules.on('liftControls',function(){
    var c=st(); if(!c||c.phase==='gone') return undefined;
    (0,$imports.os)('〔操纵盘〕按下去没有反应。显示屏上还是「满员」。',2.6);
    return true;
  },own);
  GameModules.on('tick',tick,own);

  GameModules.persistent('lift-crowd',{
    save:function(){ return {run:CR.run}; },
    load:function(d){ CR.run=d&&Number.isFinite(d.run)?(0,$imports.clamp)(d.run,0,1e7):C.minRun; },   /* 旧存档：已经玩过一阵了 */
    reset:function(){ CR.run=0; }
  });

  /* 死因、墓志铭、复盘提示（演出在 crowd-death.js；死亡档案在 death-archive.js，标了 secret） */
  if(typeof $imports.DEATH_SOURCES!=='undefined') $imports.DEATH_SOURCES.crowd={cause:'电梯超载的时候，最后进来的人留在了里面。轿厢里明明只有自己。',hint:'满员的时候，最后进来的人要出去。'};
  if(typeof $imports.DEATH_HINTS!=='undefined') $imports.DEATH_HINTS.crowd='满员的时候，最后进来的人要出去。';
  if(typeof $imports.DFX_EPI!=='undefined') $imports.DFX_EPI.crowd='最后进来的，是我。';

  return {
    CR:CR, cfg:C, state:st, eligible:eligible,
    active:function(){ var c=st(); return !!c&&c.phase!=='gone'; },
    /* 测试和调试：让下一次关门就满员 */
    arm:function(){ var ride=$imports.RT.elevatorRide; if(ride&&ride.phase==='cabin'){ ride.rare=false; ride.crowd=1; return true; } return false; }
  };
})();

/* @module-exports */
GameModules.publish("game3d/js/modules/lift-crowd/crowd.js",{
"LIFT_CROWD_CFG":{get:function(){return LIFT_CROWD_CFG;},set:function($value){LIFT_CROWD_CFG=$value;}},
"LiftCrowd":{get:function(){return LiftCrowd;},set:function($value){LiftCrowd=$value;}}
});
})(GameModules.imports("game3d/js/modules/lift-crowd/crowd.js"));
