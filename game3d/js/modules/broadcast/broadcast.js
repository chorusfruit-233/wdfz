/* @module-capsule */
(function($imports){
/* Public broadcast station and the five-stage school-dismissal route. Application owns all state. */
'use strict';
var Broadcast=(function(){
  var C=$imports.BROADCAST_CFG,B=$imports.BroadcastRules.normalize(),held=false,progress=0,origin=null,session=0,crowdPath=null,bellSound=null,bellStarted=false,bellNext=0;
  var own={owner:'broadcast'};
  function state(){return B;}
  function silence(){bellStarted=false;if(bellSound)$imports.SoundPlayer.fade(bellSound);bellSound=null;}
  function reset(){silence();crowdPath=null;B=$imports.BroadcastRules.normalize();held=false;progress=0;origin=null;session++;}
  function save(){return JSON.parse(JSON.stringify(B));}
  function near(room,at,distance){var R=$imports.INTERIORS[room];return !!R&&$imports.S.mode==='in'&&$imports.S.room===room&&Math.hypot($imports.S.x-(R.ox+(at[0]+.5)*R.tw),$imports.S.y-(R.oy+(at[1]+.5)*R.th))<=(distance||14);}
  function ensure(){if(B.fakeSite===null)B.fakeSite=Math.floor($imports.BroadcastRules.hash($imports.RT.runSeed,'false-notice')*4);return B;}
  function collect(id){if((0,$imports.hasItem)(id))return true;if(!(0,$imports.addItem)(id))return false;(0,$imports.autoSave)();return true;}
  function nearStation(){return near(C.room,C.station,19);}
  function assembled(){return [1,2,3,4].every(function(n){return (0,$imports.hasItem)('notice'+n);});}
  function powered(){return !($imports.AN.active&&$imports.AN.id==='blackout');}
  function available(){return B.attemptDay<$imports.S.day&&$imports.BroadcastRules.window($imports.S.day,$imports.S.tsec)&&powered()&&!$imports.Inspection.pending();}
  function ready(){return B.book&&B.fuse&&assembled();}
  function reason(){
    if(B.attemptDay>=$imports.S.day)return '今天的长铃已经停了。通知稿还在，明天第八节下课后再试。';
    if(!B.book)return '先读播音记录本。';if(!B.fuse)return '功放保险丝已烧，备用件在体育器材室。';
    if(!assembled())return '通知稿还缺残页。';if($imports.Inspection.pending())return '学生会正在检查，先停播。';
    if(!powered())return '停电了，功放没有反应。';if(!$imports.BroadcastRules.window($imports.S.day,$imports.S.tsec))return '记录本：第二天起，第八节下课后、熄灯前播出。';return '';
  }
  function stop(){var changed=held||progress;held=false;progress=0;origin=null;if(changed)(0,$imports.autoSave)();}
  function select(id){if(!/^notice[1-4]$/.test(id)&&id!=='notice_fake')return;stop();B.selected=id;}
  function hold(on){
    if(!on){stop();return false;}
    if(B.phase==='bell'||$imports.S.screen!=='play'||$imports.S.dead||$imports.HIDE.on||!nearStation()||!ready()||!available())return false;
    if(!(0,$imports.hasItem)(B.selected)){(0,$imports.os)('我：手里没有这一页。',2);return false;}
    held=true;progress=0;origin={x:$imports.S.x,y:$imports.S.y,day:$imports.S.day};return true;
  }
  function book(){
    B.book=true;$imports.Investigation.record('broadcastBook','行政楼二楼广播站：放学通知被撕成四页，蓝黑墨水、日期「第二天」。第二天起，第八节下课后至熄灯前播出。教导处文件柜、琴凳、保安岗登记簿、天台喇叭箱各有一页。','线索','播音记录本');
    (0,$imports.os)('播音记录本：「未播出：放学通知。第二天，第八节下课以后，熄灯以前。四页，蓝黑墨水。功放保险丝已烧，备用件和一份补给在器材室。长铃只响六十秒，提前确认北门路线，准备疾跑。」',7,$imports.OS_FORCE);(0,$imports.autoSave)();
  }
  function page(index){
    var p=$imports.BroadcastRules.paper(index,false),options=[{label:'收好 · '+p.ink+' · '+p.date,fn:function(){if(collect(p.id)){$imports.Investigation.record(p.id,p.text,'线索',C.sources[index].title);(0,$imports.autoSave)();}}}];
    if(ensure().fakeSite===index){var f=$imports.BroadcastRules.paper(index,true);options.push({label:'收好另一张 · '+f.ink+' · '+f.date,fn:function(){collect(f.id);}});}
    if(index===2)options.push({label:'柜台备用手电／停车记录',fn:$imports.guardSupplies});
    options.push({label:'先不拿',fn:function(){}});$imports.UI.choice(C.sources[index].title+'里夹着通知稿。字迹、墨水和日期都看得清。\n'+p.ink+' · '+p.date+'：「'+p.text+'」'+(options.length>2?'\n另一张是红笔写的，日期是「第 0 天」。':''),options);
  }
  function takePage(index){
    var place=C.sources[index];if(!place||!near(place.room,place.at))return false;
    if(index===0&&!B.archiveOpen){if(!(0,$imports.hasItem)('archivekey')){(0,$imports.os)('文件柜上锁了，标签写着「教导处」。钥匙登记在五楼办公室。',4);return false;}
      B.archiveOpen=true;(0,$imports.removeItem)('archivekey');(0,$imports.autoSave)();}
    if(index===1){if($imports.DayEvents.closed('piano')){(0,$imports.os)($imports.DayEvents.closedMsg('piano'),3);return false;}piano();return true;}
    if(index===2&&!(0,$imports.isNight)()){(0,$imports.os)('登记簿压在内侧柜台，保安岗的夜间窗口要熄灯以后才开。',3);return false;}
    if(index===3){if(!(0,$imports.hasItem)('coin')){(0,$imports.os)('喇叭箱的螺丝槽很宽，需要一枚硬币。',3);return false;}
      if(!backToStairs()){(0,$imports.os)('喇叭箱背面的字：「拧螺丝时，背对楼梯口。」',3);return false;}}
    var ticket=session;
    return (0,$imports.holdJob)(index===3?2:1.4,function(){if(ticket!==session||$imports.S.dead||!near(place.room,place.at))return;if(index===3&&(!(0,$imports.hasItem)('coin')||!backToStairs()))return;page(index);});
  }
  function backToStairs(){var R=$imports.INTERIORS.teach6;if(!R)return false;var x=R.ox+12.5*R.tw,y=R.oy+16.5*R.th;return Math.cos(Math.atan2(y-$imports.S.y,x-$imports.S.x)-$imports.S.ang)<-.3;}
  function piano(note){
    if(B.pianoUntil>(0,$imports.gameClock)()){(0,$imports.os)('琴房的灯暗到底了。琴凳上写着：十分钟以后再试。',3);return;}
    if(B.pianoFails>=3){B.pianoFails=0;B.pianoUntil=0;}
    if(note!==undefined){
      if(![1,2,3,5].includes(note))return;
      $imports.SoundPlayer.play('music.piano',{pitch:({1:523.25,2:587.33,3:659.26,5:392})[note]/440,k:.5});
      B.piano.push(note);
      if(note!==C.notes[B.piano.length-1]){B.piano=[];B.pianoFails++;if(B.pianoFails>=3)B.pianoUntil=(0,$imports.gameClock)()+10;(0,$imports.autoSave)();(0,$imports.os)('弹错了一个音。琴房的灯又暗了一档。',2);}
      else if(B.piano.length===4){B.piano=[];B.pianoFails=0;(0,$imports.autoSave)();page(1);return;}
    }
    if(B.pianoUntil>(0,$imports.gameClock)())return;
    $imports.UI.choice('琴凳锁着。谱面上印着下课铃开头：1 · 3 · 2 · 5。\n已弹：'+(B.piano.join(' · ')||'—')+'。琴凳内侧露出一角通知稿。',
      [1,2,3,5].map(function(n){return {label:String(n),fn:function(){piano(n);}};}).concat([{label:'离开琴边',fn:function(){B.piano=[];}}]));
  }
  function install(){if(!nearStation())return false;if(B.fuse)return true;if(!(0,$imports.hasItem)('broadcastfuse')){(0,$imports.os)('功放保险丝已烧，备用件在体育器材室。',3);return false;}
    (0,$imports.removeItem)('broadcastfuse');B.fuse=true;(0,$imports.os)('功放的红灯亮了。话筒里有很轻的呼吸声。',3);(0,$imports.autoSave)();return true;}
  function verify(){
    var call=B.current;if(!call){(0,$imports.os)('记录本里还没有新的广播。',2);return false;}
    var recorded=B.calls.some(function(c){return c.id===call.id;});
    if(!recorded&&B.verified.indexOf(call.id)<0){B.verified.push(call.id);(0,$imports.gameFact)('broadcast',{what:'verified',real:false});(0,$imports.autoSave)();}
    (0,$imports.os)(recorded?'记录本上有这一条，时间和地点对得上。':'记录本上没有这一条。刚才喇叭里的啸叫还没停。',4);return !recorded;
  }
  function menu(){if(!nearStation())return;$imports.UI.choice('广播站 · 功放与播音记录本',[
    {label:'翻看播音记录本',fn:book},{label:B.fuse?'功放已修复':'更换保险丝',fn:install},
    {label:'核对最近广播',fn:verify},{label:'整理通知稿／朗读',fn:function(){$imports.BroadcastUI.open();}},{label:'离开广播台',fn:function(){}}]);}
  function ringBell(){if(bellSound)$imports.SoundPlayer.fade(bellSound);bellSound=$imports.SFX.cue('event.dismissal');bellStarted=true;bellNext=B.bell-12;}
  function startBell(){
    stop();B.phase='bell';B.bell=C.bellSeconds;B.attemptDay=$imports.S.day;
    silence();crowdPath=null;ringBell();
    (0,$imports.os)('广播：「放学。全体同学从北门离校。」\n长铃只响六十秒。跟紧同学，铃声结束以前走出北门。',6,$imports.OS_FORCE);(0,$imports.autoSave)();
  }
  function crowd(){
    if(B.phase!=='bell')return null;
    if(!crowdPath){var a=$imports.PatrolNav.graph().nodes['out:teach'],end=$imports.PatrolNav.snap('out',$imports.PatrolNav.point('out',$imports.GATE_N.x*$imports.SC,$imports.GATE_N.y*$imports.SC+15));crowdPath=a&&end&&$imports.PatrolNav.path(a,end);}
    var path=crowdPath;
    if(!path||!path.length)return null;var length=$imports.PatrolNav.length(path),distance=Math.min(length,Math.max(0,(60-B.bell-3))*length/46);
    for(var i=1;i<path.length;i++){var d=Math.hypot(path[i].x-path[i-1].x,path[i].y-path[i-1].y);if(distance<=d){var k=d?distance/d:0;return {x:path[i-1].x+(path[i].x-path[i-1].x)*k,y:path[i-1].y+(path[i].y-path[i-1].y)*k,angle:Math.atan2(path[i].y-path[i-1].y,path[i].x-path[i-1].x),left:B.bell};}distance-=d;}
    return Object.assign({angle:-Math.PI/2,left:B.bell},path[path.length-1]);
  }
  function cover(){var p=crowd();return !!p&&$imports.S.mode==='out'&&Math.hypot($imports.S.x-p.x,$imports.S.y-p.y)<=34;}
  function tryExit(){
    if($imports.S.screen!=='play'||$imports.S.dead||$imports.RT.end||B.phase!=='bell'||B.completed!==4||!cover()||Math.hypot($imports.S.x-$imports.GATE_N.x*$imports.SC,$imports.S.y-$imports.GATE_N.y*$imports.SC)>45)return false;
    stop();silence();$imports.Speedrun.proof('dismissal');(0,$imports.triggerEnding)('dismissal');return true;
  }
  var CALLS=[{room:'lab4',at:[7,1],name:'实验楼四楼地理实验室'},{room:'lab2',at:[7,1],name:'实验楼二楼化学实验室'}];
  function announce(real,choice){
    if($imports.Inspection.quiet()||$imports.AN.active||B.phase==='bell'||held)return false;
    var spec=CALLS[choice===undefined?(Math.floor($imports.BroadcastRules.hash($imports.RT.runSeed,'call'+B.callSeq)*CALLS.length)):choice%CALLS.length];
    B.callSeq++;B.current={id:B.callSeq,room:spec.room,text:'请高二（二）班同学到'+spec.name+'来一趟。',real:real!==false,done:false,arrived:false,age:0};
    if(B.current.real)B.calls.push({id:B.callSeq,room:spec.room,text:B.current.text,time:$imports.S.tsec});
    B.calls=B.calls.slice(-20);(0,$imports.os)('广播：「'+B.current.text+'」'+(B.current.real?'':'喇叭里有轻微的回授啸叫。'),5,$imports.OS_FORCE);
    $imports.SoundPlayer.play('dread.radio',{k:.6,pitch:B.current.real?1:.87});(0,$imports.autoSave)();return true;
  }
  function currentSpot(){return B.current&&CALLS.find(function(c){return c.room===B.current.room;});}
  function tick(dt){
    if($imports.S.screen!=='play'||$imports.S.dead)return;
    ensure();B.clock+=dt;
    if(B.phase==='bell'){
      if(!bellStarted||B.bell<=bellNext||bellSound&&bellSound.end<=$imports.SFX.synth().now())ringBell();
      B.bell=Math.max(0,B.bell-dt);if(B.bell<=0){silence();B.phase='collect';B.completed=0;B.selected='notice1';crowdPath=null;(0,$imports.os)('长铃停了。同学们转身往教室走。通知稿还在，明天的放学时段可以再试。',5,$imports.OS_FORCE);(0,$imports.autoSave)();}
      else tryExit();return;
    }
    if(held){
      if(!nearStation()||$imports.HIDE.on||!ready()||!available()||!origin||origin.day!==$imports.S.day||Math.hypot($imports.S.x-origin.x,$imports.S.y-origin.y)>3){stop();}
      else{progress+=dt;
        if(B.selected==='notice_fake'&&progress>=2){stop();(0,$imports.kill)('你念的那份通知，是给你的。','misread','misread');return;}
        var wanted='notice'+(B.completed+1),duration=$imports.S.diff==='hard'?C.hardSeconds:C.normalSeconds;
        if(B.selected!==wanted&&B.selected!=='notice_fake'){stop();(0,$imports.os)('页码不对，得从当前这一段开始。',2);}
        else if(progress>=duration){B.completed++;progress=0;(0,$imports.autoSave)();if(B.completed>=4)startBell();else{B.selected='notice'+(B.completed+1);(0,$imports.os)('这一段播完了。门外的脚步还在靠近。',2);}}
      }
    }
    var call=B.current;
    if(call&&!call.done&&$imports.S.mode==='in'&&$imports.S.room===call.room&&!$imports.Inspection.quiet()&&!$imports.AN.active){
      if(!call.arrived){call.arrived=true;(0,$imports.os)(call.real?'老师没有抬头：「广播站的残页，拿硬币去天台喇叭箱找。拧的时候背对楼梯口。」':'喇叭里开始念你的名字。啸叫越来越尖——先离开这间屋子。',5,$imports.OS_FORCE);}
      if(call.real){call.done=true;$imports.Investigation.record('broadcastTeacher','广播叫来的老师提到：天台喇叭箱要用硬币拧开，背对楼梯口。','线索',call.room);}
      else{call.age+=dt;if(call.age>=8)(0,$imports.sanDrain)(1.5,dt,'false-broadcast');}
    }else if(call&&call.arrived&&!call.real&&$imports.S.room!==call.room){call.done=true;}
    if(B.clock>=B.nextCall&&!$imports.DREAD.slice&&!(0,$imports.dreadBusy)()&&$imports.Dread.allow(1)){
      if(announce($imports.BroadcastRules.hash($imports.RT.runSeed,'real-call'+B.callSeq)>.5))$imports.Dread.note('broadcast-call',1);
      B.nextCall=B.clock+180+$imports.BroadcastRules.hash($imports.RT.runSeed,'next-call'+B.callSeq)*80;
    }
  }
  function interact(){
    if($imports.S.mode==='out'){
      if(tryExit())return true;
      var n=(0,$imports.nearWorld)(0);if(n&&n.obj.id==='guard'&&!(0,$imports.isNight)()){$imports.UI.choice('保安岗的门牌：熄灯以后，夜间值班。白天可在值班窗口领取旧的备用物资。',[{label:'领取备用手电／查看停车记录',fn:$imports.guardSupplies},{label:'离开',fn:function(){}}]);return true;}return;
    }
    var hit=(0,$imports.nearWorld)(24);
    if($imports.S.room===C.room&&hit&&hit.ch==='='&&C.doors.some(function(p){return p[0]===hit.c&&p[1]===hit.r;})&&!(0,$imports.hasItem)('broadcastkey')&&!$imports.OPENDOORS[C.room+':'+hit.c+':'+hit.r]){(0,$imports.os)('广播站锁着。门牌上写着：钥匙在夜间保安岗登记簿。',4);return true;}
    if(nearStation()){menu();return true;}
    if(near(C.archiveKey.room,C.archiveKey.at)){if(!B.archiveOpen)collect('archivekey');else (0,$imports.os)('这把钥匙已经开过教导处的文件柜。',2);return true;}
    if(near(C.fuse.room,C.fuse.at)){if(!B.fuse)collect('broadcastfuse');if(!B.boxSnack&&(0,$imports.addItem)('snack')){B.boxSnack=true;(0,$imports.os)('备用件旁还有一块士力架。放学铃只有六十秒，先记好北门的路。',4);(0,$imports.autoSave)();}else (0,$imports.os)('备用保险丝已经装进广播站的功放。',2);return true;}
    for(var i=0;i<C.sources.length;i++)if(near(C.sources[i].room,C.sources[i].at)){if(i===2&&!(0,$imports.isNight)())return;takePage(i);return true;}
  }
  function hint(){if($imports.S.mode==='out'&&B.phase==='bell')return cover()?'随人群走向北门':'追上离校的同学';
    if(nearStation())return '播音记录本／广播台';
    if(near(C.archiveKey.room,C.archiveKey.at))return '取教导处钥匙';if(near(C.fuse.room,C.fuse.at))return '备用保险丝';
    for(var i=0;i<C.sources.length;i++)if(near(C.sources[i].room,C.sources[i].at))return C.sources[i].title;}
  GameModules.on('interiors',function(){
    var R=$imports.INTERIORS[C.room];
    $imports.INTERIORS.admin1.grid[2][46]='f';
    for(var r=1;r<16;r++)for(var c=2;c<=8;c++)R.grid[r][c]='.';
    R.grid[3][5]='K';R.grid[12][2]='H';
    [[2,2],[8,2],[2,7],[8,7]].forEach(function(p){R.grid[p[1]][p[0]]='f';});
    C.doors.forEach(function(p){R.grid[p[1]][p[0]]='=';$imports.DOOR_LOCKS[C.room+':'+p[0]+':'+p[1]]='broadcastkey';});
    $imports.INTERIORS.teach6.grid[2][20]='R';
    var entries={archivekey:{n:'教导处钥匙',d:'五楼办公室的钥匙，标签上写着「教导处通知档案」。'},broadcastkey:{n:'广播站钥匙',d:'保安岗登记簿里的钥匙，能打开行政楼二楼广播站。'},broadcastfuse:{n:'备用保险丝',d:'体育器材室的备用件，可以修复广播站功放。'},notice_fake:{n:'红笔通知稿',d:'红笔，第 0 天。「请读到这里的同学留在原地。」'}};
    C.pages.forEach(function(text,i){entries['notice'+(i+1)]={n:'放学通知 · 残页'+(i+1),d:'蓝黑墨水，第二天。'+text};});
    Object.keys(entries).forEach(function(k){$imports.ITEMS[k]=entries[k];});
    Object.keys(entries).filter(function(k){return /^notice/.test(k);}).forEach(function(k){$imports.ITEM_USE[k]=function(){(0,$imports.os)($imports.ITEMS[k].d,5);};});
  },own);
  GameModules.on('interact',function(){
    if(near(C.sources[2].room,C.sources[2].at)&&(0,$imports.isNight)()&&!(0,$imports.hasItem)('broadcastkey')){collect('broadcastkey');return true;}
    return interact();
  },own);
  GameModules.on('hint',hint,own);GameModules.on('tick',tick,own);
  GameModules.on('leaveRoom',stop,own);
  GameModules.on('patrolZoneActive',function(z){if(z.when==='broadcast')return held&&nearStation();},own);
  GameModules.on('patrolCamouflage',cover,own);
  GameModules.on('boundary',function(){stop();silence();crowdPath=null;},own);
  GameModules.on('lightState',function(st){if($imports.S.mode==='in'&&$imports.S.room==='lab5'&&B.pianoFails){var k=1-B.pianoFails*.17;st.amb*=k;st.hemi*=k;st.dir*=k;st.ptK*=k;}},own);
  GameModules.persistent('broadcast',{reset:reset,save:save,load:function(d){silence();crowdPath=null;B=$imports.BroadcastRules.normalize(d);held=false;progress=0;origin=null;session++;}});
  return {state:state,ensure:ensure,ready:ready,reason:reason,nearStation:nearStation,hold:hold,stop:stop,select:select,book:book,menu:menu,takePage:takePage,piano:piano,
    install:install,verify:verify,announce:announce,tick:tick,crowd:crowd,cover:cover,tryExit:tryExit,reading:function(){return {held:held,progress:progress,seconds:$imports.S.diff==='hard'?20:15};},powered:powered,backToStairs:backToStairs};
})();

/* @module-exports */
GameModules.publish("game3d/js/modules/broadcast/broadcast.js",{
"Broadcast":{get:function(){return Broadcast;},set:function($value){Broadcast=$value;}}
});
})(GameModules.imports("game3d/js/modules/broadcast/broadcast.js"));
