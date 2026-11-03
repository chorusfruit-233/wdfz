/* @module-capsule */
(function($imports){
/* 里世界 3D · 积分、评级与通关记录：启动时挂界面、在 CG 档案馆登记「结算画面」一节 */
'use strict';
var RunRecord=(function(){
  /* CG 档案馆「结算画面」：取得过该评级（真实通关）就点亮；「全部解锁」打开的用示例数据重看 */
  function gradeSection(){
    var seen=function(g){ return !!$imports.RunRecords.grades()[g]; };
    function fmtDate(t){ var d=new Date(t); function p(n){ return (n<10?'0':'')+n; } return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()); }
    $imports.DeathArchive.addSection({
      id:'grades', title:'结算画面',
      ids:function(){ return $imports.GRADES.map(function(g){ return 'x.grade.'+g.g; }); },
      isOpen:function(id,d){ return seen(id.slice(8))||!!(d.granted&&d.granted[id]); },
      count:function(d){ var n=$imports.GRADES.filter(function(g){ return seen(g.g)||!!d.granted['x.grade.'+g.g]; }).length; return '已解锁 '+n+' / '+$imports.GRADES.length; },
      cards:function(d){
        var gs=$imports.RunRecords.grades();
        return $imports.GRADES.map(function(g,i){
          var real=gs[g.g], open=!!real||!!d.granted['x.grade.'+g.g];
          var best=real&&real.best?$imports.RunRecords.get(real.best):null;
          var meta=real?('第一次取得 '+fmtDate(real.first)+' · 取得 '+real.count+' 次'+(best?' · 最好的一次：'+best.routeName:'')):'直接解锁 · 没有亲历';
          return {id:'x.grade.'+g.g,no:i+1,n:g.g+' · '+g.name,d:'「'+g.memo+'」',open:open,meta:meta,locked:['尚未取得','封存的画面。']};
        });
      },
      replay:function(id){
        var g=id.slice(8), real=$imports.RunRecords.grades()[g], m=real&&real.best?$imports.RunRecords.get(real.best):null;
        if(!m) m=$imports.DebugArchiveTab.sampleMeta(g,'car',g==='SSS'||g==='SS'?'hard':'easy'), m.source='archive';
        var ar=document.getElementById('archive'); if(ar) ar.hidden=true;
        $imports.ResultsUI.open(m,{back:function(){ $imports.DeathArchive.open(); var b=document.querySelector('#arsec-grades .arcard[data-id="'+id+'"] button'); if(b) b.focus({preventScroll:true}); },backLabel:'返回档案馆'});
      }
    });
  }
  GameModules.on('boot',function(){
    try{ $imports.ResultsUI.mount(); }catch(e){}
    try{ $imports.RecordsUI.mount(); }catch(e){}
    try{ $imports.DebugArchiveTab.mount(); }catch(e){}
    try{ gradeSection(); }catch(e){}
  },{owner:'run-record'});
  return {gradeSection:gradeSection};
})();

/* @module-exports */
GameModules.publish("game3d/js/modules/run-record/run-record.js",{
"RunRecord":{get:function(){return RunRecord;},set:function($value){RunRecord=$value;}}
});
})(GameModules.imports("game3d/js/modules/run-record/run-record.js"));
