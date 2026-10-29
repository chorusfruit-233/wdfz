/* 游戏层的渲染入口。数值反馈不持有 Three.js 对象；模型与特效留在表现层。 */
'use strict';
var VisualState={time:0,hurt:0,flash:0,patrolFlick:0,patrolRed:0,worldNorm:0,gazeShake:0,deathAnim:null};
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
  applyQuality:function(){QualityWatch.reset();if(this.ready())ThreeBackend.applyQuality();},
  remotePose:function(id,pose,name){if(this.ready())ThreeBackend.remotePose(id,pose,name);},
  remoteRemove:function(id){if(ThreeBackend.remoteRemove)ThreeBackend.remoteRemove(id);},
  remoteClear:function(){if(ThreeBackend.remoteClear)ThreeBackend.remoteClear();},
  remoteTick:function(dt,zone,waiting){if(this.ready())ThreeBackend.remoteTick(dt,zone,waiting);}
};
