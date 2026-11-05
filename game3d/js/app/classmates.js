/* @module-capsule */
(function($imports){
/* 同学的逻辑状态归属：占座、堵门与压力均不查询 Three.js 场景。 */
'use strict';
var Classmates={
  state:{room:null,blocking:false,door:null,said:false},cache:{},
  layout:function(room){
    if(!room)return {seats:[],occupied:{}};
    var seed=typeof $imports.Mechanics!=='undefined'?$imports.Mechanics.runSeed:'',key=room.id+':'+seed,cached=Classmates.cache[key];
    if(!cached||cached.grid!==room.grid){cached=$imports.ClassmateRules.layout(room,seed,$imports.ClassroomLayout);cached.grid=room.grid;Classmates.cache[key]=cached;}
    return cached;
  },
  active:function(){return $imports.S.mode==='in'&&$imports.ClassmateRules.eligible($imports.INTERIORS[$imports.S.room]);},
  enter:function(){Classmates.state={room:$imports.S.mode==='in'?$imports.S.room:null,blocking:false,door:null,said:false};Classmates.tick();},
  reset:function(){Classmates.cache={};Classmates.state={room:null,blocking:false,door:null,said:false};},
  setBlocking:function(value){Classmates.state.blocking=!!value;},
  blocked:function(id,x,y){var st=Classmates.state;return st.room===id&&st.blocking&&(x===undefined||!!st.door&&Math.hypot(st.door.x-x,st.door.y-y)<6);},
  tick:function(){
    var st=Classmates.state,room=$imports.S.mode==='in'?$imports.INTERIORS[$imports.S.room]:null;
    if(st.room!==(room&&room.id)){st=Classmates.state={room:room?room.id:null,blocking:false,door:null,said:false};}
    if(!$imports.ClassmateRules.eligible(room)){st.blocking=false;st.door=null;return;}
    var v=$imports.S.viol||0;
    if(v>=92&&!st.door)st.door=$imports.ClassmateRules.nearestDoor(room,$imports.S.x,$imports.S.y);
    if(v<80)st.door=null;
    st.blocking=v>=92&&!!st.door;
    if(v>=70&&!$imports.S.dead&&!st.said){st.said=true;(0,$imports.os)('我：他们都在看着我。可是没有人说话。',4.2);}
  }
};
function ncOccupied(c,r){return !!Classmates.layout($imports.S.mode==='in'?$imports.INTERIORS[$imports.S.room]:null).occupied[c+','+r];}
function ncPressureState(){return Classmates.active();}

/* @module-exports */
GameModules.publish("game3d/js/app/classmates.js",{
"Classmates":{get:function(){return Classmates;},set:function($value){Classmates=$value;}},
"ncOccupied":{get:function(){return ncOccupied;},set:function($value){ncOccupied=$value;}},
"ncPressureState":{get:function(){return ncPressureState;},set:function($value){ncPressureState=$value;}}
});
})(GameModules.imports("game3d/js/app/classmates.js"));
