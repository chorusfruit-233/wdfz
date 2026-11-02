/* 纯规则：按有效模拟秒拆分电量、任务完成和自动开机边界。不读取游戏或平台。 */
'use strict';
var PhoneEnergy={
  fresh:function(){return {initialized:false,battery:100,powered:true,warn20:false,warn5:false,
    network:false,wireless:{status:'idle',elapsed:0,target:0},download:{status:'idle',elapsed:0,target:60}};},
  rate:function(d,c){
    var running=d.powered&&c.held&&d.wireless.status==='running';
    return (c.classroom?.5:c.computer?1/6:0)-(1/6)*(running?2:1)*(c.tech?2:1);
  },
  advance:function(d,seconds,c){
    var events=[],left=seconds,eps=1e-8;
    if(!d.initialized||!(seconds>0))return events;
    /* 每轮必然消耗时间或跨过一个有限状态边界；完成与空电同刻时先接受任务。 */
    while(left>eps){
      var tasks=c.held&&d.powered,task=tasks?(d.wireless.status==='running'?d.wireless:
        d.download.status==='running'?d.download:null):null;
      var rate=this.rate(d,c),span=left;
      if(task)span=Math.min(span,Math.max(0,task.target-task.elapsed));
      if(rate<0&&d.battery>0)span=Math.min(span,d.battery/-rate);
      if(rate>0&&!d.powered&&d.battery<5)span=Math.min(span,(5-d.battery)/rate);
      if(task)task.elapsed=Math.min(task.target,task.elapsed+span);
      d.battery=Math.max(0,Math.min(100,d.battery+rate*span));left-=span;
      if(task&&task.elapsed>=task.target-eps){
        task.elapsed=task.target;task.status='complete';
        if(task===d.wireless){d.network=true;d.download.status='running';events.push('connected');}
        else events.push('downloaded');
      }
      if(d.battery<=20+eps&&!d.warn20){d.warn20=true;events.push('low20');}
      if(d.battery<=5+eps&&!d.warn5){d.warn5=true;events.push('low5');}
      if(d.battery<=eps&&d.powered){d.battery=0;d.powered=false;events.push('off');}
      if(d.battery>=5-eps&&!d.powered&&rate>0){d.powered=true;events.push('on');}
      /* 0 电量且负净充电时保持关机，仍让服务端时间在外层继续走。 */
      if(span<=eps&&!task)break;
    }
    return events;
  }
};
