/* 存档数据协议：无 DOM、渲染、存储或当前游戏状态依赖。 */
'use strict';
var SaveData=(function(){
  function record(v){return !!v&&typeof v==='object'&&!Array.isArray(v);}
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function number(v,lo,hi,fallback){return Number.isFinite(v)?Math.max(lo,Math.min(hi,v)):fallback;}
  function object(v){return record(v)?v:{};}
  function prepare(value,options){
    options=options||{};
    if(!record(value))throw new Error('存档根节点必须是对象');
    if(value.v!==undefined&&value.v!==1)throw new Error('不支持的存档版本');
    if(value.clockVersion!==undefined&&value.clockVersion!==1&&value.clockVersion!==2)throw new Error('不支持的时钟版本');
    if(!Number.isFinite(value.x)||!Number.isFinite(value.y)||!Number.isFinite(value.tsec)||value.tsec<0||value.tsec>1500)throw new Error('存档位置或时间无效');
    if(value.day!==undefined&&(!Number.isInteger(value.day)||value.day<1))throw new Error('存档日期无效');
    if(value.mode!==undefined&&value.mode!=='in'&&value.mode!=='out')throw new Error('存档场景类型无效');
    if(value.mode==='in'&&(typeof value.room!=='string'||!value.room))throw new Error('存档缺少房间');
    if(value.mode==='in'&&options.rooms&&!Object.prototype.hasOwnProperty.call(options.rooms,value.room))throw new Error('存档房间不存在');
    var d=clone(value),oldTime=d.tsec,oldClockVersion=d.clockVersion;
    d.v=1;d.day=d.day||1;d.mode=d.mode||'out';d.room=d.mode==='in'?d.room:null;
    d.ang=number(d.ang,-1e9,1e9,0);d.pitch=number(d.pitch,-Math.PI,Math.PI,0);
    d.diff=d.diff==='hard'?'hard':'easy';
    d.san=number(d.san,0,100,100);d.viol=number(d.viol,0,100,0);d.stam=number(d.stam,0,100,100);
    d.bag=Array.isArray(d.bag)?d.bag.filter(function(id){return typeof id==='string'&&(!options.items||Object.prototype.hasOwnProperty.call(options.items,id));}):[];
    d.hot=[0,1].map(function(i){var id=Array.isArray(d.hot)?d.hot[i]:null;return typeof id==='string'&&d.bag.indexOf(id)>=0?id:null;});
    ['actCool','spots','clues','rt','use','openDoors','anCool','anData'].forEach(function(k){d[k]=object(d[k]);});
    if(d.fn!==undefined&&!record(d.fn))delete d.fn;
    if(d.patrol!==undefined&&!record(d.patrol))delete d.patrol;
    if(d.roam!==undefined&&!record(d.roam))delete d.roam;
    if(oldClockVersion!==2){
      if(d.tsec<60)d.tsec+=1440;
      var lightsOut=Number.isFinite(options.lightsOut)?options.lightsOut:1340;
      var now=(d.day-1-(d.tsec>=lightsOut+10&&d.day>1?1:0))*1440+d.tsec;
      var oldClock=d.day*1440+oldTime;
      Object.keys(d.actCool).forEach(function(k){if(Number.isFinite(d.actCool[k]))d.actCool[k]=now+Math.max(0,d.actCool[k]-oldClock);});
      Object.keys(d.anCool).forEach(function(k){if(Number.isFinite(d.anCool[k]))d.anCool[k]=now-((d.tsec-d.anCool[k]+1440)%1440);});
    }
    d.clockVersion=2;
    return d;
  }
  return {prepare:prepare,parse:function(raw,options){return prepare(JSON.parse(raw),options);},
    encode:function(data,options){return JSON.stringify(prepare(data,options));},clone:clone,record:record};
})();
