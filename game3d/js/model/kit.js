/* 里世界 3D · 建模工具
   GeoBuilder：往一个 BufferGeometry 里加图元（盒、倒角盒、圆柱/圆台、两点之间的杆、椭球、四边形）。
     · 顶点色决定颜色；贴图坐标按世界坐标投影（法线朝哪个轴就用另外两个轴），所以纹理在物体之间连续。
     · frame(x,z,rotY) 设一个局部坐标系：家具按自己的"正面"建，放的时候再转过去。
   Kit：按材质分开的一组 GeoBuilder，最后 build() 成一个 Group（每种材质一个 Mesh）。
   "流畅"画质下倒角退化成普通盒、圆柱减段数，顶点数大约少一半。
   省资源（画出来和以前一样）：类型化数组建模、压缩顶点格式、不建贴地朝下 / 贴吊顶朝上的面、
   大网格按位置切块做视锥剔除。数字见 docs/3D更新说明.md「建模内核重写」。 */
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
GeoBuilder.prototype.face=function(pts,n,rgb,noTf){
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
    N[o]=qx; N[o+1]=qy; N[o+2]=qz;
    C[o]=rgb[0]; C[o+1]=rgb[1]; C[o+2]=rgb[2];
    if(axis===0){ U[o2]=z/uv; U[o2+1]=y/uv; }
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
  seg=lodSeg(seg,lodLow()?4:5);
  var rgb=this._rgb(col,shade), k, a0, a1;
  var slope=(rb-rt)/h, nl=Math.sqrt(1+slope*slope);
  for(k=0;k<seg;k++){
    a0=k/seg*6.2832; a1=(k+1)/seg*6.2832;
    var c0=Math.cos(a0),s0=Math.sin(a0),c1=Math.cos(a1),s1=Math.sin(a1), cm=Math.cos((a0+a1)/2), sm=Math.sin((a0+a1)/2);
    this.face([[x+c0*rb,y,z+s0*rb],[x+c0*rt,y+h,z+s0*rt],[x+c1*rt,y+h,z+s1*rt],[x+c1*rb,y,z+s1*rb]],[cm/nl,slope/nl,sm/nl],rgb);
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
  for(k=0;k<seg;k++){
    var a0=k/seg*6.2832, a1=(k+1)/seg*6.2832, am=(a0+a1)/2;
    var c0=Math.cos(a0),s0=Math.sin(a0),c1=Math.cos(a1),s1=Math.sin(a1);
    function P(c,s,r,bx,by,bz){ return [bx+(ux*c+vx*s)*r, by+(uy*c+vy*s)*r, bz+(uz*c+vz*s)*r]; }
    var n=[ux*Math.cos(am)+vx*Math.sin(am), uy*Math.cos(am)+vy*Math.sin(am), uz*Math.cos(am)+vz*Math.sin(am)];
    this.face([P(c0,s0,r0,x0,y0,z0),P(c1,s1,r0,x0,y0,z0),P(c1,s1,r1,x1,y1,z1),P(c0,s0,r1,x1,y1,z1)],n,rgb);
    if(caps){                                     /* 细杆的两头看不见，不封口（省一半三角形） */
      this.face([[x1,y1,z1],P(c0,s0,r1,x1,y1,z1),P(c1,s1,r1,x1,y1,z1)],[ax,ay,az],rgb);
      this.face([[x0,y0,z0],P(c1,s1,r0,x0,y0,z0),P(c0,s0,r0,x0,y0,z0)],[-ax,-ay,-az],rgb);
    }
  }
};
/* 低多边形椭球：jit>0 时每个顶点随机抖一下（树冠、灌木），面是平的 */
GeoBuilder.prototype.blob=function(x,y,z,rx,ry,rz,col,shade,seg,jit,seed){
  seg=lodSeg(seg||7,5); var rings=Math.max(3,Math.round(seg*0.6)), rgb=this._rgb(col,shade);
  var V=[], i, j, sd=seed||1;
  for(j=0;j<=rings;j++){
    var row=[], ph=j/rings*Math.PI;
    for(i=0;i<seg;i++){
      var th=i/seg*6.2832, jj=(jit&&j>0&&j<rings)?(1+(hash2(sd*31+i,j*17+sd)-0.5)*jit):1;
      row.push([x+Math.sin(ph)*Math.cos(th)*rx*jj, y+Math.cos(ph)*ry*jj, z+Math.sin(ph)*Math.sin(th)*rz*jj]);
    }
    V.push(row);
  }
  for(j=0;j<rings;j++) for(i=0;i<seg;i++){
    var a=V[j][i], b=V[j][(i+1)%seg], c=V[j+1][(i+1)%seg], d=V[j+1][i];
    var cx=(a[0]+b[0]+c[0]+d[0])/4-x, cy=(a[1]+b[1]+c[1]+d[1])/4-y, cz=(a[2]+b[2]+c[2]+d[2])/4-z, l=Math.sqrt(cx*cx+cy*cy+cz*cz)||1;
    var sh=(jit?(0.92+hash2(i+sd,j)*0.16):1);
    var rg=[rgb[0]*sh,rgb[1]*sh,rgb[2]*sh];
    if(j===0) this.face([a,c,d],[cx/l,cy/l,cz/l],rg);
    else if(j===rings-1) this.face([a,b,d],[cx/l,cy/l,cz/l],rg);
    else this.face([a,b,c,d],[cx/l,cy/l,cz/l],rg);
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
