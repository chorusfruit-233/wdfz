/* @module-capsule */
(function($imports){
/* Body sensation is presentation state, never a second source of player stats. */
'use strict';
var Sensory=(function(){
  var body=null,time=0,lastSan=null,beat=0,urgentAt=-100,breath=0,stage=0,stable=0;
  /* 画面跟着身体走：呼吸声响起时画面往里一压（inhale），心跳声响起时视野一收（pulse）——都按声音触发的那一刻起算，
     所以画面和声音同一拍；静音也照样触发（声音字幕同理）。很低时一阵阵重影（ghost）、眼前一黑（black）。
     重影和黑屏的时机用表现层随机数，不碰玩法随机；开局、读档后至少 6 秒才会第一次黑屏 */
  var pulseT=9,inhaleT=9,ghostT=9,ghostDur=1,ghostNext=8,ghostA=0,ghostSpin=0;
  var blinkNext=6,blink=null,blinkT=0,black=0;
  var view=still($imports.SensoryRules.view(0,{})),handles=[];
  function hush(){handles.forEach(function(h){$imports.SoundPlayer.fade(h);});handles=[];}
  function sound(kind,k){handles=handles.filter(function(h){return h.end>h.gain.context.currentTime;});var h=$imports.SFX.bodySound(kind,k);if(h)handles.push(h);}
  function still(v){v.pulse=0;v.inhale=0;v.ghost=0;v.ghostDir=[1,0];v.black=0;return v;}
  function rnd(){return $imports.PresentationRandom.next();}
  function reset(){hush();body=null;lastSan=null;time=0;beat=0;urgentAt=-100;breath=0;stable=0;stage=0;pulseT=9;inhaleT=9;ghostT=9;ghostNext=8;
    blinkNext=6;blink=null;blinkT=0;black=0;view=still($imports.SensoryRules.view(0,{}));$imports.SoundCaptions.reset();}
  function frame(dt){
    var takeover=$imports.S.screen!=='play'||$imports.S.dead||$imports.PRO.on||$imports.CUT.on||$imports.PHONE.on||$imports.LESSON.on||$imports.TerminalUI.on||$imports.CarChase.active()||$imports.Elevator.inRide()||(0,$imports.roomClockFrozen)();
    var running=$imports.GamePolicy.simulationAllowed((0,$imports.gameInputContext)());
    if(body===null){body=$imports.SensoryRules.target($imports.S.san);lastSan=$imports.S.san;}
    if(!running||takeover){hush();blink=null;black=0;view=still($imports.SensoryRules.view(0,{takeover:true}));return;}
    dt=Math.min(dt,.25);time+=dt;body=$imports.SensoryRules.step(body,$imports.S.san,dt);
    var threat=$imports.AN.active||$imports.Inspection.quiet()||$imports.PatrolWorld.localChase()||$imports.HIDE.on;
    view=$imports.SensoryRules.view(body,{distortion:$imports.SET.distortion,reduceFlash:$imports.SET.reduceFlash,threat:threat,chase:$imports.PatrolWorld.localChase(),time:time});
    var next=$imports.StatRules.sanityStage($imports.S.san),changed=next!==stage;
    if(changed){stable+=dt;if(stable>=.5&&Math.abs($imports.S.san-[60,30,12][Math.min(stage,next)])>2){stage=next;stable=0;}}
    else stable=0;
    if($imports.S.san<=12&&lastSan>12&&time-urgentAt>45){
      urgentAt=time;
      if(!threat)(0,$imports.os)('我：先停一下……找个地方缓口气。',3.5);
      sound('muffled');
    }
    /* 一下子掉很多（≥ 3）：心跳立刻跳一下，声音和画面同一拍（只在有心跳的档位） */
    if(lastSan-$imports.S.san>=3)beat=0;
    lastSan=$imports.S.san;
    breath-=dt;if(body>.08&&breath<=0){breath=6-body*2;sound('breath',threat?.25:.45+body*.25);inhaleT=0;}
    beat-=dt;
    if(view.bpm&&beat<=0){beat=60/view.bpm;sound($imports.PatrolWorld.localChase()?'chase':'heart',.35+body*.35);pulseT=0;}
    if(!view.bpm)beat=0;
    /* 重影：越低越勤（身体强度 0.45 时约 11 秒一次，最低约 4 秒），每次 0.8–1.6 秒，错开的影子慢慢漂 */
    if(view.ghostMax>0){
      ghostNext-=dt;
      if(ghostNext<=0&&ghostT>=ghostDur){ghostT=0;ghostDur=.8+.8*rnd();ghostA=rnd()*6.2832;ghostSpin=(rnd()-.5)*1.6;
        ghostNext=(11-7*Math.min(1,(body-.45)/.45))*(.75+.5*rnd());}
    }else ghostNext=Math.max(ghostNext,2);
    /* 黑屏闪烁：一次最多两下（偶尔一次长的「眼前一黑」），两次之间至少 2.5 秒；「减少闪光」时慢慢暗下去、最多一半 */
    var raw=0;
    if(view.flickerK>0){
      if(blink){blinkT+=dt;raw=$imports.SensoryRules.blinkAt(blink,blinkT);if(blinkT>=$imports.SensoryRules.blinkEnd(blink))blink=null;}
      else{blinkNext-=dt;
        if(blinkNext<=0){blink=$imports.SensoryRules.blinkPlan(body,rnd);blinkT=0;raw=$imports.SensoryRules.blinkAt(blink,0);
          blinkNext=Math.max(2.5,view.flickerGap*(.7+.6*rnd()));}}
    }else{blink=null;blinkNext=Math.max(blinkNext,3);}
    black=$imports.SET.reduceFlash?black+(raw*view.flickerK-black)*Math.min(1,dt/.12):raw*view.flickerK;
    /* 心跳：响的那一刻最强，0.18 秒左右退下去（声音的「咚—咚」在 0.36 秒内）；
       呼吸：跟呼吸声的包络走（sound-bank 的 threat.breath 0.55 秒起到最响、1.5 秒落完），0.55 秒压到最深，1.6 秒回来 */
    view.pulse=view.pulseK*Math.exp(-pulseT/.18);
    view.inhale=inhaleT<.55?Math.sin(Math.PI/2*inhaleT/.55):inhaleT<1.6?Math.cos(Math.PI/2*(inhaleT-.55)/1.05):0;
    view.ghost=ghostT<ghostDur?view.ghostMax*Math.sin(Math.PI*ghostT/ghostDur):0;
    var ga=ghostA+ghostSpin*Math.min(ghostT,ghostDur);view.ghostDir=[Math.cos(ga),Math.sin(ga)];
    view.black=black;
    pulseT+=dt;inhaleT+=dt;ghostT+=dt;
  }
  GameModules.on('frame',frame,{owner:'sensory'});
  GameModules.on('boundary',reset,{owner:'sensory'});GameModules.on('reset',reset,{owner:'sensory'});
  return {frame:frame,reset:reset,view:function(){return view;},state:function(){return {body:body,time:time,stage:stage,blinking:!!blink,blinkNext:blinkNext};}};
})();

/* @module-exports */
GameModules.publish("game3d/js/modules/sensory/sensory.js",{
"Sensory":{get:function(){return Sensory;},set:function($value){Sensory=$value;}}
});
})(GameModules.imports("game3d/js/modules/sensory/sensory.js"));
