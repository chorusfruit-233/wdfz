/* @module-capsule */
(function($imports){
function garagePed(K,px,pz,sw,sd){
  var w=Math.min(sw,7.0), d=Math.min(sd,5.0), h=3.0;
  K.box('plaster',px,h/2,pz,w,h,d,0x9a958c,1.0);
  K.bevel('concrete',px,h+0.12,pz,w+0.4,0.24,d+0.4,0x5a646a,1.0,0.04);
  K.box('glass',px,h-0.5,pz+d/2+0.02,w*0.92,0.8,0.02,0x2a3a44,1.1);
  K.box('dark',px,h-0.5,pz+d/2+0.01,w*0.92,0.8,0.01,0x0a0e10,1.0);
  K.bevel('metal',px,1.05,pz+d/2+0.04,1.6,2.1,0.06,0x2a3136,1.0,0.01);
  K.box('plastic',px,2.3,pz+d/2+0.06,1.4,0.24,0.04,0x1d3a5a,1.2);
  K.box('emit',px+0.45,2.3,pz+d/2+0.09,0.3,0.12,0.02,0x2fae6a,1.0);
  K.solidM(px,pz,w/2,d/2,$imports.SC*$imports.U2M);
}
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
  for(ci=0;ci<$imports.OBJ.length;ci++){                       /* 中圈不压到内场里的篮球场 */
    var co=$imports.OBJ[ci]; if(co.k!=='court') continue;
    var cz0=(0,$imports.M)(co.y), cz1=(0,$imports.M)(co.y+co.h), czc=(iz0+iz1)/2;
    if((0,$imports.M)(co.x)<ix1&&(0,$imports.M)(co.x+co.w)>ix0){ if(cz1<=czc) cr=Math.min(cr,czc-cz1-0.15); else if(cz0>=czc) cr=Math.min(cr,cz0-czc-0.15); }
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
    if(K.asset('soccer_goal',px,0,gzz,gl2?Math.PI:0)){ K.solidM(px-1.6,gzz,0.1,0.1,$imports.SC*$imports.U2M); K.solidM(px+1.6,gzz,0.1,0.1,$imports.SC*$imports.U2M); continue; }
    K.rod('metal',px-1.6,0,gzz,px-1.6,2.0,gzz,0.05,0.05,8,0xe8e8e2,1.1);
    K.rod('metal',px+1.6,0,gzz,px+1.6,2.0,gzz,0.05,0.05,8,0xe8e8e2,1.1);
    K.rod('metal',px-1.6,2.0,gzz,px+1.6,2.0,gzz,0.05,0.05,8,0xe8e8e2,1.1);
    K.rod('metal',px-1.6,2.0,gzz,px-1.6,0,gzz+gsg*0.9,0.025,0.025,5,0xc8ccc8);
    K.rod('metal',px+1.6,2.0,gzz,px+1.6,0,gzz+gsg*0.9,0.025,0.025,5,0xc8ccc8);
    K.box('fabric',px,1.0,gzz+gsg*0.9,3.2,1.9,0.01,0xc8ccc8,0.85);
    K.box('fabric',px-1.6,1.0,gzz+gsg*0.45,0.01,1.9,0.9,0xc8ccc8,0.85);
    K.box('fabric',px+1.6,1.0,gzz+gsg*0.45,0.01,1.9,0.9,0xc8ccc8,0.85);
    K.solidM(px-1.6,gzz,0.1,0.1,$imports.SC*$imports.U2M); K.solidM(px+1.6,gzz,0.1,0.1,$imports.SC*$imports.U2M);
  }
}
function courtModel(K,o,px,pz,sw,sd){
  var base=$imports.PALETTE[o.k]||$imports.PALETTE.roof;
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
      if(along&&K.has('badminton_post')){
        K.asset('badminton_post',cxn,0.09,czn-len/2,Math.PI/2); K.asset('badminton_post',cxn,0.09,czn+len/2,-Math.PI/2);   /* 立在球场面层上 */
        K.box('fabric',cxn,1.20,czn,0.01,0.72,len,0xd8d8d2,0.9);
        K.box('fabric',cxn,1.55,czn,0.03,0.04,len,0xf0f0ea,1.0);
        K.solidM(cxn,czn-len/2,0.1,0.1,$imports.SC*$imports.U2M); K.solidM(cxn,czn+len/2,0.1,0.1,$imports.SC*$imports.U2M);
      }else if(along){
        K.rod('metal',cxn,0,czn-len/2,cxn,1.55,czn-len/2,0.03,0.03,6,0x3a3f44);
        K.rod('metal',cxn,0,czn+len/2,cxn,1.55,czn+len/2,0.03,0.03,6,0x3a3f44);
        K.box('fabric',cxn,1.20,czn,0.01,0.72,len,0xd8d8d2,0.9);
        K.box('fabric',cxn,1.55,czn,0.03,0.04,len,0xf0f0ea,1.0);
        K.solidM(cxn,czn-len/2,0.1,0.1,$imports.SC*$imports.U2M); K.solidM(cxn,czn+len/2,0.1,0.1,$imports.SC*$imports.U2M);
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
    if(K.asset('hoop_stand',hx,0.09,hz,along?-sg*Math.PI/2:(sg>0?Math.PI:0))){ K.solidM(hx,hz,0.3,0.3,$imports.SC*$imports.U2M); continue; }   /* 伸臂朝球场中间，墩子坐在面层上 */
    K.cyl('metal',hx,0,hz,0.10,0.08,3.2,10,0x2f3a44,1.0);
    K.bevel('concrete',hx,0.15,hz,0.6,0.3,0.6,0x8a8a86,1,0.03);
    K.rod('metal',hx,3.0,hz,hx+bx*0.9,3.25,hz+bz*0.9,0.05,0.05,6,0x2f3a44);
    K.bevel('plastic',hx+bx,3.25,hz+bz,along?0.05:1.8,1.05,along?1.8:0.05,0xe8e8e4,1.05,0.015);
    K.box('emit',hx+bx-(along?sg*0.03:0),3.10,hz+bz-(along?0:sg*0.03),along?0.004:0.6,0.45,along?0.6:0.004,0xc04a2a,0.7);
    var rk, rr=0.23, rcx=hx+bx*1.20, rcz=hz+bz*1.20;
    for(rk=0;rk<12;rk++){ var a1=rk/12*6.283, a2=(rk+1)/12*6.283; K.rod('metal',rcx+Math.cos(a1)*rr,2.95,rcz+Math.sin(a1)*rr,rcx+Math.cos(a2)*rr,2.95,rcz+Math.sin(a2)*rr,0.012,0.012,4,0xc0502a,1.1); }
    for(rk=0;rk<8;rk++){ var a3=rk/8*6.283; K.rod('fabric',rcx+Math.cos(a3)*rr,2.95,rcz+Math.sin(a3)*rr,rcx+Math.cos(a3)*rr*0.6,2.55,rcz+Math.sin(a3)*rr*0.6,0.004,0.004,3,0xe8e8e0); }
    K.solidM(hx,hz,0.3,0.3,$imports.SC*$imports.U2M);
  }
}
/* @module-exports */
GameModules.publish("game3d/js/content/sports-recipe.js",{
"garagePed":{get:function(){return garagePed;},set:function($value){garagePed=$value;}},
"fieldModel":{get:function(){return fieldModel;},set:function($value){fieldModel=$value;}},
"courtModel":{get:function(){return courtModel;},set:function($value){courtModel=$value;}},
"courtGear":{get:function(){return courtGear;},set:function($value){courtGear=$value;}}
});
})(GameModules.imports("game3d/js/content/sports-recipe.js"));
