/* @module-capsule */
(function($imports){
/* 只读 HUD、地图与界面节点缓存。 */
'use strict';
var miniT=0;

function drawMini(dt){
  miniT-=dt;
  if(miniT>0) return;
  miniT=0.18;
  var cv=document.getElementById('mini');
  if(!cv||!cv.getContext) return;
  var c=cv.getContext('2d'); if(!c||!c.clearRect) return;
  var W=cv.width, H=cv.height;
  var bw=$imports.BOUND.x1-$imports.BOUND.x0, bh=$imports.BOUND.y1-$imports.BOUND.y0;
  var sc=Math.min((W-8)/bw,(H-8)/bh);
  var ox=4+(W-8-bw*sc)/2, oy=4+(H-8-bh*sc)/2;
  function X(v){ return ox+(v-$imports.BOUND.x0)*sc; }
  function Y(v){ return oy+(v-$imports.BOUND.y0)*sc; }
  c.clearRect(0,0,W,H);
  c.strokeStyle='rgba(120,180,150,.32)'; c.lineWidth=1;
  c.strokeRect(X($imports.BOUND.x0),Y($imports.BOUND.y0),bw*sc,bh*sc);
  c.fillStyle='rgba(170,180,170,.22)';
  for(var ri=0;ri<$imports.ROADS.length;ri++){ var rd=$imports.ROADS[ri]; c.fillRect(X(rd[0]),Y(rd[1]),(rd[2]-rd[0])*sc,(rd[3]-rd[1])*sc); }
  for(var i=0;i<$imports.OBJ.length;i++){
    var o=$imports.OBJ[i];
    if(o.k==='roof') c.fillStyle='rgba(190,125,116,.55)';
    else if(o.k==='link') c.fillStyle='rgba(139,58,46,.55)';
    else if(o.k==='field'||o.k==='court'||o.k==='track') c.fillStyle='rgba(90,140,90,.32)';
    else c.fillStyle='rgba(110,140,110,.24)';
    c.fillRect(X(o.x),Y(o.y),o.w*sc,o.h*sc);
  }
  if(GameModules.first('mapBlocked')){                         /* 地图在这里不能用：只剩一片乱线 */
    c.clearRect(0,0,W,H); c.fillStyle='rgba(160,170,165,.35)'; c.font='12px monospace'; c.textAlign='center';
    c.fillText('? ? ?',W/2,H/2+4); return;
  }
  var px=X($imports.S.x/$imports.SC), py=Y($imports.S.y/$imports.SC);
  /* 室内坐标不是室外地图上的位置（在车库里点会落到行政楼上）：室内就标在所在那栋楼上 */
  var R=$imports.S.mode==='in'?$imports.INTERIORS[$imports.S.room]:null, ho=R?(0,$imports.objById)(R.host):null;
  if(ho){ px=X(ho.x+ho.w/2); py=Y(ho.y+ho.h/2); }
  c.fillStyle='#79c8a4';
  c.beginPath(); c.arc(px,py,2.6,0,6.283); c.fill();
  c.strokeStyle='rgba(121,200,164,.85)'; c.lineWidth=1.4;
  c.beginPath(); c.moveTo(px,py);
  c.lineTo(px+Math.cos($imports.S.ang)*9,py+Math.sin($imports.S.ang)*9); c.stroke();
}

var hudT=0;

var markT=0;

var HUD_EL={};

function hudEl(id){
  var e=HUD_EL[id];
  if(!e||!e.isConnected) e=HUD_EL[id]=document.getElementById(id);
  return e;
}

function updateHUD(){
  $imports.CampusPressure.paint();
  var feel=hudEl('sanfeel'),stage=(0,$imports.sanityStage)();
  if(feel&&feel.dataset.stage!==String(stage)){feel.dataset.stage=stage;feel.textContent=$imports.SAN_FEEL[stage];}
  /* 界面也跟着身体状态变（状态条的红线跳得越来越急）；样式里关掉镜头晃动时不动 */
  if(document.body.dataset.san!==String(stage))document.body.dataset.san=stage;
  var _ct=GameModules.first('clockText');                     /* 模块可以接管时间显示（虚空迷宫里是「???」） */
  hudEl('clock').textContent=_ct!==undefined?String(_ct):((0,$imports.hasClock)()?(0,$imports.fmtClock)($imports.S.tsec):'时间不明');
  var sc=hudEl('secclock');
  if(sc){sc.hidden=true;sc.textContent='';}
  var cr=hudEl('cross');
  if(cr){ cr.style.display=(0,$imports.playerInputAllowed)()?'block':'none'; }
  try{ (0,$imports.anwTick)($imports.dtG); }catch(e){}
  try{ (0,$imports.updateMarker)($imports.dtG); }catch(e){}
  var _tag=$imports.DayEvents.tag(), _pl=(0,$imports.currentPlaceName)()+(_tag?' · '+_tag:'');
  if(hudEl('place').textContent!==_pl) hudEl('place').textContent=_pl;
  var p=(0,$imports.periodAt)($imports.S.tsec), pe=hudEl('period'), leave=(0,$imports.onLeave)(), examing=$imports.S.exam&&p[3]==='教室';
  var outing=$imports.SchoolDay.excused();
  pe.textContent=leave?('请假中 · 还剩 '+(0,$imports.leaveLeft)()+' 分钟'):(examing?('考试 · '+p[2]):
    outing?('外出登记 · '+$imports.SchoolDay.returnLabel()):(p[2]+' · '+(p[3]==='教室'||p[3]==='操场'?'可探索，留意巡察':(0,$imports.needWhere)($imports.S.tsec))));
  if($imports.CarChase.active())pe.textContent='驾驶逃脱';
  if(typeof $imports.Inspection!=='undefined'&&$imports.Inspection.active())pe.textContent='学生会检查 · 教室';
  else if(typeof $imports.Inspection!=='undefined'&&$imports.Inspection.upcoming())pe.textContent='集合将至 · 请回教室';
  if($imports.PAT.permanent)pe.textContent+=' · 持续追踪';
  var frozen=(0,$imports.roomClockFrozen)();
  if(frozen)pe.textContent='???';                             /* 时钟冻结的地方（虚空迷宫）：课表也没有意义 */
  /* 绿 = 普通活动；黄 = 返程或违反要求；蓝 = 登记 / 请假；红 = 考试。 */
  var pc=frozen?'ok':$imports.Inspection.upcoming()?'warn':(leave||outing?'leave':($imports.S.wrong?'warn':(examing?'exam':'ok')));
  if(pe.className!==pc) pe.className=pc;
  if(hudEl('stamwrap')){
    var snack=($imports.S.snackT||0)>0;                                  /* 士力架起效时，体力条变成金色的剩余时间 */
    var sr=hudEl('stamrow'), show=($imports.S.stam<99.5||snack);
    if(sr&&sr.hidden===show) sr.hidden=!show;
    var sb=hudEl('stambar');
    sb.style.width=(snack?(0,$imports.clamp)($imports.S.snackT/$imports.SNACK_SEC*100,0,100):(0,$imports.clamp)($imports.S.stam,0,100))+'%';
    sb.style.background=snack?'#d8b45a':($imports.S.tired?'#b0705a':'');   /* 喘气时变红，回到能跑才变回蓝 */
  }
  $imports.LESSON.paintButton();
  $imports.UI.renderHot();
  (0,$imports.updateTouchUI)();
  /* 字幕显示时也要给提示：字幕很频繁，以前站在门口常常看不到"E 开门" */
  var label=(0,$imports.interactHint)(), pr=hudEl('prompt');
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
  if(tt){ var tc='tsm'+($imports.USE.torch?' on':'')+((0,$imports.hasItem)('torch')?'':' off'); if(tt.className!==tc) tt.className=tc; }
}
/* @module-exports */
GameModules.publish("game3d/js/ui/hud.js",{
"miniT":{get:function(){return miniT;},set:function($value){miniT=$value;}},
"drawMini":{get:function(){return drawMini;},set:function($value){drawMini=$value;}},
"hudT":{get:function(){return hudT;},set:function($value){hudT=$value;}},
"markT":{get:function(){return markT;},set:function($value){markT=$value;}},
"HUD_EL":{get:function(){return HUD_EL;},set:function($value){HUD_EL=$value;}},
"hudEl":{get:function(){return hudEl;},set:function($value){hudEl=$value;}},
"updateHUD":{get:function(){return updateHUD;},set:function($value){updateHUD=$value;}}
});
})(GameModules.imports("game3d/js/ui/hud.js"));
