/* @module-capsule */
(function($imports){
/* Renderer selection and device lifetime. The input canvas stays mounted during recovery. */
'use strict';
var RenderDevice=(function(){
  var phase='idle',backend=null,requested='auto',fallbackReason=null,library=null,loading=null,recovery=null;
  var startupError=null,diagnostic=null,disposed=new WeakSet();
  function status(){return {phase:phase,backend:backend,requested:requested,fallbackReason:fallbackReason,diagnostic:diagnostic};}
  function preference(){
    var query=new URLSearchParams(location.search).get('renderer');
    return ['auto','webgpu','webgl'].includes(query)?query:$imports.SET.renderer==='webgl'?'webgl':'auto';
  }
  function surface(){
    var cv=document.createElement('canvas');cv.className='render-surface';cv.setAttribute('aria-hidden','true');
    return cv;
  }
  function mount(renderer){
    var old=document.querySelector('.render-surface');
    if(old)old.replaceWith(renderer.domElement);
    else document.getElementById('cv').before(renderer.domElement);
  }
  function dispose(renderer){
    if(!renderer||disposed.has(renderer))return;disposed.add(renderer);
    try{Promise.resolve(renderer.dispose()).catch(function(){});}catch(e){}
    try{if(renderer.backend&&renderer.backend.device)renderer.backend.device.destroy();}catch(e){}
  }
  function load(){
    if(library)return Promise.resolve(library);
    if(loading)return loading;
    loading=new Promise(function(resolve,reject){
      var script=document.createElement('script');var gpuSrc=GameModules.src('game3d/lib/three-webgpu.min.js');script.src=gpuSrc.indexOf('blob:')===0?gpuSrc:new URL(gpuSrc,document.baseURI).href;   /* 单文件版是 blob 地址 */
      script.onload=function(){
        var lib=window.WdfzWebGPU;
        if(!lib||!lib.WebGPURenderer){reject(new Error('gpu-library-invalid'));return;}
        library=lib;resolve(lib);
      };
      script.onerror=function(){script.remove();loading=null;reject(new Error('gpu-library-unavailable'));};
      document.head.appendChild(script);
    });
    return loading;
  }
  function webgl(){return new $imports.THREE.WebGLRenderer({canvas:surface(),antialias:true,powerPreference:'high-performance'});}
  function deadline(promise,ms,late){
    return new Promise(function(resolve,reject){
      var done=false,t=setTimeout(function(){done=true;reject(new Error('gpu-timeout'));},ms);
      promise.then(function(value){if(done){if(late)late(value);return;}done=true;clearTimeout(t);resolve(value);},
        function(error){if(done)return;done=true;clearTimeout(t);reject(error);});
    });
  }
  async function createGPU(){
    var lib=await load(),renderer;
    try{
      renderer=new lib.WebGPURenderer({canvas:surface(),alpha:false,antialias:false,
        powerPreference:'high-performance',outputBufferType:$imports.THREE.UnsignedByteType});
      // Keep the proven WebGLRenderer fallback, rather than Three's different node-based WebGL backend.
      renderer._getFallback=null;
      await renderer.init();
      if(!renderer.backend.isWebGPUBackend)throw new Error('gpu-backend-unavailable');
      var device=renderer.backend.device;
      renderer.capabilities={isWebGL2:false,isWebGPU:true,maxTextureSize:device.limits.maxTextureDimension2D,
        maxSamples:renderer.backend.compatibilityMode?0:4,getMaxAnisotropy:function(){return renderer.getMaxAnisotropy();}};
      renderer.extensions={has:function(){return false;}};
      function lost(info){
        startupError=String(info&&info.message||'gpu-device-lost');
        if(phase==='ready'&&$imports.GLR.renderer===renderer)fallback('gpu-device-lost');
      }
      renderer.onDeviceLost=lost;device.lost.then(lost);
      renderer.onError=function(info){
        startupError=String(info&&info.message||info||'gpu-error');
        if(phase==='ready'&&$imports.GLR.renderer===renderer)fallback('gpu-render-error');
      };
      return renderer;
    }catch(e){dispose(renderer);throw e;}
  }
  async function create(){
    phase='starting';requested=preference();fallbackReason=null;startupError=null;diagnostic=null;
    if(requested!=='webgl'){
      if(!window.isSecureContext)fallbackReason='insecure-context';
      else if(!navigator.gpu)fallbackReason='gpu-unavailable';
      else{
        try{var gpu=await deadline(createGPU(),12000,dispose);backend='webgpu';return gpu;}
        catch(e){diagnostic=String(e.stack||e);fallbackReason=/gpu-library/.test(String(e))?'gpu-library-unavailable':/gpu-timeout/.test(String(e))?'gpu-timeout':'gpu-init-failed';}
      }
    }
    var gl=webgl();backend='webgl';return gl;
  }
  function activate(renderer){mount(renderer);phase='ready';startupError=null;}
  function failed(){phase='failed';}
  async function fallback(reason,error){
    if(recovery)return recovery;
    if(backend!=='webgpu')return;
    fallbackReason=reason;diagnostic=error?String(error.stack||error):startupError;phase='recovering';
    recovery=Promise.resolve().then(function(){
      var old=$imports.GLR.renderer,gl=webgl();backend='webgl';
      try{if($imports.GLR.postMat&&$imports.GLR.glPost)$imports.ThreeBackend.replaceRenderer(gl);else $imports.ThreeBackend.setup(gl);activate(gl);}
      catch(e){dispose(gl);phase='failed';throw e;}
      finally{dispose(old);}
      var message=document.getElementById('rendererNotice');
      if(message){message.textContent='画面已切换到兼容模式，游戏进度已保留。';message.hidden=false;}
      return gl;
    }).catch(function(e){failed();showRendererError();$imports.Lifecycle.report('renderer-recovery',e);}).finally(function(){recovery=null;});
    return recovery;
  }
  function showRendererError(){
    var el=document.getElementById('rendererError');if(el)el.hidden=false;
  }
  return {create:create,activate:activate,failed:failed,fallback:fallback,status:status,
    library:function(){return library;},gpu:function(){return backend==='webgpu';},
    ready:function(){return phase==='ready';},startupError:function(){return startupError;},
    prepare:function(promise){return deadline(promise,15000);},showError:showRendererError,dispose:dispose};
})();

/* @module-exports */
GameModules.publish("game3d/js/engine/device.js",{
"RenderDevice":{get:function(){return RenderDevice;},set:function($value){RenderDevice=$value;}}
});
})(GameModules.imports("game3d/js/engine/device.js"));
