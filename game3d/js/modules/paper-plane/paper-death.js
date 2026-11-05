/* @module-capsule */
(function($imports){
/* 里世界 3D · 死亡演出「飞纸飞机的人」（paper_sender，约 8 秒；计划第 10 节分镜）
   视线坐标：原点在脚下，+z 是死的那一刻的视线方向；布景自己搭：你在一扇门前。
   前兆 0–2.0：门外的脚步声停在门口（字幕）。门关着，门缝下面一线光。
   接触 2.0–4.2：一架压扁的纸飞机从门缝底下塞进来，滑到脚边。
   临终 4.2–6.6：门开了一条缝，一只手伸进来，把纸展开——是你刚才读过的那张。
   收束 6.6–8.0：画面被折进纸页（四边往里收），最后一声拍窗；暗场。尾句「他来取回没有送到的东西。」
   不频闪，不见血；镜头晃动跟着设置。 */
'use strict';

(function(){
  if(typeof $imports.DeathCG==='undefined'||!$imports.DeathCG.register) return;
  var U=$imports.DeathCG.kit, ss=U.ss, mat=U.mat, D=1.6;
  $imports.DeathCG.register('paper_sender',{
    build:function(c){
      c.hideWorld();
      var fl=c.mesh(new $imports.THREE.PlaneGeometry(4,4),mat(0x1b1e1f),0,0.002,0.8); fl.rotation.x=-Math.PI/2;
      c.box(4,3,0.1,0x3d4446,undefined,0,1.5,D+0.05);
      c.gap=c.box(0.9,0.02,0.01,0xd8d2b8,undefined,0,0.01,D-0.02,{fog:false});
      c.door=new $imports.THREE.Group(); c.add(c.door,0.45,0,D-0.03);
      var leaf=new $imports.THREE.Mesh(new $imports.THREE.BoxGeometry(0.9,2.05,0.04),mat(0x5b4a38)); leaf.position.set(-0.45,1.035,0); c.door.add(leaf);
      c.plane=c.box(0.24,0.006,0.16,0xe9e5d8,undefined,0,0.005,D-0.05); c.plane.visible=false;
      c.sheet=c.box(0.34,0.46,0.004,0xefebde,undefined,0,1.25,D-0.6); c.sheet.visible=false;
      c.hand=c.box(0.09,0.12,0.03,0xcdbca6,undefined,0.12,1.2,D-0.55); c.hand.visible=false;
      c.lines=[]; for(var i=0;i<5;i++){ var l=c.box(0.24,0.008,0.002,0x3a3530,undefined,0,1.38-i*0.06,D-0.602); l.visible=false; c.lines.push(l); }
      c.veil(0x000000);
    },
    update:function(c,k,view){
      c.cue('steps',k,0.2,function(){ (0,$imports.os)('（门外的脚步声停了。）',2.2,$imports.OS_FORCE); });
      c.plane.visible=k>2.0&&k<4.4; c.plane.position.z=D-0.05-0.6*ss(k,2.0,3.6); c.plane.rotation.y=0.4*ss(k,2.0,3.6);
      var open=ss(k,4.2,4.8); c.door.rotation.y=-0.35*open; c.gap.visible=k<4.2;
      c.hand.visible=c.sheet.visible=k>4.4; c.lines.forEach(function(l){ l.visible=k>4.9; });
      c.sheet.scale.y=0.2+0.8*ss(k,4.4,5.2);
      var fold=0.55*ss(k,5.4,8.0); c.sheet.position.z=D-0.6-fold; c.hand.position.z=D-0.55-fold; c.lines.forEach(function(l){ l.position.z=D-0.602-fold; });   /* 收束：纸页朝镜头贴过来 */
      var down=-0.35+0.35*ss(k,1.6,2.2)-0.62*ss(k,2.2,3.6)+0.62*ss(k,4.0,4.6);
      c.cam(view,k,0,down,0);
      c.shade(0.15+0.75*ss(k,6.6,8.0));
      c.cue('knock',k,7.2,function(){ (0,$imports.os)('他来取回没有送到的东西。',3,$imports.OS_FORCE); });
    }
  });
  $imports.DeathTimeline.define('paper_sender',8);
  if(typeof $imports.DEV_DEATH!=='undefined') $imports.DEV_DEATH.push(['飞纸飞机的人','paper_sender']);
})();

/* @module-exports */
GameModules.publish("game3d/js/modules/paper-plane/paper-death.js",{

});
})(GameModules.imports("game3d/js/modules/paper-plane/paper-death.js"));
