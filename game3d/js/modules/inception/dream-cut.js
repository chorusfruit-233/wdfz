/* @module-capsule */
(function($imports){
/* 里世界 3D · 隐藏结局《盗梦空间》的结局 CG（20 秒，内部彩蛋，不进 Wiki）
   0–4 秒  往下坠：灰白的走廊一层一层往上退，风声和呼吸越来越轻。
   4–9 秒  课桌上的陀螺在转，镜头绕着它走；窗外的学校虚掉，广播断在半句。
   9–15 秒 在一间真的房间里醒来：阳光从窗户进来，床头一本普通的课本，窗外没有广播。
   15–20 秒 手指碰到桌上的陀螺，镜头停在它的影子上，转动慢下来；淡出，结局卡。
   全部是 MeshBasicMaterial（不吃场景灯光，四档画质一样）；演出期间把当前房间藏起来、结束时放回；字幕走 os，可跳过。 */
'use strict';

(function(){
  var DUR=20;
  function mat(c,op){ return new $imports.THREE.MeshBasicMaterial({color:c,fog:false,transparent:op!==undefined,opacity:op===undefined?1:op,depthWrite:op===undefined}); }
  function box(g,w,h,d,c,x,y,z){ var m=new $imports.THREE.Mesh(new $imports.THREE.BoxGeometry(w,h,d),mat(c)); m.position.set(x,y,z); g.add(m); return m; }
  function enclose(g,w,h,dd,c,y){ var m=new $imports.THREE.Mesh(new $imports.THREE.BoxGeometry(w,h,dd),new $imports.THREE.MeshBasicMaterial({color:c,fog:false,side:$imports.THREE.BackSide})); m.position.y=y||h/2-0.01; g.add(m); return m; }
  function top(g){
    var t=new $imports.THREE.Group(), m=mat(0xb48d4c), d=mat(0x6e5528);
    var body=new $imports.THREE.Mesh(new $imports.THREE.ConeGeometry(0.06,0.085,20),m); body.rotation.x=Math.PI; body.position.y=0.043; t.add(body);
    var cap=new $imports.THREE.Mesh(new $imports.THREE.CylinderGeometry(0.06,0.06,0.014,20),d); cap.position.y=0.092; t.add(cap);
    var stem=new $imports.THREE.Mesh(new $imports.THREE.CylinderGeometry(0.01,0.01,0.05,8),m); stem.position.y=0.123; t.add(stem);
    g.add(t); return t;
  }
  $imports.CUT_DEF.inception={dur:DUR,setup:function(d){
    d.hidden=[]; [$imports.GLR.roomMesh,$imports.GLR.outMesh].forEach(function(o){ if(o&&o.visible){ o.visible=false; d.hidden.push(o); } });
    try{ $imports.GLR.scene.children.forEach(function(o){ if(o.name==='inception'&&o.visible){ o.visible=false; d.hidden.push(o); } }); }catch(e){}
    d.st=[]; for(var i=0;i<4;i++){ var g=new $imports.THREE.Group(); g.position.x=i*40; (0,$imports.cutAdd)(g); d.st.push(g); }
    /* A：竖井，一层层的走廊截面 */
    var a=d.st[0]; d.rings=[];
    for(i=0;i<14;i++){ var y=-i*3.2, r=new $imports.THREE.Group(); r.position.y=y;
      box(r,6,0.12,0.4,0xc9ccd0,0,0,-2.6); box(r,6,0.12,0.4,0xc9ccd0,0,0,2.6); box(r,0.4,0.12,5.6,0xb9bcc0,-2.8,0,0); box(r,0.4,0.12,5.6,0xb9bcc0,2.8,0,0);
      box(r,0.9,2.0,0.05,0x6b5a44,(i%2?1.4:-1.4),1.0,-2.45); a.add(r); d.rings.push(r); }
    box(a,0.3,60,0.3,0xa7abb0,-2.6,-20,-2.4); box(a,0.3,60,0.3,0xa7abb0,2.6,-20,2.4);
    /* B：课桌和陀螺 */
    var b=d.st[1]; enclose(b,9,4.2,7,0x16191c); box(b,1.2,0.05,0.6,0x6f5c43,0,0.76,0); box(b,0.05,0.76,0.05,0x3a3128,-0.55,0.38,-0.25); box(b,0.05,0.76,0.05,0x3a3128,0.55,0.38,0.25);
    box(b,8,4,0.1,0x2a2f33,0,2,-3); d.winB=box(b,2.2,1.3,0.05,0x8e98a0,0,1.9,-2.9); d.topB=top(b); d.topB.position.set(0,0.785,0);
    /* C：真的房间 */
    var c=d.st[2]; enclose(c,6.2,3.1,6.2,0xcbbfa8); box(c,6,0.05,6,0x9a8b78,0,0,0); box(c,6,3,0.1,0xd9cdb8,0,1.5,-3); box(c,0.1,3,6,0xcfc2ab,-3,1.5,0);
    d.sun=box(c,1.6,1.2,0.05,0xfff3d6,0.6,1.8,-2.94); box(c,1.9,0.5,0.9,0xe8e2d6,-1.6,0.25,-1.8); box(c,1.9,0.12,0.9,0xf3efe8,-1.6,0.56,-1.8);
    box(c,0.5,0.5,0.4,0x8a7356,-0.3,0.25,-2.4); var book=box(c,0.26,0.04,0.34,0x3f6c8c,-0.3,0.52,-2.4); book.rotation.y=0.3;
    var beam=new $imports.THREE.Mesh(new $imports.THREE.PlaneGeometry(1.6,3.2),mat(0xfff0c8,0.12)); beam.rotation.x=-1.0; beam.position.set(0.6,0.9,-1.6); c.add(beam);
    /* D：桌面、陀螺、影子、手指 */
    var e=d.st[3]; enclose(e,8,4.2,6,0xc9bca4); box(e,2,0.05,1.2,0x7b6649,0,0.76,0); box(e,8,4,0.1,0xd4c7b0,0,2,-2);
    d.topD=top(e); d.topD.position.set(0,0.785,0);
    var sh=new $imports.THREE.Mesh(new $imports.THREE.CircleGeometry(0.07,20),mat(0x2a2218,0.55)); sh.rotation.x=-Math.PI/2; sh.position.set(0.05,0.787,0.04); e.add(sh); d.shadow=sh;
    d.finger=box(e,0.03,0.03,0.18,0xe2c3a6,0.3,0.83,0.25); d.finger.rotation.y=0.9;
    d.said={};
  },frame:function(k,d){
    var t=k*DUR, s=t<4?0:t<9?1:t<15?2:3;
    d.st.forEach(function(g,i){ g.visible=i===s; });
    if(s===0){
      var y=-t*7;(0,$imports.cutLook)(0,y+0.4,0,0.4,y-6,0.3);   /* 往下看着坠落：一层层走廊往上退 */
      if(!d.said.a){ d.said.a=1; (0,$imports.os)('（风声。呼吸越来越轻。）',3.6,$imports.OS_FORCE); }
    }else if(s===1){
      var u=(t-4)/5, ang=u*1.6; (0,$imports.cutLook)(40+Math.sin(ang)*1.1,1.15,Math.cos(ang)*1.1,40,0.82,0);
      d.topB.rotation.y+=($imports.CUT.dt||0.016)*24; d.winB.material.color.setHex(u<0.6?0x8e98a0:0x3a4046);
      if(!d.said.b){ d.said.b=1; (0,$imports.os)('广播：「请各班同学，回到自己的——」',3.2,$imports.OS_FORCE); }
    }else if(s===2){
      var v=(t-9)/6; (0,$imports.cutLook)(80-1.6,0.7+v*0.6,-1.6+v*0.4,80+0.4,1.4,-2.6);   /* 从枕头上抬起头 */
      d.sun.material.color.setHex(0xfff3d6);
      if(!d.said.c){ d.said.c=1; (0,$imports.os)('我醒了。阳光照在床头的课本上。窗外很安静，没有广播。',5,$imports.OS_FORCE); }
    }else{
      var w=(t-15)/5; (0,$imports.cutLook)(120+0.25,1.05-w*0.08,0.55-w*0.15,120,0.79,0.02);
      var sp=Math.max(0.15,1-w*0.85); d.topD.rotation.y+=($imports.CUT.dt||0.016)*20*sp; d.topD.rotation.z=0.08*(1-sp)*Math.sin(t*6);
      d.finger.position.x=0.3-Math.min(1,w*2)*0.12; d.finger.position.z=0.25-Math.min(1,w*2)*0.09;   /* 停在碰到陀螺边缘的地方 */
      if(!d.said.d){ d.said.d=1; (0,$imports.os)('桌上的陀螺还在转。',3.6,$imports.OS_FORCE); }
    }
    var edge=0; [4,9,15].forEach(function(x){ edge=Math.max(edge,Math.max(0,1-Math.abs(t-x)/0.25)); });
    (0,$imports.cutFade)(Math.max(edge,t>19?(t-19):0));
  },clean:function(d){ (d.hidden||[]).forEach(function(o){ o.visible=true; }); }};
  if(typeof $imports.ENDINGS!=='undefined'&&!$imports.ENDINGS.inception)
    $imports.ENDINGS.inception={t:'《盗梦空间》',l:['我在一间真的房间里醒来。','阳光照在床头的课本上，窗外没有广播。','桌上的陀螺还在转。','我没有等它停下来。']};
})();

/* @module-exports */
GameModules.publish("game3d/js/modules/inception/dream-cut.js",{

});
})(GameModules.imports("game3d/js/modules/inception/dream-cut.js"));
