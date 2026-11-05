/* @module-capsule */
(function($imports){
/* 里世界 3D · 巡察日志残页（《校园怪谈创意提案》C3）
   行政楼三楼办公室和保安岗里能捡到撕下来的值班表。内容从巡察者真实的固定路线（PATROL_ROUTE）里截一段：
   按顺序经过的楼层（楼梯间、连廊不写），最后两行是「若有事，另行处置。」和备注「高二（二）班 ×××，未离校。」
   每局从路线里各截一段（按本局种子定，读档一样）；路线本身不随机，被锁定追逐、持续追踪、无线破解暴露位置时它会离开路线。
   只给一段，不给全图；不写时刻（它是连续步行，不按钟点走）。拿到的残页记进手册的线索。 */
'use strict';

var PatrolNotes=(function(){
  var own={owner:'campus-tales'};
  var SPOTS=[{id:'admin',room:'admin3',c:30,r:3,where:'行政楼三楼办公室的抽屉'},{id:'guard',room:'guard1',c:4,r:2,where:'保安岗的值班台'}];
  function name(id){ if(id==='out') return '室外'; var R=$imports.INTERIORS[id]; return R?R.name.replace(/ · .*$/,''):id; }
  /* 路线上按顺序经过的楼层（去掉楼梯间、连廊、相邻重复） */
  function rooms(){
    var seq=[]; ($imports.PATROL_ROUTE.nodes||[]).forEach(function(n){ var r=String(n).split(':')[0]; if(/^stair_|^link/.test(r)) return; if(seq[seq.length-1]!==r) seq.push(r); });
    return seq;
  }
  function seed(){ return typeof $imports.Mechanics!=='undefined'?$imports.Mechanics.runSeed:''; }
  function segment(i){
    var seq=rooms(), len=6, n=seq.length; if(!n) return [];
    var start=Math.floor((0,$imports.lhashStr)('patrol-note:'+i+':'+seed())*n), out=[];
    for(var k=0;k<len;k++) out.push(seq[(start+k)%n]);
    return out;
  }
  function text(i){ return '值班表（撕下的一页）\n'+segment(i).map(name).join(' → ')+'\n若有事，另行处置。\n备注：高二（二）班 ×××，未离校。'; }
  function near(sp){ var R=$imports.INTERIORS[sp.room]; return !!R&&$imports.S.mode==='in'&&$imports.S.room===sp.room&&Math.hypot($imports.S.x-(R.ox+(sp.c+0.5)*R.tw),$imports.S.y-(R.oy+(sp.r+0.5)*R.th))<1.3*R.tw; }
  function got(){ if(!$imports.RT.patrolNotes||typeof $imports.RT.patrolNotes!=='object') $imports.RT.patrolNotes={}; return $imports.RT.patrolNotes; }
  GameModules.on('hint',function(){
    for(var i=0;i<SPOTS.length;i++) if(near(SPOTS[i])) return ($imports.RT.patrolNotes||{})[SPOTS[i].id]?'再看一眼值班表':'撕下来的一页纸';
    return undefined;
  },own);
  GameModules.on('interact',function(){
    for(var i=0;i<SPOTS.length;i++){
      var sp=SPOTS[i]; if(!near(sp)) continue;
      var first=!got()[sp.id]; got()[sp.id]=1;
      (0,$imports.os)(text(i),7,$imports.OS_FORCE);
      if(first){ try{ $imports.Investigation.record('patrolNote'+i,text(i).replace(/\n/g,'　'),'线索',sp.where); }catch(e){} (0,$imports.gameFact)('patrolNote',{i:i}); (0,$imports.autoSave)(); }
      return true;
    }
    return undefined;
  },own);
  return {rooms:rooms, segment:segment, text:text, SPOTS:SPOTS};
})();

/* @module-exports */
GameModules.publish("game3d/js/modules/campus-tales/notes.js",{
"PatrolNotes":{get:function(){return PatrolNotes;},set:function($value){PatrolNotes=$value;}}
});
})(GameModules.imports("game3d/js/modules/campus-tales/notes.js"));
