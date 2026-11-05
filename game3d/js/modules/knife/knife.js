/* @module-capsule */
(function($imports){
/* 里世界 3D · 小刀与隐藏假结局《管制刀具》（内部彩蛋；计划《校园直通、翻越受伤与国际交流》第 16 节、Q10 真人确认；不进玩家 Wiki）
   · 小刀（small_knife）：体育器材室东墙边的旧工具抽屉里，一局一把。
   · 被巡察者真正抓住（patrol-world 的 grip，经钩子 patrolCatch）时，如果背包里有小刀、手上没拿着、这局还没触发过：
     不立刻死，开一个 1.000 有效运行秒的窗口——身体被按住（ownsPlayerInput），背包能打开、世界照走（keepSimulation）。
     必须在窗口里「从背包里」把小刀拿到手上，再「从背包里」用一次：拿出在前、使用在后，都在 1 秒以内。
     快捷栏不算（USE_SOURCE==='hot'）；抓之前就拿在手上的，这一次直接按原样抓死；只拿出不用、超时，按原样抓死（只调一次 kill）。
   · 成功：小刀没收，触发隐藏假结局《管制刀具》（fake），结局卡上「……再睁开眼」：次日早读在自己座位醒来，其余东西都在。
   · 平时：从背包用一次是拿到手上，再用一次是比划一下、收回去；不能攻击任何东西。 */
'use strict';

var KNIFE_CFG={room:'gear1',cell:{c:6,r:1},window:1.0};
var Knife=(function(){
  var own={owner:'knife'}, C=KNIFE_CFG;
  function st(){ var s=$imports.RT.knife; if(!s||typeof s!=='object') s=$imports.RT.knife={took:0,held:0,done:0,cap:null}; return s; }
  function peek(){ return $imports.RT.knife||{}; }
  function near(){ var R=$imports.INTERIORS[C.room]; return !!R&&$imports.S.mode==='in'&&$imports.S.room===C.room&&!peek().took&&Math.hypot($imports.S.x-(R.ox+(C.cell.c+0.5)*R.tw),$imports.S.y-(R.oy+(C.cell.r+0.5)*R.th))<1.5*R.tw; }
  GameModules.on('hint',function(){ return near()?'旧工具抽屉':undefined; },own);
  GameModules.on('interact',function(){
    if(!near()) return undefined;
    if(!(0,$imports.addItem)('small_knife')){ (0,$imports.os)('我：抽屉里有一把折叠小刀。背包满了。',2.6); return true; }
    st().took=1; (0,$imports.os)('我：抽屉里压着一把折叠小刀，刃口有点钝。',3); return true;
  },own);
  /* ---------- 被抓住的那一秒 ---------- */
  GameModules.on('patrolCatch',function(info){
    var s=st();
    if(s.cap) return true;                                          /* 已经在窗口里：巡察那边别再抓一次 */
    if(s.done||!(0,$imports.hasItem)('small_knife')||s.held) return undefined;   /* 抓之前就拿在手上：这一次照原样 */
    s.cap={t:0,msg:info&&info.msg||'一只手按住了你的头顶。它在点名。',equip:null,seq:0};
    (0,$imports.gameFact)('knife',{what:'caught'});
    try{ $imports.SoundCaptions.publish('threat.heartPat',{caption:'一只手按住了你的头顶'}); }catch(e){}
    return true;
  },own);
  GameModules.on('ownsPlayerInput',function(){ return peek().cap?true:undefined; },own);
  GameModules.on('keepSimulation',function(){ return peek().cap?true:undefined; },own);
  GameModules.on('tick',function(dt){
    var s=st(); if(!s.cap||!(dt>0)||$imports.S.dead) return;
    s.cap.t+=dt;
    if(s.cap.t>C.window+1e-9){ var msg=s.cap.msg; s.cap=null; try{ $imports.UI.closePanelAll(); }catch(e){} (0,$imports.kill)(msg,'grip','patrol'); }
  },own);
  function succeed(){
    var s=st(); s.cap=null; s.done=1; s.held=0;
    try{ (0,$imports.removeItem)('small_knife'); }catch(e){}
    try{ $imports.UI.closePanelAll(); }catch(e){}
    (0,$imports.gameFact)('knife',{what:'used'});
    try{ $imports.Speedrun.proof('knife'); }catch(e){}
    (0,$imports.triggerEnding)('knife');
  }
  GameModules.on('itemUse',function(id){
    if(id!=='small_knife') return undefined;
    var s=st(), bag=$imports.USE_SOURCE!=='hot', cap=s.cap;
    if(cap){
      if(!s.held){ s.held=1; if(bag&&cap.equip===null) cap.equip=cap.t; return true; }
      if(bag&&cap.equip!==null&&cap.t<=C.window+1e-9){ succeed(); return true; }
      return true;
    }
    if(!s.held){ s.held=1; (0,$imports.os)('我：我把小刀拿在手上。',2); return true; }
    s.held=0; (0,$imports.os)('我：我比划了一下，又把它收了回去。',2.2); return true;
  },own);
  /* 假结局卡上的「……再睁开眼」：不走垃圾桶那条（fakeWake 会封掉垃圾桶路线），自己醒 */
  GameModules.on('endingCard',function(d){
    if(!d||d.id!=='knife') return;
    var b=d.el&&d.el.querySelector('.ewake'); if(!b) return;
    b.removeAttribute('onclick'); b.onclick=function(){ wake(); };
  },own);
  function wake(){
    var es=document.getElementById('ends'); if(es) es.remove();
    $imports.RT.end=null;
    $imports.S.screen='play'; $imports.S.dead=false; $imports.S.day=Math.max(2,$imports.S.day+1); $imports.S.tsec=441;
    $imports.VisualState.worldNorm=0;
    try{ (0,$imports.patReset)(); }catch(e){}
    var R1=$imports.INTERIORS.teach1;
    (0,$imports.doEnterRoom)('teach1',Object.assign($imports.ClassroomLayout.anchor(R1,$imports.ClassroomLayout.ownSeat),{seated:true}));
    $imports.S.seated=true;
    if($imports.running){ $imports.lastT=performance.now(); $imports.accum=0; }
    (0,$imports.os)('我：……我在座位上醒过来。早读。课本底下压着一张登记单，姓名那一栏后面写着：留校。',6,$imports.OS_FORCE);
    try{ (0,$imports.autoSave)(); }catch(e){}
  }
  GameModules.on('newGame',function(){ $imports.RT.knife=null; },own);
  if(typeof $imports.ITEMS!=='undefined'&&!$imports.ITEMS.small_knife) $imports.ITEMS.small_knife={n:'小刀',d:'折叠的，刃口有点钝。'};
  if(typeof $imports.ENDINGS!=='undefined'&&!$imports.ENDINGS.knife)
    $imports.ENDINGS.knife={t:'《管制刀具》',fake:1,l:['压在头顶的手停住了。','「管制刀具。」它把小刀收进一个透明袋子，递给你一张登记单。','登记单上早就填好了你的名字，后面写着：留校。','东西被收走了。你还在这里。']};
  return {CFG:C, state:st, near:near, wake:wake};
})();

/* @module-exports */
GameModules.publish("game3d/js/modules/knife/knife.js",{
"KNIFE_CFG":{get:function(){return KNIFE_CFG;},set:function($value){KNIFE_CFG=$value;}},
"Knife":{get:function(){return Knife;},set:function($value){Knife=$value;}}
});
})(GameModules.imports("game3d/js/modules/knife/knife.js"));
