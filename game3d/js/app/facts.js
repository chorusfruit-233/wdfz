/* @module-capsule */
(function($imports){
/* 里世界 3D · 事实流水
   各系统在事情真的成立的那一刻调 gameFact(kind, data)：只发一次，不在每帧发。成就、本局积分、回放都只听这一条，
   不改玩法。这里是唯一 emit 'gameFact' 的地方（清单里只有本模块登记 emits），别的模块直接调全局 gameFact。
   是否可信（调试局、回放、预览）由监听方判断；kind 与字段一览见 docs/模块化与Mod规范.md 第 2 节。 */
'use strict';
function gameFact(kind,data){
  var f={kind:String(kind)}, k;
  if(data&&typeof data==='object') for(k in data) if(Object.prototype.hasOwnProperty.call(data,k)) f[k]=data[k];
  try{ GameModules.emit('gameFact',f); }catch(e){}
  return f;
}

/* @module-exports */
GameModules.publish("game3d/js/app/facts.js",{
"gameFact":{get:function(){return gameFact;},set:function($value){gameFact=$value;}}
});
})(GameModules.imports("game3d/js/app/facts.js"));
