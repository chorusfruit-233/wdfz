/* @module-capsule */
(function($imports){
/* 里世界 3D · 回放流水
   按有效运行时间约 0.5 秒看一次位置，移动、转身或换场景了才记一个点（编码见 domain/run-track.js）；
   另记事件（异象、巡察、检查、选择、成就、结局……，带当时的位置）和每 10 秒一次的游戏日期与时刻。
   进行中的一局写在 wdfz3d_runlog_cur（约每 10 秒一次），与存档里的本局 ID 对应：读档时对得上就接着记，
   对不上就从读档这一刻重新开始并标「从中途开始」。通关时交给通关记录；死亡、新局时丢掉。 */
'use strict';
var RUNLOG_KEY='wdfz3d_runlog_cur';
var RUNLOG_MAX_EVENTS=600;

var RunLog=(function(){
  var L=blank(), acc=0, saveAcc=0, clockAcc=0, patAcc=0, last=null, achSeen=0;
  function blank(){ return {v:1,run:'',scenes:[],samples:[],pat:[],clock:[],events:[],start:Date.now(),partial:0}; }
  function now(){ return typeof $imports.Mechanics!=='undefined'?$imports.Mechanics.activePlaySeconds:0; }
  function sceneId(){ return $imports.S.mode==='in'?$imports.S.room:'out'; }
  function sceneIdx(id){ var i=L.scenes.indexOf(id); if(i<0){ L.scenes.push(id); i=L.scenes.length-1; } return i; }
  function point(force){
    if(typeof $imports.S==='undefined') return;
    var t=Math.round(now()*10), sc=sceneIdx(sceneId()), x=Math.round($imports.S.x/2), y=Math.round($imports.S.y/2);
    var a=((Math.round($imports.S.ang/(Math.PI*2)*64)%64)+64)%64, p=last;
    if(!force&&p&&p[1]===sc&&Math.abs(p[2]-x)<2&&Math.abs(p[3]-y)<2&&Math.min(Math.abs(p[4]-a),64-Math.abs(p[4]-a))<2) return;
    last=[t,sc,x,y,a]; L.samples.push(last);
  }
  /* 巡察者的位置（创意提案 C8）：每秒一个点，只在它和玩家在同一栋楼（同一片室外）时记；游戏里不显示，通关后的回放和足迹图里才能打开 */
  function building(id){ if(!id||id==='out') return 'out'; var R=$imports.INTERIORS[id]; return R?(R.host||id):id; }
  function patPoint(){
    if(typeof $imports.PAT==='undefined'||$imports.PAT.state!=='walk'||!$imports.PAT.room) return;
    var pr=$imports.PAT.room; if(building(pr)!==building(sceneId())) return;
    var R=$imports.INTERIORS[pr]; if(R&&R.noMap) return;
    if(L.pat.length>=7200) L.pat.shift();
    L.pat.push([Math.round(now()*10),sceneIdx(pr),Math.round($imports.PAT.x/2),Math.round($imports.PAT.y/2)]);
  }
  /* 事件超出上限时，先丢进出场景这类次要的 */
  function trim(){
    var i=-1; for(var k=0;k<L.events.length;k++){ if(L.events[k][1]==='room'){ i=k; break; } }
    L.events.splice(i>=0?i:0,1);
  }
  function event(kind,text,pts){
    if(typeof $imports.S==='undefined'||!L.run) return;
    if(L.events.length>=RUNLOG_MAX_EVENTS) trim();
    L.events.push([Math.round(now()*10),String(kind),String(text),pts|0,sceneIdx(sceneId()),Math.round($imports.S.x/2),Math.round($imports.S.y/2)]);
  }
  function pack(){
    return {v:1,run:L.run,scenes:L.scenes.slice(),track:$imports.RunTrack.encode(L.samples),pat:L.pat.slice(),clock:L.clock.slice(),events:L.events.slice(),start:L.start,partial:L.partial,
      sketch:(typeof $imports.RT!=='undefined'&&$imports.RT.exploration)?JSON.parse(JSON.stringify($imports.RT.exploration)):{}};
  }
  function persist(){ if(!L.run) return; try{ $imports.GameStorage.write(RUNLOG_KEY,JSON.stringify(pack())); }catch(e){} }
  function restore(runId){
    L=blank(); last=null;
    try{
      var r=$imports.GameStorage.read(RUNLOG_KEY), d=r&&r.value?JSON.parse(r.value):null;
      if(d&&d.v===1&&d.run===runId&&runId){
        L.run=d.run; L.scenes=Array.isArray(d.scenes)?d.scenes:[]; L.samples=$imports.RunTrack.decode(d.track);
        L.pat=Array.isArray(d.pat)?d.pat:[]; L.clock=Array.isArray(d.clock)?d.clock:[]; L.events=Array.isArray(d.events)?d.events:[]; L.start=+d.start||Date.now(); L.partial=d.partial?1:0;
        last=L.samples.length?L.samples[L.samples.length-1]:null;
        return;
      }
    }catch(e){}
    L.run=runId||('l'+Date.now().toString(36)); L.partial=1;     /* 对不上：从读档这一刻开始 */
  }
  function discard(){ L=blank(); last=null; try{ $imports.GameStorage.remove(RUNLOG_KEY); }catch(e){} }
  function tick(dt){
    if(typeof $imports.S==='undefined'||$imports.S.screen!=='play'||$imports.S.dead) return;
    if(!L.run){ var id=(typeof $imports.RunScore!=='undefined')?$imports.RunScore.run():''; restore(id); }
    acc+=dt; saveAcc+=dt; clockAcc+=dt; patAcc+=dt;
    if(acc>=0.5){ acc=0; point(false); }
    if(patAcc>=1){ patAcc=0; patPoint(); }
    if(clockAcc>=10){ clockAcc=0; L.clock.push([Math.round(now()*10),$imports.S.day,Math.round($imports.S.tsec)]); }
    try{
      var fresh=(typeof $imports.Achievements!=='undefined')?$imports.Achievements.run().fresh:[];
      while(achSeen<fresh.length){ var a=$imports.AchievementRules.get(fresh[achSeen++]); if(a) event('achieve','成就「'+a.n+'」 · '+$imports.ACH_TIERS[a.t].name,0); }
    }catch(e){}
    if(saveAcc>=10){ saveAcc=0; persist(); }
  }
  GameModules.on('newGame',function(){
    discard();
    L.run=(typeof $imports.RunScore!=='undefined')?$imports.RunScore.run():('l'+Date.now().toString(36)); L.start=Date.now(); achSeen=0;
    acc=0; saveAcc=0; clockAcc=0;
  },{owner:'run-record'});
  GameModules.on('enterRoom',function(id,restoring){
    if(typeof $imports.S==='undefined'||$imports.S.screen!=='play') return;
    if(!L.run){ restore((typeof $imports.RunScore!=='undefined')?$imports.RunScore.run():''); }
    point(true);
    if(!restoring){ var R=$imports.INTERIORS[id]; event('room','进入 '+((R&&R.name)||id),0); }
  },{owner:'run-record'});
  GameModules.on('leaveRoom',function(){ if(L.run&&typeof $imports.S!=='undefined'&&$imports.S.screen==='play') point(true); },{owner:'run-record'});
  GameModules.on('tick',tick,{owner:'run-record'});
  GameModules.on('gameFact',function(f){
    if(typeof $imports.S==='undefined'||$imports.S.screen==='menu') return;
    if(f.kind==='ending'&&!f.fake){ point(true); var e=(typeof $imports.ENDINGS!=='undefined'&&$imports.ENDINGS[f.id])?$imports.ENDINGS[f.id].t.replace(/\s+/g,''):f.id; event('ending','结局'+e,0); }
    else if(f.kind==='death'){ event('death',f.wake?'死去，又在座位上惊醒':'死亡',0); }
    else if(f.kind==='maze'&&f.what==='enter') event('maze','？？？',0);
    else if(f.kind==='maze'&&f.what==='leave') event('maze','回到了校园',0);
    else if(f.kind==='rest'){ try{ event('rest',$imports.SAN_ACTS[f.key].n,0); }catch(e){} }
    else if(f.kind==='garage') event('garage',f.what==='torch'?'手电照退了车库里的东西':'开走了车',0);
    else if(f.kind==='specialDay') event('day','特殊的上学日',0);
    else if(f.kind==='day') event('day','第 '+f.day+' 天',0);
  },{owner:'run-record',priority:5});                 /* 先于本局积分：结局那一刻的位置和事件要先记上，积分那边再交给通关记录 */
  GameModules.on('boundary',function(reason){ if(reason==='menu'&&L.run) persist(); },{owner:'run-record'});

  return {
    event:event, discard:discard, persist:persist,
    /* 通关：把这一局的回放交给通关记录 */
    finish:function(){ point(true); var p=pack(); try{ $imports.GameStorage.remove(RUNLOG_KEY); }catch(e){} return p; },
    snapshot:function(){ return pack(); },
    state:function(){ return L; }
  };
})();

/* @module-exports */
GameModules.publish("game3d/js/modules/run-record/run-log.js",{
"RUNLOG_KEY":{get:function(){return RUNLOG_KEY;},set:function($value){RUNLOG_KEY=$value;}},
"RUNLOG_MAX_EVENTS":{get:function(){return RUNLOG_MAX_EVENTS;},set:function($value){RUNLOG_MAX_EVENTS=$value;}},
"RunLog":{get:function(){return RunLog;},set:function($value){RunLog=$value;}}
});
})(GameModules.imports("game3d/js/modules/run-record/run-log.js"));
