/* @module-capsule */
(function($imports){
/* 里世界 3D · 本局积分台账与探索度
   计划：docs/plan/积分、评级与通关记录.md。只评价、不改玩法；规则在 domain/score-rules.js。
   本局台账跟存档（d.mods.runScore）：逐条加减分、最低 SAN、到过的场景与室外场地。
   通关（正常路线）时算出积分、时间分与评级，存一条通关记录；死亡时只给出一行积分，不评级、不进记录。
   调试局、Mod 局（与成就同一口径）不评级、不进记录。 */
'use strict';
/* 公开线索：S.clues 里不属于隐藏路线的那些（隐藏路线相关的不进分子分母） */
var SCORE_CLUES=['altar','atlas','bell','comp','gaten','gatew','geo','hand','keys','lesson','office','pendulum','portal','portalDiary',
  'repeat','roomkey','roster','server','trash','turn','usb'];

var RunScore=(function(){
  var st=blank(), zoneAcc=0, result=null, totalsCache=null;
  function blank(){ return {run:'',ledger:[],minSan:100,saved:0,wakes:0,locked:0,rooms:{},zones:{},an:null,anHurt:0,legacy:0,startedAt:0}; }
  function add(cat,text,pts,kind){
    st.ledger.push({cat:cat,text:text,pts:pts});
    if(st.ledger.length>400) st.ledger.shift();
    try{ $imports.RunLog.event(kind||'score',text,pts); }catch(e){}
  }
  function trusted(){
    if(typeof $imports.Achievements!=='undefined') return $imports.Achievements.trusted();
    return !(typeof $imports.DEV!=='undefined'&&$imports.DEV.on);
  }
  function anName(id){ try{ return ($imports.AN_NAME&&$imports.AN_NAME[id])||id; }catch(e){ return id; } }
  function ensure(){ if(!st.run){ st.run='s'+Date.now().toString(36); st.legacy=1; st.startedAt=Date.now(); } }

  function onFact(f){
    if(typeof $imports.S==='undefined'||$imports.S.screen==='menu') return;
    ensure();
    var P=$imports.SCORE_CFG.pts;
    switch(f.kind){
      case 'anomaly':
        if(f.phase==='start'){ st.an=f.id; st.anHurt=0; try{ $imports.RunLog.event('anomaly','遭遇「'+anName(f.id)+'」',0); }catch(e){} }
        else if(f.phase==='hurt'){ if(st.an===f.id) st.anHurt=1; }
        else if(f.phase==='end'&&st.an===f.id){
          if(f.survived){
            if(st.anHurt) add('应对 · 异象','「'+anName(f.id)+'」受伤后脱身',P.anomalyHurt,'anomaly');
            else add('应对 · 异象','化解「'+anName(f.id)+'」',f.lethal?P.anomalyLethal:P.anomalyClean,'anomaly');
          }
          st.an=null; st.anHurt=0;
        }
        break;
      case 'fakeNormal':
        if(f.laugh===true) add('应对 · 选择','笑出了声',P.laugh,'choice');
        else if(f.laugh===false) add('应对 · 选择','忍住了没笑',P.noLaugh,'choice');
        break;
      case 'face': add('应对 · 选择',f.correct?'验证题答对':'验证题答错',f.correct?P.faceRight:P.faceWrong,'choice'); break;
      case 'lesson': if(f.correct) add('应对 · 选择','课桌任务答对',P.lesson,'choice'); else try{ $imports.RunLog.event('choice','课桌任务答错',0); }catch(e){} break;
      case 'exam': if(f.phase==='paper') add('应对 · 选择',f.pass?'考试合格交卷':'考试没坐住',f.pass?P.examPass:P.examFail,'exam');
        else try{ $imports.RunLog.event('exam','撞响了钟楼的钟',0); }catch(e){}
        break;
      case 'inspection': if(f.excused||f.result==='excused')break;add('校规与巡察',f.compliant?'学生会检查 · 在教室':'学生会检查 · 缺席',f.compliant?P.inspectOk:P.inspectAbsent,'inspection'); break;
      case 'patrol':
        if(f.what==='permanent') add('校规与巡察','登记后缺席 · 持续追踪',P.permanent,'patrol');
        else if(f.what==='locked'){
          var room=$imports.SCORE_CFG.pts.patrolLockedCap-st.locked;
          if(room<0){ var pts=Math.max(P.patrolLocked,room); st.locked+=pts; add('校规与巡察','被巡察者盯上',pts,'patrol'); }
          else try{ $imports.RunLog.event('patrol','被巡察者盯上',0); }catch(e){}
        }
        else if(f.what==='lost') add('校规与巡察','甩掉了巡察者',P.patrolLost,'patrol');
        else if(f.what==='locker') add('校规与巡察','躲在柜子里躲过',P.locker,'patrol');
        else if(f.what==='banish') try{ $imports.RunLog.event('patrol','符纸烧成了灰',0); }catch(e){}
        break;
      case 'protect': st.saved=1; add('保命与惊醒',f.by==='immune'?'天生免疫挡下一次':'不知名药丸挡下一次',P.protect,'protect'); break;
      case 'wake': st.wakes++; add('保命与惊醒','预知梦惊醒',P.wake,'wake'); break;
      case 'death': if(!f.wake) onDeath(f); break;
      case 'ending': if(!f.fake) onEnding(f); break;
    }
  }

  /* ---------- 探索度 ---------- */
  /* 校门：北门、西小门、南门（map.js） */
  function gates(){ var out={}; if($imports.GATE_N) out.N=$imports.GATE_N; if($imports.GATE_W) out.W=$imports.GATE_W; if($imports.GATE_S) out.S=$imports.GATE_S; return out; }
  function totals(){
    if(totalsCache) return totalsCache;
    var rooms=[], cells=0, zones=[];
    Object.keys($imports.INTERIORS).forEach(function(id){
      var R=$imports.INTERIORS[id]; if(!R||R.noMap||R.secret) return;
      rooms.push(id);
      for(var y=0;y<R.rows;y++) for(var x=0;x<R.cols;x++) if(R.grid[y][x]!=='#') cells++;
    });
    try{ $imports.OBJ.forEach(function(o){ if(o.k&&o.k!=='roof') zones.push(o.id||(o.k+zones.length)); }); }catch(e){}
    Object.keys(gates()).forEach(function(k){ zones.push('gate'+k); });
    totalsCache={rooms:rooms,zones:zones,cells:cells};
    return totalsCache;
  }
  function seenCells(){
    var n=0;
    totals().rooms.forEach(function(id){
      var R=$imports.INTERIORS[id], b=$imports.ExplorationMap.seen(id); if(!b) return;
      for(var i=0;i<b.length;i++) if(b[i]&&R.grid[Math.floor(i/R.cols)][i%R.cols]!=='#') n++;
    });
    return n;
  }
  function explore(){
    var t=totals(), placesSeen=0, clues=0;
    t.rooms.forEach(function(id){ if(st.rooms[id]||($imports.ExplorationMap.count&&$imports.ExplorationMap.count(id)>0)) placesSeen++; });
    t.zones.forEach(function(z){ if(st.zones[z]) placesSeen++; });
    try{ SCORE_CLUES.forEach(function(id){ if($imports.S.clues&&$imports.S.clues[id]) clues++; }); }catch(e){}
    return $imports.ScoreRules.explore({places:placesSeen,placesTotal:t.rooms.length+t.zones.length,cells:seenCells(),cellsTotal:t.cells,
      clues:clues,cluesTotal:SCORE_CLUES.length});
  }
  /* 室外：落在哪块场地、离哪个校门近 */
  function zoneTick(){
    if($imports.S.mode!=='out') return;
    var mx=$imports.S.x/$imports.SC, my=$imports.S.y/$imports.SC;
    try{ $imports.OBJ.forEach(function(o,i){ if(!o.k||o.k==='roof') return; if(mx>o.x&&mx<o.x+o.w&&my>o.y&&my<o.y+o.h) st.zones[o.id||(o.k+i)]=1; }); }catch(e){}
    var gs=gates(); Object.keys(gs).forEach(function(k){ var g=gs[k]; if(Math.hypot(mx-g.x,my-g.y)<14) st.zones['gate'+k]=1; });
  }

  /* ---------- 结算 ---------- */
  function routeName(id){ try{ return $imports.ENDINGS[id]?$imports.ENDINGS[id].t.replace(/\s+/g,''):id; }catch(e){ return id; } }
  function context(extra){
    var a=(typeof $imports.Achievements!=='undefined')?$imports.Achievements.runGot().map(function(x){ var d=$imports.AchievementRules.get(x.id); return {id:x.id,name:$imports.ACH_TIERS[d.t].name+' · '+d.n,pts:x.pts}; }):[];
    var o={achievements:a,san:$imports.S.san,minSan:Math.min(st.minSan,$imports.S.san),explore:explore(),diff:$imports.S.diff,saved:st.saved,wakes:st.wakes};
    Object.keys(extra||{}).forEach(function(k){ o[k]=extra[k]; });
    return o;
  }
  function onEnding(f){
    result=null;
    var publicEnd=$imports.ACH_PUBLIC_ENDS.indexOf(f.id)>=0, ok=f.legit&&(publicEnd||f.id==='beast');
    var ctx=context({ending:ok,endingName:'通关 · '+routeName(f.id)});
    var sum=$imports.ScoreRules.total(st.ledger,ctx);
    var sr=(typeof $imports.Speedrun!=='undefined')?$imports.Speedrun.lastResult:null, rta=sr&&sr.rec&&sr.rec.ms>0?sr.rec.ms:null;
    var active=typeof $imports.Mechanics!=='undefined'?$imports.Mechanics.activePlaySeconds:0;
    var sec=($imports.RUN_MODE==='speedrun'&&rta)?rta/1000:active, par=$imports.SCORE_CFG.par[f.id]||1200;
    var rate=$imports.ScoreRules.rate(sum.total,sec,par,ctx);
    result={id:null,at:Date.now(),mode:$imports.RUN_MODE==='speedrun'?'speedrun':'normal',diff:$imports.S.diff,talent:$imports.S.talent,route:f.id,routeName:routeName(f.id),
      day:$imports.S.day,clock:$imports.S.tsec,time:{active:Math.round(active*10)/10,rta:rta,par:par,used:Math.round(sec*10)/10},
      score:{rules:$imports.SCORE_RULES,total:sum.total,sum:sum.sum,mult:sum.mult,items:sum.items},
      grade:rate.grade,gradeName:rate.gradeName,band:rate.band,memo:rate.memo,gradeScore:rate.gradeScore,timeScore:rate.timeScore,
      gate:rate.gate,capped:rate.capped,explore:ctx.explore,san:{final:Math.round($imports.S.san),min:Math.round(ctx.minSan)},
      ach:{run:(typeof $imports.Achievements!=='undefined')?$imports.Achievements.run().got.slice():[],newly:(typeof $imports.Achievements!=='undefined')?$imports.Achievements.runNew():[]},
      legacy:st.legacy,source:'play',version:typeof $imports.SPEEDRUN_GAME!=='undefined'?$imports.SPEEDRUN_GAME:'',runId:sr&&sr.rec?sr.rec.runId:null,
      rated:ok&&trusted(),debug:!trusted()};
    if(!result.rated) return;
    try{ result.id=$imports.RunRecords.add(result,$imports.RunLog.finish()); }catch(e){}
    try{ if(result.mode==='speedrun'&&result.runId) $imports.Speedrun.attachScore(result.runId,{score:result.score.total,grade:result.grade,rules:$imports.SCORE_RULES}); }catch(e){}
  }
  var deathLine=null;
  function onDeath(f){
    deathLine=null;
    var ctx=context({ending:false}), sum=$imports.ScoreRules.total(st.ledger,ctx);
    deathLine={total:sum.total,explore:ctx.explore.pct,debug:!trusted()};
    try{ $imports.RunLog.discard(); }catch(e){}
  }

  GameModules.persistent('runScore',{
    save:function(){ return JSON.parse(JSON.stringify(st)); },
    load:function(d){
      var b=blank();
      if(d&&typeof d==='object') Object.keys(b).forEach(function(k){ if(d[k]!==undefined&&typeof d[k]===typeof b[k]) b[k]=d[k]; });
      if(!Array.isArray(b.ledger)) b.ledger=[];
      st=b; result=null;
    },
    reset:function(){ st=blank(); result=null; }
  });
  GameModules.on('gameFact',onFact,{owner:'run-record'});
  GameModules.on('newGame',function(){ st=blank(); st.run='s'+Date.now().toString(36)+$imports.PresentationRandom.integer(0,999999).toString(36); st.startedAt=Date.now(); result=null; deathLine=null; },{owner:'run-record'});
  GameModules.on('enterRoom',function(id,restoring){ if(!restoring&&typeof $imports.S!=='undefined'&&$imports.S.screen==='play'){ ensure(); st.rooms[id]=1; } },{owner:'run-record'});
  GameModules.on('tick',function(dt){
    if(typeof $imports.S==='undefined'||$imports.S.screen!=='play'||$imports.S.dead) return;
    if($imports.S.san<st.minSan) st.minSan=$imports.S.san;
    zoneAcc+=dt; if(zoneAcc>=0.5){ zoneAcc=0; zoneTick(); }
  },{owner:'run-record'});

  return {
    state:function(){ return st; },
    explore:explore, totals:totals,
    result:function(){ return result; },
    deathLine:function(){ return deathLine; },
    /* 调试面板：按当前状态估算（假设此刻以所选路线通关） */
    estimate:function(route){
      var ctx=context({ending:true,endingName:'通关 · '+routeName(route)}), sum=$imports.ScoreRules.total(st.ledger,ctx);
      var active=typeof $imports.Mechanics!=='undefined'?$imports.Mechanics.activePlaySeconds:0, par=$imports.SCORE_CFG.par[route]||1200;
      var r=$imports.ScoreRules.rate(sum.total,Math.max(1,active),par,ctx);
      return {score:sum,rate:r,explore:ctx.explore,active:active,trusted:trusted()};
    },
    run:function(){ return st.run; }
  };
})();

/* @module-exports */
GameModules.publish("game3d/js/modules/run-record/run-score.js",{
"SCORE_CLUES":{get:function(){return SCORE_CLUES;},set:function($value){SCORE_CLUES=$value;}},
"RunScore":{get:function(){return RunScore;},set:function($value){RunScore=$value;}}
});
})(GameModules.imports("game3d/js/modules/run-record/run-score.js"));
