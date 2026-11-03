/* @module-capsule */
(function($imports){
/* Body sensation is presentation state, never a second source of player stats. */
'use strict';
var Sensory=(function(){
  var body=null,time=0,lastSan=null,beat=0,urgentAt=-100,breath=0,stage=0,stable=0;
  var view=$imports.SensoryRules.view(0,{}),handles=[];
  function hush(){handles.forEach(function(h){$imports.SoundPlayer.fade(h);});handles=[];}
  function sound(kind,k){handles=handles.filter(function(h){return h.end>h.gain.context.currentTime;});var h=$imports.SFX.bodySound(kind,k);if(h)handles.push(h);}
  function reset(){hush();body=null;lastSan=null;time=0;beat=0;urgentAt=-100;breath=0;stable=0;stage=0;view=$imports.SensoryRules.view(0,{});$imports.SoundCaptions.reset();}
  function frame(dt){
    var takeover=$imports.S.screen!=='play'||$imports.S.dead||$imports.PRO.on||$imports.CUT.on||$imports.PHONE.on||$imports.LESSON.on||$imports.TerminalUI.on||$imports.CarChase.active()||$imports.Elevator.inRide()||(0,$imports.roomClockFrozen)();
    var running=$imports.GamePolicy.simulationAllowed((0,$imports.gameInputContext)());
    if(body===null){body=$imports.SensoryRules.target($imports.S.san);lastSan=$imports.S.san;}
    if(!running||takeover){hush();view=$imports.SensoryRules.view(0,{takeover:true});return;}
    dt=Math.min(dt,.25);time+=dt;body=$imports.SensoryRules.step(body,$imports.S.san,dt);
    var threat=$imports.AN.active||$imports.Inspection.quiet()||$imports.PatrolWorld.localChase()||$imports.HIDE.on;
    view=$imports.SensoryRules.view(body,{distortion:$imports.SET.distortion,threat:threat,chase:$imports.PatrolWorld.localChase(),time:time});
    var next=$imports.StatRules.sanityStage($imports.S.san),changed=next!==stage;
    if(changed){stable+=dt;if(stable>=.5&&Math.abs($imports.S.san-[60,30,12][Math.min(stage,next)])>2){stage=next;stable=0;}}
    else stable=0;
    if($imports.S.san<=12&&lastSan>12&&time-urgentAt>45){
      urgentAt=time;
      if(!threat)(0,$imports.os)('我：先停一下……找个地方缓口气。',3.5);
      sound('muffled');
    }
    if(lastSan-$imports.S.san>=3){view.warp=Math.min(1,view.warp+.12*($imports.SET.distortion===2?1:$imports.SET.distortion===1?.35:0));}
    lastSan=$imports.S.san;
    breath-=dt;if(body>.08&&breath<=0){breath=6-body*2;sound('breath',threat?.25:.45+body*.25);}
    beat-=dt;
    if(view.bpm&&beat<=0){beat=60/view.bpm;sound($imports.PatrolWorld.localChase()?'chase':'heart',.35+body*.35);}
    if(!view.bpm)beat=0;
  }
  GameModules.on('frame',frame,{owner:'sensory'});
  GameModules.on('boundary',reset,{owner:'sensory'});GameModules.on('reset',reset,{owner:'sensory'});
  return {frame:frame,reset:reset,view:function(){return view;},state:function(){return {body:body,time:time,stage:stage};}};
})();

/* @module-exports */
GameModules.publish("game3d/js/modules/sensory/sensory.js",{
"Sensory":{get:function(){return Sensory;},set:function($value){Sensory=$value;}}
});
})(GameModules.imports("game3d/js/modules/sensory/sensory.js"));
