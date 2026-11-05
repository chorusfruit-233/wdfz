/* @module-capsule */
(function($imports){
/* 里世界 3D · 死亡演出「窗户内的视线」（window_gaze，约 7 秒；计划第 10 节分镜）
   视线坐标：原点在脚下，+z 是死的那一刻的视线方向（面朝那扇窗）。
   前兆 0–2.0：正前方一扇窗，窗格里一双眼睛，一直不眨。
   接触 2.0–3.6：玻璃上的倒影（你的轮廓）先转了过来，正对着你。
   临终 3.6–5.6：反打——从窗里往外看：窗框贴在镜头前，前面站着一个人，背对着你。那是你。
   收束 5.6–7.0：那个人慢慢抬头，玻璃上映出同一双眼睛；暗场。尾句「原来里面那个，一直是我。」
   不频闪；镜头晃动跟着设置（只用固定构图）。 */
'use strict';

(function(){
  if(typeof $imports.DeathCG==='undefined'||!$imports.DeathCG.register) return;
  var U=$imports.DeathCG.kit, ss=U.ss, mat=U.mat, D=2.2;
  $imports.DeathCG.register('window_gaze',{
    build:function(c){
      c.hideWorld();
      var fl=c.mesh(new $imports.THREE.PlaneGeometry(4,5),mat(0x1a1d1f),0,0.002,1); fl.rotation.x=-Math.PI/2;
      /* A：前面那堵墙和窗 */
      c.wall=[c.box(4,1.0,0.12,0x4a5052,undefined,0,0.5,D), c.box(4,0.6,0.12,0x4a5052,undefined,0,2.55,D),
        c.box(1.25,1.25,0.12,0x4a5052,undefined,-1.375,1.625,D), c.box(1.25,1.25,0.12,0x4a5052,undefined,1.375,1.625,D)];
      c.glass=c.box(1.5,1.25,0.01,0x0b1013,undefined,0,1.625,D+0.02);
      c.mull=[c.box(0.04,1.25,0.05,0x8b9192,undefined,0,1.625,D-0.02), c.box(1.5,0.04,0.05,0x8b9192,undefined,0,1.625,D-0.02)];
      c.eyes=[c.box(0.045,0.022,0.01,0xe8e4d4,undefined,-0.05,1.86,D-0.012,{fog:false}), c.box(0.045,0.022,0.01,0xe8e4d4,undefined,0.05,1.86,D-0.012,{fog:false})];   /* 贴在玻璃这一面 */
      c.refl=c.fig('person',0x3a4246,1,0.12,D-0.03); c.refl.scale.set(0.98,0.98,0.05);
      /* B：反打——窗框贴在镜头前，前面背对着站着的「你」 */
      c.frameB=[c.box(0.08,2.4,0.06,0x8b9192,undefined,-0.5,1.2,0.42), c.box(0.08,2.4,0.06,0x8b9192,undefined,0.5,1.2,0.42),
        c.box(1.1,0.08,0.06,0x8b9192,undefined,0,0.95,0.42), c.box(1.1,0.08,0.06,0x8b9192,undefined,0,2.3,0.42)];
      c.self=c.fig('person',0x2c3337,1,0,2.4); c.self.rotation.y=0;          /* 背对镜头 */
      c.selfEyes=[c.box(0.04,0.02,0.01,0xe8e4d4,undefined,-0.045,1.66,2.25,{fog:false}), c.box(0.04,0.02,0.01,0xe8e4d4,undefined,0.045,1.66,2.25,{fog:false})];
      c.veil(0x000000);
    },
    update:function(c,k,view){
      var rev=k>=3.6;
      c.wall.concat(c.mull,[c.glass],c.eyes).forEach(function(m){ m.visible=!rev; });
      c.refl.visible=!rev&&k>1.2;
      c.frameB.concat([c.self]).forEach(function(m){ m.visible=rev; });
      c.selfEyes.forEach(function(m){ m.visible=rev&&k>6.0; });
      if(!rev){
        c.refl.rotation.y=Math.PI*(1-ss(k,2.0,3.2));                         /* 倒影先转过来 */
        c.cam(view,k,0,0.02*ss(k,0,2.0),0);
        c.shade(0.1+0.25*ss(k,2.6,3.5));
      }else{
        c.cam(view,k,0,0.03,0);
        var up=ss(k,5.6,6.3);
        c.self.rotation.x=-0.25*up;                                             /* 抬头 */
        c.shade(0.55-0.4*ss(k,3.6,4.1)+0.6*ss(k,6.3,7.0));
      }
      c.cue('line',k,5.8,function(){ (0,$imports.os)('原来里面那个，一直是我。',3,$imports.OS_FORCE); });
    }
  });
  $imports.DeathTimeline.define('window_gaze',7);
  if(typeof $imports.DEV_DEATH!=='undefined') $imports.DEV_DEATH.push(['窗户内的视线','window_gaze']);
})();

/* @module-exports */
GameModules.publish("game3d/js/modules/window-gaze/gaze-death.js",{

});
})(GameModules.imports("game3d/js/modules/window-gaze/gaze-death.js"));
