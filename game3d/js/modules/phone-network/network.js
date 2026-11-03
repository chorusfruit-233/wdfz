/* 手机设备、统一玩法时钟与服务端停机任务。所有持久域各有一份真值。 */
'use strict';
var Mechanics={schemaVersion:1,rulesVersion:3,activePlaySeconds:0,attemptId:1,runSeed:'',dirty:false,
  reset:function(){this.activePlaySeconds=0;this.attemptId=1;this.runSeed=Math.floor(Math.random()*0xffffffff).toString(36);this.dirty=false;},
  begin:function(dt){
    this.activePlaySeconds+=dt;
    PhoneNetwork.tick(dt);
    if(Termination.state.status==='accepted')Termination.state.remaining=Math.max(0,Termination.state.remaining-dt);
  },
  finish:function(dt){
    PHONE.checkInterrupt();TerminalUI.interrupt();
    if(S.dead||S.screen!=='play')return;
    var pressure=PatrolWorld.pressure();if(pressure){sanDrain(pressure,dt,'patrol');settleSan();}
    if(S.dead)return;
    if(Termination.state.status==='accepted'&&Termination.state.remaining<=1e-7)Termination.complete();
    if(this.dirty&&S.screen==='play'){this.dirty=false;autoSave();}
  },
  dream:function(){
    PHONE.stop();this.attemptId++;HIDE.on=false;HIDE.seen=false;var slits=document.getElementById('hideslits');if(slits)slits.style.display='none';PhoneNetwork.reset();PhoneNetwork.acquire();TerminalUI.resetPuzzle();Termination.reset();
    AttendanceDuty.reset();RT.outing=null;PatrolWorld.reset();this.dirty=true;
  },
  migrate:function(d){
    if(d.mods&&d.mods.mechanics){
      if(!d.mods.phoneDevice){PhoneNetwork.device.initialized=true;PhoneNetwork.device.battery=0;PhoneNetwork.device.powered=false;networkDiagnostic('phoneDevice','缺失设备域，按空电恢复，未赠送电量');}
      return;
    }
    this.schemaVersion=1;HIDE.seen=false;PhoneNetwork.acquire();
    if(S.day===1&&d.rt&&d.rt.outing){RT.outing=null;toast('旧外出登记已作废：第一天不能登记外出');}
    saveReport('migration','已升级巡察、设备与运行秒规则；保留背包和原路线进度');
    this.dirty=true;autoSave();this.dirty=false;
  }
};
var PhoneNetwork={device:PhoneEnergy.fresh(),connection:null,page:'home',
  reset:function(){this.device=PhoneEnergy.fresh();this.connection=null;this.page='home';},
  acquire:function(){
    if(hasItem('phone')&&!this.device.initialized){this.device.initialized=true;this.device.deviceId=Mechanics.runSeed+':phone';Mechanics.dirty=true;}
  },
  available:function(){this.acquire();return hasItem('phone')&&this.device.initialized&&this.device.powered&&this.device.battery>0;},
  originalClassroom:function(){var R=INTERIORS.teach1;if(!R||S.mode!=='in'||S.room!=='teach1')return false;var c=(S.x-R.ox)/R.tw,r=(S.y-R.oy)/R.th;return c>=45&&c<52&&r>=1&&r<15;},
  connectedComputer:function(){
    var c=this.connection;
    if(c&&(S.mode!=='in'||S.room!=='lab3'||!hasItem('phone')||Math.hypot(S.x-c.x,S.y-c.y)>26)){this.connection=null;c=null;}
    return !!c;
  },
  connect:function(hit){
    if(!hasItem('phone')){toast('需要一部手机');return false;}
    if(S.room!=='lab3'||!hit||['n','K'].indexOf(hit.ch)<0)return false;
    this.acquire();this.connection={x:hit.x,y:hit.y};toast('手机已接入电脑 · 离开附近会自动断开');return true;
  },
  disconnect:function(){this.connection=null;TerminalUI.close();toast('手机已断开');},
  startWireless:function(){
    if(!this.available())return false;
    var w=this.device.wireless;if(w.status==='complete')return false;
    if(w.status==='idle'){w.target=180+Math.random()*420;w.elapsed=0;}
    w.status='running';autoSave();return true;
  },
  toggleWireless:function(){
    if(!this.available())return;
    var w=this.device.wireless;if(w.status==='running'){w.status='paused';autoSave();}else this.startWireless();
  },
  toggleDownload:function(){
    if(!this.available()||!this.device.network)return;
    var task=this.device.download;if(task.status!=='running'&&task.status!=='paused')return;
    task.status=task.status==='running'?'paused':'running';autoSave();
  },
  sync:function(){
    if(!this.available()||!this.device.network){toast('手机需要电量与学校网络连接');return false;}
    return WhitelistSync.commit('phone');
  },
  location:function(){return this.available()&&this.device.network?PatrolWorld.locationLabel():'尚未接入学校网络';},
  tick:function(dt){
    this.acquire();var held=hasItem('phone'),computer=this.connectedComputer();
    var events=PhoneEnergy.advance(this.device,dt,{held:held,tech:Talent.has('tech'),classroom:held&&this.originalClassroom(),computer:held&&computer});
    if(events.includes('wirelessSignal')){
      PatrolWorld.revealWireless();toast('无线破解暴露了当前位置 · 巡察者正在调查，尽快转移');
    }
    events.forEach(function(e){
      if(e==='connected')toast('手机：无线接入成功，开始安装容器');
      if(e==='downloaded')toast('手机：容器已就绪，可连接机房电脑');
      if(e==='low20')toast('手机电量不足 20%');if(e==='low5')toast('手机电量不足 5%');
      if(e==='off'){PHONE.stop();TerminalUI.close();toast('手机电量耗尽');}
      if(e==='on')toast('手机已恢复开机');Mechanics.dirty=true;
    });
    if(PHONE.on)PHONE.paintApps();
  },
  computerMenu:function(hit){
    UI.choice('机房电脑',[{label:'玩贪吃蛇',fn:function(){doSanAct('pc');}},
      {label:'连接手机',fn:function(){PhoneNetwork.connect(hit);}},
      {label:'打开服务器终端',fn:function(){TerminalUI.open(hit);}},
      {label:'断开手机',fn:function(){PhoneNetwork.disconnect();}}]);
  }
};
var WhitelistSync={commit:function(source){
  if(!RT.hacked){os('我：得先在实验楼三楼的网络中心写入白名单。',3.2);return false;}
  if(RT.data){toast('白名单数据已经同步');return true;}
  RT.data=true;RT.dataSource=source;
  Investigation.record('whitelistSynced','白名单同步完成：门禁认的是学号与照片。西小门现在认得我了。','验证',source==='phone'?'手机 · 门禁同步':'行政楼三楼 · 门禁机');
  autoSave();os('我：同步完成。照片底下写着：已登记。西小门现在认得我了。',4,OS_KEEP);return true;
}};
var Termination={state:{status:'idle',requestId:null,remaining:0},
  reset:function(){this.state={status:'idle',requestId:null,remaining:0};},
  submit:function(){
    var p=TerminalUI.puzzle;if(this.state.status==='accepted')return this.state.requestId;
    if(this.state.status!=='idle'||!p.validated||CampusTerminal.run(p,'campusctl shutdown --confirm').request!=='shutdown')return null;
    var id=Mechanics.runSeed+':'+Mechanics.attemptId+':shutdown';
    this.state={status:'accepted',requestId:id,remaining:600};p.acceptedRequestId=id;autoSave();
    Investigation.record('cyberRequest','停机请求已经被服务器接受。接下来必须存活十分钟，手机可以断开。','验证','机房维护终端');return id;
  },
  complete:function(){
    if(S.dead||S.screen!=='play'||this.state.status!=='accepted')return false;
    this.state.status='completed';this.state.remaining=0;
    TerminalUI.close();PHONE.stop();if(CarChase.active())CarChase.cancel();Elevator.cancel();
    UI.closeChoice();Speedrun.proof('cyber');triggerEnding('cyber');return true;
  },
  cancel:function(){if(this.state.status==='accepted')this.state.status='cancelled';}
};

function networkDiagnostic(domain,message){saveReport(domain,message);}
function networkNumber(v,lo,hi,fallback){return Number.isFinite(v)?clamp(v,lo,hi):fallback;}
GameModules.persistent('mechanics',{
  reset:function(){Mechanics.reset();},
  save:function(){return {schemaVersion:1,rulesVersion:Mechanics.rulesVersion,activePlaySeconds:Mechanics.activePlaySeconds,attemptId:Mechanics.attemptId,runSeed:Mechanics.runSeed};},
  load:function(d){if(!d||typeof d!=='object'){networkDiagnostic('mechanics','损坏的运行时钟已修复');return;}
    Mechanics.activePlaySeconds=networkNumber(d.activePlaySeconds,0,1e9,0);Mechanics.attemptId=Math.floor(networkNumber(d.attemptId,1,1e6,1));
    if(typeof d.runSeed==='string'&&d.runSeed.length<=64)Mechanics.runSeed=d.runSeed;else networkDiagnostic('mechanics','缺失种子，采用新的保守状态');}
});
GameModules.persistent('phoneDevice',{
  reset:function(){PhoneNetwork.reset();},save:function(){return Object.assign({},PhoneNetwork.device,{page:PhoneNetwork.page});},
  load:function(d){
    if(!d||typeof d!=='object'){PhoneNetwork.device.initialized=true;PhoneNetwork.device.battery=0;PhoneNetwork.device.powered=false;networkDiagnostic('phoneDevice','设备数据损坏，按空电恢复');return;}
    var t=PhoneEnergy.fresh();t.initialized=!!d.initialized;t.deviceId=typeof d.deviceId==='string'?d.deviceId:Mechanics.runSeed+':phone';
    t.battery=networkNumber(d.battery,0,100,0);if(typeof d.initialized!=='boolean'||!d.initialized&&hasItem('phone')){t.initialized=true;t.battery=0;networkDiagnostic('phoneDevice','设备身份异常，未重发满电手机');}t.powered=!!d.powered&&t.battery>0;t.warn20=!!d.warn20;t.warn5=!!d.warn5;
    ['wireless','download'].forEach(function(k){var q=d[k];if(!q||!['idle','running','paused','complete'].includes(q.status))return;
      var target=k==='download'?60:networkNumber(q.target,180,600,0);if(!target)return;
      t[k]={status:q.status,target:target,elapsed:networkNumber(q.elapsed,0,target,0)};
      if(t[k].status==='complete'&&t[k].elapsed<target)t[k].status='paused';});
    t.network=!!d.network&&t.wireless.status==='complete';if(!t.network)t.download={status:'idle',elapsed:0,target:60};
    PhoneNetwork.device=t;if(['home','wireless','location','sync','container','plane'].includes(d.page))PhoneNetwork.page=d.page;
    if(!Number.isFinite(d.battery))networkDiagnostic('phoneDevice','非法电量已按空电恢复');
  }
});
GameModules.persistent('termination',{
  reset:function(){Termination.reset();},save:function(){return Termination.state;},
  load:function(d){if(!d||typeof d!=='object')return;
    if(d.status==='accepted'&&d.requestId===Mechanics.runSeed+':'+Mechanics.attemptId+':shutdown'&&Number.isFinite(d.remaining)&&d.remaining>=0&&d.remaining<=600)
      Termination.state={status:'accepted',requestId:d.requestId,remaining:d.remaining};
    else if(d.status!=='idle')networkDiagnostic('termination','非法停机请求未被恢复为成功');}
});
GameModules.on('newGame',function(){if(Talent.has('tech')){addItem('phone');PhoneNetwork.acquire();}},{owner:'phone-network'});
Lifecycle.register('network-ui',function(){PhoneNetwork.connection=null;TerminalUI.close();});
