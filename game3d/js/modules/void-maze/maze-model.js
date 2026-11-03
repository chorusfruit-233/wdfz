/* @module-capsule */
(function($imports){
/* 里世界 3D · 虚空迷宫：建模（模块 void-maze）
   体素的实心与空气交界处出面：同一平面上相邻的面合并成最大 4 × 4 米的板，每块板的白有一点点差别，
   看起来是一块块方正的白色板材拼起来的。世界的边界不出面；虚空往下没有底，远处是一块全黑的面，雾把它吃掉。
   楼梯一级级是悬空的方块；出口是一扇暗门，门缝漏出淡蓝色的光。 */
'use strict';

var MAZE_LOOK={
  white:0xe4e2dc, step:0xdcdad3, plat:0xd8d6cf,
  up:1.0, down:0.70, sideX:0.90, sideZ:0.85, jitter:0.05, panel:4,
  door:0x111417, gap:0xa8dcff, frame:0xbdbcb6, hatch:0x8d8b86, chalk:0xf2f0e8
};

function buildVoidMaze(R){
  var C=$imports.MAZE_CFG, L=MAZE_LOOK, NX=C.cols, NY=C.ny, NZ=C.rows, X0=C.x0, Y0=C.y0, Z0=C.z0;
  $imports.VoidMaze.build();
  var K=new $imports.Kit({chunk:16});
  var dims=[NX,NY,NZ], org=[X0,Y0,Z0], p=[0,0,0], d, u, v, k, i, j;
  var cell=$imports.VoidMaze.cell;
  /* ---- 体素面：按三个轴、每个切面做贪心合并 ---- */
  for(d=0;d<3;d++){
    u=(d+1)%3; v=(d+2)%3;
    var du=dims[u], dv=dims[v], mask=new Int8Array(du*dv);
    for(k=1;k<dims[d];k++){
      var n=0, any=false;
      for(j=0;j<dv;j++) for(i=0;i<du;i++){
        p[d]=k-1; p[u]=i; p[v]=j; var sa=cell(p[0],p[1],p[2]);
        p[d]=k; var sb=cell(p[0],p[1],p[2]);
        var m=(sa&&!sb)?1:((!sa&&sb)?-1:0);
        mask[n++]=m; if(m) any=true;
      }
      if(!any) continue;
      for(j=0;j<dv;j++){
        for(i=0;i<du;){
          var mm=mask[j*du+i];
          if(!mm){ i++; continue; }
          var w=1; while(i+w<du&&w<L.panel&&mask[j*du+i+w]===mm) w++;
          var h=1, ok=true;
          while(j+h<dv&&h<L.panel){
            for(var q=0;q<w;q++) if(mask[(j+h)*du+i+q]!==mm){ ok=false; break; }
            if(!ok) break; h++;
          }
          for(var b2=0;b2<h;b2++) for(var a2=0;a2<w;a2++) mask[(j+b2)*du+i+a2]=0;
          mazeQuad(K,d,u,v,k,i,i+w,j,j+h,mm,org,L);
          i+=w;
        }
      }
    }
  }
  /* ---- 楼梯与平台 ---- */
  $imports.MAZE_WALK.forEach(function(w,wi){
    var sx=w.x1-w.x0, sz=w.z1-w.z0;
    if(w.t==='plat'){ K.box('plaster',(w.x0+w.x1)/2,w.h-0.15,(w.z0+w.z1)/2,sx,0.3,sz,L.plat,0.97+0.03*(0,$imports.hash2)(wi,3)); return; }
    var len=Math.abs(w.a1-w.a0), n=Math.max(2,Math.round(Math.abs(w.h1-w.h0)/0.18)), run=len/n, dir=w.a1>w.a0?1:-1;
    for(var s=0;s<n;s++){
      var a=w.a0+dir*run*(s+0.5), top=w.h0+(w.h1-w.h0)*(s+0.5)/n, sh=(s&1)?1:0.95;
      if(w.ax==='x') K.box('plaster',a,top-0.15,(w.z0+w.z1)/2,run,0.3,sz,L.step,sh);
      else K.box('plaster',(w.x0+w.x1)/2,top-0.15,a,sx,0.3,run,L.step,sh);
    }
  });
  /* ---- 出口：暗门，门缝漏光 ---- */
  C.exits.forEach(function(e){
    var alongX=e.n[0]===0, cx=e.x-e.n[0]*0.1, cz=e.z-e.n[1]*0.1, y=e.h;   /* 门贴在墙面上（交互点离墙 0.1 米） */
    function bx(m,ax,ay,az,w,hh,dep,col,sh){                 /* ax：沿墙的偏移，az：离墙的距离 */
      if(alongX) K.box(m,cx+ax,y+ay,cz+e.n[1]*az,w,hh,dep,col,sh);
      else K.box(m,cx+e.n[0]*az,y+ay,cz+ax,dep,hh,w,col,sh);
    }
    bx('plastic',0,1.03,0.03,0.96,2.06,0.04,L.door,1);
    bx('emit',0,0.02,0.055,0.98,0.04,0.012,L.gap,1);         /* 门底下的缝最亮 */
    bx('emit',-0.497,1.03,0.055,0.024,2.06,0.012,L.gap,0.75);
    bx('emit',0.497,1.03,0.055,0.024,2.06,0.012,L.gap,0.75);
    bx('emit',0,2.072,0.055,0.98,0.02,0.012,L.gap,0.55);
    bx('plaster',-0.56,1.08,0.06,0.10,2.16,0.12,L.frame,0.9);  /* 门套 */
    bx('plaster',0.56,1.08,0.06,0.10,2.16,0.12,L.frame,0.9);
    bx('plaster',0,2.19,0.06,1.22,0.10,0.12,L.frame,0.9);
  });
  /* ---- 出生 / 重来区域：地上一块淡淡的斜线方块；地上半截粉笔 ---- */
  var sp=C.spawn, t, hy=sp.h+0.004;
  for(t=sp.x0-sp.z1+0.25;t<sp.x1-sp.z0;t+=0.7){                /* 线 x − z = t 和方块相交的那一段 */
    var za=Math.max(sp.z0,sp.x0-t), zb=Math.min(sp.z1,sp.x1-t);
    if(zb-za<0.05) continue;
    var mx=t+(za+zb)/2, mz=(za+zb)/2, seg=(zb-za)*Math.SQRT2;
    K.frame(mx,mz,-Math.PI/4,0); K.box('decal',0,hy,0,seg,0.003,0.035,L.hatch,1); K.unframe();
  }
  [[sp.x0,sp.z0,sp.x1,sp.z0],[sp.x0,sp.z1,sp.x1,sp.z1]].forEach(function(s){ K.box('decal',(s[0]+s[2])/2,hy,s[1],s[2]-s[0],0.003,0.04,L.hatch,1); });
  [[sp.x0,sp.z0,sp.x0,sp.z1],[sp.x1,sp.z0,sp.x1,sp.z1]].forEach(function(s){ K.box('decal',s[0],hy,(s[1]+s[3])/2,0.04,0.003,s[3]-s[1],L.hatch,1); });
  K.frame(C.chalk.x,C.chalk.z,0.6,0); K.box('paper',0,C.chalk.h+0.011,0,0.085,0.022,0.022,L.chalk,1); K.unframe();
  /* ---- 虚空的底：很远的一块黑 ---- */
  K.g('dark').quadN([-90,-70,-110],[-90,-70,110],[90,-70,110],[90,-70,-110],0,1,0,0x000000);
  var grp=K.build();
  grp.userData.voidMaze=1;
  return grp;
}
/* 一块合并后的面：d 是法线轴，k 是切面位置，[u0,u1) × [v0,v1) 是范围；m = ±1 是法线朝向 */
function mazeQuad(K,d,u,v,k,u0,u1,v0,v1,m,org,L){
  function P(a,b){ var q=[0,0,0]; q[d]=k; q[u]=a; q[v]=b; return [q[0]+org[0],q[1]+org[1],q[2]+org[2]]; }
  var nrm=[0,0,0]; nrm[d]=m;
  var sh=d===1?(m>0?L.up:L.down):(d===0?L.sideX:L.sideZ);
  sh*=1-L.jitter+2*L.jitter*(0,$imports.hash2)(u0*7+v0*13+k*3,d*31+(m>0?5:11));
  var rgb=K.g('plaster')._rgb(L.white,sh);
  var pts=m>0?[P(u0,v0),P(u1,v0),P(u1,v1),P(u0,v1)]:[P(u0,v0),P(u0,v1),P(u1,v1),P(u1,v0)];
  K.g('plaster').face(pts,nrm,rgb,true);
}

/* @module-exports */
GameModules.publish("game3d/js/modules/void-maze/maze-model.js",{
"MAZE_LOOK":{get:function(){return MAZE_LOOK;},set:function($value){MAZE_LOOK=$value;}},
"buildVoidMaze":{get:function(){return buildVoidMaze;},set:function($value){buildVoidMaze=$value;}},
"mazeQuad":{get:function(){return mazeQuad;},set:function($value){mazeQuad=$value;}}
});
})(GameModules.imports("game3d/js/modules/void-maze/maze-model.js"));
