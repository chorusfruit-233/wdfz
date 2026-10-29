/* 里世界 3D · 建模工具
   GeoBuilder：往一个 BufferGeometry 里加图元（盒、倒角盒、圆柱/圆台、两点之间的杆、椭球、四边形）。
     · 顶点色决定颜色；贴图坐标按世界坐标投影（法线朝哪个轴就用另外两个轴），所以纹理在物体之间连续。
     · frame(x,z,rotY) 设一个局部坐标系：家具按自己的"正面"建，放的时候再转过去。
   Kit：按材质分开的一组 GeoBuilder，最后 build() 成一个 Group（每种材质一个 Mesh）。
   "流畅"画质下倒角退化成普通盒、圆柱减段数，顶点数大约少一半。
   省资源（画出来和以前一样）：类型化数组建模、压缩顶点格式、不建贴地朝下 / 贴吊顶朝上的面、
   大网格按位置切块做视锥剔除。数字见 docs/3D更新说明.md「建模内核重写」。
   写实化（见「建模写实化」）：圆柱、杆、椭球平滑着色；旋转体 lathe、挤出体 prism、叶片卡 leafCards；Kit.sub 嵌套坐标。 */
'use strict';

function hash2(a,b){ var h=(a*374761393+b*668265263)^0x5bf03635; h=(h^(h>>13))*1274126177; return ((h^(h>>16))>>>0)/4294967295; }
function shadeHex(col,s){
  var r=Math.min(255,Math.max(0,((col>>16)&255)*s))|0;
  var g=Math.min(255,Math.max(0,((col>>8)&255)*s))|0;
  var b=Math.min(255,Math.max(0,(col&255)*s))|0;
  return (r<<16)|(g<<8)|b;
}
function lodLow(){ return QP().lodLow; }
/* 圆柱、杆、椭球的分段数按档位缩放：流畅 0.6 倍、超精细 1.6 倍 */
function lodSeg(seg,min){ return Math.max(min||4,Math.round(seg*QP().segMul)); }

var UVTILE=2.4;
/* ---- 存储：类型化数组，按需翻倍扩容 ----
   以前每个分量都 push 进普通数组（每个数 8 字节，还要再拷一份成 Float32Array），一层楼要过几十万个临时数组。
   现在建模时直接写进 Float32Array / Int8Array，出网格时只拷一次实际用到的长度。
   法线建模时就存成 8 位整数（×127），颜色、贴图坐标先存 32 位浮点，出网格时再压缩（见 geoFromArrays）。 */
function GeoBuilder(uv,K){
  this.uv=uv||UVTILE; this.K=K||null;
  this.T={x:0,y:0,z:0,c:1,s:0};
  this.v=0; this.ni=0; this.vc=0; this.ic=0;
  this.P=null; this.N=null; this.C=null; this.U=null; this.I=null;
}
var BoxBuilder=GeoBuilder;          /* 旧名字 */
GeoBuilder.prototype._grow=function(nv,ni){
  var c, a;
  if(nv>this.vc){
    c=Math.max(256,nv,this.vc*2);
    a=new Float32Array(c*3); if(this.P) a.set(this.P.subarray(0,this.v*3)); this.P=a;
    a=new Int8Array(c*3);    if(this.N) a.set(this.N.subarray(0,this.v*3)); this.N=a;
    a=new Float32Array(c*3); if(this.C) a.set(this.C.subarray(0,this.v*3)); this.C=a;
    a=new Float32Array(c*2); if(this.U) a.set(this.U.subarray(0,this.v*2)); this.U=a;
    this.vc=c;
  }
  if(ni>this.ic){
    c=Math.max(384,ni,this.ic*2);
    a=new Uint32Array(c); if(this.I) a.set(this.I.subarray(0,this.ni)); this.I=a;
    this.ic=c;
  }
};
GeoBuilder.prototype.tf=function(){ return this.K?this.K.T:this.T; };
GeoBuilder.prototype.frame=function(x,z,rot,y){ var T=this.tf(); T.x=x||0; T.z=z||0; T.y=y||0; T.c=Math.cos(rot||0); T.s=Math.sin(rot||0); return this; };
GeoBuilder.prototype.unframe=function(){ return this.frame(0,0,0,0); };
/* 局部 → 世界：绕 y 轴转（与 three.js 的 rotation.y 同向） */
GeoBuilder.prototype._pt=function(x,y,z){ var T=this.tf(); return [T.x+x*T.c+z*T.s, T.y+y, T.z-x*T.s+z*T.c]; };
GeoBuilder.prototype._nm=function(x,y,z){ var T=this.tf(); return [x*T.c+z*T.s, y, -x*T.s+z*T.c]; };
GeoBuilder.prototype._rgb=function(col,shade){
  shade=shade===undefined?1:shade;
  return [((col>>16)&255)/255*shade, ((col>>8)&255)/255*shade, (col&255)/255*shade];
};
/* 加一个多边形面（3 或 4 个点，局部坐标），n 为局部法线。
   Kit 设了 cull 时，永远看不见的面不建：
     · 贴着地面、朝下的面（家具、台阶、墙脚压在地上的那一面；镜头永远在地面以上）；
     · 有吊顶的房间里，贴着吊顶、朝上的面（吊顶挡着，镜头在下面）。 */
var FACE_W=new Float64Array(12);
/* vn（可选）：每个顶点自己的法线（局部坐标）。圆柱、杆、椭球、旋转体的侧面用它做平滑着色，
   顶点还是每个面各自一份（颜色、贴图坐标照旧按面算），只是法线沿曲面连续，看起来是圆的而不是一棱一棱的。 */
GeoBuilder.prototype.face=function(pts,n,rgb,noTf,vn,uvs){
  var T=this.tf(), m=pts.length, k, nx, ny, nz, W=FACE_W, ymin=1e9, ymax=-1e9;
  if(noTf){ nx=n[0]; ny=n[1]; nz=n[2]; }
  else{ nx=n[0]*T.c+n[2]*T.s; ny=n[1]; nz=-n[0]*T.s+n[2]*T.c; }
  for(k=0;k<m;k++){
    var q=pts[k], wx, wy, wz;
    if(noTf){ wx=q[0]; wy=q[1]; wz=q[2]; }
    else{ wx=T.x+q[0]*T.c+q[2]*T.s; wy=T.y+q[1]; wz=T.z-q[0]*T.s+q[2]*T.c; }
    W[k*3]=wx; W[k*3+1]=wy; W[k*3+2]=wz;
    if(wy<ymin) ymin=wy; if(wy>ymax) ymax=wy;
  }
  var cull=this.K&&this.K.cull;
  if(cull){
    if(ny<-0.9&&ymax<=cull.floor) return;
    if(cull.ceil!==undefined&&ny>0.9&&ymin>=cull.ceil) return;
  }
  var v=this.v, ni=this.ni;
  this._grow(v+m, ni+(m===3?3:6));
  var P=this.P, N=this.N, C=this.C, U=this.U, I=this.I, uv=this.uv;
  var ax=Math.abs(nx), ay=Math.abs(ny), az=Math.abs(nz), axis=(ax>=ay&&ax>=az)?0:(ay>=az?1:2);
  var qx=Math.round(nx*127), qy=Math.round(ny*127), qz=Math.round(nz*127);
  for(k=0;k<m;k++){
    var o=(v+k)*3, o2=(v+k)*2, x=W[k*3], y=W[k*3+1], z=W[k*3+2];
    P[o]=x; P[o+1]=y; P[o+2]=z;
    if(vn){
      var a=vn[k], vx=a[0], vy=a[1], vz=a[2];
      if(!noTf){ var tx=vx*T.c+vz*T.s; vz=-vx*T.s+vz*T.c; vx=tx; }
      N[o]=Math.round(vx*127); N[o+1]=Math.round(vy*127); N[o+2]=Math.round(vz*127);
    }else{ N[o]=qx; N[o+1]=qy; N[o+2]=qz; }
    C[o]=rgb[0]; C[o+1]=rgb[1]; C[o+2]=rgb[2];
    if(uvs){ U[o2]=uvs[k][0]; U[o2+1]=uvs[k][1]; }                 /* 叶片卡这种整张贴图铺满一个面的 */
    else if(axis===0){ U[o2]=z/uv; U[o2+1]=y/uv; }
    else if(axis===1){ U[o2]=x/uv; U[o2+1]=z/uv; }
    else{ U[o2]=x/uv; U[o2+1]=y/uv; }
  }
  if(m===3){ I[ni]=v; I[ni+1]=v+1; I[ni+2]=v+2; this.ni=ni+3; }
  else{ I[ni]=v; I[ni+1]=v+1; I[ni+2]=v+2; I[ni+3]=v; I[ni+4]=v+2; I[ni+5]=v+3; this.ni=ni+6; }
  this.v=v+m;
};
GeoBuilder.prototype.box=function(x,y,z,sx,sy,sz,col,shade){
  var rgb=this._rgb(col,shade), hx=sx/2,hy=sy/2,hz=sz/2;
  this.face([[x-hx,y-hy,z+hz],[x+hx,y-hy,z+hz],[x+hx,y+hy,z+hz],[x-hx,y+hy,z+hz]],[0,0,1],rgb);
  this.face([[x+hx,y-hy,z-hz],[x-hx,y-hy,z-hz],[x-hx,y+hy,z-hz],[x+hx,y+hy,z-hz]],[0,0,-1],rgb);
  this.face([[x+hx,y-hy,z+hz],[x+hx,y-hy,z-hz],[x+hx,y+hy,z-hz],[x+hx,y+hy,z+hz]],[1,0,0],rgb);
  this.face([[x-hx,y-hy,z-hz],[x-hx,y-hy,z+hz],[x-hx,y+hy,z+hz],[x-hx,y+hy,z-hz]],[-1,0,0],rgb);
  this.face([[x-hx,y+hy,z+hz],[x+hx,y+hy,z+hz],[x+hx,y+hy,z-hz],[x-hx,y+hy,z-hz]],[0,1,0],rgb);
  this.face([[x-hx,y-hy,z-hz],[x+hx,y-hy,z-hz],[x+hx,y-hy,z+hz],[x-hx,y-hy,z+hz]],[0,-1,0],rgb);
};
/* 只要几面的盒（墙体合并后用：看不见的面不建） */
GeoBuilder.prototype.boxFaces=function(x,y,z,sx,sy,sz,col,shade,faces){
  var rgb=this._rgb(col,shade), hx=sx/2,hy=sy/2,hz=sz/2;
  if(faces.indexOf('s')>=0) this.face([[x-hx,y-hy,z+hz],[x+hx,y-hy,z+hz],[x+hx,y+hy,z+hz],[x-hx,y+hy,z+hz]],[0,0,1],rgb);
  if(faces.indexOf('n')>=0) this.face([[x+hx,y-hy,z-hz],[x-hx,y-hy,z-hz],[x-hx,y+hy,z-hz],[x+hx,y+hy,z-hz]],[0,0,-1],rgb);
  if(faces.indexOf('e')>=0) this.face([[x+hx,y-hy,z+hz],[x+hx,y-hy,z-hz],[x+hx,y+hy,z-hz],[x+hx,y+hy,z+hz]],[1,0,0],rgb);
  if(faces.indexOf('w')>=0) this.face([[x-hx,y-hy,z-hz],[x-hx,y-hy,z+hz],[x-hx,y+hy,z+hz],[x-hx,y+hy,z-hz]],[-1,0,0],rgb);
  if(faces.indexOf('u')>=0) this.face([[x-hx,y+hy,z+hz],[x+hx,y+hy,z+hz],[x+hx,y+hy,z-hz],[x-hx,y+hy,z-hz]],[0,1,0],rgb);
  if(faces.indexOf('d')>=0) this.face([[x-hx,y-hy,z-hz],[x+hx,y-hy,z-hz],[x+hx,y-hy,z+hz],[x-hx,y-hy,z+hz]],[0,-1,0],rgb);
};
/* 倒角盒：12 条棱切成 45°，8 个角是三角面 */
GeoBuilder.prototype.bevel=function(x,y,z,sx,sy,sz,col,shade,r){
  r=r===undefined?0.02:r;
  r=Math.min(r,sx*0.3,sy*0.3,sz*0.3);
  if(lodLow()||r<0.004){ this.box(x,y,z,sx,sy,sz,col,shade); return; }
  var rgb=this._rgb(col,shade), hx=sx/2,hy=sy/2,hz=sz/2, a=hx-r,b=hy-r,c=hz-r, s, t, q;
  var Q=0.7071, Tq=0.5774;
  /* 六个主面 */
  this.face([[x-a,y-b,z+hz],[x+a,y-b,z+hz],[x+a,y+b,z+hz],[x-a,y+b,z+hz]],[0,0,1],rgb);
  this.face([[x+a,y-b,z-hz],[x-a,y-b,z-hz],[x-a,y+b,z-hz],[x+a,y+b,z-hz]],[0,0,-1],rgb);
  this.face([[x+hx,y-b,z+c],[x+hx,y-b,z-c],[x+hx,y+b,z-c],[x+hx,y+b,z+c]],[1,0,0],rgb);
  this.face([[x-hx,y-b,z-c],[x-hx,y-b,z+c],[x-hx,y+b,z+c],[x-hx,y+b,z-c]],[-1,0,0],rgb);
  this.face([[x-a,y+hy,z+c],[x+a,y+hy,z+c],[x+a,y+hy,z-c],[x-a,y+hy,z-c]],[0,1,0],rgb);
  this.face([[x-a,y-hy,z-c],[x+a,y-hy,z-c],[x+a,y-hy,z+c],[x-a,y-hy,z+c]],[0,-1,0],rgb);
  /* 竖棱（x、z 方向之间） */
  for(s=-1;s<=1;s+=2) for(t=-1;t<=1;t+=2){
    var p1=[x+s*hx,0,z+t*c], p2=[x+s*a,0,z+t*hz];
    var pts=[[p1[0],y-b,p1[2]],[p2[0],y-b,p2[2]],[p2[0],y+b,p2[2]],[p1[0],y+b,p1[2]]];
    if(s*t>0) pts=[pts[1],pts[0],pts[3],pts[2]];
    this.face(pts,[s*Q,0,t*Q],rgb);
  }
  /* 上下的横棱 */
  for(q=-1;q<=1;q+=2){
    var yy=y+q*hy, yi=y+q*b;
    var e1=[[x-a,yi,z+hz],[x+a,yi,z+hz],[x+a,yy,z+c],[x-a,yy,z+c]];
    var e2=[[x+a,yi,z-hz],[x-a,yi,z-hz],[x-a,yy,z-c],[x+a,yy,z-c]];
    var e3=[[x+hx,yi,z+c],[x+hx,yi,z-c],[x+a,yy,z-c],[x+a,yy,z+c]];
    var e4=[[x-hx,yi,z-c],[x-hx,yi,z+c],[x-a,yy,z+c],[x-a,yy,z-c]];
    var ES=[[e1,[0,q*Q,Q]],[e2,[0,q*Q,-Q]],[e3,[Q,q*Q,0]],[e4,[-Q,q*Q,0]]], k;
    for(k=0;k<4;k++){ var pp=ES[k][0]; if(q<0) pp=[pp[1],pp[0],pp[3],pp[2]]; this.face(pp,ES[k][1],rgb); }
    /* 四个角 */
    for(s=-1;s<=1;s+=2) for(t=-1;t<=1;t+=2){
      var tri=[[x+s*hx,yi,z+t*c],[x+s*a,yi,z+t*hz],[x+s*a,yy,z+t*c]];
      if((s*t*q)>0) tri=[tri[1],tri[0],tri[2]];
      this.face(tri,[s*Tq,q*Tq,t*Tq],rgb);
    }
  }
};
/* 竖直的圆柱 / 圆台（y 为底面中心） */
GeoBuilder.prototype.cyl=function(x,y,z,rb,rt,h,seg,col,shade,caps){
  var smooth=(seg>=6);                           /* 4、5 段的是故意做成棱柱 / 棱锥的（攒尖顶、矛尖），不抹平 */
  seg=lodSeg(seg,lodLow()?4:5);
  var rgb=this._rgb(col,shade), k, a0, a1;
  var slope=(rb-rt)/h, nl=Math.sqrt(1+slope*slope), ny=slope/nl;
  for(k=0;k<seg;k++){
    a0=k/seg*6.2832; a1=(k+1)/seg*6.2832;
    var c0=Math.cos(a0),s0=Math.sin(a0),c1=Math.cos(a1),s1=Math.sin(a1), cm=Math.cos((a0+a1)/2), sm=Math.sin((a0+a1)/2);
    var vn=smooth?[[c0/nl,ny,s0/nl],[c0/nl,ny,s0/nl],[c1/nl,ny,s1/nl],[c1/nl,ny,s1/nl]]:null;
    this.face([[x+c0*rb,y,z+s0*rb],[x+c0*rt,y+h,z+s0*rt],[x+c1*rt,y+h,z+s1*rt],[x+c1*rb,y,z+s1*rb]],[cm/nl,ny,sm/nl],rgb,false,vn);
    if(caps!==false){
      if(rt>0.001) this.face([[x,y+h,z],[x+c1*rt,y+h,z+s1*rt],[x+c0*rt,y+h,z+s0*rt]],[0,1,0],rgb);
      if(rb>0.001&&caps!=='top') this.face([[x,y,z],[x+c0*rb,y,z+s0*rb],[x+c1*rb,y,z+s1*rb]],[0,-1,0],rgb);
    }
  }
};
/* 两点之间的杆（任意方向），r0、r1 两端半径 */
GeoBuilder.prototype.rod=function(x0,y0,z0,x1,y1,z1,r0,r1,seg,col,shade){
  seg=lodSeg(seg,4);
  var dx=x1-x0, dy=y1-y0, dz=z1-z0, L=Math.sqrt(dx*dx+dy*dy+dz*dz)||1e-6;
  var ax=dx/L, ay=dy/L, az=dz/L;
  var ux,uy,uz;                                  /* 找一根垂直的轴 */
  if(Math.abs(ay)<0.9){ ux=-az; uy=0; uz=ax; } else { ux=1; uy=0; uz=0; ux=0; uy=-az; uz=ay; }
  var ul=Math.sqrt(ux*ux+uy*uy+uz*uz)||1; ux/=ul; uy/=ul; uz/=ul;
  var vx=ay*uz-az*uy, vy=az*ux-ax*uz, vz=ax*uy-ay*ux;
  var rgb=this._rgb(col,shade), k, caps=(Math.max(r0,r1)>=0.04);
  var smooth=(seg>=5||Math.max(r0,r1)<0.03);    /* 粗的四棱杆是方料（横梁、撞木以外的），细杆一律当圆管 */
  var tl=(r0-r1)/L, tn=Math.sqrt(1+tl*tl);       /* 两头粗细不同：法线往细的那头偏 */
  function P(c,s,r,bx,by,bz){ return [bx+(ux*c+vx*s)*r, by+(uy*c+vy*s)*r, bz+(uz*c+vz*s)*r]; }
  function NR(c,s){ return [(ux*c+vx*s+ax*tl)/tn, (uy*c+vy*s+ay*tl)/tn, (uz*c+vz*s+az*tl)/tn]; }
  for(k=0;k<seg;k++){
    var a0=k/seg*6.2832, a1=(k+1)/seg*6.2832, am=(a0+a1)/2;
    var c0=Math.cos(a0),s0=Math.sin(a0),c1=Math.cos(a1),s1=Math.sin(a1);
    var n=NR(Math.cos(am),Math.sin(am));
    var vn=null; if(smooth){ var n0=NR(c0,s0), n1=NR(c1,s1); vn=[n0,n1,n1,n0]; }
    this.face([P(c0,s0,r0,x0,y0,z0),P(c1,s1,r0,x0,y0,z0),P(c1,s1,r1,x1,y1,z1),P(c0,s0,r1,x1,y1,z1)],n,rgb,false,vn);
    if(caps){                                     /* 细杆的两头看不见，不封口（省一半三角形） */
      this.face([[x1,y1,z1],P(c0,s0,r1,x1,y1,z1),P(c1,s1,r1,x1,y1,z1)],[ax,ay,az],rgb);
      this.face([[x0,y0,z0],P(c1,s1,r0,x0,y0,z0),P(c0,s0,r0,x0,y0,z0)],[-ax,-ay,-az],rgb);
    }
  }
};
/* 低多边形椭球：jit>0 时每个顶点随机抖一下（树冠、灌木），面是平的 */
GeoBuilder.prototype.blob=function(x,y,z,rx,ry,rz,col,shade,seg,jit,seed){
  seg=lodSeg(seg||7,5); var rings=Math.max(3,Math.round(seg*0.6)), rgb=this._rgb(col,shade);
  var V=[], VN=[], i, j, sd=seed||1;
  for(j=0;j<=rings;j++){
    var row=[], nrow=[], ph=j/rings*Math.PI;
    for(i=0;i<seg;i++){
      var th=i/seg*6.2832, jj=(jit&&j>0&&j<rings)?(1+(hash2(sd*31+i,j*17+sd)-0.5)*jit):1;
      var ex=Math.sin(ph)*Math.cos(th), ey=Math.cos(ph), ez=Math.sin(ph)*Math.sin(th);
      row.push([x+ex*rx*jj, y+ey*ry*jj, z+ez*rz*jj]);
      var gx=ex/rx, gy=ey/ry, gz=ez/rz, gl=Math.sqrt(gx*gx+gy*gy+gz*gz)||1;   /* 椭球面的法线（不随抖动变：树冠看起来是一团软的） */
      nrow.push([gx/gl,gy/gl,gz/gl]);
    }
    V.push(row); VN.push(nrow);
  }
  for(j=0;j<rings;j++) for(i=0;i<seg;i++){
    var i1=(i+1)%seg, a=V[j][i], b=V[j][i1], c=V[j+1][i1], d=V[j+1][i];
    var na=VN[j][i], nb=VN[j][i1], nc=VN[j+1][i1], nd=VN[j+1][i];
    var cx=(a[0]+b[0]+c[0]+d[0])/4-x, cy=(a[1]+b[1]+c[1]+d[1])/4-y, cz=(a[2]+b[2]+c[2]+d[2])/4-z, l=Math.sqrt(cx*cx+cy*cy+cz*cz)||1;
    var sh=(jit?(0.92+hash2(i+sd,j)*0.16):1);
    var rg=[rgb[0]*sh,rgb[1]*sh,rgb[2]*sh];
    if(j===0) this.face([a,c,d],[cx/l,cy/l,cz/l],rg,false,[na,nc,nd]);
    else if(j===rings-1) this.face([a,b,d],[cx/l,cy/l,cz/l],rg,false,[na,nb,nd]);
    else this.face([a,b,c,d],[cx/l,cy/l,cz/l],rg,false,[na,nb,nc,nd]);
  }
};
/* 旋转体：轮廓 prof=[[半径, 高度], …]（从下往上）绕竖轴转一圈，y 为底。
   轮廓相邻两段夹角小于 35° 的折点按平滑处理（灯罩、瓶子、垃圾桶、轮胎），大于的保留棱线（台阶、凸缘）。
   第一个、最后一个点半径大于 0 时封口。 */
GeoBuilder.prototype.lathe=function(x,y,z,prof,seg,col,shade){
  seg=lodSeg(seg||12,lodLow()?5:6);
  var rgb=this._rgb(col,shade), n=prof.length, i, k, SN=[];
  for(i=0;i<n-1;i++){                                     /* 每一段的外法线（在 半径-高度 平面里） */
    var dr=prof[i+1][0]-prof[i][0], dh=prof[i+1][1]-prof[i][1], L=Math.sqrt(dr*dr+dh*dh)||1;
    SN.push([dh/L,-dr/L]);
  }
  function endN(i,atEnd){                                 /* 第 i 段在起点 / 终点处的法线：和相邻段夹角小就取平均 */
    var a=SN[i], j=atEnd?i+1:i-1;
    if(j<0||j>=SN.length) return a;
    var b=SN[j], d=a[0]*b[0]+a[1]*b[1];
    if(d<0.82) return a;
    var mx=a[0]+b[0], my=a[1]+b[1], ml=Math.sqrt(mx*mx+my*my)||1;
    return [mx/ml,my/ml];
  }
  for(i=0;i<n-1;i++){
    var p0=prof[i], p1=prof[i+1];
    if(p0[0]<1e-4&&p1[0]<1e-4) continue;
    var e0=endN(i,false), e1=endN(i,true), flat=Math.abs(p1[1]-p0[1])<1e-5;
    for(k=0;k<seg;k++){
      var a0=k/seg*6.2832, a1=(k+1)/seg*6.2832, am=(a0+a1)/2;
      var c0=Math.cos(a0),s0=Math.sin(a0),c1=Math.cos(a1),s1=Math.sin(a1);
      /* 顶点顺序和 cyl 一样（从外面看逆时针）：起点 θ0、终点 θ0、终点 θ1、起点 θ1 */
      var pts=[[x+c0*p0[0],y+p0[1],z+s0*p0[0]],[x+c0*p1[0],y+p1[1],z+s0*p1[0]],[x+c1*p1[0],y+p1[1],z+s1*p1[0]],[x+c1*p0[0],y+p0[1],z+s1*p0[0]]];
      var fn=[Math.cos(am)*SN[i][0],SN[i][1],Math.sin(am)*SN[i][0]];
      var vn=flat?null:[[c0*e0[0],e0[1],s0*e0[0]],[c0*e1[0],e1[1],s0*e1[0]],[c1*e1[0],e1[1],s1*e1[0]],[c1*e0[0],e0[1],s1*e0[0]]];
      if(p0[0]<1e-4) this.face([pts[0],pts[1],pts[2]],fn,rgb,false,vn&&[vn[0],vn[1],vn[2]]);        /* 下端收成一个点 */
      else if(p1[0]<1e-4) this.face([pts[0],pts[1],pts[3]],fn,rgb,false,vn&&[vn[0],vn[1],vn[3]]);   /* 上端收成一个点 */
      else this.face(pts,fn,rgb,false,vn);
    }
  }
  var b=prof[0], t=prof[n-1];
  for(k=0;k<seg;k++){
    var q0=k/seg*6.2832, q1=(k+1)/seg*6.2832;
    if(b[0]>1e-4) this.face([[x,y+b[1],z],[x+Math.cos(q0)*b[0],y+b[1],z+Math.sin(q0)*b[0]],[x+Math.cos(q1)*b[0],y+b[1],z+Math.sin(q1)*b[0]]],[0,-1,0],rgb);
    if(t[0]>1e-4) this.face([[x,y+t[1],z],[x+Math.cos(q1)*t[0],y+t[1],z+Math.sin(q1)*t[0]],[x+Math.cos(q0)*t[0],y+t[1],z+Math.sin(q0)*t[0]]],[0,1,0],rgb);
  }
};
/* 挤出体：凸多边形轮廓 prof=[[u, v], …]（逆时针，u 沿局部 x、v 是高度）沿局部 z 挤出 depth（以 z 为中心）。
   车身、屋脊、台阶侧板这种「侧面一个形状、往里一样厚」的东西。r>0 时两侧的棱切一道倒角。 */
GeoBuilder.prototype.prism=function(x,y,z,prof,depth,col,shade,r){
  var rgb=this._rgb(col,shade), n=prof.length, hz=depth/2, i, ins=Math.min(r||0,hz*0.4);
  if(lodLow()) ins=0;
  var cu=0, cv=0; for(i=0;i<n;i++){ cu+=prof[i][0]/n; cv+=prof[i][1]/n; }
  /* 倒角：两个端面往里缩 ins，侧面和端面之间加一圈斜面 */
  function shrink(p){ var du=p[0]-cu, dv=p[1]-cv, l=Math.sqrt(du*du+dv*dv)||1, s=Math.max(0,1-ins/l); return [cu+du*s,cv+dv*s]; }
  var inner=prof.map(shrink);
  for(i=0;i<n;i++){
    var a=prof[i], b=prof[(i+1)%n], du=b[0]-a[0], dv=b[1]-a[1], L=Math.sqrt(du*du+dv*dv)||1, nu=dv/L, nv=-du/L;
    this.face([[x+a[0],y+a[1],z+hz-ins],[x+a[0],y+a[1],z-hz+ins],[x+b[0],y+b[1],z-hz+ins],[x+b[0],y+b[1],z+hz-ins]],[nu,nv,0],rgb);
    if(ins>0){
      var ia=inner[i], ib=inner[(i+1)%n], Q=0.7071;
      this.face([[x+a[0],y+a[1],z+hz-ins],[x+b[0],y+b[1],z+hz-ins],[x+ib[0],y+ib[1],z+hz],[x+ia[0],y+ia[1],z+hz]],[nu*Q,nv*Q,Q],rgb);
      this.face([[x+b[0],y+b[1],z-hz+ins],[x+a[0],y+a[1],z-hz+ins],[x+ia[0],y+ia[1],z-hz],[x+ib[0],y+ib[1],z-hz]],[nu*Q,nv*Q,-Q],rgb);
    }
  }
  var cap=ins>0?inner:prof;
  for(i=1;i<n-1;i++){
    this.face([[x+cap[0][0],y+cap[0][1],z+hz],[x+cap[i][0],y+cap[i][1],z+hz],[x+cap[i+1][0],y+cap[i+1][1],z+hz]],[0,0,1],rgb);
    this.face([[x+cap[0][0],y+cap[0][1],z-hz],[x+cap[i+1][0],y+cap[i+1][1],z-hz],[x+cap[i][0],y+cap[i][1],z-hz]],[0,0,-1],rgb);
  }
};
/* 叶团：几张互相穿插的方形叶片卡（贴图是一簇叶子，透明的地方镂空），中心 (x,y,z)、半径 r。
   法线按「从树冠中心 (ox,oy,oz) 往外」给，整个树冠的明暗像一团体积，而不是一张张纸片。
   n 张竖卡均匀转开，再加一张斜卡；rot 让每团的朝向不一样。 */
GeoBuilder.prototype.leafCards=function(x,y,z,r,col,shade,n,rot,ox,oy,oz){
  var rgb=this._rgb(col,shade), k, UV=[[0,0],[1,0],[1,1],[0,1]];
  var T=this.tf();
  function W(p){ return [T.x+p[0]*T.c+p[2]*T.s, T.y+p[1], T.z-p[0]*T.s+p[2]*T.c]; }
  for(k=0;k<=n;k++){
    var a=rot+k*Math.PI/n, ca=Math.cos(a)*r, sa=Math.sin(a)*r, P;
    if(k<n) P=[[x-ca,y-r,z-sa],[x+ca,y-r,z+sa],[x+ca,y+r,z+sa],[x-ca,y+r,z-sa]];
    else{ var t=r*0.35; P=[[x-ca,y-t,z-sa],[x+sa,y+t*0.2,z-ca],[x+ca,y+t,z+sa],[x-sa,y-t*0.2,z+ca]]; }   /* 斜着的一张，从上往下看也不空 */
    var WP=P.map(W), wo=W([ox,oy,oz]);
    var VN=WP.map(function(p){ var dx=p[0]-wo[0], dy=(p[1]-wo[1])*1.3, dz=p[2]-wo[2], l=Math.sqrt(dx*dx+dy*dy+dz*dz)||1; return [dx/l,dy/l,dz/l]; });
    var e1=[WP[1][0]-WP[0][0],WP[1][1]-WP[0][1],WP[1][2]-WP[0][2]], e2=[WP[3][0]-WP[0][0],WP[3][1]-WP[0][1],WP[3][2]-WP[0][2]];
    var fn=[e1[1]*e2[2]-e1[2]*e2[1], e1[2]*e2[0]-e1[0]*e2[2], e1[0]*e2[1]-e1[1]*e2[0]], fl=Math.sqrt(fn[0]*fn[0]+fn[1]*fn[1]+fn[2]*fn[2])||1;
    this.face(WP,[fn[0]/fl,fn[1]/fl,fn[2]/fl],rgb,true,VN,UV);
    /* 背面再来一张（顶点顺序反过来、法线不变）：材质只画正面，两面的明暗都按树冠的体积算 */
    this.face([WP[1],WP[0],WP[3],WP[2]],[-fn[0]/fl,-fn[1]/fl,-fn[2]/fl],rgb,true,[VN[1],VN[0],VN[3],VN[2]],[UV[1],UV[0],UV[3],UV[2]]);
  }
};
/* 地面四边形（一定朝上；顶点顺序反了会自动纠正） */
GeoBuilder.prototype.quad=function(ax,az,bx,bz,cx,cz,dx,dz,y,col){
  if((bz-az)*(cx-ax)-(bx-ax)*(cz-az)<0){ var tx=bx,tz=bz; bx=dx; bz=dz; dx=tx; dz=tz; }
  this.face([[ax,y,az],[bx,y,bz],[cx,y,cz],[dx,y,dz]],[0,1,0],this._rgb(col,1));
};
GeoBuilder.prototype.quadN=function(A,B,C,Dd,nx,ny,nz,col){
  this.face([A,B,C,Dd],[nx,ny,nz],this._rgb(col,1));
};
/* 家具脚下的接触阴影：两层渐暗的地面贴片 */
GeoBuilder.prototype.aoPatch=function(x,z,sx,sz,strength){
  var s=strength===undefined?1:strength;
  this.quad(x-sx*0.56,z-sz*0.56, x+sx*0.56,z-sz*0.56, x+sx*0.56,z+sz*0.56, x-sx*0.56,z+sz*0.56, 0.0035, s>0.8?0x55524c:0x5c5952);
  this.quad(x-sx*0.44,z-sz*0.44, x+sx*0.44,z-sz*0.44, x+sx*0.44,z+sz*0.44, x-sx*0.44,z+sz*0.44, 0.0045, s>0.8?0x403e3a:0x4a4844);
};
/* ---- 出网格：压缩顶点格式 ----
   位置、贴图坐标仍是 32 位浮点（室外坐标到 280 米，半精度不够）；
   法线 8 位整数（误差不到半度）；颜色全部 ≤1 时 8 位，否则半精度（有的颜色乘了 >1 的亮度，8 位会截断）。
   一个顶点从 44 字节降到 26–29 字节。顶点数 ≤ 65535 的用 16 位索引。 */
var GEO_HALF=null, GEO_HT=null;
/* 32 位浮点 → 半精度的查表（和 three.js 的 DataUtils.toHalfFloat 同一个算法，内联进循环里省掉函数调用） */
function geoHalfTables(){
  if(GEO_HT) return GEO_HT;
  var base=new Uint32Array(512), shift=new Uint32Array(512), i, e;
  for(i=0;i<256;i++){
    e=i-127;
    if(e<-27){ base[i]=0x0000; base[i|0x100]=0x8000; shift[i]=24; shift[i|0x100]=24; }
    else if(e<-14){ base[i]=0x0400>>(-e-14); base[i|0x100]=(0x0400>>(-e-14))|0x8000; shift[i]=-e-1; shift[i|0x100]=-e-1; }
    else if(e<=15){ base[i]=(e+15)<<10; base[i|0x100]=((e+15)<<10)|0x8000; shift[i]=13; shift[i|0x100]=13; }
    else if(e<128){ base[i]=0x7c00; base[i|0x100]=0xfc00; shift[i]=24; shift[i|0x100]=24; }
    else{ base[i]=0x7c00; base[i|0x100]=0xfc00; shift[i]=13; shift[i|0x100]=13; }
  }
  var buf=new ArrayBuffer(4);
  GEO_HT={base:base,shift:shift,f:new Float32Array(buf),u:new Uint32Array(buf)};
  return GEO_HT;
}
function geoHalfOK(){
  if(GEO_HALF===null){ try{ GEO_HALF=!!(GLR&&GLR.renderer&&GLR.renderer.capabilities.isWebGL2); }catch(e){ GEO_HALF=false; } }
  return GEO_HALF;
}
function geoFromArrays(P,N,C,U,I,nv,ni){
  var g=new THREE.BufferGeometry(), k, cmax=0, n3=nv*3;
  g.setAttribute('position',new THREE.BufferAttribute(P.slice(0,n3),3));
  g.setAttribute('normal',new THREE.BufferAttribute(N.slice(0,n3),3,true));
  for(k=0;k<n3;k++) if(C[k]>cmax) cmax=C[k];
  if(cmax<=1){
    var c8=new Uint8Array(n3);
    for(k=0;k<n3;k++) c8[k]=Math.round(C[k]*255);
    g.setAttribute('color',new THREE.BufferAttribute(c8,3,true));
  }else if(geoHalfOK()){
    var h=new Uint16Array(n3), H=geoHalfTables(), fv=H.f, uv=H.u, base=H.base, shift=H.shift;
    for(k=0;k<n3;k++){ fv[0]=C[k]; var f=uv[0], e=(f>>23)&0x1ff; h[k]=base[e]+((f&0x007fffff)>>shift[e]); }
    g.setAttribute('color',new THREE.Float16BufferAttribute(h,3));
  }else g.setAttribute('color',new THREE.BufferAttribute(C.slice(0,n3),3));
  g.setAttribute('uv',new THREE.BufferAttribute(U.slice(0,nv*2),2));
  var idx=(nv<=65535)?new Uint16Array(ni):new Uint32Array(ni);
  for(k=0;k<ni;k++) idx[k]=I[k];
  g.setIndex(new THREE.BufferAttribute(idx,1));
  g.computeBoundingSphere();
  return g;
}
GeoBuilder.prototype.build=function(){
  this._grow(1,1);
  return geoFromArrays(this.P,this.N,this.C,this.U,this.I,this.v,this.ni);
};
/* 按位置切块：每个面跟着它第一个顶点所在的格子（size 米）走；一块最多 65535 个顶点（16 位索引）。
   切开以后镜头背后、视野外的块整块不画（three.js 按每个网格的包围球做视锥剔除）。 */
/* 切成大约 n 块时格子取多大：按这批顶点在地面上的外包矩形面积平分 */
GeoBuilder.prototype.cellFor=function(n){
  var P=this.P, i, x0=1e9, x1=-1e9, z0=1e9, z1=-1e9, m=this.v*3;
  for(i=0;i<m;i+=3){ var x=P[i], z=P[i+2]; if(x<x0) x0=x; if(x>x1) x1=x; if(z<z0) z0=z; if(z>z1) z1=z; }
  return Math.max(4,Math.sqrt(Math.max(1,(x1-x0)*(z1-z0))/n));
};
GeoBuilder.prototype.buildChunks=function(size){
  this._grow(1,1);
  var P=this.P, N=this.N, C=this.C, U=this.U, I=this.I, ni=this.ni, nv=this.v, nt=ni/3, t, i;
  /* 每个三角形落在哪一格（按它第一个顶点）：同一个面的两个三角形第一个顶点相同，一定在同一格 */
  var x0=1e9, z0=1e9, x1=-1e9, z1=-1e9;
  for(i=0;i<nv*3;i+=3){ if(P[i]<x0) x0=P[i]; if(P[i]>x1) x1=P[i]; if(P[i+2]<z0) z0=P[i+2]; if(P[i+2]>z1) z1=P[i+2]; }
  var gx=Math.max(1,Math.ceil((x1-x0)/size+1e-6)), gz=Math.max(1,Math.ceil((z1-z0)/size+1e-6)), ncell=gx*gz;
  if(ncell<2) return [this.build()];
  var cell=new Int32Array(nt), cnt=new Int32Array(ncell+1);
  for(t=0;t<nt;t++){
    var v0=I[t*3]*3, cx=Math.min(gx-1,Math.floor((P[v0]-x0)/size)), cz=Math.min(gz-1,Math.floor((P[v0+2]-z0)/size));
    cell[t]=cx+cz*gx; cnt[cell[t]+1]++;
  }
  for(i=0;i<ncell;i++) cnt[i+1]+=cnt[i];
  var order=new Int32Array(nt), fill=cnt.slice(0,ncell);           /* 计数排序：同一格的三角形排在一起，保持原来的先后 */
  for(t=0;t<nt;t++) order[fill[cell[t]]++]=t;
  var out=[], map=new Int32Array(nv), stamp=new Int32Array(nv), sid=0;
  var P2=new Float32Array(Math.min(nv,65535)*3), N2=new Int8Array(Math.min(nv,65535)*3), C2=new Float32Array(Math.min(nv,65535)*3), U2=new Float32Array(Math.min(nv,65535)*2), I2=new Uint32Array(ni);
  var c, pos, end;
  for(c=0;c<ncell;c++){
    pos=cnt[c]; end=cnt[c+1];
    while(pos<end){
      sid++;
      var cv=0, j=0;
      /* 一块收到快满 65535 个顶点就另起一块（16 位索引） */
      while(pos<end){
        var tt=order[pos]*3, need=0, k;
        for(k=0;k<3;k++) if(stamp[I[tt+k]]!==sid) need++;
        if(cv+need>65535&&cv>0) break;
        for(k=0;k<3;k++){
          var src=I[tt+k];
          if(stamp[src]!==sid){
            stamp[src]=sid; var d=cv++; map[src]=d;
            P2[d*3]=P[src*3]; P2[d*3+1]=P[src*3+1]; P2[d*3+2]=P[src*3+2];
            N2[d*3]=N[src*3]; N2[d*3+1]=N[src*3+1]; N2[d*3+2]=N[src*3+2];
            C2[d*3]=C[src*3]; C2[d*3+1]=C[src*3+1]; C2[d*3+2]=C[src*3+2];
            U2[d*2]=U[src*2]; U2[d*2+1]=U[src*2+1];
          }
          I2[j++]=map[src];
        }
        pos++;
      }
      out.push(geoFromArrays(P2,N2,C2,U2,I2,cv,j));
    }
  }
  return out;
};


/* 一组按材质分开的 GeoBuilder。
   opts.cull  —— {floor, ceil}：不建永远看不见的面（见 face）；只给房间、室外这种「地面以上看」的场景用，
                 人物、杯子这类会被举起来、掉下来的小件不能用。
   opts.chunk —— 打开切块：顶点多的材质按位置切成几块（每块约 KIT_CHUNK_V 个顶点，最多 KIT_CHUNK_MAX 块），视野外的块不画。 */
function Kit(opts){ this.B={}; this.T={x:0,y:0,z:0,c:1,s:0}; opts=opts||{}; this.cull=opts.cull||null; this.chunk=opts.chunk||0; }
var KIT_CHUNK_V=20000, KIT_CHUNK_MAX=8;   /* 切得太碎绘制次数会变多（手机上每次绘制都有开销），所以按顶点数定块数 */
Kit.prototype.g=function(key){ if(!this.B[key]) this.B[key]=new GeoBuilder(matUV(key),this); return this.B[key]; };
Kit.prototype.frame=function(x,z,rot,y){ this.T.x=x||0; this.T.z=z||0; this.T.y=y||0; this.T.c=Math.cos(rot||0); this.T.s=Math.sin(rot||0); return this; };
Kit.prototype.unframe=function(){ return this.frame(0,0,0,0); };
/* 嵌套的局部坐标：在当前坐标系里再平移、转一下（小物件放在家具上时用），返回旧的，用完 restore 回去 */
Kit.prototype.sub=function(x,z,rot,y){
  var T=this.T, old={x:T.x,y:T.y,z:T.z,c:T.c,s:T.s}, a=Math.atan2(T.s,T.c)+(rot||0);
  T.x=old.x+x*old.c+z*old.s; T.z=old.z-x*old.s+z*old.c; T.y=old.y+(y||0); T.c=Math.cos(a); T.s=Math.sin(a);
  return old;
};
Kit.prototype.restore=function(o){ var T=this.T; T.x=o.x; T.y=o.y; T.z=o.z; T.c=o.c; T.s=o.s; return this; };
/* 占地记录：cap 不为空时，每个图元在人身高范围（0.10–1.85 米）内的水平外包矩形记进去，
   房间生成拿它当家具的碰撞（room.js），以前碰撞是每种字符一个固定比例的方块，和模型对不上 */
var CAP_Y0=0.10, CAP_Y1=1.85;
Kit.prototype._cap=function(b,v0,m){
  if(!this.cap||m==='decal'||b.v<=v0) return;
  var P=b.P, i, n=b.v*3, x0=1e9,x1=-1e9,y0=1e9,y1=-1e9,z0=1e9,z1=-1e9;
  for(i=v0*3;i<n;i+=3){
    if(P[i]<x0) x0=P[i]; if(P[i]>x1) x1=P[i];
    if(P[i+1]<y0) y0=P[i+1]; if(P[i+1]>y1) y1=P[i+1];
    if(P[i+2]<z0) z0=P[i+2]; if(P[i+2]>z1) z1=P[i+2];
  }
  if(y1<CAP_Y0||y0>CAP_Y1) return;
  this.cap.push({x0:x0,x1:x1,z0:z0,z1:z1});
};
Kit.prototype.box=function(m,x,y,z,sx,sy,sz,col,sh){ var b=this.g(m), v=b.v; b.box(x,y,z,sx,sy,sz,col,sh); this._cap(b,v,m); };
Kit.prototype.bevel=function(m,x,y,z,sx,sy,sz,col,sh,r){ var b=this.g(m), v=b.v; b.bevel(x,y,z,sx,sy,sz,col,sh,r); this._cap(b,v,m); };
Kit.prototype.leafCards=function(m,x,y,z,r,col,sh,n,rot,ox,oy,oz){ var b=this.g(m); b.leafCards(x,y,z,r,col,sh,n,rot,ox,oy,oz); };
Kit.prototype.lathe=function(m,x,y,z,prof,seg,col,sh){ var b=this.g(m), v=b.v; b.lathe(x,y,z,prof,seg,col,sh); this._cap(b,v,m); };
Kit.prototype.prism=function(m,x,y,z,prof,depth,col,sh,r){ var b=this.g(m), v=b.v; b.prism(x,y,z,prof,depth,col,sh,r); this._cap(b,v,m); };
Kit.prototype.cyl=function(m,x,y,z,rb,rt,h,seg,col,sh,caps){ var b=this.g(m), v=b.v; b.cyl(x,y,z,rb,rt,h,seg,col,sh,caps); this._cap(b,v,m); };
Kit.prototype.rod=function(m,x0,y0,z0,x1,y1,z1,r0,r1,seg,col,sh){ var b=this.g(m), v=b.v; b.rod(x0,y0,z0,x1,y1,z1,r0,r1,seg,col,sh); this._cap(b,v,m); };
Kit.prototype.blob=function(m,x,y,z,rx,ry,rz,col,sh,seg,jit,seed){ var b=this.g(m), v=b.v; b.blob(x,y,z,rx,ry,rz,col,sh,seg,jit,seed); this._cap(b,v,m); };
Kit.prototype.build=function(group){
  var grp=group||new THREE.Group(), k;
  for(k in this.B){
    var b=this.B[k]; if(!b.v) continue;
    var nc=0, geos, j;
    if(this.chunk) nc=lodLow()?(b.v>65535?Math.ceil(b.v/60000):0)          /* 流畅档（手机）绘制次数更要紧：只在超过 16 位索引时才拆 */
                              :Math.min(KIT_CHUNK_MAX,Math.floor(b.v/KIT_CHUNK_V));
    geos=(nc>=2)?b.buildChunks(b.cellFor(nc)):[b.build()];
    for(j=0;j<geos.length;j++){
      var mesh=new THREE.Mesh(geos[j],matOf(k));
      if(k==='glass') mesh.renderOrder=2;
      mesh.userData.matKey=k;
      grp.add(mesh);
    }
  }
  return grp;
};
/* 用于小件（人物等）：把 Kit 合成一个几何体，交给调用者自己挂材质 */
Kit.prototype.mergedGeometry=function(){
  var nv=0, ni=0, k, b;
  for(k in this.B){ nv+=this.B[k].v; ni+=this.B[k].ni; }
  var P=new Float32Array(nv*3), N=new Int8Array(nv*3), C=new Float32Array(nv*3), U=new Float32Array(nv*2), I=new Uint32Array(ni), v=0, t=0, j;
  for(k in this.B){
    b=this.B[k]; if(!b.v) continue;
    P.set(b.P.subarray(0,b.v*3),v*3); N.set(b.N.subarray(0,b.v*3),v*3); C.set(b.C.subarray(0,b.v*3),v*3); U.set(b.U.subarray(0,b.v*2),v*2);
    for(j=0;j<b.ni;j++) I[t+j]=b.I[j]+v;
    v+=b.v; t+=b.ni;
  }
  return geoFromArrays(P,N,C,U,I,nv,ni);
};

/* ---- 旧接口：标记高度（准星上的小菱形停在多高）、楼梯朝向 ---- */
function furnH(ch){
  switch(ch){
    case '#': case '=': return WALLH;
    case 'T': return 1.05; case 'd': return 0.74; case 'P': return 0.46; case 'b': return 0.55;
    case 't': return 0.75; case 'k': return 0.95; case 'f': return 2.1; case 'R': return 1.85;
    case 'l': return 0.92; case 'w': return 0.85; case 'v': return 1.7; case 'c': return 1.35;
    case 'D': return 1.25; case 'X': return 1.2; case 'B': case 'G': return 1.9; case 'S': return 0.16;
    case 'O': return 2.2; case 'K': return 1.05; case 'C': return 0.72; case 'N': return 1.20;
    case 'Z': return 1.00; case 'Y': return 1.20; case 'V': return 1.6; case 'q': return 0.92;
    case 'n': return 1.25; case 'x': return 1.85; case 'p': return 1.25; case 'Q': return 1.85;
    case 'U': return 1.4; case 'A': return 0.9; case 'L': return 2.2; case 'H': return 2.0; case 'M': return 1.9;
    default: return 0;
  }
}
function stairInfo(R,x,y){
  var gw=1,gd=1,gx2,gy2;
  for(gx2=x+1; gx2<R.cols && R.grid[y][gx2]==='S'; gx2++) gw++;
  for(gy2=y+1; gy2<R.rows && R.grid[gy2][x]==='S'; gy2++) gd++;
  var longX=(gw>=gd);
  function tf(cc,rr){
    if(cc<0||rr<0||cc>=R.cols||rr>=R.rows) return -2;      /* 越界 = 楼外 */
    var t=R.grid[rr][cc];
    return (t==='#'||t==='='||t==='O')?-1:1;
  }
  var dirs=longX?[[0,1],[0,-1]]:[[1,0],[-1,0]];
  var best=dirs[0], bestScore=1e9, bestBlock=-2, di;
  for(di=0;di<2;di++){
    var dd=dirs[di], sc=0, blk=-2;
    for(var k2=1;k2<=3;k2++){
      var fr=tf(x+dd[0]*k2, y+dd[1]*k2);
      if(fr<0){ blk=fr; break; }
      sc++;
    }
    if(sc<bestScore){ bestScore=sc; best=dd; bestBlock=blk; }
  }
  return {gw:gw,gd:gd,longX:longX,dx:best[0],dy:best[1],free:bestScore,block:bestBlock};
}
