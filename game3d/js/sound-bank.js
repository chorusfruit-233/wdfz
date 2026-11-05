/* @module-capsule */
(function($imports){
/* 里世界 3D · 声音库（模块 audio，只有数据）
   2026-11-02 全部音效重做：所有一次性音效都写成配方，由 fx/sound-player.js 现场合成；不加载任何音频文件。
   · 每次播放都在范围里重新取值（[最小, 最大]），同一声不会两次一样；
   · 响度按类别统一：tools/sound_levels.py 离线渲染每个配方，量 K 加权的 100 毫秒最大响度，写进 sound-levels.js；
     每类有一个目标（SOUND_CATS.target，单位 dBFS），单个音效再用 lv 相对目标调高 / 调低；
   · 改了配方要重新跑 python tools/sound_levels.py，否则测试会提示响度表过期。
   配方格式见 fx/sound-player.js 文件开头。名字给调试面板「声音」页试听用。 */
'use strict';

var SOUND_CATS={
  ui:     {name:'界面',          target:-40},
  step:   {name:'脚步',          target:-49},
  foley:  {name:'动作与物件',    target:-36},
  world:  {name:'环境点缀',      target:-45},
  distant:{name:'远处 / 假威胁', target:-46},
  threat: {name:'威胁',          target:-31},
  event:  {name:'异象 / 天气 / 铃', target:-30},
  death:  {name:'死亡',          target:-26},
  scene:  {name:'演出',          target:-32},
  music:  {name:'音乐',          target:-34},
  void:   {name:'异空间',        target:-50}
};

/* 下课铃：四音钟声（C E D G，G D E C），像学校广播里的那一段 */
var BELL_TUNE=[523.25,659.26,587.33,392.00, 392.00,587.33,659.26,523.25];
var CHIME=[[1,1,1],[2,0.3,0.55],[3,0.1,0.3],[4.07,0.06,0.2],[5.4,0.035,0.12]];
var TINE=[[1,1,1],[2.01,0.14,0.4],[6.27,0.07,0.12]];
var STEEL=[[1,1,1],[2.76,0.6,0.6],[5.4,0.35,0.35],[8.93,0.2,0.2]];
/* 「一模一样」的脚步：无尽走廊用，没有任何随机变化 */
var SAME_STEP=[
  {t:'noise',f:1150,type:'bandpass',q:1.3,dur:0.045,g:0.5,atk:0.0012},
  {t:'noise',f:4200,type:'highpass',q:0.7,dur:0.01,g:0.18,atk:0.0006},
  {t:'tone',f:170,to:95,dur:0.06,g:0.08,atk:0.002}
];

var SOUND_BANK={
  'event.dismissal':{cat:'event',name:'放学长铃（一段 12 秒，响铃期间接着放，共六十秒）',lv:-5,layers:[
    {t:'bell',f:523.25,dur:4,g:.11,every:4,n:3,partials:CHIME},
    {t:'tone',f:392,dur:12.2,g:.009,atk:.5,type:'sine'}]},
