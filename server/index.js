/* 玩家电脑上的共享探索原型。剧情与危险尚未由服务端统一结算。 */
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {WebSocket, WebSocketServer} = require('ws');
const zones = require('../shared/content/zones');
const world = require('./world');
const {Session} = require('./session');

const VERSION = 2;
const MAX_PLAYERS = 4;
const MAX_MESSAGE = 8192;
const ROOT = fs.realpathSync(path.join(__dirname, '..'));
const MIME = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8',
  '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml'};

function allowedFile(urlPath){
  if(urlPath==='/'||urlPath==='/index.html')return 'index.html';
  if(urlPath==='/3d.html')return '3d.html';
  if(urlPath==='/wiki/'||urlPath==='/wiki/index.html')return 'wiki/index.html';
  if(urlPath==='/wiki/wiki.css')return 'wiki/wiki.css';
  if(/^\/game3d\/(css|js|lib)\/[A-Za-z0-9_./-]+$/.test(urlPath))return urlPath.slice(1);
  if(/^\/shared\/(simulation\/(physics|clock)|content\/(zones|room-bounds|loot))\.js$/.test(urlPath))return urlPath.slice(1);
  return null;
}

function staticRequest(req,res){
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;}
  let pathname;
  try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}
  catch(_){res.writeHead(400);res.end();return;}
  if(pathname==='/api/multiplayer'){
    const body=JSON.stringify({version:VERSION,prototype:true,maxPlayers:MAX_PLAYERS});
    res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
      'X-Content-Type-Options':'nosniff'});
    res.end(req.method==='HEAD'?undefined:body);return;
  }
  const relative=allowedFile(pathname);
  if(!relative||relative.split('/').some(part=>part==='..'||part==='.'||part.startsWith('.'))){res.writeHead(404);res.end();return;}
  const target=path.resolve(ROOT,relative);
  fs.realpath(target,(err,real)=>{
    if(err||!real.startsWith(ROOT+path.sep)){res.writeHead(404);res.end();return;}
    fs.stat(real,(statError,st)=>{
      if(statError||!st.isFile()){res.writeHead(404);res.end();return;}
      res.writeHead(200,{'Content-Type':MIME[path.extname(real).toLowerCase()]||'application/octet-stream',
        'Content-Length':st.size,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
      if(req.method==='HEAD'){res.end();return;}
      const stream=fs.createReadStream(real);
      stream.on('error',()=>res.destroy());stream.pipe(res);
    });
  });
}

function sameOrigin(req){
  try{
    const origin=new URL(req.headers.origin);
    return (origin.protocol==='http:'||origin.protocol==='https:')&&origin.host===req.headers.host;
  }catch(_){return false;}
}

function newCode(){
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let result='';
  for(let i=0;i<6;i++)result+=alphabet[crypto.randomInt(alphabet.length)];
  return result;
}
function cleanName(value){
  if(typeof value!=='string')return null;
  const name=value.replace(/[\u0000-\u001f\u007f-\u009f]/g,'').trim();
  return name&&Array.from(name).length<=16&&Buffer.byteLength(name)<=64?name:null;
}
function validPose(p){
  return p&&typeof p==='object'&&!Array.isArray(p)&&zones.has(p.zone)&&
    Number.isSafeInteger(p.seq)&&p.seq>=0&&
    ['x','y','angle','floor'].every(k=>typeof p[k]==='number'&&Number.isFinite(p[k]))&&
    world.contains(p.zone,p.x,p.y)&&Math.abs(p.angle)<=1000000&&
    p.floor>=-10&&p.floor<=100&&typeof p.seated==='boolean'&&typeof p.moving==='boolean'&&typeof p.visible==='boolean'&&
    (p.active===undefined||typeof p.active==='boolean');
}

function createHostServer(options={}){
  const graceMs=options.graceMs===undefined?60000:options.graceMs;
  const server=http.createServer(staticRequest);
  const wss=new WebSocketServer({noServer:true,maxPayload:MAX_MESSAGE,perMessageDeflate:false});
  let room=null;
  let lastSimAt=performance.now(),lastClockAt=0;

  function send(ws,msg){
    if(!ws||ws.readyState!==WebSocket.OPEN)return;
    if(ws.bufferedAmount>=256*1024){
      if(msg.type!=='pose')ws.close(1013,'slow_client');
      return;
    }
    ws.send(JSON.stringify(msg));
  }
  function error(ws,code,message,fatal){send(ws,{type:'error',code,message});if(fatal)ws.close(1008,code);}
  function publicState(){
    return {code:room.code,phase:room.phase,difficulty:room.difficulty,hostId:room.hostId,
      players:Array.from(room.players.values()).sort((a,b)=>a.slot-b.slot).map(p=>({
        id:p.id,name:p.name,slot:p.slot,ready:p.ready,connected:!!p.ws
      }))};
  }
  function broadcast(msg,except){
    if(!room)return;
    for(const p of room.players.values())if(p.ws&&p.ws!==except)send(p.ws,msg);
  }
  function sendState(){if(room)broadcast({type:'state',room:publicState()});}
  function sendSimulation(){
    if(!room||!room.sim)return;
    const sim=room.sim;
    if(room.sentRevision!==sim.revision){
      room.sentRevision=sim.revision;broadcast({type:'world',world:sim.snapshot()});
    }
    for(const p of room.players.values()){
      if(!p.ws)continue;
      const state=sim.self(p.id);
      if(p.sentSelf!==state.revision){
        p.sentSelf=state.revision;
        send(p.ws,{type:'self',epoch:sim.epoch,self:state,notices:sim.drainNotices(p.id)});
      }
    }
  }
  function simulationTick(){
    const now=performance.now(),dt=(now-lastSimAt)/1000;lastSimAt=now;
    if(!room||!room.sim)return;
    for(const p of room.players.values())if(p.pose&&now-p.poseAt>1500)room.sim.pose(p.id,null);
    room.sim.advance(dt,Array.from(room.players.values()).some(p=>p.ws));
    sendSimulation();
    if(now-lastClockAt>=250){lastClockAt=now;broadcast({type:'clock',epoch:room.sim.epoch,clock:room.sim.time()});}
  }
  function chooseHost(){
    if(!room)return;
    const old=room.players.get(room.hostId);
    if(old&&old.ws)return;
    const online=Array.from(room.players.values()).filter(p=>p.ws).sort((a,b)=>a.slot-b.slot);
    room.hostId=online.length?online[0].id:null;
  }
  function removePlayer(p){
    if(!room||!room.players.has(p.id))return;
    if(room.sim)room.sim.removePlayer(p.id,p.lastPose);
    clearTimeout(p.timer);room.players.delete(p.id);chooseHost();
    if(!room.players.size){room=null;return;}
    sendState();sendSimulation();
  }
  function welcome(peer,p){
    clearTimeout(p.timer);p.timer=null;p.ws=peer.ws;p.lastSeq=-1;p.pose=null;peer.player=p;
    p.sentSelf=-1;
    if(room.sim)room.sim.pose(p.id,null);
    if(!room.hostId)room.hostId=p.id;
    clearTimeout(peer.helloTimer);
    send(peer.ws,{type:'welcome',selfId:p.id,token:p.token,room:publicState(),
      world:room.sim?room.sim.snapshot():null,self:room.sim?room.sim.self(p.id):null});
    for(const other of room.players.values())if(other!==p&&other.ws&&other.pose)
      send(peer.ws,{type:'pose',id:other.id,pose:other.pose});
    sendState();sendSimulation();
  }
  function hello(peer,msg){
    if(msg.type!=='hello'||msg.version!==VERSION){error(peer.ws,'version','联机版本不匹配。',true);return;}
    if(msg.action==='resume'){
      const token=typeof msg.token==='string'?msg.token:'';
      const p=room&&Array.from(room.players.values()).find(x=>x.token===token);
      if(!p){error(peer.ws,'resume_failed','身份已失效，请返回主菜单；已开始的房间需要重新开局。',true);return;}
      if(p.ws){const old=p.ws;p.ws=null;old.close(4001,'replaced');}
      welcome(peer,p);return;
    }
    const name=cleanName(msg.name);
    if(!name){error(peer.ws,'name','昵称须为 1–16 个字符。',true);return;}
    if(msg.action==='create'){
      if(room){error(peer.ws,'room_exists','房主电脑已有房间，请输入房间码加入。',true);return;}
      if(msg.difficulty!=='easy'&&msg.difficulty!=='hard'){error(peer.ws,'difficulty','请选择难度。',true);return;}
      room={code:newCode(),phase:'lobby',difficulty:msg.difficulty,hostId:null,players:new Map(),sim:null,sentRevision:-1};
    }else if(msg.action==='join'){
      if(!room||typeof msg.code!=='string'||msg.code.trim().toUpperCase()!==room.code){error(peer.ws,'room_not_found','房间码不正确，或房间已关闭。',true);return;}
      if(room.phase!=='lobby'){error(peer.ws,'started','房间已经开始，暂不支持中途加入。',true);return;}
    }else{error(peer.ws,'action','无法识别加入方式。',true);return;}
    if(room.players.size>=MAX_PLAYERS){error(peer.ws,'full','房间已满。',true);return;}
    const used=new Set(Array.from(room.players.values()).map(p=>p.slot));
    let slot=0;while(used.has(slot))slot++;
    const p={id:crypto.randomUUID(),token:crypto.randomBytes(24).toString('hex'),name,slot,
      ready:false,ws:null,timer:null,pose:null,lastPose:null,poseAt:0,lastSeq:-1,sentSelf:-1};
    room.players.set(p.id,p);welcome(peer,p);
  }
  function message(peer,msg){
    if(!peer.player){hello(peer,msg);return;}
    const p=peer.player;
    if(!room||room.players.get(p.id)!==p||p.ws!==peer.ws)return;
    if(msg.type==='leave'){
      peer.player=null;p.ws=null;removePlayer(p);peer.ws.close(1000,'left');return;
    }
    if(msg.type==='ready'){
      if(room.phase!=='lobby'||typeof msg.ready!=='boolean'){error(peer.ws,'ready','现在不能更改准备状态。');return;}
      p.ready=msg.ready;sendState();return;
    }
    if(msg.type==='start'){
      if(room.phase!=='lobby'||p.id!==room.hostId){error(peer.ws,'start','只有房主可以开始。');return;}
      const members=Array.from(room.players.values());
      if(members.length<2||members.some(x=>!x.ws||!x.ready)){
        error(peer.ws,'not_ready','至少需要两人，并且所有成员都已连接和准备。');return;
      }
      room.phase='playing';room.sim=new Session();
      for(const m of members)room.sim.addPlayer(m.id);
      lastSimAt=performance.now();lastClockAt=0;
      for(const m of members)send(m.ws,{type:'started',difficulty:room.difficulty,world:room.sim.snapshot(),self:room.sim.self(m.id)});
      sendState();sendSimulation();return;
    }
    if(msg.type==='pose'){
      if(room.phase!=='playing'||!validPose(msg.pose)||msg.pose.seq<=p.lastSeq)return;
      p.lastSeq=msg.pose.seq;
      p.pose={seq:msg.pose.seq,zone:msg.pose.zone,x:msg.pose.x,y:msg.pose.y,
        angle:msg.pose.angle,floor:msg.pose.floor,seated:msg.pose.seated,moving:msg.pose.moving,visible:msg.pose.visible,
        active:msg.pose.active!==false};
      p.poseAt=performance.now();p.lastPose=p.pose;room.sim.pose(p.id,p.pose);
      broadcast({type:'pose',id:p.id,pose:p.pose},peer.ws);sendSimulation();return;
    }
    if(msg.type==='op'){
      if(!room.sim){error(peer.ws,'not_started','房间还未开始。');return;}
      simulationTick();
      const result=performance.now()-p.poseAt>1500||!p.pose?
        {seq:msg.seq,ok:false,code:'inactive',text:'连接尚未就绪，请稍后重试。'}:room.sim.act(p.id,msg);
      send(p.ws,{type:'result',epoch:room.sim.epoch,...result,self:room.sim.self(p.id),world:room.sim.snapshot()});
      sendSimulation();return;
    }
    error(peer.ws,'message','无法识别的操作。');
  }

  server.on('upgrade',(req,socket,head)=>{
    let pathname;
    try{pathname=new URL(req.url,'http://localhost').pathname;}catch(_){socket.destroy();return;}
    if(pathname!=='/multiplayer'||!sameOrigin(req)||wss.clients.size>=16){socket.destroy();return;}
    wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws));
  });
  wss.on('connection',ws=>{
    const peer={ws,player:null,windowAt:Date.now(),count:0,helloTimer:null};
    ws.isAlive=true;ws.on('pong',()=>{ws.isAlive=true;});
    peer.helloTimer=setTimeout(()=>{if(!peer.player)ws.close(1008,'hello_timeout');},8000);
    peer.helloTimer.unref();
    ws.on('message',(data,isBinary)=>{
      const now=Date.now();
      if(now-peer.windowAt>=1000){peer.windowAt=now;peer.count=0;}
      if(++peer.count>60){error(ws,'rate','消息过于频繁。',true);return;}
      if(isBinary){error(ws,'format','消息格式不正确。',true);return;}
      let msg;try{msg=JSON.parse(data.toString());}catch(_){error(ws,'format','消息格式不正确。',true);return;}
      if(!msg||typeof msg!=='object'||Array.isArray(msg)){error(ws,'format','消息格式不正确。',true);return;}
      message(peer,msg);
    });
    ws.on('close',()=>{
      clearTimeout(peer.helloTimer);
      const p=peer.player;
      if(!p||!room||room.players.get(p.id)!==p||p.ws!==ws)return;
      p.ws=null;p.pose=null;p.ready=false;
      if(room.sim)room.sim.pose(p.id,null);
      chooseHost();sendState();sendSimulation();
      p.timer=setTimeout(()=>{if(!p.ws)removePlayer(p);},graceMs);p.timer.unref();
    });
    ws.on('error',()=>{});
  });

  const heartbeat=setInterval(()=>{
    for(const ws of wss.clients){
      if(ws.readyState!==WebSocket.OPEN)continue;
      if(!ws.isAlive){ws.terminate();continue;}
      ws.isAlive=false;ws.ping();
    }
  },10000);
  heartbeat.unref();
  const simulation=setInterval(simulationTick,50);simulation.unref();

  function close(){
    clearInterval(heartbeat);
    clearInterval(simulation);
    if(room)for(const p of room.players.values())clearTimeout(p.timer);
    for(const ws of wss.clients)ws.terminate();
    wss.close();
    return new Promise(resolve=>server.close(()=>resolve()));
  }
  return {server,close};
}

function cli(){
  const args=process.argv.slice(2);let host='127.0.0.1',port=8765;
  for(let i=0;i<args.length;i++){
    if(args[i]==='--host'&&args[i+1])host=args[++i];
    else if(args[i]==='--port'&&args[i+1])port=Number(args[++i]);
    else{console.error('用法：npm run host -- --host <本机地址> --port <端口>');process.exitCode=2;return;}
  }
  if(!Number.isInteger(port)||port<1||port>65535){console.error('端口须为 1–65535。');process.exitCode=2;return;}
  const app=createHostServer();
  app.server.on('error',err=>{console.error('房间服务启动失败：'+err.message);process.exitCode=1;});
  app.server.listen(port,host,()=>console.log('共享探索原型已启动：http://'+host+':'+port+'/\n已共享时间、门、搜索和物品；剧情与危险尚未统一。'));
  process.on('SIGINT',()=>app.close().then(()=>process.exit(0)));
  process.on('SIGTERM',()=>app.close().then(()=>process.exit(0)));
}

if(require.main===module)cli();
module.exports={createHostServer,VERSION,validPose,cleanName};
