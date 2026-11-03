/* @module-capsule */
(function($imports){
/* Main buildings are 16 m / five storeys; dormitory first three floors use 3 m facade bands. */
'use strict';
var STAIR_LAYOUT=[
 {id:'stair_teach_w',host:'teach',rooms:['teach1','teach2','teach3','teach4','teach5','teach6'],rise:3.2,col:6,row:21,n:[0,1],roof:[12,16]},
 {id:'stair_teach_e',host:'teach',rooms:['teach1','teach2','teach3','teach4','teach5'],rise:3.2,col:55,row:21,n:[0,1]},
 {id:'stair_admin',host:'admin',rooms:['admin1','admin2','admin3','admin4','admin5'],rise:3.2,col:3,row:21,n:[0,1]},
 {id:'stair_lab',host:'lab',rooms:['lab1','lab2','lab3','lab4','lab5'],rise:3.2,col:3,row:19,n:[0,1]},
 {id:'stair_dormN',host:'dormN',rooms:['dorm1','dorm2','dorm3'],rise:3,col:0,row:7,n:[-1,0]},
 {id:'stair_dormS',host:'dormS',rooms:['dorm4','dorm5','dorm6'],rise:3,col:0,row:7,n:[-1,0]},
 {id:'stair_garage',host:'garw',rooms:['garage1','out'],rise:3.2,col:55,row:0,n:[0,-1]}
];

/* @module-exports */
GameModules.publish("game3d/js/content/stairwell-layout.js",{
"STAIR_LAYOUT":{get:function(){return STAIR_LAYOUT;},set:function($value){STAIR_LAYOUT=$value;}}
});
})(GameModules.imports("game3d/js/content/stairwell-layout.js"));
