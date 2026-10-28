/* 里世界 3D · 前情提要 */
'use strict';

var PRO_PAGES=[
  '你是这学期转来的。',
  '高二（二）班。第四节，语文。老师在念一篇课文，念到一半，又从头念了一遍。',
  '前排的人回头问你借橡皮。你还没记住他的名字。\n他好像也不记得你的。',
  '才第三天。这栋楼你只认得三层。\n可是你数过——楼梯一共有五层半。',
  '粉笔灰在光里飘。你开始数秒：一，二，三……数到第七秒的时候，它们停在了半空。',
  '眼皮很重。黑板上的字开始往下淌，淌成一行一行的竖线。',
  '你把脸埋进胳膊里。袖子上有一股不属于你的味道。',
  '……',
  '你睁开眼。\n教室里还是坐满了人。只是没有一个人在呼吸。',
  '窗外的颜色不见了。走廊里很安静，安静得能听见灯管里的电流。',
  '下课铃没有响。\n你忽然很确定：这不是你转来的那个学校。\n而它，已经知道你醒了。'
];
var PRO={on:false,i:0,seen:false,woke:false,see:false,busy:false};
function eyelid(close,mid,open){
  var t=document.getElementById('lidtop'), b=document.getElementById('lidbot');
  if(!t||!b){ mid(); if(open) open(); return; }
  t.style.height='50%'; b.style.height='50%';
  setTimeout(function(){
    try{ mid(); }catch(e){}
    setTimeout(function(){
      t.style.height='0'; b.style.height='0';
      if(open) setTimeout(open,240);
    }, close||420);
  }, 360);
}
function proWake(then){
  if(PRO.woke) { if(then) then(); return; }
  PRO.woke=true;
  try{ SFX.resume(); }catch(e){}
  eyelid(460, function(){
    try{ ncFlip(); }catch(e){}
    try{ GLR.worldNorm=0; }catch(e){}
    try{ SFX.blink(); }catch(e){}
    PRO.see=true;
    var el=document.getElementById('pro');
    if(el) el.classList.add('see');
  }, function(){ if(then) then(); });
}
function proSeen(){
  try{ return localStorage.getItem('wdfz_pro')==='1'; }catch(e){ return false; }
}
function proMark(){ try{ localStorage.setItem('wdfz_pro','1'); }catch(e){} }
function proShow(){
  var el=document.getElementById('pro');
  if(!el){ proEnd(); return; }
  PRO.on=true; PRO.i=0; PRO.woke=false; PRO.see=false; PRO.busy=false;
  try{ GLR.worldNorm=1; }catch(e){}          /* 先按"正常世界"渲染 */
  try{ if(el.classList) el.classList.remove('see'); }catch(e){}
  try{ document.body.classList.add('pro'); }catch(e){}
  PRO.seen=proSeen();
  var t=document.getElementById('protext');
  if(t){ t.textContent=PRO_PAGES[0]; t.style.opacity='1'; }
  el.classList.add('on'); el.style.display='flex';
}
function proEnd(){
  PRO.on=false;
  var el=document.getElementById('pro');
  if(el){ el.classList.remove('on'); el.classList.remove('see'); el.style.display='none'; }
  try{ document.body.classList.remove('pro'); }catch(e){}
  proMark();
  try{ GLR.worldNorm=0; }catch(e){}
  try{ ncFlip(); }catch(e){}
  try{ os('我：11:40。第四节。我坐在自己的位子上——至少，名牌上写的是我的名字。',4.8); }catch(e){}
}
function proSetText(txt){
  var t=document.getElementById('protext');
  if(!t) return;
  t.style.opacity='0';
  setTimeout(function(){
    if(!PRO.on||!t) return;
    t.textContent=txt; t.style.opacity='1';
  },200);
}
function proNext(){
  if(!PRO.on||PRO.busy) return;           /* 睁眼动画期间再按一次，会把第 8 页直接跳过去 */
  PRO.i++;
  if(PRO.i>=PRO_PAGES.length){ proEnd(); return; }
  if(PRO.i===6&&!PRO.see){
    PRO.see=true;
    var el=document.getElementById('pro');
    if(el) el.classList.add('see');
  }
  if(PRO.i===8&&!PRO.woke){
    var page=PRO.i;
    PRO.busy=true;
    proWake(function(){ PRO.busy=false; proSetText(PRO_PAGES[page]); });
    return;
  }
  proSetText(PRO_PAGES[PRO.i]);
}
