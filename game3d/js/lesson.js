/* 课桌上的短互动：不暂停课堂，每节一次；进度跟随 RT 存档。 */
'use strict';
var LESSON={on:false,key:null,waiting:null};
var LESSON_TASKS=[
  {text:'老师让我校对课表。三行字里，有一行不该在这里。',choices:['课间可以离开座位','熄灯后继续早读','上课前把书翻开'],answer:1,note:'我把「熄灯后继续早读」划掉了。下一秒，那几个字又渗了出来。'},
  {text:'点名册翻到我这一页。有一处应该先圈出来。',choices:['同一个名字写满了第三排','最后一行的字迹很淡','纸的边缘有一道折痕'],answer:0,note:'我圈出了第三排。每一个名字都是我的。老师没有再往下念。'},
  {text:'课本夹着一张纸。哪一句像是留给我的提醒？',choices:['所有抽屉都是空的','车库里别关手电','铃响以后不用看时间'],answer:1,note:'「车库里别关手电。」我把这句话记了下来，笔尖却没有沾墨。'},
  {text:'同桌在草稿纸上写了一行字，又划掉了一半。他想提醒我的是哪一句？',choices:['灯按拍子闪的时候，别站在走廊中间','下课铃一响就要离开教室','窗外有人敲玻璃要回应'],answer:0,note:'灯按拍子闪，是有东西要来了。走廊中间没有地方躲。'},
  {text:'课本扉页上有人用铅笔写了一句话，写得很用力。',choices:['被盯上的时候，背对它站着别动','被盯上的时候，转身盯着它看','被盯上的时候，大声喊老师'],answer:0,note:'背对它，别动。纸被笔尖戳破了一个洞。'},
  {text:'窗外下起了雨。夹在课本里的纸条上，写着该怎么做。',choices:['找有顶的地方','原地等雨停','往操场中间跑'],answer:0,note:'屋檐、柱廊、车棚。雨下大了，就往有顶的地方去。'},
  {text:'后排有人把一张作业纸传了过来。上面只有一句话。',choices:['坐太久的话，记得站起来走走','上课一定要一直坐着','椅子是最安全的地方'],answer:0,note:'「坐太久的话，记得站起来走走。」我回头，后排没有人。'},
  {text:'同学的错题本上，有一道题被红笔圈了好几圈。',choices:['天台上那个人，你不看他的时候他才会动','天台上那个人会跟着你说话','天台上那个人怕光'],answer:0,note:'我把那一行看了三遍：不看他的时候，他才会动。'},
  {text:'教室后面的通知栏上，贴着一张撕掉一半的旧告示。',choices:['实验楼地上的粉笔圈不要踩','实验楼的蜡烛要点亮','实验楼的门要一直开着'],answer:0,note:'剩下的那半张上只有一行：粉笔圈，不要踩。'},
  {text:'桌肚里塞着一张揉皱的纸，字被什么粉末蹭花了。',choices:['蛾子聚过来的时候，离远一点','蛾子怕声音，拍手就散','蛾子只在白天出现'],answer:0,note:'……离远一点。纸上的字是被翅膀上的粉蹭花的。'}
];
LESSON.currentKey=function(){return S.day+':'+periodAt(S.tsec)[0];};
LESSON.available=function(){
  return S.screen==='play'&&!S.dead&&!PRO.on&&!PAUSE.on&&!UI.anyOpen()&&!PC.on&&!PHONE.on&&
    !(S.intro>0)&&!HIDE.on&&!AN.active&&!PAT.locked&&!Inspection.pending()&&!Inspection.upcoming()&&
    S.seated&&atMySeat()&&needWhere(S.tsec)==='教室';
};
LESSON.record=function(){return RT.lessons&&RT.lessons[LESSON.key];};
LESSON.open=function(){
  if(LESSON.waiting){LESSON.stopWait();return;}
  if(LESSON.on||!LESSON.available())return;
  var key=LESSON.currentKey();RT.lessons=RT.lessons||{};
  if(RT.lessons[key]&&RT.lessons[key].done){LESSON.offerWait();return;}
  if(!RT.lessons[key])RT.lessons[key]={task:(S.day+Math.floor(periodAt(S.tsec)[0]/5))%LESSON_TASKS.length,left:12,done:false};
  LESSON.key=key;LESSON.on=true;document.body.classList.add('lesson-open');
  var record=LESSON.record(),task=LESSON_TASKS[record.task],el=document.getElementById('lesson');
  el.querySelector('.lesson-title').textContent=examNow()?'答卷边上的字':'课桌上的字';
  el.querySelector('.lesson-text').textContent=task.text;
  var opts=el.querySelector('.lesson-options');opts.textContent='';
  task.choices.forEach(function(label,index){
    var button=document.createElement('button');button.type='button';button.textContent=(index+1)+' · '+label;
    button.addEventListener('click',function(){LESSON.answer(index);});opts.appendChild(button);
  });
  resetInputState();releaseMouseLook();el.hidden=false;
  LESSON.paintButton();updateTouchUI();opts.querySelector('button').focus({preventScroll:true});LESSON.paint();
};
LESSON.close=function(abandon){
  if(!LESSON.on)return;
  if(abandon){var r=LESSON.record();if(r)r.done=true;}
  LESSON.on=false;document.body.classList.remove('lesson-open');document.getElementById('lesson').hidden=true;
  resetInputState();resumeMouseLook();LESSON.paintButton();updateTouchUI();
};
LESSON.answer=function(index){
  if(!LESSON.on||!LESSON.available())return;
  var r=LESSON.record();if(!r||r.done||r.left<=0)return;
  var task=LESSON_TASKS[r.task];if(index<0||index>=task.choices.length)return;
  r.done=true;
  if(index===task.answer){r.correct=true;S.san=Math.min(100,S.san+2);addClue('lesson');Investigation.record('lesson:'+r.task,task.note,'事实','课堂提醒');os('我：'+task.note,4.4,OS_KEEP);}
  else os('我：老师没有说对不对，只让我把纸翻过去。',3.4);
  LESSON.close(false);autoSave();
};
LESSON.checkInterrupt=function(){
  if(LESSON.waiting&&!LESSON.waitAllowed())LESSON.stopWait();
  if(LESSON.on&&(!LESSON.available()||LESSON.key!==LESSON.currentKey()))LESSON.close(false);
};
LESSON.waitAllowed=function(){
  var w=LESSON.waiting;
  return LESSON.available()&&!LESSON.on&&!(DEV.on&&DEV.freeze)&&PAT.state==='idle'&&!Inspection.quiet()&&
    (!w||(w.key===LESSON.currentKey()&&S.tsec<w.until&&S.room===w.room));
};
LESSON.canWait=function(){
  var r=RT.lessons&&RT.lessons[LESSON.currentKey()];
  return !!(r&&r.done&&!r.waitUsed&&LESSON.waitAllowed());
};
LESSON.offerWait=function(){
  if(!LESSON.canWait())return;
  UI.choice('课堂任务已结束。整理笔记到下课：时间加快，恢复、同化与危险照常结算。遇到危险或集合预警立即停止，也可以随时按 R 或点按钮停止。',[
    {label:'开始整理（6 倍时间）',fn:LESSON.startWait},
    {label:'现在离开座位',fn:function(){S.seated=false;resetInputState();}}
  ]);
};
LESSON.startWait=function(){
  if(!LESSON.canWait())return;
  var key=LESSON.currentKey();RT.lessons[key].waitUsed=true;
  LESSON.waiting={key:key,until:periodAt(S.tsec)[1],room:S.room};
  resetInputState();autoSave();LESSON.paintButton();
};
LESSON.stopWait=function(){
  if(!LESSON.waiting)return;
  LESSON.waiting=null;autoSave();
};
/* 快进仍逐步调用完整模拟，不能直接改钟表或把整段 SAN 恢复白送给玩家。 */
LESSON.fastForward=function(step){
  for(var i=0;i<5&&LESSON.waiting;i++){
    if(!LESSON.waitAllowed()){LESSON.stopWait();break;}
    var dt=Math.min(step,realSecondsBetween(S.tsec,LESSON.waiting.until));
    if(dt<1e-8){LESSON.stopWait();break;}
    RT.studySkipped=(RT.studySkipped||0)+dt;
    update(dt);
  }
};
LESSON.tick=function(dt){
  LESSON.checkInterrupt();if(!LESSON.on)return;
  var r=LESSON.record();r.left=Math.max(0,r.left-dt);
  if(r.left<=0){r.done=true;LESSON.close(false);os('我：老师把纸收走了。',2.4);}
  else LESSON.paint();
};
LESSON.paint=function(){
  if(!LESSON.on)return;
  document.getElementById('lessonTime').textContent='课堂仍在继续 · '+Math.ceil(LESSON.record().left)+' 秒';
};
LESSON.paintButton=function(){
  var investigate=document.getElementById('investigateOpen'),available=Investigation.deskAvailable();
  if(investigate){investigate.hidden=!available;investigate.textContent=IS_TOUCH?'看停车单':'看停车单 · R';}
  var button=document.getElementById('lessonOpen');if(!button)return;
  var r=RT.lessons&&RT.lessons[LESSON.currentKey()];
  var label=LESSON.waiting?'停止整理':r&&r.done?'整理到下课':'看课桌';
  button.textContent=label+(IS_TOUCH?'':' · R');
  button.hidden=!LESSON.waiting&&(available||LESSON.on||!LESSON.available()||!!(r&&r.done&&!LESSON.canWait()));
};
