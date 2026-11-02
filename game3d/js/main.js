/* 里世界 3D · 主循环、HUD、开始 / 继续 / 退出、启动 */
'use strict';

function onEnterRoom(id,restoring){
  ExplorationMap.observe();
  Playtest.event(restoring?'读档进入':'进入地点',id);
  if(id==='garage1') os('我：车库里没有灯。空气是潮的，有一股铁和机油的味道。远处有水在滴。',3.6);
  if(id==='portal_tunnel') os('我：不想靠近。墙上的黑色黏液还在缓慢流动。',4.5,OS_FORCE);
  try{ Dread.enter(id,restoring); }catch(e){}
  spotTick();
}

var lastT=0, accum=0, running=false;
function frame(t){
  requestAnimationFrame(frame);
  if(!running) { lastT=t; return; }
  var dt=(t-lastT)/1000; lastT=t;
  dtG=dt;
  Playtest.frame(dt);
  QualityWatch.tick(dtG,GamePolicy.simulationAllowed(gameInputContext())&&!document.hidden);
  /* 允许一秒内的慢帧按真实时间补齐固定步；更长的卡顿仍有上限，避免恢复时跑出大量积压。 */
  accum+=Math.min(dt,1);
  var step=1/60, guard=0;
  while(accum>=step&&guard++<60){
    try{ update(step);LESSON.fastForward(step); }catch(e){ try{ showErr('update: '+e.message); }catch(_e){} break; }
    accum-=step;
  }
  try{ render(Math.min(dt,0.25)); }catch(e){ try{ showErr('render: '+e.message); }catch(_e){} }
}
function update(dt){
  /* 电脑小游戏与开局倒计时原本在世界暂停时也运行；移入应用步进，保留该策略。 */
  PCGAME.tick(dt);
  updateIntro(dt);
  PHONE.checkInterrupt();
  LESSON.checkInterrupt();
  Speedrun.tick();                       /* 速通：第一次能操作时起表（自带判定：在玩、没死、能操作、不在过场） */
  var policy=gameInputContext();
  if(!GamePolicy.presentationAllowed(policy)) return;
  VisualState.time+=dt;
  updateDialog(dt);
  if(S.dead){
    S.deadT+=dt;
    try{ syncCamera(dt); }catch(e){}
    return;
  }
  if(!GamePolicy.simulationAllowed(policy)) return;
  repairPlayerPlacement(dt);
  Playtest.simulation(dt);
  if(CarChase.active()){clockTick(dt);CarChase.tick(dt);return;}
  updatePlayer(dt);                              /* 手机屏蔽移动输入，体力和计时仍正常更新 */
  ExplorationMap.tick(dt);
  if(Elevator.inRide()){
    if(S.room!=='lift_dream')clockTick(dt);
    Elevator.tick(dt);settleSan();return;
  }
  Elevator.tick(dt);
  try{ PHONE.tick(dt); }catch(e){}
  try{ searchTick(dt); }catch(e){}
  updateSystems(dt);
  anDrive(dt);
  settleSan();
  LESSON.tick(dt);
  PHONE.checkInterrupt();                         /* 世界更新中可能死亡、开始异象或打开选择 */
  try{ monoTick(dt); }catch(e){}
  try{ Dread.tick(dt); }catch(e){}
  try{ Talent.tickWatch(); }catch(e){}            /* 守时（规则 2）：开饭、饭点结束、熄灯前看一眼表 */
  try{ DayEvents.tick(); }catch(e){}              /* 特殊校园日：当天定一次、早上广播、校庆横幅 */
  spotTick();
  CampusPressure.tick();
  anNotifyWarning(anwVisible());
}
function render(dt){
  try{ if(DEV.on){DEV.refreshT-=dt;if(DEV.refreshT<=0){DEV.refreshT=.3;Dev.refresh();}} }catch(e){}
  try{ if(AMB_ON&&S.screen==='play'){ if(!SFX._ambOn){ SFX.ambient(); SFX._ambOn=true; } } else if(!AMB_ON&&SFX._ambOn){ SFX.stopAmbient(); SFX._ambOn=false; } }catch(e){}
  try{ SFX.tick(dt); }catch(e){}
  if(CarChase.active()&&S.screen==='play')CarChase.draw();
  try{ PortalDevice.tick(dt); }catch(e){}          /* 物理实验室演示台上的传送门：按剧情状态摆、每帧动 */
  try{ LiftDoors.tick(dt); }catch(e){}             /* 电梯层门：电梯到这一层时滑开 */
  Engine.draw(dt); updateHUD(); drawMini(dt);
  try{ Speedrun.paintHud(); }catch(e){}
}
function updateIntro(dt){
  if(!(S.intro>0)) return;
  S.intro-=dt;
  var b=document.getElementById('banner');
  if(!b) return;
  if(S.intro>0){
    b.textContent=String(Math.ceil(S.intro));
    b.style.opacity='1';
    b.style.fontSize='64px';
  }else{
    b.textContent='';
    b.style.opacity='0';
    b.style.fontSize='';
  }
}

var miniT=0;
function drawMini(dt){
  miniT-=dt;
  if(miniT>0) return;
  miniT=0.18;
  var cv=document.getElementById('mini');
  if(!cv||!cv.getContext) return;
  var c=cv.getContext('2d'); if(!c||!c.clearRect) return;
  var W=cv.width, H=cv.height;
  var bw=BOUND.x1-BOUND.x0, bh=BOUND.y1-BOUND.y0;
  var sc=Math.min((W-8)/bw,(H-8)/bh);
  var ox=4+(W-8-bw*sc)/2, oy=4+(H-8-bh*sc)/2;
  function X(v){ return ox+(v-BOUND.x0)*sc; }
  function Y(v){ return oy+(v-BOUND.y0)*sc; }
  c.clearRect(0,0,W,H);
  c.strokeStyle='rgba(120,180,150,.32)'; c.lineWidth=1;
  c.strokeRect(X(BOUND.x0),Y(BOUND.y0),bw*sc,bh*sc);
  c.fillStyle='rgba(170,180,170,.22)';
  for(var ri=0;ri<ROADS.length;ri++){ var rd=ROADS[ri]; c.fillRect(X(rd[0]),Y(rd[1]),(rd[2]-rd[0])*sc,(rd[3]-rd[1])*sc); }
  for(var i=0;i<OBJ.length;i++){
    var o=OBJ[i];
    if(o.k==='roof') c.fillStyle='rgba(190,125,116,.55)';
    else if(o.k==='link') c.fillStyle='rgba(139,58,46,.55)';
    else if(o.k==='field'||o.k==='court'||o.k==='track') c.fillStyle='rgba(90,140,90,.32)';
    else c.fillStyle='rgba(110,140,110,.24)';
    c.fillRect(X(o.x),Y(o.y),o.w*sc,o.h*sc);
  }
  var px=X(S.x/SC), py=Y(S.y/SC);
  /* 室内坐标不是室外地图上的位置（在车库里点会落到行政楼上）：室内就标在所在那栋楼上 */
  var R=S.mode==='in'?INTERIORS[S.room]:null, ho=R?objById(R.host):null;
  if(ho){ px=X(ho.x+ho.w/2); py=Y(ho.y+ho.h/2); }
  c.fillStyle='#79c8a4';
  c.beginPath(); c.arc(px,py,2.6,0,6.283); c.fill();
  c.strokeStyle='rgba(121,200,164,.85)'; c.lineWidth=1.4;
  c.beginPath(); c.moveTo(px,py);
  c.lineTo(px+Math.cos(S.ang)*9,py+Math.sin(S.ang)*9); c.stroke();
}
var hudT=0;

var markT=0, dtG=0.016;
/* 界面节点每帧都要用：取一次存起来（节点被换掉时重新取） */
var HUD_EL={};
function hudEl(id){
  var e=HUD_EL[id];
  if(!e||!e.isConnected) e=HUD_EL[id]=document.getElementById(id);
  return e;
}
function updateHUD(){
  CampusPressure.paint();
  var feel=hudEl('sanfeel'),stage=sanityStage();
  if(feel&&feel.dataset.stage!==String(stage)){feel.dataset.stage=stage;feel.textContent=SAN_FEEL[stage];}
  /* 界面也跟着身体状态变（状态条的红线跳得越来越急）；样式里关掉镜头晃动时不动 */
  if(document.body.dataset.san!==String(stage))document.body.dataset.san=stage;
  hudEl('clock').textContent=hasClock()?fmtClock(S.tsec):'时间不明';
  var sc=hudEl('secclock');
  if(sc){sc.hidden=true;sc.textContent='';}
  var cr=hudEl('cross');
  if(cr){ cr.style.display=playerInputAllowed()?'block':'none'; }
  try{ anwTick(dtG); }catch(e){}
  try{ updateMarker(dtG); }catch(e){}
  var _tag=DayEvents.tag(), _pl=currentPlaceName()+(_tag?' · '+_tag:'');
  if(hudEl('place').textContent!==_pl) hudEl('place').textContent=_pl;
  var p=periodAt(S.tsec), pe=hudEl('period'), leave=onLeave(), examing=S.exam&&p[3]==='教室';
  var outing=SchoolDay.excused();
  pe.textContent=leave?('请假中 · 还剩 '+leaveLeft()+' 分钟'):(examing?('考试 · '+p[2]):
    outing?('外出登记 · '+SchoolDay.returnLabel()):(p[2]+' · '+(p[3]==='教室'||p[3]==='操场'?'可探索，留意巡察':needWhere(S.tsec))));
  if(CarChase.active())pe.textContent='驾驶逃脱';
  if(typeof Inspection!=='undefined'&&Inspection.active())pe.textContent='学生会检查 · 教室';
  else if(typeof Inspection!=='undefined'&&Inspection.upcoming())pe.textContent='集合将至 · 请回教室';
  /* 绿 = 普通活动；黄 = 返程或违反要求；蓝 = 登记 / 请假；红 = 考试。 */
  var pc=Inspection.upcoming()?'warn':(leave||outing?'leave':(S.wrong?'warn':(examing?'exam':'ok')));
  if(pe.className!==pc) pe.className=pc;
  if(hudEl('stamwrap')){
    var snack=(S.snackT||0)>0;                                  /* 士力架起效时，体力条变成金色的剩余时间 */
    var sr=hudEl('stamrow'), show=(S.stam<99.5||snack);
    if(sr&&sr.hidden===show) sr.hidden=!show;
    var sb=hudEl('stambar');
    sb.style.width=(snack?clamp(S.snackT/SNACK_SEC*100,0,100):clamp(S.stam,0,100))+'%';
    sb.style.background=snack?'#d8b45a':(S.tired?'#b0705a':'');   /* 喘气时变红，回到能跑才变回蓝 */
  }
  LESSON.paintButton();
  UI.renderHot();
  updateTouchUI();
  /* 字幕显示时也要给提示：字幕很频繁，以前站在门口常常看不到"E 开门" */
  var label=interactHint(), pr=hudEl('prompt');
  if(pr){
    if(label){ if(pr._l!==label){ pr._l=label; pr.innerHTML='<kbd>E</kbd>'+label; } pr.style.display='block'; }
    else { pr._l=''; pr.style.display='none'; }
  }
  /* 触屏：交互键上直接写当前能做的事（「坐下」「开门」…），没有可做的事就变暗 */
  var ta=hudEl('tActL');
  if(ta){
    var short=label.replace(/（.*$/,'').replace(/^进入 /,'进 ')||'交互';
    if(ta.textContent!==short){ ta.textContent=short; ta.parentNode.className='tbtn'+(label?' live':'')+(short.length>4?' long':''); }
  }
  var tt=hudEl('tTorch');
  if(tt){ var tc='tsm'+(USE.torch?' on':'')+(hasItem('torch')?'':' off'); if(tt.className!==tc) tt.className=tc; }
}

var MENU_PHOTO=null, PHOTO_TRIED=false;
function captureMenuPhoto(){
  if(PHOTO_TRIED) return;
  if(!Assets.anyReady())return;
  if(S.screen!=='menu'){ PHOTO_TRIED=true; return; }
  PHOTO_TRIED=true;
  try{
    if(!Engine.ready()) return;
    var cv=document.getElementById('cv'), menu=document.getElementById('menu');
    if(!cv||!menu||!cv.toDataURL) return;
    var saveT=S.tsec;
    S.tsec=1338;                                  /* 22:18 —— 菜单那张照片是夜里拍的 */
    enterWorldOut();
    var url=Engine.captureMenu();
    if(url&&url.length>20000){
      MENU_PHOTO=url;
      menu.style.backgroundImage='radial-gradient(ellipse at 72% 42%,rgba(10,18,22,.34),rgba(3,6,9,.92) 62%),url('+url+')';
      menu.style.backgroundSize='cover';
      menu.style.backgroundPosition='center 58%';
      menu.style.backgroundColor='#04070a';
    }
    S.tsec=saveT;
    clearWorldMesh();                             /* 菜单里不留实时场景 */
    S.mode='in'; S.room=null;
  }catch(e){}
}

var ERR_SHOWN=false;
function showErr(msg){
  if(ERR_SHOWN) return;
  ERR_SHOWN=true;
  try{
    var el=document.getElementById('errbox');
    if(!el){
      el=document.createElement('div'); el.id='errbox';
      el.style.cssText='position:fixed;left:0;right:0;top:0;z-index:99999;background:#3a0d0d;color:#ffd9d0;'+
        'font:12px/1.7 Consolas,monospace;padding:10px 14px;white-space:pre-wrap;max-height:46%;overflow:auto;'+
        'border-bottom:2px solid #a33;';
      document.body.appendChild(el);
    }
    el.textContent='【运行错误】'+msg+'\n（把这一行发给开发者）';
  }catch(e){}
}
try{
  window.addEventListener('error',function(e){
    showErr((e.message||'unknown')+'  @'+(e.filename||'')+':'+(e.lineno||0));
  });
  window.addEventListener('unhandledrejection',function(e){
    var r=e&&e.reason, msg=String((r&&r.message)||r||'unknown');
    /* 这些是浏览器策略问题，不是游戏出错 */
    if(/pointer lock|fullscreen|user gesture|NotAllowedError|SecurityError|AudioContext|play\(\)/i.test(msg)) return;
    showErr('Promise: '+msg);
  });
}catch(e){}

function boot(){
  loadSet();
  try{ if(IS_TOUCH&&document.body&&document.body.classList) document.body.classList.add('touch'); }catch(e){}
  try{ initMobileShell(); }catch(e){}
  try{ if((location.search||'').indexOf('dev')>=0) Lifecycle.scope('session').timeout(function(){ try{ Dev.open(); }catch(e){} }, 500); }catch(e){}
  try{
    if((location.search||'').indexOf('nocss')>=0){
      ['vig','scan','fade','flash'].forEach(function(id){
        var e=document.getElementById(id); if(e) e.style.display='none';
      });
    }
  }catch(e){}
  buildInteriorData();
  buildRoomBounds();
  initGL();
  applyBrightness();
  try{ shadeApplyQuality(); }catch(e){}
  initInput();
  try{ initPcTouch(); }catch(e){}
  paintMenuSave();
  requestAnimationFrame(frame);
  Lifecycle.scope('session').timeout(captureMenuPhoto,420); /* 先让菜单画出来，再拍那张照片 */
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot);
else boot();
