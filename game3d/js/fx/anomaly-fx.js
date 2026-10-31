/* 里世界 3D · 异象与死亡演出 */
'use strict';

function buildRoamFigure(){
  /* 车库里那个：比人高，手垂过膝盖，纯黑，不吃光 */
  try{
    var grp=new THREE.Group();
    grp.add(figMesh('roam',new THREE.MeshBasicMaterial({color:0x05070a,fog:true}),1));
    return grp;
  }catch(e){ return null; }
}
var ANFX={kind:null,grp:null,items:[],t:0,src:null,preview:false};
function anfxW2S(wx,wy){
  if(S.mode==='in'&&INTERIORS[S.room]) return worldToScene(wx,wy,INTERIORS[S.room]);
  return worldToScene(wx,wy,null);
}
function anfxClear(){
  try{ wxClear(); }catch(e){}
  if(ANFX.hiddenWorld&&ANFX.hiddenWorld.mesh){
    ANFX.hiddenWorld.mesh.visible=ANFX.hiddenWorld.visible;
    ANFX.hiddenWorld=null;
  }
  if(ANFX.grp){
    GLR.scene.remove(ANFX.grp);
    /* 调试预览的资源由 Dev.clearPreview 管理；真实死亡在这里释放。 */
    if(ANFX.kind==='death'&&!ANFX.preview) ThreeBackend.disposeGroup(ANFX.grp);
    ANFX.grp=null;
  }
  ANFX.kind=null; ANFX.items=[]; ANFX.t=0; ANFX.cup=null;ANFX.preview=false;ANFX.slit=null;ANFX.squeeze=null;ANFX.faceWalk=null;
  ANFX.timeline=null;
  GLR.gazeT=0; GLR.gazeShake=0;
}
function anfxMat(col,op){
  return new THREE.MeshBasicMaterial({color:col,transparent:(op!==undefined),opacity:(op===undefined?1:op),fog:true});
}
function wallFaceSnap(R,wx,wy){
  if(!R) return null;
  var c0=Math.floor((wx-R.ox)/R.tw), r0=Math.floor((wy-R.oy)/R.th);
  var best=null,bd=1e9,rr,cc;
  for(rr=0;rr<R.rows;rr++){
    for(cc=0;cc<R.cols;cc++){
      if(R.grid[rr][cc]!=='#') continue;
      var d=Math.abs(rr-r0)+Math.abs(cc-c0);
      if(d<bd){ bd=d; best=[cc,rr]; }
    }
  }
  if(!best) return null;
  var nx=0,nz=0;
  if(best[1]!==r0) nz=(r0>best[1])?1:-1;
  else if(best[0]!==c0) nx=(c0>best[0])?1:-1;
  if(!nx&&!nz) nz=1;
  var wxp=R.ox+(best[0]+0.5)*R.tw+nx*R.tw*0.5;
  var wyp=R.oy+(best[1]+0.5)*R.th+nz*R.th*0.5;
  return { s:worldToScene(wxp,wyp,R), nx:nx, nz:nz, cols:R.cols };
}
function anfxBox(grp,mat,w,h,d,x,y,z){
  var m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
  m.position.set(x,y,z);
  grp.add(m);
  return m;
}
/* 异象里的人影（统一人形，见 model/figure.js）；正面朝 +z */
function anfxFigure(grp,mat,x,z,scale,hunch,kind){
  grp.add(figMesh(kind||'tall',mat,scale||1));
  if(hunch){ grp.rotation.x=-0.25; }
  grp.position.set(x,0,z);
}
function anfxSpawn(kind,wx,wy){
  anfxClear();
  var p=anfxW2S(wx,wy);
  var grp=new THREE.Group();
  ANFX.kind=kind; ANFX.grp=grp; ANFX.t=0;
  var i;
  if(kind==='rain'){
    wxRainSpawn(grp);                           /* 雨丝、水圈、积水、闪电：见 fx/weather.js */
  } else if(kind==='moth'){
    wxMothSpawn(grp,wx,wy);
  } else if(kind==='cup'){
    cupFxSpawn(grp);                            /* 见 fx/cup.js */
  } else if(kind==='exercise'){
    var em=anfxMat(0x1b2226,1.0);
    for(i=0;i<6;i++){
      var fg=new THREE.Group(); anfxFigure(fg,em,0,0,1.0,true);
      fg.position.set(p.x-5+i*2.0, 0, p.z+ (i%2?0.3:-0.3));
      fg.rotation.y=Math.PI;
      grp.add(fg);
      ANFX.items.push(fg);
    }
  } else if(kind==='necker'){
    var nm=anfxMat(0x121619,1.0);
    var ng=new THREE.Group(); anfxFigure(ng,nm,0,0,1.4,false,'neck');
    ng.position.set(p.x,0,p.z);
    grp.add(ng);
    ANFX.items.push(ng);
  } else if(kind==='twin'){
    var tm=anfxMat(0x141a1d,1.0);
    var tg=new THREE.Group(); anfxFigure(tg,tm,0,0,1.0,false);
    tg.position.set(p.x,0,p.z);
    grp.add(tg);
    ANFX.items.push(tg);
  } else if(kind==='hand'){
    var hm=anfxMat(0x6a5a52,1.0);
    anfxBox(grp,hm,0.34,0.05,0.26,0,0.16,0);
    for(i=0;i<4;i++) anfxBox(grp,hm,0.055,0.05,0.22,-0.12+i*0.08,0.16,0.22);
    grp.position.set(p.x,0,p.z);
  } else if(kind==='leak'){
    /* 水渍和滴水都落在判定点上（以前各随机各的） */
    var wm=anfxMat(0x1b2428,0.85), pts=(AN.data&&AN.data.pts)||[{x:wx,y:wy}];
    for(i=0;i<5;i++){
      var lp2=anfxW2S(pts[i%pts.length].x,pts[i%pts.length].y);
      var pq=new THREE.Mesh(new THREE.CircleGeometry(0.9+Math.random()*0.3,12),wm);
      pq.rotation.x=-Math.PI/2;
      pq.position.set(lp2.x, 0.012, lp2.z);
      grp.add(pq); ANFX.items.push(pq);
    }
    var dm2=anfxMat(0x8fa6b0,0.55);
    for(i=0;i<15;i++){
      var lp3=anfxW2S(pts[i%pts.length].x,pts[i%pts.length].y);
      ANFX.items.push(anfxBox(grp,dm2,0.03,0.28,0.03,lp3.x+(Math.random()-0.5)*0.6,Math.random()*2.6,lp3.z+(Math.random()-0.5)*0.6));
    }
    for(i=0;i<5;i++){
      var lp4=anfxW2S(pts[i].x,pts[i].y);
      anfxBox(grp,anfxMat(0x2a2420,0.75),0.9,0.01,0.6,lp4.x,2.985,lp4.z);    /* 天花板上的水渍 */
    }
  } else if(kind==='rite'){
    /* 圈的半径 2.1 米，和判定一致（以前画 1.7 米、判定 3.3 米） */
    var rm2=anfxMat(0xd8d4cc,0.95);
    for(i=0;i<44;i++){
      var ra=i/44*6.283;
      var seg=anfxBox(grp,rm2,0.32,0.012,0.06,p.x+Math.cos(ra)*2.1,0.014,p.z+Math.sin(ra)*2.1);
      seg.rotation.y=-ra+Math.PI/2;
      ANFX.items.push(seg);
    }
    for(i=0;i<5;i++){                                   /* 圈里的五角星 */
      var a5=i/5*6.283-Math.PI/2, b5=((i+2)%5)/5*6.283-Math.PI/2;
      var sx5=p.x+Math.cos(a5)*2.0, sz5=p.z+Math.sin(a5)*2.0, ex5=p.x+Math.cos(b5)*2.0, ez5=p.z+Math.sin(b5)*2.0;
      var ln5=anfxBox(grp,rm2,Math.hypot(ex5-sx5,ez5-sz5),0.012,0.05,(sx5+ex5)/2,0.016,(sz5+ez5)/2);
      ln5.rotation.y=-Math.atan2(ez5-sz5,ex5-sx5);
    }
    anfxBox(grp,anfxMat(0x1a1210,0.8),0.55,0.01,1.5,p.x,0.018,p.z);   /* 正中一块人形的暗渍 */
    var cm=anfxMat(0xe8dcc0,1.0);
    for(i=0;i<4;i++){
      var ca=i/4*6.283+0.6;
      var cx4=p.x+Math.cos(ca)*1.6, cz4=p.z+Math.sin(ca)*1.6;
      anfxBox(grp,anfxMat(0xf0e8d8,1.0),0.08,0.22,0.08,cx4,0.11,cz4);
      var fl2=anfxBox(grp,cm,0.05,0.10,0.05,cx4,0.28,cz4);
      ANFX.items.push(fl2);
    }
  } else if(kind==='feast'){
    var tm2=anfxMat(0x8a7a5e,1.0);
    anfxBox(grp,tm2,5.2,0.08,1.3,p.x,0.76,p.z);
    for(i=0;i<6;i++) anfxBox(grp,anfxMat(0x6a5a42,1.0),0.10,0.74,0.10,p.x-2.4+i*0.96,0.37,p.z);
    for(i=0;i<8;i++){
      var px7=p.x-2.1+i*0.6;
      ANFX.items.push(anfxBox(grp,anfxMat(0xd8d2c4,1.1),0.30,0.05,0.30,px7,0.83,p.z));
      var fc=[0x8a4a2a,0xc8a24a,0x5a7a42][i%3];
      ANFX.items.push(anfxBox(grp,anfxMat(fc,1.05),0.23,0.09,0.23,px7,0.88,p.z));
      ANFX.items.push(anfxBox(grp,anfxMat(0xe8e2d4,0.95),0.10,0.06,0.10,px7+0.05,0.92,p.z));
    }
    for(i=0;i<6;i++){
      ANFX.items.push(anfxBox(grp,anfxMat(0x6a5238,1.0),0.26,0.015,0.015,p.x-2.4+i*0.96,0.87,p.z+0.18));
    }
    try{
      var RF=(S.mode==='in')?INTERIORS[S.room]:null;
      if(RF){
        var lantR=anfxMat(0xc2352a,1.0), lantY=anfxMat(0xe8c05a,1.0),
            lantW=anfxMat(0xf2dca8,1.0), cloth=anfxMat(0xb02a22,1.0);
        var lc,lr,lk;
        var lampN=0;
        for(lr=2;lr<RF.rows-2&&lampN<30;lr+=5){
          for(lc=2;lc<RF.cols-2&&lampN<30;lc+=7){
            var lw=worldToScene(RF.ox+(lc+0.5)*RF.tw, RF.oy+(lr+0.5)*RF.th, RF);
            var ln=fxMesh('lantern'); ln.position.set(lw.x,0,lw.z); grp.add(ln);   /* 红灯笼 */
            lampN++;
          }
        }
        for(lk=0;lk<4;lk++){
          var by2=2.86, bz2=(lk%2?1:-1)*(RF.rows*RF.th*U2M*0.22)+0;
          anfxBox(grp,cloth,RF.cols*RF.tw*U2M*0.9,0.02,0.34,0,by2,bz2);
        }
        var foodN=0, fc2=[0x8a4a2a,0xc8a24a,0x5a7a42,0xd8d2c4,0xa8503a];
        for(lr=1;lr<RF.rows-1&&foodN<26;lr++){
          for(lc=1;lc<RF.cols-1&&foodN<26;lc++){
            if(RF.grid[lr][lc]!=='R') continue;
            var fw=worldToScene(RF.ox+(lc+0.5)*RF.tw, RF.oy+(lr+0.5)*RF.th, RF);
            anfxBox(grp,anfxMat(0xd8d2c4,1.1),0.34,0.04,0.34,fw.x,0.80,fw.z);   /* 盘 */
            anfxBox(grp,anfxMat(fc2[foodN%5],1.05),0.26,0.10,0.26,fw.x,0.86,fw.z); /* 菜 */
            if(foodN%3===0) anfxBox(grp,anfxMat(0xe8e2d4,0.95),0.12,0.14,0.12,fw.x+0.30,0.86,fw.z); /* 汤碗 */
            foodN++;
          }
        }
      }
    }catch(e){}
  } else if(kind==='lamps'){
    var lm2=anfxMat(0xf4f8ff,1.0), lmS=anfxMat(0x3a444a,1.0);
    var bestD=1e9, bestI=0, li2;
    for(i=0;i<16;i++){
      var lx2=p.x-14+i*1.9;
      var lp=anfxBox(grp,lm2,1.5,0.06,0.22,lx2,2.94,p.z);
      lp.visible=false;
      lp.userData={x:lx2,d:Math.abs(lx2-p.x)};
      if(lp.userData.d<bestD){ bestD=lp.userData.d; bestI=i; }
      ANFX.items.push(lp);
    }
    AN.data.lampPick=bestI;
    var spot=anfxBox(grp,lmS,1.30,0.012,1.30,p.x,0.012,p.z);
    spot.visible=false;
    ANFX.items.push(spot);
  } else if(kind==='chalk'){
    var _ws=null;
    try{ var _RR=INTERIORS[S.room]; if(_RR) _ws=wallFaceSnap(_RR,S.x,S.y); }catch(e){}
    var bp=_ws?_ws.s:p;
    var bxW=(_ws&&_ws.nx)?0.035:4.2, bxD=(_ws&&_ws.nx)?4.2:0.035;
    var boxN=0.19;                    /* 教室本来就有一块黑板，往前让 19 厘米才露得出来 */
    var bpx=bp.x+(_ws?_ws.nx*boxN:0), bpz=bp.z+(_ws?_ws.nz*boxN:0);
    ANFX.items.push(anfxBox(grp,anfxMat(0x171c20,1.0),bxW,1.02,bxD,bpx,1.58,bpz));
    for(i=0;i<5;i++){
      var cwid=1.4+i*0.42, cy3=2.00-i*0.13;
      ANFX.items.push(anfxBox(grp,anfxMat(0xe6e8e2,0.92),
        (_ws&&_ws.nx)?0.03:cwid, 0.055, (_ws&&_ws.nx)?cwid:0.03,
        bp.x+(_ws?_ws.nx*(boxN+0.03):0), cy3, bp.z+(_ws?_ws.nz*(boxN+0.03):0)));
    }
  } else if(kind==='roster'){
    var _ws2=null;
    try{ var _R2=INTERIORS[S.room]; if(_R2) _ws2=wallFaceSnap(_R2,S.x,S.y); }catch(e){}
    var rp=_ws2?_ws2.s:p;
    var pW=(_ws2&&_ws2.nx)?0.045:1.1, pD=(_ws2&&_ws2.nx)?1.1:0.045;
    ANFX.items.push(anfxBox(grp,anfxMat(0xd6d2c8,1.0),pW,1.5,pD,rp.x,1.55,rp.z));
    for(i=0;i<9;i++){
      ANFX.items.push(anfxBox(grp,anfxMat(0x4a4a46,1.0),
        (_ws2&&_ws2.nx)?0.02:0.82, 0.035, (_ws2&&_ws2.nx)?0.82:0.02,
        rp.x+(_ws2?_ws2.nx*0.035:0), 1.95-i*0.15, rp.z+(_ws2?_ws2.nz*0.035:0)));
    }
  } else if(kind==='broad'){
    for(i=0;i<2;i++){
      var bx3=p.x+ (i?1:-1)*1.9;
      ANFX.items.push(anfxBox(grp,anfxMat(0x3a4046,1.0),0.42,0.42,0.30,bx3,2.55,p.z));
      ANFX.items.push(anfxBox(grp,anfxMat(0xb8c4c8,1.15),0.26,0.26,0.06,bx3,2.55,p.z+0.17));
    }
  } else if(kind==='repeat'){
    var pm2=anfxMat(0x1a2024,1.0);
    var pg=new THREE.Group(); anfxFigure(pg,pm2,0,0,1.0,false);
    pg.position.set(p.x,0,p.z);
    grp.add(pg); ANFX.items.push(pg);
  } else if(kind==='shifting'){
    var sm3=anfxMat(0x9fb6c8,0.75);
    for(i=0;i<4;i++){
      ANFX.items.push(anfxBox(grp,sm3,1.4,1.1,0.04,p.x-2.4+i*1.6,1.85,p.z));
    }
  } else if(kind==='cold'){
    var fm2=anfxMat(0xa8c0cc,0.30);
    var fq=new THREE.Mesh(new THREE.PlaneGeometry(6,6),fm2);
    fq.rotation.x=-Math.PI/2; fq.position.set(p.x,0.05,p.z);
    grp.add(fq); ANFX.items.push(fq);
  } else if(kind==='raindots'){
    var tex=handTex('明天的天气：阴');
    if(tex){
      var rdm=new THREE.MeshBasicMaterial({map:tex,transparent:true,opacity:0.0,depthWrite:false,fog:true,color:0x9fb6c4});
      var rd=new THREE.Mesh(new THREE.PlaneGeometry(4.2,0.95),rdm);
      var ang0=S.ang;
      rd.position.set(p.x+Math.cos(ang0)*3.2,0.02,p.z+Math.sin(ang0)*3.2);
      rd.rotation.x=-Math.PI/2; rd.rotation.z=-ang0-Math.PI/2;
      grp.add(rd); ANFX.items.push(rd);
    }
  } else if(kind==='stare'){
    /* 全体回头：教室四面墙上一只只睁开眼睛（参考《废墟图书馆》"目光"） */
    var spots=gazeWallSpots(INTERIORS[S.room],Quality.get().gazeEyes,12), gi;
    for(gi=0;gi<spots.length;gi++){
      var gs=spots[gi], gq=anfxW2S(gs.wx,gs.wy);
      var ge=gazeEye(0.8+Math.random()*0.9);
      var side=(Math.random()-0.5)*0.8*(TTILE*U2M);
      ge.position.set(gq.x+gs.nx*0.12+(gs.nz?side:0), 0.9+Math.random()*1.9, gq.z+gs.nz*0.12+(gs.nx?side:0));
      ge.userData={d:0.2+Math.random()*1.4, w:ge.scale.x, ph:Math.random()*6.283};
      grp.add(ge); ANFX.items.push(ge);
    }
    for(gi=0;gi<Quality.get().gazeFloat;gi++){       /* 还有几只就浮在你面前的半空里 */
      var fa3=S.ang+(Math.random()-0.5)*1.9, fr3=2.6+Math.random()*3.2;
      var fq3=anfxW2S(S.x+Math.cos(fa3)*fr3/U2M, S.y+Math.sin(fa3)*fr3/U2M);
      var fe=gazeEye(0.6+Math.random()*0.7);
      fe.position.set(fq3.x, 1.7+Math.random()*1.0, fq3.z);
      fe.userData={d:0.5+Math.random()*1.5, w:fe.scale.x, ph:Math.random()*6.283};
      grp.add(fe); ANFX.items.push(fe);
    }
  } else if(kind==='shadow'){
    var sm=anfxMat(0x05070a,0.72);
    var sq=new THREE.Mesh(new THREE.PlaneGeometry(0.9,1.6),sm);
    sq.rotation.x=-Math.PI/2;
    sq.position.set(p.x,0.02,p.z);
    grp.add(sq);
    ANFX.items.push(sq);
  }
  GLR.scene.add(grp);
}
function deathFX(type,options){
  try{
    anfxClear();
    var p=anfxW2S(S.x,S.y);
    var grp=new THREE.Group();
    ANFX.kind='death'; ANFX.grp=grp; ANFX.t=0; ANFX.deathType=type||'vignette';ANFX.preview=!!(options&&options.preview);
    ANFX.timeline=DeathTimeline.sample(ANFX.deathType,0);
    ANFX.mx=undefined; ANFX.mz=undefined; ANFX.flashed=0;
    var i, m;
    var dark=anfxMat(0x04060a,1.0);
    function push(o){ ANFX.items.push(o); return o; }
    var T=type||'vignette';

    if(T==='trash'){
      var oldWorld=S.mode==='in'?GLR.roomMesh:GLR.outMesh;
      if(oldWorld){ANFX.hiddenWorld={mesh:oldWorld,visible:oldWorld.visible};oldWorld.visible=false;}
      var barrel=new THREE.Mesh(new THREE.CylinderGeometry(1.1,0.9,2.1,20,1,true),
        new THREE.MeshBasicMaterial({color:0x314b38,side:THREE.DoubleSide}));
      barrel.position.set(p.x,1.05,p.z);grp.add(barrel);push(barrel);
      for(i=0;i<2;i++){
        var band=new THREE.Mesh(new THREE.TorusGeometry(0.98+i*0.08,0.025,6,20),
          new THREE.MeshBasicMaterial({color:0x60735b}));
        band.rotation.x=Math.PI/2;band.position.set(p.x,0.45+i*1.1,p.z);grp.add(band);
      }
      var hinge=new THREE.Group();hinge.position.set(p.x-1.1,2.1,p.z);
      var lid=new THREE.Mesh(new THREE.CylinderGeometry(1.12,1.12,0.07,20),
        new THREE.MeshBasicMaterial({color:0x263d2d}));
      lid.position.set(1.1,0,0);hinge.add(lid);hinge.rotation.z=1.45;
      hinge.userData={trashLid:true};grp.add(hinge);push(hinge);
    }
    else if(T==='vignette'){
      var vp=new THREE.Mesh(new THREE.PlaneGeometry(14,14),anfxMat(0x020304,0.92));
      vp.rotation.x=-Math.PI/2; vp.position.set(p.x,-1.0,p.z);
      grp.add(vp); push(vp);
      /* 一圈没有脸的高个子，一个接一个从暗处走出来，围拢过来（以前是十二块黑板子） */
      var vmat=anfxMat(0x030405,1.0);
      for(i=0;i<10;i++){
        var va=i/10*6.283+(i%2)*0.18;
        var vf=new THREE.Group();vf.add(figMesh('tall',vmat,1));
        vf.position.set(p.x+Math.cos(va)*4.2,0,p.z+Math.sin(va)*4.2);
        vf.userData={a:va,delay:((i*7)%10)*0.11};
        grp.add(vf);push(vf);
      }
    }
    else if(T==='floor'||T==='deep'){
      var pl=new THREE.Mesh(new THREE.PlaneGeometry(10,10),anfxMat(0x020304,0.94));
      pl.rotation.x=-Math.PI/2; pl.position.set(p.x,-1.0,p.z);
      grp.add(pl); push(pl);
      if(T==='deep'){
        for(i=0;i<10;i++){
          var a=i/10*6.283;
          m=anfxBox(grp,dark,0.10,2.4,0.10,p.x+Math.cos(a)*0.9,-1.0,p.z+Math.sin(a)*0.9);
          push(m);
        }
      }
    }
    else if(T==='grip'){
      var hp=anfxW2S(S.x,S.y);
      var flesh=anfxMat(0x6f6a63,1.0);          /* 灰白的手，不吃光 */
      var hn=11, hi, hf;
      for(hi=0;hi<hn;hi++){
        var hang=hi/hn*6.283+(Math.random()-0.5)*0.28;
        var hrad=0.85+Math.random()*1.5;
        var hx=hp.x+Math.cos(hang)*hrad, hz=hp.z+Math.sin(hang)*hrad;
        var hg=new THREE.Group();
        hg.add(fxMesh('hand'));                                 /* 掌、五根弯着的手指、一截小臂 */
        hg.position.set(hx,-1.0,hz);
        hg.rotation.y=-(Math.PI/2+hang);                        /* 手指朝圆心 */
        hg.userData={t:hi*0.085, ph:Math.random()*6.283};
        grp.add(hg); push(hg);
      }
    }
    else if(T==='hand'){
      var gx=S.x+Math.cos(S.ang)*9, gy=S.y+Math.sin(S.ang)*9;
      var q=anfxW2S(gx,gy);
      var gap=new THREE.Mesh(new THREE.PlaneGeometry(1.5,0.55),anfxMat(0x020304,0.95));
      gap.rotation.x=-Math.PI/2;gap.rotation.z=-S.ang;
      gap.position.set(q.x,0.015,q.z);grp.add(gap);
      var stallHand=new THREE.Group();stallHand.add(fxMesh('hand'));
      stallHand.position.set(q.x,-0.35,q.z);
      stallHand.rotation.y=-Math.PI/2-S.ang;stallHand.rotation.x=-0.8;
      stallHand.scale.setScalar(1.4);stallHand.userData={stallHand:true};
      grp.add(stallHand);push(stallHand);
    }
    else if(T==='neck'){
      var nq=anfxW2S(S.x+Math.cos(S.ang)*2.6, S.y+Math.sin(S.ang)*2.6);
      var flesh=anfxMat(0x7c302c,1.0);
      var nseg=8, sh=0.42;
      for(i=0;i<nseg;i++){
        var sg=new THREE.Mesh(new THREE.CylinderGeometry(0.075,0.085,sh,8),flesh);   /* 一节一节的脖子 */
        sg.position.set(nq.x,0.21+i*sh,nq.z); grp.add(sg);
        sg.visible=false;
        push(sg);
      }
      var head=new THREE.Group();
      head.add(fxMesh('neckhead'));
      head.position.set(nq.x,0.21,nq.z);
      head.visible=false;
      grp.add(head); push(head);
      ANFX.neck={n:nseg,sh:sh,x:nq.x,z:nq.z};
    }
    else if(T==='swarm'||T==='shatter'){
      var col=(T==='swarm')?dark:anfxMat(0x8a8680,1.0);
      var N=(T==='swarm')?56:40;
      for(i=0;i<N;i++){
        var aa=Math.random()*6.283, rr=1.2+Math.random()*5.0;
        m=anfxBox(grp,col,0.05+Math.random()*0.08,0.05+Math.random()*0.08,0.05+Math.random()*0.08,
                  p.x+Math.cos(aa)*rr, 0.6+Math.random()*2.2, p.z+Math.sin(aa)*rr);
        m.userData={a:aa,r:rr};
        push(m);
      }
    }
    else if(T==='drown'){
      var wp=new THREE.Mesh(new THREE.PlaneGeometry(9,9),anfxMat(0x20303a,0.82));
      wp.rotation.x=-Math.PI/2; wp.position.set(p.x,-1.4,p.z);
      wp.userData={rises:1};
      grp.add(wp); push(wp);
      for(i=0;i<22;i++){                        /* 气泡 */
        var bb=anfxBox(grp,anfxMat(0x9fc4d8,0.55),0.06,0.06,0.06,p.x+(Math.random()-0.5)*4,0.2+Math.random()*1.4,p.z+(Math.random()-0.5)*4);
        bb.userData={bub:1};
        push(bb);
      }
    }
    else if(T==='water'){
      var wq=new THREE.Mesh(new THREE.PlaneGeometry(11,11),anfxMat(0x16242c,0.55));
      wq.rotation.x=-Math.PI/2; wq.position.set(p.x,2.9,p.z);
      wq.userData={sinks:1};
      grp.add(wq); push(wq);
      for(i=0;i<10;i++){                        /* 水下的光斑 */
        var ca=anfxBox(grp,anfxMat(0x4a7a8c,0.30),0.7,0.02,0.7,p.x+(Math.random()-0.5)*6,2.6,p.z+(Math.random()-0.5)*6);
        ca.userData={caustic:1};
        push(ca);
      }
    }
    else if(T==='freeze'){
      var ic=anfxMat(0xcfe4ee,0.8);
      for(i=0;i<26;i++){
        var fa2=i/26*6.283, fr2=2.2+Math.random()*2.6;
        var ih=0.5+Math.random()*1.5;
        var iw=anfxBox(grp,ic,0.10,ih,0.10,p.x+Math.cos(fa2)*fr2,ih/2,p.z+Math.sin(fa2)*fr2);
        iw.rotation.z=(Math.random()-0.5)*0.35;
        push(iw);
      }
      for(i=0;i<8;i++) push(anfxBox(grp,anfxMat(0xa8c8d8,0.45),0.5,0.02,0.5,p.x+(Math.random()-0.5)*5,1.4+i*0.16,p.z+(Math.random()-0.5)*5));
    }
    else if(T==='stare'){
      var sp0=anfxW2S(S.x,S.y);
      var hk=anfxMat(0x2a2f33,1.0), hf=anfxMat(0xb8b2a6,0.95), hd2=anfxMat(0x0a0d10,1.0);
      for(i=0;i<14;i++){
        var ha=i/14*6.283+0.2, hr2=2.4+Math.random()*2.2, hy=1.45+Math.random()*0.5;
        var hx2=sp0.x+Math.cos(ha)*hr2, hz2=sp0.z+Math.sin(ha)*hr2;
        var hg=new THREE.Group();
        hg.add(fxMesh('head'));                              /* 后脑、苍白的脸、黑眼窝、脖子和肩 */
        hg.position.set(hx2,hy,hz2);
        hg.userData={head:1,a:ha,r:hr2,y:hy};
        grp.add(hg); push(hg);
      }
    }
    else if(T==='gaze'){
      var gp=anfxW2S(S.x,S.y);
      /* 黑暗里一圈一圈睁开的眼睛：火苗一样的黄眼眶，螺旋的金色 / 血红虹膜（"目光"） */
      var eyeN=(T==='stare')?26:20, ei;
      for(ei=0;ei<eyeN;ei++){
        var ea=Math.random()*6.283, er=1.9+Math.random()*3.8;
        var ey=0.45+Math.random()*2.2;
        var es=0.55+Math.random()*0.75;            /* 大小不一，像画上去的 */
        var eg=gazeEye(1);
        eg.material.opacity=1;
        eg.position.set(gp.x+Math.cos(ea)*er, ey, gp.z+Math.sin(ea)*er);
        eg.scale.set(es,es*0.6875,1);
        eg.userData={i:ei, a:ea, r:er, y:ey, s:es};
        grp.add(eg); push(eg);
      }
      GLR.gazeT=1;
    }
    else if(T==='voice'){
      for(i=0;i<9;i++){
        var rr2=0.5+i*0.85;
        var rq=anfxBox(grp,anfxMat(0x6a747c,0.42),rr2*2,0.03,0.04,p.x,1.55,p.z+rr2);
        rq.userData={wave:i};
        push(rq);
        push(anfxBox(grp,anfxMat(0x6a747c,0.42),0.04,0.03,rr2*2,p.x+rr2,1.55,p.z));
      }
    }
    else if(T==='bell'){
      var bz=anfxW2S(S.x,S.y);
      var bm=fxMesh('bell'); bm.position.set(bz.x,0,bz.z); grp.add(bm); push(bm);
      push(anfxBox(grp,anfxMat(0x0a0d10,0.45),2.1,0.006,2.1,bz.x,0.008,bz.z));
    }
    else if(T==='follow'){
      for(i=0;i<5;i++){
        var fa=(i/5)*6.283+0.5;
        var fq=anfxW2S(S.x+Math.cos(S.ang)*9+Math.cos(fa)*3, S.y+Math.sin(S.ang)*9+Math.sin(fa)*3);
        var fg=new THREE.Group(); anfxFigure(fg,dark,0,0,1.15,false);
        fg.position.set(fq.x,0,fq.z);
        fg.userData={ring:fa};
        grp.add(fg); push(fg);
      }
    }
    else if(T==='shadow'){
      var sq=anfxW2S(S.x-Math.cos(S.ang)*14, S.y-Math.sin(S.ang)*14);
      var sg=new THREE.Group(); anfxFigure(sg,dark,0,0,1.0,false);
      sg.position.set(sq.x,0,sq.z);
      sg.userData={behind:1};
      grp.add(sg); push(sg);
      push(anfxBox(grp,anfxMat(0x0a0d10,0.55),0.7,0.005,2.2,sq.x,0.006,sq.z+0.9));
    }
    else if(T==='twin'){
      var tq=anfxW2S(S.x+Math.cos(S.ang)*16, S.y+Math.sin(S.ang)*16);
      var tg=new THREE.Group(); anfxFigure(tg,dark,0,0,1.2,false);
      tg.position.set(tq.x,0,tq.z);
      tg.userData={twin:1};
      grp.add(tg); push(tg);
      push(anfxBox(grp,anfxMat(0x0a0d10,0.5),0.7,0.005,2.4,tq.x,0.006,tq.z));
    }
    else if(T==='names'){
      var nmr, nmc;
      for(nmr=0;nmr<6;nmr++){
        for(nmc=0;nmc<7;nmc++){
          var nx=p.x-2.6+nmc*0.86, ny=0.55+nmr*0.46;
          push(anfxBox(grp,anfxMat(0x1a2024,1.0),0.78,0.40,0.05,nx,ny,p.z+2.6));
          push(anfxBox(grp,anfxMat(0xb8b2a6,0.9),0.58,0.05,0.02,nx,ny+0.08,p.z+2.63));
          push(anfxBox(grp,anfxMat(0x8a8478,0.9),0.40,0.04,0.02,nx,ny-0.06,p.z+2.63));
        }
      }
    }
    else if(T==='chalk'){
      push(anfxBox(grp,anfxMat(0x141a1e,1.0),6.4,2.4,0.10,p.x,1.55,p.z+2.6));
      push(anfxBox(grp,anfxMat(0x2a3338,1.0),6.5,0.08,0.16,p.x,0.34,p.z+2.62));
      for(i=0;i<7;i++){
        push(anfxBox(grp,anfxMat(0xd8d2c4,0.95),1.4+Math.random()*3.4,0.09,0.02,
             p.x-2.2+Math.random()*2.0, 2.35-i*0.29, p.z+2.66));
      }
    }
    else if(T==='loop'){
      for(i=0;i<7;i++){
        var lx3=p.x+Math.cos(S.ang+i*0.9)*(2.2+i*0.9);
        var lz3=p.z+Math.sin(S.ang+i*0.9)*(2.2+i*0.9);
        push(anfxBox(grp,anfxMat(0x3a2a1e,1.0),0.12,2.30,1.0,lx3,1.15,lz3));
        push(anfxBox(grp,anfxMat(0x0d1114,1.0),0.10,2.10,0.82,lx3,1.05,lz3));
        push(anfxBox(grp,anfxMat(0x2a1f16,1.0),0.16,0.10,1.14,lx3,2.32,lz3));
      }
    }
    else if(T==='ring'){
      for(i=0;i<16;i++){
        var ra=i/16*6.283;
        var rs=anfxBox(grp,anfxMat(0xd8d4cc,1.0),0.10,0.10,0.10,
             p.x+Math.cos(ra)*2.2,0.02,p.z+Math.sin(ra)*2.2);
        rs.userData={a:ra};
        push(rs);
      }
      for(i=0;i<4;i++){                                    /* 四根蜡烛的火苗，一起朝你歪 */
        var ca5=i/4*6.283+0.6;
        anfxBox(grp,anfxMat(0xffc860,1.0),0.05,0.12,0.05,p.x+Math.cos(ca5)*1.6,0.30,p.z+Math.sin(ca5)*1.6).rotation.z=0.5;
      }
    }
    else if(T==='lamps'){
      for(i=0;i<16;i++){
        var ra2=i/16*6.283;
        var lm3=anfxBox(grp,anfxMat(0xfff2d0,1.0),0.26,0.10,0.26,
             p.x+Math.cos(ra2)*2.25,2.55,p.z+Math.sin(ra2)*2.25);
        lm3.visible=false; lm3.userData={i:i};
        push(lm3);
      }
      var lh=anfxBox(grp,anfxMat(0x0a0d10,0.55),7.0,0.04,7.0,p.x,2.78,p.z);
      push(lh);
    }
    else if(T==='laugh'){
      for(i=0;i<16;i++){
        var la=(i/16)*6.283+Math.random()*0.35, lr=0.30+Math.random()*0.55;
        var cc2=anfxBox(grp,anfxMat(0xe8ece6,0.88),0.028,0.028,1.0,
             p.x+Math.cos(la)*lr, 1.35+Math.random()*0.75, p.z+Math.sin(la)*lr);
        cc2.rotation.y=Math.PI/2-la;
        cc2.userData={a:la,r:lr};
        push(cc2);
      }
      var lsh=anfxBox(grp,anfxMat(0x0a0d10,0.42),6.0,0.02,6.0,p.x,1.2,p.z);
      lsh.rotation.y=-Math.PI/2-S.ang;
      push(lsh);
    }
    else if(T==='mirror'){
      var mq=anfxW2S(S.x+Math.cos(S.ang)*1.55, S.y+Math.sin(S.ang)*1.55);
      var mf=anfxBox(grp,anfxMat(0x161d22,0.96),1.30,2.30,0.10,mq.x,1.16,mq.z);
      mf.rotation.y=-Math.PI/2-S.ang;
      push(mf);
      var mgl=new THREE.Mesh(new THREE.PlaneGeometry(1.14,2.14),anfxMat(0x26343c,0.62));
      mgl.position.set(mq.x+Math.cos(S.ang)*0.06,1.16,mq.z+Math.sin(S.ang)*0.06);
      mgl.rotation.y=-Math.PI/2-S.ang;
      grp.add(mgl); push(mgl);
      var mir=new THREE.Group();
      anfxFigure(mir,anfxMat(0x0a1013,1.0),0,0,1.02,false);
      mir.position.set(mq.x,0,mq.z);
      mir.rotation.y=-Math.PI/2-S.ang;
      grp.add(mir); push(mir);
    }
    else if(T==='face'){
      /* 问路人：路人背对着停下，慢慢转过头——没有脸，只有一个在笑的洞——然后径直走过来 */
      var fa=S.ang, ff={x:Math.cos(fa),z:Math.sin(fa)}, ffront=-Math.PI/2-fa;
      ANFX.faceWalk={o:{x:p.x,z:p.z},f:ff,front:ffront};
      var walker=new THREE.Group();
      walker.add(figMesh('person',anfxMat(0x0a0c0e,1.0),1));
      var hole=new THREE.Group();hole.add(fxMesh('smile'));
      hole.scale.setScalar(0.2);hole.position.set(0,1.72-1.72*0.2,0.06);hole.visible=false;
      hole.userData={faceHole:1};walker.add(hole);
      walker.userData={faceWalker:1,hole:hole};
      grp.add(walker); push(walker);
    }
    else if(T==='squeeze'){
      /* 翻墙：墙外还有一道墙，再外面还有一道；最后两边的墙一起挤过来 */
      var qa=S.ang, qf={x:Math.cos(qa),z:Math.sin(qa)}, qr={x:-Math.sin(qa),z:Math.cos(qa)}, qrot=Math.PI/2-qa;
      ANFX.squeeze={o:{x:p.x,z:p.z},f:qf,r:qr};
      var brick=anfxMat(0x3a2f2c,1.0), cap=anfxMat(0x6c675f,1.0);
      for(i=0;i<4;i++){                          /* 一道接一道的墙 */
        var w=new THREE.Group(),wb=new THREE.Mesh(new THREE.BoxGeometry(9,2.8,0.36),brick),wc=new THREE.Mesh(new THREE.BoxGeometry(9.2,0.12,0.5),cap);
        wb.position.y=1.4;wc.position.y=2.86;w.add(wb);w.add(wc);
        w.position.set(p.x+qf.x*(1.1+i*1.8),0,p.z+qf.z*(1.1+i*1.8));w.rotation.y=qrot;
        w.userData={wallRow:i};grp.add(w);push(w);
      }
      for(i=0;i<2;i++){                          /* 两侧挤过来的墙 */
        var sq=anfxBox(grp,anfxMat(0x2b3036,1.0),0.30,3.4,8.0,p.x,1.7,p.z);
        sq.rotation.y=qrot;sq.userData={s:i?1:-1};push(sq);
      }
    }
    else if(T==='slit'){
      /* 正门：门缝里漏进一道光，挤过去以后是一条长马路，路的尽头又是一扇校门；身后的门合上了 */
      var sa=S.ang, sf={x:Math.cos(sa),z:Math.sin(sa)}, sr={x:-Math.sin(sa),z:Math.cos(sa)}, srot=Math.PI/2-sa;
      ANFX.slit={o:{x:p.x,z:p.z},f:sf,r:sr};
      var leaf=anfxMat(0x101316,1.0), glow=new THREE.MeshBasicMaterial({color:0xd6e2dd,transparent:true,opacity:0.9,fog:false});
      for(i=0;i<4;i++){                       /* 0、1：挤过去的那扇门；2、3：最后在面前合上的那扇 */
        var lf=anfxBox(grp,leaf,1.25,2.7,0.10,p.x,1.35,p.z);lf.rotation.y=srot;
        lf.userData={slitLeaf:i,side:i%2?1:-1};push(lf);
      }
      var light=new THREE.Mesh(new THREE.PlaneGeometry(1.0,2.6),glow);light.rotation.y=srot+Math.PI;
      light.userData={slitLight:1};grp.add(light);push(light);
      var gate=new THREE.Group(), gm=anfxMat(0x07090b,1.0);
      [[-2.4,1.6,0.35,3.2],[2.4,1.6,0.35,3.2],[0,3.3,5.2,0.3]].forEach(function(b){
        var gb=new THREE.Mesh(new THREE.BoxGeometry(b[2],b[3],0.35),gm);gb.position.set(b[0],b[1],0);gate.add(gb);
      });
      gate.rotation.y=srot;gate.userData={slitGate:1};grp.add(gate);push(gate);
    }
    else if(T==='wall'){
      for(i=0;i<2;i++) push(anfxBox(grp,anfxMat(0x9a958c,1.0),0.6,3.0,4.0,p.x+(i?1.2:-1.2),1.5,p.z));
    }
    else {
      var fq2=anfxW2S(S.x+Math.cos(S.ang)*26, S.y+Math.sin(S.ang)*26);
      anfxFigure(grp,dark,0,0,1.15,false);
      grp.position.set(fq2.x,0,fq2.z);
    }
    ANFX.items.forEach(function(item){
      item.userData=item.userData||{};
      item.userData.deathOrigin={x:item.position.x,y:item.position.y,z:item.position.z};
    });
    GLR.scene.add(grp);
  }catch(e){}
}
function anfxUpdate(dt){
  if(!ANFX.kind||!ANFX.grp) return;
  ANFX.t+=dt;
  if(ANFX.kind==='death') ANFX.timeline=DeathTimeline.sample(ANFX.deathType,ANFX.t);
  var i,m;
  if(ANFX.kind==='rain'){
    wxRainUpdate(dt);
  } else if(ANFX.kind==='moth'){
    wxMothUpdate(dt);
  } else if(ANFX.kind==='cup'){
    cupFxUpdate(dt);
  } else if(ANFX.kind==='exercise'){
    for(i=0;i<ANFX.items.length;i++){
      m=ANFX.items[i];
      m.rotation.x=-0.25+Math.sin(ANFX.t*2.2+i)*0.35;
    }
  } else if(ANFX.kind==='leak'){
    for(i=5;i<ANFX.items.length;i++){
      m=ANFX.items[i]; m.position.y-=dt*4.6;
      if(m.position.y<-0.4) m.position.y+=2.6;
    }
  } else if(ANFX.kind==='lamps'){
    var lit=Math.floor((ANFX.t*2.6)%20);
    for(i=0;i<ANFX.items.length;i++) ANFX.items[i].visible=(i<=lit);
  } else if(ANFX.kind==='chalk'){
    for(i=1;i<ANFX.items.length;i++){
      m=ANFX.items[i]; m.position.y-=dt*0.08;
      if(m.position.y<0.9) m.position.y=2.05;
    }
  } else if(ANFX.kind==='shifting'){
    for(i=0;i<ANFX.items.length;i++) ANFX.items[i].position.x+=Math.sin(ANFX.t*0.5+i)*dt*0.5;
  } else if(ANFX.kind==='broad'){
    var pulse=0.6+0.4*Math.abs(Math.sin(ANFX.t*6));
    for(i=1;i<ANFX.items.length;i+=2) ANFX.items[i].scale.setScalar(0.8+pulse*0.3);
  } else if(ANFX.kind==='death'){
    var dtp=ANFX.deathType||'vignette', kk=ANFX.t, it, ob;
    /* 预览只改变渲染镜头；玩家可以在预览期间移动或转头。 */
    var preview=ANFX.preview, view=preview?{ang:S.ang,pitch:S.pitch,eyeLift:S.eyeLift}:S;
    if(dtp==='trash'){
      var tp=ANFX.timeline.progress,close=clamp((tp-0.12)/0.44,0,1);
      var easeClose=close*close*(3-2*close);
      for(it=0;it<ANFX.items.length;it++){
        ob=ANFX.items[it];if(ob.userData&&ob.userData.trashLid)ob.rotation.z=1.45*(1-easeClose);
      }
      view.eyeLift=-0.8*clamp(tp/0.5,0,1);
      view.pitch=0.65*clamp(tp/0.25,0,1);
      try{syncCamera(0,preview?view:null);}catch(e){}
    } else if(dtp==='floor'||dtp==='deep'){
      /* 镜头往下沉，黑水一样的地面往上漫，在 1.8 秒左右合上 */
      for(it=0;it<ANFX.items.length;it++){
        ob=ANFX.items[it];
        if(ob.geometry&&ob.geometry.type==='PlaneGeometry') ob.position.y=Math.min(GLR.cam.position.y-0.08,-1.0+kk*0.95);
        else ob.position.y=-1.2+Math.min(2.6,kk*1.1);
      }
    } else if(dtp==='vignette'){
      /* 按经过的时间算：先在 4 米外站定，再一个接一个往里走，最后贴到身边、微微俯下来 */
      var vc=ANFX.items[0].position;
      for(it=0;it<ANFX.items.length;it++){
        ob=ANFX.items[it]; var vu=ob.userData||{};
        if(vu.a===undefined) continue;
        var vk=Math.max(0,kk-0.35-vu.delay), vr=Math.max(0.75,4.2-vk*1.7);
        ob.position.x=vc.x+Math.cos(vu.a)*vr;
        ob.position.z=vc.z+Math.sin(vu.a)*vr;
        ob.rotation.y=Math.atan2(vc.x-ob.position.x,vc.z-ob.position.z);
        ob.rotation.x=0.18*clamp((2.4-vr)/1.6,0,1);
        ob.visible=kk>vu.delay*0.6;
      }
    } else if(dtp==='lamps'){
      /* 一圈灯依次亮起，然后一起压到头顶（以前这些灯永远不可见） */
      var conv=Math.min(1,Math.max(0,(kk-1.4)/1.2));
      var pc=anfxW2S(S.x,S.y);
      for(it=0;it<ANFX.items.length;it++){
        ob=ANFX.items[it]; var lu=ob.userData||{};
        if(lu.i===undefined) continue;
        ob.visible=(kk*11>lu.i);
        var la2=lu.i/16*6.283+conv*1.2, lr2=2.25-conv*1.9;
        ob.position.set(pc.x+Math.cos(la2)*lr2, 2.55-conv*0.55, pc.z+Math.sin(la2)*lr2);
        ob.scale.setScalar(1+conv*1.6);
      }
      try{ GLR.flash=Math.max(GLR.flash||0,conv*0.9); }catch(e){}
    } else if(dtp==='laugh'){
      var pa2=anfxW2S(S.x,S.y);
      for(it=0;it<ANFX.items.length;it++){
        ob=ANFX.items[it]; var lu=ob.userData||{};
        if(lu.a===undefined) continue;
        var grow=0.25+kk*1.9;
        ob.scale.z=grow;
        var r0=lu.r+grow*0.5;
        ob.position.x=pa2.x+Math.cos(lu.a)*r0;
        ob.position.z=pa2.z+Math.sin(lu.a)*r0;
      }
      try{ GLR.flash=Math.max(GLR.flash||0,Math.max(0,0.85-kk*0.5)); }catch(e){}
    } else if(dtp==='mirror'){
      var mg=ANFX.items[ANFX.items.length-1];
      if(mg&&mg.position){
        if(ANFX.mx===undefined){ ANFX.mx=mg.position.x; ANFX.mz=mg.position.z; }
        var step=Math.min(1.55,kk*0.85);
        mg.position.x=ANFX.mx+Math.cos(S.ang)*step;
        mg.position.z=ANFX.mz+Math.sin(S.ang)*step;
      }
      var fr=ANFX.items[0];
      if(fr&&fr.scale) fr.scale.set(1+kk*0.22,1+kk*0.16,1);
    } else if(dtp==='face'&&ANFX.faceWalk){
      /* 0–0.5 秒背对着站着；0.5–1.4 秒慢慢转过来，笑着的洞露出来；1.4 秒以后径直走过来，洞越张越大 */
      var fw=ANFX.faceWalk, wk=ANFX.items[0];
      if(wk&&wk.userData.faceWalker){
        var turn=clamp((kk-0.5)/0.9,0,1), ease=turn*turn*(3-2*turn), walk=clamp((kk-1.4)/1.2,0,1);
        var wd=4.6-walk*3.9;
        wk.position.set(fw.o.x+fw.f.x*wd,0,fw.o.z+fw.f.z*wd);
        wk.rotation.y=fw.front+Math.PI*(1-ease);
        var hole=wk.userData.hole; hole.visible=turn>0.45;
        var hk=0.2+walk*walk*0.35, hc=1.72-0.12*walk;          /* 洞的中心留在脸的位置（模型原点在底下，约 1.72 倍缩放处是中心） */
        hole.scale.setScalar(hk); hole.position.y=hc-1.72*hk;
        wk.position.y=-0.04*Math.abs(Math.sin(kk*5))*walk;     /* 走路的起伏 */
      }
    } else if(dtp==='squeeze'&&ANFX.squeeze){
      /* 0–2.4 秒：镜头一次次抬起翻过墙头，每翻一道，前面那道就往脚下沉、后面那道露出来；
         2.4 秒以后两侧的墙挤过来 */
      var qo=ANFX.squeeze.o, qf2=ANFX.squeeze.f, qr2=ANFX.squeeze.r, climb=Math.min(kk,2.4)/0.6;
      for(it=0;it<ANFX.items.length;it++){
        ob=ANFX.items[it]; var su=ob.userData||{};
        if(su.wallRow!==undefined){
          var over=clamp(climb-su.wallRow,0,1);
          ob.position.set(qo.x+qf2.x*(1.1+su.wallRow*1.8-over*1.8),-2.9*over,qo.z+qf2.z*(1.1+su.wallRow*1.8-over*1.8));
          ob.visible=over<1;
        }else if(su.s){
          var gap=Math.max(0.3,2.2-Math.max(0,kk-2.4)*1.6);
          ob.position.x=qo.x+qr2.x*su.s*gap; ob.position.z=qo.z+qr2.z*su.s*gap;
          ob.visible=kk>2.2;
        }
      }
      view.pitch=0.55*Math.abs(Math.sin(Math.min(climb,4)*Math.PI*0.5))*(kk<2.4?1:0)-(kk>2.4?0.08:0);
      try{syncCamera(0,preview?view:null);}catch(e){}
    } else if(dtp==='drown'){
      var wl=-1.2+Math.min(3.4,kk*1.35);
      for(it=0;it<ANFX.items.length;it++){
        ob=ANFX.items[it]; var du=ob.userData||{};
        if(du.rises){ ob.position.y=wl; }
        else if(du.bub){ ob.position.y=Math.min(2.4,0.2+kk*1.5+Math.sin(kk*9+it)*0.1); }
      }
    } else if(dtp==='water'){
      for(it=0;it<ANFX.items.length;it++){
        ob=ANFX.items[it]; var wu=ob.userData||{};
        if(wu.sinks){ ob.position.y=Math.max(0.6,2.9-kk*1.1); }
        else if(wu.caustic){ ob.position.y=2.6-Math.min(2.0,kk*0.8); ob.position.x=wu.deathOrigin.x+Math.sin(kk*3+it)*0.12; }
      }
    } else if(dtp==='freeze'){
      for(it=0;it<ANFX.items.length;it++){
        ob=ANFX.items[it]; var fu=ob.userData||{};
        ob.scale.set(1,Math.min(2.2,0.4+kk*1.1),1);
      }
    } else if(dtp==='voice'){
      for(it=0;it<ANFX.items.length;it++){
        ob=ANFX.items[it]; var vu2=ob.userData||{};
        if(vu2.wave===undefined) continue;
        ob.scale.set(1+kk*1.4,1,1+kk*0.6);
        ob.position.z=ANFX.items[0].position.z-0.5+(vu2.wave*0.85)*(1+kk*0.5);
      }
    } else if(dtp==='bell'){
      for(it=0;it<ANFX.items.length;it++){
        ob=ANFX.items[it];
        ob.rotation.z=Math.sin(kk*9+it)*0.05*Math.max(0,1-kk*0.3);   /* 钟还在嗡嗡地晃 */
        ob.position.y=Math.max(-0.6,-kk*0.25);                          /* 慢慢压下来 */
      }
    } else if(dtp==='names'){
      for(it=0;it<ANFX.items.length;it++){ ob=ANFX.items[it]; ob.visible=(it%3)<=Math.floor(kk*6)%3; }
    } else if(dtp==='chalk'){
      for(it=0;it<ANFX.items.length;it++){
        ob=ANFX.items[it];
        var cy=ob.userData.deathOrigin.y;
        if(cy>0.4&&cy<2.5) ob.position.y=cy-Math.min(0.9,kk*0.55);
      }
    } else if(dtp==='loop'){
      var camL=GLR.cam.position;
      for(it=0;it<ANFX.items.length;it++){
        ob=ANFX.items[it]; var lu2=ob.userData||{};
        ob.position.x=lu2.deathOrigin.x+Math.sin(kk*2+it*0.4)*0.04;
      }
    } else if(dtp==='slit'&&ANFX.slit){
      /* 按经过的时间：0–0.7 秒门缝里一道光；0.7–1.6 秒门缝拉开、从中间挤过去；
         1.6–3.0 秒马路尽头的校门迎面过来；最后身前又一扇门合上 */
      var so=ANFX.slit.o, sf2=ANFX.slit.f, sr2=ANFX.slit.r;
      function sAt(o,d,side){ o.position.x=so.x+sf2.x*d+sr2.x*side; o.position.z=so.z+sf2.z*d+sr2.z*side; }
      var pass=clamp((kk-0.7)/0.9,0,1), doorD=1.8-pass*2.6, gap=0.08+0.67*clamp((kk-0.7)/0.5,0,1);
      var shut=clamp((kk-3.0)/0.5,0,1), shutGap=1.4*(1-shut);
      for(it=0;it<ANFX.items.length;it++){
        ob=ANFX.items[it]; var su2=ob.userData||{};
        if(su2.slitLeaf!==undefined){
          if(su2.slitLeaf<2){ sAt(ob,doorD,su2.side*(0.625+gap/2)); ob.visible=doorD>-0.4; }
          else { sAt(ob,1.3,su2.side*(0.625+shutGap/2)); ob.visible=kk>2.9; }
        }else if(su2.slitLight){
          sAt(ob,doorD+0.25,0); ob.visible=doorD>-0.2;
          ob.material.opacity=0.9*(kk<0.7?0.55+0.45*Math.abs(Math.sin(kk*9)):1-pass*0.6);
        }else if(su2.slitGate){
          var gk=clamp((kk-1.6)/1.4,0,1); sAt(ob,30-gk*26,0); ob.visible=kk>1.5;
        }
      }
    } else if(dtp==='slit'||dtp==='wall'){
      for(it=0;it<ANFX.items.length;it++){ ob=ANFX.items[it]; ob.position.y=Math.min(1.6,kk*0.9); }
    } else if(dtp==='neck'){
      var nk=ANFX.neck||{n:8,sh:0.42,x:0,z:0};
      var topY=0.21+(nk.n-1)*nk.sh;
      var up=Math.round(Math.min(1,kk/1.1)*nk.n);
      for(it=0;it<nk.n;it++) ANFX.items[it].visible=(it<up);
      var hd=ANFX.items[nk.n];
      if(hd){
        if(kk<1.1){
          hd.visible=up>0;
          hd.position.set(nk.x,0.21+Math.max(0,up-1)*nk.sh,nk.z);
        }else if(kk<2.15){
          hd.visible=true;
          var k2=(kk-1.1)/1.05, e2=k2*k2;
          var cx3=GLR.cam.position.x, cy3=GLR.cam.position.y, cz3=GLR.cam.position.z;
          hd.position.set(nk.x+(cx3-nk.x)*e2, topY+(cy3-topY)*e2, nk.z+(cz3-nk.z)*e2);
          if(hd.scale&&hd.scale.setScalar) hd.scale.setScalar(1+e2*0.85);
          if(kk>1.55){ view.pitch=Math.min(0.35,view.pitch+(preview?(kk-1.55)*0.6:dt*0.6)); try{ syncCamera(0,preview?view:null); }catch(e){} }
        }else{
          var k3=Math.min(1,(kk-2.15)/0.95);
          view.eyeLift=k3*2.5;
          view.pitch=0.35+k3*0.55;
          try{ syncCamera(0,preview?view:null); }catch(e){}
          hd.position.set(GLR.cam.position.x,GLR.cam.position.y+0.25,GLR.cam.position.z);
          hd.visible=(k3<0.88);
        }
      }
    } else if(dtp==='hand'){
      var handProgress=ANFX.timeline.progress;
      var handRise=clamp((handProgress-0.12)/0.34,0,1);
      var handReach=clamp((handProgress-0.48)/0.32,0,1);
      var handPlayer=anfxW2S(S.x,S.y);
      for(it=0;it<ANFX.items.length;it++){
        ob=ANFX.items[it];var hu=ob.userData||{};
        if(!hu.stallHand)continue;
        ob.position.set(hu.deathOrigin.x+(handPlayer.x-hu.deathOrigin.x)*handReach*0.68,
          -0.35+handRise*1.45,hu.deathOrigin.z+(handPlayer.z-hu.deathOrigin.z)*handReach*0.68);
        ob.rotation.x=-0.8+handRise*0.8+handReach*0.35;
      }
    } else if(dtp==='swarm'||dtp==='shatter'){
      var pp=anfxW2S(S.x,S.y);
      for(it=0;it<ANFX.items.length;it++){
        ob=ANFX.items[it]; var u=ob.userData||{a:0,r:3};
        var rr=u.r*Math.max(0,1-kk*0.42);
        ob.position.x=pp.x+Math.cos(u.a)*rr;
        ob.position.z=pp.z+Math.sin(u.a)*rr;
      }
    } else if(dtp==='gaze'||dtp==='stare'){
      var near=Math.min(1,Math.max(0,(kk-1.0)/1.4));            /* 1 秒后开始逼近 */
      for(it=0;it<ANFX.items.length;it++){
        ob=ANFX.items[it]; var eu=ob.userData||{};
        if(eu.a===undefined) continue;
        if(eu.cx===undefined){                 /* 每只眼睛记下自己的圆心和基准高度 */
          eu.cx=ob.position.x-Math.cos(eu.a)*eu.r;
          eu.cz=ob.position.z-Math.sin(eu.a)*eu.r;
          eu.by=ob.position.y;
        }
        var rr3=eu.r*(1-near*0.72);
        ob.position.x=eu.cx+Math.cos(eu.a)*rr3;
        ob.position.z=eu.cz+Math.sin(eu.a)*rr3;
        ob.position.y=eu.by+near*0.35;
        if(eu.head){
          /* 围观使用人头模型，不能按眼睛 Sprite 的尺寸计算。 */
          ob.scale.setScalar(1+near*0.2);
          ob.lookAt(GLR.cam.position.x,GLR.cam.position.y,GLR.cam.position.z);
        }else{
          var gk=(eu.s||1)*(1+near*0.5);
          ob.scale.set(gk, gk*0.6875, 1);                 /* Sprite 始终正对镜头 */
        }
      }
    } else if(dtp==='grip'){
      var sinkT=Math.min(1,kk/2.4);
      view.eyeLift=-(sinkT*1.25);
      for(it=0;it<ANFX.items.length;it++){
        ob=ANFX.items[it]; var gu=ob.userData||{};
        if(gu.t===undefined) continue;
        if(kk<gu.t){ ob.visible=false; continue; }
        ob.visible=true;
        var up2=Math.min(1,(kk-gu.t)/1.05);
        if(up2<1){
          ob.position.y=-1.0+up2*1.75;                 /* 从地下伸到眼前 */
          ob.rotation.x=-0.9+0.9*up2;                  /* 手腕慢慢翻过来 */
        }else{
          ob.position.y=0.75+Math.sin(kk*1.8+gu.ph)*0.05;
          ob.rotation.x=0;
        }
      }
      try{ syncCamera(0,preview?view:null); }catch(e){}
    } else if(dtp==='ring'){
      /* 地上的石子一颗颗立起来，绕着你转，越收越紧，最后成了一个笼子 */
      var pr=anfxW2S(S.x,S.y);
      for(it=0;it<ANFX.items.length;it++){
        ob=ANFX.items[it]; var ru=ob.userData||{};
        if(ru.a===undefined) continue;
        var ang2=ru.a+kk*(1.2+kk*0.4), rad2=Math.max(0.75,2.2-kk*0.55);
        ob.position.set(pr.x+Math.cos(ang2)*rad2, Math.min(2.4,0.05+kk*0.7*(1+(it%4)*0.35)), pr.z+Math.sin(ang2)*rad2);
        ob.scale.set(1,1+Math.min(12,kk*5),1);
      }
    } else if(dtp==='twin'||dtp==='shadow'){
      /* 另一个你 / 你的影子：走过来，停在一臂远的地方；影子那种，镜头会被慢慢扭过去看它 */
      var fig=ANFX.items[0];
      if(fig&&fig.position){
        var pt=anfxW2S(S.x,S.y);
        var fdx=pt.x-fig.position.x, fdz=pt.z-fig.position.z, fdl=Math.hypot(fdx,fdz)||1;
        var stp=Math.min(Math.max(0,fdl-0.85),dt*(1.2+kk*2.4));
        fig.position.x+=fdx/fdl*stp; fig.position.z+=fdz/fdl*stp;
        fig.rotation.y=Math.atan2(fdx,fdz);
        if(dtp==='shadow'&&kk>0.6){
          var want3=Math.atan2(fig.position.z-pt.z,fig.position.x-pt.x);
          var d4=((want3-view.ang+PI*3)%TAU)-PI;
          view.ang+=d4*(preview?(1-Math.exp(-Math.max(0,kk-0.6)*1.6)):Math.min(1,dt*1.6));
          try{ syncCamera(0,preview?view:null); }catch(e){}
        }
        if(fdl<1.0&&!ANFX.flashed){ ANFX.flashed=1; GLR.flash=Math.max(GLR.flash||0,0.45); }
      }
    } else if(dtp==='follow'){
      /* 做操的人围上来；你的视线跟着节拍一上一下 */
      var pf=anfxW2S(S.x,S.y), rr4=Math.max(1.1,3.2-kk*1.0);
      for(it=0;it<ANFX.items.length;it++){
        ob=ANFX.items[it]; var fu2=ob.userData||{};
        if(fu2.ring===undefined) continue;
        var a6=fu2.ring+kk*0.25;
        ob.position.set(pf.x+Math.cos(a6)*rr4,0,pf.z+Math.sin(a6)*rr4);
        ob.rotation.y=Math.atan2(pf.x-ob.position.x,pf.z-ob.position.z);
        ob.rotation.x=Math.sin(kk*4.4)*0.35;
      }
      if(kk>1.0){ view.pitch=Math.sin(kk*4.4)*0.32; try{ syncCamera(0,preview?view:null); }catch(e){} }
    } else {
      /* 其它：一个黑影从前方走到你面前（以前这里的 z 坐标算成了两倍） */
      if(ANFX.grp&&ANFX.grp.position){
        var pq=anfxW2S(S.x,S.y);
        var dx=pq.x-ANFX.grp.position.x, dz=pq.z-ANFX.grp.position.z;
        var dl=Math.sqrt(dx*dx+dz*dz)||1, sp=Math.min(Math.max(0,dl-1.0),dt*(2+kk*3));
        ANFX.grp.position.x+=dx/dl*sp;
        ANFX.grp.position.z+=dz/dl*sp;
        ANFX.grp.rotation.y=Math.atan2(dx,dz);
      }
    }
  } else if(ANFX.kind==='stare'){
    /* 站着不动，眼睛就一只只睁得更开；走起来，它们半眯着跟着你 */
    var hold=(AN.active&&AN.id==='stare')?clamp(AN.acc/1.8,0,1):0;
    var hit=(AN.active&&AN.data&&AN.data.hit)?1:0;
    GLR.gazeT=0.35+0.45*hold+0.2*hit;
    GLR.gazeShake=hit?0.55:hold*0.12;
    for(i=0;i<ANFX.items.length;i++){
      m=ANFX.items[i]; var gu=m.userData;
      var ap=clamp((ANFX.t-gu.d)/0.6,0,1);                 /* 一只接一只睁开 */
      var lid=0.30+0.70*Math.max(hold,hit);
      /* 不眨眼：一直睁着盯着你 */
      var pulse=1+0.05*Math.sin(ANFX.t*3.1+gu.ph)+0.25*hit;
      m.scale.set(gu.w*pulse, gu.w*0.6875*lid*ap*pulse, 1);
      m.material.opacity=ap*(0.75+0.25*Math.max(hold,hit));
    }
  } else if(ANFX.kind==='shadow'){
    var ps=anfxW2S(S.x,S.y);
    ANFX.grp.position.set(ps.x+0.35,0,ps.z+0.5);
  } else if(ANFX.kind==='twin'){
    var tw0=ANFX.grp.children[0];
    if(tw0&&AN.data&&AN.data.x!==undefined){
      var tp=anfxW2S(AN.data.x,AN.data.y);
      tw0.position.set(tp.x,0,tp.z);
      tw0.rotation.y=Math.atan2(GLR.cam.position.x-tp.x,GLR.cam.position.z-tp.z);
    }
  } else if(ANFX.kind==='necker'){
    var nf=ANFX.items[0];
    if(nf){
      var np=anfxW2S(BOUND.x1*SC+16,S.y);
      nf.position.z+=(np.z-nf.position.z)*Math.min(1,dt*0.9);       /* 他跟着你走，慢半步 */
      nf.position.x=np.x;
      nf.rotation.y=Math.atan2(GLR.cam.position.x-nf.position.x,GLR.cam.position.z-nf.position.z);
      nf.rotation.z=Math.sin(ANFX.t*1.3)*0.05;
    }
  } else if(ANFX.kind==='raindots'){
    for(i=0;i<ANFX.items.length;i++){ m=ANFX.items[i]; if(m.material) m.material.opacity=Math.min(0.85,ANFX.t*0.12); }
  } else if(ANFX.kind==='rite'){
    for(i=0;i<ANFX.items.length;i++){ m=ANFX.items[i]; if(m.geometry&&m.geometry.parameters&&m.geometry.parameters.height===0.10) m.scale.y=0.8+0.4*Math.abs(Math.sin(ANFX.t*7+i)); }
  }
}
