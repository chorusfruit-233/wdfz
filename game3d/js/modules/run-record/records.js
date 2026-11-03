/* @module-capsule */
(function($imports){
/* 里世界 3D · 通关记录存储
   元数据 wdfz3d_clears_v1：{version:1, list:[记录…], grades:{F:{first,count,best}}}；最多 50 条，超出删最旧的，
   但保留每条路线 × 难度的最高评级和最快用时；「评级取得」摘要 grades 永不删（CG 档案馆「结算画面」看它）。
   回放按条存 wdfz3d_clear_<id>，只留最近 10 次和上面那些「最佳」的；写不下先删最旧的回放，再不行只存元数据。
   调试面板生成的记录 source:'debug'：列表里标「调试生成」，不进排行、不占「最佳」、不计成就、不点亮真实的评级取得。 */
'use strict';
var CLEARS_KEY='wdfz3d_clears_v1', CLEAR_PREFIX='wdfz3d_clear_', CLEARS_MAX=50, REPLAYS_MAX=10;

var RunRecords=(function(){
  var cache=null;
  function blank(){ return {version:1,list:[],grades:{}}; }
  function read(){
    if(cache) return cache;
    var d=null;
    try{ var r=$imports.GameStorage.read(CLEARS_KEY); d=r&&r.value?JSON.parse(r.value):null; }catch(e){ d=null; }
    var out=blank();
    if(d&&d.version===1){
      if(Array.isArray(d.list)) out.list=d.list.filter(function(x){ return x&&typeof x==='object'&&typeof x.id==='string'&&$imports.GRADES.some(function(g){ return g.g===x.grade; }); });
      if(d.grades&&typeof d.grades==='object') $imports.GRADES.forEach(function(g){ var v=d.grades[g.g]; if(v&&typeof v==='object') out.grades[g.g]={first:+v.first||0,count:v.count|0,best:typeof v.best==='string'?v.best:null}; });
    }
    cache=out; return out;
  }
  function write(){ try{ return $imports.GameStorage.write(CLEARS_KEY,JSON.stringify(read())); }catch(e){ return false; } }
  function real(x){ return x.source!=='debug'; }
  /* 「最佳」：每条路线 × 难度的最高评级分、最快用时（只看真实的） */
  function bestIds(list){
    var keep={}, byKey={};
    list.filter(real).forEach(function(x){
      var k=x.route+'|'+x.diff, b=byKey[k]||(byKey[k]={g:null,t:null});
      if(!b.g||x.gradeScore>b.g.gradeScore) b.g=x;
      if(!b.t||x.time.used<b.t.time.used) b.t=x;
    });
    Object.keys(byKey).forEach(function(k){ keep[byKey[k].g.id]=1; keep[byKey[k].t.id]=1; });
    return keep;
  }
  function replayKeep(list){
    var keep=bestIds(list), recent=list.slice().sort(function(a,b){ return b.at-a.at; }).slice(0,REPLAYS_MAX);
    recent.forEach(function(x){ keep[x.id]=1; });
    return keep;
  }
  function trim(d){
    var keep=bestIds(d.list);
    while(d.list.length>CLEARS_MAX){
      var oldest=null; d.list.forEach(function(x){ if(keep[x.id]) return; if(!oldest||x.at<oldest.at) oldest=x; });
      if(!oldest) break;
      d.list.splice(d.list.indexOf(oldest),1); try{ $imports.GameStorage.remove(CLEAR_PREFIX+oldest.id); }catch(e){}
    }
    var rk=replayKeep(d.list);
    d.list.forEach(function(x){ if(x.replay&&!rk[x.id]){ try{ $imports.GameStorage.remove(CLEAR_PREFIX+x.id); }catch(e){} x.replay=0; } });
  }
  function saveReplay(d,id,data){
    var s=JSON.stringify(data);
    for(var tries=0;tries<12;tries++){
      if($imports.GameStorage.write(CLEAR_PREFIX+id,s)) return true;
      var old=d.list.filter(function(x){ return x.replay&&x.id!==id; }).sort(function(a,b){ return a.at-b.at; })[0];
      if(!old) return false;
      try{ $imports.GameStorage.remove(CLEAR_PREFIX+old.id); }catch(e){} old.replay=0;
    }
    return false;
  }
  function add(meta,replay){
    var d=read(), rec=JSON.parse(JSON.stringify(meta));
    rec.id='c'+Date.now().toString(36)+$imports.PresentationRandom.integer(0,9999).toString(36);   /* 只是编号：不动玩法随机流 */
    rec.replay=0;
    d.list.push(rec);
    if(real(rec)){
      var g=d.grades[rec.grade]||(d.grades[rec.grade]={first:rec.at,count:0,best:null});
      g.count++; if(!g.first) g.first=rec.at;
      var cur=g.best&&d.list.filter(function(x){ return x.id===g.best; })[0];
      if(!cur||rec.gradeScore>=cur.gradeScore) g.best=rec.id;
    }
    if(replay&&replay.track!==undefined) rec.replay=saveReplay(d,rec.id,replay)?1:0;
    trim(d);
    write();
    return rec.id;
  }
  function get(id){ return read().list.filter(function(x){ return x.id===id; })[0]||null; }
  function replay(id){
    try{ var r=$imports.GameStorage.read(CLEAR_PREFIX+id), d=r&&r.value?JSON.parse(r.value):null; if(d&&d.v===1) return d; }catch(e){}
    return null;
  }
  function remove(id){
    var d=read(), x=get(id); if(!x) return false;
    d.list.splice(d.list.indexOf(x),1); try{ $imports.GameStorage.remove(CLEAR_PREFIX+id); }catch(e){}
    Object.keys(d.grades).forEach(function(g){ if(d.grades[g].best===id) d.grades[g].best=null; });
    write(); return true;
  }
  function removeDebug(){ var n=0; read().list.filter(function(x){ return !real(x); }).forEach(function(x){ if(remove(x.id)) n++; }); return n; }
  /* 速通排行：真实、速通模式、有 RTA 的记录；by:'time'|'grade' */
  function ranking(diff,route,by){
    var rows=read().list.filter(function(x){ return real(x)&&x.mode==='speedrun'&&x.time&&x.time.rta>0&&x.diff===diff&&x.route===route; });
    var order=$imports.GRADES.map(function(g){ return g.g; });
    rows.sort(by==='grade'?function(a,b){ return (order.indexOf(b.grade)-order.indexOf(a.grade))||(a.time.rta-b.time.rta); }
      :function(a,b){ return a.time.rta-b.time.rta; });
    return rows.slice(0,10);
  }
  function bestGrade(diff,route,mode){
    var order=$imports.GRADES.map(function(g){ return g.g; }), best=null;
    read().list.forEach(function(x){ if(real(x)&&x.diff===diff&&x.route===route&&(!mode||x.mode===mode)&&(!best||order.indexOf(x.grade)>order.indexOf(best))) best=x.grade; });
    return best;
  }
  return {read:read,write:write,add:add,get:get,replay:replay,remove:remove,removeDebug:removeDebug,ranking:ranking,bestGrade:bestGrade,
    list:function(){ return read().list.slice(); },
    grades:function(){ return read().grades; },
    _reset:function(){ cache=null; }};
})();

/* @module-exports */
GameModules.publish("game3d/js/modules/run-record/records.js",{
"CLEARS_KEY":{get:function(){return CLEARS_KEY;},set:function($value){CLEARS_KEY=$value;}},
"CLEAR_PREFIX":{get:function(){return CLEAR_PREFIX;},set:function($value){CLEAR_PREFIX=$value;}},
"CLEARS_MAX":{get:function(){return CLEARS_MAX;},set:function($value){CLEARS_MAX=$value;}},
"REPLAYS_MAX":{get:function(){return REPLAYS_MAX;},set:function($value){REPLAYS_MAX=$value;}},
"RunRecords":{get:function(){return RunRecords;},set:function($value){RunRecords=$value;}}
});
})(GameModules.imports("game3d/js/modules/run-record/records.js"));
