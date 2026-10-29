'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {once}=require('node:events');
const WebSocket=require('ws');
const {createHostServer,VERSION}=require('../../server');

function messages(ws){
  const queued=[],pending=[];
  ws.on('message',data=>{
    const msg=JSON.parse(data.toString());
    const i=pending.findIndex(w=>w.check(msg));
    if(i>=0){const w=pending.splice(i,1)[0];clearTimeout(w.timer);w.resolve(msg);}
    else queued.push(msg);
  });
  return {
    send:msg=>ws.send(JSON.stringify(msg)),
    wait:(type,predicate=()=>true,timeout=2500)=>new Promise((resolve,reject)=>{
      const check=msg=>msg.type===type&&predicate(msg);
      const i=queued.findIndex(check);
      if(i>=0){resolve(queued.splice(i,1)[0]);return;}
      const waiter={check,resolve,timer:null};
      waiter.timer=setTimeout(()=>{
        const at=pending.indexOf(waiter);if(at>=0)pending.splice(at,1);
        reject(new Error('等待消息超时：'+type));
      },timeout);
      pending.push(waiter);
    })
  };
}

async function start(t,options={}){
  const app=createHostServer(options);
  app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
  t.after(()=>app.close());
  const origin='http://127.0.0.1:'+app.server.address().port;
  async function connect(){
    const ws=new WebSocket(origin.replace('http:','ws:')+'/multiplayer',{origin});
    const m=messages(ws);await once(ws,'open');return {ws,m};
  }
  return {origin,connect};
}
async function hello(client,action,extra={}){
  client.m.send({type:'hello',version:VERSION,action,...extra});
  return client.m.wait('welcome');
}

test('只提供游戏资源，拒绝目录、敏感文件和非同源连接',async t=>{
  const {origin}=await start(t);
  for(const url of ['/','/game3d/js/main.js','/shared/simulation/physics.js','/shared/content/room-bounds.js','/wiki/']){
    const res=await fetch(origin+url);assert.equal(res.status,200,url);
  }
  for(const url of ['/.git/config','/server/index.js','/package.json','/docs/README.md','/game3d/js/%2e%2e/%2e%2e/.git/config']){
    const res=await fetch(origin+url);assert.equal(res.status,404,url);
  }
  assert.equal((await fetch(origin+'/',{method:'POST'})).status,405);
  const info=await (await fetch(origin+'/api/multiplayer')).json();
  assert.equal(info.prototype,true);assert.equal(info.version,VERSION);
  const ws=new WebSocket(origin.replace('http:','ws:')+'/multiplayer',{origin:'https://example.invalid'});
  await assert.rejects(once(ws,'open'));
});

test('四人房间的准备、开始、位置广播和断线重连',async t=>{
  const {connect}=await start(t,{graceMs:1200});
  const host=await connect(),h=await hello(host,'create',{name:'房主',difficulty:'easy'});
  assert.match(h.room.code,/^[A-Z2-9]{6}$/);
  const wrong=await connect();wrong.m.send({type:'hello',version:VERSION,action:'join',name:'访客',code:'WRONG'});
  assert.equal((await wrong.m.wait('error')).code,'room_not_found');
  const peers=[];
  for(let i=1;i<=3;i++){
    const p=await connect(),w=await hello(p,'join',{name:'队友'+i,code:h.room.code});
    peers.push({...p,w});
  }
  const extra=await connect();extra.m.send({type:'hello',version:VERSION,action:'join',name:'第五人',code:h.room.code});
  assert.equal((await extra.m.wait('error')).code,'full');
  host.m.send({type:'start'});assert.equal((await host.m.wait('error')).code,'not_ready');
  host.m.send({type:'ready',ready:true});
  for(const p of peers)p.m.send({type:'ready',ready:true});
  await host.m.wait('state',m=>m.room.players.length===4&&m.room.players.every(p=>p.ready));
  host.m.send({type:'start'});
  assert.equal((await host.m.wait('started')).difficulty,'easy');
  for(const p of peers)await p.m.wait('started');
  const pose={seq:1,zone:'teach1',x:900,y:1800,angle:1,floor:0,seated:false,moving:true,visible:true};
  peers[0].m.send({type:'pose',id:'伪造的角色',pose});
  const got=await host.m.wait('pose',m=>m.id===peers[0].w.selfId);
  assert.deepEqual(got.pose,pose);
  peers[0].m.send({type:'pose',pose:{...pose,seq:2,zone:'not-a-room'}});
  await assert.rejects(host.m.wait('pose',m=>m.id===peers[0].w.selfId&&m.pose.seq===2,120));
  peers[0].m.send({type:'pose',pose:{...pose,seq:3,x:99999}});
  await assert.rejects(host.m.wait('pose',m=>m.id===peers[0].w.selfId&&m.pose.seq===3,120));
  peers[0].ws.terminate();
  await host.m.wait('state',m=>m.room.players.some(p=>p.id===peers[0].w.selfId&&!p.connected));
  const again=await connect(),restored=await hello(again,'resume',{token:peers[0].w.token});
  assert.equal(restored.selfId,peers[0].w.selfId);
  assert.equal(restored.room.phase,'playing');
  assert.equal(restored.room.players.length,4);
  again.m.send({type:'pose',pose:{...pose,seq:0}});
  assert.equal((await host.m.wait('pose',m=>m.id===restored.selfId&&m.pose.seq===0)).pose.zone,'teach1');
});

test('断线保留名额，超时后释放；房主离开后转交管理权',async t=>{
  const {connect}=await start(t,{graceMs:120});
  const host=await connect(),h=await hello(host,'create',{name:'房主',difficulty:'hard'});
  const guest=await connect(),g=await hello(guest,'join',{name:'队友',code:h.room.code});
  host.ws.terminate();
  await guest.m.wait('state',m=>m.room.hostId===g.selfId&&m.room.players.length===2);
  await guest.m.wait('state',m=>m.room.players.length===1);
  const replacement=await connect(),w=await hello(replacement,'join',{name:'新队友',code:h.room.code});
  assert.equal(w.room.players.length,2);
  assert.equal(w.room.hostId,g.selfId);
});

test('使用恢复凭证替换尚未检测到断开的旧连接',async t=>{
  const {connect}=await start(t);
  const first=await connect(),w=await hello(first,'create',{name:'房主',difficulty:'easy'});
  const closed=once(first.ws,'close');
  const replacement=await connect(),resumed=await hello(replacement,'resume',{token:w.token});
  assert.equal(resumed.selfId,w.selfId);
  assert.equal(resumed.room.players.length,1);
  const [code]=await closed;
  assert.equal(code,4001);
  replacement.m.send({type:'ready',ready:true});
  await replacement.m.wait('state',m=>m.room.players.length===1&&m.room.players[0].ready);
});
