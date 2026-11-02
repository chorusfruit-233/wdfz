/* 浏览器存储适配：后端在操作时取得，测试可注入内存存储；失败不删除原值。 */
'use strict';
var StorageAdapter={
  create:function(provider,report){
    function run(operation,key,value){
      try{
        var backend=provider();
        var result=operation==='read'?backend.getItem(key):operation==='write'?backend.setItem(key,value):backend.removeItem(key);
        return {ok:true,value:result};
      }catch(error){
        if(report)report({operation:operation,key:key,error:error});
        return {ok:false,value:null,error:error};
      }
    }
    return {read:function(key){return run('read',key);},write:function(key,value){return run('write',key,value).ok;},
      remove:function(key){return run('remove',key).ok;}};
  }
};
