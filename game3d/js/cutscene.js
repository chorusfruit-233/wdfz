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

var CUT_DEF={
  /* 《闸门》：车已经开出北门，后视镜里学校越退越远，窗户一扇扇暗下去 */
  car:{dur:8,setup:function(d){
      S.mode='out'; S.room=null; S.x=GATE_N.x*SC; S.y=(GATE_N.y+40)*SC; enterWorldOut();
    },frame:function(k,d){
      var g=cutW2S(GATE_N.x,GATE_N.y), z=cutLerp(g.z-1.5,g.z-30,cutEase(k));
      var sway=Math.sin(k*34)*0.025;
      cutLook(g.x+sway,1.25,z, g.x,2.4,g.z+24);                  /* 往回看：门、教学楼 */
      if(GLR.scene.fog) GLR.scene.fog.density=cutLerp(0.012,0.04,k);
      GLR.dayExpo=(GLR.dayExpo||1)*(1-0.3*k);                    /* 学校那边一点点暗下去（updateLighting 每帧先重算，这里不会越乘越暗） */
      cutFade(k>0.82?(k-0.82)/0.18:0);
    }},
  /* 《白名单》：已经站在西小门外面，回头——门里一个接一个站满了人，在目送你 */
  face:{dur:9,setup:function(d){
      S.mode='out'; S.room=null; S.x=(GATE_W.x+30)*SC; S.y=GATE_W.y*SC; enterWorldOut();
      var g=cutW2S(GATE_W.x,GATE_W.y), i;
      for(i=0;i<9;i++){
        var f=cutAdd(cutFigure(0x050607,1));
        f.position.set(g.x+2.2+Math.floor(i/3)*1.3,0,g.z+(i%3-1)*1.4+(Math.floor(i/3)%2)*0.5);
        f.userData.i=i; f.visible=false;
      }
      d.figs=CUT.grp.children.slice();
    },frame:function(k,d){
      var g=cutW2S(GATE_W.x,GATE_W.y);
      var x=cutLerp(g.x-2.2,g.x-6,cutEase(k));                   /* 面朝校门，慢慢往后退 */
      cutLook(x,1.6,g.z+Math.sin(k*3)*0.1, g.x+3,1.5,g.z);
      d.figs.forEach(function(f){ f.visible=k>0.18+f.userData.i*0.05; f.lookAt(GLR.cam.position.x,0,GLR.cam.position.z); });
      cutFade(k>0.85?(k-0.85)/0.15:0);
    }},
  /* 《第三个桶》（假结局）：桶盖合上，黑，颠，有人敲了两下 */
  trash:{dur:7,setup:function(d){
      d.knock=0;
      var R=INTERIORS[S.room]||INTERIORS.trash1, p=worldToScene(S.x,S.y,R);
      var wall=cutAdd(new THREE.Mesh(new THREE.CylinderGeometry(0.42,0.36,1.0,16,1,true),new THREE.MeshLambertMaterial({color:0x2e5a3a,side:THREE.DoubleSide})));
      wall.position.set(p.x,0.5,p.z);
      var lid=new THREE.Mesh(new THREE.CylinderGeometry(0.45,0.45,0.04,16),new THREE.MeshLambertMaterial({color:0x24482e}));
      lid.position.set(0.45,0,0);                             /* 绕桶沿的铰链转 */
      var hinge=cutAdd(new THREE.Group()); hinge.position.set(p.x-0.45,1.0,p.z); hinge.add(lid);
      d.hinge=hinge;
    },
    frame:function(k,d){
      var R=INTERIORS[S.room]||INTERIORS.trash1, p=worldToScene(S.x,S.y,R);
      d.hinge.rotation.z=cutLerp(1.9,0,cutEase(Math.min(1,k/0.35)));   /* 桶盖合上 */
      var shake=k>0.45?Math.sin(k*90)*0.04:0;
      cutLook(p.x+shake,0.55,p.z, p.x,2.4,p.z-0.3);            /* 从桶里往上看 */
      cutFade(k<0.35?k/0.35*0.85:0.85+(k>0.9?(k-0.9)/0.1*0.15:0));
      if(k>0.6&&d.knock===0){ d.knock=1; try{ SFX.door(); }catch(e){} }
      if(k>0.72&&d.knock===1){ d.knock=2; try{ SFX.door(); }catch(e){} }
    }},
  /* 《先辈》：隔间门被撞开，旧校服的背影往外跑；跟着他跑出去，颜色回来了 */
  beast:{dur:8,setup:function(d){
      var f=cutAdd(cutFigure(0x2a3a5a,1)); d.fig=f;
      var a=cutCell('teach1',59.5,16.6); f.position.set(a.x,0,a.z);
    },frame:function(k,d){
      var a=cutCell('teach1',59.5,16.6), b=cutCell('teach1',30,18), cam0=cutCell('teach1',57.5,18.6);
      var run=cutEase(clamp((k-0.15)/0.75,0,1));
      var fx=cutLerp(a.x,b.x,run), fz=cutLerp(a.z,b.z,Math.min(1,run*3));
      d.fig.position.set(fx,Math.abs(Math.sin(k*40))*0.05,fz);
      d.fig.rotation.y=Math.atan2(b.x-a.x,b.z-a.z)*(run>0?1:0);
      var cx=cutLerp(cam0.x,fx+3,clamp((k-0.3)/0.7,0,1));
      cutLook(cx,1.6,cam0.z, fx,1.4,fz);
      GLR.worldNorm=cutEase((k-0.4)/0.5);                     /* 整座学校第一次有了颜色 */
      cutFade(k>0.9?(k-0.9)/0.1:0);
    }},
  /* 《门》（真结局）：实验台前撑开一个光圈，推进去 */
  portal:{dur:8,setup:function(d){
      var p=cutCell('lab1',25,4.2);
      var ring=cutAdd(new THREE.Mesh(new THREE.TorusGeometry(1,0.07,10,48),new THREE.MeshBasicMaterial({color:0xfff0c0,fog:false})));
      var disk=cutAdd(new THREE.Mesh(new THREE.CircleGeometry(0.98,48),new THREE.MeshBasicMaterial({color:0x6fd0ff,fog:false,transparent:true,opacity:0.85})));
      ring.position.set(p.x,1.3,p.z); disk.position.set(p.x,1.3,p.z+0.01);
      d.ring=ring; d.disk=disk; d.p=p;
    },frame:function(k,d){
      var s=cutEase(Math.min(1,k/0.35))*1.1+0.05;
      d.ring.scale.set(s,s,s); d.disk.scale.set(s,s,s);
      d.ring.rotation.z=k*4;
      d.disk.material.color.setHSL((k*1.5)%1,0.7,0.6);
      var z=cutLerp(d.p.z+5.5,d.p.z+0.2,cutEase(clamp((k-0.35)/0.6,0,1)));
      cutLook(d.p.x,1.35,z, d.p.x,1.3,d.p.z);
      GLR.worldNorm=cutEase((k-0.5)/0.4);
      GLR.flash=k>0.85?(k-0.85)/0.15:0;
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
