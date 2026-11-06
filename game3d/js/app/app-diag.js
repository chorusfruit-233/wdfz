/* @module-capsule */
(function($imports){
/* 设备诊断（2026-11-06，安卓版贴图、连廊、声音问题排查用；只读，不改游戏状态）
   · 设置「设备诊断」：显示设备与渲染、贴图包、着色器报错、最近的脚本报错、声音状态，可以复制给开发者
   · 安卓版（?app=android）：报告和报错同时发给 App 的本机服务 /__app/log，写进系统日志
   · ?diag=1：自动跑一遍诊断路线（主菜单的声音 → 等一下点击 → 几个场景），每一站打一行「WDFZDIAG SHOT 名字」，
     CI 的安卓模拟器按这个时机截屏（tools/android_diag.sh） */
'use strict';
var AppDiag=(function(){
  var errors=[], shaders=[], lost=0, gesture=0, hooked=false;
  function shell(){ try{ return $imports.APP_SHELL||''; }catch(e){ return ''; } }
  function diagMode(){ try{ return /[?&]diag=1(?:&|$)/.test(location.search); }catch(e){ return false; } }
  function send(line){
    if(shell()!=='android') return;
    try{ var s=String(line); for(var i=0;i<s.length;i+=700) fetch('/__app/log?m='+encodeURIComponent(s.slice(i,i+700)),{cache:'no-store'}).catch(function(){}); }catch(e){}
  }
  function note(kind,msg){
    var line=kind+': '+String(msg).slice(0,600);
    errors.push(line); if(errors.length>20) errors.shift();
    send('ERR '+line);
  }
  function hook(){
    if(hooked) return; hooked=true;
    window.addEventListener('error',function(e){ note('error',(e.message||e)+(e.filename?' @'+String(e.filename).slice(-60)+':'+e.lineno:'')); });
    window.addEventListener('unhandledrejection',function(e){ note('promise',e.reason&&(e.reason.stack||e.reason.message)||e.reason); });
    ['error','warn'].forEach(function(k){
      var orig=console[k]; console[k]=function(){ try{ note('console.'+k,Array.prototype.map.call(arguments,function(a){ return a&&a.message?a.message:String(a); }).join(' ')); }catch(e){} return orig.apply(console,arguments); };
    });
    ['pointerdown','touchend','keydown'].forEach(function(ev){ document.addEventListener(ev,function(){ gesture++; },{capture:true,passive:true}); });
  }
  function watchRenderer(){
    try{
      var r=$imports.GLR.renderer; if(!r||r.__diag) return; r.__diag=true;
      if(r.debug) r.debug.onShaderError=function(gl,program,vs,fs){
        var log='';try{ log=(gl.getProgramInfoLog(program)||'')+' | '+(gl.getShaderInfoLog(fs)||'')+' | '+(gl.getShaderInfoLog(vs)||''); }catch(e){}
        shaders.push(log.slice(0,400)); if(shaders.length>8) shaders.shift(); send('SHADER '+log.slice(0,1200));
      };
      var cv=r.domElement; if(cv) cv.addEventListener('webglcontextlost',function(){ lost++; send('CONTEXT LOST'); });
    }catch(e){}
  }
  function gpu(){
    var o={};
    try{
      var r=$imports.GLR.renderer, gl=r&&r.getContext&&r.getContext(); o.engine=$imports.Engine.status();
      if(gl&&gl.getParameter){
        var ext=gl.getExtension('WEBGL_debug_renderer_info');
        o.gpu=ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
        o.vendor=ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR);
        o.gl=gl.getParameter(gl.VERSION);
        o.maxTex=gl.getParameter(gl.MAX_TEXTURE_SIZE); o.texUnits=gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
        o.fragUniforms=gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS); o.varyings=gl.getParameter(gl.MAX_VARYING_VECTORS);
        o.depthBits=gl.getParameter(gl.DEPTH_BITS);
        var hp=gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER,gl.HIGH_FLOAT); o.fragHighp=hp?hp.precision:0;
        var hv=gl.getShaderPrecisionFormat(gl.VERTEX_SHADER,gl.HIGH_FLOAT); o.vertHighp=hv?hv.precision:0;
        o.programs=r.info.programs?r.info.programs.length:0;
        var bad=0; (r.info.programs||[]).forEach(function(p){ try{ if(p.program&&!gl.getProgramParameter(p.program,gl.LINK_STATUS)) bad++; }catch(e){} }); o.badPrograms=bad;
        o.glError=gl.getError();
        o.pixelRatio=r.getPixelRatio(); o.lost=lost;
      }
    }catch(e){ o.err=String(e); }
    return o;
  }
  function textures(){
    var o={};
    try{
      var P=$imports.TEXP&&$imports.TEXP.packs;
      if(P) Object.keys(P).forEach(function(res){ var p=P[res],n=0,bad=0; Object.keys(p.img).forEach(function(k){ p.img[k].forEach(function(im){ n++; if(!im.naturalWidth) bad++; }); }); o[res]={ready:p.ready,images:n,failed:bad}; });
      o.assets=$imports.Assets.ready();
    }catch(e){ o.err=String(e); }
    return o;
  }
  function audio(){
    var o={};
    try{
      o.available=$imports.SFX.available(); o.bgm=+($imports.SFX.bgmLevel()||0).toFixed(3);
      o.ctx=$imports.SFX.state?$imports.SFX.state():'?';
      if(navigator.getAutoplayPolicy) o.policy=navigator.getAutoplayPolicy('audiocontext');
      o.musicOn=!!$imports.AMB_ON; o.vol=$imports.SET.vol; o.gestures=gesture;
    }catch(e){ o.err=String(e); }
    return o;
  }
  function scene(){
    var o={};
    try{
      o.screen=$imports.S.screen; o.mode=$imports.S.mode; o.room=$imports.S.room;
      var g=$imports.GLR.roomMesh, links=0, stairs=0;
      if(g) g.traverse(function(m){ if(m.userData&&m.userData.campusLinkPreview) links++; if(m.userData&&m.userData.previewLevel!==undefined) stairs++; });
      o.linkPreviews=links; o.stairPreviews=stairs;
      var lights=0; $imports.GLR.scene.traverse(function(m){ if(m.isLight&&m.visible) lights++; }); o.lights=lights;
      o.quality=$imports.SET.q; o.renderer=$imports.SET.renderer;
    }catch(e){ o.err=String(e); }
    return o;
  }
  function report(){
    watchRenderer();
    var o={shell:shell()||'web',ua:navigator.userAgent,screen:[window.innerWidth,window.innerHeight,window.devicePixelRatio],
      gpu:gpu(),textures:textures(),audio:audio(),scene:scene(),shaderErrors:shaders.slice(),errors:errors.slice(-10)};
    return o;
  }
  function text(){ return JSON.stringify(report(),null,1); }
  function open(){
    var box=document.getElementById('diagOut'); if(!box) return;
    box.hidden=false; box.textContent=text(); send('REPORT '+JSON.stringify(report()));
    var c=document.getElementById('diagCopy'); if(c) c.hidden=false;
  }
  function copy(){
    var t=text();
    try{ navigator.clipboard.writeText(t).then(function(){ (0,$imports.toast)('诊断信息已复制'); },function(){ (0,$imports.toast)('复制不了：请长按上面的文字选中复制'); }); }
    catch(e){ (0,$imports.toast)('复制不了：请长按上面的文字选中复制'); }
  }
  /* ---- ?diag=1：自动诊断路线 ---- */
  function wait(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }
  function until(f,ms){ var t0=Date.now(); return new Promise(function(r){ (function poll(){ var ok=false; try{ ok=f(); }catch(e){} if(ok||Date.now()-t0>ms) r(ok); else setTimeout(poll,250); })(); }); }
  function shot(name,extra){ send('SHOT '+name+' '+JSON.stringify({scene:scene(),audio:audio(),gpu:gpu(),extra:extra||null})); }
  /* 用定时器而不是 requestAnimationFrame：系统弹窗盖着、或软件渲染很慢时 rAF 可能停住，诊断路线不能跟着卡死 */
  function keepRendering(ms){ var t0=Date.now(),frames=0; return new Promise(function(r){ (function f(){ var a=Date.now(); try{ (0,$imports.render)(0); frames++; }catch(e){ note('render',e); } var dt=Date.now()-a; if(Date.now()-t0<ms) setTimeout(f,Math.max(16,Math.min(dt,500))); else r({frames:frames,lastMs:dt}); })(); }); }
  function place(js){ try{ js(); (0,$imports.syncCamera)(0); (0,$imports.updateHUD)(); }catch(e){ note('place',e&&e.stack||e); } }
  async function tour(){
    send('BOOT '+JSON.stringify({ua:navigator.userAgent}));
    await until(function(){ return $imports.Engine.ready()&&$imports.Assets.ready(); },90000);
    watchRenderer();
    await wait(16000);                                                     /* 等启动层演完 */
    shot('menu',{note:'before tap'});
    var g0=gesture; await until(function(){ return gesture>g0; },30000);   /* CI 在这时点一下屏幕 */
    await wait(2500); shot('menu_tap',{note:'after tap'});
    try{ $imports.PHOTO_TRIED=true; }catch(e){}
    $imports.running=false; document.getElementById('menu').style.display='none'; $imports.S.screen='play';
    try{ $imports.PRO.on=false; $imports.CUT.enabled=false; }catch(e){}
    $imports.S.tsec=858; (0,$imports.addItem)('torch'); $imports.USE.torch=true;
    var stops=[
      ['teach2_stair',function(){ var s=$imports.STAIR_LAYOUT[0],p=$imports.StairWorld.insidePort(s,1,22); (0,$imports.doEnterRoom)(p.scene,{x:p.x+14,y:p.y}); $imports.S.ang=Math.PI/2+0.75; $imports.S.pitch=0.05; }],
      ['stairwell',function(){ var p=$imports.StairWorld.point('stair_teach_w',{x:1.6,z:0.3,h:0}); (0,$imports.doEnterRoom)(p.scene,{x:p.x,y:p.y,stairHeight:0}); $imports.S.ang=Math.PI/2+0.55; $imports.S.pitch=0.25; }],
      ['teach2_link',function(){ var v=$imports.CampusLink.ports('teach2')[0]; (0,$imports.doEnterRoom)('teach2',{x:v.self.x-v.self.n[0]*40,y:v.self.y-v.self.n[1]*40}); $imports.S.ang=Math.atan2(v.self.n[1],v.self.n[0]); $imports.S.pitch=0; }],
      ['admin1',function(){ (0,$imports.doEnterRoom)('admin1'); $imports.S.ang=0; $imports.S.pitch=0; }],
      ['teach3',function(){ (0,$imports.doEnterRoom)('teach3'); $imports.S.ang=Math.PI; $imports.S.pitch=0; }],
      ['outdoor',function(){ (0,$imports.doExitRoom)(); $imports.S.x=1580; $imports.S.y=1800; $imports.S.ang=0; $imports.S.pitch=0; }]
    ];
    for(var i=0;i<stops.length;i++){
      send('STOP '+stops[i][0]); var t0=Date.now(); place(stops[i][1]); var tp=Date.now()-t0; var kr=await keepRendering(2500); shot(stops[i][0],{placeMs:tp,render:kr}); await keepRendering(3000);
    }
    send('DONE '+JSON.stringify(report()));
  }
  function init(){
    hook();
    if(diagMode()) setTimeout(function(){ tour().catch(function(e){ note('tour',e&&e.stack||e); send('DONE failed'); }); },0);
  }
  return {init:init,report:report,text:text,open:open,copy:copy,send:send};
})();
try{ AppDiag.init(); }catch(e){}

/* @module-exports */
GameModules.publish("game3d/js/app/app-diag.js",{
"AppDiag":{get:function(){return AppDiag;},set:function($value){AppDiag=$value;}}
});
})(GameModules.imports("game3d/js/app/app-diag.js"));
