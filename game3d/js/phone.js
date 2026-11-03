/* @module-capsule */
(function($imports){
/* 手机应用外壳与纸飞机；设备能源、联网和后台任务由 PhoneNetwork 持有。 */
'use strict';

var PHONE={on:false,st:'ready',y:0,vy:0,pipes:[],score:0,t:0,cool:0,gain:0,msg:''};
var PH_W=200, PH_H=340, PH_GAP=112, PH_SPD=92, PH_G=620, PH_FLAP=-215, PH_COOL=45, PH_MAXGAIN=6;

function phoneEl(){
  var el=document.getElementById('phone');
  if(el) return el;
  el=document.createElement('div'); el.id='phone';
  el.innerHTML='<div class="phbody"><div class="phtop">校园手机</div><div id="phstatus"></div><nav id="phapps"></nav><div id="phtool"></div><canvas id="phcv" width="'+PH_W+'" height="'+PH_H+'"></canvas>'+
    '<div class="phhint" id="phhint"></div></div><button type="button" class="phx" aria-label="收起手机">✕ 收起</button>';
  document.body.appendChild(el);
  var apps=[['home','主页'],['wireless','无线接入'],['location','巡察查询'],['sync','门禁同步'],['container','容器状态'],['plane','纸飞机']];
  apps.forEach(function(a){var b=document.createElement('button');b.type='button';b.textContent=a[1];b.dataset.app=a[0];b.onclick=function(){PHONE.selectApp(a[0]);};el.querySelector('#phapps').appendChild(b);});
  var cv=el.querySelector('canvas');
  cv.addEventListener('pointerdown',function(e){ e.preventDefault(); PHONE.flap(); });
  el.querySelector('.phx').addEventListener('click',function(e){ e.stopPropagation(); PHONE.stop(); });
  return el;
}
PHONE.start=function(){
  if(PHONE.on) return;
  if(!$imports.PhoneNetwork.available()){(0,$imports.toast)((0,$imports.hasItem)('phone')?'手机已断电 · 充到 5% 后自动开机':'没有手机');return;}
  PHONE.on=true; PHONE.reset();document.body.classList.add('phone-open');
  if($imports.UI.openPanel==='bag') $imports.UI.close('bag',false);
  (0,$imports.resetInputState)(); (0,$imports.releaseMouseLook)();
  var el=phoneEl(); el.style.display='flex';
  document.getElementById('phhint').textContent=($imports.IS_TOUCH?'点屏幕往上飘':'空格 / W 往上飘')+' · '+($imports.IS_TOUCH?'右上角收起':'Esc 收起');
  try{ $imports.SFX.click(); }catch(e){}
  PHONE.selectApp($imports.PhoneNetwork.page);
  (0,$imports.updateTouchUI)();
};
PHONE.reset=function(){
  PHONE.st='ready'; PHONE.y=PH_H*0.45; PHONE.vy=0; PHONE.pipes=[]; PHONE.score=0; PHONE.t=0; PHONE.msg='';
};
/* 收起手机；dark=true 是被打断（屏幕一下子黑了） */
PHONE.stop=function(dark){
  if(!PHONE.on) return;
  PHONE.on=false;document.body.classList.remove('phone-open');
  var el=document.getElementById('phone'); if(el) el.style.display='none';
  /* 不覆盖异象或巡察者刚显示的重要字幕。 */
  if(dark&&!$imports.DLG.open) (0,$imports.os)('我：屏幕一下子黑了。我抬起头。',2.6);
  (0,$imports.resetInputState)(); (0,$imports.resumeMouseLook)(); (0,$imports.updateTouchUI)();
};
PHONE.checkInterrupt=function(){
  if(!PHONE.on) return;
  var danger=$imports.PhoneNetwork.page==='plane'&&($imports.AN.active||$imports.PatrolWorld.localChase());
  if($imports.S.dead||$imports.S.screen!=='play'||danger||$imports.PAUSE.on||$imports.UI.anyOpen()||$imports.PC.on||$imports.Inspection.active()||!$imports.PhoneNetwork.available())
    PHONE.stop(danger&&!$imports.S.dead&&$imports.S.screen==='play');
};
PHONE.flap=function(){
  if($imports.PhoneNetwork.page!=='plane')return;
  if(!PHONE.on) return;
  if(PHONE.st==='over'){ PHONE.reset(); PHONE.draw(); return; }
  if(PHONE.st==='ready') PHONE.st='fly';
  PHONE.vy=PH_FLAP;
  try{ $imports.SFX.blink(); }catch(e){}
};
PHONE.end=function(){
  PHONE.st='over';
  var g=0,before=$imports.S.san,hot=PHONE.cool>0;
  if(PHONE.cool<=0&&PHONE.score>0){
    g=$imports.CampusPressure.restGain(Math.min(PH_MAXGAIN,PHONE.score));
    $imports.PlayerStats.changeSan(g,'phone',{max:100}); PHONE.cool=PH_COOL;
    (0,$imports.toast)('纸飞机 · 得分 '+PHONE.score);
  }
  PHONE.gain=g;
  PHONE.msg=$imports.S.san>before?'手指放松下来，远处声音又清楚了':(hot&&PHONE.score>0?'手机发烫了，静不下心':PHONE.score>0?'这一局结束了。':'');
  try{ $imports.SFX.click(); }catch(e){}
};
/* 每帧（只在游戏进行时，世界照常更新） */
PHONE.tick=function(dt){
  if(PHONE.cool>0) PHONE.cool=Math.max(0,PHONE.cool-dt);
  if(!PHONE.on) return;
  PHONE.checkInterrupt();if(!PHONE.on)return;
  if($imports.PhoneNetwork.page!=='plane'){PHONE.paintApps();return;}
  if(PHONE.st==='fly'){
    PHONE.vy+=PH_G*dt; PHONE.y+=PHONE.vy*dt; PHONE.t+=dt;
    if(!PHONE.pipes.length||PHONE.pipes[PHONE.pipes.length-1].x<PH_W-120)
      PHONE.pipes.push({x:PH_W+20,gy:70+$imports.GameRandom.next()*(PH_H-140-PH_GAP),pass:false});
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
    c.fillText(PHONE.st==='over'?(PHONE.msg||'再点一下重来'):(PHONE.cool>0?'手机还烫着，静不下心':'玩一会儿，缓口气'),PH_W/2,PH_H/2+16);
  }
};

PHONE.selectApp=function(app){
  if(app==='plane'&&($imports.AN.active||$imports.PatrolWorld.localChase())){(0,$imports.toast)('遇险时不能玩纸飞机');app='home';}
  $imports.PhoneNetwork.page=app;
  var el=phoneEl();el.querySelector('#phcv').hidden=app!=='plane';el.querySelector('#phhint').hidden=app!=='plane';
  el.querySelectorAll('[data-app]').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.app===app));});
  var tool=el.querySelector('#phtool');tool.innerHTML='<p data-copy></p>';
  if(app==='wireless'){var b=document.createElement('button');b.type='button';b.dataset.action='wireless';b.onclick=function(){$imports.PhoneNetwork.toggleWireless();PHONE.paintApps();};tool.appendChild(b);}
  if(app==='container'){var dl=document.createElement('button');dl.type='button';dl.dataset.action='download';dl.onclick=function(){$imports.PhoneNetwork.toggleDownload();PHONE.paintApps();};tool.appendChild(dl);}
  if(app==='sync'){var sync=document.createElement('button');sync.type='button';sync.textContent='同步门禁数据';sync.onclick=function(){$imports.PhoneNetwork.sync();PHONE.paintApps();};tool.appendChild(sync);}
  if(app==='plane')PHONE.draw();PHONE.paintApps();
};
PHONE.paintApps=function(){
  if(!PHONE.on)return;var el=phoneEl(),d=$imports.PhoneNetwork.device,app=$imports.PhoneNetwork.page;
  function text(node,value){if(node&&node.textContent!==value)node.textContent=value;}
  text(el.querySelector('#phstatus'),'电量 '+Math.floor(d.battery)+'% · '+(d.network?'学校网络已连接':'尚未联网')+($imports.Talent.has('tech')?' · 耗电 ×2':''));
  var copy='',w=d.wireless;
  if(app==='home')copy='工具查看时不能移动，世界仍在运行。收起手机后，后台任务继续。原教室无渗透时，从空电充满：普通约 5 分钟，科技党约 10 分钟。机房接线只抵普通基础耗电；科技党仍每分钟净掉 10 点。';
  if(app==='wireless'){
    copy=w.status==='complete'?'无线接入完成。定位与门禁同步已解锁；不再暴露新位置，已发出的情报不会撤回。':w.status==='idle'?'接入学校无线网络需要 180—600 运行秒，执行期间耗电翻倍。':
      (w.status==='paused'?'已暂停':'正在接入')+' · '+Math.floor(w.elapsed/w.target*100)+'% · 剩余 '+Math.ceil(w.target-w.elapsed)+' 秒';
    var b=el.querySelector('[data-action="wireless"]');if(b){b.disabled=w.status==='complete';text(b,w.status==='running'?'暂停任务':w.status==='idle'?'开始接入':w.status==='complete'?'已连接':'继续任务');}
    if(w.status!=='complete'){
      copy+='\n\n破解每累计 15 运行秒暴露一次当时的位置，巡察者会来搜查；坐下、假条和外出登记不能豁免。';
      if(w.status==='running')copy+='\n下次暴露：'+Math.ceil($imports.PhoneEnergy.nextSignalIn(w))+' 秒；收起手机仍会继续。';
      if(w.status==='paused')copy+='\n暴露计时已暂停，已发出的位置信息不会撤回。';
    }
    if($imports.Talent.has('tech')&&w.status!=='complete')copy+=' 科技党执行渗透时，即使在原教室也会净掉电。';
  }
  if(app==='location')copy=$imports.PhoneNetwork.location();
  if(app==='sync')copy=$imports.RT.data?'门禁数据已经同步。':d.network?'仍需先在网络中心写入白名单；联网手机可以完成同步。':'先接入学校网络。';
  if(app==='container'){copy=(d.download.status==='complete'?'模拟 Kali Linux 容器已就绪，可在机房电脑旁打开终端。':d.download.status==='idle'?'无线接入完成后，自动安装容器。':
      (d.download.status==='paused'?'安装已暂停 ':'容器安装 ')+Math.floor(d.download.elapsed/60*100)+'% · 剩余 '+Math.ceil(60-d.download.elapsed)+' 秒')+
      ($imports.Termination.state.status==='accepted'?'\n服务器停机剩余 '+Math.ceil($imports.Termination.state.remaining)+' 运行秒。':'');
    var dl=el.querySelector('[data-action="download"]');if(dl){dl.disabled=!['running','paused'].includes(d.download.status);text(dl,d.download.status==='running'?'暂停下载':d.download.status==='paused'?'继续下载':d.download.status==='complete'?'已安装':'等待联网');}}
  text(el.querySelector('[data-copy]'),copy);
};

/* @module-exports */
GameModules.publish("game3d/js/phone.js",{
"PHONE":{get:function(){return PHONE;},set:function($value){PHONE=$value;}},
"PH_W":{get:function(){return PH_W;},set:function($value){PH_W=$value;}},
"PH_H":{get:function(){return PH_H;},set:function($value){PH_H=$value;}},
"PH_GAP":{get:function(){return PH_GAP;},set:function($value){PH_GAP=$value;}},
"PH_SPD":{get:function(){return PH_SPD;},set:function($value){PH_SPD=$value;}},
"PH_G":{get:function(){return PH_G;},set:function($value){PH_G=$value;}},
"PH_FLAP":{get:function(){return PH_FLAP;},set:function($value){PH_FLAP=$value;}},
"PH_COOL":{get:function(){return PH_COOL;},set:function($value){PH_COOL=$value;}},
"PH_MAXGAIN":{get:function(){return PH_MAXGAIN;},set:function($value){PH_MAXGAIN=$value;}},
"phoneEl":{get:function(){return phoneEl;},set:function($value){phoneEl=$value;}}
});
})(GameModules.imports("game3d/js/phone.js"));
