/* @module-capsule */
(function($imports){
/* 两栋楼各一台电梯；所有等待、开关门和运行时长均为模拟运行秒。
   M2 电梯直通（计划《电梯直通、新天赋、新结局与恐怖氛围》12.10）：轿厢接在每层电梯门后面，算作这一层房间的附属区域，
   门开着时直接走进走出，不换场景；只有门关上、电梯要运行时才换到轿厢房间（lift_teach / lift_lab），到站时换回目标楼层的
   同一个位置再开门。门关着的时候两边看到的轿厢一模一样，看不出切换。 */
'use strict';

var ELEVATOR_CONFIG={wait:3,travel:2,perFloor:0.7,rareChance:0.08,dreamSan:5,open:0.9,close:1.0,hold:4};
/* 门洞和轿厢（米）。原点是电梯门格中心，a 朝走廊为正、b 沿门宽：层门在 a=0.40，轿门在 a=−0.47，
   轿厢里面从 a=−0.5 到 −1.95、宽 ±0.75（外壁 ±0.8）；门洞两侧门框之间 ±0.47 */
/* landing、half 和 content/lift-recipe.js 的 LIFT_DOOR_Z、LIFT_DOOR_HALF 一样（模块加载时不读别的模块） */
var LIFT_GEO=Object.freeze({landing:0.40,car:-0.47,inner:-0.5,back:-1.95,half:0.47,cabinHalf:0.75,outer:0.80,depth:2.05});
var Elevator={
  state:function(host){
    if(!$imports.RT.elevators)$imports.RT.elevators={};
    if(!$imports.RT.elevators[host])$imports.RT.elevators[host]={floor:1,phase:'idle',remaining:0,target:1,door:0,dir:0,hold:0};
    var lift=$imports.RT.elevators[host];
    if(!Number.isFinite(lift.door)){lift.door=0;lift.dir=0;lift.hold=0;}     /* 旧存档没有门的状态 */
    return lift;
  },
  peek:function(host){return $imports.RT.elevators&&$imports.RT.elevators[host]||{floor:1,phase:'idle',remaining:0,target:1,door:0,dir:0,hold:0};},
  /* 在运行中的轿厢房间里（门关着、电梯在走）；站在楼层门后的轿厢里不算 */
  inRide:function(){return $imports.S.mode==='in'&&['lift_teach','lift_lab','lift_dream'].indexOf($imports.S.room)>=0;},
  recover:function(){
    if($imports.RT.elevatorRide)return $imports.RT.elevatorRide;
    var host=$imports.S.room==='lift_lab'?'lab':'teach',dream=$imports.S.room==='lift_dream';
    $imports.RT.elevatorRide={host:host,origin:1,target:1,phase:dream?'dream':'cabin',rare:false,remaining:0};
    return $imports.RT.elevatorRide;
  },
  unsafe:function(){
    return $imports.AN.active||$imports.PatrolWorld.localChase()||(typeof $imports.Inspection!=='undefined'&&$imports.Inspection.pending());
  },
  spawn:function(room,c,r,angle){
    var R=$imports.INTERIORS[room];
    return {x:R.ox+(c+0.5)*R.tw,y:R.oy+(r+0.5)*R.th,ang:angle};
  },
  /* 电梯门外、走廊里的一点（巡察、导航和旧接口用） */
  landing:function(host,floor){
    var id=host+floor;
    return Elevator.spawn(id,host==='teach'?20:10,host==='teach'?20:18,Math.PI/2);
  },
  /* 电梯门格和它的朝向。out：门格朝走廊（楼层）或朝轿门外（轿厢房间）的单位向量（世界坐标） */
  frame:function(R){
    if(!R||!R.grid)return null;
    if(R._liftFrame&&R._liftFrame.ox===R.ox&&R._liftFrame.oy===R.oy)return R._liftFrame.f;
    var f=null;
    if(R.host==='lift'||((R.host==='teach'||R.host==='lab')&&R.floor>=1&&R.floor<=5)){
      for(var y=0;y<R.rows&&!f;y++)for(var x=0;x<R.cols&&!f;x++){
        if(R.grid[y][x]!=='J')continue;
        var d=(0,$imports.liftOpenSide)(R,x,y);if(!d)continue;
        var out=R.host==='lift'?[-d[0],-d[1]]:[d[0],d[1]];
        f={c:x,r:y,jx:R.ox+(x+0.5)*R.tw,jy:R.oy+(y+0.5)*R.th,ox:out[0],oy:out[1],lx:-out[1],ly:out[0]};
      }
    }
    R._liftFrame={ox:R.ox,oy:R.oy,f:f};
    return f;
  },
  local:function(R,x,y){
    var f=Elevator.frame(R);if(!f)return null;
    var dx=(x-f.jx)*$imports.U2M,dy=(y-f.jy)*$imports.U2M;
    return {a:dx*f.ox+dy*f.oy,b:dx*f.lx+dy*f.ly};
  },
  world:function(R,a,b){
    var f=Elevator.frame(R);
    return {x:f.jx+(a*f.ox+b*f.lx)/$imports.U2M,y:f.jy+(a*f.oy+b*f.ly)/$imports.U2M};
  },
  /* 朝向从一个门框换到另一个：相对门的角度不变 */
  turn:function(from,to,ang){
    var f=Elevator.frame(from),t=Elevator.frame(to);
    return ang-Math.atan2(f.oy,f.ox)+Math.atan2(t.oy,t.ox);
  },
  /* 楼层房间里门后那块轿厢（连同门格）：碰撞放宽房间边界用 */
  annexAt:function(R,x,y){
    if(!R||R.host==='lift')return false;
    var p=Elevator.local(R,x,y);
    return !!p&&p.a<=0.5&&p.a>=-LIFT_GEO.depth&&Math.abs(p.b)<=LIFT_GEO.outer;
  },
  /* 人算不算进了电梯：跨过层门 */
  inCabin:function(R,x,y){
    R=R||$imports.INTERIORS[$imports.S.room];if(!R||R.host==='lift'||$imports.S.mode!=='in')return false;
    var p=Elevator.local(R,x===undefined?$imports.S.x:x,y===undefined?$imports.S.y:y);
    return !!p&&p.a<LIFT_GEO.landing-0.05&&p.a>-LIFT_GEO.depth&&Math.abs(p.b)<LIFT_GEO.outer;
  },
  /* 门槛上（两道门之间那一段门洞）有没有人：有人门就不关 */
  inDoorway:function(R,x,y,r){
    var p=Elevator.local(R,x,y);if(!p)return false;r=(r||0)*$imports.U2M;
    return p.a+r>LIFT_GEO.car-0.05&&p.a-r<LIFT_GEO.landing+0.04&&Math.abs(p.b)<LIFT_GEO.half+r;
  },
  /* 门外、身体贴到门前（离层门不到 15 厘米）：关门时走到门口，门重新打开一次 */
  approaching:function(R,x,y,r){
    var p=Elevator.local(R,x,y);if(!p)return false;r=(r||0)*$imports.U2M;
    return p.a-r<LIFT_GEO.landing+0.15&&p.a>LIFT_GEO.landing-0.05&&Math.abs(p.b)<0.6;
  },
  /* 层门开度 0–1（电梯不在这一层就是关着的） */
  doorAmount:function(host,floor){
    if(host!=='teach'&&host!=='lab')return 0;
    var lift=Elevator.peek(host);
    return lift.floor===floor&&lift.phase!=='waiting'&&lift.phase!=='occupied'?(lift.door||0):0;
  },
  doorOpen:function(host,floor){return Elevator.doorAmount(host,floor)>0.5?1:0;},
  /* 门关着（没开足）时挡住门洞：层门、轿门两道 */
  /* 两道门（层门、轿门）关着时占的地方：世界坐标的矩形 */
  doorRects:function(R){
    return [[LIFT_GEO.landing-0.04,LIFT_GEO.landing+0.04],[LIFT_GEO.car-0.04,LIFT_GEO.car+0.04]].map(function(s){
      var p=Elevator.world(R,s[0],-LIFT_GEO.half),q=Elevator.world(R,s[1],LIFT_GEO.half);
      return [Math.min(p.x,q.x),Math.min(p.y,q.y),Math.max(p.x,q.x),Math.max(p.y,q.y)];
    });
  },
  doorDepth:function(R,x,y,r){
    if(!R||R.host==='lift'||!Elevator.frame(R))return 0;
    if(Elevator.doorAmount(R.host,R.floor)>=0.9)return 0;
    var total=0;
    Elevator.doorRects(R).forEach(function(b){total+=$imports.Collision.rectDepth(x,y,r,b[0],b[1],b[2],b[3]);});
    return total;
  },
  /* 旧存档在旧轿厢（5 × 5 米）里的位置：放回现在轿厢的正中 */
  fixCabinPosition:function(){
    if($imports.S.mode!=='in'||($imports.S.room!=='lift_teach'&&$imports.S.room!=='lift_lab')) return;
    var R=$imports.INTERIORS[$imports.S.room], p=Elevator.spawn($imports.S.room,2,1.25,-Math.PI/2);
    if(!R||Math.abs($imports.S.x-p.x)>0.75*R.tw||Math.abs($imports.S.y-p.y)>0.7*R.th){ $imports.S.x=p.x; $imports.S.y=p.y; $imports.S.ang=p.ang; $imports.S.seated=false; }
    /* 旧存档：停在轿厢房间里、电梯没在运行（以前要点「离开电梯」）——放回出发那一层门后的轿厢里 */
    var ride=$imports.RT.elevatorRide;
    if(ride&&ride.phase==='cabin')Elevator.arrive(ride.origin,{quiet:true});
  },
  cancel:function(){
    var ride=$imports.RT.elevatorRide;
    if(ride&&(ride.host==='teach'||ride.host==='lab')){
      var lift=Elevator.state(ride.host);lift.floor=ride.origin;lift.phase='idle';lift.remaining=0;
    }
    $imports.RT.elevatorRide=null;
  },
  /* 开门：不安全时门不开，面板闪一下 */
  open:function(host,why){
    var lift=Elevator.state(host);
    if(why!=='ride'&&Elevator.unsafe()){
      lift.flash=0.6;if($imports.S.mode==='in'&&$imports.S.room===host+lift.floor)(0,$imports.os)('〔电梯没有反应〕楼层灯闪了一下。',2.4);
      return false;
    }
    if(lift.door<1)lift.dir=1;else lift.hold=ELEVATOR_CONFIG.hold;
    return true;
  },
  close:function(host){
    var lift=Elevator.state(host);
    if(lift.door>0){lift.dir=-1;lift.hold=0;}
  },
  /* 走廊里按呼梯键 */
  interact:function(){
    if($imports.S.room==='lift_dream'){Elevator.leaveDream();return;}
    if($imports.S.room==='lift_teach'||$imports.S.room==='lift_lab'){Elevator.controls();return;}
    var R=$imports.INTERIORS[$imports.S.room];
    if(!R||['teach','lab'].indexOf(R.host)<0||R.floor>5)return;
    if(Elevator.inCabin(R)){Elevator.controls();return;}
    var lift=Elevator.state(R.host);
    if(lift.phase==='waiting'){
      (0,$imports.os)(lift.target===R.floor?'我：电梯还在路上。':'我：电梯正在回应别的楼层。',2.4);return;
    }
    if(lift.phase==='occupied'){(0,$imports.os)('我：电梯正在运行。',2.2);return;}
    if(lift.floor!==R.floor){
      lift.target=R.floor;lift.remaining=ELEVATOR_CONFIG.wait+Math.abs(lift.floor-R.floor)*ELEVATOR_CONFIG.perFloor;
      lift.phase='waiting';(0,$imports.autoSave)();(0,$imports.os)('我：按下呼梯键。楼层指示灯缓慢亮了起来。',3);return;
    }
    if(lift.door>=1&&lift.dir>=0){lift.hold=ELEVATOR_CONFIG.hold;return;}
    if(Elevator.open(R.host))(0,$imports.os)('我：按下呼梯键。门开了。',2);
  },
  /* 跨进门的那一刻：错误的电梯在这里定，存进档里，读档不重抽 */
  enterCabin:function(host,floor){
    if($imports.RT.elevatorRide&&$imports.RT.elevatorRide.host===host&&$imports.RT.elevatorRide.phase==='cabin'){$imports.RT.elevatorRide.origin=floor;return $imports.RT.elevatorRide;}
    $imports.RT.elevatorRide={host:host,origin:floor,target:floor,phase:'cabin',rare:$imports.GameRandom.next()<ELEVATOR_CONFIG.rareChance,remaining:0,pending:null};
    (0,$imports.autoSave)();
    return $imports.RT.elevatorRide;
  },
  /* 测试、调试和旧接口：直接站进这一层门后的轿厢，门关着 */
  board:function(host,floor){
    if(Elevator.unsafe())return;
    var R=$imports.INTERIORS[host+floor],lift=Elevator.state(host);
    lift.floor=floor;lift.target=floor;lift.phase='idle';lift.remaining=0;lift.door=0;lift.dir=0;lift.hold=0;
    (0,$imports.resetInputState)();
    var p=Elevator.world(R,(LIFT_GEO.inner+LIFT_GEO.back)/2,0),f=Elevator.frame(R);
    (0,$imports.doEnterRoom)(R.id,{x:p.x,y:p.y,ang:Math.atan2(f.oy,f.ox),seamless:true});    /* 轿厢正中，面朝轿门 */
    Elevator.enterCabin(host,floor);
  },
  /* 轿厢里的操纵盘：门开着时先关门；选本层等于开门 */
  controls:function(){
    var ride=Elevator.recover();
    if(ride.phase==='moving'){(0,$imports.os)('我：电梯还在运行。',2);return;}
    var lift=Elevator.state(ride.host);
    if(lift.door>0&&!Elevator.inRide()&&!Elevator.inDoorway($imports.INTERIORS[$imports.S.room],$imports.S.x,$imports.S.y,$imports.PRAD))Elevator.close(ride.host);
    var opts=[];
    if(ride.rare){
      ['67','89'].forEach(function(n){opts.push({label:n+' 层',fn:function(){Elevator.press(n);}});});
    }else{
      for(var floor=1;floor<=5;floor++)(function(f){
        opts.push({label:f+' 层'+(f===ride.origin?'（开门）':''),fn:function(){Elevator.press(f);}});
      })(floor);
    }
    $imports.UI.choice('轿厢里的按钮亮着。',opts);
  },
  /* 按下一个楼层键：门关上以后才走（门槛上有人就一直开着） */
  press:function(target){
    var ride=$imports.RT.elevatorRide;if(!ride||ride.phase!=='cabin')return;
    var lift=Elevator.state(ride.host);
    if(target===ride.origin){Elevator.open(ride.host,'ride');ride.pending=null;return;}
    ride.pending=target;
    if(lift.door<=0)Elevator.depart();else Elevator.close(ride.host);
  },
  depart:function(){
    var ride=$imports.RT.elevatorRide;if(!ride||ride.phase!=='cabin'||ride.pending===null||ride.pending===undefined)return;
    var target=ride.pending;ride.pending=null;
    if(target==='67'||target==='89'){Elevator.enterDream(target);return;}
    var lift=Elevator.state(ride.host),from=$imports.INTERIORS[ride.host+ride.origin],car=$imports.INTERIORS['lift_'+ride.host];
    var p=Elevator.local(from,$imports.S.x,$imports.S.y)||{a:(LIFT_GEO.inner+LIFT_GEO.back)/2,b:0},w=Elevator.world(car,p.a,p.b),ang=Elevator.turn(from,car,$imports.S.ang);
    ride.target=target;ride.phase='moving';ride.remaining=ELEVATOR_CONFIG.travel+Math.abs(target-ride.origin)*ELEVATOR_CONFIG.perFloor;
    lift.phase='occupied';lift.door=0;lift.dir=0;
    (0,$imports.patRemoveFig)();
    (0,$imports.doEnterRoom)(car.id,{x:w.x,y:w.y,ang:ang,seamless:true});
    (0,$imports.autoSave)();(0,$imports.os)('我：门合上，电梯向目标楼层运行。',2.8);
  },
  /* 兼容旧接口：在轿厢里直接选楼层 */
  move:function(floor){Elevator.press(floor);},
  enterDream:function(button){
    var ride=$imports.RT.elevatorRide;if(!ride||ride.phase!=='cabin'||!ride.rare)return;
    ride.button=button;ride.phase='dream';$imports.PlayerStats.changeSan(-(ELEVATOR_CONFIG.dreamSan),'elevator',{min:0});(0,$imports.settleSan)();
    if($imports.S.dead)return;
    var lift=Elevator.state(ride.host);lift.door=0;lift.dir=0;
    (0,$imports.gameFact)('maze',{what:'enter',button:button});
    if(typeof $imports.VoidMaze!=='undefined'){$imports.VoidMaze.enter(button);return;}   /* 门外是虚空迷宫（模块 void-maze） */
    (0,$imports.doEnterRoom)('lift_dream',Elevator.spawn('lift_dream',2,5,0));        /* 没装这个模块时：原来的白色空间 */
    (0,$imports.os)('我：门外是一片白色。远处有一道淡蓝色的门。',4,$imports.OS_FORCE);
  },
  leaveDream:function(){
    var ride=Elevator.recover();if(ride.phase!=='dream')return;
    if(typeof $imports.VoidMaze!=='undefined'){$imports.VoidMaze.leave('exit1');return;}
    Elevator.arrive(ride.origin);
    (0,$imports.os)('我：门合上了。外面的走廊和刚才一样。',3);
  },
  /* 到站：换回目标楼层门后的轿厢（门关着时换，看不出来），再开门 */
  arrive:function(floor,opts){
    var ride=$imports.RT.elevatorRide;if(!ride)return;
    var lift=Elevator.state(ride.host),R=$imports.INTERIORS[ride.host+floor],car=$imports.INTERIORS['lift_'+ride.host];
    if(ride.phase==='dream'){
      /* 从虚空迷宫推门出来：站在电梯门外的走廊里，背对电梯；身后的电梯门关着（「身后的门变回了电梯门」） */
      var f=Elevator.frame(R),q=Elevator.world(R,1.0,0);
      lift.floor=floor;lift.target=floor;lift.phase='idle';lift.remaining=0;lift.door=0;lift.dir=0;lift.hold=0;
      $imports.RT.elevatorRide=null;(0,$imports.resetInputState)();
      (0,$imports.doEnterRoom)(R.id,{x:q.x,y:q.y,ang:Math.atan2(f.oy,f.ox)});
      return;
    }
    var p=$imports.S.mode==='in'&&$imports.S.room===car.id?Elevator.local(car,$imports.S.x,$imports.S.y):null,ang;
    if(!p||p.a>LIFT_GEO.inner||p.a<LIFT_GEO.back)p={a:(LIFT_GEO.inner+LIFT_GEO.back)/2,b:0};
    p.b=(0,$imports.clamp)(p.b,-LIFT_GEO.cabinHalf+0.34,LIFT_GEO.cabinHalf-0.34);p.a=(0,$imports.clamp)(p.a,LIFT_GEO.back+0.34,LIFT_GEO.inner-0.34);
    ang=$imports.S.room===car.id?Elevator.turn(car,R,$imports.S.ang):Math.atan2(Elevator.frame(R).oy,Elevator.frame(R).ox);
    var w=Elevator.world(R,p.a,p.b);
    lift.floor=floor;lift.target=floor;lift.phase='idle';lift.remaining=0;lift.door=0;lift.dir=1;lift.hold=0;
    ride.origin=floor;ride.target=floor;ride.phase='cabin';ride.remaining=0;ride.pending=null;
    (0,$imports.resetInputState)();(0,$imports.doEnterRoom)(R.id,{x:w.x,y:w.y,ang:ang,seamless:true});
    if(!(opts&&opts.quiet))(0,$imports.os)('我：叮。电梯门打开了。',2.2);
  },
  /* 每个模拟步：叫来的电梯走到、门的开关、跨进跨出、门关上后出发、运行中到站 */
  tick:function(dt){
    var R=$imports.S.mode==='in'?$imports.INTERIORS[$imports.S.room]:null;
    ['teach','lab'].forEach(function(host){
      var lift=Elevator.state(host);
      if(lift.flash>0)lift.flash=Math.max(0,lift.flash-dt);
      if(lift.phase==='waiting'){
        lift.remaining=Math.max(0,lift.remaining-dt);
        if(lift.remaining===0){
          lift.floor=lift.target;lift.phase='idle';lift.door=0;lift.dir=0;
          if($imports.S.mode==='in'&&$imports.S.room===host+lift.floor){(0,$imports.os)('我：叮。电梯到了。',2);Elevator.open(host);}
        }
        return;
      }
      if(lift.phase==='occupied')return;
      var here=!!R&&R.host===host&&R.floor===lift.floor&&!$imports.S.dead;
      var blocked=here&&Elevator.inDoorway(R,$imports.S.x,$imports.S.y,$imports.PRAD);
      var near=here&&Elevator.approaching(R,$imports.S.x,$imports.S.y,$imports.PRAD);
      if(!near)lift.nudged=false;
      if(lift.dir>0){
        lift.door=Math.min(1,lift.door+dt/ELEVATOR_CONFIG.open);
        if(lift.door>=1){lift.dir=0;lift.hold=ELEVATOR_CONFIG.hold;}
      }else if(lift.dir<0){
        if(blocked||(near&&!lift.nudged)){lift.dir=1;if(!blocked)lift.nudged=true;}   /* 门槛上有人、或关门时走到门口：重新打开（门口站着不动只开一次） */
        else{
          lift.door=Math.max(0,lift.door-dt/ELEVATOR_CONFIG.close);
          if(lift.door<=0){lift.dir=0;var ride=$imports.RT.elevatorRide;
            if(ride&&ride.host===host&&ride.phase==='cabin'&&ride.pending!==null&&ride.pending!==undefined&&Elevator.inCabin(R))Elevator.depart();}
        }
      }else if(lift.door>=1){
        if(blocked)lift.hold=Math.max(lift.hold,1);
        else{lift.hold=Math.max(0,lift.hold-dt);if(lift.hold<=0)lift.dir=-1;}
      }
    });
    /* 跨进、跨出 */
    if(R&&R.host!=='lift'&&(R.host==='teach'||R.host==='lab')&&R.floor<=5&&!$imports.S.dead){
      var ride=$imports.RT.elevatorRide,inside=Elevator.inCabin(R);
      if(inside&&(!ride||ride.phase!=='cabin'||ride.host!==R.host))Elevator.enterCabin(R.host,R.floor);
      else if(!inside&&ride&&ride.phase==='cabin'&&ride.host===R.host){
        var p=Elevator.local(R,$imports.S.x,$imports.S.y);
        if(p&&p.a>LIFT_GEO.landing+0.05)$imports.RT.elevatorRide=null;
      }
    }
    var ride2=$imports.RT.elevatorRide;
    if(!ride2||ride2.phase!=='moving'||!Elevator.inRide())return;
    ride2.remaining=Math.max(0,ride2.remaining-dt);
    if(ride2.remaining===0)Elevator.arrive(ride2.target);
  }
};
/* 楼层房间：门后的轿厢放宽房间边界，门没开足时挡住门洞（模块级挂在房间上，和楼梯间、虚空迷宫一样） */
GameModules.on('interiors',function(){
  ['teach','lab'].forEach(function(host){for(var f=1;f<=5;f++){var R=$imports.INTERIORS[host+f];if(!R)continue;
    R.annexAt=function(x,y){return Elevator.annexAt(this,x,y);};
    R.collide=function(x,y,r){return Elevator.doorDepth(this,x,y,r);};
    R.solid=function(x,y){return Elevator.doorDepth(this,x,y,0.01)>0;};
    /* 穿模审查用：门关着时两道门板的占地（米，房间中心为原点），门扇模型就在这里面 */
    R.doorBoxes=function(){var R2=this;return Elevator.doorRects(R2).map(function(b){
      return {x0:(b[0]-R2.cx)*$imports.U2M,z0:(b[1]-R2.cy)*$imports.U2M,x1:(b[2]-R2.cx)*$imports.U2M,z1:(b[3]-R2.cy)*$imports.U2M};});};
  }});
},{owner:'elevator'});
GameModules.on('interact',function(){
  if($imports.S.mode!=='in'||!Elevator.inCabin())return undefined;
  Elevator.controls();return true;
},{owner:'elevator'});
GameModules.on('hint',function(){
  if($imports.S.mode!=='in'||!Elevator.inCabin())return undefined;
  var ride=$imports.RT.elevatorRide;if(ride&&ride.phase==='moving')return '';
  var R=$imports.INTERIORS[$imports.S.room];return Elevator.doorAmount(R.host,R.floor)>0?'关门 · 选楼层':'选楼层';
},{owner:'elevator'});

/* @module-exports */
GameModules.publish("game3d/js/elevator.js",{
"ELEVATOR_CONFIG":{get:function(){return ELEVATOR_CONFIG;},set:function($value){ELEVATOR_CONFIG=$value;}},
"LIFT_GEO":{get:function(){return LIFT_GEO;},set:function($value){LIFT_GEO=$value;}},
"Elevator":{get:function(){return Elevator;},set:function($value){Elevator=$value;}}
});
})(GameModules.imports("game3d/js/elevator.js"));
