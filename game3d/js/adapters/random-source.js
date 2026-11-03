/* @module-capsule */
(function($imports){
/* 浏览器的默认随机源只在此适配；替换 Math.random 的旧测试/工具仍然有效。 */
'use strict';
$imports.GameRandom.bind(function(){return Math.random();});
$imports.PresentationRandom.seed((Date.now()^0x91e10da5)>>>0);

/* @module-exports */
GameModules.publish("game3d/js/adapters/random-source.js",{

});
})(GameModules.imports("game3d/js/adapters/random-source.js"));
