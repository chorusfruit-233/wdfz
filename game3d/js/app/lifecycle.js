/* 可独立运行的资源作用域。定时器与回调只属于创建它们的那次会话。 */
'use strict';
var LifecycleCore=(function(){
  var serial=0;
  function scope(name,clock,onError){
    var active=true,resources=[],id=++serial;
    function report(error){if(onError)onError(name,error);else throw error;}
    function own(dispose){
      if(!active){dispose();return function(){};}
      resources.push(dispose);
      return function(){var i=resources.indexOf(dispose);if(i>=0)resources.splice(i,1);};
    }
    function guard(fn){return function(){if(active)return fn.apply(this,arguments);};}
    function timeout(fn,ms){
      if(!active)return null;
      var forget,handle=clock.setTimeout(function(){forget();if(active)fn();},ms);
      forget=own(function(){clock.clearTimeout(handle);});return handle;
    }
    return {id:id,name:name,active:function(){return active;},own:own,guard:guard,timeout:timeout,
      size:function(){return resources.length;},
      cancel:function(){
        if(!active)return;active=false;
        var list=resources,failures=[];resources=[];
        for(var i=list.length-1;i>=0;i--){try{list[i]();}catch(e){failures.push(e);}}
        failures.forEach(report);
      }};
  }
  return {scope:scope};
})();

/* 浏览器接线只有这一处；纯作用域测试可注入受控时钟。 */
var Lifecycle=(function(){
  var scopes={},errors=[],hooks=[];
  var clock={setTimeout:function(fn,ms){return setTimeout(fn,ms);},clearTimeout:function(id){clearTimeout(id);}};
  function report(module,error){
    errors.push({module:module,message:String(error&&error.message||error),session:scopes.session?scopes.session.id:0});
    if(errors.length>30)errors.shift();
    if(typeof console!=='undefined'&&console.error)console.error('[Lifecycle '+module+']',error);
  }
  function renew(name){
    if(scopes[name])scopes[name].cancel();
    return scopes[name]=LifecycleCore.scope(name,clock,report);
  }
  function get(name){return scopes[name]||(scopes[name]=LifecycleCore.scope(name,clock,report));}
  function boundary(reason){
    Object.keys(scopes).forEach(function(name){scopes[name].cancel();});
    scopes={};renew('session');renew('scene');
    hooks.forEach(function(hook){try{hook.clear(reason);}catch(e){report(hook.name,e);}});
  }
  return {scope:get,renew:renew,boundary:boundary,report:report,
    register:function(name,clear){if(hooks.some(function(h){return h.name===name;}))throw new Error('Duplicate lifecycle owner: '+name);hooks.push({name:name,clear:clear});},
    snapshot:function(){return {session:get('session').id,owners:hooks.map(function(h){return h.name;}),scopes:Object.keys(scopes).map(function(name){return {name:name,id:scopes[name].id,active:scopes[name].active(),resources:scopes[name].size()};}),errors:errors.slice()};}};
})();
