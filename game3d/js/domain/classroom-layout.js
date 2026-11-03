/* Classroom anchors in tile coordinates; the west wall is the front. */
'use strict';
var ClassroomLayout=(function(){
  var spans=[[5,11],[13,19],[21,27],[29,35],[37,43],[45,51]];
  var own=Object.freeze({room:'teach1',classId:5,seatId:'teach1:48:6',col:48,row:6,facing:Math.PI});
  function classAt(c,r){if(r<1||r>=15)return -1;return spans.findIndex(function(a){return c>=a[0]&&c<=a[1];});}
  function seat(room,c,r){return {room:room,seatId:room+':'+c+':'+r,col:c,row:r,facing:/^teach[1-5]$/.test(room)?Math.PI:-Math.PI/2};}
  function anchor(R,s){return {x:R.ox+(s.col+.5)*R.tw,y:R.oy+(s.row+.5)*R.th,ang:s.facing};}
  function valid(s,R){return !!(s&&R&&s.room===R.id&&Number.isInteger(s.col)&&Number.isInteger(s.row)&&R.grid[s.row]&&R.grid[s.row][s.col]==='P'&&s.seatId===R.id+':'+s.col+':'+s.row);}
  function atOwn(state,R){if(!state.seated||!valid(state.seat,R)||state.seat.seatId!==own.seatId)return false;var p=anchor(R,own);return Math.hypot(state.x-p.x,state.y-p.y)<=1.5;}
  function doors(i){return [[spans[i][0]+1,15],[spans[i][1]-1,15]];}
  function podium(i){return [spans[i][0],7];}
  return Object.freeze({version:2,spans:spans,ownSeat:own,classAt:classAt,seat:seat,anchor:anchor,valid:valid,atOwn:atOwn,doors:doors,podium:podium});
})();
if(typeof module!=='undefined'&&module.exports)module.exports=ClassroomLayout;
