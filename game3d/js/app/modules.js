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
  var modules=[], byId={}, hooks={}, mods=[], modById={}, errors=[], persist=[], builtin=[], loaded=false, layerList=[];
  var EMPTY=[];

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
  /* ---------- 分层（计划「项目解耦与模块化」第 4 节）：清单先登记各层的目录和不许越界的依赖 ---------- */
  function layers(list){
    layerList=(list||[]).map(function(l){ return {id:l.id,name:l.name||l.id,dir:l.dir,desc:l.desc||'',forbid:(l.forbid||[]).slice()}; });
    return layerList;
  }
  function layerOf(file){
    for(var i=0;i<layerList.length;i++) if(file.indexOf(layerList[i].dir)===0) return layerList[i].id;
    return null;
  }
  function define(meta){
    if(!meta||!meta.id) throw new Error('模块缺少 id');
    if(byId[meta.id]) throw new Error('模块 id 重复：'+meta.id);
    var m={id:meta.id,name:meta.name||meta.id,desc:meta.desc||'',files:(meta.files||[]).slice(),
      exports:(meta.exports||[]).slice(),emits:(meta.emits||[]).slice(),uses:(meta.uses||[]).slice(),
      status:'pending',missing:[]};
    m.layers=m.files.map(function(f){ return layerOf(f); });
    m.files.forEach(function(f,i){ if(layerList.length&&!m.layers[i]) log('layer',m.id,f+' 不在任何一层的目录里'); });
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
    var out={};
    persist.forEach(function(p){
      if(!p.save) return;
      try{ var v=p.save(); if(v!==undefined) out[p.id]=JSON.parse(JSON.stringify(v)); }catch(e){ log('save',p.id,e); }
    });
    return out;
  }
  function loadAll(data){
    data=(data&&typeof data==='object')?data:{};
    persist.forEach(function(p){
      try{ if(p.reset) p.reset(); if(p.load&&data[p.id]!==undefined) p.load(data[p.id]); }catch(e){ log('load',p.id,e); }
    });
  }
  function resetAll(){
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
    }catch(e){ m.status='failed'; offOwner('mod:'+m.id); log('mod',m.id,e); }
    return m;
  }
  /* 给 Mod 的稳定接口：只包常用、不常变的入口；需要更深的改动就直接读写全局，自担兼容风险 */
  function api(m){
    var owner='mod:'+m.id;
    return {
      version:API_VERSION, id:m.id,
      on:function(name,fn,opt){ opt=Object.assign({owner:owner},opt||{}); return on(name,fn,opt); },
      off:off,
      say:function(text,sec){ try{ os(String(text),sec||3); }catch(e){} },
      toast:function(text){ try{ toast(String(text)); }catch(e){} },
      state:function(){ return (typeof S!=='undefined')?S:null; },
      addItem:function(id,def){
        if(typeof ITEMS==='undefined'||!id||!def) return false;
        ITEMS[id]={n:String(def.name||id),d:String(def.desc||'')};
        if(def.glyph&&typeof ITEM_GLYPH!=='undefined') ITEM_GLYPH[id]=String(def.glyph);
        if(def.color&&typeof ITEM_COL!=='undefined') ITEM_COL[id]=String(def.color);
        if(typeof def.use==='function'&&typeof ITEM_USE!=='undefined') ITEM_USE[id]=def.use;
        return true;
      },
      giveItem:function(id){ return (typeof addItem==='function')?addItem(id):false; },
      addRoom:function(id,def){
        if(typeof mkFloor!=='function'||!def||!def.grid) return null;
        var R=mkFloor(id,def.name||id,def.host||('mod_'+m.id),def.floor||1,def.grid);
        ['build','collide','solid','moved','onEnter','noMap','noClock'].forEach(function(k){ if(def[k]!==undefined) R[k]=def[k]; });
        if(typeof buildRoomBounds==='function') buildRoomBounds();
        return R;
      },
      enterRoom:function(id,spawn){ if(typeof INTERIORS!=='undefined'&&INTERIORS[id]&&typeof enterRoom==='function') enterRoom(id,spawn); },
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
    modules.forEach(function(m){ m.files.forEach(function(f){ html.push(scriptTag(f)); }); });
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
    API_VERSION:API_VERSION,
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
    modules:function(){ return modules.map(function(m){ return {id:m.id,name:m.name,desc:m.desc,files:m.files.slice(),layers:(m.layers||[]).slice(),exports:m.exports.slice(),emits:m.emits.slice(),uses:m.uses.slice(),status:m.status,missing:m.missing.slice()}; }); },
    layers:layers, layerOf:layerOf,
    layerList:function(){ return layerList.map(function(l){ return Object.assign({},l,{forbid:l.forbid.slice()}); }); },
    module:function(id){ return byId[id]||null; },
    mods:function(){ return mods.map(function(m){ return {id:m.id,name:m.name,version:m.version,author:m.author,desc:m.desc,source:m.source,status:m.status}; }); },
    hookNames:function(){ return Object.keys(hooks).filter(function(n){ return hooks[n].length; }).sort(); },
    errors:function(){ return errors.slice(); }
  };
  return G;
})();
