/* 里世界 3D · 新局开场 CG（《传送门建模、死亡CG档案室与速通模式》P3）
   在真正的第一节教室里实时演一段，接着把镜头原样交给玩家（座位、朝向、坐姿和正常开局一样）。
   分镜（完整版约 26 秒）：
     1 正常的第四节：从教室后排缓缓推向讲台，阳光里飘着粉笔灰，颜色是正常世界的。
     2 不对劲：侧面看讲台边的老师，念到一半顿住、又从头念；远处一下电流声。
     3 时间停住：粉笔灰停在半空，光一点点变冷；镜头从灰转到「你」的座位。
     4 坠下去：灯轻轻地暗、颜色褪掉，「你」趴到桌上；闭眼黑场，同学在黑场里变成影子。
     5 第一人称醒来：从课桌抬起视线，坐满人的教室里没有一个人在呼吸。
     6 交接：停在开局的视角上，结束过场、交还控制。
   老玩家（看过前情提要）新开局只演 4–6 的短版（约 11 秒）。任何时候点击、空格、回车、Esc 都能跳过；
   跳过和看完走同一个交接，开局状态完全一样，所以速通从同一个可操作的瞬间起表。
   演出期间世界不动（S.screen==='cut'，PRO.on 挡住输入和同学的自动变化），不扣 SAN、不出异象、不能存档。
   字幕沿用原来前情提要的文字；原来的文字版 proShow 仍保留，没有 3D 场景（加载失败）时用它兜底。 */
'use strict';

var OPENING_DUR={full:26,short:11};
var OPENING_SHORT_FROM=0.58;                  /* 短版从第 4 段开始 */
var OPENING_LINES=[
  [0.03,0.21,'你是这学期转来的。高二（二）班，第四节，语文。'],
  [0.24,0.40,'老师在念一篇课文，念到一半，又从头念了一遍。'],
  [0.42,0.57,'粉笔灰在光里飘。你开始数秒：一，二，三……数到第七秒，它们停在了半空。'],
  [0.59,0.71,'眼皮很重。黑板上的字开始往下淌。你把脸埋进胳膊里。'],
  [0.79,0.92,'你睁开眼。教室里还是坐满了人。只是没有一个人在呼吸。'],
  [0.93,1.01,'下课铃没有响。它，已经知道你醒了。']
];
/* 开局的座位：和 Game.start 一样 */
function openingSeat(){
  var R=INTERIORS.teach1;
  return {x:R.ox+48.5*9, y:R.oy+6.5*9, ang:-PI/2};
}
function openingCap(text){
  var el=document.getElementById('opcap'); if(!el) return;
  if(el._t===text) return;
  el._t=text; el.textContent=text||''; el.classList.toggle('on',!!text);
}

CUT_DEF.opening={dur:OPENING_DUR.full,
  setup:function(d){
    var R=INTERIORS.teach1;
    d.short=!!Opening.short;
    d.seat=cutCell('teach1',48,6);
    d.board=cutCell('teach1',48,0.6);
    /* 讲台边的老师（面朝全班），和「你」——第三人称镜头里趴在座位上的那个人 */
    var mat=cutBasic(0x4a5560);
    var t=cutCell('teach1',49.5,1.25);                           /* 讲台右手边的空地：前排课桌在第 2 行，不会站到桌子上 */
    d.teacher=cutAdd(new THREE.Group()); d.teacher.add(figMesh('teacher',mat,1)); d.teacher.position.set(t.x,0,t.z);
    d.me=cutAdd(new THREE.Group());
    var me=figMesh('sit',cutBasic(0x55606a),1); me.rotation.y=Math.PI; d.me.add(me);
    var mp=worldToScene(R.ox+48.5*R.tw,R.oy+(6.5+0.32)*R.th,R); d.me.position.set(mp.x,0,mp.z);
    /* 阳光里的粉笔灰：讲台前一片小光点，正常时慢慢飘，第 3 段停住 */
    var n=Math.max(60,Math.round(160*(Quality.get().segments||1))), pos=new Float32Array(n*3), i;
    var a=cutCell('teach1',45.6,0.8), b=cutCell('teach1',51.4,3.6);
    d.dust=[];
    for(i=0;i<n;i++){
      var x=cutLerp(a.x,b.x,Math.random()), z=cutLerp(a.z,b.z,Math.random()), y=0.7+Math.random()*1.9;
      pos[i*3]=x; pos[i*3+1]=y; pos[i*3+2]=z;
      d.dust.push({x:x,y:y,z:z,ph:Math.random()*6.283,sp:0.25+Math.random()*0.5});
    }
    var g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(pos,3));
    d.dustPts=cutAdd(new THREE.Points(g,new THREE.PointsMaterial({color:0xfff1d2,size:0.016,transparent:true,opacity:0.8,depthWrite:false,fog:true})));
    d.flow=0;
    VisualState.worldNorm=d.short?0.55:1;
    try{ if(!d.short) SFX.resume(); }catch(e){}
  },
  frame:function(k,d){
    var K=d.short?OPENING_SHORT_FROM+(1-OPENING_SHORT_FROM)*k:k;
    var R=INTERIORS.teach1, i, line='';
    for(i=0;i<OPENING_LINES.length;i++) if(K>=OPENING_LINES[i][0]&&K<OPENING_LINES[i][1]) line=OPENING_LINES[i][2];
    openingCap(line);
    /* 粉笔灰：0.46 以前在飘，之后停住 */
    var moving=K<0.46?1:Math.max(0,1-(K-0.46)/0.02);
    d.flow+=moving*0.016;
    var arr=d.dustPts.geometry.attributes.position.array;
    for(i=0;i<d.dust.length;i++){
      var p=d.dust[i];
      arr[i*3]=p.x+Math.sin(d.flow*p.sp+p.ph)*0.12;
      arr[i*3+1]=p.y+Math.sin(d.flow*p.sp*0.7+p.ph*2)*0.08-d.flow*0.02*p.sp;
      arr[i*3+2]=p.z+Math.cos(d.flow*p.sp*0.8+p.ph)*0.1;
    }
    d.dustPts.geometry.attributes.position.needsUpdate=true;
    d.dustPts.visible=K<0.74;
    var shk=(typeof SHAKE_ON==='undefined'||SHAKE_ON)?1:0;
    if(K<0.24){                                                      /* 1 正常的第四节 */
      var t1=cutEase(K/0.24), c0=cutCell('teach1',50.6,13.6), c1=cutCell('teach1',50.1,9.4);
      cutLook(cutLerp(c0.x,c1.x,t1),cutLerp(2.5,2.05,t1),cutLerp(c0.z,c1.z,t1), d.board.x,1.45,d.board.z);
      cutFade(K<0.03?1-K/0.03:0);
    }else if(K<0.42){                                                /* 2 老师念到一半，从头再念 */
      var t2=cutEase((K-0.24)/0.18), s0=cutCell('teach1',45.8,3.6), s1=cutCell('teach1',46.3,3.0);
      var nod=Math.sin(K*90)*0.04;
      if(K>0.34&&K<0.36) nod=0;                                       /* 顿住 */
      d.teacher.rotation.x=nod; d.teacher.rotation.y=(K>0.36?-0.18:0.18)*(1-t2*0.4);
      cutLook(cutLerp(s0.x,s1.x,t2),1.5,cutLerp(s0.z,s1.z,t2), d.teacher.position.x,1.45,d.teacher.position.z);
      if(K>0.37&&!d.hum){ d.hum=1; try{ SFX.crackle(0.6,0.5); }catch(e){} }
    }else if(K<0.58){                                                /* 3 时间停住，镜头转向「你」 */
      var t3=cutEase((K-0.42)/0.16), cam=cutCell('teach1',50.4,4.4);
      var lx=cutLerp(d.board.x,d.me.position.x,t3), lz=cutLerp(d.board.z+1.2,d.me.position.z,t3), ly=cutLerp(1.6,0.95,t3);
      cutLook(cam.x,1.55,cam.z, lx,ly,lz);
      VisualState.worldNorm=1-0.45*cutPhase(K,0.46,0.58);
    }else if(K<0.76){                                                /* 4 坠下去：颜色褪掉、趴下、闭眼 */
      var t4=cutEase((K-0.58)/0.18), q0=cutCell('teach1',49.6,5.2), q1=cutCell('teach1',48.95,5.75);
      d.me.visible=K<0.735; d.me.rotation.x=-0.32*cutPhase(K,0.6,0.68); d.teacher.visible=K<0.72;
      var fl=K<0.7?(0.06*Math.max(0,Math.sin(K*160))*shk):0;
      cutLook(cutLerp(q0.x,q1.x,t4),cutLerp(1.42,1.18,t4)-fl,cutLerp(q0.z,q1.z,t4), d.me.position.x,0.9,d.me.position.z);
      VisualState.worldNorm=0.55*(1-cutPhase(K,0.6,0.7));
      cutFade(cutPhase(K,0.69,0.73));
      if(K>=0.72&&!d.flip){ d.flip=1; try{ ncFlip(); }catch(e){} try{ SFX.blink(); }catch(e){} }
      if(d.short&&k<0.04) cutFade(1-k/0.04);
    }else{                                                           /* 5、6 第一人称醒来，停在开局的视角 */
      var t5=cutEase((K-0.78)/0.14), y=cutLerp(0.84,1.12,t5), pitch=cutLerp(-0.95,0,t5), ang=-PI/2;
      d.me.visible=false; d.teacher.visible=false; VisualState.worldNorm=0;
      if(!d.flip){ d.flip=1; try{ ncFlip(); }catch(e){} }
      cutLook(d.seat.x,y,d.seat.z, d.seat.x+Math.cos(ang)*Math.cos(pitch),y+Math.sin(pitch),d.seat.z+Math.sin(ang)*Math.cos(pitch));
      cutFade(K<0.82?1-(K-0.76)/0.06:0);
      if(K>0.78&&!d.wake){ d.wake=1; try{ SFX.wake&&SFX.wake(); }catch(e){} }
    }
  },
  clean:function(d){ openingCap(''); }
};

var Opening={on:false,short:false,handed:true,waitT:0,
  /* Game.start 调用：等教室搭好再开演；没有 3D 场景就退回文字版前情提要 */
  play:function(){
    Opening.short=proSeen(); Opening.handed=false; Opening.on=true;
    if(!CUT.enabled){ Opening.handoff(); return; }                /* 关了过场（回归测试）：直接交接，不留异步的尾巴 */
    PRO.on=true;                                                  /* 先挡住输入：不能在开演前自己走动 */
    var t0=performance.now();
    clearInterval(Opening.waitT);
    Opening.waitT=setInterval(function(){
      if(!Opening.on){ clearInterval(Opening.waitT); return; }
      var ready=GLR.cam&&GLR.roomMesh&&GLR.roomMesh.userData.roomData===INTERIORS.teach1;
      if(!ready&&performance.now()-t0<8000) return;
      clearInterval(Opening.waitT); Opening.waitT=0;
      if(!ready){ PRO.on=false; Opening.on=false; Opening.handed=true; try{ proShow(); }catch(e){ Opening.handoff(); } return; }
      CUT_DEF.opening.dur=Opening.short?OPENING_DUR.short:OPENING_DUR.full;
      playCut('opening',Opening.handoff);
    },50);
  },
  /* 交接：看完和跳过都走这里，只走一次 */
  handoff:function(){
    if(Opening.handed) return;
    Opening.handed=true; Opening.on=false; clearInterval(Opening.waitT); Opening.waitT=0;
    var seat=openingSeat();
    S.mode='in'; S.room='teach1'; S.x=seat.x; S.y=seat.y; S.ang=seat.ang; S.pitch=0; S.seated=true; S.eyeLift=0;
    S.screen='play'; PRO.on=false;
    VisualState.worldNorm=0; GLR.flash=0; cutFade(0); openingCap('');
    try{ if(NC.normal) ncFlip(); }catch(e){}
    proMark();
    resetInputState();
    try{ syncCamera(0); }catch(e){}
    if(running){ lastT=performance.now(); accum=0; }
    try{ os('我：第四节。我坐在自己的位子上——至少，名牌上写的是我的名字。',4.8); }catch(e){}
    introT1=Lifecycle.scope('intro').timeout(function(){ try{ os('我：兜里有一张学生证。照片上的人我不认识，可是班号、学号，都是我的。',4.8); }catch(e){} },5200);   /* 跟开局字幕同一个作用域：回菜单、重开时一并取消 */
  },
  /* 回主菜单、读档时：没演完的开场直接收掉，不留过场状态 */
  cancel:function(){
    clearInterval(Opening.waitT); Opening.waitT=0;
    Opening.on=false; Opening.handed=true;
    openingCap('');
  }
};
