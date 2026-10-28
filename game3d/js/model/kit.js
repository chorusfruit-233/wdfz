/* 里世界 3D · 建模工具
   GeoBuilder：往一个 BufferGeometry 里加图元（盒、倒角盒、圆柱/圆台、两点之间的杆、椭球、四边形）。
     · 顶点色决定颜色；贴图坐标按世界坐标投影（法线朝哪个轴就用另外两个轴），所以纹理在物体之间连续。
     · frame(x,z,rotY) 设一个局部坐标系：家具按自己的"正面"建，放的时候再转过去。
   Kit：按材质分开的一组 GeoBuilder，最后 build() 成一个 Group（每种材质一个 Mesh）。
   "流畅"画质下倒角退化成普通盒、圆柱减段数，顶点数大约少一半。 */
'use strict';

function hash2(a,b){ var h=(a*374761393+b*668265263)^0x5bf03635; h=(h^(h>>13))*1274126177; return ((h^(h>>16))>>>0)/4294967295; }
function shadeHex(col,s){
  var r=Math.min(255,Math.max(0,((col>>16)&255)*s))|0;
  var g=Math.min(255,Math.max(0,((col>>8)&255)*s))|0;
  var b=Math.min(255,Math.max(0,(col&255)*s))|0;
  return (r<<16)|(g<<8)|b;
}
function lodLow(){ return QUALITY===0; }

var UVTILE=2.4;
function GeoBuilder(uv,K){
  this.p=[]; this.n=[]; this.c=[]; this.u=[]; this.i=[]; this.v=0;
  this.uv=uv||UVTILE; this.K=K||null;
  this.T={x:0,y:0,z:0,c:1,s:0};
}
var BoxBuilder=GeoBuilder;          /* 旧名字：室外的灯头、亮窗等还在用 */
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
/* 加一个多边形面（3 或 4 个点，局部坐标），n 为局部法线 */
GeoBuilder.prototype.face=function(pts,n,rgb,noTf){
  var P=this.p,N=this.n,C=this.c,U=this.u,v=this.v,k;
  var nw=noTf?n:this._nm(n[0],n[1],n[2]);
  var ax=Math.abs(nw[0]), ay=Math.abs(nw[1]), az=Math.abs(nw[2]);
  for(k=0;k<pts.length;k++){
    var w=noTf?pts[k]:this._pt(pts[k][0],pts[k][1],pts[k][2]);
    P.push(w[0],w[1],w[2]); N.push(nw[0],nw[1],nw[2]); C.push(rgb[0],rgb[1],rgb[2]);
    if(ax>=ay&&ax>=az) U.push(w[2]/this.uv, w[1]/this.uv);
    else if(ay>=az) U.push(w[0]/this.uv, w[2]/this.uv);
    else U.push(w[0]/this.uv, w[1]/this.uv);
  }
  if(pts.length===3) this.i.push(v,v+1,v+2);
  else this.i.push(v,v+1,v+2, v,v+2,v+3);
  this.v=v+pts.length;
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
  seg=Math.max(lodLow()?4:5,lodLow()?Math.ceil(seg*0.6):seg);
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
  seg=Math.max(4,lodLow()?Math.ceil(seg*0.6):seg);
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
  seg=seg||(lodLow()?5:7); var rings=Math.max(3,Math.round(seg*0.6)), rgb=this._rgb(col,shade);
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
GeoBuilder.prototype.build=function(){
  var g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(this.p,3));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(this.n,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(this.c,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(this.u,2));
  g.setIndex(this.i);
  g.computeBoundingSphere();
  return g;
};

/* 一组按材质分开的 GeoBuilder */
function Kit(){ this.B={}; this.T={x:0,y:0,z:0,c:1,s:0}; }
Kit.prototype.g=function(key){ if(!this.B[key]) this.B[key]=new GeoBuilder(matUV(key),this); return this.B[key]; };
Kit.prototype.frame=function(x,z,rot,y){ this.T.x=x||0; this.T.z=z||0; this.T.y=y||0; this.T.c=Math.cos(rot||0); this.T.s=Math.sin(rot||0); return this; };
Kit.prototype.unframe=function(){ return this.frame(0,0,0,0); };
Kit.prototype.box=function(m,x,y,z,sx,sy,sz,col,sh){ this.g(m).box(x,y,z,sx,sy,sz,col,sh); };
Kit.prototype.bevel=function(m,x,y,z,sx,sy,sz,col,sh,r){ this.g(m).bevel(x,y,z,sx,sy,sz,col,sh,r); };
Kit.prototype.cyl=function(m,x,y,z,rb,rt,h,seg,col,sh,caps){ this.g(m).cyl(x,y,z,rb,rt,h,seg,col,sh,caps); };
Kit.prototype.rod=function(m,x0,y0,z0,x1,y1,z1,r0,r1,seg,col,sh){ this.g(m).rod(x0,y0,z0,x1,y1,z1,r0,r1,seg,col,sh); };
Kit.prototype.blob=function(m,x,y,z,rx,ry,rz,col,sh,seg,jit,seed){ this.g(m).blob(x,y,z,rx,ry,rz,col,sh,seg,jit,seed); };
Kit.prototype.build=function(group){
  var grp=group||new THREE.Group(), k;
  for(k in this.B){
    var b=this.B[k]; if(!b.v) continue;
    var mesh=new THREE.Mesh(b.build(),matOf(k));
    if(k==='glass') mesh.renderOrder=2;
    mesh.userData.matKey=k;
    grp.add(mesh);
  }
  return grp;
};
/* 用于小件（人物等）：把 Kit 合成一个几何体，交给调用者自己挂材质 */
Kit.prototype.mergedGeometry=function(){
  var all=new GeoBuilder(1), k;
  for(k in this.B){
    var b=this.B[k], base=all.v, j;
    for(j=0;j<b.p.length;j++){ all.p.push(b.p[j]); all.n.push(b.n[j]); all.c.push(b.c[j]); }
    for(j=0;j<b.u.length;j++) all.u.push(b.u[j]);
    for(j=0;j<b.i.length;j++) all.i.push(b.i[j]+base);
    all.v+=b.v;
  }
  return all.build();
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
