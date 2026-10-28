/* 里世界 3D · 脚本清单
   以前 index.html 里按顺序手写了 48 个 <script>，加一个文件要找对位置插进去，
   顺序错了（比如 quality.js 放到 render.js 前面）就是一片 undefined。
   现在顺序只在这里写一遍，按模块分组；index.html 只引这一个文件。

   用 document.write 插 <script>：它们和手写的标签完全一样是「按顺序、同步」执行的，
   双击 index.html（file://）离线也能玩，不需要打包、不需要服务器。
   lazy 里的是按需加载的大库（Babylon.js 7 MB），只有选了「超精细」或手动选 Babylon 引擎时才加载（gfx/gfx.js）。 */
'use strict';

var WDFZ_MANIFEST={
  base:'game3d/',
  order:[
    /* 第三方库：three.js r160 */
    'lib/three.min.js',
    /* 基础：常量、地图数据、渲染器、画质档位表 */
    'js/core.js','js/map.js','js/render.js','js/quality.js',
    /* 建模：材质、建模工具、人物、家具、房间、楼、室外 */
    'js/model/materials.js','js/model/kit.js','js/model/figure.js','js/model/furniture.js',
    'js/model/room.js','js/model/building.js','js/model/outdoor.js',
    /* 世界：碰撞与进出房间、钟楼旋梯、巡察者、传送门、手持物、结局演出 */
    'js/world.js','js/spiral.js','js/patrol.js','js/portal.js','js/hands.js','js/cutscene.js',
    /* 特效 */
    'js/fx/gaze.js','js/fx/anomaly-fx.js','js/fx/weather.js','js/fx/cup.js','js/fx/smile.js','js/fx/traces.js','js/fx/classroom.js',
    /* 光影与状态、输入、界面、玩法系统 */
    'js/lighting.js','js/shade.js','js/state.js','js/input.js','js/ui.js','js/systems.js','js/anomaly.js',
    'js/items.js','js/story.js','js/interact.js','js/audio.js','js/save.js','js/settings.js','js/dev.js',
    'js/pcgame.js','js/phone.js','js/mono.js','js/mobile.js','js/prologue.js',
    /* 渲染层：按画质选引擎（Three.js / Babylon.js） */
    'js/gfx/gfx.js','js/gfx/three-backend.js','js/gfx/babylon-backend.js',
    /* 启动 */
    'js/main.js'
  ],
  lazy:{ babylon:['lib/babylon.js'] }
};
(function(){
  var M=WDFZ_MANIFEST, i, h='';
  for(i=0;i<M.order.length;i++) h+='<script src="'+M.base+M.order[i]+'"><\/script>';
  document.write(h);
})();
