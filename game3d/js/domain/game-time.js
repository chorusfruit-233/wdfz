/* 日历分段的纯规则。剧情、检查、音画反馈由 systems.js 适配，不在这里执行。 */
'use strict';
var GameTimeRules={
  amount:function(value){return Number.isFinite(value)?Math.max(0,value):0;},
  continuous:function(day,time,lightsOut){
    day=Math.max(1,day||1);
    return (day-1-(time>=lightsOut+10&&day>1?1:0))*1440+time;
  },
  forwardSlice:function(time,day,remaining,lightsOut){
    var used=Math.min(remaining,Math.max(0,1500-time)),to=time+used;
    var nextDay=((time<lightsOut+10&&to>=lightsOut+10)||(day===1&&time>=lightsOut+10))?(day||1)+1:day;
    return {from:time,to:to,used:used,remaining:remaining-used,day:nextDay,time:to>=1500-1e-9?440:to};
  },
  backwardSlice:function(time,day,remaining,lightsOut){
    var from=time<=440?1500:time,used=Math.min(remaining,from-440),to=from-used;
    return {from:from,to:to,used:used,remaining:remaining-used,day:from>=lightsOut+10&&to<lightsOut+10&&day>1?day-1:day};
  },
  realTimeSlice:function(time,seconds,boundary,rate){
    var until=Math.max(0,(boundary-time)*60/rate),used=Math.min(seconds,until);
    return {seconds:used,minutes:until<1e-9?1e-8:(used===until?boundary-time:used*rate/60),nudge:until<1e-9};
  },
  pressure:function(points,clock){
    var a=points[0],b=a,stage=clock>a.clock?1:0;
    for(var i=1;i<points.length;i++){
      b=points[i];if(clock<b.clock)break;a=b;stage=i+1;
    }
    var t=a===b?0:Math.max(0,Math.min(1,(clock-a.clock)/(b.clock-a.clock))),value={clock:clock,stage:stage};
    ['anomaly','patrol','danger','passive','rest'].forEach(function(key){value[key]=a[key]+(b[key]-a[key])*t;});
    return value;
  }
};
if(typeof module!=='undefined'&&module.exports)module.exports=GameTimeRules;
