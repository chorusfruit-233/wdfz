/* @module-capsule */
(function($imports){
/* 里世界 3D · 公开真结局《外国语学生》（20 秒；计划第 10.2 节分镜）
   0–4   队尾的访客回头确认你还在，队伍穿过北校门。
   4–9   搜查员停在门内；门卫核对的是接待名单。门后的广播断成几截。
   9–15  门外是平常的颜色和声音，访客自然地聊天；有人把临时接待证递还给你。
   15–20 接待证上的学校名字有点陌生；你回头看了一眼，队伍轻声催你走。落标题。
   多语言／考核两种资格只在一句对白上不同。全部 MeshBasicMaterial，演出期间藏起当前场景。 */
'use strict';

(function(){
  var DUR=20;
  function mat(c){ return new $imports.THREE.MeshBasicMaterial({color:c,fog:false,side:$imports.THREE.DoubleSide}); }
  function box(g,w,h,d,c,x,y,z){ var m=new $imports.THREE.Mesh(new $imports.THREE.BoxGeometry(w,h,d),mat(c)); m.position.set(x,y,z); g.add(m); return m; }
  function fig(g,kind,c,x,z,ry){ var f=(0,$imports.figMesh)(kind,mat(c),1); f.position.set(x,0,z); f.rotation.y=ry||0; g.add(f); return f; }
  function card(lines){
    var cv=document.createElement('canvas'); cv.width=256; cv.height=160; var g=cv.getContext('2d');
    g.fillStyle='#f4f1e6'; g.fillRect(0,0,256,160); g.fillStyle='#2a3a52'; g.fillRect(0,0,256,30);
    g.fillStyle='#fff'; g.font='700 17px sans-serif'; g.fillText(lines[0],12,21); g.fillStyle='#222'; g.font='500 16px '+(typeof $imports.SIGN_FONT!=='undefined'?$imports.SIGN_FONT:'sans-serif');
    lines.slice(1).forEach(function(t,i){ g.fillText(t,12,62+i*30); });
    var t=new $imports.THREE.CanvasTexture(cv); t.colorSpace=$imports.THREE.SRGBColorSpace;
    return new $imports.THREE.Mesh(new $imports.THREE.PlaneGeometry(0.34,0.21),new $imports.THREE.MeshBasicMaterial({map:t,fog:false,side:$imports.THREE.DoubleSide}));
  }
  var COAT=[0x3a4a6a,0x7a5a3a,0x5a6a4a,0x8a6a6a];
  $imports.CUT_DEF.international={dur:DUR,setup:function(d){
    d.hidden=[]; [$imports.GLR.roomMesh,$imports.GLR.outMesh].forEach(function(o){ if(o&&o.visible){ o.visible=false; d.hidden.push(o); } });
    d.st=[]; for(var i=0;i<4;i++){ var g=new $imports.THREE.Group(); g.position.x=i*60; (0,$imports.cutAdd)(g); d.st.push(g); }
    /* A／B：校门（两根门柱、门禁），校内灰，门外亮 */
    [0,1].forEach(function(k){ var g=d.st[k];
      box(g,30,0.05,30,0x3b3e3a,0,0,0); box(g,0.6,3.2,0.6,0x6d6a62,-2.4,1.6,0); box(g,0.6,3.2,0.6,0x6d6a62,2.4,1.6,0); box(g,5.4,0.4,0.6,0x6d6a62,0,3.2,0);
      box(g,30,0.04,14,0x8a8d7c,0,0.01,-8); });
    var a=d.st[0]; d.walk=[]; for(i=0;i<4;i++) d.walk.push(fig(a,'person',COAT[i],0.5-(i%2),2+i*1.2,Math.PI));
    var b=d.st[1]; d.guard=fig(b,'person',0x2e3b4a,3.0,-0.6,-Math.PI/2); d.searchB=[fig(b,'tall',0x1e2226,-1.2,4.5,Math.PI),fig(b,'tall',0x1e2226,1.4,5.2,Math.PI)];
    d.list=card(['接待名单','国际交流团 · 4 人','接待学生 · 1 人']); d.list.position.set(2.6,1.2,-0.5); d.list.rotation.y=-0.4; b.add(d.list);
    /* C：门外的街 */
    var c=d.st[2]; box(c,30,0.05,30,0x7a776c,0,0,0); box(c,30,6,0.2,0xb8c4c8,0,3,-10);
    for(i=0;i<4;i++) fig(c,'person',COAT[i],-1.6+i*1.0,-2-(i%2)*0.6,Math.PI*(i%2?0.8:1.2));
    d.pass=card(['临时接待证','高二（二）班','有效期：今天']); d.pass.position.set(0.1,1.25,-0.9); c.add(d.pass);
    /* D：接待证特写，学校名字有点陌生 */
    var e=d.st[3]; box(e,30,0.05,30,0x7a776c,0,0,0); box(e,30,6,0.2,0xb8c4c8,0,3,-10);
    d.pass2=card(['临时接待证','武大附属外国语学校','高二（二）班']); d.pass2.position.set(0,1.3,-0.5); d.pass2.scale.setScalar(1.6); e.add(d.pass2);
    d.said={}; d.how=($imports.RT.exchange&&$imports.RT.exchange.how)||'exam';
  },frame:function(k,d){
    var t=k*DUR, s=t<4?0:t<9?1:t<15?2:3;
    d.st.forEach(function(g,i){ g.visible=i===s; });
    if(s===0){ var u=t/4; d.walk.forEach(function(f,i){ f.position.z=2+i*1.2-u*6; }); d.walk[3].rotation.y=Math.PI+(t>1&&t<2.4?Math.PI:0);
      (0,$imports.cutLook)(0.6,1.6,7.5-u*3,0,1.2,-3);
      if(!d.said.a){ d.said.a=1; (0,$imports.os)(d.how==='multilingual'?'「Alle da?」——「On est tous là.」队尾的人回头看了我一眼。':'队尾的人回头看了我一眼，确认我还在。',3.6,$imports.OS_FORCE); } }
    else if(s===1){ (0,$imports.cutLook)(60-0.8,1.5,-3.2,60+0.2,1.3,3); d.list.rotation.y=-0.4+0.1*Math.sin(t*2);
      if(!d.said.b){ d.said.b=1; (0,$imports.os)('门卫对着名单点了点头。门里的两个搜查员停住了，没有再往前走。',4,$imports.OS_FORCE); } }
    else if(s===2){ var v=(t-9)/6; (0,$imports.cutLook)(120+0.3,1.5,1.4-v*0.6,120,1.2,-1.5); d.pass.position.z=-0.9+0.5*Math.min(1,v*1.5);
      if(!d.said.c){ d.said.c=1; (0,$imports.os)('门外的声音很平常。有人把临时接待证递还给我：「Danke.」「Merci.」',4.4,$imports.OS_FORCE); } }
    else { (0,$imports.cutLook)(180,1.45,0.3,180,1.3,-0.5);
      if(!d.said.d){ d.said.d=1; (0,$imports.os)('接待证上的学校名字，好像和我记得的不太一样。队伍在前面轻声叫我。',4.4,$imports.OS_FORCE); } }
    var edge=0; [4,9,15].forEach(function(x){ edge=Math.max(edge,Math.max(0,1-Math.abs(t-x)/0.25)); });
    (0,$imports.cutFade)(Math.max(edge,t>19.2?(t-19.2)/0.8:0));
  },clean:function(d){ (d.hidden||[]).forEach(function(o){ o.visible=true; }); }};
  if(typeof $imports.ENDINGS!=='undefined'&&!$imports.ENDINGS.international)
    $imports.ENDINGS.international={t:'《外国语学生》',true:1,l:['队尾的人回头看了一眼，确认你还在。','门卫核对的是接待名单。搜查员停在门里，没有再往前走。','门外的颜色和声音都很平常。有人把临时接待证递还给你。','证上的学校名字，好像和你记得的不太一样。']};
})();

/* @module-exports */
GameModules.publish("game3d/js/modules/exchange/exchange-cut.js",{

});
})(GameModules.imports("game3d/js/modules/exchange/exchange-cut.js"));
