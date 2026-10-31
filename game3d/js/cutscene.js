/* 里世界 3D · 结局演出
   每个结局先在场景里实时演一段（镜头、几样临时的东西、灯光和色彩），再出结局文字卡。
   演出时世界停住（S.screen==='cut'，update 不走），render 每帧调 cutTick 摆镜头。
   点击、空格、回车或 Esc 跳过。CUT.enabled=false 时直接出文字卡（回归测试用）。 */
'use strict';

var CUT={enabled:true,on:false,t:0,dur:8,id:null,grp:null,done:null,data:{}};
function cutW2S(mx,my){ return worldToScene(mx*SC,my*SC,null); }              /* 室外：地图坐标 → 场景 */
function cutCell(room,c,r){ var R=INTERIORS[room]; return worldToScene(R.ox+(c+0.5)*R.tw,R.oy+(r+0.5)*R.th,R); }
function cutLook(px,py,pz,tx,ty,tz){ GLR.cam.position.set(px,py,pz); GLR.cam.lookAt(tx,ty,tz); }
function cutLerp(a,b,k){ return a+(b-a)*k; }
function cutEase(k){ k=clamp(k,0,1); return k*k*(3-2*k); }
function cutFade(v){ var f=document.getElementById('cutfade'); if(f) f.style.opacity=String(clamp(v,0,1)); }
function cutAdd(o){ if(!CUT.grp){ CUT.grp=new THREE.Group(); GLR.scene.add(CUT.grp); } CUT.grp.add(o); return o; }
function cutFigure(col,scale){ var g=new THREE.Group(); g.add(figMesh('person',new THREE.MeshBasicMaterial({color:col,fog:true}),scale||1)); return g; }

function cutBasic(col,op){ return new THREE.MeshBasicMaterial({color:col,fog:true,transparent:op!==undefined,opacity:op===undefined?1:op,depthWrite:op===undefined}); }
function cutPhase(k,a,b){ return cutEase(clamp((k-a)/(b-a),0,1)); }

/* 每条结局都分几段：先交代在哪、发生了什么，再给一个让人回头的镜头，最后收在文字卡上。
   动作只由进度 k 推出来；切场景（开车那条从车库切到校门外）发生在黑场里。 */
var CUT_DEF={
  /* 《闸门》开场：车库里点火，车灯一下一下亮起来，光里站着那个东西；黑场；
     校门外回头看，黑影从门里涌出来追——然后交给真正的驾驶 */
  car:{dur:10,setup:function(d){
      d.garage=S.mode==='in'&&!!INTERIORS[S.room];
      if(d.garage){
        var R=INTERIORS[S.room], p=worldToScene(S.x,S.y,R);
        d.p={x:p.x,z:p.z}; d.f={x:Math.cos(S.ang),z:Math.sin(S.ang)};
        d.beam=cutAdd(new THREE.Mesh(new THREE.CircleGeometry(1,28),cutBasic(0xffe6b0,0))); d.beam.scale.set(1.3,3.4,1);
        d.beam.rotation.x=-Math.PI/2; d.beam.rotation.z=-Math.atan2(d.f.z,d.f.x)+Math.PI/2;
        d.beam.position.set(p.x+d.f.x*4.4,0.02,p.z+d.f.z*4.4);
        d.thing=cutAdd(new THREE.Group()); d.thing.add(figMesh('roam',cutBasic(0x05070a),1));
        d.thing.position.set(p.x+d.f.x*6.5,0,p.z+d.f.z*6.5); d.thing.lookAt(p.x,0,p.z);
      }
      var g=cutW2S(GATE_N.x,GATE_N.y), i; d.g=g; d.figs=[];
      for(i=0;i<12;i++){ var f=cutAdd(cutFigure(0x040506,1+((i*7)%3)*0.05)); f.visible=false; f.userData={side:i%2?1:-1,row:Math.floor(i/2),i:i}; d.figs.push(f); }
      try{ SFX.engine&&SFX.engine(); }catch(e){}
    },frame:function(k,d){
      var g=d.g, out=!d.garage||k>=0.36;
      if(!out){
        /* 0–0.3：车灯闪了两下才亮稳；闪的那一下，光里站着它；亮稳以后，它不在了 */
        var on=k<0.06?0:(k<0.16?(Math.sin(k*120)>0?1:0.2):1);
        d.beam.material.opacity=0.2*on;
        d.thing.visible=k>0.08&&k<0.16&&on<1;
        var sh=(k>0.16?Math.sin(k*70)*0.012:0)*(SHAKE_ON?1:0);
        cutLook(d.p.x,1.15+sh,d.p.z, d.p.x+d.f.x*6,1.0,d.p.z+d.f.z*6);
        cutFade(k<0.3?0:(k-0.3)/0.06);
        return;
      }
      if(!d.switched){
        d.switched=1;
        if(d.beam) d.beam.visible=false; if(d.thing) d.thing.visible=false;
        S.mode='out'; S.room=null; S.x=GATE_N.x*SC; S.y=(GATE_N.y-30)*SC; enterWorldOut();
      }
      /* 0.36–1：已经冲出北门，回头看：门里涌出一排黑影追上来，越追越近，学校的窗一扇扇暗下去 */
      var t=clamp((k-0.36)/0.64,0,1), z=cutLerp(g.z-2,g.z-30,cutEase(t));
      var sway=Math.sin(k*34)*0.025*(SHAKE_ON?1:0);
      cutLook(g.x+sway,1.25,z, g.x,1.8,g.z+24);
      d.figs.forEach(function(f){
        var u=f.userData, c=clamp((t-0.12-u.i*0.03)/0.7,0,1);
        f.visible=c>0;
        f.position.set(g.x+u.side*(0.5+u.row*0.28)*(1-0.4*c),Math.abs(Math.sin(k*30+u.i))*0.06,cutLerp(g.z+3,z+5+u.row*1.5,c*0.92));
        f.lookAt(GLR.cam.position.x,0,GLR.cam.position.z);
      });
      if(GLR.scene.fog) GLR.scene.fog.density=cutLerp(0.012,0.04,t);
      GLR.dayExpo=(GLR.dayExpo||1)*(1-0.3*t);
      cutFade(k<0.42?1-(k-0.36)/0.06:(k>0.9?(k-0.9)/0.1:0));
    }},
  /* 《白名单》：闸机的灯由红变白，「嘀」一声；黑场；已经站在门外，回头——门里一个接一个站满了人，在目送你 */
  face:{dur:10,setup:function(d){
      S.mode='out'; S.room=null; S.x=(GATE_W.x+30)*SC; S.y=GATE_W.y*SC; enterWorldOut();
      var g=cutW2S(GATE_W.x,GATE_W.y), i; d.g=g;
      d.lamp=cutAdd(new THREE.Mesh(new THREE.BoxGeometry(0.12,0.12,0.12),cutBasic(0xd23a2e)));
      d.lamp.position.set(g.x+0.4,1.15,g.z+0.9);
      d.figs=[];
      for(i=0;i<15;i++){
        var f=cutAdd(cutFigure(0x050607,0.96+((i*5)%4)*0.03));
        f.position.set(g.x+2.0+Math.floor(i/5)*1.25,0,g.z+(i%5-2)*1.15+(Math.floor(i/5)%2)*0.5);
        f.userData.i=i; f.visible=false; d.figs.push(f);
      }
    },frame:function(k,d){
      var g=d.g;
      if(k<0.3){
        /* 面朝闸机：红灯——停一下——变成白的 */
        var ok=k>0.16;
        d.lamp.material.color.setHex(ok?0xe8e4d2:0xd23a2e);
        if(ok&&!d.beep){ d.beep=1; try{ SFX.click(); setTimeout(function(){ try{SFX.click();}catch(e){} },120); }catch(e){} }
        cutLook(g.x+3.4,1.6,g.z+0.6, g.x,1.3,g.z+0.6);
        d.figs.forEach(function(f){ f.visible=false; });
        cutFade(k>0.24?(k-0.24)/0.06:0);
        return;
      }
      /* 门外：先背对校门站着，慢慢转回头；门里的人一个接一个出现，都看着你 */
      var turn=cutPhase(k,0.36,0.5), back=cutPhase(k,0.5,1);
      var cx=cutLerp(g.x-2.4,g.x-6,back), ang=cutLerp(Math.PI,0,turn);
      cutLook(cx,1.6,g.z+Math.sin(k*3)*0.08, cx+Math.cos(ang)*5,1.5,g.z+Math.sin(ang)*5);
      d.figs.forEach(function(f){
        f.visible=k>0.5+f.userData.i*0.028;
        /* 直接算朝向：先 lookAt 再改 rotation.z，欧拉角换算出的 180° 翻转会把人倒过来 */
        f.rotation.set(0,Math.atan2(GLR.cam.position.x-f.position.x,GLR.cam.position.z-f.position.z),0.06*Math.sin(f.userData.i*1.7));   /* 头都歪着一点 */
      });
      cutFade(k<0.36?1-(k-0.3)/0.06:(k>0.9?(k-0.9)/0.1:0));
    }},
  /* 《先辈》：隔间的门缝里漏出光，旧校服的人走出来，看了你一眼，往外跑；跟着他跑出去，颜色一点点回来 */
  beast:{dur:9,setup:function(d){
      var a=cutCell('teach1',59.5,16.6);
      d.light=cutAdd(new THREE.Mesh(new THREE.PlaneGeometry(0.9,2.1),cutBasic(0xf2ead2,0)));
      d.light.position.set(a.x,1.05,a.z+0.42);
      var f=cutAdd(cutFigure(0x2a3a5a,1)); d.fig=f; f.position.set(a.x,0,a.z); f.visible=false;
    },frame:function(k,d){
      /* 路线按厕所的格子走：隔间 (59.5,16.6) → 隔间前的过道 (59,18.6) → 厕所门 (57,19.3) → 走廊往西。
         镜头先站在洗手池边，等他出门再跟到门口、沿走廊跟上去，不穿隔板和墙 */
      var a=cutCell('teach1',59.5,16.6), s1=cutCell('teach1',59,18.6), door=cutCell('teach1',57,19.3), b=cutCell('teach1',30,19.3), cam0=cutCell('teach1',60.6,19.4);
      var open=cutPhase(k,0,0.18), step=cutPhase(k,0.16,0.3), toDoor=cutPhase(k,0.36,0.5), run=cutPhase(k,0.5,0.88);
      d.light.material.opacity=0.45*open*(1-cutPhase(k,0.3,0.42));        /* 他一跑出来，门缝里的光就收了 */
      d.light.visible=k<0.42;
      d.fig.visible=k>0.16;
      var fx,fz;
      if(k<0.36){ fx=cutLerp(a.x,s1.x,step); fz=cutLerp(a.z,s1.z,step); }
      else if(k<0.5){ fx=cutLerp(s1.x,door.x,toDoor); fz=cutLerp(s1.z,door.z,toDoor); }
      else { fx=cutLerp(door.x,b.x,run); fz=door.z; }
      d.fig.position.set(fx,Math.abs(Math.sin(k*40))*0.05*(k>0.36&&k<0.88?1:0),fz);
      /* 走出来先面朝你停一下，再转身跑 */
      d.fig.rotation.set(0,k<0.36?Math.atan2(GLR.cam.position.x-fx,GLR.cam.position.z-fz):Math.atan2(b.x-fx,(k<0.5?door.z:b.z)-fz),0);
      var follow=cutPhase(k,0.42,0.58), chase=cutPhase(k,0.58,1);
      var cx=k<0.58?cutLerp(cam0.x,door.x+0.6,follow):cutLerp(door.x+0.6,Math.min(door.x+0.6,fx+3.2),chase);
      var cz=k<0.58?cutLerp(cam0.z,door.z,follow):door.z;
      var bob=Math.sin(k*44)*0.04*(SHAKE_ON?1:0)*(k>0.42&&k<0.9?1:0);
      cutLook(cx,1.6+bob,cz, fx,1.4,fz);
      GLR.worldNorm=cutPhase(k,0.5,0.95);                    /* 整座学校第一次有了颜色 */
      cutFade(k>0.92?(k-0.92)/0.08:0);
    }},
  /* 《门》：实验台上三样材料一起亮起来，嗡声越来越高；光圈撑开；往后退了半步——然后走进去 */
  portal:{dur:10,setup:function(d){
      var p=cutCell('lab1',25,4.2), i; d.p=p;
      d.parts=[];
      [[0xc07a3a,-0.5],[0xcfe6ef,0],[0x7fe0a0,0.5]].forEach(function(q){
        var m=cutAdd(new THREE.Mesh(new THREE.SphereGeometry(0.07,10,8),cutBasic(q[0])));
        m.position.set(p.x+q[1],1.0,p.z+1.2); d.parts.push(m);
      });
      d.ring=cutAdd(new THREE.Mesh(new THREE.TorusGeometry(1,0.07,10,48),new THREE.MeshBasicMaterial({color:0xfff0c0,fog:false})));
      d.disk=cutAdd(new THREE.Mesh(new THREE.CircleGeometry(0.98,48),new THREE.MeshBasicMaterial({color:0x6fd0ff,fog:false,transparent:true,opacity:0.85})));
      d.ring.position.set(p.x,1.3,p.z); d.disk.position.set(p.x,1.3,p.z+0.01);
      d.ring.scale.setScalar(0.01); d.disk.scale.setScalar(0.01);
      try{ SFX.hum&&SFX.hum(); }catch(e){}
    },frame:function(k,d){
      var p=d.p, charge=cutPhase(k,0,0.3), form=cutPhase(k,0.25,0.5);
      d.parts.forEach(function(m,i){
        var pulse=0.5+0.5*Math.sin(k*(20+i*7)+i);
        m.scale.setScalar(1+charge*1.2*pulse);
        m.position.y=1.0+charge*0.35*Math.sin(i+k*6)*0.3;
      });
      var s=form*1.1+0.02;
      d.ring.scale.setScalar(s); d.disk.scale.setScalar(s);
      d.ring.rotation.z=k*4;
      d.disk.material.color.setHSL((k*1.5)%1,0.7,0.6);
      /* 0.5–0.62 往后退半步（不想靠近），0.62 以后推进去 */
      var hes=cutPhase(k,0.5,0.6)*(1-cutPhase(k,0.62,0.7)), push=cutPhase(k,0.62,0.98);
      var z=cutLerp(p.z+5.5,p.z+0.2,push)+0.8*hes;
      cutLook(p.x,1.35,z, p.x,1.3,p.z);
      GLR.worldNorm=cutPhase(k,0.6,0.95);
      GLR.flash=k>0.88?(k-0.88)/0.12*0.9:0;
    }}
};

function playCut(id,done){
  var def=CUT_DEF[id];
  if(!CUT.enabled||!def||!GLR.cam){ done(); return; }
  try{ patReset(); }catch(e){}
  try{ anfxClear(); }catch(e){}
  try{ UI.closePanelAll(); UI.closeChoice(); }catch(e){}
  resetInputState(); releaseMouseLook();
  CUT.on=true; CUT.t=0; CUT.id=id; CUT.dur=def.dur; CUT.done=done; CUT.data={};
  CUT.savedVisual={worldNorm:GLR.worldNorm,dayExpo:GLR.dayExpo};
  S.screen='cut';
  document.body.classList.add('cut');
  cutFade(0);
  try{ def.setup(CUT.data); }catch(e){ try{ console.error(e); }catch(_e){} }
}
function cutTick(dt){
  if(!CUT.on) return;
  CUT.t+=dt;
  var def=CUT_DEF[CUT.id], k=clamp(CUT.t/CUT.dur,0,1);
  try{ def.frame(k,CUT.data); }catch(e){}
  if(k>=1) cutFinish();
}
function cutFinish(){
  if(!CUT.on) return;
  var def=CUT_DEF[CUT.id];
  try{ if(def.clean) def.clean(CUT.data); }catch(e){}
  if(CUT.grp){ GLR.scene.remove(CUT.grp);ThreeBackend.disposeGroup(CUT.grp);CUT.grp=null; }
  CUT.on=false;
  document.body.classList.remove('cut');
  GLR.flash=0;
  if(CUT.savedVisual){
    GLR.worldNorm=CUT.savedVisual.worldNorm;GLR.dayExpo=CUT.savedVisual.dayExpo;CUT.savedVisual=null;
    try{updateLighting();}catch(e){}
  }
  var f=document.getElementById('cutfade'); if(f) f.style.opacity='0';
  var done=CUT.done; CUT.done=null;
  if(done) done();
}
function cutSkip(){ if(CUT.on) cutFinish(); }
