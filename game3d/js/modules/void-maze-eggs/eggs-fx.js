/* @module-capsule */
(function($imports){
/* 里世界 3D · 虚空迷宫的彩蛋：画面与声音（模块 void-maze-eggs）
   只听 eggs.js 发出的 mazeEvent，不改玩法状态。内部内容，不进玩家 Wiki。
   反色：3D 画面在后期着色器里反色（uInvert），字幕和界面不反——字照样看得清；只有一次，不是频闪。
         「镜头晃动」关掉时反得浅一点（80%）、进出慢一点。反色期间迷宫的环境声整片掐断，一声闷响。
         同时在玩家低头看的那片虚空正下方放一个纯白的人影：反色以后白变黑，虚空变白，就是白茫茫里站着一个黑影抬头看你。
   黑影：纯黑、不吃光的人形（雾照样作用），淡入 0.5 秒、淡出 0.35 秒；出现时从它那个方向传来一点脚步或低语。 */
'use strict';

var VoidEggFx={inv:{t:0,dur:0,on:false}, shadow:null, abyss:null, canvas:null,
  canvasEl:function(){ return (typeof $imports.GLR!=='undefined'&&$imports.GLR.renderer)?$imports.GLR.renderer.domElement:null; },
  setFilter:function(k){                                       /* 反色走后期着色器的 uInvert（截图、手机上都稳）；没有后期时退回 CSS 滤镜 */
    k=k>0.004?k:0;
    if(typeof $imports.GLR!=='undefined'&&$imports.GLR.postMat&&$imports.GLR.postMat.uniforms.uInvert&&!(typeof $imports.GLRTEST!=='undefined'&&$imports.GLRTEST.nopost)){ $imports.GLR.postMat.uniforms.uInvert.value=k; return; }
    var c=VoidEggFx.canvasEl(); if(!c) return;
    var v=k?'invert('+k.toFixed(3)+')':'';
    if(c.style.filter!==v) c.style.filter=v;
  },

  figure:function(color,opacity,scale){
    var mat=new $imports.THREE.MeshBasicMaterial({color:color,fog:color===0x000000,transparent:true,opacity:opacity,depthWrite:true});
    var g=new $imports.THREE.Group(); g.add((0,$imports.figMesh)('tall',mat,scale||1)); g.userData.mat=mat;
    return g;
  },
  drop:function(g){
    if(!g) return null;
    if(g.parent) g.parent.remove(g);
    if(g.userData.mat) g.userData.mat.dispose();               /* 人形几何体是共享的，只释放自己的材质 */
    return null;
  },
  pan:function(x,z){
    var p=$imports.VoidMaze.toScene($imports.S.x,$imports.S.y), rel=Math.atan2(z-p.z,x-p.x)-$imports.S.ang;
    return (0,$imports.clamp)(Math.sin(rel),-1,1)*0.85;
  },
  clear:function(){
    VoidEggFx.inv={t:0,dur:0,on:false}; VoidEggFx.setFilter(0);
    if(VoidEggFx.shadow) VoidEggFx.shadow.g=VoidEggFx.drop(VoidEggFx.shadow.g);
    VoidEggFx.shadow=null; VoidEggFx.abyss=VoidEggFx.drop(VoidEggFx.abyss);
  },
  onEvent:function(ev){
    if(!ev||typeof $imports.GLR==='undefined'||!$imports.GLR.scene) return;
    if(ev.kind==='invert'){
      VoidEggFx.inv={t:0,dur:ev.dur,on:true};
      VoidEggFx.abyss=VoidEggFx.drop(VoidEggFx.abyss);
      /* 放在视线方向上 9 米处（低头看下去，画面正中），身子的中段对着视线；面朝上面的你 */
      var a=VoidEggFx.figure(0xffffff,1,1.6), p=$imports.VoidMaze.toScene($imports.S.x,$imports.S.y), pit=Math.min(-0.5,$imports.S.pitch||-0.9), R=9;
      var hx=p.x+Math.cos($imports.S.ang)*Math.cos(pit)*R, hz=p.z+Math.sin($imports.S.ang)*Math.cos(pit)*R, hy=ev.fy+($imports.S.eyeH||$imports.EYE)+Math.sin(pit)*R;
      a.position.set(hx,hy-2.1,hz);
      a.rotation.y=Math.atan2(p.x-hx,p.z-hz);
      $imports.GLR.scene.add(a); VoidEggFx.abyss=a;
      try{ $imports.SFX.scapeCut(ev.dur+0.35); $imports.SoundPlayer.play('void.thud'); }catch(e){}
    }else if(ev.kind==='invertEnd'){
      VoidEggFx.inv.on=false;
      VoidEggFx.abyss=VoidEggFx.drop(VoidEggFx.abyss);
    }else if(ev.kind==='shadowShow'){
      if(VoidEggFx.shadow) VoidEggFx.shadow.g=VoidEggFx.drop(VoidEggFx.shadow.g);
      var g=VoidEggFx.figure(0x000000,0,1.05);
      g.position.set(ev.x,ev.h,ev.z);
      g.rotation.y=Math.PI/2-ev.face;                           /* 人形默认面朝 +z；face 是它要看的方向 */
      $imports.GLR.scene.add(g);
      VoidEggFx.shadow={id:ev.id,g:g,k:0,out:false};
      try{ $imports.SFX.dread(ev.cue||'steps',{pan:VoidEggFx.pan(ev.x,ev.z),k:0.32,muffled:false,behind:false}); }catch(e){}
    }else if(ev.kind==='shadowHide'){
      var s=VoidEggFx.shadow;
      if(s&&s.id===ev.id){ s.out=true; if(ev.how!=='leave'){ try{ $imports.SoundPlayer.play('void.gust',{pan:VoidEggFx.pan(ev.x,ev.z)}); }catch(e){} } else s.g=VoidEggFx.drop(s.g); }
    }
  },
  frame:function(dt){
    var I=VoidEggFx.inv, soft=(typeof $imports.SHAKE_ON!=='undefined'&&!$imports.SHAKE_ON), peak=soft?0.8:1, kin=soft?0.18:0.05, kout=soft?0.45:0.25;
    if(I.on||I.k>0){
      I.t+=dt;
      var target=I.on?peak:0, rate=I.on?1/kin:1/kout;
      I.k=I.on?Math.min(target,(I.k||0)+dt*rate):Math.max(0,(I.k||0)-dt*rate);
      VoidEggFx.setFilter(I.k);
    }
    var s=VoidEggFx.shadow;
    if(s&&s.g){
      s.k=s.out?Math.max(0,s.k-dt/0.35):Math.min(1,s.k+dt/0.5);
      if(s.g.userData.mat) s.g.userData.mat.opacity=s.k;
      if(s.out&&s.k<=0){ s.g=VoidEggFx.drop(s.g); VoidEggFx.shadow=null; }
    }
  }
};
(function(){
  var own={owner:'void-maze-eggs'};
  GameModules.on('mazeEvent',VoidEggFx.onEvent,own);
  GameModules.on('frame',VoidEggFx.frame,own);
  GameModules.on('clearWorld',VoidEggFx.clear,own);
  GameModules.on('boundary',VoidEggFx.clear,own);             /* 新局 / 回菜单（Lifecycle.boundary）：反色、人影都收掉 */
})();

/* @module-exports */
GameModules.publish("game3d/js/modules/void-maze-eggs/eggs-fx.js",{
"VoidEggFx":{get:function(){return VoidEggFx;},set:function($value){VoidEggFx=$value;}}
});
})(GameModules.imports("game3d/js/modules/void-maze-eggs/eggs-fx.js"));
