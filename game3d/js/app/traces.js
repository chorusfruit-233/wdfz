/* @module-capsule */
(function($imports){
/* 异象痕迹的存档命令；渲染缺席也可完成记录。 */
'use strict';
function traceAdd(id){
  if(!id) return;
  var d=$imports.AN.data||{}, t=null, room=($imports.S.mode==='in')?$imports.S.room:null;
  if(id==='rain'||id==='raindots') t={k:'puddle',x:$imports.S.x,y:$imports.S.y};
  else if(id==='leak'&&d.pts) t={k:'stain',pts:d.pts.slice(0,5)};
  else if(id==='rite'&&d.c) t={k:'chalkring',x:d.c.x,y:d.c.y};
  else if(id==='moth'&&d.src) t={k:'moths',x:d.src.x,y:d.src.y};
  else if(id==='exercise'&&d.src) t={k:'rows',x:d.src.x,y:d.src.y};
  else if(id==='twin'&&d.x!==undefined) t={k:'feet',x:d.x,y:d.y,a:Math.atan2($imports.S.y-d.y,$imports.S.x-d.x)};
  else if(id==='roster'&&d.rx!==undefined) t={k:'paper',x:d.rx,y:d.ry};
  else if(id==='hand') t={k:'handprint',x:$imports.S.x,y:$imports.S.y};
  else if(id==='necker') t={k:'fence',x:$imports.BOUND.x1*$imports.SC-6,y:$imports.S.y};
  else if(id==='feast') t={k:'bowl',x:$imports.S.x,y:$imports.S.y};
  else if(id==='chalk') t={k:'dust',x:$imports.S.x,y:$imports.S.y};
  else if(id==='cup'&&d.phase===2) t={k:'cup',x:d.lx,y:d.ly};
  if(!t) return;
  t.room=(id==='cup')?null:room;          /* 水杯只砸在室外：落地后才进楼，杯子也留在外面 */
  $imports.RT.traces=$imports.RT.traces||[];
  $imports.RT.traces.push(t);
  while($imports.RT.traces.length>40) $imports.RT.traces.shift();
  GameModules.emit('tracesChanged');
}

/* @module-exports */
GameModules.publish("game3d/js/app/traces.js",{
"traceAdd":{get:function(){return traceAdd;},set:function($value){traceAdd=$value;}}
});
})(GameModules.imports("game3d/js/app/traces.js"));
