/* 里世界 3D · 画质档位表
   以前「流畅 / 均衡 / 精细」散在十几个文件里各写一遍（QUALITY===0 ? 14 : 24 这种），
   加一档要每处都改。现在每一档要什么都写在这张表里，各处只问 QP().xxx。

   引擎：前三档用 Three.js（体积小、手机也跑得动）；「超精细」换成 Babylon.js
   （自带屏幕空间环境光遮蔽、高分辨率软阴影、抗锯齿后期），第一次选中时才加载。
   设置里还能手动指定引擎（自动 / Three.js / Babylon.js）。 */
'use strict';

var QPROF=[
  { key:'low', name:'流畅', tip:'流畅：少树、无草、低分辨率',
    engine:'three', pixelRatio:1.0, rts:0.55, texSize:256, lodLow:true, segMul:0.6, figDetail:0,
    shadows:false, shadowMap:0, shafts:false,
    trees:45, shrubs:10, grass:0, flowers:7,
    rain:500, splash:16, puddles:5, moths:50, dust:60,
    gazeEyes:14, gazeFloat:4, fenceStep:0.9, facadeDetail:false,
    physHz:60, exactCollide:false, camCollide:false, ssao:false, fxaa:false, fpsFloor:0 },
  { key:'mid', name:'均衡', tip:'均衡',
    engine:'three', pixelRatio:1.4, rts:0.70, texSize:512, lodLow:false, segMul:1.0, figDetail:1,
    shadows:false, shadowMap:0, shafts:true,
    trees:100, shrubs:24, grass:4200, flowers:14,
    rain:900, splash:36, puddles:9, moths:80, dust:140,
    gazeEyes:24, gazeFloat:8, fenceStep:0.6, facadeDetail:false,
    physHz:60, exactCollide:false, camCollide:false, ssao:false, fxaa:false, fpsFloor:24 },
  { key:'high', name:'精细', tip:'精细：实时阴影、更多树和草',
    engine:'three', pixelRatio:1.4, rts:1.0, texSize:512, lodLow:false, segMul:1.0, figDetail:1,
    shadows:true, shadowMap:2048, shafts:true,
    trees:170, shrubs:40, grass:9000, flowers:14,
    rain:1500, splash:36, puddles:9, moths:120, dust:140,
    gazeEyes:24, gazeFloat:8, fenceStep:0.45, facadeDetail:true,
    physHz:60, exactCollide:false, camCollide:false, ssao:false, fxaa:false, fpsFloor:28 },
  { key:'ultra', name:'超精细', tip:'超精细：Babylon.js 引擎、环境光遮蔽、4096 阴影、240 Hz 物理',
    engine:'babylon', pixelRatio:2.0, rts:1.0, texSize:1024, lodLow:false, segMul:1.6, figDetail:2,
    shadows:true, shadowMap:4096, shafts:true,
    trees:240, shrubs:60, grass:16000, flowers:21,
    rain:2400, splash:48, puddles:12, moths:180, dust:220,
    gazeEyes:32, gazeFloat:12, fenceStep:0.45, facadeDetail:true,
    physHz:240, exactCollide:true, camCollide:true, ssao:true, fxaa:true, fpsFloor:30 }
];
var QMAX=QPROF.length-1;
function QP(){ return QPROF[QUALITY]||QPROF[1]; }
function qualityValid(q){ q=+q; return (q>=0&&q<=QMAX&&(q|0)===q)?q:1; }
/* 这一档实际用哪个引擎：设置里手动指定的优先 */
function qualityEngine(){
  var e=(typeof SET!=='undefined'&&SET.engine)||'auto';
  if(e==='three'||e==='babylon') return e;
  return QP().engine;
}
