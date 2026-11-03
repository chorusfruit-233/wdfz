/* @module-capsule */
(function($imports){
/* 开局倒计时的应用控制器。 */
'use strict';
function updateIntro(dt){
  if(!($imports.S.intro>0)) return;
  $imports.S.intro-=dt;
  var b=document.getElementById('banner');
  if(!b) return;
  if($imports.S.intro>0){
    b.textContent=String(Math.ceil($imports.S.intro));
    b.style.opacity='1';
    b.style.fontSize='64px';
  }else{
    b.textContent='';
    b.style.opacity='0';
    b.style.fontSize='';
  }
}
/* @module-exports */
GameModules.publish("game3d/js/app/intro.js",{
"updateIntro":{get:function(){return updateIntro;},set:function($value){updateIntro=$value;}}
});
})(GameModules.imports("game3d/js/app/intro.js"));
