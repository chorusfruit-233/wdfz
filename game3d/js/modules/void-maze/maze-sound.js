/* @module-capsule */
(function($imports){
/* 里世界 3D · 虚空迷宫的环境声（模块 void-maze）：像太空里那种「空」
   校园的铺底、旋律、远处的怪声、上下课铃在迷宫里全部停掉（SFX.scape 的 bed:0、quiet:true），换成：
   · 极低的嗡声：36 Hz 和 36.6 Hz 两个正弦拍出很慢的起伏，再叠一点八度和十二度，过低通，振幅随 0.03 Hz 慢慢涨落；
   · 很深的底噪：低通到 180 Hz 的噪声，截止频率 0.017 Hz 慢慢漂，像隔着很厚的东西听见的风；
   · 偶尔一点「星光」：1.4–3.2 kHz 的正弦，2 秒淡入、慢慢淡出，几乎全进混响，九到二十多秒一次（声音库 void.ping）；
   · 很久一次：极远处一声低沉的、像人又不像人的长音（void.moan）。
   脚步换成「白色结构」（step.void，经 stepSurface 钩子）。
   大部分时间几乎什么都听不见——低 SAN 心跳、脚步、坠落的风声照常。随「音乐 / 环境」开关和音量。 */
'use strict';

var VOID_SOUND_CFG={level:0.075, ping:[9,24], moan:[40,90], drone:[[36,0.5],[36.6,0.45],[72.4,0.09],[108.9,0.035]]};

$imports.SFX.scape('void',{
  level:VOID_SOUND_CFG.level, bed:0, quiet:true,
  build:function(A){
    var a=A.ctx(); if(!a) return null;
    var g=a.createGain(); g.gain.value=0; g.connect(A.master());
    var rv=A.reverb(); if(rv){ var wet=a.createGain(); wet.gain.value=0.55; g.connect(wet); wet.connect(rv); }
    var lp=a.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=150; lp.Q.value=0.6; lp.connect(g);
    var swell=a.createGain(); swell.gain.value=0.7; swell.connect(lp);
    VOID_SOUND_CFG.drone.forEach(function(p){
      var o=a.createOscillator(); o.type='sine'; o.frequency.value=p[0];
      var og=a.createGain(); og.gain.value=p[1]; o.connect(og); og.connect(swell); o.start();
    });
    var lfo=a.createOscillator(); lfo.frequency.value=0.031; var lg=a.createGain(); lg.gain.value=0.28;
    lfo.connect(lg); lg.connect(swell.gain); lfo.start();
    var nb=A.loopNoise('lowpass',180,0.7); nb.g.gain.value=0.32; nb.g.connect(g);
    var nl=a.createOscillator(); nl.frequency.value=0.017; var nlg=a.createGain(); nlg.gain.value=70;
    nl.connect(nlg); nlg.connect(nb.f.frequency); nl.start();
    return {gain:g, nextPing:5+$imports.PresentationRandom.next()*6, nextMoan:25+$imports.PresentationRandom.next()*20};
  },
  tick:function(dt,A,n){
    n.nextPing-=dt;
    if(n.nextPing<=0){ var P=VOID_SOUND_CFG.ping; n.nextPing=P[0]+$imports.PresentationRandom.next()*(P[1]-P[0]); $imports.SoundPlayer.play('void.ping',{pan:$imports.PresentationRandom.next()*1.6-0.8,pitch:0.65+$imports.PresentationRandom.next()*0.8}); }
    n.nextMoan-=dt;
    if(n.nextMoan<=0){ var M=VOID_SOUND_CFG.moan; n.nextMoan=M[0]+$imports.PresentationRandom.next()*(M[1]-M[0]); $imports.SoundPlayer.play('void.moan',{pan:$imports.PresentationRandom.next()*1.2-0.6}); }
  }
});
GameModules.on('soundscape',function(){ return $imports.VoidMaze.here()?'void':undefined; },{owner:'void-maze'});
/* 脚下是白色结构：空心的「咚」，回声很长（声音库 step.void） */
GameModules.on('stepSurface',function(){ return $imports.VoidMaze.here()?'void':undefined; },{owner:'void-maze'});

/* @module-exports */
GameModules.publish("game3d/js/modules/void-maze/maze-sound.js",{
"VOID_SOUND_CFG":{get:function(){return VOID_SOUND_CFG;},set:function($value){VOID_SOUND_CFG=$value;}}
});
})(GameModules.imports("game3d/js/modules/void-maze/maze-sound.js"));
