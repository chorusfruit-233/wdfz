/* 穿模审查（不随游戏加载；由 tools/clip_audit.py 注入页面）
   做法：建模时记下每个几何体（盒、倒角盒、圆柱、杆、椭球）的真实形状和「属于谁」，然后检查：
     · overlap —— 不同物件的几何体互相插进去超过 2 厘米（用采样点 + 精确的点在形体内判定，不是包围盒）；
     · wall    —— 物件从墙的另一边露出来（采样点所在格和物件所在格之间隔着墙格）；
     · door    —— 物件伸进门洞、出口、楼梯格；
     · walk    —— 人走得到、看得见的部分超出了它的碰撞范围（玩家半径 0.33 米），会走进模型里；
     · patrol  —— 巡察者沿格子中心走时身体（半径 0.28 米）会擦进物件；
     · seat    —— 坐着的同学和课桌椅互相插进去。
   用法：ClipAudit.room(id) / ClipAudit.outdoor() / ClipAudit.all() 返回问题列表。 */
'use strict';

var ClipAudit=(function(){
  var REC=null, OWN=[], OWNID=0, EPS=0.02;
  function cur(){ return OWN.length?OWN[OWN.length-1]:'base'; }
  /* ---------- 记录几何体 ---------- */
  var G=GeoBuilder.prototype, orig={};
  function T(gb){ return gb.tf(); }
  function rec(p){ if(REC){ p.o=cur(); p.m=REC.mat||''; REC.list.push(p); } }
  ['box','bevel','boxFaces','cyl','rod','blob'].forEach(function(k){ orig[k]=G[k]; });
  G.box=function(x,y,z,sx,sy,sz){ if(REC){ var t=T(this); rec({t:'box',c:this._pt(x,y,z),h:[sx/2,sy/2,sz/2],tc:t.c,ts:t.s}); } return orig.box.apply(this,arguments); };
  G.bevel=function(x,y,z,sx,sy,sz){ if(REC){ var t=T(this); rec({t:'box',c:this._pt(x,y,z),h:[sx/2,sy/2,sz/2],tc:t.c,ts:t.s}); } return orig.bevel.apply(this,arguments); };
  G.boxFaces=function(x,y,z,sx,sy,sz){ if(REC){ var t=T(this); rec({t:'box',c:this._pt(x,y,z),h:[sx/2,sy/2,sz/2],tc:t.c,ts:t.s,wall:1}); } return orig.boxFaces.apply(this,arguments); };
  G.cyl=function(x,y,z,rb,rt,h){ if(REC) rec({t:'cyl',c:this._pt(x,y,z),rb:rb,rt:rt,hh:h}); return orig.cyl.apply(this,arguments); };
  G.rod=function(x0,y0,z0,x1,y1,z1,r0,r1){ if(REC) rec({t:'rod',a:this._pt(x0,y0,z0),b:this._pt(x1,y1,z1),r0:r0,r1:r1}); return orig.rod.apply(this,arguments); };
  G.blob=function(x,y,z,rx,ry,rz,col,sh,seg,jit){ if(REC){ var t=T(this); rec({t:'blob',c:this._pt(x,y,z),r:[rx,ry,rz],tc:t.c,ts:t.s,jit:jit||0}); } return orig.blob.apply(this,arguments); };
  /* 旋转体：轮廓每一段记成一节圆台；挤出体：记成它的外包盒 */
  orig.lathe=G.lathe; orig.prism=G.prism;
  G.lathe=function(x,y,z,prof){ if(REC){ for(var i=0;i<prof.length-1;i++){ var a=prof[i], b=prof[i+1], lo=a[1]<b[1]?a:b, hi=a[1]<b[1]?b:a;
      if(hi[1]-lo[1]>0.005&&Math.max(a[0],b[0])>0.002) rec({t:'cyl',c:this._pt(x,y+lo[1],z),rb:lo[0],rt:hi[0],hh:hi[1]-lo[1]}); } }
    return orig.lathe.apply(this,arguments); };
  G.prism=function(x,y,z,prof,depth){ if(REC){ var t=T(this), u0=1e9,u1=-1e9,v0=1e9,v1=-1e9;
      prof.forEach(function(q){ u0=Math.min(u0,q[0]); u1=Math.max(u1,q[0]); v0=Math.min(v0,q[1]); v1=Math.max(v1,q[1]); });
      rec({t:'box',c:this._pt(x+(u0+u1)/2,y+(v0+v1)/2,z),h:[(u1-u0)/2,(v1-v0)/2,depth/2],tc:t.c,ts:t.s}); }
    return orig.prism.apply(this,arguments); };
  /* 资源包里的模型（Kit.asset）：不画图元，按它带的碰撞代理（盒 / 圆柱 / 杆 / 椭球，已摆到场景坐标）记 */
  G.proxy=function(p){ if(REC){ var q={}; for(var k in p) q[k]=p[k]; rec(q); } };
  /* Kit.g(key) 记材质（墙、地面这类结构件按材质认） */
  var kg=Kit.prototype.g;
  Kit.prototype.g=function(key){ if(REC) REC.mat=key; return kg.apply(this,arguments); };

  /* ---------- 物件归属：包一层顶层建模函数 ---------- */
  function wrapFn(holder,name,label){
    var f=holder[name]; if(typeof f!=='function'||f.__clip) return;
    var w=function(){
      var tag=(typeof label==='function')?label.apply(null,arguments):label;
      OWN.push(tag+'#'+(++OWNID));
      try{ return f.apply(this,arguments); } finally{ OWN.pop(); }
    };
    w.__clip=1; holder[name]=w;
  }
  Object.keys(FURN).forEach(function(ch){ wrapFn(FURN,ch,function(c,x,y){ return 'furn:'+ch+'@'+x+','+y; }); });
  [['roomDoor','door'],['buildDoorLeaf','door'],['roomExit','exit'],['roomStairs','stair'],['wallWindow','window'],['ceilingLight','light'],['buildSpiral','spiral'],['roomDecor','decor'],
   ['buildTree','tree'],['bldClassroom','bld'],['bldDorm','bld'],['bldBell','bld'],['bldCanteen','bld'],['bldSmall','bld'],['bldShed','shed'],['bldLink','link'],
   ['garageRamp','ramp'],['garagePed','garageped'],['fieldModel','field'],['courtModel','court'],['courtGear','courtgear'],['fenceRun','fence'],['gateModel','gate'],
   ['acUnit','ac'],['addEntrance','entrance'],['addSmallDoor','smalldoor'],['roofTop','rooftop'],['facadeWindows','facadewin'],['bandAround','band']
  ].forEach(function(p){
    wrapFn(window,p[0],function(){ var a=arguments; for(var i=0;i<a.length;i++) if(a[i]&&a[i].id&&a[i].k) return p[1]+':'+a[i].id; return p[1]; });
  });
  /* 室外零碎道具（addOutdoorProps 里直接画的）：按源码里的段落认，再按空间连通分成一个个实例 */
  var PROP_SECT=null;
  function propSection(){
    var st=(new Error()).stack||'', m=st.match(/outdoor\.js:(\d+)/);
    if(!m||!PROP_SECT) return 'props';
    var ln=+m[1], best='props';
    for(var i=0;i<PROP_SECT.length;i++) if(ln>=PROP_SECT[i][0]) best=PROP_SECT[i][1];
    return best;
  }
  var origRec=rec;
  rec=function(p){ if(REC&&!OWN.length&&REC.outdoor) { OWN.push('prop:'+propSection()); origRec(p); OWN.pop(); return; } origRec(p); };

  /* ---------- 形体：点在里面吗（向里缩 EPS） ---------- */
  function inside(p,q,eps){
    var dx,dy,dz,lx,lz;
    if(p.t==='box'){
      dx=q[0]-p.c[0]; dy=q[1]-p.c[1]; dz=q[2]-p.c[2];
      lx=dx*p.tc-dz*p.ts; lz=dx*p.ts+dz*p.tc;
      return Math.abs(lx)<p.h[0]-eps&&Math.abs(dy)<p.h[1]-eps&&Math.abs(lz)<p.h[2]-eps;
    }
    if(p.t==='cyl'){
      dy=q[1]-p.c[1]; if(dy<eps||dy>p.hh-eps) return false;
      var r=p.rb+(p.rt-p.rb)*(dy/p.hh); dx=q[0]-p.c[0]; dz=q[2]-p.c[2];
      return dx*dx+dz*dz<Math.pow(Math.max(0,r-eps),2);
    }
    if(p.t==='rod'){
      var ax=p.b[0]-p.a[0], ay=p.b[1]-p.a[1], az=p.b[2]-p.a[2], L2=ax*ax+ay*ay+az*az||1e-9;
      var u=((q[0]-p.a[0])*ax+(q[1]-p.a[1])*ay+(q[2]-p.a[2])*az)/L2;
      if(u<0.02||u>0.98) return false;
      var px=p.a[0]+ax*u-q[0], py=p.a[1]+ay*u-q[1], pz=p.a[2]+az*u-q[2], rr=p.r0+(p.r1-p.r0)*u;
      return px*px+py*py+pz*pz<Math.pow(Math.max(0,rr-eps),2);
    }
    if(p.t==='blob'){
      dx=q[0]-p.c[0]; dy=q[1]-p.c[1]; dz=q[2]-p.c[2];
      lx=dx*p.tc-dz*p.ts; lz=dx*p.ts+dz*p.tc;
      var sh=1-(p.jit||0)*0.5-0.1;              /* 抖动过的树冠要多缩一点 */
      var rx=Math.max(1e-3,p.r[0]*sh-eps), ry=Math.max(1e-3,p.r[1]*sh-eps), rz=Math.max(1e-3,p.r[2]*sh-eps);
      return (lx*lx)/(rx*rx)+(dy*dy)/(ry*ry)+(lz*lz)/(rz*rz)<1;
    }
    return false;
  }
  /* 采样点：形体内部和表面附近的一组点 */
  function samples(p){
    var out=[], i, j, k;
    if(p.t==='box'){
      var f=[-0.9,0,0.9];
      for(i=0;i<3;i++) for(j=0;j<3;j++) for(k=0;k<3;k++){
        var lx=f[i]*p.h[0], ly=f[j]*p.h[1], lz=f[k]*p.h[2];
        out.push([p.c[0]+lx*p.tc+lz*p.ts, p.c[1]+ly, p.c[2]-lx*p.ts+lz*p.tc]);
      }
    }else if(p.t==='cyl'){
      for(j=0;j<3;j++){ var y=p.c[1]+p.hh*(0.1+0.4*j), r=(p.rb+(p.rt-p.rb)*(0.1+0.4*j))*0.85;
        out.push([p.c[0],y,p.c[2]]);
        for(k=0;k<6;k++) out.push([p.c[0]+Math.cos(k*1.047)*r,y,p.c[2]+Math.sin(k*1.047)*r]); }
    }else if(p.t==='rod'){
      for(j=0;j<5;j++){ var u=0.1+0.2*j; out.push([p.a[0]+(p.b[0]-p.a[0])*u,p.a[1]+(p.b[1]-p.a[1])*u,p.a[2]+(p.b[2]-p.a[2])*u]); }
    }else if(p.t==='blob'){
      var s=0.75; out.push(p.c.slice());
      [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]].forEach(function(d){
        var lx=d[0]*p.r[0]*s, lz=d[2]*p.r[2]*s;
        out.push([p.c[0]+lx*p.tc+lz*p.ts, p.c[1]+d[1]*p.r[1]*s, p.c[2]-lx*p.ts+lz*p.tc]); });
    }
    return out;
  }
  function aabb(p){
    if(p._bb) return p._bb;
    var S=samples(p), lo=[1e9,1e9,1e9], hi=[-1e9,-1e9,-1e9], pad;
    if(p.t==='box'){ var ex=Math.abs(p.h[0]*p.tc)+Math.abs(p.h[2]*p.ts), ez=Math.abs(p.h[0]*p.ts)+Math.abs(p.h[2]*p.tc);
      return p._bb=[[p.c[0]-ex,p.c[1]-p.h[1],p.c[2]-ez],[p.c[0]+ex,p.c[1]+p.h[1],p.c[2]+ez]]; }
    S.forEach(function(q){ for(var i=0;i<3;i++){ lo[i]=Math.min(lo[i],q[i]); hi[i]=Math.max(hi[i],q[i]); } });
    pad=p.t==='rod'?Math.max(p.r0,p.r1):(p.t==='cyl'?Math.max(p.rb,p.rt)*0.2:Math.max(p.r[0],p.r[1],p.r[2])*0.3);
    return p._bb=[[lo[0]-pad,lo[1]-pad,lo[2]-pad],[hi[0]+pad,hi[1]+pad,hi[2]+pad]];
  }
  /* 杆的轴线穿过盒子的那一段（参数区间），盒子向里缩 eps */
  function segBox(R,B,eps){
    function loc(q){ var dx=q[0]-B.c[0], dy=q[1]-B.c[1], dz=q[2]-B.c[2]; return [dx*B.tc-dz*B.ts, dy, dx*B.ts+dz*B.tc]; }
    var a=loc(R.a), b=loc(R.b), t0=0, t1=1, k;
    for(k=0;k<3;k++){
      var h=B.h[k]-eps, d=b[k]-a[k];
      if(h<=0) return null;
      if(Math.abs(d)<1e-9){ if(Math.abs(a[k])>=h) return null; continue; }
      var u0=(-h-a[k])/d, u1=(h-a[k])/d; if(u0>u1){ var tmp=u0; u0=u1; u1=tmp; }
      t0=Math.max(t0,u0); t1=Math.min(t1,u1); if(t0>=t1) return null;
    }
    return [t0,t1];
  }
  /* 两个只绕竖轴转的盒子：分离轴，返回最小穿透深度 */
  function boxBox(A,B){
    var yo=Math.min(A.c[1]+A.h[1],B.c[1]+B.h[1])-Math.max(A.c[1]-A.h[1],B.c[1]-B.h[1]);
    if(yo<=0) return 0;
    var axes=[[A.tc,-A.ts],[A.ts,A.tc],[B.tc,-B.ts],[B.ts,B.tc]], best=yo, i;
    function rad(P,ax){ return Math.abs(P.h[0]*(P.tc*ax[0]-P.ts*ax[1]))+Math.abs(P.h[2]*(P.ts*ax[0]+P.tc*ax[1])); }
    for(i=0;i<4;i++){
      var ax=axes[i], d=Math.abs((B.c[0]-A.c[0])*ax[0]+(B.c[2]-A.c[2])*ax[1]);
      var ov=rad(A,ax)+rad(B,ax)-d; if(ov<=0) return 0; best=Math.min(best,ov);
    }
    return best;
  }
  /* 「嵌入」：薄的那个的截面整个包在另一个里（踢脚线伸进柜子背后、托板埋进楼板、门框埋进墙）。
     真实世界里也是这样装的，看不出破绽；两边的棱都露在外面的交叉才算穿模 */
  function embedded(A,B){
    if(Math.abs(A.tc*B.ts-A.ts*B.tc)>1e-3&&Math.abs(A.tc*B.tc+A.ts*B.ts)>1e-3) return false;   /* 不同朝向的不判 */
    function ext(P){ var ex=Math.abs(P.h[0]*P.tc)+Math.abs(P.h[2]*P.ts), ez=Math.abs(P.h[0]*P.ts)+Math.abs(P.h[2]*P.tc);
      return [[P.c[0]-ex,P.c[0]+ex],[P.c[1]-P.h[1],P.c[1]+P.h[1]],[P.c[2]-ez,P.c[2]+ez]]; }
    function enc(S,L){                         /* S 的截面（除最长轴外的两轴）在 L 里 */
      var e=ext(S), f=ext(L), sz=[e[0][1]-e[0][0],e[1][1]-e[1][0],e[2][1]-e[2][0]], lng=sz.indexOf(Math.max.apply(null,sz)), k, ok=true;
      for(k=0;k<3;k++){ if(k===lng) continue; if(e[k][0]<f[k][0]-0.003||e[k][1]>f[k][1]+0.003){ ok=false; break; } }
      return ok;
    }
    return enc(A,B)||enc(B,A);
  }
  /* 「坐在面上」：小的那个只从大的一个面浅浅插进去（< 12 厘米）、另一头露在外面：
     篮球架底座压进场地面层、雨棚和门洞插进墙里、柱脚埋进地面。插得深、或者整个横穿才算 */
  function seated(A,B){
    if(Math.abs(A.tc*B.ts-A.ts*B.tc)>1e-3&&Math.abs(A.tc*B.tc+A.ts*B.ts)>1e-3) return false;
    function ext(P){ var ex=Math.abs(P.h[0]*P.tc)+Math.abs(P.h[2]*P.ts), ez=Math.abs(P.h[0]*P.ts)+Math.abs(P.h[2]*P.tc);
      return [[P.c[0]-ex,P.c[0]+ex],[P.c[1]-P.h[1],P.c[1]+P.h[1]],[P.c[2]-ez,P.c[2]+ez]]; }
    var vA=A.h[0]*A.h[1]*A.h[2], vB=B.h[0]*B.h[1]*B.h[2], S=vA<vB?A:B, L=vA<vB?B:A, e=ext(S), f=ext(L), k;
    for(k=0;k<3;k++){
      var ov=Math.min(e[k][1],f[k][1])-Math.max(e[k][0],f[k][0]);
      if(ov<0.12&&(e[k][0]<f[k][0]-0.01||e[k][1]>f[k][1]+0.01)&&!(e[k][0]<f[k][0]-0.01&&e[k][1]>f[k][1]+0.01)) return true;
    }
    return false;
  }
  /* 楼的实心主体（大于 30 立方米、各边都厚）：别的东西插进去的部分被墙体整个挡住，看不见 */
  function body(P){ return P.t==='box'&&/^bld:/.test(P.o)&&P.h[0]>0.2&&P.h[1]>0.2&&P.h[2]>0.2&&8*P.h[0]*P.h[1]*P.h[2]>30; }
  function collide(A,B,self){
    if(A.t==='box'&&B.t==='box'){ if(self) return null; var d=boxBox(A,B); if(d<=EPS||embedded(A,B)||seated(A,B)||body(A)||body(B)) return null; return [ (A.c[0]+B.c[0])/2,(A.c[1]+B.c[1])/2,(A.c[2]+B.c[2])/2 ]; }
    if(A.t==='rod'&&B.t==='box'||A.t==='box'&&B.t==='rod'){
      if(!self&&(body(A)||body(B))) return null;
      var R=A.t==='rod'?A:B, X=A.t==='rod'?B:A, iv=segBox(R,X,self?0.01:EPS);
      if(!iv) return null;
      var len=(iv[1]-iv[0])*Math.hypot(R.b[0]-R.a[0],R.b[1]-R.a[1],R.b[2]-R.a[2]);
      if(self&&(iv[0]<=0.001||iv[1]>=0.999)) return null;          /* 一头插在里面：接头，不算 */
      if(len<0.03) return null;
      /* 杆子从盒子的端面插进去、没有擦破侧面（栏杆插进柱子、管子穿墙）：嵌入，不算 */
      if(!self){ var r=Math.max(R.r0,R.r1), ivr=segBox(R,X,r+0.004);
        if(ivr&&(iv[1]-iv[0])-(ivr[1]-ivr[0])<(2*r+0.02)/Math.max(0.01,Math.hypot(R.b[0]-R.a[0],R.b[1]-R.a[1],R.b[2]-R.a[2]))) return null; }
      var u=(iv[0]+iv[1])/2; return [R.a[0]+(R.b[0]-R.a[0])*u,R.a[1]+(R.b[1]-R.a[1])*u,R.a[2]+(R.b[2]-R.a[2])*u];
    }
    if(self) return null;
    if(body(A)||body(B)) return null;
    var hit=null;
    samples(A).some(function(q){ if(inside(B,q,EPS)){ hit=q; return true; } return false; }) ||
    samples(B).some(function(q){ if(inside(A,q,EPS)){ hit=q; return true; } return false; });
    return hit;
  }
  function desc(P){
    function r(v){ return +v.toFixed(3); }
    if(P.t==='box') return 'box '+P.m+' c='+P.c.map(r)+' h='+P.h.map(r)+(P.ts?' yaw':'');
    if(P.t==='cyl') return 'cyl '+P.m+' c='+P.c.map(r)+' r='+r(P.rb)+'/'+r(P.rt)+' h='+r(P.hh);
    if(P.t==='rod') return 'rod '+P.m+' '+P.a.map(r)+'→'+P.b.map(r)+' r='+r(P.r0);
    return 'blob '+P.m+' c='+P.c.map(r)+' r='+P.r.map(r);
  }
  function top(o){ return o.replace(/\/.*$/,''); }
  function kind(o){ return o.replace(/[:#@].*$/,''); }

  /* ---------- 物件之间 ---------- */
  var SKIP_PAIR={'decor|decor':1,'light|light':1};
  function overlaps(list,ctx){
    var H={}, cell=1.0, out={}, i, j;
    list.forEach(function(p,idx){
      if(p.wall) return;
      var b=aabb(p);
      for(var gx=Math.floor(b[0][0]/cell);gx<=Math.floor(b[1][0]/cell);gx++)
        for(var gz=Math.floor(b[0][2]/cell);gz<=Math.floor(b[1][2]/cell);gz++){ var key=gx+','+gz; (H[key]=H[key]||[]).push(idx); }
    });
    for(var key in H){
      var L=H[key];
      for(i=0;i<L.length;i++) for(j=i+1;j<L.length;j++){
        var A=list[L[i]], B=list[L[j]];
        var self=(A.o===B.o);
        if(self&&!ctx.self) continue;
        var ka=kind(A.o), kb=kind(B.o);
        if(SKIP_PAIR[ka+'|'+kb]) continue;
        if(!self&&top(A.o)===top(B.o)) continue;
        var a=aabb(A), b=aabb(B);
        if(a[1][0]<b[0][0]||b[1][0]<a[0][0]||a[1][1]<b[0][1]||b[1][1]<a[0][1]||a[1][2]<b[0][2]||b[1][2]<a[0][2]) continue;
        var hit=collide(A,B,self);
        if(!hit) continue;
        var pk=[A.o,B.o].sort().join(' × ');
        if(self) pk=A.o+'|'+A.t+'>'+B.t+'|'+hit.map(function(v){ return Math.round(v*2); });
        if(!out[pk]) out[pk]={type:self?'self':'overlap',a:A.o,b:self?(A.t+'→'+B.t):B.o,at:hit.map(function(v){ return +v.toFixed(2); }),n:0,pa:desc(A),pb:desc(B)};
        out[pk].n++;
      }
    }
    return Object.keys(out).map(function(k){ return out[k]; });
  }

  /* ---------- 室内 ---------- */
  function room(id){
    var R=INTERIORS[id]; if(!R) throw new Error('未知房间：'+id);
    REC={list:[],mat:'',outdoor:false}; OWN=[]; OWNID=0;
    var savedPiano=S.__pianoPlaced, list=REC.list, g;
    try{ g=buildRoomGeometry(R); }finally{ REC=null; S.__pianoPlaced=savedPiano; }
    g.traverse(function(o){ if(o.geometry) o.geometry.dispose(); });
    var issues=overlaps(list,{self:true}).map(function(x){ x.room=id; return x; });
    var tw=R.tw*U2M, halfW=R.cols*tw/2, halfH=R.rows*tw/2;
    function cellOf(x,z){ return [Math.floor((x+halfW)/tw),Math.floor((z+halfH)/tw)]; }
    function chAt(c,r){ return (r<0||c<0||r>=R.rows||c>=R.cols)?'out':R.grid[r][c]; }
    /* 穿墙 / 伸进门洞 */
    var seen={};
    list.forEach(function(p){
      if(p.wall||!/@/.test(p.o)) return;
      var m=p.o.match(/@(\d+),(\d+)/), hc=+m[1], hr=+m[2];
      samples(p).forEach(function(q){
        if(q[1]<0.02) return;
        var cr=cellOf(q[0],q[2]), ch=chAt(cr[0],cr[1]);
        if(cr[0]===hc&&cr[1]===hr) return;
        var key, type=null;
        if(ch==='out') type='wall';
        else if(ch!=='#'){
          /* 从所在格走到采样点，中间有没有墙格 */
          var px=(q[0]+halfW)/tw, pz=(q[2]+halfH)/tw, n=Math.ceil(Math.hypot(px-hc-0.5,pz-hr-0.5)*4), s;
          for(s=1;s<n;s++){ var cc=Math.floor(hc+0.5+(px-hc-0.5)*s/n), rr=Math.floor(hr+0.5+(pz-hr-0.5)*s/n);
            if(chAt(cc,rr)==='#'){ type='wall'; break; } }
          if(!type&&(ch==='='||ch==='O'||ch==='S')&&!/^(door|exit|stair)/.test(p.o)) type='door';
        }
        if(!type) return;
        key=type+p.o; if(seen[key]) return; seen[key]=1;
        issues.push({type:type,room:id,a:p.o,cell:cr,ch:ch,at:q.map(function(v){ return +v.toFixed(2); })});
      });
    });
    /* 看得见的部分超出碰撞范围 */
    var byOwner={};
    list.forEach(function(p){ if(/^furn:/.test(p.o)){ (byOwner[p.o]=byOwner[p.o]||[]).push(p); } });
    Object.keys(byOwner).forEach(function(o){
      var m=o.match(/^furn:(.)@(\d+),(\d+)/), ch=m[1], c=+m[2], r=+m[3];
      var cx=(c+0.5)*tw-halfW, cz=(r+0.5)*tw-halfH, f=FURN_SOLID[ch];
      var col=[];
      if(R.foot){ var dc, dr; for(dr=-1;dr<=1;dr++) for(dc=-1;dc<=1;dc++) (R.foot[(c+dc)+','+(r+dr)]||[]).forEach(function(b){ col.push([b.x0,b.x1,b.z0,b.z1]); }); }
      else if(f!==undefined) col.push([cx-tw*f/2,cx+tw*f/2,cz-tw*f/2,cz+tw*f/2]);
      (R.propExtra||[]).forEach(function(b){ if(b.x1>cx-tw*2&&b.x0<cx+tw*2&&b.z1>cz-tw*2&&b.z0<cz+tw*2) col.push([b.x0,b.x1,b.z0,b.z1]); });
      var worst=0, wq=null;
      byOwner[o].forEach(function(p){
        var b=aabb(p); if(b[1][1]<0.12||b[0][1]>1.85) return;          /* 脚边贴地的、头顶以上的不算 */
        samples(p).forEach(function(q){
          if(q[1]<0.12||q[1]>1.85) return;
          var d=1e9;
          col.forEach(function(k){ var dx=Math.max(k[0]-q[0],0,q[0]-k[1]), dz=Math.max(k[2]-q[2],0,q[2]-k[3]); d=Math.min(d,Math.hypot(dx,dz)); });
          if(!col.length) d=1e9;
          if(d>worst){ worst=d; wq=q; }
        });
      });
      if(!col.length&&worst>0) issues.push({type:'walk',room:id,a:o,depth:'无碰撞',at:wq&&wq.map(function(v){ return +v.toFixed(2); })});
      else if(worst>PRAD*U2M-0.03&&worst<50) issues.push({type:'walk',room:id,a:o,depth:+(worst-(PRAD*U2M-0.03)).toFixed(2),at:wq.map(function(v){ return +v.toFixed(2); })});
    });
    /* 巡察者：按它真实用的细网格（patrol.js 的 patNav，门都当开着），能站的小格中心离物件不到 0.28 米就是擦到了 */
    if(R.host==='teach'||R.host==='admin'||R.host==='lab'){
      var nv=patNav(R), N=PAT_NAV_N, pseen={};
      function freeAt(i,j){ if(i<0||j<0||i>=nv.W||j>=nv.H) return false; return !nv.blk[i+j*nv.W]; }
      list.forEach(function(p){
        if(p.wall||!/^furn:/.test(p.o)) return;
        samples(p).forEach(function(q){
          if(q[1]<0.1||q[1]>2.4||pseen[p.o]) return;
          var gi=(q[0]+halfW)/tw*N-0.5, gj=(q[2]+halfH)/tw*N-0.5, a, b;
          for(b=Math.floor(gj)-2;b<=Math.ceil(gj)+2;b++) for(a=Math.floor(gi)-2;a<=Math.ceil(gi)+2;a++){
            if(pseen[p.o]||!freeAt(a,b)) continue;
            var nx=(a+0.5)/N*tw-halfW, nz=(b+0.5)/N*tw-halfH;
            if(Math.hypot(nx-q[0],nz-q[2])<0.28){ pseen[p.o]=1; issues.push({type:'patrol',room:id,a:p.o,at:q.map(function(v){ return +v.toFixed(2); })}); }
          }
        });
      });
    }
    reach(R).forEach(function(x){ issues.push(x); });
    if(R.host==='teach'&&R.floor>=1&&R.floor<=5) npcSeat(R,list,halfW,halfH,tw).forEach(function(x){ issues.push(x); });
    return issues;
  }
  /* 坐着的同学（classroom.js 的 ncSeatFigure）和他面前的课桌、身下的椅子：人形转半圈、放在格子中心往后 0.32 格 */
  function npcSeat(R,list,halfW,halfH,tw){
    var out=[], r, c, cell=null;
    for(r=0;r<R.rows&&!cell;r++) for(c=0;c<R.cols&&!cell;c++) if(R.grid[r][c]==='d') cell=[c,r];
    if(!cell) return out;
    var tag='furn:d@'+cell[0]+','+cell[1]+'#', desk=list.filter(function(p){ return p.o.indexOf(tag)===0; });
    var saved={}, k;
    for(k in FIG_GEO) if(/^(sit|A\|fig_sit)\|/.test(k)){ saved[k]=FIG_GEO[k]; delete FIG_GEO[k]; }
    REC={list:[],mat:'',outdoor:false}; OWN=['npc'];
    try{ figGeo('sit'); }finally{ var fl=REC.list; REC=null; OWN=[]; }
    for(k in FIG_GEO) if(/^(sit|A\|fig_sit)\|/.test(k)) delete FIG_GEO[k];
    for(k in saved) FIG_GEO[k]=saved[k];
    var x0=(cell[0]+0.5)*tw-halfW, z0=(cell[1]+0.82)*tw-halfH;
    function tp(q){ return [x0-q[0],q[1],z0-q[2]]; }
    fl.forEach(function(p){
      if(p.c) p.c=tp(p.c); if(p.a) p.a=tp(p.a); if(p.b) p.b=tp(p.b);
      if(p.tc!==undefined){ p.tc=-p.tc; p.ts=-p.ts; }
      desk.forEach(function(d){
        var hit=collide(p,d,false);
        if(hit) out.push({type:'npc',room:R.id,a:'npc',b:d.o,pa:desc(p),pb:desc(d),at:hit.map(function(v){ return +v.toFixed(2); })});
      });
    });
    return out;
  }
  /* 可达性：门全开，玩家（半径 PRAD）从出口、楼梯、门口出发能走到的地方里，
     每个能交互的东西（门、出口、楼梯、座位、柜子、能搜的家具、设施……）旁边 1.2 米内要有能站的点 */
  var REACH_CH='=OSPHqdfRDQxAMKVTZCNYwbXkJ';
  function reach(R){
    var id=R.id, out=[], step=3, W=Math.ceil(R.w/step), H=Math.ceil(R.h/step), seen=new Uint8Array(W*H), q=[], head=0;
    if(R.spiral) return out;                                        /* 钟楼：旋梯另有自己的高度逻辑 */
    var saved=OPENDOORS, fake={}, r, c, k;
    for(r=0;r<R.rows;r++) for(c=0;c<R.cols;c++) if(R.grid[r][c]==='=') fake[doorKey(R,R.ox+(c+0.5)*R.tw,R.oy+(r+0.5)*R.th)]=1;
    OPENDOORS=fake;
    try{
      function stand(x,y){ return Collision.depth(x,y,PRAD,R)<1e-7; }
      function P(i,j){ return [R.ox+(i+0.5)*step,R.oy+(j+0.5)*step]; }
      for(r=0;r<R.rows;r++) for(c=0;c<R.cols;c++){
        var ch=R.grid[r][c];
        if(ch!=='O'&&ch!=='S'&&!(ch==='J'&&(R.host==='lift'||R.host==='dream')))continue;
        var i0=Math.floor((c-1.5)*R.tw/step), i1=Math.ceil((c+2.5)*R.tw/step), j0=Math.floor((r-1.5)*R.th/step), j1=Math.ceil((r+2.5)*R.th/step), i, j;
        for(j=Math.max(0,j0);j<Math.min(H,j1);j++) for(i=Math.max(0,i0);i<Math.min(W,i1);i++){
          var p=P(i,j); if(!seen[i+j*W]&&stand(p[0],p[1])){ seen[i+j*W]=1; q.push(i+j*W); }
        }
      }
      while(head<q.length){
        k=q[head++]; var ci=k%W, cj=(k-ci)/W;
        [[1,0],[-1,0],[0,1],[0,-1]].forEach(function(d){
          var ni=ci+d[0], nj=cj+d[1], nk=ni+nj*W; if(ni<0||nj<0||ni>=W||nj>=H||seen[nk]) return;
          var p=P(ni,nj); if(!stand(p[0],p[1])) return; seen[nk]=1; q.push(nk);
        });
      }
      var tw=R.tw*U2M, halfW=R.cols*tw/2, halfH=R.rows*tw/2;
      for(r=0;r<R.rows;r++) for(c=0;c<R.cols;c++){
        var ch2=R.grid[r][c]; if(REACH_CH.indexOf(ch2)<0) continue;
        if(ch2==='S'&&((c>0&&R.grid[r][c-1]==='S')||(r>0&&R.grid[r-1][c]==='S'))) continue;   /* 楼梯按一组算，只查第一格 */
        var F=(R.foot&&R.foot[c+','+r])||null, cx=(c+0.5)*tw-halfW, cz=(r+0.5)*tw-halfH, ok=false;
        if(ch2==='S'){ var si2=stairInfo(R,c,r); cx+=(si2.gw-1)*tw/2; cz+=(si2.gd-1)*tw/2; }
        var ri0=Math.max(0,Math.floor((c-2)*R.tw/step)), ri1=Math.min(W,Math.ceil((c+3)*R.tw/step)), rj0=Math.max(0,Math.floor((r-2)*R.th/step)), rj1=Math.min(H,Math.ceil((r+3)*R.th/step)), a, b;
        for(b=rj0;b<rj1&&!ok;b++) for(a=ri0;a<ri1&&!ok;a++){
          if(!seen[a+b*W]) continue;
          var pp=P(a,b), mx=(pp[0]-R.ox)*U2M-halfW, mz=(pp[1]-R.oy)*U2M-halfH, d=Math.hypot(mx-cx,mz-cz);
          if(F) F.forEach(function(q2){ d=Math.min(d,Math.hypot(Math.max(q2.x0-mx,0,mx-q2.x1),Math.max(q2.z0-mz,0,mz-q2.z1))+0.3); });
          if(d<=1.2) ok=true;
        }
        if(!ok) out.push({type:'reach',room:id,a:ch2+'@'+c+','+r,at:[+cx.toFixed(2),0,+cz.toFixed(2)]});
      }
    }finally{ OPENDOORS=saved; }
    return out;
  }
  /* ---------- 室外 ---------- */
  function outdoor(){
    if(!PROP_SECT){
      PROP_SECT=[];
      /* 按源码里的「---- 名字 ----」注释切段（用文件里的真实行号，和调用栈对得上） */
      var xhr=new XMLHttpRequest(); xhr.open('GET','game3d/js/model/outdoor.js',false); xhr.send();
      xhr.responseText.split('\n').forEach(function(l,i){ var m=l.match(/\/\* ---- ([^：:（( -]+)/); if(m) PROP_SECT.push([i+1,m[1]]); });
    }
    REC={list:[],mat:'',outdoor:true}; OWN=[]; OWNID=0;
    var g, list=REC.list;
    var savedOut=OUT_SOLID.slice();
    try{ g=buildOutdoorGeometry(); }finally{
      REC=null;
      OUT_SOLID.length=0; savedOut.forEach(function(x){ OUT_SOLID.push(x); });
    }
    g.traverse(function(o){ if(o.geometry) o.geometry.dispose(); });
    /* 零碎道具：同一段里按空间连通分成实例 */
    var props=list.filter(function(p){ return /^prop:/.test(p.o); }), parent=props.map(function(_,i){ return i; });
    function fnd(i){ while(parent[i]!==i) i=parent[i]=parent[parent[i]]; return i; }
    var H={};
    props.forEach(function(p,i){ var b=aabb(p); var k=p.o+'|'+Math.floor((b[0][0]+b[1][0])/4)+','+Math.floor((b[0][2]+b[1][2])/4); (H[k]=H[k]||[]).push(i); });
    props.forEach(function(p,i){
      var b=aabb(p), cx=Math.floor((b[0][0]+b[1][0])/4), cz=Math.floor((b[0][2]+b[1][2])/4);
      for(var dx=-1;dx<=1;dx++) for(var dz=-1;dz<=1;dz++){ (H[p.o+'|'+(cx+dx)+','+(cz+dz)]||[]).forEach(function(j){
        if(j<=i) return; var c=aabb(props[j]);
        if(b[1][0]+0.05<c[0][0]||c[1][0]+0.05<b[0][0]||b[1][2]+0.05<c[0][2]||c[1][2]+0.05<b[0][2]) return;
        parent[fnd(i)]=fnd(j); }); }
    });
    props.forEach(function(p,i){ p.o=p.o+'#'+fnd(i); });
    return overlaps(list,{}).map(function(x){ x.room='out'; return x; });
  }
  function all(){
    var res=[];
    Object.keys(INTERIORS).forEach(function(id){ try{ res=res.concat(room(id)); }catch(e){ res.push({type:'error',room:id,a:String(e)}); } });
    try{ res=res.concat(outdoor()); }catch(e){ res.push({type:'error',room:'out',a:String(e&&e.stack||e)}); }
    return res;
  }
  return {room:room,outdoor:outdoor,all:all,_inside:inside,_samples:samples};
})();
