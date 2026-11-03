/* 里世界 3D · 模块注册表、钩子与 Mod 入口
   规范见 docs/模块化与Mod规范.md。这一份最先加载，不依赖任何游戏脚本。

   ┌ 模块（module）：game3d/manifest.js 里登记的一组脚本，负责一块功能（存档、电梯、虚空迷宫……）。
   │   以后改哪块功能，只看这块模块登记的文件和它声明的「导出」「钩子」。
   ├ 钩子（hook）：核心流程在固定时机喊一声（tick、进房间、交互、存档……），模块和 Mod 在这里挂自己的逻辑，
   │   不用去改主循环。某个监听出错只记录并跳过，不拖垮游戏。
   └ Mod：玩家或测试者写的附加脚本。三种来源：
       ① game3d/mods/ 里内置、在 game3d/mods/index.js 登记的；② 网址 ?mod=名字（加载 game3d/mods/名字.js，不用登记）；
       ③ 调试面板「Mod」页上传的 .js（存在本机浏览器里）。网址加 ?nomod 进入安全模式：一个 Mod 都不加载。 */
'use strict';

var GameModules=(function(){
  var API_VERSION='1.0';
  var STORE_KEY='wdfz_mods';           /* 上传的 Mod：[{id,name,code,enabled,added}] */
  var ENABLE_KEY='wdfz_mods_on';        /* 内置 Mod 的开关：{id:true} */
  var modules=[], byId={}, hooks={}, mods=[], modById={}, errors=[], persist=[], builtin=[], loaded=false;
  var EMPTY=[],modServices=Object.create(null);
  function bindModServices(services){modServices=Object.freeze(Object.assign(Object.create(null),services));}
  function service(name,args,fallback){return typeof modServices[name]==='function'?modServices[name].apply(null,args):fallback;}
  /* 文件级依赖端口。实现留在各自闭包；window 仅保留旧 HTML、Mod 和工具的兼容外观。 */
  var contracts=Object.create(null),symbols=Object.create(null),linked=Object.create(null);
  function configureContracts(list){
    (list||[]).forEach(function(c){
      if(!c||!c.file||contracts[c.file])throw new Error('重复或非法文件契约：'+(c&&c.file));
      contracts[c.file]=c;
    });
  }
  var readViews=new WeakMap();
  function readView(value){
    if(!value||typeof value!=='object'||Object.isFrozen(value))return value;
    if(readViews.has(value))return readViews.get(value);
    function denied(){throw new TypeError('表现层不能写入玩法状态');}
    var view=new Proxy(value,{get:function(target,key){return readView(Reflect.get(target,key));},
      set:denied,deleteProperty:denied,defineProperty:denied,setPrototypeOf:denied});
    readViews.set(value,view);return view;
  }
  function importFile(file){
    var c=contracts[file];if(!c)throw new Error('文件未声明依赖：'+file);
    var ports=Object.create(null);
    Object.keys(c.imports||{}).forEach(function(name){
      var owner=c.imports[name];
      Object.defineProperty(ports,name,{enumerable:true,get:function(){
        var binding=symbols[name];
        if(binding&&binding.file!==owner)throw new Error('接口归属不匹配：'+file+' → '+name);
        var value=binding?binding.get():undefined;
        return (c.readonly||[]).indexOf(name)>=0?readView(value):value;
      },set:function(value){
        if((c.writes||[]).indexOf(name)<0)throw new Error('未授权替换接口：'+file+' → '+name);
        var binding=symbols[name];if(!binding||!binding.set)throw new Error('接口不可替换：'+name);
        binding.set(value);
      }});
    });
    return Object.freeze(ports);
  }
  function publishFile(file,definitions){
    var c=contracts[file];if(!c)throw new Error('文件未声明导出：'+file);
    if(linked[file])throw new Error('文件重复发布：'+file);
    var actual=Object.keys(definitions),expected=c.provides||[];
    if(actual.length!==expected.length||expected.some(function(n){return !definitions[n];}))throw new Error('文件导出与契约不同：'+file);
    actual.forEach(function(name){
      if(symbols[name])throw new Error('接口重复归属：'+name);
      var d=definitions[name];if(typeof d.get!=='function')throw new Error('接口缺少读取器：'+name);
      symbols[name]={file:file,get:d.get,set:d.set};
      var legacy=Object.getOwnPropertyDescriptor(globalThis,name);
      if(!c.standalone&&(!legacy||legacy.configurable))Object.defineProperty(globalThis,name,{configurable:true,enumerable:true,get:d.get,set:d.set});
    });
    linked[file]=true;
  }
  /* 独立纯规则仍可直接在 Node 中读取；浏览器加载后登记同一份对象，不复制状态。 */
  function adoptFile(file){
    var c=contracts[file];if(!c||!c.standalone)return;
    var out=Object.create(null);
    (c.provides||[]).forEach(function(name){out[name]={get:function(){return globalThis[name];},set:function(v){globalThis[name]=v;}};});
    publishFile(file,out);
  }
  function dependencySnapshot(){
    return Object.keys(contracts).map(function(file){var c=contracts[file];return {file:file,module:c.module,layer:c.layer,readonly:(c.readonly||[]).slice(),standalone:!!c.standalone,
      imports:Object.assign({},c.imports),provides:(c.provides||[]).slice(),writes:(c.writes||[]).slice(),linked:!!linked[file]};});
  }

  function qs(){ try{ return location.search||''; }catch(e){ return ''; } }
  function param(name){
    var m=new RegExp('[?&]'+name+'(?:=([^&]*))?(?:&|$)').exec(qs());
    return m?decodeURIComponent((m[1]||'').replace(/\+/g,' ')):null;
  }
  function safeMode(){ return param('nomod')!==null; }
  function log(kind,who,e){
    var msg=(e&&e.message)?e.message:String(e);
    errors.push({kind:kind,who:who,message:msg,time:Date.now()});
    if(errors.length>50) errors.shift();
    try{ console.warn('[GameModules] '+kind+' · '+who+' · '+msg); }catch(_e){}
  }

  /* ---------- 钩子 ---------- */
  function on(name,fn,opt){
    if(typeof fn!=='function') throw new Error('钩子 '+name+' 需要一个函数');
    opt=opt||{};
    var list=hooks[name]||(hooks[name]=[]);
    list.push({fn:fn,prio:+opt.priority||0,owner:opt.owner||'core',seq:list.length});
    list.sort(function(a,b){ return (b.prio-a.prio)||(a.seq-b.seq); });
    return fn;
  }
  function off(name,fn){
    var list=hooks[name]; if(!list) return;
    hooks[name]=list.filter(function(h){ return h.fn!==fn; });
  }
  function offOwner(owner){
    Object.keys(hooks).forEach(function(name){ hooks[name]=hooks[name].filter(function(h){ return h.owner!==owner; }); });
  }
  function has(name){ var list=hooks[name]; return !!(list&&list.length); }
  /* 全部调用，返回值不管 */
  function emit(name){
    var list=hooks[name]||EMPTY; if(!list.length) return;
    var args=Array.prototype.slice.call(arguments,1);
    for(var i=0;i<list.length;i++){
      try{ list[i].fn.apply(null,args); }catch(e){ log('hook:'+name,list[i].owner,e); }
    }
  }
  /* 依次调用，第一个给出结果（不是 undefined / null / false）的作数 */
  function first(name){
    var list=hooks[name]||EMPTY; if(!list.length) return undefined;
    var args=Array.prototype.slice.call(arguments,1);
    for(var i=0;i<list.length;i++){
      try{ var v=list[i].fn.apply(null,args); if(v!==undefined&&v!==null&&v!==false) return v; }
      catch(e){ log('hook:'+name,list[i].owner,e); }
    }
    return undefined;
  }

  /* ---------- 模块登记（manifest.js 调用） ---------- */
  function define(meta){
    if(!meta||!meta.id) throw new Error('模块缺少 id');
    if(byId[meta.id]) throw new Error('模块 id 重复：'+meta.id);
    var m={id:meta.id,name:meta.name||meta.id,desc:meta.desc||'',files:(meta.files||[]).slice(),
      exports:(meta.exports||[]).slice(),emits:(meta.emits||[]).slice(),uses:(meta.uses||[]).slice(),
      status:'pending',missing:[]};
    modules.push(m); byId[m.id]=m;
    return m;
  }
  function globalType(name){
    try{ return (new Function('return typeof '+name))(); }catch(e){ return 'undefined'; }
  }
  /* 加载完以后核对：每个模块声明的导出都在 */
  function verify(){
    modules.forEach(function(m){
      m.missing=m.exports.filter(function(n){ return globalType(n)==='undefined'; });
      m.files.forEach(function(file){
        var c=contracts[file];if(!c)return;
        if(!linked[file])m.missing.push('file:'+file);
        Object.keys(c.imports||{}).forEach(function(name){
          var provider=contracts[c.imports[name]],binding=symbols[name];
          /* 可选模块整块移除时，它的接口可以缺席；已启用模块不得缺失。 */
          if(provider&&byId[provider.module]&&(!binding||binding.file!==provider.file))m.missing.push('import:'+name);
        });
      });
      m.status=m.missing.length?'missing':'ok';
      if(m.missing.length) log('verify',m.id,'缺少导出：'+m.missing.join('、'));
    });
    return modules.every(function(m){ return m.status==='ok'; });
  }

  /* ---------- 存档：模块和 Mod 各存一份，字段名就是自己的 id ---------- */
  function persistent(id,spec){
    if(!id||!spec) return;
    persist=persist.filter(function(p){ return p.id!==id; });
    persist.push({id:id,save:spec.save,load:spec.load,reset:spec.reset});
  }
  function saveAll(){
    var out=JSON.parse(JSON.stringify(retainedState));
    persist.forEach(function(p){
      if(!p.save) return;
      try{
        var v=p.save();
        if(v===undefined) delete out[p.id];
        else out[p.id]=JSON.parse(JSON.stringify(v));
      }catch(e){ log('save',p.id,e); }
    });
    retainedState=JSON.parse(JSON.stringify(out));
    return out;
  }
  /* 安全模式或临时停用模块时，保留尚无人接管的数据；只有新局才丢弃旧局状态。 */
  var retainedState={};
  function loadAll(data){
    data=(data&&typeof data==='object'&&!Array.isArray(data))?data:{};
    retainedState=JSON.parse(JSON.stringify(data));
    persist.forEach(function(p){
      try{
        if(p.reset) p.reset();
        if(p.load&&retainedState[p.id]!==undefined) p.load(JSON.parse(JSON.stringify(retainedState[p.id])));
      }catch(e){ log('load',p.id,e); }
    });
  }
  function resetAll(){
    retainedState={};
    persist.forEach(function(p){ try{ if(p.reset) p.reset(); }catch(e){ log('reset',p.id,e); } });
    emit('reset');
  }

  /* ---------- Mod ---------- */
  function mod(def){
    if(!def||!def.id||!/^[a-z0-9][a-z0-9_-]{0,47}$/i.test(def.id)) throw new Error('Mod 需要 id（字母、数字、- 和 _）');
    if(modById[def.id]) throw new Error('Mod id 重复：'+def.id);
    var m={id:def.id,name:def.name||def.id,version:def.version||'0.0.0',author:def.author||'',desc:def.desc||'',
      api:def.api||API_VERSION,source:mod.source||'code',status:'registered',def:def};
    mods.push(m); modById[m.id]=m;
    if(String(m.api).split('.')[0]!==API_VERSION.split('.')[0]){
      m.status='incompatible'; log('mod',m.id,'需要接口 '+m.api+'，当前是 '+API_VERSION); return m;
    }
    try{
      var owner='mod:'+m.id;
      if(def.hooks) Object.keys(def.hooks).forEach(function(name){ on(name,def.hooks[name],{owner:owner,priority:def.priority}); });
      if(def.persist) persistent(owner,def.persist);
      if(typeof def.init==='function') def.init(api(m));
      m.status='active';
    }catch(e){
      m.status='failed'; offOwner('mod:'+m.id);
      persist=persist.filter(function(p){ return p.id!=='mod:'+m.id; });
      log('mod',m.id,e);
    }
    return m;
  }
  /* 给 Mod 的稳定接口：只包常用、不常变的入口；需要更深的改动就直接读写全局，自担兼容风险 */
  function api(m){
    var owner='mod:'+m.id;
    return {
      version:API_VERSION, id:m.id,
      on:function(name,fn,opt){ opt=Object.assign({owner:owner},opt||{}); return on(name,fn,opt); },
      off:off,
      say:function(text,sec){return service('say',[String(text),sec||3]);},
      toast:function(text){return service('toast',[String(text)]);},
      state:function(){return service('state',[],null);},
      addItem:function(id,def){return service('addItem',[id,def],false);},
      giveItem:function(id){return service('giveItem',[id],false);},
      addRoom:function(id,def){return service('addRoom',[m.id,id,def],null);},
      enterRoom:function(id,spawn){return service('enterRoom',[id,spawn]);},
      store:function(spec){ persistent(owner,spec); },
      modules:function(){ return GameModules.modules(); }
    };
  }

  /* 上传的 Mod 存在本机：localStorage 里一份源码 */
  function stored(){
    try{ var v=JSON.parse(localStorage.getItem(STORE_KEY)||'[]'); return Array.isArray(v)?v:[]; }catch(e){ return []; }
  }
  function writeStored(list){
    try{ localStorage.setItem(STORE_KEY,JSON.stringify(list)); return true; }catch(e){ log('store','upload',e); return false; }
  }
  function enabledBuiltin(){
    try{ var v=JSON.parse(localStorage.getItem(ENABLE_KEY)||'{}'); return (v&&typeof v==='object')?v:{}; }catch(e){ return {}; }
  }
  function setBuiltin(id,on){
    var v=enabledBuiltin(); if(on) v[id]=true; else delete v[id];
    try{ localStorage.setItem(ENABLE_KEY,JSON.stringify(v)); }catch(e){}
  }
  /* 从文本里认出 Mod 的 id 和名字：要求文件里调用 GameModules.mod({id:'…', name:'…'}) */
  function sniff(code){
    var id=/\bid\s*:\s*['"]([a-z0-9][a-z0-9_-]{0,47})['"]/i.exec(code||''), nm=/\bname\s*:\s*['"]([^'"]{1,40})['"]/.exec(code||'');
    return {id:id?id[1]:null,name:nm?nm[1]:null};
  }
  function upload(fileName,code){
    code=String(code||'');
    if(code.length>512*1024) return {ok:false,msg:'文件太大（上限 512 KB）'};
    if(!/GameModules\s*\.\s*mod\s*\(/.test(code)) return {ok:false,msg:'没有找到 GameModules.mod({...}) 登记'};
    var s=sniff(code), id=s.id||String(fileName||'mod').replace(/\.js$/i,'').replace(/[^a-z0-9_-]/gi,'-').slice(0,48)||'mod';
    var list=stored().filter(function(x){ return x.id!==id; });
    list.push({id:id,name:s.name||id,code:code,enabled:true,added:Date.now(),file:String(fileName||'')});
    return writeStored(list)?{ok:true,id:id,msg:'已导入，刷新页面后生效'}:{ok:false,msg:'浏览器存储已满或被禁用'};
  }
  function setStored(id,enabled){
    var list=stored(); list.forEach(function(x){ if(x.id===id) x.enabled=!!enabled; }); writeStored(list);
  }
  function removeStored(id){ writeStored(stored().filter(function(x){ return x.id!==id; })); }
  function runStored(){
    stored().forEach(function(x){
      if(!x||!x.enabled||typeof x.code!=='string') return;
      if(modById[x.id]) return;
      mod.source='upload';
      try{ (new Function(x.code+'\n//# sourceURL=wdfz-mod-'+x.id+'.js'))(); }
      catch(e){ log('upload',x.id,e); }
      mod.source='code';
    });
  }

  /* ---------- 加载：index.html 里调用一次，按清单顺序写入脚本 ---------- */
  function scriptTag(src){ return '<script src="'+src.replace(/"/g,'&quot;')+'"><\/script>'; }
  function modName(n){ return /^[a-z0-9][a-z0-9_-]{0,47}$/i.test(n||'')?n:null; }
  function boot(){
    if(loaded) return; loaded=true;
    var html=[];
    modules.forEach(function(m){ m.files.forEach(function(f){
      html.push(scriptTag(f));
      html.push('<script>GameModules.adoptFile('+JSON.stringify(f)+')<\/script>');
    }); });
    html.push('<script>GameModules._afterCore()<\/script>');
    if(!safeMode()){
      html.push(scriptTag('game3d/mods/index.js'));
      html.push('<script>GameModules._loadBuiltin()<\/script>');
    }
    html.push('<script>GameModules._finish()<\/script>');
    document.write(html.join('\n'));
  }
  function afterCore(){ verify(); }
  function loadBuiltin(){
    var on=enabledBuiltin(), want=[], extra=param('mod');
    builtin.forEach(function(b){ if(on[b.id]) want.push(b.id); });
    if(extra) extra.split(',').forEach(function(n){ n=modName(n.trim()); if(n&&want.indexOf(n)<0) want.push(n); });
    if(want.length) document.write(want.map(function(n){ return '<script>GameModules.mod.source="builtin"<\/script>'+scriptTag('game3d/mods/'+n+'.js'); }).join('\n')+'<script>GameModules.mod.source="code"<\/script>');
  }
  function finish(){
    if(!safeMode()) runStored();
    emit('loaded');
  }

  var G={
    API_VERSION:API_VERSION,bindModServices:bindModServices,
    configureContracts:configureContracts,imports:importFile,publish:publishFile,adoptFile:adoptFile,dependencies:dependencySnapshot,
    define:define, on:on, off:off, has:has, emit:emit, first:first,
    persistent:persistent, saveAll:saveAll, loadAll:loadAll, resetAll:resetAll,
    mod:mod, boot:boot, verify:verify, safeMode:safeMode,
    _afterCore:afterCore, _loadBuiltin:loadBuiltin, _finish:finish,
    /* game3d/mods/index.js 用：登记 game3d/mods/ 里自带的 Mod，默认不开，玩家在调试面板里打开 */
    builtin:function(list){ (list||[]).forEach(function(b){ if(b&&modName(b.id)&&!builtin.some(function(x){ return x.id===b.id; })) builtin.push({id:b.id,name:b.name||b.id,desc:b.desc||''}); }); },
    builtinList:function(){ return builtin.map(function(b){ return Object.assign({enabled:!!enabledBuiltin()[b.id]},b); }); },
    setBuiltin:setBuiltin,
    upload:upload, uploaded:function(){ return stored().map(function(x){ return {id:x.id,name:x.name,enabled:!!x.enabled,added:x.added,file:x.file,size:(x.code||'').length}; }); },
    setUploaded:setStored, removeUploaded:removeStored,
    modules:function(){ return modules.map(function(m){ return {id:m.id,name:m.name,desc:m.desc,files:m.files.slice(),exports:m.exports.slice(),emits:m.emits.slice(),uses:m.uses.slice(),status:m.status,missing:m.missing.slice()}; }); },
    module:function(id){ return byId[id]||null; },
    mods:function(){ return mods.map(function(m){ return {id:m.id,name:m.name,version:m.version,author:m.author,desc:m.desc,source:m.source,status:m.status}; }); },
    hookNames:function(){ return Object.keys(hooks).filter(function(n){ return hooks[n].length; }).sort(); },
    errors:function(){ return errors.slice(); }
  };
  return G;
})();
