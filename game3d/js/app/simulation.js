/* @module-capsule */
(function($imports){
/* 应用组合根：保留既有固定步顺序，各子系统通过显式端口接线。 */
'use strict';
var AppSimulation=(function(){
  var stop=$imports.StepPipeline.STOP;
  function optional(name,fn){try{return fn();}catch(e){$imports.Lifecycle.report('simulation:'+name,e);}}
  var world=$imports.StepPipeline.create({begin:function(dt){$imports.Mechanics.begin(dt);ActiveEffects.begin(dt);},finish:function(dt){$imports.Mechanics.finish(dt);}});
  world.use('clock',function(dt){(0,$imports.clockTick)(dt);});
  world.use('patrol',function(dt){$imports.PatrolWorld.tick(dt);if($imports.S.dead)return stop;});
  world.use('placement',function(dt){(0,$imports.repairPlayerPlacement)(dt);$imports.Playtest.simulation(dt);});
  world.use('driving',function(dt){if($imports.CarChase.active()){$imports.Inspection.discardStale();$imports.CarChase.tick(dt);return stop;}});
  world.use('movement',function(dt){(0,$imports.updatePlayer)(dt);$imports.ExplorationMap.tick(dt);});
  world.use('extensions',function(dt){GameModules.emit('tick',dt);if($imports.S.dead||$imports.S.screen!=='play')return stop;});
  world.use('elevator',function(dt){
    if($imports.Elevator.inRide()){$imports.Inspection.discardStale();$imports.Elevator.tick(dt);(0,$imports.settleSan)();return stop;}
    $imports.Elevator.tick(dt);
  });
  world.use('phone',function(dt){optional('phone',function(){$imports.PHONE.tick(dt);});});
  world.use('search',function(dt){optional('search',function(){(0,$imports.searchTick)(dt);});});
  world.use('systems',function(dt){(0,$imports.updateSystems)(dt,true);});
  world.use('anomalies',function(dt){(0,$imports.anDrive)(dt);(0,$imports.settleSan)();});
  world.use('lesson',function(dt){$imports.LESSON.tick(dt);$imports.PHONE.checkInterrupt();});
  world.use('narrative',function(dt){optional('mono',function(){(0,$imports.monoTick)(dt);});optional('dread',function(){$imports.Dread.tick(dt);});});
  world.use('daily',function(){optional('talent',function(){$imports.Talent.tickWatch();});optional('day-events',function(){$imports.DayEvents.tick();});});
  world.use('pressure',function(){(0,$imports.spotTick)();$imports.CampusPressure.tick();(0,$imports.anNotifyWarning)((0,$imports.anwVisible)());});
  return Object.freeze({
    steps:function(){return world.names();},
    update:function(dt){
      if(document.hidden)return;
      $imports.PCGAME.tick(dt);(0,$imports.updateIntro)(dt);$imports.PHONE.checkInterrupt();$imports.TerminalUI.interrupt();$imports.LESSON.checkInterrupt();$imports.Speedrun.tick();
      var policy=(0,$imports.gameInputContext)();
      if(!$imports.GamePolicy.presentationAllowed(policy))return;
      $imports.VisualState.time+=dt;(0,$imports.updateDialog)(dt);
      if($imports.S.dead){$imports.S.deadT+=dt;optional('dead-camera',function(){(0,$imports.syncCamera)(dt);});return;}
      if(!$imports.GamePolicy.simulationAllowed(policy))return;
      return world.run(dt);
    }
  });
})();

var ActiveEffects={snackSeconds:0,begin:function(dt){this.snackSeconds=Math.min(dt,Math.max(0,$imports.S.snackT||0));$imports.S.snackT=Math.max(0,($imports.S.snackT||0)-dt);}};

/* @module-exports */
GameModules.publish("game3d/js/app/simulation.js",{
"AppSimulation":{get:function(){return AppSimulation;},set:function($value){AppSimulation=$value;}},
"ActiveEffects":{get:function(){return ActiveEffects;},set:function($value){ActiveEffects=$value;}}
});
})(GameModules.imports("game3d/js/app/simulation.js"));
