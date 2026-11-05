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
  'event.dismissal':{cat:'event',name:'放学长铃 · 连续铃段',lv:-5,layers:[
    {t:'bell',f:523.25,dur:4,g:.11,every:4,n:2,partials:CHIME},
    {t:'tone',f:392,dur:8,g:.009,atk:.5,type:'sine'}]},
  'death.misread':{cat:'death',name:'念错了 · 回授与广播',layers:[
    {t:'noise',f:850,type:'bandpass',q:3,dur:3.4,g:.13,atk:.5},
    {t:'tone',f:220,to:146.83,dur:2.8,g:.1,atk:.3,type:'triangle'},
    {t:'noise',f:180,type:'lowpass',dur:.25,g:.4,at:1.1},
    {t:'noise',f:1200,type:'bandpass',q:1,dur:2,g:.11,atk:.7,at:1.4}]},
  /* ================= 界面 ================= */
  'ui.click':{cat:'ui',name:'按钮 / 确认',lv:-4,vary:{p:0.05,g:0.1},layers:[
    {t:'noise',f:3600,type:'bandpass',q:1.6,dur:0.014,g:0.5,atk:0.0008},
    {t:'tone',f:1900,to:1350,dur:0.045,g:0.12,atk:0.001},
    {t:'tone',f:620,to:480,dur:0.03,g:0.06,atk:0.001}]},
  'ui.blink':{cat:'ui',name:'屏幕亮起 / 眼前一闪',lv:-2,vary:{p:0.03,g:0.1},layers:[
    {t:'tone',f:1320,to:1760,glide:0.05,dur:0.16,g:0.1,atk:0.004},
    {t:'tone',f:2640,dur:0.08,g:0.03,atk:0.002},
    {t:'noise',f:5200,type:'highpass',q:0.7,dur:0.02,g:0.05}]},
  'ui.pickup':{cat:'ui',name:'拾取',lv:2,vary:{p:0.03,g:0.12},layers:[
    {t:'noise',f:2400,type:'bandpass',q:0.8,dur:0.14,g:0.22,atk:0.03},                 /* 衣料摩擦 */
    {t:'noise',f:900,type:'lowpass',q:0.7,dur:0.06,g:0.12,at:0.11},                     /* 放进包里的一下 */
    {t:'bell',f:1318.5,dur:0.6,g:0.05,at:0.04,partials:CHIME},
    {t:'bell',f:1760,dur:0.7,g:0.045,at:0.13,partials:CHIME}]},
  /* 成就（2026-11-03）：四档各一种，干、近、不做方位；避开上下课铃、钟声的旋律和巡察「两短一长」的节奏 */
  'ui.achieve.normal':{cat:'ui',name:'成就 · 普通（粉笔轻点）',lv:-2,vary:{p:0.03,g:0.08},layers:[
    {t:'noise',f:3200,type:'bandpass',q:3,dur:0.035,g:0.28,atk:0.001},                  /* 粉笔点在黑板上 */
    {t:'noise',f:900,type:'bandpass',q:1.4,dur:0.02,g:0.08},
    {t:'tone',f:1568,dur:0.34,g:0.05,at:0.03,atk:0.004}]},                              /* 一声很轻的高音 */
  'ui.achieve.elite':{cat:'ui',name:'成就 · 精英（两声上行钢片）',lv:0,vary:{p:0.02,g:0.08},layers:[
    {t:'bell',f:988,dur:0.38,g:0.06,partials:TINE},
    {t:'bell',f:1319,dur:0.5,g:0.06,at:0.14,partials:TINE}]},
  'ui.achieve.epic':{cat:'ui',name:'成就 · 史诗（失谐的玻璃和弦）',lv:2,vary:{p:0.01,g:0.06},layers:[
    {t:'bell',f:784,dur:1.4,g:0.04,partials:TINE},
    {t:'bell',f:991,dur:1.3,g:0.036,at:0.05,partials:TINE},                             /* 略高一点点：不完全和谐 */
    {t:'bell',f:1176,dur:1.25,g:0.032,at:0.1,partials:TINE},
    {t:'noise',f:6200,type:'highpass',q:0.7,dur:0.9,g:0.025,atk:0.2}]},                 /* 玻璃的沙沙尾音 */
  'ui.achieve.hidden':{cat:'ui',name:'成就 · 隐藏（倒放的低铃）',lv:0,vary:{p:0.01,g:0.06},layers:[
    {t:'tone',f:196,dur:1.15,g:0.09,atk:1.05},                                          /* 由弱到强，到头突然断开 */
    {t:'tone',f:293.7,dur:1.15,g:0.04,atk:1.05,type:'triangle',lp:1200},
    {t:'noise',f:420,type:'lowpass',dur:1.15,g:0.07,atk:1.05}]},
  /* 结算画面的评级（2026-11-03）：F–D、C–B、A–S、SS–SSS 四组 */
  'ui.grade.low':{cat:'ui',name:'评级 · F–D（闷的一声）',lv:2,layers:[
    {t:'tone',f:92,to:58,dur:0.38,g:0.26},
    {t:'noise',f:300,type:'lowpass',dur:0.22,g:0.28,atk:0.002}]},
  'ui.grade.mid':{cat:'ui',name:'评级 · C–B（纸和笔）',lv:-2,layers:[
    {t:'noise',f:2400,type:'bandpass',q:0.8,dur:0.26,g:0.2,atk:0.05},                    /* 翻纸 */
    {t:'noise',f:4200,type:'bandpass',q:3,dur:0.2,g:0.14,at:0.26,atk:0.02,am:[[22,30],0.6,'square']}]},   /* 笔尖划一道 */
  'ui.grade.high':{cat:'ui',name:'评级 · A–S（盖章）',lv:4,layers:[
    {t:'noise',f:900,type:'lowpass',dur:0.09,g:0.5,atk:0.001},                          /* 章落在纸上 */
    {t:'tone',f:140,to:88,dur:0.18,g:0.2},
    {t:'noise',f:1800,type:'bandpass',q:1,dur:0.05,g:0.14,at:0.02}]},
  'ui.grade.top':{cat:'ui',name:'评级 · SS–SSS（盖章后的长音）',lv:4,layers:[
    {t:'noise',f:900,type:'lowpass',dur:0.09,g:0.5,atk:0.001},
    {t:'tone',f:140,to:88,dur:0.18,g:0.2},
    {t:'tone',f:1318.5,dur:1.6,g:0.04,at:0.18,atk:0.02},                               /* 一声清亮的长音 */
    {t:'tone',f:1975.5,dur:1.4,g:0.014,at:0.22,atk:0.03}]},
  'ui.alarm':{cat:'ui',name:'警示',lv:6,layers:[
    {t:'tone',f:520,to:180,type:'square',lp:2400,dur:0.8,g:0.1},
    {t:'tone',f:530,to:185,type:'square',lp:2400,dur:0.8,g:0.06}]},

  /* ================= 脚步（opt.k 跑 / 远近，pan 方位，lp 背后发闷） ================= */
  'step.tile':{cat:'step',name:'脚步：瓷砖 / 水磨石',vary:{p:0.07,g:0.18},layers:[
    {t:'noise',f:[1050,1350],type:'bandpass',q:1.3,dur:0.045,g:0.5,atk:0.0012},         /* 鞋跟 */
    {t:'noise',f:4200,type:'highpass',q:0.7,dur:0.01,g:0.18,atk:0.0006},                /* 「嗒」 */
    {t:'tone',f:[150,190],to:95,dur:0.06,g:0.08,atk:0.002},                             /* 地面的闷响 */
    {t:'noise',f:[700,950],type:'bandpass',q:1.1,dur:0.04,g:0.22,at:[0.055,0.08]}]},    /* 前掌落下 */
  'step.stair':{cat:'step',name:'脚步：楼梯',vary:{p:0.06,g:0.18},layers:[
    {t:'tone',f:[120,150],to:72,dur:0.1,g:0.14,atk:0.002},
    {t:'noise',f:[700,900],type:'bandpass',q:1.0,dur:0.07,g:0.45,atk:0.0015},
    {t:'noise',f:3600,type:'highpass',q:0.7,dur:0.012,g:0.12},
    {t:'noise',f:1500,type:'bandpass',q:1.2,dur:0.05,g:0.15,at:[0.05,0.07]}]},          /* 鞋底蹭过台阶沿 */
  'step.garage':{cat:'step',name:'脚步：车库水泥',vary:{p:0.06,g:0.2},wet:0.6,layers:[
    {t:'noise',f:[780,950],type:'bandpass',q:1.0,dur:0.08,g:0.45,atk:0.0015},
    {t:'noise',f:[2500,3200],type:'bandpass',q:2,dur:0.03,g:0.16,n:3,every:[0.008,0.02],at:0.01},   /* 砂粒 */
    {t:'tone',f:[100,125],to:68,dur:0.08,g:0.1}]},
  'step.roof':{cat:'step',name:'脚步：天台碎石',vary:{p:0.05,g:0.18},layers:[
    {t:'noise',f:[2200,4400],type:'bandpass',q:1.6,dur:[0.02,0.04],g:0.3,n:[4,6],every:[0.012,0.03],decay:0.85},
    {t:'noise',f:600,type:'lowpass',q:0.7,dur:0.08,g:0.2}]},
  'step.grass':{cat:'step',name:'脚步：草地',vary:{p:0.08,g:0.2},layers:[
    {t:'noise',f:[2200,2800],type:'bandpass',q:0.5,dur:0.16,g:0.3,atk:0.04},
    {t:'noise',f:5200,type:'highpass',q:0.6,dur:0.015,g:0.1,n:3,every:[0.02,0.04],at:0.02},
    {t:'noise',f:300,type:'lowpass',dur:0.06,g:0.12}]},
  'step.track':{cat:'step',name:'脚步：塑胶跑道',vary:{p:0.06,g:0.18},layers:[
    {t:'noise',f:[280,340],type:'lowpass',q:0.9,dur:0.09,g:0.5,atk:0.003},
    {t:'tone',f:[85,100],to:60,dur:0.08,g:0.1},
    {t:'noise',f:1400,type:'bandpass',q:1,dur:0.03,g:0.06,at:0.05}]},
  'step.court':{cat:'step',name:'脚步：球场',vary:{p:0.06,g:0.18},layers:[
    {t:'noise',f:[1250,1550],type:'bandpass',q:1.4,dur:0.06,g:0.45,atk:0.0015},
    {t:'noise',f:3800,type:'highpass',dur:0.01,g:0.12},
    {t:'tone',f:140,to:90,dur:0.05,g:0.06}]},
  'step.squeak':{cat:'step',name:'球鞋「吱」一声',lv:-8,vary:{p:0.08},layers:[
    {t:'tone',f:[2200,2500],to:[2600,2900],dur:0.07,g:0.1,atk:0.01,vib:[38,0.02]}]},
  'step.road':{cat:'step',name:'脚步：水泥路',vary:{p:0.06,g:0.2},layers:[
    {t:'noise',f:[400,480],type:'lowpass',q:0.7,dur:0.11,g:0.5,atk:0.002},
    {t:'noise',f:[1600,2000],type:'bandpass',q:1.2,dur:0.05,g:0.14,at:[0.04,0.07],atk:0.01}]},
  'step.void':{cat:'step',name:'脚步：白色结构（异空间）',vary:{p:0.04,g:0.15},wet:0.9,layers:[
    {t:'noise',f:[620,760],type:'bandpass',q:2.2,dur:0.06,g:0.45,atk:0.0012},
    {t:'tone',f:[210,235],to:180,dur:0.22,g:0.06,atk:0.002},                            /* 空心的「咚」：底下是空的 */
    {t:'noise',f:5200,type:'highpass',dur:0.008,g:0.08}]},
  'step.wet':{cat:'step',name:'脚步：踩水（叠在脚步上）',lv:-3,vary:{p:0.1,g:0.2},layers:[
    {t:'noise',f:[1500,1900],type:'bandpass',q:0.8,dur:0.12,g:0.3,at:0.01,atk:0.02},
    {t:'noise',f:4200,type:'highpass',q:0.5,dur:0.05,g:0.1,at:0.04},
    {t:'tone',f:[500,800],to:[1100,1500],dur:0.05,g:0.03,at:0.03}]},

  /* ================= 动作与物件 ================= */
  'foley.door':{cat:'foley',name:'开门 / 进出房间',vary:{p:0.05,g:0.12},layers:[
    {t:'noise',f:2600,type:'bandpass',q:2,dur:0.02,g:0.4,atk:0.0008},                   /* 锁舌「咔」 */
    {t:'tone',f:1850,to:1500,dur:0.03,g:0.06,atk:0.0008},
    {t:'tone',f:[170,200],to:[230,260],type:'sawtooth',lp:1400,dur:0.5,g:0.05,at:0.08,atk:0.12,vib:[7,0.02],am:[[18,26],0.55]},   /* 合页「吱——」 */
    {t:'noise',f:[1000,1300],type:'bandpass',q:4,dur:0.45,g:0.07,at:0.08,atk:0.12,am:[[18,26],0.6]},
    {t:'noise',f:300,type:'lowpass',q:1,dur:0.14,g:0.35,at:0.66,atk:0.002},             /* 身后门关上 */
    {t:'tone',f:95,to:60,dur:0.16,g:0.12,at:0.66}]},
  'foley.stairs':{cat:'foley',name:'上下楼（一串台阶）',vary:{p:0.05,g:0.1},rep:{n:6,every:0.17,jit:0.012,decay:0.94},layers:[
    {t:'noise',f:[750,950],type:'bandpass',q:1.0,dur:0.07,g:0.4,atk:0.0015},
    {t:'tone',f:[120,145],to:75,dur:0.09,g:0.12},
    {t:'noise',f:1500,type:'bandpass',q:1.2,dur:0.04,g:0.12,at:0.05}]},
  'foley.chalk':{cat:'foley',name:'用粉笔画记号',lv:-4,vary:{p:0.08,g:0.12},rep:{n:[3,4],every:[0.2,0.3]},layers:[
    {t:'noise',f:[2600,3600],type:'bandpass',q:3,dur:[0.16,0.26],g:0.3,atk:0.03,am:[[26,40],0.7,'square']},   /* 一笔：断断续续的「嚓」 */
    {t:'noise',f:900,type:'bandpass',q:1.5,dur:0.03,g:0.1}]},                           /* 笔头点在面上 */
  'foley.wake':{cat:'foley',name:'惊醒 / 回过神',lv:2,layers:[
    {t:'noise',f:900,to:1500,type:'bandpass',q:0.9,dur:0.75,g:0.25,atk:0.4},            /* 猛吸一口气 */
    {t:'tone',f:220,to:110,dur:1.8,g:0.06,at:0.1,atk:0.3},
    {t:'tone',f:58,to:40,dur:0.2,g:0.25,at:0.55},                                       /* 一下心跳 */
    {t:'tone',f:52,to:36,dur:0.22,g:0.17,at:0.72}]},
  'foley.vanish':{cat:'foley',name:'远处的人影不见了',lv:-2,layers:[
    {t:'noise',f:1400,to:260,type:'bandpass',q:0.9,dur:0.5,g:0.12,atk:0.32},            /* 倒吸的风 */
    {t:'noise',f:150,type:'lowpass',dur:0.55,g:0.3,at:0.3,atk:0.02},
    {t:'tone',f:55,to:36,dur:0.8,g:0.18,at:0.3}]},
  'foley.cupFall':{cat:'foley',name:'水杯往下掉（风声和哨音）',lv:-2,len:1.2,layers:[
    {t:'tone',f:2200,to:650,dur:function(o){ return o.len; },g:0.05,atk:0.05,vib:[9,0.006]},
    {t:'noise',f:900,to:1600,type:'bandpass',q:1.2,dur:function(o){ return o.len; },g:0.2,atk:function(o){ return o.len*0.8; }}]},
  'foley.cupHit':{cat:'foley',name:'不锈钢水杯落地',lv:6,layers:[
    {t:'fm',f:[600,640],ratio:2.76,index:2.4,dur:1.4,g:0.12,idecay:0.3},                /* 「当」 */
    {t:'bell',f:620,dur:1.2,g:0.05,partials:STEEL},
    {t:'noise',f:1800,type:'bandpass',q:0.8,dur:0.16,g:0.4},
    {t:'noise',f:240,type:'lowpass',dur:0.45,g:0.35},
    {t:'tone',f:[1400,2400],type:'triangle',dur:0.05,g:0.06,n:4,every:[0.12,0.2],at:0.25,decay:0.7}]},   /* 杯盖滚开 */
  'foley.colaRattle':{cat:'foley',name:'易拉罐在高处磕碰、滚',lv:-6,len:1.6,layers:[
    {t:'noise',f:3200,type:'bandpass',q:2.2,dur:0.09,g:0.3},
    {t:'tone',f:[1700,2100],type:'triangle',dur:0.12,g:0.08,at:0.01},
    {t:'noise',f:[2400,3600],type:'bandpass',q:3,dur:0.035,g:0.14,n:9,at:0.18,every:function(o){ return Math.max(0.05,(o.len-0.45)/9); },decay:0.95},
    {t:'tone',f:[1300,1600],type:'triangle',dur:0.09,g:0.06,at:function(o){ return o.len*0.55; }}]},
  'foley.colaFall':{cat:'foley',name:'易拉罐翻滚着往下掉',lv:-4,len:1.2,layers:[
    {t:'noise',f:[1800,2600],type:'bandpass',q:2.5,dur:0.03,g:0.08,n:function(o){ return Math.max(1,Math.floor(o.len*9)); },every:1/9,decay:1.06},
    {t:'noise',f:700,to:1100,type:'bandpass',q:1.0,dur:function(o){ return o.len; },g:0.15,atk:function(o){ return o.len*0.85; }}]},
  'foley.colaHit':{cat:'foley',name:'易拉罐落地、泡沫嘶嘶',lv:5,layers:[
    {t:'noise',f:520,type:'lowpass',q:1.2,dur:0.16,g:0.5},
    {t:'noise',f:2600,type:'bandpass',q:1.4,dur:0.08,g:0.3,at:0.01},
    {t:'fm',f:[900,1100],ratio:1.41,index:1.5,dur:0.3,g:0.04},
    {t:'noise',f:5200,type:'highpass',q:0.6,dur:2.4,g:0.08,at:0.08,atk:0.05},
    {t:'tone',f:[900,1300],type:'triangle',dur:0.06,g:0.04,n:3,every:[0.2,0.3],at:0.3,decay:0.7}]},

  /* ================= 铃、天气 ================= */
  'event.bell':{cat:'event',name:'铃（小）',vary:{p:0.01},layers:[{t:'bell',f:220,dur:3.6,g:0.1,wet:0.3}]},
  'event.bigBell':{cat:'event',name:'钟楼大钟',lv:6,wet:0.7,vary:{p:0.005},layers:[
    {t:'bell',f:98,dur:6,g:0.14},
    {t:'noise',f:420,type:'lowpass',dur:0.09,g:0.25},                                   /* 钟锤 */
    {t:'tone',f:49,dur:5,g:0.05,atk:0.05}]},
  /* 上课铃：急促的电铃（锤子每秒敲二十下），响两秒半；下课铃：四音钟声。室外由调用处压低、发闷 */
  'event.bellStart':{cat:'event',name:'上课铃（电铃）',lv:-7,wet:0.6,layers:[
    {t:'tone',f:1046,dur:3.0,hold:2.3,g:0.1,atk:0.01,am:[20,0.85,'square']},
    {t:'tone',f:2887,dur:2.9,hold:2.3,g:0.05,atk:0.01,am:[20,0.85,'square']},
    {t:'tone',f:5650,dur:2.7,hold:2.3,g:0.02,atk:0.01,am:[20,0.85,'square']},
    {t:'noise',f:3400,type:'bandpass',q:2,dur:2.5,hold:2.3,g:0.06,atk:0.01,am:[20,0.95,'square']}]},
  'event.bellEnd':{cat:'event',name:'下课铃（钟声）',lv:-7,wet:0.6,layers:[
    {t:'bell',f:function(o,i){ return BELL_TUNE[i%8]*(i%8===7?(o.tail||1):1); },n:8,every:function(o,i){ return i===3?1.1:0.62; },dur:function(o,i){return i%8===7?2.4*(o.tailLength||1):2.4;},g:0.1,partials:CHIME}]},
  'event.thunder':{cat:'event',name:'近雷：炸裂再滚',lv:2,wet:0.6,layers:[
    {t:'noise',f:2400,type:'lowpass',q:0.7,dur:0.4,g:0.4,atk:0.003},                    /* 炸 */
    {t:'noise',f:[150,190],type:'lowpass',q:0.8,dur:3.8,g:0.5,at:0.05,atk:0.2,am:[[2.5,5],0.55]},   /* 滚 */
    {t:'noise',f:[95,120],type:'lowpass',q:1.2,dur:2.6,g:0.35,at:0.9,atk:0.5,am:[[1.5,3],0.5]},
    {t:'tone',f:38,to:30,dur:2.8,g:0.1,at:0.1}]},
  'event.thunderFar':{cat:'event',name:'远雷：闷闷的滚',lv:-8,wet:0.7,layers:[
    {t:'noise',f:[100,130],type:'lowpass',q:0.8,dur:3.4,g:0.5,atk:0.6,am:[[1.5,3],0.5]},
    {t:'noise',f:80,type:'lowpass',q:1.2,dur:2.4,g:0.3,at:0.9,atk:0.5},
    {t:'tone',f:34,to:28,dur:2.6,g:0.08,at:0.2,atk:0.4}]},

  /* ================= 异象开头（每次先有一声很低的下沉，再是各自的声音） ================= */
  'anomaly.base':{cat:'event',name:'异象开头：很低的一沉',lv:-2,layers:[
    {t:'tone',f:41,to:30,dur:2.6,g:0.3,atk:0.08},
    {t:'noise',f:110,type:'lowpass',dur:2.2,g:0.15,atk:0.6}]},
  'anomaly.end':{cat:'event',name:'异象结束：松下来',lv:-12,layers:[
    {t:'tone',f:330,to:320,dur:1.6,g:0.08,atk:0.3},
    {t:'noise',f:700,type:'lowpass',dur:1.2,g:0.05,atk:0.5}]},
  'anomaly.rain':{cat:'event',name:'大暴雨：像有人一桶一桶往下倒',layers:[
    {t:'noise',f:2500,type:'bandpass',q:0.5,dur:3.2,g:0.2,atk:1.6},
    {t:'noise',f:[700,900],type:'bandpass',q:0.6,dur:1.4,g:0.35,n:3,every:0.9,at:0.4,atk:0.5,am:[[3,5],0.4]},
    {t:'noise',f:180,type:'lowpass',dur:3.0,g:0.3,at:0.2,atk:0.3}]},
  'anomaly.moth':{cat:'event',name:'蛾群：一整面墙的扑翅',layers:[
    {t:'noise',f:[1500,2600],type:'bandpass',q:3,dur:0.05,g:0.2,n:30,every:[0.04,0.1],am:[[28,40],0.8]},
    {t:'noise',f:1800,type:'bandpass',q:0.8,dur:2.4,g:0.08,atk:1.2,am:[30,0.6]}]},
  'anomaly.turn':{cat:'event',name:'被拍肩膀：湿的手指',lv:-6,layers:[
    {t:'noise',f:900,type:'lowpass',dur:0.03,g:0.4,atk:0.001},
    {t:'noise',f:1400,type:'bandpass',q:2,dur:0.08,g:0.2,at:0.02},                      /* 湿 */
    {t:'noise',f:1200,to:1800,type:'bandpass',q:1.5,dur:0.6,g:0.1,at:0.15,atk:0.3}]},  /* 衣服蹭过 */
  'anomaly.broad':{cat:'event',name:'广播点名：叮咚、杂音、人声',layers:[
    {t:'bell',f:784,dur:1.2,g:0.08,partials:CHIME},
    {t:'bell',f:622,dur:1.6,g:0.08,at:0.45,partials:CHIME},
    {t:'noise',f:2200,type:'bandpass',q:1,dur:2.6,g:0.08,at:0.9,atk:0.2,am:[[7,11],0.5]},
    {t:'vowel',f:150,to:140,f1:620,f2:1800,f3:2600,vib:[7,0.04],dur:2.2,g:0.15,at:1.0,lp:3200},
    {t:'tone',f:100,dur:2.6,g:0.02,at:0.9,atk:0.1}]},
  'anomaly.bell13':{cat:'event',name:'钟敲十三下',layers:[
    {t:'bell',f:98,dur:4,g:0.12,n:13,every:1.12},
    {t:'noise',f:420,type:'lowpass',dur:0.09,g:0.15,n:13,every:1.12}]},
  'anomaly.exercise':{cat:'event',name:'操场做操：走了调的广播操',layers:[
    {t:'tone',f:function(o,i){ return [523,392,440,392,523,587,523,392][i%8]; },to:function(o,i){ return [523,392,440,392,523,587,523,392][i%8]*0.97; },type:'triangle',lp:2600,dur:0.4,g:0.06,n:16,every:0.55,atk:0.01},
    {t:'noise',f:800,type:'bandpass',q:2,dur:0.05,g:0.12,n:16,every:0.55},
    {t:'noise',f:2400,type:'bandpass',q:1,dur:8.8,g:0.02,atk:0.4}]},                    /* 喇叭的底噪 */
  'anomaly.bells':{cat:'event',name:'车棚齐鸣：几十个车铃',layers:[
    {t:'bell',f:[2200,3400],dur:0.5,g:0.04,n:24,every:[0.02,0.12],partials:[[1,1,1],[1.5,0.4,0.6],[2.6,0.3,0.4]]},
    {t:'fm',f:[2400,3000],ratio:1.5,index:1,dur:0.4,g:0.02,n:10,every:[0.08,0.2],am:[[18,24],0.8,'square']}]},
  'anomaly.hand':{cat:'event',name:'隔间递手：湿的手掌拍在地砖上',lv:-4,layers:[
    {t:'noise',f:280,type:'lowpass',dur:0.18,g:0.45,atk:0.004,at:0.2},
    {t:'noise',f:1300,type:'bandpass',q:2,dur:0.06,g:0.15,at:0.21},
    {t:'noise',f:[2400,3200],type:'bandpass',q:5,dur:0.5,g:0.06,at:0.5,atk:0.1,am:[[16,22],0.7]}]},   /* 指甲刮过地砖 */
  'anomaly.repeat':{cat:'event',name:'「你作业交了吗」：贴着后脑勺的气声',lv:-6,rep:{n:5,every:0.3,decay:0.92},layers:[
    {t:'vowel',f:140,voice:0,breath:1,f1:[1600,2000],f2:[2600,3000],fq:6,dur:0.25,g:0.3,atk:0.04}]},
  'anomaly.chalk':{cat:'event',name:'黑板上的字：粉笔自己在写',lv:-4,rep:{n:[5,7],every:[0.18,0.32]},layers:[
    {t:'noise',f:[2800,3800],type:'bandpass',q:4,dur:[0.12,0.25],g:0.3,atk:0.02,am:[[30,48],0.7,'square']},
    {t:'tone',f:[2400,3200],to:[2600,3400],type:'sawtooth',lp:4200,dur:0.15,g:0.006}]},
  'anomaly.loop':{cat:'event',name:'无尽的走廊：一模一样的脚步',rep:{n:8,every:0.45},layers:SAME_STEP},
  'anomaly.roster':{cat:'event',name:'被划掉的名字：纸和一道红笔',lv:-4,layers:[
    {t:'noise',f:3500,type:'highpass',q:0.5,dur:0.15,g:0.2,n:4,every:0.25,atk:0.03},
    {t:'tone',f:1600,to:1200,dur:0.5,g:0.03,at:1.1,vib:[24,0.02]},
    {t:'noise',f:2800,type:'bandpass',q:3,dur:0.5,g:0.1,at:1.1,atk:0.05}]},
  'anomaly.leak':{cat:'event',name:'天花板渗水：滴答越来越密',lv:-6,layers:[
    {t:'tone',f:[700,1000],to:[1500,2100],glide:0.03,dur:0.07,g:0.25,n:10,every:0.5,accel:0.85,atk:0.001}]},
  'anomaly.rite':{cat:'event',name:'实验楼仪式：低低的诵念和一点铃',layers:[
    {t:'vowel',f:98,f1:520,f2:860,f3:2400,vib:[1.5,0.01],breath:0.15,dur:3.2,g:0.25,atk:0.9},
    {t:'bell',f:1568,dur:2,g:0.03,at:1.5,partials:CHIME},
    {t:'noise',f:900,type:'bandpass',q:2,dur:2.6,g:0.03,atk:0.6,am:[[5,9],0.6]}]},     /* 蜡烛火苗 */
  'anomaly.cold':{cat:'event',name:'冷库：冰柜的嗡声，门缝里轻轻的敲',layers:[
    {t:'tone',f:60,dur:3,g:0.06,atk:0.5},
    {t:'tone',f:120,dur:3,g:0.03,atk:0.5},
    {t:'noise',f:300,type:'lowpass',q:2,dur:0.08,g:0.3,n:5,every:[0.5,0.7],at:0.4,decay:0.9},
    {t:'noise',f:[3500,5500],type:'highpass',dur:0.01,g:0.08,n:8,every:[0.05,0.3],at:0.2}]},   /* 结霜的细响 */
  'anomaly.shifting':{cat:'event',name:'窗外的楼在动：很低的摩擦',layers:[
    {t:'tone',f:36,to:31,type:'sawtooth',lp:180,dur:6,g:0.2,atk:1.2},
    {t:'noise',f:[70,90],type:'lowpass',q:2,dur:5.5,g:0.25,atk:1,am:[[0.6,1.2],0.5]},
    {t:'noise',f:600,type:'bandpass',q:3,dur:0.4,g:0.04,n:4,every:[0.9,1.6],at:0.8}]},
  'anomaly.stare':{cat:'event',name:'全体回头：几十个人同时转身',layers:[
    {t:'noise',f:[300,800],type:'lowpass',q:2,dur:0.14,g:0.12,n:24,every:[0,0.012],at:0.4},
    {t:'tone',f:[400,700],to:[350,600],dur:0.2,g:0.01,n:5,every:[0.01,0.04],at:0.42,vib:[20,0.02]}]},   /* 椅子吱一下 */
  'anomaly.lamps':{cat:'event',name:'走廊灯一盏一盏亮起来',layers:[
    {t:'noise',f:4000,type:'highpass',dur:0.03,g:0.3,n:5,every:0.5,pan:-0.7,panTo:0.7},
    {t:'tone',f:100,to:100,type:'square',lp:1500,dur:0.3,g:0.05,n:5,every:0.5,pan:-0.7,panTo:0.7}]},
  'anomaly.feast':{cat:'event',name:'食堂盛宴：碗筷轻碰，热气',layers:[
    {t:'bell',f:[2400,3200],dur:0.3,g:0.03,n:10,every:[0.1,0.4],partials:[[1,1,1],[2.4,0.3,0.4]]},
    {t:'noise',f:5000,type:'highpass',q:0.5,dur:3,g:0.03,atk:1}]},
  'anomaly.necker':{cat:'event',name:'围墙外的行人：脚步，和颈骨一节节响',layers:[
    {t:'noise',f:350,type:'lowpass',dur:0.1,g:0.3,n:6,every:0.6},
    {t:'noise',f:1800,type:'bandpass',q:3,dur:0.012,g:0.12,n:5,every:0.07,at:2.2}]},
  'anomaly.shadow':{cat:'event',name:'影子慢一拍',layers:[
    {t:'noise',f:500,type:'lowpass',dur:1.8,g:0.15,atk:1.6},
    {t:'noise',f:420,type:'lowpass',q:2,dur:0.06,g:0.2,n:2,every:0.5,at:0.3},
    {t:'noise',f:420,type:'lowpass',q:2,dur:0.06,g:0.12,n:2,every:0.5,at:0.55,lp:300}]},
  'anomaly.twin':{cat:'event',name:'天台的第二个你：脚步多了一份',layers:[
    {t:'noise',f:900,type:'bandpass',q:1.2,dur:0.07,g:0.3,n:6,every:0.5},
    {t:'noise',f:900,type:'bandpass',q:1.2,dur:0.07,g:0.2,n:6,every:0.5,at:0.25},
    {t:'noise',f:500,type:'bandpass',q:0.5,dur:2.5,g:0.04,atk:1}]},                     /* 天台的风 */
  'anomaly.raindots':{cat:'event',name:'雨点成字：落得太整齐',lv:-6,layers:[
    {t:'tone',f:[1100,1300],to:[1900,2200],glide:0.025,dur:0.06,g:0.2,n:12,every:0.25,atk:0.001}]},
  'anomaly.blackout':{cat:'event',name:'停电：继电器一个个跳开，嗡声沉下去',layers:[
    {t:'noise',f:1300,type:'bandpass',q:2,dur:0.03,g:0.3,n:5,every:[0.3,0.42],pan:-0.6,panTo:0.6},   /* 一个个灭 */
    {t:'tone',f:100,to:42,type:'square',lp:900,dur:2.2,g:0.05,atk:0.02},                           /* 灯管的嗡声往下沉 */
    {t:'tone',f:50,to:30,dur:2.4,g:0.08,at:0.2,atk:0.3}]},
  'anomaly.cola':{cat:'event',name:'天降可乐：很高的地方「哐啷」一声（远）',lv:-10,wet:1.2,layers:[
    {t:'fm',f:[1600,1900],ratio:1.41,index:1.2,dur:0.5,g:0.06},
    {t:'noise',f:3000,type:'bandpass',q:2,dur:0.06,g:0.12}]},
  'anomaly.cup':{cat:'event',name:'清华水杯：窗台上叮叮当当',lv:-4,len:0.9,layers:[
    {t:'tone',f:[2600,3400],type:'triangle',dur:0.06,g:0.12,n:7,at:0.04,every:function(o){ return Math.max(0.03,(o.len-0.08)/7); },jit:0.015}]},

  /* ================= 威胁 ================= */
  'threat.sting':{cat:'threat',name:'惊觉：不和谐的一下',layers:[
    {t:'tone',f:46,to:30,type:'sawtooth',lp:300,dur:1.2,g:0.3},
    {t:'tone',f:1250,to:800,type:'sawtooth',lp:3000,dur:0.7,g:0.03,vib:[7,0.01]},
    {t:'tone',f:1330,to:850,type:'sawtooth',lp:3000,dur:0.7,g:0.03,vib:[6.3,0.01]},
    {t:'tone',f:1405,to:900,type:'sawtooth',lp:3000,dur:0.65,g:0.02,at:0.02},
    {t:'noise',f:700,type:'lowpass',dur:0.4,g:0.2}]},
  'threat.precursor':{cat:'threat',name:'异象前兆：耳朵里的压力',lv:-2,layers:[
    {t:'tone',f:42,to:36,dur:2.8,g:0.4,atk:0.6},
    {t:'noise',f:120,type:'lowpass',dur:2.6,g:0.2,atk:1.6},
    {t:'tone',f:1180,to:1160,dur:2.2,g:0.01,at:0.6,atk:0.8}]},
  'threat.smileBack':{cat:'threat',name:'身后憋着的笑',lv:-20,rep:{n:5,every:[0.14,0.18],decay:0.92},layers:[
    {t:'vowel',f:[300,340],f1:500,f2:1700,vib:[4,0.02],breath:0.6,dur:0.14,g:0.3,atk:0.02}]},
  'threat.smileJump':{cat:'threat',name:'突脸：贴着耳朵的尖叫',lv:6,layers:[
    {t:'tone',f:46,to:28,type:'sawtooth',lp:260,dur:1.4,g:0.4},
    {t:'noise',f:2400,type:'bandpass',q:0.7,dur:0.5,g:0.35,atk:0.003},
    {t:'vowel',f:520,to:470,f1:900,f2:2600,f3:3400,vib:[30,0.05],breath:0.3,dur:0.9,g:0.3,atk:0.01},
    {t:'vowel',f:780,to:700,f1:1100,f2:3000,vib:[40,0.05],dur:0.8,g:0.2,at:0.02,atk:0.01}]},
  'threat.heartLow':{cat:'threat',name:'心跳（SAN 低）',lv:-4,layers:[
    {t:'tone',f:58,to:38,dur:0.18,g:0.5,atk:0.004},
    {t:'noise',f:120,type:'lowpass',dur:0.06,g:0.2},
    {t:'tone',f:52,to:34,dur:0.2,g:0.35,at:0.16,atk:0.004}]},
  'threat.heartPat':{cat:'threat',name:'心跳（被巡察者盯上）',lv:-2,layers:[
    {t:'tone',f:62,to:40,dur:0.16,g:0.5,atk:0.003},
    {t:'noise',f:140,type:'lowpass',dur:0.05,g:0.25},
    {t:'tone',f:55,to:36,dur:0.18,g:0.36,at:0.15,atk:0.003}]},

  /* ================= 远处 / 假威胁（opt.pan 方位，k 远近，lp 隔墙或背后发闷） ================= */
  'dread.knock':{cat:'distant',name:'敲门（三下）',vary:{p:0.06,g:0.12},rep:{n:3,every:[0.3,0.36],decay:0.9},layers:[
    {t:'noise',f:[260,300],type:'lowpass',q:2,dur:0.07,g:0.5,atk:0.001},
    {t:'tone',f:[130,150],to:95,dur:0.09,g:0.15,atk:0.001},
    {t:'noise',f:1800,type:'bandpass',q:1.5,dur:0.008,g:0.12}]},
  'dread.steps':{cat:'distant',name:'有人走过',vary:{p:0.05,g:0.1},rep:{n:[5,7],every:[0.41,0.46],decay:0.9,pan:[0,-0.3]},layers:[
    {t:'noise',f:[1000,1300],type:'bandpass',q:1.2,dur:0.05,g:0.5,atk:0.0012},
    {t:'tone',f:[150,180],to:95,dur:0.06,g:0.1},
    {t:'noise',f:[700,900],type:'bandpass',q:1.1,dur:0.04,g:0.2,at:0.065}]},
  'dread.chair':{cat:'distant',name:'楼上有人拖椅子',layers:[
    {t:'noise',f:[220,260],type:'lowpass',q:3,dur:0.7,g:0.4,atk:0.12,am:[[11,16],0.6]},
    {t:'tone',f:[520,640],to:[470,560],type:'sawtooth',lp:1800,dur:0.6,g:0.02,atk:0.1,vib:[13,0.03],am:[[11,16],0.7]},
    {t:'noise',f:600,type:'lowpass',q:2,dur:0.12,g:0.25,at:0.68}]},
  'dread.whisper':{cat:'distant',name:'低语',rep:{n:[6,8],every:[0.12,0.22]},layers:[
    {t:'vowel',f:120,voice:0,breath:1,f1:[700,1100],f2:[1700,2600],f3:[2800,3400],fq:5,dur:[0.12,0.3],g:0.3,atk:0.04}]},
  'dread.door':{cat:'distant',name:'一扇门慢慢被推开',layers:[
    {t:'tone',f:[90,100],to:[135,150],type:'sawtooth',lp:1200,dur:1.4,g:0.08,atk:0.3,vib:[6,0.03],am:[[7,11],0.6]},
    {t:'noise',f:[650,800],type:'bandpass',q:4,dur:1.2,g:0.12,at:0.1,atk:0.4,am:[[7,11],0.5]},
    {t:'noise',f:300,type:'lowpass',dur:0.15,g:0.15,at:1.35}]},                         /* 门碰到墙停住 */
  'dread.call':{cat:'distant',name:'远处有人喊',layers:[
    {t:'vowel',f:[220,280],to:[190,230],f1:500,f2:900,f3:2400,vib:[5.5,0.02],breath:0.2,dur:1.4,g:0.2,atk:0.3}]},
  'dread.run':{cat:'distant',name:'有人从一边跑到另一边',vary:{g:0.1},rep:{n:10,every:[0.16,0.18],pan:[-0.8,0.8]},layers:[
    {t:'noise',f:[450,600],type:'lowpass',q:2,dur:0.06,g:0.5,atk:0.002},
    {t:'tone',f:[95,115],to:70,dur:0.07,g:0.12}]},
  'dread.desk':{cat:'distant',name:'课桌被撞了一下',layers:[
    {t:'noise',f:[360,420],type:'lowpass',q:1.5,dur:0.06,g:0.5,atk:0.001},
    {t:'tone',f:[160,190],to:120,dur:0.1,g:0.12},
    {t:'noise',f:[280,330],type:'lowpass',q:2,dur:0.4,g:0.15,at:0.08,atk:0.1,am:[[12,18],0.5]}]},
  'dread.hum':{cat:'distant',name:'灯管留下的嗡声',lv:-10,layers:[{t:'tone',f:100,to:98,dur:3.4,g:.05,atk:.5},{t:'noise',f:240,type:'lowpass',dur:3.2,g:.015,atk:.5}]},
  'threat.breath':{cat:'threat',name:'近处呼吸',lv:-12,layers:[{t:'noise',f:600,type:'bandpass',q:.6,dur:1.5,g:.045,atk:.55}]},
  /* 电梯里的稀有事件（内部，modules/lift-crowd）：身后很多人在呼吸，一口接一口、左右都有，持续 6 秒左右 */
  'threat.crowd':{cat:'threat',name:'身后很近，很多人在呼吸',lv:-6,layers:[
    {t:'vowel',f:[105,150],voice:0,breath:1,f1:[480,820],f2:[1200,1900],fq:4,dur:[0.8,1.3],g:0.11,atk:0.35,n:15,every:[0.3,0.48],pan:function(o,i){ return ((i*37)%11)/5.5-1; }},
    {t:'noise',f:650,type:'bandpass',q:0.5,dur:6.2,g:0.04,atk:1.6,hold:3.4}]},
  /* 白天的校园底噪（氛围 A1，modules/atmosphere）：远处的鸟、车、操场的哨声，从第二天起一样一样消失 */
  'campus.bird':{cat:'world',name:'远处的鸟叫（白天）',lv:-10,vary:{p:0.12,g:0.2},layers:[
    {t:'tone',f:[2600,3400],to:[3200,4200],dur:0.09,g:0.03,n:[3,6],every:[0.12,0.3],wet:0.5}]},
  'campus.car':{cat:'world',name:'校外远远开过去一辆车（白天）',lv:-10,vary:{p:0.06,g:0.2},layers:[
    {t:'noise',f:280,to:420,type:'lowpass',q:0.7,dur:3.2,g:0.12,atk:1.3,wet:0.4},
    {t:'tone',f:62,to:74,dur:3.0,g:0.04,atk:1.2}]},
  'campus.whistle':{cat:'world',name:'操场上体育老师吹了两声哨（白天，很远）',lv:-10,vary:{p:0.03,g:0.2},layers:[
    {t:'tone',f:2900,type:'square',lp:3600,dur:0.18,g:0.02,atk:0.01,n:2,every:0.32,am:[[38,46],0.5],wet:0.8}]},
  'event.liftOverload':{cat:'event',name:'电梯超载蜂鸣（三声）',layers:[
    {t:'tone',f:2350,type:'square',lp:4200,dur:0.2,g:0.05,atk:0.004,n:3,every:0.34}]},
  'dread.radio':{cat:'distant',name:'收音机的杂音和人声',layers:[
    {t:'noise',f:1800,type:'bandpass',q:1.2,dur:1.8,g:0.25,atk:0.2,am:[[6,9],0.45]},
    {t:'vowel',f:150,f1:600,f2:1700,vib:[9,0.05],dur:1.6,g:0.12,at:0.2,lp:3200}]},
  'distant.slam':{cat:'distant',name:'远处一扇门被摔上',layers:[
    {t:'noise',f:180,type:'lowpass',q:1,dur:0.5,g:0.5,atk:0.002},
    {t:'tone',f:70,to:40,dur:0.6,g:0.2},
    {t:'noise',f:1200,type:'bandpass',q:1,dur:0.05,g:0.12}]},
  'distant.tinnitus':{cat:'distant',name:'耳鸣',lv:-8,layers:[
    {t:'tone',f:[1200,1280],to:[1160,1220],dur:2.4,g:0.05,atk:0.6},
    {t:'tone',f:[1290,1340],to:[1240,1290],dur:2.3,g:0.035,at:0.1,atk:0.7}]},
  'distant.aah':{cat:'distant',name:'很远的一声「啊——」',layers:[
    {t:'vowel',f:[220,260],to:[180,210],f1:750,f2:1150,f3:2600,vib:[6,0.03],breath:0.15,dur:1.6,g:0.25,atk:0.4}]},
  'distant.ball':{cat:'distant',name:'一个球在地上弹，越弹越快、越轻',rep:{n:9,every:0.42,accel:0.78,decay:0.82},layers:[
    {t:'noise',f:600,type:'lowpass',q:3,dur:0.05,g:0.5,atk:0.001},
    {t:'tone',f:[180,200],to:140,dur:0.06,g:0.1}]},
  'distant.giggle':{cat:'distant',name:'很轻的一串笑',rep:{n:4,every:[0.14,0.18],decay:0.9},layers:[
    {t:'vowel',f:[330,420],to:[300,380],f1:900,f2:1500,f3:2800,vib:[6,0.03],breath:0.4,dur:0.12,g:0.3,atk:0.02}]},

  /* ================= 环境点缀 ================= */
  'world.crackle':{cat:'world',name:'灯管接触不良：噼啪',vary:{g:0.15},layers:[
    {t:'noise',f:[3500,6500],type:'highpass',q:0.7,dur:0.018,g:0.4,n:[2,4],every:[0.02,0.05]},
    {t:'tone',f:100,to:98,type:'square',lp:1600,dur:0.14,g:0.06}]},
  'world.cricket':{cat:'world',name:'夜里的虫鸣',lv:-4,vary:{p:0.08,g:0.2},rep:{n:3,every:0.06},layers:[
    {t:'tone',f:4700,to:4600,dur:0.035,g:0.2,atk:0.004,am:[[180,240],0.6]}]},
  'world.drip':{cat:'world',name:'滴水',vary:{p:0.25,g:0.2},layers:[
    {t:'tone',f:[700,1000],to:[1500,2100],glide:0.03,dur:0.07,g:0.25,atk:0.001},
    {t:'noise',f:2500,type:'bandpass',q:2,dur:0.01,g:0.08}]},
  'world.patter':{cat:'world',name:'雨点打在伞面上',lv:-10,vary:{p:0.2,g:0.4},layers:[
    {t:'noise',f:[2400,4000],type:'bandpass',q:1.5,dur:0.02,g:0.3,atk:0.0008},
    {t:'tone',f:[1800,2600],dur:0.025,g:0.04}]},
  'world.chalkScratch':{cat:'world',name:'粉笔自己在写（一笔）',vary:{p:0.1,g:0.2},layers:[
    {t:'noise',f:[2800,3800],type:'bandpass',q:4,dur:[0.08,0.2],g:0.3,atk:0.02,am:[[30,48],0.7,'square']}]},
  'world.lampFlicker':{cat:'world',name:'灯管闪：啪 + 嗡',layers:[
    {t:'noise',f:4000,type:'highpass',dur:0.04,g:0.3},
    {t:'tone',f:120,to:118,type:'square',lp:1400,dur:0.25,g:0.06}]},
  'world.chant':{cat:'world',name:'很低的诵念声',lv:2,layers:[
    {t:'vowel',f:[98,110],f1:520,f2:860,f3:2400,vib:[1.5,0.01],breath:0.15,dur:3.2,g:0.25,atk:0.9},
    {t:'vowel',f:[146,165],f1:560,f2:900,vib:[1.2,0.01],dur:3.0,g:0.12,at:0.2,atk:1}]},
  'world.moth':{cat:'world',name:'蛾子扑翅',vary:{p:0.15,g:0.3},layers:[
    {t:'noise',f:[1400,2800],type:'bandpass',q:3,dur:[0.03,0.07],g:0.3,am:[[28,40],0.8]}]},
  'world.mothThump':{cat:'world',name:'一团蛾子撞过来',layers:[
    {t:'noise',f:[180,260],type:'lowpass',q:2,dur:0.12,g:0.4}]},
  'world.creak':{cat:'world',name:'暖气片 / 墙里「咔」一声',vary:{p:0.2},layers:[
    {t:'noise',f:1800,type:'highpass',q:1,dur:0.03,g:0.3},
    {t:'tone',f:[300,500],to:[250,400],dur:0.08,g:0.05}]},

  /* ================= 音乐 ================= */
  'music.piano':{cat:'music',name:'钢琴：一个音（opt.pitch = 频率 / 440）',len:1.5,layers:[
    {t:'tone',f:440,dur:function(o){ return o.len; },g:0.4,atk:0.004},
    {t:'tone',f:880,dur:function(o){ return o.len*0.6; },g:0.12,atk:0.003},
    {t:'tone',f:1320,dur:function(o){ return o.len*0.3; },g:0.04,atk:0.002},
    {t:'noise',f:3000,type:'bandpass',q:1,dur:0.02,g:0.05,p:false}]},
  'music.box':{cat:'music',name:'八音盒：一个音（opt.pitch = 频率 / 440）',lv:-10,layers:[
    {t:'bell',f:440,dur:2.6,g:0.3,partials:TINE},
    {t:'noise',f:5000,type:'highpass',dur:0.008,g:0.04,p:false}]},

  /* ================= 异空间（错误的电梯门外） ================= */
  'void.ping':{cat:'void',name:'极远处一点「星光」',lv:-6,vary:{p:0.25},layers:[
    {t:'tone',f:2200,dur:6,g:0.05,atk:2,vib:[0.15,0.004]}]},
  'void.moan':{cat:'void',name:'很远的一声长音',layers:[
    {t:'vowel',f:[52,68],to:[48,60],f1:240,f2:420,vib:[1.1,0.02],breath:0.1,dur:5.5,g:0.3,atk:1.6}]},
  'void.fall':{cat:'foley',name:'掉进虚空：风声越来越大，一下断掉',layers:[
    {t:'noise',f:500,to:2400,type:'bandpass',q:0.8,dur:1.4,g:0.3,atk:1.2},
    {t:'tone',f:160,to:40,dur:1.5,g:0.1,atk:0.2},
    {t:'noise',f:120,type:'lowpass',dur:0.5,g:0.25,at:1.35,atk:0.002}]},
  'void.thud':{cat:'event',name:'（内部）很低的一声闷响',lv:2,layers:[
    {t:'tone',f:46,to:28,dur:1.3,g:0.4,atk:0.004},
    {t:'noise',f:150,type:'lowpass',dur:0.45,g:0.2,atk:0.02}]},
  'void.gust':{cat:'void',name:'（内部）一阵很轻的风',layers:[
    {t:'noise',f:520,type:'bandpass',q:0.8,dur:0.7,g:0.2,atk:0.3}]},

  /* ================= 演出 ================= */
  'scene.engine':{cat:'scene',name:'车库：打火发动',layers:[
    {t:'tone',f:46,to:92,type:'sawtooth',lp:600,dur:1.3,g:0.25,am:[[16,20],0.6]},       /* 起动机 */
    {t:'noise',f:170,type:'lowpass',dur:3.2,g:0.35,at:0.9,atk:0.4,am:[[11,14],0.35]},   /* 着车后的低吼 */
    {t:'tone',f:92,to:140,type:'square',lp:500,dur:2.6,g:0.05,at:1.0,atk:0.3},
    {t:'noise',f:2200,type:'bandpass',q:2,dur:0.4,g:0.08,at:0.9}]},
  'scene.hum':{cat:'scene',name:'装置充能：嗡声越来越高',layers:[
    {t:'tone',f:110,to:330,dur:6,g:0.3,atk:1},
    {t:'tone',f:165,to:495,dur:6,g:0.15,at:0.5,atk:1},
    {t:'noise',f:900,to:2600,type:'bandpass',q:3,dur:6,g:0.12,atk:3},
    {t:'tone',f:55,to:110,dur:6,g:0.15,atk:2,am:[[4,9],0.3]}]},

  /* 《网安仙人》结局演出（modules/cyber-route/ending.js）：16 秒，和分镜的时间点对齐 */
  'scene.cyberEnd':{cat:'scene',name:'《网安仙人》结局：广播断在半句、机柜一架架停转、灯管不再闪、档案对照、天亮后的鸟叫和一遍下课铃',layers:[
    {t:'bell',f:784,dur:1.3,g:0.08,partials:CHIME,at:0.05,wet:0.4},                      /* 广播提示音「叮——咚」 */
    {t:'bell',f:622.25,dur:1.5,g:0.08,partials:CHIME,at:0.42,wet:0.4},
    {t:'vowel',f:[175,205],f1:[450,750],f2:[1000,1700],f3:2600,vib:[5,0.02],breath:0.15,dur:0.16,g:0.16,n:7,every:[0.13,0.16],at:0.98,lp:3200},   /* 说到一半 */
    {t:'noise',f:2500,type:'bandpass',q:0.8,dur:1.0,g:0.04,at:0.95,am:[[60,80],0.3]},   /* 喇叭底噪 */
    {t:'noise',f:1800,type:'bandpass',q:3,dur:0.02,g:0.3,at:1.95},                      /* 「咔」，断了 */
    {t:'noise',f:1600,to:220,glide:2.6,type:'bandpass',q:0.9,dur:3.0,g:0.12,atk:0.05},   /* 机柜风扇一架架停转 */
    {t:'tone',f:100,to:35,glide:2.8,dur:3.0,g:0.08,atk:0.05},
    {t:'noise',f:3200,type:'bandpass',q:4,dur:0.012,g:0.12,n:10,every:0.22,at:0.55,pan:-0.5,panTo:0.5},   /* 每架灭灯，继电器一声 */
    {t:'noise',f:5200,type:'highpass',dur:0.05,g:0.14,n:6,every:function(o,i){ return [0.18,0.43,0.18,0.43,0.18,0.43][i]; },at:3.3},   /* 灯管「两短一长」 */
    {t:'tone',f:100,dur:3.4,g:0.05,atk:0.1,at:3.25,am:[[3,4],0.5]},                     /* 灯管的嗡声，慢慢停 */
    {t:'tone',f:52,dur:0.3,g:0.18,atk:0.01,n:4,every:function(o,i){ return 0.75+i*0.25; },decay:0.7,at:3.4},   /* 心跳越来越慢，停了 */
    {t:'tone',f:880,dur:0.05,g:0.02,n:14,every:[0.1,0.16],at:7.35,lp:3000},             /* 档案一行行打出来 */
    {t:'noise',f:300,type:'lowpass',dur:0.18,g:0.25,atk:0.004,n:3,every:0.7,at:8.25},    /* 三处矛盾各「笃」一声 */
    {t:'tone',f:58,to:52,dur:2.6,g:0.07,atk:1.0,at:9.6},                                 /* 「签发节点：未知」 */
    {t:'noise',f:700,type:'lowpass',dur:4.6,g:0.07,atk:1.6,at:11.3},                     /* 天亮：风 */
    {t:'tone',f:[2600,3400],to:[3200,4200],dur:0.09,g:0.03,n:9,every:[0.25,0.6],at:11.9,pan:-0.4,panTo:0.5},   /* 鸟 */
    {t:'bell',f:523.25,dur:2.4,g:0.05,partials:CHIME,at:12.6,wet:0.8},                   /* 远处一遍普通的下课铃 */
    {t:'bell',f:659.26,dur:2.4,g:0.05,partials:CHIME,at:13.15,wet:0.8},
    {t:'bell',f:587.33,dur:2.4,g:0.05,partials:CHIME,at:13.7,wet:0.8},
    {t:'bell',f:392,dur:3.0,g:0.05,partials:CHIME,at:14.25,wet:0.8}]},

  /* ================= 死亡（先放 death.base，再按死因放各自的一段：先听见，再看见） ================= */
  'death.base':{cat:'death',name:'死亡：共同的下沉和尖鸣',lv:-3,layers:[
    {t:'tone',f:55,to:22,type:'sawtooth',lp:400,dur:2.2,g:0.35},
    {t:'noise',f:240,type:'lowpass',dur:1.6,g:0.25},
    {t:'tone',f:1500,to:900,type:'sawtooth',lp:3200,dur:0.9,g:0.03,at:0.05},
    {t:'tone',f:1590,to:960,type:'sawtooth',lp:3200,dur:0.9,g:0.03,at:0.05}]},
  'death.generic':{cat:'death',name:'死亡（通用）',layers:[
    {t:'tone',f:70,to:24,type:'sawtooth',lp:500,dur:1.6,g:0.4},
    {t:'noise',f:240,type:'lowpass',dur:1.4,g:0.3}]},
  'death.drown':{cat:'death',name:'溺：气泡往上冒，水灌进来',layers:[
    {t:'tone',f:[300,700],to:[900,1400],dur:0.12,g:0.08,n:14,every:[0.09,0.15],atk:0.005},
    {t:'noise',f:600,type:'lowpass',q:0.5,dur:2.4,g:0.3,atk:0.6,am:[[3,6],0.4]},
    {t:'vowel',f:70,f1:300,f2:600,vib:[8,0.1],breath:0.3,dur:1.6,g:0.1,at:0.6,atk:0.3}]},
  'death.swarm':{cat:'death',name:'蛾群：扑翅声把人裹住',layers:[
    {t:'noise',f:[1200,3000],type:'bandpass',q:3,dur:0.06,g:0.12,n:40,every:0.05,am:[[28,40],0.8]},
    {t:'noise',f:2000,type:'bandpass',q:0.7,dur:2.2,g:0.15,atk:1.4,am:[34,0.7]}]},
  'death.ring':{cat:'death',name:'仪式：诵念合上，铃响',layers:[
    {t:'vowel',f:98,f1:520,f2:860,f3:2400,vib:[1.5,0.01],breath:0.2,dur:3.4,g:0.3,atk:0.8},
    {t:'vowel',f:147,f1:600,f2:1000,vib:[1.5,0.01],dur:3.4,g:0.18,at:0.2,atk:0.8},
    {t:'bell',f:196,dur:3.2,g:0.1,at:0.4}]},
  'death.neck':{cat:'death',name:'长脖子：颈骨一节节拉长',layers:[
    {t:'noise',f:[200,500],type:'lowpass',q:4,dur:0.14,g:0.3,n:10,every:0.24},
    {t:'noise',f:1800,type:'bandpass',q:3,dur:0.012,g:0.15,n:10,every:0.24,at:0.03},
    {t:'tone',f:80,to:260,type:'sawtooth',lp:900,dur:2.4,g:0.08,at:0.3,atk:0.5}]},
  'death.laugh':{cat:'death',name:'笑声越来越高',layers:[
    {t:'vowel',f:function(o,i){ return 220+i*12; },f1:800,f2:1250,f3:2700,vib:[4,0.03],breath:0.3,dur:0.22,g:0.3,n:9,every:0.24,atk:0.03}]},
  'death.bell':{cat:'death',name:'钟：两下，压在头顶',layers:[
    {t:'bell',f:110,dur:5,g:0.18},
    {t:'bell',f:110,dur:5,g:0.14,at:1.4},
    {t:'tone',f:55,dur:4,g:0.08,atk:0.05}]},
  'death.voice':{cat:'death',name:'广播：杂音里叫你的名字',layers:[
    {t:'noise',f:2000,type:'bandpass',q:1.5,dur:1.6,g:0.25,am:[[8,12],0.5]},
    {t:'vowel',f:160,to:130,f1:600,f2:1700,f3:2600,vib:[6,0.04],dur:1.6,g:0.25,at:0.2,lp:3400}]},
  'death.follow':{cat:'death',name:'做操：整齐的脚步和哨',layers:[
    {t:'noise',f:300,type:'lowpass',dur:0.08,g:0.4,n:8,every:0.5},
    {t:'tone',f:function(o,i){ return i%4===0?440:330; },type:'square',lp:2200,dur:0.1,g:0.04,n:8,every:0.5}]},
  'death.lamps':{cat:'death',name:'灯一盏盏炸灭，最后一下砸下来',layers:[
    {t:'noise',f:5000,type:'highpass',dur:0.05,g:0.3,n:8,every:0.18,pan:-0.8,panTo:0.6},
    {t:'tone',f:100,type:'square',lp:1200,dur:0.2,g:0.04,n:8,every:0.18},
    {t:'noise',f:1200,type:'lowpass',dur:0.4,g:0.4,at:1.6}]},
  'death.gaze':{cat:'death',name:'被盯住：两道越来越高的尖音',layers:[
    {t:'tone',f:1800,to:2400,type:'sawtooth',lp:4000,dur:1.4,g:0.05,atk:0.3},
    {t:'tone',f:1900,to:2550,type:'sawtooth',lp:4000,dur:1.4,g:0.05,atk:0.3},
    {t:'noise',f:900,type:'bandpass',q:0.8,dur:0.5,g:0.1,at:0.9,atk:0.3}]},
  'death.stare':{cat:'death',name:'全体回头：几十个人一起转过来',layers:[
    {t:'noise',f:[300,900],type:'lowpass',q:2,dur:0.12,g:0.15,n:30,every:[0,0.008],at:0.6},
    {t:'tone',f:62,dur:1.2,g:0.12,at:0.8,atk:0.2}]},
  'death.freeze':{cat:'death',name:'冷库：冰碴一路结过来',layers:[
    {t:'tone',f:[2500,4500],dur:0.08,g:0.05,n:20,every:0.07},
    {t:'noise',f:[3500,6000],type:'highpass',dur:0.01,g:0.15,n:20,every:0.07,at:0.02},
    {t:'noise',f:200,type:'lowpass',dur:1.4,g:0.15,atk:0.8}]},
  'death.shatter':{cat:'death',name:'车铃：碎成一地',layers:[
    {t:'bell',f:[2000,5200],dur:0.3,g:0.05,n:26,every:0.03,partials:[[1,1,1],[1.5,0.4,0.6],[2.6,0.3,0.4]]},
    {t:'noise',f:4000,type:'highpass',dur:0.6,g:0.15,atk:0.005}]},
  'death.grip':{cat:'death',name:'被抓住：一下拽走，挣扎',layers:[
    {t:'noise',f:500,type:'lowpass',dur:0.25,g:0.45,atk:0.002},
    {t:'noise',f:250,type:'lowpass',q:2,dur:0.2,g:0.2,n:6,every:0.2,at:0.3},
    {t:'vowel',f:180,voice:0.4,breath:0.8,f1:700,f2:1200,dur:0.3,g:0.12,n:3,every:0.4,at:0.4}]},
  'death.hand':{cat:'death',name:'隔间递手：拖进去',layers:[
    {t:'noise',f:380,type:'lowpass',q:2,dur:0.5,g:0.25,at:0.15},
    {t:'noise',f:800,type:'bandpass',q:1.4,dur:0.18,g:0.35,at:0.9},
    {t:'tone',f:92,to:48,type:'sawtooth',lp:500,dur:0.7,g:0.1,at:1.05}]},
  'death.trash':{cat:'death',name:'第三个桶：桶盖、颠簸',layers:[
    {t:'noise',f:420,type:'lowpass',q:2,dur:0.35,g:0.35,at:0.3},
    {t:'fm',f:220,ratio:1.7,index:1.5,dur:0.6,g:0.06,at:0.3},
    {t:'noise',f:260,type:'lowpass',q:2,dur:0.25,g:0.35,at:1.35},
    {t:'noise',f:600,type:'bandpass',q:2,dur:0.1,g:0.4,n:2,every:0.35,at:2.0}]},
  'death.names':{cat:'death',name:'名单：很多人在念名字',layers:[
    {t:'vowel',f:[130,210],f1:[500,700],f2:[900,1300],vib:[2,0.02],breath:0.3,dur:0.3,g:0.15,n:12,every:0.12,pan:-0.7,panTo:0.7}]},
  'death.vignette':{cat:'death',name:'一圈呼吸声往里收',layers:[
    {t:'vowel',f:function(o,i){ return 92-i*4; },voice:0.3,breath:0.8,f1:320,f2:700,dur:0.9,g:function(o,i){ return 0.12+i*0.03; },n:5,every:0.42,atk:0.3},
    {t:'noise',f:160,type:'lowpass',dur:2.4,g:0.2,at:0.4,atk:1.4}]},
  'death.shadow':{cat:'death',name:'身后慢一拍的脚步，贴耳的气声',layers:[
    {t:'noise',f:420,type:'lowpass',q:2,dur:0.07,g:0.35,n:6,every:function(o,i){ return i%2?0.32:0.4; }},
    {t:'vowel',f:180,voice:0.2,breath:1,f1:700,f2:2100,vib:[9,0.03],dur:1.4,g:0.15,at:1.6}]},
  'death.water':{cat:'death',name:'滴水越来越密，最后一口灌进来',layers:[
    {t:'tone',f:[900,1500],to:[400,700],dur:0.07,g:0.1,n:16,at:0,every:function(o,i){ return 2.2*(Math.pow((i+1)/16,0.6)-Math.pow(i/16,0.6)); }},
    {t:'noise',f:500,type:'lowpass',q:0.8,dur:1.6,g:0.35,at:1.9,atk:0.4}]},
  'death.deep':{cat:'death',name:'往下掉的风声，很远的一声闷响',layers:[
    {t:'noise',f:900,to:2000,type:'bandpass',q:0.7,dur:1.8,g:0.25,atk:1.2},
    {t:'tone',f:160,to:40,dur:1.8,g:0.12},
    {t:'noise',f:120,type:'lowpass',dur:0.4,g:0.4,at:2.0}]},
  /* 没关上的门（巡察者挡门，演出 fx/death-cg.js 的 liftdoor，时间点和画面对齐） */
  'death.liftdoor':{cat:'death',name:'电梯门：门机嗡着往里合，门外的脚步越来越急；手指扣住门边，门被一下一下扒开；灯闪一下熄掉；很远一声「叮」，门合上',layers:[
    {t:'tone',f:118,to:96,type:'sawtooth',lp:700,dur:1.15,g:0.07,atk:0.08,am:[[11,13],0.3]},                    /* 门机 */
    {t:'noise',f:900,type:'bandpass',q:1.3,dur:0.06,g:function(o,i){ return 0.12+i*0.04; },n:5,every:0.26,accel:0.8,pan:0.2},   /* 门外的脚步越来越急 */
    {t:'noise',f:260,type:'lowpass',dur:0.12,g:0.45,atk:0.002,at:1.17},                                          /* 手指扣住门边，门一顿 */
    {t:'tone',f:70,to:48,dur:0.3,g:0.18,atk:0.002,at:1.17},
    {t:'noise',f:[1600,1900],type:'bandpass',q:3,dur:0.3,g:0.16,atk:0.05,n:2,every:0.45,at:1.72,am:[[28,36],0.6,'square']},   /* 门被扒开，金属一下一下刮 */
    {t:'tone',f:150,to:110,type:'sawtooth',lp:800,dur:0.9,g:0.06,atk:0.1,at:1.75},
    {t:'noise',f:3000,type:'bandpass',q:5,dur:0.01,g:0.12,n:3,every:function(o,i){ return i===1?0.14:0.08; },at:2.9},   /* 灯：两短一长，熄掉 */
    {t:'tone',f:49,to:40,dur:1.2,g:0.12,atk:0.5,at:2.6},
    {t:'bell',f:1318.5,dur:2.2,g:0.03,partials:CHIME,at:3.65,wet:0.9},                                           /* 很远一声「叮」 */
    {t:'noise',f:300,type:'lowpass',dur:0.25,g:0.2,atk:0.02,at:4.15}]},                                          /* 门合上 */
  /* 满员（内部，演出在 modules/lift-crowd/crowd-death.js，时间点和画面对齐） */
  'death.crowd':{cat:'death',name:'满员：蜂鸣突然停了；很多人的呼吸贴上来，衣服蹭着肩膀；楼层灯一格一格往上跳；门开了，很远一声「叮」',layers:[
    {t:'tone',f:2350,type:'square',lp:4200,dur:0.12,g:0.05,atk:0.004},                                          /* 最后半声蜂鸣，断了 */
    {t:'vowel',f:[105,150],voice:0,breath:1,f1:[480,820],f2:[1200,1900],fq:4,dur:[0.7,1.1],g:function(o,i){ return 0.05+i*0.012; },atk:0.3,n:9,every:0.2,at:0.85,pan:function(o,i){ return ((i*37)%11)/5.5-1; }},
    {t:'noise',f:2400,type:'bandpass',q:0.9,dur:0.5,g:0.05,atk:0.15,n:4,every:0.36,at:1.1,pan:function(o,i){ return i%2?0.6:-0.6; }},   /* 衣服蹭着肩膀 */
    {t:'tone',f:58,to:44,dur:2.0,g:0.12,atk:0.8,at:1.0},
    {t:'tone',f:[1700,1800],type:'square',lp:3000,dur:0.03,g:0.03,n:6,every:0.17,at:2.2},                    /* 楼层灯一格一格往上跳 */
    {t:'noise',f:300,type:'lowpass',dur:0.3,g:0.18,atk:0.03,at:3.3},                                           /* 门开 */
    {t:'bell',f:1318.5,dur:2.2,g:0.03,partials:CHIME,at:3.45,wet:0.9}]},                                       /* 很远一声「叮」 */
  /* 虚空迷宫里的两种死法（演出在 modules/void-maze/maze-death.js，时间点和画面对齐） */
  'death.void':{cat:'death',name:'异空间·迷失：停下以后身后又响一步；门合上，「叮」，门缝的光一格格熄掉',layers:[
    {t:'noise',f:[640,720],type:'bandpass',q:2.2,dur:0.06,g:function(o,i){ return i===2?0.5:0.4; },atk:0.0012,n:3,every:function(o,i){ return i?0.44:0.34; },at:0.08,pan:function(o,i){ return i===2?0.55:0; }},
    {t:'tone',f:[214,232],to:180,dur:0.22,g:0.06,atk:0.002,n:3,every:function(o,i){ return i?0.44:0.34; },at:0.08,pan:function(o,i){ return i===2?0.55:0; },wet:0.5},
    {t:'tone',f:82,to:46,dur:0.5,g:0.16,atk:0.03,at:1.05},                          /* 门合成一道缝 */
    {t:'noise',f:320,type:'lowpass',dur:0.4,g:0.12,atk:0.12,at:1.0},
    {t:'bell',f:1318.5,dur:1.8,g:0.045,partials:CHIME,at:1.08,pan:0.6,wet:0.7},       /* 身后很远：「叮」 */
    {t:'bell',f:1318.5,dur:1.8,g:0.035,partials:CHIME,at:1.9,pan:-0.6,wet:0.8},       /* 另一边又一声 */
    {t:'noise',f:2600,type:'bandpass',q:3,dur:0.012,g:0.16,n:6,every:0.15,at:2.2,pan:-0.5,panTo:0.5},   /* 门缝的光一格格熄掉 */
    {t:'tone',f:150,to:90,dur:0.06,g:0.05,n:6,every:0.15,at:2.2},
    {t:'noise',f:2200,type:'bandpass',q:3,dur:0.014,g:0.22,at:3.12},                 /* 最后一扇 */
    {t:'tone',f:130,to:70,dur:0.1,g:0.07,at:3.12},
    {t:'tone',f:49,to:41,dur:1.6,g:0.12,atk:0.9,at:1.9},
    {t:'bell',f:1318.5,dur:2.6,g:0.018,partials:CHIME,at:3.3,wet:1}]},               /* 黑了以后，很远的地方又「叮」一声 */
  'death.abyss':{cat:'death',name:'异空间·坠落：风声越来越大，方块擦身而过，手电一声咔哒，「咚」',layers:[
    {t:'noise',f:420,to:2600,glide:2.9,type:'bandpass',q:0.7,dur:3.06,g:0.32,atk:1.6,hold:1.3},   /* 风，一直到落地那一下断掉 */
    {t:'noise',f:140,type:'lowpass',dur:3.0,g:0.18,atk:1.0,hold:1.8,am:[[5,7],0.4]},
    {t:'tone',f:150,to:38,dur:2.8,g:0.1,atk:0.4},
    {t:'noise',f:1400,to:500,type:'bandpass',q:1.2,dur:0.3,g:0.18,atk:0.1,n:3,every:function(o,i){ return i?0.9:0.45; },at:1.0,pan:-0.2,panTo:-0.6},   /* 同一块方块，三次擦身而过（最后一次贴着左脸） */
    {t:'noise',f:3200,type:'bandpass',q:4,dur:0.01,g:0.14,at:2.5},                   /* 下面那个人按亮手电 */
    {t:'tone',f:2400,dur:0.015,g:0.03,at:2.5},
    {t:'noise',f:[600,680],type:'bandpass',q:2,dur:0.09,g:0.55,atk:0.002,at:3.12,wet:0.9},   /* 空心的「咚」 */
    {t:'tone',f:210,to:150,dur:0.4,g:0.12,atk:0.003,at:3.12,wet:0.9},
    {t:'tone',f:52,to:30,dur:0.8,g:0.25,atk:0.004,at:3.12}]},
  'death.chalk':{cat:'death',name:'粉笔一下一下刮',layers:[
    {t:'noise',f:function(o,i){ return 3600+i*300; },type:'bandpass',q:8,dur:0.35,g:0.25,n:4,every:0.5,am:[[30,44],0.7,'square']},
    {t:'tone',f:function(o,i){ return 2600+i*180; },to:function(o,i){ return 2900+i*200; },type:'sawtooth',lp:4500,dur:0.3,g:0.012,n:4,every:0.5}]},
  'death.loop':{cat:'death',name:'同一串脚步，一次比一次近',layers:[
    {t:'noise',f:950,type:'bandpass',q:1.2,dur:0.07,g:function(o,i){ return 0.15+i*0.05; },n:10,every:0.45,accel:0.82}]},
  'death.twin':{cat:'death',name:'自己的脚步多了一份，差半拍',layers:[
    {t:'noise',f:600,type:'lowpass',q:1.5,dur:0.07,g:0.35,n:6,every:0.5},
    {t:'noise',f:600,type:'lowpass',q:1.5,dur:0.07,g:0.35,n:6,every:0.5,at:0.09}]},
  'death.slit':{cat:'death',name:'门缝慢慢被推开',layers:[
    {t:'tone',f:140,to:95,type:'sawtooth',lp:900,dur:2.2,g:0.08,atk:0.4,am:[[6,10],0.5]},
    {t:'noise',f:700,type:'bandpass',q:4,dur:1.4,g:0.15,at:0.5,atk:0.6}]},
  'death.squeeze':{cat:'death',name:'墙往里挤，混凝土一声声裂开',layers:[
    {t:'noise',f:110,type:'lowpass',q:2,dur:2.6,g:0.35,atk:1.5},
    {t:'noise',f:1800,type:'highpass',q:1,dur:0.05,g:0.3,n:5,every:0.35,at:0.8}]},
  'death.floor':{cat:'death',name:'头顶往下坠的哨音，砸下来，碎了一地',layers:[
    {t:'tone',f:2400,to:600,dur:1.1,g:0.06},
    {t:'noise',f:900,type:'lowpass',dur:0.25,g:0.5,at:1.15},
    {t:'tone',f:[1800,3200],type:'triangle',dur:0.12,g:0.05,n:5,every:0.06,at:1.2}]},
  'death.face':{cat:'death',name:'吸一口气，然后只剩很低的嗡声',layers:[
    {t:'noise',f:1500,type:'bandpass',q:1,dur:0.35,g:0.25,atk:0.2},
    {t:'tone',f:62,to:58,dur:2.2,g:0.25,at:0.6,atk:0.3}]}
};

/* @module-exports */
GameModules.publish("game3d/js/sound-bank.js",{
"SOUND_CATS":{get:function(){return SOUND_CATS;},set:function($value){SOUND_CATS=$value;}},
"BELL_TUNE":{get:function(){return BELL_TUNE;},set:function($value){BELL_TUNE=$value;}},
"CHIME":{get:function(){return CHIME;},set:function($value){CHIME=$value;}},
"TINE":{get:function(){return TINE;},set:function($value){TINE=$value;}},
"STEEL":{get:function(){return STEEL;},set:function($value){STEEL=$value;}},
"SAME_STEP":{get:function(){return SAME_STEP;},set:function($value){SAME_STEP=$value;}},
"SOUND_BANK":{get:function(){return SOUND_BANK;},set:function($value){SOUND_BANK=$value;}}
});
})(GameModules.imports("game3d/js/sound-bank.js"));
