/* 浏览器和房间服务共用的移动数学；不依赖渲染、DOM 或全局玩家状态。 */
(function(root,factory){
  'use strict';
  var api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.SharedPhysics=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  var HZ=240;
  function rectDepth(x,y,r,x0,y0,x1,y1){
    var dx=Math.max(x0-x,0,x-x1),dy=Math.max(y0-y,0,y-y1);
    if(dx===0&&dy===0)return r+Math.min(x-x0,x1-x,y-y0,y1-y);
    return Math.max(0,r-Math.hypot(dx,dy));
  }
  /* depth(x,y) 返回碰撞深度；每个细分步结束后可更新旋梯等状态。 */
  function moveCircle(position,dx,dy,dt,radius,depth,afterStep){
    if(!Number.isFinite(dx)||!Number.isFinite(dy))return;
    var n=Math.max(1,Math.ceil((dt||1/60)*HZ),Math.ceil(Math.hypot(dx,dy)/(radius*0.5)));
    dx/=n;dy/=n;
    for(var i=0;i<n;i++){
      var before=depth(position.x,position.y),nx=position.x+dx,ny=position.y+dy;
      var ax=depth(nx,position.y);
      if(ax<1e-7||ax<before-1e-7){position.x=nx;before=ax;}
      var ay=depth(position.x,ny);
      if(ay<1e-7||ay<before-1e-7)position.y=ny;
      if(afterStep)afterStep();
    }
  }
  return Object.freeze({hz:HZ,rectDepth:rectDepth,moveCircle:moveCircle});
});
