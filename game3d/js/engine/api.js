/* @module-capsule */
(function($imports){
/* 游戏层的渲染入口。数值反馈不持有 Three.js 对象；模型与特效留在表现层。 */
'use strict';
var VisualState={time:0,hurt:0,flash:0,patrolFlick:0,patrolRed:0,worldNorm:0,gazeShake:0,deathAnim:null,camera:{walkPhase:0,eyeH:1.65,fov:72},stage:null,stageHour:null};
var QUALITY_LOAD_GENERATION=0;
var Engine={
  boot:function(){
    var result=$imports.ThreeBackend.boot();
    /* 兼容原有表现模块及调试工具；游戏层只写 VisualState。 */
    Object.keys(VisualState).forEach(function(k){
      Object.defineProperty($imports.GLR,k,{configurable:true,enumerable:true,get:function(){return VisualState[k];},set:function(v){VisualState[k]=v;}});
    });
    return result;
  },
  ready:function(){return !!$imports.GLR.renderer;},
  resize:function(){if(this.ready())$imports.ThreeBackend.resize();},
  draw:function(dt){if(this.ready())$imports.ThreeBackend.draw(dt);},
  resetSan:function(value){$imports.ThreeBackend.resetSan(value);this.resetCamera();},
  resetCamera:function(){VisualState.camera={walkPhase:0,eyeH:$imports.EYE,fov:72};},
  sceneView:function(){return VisualState.stage||$imports.S;},
  sceneLamps:function(){return VisualState.stage?VisualState.stage.lamps:$imports.OUT_LAMPS;},
  beginOutsideStage:function(){return $imports.ThreeBackend.beginOutsideStage();},
  endStage:function(){return $imports.ThreeBackend.endStage();},
  /* 新局 / 回主菜单：假正常的画面平滑值归零，不带到下一局 */
  resetFakeNormal:function(){$imports.GLR.fnNorm=0;},
  clearWorld:function(){return $imports.ThreeBackend.clearWorld();},
  addRoomLights:function(R){return $imports.ThreeBackend.addRoomLights(R);},
  enterRoom:function(id){$imports.QualityWatch.reset();return $imports.ThreeBackend.enterRoom(id);},
  enterOutside:function(){$imports.QualityWatch.reset();return $imports.ThreeBackend.enterOutside();},
  syncCamera:function(dt,view){return $imports.ThreeBackend.syncCamera(dt,view);},
  captureMenu:function(){return $imports.ThreeBackend.captureMenu();},
  torch:function(on){if($imports.GLR.torch)$imports.GLR.torch.intensity=on?55:0;},
  brightness:function(value){if($imports.GLR.postMat)$imports.GLR.postMat.uniforms.uBright.value=value;},
  grain:function(level){$imports.ThreeBackend.grain(level);},
  /* 换画质：这一档的模型包还没读就先用已有的最接近的一档重建，读好以后再重建一次。
     碰撞代理各档一样（都是最细一档的），先后两次重建占地不变。换档时放掉上一档模型的显存 */
  applyQuality:function(){
    var generation=++QUALITY_LOAD_GENERATION;
    $imports.QualityWatch.reset();if(!this.ready())return;
    $imports.Assets.clearCache();$imports.ThreeBackend.applyQuality();
    var lod=$imports.Assets.want(),self=this;
    if(!$imports.Assets.ready(lod))$imports.Assets.load(lod,function(l){if(generation===QUALITY_LOAD_GENERATION&&l===$imports.Assets.want()&&self.ready()){$imports.Assets.clearCache();$imports.ThreeBackend.applyQuality();}});
  }
};

/* @module-exports */
GameModules.publish("game3d/js/engine/api.js",{
"VisualState":{get:function(){return VisualState;},set:function($value){VisualState=$value;}},
"QUALITY_LOAD_GENERATION":{get:function(){return QUALITY_LOAD_GENERATION;},set:function($value){QUALITY_LOAD_GENERATION=$value;}},
"Engine":{get:function(){return Engine;},set:function($value){Engine=$value;}}
});
})(GameModules.imports("game3d/js/engine/api.js"));
