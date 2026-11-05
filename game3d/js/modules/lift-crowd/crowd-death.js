/* @module-capsule */
(function($imports){
/* 里世界 3D · 死亡演出「满员」（内部，计划第 6.3 节；用 DeathCG.register 接进死亡演出）
   视线坐标：原点在脚下，+z 是死的那一刻的视线方向（面朝轿门）；本地 +x 在画面左边。布景自己搭，不依赖场景。
   四段（约 4.2 秒）：
   前兆 0–0.8：门合上，蜂鸣突然停了，一片安静。门楣上的显示屏还亮着「满员」。
   接触 0.8–2.2：轿厢暗下来，画面四边一点点被挤小；肩膀上搭上了手（画面边缘的轮廓），越来越多。
   临终 2.2–3.25：镜头被挤到角落，抬头看见楼层显示一路往上跳：6、7、8、9……
   收束 3.25–4.2：显示屏熄灭；从轿厢顶角往下看，门在某一层打开，轿厢里空无一人，地上只有一张学生证。
   只闪一次（显示屏熄灭前那一下），不频闪；镜头晃动跟着设置。 */
'use strict';

(function(){
  if(typeof $imports.DeathCG==='undefined'||!$imports.DeathCG.register) return;
  var U=$imports.DeathCG.kit, seg=U.seg, ss=U.ss, mat=U.mat;
  var SEGS={a:[0,0.045,0.05,0.01],b:[0.025,0.0225,0.01,0.045],c:[0.025,-0.0225,0.01,0.045],d:[0,-0.045,0.05,0.01],
    e:[-0.025,-0.0225,0.01,0.045],f:[-0.025,0.0225,0.01,0.045],g:[0,0,0.05,0.01]};
  var DIG={6:'afedcg',7:'abc',8:'abcdefg',9:'abcdfg'};
  var D=1.05;                                                       /* 门在前面 1.05 米 */

  $imports.DeathCG.register('crowd',{
    build:function(c){
      var i;
      c.hideWorld();
      var fl=c.mesh(new $imports.THREE.PlaneGeometry(1.6,1.6),mat(0x15191a),0,0.002,D-0.8); fl.rotation.x=-Math.PI/2;
      c.walls=[
        c.box(0.04,2.3,1.6,0x5e6766,undefined,-0.8,1.15,D-0.8), c.box(0.04,2.3,1.6,0x5e6766,undefined,0.8,1.15,D-0.8),
        c.box(1.6,2.3,0.04,0x545c5b,undefined,0,1.15,D-1.6), c.box(1.6,0.04,1.6,0x2c3231,undefined,0,2.32,D-0.8),
        c.box(0.35,2.3,0.05,0x5e6766,undefined,-0.625,1.15,D+0.02), c.box(0.35,2.3,0.05,0x5e6766,undefined,0.625,1.15,D+0.02),
        c.box(0.9,0.2,0.05,0x5e6766,undefined,0,2.2,D+0.02)
      ];
      c.lamp=c.box(0.6,0.012,0.4,0xd8ddd6,undefined,0,2.29,D-0.8,{fog:false});
      c.box(0.04,0.82,0.19,0x262c2e,undefined,-0.77,1.42,D-0.4);                         /* 操纵盘 */
      /* 门楣上的显示屏：先是「满员」（两块红色的字块），之后七段数码一路往上跳 */
      c.box(0.2,0.12,0.008,0x070808,undefined,0,2.2,D-0.008);
      var fullMat=typeof $imports.LiftCrowdFx!=='undefined'?new $imports.THREE.MeshBasicMaterial({map:$imports.LiftCrowdFx.tex(),toneMapped:false}):mat(0xff4a2a);
      var fm=c.mesh(new $imports.THREE.PlaneGeometry(0.19,0.07),fullMat,0,2.2,D-0.013); fm.rotation.y=Math.PI;               /* 「满员」：和轿厢里那块显示屏同一张图 */
      c.full=[fm];
      c.segs={};
      Object.keys(SEGS).forEach(function(k){ var q=SEGS[k];
        c.segs[k]=c.box(q[2],q[3],0.004,0xff4a2a,undefined,-q[0],2.2+q[1],D-0.013,{fog:false}); c.segs[k].visible=false; });
      c.leafL=c.box(0.45,2.1,0.03,0x737b7a,undefined,0.225,1.05,D); c.leafR=c.box(0.45,2.1,0.03,0x737b7a,undefined,-0.225,1.05,D);
      c.out=c.box(1.6,2.3,0.01,0xb9b6a8,undefined,0,1.15,D+0.9,{fog:false}); c.out.visible=false;   /* 门外某一层的走廊光 */
      /* 地上的学生证 */
      c.card=c.box(0.12,0.004,0.078,0xe9e4d6,undefined,0.04,0.004,D-0.42); c.card.rotation.y=0.5; c.card.visible=false;
      c.photo=c.box(0.03,0.005,0.04,0x47515a,undefined,0.058,0.005,D-0.43); c.photo.rotation.y=0.5; c.photo.visible=false;
      /* 肩膀上的手：从画面两边和下面伸过来，越来越多（hand 是死亡演出共用的手模型） */
      c.hands=[];
      var spots=[[0.27,-0.26,0.06],[-0.27,-0.24,0.04],[0.32,-0.12,0.14],[-0.33,-0.1,0.16],[0.2,-0.34,0.2],[-0.18,-0.36,0.22]];   /* 六只：绘制预算 30 次以内 */
      for(i=0;i<spots.length;i++){
        var h=c.fx('hand',0.8,0,-5,0); h.userData.s=spots[i]; h.userData.at=0.9+i*0.2; h.visible=false; c.hands.push(h);
        h.traverse(function(o){ if(o.material&&o.material.color){ o.material=o.material.clone(); o.material.color.setRGB(0.03,0.03,0.03); } });   /* 画面边缘的轮廓：黑的 */
      }
      /* 画面四边被挤小：四块黑板贴在镜头前（每帧跟着镜头摆） */
      c.edges=[];
      for(i=0;i<4;i++) c.edges.push(c.mesh(new $imports.THREE.PlaneGeometry(1,1),mat(0x000000,1,{fog:false}),0,-5,0));
      c.veil(0x000000);
    },
    update:function(c,k,view){
      var end=k>=3.25;
      /* 镜头先摆好（四边和手都跟着它）：前兆平视门；接触时被往下压、晃；临终被挤到角落、抬头看显示屏；收束从顶角往下看 */
      if(!end){
        var press=ss(k,0.9,2.2), look=ss(k,2.2,2.7);
        c.cam(view,k,0.22*press,0.16*(1-press)+0.62*look+0.025*Math.sin(k*31)*c.shk*press,-0.28*press);
        c.shade(0.12+0.5*ss(k,1.6,2.2)-0.35*look+0.7*ss(k,3.05,3.25));
      }else{
        c.cam(view,k,0,-1.02,0.6);                                                    /* 从轿厢顶上往下看：门开着，地上只有学生证 */
        c.shade(0.9-0.6*ss(k,3.3,3.6)+0.5*ss(k,3.95,4.2));
      }
      /* 门：一直关着，收束时在某一层打开 */
      var gap=end?0.9*ss(k,3.35,3.75):0;
      c.leafL.position.x=0.225+gap/2; c.leafR.position.x=-0.225-gap/2;
      c.out.visible=end&&gap>0.02;
      /* 灯：前兆亮着，接触时一点点暗下来，收束时只剩门外的光 */
      var lit=end?0.15:1-0.8*ss(k,0.8,2.0);
      c.lamp.visible=!end&&lit>0.25;
      c.walls.forEach(function(w){ if(!w.userData.c0) w.userData.c0=w.material.color.clone(); w.material.color.copy(w.userData.c0).multiplyScalar(0.25+0.75*lit); });
      /* 显示屏：「满员」→ 2.2 起 6、7、8、9 一路往上跳 → 3.1 全段亮一下，熄灭 */
      var n=6+Math.min(3,Math.floor((k-2.2)/0.24)), on=(k>=2.2&&k<3.1)?DIG[n]:((k>=3.1&&k<3.15)?'abcdefg':'');
      c.full.forEach(function(b){ b.visible=k<2.2; });
      Object.keys(c.segs).forEach(function(s){ c.segs[s].visible=on.indexOf(s)>=0; });
      c.card.visible=c.photo.visible=end;
      /* 画面四边被挤小、肩膀上的手：都摆在镜头前（视线坐标里算） */
      var cam=$imports.GLR.cam;
      c.F.updateWorldMatrix(true,false);
      var inv=new $imports.THREE.Matrix4().copy(c.F.matrixWorld).invert(), qF=new $imports.THREE.Quaternion(), qc=new $imports.THREE.Quaternion();
      c.F.getWorldQuaternion(qF); qc.copy(qF).invert().multiply(cam.quaternion);
      var base=cam.position.clone().applyMatrix4(inv);
      var lf=new $imports.THREE.Vector3(0,0,-1).applyQuaternion(qc), lu=new $imports.THREE.Vector3(0,1,0).applyQuaternion(qc), lr=new $imports.THREE.Vector3(1,0,0).applyQuaternion(qc);
      var dist=0.3, hh=Math.tan((cam.fov||70)*Math.PI/360)*dist, hw=hh*(cam.aspect||1.5), sq=end?0:ss(k,0.9,2.9);
      var ix=0.42*hw*sq, iy=0.3*hh*sq;                                                  /* 左右挤得多一点 */
      var place=[[lr,2*hw-ix,0,2*hw,2.6*hh],[lr,-(2*hw-ix),0,2*hw,2.6*hh],[lu,0,2*hh-iy,2.6*hw,2*hh],[lu,0,-(2*hh-iy),2.6*hw,2*hh]];
      c.edges.forEach(function(e,i){
        var q=place[i], p=base.clone().addScaledVector(lf,dist);
        if(i<2) p.addScaledVector(lr,q[1]); else p.addScaledVector(lu,q[2]);
        e.position.copy(p); e.quaternion.copy(qc); e.scale.set(q[3],q[4],1);
        e.visible=!end&&sq>0.01;
      });
      c.hands.forEach(function(h){
        var s=h.userData.s, show=!end&&k>h.userData.at;
        h.visible=show; if(!show) return;
        var g=ss(k,h.userData.at,h.userData.at+0.35);
        var p=base.clone().addScaledVector(lf,0.24+s[2]*0.5).addScaledVector(lr,-s[0]*(1.3-0.3*g)).addScaledVector(lu,s[1]*(1.25-0.25*g));
        h.position.copy(p);
        h.lookAt(base.clone().addScaledVector(lf,1.2).addScaledVector(lu,s[1]));
      });
    }
  });
  $imports.DeathTimeline.define('crowd',4.2);
  if(typeof $imports.DEV_DEATH!=='undefined') $imports.DEV_DEATH.push(['满员（内部）','crowd']);
})();

/* @module-exports */
GameModules.publish("game3d/js/modules/lift-crowd/crowd-death.js",{

});
})(GameModules.imports("game3d/js/modules/lift-crowd/crowd-death.js"));
