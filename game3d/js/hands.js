/* 里世界 3D · 手里拿着的东西
   打开手电、撑开雨伞、点亮手机时，画面下方能看见自己的手和手里的东西：
     雨伞 —— 左手（伞面在头顶上）
     手电 —— 右手
     手机 —— 哪只手空着就拿在哪只（都占着就揣回兜里，屏幕光照旧）
   模型挂在相机上，走路时跟着轻轻晃。 */
'use strict';

var HANDS={built:false,L:null,R:null,items:{}};
function handMat(col,basic){ return basic?new THREE.MeshBasicMaterial({color:col,fog:false}):new THREE.MeshLambertMaterial({color:col}); }
/* 一只手：袖子 + 手掌（从画面下沿伸进来） */
function handArm(side){
  var g=new THREE.Group();
  var sleeve=new THREE.Mesh(new THREE.CylinderGeometry(0.052,0.06,0.42,8),handMat(0x1c2a3a));
  sleeve.rotation.x=PI/2; sleeve.position.set(0,0,0.16); g.add(sleeve);
  var cuff=new THREE.Mesh(new THREE.CylinderGeometry(0.054,0.054,0.03,8),handMat(0xd8dde0));
  cuff.rotation.x=PI/2; cuff.position.set(0,0,-0.055); g.add(cuff);
  var palm=new THREE.Mesh(new THREE.BoxGeometry(0.075,0.05,0.1),handMat(0xd9b49a));
  palm.position.set(0,0,-0.11); g.add(palm);
  var thumb=new THREE.Mesh(new THREE.BoxGeometry(0.022,0.022,0.06),handMat(0xd2ab90));
  thumb.position.set(-side*0.045,0.018,-0.12); thumb.rotation.y=side*0.5; g.add(thumb);
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
  var tb=new THREE.Mesh(new THREE.CylinderGeometry(0.022,0.024,0.2,10),handMat(0x2a2e33)); tb.rotation.x=PI/2; tb.position.z=-0.13; torch.add(tb);
  var th=new THREE.Mesh(new THREE.CylinderGeometry(0.036,0.026,0.05,12),handMat(0x3a3f44)); th.rotation.x=PI/2; th.position.z=-0.25; torch.add(th);
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
  [HANDS.L,HANDS.R].forEach(function(h){ h.visible=false; GLR.cam.add(h); h.traverse(function(o){ o.renderOrder=20; }); });
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
  var torchOn=show&&USE.torch&&hasItem('torch'), brollyOn=show&&USE.brollyShield&&hasItem('brolly'), phoneOn=show&&USE.phone&&hasItem('phone');
  var it=HANDS.items, leftUse=null, rightUse=null;
  if(brollyOn) leftUse='brolly';
  if(torchOn) rightUse='torch';
  if(phoneOn){ if(!leftUse) leftUse='phone'; else if(!rightUse) rightUse='phone'; }
  for(var k in it) it[k].visible=false;
  HANDS.L.visible=!!leftUse; HANDS.R.visible=!!rightUse;
  if(leftUse) handHold(HANDS.L,leftUse);
  if(rightUse) handHold(HANDS.R,rightUse);
  /* 走路时轻轻晃，跑起来晃得大一点 */
  var ph=S.walkPhase||0, amp=S.moving?(S.run?0.018:0.009):0.002;
  HANDS.L.position.set(-0.26+Math.sin(ph)*amp,-0.27+Math.abs(Math.cos(ph))*amp,-0.42);
  HANDS.R.position.set(0.26+Math.sin(ph+1)*amp,-0.27+Math.abs(Math.cos(ph+1))*amp,-0.42);
  if(it.torch.userData.lens) it.torch.userData.lens.material.color.setHex(USE.torch?0xfff2c8:0x30343a);
}
