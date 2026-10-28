/* 里世界 3D · 字幕、面板、背包、地图 */
'use strict';

var DLG={open:false,timer:0,keep:false,queue:[]};
var PAUSE={on:false};

/* how：OS_KEEP = 线索，放完之前不会被别的字幕顶掉（后来的排队）；
        OS_FORCE = 死亡、惊醒这类，立刻显示并清掉排队。 */
var OS_KEEP=1, OS_FORCE=2;
function os(msg,dur,how){
  if(how===OS_FORCE) DLG.queue.length=0;
  else if(DLG.open&&DLG.keep&&DLG.timer>0){
    /* 普通字幕最多排两条，再多就是过时的念叨了 */
    if(how===OS_KEEP||DLG.queue.length<2) DLG.queue.push([msg,dur,how]);
    return;
  }
  var el=document.getElementById('sub');
  el.textContent=msg; el.style.display='block';
  el.style.opacity='1';
  DLG.open=true; DLG.keep=(how===OS_KEEP);
  DLG.timer=(dur||3.2)*(typeof SUB_MULT!=='undefined'?SUB_MULT:1);
}
function toast(msg){
  var el=document.getElementById('toast');
  el.textContent=msg; el.style.opacity='1';
  clearTimeout(el._t); el._t=setTimeout(function(){ el.style.opacity='0'; },1500);
}
function updateDialog(dt){
  if(DLG.open && !UI.anyOpen() && !PAUSE.on){
    DLG.timer-=dt;
    if(DLG.timer<=0&&DLG.queue.length){ var n=DLG.queue.shift(); DLG.keep=false; os(n[0],n[1],n[2]); return; }
    if(DLG.timer<=0){ DLG.open=false; DLG.keep=false; var _e=document.getElementById('sub'); _e.style.opacity='0'; setTimeout(function(){ if(!DLG.open) _e.style.display='none'; },240); }
  }
}

var UI={ bagDirty:true, spotsDirty:true, openPanel:null, chooseOpen:false, choiceTimer:0, choiceTicker:0, choiceId:0, choiceDeadline:0, lastTab:'bag' };

/* 随身手册：背包、思索、笔记、地图是同一个面板的四个页签。
   UI.openPanel 仍然记的是具体页签（'bag' / 'think' / 'note' / 'mapv'），Tab / H / J / M 打开或切换，同一个键再按一次合上。 */
var JOURNAL_TABS={bag:1,think:1,note:1,mapv:1};
UI.anyOpen=function(){ return !!UI.openPanel||UI.chooseOpen; };
UI.open=function(id){
  var el=document.getElementById(id);
  if(!el) return;
  var previous=UI.openPanel;
  UI.openPanel=id;
  if(previous&&previous!==id)UI.close(previous,false);
  if(JOURNAL_TABS[id]){
    UI.lastTab=id;
    var jr=document.getElementById('journal'); if(jr) jr.style.display='flex';
    var tabs=document.querySelectorAll('#journal .jtabs button');
    for(var i=0;i<tabs.length;i++){ var on=tabs[i].getAttribute('data-tab')===id; tabs[i].classList.toggle('on',on); tabs[i].setAttribute('aria-selected',String(on)); }
    el.style.display='block';
    document.body.classList.add('jopen');
  }else el.style.display='flex';
  resetInputState();releaseMouseLook();
  if(id==='bag') UI.renderBag();
  if(id==='note') UI.renderNote();
  if(id==='think') UI.renderThink();
  if(id==='mapv') UI.renderMap();
  updateTouchUI();
};
UI.close=function(id,resume){
  if(!id) return;
  var el=document.getElementById(id);
  if(el) el.style.display='none';
  if(UI.openPanel===id){
    if(JOURNAL_TABS[id]){ var jr=document.getElementById('journal'); if(jr) jr.style.display='none'; document.body.classList.remove('jopen'); }
    UI.openPanel=null;resetInputState();
    if(resume!==false)resumeMouseLook();
    updateTouchUI();
  }
};
UI.toggle=function(id){
  if(S.screen!=='play'||S.dead) return;
  if(UI.openPanel===id) UI.close(id); else UI.open(id);
};
UI.choice=function(text,opts,options){
  UI.clearChoiceTimer();
  var choiceId=++UI.choiceId;
  var el=document.getElementById('choices');
  el.innerHTML='';
  var t=document.createElement('div');
  t.className='ctext';
  t.textContent=text;
  el.appendChild(t);
  function select(i){
    if(!UI.chooseOpen||UI.choiceId!==choiceId) return;
    UI.closeChoice();
    opts[i].fn();
    resumeMouseLook(); updateTouchUI();
  }
  for(var i=0;i<opts.length;i++){
    (function(o,idx){
      var b=document.createElement('button');
      b.type='button';
      b.innerHTML='<kbd>'+(idx+1)+'</kbd>';                 /* 键盘按数字直接选 */
      b.appendChild(document.createTextNode(o.label));
      b.onclick=function(){ select(idx); };
      el.appendChild(b);
    })(opts[i],i);
  }
  el.style.display='flex';
  UI.chooseOpen=true; document.body.classList.add('chopen');
  if(options&&options.timeoutMs>0&&opts.length){
    var end=performance.now()+options.timeoutMs;
    UI.choiceDeadline=end;
    var timer=document.createElement('div'); timer.className='choice-timer';
    timer.setAttribute('role','status'); el.appendChild(timer);
    var bar=document.createElement('div'); bar.className='choice-bar'; bar.innerHTML='<i></i>'; el.appendChild(bar);
    var fill=bar.firstChild, total=options.timeoutMs;
    function paintTimer(){
      var left=Math.max(0,end-performance.now());
      var label='剩余 '+Math.ceil(left/1000)+' 秒 · 超时随机选择';
      if(timer.textContent!==label) timer.textContent=label;
      fill.style.width=(left/total*100).toFixed(1)+'%';
    }
    paintTimer();
    UI.choiceTicker=setInterval(paintTimer,100);
    UI.choiceTimer=setTimeout(function(){ select(Math.floor(Math.random()*opts.length)); },options.timeoutMs);
  }
  resetInputState();releaseMouseLook();
  updateTouchUI();
};
UI.clearChoiceTimer=function(){
  clearTimeout(UI.choiceTimer); clearInterval(UI.choiceTicker);
  UI.choiceTimer=0; UI.choiceTicker=0; UI.choiceDeadline=0;
};
/* 选择框打开时按数字键选第 n 项 */
UI.choiceKey=function(n){
  if(!UI.chooseOpen) return false;
  var bs=document.querySelectorAll('#choices button');
  if(n<1||n>bs.length) return false;
  bs[n-1].click(); return true;
};
UI.closeChoice=function(){
  UI.clearChoiceTimer(); UI.choiceId++;
  UI.chooseOpen=false; document.body.classList.remove('chopen');
  var el=document.getElementById('choices');
  el.style.display='none';
  updateTouchUI();
};
var BAGTAP={i:-1,t:0};
function bagUse(i){
  var now=Date.now();
  var dbl=(BAGTAP.i===i && now-BAGTAP.t<340);
  S.bagSel=i;
  var id=S.bag[i];
  if(!id){ BAGTAP.i=-1; UI.renderBag(); return; }
  if(dbl){ BAGTAP.i=-1; useItem(id); }
  else { BAGTAP.i=i; BAGTAP.t=now; }
  UI.renderBag();
}
function hotToggle(slot,i){
  var id=S.bag[i];
  if(!id) return;
  if(S.hot[slot]===id){ S.hot[slot]=null; toast('快捷栏 '+(slot+1)+'：取下「'+ITEMS[id].n+'」'); }
  else{ S.hot[slot]=id; toast('「'+ITEMS[id].n+'」→ 快捷栏 '+(slot+1)+(slot?'（按 2）':'（按 1）')); }
  try{ SFX.click(); }catch(e){}
  var el=document.getElementById('hot'); if(el) el._sig='';
  UI.renderHot(); UI.renderBag();
}
function bagDescAt(i){
  var id=S.bag[i];
  if(!id) return '第 '+(i+1)+' 格是空的。';
  var st=[];
  if(S.hot[0]===id) st.push('在快捷栏 1');
  if(S.hot[1]===id) st.push('在快捷栏 2');
  if(id==='torch'&&USE.torch) st.push('开着');
  if(id==='brolly'&&USE.brollyShield) st.push('撑开着');
  return ITEMS[id].d+(st.length?'\n'+st.join(' · '):'');
}
/* 选中格子的操作按钮：使用、放进 / 取下快捷栏、丢弃。以前只有格子右上角很小的 ①② 和「丢」 */
function bagActions(i){
  var box=document.getElementById('bagacts'); if(!box) return;
  box.innerHTML='';
  var id=S.bag[i]; if(!id) return;
  function btn(label,cls,fn){
    var b=document.createElement('button'); b.type='button'; b.className=cls||''; b.innerHTML=label;
    b.onclick=function(ev){ if(ev&&ev.stopPropagation) ev.stopPropagation(); fn(); };
    box.appendChild(b);
  }
  btn('使用','primary',function(){ BAGTAP.i=-1; useItem(id); if(UI.openPanel==='bag') UI.renderBag(); });
  for(var s=0;s<2;s++)(function(s){
    btn(S.hot[s]===id?'从快捷栏 '+(s+1)+' 取下':'放到快捷栏 '+(s+1),S.hot[s]===id?'on':'',function(){ hotToggle(s,i); });
  })(s);
  btn('丢弃','danger',function(){ dropAt(i); });
}
UI.renderBag=function(){
  var g=document.getElementById('bags');
  if(!g) return;
  g.innerHTML='';
  for(var i=0;i<8;i++){
    (function(i){
      var d=document.createElement('div');
      var id=S.bag[i];
      d.className='s'+(S.bagSel===i?' on':'')+(id?'':' empty');
      d.innerHTML=id?
        ('<span class="item"><span class="ic" style="color:'+itemColor(id)+'">'+itemGlyph(id)+'</span>'+
         '<span class="nm">'+ITEMS[id].n+'</span></span>'+
         ((S.hot[0]===id||S.hot[1]===id)?'<span class="hk">'+(S.hot[0]===id?'1':'')+(S.hot[1]===id?'2':'')+'</span>':'')):'';
      d.onclick=function(){ bagUse(i); };
      g.appendChild(d);
    })(i);
  }
  var sel=S.bag[S.bagSel];
  var nm=document.getElementById('bagname');
  if(nm) nm.textContent=sel?ITEMS[sel].n:'　';
  var de=document.getElementById('bagdesc');
  if(de) de.textContent=sel?bagDescAt(S.bagSel):(S.bag.length?'点一格看看。':'背包是空的。到处翻翻：抽屉、柜子、讲台。');
  bagActions(S.bagSel);
  var cap=document.querySelector('#journal .jtabs [data-tab="bag"]');
  if(cap) cap.setAttribute('data-count',S.bag.length+'/8');
  UI.bagDirty=false;
  UI.renderHot();
};
UI.renderHot=function(){
  var hot=document.getElementById('hot');
  if(!hot) return;
  var sig=S.hot.join(',');
  if(hot._sig===sig) return;
  hot._sig=sig;
  hot.innerHTML='';
  for(var i=0;i<2;i++){
    (function(i){
      var d=document.createElement('div');
      d.className='hslot'+(S.hot[i]?' on':'');
      d.innerHTML='<span class="k">'+(i+1)+'</span>'+(S.hot[i]?
        ('<span class="ic" style="color:'+itemColor(S.hot[i])+'">'+itemGlyph(S.hot[i])+'</span>'+
         '<span class="nm">'+ITEMS[S.hot[i]].n+'</span>'):'<span class="nm">空</span>');
      d.onclick=function(){ useHot(i); };
      hot.appendChild(d);
    })(i);
  }
};
UI.renderNote=function(){
  var h='';
  var ideas=ideasAvailable();
  function sec(t){ h+='<h3>'+t+'</h3>'; }
  function li(t,cls){ h+='<div class="nl'+(cls?' '+cls:'')+'">'+t+'</div>'; }
  sec('目标');
  li('找到一条离开学校的路。在理智耗尽之前。','goal');
  sec('想到的办法');
  if(!ideas.length) li('（一条都没有。得先走过那些地方。）','dim');
  for(var i=0;i<ideas.length;i++) li(ideas[i].n);
  sec('注意到的事');
  var any=false;
  for(var k in S.spots){ li(kLabel(k)); any=true; }
  var CLUE_NOTE=[
    ['roomkey','网络中心的门锁着 —— 钥匙可能在行政楼五楼的校长办公室。'],
    ['stall','教学楼一楼厕所，第三个隔间：「11:45:00　放下一样东西」。要精确到秒：手表，或者「秒表」天赋。'],
    ['trash','垃圾房的桶盖上写着：清运 17:30。'],
    ['usb','门禁终端要插 U 盘。U 盘大概还在网络中心里。'],
    ['comp','白名单里已经有我了。还差行政楼三楼那一步。'],
    ['gatew','西小门的闸机只认白名单。'],
    ['pendulum','物理实验室的单摆，能"预报"下一次。'],
    ['bell','钟楼的钟是哑的。可它和十三下钟声有关系。']
  ], ci;
  for(ci=0;ci<CLUE_NOTE.length;ci++){
    if(typeof hasClue==='function'&&hasClue(CLUE_NOTE[ci][0])){ li(CLUE_NOTE[ci][1]); any=true; }
  }
  if(!any) li('（还没注意到什么。）','dim');
  if(!hasItem('notebook')||!hasItem('pen')) h+='<div class="nwarn">我：感觉头不舒服，很多东西都容易忘了。（带上笔记本和笔，想到的事就不会忘）</div>';
  document.getElementById('notein').innerHTML=h;
};
function kLabel(k){
  for(var i=0;i<SPOTS.length;i++) if(SPOTS[i].id===k) return SPOTS[i].n;
  var m={turn:'被拍肩膀',hand:'隔间的手',repeat:'作业交了吗',roster:'名单',comp:'机房',beast:'第三个隔间'};
  return m[k]||k;
}
UI.renderThink=function(){
  var ideas=ideasAvailable();
  document.getElementById('thinkhint').textContent=ideas.length?
    '选一个，然后去做。':'（什么都想不出来。先走一走。）';
  var el=document.getElementById('ideas');
  el.innerHTML='';
  for(var i=0;i<ideas.length;i++){
    (function(it){
      var d=document.createElement('button');
      d.type='button';
      d.className='idea';
      d.textContent=it.n;
      d.onclick=function(){ chooseIdea(it.id); };
      el.appendChild(d);
    })(ideas[i]);
  }
};
/* 把字收进画布里 */
function mapLabel(c,txt,x,y,cw,ch){
  var w=c.measureText(txt).width;
  c.fillText(txt,clamp(x,3,cw-w-3),clamp(y,13,ch-4));
}
UI.renderMap=function(){
  var el=document.getElementById('mapc');
  var bw=BOUND.x1-BOUND.x0, bh=BOUND.y1-BOUND.y0;
  /* 按手册内容区的实际大小铺满（以前固定取窗口的 60% × 76%） */
  var body=el.parentElement&&el.parentElement.parentElement;
  var availW=Math.max(160,Math.min((body?body.clientWidth:window.innerWidth*0.6)-24,900));
  var availH=Math.max(160,(body?body.clientHeight:window.innerHeight*0.76)-48);
  var sc=Math.min(availW/bw,availH/bh);
  var cw=Math.round(bw*sc), ch=Math.round(bh*sc);
  el.innerHTML='<canvas id="mapcv" width="'+cw+'" height="'+ch+'"></canvas>';
  var cv=document.getElementById('mapcv'); if(!cv) return;
  var c=cv.getContext('2d'); if(!c) return;
  function X(v){ return (v-BOUND.x0)*sc; }
  function Y(v){ return (v-BOUND.y0)*sc; }
  c.strokeStyle='rgba(120,180,150,.35)'; c.lineWidth=2;
  c.strokeRect(X(BOUND.x0),Y(BOUND.y0),bw*sc,bh*sc);
  c.fillStyle='rgba(150,160,150,.16)';
  for(var ri=0;ri<ROADS.length;ri++){ var rd=ROADS[ri]; c.fillRect(X(rd[0]),Y(rd[1]),(rd[2]-rd[0])*sc,(rd[3]-rd[1])*sc); }
  for(var i=0;i<OBJ.length;i++){
    var o=OBJ[i];
    c.fillStyle=o.k==='roof'?'#1c2a30':(o.k==='field'?'#16241b':(o.k==='court'?'#1a2427':(o.k==='garden'?'#17251e':'#182420')));
    c.fillRect(X(o.x),Y(o.y),o.w*sc,o.h*sc);
    c.strokeStyle='rgba(120,180,150,.30)'; c.lineWidth=1;
    c.strokeRect(X(o.x),Y(o.y),o.w*sc,o.h*sc);
  }
  /* 字最后写，免得被后画的方块盖住。窄的建筑（保安岗、钟楼、垃圾房、车棚……）以前不写名字：字放到旁边 */
  c.fillStyle='rgba(160,200,180,.62)'; c.font='10px monospace';
  var boxes=[], used=[];
  for(i=0;i<OBJ.length;i++){ o=OBJ[i]; if(o.k==='roof') boxes.push([X(o.x),Y(o.y),X(o.x+o.w),Y(o.y+o.h)]); }
  for(i=0;i<OBJ.length;i++){
    o=OBJ[i];
    if(o.k==='roof'&&o.w*sc>34){ c.fillText(o.n,X(o.x)+3,Y(o.y)+12); used.push([X(o.x)+3,Y(o.y)+2,X(o.x)+3+c.measureText(o.n).width,Y(o.y)+12]); }
  }
  var gates=[['北门',GATE_N],['西小门',GATE_W],['南门',GATE_S]];
  c.font='11px monospace';
  for(i=0;i<gates.length;i++){
    var gw=c.measureText(gates[i][0]).width, gx=clamp(X(gates[i][1].x)-11,3,cw-gw-3), gy=clamp(Y(gates[i][1].y)-6,13,ch-4);
    used.push([gx,gy-11,gx+gw,gy]);
  }
  c.font='10px monospace';
  for(i=0;i<OBJ.length;i++){
    o=OBJ[i];
    if(o.k!=='roof'||o.w*sc>34) continue;
    /* 右边、下边、左边里挑压得最少的：压住别的字最糟，压住别的楼其次 */
    var nm=o.s||o.n, tw=c.measureText(nm).width, own=X(o.x)+','+Y(o.y);
    var cand=[[X(o.x+o.w)+3,Y(o.y)+12],[X(o.x),Y(o.y+o.h)+11],[X(o.x)-tw-3,Y(o.y)+12]], pos=cand[0], best=1e9;
    for(var k=0;k<cand.length;k++){
      var r=[clamp(cand[k][0],3,cw-tw-3),0,0,0]; r[1]=clamp(cand[k][1],13,ch-4)-10; r[2]=r[0]+tw; r[3]=r[1]+10;
      var over=function(b){ return r[0]<b[2]&&r[2]>b[0]&&r[1]<b[3]&&r[3]>b[1]; };
      var cost=used.filter(over).length*10+boxes.filter(function(b){ return b[0]+','+b[1]!==own&&over(b); }).length;
      if(cost<best){ best=cost; pos=cand[k]; }
    }
    mapLabel(c,nm,pos[0],pos[1],cw,ch);
    used.push([clamp(pos[0],3,cw-tw-3),clamp(pos[1],13,ch-4)-10,clamp(pos[0],3,cw-tw-3)+tw,clamp(pos[1],13,ch-4)]);
  }
  c.fillStyle='#c8a24a'; c.font='11px monospace';
  for(i=0;i<gates.length;i++){
    c.fillRect(X(gates[i][1].x)-2,Y(gates[i][1].y)-2,4,4);
    /* 门都在边界上，字以前有一半画到了图外（北门只剩一个黄点） */
    mapLabel(c,gates[i][0],X(gates[i][1].x)-11,Y(gates[i][1].y)-6,cw,ch);
  }
  var px=X(S.x/SC), py=Y(S.y/SC);
  var R=S.mode==='in'?INTERIORS[S.room]:null, ho=R?objById(R.host):null;
  if(ho){ px=X(ho.x+ho.w/2); py=Y(ho.y+ho.h/2); }
  c.fillStyle='#79c8a4';
  c.beginPath(); c.arc(px,py,4.5,0,6.283); c.fill();
  c.strokeStyle='rgba(121,200,164,.75)'; c.lineWidth=1.5;
  c.beginPath(); c.moveTo(px,py);
  c.lineTo(px+Math.cos(S.ang)*16,py+Math.sin(S.ang)*16); c.stroke();
};
UI.closePanelAll=function(){
  ['bag','note','think','mapv','pause','set'].forEach(function(id){ UI.close(id,false); });
};
