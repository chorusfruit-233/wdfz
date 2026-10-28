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
  [['roomDoor','door'],['roomExit','exit'],['roomStairs','stair'],['wallWindow','window'],['ceilingLight','light'],['buildSpiral','spiral'],['roomDecor','decor'],
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
  function collide(A,B,self){
    if(A.t==='box'&&B.t==='box'){ if(self) return null; var d=boxBox(A,B); if(d<=EPS||embedded(A,B)) return null; return [ (A.c[0]+B.c[0])/2,(A.c[1]+B.c[1])/2,(A.c[2]+B.c[2])/2 ]; }
    if(A.t==='rod'&&B.t==='box'||A.t==='box'&&B.t==='rod'){
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
    var R=INTERIORS[id]; if(!R) return [];
    REC={list:[],mat:'',outdoor:false}; OWN=[]; OWNID=0;
    var savedPiano=S.__pianoPlaced, g;
    try{ g=buildRoomGeometry(R); }finally{ REC.done=1; }
    var list=REC.list; REC=null; S.__pianoPlaced=savedPiano;
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
      if(f!==undefined) col.push([cx-tw*f/2,cx+tw*f/2,cz-tw*f/2,cz+tw*f/2]);
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
    /* 巡察者：沿可走格子中心之间的连线走，身体半径 0.28 */
    if(R.host==='teach'||R.host==='admin'||R.host==='lab'){
      var segs=[], cc2, rr2;
      for(rr2=0;rr2<R.rows;rr2++) for(cc2=0;cc2<R.cols;cc2++){
        if(!patWalkable(R,cc2,rr2)) continue;
        [[1,0],[0,1]].forEach(function(d){ if(patWalkable(R,cc2+d[0],rr2+d[1])) segs.push([(cc2+0.5)*tw-halfW,(rr2+0.5)*tw-halfH,(cc2+d[0]+0.5)*tw-halfW,(rr2+d[1]+0.5)*tw-halfH]); });
      }
      var pseen={};
      list.forEach(function(p){
        if(p.wall||!/^furn:/.test(p.o)) return;
        samples(p).forEach(function(q){
          if(q[1]<0.1||q[1]>2.4||pseen[p.o]) return;
          for(var i=0;i<segs.length;i++){ var s=segs[i], vx=s[2]-s[0], vz=s[3]-s[1], u=((q[0]-s[0])*vx+(q[2]-s[1])*vz)/(vx*vx+vz*vz);
            u=Math.max(0,Math.min(1,u)); if(Math.hypot(s[0]+vx*u-q[0],s[1]+vz*u-q[2])<0.28){ pseen[p.o]=1; issues.push({type:'patrol',room:id,a:p.o,at:q.map(function(v){ return +v.toFixed(2); })}); break; } }
        });
      });
    }
    return issues;
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
    var g;
    var savedOut=OUT_SOLID.slice();
    try{ g=buildOutdoorGeometry(); }finally{ REC.done=1; }
    var list=REC.list; REC=null;
    OUT_SOLID.length=0; savedOut.forEach(function(x){ OUT_SOLID.push(x); });
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
