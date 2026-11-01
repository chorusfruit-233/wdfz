/* 里世界 3D · 传送门（真结局）
   物理实验室（实验楼 1F）的实验台上压着一张草图：铜线圈、透镜、荧光试剂、电池，拼起来是一扇「门」。
     铜线圈 —— 实验楼 3F 网络中心的服务器里（要机房钥匙）
     透镜   —— 物理实验室的显微镜
     荧光试剂 —— 化学实验室（2F）的离心机，甩成功那一次
     电池   —— 到处都有，随手翻
   四样都在身上，回到实验台组装，门打开，走进去。 */
'use strict';

var PORTAL_PARTS=['coil','lens','vial','battery'];
var PORTAL_BLUEPRINT_FLOORS=[2,4,5];
var PORTAL_OBSERVATIONS={
  2:{text:'教师台上是分层试管与操作记录：静置后，发光的重液沉在底部；上层透明。图纸夹在记录后面，要求先圈出应保留的那一层。',options:['保留上层透明液','保留底层发光液','把两层倒回去混合'],answer:1,why:'发光重液会沉底；离心机的试剂来自底层。',note:'二楼图纸：发光重液沉底。离心机能够分离出造门用的试剂。'},
  4:{text:'教师台的校园挂图标着「北 ↑」。纸角画了实验楼一楼的门框，镜片在左，电池在右；背面要求抄出：面朝北时，左边是什么方向？',options:['东','南','西'],answer:2,why:'面朝北时，左西右东。先确认参照方向，再读图。',note:'四楼图纸：朝北读图，左西右东；透镜应面向门框。装置并不是在打开学校的校门。'},
  5:{text:'教师台上的谱页被裁成接线顺序。三个标签写着：「先把线圈接入；再安装透镜；最后接通电池」。纸夹只需依次按下正确标签。',options:['电池','线圈','透镜'],order:[1,2,0],note:'五楼图纸：线圈 → 透镜 → 电池。最后才接电，免得门朝向尚未确定就启动。'}
};
var PortalExploration={
  count:function(){
    var found=RT.portalBlueprints||{};
    return PORTAL_BLUEPRINT_FLOORS.filter(function(f){return !!found[f];}).length;
  },
  enter:function(){
    if(S.mode!=='in'||S.room!=='lab1')return;
    if(AN.active||PAT.locked||Inspection.pending()){
      os('我：现在没法进去，先解决眼前的事。',2.5);return;
    }
    RT.portalReturn={x:S.x,y:S.y,ang:S.ang};patReset();resetInputState();
    var R=INTERIORS.portal_tunnel;
    enterRoom('portal_tunnel',{x:R.ox+3.5*R.tw,y:R.oy+21.5*R.th,ang:-Math.PI/2});
  },
  leave:function(hit){
    if(S.room!=='portal_tunnel')return;
    if(AN.active){os('我：现在打不开门。',2);return;}
    if(hit&&hit.r===0){RT.portalBaseSeen=true;os('我：门后是物理实验室的实验台。那是装置的基座。',3.6);}
    var R=INTERIORS.lab1,p=RT.portalReturn,spawn=null;
    if(p&&[p.x,p.y,p.ang].every(Number.isFinite)&&Collision.depth(p.x,p.y,PRAD,R)<1e-7)spawn=p;
    resetInputState();enterRoom('lab1',spawn);
  },
  readDiary:function(){
    if(S.room!=='portal_tunnel')return;
    if(!RT.portalDiary)addClue('portalDiary');
    RT.portalDiary=true;spotMark('portal');
    Investigation.record('portalDiary','前人的日记：图纸在实验楼二、四、五楼教师台，基座在一楼。页边写着：「名单把我认回来了，却没有告诉我墙外是什么。」','事实','隧道日记');
    os('我：日记里写着：「我把造门的图纸分开放在实验楼二楼、四楼和五楼的教师台。基座留在物理实验室。」',6,OS_FORCE);
    autoSave();
  },
  collect:function(R){
    if(!R||R.host!=='lab'||S.room!==R.id||!RT.portalDiary||RT.portalSketch||PORTAL_BLUEPRINT_FLOORS.indexOf(R.floor)<0)return false;
    var found=RT.portalBlueprints||(RT.portalBlueprints={});
    if(found[R.floor])return false;
    this.challenge(R);return true;
  },
  challenge:function(R){
    var task=PORTAL_OBSERVATIONS[R.floor],run=RT,room=R.id;
    var work=RT.portalWork||(RT.portalWork={}),step=Number.isInteger(work[R.floor])?clamp(work[R.floor],0,2):0;
    var options=task.options.map(function(label,index){return {label:label,fn:function(){
      if(RT!==run||S.room!==room||S.mode!=='in'||S.dead||S.screen!=='play'||(RT.portalBlueprints||{})[R.floor])return;
      if(index===(task.order?task.order[step]:task.answer)){
        if(task.order&&step<2){work[R.floor]=step+1;autoSave();PortalExploration.challenge(R);return;}
        PortalExploration.award(R);return;
      }
      work[R.floor]=0;
      os('我：'+(task.why||'顺序不对。标签要求先线圈、再透镜，最后通电。')+'可以再看一次记录。',5,OS_KEEP);autoSave();
    }};});
    options.push({label:'放下，稍后再看',fn:function(){autoSave();}});
    UI.choice(task.text+(task.order?'（已正确操作 '+step+'/3 步）':''),options);
  },
  award:function(R){
    var found=RT.portalBlueprints||(RT.portalBlueprints={});
    if(found[R.floor])return;
    found[R.floor]=true;
    Investigation.record('blueprint:'+R.floor,PORTAL_OBSERVATIONS[R.floor].note,'验证',R.name+' · 教师台');
    var count=PortalExploration.count();
    if(count===PORTAL_BLUEPRINT_FLOORS.length){
      RT.portalSketch=1;addClue('portal');spotMark('portal');
      os('我：三张图纸拼在一起：铜线圈、透镜、荧光试剂和电池，接到物理实验室的基座上。',6,OS_FORCE);
    }else os('我：教师台夹着一张造门图纸。已经找到 '+count+' / '+PORTAL_BLUEPRINT_FLOORS.length+' 张。',4,OS_FORCE);
    autoSave();return true;
  }
};
function portalMissing(){ return PORTAL_PARTS.filter(function(k){ return !hasItem(k); }); }
function portalNeedText(){
  if(RT.portalDiary&&!RT.portalSketch) return '　图纸还差 '+(PORTAL_BLUEPRINT_FLOORS.length-PortalExploration.count())+' 张，在实验楼二、四、五楼的教师台。';
  if(!RT.portalSketch) return '';
  if(RT.portalOpen) return '　门已经打开，回物理实验室的实验台。';
  var m=portalMissing();
  return m.length?'　还差：'+m.map(function(k){ return '「'+ITEMS[k].n+'」'; }).join(''):'　东西齐了，回物理实验室的实验台。';
}
function portalBench(){
  if(RT.portalOpen){ tryPortalRoute(); return; }
  if(!RT.portalSketch){
    UI.choice(RT.portalDiary?'实验台后的隧道还在。图纸找到 '+PortalExploration.count()+' / 3 张。':'实验台后有一条覆着黑色黏液的狭窄隧道。',[
      {label:'进入隧道',fn:function(){PortalExploration.enter();}},
      {label:'先离开',fn:function(){}}
    ]);
    return;
  }
  var m=portalMissing();
  if(m.length){
    os('我：草图上的四样，我还差'+m.map(function(k){ return '「'+ITEMS[k].n+'」'; }).join('')+'。',3.6,OS_KEEP);
    return;
  }
  UI.choice('四样东西摆在实验台上。线圈在发烫，试剂在发光。',[
    {label:'把它们接起来',fn:function(){
      UI.closeChoice();
      PORTAL_PARTS.forEach(function(k){ removeItem(k); });
      RT.portalOpen=1;
      try{ SFX.bigBell&&SFX.bigBell(0.4); }catch(e){}
      os('我：电池一接上，透镜里的光就漏了出来，在实验台前面撑开一个圈。圈里面——是有颜色的。',5,OS_FORCE);
      var openedRun=RT;
      setTimeout(function(){
        if(RT!==openedRun||!RT.portalOpen||S.dead||S.screen!=='play'||S.mode!=='in'||S.room!=='lab1'||PAUSE.on||UI.anyOpen()) return;
        UI.choice('那个圈在等我。',[
          {label:'走进去',fn:function(){ UI.closeChoice(); triggerEnding('portal'); }},
          {label:'再等一下',fn:function(){ UI.closeChoice(); os('我：圈还在。它不会等太久。',2.6); }}
        ]);
      },2600);
    }},
    {label:'先不',fn:function(){ UI.closeChoice(); }}
  ]);
}
/* 门开了以后，再回到实验台就直接问 */
function tryPortalRoute(){
  if(RT.portalOpen&&S.mode==='in'&&S.room==='lab1'){
    UI.choice('那个圈还在实验台前面。',[
      {label:'走进去',fn:function(){ UI.closeChoice(); triggerEnding('portal'); }},
      {label:'再等一下',fn:function(){ UI.closeChoice(); }}
    ]);
    return;
  }
  if(RT.portalOpen){ os('我：门还在物理实验室的实验台前面。',3.4); return; }
  if(!RT.portalSketch){
    os(RT.portalDiary?'我：图纸分散在实验楼二、四、五楼的教师台。':'我：物理实验室的实验台后面似乎有条隧道。',3.4);return;
  }
  var m=portalMissing();
  os(m.length?'我：还差'+m.map(function(k){ return '「'+ITEMS[k].n+'」'; }).join('')+'。':'我：东西齐了。回物理实验室的实验台。',3.4);
}
