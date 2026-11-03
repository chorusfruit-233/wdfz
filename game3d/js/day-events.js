/* @module-capsule */
(function($imports){
/* 里世界 3D · 特殊校园日
   每个游戏日按本局种子定一次，记在 RT.dayEvents[day]，跟着存档走：读档、跳时、重开同一个存档都是同一个结果。
     校庆 anniversary —— 当天所有「每秒往下掉」的 SAN 速度减半（异象逐秒、巡察、危险区、车道上的东西、学生会注视），
                        一次性扣除、恢复、上限和 SAN 归零照旧；一局最多一次。教学楼正面挂横幅，早上有广播。
     占课 occupied   —— 音乐课、信息课被主科占了：琴房当天不开、机房暂停游戏活动；课桌上的短互动答对多回一点 SAN。
                        不加集合、不收外出登记、不改课表，也不动每天 1200 秒的连续探索预算。
   「当天」按上学的那一段算：07:20 到熄灯后 22:30 换日为止；前一晚的宿舍时间不算。第一天（11:40 开局的半天）不会是特殊日。
   概率、首个可能的日子和占课的具体内容都是实施取值，不是用户定下的数，集中在 DAY_EVENT_CFG。 */
'use strict';

var DAY_EVENT_CFG={
  firstDay:2,
  p:{anniversary:0.18, occupied:0.22},
  drain:{anniversary:0.5},
  occupied:{closed:['piano','pc'], lessonBonus:2}
};
var DAY_EVENT_DEF={
  anniversary:{n:'校庆', tag:'校庆日',
    say:'广播：「今天是我校建校纪念日。各班照常上课，课间可以去教学楼前看看校庆横幅。」——喇叭里的声音很高兴。我也跟着松了一点。'},
  occupied:{n:'占课', tag:'占课',
    say:'广播：「今天的音乐课、信息课改上数学，琴房暂停开放，机房暂停游戏活动，维护终端照常可用。」——教室里响起一片很轻的叹气。',
    closed:{piano:'我：琴房的门锁着。门上贴着一张纸：「今天的音乐课改上数学。」',
            pc:'我：今天机房暂停游戏活动。接线与维护终端仍可使用。'}}
};
function dayHash(seed,day){
  var h=(seed^Math.imul((day|0)+0x9e37,0x85ebca6b))>>>0;
  h^=h>>>13; h=Math.imul(h,0xc2b2ae35)>>>0; h^=h>>>16;
  return (h>>>0)/4294967296;
}
var DayEvents={
  seed:function(){
    if(!Number.isFinite($imports.RT.runSeed)) $imports.RT.runSeed=Math.floor($imports.GameRandom.next()*4294967296)>>>0;
    return $imports.RT.runSeed;
  },
  had:function(id){ var m=$imports.RT.dayEvents||{}; return Object.keys(m).some(function(k){ return m[k]===id; }); },
  roll:function(day){
    if(day<DAY_EVENT_CFG.firstDay) return 'none';
    var u=dayHash(DayEvents.seed(),day), p=DAY_EVENT_CFG.p, ev=$imports.RT.dayEvents||{};
    if(u<p.anniversary) return DayEvents.had('anniversary')?'none':'anniversary';
    if(u<p.anniversary+p.occupied) return ev[day-1]==='occupied'?'none':'occupied';   /* 不连着两天占课 */
    return 'none';
  },
  /* 当天还没定就定下来（只定一次） */
  ensure:function(){
    $imports.RT.dayEvents=$imports.RT.dayEvents||{};
    var d=$imports.S.day||1;
    if($imports.RT.dayEvents[d]===undefined) $imports.RT.dayEvents[d]=DayEvents.roll(d);
    return $imports.RT.dayEvents[d];
  },
  /* 上学的那一段（07:20–22:30）才算「当天」 */
  schoolHours:function(){ return $imports.S.tsec>=440&&$imports.S.tsec<$imports.LIGHTS_OUT+10; },
  today:function(){
    if(!DayEvents.schoolHours()) return 'none';
    var id=$imports.RT.dayEvents&&$imports.RT.dayEvents[$imports.S.day];
    return DAY_EVENT_DEF[id]?id:'none';
  },
  is:function(id){ return DayEvents.today()===id; },
  drainMul:function(){ var m=DAY_EVENT_CFG.drain[DayEvents.today()]; return Number.isFinite(m)?m:1; },
  closed:function(act){ return DayEvents.is('occupied')&&DAY_EVENT_CFG.occupied.closed.indexOf(act)>=0; },
  closedMsg:function(act){ return DAY_EVENT_DEF.occupied.closed[act]||'我：门锁着。'; },
  lessonBonus:function(){ return DayEvents.is('occupied')?DAY_EVENT_CFG.occupied.lessonBonus:0; },
  tag:function(){ var d=DAY_EVENT_DEF[DayEvents.today()]; return d?d.tag:''; },
  tick:function(){
    if($imports.S.screen!=='play'||$imports.S.dead) return;
    DayEvents.ensure();
    var id=DayEvents.today();
    $imports.RT.daySaid=$imports.RT.daySaid||{};
    if(id!=='none'&&!$imports.RT.daySaid[$imports.S.day]&&!($imports.S.intro>0)&&!(typeof $imports.PRO!=='undefined'&&$imports.PRO.on)){
      $imports.RT.daySaid[$imports.S.day]=1;
      (0,$imports.gameFact)('specialDay',{id:id});
      (0,$imports.os)(DAY_EVENT_DEF[id].say,6);
      try{ $imports.Playtest.event('特殊日',id); }catch(e){}
    }
    GameModules.emit('dayAppearance');
  },
  /* 旧存档：读进来的那一天不补特殊日（免得半天里突然变成校庆）；之后的日子照常按种子定 */
  afterLoad:function(d){
    var rt=d&&d.rt||{};
    if(!rt.dayEvents||typeof rt.dayEvents!=='object'){ $imports.RT.dayEvents={}; $imports.RT.dayEvents[$imports.S.day||1]='none'; }
    if(!Number.isFinite(rt.runSeed)){
      var src=String(d&&d.diff||'')+'|'+((rt.carPlates||[]).join(','))+'|'+(d&&d.day||1);
      var h=2166136261>>>0;
      for(var i=0;i<src.length;i++){ h^=src.charCodeAt(i); h=Math.imul(h,16777619)>>>0; }
      $imports.RT.runSeed=h;
    }
  }
};
/* 每秒往下掉的 SAN 统一走这里：速度 × 当天的倍率（校庆 0.5）。一次性扣除不要用它。 */
function sanDrain(rate,dt,source){ if(rate>0&&dt>0) $imports.PlayerStats.changeSan(-(dt*rate*DayEvents.drainMul()),source||'drain'); }   /* 写入走 PlayerStats（模块边界） */


/* @module-exports */
GameModules.publish("game3d/js/day-events.js",{
"DAY_EVENT_CFG":{get:function(){return DAY_EVENT_CFG;},set:function($value){DAY_EVENT_CFG=$value;}},
"DAY_EVENT_DEF":{get:function(){return DAY_EVENT_DEF;},set:function($value){DAY_EVENT_DEF=$value;}},
"dayHash":{get:function(){return dayHash;},set:function($value){dayHash=$value;}},
"DayEvents":{get:function(){return DayEvents;},set:function($value){DayEvents=$value;}},
"sanDrain":{get:function(){return sanDrain;},set:function($value){sanDrain=$value;}}
});
})(GameModules.imports("game3d/js/day-events.js"));
