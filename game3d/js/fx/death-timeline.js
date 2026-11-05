/* @module-capsule */
(function($imports){
/* 死亡演出共用时钟；各效果仍负责自己的模型和动作。 */
'use strict';

var DeathTimeline=(function(){
  var durations={
    vignette:2,floor:3,grip:3.2,neck:3.4,shadow:3.2,swarm:3.2,drown:3.4,
    water:3.4,freeze:3.4,gaze:3.4,stare:3.2,voice:3.2,bell:3.4,follow:3.4,
    shatter:3.2,deep:3.4,ring:3.4,names:2,chalk:2,loop:3.4,twin:3.2,
    lamps:3.4,slit:3.6,squeeze:3.6,face:3,wall:2,laugh:3.2,mirror:2,hand:2,trash:3.6,
    liftdoor:4.4
  };
  function duration(type){return durations[type]||durations.vignette;}
  /* 模块登记自己的死亡演出时长（秒），和 DeathCG.register 配合 */
  function define(type,sec){ if(!type||!(sec>0)||!isFinite(sec)) return false; durations[type]=sec; return true; }
  function sample(type,elapsed){
    var total=duration(type), progress=Math.max(0,Math.min(1,elapsed/total));
    return {duration:total,progress:progress,
      phase:progress<0.2?'warning':progress<0.55?'contact':progress<0.86?'struggle':'end'};
  }
  return {durations:durations,duration:duration,sample:sample,define:define};
})();

/* @module-exports */
GameModules.publish("game3d/js/fx/death-timeline.js",{
"DeathTimeline":{get:function(){return DeathTimeline;},set:function($value){DeathTimeline=$value;}}
});
})(GameModules.imports("game3d/js/fx/death-timeline.js"));
