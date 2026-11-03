/* @module-capsule */
(function($imports){
/* 异象预警查询与旧窗口函数的应用适配，不依赖画面是否存在。 */
'use strict';
function anwVisible(){
  return !!($imports.S.screen==='play'&&!$imports.S.dead&&!$imports.PAUSE.on&&!$imports.AN.active&&$imports.AN_WARN[$imports.AN.pre]&&(0,$imports.anAllowed)($imports.AN.pre)&&$imports.AN.next>0&&$imports.AN.next<=8&&!$imports.UI.anyOpen());
}
function cupWobble(){return $imports.CupRules.wobble($imports.S.diff);}

/* @module-exports */
GameModules.publish("game3d/js/app/anomaly-warning.js",{
"anwVisible":{get:function(){return anwVisible;},set:function($value){anwVisible=$value;}},
"cupWobble":{get:function(){return cupWobble;},set:function($value){cupWobble=$value;}}
});
})(GameModules.imports("game3d/js/app/anomaly-warning.js"));
