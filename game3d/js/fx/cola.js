/* 里世界 3D · 异象「天降可乐」的画面
   只在清华水杯真正出现过以后、夜里走在室外时来一次（排队和判定在 anomaly.js）：
     响 —— 头顶很高的地方先是易拉罐磕碰、滚动的声音；地上一圈很淡的影子跟着你；
     掉 —— 影子在你那一刻站的地方停住、越来越深，一罐可乐从夜空里笔直掉下来（约 1.7 秒）；
     落 —— 「嘭」地瘪掉，泡沫喷一圈，罐子滚开，地上留一摊深色的水。
   状态都在 AN.data 里（phase / tf / lx,ly / tl），读档后按同一份状态重建。 */
'use strict';

var COLA_H=14;            /* 从多高掉下来（米）：比四楼窗台还高，看不出是从哪里来的 */
var COLA_R=0.85;          /* 砸中半径（米），地上的影子就画这么大 */
var COLA_WARN=1.6;        /* 先响多久才掉（真实秒） */
function colaFallTime(){ return Math.sqrt(2*COLA_H/9.8); }
/* 尺寸按 330 毫升的罐子（米）：高 12.2 厘米，直径 6.6 厘米；游戏里放大，十几米外也要看得见 */
var COLA_DIM={h:0.122,r:0.033,top:0.027,scale:2.4};
var COLA_MAT=null;
function colaMats(){
  if(COLA_MAT) return COLA_MAT;
  function m(c,o){ var x=new THREE.MeshBasicMaterial(Object.assign({color:c,fog:true},o||{})); x.userData.shared=true; return x; }
  COLA_MAT={
    red:m(0xa8121d), white:m(0xeeeae2), metal:m(0xa9adb2), dark:m(0x55585c),
    foam:m(0xe8dcc6,{transparent:true,opacity:0.9,depthWrite:false}),
    pool:m(0x2a1206,{transparent:true,opacity:0.0,depthWrite:false}),
    shadow:m(0x000000,{transparent:true,opacity:0,depthWrite:false}),
    rim:m(0xe6d8bf,{transparent:true,opacity:0,depthWrite:false})
  };
  return COLA_MAT;
}
/* 一罐可乐：原点在罐底中心，罐口朝 +y。红色罐身、白色波浪带、上下两圈铝色的收口、拉环 */
function colaModel(){
  var M=colaMats(), g=new THREE.Group(), D=COLA_DIM, seg=Math.max(12,Math.round(20*Quality.get().segments));
  function cyl(rt,rb,h,y,mat,open){
    var geo=new THREE.CylinderGeometry(rt,rb,h,seg,1,!!open); var me=new THREE.Mesh(geo,mat); me.position.y=y; g.add(me); return me;
  }
  cyl(D.r,D.top,0.010,0.005,M.metal);                         /* 罐底收口 */
  cyl(D.r,D.r,0.096,0.058,M.red);                              /* 罐身 */
  var band=cyl(D.r*1.012,D.r*1.012,0.016,0.064,M.white,true);   /* 白色波浪带：整圈上下起伏 */
  var pos=band.geometry.attributes.position;
  for(var i=0;i<pos.count;i++){ var a=Math.atan2(pos.getZ(i),pos.getX(i)); pos.setY(i,pos.getY(i)+Math.sin(a*2)*0.012); }
  pos.needsUpdate=true; band.material.side=THREE.DoubleSide;
  cyl(D.top,D.r,0.012,0.112,M.metal);                         /* 罐肩 */
  cyl(D.top,D.top,0.004,0.120,M.metal);                        /* 罐口的卷边 */
  var tab=new THREE.Mesh(new THREE.BoxGeometry(0.018,0.002,0.010),M.dark); tab.position.set(0.004,0.1225,0); g.add(tab);
  g.scale.setScalar(D.scale);
  return g;
}
function colaFxSpawn(grp){
  var d=AN.data||{}, M=colaMats(), st={};
  st.can=colaModel(); grp.add(st.can);
  /* 夜里黑影子落在黑地上看不见：外圈是一道浅色的边（像路灯照在下落的罐子上反下来的光），里圈才是影子 */
  var sg=new THREE.CircleGeometry(1,24); sg.rotateX(-PI/2);
  var rg=new THREE.RingGeometry(0.9,1,32); rg.rotateX(-PI/2);
  st.ring=new THREE.Mesh(rg,M.rim.clone()); st.core=new THREE.Mesh(sg,M.shadow.clone());
  st.pool=new THREE.Mesh(sg,M.pool.clone());
  [st.ring,st.core,st.pool].forEach(function(o){ o.renderOrder=2; o.visible=false; grp.add(o); });
  st.ring.scale.set(COLA_R,1,COLA_R);
  /* 泡沫：落地时从落点喷出去的一圈小团 */
  st.foam=[];
  var fg=new THREE.SphereGeometry(0.05,6,4);
  for(var i=0;i<10;i++){
    var f=new THREE.Mesh(fg,M.foam); f.visible=false; grp.add(f);
    var a=i/10*PI*2+Math.random()*0.5, sp=0.8+Math.random()*1.4;
    f.userData={vx:Math.cos(a)*sp,vz:Math.sin(a)*sp,vy:1.4+Math.random()*1.8,s:0.6+Math.random()*0.8};
    st.foam.push(f);
  }
  st.spin=Math.random()*PI*2;
  ANFX.cola=st;
  colaFxUpdate(0);
}
/* 掉下来之前影子跟着你，掉的时候停在落点 */
function colaFxUpdate(dt){
  var st=ANFX.cola, d=AN.data; if(!st||!d) return;
  var t=AN.t, can=st.can, me=anfxW2S(S.x,S.y);
  if(d.phase===0||d.phase===undefined){
    var k=clamp(t/(d.warn||COLA_WARN),0,1), gy0=cupGroundY(me.x,me.z);
    st.ring.visible=true; st.ring.position.set(me.x,gy0+0.035,me.z);
    st.ring.material.opacity=0.08+0.22*k;                         /* 很淡，看得出「有什么在头顶上」 */
    st.spin+=dt*3;
    can.visible=true; can.position.set(me.x+Math.cos(st.spin)*0.6,COLA_H+0.6,me.z+Math.sin(st.spin)*0.6);
    can.rotation.set(Math.sin(t*7)*0.6,st.spin,PI/2);                /* 在看不见的边沿上滚 */
    return;
  }
  var land=anfxW2S(d.lx,d.ly);
  if(st.gy===undefined) st.gy=cupGroundY(land.x,land.z);
  var gy=st.gy, FALL=colaFallTime();
  st.ring.position.set(land.x,gy+0.035,land.z); st.core.position.set(land.x,gy+0.03,land.z);
  if(d.phase===1){
    var u=clamp((t-d.tf)/FALL,0,1);
    can.position.set(land.x,gy+(COLA_H-gy)*(1-u*u)+0.05,land.z);
    can.rotation.x+=dt*11; can.rotation.z+=dt*4;
    st.ring.visible=true; st.core.visible=true;
    st.ring.material.opacity=0.35+0.4*u;
    var cr=COLA_R*(0.2+0.65*u); st.core.scale.set(cr,1,cr); st.core.material.opacity=0.35+0.55*u*u;
    return;
  }
  var e=t-(d.tl||t);
  if(!st.landed){
    st.landed=true;
    st.rollA=Math.random()*PI*2;
    can.rotation.set(0,st.rollA,PI/2); can.scale.set(COLA_DIM.scale*0.62,COLA_DIM.scale*1.05,COLA_DIM.scale);   /* 摔瘪 */
    st.foam.forEach(function(f){ f.visible=true; f.position.set(land.x,gy+0.08,land.z); f.scale.setScalar(f.userData.s); });
    st.pool.visible=true; st.pool.position.set(land.x,gy+0.011,land.z);
  }
  var roll=Math.min(e,1.4)*0.75*(1-Math.min(e,1.4)/2.8);
  can.position.set(land.x+Math.cos(st.rollA)*roll,gy+0.06,land.z+Math.sin(st.rollA)*roll);
  can.rotation.x+=dt*(e<1.4?6:0);
  st.foam.forEach(function(f){
    var v=f.userData, fl=gy+0.02;
    if(f.position.y>fl||v.vy>0){
      v.vy-=9.8*dt; f.position.x+=v.vx*dt; f.position.z+=v.vz*dt; f.position.y=Math.max(fl,f.position.y+v.vy*dt);
      if(f.position.y<=fl){ v.vx=0; v.vz=0; v.vy=0; }
    }
    f.scale.setScalar(v.s*Math.max(0.15,1-e/2.6));
  });
  var pr=0.4+Math.min(e,1.2)*0.9; st.pool.scale.set(pr,1,pr*0.8); st.pool.material.opacity=Math.min(0.7,e*1.4);
  st.ring.material.opacity=Math.max(0,0.45-e*0.6); st.core.material.opacity=Math.max(0,0.8-e*0.9);
}
