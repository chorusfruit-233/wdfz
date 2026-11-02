/* 全校唯一巡察者。普通感知只记实际目击；永久策略是唯一读取全局实时目标的接口。 */
'use strict';
var PatrolWorld=(function(){
  var route=null,framePath=null,lastVisualRoom=null;
  function position(){return PatrolNav.point(PAT.room,PAT.x,PAT.y,PAT.fy);}
  function put(p){PAT.room=p.scene;PAT.x=p.x;PAT.y=p.y;PAT.fy=p.fy||0;}
  function routeData(){if(!route){var g=PatrolNav.graph();route=PATROL_ROUTE;route.nodes.forEach(function(n){if(!g.nodes[n])throw new Error('路线节点已变更：'+n);});}return route;}
  function spawn(){var g=PatrolNav.graph();return g.nodes['admin1:stairs'];}
  function reset(){
    patRemoveFig();Object.keys(PAT).forEach(function(k){delete PAT[k];});
    Object.assign(PAT,{version:1,state:'walk',room:'admin1',x:0,y:0,fy:0,behavior:'patrol',permanent:false,
      routeVersion:1,routeIndex:1,transition:null,lock:0,locked:false,lost:0,lastSeen:null,search:0,
      queue:[],investigation:null,regionSeq:0,lastRegion:null,respawn:0,safety:3.6,warning:0,near:false,
      blinkCD:1.1,afterBlink:.22,step:0,stuck:0,diagnostic:null,mazeGateway:null});
    framePath=null;lastVisualRoom=null;
    if(INTERIORS.admin1&&typeof PATROL_ROUTE!=='undefined')put(spawn());
    VisualState.patrolFlick=0;VisualState.patrolRed=0;
  }
  function same(){return !CarChase.active()&&PAT.room===patRoomHere()&&!PAT.transition&&Math.abs((PAT.fy||0)-(S.floorY||0))<1.3;}
  function playerPoint(){return PatrolNav.point(patRoomHere(),S.x,S.y,S.floorY);}
  function distance(){return same()?Math.hypot(S.x-PAT.x,S.y-PAT.y):Infinity;}
  function region(){
    if(S.mode!=='in'||S.room!=='admin5')return null;var R=INTERIORS.admin5,c=Math.floor((S.x-R.ox)/R.tw),r=Math.floor((S.y-R.oy)/R.th);
    var i=Math.floor((c-2)/8);return r>=1&&r<16&&i>=0&&i<6&&c>=2+i*8&&c<=8+i*8?'admin5:office'+i:null;
  }
  function eligible(){
    if(S.dead||S.screen!=='play')return false;
    if(isNight())return S.mode==='out';
    if(region())return true;
    var R=S.mode==='in'&&INTERIORS[S.room];return !!(R&&['teach','admin','lab'].includes(R.host)&&R.floor>=1&&R.floor<=5&&needWhere(S.tsec)==='教室');
  }
  function exempt(){return (S.seated&&atMySeat())||onLeave()||(SchoolDay.excused()&&!isNight()&&!region());}
  function sees(){return PAT.state==='walk'&&same()&&!HIDE.on&&distance()<=PAT_SEE&&PatrolNav.los(position(),playerPoint());}
  function localQuiet(){
    var st=RT.inspection,c=st&&st.current;
    return !!(same()&&distance()<190&&((c&&c.room===PAT.room)||(st&&st.calm>0&&st.calmRoom===PAT.room)));
  }
  function lockerTarget(){
    if(!same()||!HIDE.on||!(PAT.permanent||HIDE.seen))return null;
    var f=lockerFront(INTERIORS[S.room],HIDE.c,HIDE.r);return PatrolNav.point(S.room,f.x,f.y,S.floorY);
  }
  function threat(){
    if(PAT.state!=='walk'||!same()||PAT.safety>0||localQuiet()||distance()>PAT_SEE)return false;
    var cabinet=lockerTarget();
    if(cabinet)return PatrolNav.los(position(),cabinet)&&(PAT.locked||PAT.permanent);
    return !HIDE.on&&(PAT.locked||PAT.permanent)&&PatrolNav.los(position(),playerPoint());
  }
  function hideThreat(){return HIDE.on&&same()&&(PAT.permanent||eligible()&&!exempt())&&PAT.safety<=0&&!localQuiet()&&PAT.state==='walk'&&distance()<=PAT_SEE&&PatrolNav.los(position(),PatrolNav.point(S.room,lockerFront(INTERIORS[S.room],HIDE.c,HIDE.r).x,lockerFront(INTERIORS[S.room],HIDE.c,HIDE.r).y,S.floorY));}
  function clearChase(){PAT.lock=0;PAT.locked=false;PAT.lost=0;PAT.lastSeen=null;PAT.search=0;PAT.behavior=PAT.investigation?'investigate':'return';framePath=null;}
  function rescued(){HIDE.seen=false;PAT.permanent=false;clearChase();PAT.safety=3.6;VisualState.patrolRed=0;Mechanics.dirty=true;}
  function registeredAbsence(id){PAT.permanent=true;PAT.absence=id;PAT.behavior='chase';framePath=null;toast('外出登记的缺席已被记录。');}
  function banish(){
    PAT.state='idle';PAT.respawn=30;PAT.locked=false;PAT.lock=0;PAT.transition=null;PAT.warning=0;PAT.near=false;framePath=null;patRemoveFig();
    VisualState.patrolFlick=0;VisualState.patrolRed=0;
    os('我：符纸烧成了灰。高个子的身影随之散开。',3.2,OS_KEEP);Mechanics.dirty=true;
  }
  function enqueue(id){
    if(PAT.queue.some(function(e){return e.regionId===id;})||PAT.investigation&&PAT.investigation.regionId===id)return;
    PAT.queue.push({regionId:id,sequence:++PAT.regionSeq,enteredAt:Mechanics.activePlaySeconds});
  }
  function observation(id){var i=+id.replace('admin5:office','');return PatrolNav.snap('admin5',PatrolNav.tilePoint('admin5',5+i*8,14));}
  function permanentTarget(){
    if(S.room==='lift_teach'||S.room==='lift_lab'){
      var ride=Elevator.recover(),floor=ride.phase==='moving'?ride.target:ride.origin,landing=Elevator.landing(ride.host,floor);
      return PatrolNav.point(ride.host+floor,landing.x,landing.y);
    }
    return lockerTarget()||playerPoint();
  }
  function target(){
    if(PAT.permanent){PAT.behavior='chase';return permanentTarget();}
    if(PAT.locked||PAT.search>0){PAT.behavior=PAT.locked?'chase':'search';return PAT.lastSeen;}
    if(!PAT.investigation&&PAT.queue.length){PAT.investigation=Object.assign({remaining:6},PAT.queue.shift());}
    if(PAT.investigation){PAT.behavior='investigate';return observation(PAT.investigation.regionId);}
    PAT.behavior='patrol';var r=routeData();return PatrolNav.graph().nodes[r.nodes[PAT.routeIndex%r.nodes.length]];
  }
  function mazeRoute(a,b){
    var gate=PAT.mazeGateway||{host:'teach',origin:1},floor=gate.host+gate.origin,landing=Elevator.landing(gate.host,gate.origin),p=PatrolNav.point(floor,landing.x,landing.y);
    if(b.scene==='lift_dream'&&a.scene!=='lift_dream'){
      if(a.scene===floor&&Math.hypot(a.x-p.x,a.y-p.y)<6){var spawnPoint=VoidMaze.toWorld(0,0);return {transition:{from:a,to:PatrolNav.point('lift_dream',spawnPoint.x,spawnPoint.y,0),remaining:2,total:2,kind:'special'}};}
      return PatrolNav.route(a,p);
    }
    if(a.scene==='lift_dream'&&b.scene!=='lift_dream'){
      var exit=MAZE_CFG.exits[0],w=VoidMaze.toWorld(exit.x,exit.z),q=PatrolNav.point('lift_dream',w.x,w.y,exit.h);
      if(Math.hypot(a.x-q.x,a.y-q.y)<7&&Math.abs(a.fy-q.fy)<1)return {transition:{from:a,to:p,remaining:2,total:2,kind:'special'}};
      return {points:PatrolNav.path(a,q)};
    }
    return PatrolNav.route(a,b);
  }
  function navigate(goal,budget){
    var a=position();if(!goal)return false;
    if(a.scene===goal.scene&&Math.hypot(a.x-goal.x,a.y-goal.y,((a.fy||0)-(goal.fy||0))/U2M)<6)return true;
    var key=goal.scene+':'+Math.round(goal.x/3)+':'+Math.round(goal.y/3)+':'+Math.round((goal.fy||0)*10);
    if(!framePath||framePath.key!==key||!framePath.points||!framePath.points.length){
      var nav=mazeRoute(a,goal);
      if(!nav||!nav.points&&!nav.transition){PAT.stuck++;if(PAT.stuck%4===1)PAT.diagnostic='暂不可达，重规划：'+a.scene+' → '+goal.scene;framePath=null;return false;}
      if(nav.transition){PAT.transition=nav.transition;PAT.behavior='transit';framePath=null;return false;}
      framePath={key:key,points:nav.points.slice(1)};
    }
    while(budget>1e-8&&framePath.points.length){var next=framePath.points[0],p=position();
      var door=PatrolNav.doorAt(next);if(door){var j=0,cost=0,last=p;while(j<framePath.points.length){var q=framePath.points[j];cost+=Math.hypot(q.x-last.x,q.y-last.y);last=q;j++;if(!PatrolNav.doorAt(q))break;}
        if(j===framePath.points.length&&PatrolNav.doorAt(last)||cost>budget)break;
        put(last);framePath.points.splice(0,j);budget-=cost;PAT.lastDoor=door;continue;}
      var dist=Math.hypot(p.x-next.x,p.y-next.y,((p.fy||0)-(next.fy||0))/U2M);
      if(dist<=budget){put(next);framePath.points.shift();budget-=dist;}else{var t=budget/dist;put(PatrolNav.point(p.scene,p.x+(next.x-p.x)*t,p.y+(next.y-p.y)*t,(p.fy||0)+((next.fy||0)-(p.fy||0))*t));budget=0;}}
    PAT.afterBlink=.22;PAT.stuck=0;PAT.diagnostic=null;
    return PAT.room===goal.scene&&Math.hypot(PAT.x-goal.x,PAT.y-goal.y,((PAT.fy||0)-(goal.fy||0))/U2M)<6;
  }
  function step(dt){
    var newRegion=region();if(newRegion!==PAT.lastRegion){PAT.lastRegion=newRegion;if(newRegion)enqueue(newRegion);}
    PAT.safety=Math.max(0,PAT.safety-dt);PAT.afterBlink=Math.max(0,PAT.afterBlink-dt);
    if(PAT.state==='idle'){
      PAT.respawn=Math.max(0,PAT.respawn-dt);
      if(PAT.respawn<=3.6&&spawn().scene===patRoomHere())VisualState.patrolFlick=Math.sin(PAT.respawn*10)>.4?.7:0;
      if(PAT.respawn<=1e-7){put(spawn());PAT.state='walk';PAT.behavior='return';PAT.afterBlink=.22;PAT.blinkCD=1.1;PAT.near=false;Mechanics.dirty=true;}
      else return;
    }
    if(PAT.transition){var tr=PAT.transition;tr.remaining=Math.max(0,tr.remaining-dt);if(tr.remaining<=1e-8){put(tr.to);PAT.transition=null;PAT.afterBlink=.22;framePath=null;}return;}
    var d=distance(),visible=sees(),cabinet=lockerTarget(),knownCabinet=!!(cabinet&&PatrolNav.los(position(),cabinet));
    /* 到达检查现场才等待，远处的永久追踪实体仍继续走。 */
    if(localQuiet()){PAT.lock=0;VisualState.patrolRed=0;return;}
    if(!PAT.permanent&&(!eligible()||exempt()))clearChase();
    var hostile=(PAT.permanent||eligible()&&!exempt())&&PAT.safety<=0;
    if(d<190&&!PAT.near&&PatrolNav.length(PatrolNav.path(playerPoint(),position()))<190){PAT.near=true;PAT.warning=3.6;}
    if(d>220)PAT.near=false;
    PAT.warning=Math.max(0,PAT.warning-dt);
    if(hostile&&(visible||knownCabinet)){
      PAT.lastSeen=knownCabinet?cabinet:playerPoint();PAT.lost=0;
      if(PAT.warning<=0){PAT.lock+=dt*(d<60?2.2:1.1);
        if(!PAT.locked&&PAT.lock>=1){
          if(hasItem('seal')){removeItem('seal');banish();return;}
          PAT.locked=true;PAT.behavior='chase';if(!PAT.permanent)addViolation(8,'patrol');
        }}
    }else if(PAT.locked&&!PAT.permanent){
      PAT.lost+=dt;if(PAT.lost>2.5){PAT.locked=false;PAT.lock=0;PAT.search=3;framePath=null;}
    }else if(!PAT.locked)PAT.lock=Math.max(0,PAT.lock-dt);
    var goal=target();PAT.blinkCD-=dt;
    if(PAT.blinkCD<=0&&PAT.safety<=0){
      var chase=PAT.permanent||PAT.locked,interval=chase?.75:1.1;PAT.blinkCD+=interval;
      var arrived=navigate(goal,(chase?PAT_CHASE:PAT_SPEED)*interval);
      if(arrived){
        if(PAT.behavior==='patrol'){PAT.routeIndex++;if(PAT.routeIndex>=routeData().nodes.length)PAT.routeIndex=1;framePath=null;}

      }
    }
    var atGoal=goal&&PAT.room===goal.scene&&Math.hypot(PAT.x-goal.x,PAT.y-goal.y,((PAT.fy||0)-(goal.fy||0))/U2M)<6;
    if(PAT.search>0&&atGoal){PAT.search=Math.max(0,PAT.search-dt);if(!PAT.search){PAT.lastSeen=null;framePath=null;}}
    else if(PAT.investigation&&atGoal&&!PAT.permanent&&!PAT.locked&&PAT.search<=0)PAT.investigation.remaining-=dt;
    if(PAT.investigation&&PAT.investigation.remaining<=0){PAT.investigation=null;framePath=null;}
    if(PAT.locked&&hostile&&PAT.afterBlink<=0&&distance()<PAT_CATCH&&(sees()||knownCabinet)&&PAT.warning<=0)
      kill(HIDE.on?'柜门被拉开了。它一直知道你在这里。':'一只手按住了你的头顶。它在点名。','grip','patrol');
  }
  function visuals(dt){
    if(PAT.state==='idle'){var sp=spawn(),audible=sp.scene===patRoomHere()&&PAT.respawn<=3.6&&PatrolNav.length(PatrolNav.path(playerPoint(),sp))<190;var rt=(3.6-PAT.respawn)%1.8;VisualState.patrolFlick=audible&&(rt<.15||rt>.3&&rt<.45||rt>.75&&rt<1.25)?.7:0;VisualState.patrolRed=0;return;}
    var here=patRoomHere(),near=same()&&distance()<200&&PAT.state==='walk';
    if(lastVisualRoom!==here){lastVisualRoom=here;patRemoveFig();}
    if(PAT.state==='walk'&&PAT.room===here&&!PAT.transition&&!GLR.patFig)patAddFig();
    if(PAT.room!==here||PAT.state!=='walk'||PAT.transition)patRemoveFig();
    VisualState.patrolRed=threat()?1:0;
    var t=3.6-PAT.warning,p=t%1.8;
    VisualState.patrolFlick=near&&PAT.warning>0&&(p<.15||p>.3&&p<.45||p>.75&&p<1.25)?.7:0;
    if(near){PAT.step-=dt;if(PAT.step<=0){PAT.step=PAT.locked?.32:.7;var soundPath=PatrolNav.path(playerPoint(),position()),soundDistance=PatrolNav.length(soundPath);if(soundDistance<200&&soundPath.length){var from=soundPath[Math.min(4,soundPath.length-1)],rel=Math.atan2(from.y-S.y,from.x-S.x)-S.ang;SFX.patStep(Math.sin(rel)*.9,Math.pow(1-soundDistance/200,1.4),Math.cos(rel)<-.2,PAT.locked);}}}
  }
  function tick(dt){if(!(dt>0)||S.dead||S.screen!=='play')return;if(!PAT.version)reset();
    var left=dt;while(left>1e-8&&!S.dead){var n=Math.min(left,.1,PAT.state==='idle'&&PAT.respawn>0?PAT.respawn:Infinity);step(n);left-=n;}
    visuals(dt);
  }
  function locationLabel(){
    if(PAT.state==='idle')return '信号暂不可用';var tr=PAT.transition;
    if(tr){var a=INTERIORS[tr.from.scene],b=INTERIORS[tr.to.scene];if(tr.kind==='stairs')return '楼梯／'+a.floor+'F→'+b.floor+'F';if(tr.kind==='bridge')return (a&&a.host==='c1'||b&&b.host==='c1'?'连廊①':'连廊②')+'／2F';return '连接通道';}
    if(PAT.room==='out')return '校园室外';var R=INTERIORS[PAT.room];if(!R)return '信号暂不可用';
    return ({admin:'行政楼',teach:'教学楼',lab:'实验楼',c1:'连廊①',c2:'连廊②',dream:'未知区域',garw:'地下车库',bell:'钟楼',dormN:'北宿舍',dormS:'南宿舍',tunnel:'隧道'}[R.host]||R.name)+'／'+R.floor+'F';
  }
  GameModules.on('leaveRoom',function(from,to){
    if(to==='lift_dream'&&RT.elevatorRide)PAT.mazeGateway={host:RT.elevatorRide.host,origin:RT.elevatorRide.origin};
    /* 目击穿过出口只提供该出口的另一端，不泄露进入之后的实时位置。 */
    if(PAT.locked&&!PAT.permanent&&sees()&&to&&PAT.room===(from||'out')){var p=PatrolNav.entry(to,'O');if(p)PAT.lastSeen=p;}
    framePath=null;patRemoveFig();
  },{owner:'patrol-world'});
  GameModules.persistent('patrolWorld',{
    reset:reset,save:function(){return PAT;},
    load:function(d){
      if(!d||d.version!==1||d.routeVersion!==1||!['walk','idle'].includes(d.state)||!Number.isFinite(d.x)||!Number.isFinite(d.y)||!(d.room==='out'||INTERIORS[d.room])){saveReport('patrolWorld','旧或非法巡察状态改为固定安全出生');HIDE.seen=false;return;}
      var base=Object.assign({},PAT);Object.keys(base).forEach(function(k){if(d[k]!==undefined)PAT[k]=d[k];});
      ['x','y','fy','lock','lost','search','respawn','safety','warning','blinkCD','afterBlink','step','stuck'].forEach(function(k){if(!Number.isFinite(PAT[k])){PAT[k]=base[k];saveReport('patrolWorld','非法巡察计时已修复：'+k);}});
      PAT.queue=Array.isArray(d.queue)?d.queue.filter(function(e){return e&&/^admin5:office[0-5]$/.test(e.regionId)&&Number.isFinite(e.sequence)&&Number.isFinite(e.enteredAt);}).slice(0,6):[];
      PAT.investigation=d.investigation&&/^admin5:office[0-5]$/.test(d.investigation.regionId)?d.investigation:null;
      PAT.routeIndex=Math.floor(saveNum(d.routeIndex,1,routeData().nodes.length-1));
      if(PAT.transition&&(!PAT.transition.to||!PAT.transition.from||!Number.isFinite(PAT.transition.remaining)||PAT.transition.remaining<0)){PAT.transition=null;saveReport('patrolWorld','无效连接进度已取消');}
      if(PAT.room!=='lift_dream'&&PAT.room!=='bell1'&&!PAT.transition){var p=PatrolNav.snap(PAT.room,position());if(p&&Math.hypot(p.x-PAT.x,p.y-PAT.y)<30)put(p);else{put(spawn());PAT.safety=3.6;saveReport('patrolWorld','巡察碰撞落点已修复');}}
      framePath=null;
    }
  });
  return {reset:reset,tick:tick,position:position,eligible:eligible,exempt:exempt,sees:sees,same:same,region:region,
    localChase:function(){return threat()&&PAT.locked;},localThreat:function(){return threat()||hideThreat();},pressure:function(){return threat()?.35:hideThreat()?.18:0;},
    rescued:rescued,registeredAbsence:registeredAbsence,banish:banish,clearChase:clearChase,locationLabel:locationLabel,enqueue:enqueue,spawn:spawn};
})();
