/* @module-capsule */
(function($imports){
/* One perceptible event before audio dispatch, independent of volume or AudioContext. */
'use strict';
var SoundCaptions=(function(){
  var q=$imports.SensoryRules.queue(),clock=0,bodyAt=-100,root=null,last='',serial=0;
  var words={
    'dread.hum':'灯管的嗡声没有停','threat.breath':'呼吸声近了些','dread.knock':'轻轻的敲门声','dread.door':'门轴拖着长音','dread.steps':'缓慢的脚步声','dread.run':'一阵急促脚步',
    'dread.chair':'椅脚刮过地面','dread.desk':'桌椅轻响','dread.whisper':'模糊的低语','dread.radio':'喇叭里一阵杂音','dread.call':'远处有人声',
    'event.bellStart':'急促的上课铃','event.bellEnd':'下课铃','event.thunder':'雷声炸响','event.thunderFar':'远处的闷雷',
    'foley.door':'门轴响了一声','foley.cupFall':'风里有尖细的哨音','foley.colaRattle':'上方有东西磕了一下',
    'threat.precursor':'耳边一阵低鸣','threat.smileBack':'身后传来压低的笑声','threat.smileJump':'耳边一声尖响',
    'threat.heartLow':'近处的心跳','threat.heartPat':'急促的心跳','world.crackle':'灯管噼啪作响',
    'distant.slam':'远处一声门响','world.silence':'周围突然安静了','distant.tinnitus':'耳边一阵闷响','distant.aah':'远处有声音','distant.ball':'远处一声落地响','distant.giggle':'远处有声音'
  };
  function enabled(){return $imports.SET.soundCaptions===1||($imports.SET.soundCaptions===0&&($imports.SET.vol<=5||!$imports.SFX.available()));}
  function paint(){
    if(!root){root=document.getElementById('soundcaptions');if(!root)return;}
    var a=enabled()?q.visible(clock):[],key=a.map(function(e){return e.id+':'+e.text;}).join('|');
    if(key===last)return;last=key;
    while(root.firstChild)root.removeChild(root.firstChild);
    a.forEach(function(e){var p=document.createElement('div');p.textContent='〔'+e.text+'〕';root.appendChild(p);});
  }
  function publish(id,opt){
    opt=opt||{};
    if($imports.S.screen!=='play'||$imports.S.dead||$imports.PRO.on||$imports.CUT.on||$imports.PAUSE.on||document.hidden)return null;
    if(opt.selfStep)return null;
    var text=opt.caption||(opt.place&&opt.place.caption)||words[id],body=/^threat\.(heart|breath)/.test(id);   /* 调用方可以给这一次换一句（例如走调的铃声） */
    if(opt.patrol)text='脚步声';
    if(!text)return null;
    if(body&&clock-bodyAt<20)return null;
    if(body)bodyAt=clock;
    var p=opt.place,dir=[];
    if(p){
      if(Math.abs(p.pan||0)>.25)dir.push(p.pan<0?'左':'右');
      var ears=$imports.Talent.capability('ears');                     /* 顺风耳：楼上楼下、「很远」一档 */
      if(ears.ok&&(p.floor==='up'||p.floor==='down'))dir.push(p.floor==='up'?'楼上':'楼下');
      else if(p.behind!==undefined)dir.push(p.behind?'后方':'前方');
      if(Number.isFinite(p.m))dir.push(p.m<5?'近处':(ears.ok&&p.m>=ears.far?'很远':'远处'));
      if(p.muffled)dir.push('隔着墙');
    }
    var priority=opt.patrol||/^(event\.|foley\.(cupFall|colaRattle)|threat\.smile)/.test(id)?3:body?1:0;
    if(($imports.PHONE.on||$imports.LESSON.on||$imports.TerminalUI.on)&&priority<3)return null;
    var at=clock+Math.max(0,opt.at||0),event={source:opt.source||id,text:(dir.length?dir.join(' · ')+' · ':'')+text,
      at:at,end:at+Math.max(1.8,Math.min(5,2.5*$imports.SUB_MULT)),priority:priority,dispatch:++serial};
    var result=q.push(event,clock);paint();return result;
  }
  function reset(){q.clear();clock=0;bodyAt=-100;last='!';paint();}
  GameModules.on('frame',function(dt){
    if(!$imports.GamePolicy.simulationAllowed((0,$imports.gameInputContext)())){
      q.clear();paint();return;
    }
    clock+=Math.min(dt,.25);paint();
  },{owner:'sensory'});
  GameModules.on('boundary',reset,{owner:'sensory'});GameModules.on('reset',reset,{owner:'sensory'});
  GameModules.on('leaveRoom',reset,{owner:'sensory'});
  return {publish:publish,reset:reset,paint:paint,events:function(){return q.all();},time:function(){return clock;}};
})();

/* @module-exports */
GameModules.publish("game3d/js/modules/sensory/sound-captions.js",{
"SoundCaptions":{get:function(){return SoundCaptions;},set:function($value){SoundCaptions=$value;}}
});
})(GameModules.imports("game3d/js/modules/sensory/sound-captions.js"));
