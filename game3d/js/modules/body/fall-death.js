/* @module-capsule */
(function($imports){
/* 里世界 3D · 死亡演出「中国人能飞」（campus_fall，约 6 秒；计划第 10.1 节分镜）
   视线坐标：原点在脚下，+z 是死的那一刻的视线方向（翻出去的方向）。
   失去支撑 0–1.6：手离开栏杆，栏杆和楼层边缘往上滑出画面。
   坠落记忆 1.6–4.2：一排排窗框从身边往上掠过（楼的外墙在画面一侧），镜头慢慢转向下。
   收束 4.2–6.0：地面的影子迎上来，接触之前黑场；一次克制的碰撞声（字幕），不见血。
   镜头不平移：用整组布景往上走表示往下掉；镜头晃动跟着设置。 */
'use strict';

(function(){
  if(typeof $imports.DeathCG==='undefined'||!$imports.DeathCG.register) return;
  var U=$imports.DeathCG.kit, ss=U.ss, mat=U.mat;
  $imports.DeathCG.register('campus_fall',{
    build:function(c){
      c.hideWorld();
      c.world=new $imports.THREE.Group(); c.add(c.world,0,0,0);
      var W=c.world;
      function box(w,h,d,col,x,y,z){ var m=new $imports.THREE.Mesh(new $imports.THREE.BoxGeometry(w,h,d),mat(col)); m.position.set(x,y,z); W.add(m); return m; }
      box(3,0.12,0.06,0x8a8f8c,0,1.05,0.35); box(3,0.1,0.6,0x5c605e,0,0.9,0.05);                    /* 栏杆、楼边 */
      for(var i=0;i<6;i++){ var y=-3.2*i-1.6;                                                     /* 外墙上的一层层窗 */
        box(0.08,3.2,4,0x6c6e66,-1.25,y,1.2);
        box(0.06,1.3,1.4,0x1d2326,-1.2,y+0.2,0.7); box(0.06,1.3,1.4,0x1d2326,-1.2,y+0.2,2.3);
        box(0.1,0.12,4,0x9a9c94,-1.18,y-1.3,1.2); }
      c.ground=new $imports.THREE.Mesh(new $imports.THREE.PlaneGeometry(8,8),mat(0x2b2a26)); c.ground.rotation.x=-Math.PI/2; c.ground.position.set(0,-19.5,1.5); W.add(c.ground);
      c.shadow=new $imports.THREE.Mesh(new $imports.THREE.CircleGeometry(0.5,20),mat(0x080808)); c.shadow.rotation.x=-Math.PI/2; c.shadow.position.set(0,-19.48,1.5); W.add(c.shadow);
      c.veil(0x000000);
    },
    update:function(c,k,view){
      var fall=k<1.6?0.6*ss(k,0.3,1.6):0.6+(k-1.6)*(k-1.6)*2.6+(k-1.6)*2.0;
      c.world.position.y=Math.min(18.2,fall);                                                  /* 布景往上走＝人往下掉 */
      c.shadow.scale.setScalar(0.5+2.5*ss(k,3.6,4.6));
      var down=-0.2*ss(k,0,1.6)-1.0*ss(k,1.6,4.0);
      c.cam(view,k,0.04*c.shk*Math.sin(k*7)*ss(k,1.6,3.0),down,0);
      c.shade(0.05+0.9*ss(k,4.3,4.9));
      c.cue('wind',k,1.7,function(){ (0,$imports.os)('（风声。校园里的声音一下子远了。）',2.4,$imports.OS_FORCE); });
      c.cue('hit',k,4.9,function(){ (0,$imports.os)('（一声闷响。）',1.6,$imports.OS_FORCE); });
    }
  });
  $imports.DeathTimeline.define('campus_fall',6);
  if(typeof $imports.DEV_DEATH!=='undefined') $imports.DEV_DEATH.push(['中国人能飞','campus_fall']);
})();

/* @module-exports */
GameModules.publish("game3d/js/modules/body/fall-death.js",{

});
})(GameModules.imports("game3d/js/modules/body/fall-death.js"));
