/* @module-capsule */
(function($imports){
/* 区域门禁只提供固定区域，不记录玩家坐标。边界采用地图格坐标，右／下界不包含。
   规则、存档校验和地面警戒线共用此表；走廊、学生机房和门洞不在其中。 */
'use strict';
var PATROL_ZONES=(function(){
  var zones=[];
  for(var i=0;i<6;i++)zones.push({id:'admin5:office'+i,scene:'admin5',label:'行政楼五楼办公室',
    c0:2+i*8,c1:9+i*8,r0:1,r1:16,observe:[5+i*8,14]});
  zones.push({id:'lab3:control',scene:'lab3',label:'网络中心 · 终端操作区',
    c0:35,c1:49,r0:10,r1:15,observe:[41,13],marked:true});
  zones.push({id:'lab3:servers',scene:'lab3',label:'网络中心 · 核心机房',
    c0:35,c1:49,r0:1,r1:10,observe:[41,5],marked:true});
  return zones;
})();

/* @module-exports */
GameModules.publish("game3d/js/content/patrol-zones.js",{
"PATROL_ZONES":{get:function(){return PATROL_ZONES;},set:function($value){PATROL_ZONES=$value;}}
});
})(GameModules.imports("game3d/js/content/patrol-zones.js"));
