/* Pure benchmark rules. Shared by the browser page and Node-based checks. */
(function(root){
  'use strict';
  var SCENES={classroom:'教室',stairs:'真实楼梯',outdoor:'室外校园'};
  function number(value,fallback,min,max){var n=Number(value);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;}
  function config(input){
    input=input||{};
    return {quality:Math.round(number(input.quality,1,0,4)),width:Math.round(number(input.width,960,320,1920)),height:Math.round(number(input.height,540,240,1080)),
      sampleMs:number(input.sampleMs,5000,250,20000),warmMs:number(input.warmMs,2000,0,10000),rounds:Math.round(number(input.rounds,2,1,4)),
      mode:input.mode==='sync'?'sync':'continuous',
      scenes:Object.keys(SCENES).filter(function(s){return !Array.isArray(input.scenes)||input.scenes.includes(s);}),seed:1194};
  }
  function schedule(c){
    var out=[];
    for(var round=0;round<c.rounds;round++)(round%2?['webgpu','webgl']:['webgl','webgpu']).forEach(function(backend){out.push({round:round+1,backend:backend});});
    return out;
  }
  function stats(values){
    var a=values.filter(function(n){return Number.isFinite(n)&&n>=0;}).sort(function(x,y){return x-y;});
    if(!a.length)return null;
    function quantile(p){var x=(a.length-1)*p,i=Math.floor(x);return a[i]+(a[Math.min(i+1,a.length-1)]-a[i])*(x-i);}
    return {count:a.length,mean:a.reduce(function(s,x){return s+x;},0)/a.length,median:quantile(.5),p95:quantile(.95),min:a[0],max:a[a.length-1]};
  }
  function fingerprint(text){var h=2166136261;for(var i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);return (h>>>0).toString(16).padStart(8,'0');}
  function summary(samples){
    var complete=stats(samples.map(function(s){return s.completeMs;})),submit=stats(samples.map(function(s){return s.submitMs;}));
    var intervals=samples.map(function(s){return s.intervalMs;}).filter(function(n){return Number.isFinite(n)&&n>0;});
    return {complete:complete,submit:submit,interval:stats(intervals),cadenceFps:intervals.length?1000/ stats(intervals).mean:null,calls:stats(samples.map(function(s){return s.calls;}))};
  }
  function throughput(rows){var frames=0,ms=0;rows.forEach(function(r){if(r.timing&&r.timing.elapsedMs>0){frames+=r.samples.length;ms+=r.timing.elapsedMs;}});return ms>0?frames*1000/ms:null;}
  function specification(meta){return JSON.stringify([meta.quality,meta.viewport,meta.drawingBuffer,meta.target,meta.samples,meta.canvasSamples,meta.canvasAntialias,meta.sceneFingerprint,meta.camera]);}
  function compare(rows,scene,rounds){
    var groups=['webgl','webgpu'].map(function(backend){return rows.filter(function(r){return r.backend===backend&&r.scene===scene&&r.status==='ok';});});
    if(groups.some(function(g){return g.length!==rounds;}))return {comparable:false,reason:'两种后端的完整轮次不足'};
    var specs=groups.flat().map(function(r){return specification(r.meta);});
    if(new Set(specs).size!==1)return {comparable:false,reason:'实际分辨率、采样或场景规格不同'};
    var sums=groups.map(function(g){return summary(g.flatMap(function(r){return r.samples;}));});
    if(sums.some(function(s){return !s.submit||s.submit.count<30;}))return {comparable:false,reason:'有效样本少于 30 帧，请延长测试时间'};
    var modes=new Set(groups.flat().map(function(r){return r.mode||'sync';}));
    if(modes.size!==1)return {comparable:false,reason:'测试模式不同'};
    if(modes.has('continuous')){
      var rates=groups.map(throughput);
      if(rates.some(function(x){return !x;}))return {comparable:false,reason:'连续采样计时不足'};
      return {comparable:true,metric:'throughput',webglFps:rates[0],webgpuFps:rates[1],reductionPercent:(1-rates[0]/rates[1])*100};
    }
    if(sums.some(function(s){return !s.complete||s.complete.mean<=0;}))return {comparable:false,reason:'计时精度不足'};
    return {comparable:true,reductionPercent:(1-sums[1].complete.mean/sums[0].complete.mean)*100};
  }
  var api=Object.freeze({scenes:SCENES,config:config,schedule:schedule,stats:stats,summary:summary,throughput:throughput,compare:compare,fingerprint:fingerprint});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RenderBenchmarkCore=api;
})(globalThis);
