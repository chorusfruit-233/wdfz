/* 里世界 3D · 异色空间里的人影
   暗房里站着几个黑影——和别处「远处的人影」（traces.js 的 APPAR）同一套模型、同一种黑：
     · 出口那头亮着的安全灯前一个、南墙亮着的安全灯前一个、出口旁边绿光里一个高出一截的：
       你没看着它们的时候，它们会转过来朝着你；
     · 电梯口附近那盏安全灯底下，一个面朝墙站着、头抵过去；
     · 你离开电梯口走远、背对着电梯口的时候，身后响起几步脚步声——回头看，半开的电梯门透出的冷光里站着一个。
   都站在一小片光的前面（安全灯照亮的墙、出口的绿光、半开的电梯门里的冷光），黑影才看得出来；摆在全黑的地方等于没有。
   走近、手电照它、或者盯着看一会儿，它就不在了（和远处人影同一套规矩）。
   只是吓人：没有碰撞、不挡路、不扣 SAN、不算异象、不进存档；每次进来重新摆一遍。
   这个房间里不再另出随机的远处人影（traces.js），免得叠在一起。 */
'use strict';

var DREAM_FIG_CFG={
  near:{person:4.2, tall:6.0},     /* 走到多近（米）就不见 */
  stare:1.3,                       /* 盯着看多久（秒）就不见 */
  followAway:6.0,                  /* 离电梯口多远（米）以后，身后那一个才会来 */
  followDelay:1.2                  /* 脚步声响过之后多久它站好（秒） */
};
/* c、r 是格子坐标（格子 n 的中心是 n+0.5）；都站在空地上，离墙、柱子至少半米。
   rot 只用 0（朝南，+z）或 π（朝北，−z）；lean 是往前倾 */
var DREAM_FIGS=[
  {id:'north',  c:13.6,  r:2.4,   kind:'person', turn:true},                                  /* 出口那头，北墙亮着的安全灯前（从半路看过去正好挡在亮墙前） */
  {id:'south',  c:8.6,   r:9.6,   kind:'person', turn:true},                                  /* 南墙亮着的安全灯前（从电梯口看过去正好挡在亮墙前） */
  {id:'tall',   c:16.35, r:7.6,   kind:'tall',   turn:true},                                  /* 出口旁边，绿光照着的墙前，高出一截 */
  {id:'wall',   c:4.45,  r:1.55,  kind:'person', turn:false, rot:Math.PI, lean:0.10, near:2.6, stare:2.6}   /* 电梯口附近的安全灯底下，面朝北墙，头抵过去 */
];
var DREAM_FOLLOW={id:'follow', c:1.6, r:5.5, kind:'person', turn:true, near:4.0, stare:1.0};    /* 电梯门前：你出来的地方 */
var DFIG={g:null, mat:null, room:null, items:[], follow:null};

function dreamFigWorld(R,d){ return {x:R.ox+d.c*R.tw, y:R.oy+d.r*R.th}; }
function dreamFigMake(R,d,visible){
  var grp=new THREE.Group(), w=dreamFigWorld(R,d), p=anfxW2S(w.x,w.y), cp=GLR.cam.position;
  anfxFigure(grp,DFIG.mat,0,0,1.0,false,d.kind);
  grp.position.set(p.x,0,p.z);
  grp.rotation.y=d.rot!==undefined?d.rot:Math.atan2(cp.x-p.x,cp.z-p.z);
  if(d.lean) grp.rotation.x=d.lean*Math.cos(grp.rotation.y);          /* 朝 +z 时正角往前倾，朝 −z 时反过来 */
  grp.visible=!!visible; grp.userData.dreamFig=d.id;
  DFIG.g.add(grp);
  return {d:d, g:grp, stare:0, gone:false, shown:!!visible, t:0, steps:false};
}
/* 每次进来重新摆一遍 */
function dreamFigReset(R){
  while(DFIG.g.children.length) DFIG.g.remove(DFIG.g.children[0]);     /* 几何体和材质是共用的，不释放 */
  DFIG.items=DREAM_FIGS.map(function(d){ return dreamFigMake(R,d,true); });
  DFIG.follow=dreamFigMake(R,DREAM_FOLLOW,false);
  DFIG.room=R;
}
function dreamFigHalfFov(){
  var c=GLR.cam; return Math.atan(Math.tan((c.fov||70)*Math.PI/360)*(c.aspect||1.6));
}
/* 看着它、离它多近：不见了返回 true */
function dreamFigWatch(it,dt){
  var hp=it.g.position, cp=GLR.cam.position, dx=hp.x-cp.x, dz=hp.z-cp.z, dist=Math.hypot(dx,dz);
  var look=angDiff(Math.atan2(dz,dx),S.ang);
  if(it.d.turn&&look>dreamFigHalfFov()+0.2) it.g.rotation.y=Math.atan2(cp.x-hp.x,cp.z-hp.z);   /* 没看着它的时候，它转过来朝着你 */
  if(look<0.12) it.stare+=dt; else it.stare=Math.max(0,it.stare-dt*0.5);
  var lit=typeof USE!=='undefined'&&USE.torch&&look<0.16&&dist<14;
  var near=it.d.near||DREAM_FIG_CFG.near[it.d.kind]||4.2, st=it.d.stare||DREAM_FIG_CFG.stare;
  if(dist<near||lit||it.stare>st){
    it.g.visible=false; it.gone=true;
    if(look<0.6){ try{ SFX.vanish(); }catch(e){} }
    return true;
  }
  return false;
}
function dreamFigTick(dt){
  var inDream=S.mode==='in'&&S.room==='lift_dream'&&S.screen==='play'&&!S.dead;
  if(!inDream){ if(DFIG.g) DFIG.g.visible=false; DFIG.room=null; return; }
  var R=INTERIORS.lift_dream;
  if(!DFIG.g){ DFIG.g=new THREE.Group(); DFIG.mat=new THREE.MeshBasicMaterial({color:0x030202,fog:true}); }
  if(DFIG.g.parent!==GLR.scene) GLR.scene.add(DFIG.g);
  if(DFIG.room!==R) dreamFigReset(R);
  DFIG.g.visible=true;
  if(PAUSE.on||UI.anyOpen()) return;                 /* 暂停、打开界面时：人还在，只是不动 */
  DFIG.items.forEach(function(it){ if(!it.gone) dreamFigWatch(it,dt); });
  /* 跟出来的那一个：你走远了、背对着电梯口，身后先响几步脚步声，过一会儿它才站好；你提前回头，这次就先不出来 */
  var f=DFIG.follow; if(!f||f.gone) return;
  if(f.shown){ dreamFigWatch(f,dt); return; }
  var w=dreamFigWorld(R,f.d), p=f.g.position, cp=GLR.cam.position;
  var dist=Math.hypot(p.x-cp.x,p.z-cp.z), look=angDiff(Math.atan2(p.z-cp.z,p.x-cp.x),S.ang);
  if(dist>DREAM_FIG_CFG.followAway&&look>dreamFigHalfFov()+0.35){
    if(!f.steps){ f.steps=true; try{ SFX.dread('steps',dreadPlace(w.x,w.y)); }catch(e){} }
    f.t+=dt;
    if(f.t>=DREAM_FIG_CFG.followDelay){
      f.shown=true; f.g.visible=true; f.stare=0;
      f.g.rotation.y=Math.atan2(cp.x-p.x,cp.z-p.z);
    }
  }else f.t=0;
}
