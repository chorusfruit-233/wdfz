/* @module-capsule */
(function($imports){
/* Two small scheduled scenes; share Dread's budget and yield to real hazards. */
'use strict';
var SensoryScenes=(function(){
  var clock=0,next=85,event=null,handles=[],doors={};
  function cancel(){event=null;handles.forEach(function(h){$imports.SoundPlayer.fade(h);});handles=[];}
  function reset(){cancel();clock=0;next=85;doors={};}
  function sound(kind,p){var h=$imports.SFX.dread(kind,(0,$imports.dreadPlace)(p.x,p.y));if(h)handles.push(h);}
  function lamp(){
    if((0,$imports.dreadBusy)()||(0,$imports.gameAge)()<60||!$imports.Dread.allow(1)||$imports.S.mode!=='in'||!$imports.GLR.roomLights.length||$imports.StairWorld.here())return false;
    var R=$imports.INTERIORS[$imports.S.room],i=Math.floor($imports.PresentationRandom.next()*$imports.GLR.roomLights.length),L=$imports.GLR.roomLights[i],near=[];
    for(var r=0;r<R.rows;r++)for(var c=0;c<R.cols;c++)if(R.grid[r][c]==='=')near.push({x:R.ox+(c+.5)*R.tw,y:R.oy+(r+.5)*R.th});
    if(!near.length)return false;
    var p={x:R.cx+L.position.x/$imports.U2M,y:R.cy+L.position.z/$imports.U2M};
    near.sort(function(a,b){return Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y);});
    event={kind:'lamp',at:clock,room:$imports.S.room,index:i,door:near[0],moved:false};
    $imports.Dread.note('lamp-hum',1);sound('hum',p);return true;
  }
  function door(action){
    if(action&&action.open){if(event&&event.kind==='door'&&event.room===action.room&&event.x===action.x&&event.y===action.y)cancel();return;}
    if(!action||(0,$imports.dreadBusy)()||(0,$imports.gameAge)()<60||!$imports.Dread.allow(1)||event)return;
    var key=action.room+':'+action.c+':'+action.r;
    if(doors[key]!==undefined&&clock-doors[key]<120)return;
    if($imports.PresentationRandom.next()>.30)return;
    doors[key]=clock;event={kind:'door',at:clock,room:action.room,x:action.x,y:action.y};$imports.Dread.note('door-answer',1);
  }
  function frame(dt){
    if(!$imports.GamePolicy.simulationAllowed((0,$imports.gameInputContext)())||(0,$imports.dreadBusy)()){cancel();return;}
    clock+=Math.min(.25,dt);
    handles=handles.filter(function(h){return h.end>h.gain.context.currentTime;});
    if(event){
      if(event.room!==$imports.S.room){cancel();return;}
      var elapsed=clock-event.at;
      if(event.kind==='door'&&elapsed>=1.4){sound('knock',event);event=null;}
      else if(event.kind==='lamp'){
        if(elapsed>=3&&!event.moved){event.moved=true;sound('hum',event.door);}
        if(elapsed>=7)cancel();
      }
    }else if(clock>=next){next=clock+85/(1+.08*$imports.CampusPressure.current().stage)+$imports.PresentationRandom.next()*40;lamp();}
  }
  GameModules.on('frame',frame,{owner:'sensory'});GameModules.on('doorAction',door,{owner:'sensory'});
  GameModules.on('leaveRoom',cancel,{owner:'sensory'});GameModules.on('boundary',reset,{owner:'sensory'});GameModules.on('reset',reset,{owner:'sensory'});
  return {lamp:lamp,door:door,frame:frame,cancel:cancel,state:function(){return event;},
    lampMul:function(i){if(!event||event.kind!=='lamp'||event.index!==i)return 1;var t=clock-event.at;return t<2?1-t*.44:t>5?.12+(t-5)*.44:.12;}};
})();

/* @module-exports */
GameModules.publish("game3d/js/modules/sensory/scenes.js",{
"SensoryScenes":{get:function(){return SensoryScenes;},set:function($value){SensoryScenes=$value;}}
});
})(GameModules.imports("game3d/js/modules/sensory/scenes.js"));
