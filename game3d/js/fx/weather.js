/* 里世界 3D · 雨和蛾群（异象「下雨」「蛾群」的画面）
   雨：
     · 雨丝是一组线段（画质 低/中/高 = 500/900/1500 根），随风斜着落，罩在人身边一圈；
     · 落地溅起小水圈；地上慢慢积出几摊水，水里一直有涟漪；
     · 隔一阵打一道闪（画面白两下），雷声按距离晚 0.4~2.4 秒才到。
   蛾群：
     · 每只蛾子是一个身子 + 两片会扑的翅膀（实例化网格，一次画完）；
     · 平时绕着异象出现的那一点打转；你待得越久（AN.acc 越高），整群越往你脸上扑，圈也越收越紧；
     · 翅膀上的粉一直往下掉。
   离开出现时的场景（进屋 / 出门）就藏起来。 */
'use strict';

var WX={rain:null,moth:null};
function wxHere(st){ return S.mode===st.mode&&S.room===st.room; }

/* ---------- 雨 ---------- */
var WX_RAIN_AREA=18, WX_RAIN_H=9;
function wxRainCount(){ return [500,900,1500][QUALITY|0]||900; }
function wxRainSpawn(grp){
  var n=wxRainCount(), i;
  var sd=new Float32Array(n*3), pos=new Float32Array(n*6);
  for(i=0;i<n;i++){
    sd[i*3]=(Math.random()-0.5)*WX_RAIN_AREA;
    sd[i*3+1]=Math.random()*WX_RAIN_H;
    sd[i*3+2]=(Math.random()-0.5)*WX_RAIN_AREA;
  }
  var g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(pos,3));
  var lines=new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:0xaebfcc,transparent:true,opacity:0.36,fog:true,depthWrite:false}));
  lines.frustumCulled=false;
  grp.add(lines);
  var st={mode:S.mode,room:S.room,lines:lines,pos:pos,sd:sd,n:n,t:0,
          splash:[],si:0,puddles:[],ripT:0,bolt:0,bolt2:-1,nextBolt:2.5+Math.random()*4};
  /* 落地水圈：一个池子轮着用 */
  var ring=new THREE.RingGeometry(0.035,0.06,12); ring.rotateX(-PI/2);
  var ns=(QUALITY|0)===0?16:36;
  for(i=0;i<ns;i++){
    var sm=new THREE.Mesh(ring,new THREE.MeshBasicMaterial({color:0xc8d6de,transparent:true,opacity:0,depthWrite:false,fog:true}));
    sm.visible=false; sm.userData.life=0; grp.add(sm); st.splash.push(sm);
  }
  /* 积水：人身边几摊，慢慢变深 */
  var pg=new THREE.CircleGeometry(1,20); pg.rotateX(-PI/2);
  var c=anfxW2S(S.x,S.y);
  for(i=0;i<(QUALITY|0?9:5);i++){
    var a=Math.random()*PI*2, r=1.2+Math.random()*6;
    var pm=new THREE.Mesh(pg,new THREE.MeshBasicMaterial({color:0x1a242c,transparent:true,opacity:0,depthWrite:false,fog:true}));
    pm.scale.set(0.5+Math.random()*1.1,1,0.35+Math.random()*0.7);
    pm.rotation.y=Math.random()*PI;
    pm.position.set(c.x+Math.cos(a)*r,0.012+i*0.0005,c.z+Math.sin(a)*r);
    pm.renderOrder=1; grp.add(pm); st.puddles.push(pm);
  }
  WX.rain=st;
}
function wxSplash(st,x,z,big){
  var m=st.splash[st.si]; st.si=(st.si+1)%st.splash.length;
  m.visible=true; m.position.set(x,0.03,z); m.userData.life=1; m.userData.big=big?1.8:1;
}
function wxRainUpdate(dt){
  var st=WX.rain; if(!st) return;
  st.t+=dt;
  var here=wxHere(st);
  ANFX.grp.visible=here;
  if(!here) return;
  var c=GLR.cam.position, i;
  st.lines.position.set(c.x,0,c.z);
  var wx=1.8+1.3*Math.sin(st.t*0.37), wz=0.7+0.5*Math.sin(st.t*0.23+1), sp=13, len=0.55;
  var sd=st.sd, pos=st.pos, lx=wx/sp*len, lz=wz/sp*len, half=WX_RAIN_AREA/2;
  for(i=0;i<st.n;i++){
    var k=i*3;
    sd[k+1]-=sp*dt; sd[k]+=wx*dt; sd[k+2]+=wz*dt;
    if(sd[k+1]<0){
      if(Math.random()<0.12) wxSplash(st,c.x+sd[k],c.z+sd[k+2]);
      sd[k+1]+=WX_RAIN_H; sd[k]=(Math.random()-0.5)*WX_RAIN_AREA; sd[k+2]=(Math.random()-0.5)*WX_RAIN_AREA;
    }
    if(sd[k]>half) sd[k]-=WX_RAIN_AREA; else if(sd[k]<-half) sd[k]+=WX_RAIN_AREA;
    if(sd[k+2]>half) sd[k+2]-=WX_RAIN_AREA; else if(sd[k+2]<-half) sd[k+2]+=WX_RAIN_AREA;
    var j=i*6;
    pos[j]=sd[k]; pos[j+1]=sd[k+1]; pos[j+2]=sd[k+2];
    pos[j+3]=sd[k]-lx; pos[j+4]=sd[k+1]+len; pos[j+5]=sd[k+2]-lz;
  }
  st.lines.geometry.attributes.position.needsUpdate=true;
  /* 水圈：长大、变淡 */
  for(i=0;i<st.splash.length;i++){
    var m=st.splash[i]; if(!m.visible) continue;
    m.userData.life-=dt*2.8;
    if(m.userData.life<=0){ m.visible=false; continue; }
    var s=(1.6-m.userData.life)*m.userData.big;
    m.scale.set(s,1,s); m.material.opacity=0.55*m.userData.life;
  }
  /* 积水：十秒左右积满；水面上一直有涟漪 */
  var wet=Math.min(1,st.t/10);
  st.ripT-=dt;
  for(i=0;i<st.puddles.length;i++){
    var p=st.puddles[i];
    p.material.opacity=0.5*wet;
    p.material.color.setRGB(0.10+0.06*(GLR.flash||0),0.14+0.07*(GLR.flash||0),0.17+0.08*(GLR.flash||0));   /* 闪电时水面反一下光 */
  }
  if(st.ripT<=0&&st.puddles.length){
    st.ripT=0.05+Math.random()*0.08;
    var pp=st.puddles[Math.floor(Math.random()*st.puddles.length)], ra=Math.random()*PI*2, rr=Math.random()*0.7;
    wxSplash(st,pp.position.x+Math.cos(ra)*rr*pp.scale.x,pp.position.z+Math.sin(ra)*rr*pp.scale.z,true);
  }
  /* 闪电：白两下，雷声晚到 */
  st.nextBolt-=dt;
  if(st.nextBolt<=0){
    st.nextBolt=6+Math.random()*8;
    var near=Math.random();
    var muffled=(typeof underCover==='function')&&underCover();      /* 檐下 / 打着伞：雷声闷一点 */
    GLR.flash=Math.max(GLR.flash||0,0.45+0.3*(1-near));
    st.bolt2=0.09+Math.random()*0.08;
    try{ SFX.thunder(0.4+near*2.0,1-near*0.6,muffled); }catch(e){}
  }
  if(st.bolt2>=0){ st.bolt2-=dt; if(st.bolt2<0) GLR.flash=Math.max(GLR.flash||0,0.35); }
}

/* ---------- 蛾群 ---------- */
function wxMothCount(){ return [50,80,120][QUALITY|0]||80; }
function wxMothSpawn(grp,wx,wy){
  var n=wxMothCount(), i;
  var ws=new THREE.Shape();                              /* 一片翅膀：前翅尖、后翅圆（往 +x 伸出去） */
  ws.moveTo(0,0.012); ws.lineTo(0.05,0.03); ws.lineTo(0.072,0.018); ws.quadraticCurveTo(0.06,-0.012,0.04,-0.016);
  ws.quadraticCurveTo(0.03,-0.04,0.008,-0.03); ws.lineTo(0,-0.014); ws.lineTo(0,0.012);
  var wing=new THREE.ShapeGeometry(ws,3); wing.rotateX(-PI/2);
  var body=new THREE.BoxGeometry(0.016,0.016,0.06);
  var wingM=new THREE.InstancedMesh(wing,new THREE.MeshBasicMaterial({color:0xbab1a0,side:THREE.DoubleSide,fog:true}),n*2);
  var bodyM=new THREE.InstancedMesh(body,new THREE.MeshBasicMaterial({color:0x4e463a,fog:true}),n);
  wingM.frustumCulled=false; bodyM.frustumCulled=false;
  grp.add(wingM); grp.add(bodyM);
  var c=anfxW2S(wx,wy), ms=[];
  for(i=0;i<n;i++){
    ms.push({p:new THREE.Vector3(c.x+(Math.random()-0.5)*2.4,1.2+Math.random()*1.6,c.z+(Math.random()-0.5)*2.4),
             v:new THREE.Vector3(), a:Math.random()*PI*2, r:0.35+Math.random()*1.5, sp:(Math.random()<0.5?-1:1)*(1.0+Math.random()*2.2),
             ph:Math.random()*PI*2, fl:26+Math.random()*16, h:1.3+Math.random()*1.4});
  }
  /* 翅膀上的粉 */
  var nd=(QUALITY|0)===0?60:140, dp=new Float32Array(nd*3), dl=new Float32Array(nd);
  var dg=new THREE.BufferGeometry(); dg.setAttribute('position',new THREE.BufferAttribute(dp,3));
  var dust=new THREE.Points(dg,new THREE.PointsMaterial({color:0xe6dcc2,size:0.012,transparent:true,opacity:0.65,depthWrite:false,fog:true}));
  dust.frustumCulled=false; grp.add(dust);
  for(i=0;i<nd;i++){ dp[i*3+1]=-9; dl[i]=0; }
  WX.moth={mode:S.mode,room:S.room,wing:wingM,body:bodyM,ms:ms,n:n,c:new THREE.Vector3(c.x,1.9,c.z),
           dust:dust,dp:dp,dl:dl,di:0,t:0,_o:new THREE.Object3D(),_tg:new THREE.Vector3(),dist:99};
}
function wxMothThreat(){
  if(typeof AN==='undefined'||!AN.active||AN.id!=='moth') return 0;
  return clamp((AN.acc||0)/((S.diff==='hard')?4.5:6.5),0,1);
}
function wxMothUpdate(dt){
  var st=WX.moth; if(!st) return;
  st.t+=dt;
  var here=wxHere(st);
  ANFX.grp.visible=here;
  if(!here){ st.dist=99; return; }
  var cam=GLR.cam.position, thr=wxMothThreat();
  /* 群的中心：从出现的那一点，被你"拽"过来 */
  var pull=thr>0?0.2+0.35*thr:0;
  var cx=st.c.x+(cam.x-st.c.x)*pull, cy=st.c.y+(cam.y-0.1-st.c.y)*pull, cz=st.c.z+(cam.z-st.c.z)*pull;
  var shrink=1-0.6*thr, o=st._o, tg=st._tg, i, m, sum=0;
  for(i=0;i<st.n;i++){
    m=st.ms[i];
    m.a+=m.sp*dt;
    tg.set(cx+Math.cos(m.a)*m.r*shrink, cy+(m.h-1.9)*shrink*0.6+Math.sin(m.a*1.7+m.ph)*0.3, cz+Math.sin(m.a)*m.r*shrink);
    m.v.x+=((tg.x-m.p.x)*5-m.v.x*1.9+(Math.random()-0.5)*9)*dt;
    m.v.y+=((tg.y-m.p.y)*5-m.v.y*1.9+(Math.random()-0.5)*9)*dt;
    m.v.z+=((tg.z-m.p.z)*5-m.v.z*1.9+(Math.random()-0.5)*9)*dt;
    var vl=m.v.length(); if(vl>4.5) m.v.multiplyScalar(4.5/vl);
    m.p.addScaledVector(m.v,dt);
    var cd=m.p.distanceTo(cam), rmin=0.55-0.2*thr;                /* 扑到脸前就弹开，不把整个画面糊住 */
    if(cd<rmin){ tg.copy(m.p).sub(cam).multiplyScalar(rmin/(cd||1)); m.p.copy(cam).add(tg); m.v.multiplyScalar(-0.4); }
    var head=Math.atan2(m.v.x,m.v.z), flap=Math.sin(st.t*m.fl+m.ph)*1.1+0.25;
    o.position.copy(m.p); o.rotation.set(0,head,0,'YZX'); o.scale.set(1,1,1); o.updateMatrix();
    st.body.setMatrixAt(i,o.matrix);
    o.rotation.set(0,head,flap,'YZX'); o.updateMatrix(); st.wing.setMatrixAt(i*2,o.matrix);
    o.rotation.set(0,head,-flap,'YZX'); o.scale.set(-1,1,1); o.updateMatrix(); st.wing.setMatrixAt(i*2+1,o.matrix);
    sum+=m.p.distanceTo(cam);
  }
  st.body.instanceMatrix.needsUpdate=true; st.wing.instanceMatrix.needsUpdate=true;
  st.dist=sum/st.n;                           /* 给声音用：整群离你多远 */
  /* 落粉 */
  var dp=st.dp, dl=st.dl, nd=dl.length, emit=Math.floor(dt*60*(1+thr))+1;
  for(i=0;i<emit;i++){
    var src=st.ms[Math.floor(Math.random()*st.n)], k=st.di;
    dp[k*3]=src.p.x; dp[k*3+1]=src.p.y; dp[k*3+2]=src.p.z; dl[k]=2.5+Math.random()*1.5;
    st.di=(st.di+1)%nd;
  }
  for(i=0;i<nd;i++){
    if(dl[i]<=0) continue;
    dl[i]-=dt;
    dp[i*3+1]-=dt*(0.18+0.1*Math.sin(i));
    dp[i*3]+=Math.sin(st.t*1.3+i)*dt*0.08;
    if(dl[i]<=0||dp[i*3+1]<0.01) dp[i*3+1]=-9;
  }
  st.dust.geometry.attributes.position.needsUpdate=true;
}

function wxClear(){
  [WX.rain,WX.moth].forEach(function(st){
    if(!st) return;
    try{ ANFX.grp&&ANFX.grp.traverse(function(o){ if(o.geometry) o.geometry.dispose(); if(o.material) o.material.dispose(); }); }catch(e){}
  });
  WX.rain=null; WX.moth=null;
}
/* 声音用：蛾群离镜头的平均距离（米），没有蛾群时 99 */
function wxMothDist(){ return WX.moth&&wxHere(WX.moth)?WX.moth.dist:99; }
