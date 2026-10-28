/* 里世界 3D · 拍肩的另一种：身后那张笑脸
   behind —— 你回头了：它就在一米多外，弯着眼睛冲你笑，点一下头就淡掉；
   jump   —— 你没回头：它绕到你面前，一下子贴到鼻尖（突脸）。
   独立于异象特效组，异象结束后还会把这一段演完。 */
'use strict';

var SMILE={grp:null,t:0,mode:null,dur:0};
function smileClear(){ if(SMILE.grp){ GLR.scene.remove(SMILE.grp); SMILE.grp=null; } SMILE.mode=null; }
function smileShow(mode){
  smileClear();
  var cam=GLR.cam, dir={x:Math.cos(S.ang),z:Math.sin(S.ang)};   /* 按朝向算，不读相机矩阵：刚转过身时矩阵还没更新 */
  var g=new THREE.Group(), face=fxMesh('smile');
  g.add(face); g.userData.face=face;
  var d=mode==='jump'?1.0:1.7;
  g.position.set(cam.position.x+dir.x*d, cam.position.y-1.72, cam.position.z+dir.z*d);
  g.rotation.set(0,Math.atan2(cam.position.x-g.position.x,cam.position.z-g.position.z),0);   /* 正对镜头（lookAt 正后方时会给出翻转的欧拉角） */
  SMILE.grp=g; SMILE.t=0; SMILE.mode=mode; SMILE.dur=mode==='jump'?1.3:2.0;
  GLR.scene.add(g);
  if(mode==='jump'){ GLR.flash=Math.max(GLR.flash||0,0.7); GLR.hurt=Math.max(GLR.hurt||0,0.6); }
  try{ SFX.smile&&SFX.smile(mode); }catch(e){}
}
function smileTick(dt){
  if(!SMILE.grp) return;
  SMILE.t+=dt;
  var t=SMILE.t, g=SMILE.grp, k=t/SMILE.dur;
  if(SMILE.mode==='jump'){
    var s=Math.min(1,t/0.18);                                   /* 0.18 秒内一下子撑满视野 */
    g.scale.setScalar(0.3+0.62*s);
    g.position.y=GLR.cam.position.y-1.72*g.scale.y+(Math.random()-0.5)*0.03;
  }else{
    g.scale.setScalar(1);
    g.userData.face.rotation.x=Math.sin(Math.min(1,t/0.9)*Math.PI)*0.12;   /* 点一下头 */
    g.userData.face.visible=k<0.55||Math.sin(t*60)>0;          /* 淡掉之前闪两下 */
  }
  if(k>=1) smileClear();
}
