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
  court:    [null,      1.0, 2,  0x101010]      /* 球场、跑道的面层 */
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
function matTex(kind){
  if(!kind||NOTEX) return null;
  if(!TEXS[kind]) TEXS[kind]=makeMatTex(kind);
  return TEXS[kind];
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
  }else if(key==='sky'){
    /* 窗外的天光：白天亮、夜里暗，颜色由 lampTick() 每帧调 */
    m=new THREE.MeshBasicMaterial({vertexColors:true,fog:true});
    GLR.winSkyMat=m;
  }else{
    var o={vertexColors:true,shininess:d[2],specular:d[3]};
    var t=matTex(d[0]); if(t) o.map=t;
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
  for(k in TEXS) if(TEXS[k]&&TEXS[k].dispose) TEXS[k].dispose();
  for(k in MATS) if(MATS[k]&&MATS[k].dispose) MATS[k].dispose();
  TEXS={}; MATS={};
}
function matUV(key){ var d=MAT_DEF[key]; return d?d[1]:2.4; }
