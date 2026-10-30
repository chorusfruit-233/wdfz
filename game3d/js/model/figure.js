/* 里世界 3D · 人形
   统一的人形：头（后脑、头发、下巴、鼻子、眉骨、耳朵）、颈和斜方肌、校服立领和外套下摆、胸腹两段躯干、臀、
   大臂小臂（肌肉鼓起、肘）、带四指和拇指的手、大腿小腿（膝盖、腿肚）、带鞋头鞋跟的鞋。每种姿势只生成一次几何体，所有人共用（一个人一次绘制）。
   正面朝 +z。比例沿用原来的轮廓：
     tall    —— 异象里的人影：约 2.5 米，手臂垂得很长
     roam    —— 车库里那个：再高一点，手垂过膝盖
     person  —— "假正常"里的路人：正常身高
     teacher —— 讲台边的老师：偏高、偏瘦
     sit     —— 坐着、两只手搭在课桌上的同学
     neck    —— 围墙外的行人：脖子长得不对 */
'use strict';

var FIG_GEO={};
var FIG_SPEC={
  /* leg: 胯高；torso: 胯→肩；arm: 大臂+小臂总长；head: 头高；w: 肩宽；neck: 颈长 */
  tall:   {leg:1.20, torso:0.95, arm:1.32, head:0.26, w:0.44, neck:0.14, thin:0.85},
  roam:   {leg:1.22, torso:0.96, arm:1.55, head:0.25, w:0.42, neck:0.16, thin:0.80},
  person: {leg:0.92, torso:0.62, arm:0.70, head:0.23, w:0.40, neck:0.08, thin:1.00},
  teacher:{leg:1.30, torso:0.82, arm:1.10, head:0.25, w:0.42, neck:0.12, thin:0.90},
  neck:   {leg:1.20, torso:0.95, arm:1.32, head:0.26, w:0.44, neck:0.55, thin:0.80},
  sit:    {leg:0.44, torso:0.58, arm:0.62, head:0.21, w:0.36, neck:0.07, thin:1.00}
};
/* 一段肢体：从 a 到 b，中间鼓一点（肌肉），两头 r0、r1 */
function figLimb(K,m,a,b,r0,r1,bulge,back,seg,c){
  var mx=(a[0]+b[0])/2, my=(a[1]+b[1])/2, mz=(a[2]+b[2])/2+(back||0), rm=Math.max(r0,r1)*(bulge||1);
  K.rod(m,a[0],a[1],a[2],mx,my,mz,r0,rm,seg,c);
  K.rod(m,mx,my,mz,b[0],b[1],b[2],rm,r1,seg,c);
}
/* 垂着的手：掌、并拢微弯的四指、拇指；p 是手腕，s 是左右 */
function figHand(K,m,p,s,k,c){
  var x=p[0], y=p[1], z=p[2], i;
  K.blob(m,x,y-0.045*k,z,0.018*k,0.048*k,0.040*k,c,1,7);                        /* 手掌 */
  for(i=0;i<4;i++){
    var fz=z+(0.027-i*0.018)*k, fl=(i===1||i===2?0.075:0.062)*k;
    K.rod(m,x,y-0.085*k,fz,x-s*0.004*k,y-0.085*k-fl*0.6,fz+0.006*k,0.0085*k,0.0075*k,5,c);
    K.rod(m,x-s*0.004*k,y-0.085*k-fl*0.6,fz+0.006*k,x-s*0.012*k,y-0.085*k-fl,fz+0.004*k,0.0075*k,0.0062*k,5,c);   /* 指尖往掌心弯 */
  }
  K.rod(m,x-s*0.010*k,y-0.030*k,z+0.032*k,x-s*0.016*k,y-0.075*k,z+0.050*k,0.011*k,0.008*k,5,c);              /* 拇指 */
}
/* 平放在桌面上的手：掌心朝下，四指往前 */
function figHandFlat(K,m,x,y,z,s,c){
  var i;
  K.bevel(m,x,y+0.015,z+0.03,0.08,0.03,0.10,c,1,0.012);                       /* 手掌：和原来的块一样大，免得碰到桌上的书 */
  for(i=0;i<4;i++){
    var fx=x+(i-1.5)*0.017*s, fl=(i===1||i===2)?0.05:0.04;
    K.rod(m,fx,y+0.016,z+0.075,fx,y+0.008,z+0.075+fl,0.0075,0.006,5,c);
  }
  K.rod(m,x+s*0.040,y+0.016,z+0.0,x+s*0.052,y+0.010,z+0.045,0.009,0.007,5,c);   /* 拇指 */
}
/* 鞋：鞋身、鞋头、鞋跟 */
function figShoe(K,m,x,z,c){
  K.bevel(m,x,0.040,z,0.098,0.075,0.20,c,1,0.03);
  K.blob(m,x,0.036,z+0.100,0.050,0.036,0.055,c,1,7);
  K.bevel(m,x,0.012,z-0.005,0.102,0.024,0.27,c,1,0.01);                       /* 鞋底比鞋面宽一圈 */
}
/* Blender 建的模型（tools/blender/assets/figures.py）：按这一档的模型包合成一个几何体，标上种类（换画质时按它换）。
   自己缓存，不随 Assets.clearCache 换掉：回到原来的画质还是同一个几何体 */
function figAssetGeo(name,flag,val){
  var a=Assets.get(name); if(!a) return null;
  var key='A|'+name+'|'+a.pk.lod;
  if(FIG_GEO[key]) return FIG_GEO[key];
  var K=new Kit(); K.asset(name,0,0,0,0,{uo:0,vo:0});
  var g=K.mergedGeometry(); g.userData={shared:true}; g.userData[flag]=val;
  FIG_GEO[key]=g;
  return g;
}
function figGeo(kind){
  var ag=figAssetGeo('fig_'+(FIG_SPEC[kind]?kind:'tall'),'figKind',kind); if(ag) return ag;
  var key=kind+'|'+Quality.get().segments;
  if(FIG_GEO[key]) return FIG_GEO[key];
  var sp=FIG_SPEC[kind]||FIG_SPEC.tall, K=new Kit(), m='dark', c=0xffffff, t=sp.thin;
  var sit=(kind==='sit');
  var hipY=sit?0.535:sp.leg, sh=hipY+sp.torso, hx=sp.w/2, s;
  var hk=sp.head/0.23;                                                       /* 手、脚跟着头的大小走 */
  /* 腿：大腿、膝盖、小腿（腿肚往后鼓）、脚踝、鞋 */
  for(s=-1;s<=1;s+=2){
    var lx=s*0.095*t;
    if(sit){
      figLimb(K,m,[lx,hipY,-0.02],[lx,hipY+0.02,0.40],0.075,0.058,1.06,0,8,c);       /* 大腿往前平伸 */
      K.blob(m,lx,hipY+0.015,0.405,0.058,0.058,0.06,c,1,7);                          /* 膝盖 */
      figLimb(K,m,[lx,hipY+0.02,0.40],[lx*1.05,0.09,0.44],0.056,0.040,1.12,-0.02,7,c); /* 小腿垂下 */
      figShoe(K,m,lx*1.05,0.50,c);
    }else{
      var kneeY=hipY*0.52;
      figLimb(K,m,[lx,hipY,0],[lx*1.05,kneeY,0.012],0.085*t,0.060*t,1.04,0.004,8,c);
      K.blob(m,lx*1.05,kneeY,0.018,0.058*t,0.062*t,0.058*t,c,1,7);                   /* 膝盖 */
      figLimb(K,m,[lx*1.05,kneeY,0.01],[lx*1.1,0.10,-0.01],0.058*t,0.040*t,1.14,-0.022,7,c);
      figShoe(K,m,lx*1.1,0.05,c);
    }
  }
  /* 胯、臀、腹、胸 */
  K.blob(m,0,hipY+0.04,0,0.17*t,0.10,0.11*t,c,1,10);
  K.blob(m,-0.075*t,hipY+0.01,-0.045*t,0.085*t,0.085,0.08*t,c,1,8);              /* 臀 */
  K.blob(m, 0.075*t,hipY+0.01,-0.045*t,0.085*t,0.085,0.08*t,c,1,8);
  var abdH=sp.torso*0.42, chH=sp.torso*0.58, lean=sit?0.06:0;
  if(sit){
    K.blob(m,0,hipY+abdH/2+0.08,-0.03,0.155*t,abdH*0.56,0.10*t,c,1,10);
    K.blob(m,0,hipY+abdH+chH/2+0.02,0.06,0.20*t,chH*0.55,0.11*t,c,1,10);  /* 往前趴 */
  }else{
    K.blob(m,0,hipY+abdH/2+0.06,0,0.155*t,abdH*0.58,0.10*t,c,1,10);
    K.blob(m,0,hipY+abdH+chH/2+0.03,0,0.21*t,chH*0.56,0.115*t,c,1,10);
  }
  K.blob(m,0,sh-chH*0.22,lean+0.01,hx*0.92,chH*0.26,0.105*t,c,1,10);               /* 上胸到肩膀那一段更宽、更平 */
  K.cyl(m,0,sh-0.035,lean*1.4,0.078,0.070,0.065,10,c,1,'top');                     /* 校服立领 */
  if(!sit) K.blob(m,0,hipY+0.03,0.004,0.182*t,0.12,0.122*t,c,1,12);                 /* 外套下摆罩住胯 */
  for(s=-1;s<=1;s+=2){
    K.rod(m,s*0.035,sh+0.02,lean*1.6,s*hx*0.78,sh-0.035,lean,0.045,0.05,6,c);       /* 斜方肌：脖子到肩头的斜线 */
    K.blob(m,s*hx*0.86,sh-0.035,lean,0.085,0.07,0.085,c,1,7);                       /* 肩头（三角肌） */
  }
  /* 颈、头：后脑勺、下颌、鼻子、耳朵、头发 */
  var nz=sit?0.10:0;
  K.rod(m,0,sh-0.04,nz*0.6,0,sh+sp.neck+0.02,nz+0.01,0.055,0.045,7,c);
  var hy=sh+sp.neck+sp.head*0.5, hz=nz+(sit?0.04:0.01), H=sp.head;
  K.blob(m,0,hy,hz,H*0.40,H*0.5,H*0.44,c,1,10);
  K.blob(m,0,hy+H*0.06,hz-H*0.06,H*0.43,H*0.46,H*0.42,c,1,9);                         /* 头发：顶上和后脑多出一层 */
  K.blob(m,0,hy-H*0.28,hz+0.035,H*0.24,H*0.15,H*0.23,c,1,8);                         /* 下巴 */
  K.blob(m,0,hy-H*0.04,hz+H*0.44,H*0.055,H*0.10,H*0.06,c,1,6);                        /* 鼻子 */
  K.blob(m,0,hy+H*0.08,hz+H*0.34,H*0.28,H*0.045,H*0.07,c,1,7);                        /* 眉骨 */
  for(s=-1;s<=1;s+=2) K.blob(m,s*H*0.40,hy-H*0.02,hz-H*0.02,H*0.05,H*0.12,H*0.08,c,1,6);   /* 耳朵 */
  /* 手臂：大臂（肱二头肌鼓一点）、肘、小臂、手 */
  for(s=-1;s<=1;s+=2){
    var ax=s*hx*0.95, up=sp.arm*0.47, fo=sp.arm*0.53;
    if(sit){
      /* 大臂往前下，小臂平搭在桌面上（桌面 0.74 高、在身前） */
      var ex=s*hx*1.02, ey=sh-up*0.75, ez=0.24;
      figLimb(K,m,[ax,sh-0.06,0.06],[ex,ey,ez],0.05,0.042,1.08,0,7,c);
      K.blob(m,ex,ey,ez,0.045,0.045,0.048,c,1,6);                                      /* 肘 */
      figLimb(K,m,[ex,ey,ez],[s*0.10,0.80,ez+0.22],0.043,0.032,1.1,0,7,c);
      figHandFlat(K,m,s*0.09,0.775,ez+0.27,-s,c);
    }else{
      var elx=ax+s*0.03, ely=sh-0.05-up;
      figLimb(K,m,[ax,sh-0.05,0],[elx,ely,0.02],0.05*t,0.040*t,1.1,0,7,c);
      K.blob(m,elx,ely,0.015,0.043*t,0.046*t,0.043*t,c,1,6);                           /* 肘 */
      figLimb(K,m,[elx,ely,0.02],[elx+s*0.01,ely-fo,0.03],0.042*t,0.028*t,1.12,0,7,c);
      figHand(K,m,[elx+s*0.01,ely-fo,0.03],s,hk*0.95,c);
    }
  }
  var g=K.mergedGeometry();
  g.userData={shared:true,figKind:kind};
  FIG_GEO[key]=g;
  return g;
}
/* 生成一个人：返回 Mesh（共享几何体），调用者负责位置 / 朝向 */
function figMesh(kind,mat,scale){
  var me=new THREE.Mesh(figGeo(kind),mat);
  if(scale&&scale!==1) me.scale.setScalar(scale);
  return me;
}

/* ---- 异象 / 死亡演出里的几种"东西"：带顶点色的共享几何体，配一个不吃光的材质 ---- */
var FX_GEO={}, FX_VC_MAT=null;
function fxVCMat(){ if(!FX_VC_MAT) FX_VC_MAT=new THREE.MeshBasicMaterial({vertexColors:true,fog:true,side:THREE.DoubleSide});   /* 镜头钻进去也看得见（钟罩下来的时候） */ return FX_VC_MAT; }
function fxGeo(name){
  var ag=figAssetGeo('fx_'+name,'fxKind',name); if(ag) return ag;
  var key=name+'|'+Quality.get().segments;
  if(FX_GEO[key]) return FX_GEO[key];
  var K=new Kit(), m='dark', i;
  if(name==='hand'){                        /* 从地下伸出来的手：掌心朝下、五指往前抓，后面拖着一截小臂 */
    var sk=0x6f6a63;
    K.bevel(m,0,0,0,0.22,0.06,0.24,sk,1,0.025);
    K.rod(m,0,0,-0.10,0,-0.02,-0.56,0.06,0.07,7,sk,0.95);
    for(i=0;i<4;i++){
      var fx=-0.075+i*0.05, fl=0.10+(i===1||i===2?0.02:0);
      K.rod(m,fx,0.0,0.11,fx,0.02,0.11+fl,0.016,0.015,5,sk,1);
      K.rod(m,fx,0.02,0.11+fl,fx,0.07,0.11+fl+0.05,0.015,0.013,5,sk,1);      /* 指节弯起来 */
      K.rod(m,fx,0.07,0.11+fl+0.05,fx,0.08,0.11+fl+0.09,0.013,0.010,5,sk,0.95);
    }
    K.rod(m,-0.11,0,0.02,-0.14,0.03,0.10,0.018,0.016,5,sk,1);                  /* 拇指 */
    K.rod(m,-0.14,0.03,0.10,-0.13,0.06,0.15,0.016,0.012,5,sk,1);
  }else if(name==='head'){                  /* 全体回头：后脑、苍白的脸、两个黑眼窝 */
    K.blob(m,0,0,0,0.12,0.14,0.13,0x2a2f33,1,8);
    K.blob(m,0,-0.01,0.05,0.10,0.12,0.09,0xb8b2a6,1,8);
    K.blob(m,-0.04,0.02,0.125,0.025,0.02,0.02,0x0a0d10,1,5);
    K.blob(m, 0.04,0.02,0.125,0.025,0.02,0.02,0x0a0d10,1,5);
    K.cyl(m,0,-0.24,0,0.05,0.05,0.12,6,0x2a2f33);
    K.bevel(m,0,-0.28,-0.02,0.34,0.10,0.18,0x2a2f33,1,0.04);
  }else if(name==='bigface'){               /* 突脸：一张比人大的脸，眼窝和嘴是两个黑洞 */
    K.blob(m,0,1.78,0,0.55,0.75,0.12,0xcac2b4,1,10);
    K.blob(m,-0.24,1.96,0.08,0.11,0.06,0.04,0x05080a,1,6);
    K.blob(m, 0.24,1.96,0.08,0.11,0.06,0.04,0x05080a,1,6);
    K.blob(m,0,1.48,0.08,0.24,0.07,0.04,0x05080a,1,8);
    K.blob(m,0,1.70,0.10,0.05,0.10,0.04,0xb8b0a2,1,6);                         /* 鼻梁 */
    K.blob(m,-0.24,2.06,0.07,0.16,0.03,0.04,0xa8a094,1,6);                      /* 眉骨 */
    K.blob(m, 0.24,2.06,0.07,0.16,0.03,0.04,0xa8a094,1,6);
  }else if(name==='smile'){                 /* 拍肩的另一种：一张很大的笑脸，眼睛弯成两道缝，嘴角咧到耳根 */
    var sk2=0xd6cfc2, ink=0x07090b, k2;
    K.blob(m,0,1.70,0,0.62,0.80,0.14,sk2,1,12);
    for(k2=-1;k2<=1;k2+=2){
      for(var e2=0;e2<7;e2++){                                                 /* 眯成缝的眼：向上拱的一道弧 */
        var ex=(e2/6-0.5)*0.28, ey=1.98+0.07*(1-Math.pow(ex/0.14,2));
        K.blob(m,k2*0.25+ex,ey,0.11,0.035,0.018,0.03,ink,1,5);
      }
    }
    for(k2=0;k2<15;k2++){                                                      /* 嘴：一道咧到两边的弧 */
      var mx=(k2/14-0.5)*0.96, my=1.42+0.42*Math.pow(mx/0.48,2);
      K.blob(m,mx,my,0.12,0.055,0.05+0.03*(1-Math.abs(mx)/0.48),0.03,ink,1,6);
      if(k2>1&&k2<13) K.blob(m,mx,my+0.035,0.135,0.026,0.02,0.02,0xeee8dc,1,5); /* 一排牙 */
    }
    K.blob(m,0,1.72,0.12,0.05,0.09,0.04,0xc4bcae,1,6);                        /* 鼻梁 */
  }else if(name==='neckhead'){              /* 长脖子那个人的头 */
    var fl2=0x7c302c;
    K.blob(m,0,0,0,0.22,0.24,0.22,fl2,1,9);
    K.blob(m,-0.09,0.04,0.19,0.05,0.045,0.03,0x0a0d10,1,6);
    K.blob(m, 0.09,0.04,0.19,0.05,0.045,0.03,0x0a0d10,1,6);
    K.blob(m,0,-0.10,0.19,0.08,0.025,0.02,0x0a0d10,1,6);
  }else if(name==='bell'){                  /* 死亡演出里压下来的钟 */
    K.bevel(m,0,2.72,0,1.5,0.12,0.5,0x2a2018,1,0.03);
    K.cyl(m,0,2.30,0,0.45,0.32,0.36,14,0x96703a,1.05);
    K.cyl(m,0,1.62,0,0.85,0.48,0.70,16,0x7a5a2a,1.0);
    K.cyl(m,0,1.48,0,0.92,0.85,0.16,16,0x5a4220,1.0,false);
    K.rod(m,0,1.65,0,0,1.35,0,0.03,0.03,5,0x3a2c1a);
    K.blob(m,0,1.30,0,0.09,0.09,0.09,0x3a2c1a,1,6);
  }else if(name==='lantern'){               /* 红灯笼 */
    K.rod(m,0,2.42,0,0,2.92,0,0.01,0.01,4,0xe8c05a);
    K.cyl(m,0,2.64,0,0.12,0.12,0.04,10,0xf2dca8);
    K.blob(m,0,2.42,0,0.22,0.22,0.22,0xc2352a,1,10);
    K.cyl(m,0,2.18,0,0.12,0.12,0.04,10,0xf2dca8);
    K.rod(m,0,2.18,0,0,1.92,0,0.03,0.015,5,0xe8c05a);
  }
  FX_GEO[key]=K.mergedGeometry();
  FX_GEO[key].userData={shared:true,fxKind:name};
  return FX_GEO[key];
}
function fxMesh(name){ return new THREE.Mesh(fxGeo(name),fxVCMat()); }
