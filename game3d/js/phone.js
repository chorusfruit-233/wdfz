/* 里世界 3D · 手机：只剩一个「纸飞机」小游戏
   点一下（空格 / W / ↑ / 点屏幕）往上飘，穿过书架之间的空隙，撞上就结束。
   和机房的电脑不同，玩手机时世界不停：时间照走、违规照算，你只是站着不动、低着头。
   一有异象或者巡察者盯上你，屏幕就黑了。一局结束按得分回一点 SAN（最多 +6），之后手机发烫，
   要过一阵（45 秒）才能再回 SAN。 */
'use strict';

var PHONE={on:false,st:'ready',y:0,vy:0,pipes:[],score:0,t:0,cool:0,gain:0,msg:''};
var PH_W=200, PH_H=340, PH_GAP=112, PH_SPD=92, PH_G=620, PH_FLAP=-215, PH_COOL=45, PH_MAXGAIN=6;

function phoneEl(){
  var el=document.getElementById('phone');
  if(el) return el;
  el=document.createElement('div'); el.id='phone';
  el.innerHTML='<div class="phbody"><div class="phtop">纸飞机</div><canvas id="phcv" width="'+PH_W+'" height="'+PH_H+'"></canvas>'+
    '<div class="phhint" id="phhint"></div></div><button type="button" class="phx" aria-label="收起手机">✕ 收起</button>';
  document.body.appendChild(el);
  var cv=el.querySelector('canvas');
  cv.addEventListener('pointerdown',function(e){ e.preventDefault(); PHONE.flap(); });
  el.querySelector('.phx').addEventListener('click',function(e){ e.stopPropagation(); PHONE.stop(); });
  return el;
}
PHONE.start=function(){
  if(PHONE.on) return;
  if(typeof AN!=='undefined'&&AN.active){ os('我：现在不是看手机的时候。',2.2); return; }
  if(typeof PAT!=='undefined'&&PAT.locked){ os('我：它在看着我。我不敢低头。',2.2); return; }
  PHONE.on=true; PHONE.reset();
  if(UI.openPanel==='bag') UI.close('bag',false);
  resetInputState(); releaseMouseLook();
  var el=phoneEl(); el.style.display='flex';
  document.getElementById('phhint').textContent=(IS_TOUCH?'点屏幕往上飘':'空格 / W 往上飘')+' · '+(IS_TOUCH?'右上角收起':'Esc 收起');
  try{ SFX.click(); }catch(e){}
  PHONE.draw();
  updateTouchUI();
};
PHONE.reset=function(){
  PHONE.st='ready'; PHONE.y=PH_H*0.45; PHONE.vy=0; PHONE.pipes=[]; PHONE.score=0; PHONE.t=0; PHONE.msg='';
};
/* 收起手机；dark=true 是被打断（屏幕一下子黑了） */
PHONE.stop=function(dark){
  if(!PHONE.on) return;
  PHONE.on=false;
  var el=document.getElementById('phone'); if(el) el.style.display='none';
  /* 不覆盖异象或巡察者刚显示的重要字幕。 */
  if(dark&&!DLG.open) os('我：屏幕一下子黑了。我抬起头。',2.6);
  resetInputState(); resumeMouseLook(); updateTouchUI();
};
PHONE.checkInterrupt=function(){
  if(!PHONE.on) return;
  var danger=AN.active||PAT.locked;
  if(S.dead||S.screen!=='play'||danger||PAUSE.on||UI.anyOpen()||PC.on)
    PHONE.stop(danger&&!S.dead&&S.screen==='play');
};
PHONE.flap=function(){
  if(!PHONE.on) return;
  if(PHONE.st==='over'){ PHONE.reset(); PHONE.draw(); return; }
  if(PHONE.st==='ready') PHONE.st='fly';
  PHONE.vy=PH_FLAP;
  try{ SFX.blink(); }catch(e){}
};
PHONE.end=function(){
  PHONE.st='over';
  var g=0;
  if(PHONE.cool<=0&&PHONE.score>0){
    g=Math.min(PH_MAXGAIN,PHONE.score);
    S.san=Math.min(100,S.san+g); PHONE.cool=PH_COOL;
    toast('纸飞机 · 得分 '+PHONE.score+' · SAN +'+g);
  }
  PHONE.gain=g;
  PHONE.msg=g?'SAN +'+g:(PHONE.score>0?'手机发烫了，静不下心':'');
  try{ SFX.click(); }catch(e){}
};
/* 每帧（只在游戏进行时，世界照常更新） */
PHONE.tick=function(dt){
  if(PHONE.cool>0) PHONE.cool=Math.max(0,PHONE.cool-dt);
  if(!PHONE.on) return;
  if(S.dead||S.screen!=='play'||(typeof AN!=='undefined'&&AN.active)||(typeof PAT!=='undefined'&&PAT.locked)){ PHONE.stop(!S.dead); return; }
  if(PHONE.st==='fly'){
    PHONE.vy+=PH_G*dt; PHONE.y+=PHONE.vy*dt; PHONE.t+=dt;
    if(!PHONE.pipes.length||PHONE.pipes[PHONE.pipes.length-1].x<PH_W-120)
      PHONE.pipes.push({x:PH_W+20,gy:70+Math.random()*(PH_H-140-PH_GAP),pass:false});
    for(var i=0;i<PHONE.pipes.length;i++){
      var p=PHONE.pipes[i]; p.x-=PH_SPD*dt;
      if(!p.pass&&p.x+26<40){ p.pass=true; PHONE.score++; }
      if(p.x<52&&p.x+26>28&&(PHONE.y-7<p.gy||PHONE.y+7>p.gy+PH_GAP)){ PHONE.end(); break; }
    }
    if(PHONE.pipes.length&&PHONE.pipes[0].x<-30) PHONE.pipes.shift();
    if(PHONE.st==='fly'&&(PHONE.y>PH_H-8||PHONE.y<6)) PHONE.end();
  }
  PHONE.draw();
};
PHONE.draw=function(){
  var cv=document.getElementById('phcv'); if(!cv) return;
  var c=cv.getContext('2d'); if(!c) return;
  c.fillStyle='#0b1a24'; c.fillRect(0,0,PH_W,PH_H);
  c.fillStyle='rgba(140,190,210,.08)';
  for(var k=0;k<12;k++) c.fillRect((k*37-PHONE.t*20)%(PH_W+40)-20,40+((k*53)%250),2,2);   /* 远处的星点 */
  for(var i=0;i<PHONE.pipes.length;i++){                                                 /* 书架 */
    var p=PHONE.pipes[i];
    c.fillStyle='#4a3a2a'; c.fillRect(p.x,0,26,p.gy); c.fillRect(p.x,p.gy+PH_GAP,26,PH_H-p.gy-PH_GAP);
    c.fillStyle='#7a5f40';
    for(var y=8;y<p.gy;y+=16) c.fillRect(p.x+2,y,22,3);
    for(y=p.gy+PH_GAP+8;y<PH_H;y+=16) c.fillRect(p.x+2,y,22,3);
  }
  var a=Math.max(-0.5,Math.min(0.9,PHONE.vy/400));                                         /* 纸飞机 */
  c.save(); c.translate(40,PHONE.y); c.rotate(a);
  c.fillStyle='#e8eef0'; c.beginPath(); c.moveTo(12,0); c.lineTo(-10,-7); c.lineTo(-5,0); c.lineTo(-10,7); c.closePath(); c.fill();
  c.restore();
  c.fillStyle='#dfeff2'; c.font='bold 22px sans-serif'; c.textAlign='center';
  c.fillText(String(PHONE.score),PH_W/2,36);
  if(PHONE.st!=='fly'){
    c.fillStyle='rgba(0,0,0,.55)'; c.fillRect(0,PH_H/2-44,PH_W,88);
    c.fillStyle='#e8f4ec'; c.font='14px sans-serif';
    c.fillText(PHONE.st==='ready'?'点一下开始':'结束 · 得分 '+PHONE.score,PH_W/2,PH_H/2-10);
    c.font='11px sans-serif'; c.fillStyle='#9fe3c2';
    c.fillText(PHONE.st==='over'?(PHONE.msg||'再点一下重来'):(PHONE.cool>0?'手机还烫着：这局不回 SAN':'一局最多回 6 点 SAN'),PH_W/2,PH_H/2+16);
  }
};
