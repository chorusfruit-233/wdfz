/* @module-capsule */
(function($imports){
/* 里世界 3D · 成就（模块）
   计划：docs/plan/成就系统.md。只记录，不改任何玩法；规则在 domain/achievement-rules.js。
   - 跨局记录 wdfz3d_achievements_v1：{version, got:{id:{at,diff,talent,day,mode,legacy}}, sets:{集合:{键:1}}, migrated}，
     新局、死亡、通关、档案室「全部解锁」都不动它。
   - 本局追踪跟存档（d.mods.achievements）：调试局 / Mod 局 / 旧存档局标记，笑、答错、检查、考试、保命等计数，本局达成集合 got。
   - 只认真实游玩：打开过调试面板的那一局（收起后也算）、调试开关开着、启用了用户 Mod 的局，都不解锁、不计集合。
   - 解锁提示排队，只在安全空当显示，并按档位播放不同的短音效。 */
'use strict';
var ACH_KEY='wdfz3d_achievements_v1';
var ACH_INTERNAL_ANOMALIES=['cola'];        /* 不在图鉴里的内部异象：不算进「异象图鉴」 */

var Achievements=(function(){
  var rec=null, run=null, avail=null, toastT=0, toastGap=0, showing=null;

  function blankRec(){ return {version:1,got:{},sets:{},migrated:0}; }
  function blankRun(){
    return {run:'',diff:null,talent:null,debug:0,mod:0,legacy:0,got:[],fresh:[],saved:0,wakes:0,laughs:0,faceWrong:0,
      insp:{},exams:{},rooms:{},an:null,queue:[]};
  }
  run=blankRun();

  /* ---------- 跨局记录 ---------- */
  function read(){
    var d=null;
    try{ var r=$imports.GameStorage.read(ACH_KEY); d=r&&r.value?JSON.parse(r.value):null; }catch(e){ d=null; }
    var out=blankRec();
    if(!d||typeof d!=='object'||d.version!==1) return out;
    if(d.got&&typeof d.got==='object') Object.keys(d.got).forEach(function(id){
      var g=d.got[id]; if(!$imports.AchievementRules.get(id)||!g||typeof g!=='object') return;   /* 未知 ID 丢掉 */
      out.got[id]={at:+g.at||0,diff:g.diff==='hard'?'hard':(g.diff==='easy'?'easy':null),talent:typeof g.talent==='string'?g.talent:null,
        day:+g.day||0,mode:g.mode==='speedrun'?'speedrun':'normal',legacy:g.legacy?1:0};
    });
    if(d.sets&&typeof d.sets==='object') Object.keys($imports.AchievementRules.sets).forEach(function(k){
      var s=d.sets[k]; if(!s||typeof s!=='object') return; out.sets[k]={};
      Object.keys(s).forEach(function(key){ if(s[key]) out.sets[k][key]=1; });
    });
    out.migrated=d.migrated?1:0;
    return out;
  }
  function state(){ if(!rec) rec=read(); return rec; }
  function write(){ try{ $imports.GameStorage.write(ACH_KEY,JSON.stringify(state())); }catch(e){} }

  /* 模块在不在：依赖它的成就（迷宫、隐藏天赋）模块拿掉时不可达 */
  function has(id){
    if(!avail){ avail={}; try{ GameModules.modules().forEach(function(m){ if(m.status==='ok') avail[m.id]=1; }); }catch(e){} }
    return !!avail[id];
  }
  function reachable(a){ return !a.needs||a.needs.every(has); }

  /* ---------- 视图：给纯规则读的只读快照 ---------- */
  function archiveCounts(){
    var o={pub:0,pubTotal:0,maze:0};
    try{
      var d=$imports.DeathArchive.state();
      $imports.DEATH_ARCHIVE.forEach(function(e){
        if(!e.secret){ o.pubTotal++; if(d.unlocked[e.id]) o.pub++; }
        else if((e.id==='void_lost'||e.id==='void_fall')&&d.unlocked[e.id]) o.maze++;
      });
    }catch(e){}
    return o;
  }
  function totals(){
    var t={rest:8,notes:10,anomalies:25,talents:7};
    try{ t.rest=Object.keys($imports.SAN_ACTS).length; }catch(e){}
    try{ t.notes=$imports.LESSON_TASKS.length; }catch(e){}
    try{ t.anomalies=$imports.AN_ID.filter(publicAnomaly).length; }catch(e){}
    try{ t.talents=$imports.TAL_KEYS.length; }catch(e){}
    return t;
  }
  function publicAnomaly(id){ return typeof $imports.AN_DEFS!=='undefined'&&!!$imports.AN_DEFS[id]&&ACH_INTERNAL_ANOMALIES.indexOf(id)<0; }
  function view(started){
    var r=state();
    return {run:run,sets:r.sets,unlocked:r.got,started:started||null,
      day:$imports.S.day,diff:$imports.S.diff,talent:$imports.S.talent,permanent:!!(typeof $imports.PAT!=='undefined'&&$imports.PAT.permanent),
      wuda:typeof $imports.WudaKid!=='undefined'&&$imports.WudaKid.active&&$imports.WudaKid.active(),
      total:totals(),archive:archiveCounts(),publicAnomaly:publicAnomaly,
      pickable:function(id){ return typeof $imports.TAL_KEYS!=='undefined'&&$imports.TAL_KEYS.indexOf(id)>=0; }};
  }

  /* ---------- 可信 ---------- */
  function userModsActive(){
    try{ return GameModules.mods().some(function(m){ return m.status==='active'&&m.source!=='code'; }); }catch(e){ return false; }
  }
  function debugNow(){
    return (typeof $imports.DEV!=='undefined'&&$imports.DEV.on)||(typeof $imports.Dev!=='undefined'&&$imports.Dev.modifiersActive&&$imports.Dev.modifiersActive());
  }
  /* 这一局能不能记成就：一旦标了调试局 / Mod 局就一直不能（标记跟存档保存） */
  function trusted(){
    if(typeof $imports.S==='undefined'||$imports.S.screen==='menu') return false;
    if(typeof $imports.ArchiveReplay!=='undefined'&&$imports.ArchiveReplay.on) return false;
    if(debugNow()) run.debug=1;
    return !run.debug&&!run.mod;
  }
  function ensureRun(){
    if(run.run) return;
    run.run='r'+Date.now().toString(36); run.legacy=1;      /* 读进来的旧存档没有本局追踪：全程类条件这一局不可得 */
    run.diff=$imports.S.diff; run.talent=$imports.S.talent;
  }

  /* ---------- 解锁 ---------- */
  function addRun(id){ if(run.got.indexOf(id)<0) run.got.push(id); }
  function unlock(a,opts){
    var r=state(), fresh=!r.got[a.id];
    if(fresh){
      r.got[a.id]={at:Date.now(),diff:opts&&opts.legacy?null:$imports.S.diff,talent:opts&&opts.legacy?null:$imports.S.talent,
        day:opts&&opts.legacy?0:($imports.S.day|0),mode:(typeof $imports.RUN_MODE!=='undefined'&&$imports.RUN_MODE==='speedrun')?'speedrun':'normal',legacy:opts&&opts.legacy?1:0};
    }
    if(!(opts&&opts.legacy)){
      /* 本局达成：一次 / 本局类做到了就进（以前解锁过也进）；跨局集合只在本局完成的那一次进 */
      if(a.scope!=='cross'||fresh) addRun(a.id);
      if(fresh){ run.queue.push(a.id); run.fresh.push(a.id); }
    }
    return fresh;
  }
  function evaluate(f,started){
    var v=view(started), any=false;
    var keys=$imports.AchievementRules.setKeys(f,v), r=state(), changed=false;
    Object.keys(keys).forEach(function(name){ var s=r.sets[name]||(r.sets[name]={}); if(!s[keys[name]]){ s[keys[name]]=1; changed=true; } });
    $imports.AchievementRules.candidates(f).forEach(function(a){
      if(!reachable(a)) return;
      var inRun=run.got.indexOf(a.id)>=0, unlocked=!!r.got[a.id];
      if(inRun||(a.scope==='cross'&&unlocked)) return;
      if($imports.AchievementRules.check(a,f,v)){ if(unlock(a)) changed=true; any=true; }
    });
    if(any) changed=checkAll()||changed;
    if(changed) write();
  }
  /* 「毕业」：其余公开成就全部达成之后 */
  function checkAll(){
    var a=$imports.AchievementRules.get('p.all'), r=state();
    if(r.got['p.all']) return false;
    if($imports.AchievementRules.check(a,{kind:'*'},view())){ unlock(a); return true; }
    return false;
  }

  /* ---------- 事实 ---------- */
  function onFact(f){
    if(!f||!f.kind) return;
    if(typeof $imports.S==='undefined'||$imports.S.screen==='menu') return;
    ensureRun();
    var started=null;
    /* 本局追踪先记下（不论能不能记成就，计数照样准确） */
    switch(f.kind){
      case 'anomaly':
        if(f.phase==='start') run.an=f.id;
        else if(f.phase==='end'){ started=run.an===f.id?f.id:null; run.an=null; }
        break;
      case 'protect': run.saved=1; break;
      case 'wake': run.wakes++; break;
      case 'fakeNormal': if(f.laugh===true) run.laughs++; break;
      case 'face': if(f.correct===false) run.faceWrong++; break;
      case 'inspection': { if(f.excused||f.result==='excused')break;var d=run.insp[f.day]||(run.insp[f.day]={}); d[f.slot]=f.compliant?1:-1; break; }
      case 'exam': if(f.phase==='paper'){ var x=run.exams[f.day]||(run.exams[f.day]={pass:0,fail:0}); if(f.pass) x.pass++; else x.fail++; } break;
    }
    if(!trusted()) return;
    evaluate(f,started);
  }

  /* ---------- 旧记录补发：只补能从现有可信记录完全确定的，标「旧记录」 ---------- */
  function backfill(){
    var r=state(); if(r.migrated) return;
    r.migrated=1;
    function give(id){ var a=$imports.AchievementRules.get(id); if(a&&!r.got[id]&&reachable(a)) unlock(a,{legacy:true}); }
    try{ if(typeof $imports.proSeen==='function'&&(0,$imports.proSeen)()) give('n.opening'); }catch(e){}
    try{
      var ends=(0,$imports.endsSeen)();
      $imports.ACH_PUBLIC_ENDS.forEach(function(id){ if(ends[id]) give('e.end_'+id); });
      if($imports.ACH_PUBLIC_ENDS.every(function(id){ return ends[id]; })) give('p.routes');
      if(ends.beast) give('h.beast');
    }catch(e){}
    try{
      var c=archiveCounts(), d=$imports.DeathArchive.state();
      if(Object.keys(d.unlocked).length) give('n.archive');
      if(c.pubTotal>0&&c.pub>=c.pubTotal) give('p.archive');
      if(c.maze>=2) give('h.maze_deaths');
    }catch(e){}
    try{
      var sd=$imports.Speedrun.read(), fin=sd.recent.filter(function(x){ return x.status==='finished'; });
      Object.keys(sd.best).forEach(function(k){ var p=k.split('|'); fin.push({route:p[2],ms:sd.best[k].ms,status:'finished'}); });
      if(fin.length) give('e.speedrun');
      if(fin.some(function(x){ return $imports.ACH_PUBLIC_ENDS.indexOf(x.route)>=0&&x.ms>0&&x.ms<=$imports.ACH_CFG.fastMs; })) give('p.fast');
      if(fin.some(function(x){ return x.route==='beast'; })) give('h.beast_run');
    }catch(e){}
    checkAll();
    write();
  }

  /* ---------- 提示队列：只在安全空当显示，按档位播放音效 ---------- */
  function calm(){
    if(typeof $imports.S==='undefined'||$imports.S.screen!=='play'||$imports.S.dead) return false;
    if(typeof $imports.CUT!=='undefined'&&$imports.CUT.on) return false;
    if(typeof $imports.TerminalUI!=='undefined'&&$imports.TerminalUI.on) return false;
    if(typeof $imports.Investigation!=='undefined'&&$imports.Investigation.idle) return $imports.Investigation.idle();
    return !$imports.AN.active;
  }
  function tick(dt){
    if(debugNow()&&run.run) run.debug=1;
    if(showing){ toastT-=dt; if(toastT<=0){ showing=null; toastGap=1.5; $imports.AchievementsUI.hideToast(); } return; }
    if(toastGap>0){ toastGap-=dt; return; }
    if(!run.queue.length||!calm()) return;
    var id=run.queue.shift(), a=$imports.AchievementRules.get(id); if(!a) return;
    showing=id; toastT=3.2;
    $imports.AchievementsUI.showToast(a);
    try{ $imports.SFX.achieve&&$imports.SFX.achieve(a.t); }catch(e){}
  }

  /* ---------- 生命周期 ---------- */
  function newRun(info){
    run=blankRun();
    run.run='r'+Date.now().toString(36)+$imports.PresentationRandom.integer(0,999999).toString(36);   /* 只是编号：不动玩法随机流 */
    run.diff=$imports.S.diff; run.talent=$imports.S.talent;
    if(debugNow()) run.debug=1;
    if(userModsActive()) run.mod=1;
    showing=null; toastT=0; toastGap=0;
  }
  GameModules.persistent('achievements',{
    save:function(){ return JSON.parse(JSON.stringify(run)); },
    load:function(d){
      var b=blankRun();
      if(d&&typeof d==='object'){
        Object.keys(b).forEach(function(k){ if(d[k]!==undefined&&typeof d[k]===typeof b[k]) b[k]=d[k]; });
        if(!Array.isArray(b.got)) b.got=[];
        b.got=b.got.filter(function(id){ return !!$imports.AchievementRules.get(id); });
        b.queue=Array.isArray(d.queue)?d.queue.filter(function(id){ return !!$imports.AchievementRules.get(id); }):[];
        b.fresh=Array.isArray(d.fresh)?d.fresh.filter(function(id){ return !!$imports.AchievementRules.get(id); }):[];
      }
      run=b;
      if(debugNow()) run.debug=1;
      if(userModsActive()) run.mod=1;
    },
    reset:function(){ run=blankRun(); showing=null; }
  });
  GameModules.on('gameFact',onFact,{owner:'achievements',priority:10});      /* 先于本局积分：积分要读本局达成集合 */
  GameModules.on('newGame',newRun,{owner:'achievements'});
  GameModules.on('enterRoom',function(id,restoring){
    if(restoring||typeof $imports.S==='undefined'||$imports.S.screen!=='play') return;
    ensureRun(); run.rooms[id]=1;
    if(trusted()) evaluate({kind:'room',id:id});
  },{owner:'achievements'});
  GameModules.on('mazeEvent',function(e){ if(e&&e.kind) onFact({kind:'mazeEvent',what:e.kind,id:e.id||null}); },{owner:'achievements'});
  GameModules.on('tick',tick,{owner:'achievements'});
  GameModules.on('boundary',function(reason){
    if(reason==='menu'){ showing=null; $imports.AchievementsUI.hideToast(); }
  },{owner:'achievements'});
  GameModules.on('boot',function(){ try{ backfill(); }catch(e){} $imports.AchievementsUI.mount(); },{owner:'achievements'});

  return {
    state:state, read:read, write:write,
    run:function(){ return run; },
    /* 本局达成（积分用）：[{id, t, pts}] */
    runGot:function(){ return run.got.map(function(id){ var a=$imports.AchievementRules.get(id); return {id:id,t:a.t,pts:$imports.AchievementRules.points(id)}; }); },
    /* 本局新解锁（结局卡、死亡界面、结算页用） */
    runNew:function(){ return run.fresh.slice(); },
    trusted:function(){ return !run.debug&&!run.mod; },
    debugRun:function(){ return !!run.debug; },
    reachable:reachable,
    view:view,
    visible:function(a){ var r=state(); return reachable(a)&&(!a.secret||!!r.got[a.id]); },
    counts:function(){
      var r=state(), pub=$imports.AchievementRules.publicList(), got=pub.filter(function(a){ return !!r.got[a.id]; }).length;
      var hid=$imports.AchievementRules.list().filter(function(a){ return a.secret&&!!r.got[a.id]; }).length;
      return {got:got,of:pub.length,hidden:hid};
    },
    /* 调试面板：预览提示与音效（不写记录）、清空记录 */
    preview:function(tier){
      var a={id:'preview',t:tier,n:'预览 · '+$imports.ACH_TIERS[tier].name,d:''};
      $imports.AchievementsUI.showToast(a); try{ $imports.SFX.achieve&&$imports.SFX.achieve(tier); }catch(e){}
      clearTimeout(Achievements._pv); Achievements._pv=setTimeout(function(){ $imports.AchievementsUI.hideToast(); },3200);
    },
    clear:function(){ rec=blankRec(); rec.migrated=1; write(); },
    _onFact:onFact, _evaluate:evaluate, _backfill:backfill
  };
})();

/* @module-exports */
GameModules.publish("game3d/js/modules/achievements/achievements.js",{
"ACH_KEY":{get:function(){return ACH_KEY;},set:function($value){ACH_KEY=$value;}},
"ACH_INTERNAL_ANOMALIES":{get:function(){return ACH_INTERNAL_ANOMALIES;},set:function($value){ACH_INTERNAL_ANOMALIES=$value;}},
"Achievements":{get:function(){return Achievements;},set:function($value){Achievements=$value;}}
});
})(GameModules.imports("game3d/js/modules/achievements/achievements.js"));
