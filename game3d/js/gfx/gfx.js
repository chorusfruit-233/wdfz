/* 里世界 3D · 渲染层
   游戏逻辑只管往 GLR.scene 里摆东西、挪相机（three.js 的场景图就是「场景描述」）；
   每帧怎么把它画出来交给这里选中的后端：
     three   —— Three.js：场景 → 离屏缓冲 → 手持物单独一遍 → 后期着色器（流畅 / 均衡 / 精细）
     babylon —— Babylon.js：把同一份场景镜像到 Babylon 里画，加环境光遮蔽、4096 软阴影、抗锯齿（超精细）
   后端按画质自动选（quality.js 的 engine），也可以在设置里手动指定。
   Babylon 的库有 7 MB，第一次用到时才从 game3d/lib/ 加载（离线、双击 index.html 也能用）；
   加载或初始化失败就退回 Three.js，并提示一下。 */
'use strict';

var GFX={backends:{}, cur:null, loading:null, failed:{}, libs:{}};
/* 按需加载的库登记在脚本清单（manifest.js）里 */
(function(){ var M=(typeof WDFZ_MANIFEST!=='undefined')?WDFZ_MANIFEST:{base:'game3d/',lazy:{babylon:['lib/babylon.js']}}, k;
  for(k in M.lazy) GFX.libs[k]=M.lazy[k].map(function(u){ return M.base+u; }); })();
GFX.register=function(name,impl){ impl.name=name; GFX.backends[name]=impl; };
/* 按顺序插 <script>（file:// 下也能用，不走 XHR） */
GFX.loadLibs=function(list,done,fail){
  var i=0;
  (function next(){
    if(i>=list.length){ done(); return; }
    var s=document.createElement('script');
    s.src=list[i++]; s.async=false;
    s.onload=next; s.onerror=function(){ fail('加载 '+s.src+' 失败'); };
    document.head.appendChild(s);
  })();
};
GFX.name=function(){ return GFX.cur?GFX.cur.name:'three'; };
/* 设置或画质变了：切到该用的后端 */
GFX.select=function(){
  var want=qualityEngine();
  if(GFX.failed[want]) want='three';
  if(GFX.cur&&GFX.cur.name===want){ GFX.cur.configure&&GFX.cur.configure(); return; }
  var B=GFX.backends[want];
  function go(){
    try{
      if(!B.inited){ B.init(); B.inited=true; }
      if(GFX.cur&&GFX.cur!==B&&GFX.cur.deactivate) GFX.cur.deactivate();
      GFX.cur=B; B.activate&&B.activate(); B.configure&&B.configure(); GFX.resize();
    }catch(e){
      GFX.failed[want]=String(e&&e.message||e);
      try{ console.warn('渲染后端 '+want+' 初始化失败：',e); }catch(_e){}
      try{ toast('这台设备用不了 '+(want==='babylon'?'Babylon.js':want)+'，改用 Three.js'); }catch(_e){}
      GFX.cur=GFX.backends.three; GFX.cur.activate&&GFX.cur.activate(); GFX.resize();
    }
  }
  if(!B){ GFX.failed[want]='没有这个后端'; GFX.select(); return; }
  if(B.ready&&!B.ready()){
    if(GFX.loading===want) return;
    GFX.loading=want;
    try{ toast('正在加载 '+(want==='babylon'?'Babylon.js':want)+' 引擎……'); }catch(e){}
    GFX.loadLibs(GFX.libs[want]||[],function(){ GFX.loading=null; if(qualityEngine()===want) go(); },
      function(msg){ GFX.loading=null; GFX.failed[want]=msg; try{ toast(msg+'，改用 Three.js'); }catch(e){} GFX.select(); });
    if(!GFX.cur){ GFX.cur=GFX.backends.three; GFX.cur.activate&&GFX.cur.activate(); }
    return;
  }
  go();
};
GFX.frame=function(dt){ (GFX.cur||GFX.backends.three).frame(dt); };
GFX.resize=function(){ var B=GFX.cur; if(B&&B.resize) B.resize(); };
