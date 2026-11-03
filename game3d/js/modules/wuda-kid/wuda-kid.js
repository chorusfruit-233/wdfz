/* @module-capsule */
(function($imports){
/* 里世界 3D · 隐藏彩蛋天赋「武大子弟」（模块 wuda-kid）——内部内容，不进玩家 Wiki
   效果：开局自带一支手电筒（放进背包和快捷栏 1）。
   隐藏：不在天赋选择、随机池和暂停里的天赋说明中出现；不占 S.talent，和本局抽到 / 选的天赋同时生效（叠加）。
   怎么得到：每次新开局有 3% 的几率；另外主菜单连点三下校名「武汉大学附属中学」可以把它打开（再连点三下关上），
   打开以后每次新开局都有（记在本机存储 wdfz_wuda）。只在新开局时生效（newGame 钩子）：读档按存档里记的，
   速通局不给（成绩要公平）。
   本局是否生效随存档保存在 d.mods['wuda-kid']。 */
'use strict';

var WUDA_KID_CFG={key:'wdfz_wuda', chance:0.03, clicks:3, windowMs:1600, item:'torch', tellAfter:6,
  line:'我：书包侧袋里有一支手电。……小时候在珞珈山上跑，天一黑就得带着它。',
  onText:'……你想起来了：你家就住在珞珈山下。', offText:'……还是当个普通的转学生吧。'};

var WudaKid=(function(){
  var C=WUDA_KID_CFG, st={on:false,told:false,t:0,via:null}, taps=[];
  var store=$imports.StorageAdapter.create(function(){ return localStorage; });
  function armed(){ var r=store.read(C.key); return !!(r.ok&&r.value==='1'); }
  function setArmed(v){ if(v) store.write(C.key,'1'); else store.remove(C.key); }
  /* 静默放进背包：开场演出里不弹「拿到了」 */
  function grant(){
    if($imports.InventoryRules.add($imports.S,C.item,true)!=='added') return false;
    if($imports.S.hot[0]===null) $imports.InventoryRules.setHot($imports.S,0,C.item);
    try{ (0,$imports.bagChanged)(); }catch(e){}
    return true;
  }
  function tap(el,now){
    now=now===undefined?Date.now():now;
    taps=taps.filter(function(t){ return now-t<C.windowMs; }); taps.push(now);
    if(taps.length<C.clicks) return null;
    taps=[];
    var on=!armed(); setArmed(on);
    if(el){ el.classList.toggle('wuda-on',on); el.classList.remove('wuda-flash'); void el.offsetWidth; el.classList.add('wuda-flash'); }   /* 闪一下（CSS 动画，不开定时器） */
    try{ $imports.SFX.resume(); $imports.SFX.blink(); }catch(e){}
    try{ (0,$imports.toast)(on?C.onText:C.offText); }catch(e){}
    return on;
  }
  var api={
    active:function(){ return st.on; }, armed:armed, tap:tap, grant:grant, state:st,
    roll:function(){ return $imports.GameRandom.next(); },                 /* 单独一处取随机数：测试可以替换 */
    /* 菜单打开过：必定有；否则按 3% 几率 */
    pick:function(){ return armed()?'menu':(api.roll()<C.chance?'chance':null); },
    newGame:function(o){
      if(o&&o.mode==='speedrun') return false;
      var via=api.pick(); if(!via) return false;
      st.on=true; st.via=via; st.told=false; st.t=0; grant(); return true;
    },
    tick:function(dt){
      if(!st.on||st.told||!(dt>0)) return;
      st.t+=dt; if(st.t<C.tellAfter) return;
      st.told=true; try{ (0,$imports.os)(C.line,4.2); }catch(e){}
    },
    reset:function(){ st.on=false; st.told=false; st.t=0; st.via=null; },
    load:function(d){ st.on=!!(d&&d.on); st.told=!!(d&&d.told); st.via=st.on?(d.via==='menu'?'menu':'chance'):null; st.t=st.told?C.tellAfter:0; }
  };
  return api;
})();
(function(){
  var own={owner:'wuda-kid'};
  GameModules.persistent('wuda-kid',{
    save:function(){ return WudaKid.state.on?{on:true,told:WudaKid.state.told,via:WudaKid.state.via}:undefined; },
    load:WudaKid.load, reset:WudaKid.reset});
  GameModules.on('newGame',WudaKid.newGame,own);
  GameModules.on('tick',WudaKid.tick,own);
  GameModules.on('boot',function(){
    var el=document.querySelector('#menu .mschool'); if(!el) return;
    var css=document.createElement('style');
    css.textContent='#menu .mschool{transition:color .5s}#menu .mschool.wuda-on{color:#cdbb86}'+
      '@keyframes wudaFlash{0%{color:#f1dfa4;text-shadow:0 0 10px rgba(241,223,164,.55)}100%{text-shadow:none}}'+
      '#menu .mschool.wuda-flash{animation:wudaFlash 1.4s ease-out}';
    document.head.appendChild(css);
    el.classList.toggle('wuda-on',WudaKid.armed());
    el.addEventListener('click',function(){ WudaKid.tap(el); });
  },own);
})();

/* @module-exports */
GameModules.publish("game3d/js/modules/wuda-kid/wuda-kid.js",{
"WUDA_KID_CFG":{get:function(){return WUDA_KID_CFG;},set:function($value){WUDA_KID_CFG=$value;}},
"WudaKid":{get:function(){return WudaKid;},set:function($value){WudaKid=$value;}}
});
})(GameModules.imports("game3d/js/modules/wuda-kid/wuda-kid.js"));
