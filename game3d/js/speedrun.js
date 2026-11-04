/* @module-capsule */
(function($imports){
/* 里世界 3D · 速通模式
   状态机：idle → ready（选好难度、天赋，正在开局）→ running（第一次真正能操作时起表）→ finished / failed / abandoned / invalid。
   计时口径（首版本地 RTA，规则版本 SPEEDRUN_RULES）：
     - 起点：开局加载、前情提要、倒计时都结束，玩家第一次能操作的那一帧（playerInputAllowed）。
     - 暂停、背包、过场、切后台都继续计时；用 performance.now() 和 Date.now() 两个时钟取较大的那个，
       系统休眠时单调时钟可能停走，墙上时钟能补上；把墙上时钟往回拨也缩短不了成绩。
     - 终点：真结局（闸门、白名单、门）的通关条件确认、triggerEnding 的那一刻；不等结局演出，所以跳过演出不影响成绩。
       隐藏的成功路线也会停表并单独记录，但只有亲自打通以后才会出现在成绩里。
     - 死透了（预知梦惊醒不算）记失败；回主菜单记放弃；打开调试面板、不经正常路线直接触发结局记无效。
     - 速通用单独的存档槽：不覆盖、不删除普通模式的「继续上次」；速通不能读档接着跑。
   成绩存在 wdfz3d_speedrun_v1：最近 20 次和按「规则版本 · 难度 · 路线」分开的个人最佳。只是本机记录，不能防作弊。 */
'use strict';

var SPEEDRUN_KEY='wdfz3d_speedrun_v1';
var SPEEDRUN_RULES=6;                       /* 广播站与第五条公开真结局；旧成绩保留并按版本隔离。 */
var SPEEDRUN_GAME='3d-2026.11';
var RUN_MODE='normal';                      /* 'speedrun' 时存档写到单独的槽 */
var SPEEDRUN_ROUTES={dismissal:{n:'《放学》'},cyber:{n:'《网安仙人》'},car:{n:'《闸门》'},face:{n:'《白名单》'},portal:{n:'《门》'},beast:{n:'隐藏路线',secret:1}};
var SPEEDRUN_PUBLIC=['car','face','portal','cyber'];
var DIFF_NAME={easy:'预知梦',hard:'梦魇'};

function fmtRun(ms){
  ms=Math.max(0,Math.floor(ms||0));
  var h=Math.floor(ms/3600000), m=Math.floor(ms/60000)%60, s=Math.floor(ms/1000)%60, cs=Math.floor(ms/10)%100;
  function p(n){ return (n<10?'0':'')+n; }
  return p(h)+':'+p(m)+':'+p(s)+'.'+p(cs);
}

var Speedrun={run:null, proofId:null, hudOn:true,
  /* ---------- 状态 ---------- */
  active:function(){ return !!Speedrun.run&&(Speedrun.run.status==='ready'||Speedrun.run.status==='running'); },
  arm:function(diff){
    RUN_MODE='speedrun';
    Speedrun.run={id:Date.now().toString(36)+Math.floor($imports.GameRandom.next()*1e6).toString(36), diff:diff==='hard'?'hard':'easy',
      status:'ready', route:null, ms:0, reason:null, rules:SPEEDRUN_RULES, game:SPEEDRUN_GAME, p0:0, w0:0};
    try{ localStorage.removeItem('wdfz3d_speedrun_slot'); }catch(e){}
    Speedrun.paintHud(true);
  },
  /* 普通开局、读档：回到普通模式 */
  disarm:function(){ RUN_MODE='normal'; Speedrun.run=null; Speedrun.paintHud(true); },
  elapsed:function(){
    var r=Speedrun.run; if(!r) return 0;
    if(r.status!=='running') return r.ms;
    return Math.max(0,performance.now()-r.p0,Date.now()-r.w0);
  },
  /* 每个更新步调用：第一次能操作时起表 */
  tick:function(){
    var r=Speedrun.run; if(!r||r.status!=='ready') return;
    if($imports.S.screen==='play'&&!$imports.S.dead&&(0,$imports.playerInputAllowed)()&&!(typeof $imports.CUT!=='undefined'&&$imports.CUT.on)){
      r.status='running'; r.p0=performance.now(); r.w0=Date.now();
      try{ $imports.Playtest.event('速通起跑',r.diff); }catch(e){}
    }
  },
  invalidate:function(reason){
    var r=Speedrun.run; if(!Speedrun.active()||r.reason) return;
    r.reason=reason;                         /* 继续计时，但这次成绩不进个人最佳 */
    Speedrun.paintHud(true);
  },
  /* 正常路线在 triggerEnding 之前登记一下：直接在控制台调结局不会有这个 */
  proof:function(id){ Speedrun.proofId=id; },
  finish:function(id){
    var r=Speedrun.run; if(!r||r.status!=='running') return null;
    if(!SPEEDRUN_ROUTES[id]) return null;
    r.ms=Math.round(Speedrun.elapsed()); r.route=id;            /* 记录按整毫秒存，和个人最佳一致 */
    if(Speedrun.proofId!==id&&!r.reason) r.reason='ending_direct';
    if(!r.reason&&typeof $imports.Dev!=='undefined'&&$imports.Dev.modifiersActive()) r.reason='debug';   /* 没开面板、从控制台打开的调试开关：照样无效 */
    Speedrun.proofId=null;
    r.status=r.reason?'invalid':'finished';
    var res=Speedrun.save(r);
    Speedrun.paintHud(true);
    return res;
  },
  fail:function(status,why){
    var r=Speedrun.run; if(!Speedrun.active()) return null;
    if(r.status==='ready'){ Speedrun.run=null; Speedrun.paintHud(true); return null; }   /* 还没起跑就退出：不记 */
    r.ms=Math.round(Speedrun.elapsed()); r.status=status; r.why=why||null;
    var res=Speedrun.save(r);
    Speedrun.paintHud(true);
    return res;
  },

  /* ---------- 成绩 ---------- */
  read:function(){
    var d=null;
    try{ d=JSON.parse(localStorage.getItem(SPEEDRUN_KEY)||'null'); }catch(e){ d=null; }
    if(!d||typeof d!=='object'||d.version!==1) d={version:1,recent:[],best:{}};
    if(!Array.isArray(d.recent)) d.recent=[];
    if(!d.best||typeof d.best!=='object') d.best={};
    d.recent=d.recent.filter(function(x){ return x&&typeof x==='object'&&Number.isFinite(x.ms)&&x.ms>=0; });
    Object.keys(d.best).forEach(function(k){ var b=d.best[k]; if(!b||!Number.isFinite(b.ms)||b.ms<=0) delete d.best[k]; });
    return d;
  },
  key:function(rules,diff,route){ return 'r'+rules+'|'+diff+'|'+route; },
  save:function(r){
    var d=Speedrun.read(), rec={runId:r.id,diff:r.diff,route:r.route,ms:Math.round(r.ms),status:r.status,reason:r.reason||null,
      why:r.why||null,rules:r.rules,game:r.game,at:Date.now()};
    if(d.recent.some(function(x){ return x.runId===r.id; })) return {rec:rec,pb:false,best:Speedrun.best(r.diff,r.route,d)};   /* 同一次只记一回 */
    d.recent.unshift(rec); d.recent=d.recent.slice(0,20);
    var pb=false;
    if(rec.status==='finished'){
      var k=Speedrun.key(rec.rules,rec.diff,rec.route), old=d.best[k];
      if(!old||rec.ms<old.ms){ d.best[k]={ms:rec.ms,runId:rec.runId,at:rec.at,game:rec.game}; pb=true; }
    }
    try{ localStorage.setItem(SPEEDRUN_KEY,JSON.stringify(d)); }catch(e){}
    (0,$imports.gameFact)('speedrun',{runId:rec.runId,status:rec.status,route:rec.route,diff:rec.diff,ms:rec.ms,rules:rec.rules,pb:pb});
    return {rec:rec,pb:pb,best:Speedrun.best(r.diff,r.route,d)};
  },
  /* 积分与评级（积分、评级与通关记录计划）：结算算出来以后补进这一局的速通记录 */
  attachScore:function(runId,info){
    var d=Speedrun.read(), hit=false;
    d.recent.forEach(function(x){ if(x.runId===runId){ x.score=info.score; x.grade=info.grade; x.scoreRules=info.rules; hit=true; } });
    Object.keys(d.best).forEach(function(k){ if(d.best[k].runId===runId){ d.best[k].score=info.score; d.best[k].grade=info.grade; hit=true; } });
    if(hit){ try{ localStorage.setItem(SPEEDRUN_KEY,JSON.stringify(d)); }catch(e){} }
    return hit;
  },
  best:function(diff,route,d){
    d=d||Speedrun.read(); var b=d.best[Speedrun.key(SPEEDRUN_RULES,diff,route)];
    return b?b.ms:null;
  },
  reasonText:function(x){
    return {debug:'用了调试面板',ending_direct:'没有经过正常路线',load:'读了存档'}[x]||'';
  },
  statusText:function(rec){
    if(rec.status==='finished') return '通关';
    if(rec.status==='invalid') return '无效（'+Speedrun.reasonText(rec.reason)+'）';
    if(rec.status==='failed') return '未通关';
    if(rec.status==='abandoned') return '放弃';
    return rec.status;
  },
  routeName:function(id){ var r=SPEEDRUN_ROUTES[id]; return r?r.n:'—'; },

  /* ---------- 画面 ---------- */
  paintHud:function(force){
    var el=document.getElementById('srclock'); if(!el) return;
    var r=Speedrun.run, show=!!r&&RUN_MODE==='speedrun'&&$imports.S.screen!=='menu'&&Speedrun.hudOn;
    if(el.hidden===show) el.hidden=!show;
    if(!show) return;
    /* 触屏：右上角是手册 / 暂停 / 全屏和小地图，计时放到小地图下面，不压住按键 */
    if($imports.IS_TOUCH){
      var mini=document.getElementById('mini'), mr=mini&&mini.getBoundingClientRect();
      var top=(mr&&mr.height>0)?Math.round(mr.bottom+8)+'px':'';
      if(el.style.top!==top) el.style.top=top;
    }else if(el.style.top) el.style.top='';
    var t=fmtRun(Speedrun.elapsed());
    if(force||el._t!==t){ el._t=t; el.querySelector('b').textContent=t; }
    var tag=r.reason?'无效':(r.status==='ready'?'就绪':(r.status==='finished'?'完成':(r.status==='running'?DIFF_NAME[r.diff]:'结束')));
    if(el._tag!==tag){ el._tag=tag; el.querySelector('i').textContent='速通 · '+tag; el.classList.toggle('bad',!!r.reason); }
  },
  /* 结局卡上的一段 */
  cardHtml:function(res){
    if(!res) return '';
    var rec=res.rec, best=res.best;
    var line=rec.status==='finished'?(res.pb?'新的个人最佳':('个人最佳 '+(best!==null?fmtRun(best):'—'))):Speedrun.statusText(rec);
    return '<div class="esr"><i>速通 · '+DIFF_NAME[rec.diff]+' · '+Speedrun.routeName(rec.route)+'</i><b>'+fmtRun(rec.ms)+'</b><small>'+line+'</small></div>';
  },
  dieText:function(res){
    if(!res) return '';
    return '速通 · '+DIFF_NAME[res.rec.diff]+' · 未通关 · '+fmtRun(res.rec.ms);
  },

  /* ---------- 菜单 ---------- */
  open:function(){
    var el=document.getElementById('srpick'); if(!el) return;
    Speedrun.paintRecords(); el.hidden=false;
    try{ (0,$imports.resetInputState)(); (0,$imports.releaseMouseLook)(); }catch(e){}
    var b=el.querySelector('[data-diff="easy"]'); if(b) b.focus({preventScroll:true});
  },
  close:function(){
    var el=document.getElementById('srpick'); if(el) el.hidden=true;
    var b=document.getElementById('btnspeed'); if(b) b.focus({preventScroll:true});
  },
  choose:function(diff){
    Speedrun.close();
    if(typeof $imports.TalentPick!=='undefined') $imports.TalentPick.open(diff,'speedrun');
  },
  paintRecords:function(){
    var d=Speedrun.read(), box=document.getElementById('srrecords'); if(!box) return;
    var rows=[], seen=(0,$imports.endsSeen)();
    ['easy','hard'].forEach(function(diff){
      SPEEDRUN_PUBLIC.concat(['beast']).forEach(function(route){
        var ms=Speedrun.best(diff,route,d);
        if(SPEEDRUN_ROUTES[route].secret&&(ms===null||!seen[route])) return;        /* 隐藏路线：没打通过就不出现 */
        var bg=(typeof $imports.RunRecords!=='undefined')?$imports.RunRecords.bestGrade(diff,route,'speedrun'):null;
        rows.push('<tr><td>'+DIFF_NAME[diff]+'</td><td>'+(SPEEDRUN_ROUTES[route].secret?($imports.ENDINGS[route]?$imports.ENDINGS[route].t:'隐藏路线'):Speedrun.routeName(route))+'</td><td>'+(ms===null?'—':fmtRun(ms))+'</td><td>'+(bg||'—')+'</td></tr>');
      });
    });
    var recent=d.recent.slice(0,5).map(function(x){
      var rn=(x.route&&SPEEDRUN_ROUTES[x.route]&&SPEEDRUN_ROUTES[x.route].secret)?($imports.ENDINGS[x.route]?$imports.ENDINGS[x.route].t:''):Speedrun.routeName(x.route);
      return '<li><span>'+DIFF_NAME[x.diff]+(x.route?' · '+rn:'')+'</span><b>'+fmtRun(x.ms)+'</b><i>'+Speedrun.statusText(x)+(x.grade?' · '+x.grade:'')+'</i></li>';
    }).join('');
    box.innerHTML='<table><thead><tr><th>难度</th><th>路线</th><th>个人最佳</th><th>最佳评级</th></tr></thead><tbody>'+rows.join('')+'</tbody></table>'+
      (recent?'<p class="srsub">最近</p><ul>'+recent+'</ul>':'<p class="srsub">还没有成绩。</p>');
    if(typeof $imports.RecordsUI!=='undefined') $imports.RecordsUI.paintRanking(box);          /* 排行：按用时或按评级 */
  }
};
document.addEventListener('keydown',function(ev){
  var el=document.getElementById('srpick');
  if(el&&!el.hidden&&ev.key==='Escape'){ ev.preventDefault(); ev.stopPropagation(); Speedrun.close(); }
},true);
/* 切回前台时补一次显示（后台期间计时照常） */
document.addEventListener('visibilitychange',function(){ try{ Speedrun.paintHud(true); }catch(e){} });

/* @module-exports */
GameModules.publish("game3d/js/speedrun.js",{
"SPEEDRUN_KEY":{get:function(){return SPEEDRUN_KEY;},set:function($value){SPEEDRUN_KEY=$value;}},
"SPEEDRUN_RULES":{get:function(){return SPEEDRUN_RULES;},set:function($value){SPEEDRUN_RULES=$value;}},
"SPEEDRUN_GAME":{get:function(){return SPEEDRUN_GAME;},set:function($value){SPEEDRUN_GAME=$value;}},
"RUN_MODE":{get:function(){return RUN_MODE;},set:function($value){RUN_MODE=$value;}},
"SPEEDRUN_ROUTES":{get:function(){return SPEEDRUN_ROUTES;},set:function($value){SPEEDRUN_ROUTES=$value;}},
"SPEEDRUN_PUBLIC":{get:function(){return SPEEDRUN_PUBLIC;},set:function($value){SPEEDRUN_PUBLIC=$value;}},
"DIFF_NAME":{get:function(){return DIFF_NAME;},set:function($value){DIFF_NAME=$value;}},
"fmtRun":{get:function(){return fmtRun;},set:function($value){fmtRun=$value;}},
"Speedrun":{get:function(){return Speedrun;},set:function($value){Speedrun=$value;}}
});
})(GameModules.imports("game3d/js/speedrun.js"));
