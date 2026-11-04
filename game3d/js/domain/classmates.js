/* 教室占座与堵门的空间规则。网格/坐标输入，普通数据输出，无模型依赖。 */
'use strict';
var ClassmateRules=(function(){
  function eligible(room){return !!(room&&!room.stairwell&&room.host==='teach'&&room.floor>=1&&room.floor<=5);}
  /* 谁坐在哪：L 是教室布局（ClassroomLayout，由调用方传进来）。自己班坐得满（一间 42 个座位，最多坐 36 个；本人座位和同桌那张空着），
     别的教室稀一些；全层不超过 50 个。同一局（seed）每次进楼都一样 */
  function layout(room,seed,L){
    var seats=[],occupied={},h=2166136261,source=String(seed)+'|'+room.id;
    for(var i=0;i<source.length;i++){h^=source.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}
    function next(){h=(Math.imul(h,1664525)+1013904223)>>>0;return h/4294967296;}
    function add(c,r){seats.push({c:c,r:r});occupied[c+','+r]=1;}
    if(!eligible(room))return {seats:seats,occupied:occupied};
    if(!L||!L.spans){                                     /* 没有布局信息（旧调用）：逐格挑，最多 34 个 */
      for(var r=1;r<room.rows-1&&seats.length<34;r++)for(var c=1;c<room.cols-1&&seats.length<34;c++)
        if(room.grid[r][c]==='d'&&next()>=.42)add(c,r);
      return {seats:seats,occupied:occupied};
    }
    var own=L.ownSeat,home=room.id===own.room?own.classId:-1,skip={},k=L.deskRows.indexOf(own.row);
    if(home>=0&&k>=0)skip[own.col+','+L.deskRows[k%2?k-1:k+1]]=1;   /* 同桌那张空着 */
    var order=[];for(var ci=0;ci<L.spans.length;ci++)order.push(ci);
    if(home>=0)order=[home].concat(order.filter(function(x){return x!==home;}));
    order.forEach(function(ci){
      var tiles=L.seatTiles(ci),inClass=0,cap=ci===home?36:10,p=ci===home?.86:(home>=0?.16:.2);
      tiles.sort(function(a,b){return a[1]-b[1]||a[0]-b[0];});
      tiles.forEach(function(t){
        var roll=next();
        if(seats.length>=50||inClass>=cap||room.grid[t[1]][t[0]]!=='d'||skip[t[0]+','+t[1]]||roll>=p)return;
        add(t[0],t[1]);inClass++;
      });
    });
    return {seats:seats,occupied:occupied};
  }
  function nearestDoor(room,x,y){
    var best=null,distance=Infinity;
    for(var r=1;r<room.rows-1;r++)for(var c=1;c<room.cols-1;c++)if(room.grid[r][c]==='='){
      var d=Math.abs(c*room.tw+room.ox-x)+Math.abs(r*room.th+room.oy-y);
      if(d<distance){distance=d;best={x:room.ox+(c+.5)*room.tw,y:room.oy+(r+.5)*room.th};}
    }
    return best;
  }
  return Object.freeze({eligible:eligible,layout:layout,nearestDoor:nearestDoor});
})();
if(typeof module!=='undefined'&&module.exports)module.exports=ClassmateRules;
