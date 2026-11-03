/* 教室占座与堵门的空间规则。网格/坐标输入，普通数据输出，无模型依赖。 */
'use strict';
var ClassmateRules=(function(){
  function eligible(room){return !!(room&&room.host==='teach'&&room.floor>=1&&room.floor<=5);}
  function layout(room,seed){
    var seats=[],occupied={},h=2166136261,source=String(seed)+'|'+room.id;
    for(var i=0;i<source.length;i++){h^=source.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}
    function next(){h=(Math.imul(h,1664525)+1013904223)>>>0;return h/4294967296;}
    if(eligible(room))for(var r=1;r<room.rows-1&&seats.length<34;r++)for(var c=1;c<room.cols-1&&seats.length<34;c++){
      if(room.grid[r][c]!=='d'||(room.id==='teach1'&&Math.abs(c-48)<=1&&Math.abs(r-6)<=1)||next()<.42)continue;
      seats.push({c:c,r:r});occupied[c+','+r]=1;
    }
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
