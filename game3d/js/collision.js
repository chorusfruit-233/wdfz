/* 与渲染无关的圆形角色碰撞。坐标均为游戏世界单位，四档画质共用。 */
'use strict';
var Physics=Object.freeze({hz:240});
var Collision={
  rectDepth:function(x,y,r,x0,y0,x1,y1){
    var dx=Math.max(x0-x,0,x-x1),dy=Math.max(y0-y,0,y-y1);
    if(dx===0&&dy===0)return r+Math.min(x-x0,x1-x,y-y0,y1-y);
    return Math.max(0,r-Math.hypot(dx,dy));
  },
  depth:function(x,y,r){
    var total=0;
    function rect(x0,y0,x1,y1){total+=Collision.rectDepth(x,y,r,x0,y0,x1,y1);}
    if(S.mode==='in'){
      var R=INTERIORS[S.room];if(!R)return Infinity;
      if(x-r<R.ox||y-r<R.oy||x+r>R.ox+R.w||y+r>R.oy+R.h)return Infinity;
      var c0=Math.max(0,Math.floor((x-r-R.ox)/R.tw)),c1=Math.min(R.cols-1,Math.floor((x+r-R.ox)/R.tw));
      var r0=Math.max(0,Math.floor((y-r-R.oy)/R.th)),r1=Math.min(R.rows-1,Math.floor((y+r-R.oy)/R.th));
      for(var rr=r0;rr<=r1;rr++)for(var cc=c0;cc<=c1;cc++){
        var t=R.grid[rr][cc],cx=R.ox+(cc+0.5)*R.tw,cy=R.oy+(rr+0.5)*R.th;
        var f=FURN_SOLID[t];
        if(isSolidCh(t)||(t==='='&&((NC.blocking&&NC.room===R.id)||!doorIsOpen(R,cx,cy))))f=1;
        if(f!==undefined)rect(cx-R.tw*f/2,cy-R.th*f/2,cx+R.tw*f/2,cy+R.th*f/2);
      }
      [R.stairExtra||[],R.propExtra||[]].forEach(function(boxes){boxes.forEach(function(b){
        rect(R.cx+b.x0/U2M,R.cy+b.z0/U2M,R.cx+b.x1/U2M,R.cy+b.z1/U2M);
      });});
      /* 旋梯是分层扇形通道，沿用层数判定，并覆盖身体圆周与内外栏杆。 */
      if(R.spiral){
        if(spiralSolid(R,x,y))total+=r;
        for(var i=0;i<8;i++)if(spiralSolid(R,x+Math.cos(i*PI/4)*r,y+Math.sin(i*PI/4)*r))total+=r/8;
      }
    }else{
      var bx0=(BOUND.x0+4)*SC,by0=(BOUND.y0+4)*SC,bx1=(BOUND.x1-4)*SC,by1=(BOUND.y1-4)*SC;
      if(x-r<bx0||y-r<by0||x+r>bx1||y+r>by1)return Infinity;
      OBJ.forEach(function(o){if(o.k==='roof')rect(o.x*SC,o.y*SC,(o.x+o.w)*SC,(o.y+o.h)*SC);});
      OUT_SOLID.forEach(function(b){rect(b.x0*SC,b.y0*SC,b.x1*SC,b.y1*SC);});
    }
    return total;
  }
};
