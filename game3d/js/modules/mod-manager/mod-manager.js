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
    var h=[];
    h.push('<p>游戏按 <code>game3d/manifest.js</code> 分成 '+mods0.length+' 个模块，'+okN+' 个核对通过。'+
      (G.safeMode()?'<b>当前是安全模式（?nomod）：没有加载任何 Mod。</b>':'')+'</p>');
    h.push('<div class="mm-file"><label class="mm-pick">导入 Mod 文件（.js）<input type="file" accept=".js,text/javascript" data-mm="file"></label></div>');
    h.push('<p class="mm-msg" data-mm="msg" role="status" aria-live="polite"></p>');
    function row(name,meta,btns){ return '<li><span><b>'+name+'</b><small>'+meta+'</small></span><span class="mm-btns">'+btns+'</span></li>'; }
    var STATUS={active:'运行中',failed:'出错，已停用',incompatible:'接口版本不符',registered:'已登记'};
    h.push('<h5>已加载的 Mod</h5>');
    h.push(mods.length?'<ul class="mm-list">'+mods.map(function(m){
      return row(E(m.name),E(m.id)+' · v'+E(m.version)+' · '+({upload:'上传',builtin:'自带',code:'代码'}[m.source]||E(m.source))+' · '+(STATUS[m.status]||E(m.status)),'');
    }).join('')+'</ul>':'<p>没有。</p>');
    h.push('<h5>导入的 Mod（存在这台设备的浏览器里）</h5>');
    h.push(up.length?'<ul class="mm-list">'+up.map(function(m){
      return row(E(m.name),E(m.id)+' · '+Math.ceil(m.size/1024)+' KB · '+(m.enabled?'启用':'停用'),
        '<button type="button" data-mm="toggle" data-id="'+E(m.id)+'">'+(m.enabled?'停用':'启用')+'</button>'+
        '<button type="button" data-mm="remove" data-id="'+E(m.id)+'">删除</button>');
    }).join('')+'</ul>':'<p>还没有导入。</p>');
    h.push('<h5>自带的 Mod（game3d/mods）</h5>');
    h.push(bi.length?'<ul class="mm-list">'+bi.map(function(m){
      return row(E(m.name),E(m.id)+(m.desc?' · '+E(m.desc):''),
        '<button type="button" data-mm="builtin" data-id="'+E(m.id)+'" aria-pressed="'+m.enabled+'">'+(m.enabled?'已开':'打开')+'</button>');
    }).join('')+'</ul>':'<p>没有。</p>');
    h.push('<div class="pt-row"><button type="button" data-mm="reload">刷新页面生效</button><button type="button" data-mm="safe">安全模式重开</button></div>');
    h.push('<details class="mm-mods"><summary>模块清单（'+mods0.length+'）</summary><ul class="mm-list">'+mods0.map(function(m){
      return row(E(m.name),E(m.id)+' · '+m.files.length+' 个文件'+(m.status==='ok'?'':' · 缺少 '+E(m.missing.join('、'))),'');
    }).join('')+'</ul></details>');
    if(errs.length) h.push('<h5>加载与运行错误</h5><ul class="mm-err">'+errs.slice(-8).map(function(e){ return '<li>'+E(e.kind)+' · '+E(e.who)+'：'+E(e.message)+'</li>'; }).join('')+'</ul>');
    box.innerHTML=h.join('');
    box.onclick=function(ev){
      var b=ev.target&&ev.target.closest?ev.target.closest('[data-mm]'):null; if(!b) return;
      var k=b.getAttribute('data-mm'), id=b.getAttribute('data-id');
      if(k==='file'||k==='msg') return;                          /* 点选文件框：交给浏览器的文件选择，别重画（会把输入框换掉） */
      if(k==='toggle'){ var cur=GameModules.uploaded().filter(function(m){ return m.id===id; })[0]; GameModules.setUploaded(id,!(cur&&cur.enabled)); ModManager.say('已'+(cur&&cur.enabled?'停用':'启用')+'，刷新页面后生效'); }
      else if(k==='remove'){ GameModules.removeUploaded(id); ModManager.say('已删除，刷新页面后生效'); }
      else if(k==='builtin'){ var on=b.getAttribute('aria-pressed')!=='true'; GameModules.setBuiltin(id,on); ModManager.say((on?'已打开':'已关闭')+'，刷新页面后生效'); }
      else if(k==='reload'){ try{ autoSave(); }catch(e){} location.reload(); return; }
      else if(k==='safe'){ try{ autoSave(); }catch(e){} var u=location.pathname+'?nomod'; location.href=u; return; }
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
    try{ toast(msg); }catch(e){}
  },
  renderAll:function(){ ModManager.hosts.forEach(function(box){ ModManager.render(box); }); },
  /* 启动时把两个入口装进页面（index.html 不用改） */
  mount:function(){
    if(ModManager.mounted) return; ModManager.mounted=true;
    var css=document.createElement('style');
    css.textContent='.mod-tools h5{margin:10px 0 4px;font-size:12px;letter-spacing:1px;color:var(--ui-dim,#bbb)}'+
      '.mm-list{list-style:none;margin:0 0 8px;padding:0}.mm-list li{display:flex;gap:8px;align-items:center;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--ui-line,#333)}'+
      '.mm-list li span{display:flex;flex-direction:column;min-width:0}.mm-list small{color:var(--ui-faint,#888);font-size:11px;overflow-wrap:anywhere}'+
      '.mm-btns{flex-direction:row!important;gap:6px}.mm-btns button{min-height:44px!important;padding:2px 10px!important}'+
      '.mm-pick{display:block;padding:8px 10px;border:1px dashed var(--ui-line,#555);cursor:pointer;text-align:center}.mm-pick input{display:block;margin:6px auto 0;max-width:100%}'+
      '.mm-msg{min-height:1em;color:var(--ui-acc,#d8c48a)!important}.mm-err{margin:0;padding-left:16px;color:#e0857a;font-size:11px}'+
      '.mm-mods summary{cursor:pointer;margin:4px 0;color:var(--ui-dim,#bbb)}.mod-tools code{font-size:11px}';
    document.head.appendChild(css);
    var pt=document.querySelector('.playtest-tools');
    if(pt&&pt.parentNode){
      var d=document.createElement('details'); d.className='playtest-tools mod-tools'; d.id='modTools';
      d.innerHTML='<summary><span>Mod 与模块</span><em id="modToolsState"></em></summary><div id="modToolsBody"></div>';
      pt.parentNode.insertBefore(d,pt.nextSibling);
      d.addEventListener('toggle',function(){ if(d.open) ModManager.render(document.getElementById('modToolsBody')); });
      ModManager.hosts.push(document.getElementById('modToolsBody'));
      ModManager.render(document.getElementById('modToolsBody'));      /* 先画好：toggle 事件是异步的，展开的那一刻就要有内容 */
      var st=document.getElementById('modToolsState'); if(st) st.textContent=GameModules.safeMode()?'安全模式':(GameModules.mods().length?GameModules.mods().length+' 个 Mod':'');
    }
    var tabs=document.querySelector('.devtabs'), body=document.getElementById('devbody');
    if(tabs&&body&&typeof DEV_TABS!=='undefined'){
      DEV_TABS.push('mods');
      var btn=document.createElement('button'); btn.type='button'; btn.setAttribute('data-dev-tab','mods'); btn.setAttribute('aria-controls','dev-page-mods');
      btn.setAttribute('aria-pressed','false'); btn.textContent='Mod'; btn.onclick=function(){ Dev.tab('mods'); };
      tabs.appendChild(btn);
      var page=document.createElement('section'); page.className='devpage mod-tools'; page.id='dev-page-mods'; page.hidden=true;
      page.innerHTML='<div class="devsection"><div><h3>Mod 与模块</h3><p>导入、开关后刷新页面生效；?nomod 是安全模式</p></div></div><div id="devModsBody"></div>';
      body.appendChild(page);
      ModManager.hosts.push(document.getElementById('devModsBody'));
      ModManager.render(document.getElementById('devModsBody'));
    }
  }
};
GameModules.on('boot',function(){ ModManager.mount(); },{owner:'mod-manager'});
GameModules.on('devTab',function(id){ if(id==='mods') ModManager.render(document.getElementById('devModsBody')); },{owner:'mod-manager'});
