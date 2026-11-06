/* Runs only inside the benchmark's srcdoc frame, before any game scripts. */
(function(){
  'use strict';
  if(!window.frameElement||!window.frameElement.hasAttribute('data-render-benchmark'))return;
  var options=JSON.parse(window.frameElement.dataset.renderBenchmark),errors=[];
  function memory(){var m=new Map();return {get length(){return m.size;},key:function(i){return Array.from(m.keys())[i]||null;},getItem:function(k){return m.has(String(k))?m.get(String(k)):null;},setItem:function(k,v){m.set(String(k),String(v));},removeItem:function(k){m.delete(String(k));},clear:function(){m.clear();}};}
  // Shadow both stores before settings, mods, achievements or autosaves can access them.
  Object.defineProperty(window,'localStorage',{value:memory(),configurable:true});
  Object.defineProperty(window,'sessionStorage',{value:memory(),configurable:true});
  localStorage.setItem('wdfz_pro','1');
  localStorage.setItem('zw3d_set',JSON.stringify({q:0,renderer:options.backend==='webgl'?'webgl':'auto',rv:1,vol:0,amb:0,grain:0,shake:0,distortion:0,reduceFlash:1}));
  // Equalize output-canvas MSAA. Scene render-target MSAA still follows the game quality.
  var context=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(type,attributes){
    if(type==='webgl2'||type==='webgl')return context.call(this,type,Object.assign({},attributes,{antialias:false}));
    return context.apply(this,arguments);
  };
  window.addEventListener('error',function(e){errors.push(e.message||'脚本错误');});
  window.addEventListener('unhandledrejection',function(e){errors.push(String(e.reason));});
  function canceled(signal){if(signal.aborted)throw new DOMException('测试已停止','AbortError');}
  function wait(ms,signal){return new Promise(function(resolve,reject){
    var t;function abort(){clearTimeout(t);signal.removeEventListener('abort',abort);reject(new DOMException('测试已停止','AbortError'));}
    signal.addEventListener('abort',abort,{once:true});t=setTimeout(function(){signal.removeEventListener('abort',abort);resolve();},ms);if(signal.aborted)abort();
  });}
  function nextFrame(signal){return new Promise(function(resolve,reject){
    var id;function abort(){cancelAnimationFrame(id);signal.removeEventListener('abort',abort);reject(new DOMException('测试已停止','AbortError'));}
    signal.addEventListener('abort',abort,{once:true});id=requestAnimationFrame(function(){signal.removeEventListener('abort',abort);resolve(performance.now());});if(signal.aborted)abort();
  });}
  async function until(fn,signal,timeout,label){var start=performance.now();while(!fn()){canceled(signal);if(performance.now()-start>timeout)throw new Error((label||'场景或资源')+'准备超时');await wait(30,signal);}canceled(signal);}
  function check(backend){
    var s=Engine.status();
    if(!Engine.ready()||s.backend!==backend)throw new Error('渲染后端发生变化：'+JSON.stringify(s));
    if(errors.length||GameModules.errors().length||Lifecycle.snapshot().errors.length)throw new Error('场景发生错误，本轮数据无效：'+JSON.stringify(errors.concat(GameModules.errors(),Lifecycle.snapshot().errors)));
    if(backend==='webgl'&&GLR.renderer.getContext().isContextLost())throw new Error('WebGL 上下文已丢失');
  }
  async function bounded(promise,signal,ms,message){
    var timer,abort;
    try{canceled(signal);return await Promise.race([promise,new Promise(function(_,reject){
      timer=setTimeout(function(){reject(new Error(message));},ms);
      abort=function(){reject(new DOMException('测试已停止','AbortError'));};signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
    })]);}finally{clearTimeout(timer);if(abort)signal.removeEventListener('abort',abort);}
  }
  async function complete(signal){
    canceled(signal);
    if(options.backend==='webgl'){GLR.renderer.getContext().finish();return;}
    await bounded(GLR.renderer.backend.device.queue.onSubmittedWorkDone(),signal,15000,'GPU 完成帧超时');
  }
  function adapter(){
    if(options.backend==='webgpu'){var i=GLR.renderer.backend.device.adapterInfo;return i?{vendor:i.vendor,architecture:i.architecture,device:i.device,description:i.description}:{description:'浏览器未提供适配器信息'};}
    var gl=GLR.renderer.getContext(),e=gl.getExtension('WEBGL_debug_renderer_info');return {vendor:e?gl.getParameter(e.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR),description:e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};
  }
  function meta(){
    var objects=[];GLR.scene.updateMatrixWorld(true);(GLR.roomMesh||GLR.outMesh).traverse(function(o){if(o.isMesh){var g=o.geometry,p=g&&g.getAttribute('position');objects.push([p?p.count:0,g&&g.index?g.index.count:0,o.visible,o.matrixWorld.elements.map(function(v){return +v.toFixed(5);})]);}});
    return {quality:QUALITY,viewport:[innerWidth,innerHeight,devicePixelRatio],drawingBuffer:[GLR.renderer.domElement.width,GLR.renderer.domElement.height],target:[GLR.rt.width,GLR.rt.height],samples:GLR.rt.samples||0,
      canvasSamples:options.backend==='webgpu'?0:GLR.renderer.getContext().getParameter(GLR.renderer.getContext().SAMPLES),
      canvasAntialias:options.backend==='webgpu'?false:GLR.renderer.getContext().getContextAttributes().antialias,
      sceneFingerprint:parent.RenderBenchmarkCore.fingerprint(JSON.stringify(objects)),camera:{position:GLR.cam.position.toArray(),quaternion:GLR.cam.quaternion.toArray(),fov:GLR.cam.fov,near:GLR.cam.near},metrics:Engine.metrics(),adapter:adapter(),backend:Engine.status()};
  }
  async function ready(signal){
    await until(function(){if(typeof PHOTO_TRIED!=='undefined')PHOTO_TRIED=true;return window.Engine&&(Engine.ready()||Engine.status().phase==='failed');},signal,45000,'渲染器');
    if(!Engine.ready())return {available:false,actual:Engine.status()};
    var actual=Engine.status();
    if(actual.backend!==options.backend)return {available:false,actual:actual};
    await until(function(){return window.Assets&&Assets.ready();},signal,45000,'模型包');
    if(document.fonts)await bounded(document.fonts.ready,signal,45000,'字体准备超时');
    PHOTO_TRIED=true;running=false;clearIntroTimers();Lifecycle.scope('session').cancel();
    GameRandom.bind(RandomRules.create(options.seed).next);PresentationRandom.seed(options.seed);
    freshState('hard');running=false;clearIntroTimers();S.intro=0;PRO.on=false;CUT.enabled=false;
    Mechanics.runSeed='render-benchmark-'+options.seed;
    DEV.on=true;DEV.freeze=true;S.screen='play';S.day=1;S.tsec=760;S.san=100;S.bag=[];S.seated=false;
    AN.active=false;AN.next=1e9;RT.inspection=null;PAUSE.on=false;Sensory.reset();Engine.resetSan(100);
    if(options.quality!==QUALITY)Settings.q(options.quality);
    await until(function(){return Assets.ready();},signal,90000,'目标画质模型包');
    check(options.backend);
    var style=document.createElement('style');style.textContent='body>*:not(canvas){visibility:hidden!important}canvas{pointer-events:none!important}';document.head.appendChild(style);
    return {available:true,actual:actual};
  }
  async function prepare(scene,signal){
    canceled(signal);check(options.backend);GameRandom.bind(RandomRules.create(options.seed).next);PresentationRandom.seed(options.seed);
    if(scene==='classroom'){
      doEnterRoom('teach1',Object.assign(ClassroomLayout.anchor(INTERIORS.teach1,ClassroomLayout.ownSeat),{seated:true}));
    }else if(scene==='stairs'){
      var p=StairWorld.point('stair_teach_w',{x:-1.25,z:3.2,h:.8});doEnterRoom(p.scene,{x:p.x,y:p.y,stairHeight:p.fy,ang:Math.PI/2});
    }else if(scene==='outdoor'){
      S.mode='out';S.room=null;S.x=1580;S.y=1800;S.ang=-Math.PI/2;S.seated=false;S.floorY=0;enterWorldOut();
    }else throw new Error('未知场景');
    await until(function(){return Assets.ready()&&(S.mode==='out'?!!GLR.outMesh:GLR.roomMesh&&GLR.roomMesh.userData.roomData===INTERIORS[S.room]);},signal,45000,'场景模型');
    S.pitch=0;VisualState.time=12;Engine.resetCamera();syncCamera(0);Sensory.reset();
    var renderer=GLR.renderer,previous=renderer.getRenderTarget();
    try{
      renderer.setRenderTarget(GLR.rt);
      await bounded(renderer.compileAsync(GLR.scene,GLR.cam),signal,90000,'场景管线准备超时');
      renderer.setRenderTarget(null);
      await bounded(ThreeBackend.compilePost(),signal,90000,'后期管线准备超时');
    }finally{renderer.setRenderTarget(previous);}
    canceled(signal);
    var start=performance.now(),frames=0;
    while(performance.now()-start<options.warmMs||frames<3){await frame(signal,frames++);}
    check(options.backend);return meta();
  }
  async function frame(signal,index){
    await nextFrame(signal);canceled(signal);check(options.backend);
    VisualState.time=12;GLR.dustT=12;syncCamera(0);
    var start=performance.now();Engine.draw(1/60);var submit=performance.now();
    await complete(signal);var end=performance.now();check(options.backend);
    return {startMs:start,submitMs:submit-start,completeMs:end-start,calls:Engine.metrics().calls};
  }
  async function measure(scene,signal,onProgress){
    var m=await prepare(scene,signal);
    if(options.mode!=='sync')return measureContinuous(scene,m,signal,onProgress);
    var samples=[],start=performance.now(),last=null;
    while(performance.now()-start<options.sampleMs||samples.length<3){
      var sample=await frame(signal,samples.length);sample.intervalMs=last===null?null:sample.startMs-last;last=sample.startMs;samples.push(sample);
      if(onProgress)onProgress(Math.min(1,(performance.now()-start)/options.sampleMs));
    }
    if(JSON.stringify(m)!==JSON.stringify(meta())){
      var end=meta();if(JSON.stringify([m.viewport,m.drawingBuffer,m.target,m.samples,m.canvasSamples,m.canvasAntialias,m.sceneFingerprint,m.camera])!==JSON.stringify([end.viewport,end.drawingBuffer,end.target,end.samples,end.canvasSamples,end.canvasAntialias,end.sceneFingerprint,end.camera]))throw new Error('采样期间场景或分辨率变化，本轮数据无效');
    }
    return {scene:scene,status:'ok',mode:'sync',backend:options.backend,meta:m,samples:samples};
  }
  // Queue up to two frames. Poll completion without blocking the main thread; never call
  // finish() or await GPU completion after every draw. Drain the tail before scoring throughput.
  async function measureContinuous(scene,m,signal,onProgress){
    var samples=[],pending=[],start=null,last=null,stop=0,submittedEnd=0,lastDone=0;
    var gl=options.backend==='webgl'?GLR.renderer.getContext():null;
    function poll(){
      pending=pending.filter(function(job){
        if(gl){var status=gl.clientWaitSync(job.fence,0,0);
          if(status===gl.WAIT_FAILED)throw new Error('GPU 完成同步失败');
          job.done=status===gl.ALREADY_SIGNALED||status===gl.CONDITION_SATISFIED;}
        if(!job.done&&performance.now()-job.start>15000)throw new Error('GPU 完成帧超时');
        if(job.error)throw job.error;
        if(job.done){lastDone=Math.max(lastDone,job.end||performance.now());if(gl){gl.deleteSync(job.fence);job.fence=null;}}
        return !job.done;
      });
    }
    try{
      while(start===null||performance.now()<stop||samples.length<3){
        await nextFrame(signal);canceled(signal);check(options.backend);poll();
        if(start!==null&&performance.now()>=stop&&samples.length>=3)break;
        if(pending.length>=2)continue;
        VisualState.time=12;GLR.dustT=12;syncCamera(0);
        var now=performance.now();if(start===null){start=now;stop=start+options.sampleMs;}
        Engine.draw(1/60);var end=performance.now();
        samples.push({startMs:now,submitMs:end-now,completeMs:null,intervalMs:last===null?null:now-last,calls:Engine.metrics().calls});last=now;submittedEnd=end;
        var job={start:now,done:false,error:null};pending.push(job);
        if(gl){job.fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);if(!job.fence)throw new Error('无法创建 GPU 完成标记');gl.flush();}
        else (function(j){GLR.renderer.backend.device.queue.onSubmittedWorkDone().then(function(){j.done=true;j.end=performance.now();},function(e){j.error=e;});})(job);
        if(onProgress)onProgress(Math.min(1,(end-start)/options.sampleMs));
      }
      while(pending.length){canceled(signal);check(options.backend);poll();if(pending.length)await wait(1,signal);}
      var endMeta=meta(),keys=['quality','viewport','drawingBuffer','target','samples','canvasSamples','canvasAntialias','sceneFingerprint','camera'];
      if(keys.some(function(k){return JSON.stringify(m[k])!==JSON.stringify(endMeta[k]);}))throw new Error('采样期间场景或分辨率变化，本轮数据无效');
      return {scene:scene,status:'ok',mode:'continuous',backend:options.backend,meta:m,samples:samples,
        timing:{elapsedMs:Math.max(submittedEnd,lastDone)-start,drainMs:Math.max(0,lastDone-submittedEnd),maxInFlight:2}};
    }finally{if(gl)pending.forEach(function(j){if(j.fence)gl.deleteSync(j.fence);});}
  }
  async function dispose(){
    if(typeof running!=='undefined')running=false;
    if(typeof GLR==='undefined'||!GLR.renderer)return;
    var renderer=GLR.renderer;GLR.renderer=null;
    var quiet=new AbortController().signal,device=renderer.backend&&renderer.backend.device;
    try{await bounded(Promise.resolve(renderer.dispose()),quiet,3000,'资源释放超时');}catch(ignore){}
    if(device){device.destroy();try{await bounded(device.lost,quiet,3000,'设备释放超时');}catch(ignore){}}
    else if(renderer.isWebGLRenderer){
      var canvas=renderer.domElement;
      await new Promise(function(resolve){var timer;
        function finish(){clearTimeout(timer);canvas.removeEventListener('webglcontextlost',finish);resolve();}
        canvas.addEventListener('webglcontextlost',finish,{once:true});timer=setTimeout(finish,3000);renderer.forceContextLoss();
      });
    }
  }
  window.RenderBenchmarkRunner={ready:ready,measure:measure,diagnostic:function(){return {url:location.href,base:document.baseURI,readyState:document.readyState,engine:typeof Engine!=='undefined'?Engine.status():null,quality:typeof QUALITY!=='undefined'?QUALITY:null,assets:typeof Assets!=='undefined'?{want:Assets.want(),ready:Assets.ready(),loaded:Object.keys(ASSETS.packs),errors:ASSETS.errors}:null,scripts:Array.from(document.scripts).slice(-3).map(function(s){return s.src;}),errors:errors};},dispose:dispose};
})();
