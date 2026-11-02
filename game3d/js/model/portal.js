/* 里世界 3D · 传送门实体模型（《传送门建模、死亡CG档案室与速通模式》P0）
   一台用旧实验器材临时拼起来的装置，放在物理实验室（实验楼 1F）的教师演示台上：
     基座   —— 钢板底座、四只支脚、两根立柱和夹具，底座下拖着一束线缆；没组装时也看得见。
     材料   —— 铜线圈（能看出一圈圈绕线）绕在主环上；透镜装在环顶的黄铜镜座里；荧光试剂瓶夹在左立柱；
               电池架在右侧底座上，红黑两根线接到环上。四样和收集规则一一对应：没装上时只剩空的卡槽。
     成形环 —— 外圈钢环、内圈导轨，三段能量导轨充能时一段段闭合。
     门内   —— 三层：最深处的暗紫、转动的流光、最前面一层波纹；有前后的深度，不是一张发白的平面。
   状态：base（只有基座和空卡槽）→ ready（图纸齐了，卡槽上的指示灯亮）→ charge（装上材料、充能、导轨闭合，k 0–1）
        → open（门开着）→ enter（走进去时整圈发亮）。实验室常驻的这台按 RT 状态走；结局演出新建同一个模型的实例按进度走。
   五档画质只改分段数和门内的层数，尺寸、位置和交互判定都一样。整台都在演示台的台面范围内，不新增碰撞。 */
'use strict';

var PORTAL_DIM={R:0.62, tube:0.035, rail:0.53, base:{w:1.10,d:0.50,h:0.05}, top:0.935};   /* top：演示台台面高度（实测 0.93 米） */
var PORTAL_MAT=null, PORTAL_TEX=null;
function portalMats(){
  if(PORTAL_MAT) return PORTAL_MAT;
  /* 实验室很暗：金属带一点自发光，没通电时也认得出轮廓 */
  function lam(c,e){ var m=new THREE.MeshLambertMaterial({color:c,emissive:e===undefined?0x101214:e}); m.userData.shared=true; return m; }
  function bas(c,o){ var m=new THREE.MeshBasicMaterial(Object.assign({color:c,fog:true},o||{})); m.userData.shared=true; return m; }
  PORTAL_MAT={steel:lam(0x7d858d,0x1a1d21), dark:lam(0x3e444a), copper:lam(0xb4703a,0x24140a), brass:lam(0xb39246,0x241c0a), rubber:lam(0x1b1d1f,0x050505),
    red:lam(0x9a2a24), black:lam(0x161616), glass:bas(0xcfe8ef,{transparent:true,opacity:0.35,depthWrite:false}),
    lens:bas(0xbfe7ff,{transparent:true,opacity:0.55,depthWrite:false})};
  return PORTAL_MAT;
}
/* 门内的流光：一张画好的圆形贴图（同一局只画一次） */
function portalTex(){
  if(PORTAL_TEX) return PORTAL_TEX;
  var W=256, cv=document.createElement('canvas'); cv.width=W; cv.height=W;
  var g=cv.getContext('2d'), c=W/2, i;
  var rg=g.createRadialGradient(c,c,4,c,c,c);
  rg.addColorStop(0,'rgba(255,240,210,1)'); rg.addColorStop(0.25,'rgba(120,220,255,0.9)');
  rg.addColorStop(0.6,'rgba(90,60,200,0.7)'); rg.addColorStop(1,'rgba(20,10,40,0)');
  g.fillStyle=rg; g.fillRect(0,0,W,W);
  g.globalCompositeOperation='lighter';
  for(i=0;i<9;i++){                                              /* 螺旋状的几道亮带 */
    g.strokeStyle='rgba(180,240,255,0.18)'; g.lineWidth=6;
    g.beginPath();
    for(var t=0;t<=1;t+=0.02){ var a=i/9*Math.PI*2+t*4.2, r=t*c*0.95; g.lineTo(c+Math.cos(a)*r,c+Math.sin(a)*r); }
    g.stroke();
  }
  PORTAL_TEX=new THREE.CanvasTexture(cv); PORTAL_TEX.userData={shared:true};
  return PORTAL_TEX;
}
/* 铜线圈：沿主环绕的螺旋线（看得出一圈圈） */
function portalCoilGeo(turns,seg){
  var R=PORTAL_DIM.R-0.005, r=0.05;
  var curve=new THREE.Curve();
  curve.getPoint=function(t,out){
    out=out||new THREE.Vector3();
    var a=Math.PI*0.18+t*Math.PI*1.64, b=t*turns*Math.PI*2;          /* 只绕下面大半圈：顶上留给透镜 */
    return out.set((R+r*Math.cos(b))*Math.cos(a),(R+r*Math.cos(b))*Math.sin(a),r*Math.sin(b));
  };
  return new THREE.TubeGeometry(curve,seg,0.0065,4,false);
}

/* 造一台：返回 {group, setState(state,k), tick(dt)} */
function portalBuild(){
  var M=portalMats(), D=PORTAL_DIM, q=Quality.get(), seg=Math.max(16,Math.round(40*(q.segments||1))), low=(q.segments||1)<0.75;
  var g=new THREE.Group(), P={group:g, state:'base', k:0, t:0, parts:{}, sockets:{}, rails:[], layers:[], lights:[]};
  function add(geo,mat,x,y,z,parent){ var m=new THREE.Mesh(geo,mat); m.position.set(x||0,y||0,z||0); (parent||g).add(m); return m; }
  var by=D.top;                                                  /* 台面高度：底座放在演示台上 */
  /* ---- 基座 ---- */
  add(new THREE.BoxGeometry(D.base.w,D.base.h,D.base.d),M.steel,0,by+D.base.h/2,0);
  add(new THREE.BoxGeometry(D.base.w-0.08,0.012,D.base.d-0.08),M.dark,0,by+D.base.h+0.006,0);
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function(s){
    add(new THREE.CylinderGeometry(0.03,0.035,0.02,8),M.rubber,s[0]*(D.base.w/2-0.06),by+0.01-0.005,s[1]*(D.base.d/2-0.06));
  });
  var ringY=by+D.base.h+0.06+D.R;                                /* 环心高度 */
  P.ringY=ringY;
  [-1,1].forEach(function(s){                                    /* 两根立柱和夹具 */
    add(new THREE.BoxGeometry(0.05,ringY-by-0.05,0.05),M.steel,s*(D.R+0.04),by+D.base.h+(ringY-by-D.base.h)/2,0);
    add(new THREE.BoxGeometry(0.09,0.07,0.08),M.dark,s*(D.R+0.02),ringY,0);
    add(new THREE.CylinderGeometry(0.012,0.012,0.1,6),M.brass,s*(D.R+0.02),ringY,0).rotation.x=Math.PI/2;
  });
  /* 线缆：从底座后沿垂下去，拖到台边 */
  var cab=new THREE.CatmullRomCurve3([new THREE.Vector3(-0.3,by+0.05,-0.2),new THREE.Vector3(-0.4,by+0.02,-0.3),new THREE.Vector3(-0.55,by-0.1,-0.36),new THREE.Vector3(-0.6,by-0.5,-0.36)]);
  add(new THREE.TubeGeometry(cab,low?8:16,0.012,5,false),M.rubber,0,0,0);
  /* ---- 成形环：外圈钢环、内圈导轨 ---- */
  var ring=new THREE.Group(); ring.position.set(0,ringY,0); g.add(ring); P.ring=ring;
  add(new THREE.TorusGeometry(D.R,D.tube,low?6:10,seg*2),M.steel,0,0,0,ring);
  add(new THREE.TorusGeometry(D.R+0.045,0.01,4,seg*2),M.dark,0,0,-0.03,ring);
  for(var i=0;i<8;i++){                                           /* 一圈固定件 */
    var a=i/8*Math.PI*2, f=add(new THREE.BoxGeometry(0.05,0.03,0.09),M.dark,Math.cos(a)*D.R,Math.sin(a)*D.R,0,ring); f.rotation.z=a;
  }
  /* 三段能量导轨（充能时一段段闭合） */
  for(i=0;i<3;i++){
    var rm=new THREE.MeshBasicMaterial({color:0x7fe8ff,fog:true,transparent:true,opacity:0.9});
    var rail=add(new THREE.TorusGeometry(D.rail,0.012,4,seg,Math.PI*2/3*0.92),rm,0,0,0.01,ring);
    rail.rotation.z=i*Math.PI*2/3+0.05; rail.userData.baseRot=rail.rotation.z; rail.visible=false; P.rails.push(rail);
  }
  /* ---- 材料和空卡槽 ---- */
  P.coilMat=new THREE.MeshLambertMaterial({color:0xb4703a,emissive:0x000000});      /* 每台一份：通电时慢慢发热发亮 */
  var coil=add(portalCoilGeo(low?36:72,low?260:520),P.coilMat,0,0,0,ring); P.parts.coil=coil;
  var lensG=new THREE.Group(); lensG.position.set(0,D.R+0.07,0.0); ring.add(lensG); P.parts.lens=lensG;
  add(new THREE.TorusGeometry(0.1,0.018,6,seg),M.brass,0,0,0,lensG);
  var lensDisc=add(new THREE.CylinderGeometry(0.095,0.095,0.03,seg),M.lens,0,0,0,lensG); lensDisc.rotation.x=Math.PI/2;
  var vialG=new THREE.Group(); vialG.position.set(-(D.R+0.12),ringY-0.18,0.06); g.add(vialG); P.parts.vial=vialG;
  add(new THREE.CylinderGeometry(0.032,0.032,0.18,12),M.glass,0,0,0,vialG);
  var liquid=add(new THREE.CylinderGeometry(0.027,0.027,0.11,12),new THREE.MeshBasicMaterial({color:0x6dffb0,fog:true}),0,-0.03,0,vialG);
  add(new THREE.CylinderGeometry(0.036,0.036,0.03,12),M.black,0,0.1,0,vialG);
  add(new THREE.BoxGeometry(0.05,0.03,0.06),M.dark,0.03,0,0,vialG);                 /* 夹子 */
  P.liquid=liquid;
  var batG=new THREE.Group(); batG.position.set(D.R+0.02,by+D.base.h+0.09,0.12); g.add(batG); P.parts.battery=batG;
  add(new THREE.BoxGeometry(0.16,0.18,0.09),M.black,0,0,0,batG);
  add(new THREE.BoxGeometry(0.16,0.03,0.092),M.red,0,0.06,0,batG);
  add(new THREE.CylinderGeometry(0.012,0.012,0.03,6),M.red,-0.04,0.105,0,batG);
  add(new THREE.CylinderGeometry(0.012,0.012,0.03,6),M.black,0.04,0.105,0,batG);
  [[-0.04,M.red],[0.04,M.black]].forEach(function(w){
    var c=new THREE.CatmullRomCurve3([new THREE.Vector3(w[0],0.12,0),new THREE.Vector3(w[0]-0.05,0.22,-0.02),new THREE.Vector3(-0.12,0.3,-0.03),new THREE.Vector3(-0.17,0.36,0)]);
    add(new THREE.TubeGeometry(c,low?6:12,0.007,4,false),w[1],0,0,0,batG);
  });
  /* 空卡槽：没装上的材料位置留一个暗的托架；图纸齐了以后亮一盏小灯 */
  function socket(id,x,y,z,parent){
    var s=new THREE.Group(); s.position.set(x,y,z); (parent||g).add(s);
    add(new THREE.BoxGeometry(0.1,0.025,0.08),M.dark,0,0,0,s);
    var led=add(new THREE.SphereGeometry(0.012,6,4),new THREE.MeshBasicMaterial({color:0x332211,fog:true}),0.035,0.02,0.035,s);
    s.userData.led=led; P.sockets[id]=s; return s;
  }
  socket('coil',0,-D.R-0.02,0.07,ring);
  socket('lens',0,D.R+0.02,0.07,ring);
  socket('vial',-(D.R+0.12),ringY-0.28,0.06);
  socket('battery',D.R+0.02,by+D.base.h+0.015,0.12);
  /* ---- 门内：三层 ---- */
  var inner=new THREE.Group(); ring.add(inner); P.inner=inner; inner.visible=false;
  /* 低画质只留一层：不透明、带流光贴图，一眼还认得出是门 */
  var layers=low?[[-0.06,0xffffff,1,true]]:[[-0.10,0x150829,0.95,false],[-0.05,0xffffff,0.75,true],[0.0,0x9fe9ff,0.35,true]];
  layers.forEach(function(L,j){
    /* 最深的一层不透明：门后的东西不能透过来；前面两层叠加发光 */
    var deep=(j===0);
    var mat=new THREE.MeshBasicMaterial({color:L[1],fog:false,transparent:!deep,opacity:deep?1:0,depthWrite:deep,side:THREE.DoubleSide,
      map:L[3]?portalTex():null,blending:(L[3]&&!deep)?THREE.AdditiveBlending:THREE.NormalBlending});
    var disc=add(new THREE.CircleGeometry(D.rail-0.01,seg),mat,0,0,L[0],inner);
    disc.userData={op:L[2],spin:(j%2?-1:1)*(0.3+j*0.25)}; P.layers.push(disc);
  });
  P.setState=function(state,k){ P.state=state; P.k=clamp(k===undefined?1:k,0,1); portalApply(P); };
  P.tick=function(dt){ P.t+=dt; portalAnimate(P,dt); };
  portalApply(P);
  return P;
}
/* 按状态决定哪些部件在、亮不亮 */
function portalApply(P){
  var st=P.state, k=P.k, installed=(st==='charge'||st==='open'||st==='enter');
  ['coil','lens','vial','battery'].forEach(function(id){
    P.parts[id].visible=installed; P.sockets[id].visible=!installed;
    P.sockets[id].userData.led.material.color.setHex(st==='ready'?0xffb347:0x332211);
  });
  var railK=st==='charge'?clamp(k/0.7,0,1):(installed?1:0);
  P.rails.forEach(function(r,i){ var on=clamp(railK*3-i,0,1); r.visible=on>0.02; r.scale.setScalar(1); r.material.opacity=0.35+0.6*on;
    r.geometry.parameters&&(r.userData.on=on); });
  var openK=st==='charge'?clamp((k-0.6)/0.4,0,1):(st==='open'||st==='enter'?1:0);
  P.inner.visible=openK>0.01; P.inner.scale.setScalar(0.2+0.8*openK);
  P.layers.forEach(function(L,j){ if(j>0) L.material.opacity=L.userData.op*openK*(st==='enter'?1+k*0.3:1); });
  P.liquid.material.color.setHex(installed?0x7dffb8:0x2e6a4c);
}
/* 每帧：线圈脉冲、试剂发光、环体轻微振动、门内流光转动（关掉镜头晃动时不振） */
function portalAnimate(P,dt){
  var st=P.state, t=P.t, on=(st==='charge'||st==='open'||st==='enter');
  var shk=(typeof SHAKE_ON==='undefined'||SHAKE_ON)?1:0;
  if(!on){ P.ring.position.x=0; return; }
  var pulse=0.5+0.5*Math.sin(t*(st==='charge'?5:2.2));                 /* 平滑的脉冲，不做频闪 */
  P.coilMat.emissive.setRGB(0.45*pulse,0.18*pulse,0.05*pulse);
  P.rails.forEach(function(r,i){ if(r.visible) r.rotation.z=r.userData.baseRot+t*0.4*(i%2?-1:1)*(st==='open'?0.3:1); });
  P.layers.forEach(function(L,i){ L.rotation.z+=dt*L.userData.spin; if(i===2){ var s=1+0.03*Math.sin(t*3); L.scale.set(s,s,1); } });
  P.ring.position.x=shk*0.002*Math.sin(t*37)*(st==='charge'?1:0.4);
}

/* ---------- 物理实验室里常驻的那一台 ----------
   单独一组，不进房间的合并网格（状态会变）；进出实验室、读档、换画质都按 RT 重新摆。 */
var PortalDevice={P:null,key:'',
  stage:function(){ return RT.portalOpen?'open':(RT.portalSketch?'ready':'base'); },
  where:function(){
    var R=INTERIORS.lab1; if(!R) return null;
    for(var r=0;r<R.rows;r++) for(var c=0;c<R.cols;c++) if(R.grid[r][c]==='K') return worldToScene(R.ox+(c+0.5)*R.tw,R.oy+(r+0.5)*R.th,R);
    return null;
  },
  sync:function(){
    var here=S.mode==='in'&&S.room==='lab1'&&typeof GLR!=='undefined'&&GLR.scene&&GLR.roomMesh&&GLR.roomMesh.userData.roomData===INTERIORS.lab1;
    if(!here){ if(PortalDevice.P) PortalDevice.clear(); return; }
    var key=String(Quality.get().segments)+'|'+GLR.roomMesh.uuid;
    if(PortalDevice.P&&PortalDevice.key!==key) PortalDevice.clear();
    if(!PortalDevice.P){
      var p=PortalDevice.where(); if(!p) return;
      var P=portalBuild(); P.group.position.set(p.x,0,p.z); P.group.name='portal-device';
      GLR.scene.add(P.group); PortalDevice.P=P; PortalDevice.key=key;
    }
    var st=PortalDevice.stage();
    if(PortalDevice.P.state!==st) PortalDevice.P.setState(st,1);
  },
  tick:function(dt){ try{ PortalDevice.sync(); if(PortalDevice.P) PortalDevice.P.tick(dt); }catch(e){} },
  clear:function(){
    var P=PortalDevice.P; PortalDevice.P=null; PortalDevice.key='';
    if(!P) return;
    try{ GLR.scene.remove(P.group); }catch(e){}
    P.group.traverse(function(o){ if(o.geometry) o.geometry.dispose(); if(o.material&&!(o.material.userData&&o.material.userData.shared)) o.material.dispose(); });
  }
};
