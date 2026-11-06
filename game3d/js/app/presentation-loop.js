/* @module-capsule */
(function($imports){
/* 每帧表现接线。渲染不推进模拟步骤。 */
'use strict';
function render(dt){
  try{ if($imports.DEV.on){$imports.DEV.refreshT-=dt;if($imports.DEV.refreshT<=0){$imports.DEV.refreshT=.3;$imports.Dev.refresh();}} }catch(e){}
  try{ if($imports.AMB_ON&&($imports.S.screen==='play'||$imports.S.screen==='menu')){ if(!$imports.SFX._ambOn){ $imports.SFX.ambient(); $imports.SFX._ambOn=true; } } else if(!$imports.AMB_ON&&$imports.SFX._ambOn){ $imports.SFX.stopAmbient(); $imports.SFX._ambOn=false; } }catch(e){}
  try{ $imports.SFX.tick(dt); }catch(e){}
  if($imports.CarChase.active()&&$imports.S.screen==='play')$imports.CarChase.draw();
  try{ $imports.PortalDevice.tick(dt); }catch(e){}          /* 物理实验室演示台上的传送门：按剧情状态摆、每帧动 */
  try{ $imports.LiftDoors.tick(dt); }catch(e){}             /* 电梯层门：电梯到这一层时滑开 */
  GameModules.emit('frame',dt);                     /* 表现层每帧：模块自己的画面动画（彩蛋的反色、黑影淡入淡出） */
  $imports.Engine.draw(dt); (0,$imports.updateHUD)(); (0,$imports.drawMini)(dt);
  try{ $imports.Speedrun.paintHud(); }catch(e){}
}
/* @module-exports */
GameModules.publish("game3d/js/app/presentation-loop.js",{
"render":{get:function(){return render;},set:function($value){render=$value;}}
});
})(GameModules.imports("game3d/js/app/presentation-loop.js"));
