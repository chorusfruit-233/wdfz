/* 协议使用的校园场景 ID；由浏览器地图与房间服务共同校验。 */
(function(root,factory){
  'use strict';
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.SharedZones=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function floors(prefix,count){
    var ids=[];for(var i=1;i<=count;i++)ids.push(prefix+i);return ids;
  }
  var ids=['out'].concat(floors('teach',6),floors('admin',5),floors('lab',5),floors('dorm',6),
    ['canteen1','garage1','trash1','link1','link2','bell1','guard1','gear1']);
  Object.freeze(ids);
  return Object.freeze({ids:ids,has:function(id){return typeof id==='string'&&ids.indexOf(id)>=0;}});
});
