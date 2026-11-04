/* @module-capsule */
(function($imports){
/* 手机设备、统一玩法时钟与服务端停机任务。所有持久域各有一份真值。 */
'use strict';
var Mechanics={schemaVersion:1,rulesVersion:5,activePlaySeconds:0,attemptId:1,runSeed:'',dirty:false,
  reset:function(){this.activePlaySeconds=0;this.attemptId=1;this.runSeed=Math.floor($imports.GameRandom.next()*0xffffffff).toString(36);this.dirty=false;},
  begin:function(dt){
    this.activePlaySeconds+=dt;
    PhoneNetwork.tick(dt);
    if(Termination.state.status==='accepted')Termination.state.remaining=Math.max(0,Termination.state.remaining-dt);
  },
  finish:function(dt){
    $imports.PHONE.checkInterrupt();$imports.TerminalUI.interrupt();
    if($imports.S.dead||$imports.S.screen!=='play')return;
    var pressure=$imports.PatrolWorld.pressure();if(pressure){(0,$imports.sanDrain)(pressure,dt,'patrol');(0,$imports.settleSan)();}
    if($imports.S.dead)return;
    if(Termination.state.status==='accepted'&&Termination.state.remaining<=1e-7)Termination.complete();
    if(this.dirty&&$imports.S.screen==='play'){this.dirty=false;(0,$imports.autoSave)();}
  },
  dream:function(){
    $imports.PHONE.stop();this.attemptId++;$imports.HIDE.on=false;$imports.HIDE.seen=false;var slits=document.getElementById('hideslits');if(slits)slits.style.display='none';PhoneNetwork.reset();PhoneNetwork.acquire();$imports.TerminalUI.resetPuzzle();Termination.reset();
    $imports.AttendanceDuty.reset();$imports.RT.outing=null;$imports.PatrolWorld.reset();this.dirty=true;
  },
  migrate:function(d){
    if(d.mods&&d.mods.mechanics){
      if(!d.mods.phoneDevice){PhoneNetwork.device.initialized=true;PhoneNetwork.device.battery=0;PhoneNetwork.device.powered=false;networkDiagnostic('phoneDevice','缺失设备域，按空电恢复，未赠送电量');}
      return;
    }
    this.schemaVersion=1;$imports.HIDE.seen=false;PhoneNetwork.acquire();
    if($imports.S.day===1&&d.rt&&d.rt.outing){$imports.RT.outing=null;(0,$imports.toast)('旧外出登记已作废：第一天不能登记外出');}
    (0,$imports.saveReport)('migration','已升级巡察、设备与运行秒规则；保留背包和原路线进度');
    this.dirty=true;(0,$imports.autoSave)();this.dirty=false;
  }
};
var PhoneNetwork={device:$imports.PhoneEnergy.fresh(),connection:null,page:'home',
  reset:function(){this.device=$imports.PhoneEnergy.fresh();this.connection=null;this.page='home';},
  acquire:function(){
    if((0,$imports.hasItem)('phone')&&!this.device.initialized){this.device.initialized=true;this.device.deviceId=Mechanics.runSeed+':phone';Mechanics.dirty=true;}
  },
  available:function(){this.acquire();return (0,$imports.hasItem)('phone')&&this.device.initialized&&this.device.powered&&this.device.battery>0;},
  originalClassroom:function(){var L=$imports.ClassroomLayout,R=$imports.INTERIORS[L.ownSeat.room];if(!R||$imports.S.mode!=='in'||$imports.S.room!==L.ownSeat.room)return false;return L.classAt(Math.floor(($imports.S.x-R.ox)/R.tw),Math.floor(($imports.S.y-R.oy)/R.th))===L.ownSeat.classId;},   /* 在自己班那间教室里（布局见 domain/classroom-layout.js） */
  connectedComputer:function(){
    var c=this.connection;
    if(c&&($imports.S.mode!=='in'||$imports.S.room!=='lab3'||!(0,$imports.hasItem)('phone')||Math.hypot($imports.S.x-c.x,$imports.S.y-c.y)>26)){this.connection=null;c=null;}
    return !!c;
  },
  connect:function(hit){
    if(!(0,$imports.hasItem)('phone')){(0,$imports.toast)('需要一部手机');return false;}
    if($imports.S.room!=='lab3'||!hit||['n','K'].indexOf(hit.ch)<0)return false;
    this.acquire();this.connection={x:hit.x,y:hit.y};(0,$imports.toast)('手机已接入电脑 · 离开附近会自动断开');return true;
  },
  disconnect:function(){this.connection=null;$imports.TerminalUI.close();(0,$imports.toast)('手机已断开');},
  startWireless:function(){
    if(!this.available())return false;
    var w=this.device.wireless;if(w.status==='complete')return false;
    if(w.status==='idle'){w.target=180+$imports.GameRandom.next()*420;w.elapsed=0;}
    w.status='running';(0,$imports.autoSave)();return true;
  },
  toggleWireless:function(){
    if(!this.available())return;
    var w=this.device.wireless;if(w.status==='running'){w.status='paused';(0,$imports.autoSave)();}else this.startWireless();
  },
  toggleDownload:function(){
    if(!this.available()||!this.device.network)return;
    var task=this.device.download;if(task.status!=='running'&&task.status!=='paused')return;
    task.status=task.status==='running'?'paused':'running';(0,$imports.autoSave)();
  },
  sync:function(){
    if(!this.available()||!this.device.network){(0,$imports.toast)('手机需要电量与学校网络连接');return false;}
    return WhitelistSync.commit('phone');
  },
  location:function(){return this.available()&&this.device.network?$imports.PatrolWorld.locationLabel():'尚未接入学校网络';},
  tick:function(dt){
    this.acquire();var held=(0,$imports.hasItem)('phone'),computer=this.connectedComputer();
    var events=$imports.PhoneEnergy.advance(this.device,dt,{held:held,tech:$imports.Talent.has('tech'),classroom:held&&this.originalClassroom(),computer:held&&computer});
    if(events.includes('wirelessSignal')){
      $imports.PatrolWorld.revealWireless();(0,$imports.toast)('无线破解暴露了当前位置 · 巡察者正在调查，尽快转移');
    }
    events.forEach(function(e){
      if(e==='connected')(0,$imports.toast)('手机：无线接入成功，开始安装容器');
      if(e==='downloaded')(0,$imports.toast)('手机：容器已就绪，可连接机房电脑');
      if(e==='low20')(0,$imports.toast)('手机电量不足 20%');if(e==='low5')(0,$imports.toast)('手机电量不足 5%');
      if(e==='off'){$imports.PHONE.stop();$imports.TerminalUI.close();(0,$imports.toast)('手机电量耗尽');}
      if(e==='on')(0,$imports.toast)('手机已恢复开机');Mechanics.dirty=true;
    });
    if($imports.PHONE.on)$imports.PHONE.paintApps();
  },
  computerMenu:function(hit){
    $imports.UI.choice('机房电脑',[{label:'玩贪吃蛇',fn:function(){(0,$imports.doSanAct)('pc');}},
      {label:'连接手机',fn:function(){PhoneNetwork.connect(hit);}},
      {label:'打开服务器终端',fn:function(){$imports.TerminalUI.open(hit);}},
      {label:'断开手机',fn:function(){PhoneNetwork.disconnect();}}]);
  }
};
var WhitelistSync={commit:function(source){
  if(!$imports.RT.hacked){(0,$imports.os)('我：得先在实验楼三楼的网络中心写入白名单。',3.2);return false;}
  if($imports.RT.data){(0,$imports.toast)('白名单数据已经同步');return true;}
  $imports.RT.data=true;$imports.RT.dataSource=source;
  $imports.Investigation.record('whitelistSynced','白名单同步完成：门禁认的是学号与照片。西小门现在认得我了。','验证',source==='phone'?'手机 · 门禁同步':'行政楼三楼 · 门禁机');
  (0,$imports.autoSave)();(0,$imports.os)('我：同步完成。照片底下写着：已登记。西小门现在认得我了。',4,$imports.OS_KEEP);return true;
}};
var Termination={state:{status:'idle',requestId:null,remaining:0},
  reset:function(){this.state={status:'idle',requestId:null,remaining:0};},
  submit:function(){
    var p=$imports.TerminalUI.puzzle;if(this.state.status==='accepted')return this.state.requestId;
    if(this.state.status!=='idle'||!p.validated||$imports.CampusTerminal.run(p,'campusctl shutdown --confirm').request!=='shutdown')return null;
    var id=Mechanics.runSeed+':'+Mechanics.attemptId+':shutdown';
    this.state={status:'accepted',requestId:id,remaining:600};p.acceptedRequestId=id;(0,$imports.autoSave)();
    $imports.Investigation.record('cyberRequest','停机请求已经被服务器接受。接下来必须存活十分钟，手机可以断开。','验证','机房维护终端');return id;
  },
  complete:function(){
    if($imports.S.dead||$imports.S.screen!=='play'||this.state.status!=='accepted')return false;
    this.state.status='completed';this.state.remaining=0;
    $imports.TerminalUI.close();$imports.PHONE.stop();if($imports.CarChase.active())$imports.CarChase.cancel();$imports.Elevator.cancel();
    $imports.UI.closeChoice();$imports.Speedrun.proof('cyber');(0,$imports.triggerEnding)('cyber');return true;
  },
  cancel:function(){if(this.state.status==='accepted')this.state.status='cancelled';}
};

function networkDiagnostic(domain,message){(0,$imports.saveReport)(domain,message);}
function networkNumber(v,lo,hi,fallback){return Number.isFinite(v)?(0,$imports.clamp)(v,lo,hi):fallback;}
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
    var t=$imports.PhoneEnergy.fresh();t.initialized=!!d.initialized;t.deviceId=typeof d.deviceId==='string'?d.deviceId:Mechanics.runSeed+':phone';
    t.battery=networkNumber(d.battery,0,100,0);if(typeof d.initialized!=='boolean'||!d.initialized&&(0,$imports.hasItem)('phone')){t.initialized=true;t.battery=0;networkDiagnostic('phoneDevice','设备身份异常，未重发满电手机');}t.powered=!!d.powered&&t.battery>0;t.warn20=!!d.warn20;t.warn5=!!d.warn5;
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
GameModules.on('newGame',function(){if($imports.Talent.has('tech')){(0,$imports.addItem)('phone');PhoneNetwork.acquire();}},{owner:'phone-network'});
$imports.Lifecycle.register('network-ui',function(){PhoneNetwork.connection=null;$imports.TerminalUI.close();});

/* @module-exports */
GameModules.publish("game3d/js/modules/phone-network/network.js",{
"Mechanics":{get:function(){return Mechanics;},set:function($value){Mechanics=$value;}},
"PhoneNetwork":{get:function(){return PhoneNetwork;},set:function($value){PhoneNetwork=$value;}},
"WhitelistSync":{get:function(){return WhitelistSync;},set:function($value){WhitelistSync=$value;}},
"Termination":{get:function(){return Termination;},set:function($value){Termination=$value;}},
"networkDiagnostic":{get:function(){return networkDiagnostic;},set:function($value){networkDiagnostic=$value;}},
"networkNumber":{get:function(){return networkNumber;},set:function($value){networkNumber=$value;}}
});
})(GameModules.imports("game3d/js/modules/phone-network/network.js"));
