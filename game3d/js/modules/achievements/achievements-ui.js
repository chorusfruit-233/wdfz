/* @module-capsule */
(function($imports){
/* 里世界 3D · 成就界面：主菜单入口、成就页、解锁提示、结局卡 / 死亡界面上的「本局新达成」。
   入口和页面都在启动时由模块挂上（拿掉模块就没有）；隐藏成就没解锁时不在页面 DOM 里，也不计数。
   达成方法也是彩蛋：没解锁的只显示名字和「未达成」（不写条件、不显示进度），解锁后显示一句回忆（a.m），
   内部条件 a.how 只在调试面板里出现。 */
'use strict';
var AchievementsUI=(function(){
  var tab='all', mounted=false;
  function el(id){ return document.getElementById(id); }
  function fmtDate(t){ if(!t) return ''; var d=new Date(t); function p(n){ return (n<10?'0':'')+n; } return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()); }
  function talentName(id){ try{ return ($imports.TALENTS[id]&&$imports.TALENTS[id].n)||''; }catch(e){ return ''; } }
  function diffName(d){ return d==='hard'?'梦魇':(d==='easy'?'预知梦':''); }

  function mount(){
    if(mounted) return; mounted=true;
    var extra=document.querySelector('#menu .mextra');
    if(extra){
      var b=document.createElement('button'); b.type='button'; b.className='mside'; b.id='btnach';
      b.innerHTML='<b>成就</b><i id="btnachSub"></i>';
      b.addEventListener('click',open); extra.appendChild(b);
    }
    var box=document.createElement('div');
    box.id='achieve'; box.className='mdialog'; box.hidden=true;
    box.setAttribute('role','dialog'); box.setAttribute('aria-modal','true'); box.setAttribute('aria-labelledby','acTitle');
    box.innerHTML='<div class="mdbox wide"><div class="tphead"><b id="acTitle">成就</b><i id="acCount"></i></div>'+
      '<p class="tplead">只是记录，没有任何加成。怎样才算达成，要自己去发现。打开过调试面板的那一局、启用了自制 Mod 的那一局都不算；记录只存在这台设备的浏览器里。</p>'+
      '<div class="actabs" id="actabs" role="tablist"></div>'+
      '<div class="arscroll"><div class="accards" id="accards"></div></div>'+
      '<div class="tpfoot"><button type="button" id="acBack">返回</button></div></div>';
    document.body.appendChild(box);
    el('acBack').addEventListener('click',close);
    var t=document.createElement('div'); t.id='achtoast'; t.hidden=true; t.setAttribute('role','status'); t.setAttribute('aria-live','polite');
    t.innerHTML='<i></i><b></b>';
    document.body.appendChild(t);
    paintMenu();
  }
  function paintMenu(){
    var s=el('btnachSub'); if(!s) return;
    var c=$imports.Achievements.counts();
    s.textContent='已达成 '+c.got+' / '+c.of+(c.hidden?' · 隐藏 '+c.hidden:'');
  }
  function open(){
    var box=el('achieve'); if(!box) return;
    tab='all'; paint(); box.hidden=false;
    try{ (0,$imports.resetInputState)(); (0,$imports.releaseMouseLook)(); }catch(e){}
    var f=box.querySelector('.actabs button'); if(f) f.focus({preventScroll:true});
  }
  function close(){
    var box=el('achieve'); if(box) box.hidden=true;
    var b=el('btnach'); if(b) b.focus({preventScroll:true});
    paintMenu();
  }
  function statusLine(a,g,v){
    if(g){
      if(g.legacy) return '已达成 · 旧记录';
      var bits=['已达成',fmtDate(g.at)];
      if(g.diff) bits.push(diffName(g.diff));
      if(g.talent&&talentName(g.talent)) bits.push(talentName(g.talent));
      if(g.day) bits.push('第 '+g.day+' 天');
      if(g.mode==='speedrun') bits.push('速通');
      return bits.join(' · ');
    }
    return '未达成';
  }
  function paint(){
    var r=$imports.Achievements.state(), c=$imports.Achievements.counts(), v=$imports.Achievements.view();
    el('acCount').textContent='已达成 '+c.got+' / '+c.of+(c.hidden?' · 隐藏 '+c.hidden:'');
    var tabs=[['all','全部'],['n','普通'],['e','精英'],['p','史诗']];
    if(c.hidden) tabs.push(['h','隐藏']);
    var tb=el('actabs'); tb.textContent='';
    tabs.forEach(function(x){
      var b=document.createElement('button'); b.type='button'; b.setAttribute('role','tab'); b.dataset.tab=x[0];
      b.setAttribute('aria-selected',String(tab===x[0])); b.textContent=x[1];
      b.addEventListener('click',function(){ tab=x[0]; paint(); var f=el('actabs').querySelector('[data-tab="'+x[0]+'"]'); if(f) f.focus({preventScroll:true}); });
      tb.appendChild(b);
    });
    var box=el('accards'); box.textContent='';
    $imports.AchievementRules.list().forEach(function(a){
      if(!$imports.Achievements.visible(a)) return;                          /* 隐藏的没解锁就不进 DOM */
      if(tab!=='all'&&a.t!==tab) return;
      var g=r.got[a.id], card=document.createElement('div');
      card.className='accard t-'+a.t+(g?' got':''); card.dataset.id=a.id;
      var em=document.createElement('em'); em.textContent=$imports.ACH_TIERS[a.t].name;
      var sp=document.createElement('span'), b=document.createElement('b'), i=document.createElement('i'), sm=document.createElement('small');
      b.textContent=a.n; sm.textContent=statusLine(a,g,v);
      sp.appendChild(b);
      if(g&&a.m){ i.textContent=a.m; sp.appendChild(i); }          /* 没解锁的不写任何说明 */
      sp.appendChild(sm);
      card.appendChild(em); card.appendChild(sp); box.appendChild(card);
    });
  }
  function showToast(a){
    var t=el('achtoast'); if(!t) return;
    t.className='t-'+a.t; t.querySelector('i').textContent='成就 · '+$imports.ACH_TIERS[a.t].name; t.querySelector('b').textContent=a.n;
    t.hidden=false; void t.offsetWidth; t.classList.add('on');
  }
  function hideToast(){ var t=el('achtoast'); if(t){ t.classList.remove('on'); t.hidden=true; } }
  /* 结局卡、死亡界面：本局新达成（名字和档位） */
  function summaryHtml(){
    var ids=$imports.Achievements.runNew(); if(!ids.length) return '';
    var items=ids.map(function(id){ var a=$imports.AchievementRules.get(id); return '<span class="t-'+a.t+'">'+$imports.ACH_TIERS[a.t].name+' · '+a.n+'</span>'; });
    return '<div class="eachv"><i>本局新达成</i>'+items.join('')+'</div>';
  }
  document.addEventListener('keydown',function(ev){
    var box=el('achieve');
    if(box&&!box.hidden&&ev.key==='Escape'){ ev.preventDefault(); ev.stopImmediatePropagation(); close(); }
  },true);
  GameModules.on('boundary',function(reason){ if(reason==='menu') paintMenu(); },{owner:'achievements'});
  GameModules.on('endingCard',function(c){
    var h=summaryHtml(); if(!h||!c||!c.el) return;
    var w=document.createElement('div'); w.innerHTML=h; c.el.insertBefore(w.firstChild,c.el.querySelector('.equit'));
  },{owner:'achievements'});
  GameModules.on('deathScreen',function(c){
    var old=el('dieach'); if(old) old.remove();
    var h=summaryHtml(); if(!h||!c||!c.el) return;
    var w=document.createElement('div'); w.id='dieach'; w.innerHTML=h; c.el.insertBefore(w,c.el.querySelector('button'));
  },{owner:'achievements'});
  return {mount:mount,open:open,close:close,paint:paint,paintMenu:paintMenu,showToast:showToast,hideToast:hideToast,summaryHtml:summaryHtml};
})();

/* @module-exports */
GameModules.publish("game3d/js/modules/achievements/achievements-ui.js",{
"AchievementsUI":{get:function(){return AchievementsUI;},set:function($value){AchievementsUI=$value;}}
});
})(GameModules.imports("game3d/js/modules/achievements/achievements-ui.js"));
