/* 教学楼教室的布局（格子坐标，一格 1 米；黑板在西墙）。建模、碰撞、坐下、读档、同学和开场 CG 都从这里取位置。
   版本 4（2026-11-04）：每层四间，每间沿走廊 11 格、进深 8 格——从走廊的门进去，左右宽、往里浅，和真实教室一样黑板挂在短墙上。
   教室占第 7–14 行（北墙是第 6 行，开窗；走廊那面墙是第 15 行，开前后门）；第 1–5 行和两头不用，楼层网格里填实。
   纵向按起始列 c0，离黑板由近到远：c0 老师站的地方，c0+1 讲台和前门，c0+2…c0+8 七排课桌（行距 1 米），c0+9 后排过道和后门，
   c0+10 后墙边（黑板报、空调、卫生角）。横向三组同桌（行 7/8、10/11、13/14，两张桌子拼在一起），组间过道是 9、12 行。
   黑板、讲台、老师都对着教室中线 mid（第 11.0 行处）。一间 42 个座位，本人座位在第二排、中间那组靠南的一张。 */
'use strict';
var ClassroomLayout=(function(){
  var spans=[[9,19],[21,31],[33,43],[45,55]];
  var ROW0=7, ROW1=14;                                       /* 教室占的行（含两头） */
  var DESK_ROWS=[7,8,10,11,13,14], DESK_COLS=[2,3,4,5,6,7,8], BOARD_ROW=10, MID=11.0;
  /* 偏移（格 = 米）：课桌比格子中心往黑板挪 0.1，椅子往后 0.3；同桌两张各往中间挪 0.11，拼成一张双人桌；
     老师站在离黑板 0.62 米处，讲台中心离黑板 1.5 米，两者都在中线上 */
  var OFF=Object.freeze({desk:-0.10,chair:0.30,pair:0.11,teacher:0.62,podium:1.5});
  var own=Object.freeze({room:'teach1',classId:3,seatId:'teach1:48:11',col:48,row:11,facing:Math.PI});
  /* 以前版本的本人座位（布局 1–3 是 teach1 第六间的 (48, 6)）：读旧档时认得出「坐在自己位子上」 */
  var LEGACY_OWN=Object.freeze(['teach1:48:6']);
  function classAt(c,r){if(r<ROW0||r>ROW1)return -1;return spans.findIndex(function(a){return c>=a[0]&&c<=a[1];});}
  function teachRoom(id){return /^teach[1-5]$/.test(id||'');}
  function isDesk(c,r){var i=classAt(c,r);return i>=0&&DESK_COLS.indexOf(c-spans[i][0])>=0&&DESK_ROWS.indexOf(r)>=0;}
  /* 同桌：靠北的那张往南挪，靠南的往北挪 */
  function pairShift(r){var k=DESK_ROWS.indexOf(r);return k<0?0:(k%2===0?OFF.pair:-OFF.pair);}
  function deskAt(c,r){return {x:c+.5+OFF.desk,y:r+.5+pairShift(r)};}
  function chairAt(c,r){return {x:c+.5+OFF.chair,y:r+.5+pairShift(r)};}
  function seatTiles(i){
    var c0=spans[i][0],out=[];
    DESK_COLS.forEach(function(dc){DESK_ROWS.forEach(function(r){out.push([c0+dc,r]);});});
    return out;
  }
  function seat(room,c,r){return {room:room,seatId:room+':'+c+':'+r,col:c,row:r,facing:teachRoom(room)?Math.PI:-Math.PI/2};}
  /* 坐下时人在椅子上（教学楼教室）；别的房间的座位（音乐教室的琴凳等）照旧在格子中心 */
  function anchor(R,s){
    var p=teachRoom(R.id)&&isDesk(s.col,s.row)?chairAt(s.col,s.row):{x:s.col+.5,y:s.row+.5};
    return {x:R.ox+p.x*R.tw,y:R.oy+p.y*R.th,ang:s.facing};
  }
  function valid(s,R){return !!(s&&R&&s.room===R.id&&Number.isInteger(s.col)&&Number.isInteger(s.row)&&R.grid[s.row]&&R.grid[s.row][s.col]==='P'&&s.seatId===R.id+':'+s.col+':'+s.row);}
  function atOwn(state,R){if(!state.seated||!valid(state.seat,R)||state.seat.seatId!==own.seatId)return false;var p=anchor(R,own);return Math.hypot(state.x-p.x,state.y-p.y)<=1.5;}
  /* 前门在讲台那一列，后门在后排过道那一列，都开在走廊那面墙（第 15 行）上 */
  function doors(i){return [[spans[i][0]+1,ROW1+1],[spans[i][1]-1,ROW1+1]];}
  /* 讲台占的格子（交互、地图符号 T）；模型画在 podiumAt：中线上、离黑板 1.5 米，伸进南边那一格 */
  function podium(i){return [spans[i][0]+1,BOARD_ROW];}
  function podiumAt(i){return {x:spans[i][0]+OFF.podium,y:MID};}
  /* 老师站在讲台和黑板之间、面朝全班（格子坐标） */
  function teacherSpot(i){return {x:spans[i][0]+OFF.teacher,y:MID};}
  return Object.freeze({version:4,spans:spans,rows:Object.freeze([ROW0,ROW1]),ownSeat:own,legacyOwnSeats:LEGACY_OWN,
    deskRows:DESK_ROWS,deskCols:DESK_COLS,boardRow:BOARD_ROW,mid:MID,offsets:OFF,
    classAt:classAt,isDesk:isDesk,pairShift:pairShift,deskAt:deskAt,chairAt:chairAt,seatTiles:seatTiles,
    seat:seat,anchor:anchor,valid:valid,atOwn:atOwn,doors:doors,podium:podium,podiumAt:podiumAt,teacherSpot:teacherSpot});
})();
if(typeof module!=='undefined'&&module.exports)module.exports=ClassroomLayout;
