/* 有序模拟步骤。不依赖浏览器、游戏单例或渲染；STOP 只结束本步，finish 恰好执行一次。 */
'use strict';
var StepPipeline=(function(){
  var STOP=Object.freeze({stop:true});
  function create(options){
    var steps=[],sealed=false;options=options||{};
    return Object.freeze({
      use:function(name,run){
        if(sealed)throw new Error('Pipeline already started');
        if(!name||typeof run!=='function'||steps.some(function(s){return s.name===name;}))throw new Error('Invalid pipeline step: '+name);
        steps.push({name:name,run:run});return this;
      },
      names:function(){return steps.map(function(s){return s.name;});},
      run:function(dt){
        sealed=true;
        if(options.begin)options.begin(dt);
        try{for(var i=0;i<steps.length;i++)if(steps[i].run(dt)===STOP)return STOP;}
        finally{if(options.finish)options.finish(dt);}
      }
    });
  }
  return Object.freeze({create:create,STOP:STOP});
})();
if(typeof module!=='undefined'&&module.exports)module.exports=StepPipeline;
