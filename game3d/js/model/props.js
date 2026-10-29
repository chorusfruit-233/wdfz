/* 里世界 3D · 常见小物件
   房间、走廊、室外都会用到的、照着真东西做的小件：吊扇、吊装的灯、安全出口灯、应急灯、监控探头、烟感、
   开关面板、饮水机、分类垃圾桶、卫生角（拖把、扫把、水桶、簸箕）、盆栽、柜式空调、吊装投影机、
   窗帘、书立和竖着的书、水杯。

   约定：
     · K 是 Kit；坐标是房间（或室外）坐标，米；rot 是绕竖轴的转角，局部 +z 朝屋里（朝人）。
     · 贴墙的东西的「背面」在局部 z=0 处，往 +z 长出来。
     · 落地的东西由调用方登记碰撞（c.solid / addSolidM），这里只管模型。
     · 细节按档位取舍：流畅档（lodLow）省掉看不清的小零件。 */
'use strict';

/* ---- 吊扇：吸顶罩、吊杆、电机、三片扇叶。扇叶离地 2.70 米（巡察者 2.6 米高，不会扫到头） ---- */
function propCeilFan(K,x,z,ceilY,seed){
  var low=lodLow(), a0=hash2(seed||1,7)*6.283, k;
  K.lathe('plastic',x,ceilY-0.07,z,[[0.07,0],[0.075,0.035],[0.05,0.07]],12,0xe6e4de,1.0);          /* 吸顶罩 */
  K.rod('metal',x,ceilY-0.07,z,x,2.80,z,0.013,0.013,6,0xd8d6d0,1.05);                               /* 吊杆 */
  K.lathe('plastic',x,2.67,z,[[0.02,0],[0.10,0.015],[0.125,0.05],[0.11,0.10],[0.04,0.13],[0.02,0.135]],14,0xe8e6e0,1.02);   /* 电机罩 */
  for(k=0;k<3;k++){
    var F=K.sub(x,z,a0+k*2.094);
    K.box('metal',0,2.70,0.17,0.035,0.012,0.12,0xb8bcbe,1.1);                                      /* 叶架 */
    K.bevel('plastic',0,2.705,0.46,0.12,0.010,0.52,0xe2e0d8,1.0,0.004);                             /* 扇叶 */
    K.restore(F);
  }
  if(!low) K.lathe('plastic',x,2.655,z,[[0.0,0],[0.035,0.0],[0.03,0.015]],10,0xd0cec8,1.0);          /* 底盖 */
}

/* ---- 吊装的灯具：两根吊线、铝外壳、朝下的发光面（教室护眼灯 / 走廊灯）。
   长 len、宽 wid，灯面离地 lampY ---- */
/* state：'off' 熄掉的（灰白磨砂面）、'dying' 快坏的（一阵阵抽搐），其余是亮的 */
function propHangLamp(K,x,z,len,wid,ceilY,lampY,rot,state){
  var F=K.sub(x,z,rot||0);
  var hy=lampY+0.03, s;
  for(s=-1;s<=1;s+=2){
    K.rod('metal',s*len*0.38,hy+0.03,0,s*len*0.38,ceilY-0.01,0,0.0035,0.0035,4,0x9aa0a4,1.0);         /* 吊线 */
    K.cyl('metal',s*len*0.38,ceilY-0.025,0,0.025,0.025,0.02,8,0xc8ccce,1.05);                        /* 吊线座 */
  }
  K.bevel('metal',0,hy+0.015,0,len,0.05,wid,0xd8dcdc,1.05,0.012);                                    /* 外壳 */
  K.box('metal',-len/2-0.004,hy+0.01,0,0.01,0.05,wid*0.9,0xa8aeb0,1.0);                              /* 两头的端盖 */
  K.box('metal', len/2+0.004,hy+0.01,0,0.01,0.05,wid*0.9,0xa8aeb0,1.0);
  K.g(lampMat(state)).quadN([-len/2+0.02,lampY-0.012,-wid/2+0.015],[len/2-0.02,lampY-0.012,-wid/2+0.015],[len/2-0.02,lampY-0.012,wid/2-0.015],[-len/2+0.02,lampY-0.012,wid/2-0.015],0,-1,0,state==='off'?0x8a9094:0xe4f0f6);
  if(!lodLow()){                                                                                     /* 格栅：几道横向的反光条 */
    var n=Math.max(2,Math.round(len/0.3)), k;
    for(k=1;k<n;k++) K.box('metal',-len/2+len*k/n,lampY-0.006,0,0.012,0.012,wid-0.03,0xc8ccce,1.1);
  }
  K.restore(F);
}

function lampMat(state){ return state==='off'?'dead':(state==='dying'?'emitDying':'emit'); }
/* ---- 安全出口灯：绿色灯箱，白色的人往门跑 ---- */
function propExitSign(K,x,y,z,rot,arrow){
  var F=K.sub(x,z,rot||0);
  K.bevel('plastic',0,y,0.022,0.40,0.16,0.044,0xe8e8e2,1.0,0.008);
  K.box('emit',0,y,0.046,0.36,0.12,0.004,0x2fae6a,1.0);
  K.box('emit',-0.11,y,0.049,0.07,0.09,0.002,0xe8fff0,1.0);                                          /* 门框 */
  K.box('emit',-0.11,y,0.0505,0.045,0.07,0.002,0x2fae6a,1.0);
  K.blob('emit',-0.025,y+0.03,0.05,0.011,0.011,0.004,0xe8fff0,1.0,6);                                /* 人：头、身子、腿 */
  K.box('emit',-0.03,y,0.05,0.016,0.04,0.002,0xe8fff0,1.0);
  K.box('emit',0.0,y-0.03,0.05,0.04,0.012,0.002,0xe8fff0,1.0);
  if(arrow) K.box('emit',0.10,y,0.05,0.10,0.025,0.002,0xe8fff0,1.0);
  K.restore(F);
}
/* ---- 应急照明灯：白壳、两个圆灯头 ---- */
function propEmergencyLight(K,x,y,z,rot){
  var F=K.sub(x,z,rot||0);
  K.bevel('plastic',0,y,0.04,0.30,0.10,0.08,0xeeeeea,1.0,0.012);
  K.box('emit',0.09,y+0.015,0.081,0.03,0.008,0.002,0x6ad08a,0.8);                                    /* 充电指示 */
  var s; for(s=-1;s<=1;s+=2){
    K.cyl('plastic',s*0.11,y-0.05,0.06,0.035,0.04,0.05,10,0xe2e2de,1.0);
    K.cyl('emit',s*0.11,y-0.052,0.06,0.03,0.03,0.003,10,0xf4f2e8,0.85);
  }
  K.restore(F);
}
/* ---- 监控探头（半球） / 烟感 ---- */
function propCamDome(K,x,z,ceilY){
  K.lathe('plastic',x,ceilY-0.03,z,[[0.075,0],[0.08,0.03]],12,0xeeeeea,1.0);
  K.lathe('dark',x,ceilY-0.10,z,[[0.0,0],[0.04,0.012],[0.062,0.04],[0.068,0.07]],12,0x15191c,1.0);
}
function propSmoke(K,x,z,ceilY){
  K.lathe('plastic',x,ceilY-0.045,z,[[0.0,0],[0.045,0.0],[0.06,0.02],[0.06,0.045]],12,0xf0f0ec,1.0);
  K.box('emit',x+0.03,ceilY-0.046,z,0.008,0.002,0.008,0xd84a3a,1.0);
}
/* ---- 墙上的开关面板 / 插座 ---- */
function propSwitch(K,x,y,z,rot,n){
  var F=K.sub(x,z,rot||0);
  n=n||1;
  var w=0.086;
  K.bevel('plastic',0,y,0.005,w*n-0.006*(n-1),w,0.01,0xf2f2ee,1.0,0.003);
  var k; for(k=0;k<n;k++) K.box('plastic',(k-(n-1)/2)*(w-0.006),y,0.0115,0.03,0.05,0.004,0xe4e4de,1.0);
  K.restore(F);
}
function propSocket(K,x,y,z,rot){
  var F=K.sub(x,z,rot||0);
  K.bevel('plastic',0,y,0.005,0.086,0.086,0.01,0xf2f2ee,1.0,0.003);
  K.box('dark',-0.012,y+0.01,0.0105,0.004,0.012,0.002,0x2a2a2a,1);
  K.box('dark', 0.012,y+0.01,0.0105,0.004,0.012,0.002,0x2a2a2a,1);
  K.box('dark',0,y-0.018,0.0105,0.004,0.012,0.002,0x2a2a2a,1);
  K.restore(F);
}

/* ---- 饮水机 + 一桶水（占地 0.34 × 0.34） ---- */
function propWaterDispenser(K,x,z,rot){
  var F=K.sub(x,z,rot||0);
  K.bevel('plastic',0,0.48,0,0.32,0.96,0.32,0xeceae4,1.0,0.02);
  K.box('dark',0,0.80,0.161,0.22,0.14,0.004,0x2a3036,1.0);                                           /* 出水口凹槽 */
  K.box('plastic',-0.05,0.83,0.164,0.03,0.035,0.012,0xc83a32,1.1);                                   /* 热水 */
  K.box('plastic', 0.05,0.83,0.164,0.03,0.035,0.012,0x2a6ab0,1.1);                                   /* 冷水 */
  K.box('metal',0,0.735,0.17,0.20,0.015,0.05,0x8a9094,1.05);                                         /* 接水盘 */
  K.box('emit',0.12,0.92,0.162,0.012,0.012,0.002,0xd84a3a,1.0);
  K.box('emit',0.12,0.89,0.162,0.012,0.012,0.002,0x5ad08a,1.0);
  K.lathe('glass',0,0.96,0,[[0.03,0],[0.03,0.06],[0.12,0.10],[0.135,0.16],[0.135,0.40],[0.12,0.44],[0.0,0.46]],14,0x7ab4d8,1.3);   /* 水桶（倒扣） */
  K.restore(F);
}
/* ---- 分类垃圾桶：一组两个（可回收 / 其他），翻盖 ---- */
function propBinPair(K,x,z,rot){
  var F=K.sub(x,z,rot||0);
  var cols=[[0x2a6ab0,0xe8e8e2],[0x4a4e52,0xe8e8e2]], k;
  for(k=0;k<2;k++){
    var bx=(k?0.21:-0.21);
    K.bevel('plastic',bx,0.33,0,0.38,0.66,0.34,cols[k][0],1.0,0.03);
    K.bevel('plastic',bx,0.675,-0.01,0.40,0.04,0.36,shadeHex(cols[k][0],0.8),1.0,0.015);              /* 盖 */
    K.box('plastic',bx,0.58,0.171,0.22,0.004,0.006,0xffffff,1.0);
    K.box('paper',bx,0.46,0.171,0.16,0.12,0.004,cols[k][1],1.0);                                     /* 标签 */
  }
  K.restore(F);
}
/* ---- 卫生角：水桶、拖把、扫把、簸箕，靠墙放（墙在局部 z=0，往 +z 摆开，占地约 0.9 × 0.4） ---- */
function propCleaning(K,x,z,rot){
  var F=K.sub(x,z,rot||0);
  K.lathe('plastic',-0.28,0,0.20,[[0.12,0],[0.15,0.28],[0.155,0.29]],12,0x2a6ab0,1.0);               /* 水桶 */
  K.lathe('dark',-0.28,0.24,0.20,[[0.0,0],[0.14,0]],12,0x2a3a48,1.0);                                /* 桶里的水 */
  K.rod('metal',-0.42,0.29,0.20,-0.28,0.40,0.20,0.004,0.004,4,0x9aa0a4,1.0);                         /* 提手 */
  K.rod('metal',-0.28,0.40,0.20,-0.14,0.29,0.20,0.004,0.004,4,0x9aa0a4,1.0);
  K.rod('wood',0.02,0.10,0.10,0.10,1.30,0.03,0.012,0.012,6,0xb89a6a,1.0);                            /* 拖把杆斜靠在墙上 */
  K.blob('fabric',0.02,0.07,0.12,0.09,0.07,0.08,0xb8b4a8,1.0,7,0.3,3);                                /* 拖把头 */
  K.rod('plastic',0.26,0.18,0.12,0.32,1.20,0.03,0.011,0.011,6,0x3a8a4a,1.0);                         /* 扫把 */
  K.bevel('plastic',0.255,0.10,0.13,0.20,0.16,0.05,0x2a5a34,1.0,0.01);
  K.bevel('plastic',0.40,0.16,0.035,0.24,0.30,0.035,0x3a6aa0,1.0,0.008);                              /* 簸箕立着 */
  K.restore(F);
}
/* ---- 盆栽（绿萝 / 发财树）：花盆 + 几根茎 + 一团团叶子 ---- */
function propPlant(K,x,z,h,seed){
  h=h||1.0;
  K.lathe('plastic',x,0,z,[[0.13,0],[0.17,0.30*h],[0.18,0.32*h],[0.165,0.33*h]],14,0x8a5a3a,1.0);
  K.lathe('dark',x,0.30*h,z,[[0.0,0],[0.16,0]],12,0x2a2218,1.0);
  var k, n=lodLow()?3:5;
  for(k=0;k<n;k++){
    var a=hash2(seed||1,k)*6.283, r=0.05+hash2(k,seed||1)*0.12, top=0.55*h+hash2(k+3,seed||2)*0.45*h;
    var tx=x+Math.cos(a)*r, tz=z+Math.sin(a)*r;
    K.rod('leaf',x+Math.cos(a)*0.03,0.30*h,z+Math.sin(a)*0.03,tx,top,tz,0.008,0.006,4,0x4a6a3a,1.0);
    K.blob('leaf',tx,top+0.04,tz,0.12+hash2(k,7)*0.05,0.09,0.12,k%2?0x3f6e3a:0x4c7c44,1.0,7,0.4,(seed||1)*5+k);
  }
}
/* ---- 柜式空调（占地 0.50 × 0.30，背靠墙） ---- */
function propACCabinet(K,x,z,rot){
  var F=K.sub(x,z,rot||0);
  K.bevel('plastic',0,0.88,0.15,0.50,1.76,0.30,0xeeece6,1.0,0.03);
  K.box('dark',0,1.48,0.302,0.40,0.10,0.004,0x3a4046,1.0);                                           /* 出风口 */
  var k; for(k=0;k<4;k++) K.box('plastic',0,1.445+k*0.024,0.305,0.38,0.006,0.004,0xd8d6d0,1.0);
  K.box('dark',0,1.22,0.302,0.16,0.06,0.003,0x1a2024,1.0);                                           /* 显示屏 */
  K.box('emit',0.03,1.22,0.304,0.04,0.02,0.002,0x6ac0e8,0.8);
  K.box('dark',0,0.30,0.302,0.40,0.36,0.003,0xb8b6b0,1.0);                                           /* 进风格栅 */
  for(k=0;k<6;k++) K.box('plastic',0,0.15+k*0.06,0.305,0.40,0.012,0.004,0xe2e0da,1.0);
  K.restore(F);
}
/* ---- 吊装投影机 ---- */
function propProjector(K,x,z,ceilY,rot){
  var F=K.sub(x,z,rot||0);
  K.cyl('metal',0,ceilY-0.02,0,0.06,0.06,0.02,10,0x9aa0a4,1.0);
  K.rod('metal',0,ceilY-0.02,0,0,2.76,0,0.02,0.02,8,0xa8aeb0,1.05);                                 /* 机身底面离地 2.66 米，巡察者走过不碰头 */
  K.bevel('plastic',0,2.71,0,0.32,0.10,0.26,0xeceae4,1.0,0.025);
  K.rod('dark',0.08,2.71,-0.13,0.08,2.71,-0.15,0.035,0.035,12,0x1a1e22,1.0);                        /* 镜头朝黑板（-z） */
  K.restore(F);
}
/* ---- 窗帘：一道帘杆，两边各一幅收起来的布（竖褶） ----
   w：窗宽；y1：帘杆高；y0：帘子下沿；局部 z=0 是墙面，帘子挂在 z≈0.10 */
function propCurtains(K,x,z,rot,w,y0,y1,col,seed){
  var F=K.sub(x,z,rot||0);
  K.rod('metal',-w/2-0.25,y1,0.10,w/2+0.25,y1,0.10,0.012,0.012,6,0xa8a49c,1.0);
  var s, k, n=lodLow()?3:6, pw=0.26+hash2(seed||1,3)*0.12;
  for(s=-1;s<=1;s+=2){
    var cx=s*(w/2+0.02);
    for(k=0;k<n;k++){
      var u=cx+(k-(n-1)/2)*(pw/n), fz=0.10+((k%2)?0.025:-0.015);                            /* 一深一浅、一前一后：褶子 */
      K.box('fabric',u,(y0+y1)/2-0.02,fz,pw/n+0.012,y1-y0-0.04,0.018,shadeHex(col,(k%2)?1.0:0.86),1.0);
    }
  }
  K.restore(F);
}
/* ---- 课桌上的书立：两片金属挡板中间竖着一排书（沿局部 x 排开，书脊朝 -z） ----
   书挨着书：贴着隔壁那本、又不比它高的侧面看不见，不建；书底压在桌面上，也不建。流畅档书厚一倍、本数减半 */
function propBooksUpright(K,x,y,z,len,seed,rot){
  var F=K.sub(x,z,rot||0), low=lodLow();
  var u=-len/2+0.015, k=0, cols=[0x8a2a2a,0x2a4a7a,0xd8cfb8,0x3a5a3a,0x7a5a2a,0xc8c0a8,0x5a3a6a,0xe0dcd0,0x2a6a6a], B=[];
  if(low){                                                       /* 流畅档：两截不同颜色、不同高度的「一排书」 */
    var a1=-len/2+0.015, mid=(hash2(seed,1)-0.5)*len*0.4;
    K.g('paper').boxFaces((a1+mid)/2,y+0.11,0.005,mid-a1,0.21,0.15,cols[seed%cols.length],1.0,'nsuw');
    K.g('paper').boxFaces((mid+len/2-0.02)/2,y+0.12,0.005,len/2-0.02-mid,0.23,0.14,cols[(seed+4)%cols.length],0.95,'nsue');
    K.restore(F); return;
  }
  K.box('metal',-len/2,y+0.07,0,0.004,0.14,0.14,0x3a4046,1.0);
  K.box('metal',-len/2+0.035,y+0.002,0,0.07,0.004,0.14,0x3a4046,1.0);
  while(u<len/2-0.03){
    var t=(0.010+hash2(seed,k)*0.022)*(low?2:1), h=0.17+hash2(k,seed)*0.09, d=0.12+hash2(seed+k,3)*0.05;
    if(u+t>len/2-0.01) break;
    B.push({u:u+t/2,t:t,h:h,d:d,c:cols[(seed+k*3)%cols.length],s:0.9+hash2(k,seed+1)*0.2});
    u+=t+0.001; k++;
  }
  var P=K.g('paper');
  B.forEach(function(b,i){
    var f='nsu', L=B[i-1], R=B[i+1];
    if(!L||L.h<b.h||L.d<b.d) f+='w';
    if(!R||R.h<b.h||R.d<b.d) f+='e';
    P.boxFaces(b.u,y+b.h/2+0.004,0.005,b.t,b.h,b.d,b.c,b.s,f);
  });
  K.box('metal',u+0.004,y+0.07,0,0.004,0.14,0.14,0x3a4046,1.0);
  K.restore(F);
}
/* ---- 一摞横放的书（大小不一，错开一点） ---- */
function propBookPile(K,x,y,z,n,seed){
  var i, h=y, cols=[0x6a2a2a,0x2a4a6a,0xc8b890,0x3a5a3a,0x8a6a2a,0xe0dcd0];
  for(i=0;i<n;i++){
    var t=0.012+hash2(seed,i)*0.02, w=0.19+hash2(i,seed)*0.07, d=0.14+hash2(seed+3,i)*0.06;
    K.box('paper',x+(hash2(i,seed+5)-0.5)*0.03,h+t/2,z+(hash2(seed+7,i)-0.5)*0.02,w,t,d,cols[(seed+i)%cols.length],1.0);
    h+=t;
  }
  return h;
}
/* ---- 水杯：透明塑料杯身 + 盖 ---- */
function propBottle(K,x,y,z,col,h){
  h=h||0.22;
  if(lodLow()){ K.cyl('plastic',x,y,z,0.034,0.034,h,6,col||0x8ab8d8,1.1); return; }   /* 流畅档：一个六棱柱 */
  K.lathe('plastic',x,y,z,[[0.033,0.0],[0.035,0.02],[0.035,h*0.85],[0.03,h*0.9]],8,col||0x8ab8d8,1.1);
  K.lathe('plastic',x,y+h*0.9,z,[[0.028,0],[0.028,h*0.12],[0.0,h*0.13]],8,0x2a3036,1.0);
}
/* ---- 墙上挂的东西：画框里的一张纸（标语、名人名言、课程表），局部 z=0 是墙面 ---- */
function propFrame(K,x,y,z,rot,w,h,paper,frame,seed){
  var F=K.sub(x,z,rot||0), sd=seed||1;
  K.bevel('wood',0,y,0.012,w,h,0.024,frame||0x3a3028,1.0,0.006);
  K.box('paper',0,y,0.0245,w-0.05,h-0.05,0.002,shadeHex(paper||0xe8e4d8,0.80),1.0);
  K.box('paper',0,y+h/2-0.14,0.0255,w-0.05,0.16,0.001,[0xb8483a,0x3a6a9a,0x4a7a4a,0xc8902a][sd%4],0.85);   /* 彩色的抬头 */
  /* 印的东西：一条红色标题、一张小图、几行字 */
  var iw=w-0.12, top=y+h/2-0.06;
  K.box('paper',0,top-0.07,0.0265,iw*0.7,0.05,0.001,0xf0ead8,1.0);                     /* 抬头上的白字 */
  if(hash2(sd,5)>0.4) K.box('paper',-iw*0.25,y+0.04,0.0262,iw*0.42,h*0.30,0.001,[0x6a7a8a,0x8a7a5a,0x5a6a5a][(sd+1)%3],1.0);
  if(lodLow()){ K.restore(F); return; }                          /* 流畅档：只画底色和彩色抬头 */
  var k, n=Math.max(3,Math.round(h/0.09));
  for(k=0;k<n;k++){ var ly=top-0.09-k*(h-0.20)/n; if(ly<y-h/2+0.06) break;
    K.box('paper',(hash2(k,sd)>0.5?0.04:0)+((hash2(sd,5)>0.4&&ly>y-0.11&&ly<y+0.19)?iw*0.24:0),ly,0.0262,(hash2(sd,5)>0.4&&ly>y-0.11&&ly<y+0.19)?iw*0.42:iw*(0.6+hash2(k,sd+2)*0.3),0.012,0.001,0x4a4a46,1.0); }
  K.restore(F);
}

/* ---- 污渍贴花：kind 0 水渍、1 霉斑、2 手印、3 蹭痕（图集里的一格）。
   face：'u' 地上（朝上）、'd' 吊顶（朝下）、'n'/'s'/'e'/'w' 墙面（法线朝 -z/+z/+x/-x）。
   (x,y,z) 是中心，w×h 是大小，rot 在面内转（只对地上、吊顶有效） ---- */
var DECAL_UV=[[0,0.5],[0.5,0.5],[0,0],[0.5,0]];
function propDecal(K,kind,face,x,y,z,w,h,col,rot){
  var o=DECAL_UV[kind], u0=o[0]+0.01, v0=o[1]+0.01, u1=o[0]+0.49, v1=o[1]+0.49, UV=[[u0,v0],[u1,v0],[u1,v1],[u0,v1]];
  var c=Math.cos(rot||0), s=Math.sin(rot||0), hw=w/2, hh=h/2, P, n;
  function F(a,b){ return [a*c-b*s, a*s+b*c]; }
  if(face==='u'||face==='d'){
    var q=[F(-hw,hh),F(hw,hh),F(hw,-hh),F(-hw,-hh)];
    P=q.map(function(p){ return [x+p[0],y,z+p[1]]; });
    n=[0,1,0];
    if(face==='d'){ P=[P[1],P[0],P[3],P[2]]; UV=[UV[1],UV[0],UV[3],UV[2]]; n=[0,-1,0]; }
  }else if(face==='s'){ P=[[x-hw,y-hh,z],[x+hw,y-hh,z],[x+hw,y+hh,z],[x-hw,y+hh,z]]; n=[0,0,1]; }
  else if(face==='n'){ P=[[x+hw,y-hh,z],[x-hw,y-hh,z],[x-hw,y+hh,z],[x+hw,y+hh,z]]; n=[0,0,-1]; }
  else if(face==='e'){ P=[[x,y-hh,z+hw],[x,y-hh,z-hw],[x,y+hh,z-hw],[x,y+hh,z+hw]]; n=[1,0,0]; }
  else { P=[[x,y-hh,z-hw],[x,y-hh,z+hw],[x,y+hh,z+hw],[x,y+hh,z-hw]]; n=[-1,0,0]; }
  var b=K.g('grime'); b.face(P,n,b._rgb(col,1),false,null,UV);
}
/* ---- 地上一张纸（卷子、通知、作业本撕下来的一页），随便一个角度 ---- */
function propFloorPaper(K,x,z,rot,seed){
  var F=K.sub(x,z,rot);
  K.g('paper').boxFaces(0,0.0035,0,0.21,0.003,0.297,[0xe8e4d8,0xdcd6c4,0xd4dce0][seed%3],0.95,'u');
  if(seed%4===0) K.g('paper').boxFaces(0.03,0.0062,0.05,0.21,0.003,0.297,0xe2ddd0,0.9,'u');
  K.restore(F);
}
