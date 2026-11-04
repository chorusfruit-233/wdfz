/* @module-capsule */
(function($imports){
/* 里世界 3D · 调试面板 */
'use strict';

var DEV={on:false,locking:false,fast:false,god:false,freeze:false,tab:'status',refreshT:0,lists:null,returnFocus:null,previewFx:null,previewTimer:0,panelPos:null,drag:null,dragReady:false,
  minimized:false,ballPos:null,ballMoved:false,scrollTop:0,history:[]};
var DEV_POI=[
  ['北门',514,115],['西小门',214,624],['南门',386,1276],
  ['大操场',344,350],['花园雕塑',535,1020],['车库入口',485,163],
  ['宿舍区',420,1160],['食堂西门',530,1160],['教学楼前',561,995],
  ['东干道',704,600],['东围墙',800,700],['垃圾房',768,1134]
];
var DEV_DEATH=[
  ['黑影逼近','vignette'],['地面翻起','floor'],['脚下伸手','grip'],['侧向长条','neck'],
  ['影子','shadow'],['蛾群','swarm'],['雨','drown'],['水','water'],['冻','freeze'],
  ['回头','gaze'],['围观','stare'],['广播','voice'],['钟声','bell'],['跟随','follow'],
  ['碎裂','shatter'],['深坑','deep'],['仪式圈','ring'],['名单','names'],['黑板','chalk'],
  ['走廊','loop'],['双生','twin'],['灯','lamps'],['缝隙','slit'],['挤墙','squeeze'],
  ['对视','face'],['墙','wall'],['笑','laugh'],['镜子','mirror'],['隔间伸手','hand'],['垃圾桶','trash'],['电梯门','liftdoor']];
/* 调试面板的页签；模块可以往里加自己的页（mod-manager 加「Mod」） */
var DEV_TABS=['status','scene','items','events','tools'];
var DEV_CODE='114514';
/* 调试密码：页面里画的数字键盘（#devlock），点击 / 触屏输入，桌面也可以直接按数字键；不用浏览器的 prompt 对话框。
   打开期间算作调试冻结（gameInputContext 的 debugFrozen）：和以前 prompt 卡住整个页面一样，输密码时世界不走。
   输错不关键盘，清空后可以再输；取消、Esc、再按 F2 都会关掉并把鼠标视角还回去。 */
var DevLock={on:false,buf:'',max:12,opts:null,
  el:function(id){ return document.getElementById(id); },
  /* opts（可选）：{title, onOk, onCancel}。不给就是打开调试面板；死亡档案室的「全部解锁」也用这同一个键盘、同一个密码 */
  ask:function(opts){
    var box=this.el('devlock'); if(!box) return false;
    this.opts=opts||null;
    var title=this.el('devlockTitle'); if(title) title.textContent=(opts&&opts.title)||'输入调试密码';
    if(!box._wired){
      box._wired=true;
      box.addEventListener('click',function(e){ var b=e.target.closest&&e.target.closest('[data-k]'); if(b) DevLock.press(b.getAttribute('data-k')); });
      this.el('devlockBox').addEventListener('animationend',function(){ this.classList.remove('shake'); });
    }
    this.on=true; DEV.locking=true; this.buf=''; this.msg('');
    box.hidden=false; this.paint();
    var first=box.querySelector('[data-k="1"]'); if(first) first.focus({preventScroll:true});
    return true;
  },
  press:function(k){
    if(!this.on) return;
    if(/^[0-9]$/.test(k)){ if(this.buf.length<this.max) this.buf+=k; this.msg(''); }
    else if(k==='back') this.buf=this.buf.slice(0,-1);
    else if(k==='ok'){ this.submit(this.buf); return; }
    else if(k==='cancel'){ this.cancel(); return; }
    this.paint();
  },
  submit:function(code){
    if(!this.on) return false;
    if(String(code)===DEV_CODE){ var o=this.opts; this.close(); if(o&&o.onOk) o.onOk(); else Dev.unlock(); return true; }
    this.buf=''; this.paint();
    this.msg(String(code).length?'密码不对，再试一次':'请先输入密码');
    var b=this.el('devlockBox'); if(b){ b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); }
    return false;
  },
  cancel:function(){
    if(!this.on) return;
    var o=this.opts;
    this.close();
    if(o){ if(o.onCancel) o.onCancel(); return; }
    var f=DEV.returnFocus; DEV.returnFocus=null;
    if(f&&f.focus&&document.contains(f)) try{ f.focus({preventScroll:true}); }catch(e){}
    (0,$imports.resumeMouseLook)();
  },
  close:function(){ this.on=false; DEV.locking=false; this.buf=''; this.opts=null; var box=this.el('devlock'); if(box) box.hidden=true; },
  /* 键盘：数字、退格、回车确认、Esc / F2 取消；其余按键在键盘打开时都不交给游戏 */
  key:function(e){
    var k=e.key;
    if(/^[0-9]$/.test(k)) this.press(k);
    else if(k==='Backspace'||k==='Delete') this.press('back');
    else if(k==='Enter') this.press('ok');
    else if(k==='Escape'||k==='F2'){ if(!e.repeat) this.cancel(); }
    else if(k===' ') return;                             /* 留给按钮自己的空格键 */
    else if(k==='Tab'){                                  /* 焦点只在键盘里转圈，不跑到背后的页面 */
      var all=[].slice.call(this.el('devlockBox').querySelectorAll('button')), i=all.indexOf(document.activeElement);
      if(i<0||(e.shiftKey&&i===0)||(!e.shiftKey&&i===all.length-1)){ e.preventDefault(); all[e.shiftKey?all.length-1:0].focus({preventScroll:true}); }
      return;
    }
    e.preventDefault();
  },
  paint:function(){
    var s=this.el('devlockSlots'); if(!s) return;
    var n=this.buf.length, html='';
    for(var i=0;i<n;i++) html+='<i></i>';
    s.innerHTML=n?html:'<em>点下面的数字</em>';
    s.setAttribute('aria-label','已输入 '+n+' 位');
  },
  msg:function(t){ var m=this.el('devlockMsg'); if(m) m.textContent=t; }
};
var Dev={
  open:function(){
    if(DEV.on||DevLock.on)return;
    DEV.returnFocus=document.activeElement;
    (0,$imports.resetInputState)();(0,$imports.releaseMouseLook)();
    DevLock.ask();                                              /* 密码对了才调 Dev.unlock() 真正打开 */
  },
  unlock:function(){
    if(DEV.on)return;
    if(typeof $imports.LESSON!=='undefined'&&$imports.LESSON.on)$imports.LESSON.close(false);
    DEV.on=true;DEV.freeze=false;DEV.minimized=false;DEV.refreshT=0;document.body.classList.add('dev-open');
    try{ $imports.Speedrun.invalidate('debug'); }catch(e){}                /* 速通中打开调试面板：这次成绩无效 */
    (0,$imports.gameFact)('debug');                                               /* 成就、积分与通关记录：这一局标成调试局 */
    var el=document.getElementById('dev'); if(el) el.style.display='flex';
    el.classList.remove('dev-minimized');el.setAttribute('role','dialog');document.getElementById('devball').hidden=true;
    DEV.lists={
      room:Object.keys($imports.INTERIORS).map(function(k){return [k,($imports.INTERIORS[k].name||k)+' ('+k+')'];}),
      out:DEV_POI.map(function(p,i){return [String(i),p[0]];}),
      anom:$imports.AN_ID.map(function(id){return [id,($imports.AN_NAME[id]||id)+' ('+id+')'];}),
      death:DEV_DEATH.map(function(d){return [d[1],d[0]+' ('+d[1]+')'];}),
      item:Object.keys($imports.ITEMS).map(function(id){return [id,$imports.ITEMS[id].n+' ('+id+')'];})
    };
    ['room','out','anom','death','item'].forEach(Dev.filter);
    Dev.initPanelDrag();Dev.tab(DEV.tab);Dev.refresh();Dev.fitPanel();(0,$imports.updateTouchUI)();
    var close=el&&el.querySelector('.devclose');if(close)close.focus({preventScroll:true});
  },
  panelBounds:function(){
    var r=document.getElementById('devbounds').getBoundingClientRect(),v=window.visualViewport;
    var left=r.left,top=r.top,right=r.right,bottom=r.bottom;
    if(v){
      left=Math.max(left,v.offsetLeft+8);top=Math.max(top,v.offsetTop+8);
      right=Math.min(right,v.offsetLeft+v.width-8);bottom=Math.min(bottom,v.offsetTop+v.height-8);
    }
    return {left:left,top:top,right:Math.max(left,right),bottom:Math.max(top,bottom)};
  },
  placePanel:function(x,y,remember){
    var el=document.getElementById('dev');if(!DEV.on||!el)return;
    var b=Dev.panelBounds(),r=el.getBoundingClientRect();
    x=Math.max(b.left,Math.min(x,Math.max(b.left,b.right-r.width)));
    y=Math.max(b.top,Math.min(y,Math.max(b.top,b.bottom-r.height)));
    el.style.left=x+'px';el.style.top=y+'px';
    if(remember)DEV[DEV.minimized?'ballPos':'panelPos']={x:x,y:y};
  },
  /* 手机横屏：摇杆和交互键之间那一条，同时让开右上角的手册 / 暂停（按控件的实际位置算，自定义的触屏布局也照顾到）。
     触屏控件暂时隐藏时（例如暂停），用上一次布局量到的位置 */
  landBand:function(b){
    var left=b.left,right=b.right,mid=(b.left+b.right)/2,shown=document.getElementById('touch').style.display==='block';
    ['stick','tAct','ttop'].forEach(function(id){
      var r=null,e=document.getElementById(id);
      if(shown&&e){ var q=e.getBoundingClientRect(); if(q.width&&q.height) r={x:q.left,w:q.width}; }
      if(!r&&typeof $imports.TouchLayout!=='undefined'&&$imports.TouchLayout.rects[id]) r={x:$imports.TouchLayout.rects[id].x,w:$imports.TouchLayout.rects[id].w};
      if(!r||r.x>b.right||r.x+r.w<b.left) return;
      if(r.x+r.w/2<mid) left=Math.max(left,r.x+r.w+8); else right=Math.min(right,r.x-8);
    });
    return {left:left,right:right};
  },
  fitPanel:function(){
    var el=document.getElementById('dev');if(!DEV.on||!el)return;
    var b=Dev.panelBounds(),width=b.right-b.left,height=b.bottom-b.top;
    var compact=$imports.IS_TOUCH||window.innerWidth<=600||window.matchMedia('(pointer: coarse)').matches;
    var land=compact&&!DEV.minimized&&width>height;
    el.classList.toggle('dev-compact',compact);
    el.classList.toggle('dev-land',land);
    el.classList.toggle('dev-short',height<300);
    el.style.display=land?'grid':'flex';
    if(land){
      /* 横屏：占满高度，宽度取摇杆和交互键之间的空当（最宽 560）；空当太窄就居中放 300 宽，盖住一点也比看不见内容强 */
      var band=Dev.landBand(b),w=Math.min(560,band.right-band.left);
      if(w<300){ w=Math.min(300,width); band={left:b.left+(width-w)/2,right:b.left+(width+w)/2}; }
      el.style.width=w+'px';el.style.maxWidth=w+'px';el.style.height=height+'px';el.style.maxHeight=height+'px';
      var x=DEV.panelPos?DEV.panelPos.x:band.left+(band.right-band.left-w)/2;
      Dev.placePanel(x,b.top,false);Dev.scrollHint();
      return;
    }
    el.style.width='';el.style.height='';
    el.style.maxWidth=width+'px';
    el.style.maxHeight=Math.min(height,window.innerHeight*(compact?(width>height?.74:.62):.82))+'px';
    /* 触屏横屏时默认放在中间，留出两侧的摇杆和交互键。用户拖动过的位置仍保留。 */
    var defaultX=$imports.IS_TOUCH&&width>height?b.left+(width-el.getBoundingClientRect().width)/2:b.left+4;
    var pos=DEV.minimized?(DEV.ballPos||{x:b.right-44,y:b.top+(height-44)/2}):(DEV.panelPos||{x:defaultX,y:b.top+4});
    Dev.placePanel(pos.x,pos.y,false);Dev.scrollHint();
  },
  setMinimized:function(value){
    if(!DEV.on||DEV.minimized===value)return;
    Dev.endPanelDrag();(0,$imports.resetInputState)();(0,$imports.releaseMouseLook)();
    var el=document.getElementById('dev'),body=document.getElementById('devbody'),ball=document.getElementById('devball');
    if(value)DEV.scrollTop=body.scrollTop;
    DEV.minimized=value;el.classList.toggle('dev-minimized',value);ball.hidden=!value;
    el.setAttribute('role',value?'group':'dialog');
    Dev.refresh();Dev.fitPanel();
    if(value)document.getElementById('cv').focus({preventScroll:true});
    else{body.scrollTop=DEV.scrollTop;document.getElementById('devcollapse').focus({preventScroll:true});}
    (0,$imports.updateTouchUI)();
  },
  resetPanelPosition:function(){Dev.endPanelDrag();DEV[DEV.minimized?'ballPos':'panelPos']=null;Dev.fitPanel();},
  endPanelDrag:function(){
    var drag=DEV.drag,el=document.getElementById('dev'),handle=drag&&drag.handle;
    DEV.drag=null;if(el)el.classList.remove('dragging');
    if(drag&&handle){try{if(handle.hasPointerCapture(drag.id))handle.releasePointerCapture(drag.id);}catch(e){}}
  },
  initPanelDrag:function(){
    if(DEV.dragReady)return;
    var panel=document.getElementById('dev');if(!panel)return;
    DEV.dragReady=true;
    ['devdrag','devball'].forEach(function(id){
      var handle=document.getElementById(id);
      handle.addEventListener('pointerdown',function(e){
        if(!DEV.on||DEV.drag||!e.isPrimary||e.button!==0)return;
        var r=panel.getBoundingClientRect();DEV.ballMoved=false;
        DEV.drag={id:e.pointerId,handle:handle,x:e.clientX,y:e.clientY,left:r.left,top:r.top};
        panel.classList.add('dragging');handle.focus({preventScroll:true});
        try{handle.setPointerCapture(e.pointerId);}catch(err){}
        if(e.cancelable)e.preventDefault();
      });
      handle.addEventListener('lostpointercapture',end);
      handle.addEventListener('keydown',function(e){
        if(!DEV.on)return;
        if(e.key==='Enter'||e.key===' ')DEV.ballMoved=false;
        if(e.key==='Home'){e.preventDefault();Dev.resetPanelPosition();return;}
        var delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
        if(!delta)return;
        e.preventDefault();var r=panel.getBoundingClientRect(),step=e.shiftKey?48:16;
        Dev.placePanel(r.left+delta[0]*step,r.top+delta[1]*step,true);
      });
    });
    document.getElementById('devball').addEventListener('click',function(e){
      if(DEV.ballMoved){e.preventDefault();return;}Dev.setMinimized(false);
    });
    window.addEventListener('pointermove',function(e){
      var d=DEV.drag;if(!d||e.pointerId!==d.id)return;
      if(e.pointerType==='mouse'&&e.buttons===0){Dev.endPanelDrag();return;}
      if(DEV.minimized){
        if(Math.hypot(e.clientX-d.x,e.clientY-d.y)>10)DEV.ballMoved=true;
        if(!DEV.ballMoved)return;
      }
      Dev.placePanel(d.left+e.clientX-d.x,d.top+e.clientY-d.y,true);
      if(e.cancelable)e.preventDefault();
    },{passive:false});
    function end(e){if(DEV.drag&&e.pointerId===DEV.drag.id){if(e.type==='pointercancel')DEV.ballMoved=true;Dev.endPanelDrag();}}
    window.addEventListener('pointerup',end);window.addEventListener('pointercancel',end);
    window.addEventListener('blur',Dev.endPanelDrag);
    function viewportChanged(){
      Dev.endPanelDrag();Dev.fitPanel();
      var active=document.activeElement;
      if(DEV.on&&active&&panel.contains(active)&&active.matches('input,select,textarea')){
        requestAnimationFrame(function(){if(DEV.on&&document.activeElement===active)active.scrollIntoView({block:'nearest',inline:'nearest'});});
      }
    }
    window.addEventListener('resize',viewportChanged);
    if(window.visualViewport){window.visualViewport.addEventListener('resize',viewportChanged);window.visualViewport.addEventListener('scroll',viewportChanged);}
    if(window.ResizeObserver)new ResizeObserver(function(){Dev.fitPanel();}).observe(panel);
  },
  filter:function(kind){
    var source=DEV.lists&&DEV.lists[kind],select=document.getElementById('dev'+kind);
    var input=document.getElementById('dev'+kind+'Filter'),count=document.getElementById('dev'+kind+'Count');
    var go=document.getElementById('dev'+kind+'Go');if(!source||!select||!input)return;
    var previous=select.value,query=input.value.trim().toLowerCase();
    var matches=source.filter(function(x){return x[1].toLowerCase().indexOf(query)>=0;});
    select.textContent='';
    if(!matches.length){var empty=document.createElement('option');empty.value='';empty.textContent='没有匹配项';select.appendChild(empty);}
    matches.forEach(function(x){var o=document.createElement('option');o.value=x[0];o.textContent=x[1];select.appendChild(o);});
    if(matches.some(function(x){return x[0]===previous;}))select.value=previous;
    select.disabled=!matches.length;if(go)go.disabled=!matches.length;
    if(count)count.textContent=matches.length+' / '+source.length+' 项';
    if(kind==='item')Dev.refreshInventory();
  },
  tab:function(id){
    if(DEV_TABS.indexOf(id)<0)return;
    DEV.tab=id;
    DEV_TABS.forEach(function(name){
      var page=document.getElementById('dev-page-'+name),button=document.querySelector('[data-dev-tab="'+name+'"]');
      if(page)page.hidden=name!==id;if(button)button.setAttribute('aria-pressed',String(name===id));
    });
    var body=document.getElementById('devbody');if(body)body.scrollTop=0;
    GameModules.emit('devTab',id);                 /* 模块加的页签（例如「Mod」）在这里画自己的内容 */
    Dev.refresh();Dev.fitPanel();
  },
  report:function(msg){
    var el=document.getElementById('devmessage');if(el)el.textContent=msg;
    DEV.history.push({time:new Date().toISOString(),message:msg});if(DEV.history.length>20)DEV.history.shift();
    (0,$imports.toast)(msg);
  },
  canUse:function(){
    if($imports.S.screen==='play'&&!$imports.S.dead)return true;
    Dev.report($imports.S.dead?'角色已死亡，请先复活。':'请先开始游戏。');return false;
  },
  refresh:function(){
    if(!DEV.on)return;
    function put(id,text){var el=document.getElementById(id);if(el&&el.textContent!==text)el.textContent=text;}
    var otherPause=$imports.PAUSE.on||$imports.UI.anyOpen()||$imports.PC.on||$imports.PRO.on;
    var state=$imports.S.screen!=='play'?'未进入游戏':$imports.S.dead?'角色已死亡':otherPause?'游戏菜单已暂停':DEV.freeze?'调试暂停中':'游戏运行中';
    var ball=document.getElementById('devball');
    ball.classList.toggle('is-paused',$imports.S.screen!=='play'||$imports.S.dead||otherPause||DEV.freeze);
    ball.setAttribute('aria-label','展开调试面板 · '+state);ball.title='点击展开 · 按住拖动 · '+state;
    if(DEV.minimized)return;
    put('devrun',state);put('devclock','第 '+$imports.S.day+' 天 · '+(0,$imports.fmtClock)($imports.S.tsec));
    put('devsanValue',String(Math.round($imports.S.san)));put('devstamValue',Math.round($imports.S.stam)+'/'+Math.round((0,$imports.staminaMax)()));
    put('devviolValue',String(Math.round($imports.S.viol)));put('devttValue',String(Math.round($imports.S.tt)));
    put('devactive',$imports.AN.active?($imports.AN_NAME[$imports.AN.id]||$imports.AN.id||'未知'):'无');
    var freeze=document.getElementById('devfreeze');
    if(freeze){
      freeze.textContent=DEV.freeze||$imports.PAUSE.on||$imports.UI.openPanel==='pause'?'继续游戏':'暂停游戏';
      freeze.disabled=$imports.S.screen!=='play'||$imports.S.dead||$imports.PC.on||$imports.PRO.on||$imports.UI.chooseOpen||!!($imports.UI.openPanel&&$imports.UI.openPanel!=='pause');
    }
    Dev.pos();if(DEV.tab==='status')Dev.look();
    if(DEV.tab==='items')Dev.refreshInventory();
    if(DEV.tab==='tools')Dev.refreshDiagnostics();
    var inspection=$imports.RT.inspection,ride=$imports.RT.elevatorRide;
    put('devpatrol',$imports.PAT.permanent?'永久追踪':$imports.PAT.state==='idle'?'消灭中 · '+Math.ceil($imports.PAT.respawn)+' 秒':$imports.PAT.locked?'追逐中':$imports.PAT.behavior||'巡逻中');
    put('devinspection',inspection&&inspection.current?'检查中 · '+Math.max(0,$imports.INSPECT_CONFIG.duration-inspection.current.t).toFixed(1)+' 秒':inspection&&inspection.queue.length?'排队 '+inspection.queue.length+' 次':'无');
    put('devtravel',$imports.CarChase.active()?'驾驶 · '+Math.round($imports.RT.carChase.distance)+' 米':ride?'电梯 · '+ride.phase:'步行');
    Dev.paint();Dev.scrollHint();
  },
  scrollHint:function(){
    var body=document.getElementById('devbody'),hint=document.getElementById('devscroll');if(!body||!hint)return;
    hint.hidden=body.scrollHeight<=body.clientHeight+1;
    hint.textContent=body.scrollTop+body.clientHeight>=body.scrollHeight-1?'↑ 可滚动':'↓ 可滚动';
  },
  toggleFreeze:function(){
    if(!DEV.on||$imports.S.screen!=='play'||$imports.S.dead||$imports.PC.on||$imports.PRO.on||$imports.UI.chooseOpen||($imports.UI.openPanel&&$imports.UI.openPanel!=='pause'))return;
    var resume=DEV.freeze||$imports.PAUSE.on||$imports.UI.openPanel==='pause';
    (0,$imports.resetInputState)();DEV.freeze=!resume;
    if(resume){
      if($imports.PAUSE.on||$imports.UI.openPanel==='pause')$imports.Game.resume();
      document.getElementById('cv').focus({preventScroll:true});
    }else (0,$imports.releaseMouseLook)();
    Dev.refresh();(0,$imports.updateTouchUI)();
  },
  focusTrap:function(e){
    var panel=document.getElementById('dev');if(!panel)return;
    var all=Array.prototype.slice.call(panel.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]'));
    var controls=all.filter(function(el){return el.getClientRects().length>0;});if(!controls.length)return;
    var i=controls.indexOf(document.activeElement),target=null;
    if(e.shiftKey&&(i<=0))target=controls[controls.length-1];
    else if(!e.shiftKey&&(i<0||i===controls.length-1))target=controls[0];
    if(target){e.preventDefault();target.focus({preventScroll:true});}
  },
  setStat:function(){
    if(!Dev.canUse())return;
    var key=document.getElementById('devstatkey').value,input=document.getElementById('devstatvalue');
    var raw=input.value.trim(),value=Number(raw);
    if(!raw||!Number.isFinite(value)||value<0||value>100){Dev.report('请输入 0–100 的数值。');return;}
    if(['san','stam','viol','tt'].indexOf(key)<0)return;
    var set={san:'setSan',stam:'setStamina',viol:'setViolation',tt:'setAssimilation'};
    $imports.PlayerStats[set[key]](value,'debug',{min:0,max:100});$imports.PlayerStats.capStamina();
    Dev.report(key.toUpperCase()+' 已设为 '+Math.round($imports.S[key]*10)/10);Dev.refresh();
  },
  refreshInventory:function(){
    var select=document.getElementById('devitem');if(!select)return;
    var id=select.value,item=$imports.ITEMS[id],owned=!!item&&(0,$imports.hasItem)(id),alive=$imports.S.screen==='play'&&!$imports.S.dead;
    document.getElementById('devbag').textContent=$imports.S.bag.length+' / 8 格 · '+($imports.S.bag.map(function(k){return $imports.ITEMS[k]?$imports.ITEMS[k].n:k;}).join('、')||'空背包');
    document.getElementById('devitemInfo').textContent=item?(owned?'已持有 · ':'未持有 · ')+item.d:'没有匹配的物品';
    document.getElementById('devitemGo').disabled=!alive||!item||owned||$imports.S.bag.length>=8;
    ['devitemRemove','devitemHot1','devitemHot2'].forEach(function(key){document.getElementById(key).disabled=!alive||!owned;});
    document.getElementById('devhotbar').textContent=$imports.S.hot.map(function(k,i){return (i+1)+'：'+($imports.ITEMS[k]?$imports.ITEMS[k].n:'空');}).join(' · ');
  },
  editItem:function(action,slot){
    if(!Dev.canUse())return;
    var id=document.getElementById('devitem').value,item=$imports.ITEMS[id];if(!item)return;
    if(action==='add'){
      if((0,$imports.hasItem)(id)){Dev.report('背包里已有此物品。');return;}
      if($imports.S.bag.length>=8){Dev.report('背包已满，请先移除一件物品。');return;}
      (0,$imports.addItem)(id);Dev.report('已添加：'+item.n);
    }else if(action==='remove'){
      if(!(0,$imports.removeItem)(id)){Dev.report('背包里没有此物品。');return;}
      Dev.report('已移除：'+item.n);
    }else if(action==='hot'&&(slot===0||slot===1)){
      if(!(0,$imports.hasItem)(id)){Dev.report('请先将物品加入背包。');return;}
      $imports.Inventory.setHot(slot,id);Dev.report(item.n+' → 快捷栏 '+(slot+1));
    }else return;
    Dev.refreshInventory();
  },
  canChangeTime:function(){
    if(!Dev.canUse())return false;
    var queued=$imports.RT.inspection&&$imports.RT.inspection.queue.some(function(item){return !$imports.Inspection.stale(item);});
    if($imports.Elevator.inRide()||$imports.CarChase.active()||$imports.Inspection.pending()||queued){
      Dev.report('请先结束电梯、驾驶或检查，再调整时间。');return false;
    }
    return true;
  },
  setTime:function(value){
    var raw=value===undefined?document.getElementById('devtime').value:value;
    if(!/^\d{2}:\d{2}$/.test(raw)){Dev.report('请输入有效的时分。');return;}
    var parts=raw.split(':').map(Number),target=parts[0]*60+parts[1];
    if(parts[0]>23||parts[1]>59||(target>=60&&target<440)){Dev.report('可选时段为 07:20–次日 00:59；01:00 后会跳到早晨。');return;}
    if(target<60)target+=1440;
    if(!Dev.canChangeTime())return;
    Dev.time(target-$imports.S.tsec);document.getElementById('devtime').value=raw;
  },
  canStageEvent:function(){
    if(!Dev.canUse())return false;
    if($imports.PRO.on||$imports.PC.on||$imports.PHONE.on||$imports.LESSON.on||$imports.UI.chooseOpen||$imports.S.intro>0||$imports.Elevator.inRide()||$imports.CarChase.active()){
      Dev.report('请先退出当前互动或移动流程。');return false;
    }
    if($imports.AN.active||$imports.Inspection.pending()||$imports.PatrolWorld.localChase()){
      Dev.report('请先结束当前异象、巡察或检查。');return false;
    }
    return true;
  },
  startPatrol:function(){
    if(!Dev.canStageEvent())return;
    (0,$imports.patStart)();Dev.report('唯一巡察者已重置到行政楼一楼楼梯口，沿常驻路线出发。');Dev.refresh();
  },
  stopPatrol:function(){
    if(!Dev.canUse())return;
    if($imports.PAT.state==='idle'){Dev.report('当前没有巡察。');return;}
    (0,$imports.patEnd)();Dev.report($imports.PAT.permanent?'永久追踪仍生效；此按钮只解除普通追逐。':'普通追逐已解除，常驻实体继续沿路线移动。');Dev.refresh();
  },
  startInspection:function(){
    if(!Dev.canStageEvent())return;
    $imports.Inspection.start({day:$imports.S.day,slot:$imports.S.tsec<920?0:1});
    Dev.report('手动检查已开始，会按站位、移动和注视行为结算。');Dev.refresh();
  },
  cancelInspection:function(){
    if(!Dev.canUse())return;$imports.Inspection.cancel();if($imports.RT.inspection)$imports.RT.inspection.queue=[];
    Dev.report('当前及排队检查已取消，不结算本次奖惩；已扣数值保留。');Dev.refresh();
  },
  stopPreview:function(){
    if(!Dev.canUse())return;Dev.clearPreview();Dev.clearAnimation();Dev.report('调试预览已停止。');
  },
  refreshDiagnostics:function(){
    var renderer=$imports.GLR.renderer,info=renderer&&renderer.info;
    var metrics=$imports.Engine.metrics(),device=$imports.Engine.status();
    document.getElementById('devrender').textContent=metrics?device.backend+' · 几何体 '+metrics.geometries+' · 纹理 '+metrics.textures+' · 着色程序 '+metrics.programs:'渲染器未就绪';
    document.getElementById('devinput').textContent=($imports.INPUT.mode==='touch'?'触屏':'鼠标')+' · '+((0,$imports.pointerIsLocked)()?'鼠标已捕获':'鼠标未捕获')+' · '+((0,$imports.playerInputAllowed)()?'允许游戏输入':'游戏输入暂停');
    document.getElementById('devquality').textContent=$imports.Quality.get().label+' · '+innerWidth+' × '+innerHeight;
    document.getElementById('devhistory').textContent=DEV.history.slice(-5).map(function(entry){return entry.message;}).join('\n')||'尚无调试操作';
  },
  diagnosticSnapshot:function(){
    var info=$imports.GLR.renderer&&$imports.GLR.renderer.info,inspection=$imports.RT.inspection,ride=$imports.RT.elevatorRide;
    return {version:1,capturedAt:new Date().toISOString(),
      flow:$imports.GamePolicy.describe((0,$imports.gameInputContext)()),lifecycle:$imports.Lifecycle.snapshot(),storage:$imports.SAVE_DIAGNOSTIC,
      game:{screen:$imports.S.screen,dead:$imports.S.dead,day:$imports.S.day,time:(0,$imports.fmtClock)($imports.S.tsec),minutes:$imports.S.tsec,mode:$imports.S.mode,room:$imports.S.room,
        position:{x:$imports.S.x,y:$imports.S.y,angle:$imports.S.ang,pitch:$imports.S.pitch},san:$imports.S.san,stamina:$imports.S.stam,violation:$imports.S.viol,assimilation:$imports.S.tt,
        bag:$imports.S.bag.slice(),hotbar:$imports.S.hot.slice()},
      events:{anomaly:$imports.AN.active?{id:$imports.AN.id,elapsed:$imports.AN.t}:null,forecast:$imports.AN.pre||null,
        patrol:{state:$imports.PAT.state,locked:$imports.PAT.locked,permanent:$imports.PAT.permanent,scene:$imports.PAT.room,routeIndex:$imports.PAT.routeIndex,transition:$imports.PAT.transition,respawn:$imports.PAT.respawn,diagnostic:$imports.PAT.diagnostic},
        inspection:inspection?{active:!!inspection.current,queued:inspection.queue.length}:null,
        elevator:ride?{host:ride.host,phase:ride.phase,target:ride.target}:null,
        driving:$imports.CarChase.active(),hiding:$imports.HIDE.on},
      debug:{freeze:DEV.freeze,god:DEV.god,fast:DEV.fast,search:$imports.SEARCH.on},
      input:{mode:$imports.INPUT.mode,pointerLocked:(0,$imports.pointerIsLocked)(),allowed:(0,$imports.playerInputAllowed)(),panel:$imports.UI.openPanel||null,choice:$imports.UI.chooseOpen},
      rendering:{device:$imports.Engine.status(),quality:$imports.Quality.get().label,viewport:{width:innerWidth,height:innerHeight,pixelRatio:devicePixelRatio},
        memory:$imports.Engine.metrics()},
      recentActions:DEV.history.slice()};
  },
  makeReport:function(){
    var field=document.getElementById('devreport');field.hidden=false;
    field.value=JSON.stringify(Dev.diagnosticSnapshot(),null,2);Dev.fitPanel();
    field.focus({preventScroll:true});field.select();field.scrollIntoView({block:'nearest'});
    Dev.report('诊断已生成，可复制文本或下载；不写入游戏存档。');
    return field.value;
  },
  downloadReport:function(){
    var data=Dev.makeReport(),url=URL.createObjectURL(new Blob([data],{type:'application/json'})),link=document.createElement('a');
    link.href=url;link.download='wdfz-debug-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';
    document.body.appendChild(link);link.click();link.remove();setTimeout(function(){URL.revokeObjectURL(url);},1000);
  },
  pos:function(){
    var el=document.getElementById('devpos'); if(!el) return;
    var s='地图 ('+Math.round($imports.S.x/$imports.SC)+','+Math.round($imports.S.y/$imports.SC)+')  ';
    var best=null,bd=1e9,i,o;
    for(i=0;i<$imports.OBJ.length;i++){
      o=$imports.OBJ[i];
      var cx=(o.x+o.w/2)*$imports.SC, cy=(o.y+o.h/2)*$imports.SC;
      var d=Math.sqrt((cx-$imports.S.x)*(cx-$imports.S.x)+(cy-$imports.S.y)*(cy-$imports.S.y));
      if(d<bd){ bd=d; best=o; }
    }
    if(best) s+= best.id+' ('+best.k+') '+Math.round(bd/9)+'m';
    s+='  '+($imports.S.mode==='in'?($imports.S.room||''):'室外');
    el.textContent=s;
  },
  fakeNormal:function(){
    if(!Dev.canUse())return;
    var f=$imports.S.fn||($imports.S.fn={v:0,on:false,note:true,n:0,next:0,used:{},shown:false});
    if(f.on){ f.on=false; f.v=0; try{ (0,$imports.fnPeopleClear)(); }catch(e){} Dev.paint();Dev.report('假正常：关'); return; }
    f.on=true; f.v=0; f.n=0; f.next=3; f.used={}; f.shown=false; f.left=(f.left||4);
    try{ (0,$imports.fnPeopleBuild)(); }catch(e){}
    Dev.paint();Dev.report('假正常：开（事件 4 次内结束）');
  },
  prologue:function(){
    if(!window.confirm('重看前情提要会开始新游戏，并可能覆盖当前自动存档。继续吗？'))return;
    try{ localStorage.removeItem('wdfz_pro'); }catch(e){}
    Dev.close(false);
    try{ $imports.Game.start($imports.S.diff||'easy'); }catch(e){}
  },
  lamps:function(){
    if(!Dev.canUse())return;Dev.triggerAnomaly('lamps');
  },
  status:function(){
    try{
      (0,$imports.toast)('SAN '+Math.round($imports.S.san)+' · 违规 '+Math.round($imports.S.viol)+' · 假正常 v='+($imports.S.fn?Math.round($imports.S.fn.v):0)+
            ' · 第'+$imports.S.day+'天 '+(0,$imports.fmtClock)($imports.S.tsec));
    }catch(e){}
  },
  hide:function(k){
    if(!Dev.canUse()||!Object.prototype.hasOwnProperty.call($imports.DEV_HIDE,k))return;
    $imports.DEV_HIDE[k]=$imports.DEV_HIDE[k]?0:1;
    try{ if($imports.S.mode==='out'){ (0,$imports.clearWorldMesh)(); (0,$imports.sceneCacheClear)(); (0,$imports.enterWorldOut)(); } }catch(e){}   /* 缓存里那份是旧的：清掉重建 */
    Dev.paint();Dev.report(k+' '+($imports.DEV_HIDE[k]?'隐藏':'显示'));
  },
  look:function(){
    var el=document.getElementById('devlook'); if(!el) return;
    try{
      if(!$imports.GLR.outMesh||!$imports.THREE.Raycaster){ el.textContent='—'; return; }
      var rc=new $imports.THREE.Raycaster();
      var dir=new $imports.THREE.Vector3(0,0,-1).applyQuaternion($imports.GLR.cam.quaternion);
      rc.set($imports.GLR.cam.position, dir);
      var hits=rc.intersectObject($imports.GLR.outMesh, true);
      if(!hits||!hits.length){ el.textContent='（没打到东西）'; return; }
      var h=hits[0], geo=h.object.geometry, col=geo.attributes.color;
      var hex='??', i0=0;
      if(col){
        i0=geo.index?geo.index.getX(h.faceIndex*3):h.faceIndex*3;
        var r=Math.round(col.getX(i0)*255), g=Math.round(col.getY(i0)*255), b=Math.round(col.getZ(i0)*255);
        hex=(0x1000000+(r<<16)+(g<<8)+b).toString(16).slice(1);
      }
      var mx=Math.round(h.point.x/($imports.SC*$imports.U2M)), mz=Math.round(h.point.z/($imports.SC*$imports.U2M));
      el.textContent='#'+hex+'  ('+mx+','+mz+')  '+Math.round(h.distance)+'m  高'+h.point.y.toFixed(1);
    }catch(e){ el.textContent='探测失败: '+e.message; }
  },
  close:function(resume){
    if(!DEV.on)return;
    Dev.endPanelDrag();
    DEV.on=false;document.body.classList.remove('dev-open');var el=document.getElementById('dev');if(el)el.style.display='none';
    (0,$imports.resetInputState)();(0,$imports.updateTouchUI)();
    if(resume!==false){
      var focus=DEV.returnFocus;
      if(focus&&focus.isConnected&&focus.getClientRects().length&&typeof focus.focus==='function')focus.focus({preventScroll:true});
      else if((0,$imports.playerInputAllowed)())document.getElementById('cv').focus({preventScroll:true});
      (0,$imports.resumeMouseLook)();
    }
    DEV.returnFocus=null;
  },
  toggle:function(){ if(DEV.on) Dev.close(); else if(DevLock.on) DevLock.cancel(); else Dev.open(); },
  paint:function(){
    var states={devfast:DEV.fast,devgod:DEV.god,devsearch:$imports.SEARCH.on,devfake:!!($imports.S.fn&&$imports.S.fn.on)};
    ['canopy','sign','link','fence'].forEach(function(k){states['devhide-'+k]=!!$imports.DEV_HIDE[k];});
    Object.keys(states).forEach(function(id){var el=document.getElementById(id);if(el){el.classList.toggle('on',!!states[id]);el.setAttribute('aria-pressed',String(!!states[id]));}});
  },
  fast:function(){ DEV.fast=!DEV.fast; Dev.paint(); Dev.report(DEV.fast?'快跑：开':'快跑：关'); },
  search:function(){ $imports.SEARCH.on=!$imports.SEARCH.on; (0,$imports.clearSearch)(); Dev.paint(); Dev.report($imports.SEARCH.on?'翻找读条：开':'翻找读条：关（立刻翻完）'); },
  god:function(){ DEV.god=!DEV.god; Dev.paint(); Dev.report(DEV.god?'无敌：开':'无敌：关'); },
  /* 这三个开关关掉面板、开新局都不复位（方便测试）。速通不能带着它们记成绩：开速通时清掉，结算时再查一次 */
  modifiersActive:function(){ return !!(DEV.fast||DEV.god||(typeof $imports.SEARCH!=='undefined'&&!$imports.SEARCH.on)); },
  clearModifiers:function(){
    if(!Dev.modifiersActive()) return false;
    DEV.fast=false; DEV.god=false; $imports.SEARCH.on=true; (0,$imports.clearSearch)();
    Dev.paint(); Dev.report('速通：已关掉调试开关（快跑、无敌恢复为关，翻找读条恢复为开）');
    return true;
  },
  san:function(){ if(!Dev.canUse())return;$imports.PlayerStats.setSan(100,'debug');$imports.PlayerStats.setStamina(100,'debug');$imports.S.tired=false; Dev.report('SAN / 体力已恢复');Dev.refresh(); },
  time:function(min){
    if(!Number.isFinite(min)||!Dev.canChangeTime())return;
    /* 调试暂停时 tick 不运行；过期检查要及时丢弃，回拨也不能让它们重新变为有效。 */
    function prune(){if($imports.RT.inspection)$imports.RT.inspection.queue=$imports.RT.inspection.queue.filter(function(item){return !$imports.Inspection.stale(item);});}
    prune();if(min>=0)(0,$imports.advanceGameTime)(min);else (0,$imports.rewindGameTime)(-min);prune();
    (0,$imports.patEndIfInvalid)();Dev.report('时间已调整至第 '+$imports.S.day+' 天 '+(0,$imports.fmtClock)($imports.S.tsec));Dev.refresh();
  },
  endActiveAnomaly:function(){
    if($imports.AN.active){if($imports.UI.chooseOpen)$imports.UI.closeChoice();(0,$imports.anEnd)();}
    /* 拍肩异象结束后笑脸仍可能停留数秒，切场景或替换时一并移除。 */
    (0,$imports.smileClear)();
  },
  prepareTeleport:function(){
    if(typeof $imports.Inspection!=='undefined')$imports.Inspection.cancel();
    if(typeof $imports.Elevator!=='undefined')$imports.Elevator.cancel();
    if(typeof $imports.CarChase!=='undefined'&&$imports.CarChase.active())$imports.CarChase.cancel();
    Dev.clearPreview();if($imports.UI.chooseOpen)$imports.UI.closeChoice();Dev.endActiveAnomaly();
    (0,$imports.clearSearch)();if($imports.HIDE.on)(0,$imports.hideOut)();(0,$imports.patRemoveFig)();(0,$imports.spiralReset)();(0,$imports.resetInputState)();
  },
  tp:function(){
    if(!Dev.canUse())return;
    var v=document.getElementById('devroom').value; if(!v||!$imports.INTERIORS[v]) return;
    try{ Dev.prepareTeleport();(0,$imports.enterRoom)(v,null,function(){(0,$imports.syncCamera)(0);Dev.refresh();});Dev.report('传送 → '+$imports.INTERIORS[v].name); }catch(e){ Dev.report('传送失败'); }
  },
  tpo:function(){
    if(!Dev.canUse())return;
    var value=document.getElementById('devout').value;if(value==='')return;
    var i=+value, p=DEV_POI[i]; if(!p) return;
    try{
      Dev.prepareTeleport();
      $imports.S.mode='out'; $imports.S.room=null;
      $imports.S.x=p[1]*$imports.SC; $imports.S.y=p[2]*$imports.SC; $imports.S.ang=Math.PI/2; $imports.S.pitch=0; $imports.S.seated=false;
      (0,$imports.enterWorldOut)();(0,$imports.syncCamera)(0);
    }catch(e){ Dev.report('传送失败');return; }
    Dev.report('传送 → '+p[0]);Dev.refresh();
  },
  anom:function(){
    if(!Dev.canUse())return;
    var id=document.getElementById('devanom').value; if(!id) return;Dev.triggerAnomaly(id);
  },
  triggerAnomaly:function(id){
    try{
      Dev.clearPreview();
      Dev.endActiveAnomaly();
      $imports.AN.id=id; $imports.AN.t=0; $imports.AN.acc=0; $imports.AN.active=true; $imports.AN.data={}; $imports.AN.sub=0;
      $imports.AN.lastBig=!$imports.AN_SMALL[id];
      (0,$imports.os)('【Dev】'+(($imports.AN_NAME&&$imports.AN_NAME[id])||id),2.6);
      (0,$imports.anOn)(id);
      Dev.report('异象：'+($imports.AN_NAME[id]||id));Dev.refresh();
    }catch(e){ Dev.report('触发失败：'+e.message); }
  },
  anomEnd:function(){
    if(!Dev.canUse())return;
    try{ Dev.endActiveAnomaly(); Dev.report('异象已结束');Dev.refresh(); }catch(e){ $imports.AN.active=false; $imports.AN.id=null;Dev.report('异象结束失败'); }
  },
  anim:function(mode){
    if(!Dev.canUse()||[1,2,3].indexOf(mode)<0)return;
    $imports.SFX.anim(mode);Dev.report('画面演出已开始');
  },
  clearPreview:function(){
    $imports.Lifecycle.scope('preview').cancel();
    if(DEV.previewTimer)clearTimeout(DEV.previewTimer);DEV.previewTimer=0;
    var fx=DEV.previewFx;DEV.previewFx=null;
    if(fx){
      if($imports.ANFX.grp===fx){(0,$imports.anfxClear)();if($imports.S.screen==='play'&&!$imports.S.dead)(0,$imports.syncCamera)(0);}
    }
  },
  clearAnimation:function(){
    $imports.VisualState.deathAnim=null;
    if($imports.GLR.postMat){$imports.GLR.postMat.uniforms.uDm.value=0;$imports.GLR.postMat.uniforms.uDt.value=0;}
  },
  previewDeath:function(){
    if(!Dev.canUse())return;
    if($imports.AN.active){Dev.report('请先结束当前异象，再预览死亡效果。');return;}
    var t=document.getElementById('devdeath').value;if(!t)return;
    Dev.clearPreview();(0,$imports.deathFX)(t,{preview:true});
    if($imports.ANFX.kind!=='death'||!$imports.ANFX.grp){Dev.report('死亡效果预览失败');return;}
    DEV.previewFx=$imports.ANFX.grp;
    try{$imports.SFX.deathFx(t);}catch(e){}
    var previewSeconds=Math.max(3.5,$imports.DeathTimeline.duration(t)+0.2);
    DEV.previewTimer=$imports.Lifecycle.renew('preview').timeout(function(){Dev.clearPreview();},previewSeconds*1000);
    Dev.report('正在预览死亡效果，'+previewSeconds.toFixed(1)+' 秒后自动清理');
  },
  death:function(){
    if(!Dev.canUse())return;
    var t=document.getElementById('devdeath').value||'vignette';
    if(!window.confirm('实际死亡会触发救命道具，且可能删除当前存档。继续吗？'))return;
    Dev.clearPreview();
    var wasGod=DEV.god;
    DEV.god=false;
    $imports.KILL_CTX='debug';
    try{ (0,$imports.kill)('【Dev】测试死亡演出：'+t,t); }finally{ DEV.god=wasGod; $imports.KILL_CTX=null; }
    Dev.refresh();
  },
  revive:function(){
    if($imports.S.screen!=='play'){Dev.report('请先开始游戏。');return;}
    if(!$imports.S.dead&&!$imports.S.death){Dev.report('角色尚未死亡。');return;}
    $imports.S.deadId=($imports.S.deadId||0)+1;
    var view=$imports.S.deathView;$imports.S.deathView=null;
    $imports.S.dead=false; $imports.S.death=null; $imports.S.deadT=0;
    if(view){$imports.S.ang=view.ang;$imports.S.pitch=view.pitch;$imports.S.eyeLift=view.eyeLift;}else $imports.S.eyeLift=0;
    if($imports.S.san<=0)$imports.PlayerStats.setSan(45,'debug-revive');
    if($imports.S.tt>=100){$imports.PlayerStats.setAssimilation(86,'debug-revive');$imports.S.ttTier=4;}
    (0,$imports.capStamina)();
    var dEl=document.getElementById('die'); if(dEl) dEl.style.display='none';
    var fEl=document.getElementById('flash'); if(fEl) fEl.style.opacity='0';
    Dev.clearPreview();try{ if($imports.ANFX.kind==='death')(0,$imports.anfxClear)(); }catch(e){}
    Dev.clearAnimation();$imports.VisualState.hurt=0;$imports.VisualState.flash=0;(0,$imports.syncCamera)(0);
    Dev.report('已复活');Dev.refresh();(0,$imports.updateTouchUI)();
  }
};

/* @module-exports */
GameModules.publish("game3d/js/dev.js",{
"DEV":{get:function(){return DEV;},set:function($value){DEV=$value;}},
"DEV_POI":{get:function(){return DEV_POI;},set:function($value){DEV_POI=$value;}},
"DEV_DEATH":{get:function(){return DEV_DEATH;},set:function($value){DEV_DEATH=$value;}},
"DEV_TABS":{get:function(){return DEV_TABS;},set:function($value){DEV_TABS=$value;}},
"DEV_CODE":{get:function(){return DEV_CODE;},set:function($value){DEV_CODE=$value;}},
"DevLock":{get:function(){return DevLock;},set:function($value){DevLock=$value;}},
"Dev":{get:function(){return Dev;},set:function($value){Dev=$value;}}
});
})(GameModules.imports("game3d/js/dev.js"));
