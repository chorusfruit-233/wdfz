/* @module-capsule */
(function($imports){
/* 菜单照片的启动适配；离开菜单后不再捕获。 */
'use strict';
var MENU_PHOTO=null, PHOTO_TRIED=false;

function captureMenuPhoto(){
  if(PHOTO_TRIED) return;
  if(!$imports.Assets.anyReady())return;
  if($imports.S.screen!=='menu'){ PHOTO_TRIED=true; return; }
  PHOTO_TRIED=true;
  try{
    if(!$imports.Engine.ready()) return;
    var cv=document.getElementById('cv'), menu=document.getElementById('menu');
    if(!cv||!menu||!cv.toDataURL) return;
    var saveT=$imports.S.tsec;
    $imports.S.tsec=1338;                                  /* 22:18 —— 菜单那张照片是夜里拍的 */
    (0,$imports.enterWorldOut)();
    var url=$imports.Engine.captureMenu();
    if(url&&url.length>20000){
      MENU_PHOTO=url;
      menu.style.backgroundImage='radial-gradient(ellipse at 72% 42%,rgba(10,18,22,.34),rgba(3,6,9,.92) 62%),url('+url+')';
      menu.style.backgroundSize='cover';
      menu.style.backgroundPosition='center 58%';
      menu.style.backgroundColor='#04070a';
    }
    $imports.S.tsec=saveT;
    (0,$imports.clearWorldMesh)();                             /* 菜单里不留实时场景 */
    $imports.S.mode='in'; $imports.S.room=null;
  }catch(e){}
}
/* @module-exports */
GameModules.publish("game3d/js/ui/menu-photo.js",{
"MENU_PHOTO":{get:function(){return MENU_PHOTO;},set:function($value){MENU_PHOTO=$value;}},
"PHOTO_TRIED":{get:function(){return PHOTO_TRIED;},set:function($value){PHOTO_TRIED=$value;}},
"captureMenuPhoto":{get:function(){return captureMenuPhoto;},set:function($value){captureMenuPhoto=$value;}}
});
})(GameModules.imports("game3d/js/ui/menu-photo.js"));
