/* 两栋楼各一台电梯；所有等待和运行时长均为模拟运行秒。 */
'use strict';

var ELEVATOR_CONFIG={wait:3,travel:2,perFloor:0.7,rareChance:0.08,dreamSan:5};
var Elevator={
  state:function(host){
    if(!RT.elevators)RT.elevators={};
    if(!RT.elevators[host])RT.elevators[host]={floor:1,phase:'idle',remaining:0,target:1};
    return RT.elevators[host];
  },
  inRide:function(){return S.mode==='in'&&['lift_teach','lift_lab','lift_dream'].indexOf(S.room)>=0;},
  recover:function(){
    if(RT.elevatorRide)return RT.elevatorRide;
    var host=S.room==='lift_lab'?'lab':'teach',dream=S.room==='lift_dream';
    RT.elevatorRide={host:host,origin:1,target:1,phase:dream?'dream':'cabin',rare:false,remaining:0};
    return RT.elevatorRide;
  },
  unsafe:function(){
    return AN.active||PAT.locked||(typeof Inspection!=='undefined'&&Inspection.pending());
  },
  spawn:function(room,c,r,angle){
    var R=INTERIORS[room];
    return {x:R.ox+(c+0.5)*R.tw,y:R.oy+(r+0.5)*R.th,ang:angle};
  },
  landing:function(host,floor){
    var id=host+floor;
    return Elevator.spawn(id,host==='teach'?20:10,host==='teach'?20:18,Math.PI/2);
  },
  cancel:function(){
    var ride=RT.elevatorRide;
    if(ride&&(ride.host==='teach'||ride.host==='lab')){
      var lift=Elevator.state(ride.host);lift.floor=ride.origin;lift.phase='idle';lift.remaining=0;
    }
    RT.elevatorRide=null;
  },
  interact:function(){
    if(S.room==='lift_dream'){Elevator.leaveDream();return;}
    if(S.room==='lift_teach'||S.room==='lift_lab'){Elevator.controls();return;}
    var R=INTERIORS[S.room];
    if(!R||['teach','lab'].indexOf(R.host)<0||R.floor>5)return;
    if(Elevator.unsafe()){os('我：现在不能进电梯。先解决眼前的事。',2.8);return;}
    var lift=Elevator.state(R.host);
    if(lift.phase==='waiting'){
      os(lift.target===R.floor?'我：电梯还在路上。':'我：电梯正在回应别的楼层。',2.4);return;
    }
    if(lift.phase!=='ready'||lift.floor!==R.floor){
      lift.target=R.floor;lift.remaining=ELEVATOR_CONFIG.wait+Math.abs(lift.floor-R.floor)*ELEVATOR_CONFIG.perFloor;
      lift.phase='waiting';autoSave();os('我：按下呼梯键。楼层指示灯缓慢亮了起来。',3);return;
    }
    UI.choice('电梯门开了，轿厢里只有一排楼层按钮。',[
      {label:'走进电梯',fn:function(){Elevator.board(R.host,R.floor);}},
      {label:'再等等',fn:function(){}}
    ]);
  },
  board:function(host,floor){
    if(Elevator.unsafe())return;
    var lift=Elevator.state(host);
    RT.elevatorRide={host:host,origin:floor,target:floor,phase:'cabin',
      rare:Math.random()<ELEVATOR_CONFIG.rareChance,remaining:0};
    lift.floor=floor;lift.phase='occupied';patReset();resetInputState();
    var room='lift_'+host;
    doEnterRoom(room,Elevator.spawn(room,3,4,-Math.PI/2));
    os('我：轿厢很安静。走到按钮前，选一个楼层。',3.5);
  },
  controls:function(){
    var ride=Elevator.recover();
    if(ride.phase==='moving'){os('我：电梯还在运行。',2);return;}
    var opts=[];
    if(ride.rare){
      ['67','89'].forEach(function(n){opts.push({label:n+' 层',fn:function(){Elevator.enterDream(n);}});});
    }else{
      for(var floor=1;floor<=5;floor++)(function(f){
        opts.push({label:f+' 层'+(f===ride.origin?'（当前）':''),fn:function(){Elevator.move(f);}});
      })(floor);
    }
    opts.push({label:'离开电梯',fn:function(){Elevator.arrive(ride.origin);}});
    UI.choice('轿厢里的按钮亮着。',opts);
  },
  move:function(floor){
    var ride=RT.elevatorRide;if(!ride||ride.phase!=='cabin')return;
    if(floor===ride.origin){Elevator.arrive(floor);return;}
    ride.target=floor;ride.phase='moving';ride.remaining=ELEVATOR_CONFIG.travel+Math.abs(floor-ride.origin)*ELEVATOR_CONFIG.perFloor;
    autoSave();os('我：门合上，电梯向目标楼层运行。',2.8);
  },
  enterDream:function(button){
    var ride=RT.elevatorRide;if(!ride||ride.phase!=='cabin'||!ride.rare)return;
    ride.button=button;ride.phase='dream';S.san=Math.max(0,S.san-ELEVATOR_CONFIG.dreamSan);settleSan();
    if(S.dead)return;
    doEnterRoom('lift_dream',Elevator.spawn('lift_dream',2,5,0));
    os('我：门外是一片白色。远处有一道淡蓝色的门。',4,OS_FORCE);
  },
  leaveDream:function(){
    var ride=Elevator.recover();if(ride.phase!=='dream')return;
    Elevator.arrive(ride.origin);
    os('我：门合上了。外面的走廊和刚才一样。',3);
  },
  arrive:function(floor){
    var ride=RT.elevatorRide;if(!ride)return;
    var lift=Elevator.state(ride.host),id=ride.host+floor,spawn=Elevator.landing(ride.host,floor);
    lift.floor=floor;lift.target=floor;lift.phase='idle';lift.remaining=0;RT.elevatorRide=null;
    resetInputState();doEnterRoom(id,spawn);
    os('我：电梯门打开了。',2.2);
  },
  tick:function(dt){
    ['teach','lab'].forEach(function(host){
      var lift=Elevator.state(host);
      if(lift.phase!=='waiting')return;
      lift.remaining=Math.max(0,lift.remaining-dt);
      if(lift.remaining===0){
        lift.floor=lift.target;lift.phase='ready';
        if(S.mode==='in'&&S.room===host+lift.floor)os('我：叮。电梯到了。',2);
      }
    });
    var ride=RT.elevatorRide;
    if(!ride||ride.phase!=='moving'||!Elevator.inRide())return;
    ride.remaining=Math.max(0,ride.remaining-dt);
    if(ride.remaining===0)Elevator.arrive(ride.target);
  }
};
