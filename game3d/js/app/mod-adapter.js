/* @module-capsule */
(function($imports){
/* Mod 稳定 API 的应用适配。通用加载器不知道 S、物品表、房间或渲染。 */
'use strict';
GameModules.bindModServices({
  say:function(text,seconds){return (0,$imports.os)(text,seconds);},
  toast:function(text){return (0,$imports.toast)(text);},
  state:function(){return $imports.S;},
  addItem:function(id,def){
    if(!id||!def)return false;
    $imports.ITEMS[id]={n:String(def.name||id),d:String(def.desc||'')};
    if(def.glyph)$imports.ITEM_GLYPH[id]=String(def.glyph);
    if(def.color)$imports.ITEM_COL[id]=String(def.color);
    if(typeof def.use==='function')$imports.ITEM_USE[id]=def.use;return true;
  },
  giveItem:function(id){return (0,$imports.addItem)(id);},
  addRoom:function(modId,id,def){
    if(!def||!def.grid)return null;
    var room=(0,$imports.mkFloor)(id,def.name||id,def.host||('mod_'+modId),def.floor||1,def.grid);
    ['build','collide','solid','moved','onEnter','noMap','noClock'].forEach(function(k){if(def[k]!==undefined)room[k]=def[k];});
    (0,$imports.buildRoomBounds)();return room;
  },
  enterRoom:function(id,spawn){if($imports.INTERIORS[id])return (0,$imports.enterRoom)(id,spawn);}
});

/* @module-exports */
GameModules.publish("game3d/js/app/mod-adapter.js",{

});
})(GameModules.imports("game3d/js/app/mod-adapter.js"));
