/* @module-capsule */
(function($imports){
/* Walking portals change coordinate frames only at an actual threshold. Height belongs to the shaft surface. */
'use strict';
var StairWorld=(function(){
  var crossing=false;
  function config(id){return $imports.STAIR_LAYOUT.find(function(s){return s.id===id;});}
  function here(){return $imports.S.mode==='in'&&!!config($imports.S.room);}
  function local(R,x,y,h){return {x:(x-R.cx)*$imports.U2M,z:(y-R.cy)*$imports.U2M,h:h||0};}
  function point(id,p){var R=$imports.INTERIORS[id];return {scene:id,x:R.cx+p.x/$imports.U2M,y:R.cy+p.z/$imports.U2M,fy:p.h};}
  function port(s,level){
    var id=s.rooms[level],R=$imports.INTERIORS[id],n=s.n,c=s.col,r=s.row;
    if(id==='out'){var obj=(0,$imports.objById)('garw');if(!obj)return null;var d=(0,$imports.doorWorld)(obj);return {scene:'out',x:d.x,y:d.y,n:[0,-1],level:level,shaft:s.id};}
    if(id==='teach6'){c=s.roof[0];r=s.roof[1];}
    return {scene:id,x:R.ox+(c+(n[0]? .5:1))*R.tw,y:R.oy+(r+(n[0]?1:.5))*R.th,n:n,level:level,shaft:s.id};
  }
  function insidePort(s,level,depth){var p=port(s,level);return {scene:p.scene,x:p.x-p.n[0]*(depth===undefined?9:depth),y:p.y-p.n[1]*(depth===undefined?9:depth),fy:0};}
  function toShaft(p,x,y){var dx=(x-p.x)*$imports.U2M,dy=(y-p.y)*$imports.U2M;return {x:dx*p.n[1]-dy*p.n[0],z:dx*p.n[0]+dy*p.n[1]-2.8};}
  function fromShaft(p,x,z){return {x:p.x+(x*p.n[1]+(z+2.8)*p.n[0])/$imports.U2M,y:p.y+(-x*p.n[0]+(z+2.8)*p.n[1])/$imports.U2M};}
  function turn(n){return Math.atan2(n[1],n[0])-Math.PI/2;}
  function surfaces(id){var s=config(id);return s?$imports.StairGeometry.surfaces(s.rooms.length,s.rise):[];}
  function depth(id,x,y,r,h){var R=$imports.INTERIORS[id],p=local(R,x,y,h);return $imports.StairGeometry.depth(R.stairSurfaces,p.x,p.z,r*$imports.U2M,p.h)/$imports.U2M;}
  function portalAt(id,x,y,radius){
    var result=null;$imports.STAIR_LAYOUT.forEach(function(s){var level=s.rooms.indexOf(id);if(level<0)return;var p=port(s,level);if(!p)return;var q=toShaft(p,x,y);
      if(Math.abs(q.x)<.85+(radius||0)*$imports.U2M&&q.z>-3.65&&q.z< -2.3)result={s:s,level:level,p:p,q:q};});return result;
  }
  function doorwayFree(R,x,y,r){var p=portalAt(R.id,x,y);return !!(p&&Math.abs(p.q.x)+(r||0)*$imports.U2M<.85);}
  function moved(){
    if(crossing||$imports.S.dead||$imports.S.seated)return;
    if(here()){
      var R=$imports.INTERIORS[$imports.S.room],s=config($imports.S.room),q=local(R,$imports.S.x,$imports.S.y,$imports.S.floorY),hit=$imports.StairGeometry.surface(R.stairSurfaces,q.x,q.z,q.h,.4);
      if(hit)$imports.S.floorY=hit.h;
      var level=Math.round(($imports.S.floorY||0)/s.rise);
      if(q.z< -2.85&&Math.abs(($imports.S.floorY||0)-level*s.rise)<.08&&level>=0&&level<s.rooms.length)exit(s,level,q);
    }else{
      var a=portalAt($imports.S.mode==='in'?$imports.S.room:'out',$imports.S.x,$imports.S.y);
      if(a&&a.q.z> -2.79)enter(a.s,a.level,a.q);
    }
  }
  function enter(s,level,q){
    crossing=true;
    var p=port(s,level),pos=point(s.id,{x:q.x,z:q.z,h:level*s.rise}),ang=$imports.S.ang-turn(p.n);
    (0,$imports.doEnterRoom)(s.id,{x:pos.x,y:pos.y,ang:ang,stairHeight:pos.fy,seamless:true});
    $imports.S.floorY=pos.fy;(0,$imports.syncCamera)(0);crossing=false;
  }
  function exit(s,level,q){
    crossing=true;var p=port(s,level),w=fromShaft(p,q.x,q.z),ang=$imports.S.ang+turn(p.n);
    if(p.scene==='out'){(0,$imports.doExitRoom)();$imports.S.x=w.x;$imports.S.y=w.y;$imports.S.ang=ang;$imports.S.floorY=0;$imports.S.enterCool=0;(0,$imports.syncCamera)(0);(0,$imports.autoSave)();}
    else (0,$imports.doEnterRoom)(p.scene,{x:w.x,y:w.y,ang:ang,seamless:true});
    crossing=false;
  }
  function navPath(a,b){var s=config(a.scene),R=$imports.INTERIORS[a.scene];if(!s||a.scene!==b.scene)return null;
    return $imports.StairGeometry.path(local(R,a.x,a.y,a.fy),local(R,b.x,b.y,b.fy),s.rooms.length,s.rise).map(function(p){return point(s.id,p);});}
  function navSnap(id,p){var R=$imports.INTERIORS[id],q=local(R,p.x,p.y,p.fy),hit=$imports.StairGeometry.surface(R.stairSurfaces,q.x,q.z,q.h,.6);return hit?point(id,{x:q.x,z:q.z,h:hit.h}):null;}
  function build(){
    $imports.STAIR_LAYOUT.forEach(function(s){
      s.rooms.forEach(function(id,level){
        var R=$imports.INTERIORS[id];if(!R)return;
        // Remove only this plan's decorative stair cells, preserve unrelated rooms.
        for(var r=0;r<R.rows;r++)for(var c=0;c<R.cols;c++)if(R.grid[r][c]==='S')R.grid[r][c]='.';
      });
    });
    $imports.STAIR_LAYOUT.forEach(function(s){
      s.rooms.forEach(function(id,level){var R=$imports.INTERIORS[id];if(!R)return;var c=id==='teach6'?s.roof[0]:s.col,r=id==='teach6'?s.roof[1]:s.row;
        R.grid[r][c]='S';if(s.n[0])R.grid[r+1][c]='S';else R.grid[r][c+1]='S';
        // Keep a clear approach from the corridor; roof stairs move their opening to the south edge.
        if(id==='teach6'){R.grid[r+1][c]='S';R.grid[r+1][c+1]='S';}
      });
      var g=(0,$imports.blank)(8,18,'.'),R=(0,$imports.mkFloor)(s.id,((0,$imports.objById)(s.host)||{n:'地下车库'}).n+' · 楼梯间',s.host,1,g);
      R.ownHeight=true;R.stairwell=true;R.stairSurfaces=$imports.StairGeometry.surfaces(s.rooms.length,s.rise);
      R.build=function(room){return $imports.StairView.build(room);};
      R.solid=function(x,y){return depth(R.id,x,y,0,$imports.S.floorY)>0;};R.collide=function(x,y,r){return depth(R.id,x,y,r,$imports.S.floorY);};
      R.onEnter=function(spawn){$imports.S.floorY=spawn&&Number.isFinite(spawn.stairHeight)?(0,$imports.clamp)(spawn.stairHeight,0,(s.rooms.length-1)*s.rise):0;};
    });
  }
  function restore(d){
    if(!here())return;
    var R=$imports.INTERIORS[$imports.S.room],s=config($imports.S.room),v=d&&d.stairwell;
    var h=v&&v.id===s.id&&Number.isFinite(v.height)?v.height:0;
    var hit=$imports.StairGeometry.surface(R.stairSurfaces,($imports.S.x-R.cx)*$imports.U2M,($imports.S.y-R.cy)*$imports.U2M,h,.4);
    if(hit)$imports.S.floorY=hit.h;else{var p=point(s.id,{x:0,z:-1.8,h:0});$imports.S.x=p.x;$imports.S.y=p.y;$imports.S.floorY=0;(0,$imports.saveReport)('stairs','无效梯段位置，已放回入口平台');}
  }
  GameModules.on('interiors',build,{owner:'stairwell'});
  GameModules.on('stepSurface',function(){if(here())return 'stair';},{owner:'stairwell'});
  GameModules.on('hint',function(){if(here())return '';},{owner:'stairwell'});
  GameModules.on('interact',function(){return here()?true:undefined;},{owner:'stairwell'});
  return {config:config,here:here,surfaces:surfaces,local:local,point:point,port:port,insidePort:insidePort,toShaft:toShaft,fromShaft:fromShaft,turn:turn,
    doorwayFree:doorwayFree,portalAt:portalAt,moved:moved,depth:depth,navPath:navPath,navSnap:navSnap,restore:restore,
    height:function(){if(here())return $imports.S.floorY;var s=$imports.STAIR_LAYOUT.find(function(s){return s.rooms.includes($imports.S.room);});return s?s.rooms.indexOf($imports.S.room)*s.rise:0;}};
})();

/* @module-exports */
GameModules.publish("game3d/js/modules/stairwell/stairwell.js",{
"StairWorld":{get:function(){return StairWorld;},set:function($value){StairWorld=$value;}}
});
})(GameModules.imports("game3d/js/modules/stairwell/stairwell.js"));
