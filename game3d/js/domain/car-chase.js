/* 驾驶物理与通关判定：输入/状态/配置 -> 结果，不引用画面、音效或全局游戏状态。 */
'use strict';
var CAR_CHASE_CONFIG={distance:320,maxSpeed:22,accel:9,brake:15,drag:2,steer:4.2,edge:3.2,
  pursuitLimit:80,obstacles:[[45,0],[78,2.7],[108,-2.7],[190,0],[225,2.7],[290,0]],
  forks:[[150,1],[255,-1]]};
var CarChaseRules=(function(){
  function clamp(value,a,b){return Math.max(a,Math.min(b,value));}
  function step(d,input,dt){
    var throttle=!!input.throttle,braking=!!input.braking,steering=input.steering||0,events=[];
    function failed(message,checkpoint){return {events:events,failure:{message:message,checkpoint:checkpoint}};}
    d.speed=clamp(d.speed+(throttle?CAR_CHASE_CONFIG.accel:-CAR_CHASE_CONFIG.drag)*dt-(braking?CAR_CHASE_CONFIG.brake*dt:0),0,CAR_CHASE_CONFIG.maxSpeed);
    d.x=clamp(d.x+clamp(steering,-1,1)*CAR_CHASE_CONFIG.steer*dt,-CAR_CHASE_CONFIG.edge,CAR_CHASE_CONFIG.edge);
    d.pursuit=clamp(d.pursuit+(d.speed<7?3:-2.5)*dt,0,CAR_CHASE_CONFIG.pursuitLimit);
    d.distance+=d.speed*dt;
    if(d.pursuit>=CAR_CHASE_CONFIG.pursuitLimit){return failed('黑影追上了车。后窗上全是贴上来的手。',Math.max(0,d.distance-30));}
    while(d.nextObstacle<CAR_CHASE_CONFIG.obstacles.length&&d.distance>=CAR_CHASE_CONFIG.obstacles[d.nextObstacle][0]){
      var o=CAR_CHASE_CONFIG.obstacles[d.nextObstacle++];
      if(Math.abs(d.x-o[1])<1.25){
        d.hp--;d.speed*=.55;events.push({type:'hit'});
        if(d.hp<=0){return failed('车撞在路障上，黑影从破碎的窗户里伸进手。',Math.max(0,o[0]-25));}
      }
    }
    while(d.nextFork<CAR_CHASE_CONFIG.forks.length&&d.distance>=CAR_CHASE_CONFIG.forks[d.nextFork][0]){
      var fork=CAR_CHASE_CONFIG.forks[d.nextFork];
      if(d.x*fork[1]<1.0){return failed('路牌在后视镜里倒了过来。前面的路又通回学校。',fork[0]-30);}
      d.nextFork++;events.push({type:'fork'});
    }
    if(d.distance>=CAR_CHASE_CONFIG.distance&&d.nextFork===CAR_CHASE_CONFIG.forks.length){
      return {events:events,won:true};
    }

    return {events:events};
  }
  return Object.freeze({step:step});
})();
if(typeof module!=='undefined'&&module.exports)module.exports={CarChaseRules:CarChaseRules,CAR_CHASE_CONFIG:CAR_CHASE_CONFIG};
