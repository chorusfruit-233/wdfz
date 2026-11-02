/* 玩家数值的唯一写入接口。纯算术和状态适配均不依赖 DOM、Three.js 或存储。 */
'use strict';
var StatRules=(function(){
  function clamp(v,lo,hi){return Math.max(lo,Math.min(hi,v));}
  function san(v){return clamp(Number.isFinite(v)?v:100,0,100);}
  function staminaMax(value){return 40+0.6*san(value);}
  return {
    san:san,
    sanityStage:function(value){return value>60?0:value>30?1:value>12?2:3;},
    staminaMax:staminaMax,
    stamina:function(value,sanity){return clamp(Number.isFinite(value)?value:0,0,staminaMax(sanity));},
    bounded:function(value,bounds){
      if(!bounds)return value;
      return Math.max(bounds.min===undefined?-Infinity:bounds.min,Math.min(bounds.max===undefined?Infinity:bounds.max,value));
    },
    violation:function(value,amount,exempt,source){
      if(amount>0&&source!=='inspection'&&exempt)return value;
      return clamp(value+amount,0,100);
    }
  };
})();
var PlayerStats=(function(){
  function create(getState){
    var last={field:null,source:null,value:null};
    function set(field,value,source,bounds){
      var state=getState();
      state[field]=StatRules.bounded(value,bounds);
      last.field=field;last.source=source||'unspecified';last.value=state[field];
      return state[field];
    }
    function change(field,amount,source,bounds){return set(field,getState()[field]+amount,source,bounds);}
    return {
      last:last,
      setSan:function(v,source,bounds){return set('san',v,source,bounds);},
      changeSan:function(v,source,bounds){return change('san',v,source,bounds);},
      setViolation:function(v,source,bounds){return set('viol',v,source,bounds);},
      changeViolation:function(v,source,bounds){return change('viol',v,source,bounds);},
      addViolation:function(v,source,exempt){return set('viol',StatRules.violation(getState().viol,v,exempt,source),source);},
      setAssimilation:function(v,source,bounds){return set('tt',v,source,bounds);},
      changeAssimilation:function(v,source,bounds){return change('tt',v,source,bounds);},
      setStamina:function(v,source,bounds){return set('stam',v,source,bounds);},
      changeStamina:function(v,source,bounds){return change('stam',v,source,bounds);},
      staminaMax:function(){return StatRules.staminaMax(getState().san);},
      capStamina:function(){var s=getState();return set('stam',StatRules.stamina(s.stam,s.san),'stamina-cap');},
      restoreStamina:function(amount){var s=getState();return set('stam',StatRules.stamina(Math.min(StatRules.staminaMax(s.san),s.stam+amount),s.san),'stamina-recovery');},
      settle:function(){set('san',StatRules.san(getState().san),'settle');this.capStamina();return getState().san;}
    };
  }
  var facade={create:create,bind:function(getState){
    var api=create(getState);
    Object.keys(api).forEach(function(key){facade[key]=api[key];});
    return facade;
  }};
  return facade;
})();
if(typeof module!=='undefined'&&module.exports)module.exports={StatRules:StatRules,PlayerStats:PlayerStats};
