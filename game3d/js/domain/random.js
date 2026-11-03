/* 独立随机流：纯规则可注入来源；画面/声音绝不推进玩法随机序列。 */
'use strict';
var RandomRules=(function(){
  function create(seed){
    var value=seed>>>0;
    return {next:function(){value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;},
      snapshot:function(){return value;},restore:function(seed){value=seed>>>0;}};
  }
  return Object.freeze({create:create});
})();
var GameRandom=(function(){
  var source=RandomRules.create(1).next;
  return Object.freeze({bind:function(next){if(typeof next!=='function')throw new TypeError('random source');source=next;},
    next:function(){return source();}});
})();
var PresentationRandom=(function(){
  var stream=RandomRules.create(0x91e10da5);
  function next(){return stream.next();}
  function range(a,b){return a+next()*(b-a);}
  return Object.freeze({next:next,range:range,integer:function(a,b){return Math.floor(range(a,b+1));},
    pick:function(values){return values[Math.floor(next()*values.length)];},seed:function(value){stream.restore(value);}});
})();
if(typeof module!=='undefined'&&module.exports)module.exports={RandomRules:RandomRules,GameRandom:GameRandom,PresentationRandom:PresentationRandom};
