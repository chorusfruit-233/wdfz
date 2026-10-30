/* 游戏层的渲染入口。数值反馈不持有 Three.js 对象；模型与特效留在表现层。 */
'use strict';
var VisualState={time:0,hurt:0,flash:0,patrolFlick:0,patrolRed:0,worldNorm:0,gazeShake:0,deathAnim:null};
var QUALITY_LOAD_GENERATION=0;
var Engine={
  boot:function(){
    var result=ThreeBackend.boot();
    /* 兼容原有表现模块及调试工具；游戏层只写 VisualState。 */
    Object.keys(VisualState).forEach(function(k){
      Object.defineProperty(GLR,k,{configurable:true,enumerable:true,get:function(){return VisualState[k];},set:function(v){VisualState[k]=v;}});
    });
    return result;
  },
  ready:function(){return !!GLR.renderer;},
  resize:function(){if(this.ready())ThreeBackend.resize();},
  draw:function(dt){if(this.ready())ThreeBackend.draw(dt);},
  clearWorld:function(){return ThreeBackend.clearWorld();},
  addRoomLights:function(R){return ThreeBackend.addRoomLights(R);},
  enterRoom:function(id){QualityWatch.reset();return ThreeBackend.enterRoom(id);},
  enterOutside:function(){QualityWatch.reset();return ThreeBackend.enterOutside();},
  syncCamera:function(dt){return ThreeBackend.syncCamera(dt);},
  captureMenu:function(){return ThreeBackend.captureMenu();},
  torch:function(on){if(GLR.torch)GLR.torch.intensity=on?55:0;},
  brightness:function(value){if(GLR.postMat)GLR.postMat.uniforms.uBright.value=value;},
  /* 换画质：这一档的模型包还没读就先用已有的最接近的一档重建，读好以后再重建一次。
     碰撞代理各档一样（都是最细一档的），先后两次重建占地不变。换档时放掉上一档模型的显存 */
  applyQuality:function(){
    var generation=++QUALITY_LOAD_GENERATION;
    QualityWatch.reset();if(!this.ready())return;
    Assets.clearCache();ThreeBackend.applyQuality();
    var lod=Assets.want(),self=this;
    if(!Assets.ready(lod))Assets.load(lod,function(l){if(generation===QUALITY_LOAD_GENERATION&&l===Assets.want()&&self.ready()){Assets.clearCache();ThreeBackend.applyQuality();}});
  }
};
