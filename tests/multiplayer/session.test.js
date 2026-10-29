'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {Session}=require('../../server/session');
const world=require('../../server/world');
const Clock=require('../../shared/simulation/clock');

function setup(random=()=>.3){
  const sim=new Session({random});sim.addPlayer('a');sim.addPlayer('b');let seq={a:0,b:0};
  const act=(id,action,fields={})=>sim.act(id,{epoch:sim.epoch,seq:++seq[id],action,...fields});
  return {sim,act};
}
function target(zone,ch){
  const room=world.rooms[zone];
  for(let r=1;r<room.rows-1;r++)for(let c=1;c<room.cols-1;c++)if(room.grid[r][c]===ch){
    for(const [dc,dr] of [[0,1],[0,-1],[1,0],[-1,0]])if(room.grid[r+dr][c+dc]==='.'){
      return {zone,c,r,pose:{zone,x:room.ox+(c+dc+.5)*room.tw,y:room.oy+(r+dr+.5)*room.th,
        floor:0,visible:true,active:true}};
    }
  }
  throw new Error('没有可用目标 '+zone+' '+ch);
}
function at(sim,id,t){sim.pose(id,{...t.pose});return {zone:t.zone,c:t.c,r:t.r};}
function give(sim,id,type){const item=sim.createItem(type);sim.players.get(id).inventory.push(item);return item;}

test('共享时钟保留慢速十秒窗口，分步结果一致，跨日和全员离线不漂移',()=>{
  const c=world.clockConfig,start={day:1,tsec:c.slowStart};
  const end=Clock.advance(start,15,c);
  assert.ok(Math.abs(end.tsec-c.slowEnd)<1e-8);
  let stepped={day:1,tsec:700};
  for(let i=0;i<6000;i++)stepped=Clock.advance(stepped,1/60,c);
  const direct=Clock.advance({day:1,tsec:700},100,c);
  assert.ok(Math.abs(stepped.tsec-direct.tsec)<1e-6);assert.equal(stepped.day,direct.day);
  const night=Clock.advance({day:1,tsec:1349},40,c);
  assert.equal(night.day,2);assert.ok(night.tsec<500);
  const {sim}=setup();sim.advance(10,true);const saved=sim.time();sim.advance(600,false);
  assert.equal(sim.time().tsec,saved.tsec);assert.equal(sim.time().elapsed,saved.elapsed);assert.equal(sim.time().paused,true);
});

test('两人同时搜索只产生一件物品；读条只能由房主完成',()=>{
  const {sim,act}=setup(),t=target('lab3','R'),fields=at(sim,'a',t);at(sim,'b',t);
  assert.equal(act('a','search',fields).ok,true);
  assert.equal(act('b','search',fields).code,'busy');
  sim.advance(.79,true);assert.equal(sim.types(sim.players.get('a')).includes('usb'),false);
  sim.advance(.02,true);assert.equal(sim.types(sim.players.get('a')).includes('usb'),true);
  assert.equal(act('b','search',fields).code,'empty');
  assert.equal(Array.from(sim.items.values()).filter(i=>i.type==='usb').length,1);
});

test('走开、切区或打开菜单会取消搜索，未完成时不生成抽奖结果',()=>{
  for(const reason of ['move','zone','menu']){
    const {sim,act}=setup(),t=target('lab3','R'),f=at(sim,'a',t);at(sim,'b',t);
    act('a','search',f);sim.advance(.4,true);
    const p={...t.pose};
    if(reason==='move')p.x+=6;
    if(reason==='zone')p.zone='lab1';
    if(reason==='menu')p.active=false;
    sim.pose('a',p);sim.advance(1,true);
    assert.equal(sim.sources.size,0);assert.equal(sim.players.get('a').search,null);
    assert.equal(act('b','search',f).ok,true);
  }
});

test('满包和同类物品留在原容器，重试不会重新抽奖',()=>{
  let rolls=0;const {sim,act}=setup(()=>{rolls++;return .3;});
  const t=target('lab3','f'),f=at(sim,'a',t);at(sim,'b',t);
  give(sim,'a','battery');act('a','search',f);sim.advance(1,true);
  const s=sim.sources.get(t.zone+':'+t.c+':'+t.r),item=s.itemId;
  assert.equal(s.type,'battery');assert.ok(item);
  assert.equal(act('a','search',f).code,'bag');
  act('b','search',f);sim.advance(1,true);
  assert.ok(sim.players.get('b').inventory.includes(item));assert.equal(rolls,1);
  const other=target('teach1','d'),otherFields=at(sim,'a',other);
  for(const type of ['phone','chalk','torch','coin','pen','watch'])give(sim,'a',type);
  assert.equal(act('a','search',otherFields).code,'bag');
  assert.equal(sim.sources.has(other.zone+':'+other.c+':'+other.r),false);
});

test('丢弃、竞争拾取和重发使用实例 ID，不复制物品或重复给予效果',()=>{
  const {sim,act}=setup(),t=target('lab3','R');at(sim,'a',t);at(sim,'b',t);
  const item=give(sim,'a','snack'),drop={epoch:sim.epoch,seq:1,action:'drop',itemId:item};
  assert.equal(sim.act('a',drop).ok,true);assert.equal(sim.act('a',drop).ok,true);
  assert.equal(sim.drops.size,1);
  assert.equal(act('b','consume',{itemId:item}).code,'ownership');
  assert.equal(act('b','pickup',{itemId:item}).ok,true);
  assert.equal(sim.act('a',{...drop,seq:2,action:'pickup'}).code,'taken');
  const use={epoch:sim.epoch,seq:3,action:'use',itemId:item};
  assert.equal(sim.act('b',use).ok,true);
  sim.advance(31,true);assert.equal(sim.act('b',use).ok,true);
  assert.equal(sim.players.get('b').effects.snackUntil,30);
  assert.equal(sim.items.has(item),false);
  assert.equal(sim.act('b',{...use,seq:4}).code,'ownership');
});

test('开锁由房主检查钥匙与距离；错误目标和旧世界操作不改变门',()=>{
  const {sim,act}=setup(),r=world.rooms.lab3,t={zone:'lab3',c:41,r:15,
    pose:{zone:'lab3',x:r.ox+41.5*r.tw,y:r.oy+16.5*r.th,floor:0,visible:true,active:true}};
  const f=at(sim,'a',t);
  assert.equal(act('a','door',f).code,'locked');
  give(sim,'a','roomkey');assert.equal(act('a','door',f).ok,true);
  assert.ok(sim.doors.has('lab3:41:15'));
  const before=sim.revision;
  assert.equal(sim.act('a',{epoch:'previous',seq:100,action:'door',...f}).code,'epoch');
  assert.equal(sim.revision,before);
  assert.equal(act('a','door',{...f,c:-1}).code,'distance');
  sim.pose('a',{...t.pose,x:t.pose.x+100});
  assert.equal(act('a','door',f).code,'distance');
});

test('恢复凭证对应的背包独立；离开与名额回收保留队友可拾取的物品',()=>{
  const {sim}=setup(),t=target('lab3','R');at(sim,'a',t);
  const item=give(sim,'a','roomkey');
  sim.pose('a',null);
  assert.ok(sim.self('a').inventory.some(i=>i.id===item));
  assert.equal(sim.self('b').inventory.some(i=>i.id===item),false);
  sim.removePlayer('a',t.pose);
  assert.equal(sim.drops.get(item).zone,t.zone);
  assert.equal(sim.players.has('a'),false);
});

test('固定来源共享一次，交给队友后原处不再生成第二件',()=>{
  const {sim,act}=setup(),t=target('guard1','k'),f=at(sim,'a',t);at(sim,'b',t);
  assert.equal(act('a','claim',f).ok,true);
  const item=sim.self('a').inventory.find(i=>i.type==='torch').id;
  act('a','drop',{itemId:item});act('b','pickup',{itemId:item});
  assert.equal(act('a','claim',f).code,'empty');
  assert.equal(Array.from(sim.items.values()).filter(i=>i.type==='torch').length,1);
});

test('距离足够近也不能隔着教室墙搜索',()=>{
  const {sim,act}=setup(),r=world.rooms.teach1;
  assert.equal(r.grid[12][11],'d');assert.equal(r.grid[13][13],'.');
  sim.pose('a',{zone:r.id,x:r.ox+13.5*r.tw,y:r.oy+13.5*r.th,floor:0,active:true,visible:true});
  assert.equal(act('a','search',{zone:r.id,c:11,r:12}).code,'distance');
  assert.equal(sim.sources.size,0);
});

test('同一序号不能改成另一操作，去重缓存淘汰后仍拒绝旧请求',()=>{
  const {sim}=setup(),t=target('lab3','R');at(sim,'a',t);
  const item=give(sim,'a','snack'),op={epoch:sim.epoch,seq:1,action:'use',itemId:item};
  assert.equal(sim.act('a',op).ok,true);
  assert.equal(sim.act('a',{...op,action:'drop'}).code,'sequence');
  for(let seq=2;seq<260;seq++)sim.act('a',{epoch:sim.epoch,seq,action:'cancel_search'});
  assert.equal(sim.act('a',op).code,'old_operation');
  assert.equal(sim.players.get('a').effects.snackUntil,30);
});
