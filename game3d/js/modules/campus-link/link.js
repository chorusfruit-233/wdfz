/* @module-capsule */
(function($imports){
/* 里世界 3D · 连续校园：连廊（计划《校园直通、翻越受伤与国际交流》第 3 节、Q7；实施方案见第 15.0a 节 C1）
   做法和梯井一样：端口是一条门槛线，两侧场景用刚性变换对齐。
   · 楼层端墙、连廊两端各开 3 格（3 米）宽的门洞；门洞外 1.5 格是可以走的「附加区」（房间的 annexAt），侧向只到门洞宽减身体半径。
   · 身体中心越过门槛线就无缝换到另一侧的场景：位置、朝向原样换算（刚性变换），不黑屏、不出横幅、不自动转向；
     这一小步剩下的位移由 moveBy 按转过的角度接着走，所以走、跑、倒退都不会顿一下。
   · 端口表 CAMPUS_LINK 是唯一的来源：碰撞、换场景、预览（link-view.js）、巡察导航都读它。
   · 连廊入口的吊牌和门垫（'L' 格）保留当指示，不再能按 E「走连廊」。拿掉本模块就回到原来按 E 换场景。 */
'use strict';

var CAMPUS_LINK={version:1,width:3,annex:1.5,pairs:[
  [{room:'admin2',edge:'e',at:18},{room:'link1',edge:'n',at:2}],
  [{room:'lab2',edge:'e',at:17},{room:'link1',edge:'s',at:2}],
  [{room:'lab2',edge:'w',at:17},{room:'link2',edge:'n',at:2}],
  [{room:'teach2',edge:'w',at:18},{room:'link2',edge:'s',at:2}]
]};
var CampusLink=(function(){
  var own={owner:'campus-link'}, NORMAL={n:[0,-1],s:[0,1],w:[-1,0],e:[1,0]};
  /* 端口：门槛线中点（房间网格的外沿）、朝外的法线、门洞占的格子 */
  function port(p){
    var R=$imports.INTERIORS[p.room]; if(!R) return null;
    var n=NORMAL[p.edge], half=(CAMPUS_LINK.width-1)/2, cells=[], k;
    var x=p.edge==='w'?R.ox:p.edge==='e'?R.ox+R.cols*R.tw:R.ox+(p.at+0.5)*R.tw;
    var y=p.edge==='n'?R.oy:p.edge==='s'?R.oy+R.rows*R.th:R.oy+(p.at+0.5)*R.th;
    for(k=-half;k<=half;k++){
      if(p.edge==='w') cells.push([0,p.at+k]); else if(p.edge==='e') cells.push([R.cols-1,p.at+k]);
      else if(p.edge==='n') cells.push([p.at+k,0]); else cells.push([p.at+k,R.rows-1]);
    }
    return {room:p.room,x:x,y:y,n:n,cells:cells,half:CAMPUS_LINK.width*($imports.TTILE)/2};
  }
  function ports(room){
    var out=[];
    CAMPUS_LINK.pairs.forEach(function(pair,i){ [0,1].forEach(function(s){ if(pair[s].room===room) out.push({self:port(pair[s]),peer:port(pair[1-s]),pair:i,side:s}); }); });
    return out;
  }
  /* 刚性变换 {phi, tx, ty}：q' = Rot(phi)·q + t（世界单位） */
  function rot(phi,x,y){ var c=Math.cos(phi), s=Math.sin(phi); return {x:c*x-s*y, y:s*x+c*y}; }
  function apply(T,x,y){ var r=rot(T.phi,x,y); return {x:r.x+T.tx, y:r.y+T.ty}; }
  function compose(A,B){ var t=apply(A,B.tx,B.ty); return {phi:A.phi+B.phi, tx:t.x, ty:t.y}; }   /* 先 B 后 A */
  /* 从 a 这一侧的坐标换到 b 这一侧：a 朝外 = b 朝里 */
  function between(a,b){
    var phi=Math.atan2(-b.n[1],-b.n[0])-Math.atan2(a.n[1],a.n[0]), r=rot(phi,a.x,a.y);
    return {phi:phi, tx:b.x-r.x, ty:b.y-r.y};
  }
  function local(P,x,y){ var dx=x-P.x, dy=y-P.y; return {along:dx*P.n[0]+dy*P.n[1], lat:-dx*P.n[1]+dy*P.n[0]}; }
  /* 门洞外的附加区：门槛线内 1 格到外 1.5 格，侧向留出身体半径 */
  function inAnnex(room,x,y){
    var list=ports(room), i, q, P;
    for(i=0;i<list.length;i++){
      P=list[i].self; if(!P) continue; q=local(P,x,y);
      if(q.along>-$imports.TTILE&&q.along<=CAMPUS_LINK.annex*$imports.TTILE&&Math.abs(q.lat)<=P.half-$imports.PRAD) return true;
    }
    return false;
  }
  function installRoom(R){
    if(!R||R.__campusLink) return;
    var list=ports(R.id); if(!list.length) return;
    list.forEach(function(v){ v.self.cells.forEach(function(cr){ if(R.grid[cr[1]]&&R.grid[cr[1]][cr[0]]==='#') R.grid[cr[1]][cr[0]]='.'; }); });
    var prev=R.annexAt;
    R.annexAt=function(x,y){ return inAnnex(R.id,x,y)||(prev?prev.call(this,x,y):false); };
    R.__campusLink=true;
  }
  function install(){ CAMPUS_LINK.pairs.forEach(function(pair){ pair.forEach(function(p){ installRoom($imports.INTERIORS[p.room]); }); }); }
  /* 每一小步之后：身体中心越过门槛线就换场景 */
  var crossing=false;
  function cross(){
    if(crossing||$imports.S.mode!=='in'||$imports.S.dead||$imports.S.seated||$imports.HIDE.on) return false;
    var list=ports($imports.S.room), i, q, v;
    for(i=0;i<list.length;i++){
      v=list[i]; if(!v.self||!v.peer) continue; q=local(v.self,$imports.S.x,$imports.S.y);
      if(q.along>0&&Math.abs(q.lat)<v.self.half){
        var T=between(v.self,v.peer), p=apply(T,$imports.S.x,$imports.S.y);
        crossing=true;
        try{
          (0,$imports.doEnterRoom)(v.peer.room,{x:p.x,y:p.y,ang:$imports.S.ang+T.phi,seamless:true});
          (0,$imports.syncCamera)(0);
          (0,$imports.gameFact)('campusLink',{from:v.self.room,to:v.peer.room});
        }finally{ crossing=false; }
        return true;
      }
    }
    return false;
  }
  /* 预览要用：把 room 这一侧看到的每个相邻场景（以及连廊另一头）换算到 room 的坐标里 */
  function views(room){
    var out=[], seen={};
    seen[room]=1;
    ports(room).forEach(function(v){
      if(!v.peer) return;
      var T=between(v.peer,v.self);                 /* 对面 → 这边 */
      if(!seen[v.peer.room]){ seen[v.peer.room]=1; out.push({room:v.peer.room,T:T,hop:1}); }
      ports(v.peer.room).forEach(function(w){
        if(!w.peer||seen[w.peer.room]) return;
        seen[w.peer.room]=1;
        out.push({room:w.peer.room,T:compose(T,between(w.peer,w.self)),hop:2});
      });
    });
    return out;
  }
  /* 巡察导航：楼层 a 与连廊 b 之间那个端口，门槛线两侧各往里 0.5 单位的两个点（同一处，跨过去不计时间） */
  function navPair(a,b){
    var pair=CAMPUS_LINK.pairs.filter(function(p){ return p[0].room===a&&p[1].room===b||p[1].room===a&&p[0].room===b; })[0];
    if(!pair) return null;
    var pa=port(pair[0].room===a?pair[0]:pair[1]), pb=port(pair[0].room===a?pair[1]:pair[0]), d=0.5;
    return [{scene:a,x:pa.x-pa.n[0]*d,y:pa.y-pa.n[1]*d},{scene:b,x:pb.x-pb.n[0]*d,y:pb.y-pb.n[1]*d}];
  }
  GameModules.on('interiors',install,own);
  GameModules.on('sceneBuilt',function(id){ if(id) installRoom($imports.INTERIORS[id]); },own);
  GameModules.on('stepMoved',cross,own);
  GameModules.on('linkContinuous',function(){ return true; },own);
  return {CFG:CAMPUS_LINK, port:port, ports:ports, between:between, apply:apply, compose:compose, local:local, inAnnex:inAnnex, views:views, navPair:navPair, cross:cross};
})();
/* @module-exports */
GameModules.publish("game3d/js/modules/campus-link/link.js",{
"CAMPUS_LINK":{get:function(){return CAMPUS_LINK;},set:function($value){CAMPUS_LINK=$value;}},
"CampusLink":{get:function(){return CampusLink;},set:function($value){CampusLink=$value;}}
});
})(GameModules.imports("game3d/js/modules/campus-link/link.js"));
