/* 共享探索状态。这里只结算时间、门、搜索和物品归属；移动与危险仍待迁移。 */
'use strict';
const crypto=require('node:crypto');
const Clock=require('../shared/simulation/clock');
const Loot=require('../shared/content/loot');
const world=require('./world');

const LOCKS=world.locks;
const SEARCHABLE=new Set(['d','f','R','q']);
const CAPACITY=8, SEARCH_SECONDS=0.8;
class Session{
  constructor(options={}){
    this.epoch=crypto.randomUUID();this.revision=0;this.elapsed=0;this.paused=false;
    this.clock={day:1,tsec:700};this.players=new Map();this.items=new Map();
    this.sources=new Map();this.doors=new Set();this.jobs=new Map();this.drops=new Map();
    this.flags={hwTaken:false};this.random=options.random||(()=>crypto.randomInt(0,0x100000000)/0x100000000);
  }
  createItem(type){const item={id:crypto.randomUUID(),type};this.items.set(item.id,item);return item.id;}
  addPlayer(id){
    this.players.set(id,{id,inventory:[this.createItem('card')],pose:null,revision:0,search:null,
      effects:{pillUntil:0,snackUntil:0},lastSeq:0,results:new Map(),notices:[]});
  }
  types(p){return p.inventory.map(id=>this.items.get(id).type);}
  self(id){
    const p=this.players.get(id);
    return {revision:p.revision,nextSeq:p.lastSeq+1,inventory:p.inventory.map(id=>({...this.items.get(id)})),
      effects:{...p.effects},search:p.search?{key:p.search.key,zone:p.search.zone,c:p.search.c,r:p.search.r,
        x:p.search.x,y:p.search.y,until:p.search.until,duration:SEARCH_SECONDS}:null};
  }
  time(){return {...this.clock,elapsed:this.elapsed,paused:this.paused};}
  snapshot(){
    return {epoch:this.epoch,revision:this.revision,clock:this.time(),doors:Array.from(this.doors),
      containers:Array.from(this.sources.values()).map(s=>({key:s.key,type:s.type,taken:!s.itemId,fixed:s.fixed})),
      drops:Array.from(this.drops.values()).map(d=>({...d,type:this.items.get(d.id).type}))};
  }
  touch(p){p.revision++;}
  notice(p,text){p.notices.push(text);this.touch(p);}
  drainNotices(id){return this.players.get(id).notices.splice(0);}
  cancelSearch(p,text){
    if(!p.search)return;
    this.jobs.delete(p.search.key);p.search=null;this.touch(p);
    if(text)this.notice(p,text);
  }
  pose(id,pose){
    const p=this.players.get(id);if(!p)return;
    p.pose=pose;
    if(p.search&&(!pose||!pose.active||!pose.visible||pose.zone!==p.search.zone||
      Math.hypot(pose.x-p.search.x,pose.y-p.search.y)>5))this.cancelSearch(p,'翻找已中断。');
  }
  removePlayer(id,lastPose){
    const p=this.players.get(id);if(!p)return;
    this.cancelSearch(p);
    const r=world.rooms.teach1;
    const at=lastPose&&world.contains(lastPose.zone,lastPose.x,lastPose.y)&&Math.abs(lastPose.floor)<0.1?
      lastPose:{zone:'teach1',x:r.ox+45.5*r.tw,y:r.oy+18.5*r.th,floor:0};
    for(const itemId of p.inventory)this.drops.set(itemId,{id:itemId,zone:at.zone,x:at.x,y:at.y,floor:0});
    if(p.inventory.length)this.revision++;
    this.players.delete(id);
  }
  advance(seconds,online){
    this.paused=!online;
    if(!online||seconds<=0)return;
    this.elapsed+=seconds;this.clock=Clock.advance(this.clock,seconds,world.clockConfig);
    for(const p of this.players.values()){
      if(p.search&&this.elapsed+1e-8>=p.search.until)this.finishSearch(p);
    }
  }
  reachable(p,zone,x,y){
    const a=p.pose;
    if(!a||!a.visible||a.zone!==zone||Math.abs(a.floor)>0.1||Math.hypot(a.x-x,a.y-y)>24)return false;
    const r=world.rooms[zone];if(!r)return true;
    const tc=Math.floor((x-r.ox)/r.tw),tr=Math.floor((y-r.oy)/r.th);
    const n=Math.ceil(Math.hypot(a.x-x,a.y-y)/3);
    for(let i=1;i<n;i++){
      const c=Math.floor((a.x+(x-a.x)*i/n-r.ox)/r.tw),row=Math.floor((a.y+(y-a.y)*i/n-r.oy)/r.th);
      if(c===tc&&row===tr)continue;
      const ch=r.grid[row]&&r.grid[row][c];
      if(ch==='#'||(ch==='='&&!this.doors.has(zone+':'+c+':'+row)))return false;
    }
    return true;
  }
  target(p,msg){
    const r=world.rooms[msg.zone];
    if(!r||!Number.isInteger(msg.c)||!Number.isInteger(msg.r)||msg.c<0||msg.c>=r.cols||msg.r<0||msg.r>=r.rows)return null;
    const x=r.ox+(msg.c+.5)*r.tw,y=r.oy+(msg.r+.5)*r.th;
    return this.reachable(p,msg.zone,x,y)?{room:r,ch:r.grid[msg.r][msg.c],key:msg.zone+':'+msg.c+':'+msg.r,x,y}:null;
  }
  canTake(p,type){
    if(p.inventory.length>=CAPACITY)return '背包装不下了，物品仍留在原处。';
    if(this.types(p).includes(type))return '你已经带着这种物品，先留给队友。';
    return null;
  }
  takeSource(p,s){
    if(!s.itemId)return {ok:false,code:'empty',text:'这里已经翻过了。'};
    const problem=this.canTake(p,s.type);
    if(problem)return {ok:false,code:'bag',text:problem};
    p.inventory.push(s.itemId);s.itemId=null;this.revision++;this.touch(p);
    return {ok:true,code:'taken',text:'获得「'+world.items[s.type].n+'」。'};
  }
  finishSearch(p){
    const j=p.search;this.cancelSearch(p);
    let s=this.sources.get(j.key);
    if(!s){
      const r=world.rooms[j.zone],type=Loot.search(r,r.grid[j.r][j.c],j.r,this.types(p),this.flags,this.random);
      s={key:j.key,type,itemId:type?this.createItem(type):null,fixed:false};
      this.sources.set(j.key,s);this.revision++;
    }
    const result=s.itemId?this.takeSource(p,s):{text:'空的。这里已经翻过了。'};
    this.notice(p,result.text);
  }
  perform(p,msg){
    const fail=(code,text)=>({ok:false,code,text}),ok=text=>({ok:true,code:'ok',text});
    if(!p.pose||!p.pose.visible)return fail('inactive','角色当前无法操作。');
    if(msg.action==='cancel_search'){this.cancelSearch(p);return ok('已停止翻找。');}
    if(msg.action==='door'||msg.action==='search'||msg.action==='claim'){
      const t=this.target(p,msg);if(!t)return fail('distance','请靠近目标，隔墙无法操作。');
      if(!p.pose.active)return fail('inactive','请关闭面板后操作。');
      if(msg.action==='door'){
        if(t.ch!=='=')return fail('target','这里不是门。');
        if(this.doors.has(t.key))return ok('门已经开着。');
        if(LOCKS[t.key]&&!this.types(p).includes(LOCKS[t.key]))return fail('locked','门锁着，需要机房钥匙。');
        this.doors.add(t.key);this.revision++;return ok('门开了。');
      }
      if(msg.action==='claim'){
        const type=Loot.fixed(t.room,t.ch);if(!type)return fail('target','这处设施还未接入共享物品。');
        const problem=this.canTake(p,type);if(problem)return fail('bag',problem);
        let s=this.sources.get(t.key);
        if(!s){s={key:t.key,type,itemId:this.createItem(type),fixed:true};this.sources.set(t.key,s);this.revision++;}
        return this.takeSource(p,s);
      }
      if(!SEARCHABLE.has(t.ch))return fail('target','这里不能翻找。');
      if(p.search)return fail('searching','你正在翻找另一处。');
      if(this.jobs.has(t.key))return fail('busy','队友正在翻找这里。');
      const s=this.sources.get(t.key);
      if(s&&!s.itemId)return fail('empty','这里已经翻过了。');
      if(p.inventory.length>=CAPACITY)return fail('bag','背包已满，先腾出一个空位。');
      if(s&&this.types(p).includes(s.type))return fail('bag','你已经带着这种物品，先留给队友。');
      p.search={key:t.key,zone:msg.zone,c:msg.c,r:msg.r,x:p.pose.x,y:p.pose.y,until:this.elapsed+SEARCH_SECONDS};
      this.jobs.set(t.key,p.id);this.touch(p);return ok('正在翻找……');
    }
    if(msg.action==='drop'||msg.action==='consume'||msg.action==='use'){
      const i=p.inventory.indexOf(msg.itemId);
      if(i<0)return fail('ownership','物品已不在你的背包里。');
      const item=this.items.get(msg.itemId);
      if(msg.action==='drop'){
        if(Math.abs(p.pose.floor)>0.1)return fail('floor','请回到平地再放下物品。');
        this.drops.set(item.id,{id:item.id,zone:p.pose.zone,x:p.pose.x,y:p.pose.y,floor:0});
        p.inventory.splice(i,1);this.touch(p);this.revision++;return ok('已放下「'+world.items[item.type].n+'」，队友可以拾取。');
      }
      if(msg.action==='use'){
        if(item.type!=='pill'&&item.type!=='snack')return fail('unsupported','这种消耗品还未接入联机。');
        p.effects[item.type==='pill'?'pillUntil':'snackUntil']=this.elapsed+30;
      }
      p.inventory.splice(i,1);this.items.delete(item.id);this.touch(p);
      return ok(msg.action==='use'?'已使用「'+world.items[item.type].n+'」。':'物品已消耗。');
    }
    if(msg.action==='pickup'){
      const drop=this.drops.get(msg.itemId);
      if(!drop)return fail('taken','物品已被拿走。');
      if(!this.reachable(p,drop.zone,drop.x,drop.y))return fail('distance','请靠近地上的物品。');
      const item=this.items.get(drop.id),problem=this.canTake(p,item.type);
      if(problem)return fail('bag',problem);
      p.inventory.push(drop.id);this.drops.delete(drop.id);this.revision++;this.touch(p);
      return ok('拾取「'+world.items[item.type].n+'」。');
    }
    return fail('action','无法识别的操作。');
  }
  act(id,msg){
    const p=this.players.get(id),seq=msg.seq;
    if(msg.epoch!==this.epoch)return {seq,ok:false,code:'epoch',text:'房间状态已变化，请重新连接。'};
    if(!Number.isSafeInteger(seq)||seq<1)return {seq:null,ok:false,code:'sequence',text:'操作序号不正确。'};
    const fingerprint=JSON.stringify([msg.action,msg.zone,msg.c,msg.r,msg.itemId]);
    if(p.results.has(seq)){
      const old=p.results.get(seq);
      return old.fingerprint===fingerprint?old.result:{seq,ok:false,code:'sequence',text:'操作序号已被使用。'};
    }
    if(seq<=p.lastSeq)return {seq,ok:false,code:'old_operation',text:'旧操作已失效，请刷新状态。'};
    p.lastSeq=seq;this.touch(p);
    const result={seq,...this.perform(p,msg)};
    p.results.set(seq,{fingerprint,result});
    if(p.results.size>256)p.results.delete(p.results.keys().next().value);
    return result;
  }
}
module.exports={Session,SEARCH_SECONDS,CAPACITY};
