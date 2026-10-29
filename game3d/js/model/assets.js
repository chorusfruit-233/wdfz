/* 里世界 3D · 模型资源包
   家具、道具、楼体构件、树、人物、手都在 Blender 里建模（tools/blender，建模脚本见 tools/blender/assets），
   按四个细节档位导出成 game3d/assets/models_l<档>.js：0 真实、1 超精细、2 精细 / 均衡、3 流畅。
   文件是普通脚本（ASSET_PACK(档, 元数据, base64)），双击 index.html 用 file:// 打开也能读。

   开局只加载当前画质要的那一档（这个脚本在解析时就把它插进页面，后面的脚本跑起来时已经读好了）；
   游戏里换画质时再按需加载，读好以前先用已有的最接近的一档，读好以后重建当前场景。

   用法：
     Kit.asset(名字, x, y, z, 转角, {tint:{标签:颜色}, mat:{旧材质:新材质}, s:缩放})  —— 并进房间 / 室外的网格（kit.js）
     Assets.geometry(名字)                                                       —— 单独一件的几何体（人物、手）
     Assets.mesh(名字)                                                           —— 单独一件，按材质分好的一组网格 */
'use strict';

var ASSETS={packs:{},loading:{},waiters:{}};
/* ---- 解压：标准的 deflate（RFC 1951，无头），查表解哈夫曼码。包在读进来的那一刻同步解开 ---- */
var INFL=(function(){
  var LB=[3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258],
      LX=[0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0],
      DB=[1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577],
      DX=[0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13],
      ORD=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];
  /* 码长 → 查找表：低 m 位（按读入顺序）直接查到 (符号<<4)|码长 */
  function table(lens,n){
    var max=0,i,k; for(i=0;i<n;i++) if(lens[i]>max) max=lens[i];
    var cnt=new Uint16Array(16), next=new Uint16Array(16), code=0;
    for(i=0;i<n;i++) cnt[lens[i]]++; cnt[0]=0;
    for(i=1;i<=max;i++){ code=(code+cnt[i-1])<<1; next[i]=code; }
    var size=1<<max, T=new Uint32Array(size||1);
    for(i=0;i<n;i++){
      var L=lens[i]; if(!L) continue;
      var c=next[L]++, r=0; for(k=0;k<L;k++) r=(r<<1)|((c>>k)&1);
      for(k=r;k<size;k+=1<<L) T[k]=(i<<4)|L;
    }
    return {t:T,m:max};
  }
  var FIXL=null, FIXD=null;
  return function(src,out){
    var sp=0, op=0, bb=0, bc=0, sl=src.length;
    function need(n){ while(bc<n){ bb|=(sp<sl?src[sp]:0)<<bc; sp++; bc+=8; } }
    function bits(n){ need(n); var v=bb&((1<<n)-1); bb>>>=n; bc-=n; return v; }
    function sym(H){ need(H.m); var e=H.t[bb&((1<<H.m)-1)], L=e&15; bb>>>=L; bc-=L; return e>>>4; }
    var fin, type, i;
    do{
      fin=bits(1); type=bits(2);
      if(type===0){                                      /* 不压缩的块：对齐到字节 */
        var drop=bc&7; bb>>>=drop; bc-=drop; sp-=bc>>3; bb=0; bc=0;
        var len=src[sp]|(src[sp+1]<<8); sp+=4;
        out.set(src.subarray(sp,sp+len),op); sp+=len; op+=len;
        continue;
      }
      var HL, HD;
      if(type===1){
        if(!FIXL){ var l=new Uint8Array(288); for(i=0;i<288;i++) l[i]=i<144?8:(i<256?9:(i<280?7:8)); FIXL=table(l,288);
          var d=new Uint8Array(30); for(i=0;i<30;i++) d[i]=5; FIXD=table(d,30); }
        HL=FIXL; HD=FIXD;
      }else{
        var hl=bits(5)+257, hd=bits(5)+1, hc=bits(4)+4, cl=new Uint8Array(19);
        for(i=0;i<hc;i++) cl[ORD[i]]=bits(3);
        var HC=table(cl,19), lens=new Uint8Array(hl+hd), n=0;
        while(n<hl+hd){
          var s=sym(HC);
          if(s<16) lens[n++]=s;
          else if(s===16){ var pv=lens[n-1], r=3+bits(2); while(r--) lens[n++]=pv; }
          else if(s===17){ n+=3+bits(3); }
          else{ n+=11+bits(7); }
        }
        HL=table(lens.subarray(0,hl),hl); HD=table(lens.subarray(hl),hd);
      }
      for(;;){
        var c=sym(HL);
        if(c<256){ out[op++]=c; continue; }
        if(c===256) break;
        c-=257;
        var ln=LB[c]+(LX[c]?bits(LX[c]):0), dc=sym(HD), ds=DB[dc]+(DX[dc]?bits(DX[dc]):0), from=op-ds;
        while(ln--) out[op++]=out[from++];
      }
    }while(!fin);
    return op;
  };
})();
/* 解开以后是各分量分开、16 位拆成低 / 高字节面的差分数据：按组做前缀和还原 */
function assetUnpack(meta,z){
  var nv=meta.nv, ni=meta.ni, S=new Uint8Array(meta.raw), k, i, g, o=0;
  INFL(z,S);
  var pos=new Uint16Array(nv*3), nrm=new Int8Array(nv*3), col=new Uint8Array(nv*3), uv=new Int16Array(nv*2), idx=new Uint16Array(ni);
  for(k=0;k<3;k++){ for(i=0;i<nv;i++) pos[i*3+k]=S[o+i]|(S[o+nv+i]<<8); o+=nv*2; }
  for(k=0;k<3;k++){ for(i=0;i<nv;i++) nrm[i*3+k]=S[o+i]; o+=nv; }
  for(k=0;k<3;k++){ for(i=0;i<nv;i++) col[i*3+k]=S[o+i]; o+=nv; }
  for(k=0;k<2;k++){ for(i=0;i<nv;i++) uv[i*2+k]=S[o+i]|(S[o+nv+i]<<8); o+=nv*2; }
  for(i=0;i<ni;i++) idx[i]=S[o+i]|(S[o+ni+i]<<8);
  for(var name in meta.assets){
    var G=meta.assets[name].g;
    for(g=0;g<G.length;g++){
      var v0=G[g][2], gv=G[g][3], i0=G[g][4], gi=G[g][5];
      for(i=v0+1;i<v0+gv;i++){
        for(k=0;k<3;k++){ pos[i*3+k]+=pos[(i-1)*3+k]; nrm[i*3+k]+=nrm[(i-1)*3+k]; col[i*3+k]+=col[(i-1)*3+k]; }
        uv[i*2]+=uv[(i-1)*2]; uv[i*2+1]+=uv[(i-1)*2+1];
      }
      for(i=i0+1;i<i0+gi;i++) idx[i]+=idx[i-1];
    }
  }
  return {pos:pos,nrm:nrm,col:col,uv:uv,idx:idx};
}
function ASSET_PACK(lod,meta,b64){
  var bin=atob(b64), n=bin.length, u8=new Uint8Array(n), i;
  for(i=0;i<n;i++) u8[i]=bin.charCodeAt(i);
  var d=assetUnpack(meta,u8);
  ASSETS.packs[lod]={lod:lod,meta:meta,assets:meta.assets,pos:d.pos,nrm:d.nrm,col:d.col,uv:d.uv,idx:d.idx};
  delete ASSETS.loading[lod];
  var w=ASSETS.waiters[lod]||[]; delete ASSETS.waiters[lod];           /* 只叫等这一档的：别的档先读好不能把它们的回调吃掉 */
  w.forEach(function(f){ try{ f(lod); }catch(e){ setTimeout(function(){ throw e; }); } });
}

var Assets=(function(){
  var GEO={}, TINT={};
  function want(){ return Quality.get().lod; }
  function packFor(name,lod){
    var P=ASSETS.packs, best=null, bd=99, k;
    if(P[lod]&&P[lod].assets[name]) return P[lod];
    for(k in P){ var d=Math.abs(+k-lod)+(+k<lod?0.5:0); if(P[k].assets[name]&&d<bd){ bd=d; best=P[k]; } }   /* 同样远时宁可细一点 */
    return best;
  }
  function rgbOf(hex){
    if(TINT[hex]) return TINT[hex];
    return TINT[hex]=[((hex>>16)&255)/255,((hex>>8)&255)/255,(hex&255)/255];
  }
  /* 这一档的包还没读：插一个 script 去读，读好了回调（file:// 也行） */
  function load(lod,cb){
    if(ASSETS.packs[lod]){ if(cb) cb(lod); return true; }
    if(cb) (ASSETS.waiters[lod]||(ASSETS.waiters[lod]=[])).push(cb);
    if(ASSETS.loading[lod]) return false;
    ASSETS.loading[lod]=1;
    if(typeof document==='undefined') return false;
    var s=document.createElement('script');
    s.src=ASSETS_BASE+'models_l'+lod+'.js'; s.async=true;
    s.onerror=function(){ delete ASSETS.loading[lod]; };
    document.head.appendChild(s);
    return false;
  }
  return {
    want:want,
    load:load,
    ready:function(lod){ return !!ASSETS.packs[lod===undefined?want():lod]; },
    /* 当前档位用哪一件：{pk 包, m 元数据}，没有就 null */
    get:function(name,lod){ var pk=packFor(name,lod===undefined?want():lod); return pk?{pk:pk,m:pk.assets[name]}:null; },
    has:function(name){ return !!packFor(name,want()); },
    bounds:function(name){ var a=this.get(name); return a?a.m.b:null; },
    anchor:function(name,key){ var a=this.get(name); return a&&a.m.a?a.m.a[key]||null:null; },
    rgb:rgbOf,
    /* 单独一件的几何体：所有组并成一个，颜色乘好染色；每个材质一个 group（geometry.groups）。按档位缓存、共用 */
    geometry:function(name,opt){
      var a=this.get(name); if(!a) return null;
      opt=opt||{};
      var key=name+'|'+a.pk.lod+'|'+(opt.key||'');
      if(GEO[key]) return GEO[key];
      var K=new Kit(); K.asset(name,0,0,0,0,opt);
      var g=K.groupedGeometry();
      g.userData={shared:true,asset:name,assetLod:a.pk.lod,assetOpt:opt};
      GEO[key]=g;
      return g;
    },
    /* 单独一件，按材质分成几个网格（用游戏的共享材质） */
    mesh:function(name,opt){
      var K=new Kit(); if(!K.asset(name,0,0,0,0,opt)) return null;
      var grp=K.build(); grp.userData.asset=name;
      return grp;
    },
    /* 实例化用的一组几何体（模型自己的坐标）：位置还原成米、颜色是包里存的原值（倍数 cs 放在实例颜色里）、
       贴图坐标除以材质的平铺尺寸。所有房间共用，不随房间销毁 */
    groupGeometry:function(pk,name,gi,mk){
      var key='g|'+pk.lod+'|'+name+'|'+gi+'|'+mk;
      if(GEO[key]) return GEO[key];
      var m=pk.assets[name], g=m.g[gi], b=m.b, nv=g[3], ni=g[5], v0=g[2], i0=g[4], k;
      var P=new Float32Array(nv*3), N=new Int8Array(nv*3), C=new Uint8Array(nv*3), U=new Float32Array(nv*2), I=new Uint16Array(ni);
      var ex=(b[3]-b[0])/65535, ey=(b[4]-b[1])/65535, ez=(b[5]-b[2])/65535, inv=1/(1024*matUV(mk));
      for(k=0;k<nv;k++){
        var s3=(v0+k)*3, s2=(v0+k)*2;
        P[k*3]=b[0]+pk.pos[s3]*ex; P[k*3+1]=b[1]+pk.pos[s3+1]*ey; P[k*3+2]=b[2]+pk.pos[s3+2]*ez;
        N[k*3]=pk.nrm[s3]; N[k*3+1]=pk.nrm[s3+1]; N[k*3+2]=pk.nrm[s3+2];
        C[k*3]=pk.col[s3]; C[k*3+1]=pk.col[s3+1]; C[k*3+2]=pk.col[s3+2];
        U[k*2]=pk.uv[s2]*inv; U[k*2+1]=pk.uv[s2+1]*inv;
      }
      for(k=0;k<ni;k++) I[k]=pk.idx[i0+k];
      var geo=new THREE.BufferGeometry();
      geo.setAttribute('position',new THREE.BufferAttribute(P,3));
      geo.setAttribute('normal',new THREE.BufferAttribute(N,3,true));
      geo.setAttribute('color',new THREE.BufferAttribute(C,3,true));
      geo.setAttribute('uv',new THREE.BufferAttribute(U,2));
      geo.setIndex(new THREE.BufferAttribute(I,1));
      geo.computeBoundingSphere();
      geo.userData={shared:true,asset:name};
      GEO[key]=geo;
      return geo;
    },
    clearCache:function(){ for(var k in GEO){ GEO[k].dispose(); } GEO={}; }
  };
})();
var ASSETS_BASE=(function(){
  /* 和本脚本同一个目录往上一层的 assets/（game3d/js/model/assets.js → game3d/assets/） */
  try{ var s=document.currentScript&&document.currentScript.src; if(s) return s.replace(/js\/model\/assets\.js(\?.*)?$/,'assets/'); }catch(e){}
  return 'game3d/assets/';
})();
/* 开局要的那一档：照 settings.js 读存档里的画质（没存过、是触屏就是流畅），解析到这里就同步插进页面 */
(function(){
  if(typeof document==='undefined'||!document.write) return;
  var q=1;
  try{
    var s=JSON.parse(localStorage.getItem('zw3d_set')||'null');
    if(s&&s.q!==undefined) q=s.q;
    else if(window.matchMedia&&!window.matchMedia('(pointer: fine)').matches&&(window.matchMedia('(pointer: coarse)').matches||'ontouchstart' in window||navigator.maxTouchPoints>0)) q=0;
  }catch(e){}
  var lod=Quality.get(Quality.normalize(q)).lod;
  ASSETS.loading[lod]=1;
  document.write('<script src="'+ASSETS_BASE+'models_l'+lod+'.js"><\/script>');
})();
