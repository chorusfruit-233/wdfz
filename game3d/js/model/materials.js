/* 里世界 3D · 材质库
   以前所有东西共用一张"墙面"贴图（课桌、车、床上都是墙面的竖条纹）。
   现在按材质分开，每种一张现场画出来的贴图（不加载任何图片），
   贴图坐标按世界坐标投影：同一种材质在相邻物体之间是连续的。
   贴图都是灰度的，颜色仍然来自顶点色，所以外形和配色保持原样。 */
'use strict';

/* key: [贴图种类, 一张贴图覆盖多少米, 高光强度, 高光颜色] */
var MAT_DEF={
  plaster:  ['plaster', 2.4, 0,  0x000000],   /* 室内墙面、楼外白色线脚 */
  tile:     ['tile',    1.2, 6,  0x181818],   /* 室内地砖 */
  terrazzo: ['terrazzo',2.0, 8,  0x1c1c1c],   /* 走廊、楼梯的水磨石 */
  ceiling:  ['ceiling', 1.2, 0,  0x000000],   /* 矿棉吊顶 */
  wood:     ['wood',    1.0, 4,  0x161210],   /* 课桌面、门、讲台 */
  metal:    ['metal',   0.8, 40, 0x6a6e72],   /* 桌腿、柜子、车身、栏杆 */
  plastic:  ['plain',   1.0, 14, 0x2a2a2a],   /* 椅子、显示器、垃圾桶 */
  fabric:   ['fabric',  0.6, 0,  0x000000],   /* 被子、床垫、窗帘 */
  brick:    ['brick',   2.4, 0,  0x000000],   /* 外墙砖 */
  concrete: ['concrete',3.0, 0,  0x000000],   /* 车库、屋面、台阶、围墙基座 */
  stone:    ['stone',   2.0, 2,  0x101010],   /* 石材：雕塑、台阶边、门柱 */
  board:    ['board',   2.0, 0,  0x000000],   /* 黑板、白板 */
  grass:    ['grass',   3.0, 0,  0x000000],
  leaf:     ['leaf',    1.6, 0,  0x000000],
  bark:     ['bark',    0.8, 0,  0x000000],
  paper:    ['paper',   0.5, 0,  0x000000],
  dark:     [null,      1.0, 0,  0x000000],   /* 不要纹理的暗面：窗洞、阴影里 */
  glass:    [null,      1.0, 60, 0x8a9aa4],   /* 玻璃：半透明、高光 */
  /* 地面：多边形偏移往后推，家具脚下的阴影、标线才不会和地面打架 */
  ftile:    ['tile',    1.2, 6,  0x181818, 2],
  fterrazzo:['terrazzo',2.0, 8,  0x1c1c1c, 2],
  fconcrete:['concrete',3.0, 0,  0x000000, 2],
  fstone:   ['stone',   2.0, 2,  0x101010, 2],
  fwood:    ['wood',    1.2, 6,  0x161210, 2],
  fgrass:   ['grass',   3.0, 0,  0x000000, 4],
  fpave:    [null,      1.0, 0,  0x000000, 1],
  decal:    [null,      1.0, 0,  0x000000, -2], /* 贴在地上的阴影、标线、水渍 */
  fjoint:   [null,      1.0, 0,  0x000000, 2],  /* 室外铺地的砖缝 */
  paving:   ['concrete',1.6, 0,  0x000000],     /* 室外铺地的方砖 */
  court:    [null,      1.0, 2,  0x101010],     /* 球场、跑道的面层 */
  foliage:  ['foliage', 1.0, 0,  0x000000]      /* 树冠、灌木的叶片卡：一簇叶子的贴图，透明处镂空 */
};
var MATS={}, TEXS={};

function texSize(){ return QP().texSize; }
function makeMatTex(kind){
  var SZ=texSize(), cv=document.createElement('canvas'); cv.width=SZ; cv.height=SZ;
  var c=cv.getContext('2d'); if(!c) return null;
  var i, j, k=SZ/512;
  function R(){ return Math.random(); }
  function grain(center,amp,alpha,count,size){
    c.globalAlpha=alpha;
    for(i=0;i<count;i++){
      var v=Math.round(center+(R()-0.5)*amp); v=v<0?0:(v>255?255:v);
      c.fillStyle='rgb('+v+','+v+','+v+')';
      var s=(size||3)*k*(0.6+R()*1.2);
      c.fillRect(R()*SZ,R()*SZ,s,s);
    }
    c.globalAlpha=1;
  }
  function fill(v){ c.fillStyle='rgb('+v+','+v+','+v+')'; c.fillRect(0,0,SZ,SZ); }
  function line(x0,y0,x1,y1,v,w,a){ c.globalAlpha=a===undefined?1:a; c.strokeStyle='rgb('+v+','+v+','+v+')'; c.lineWidth=w*k; c.beginPath(); c.moveTo(x0,y0); c.lineTo(x1,y1); c.stroke(); c.globalAlpha=1; }
  if(kind==='plaster'){
    fill(232);
    for(i=0;i<7;i++){                                  /* 雨水 / 潮气留下的竖向水渍 */
      var sx=R()*SZ, sw=(5+R()*20)*k, sh=(80+R()*260)*k;
      var gr=c.createLinearGradient(0,0,0,sh);
      gr.addColorStop(0,'rgba(110,106,100,0.09)'); gr.addColorStop(1,'rgba(110,106,100,0)');
      c.fillStyle=gr; c.fillRect(sx,0,sw,sh);
    }
    grain(228,18,0.10,5200);
    grain(200,30,0.05,400,6);
  }else if(kind==='tile'){
    fill(220);
    for(i=0;i<2;i++) for(j=0;j<2;j++){                 /* 2×2 块 60 公分地砖，每块深浅略不同 */
      var v=212+Math.floor(R()*18);
      c.fillStyle='rgb('+v+','+v+','+v+')'; c.fillRect(i*SZ/2+2*k,j*SZ/2+2*k,SZ/2-4*k,SZ/2-4*k);
    }
    grain(222,16,0.08,3000);
    for(i=0;i<=2;i++){ line(i*SZ/2,0,i*SZ/2,SZ,150,3); line(0,i*SZ/2,SZ,i*SZ/2,150,3); }
  }else if(kind==='terrazzo'){
    fill(214);
    for(i=0;i<1600;i++){                               /* 水磨石的碎石子 */
      var tv=R()<0.5?160+R()*40:235+R()*20;
      c.fillStyle='rgb('+(tv|0)+','+(tv|0)+','+((tv-6)|0)+')';
      var r0=(1+R()*3)*k; c.beginPath(); c.arc(R()*SZ,R()*SZ,r0,0,6.283); c.fill();
    }
    line(0,1,SZ,1,170,2); line(1,0,1,SZ,170,2);         /* 铜分隔条 */
  }else if(kind==='ceiling'){
    fill(226);
    for(i=0;i<2600;i++){ c.fillStyle='rgba(120,120,120,'+(0.25+R()*0.4).toFixed(2)+')'; c.fillRect(R()*SZ,R()*SZ,1.6*k,1.6*k); }   /* 矿棉板的针孔 */
    for(i=0;i<=2;i++){ line(i*SZ/2,0,i*SZ/2,SZ,175,4); line(0,i*SZ/2,SZ,i*SZ/2,175,4); }
  }else if(kind==='wood'){
    fill(214);
    for(i=0;i<140;i++){
      c.globalAlpha=0.05+R()*0.09;
      c.fillStyle=R()>0.5?'#ffffff':'#9a9a9a';
      var wy=R()*SZ; c.fillRect(0,wy,SZ,(1+R()*3)*k);  /* 顺着 u 方向的木纹 */
    }
    for(i=0;i<5;i++){                                  /* 几个木节 */
      c.globalAlpha=0.18; c.strokeStyle='#7a7a7a'; c.lineWidth=1.2*k;
      var kx=R()*SZ, ky=R()*SZ;
      for(j=1;j<4;j++){ c.beginPath(); c.ellipse(kx,ky,j*7*k,j*2.4*k,0,0,6.283); c.stroke(); }
    }
    c.globalAlpha=1; grain(214,10,0.06,2200);
  }else if(kind==='metal'){
    fill(206);
    for(i=0;i<300;i++){ c.globalAlpha=0.05+R()*0.06; c.fillStyle=R()>0.5?'#ffffff':'#8a8a8a'; c.fillRect(0,R()*SZ,SZ,1*k); }   /* 拉丝 */
    c.globalAlpha=1;
    for(i=0;i<6;i++){ c.globalAlpha=0.10; c.fillStyle='#6a5a4a'; c.beginPath(); c.arc(R()*SZ,R()*SZ,(6+R()*18)*k,0,6.283); c.fill(); }   /* 锈斑 */
    c.globalAlpha=1;
  }else if(kind==='fabric'){
    fill(208);
    for(i=0;i<SZ;i+=3*k){ line(i,0,i,SZ,190,1,0.35); line(0,i,SZ,i,226,1,0.35); }
    grain(208,20,0.06,1800);
  }else if(kind==='brick'){
    /* 一顺一丁的红砖：砖本身深浅不一，灰缝是浅色 */
    fill(196);
    var rows=32, bh=SZ/rows, bw=SZ/8;
    for(j=0;j<rows;j++){
      var off=(j%2)?bw/2:0;
      for(i=-1;i<9;i++){
        var bv=150+Math.floor(R()*55);
        c.fillStyle='rgb('+bv+','+bv+','+bv+')';
        c.fillRect(i*bw+off+1.5*k,j*bh+1.5*k,bw-3*k,bh-3*k);
      }
    }
    grain(170,40,0.08,3000);
  }else if(kind==='concrete'){
    fill(200);
    grain(196,40,0.12,6000,4);
    for(i=0;i<5;i++){                                  /* 几道细裂缝 */
      var cx=R()*SZ, cy=R()*SZ; c.strokeStyle='rgba(90,90,90,0.35)'; c.lineWidth=1*k; c.beginPath(); c.moveTo(cx,cy);
      for(j=0;j<6;j++){ cx+=(R()-0.5)*60*k; cy+=(R()-0.3)*40*k; c.lineTo(cx,cy); } c.stroke();
    }
    for(i=0;i<4;i++){ c.fillStyle='rgba(120,120,120,0.10)'; c.beginPath(); c.arc(R()*SZ,R()*SZ,(20+R()*50)*k,0,6.283); c.fill(); }
  }else if(kind==='stone'){
    fill(206);
    grain(204,46,0.12,5000,3);
    for(i=0;i<40;i++){ c.strokeStyle='rgba(150,150,150,0.25)'; c.lineWidth=(0.8+R())*k; c.beginPath(); var sx2=R()*SZ, sy2=R()*SZ; c.moveTo(sx2,sy2); c.bezierCurveTo(sx2+30*k,sy2+10*k,sx2+60*k,sy2-20*k,sx2+(80+R()*60)*k,sy2+5*k); c.stroke(); }
  }else if(kind==='board'){
    fill(70);
    for(i=0;i<18;i++){ c.fillStyle='rgba(255,255,255,'+(0.03+R()*0.05).toFixed(3)+')'; c.beginPath(); c.ellipse(R()*SZ,R()*SZ,(30+R()*90)*k,(10+R()*30)*k,R()*3,0,6.283); c.fill(); }   /* 擦不干净的粉笔印 */
    grain(70,20,0.08,1500);
  }else if(kind==='grass'){
    fill(196);
    for(i=0;i<9000;i++){ var gv=150+R()*100; c.strokeStyle='rgba('+(gv|0)+','+(gv|0)+','+(gv|0)+',0.5)'; c.lineWidth=1*k; var gx=R()*SZ, gy=R()*SZ; c.beginPath(); c.moveTo(gx,gy); c.lineTo(gx+(R()-0.5)*3*k,gy-(3+R()*5)*k); c.stroke(); }
    for(i=0;i<10;i++){ c.fillStyle='rgba(120,120,120,0.12)'; c.beginPath(); c.arc(R()*SZ,R()*SZ,(20+R()*60)*k,0,6.283); c.fill(); }
  }else if(kind==='leaf'){
    fill(170);
    for(i=0;i<2600;i++){ var lv=110+R()*140; c.fillStyle='rgba('+(lv|0)+','+(lv|0)+','+(lv|0)+',0.75)'; c.beginPath(); c.ellipse(R()*SZ,R()*SZ,(3+R()*5)*k,(1.5+R()*2.5)*k,R()*3.14,0,6.283); c.fill(); }
  }else if(kind==='bark'){
    fill(170);
    for(i=0;i<70;i++){ c.globalAlpha=0.25+R()*0.2; c.fillStyle=R()>0.5?'#5a5a5a':'#d0d0d0'; c.fillRect(R()*SZ,0,(2+R()*6)*k,SZ); }   /* 竖向树皮裂纹 */
    c.globalAlpha=1; grain(170,40,0.10,2000);
  }else if(kind==='paper'){
    fill(238);
    for(i=0;i<16;i++) line(30*k,(40+i*26)*k,(SZ-30*k)*(0.5+R()*0.5),(40+i*26)*k,150,2,0.5);   /* 一行行字 */
  }else{
    fill(220); grain(220,12,0.06,1500);
  }
  var t=new THREE.CanvasTexture(cv);
  t.wrapS=THREE.RepeatWrapping; t.wrapT=THREE.RepeatWrapping;
  try{ t.anisotropy=Math.min(8,GLR.renderer.capabilities.getMaxAnisotropy()); }catch(e){ t.anisotropy=4; }
  t.generateMipmaps=true; t.minFilter=THREE.LinearMipmapLinearFilter; t.magFilter=THREE.LinearFilter;
  t.colorSpace=THREE.SRGBColorSpace;
  return t;
}
/* 一簇叶子（带透明通道）：中间密、边上稀，叶子一片片有深有浅，几根细枝 */
function makeFoliageTex(){
  var SZ=Math.max(128,Math.min(512,texSize())), cv=document.createElement('canvas'); cv.width=SZ; cv.height=SZ;
  var c=cv.getContext('2d'), i, k=SZ/256;
  function R(){ return Math.random(); }
  c.clearRect(0,0,SZ,SZ);
  c.strokeStyle='rgba(70,60,50,1)'; c.lineWidth=1.2*k;
  for(i=0;i<7;i++){ var a=R()*6.283; c.beginPath(); c.moveTo(SZ/2,SZ/2); c.lineTo(SZ/2+Math.cos(a)*SZ*0.4,SZ/2+Math.sin(a)*SZ*0.4); c.stroke(); }
  for(i=0;i<520;i++){
    var t=i/520, ang=R()*6.283, rad=Math.sqrt(R())*SZ*0.45*(0.75+0.25*Math.sin(ang*3+1.3));
    var x=SZ/2+Math.cos(ang)*rad, y=SZ/2+Math.sin(ang)*rad*0.92;
    var v=Math.round(120+t*100+R()*35); v=v>255?255:v;                  /* 先画深的（里层），后画浅的（外层） */
    c.fillStyle='rgb('+v+','+v+','+v+')';
    c.beginPath(); c.ellipse(x,y,(5+R()*5)*k,(2.2+R()*2.2)*k,R()*3.14,0,6.283); c.fill();
  }
  var t=new THREE.CanvasTexture(cv);
  t.wrapS=THREE.ClampToEdgeWrapping; t.wrapT=THREE.ClampToEdgeWrapping;
  t.generateMipmaps=true; t.minFilter=THREE.LinearMipmapLinearFilter; t.magFilter=THREE.LinearFilter;
  t.colorSpace=THREE.SRGBColorSpace;
  return t;
}
function matTex(kind){
  if(kind==='foliage'){ if(!TEXS[kind]) TEXS[kind]=makeFoliageTex(); return TEXS[kind]; }    /* 叶片卡离不开贴图（关贴图也要） */
  if(!kind||NOTEX) return null;
  if(!TEXS[kind]) TEXS[kind]=makeMatTex(kind);
  return TEXS[kind];
}

/* ---- 浮雕：每种贴图配一张高度图，算成法线贴图 ----
   砖缝、地砖缝、吊顶的分格和针孔、混凝土的裂缝和气孔、木纹、树皮……光从侧面照过来时有起伏，
   不再像印在平面上的花纹。灰缝、砖的位置和颜色贴图是同一套格子，对得上。
   分辨率是颜色贴图的一半（法线变化平缓，看不出来），「流畅」档不用。 */
var RELIEF={   /* 种类: 强度（normalScale） */
  plaster:0.35, tile:0.9, terrazzo:0.5, ceiling:0.8, wood:0.45, metal:0.18, fabric:0.6,
  brick:1.1, concrete:0.8, stone:0.7, grass:0.7, leaf:0.9, bark:1.2
};
function makeMatHeight(kind){
  var SZ=Math.max(128,texSize()>>1), cv=document.createElement('canvas'); cv.width=SZ; cv.height=SZ;
  var c=cv.getContext('2d'); if(!c) return null;
  var i, j, k=SZ/512;
  function R(){ return Math.random(); }
  function fill(v){ c.fillStyle='rgb('+v+','+v+','+v+')'; c.fillRect(0,0,SZ,SZ); }
  function dots(center,amp,alpha,count,size){
    c.globalAlpha=alpha;
    for(i=0;i<count;i++){ var v=Math.round(center+(R()-0.5)*amp); v=v<0?0:(v>255?255:v); c.fillStyle='rgb('+v+','+v+','+v+')';
      var s=(size||3)*k*(0.6+R()*1.2); c.fillRect(R()*SZ,R()*SZ,s,s); }
    c.globalAlpha=1;
  }
  function line(x0,y0,x1,y1,v,w,a){ c.globalAlpha=a===undefined?1:a; c.strokeStyle='rgb('+v+','+v+','+v+')'; c.lineWidth=Math.max(1,w*k); c.beginPath(); c.moveTo(x0,y0); c.lineTo(x1,y1); c.stroke(); c.globalAlpha=1; }
  if(kind==='brick'){
    fill(70);                                               /* 灰缝凹进去 */
    var rows=32, bh=SZ/rows, bw=SZ/8;
    for(j=0;j<rows;j++){
      var off=(j%2)?bw/2:0;
      for(i=-1;i<9;i++){
        var v=200+Math.floor(R()*30);
        c.fillStyle='rgb('+v+','+v+','+v+')'; c.fillRect(i*bw+off+1.5*k,j*bh+1.5*k,bw-3*k,bh-3*k);
        c.fillStyle='rgba(255,255,255,0.25)'; c.fillRect(i*bw+off+3*k,j*bh+3*k,bw-6*k,bh-6*k);   /* 砖面中间略鼓 */
      }
    }
    dots(200,60,0.15,2200,2);
  }else if(kind==='tile'){
    fill(200);
    for(i=0;i<=2;i++){ line(i*SZ/2,0,i*SZ/2,SZ,60,4); line(0,i*SZ/2,SZ,i*SZ/2,60,4); }
    dots(200,14,0.08,1200,2);
  }else if(kind==='terrazzo'){
    fill(180); dots(180,30,0.10,1500,2);
    line(0,1,SZ,1,240,2); line(1,0,1,SZ,240,2);             /* 铜分隔条略高出一点 */
  }else if(kind==='ceiling'){
    fill(200);
    for(i=0;i<2600;i++){ c.fillStyle='rgba(40,40,40,'+(0.4+R()*0.4).toFixed(2)+')'; c.fillRect(R()*SZ,R()*SZ,1.6*k,1.6*k); }
    for(i=0;i<=2;i++){ line(i*SZ/2,0,i*SZ/2,SZ,50,6); line(0,i*SZ/2,SZ,i*SZ/2,50,6); }   /* 龙骨缝 */
  }else if(kind==='wood'){
    fill(160);
    for(i=0;i<160;i++){ c.globalAlpha=0.10+R()*0.2; c.fillStyle=R()>0.5?'#ffffff':'#404040'; c.fillRect(0,R()*SZ,SZ,(1+R()*3)*k); }
    c.globalAlpha=1;
  }else if(kind==='metal'){
    fill(160);
    for(i=0;i<300;i++){ c.globalAlpha=0.08+R()*0.08; c.fillStyle=R()>0.5?'#ffffff':'#505050'; c.fillRect(0,R()*SZ,SZ,1*k); }
    c.globalAlpha=1;
  }else if(kind==='fabric'){
    fill(150);
    for(i=0;i<SZ;i+=3*k){ line(i,0,i,SZ,220,1.2,0.6); line(0,i+1.5*k,SZ,i+1.5*k,90,1.2,0.6); }
  }else if(kind==='concrete'){
    fill(170); dots(170,90,0.22,5000,4);
    for(i=0;i<300;i++){ c.fillStyle='rgba(30,30,30,0.6)'; c.beginPath(); c.arc(R()*SZ,R()*SZ,(0.8+R()*1.6)*k,0,6.283); c.fill(); }   /* 气孔 */
    for(i=0;i<5;i++){ var cx=R()*SZ, cy=R()*SZ; c.strokeStyle='rgba(20,20,20,0.8)'; c.lineWidth=1.4*k; c.beginPath(); c.moveTo(cx,cy);
      for(j=0;j<6;j++){ cx+=(R()-0.5)*60*k; cy+=(R()-0.3)*40*k; c.lineTo(cx,cy); } c.stroke(); }
  }else if(kind==='stone'){
    fill(170); dots(170,110,0.18,5000,3);
  }else if(kind==='plaster'){
    fill(170); dots(170,70,0.14,7000,3); dots(170,90,0.08,500,8);
  }else if(kind==='grass'){
    fill(120);
    for(i=0;i<6000;i++){ var gv=120+R()*130; c.strokeStyle='rgba('+(gv|0)+','+(gv|0)+','+(gv|0)+',0.6)'; c.lineWidth=1.2*k; var gx=R()*SZ, gy=R()*SZ; c.beginPath(); c.moveTo(gx,gy); c.lineTo(gx+(R()-0.5)*3*k,gy-(3+R()*5)*k); c.stroke(); }
  }else if(kind==='leaf'){
    fill(90);
    for(i=0;i<1800;i++){ var lv=150+R()*100; c.fillStyle='rgba('+(lv|0)+','+(lv|0)+','+(lv|0)+',0.85)'; c.beginPath(); c.ellipse(R()*SZ,R()*SZ,(3+R()*5)*k,(1.5+R()*2.5)*k,R()*3.14,0,6.283); c.fill(); }
  }else if(kind==='bark'){
    fill(140);
    for(i=0;i<90;i++){ c.globalAlpha=0.35+R()*0.3; c.fillStyle=R()>0.45?'#202020':'#e0e0e0'; c.fillRect(R()*SZ,0,(2+R()*6)*k,SZ); }
    c.globalAlpha=1; dots(140,60,0.12,1500,2);
  }else return null;
  return cv;
}
/* 高度图 → 法线贴图（OpenGL 约定：绿色朝 +V；画布的 y 向下，V 向上） */
function heightToNormal(cv){
  var SZ=cv.width, c=cv.getContext('2d'), src=c.getImageData(0,0,SZ,SZ).data, out=c.createImageData(SZ,SZ), d=out.data, x, y;
  var H=new Float32Array(SZ*SZ), i;
  for(i=0;i<SZ*SZ;i++) H[i]=src[i*4]/255;
  var s=SZ/128;                                            /* 不同分辨率下坡度一致 */
  for(y=0;y<SZ;y++) for(x=0;x<SZ;x++){
    var xl=(x+SZ-1)%SZ, xr=(x+1)%SZ, yu=(y+SZ-1)%SZ, yd=(y+1)%SZ;
    var dx=(H[y*SZ+xr]-H[y*SZ+xl])*s, dy=(H[yd*SZ+x]-H[yu*SZ+x])*s;
    var nx=-dx, ny=dy, nz=1, l=Math.sqrt(nx*nx+ny*ny+nz*nz), o=(y*SZ+x)*4;
    d[o]=(nx/l*0.5+0.5)*255; d[o+1]=(ny/l*0.5+0.5)*255; d[o+2]=(nz/l*0.5+0.5)*255; d[o+3]=255;
  }
  var nc=document.createElement('canvas'); nc.width=SZ; nc.height=SZ; nc.getContext('2d').putImageData(out,0,0);
  return nc;
}
function matNormal(kind){
  if(!kind||NOTEX||!QP().relief||!RELIEF[kind]) return null;
  var key='n:'+kind;
  if(TEXS[key]===undefined){
    var h=null; try{ h=makeMatHeight(kind); }catch(e){ h=null; }
    if(!h){ TEXS[key]=null; return null; }
    var t=new THREE.CanvasTexture(heightToNormal(h));
    t.wrapS=THREE.RepeatWrapping; t.wrapT=THREE.RepeatWrapping;
    try{ t.anisotropy=Math.min(4,GLR.renderer.capabilities.getMaxAnisotropy()); }catch(e){ t.anisotropy=2; }
    t.generateMipmaps=true; t.minFilter=THREE.LinearMipmapLinearFilter; t.magFilter=THREE.LinearFilter;
    t.colorSpace=THREE.NoColorSpace;
    TEXS[key]=t;
  }
  return TEXS[key];
}
/* 共享材质：所有房间、室外都用同一批，切场景时不销毁（userData.shared） */
function matOf(key){
  if(MATS[key]) return MATS[key];
  var d=MAT_DEF[key]||MAT_DEF.plaster, m;
  if(key==='glass'){
    m=new THREE.MeshPhongMaterial({vertexColors:true,transparent:true,opacity:0.42,shininess:d[2],specular:d[3],depthWrite:false});
  }else if(key==='emit'){
    m=new THREE.MeshBasicMaterial({vertexColors:true,fog:true});
  }else if(key==='lamp'){
    m=new THREE.MeshBasicMaterial({vertexColors:true,fog:true}); GLR.lampHeadMat=m;      /* 路灯灯头：颜色由 lampTick() 调 */
  }else if(key==='litwin'){
    m=new THREE.MeshBasicMaterial({vertexColors:true,fog:true}); GLR.winLitMat=m;        /* 夜里亮着的窗 */
  }else if(key==='foliage'){
    m=new THREE.MeshPhongMaterial({vertexColors:true,map:matTex('foliage'),alphaTest:0.42,shininess:0,specular:0x000000});
  }else if(key==='sky'){
    /* 窗外的天光：白天亮、夜里暗，颜色由 lampTick() 每帧调 */
    m=new THREE.MeshBasicMaterial({vertexColors:true,fog:true});
    GLR.winSkyMat=m;
  }else{
    var o={vertexColors:true,shininess:d[2],specular:d[3]};
    var t=matTex(d[0]); if(t) o.map=t;
    var nt=matNormal(d[0]); if(nt){ o.normalMap=nt; var ns=RELIEF[d[0]]; o.normalScale=new THREE.Vector2(ns,ns); }
    if(d[4]){ o.polygonOffset=true; o.polygonOffsetFactor=d[4]; o.polygonOffsetUnits=d[4]*2; }
    m=new THREE.MeshPhongMaterial(o);
  }
  m.userData.shared=true;
  MATS[key]=m;
  return m;
}
/* 画质换了贴图分辨率：丢掉缓存的贴图和材质，下次建模时重新生成 */
var MAT_RESET_PENDING=false;
function matReset(){
  var k;
  for(k in TEXS) if(TEXS[k]&&TEXS[k].dispose) TEXS[k].dispose();   /* 含浮雕法线贴图（'n:种类'） */
  for(k in MATS) if(MATS[k]&&MATS[k].dispose) MATS[k].dispose();
  TEXS={}; MATS={};
}
function matUV(key){ var d=MAT_DEF[key]; return d?d[1]:2.4; }
