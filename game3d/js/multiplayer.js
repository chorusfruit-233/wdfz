/* 房间连接原型：只同步位置；共享世界、剧情与存档尚未实现。 */
'use strict';
var Multiplayer=(function(){
  var VERSION=1, STORAGE='wdfz3d_multiplayer_prototype';
  var socket=null,token=null,manual=false,lastError='',reconnectTimer=0,reconnectUntil=0,sendTimer=0,seq=0;
  var api={playing:false,connected:false,selfId:null,room:null,peerPoses:Object.create(null)};
  function el(id){return document.getElementById(id);}
  function message(text){el('mpMessage').textContent=text||'';if(api.playing)hud(text);}
  function hud(text){
    var e=el('mpHud');e.hidden=!api.playing;
    if(api.playing){
      var online=api.room?api.room.players.filter(function(p){return p.connected;}).length:0;
      e.textContent='联机原型 · '+online+'/4 在线'+(text?' · '+text:'');
    }
  }
  function saved(){
    try{
      var d=JSON.parse(sessionStorage.getItem(STORAGE)||'null');
      return d&&typeof d.token==='string'&&/^[0-9a-f]{48}$/.test(d.token)?d:null;
    }catch(e){return null;}
  }
  function storeSession(){
    try{sessionStorage.setItem(STORAGE,JSON.stringify({token:token,code:api.room.code}));}catch(e){}
  }
  function forgetSession(){try{sessionStorage.removeItem(STORAGE);}catch(e){}}
  function send(obj){
    if(socket&&socket.readyState===WebSocket.OPEN){socket.send(JSON.stringify(obj));return true;}
    return false;
  }
  function renderRoom(){
    var room=api.room, setup=el('mpSetup'), box=el('mpRoom');
    setup.hidden=!!room;box.hidden=!room;
    el('mpResume').hidden=!saved()||!!room;
    if(!room){hud();return;}
    el('mpRoomCode').textContent=room.code;
    var invite=new URL('/',location.href);invite.searchParams.set('room',room.code);
    el('mpInvite').value=invite.toString();
    var list=el('mpPlayers');list.textContent='';
    room.players.forEach(function(p){
      var li=document.createElement('li');
      li.textContent=p.name+(p.id===room.hostId?' · 房主':'')+(p.id===api.selfId?' · 你':'')+
        (!p.connected?' · 断线':p.ready?' · 已准备':' · 未准备');
      list.appendChild(li);
    });
    var self=room.players.find(function(p){return p.id===api.selfId;});
    el('mpReady').textContent=self&&self.ready?'取消准备':'准备';
    el('mpReady').disabled=!api.connected||room.phase!=='lobby';
    el('mpStart').hidden=room.hostId!==api.selfId;
    el('mpStart').disabled=!api.connected||room.phase!=='lobby'||room.players.length<2||
      room.players.some(function(p){return !p.connected||!p.ready;});
    Object.keys(api.peerPoses).forEach(function(id){
      if(!room.players.some(function(p){return p.id===id&&p.connected;}))removePeer(id);
    });
    hud();
  }
  function removePeer(id){delete api.peerPoses[id];Engine.remoteRemove(id);}
  function receivePose(id,pose){
    if(!api.playing||id===api.selfId||!pose||!SharedZones.has(pose.zone))return;
    var player=api.room&&api.room.players.find(function(p){return p.id===id&&p.connected;});
    if(!player)return;
    api.peerPoses[id]=pose;Engine.remotePose(id,pose,player.name);
  }
  function spawn(slot){
    var R=INTERIORS.teach1;if(!R)return;
    var col=45+(slot||0)*2,row=18;
    var x=R.ox+(col+.5)*R.tw,y=R.oy+(row+.5)*R.th;
    if(Collision.depth(x,y,PRAD,R)<1e-7){S.x=x;S.y=y;S.seated=false;S.ang=-Math.PI/2;syncCamera(0);}
  }
  function sendPose(){
    if(!api.playing||api.waitingForScene||!api.connected)return;
    var zone=S.mode==='out'?'out':S.room;
    if(!SharedZones.has(zone))return;
    send({type:'pose',pose:{seq:seq++,zone:zone,x:S.x,y:S.y,angle:S.ang%(Math.PI*2),
      floor:Number.isFinite(S.floorY)?S.floorY:0,seated:!!S.seated,moving:!!S.moving,
      visible:S.screen==='play'&&!S.dead&&!HIDE.on}});
  }
  function startGame(diff){
    if(api.playing)return;
    api.playing=true;api.waitingForScene=true;el('mpLobby').hidden=true;
    var player=api.room&&api.room.players.find(function(p){return p.id===api.selfId;});
    Game.start(diff,{skipPrologue:true,onEntered:function(){
      if(!api.playing)return;
      spawn(player?player.slot:0);api.waitingForScene=false;sendPose();
    }});
    var canvas=el('cv');if(canvas)canvas.focus({preventScroll:true});
    clearInterval(sendTimer);sendTimer=setInterval(sendPose,50);
    hud('仅同步位置');
  }
  function onMessage(msg){
    if(!msg||typeof msg!=='object')return;
    if(msg.type==='error'){
      lastError=typeof msg.message==='string'?msg.message:'联机操作失败。';
      if(msg.code==='resume_failed'){token=null;forgetSession();api.room=null;api.selfId=null;renderRoom();}
      message(lastError);return;
    }
    if(msg.type==='welcome'){
      api.connected=true;api.selfId=msg.selfId;api.room=msg.room;token=msg.token;
      reconnectUntil=0;seq=0;lastError='';storeSession();renderRoom();message('已连接');
      if(api.room.phase==='playing')startGame(api.room.difficulty);
      return;
    }
    if(msg.type==='state'){api.room=msg.room;renderRoom();return;}
    if(msg.type==='started'){startGame(msg.difficulty);return;}
    if(msg.type==='pose'){receivePose(msg.id,msg.pose);}
  }
  function retry(){
    if(manual||!token)return;
    if(!reconnectUntil)reconnectUntil=Date.now()+55000;
    if(Date.now()>=reconnectUntil){token=null;forgetSession();message('重连超时，请退出后重新加入。');return;}
    clearTimeout(reconnectTimer);reconnectTimer=setTimeout(function(){connect('resume');},1000);
  }
  function connect(action){
    if(socket&&(socket.readyState===WebSocket.OPEN||socket.readyState===WebSocket.CONNECTING))return;
    if(location.protocol!=='http:'&&location.protocol!=='https:'){message('请通过房主程序提供的地址打开游戏。');return;}
    if(action==='create'||action==='join'){
      token=null;api.room=null;api.selfId=null;forgetSession();renderRoom();
    }
    if(action==='resume'&&!token){var d=saved();token=d&&d.token;}
    if(action==='resume'&&!token){message('没有可恢复的连接。');return;}
    manual=false;lastError='';message(action==='resume'?'正在重新连接…':'正在连接房主…');
    var scheme=location.protocol==='https:'?'wss:':'ws:';
    var ws=new WebSocket(scheme+'//'+location.host+'/multiplayer');socket=ws;
    ws.onopen=function(){
      if(ws!==socket)return;
      var hello={type:'hello',version:VERSION,action:action};
      if(action==='resume')hello.token=token;
      else{
        hello.name=el('mpName').value;hello.code=el('mpCode').value;
        hello.difficulty=el('mpDifficulty').value;
      }
      send(hello);
    };
    ws.onmessage=function(e){if(ws!==socket)return;try{onMessage(JSON.parse(e.data));}catch(err){message('收到无法识别的房间消息。');}};
    ws.onerror=function(){if(ws===socket&&!lastError)message('连接失败，请确认从房主地址打开且已加入虚拟网络。');};
    ws.onclose=function(e){
      if(ws!==socket)return;socket=null;api.connected=false;renderRoom();
      if(manual)return;
      if(e.code===4001){token=null;forgetSession();message('此角色已在另一个窗口连接。');return;}
      if(token){message('连接中断，正在重连…');retry();}
      else if(!lastError)message('无法连接房主，请检查地址与网络。');
    };
  }
  function open(){
    if(S.screen!=='menu')return;
    el('mpLobby').hidden=false;renderRoom();el('mpName').focus();
  }
  function leave(){
    manual=true;clearTimeout(reconnectTimer);clearInterval(sendTimer);
    send({type:'leave'});if(socket){socket.close();socket=null;}
    token=null;forgetSession();api.playing=false;api.waitingForScene=false;api.connected=false;
    api.selfId=null;api.room=null;seq=0;api.peerPoses=Object.create(null);Engine.remoteClear();
    el('mpLobby').hidden=true;renderRoom();message('');
  }
  function tick(dt){
    if(!api.playing)return;
    var zone=S.mode==='out'?'out':S.room;
    Engine.remoteTick(dt,zone,api.waitingForScene||!api.connected);
  }
  function init(){
    el('mpOpen').addEventListener('click',open);
    el('mpClose').addEventListener('click',leave);
    el('mpCreate').addEventListener('click',function(){connect('create');});
    el('mpJoin').addEventListener('click',function(){connect('join');});
    el('mpResume').addEventListener('click',function(){connect('resume');});
    el('mpReady').addEventListener('click',function(){
      var self=api.room&&api.room.players.find(function(p){return p.id===api.selfId;});
      if(self)send({type:'ready',ready:!self.ready});
    });
    el('mpStart').addEventListener('click',function(){send({type:'start'});});
    el('mpInvite').addEventListener('click',function(){this.select();});
    renderRoom();
    try{
      var code=new URL(location.href).searchParams.get('room');
      if(code&&/^[A-Z2-9]{6}$/i.test(code)){el('mpCode').value=code.toUpperCase();open();}
    }catch(e){}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
  api.open=open;api.leave=leave;api.tick=tick;
  return api;
})();
