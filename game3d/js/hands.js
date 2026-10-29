/* 里世界 3D · 手里拿着的东西
   打开手电、撑开雨伞、点亮手机时，画面下方能看见自己的手和手里的东西：
     雨伞 —— 左手（伞面在头顶上）
     手电 —— 右手
     手机 —— 哪只手空着就拿在哪只（都占着就揣回兜里，屏幕光照旧）
   模型挂在相机上，走路时跟着轻轻晃。 */
'use strict';

var HANDS={built:false,L:null,R:null,items:{}};
function handMat(col,basic){ return basic?new THREE.MeshBasicMaterial({color:col,fog:false}):new THREE.MeshLambertMaterial({color:col}); }
/* 一只手：校服袖子、袖口、手腕、手掌，四根手指握成拳（绕着手里那根东西：手电筒身沿局部 z 轴），拇指从下面扣住。
   一只手是一个几何体（顶点色），平滑着色。从画面下沿伸进来 */
var HAND_GEO={};
/* 顶点色不走颜色管理（材质的 color 会从 sRGB 换成线性）：先换好，和以前用 color 的手一样深浅 */
function linHex(h){ var c=new THREE.Color(h); return (Math.round(c.r*255)<<16)|(Math.round(c.g*255)<<8)|Math.round(c.b*255); }
function handGeo(side){
  if(HAND_GEO[side]) return HAND_GEO[side];
  var K=new Kit(), m='plastic', skin=linHex(0xd9b49a), skin2=linHex(0xcfa88e), k;
  K.rod(m,0,-0.004,0.37,0,0,-0.04,0.060,0.053,14,linHex(0x1c2a3a),1.0);                  /* 袖子 */
  K.rod(m,0,0,-0.035,0,0,-0.068,0.055,0.055,14,linHex(0xd8dde0),1.0);                     /* 袖口 */
  K.rod(m,-side*0.012,-0.006,-0.05,-side*0.028,-0.008,-0.085,0.030,0.026,10,skin,1.0);     /* 手腕 */
  K.blob(m,-side*0.034,-0.006,-0.112,0.022,0.042,0.048,skin,1.0,10);                     /* 手掌：贴在里侧 */
  for(k=0;k<4;k++){                                                                       /* 四根手指：从掌心上沿绕过顶、扣到外侧 */
    var z=-0.078-k*0.022, r=0.0105-k*0.0008, len=1-k*0.08;
    var p0=[-side*0.030,0.030,z], p1=[0,0.040*len+0.004,z-0.004], p2=[side*0.036*len,0.018,z-0.006], p3=[side*0.030*len,-0.016,z-0.006];
    K.rod(m,p0[0],p0[1],p0[2],p1[0],p1[1],p1[2],r,r*0.95,8,skin,1.0);
    K.rod(m,p1[0],p1[1],p1[2],p2[0],p2[1],p2[2],r*0.95,r*0.88,8,skin,1.0);
    K.rod(m,p2[0],p2[1],p2[2],p3[0],p3[1],p3[2],r*0.88,r*0.8,8,skin2,1.0);
    K.blob(m,p1[0],p1[1],p1[2],r*1.05,r*1.05,r*1.05,skin,1.0,7);                         /* 指节 */
  }
  K.rod(m,-side*0.036,-0.030,-0.075,-side*0.004,-0.044,-0.090,0.0125,0.012,8,skin,1.0);  /* 拇指：从下面扣住 */
  K.rod(m,-side*0.004,-0.044,-0.090,side*0.022,-0.034,-0.104,0.012,0.010,8,skin2,1.0);
  HAND_GEO[side]=K.mergedGeometry();
  return HAND_GEO[side];
}
function handArm(side){
  var g=new THREE.Group();
  g.add(new THREE.Mesh(handGeo(side),new THREE.MeshLambertMaterial({vertexColors:true})));
  g.position.set(side*0.26,-0.27,-0.42);
  g.rotation.set(0.08,-side*0.18,0);
  return g;
}
function buildHands(){
  if(HANDS.built||!GLR.cam) return;
  HANDS.built=true;
  HANDS.L=handArm(-1); HANDS.R=handArm(1);
  /* 手电：握在掌心，往前伸 */
  var torch=new THREE.Group();
  /* 手电筒身：一个旋转体（尾盖、防滑纹的握把、往前张开的灯头），沿 -z 朝前 */
  var TK=new Kit(), tp=[[0.0,0],[0.020,0],[0.023,0.008],[0.023,0.03]], q;
  for(q=0;q<6;q++) tp.push([0.0235,0.04+q*0.022],[0.0215,0.051+q*0.022]);              /* 握把上的一圈圈防滑纹 */
  tp.push([0.022,0.175],[0.026,0.195],[0.036,0.225],[0.037,0.245],[0.031,0.246]);
  TK.lathe('metal',0,0,0,tp,16,linHex(0x2a2e33),1.0);
  TK.box('metal',0.022,0.12,0,0.006,0.018,0.01,linHex(0x8a2a22),1.2);                             /* 开关 */
  var tb=new THREE.Mesh(TK.mergedGeometry(),new THREE.MeshLambertMaterial({vertexColors:true}));
  tb.rotation.x=-PI/2; tb.position.z=-0.03; torch.add(tb);
  var tl=new THREE.Mesh(new THREE.CircleGeometry(0.03,12),handMat(0xfff2c8,true)); tl.position.z=-0.276; tl.rotation.y=PI; torch.add(tl);
  torch.userData.lens=tl;
  /* 手机：竖着拿，屏幕朝自己 */
  var phone=new THREE.Group();
  var pb=new THREE.Mesh(new THREE.BoxGeometry(0.068,0.13,0.008),handMat(0x101214)); phone.add(pb);
  var ps=new THREE.Mesh(new THREE.PlaneGeometry(0.06,0.118),handMat(0x9fd0e8,true)); ps.position.z=0.0045; phone.add(ps);
  phone.position.set(0,0.06,-0.13); phone.rotation.x=-0.5;
  phone.userData.screen=ps;
  /* 雨伞：伞柄从左手往上，伞面在头顶 */
  var brolly=new THREE.Group();
  var shaft=new THREE.Mesh(new THREE.CylinderGeometry(0.009,0.009,0.9,6),handMat(0x3a3a3a)); shaft.position.set(0,0.45,-0.12); brolly.add(shaft);
  var hook=new THREE.Mesh(new THREE.TorusGeometry(0.035,0.01,6,10,PI),handMat(0x2a1a12)); hook.position.set(0.035,0,-0.12); hook.rotation.z=PI; brolly.add(hook);
  var canopy=new THREE.Mesh(new THREE.ConeGeometry(0.62,0.26,10,1,true),new THREE.MeshLambertMaterial({color:0x14202e,side:THREE.DoubleSide}));
  canopy.position.set(0,0.98,-0.12); brolly.add(canopy);
  brolly.rotation.set(-0.42,0,-0.12);                    /* 往前、往里倾：抬头能看见伞沿 */
  HANDS.items={torch:torch,phone:phone,brolly:brolly};
  /* 手单独放一个场景，渲染层独立绘制再合成（engine/scene.js）：贴着墙也不会被截断。
     灯光照着主场景的环境光、天光、身边的补光每帧抄一份。 */
  var hs=new THREE.Scene(), root=new THREE.Group();
  root.matrixAutoUpdate=false; root.visible=false; root.userData.overlay=true;
  HANDS.amb=new THREE.AmbientLight(0xffffff,0); HANDS.hemi=new THREE.HemisphereLight(0xffffff,0x000000,0);
  HANDS.near=new THREE.PointLight(0xffffff,0,3,1.5); HANDS.near.position.set(0.1,0.25,0.1);
  hs.add(HANDS.amb); hs.add(HANDS.hemi); root.add(HANDS.near); hs.add(root);
  GLR.handScene=hs; GLR.handRoot=root;
  [HANDS.L,HANDS.R].forEach(function(h){ h.visible=false; root.add(h); });
}
function handHold(hand,item){
  var it=HANDS.items[item]; if(!it) return;
  if(it.parent!==hand){ if(it.parent) it.parent.remove(it); hand.add(it); }
  it.visible=true;
}
function handsTick(dt){
  if(!GLR.cam) return;
  buildHands();
  var show=S.screen==='play'&&!S.dead&&!(typeof HIDE!=='undefined'&&HIDE.on)&&!(typeof CUT!=='undefined'&&CUT.on);
  var torchOn=show&&USE.torch&&hasItem('torch'), brollyOn=show&&USE.brollyShield&&hasItem('brolly'), phoneOn=show&&typeof PHONE!=='undefined'&&PHONE.on;       /* 手机只在玩小游戏时拿在手上 */
  var it=HANDS.items, leftUse=null, rightUse=null;
  if(brollyOn) leftUse='brolly';
  if(torchOn) rightUse='torch';
  if(phoneOn){ if(!leftUse) leftUse='phone'; else if(!rightUse) rightUse='phone'; }
  for(var k in it) it[k].visible=false;
  HANDS.L.visible=!!leftUse; HANDS.R.visible=!!rightUse;
  GLR.handRoot.visible=!!(leftUse||rightUse);
  if(GLR.handRoot.visible){
    HANDS.amb.color.copy(GLR.amb.color); HANDS.amb.intensity=GLR.amb.intensity;
    HANDS.hemi.color.copy(GLR.hemi.color); HANDS.hemi.groundColor.copy(GLR.hemi.groundColor); HANDS.hemi.intensity=GLR.hemi.intensity;
    HANDS.near.color.copy(GLR.camLight.color); HANDS.near.intensity=GLR.camLight.intensity*0.6+(USE.torch?0.8:0);
  }
  if(leftUse) handHold(HANDS.L,leftUse);
  if(rightUse) handHold(HANDS.R,rightUse);
  /* 走路时轻轻晃，跑起来晃得大一点 */
  var ph=S.walkPhase||0, amp=S.moving?(S.run?0.018:0.009):0.002;
  HANDS.L.position.set(-0.26+Math.sin(ph)*amp,-0.27+Math.abs(Math.cos(ph))*amp,-0.42);
  HANDS.R.position.set(0.26+Math.sin(ph+1)*amp,-0.27+Math.abs(Math.cos(ph+1))*amp,-0.42);
  if(it.torch.userData.lens) it.torch.userData.lens.material.color.setHex(USE.torch?0xfff2c8:0x30343a);
}
