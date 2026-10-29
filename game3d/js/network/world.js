/* 联机世界的浏览器投影；物品归属与抽奖只接收房主确认。 */
'use strict';
var Coop=(function(){
  var api={world:null,self:null,pending:Object.create(null),lastResult:null};
  var nextSeq=1,clock=null,clockAt=0,worldRevision=-1,selfRevision=-1;
  function active(){return typeof Multiplayer!=='undefined'&&Multiplayer.playing;}
  function ready(){return active()&&!Multiplayer.waitingForScene;}
  function persist(){if(typeof Multiplayer!=='undefined'&&Multiplayer.persist)Multiplayer.persist();}
  function persistence(){return {epoch:api.world&&api.world.epoch,nextSeq:nextSeq,pending:Object.values(api.pending)};}
  function restore(saved){
    if(!saved||!Array.isArray(saved.pending))return;
    nextSeq=Number.isSafeInteger(saved.nextSeq)?Math.max(1,saved.nextSeq):1;
    saved.pending.slice(0,32).forEach(function(op){
      if(op&&Number.isSafeInteger(op.seq)&&op.seq>0&&typeof op.action==='string')api.pending[op.seq]=op;
    });
  }
  function reset(){
    api.world=null;api.self=null;api.pending=Object.create(null);api.lastResult=null;
    nextSeq=1;clock=null;clockAt=0;worldRevision=-1;selfRevision=-1;
    Engine.worldItemsClear();
  }
  function receiveClock(data){
    if(!data||!Number.isFinite(data.elapsed)||(clock&&data.elapsed<clock.elapsed))return;
    clock=data;clockAt=performance.now();syncClock();
  }
  function currentTime(){
    if(!clock)return null;
    var seconds=Multiplayer.connected&&!clock.paused?Math.min(.5,Math.max(0,(performance.now()-clockAt)/1000)):0;
    var config={schedule:SCHED,slowStart:BEAST_T0,slowEnd:BEAST_T1,slowRate:BEAST_RATE,dayAt:LIGHTS_OUT+10};
    var time=SharedClock.advance(clock,seconds,config);
    time.elapsed=clock.elapsed+seconds;return time;
  }
  function syncClock(){
    if(!ready())return;
    var time=currentTime();if(!time)return;
    S.tsec=time.tsec;S.day=time.day;
    if(api.self){
      S.pillT=Math.max(0,api.self.effects.pillUntil-time.elapsed);
      S.snackT=Math.max(0,api.self.effects.snackUntil-time.elapsed);
    }
  }
  function applyWorld(){
    if(!ready()||!api.world)return;
    var next=Object.create(null),changed=false,prefix=S.room+':';
    api.world.doors.forEach(function(key){next[key]=1;});
    Object.keys(next).concat(Object.keys(OPENDOORS)).forEach(function(k){
      if(k.indexOf(prefix)===0&&!!next[k]!==!!OPENDOORS[k])changed=true;
    });
    OPENDOORS=next;
    if(changed&&S.mode==='in')roomDoorRefresh(INTERIORS[S.room]);
    RT.deskUsed={};RT.pendingLoot={};
    api.world.containers.forEach(function(c){
      if(c.fixed)return;
      if(c.taken)RT.deskUsed[c.key]=1;
      else if(c.type)RT.pendingLoot[c.key]=c.type;
    });
    Engine.worldItems(api.world.drops);
    syncClock();
  }
  function applySelf(){
    if(!ready()||!api.self)return;
    var bag=api.self.inventory.map(function(item){return item.type;});
    if(JSON.stringify(bag)!==JSON.stringify(S.bag)){
      S.bag=bag;
      S.hot=S.hot.map(function(type){return bag.indexOf(type)>=0?type:null;});
      S.bagSel=Math.min(S.bagSel,Math.max(0,bag.length-1));
      syncUseState();bagChanged();
    }
    var job=api.self.search;
    if(job)SEARCH.job={network:true,room:job.zone,c:job.c,r:job.r,x:job.x,y:job.y,until:job.until,dur:job.duration,t:0};
    else if(SEARCH.job&&SEARCH.job.network){
      SEARCH.job=null;var ring=document.getElementById('searchring');if(ring)ring.style.display='none';
    }
    syncClock();
  }
  function receiveWorld(data){
    if(!data)return;
    if(api.world&&api.world.epoch!==data.epoch)reset();
    receiveClock(data.clock);
    if(data.revision<worldRevision)return;
    worldRevision=data.revision;api.world=data;applyWorld();
  }
  function receiveSelf(data){
    if(!data)return;
    nextSeq=Math.max(nextSeq,data.nextSeq);
    if(data.revision<selfRevision)return;
    selfRevision=data.revision;api.self=data;applySelf();persist();
  }
  function request(action,fields){
    if(!ready()||!Multiplayer.connected||!api.world){toast('连接尚未恢复，暂时无法操作');return false;}
    if(Object.keys(api.pending).length>=32){toast('正在等待房主确认，请稍后');return false;}
    var op=Object.assign({type:'op',epoch:api.world.epoch,seq:nextSeq++,action:action},fields||{});
    api.pending[op.seq]=op;persist();
    Multiplayer.sendPose();Multiplayer.send(op);return true;
  }
  function receiveResult(msg){
    var pending=api.pending[msg.seq];delete api.pending[msg.seq];
    receiveWorld(msg.world);receiveSelf(msg.self);api.lastResult=msg;persist();
    if(pending&&msg.text)toast(msg.text);
  }
  function resend(){
    if(!ready()||!Multiplayer.connected)return;
    Multiplayer.sendPose();
    Object.values(api.pending).sort(function(a,b){return a.seq-b.seq;}).forEach(function(op){
      if(api.world&&op.epoch===api.world.epoch)Multiplayer.send(op);
      else delete api.pending[op.seq];
    });
    persist();
  }
  function entered(){applyWorld();applySelf();resend();}
  function item(type){
    if(!api.self)return null;
    return api.self.inventory.find(function(i){
      return i.type===type&&!Object.values(api.pending).some(function(op){return op.itemId===i.id&&op.action!=='pickup';});
    })||null;
  }
  function consume(type){
    var i=item(type);return i?request('consume',{itemId:i.id}):false;
  }
  function drop(type){
    var i=item(type);if(i)request('drop',{itemId:i.id});
  }
  function use(type){
    if(type==='pill'||type==='snack'){
      var i=item(type);if(i)request('use',{itemId:i.id});return true;
    }
    if(type==='coin'||type==='leave'){
      toast('投币和请假尚未接入共享规则；可以丢下物品交给队友。');return true;
    }
    return false;
  }
  function target(action,c,r){return request(action,{zone:S.room,c:c,r:r});}
  function handleHit(hit,room){
    if(!hit)return false;
    if(hit.ch==='='){target('door',hit.c,hit.r);return true;}
    if(['d','f','R','q'].indexOf(hit.ch)>=0){target('search',hit.c,hit.r);return true;}
    if(SharedLoot.fixed(room,hit.ch)){target('claim',hit.c,hit.r);return true;}
    if(FAC_CD[hit.ch]!==undefined||['U','D','c','V','X','M'].indexOf(hit.ch)>=0||
      (room.host==='canteen'&&(hit.ch==='k'||hit.ch==='t'))){
      toast('这处设施尚未接入共享规则');return true;
    }
    return false;
  }
  function nearestDrop(){
    if(!ready()||!api.world||S.dead||HIDE.on)return null;
    var zone=S.mode==='out'?'out':S.room,best=null,dist=24;
    api.world.drops.forEach(function(d){
      if(d.zone!==zone)return;
      var distance=Math.hypot(d.x-S.x,d.y-S.y);
      if(distance<dist&&(distance<5||angDiff(Math.atan2(d.y-S.y,d.x-S.x),S.ang)<1.2)){dist=distance;best=d;}
    });
    return best;
  }
  function pickup(){var d=nearestDrop();if(!d)return false;request('pickup',{itemId:d.id});return true;}
  function searchTick(){
    var j=SEARCH.job;if(!j||!j.network)return;
    var t=currentTime(),ring=document.getElementById('searchring');
    if(ring){ring.style.display='block';ring.style.setProperty('--p',t?Math.min(.99,1-(j.until-t.elapsed)/j.dur):0);}
  }
  function cancelSearch(){
    if(ready()&&api.self&&api.self.search)request('cancel_search');
  }
  function disconnected(){
    if(SEARCH.job&&SEARCH.job.network){
      SEARCH.job=null;var ring=document.getElementById('searchring');if(ring)ring.style.display='none';
    }
  }
  function tick(dt,zone,waiting){
    syncClock();searchTick();Engine.worldItemsTick(zone,waiting);
  }
  api.reset=reset;api.restore=restore;api.persistence=persistence;api.receiveWorld=receiveWorld;
  api.receiveSelf=receiveSelf;api.receiveClock=receiveClock;api.receiveResult=receiveResult;
  api.entered=entered;api.resend=resend;api.request=request;api.syncClock=syncClock;api.item=item;
  api.consume=consume;api.drop=drop;api.use=use;api.handleHit=handleHit;api.target=target;
  api.nearestDrop=nearestDrop;api.pickup=pickup;api.searchTick=searchTick;api.cancelSearch=cancelSearch;api.tick=tick;
  api.disconnected=disconnected;
  return api;
})();
