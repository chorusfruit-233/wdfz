/* 背包纯命令：只修改传入状态，提示、音效和手持物刷新留给适配器。 */
'use strict';
var InventoryRules={
  capacity:8,
  has:function(state,id){return state.bag.indexOf(id)>=0;},
  add:function(state,id,known){
    if(!id||id==='nothing'||known===false)return 'invalid';
    if(this.has(state,id))return 'duplicate';
    if(state.bag.length>=this.capacity)return 'full';
    state.bag.push(id);return 'added';
  },
  remove:function(state,id){
    var i=state.bag.indexOf(id);if(i<0)return false;
    state.bag.splice(i,1);
    for(var k=0;k<2;k++)if(state.hot[k]===id)state.hot[k]=null;
    if(state.bagSel>=state.bag.length)state.bagSel=Math.max(0,state.bag.length-1);
    return true;
  },
  select:function(state,index){
    if(!Number.isInteger(index)||index<0||index>=this.capacity)return false;
    state.bagSel=index;return true;
  },
  setHot:function(state,index,id){
    if((index!==0&&index!==1)||(id!==null&&!this.has(state,id)))return false;
    state.hot[index]=id;return true;
  },
  clear:function(state){state.bag=[];state.hot=[null,null];state.bagSel=0;}
};
if(typeof module!=='undefined'&&module.exports)module.exports=InventoryRules;
