/* @module-capsule */
(function($imports){
/* 里世界 3D · 目光
   "凝视"用的眼睛：黑暗里浮着的一只只杏仁形眼睛，眼眶一圈像火苗一样往外炸的黄光，
   里面是一圈圈的螺旋虹膜 —— 有的金黄、有的血红。全部是画在 canvas 上的贴图，
   做成永远正对镜头的 Sprite：不管你站在哪儿，它们都在看你。 */
'use strict';

var GAZE_TEX={};
function gazeEyeTex(kind){
  if(GAZE_TEX[kind]) return GAZE_TEX[kind];
  var W=256, H=176, cx=W/2, cy=H/2;
  var cv=document.createElement('canvas'); cv.width=W; cv.height=H;
  var c=cv.getContext('2d');
  var seed=(kind==='red')?7:3;
  function rnd(){ seed=(seed*16807)%2147483647; return seed/2147483647; }
  /* 眼眶：上下两条二次曲线 */
  var L=30, Rr=W-30, up=cy-70, dn=cy+70;
  function lid(path){
    path.moveTo(L,cy);
    path.quadraticCurveTo(cx,up,Rr,cy);
    path.quadraticCurveTo(cx,dn,L,cy);
    path.closePath();
  }
  function lidPt(t){                        /* t: 0..1 上眼睑，1..2 下眼睑 */
    var u=(t<1)?t:(t-1), a, b, k, x, y, nx, ny;
    if(t<1){ a=[L,cy]; b=[cx,up]; k=[Rr,cy]; } else { a=[Rr,cy]; b=[cx,dn]; k=[L,cy]; }
    x=(1-u)*(1-u)*a[0]+2*u*(1-u)*b[0]+u*u*k[0];
    y=(1-u)*(1-u)*a[1]+2*u*(1-u)*b[1]+u*u*k[1];
    var tx=2*(1-u)*(b[0]-a[0])+2*u*(k[0]-b[0]), ty=2*(1-u)*(b[1]-a[1])+2*u*(k[1]-b[1]);
    var tl=Math.sqrt(tx*tx+ty*ty)||1;
    nx=ty/tl; ny=-tx/tl;                    /* 朝外的法线 */
    if((x-cx)*nx+(y-cy)*ny<0){ nx=-nx; ny=-ny; }
    return [x,y,nx,ny];
  }
  /* 一圈往外炸的火苗 */
  c.save();
  c.shadowColor='rgba(255,170,30,0.95)'; c.shadowBlur=18;
  var i, n=34;
  for(i=0;i<n;i++){
    var t=(i+rnd()*0.5)/n*2, p=lidPt(t);
    var len=10+rnd()*22, half=4+rnd()*5, bend=(rnd()-0.5)*0.8;
    var tx2=-p[3], ty2=p[2];
    var g=c.createLinearGradient(p[0],p[1],p[0]+p[2]*len,p[1]+p[3]*len);
    g.addColorStop(0,'#ffe36a'); g.addColorStop(1,'rgba(255,150,20,0.15)');
    c.fillStyle=g;
    c.beginPath();
    c.moveTo(p[0]+tx2*half,p[1]+ty2*half);
    c.quadraticCurveTo(p[0]+p[2]*len*0.6+tx2*half*bend*4,p[1]+p[3]*len*0.6+ty2*half*bend*4,
                       p[0]+p[2]*len+tx2*bend*10,p[1]+p[3]*len+ty2*bend*10);
    c.lineTo(p[0]-tx2*half,p[1]-ty2*half);
    c.closePath(); c.fill();
  }
  c.restore();
  /* 眼眶里是黑的 */
  c.save();
  c.beginPath(); lid(c);
  c.fillStyle='#160b04'; c.fill();
  c.clip();
  /* 虹膜：一圈圈的螺旋 */
  var ir=46;
  if(kind==='red'){
    var rg=c.createRadialGradient(cx,cy,4,cx,cy,ir);
    rg.addColorStop(0,'#ff4a2a'); rg.addColorStop(0.7,'#c4201a'); rg.addColorStop(1,'#6a0c08');
    c.fillStyle=rg; c.beginPath(); c.arc(cx,cy,ir,0,6.2832); c.fill();
    c.strokeStyle='rgba(90,6,4,0.85)'; c.lineWidth=3;
  }else{
    c.fillStyle='#ffb21e'; c.beginPath(); c.arc(cx,cy,ir,0,6.2832); c.fill();
    c.strokeStyle='#4a2405'; c.lineWidth=4;
  }
  c.beginPath();                            /* 阿基米德螺线：三圈半 */
  var a0, r0;
  for(i=0;i<=220;i++){
    a0=i/220*Math.PI*7; r0=5+(ir-7)*(i/220);
    if(i===0) c.moveTo(cx+Math.cos(a0)*r0,cy+Math.sin(a0)*r0); else c.lineTo(cx+Math.cos(a0)*r0,cy+Math.sin(a0)*r0);
  }
  c.stroke();
  c.fillStyle=(kind==='red')?'#2a0402':'#d2261a';
  c.beginPath(); c.arc(cx,cy,(kind==='red')?8:10,0,6.2832); c.fill();
  c.restore();
  /* 眼眶描边 */
  c.save();
  c.shadowColor='rgba(255,190,40,0.9)'; c.shadowBlur=10;
  c.strokeStyle='#ffd640'; c.lineWidth=7;
  c.beginPath(); lid(c); c.stroke();
  c.restore();
  var tex=new $imports.THREE.CanvasTexture(cv);
  tex.colorSpace=$imports.THREE.SRGBColorSpace;
  GAZE_TEX[kind]=tex;
  return tex;
}
/* 一只眼睛。尺寸是宽度（米）；材质每只一份，好各自淡入淡出 */
function gazeEye(size,kind){
  var mat=new $imports.THREE.SpriteMaterial({map:gazeEyeTex(kind||($imports.PresentationRandom.next()<0.4?'red':'gold')),
    transparent:true,depthWrite:false,depthTest:false,fog:false,opacity:0});   /* 隔着墙也看得见：它们本来就不在墙里 */
  var sp=new $imports.THREE.Sprite(mat);
  sp.scale.set(size,size*0.6875,1);
  sp.renderOrder=5;
  return sp;
}
/* 墙面上的落点：贴着墙、离你不太远，像黑暗里一只只睁开的眼睛 */
function gazeWallSpots(R,maxN,nearM){
  var out=[], rr, cc, k, dirs=[[1,0],[-1,0],[0,1],[0,-1]];
  if(!R) return out;
  for(rr=0;rr<R.rows;rr++) for(cc=0;cc<R.cols;cc++){
    if(R.grid[rr][cc]!=='#') continue;
    for(k=0;k<4;k++){
      var c2=cc+dirs[k][0], r2=rr+dirs[k][1];
      if(r2<0||r2>=R.rows||c2<0||c2>=R.cols) continue;
      if(R.grid[r2][c2]==='#') continue;
      var wx=R.ox+(cc+0.5+dirs[k][0]*0.5)*R.tw, wy=R.oy+(rr+0.5+dirs[k][1]*0.5)*R.th;
      var d=Math.sqrt((wx-$imports.S.x)*(wx-$imports.S.x)+(wy-$imports.S.y)*(wy-$imports.S.y))*$imports.U2M;
      if(d>nearM||d<2.4) continue;          /* 贴脸的那面墙不放：挡住半个屏幕就不是"看着你"了 */
      out.push({wx:wx,wy:wy,nx:dirs[k][0],nz:dirs[k][1],d:d});
    }
  }
  for(k=out.length-1;k>0;k--){ var j=Math.floor($imports.PresentationRandom.next()*(k+1)), tmp=out[k]; out[k]=out[j]; out[j]=tmp; }
  return out.slice(0,maxN);
}

/* @module-exports */
GameModules.publish("game3d/js/fx/gaze.js",{
"GAZE_TEX":{get:function(){return GAZE_TEX;},set:function($value){GAZE_TEX=$value;}},
"gazeEyeTex":{get:function(){return gazeEyeTex;},set:function($value){gazeEyeTex=$value;}},
"gazeEye":{get:function(){return gazeEye;},set:function($value){gazeEye=$value;}},
"gazeWallSpots":{get:function(){return gazeWallSpots;},set:function($value){gazeWallSpots=$value;}}
});
})(GameModules.imports("game3d/js/fx/gaze.js"));
