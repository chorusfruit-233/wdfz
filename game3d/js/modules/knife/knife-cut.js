/* @module-capsule */
(function($imports){
/* 里世界 3D · 隐藏假结局《管制刀具》的过场（16 秒，内部彩蛋；计划第 10.3 节分镜）
   0–3   小刀刚抬起，压在头顶的那只手停住了。
   3–7   高个子把小刀装进透明物品袋，递来一张登记单——姓名早就填好了。「管制刀具。」
   7–11  一扇门外透进正常的日光；登记单盖章，刀锁进柜子。
   11–16 柜门合上的形状接成课桌抽屉；镜头拉回自己的座位，登记单压在课本下，姓名后只剩「留校」。
   不见血，不做刺杀动作；全部 MeshBasicMaterial，演出期间把当前场景藏起来。 */
'use strict';

(function(){
  var DUR=16;
  function mat(c,op){ return new $imports.THREE.MeshBasicMaterial({color:c,fog:false,transparent:op!==undefined,opacity:op===undefined?1:op,depthWrite:op===undefined,side:$imports.THREE.DoubleSide}); }
  function box(g,w,h,d,c,x,y,z,op){ var m=new $imports.THREE.Mesh(new $imports.THREE.BoxGeometry(w,h,d),mat(c,op)); m.position.set(x,y,z); g.add(m); return m; }
  function label(lines,w,h){
    var cv=document.createElement('canvas'); cv.width=256; cv.height=Math.round(256*h/w); var g=cv.getContext('2d');
    g.fillStyle='#f2efe4'; g.fillRect(0,0,cv.width,cv.height); g.fillStyle='#222'; g.textAlign='left'; g.textBaseline='top';
    lines.forEach(function(t,i){ g.font=(i?'500 18px ':'700 24px ')+(typeof $imports.SIGN_FONT!=='undefined'?$imports.SIGN_FONT:'sans-serif'); g.fillText(t,16,14+i*34); });
    var tx=new $imports.THREE.CanvasTexture(cv); tx.colorSpace=$imports.THREE.SRGBColorSpace;
    return new $imports.THREE.Mesh(new $imports.THREE.PlaneGeometry(w,h),new $imports.THREE.MeshBasicMaterial({map:tx,fog:false,side:$imports.THREE.DoubleSide}));
  }
  function person(g,x,z,col,s){ var f=(0,$imports.figMesh)('tall',mat(col),s||1); f.position.set(x,0,z); g.add(f); return f; }
  $imports.CUT_DEF.knife={dur:DUR,setup:function(d){
    d.hidden=[]; [$imports.GLR.roomMesh,$imports.GLR.outMesh].forEach(function(o){ if(o&&o.visible){ o.visible=false; d.hidden.push(o); } });
    d.st=[]; for(var i=0;i<4;i++){ var g=new $imports.THREE.Group(); g.position.x=i*40; (0,$imports.cutAdd)(g); d.st.push(g); }
    /* A：走廊，小刀，头顶的手 */
    var a=d.st[0]; box(a,6,0.05,6,0x24292a,0,0,0); box(a,6,3,0.1,0x3a4244,0,1.5,-2.5);
    d.blade=box(a,0.02,0.16,0.012,0xc9ced2,0.12,1.2,-0.55); d.grip=box(a,0.03,0.1,0.02,0x2a2522,0.12,1.08,-0.55);
    d.handA=box(a,0.16,0.05,0.2,0x1a1d20,0,1.85,-0.3);
    d.tallA=person(a,0,-1.2,0x0f1214,1);
    /* B：物品袋和登记单 */
    var b=d.st[1]; box(b,6,0.05,6,0x24292a,0,0,0); box(b,6,3,0.1,0x3a4244,0,1.5,-2.5); person(b,0,-1.1,0x0f1214,1);
    d.bag=box(b,0.22,0.3,0.03,0xdfe8ea,-0.25,1.25,-0.6,0.35); box(b,0.02,0.16,0.012,0xc9ced2,-0.25,1.25,-0.6);
    d.form=label(['管制刀具登记','姓名：（已填好）','班级：高二（二）班','处理：'],0.42,0.56); d.form.position.set(0.22,1.2,-0.55); b.add(d.form);
    /* C：门外的日光、盖章、柜子 */
    var c=d.st[2]; box(c,6,0.05,6,0x5a5448,0,0,0); box(c,6,3,0.1,0x8a8172,0,1.5,-2.5);
    d.sun=box(c,1.0,2.1,0.02,0xfff6dc,-1.2,1.05,-2.44); box(c,1.1,2.2,0.04,0x4a4036,-1.2,1.1,-2.47);
    d.locker=box(c,0.8,1.8,0.5,0x6d7472,1.0,0.9,-2.1); d.lockerDoor=box(c,0.78,1.76,0.03,0x7d8482,1.0,0.9,-1.83);
    d.stamp=box(c,0.08,0.08,0.08,0xa02424,0,1.35,-0.6); d.form2=label(['管制刀具登记','处理：留校'],0.42,0.3); d.form2.position.set(0,1.1,-0.6); d.form2.rotation.x=-1.2; c.add(d.form2);
    /* D：自己的座位 */
    var e=d.st[3]; box(e,8,0.05,8,0x3c3a35,0,0,0); box(e,8,3,0.1,0x55574f,0,1.5,-3);
    box(e,1.1,0.05,0.6,0x7a6748,0,0.76,0); d.drawer=box(e,0.9,0.12,0.5,0x5a4a36,0,0.62,0.02);
    box(e,0.3,0.03,0.4,0x3f6c8c,0.1,0.8,0.02); var f3=label(['姓名：　　　','留校'],0.3,0.2); f3.rotation.x=-Math.PI/2; f3.position.set(-0.22,0.787,0.05); e.add(f3);
    box(e,2.4,1.2,0.05,0x9fb3bd,1.5,1.7,-2.94);
    d.said={};
  },frame:function(k,d){
    var t=k*DUR, s=t<3?0:t<7?1:t<11?2:3;
    d.st.forEach(function(g,i){ g.visible=i===s; });
    if(s===0){ (0,$imports.cutLook)(0,1.5,0.15,0.05,1.25,-1); d.blade.position.y=1.12+0.1*Math.min(1,t/1.2); d.handA.position.y=1.85+0.04*Math.max(0,t-1.5);
      if(!d.said.a){ d.said.a=1; (0,$imports.os)('（压在头顶的手停住了。）',2.6,$imports.OS_FORCE); } }
    else if(s===1){ (0,$imports.cutLook)(40,1.45,0.6,40,1.25,-0.6); d.form.position.x=0.22+0.05*Math.sin(t);
      if(!d.said.b){ d.said.b=1; (0,$imports.os)('「管制刀具。」',3,$imports.OS_FORCE); } }
    else if(s===2){ var u=(t-7)/4; (0,$imports.cutLook)(80+0.2,1.6,0.8,80-0.2+0.8*u,1.1,-1.2);
      d.stamp.position.y=1.35-0.2*Math.max(0,Math.sin(Math.min(1,u*2)*Math.PI)); d.lockerDoor.position.z=-1.83+0.0*u;
      if(!d.said.c){ d.said.c=1; (0,$imports.os)('门外是正常的日光。登记单上盖了章，刀锁进了柜子。',3.6,$imports.OS_FORCE); } }
    else { var v=(t-11)/5; (0,$imports.cutLook)(120,1.25+0.2*v,0.9+0.3*v,120,0.75,0);
      if(!d.said.d){ d.said.d=1; (0,$imports.os)('上课铃响了。东西被收走了。你还在这里。',4,$imports.OS_FORCE); } }
    var edge=0; [3,7,11].forEach(function(x){ edge=Math.max(edge,Math.max(0,1-Math.abs(t-x)/0.25)); });
    (0,$imports.cutFade)(Math.max(edge,t>15.2?(t-15.2)/0.8:0));
  },clean:function(d){ (d.hidden||[]).forEach(function(o){ o.visible=true; }); }};
})();

/* @module-exports */
GameModules.publish("game3d/js/modules/knife/knife-cut.js",{

});
})(GameModules.imports("game3d/js/modules/knife/knife-cut.js"));
