/* 共享时钟：按课表边界积分，保留先辈十秒窗口和原有跨日规则。 */
(function(root,factory){
  'use strict';
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.SharedClock=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function advance(clock,seconds,config){
    var day=clock.day,t=clock.tsec,left=Math.max(0,seconds),schedule=config.schedule;
    while(left>1e-9){
      var period=schedule.find(function(p){return t>=p[0]&&t<p[1];})||schedule[schedule.length-1];
      var slow=t>=config.slowStart&&t<config.slowEnd;
      var end=slow?config.slowEnd:Math.min(period[1],t<config.slowStart?config.slowStart:Infinity);
      if(t<config.dayAt)end=Math.min(end,config.dayAt);
      var rate=slow?config.slowRate:period[4],needed=(end-t)*60/rate;
      var used=Math.min(left,Math.max(0,needed)),before=t;
      t+=used*rate/60;left-=used;
      if(t>=config.dayAt-1e-9&&(before<config.dayAt||day===1))day++;
      if(t>=1500-1e-9)t=440;
      if(used<1e-12&&end<1500)t=end+1e-9;
    }
    return {day:day,tsec:t};
  }
  return Object.freeze({advance:advance});
});
