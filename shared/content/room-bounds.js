/* 与渲染无关的房间位置与边界；浏览器和房主服务使用同一计算。 */
(function(root,factory){
  'use strict';
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.SharedRoomBounds=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function bounds(room,objects,scale){
    var w=room.cols*room.tw,h=room.rows*room.th,o=null;
    for(var i=0;i<objects.length;i++)if(objects[i].id===room.host){o=objects[i];break;}
    var ox=o?o.x*scale+o.w*scale/2-w/2:0;
    var oy=o?o.y*scale+o.h*scale/2-h/2:0;
    return {w:w,h:h,ox:ox,oy:oy,cx:ox+w/2,cy:oy+h/2};
  }
  return Object.freeze({bounds:bounds});
});
