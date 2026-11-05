/* @module-capsule */
(function($imports){
/* 里世界 3D · 连续校园：楼的出入口（计划《校园直通、翻越受伤与国际交流》第 3 节、第 15.0a 节 C2）
   楼体外壳已经按室内重建，室内与室外只差一个平移（TeachGallery.shift，来自 OBJ.ic），所以门槛两侧不用转角度。
   · 门洞 3 格宽，开在室内外墙那一格（教学楼一楼南墙第 30–32 列，正对正门）；门洞外 1.5 格是室内这一侧的附加区（annexAt），
     室外楼体在门口挖掉同样深的缺口（OBJ.gaps，collision.js 的 roofSolids），两边都能把身体中心走到门槛线另一侧。
   · 身体中心越过门槛线就无缝换场景：室内 → 室外 doExitRoom(seamless)，室外 → 室内 doEnterRoom(seamless)，位置、朝向原样平移。
   · 门里门外互相看得见：在室内离门不远时，把室外模型的缓存（Engine 的 sharedOutdoor）按平移挂进来；在室外离门不远时，
     把这间房的模型挂进室外场景。室内地面比室外地面高 1 厘米，两边的地面不会重叠闪烁。
   · 拿掉本模块：门洞、缺口、预览都没有，回到按 E 出入（门口是关着的玻璃门）。 */
'use strict';
var CAMPUS_DOOR={version:1,width:3,annex:1.5,lift:0.01,near:12,far:15,doors:[
  {room:'teach1',host:'teach',edge:'s',at:31},
  {room:'admin1',host:'admin',edge:'s',at:26},     /* 连续校园 A2：行政楼一楼正门（25–27 列，正中） */
  {room:'lab1',host:'lab',edge:'s',at:25},         /* 实验楼一楼正门（24–26 列；楼宽 50 格，门中线比楼中线偏东 0.5 米） */
  /* 连续校园 A3：小屋室内放大到外壳，门都在南面。宽 2 格的门 at 写成两格中间（5.5 = 第 5、6 列） */
  {room:'guard1',host:'guard',edge:'s',at:5.5,width:2},
  {room:'gear1',host:'gear',edge:'s',at:9},
  {room:'trash1',host:'trash',edge:'s',at:5.5,width:2},
  {room:'bell1',host:'bell',edge:'s',at:5}
]};
var CampusDoor=(function(){
  var own={owner:'campus-link'}, NORMAL={n:[0,-1],s:[0,1],w:[-1,0],e:[1,0]}, inView=null, outView=null;
  function wid(d){ return d.width||CAMPUS_DOOR.width; }
  function half(d){ return wid(d)*$imports.TTILE/2; }
  /* 门槛线（室内坐标，世界单位）：中点、朝外的法线、门洞占的格子 */
  function port(d){
    var R=$imports.INTERIORS[d.room]; if(!R) return null;
    var n=NORMAL[d.edge], k=(wid(d)-1)/2, cells=[], i;
    var x=d.edge==='w'?R.ox:d.edge==='e'?R.ox+R.cols*R.tw:R.ox+(d.at+0.5)*R.tw;
    var y=d.edge==='n'?R.oy:d.edge==='s'?R.oy+R.rows*R.th:R.oy+(d.at+0.5)*R.th;
    for(i=-k;i<=k;i++){
      if(d.edge==='w') cells.push([0,d.at+i]); else if(d.edge==='e') cells.push([R.cols-1,d.at+i]);
      else if(d.edge==='n') cells.push([d.at+i,0]); else cells.push([d.at+i,R.rows-1]);
    }
    return {x:x,y:y,n:n,cells:cells};
  }
  function shift(d){ return $imports.TeachGallery.shift($imports.INTERIORS[d.room]); }
  function local(P,x,y){ var dx=x-P.x, dy=y-P.y; return {along:dx*P.n[0]+dy*P.n[1], lat:-dx*P.n[1]+dy*P.n[0]}; }
  function outPort(d){ var P=port(d), s=shift(d); return P&&{x:P.x+s.x,y:P.y+s.y,n:P.n}; }
  function doorsOf(room){ return CAMPUS_DOOR.doors.filter(function(d){ return d.room===room; }); }
  function byHost(host){ return CAMPUS_DOOR.doors.filter(function(d){ return d.host===host; })[0]||null; }
  /* 室内这一侧：门洞里、门槛线外 1.5 格以内，侧向留出身体半径 */
  function inAnnex(R,x,y){
    return doorsOf(R.id).some(function(d){
      var q=local(port(d),x,y);
      return q.along>-$imports.TTILE&&q.along<=CAMPUS_DOOR.annex*$imports.TTILE&&Math.abs(q.lat)<=half(d)-$imports.PRAD;
    });
  }
  function openAt(R,x,y){
    return doorsOf(R.id).some(function(d){ var q=local(port(d),x,y); return q.along>-$imports.TTILE&&q.along<=0&&Math.abs(q.lat)<half(d); });
  }
  /* 室外楼体在门口挖掉的缺口（世界单位）：门洞宽、往楼里 1.5 格 */
  function gapOf(d){
    var P=outPort(d), h=half(d), deep=CAMPUS_DOOR.annex*$imports.TTILE, n=P.n;
    var ax=P.x-n[0]*deep, ay=P.y-n[1]*deep, ex=n[1]!==0?h:0, ey=n[0]!==0?h:0;
    return {x0:Math.min(ax,P.x)-ex,x1:Math.max(ax,P.x)+ex,y0:Math.min(ay,P.y)-ey,y1:Math.max(ay,P.y)+ey};
  }
  function install(){
    CAMPUS_DOOR.doors.forEach(function(d){
      var R=$imports.INTERIORS[d.room], o=(0,$imports.objById)(d.host); if(!R||!o) return;
      if(!R.__campusDoor){
        port(d).cells.forEach(function(cr){ if(R.grid[cr[1]]) R.grid[cr[1]][cr[0]]='O'; });
        var prev=R.annexAt;
        R.annexAt=function(x,y){ return inAnnex(R,x,y)||(prev?prev.call(this,x,y):false); };
        R.openExitAt=function(x,y){ return openAt(R,x,y); };
        R.__campusDoor=true;
      }
      /* 房间坐标（R.ox）要等 world.js 的 buildRoomBounds 算好，所以缺口用到时才算，算一次 */
      var gaps=null;
      Object.defineProperty(o,'gaps',{configurable:true,enumerable:false,get:function(){ if(!gaps&&Number.isFinite(R.ox)) gaps=[gapOf(d)]; return gaps; }});
      /* 交给楼体模型：门洞宽、门中线离楼中线多远（米，沿立面）、一楼走廊从外墙到走廊北墙有几格（这一段镂空，门里看得见室内模型） */
      var hc=Math.floor(d.at), hollow=1; while(R.grid[R.rows-1-hollow]&&'#='.indexOf(R.grid[R.rows-1-hollow][hc])<0) hollow++;
      o.seamDoor={width:wid(d),dx:((d.at+0.5)-R.cols/2)*R.tw*$imports.U2M,hollow:hollow};
    });
  }
  /* 每一小步之后：身体中心越过门槛线就换场景 */
  var crossing=false;
  function cross(){
    if(crossing||$imports.S.dead||$imports.S.seated||$imports.HIDE.on) return false;
    var list=$imports.S.mode==='in'?doorsOf($imports.S.room):$imports.S.mode==='out'?CAMPUS_DOOR.doors:[], i;
    for(i=0;i<list.length;i++){
      var d=list[i], s=shift(d), inside=$imports.S.mode==='in', P=inside?port(d):outPort(d); if(!P) continue;
      var q=local(P,$imports.S.x,$imports.S.y);
      if(Math.abs(q.lat)>=half(d)) continue;
      if(inside&&q.along>0){
        crossing=true;
        try{ (0,$imports.doExitRoom)({x:$imports.S.x+s.x,y:$imports.S.y+s.y,ang:$imports.S.ang,seamless:true}); (0,$imports.syncCamera)(0); (0,$imports.gameFact)('campusDoor',{from:d.room,to:'out'}); }
        finally{ crossing=false; }
        return true;
      }
      if(!inside&&q.along<0&&q.along>-CAMPUS_DOOR.annex*$imports.TTILE){
        crossing=true;
        try{ (0,$imports.doEnterRoom)(d.room,{x:$imports.S.x-s.x,y:$imports.S.y-s.y,ang:$imports.S.ang,seamless:true}); (0,$imports.syncCamera)(0); (0,$imports.gameFact)('campusDoor',{from:'out',to:d.room}); }
        finally{ crossing=false; }
        return true;
      }
    }
    return false;
  }
  /* ---- 门里门外互相看得见（表现，只读） ---- */
  function near(d,x,y,inside){ var P=inside?port(d):outPort(d); return Math.hypot(x-P.x,y-P.y)*$imports.U2M; }
  function detachAll(){
    if(inView&&inView.lamp&&inView.lamp.parent) inView.lamp.parent.remove(inView.lamp);
    if(inView&&inView.mesh.parent) inView.mesh.parent.remove(inView.mesh);
    if(outView&&outView.mesh.parent) outView.mesh.parent.remove(outView.mesh);
    if(inView){ inView.mesh.position.set(0,0,0); } inView=null; outView=null;
  }
  function frame(){
    if(!$imports.GLR.scene||$imports.S.screen!=='play'||$imports.PRO.on||($imports.Opening&&$imports.Opening.on)) return;   /* 开场演出前后不挂（第一次挂室外模型要现建一份） */
    var inside=$imports.S.mode==='in', list=inside?doorsOf($imports.S.room):$imports.S.mode==='out'?CAMPUS_DOOR.doors:[], d=null, i, best=1e9;
    for(i=0;i<list.length;i++){ var m=near(list[i],$imports.S.x,$imports.S.y,inside); if(m<best){ best=m; d=list[i]; } }
    var cur=inside?inView:outView, lim=cur?CAMPUS_DOOR.far:CAMPUS_DOOR.near;
    if(!d||best>lim||(cur&&cur.room!==d.room)){ if(cur) detachAll(); if(!d||best>CAMPUS_DOOR.near) return; }   /* 走到了另一道门跟前：换成那间 */
    else if(cur) return;
    var R=$imports.INTERIORS[d.room], s=shift(d);
    if(inside){
      if($imports.TeachGallery.held&&$imports.TeachGallery.held()) return;           /* 外廊那几层自己挂着室外模型 */
      var out=$imports.ThreeBackend.sharedOutdoor&&$imports.ThreeBackend.sharedOutdoor(); if(!out||out.parent) return;
      out.position.set(-(s.x+R.cx)*$imports.U2M,-CAMPUS_DOOR.lift,-(s.y+R.cy)*$imports.U2M);
      $imports.GLR.scene.add(out); inView={mesh:out,room:d.room};
      /* 室外模型在屋里只受屋里的灯：门外柱廊下补一盏弱灯，看得清门槛、柱子和路（屋里的雾照旧） */
      var P=port(d), lamp=new $imports.THREE.PointLight(0xc8d4dc,$imports.LCFG.ptI*0.8,16,2);
      lamp.position.set((P.x+P.n[0]*3/$imports.U2M-R.cx)*$imports.U2M,2.6,(P.y+P.n[1]*3/$imports.U2M-R.cy)*$imports.U2M); lamp.name='campus-door-lamp';
      $imports.GLR.scene.add(lamp); inView.lamp=lamp;
    }else{
      var g=$imports.ThreeBackend.sharedRoom&&$imports.ThreeBackend.sharedRoom(d.room); if(!g||g.parent) return;
      g.position.set((R.cx+s.x)*$imports.U2M,CAMPUS_DOOR.lift,(R.cy+s.y)*$imports.U2M);
      $imports.GLR.scene.add(g); outView={mesh:g,room:d.room};
    }
  }
  GameModules.on('interiors',install,own);
  GameModules.on('stepMoved',cross,own);
  GameModules.on('doorContinuous',function(id){ return (byHost(id)||doorsOf(id)[0])?true:undefined; },own);
  GameModules.on('clearWorld',function(){ if(outView) outView.mesh.position.set(0,0,0); detachAll(); },own);
  GameModules.on('frame',frame,own);
  return {CFG:CAMPUS_DOOR, port:port, outPort:outPort, gapOf:gapOf, inAnnex:inAnnex, cross:cross, views:function(){ return {inside:inView&&inView.room,outside:outView&&outView.room}; }};
})();
/* @module-exports */
GameModules.publish("game3d/js/modules/campus-link/doors.js",{
"CAMPUS_DOOR":{get:function(){return CAMPUS_DOOR;},set:function($value){CAMPUS_DOOR=$value;}},
"CampusDoor":{get:function(){return CampusDoor;},set:function($value){CampusDoor=$value;}}
});
})(GameModules.imports("game3d/js/modules/campus-link/doors.js"));
