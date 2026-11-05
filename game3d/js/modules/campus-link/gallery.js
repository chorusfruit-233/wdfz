/* @module-capsule */
(function($imports){
/* 里世界 3D · 连续校园：教学楼二到五层的敞开外廊（计划《校园直通》第 3.3 节、第 15.0a 节 C3）
   · 教学楼外壳已经按室内重建（content/structure-recipe.js 的 TEACH_SOUTH、model/building.js 的 bldTeach），室内与室外只差一个平移（OBJ.ic）。
   · 二到五层走廊南墙（最后一排）不再画成实墙：楼板、矮栏板和红栏杆由室外模型画；碰撞仍按格子（人走到栏杆边就停）。
     楼梯口、电梯两旁那几段墙留着（外面是楼梯塔、电梯井）。
   · 进到这几层时，把室外模型的那一份缓存（Engine 的 sharedOutdoor）按平移和楼层高度挂进场景：站在走廊上看得见真实的校园、
     楼下的人和楼前的楼梯塔；离开时摘下来，不销毁。雾按室外的浓度，背景是天空。 */
'use strict';
var TEACH_GALLERY={rise:3.2,floors:[2,3,4,5],open:[[1,3],[10,18],[22,52]],fog:0.022};
var TeachGallery=(function(){
  var own={owner:'campus-link'}, held=null;
  function floorOf(id){ var R=$imports.INTERIORS[id]; return R&&R.host==='teach'&&TEACH_GALLERY.floors.indexOf(R.floor)>=0?R.floor:0; }
  function openAt(x){ return TEACH_GALLERY.open.some(function(r){ return x>=r[0]&&x<=r[1]; }); }
  function install(){
    TEACH_GALLERY.floors.forEach(function(f){
      var R=$imports.INTERIORS['teach'+f]; if(!R) return;
      R.openWall=function(x,y){ return y===R.rows-1&&openAt(x); };
      R.gallery=true;
    });
  }
  /* 室内坐标 → 室外世界坐标的平移（世界单位）：楼体外壳中心 − 室内中心 */
  function shift(R){
    var o=(0,$imports.objById)(R.host); if(!o||!o.ic) return {x:0,y:0};
    return {x:(o.x+o.w/2-o.ic[0])*$imports.SC, y:(o.y+o.h/2-o.ic[1])*$imports.SC};
  }
  function detach(){ if(held&&held.parent) held.parent.remove(held); held=null; }
  function attach(id){
    detach();
    var f=id?floorOf(id):0; if(!f||!$imports.GLR.scene) return;
    var R=$imports.INTERIORS[id], out=$imports.ThreeBackend.sharedOutdoor&&$imports.ThreeBackend.sharedOutdoor(); if(!out) return;
    var d=shift(R);
    out.position.set(-(d.x+R.cx)*$imports.U2M,-(f-1)*TEACH_GALLERY.rise,-(d.y+R.cy)*$imports.U2M);
    $imports.GLR.scene.add(out); held=out;
    $imports.GLR.scene.fog=new $imports.THREE.FogExp2($imports.FOG_COL,TEACH_GALLERY.fog);
    try{ $imports.GLR.skyHour=-1; (0,$imports.refreshSky)(); }catch(e){}
  }
  GameModules.on('openAir',function(id){ return floorOf(id)?true:undefined; },own);
  GameModules.on('interiors',install,own);
  GameModules.on('sceneBuilt',attach,own);
  GameModules.on('clearWorld',function(){ if(held){ held.position.set(0,0,0); detach(); } },own);
  return {CFG:TEACH_GALLERY, shift:shift, floorOf:floorOf, held:function(){ return held; }};
})();
/* @module-exports */
GameModules.publish("game3d/js/modules/campus-link/gallery.js",{
"TEACH_GALLERY":{get:function(){return TEACH_GALLERY;},set:function($value){TEACH_GALLERY=$value;}},
"TeachGallery":{get:function(){return TeachGallery;},set:function($value){TeachGallery=$value;}}
});
})(GameModules.imports("game3d/js/modules/campus-link/gallery.js"));
