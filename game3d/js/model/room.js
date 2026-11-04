/* @module-capsule */
(function($imports){
/* 渲染适配：只改房间表现元数据，碰撞由 SpaceLayout 在世界初始化时建立。 */
'use strict';
function buildRoomGeometry(R){
  if(R.build)return buildCustomRoom(R);
  var draft=Object.assign({},R),RWH=R.spiral?$imports.SPIRAL.wallH:$imports.WALLH;
  var K=new $imports.Kit({cull:R.host==='teach'&&R.floor===6?{floor:.002}:{floor:.002,ceil:RWH-.002},chunk:16,inst:1});
  var c=(0,$imports.buildRoomRecipe)(draft,K,{meshes:true,board:chalkBoard,carPlate:function(x,y,px,py,pz){return carPlate($imports.Investigation.carName(x,y),px,py,pz);},decay:roomDecay,signs:roomSigns,liftLeaves:$imports.liftLandingLeaves});
  R.shafts=draft.shafts;R.doorSpecs=draft.doorSpecs;
  var group=K.build();group.add(buildDoorLeaves(R));c.meshes.forEach(function(m){group.add(m);});return group;
}
function buildCustomRoom(R){
  $imports.SHAFT_ACC=null;
  R.shafts=[]; R.doorSpecs=[];
  var grp=R.build(R);
  return grp||new $imports.THREE.Group();
}
function buildDoorLeaf(K,R,d){
  var isOpen=(typeof $imports.OPENDOORS!=='undefined')?!!$imports.OPENDOORS[(0,$imports.doorKeyAt)(R,d.x,d.y)]:false;
  var dbl=d.dbl, dbr=d.dbr;
  K.frame(d.cx,d.cz,d.horiz?0:Math.PI/2);
  var hingeX=dbl?0.47:-0.43, sw=dbl?-1:1;                     /* 双开门的右扇铰链在右边 */
  if(dbr&&!dbl){ hingeX=-0.47; sw=1; }
  var lz=0.38;
  /* 门扇模型以合页轴为原点：sw=1 往 +x 伸、sw=-1 用镜像的那一款；开着的绕合页转 90°，贴着门洞边 */
  var name=sw>0?'door_leaf':'door_leaf_m';
  if(!isOpen) K.asset(name,hingeX,0,lz,0);
  else K.asset(name,hingeX+sw*0.03,0,lz,sw>0?-Math.PI/2:Math.PI/2);
  K.unframe();
}
function buildDoorLeaves(R){
  var K=new $imports.Kit({cull:{floor:0.002}});
  (R.doorSpecs||[]).forEach(function(d){ buildDoorLeaf(K,R,d); });
  var g=K.build(); g.name='doorleaves';
  return g;
}
function roomDoorRefresh(R,x,y){
  var grp=$imports.GLR.roomMesh; if(!grp||!R||!R.doorSpecs) return;
  var old=grp.getObjectByName('doorleaves');
  if(old){ grp.remove(old); old.traverse(function(o){ if(o.geometry) o.geometry.dispose(); }); }
  var g=buildDoorLeaves(R);
  try{ (0,$imports.shadeMarkMesh)(g); }catch(e){}
  grp.add(g);
}
var CHALK_TEXTS=[
  ['值日生：周  林','今日课表：语文 数学 英语 物理 自习'],
  ['距 离 高 考 还 有  0  天'],
  ['今天的作业：','数一数，班上到底有几个人'],
  ['晚自习 19:00 — 22:00','保持安静'],
  ['点名：到 到 到 到 到 到 到 到 到','到'],
  ['第三排靠窗那个座位','不要坐'],
  ['不 要 回 头'],
  ['放学后不要留在教室','（再说一遍：不要留在教室）'],
  ['数学作业：P.83  1—12 题','明天早读前交'],
  ['他一直坐在最后一排','你们看不见吗']
];
var CHALK_MAT={};
function chalkBoard(x,y,z,w,h,seed){
  var lines=CHALK_TEXTS[seed%CHALK_TEXTS.length], key=lines.join('|');
  var m=CHALK_MAT[key];
  if(!m){
    var cv=document.createElement('canvas'); cv.width=1024; cv.height=Math.round(1024*h/w);
    var g=cv.getContext('2d'), H=cv.height, i, j;
    g.clearRect(0,0,1024,H);
    for(i=0;i<4;i++){ g.fillStyle='rgba(255,255,255,0.025)'; g.beginPath(); g.ellipse($imports.PresentationRandom.next()*1024,$imports.PresentationRandom.next()*H,120+$imports.PresentationRandom.next()*200,30+$imports.PresentationRandom.next()*50,($imports.PresentationRandom.next()-0.5)*0.4,0,6.283); g.fill(); }   /* 擦过的白印 */
    var fs=Math.round(H/(lines.length+1.6)*0.62), red=/不要|回头|看不见|0  天/.test(key);
    g.font='600 '+fs+'px "KaiTi","STKaiti","Kaiti SC","Noto Serif SC","SimSun",serif'; g.textBaseline='middle';
    for(i=0;i<lines.length;i++){
      var ly=H*(i+1)/(lines.length+1), lx=60+$imports.PresentationRandom.next()*30;
      for(j=0;j<3;j++){ g.fillStyle=(red&&i===lines.length-1&&lines.length>1)?'rgba(220,120,110,0.55)':'rgba(236,236,228,0.55)'; g.fillText(lines[i],lx+($imports.PresentationRandom.next()-0.5)*2.5,ly+($imports.PresentationRandom.next()-0.5)*2.5); }
    }
    g.globalCompositeOperation='destination-out';                 /* 粉笔的断续：随机擦掉一些点 */
    for(i=0;i<5000;i++){ g.fillStyle='rgba(0,0,0,'+(0.3+$imports.PresentationRandom.next()*0.7).toFixed(2)+')'; g.fillRect($imports.PresentationRandom.next()*1024,$imports.PresentationRandom.next()*H,1.5,1.5); }
    g.globalCompositeOperation='source-over';
    var t=new $imports.THREE.CanvasTexture(cv); t.colorSpace=$imports.THREE.SRGBColorSpace; t.anisotropy=4;
    m=new $imports.THREE.MeshLambertMaterial({map:t,transparent:true,depthWrite:false});
    m.userData.shared=true;
    CHALK_MAT[key]=m;
  }
  var me=new $imports.THREE.Mesh(new $imports.THREE.PlaneGeometry(w,h),m);
  me.position.set(x,y,z);
  return me;
}
function roomDecay(c){
  var K=c.K, R=c.R, W=c.W, H=c.H, CX=c.CX, CZ=c.CZ, RWH=c.RWH||$imports.WALLH, x, y, d;
  var sd=0, i; for(i=0;i<R.id.length;i++) sd=sd*31+R.id.charCodeAt(i); sd=Math.abs(sd)%9973;
  var low=(0,$imports.lodLow)(), kq=low?0.5:1, garage=(R.id==='garage1');
  function hz(a,b,k){ return (0,$imports.hash2)(a*13+sd+(k||0)*101,b*17+sd*3); }
  function G(yy,xx){ return (yy>=0&&xx>=0&&yy<H&&xx<W)?R.grid[yy][xx]:null; }
  /* 吊顶水渍 */
  for(y=1;y<H-1;y++) for(x=1;x<W-1;x++){
    if(G(y,x)!=='.') continue;
    if(hz(x,y,1)<0.035*kq) (0,$imports.propDecal)(K,0,'d',CX(x)+hz(x,y,2)-0.5,RWH-0.002,CZ(y)+hz(x,y,3)-0.5,0.8+hz(x,y,4)*1.0,0.8+hz(x,y,5)*0.9,garage?0x3a3428:0x6e5a3c,hz(x,y,6)*6.28);
  }
  /* 墙：脚下的霉斑、顶上往下淌的水痕、偶尔一只手印 */
  var D=[[0,-1,'s'],[0,1,'n'],[-1,0,'e'],[1,0,'w']];
  for(y=0;y<H;y++) for(x=0;x<W;x++){
    if(G(y,x)!=='#') continue;
    for(d=0;d<4;d++){
      var nx=x+D[d][0], ny=y+D[d][1], ch=G(ny,nx);
      if(!ch||ch==='#'||ch==='='||ch==='O'||ch==='S') continue;
      var fx=CX(x)+D[d][0]*0.503, fz=CZ(y)+D[d][1]*0.503, f=D[d][2], r1=hz(x*4+d,y,7);
      if(r1<0.07*kq) (0,$imports.propDecal)(K,1,f,fx,0.95+hz(x,y+d,8)*0.25,fz,0.6+hz(x,d,9)*0.5,0.55+hz(d,y,10)*0.3,0x1c261a);
      else if(r1<0.12*kq) (0,$imports.propDecal)(K,0,f,fx,RWH-0.45,fz,0.7+hz(x,d,11)*0.5,0.9,garage?0x2a2620:0x5a4a32);
      else if(r1<0.135&&!garage) (0,$imports.propDecal)(K,2,f,fx,1.15+hz(x,d,12)*0.3,fz,0.20,0.26,0x3a1812);
    }
  }
  /* 地上：散落的纸、蹭痕；洗手池周围的水 */
  for(y=1;y<H-1;y++) for(x=1;x<W-1;x++){
    var gc=G(y,x);
    if(gc==='w'){ (0,$imports.propDecal)(K,0,'u',CX(x)+0.2,0.005,CZ(y)+0.45,1.1,0.8,0x1a2228,hz(x,y,13)*6.28); continue; }
    if(gc!=='.') continue;
    var r2=hz(x,y,14);
    if(!garage&&r2<0.025*kq) (0,$imports.propFloorPaper)(K,CX(x)+hz(x,y,15)-0.5,CZ(y)+hz(x,y,16)-0.5,hz(x,y,17)*6.28,(x+y)|0);
    else if(r2>0.95-0.05*kq) (0,$imports.propDecal)(K,3,'u',CX(x),0.0045,CZ(y),0.9,0.9,0x2a2622,hz(x,y,18)*6.28);
  }
  /* 教学楼走廊：掉了一块的吊顶，半块板吊下来，一根电线垂着 */
  if(R.host==='teach'&&R.floor>=1&&R.floor<=5){
    [5,23,41].forEach(function(col,k){
      if(hz(col,k,19)>0.66) return;
      var hx=Math.round(CX(col)/0.6)*0.6+0.3, hzc=Math.round(CZ(17)/0.6)*0.6+0.3;
      K.g('dark').face([[hx-0.3,RWH-0.003,hzc-0.3],[hx+0.3,RWH-0.003,hzc-0.3],[hx+0.3,RWH-0.003,hzc+0.3],[hx-0.3,RWH-0.003,hzc+0.3]],[0,-1,0],[0.02,0.02,0.025]);
      var a=0.85, z1=hzc-0.29+0.58*Math.cos(a), y1=RWH-0.01-0.58*Math.sin(a), P=[[hx-0.28,RWH-0.01,hzc-0.29],[hx+0.28,RWH-0.01,hzc-0.29],[hx+0.28,y1,z1],[hx-0.28,y1,z1]];
      var cb=K.g('plastic'), rgb=cb._rgb(0xa8acac,1.0);
      cb.face(P,[0,-Math.cos(a),Math.sin(a)],rgb);                               /* 板面朝下、朝走廊 */
      cb.face([P[1],P[0],P[3],P[2]],[0,Math.cos(a),-Math.sin(a)],cb._rgb(0x6a6e6e,0.8));
      K.rod('dark',hx+0.12,RWH-0.01,hzc+0.1,hx+0.18,2.72,hzc+0.18,0.006,0.006,4,0x15181a,1);   /* 垂下来的电线 */
      (0,$imports.propDecal)(K,0,'d',hx+0.2,RWH-0.002,hzc+0.2,1.6,1.4,0x5a4a32,1.3);
    });
  }
}
var SIGN_FONT='"Noto Sans SC","Noto Sans CJK SC","PingFang SC","Microsoft YaHei","WenQuanYi Zen Hei",sans-serif';
var SIGN_HAND='"KaiTi","STKaiti","Kaiti SC","Noto Serif SC","Noto Serif CJK SC","Songti SC",serif';
var SIGN_EDGE_MAT=null;
function signEdgeMat(){
  if(!SIGN_EDGE_MAT){ SIGN_EDGE_MAT=new $imports.THREE.MeshLambertMaterial({color:0x6b6862}); SIGN_EDGE_MAT.userData.shared=true; }
  return SIGN_EDGE_MAT;
}
function signRand(text){
  var h=7, i; for(i=0;i<text.length;i++) h=(h*31+text.charCodeAt(i))>>>0;
  return function(){ h=(h*1664525+1013904223)>>>0; return h/4294967296; };
}
function signRR(g,x,y,w,h,r){
  g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath();
}
function signGrime(g,w,h,rnd,rgb,n){
  for(var i=0;i<n;i++){ var s=1+rnd()*2.6; g.fillStyle='rgba('+rgb+','+(0.03+rnd()*0.10).toFixed(3)+')'; g.fillRect(rnd()*w,rnd()*h,s,s); }
}
function signSpace(g,px){ try{ if('letterSpacing' in g) g.letterSpacing=px+'px'; }catch(e){} }
function signTex(w,h,key,draw){
  var cv=document.createElement('canvas'); cv.width=w; cv.height=h;
  var g=cv.getContext('2d'); if(g) draw(g,w,h,signRand(key));
  var t=new $imports.THREE.CanvasTexture(cv); t.colorSpace=$imports.THREE.SRGBColorSpace; t.anisotropy=4;
  return t;
}
function signMat(tex,extra){
  var m=new $imports.THREE.MeshLambertMaterial(Object.assign({map:tex},extra||{}));
  m.userData.disposeMap=true; return m;
}
function plaqueTex(floor,cn,en,arrows){
  return signTex(384,128,'plaque:'+floor+cn,function(g,w,h,rnd){
    var bg=g.createLinearGradient(0,0,0,h); bg.addColorStop(0,'#d4cebd'); bg.addColorStop(1,'#b9b19c');
    g.fillStyle=bg; g.fillRect(0,0,w,h);
    g.fillStyle='#24364f'; g.fillRect(12,12,110,h-24);
    g.textBaseline='middle'; g.textAlign='center';
    g.fillStyle='#ebe6d8'; g.font='700 54px '+SIGN_FONT; g.fillText(floor,67,h/2+2,96);
    g.textAlign='left'; g.fillStyle='#1d2938'; g.font='700 44px '+SIGN_FONT; signSpace(g,6);
    g.fillText(cn,142,h/2-13,arrows?160:220);
    g.font='600 15px '+SIGN_FONT; g.fillStyle='#525a66'; signSpace(g,4); g.fillText(en,144,h/2+29,arrows?160:220);
    signSpace(g,0);
    if(arrows){ g.textAlign='center'; g.fillStyle='#1d2938'; g.font='700 40px '+SIGN_FONT; g.fillText('↑↓',w-42,h/2+1); }
    g.strokeStyle='#5c574e'; g.lineWidth=3; g.strokeRect(1.5,1.5,w-3,h-3);
    [[7,7],[w-7,7],[7,h-7],[w-7,h-7]].forEach(function(p){ g.fillStyle='#8a8478'; g.beginPath(); g.arc(p[0],p[1],3.6,0,6.283); g.fill(); });
    signGrime(g,w,h,rnd,'45,32,20',520);
    for(var i=0;i<16;i++){ g.fillStyle='rgba(112,70,38,'+(0.07+rnd()*0.15).toFixed(3)+')';
      g.beginPath(); g.ellipse(rnd()*w,h-3-rnd()*11,3+rnd()*11,1.4+rnd()*3.5,0,0,6.283); g.fill(); }   /* 下沿的锈 */
  });
}
function corridorTex(){
  return signTex(512,144,'corridor',function(g,w,h,rnd){
    g.fillStyle='#203a31'; g.fillRect(0,0,w,h);
    g.strokeStyle='#d8d2bd'; g.lineWidth=3; g.strokeRect(10,10,w-20,h-20);
    g.textAlign='center'; g.textBaseline='middle'; g.fillStyle='#e2dcc8'; g.font='700 56px '+SIGN_FONT; signSpace(g,24);
    g.fillText('连廊',w/2+12,h/2-12);
    g.font='600 18px '+SIGN_FONT; g.fillStyle='#aeb09c'; signSpace(g,8); g.fillText('CORRIDOR',w/2+4,h/2+38); signSpace(g,0);
    signGrime(g,w,h,rnd,'0,0,0',320);
  });
}
function rowTex(n){
  return signTex(384,128,'row:'+n,function(g,w,h,rnd){
    g.fillStyle='#2a2b2c'; g.fillRect(0,0,w,h);
    g.save(); g.beginPath(); g.rect(0,0,w,18); g.clip();
    for(var x=-30;x<w+30;x+=26){ g.fillStyle='#b8922c'; g.beginPath(); g.moveTo(x,0); g.lineTo(x+13,0); g.lineTo(x-5,18); g.lineTo(x-18,18); g.closePath(); g.fill(); }
    g.restore();
    g.textAlign='center'; g.textBaseline='middle'; g.fillStyle='#d3ac4a'; g.font='700 52px '+SIGN_FONT;
    g.fillText('第 '+n+' 排',w/2,h/2+8,w-40);
    g.font='600 15px '+SIGN_FONT; g.fillStyle='#857a62'; signSpace(g,5); g.fillText('ROW '+(n<10?'0':'')+n,w/2,h-13); signSpace(g,0);
    signGrime(g,w,h,rnd,'0,0,0',280);
  });
}
function plateTex(text){
  return signTex(352,112,'plate:'+text,function(g,w,h,rnd){
    g.fillStyle='#cfd3da'; signRR(g,0,0,w,h,12); g.fill();
    var bg=g.createLinearGradient(0,0,0,h); bg.addColorStop(0,'#2652ab'); bg.addColorStop(1,'#183c86');
    g.fillStyle=bg; signRR(g,4,4,w-8,h-8,10); g.fill();
    g.strokeStyle='#e9edf3'; g.lineWidth=3; signRR(g,10,10,w-20,h-20,7); g.stroke();
    g.fillStyle='#f1f3f6'; g.textAlign='center'; g.textBaseline='middle'; g.font='700 60px '+SIGN_FONT;
    g.fillText(text,w/2,h/2+3,w-40);
    [[w*0.22,18],[w*0.78,18]].forEach(function(p){ g.fillStyle='#95a1b8'; g.beginPath(); g.arc(p[0],p[1],4,0,6.283); g.fill(); });
    var dirt=g.createLinearGradient(0,h*0.55,0,h); dirt.addColorStop(0,'rgba(40,36,28,0)'); dirt.addColorStop(1,'rgba(40,36,28,.28)');
    g.fillStyle=dirt; g.fillRect(0,0,w,h);
    signGrime(g,w,h,rnd,'30,26,20',260);
  });
}
function slipTex(){
  return signTex(256,340,'slip',function(g,w,h,rnd){
    g.fillStyle='#e2dbc9'; g.fillRect(0,0,w,h);
    signGrime(g,w,h,rnd,'96,74,44',620);
    g.strokeStyle='rgba(120,98,66,.28)'; g.lineWidth=1.4; g.beginPath(); g.moveTo(0,h*0.53); g.lineTo(w,h*0.50); g.stroke();   /* 对折过的折痕 */
    g.textAlign='center'; g.textBaseline='top'; g.fillStyle='#972d27'; g.font='700 25px '+SIGN_FONT; signSpace(g,6);
    g.fillText('钥匙移交单',w/2+3,18); signSpace(g,0);
    var rows=['车辆','钥匙','移交至','','记录','经办'], ink=['鄂A · 车库','备用钥匙 1 把','行政楼 五楼','校长办公室','保安岗 停车登记','（字迹潦草）'];
    g.strokeStyle='rgba(151,45,39,.65)'; g.lineWidth=1.2; g.strokeRect(14,60,w-28,6*42);
    for(var i=0;i<6;i++){
      var y=60+i*42;
      if(i){ g.beginPath(); g.moveTo(14,y); g.lineTo(w-14,y); g.stroke(); }
      g.textAlign='left'; g.textBaseline='middle'; g.fillStyle='#9a3a33'; g.font='600 15px '+SIGN_FONT; g.fillText(rows[i],22,y+21);
      g.fillStyle='rgba(30,38,84,.88)'; g.font='600 19px '+SIGN_HAND; g.fillText(ink[i],82+rnd()*4,y+22+(rnd()-.5)*3,w-100);
    }
    g.beginPath(); g.moveTo(74,60); g.lineTo(74,60+6*42); g.stroke();
    g.save(); g.translate(w-64,h-44); g.rotate(-0.22);                                  /* 圆章 */
    g.strokeStyle='rgba(178,40,36,.6)'; g.lineWidth=3.5; g.beginPath(); g.arc(0,0,30,0,6.283); g.stroke();
    g.fillStyle='rgba(178,40,36,.6)'; g.font='700 13px '+SIGN_FONT; g.textAlign='center'; g.textBaseline='middle'; g.fillText('教务处',0,9); g.fillText('★',0,-9);
    g.restore();
  });
}
function signPlate(tex,w,h,d,both){
  var face=signMat(tex), edge=signEdgeMat();
  return new $imports.THREE.Mesh(new $imports.THREE.BoxGeometry(w,h,d),[edge,edge,edge,edge,face,both?face:edge]);
}
function floorName(R){ return R.floor<0?'B'+(-R.floor):R.floor+'F'; }
function carPlate(text,x,y,z){
  var m=new $imports.THREE.Mesh(new $imports.THREE.PlaneGeometry(0.44,0.14),signMat(plateTex(text)));
  m.position.set(x,y,z); m.rotation.y=Math.PI/2; m.userData.wayfinding=text; return m;
}
function roomSigns(c,G,isWall){
  var R=c.R, K=c.K, W=c.W, H=c.H, CX=c.CX, CZ=c.CZ, tw=c.tw, th=c.th, x, y;
  if(R.host==='lift'||R.host==='dream'||R.spiral) return;            /* 电梯轿厢里、梦里、钟楼里不挂 */
  function put(mesh,px,py,pz,rot,hw,hh,hd,text){
    mesh.position.set(px,py,pz); mesh.rotation.y=rot; mesh.userData.wayfinding=text; c.meshes.push(mesh);
    if(hw) K.g('metal').proxy({t:'box',c:[px,py,pz],h:[hw,hh,hd],tc:Math.cos(rot),ts:Math.sin(rot)});   /* 给穿模审查看 */
  }
  if(R.id==='lab3'){
    var alarmTex=signTex(768,288,'network-zone-warning',function(g,w,h){
      g.fillStyle='#252a2e';g.fillRect(0,0,w,h);g.strokeStyle='#d6ad49';g.lineWidth=12;g.strokeRect(6,6,w-12,h-12);
      g.textAlign='center';g.textBaseline='middle';g.fillStyle='#ebc463';g.font='700 62px '+SIGN_FONT;g.fillText('门禁报警区',w/2,70);
      g.fillStyle='#eee8db';g.font='500 38px '+SIGN_FONT;g.fillText('跨入黄线即上报区域',w/2,155);
      g.fillText('核心机房 · 终端操作区',w/2,220);
    });
    /* 网络中心入口旁，面向普通走廊；告示与灯光不承担碰撞或报警逻辑。 */
    put(signPlate(alarmTex,1.12,.42,.012,false),CX(40),1.7,CZ(15)+th/2+.009,0,0,0,0,'门禁报警区 · 跨入黄线即上报区域');
  }
  /* 楼梯口、电梯旁的墙上：找离入口最近、正对走道的一面墙，铭牌整块落在这一格墙面里 */
  function plaque(sx,sy,gw,gd,cn,en,arrows){
    var best=null, D=[[0,-1],[0,1],[-1,0],[1,0]], mx=sx+(gw-1)/2, my=sy+(gd-1)/2, wx, wy, i;
    for(wy=sy-2;wy<=sy+gd+1;wy++) for(wx=sx-2;wx<=sx+gw+1;wx++){
      if(!isWall(wx,wy)) continue;
      for(i=0;i<4;i++){
        var d=D[i]; if(G(wy+d[1],wx+d[0])!=='.') continue;
        var dist=Math.hypot(wx-mx,wy-my)+(d[1]!==0?0:0.25)+wx*1e-4;
        if(!best||dist<best.dist) best={x:wx,y:wy,d:d,dist:dist};
      }
    }
    if(!best) return;
    var d=best.d, rot=Math.atan2(d[0],d[1]), text=floorName(R)+' '+cn;
    put(signPlate(plaqueTex(floorName(R),cn,en,arrows),0.54,0.18,0.012,false),
      CX(best.x)+d[0]*(tw/2+0.007),1.72,CZ(best.y)+d[1]*(th/2+0.007),rot,0.27,0.09,0.006,text);
  }
  for(y=0;y<H;y++) for(x=0;x<W;x++){
    var ch=R.grid[y][x];
    if(ch==='S'&&G(y,x-1)!=='S'&&G(y-1,x)!=='S'){
      var gw=1, gd=1; while(G(y,x+gw)==='S') gw++; while(G(y+gd,x)==='S') gd++;
      plaque(x,y,gw,gd,'楼梯','STAIRS',true);
    }
    if(ch==='J'&&R.host!=='lift') plaque(x,y,1,1,'电梯','LIFT',false);   /* 轿厢里不挂 */
    if(ch==='L'){                                                     /* FURN.L 吊的那块牌子：板面 0.70×0.20，前后两面 */
      var ly=$imports.WALLH-0.25, tex=corridorTex(), mat=signMat(tex);
      for(var side=-1;side<=1;side+=2){
        var pl=new $imports.THREE.Mesh(new $imports.THREE.PlaneGeometry(0.66,0.18),mat);
        put(pl,CX(x),ly,CZ(y)+side*0.0168,side>0?0:Math.PI,0,0,0,'连廊');
      }
    }
    if(ch==='V'&&R.grid[y].slice(x+1).indexOf('V')<0){                /* 车库：每一排最东头那辆车的上方吊一块排号 */
      var px=CX(x), pz=CZ(y), top=2.36+0.135, ceil=c.RWH||$imports.WALLH;
      put(signPlate(rowTex(y+1),0.80,0.27,0.02,true),px,2.36,pz,Math.PI/2,0.40,0.135,0.01,'第 '+(y+1)+' 排');
      K.rod('metal',px,top,pz-0.30,px,ceil,pz-0.30,0.005,0.005,4,0x8a8f93,1.0);
      K.rod('metal',px,top,pz+0.30,px,ceil,pz+0.30,0.005,0.005,4,0x8a8f93,1.0);
    }
  }
  /* 自己教室的讲台上：那张停车单提到的钥匙移交单。讲台转了 90°（正面朝东边的学生），
     台面上的位置按讲台自己的坐标（右手边、靠学生那侧）换算，字头朝黑板，从学生那边看是正的 */
  if(R.id==='teach1'&&typeof $imports.Investigation!=='undefined'){
    var pd=$imports.Investigation.podium();
    if(pd){
      var pr=Math.PI/2, lx=0.23, lz=0.04;
      var slip=new $imports.THREE.Mesh(new $imports.THREE.PlaneGeometry(0.15,0.2),signMat(slipTex()));
      slip.position.set(CX(pd[0])+lx*Math.cos(pr)+lz*Math.sin(pr),0.9825,CZ(pd[1])-lx*Math.sin(pr)+lz*Math.cos(pr)); slip.rotation.set(-Math.PI/2,0,0.12+pr);
      slip.userData.wayfinding='移交单'; c.meshes.push(slip);
    }
  }
  if(R.host==='teach'&&/^teach[1-5]$/.test(R.id)) classroomSigns(c,put);
}
/* ---- 教学楼教室里的字：前墙黑板上方的班训、左右两边的课程表和值日表，走廊那面门牌上的班名，自己课桌上的名牌 ---- */
var CLASS_MOTTO=['勤学 · 慎思 · 笃行','天道酬勤','宁静致远','厚德载物 · 自强不息','学而不厌','静心 · 笃学 · 致远'];
var TIMETABLE_SUBJ=['数学','英语','物理','化学','生物','政治','历史','地理','体育','数学','英语','自习'];
var DUTY_NAMES=['王浩','李欣然','张一鸣','陈思雨','刘洋','赵子涵','周磊','吴佳怡','孙宇航','郑晓','黄俊杰','林雨桐','何静','高翔','马睿','许诺'];
function className(floor,i){
  if(floor===1){ var n=$imports.CLS_NAME[i]; return n.replace(/(\d+)班$/,'（$1）班'); }
  var grade=['高一','高二','高三','高一'][(floor-2)%4], base=[4,4,3,10][(floor-2)%4];
  return grade+'（'+(base+i)+'）班';
}
function mottoTex(text){
  return signTex(1024,128,'motto:'+text,function(g,w,h,rnd){
    g.fillStyle='#8f1d1b'; g.fillRect(0,0,w,h);
    var sh=g.createLinearGradient(0,0,0,h); sh.addColorStop(0,'rgba(255,255,255,.08)'); sh.addColorStop(1,'rgba(0,0,0,.18)');
    g.fillStyle=sh; g.fillRect(0,0,w,h);
    g.textAlign='center'; g.textBaseline='middle'; g.fillStyle='#e9c25a'; g.font='700 74px '+SIGN_FONT; signSpace(g,text.length<6?36:14);
    g.fillText(text,w/2,h/2+4,w-80); signSpace(g,0);
    signGrime(g,w,h,rnd,'20,8,4',420);
  });
}
function timetableTex(cls,seed){
  return signTex(384,512,'timetable:'+cls,function(g,w,h,rnd){
    g.fillStyle='#ece8dc'; g.fillRect(0,0,w,h);
    g.fillStyle='#2b4f86'; g.fillRect(0,0,w,64);
    g.fillStyle='#f1efe8'; g.textAlign='center'; g.textBaseline='middle'; g.font='700 30px '+SIGN_FONT; signSpace(g,6);
    g.fillText(cls+' 课程表',w/2,33,w-24); signSpace(g,0);
    var x0=18, y0=80, cw=(w-36)/6, ch=(h-y0-20)/9, days=['','一','二','三','四','五'], r, d;
    g.strokeStyle='rgba(43,79,134,.55)'; g.lineWidth=1.2;
    for(r=0;r<=9;r++){ g.beginPath(); g.moveTo(x0,y0+r*ch); g.lineTo(w-x0,y0+r*ch); g.stroke(); }
    for(d=0;d<=6;d++){ g.beginPath(); g.moveTo(x0+d*cw,y0); g.lineTo(x0+d*cw,y0+9*ch); g.stroke(); }
    g.font='600 19px '+SIGN_FONT; g.fillStyle='#2b4f86';
    for(d=1;d<=5;d++) g.fillText(days[d],x0+(d+.5)*cw,y0+ch/2);
    for(r=1;r<=8;r++){
      g.fillStyle='#2b4f86'; g.fillText(String(r),x0+cw/2,y0+(r+.5)*ch);
      for(d=1;d<=5;d++){
        var s=r===4?'语文':TIMETABLE_SUBJ[Math.floor((seed*13+r*7+d*5+(r>4?3:0))%TIMETABLE_SUBJ.length)];   /* 第 4 节：每天都是语文 */
        g.fillStyle=r===4?'#7a2a24':'#2a2d33'; g.font=(r===4?'700 ':'500 ')+'18px '+SIGN_FONT;
        g.fillText(s,x0+(d+.5)*cw,y0+(r+.5)*ch);
      }
    }
    g.strokeStyle='rgba(60,50,40,.12)'; g.lineWidth=2; g.beginPath(); g.moveTo(0,h*0.48); g.lineTo(w,h*0.5); g.stroke();   /* 折过的印子 */
    signGrime(g,w,h,rnd,'70,60,40',500);
  });
}
function dutyTex(cls,seed){
  return signTex(384,512,'duty:'+cls,function(g,w,h,rnd){
    g.fillStyle='#e7e2d3'; g.fillRect(0,0,w,h);
    g.fillStyle='#3b6b47'; g.fillRect(0,0,w,64);
    g.fillStyle='#eef0e6'; g.textAlign='center'; g.textBaseline='middle'; g.font='700 32px '+SIGN_FONT; signSpace(g,10);
    g.fillText('值日表',w/2,33); signSpace(g,0);
    var days=['周一','周二','周三','周四','周五'], jobs='扫地 · 拖地 · 擦黑板 · 倒垃圾', y=82, d, k;
    g.font='500 15px '+SIGN_FONT; g.fillStyle='#4a5a4a'; g.fillText(jobs,w/2,y); y+=20;
    for(d=0;d<5;d++){
      var yy=y+d*78;
      g.strokeStyle='rgba(59,107,71,.5)'; g.lineWidth=1.2; g.strokeRect(16,yy,w-32,70);
      g.textAlign='left'; g.fillStyle='#3b6b47'; g.font='700 20px '+SIGN_FONT; g.fillText(days[d],26,yy+35);
      g.fillStyle='rgba(28,34,70,.85)'; g.font='600 21px '+SIGN_HAND;
      for(k=0;k<3;k++) g.fillText(DUTY_NAMES[(seed*5+d*3+k)%DUTY_NAMES.length],100+k*88+rnd()*6,yy+36+(rnd()-.5)*5,82);
    }
    signGrime(g,w,h,rnd,'70,60,40',480);
  });
}
function doorNameTex(text){
  return signTex(256,64,'doorname:'+text,function(g,w,h,rnd){
    g.fillStyle='#2a3a4a'; g.fillRect(0,0,w,h);
    g.textAlign='center'; g.textBaseline='middle'; g.fillStyle='#eef1f4'; g.font='700 40px '+SIGN_FONT;
    g.fillText(text,w/2,h/2+2,w-16);
    signGrime(g,w,h,rnd,'0,0,0',90);
  });
}
/* 自己的名牌：对折立着的纸，手写的三个字——看得出是个名字，认不出是什么字（开场独白：「名牌上写的是我的名字」） */
function nameCardTex(){
  return signTex(256,128,'namecard',function(g,w,h,rnd){
    g.fillStyle='#ece6d6'; g.fillRect(0,0,w,h);
    g.strokeStyle='rgba(28,34,78,.82)'; g.lineWidth=2.6; g.lineCap='round'; g.lineJoin='round';
    for(var k=0;k<3;k++){                                                      /* 每个字一团连笔：横、竖、撇、捺挤在一个方格里 */
      var cx=w*(0.27+k*0.23), cy=h*0.52, n=6+Math.floor(rnd()*3);
      g.beginPath(); g.moveTo(cx-18+rnd()*8,cy-16+rnd()*10);
      for(var s=0;s<n;s++) g.quadraticCurveTo(cx+(rnd()-.5)*40,cy+(rnd()-.5)*40,cx+(rnd()-.5)*36,cy+(rnd()-.5)*34);
      g.stroke();
    }
    signGrime(g,w,h,rnd,'90,80,60',220);
  });
}
function classroomSigns(c,put){
  var R=c.R, L=$imports.ClassroomLayout, CX=c.CX, CZ=c.CZ, tw=c.tw, th=c.th, i;
  for(i=0;i<L.spans.length;i++){
    var c0=L.spans[i][0], wx=CX(c0)-tw/2, zb=CZ(L.boardRow), cls=className(R.floor||1,i), seed=(R.floor||1)*7+i;
    /* 前墙（西）：黑板上方的班训，北边课程表、南边值日表（避开空调、插座、喇叭和饮水机） */
    put(signPlate(mottoTex(CLASS_MOTTO[seed%CLASS_MOTTO.length]),2.4,0.30,0.012,false),wx+0.008,2.62,zb,Math.PI/2,0,0,0,'班训');
    put(signPlate(timetableTex(cls,seed),0.48,0.64,0.004,false),wx+0.004,1.52,CZ(3),Math.PI/2,0,0,0,'课程表');
    put(signPlate(dutyTex(cls,seed),0.48,0.64,0.004,false),wx+0.004,1.52,CZ(11)+th*0.2,Math.PI/2,0,0,0,'值日表');
    /* 门牌：两扇门上（门牌模型的深蓝字条在门洞中心往西 0.1、离地 2.32、走廊那面） */
    L.doors(i).forEach(function(d){
      var pl=new $imports.THREE.Mesh(new $imports.THREE.PlaneGeometry(0.25,0.056),signMat(doorNameTex(cls)));
      put(pl,CX(d[0])-0.1,2.32,CZ(d[1])+th/2+0.0325,0,0,0,0,cls);
    });
  }
  /* 自己的课桌：右前角立着一张对折的名牌（写着名字，看不清）。桌子的局部坐标里人在 +z，转 90° 以后局部 (x, z) 落到场景的 (z, −x) */
  if(R.id===L.ownSeat.room){
    var own=L.ownSeat, dk=L.deskAt(own.col,own.row);
    var dx=CX(own.col)+(dk.x-own.col-0.5)*tw, dz=CZ(own.row)+(dk.y-own.row-0.5)*th, lx=0.17, lz=-0.15;
    var mat=signMat(nameCardTex(),{side:$imports.THREE.DoubleSide});
    [-1,1].forEach(function(s){                                               /* 两片纸靠在一起，顶上合拢 */
      var m=new $imports.THREE.Mesh(new $imports.THREE.PlaneGeometry(0.12,0.062),mat);
      m.position.set(dx+lz+s*0.009,0.7575+0.03,dz-lx); m.rotation.set(0,Math.PI/2,0); m.rotateX(-s*0.29);
      m.userData.wayfinding='名牌'; c.meshes.push(m);
    });
  }
}

/* @module-exports */
GameModules.publish("game3d/js/model/room.js",{
"buildRoomGeometry":{get:function(){return buildRoomGeometry;},set:function($value){buildRoomGeometry=$value;}},
"buildCustomRoom":{get:function(){return buildCustomRoom;},set:function($value){buildCustomRoom=$value;}},
"buildDoorLeaf":{get:function(){return buildDoorLeaf;},set:function($value){buildDoorLeaf=$value;}},
"buildDoorLeaves":{get:function(){return buildDoorLeaves;},set:function($value){buildDoorLeaves=$value;}},
"roomDoorRefresh":{get:function(){return roomDoorRefresh;},set:function($value){roomDoorRefresh=$value;}},
"CHALK_TEXTS":{get:function(){return CHALK_TEXTS;},set:function($value){CHALK_TEXTS=$value;}},
"CHALK_MAT":{get:function(){return CHALK_MAT;},set:function($value){CHALK_MAT=$value;}},
"chalkBoard":{get:function(){return chalkBoard;},set:function($value){chalkBoard=$value;}},
"roomDecay":{get:function(){return roomDecay;},set:function($value){roomDecay=$value;}},
"SIGN_FONT":{get:function(){return SIGN_FONT;},set:function($value){SIGN_FONT=$value;}},
"SIGN_HAND":{get:function(){return SIGN_HAND;},set:function($value){SIGN_HAND=$value;}},
"SIGN_EDGE_MAT":{get:function(){return SIGN_EDGE_MAT;},set:function($value){SIGN_EDGE_MAT=$value;}},
"signEdgeMat":{get:function(){return signEdgeMat;},set:function($value){signEdgeMat=$value;}},
"signRand":{get:function(){return signRand;},set:function($value){signRand=$value;}},
"signRR":{get:function(){return signRR;},set:function($value){signRR=$value;}},
"signGrime":{get:function(){return signGrime;},set:function($value){signGrime=$value;}},
"signSpace":{get:function(){return signSpace;},set:function($value){signSpace=$value;}},
"signTex":{get:function(){return signTex;},set:function($value){signTex=$value;}},
"signMat":{get:function(){return signMat;},set:function($value){signMat=$value;}},
"plaqueTex":{get:function(){return plaqueTex;},set:function($value){plaqueTex=$value;}},
"corridorTex":{get:function(){return corridorTex;},set:function($value){corridorTex=$value;}},
"rowTex":{get:function(){return rowTex;},set:function($value){rowTex=$value;}},
"plateTex":{get:function(){return plateTex;},set:function($value){plateTex=$value;}},
"slipTex":{get:function(){return slipTex;},set:function($value){slipTex=$value;}},
"signPlate":{get:function(){return signPlate;},set:function($value){signPlate=$value;}},
"floorName":{get:function(){return floorName;},set:function($value){floorName=$value;}},
"carPlate":{get:function(){return carPlate;},set:function($value){carPlate=$value;}},
"roomSigns":{get:function(){return roomSigns;},set:function($value){roomSigns=$value;}},
"CLASS_MOTTO":{get:function(){return CLASS_MOTTO;},set:function($value){CLASS_MOTTO=$value;}},
"TIMETABLE_SUBJ":{get:function(){return TIMETABLE_SUBJ;},set:function($value){TIMETABLE_SUBJ=$value;}},
"DUTY_NAMES":{get:function(){return DUTY_NAMES;},set:function($value){DUTY_NAMES=$value;}},
"className":{get:function(){return className;},set:function($value){className=$value;}},
"mottoTex":{get:function(){return mottoTex;},set:function($value){mottoTex=$value;}},
"timetableTex":{get:function(){return timetableTex;},set:function($value){timetableTex=$value;}},
"dutyTex":{get:function(){return dutyTex;},set:function($value){dutyTex=$value;}},
"doorNameTex":{get:function(){return doorNameTex;},set:function($value){doorNameTex=$value;}},
"nameCardTex":{get:function(){return nameCardTex;},set:function($value){nameCardTex=$value;}},
"classroomSigns":{get:function(){return classroomSigns;},set:function($value){classroomSigns=$value;}}
});
})(GameModules.imports("game3d/js/model/room.js"));
