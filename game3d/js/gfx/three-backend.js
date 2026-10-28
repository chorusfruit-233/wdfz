/* 里世界 3D · 渲染后端：Three.js
   一帧：场景画进离屏缓冲 → 清深度，单独画手里的东西（手电、伞、手机，GLR.handScene）
   → 后期着色器（色调、暗角、SAN 抖动、受伤、巡察者红光……）画到屏幕。
   手持物单独一遍：以前和场景一起画，贴着墙走时手电、伞面会插进墙里。 */
'use strict';

GFX.register('three',{
  ready:function(){ return true; },
  init:function(){},
  activate:function(){
    var cv=document.getElementById('cv'); if(cv) cv.style.opacity='';
  },
  deactivate:function(){},
  configure:function(){},
  resize:function(){},
  overlay:function(){
    var r=GLR.renderer, hs=GLR.handScene, root=GLR.handRoot;
    if(!hs||!root||!root.visible) return;
    root.matrix.copy(GLR.cam.matrixWorld); root.matrixWorldNeedsUpdate=true;
    r.autoClear=false; r.clearDepth(); r.render(hs,GLR.cam); r.autoClear=true;
  },
  frame:function(){
    var r=GLR.renderer;
    if(typeof GLRTEST!=='undefined'&&GLRTEST.nopost){
      r.setRenderTarget(null); r.render(GLR.scene,GLR.cam); this.overlay();
      return;
    }
    r.setRenderTarget(GLR.rt);
    r.clear();
    r.render(GLR.scene,GLR.cam);
    this.overlay();
    r.setRenderTarget(null);
    r.render(GLR.postScene,GLR.postCam);
  }
});
