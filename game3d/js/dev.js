/* 里世界 3D · 调试面板 */
'use strict';

var DEV={on:false,fast:false,god:false,freeze:false,tab:'status',refreshT:0,lists:null,returnFocus:null,previewFx:null,previewTimer:0,panelPos:null,drag:null,dragReady:false,
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
  ['对视','face'],['墙','wall'],['笑','laugh'],['镜子','mirror'],['隔间伸手','hand'],['垃圾桶','trash']];
var Dev={
  open:function(){
    if(DEV.on)return;
    DEV.returnFocus=document.activeElement;
    resetInputState();releaseMouseLook();
    var password=window.prompt('请输入调试密码');
    if(password!=='114514'){
      if(password!==null) toast('密码错误');
      resumeMouseLook();
      return;
    }
    if(typeof LESSON!=='undefined'&&LESSON.on)LESSON.close(false);
    DEV.on=true;DEV.freeze=false;DEV.minimized=false;DEV.refreshT=0;document.body.classList.add('dev-open');
    var el=document.getElementById('dev'); if(el) el.style.display='flex';
    el.classList.remove('dev-minimized');el.setAttribute('role','dialog');document.getElementById('devball').hidden=true;
    DEV.lists={
      room:Object.keys(INTERIORS).map(function(k){return [k,(INTERIORS[k].name||k)+' ('+k+')'];}),
      out:DEV_POI.map(function(p,i){return [String(i),p[0]];}),
      anom:AN_ID.map(function(id){return [id,(AN_NAME[id]||id)+' ('+id+')'];}),
      death:DEV_DEATH.map(function(d){return [d[1],d[0]+' ('+d[1]+')'];}),
      item:Object.keys(ITEMS).map(function(id){return [id,ITEMS[id].n+' ('+id+')'];})
    };
    ['room','out','anom','death','item'].forEach(Dev.filter);
    Dev.initPanelDrag();Dev.tab(DEV.tab);Dev.refresh();Dev.fitPanel();updateTouchUI();
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
  fitPanel:function(){
    var el=document.getElementById('dev');if(!DEV.on||!el)return;
    var b=Dev.panelBounds(),width=b.right-b.left,height=b.bottom-b.top;
    var compact=IS_TOUCH||window.innerWidth<=600||window.matchMedia('(pointer: coarse)').matches;
    el.classList.toggle('dev-compact',compact);
    el.classList.toggle('dev-short',height<300);
    el.style.maxWidth=width+'px';
    el.style.maxHeight=Math.min(height,window.innerHeight*(compact?(width>height?.74:.62):.82))+'px';
    /* 触屏横屏时默认放在中间，留出两侧的摇杆和交互键。用户拖动过的位置仍保留。 */
    var defaultX=IS_TOUCH&&width>height?b.left+(width-el.getBoundingClientRect().width)/2:b.left+4;
    var pos=DEV.minimized?(DEV.ballPos||{x:b.right-44,y:b.top+(height-44)/2}):(DEV.panelPos||{x:defaultX,y:b.top+4});
    Dev.placePanel(pos.x,pos.y,false);Dev.scrollHint();
  },
  setMinimized:function(value){
    if(!DEV.on||DEV.minimized===value)return;
    Dev.endPanelDrag();resetInputState();releaseMouseLook();
    var el=document.getElementById('dev'),body=document.getElementById('devbody'),ball=document.getElementById('devball');
    if(value)DEV.scrollTop=body.scrollTop;
    DEV.minimized=value;el.classList.toggle('dev-minimized',value);ball.hidden=!value;
    el.setAttribute('role',value?'group':'dialog');
    Dev.refresh();Dev.fitPanel();
    if(value)document.getElementById('cv').focus({preventScroll:true});
    else{body.scrollTop=DEV.scrollTop;document.getElementById('devcollapse').focus({preventScroll:true});}
    updateTouchUI();
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
    if(['status','scene','items','events','tools'].indexOf(id)<0)return;
    DEV.tab=id;
    ['status','scene','items','events','tools'].forEach(function(name){
      var page=document.getElementById('dev-page-'+name),button=document.querySelector('[data-dev-tab="'+name+'"]');
      if(page)page.hidden=name!==id;if(button)button.setAttribute('aria-pressed',String(name===id));
    });
    var body=document.getElementById('devbody');if(body)body.scrollTop=0;
    Dev.refresh();Dev.fitPanel();
  },
  report:function(msg){
    var el=document.getElementById('devmessage');if(el)el.textContent=msg;
    DEV.history.push({time:new Date().toISOString(),message:msg});if(DEV.history.length>20)DEV.history.shift();
    toast(msg);
  },
  canUse:function(){
    if(S.screen==='play'&&!S.dead)return true;
    Dev.report(S.dead?'角色已死亡，请先复活。':'请先开始游戏。');return false;
  },
  refresh:function(){
    if(!DEV.on)return;
    function put(id,text){var el=document.getElementById(id);if(el&&el.textContent!==text)el.textContent=text;}
    var otherPause=PAUSE.on||UI.anyOpen()||PC.on||PRO.on;
    var state=S.screen!=='play'?'未进入游戏':S.dead?'角色已死亡':otherPause?'游戏菜单已暂停':DEV.freeze?'调试暂停中':'游戏运行中';
    var ball=document.getElementById('devball');
    ball.classList.toggle('is-paused',S.screen!=='play'||S.dead||otherPause||DEV.freeze);
    ball.setAttribute('aria-label','展开调试面板 · '+state);ball.title='点击展开 · 按住拖动 · '+state;
    if(DEV.minimized)return;
    put('devrun',state);put('devclock','第 '+S.day+' 天 · '+fmtClock(S.tsec));
    put('devsanValue',String(Math.round(S.san)));put('devstamValue',Math.round(S.stam)+'/'+Math.round(staminaMax()));
    put('devviolValue',String(Math.round(S.viol)));put('devttValue',String(Math.round(S.tt)));
    put('devactive',AN.active?(AN_NAME[AN.id]||AN.id||'未知'):'无');
    var freeze=document.getElementById('devfreeze');
    if(freeze){
      freeze.textContent=DEV.freeze||PAUSE.on||UI.openPanel==='pause'?'继续游戏':'暂停游戏';
      freeze.disabled=S.screen!=='play'||S.dead||PC.on||PRO.on||UI.chooseOpen||!!(UI.openPanel&&UI.openPanel!=='pause');
    }
    Dev.pos();if(DEV.tab==='status')Dev.look();
    if(DEV.tab==='items')Dev.refreshInventory();
    if(DEV.tab==='tools')Dev.refreshDiagnostics();
    var inspection=RT.inspection,ride=RT.elevatorRide;
    put('devpatrol',PAT.locked?'追逐中':PAT.state==='idle'?'等待 · '+Math.ceil(PAT.next)+' 秒':PAT.state==='warn'?'预警中':'巡逻中');
    put('devinspection',inspection&&inspection.current?'检查中 · '+Math.max(0,INSPECT_CONFIG.duration-inspection.current.t).toFixed(1)+' 秒':inspection&&inspection.queue.length?'排队 '+inspection.queue.length+' 次':'无');
    put('devtravel',CarChase.active()?'驾驶 · '+Math.round(RT.carChase.distance)+' 米':ride?'电梯 · '+ride.phase:'步行');
    Dev.paint();Dev.scrollHint();
  },
  scrollHint:function(){
    var body=document.getElementById('devbody'),hint=document.getElementById('devscroll');if(!body||!hint)return;
    hint.hidden=body.scrollHeight<=body.clientHeight+1;
    hint.textContent=body.scrollTop+body.clientHeight>=body.scrollHeight-1?'↑ 可滚动':'↓ 可滚动';
  },
  toggleFreeze:function(){
    if(!DEV.on||S.screen!=='play'||S.dead||PC.on||PRO.on||UI.chooseOpen||(UI.openPanel&&UI.openPanel!=='pause'))return;
    var resume=DEV.freeze||PAUSE.on||UI.openPanel==='pause';
    resetInputState();DEV.freeze=!resume;
    if(resume){
      if(PAUSE.on||UI.openPanel==='pause')Game.resume();
      document.getElementById('cv').focus({preventScroll:true});
    }else releaseMouseLook();
    Dev.refresh();updateTouchUI();
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
    S[key]=value;capStamina();
    Dev.report(key.toUpperCase()+' 已设为 '+Math.round(S[key]*10)/10);Dev.refresh();
  },
  refreshInventory:function(){
    var select=document.getElementById('devitem');if(!select)return;
    var id=select.value,item=ITEMS[id],owned=!!item&&hasItem(id),alive=S.screen==='play'&&!S.dead;
    document.getElementById('devbag').textContent=S.bag.length+' / 8 格 · '+(S.bag.map(function(k){return ITEMS[k]?ITEMS[k].n:k;}).join('、')||'空背包');
    document.getElementById('devitemInfo').textContent=item?(owned?'已持有 · ':'未持有 · ')+item.d:'没有匹配的物品';
    document.getElementById('devitemGo').disabled=!alive||!item||owned||S.bag.length>=8;
    ['devitemRemove','devitemHot1','devitemHot2'].forEach(function(key){document.getElementById(key).disabled=!alive||!owned;});
    document.getElementById('devhotbar').textContent=S.hot.map(function(k,i){return (i+1)+'：'+(ITEMS[k]?ITEMS[k].n:'空');}).join(' · ');
  },
  editItem:function(action,slot){
    if(!Dev.canUse())return;
    var id=document.getElementById('devitem').value,item=ITEMS[id];if(!item)return;
    if(action==='add'){
      if(hasItem(id)){Dev.report('背包里已有此物品。');return;}
      if(S.bag.length>=8){Dev.report('背包已满，请先移除一件物品。');return;}
      addItem(id);Dev.report('已添加：'+item.n);
    }else if(action==='remove'){
      if(!removeItem(id)){Dev.report('背包里没有此物品。');return;}
      Dev.report('已移除：'+item.n);
    }else if(action==='hot'&&(slot===0||slot===1)){
      if(!hasItem(id)){Dev.report('请先将物品加入背包。');return;}
      S.hot[slot]=id;bagChanged();Dev.report(item.n+' → 快捷栏 '+(slot+1));
    }else return;
    Dev.refreshInventory();
  },
  canChangeTime:function(){
    if(!Dev.canUse())return false;
    var queued=RT.inspection&&RT.inspection.queue.some(function(item){return !Inspection.stale(item);});
    if(Elevator.inRide()||CarChase.active()||Inspection.active()||INSPECT_FX.scatter||queued){
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
    Dev.time(target-S.tsec);document.getElementById('devtime').value=raw;
  },
  canStageEvent:function(){
    if(!Dev.canUse())return false;
    if(PRO.on||PC.on||PHONE.on||LESSON.on||UI.chooseOpen||S.intro>0||Elevator.inRide()||CarChase.active()){
      Dev.report('请先退出当前互动或移动流程。');return false;
    }
    if(AN.active||Inspection.pending()||PAT.state!=='idle'){
      Dev.report('请先结束当前异象、巡察或检查。');return false;
    }
    return true;
  },
  startPatrol:function(){
    if(!Dev.canStageEvent())return;
    if(!patEligible()){Dev.report('此地点或时段不允许巡察；白天可在上课时到教学楼，夜间到室外。');return;}
    patStart();Dev.report('巡察预警已开始；躲藏和请假规则照常生效。');Dev.refresh();
  },
  stopPatrol:function(){
    if(!Dev.canUse())return;
    if(PAT.state==='idle'){Dev.report('当前没有巡察。');return;}
    patEnd();Dev.report('当前巡察已结束，后续仍按正常间隔出现。');Dev.refresh();
  },
  startInspection:function(){
    if(!Dev.canStageEvent())return;
    Inspection.start({day:S.day,slot:S.tsec<920?0:1});
    Dev.report('手动检查已开始，会按站位、移动和注视行为结算。');Dev.refresh();
  },
  cancelInspection:function(){
    if(!Dev.canUse())return;Inspection.cancel();if(RT.inspection)RT.inspection.queue=[];
    Dev.report('当前及排队检查已取消，不结算本次奖惩；已扣数值保留。');Dev.refresh();
  },
  stopPreview:function(){
    if(!Dev.canUse())return;Dev.clearPreview();Dev.clearAnimation();Dev.report('调试预览已停止。');
  },
  refreshDiagnostics:function(){
    var renderer=GLR.renderer,info=renderer&&renderer.info;
    document.getElementById('devrender').textContent=info?'几何体 '+info.memory.geometries+' · 纹理 '+info.memory.textures+' · 着色程序 '+(info.programs?info.programs.length:0):'渲染器未就绪';
    document.getElementById('devinput').textContent=(INPUT.mode==='touch'?'触屏':'鼠标')+' · '+(pointerIsLocked()?'鼠标已捕获':'鼠标未捕获')+' · '+(playerInputAllowed()?'允许游戏输入':'游戏输入暂停');
    document.getElementById('devquality').textContent=Quality.get().label+' · '+innerWidth+' × '+innerHeight;
    document.getElementById('devhistory').textContent=DEV.history.slice(-5).map(function(entry){return entry.message;}).join('\n')||'尚无调试操作';
  },
  diagnosticSnapshot:function(){
    var info=GLR.renderer&&GLR.renderer.info,inspection=RT.inspection,ride=RT.elevatorRide;
    return {version:1,capturedAt:new Date().toISOString(),
      game:{screen:S.screen,dead:S.dead,day:S.day,time:fmtClock(S.tsec),minutes:S.tsec,mode:S.mode,room:S.room,
        position:{x:S.x,y:S.y,angle:S.ang,pitch:S.pitch},san:S.san,stamina:S.stam,violation:S.viol,assimilation:S.tt,
        bag:S.bag.slice(),hotbar:S.hot.slice()},
      events:{anomaly:AN.active?{id:AN.id,elapsed:AN.t}:null,forecast:AN.pre||null,
        patrol:{state:PAT.state,locked:PAT.locked,next:PAT.next},
        inspection:inspection?{active:!!inspection.current,queued:inspection.queue.length}:null,
        elevator:ride?{host:ride.host,phase:ride.phase,target:ride.target}:null,
        driving:CarChase.active(),hiding:HIDE.on},
      debug:{freeze:DEV.freeze,god:DEV.god,fast:DEV.fast,search:SEARCH.on},
      input:{mode:INPUT.mode,pointerLocked:pointerIsLocked(),allowed:playerInputAllowed(),panel:UI.openPanel||null,choice:UI.chooseOpen},
      rendering:{quality:Quality.get().label,viewport:{width:innerWidth,height:innerHeight,pixelRatio:devicePixelRatio},
        memory:info?{geometries:info.memory.geometries,textures:info.memory.textures,programs:info.programs?info.programs.length:0}:null},
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
    var s='地图 ('+Math.round(S.x/SC)+','+Math.round(S.y/SC)+')  ';
    var best=null,bd=1e9,i,o;
    for(i=0;i<OBJ.length;i++){
      o=OBJ[i];
      var cx=(o.x+o.w/2)*SC, cy=(o.y+o.h/2)*SC;
      var d=Math.sqrt((cx-S.x)*(cx-S.x)+(cy-S.y)*(cy-S.y));
      if(d<bd){ bd=d; best=o; }
    }
    if(best) s+= best.id+' ('+best.k+') '+Math.round(bd/9)+'m';
    s+='  '+(S.mode==='in'?(S.room||''):'室外');
    el.textContent=s;
  },
  fakeNormal:function(){
    if(!Dev.canUse())return;
    var f=S.fn||(S.fn={v:0,on:false,note:true,n:0,next:0,used:{},shown:false});
    if(f.on){ f.on=false; f.v=0; try{ fnPeopleClear(); }catch(e){} Dev.paint();Dev.report('假正常：关'); return; }
    f.on=true; f.v=0; f.n=0; f.next=3; f.used={}; f.shown=false; f.left=(f.left||4);
    try{ fnPeopleBuild(); }catch(e){}
    Dev.paint();Dev.report('假正常：开（事件 4 次内结束）');
  },
  prologue:function(){
    if(!window.confirm('重看前情提要会开始新游戏，并可能覆盖当前自动存档。继续吗？'))return;
    try{ localStorage.removeItem('wdfz_pro'); }catch(e){}
    Dev.close(false);
    try{ Game.start(S.diff||'easy'); }catch(e){}
  },
  lamps:function(){
    if(!Dev.canUse())return;Dev.triggerAnomaly('lamps');
  },
  status:function(){
    try{
      toast('SAN '+Math.round(S.san)+' · 违规 '+Math.round(S.viol)+' · 假正常 v='+(S.fn?Math.round(S.fn.v):0)+
            ' · 第'+S.day+'天 '+fmtClock(S.tsec));
    }catch(e){}
  },
  hide:function(k){
    if(!Dev.canUse()||!Object.prototype.hasOwnProperty.call(DEV_HIDE,k))return;
    DEV_HIDE[k]=DEV_HIDE[k]?0:1;
    try{ if(S.mode==='out'){ clearWorldMesh(); sceneCacheClear(); enterWorldOut(); } }catch(e){}   /* 缓存里那份是旧的：清掉重建 */
    Dev.paint();Dev.report(k+' '+(DEV_HIDE[k]?'隐藏':'显示'));
  },
  look:function(){
    var el=document.getElementById('devlook'); if(!el) return;
    try{
      if(!GLR.outMesh||!THREE.Raycaster){ el.textContent='—'; return; }
      var rc=new THREE.Raycaster();
      var dir=new THREE.Vector3(0,0,-1).applyQuaternion(GLR.cam.quaternion);
      rc.set(GLR.cam.position, dir);
      var hits=rc.intersectObject(GLR.outMesh, true);
      if(!hits||!hits.length){ el.textContent='（没打到东西）'; return; }
      var h=hits[0], geo=h.object.geometry, col=geo.attributes.color;
      var hex='??', i0=0;
      if(col){
        i0=geo.index?geo.index.getX(h.faceIndex*3):h.faceIndex*3;
        var r=Math.round(col.getX(i0)*255), g=Math.round(col.getY(i0)*255), b=Math.round(col.getZ(i0)*255);
        hex=(0x1000000+(r<<16)+(g<<8)+b).toString(16).slice(1);
      }
      var mx=Math.round(h.point.x/(SC*U2M)), mz=Math.round(h.point.z/(SC*U2M));
      el.textContent='#'+hex+'  ('+mx+','+mz+')  '+Math.round(h.distance)+'m  高'+h.point.y.toFixed(1);
    }catch(e){ el.textContent='探测失败: '+e.message; }
  },
  close:function(resume){
    if(!DEV.on)return;
    Dev.endPanelDrag();
    DEV.on=false;document.body.classList.remove('dev-open');var el=document.getElementById('dev');if(el)el.style.display='none';
    resetInputState();updateTouchUI();
    if(resume!==false){
      var focus=DEV.returnFocus;
      if(focus&&focus.isConnected&&focus.getClientRects().length&&typeof focus.focus==='function')focus.focus({preventScroll:true});
      else if(playerInputAllowed())document.getElementById('cv').focus({preventScroll:true});
      resumeMouseLook();
    }
    DEV.returnFocus=null;
  },
  toggle:function(){ if(DEV.on) Dev.close(); else Dev.open(); },
  paint:function(){
    var states={devfast:DEV.fast,devgod:DEV.god,devsearch:SEARCH.on,devfake:!!(S.fn&&S.fn.on)};
    ['canopy','sign','link','fence'].forEach(function(k){states['devhide-'+k]=!!DEV_HIDE[k];});
    Object.keys(states).forEach(function(id){var el=document.getElementById(id);if(el){el.classList.toggle('on',!!states[id]);el.setAttribute('aria-pressed',String(!!states[id]));}});
  },
  fast:function(){ DEV.fast=!DEV.fast; Dev.paint(); Dev.report(DEV.fast?'快跑：开':'快跑：关'); },
  search:function(){ SEARCH.on=!SEARCH.on; clearSearch(); Dev.paint(); Dev.report(SEARCH.on?'翻找读条：开':'翻找读条：关（立刻翻完）'); },
  god:function(){ DEV.god=!DEV.god; Dev.paint(); Dev.report(DEV.god?'无敌：开':'无敌：关'); },
  san:function(){ if(!Dev.canUse())return;S.san=100; S.stam=100;S.tired=false; Dev.report('SAN / 体力已恢复');Dev.refresh(); },
  time:function(min){
    if(!Number.isFinite(min)||!Dev.canChangeTime())return;
    /* 调试暂停时 tick 不运行；过期检查要及时丢弃，回拨也不能让它们重新变为有效。 */
    function prune(){if(RT.inspection)RT.inspection.queue=RT.inspection.queue.filter(function(item){return !Inspection.stale(item);});}
    prune();if(min>=0)advanceGameTime(min);else rewindGameTime(-min);prune();
    patEndIfInvalid();Dev.report('时间已调整至第 '+S.day+' 天 '+fmtClock(S.tsec));Dev.refresh();
  },
  endActiveAnomaly:function(){
    if(AN.active){if(UI.chooseOpen)UI.closeChoice();anEnd();}
    /* 拍肩异象结束后笑脸仍可能停留数秒，切场景或替换时一并移除。 */
    smileClear();
  },
  prepareTeleport:function(){
    if(typeof Inspection!=='undefined')Inspection.cancel();
    if(typeof Elevator!=='undefined')Elevator.cancel();
    if(typeof CarChase!=='undefined'&&CarChase.active())CarChase.cancel();
    Dev.clearPreview();if(UI.chooseOpen)UI.closeChoice();Dev.endActiveAnomaly();
    clearSearch();patReset();spiralReset();resetInputState();
  },
  tp:function(){
    if(!Dev.canUse())return;
    var v=document.getElementById('devroom').value; if(!v||!INTERIORS[v]) return;
    try{ Dev.prepareTeleport();enterRoom(v,null,function(){syncCamera(0);Dev.refresh();});Dev.report('传送 → '+INTERIORS[v].name); }catch(e){ Dev.report('传送失败'); }
  },
  tpo:function(){
    if(!Dev.canUse())return;
    var value=document.getElementById('devout').value;if(value==='')return;
    var i=+value, p=DEV_POI[i]; if(!p) return;
    try{
      Dev.prepareTeleport();
      S.mode='out'; S.room=null;
      S.x=p[1]*SC; S.y=p[2]*SC; S.ang=Math.PI/2; S.pitch=0; S.seated=false;
      enterWorldOut();syncCamera(0);
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
      AN.id=id; AN.t=0; AN.acc=0; AN.active=true; AN.data={}; AN.sub=0;
      AN.lastBig=!AN_SMALL[id];
      os('【Dev】'+((AN_NAME&&AN_NAME[id])||id),2.6);
      anOn(id);
      Dev.report('异象：'+(AN_NAME[id]||id));Dev.refresh();
    }catch(e){ Dev.report('触发失败：'+e.message); }
  },
  anomEnd:function(){
    if(!Dev.canUse())return;
    try{ Dev.endActiveAnomaly(); Dev.report('异象已结束');Dev.refresh(); }catch(e){ AN.active=false; AN.id=null;Dev.report('异象结束失败'); }
  },
  anim:function(mode){
    if(!Dev.canUse()||[1,2,3].indexOf(mode)<0)return;
    SFX.anim(mode);Dev.report('画面演出已开始');
  },
  clearPreview:function(){
    if(DEV.previewTimer)clearTimeout(DEV.previewTimer);DEV.previewTimer=0;
    var fx=DEV.previewFx;DEV.previewFx=null;
    if(fx){
      if(ANFX.grp===fx){anfxClear();if(S.screen==='play'&&!S.dead)syncCamera(0);}
      ThreeBackend.disposeGroup(fx);
    }
  },
  clearAnimation:function(){
    VisualState.deathAnim=null;
    if(GLR.postMat){GLR.postMat.uniforms.uDm.value=0;GLR.postMat.uniforms.uDt.value=0;}
  },
  previewDeath:function(){
    if(!Dev.canUse())return;
    if(AN.active){Dev.report('请先结束当前异象，再预览死亡效果。');return;}
    var t=document.getElementById('devdeath').value;if(!t)return;
    Dev.clearPreview();deathFX(t,{preview:true});
    if(ANFX.kind!=='death'||!ANFX.grp){Dev.report('死亡效果预览失败');return;}
    DEV.previewFx=ANFX.grp;
    try{SFX.deathFx(t);}catch(e){}
    var previewSeconds=Math.max(3.5,DeathTimeline.duration(t)+0.2);
    DEV.previewTimer=setTimeout(function(){Dev.clearPreview();},previewSeconds*1000);
    Dev.report('正在预览死亡效果，'+previewSeconds.toFixed(1)+' 秒后自动清理');
  },
  death:function(){
    if(!Dev.canUse())return;
    var t=document.getElementById('devdeath').value||'vignette';
    if(!window.confirm('实际死亡会触发救命道具，且可能删除当前存档。继续吗？'))return;
    Dev.clearPreview();
    var wasGod=DEV.god;
    DEV.god=false;
    try{ kill('【Dev】测试死亡演出：'+t,t); }finally{ DEV.god=wasGod; }
    Dev.refresh();
  },
  revive:function(){
    if(S.screen!=='play'){Dev.report('请先开始游戏。');return;}
    if(!S.dead&&!S.death){Dev.report('角色尚未死亡。');return;}
    S.deadId=(S.deadId||0)+1;
    var view=S.deathView;S.deathView=null;
    S.dead=false; S.death=null; S.deadT=0;
    if(view){S.ang=view.ang;S.pitch=view.pitch;S.eyeLift=view.eyeLift;}else S.eyeLift=0;
    if(S.san<=0)S.san=45;
    if(S.tt>=100){S.tt=86;S.ttTier=4;}
    capStamina();
    var dEl=document.getElementById('die'); if(dEl) dEl.style.display='none';
    var fEl=document.getElementById('flash'); if(fEl) fEl.style.opacity='0';
    Dev.clearPreview();try{ if(ANFX.kind==='death')anfxClear(); }catch(e){}
    Dev.clearAnimation();VisualState.hurt=0;VisualState.flash=0;syncCamera(0);
    Dev.report('已复活');Dev.refresh();updateTouchUI();
  }
};
