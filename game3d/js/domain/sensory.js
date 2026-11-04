/* Read-only sensory mapping and bounded, expiring sound-event queue. */
'use strict';
var SensoryRules=(function(){
  function clamp(x,a,b){return Math.max(a,Math.min(b,x));}
  function target(san){san=Number.isFinite(san)?clamp(san,0,100):100;return clamp((60-san)/60,0,1);}
  function step(previous,san,dt){var t=target(san);return previous===null?t:previous+(t-previous)*(1-Math.exp(-Math.max(0,dt)/(t>previous?.35:2)));}
  /* 视觉分级（计划《电梯直通、新天赋、新结局与恐怖氛围》12.9 第二轮）。body：SAN ≥ 60 为 0，45 约 0.25，22 约 0.63，8 约 0.87。
     越低：画面越扭曲（warp）、视野越小（tunnel）、越模糊（blur，边缘重、中心也糊）、颜色越少（drain）、灯越晕（halo），
     很低时黑屏闪烁（flickerK，眼前一黑）、重影（ghostMax）。
     · 静态通道（tunnel、blur、drain、halo）不跟「视野扭曲」设置：关掉晃动、关掉声音也看得出状态；
     · 动态通道（warp 流动变形与倾斜、focus 一阵阵对不上焦、pulseK 心跳收缩、ghostMax 重影）跟「视野扭曲」：减弱 35%，关闭为 0；
     · 黑屏闪烁跟「减少闪光」：开着时最多压暗一半、慢慢暗下去（模块里平滑），不做硬切；
     · 真实危险时都减到 35%，接管（手机、过场、驾驶……）时全为 0 */
  function view(body,opts){
    opts=opts||{};var k=opts.distortion===0?0:opts.distortion===1?.35:1;
    var safe=opts.takeover?0:opts.threat?.35:1, t=opts.time||0;
    var hunt=.5+.5*Math.sin(t*.83+1.7*Math.sin(t*.29));
    return {warp:Math.pow(body,1.5)*k*safe,tunnel:Math.pow(body,1.25)*safe,blur:body*safe,focus:body*body*k*hunt*safe,
      drain:Math.min(1,body*1.15)*safe,halo:body*safe,
      pulseK:body>.35?k*safe:0,ghostMax:body>.45?Math.min(1,(body-.45)/.45)*k*safe:0,
      flickerK:clamp((body-.35)/.25,0,1)*(opts.reduceFlash?.5:1)*safe,
      flickerGap:body>.35?14-10.5*clamp((body-.35)/.65,0,1):0,
      bpm:Math.max(opts.chase?124:0,body>.35?70+body*65:0),breath:body};
  }
  /* 一次黑屏的样子（秒）：[开始, 全黑结束, 恢复用时]。最多两下；很低时偶尔一次长的「眼前一黑」再慢慢亮回来。
     rnd 是表现层随机数（不碰玩法随机） */
  function blinkPlan(body,rnd){
    if(body>=.75&&rnd()<.3){var d=.35+.25*rnd();return [[0,d,.4]];}
    var out=[],at=0,n=body>=.6&&rnd()<.5?2:1;
    for(var i=0;i<n;i++){var len=.07+.07*rnd();out.push([at,at+len,.06]);at+=len+.1+.06*rnd();}
    return out;
  }
  function blinkAt(plan,t){
    var v=0;(plan||[]).forEach(function(s){if(t>=s[0]&&t<s[1])v=1;else if(t>=s[1]&&t<s[1]+s[2])v=Math.max(v,1-(t-s[1])/s[2]);});
    return v;
  }
  function blinkEnd(plan){return (plan||[]).reduce(function(m,s){return Math.max(m,s[1]+s[2]);},0);}
  function queue(){
    var list=[],seq=0;
    return {clear:function(){list=[];},all:function(){return list.slice();},
      push:function(e,now){
        list=list.filter(function(x){return x.end>now;});
        var old=list.find(function(x){return x.source===e.source&&Math.abs(x.at-e.at)<3;});
        if(old){old.end=Math.max(old.end,e.end);old.at=e.at;old.text=e.text;return old;}
        e.id=++seq;list.push(e);list.sort(function(a,b){return b.priority-a.priority||a.at-b.at;});list=list.slice(0,8);return e;
      },visible:function(now){list=list.filter(function(x){return x.end>now;});return list.filter(function(x){return x.at<=now;}).slice(0,2);}};
  }
  return {target:target,step:step,view:view,blinkPlan:blinkPlan,blinkAt:blinkAt,blinkEnd:blinkEnd,queue:queue};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SensoryRules;
