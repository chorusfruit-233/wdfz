/* @module-capsule */
(function($imports){
/* 里世界 3D · 结算页（只在通关后）、死亡界面的一行积分、手册地图页的本局探索度
   结局卡上加主按钮「结算」；调试局 / Mod 局只写「不评级」。结算页顶部是该评级的结算画面（grade-screen.js），
   下面是用时、积分明细（按类别展开到逐条）、生存经历（含身体状态的合并小计，不展示底层数值）、探索度、本局成就。
   通关记录详情、CG 档案馆重看也用这一页（返回按钮不同）。 */
'use strict';
var ResultsUI=(function(){
  var cur=null, back=null;
  function el(id){ return document.getElementById(id); }
  function fmt(sec){ sec=Math.max(0,Math.round(sec||0)); var m=Math.floor(sec/60), s=sec%60; return (m<10?'0':'')+m+':'+(s<10?'0':'')+s; }
  function esc(t){ return String(t).replace(/[&<>"]/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function talentName(id){ try{ return ($imports.TALENTS[id]&&$imports.TALENTS[id].n)||''; }catch(e){ return ''; } }
  function mount(){
    var box=document.createElement('div');
    box.id='results'; box.className='mdialog'; box.hidden=true;
    box.setAttribute('role','dialog'); box.setAttribute('aria-modal','true'); box.setAttribute('aria-labelledby','rsName');
    box.innerHTML='<div class="mdbox wide">'+
      '<div class="rshero"><canvas id="rscv" aria-hidden="true"></canvas><div class="rsgrade"><b id="rsLetter"></b><i id="rsName"></i><p id="rsMemo"></p></div></div>'+
      '<div class="rsline" id="rsLine"></div>'+
      '<div class="arscroll"><div id="rsBody"></div></div>'+
      '<div class="tpfoot"><button type="button" id="rsFoot">足迹图</button><button type="button" id="rsReplay">回放</button><button type="button" id="rsBack" class="primary">回到主菜单</button></div></div>';
    document.body.appendChild(box);
    el('rsBack').addEventListener('click',function(){ var f=back; close(); if(f) f(); });
    el('rsFoot').addEventListener('click',function(){ if(cur&&cur.id&&typeof $imports.RecordsUI!=='undefined') $imports.RecordsUI.footprint(cur.id); });
    el('rsReplay').addEventListener('click',function(){ if(cur&&cur.id&&typeof $imports.RecordsUI!=='undefined') $imports.RecordsUI.replay(cur.id); });
    /* 手册地图页：顶部工具行（「走过 N 处室内」旁边）写本局探索度。
       工具行每次重绘地图都会重建，所以每次画完再补上；图例 .maplegend 只在校园总图时显示，不放在那里 */
    if(typeof $imports.UI!=='undefined'&&$imports.UI.renderMap&&!$imports.UI.renderMap._explore){
      var orig=$imports.UI.renderMap; $imports.UI.renderMap=function(){ var r=orig.apply(this,arguments); paintExplore(); return r; }; $imports.UI.renderMap._explore=1;
    }
  }
  function paintExplore(){
    var tools=el('maptools'); if(!tools||typeof $imports.S==='undefined'||$imports.S.screen==='menu') return;
    var s=el('mapExplore');
    if(!s||s.parentNode!==tools){ if(s) s.remove(); s=document.createElement('span'); s.id='mapExplore'; s.className='mapcount'; tools.appendChild(s); }
    try{ s.textContent='本局探索度 '+$imports.RunScore.explore().pct+'%'; }catch(e){ s.textContent=''; }
  }
  /* 成绩单（创意提案 C7）：班主任按这一局真实发生的事写评语，最多三句，口吻平静。只读积分明细和回放事件；
     内部内容（隐藏结局、隐藏异常、迷宫）一律不写（REPORT_SECRET，保密测试覆盖） */
  var REPORT_SECRET=['满员','可乐','？？？','先辈','迷宫'];
  function reportCard(m){
    var items=(m&&m.score&&m.score.items)||[], out=[], ev=[], clock=[];
    try{ var d=m.id&&$imports.RunRecords.replay(m.id); if(d){ ev=d.events||[]; clock=d.clock||[]; } }catch(e){}
    function at(t){ var k=null; clock.forEach(function(c){ if(c[0]<=t) k=c; }); return k?(0,$imports.fmtClock)(k[2]):''; }
    function find(re){ return items.filter(function(it){ return re.test(it.text)&&!REPORT_SECRET.some(function(w){ return it.text.indexOf(w)>=0; }); }); }
    var an=find(/^化解「/)[0];
    if(an){ var nm=an.text.replace(/^化解「|」$/g,''), e=ev.filter(function(x){ return x[1]==='anomaly'&&x[2].indexOf(nm)>=0; })[0], t=e?at(e[0]):'';
      out.push('该生'+(t?' '+t+' ':'')+'在「'+nm+'」里没有回头。'); }
    var insp=find(/^学生会检查 · 在教室/)[0];
    if(insp) out.push((insp.n||1)>1?'该生 '+(insp.n||1)+' 次检查都在座位上。':'该生检查的时候在座位上。');
    else if(find(/^学生会检查 · 缺席/)[0]) out.push('检查的时候，该生的座位是空的。');
    var hide=find(/躲在柜子里躲过/)[0];
    if(hide) out.push((hide.n||1)>1?'该生在柜子里待了很久，不止一次。':'该生在柜子里待了很久。');
    if(find(/电梯门在它面前合上/)[0]) out.push('该生关电梯门的手很快。');
    if(find(/挡下一次$|^预知梦惊醒/)[0]) out.push('该生有一次差点没有回来。');
    if(!out.length) out.push('该生第 '+(m.day||1)+' 天离开了学校。没有人看见是怎么走的。');
    return out.filter(function(t){ return !REPORT_SECRET.some(function(w){ return t.indexOf(w)>=0; }); }).slice(0,3);
  }
  function section(title,html){ return '<section class="rssec"><h4>'+title+'</h4>'+html+'</section>'; }
  function body(m){
    var out=[], cats={};
    var survival=0;
    m.score.items.forEach(function(it){if(['SAN','应对 · 异象','应对 · 选择','校规与巡察','保命与惊醒'].includes(it.cat)){survival+=it.pts*(it.n||1);return;}(cats[it.cat]||(cats[it.cat]=[])).push(it);});
    cats['生存经历']=[{text:'这一局的应对与经历',pts:survival,n:1}];
    var rows=$imports.SCORE_CATS.concat(['生存经历']).filter(function(c){ return cats[c]; }).map(function(c){
      var sum=0; cats[c].forEach(function(it){ sum+=it.pts*it.n; });
      var lis=cats[c].map(function(it){ return '<li><span>'+esc(it.text)+(it.n>1?' ×'+it.n:'')+'</span><b>'+(it.pts*it.n>0?'+':'')+(it.pts*it.n)+'</b></li>'; }).join('');
      return '<details><summary><span>'+c+'</span><b>'+(sum>0?'+':'')+sum+'</b></summary><ul>'+lis+'</ul></details>';
    }).join('');
    var mult=m.score.mult>1?'<p class="rsnote">梦魇难度：合计 '+m.score.sum+' × '+m.score.mult+' = '+m.score.total+'</p>':'';
    out.push(section('积分 '+m.score.total,rows+mult));
    out.push(section('成绩单','<div class="rsreport"><p>'+reportCard(m).map(esc).join('</p><p>')+'</p><i>—— 班主任</i></div>'));
    out.push(section('探索度 '+m.explore.pct+'%','<p>到过的地点 '+m.explore.place+'% · 楼层草图 '+m.explore.sketch+'% · 线索 '+m.explore.clue+'%</p>'));
    var ach=(m.ach&&m.ach.run||[]).map(function(id){ var a=$imports.AchievementRules.get(id); if(!a) return '';
      var fresh=(m.ach.newly||[]).indexOf(id)>=0; return '<span class="t-'+a.t+(fresh?' new':'')+'">'+$imports.ACH_TIERS[a.t].name+' · '+esc(a.n)+(fresh?' · 新':'')+'</span>'; }).join('');
    out.push(section('本局成就',ach?'<div class="eachv">'+ach+'</div>':'<p>这一局没有达成成就。</p>'));
    var notes=[];
    if(m.capped) notes.push('评级分够 SSS，但 SSS 需要梦魇难度、没被救过、没惊醒过，这一局给 SS。');
    if(m.legacy) notes.push('这一局是从旧存档继续的：之前的部分没有记录，按 0 计。');
    if(m.source==='debug') notes.push('调试面板生成的示例记录，不是真实通关。');
    if(m.source==='archive') notes.push('直接解锁的示例画面：明细是示例数据。');
    if(notes.length) out.push(section('说明','<p>'+notes.join('</p><p>')+'</p>'));
    return out.join('');
  }
  function open(m,opts){
    opts=opts||{}; if(!m) return;
    cur=m; back=opts.back||null;
    var g=$imports.ScoreRules.byLetter(m.grade)||$imports.GRADES[0];
    el('rsLetter').textContent=m.grade; el('rsLetter').className='g-'+m.grade;
    el('rsName').textContent=g.name; el('rsMemo').textContent='「'+g.memo+'」';
    var diff=m.diff==='hard'?'梦魇':'预知梦', tal=talentName(m.talent);
    var t=m.mode==='speedrun'&&m.time.rta?'速通 '+(0,$imports.fmtRun)(m.time.rta)+' · 有效游玩 '+fmt(m.time.active):'用时 '+fmt(m.time.used);
    el('rsLine').innerHTML='<b>评级分 '+m.gradeScore+'</b><span>积分 '+m.score.total+' + 时间分 '+m.timeScore+'</span>'+
      '<span>'+esc(m.routeName)+' · '+diff+(tal?' · '+esc(tal):'')+' · 第 '+m.day+' 天</span><span>'+t+' · 标准用时 '+fmt(m.time.par)+'</span>';
    el('rsBody').innerHTML=body(m);
    var has=!!(m.id&&m.replay);
    el('rsFoot').hidden=!has; el('rsReplay').hidden=!has;
    el('rsBack').textContent=opts.backLabel||'回到主菜单';
    el('results').hidden=false;
    var cv=el('rscv');
    requestAnimationFrame(function(){ $imports.GradeScreen.play(cv,m.grade,{silent:!!opts.silent}); });
    var b=el('rsBack'); if(b) b.focus({preventScroll:true});
  }
  function close(){ var r=el('results'); if(r) r.hidden=true; var cv=el('rscv'); if(cv&&cv._raf){ cancelAnimationFrame(cv._raf); cv._raf=0; } }
  document.addEventListener('keydown',function(ev){
    var r=el('results'); if(!r||r.hidden||ev.key!=='Escape') return;
    if(['replayv','footv'].some(function(id){ var x=document.getElementById(id); return x&&!x.hidden; })) return;   /* 回放、足迹图自己处理 Esc */
    ev.preventDefault(); ev.stopImmediatePropagation(); var f=back; close(); if(f) f();   /* 截住：返回去打开的列表、档案馆不能被同一次按键再关掉 */
  },true);
  GameModules.on('endingCard',function(c){
    var r=$imports.RunScore.result(); if(!c||!c.el||!r) return;
    var q=c.el.querySelector('.equit');
    if(r.rated){
      var b=document.createElement('button'); b.type='button'; b.className='eres'; b.textContent='结算';
      b.addEventListener('click',function(){ open($imports.RunRecords.get(r.id)||r,{back:function(){ $imports.Game.quit(); },backLabel:'回到主菜单'}); });
      c.el.insertBefore(b,q);
    }else if(r.debug){
      var p=document.createElement('p'); p.className='enote'; p.textContent='调试局 · 不评级，不进通关记录'; c.el.insertBefore(p,q);
    }
  },{owner:'run-record'});
  GameModules.on('deathScreen',function(c){
    var old=el('diescore'); if(old) old.remove();
    var d=$imports.RunScore.deathLine(); if(!d||!c||!c.el) return;
    var p=document.createElement('p'); p.id='diescore';
    p.textContent=d.debug?'调试局 · 不计分':('本局积分 '+d.total+' · 探索度 '+d.explore+'%');
    c.el.insertBefore(p,c.el.querySelector('button'));
  },{owner:'run-record'});
  GameModules.on('boundary',function(reason){ if(reason==='menu') close(); },{owner:'run-record'});
  return {mount:mount,open:open,close:close,paintExplore:paintExplore,body:body,reportCard:reportCard,REPORT_SECRET:REPORT_SECRET};
})();

/* @module-exports */
GameModules.publish("game3d/js/modules/run-record/results-ui.js",{
"ResultsUI":{get:function(){return ResultsUI;},set:function($value){ResultsUI=$value;}}
});
})(GameModules.imports("game3d/js/modules/run-record/results-ui.js"));
