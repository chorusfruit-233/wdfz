/* @module-capsule */
(function($imports){
/* 里世界 3D · 建筑外观
   buildOutdoorGeometry() —— 整个校园：地面与道具（outdoor.js）+ 每栋楼 + 球场 + 围墙与校门。
   楼的轮廓、高度、颜色都沿用原来的；以前每层是一整条黑色"窗带"，现在是一扇扇的窗
   （窗框、窗台、竖梃），外墙用砖纹理，楼顶有女儿墙、楼梯间、水箱，门口的牌子上写着楼名。 */
'use strict';

var OBLD_H={ guard:3.6, shed:3.4, gear:4.4, trash:3.8, canteen:8.6,
  dormN:18.0, dormS:18.0, bell:19.0, garage:0, garw:0 };
var BLD_NAME={teach:'教 学 楼',admin:'行 政 楼',lab:'实 验 楼',canteen:'食 堂',dormN:'学生宿舍 · 一栋',dormS:'学生宿舍 · 二栋',
  guard:'门 卫',gear:'体育器材室',trash:'垃圾站',bell:'钟 楼'};

/* 一块写着字的牌子（贴图），背面朝里 */
var SIGN_TEX={};
function signMesh(text,w,h,bg,fg,font){
  var key=text+'|'+bg+'|'+fg;
  var t=SIGN_TEX[key];
  if(!t){
    var cv=document.createElement('canvas'); cv.width=512; cv.height=Math.max(32,Math.round(512*h/w));
    var c=cv.getContext('2d');
    c.fillStyle=bg; c.fillRect(0,0,cv.width,cv.height);
    var i; for(i=0;i<300;i++){ c.globalAlpha=0.05; c.fillStyle=$imports.PresentationRandom.next()>0.5?'#fff':'#000'; c.fillRect($imports.PresentationRandom.next()*cv.width,$imports.PresentationRandom.next()*cv.height,3,3); }
    c.globalAlpha=1;
    c.fillStyle=fg; c.textAlign='center'; c.textBaseline='middle';
    c.font=(font||'600')+' '+Math.round(cv.height*0.62)+'px "Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif';
    c.fillText(text,cv.width/2,cv.height*0.54,cv.width*0.92);
    t=new $imports.THREE.CanvasTexture(cv); t.colorSpace=$imports.THREE.SRGBColorSpace; t.anisotropy=4;
    SIGN_TEX[key]=t;
  }
  var m=new $imports.THREE.Mesh(new $imports.THREE.PlaneGeometry(w,h),new $imports.THREE.MeshPhongMaterial({map:t,shininess:0,specular:0x000000}));
  return m;
}
/* 把牌子贴到某个立面上：face 's'/'n'/'e'/'w'，dist 离立面中心线多远 */
function placeSign(grp,m,px,y,pz,face,dist){
  if(face==='s'){ m.position.set(px,y,pz+dist); }
  else if(face==='n'){ m.position.set(px,y,pz-dist); m.rotation.y=Math.PI; }
  else if(face==='e'){ m.position.set(px+dist,y,pz); m.rotation.y=Math.PI/2; }
  else { m.position.set(px-dist,y,pz); m.rotation.y=-Math.PI/2; }
  grp.add(m);
}

/* ---- 立面上的一排窗 ----
   face：在哪一面；u0..u1：沿立面的范围（米，世界坐标）；y：窗中心高；n：几扇（0 = 按间距自动） */
/* ---- 外墙避让：正在建的这栋楼（FAC.o）和它的门（FAC.gap）。
   窗、墙基、腰线都先问一下这里能不能放：贴着别的楼、连廊的那一段不开窗；
   门口那一段（门洞、门套、雨棚、楼名牌）不开窗、腰线和墙基断开。 */
var FAC={o:null,gap:null};
function objHeightM(b){
  if(b.k==='link') return 16.5;
  if(b.open1f) return 17.4;
  return OBLD_H[b.id]!==undefined?OBLD_H[b.id]+0.6:12.0;
}
/* 这栋楼的门在哪：kind = 'big'（大门 + 雨棚）/ 'colonnade'（柱廊里的大门）/ 'small'（小铁门） */
function facadeDoor(o,px,pz,sw,sd,kind){
  var face=o.door||'s', horiz=(face==='s'||face==='n'), along=horiz?sw:sd;
  var dw=(kind==='small')?Math.min(1.6,along*0.5):Math.min(4.2,along*0.26);
  FAC.gap={face:face, c:horiz?px:pz,
    recess:((kind==='small')?dw+0.3:dw+0.5)/2+((kind==='small')?0.12:0.47),     /* 大门的门垛宽 0.45 */
    wide:((kind==='small')?dw+1.2:Math.max(dw+1.9,4.6)+0.4)/2,
    top:(kind==='small')?2.6:(kind==='colonnade'?3.7:4.4)};
}
function facadeBlocked(face,u0,u1,y0,y1){
  var o=FAC.o, g=FAC.gap, i;
  if(g&&g.face===face&&u1>g.c-g.wide&&u0<g.c+g.wide&&y0<g.top) return true;
  if(!o) return false;
  var horiz=(face==='s'||face==='n');
  var line=(face==='s')?o.y+o.h:(face==='n'?o.y:(face==='e'?o.x+o.w:o.x));
  for(i=0;i<$imports.OBJ.length;i++){
    var b=$imports.OBJ[i]; if(b===o||(b.k!=='roof'&&b.k!=='link')) continue;
    var n0=horiz?b.y:b.x, n1=horiz?b.y+b.h:b.x+b.w;
    if(line<n0-2||line>n1+2) continue;                                   /* 不贴着这面墙 */
    var a0=(0,$imports.M)(horiz?b.x:b.y)-0.4, a1=(0,$imports.M)(horiz?b.x+b.w:b.y+b.h)+0.4;
    if(u1>a0&&u0<a1&&y0<objHeightM(b)) return true;
  }
  return false;
}
/* 墙基：四面各一条（以前是一整块比楼大一圈的石头，门洞也被它从中间横穿） */
function plinthAround(K,px,pz,sw,sd,h,out,col){
  var g=FAC.gap, F=[['s',px,pz+sd/2+out/2,sw+out*2,true],['n',px,pz-sd/2-out/2,sw+out*2,true],
                    ['e',px+sw/2+out/2,pz,sd,false],['w',px-sw/2-out/2,pz,sd,false]], i;
  for(i=0;i<4;i++){
    var f=F[i], len=f[3], c0=f[4]?f[1]:f[2], segs=[[c0-len/2,c0+len/2]];
    if(g&&g.face===f[0]) segs=[[c0-len/2,g.c-g.recess],[g.c+g.recess,c0+len/2]];
    segs.forEach(function(sg){
      var L=sg[1]-sg[0], m=(sg[0]+sg[1])/2; if(L<0.05) return;
      if(f[4]) K.bevel('stone',m,h/2,f[2],L,h,out,col,1.0,0.02);
      else K.bevel('stone',f[1],h/2,m,out,h,L,col,1.0,0.02);
    });
  }
}
function facadeWindows(K,face,px,pz,sw,sd,u0,u1,y,ww,wh,spacing,litKey,grille){
  var horiz=(face==='s'||face==='n'), sg=(face==='s'||face==='e')?1:-1;
  var plane=horiz?pz+sg*sd/2:px+sg*sw/2;
  var len=u1-u0, n=Math.max(1,Math.floor(len/spacing)), k, low=(0,$imports.lodLow)(), det=$imports.Quality.get().facadeDetail;
  var OUT={s:'s',n:'n',e:'e',w:'w'}[face], BACK={s:'n',n:'s',e:'w',w:'e'}[face], SIDES='nsewud'.replace(BACK,'');
  for(k=0;k<n;k++){
    var u=u0+(k+0.5)*len/n;
    if(facadeBlocked(face,u-ww/2-0.13,u+ww/2+0.13,y-wh/2-0.14,y+wh/2+0.12)) continue;
    var seed=((u*7)|0)*31+((y*13)|0);
    function B(mat,du,dy,dn,su,sy,sn,col,sh){
      if(horiz) K.box(mat,u+du,y+dy,plane+sg*dn,su,sy,sn,col,sh);
      else K.box(mat,plane+sg*dn,y+dy,u+du,sn,sy,su,col,sh);
    }
    /* 贴墙的盒子：背面贴着墙，看不见，不建 */
    function F(mat,du,dy,dn,su,sy,sn,col,sh,faces){
      if(horiz) K.g(mat).boxFaces(u+du,y+dy,plane+sg*dn,su,sy,sn,col,sh,faces||SIDES);
      else K.g(mat).boxFaces(plane+sg*dn,y+dy,u+du,sn,sy,su,col,sh,faces||SIDES);
    }
    var wn=Math.round(ww*100)+'_'+Math.round(wh*100);
    if(!low&&$imports.Assets.has('fwin_'+wn)){
      /* 窗套、窗台、铝外框、亮子、两扇推拉窗、防盗网是 Blender 的模型（tools/blender/assets/exterior.py）：
         一前一后两条轨，推开的那一边露出屋里；屋里亮不亮灯、拉没拉窗帘还是按位置在这里画 */
      K.frame(horiz?u:plane,horiz?plane:u,FACE_ROT[face]);
      K.asset('fwin_'+wn,0,y,0,0);
      var ssw=(ww-0.08)/2+0.025, ssy=y+(-wh/2+0.04+wh/2-wh*0.24-0.0175)/2;
      var opn=((0,$imports.hash2)(seed,11)-0.5)*ww*0.25;
      K.asset('fsash_'+wn,-ww/2+0.04+ssw/2+Math.max(0,opn),ssy,0.048,0);
      K.asset('fsash_'+wn, ww/2-0.04-ssw/2-Math.max(0,-opn),ssy,0.022,Math.PI);
      if(det&&grille) K.asset('fgrille_'+wn,0,y,0,0);
      K.unframe();
      var lit2=(litKey!==undefined&&(0,$imports.hash2)((u*7)|0,(y*13+litKey)|0)<0.22);
      if(lit2) F('litwin',0,0,0.005,ww*0.96,wh*0.96,0.002,0xffffff,1.0,OUT);
      var cr2=(0,$imports.hash2)(seed,3);
      if(cr2<0.7){
        var cw2=ww*(0.18+(0,$imports.hash2)(seed,5)*0.30), cs2=((0,$imports.hash2)(seed,7)<0.5)?-1:1, ccol2=[0x8a6a5a,0x5a6a8a,0xb8a888,0x6a7a5a,0x9a5a5a,0xc8c0b0][(seed>>>0)%6];
        F('fabric',cs2*(ww/2-cw2/2),0,0.007,cw2,wh*0.98,0.002,lit2?(0,$imports.shadeHex)(ccol2,1.5):ccol2,lit2?1.0:0.7,OUT);
        if(cr2<0.25) F('fabric',-cs2*(ww/2-cw2*0.3),0,0.007,cw2*0.6,wh*0.98,0.002,lit2?(0,$imports.shadeHex)(ccol2,1.5):ccol2,lit2?1.0:0.7,OUT);
      }
      continue;
    }
    if(low){                                                       /* 流畅档：平贴的窗，和以前一样 */
      B('plaster',0,0.02,0.010,ww+0.18,wh+0.18,0.02,$imports.WHITEBAND,1.0);
      B('dark',0,0,0.022,ww,wh,0.01,$imports.WIN_DARK,1.0);
      B('stone',0,-wh/2-0.035,0.07,ww+0.26,0.07,0.14,0xd8d4cb,1.05);              /* 窗台紧贴窗下沿，和模型的窗台一样高 */
      if(litKey!==undefined&&(0,$imports.hash2)((u*7)|0,(y*13+litKey)|0)<0.22) B('litwin',0,0,0.036,ww*0.92,wh*0.92,0.004,0xffffff,1.0);
      continue;
    }
    /* 窗套：凸出墙面 10 厘米的白色线脚，窗户缩在里面，有进深、有阴影 */
    var fw=0.09, dep=0.10;
    F('plaster',0,wh/2+fw/2,dep/2,ww+fw*2,fw,dep,$imports.WHITEBAND,1.0);
    F('plaster',-(ww/2+fw/2),0,dep/2,fw,wh,dep,$imports.WHITEBAND,0.96);
    F('plaster', (ww/2+fw/2),0,dep/2,fw,wh,dep,$imports.WHITEBAND,0.96);
    F('stone',0,-wh/2-0.035,0.085,ww+0.30,0.07,0.17,0xd8d4cb,1.05);            /* 窗台：再往外挑一点 */
    F('dark',0,0,0.004,ww,wh,0.008,$imports.WIN_DARK,1.0,OUT);                           /* 屋里：暗的 */
    var lit=(litKey!==undefined&&(0,$imports.hash2)((u*7)|0,(y*13+litKey)|0)<0.22);
    if(lit) F('litwin',0,0,0.010,ww*0.96,wh*0.96,0.002,0xffffff,1.0,OUT);
    /* 屋里的窗帘：大半拉在一边，颜色各家不同 */
    var cr=(0,$imports.hash2)(seed,3);
    if(cr<0.7){
      var cw=ww*(0.18+(0,$imports.hash2)(seed,5)*0.30), cs=((0,$imports.hash2)(seed,7)<0.5)?-1:1, ccol=[0x8a6a5a,0x5a6a8a,0xb8a888,0x6a7a5a,0x9a5a5a,0xc8c0b0][(seed>>>0)%6];
      F('fabric',cs*(ww/2-cw/2),0,0.013,cw,wh*0.98,0.002,lit?(0,$imports.shadeHex)(ccol,1.5):ccol,lit?1.0:0.7,OUT);
      if(cr<0.25) F('fabric',-cs*(ww/2-cw*0.3),0,0.013,cw*0.6,wh*0.98,0.002,lit?(0,$imports.shadeHex)(ccol,1.5):ccol,lit?1.0:0.7,OUT);
    }
    /* 铝合金推拉窗：外框、上面一条固定亮子、两扇推拉扇一前一后，中间的碰头梃 */
    var mc=0xb8bcbc, fb=0.04, z0=0.03;
    F('metal',0,wh/2-fb/2,z0,ww,fb,0.04,mc,1.05);
    F('metal',0,-wh/2+fb/2,z0,ww,fb,0.04,mc,1.0);
    F('metal',-ww/2+fb/2,0,z0,fb,wh-fb*2,0.04,mc,1.0);
    F('metal', ww/2-fb/2,0,z0,fb,wh-fb*2,0.04,mc,1.0);
    var ty=wh/2-wh*0.24;
    F('metal',0,ty,z0,ww-fb*2,0.035,0.04,mc,1.05);                                   /* 亮子横档 */
    var open=((0,$imports.hash2)(seed,11)-0.5)*ww*0.25;                                          /* 推开了一点 */
    F('metal',open-0.02,(ty-wh/2+fb)/2,z0+0.012,0.035,ty-(-wh/2+fb),0.03,mc,1.08);  /* 碰头梃 */
    F('metal',open+0.02,(ty-wh/2+fb)/2,z0-0.008,0.035,ty-(-wh/2+fb),0.03,mc,1.0);
    F('glass',0,0,z0,ww-fb*2,wh-fb*2,0.004,0x6a8494,1.1,OUT);
    if(det&&grille){                                                               /* 防盗网：一格格的方管 */
      var gk, gn=Math.max(3,Math.round(ww/0.13));
      for(gk=1;gk<gn;gk++) B('metal',-ww/2+ww*gk/gn,0,0.16,0.016,wh+0.08,0.016,0x5a5e60,1.0);
      for(gk=0;gk<4;gk++) B('metal',0,-wh/2+0.02+gk*(wh-0.04)/3,0.16,ww+0.06,0.02,0.02,0x5a5e60,1.0);
      for(gk=-1;gk<=1;gk+=2) B('metal',gk*(ww/2+0.03),0,0.10,0.03,wh+0.10,0.14,0x5a5e60,1.0);
    }
  }
}
/* 立面朝外的方向 → 模型的转角（模型局部 +z 朝外） */
var FACE_ROT={s:0,n:Math.PI,e:Math.PI/2,w:-Math.PI/2};
/* 雨水管：屋顶一直下到地面，每 2 米一个管卡，下面一个弯头。u：沿立面的位置 */
function downpipe(K,face,px,pz,sw,sd,u,top){
  var horiz=(face==='s'||face==='n'), sg=(face==='s'||face==='e')?1:-1, plane=horiz?pz+sg*sd/2:px+sg*sw/2;
  var off=0.16, x=horiz?u:plane+sg*off, z=horiz?plane+sg*off:u, k;
  if(facadeBlocked(face,u-0.3,u+0.3,0,3)) return;
  if($imports.Assets.has('dp_clamp')){                       /* 雨水斗、管卡、下口和接水簸箕是模型，管子按楼高画 */
    K.frame(horiz?u:plane,horiz?plane:u,FACE_ROT[face]);
    K.asset('dp_shoe',0,0,0,0);
    K.rod('plastic',0,0.38,0.16,0,top-0.33,0.16,0.055,0.055,(0,$imports.lodLow)()?8:12,0xd8d6d0,1.0);
    for(k=2;k<top-0.8;k+=2) K.asset('dp_clamp',0,k,0,0);
    K.asset('dp_head',0,top-0.30,0,0);
    K.unframe();
    return;
  }
  K.rod('plastic',x,0.25,z,x,top,z,0.055,0.055,8,0xd8d6d0,1.0);
  for(k=2;k<top-0.5;k+=2){
    if(horiz){ K.box('metal',x,k,plane+sg*0.08,0.14,0.04,0.16,0x9a9e9e,1.0); }
    else K.box('metal',plane+sg*0.08,k,z,0.16,0.04,0.14,0x9a9e9e,1.0);
  }
  var ex=horiz?x:plane+sg*(off+0.22), ez=horiz?plane+sg*(off+0.22):z;
  K.rod('plastic',x,0.27,z,ex,0.08,ez,0.055,0.055,8,0xd8d6d0,1.0);                 /* 弯头：出水口朝外 */
}
/* 女儿墙上的避雷带：一圈细圆钢架在小支架上 */
function lightningBelt(K,px,pz,sw,sd,y){
  if((0,$imports.lodLow)()) return;
  var E=[[px-sw/2,pz-sd/2,px+sw/2,pz-sd/2],[px+sw/2,pz-sd/2,px+sw/2,pz+sd/2],[px+sw/2,pz+sd/2,px-sw/2,pz+sd/2],[px-sw/2,pz+sd/2,px-sw/2,pz-sd/2]], i, k;
  for(i=0;i<4;i++){
    var e=E[i], L=Math.hypot(e[2]-e[0],e[3]-e[1]), n=Math.max(2,Math.round(L/1.5));
    K.rod('metal',e[0],y+0.15,e[1],e[2],y+0.15,e[3],0.008,0.008,4,0x8a8e90,1.1);
    for(k=0;k<n;k++){ var t=k/n, x=e[0]+(e[2]-e[0])*t, z=e[1]+(e[3]-e[1])*t; K.rod('metal',x,y,z,x,y+0.15,z,0.006,0.006,4,0x8a8e90,1.0); }
  }
}
/* 太阳能热水器：一排真空管斜架在支架上，上头一个横着的水箱 */
function solarHeater(K,x,y,z,rot){
  if(K.asset('solar_heater',x,y,z,rot)) return;
  K.frame(x,z,rot);
  var k, n=(0,$imports.lodLow)()?6:12, w=1.9;
  K.rod('metal',-w/2,y+1.05,-0.55,w/2,y+1.05,-0.55,0.20,0.20,12,0xd8dcdc,1.1);                  /* 水箱 */
  for(k=0;k<n;k++){ var tx=-w/2+0.08+k*(w-0.16)/(n-1);
    K.rod('glass',tx,y+0.95,-0.42,tx,y+0.15,0.75,0.028,0.028,6,0x2a3440,1.2); }                    /* 真空管 */
  K.rod('metal',-w/2,y,0.80,-w/2,y+1.0,-0.55,0.02,0.02,4,0x9aa0a4,1.0);
  K.rod('metal', w/2,y,0.80, w/2,y+1.0,-0.55,0.02,0.02,4,0x9aa0a4,1.0);
  K.rod('metal',-w/2,y,-0.55,-w/2,y+0.95,-0.55,0.02,0.02,4,0x9aa0a4,1.0);
  K.rod('metal', w/2,y,-0.55, w/2,y+0.95,-0.55,0.02,0.02,4,0x9aa0a4,1.0);
  K.rod('metal',-w/2,y+0.15,0.75,w/2,y+0.15,0.75,0.015,0.015,4,0x9aa0a4,1.0);
  K.unframe();
}
/* 一圈白色腰线 */
function bandAround(K,px,pz,sw,sd,y,h,out,col,skip){
  var F=[['s',px,pz+sd/2+out/2,sw+out*2,true],['n',px,pz-sd/2-out/2,sw+out*2,true],
         ['e',px+sw/2+out/2,pz,sd,false],['w',px-sw/2-out/2,pz,sd,false]], i, g=FAC.gap;
  for(i=0;i<4;i++){
    var f=F[i], len=f[3], c0=f[4]?f[1]:f[2], segs=[[c0-len/2,c0+len/2]];
    if(skip&&skip.indexOf(f[0])>=0) continue;
    if(g&&g.face===f[0]&&y-h/2<g.top) segs=[[c0-len/2,g.c-g.wide],[g.c+g.wide,c0+len/2]];   /* 门头那一段断开 */
    segs.forEach(function(sg){
      var L=sg[1]-sg[0], m=(sg[0]+sg[1])/2; if(L<0.05) return;
      if(f[4]) K.box('plaster',m,y,f[2],L,h,out,col||$imports.WHITEBAND,1.0);
      else K.box('plaster',f[1],y,m,out,h,L,col||$imports.WHITEBAND,1.0);
    });
  }
}
/* 空调外机 */
function acUnit(K,x,y,z,face){
  var rot=(face==='s')?0:(face==='n'?Math.PI:(face==='e'?Math.PI/2:-Math.PI/2));
  if(K.asset('ac_outdoor',x,y-0.24,z,rot)) return;          /* y 是机身中心，模型的原点在它站的那块板上 */
  K.frame(x,z,rot);
  K.bevel('plastic',0,y,0,0.62,0.48,0.30,0xdad6cf,1.0,0.02);
  K.rod('dark',0.10,y,0.15,0.10,y,0.16,0.15,0.15,10,0x4a4e50);
  K.box('metal',0,y-0.30,0.02,0.70,0.03,0.36,0x6a6e72,1.0);
  K.unframe();
}
/* 楼顶：楼梯间 + 水箱 + 一根天线 */
function roofTop(K,px,top,pz,sw,sd,seed){
  var hx=px+sw*0.28*((0,$imports.hash2)(seed,3)>0.5?1:-1), hz=pz-sd*0.12;
  if($imports.Assets.has('roof_stairhouse')){                 /* 楼梯间（门、爬梯、百叶）、水箱、楼梯间顶上的电视天线 */
    K.asset('roof_stairhouse',hx,top,hz,0);
    K.asset('roof_tank',px-sw*0.30*((0,$imports.hash2)(seed,5)>0.5?1:-1),top,pz+sd*0.10,(0,$imports.hash2)(seed,9)*6.283);
    K.asset('roof_antenna',hx+0.25,top+2.97,hz-0.15,(0,$imports.hash2)(seed,13)*6.283);
    return;
  }
  K.bevel('brick',hx,top+1.4,hz,3.2,2.8,3.0,$imports.BRICK,0.96,0.04);
  K.box('plaster',hx,top+2.86,hz,3.4,0.12,3.2,$imports.WHITEBAND,1.0);
  K.box('dark',hx,top+1.05,hz+1.505,0.9,2.0,0.02,0x2a3136,1.0);
  K.cyl('metal',px-sw*0.30*((0,$imports.hash2)(seed,5)>0.5?1:-1),top,pz+sd*0.10,0.9,0.9,1.6,12,0x9aa0a4,1.0);
  K.cyl('metal',px-sw*0.30*((0,$imports.hash2)(seed,5)>0.5?1:-1),top+1.6,pz+sd*0.10,0.92,0.2,0.3,12,0x8a9094,1.0);
  K.rod('metal',hx+1.2,top+2.9,hz,hx+1.2,top+5.4,hz,0.03,0.015,5,0x6a6e72);
}

/* ---- 大门口：门洞暗腔、双开门、门套、雨棚（有柱廊的楼不要雨棚）、台阶、门牌 ---- */
function addEntrance(K, grp, px, pz, sw, sd, face, colonnade, name, seam){
  face=face||'s';
  var horz=(face==='e'||face==='w');
  var along=horz?sd:sw;
  var dw=Math.min(4.2, along*0.26), dh=colonnade?2.40:2.6, dep=1.1;
  var nx=0,nz=0,bx=px,bz=pz;
  if(face==='s'){ nz=1;  bz=pz+sd/2; }
  else if(face==='n'){ nz=-1; bz=pz-sd/2; }
  else if(face==='e'){ nx=1;  bx=px+sw/2; }
  else { nx=-1; bx=px-sw/2; }
  var rot=Math.atan2(nx,nz);
  K.frame(bx,bz,rot);                           /* 局部：+z 朝外 */
  var en=(colonnade?'entrance_col_':'entrance_')+Math.round(dw*100);
  if(seam){                                      /* 连续出入口：门洞敞开（和室内门洞同宽），两扇玻璃门推开贴在两边墙上；门槛平铺，不做台阶 */
    var hw=seam.width/2;
    K.unframe(); K.frame(bx+(horz?0:(seam.dx||0)),bz+(horz?(seam.dx||0):0),rot);   /* 门中线可以偏离楼中线（实验楼宽 50 格） */
    [-1,1].forEach(function(sx){
      K.bevel('stone',sx*(hw+0.09),1.2,0.11,0.18,2.40,0.22,0xd8d4cc,1.05,0.02);                 /* 门套 */
      K.bevel('metal',sx*(hw+0.85),1.12,0.135,1.30,2.18,0.05,0x2a3136,1.02,0.01);               /* 推开的门扇（贴在墙基外面） */
      K.box('glass',sx*(hw+0.85),1.25,0.165,1.06,1.70,0.01,0x5a7080,1.0);
    });
    K.bevel('stone',0,2.39,0.11,seam.width+0.36,0.18,0.22,0xd8d4cc,1.05,0.02);                  /* 门头线 */
    K.box('emit',hw*0.6,2.20,0.13,0.30,0.14,0.04,0x2fae6a,1.0);                                /* 安全出口灯 */
    K.box('stone',0,0.006,0.55,seam.width+0.6,0.012,1.1,0xb8b2a8,1.0);                          /* 门槛石 */
  }
  else if(K.asset(en,0,0,0,0)){}                      /* 门斗、地弹门、台阶、雨棚是模型（exterior.py） */
  else{
  K.box('dark',0,dh/2,dep*0.5,dw+0.5,dh,dep,0x0e1316,1.0);                     /* 门洞暗腔 */
  K.bevel('metal',-dw*0.25,dh/2-0.05,dep*0.95,dw*0.48,dh-0.1,0.08,0x2a3136,1.02,0.01);   /* 双开门 */
  K.bevel('metal', dw*0.25,dh/2-0.05,dep*0.95,dw*0.48,dh-0.1,0.08,0x2a3136,1.02,0.01);
  K.box('glass',-dw*0.25,dh*0.55,dep*1.0,dw*0.38,dh*0.62,0.01,0x5a7080,1.0);
  K.box('glass', dw*0.25,dh*0.55,dep*1.0,dw*0.38,dh*0.62,0.01,0x5a7080,1.0);
  K.rod('metal',-0.08,1.0,dep+0.02,-0.08,1.5,dep+0.02,0.02,0.02,6,0xb8c0c2,1.2);
  K.rod('metal', 0.08,1.0,dep+0.02, 0.08,1.5,dep+0.02,0.02,0.02,6,0xb8c0c2,1.2);
  K.bevel('stone',-dw*0.56,dh/2,dep*0.95,dw*0.12,dh+0.2,0.22,0xd8d4cc,1.05,0.02);   /* 门套 */
  K.bevel('stone', dw*0.56,dh/2,dep*0.95,dw*0.12,dh+0.2,0.22,0xd8d4cc,1.05,0.02);
  K.bevel('stone',0,dh+0.10,dep*0.95,dw+0.5,0.18,0.22,0xd8d4cc,1.05,0.02);
  K.box('emit',dw*0.30,dh-0.20,dep*1.02,0.30,0.14,0.04,0x2fae6a,1.0);            /* 安全出口灯 */
  if(!colonnade){
    K.bevel('concrete',0,dh+0.55,dep*0.75,dw+1.9,0.22,dep*1.7,0xc9c4bb,1.05,0.04);  /* 雨棚 */
    K.box('plaster',0,dh+0.40,dep*0.75,dw+1.7,0.10,dep*1.6,0x8a5a52,1.0);
  }
  K.bevel('stone',0,0.09,dep*1.5,dw+2.6,0.18,1.0,0xb8b2a8,1.0,0.02);              /* 两级台阶 */
  K.bevel('stone',0,0.24,dep*1.1,dw+2.2,0.16,0.7,0xb8b2a8,1.02,0.02);
  }
  K.unframe();
  if(name){                                                                        /* 楼名牌 */
    var sm=signMesh(name,Math.min(dw+1.0,4.4),0.42,'#8b3a2e','#f2e6d0');
    var sy=colonnade?3.34:dh+1.35, sd2=colonnade?2.99:dep*0.29+0.02;
    var smx=bx+nx*sd2, smz=bz+nz*sd2;
    sm.position.set(smx,sy,smz); sm.rotation.y=rot; grp.add(sm);
    var back=new $imports.THREE.Mesh(new $imports.THREE.BoxGeometry(Math.min(dw+1.2,4.6),0.56,0.08),new $imports.THREE.MeshPhongMaterial({color:0xd8d4cc,shininess:0,specular:0}));
    back.position.set(bx+nx*(sd2-0.05),sy,bz+nz*(sd2-0.05)); back.rotation.y=rot; grp.add(back);
  }
}
function addSmallDoor(K, px, pz, sw, sd, face){
  face=face||'s';
  var horz=(face==='e'||face==='w');
  var along=horz?sd:sw;
  var dw=Math.min(1.6, along*0.5), dh=2.15, dep=0.5;
  var nx=0,nz=0,bx=px,bz=pz;
  if(face==='s'){ nz=1;  bz=pz+sd/2; }
  else if(face==='n'){ nz=-1; bz=pz-sd/2; }
  else if(face==='e'){ nx=1;  bx=px+sw/2; }
  else { nx=-1; bx=px-sw/2; }
  K.frame(bx,bz,Math.atan2(nx,nz));
  if(K.asset('door_small_'+Math.round(dw*100),0,0,0,0)){ K.unframe(); return; }     /* 子母铁门、门垛、雨棚、台阶 */
  K.box('dark',0,dh/2,dep*0.4,dw+0.30,dh,dep,0x0e1316,1.0);
  K.bevel('metal',0,dh/2-0.05,dep*0.95,dw,dh-0.1,0.07,0x39424a,1.02,0.01);         /* 铁门 */
  var k; for(k=0;k<4;k++) K.box('metal',0,0.35+k*0.45,dep*1.0,dw*0.86,0.04,0.02,0x2e353c,1.0);
  K.bevel('stone',-dw*0.60,dh/2,dep*0.95,0.12,dh+0.16,0.18,0xd8d4cc,1.05,0.02);
  K.bevel('stone', dw*0.60,dh/2,dep*0.95,0.12,dh+0.16,0.18,0xd8d4cc,1.05,0.02);
  K.bevel('stone',0,dh+0.06,dep*0.95,dw+0.36,0.14,0.18,0xd8d4cc,1.05,0.02);
  K.blob('metal',dw*0.30,dh*0.48,dep*1.02,0.035,0.035,0.035,0xc8a24a,1.3,6);       /* 门把手 */
  K.bevel('concrete',0,dh+0.30,dep*0.9,dw+0.8,0.10,0.9,0xc9c4bb,1.0,0.02);        /* 小雨棚 */
  K.bevel('stone',0,0.07,dep*1.35,dw+0.9,0.14,0.7,0xb8b2a8,1.0,0.02);
  K.unframe();
}
/* 花园里的校训牌 */
function addGardenSign(grp){
  try{
    var gx=535*$imports.SC*$imports.U2M, gz=1040*$imports.SC*$imports.U2M;
    var m=signMesh('十年树木  百年树人',10.4,1.6,'#ddd8ce','#7a3226');
    m.position.set(gx,1.35,gz+1.6+0.176); grp.add(m);
    var m2=signMesh('十年树木  百年树人',10.4,1.6,'#ddd8ce','#7a3226');
    m2.position.set(gx,1.35,gz+1.6-0.176); m2.rotation.y=Math.PI; grp.add(m2);
  }catch(e){}
}

/* ---- 教学楼 / 行政楼 / 实验楼：一层架空柱廊 + 四层教室 ---- */
/* 接在这栋楼某一面上的连廊（连续校园 A2：楼端头的南北向直桥）：返回这一面上连廊占的那几段（米，沿墙的坐标） */
function linkSpansOn(o,face){
  var out=[];
  $imports.OBJ.forEach(function(b){
    if(b.k!=='link'||b.x+b.w<=o.x||b.x>=o.x+o.w) return;
    var touch=face==='s'?Math.abs(b.y-(o.y+o.h))<1:face==='n'?Math.abs(b.y+b.h-o.y)<1:false;
    if(touch) out.push([(0,$imports.M)(b.x),(0,$imports.M)(b.x+b.w)]);
  });
  return out;
}
function bldClassroom(K,grp,o,px,pz,sw,sd){
  var total=16.0, g0=3.2, dep=$imports.STRUCTURE_CFG.colonnade.depth, links=linkSpansOn(o,'s');
  var underLink=function(x,pad){ return links.some(function(l){ return x>l[0]-pad&&x<l[1]+pad; }); };
  facadeDoor(o,px,pz,sw,sd,'colonnade');
  var seam=o.seamDoor;
  if(seam&&(o.door||'s')==='s'){
    /* 连续出入口（连续校园 A2，外壳和室内同尺寸）：一楼走廊那一段镂空，门里看得见室内模型。
       北边的房间块整栋实心；走廊上方（二楼楼板往上）实心；一楼留东西两头的端墙和南外墙，外墙在正门那里开洞、留门头。
       贴着室内墙面的那几面都往里退 4 厘米，室内模型挂进来时不重叠 */
    var t=1.0, hz=seam.hollow*t, zc=pz+sd/2-hz, wh=g0-0.18, dxo=px+(seam.dx||0), dh=seam.width/2, iw=t-0.04;
    K.box('brick',px,total/2,(pz-sd/2+zc-0.04)/2,sw,total,zc-0.04-(pz-sd/2),$imports.BRICK,0.97);   /* 房间块 */
    K.box('brick',px,(wh+total)/2,(zc+pz+sd/2)/2,sw,total-wh,hz,$imports.BRICK,0.97);             /* 走廊上方 */
    [-1,1].forEach(function(e){ K.box('brick',px+e*(sw/2-iw/2),wh/2,(zc+pz+sd/2)/2,iw,wh,hz,$imports.BRICK,0.97); });   /* 一楼两头的端墙 */
    var wz1=pz+sd/2-iw/2;
    [[px-sw/2+iw,dxo-dh-0.02],[dxo+dh+0.02,px+sw/2-iw]].forEach(function(g){ if(g[1]-g[0]>0.05) K.box('brick',(g[0]+g[1])/2,wh/2,wz1,g[1]-g[0],wh,iw,$imports.BRICK,0.97); });
    K.box('brick',dxo,(2.32+wh)/2,wz1,dh*2+0.04,wh-2.32,iw,$imports.BRICK,0.97);                  /* 门头 */
  }else K.box('brick',px,total/2,pz,sw,total,sd,$imports.BRICK,0.97);
  plinthAround(K,px,pz,sw,sd,0.9,0.08,(0,$imports.shadeHex)($imports.BASE_GREY,0.92));                 /* 底层浅灰：0.9 米高，以前 1.5 米把一楼窗户截掉半截 */
  /* 女儿墙（挑出的尺寸改成固定值：以前按楼宽的百分比，宽楼挑出半米，插进隔壁钟楼的柱子） */
  K.box('plaster',px,total+0.18,pz,sw-0.02,0.42,sd-0.02,$imports.WHITEBAND,1.0);
  K.box('brick',px,total+0.78,pz,sw+0.12,0.80,sd+0.12,$imports.BRICK,0.99);
  K.bevel('stone',px,total+1.22,pz,sw+0.24,0.10,sd+0.24,0xd8d4cb,1.05,0.02);
  roofTop(K,px,total+1.27,pz,sw,sd,o.x);                                      /* 立在女儿墙压顶上面（以前从 16 米起，下半截埋在实心的女儿墙里） */
  lightningBelt(K,px,pz,sw+0.16,sd+0.16,total+1.27);
  (function(){                                                                   /* 北面雨水管：落在两扇窗之间的墙垛上 */
    var u0=px-sw/2+0.8, len=sw-1.6, nw=Math.max(1,Math.floor(len/3.2)), q;
    for(q=1;q<4;q++){ var kk=Math.round(nw*q/4); if(kk>0&&kk<nw) downpipe(K,'n',px,pz,sw,sd,u0+kk*len/nw,total+0.9); }
  })();
  /* 柱廊：正中让出大门。位置来自 content/structure-recipe.js，碰撞用同一份 */
  (0,$imports.colonnadeColumns)(px,pz,sw,sd).forEach(function(c){
    K.bevel('brick',c.x,g0/2,c.z,0.46,g0,0.46,$imports.BRICK,1.02,0.03);
    K.bevel('stone',c.x,0.16,c.z,0.62,0.32,0.62,$imports.BASE_GREY,0.95,0.03);
    K.bevel('stone',c.x,g0-0.12,c.z,0.56,0.12,0.56,$imports.WHITEBAND,1.0,0.02);
  });
  /* 雨篷和梁：在南面连廊的桥下断开（连续校园 A2） */
  var segs=[[px-sw/2-0.2,px+sw/2+0.2]];
  links.forEach(function(l0){ var l=[l0[0]-0.3,l0[1]+0.3], nx=[]; segs.forEach(function(g){ if(l[1]<=g[0]||l[0]>=g[1]){ nx.push(g); return; } if(l[0]>g[0]) nx.push([g[0],l[0]]); if(l[1]<g[1]) nx.push([l[1],g[1]]); }); segs=nx; });   /* 桥两边立着落地柱，再让出 0.3 米 */
  segs.forEach(function(g){
    var cm=(g[0]+g[1])/2, cl=g[1]-g[0]; if(cl<0.05) return;
    if(!$imports.DEV_HIDE.canopy) K.bevel('plaster',cm,g0+0.14,pz+sd/2+dep/2,cl,0.30,dep+0.5,$imports.WHITEBAND,1.02,0.04);
    K.box('concrete',cm,g0-0.30,pz+sd/2+dep/2,Math.max(0.05,cl-0.2),0.26,dep+0.3,$imports.BRICK_D,0.96);
  });
  /* 首层：柱廊后面的窗 */
  var spans=faceFreeSpans(o,'s'), si;
  for(si=0;si<spans.length;si++) facadeWindows(K,'s',px,pz,sw,sd,(0,$imports.M)(spans[si][0])+2.4,(0,$imports.M)(spans[si][1])-2.4,1.7,1.8,1.2,4.2);
  /* 二到五层 */
  var fl, nfl=4;
  for(fl=1;fl<=nfl;fl++){
    var fy=3.6+(fl-0.5)*(total-3.6)/(nfl+0.6);
    bandAround(K,px,pz,sw,sd,fy-0.86,0.18,0.06);                                    /* 每层腰线 */
    facadeWindows(K,'n',px,pz,sw,sd,px-sw/2+0.8,px+sw/2-0.8,fy,1.8,1.25,3.2,fl);
    facadeWindows(K,'e',px,pz,sw,sd,pz-sd/2+0.8,pz+sd/2-0.8,fy,1.6,1.25,3.4,fl+10);
    facadeWindows(K,'w',px,pz,sw,sd,pz-sd/2+0.8,pz+sd/2-0.8,fy,1.6,1.25,3.4,fl+20);
    facadeWindows(K,'s',px,pz,sw,sd,px-sw/2+0.8,px+sw/2-0.8,fy,1.8,1.25,3.2,fl+30);
    /* 南面：一层层外走廊的栏板 + 红色栏杆 + 空调外机 */
    var sy=fy-0.77, rz=pz+sd/2+0.62;                                              /* 栏板顶比窗台低一点（以前窗台埋进栏板 6 厘米） */
    /* 栏板和栏杆在连廊接过来的那一段断开（连续校园 A2） */
    var bsegs=[[px-sw*0.49,px+sw*0.49]];
    links.forEach(function(l0){ var l=[l0[0]-0.3,l0[1]+0.3], nx=[]; bsegs.forEach(function(g){ if(l[1]<=g[0]||l[0]>=g[1]){ nx.push(g); return; } if(l[0]>g[0]) nx.push([g[0],l[0]]); if(l[1]<g[1]) nx.push([l[1],g[1]]); }); bsegs=nx; });
    bsegs.forEach(function(g){
      var bm=(g[0]+g[1])/2, bl=g[1]-g[0]; if(bl<0.3) return;
      K.box('concrete',bm,sy,pz+sd/2+0.36,bl,0.14,0.72,0xd8d4cb,1.04);
      K.box('plaster',bm,sy-0.04,pz+sd/2+0.73,bl,0.24,0.04,$imports.WHITEBAND,1.0);
      var r0=g[0]+0.1, r1=g[1]-0.1, rpn=Math.max(1,Math.round((r1-r0)/1.3)), rp;
      for(rp=0;rp<=rpn;rp++){ var rx=r0+((r1-r0)/rpn)*rp; K.rod('metal',rx,sy+0.07,rz,rx,sy+1.05,rz,0.025,0.025,5,0x8b3a2e,1.0); }
      K.rod('metal',r0,sy+1.05,rz,r1,sy+1.05,rz,0.04,0.04,6,0x8b3a2e,1.05);
      K.rod('metal',r0,sy+0.55,rz,r1,sy+0.55,rz,0.018,0.018,4,0x8b3a2e,1.0);
    });
    var acn=Math.max(2,Math.floor(sw/5.2)), ac;
    for(ac=0;ac<acn;ac++){ var acx=px-sw*0.42+ac*(sw*0.84/(acn-1||1)); if(!underLink(acx,0.8)) acUnit(K,acx,sy+0.31,pz+sd/2+0.28,'s'); }   /* 连廊接过来的那一段不挂空调外机 */
  }
  addEntrance(K,grp,px,pz,sw,sd,o.door||'s',true,BLD_NAME[o.id],o.seamDoor);
}
/* ---- 教学楼（连续校园 A1：按室内 63×22 格重建，砖墙、白腰线、红栏杆、柱廊和正门的样式不变） ----
   五层每层 3.2 米（和楼梯一样）。北边是实心的教室块；南侧一楼是走廊外墙（窗、正门、柱廊），二到五层是敞开的外廊：
   每层一块楼板（顶面比室内地面低 2 厘米、底面比室内吊顶高 2 厘米，从走廊里看都被室内挡住），外沿红栏杆，
   里面是教室块的南墙（每间教室两扇门、高窗）。楼前三座塔：两部楼梯（西边那部上到天台）和电梯井。 */
function bldTeach(K,grp,o,px,pz,sw,sd){
  var L=(0,$imports.teachSouth)(px,pz,sw,sd), total=16.0, rise=3.2, g0=3.2, dep=$imports.STRUCTURE_CFG.colonnade.depth;
  var gz=L.gz, zs=L.zs, ge0=L.ge0, ge1=L.ge1, gw=ge1-ge0, gx=(ge0+ge1)/2, k;
  facadeDoor(o,px,pz,sw,sd,'colonnade');
  /* 教室块：北墙到走廊北墙 */
  K.box('brick',px,total/2,(L.z0+gz)/2,sw,total,gz-L.z0,$imports.BRICK,0.97);
  /* 东头厕所那一段、西头端墙：从教室块一直到南沿 */
  K.box('brick',(ge1+L.x0+sw)/2,total/2,(gz+zs)/2,L.x0+sw-ge1,total,zs-gz,$imports.BRICK,0.97);
  K.box('brick',(L.x0+ge0)/2,total/2,(gz+zs)/2,ge0-L.x0,total,zs-gz,$imports.BRICK,0.97);
  /* 一楼：走廊外墙（室内第 21 格），二楼楼板以下。里面那层退进 4 厘米：门里看得见室内模型时两面墙不重叠。
     连续出入口（o.seamDoor，连续校园模块给）：正门那 3 米墙开敞，只留门头 */
  var w1=L.t-0.04, wz=zs-w1/2, wh=g0-0.18, dh=o.seamDoor?o.seamDoor.width/2:0;
  if(dh){
    /* 墙段、门头都比室内门洞让开 2 厘米：室内模型挂进来时两边的门边、门头底面不在同一个平面上 */
    [[ge0,px-dh-0.02],[px+dh+0.02,ge1]].forEach(function(sg){ K.box('brick',(sg[0]+sg[1])/2,wh/2,wz,sg[1]-sg[0],wh,w1,$imports.BRICK,0.97); });
    K.box('brick',px,(2.32+wh)/2,wz,dh*2+0.04,wh-2.32,w1,$imports.BRICK,0.97);                  /* 门头 */
  }else K.box('brick',gx,wh/2,wz,gw,wh,w1,$imports.BRICK,0.97);
  plinthAround(K,px,pz,sw,sd,0.9,0.08,(0,$imports.shadeHex)($imports.BASE_GREY,0.92));
  /* 女儿墙和压顶：北、东、西三面挑出，南面和楼梯塔、电梯井贴齐（塔从南沿立起来，挑出去就插进塔身） */
  K.box('plaster',px,total+0.18,pz,sw-0.02,0.42,sd-0.02,$imports.WHITEBAND,1.0);
  K.box('brick',px,total+0.78,pz-0.03,sw+0.12,0.80,sd+0.06,$imports.BRICK,0.99);
  K.bevel('stone',px,total+1.22,pz-0.06,sw+0.24,0.10,sd+0.12,0xd8d4cb,1.05,0.02);
  roofTop(K,px,total+1.27,(L.z0+gz)/2,sw,gz-L.z0,o.x);
  lightningBelt(K,px,pz,sw+0.16,sd+0.16,total+1.27);
  (function(){ var u0=px-sw/2+0.8, len=sw-1.6, nw=Math.max(1,Math.floor(len/3.2)), q;
    for(q=1;q<4;q++){ var kk=Math.round(nw*q/4); if(kk>0&&kk<nw) downpipe(K,'n',px,pz,sw,sd,u0+kk*len/nw,total+0.9); } })();
  /* 柱廊和雨篷（立柱位置和碰撞来自 content/structure-recipe.js）。雨篷和下面的梁在楼梯塔、电梯井处断开；
     落在塔里的立柱不画（塔身就是柱子）；立柱顶到梁底，梁托着雨篷 */
  var beamY0=g0-0.43, inTower=function(x,pad){ return L.towers.some(function(b){ return Math.abs(x-b.x)<b.half+pad; }); };
  (0,$imports.colonnadeColumns)(px,pz,sw,sd).forEach(function(c){
    if(inTower(c.x,0.23)) return;
    K.bevel('brick',c.x,beamY0/2,c.z,0.46,beamY0,0.46,$imports.BRICK,1.02,0.03);
    K.bevel('stone',c.x,0.16,c.z,0.62,0.32,0.62,$imports.BASE_GREY,0.95,0.03);
    K.bevel('stone',c.x,beamY0-0.06,c.z,0.56,0.12,0.56,$imports.WHITEBAND,1.0,0.02);
  });
  var cutsC=L.towers.map(function(b){ return [b.x-b.half,b.x+b.half]; }).sort(function(a,b){return a[0]-b[0];}), cx0=L.x0, si;
  for(si=0;si<=cutsC.length;si++){
    var cx1=si<cutsC.length?cutsC[si][0]:L.x0+sw;
    if(cx1-cx0>0.05){
      var cm=(cx0+cx1)/2, cl=cx1-cx0;
      /* 从楼板外沿的白边外面起（白边厚 4 厘米） */
      if(!$imports.DEV_HIDE.canopy) K.bevel('plaster',cm,g0+0.14,zs+0.04+(dep+0.21)/2,cl,0.30,dep+0.21,$imports.WHITEBAND,1.02,0.04);
      K.box('concrete',cm,(beamY0+g0-0.01)/2,zs+0.04+(dep+0.11)/2,cl,g0-0.01-beamY0,dep+0.11,$imports.BRICK_D,0.96);
    }
    if(si<cutsC.length) cx0=cutsC[si][1];
  }
  /* 一楼南窗：避开楼梯塔、电梯井和正门 */
  var cuts=L.towers.map(function(b){ return [b.x-b.half-0.6,b.x+b.half+0.6]; }).concat([[px-3.2,px+3.2]]).sort(function(a,b){return a[0]-b[0];});
  var from=ge0+0.6, ci;
  for(ci=0;ci<=cuts.length;ci++){
    var to=ci<cuts.length?cuts[ci][0]:ge1-0.6;
    if(to-from>2.4) facadeWindows(K,'s',px,pz,sw,sd,from+0.4,to-0.4,1.7,1.8,1.2,4.2);
    if(ci<cuts.length) from=Math.max(from,cuts[ci][1]);
  }
  /* 北、东、西三面每层的窗，每层腰线 */
  for(k=0;k<5;k++){
    var fy=k*rise+1.75;
    if(k>0) bandAround(K,px,pz,sw,sd,k*rise-0.09,0.18,0.06,null,['s']);   /* 南面是外廊，楼板外沿的白边就是腰线 */
    facadeWindows(K,'n',px,pz,sw,sd,px-sw/2+0.8,px+sw/2-0.8,fy,1.8,1.25,3.2,k);
    facadeWindows(K,'e',px,pz,sw,sd,pz-sd/2+0.8,pz+sd/2-0.8,fy,1.6,1.25,3.4,k+10);
    facadeWindows(K,'w',px,pz,sw,sd,pz-sd/2+0.8,pz+sd/2-0.8,fy,1.6,1.25,3.4,k+20);
  }
  /* 二到五层外廊 */
  var doors=[10,18,22,30,34,42,46,54];
  for(k=1;k<=5;k++){
    var y=k*rise;
    /* 楼板（五层上面那块是屋顶下的檐板） */
    K.box('concrete',gx,y-0.10,(gz+zs)/2,gw,0.16,zs-gz,0xd8d4cb,1.04);
    K.box('plaster',gx,y-0.06,zs+0.02,gw,0.24,0.04,$imports.WHITEBAND,1.0);                          /* 楼板外沿的白边 */
    if(k===5) continue;
    /* 教室块南墙上的门和高窗（外廊这一侧） */
    doors.forEach(function(c){
      var dx=L.x0+(c+0.5)*L.t;
      K.box('wood',dx,y+1.02,gz+0.03,0.92,2.04,0.06,0x6a4a34,0.95);
      K.box('plaster',dx,y+2.1,gz+0.03,1.06,0.10,0.07,$imports.WHITEBAND,1.0);
    });
    facadeWindows(K,'s',px,L.z0+(gz-L.z0)/2,sw,gz-L.z0,ge0+2.2,ge1-2.2,y+2.55,1.6,0.6,4.0,k+30);   /* 高窗在门头（2.15 米）以上、上一层楼板以下 */
    /* 外沿：矮栏板 + 红栏杆（室内第 21 格的里沿，人走到这里正好挨着栏杆） */
    var rz=zs-L.t+0.08, rpn=Math.max(4,Math.round(gw/1.3)), rp;
    K.box('concrete',gx,y+0.08,rz,gw,0.16,0.18,0xd8d4cb,1.02);
    for(rp=0;rp<=rpn;rp++){ var rx=ge0+(gw/rpn)*rp; K.rod('metal',rx,y+0.16,rz,rx,y+1.08,rz,0.025,0.025,5,0x8b3a2e,1.0); }
    K.rod('metal',ge0,y+1.08,rz,ge1,y+1.08,rz,0.04,0.04,6,0x8b3a2e,1.05);
    K.rod('metal',ge0,y+0.6,rz,ge1,y+0.6,rz,0.018,0.018,4,0x8b3a2e,1.0);
    var acn=Math.max(2,Math.floor(gw/9)), ac;
    for(ac=0;ac<acn;ac++) acUnit(K,ge0+2+ac*((gw-4)/(acn-1||1)),y+0.31,gz+0.3,'s');
  }
  /* 楼前三座塔：楼梯两座、电梯一座，砖墙、白顶，楼梯塔南面每个半层一扇窗 */
  L.towers.forEach(function(b){
    var d=b.z1-b.z0, cz=(b.z0+b.z1)/2;
    K.box('brick',b.x,b.top/2,cz,b.half*2,b.top,d,$imports.BRICK,0.97);
    K.box('plaster',b.x,b.top+0.15,cz,b.half*2+0.12,0.30,d+0.12,$imports.WHITEBAND,1.0);
    plinthAround(K,b.x,cz,b.half*2,d,0.9,0.08,(0,$imports.shadeHex)($imports.BASE_GREY,0.92));
    if(b.kind==='stair'){ for(var h=1.6+rise/2;h<b.top-1;h+=rise) facadeWindows(K,'s',b.x,cz,b.half*2,d,b.x-0.9,b.x+0.9,h,1.2,1.1,1.8,(h*7)|0); }
  });
  addEntrance(K,grp,px,pz,sw,sd,o.door||'s',true,BLD_NAME[o.id],o.seamDoor);
}
/* ---- 宿舍：六层，阳台开在门的对面（贴着食堂的那段不画） ---- */
function bldDorm(K,grp,o,px,pz,sw,sd){
  var dh=OBLD_H[o.id], dn=Math.round(dh/3.0), dfl;
  facadeDoor(o,px,pz,sw,sd,'big');
  K.box('brick',px,dh/2,pz,sw,dh,sd,$imports.BRICK,0.97);
  plinthAround(K,px,pz,sw,sd,0.7,0.10,$imports.BASE_GREY);                                 /* 以前 2.5 米高，一楼窗户整个埋在里面 */
  K.box('plaster',px,dh+0.16,pz,sw-0.02,0.32,sd-0.02,$imports.WHITEBAND,1.0);
  K.bevel('stone',px,dh+0.45,pz,sw+0.2,0.10,sd+0.2,0xd8d4cb,1.0,0.02);
  roofTop(K,px,dh+0.5,pz,sw,sd,o.y);
  lightningBelt(K,px,pz,sw+0.12,sd+0.12,dh+0.5);
  if(!(0,$imports.lodLow)()){                                                                 /* 楼顶一排太阳能热水器 */
    var shx;
    for(shx=px-sw/2+2.2;shx<px+sw/2-2;shx+=3.2) solarHeater(K,shx,dh+0.5,pz+sd*0.28,Math.PI);
  }
  downpipe(K,'e',px,pz,sw,sd,pz,dh+0.3); downpipe(K,'w',px,pz,sw,sd,pz,dh+0.3);
  var bs=(o.door==='n')?1:-1, balFace=bs>0?'s':'n', doorFace=bs>0?'n':'s';
  var spans=faceFreeSpans(o,balFace), sp2;
  for(dfl=1;dfl<=dn;dfl++){
    var dy=dfl*(dh/(dn+0.5));
    bandAround(K,px,pz,sw,sd,dy-0.17,0.14,0.05);                     /* 在阳台板下面（以前和阳台板同高，叠在一起闪） */
    facadeWindows(K,doorFace,px,pz,sw,sd,px-sw/2+0.8,px+sw/2-0.8,dy-1.27,1.4,1.2,3.0,dfl+o.y,dfl===1);     /* 一楼的窗装防盗网 */
    facadeWindows(K,'e',px,pz,sw,sd,pz-sd/2+0.8,pz+sd/2-0.8,dy-1.27,1.2,1.1,3.2,dfl+7,dfl===1);
    facadeWindows(K,'w',px,pz,sw,sd,pz-sd/2+0.8,pz+sd/2-0.8,dy-1.27,1.2,1.1,3.2,dfl+9,dfl===1);
    for(sp2=0;sp2<spans.length;sp2++){
      var sa=(0,$imports.M)(spans[sp2][0]), sb=(0,$imports.M)(spans[sp2][1]), sw3=sb-sa-0.3, sx3=(sa+sb)/2;
      if(sw3<2) continue;
      var fz3=pz+bs*sd/2;
      facadeWindows(K,balFace,px,pz,sw,sd,sa+0.6,sb-0.6,dy-1.20,1.0,2.0,3.5,dfl+o.x);   /* 阳台门 */
      K.box('concrete',sx3,dy,fz3+bs*0.55,sw3,0.16,1.1,0xd2cdc5,1.0);                    /* 阳台板 */
      K.rod('metal',sx3-sw3*0.49,dy+0.52,fz3+bs*1.05,sx3+sw3*0.49,dy+0.52,fz3+bs*1.05,0.03,0.03,6,0x3a444a,1.05);
      K.rod('metal',sx3-sw3*0.49,dy+0.20,fz3+bs*1.05,sx3+sw3*0.49,dy+0.20,fz3+bs*1.05,0.02,0.02,4,0x3a444a,1.0);
      var dp, dpn=Math.max(6,Math.round(sw3/0.7));
      for(dp=0;dp<=dpn;dp++){ var bxp=sx3-sw3*0.49+(sw3*0.98/dpn)*dp; K.rod('metal',bxp,dy+0.08,fz3+bs*1.05,bxp,dy+0.52,fz3+bs*1.05,0.012,0.012,4,0x3a444a,1.0); }
      K.rod('metal',sx3-sw3*0.42,dy+1.55,fz3+bs*0.72,sx3+sw3*0.42,dy+1.55,fz3+bs*0.72,0.012,0.012,4,0xb8b2a8,1.0);   /* 晾衣杆 */
      var cl, cn3=Math.max(2,Math.round(sw3/5));
      for(cl=0;cl<cn3;cl++){
        if((0,$imports.hash2)(dfl*7+cl,o.x)<0.35) continue;
        var ccx=sx3-sw3*0.40+cl*(sw3*0.80/Math.max(1,cn3-1));
        K.rod('metal',ccx-0.24,dy+1.52,fz3+bs*0.72,ccx+0.24,dy+1.52,fz3+bs*0.72,0.008,0.008,4,0x8a8a8a);   /* 衣架 */
        K.bevel('fabric',ccx,dy+1.16,fz3+bs*0.72,0.50,0.70,0.05,[0x5a6c7a,0x7a6a5a,0x6a7a64,0x8a7a80,0x6a6a7a][(cl+dfl)%5],1.0,0.02);   /* 校服 */
      }
    }
  }
  addEntrance(K,grp,px,pz,sw,sd,o.door||'s',false,BLD_NAME[o.id]);
}
/* ---- 钟楼：砖砌塔身、两道竖长窗、四面钟、四柱亭子、攒尖顶，里面吊着钟 ---- */
function bldBell(K,grp,o,px,pz,sw,sd){
  var bh=19.0, bTop=15.2, fs2, f;
  facadeDoor(o,px,pz,sw,sd,'big');
  K.box('brick',px,bTop/2,pz,sw,bTop,sd,$imports.BRICK,0.98);
  plinthAround(K,px,pz,sw,sd,1.6,0.17,$imports.STONE);
  var FACES=['s','n','e','w'];
  for(f=0;f<4;f++){
    var face=FACES[f], horiz=(face==='s'||face==='n'), sg=(face==='s'||face==='e')?1:-1;
    var gsv=FAC.gap; FAC.gap=null;                                                       /* 只看贴没贴着别的楼：开门的那一面窗和钟面照画（以前被门洞的避让一起挡掉了） */
    var blk=facadeBlocked(face,(horiz?px:pz)-1,(horiz?px:pz)+1,3,bTop); FAC.gap=gsv;
    if(blk) continue;                                                                    /* 贴着教学楼的那一面看不见，不画窗和钟面 */
    var twn='tower_window_'+Math.round((horiz?sw:sd)*0.20*100);
    for(fs2=0;fs2<2;fs2++){
      var off=(fs2?0.28:-0.28)*(horiz?sw:sd);
      if(K.asset(twn,horiz?px+off:px+sg*sw/2,bTop*0.31,horiz?pz+sg*sd/2:pz+off,FACE_ROT[face])) continue;   /* 尖拱窗：石窗套、铁窗棂 */
      var wx=horiz?px+off:px+sg*(sw/2+0.02), wz=horiz?pz+sg*(sd/2+0.02):pz+off;
      var wsz=horiz?[sw*0.20,0.04]:[0.04,sd*0.20];
      K.box('dark',wx,bTop*0.56,wz,wsz[0],bTop*0.50,wsz[1],$imports.WIN_DARK,1.0);
      K.box('stone',wx,bTop*0.31,wz+(horiz?sg*0.06:0),horiz?sw*0.24:0.14,0.10,horiz?0.14:sd*0.24,0xd8d4cb,1.0);
      K.cyl('stone',wx,bTop*0.81,wz,horiz?sw*0.11:0.05,0.02,0.4,8,0xd8d4cb,1.0);       /* 窗顶的尖拱 */
    }
    /* 钟面 */
    var cxp=horiz?px:px+sg*(sw/2+0.05), czp=horiz?pz+sg*(sd/2+0.05):pz;
    var cr=Math.min(sw,sd)*0.20;
    if(K.asset('tower_clock',horiz?px:px+sg*sw/2,13.4,horiz?pz+sg*sd/2:pz,FACE_ROT[face],{s:(cr+0.18)/1.18})) continue;   /* 钟面：罗马数字，停在十二点十八分 */
    if(horiz) K.rod('stone',cxp,13.4,czp,cxp,13.4,czp+sg*0.12,cr+0.18,cr+0.18,16,0xc8a24a,1.15);
    else K.rod('stone',cxp,13.4,czp,cxp+sg*0.12,13.4,czp,cr+0.18,cr+0.18,16,0xc8a24a,1.15);
    if(horiz) K.rod('paper',cxp,13.4,czp+sg*0.12,cxp,13.4,czp+sg*0.14,cr,cr,16,0xe8e2d0,1.0);
    else K.rod('paper',cxp+sg*0.12,13.4,czp,cxp+sg*0.14,13.4,czp,cr,cr,16,0xe8e2d0,1.0);
    var hx=horiz?0:sg*0.16, hz=horiz?sg*0.16:0;
    K.rod('dark',cxp+hx,13.4,czp+hz,cxp+hx+(horiz?0:0),13.4+cr*0.7,czp+hz,0.025,0.02,4,0x1a1a1a);   /* 时针停在十二点 */
    K.rod('dark',cxp+hx,13.4,czp+hz,cxp+hx+(horiz?cr*0.5:0),13.4-cr*0.2,czp+hz+(horiz?0:cr*0.5),0.02,0.015,4,0x1a1a1a);
  }
  bandAround(K,px,pz,sw,sd,bTop-0.1,0.3,0.10);
  var pv2;
  for(pv2=0;pv2<4;pv2++){
    var ax2=px+((pv2&1)?1:-1)*(sw/2-0.5), az2=pz+((pv2&2)?1:-1)*(sd/2-0.5);
    K.bevel('brick',ax2,(bTop+bh)/2,az2,0.7,bh-bTop,0.7,$imports.BRICK,1.0,0.05);
  }
  K.box('concrete',px,bTop+0.05,pz,sw*0.96,0.1,sd*0.96,0x9a948a,1.0);
  K.bevel('stone',px,bTop+1.1,pz,sw*0.98,0.22,sd*0.98,0xc9c4bb,1.05,0.03);          /* 亭台栏板 */
  var bk;
  for(bk=0;bk<8;bk++){ var ba=bk/8*6.283; K.cyl('stone',px+Math.cos(ba)*sw*0.36,bTop+0.1,pz+Math.sin(ba)*sd*0.36,0.06,0.06,0.9,6,0xc9c4bb,1); }
  K.bevel('concrete',px,bh+0.18,pz,sw*1.12,0.36,sd*1.12,0x8a5a52,1.0,0.06);          /* 檐 */
  if(!(Math.abs(sw*1.12-12.95)<0.1&&Math.abs(sd*1.12-23.40)<0.1&&K.asset('bell_roof',px,bh+0.36,pz,0))){   /* 庑殿顶（按这座钟楼的平面建模） */
    K.frame(px,pz,Math.PI/4);
    K.cyl('concrete',0,bh+0.36,0,Math.max(sw,sd)*0.80,0.08,3.0,4,0x7a4c46,1.0);          /* 攒尖顶 */
    K.unframe();
    K.rod('metal',px,bh+3.3,pz,px,bh+4.6,pz,0.05,0.02,6,0xc8a24a,1.2);                   /* 宝顶 */
  }
  if(!K.asset('bell_bronze',px,bTop-0.10,pz,0,{s:1.21}))                                 /* 亭子里吊着的钟（钟楼里那口铜钟放大） */
    K.cyl('metal',px,bTop+1.6,pz,0.85,0.45,1.3,12,0x6e5228,1.0);
  K.rod('metal',px,bTop+2.75,pz,px,bh,pz,0.04,0.04,4,0x2a2018);
  addEntrance(K,grp,px,pz,sw,sd,o.door||'s',false,null);
}
/* ---- 食堂：两层，大窗 ---- */
function bldCanteen(K,grp,o,px,pz,sw,sd){
  var h=OBLD_H.canteen;
  facadeDoor(o,px,pz,sw,sd,'big');
  K.box('brick',px,h/2,pz,sw,h,sd,$imports.BRICK,0.97);
  plinthAround(K,px,pz,sw,sd,0.9,0.10,$imports.BASE_GREY);
  K.box('plaster',px,h+0.16,pz,sw-0.02,0.32,sd-0.02,$imports.WHITEBAND,1.0);
  K.bevel('stone',px,h+0.40,pz,sw+0.2,0.08,sd+0.2,0xd8d4cb,1.0,0.02);
  bandAround(K,px,pz,sw,sd,4.3,0.20,0.06);
  lightningBelt(K,px,pz,sw+0.2,sd+0.2,h+0.44);
  var fl;
  for(fl=0;fl<2;fl++){
    var fy=fl?6.2:2.0;
    facadeWindows(K,'w',px,pz,sw,sd,pz-sd/2+0.6,pz+sd/2-0.6,fy,2.4,1.8,3.4,fl+3);
    facadeWindows(K,'e',px,pz,sw,sd,pz-sd/2+0.6,pz+sd/2-0.6,fy,2.4,1.8,3.4,fl+5);
  }
  /* 排油烟罩：挂在东墙（以前在北墙，北墙贴着宿舍，罩子一半埋进宿舍楼里） */
  if(!K.asset('exhaust_hood',px+sw/2,h-1.6,pz+sd*0.25,Math.PI/2)){
    K.bevel('metal',px+sw/2+0.4,h-1.0,pz+sd*0.25,0.8,1.2,1.2,0xb8bcbe,1.0,0.03);
    K.cyl('metal',px+sw/2+0.4,h-0.4,pz+sd*0.25,0.25,0.25,1.6,8,0x9aa0a4,1.0);
  }
  addEntrance(K,grp,px,pz,sw,sd,o.door||'s',false,BLD_NAME[o.id]);
}
/* ---- 小平房：保安岗、器材室、垃圾站 ---- */
function bldSmall(K,grp,o,px,pz,sw,sd){
  var h=OBLD_H[o.id]!==undefined?OBLD_H[o.id]:11.5;
  var body=(o.id==='trash')?0xa8aca0:$imports.BRICK;
  facadeDoor(o,px,pz,sw,sd,'small');
  K.box(o.id==='trash'?'concrete':'brick',px,h/2,pz,sw,h,sd,body,0.97);
  plinthAround(K,px,pz,sw,sd,h*0.24,0.08,$imports.BASE_GREY);
  K.bevel('concrete',px,h+0.12,pz,sw+0.6,0.24,sd+0.6,0xc9c4bb,1.0,0.04);             /* 挑出来的屋面板 */
  K.box('plaster',px,h-0.06,pz,sw*1.002,0.12,sd*1.002,$imports.WHITEBAND,1.0);
  var face=o.door||'s';
  if(o.id==='guard'){
    facadeWindows(K,'n',px,pz,sw,sd,px-sw/2+0.6,px+sw/2-0.6,1.8,1.8,1.2,2.2,1);      /* 朝校门的大窗 */
    facadeWindows(K,'w',px,pz,sw,sd,pz-sd/2+0.6,pz+sd/2-0.6,1.8,1.4,1.0,2.4,2);
    K.box('emit',px,h+0.10,pz-sd/2-0.31,1.2,0.12,0.02,0xd84a3a,0.4);
  }else if(o.id==='trash'){
    var k; for(k=0;k<6;k++) K.box('metal',px,1.6+k*0.18,pz-sd/2-0.03,sw*0.5,0.04,0.06,0x6a7068,1.0);   /* 百叶 */
  }else{
    facadeWindows(K,'e',px,pz,sw,sd,pz-sd/2+0.8,pz+sd/2-0.8,2.4,1.6,0.9,3.0,3);
    facadeWindows(K,'n',px,pz,sw,sd,px-sw/2+0.8,px+sw/2-0.8,2.4,1.6,0.9,3.0,4);
  }
  addSmallDoor(K,px,pz,sw,sd,face);
  if(BLD_NAME[o.id]){
    var m=signMesh(BLD_NAME[o.id],Math.min(2.2,sw*0.5),0.34,'#e8e4de','#8b3a2e');
    var hz=(face==='s'||face==='n'), sg=(face==='s'||face==='e')?1:-1;
    placeSign(grp,m,hz?px+Math.min(1.6,sw*0.3):px,h-0.55,hz?pz:pz+Math.min(1.6,sd*0.3),face,(hz?sd:sw)/2+0.02);
  }
}
/* ---- 电动车棚：钢柱、波纹顶、一排车 ---- */
function bldShed(K,o,px,pz,sw,sd){
  /* 钢架和车位的位置来自 content/structure-recipe.js，碰撞用同一份（以前碰撞是整块屋顶，棚下走不进去） */
  var hgt=OBLD_H.shed, L=(0,$imports.shedLayout)(px,pz,sw,sd);
  if(Math.abs(sw-8)<0.3&&$imports.Assets.has('shed_frame')){
    /* 门式钢架、一米一段的波纹板屋面（按棚长等分、略拉伸）、隔几根柱子一个充电箱；车棚宽 8 米（模型按这个尺寸建的） */
    L.frames.forEach(function(fz,sc){
      K.asset('shed_frame',px,0,fz,0);
      if(sc%3===1) K.asset('shed_charger',L.colX[1],0,fz,-Math.PI/2);
    });
    var nm=Math.max(1,Math.round(sd)), ml=sd/nm, mk;
    for(mk=0;mk<nm;mk++) K.asset('shed_roof_1m',px,0,pz-sd/2+(mk+0.5)*ml,Math.PI/2,{sx:ml});
  }else
  L.frames.forEach(function(szz){
    K.cyl('metal',L.colX[0],0,szz,0.09,0.09,hgt,8,0x2b343b,1.06);
    K.cyl('metal',L.colX[1],0,szz,0.09,0.09,hgt-0.4,8,0x2b343b,1.06);
    K.rod('metal',L.colX[0],hgt,szz,L.colX[1],hgt-0.4,szz,0.06,0.06,6,0x2b343b);
  });
  var rb, rn=Math.round(sw/0.5);
  if(!(Math.abs(sw-8)<0.3&&$imports.Assets.has('shed_frame')))
  for(rb=0;rb<rn;rb++){                                                               /* 波纹板 */
    var rx=px-sw/2+(rb+0.5)*sw/rn, ry=hgt+0.06-(rb+0.5)/rn*0.4;
    K.box('metal',rx,ry+(rb%2?0.03:0),pz,sw/rn+0.01,0.03,sd,0x3a4a52,rb%2?1.05:0.95);
  }
  L.bikes.forEach(function(b){
    var bcol=[0x3a4a5a,0x6a2a2a,0xd8d4cc,0x2a2e33,0x4a6a4a][b.i%5];
    if(!K.asset('ebike',b.x,0,b.z,0,{tint:{body:bcol}})) ebikeModel(K,b.x,b.z,0,bcol,(0,$imports.lodLow)());
  });
}
/* 电动车：后半截车身（座垫下面是电池仓）、前面的护板、踏板、两个小轮子、车把和后视镜。车头朝局部 +x */
function ebikeModel(K,x,z,rot,col,low){
  K.frame(x,z,rot);
  var k;
  K.prism('plastic',0,0,0,[[-0.70,0.34],[-0.10,0.34],[-0.10,0.56],[-0.30,0.80],[-0.66,0.80],[-0.76,0.58]],0.30,col,1.0,0.04);
  K.prism('plastic',0,0,0,[[0.30,0.30],[0.52,0.30],[0.60,0.56],[0.52,1.00],[0.42,1.00],[0.34,0.56]],0.34,col,1.04,0.04);   /* 前护板 */
  K.box('plastic',0.10,0.33,0,0.44,0.05,0.30,0x2a2e33,1.0);                          /* 踏板 */
  K.bevel('fabric',-0.40,0.84,0,0.56,0.08,0.28,0x1a1a1a,1.0,0.03);                    /* 座垫 */
  K.box('emit',-0.765,0.70,0,0.01,0.06,0.16,0x7a1c16,1.0);                            /* 尾灯 */
  K.box('emit',0.565,0.82,0,0.01,0.08,0.14,0xd8e0e4,0.7);                             /* 大灯 */
  var seg=low?8:14;
  for(k=-1;k<=1;k+=2){
    var wx=k<0?-0.52:0.62;
    K.rod('dark',wx,0.24,-0.05,wx,0.24,0.05,0.24,0.24,seg,0x111418,1.0);              /* 轮胎 */
    K.rod('metal',wx,0.24,-0.055,wx,0.24,0.055,0.13,0.13,seg,0x8a9298,1.1);           /* 轮毂 */
  }
  K.rod('metal',0.48,0.96,0,0.54,1.10,0,0.02,0.02,6,0x2a2e33,1.0);                    /* 车把立管 */
  K.rod('metal',0.54,1.10,-0.32,0.54,1.10,0.32,0.016,0.016,6,0x2a2e33,1.0);           /* 车把 */
  for(k=-1;k<=1;k+=2){
    K.rod('plastic',0.54,1.10,k*0.30,0.54,1.10,k*0.36,0.022,0.022,6,0x15181a,1.0);    /* 把套 */
    if(!low){ K.rod('metal',0.54,1.10,k*0.22,0.50,1.32,k*0.26,0.006,0.006,4,0x2a2e33,1.0);
      K.bevel('plastic',0.50,1.34,k*0.27,0.03,0.07,0.10,0x15181a,1.0,0.01); }         /* 后视镜 */
  }
  K.unframe();
}
/* ---- 连廊：每层一条走道，两侧玻璃 + 栏杆，柱子落地 ---- */
function bldLink(K,o,px,pz,sw,sd){
  var lv, flr=3.2;
  for(lv=0;lv<5;lv++){
    var ly=flr*(lv+1);
    K.box('concrete',px,ly-0.16,pz,sw,0.32,sd,$imports.BRICK,1.02);
    K.box('plaster',px,ly-0.34,pz,sw*0.99,0.06,sd*0.99,$imports.WHITEBAND,1.0);
    if(lv<4){
      var rn=Math.max(3,Math.round(sd/1.15)), rk;
      for(rk=0;rk<=rn;rk++){
        var rz2=pz-sd/2+(sd/rn)*rk;
        K.rod('metal',px-sw/2+0.10,ly,rz2,px-sw/2+0.10,ly+1.10,rz2,0.03,0.03,5,0x8b3a2e,1.06);
        K.rod('metal',px+sw/2-0.10,ly,rz2,px+sw/2-0.10,ly+1.10,rz2,0.03,0.03,5,0x8b3a2e,1.06);
      }
      K.rod('metal',px-sw/2+0.10,ly+1.08,pz-sd/2,px-sw/2+0.10,ly+1.08,pz+sd/2,0.05,0.05,6,0x7a3226,1.0);
      K.rod('metal',px+sw/2-0.10,ly+1.08,pz-sd/2,px+sw/2-0.10,ly+1.08,pz+sd/2,0.05,0.05,6,0x7a3226,1.0);
      K.box('glass',px-sw/2+0.06,ly+1.95,pz,0.02,1.4,sd*0.98,0x9fb0ba,1.1);
      K.box('glass',px+sw/2-0.06,ly+1.95,pz,0.02,1.4,sd*0.98,0x9fb0ba,1.1);
    }
  }
  /* 落地柱：位置来自 content/structure-recipe.js，碰撞用同一份 */
  (0,$imports.linkPillars)(px,pz,sw,sd).forEach(function(c){ K.bevel('brick',c.x,8.0,c.z,0.42,16.0,0.42,$imports.BRICK,0.94,0.03); });
  K.bevel('concrete',px,16.20,pz,sw*1.02,0.30,sd*1.02,0x8b3a2e,1.0,0.04);
}
/* ---- 地下车库车道：两侧矮墙 + 一段往下斜的坡 + 门头 ---- */
function garageRamp(K,px,pz,sw,sd){
  var x0=px-sw/2, x1=px+sw/2;
  K.bevel('concrete',px,0.45,pz-sd/2+0.15,sw,0.9,0.3,0xb8b2a8,1.0,0.03);
  K.bevel('concrete',px,0.45,pz+sd/2-0.15,sw,0.9,0.3,0xb8b2a8,1.0,0.03);
  K.box('concrete',x0+0.15,1.2,pz,0.3,2.4,sd,0xb8b2a8,1.0);
  var n=12, i;
  for(i=0;i<n;i++){
    var t0=i/n, h=-0.05-(1-t0)*2.6;
    K.box('concrete',x0+0.3+(i+0.5)*(sw-0.3)/n,h,pz,(sw-0.3)/n+0.02,0.1,sd-0.6,0x2b3339,1.0);
    K.box('decal',x0+0.3+(i+0.5)*(sw-0.3)/n,h+0.055,pz,0.10,0.01,sd-0.6,0xc8b24a,1.1);
  }
  K.box('dark',x0+1.4,1.3,pz,2.4,2.6,sd-0.6,0x05080a,1.0);
  K.bevel('concrete',x0+3.0,2.8,pz,3.6,0.24,sd+0.4,0xc9c4bb,1.05,0.04);
  K.box('plastic',x0+3.0,3.3,pz+sd/2+0.25,3.4,0.6,0.08,0x1d3a5a,1.1);
  if(K.asset('barrier_cabinet',x1-0.4,0,pz-sd/2+0.8,0)){                             /* 道闸：机箱是模型，拦杆红白相间按车道宽画 */
    var az0=pz-sd/2+0.8+0.30, az1=pz+sd/2-0.8, an=Math.max(2,Math.round((az1-az0)/0.5)), al=(az1-az0)/an, ak;
    for(ak=0;ak<an;ak++) K.bevel('plastic',x1-0.4,0.85,az0+(ak+0.5)*al,0.04,0.09,al,ak%2?0xe8e8e2:0xd84a3a,1.05,0.008);
    K.box('plastic',x1-0.4,0.85,az1+0.01,0.05,0.10,0.02,0x2a2e30,1.0);
  }else{
  K.cyl('metal',x1-0.4,0,pz-sd/2+0.8,0.08,0.08,1.1,8,0x8a9298,1.0);                   /* 道闸 */
  K.bevel('metal',x1-0.4,1.2,pz-sd/2+0.8,0.24,0.3,0.24,0xd8d4cc,1.0,0.02);
  K.rod('plastic',x1-0.4,1.2,pz-sd/2+0.8,x1-0.4,1.2,pz+sd/2-0.8,0.04,0.04,6,0xd84a3a,1.1);
  }
}
/* ---- 地下车库人行口：一个玻璃顶的楼梯间 ---- */

/* 一面墙上没被别的楼挡住的区段（地图单位的 x 区间） */
function faceFreeSpans(o,face){
  var fy=(face==='s')?o.y+o.h:o.y, spans=[[o.x,o.x+o.w]], i, j;
  for(i=0;i<$imports.OBJ.length;i++){
    var b=$imports.OBJ[i]; if(b===o||b.k!=='roof') continue;
    if(fy<b.y-2||fy>b.y+b.h+2) continue;
    var out=[];
    for(j=0;j<spans.length;j++){
      var a0=spans[j][0], a1=spans[j][1];
      if(b.x>=a1||b.x+b.w<=a0){ out.push([a0,a1]); continue; }
      if(b.x>a0) out.push([a0,b.x-3]);
      if(b.x+b.w<a1) out.push([b.x+b.w+3,a1]);
    }
    spans=out;
  }
  return spans;
}

/* ---- 球场、操场 ---- */




/* ---- 围墙：毛石基座 + 墙帽 + 铁艺栏杆（立杆顶上有矛尖）；三个校门处留口子 ---- */
function fenceRun(K,fx,fz,len,horiz,noA,noB){   /* noA / noB：这一头挨着校门的门柱，不再立墙柱 */
  if(len<0.3) return;
  var baseH=1.5, railH=1.5, t=0.62, low=(0,$imports.lodLow)();
  function B(m,u,y,s,l,h,d,col,sh){ if(horiz) K.box(m,fx+u,y,fz+s,l,h,d,col,sh); else K.box(m,fx+s,y,fz+u,d,h,l,col,sh); }
  B('stone',0,baseH/2,0,len,baseH,t,$imports.STONE,1.0);
  B('stone',0,baseH+0.06,0,len+0.02,0.12,t+0.10,0x8f938f,1.05);
  if(!low&&$imports.Assets.has('fence_panel_200')){
    /* 石柱、两米一段的铁艺栏杆（矛尖、上下横档）是模型；柱距四米左右，一段段栏杆按柱间净距等分、沿墙拉伸 */
    var pm=Math.max(1,Math.round(len/4)), pr=horiz?0:Math.PI/2, pk, pj;
    for(pk=0;pk<=pm;pk++){ if((pk===0&&noA)||(pk===pm&&noB)) continue; var pu=-len/2+(len/pm)*pk; K.asset('fence_pillar',horiz?fx+pu:fx,0,horiz?fz:fz+pu,pr); }
    for(pk=0;pk<pm;pk++){
      var pa=-len/2+(len/pm)*pk+((pk===0&&noA)?0.02:0.23), pb=-len/2+(len/pm)*(pk+1)-((pk===pm-1&&noB)?0.02:0.23), pc=Math.max(1,Math.round((pb-pa)/2)), pl=(pb-pa)/pc;
      for(pj=0;pj<pc;pj++){ var uc=pa+(pj+0.5)*pl; K.asset('fence_panel_200',horiz?fx+uc:fx,0,horiz?fz:fz+uc,pr,{sx:pl/2}); }
    }
    return;
  }
  B('metal',0,baseH+railH,0,len,0.06,0.06,0x2f6b3f,1.0);
  B('metal',0,baseH+0.30,0,len,0.05,0.05,0x2f6b3f,1.0);
  var n=Math.max(2,Math.round(len/$imports.Quality.get().fenceStep)), k;
  for(k=0;k<=n;k++){
    var u=-len/2+(len/n)*k;
    var spear=$imports.Quality.get().facadeDetail;                                   /* 矛尖只在「精细」及以上画 */
    if(horiz){ K.rod('metal',fx+u,baseH+0.12,fz,fx+u,baseH+railH+0.12,fz,0.016,0.016,4,0x2f6b3f); if(spear) K.cyl('metal',fx+u,baseH+railH+0.12,fz,0.03,0.0,0.12,4,0x2f6b3f); }
    else { K.rod('metal',fx,baseH+0.12,fz+u,fx,baseH+railH+0.12,fz+u,0.016,0.016,4,0x2f6b3f); if(spear) K.cyl('metal',fx,baseH+railH+0.12,fz+u,0.03,0.0,0.12,4,0x2f6b3f); }
  }
  var m2=Math.max(1,Math.round(len/4));
  for(k=0;k<=m2;k++){
    if((k===0&&noA)||(k===m2&&noB)) continue;
    var u2=-len/2+(len/m2)*k;
    if(horiz) K.bevel('stone',fx+u2,(baseH+railH+0.25)/2,fz,0.42,baseH+railH+0.25,0.70,0xa8a296,1.0,0.03);
    else K.bevel('stone',fx,(baseH+railH+0.25)/2,fz+u2,0.70,baseH+railH+0.25,0.42,0xa8a296,1.0,0.03);
  }
}
function fenceSide(K,horiz,fixed,a0,a1,gaps){
  gaps=gaps.slice().sort(function(p,q){ return p[0]-q[0]; });
  var cur=a0, gi, ng=$imports.Assets.has('gate_pillar');
  for(gi=0;gi<gaps.length;gi++){
    var g0=gaps[gi][0]-gaps[gi][1], g1=gaps[gi][0]+gaps[gi][1];
    if(g0>cur){ if(horiz) fenceRun(K,(cur+g0)/2,fixed,g0-cur,true,ng&&cur>a0,ng); else fenceRun(K,fixed,(cur+g0)/2,g0-cur,false,ng&&cur>a0,ng); }
    cur=Math.max(cur,g1);
  }
  if(a1>cur){ if(horiz) fenceRun(K,(cur+a1)/2,fixed,a1-cur,true,ng&&cur>a0,false); else fenceRun(K,fixed,(cur+a1)/2,a1-cur,false,ng&&cur>a0,false); }
}
/* 校门：vert=true 时门开在东西两侧的墙上 */
function gateModel(K,grp,wx,wy,wide,tallSign,vert,name){
  var gx=wx*$imports.SC*$imports.U2M, gz=wy*$imports.SC*$imports.U2M;
  K.frame(gx,gz,vert?Math.PI/2:0);
  var pw=0.70, ph=tallSign?4.6:3.0;
  if($imports.Assets.has('gate_pillar')){
    /* 门柱（正门的高到门头梁）、一段段的铁栅门（金色矛尖）、三辊闸、侧门上锁着的铁链和挂锁是模型 */
    var pn=tallSign?'gate_pillar_tall':'gate_pillar', gw=wide*0.60, g0=-wide/2+pw*0.5, gn=Math.max(1,Math.round(gw/1.2)), gl=gw/gn, gk;
    K.asset(pn,-wide/2,0,0,0); K.asset(pn,wide/2,0,0,0);
    for(gk=0;gk<gn;gk++) K.asset('gate_leaf_120',g0+(gk+0.5)*gl,0,0,0,{sx:gl/1.2});
    if(tallSign){
      for(gk=0;gk<3;gk++) K.asset('turnstile',g0+gw+0.9+gk*1.05,0,0,0);
      K.bevel('stone',0,ph+0.95,0,wide-pw+0.1,0.80,0.24,0xe8e4de,1.10,0.03);                /* 门头梁：两头搭进门柱 */
      var sg1=signMesh('武汉大学附属中学',wide*0.80,0.58,'#8b3a2e','#f0dca8'), sg2=signMesh('武汉大学附属中学',wide*0.80,0.58,'#8b3a2e','#f0dca8');
      var gc=Math.cos(vert?Math.PI/2:0), gs=Math.sin(vert?Math.PI/2:0);
      sg1.position.set(gx+0.13*gs,ph+0.95,gz+0.13*gc); sg1.rotation.y=vert?Math.PI/2:0; grp.add(sg1);
      sg2.position.set(gx-0.13*gs,ph+0.95,gz-0.13*gc); sg2.rotation.y=(vert?Math.PI/2:0)+Math.PI; grp.add(sg2);
    }else{
      K.bevel('stone',0,ph+0.25,0,wide+0.3,0.22,0.5,0xa8a296,1.05,0.03);
      K.asset('padlock_chain',g0+gw-0.04,1.15,0.0,0);
    }
    K.box('stone',0,0.05,0,wide*1.05,0.10,1.6,0x8a8a86,1.0);                              /* 门槛石 */
    K.unframe();
    return;
  }
  K.bevel('stone',-wide/2,ph/2,0,pw,ph,pw,0xc9c2b4,1.05,0.04);
  K.bevel('stone', wide/2,ph/2,0,pw,ph,pw,0xc9c2b4,1.05,0.04);
  K.bevel('stone',-wide/2,ph+0.10,0,pw*1.3,0.20,pw*1.3,0xa8a296,1.05,0.03);
  K.bevel('stone', wide/2,ph+0.10,0,pw*1.3,0.20,pw*1.3,0xa8a296,1.05,0.03);
  var doorW=wide*0.60, d0=-wide/2+pw*0.5;
  K.rod('metal',d0,1.30,0,d0+doorW,1.30,0,0.04,0.04,6,0x3d474f);                      /* 伸缩门 / 铁栅门 */
  K.rod('metal',d0,2.40,0,d0+doorW,2.40,0,0.04,0.04,6,0x3d474f);
  K.box('metal',d0+doorW/2,0.20,0,doorW,0.14,0.14,0x3d474f,1);
  var bars=Math.max(6,Math.round(doorW/0.30)), bi;
  for(bi=0;bi<=bars;bi++){ var bxx=d0+(doorW/bars)*bi; K.rod('metal',bxx,0.2,0,bxx,2.5,0,0.022,0.022,5,0x2b333a); K.cyl('metal',bxx,2.5,0,0.04,0,0.12,4,0xc8a24a); }
  if(tallSign){
    var tx0=d0+doorW+0.9, ti;                                                           /* 闸机：三道 */
    for(ti=0;ti<3;ti++){
      var tu=tx0+ti*1.05;
      K.bevel('metal',tu,0.52,0,0.28,1.04,0.95,0x8a9298,1.08,0.03);
      K.box('dark',tu,1.05,-0.30,0.24,0.04,0.10,0x2b3b44,1.0);
      K.box('emit',tu,1.02,-0.30,0.10,0.04,0.06,0x39c08a,1.0);
      K.rod('metal',tu+0.14,0.82,0,tu+0.60,0.82,0,0.02,0.02,5,0x9aa0a4,1.1);
    }
    K.bevel('stone',0,ph+0.95,0,wide*0.92,0.80,0.24,0xe8e4de,1.10,0.03);              /* 门头 */
    var sm=signMesh('武汉大学附属中学',wide*0.80,0.58,'#8b3a2e','#f0dca8');
    var sm2=signMesh('武汉大学附属中学',wide*0.80,0.58,'#8b3a2e','#f0dca8');
    var c=Math.cos(vert?Math.PI/2:0), s=Math.sin(vert?Math.PI/2:0);
    sm.position.set(gx+0.13*s,ph+0.95,gz+0.13*c); sm.rotation.y=vert?Math.PI/2:0; grp.add(sm);
    sm2.position.set(gx-0.13*s,ph+0.95,gz-0.13*c); sm2.rotation.y=(vert?Math.PI/2:0)+Math.PI; grp.add(sm2);
  }else{
    K.bevel('stone',0,ph+0.25,0,wide+0.3,0.22,0.5,0xa8a296,1.05,0.03);
    K.blob('metal',wide*0.25,1.15,0.09,0.06,0.08,0.03,0xc8a24a,1.3,6);                /* 挂锁 */
  }
  K.box('stone',0,0.05,0,wide*1.05,0.10,1.6,0x8a8a86,1.0);                              /* 门槛石 */
  K.unframe();
}

/* 每个地图对象用哪个建模函数：先按 id，再按种类（k），再看是不是有柱廊的教学类楼，最后是小平房。
   以前是一长串 if；加一种楼只要在表里加一行 */
var BLD_BY_ID={
  garage:function(K,grp,o,px,pz,sw,sd){ garageRamp(K,px,pz,sw,sd); },
  garw:  function(K,grp,o,px,pz,sw,sd){ (0,$imports.garagePed)(K,px,pz,sw,sd); },
  teach:  function(K,grp,o,px,pz,sw,sd){ bldTeach(K,grp,o,px,pz,sw,sd); },
  bell:   function(K,grp,o,px,pz,sw,sd){ bldBell(K,grp,o,px,pz,sw,sd); },
  dormN:  function(K,grp,o,px,pz,sw,sd){ bldDorm(K,grp,o,px,pz,sw,sd); },
  canteen:function(K,grp,o,px,pz,sw,sd){ bldCanteen(K,grp,o,px,pz,sw,sd); },
  shed:  function(K,grp,o,px,pz,sw,sd){ bldShed(K,o,px,pz,sw,sd); }
};
var BLD_BY_KIND={
  field: function(K,grp,o,px,pz,sw,sd){ (0,$imports.fieldModel)(K,o,px,pz,sw,sd); },
  court: function(K,grp,o,px,pz,sw,sd){ (0,$imports.courtModel)(K,o,px,pz,sw,sd); },
  link:  function(K,grp,o,px,pz,sw,sd){ bldLink(K,o,px,pz,sw,sd); }
};
BLD_BY_KIND.track=BLD_BY_KIND.court; BLD_BY_KIND.garden=BLD_BY_KIND.court; BLD_BY_ID.dormS=BLD_BY_ID.dormN;
function bldBuilderOf(o){
  return BLD_BY_ID[o.id]||BLD_BY_KIND[o.k]||(o.open1f?function(K,grp,o2,px,pz,sw,sd){ bldClassroom(K,grp,o2,px,pz,sw,sd); }
                                                    :function(K,grp,o2,px,pz,sw,sd){ bldSmall(K,grp,o2,px,pz,sw,sd); });
}
function buildOutdoorGeometry(){
  var K=new $imports.Kit({cull:{floor:0.002},chunk:64,inst:1,sparse:$imports.Quality.get().lod>=2?2:0}), grp=new $imports.THREE.Group(), i; /* 流畅、均衡和精细合并稀疏小物件 */
  var x0=$imports.BOUND.x0*$imports.SC*$imports.U2M, y0=$imports.BOUND.y0*$imports.SC*$imports.U2M;
  var x1=$imports.BOUND.x1*$imports.SC*$imports.U2M, y1=$imports.BOUND.y1*$imports.SC*$imports.U2M;
  var cx=(x0+x1)/2, cz=(y0+y1)/2;
  $imports.OUTX={treeN:0};
  K.solids=[]; K.lamps=[];
  (0,$imports.addOutdoorProps)(K, x0, y0, x1, y1);

  for(i=0;i<$imports.OBJ.length;i++){
    var o=$imports.OBJ[i], ow=(0,$imports.objWorld)(o);
    var px=(ow.x+ow.w/2)*$imports.U2M, pz=(ow.y+ow.h/2)*$imports.U2M;
    var sw=ow.w*$imports.U2M, sd=ow.h*$imports.U2M;
    FAC.o=o; FAC.gap=null;
    if(o.k==='link'&&$imports.DEV_HIDE.link) continue;
    bldBuilderOf(o)(K,grp,o,px,pz,sw,sd);
  }
  FAC.o=null; FAC.gap=null;
  if(!$imports.DEV_HIDE.fence){
    var gN=$imports.GATE_N.x*$imports.SC*$imports.U2M, gWz=$imports.GATE_W.y*$imports.SC*$imports.U2M, gS=$imports.GATE_S.x*$imports.SC*$imports.U2M;
    var NW=12.0, WW=5.0, SW2=5.4;
    gateModel(K,grp,$imports.GATE_N.x,$imports.GATE_N.y,NW,true,false);
    gateModel(K,grp,$imports.GATE_W.x,$imports.GATE_W.y,WW,false,true);
    gateModel(K,grp,$imports.GATE_S.x,$imports.GATE_S.y,SW2,false,false);
    /* 墙段从校门门柱的外侧面开始（端头那根墙柱正好贴着门柱）；东西两侧的墙段从南北墙的外侧面开始，拐角不再两段叠在一起 */
    var GP=$imports.Assets.has('gate_pillar')?0.35+0.07:0.35+0.21, CW=0.36+0.21;   /* 门柱是模型时，墙段从门柱基座外沿开始，挨着门柱的那头不立墙柱 */
    fenceSide(K,true,  y0, x0, x1, [[gN,NW/2+GP]]);
    fenceSide(K,true,  y1, x0, x1, [[gS,SW2/2+GP]]);
    fenceSide(K,false, x0, y0+CW, y1-CW, [[gWz,WW/2+GP]]);
    fenceSide(K,false, x1, y0+CW, y1-CW, []);
  }
  $imports.OUTX.treeN=K.treeN;$imports.OUT_LAMPS=K.lamps;
  K.build(grp);
  try{ (0,$imports.addGrass)(grp); }catch(e){}
  try{ if(!$imports.DEV_HIDE.sign) addGardenSign(grp); }catch(e){}
  return grp;
}

/* @module-exports */
GameModules.publish("game3d/js/model/building.js",{
"OBLD_H":{get:function(){return OBLD_H;},set:function($value){OBLD_H=$value;}},
"BLD_NAME":{get:function(){return BLD_NAME;},set:function($value){BLD_NAME=$value;}},
"SIGN_TEX":{get:function(){return SIGN_TEX;},set:function($value){SIGN_TEX=$value;}},
"signMesh":{get:function(){return signMesh;},set:function($value){signMesh=$value;}},
"placeSign":{get:function(){return placeSign;},set:function($value){placeSign=$value;}},
"FAC":{get:function(){return FAC;},set:function($value){FAC=$value;}},
"objHeightM":{get:function(){return objHeightM;},set:function($value){objHeightM=$value;}},
"facadeDoor":{get:function(){return facadeDoor;},set:function($value){facadeDoor=$value;}},
"facadeBlocked":{get:function(){return facadeBlocked;},set:function($value){facadeBlocked=$value;}},
"plinthAround":{get:function(){return plinthAround;},set:function($value){plinthAround=$value;}},
"facadeWindows":{get:function(){return facadeWindows;},set:function($value){facadeWindows=$value;}},
"FACE_ROT":{get:function(){return FACE_ROT;},set:function($value){FACE_ROT=$value;}},
"downpipe":{get:function(){return downpipe;},set:function($value){downpipe=$value;}},
"lightningBelt":{get:function(){return lightningBelt;},set:function($value){lightningBelt=$value;}},
"solarHeater":{get:function(){return solarHeater;},set:function($value){solarHeater=$value;}},
"bandAround":{get:function(){return bandAround;},set:function($value){bandAround=$value;}},
"acUnit":{get:function(){return acUnit;},set:function($value){acUnit=$value;}},
"roofTop":{get:function(){return roofTop;},set:function($value){roofTop=$value;}},
"addEntrance":{get:function(){return addEntrance;},set:function($value){addEntrance=$value;}},
"addSmallDoor":{get:function(){return addSmallDoor;},set:function($value){addSmallDoor=$value;}},
"addGardenSign":{get:function(){return addGardenSign;},set:function($value){addGardenSign=$value;}},
"linkSpansOn":{get:function(){return linkSpansOn;},set:function($value){linkSpansOn=$value;}},
"bldClassroom":{get:function(){return bldClassroom;},set:function($value){bldClassroom=$value;}},
"bldTeach":{get:function(){return bldTeach;},set:function($value){bldTeach=$value;}},
"bldDorm":{get:function(){return bldDorm;},set:function($value){bldDorm=$value;}},
"bldBell":{get:function(){return bldBell;},set:function($value){bldBell=$value;}},
"bldCanteen":{get:function(){return bldCanteen;},set:function($value){bldCanteen=$value;}},
"bldSmall":{get:function(){return bldSmall;},set:function($value){bldSmall=$value;}},
"bldShed":{get:function(){return bldShed;},set:function($value){bldShed=$value;}},
"ebikeModel":{get:function(){return ebikeModel;},set:function($value){ebikeModel=$value;}},
"bldLink":{get:function(){return bldLink;},set:function($value){bldLink=$value;}},
"garageRamp":{get:function(){return garageRamp;},set:function($value){garageRamp=$value;}},
"faceFreeSpans":{get:function(){return faceFreeSpans;},set:function($value){faceFreeSpans=$value;}},
"fenceRun":{get:function(){return fenceRun;},set:function($value){fenceRun=$value;}},
"fenceSide":{get:function(){return fenceSide;},set:function($value){fenceSide=$value;}},
"gateModel":{get:function(){return gateModel;},set:function($value){gateModel=$value;}},
"BLD_BY_ID":{get:function(){return BLD_BY_ID;},set:function($value){BLD_BY_ID=$value;}},
"BLD_BY_KIND":{get:function(){return BLD_BY_KIND;},set:function($value){BLD_BY_KIND=$value;}},
"bldBuilderOf":{get:function(){return bldBuilderOf;},set:function($value){bldBuilderOf=$value;}},
"buildOutdoorGeometry":{get:function(){return buildOutdoorGeometry;},set:function($value){buildOutdoorGeometry=$value;}}
});
})(GameModules.imports("game3d/js/model/building.js"));
