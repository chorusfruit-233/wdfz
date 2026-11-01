/* 宣传片第二版：镜头脚本。
   不随游戏加载，只由 video/render.py 注入页面。每一帧：按时间找到当前镜头 → 第一次进入时搭场景 →
   摆镜头、推特效 → 用固定步长调一次游戏自己的 render()。画面里的场景、灯光、模型、异象和死亡演出都是游戏本身的。
   分镜结构见 video/storyboard.json：同一个机位拍三天——第一天一切正常，第二天开始不对劲，第三天异象全来了。
   不拍隐藏结局、不出现任何钟点；只用玩家 Wiki 上公开的内容。 */
'use strict';

var TV={sb:null,fps:24,cur:-1,startF:[],total:0,d:{},grp:null,figs:[]};

/* ---------- 随机数：每个镜头固定种子，分几个进程并行渲染也和顺序渲染一样 ---------- */
function tvSeed(n){
  var s=(n*2654435761)>>>0||1;
  Math.random=function(){ s=(s+0x6D2B79F5)>>>0; var t=s; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; };
}

/* ---------- 画面上的字：和游戏界面同一套「旧校务档案」配色（纸色字、公章红、黄铜） ---------- */
function tvCss(){
  var st=document.createElement('style');
  st.textContent=[
    '#hud,#prompt,#cross,#touch,#lookhint,#sub,#searchring,.screen-control,#toast,#banner,#mini,#skip,#cutbars,#drivehud,#qualityHint,#investigateOpen,#lessonOpen{display:none!important}',
    '.tv{position:fixed;pointer-events:none;font-family:"WenQuanYi Zen Hei","Noto Sans CJK SC",sans-serif;color:#ddd5c4;opacity:0}',
    '#tvbars{opacity:1}#tvbars i{position:fixed;left:0;right:0;height:8.5vh;background:#000;z-index:60}#tvbars i:first-child{top:0}#tvbars i:last-child{bottom:0}',
    '#tvblack{inset:0;background:#000;z-index:61}',
    '#tvslits{inset:0;z-index:59;background:repeating-linear-gradient(180deg,rgba(0,0,0,.97) 0 7.4vh,rgba(0,0,0,.12) 7.4vh 10.6vh);box-shadow:inset 0 0 24vh 7vh #000}',
    '#tvcard{inset:0;z-index:62;display:flex;align-items:center;justify-content:center;gap:4vh}',
    '#tvcard b{font-weight:400;font-size:7.6vh;letter-spacing:3.2vh;padding-left:3.2vh;text-shadow:0 0 2vh rgba(0,0,0,.9)}',
    '#tvcard i{font-style:normal;display:flex;align-items:center;justify-content:center;width:9vh;height:9vh;font-size:5.4vh;color:#d9473e;',
    '  border:.5vh solid rgba(181,51,47,.9);box-shadow:inset 0 0 0 .4vh rgba(181,51,47,.25);transform:rotate(-6deg)}',
    '#tvloc{left:6vw;bottom:13vh;z-index:62;padding:1.2vh 4vh 1.4vh 2vh;border-left:.35vh solid #b5332f;background:linear-gradient(90deg,rgba(8,7,7,.78),rgba(8,7,7,.4) 70%,rgba(8,7,7,0))}',
    '#tvloc b{display:block;font-weight:400;font-size:4vh;letter-spacing:1vh;color:#ece4d3;text-shadow:0 .2vh .6vh #000}',
    '#tvloc i{display:block;font-style:normal;font-size:2.2vh;letter-spacing:.6vh;color:#a0978a;margin-top:.8vh}',
    '#tvstamp{left:6vw;bottom:13vh;z-index:62;display:flex;align-items:center;gap:2vh}',
    '#tvstamp i{font-style:normal;font-size:2.3vh;letter-spacing:.6vh;padding:.5vh 1vh .5vh 1.6vh;color:#e0675c;border:.3vh solid rgba(214,93,82,.85);transform:rotate(-4deg)}',
    '#tvstamp b{font-weight:400;font-size:4.2vh;letter-spacing:1.2vh;color:#ece4d3;text-shadow:0 0 1.4vh #000,0 0 .4vh #000}',
    '#tvcap{left:0;right:0;bottom:12.5vh;z-index:62;text-align:center;font-size:3.4vh;letter-spacing:1.1vh;color:#e2dac9;text-shadow:0 0 1.2vh #000,0 0 .3vh #000}',
    '#tvlines{inset:0;z-index:62;display:flex;flex-direction:column;align-items:center;justify-content:center;opacity:1}',
    '#tvlines div{font-size:4.8vh;letter-spacing:1.6vh;margin:1.4vh 0;opacity:0;text-shadow:0 0 2.4vh rgba(0,0,0,.9)}',
    '#tvlines .big{font-size:8.8vh;letter-spacing:2.8vh;color:#efe7d6;text-shadow:0 0 3vh rgba(150,20,12,.6),0 0 .8vh #000}',
    '#tvlines .rule{width:22vh;height:.25vh;background:linear-gradient(90deg,transparent,#b5332f,transparent);margin:1vh 0 2vh;padding:0}',
    '#tvlines .sub{font-size:2.8vh;letter-spacing:1.3vh;color:#a0978a}',
    '#tvlines .low{position:absolute;bottom:14vh;font-size:3.4vh;letter-spacing:1vh;color:#cfc6b6}'
  ].join('\n');
  document.head.appendChild(st);
  document.body.insertAdjacentHTML('beforeend',
    '<div id="tvslits" class="tv"></div><div id="tvbars" class="tv"><i></i><i></i></div><div id="tvblack" class="tv"></div>'+
    '<div id="tvcard" class="tv"><i></i><b></b></div><div id="tvloc" class="tv"><b></b><i></i></div>'+
    '<div id="tvstamp" class="tv"><i></i><b></b></div><div id="tvcap" class="tv"></div><div id="tvlines" class="tv"></div>');
}
function $v(id){ return document.getElementById(id); }
function tvOp(id,v){ $v(id).style.opacity=String(clamp(v,0,1)); }
/* 淡入 → 停 → 淡出 */
function tvEnv(t,a,b,fin,fout){ return clamp(Math.min((t-a)/(fin||0.5),(b-t)/(fout||0.5)),0,1); }
/* 老灯管似的偶尔一暗 */
function tvFlick(t,seed){ var x=Math.sin(t*61.7+seed*7.3)*Math.sin(t*23.1+seed); return x>0.94?0.3:1; }
function tvEase(k){ k=clamp(k,0,1); return k*k*(3-2*k); }
function tvLerp(a,b,k){ return a+(b-a)*k; }

/* ---------- 场景工具 ---------- */
function tvLook(px,py,pz,tx,ty,tz){ GLR.cam.position.set(px,py,pz); GLR.cam.up.set(0,1,0); GLR.cam.lookAt(tx,ty,tz); }
function tvRoom(id,tsec){ if(tsec!==undefined) S.tsec=tsec; S.mode='in'; S.room=id; doEnterRoom(id); running=false; S.screen='cut'; }
function tvOut(tsec){ if(tsec!==undefined) S.tsec=tsec; S.mode='out'; S.room=null; enterWorldOut(); running=false; S.screen='cut'; }
function tvCell(room,c,r){ var R=INTERIORS[room]; return worldToScene(R.ox+(c+0.5)*R.tw,R.oy+(r+0.5)*R.th,R); }
function tvWorld(room,c,r){ var R=INTERIORS[room]; return {x:R.ox+(c+0.5)*R.tw,y:R.oy+(r+0.5)*R.th}; }
function tvMap(mx,my){ return worldToScene(mx*SC,my*SC,null); }
function tvAdd(o){ if(!TV.grp){ TV.grp=new THREE.Group(); GLR.scene.add(TV.grp); } TV.grp.add(o); return o; }
function tvFigure(kind,col,scale){ var g=new THREE.Group(); g.add(figMesh(kind,new THREE.MeshBasicMaterial({color:col,fog:true}),scale||1)); return tvAdd(g); }
function tvReset(){
  try{ anfxClear(); }catch(e){}
  try{ patRemoveFig(); }catch(e){}
  if(TV.grp){ GLR.scene.remove(TV.grp); ThreeBackend.disposeGroup(TV.grp); TV.grp=null; }
  if(CUT.grp){ GLR.scene.remove(CUT.grp); ThreeBackend.disposeGroup(CUT.grp); CUT.grp=null; }
  try{ cutFade(0); }catch(e){}
  AN.active=false; AN.id=null; AN.acc=0; AN.t=0; AN.data={};
  PAT.state='idle'; PAT.locked=false; GLR.patrolRed=0; GLR.patrolFlick=0; GLR.gazeT=0; GLR.gaze=0; GLR.flash=0; GLR.worldNorm=0; GLR.hurt=0; GLR.overcast=0;
  ROAM.on=false; USE.torch=false; if(GLR.torch) GLR.torch.intensity=0; S.san=100; S.dead=false; S.floorY=0; GLR.dayExpo=1;
  ['tvcard','tvloc','tvstamp','tvcap','tvslits','tvlines','tvblack'].forEach(function(id){ tvOp(id,0); });
  $v('tvlines').innerHTML='';
}
/* 室内的同学：先按游戏规则坐一遍，再把自己座位周围坐满（中间那个空着）；第一天是正常的同学，之后是黑影 */
function tvClass(normal){
  var R=INTERIORS.teach1, c, r;
  try{ ncBuild(R); }catch(e){}
  if(!NC.grp) return;
  for(r=1;r<R.rows-1;r++) for(c=45;c<=51;c++){
    if(R.grid[r][c]!=='d'||NC.occ[c+','+r]||(c===48&&r===6)) continue;
    var sp=worldToScene(R.ox+(c+0.5)*R.tw,R.oy+(r+0.82)*R.th,R);
    var f=ncSeatFigure(NC.matS,sp.x,0,sp.z,0); NC.grp.add(f); NC.list.push(f); NC.occ[c+','+r]=1;
  }
  var m=normal?NC.matN:NC.matS;
  NC.list.forEach(function(f){ f.traverse(function(o){ if(o.isMesh) o.material=m; }); });
}
function tvSeat(){ return tvCell('teach1',48,6.2); }
function tvLoc(sh){ $v('tvloc').querySelector('b').textContent=sh.loc||''; $v('tvloc').querySelector('i').textContent=sh.note||''; }
function tvStamp(sh){ $v('tvstamp').querySelector('i').textContent=sh.stamp||''; $v('tvstamp').querySelector('b').textContent=sh.text||''; }
function tvLines(lines,cls,sub,low){
  $v('tvlines').innerHTML=(lines||[]).map(function(s){ return '<div class="'+(cls||'')+'">'+s+'</div>'; }).join('')+
    (sub?'<div class="rule"></div><div class="sub">'+sub+'</div>':'')+(low?'<div class="low">'+low+'</div>':'');
}
function tvLinesOp(fn){ var ls=$v('tvlines').children; for(var i=0;i<ls.length;i++) ls[i].style.opacity=String(clamp(fn(i,ls[i]),0,1)); }
/* 镜头开头 / 结尾的黑：in、out 秒 */
function tvDip(t,dur,inn,out){ return clamp(inn?1-t/inn:0,0,1)+clamp(out?(t-dur+out)/out:0,0,1); }

/* ---------- 共用的几个机位：三天里都用同一个 ---------- */
/* 北门外，往门口慢慢推 */
function camGate(k,t){
  var g=tvMap(GATE_N.x,GATE_N.y), z=tvLerp(g.z-18,g.z-8,tvEase(k));
  tvLook(g.x+Math.sin(t*0.4)*0.2,1.6,z,g.x,3.2,g.z+30);
  return g;
}
/* 自己的座位上，看黑板 */
function camClass(k,t){
  var s=tvSeat(), b=tvCell('teach1',48,0.6);
  tvLook(s.x+Math.sin(t*0.6)*0.03,1.22+Math.sin(t*1.3)*0.008,s.z-k*0.25,b.x+Math.sin(t*0.4)*0.15,1.55,b.z);
}
/* 一楼走廊，从西头往东看 */
function camHall(k,t){
  var a=tvCell('teach1',20,18), b=tvCell('teach1',58,18);                /* 西头那几盏灯是坏的，从中段往东看 */
  tvLook(tvLerp(a.x,a.x+4,k),1.6+Math.sin(t*5)*0.012,a.z,b.x,1.5,b.z);
}
/* 清华水杯：四楼窗台的近景 */
function tvCupSetup(wob){
  tvOut(wob?1085:640); S.x=560*SC+(TV.cupDx===undefined?-1:TV.cupDx)/U2M; S.y=857*SC; S.ang=-PI/2;
  var w=cupWall(); AN.active=true; AN.id='cup'; AN.t=0; AN.data={wall:w,phase:0,wob:wob||1e9};
  anfxSpawn('cup',S.x,S.y);
  var st=ANFX.cup; if(!st) return null;
  return {st:st,n:{x:w.nx,z:w.ny},tg:{x:-w.ny,z:w.nx}};
}
function camSill(c,k,t){
  var sl=c.st.sill, n=c.n, tg=c.tg, a=0.32-k*0.4;                    /* 窗外一米：杯子站在窗框上沿 */
  tvLook(sl.x+n.x*1.05+tg.x*a, CUP_H+0.30+Math.sin(t*0.8)*0.015, sl.z+n.z*1.05+tg.z*a, sl.x, CUP_H+0.21, sl.z);
}

/* ---------- 镜头 ---------- */
var TV_SHOT={
  /* ===== 第一天：白天，一切正常 ===== */
  d1card:{setup:function(sh){ tvOut(600); tvCard(sh.card,'壹'); },
    frame:function(k,t,sh){ tvOp('tvblack',1); tvOp('tvcard',tvEnv(t,0.5,sh.dur-0.3,0.8,0.5)); camGate(0,t); }},
  d1gate:{setup:function(sh){ tvOut(600); tvLoc(sh); },
    frame:function(k,t,sh){ camGate(k,t); tvOp('tvloc',tvEnv(t,0.7,sh.dur-0.3,0.7,0.4)); tvOp('tvblack',tvDip(t,sh.dur,0.6,0)); }},
  d1class:{setup:function(sh){ tvRoom('teach1',600); tvClass(true); tvLoc(sh); },
    frame:function(k,t,sh){ camClass(k,t); tvOp('tvloc',tvEnv(t,0.6,sh.dur-0.3,0.7,0.4)); tvOp('tvblack',tvDip(t,sh.dur,0.25,0)); }},
  d1hall:{setup:function(sh){ tvRoom('teach1',620); tvLoc(sh); },
    frame:function(k,t,sh){ camHall(k,t); tvOp('tvloc',tvEnv(t,0.5,sh.dur-0.3,0.6,0.4)); tvOp('tvblack',tvDip(t,sh.dur,0.2,0)); }},
  d1cup:{setup:function(sh){ TV.d.c=tvCupSetup(0); tvLoc(sh); },
    frame:function(k,t,sh){ AN.t=t; if(TV.d.c) camSill(TV.d.c,k,t); tvOp('tvloc',tvEnv(t,0.5,sh.dur-0.4,0.6,0.4)); tvOp('tvblack',tvDip(t,sh.dur,0.2,0.4)); }},

  /* ===== 第二天：黄昏，同样的机位 ===== */
  d2card:{setup:function(sh){ tvOut(1080); tvCard(sh.card,'贰'); },
    frame:function(k,t,sh){ tvOp('tvblack',1); tvOp('tvcard',tvEnv(t,0.3,sh.dur-0.25,0.5,0.4)*tvFlick(t,3)); }},
  /* 门里的路中间站着一个人；最后一下，它已经贴在门上 */
  d2gate:{setup:function(sh){ tvOut(1085); GLR.overcast=0.6;
      var g=tvMap(GATE_N.x,GATE_N.y); TV.d.f=tvFigure('tall',0x020303,1.12); TV.d.f.position.set(g.x+0.3,0,g.z+5); TV.d.f.rotation.y=PI; },
    frame:function(k,t,sh){ var g=camGate(k*0.8,t);
      if(t>sh.dur-0.55){ TV.d.f.position.set(g.x+0.2,0,g.z+1.2); }
      tvOp('tvblack',tvDip(t,sh.dur,0.2,0.08)); }},
  /* 同样的座位：全班一起回过头，墙上一只只睁开眼睛 */
  d2class:{setup:function(sh){ tvRoom('teach1',1080); tvClass(false);
      var w=tvWorld('teach1',48,6.2); S.x=w.x; S.y=w.y; S.ang=-PI/2;
      AN.active=true; AN.id='stare'; AN.acc=0; AN.data={}; anfxSpawn('stare',S.x,S.y); },
    frame:function(k,t,sh){ AN.acc=k*2.4; if(t>2.4) AN.data.hit=1; camClass(k*0.4,t); tvOp('tvblack',tvDip(t,sh.dur,0.15,0.08)); }},
  /* 同样的走廊：灯两短一长地闪，尽头站着一个人 */
  d2hall:{setup:function(sh){ tvRoom('teach1',1090); patAddFig(); var w=tvWorld('teach1',46,18.2); PAT.state='walk'; PAT.room='teach1'; PAT.x=w.x; PAT.y=w.y; },
    frame:function(k,t,sh){ camHall(k,t); GLR.patrolFlick=clamp((t-0.6)/0.8,0,1);
      if(GLR.patFig) GLR.patFig.visible=t>1.4&&(Math.sin(t*80)>-0.3||t>2.2);
      tvOp('tvblack',tvDip(t,sh.dur,0.15,0.08)); }},
  /* 同样的窗台：杯子在晃——掉下来——砸在面前，淡紫色的盖子滚开 */
  d2cup:{setup:function(sh){ TV.d.c=tvCupSetup(0.9); var c=TV.d.c; if(!c) return;
      var sl=c.st.sill; TV.d.land={x:sl.x+c.n.x*2.6,z:sl.z+c.n.z*2.6};
      AN.data.lx=TV.d.land.x/U2M; AN.data.ly=TV.d.land.z/U2M; },
    frame:function(k,t,sh){
      var c=TV.d.c, d=AN.data; AN.t=t; if(!c) return;
      var FALL=cupFallTime(), sl=c.st.sill, L=TV.d.land, n=c.n, tg=c.tg;
      if(t>=1.35&&d.phase===0){ d.phase=1; d.tf=1.35; }
      if(d.phase===1&&t-d.tf>=FALL){ d.phase=2; d.tl=t; GLR.flash=0.55; }
      if(t<1.35) camSill(c,0.2+t*0.1,t);
      else if(d.phase!==2){                                     /* 地上抬头看它掉下来 */
        var u=clamp((t-1.35)/FALL,0,1), cx=sl.x+n.x*7, cz=sl.z+n.z*7+tg.z*0.5;
        tvLook(cx,1.5,cz, tvLerp(sl.x,L.x,u),tvLerp(CUP_H,0.3,u*u),tvLerp(sl.z,L.z,u));
      }else{                                                   /* 低机位：杯子摔瘪躺下，盖子滚开 */
        var e=t-d.tl, sh2=e<0.3?(Math.random()-0.5)*0.08:0;
        tvLook(L.x+n.x*2.2+tg.x*0.9+sh2,0.55,L.z+n.z*2.2+tg.z*0.9, L.x,0.15,L.z);
      }
      tvOp('tvblack',tvDip(t,sh.dur,0.15,0.35)); }},

  /* ===== 第三天：「第三天」跳回「第一天」；然后异象一个接一个 ===== */
  d3card:{setup:function(sh){ tvOut(1340); tvCard(sh.card,'叁'); },
    frame:function(k,t,sh){ tvOp('tvblack',1);
      var g=t>1.25&&t<1.35||t>1.55;                             /* 闪一下，再闪一下，就变回了第一天 */
      $v('tvcard').querySelector('b').textContent=g?sh.glitch:sh.card; $v('tvcard').querySelector('i').textContent=g?'壹':'叁';
      tvOp('tvcard',tvEnv(t,0.2,sh.dur-0.2,0.4,0.25)*(t>1.2&&t<1.6?(Math.sin(t*90)>0?1:0.2):1)); }},
  rain:{setup:function(sh){ tvOut(1340); S.x=560*SC; S.y=820*SC; AN.active=true; AN.id='rain'; anfxSpawn('rain',S.x,S.y); tvStamp(sh); },
    frame:function(k,t,sh){ var p=tvMap(560,820), w=tvMap(592,866);
      tvLook(p.x,1.55,p.z,w.x,3.0+k*2,w.z); GLR.overcast=1;
      if(WX.rain){ if(t>0.5&&!TV.d.b1){ TV.d.b1=1; WX.rain.nextBolt=0; } if(t>2.2&&!TV.d.b2){ TV.d.b2=1; WX.rain.nextBolt=0; } }
      tvOp('tvstamp',tvEnv(t,0.3,sh.dur-0.15,0.2,0.2)); tvOp('tvblack',tvDip(t,sh.dur,0.1,0)); }},
  moth:{setup:function(sh){ tvOut(1110); S.x=560*SC; S.y=800*SC; S.ang=PI/2;
      AN.active=true; AN.id='moth'; AN.data={src:{x:S.x+25,y:S.y+8}}; anfxSpawn('moth',S.x+25,S.y+8); tvStamp(sh); },
    frame:function(k,t,sh){ var p=tvMap(560,800), s=tvMap(572.5,804); AN.acc=1.2+k*6;
      tvLook(p.x,1.5,p.z,s.x,2.7-k*0.8,s.z);
      tvOp('tvstamp',tvEnv(t,0.3,sh.dur-0.15,0.2,0.2)); tvOp('tvblack',tvDip(t,sh.dur,0.1,0)); }},
  /* 钟楼：站在旋转楼梯底下往上看 */
  bell:{setup:function(sh){ tvRoom('bell1',1355); USE.torch=true; tvStamp(sh); },
    frame:function(k,t,sh){ var cx=SPIRAL.cx, cz=SPIRAL.cz;
      tvLook(cx+1.2-k*1.8,0.75,cz+5.6, cx,2.4+tvEase(k)*6,cz); if(GLR.torch) GLR.torch.intensity=40;
      GLR.flash=(t>1.0&&t<1.08)||(t>2.1&&t<2.18)?0.18:GLR.flash;
      tvOp('tvstamp',tvEnv(t,0.3,sh.dur-0.15,0.2,0.2)); tvOp('tvblack',tvDip(t,sh.dur,0.1,0)); }},
  /* 车库：手电照着一排排车，最后一照，车之间站着那个东西 */
  garage:{setup:function(sh){ tvRoom('garage1',1355); tvLoc(sh); USE.torch=true;
      var w=tvWorld('garage1',21,10.8); ROAM.on=true; ROAM.x=w.x; ROAM.y=w.y; },
    frame:function(k,t,sh){ var a=tvCell('garage1',8,11), b=tvCell('garage1',16,11), z=tvCell('garage1',21,10.8);
      var x=tvLerp(a.x,b.x,k), tx=t<2.3?x+6:z.x, tz=t<2.3?a.z+Math.sin(t*1.6)*1.1:z.z;
      tvLook(x,1.55+Math.abs(Math.sin(t*4.4))*0.03,a.z,tx,1.3,tz);
      if(GLR.torch) GLR.torch.intensity=55*((Math.sin(t*37)>0.85&&t>2.1)?0.15:1);
      if(GLR.roamFig) GLR.roamFig.visible=t>2.25;
      tvOp('tvloc',tvEnv(t,0.3,sh.dur-0.6,0.4,0.3)); tvOp('tvblack',tvDip(t,sh.dur,0.1,0.12)); }},
  /* 巡察者：灯一下子全红，它从走廊那头走过来 */
  patrol:{setup:function(sh){ tvRoom('teach1',600); patAddFig(); PAT.state='walk'; PAT.room='teach1'; tvStamp(sh); },
    frame:function(k,t,sh){ var c=tvCell('teach1',20,18), w0=tvWorld('teach1',44,18), w1=tvWorld('teach1',25,18);
      var u=tvEase(clamp((t-0.4)/(sh.dur-0.6),0,1)); PAT.x=tvLerp(w0.x,w1.x,u); PAT.y=w0.y; PAT.locked=t>1.2;
      GLR.patrolFlick=clamp(t/0.6,0,1); GLR.patrolRed=clamp((t-1.2)/0.4,0,1);
      var pz=tvCell('teach1',44,18); tvLook(c.x,1.55,c.z,tvLerp(pz.x,c.x+4.5,u),2.0+u*0.6,c.z);
      tvOp('tvstamp',tvEnv(t,1.3,sh.dur-0.15,0.2,0.2)); tvOp('tvblack',tvDip(t,sh.dur,0.1,0.1)); }},
  /* 柜子里：从门缝往外看，它从面前走过去 */
  locker:{setup:function(sh){ tvRoom('teach1',600); patAddFig(); PAT.state='walk'; PAT.room='teach1'; PAT.locked=true; $v('tvcap').textContent=sh.caption; },
    frame:function(k,t,sh){ var c=tvCell('teach1',30,16.2), o=tvCell('teach1',30,19.5), w0=tvWorld('teach1',23,18.6), w1=tvWorld('teach1',37,18.6);
      PAT.x=tvLerp(w0.x,w1.x,k); PAT.y=w0.y; GLR.patrolRed=0.85; GLR.patrolFlick=0.6;
      tvLook(c.x,1.5+Math.sin(t*1.1)*0.01,c.z,o.x,1.6,o.z);
      tvOp('tvslits',1); tvOp('tvcap',tvEnv(t,0.5,sh.dur-0.3,0.5,0.4)); tvOp('tvblack',tvDip(t,sh.dur,0.3,0.25)); }},

  /* ===== 规则与出路 ===== */
  rule:{setup:function(sh){ tvLines(sh.lines); },
    frame:function(k,t,sh){ tvOp('tvblack',1); tvOp('tvlines',1); tvLinesOp(function(i){ return tvEnv(t,0.3+i*1.0,sh.dur-0.2,0.5,0.3); }); }},
  /* 讲台上那张钥匙移交单 */
  slip:{setup:function(sh){ tvRoom('teach1',1070); tvClass(false); $v('tvcap').textContent=sh.caption; },
    frame:function(k,t,sh){ var pd=Investigation.podium()||[48,1], p=tvCell('teach1',pd[0],pd[1]), x=p.x+0.23, z=p.z+0.04;
      tvLook(x-0.15+k*0.12,tvLerp(1.75,1.35,tvEase(k)),z+tvLerp(1.1,0.55,tvEase(k)), x,0.98,z);
      tvOp('tvcap',tvEnv(t,0.5,sh.dur-0.3,0.5,0.4)); tvOp('tvblack',tvDip(t,sh.dur,0.35,0)); }},
  /* 《闸门》：车库里点火，车灯亮起来那一下光里站着它；冲出北门，黑影追出来 */
  car:{setup:function(sh){ tvRoom('garage1',1080); var w=tvWorld('garage1',40,8.2); S.x=w.x; S.y=w.y; S.ang=PI;
      TV.d.cd={}; CUT_DEF.car.setup(TV.d.cd); $v('tvcap').textContent=sh.caption; },
    frame:function(k,t,sh){ GLR.dayExpo=1; CUT_DEF.car.frame(0.03+k*0.8,TV.d.cd); cutFade(0);
      tvOp('tvcap',tvEnv(t,0.5,sh.dur-0.3,0.5,0.4)); tvOp('tvblack',tvDip(t,sh.dur,0.1,0.12)); }},
  /* 《白名单》：闸机的红灯变白；门里的人一个个站出来 */
  face:{setup:function(sh){ S.tsec=1080; TV.d.fd={}; CUT_DEF.face.setup(TV.d.fd); running=false; S.screen='cut'; $v('tvcap').textContent=sh.caption; },
    frame:function(k,t,sh){ CUT_DEF.face.frame(0.06+k*0.8,TV.d.fd); cutFade(0);
      tvOp('tvcap',tvEnv(t,0.5,sh.dur-0.3,0.5,0.4)); tvOp('tvblack',tvDip(t,sh.dur,0.1,0.12)); }},
  /* 《门》：物理实验室里撑开一个光圈（只推到光圈前面） */
  portal:{setup:function(sh){ tvRoom('lab1',1060); TV.d.pd={}; CUT_DEF.portal.setup(TV.d.pd); $v('tvcap').textContent=sh.caption; },
    frame:function(k,t,sh){ CUT_DEF.portal.frame(0.1+k*0.62,TV.d.pd); cutFade(0);
      tvOp('tvcap',tvEnv(t,0.5,sh.dur-0.3,0.5,0.4)); tvOp('tvblack',tvDip(t,sh.dur,0.1,0.15)); }},

  /* ===== 死法闪切：每种取最要命的那一截 ===== */
  deaths:{setup:function(sh){ TV.d.clip=-1; },
    frame:function(k,t,sh){
      var n=sh.clips.length, len=sh.dur/n, i=Math.min(n-1,Math.floor(t/len)), lt=t-i*len;
      if(i!==TV.d.clip){ TV.d.clip=i; tvDeath(sh.clips[i]); }
      tvOp('tvblack',lt<0.06||lt>len-0.06?1:0); }},
  title:{setup:function(sh){ tvLines(sh.lines,'big',sh.sub); },
    frame:function(k,t,sh){ tvOp('tvblack',1); tvOp('tvlines',1);
      tvLinesOp(function(i){ return i===0?tvEnv(t,0.5,sh.dur-0.4,1.6,0.8)*tvFlick(t,21):tvEnv(t,2.8,sh.dur-0.4,1.2,0.8); }); }},
  /* 尾声：回到第一天的座位，一切正常。耳边有人问了一句 */
  tag:{setup:function(sh){ tvRoom('teach1',600); tvClass(true); tvLines([],'',null,sh.lines[0]); },
    frame:function(k,t,sh){ camClass(0.1,t); tvOp('tvlines',1);
      tvLinesOp(function(){ return tvEnv(t,1.0,sh.dur-0.35,0.15,0.1)*0.9; });
      tvOp('tvblack',tvDip(t,sh.dur,0.5,0)+(t>sh.dur-0.35?1:0)); }}
};
function tvCard(text,seal){ $v('tvcard').querySelector('b').textContent=text; $v('tvcard').querySelector('i').textContent=seal; }
/* 每种死法放在它本来会发生的地方，从演出中段开始（接触 → 临终视角） */
var TV_DEATH={
  follow:{at:1.8,place:function(){ tvOut(1085); S.x=560*SC; S.y=820*SC; S.ang=PI/2; }},
  laugh:{at:1.4,place:function(){ tvRoom('teach1',1080); tvClass(false); var w=tvWorld('teach1',48,9); S.x=w.x; S.y=w.y; S.ang=-PI/2; }},
  floor:{at:0.55,place:function(){ tvOut(1085); S.x=560*SC; S.y=857*SC; S.ang=-PI/2; }},
  grip:{at:1.5,place:function(){ tvRoom('teach1',1080); var w=tvWorld('teach1',30,18.2); S.x=w.x; S.y=w.y; S.ang=0; }}
};
function tvDeath(type){
  var def=TV_DEATH[type]; try{ anfxClear(); }catch(e){}
  S.pitch=0; S.eyeLift=0; def.place();
  deathFX(type,{preview:true});
  ANFX.t=def.at; GLR.flash=0.3;
}

/* ---------- 入口 ---------- */
function trailerInit(sb){
  TV.sb=sb; TV.fps=sb.fps; var s=0;
  /* 镜头边界按帧号算（和 render.py 的四舍五入一致），不按秒比较，免得边界那一帧落到上一个镜头 */
  TV.startF=sb.shots.map(function(sh){ var a=Math.round(s*TV.fps); s+=sh.dur; return a; });
  TV.total=s;
  tvCss();
  PHOTO_TRIED=true; running=false; CUT.enabled=false;
  document.getElementById('menu').style.display='none';
  S.screen='cut'; S.dead=false; S.diff='normal'; S.san=100; PRO.on=false; PAUSE.on=false; AMB_ON=false;
  Settings.q(2);
  GLR.postMat.uniforms.uBright.value=1.22;          /* 整体提一点亮度，暗部还是黑的 */
  return Math.round(s*TV.fps);
}
function trailerShotAt(i){
  var n=TV.sb.shots.length, j=0;
  while(j<n-1&&i>=TV.startF[j+1]) j++;
  return j;
}
/* 并行渲染时每个进程的第一帧：先把场景搭好、画一遍（不推进时间），再开始截图 */
function trailerWarm(i){
  var j=trailerShotAt(i), sh=TV.sb.shots[j], lt=(i-TV.startF[j])/TV.fps;
  if(j!==TV.cur){ TV.cur=j; TV.d={}; tvSeed(j+1); tvReset(); TV_SHOT[sh.id].setup(sh); }
  S.screen='cut'; TV_SHOT[sh.id].frame(clamp(lt/sh.dur,0,1),lt,sh); render(0);
}
function trailerFrame(i){
  var j=trailerShotAt(i), sh=TV.sb.shots[j], lt=(i-TV.startF[j])/TV.fps;
  if(j!==TV.cur){ TV.cur=j; TV.d={}; tvSeed(j+1); tvReset(); TV_SHOT[sh.id].setup(sh); }
  S.screen='cut';
  TV_SHOT[sh.id].frame(clamp(lt/sh.dur,0,1),lt,sh);
  GLR.time=(GLR.time||0)+1/TV.fps;
  render(1/TV.fps);
  return sh.id;
}
