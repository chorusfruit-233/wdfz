/* @module-capsule */
(function($imports){
/* 驾驶逃脱：距离、碰撞、路口与追兵使用模拟运行秒和世界距离。 */
'use strict';


var CarChase={
  active:function(){return !!($imports.RT.carChase&&$imports.S.mode==='out'&&!$imports.S.dead);},
  start:function(){
    $imports.S.screen='play';$imports.S.mode='out';$imports.S.room=null;$imports.S.seated=false;
    $imports.S.x=$imports.GATE_N.x*$imports.SC;$imports.S.y=($imports.GATE_N.y+40)*$imports.SC;$imports.S.ang=-Math.PI/2;$imports.S.pitch=0;
    (0,$imports.enterWorldOut)();(0,$imports.resetInputState)();(0,$imports.releaseMouseLook)();
    (0,$imports.showBanner)('校外道路');
    $imports.RT.carUsed=true;$imports.RT.carChase={distance:0,x:0,speed:0,hp:3,pursuit:0,nextObstacle:0,nextFork:0};
    CarChase.build();(0,$imports.autoSave)();(0,$imports.updateTouchUI)();
    (0,$imports.os)('我：按住前进，避开障碍。看清路牌，再选路。',4,$imports.OS_FORCE);
  },
  clearVisual:function(){return $imports.CarChaseView.clearVisual.apply($imports.CarChaseView,arguments); },
  cancel:function(){
    CarChase.clearVisual();$imports.RT.carChase=null;$imports.RT.carUsed=false;(0,$imports.resetInputState)();
  },
  build:function(){return $imports.CarChaseView.build.apply($imports.CarChaseView,arguments); },
  draw:function(){return $imports.CarChaseView.draw.apply($imports.CarChaseView,arguments); },
  fail:function(message,checkpoint){
    var d=$imports.RT.carChase;if(!d)return;
    (0,$imports.kill)(message,'grip','car_chase');
    if($imports.S.dead)return;
    d.distance=checkpoint;d.speed=0;d.hp=3;d.pursuit=0;
    d.nextObstacle=$imports.CAR_CHASE_CONFIG.obstacles.filter(function(o){return o[0]<=checkpoint;}).length;
    d.nextFork=$imports.CAR_CHASE_CONFIG.forks.filter(function(f){return f[0]<=checkpoint;}).length;
    (0,$imports.autoSave)();(0,$imports.os)('我：车身猛地一震。我还抓着方向盘，得重新找路。',3,$imports.OS_FORCE);
  },
  tick:function(dt){
    var d=$imports.RT.carChase;if(!CarChase.active()||!d)return;
    var throttle=!!($imports.KEY.w||$imports.KEY.arrowup)||($imports.TOUCH.active&&$imports.TOUCH.dy<-.25);
    var braking=!!($imports.KEY.s||$imports.KEY.arrowdown)||($imports.TOUCH.active&&$imports.TOUCH.dy>.3);
    var steering=($imports.KEY.d||$imports.KEY.arrowright?1:0)-($imports.KEY.a||$imports.KEY.arrowleft?1:0)+($imports.TOUCH.active?$imports.TOUCH.dx:0);

    var result=$imports.CarChaseRules.step(d,{throttle:throttle,braking:braking,steering:steering},dt);
    $imports.CarChaseView.sound(dt);
    result.events.forEach(function(event){if(event.type==='hit')(0,$imports.toast)('撞上路障');else if(event.type==='fork')(0,$imports.autoSave)();});
    if(result.failure){CarChase.fail(result.failure.message,result.failure.checkpoint);return;}
    if(result.won){CarChase.clearVisual();$imports.RT.carChase=null;$imports.Speedrun.proof('car');(0,$imports.triggerEnding)('car',true);}
  }
};

/* @module-exports */
GameModules.publish("game3d/js/car-chase.js",{
"CarChase":{get:function(){return CarChase;},set:function($value){CarChase=$value;}}
});
})(GameModules.imports("game3d/js/car-chase.js"));
