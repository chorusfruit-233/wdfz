/* 教学楼教室的布局（格子坐标，一格 1 米；黑板在西墙）。建模、碰撞、坐下、读档、同学和开场 CG 都从这里取位置。
   每间 7 × 14 格。纵向按起始列 c0，离黑板由近到远：c0 老师站的地方，c0+1 讲台和前门，c0+2…c0+5 四排课桌（行距 1 米），
   c0+6 后排过道、后门和后墙的柜子。横向四组同桌（行 2/3、5/6、8/9、11/12，两张桌子拼在一起），组间过道是 4、7、10 行，
   北边靠窗留第 1 行，南边靠走廊留 13、14 两行。黑板、讲台、中间过道都对着第 7 行。一间 32 个座位，本人座位在第二排、中间过道边上。 */
'use strict';
var ClassroomLayout=(function(){
  var spans=[[5,11],[13,19],[21,27],[29,35],[37,43],[45,51]];
  var DESK_ROWS=[2,3,5,6,8,9,11,12], DESK_COLS=[2,3,4,5], BOARD_ROW=7;
  /* 偏移（格 = 米）：课桌比格子中心往黑板挪 0.1，椅子往后 0.3；同桌两张各往中间挪 0.11，拼成一张双人桌；老师站在离黑板 0.62 米处 */
  var OFF=Object.freeze({desk:-0.10,chair:0.30,pair:0.11,teacher:0.62});
  var own=Object.freeze({room:'teach1',classId:5,seatId:'teach1:48:6',col:48,row:6,facing:Math.PI});
  function classAt(c,r){if(r<1||r>=15)return -1;return spans.findIndex(function(a){return c>=a[0]&&c<=a[1];});}
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
  function doors(i){return [[spans[i][0]+1,15],[spans[i][1]-1,15]];}
  function podium(i){return [spans[i][0]+1,BOARD_ROW];}
  /* 老师站在讲台和黑板之间、面朝全班（格子坐标） */
  function teacherSpot(i){return {x:spans[i][0]+OFF.teacher,y:BOARD_ROW+.5};}
  return Object.freeze({version:3,spans:spans,ownSeat:own,deskRows:DESK_ROWS,deskCols:DESK_COLS,boardRow:BOARD_ROW,offsets:OFF,
    classAt:classAt,isDesk:isDesk,pairShift:pairShift,deskAt:deskAt,chairAt:chairAt,seatTiles:seatTiles,
    seat:seat,anchor:anchor,valid:valid,atOwn:atOwn,doors:doors,podium:podium,teacherSpot:teacherSpot});
})();
if(typeof module!=='undefined'&&module.exports)module.exports=ClassroomLayout;
