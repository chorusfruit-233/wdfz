/* 里世界 3D · 异象「清华水杯」的画面
   贴着教学楼 / 行政楼 / 实验楼的外墙走的时候，头顶四楼的窗台上有一只紫色保温杯：
     晃 —— 先在窗台上晃几下（叮叮当当），给你一点时间反应；
     掉 —— 按真实重力往下掉（约 1.5 秒），地上一圈影子越来越深，标出它要砸的地方；
     落 —— 砸在地上弹一下、摔瘪，杯盖滚开，几块碎漆溅出去。
   状态都在 AN.data 里（phase / tf / lx,ly / wall），判定在 anomaly.js。 */
'use strict';

var CUP_H=10.6;          /* 四楼窗台离地（米）：教学楼每层 3.2 米 */
var CUP_R=0.95;          /* 砸中半径（米），地上的影子就画这么大 */
var CUP_GEO=null;
function cupFallTime(){ return Math.sqrt(2*CUP_H/9.8); }
/* 一只保温杯：清华紫的杯身、一圈白色字带（"清华大学"）、银色杯盖和杯底 */
function cupGeo(){
  if(CUP_GEO) return CUP_GEO;
  var K=new Kit(), m='dark';
  K.cyl(m,0,0,0,0.040,0.040,0.012,12,0xb8bec4,1.1);                 /* 杯底 */
  K.cyl(m,0,0.012,0,0.042,0.044,0.17,12,0x5b2a86,1.0);              /* 杯身 */
  K.cyl(m,0,0.11,0,0.0445,0.0445,0.032,12,0xf2eee6,1.05);           /* 字带 */
  K.cyl(m,0,0.182,0,0.045,0.045,0.012,12,0xb8bec4,1.15);            /* 杯口银圈 */
  K.cyl(m,0,0.194,0,0.044,0.040,0.045,12,0x4a2270,0.95);            /* 杯盖 */
  K.cyl(m,0,0.239,0,0.026,0.024,0.012,10,0xb8bec4,1.1);
  CUP_GEO=K.mergedGeometry();
  return CUP_GEO;
}
/* 落点的地面高度：路、球场、楼前铺装都比草地高一点，影子和杯子要放在最上面那层 */
var CUP_RAY=null;
function cupGroundY(x,z){
  var g=GLR.outMesh||GLR.roomMesh; if(!g) return 0;
  if(!CUP_RAY) CUP_RAY=new THREE.Raycaster();
  CUP_RAY.set(new THREE.Vector3(x,1.5,z),new THREE.Vector3(0,-1,0)); CUP_RAY.far=2;
  var h=CUP_RAY.intersectObject(g,true);
  return h.length?h[0].point.y:0;
}
function cupMesh(){ return new THREE.Mesh(cupGeo(),new THREE.MeshBasicMaterial({vertexColors:true,color:0x9a9a9a,fog:true})); }

function cupFxSpawn(grp){
  var d=AN.data, w=d.wall; if(!w) return;
  var st={};
  /* 窗台：外墙上离你最近的那一点，往外挑 0.2 米 */
  var p=anfxW2S(w.x*SC,w.y*SC), nx=w.nx, nz=w.ny;
  st.sill={x:p.x+nx*0.2,z:p.z+nz*0.2};
  var cup=cupMesh(); cup.scale.setScalar(2.2);                      /* 夸大一点：十米外抬头也要看得见 */
  cup.position.set(st.sill.x,CUP_H+0.02,st.sill.z); grp.add(cup); st.cup=cup;
  /* 地上的影子：外圈是砸中范围，里圈越来越黑 */
  var sg=new THREE.CircleGeometry(1,24); sg.rotateX(-PI/2);
  st.ring=new THREE.Mesh(sg,new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0,depthWrite:false,fog:true}));
  st.core=new THREE.Mesh(sg,new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0,depthWrite:false,fog:true}));
  st.ring.scale.set(CUP_R,1,CUP_R); st.ring.visible=false; st.core.visible=false;
  st.ring.renderOrder=2; st.core.renderOrder=2;
  grp.add(st.ring); grp.add(st.core);
  /* 杯盖、碎漆：落地时才出现 */
  st.lid=new THREE.Mesh(new THREE.CylinderGeometry(0.066,0.06,0.07,10),new THREE.MeshBasicMaterial({color:0x2a1240,fog:true}));
  st.lid.visible=false; grp.add(st.lid);
  st.chips=[];
  var cm=new THREE.MeshBasicMaterial({color:0x3d1a5c,fog:true}), i;
  for(i=0;i<7;i++){
    var c=new THREE.Mesh(new THREE.BoxGeometry(0.03,0.006,0.02),cm); c.visible=false; grp.add(c);
    var a=i/7*PI*2+Math.random()*0.6;
    c.userData={vx:Math.cos(a)*(1.2+Math.random()*1.6),vz:Math.sin(a)*(1.2+Math.random()*1.6),vy:1.2+Math.random()*1.6};
    st.chips.push(c);
  }
  ANFX.cup=st;
}
function cupFxUpdate(dt){
  var st=ANFX.cup, d=AN.data; if(!st||!d) return;
  var t=AN.t, cup=st.cup;
  if(d.phase===0){                                                  /* 在窗台上晃 */
    var k=clamp(t/(d.wob||1),0,1);
    cup.rotation.z=Math.sin(t*26)*0.18*k; cup.rotation.x=Math.sin(t*19)*0.1*k;
    cup.position.set(st.sill.x,CUP_H+0.02+Math.abs(Math.sin(t*26))*0.02*k,st.sill.z);
    return;
  }
  var land=anfxW2S(d.lx,d.ly), FALL=cupFallTime();
  if(st.gy===undefined) st.gy=cupGroundY(land.x,land.z);
  var gy=st.gy;
  st.ring.position.set(land.x,gy+0.012,land.z); st.core.position.set(land.x,gy+0.013,land.z);
  if(d.phase===1){                                                  /* 往下掉：横着滑向落点，翻着跟头 */
    var u=clamp((t-d.tf)/FALL,0,1);
    cup.position.set(st.sill.x+(land.x-st.sill.x)*u, gy+(CUP_H-gy)*(1-u*u)+0.02, st.sill.z+(land.z-st.sill.z)*u);
    cup.rotation.x+=dt*9; cup.rotation.z+=dt*5;
    st.ring.visible=true; st.core.visible=true;
    st.ring.material.opacity=0.30+0.30*u;
    var cr=CUP_R*(0.25+0.6*u); st.core.scale.set(cr,1,cr); st.core.material.opacity=0.40+0.50*u*u;
    return;
  }
  /* 落地：弹一下就躺下，摔瘪；杯盖滚开；碎漆溅出去 */
  var e=t-d.tl;
  if(!st.landed){
    st.landed=true;
    cup.rotation.set(0,Math.random()*PI*2,PI/2); cup.scale.set(2.2,2.2,1.7);
    st.lid.visible=true; st.lid.position.set(land.x,gy+0.035,land.z); st.lid.rotation.z=PI/2;
    st.lidA=Math.random()*PI*2;
    st.chips.forEach(function(c){ c.visible=true; c.position.set(land.x,gy+0.05,land.z); });
  }
  var bounce=Math.max(0,Math.sin(Math.min(e,0.35)/0.35*PI))*0.18*(1-Math.min(1,e/0.35));
  cup.position.set(land.x,gy+0.07+bounce,land.z);
  var roll=Math.min(e,1.2);
  st.lid.position.set(land.x+Math.cos(st.lidA)*roll*0.9,gy+0.035,land.z+Math.sin(st.lidA)*roll*0.9);
  st.lid.rotation.x+=dt*(e<1.2?8:0);
  st.chips.forEach(function(c){
    var v=c.userData, fl=gy+0.012; if(c.position.y<=fl&&v.vy<=0) return;
    v.vy-=9.8*dt; c.position.x+=v.vx*dt; c.position.z+=v.vz*dt; c.position.y=Math.max(fl,c.position.y+v.vy*dt);
    if(c.position.y<=fl){ v.vx=0; v.vz=0; v.vy=0; }
  });
  st.ring.material.opacity=Math.max(0,0.4-e*0.5); st.core.material.opacity=Math.max(0,0.75-e*0.8);
}
