/* Optional automated player. Loaded ONLY by video/playthrough.py, never by the game.
 * Reads the map and state; all actions go through the ordinary DOM input handlers.
 * No teleportation, clock acceleration, debug commands, granted items or ending calls.
 */
'use strict';
window.Pilot = (() => {
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const held = new Set(), log = [];
  const keys = {w:'KeyW',a:'KeyA',s:'KeyS',d:'KeyD',e:'KeyE',r:'KeyR',f:'KeyF',
    Shift:'ShiftLeft',Enter:'Enter',Escape:'Escape',Tab:'Tab',1:'Digit1',2:'Digit2',3:'Digit3'};
  let phase = '准备', failed = null, finished = false, started = performance.now(), sheltering=false;
  const angle = n => Math.atan2(Math.sin(n), Math.cos(n));
  function snapshot() {
    return {seconds:+((performance.now()-started)/1000).toFixed(2),phase,
      screen:S.screen,room:S.room,mode:S.mode,x:S.x,y:S.y,day:S.day,time:S.tsec,
      san:S.san,viol:S.viol,bag:S.bag.slice(),talent:S.talent,dead:S.dead,frameSeconds:dtG,
      anomaly:AN.active?AN.id:null,patrol:PAT.state,ending:RT.end||null,
      paused:PAUSE.on,choice:UI.chooseOpen,inputsAllowed:playerInputAllowed(),
      chase:RT.carChase?{...RT.carChase}:null,finished,failed};
  }
  function event(kind, detail) {
    const e=kind==='input'?{seconds:+((performance.now()-started)/1000).toFixed(3),kind,detail}:{...snapshot(),kind,detail};log.push(e);
    if(kind!=='input')console.log('PILOT '+JSON.stringify(e));
  }
  function chapter(text) {
    phase=text;document.getElementById('pilot-label').textContent='脚本操作 · 正常规则 ｜ '+text;
    event('chapter',text);
  }
  function key(k,down) {
    if(held.has(k)===down)return;
    document.body.dispatchEvent(new KeyboardEvent(down?'keydown':'keyup',
      {key:k,code:keys[k]||k,bubbles:true,cancelable:true}));
    if(down)held.add(k);else held.delete(k);
    event('input',{key:k,down});
  }
  function stop(){for(const k of [...held])key(k,false);}
  async function tap(k){key(k,true);await sleep(60);key(k,false);}
  function look(yaw,pitch=0){
    if(!playerInputAllowed())return;
    const sense=lookSensitivity(false), dx=Math.max(-35,Math.min(35,angle(yaw-S.ang)/(.0042*sense))),
      dy=Math.max(-35,Math.min(35,(S.pitch-pitch)/(.0042*sense)));
    // A short mouse drag uses the same path as a desktop player with an unlocked cursor.
    cv.dispatchEvent(new PointerEvent('pointerdown',{pointerId:91,pointerType:'mouse',button:0,buttons:1,clientX:400,clientY:250,bubbles:true}));
    window.dispatchEvent(new PointerEvent('pointermove',{pointerId:91,pointerType:'mouse',buttons:1,clientX:400+dx,clientY:250+dy,bubbles:true}));
    window.dispatchEvent(new PointerEvent('pointerup',{pointerId:91,pointerType:'mouse',button:0,buttons:0,bubbles:true}));
    if(Math.abs(dx)+Math.abs(dy)>.001)event('input',{drag:{dx,dy}});
  }
  function alive(){if(S.dead)throw Error('玩家死亡；保留失败录像，不修改状态续命');}
  async function face(x,y,pitch=0){
    stop();const end=performance.now()+7000;
    while(performance.now()<end){alive();const yaw=Math.atan2(y-S.y,x-S.x);look(yaw,pitch);
      if(Math.abs(angle(yaw-S.ang))<.025&&Math.abs(S.pitch-pitch)<.03)return;await sleep(60);}
    throw Error('无法转向：输入被界面阻挡');
  }
  function cells(chars,room=S.room){
    const R=INTERIORS[room],out=[];
    for(let r=0;r<R.rows;r++)for(let c=0;c<R.cols;c++)if(chars.includes(R.grid[r][c]))
      out.push({x:R.ox+(c+.5)*R.tw,y:R.oy+(r+.5)*R.th,c,r,ch:R.grid[r][c]});
    return out;
  }
  function distance(p){return Math.hypot(p.x-S.x,p.y-S.y);}
  function walkLineClear(target){
    const d=distance(target),n=Math.ceil(d/1.2);
    for(let i=1;i<=n;i++)if(Collision.depth(S.x+(target.x-S.x)*i/n,S.y+(target.y-S.y)*i/n,PRAD+.03)>1e-7)return false;
    return true;
  }
  function coverRects(){
    return OBJ.flatMap(o=>{
      let r=null;
      if(o.k==='link')r=[o.x,o.y,o.x+o.w,o.y+o.h];
      else if(o.open1f)r=[o.x,o.y+o.h,o.x+o.w,o.y+o.h+12];
      else if(o.id==='shed')r=[o.x-3,o.y-3,o.x+o.w+3,o.y+o.h+3];
      return r?[r.map(n=>n*SC)]:[];
    });
  }
  function coveredPoint(p,margin=0){return coverRects().some(r=>p.x>r[0]+margin&&p.x<r[2]-margin&&p.y>r[1]+margin&&p.y<r[3]-margin);}

  // A* on a private navigation copy. Closed, unlocked doors are planned through,
  // then opened with E. The live collision grid and OPENDOORS are never edited.
  function plan(target,radius=11,covered=false){
    const R=S.mode==='in'?INTERIORS[S.room]:null;
    const copy=R?{...R,grid:R.grid.map((row,r)=>Array.from(row,(ch,c)=>
      ch==='='&&(!doorLockNeed(R,c,r)||hasItem(doorLockNeed(R,c,r)))?'.':ch))}:null;
    const step=R?2.25:8,ox=R?R.ox:(BOUND.x0+4)*SC,oy=R?R.oy:(BOUND.y0+4)*SC;
    const cols=Math.ceil((R?R.w:(BOUND.x1-BOUND.x0-8)*SC)/step),rows=Math.ceil((R?R.h:(BOUND.y1-BOUND.y0-8)*SC)/step);
    const point=i=>({x:ox+(i%cols+.5)*step,y:oy+(Math.floor(i/cols)+.5)*step});
    const index=(x,y)=>Math.max(0,Math.min(rows-1,Math.floor((y-oy)/step)))*cols+Math.max(0,Math.min(cols-1,Math.floor((x-ox)/step)));
    const cache=new Map(),free=i=>{if(!cache.has(i)){const p=point(i);cache.set(i,Collision.depth(p.x,p.y,PRAD+.08,copy)<1e-7);}return cache.get(i);};
    const clear=(a,b)=>{const n=Math.ceil(Math.hypot(a.x-b.x,a.y-b.y)/1.4);for(let j=1;j<=n;j++)if(Collision.depth(a.x+(b.x-a.x)*j/n,a.y+(b.y-a.y)*j/n,PRAD+.04,copy)>1e-7)return false;return true;};
    const start=index(S.x,S.y),heap=[],cost=new Map([[start,0]]),prev=new Map();
    function push(i,f){let n=heap.length;heap.push([i,f]);while(n){const p=(n-1)>>1;if(heap[p][1]<=f)break;heap[n]=heap[p];n=p;}heap[n]=[i,f];}
    function pop(){const first=heap[0],last=heap.pop();if(heap.length){let n=0;while(n*2+1<heap.length){let c=n*2+1;if(c+1<heap.length&&heap[c+1][1]<heap[c][1])c++;if(heap[c][1]>=last[1])break;heap[n]=heap[c];n=c;}heap[n]=last;}return first[0];}
    push(start,0);const closed=new Set();let goal=null;
    while(heap.length){const i=pop();if(closed.has(i))continue;closed.add(i);const p=point(i);
      if(Math.hypot(p.x-target.x,p.y-target.y)<=radius&&free(i)&&(!covered||coveredPoint(p,6))){goal=i;break;}
      const x=i%cols,y=Math.floor(i/cols);
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        if(!dx&&!dy||x+dx<0||x+dx>=cols||y+dy<0||y+dy>=rows)continue;
        const j=i+dy*cols+dx;if(closed.has(j)||!free(j))continue;
        if(dx&&dy&&(!free(i+dx)||!free(i+dy*cols)))continue;
        const next=cost.get(i)+Math.hypot(dx,dy)*step;
        if(next>=(cost.get(j)??Infinity))continue;
        cost.set(j,next);prev.set(j,i);const q=point(j);push(j,next+Math.max(0,Math.hypot(q.x-target.x,q.y-target.y)-radius));
      }
    }
    if(goal===null)throw Error('没有可行步行路线 '+JSON.stringify({room:S.room,target,visited:closed.size}));
    const raw=[];for(let i=goal;i!==start;i=prev.get(i))raw.unshift(point(i));
    const path=[];let origin={x:S.x,y:S.y};
    for(let i=0;i<raw.length;){let j=i;while(j+1<raw.length&&clear(origin,raw[j+1]))j++;path.push(raw[j]);origin=raw[j];i=j+1;}
    return path;
  }

  async function defense(){
    alive();let handled=false;
    if(!sheltering&&AN.active&&AN.id==='rain'&&S.mode==='out'){
      stop();event('threat','暴雨：寻找遮蔽处');sheltering=true;
      try{
        if(!underCover()){
          const points=[];
          for(const r of coverRects()){
            for(let x=r[0]+8;x<r[2]-6;x+=8)for(let y=r[1]+8;y<r[3]-6;y+=8)
              if(Collision.depth(x,y,PRAD+.1)<1e-7)points.push({x,y});
          }
          points.sort((a,b)=>distance(a)-distance(b));
          if(!points.length)throw Error('附近没有可用的遮蔽处');
          await go(points[0],16,true);
        }
        if(!underCover())throw Error('没有进入遮蔽范围');
        while(AN.active&&AN.id==='rain'){alive();stop();await sleep(100);}
      }finally{sheltering=false;}
      return true;
    }
    if(UI.chooseOpen&&AN.active){
      handled=true;
      stop();const text=document.getElementById('choices').innerText;
      event('choice',text);
      // These options are selected from the text shown to the player.
      const labels=[...document.querySelectorAll('#choices button')].map(b=>b.textContent);
      const wanted=text.includes('脚步声停在我身后')?'回头看':
        labels.some(t=>t.includes('把作业本递过去'))?'把作业本递过去':
        labels.some(t=>t.includes('不出声'))?'不出声':
        labels.some(t=>t.includes('不回头'))?'不回头':labels[0];
      await choose(labels.findIndex(t=>t.includes(wanted))+1);
    }
    if(PAT.locked){
      handled=true;
      stop();event('threat','背对巡察者，停下等待');const until=performance.now()+12000;
      while(PAT.locked&&performance.now()<until){alive();look(Math.atan2(S.y-PAT.y,S.x-PAT.x));await sleep(60);}
    }
    if(Inspection.active()){
      handled=true;
      stop();look(S.ang,-1.2);
      while(Inspection.active()){alive();look(S.ang,-1.2);await sleep(100);}event('inspection','检查结束');
    }
    if(S.room==='garage1'&&ROAM.on&&ROAM.stage==='approach'&&Math.hypot(S.x-ROAM.x,S.y-ROAM.y)<245){
      handled=true;
      stop();if(!USE.torch)await tap('f');event('threat','持续照射车库黑影');
      const until=performance.now()+12000;
      while(ROAM.stage==='approach'&&performance.now()<until){alive();look(Math.atan2(ROAM.y-S.y,ROAM.x-S.x));await sleep(60);}
      if(ROAM.stage==='approach')throw Error('未能照退车库黑影');
    }
    return handled;
  }
  async function go(target,radius=11,covered=false){
    stop();let route=plan(target,radius,covered),i=0,retries=0,deadline=performance.now()+120000,progress=performance.now(),old={x:S.x,y:S.y};
    event('walk',{target,waypoints:route.length});
    while(i<route.length){
      if(performance.now()>deadline)throw Error('步行超时 '+JSON.stringify(target));
      if(await defense()){route=plan(target,radius,covered);i=0;progress=performance.now();old={x:S.x,y:S.y};continue;}
      if(!playerInputAllowed()){stop();await sleep(100);continue;}
      if(S.mode==='in'){
        const R=INTERIORS[S.room],door=cells('=').find(p=>distance(p)<17&&!doorIsOpen(R,p.x,p.y)&&(!doorLockNeed(R,p.c,p.r)||hasItem(doorLockNeed(R,p.c,p.r))));
        if(door){await face(door.x,door.y);await tap('e');await sleep(420);}
      }
      const p=route[i],d=distance(p);
      // A slow rendered frame advances several fixed physics steps. Accept a
      // bounded arrival radius so the player does not endlessly overshoot a corner.
      const arrival=Math.max(1.6,Math.min(5,SPD_WALK*Math.min(.3,dtG||.016)*.9));
      if(d<arrival&&(i+1===route.length||walkLineClear(route[i+1]))){i++;continue;}
      const yaw=Math.atan2(p.y-S.y,p.x-S.x);look(yaw);
      const forward=Math.abs(angle(yaw-S.ang))<.16;
      key('w',forward);key('Shift',forward&&S.mode==='out'&&S.stam>45&&d>40);
      if(performance.now()-progress>5000){
        if(Math.hypot(S.x-old.x,S.y-old.y)<1){
          event('stuck',{target,point:p});stop();
          if(retries++>=2)throw Error('碰撞阻挡了路线');
          route=plan(target,radius,covered);i=0;
        }
        old={x:S.x,y:S.y};progress=performance.now();
      }
      await sleep(50);
    }
    stop();await face(target.x,target.y);await sleep(180);
  }
  async function choose(n=1){await sleep(1400);await tap(String(n));await sleep(650);}
  async function interact(target,radius=11){
    await go(target,radius);await tap('e');await sleep(1000);
    const until=performance.now()+6000;
    while(SEARCH.job&&performance.now()<until){alive();await sleep(100);}
    if(SEARCH.job)throw Error('搜查未能完成');event('interact',target);
  }
  async function nearest(chars,radius=11){const list=cells(chars).sort((a,b)=>distance(a)-distance(b));for(const p of list){try{plan(p,radius);return await interact(p,radius);}catch(e){if(!e.message.startsWith('没有可行'))throw e;}}throw Error('找不到可接近的 '+chars);}
  async function building(id){
    const o=OBJ.find(o=>o.id===id&&o.k==='roof');if(!o)throw Error('没有建筑 '+id);
    await go(doorWorld(o),20);await tap('e');await sleep(1800);event('building',id);
  }
  async function stairs(up){
    const before=S.room;await nearest('S',14);
    if(UI.chooseOpen)await choose(up?1:2);
    await sleep(1000);if(S.room===before)throw Error('楼梯未切换楼层');
  }
  async function bagAction(id,label){
    stop();await tap('Tab');await sleep(500);
    const slot=document.querySelectorAll('#bags .s')[S.bag.indexOf(id)];
    if(!slot)throw Error('背包中没有 '+id);slot.click();await sleep(500);
    const button=[...document.querySelectorAll('#bagacts button')].find(b=>b.textContent===label);
    if(!button)throw Error('背包操作不存在 '+label);button.click();event('input',{bag:id,action:label});
    await sleep(700);await tap('Escape');await sleep(300);
  }
  async function roomForItem(){
    if(S.bag.length<7)return;
    const expendable=S.bag.find(id=>!['key','torch','pill','notebook','pen','brolly','coin'].includes(id));
    if(expendable)await bagAction(expendable,'丢弃');
  }
  async function route(){
    chapter('醒来，阅读开场');
    await sleep(1000);
    while(PRO.on){await sleep(2800);await tap('Enter');}
    await sleep(2500);chapter('自己的课桌与讲台移交单');
    await tap('r');await sleep(5000);
    // Movement itself stands up. A separate E press leaves a slow frame for the
    // game's chair-unsticking logic before the first walking input can be consumed.
    const seat={x:S.x,y:S.y},standDeadline=performance.now()+5000;
    key('w',true);
    while(distance(seat)<10&&performance.now()<standDeadline)await sleep(50);
    stop();
    const podium=cells('T').find(p=>Investigation.isPodium(INTERIORS.teach1,p.c,p.r));
    await interact(podium);await choose(1);
    if(!RT.investigation?.entries.notice)throw Error('未读到讲台移交单');
    chapter('等待第一次集合检查');
    while(!RT.inspection?.seen?.[S.day+':0']||Inspection.pending()){alive();await defense();await sleep(200);}
    chapter('前往行政楼寻找钥匙');
    await nearest('O',16);await building('admin');
    while(INTERIORS[S.room].floor<5)await stairs(true);
    chapter('搜查校长办公室');
    for(let n=0;n<16&&!hasItem('key');n++){
      await roomForItem();
      const p=cells('dfR').filter(p=>!RT.deskUsed[S.room+':'+p.c+':'+p.r]).sort((a,b)=>distance(a)-distance(b))[0];
      if(!p)throw Error('可搜查容器已用尽');
      await interact(p,10);await sleep(800);
    }
    if(!hasItem('key'))throw Error('没找到车钥匙');
    await bagAction('key','使用'); // Read the plate engraved on the actual acquired key.
    event('key',RT.investigation.entries.carKey.text);await sleep(2500);
    chapter('前往保安岗核对停车记录');
    while(INTERIORS[S.room].floor>1)await stairs(false);
    await nearest('O',16);await building('guard');await roomForItem();await nearest('k',12);
    if(UI.chooseOpen)await choose(1);
    if(!hasItem('torch')){await nearest('k',12);if(UI.chooseOpen)await choose(3);}
    if(!hasItem('torch'))throw Error('未取得保安岗手电');
    await sleep(4500);
    chapter('进入车库，持续照射黑影');
    await nearest('O',15);await building('garage');
    await garageExit();
  }
  async function garageExit(){
    if(!USE.torch)await tap('f');
    if(S.san<65&&hasItem('pill'))await bagAction('pill','使用');
    const clue=RT.investigation.entries.carKey.text;
    const car=cells('V').find(p=>clue.includes(Investigation.carName(p.c,p.r)));
    if(!car)throw Error('钥匙车牌没有对应车辆');
    await go(car,13);
    const waitUntil=performance.now()+60000;
    while(AN.active||Inspection.pending()){
      await defense();await sleep(100);if(performance.now()>waitUntil)throw Error('危险一直没有结束，无法开车');
    }
    await defense();await face(car.x,car.y);
    await tap('e');
    if(!UI.chooseOpen||!document.getElementById('choices').innerText.includes(Investigation.carName(car.c,car.r)))
      throw Error('没有选中与钥匙车牌匹配的车辆');
    await choose(1);
    await sleep(2200);
    chapter('启动汽车，驶离校园');
    const deadline=performance.now()+60000;
    while(!CarChase.active()){alive();if(performance.now()>deadline)throw Error('汽车没有进入驾驶阶段');await sleep(150);}
    chapter('避开路障，按路牌选择出口');
    while(CarChase.active()){
      alive();const d=RT.carChase;
      let target=d.distance<52?2.6:d.distance<86?0:d.distance<198?2.6:d.distance<235?0:-2.6;
      key('w',true);key('a',d.x>target+.12);key('d',d.x<target-.12);await sleep(40);
    }
    stop();await sleep(2000);
    if(S.screen!=='end'||RT.end!=='car'||!ENDINGS.car.true)throw Error('未达成真正的汽车结局');
    chapter('真结局：驾车离开');await sleep(12000);finished=true;event('success','car');
  }
  function start(){
    started=performance.now();const label=document.createElement('div');label.id='pilot-label';
    label.style.cssText='position:fixed;right:12px;top:76px;z-index:50000;background:#101718dd;color:#d9e2da;padding:6px 10px;border-radius:3px;font:12px sans-serif;pointer-events:none;max-width:48%';
    document.body.appendChild(label);
    route().catch(e=>{stop();failed=e.stack||String(e);event('failure',failed);});
  }
  return {start,snapshot,log,cells,plan,go,interact,nearest,building,stairs,face,tap,choose,stop,garageExit};
})();
