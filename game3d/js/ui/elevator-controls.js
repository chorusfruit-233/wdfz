/* @module-capsule */
(function($imports){
/* Cabin controls stay reachable while pointer lock or touch owns the view. */
'use strict';
var ElevatorUI={
  node:null,
  init:function(){
    if(ElevatorUI.node)return;
    var box=document.createElement('div');box.id='elevator-controls';box.className='elevator-controls';box.hidden=true;
    box.setAttribute('role','group');box.setAttribute('aria-label','电梯控制');
    [['lift-close','关门',$imports.Elevator.closeDoor]].forEach(function(def){
      var b=document.createElement('button');b.id=def[0];b.type='button';b.textContent=def[1];
      if(def[0]==='lift-close'){var key=document.createElement('kbd');key.textContent='V';b.appendChild(key);b.setAttribute('aria-keyshortcuts','V');}
      b.addEventListener('pointerdown',function(e){e.stopPropagation();});
      b.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();if($imports.GamePolicy.inputOwner((0,$imports.gameInputContext)())==='player')def[2]();});box.appendChild(b);
    });
    document.body.appendChild(box);ElevatorUI.node=box;
  },
  paint:function(){
    if(!ElevatorUI.node)return;
    var r=$imports.RT.elevatorRide,owner=$imports.GamePolicy.inputOwner((0,$imports.gameInputContext)());
    ElevatorUI.node.hidden=!(r&&r.phase==='cabin'&&$imports.Elevator.inCabin()&&owner==='player');
  }
};
GameModules.on('boot',ElevatorUI.init);
GameModules.on('frame',ElevatorUI.paint);
GameModules.on('boundary',function(){if(ElevatorUI.node)ElevatorUI.node.hidden=true;});
GameModules.on('reset',function(){if(ElevatorUI.node)ElevatorUI.node.hidden=true;});

/* @module-exports */
GameModules.publish("game3d/js/ui/elevator-controls.js",{
"ElevatorUI":{get:function(){return ElevatorUI;},set:function($value){ElevatorUI=$value;}}
});
})(GameModules.imports("game3d/js/ui/elevator-controls.js"));
