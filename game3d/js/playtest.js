/* 可选的本地试玩记录。独立于存档，不发送网络请求，不保存参与者身份。 */
'use strict';
var Playtest={data:null,started:0,last:0,mode:'menu',frameBins:null,
  currentMode:function(){return document.hidden?'background':S.screen!=='play'||PRO.on||PAUSE.on||UI.anyOpen()||PC.on||(DEV.on&&DEV.freeze)?'menu':S.dead?'death':'play';},
  toggle:function(){
    if(this.data&&this.data.recording){this.sample();this.data.recording=false;this.paint();return;}
    this.started=this.last=performance.now();this.mode=this.currentMode();this.frameBins=[0,0,0,0];
    this.data={version:1,recording:true,startedAt:new Date().toISOString(),userAgent:navigator.userAgent,
      environment:'由执行者补录真实设备；浏览器信息不证明是真机',settings:JSON.parse(JSON.stringify(SET)),
      viewport:{width:innerWidth,height:innerHeight,pixelRatio:devicePixelRatio},
      seconds:{play:0,menu:0,background:0,death:0},simulationSeconds:0,events:[],discardedEvents:0};
    this.event('开始记录');this.paint();
  },
  sample:function(){
    if(!this.data||!this.data.recording)return;
    var now=performance.now();this.data.seconds[this.mode]+=(now-this.last)/1000;this.last=now;this.mode=this.currentMode();
  },
  frame:function(dt){
    this.sample();if(!this.data||!this.data.recording||this.mode!=='play'||!Number.isFinite(dt)||dt<=0)return;
    this.frameBins[dt<.025?0:dt<.05?1:dt<.1?2:3]++;
  },
  simulation:function(dt){if(this.data&&this.data.recording)this.data.simulationSeconds+=dt;},
  event:function(type,detail){
    if(!this.data||!this.data.recording)return;
    this.sample();var ev={type:type,detail:detail||'',elapsedSeconds:(performance.now()-this.started)/1000,day:S.day,gameMinutes:S.tsec,
      room:S.mode==='in'?S.room:'out',san:S.san,violation:S.viol,assimilation:S.tt,inventory:S.bag.slice()};
    if(this.data.events.length>=500){this.data.events.shift();this.data.discardedEvents++;}
    this.data.events.push(ev);
  },
  note:function(){
    var el=document.getElementById('playtestNote'),value=el.value.trim();
    if(!this.data||!this.data.recording){toast('先点「开始记录」');return;}
    if(value){this.event('观察者记录',value.slice(0,500));el.value='';this.paint();toast('已记入本地试玩记录');}
  },
  paint:function(){
    var on=!!(this.data&&this.data.recording),button=document.getElementById('playtestToggle');
    if(button){button.textContent=on?'停止记录':this.data?'重新开始记录':'开始记录';button.classList.toggle('on',on);}
    var download=document.getElementById('playtestDownload');if(download)download.disabled=!this.data;
    var state=document.getElementById('playtestState');
    if(state){state.textContent=on?'记录中 · '+this.data.events.length+' 条':this.data?'已停止 · 可下载':'未记录';state.classList.toggle('rec',on);}
  },
  export:function(){
    if(!this.data)return;this.sample();
    var out=Object.assign({},this.data,{elapsedSeconds:(this.last-this.started)/1000,
      frameIntervals:{under25ms:this.frameBins[0],from25to50ms:this.frameBins[1],from50to100ms:this.frameBins[2],over100ms:this.frameBins[3]},
      evidence:'本地事件与帧间隔记录；不自动推断理解度、真机性能、听感或试玩结论'});
    var url=URL.createObjectURL(new Blob([JSON.stringify(out,null,2)],{type:'application/json'})),a=document.createElement('a');
    a.href=url;a.download='wdfz-playtest.json';a.click();setTimeout(function(){URL.revokeObjectURL(url);},1000);return out;
  }
};
document.addEventListener('visibilitychange',function(){Playtest.sample();});
