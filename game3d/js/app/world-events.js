/* @module-capsule */
(function($imports){
/* 房间交接后的应用通知与叙事反馈。 */
'use strict';
function onEnterRoom(id,restoring){
  GameModules.emit('enterRoom',id,!!restoring);
  $imports.ExplorationMap.observe();
  $imports.Playtest.event(restoring?'读档进入':'进入地点',id);
  if(id==='garage1') (0,$imports.os)('我：车库里没有灯。空气是潮的，有一股铁和机油的味道。远处有水在滴。',3.6);
  if(id==='portal_tunnel') (0,$imports.os)('我：不想靠近。墙上的黑色黏液还在缓慢流动。',4.5,$imports.OS_FORCE);
  try{ $imports.Dread.enter(id,restoring); }catch(e){}
  (0,$imports.spotTick)();
}
/* @module-exports */
GameModules.publish("game3d/js/app/world-events.js",{
"onEnterRoom":{get:function(){return onEnterRoom;},set:function($value){onEnterRoom=$value;}}
});
})(GameModules.imports("game3d/js/app/world-events.js"));
