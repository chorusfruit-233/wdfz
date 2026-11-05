/* 里世界 3D · 本局积分、时间分、评级与探索度（纯规则）
   计划：docs/plan/积分、评级与通关记录.md。只评价、不改玩法；不碰 DOM、存储和全局状态。
   分值、标准用时、评级阈值都是暂定值（计划 B0 待实测校准），集中在 SCORE_CFG；版本 SCORE_RULES 写进每条记录，
   以后调整只影响新记录。 */
'use strict';
var SCORE_RULES=1;
var SCORE_CFG={
  pts:{
    ending:300,
    anomalyLethal:40, anomalyClean:20, anomalyHurt:-10,
    noLaugh:15, laugh:-20, faceRight:10, faceWrong:-15, lesson:5, examPass:20, examFail:-10,
    inspectOk:20, inspectAbsent:-30, permanent:-80,
    patrolLocked:-10, patrolLockedCap:-60, patrolLost:10, locker:15,
    protect:-60, wake:-80,
    sanLow:-30, sanVeryLow:-30, exploreEach:2, exploreCap:200
  },
  sanLow:30, sanVeryLow:15,
  hardMult:1.2,
  /* 标准用时（秒）：《网安仙人》有无线接入与提交后 600 运行秒的固定等待；隐藏路线另设 */
  par:{car:1080,face:1200,portal:1320,cyber:1680,dismissal:1800,beast:600},
  timeBase:400, timeMin:0.25, timeMax:1.5,
  explore:{place:0.5,sketch:0.3,clue:0.2}
};
/* 九档：min 是评级分下限；band 决定音效组；名称与题词见计划 6.2 节 */
var GRADES=[
  {g:'F',  min:0,    name:'不及格',   band:'low',  memo:'卷子收上去了。名字那一栏是空的。'},
  {g:'E',  min:400,  name:'补考',     band:'low',  memo:'下一次，还是这间教室。'},
  {g:'D',  min:550,  name:'留级察看', band:'low',  memo:'你走出来了，学校还记着你。'},
  {g:'C',  min:700,  name:'及格',     band:'mid',  memo:'及格。和大多数人一样。'},
  {g:'B',  min:850,  name:'良好',     band:'mid',  memo:'你记得每一条走廊。'},
  {g:'A',  min:1000, name:'优秀',     band:'high', memo:'它们没能留住你。'},
  {g:'S',  min:1150, name:'表彰',     band:'high', memo:'你比铃声快。'},
  {g:'SS', min:1300, name:'保送',     band:'top',  memo:'门在你面前，一次就开了。'},
  {g:'SSS',min:1450, name:'准予离校', band:'top',  memo:'这一次，学校在你身后。'}
];
var SCORE_CATS=['结局','成就','应对 · 异象','应对 · 选择','校规与巡察','SAN','探索度','保命与惊醒'];

var ScoreRules=(function(){
  var C=SCORE_CFG, P=C.pts;
  function clamp(v,a,b){ return v<a?a:(v>b?b:v); }
  function timeScore(sec,par){
    if(!(sec>0)||!(par>0)) return 0;
    return Math.round(C.timeBase*clamp(par/sec,C.timeMin,C.timeMax));
  }
  function gradeOf(score){ var out=GRADES[0]; for(var i=0;i<GRADES.length;i++) if(score>=GRADES[i].min) out=GRADES[i]; return out; }
  function byLetter(g){ for(var i=0;i<GRADES.length;i++) if(GRADES[i].g===g) return GRADES[i]; return null; }
  /* SSS 门槛（2026-11-03 已定）：梦魇难度、没被救过、没惊醒过 */
  function gate(ctx){ return ctx.diff==='hard'&&!ctx.saved&&!(ctx.wakes>0); }
  function explore(x){
    var r=function(n,of){ return of>0?clamp(n/of,0,1):0; };
    var place=r(x.places,x.placesTotal), sketch=r(x.cells,x.cellsTotal), clue=r(x.clues,x.cluesTotal);
    var pct=Math.round(100*(place*C.explore.place+sketch*C.explore.sketch+clue*C.explore.clue));
    return {pct:pct,place:Math.round(place*100),sketch:Math.round(sketch*100),clue:Math.round(clue*100)};
  }
  /* 合并同类条目：「课桌答对 ×3」 */
  function group(items){
    var out=[], at={};
    items.forEach(function(it){
      var k=it.cat+'|'+it.text+'|'+it.pts;
      if(at[k]!==undefined){ out[at[k]].n++; return; }
      at[k]=out.length; out.push({cat:it.cat,text:it.text,pts:it.pts,n:1});
    });
    return out;
  }
  /* 积分：ledger 是本局逐条 [{cat,text,pts}]；ctx 补上结局、成就、SAN、探索度、难度 */
  function total(ledger,ctx){
    var items=ledger.slice();
    if(ctx.ending) items.unshift({cat:'结局',text:ctx.endingName||'通关',pts:P.ending});
    (ctx.achievements||[]).forEach(function(a){ if(a.pts) items.push({cat:'成就',text:a.name,pts:a.pts}); });
    if(ctx.san!==undefined&&ctx.san!==null){
      items.push({cat:'SAN',text:'最终状态',pts:Math.round(clamp(ctx.san,0,100))});
      if(ctx.minSan<C.sanLow) items.push({cat:'SAN',text:'一度动摇',pts:P.sanLow});
      if(ctx.minSan<C.sanVeryLow) items.push({cat:'SAN',text:'差一点崩溃',pts:P.sanVeryLow});
    }
    if(ctx.explore) items.push({cat:'探索度',text:'探索度 '+ctx.explore.pct+'%',pts:Math.min(P.exploreCap,ctx.explore.pct*P.exploreEach)});
    var sum=0; items.forEach(function(it){ sum+=it.pts; });
    var mult=ctx.diff==='hard'?C.hardMult:1;
    return {items:group(items),sum:sum,mult:mult,total:Math.max(0,Math.round(sum*mult))};
  }
  /* 评级：评级分 = 积分 + 时间分；够 SSS 但没过门槛给 SS */
  function rate(score,sec,par,ctx){
    var t=timeScore(sec,par), gs=score+t, g=gradeOf(gs), ok=gate(ctx), capped=false;
    if(g.g==='SSS'&&!ok){ g=byLetter('SS'); capped=true; }
    return {timeScore:t,gradeScore:gs,grade:g.g,gradeName:g.name,band:g.band,memo:g.memo,gate:ok,capped:capped};
  }
  function band(g){ var x=byLetter(g); return x?x.band:'mid'; }
  /* SAN 状态档：结算页先显示档位，精确值放在展开的明细里 */
  function sanBand(v){ return v>=60?'清醒':(v>=30?'动摇':'濒临'); }
  /* 调试面板：按评级反推一份示例明细，让评级分落在该档区间中间（SSS 按梦魇、没被救过、没惊醒过） */
  function sample(g,route,par){
    var x=byLetter(g)||GRADES[0], i=GRADES.indexOf(x), hi=i+1<GRADES.length?GRADES[i+1].min:x.min+200;
    var target=Math.round((x.min+hi)/2), hard=g==='SSS'||g==='SS';
    var sec=Math.round(par*(g==='F'?3.2:(g==='E'?2.4:(g==='D'?1.8:(g==='C'?1.4:(g==='B'?1.15:(g==='A'?1:(g==='S'?0.9:0.8))))))));
    var t=timeScore(sec,par), want=target-t, mult=hard?C.hardMult:1, base=Math.round(want/mult);
    var items=[{cat:'结局',text:'通关',pts:P.ending}], left=base-P.ending;
    var san=clamp(Math.round(40+left*0.1),5,100); items.push({cat:'SAN',text:'最终状态',pts:san}); left-=san;
    items.push({cat:'应对 · 异象',text:'调试示例',pts:left});
    var sum=0; items.forEach(function(it){ sum+=it.pts; });
    return {items:items,sum:sum,mult:mult,total:Math.max(0,Math.round(sum*mult)),sec:sec,diff:hard?'hard':'easy',san:san};
  }
  return {timeScore:timeScore,gradeOf:gradeOf,byLetter:byLetter,gate:gate,explore:explore,total:total,rate:rate,band:band,
    sanBand:sanBand,sample:sample,group:group,grades:GRADES,cfg:C};
})();
