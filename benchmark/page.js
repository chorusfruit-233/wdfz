/* Standalone coordinator: one isolated game frame at a time, no game save access. */
(function(){
  'use strict';
  var C=RenderBenchmarkCore,active=null,report=null,frame=null,root=new URL('../',location.href);
  function el(id){return document.getElementById(id);}
  function text(id,value){el(id).textContent=value;}
  function abortError(){return new DOMException('测试已停止','AbortError');}
  function check(signal){if(signal.aborted)throw abortError();}
  function fit(){if(frame){var w=+frame.dataset.width,h=+frame.dataset.height,scale=Math.min(1,el('preview').clientWidth/w);frame.style.transform='scale('+scale+')';el('preview').style.height=Math.ceil(h*scale)+'px';}}
  async function dispose(){if(frame){var old=frame;frame=null;try{await old.contentWindow.RenderBenchmarkRunner.dispose();}catch(e){}old.remove();el('preview').style.height='';var hint=document.createElement('p');hint.textContent='测试画面已释放，结果见下方。';el('preview').replaceChildren(hint);}}
  async function freshFrame(html,options,signal){
    await dispose();check(signal);frame=document.createElement('iframe');frame.title='固定场景性能采样';frame.dataset.renderBenchmark=JSON.stringify(options);frame.dataset.width=options.width;frame.dataset.height=options.height;
    frame.style.width=options.width+'px';frame.style.height=options.height+'px';frame.tabIndex=-1;
    var doc=new DOMParser().parseFromString(html,'text/html'),base=doc.createElement('base'),script=doc.createElement('script');base.href=root.href;script.src=new URL('benchmark/runner.js',root).href;
    doc.head.prepend(script);doc.head.prepend(base);frame.srcdoc='<!doctype html>'+doc.documentElement.outerHTML;
    el('preview').replaceChildren(frame);fit();
    return new Promise(function(resolve,reject){var start=performance.now(),timer;
      function cleanup(){clearInterval(timer);signal.removeEventListener('abort',abort);}
      function abort(){cleanup();reject(abortError());}
      signal.addEventListener('abort',abort,{once:true});timer=setInterval(function(){
        try{check(signal);var api=frame&&frame.contentWindow.RenderBenchmarkRunner;if(api&&frame.contentDocument.readyState==='complete'&&frame.contentWindow.Engine){cleanup();resolve(api);}else if(performance.now()-start>90000){cleanup();reject(new Error('测试页面及脚本加载超时'));}}
        catch(e){cleanup();reject(e);}
      },25);if(signal.aborted)abort();
    });
  }
  function value(n,digits){return Number.isFinite(n)?n.toFixed(digits===undefined?2:digits):'—';}
  function paint(){
    var body=el('results');body.replaceChildren();if(!report)return;
    var config=report.config;
    text('runconfig','本次测试：'+['流畅','均衡','精细','超精细','真实'][config.quality]+' · '+config.width+'×'+config.height+' · '+config.rounds+' 轮 · 预热 '+config.warmMs/1000+' 秒 / 每场景采样 '+config.sampleMs/1000+' 秒');
    report.config.scenes.forEach(function(scene){['webgl','webgpu'].forEach(function(backend){
      var rows=report.runs.filter(function(r){return r.scene===scene&&r.backend===backend&&r.status==='ok';}),samples=rows.flatMap(function(r){return r.samples;}),s=C.summary(samples),tr=document.createElement('tr');
      var cells=[C.scenes[scene]+' / '+(backend==='webgl'?'WebGL 2':'WebGPU')];
      if(!samples.length)cells.push(report.unavailable[backend]?'不可用：'+report.unavailable[backend]:'等待采样','—','—','—','—','0');
      else cells.push(value(s.complete.mean),value(s.complete.p95),value(s.submit.mean),value(s.cadenceFps,1),value(s.calls&&s.calls.mean,0),String(samples.length));
      cells.forEach(function(t){var td=document.createElement('td');td.textContent=t;tr.appendChild(td);});body.appendChild(tr);
    });});
    text('verdict',report.config.scenes.map(function(scene){var v=C.compare(report.runs,scene,report.config.rounds);return C.scenes[scene]+'：'+(v.comparable?(v.reductionPercent>=0?'WebGPU 完成均值低 ':'WebGL 完成均值低 ')+value(v.reductionPercent>=0?v.reductionPercent:(1-1/(1-v.reductionPercent/100))*100,1).replace('-','')+'%（仅本次同步测试）':v.reason+'。');}).join('\n'));
    var adapters=report.runs.filter(function(r){return r.meta;}).map(function(r){return r.meta.adapter.description||r.meta.adapter.vendor||'';}).filter(Boolean);
    var software=/swiftshader|llvmpipe|lavapipe|software/i.test(adapters.join(' '));report.softwareRenderer=software;
    var specs=['webgl','webgpu'].map(function(backend){var r=report.runs.find(function(x){return x.backend===backend&&x.meta;});return r?backend+'：画布 '+r.meta.drawingBuffer.join('×')+'，内部 '+r.meta.target.join('×')+'，场景 MSAA '+r.meta.samples+' / 画布 '+r.meta.canvasSamples:null;}).filter(Boolean);
    text('specs',specs.join(' / '));
    text('environment',[navigator.userAgent,'DPR '+devicePixelRatio,Array.from(new Set(adapters)).join(' / '),software?'当前为软件 GPU；结果用于验证测试流程。':''].filter(Boolean).join(' · '));
  }
  async function run(input){
    if(active)throw new Error('已有测试正在运行');
    var c=C.config(input);if(!c.scenes.length)throw new Error('至少选择一个场景');
    active=new AbortController();var signal=active.signal,plans=C.schedule(c),done=0,total=plans.length*c.scenes.length,lastPaint=0;
    report={version:1,method:'synchronized-render-completion-v1',createdAt:new Date().toISOString(),status:'running',config:c,environment:{userAgent:navigator.userAgent,devicePixelRatio:devicePixelRatio,hardwareConcurrency:navigator.hardwareConcurrency,secureContext:window.isSecureContext},unavailable:{},runs:[]};
    el('start').disabled=true;el('stop').disabled=false;el('download').disabled=true;el('config').querySelectorAll('select,input').forEach(function(x){x.disabled=true;});el('progress').value=0;paint();
    function cancelHidden(){if(document.hidden){text('status','测试因页面切到后台而停止，请保持前台后重试。');active.abort();}}
    function cancelDpr(){if(devicePixelRatio!==report.environment.devicePixelRatio){active.abort();}}
    document.addEventListener('visibilitychange',cancelHidden);window.addEventListener('resize',cancelDpr);
    try{
      check(signal);if(document.hidden)throw new Error('请保持测试页面在前台');
      var response=await fetch(new URL('index.html',root),{signal:signal});if(!response.ok)throw new Error('无法读取游戏页面');var html=await response.text();
      report.source={indexFingerprint:C.fingerprint(html)};
      report.capabilities={};
      // Warm device startup before putting a large scene on either API. No preflight frame is scored.
      for(var backend of ['webgpu','webgl']){
        text('status','检查 '+backend+' 可用性 · 不计入成绩');
        var api=await freshFrame(html,Object.assign({},c,{quality:0,backend:backend}),signal),capability=await api.ready(signal);check(signal);
        report.capabilities[backend]=capability;
        if(!capability.available)report.unavailable[backend]=(capability.actual.fallbackReason||'后端不可用')+'（实际 '+capability.actual.backend+'）';
        await dispose();
      }
      for(var plan of plans){
        check(signal);if(report.unavailable[plan.backend]){done+=c.scenes.length;el('progress').value=done/total;continue;}
        text('status','第 '+plan.round+'/'+c.rounds+' 轮 · '+plan.backend+' · 准备渲染器');
        var api=await freshFrame(html,Object.assign({},c,plan),signal),state=await api.ready(signal);check(signal);
        if(!state.available){report.unavailable[plan.backend]=(state.actual.fallbackReason||'后端不可用')+'（实际 '+state.actual.backend+'）';done+=c.scenes.length;await dispose();paint();continue;}
        for(var scene of c.scenes){
          text('status','第 '+plan.round+'/'+c.rounds+' 轮 · '+plan.backend+' · '+C.scenes[scene]+' · 预热与采样');
          var result=await api.measure(scene,signal,function(p){if(performance.now()-lastPaint>150){el('progress').value=(done+p)/total;lastPaint=performance.now();}});check(signal);
          result.round=plan.round;report.runs.push(result);done++;el('progress').value=done/total;paint();
        }
        await dispose();
      }
      report.status='complete';el('progress').value=1;text('status','测试完成。完成耗时越低越好；请同时检查 P95、规格与样本数量。');
    }catch(e){try{report.diagnostic=api&&api.diagnostic();}catch(ignore){}report.status=signal.aborted?'canceled':'error';report.error=String(e.message||e);text('status',signal.aborted?'测试已停止，已完成的数据可导出；不完整轮次不判优。':'测试未完成：'+report.error);}
    finally{await dispose();document.removeEventListener('visibilitychange',cancelHidden);window.removeEventListener('resize',cancelDpr);report.finishedAt=new Date().toISOString();active=null;el('start').disabled=false;el('stop').disabled=true;el('download').disabled=false;el('config').querySelectorAll('select,input').forEach(function(x){x.disabled=false;});paint();}
    return report;
  }
  el('config').addEventListener('submit',function(e){e.preventDefault();var size=el('size').value.split(',').map(Number);run({quality:+el('quality').value,width:size[0],height:size[1],sampleMs:+el('duration').value,rounds:+el('rounds').value,scenes:Array.from(document.querySelectorAll('input[name=scene]:checked')).map(function(x){return x.value;})}).catch(function(e){text('status',e.message);});});
  el('stop').addEventListener('click',function(){if(active)active.abort();});
  el('download').addEventListener('click',function(){if(!report)return;var url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='renderer-benchmark-'+report.createdAt.replace(/[:.]/g,'-')+'.json';a.click();setTimeout(function(){URL.revokeObjectURL(url);},1000);});
  window.addEventListener('resize',fit);window.addEventListener('pagehide',function(){if(active)active.abort();dispose();});
  window.RenderBenchmark={run:run,cancel:function(){if(active)active.abort();},report:function(){return report;}};
})();
