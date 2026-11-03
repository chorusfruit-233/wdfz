/* @module-capsule */
(function($imports){
/* 里世界 3D · 调试面板「档案」页签（积分、评级与通关记录计划第 11 节）
   与「Mod」页签同样的挂法（DEV_TABS.push + devTab 钩子）；都在调试密码之后。打开面板本身就把进行中的这一局标成调试局，
   所以这里的操作不会产生真实的成就、通关记录和排行。
   - 本局：是否调试局、本局达成的成就、积分台账、探索度三项、有效运行秒；按当前状态估算评级（假设此刻以所选路线通关）。
   - 成就：四档提示与音效预览（不写记录）、内部条件一览（只在这里出现）、清空成就记录（点两次）。
   - 结算画面：任一档预览（示例数据，不写记录）；按路线 / 难度 / 评级生成通关记录（标「调试生成」）；九档各一条；删除调试生成的。
   - 回放与足迹：看进行中这一局的足迹图与回放；生成模拟回放；清空回放数据（点两次）。
   - CG 档案馆：打开档案馆（主菜单里）。 */
'use strict';
var DebugArchiveTab=(function(){
  var armed={};
  function el(id){ return document.getElementById(id); }
  function esc(t){ return String(t).replace(/[&<>"]/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function report(t){ try{ $imports.Dev.report(t); }catch(e){} var o=el('dvaOut'); if(o) o.textContent=t; }
  /* 危险操作：三秒内点第二次才执行 */
  function twice(key,btn,label,fn){
    if(armed[key]&&performance.now()-armed[key]<3000){ armed[key]=0; btn.textContent=label; fn(); return; }
    armed[key]=performance.now(); btn.textContent='再点一次确认'; setTimeout(function(){ if(armed[key]){ armed[key]=0; btn.textContent=label; } },3000);
  }
  function routeOpts(withHidden){
    var r=$imports.ACH_PUBLIC_ENDS.slice(); if(withHidden) r.push('beast');
    return r.map(function(id){ return '<option value="'+id+'">'+esc(($imports.ENDINGS[id]&&$imports.ENDINGS[id].t.replace(/\s+/g,''))||id)+'</option>'; }).join('');
  }
  function gradeOpts(){ return $imports.GRADES.map(function(g){ return '<option value="'+g.g+'">'+g.g+' · '+g.name+'</option>'; }).join(''); }
  /* 示例记录：按评级反推积分明细（调试预览、档案馆直接解锁的重看也用） */
  function sampleMeta(g,route,diff){
    var par=$imports.SCORE_CFG.par[route]||1200, smp=$imports.ScoreRules.sample(g,route,par);
    var d=diff||smp.diff, ctx={diff:g==='SSS'||g==='SS'?'hard':d,saved:0,wakes:0};
    var rate=$imports.ScoreRules.rate(smp.total,smp.sec,par,ctx);
    return {id:null,at:Date.now(),mode:'normal',diff:ctx.diff,talent:'tech',route:route,routeName:($imports.ENDINGS[route]&&$imports.ENDINGS[route].t.replace(/\s+/g,''))||route,
      day:1,clock:900,time:{active:smp.sec,rta:null,par:par,used:smp.sec},
      score:{rules:$imports.SCORE_RULES,total:smp.total,sum:smp.sum,mult:smp.mult,items:$imports.ScoreRules.group(smp.items)},
      grade:rate.grade,gradeName:rate.gradeName,band:rate.band,memo:rate.memo,gradeScore:rate.gradeScore,timeScore:rate.timeScore,gate:rate.gate,capped:rate.capped,
      explore:{pct:40,place:45,sketch:30,clue:40},san:{final:smp.san,min:Math.max(5,smp.san-30)},ach:{run:[],newly:[]},legacy:0,source:'debug',version:'',runId:null,rated:true,debug:false};
  }
  /* 模拟回放：在教学楼一楼和校园里走大约 30 分钟 */
  function sampleReplay(){
    var scenes=['teach1','out'], samples=[], events=[], t=0, R=$imports.INTERIORS.teach1, i, sc=0, x=0, y=0;
    function open(c,r){ return R.grid[r]&&R.grid[r][c]&&R.grid[r][c]!=='#'; }
    var c0=48, r0=6;
    for(i=0;i<3600;i++){
      if(i===1800){ sc=1; x=Math.round(1580/2); y=Math.round(1800/2); events.push([t,'room','走出教学楼',0,1,x,y]); }
      if(sc===0){ var nc=c0+Math.round(Math.sin(i/40)*6), nr=r0+Math.round(Math.cos(i/57)*4); if(open(nc,nr)){ c0=nc; r0=nr; } x=Math.round((R.ox+(c0+0.5)*R.tw)/2); y=Math.round((R.oy+(r0+0.5)*R.th)/2); }
      else { x+=Math.round(Math.cos(i/90)*3); y+=Math.round(Math.sin(i/70)*3); }
      samples.push([t,sc,x,y,(i/4|0)%64]); t+=5;
      if(i%400===200) events.push([t,['anomaly','patrol','inspection','choice'][(i/400|0)%4],'调试示例事件 '+(i/400|0),[20,-10,20,15][(i/400|0)%4],sc,x,y]);
    }
    var sketch={}, n=Math.ceil(R.cols*R.rows/6), s=''; for(i=0;i<n;i++) s+='_'; sketch.teach1=s;
    return {v:1,run:'debug',scenes:scenes,track:$imports.RunTrack.encode(samples),clock:[[0,1,700],[9000,1,1000]],events:events,start:Date.now(),partial:0,sketch:sketch};
  }
  function generate(g,route,diff,withReplay){
    var m=sampleMeta(g,route,diff);
    var id=$imports.RunRecords.add(m,withReplay?sampleReplay():null);
    /* CG 档案馆对应评级的结算画面：按「直接解锁 · 没有亲历」打开（与「全部解锁」同一口径） */
    try{ var d=$imports.DeathArchive.state(); d.granted['x.grade.'+m.grade]=1; $imports.DeathArchive.write(d); }catch(e){}
    return id;
  }
  function mount(){
    var tabs=document.querySelector('.devtabs'), body=el('devbody');
    if(!tabs||!body||typeof $imports.DEV_TABS==='undefined'||el('dev-page-archive')) return;
    $imports.DEV_TABS.push('archive');
    var btn=document.createElement('button'); btn.type='button'; btn.setAttribute('data-dev-tab','archive'); btn.setAttribute('aria-controls','dev-page-archive');
    btn.setAttribute('aria-pressed','false'); btn.textContent='档案'; btn.onclick=function(){ $imports.Dev.tab('archive'); }; tabs.appendChild(btn);
    var page=document.createElement('section'); page.className='devpage'; page.id='dev-page-archive'; page.hidden=true;
    page.innerHTML=
      '<div class="devsection"><div><h3>本局</h3><p>只读；打开面板这一刻起，这一局就是调试局</p></div></div><div id="dvaRun" class="dvarun"></div>'+
      '<div class="devrow"><select id="dvaEstRoute" aria-label="估算路线">'+routeOpts(true)+'</select><button type="button" id="dvaEst">按当前状态估算</button></div>'+
      '<div class="devsection"><div><h3>成就</h3><p>预览提示和音效，不写记录；内部条件只在这里出现</p></div></div>'+
      '<div class="devbuttons"><button type="button" data-tier="n">普通</button><button type="button" data-tier="e">精英</button><button type="button" data-tier="p">史诗</button><button type="button" data-tier="h">隐藏</button></div>'+
      '<details class="dvahow"><summary>内部条件一览</summary><ol id="dvaHow"></ol></details>'+
      '<button type="button" class="devdanger" id="dvaAchClear">清空成就记录</button>'+
      '<div class="devsection"><div><h3>结算画面</h3><p>预览不写记录；生成的记录标「调试生成」，不进排行、不计成就</p></div></div>'+
      '<div class="devrow"><select id="dvaGrade" aria-label="评级">'+gradeOpts()+'</select><button type="button" id="dvaPreview">预览结算画面</button></div>'+
      '<div class="devrow"><select id="dvaRoute" aria-label="路线">'+routeOpts(true)+'</select><select id="dvaDiff" aria-label="难度"><option value="easy">预知梦</option><option value="hard">梦魇</option></select>'+
      '<label class="dvachk"><input type="checkbox" id="dvaWithReplay">附带模拟回放</label></div>'+
      '<div class="devbuttons"><button type="button" id="dvaGen">生成通关记录</button><button type="button" id="dvaGenAll">九档各生成一条</button><button type="button" id="dvaDelDebug">删除调试生成的记录</button></div>'+
      '<div class="devsection"><div><h3>回放与足迹</h3><p>进行中这一局的数据；模拟回放用来检查体积和界面</p></div></div>'+
      '<div class="devbuttons"><button type="button" id="dvaFoot">本局足迹图</button><button type="button" id="dvaReplay">本局回放</button><button type="button" id="dvaFake">生成模拟回放</button></div>'+
      '<button type="button" class="devdanger" id="dvaClearReplays">清空回放数据</button>'+
      '<div class="devsection"><div><h3>CG 档案馆</h3><p>「结算画面」一节；「全部解锁」在档案馆里，照旧要输密码</p></div></div>'+
      '<div class="devbuttons"><button type="button" id="dvaArchive">打开 CG 档案馆</button></div>'+
      '<p class="devhint" id="dvaOut" role="status"></p>';
    body.appendChild(page);
    Array.prototype.forEach.call(page.querySelectorAll('[data-tier]'),function(b){ b.addEventListener('click',function(){ $imports.Achievements.preview(b.dataset.tier); report('预览：'+$imports.ACH_TIERS[b.dataset.tier].name+'成就提示'); }); });
    el('dvaEst').addEventListener('click',function(){
      if(typeof $imports.S==='undefined'||$imports.S.screen!=='play'){ report('请先开始游戏。'); return; }
      var r=$imports.RunScore.estimate(el('dvaEstRoute').value);
      report('估算：积分 '+r.score.total+' + 时间分 '+r.rate.timeScore+' = '+r.rate.gradeScore+' → '+r.rate.grade+(r.rate.capped?'（够 SSS，但门槛不满足）':'')+(r.trusted?'':' · 本局是调试局，真实结算不会评级'));
    });
    el('dvaAchClear').addEventListener('click',function(){ var b=this; twice('ach',b,'清空成就记录',function(){ $imports.Achievements.clear(); $imports.AchievementsUI.paintMenu(); report('成就记录已清空'); }); });
    el('dvaPreview').addEventListener('click',function(){ var g=el('dvaGrade').value; $imports.ResultsUI.open(sampleMeta(g,el('dvaRoute').value,el('dvaDiff').value),{back:null,backLabel:'关闭预览'}); report('预览：'+g); });
    el('dvaGen').addEventListener('click',function(){ var g=el('dvaGrade').value, id=generate(g,el('dvaRoute').value,el('dvaDiff').value,el('dvaWithReplay').checked); report(id?('已生成 '+g+' 记录（调试生成）'):'生成失败'); paintAll(); });
    el('dvaGenAll').addEventListener('click',function(){ var n=0; $imports.GRADES.forEach(function(g){ if(generate(g.g,el('dvaRoute').value,g.g==='SSS'||g.g==='SS'?'hard':el('dvaDiff').value,false)) n++; }); report('已生成 '+n+' 条（F–SSS 各一条，调试生成）'); paintAll(); });
    el('dvaDelDebug').addEventListener('click',function(){ var n=$imports.RunRecords.removeDebug(); report('已删除 '+n+' 条调试生成的记录'); paintAll(); });
    el('dvaFoot').addEventListener('click',function(){ if(typeof $imports.S==='undefined'||$imports.S.screen!=='play'){ report('请先开始游戏。'); return; } $imports.RecordsUI.footprint('current'); });
    el('dvaReplay').addEventListener('click',function(){ if(typeof $imports.S==='undefined'||$imports.S.screen!=='play'){ report('请先开始游戏。'); return; } $imports.RecordsUI.replay('current'); });
    el('dvaFake').addEventListener('click',function(){ var id=generate('B','car','easy',true); report(id?'已生成一条带模拟回放的 B 记录（调试生成）':'生成失败'); paintAll(); });
    el('dvaClearReplays').addEventListener('click',function(){ var b=this; twice('rp',b,'清空回放数据',function(){
      var n=0; $imports.RunRecords.list().forEach(function(x){ if(x.replay){ try{ $imports.GameStorage.remove($imports.CLEAR_PREFIX+x.id); }catch(e){} x.replay=0; n++; } });
      $imports.RunRecords.read().list.forEach(function(x){ x.replay=0; }); $imports.RunRecords.write(); report('已清空 '+n+' 条回放（记录保留）'); }); });
    el('dvaArchive').addEventListener('click',function(){ if(typeof $imports.S!=='undefined'&&$imports.S.screen!=='menu'){ report('回到主菜单后再打开档案馆。'); return; } try{ $imports.Dev.close(); }catch(e){} $imports.DeathArchive.open(); });
    var how=el('dvaHow');
    $imports.AchievementRules.list().forEach(function(a){ var li=document.createElement('li'); li.textContent=$imports.ACH_TIERS[a.t].name+' · '+a.n+'：'+a.how; how.appendChild(li); });
  }
  function paintAll(){ try{ $imports.RecordsUI.paintMenu(); }catch(e){} try{ if(!el('archive').hidden) $imports.DeathArchive.paint(); }catch(e){} }
  function paintRun(){
    var box=el('dvaRun'); if(!box) return;
    if(typeof $imports.S==='undefined'||$imports.S.screen==='menu'){ box.textContent='（主菜单：没有进行中的一局）'; return; }
    var st=$imports.RunScore.state(), ex=$imports.RunScore.explore(), got=$imports.Achievements.run().got.map(function(id){ var a=$imports.AchievementRules.get(id); return $imports.ACH_TIERS[a.t].name+'·'+a.n; });
    var sum=0; st.ledger.forEach(function(it){ sum+=it.pts; });
    box.innerHTML='<p>'+($imports.Achievements.debugRun()?'调试局（这一局不解锁成就、不评级）':'正常局')+' · 有效运行 '+Math.round((typeof $imports.Mechanics!=='undefined'?$imports.Mechanics.activePlaySeconds:0))+' 秒</p>'+
      '<p>本局成就：'+(got.length?esc(got.join('、')):'无')+'</p>'+
      '<p>积分台账（不含结局、成就、SAN、探索度）：'+sum+'（'+st.ledger.length+' 条）· 最低 SAN '+Math.round(Math.min(st.minSan,$imports.S.san))+'</p>'+
      '<p>探索度 '+ex.pct+'%（地点 '+ex.place+'% · 草图 '+ex.sketch+'% · 线索 '+ex.clue+'%）</p>';
  }
  GameModules.on('devTab',function(id){ if(id==='archive') paintRun(); },{owner:'run-record'});
  return {mount:mount,paintRun:paintRun,sampleMeta:sampleMeta,sampleReplay:sampleReplay,generate:generate};
})();

/* @module-exports */
GameModules.publish("game3d/js/modules/run-record/debug-tab.js",{
"DebugArchiveTab":{get:function(){return DebugArchiveTab;},set:function($value){DebugArchiveTab=$value;}}
});
})(GameModules.imports("game3d/js/modules/run-record/debug-tab.js"));
