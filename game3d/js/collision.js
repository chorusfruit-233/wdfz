/* @module-capsule */
(function($imports){
/* 与渲染无关的圆形角色碰撞。坐标均为游戏世界单位，四档画质共用。 */
'use strict';
var Physics=Object.freeze({hz:240});
var Collision={
  rectDepth:function(x,y,r,x0,y0,x1,y1){
    var dx=Math.max(x0-x,0,x-x1),dy=Math.max(y0-y,0,y-y1);
    if(dx===0&&dy===0)return r+Math.min(x-x0,x1-x,y-y0,y1-y);
    return Math.max(0,r-Math.hypot(dx,dy));
  },
  depth:function(x,y,r,room){
    var total=0;
    function rect(x0,y0,x1,y1){total+=Collision.rectDepth(x,y,r,x0,y0,x1,y1);}
    if(room||$imports.S.mode==='in'){
      var R=room||$imports.INTERIORS[$imports.S.room];if(!R)return Infinity;
      if(R.stairwell)return $imports.StairWorld.depth(R.id,x,y,r,$imports.S.floorY);
      /* 房间边界外一律算墙；楼层电梯门后那节轿厢（R.annexAt，电梯模块给）例外：门开着时可以走进去 */
      if((x-r<R.ox||y-r<R.oy||x+r>R.ox+R.w||y+r>R.oy+R.h)&&!(R.annexAt&&R.annexAt(x,y)))return Infinity;
      var c0=Math.max(0,Math.floor((x-r-R.ox)/R.tw)),c1=Math.min(R.cols-1,Math.floor((x+r-R.ox)/R.tw));
      var r0=Math.max(0,Math.floor((y-r-R.oy)/R.th)),r1=Math.min(R.rows-1,Math.floor((y+r-R.oy)/R.th));
      for(var rr=r0;rr<=r1;rr++)for(var cc=c0;cc<=c1;cc++){
        var t=R.grid[rr][cc],cx=R.ox+(cc+0.5)*R.tw,cy=R.oy+(rr+0.5)*R.th;
        var f=R.foot?undefined:$imports.FURN_SOLID[t];
        if(((0,$imports.isSolidCh)(t)&&!(t==='S'&&$imports.StairWorld.doorwayFree(R,x,y,r)))||(t==='='&&(($imports.Classmates.blocked(R.id,cx,cy))||!(0,$imports.doorIsOpen)(R,cx,cy))))f=1;
        if(f!==undefined)rect(cx-R.tw*f/2,cy-R.th*f/2,cx+R.tw*f/2,cy+R.th*f/2);
      }
      if(R.foot){
        var pc=Math.floor((x-R.ox)/R.tw),pr=Math.floor((y-R.oy)/R.th);
        for(var dr=-2;dr<=2;dr++)for(var dc=-2;dc<=2;dc++)(R.foot[(pc+dc)+','+(pr+dr)]||[]).forEach(function(b){
          rect(R.cx+b.x0/$imports.U2M,R.cy+b.z0/$imports.U2M,R.cx+b.x1/$imports.U2M,R.cy+b.z1/$imports.U2M);
        });
      }
      [R.stairExtra||[],R.propExtra||[]].forEach(function(boxes){boxes.forEach(function(b){
        rect(R.cx+b.x0/$imports.U2M,R.cy+b.z0/$imports.U2M,R.cx+b.x1/$imports.U2M,R.cy+b.z1/$imports.U2M);
      });});
      /* 旋梯是分层扇形通道，沿用层数判定，并覆盖身体圆周与内外栏杆。 */
      if(R.collide)total+=R.collide(x,y,r);            /* 模块提供的房间碰撞（虚空迷宫：体素与台阶，按身体所在高度） */
      if(R.spiral){
        if((0,$imports.spiralSolid)(R,x,y))total+=r;
        for(var i=0;i<8;i++)if((0,$imports.spiralSolid)(R,x+Math.cos(i*$imports.PI/4)*r,y+Math.sin(i*$imports.PI/4)*r))total+=r/8;
      }
    }else{
      var bx0=($imports.BOUND.x0+4)*$imports.SC,by0=($imports.BOUND.y0+4)*$imports.SC,bx1=($imports.BOUND.x1-4)*$imports.SC,by1=($imports.BOUND.y1-4)*$imports.SC;
      if(x-r<bx0||y-r<by0||x+r>bx1||y+r>by1)return Infinity;
      $imports.OBJ.forEach(function(o){if(o.k==='roof'&&!o.open)rect(o.x*$imports.SC,o.y*$imports.SC,(o.x+o.w)*$imports.SC,(o.y+o.h)*$imports.SC);});
      $imports.OUT_SOLID.forEach(function(b){rect(b.x0*$imports.SC,b.y0*$imports.SC,b.x1*$imports.SC,b.y1*$imports.SC);});
    }
    return total;
  }
};

/* @module-exports */
GameModules.publish("game3d/js/collision.js",{
"Physics":{get:function(){return Physics;},set:function($value){Physics=$value;}},
"Collision":{get:function(){return Collision;},set:function($value){Collision=$value;}}
});
})(GameModules.imports("game3d/js/collision.js"));
