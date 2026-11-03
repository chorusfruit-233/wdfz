/* 解析碰撞接收器：和渲染使用相同配方/代理，但不创建顶点、DOM 或 Three.js。 */
'use strict';
var CAP_Y0=.10,CAP_Y1=1.85;
function SpatialKit(assets){this.assets=assets||{};this.T={x:0,y:0,z:0,c:1,s:0};this.cap=null;this.solids=[];this.lamps=[];this.treeN=0;}
SpatialKit.prototype.g=function(){
  var self=this,noop=function(){};
  return new Proxy({}, {get:function(_target,key){if(key==='_pt')return function(x,y,z){var t=self.T;return [t.x+x*t.c+z*t.s,t.y+y,t.z-x*t.s+z*t.c];};return noop;}});
};
SpatialKit.prototype.has=function(name){return Object.prototype.hasOwnProperty.call(this.assets,name);};
SpatialKit.prototype.frame=function(x,z,rot,y){ this.T.x=x||0; this.T.z=z||0; this.T.y=y||0; this.T.c=Math.cos(rot||0); this.T.s=Math.sin(rot||0); return this; };
SpatialKit.prototype.unframe=function(){ return this.frame(0,0,0,0); };
SpatialKit.prototype.sub=function(x,z,rot,y){
  var T=this.T, old={x:T.x,y:T.y,z:T.z,c:T.c,s:T.s}, a=Math.atan2(T.s,T.c)+(rot||0);
  T.x=old.x+x*old.c+z*old.s; T.z=old.z-x*old.s+z*old.c; T.y=old.y+(y||0); T.c=Math.cos(a); T.s=Math.sin(a);
  return old;
};
SpatialKit.prototype.restore=function(o){ var T=this.T; T.x=o.x; T.y=o.y; T.z=o.z; T.c=o.c; T.s=o.s; return this; };
SpatialKit.prototype._capBounds=function(m,x0,y0,z0,x1,y1,z1,sceneSpace){
  if(!this.cap||m==='decal')return;
  var T=this.T;if(!sceneSpace){y0+=T.y;y1+=T.y;}
  if(y1<CAP_Y0||y0>CAP_Y1)return;
  if(!sceneSpace){
    var ax0=Infinity,ax1=-Infinity,az0=Infinity,az1=-Infinity;
    [x0,x1].forEach(function(x){[z0,z1].forEach(function(z){
      var xx=T.x+x*T.c+z*T.s,zz=T.z-x*T.s+z*T.c;
      ax0=Math.min(ax0,xx);ax1=Math.max(ax1,xx);az0=Math.min(az0,zz);az1=Math.max(az1,zz);
    });});
    x0=ax0;x1=ax1;z0=az0;z1=az1;
  }
  this.cap.push({x0:x0,x1:x1,z0:z0,z1:z1});
};
SpatialKit.prototype.box=function(m,x,y,z,sx,sy,sz,col,sh){
  this._capBounds(m,x-sx/2,y-sy/2,z-sz/2,x+sx/2,y+sy/2,z+sz/2);
};
SpatialKit.prototype.bevel=function(m,x,y,z,sx,sy,sz,col,sh,r){
  this._capBounds(m,x-sx/2,y-sy/2,z-sz/2,x+sx/2,y+sy/2,z+sz/2);
};
SpatialKit.prototype.cyl=function(m,x,y,z,rb,rt,h,seg,col,sh,caps){
  var b=this.g(m);
  if(this.cap){var p=b._pt(x,y,z),r=Math.max(rb,rt);this._capBounds(m,p[0]-r,p[1],p[2]-r,p[0]+r,p[1]+h,p[2]+r,true);}
};
SpatialKit.prototype.rod=function(m,x0,y0,z0,x1,y1,z1,r0,r1,seg,col,sh){
  var b=this.g(m);
  if(this.cap){var a=b._pt(x0,y0,z0),c=b._pt(x1,y1,z1),r=Math.max(r0,r1);
    this._capBounds(m,Math.min(a[0],c[0])-r,Math.min(a[1],c[1])-r,Math.min(a[2],c[2])-r,
      Math.max(a[0],c[0])+r,Math.max(a[1],c[1])+r,Math.max(a[2],c[2])+r,true);}
};
SpatialKit.prototype.blob=function(m,x,y,z,rx,ry,rz,col,sh,seg,jit,seed){
  var k=1+(jit||0)/2;this._capBounds(m,x-rx*k,y-ry*k,z-rz*k,x+rx*k,y+ry*k,z+rz*k);
};
SpatialKit.prototype.lathe=function(m,x,y,z,prof,seg,col,sh){
  var r=0,y0=Infinity,y1=-Infinity;prof.forEach(function(p){r=Math.max(r,p[0]);y0=Math.min(y0,p[1]);y1=Math.max(y1,p[1]);});
  this._capBounds(m,x-r,y+y0,z-r,x+r,y+y1,z+r);
};
SpatialKit.prototype.prism=function(m,x,y,z,prof,depth,col,sh,r){
  var x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
  prof.forEach(function(p){x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);y0=Math.min(y0,p[1]);y1=Math.max(y1,p[1]);});
  this._capBounds(m,x+x0,y+y0,z-depth/2,x+x1,y+y1,z+depth/2);
};
function assetProxyWorld(q,X){
  var s=X.k||1, c=X.c, sn=X.s, sq=X.q||1;
  function W(p){ var lx=p[0]*s*sq, lz=p[2]*s; return [X.x+lx*c+lz*sn, X.y+p[1]*s, X.z-lx*sn+lz*c]; }
  var p, bb, ex, ez;
  if(q.t==='box'||q.t==='blob'){
    /* 拉长时盒子按它自己的转角把 x、z 两个半边长分摊（转角是 0 或 90° 时是准的） */
    var a=(q.a||0)+Math.atan2(sn,c), qa=q.a||0, fx=Math.abs(Math.cos(qa))*sq+Math.abs(Math.sin(qa)), fz=Math.abs(Math.sin(qa))*sq+Math.abs(Math.cos(qa));
    var h=(q.t==='box'?q.h:q.r).map(function(v,i){ return v*s*(i===0?fx:(i===2?fz:1)); }), cc=W(q.c);
    p=q.t==='box'?{t:'box',c:cc,h:h,tc:Math.cos(a),ts:Math.sin(a)}:{t:'blob',c:cc,r:h,tc:Math.cos(a),ts:Math.sin(a),jit:q.jit||0};
    ex=Math.abs(h[0]*Math.cos(a))+Math.abs(h[2]*Math.sin(a)); ez=Math.abs(h[0]*Math.sin(a))+Math.abs(h[2]*Math.cos(a));
    bb=[cc[0]-ex,cc[1]-h[1],cc[2]-ez,cc[0]+ex,cc[1]+h[1],cc[2]+ez];
  }else if(q.t==='cyl'){
    var c0=W(q.c), r=Math.max(q.rb,q.rt)*s;
    p={t:'cyl',c:c0,rb:q.rb*s,rt:q.rt*s,hh:q.hh*s};
    bb=[c0[0]-r,c0[1],c0[2]-r,c0[0]+r,c0[1]+q.hh*s,c0[2]+r];
  }else{
    var A=W(q.a), B=W(q.b), rr=Math.max(q.r0,q.r1)*s;
    p={t:'rod',a:A,b:B,r0:q.r0*s,r1:q.r1*s};
    bb=[Math.min(A[0],B[0])-rr,Math.min(A[1],B[1])-rr,Math.min(A[2],B[2])-rr,Math.max(A[0],B[0])+rr,Math.max(A[1],B[1])+rr,Math.max(A[2],B[2])+rr];
  }
  return {p:p,bb:bb};
}
SpatialKit.prototype.leafCards=function(){};
SpatialKit.prototype.asset=function(name,x,y,z,rot,opt){
  if(!this.has(name))return false;
  opt=opt||{};x=x||0;y=y||0;z=z||0;
  var t=this.T,ca=Math.cos(rot||0),sa=Math.sin(rot||0);
  var transform={x:t.x+x*t.c+z*t.s,y:t.y+y,z:t.z-x*t.s+z*t.c,c:t.c*ca-t.s*sa,s:t.s*ca+t.c*sa,k:opt.s||1,q:opt.sx||1};
  if(this.cap)for(var i=0;i<this.assets[name].length;i++){
    var b=assetProxyWorld(this.assets[name][i],transform).bb;
    this._capBounds('asset',b[0],b[1],b[2],b[3],b[4],b[5],true);
  }
  return true;
};
SpatialKit.prototype.solidM=function(cx,cz,hw,hd,scale){
  var k=1/scale;this.solids.push({x0:(cx-hw)*k,y0:(cz-hd)*k,x1:(cx+hw)*k,y1:(cz+hd)*k});
};
if(typeof module!=='undefined'&&module.exports)module.exports={SpatialKit:SpatialKit,assetProxyWorld:assetProxyWorld};
