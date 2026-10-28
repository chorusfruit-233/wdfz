/* 里世界 3D · 传送门（真结局）
   物理实验室（实验楼 1F）的实验台上压着一张草图：铜线圈、透镜、荧光试剂、电池，拼起来是一扇「门」。
     铜线圈 —— 实验楼 3F 网络中心的服务器里（要机房钥匙）
     透镜   —— 物理实验室的显微镜
     荧光试剂 —— 化学实验室（2F）的离心机，甩成功那一次
     电池   —— 到处都有，随手翻
   四样都在身上，回到实验台组装，门打开，走进去。 */
'use strict';

var PORTAL_PARTS=['coil','lens','vial','battery'];
function portalMissing(){ return PORTAL_PARTS.filter(function(k){ return !hasItem(k); }); }
function portalNeedText(){
  if(!RT.portalSketch) return '';
  if(RT.portalOpen) return '　门已经打开，回物理实验室的实验台。';
  var m=portalMissing();
  return m.length?'　还差：'+m.map(function(k){ return '「'+ITEMS[k].n+'」'; }).join(''):'　东西齐了，回物理实验室的实验台。';
}
function portalBench(){
  if(RT.portalOpen){ tryPortalRoute(); return; }
  if(!RT.portalSketch){
    RT.portalSketch=1; addClue('portal'); spotMark('portal');
    os('我：实验台上压着一张草图，铅笔画的：一个圈，四个箭头指进去——「线圈（网络中心）」「透镜（显微镜）」「荧光（离心机）」「电池」。圈的正中写着一个字：门。',7,OS_KEEP);
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
  if(!RT.portalSketch){ os('我：我还不知道门该怎么造。',2.4); return; }
  if(RT.portalOpen&&S.mode==='in'&&S.room==='lab1'){
    UI.choice('那个圈还在实验台前面。',[
      {label:'走进去',fn:function(){ UI.closeChoice(); triggerEnding('portal'); }},
      {label:'再等一下',fn:function(){ UI.closeChoice(); }}
    ]);
    return;
  }
  if(RT.portalOpen){ os('我：门还在物理实验室的实验台前面。',3.4); return; }
  var m=portalMissing();
  os(m.length?'我：还差'+m.map(function(k){ return '「'+ITEMS[k].n+'」'; }).join('')+'。':'我：东西齐了。回物理实验室的实验台。',3.4);
}
