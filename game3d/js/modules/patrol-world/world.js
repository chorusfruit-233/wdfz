/* @module-capsule */
(function($imports){
/* 全校唯一巡察者。普通目击与无线快照分开保存；只有永久策略持续读取全局实时目标。 */
'use strict';
var PatrolWorld=(function(){
  var route=null,framePath=null,lastVisualRoom=null,approachCache=null;
  var TRAVEL_CD=8,TRAVEL_MIN=240,TRAVEL_MAX=480,TRAVEL_CLEAR=260;
  function position(){return $imports.PatrolNav.point($imports.PAT.room,$imports.PAT.x,$imports.PAT.y,$imports.PAT.fy);}
  function put(p){$imports.PAT.room=p.scene;$imports.PAT.x=p.x;$imports.PAT.y=p.y;$imports.PAT.fy=p.fy||0;}
  function routeData(){if(!route){var g=$imports.PatrolNav.graph();route=$imports.PATROL_ROUTE;route.nodes.forEach(function(n){if(!g.nodes[n])throw new Error('路线节点已变更：'+n);});}return route;}
  function spawn(){var g=$imports.PatrolNav.graph();return g.nodes['admin1:stairs'];}
  function reset(){
    Object.keys($imports.PAT).forEach(function(k){delete $imports.PAT[k];});
    Object.assign($imports.PAT,{version:1,state:'walk',room:'admin1',x:0,y:0,fy:0,behavior:'patrol',permanent:false,
      routeVersion:3,routeIndex:1,rejoin:false,cycle:0,lockerMemory:{},memoryVisit:null,transition:null,lock:0,locked:false,cited:false,lost:0,lastSeen:null,search:0,
      queue:[],investigation:null,wirelessSignal:null,regionSeq:0,lastRegion:null,respawn:0,safety:3.6,warning:0,near:false,
      blinkCD:TRAVEL_CD,afterBlink:.22,step:0,stuck:0,diagnostic:null,mazeGateway:null,doorRush:null});
    framePath=null;lastVisualRoom=null;approachCache=null;
    if($imports.INTERIORS.admin1&&typeof $imports.PATROL_ROUTE!=='undefined')put(spawn());
  }
  function same(){return !$imports.CarChase.active()&&$imports.PAT.room===(0,$imports.patRoomHere)()&&!$imports.PAT.transition&&Math.abs(($imports.PAT.fy||0)-($imports.S.floorY||0))<1.3;}
  function playerPoint(){return $imports.PatrolNav.point((0,$imports.patRoomHere)(),$imports.S.x,$imports.S.y,$imports.S.floorY);}
  function distance(){return same()?Math.hypot($imports.S.x-$imports.PAT.x,$imports.S.y-$imports.PAT.y):Infinity;}
  function approach(){
    if($imports.CarChase.active())return null;
    var a=playerPoint(),tr=$imports.PAT.transition,b=tr?tr.to:position();
    var key=[a.scene,Math.round(a.x/4),Math.round(a.y/4),Math.round(a.fy*10),b.scene,Math.round(b.x/4),Math.round(b.y/4),Math.round((b.fy||0)*10),tr?Math.ceil(tr.remaining*2):0].join(':');
    if(approachCache&&approachCache.key===key)return approachCache.value;
    var m=$imports.PatrolNav.approach(a,b,220);if(m&&tr)m.distance+=tr.remaining*$imports.PAT_SPEED;
    approachCache={key:key,value:m};return m;
  }
  function region(){
    if($imports.S.mode!=='in')return null;var R=$imports.INTERIORS[$imports.S.room];if(!R)return null;
    var c=($imports.S.x-R.ox)/R.tw,r=($imports.S.y-R.oy)/R.th;
    var zone=$imports.PATROL_ZONES.find(function(z){return z.scene===$imports.S.room&&c>=z.c0&&c<z.c1&&r>=z.r0&&r<z.r1;});
    return zone?zone.id:null;
  }
  function zoneById(id){return $imports.PATROL_ZONES.find(function(z){return z.id===id;});}
  function eligible(){
    if($imports.S.dead||$imports.S.screen!=='play')return false;
    if((0,$imports.isNight)())return $imports.S.mode==='out';
    if(region())return true;
    var R=$imports.S.mode==='in'&&$imports.INTERIORS[$imports.S.room];return !!(R&&['teach','admin','lab'].includes(R.host)&&R.floor>=1&&R.floor<=5&&(0,$imports.needWhere)($imports.S.tsec)==='教室');
  }
  function exempt(){return ($imports.S.seated&&(0,$imports.atMySeat)())||(0,$imports.onLeave)()||($imports.SchoolDay.excused()&&!(0,$imports.isNight)()&&!region());}
  function hunting(){return $imports.PAT.permanent||!!$imports.PAT.wirelessSignal||eligible()&&!exempt();}
  function sees(){return $imports.PAT.state==='walk'&&same()&&!$imports.HIDE.on&&distance()<=$imports.PAT_SEE&&$imports.PatrolNav.los(position(),playerPoint());}
  function localQuiet(){
    var st=$imports.RT.inspection,c=st&&st.current;
    return !!(same()&&distance()<190&&((c&&c.room===$imports.PAT.room)||(st&&st.calm>0&&st.calmRoom===$imports.PAT.room)));
  }
  function lockerTarget(){
    var signal=$imports.PAT.wirelessSignal,l=signal&&signal.locker;
    var known=!!(l&&l.scene===$imports.S.room&&l.c===$imports.HIDE.c&&l.r===$imports.HIDE.r);
    if(!same()||!$imports.HIDE.on||!($imports.PAT.permanent||$imports.HIDE.seen||known))return null;
    var f=(0,$imports.lockerFront)($imports.INTERIORS[$imports.S.room],$imports.HIDE.c,$imports.HIDE.r);return $imports.PatrolNav.point($imports.S.room,f.x,f.y,$imports.S.floorY);
  }
  function threat(){
    if($imports.PAT.state!=='walk'||!same()||$imports.PAT.safety>0||localQuiet()||distance()>$imports.PAT_SEE)return false;
    var cabinet=lockerTarget();
    if(cabinet)return $imports.PatrolNav.los(position(),cabinet)&&($imports.PAT.locked||$imports.PAT.permanent);
    return !$imports.HIDE.on&&($imports.PAT.locked||$imports.PAT.permanent)&&$imports.PatrolNav.los(position(),playerPoint());
  }
  function hideThreat(){return $imports.HIDE.on&&same()&&hunting()&&$imports.PAT.safety<=0&&!localQuiet()&&$imports.PAT.state==='walk'&&distance()<=$imports.PAT_SEE&&$imports.PatrolNav.los(position(),$imports.PatrolNav.point($imports.S.room,(0,$imports.lockerFront)($imports.INTERIORS[$imports.S.room],$imports.HIDE.c,$imports.HIDE.r).x,(0,$imports.lockerFront)($imports.INTERIORS[$imports.S.room],$imports.HIDE.c,$imports.HIDE.r).y,$imports.S.floorY));}
  function clearChase(){var active=$imports.PAT.locked||$imports.PAT.lastSeen||$imports.PAT.search>0||$imports.PAT.cited;$imports.PAT.cited=false;$imports.PAT.lock=0;$imports.PAT.locked=false;$imports.PAT.lost=0;$imports.PAT.lastSeen=null;$imports.PAT.search=0;
    if(active){$imports.PAT.rejoin=true;$imports.PAT.behavior=$imports.PAT.investigation?'investigate':'return';framePath=null;}}
  function rescued(){$imports.HIDE.seen=false;$imports.PAT.permanent=false;$imports.PAT.wirelessSignal=null;clearChase();$imports.PAT.rejoin=true;$imports.PAT.safety=3.6;$imports.VisualState.patrolRed=0;$imports.Mechanics.dirty=true;}
  function registeredAbsence(id){$imports.PAT.permanent=true;$imports.PAT.absence=id;$imports.PAT.behavior='chase';framePath=null;(0,$imports.toast)('外出登记后未归：持续追踪已生效，重新登记和假条不能解除。');(0,$imports.gameFact)('patrol',{what:'permanent'});}
  function banish(){
    (0,$imports.gameFact)('patrol',{what:'banish'});
    $imports.PAT.state='idle';$imports.PAT.respawn=30;$imports.PAT.rejoin=true;$imports.PAT.locked=false;$imports.PAT.lock=0;$imports.PAT.lost=0;$imports.PAT.lastSeen=null;$imports.PAT.search=0;$imports.PAT.cited=false;$imports.HIDE.seen=false;$imports.PAT.transition=null;$imports.PAT.warning=0;$imports.PAT.near=false;framePath=null;(0,$imports.patRemoveFig)();
    $imports.VisualState.patrolFlick=0;$imports.VisualState.patrolRed=0;
    (0,$imports.os)('我：符纸烧成了灰。高个子的身影随之散开。',3.2,$imports.OS_KEEP);$imports.Mechanics.dirty=true;
  }
  function enqueue(id){
    if($imports.PAT.queue.some(function(e){return e.regionId===id;})||$imports.PAT.investigation&&$imports.PAT.investigation.regionId===id)return;
    $imports.PAT.queue.push({regionId:id,sequence:++$imports.PAT.regionSeq,enteredAt:$imports.Mechanics.activePlaySeconds});
    var zone=zoneById(id);if(zone&&zone.marked)(0,$imports.toast)('区域门禁已上报：'+zone.label+'。巡察者将前往调查。');
    $imports.Mechanics.dirty=true;
  }
  function observation(id){var z=zoneById(id);return z?$imports.PatrolNav.snap(z.scene,$imports.PatrolNav.tilePoint(z.scene,z.observe[0],z.observe[1])):null;}
  function permanentTarget(){
    if($imports.S.room==='lift_teach'||$imports.S.room==='lift_lab'){
      var ride=$imports.Elevator.recover(),floor=ride.phase==='moving'?ride.target:ride.origin,landing=$imports.Elevator.landing(ride.host,floor);
      return $imports.PatrolNav.point(ride.host+floor,landing.x,landing.y);
    }
    return lockerTarget()||playerPoint();
  }
  function revealWireless(){
    if(!$imports.PAT.version)reset();
    var p=permanentTarget(),locker=null;
    if($imports.HIDE.on){var f=(0,$imports.lockerFront)($imports.INTERIORS[$imports.S.room],$imports.HIDE.c,$imports.HIDE.r);p=$imports.PatrolNav.point($imports.S.room,f.x,f.y,$imports.S.floorY);locker={scene:$imports.S.room,c:$imports.HIDE.c,r:$imports.HIDE.r};}
    $imports.PAT.wirelessSignal={point:Object.assign({},p),remaining:3,locker:locker};
    framePath=null;$imports.Mechanics.dirty=true;
  }
  function target(){
    if($imports.PAT.permanent){$imports.PAT.behavior='chase';return permanentTarget();}
    if($imports.PAT.locked||$imports.PAT.search>0){$imports.PAT.behavior=$imports.PAT.locked?'chase':'search';return $imports.PAT.lastSeen;}
    /* 保留原始快照；导航只把落脚点挪到邻近可行走处，避免搜查卡在椅子等碰撞内。 */
    if($imports.PAT.wirelessSignal){var p=$imports.PAT.wirelessSignal.point;$imports.PAT.behavior='investigate';return p.scene==='bell1'||p.scene==='lift_dream'||$imports.StairWorld.config(p.scene)?p:$imports.PatrolNav.snap(p.scene,p)||p;}
    if(!$imports.PAT.investigation&&$imports.PAT.queue.length){$imports.PAT.investigation=Object.assign({remaining:6},$imports.PAT.queue.shift());}
    if($imports.PAT.investigation){$imports.PAT.behavior='investigate';return observation($imports.PAT.investigation.regionId);}
    var mem=$imports.PAT.lockerMemory[$imports.PAT.room];
    if(!$imports.PAT.memoryVisit&&mem&&mem.cycle!==$imports.PAT.cycle){$imports.PAT.memoryVisit={scene:$imports.PAT.room,c:mem.c,r:mem.r,remaining:4};mem.cycle=$imports.PAT.cycle;}
    if($imports.PAT.memoryVisit){var m=$imports.PAT.memoryVisit,f=(0,$imports.lockerFront)($imports.INTERIORS[m.scene],m.c,m.r);$imports.PAT.behavior='investigate';return $imports.PatrolNav.point(m.scene,f.x,f.y);}
    if($imports.PAT.rejoin){var nearest=$imports.PatrolNav.nearestRoute(position(),routeData().nodes);if(nearest){$imports.PAT.routeIndex=routeData().nodes.indexOf(nearest);$imports.PAT.rejoin=false;$imports.PAT.behavior='return';framePath=null;}else $imports.PAT.behavior='return';}
    if($imports.PAT.behavior==='return')return $imports.PatrolNav.graph().nodes[routeData().nodes[$imports.PAT.routeIndex]];
    $imports.PAT.behavior='patrol';var r=routeData();return $imports.PatrolNav.graph().nodes[r.nodes[$imports.PAT.routeIndex%r.nodes.length]];
  }
  function patrolRoute(a,b){
    var r=routeData(),g=$imports.PatrolNav.graph(),prev=r.nodes[Math.max(0,$imports.PAT.routeIndex-1)],next=r.nodes[$imports.PAT.routeIndex],from=g.nodes[prev];
    var edge=g.edges.find(function(e){return e.a===prev&&e.b===next||e.b===prev&&e.a===next;});
    if(!edge)return null;
    if(from.scene===b.scene)return a.scene===b.scene?{points:$imports.PatrolNav.path(a,b)}:mazeRoute(a,from);
    if(a.scene!==from.scene)return mazeRoute(a,from);
    if(Math.hypot(a.x-from.x,a.y-from.y)>3)return {points:$imports.PatrolNav.path(a,from)};
    return {transition:{from:a,to:b,kind:edge.kind,remaining:edge.weight,total:edge.weight}};
  }
  function mazeRoute(a,b){
    var gate=$imports.PAT.mazeGateway||{host:'teach',origin:1},floor=gate.host+gate.origin,landing=$imports.Elevator.landing(gate.host,gate.origin),p=$imports.PatrolNav.point(floor,landing.x,landing.y);
    if(b.scene==='lift_dream'&&a.scene!=='lift_dream'){
      if(a.scene===floor&&Math.hypot(a.x-p.x,a.y-p.y)<6){var spawnPoint=typeof $imports.VoidMaze!=='undefined'?$imports.VoidMaze.toWorld(0,0):$imports.Elevator.spawn('lift_dream',2,5,0);return {transition:{from:a,to:$imports.PatrolNav.point('lift_dream',spawnPoint.x,spawnPoint.y,0),remaining:2,total:2,kind:'special'}};}
      return $imports.PatrolNav.route(a,p);
    }
    if(a.scene==='lift_dream'&&b.scene!=='lift_dream'){
      var q;
      if(typeof $imports.VoidMaze!=='undefined'){var exit=$imports.MAZE_CFG.exits[0],w=$imports.VoidMaze.toWorld(exit.x,exit.z);q=$imports.PatrolNav.point('lift_dream',w.x,w.y,exit.h);}
      else q=$imports.PatrolNav.entry('lift_dream','J');
      if(Math.hypot(a.x-q.x,a.y-q.y)<7&&Math.abs(a.fy-q.fy)<1)return {transition:{from:a,to:p,remaining:2,total:2,kind:'special'}};
      return {points:$imports.PatrolNav.path(a,q)};
    }
    return $imports.PatrolNav.route(a,b);
  }
  function preparePath(goal){
    var a=position(),key=goal.scene+':'+Math.round(goal.x/3)+':'+Math.round(goal.y/3)+':'+Math.round((goal.fy||0)*10);
    if(framePath&&framePath.key===key&&framePath.points&&framePath.points.length)return true;
    var nav=$imports.PAT.behavior==='patrol'?patrolRoute(a,goal):mazeRoute(a,goal);
    if(!nav||!nav.points&&!nav.transition){$imports.PAT.stuck++;if($imports.PAT.stuck%4===1)$imports.PAT.diagnostic='暂不可达，重规划：'+a.scene+' → '+goal.scene;framePath=null;return false;}
    if(nav.transition&&nav.transition.kind==='stair-portal'){put(nav.transition.to);framePath=null;return false;}
    if(nav.transition){$imports.PAT.transition=nav.transition;$imports.PAT.behavior='transit';framePath=null;return false;}
    /* 保留安全的起点连接；能直达第二个节点才省去栅格中心，避免追逐重规划时反复退步。 */
    var points=nav.points.slice();
    if(points.length>1&&$imports.PatrolNav.segment(a,points[1]))points.shift();
    framePath={key:key,points:points};return true;
  }
  function travelBlink(){
    /* 只有普通室外巡逻可远距离赶路。调查、追逐、归队与连接过渡始终按步速移动。
       起止点都离玩家的可达路径至少 260，避免从远处突然贴到门边或藏身点。 */
    if($imports.PAT.blinkCD>0||$imports.PAT.room!=='out'||$imports.PAT.behavior!=='patrol'||$imports.PAT.locked||$imports.PAT.permanent||
      $imports.PAT.search>0||$imports.PAT.wirelessSignal||$imports.PAT.investigation||$imports.PAT.memoryVisit||!framePath)return false;
    var player=playerPoint();
    function clear(p){return !(player.scene===p.scene&&Math.hypot(player.x-p.x,player.y-p.y)<=TRAVEL_CLEAR)&&!$imports.PatrolNav.approach(player,p,TRAVEL_CLEAR);}
    if(!clear(position()))return false;
    var points=framePath.points,p=position(),cost=0,count=0,destination=null;
    for(var i=0;i<points.length;i++){
      var q=points[i];if(q.scene!=='out')break;
      cost+=Math.hypot(q.x-p.x,q.y-p.y);if(cost>TRAVEL_MAX)break;p=q;
      if(cost>=TRAVEL_MIN&&clear(q)){count=i+1;destination=q;}
    }
    if(!destination)return false;
    put(destination);framePath.points.splice(0,count);$imports.PAT.blinkCD=TRAVEL_CD;$imports.PAT.afterBlink=.22;
    return true;
  }
  function navigate(goal,budget){
    var a=position();if(!goal)return false;
    if(a.scene===goal.scene&&Math.hypot(a.x-goal.x,a.y-goal.y,((a.fy||0)-(goal.fy||0))/$imports.U2M)<6)return true;
    if(!preparePath(goal))return false;
    if(travelBlink())budget=0;
    while(budget>1e-8&&framePath.points.length){var next=framePath.points[0],p=position();
      /* 巡察者穿过门洞，但不替玩家开锁；穿门距离也逐帧消耗步行预算。 */
      var door=$imports.PatrolNav.doorAt(next)||$imports.PatrolNav.doorAt(p);if(door)$imports.PAT.lastDoor=door;
      var dist=Math.hypot(p.x-next.x,p.y-next.y,((p.fy||0)-(next.fy||0))/$imports.U2M);
      if(dist<=budget){put(next);framePath.points.shift();budget-=dist;}else{var t=budget/dist;put($imports.PatrolNav.point(p.scene,p.x+(next.x-p.x)*t,p.y+(next.y-p.y)*t,(p.fy||0)+((next.fy||0)-(p.fy||0))*t));budget=0;}}
    $imports.PAT.stuck=0;$imports.PAT.diagnostic=null;
    return $imports.PAT.room===goal.scene&&Math.hypot($imports.PAT.x-goal.x,$imports.PAT.y-goal.y,(($imports.PAT.fy||0)-(goal.fy||0))/$imports.U2M)<6;
  }
  /* 挡门（计划《电梯直通、新天赋、新结局与恐怖氛围》1.3 节）：你在电梯门后的轿厢里、门没关上，它在同一层、从门前看得见门洞，
     就用追击速度直奔门前。从开始走过来到碰到门至少留 2.2 秒；不够就是本来就追上了，按平常的抓捕算（不算挡门）。
     门在它到之前合上，它被关在外面，在门口照常搜一会儿；门没合上它就到了，扒开门。它不进轿厢 */
  var LIFT_RUSH_MIN=2.2,LIFT_REACH=7;
  function liftFront(R){var w=$imports.Elevator.world(R,0.75,0);return $imports.PatrolNav.point(R.id,w.x,w.y);}
  function liftDoor(){
    var R=$imports.S.mode==='in'?$imports.INTERIORS[$imports.S.room]:null,rush=$imports.PAT.doorRush;
    var cabin=!!(R&&R.host!=='lift'&&$imports.Elevator.frame(R)&&$imports.Elevator.inCabin(R));
    var open=cabin?$imports.Elevator.doorAmount(R.host,R.floor):0,fp=cabin?liftFront(R):null;
    var atDoor=cabin&&$imports.PAT.room===R.id&&!$imports.PAT.transition&&Math.hypot($imports.PAT.x-fp.x,$imports.PAT.y-fp.y)<LIFT_REACH;
    if(rush){
      if(!cabin||R.id!==rush.scene){$imports.PAT.doorRush=null;return false;}          /* 走出了电梯：回到平常的追逐 */
      if(open<=0){
        $imports.PAT.doorRush=null;$imports.PAT.locked=false;$imports.PAT.lock=0;$imports.PAT.search=3;$imports.PAT.lastSeen=fp;framePath=null;
        (0,$imports.gameFact)('patrol',{what:'door'});(0,$imports.os)('〔门外〕脚步停在了门口。',3,$imports.OS_KEEP);
        return false;
      }
      $imports.PAT.locked=true;$imports.PAT.lost=0;$imports.PAT.lastSeen=fp;
      if(atDoor){(0,$imports.kill)('它比门快。','liftdoor','liftdoor');return true;}
      return false;
    }
    if(!cabin||open<=0||$imports.PAT.state!=='walk'||$imports.PAT.transition||!same()||!hunting()||$imports.PAT.safety>0||localQuiet())return false;
    /* 本来就追着你、到了门口：门开着就照平常抓 */
    if($imports.PAT.locked&&atDoor){(0,$imports.kill)('一只手按住了你的头顶。它在点名。','grip','patrol');return true;}
    /* 「看着你进电梯」：它正盯着你（刚看见过、还在追），或者视线从门洞穿进轿厢看得见你（站在轿厢侧壁边上就看不见） */
    var watching=$imports.PAT.locked&&$imports.PAT.lost<1;
    if(!watching){
      var loc=$imports.Elevator.local(R,$imports.PAT.x,$imports.PAT.y),me=$imports.Elevator.local(R,$imports.S.x,$imports.S.y);
      if(!loc||!me||loc.a<0.6||Math.hypot($imports.PAT.x-$imports.S.x,$imports.PAT.y-$imports.S.y)>$imports.PAT_SEE)return false;
      var through=[$imports.LIFT_GEO.landing,$imports.LIFT_GEO.car].every(function(a0){
        if(me.a>=a0)return true;var t=(a0-loc.a)/(me.a-loc.a);return Math.abs(loc.b+t*(me.b-loc.b))<$imports.LIFT_GEO.half-0.05;});
      if(!through||!$imports.PatrolNav.los(position(),fp))return false;
    }
    var path=$imports.PatrolNav.path(position(),fp),dist=path&&path.length?$imports.PatrolNav.length(path):Math.hypot($imports.PAT.x-fp.x,$imports.PAT.y-fp.y);
    var eta=Math.max(0,dist-LIFT_REACH)/$imports.PAT_CHASE;
    if(!$imports.PAT.locked){
      $imports.PAT.locked=true;$imports.PAT.lock=1;$imports.PAT.behavior='chase';
      if(!$imports.PAT.permanent&&!$imports.PAT.cited){$imports.PAT.cited=true;(0,$imports.addViolation)(8,'patrol');}
      (0,$imports.gameFact)('patrol',{what:'locked',permanent:!!$imports.PAT.permanent});
    }
    $imports.PAT.lost=0;$imports.PAT.lastSeen=fp;framePath=null;
    if(eta>=LIFT_RUSH_MIN){
      $imports.PAT.doorRush={host:R.host,floor:R.floor,scene:R.id,x:fp.x,y:fp.y,eta:eta};
      $imports.PAT.warning=Math.min(3.6,eta);$imports.PAT.near=true;                 /* 门外的灯管按它的节奏闪 */
      (0,$imports.os)('〔门外 · 正在靠近〕脚步加快。',2.4,$imports.OS_KEEP);
    }
    return false;
  }
  function step(dt){
    var newRegion=region();if(newRegion!==$imports.PAT.lastRegion){$imports.PAT.lastRegion=newRegion;if(newRegion)enqueue(newRegion);}
    $imports.PAT.safety=Math.max(0,$imports.PAT.safety-dt);$imports.PAT.afterBlink=Math.max(0,$imports.PAT.afterBlink-dt);
    if($imports.PAT.state==='idle'){
      $imports.PAT.respawn=Math.max(0,$imports.PAT.respawn-dt);
      if($imports.PAT.respawn<=3.6&&spawn().scene===(0,$imports.patRoomHere)())$imports.VisualState.patrolFlick=Math.sin($imports.PAT.respawn*10)>.4?.7:0;
      if($imports.PAT.respawn<=1e-7){put(spawn());$imports.PAT.state='walk';$imports.PAT.behavior='return';$imports.PAT.afterBlink=.22;$imports.PAT.blinkCD=TRAVEL_CD;$imports.PAT.near=false;$imports.Mechanics.dirty=true;}
      return; // This slice was spent respawning; movement starts with the next slice.
    }
    var approaching=approach();
    if(approaching&&approaching.distance<190&&!$imports.PAT.near){$imports.PAT.near=true;$imports.PAT.warning=3.6;}
    if(!approaching||approaching.distance>220)$imports.PAT.near=false;
    if($imports.HIDE.on&&$imports.PAT.near)$imports.HIDE.near=true;                       /* 躲柜期间它来过附近：出柜时记一次「躲过」 */
    $imports.PAT.warning=Math.max(0,$imports.PAT.warning-dt);
    if($imports.PAT.transition){
      if($imports.PAT.locked){$imports.PAT.lost+=dt;if($imports.PAT.lost>2.5){$imports.PAT.locked=false;$imports.PAT.lock=0;if(!$imports.PAT.permanent){$imports.PAT.search=3;(0,$imports.gameFact)('patrol',{what:'lost'});}}}
      var tr=$imports.PAT.transition;tr.remaining=Math.max(0,tr.remaining-dt);if(tr.remaining<=1e-8){put(tr.to);$imports.PAT.transition=null;$imports.PAT.afterBlink=.22;framePath=null;}return;
    }
    var d=distance(),visible=sees(),cabinet=lockerTarget(),knownCabinet=!!(cabinet&&$imports.PatrolNav.los(position(),cabinet));
    /* 到达检查现场才等待，远处的永久追踪实体仍继续走。 */
    if(localQuiet()){$imports.PAT.lock=0;$imports.VisualState.patrolRed=0;return;}
    if(!hunting())clearChase();
    if(liftDoor())return;
    var hostile=hunting()&&$imports.PAT.safety<=0;
    if(hostile&&(visible||knownCabinet)){
      $imports.PAT.lastSeen=knownCabinet?cabinet:playerPoint();$imports.PAT.lost=0;
      if($imports.PAT.warning<=0){$imports.PAT.lock+=dt*(d<60?2.2:1.1);
        if(!$imports.PAT.locked&&$imports.PAT.lock>=1){
          if((0,$imports.hasItem)('seal')){(0,$imports.removeItem)('seal');banish();return;}
          $imports.PAT.locked=true;$imports.PAT.behavior='chase';if(!$imports.PAT.permanent&&!$imports.PAT.cited){$imports.PAT.cited=true;(0,$imports.addViolation)(8,'patrol');}
          (0,$imports.gameFact)('patrol',{what:'locked',permanent:!!$imports.PAT.permanent});
        }}
    }else if($imports.PAT.locked){
      $imports.PAT.lost+=dt;if($imports.PAT.lost>2.5){$imports.PAT.locked=false;$imports.PAT.lock=0;if(!$imports.PAT.permanent){$imports.PAT.search=3;(0,$imports.gameFact)('patrol',{what:'lost'});}framePath=null;}
    }else if(!$imports.PAT.locked)$imports.PAT.lock=Math.max(0,$imports.PAT.lock-dt);
    var goal=target();$imports.PAT.blinkCD=Math.max(0,$imports.PAT.blinkCD-dt);
    if($imports.PAT.safety<=0){
      var chase=$imports.PAT.permanent||$imports.PAT.locked;
      var arrived=navigate(goal,(chase?$imports.PAT_CHASE:$imports.PAT_SPEED)*dt);
      if(arrived){
        if($imports.PAT.behavior==='patrol'||$imports.PAT.behavior==='return'){$imports.PAT.behavior='patrol';$imports.PAT.routeIndex++;if($imports.PAT.routeIndex>=routeData().nodes.length){$imports.PAT.routeIndex=1;$imports.PAT.cycle++;}framePath=null;}

      }
    }
    var atGoal=goal&&$imports.PAT.room===goal.scene&&Math.hypot($imports.PAT.x-goal.x,$imports.PAT.y-goal.y,(($imports.PAT.fy||0)-(goal.fy||0))/$imports.U2M)<6;
    if($imports.PAT.search>0&&atGoal){$imports.PAT.search=Math.max(0,$imports.PAT.search-dt);if(!$imports.PAT.search){$imports.PAT.lastSeen=null;$imports.PAT.cited=false;$imports.PAT.rejoin=true;framePath=null;}}
    else if(atGoal&&!$imports.PAT.permanent&&!$imports.PAT.locked&&$imports.PAT.search<=0){
      if($imports.PAT.wirelessSignal){
        if($imports.PAT.warning<=0)$imports.PAT.wirelessSignal.remaining-=dt;
        if($imports.PAT.wirelessSignal.remaining<=1e-7){$imports.PAT.wirelessSignal=null;$imports.PAT.rejoin=true;framePath=null;$imports.Mechanics.dirty=true;}
      }
      else if($imports.PAT.investigation)$imports.PAT.investigation.remaining-=dt;else if($imports.PAT.memoryVisit)$imports.PAT.memoryVisit.remaining-=dt;
    }
    if($imports.PAT.investigation&&$imports.PAT.investigation.remaining<=0){$imports.PAT.investigation=null;$imports.PAT.rejoin=true;framePath=null;}
    if($imports.PAT.memoryVisit&&$imports.PAT.memoryVisit.remaining<=0){$imports.PAT.memoryVisit=null;$imports.PAT.rejoin=true;framePath=null;}
    if($imports.PAT.locked&&hostile&&$imports.PAT.afterBlink<=0&&distance()<$imports.PAT_CATCH&&(sees()||cabinet&&$imports.PatrolNav.los(position(),cabinet))&&$imports.PAT.warning<=0)
      (0,$imports.kill)($imports.HIDE.on?'柜门被拉开了。它一直知道你在这里。':'一只手按住了你的头顶。它在点名。','grip','patrol');
  }
  function visuals(dt){
    if($imports.PAT.state==='idle'){var sp=spawn(),audible=sp.scene===(0,$imports.patRoomHere)()&&$imports.PAT.respawn<=3.6&&$imports.PatrolNav.length($imports.PatrolNav.path(playerPoint(),sp))<190;var rt=(3.6-$imports.PAT.respawn)%1.8;$imports.VisualState.patrolFlick=audible&&(rt<.15||rt>.3&&rt<.45||rt>.75&&rt<1.25)?.7:0;$imports.VisualState.patrolRed=0;return;}
    var here=(0,$imports.patRoomHere)(),metric=approach(),near=metric&&metric.distance<200&&$imports.PAT.state==='walk';
    if(lastVisualRoom!==here){lastVisualRoom=here;(0,$imports.patRemoveFig)();}
    if($imports.PAT.state==='walk'&&$imports.PAT.room===here&&!$imports.PAT.transition)(0,$imports.patEnsureFig)();
    if($imports.PAT.room!==here||$imports.PAT.state!=='walk'||$imports.PAT.transition)(0,$imports.patRemoveFig)();
    $imports.VisualState.patrolRed=threat()?1:0;
    var t=3.6-$imports.PAT.warning,p=t%1.8;
    $imports.VisualState.patrolFlick=near&&$imports.PAT.warning>0&&(p<.15||p>.3&&p<.45||p>.75&&p<1.25)?.7:0;
    if(near){$imports.PAT.step-=dt;if($imports.PAT.step<=0){$imports.PAT.step=$imports.PAT.locked?.32:.7;var from=metric.direction,rel=Math.atan2(from.y-$imports.S.y,from.x-$imports.S.x)-$imports.S.ang;$imports.SFX.patStep(Math.sin(rel)*.9,Math.pow(1-metric.distance/200,1.4),Math.cos(rel)<-.2,$imports.PAT.locked,{m:metric.distance*$imports.U2M,muffled:!same()||!$imports.PatrolNav.los(position(),playerPoint())});}}
  }
  function tick(dt){if(!(dt>0)||$imports.S.dead||$imports.S.screen!=='play')return;if(!$imports.PAT.version)reset();
    var left=dt;while(left>1e-8&&!$imports.S.dead){var n=Math.min(left,.1,$imports.PAT.state==='idle'&&$imports.PAT.respawn>0?$imports.PAT.respawn:Infinity);step(n);left-=n;}
    visuals(dt);
  }
  function locationLabel(){
    if($imports.PAT.state==='idle')return '信号暂不可用';var tr=$imports.PAT.transition;
    if(tr){var a=$imports.INTERIORS[tr.from.scene],b=$imports.INTERIORS[tr.to.scene];if(tr.kind==='stairs')return '楼梯／'+a.floor+'F→'+b.floor+'F';if(tr.kind==='bridge')return (a&&a.host==='c1'||b&&b.host==='c1'?'连廊①':'连廊②')+'／2F';return '连接通道';}
    if($imports.PAT.room==='out')return '校园室外';var R=$imports.INTERIORS[$imports.PAT.room];if(!R)return '信号暂不可用';
    return ({admin:'行政楼',teach:'教学楼',lab:'实验楼',c1:'连廊①',c2:'连廊②',dream:'未知区域',garw:'地下车库',bell:'钟楼',dormN:'北宿舍',dormS:'南宿舍',tunnel:'隧道'}[R.host]||R.name)+'／'+R.floor+'F';
  }
  GameModules.on('leaveRoom',function(from,to){
    if(to==='lift_dream'&&$imports.RT.elevatorRide)$imports.PAT.mazeGateway={host:$imports.RT.elevatorRide.host,origin:$imports.RT.elevatorRide.origin};
    /* 目击穿过出口只提供该出口的另一端，不泄露进入之后的实时位置。 */
    if($imports.PAT.locked&&!$imports.PAT.permanent&&sees()&&from!==to&&$imports.PAT.room===(from||'out')){var p=$imports.PatrolNav.observedExit(from||'out',to||'out',playerPoint());if(p)$imports.PAT.lastSeen=p;}
    framePath=null;(0,$imports.patRemoveFig)();
  },{owner:'patrol-world'});
  GameModules.persistent('patrolWorld',{
    reset:reset,save:function(){return $imports.PAT;},
    load:function(d){
      if(!d||d.version!==1||![2,3].includes(d.routeVersion)){if(d&&d.permanent===true)$imports.PAT.permanent=true;(0,$imports.saveReport)('patrolWorld','旧或非法巡察状态改为固定安全出生');$imports.HIDE.seen=false;return;}
      var base=Object.assign({},$imports.PAT);Object.keys(base).forEach(function(k){if(d[k]!==undefined)$imports.PAT[k]=d[k];});
      ['x','y','fy','lock','lost','search','respawn','safety','warning','blinkCD','afterBlink','step','stuck'].forEach(function(k){if(!Number.isFinite($imports.PAT[k])){$imports.PAT[k]=base[k];(0,$imports.saveReport)('patrolWorld','非法巡察计时已修复：'+k);}});
      $imports.PAT.permanent=d.permanent===true;$imports.PAT.locked=d.locked===true;$imports.PAT.cited=d.cited===true;$imports.PAT.respawn=(0,$imports.clamp)($imports.PAT.respawn,0,30);$imports.PAT.safety=(0,$imports.clamp)($imports.PAT.safety,0,3.6);$imports.PAT.warning=(0,$imports.clamp)($imports.PAT.warning,0,3.6);$imports.PAT.search=(0,$imports.clamp)($imports.PAT.search,0,3);$imports.PAT.blinkCD=(0,$imports.clamp)($imports.PAT.blinkCD,0,TRAVEL_CD);$imports.PAT.afterBlink=(0,$imports.clamp)($imports.PAT.afterBlink,0,.22);
      if(!['walk','idle'].includes($imports.PAT.state))$imports.PAT.state='walk';
      function navigable(scene){return scene==='lift_dream'||!!$imports.StairWorld.config(scene)||Object.prototype.hasOwnProperty.call($imports.PATROL_GEOMETRY,scene);}
      if(!navigable($imports.PAT.room)){put(spawn());$imports.PAT.transition=null;$imports.PAT.safety=3.6;(0,$imports.saveReport)('patrolWorld','非法场景已恢复到固定出生点，追踪策略保留');}
      if(!$imports.StairWorld.config($imports.PAT.room)&&$imports.PAT.room!=='bell1'&&($imports.PAT.room!=='lift_dream'||typeof $imports.VoidMaze==='undefined'))$imports.PAT.fy=0;
      if($imports.PAT.room==='bell1')$imports.PAT.fy=(0,$imports.clamp)($imports.PAT.fy,0,$imports.SPIRAL.topH);
      if(!['patrol','investigate','chase','search','return','transit'].includes($imports.PAT.behavior))$imports.PAT.behavior='patrol';
      $imports.PAT.near=d.near===true;$imports.PAT.lock=(0,$imports.clamp)($imports.PAT.lock,0,1);$imports.PAT.lost=(0,$imports.clamp)($imports.PAT.lost,0,1e6);$imports.PAT.regionSeq=Math.floor((0,$imports.saveNum)(d.regionSeq,0,1e9));
      $imports.PAT.mazeGateway=d.mazeGateway&&['teach','lab'].includes(d.mazeGateway.host)&&Number.isInteger(d.mazeGateway.origin)&&d.mazeGateway.origin>=1&&d.mazeGateway.origin<=5?d.mazeGateway:null;
      $imports.PAT.cycle=Math.floor((0,$imports.saveNum)(d.cycle,0,1e9));$imports.PAT.rejoin=d.rejoin===true;$imports.PAT.lockerMemory={};
      function validLocker(m,scene){var R=$imports.INTERIORS[scene];return m&&R&&Number.isInteger(m.c)&&Number.isInteger(m.r)&&R.grid[m.r]&&R.grid[m.r][m.c]==='H';}
      Object.keys(d.lockerMemory||{}).forEach(function(scene){var m=d.lockerMemory[scene];if(validLocker(m,scene))$imports.PAT.lockerMemory[scene]={c:m.c,r:m.r,cycle:Number.isInteger(m.cycle)?m.cycle:-1};});
      $imports.PAT.memoryVisit=validLocker(d.memoryVisit,d.memoryVisit&&d.memoryVisit.scene)?{scene:d.memoryVisit.scene,c:d.memoryVisit.c,r:d.memoryVisit.r,remaining:Number.isFinite(d.memoryVisit.remaining)?(0,$imports.clamp)(d.memoryVisit.remaining,0,4):4}:null;
      function validPoint(p){return p&&navigable(p.scene)&&[p.x,p.y,p.fy===undefined?0:p.fy].every(Number.isFinite);}
      if(!validPoint($imports.PAT.lastSeen))$imports.PAT.lastSeen=null;
      var signal=d.wirelessSignal;
      $imports.PAT.wirelessSignal=signal&&validPoint(signal.point)&&Number.isFinite(signal.remaining)&&signal.remaining>=0&&signal.remaining<=3?
        {point:$imports.PatrolNav.point(signal.point.scene,signal.point.x,signal.point.y,signal.point.fy),remaining:signal.remaining,
          locker:validLocker(signal.locker,signal.locker&&signal.locker.scene)&&signal.locker.scene===signal.point.scene?
            {scene:signal.locker.scene,c:signal.locker.c,r:signal.locker.r}:null}:null;
      $imports.PAT.lastRegion=zoneById(d.lastRegion)?d.lastRegion:null;
      var dr=d.doorRush;$imports.PAT.doorRush=dr&&['teach','lab'].includes(dr.host)&&Number.isInteger(dr.floor)&&dr.floor>=1&&dr.floor<=5&&dr.scene===dr.host+dr.floor&&[dr.x,dr.y,dr.eta].every(Number.isFinite)?
        {host:dr.host,floor:dr.floor,scene:dr.scene,x:dr.x,y:dr.y,eta:dr.eta}:null;
      $imports.PAT.queue=Array.isArray(d.queue)?d.queue.filter(function(e){return e&&zoneById(e.regionId)&&Number.isFinite(e.sequence)&&Number.isFinite(e.enteredAt);}).slice(0,$imports.PATROL_ZONES.length):[];
      $imports.PAT.investigation=d.investigation&&zoneById(d.investigation.regionId)?d.investigation:null;
      if($imports.PAT.investigation)$imports.PAT.investigation.remaining=Number.isFinite($imports.PAT.investigation.remaining)?(0,$imports.clamp)($imports.PAT.investigation.remaining,0,6):6;
      $imports.PAT.queue=$imports.PAT.queue.filter(function(e,i,a){return a.findIndex(function(q){return q.regionId===e.regionId;})===i;});
      $imports.PAT.routeIndex=Math.floor((0,$imports.saveNum)(d.routeIndex,0,routeData().nodes.length-1));
      if($imports.PAT.transition&&(!validPoint($imports.PAT.transition.to)||!validPoint($imports.PAT.transition.from)||!Number.isFinite($imports.PAT.transition.total)||$imports.PAT.transition.total<=0||$imports.PAT.transition.total>3||!Number.isFinite($imports.PAT.transition.remaining)||$imports.PAT.transition.remaining<0||$imports.PAT.transition.remaining>$imports.PAT.transition.total)){$imports.PAT.transition=null;(0,$imports.saveReport)('patrolWorld','无效连接进度已取消');}
      if(!$imports.PAT.transition&&$imports.PAT.room==='lift_dream'&&typeof $imports.VoidMaze!=='undefined'){
        var mq=$imports.VoidMaze.toScene($imports.PAT.x,$imports.PAT.y),mh=$imports.VoidMaze.groundAt(mq.x,mq.z,$imports.PAT.fy+.45);
        if(!Number.isFinite(mh)||Math.abs(mh-$imports.PAT.fy)>.45||$imports.VoidMaze.depthAt(mq.x,mq.z,.30,$imports.PAT.fy)>1e-7){put(spawn());$imports.PAT.safety=3.6;(0,$imports.saveReport)('patrolWorld','无支撑的迷宫落点已恢复，追踪策略保留');}
      }
      if(!$imports.PAT.transition&&$imports.PAT.room==='bell1'){
        var bp=(0,$imports.spPolar)($imports.INTERIORS.bell1,$imports.PAT.x,$imports.PAT.y),bn=$imports.PatrolNav.grid('bell1');
        var bellValid=$imports.PAT.fy<.01?$imports.PatrolNav.free('bell1',Math.floor(($imports.PAT.x-bn.ox)/bn.step),Math.floor(($imports.PAT.y-bn.oy)/bn.step)):
          bp.r>=$imports.SPIRAL.rIn+.29&&bp.r<=$imports.SPIRAL.rOut-.29&&($imports.PAT.fy===$imports.SPIRAL.topH?((0,$imports.spTopOffset)(bp.th)<-$imports.SPIRAL.hole||(0,$imports.spTopOffset)(bp.th)>=-$imports.SPIRAL.arrive):Math.abs((0,$imports.spWrap)(bp.th-$imports.SPIRAL.th0-$imports.PAT.fy/$imports.SPIRAL.turnH*$imports.TAU))<.12);
        if(!bellValid){put(spawn());$imports.PAT.safety=3.6;(0,$imports.saveReport)('patrolWorld','非法旋梯落点已恢复，追踪策略保留');}
      }
      if(!$imports.StairWorld.config($imports.PAT.room)&&($imports.PAT.room!=='lift_dream'||typeof $imports.VoidMaze==='undefined')&&$imports.PAT.room!=='bell1'&&!$imports.PAT.transition){var p=$imports.PatrolNav.snap($imports.PAT.room,position());if(p&&Math.hypot(p.x-$imports.PAT.x,p.y-$imports.PAT.y)<30){var n=$imports.PatrolNav.grid($imports.PAT.room);if(!$imports.PatrolNav.free($imports.PAT.room,Math.floor(($imports.PAT.x-n.ox)/n.step),Math.floor(($imports.PAT.y-n.oy)/n.step))){put(p);(0,$imports.saveReport)('patrolWorld','巡察嵌入碰撞，恢复到邻近安全点');}}else{put(spawn());$imports.PAT.safety=3.6;(0,$imports.saveReport)('patrolWorld','巡察碰撞落点已修复');}}
      if(!$imports.PAT.transition&&$imports.StairWorld.config($imports.PAT.room)&&$imports.StairWorld.depth($imports.PAT.room,$imports.PAT.x,$imports.PAT.y,2.7,$imports.PAT.fy)>1e-7){put(spawn());$imports.PAT.safety=3.6;(0,$imports.saveReport)('patrolWorld','无支撑的楼梯落点已恢复，追踪策略保留');}
      if(d.routeVersion===2){$imports.PAT.routeIndex=1;$imports.PAT.rejoin=true;$imports.PAT.transition=null;}
      $imports.PAT.routeVersion=3;
      framePath=null;
    }
  });
  return {reset:reset,tick:tick,position:position,eligible:eligible,exempt:exempt,hunting:hunting,revealWireless:revealWireless,sees:sees,same:same,region:region,
    localChase:function(){return threat()&&$imports.PAT.locked;},localThreat:function(){return threat()||hideThreat();},pressure:function(){return threat()?.35:hideThreat()?.18:0;},
    rescued:rescued,registeredAbsence:registeredAbsence,observeLocker:function(c,r){var f=(0,$imports.lockerFront)($imports.INTERIORS[$imports.S.room],c,r);$imports.PAT.lastSeen=$imports.PatrolNav.point($imports.S.room,f.x,f.y,$imports.S.floorY);$imports.PAT.lockerMemory[$imports.S.room]={c:c,r:r,cycle:-1};framePath=null;},banish:banish,clearChase:clearChase,locationLabel:locationLabel,enqueue:enqueue,spawn:spawn};
})();

/* @module-exports */
GameModules.publish("game3d/js/modules/patrol-world/world.js",{
"PatrolWorld":{get:function(){return PatrolWorld;},set:function($value){PatrolWorld=$value;}}
});
})(GameModules.imports("game3d/js/modules/patrol-world/world.js"));
