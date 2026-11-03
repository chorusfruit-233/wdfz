/* Read-only sensory mapping and bounded, expiring sound-event queue. */
'use strict';
var SensoryRules=(function(){
  function clamp(x,a,b){return Math.max(a,Math.min(b,x));}
  function target(san){san=Number.isFinite(san)?clamp(san,0,100):100;return clamp((60-san)/60,0,1);}
  function step(previous,san,dt){var t=target(san);return previous===null?t:previous+(t-previous)*(1-Math.exp(-Math.max(0,dt)/(t>previous?.35:2)));}
  function view(body,opts){
    opts=opts||{};var k=opts.distortion===0?0:opts.distortion===1?.35:1;
    var safe=opts.takeover?0:opts.threat?.35:1, pulse=.75+.25*Math.sin((opts.time||0)*2.4);
    return {warp:body*body*k*safe,edge:body*.18*safe,focus:body*body*k*pulse*safe,
      bpm:Math.max(opts.chase?124:0,body>.35?70+body*65:0),breath:body};
  }
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
  return {target:target,step:step,view:view,queue:queue};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SensoryRules;
