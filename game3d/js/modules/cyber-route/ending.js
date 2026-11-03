/* 《网安仙人》公开真结局：16 秒实时 3D 分镜（计划《巡察者常驻、手机网络系统与网安仙人》9.2 节）。
   只在隔离舞台上演：不写玩家位置，不改游戏时间（天色用 VisualState.stageHour 单独指定，只影响画面），
   不加实时点光源（三处室内布景的明暗走 lightState 钩子，中途不重编着色器）。
   0–3.2   机房：机柜的指示灯从最里面那架开始，一架接一架熄灭；控制台逐行打出停机日志；
           墙上的喇叭刚说到「全体同学请注——」就断了。
   3.2–7.2 走廊：灯管还在「两短一长」地闪（巡察者在这一层的信号），画面带一点红；闪了两轮以后稳住，
           红色退掉；走廊中间那个高个子垂下肩膀，在原地不动了。背景的嗡声和心跳一层层停下来。
   7.2–11.2 档案：显示器上，公司报告和原始档案逐行对照，三处矛盾一处处圈出来；最后一行「签发节点：未知」。
   11.2–16 校园：天亮了。镜头从楼前慢慢升起，学校回到普通的晨光和颜色里，没有新的东西出现；
           鸟叫，远处响起一遍普通的下课铃。黑场之后是结局卡（最后一句「您未能完全理解里世界」，跳过演出也保留）。 */
'use strict';
(function(){
  var DUR=16;
  var SEG={A:[0,3.2],B:[3.2,7.2],C:[7.2,11.2],D:[11.2,16]};
  var RACKS=10, LED_ROWS=5, LED_COLS=2, LEDS=RACKS*LED_ROWS*LED_COLS;
  function seg(t,a,b){ return t<=a?0:t>=b?1:(t-a)/(b-a); }
  function ease(x){ x=clamp(x,0,1); return x*x*(3-2*x); }
  function ph(t,a,b){ return ease(seg(t,a,b)); }
  var DUMMY=null;
  function setI(im,i,x,y,z,s){ if(!DUMMY) DUMMY=new THREE.Object3D(); DUMMY.position.set(x,y,z); DUMMY.rotation.set(0,0,0); DUMMY.scale.setScalar(s); DUMMY.updateMatrix(); im.setMatrixAt(i,DUMMY.matrix); }
  /* 「两短一长」：灯管在巡察者附近的闪法（亮 / 灭交替，秒） */
  var FLICKER=[0.10,0.08,0.10,0.08,0.10,0.30,0.55,0.08,0.10,0.08,0.10,0.30];
  function flickerOn(t){
    var x=t-SEG.B[0], on=true;
    for(var i=0;i<FLICKER.length;i++){ if(x<FLICKER[i]) return on; x-=FLICKER[i]; on=!on; }
    return true;
  }
  var FLICKER_END=SEG.B[0]+FLICKER.reduce(function(a,b){return a+b;},0);

  /* ---------- 文字屏：只在内容变化时重画（每次重画都要重新上传贴图） ---------- */
  function screen(w,h,pw,ph2,parent,x,y,z,rot){
    var cv=document.createElement('canvas'); cv.width=w; cv.height=h;
    var tex=new THREE.CanvasTexture(cv); tex.generateMipmaps=false; tex.minFilter=THREE.LinearFilter; tex.colorSpace=THREE.SRGBColorSpace;
    var m=new THREE.MeshBasicMaterial({map:tex,toneMapped:false,fog:false}); m.userData.disposeMap=true;   /* 清场时连贴图一起释放 */
    var mesh=new THREE.Mesh(new THREE.PlaneGeometry(pw,ph2),m); mesh.position.set(x,y,z); mesh.rotation.y=rot||0; parent.add(mesh);
    return {cv:cv,ctx:cv.getContext('2d'),tex:tex,mesh:mesh,key:null};
  }
  function paint(scr,key,draw){ if(!scr.ctx||scr.key===key) return; scr.key=key; draw(scr.ctx,scr.cv.width,scr.cv.height); scr.tex.needsUpdate=true; }

  /* 控制台：停机日志 */
  var LOG=[[0.25,'$ campusctl shutdown --confirm'],[0.75,'stop attendance ............ OK'],[1.35,'stop doors ................. OK'],
    [1.95,'broadcast: 全体同学请注——'],[2.25,'stop observation ........... OK'],[2.75,'stop control ............... OK']];
  function drawLog(c,W,H,n){
    c.fillStyle='#07130e'; c.fillRect(0,0,W,H);
    c.font='bold 30px monospace'; c.textBaseline='top';
    for(var i=0;i<n;i++){ var l=LOG[i][1]; c.fillStyle=l.indexOf('broadcast')===0?'#d7c27a':(i===n-1?'#b9f2c8':'#5fbf86'); c.fillText(l,24,22+i*44); }
    c.fillStyle='#5fbf86'; if(n<LOG.length) c.fillRect(24,22+n*44,18,30);
  }

  /* 档案对照：公司报告 ↔ 原始记录，三处矛盾 */
  var PAIRS=[
    ['首次部署：2026-09-01','部署前：无任何异常记录','纸质档案扫描：1987 年','走廊里出现不在值班表上的人'],
    ['巡察行为：全部由控制器产生','断链即全部停止','断链故障记录：控制链离线后','仍收到回执（签发节点：——）'],
    ['退出身份：已注销','数据已删除','「注销」字段原始定义：','转交上层保管']
  ];
  var ARCH={head:7.35,cols:7.6,rows:[7.9,8.6,9.3],marks:[8.25,8.95,9.65],last:10.25};
  function archState(t){
    var s=0; if(t>=ARCH.head) s=1; if(t>=ARCH.cols) s=2;
    ARCH.rows.forEach(function(r){ if(t>=r) s++; }); ARCH.marks.forEach(function(r){ if(t>=r) s++; });
    if(t>=ARCH.last) s++;
    var blink=t>=ARCH.last?Math.floor((t-ARCH.last)/0.45)%2:0;
    return {s:s,blink:blink,key:s+':'+blink,rows:ARCH.rows.filter(function(r){return t>=r;}).length,marks:ARCH.marks.filter(function(r){return t>=r;}).length};
  }
  function drawArchive(c,W,H,st,portrait){
    c.fillStyle='#0d1714'; c.fillRect(0,0,W,H);
    var pad=Math.round(W*0.035), fs=portrait?Math.round(W*0.042):Math.round(W*0.024), lh=fs*1.42;
    c.textBaseline='top';
    if(st.s>=1){
      c.fillStyle='#9fd6b4'; c.font='bold '+Math.round(fs*1.05)+'px sans-serif';
      c.fillText('AnthroPrank AI · 安抄派智能　校园试点档案',pad,pad);
      c.fillStyle='#62d38c'; c.font=Math.round(fs*0.9)+'px monospace';
      c.fillText('控制系统：已终止',pad,pad+lh*1.15);
    }
    var top=pad+lh*2.6, colW=portrait?W-pad*2:(W-pad*3)/2, rowH=portrait?lh*4.6:lh*2.9;
    function cell(col,row){ return portrait?{x:pad,y:top+lh*1.3+row*rowH+(col?lh*2.15:0)}:{x:pad+col*(colW+pad),y:top+lh*1.3+row*rowH}; }
    if(st.s>=2){
      c.font='bold '+fs+'px sans-serif';
      c.fillStyle='#c9e7d4'; c.fillText(portrait?'公司报告　↔　原始记录':'公司报告',pad,top);
      if(!portrait){ c.fillStyle='#e7d9a8'; c.fillText('原始记录（扫描件）',pad*2+colW,top); }
    }
    c.font=fs+'px sans-serif';
    for(var r=0;r<st.rows;r++){
      var a=cell(0,r), b=cell(1,r), p=PAIRS[r];
      c.fillStyle='#c9e7d4'; c.fillText(p[0],a.x,a.y); c.fillStyle='#8fae9c'; c.fillText(p[1],a.x,a.y+lh);
      c.fillStyle='#e7d9a8'; c.fillText(p[2],b.x,b.y); c.fillStyle='#bba978'; c.fillText(p[3],b.x,b.y+lh);
      if(r<st.marks){
        /* 圈出矛盾：两边各画一道红框，中间一个「≠」 */
        c.strokeStyle='#e0473b'; c.lineWidth=Math.max(2,fs*0.12);
        var wa=Math.min(colW,c.measureText(p[0]).width)+fs*0.6, wb=Math.min(colW,Math.max(c.measureText(p[2]).width,c.measureText(p[3]).width))+fs*0.6;
        c.strokeRect(a.x-fs*0.3,a.y-fs*0.25,wa,lh*1.95); c.strokeRect(b.x-fs*0.3,b.y-fs*0.25,wb,lh*1.95);
        c.fillStyle='#e0473b'; c.font='bold '+Math.round(fs*1.4)+'px sans-serif';
        if(portrait) c.fillText('≠',W-pad-fs*1.2,a.y+lh*1.1); else c.fillText('≠',pad+colW+pad*0.5-fs*0.45,a.y+lh*0.15);
        c.font=fs+'px sans-serif';
      }
    }
    if(st.s>=9){
      var y=H-pad-lh*1.2;
      c.fillStyle='#e0473b'; c.font='bold '+fs+'px sans-serif';
      c.fillText('签发节点：未知'+(st.blink?'':' ▌'),pad,y);
    }
  }

  CUT_DEF.cyber={dur:DUR,setup:function(d){
    Engine.beginOutsideStage();
    var base=cutW2S(560,1008), x=base.x, z=base.z; d.x=x; d.z=z;
    d.portrait=(GLR.cam.aspect||1.6)<0.8;
    VisualState.stageHour=5.2;                                   /* 天还没亮（只是画面） */
    d.light={amb:0.1,hemi:0.08,dir:0.02,fog:{r:0.02,g:0.026,b:0.03,density:0.05}};

    /* ===== A：机房 ===== */
    d.A=cutAdd(new THREE.Group()); var K=new Kit(), i, j;
    K.box('fterrazzo',x,-0.05,z,7,0.1,11,0x5d6466,1);
    for(i=-3;i<=3;i++) K.box('decal',x+i*0.6,0.004,z,0.02,0.003,11,0x2e3436,1);          /* 架空地板的缝 */
    for(i=-9;i<=9;i++) K.box('decal',x,0.004,z+i*0.6,7,0.003,0.02,0x2e3436,1);
    K.box('plaster',x-3.5,1.6,z,0.12,3.2,11,0x5c6866,1); K.box('plaster',x+3.5,1.6,z,0.12,3.2,11,0x5c6866,1);
    K.box('plaster',x,1.6,z-5.5,7,3.2,0.12,0x56615f,1); K.box('plaster',x,1.6,z+5.5,7,3.2,0.12,0x56615f,1);
    K.box('plaster',x,3.2,z,7,0.1,11,0x3f4746,1);
    K.box('metal',x,3.05,z-1,0.25,0.06,8,0x2c3234,1);                                     /* 走线槽 */
    for(i=0;i<RACKS;i++){
      var side=i%2?1:-1, row=Math.floor(i/2);
      K.asset('server_rack',x+side*1.45,0,z-4.0+row*1.25,side>0?-Math.PI/2:Math.PI/2,{merge:true,mat:{emit:''}});
    }
    K.asset('server_console',x,0,z-4.75,0,{merge:true,mat:{emit:''}});
    K.asset('speaker_box',x+3.38,2.65,z-0.6,-Math.PI/2,{merge:true});                    /* 墙上的喇叭：高过机柜，看得见 */
    K.box('emit',x-1.2,3.12,z+1.5,0.9,0.04,0.18,0x9fb8b8,0.55); K.box('emit',x+1.2,3.12,z-2.5,0.9,0.04,0.18,0x9fb8b8,0.55);   /* 两盏应急灯 */
    d.A.add(K.build());
    d.ledOn=new THREE.InstancedMesh(new THREE.BoxGeometry(0.04,0.035,0.03),new THREE.MeshBasicMaterial({color:0x6ff09a}),LEDS);
    d.ledOff=new THREE.InstancedMesh(new THREE.BoxGeometry(0.04,0.035,0.03),new THREE.MeshBasicMaterial({color:0x0e1712}),LEDS);
    d.leds=[];
    for(i=0;i<RACKS;i++){
      var sd=i%2?1:-1, rw=Math.floor(i/2), fx=x+sd*(1.45-0.42), fz=z-4.0+rw*1.25;
      for(j=0;j<LED_ROWS*LED_COLS;j++){
        var lr=Math.floor(j/LED_COLS), lc=j%LED_COLS;
        d.leds.push({x:fx,y:1.85-lr*0.3,z:fz-0.25+lc*0.1,rack:i,amber:(i*7+j*3)%11===0});
      }
    }
    /* 从最里面（离控制台最近）那架开始，一架接一架往镜头这边灭 */
    var order=[]; for(i=0;i<RACKS;i++) order.push(i); order.sort(function(a,b){ return Math.floor(a/2)-Math.floor(b/2)||a-b; });
    d.rackOff={}; order.forEach(function(r,n){ d.rackOff[r]=0.55+n*0.22; });
    d.ledOn.frustumCulled=d.ledOff.frustumCulled=false; d.A.add(d.ledOn); d.A.add(d.ledOff);
    d.log=screen(1024,320,1.04,0.325,d.A,x,1.45,z-4.75+0.4,0);

    /* ===== B：走廊（墙裙、柜子、教室门、窗、灯管） ===== */
    d.B=cutAdd(new THREE.Group()); var H=new Kit(), L=new Kit();
    var x0=x-1.6, x1=x+1.6, zN=z-18, zS=z+6, len=zS-zN, zc=(zN+zS)/2;
    H.box('fterrazzo',x,-0.05,zc,3.2,0.1,len,0x8e9690,1);
    H.box('plaster',x0-0.06,1.95,zc,0.12,2.3,len,0xb3b8ad,1); H.box('plaster',x1+0.06,1.95,zc,0.12,2.3,len,0xb3b8ad,1);
    H.box('plaster',x0-0.05,0.6,zc,0.12,1.2,len,0x5d7267,1);  H.box('plaster',x1+0.05,0.6,zc,0.12,1.2,len,0x5d7267,1);   /* 墙裙 */
    H.box('plaster',x,3.12,zc,3.2,0.1,len,0xa9aea4,1);
    H.box('plaster',x,1.55,zN-0.06,3.2,3.1,0.12,0x9fa59a,1);
    for(i=0;i<4;i++){
      var dz=z+3-i*6;
      /* 教室门：门扇、门套、门上的小窗（门套资源有半米深，会伸进走廊，这里自己拼） */
      H.box('wood',x0+0.02,1.03,dz,0.05,2.06,0.92,0x6a4b33,1);
      H.box('wood',x0+0.04,2.1,dz,0.07,0.08,1.06,0x4a3424,1); H.box('wood',x0+0.04,1.05,dz-0.51,0.07,2.1,0.07,0x4a3424,1); H.box('wood',x0+0.04,1.05,dz+0.51,0.07,2.1,0.07,0x4a3424,1);
      H.box('dark',x0+0.05,1.6,dz+0.18,0.02,0.36,0.24,0x151a1c,1);
      H.asset('locker_bank_4',x0+0.24,0,dz-2.6,Math.PI/2,{merge:true});
      /* 窗：外面还是夜里，玻璃后面先垫一块暗色 */
      [dz-1.5,dz-4.5].forEach(function(wz){ H.box('dark',x1-0.005,1.64,wz,0.02,1.36,1.62,0x0c1218,1); H.asset('window_in_150',x1-0.02,0,wz,-Math.PI/2,{merge:true}); });
    }
    for(i=0;i<6;i++){ var lz=z+4-i*4; H.box('metal',x,3.05,lz,1.3,0.06,0.26,0x7c8280,1); L.box('emit',x,3.01,lz,1.2,0.03,0.18,0xe8f0ea,1); }
    H.box('emit',x0+0.1,2.55,zN+0.6,0.32,0.13,0.03,0x58c27a,1);                                    /* 安全出口灯 */
    d.B.add(H.build()); d.lamps=L.build(); d.B.add(d.lamps);
    d.fig=new THREE.Group();
    d.fig.add(figMesh('teacher',new THREE.MeshBasicMaterial({color:0x040506,fog:true}),1.12));
    var gear=new THREE.Mesh(patGearGeo(),new THREE.MeshBasicMaterial({vertexColors:true,color:0x555555,fog:true})); gear.scale.setScalar(1.12); d.fig.add(gear);
    d.fig.position.set(x,0,z-3); d.B.add(d.fig);                  /* 人形正面朝 +z：面对着镜头走来的方向 */

    /* ===== C：机房一角的显示器（档案对照） ===== */
    d.C=cutAdd(new THREE.Group()); var M=new Kit();
    M.box('fterrazzo',x,-0.05,z,6,0.1,6,0x4e5553,1);
    M.box('plaster',x,1.6,z-1.2,6,3.2,0.12,0x434b49,1); M.box('plaster',x-3,1.6,z+1.8,0.12,3.2,6,0x3e4544,1); M.box('plaster',x+3,1.6,z+1.8,0.12,3.2,6,0x3e4544,1);
    M.box('plaster',x,3.2,z+1.8,6,0.1,6,0x2f3534,1);
    M.box('wood',x,0.74,z-0.62,1.3,0.04,0.7,0x6c5a46,1);                                          /* 桌面和桌腿 */
    [[-0.6,-0.3],[0.6,-0.3],[-0.6,0.3],[0.6,0.3]].forEach(function(q){ M.box('metal',x+q[0],0.37,z-0.62+q[1],0.04,0.72,0.04,0x3a3f42,1); });
    M.box('plastic',x-0.05,0.775,z-0.38,0.44,0.02,0.14,0x22272a,1);                               /* 键盘 */
    M.asset('desk_computer',x-1.5,0,z-0.8,0,{merge:true}); M.asset('desk_computer',x+1.5,0,z-0.8,0,{merge:true});
    M.asset('chair_office',x+0.95,0,z+0.15,Math.PI*0.8,{merge:true});
    /* 显示器：竖着看（手机竖屏）时显示器也转成竖放，档案排成上下对照 */
    var sw=d.portrait?0.372:0.62, sh=d.portrait?0.62:0.372, my=d.portrait?1.2:1.05; d.scr={w:sw,h:sh,y:my};
    M.box('dark',x,my,z-0.75,sw+0.06,sh+0.07,0.035,0x14181a,1);
    M.box('dark',x,(my-sh/2+0.76)/2,z-0.79,0.06,my-sh/2-0.76,0.04,0x1b2022,1); M.box('dark',x,0.78,z-0.77,0.26,0.02,0.18,0x1b2022,1);
    d.C.add(M.build());
    d.arch=screen(d.portrait?768:1280,d.portrait?1280:768,sw,sh,d.C,x,my,z-0.75+0.019,0);

    d.A.visible=true; d.B.visible=d.C.visible=false;
    if(VisualState.stage) VisualState.stage.mesh.visible=false;
    /* 先把三处布景的材质都编好（不在演出中途第一次显示时现编，手机上会卡一下） */
    try{
      d.B.visible=d.C.visible=true;
      var prev=GLR.renderer.getRenderTarget(); GLR.renderer.setRenderTarget(GLR.rt||null);
      GLR.renderer.compile(CUT.grp,GLR.cam,GLR.scene); GLR.renderer.setRenderTarget(prev);
    }catch(e){}
    d.B.visible=d.C.visible=false;
    try{ SFX.stopAmbient(); d.sound=SoundPlayer.play('scene.cyberEnd'); Lifecycle.scope('cutscene').own(function(){ SoundPlayer.fade(d.sound); }); }catch(e){}
  },frame:function(k,d){
    var t=k*DUR, x=d.x, z=d.z, i;
    var inA=t<SEG.B[0], inB=!inA&&t<SEG.C[0], inC=!inA&&!inB&&t<SEG.D[0], inD=t>=SEG.D[0];
    d.A.visible=inA; d.B.visible=inB; d.C.visible=inC;
    if(VisualState.stage) VisualState.stage.mesh.visible=inD;
    /* 段与段之间短短的黑场 */
    var fade=0;
    [SEG.B[0],SEG.C[0],SEG.D[0]].forEach(function(b){ fade=Math.max(fade,1-Math.abs(t-b)/0.22); });
    if(t>SEG.D[0]) fade=Math.max(fade,1-seg(t,SEG.D[0],SEG.D[0]+0.5));
    fade=Math.max(fade,seg(t,15.1,15.95));
    cutFade(clamp(fade,0,1));

    if(inA){
      /* 指示灯：每架灭之前闪一下 */
      d.leds.forEach(function(l,n){
        var off=d.rackOff[l.rack], blink=t>off-0.09&&t<off-0.05, on=t<off&&!blink;
        setI(d.ledOn,n,l.x,l.y,l.z,on?1:0); setI(d.ledOff,n,l.x,l.y,l.z,on?0:1);
      });
      d.ledOn.instanceMatrix.needsUpdate=d.ledOff.instanceMatrix.needsUpdate=true;
      var lines=LOG.filter(function(l){ return t>=l[0]; }).length;
      paint(d.log,lines,function(c,W,H){ drawLog(c,W,H,lines); });
      var dolly=ph(t,0,3.2), dim=seg(t,0.6,2.8);
      cutLook(x+0.18,1.5,z+1.6-1.7*dolly, x,1.3,z-4.75);
      d.light={amb:0.22-0.1*dim,hemi:0.16-0.08*dim,dir:0.03,fog:{r:0.02,g:0.026,b:0.03,density:0.045}};
      VisualState.patrolRed=0;
    }else if(inB){
      var on=flickerOn(t), settled=t>=FLICKER_END;
      d.lamps.visible=on;
      var lamp=settled?1:(on?0.95:0.22);
      d.light={amb:0.17*lamp,hemi:0.12*lamp,dir:0.04,fog:{r:0.045,g:0.05,b:0.05,density:0.045}};
      /* 巡察者在这一层的红：闪的时候一阵一阵，稳住以后退掉 */
      VisualState.patrolRed=0.32*(1-ph(t,FLICKER_END-0.2,FLICKER_END+0.6))*(on?1:0.6);
      /* 失去活动：肩膀垂下去，整个人往前沉一点，之后一动不动 */
      var slump=ph(t,FLICKER_END+0.1,FLICKER_END+1.3);
      d.fig.rotation.set(0.12*slump,0,0); d.fig.position.y=-0.05*slump;
      var go=ph(t,SEG.B[0],SEG.B[1]);
      cutLook(x+0.35-0.15*go,1.6,z+4.6-3.2*go, x,1.75-0.25*slump,z-3);
    }else if(inC){
      VisualState.patrolRed=0;
      var st=archState(t);
      paint(d.arch,st.key,function(c,W,H){ drawArchive(c,W,H,st,d.portrait); });
      /* 推近到屏幕：最后屏幕在画面里占七成左右（按当前视角和宽高比算，横竖屏都看得清字） */
      var push=ph(t,SEG.C[0],10.4), vf=Math.tan((GLR.cam.fov||72)*Math.PI/360), hf=vf*(GLR.cam.aspect||1.6);
      var near=Math.max(d.scr.w/2/(hf*0.72),d.scr.h/2/(vf*0.72)), far=near+1.1;
      var dist=far+(near-far)*push;
      cutLook(x+0.12*(1-push),d.scr.y+0.07*(1-push),z-0.75+dist, x,d.scr.y,z-0.75);
      d.light={amb:0.06,hemi:0.04,dir:0.0,fog:{r:0.01,g:0.012,b:0.014,density:0.07}};
    }else{
      /* 天亮了：天色从日出到早上七点；颜色和正常的光一起回来（比游戏平时压暗的阴天亮一些） */
      d.light=null; d.boost=1+0.8*ph(t,11.6,14.2);
      VisualState.patrolRed=0;
      VisualState.stageHour=6.0+1.1*seg(t,SEG.D[0],DUR);         /* 日出到早上七点 */
      GLR.worldNorm=ph(t,SEG.D[0]+0.2,13.8);
      GLR.dayExpo=Math.max(GLR.dayExpo||0.6,0.6+0.4*ph(t,12,14.5));   /* 不再是压暗的阴天：普通的早晨 */
      var rise=ph(t,SEG.D[0],DUR);                                 /* 从楼前升起、往后退，最后楼顶在画面下半，上面是天 */
      cutLook(x+2*rise,1.5+8.5*rise,z+6+12*rise, x,3+19*rise,z-28);
    }
  },clean:function(d){
    VisualState.stageHour=null; VisualState.patrolRed=0;
    d.light=null; d.boost=0;
  }};

  /* 三处室内布景的明暗由这里给（演出期间的舞台是室外模式）；天亮那一段不管，用正常的室外光 */
  GameModules.on('lightState',function(st){
    var d=(typeof CUT!=='undefined'&&CUT.on&&CUT.id==='cyber')?CUT.data:null;
    if(!d) return;
    if(d.light){ st.amb=d.light.amb; st.hemi=d.light.hemi; st.dir=d.light.dir; st.fog=d.light.fog; }
    else if(d.boost){ st.amb*=d.boost; st.hemi*=d.boost; st.dir*=d.boost; }
  },{owner:'cyber-route'});
})();
