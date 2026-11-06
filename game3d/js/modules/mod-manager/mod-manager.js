/* @module-capsule */
(function($imports){
/* 里世界 3D · Mod 管理（模块 mod-manager）
   两个入口画同一份内容：暂停菜单里的「Mod 与模块」折叠栏（不用调试密码），调试面板的「Mod」页签。
   能做的事：看模块清单和核对结果、导入 .js Mod（存在本机浏览器）、开关 / 删除、打开 game3d/mods 里自带的 Mod、
   刷新页面生效、安全模式（?nomod）重开、看加载错误。规范见 docs/模块化与Mod规范.md。 */
'use strict';

var ModManager={
  hosts:[],
  esc:function(s){ return String(s===undefined?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); },
  /* 把管理界面画进一个容器 */
  render:function(box){
    if(!box) return;
    var E=ModManager.esc, G=GameModules, mods=G.mods(), up=G.uploaded(), bi=G.builtinList(), mods0=G.modules(), errs=G.errors();
    var okN=mods0.filter(function(m){ return m.status==='ok'; }).length;
    var simple=box.getAttribute('data-mm-simple')==='1';              /* 主菜单的 DLC 面板：只给玩家看开关、导入和刷新，不列模块清单 */
    var h=[];
    if(simple){
      if(G.safeMode()) h.push('<p><b>当前是安全模式（?nomod）：没有加载任何 DLC。</b></p>');
      h.push('<h5>自带的 DLC</h5>');
      h.push(bi.length?'<ul class="mm-list">'+bi.map(function(m){
        var live=mods.some(function(x){ return x.id===m.id&&x.status==='active'; });
        return '<li><span><b>'+E(m.name)+'</b><small>'+(m.desc?E(m.desc)+' · ':'')+(live?'这次已载入':(m.enabled?'已打开，刷新后载入':'关着'))+'</small></span><span class="mm-btns">'+
          '<button type="button" data-mm="builtin" data-id="'+E(m.id)+'" aria-pressed="'+m.enabled+'">'+(m.enabled?'已开 · 点击关闭':'打开')+'</button></span></li>';
      }).join('')+'</ul>':'<p>没有。</p>');
      h.push('<p class="mm-msg" data-mm="msg" role="status" aria-live="polite"></p>');
      h.push('<h5>导入的 DLC（存在这台设备的浏览器里，只导入信得过的文件）</h5>');
      h.push(up.length?'<ul class="mm-list">'+up.map(function(m){
        return '<li><span><b>'+E(m.name)+'</b><small>'+(m.enabled?'启用':'停用')+'</small></span><span class="mm-btns">'+
          '<button type="button" data-mm="toggle" data-id="'+E(m.id)+'">'+(m.enabled?'停用':'启用')+'</button><button type="button" data-mm="remove" data-id="'+E(m.id)+'">删除</button></span></li>';
      }).join('')+'</ul>':'');
      h.push('<div class="mm-file"><label class="mm-pick">导入 DLC 文件（.js）<input type="file" accept=".js,text/javascript" data-mm="file"></label></div>');
      h.push('<div class="pt-row"><button type="button" class="primary" data-mm="reload">刷新页面，让开关生效</button></div>');
    }else{
    h.push('<p>游戏按 <code>game3d/manifest.js</code> 分成 '+mods0.length+' 个模块，'+okN+' 个核对通过。'+
      (G.safeMode()?'<b>当前是安全模式（?nomod）：没有加载任何 DLC。</b>':'')+'</p>');
    h.push('<div class="mm-file"><label class="mm-pick">导入 DLC 文件（.js）<input type="file" accept=".js,text/javascript" data-mm="file"></label></div>');
    h.push('<p class="mm-msg" data-mm="msg" role="status" aria-live="polite"></p>');
    function row(name,meta,btns){ return '<li><span><b>'+name+'</b><small>'+meta+'</small></span><span class="mm-btns">'+btns+'</span></li>'; }
    var STATUS={active:'运行中',failed:'出错，已停用',incompatible:'接口版本不符',registered:'已登记'};
    h.push('<h5>已加载的 DLC</h5>');
    h.push(mods.length?'<ul class="mm-list">'+mods.map(function(m){
      return row(E(m.name),E(m.id)+' · v'+E(m.version)+' · '+({upload:'上传',builtin:'自带',code:'代码'}[m.source]||E(m.source))+' · '+(STATUS[m.status]||E(m.status)),'');
    }).join('')+'</ul>':'<p>没有。</p>');
    h.push('<h5>导入的 DLC（存在这台设备的浏览器里）</h5>');
    h.push(up.length?'<ul class="mm-list">'+up.map(function(m){
      return row(E(m.name),E(m.id)+' · '+Math.ceil(m.size/1024)+' KB · '+(m.enabled?'启用':'停用'),
        '<button type="button" data-mm="toggle" data-id="'+E(m.id)+'">'+(m.enabled?'停用':'启用')+'</button>'+
        '<button type="button" data-mm="remove" data-id="'+E(m.id)+'">删除</button>');
    }).join('')+'</ul>':'<p>还没有导入。</p>');
    h.push('<h5>自带的 DLC（game3d/mods）</h5>');
    h.push(bi.length?'<ul class="mm-list">'+bi.map(function(m){
      return row(E(m.name),E(m.id)+(m.desc?' · '+E(m.desc):''),
        '<button type="button" data-mm="builtin" data-id="'+E(m.id)+'" aria-pressed="'+m.enabled+'">'+(m.enabled?'已开':'打开')+'</button>');
    }).join('')+'</ul>':'<p>没有。</p>');
    h.push('<div class="pt-row"><button type="button" data-mm="reload">刷新页面生效</button><button type="button" data-mm="safe">安全模式重开</button></div>');
    h.push('<details class="mm-mods"><summary>模块清单（'+mods0.length+'）</summary><ul class="mm-list">'+mods0.map(function(m){
      return row(E(m.name),E(m.id)+' · '+m.files.length+' 个文件'+(m.status==='ok'?'':' · 缺少 '+E(m.missing.join('、'))),'');
    }).join('')+'</ul></details>');
    if(errs.length) h.push('<h5>加载与运行错误</h5><ul class="mm-err">'+errs.slice(-8).map(function(e){ return '<li>'+E(e.kind)+' · '+E(e.who)+'：'+E(e.message)+'</li>'; }).join('')+'</ul>');
    }
    box.innerHTML=h.join('');
    box.onclick=function(ev){
      var b=ev.target&&ev.target.closest?ev.target.closest('[data-mm]'):null; if(!b) return;
      var k=b.getAttribute('data-mm'), id=b.getAttribute('data-id');
      if(k==='file'||k==='msg') return;                          /* 点选文件框：交给浏览器的文件选择，别重画（会把输入框换掉） */
      if(k==='toggle'){ var cur=GameModules.uploaded().filter(function(m){ return m.id===id; })[0]; GameModules.setUploaded(id,!(cur&&cur.enabled)); ModManager.say('已'+(cur&&cur.enabled?'停用':'启用')+'，刷新页面后生效'); }
      else if(k==='remove'){ GameModules.removeUploaded(id); ModManager.say('已删除，刷新页面后生效'); }
      else if(k==='builtin'){ var on=b.getAttribute('aria-pressed')!=='true'; GameModules.setBuiltin(id,on); ModManager.say((on?'已打开':'已关闭')+'，刷新页面后生效'); }
      else if(k==='reload'){ try{ (0,$imports.autoSave)(); }catch(e){} location.reload(); return; }
      else if(k==='safe'){ try{ (0,$imports.autoSave)(); }catch(e){} var u=location.pathname+'?nomod'; location.href=u; return; }
      ModManager.renderAll();
    };
    var file=box.querySelector('[data-mm="file"]');
    if(file) file.onchange=function(){
      var f=file.files&&file.files[0]; if(!f) return;
      var rd=new FileReader();
      rd.onload=function(){ var r=GameModules.upload(f.name,String(rd.result||'')); ModManager.renderAll(); ModManager.say(r.ok?('「'+r.id+'」'+r.msg):('导入失败：'+r.msg)); };
      rd.onerror=function(){ ModManager.say('读取文件失败'); };
      rd.readAsText(f);
    };
  },
  say:function(msg){
    ModManager.hosts.forEach(function(box){ var m=box.querySelector('[data-mm="msg"]'); if(m) m.textContent=msg; });
    try{ (0,$imports.toast)(msg); }catch(e){}
  },
  renderAll:function(){ ModManager.hosts.forEach(function(box){ ModManager.render(box); }); },
  openMenu:function(){
    var ov=document.getElementById('dlcmenu'); if(!ov) return false;
    ModManager.render(document.getElementById('dlcMenuBody')); ov.hidden=false;
    try{ (0,$imports.resetInputState)(); (0,$imports.releaseMouseLook)(); }catch(e){}
    var b=ov.querySelector('[data-mm="builtin"],#dlcBack'); if(b) b.focus({preventScroll:true}); return true;
  },
  closeMenu:function(){ var ov=document.getElementById('dlcmenu'); if(!ov||ov.hidden) return false; ov.hidden=true; var b=document.getElementById('btndlc'); if(b) b.focus({preventScroll:true}); return true; },
  /* 启动时把两个入口装进页面（index.html 不用改） */
  mount:function(){
    if(ModManager.mounted) return; ModManager.mounted=true;
    var css=document.createElement('style');
    css.textContent='.mod-tools h5{margin:10px 0 4px;font-size:12px;letter-spacing:1px;color:var(--ui-dim,#bbb)}'+
      '.mm-list{list-style:none;margin:0 0 8px;padding:0}.mm-list li{display:flex;gap:8px;align-items:center;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--ui-line,#333)}'+
      '.mm-list li span{display:flex;flex-direction:column;min-width:0}.mm-list small{color:var(--ui-faint,#888);font-size:11px;overflow-wrap:anywhere}'+
      '.mm-list li>span:first-child{flex:1 1 auto}.mm-btns{flex-direction:row!important;gap:6px;flex-shrink:0}.mm-btns button{min-height:44px!important;padding:2px 10px!important}'+
      '.mm-pick{display:block;padding:8px 10px;border:1px dashed var(--ui-line,#555);cursor:pointer;text-align:center}.mm-pick input{display:block;margin:6px auto 0;max-width:100%}'+
      '.mm-msg{min-height:1em;color:var(--ui-acc,#d8c48a)!important}.mm-err{margin:0;padding-left:16px;color:#e0857a;font-size:11px}'+
      '.mm-mods summary{cursor:pointer;margin:4px 0;color:var(--ui-dim,#bbb)}.mod-tools code{font-size:11px}'+
      '.dlcmenu{position:fixed;inset:0;z-index:70;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(6,5,5,.72)}.dlcmenu[hidden]{display:none}'+
      '.dlcbox{width:min(560px,100%);max-height:calc(100dvh - 32px);overflow-y:auto}.dlcintro{font-size:12px;line-height:1.8;color:var(--ui-dim,#bbb)}.dlcintro a{color:var(--ui-acc,#d8c48a)}';
    document.head.appendChild(css);
    var pt=document.querySelector('.playtest-tools');
    if(pt&&pt.parentNode){
      var d=document.createElement('details'); d.className='playtest-tools mod-tools'; d.id='modTools';
      d.innerHTML='<summary><span>DLC 与模块</span><em id="modToolsState"></em></summary><div id="modToolsBody"></div>';
      pt.parentNode.insertBefore(d,pt.nextSibling);
      d.addEventListener('toggle',function(){ if(d.open) ModManager.render(document.getElementById('modToolsBody')); });
      ModManager.hosts.push(document.getElementById('modToolsBody'));
      ModManager.render(document.getElementById('modToolsBody'));      /* 先画好：toggle 事件是异步的，展开的那一刻就要有内容 */
      var st=document.getElementById('modToolsState'); if(st) st.textContent=GameModules.safeMode()?'安全模式':(GameModules.mods().length?GameModules.mods().length+' 个 DLC':'');
    }
    /* 主菜单底行的「DLC」入口（2026-11-06，用户要求）：和暂停菜单里的是同一套开关，只是不列模块清单 */
    var mctl=document.querySelector('#menu .mctl');
    if(mctl){
      var mb=document.createElement('button'); mb.type='button'; mb.className='mwiki mset'; mb.id='btndlc';
      mb.title='打开或导入 DLC（自带「规则怪谈」）'; mb.innerHTML='DLC <span aria-hidden="true">＋</span>';
      var wiki=mctl.querySelector('a.mwiki'); mctl.insertBefore(mb,wiki||null);
      var ov=document.createElement('div'); ov.id='dlcmenu'; ov.className='dlcmenu'; ov.hidden=true;
      ov.setAttribute('role','dialog'); ov.setAttribute('aria-modal','true'); ov.setAttribute('aria-labelledby','dlcTitle');
      ov.innerHTML='<div class="pbox dlcbox"><div class="ptitle" id="dlcTitle">DLC</div>'+
        '<p class="dlcintro">DLC 是额外的玩法。打开或关掉以后要刷新页面，从下一局开始生效；已经开始的那一局跟着存档走。'+
        '<a href="wiki/index.html#dlc">DLC 玩法说明 ↗</a></p>'+
        '<div id="dlcMenuBody" class="mod-tools" data-mm-simple="1"></div>'+
        '<div class="sfoot"><button type="button" id="dlcBack">返回</button></div></div>';
      document.body.appendChild(ov);
      ModManager.hosts.push(document.getElementById('dlcMenuBody'));
      mb.addEventListener('click',function(){ ModManager.openMenu(); });
      document.getElementById('dlcBack').addEventListener('click',function(){ ModManager.closeMenu(); });
      document.addEventListener('keydown',function(e){ if(!ov.hidden&&(e.key==='Escape'||e.key==='Esc')){ e.preventDefault(); e.stopPropagation(); ModManager.closeMenu(); } },true);
    }
    var tabs=document.querySelector('.devtabs'), body=document.getElementById('devbody');
    if(tabs&&body&&typeof $imports.DEV_TABS!=='undefined'){
      $imports.DEV_TABS.push('mods');
      var btn=document.createElement('button'); btn.type='button'; btn.setAttribute('data-dev-tab','mods'); btn.setAttribute('aria-controls','dev-page-mods');
      btn.setAttribute('aria-pressed','false'); btn.textContent='DLC'; btn.onclick=function(){ $imports.Dev.tab('mods'); };
      tabs.appendChild(btn);
      var page=document.createElement('section'); page.className='devpage mod-tools'; page.id='dev-page-mods'; page.hidden=true;
      page.innerHTML='<div class="devsection"><div><h3>DLC 与模块</h3><p>导入、开关后刷新页面生效；?nomod 是安全模式</p></div></div><div id="devModsBody"></div>';
      body.appendChild(page);
      ModManager.hosts.push(document.getElementById('devModsBody'));
      ModManager.render(document.getElementById('devModsBody'));
    }
  }
};
GameModules.on('boot',function(){ ModManager.mount(); },{owner:'mod-manager'});
GameModules.on('devTab',function(id){ if(id==='mods') ModManager.render(document.getElementById('devModsBody')); },{owner:'mod-manager'});

/* @module-exports */
GameModules.publish("game3d/js/modules/mod-manager/mod-manager.js",{
"ModManager":{get:function(){return ModManager;},set:function($value){ModManager=$value;}}
});
})(GameModules.imports("game3d/js/modules/mod-manager/mod-manager.js"));
