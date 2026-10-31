/* 死亡演出共用时钟；各效果仍负责自己的模型和动作。 */
'use strict';

var DeathTimeline=(function(){
  var durations={
    vignette:2,floor:2,grip:2.6,neck:3,shadow:2,swarm:2,drown:2,
    water:2,freeze:2,gaze:2.6,stare:2.6,voice:2,bell:2,follow:2.6,
    shatter:2,deep:2,ring:2.6,names:2,chalk:2,loop:2,twin:2,
    lamps:2.6,slit:2,squeeze:2,face:2,wall:2,laugh:2,mirror:2,hand:2
  };
  function duration(type){return durations[type]||durations.vignette;}
  function sample(type,elapsed){
    var total=duration(type), progress=Math.max(0,Math.min(1,elapsed/total));
    return {duration:total,progress:progress,
      phase:progress<0.2?'warning':progress<0.55?'contact':progress<0.86?'struggle':'end'};
  }
  return {durations:durations,duration:duration,sample:sample};
})();
