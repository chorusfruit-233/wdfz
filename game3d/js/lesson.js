/* 课桌上的短互动：不暂停课堂，每节一次；进度跟随 RT 存档。 */
'use strict';
var LESSON={on:false,key:null};
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
    !(S.intro>0)&&!HIDE.on&&!AN.active&&!PAT.locked&&S.seated&&atMySeat()&&needWhere(S.tsec)==='教室';
};
LESSON.record=function(){return RT.lessons&&RT.lessons[LESSON.key];};
LESSON.open=function(){
  if(LESSON.on||!LESSON.available())return;
  var key=LESSON.currentKey();RT.lessons=RT.lessons||{};
  if(RT.lessons[key]&&RT.lessons[key].done)return;
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
  if(index===task.answer){S.san=Math.min(100,S.san+2);addClue('lesson');os('我：'+task.note,4.4,OS_KEEP);}
  else os('我：老师没有说对不对，只让我把纸翻过去。',3.4);
  LESSON.close(false);autoSave();
};
LESSON.checkInterrupt=function(){
  if(LESSON.on&&(!LESSON.available()||LESSON.key!==LESSON.currentKey()))LESSON.close(false);
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
  var button=document.getElementById('lessonOpen');if(!button)return;
  var r=RT.lessons&&RT.lessons[LESSON.currentKey()];
  button.textContent=IS_TOUCH?'看课桌':'看课桌 · R';
  button.hidden=LESSON.on||!LESSON.available()||!!(r&&r.done);
};
