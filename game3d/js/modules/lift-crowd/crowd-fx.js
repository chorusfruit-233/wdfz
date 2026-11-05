/* @module-capsule */
(function($imports){
/* 里世界 3D · 「满员」的画面和声音（内部，只读 crowd.js 的状态，不改玩法）
   - 轿门上方一块小显示屏：红字「满员」，满员期间一直亮着（化解后门一合上就撤）。
   - 灯：轿厢和这一层的灯一闪一闪（lightState 钩子压 ptK）；「减少闪光」时只是慢慢地暗下去、亮回来。
   - 声音：开头三声超载蜂鸣（event.liftOverload），再是身后很多人的呼吸（threat.crowd），化解或死了就停。 */
'use strict';

var LiftCrowdFx=(function(){
  var F={grp:null,key:'',t:0,phase:null}, own={owner:'lift-crowd'};
  var TEX=null;
  function tex(){
    if(TEX) return TEX;
    var cv=document.createElement('canvas'); cv.width=256; cv.height=96;
    var g=cv.getContext('2d');
    g.fillStyle='#070808'; g.fillRect(0,0,256,96);
    g.fillStyle='#ff4a2a'; g.textAlign='center'; g.textBaseline='middle';
    g.font='700 58px "Noto Sans SC","Noto Sans CJK SC","PingFang SC","Microsoft YaHei",sans-serif';
    g.shadowColor='#ff4a2a'; g.shadowBlur=10; g.fillText('满 员',128,50);
    TEX=new $imports.THREE.CanvasTexture(cv); TEX.colorSpace=$imports.THREE.SRGBColorSpace;
    return TEX;
  }
  function clear(){
    if(F.grp){ if(F.grp.parent) F.grp.parent.remove(F.grp); try{ $imports.ThreeBackend.disposeGroup(F.grp); }catch(e){} }
    F.grp=null; F.key='';
  }
  function stopSound(){ try{ $imports.SoundPlayer.stop('threat'); }catch(e){} }
  /* 显示屏摆在轿门上方、朝轿厢里面（电梯门格的局部坐标：a 朝走廊为正） */
  function build(c){
    var R=$imports.INTERIORS[c.host+c.floor]; if(!R||!$imports.GLR.scene) return;
    var f=$imports.Elevator.frame(R); if(!f) return;
    var w=$imports.Elevator.world(R,$imports.LIFT_GEO.inner-0.22,0), p=(0,$imports.worldToScene)(w.x,w.y,R);
    var m=new $imports.THREE.Mesh(new $imports.THREE.PlaneGeometry(0.26,0.1),new $imports.THREE.MeshBasicMaterial({map:tex(),toneMapped:false}));
    var back=new $imports.THREE.Mesh(new $imports.THREE.BoxGeometry(0.3,0.16,0.03),new $imports.THREE.MeshLambertMaterial({color:0x22272a}));
    back.position.set(0,0,-0.017); m.add(back);                          /* 吊在轿顶下面的一块显示屏：后面一块深色外壳顶到轿顶 */
    m.position.set(p.x,2.14,p.z); m.rotation.y=Math.atan2(-f.ox,-f.oy);
    F.grp=new $imports.THREE.Group(); F.grp.name='lift-crowd'; F.grp.add(m); $imports.GLR.scene.add(F.grp);
    F.key=c.host+c.floor+':'+$imports.S.room;
  }
  function frame(dt){
    var c=(typeof $imports.LiftCrowd!=='undefined')?$imports.LiftCrowd.state():null;
    var here=!!c&&$imports.S.mode==='in'&&$imports.S.room===c.host+c.floor&&!$imports.S.dead;
    var show=here&&(c.phase!=='gone'||$imports.Elevator.peek(c.host).door>0.05);
    if(!show){ if(F.grp) clear(); }
    else if(!F.grp||F.key!==c.host+c.floor+':'+$imports.S.room){ clear(); build(c); }
    var ph=c?c.phase:null;
    if(ph!==F.phase){
      if(ph==='full'&&!F.phase){ F.t=0; try{ $imports.SoundPlayer.play('event.liftOverload'); $imports.SoundPlayer.play('threat.crowd',{at:0.7}); }catch(e){} }
      if((!ph||ph==='gone')&&(F.phase==='full'||F.phase==='closing')) stopSound();
      F.phase=ph;
    }
    F.t+=dt||0;
    if(F.grp) F.grp.visible=!(F.t<0.5&&Math.floor(F.t*8)%2===1);       /* 刚跳成「满员」时闪两下 */
  }
  /* 灯：一闪一闪（不频闪：0.9 秒左右一次、每次 0.12 秒） */
  function light(st){
    var c=(typeof $imports.LiftCrowd!=='undefined')?$imports.LiftCrowd.state():null;
    if(!c||c.phase==='gone'||$imports.S.mode!=='in'||$imports.S.room!==c.host+c.floor) return;
    var t=c.age||0, k;
    if($imports.SET.reduceFlash) k=0.62+0.18*Math.cos(t*2.2);
    else{ var ph=(t*1.1)%1; k=(ph>0.82&&ph<0.95)?0.3:0.85; }
    st.ptK=(st.ptK===undefined?1:st.ptK)*k; st.steady=true;
  }
  GameModules.on('frame',frame,own);
  GameModules.on('clearWorld',clear,own);
  GameModules.on('lightState',light,own);
  GameModules.on('boundary',function(){ clear(); F.phase=null; },own);
  return {F:F, clear:clear, tex:tex};
})();

/* @module-exports */
GameModules.publish("game3d/js/modules/lift-crowd/crowd-fx.js",{
"LiftCrowdFx":{get:function(){return LiftCrowdFx;},set:function($value){LiftCrowdFx=$value;}}
});
})(GameModules.imports("game3d/js/modules/lift-crowd/crowd-fx.js"));
