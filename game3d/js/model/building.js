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
    var i; for(i=0;i<300;i++){ c.globalAlpha=0.05; c.fillStyle=Math.random()>0.5?'#fff':'#000'; c.fillRect(Math.random()*cv.width,Math.random()*cv.height,3,3); }
    c.globalAlpha=1;
    c.fillStyle=fg; c.textAlign='center'; c.textBaseline='middle';
    c.font=(font||'600')+' '+Math.round(cv.height*0.62)+'px "Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif';
    c.fillText(text,cv.width/2,cv.height*0.54,cv.width*0.92);
    t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4;
    SIGN_TEX[key]=t;
  }
  var m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshPhongMaterial({map:t,shininess:0,specular:0x000000}));
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
  for(i=0;i<OBJ.length;i++){
    var b=OBJ[i]; if(b===o||(b.k!=='roof'&&b.k!=='link')) continue;
    var n0=horiz?b.y:b.x, n1=horiz?b.y+b.h:b.x+b.w;
    if(line<n0-2||line>n1+2) continue;                                   /* 不贴着这面墙 */
    var a0=M(horiz?b.x:b.y)-0.4, a1=M(horiz?b.x+b.w:b.y+b.h)+0.4;
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
  var len=u1-u0, n=Math.max(1,Math.floor(len/spacing)), k, low=lodLow(), det=Quality.get().facadeDetail;
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
    if(!low&&Assets.has('fwin_'+wn)){
      /* 窗套、窗台、铝外框、亮子、两扇推拉窗、防盗网是 Blender 的模型（tools/blender/assets/exterior.py）：
         一前一后两条轨，推开的那一边露出屋里；屋里亮不亮灯、拉没拉窗帘还是按位置在这里画 */
      K.frame(horiz?u:plane,horiz?plane:u,FACE_ROT[face]);
      K.asset('fwin_'+wn,0,y,0,0);
      var ssw=(ww-0.08)/2+0.025, ssy=y+(-wh/2+0.04+wh/2-wh*0.24-0.0175)/2;
      var opn=(hash2(seed,11)-0.5)*ww*0.25;
      K.asset('fsash_'+wn,-ww/2+0.04+ssw/2+Math.max(0,opn),ssy,0.048,0);
      K.asset('fsash_'+wn, ww/2-0.04-ssw/2-Math.max(0,-opn),ssy,0.022,Math.PI);
      if(det&&grille) K.asset('fgrille_'+wn,0,y,0,0);
      K.unframe();
      var lit2=(litKey!==undefined&&hash2((u*7)|0,(y*13+litKey)|0)<0.22);
      if(lit2) F('litwin',0,0,0.005,ww*0.96,wh*0.96,0.002,0xffffff,1.0,OUT);
      var cr2=hash2(seed,3);
      if(cr2<0.7){
        var cw2=ww*(0.18+hash2(seed,5)*0.30), cs2=(hash2(seed,7)<0.5)?-1:1, ccol2=[0x8a6a5a,0x5a6a8a,0xb8a888,0x6a7a5a,0x9a5a5a,0xc8c0b0][(seed>>>0)%6];
        F('fabric',cs2*(ww/2-cw2/2),0,0.007,cw2,wh*0.98,0.002,lit2?shadeHex(ccol2,1.5):ccol2,lit2?1.0:0.7,OUT);
        if(cr2<0.25) F('fabric',-cs2*(ww/2-cw2*0.3),0,0.007,cw2*0.6,wh*0.98,0.002,lit2?shadeHex(ccol2,1.5):ccol2,lit2?1.0:0.7,OUT);
      }
      continue;
    }
    if(low){                                                       /* 流畅档：平贴的窗，和以前一样 */
      B('plaster',0,0.02,0.010,ww+0.18,wh+0.18,0.02,WHITEBAND,1.0);
      B('dark',0,0,0.022,ww,wh,0.01,WIN_DARK,1.0);
      B('stone',0,-wh/2-0.035,0.07,ww+0.26,0.07,0.14,0xd8d4cb,1.05);              /* 窗台紧贴窗下沿，和模型的窗台一样高 */
      if(litKey!==undefined&&hash2((u*7)|0,(y*13+litKey)|0)<0.22) B('litwin',0,0,0.036,ww*0.92,wh*0.92,0.004,0xffffff,1.0);
      continue;
    }
    /* 窗套：凸出墙面 10 厘米的白色线脚，窗户缩在里面，有进深、有阴影 */
    var fw=0.09, dep=0.10;
    F('plaster',0,wh/2+fw/2,dep/2,ww+fw*2,fw,dep,WHITEBAND,1.0);
    F('plaster',-(ww/2+fw/2),0,dep/2,fw,wh,dep,WHITEBAND,0.96);
    F('plaster', (ww/2+fw/2),0,dep/2,fw,wh,dep,WHITEBAND,0.96);
    F('stone',0,-wh/2-0.035,0.085,ww+0.30,0.07,0.17,0xd8d4cb,1.05);            /* 窗台：再往外挑一点 */
    F('dark',0,0,0.004,ww,wh,0.008,WIN_DARK,1.0,OUT);                           /* 屋里：暗的 */
    var lit=(litKey!==undefined&&hash2((u*7)|0,(y*13+litKey)|0)<0.22);
    if(lit) F('litwin',0,0,0.010,ww*0.96,wh*0.96,0.002,0xffffff,1.0,OUT);
    /* 屋里的窗帘：大半拉在一边，颜色各家不同 */
    var cr=hash2(seed,3);
    if(cr<0.7){
      var cw=ww*(0.18+hash2(seed,5)*0.30), cs=(hash2(seed,7)<0.5)?-1:1, ccol=[0x8a6a5a,0x5a6a8a,0xb8a888,0x6a7a5a,0x9a5a5a,0xc8c0b0][(seed>>>0)%6];
      F('fabric',cs*(ww/2-cw/2),0,0.013,cw,wh*0.98,0.002,lit?shadeHex(ccol,1.5):ccol,lit?1.0:0.7,OUT);
      if(cr<0.25) F('fabric',-cs*(ww/2-cw*0.3),0,0.013,cw*0.6,wh*0.98,0.002,lit?shadeHex(ccol,1.5):ccol,lit?1.0:0.7,OUT);
    }
    /* 铝合金推拉窗：外框、上面一条固定亮子、两扇推拉扇一前一后，中间的碰头梃 */
    var mc=0xb8bcbc, fb=0.04, z0=0.03;
    F('metal',0,wh/2-fb/2,z0,ww,fb,0.04,mc,1.05);
    F('metal',0,-wh/2+fb/2,z0,ww,fb,0.04,mc,1.0);
    F('metal',-ww/2+fb/2,0,z0,fb,wh-fb*2,0.04,mc,1.0);
    F('metal', ww/2-fb/2,0,z0,fb,wh-fb*2,0.04,mc,1.0);
    var ty=wh/2-wh*0.24;
    F('metal',0,ty,z0,ww-fb*2,0.035,0.04,mc,1.05);                                   /* 亮子横档 */
    var open=(hash2(seed,11)-0.5)*ww*0.25;                                          /* 推开了一点 */
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
  if(Assets.has('dp_clamp')){                       /* 雨水斗、管卡、下口和接水簸箕是模型，管子按楼高画 */
    K.frame(horiz?u:plane,horiz?plane:u,FACE_ROT[face]);
    K.asset('dp_shoe',0,0,0,0);
    K.rod('plastic',0,0.38,0.16,0,top-0.33,0.16,0.055,0.055,lodLow()?8:12,0xd8d6d0,1.0);
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
  if(lodLow()) return;
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
  var k, n=lodLow()?6:12, w=1.9;
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
function bandAround(K,px,pz,sw,sd,y,h,out,col){
  var F=[['s',px,pz+sd/2+out/2,sw+out*2,true],['n',px,pz-sd/2-out/2,sw+out*2,true],
         ['e',px+sw/2+out/2,pz,sd,false],['w',px-sw/2-out/2,pz,sd,false]], i, g=FAC.gap;
  for(i=0;i<4;i++){
    var f=F[i], len=f[3], c0=f[4]?f[1]:f[2], segs=[[c0-len/2,c0+len/2]];
    if(g&&g.face===f[0]&&y-h/2<g.top) segs=[[c0-len/2,g.c-g.wide],[g.c+g.wide,c0+len/2]];   /* 门头那一段断开 */
    segs.forEach(function(sg){
      var L=sg[1]-sg[0], m=(sg[0]+sg[1])/2; if(L<0.05) return;
      if(f[4]) K.box('plaster',m,y,f[2],L,h,out,col||WHITEBAND,1.0);
      else K.box('plaster',f[1],y,m,out,h,L,col||WHITEBAND,1.0);
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
  var hx=px+sw*0.28*(hash2(seed,3)>0.5?1:-1), hz=pz-sd*0.12;
  if(Assets.has('roof_stairhouse')){                 /* 楼梯间（门、爬梯、百叶）、水箱、楼梯间顶上的电视天线 */
    K.asset('roof_stairhouse',hx,top,hz,0);
    K.asset('roof_tank',px-sw*0.30*(hash2(seed,5)>0.5?1:-1),top,pz+sd*0.10,hash2(seed,9)*6.283);
    K.asset('roof_antenna',hx+0.25,top+2.97,hz-0.15,hash2(seed,13)*6.283);
    return;
  }
  K.bevel('brick',hx,top+1.4,hz,3.2,2.8,3.0,BRICK,0.96,0.04);
  K.box('plaster',hx,top+2.86,hz,3.4,0.12,3.2,WHITEBAND,1.0);
  K.box('dark',hx,top+1.05,hz+1.505,0.9,2.0,0.02,0x2a3136,1.0);
  K.cyl('metal',px-sw*0.30*(hash2(seed,5)>0.5?1:-1),top,pz+sd*0.10,0.9,0.9,1.6,12,0x9aa0a4,1.0);
  K.cyl('metal',px-sw*0.30*(hash2(seed,5)>0.5?1:-1),top+1.6,pz+sd*0.10,0.92,0.2,0.3,12,0x8a9094,1.0);
  K.rod('metal',hx+1.2,top+2.9,hz,hx+1.2,top+5.4,hz,0.03,0.015,5,0x6a6e72);
}

/* ---- 大门口：门洞暗腔、双开门、门套、雨棚（有柱廊的楼不要雨棚）、台阶、门牌 ---- */
function addEntrance(K, grp, px, pz, sw, sd, face, colonnade, name){
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
  if(K.asset(en,0,0,0,0)){}                      /* 门斗、地弹门、台阶、雨棚是模型（exterior.py） */
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
    var back=new THREE.Mesh(new THREE.BoxGeometry(Math.min(dw+1.2,4.6),0.56,0.08),new THREE.MeshPhongMaterial({color:0xd8d4cc,shininess:0,specular:0}));
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
    var gx=535*SC*U2M, gz=1040*SC*U2M;
    var m=signMesh('十年树木  百年树人',10.4,1.6,'#ddd8ce','#7a3226');
    m.position.set(gx,1.35,gz+1.6+0.176); grp.add(m);
    var m2=signMesh('十年树木  百年树人',10.4,1.6,'#ddd8ce','#7a3226');
    m2.position.set(gx,1.35,gz+1.6-0.176); m2.rotation.y=Math.PI; grp.add(m2);
  }catch(e){}
}

/* ---- 教学楼 / 行政楼 / 实验楼：一层架空柱廊 + 四层教室 ---- */
function bldClassroom(K,grp,o,px,pz,sw,sd){
  var total=16.0, g0=3.2, dep=2.6;
  facadeDoor(o,px,pz,sw,sd,'colonnade');
  K.box('brick',px,total/2,pz,sw,total,sd,BRICK,0.97);
  plinthAround(K,px,pz,sw,sd,0.9,0.08,shadeHex(BASE_GREY,0.92));                 /* 底层浅灰：0.9 米高，以前 1.5 米把一楼窗户截掉半截 */
  /* 女儿墙（挑出的尺寸改成固定值：以前按楼宽的百分比，宽楼挑出半米，插进隔壁钟楼的柱子） */
  K.box('plaster',px,total+0.18,pz,sw-0.02,0.42,sd-0.02,WHITEBAND,1.0);
  K.box('brick',px,total+0.78,pz,sw+0.12,0.80,sd+0.12,BRICK,0.99);
  K.bevel('stone',px,total+1.22,pz,sw+0.24,0.10,sd+0.24,0xd8d4cb,1.05,0.02);
  roofTop(K,px,total+1.27,pz,sw,sd,o.x);                                      /* 立在女儿墙压顶上面（以前从 16 米起，下半截埋在实心的女儿墙里） */
  lightningBelt(K,px,pz,sw+0.16,sd+0.16,total+1.27);
  (function(){                                                                   /* 北面雨水管：落在两扇窗之间的墙垛上 */
    var u0=px-sw/2+0.8, len=sw-1.6, nw=Math.max(1,Math.floor(len/3.2)), q;
    for(q=1;q<4;q++){ var kk=Math.round(nw*q/4); if(kk>0&&kk<nw) downpipe(K,'n',px,pz,sw,sd,u0+kk*len/nw,total+0.9); }
  })();
  /* 柱廊：正中让出大门 */
  var colN=Math.max(4,Math.round(sw/4.2)), cn2;
  for(cn2=0;cn2<=colN;cn2++){
    var pcx=px-sw/2+(sw/colN)*cn2;
    if(Math.abs(pcx-px)<3.2) continue;
    K.bevel('brick',pcx,g0/2,pz+sd/2+dep/2,0.46,g0,0.46,BRICK,1.02,0.03);
    K.bevel('stone',pcx,0.16,pz+sd/2+dep/2,0.62,0.32,0.62,BASE_GREY,0.95,0.03);
    K.bevel('stone',pcx,g0-0.12,pz+sd/2+dep/2,0.56,0.12,0.56,WHITEBAND,1.0,0.02);
  }
  if(!DEV_HIDE.canopy) K.bevel('plaster',px,g0+0.14,pz+sd/2+dep/2,sw+0.4,0.30,dep+0.5,WHITEBAND,1.02,0.04);
  K.box('concrete',px,g0-0.30,pz+sd/2+dep/2,sw+0.2,0.26,dep+0.3,BRICK_D,0.96);
  /* 首层：柱廊后面的窗 */
  var spans=faceFreeSpans(o,'s'), si;
  for(si=0;si<spans.length;si++) facadeWindows(K,'s',px,pz,sw,sd,M(spans[si][0])+2.4,M(spans[si][1])-2.4,1.7,1.8,1.2,4.2);
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
    K.box('concrete',px,sy,pz+sd/2+0.36,sw*0.98,0.14,0.72,0xd8d4cb,1.04);
    K.box('plaster',px,sy-0.04,pz+sd/2+0.73,sw*0.98,0.24,0.04,WHITEBAND,1.0);
    var rpn=Math.max(4,Math.round(sw/1.3)), rp;
    for(rp=0;rp<=rpn;rp++){ var rx=px-sw*0.48+(sw*0.96/rpn)*rp; K.rod('metal',rx,sy+0.07,rz,rx,sy+1.05,rz,0.025,0.025,5,0x8b3a2e,1.0); }
    K.rod('metal',px-sw*0.48,sy+1.05,rz,px+sw*0.48,sy+1.05,rz,0.04,0.04,6,0x8b3a2e,1.05);
    K.rod('metal',px-sw*0.48,sy+0.55,rz,px+sw*0.48,sy+0.55,rz,0.018,0.018,4,0x8b3a2e,1.0);
    var acn=Math.max(2,Math.floor(sw/5.2)), ac;
    for(ac=0;ac<acn;ac++) acUnit(K,px-sw*0.42+ac*(sw*0.84/(acn-1||1)),sy+0.31,pz+sd/2+0.28,'s');
  }
  addEntrance(K,grp,px,pz,sw,sd,o.door||'s',true,BLD_NAME[o.id]);
}
/* ---- 宿舍：六层，阳台开在门的对面（贴着食堂的那段不画） ---- */
function bldDorm(K,grp,o,px,pz,sw,sd){
  var dh=OBLD_H[o.id], dn=Math.round(dh/3.0), dfl;
  facadeDoor(o,px,pz,sw,sd,'big');
  K.box('brick',px,dh/2,pz,sw,dh,sd,BRICK,0.97);
  plinthAround(K,px,pz,sw,sd,0.7,0.10,BASE_GREY);                                 /* 以前 2.5 米高，一楼窗户整个埋在里面 */
  K.box('plaster',px,dh+0.16,pz,sw-0.02,0.32,sd-0.02,WHITEBAND,1.0);
  K.bevel('stone',px,dh+0.45,pz,sw+0.2,0.10,sd+0.2,0xd8d4cb,1.0,0.02);
  roofTop(K,px,dh+0.5,pz,sw,sd,o.y);
  lightningBelt(K,px,pz,sw+0.12,sd+0.12,dh+0.5);
  if(!lodLow()){                                                                 /* 楼顶一排太阳能热水器 */
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
      var sa=M(spans[sp2][0]), sb=M(spans[sp2][1]), sw3=sb-sa-0.3, sx3=(sa+sb)/2;
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
        if(hash2(dfl*7+cl,o.x)<0.35) continue;
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
  K.box('brick',px,bTop/2,pz,sw,bTop,sd,BRICK,0.98);
  plinthAround(K,px,pz,sw,sd,1.6,0.17,STONE);
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
      K.box('dark',wx,bTop*0.56,wz,wsz[0],bTop*0.50,wsz[1],WIN_DARK,1.0);
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
    K.bevel('brick',ax2,(bTop+bh)/2,az2,0.7,bh-bTop,0.7,BRICK,1.0,0.05);
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
  K.box('brick',px,h/2,pz,sw,h,sd,BRICK,0.97);
  plinthAround(K,px,pz,sw,sd,0.9,0.10,BASE_GREY);
  K.box('plaster',px,h+0.16,pz,sw-0.02,0.32,sd-0.02,WHITEBAND,1.0);
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
  var body=(o.id==='trash')?0xa8aca0:BRICK;
  facadeDoor(o,px,pz,sw,sd,'small');
  K.box(o.id==='trash'?'concrete':'brick',px,h/2,pz,sw,h,sd,body,0.97);
  plinthAround(K,px,pz,sw,sd,h*0.24,0.08,BASE_GREY);
  K.bevel('concrete',px,h+0.12,pz,sw+0.6,0.24,sd+0.6,0xc9c4bb,1.0,0.04);             /* 挑出来的屋面板 */
  K.box('plaster',px,h-0.06,pz,sw*1.002,0.12,sd*1.002,WHITEBAND,1.0);
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
  var hgt=OBLD_H.shed, sc, sn=Math.max(5,Math.round(sd/4));
  if(Math.abs(sw-8)<0.3&&Assets.has('shed_frame')){
    /* 门式钢架、一米一段的波纹板屋面（按棚长等分、略拉伸）、隔几根柱子一个充电箱；车棚宽 8 米（模型按这个尺寸建的） */
    for(sc=0;sc<=sn;sc++){
      var fz=pz-sd*0.46+sc*(sd*0.92/sn);
      K.asset('shed_frame',px,0,fz,0);
      if(sc%3===1) K.asset('shed_charger',px+3.36,0,fz,-Math.PI/2);
    }
    var nm=Math.max(1,Math.round(sd)), ml=sd/nm, mk;
    for(mk=0;mk<nm;mk++) K.asset('shed_roof_1m',px,0,pz-sd/2+(mk+0.5)*ml,Math.PI/2,{sx:ml});
  }else
  for(sc=0;sc<=sn;sc++){
    var szz=pz-sd*0.46+sc*(sd*0.92/sn);
    K.cyl('metal',px-sw*0.42,0,szz,0.09,0.09,hgt,8,0x2b343b,1.06);
    K.cyl('metal',px+sw*0.42,0,szz,0.09,0.09,hgt-0.4,8,0x2b343b,1.06);
    K.rod('metal',px-sw*0.42,hgt,szz,px+sw*0.42,hgt-0.4,szz,0.06,0.06,6,0x2b343b);
  }
  var rb, rn=Math.round(sw/0.5);
  if(!(Math.abs(sw-8)<0.3&&Assets.has('shed_frame')))
  for(rb=0;rb<rn;rb++){                                                               /* 波纹板 */
    var rx=px-sw/2+(rb+0.5)*sw/rn, ry=hgt+0.06-(rb+0.5)/rn*0.4;
    K.box('metal',rx,ry+(rb%2?0.03:0),pz,sw/rn+0.01,0.03,sd,0x3a4a52,rb%2?1.05:0.95);
  }
  var bk2, bkn=Math.floor(sd/1.1);
  for(bk2=0;bk2<bkn;bk2++){
    if(hash2(bk2,57)<0.28) continue;
    var bz5=pz-sd/2+0.8+bk2*1.1, bcol=[0x3a4a5a,0x6a2a2a,0xd8d4cc,0x2a2e33,0x4a6a4a][bk2%5], bx5=px-sw*0.10;
    if(!K.asset('ebike',bx5,0,bz5,0,{tint:{body:bcol}})) ebikeModel(K,bx5,bz5,0,bcol,lodLow());
  }
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
    K.box('concrete',px,ly-0.16,pz,sw,0.32,sd,BRICK,1.02);
    K.box('plaster',px,ly-0.34,pz,sw*0.99,0.06,sd*0.99,WHITEBAND,1.0);
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
  var cn=3, ck2;
  for(ck2=0;ck2<=cn;ck2++){
    var czx=px-sw/2+(sw/cn)*ck2;
    K.bevel('brick',czx,8.0,pz-sd/2+0.4,0.42,16.0,0.42,BRICK,0.94,0.03);
    K.bevel('brick',czx,8.0,pz+sd/2-0.4,0.42,16.0,0.42,BRICK,0.94,0.03);
  }
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
function garagePed(K,px,pz,sw,sd){
  var w=Math.min(sw,7.0), d=Math.min(sd,5.0), h=3.0;
  K.box('plaster',px,h/2,pz,w,h,d,0x9a958c,1.0);
  K.bevel('concrete',px,h+0.12,pz,w+0.4,0.24,d+0.4,0x5a646a,1.0,0.04);
  K.box('glass',px,h-0.5,pz+d/2+0.02,w*0.92,0.8,0.02,0x2a3a44,1.1);
  K.box('dark',px,h-0.5,pz+d/2+0.01,w*0.92,0.8,0.01,0x0a0e10,1.0);
  K.bevel('metal',px,1.05,pz+d/2+0.04,1.6,2.1,0.06,0x2a3136,1.0,0.01);
  K.box('plastic',px,2.3,pz+d/2+0.06,1.4,0.24,0.04,0x1d3a5a,1.2);
  K.box('emit',px+0.45,2.3,pz+d/2+0.09,0.3,0.12,0.02,0x2fae6a,1.0);
  addSolidM(px,pz,w/2,d/2);
}
/* 一面墙上没被别的楼挡住的区段（地图单位的 x 区间） */
function faceFreeSpans(o,face){
  var fy=(face==='s')?o.y+o.h:o.y, spans=[[o.x,o.x+o.w]], i, j;
  for(i=0;i<OBJ.length;i++){
    var b=OBJ[i]; if(b===o||b.k!=='roof') continue;
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
function fieldModel(K,o,px,pz,sw,sd){
  var trackW=Math.min(sw,sd)*0.17;
  var ix0=px-sw/2+trackW, ix1=px+sw/2-trackW, iz0=pz-sd/2+trackW, iz1=pz+sd/2-trackW, ln;
  var F=K.g('court');
  /* 塑胶跑道：一圈四条（不和内场草皮叠在一起） */
  F.quad(px-sw/2,pz-sd/2, px+sw/2,pz-sd/2, px+sw/2,iz0, px-sw/2,iz0, 0.060, 0xa0443a);
  F.quad(px-sw/2,iz1, px+sw/2,iz1, px+sw/2,pz+sd/2, px-sw/2,pz+sd/2, 0.060, 0xa0443a);
  F.quad(px-sw/2,iz0, ix0,iz0, ix0,iz1, px-sw/2,iz1, 0.060, 0xa0443a);
  F.quad(ix1,iz0, px+sw/2,iz0, px+sw/2,iz1, ix1,iz1, 0.060, 0xa0443a);
  for(ln=1;ln<=4;ln++){
    var off=trackW*ln/5;
    F.quad(px-sw/2+off,pz-sd/2+off, px+sw/2-off,pz-sd/2+off, px+sw/2-off,pz-sd/2+off+0.12, px-sw/2+off,pz-sd/2+off+0.12, 0.064, 0xe8e6e0);
    F.quad(px-sw/2+off,pz+sd/2-off-0.12, px+sw/2-off,pz+sd/2-off-0.12, px+sw/2-off,pz+sd/2-off, px-sw/2+off,pz+sd/2-off, 0.064, 0xe8e6e0);
    F.quad(px-sw/2+off,pz-sd/2+off, px-sw/2+off+0.12,pz-sd/2+off, px-sw/2+off+0.12,pz+sd/2-off, px-sw/2+off,pz+sd/2-off, 0.064, 0xe8e6e0);
    F.quad(px+sw/2-off-0.12,pz-sd/2+off, px+sw/2-off,pz-sd/2+off, px+sw/2-off,pz+sd/2-off, px+sw/2-off-0.12,pz+sd/2-off, 0.064, 0xe8e6e0);
  }
  /* 人造草：一条条深浅相间 */
  var st, nst=10;
  for(st=0;st<nst;st++){
    var za=iz0+(iz1-iz0)*st/nst, zb=iz0+(iz1-iz0)*(st+1)/nst;
    K.g('fgrass').quad(ix0,za, ix1,za, ix1,zb, ix0,zb, 0.062, st%2?0x3f6b3f:0x467548);
  }
  F.quad(ix0,(iz0+iz1)/2-0.06, ix1,(iz0+iz1)/2-0.06, ix1,(iz0+iz1)/2+0.06, ix0,(iz0+iz1)/2+0.06, 0.066, 0xe4e2dc);   /* 中线 */
  var k, cr=Math.min(ix1-ix0,iz1-iz0)*0.16, ci;
  for(ci=0;ci<OBJ.length;ci++){                       /* 中圈不压到内场里的篮球场 */
    var co=OBJ[ci]; if(co.k!=='court') continue;
    var cz0=M(co.y), cz1=M(co.y+co.h), czc=(iz0+iz1)/2;
    if(M(co.x)<ix1&&M(co.x+co.w)>ix0){ if(cz1<=czc) cr=Math.min(cr,czc-cz1-0.15); else if(cz0>=czc) cr=Math.min(cr,cz0-czc-0.15); }
  }
  for(k=0;k<24;k++){ var a=k/24*6.283, b=(k+1)/24*6.283, cxm=(ix0+ix1)/2, czm=(iz0+iz1)/2;
    K.rod('court',cxm+Math.cos(a)*cr,0.068,czm+Math.sin(a)*cr,cxm+Math.cos(b)*cr,0.068,czm+Math.sin(b)*cr,0.05,0.05,4,0xe4e2dc); }
  K.box('court',px,0.065,iz0,ix1-ix0,0.01,0.12,0xe4e2dc,1);
  K.box('court',px,0.065,iz1,ix1-ix0,0.01,0.12,0xe4e2dc,1);
  K.box('court',ix0,0.065,pz,0.12,0.01,iz1-iz0,0xe4e2dc,1);
  K.box('court',ix1,0.065,pz,0.12,0.01,iz1-iz0,0xe4e2dc,1);
  F.quad(ix1-6,iz0+4, ix1-2,iz0+4, ix1-2,iz0+8, ix1-6,iz0+8, 0.070, 0xc8b98a);           /* 沙坑 */
  var gl2;
  for(gl2=0;gl2<2;gl2++){                                                                  /* 两头的球门 */
    var gzz=gl2?iz1-0.6:iz0+0.6, gsg=gl2?1:-1;
    if(K.asset('soccer_goal',px,0,gzz,gl2?Math.PI:0)){ addSolidM(px-1.6,gzz,0.1,0.1); addSolidM(px+1.6,gzz,0.1,0.1); continue; }
    K.rod('metal',px-1.6,0,gzz,px-1.6,2.0,gzz,0.05,0.05,8,0xe8e8e2,1.1);
    K.rod('metal',px+1.6,0,gzz,px+1.6,2.0,gzz,0.05,0.05,8,0xe8e8e2,1.1);
    K.rod('metal',px-1.6,2.0,gzz,px+1.6,2.0,gzz,0.05,0.05,8,0xe8e8e2,1.1);
    K.rod('metal',px-1.6,2.0,gzz,px-1.6,0,gzz+gsg*0.9,0.025,0.025,5,0xc8ccc8);
    K.rod('metal',px+1.6,2.0,gzz,px+1.6,0,gzz+gsg*0.9,0.025,0.025,5,0xc8ccc8);
    K.box('fabric',px,1.0,gzz+gsg*0.9,3.2,1.9,0.01,0xc8ccc8,0.85);
    K.box('fabric',px-1.6,1.0,gzz+gsg*0.45,0.01,1.9,0.9,0xc8ccc8,0.85);
    K.box('fabric',px+1.6,1.0,gzz+gsg*0.45,0.01,1.9,0.9,0xc8ccc8,0.85);
    addSolidM(px-1.6,gzz,0.1,0.1); addSolidM(px+1.6,gzz,0.1,0.1);
  }
}
function courtModel(K,o,px,pz,sw,sd){
  var base=PALETTE[o.k]||PALETTE.roof;
  if(o.k==='garden'){ K.g('fgrass').quad(px-sw/2,pz-sd/2, px+sw/2,pz-sd/2, px+sw/2,pz+sd/2, px-sw/2,pz+sd/2, 0.012, 0x5f8a56); return; }
  K.bevel('court',px,0.045,pz,sw,0.09,sd,base,1.0,0.03);
  K.box('court',px,0.092,pz-sd/2+0.12,sw-0.2,0.004,0.08,0xd8d8d0,1);
  K.box('court',px,0.092,pz+sd/2-0.12,sw-0.2,0.004,0.08,0xd8d8d0,1);
  K.box('court',px-sw/2+0.12,0.092,pz,0.08,0.004,sd-0.2,0xd8d8d0,1);
  K.box('court',px+sw/2-0.12,0.092,pz,0.08,0.004,sd-0.2,0xd8d8d0,1);
  if(o.k==='track'){
    var ln; for(ln=1;ln<4;ln++) K.box('court',px,0.092,pz-sd/2+sd*ln/4,sw-0.3,0.004,0.06,0xd8d8d0,1);
    return;
  }
  var along=(sw>sd);
  K.box('court',along?px:px,0.092,along?pz:pz,along?0.06:sw-0.2,0.004,along?sd-0.2:0.06,0xd8d8d0,1);   /* 中线 */
  courtGear(K,o,px,pz,sw,sd);
}
function courtGear(K,o,px,pz,sw,sd){
  var along=(sw>sd), i;
  if(o.id.indexOf('bad')===0){
    var nC=(o.id==='bad3')?3:2;
    for(i=0;i<nC;i++){
      var cxn=along?(px-sw/2+(i+0.5)*sw/nC):px, czn=along?pz:(pz-sd/2+(i+0.5)*sd/nC);
      var len=along?sd*0.86:sw*0.86;
      if(along&&Assets.has('badminton_post')){
        K.asset('badminton_post',cxn,0.09,czn-len/2,Math.PI/2); K.asset('badminton_post',cxn,0.09,czn+len/2,-Math.PI/2);   /* 立在球场面层上 */
        K.box('fabric',cxn,1.20,czn,0.01,0.72,len,0xd8d8d2,0.9);
        K.box('fabric',cxn,1.55,czn,0.03,0.04,len,0xf0f0ea,1.0);
        addSolidM(cxn,czn-len/2,0.1,0.1); addSolidM(cxn,czn+len/2,0.1,0.1);
      }else if(along){
        K.rod('metal',cxn,0,czn-len/2,cxn,1.55,czn-len/2,0.03,0.03,6,0x3a3f44);
        K.rod('metal',cxn,0,czn+len/2,cxn,1.55,czn+len/2,0.03,0.03,6,0x3a3f44);
        K.box('fabric',cxn,1.20,czn,0.01,0.72,len,0xd8d8d2,0.9);
        K.box('fabric',cxn,1.55,czn,0.03,0.04,len,0xf0f0ea,1.0);
        addSolidM(cxn,czn-len/2,0.1,0.1); addSolidM(cxn,czn+len/2,0.1,0.1);
      }else{
        K.box('fabric',cxn,1.20,czn,len,0.72,0.01,0xd8d8d2,0.9);
      }
    }
    return;
  }
  for(i=0;i<2;i++){                                         /* 篮球架：立柱、斜臂、篮板、篮筐 */
    var sg=i?1:-1;
    var hx=along?px+sg*(sw/2-0.4):px, hz=along?pz:pz+sg*(sd/2-0.4);
    var bx=along?-sg*1.2:0, bz=along?0:-sg*1.2;
    if(K.asset('hoop_stand',hx,0.09,hz,along?-sg*Math.PI/2:(sg>0?Math.PI:0))){ addSolidM(hx,hz,0.3,0.3); continue; }   /* 伸臂朝球场中间，墩子坐在面层上 */
    K.cyl('metal',hx,0,hz,0.10,0.08,3.2,10,0x2f3a44,1.0);
    K.bevel('concrete',hx,0.15,hz,0.6,0.3,0.6,0x8a8a86,1,0.03);
    K.rod('metal',hx,3.0,hz,hx+bx*0.9,3.25,hz+bz*0.9,0.05,0.05,6,0x2f3a44);
    K.bevel('plastic',hx+bx,3.25,hz+bz,along?0.05:1.8,1.05,along?1.8:0.05,0xe8e8e4,1.05,0.015);
    K.box('emit',hx+bx-(along?sg*0.03:0),3.10,hz+bz-(along?0:sg*0.03),along?0.004:0.6,0.45,along?0.6:0.004,0xc04a2a,0.7);
    var rk, rr=0.23, rcx=hx+bx*1.20, rcz=hz+bz*1.20;
    for(rk=0;rk<12;rk++){ var a1=rk/12*6.283, a2=(rk+1)/12*6.283; K.rod('metal',rcx+Math.cos(a1)*rr,2.95,rcz+Math.sin(a1)*rr,rcx+Math.cos(a2)*rr,2.95,rcz+Math.sin(a2)*rr,0.012,0.012,4,0xc0502a,1.1); }
    for(rk=0;rk<8;rk++){ var a3=rk/8*6.283; K.rod('fabric',rcx+Math.cos(a3)*rr,2.95,rcz+Math.sin(a3)*rr,rcx+Math.cos(a3)*rr*0.6,2.55,rcz+Math.sin(a3)*rr*0.6,0.004,0.004,3,0xe8e8e0); }
    addSolidM(hx,hz,0.3,0.3);
  }
}

/* ---- 围墙：毛石基座 + 墙帽 + 铁艺栏杆（立杆顶上有矛尖）；三个校门处留口子 ---- */
function fenceRun(K,fx,fz,len,horiz,noA,noB){   /* noA / noB：这一头挨着校门的门柱，不再立墙柱 */
  if(len<0.3) return;
  var baseH=1.5, railH=1.5, t=0.62, low=lodLow();
  function B(m,u,y,s,l,h,d,col,sh){ if(horiz) K.box(m,fx+u,y,fz+s,l,h,d,col,sh); else K.box(m,fx+s,y,fz+u,d,h,l,col,sh); }
  B('stone',0,baseH/2,0,len,baseH,t,STONE,1.0);
  B('stone',0,baseH+0.06,0,len+0.02,0.12,t+0.10,0x8f938f,1.05);
  if(!low&&Assets.has('fence_panel_200')){
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
  var n=Math.max(2,Math.round(len/Quality.get().fenceStep)), k;
  for(k=0;k<=n;k++){
    var u=-len/2+(len/n)*k;
    var spear=Quality.get().facadeDetail;                                   /* 矛尖只在「精细」及以上画 */
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
  var cur=a0, gi, ng=Assets.has('gate_pillar');
  for(gi=0;gi<gaps.length;gi++){
    var g0=gaps[gi][0]-gaps[gi][1], g1=gaps[gi][0]+gaps[gi][1];
    if(g0>cur){ if(horiz) fenceRun(K,(cur+g0)/2,fixed,g0-cur,true,ng&&cur>a0,ng); else fenceRun(K,fixed,(cur+g0)/2,g0-cur,false,ng&&cur>a0,ng); }
    cur=Math.max(cur,g1);
  }
  if(a1>cur){ if(horiz) fenceRun(K,(cur+a1)/2,fixed,a1-cur,true,ng&&cur>a0,false); else fenceRun(K,fixed,(cur+a1)/2,a1-cur,false,ng&&cur>a0,false); }
}
/* 校门：vert=true 时门开在东西两侧的墙上 */
function gateModel(K,grp,wx,wy,wide,tallSign,vert,name){
  var gx=wx*SC*U2M, gz=wy*SC*U2M;
  K.frame(gx,gz,vert?Math.PI/2:0);
  var pw=0.70, ph=tallSign?4.6:3.0;
  if(Assets.has('gate_pillar')){
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
  garw:  function(K,grp,o,px,pz,sw,sd){ garagePed(K,px,pz,sw,sd); },
  bell:   function(K,grp,o,px,pz,sw,sd){ bldBell(K,grp,o,px,pz,sw,sd); },
  dormN:  function(K,grp,o,px,pz,sw,sd){ bldDorm(K,grp,o,px,pz,sw,sd); },
  canteen:function(K,grp,o,px,pz,sw,sd){ bldCanteen(K,grp,o,px,pz,sw,sd); },
  shed:  function(K,grp,o,px,pz,sw,sd){ bldShed(K,o,px,pz,sw,sd); }
};
var BLD_BY_KIND={
  field: function(K,grp,o,px,pz,sw,sd){ fieldModel(K,o,px,pz,sw,sd); },
  court: function(K,grp,o,px,pz,sw,sd){ courtModel(K,o,px,pz,sw,sd); },
  link:  function(K,grp,o,px,pz,sw,sd){ bldLink(K,o,px,pz,sw,sd); }
};
BLD_BY_KIND.track=BLD_BY_KIND.court; BLD_BY_KIND.garden=BLD_BY_KIND.court; BLD_BY_ID.dormS=BLD_BY_ID.dormN;
function bldBuilderOf(o){
  return BLD_BY_ID[o.id]||BLD_BY_KIND[o.k]||(o.open1f?function(K,grp,o2,px,pz,sw,sd){ bldClassroom(K,grp,o2,px,pz,sw,sd); }
                                                    :function(K,grp,o2,px,pz,sw,sd){ bldSmall(K,grp,o2,px,pz,sw,sd); });
}
function buildOutdoorGeometry(){
  var K=new Kit({cull:{floor:0.002},chunk:64,inst:1,sparse:Quality.get().lod>=2?2:0}), grp=new THREE.Group(), i; /* 流畅、均衡和精细合并稀疏小物件 */
  var x0=BOUND.x0*SC*U2M, y0=BOUND.y0*SC*U2M;
  var x1=BOUND.x1*SC*U2M, y1=BOUND.y1*SC*U2M;
  var cx=(x0+x1)/2, cz=(y0+y1)/2;
  OUTX={treeN:0};
  OUT_SOLID=[]; OUT_LAMPS=[];
  addOutdoorProps(K, x0, y0, x1, y1);

  for(i=0;i<OBJ.length;i++){
    var o=OBJ[i], ow=objWorld(o);
    var px=(ow.x+ow.w/2)*U2M, pz=(ow.y+ow.h/2)*U2M;
    var sw=ow.w*U2M, sd=ow.h*U2M;
    FAC.o=o; FAC.gap=null;
    if(o.k==='link'&&DEV_HIDE.link) continue;
    bldBuilderOf(o)(K,grp,o,px,pz,sw,sd);
  }
  FAC.o=null; FAC.gap=null;
  if(!DEV_HIDE.fence){
    var gN=GATE_N.x*SC*U2M, gWz=GATE_W.y*SC*U2M, gS=GATE_S.x*SC*U2M;
    var NW=12.0, WW=5.0, SW2=5.4;
    gateModel(K,grp,GATE_N.x,GATE_N.y,NW,true,false);
    gateModel(K,grp,GATE_W.x,GATE_W.y,WW,false,true);
    gateModel(K,grp,GATE_S.x,GATE_S.y,SW2,false,false);
    /* 墙段从校门门柱的外侧面开始（端头那根墙柱正好贴着门柱）；东西两侧的墙段从南北墙的外侧面开始，拐角不再两段叠在一起 */
    var GP=Assets.has('gate_pillar')?0.35+0.07:0.35+0.21, CW=0.36+0.21;   /* 门柱是模型时，墙段从门柱基座外沿开始，挨着门柱的那头不立墙柱 */
    fenceSide(K,true,  y0, x0, x1, [[gN,NW/2+GP]]);
    fenceSide(K,true,  y1, x0, x1, [[gS,SW2/2+GP]]);
    fenceSide(K,false, x0, y0+CW, y1-CW, [[gWz,WW/2+GP]]);
    fenceSide(K,false, x1, y0+CW, y1-CW, []);
  }
  K.build(grp);
  try{ addGrass(grp); }catch(e){}
  try{ if(!DEV_HIDE.sign) addGardenSign(grp); }catch(e){}
  return grp;
}
