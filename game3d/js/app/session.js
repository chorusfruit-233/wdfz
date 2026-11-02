/* 里世界 3D · 会话与场景生命周期（计划「项目解耦与模块化」5.3）
   会话：一局游戏，从新局 / 继续（freshState）开始，到回主菜单（Game.quit）结束。
   场景：一次进入某个房间或室外（doEnterRoom / doExitRoom）。
   · Session.timeout(fn, ms, scope)：scope 为 'session'（默认）或 'scene'。会话结束、或（scene 作用域）换场景时自动取消；
     到点时再核对一次代号，过期的不执行——上一局的淡入淡出、字幕、演出回调不会改到下一局。
   · Session.guard(fn, scope)：给已经交出去的异步回调包一层，过期就不执行（不取消外层的计时器，适合「后半段收尾必须做」的场合，
     例如淡入淡出：回调过期也要把黑幕撤掉）。
   · 钩子：sessionStart(id, reason) / sessionEnd(id, reason) / sceneChange(sceneId, to)。
   旧系统的定时器还没有全部迁过来（见计划第 10 节），新模块一律用这里登记。 */
'use strict';

var Session=(function(){
  var id=0, scene=0, live=false, timers=[];
  function cancel(scope){
    timers=timers.filter(function(t){
      if(scope==='session'||t.scope===scope){ clearTimeout(t.h); return false; }
      return true;
    });
  }
  function begin(reason){
    cancel('session'); id++; scene++; live=true;
    GameModules.emit('sessionStart',id,reason||'');
    return id;
  }
  function end(reason){
    if(!live) return;
    cancel('session'); live=false;
    GameModules.emit('sessionEnd',id,reason||'');
    id++;                                           /* 结束后旧回调一律过期，不必等下一局开始 */
  }
  function sceneChange(to){
    cancel('scene'); scene++;
    GameModules.emit('sceneChange',scene,to===undefined?null:to);
  }
  function stale(mark,scope){ return mark.session!==id||(scope==='scene'&&mark.scene!==scene); }
  function timeout(fn,ms,scope){
    scope=scope==='scene'?'scene':'session';
    var mark={session:id,scene:scene}, t={scope:scope};
    t.h=setTimeout(function(){
      timers=timers.filter(function(x){ return x!==t; });
      if(stale(mark,scope)) return;
      try{ fn(); }catch(e){ try{ console.error('[Session] '+scope+' 回调出错：',e); }catch(_e){} }
    },Math.max(0,ms||0));
    timers.push(t);
    return t;
  }
  function clear(t){ if(!t) return; clearTimeout(t.h); timers=timers.filter(function(x){ return x!==t; }); }
  function guard(fn,scope){
    scope=scope==='scene'?'scene':'session';
    var mark={session:id,scene:scene};
    return function(){ if(stale(mark,scope)) return undefined; return fn.apply(this,arguments); };
  }
  return {
    begin:begin, end:end, sceneChange:sceneChange, timeout:timeout, clear:clear, guard:guard, cancel:cancel,
    id:function(){ return id; }, scene:function(){ return scene; }, live:function(){ return live; },
    pending:function(scope){ return timers.filter(function(t){ return !scope||t.scope===scope; }).length; }
  };
})();
