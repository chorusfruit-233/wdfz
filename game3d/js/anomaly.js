/* 里世界 3D · 异象 */
'use strict';

var AN={
  id:null, t:0, acc:0, next:45, data:{}, rained:false,
  cool:{}, lastBig:false, active:false, sub:0
};
var AN_W={
  chalk:0.42, roster:0.42, leak:0.55, broad:0.75, bell13:0.85,
  shifting:0.9, repeat:0.9, rite:0.85, cold:0.9, hand:0.9,
  loop:1.0, turn:0.5, stare:0.95, twin:0.55, lamps:0.9,
  feast:0.50, necker:0.70, shadow:0.80, bells:0.75, exercise:0.85,
  rain:0.26, moth:0.24, raindots:0.32
};
var AN_SMALL={chalk:1,roster:1,leak:1,broad:1,shifting:1,cold:1,hand:1,loop:1,turn:1,lamps:1,shadow:1};
var AN_COOL={rain:260,moth:200};
var AN_ID=['rain','moth','turn','broad','bell13','exercise','bells','hand','repeat','chalk',
  'loop','roster','leak','rite','cold','shifting','stare','lamps','feast','necker','shadow','twin','raindots'];
var AN_CN={
  rain:'下不完的雨',moth:'蛾群',turn:'有人在我背后拍了一下',broad:'广播点名',
  bell13:'钟敲十三下',exercise:'操场做操的人',bells:'车棚所有铃一起响',
  hand:'隔间底下伸来的手',repeat:'你作业交了吗',chalk:'黑板上的「下一次」',
  loop:'无尽的走廊',roster:'被划掉的名字',leak:'天花板渗水',rite:'实验楼仪式现场',
  cold:'冷库',shifting:'窗外的楼在动',stare:'全体回头',lamps:'熄灯后的走廊灯',
  feast:'食堂的盛宴',necker:'围墙外的行人',shadow:'影子慢一拍',
  twin:'天台的第二个你',raindots:'雨点落成的字'
};
var DFX_MAP={
  rain:'drown',moth:'swarm',turn:'gaze',broad:'voice',bell13:'bell',
  exercise:'follow',bells:'shatter',hand:'hand',feast:'deep',
  leak:'water',shadow:'shadow',rite:'ring',roster:'names',
  repeat:'gaze',chalk:'chalk',loop:'loop',cold:'freeze',raindots:'water',
  shifting:'twin',stare:'stare',twin:'twin',lamps:'lamps',necker:'neck'
};
function nearObj(id,pad){
  var o=objById(id); if(!o) return 99999;
  var cx=o.x*SC+o.w*SC/2, cy=o.y*SC+o.h*SC/2;
  return Math.sqrt(dist2(S.x,S.y,cx,cy));
}
function corridorHere(){
  if(S.mode!=='in') return false;
  var R=INTERIORS[S.room];
  if(!R||R.host!=='teach'||R.floor>5) return false;
  var row=Math.floor((S.y-R.oy)/R.th);
  return row>=16&&row<=20;
}
function inLabHere(){ return S.mode==='in'&&INTERIORS[S.room]&&INTERIORS[S.room].host==='lab'; }
function inToiletHere(){
  if(S.mode!=='in') return false;
  var R=INTERIORS[S.room]; if(!R) return false;
  var t=tileAt(R,S.x,S.y);
  if(t==='B'||t==='G') return true;
  if(R.host==='teach'){
    var c=Math.floor((S.x-R.ox)/R.tw), r=Math.floor((S.y-R.oy)/R.th);
    if(c>=58&&c<=61&&r>=16&&r<=19) return true;
  }
  return false;
}
function inCanteen(){ return S.mode==='in'&&S.room==='canteen1'; }
function onRoof(){ return S.mode==='in'&&S.room==='teach6'; }

function anAllowed(id){
  var t=S.tsec, nw=needWhere(t);
  if(id==='rain'){ return S.mode==='out'&&nw!=='教室'; }
  if(id==='moth'){ return AN.rained; }
  if(id==='raindots'){ return AN.rained; }
  if(id==='turn'){ return true; }
  if(id==='broad'){ return S.mode==='in'; }
  if(id==='bell13'){ return S.mode==='in'&&(INTERIORS[S.room].host==='teach'||INTERIORS[S.room].host==='dormN'); }
  if(id==='exercise'){ return S.mode==='out'&&onField(); }
  if(id==='bells'){ return nearObj('shed',0)<320; }
  if(id==='hand'){ return inToiletHere(); }
  if(id==='repeat'){ return inClassroomHere(); }
  if(id==='chalk'){ return S.mode==='in'; }
  if(id==='loop'){ return corridorHere(); }
  if(id==='roster'){ return S.mode==='in'; }
  if(id==='leak'){ return S.mode==='in'; }
  if(id==='rite'){ return inLabHere(); }
  if(id==='cold'){ return inCanteen(); }
  if(id==='shifting'){ return inClassroomHere(); }
  if(id==='stare'){ return inClassroomHere(); }
  if(id==='lamps'){ return corridorHere()&&isNight(); }
  if(id==='feast'){ var p=periodAt(t); return inCanteen()&&((t>=730&&t<810)||(t>=1080&&t<1150)); }
  if(id==='necker'){ return S.mode==='out'&&S.x>(BOUND.x1-220)*SC; }
  if(id==='shadow'){ return S.mode==='out'&&onField(); }
  if(id==='twin'){ return onRoof(); }
  return false;
}
function pickAnomaly(){
  var pool=[],i,id;
  for(i=0;i<AN_ID.length;i++){
    id=AN_ID[i];
    if(!anAllowed(id)) continue;
    if(AN_COOL[id]&&AN.cool[id]!==undefined&&(S.tsec-AN.cool[id])<AN_COOL[id]) continue;
    pool.push(id);
  }
  if(!pool.length) return null;
  var want=null;
  if(needWhere(S.tsec)==='教室') want=AN_SMALL;
  var pref=[];
  if(want){ for(i=0;i<pool.length;i++) if(want[pool[i]]) pref.push(pool[i]); }
  if(pref.length>=3&&Math.random()<0.8) pool=pref;
  if(S.day===1&&S.diff==='easy'){
    pool=pool.filter(function(a){ return a!=='necker'&&a!=='twin'&&a!=='moth'&&a!=='rite'; });
    if(!pool.length) return null;
  }
  var tot=0,ws=[];
  for(i=0;i<pool.length;i++){
    var w=AN_W[pool[i]]||1;
    if(AN_SMALL[pool[i]]) w*=1.25;
    if(inLabHere()) w*=1.9;
    ws.push(w); tot+=w;
  }
  var r=Math.random()*tot,acc=0;
  for(i=0;i<pool.length;i++){ acc+=ws[i]; if(r<acc) return pool[i]; }
  return pool[pool.length-1];
}

/* ---------- 异象节奏 ----------
   以前 AN.next 按游戏分钟倒数：上课时时间流速是下课的 6–7 倍，于是课上大约每 10 秒就来一次，
   一个接一个停不下来。现在按真实秒数计；SAN 越低、违规越多，来得越密。 */
function anInterval(){
  var hard=(S.diff==='hard');
  var base=hard?rnd(24,40):rnd(40,64);
  base*=0.62+0.38*clamp(S.san,0,100)/100;
  base*=1-clamp(S.viol,0,100)/260;
  if(AN.lastBig) base*=1.25;                     /* 大的过去之后，给一口喘气的时间 */
  return Math.max(10,base);
}
function anScheduleNext(){
  try{ AN.pre = pickAnomaly(); }catch(e){ AN.pre=null; }
  AN.next=anInterval();
  if(AN.preNext){ AN.next=AN.preNext; AN.preNext=0; }   /* 黑板上预告过的时间，要兑现 */
}
/* 只有"看起来就要命"的那几种会直接杀人；其它的按选择 / 表现扣 SAN */
var AN_LETHAL={rain:1,rite:1,necker:1,moth:1,twin:1,exercise:1};
var AN_MSG={
  rain:'我：天一下子暗了。雨不是从云里落下来的——它从很高的地方垂下来，像有人在上面一桶一桶地倒。',
  moth:'我：灯下面聚了一团飞蛾。不对，不是一团。是一整面墙。它们在往我这边挪。',
  turn:'……有人从后面拍了一下我的肩膀。很轻。手指是湿的。',
  broad:'广播：「沙……高二（二）班的同学，请你……留在原地。不要走动。」',
  bell13:'我：钟响了。一下，两下……我下意识地开始数。',
  exercise:'我：操场上有一群人在做操。动作整齐得过分。领操台上没有人。',
  bells:'我：车棚里所有的车铃，在同一刻响了起来。没有风。',
  hand:'我：隔间底下的缝里，伸出来一只手。手心朝上，指甲缝里是黑的。',
  repeat:'后桌（贴着我的后脑勺）：「……你作业，交了吗？」',
  chalk:'我：黑板上，有人在写字。粉笔自己在动。',
  loop:'我：走廊尽头那扇门……我已经第三次走到它面前了。',
  roster:'我：墙上多了一张名单。纸是新的。上面有我的名字——被一道红线划掉了。',
  leak:'我：天花板在往下滴水。今天没有下雨。水是温的。',
  rite:'我：地上有一个粉笔画的圈，线还很新。圈里摆着四根白蜡烛。圈的正中，空着一个人的位置。',
  cold:'我：食堂最东边那扇门后面冷得像冰柜。门缝里，有什么东西在轻轻地敲。',
  shifting:'我：窗外的楼……在动。很慢，一栋一栋地挪。',
  stare:'我：全班同时回过头来看着我。没有人眨眼。',
  lamps:'我：走廊的灯一盏一盏亮了起来。它在跟着我。',
  feast:'我：食堂里摆了一长桌菜，还冒着热气。每一副碗筷前面，都有一张写着名字的纸条。',
  necker:'我：围墙外面有个人在走。我走他也走，我停他也停。他的脖子……太长了。',
  shadow:'我：我的影子慢了半拍。它刚刚，自己动了一下。',
  twin:'我：天台的另一头站着一个人。穿着我们学校的校服。他站的姿势，和我一模一样。',
  raindots:'我：雨点落在地上，没有散开。它们在排队。'
};
function anStart(){
  var id=null;
  if((S.diff==='easy'||AN.locked)&&AN.pre){
    if(anAllowed(AN.pre)) id=AN.pre;
    else if(AN.locked&&!AN.lockWait){ AN.lockWait=1; AN.next=4; return; }   /* 预报过的那个，等你走到它能出现的地方 */
  }
  AN.locked=false; AN.lockWait=0;
  AN.pre=null;
  if(!id) id=pickAnomaly();
  if(!id){ anScheduleNext(); AN.next=Math.min(AN.next,6); return; }
  AN.id=id; AN.t=0; AN.acc=0; AN.active=true; AN.data={}; AN.sub=0;
  AN.lastBig=!AN_SMALL[id];
  if(AN_COOL[id]!==undefined||id==='rain'||id==='moth'||id==='raindots') AN.cool[id]=S.tsec;
  if(id==='rain'||id==='moth'||id==='raindots') AN.rained=true;
  os(AN_MSG[id]||'我：……',4.6);
  try{ SFX.anomaly&&SFX.anomaly(id); }catch(e){}
  anOn(id);
}
function anEnd(){
  if(!AN.active&&AN.id===null) return;
  var id=AN.id;
  anOff(id);
  if(id==='roster'&&!AN.data.done){
    S.viol=Math.min(100,S.viol+18);
    os('我：那张名单我没动。走开的时候，我听见身后有笔尖划过纸的声音。',4.0);
  }
  try{ traceAdd(id); }catch(e){}
  try{ SFX.anomalyEnd&&SFX.anomalyEnd(id); }catch(e){}
  AN.id=null; AN.active=false; AN.acc=0;
  anScheduleNext();
}

var ENTS=[];
function entAdd(color,w,h,x,y,z){
  var geo=new THREE.PlaneGeometry(w,h);
  var mat=new THREE.MeshBasicMaterial({color:color,transparent:true,opacity:0.85,side:THREE.DoubleSide,depthWrite:false});
  var m=new THREE.Mesh(geo,mat);
  m.position.set(x,y,z);
  GLR.scene.add(m);
  ENTS.push(m);
  return m;
}
function entClear(){
  for(var i=0;i<ENTS.length;i++){ GLR.scene.remove(ENTS[i]); ENTS[i].geometry.dispose(); ENTS[i].material.dispose(); }
  ENTS=[];
}
function entFace(){
  for(var i=0;i<ENTS.length;i++){
    ENTS[i].quaternion.copy(GLR.cam.quaternion);
  }
}

var HAS_FX={rain:1,moth:1,exercise:1,necker:1,twin:1,hand:1,shadow:1,
  leak:1,rite:1,feast:1,lamps:1,chalk:1,roster:1,broad:1,repeat:1,shifting:1,cold:1,raindots:1,stare:1};
/* 选一个在玩家前方、站得住的点（世界单位） */
function aheadPoint(dist){
  var a, k, tries=[0,0.6,-0.6,1.2,-1.2,PI];
  for(k=0;k<tries.length;k++){
    a=S.ang+tries[k];
    var x=S.x+Math.cos(a)*dist, y=S.y+Math.sin(a)*dist;
    if(!solidAt(x,y)) return {x:x,y:y};
  }
  return {x:S.x,y:S.y};
}
function anOn(id,silent){
  var d=AN.data;
  var srcX=S.x, srcY=S.y;
  /* 以前好几个异象的"看得见的东西"和"判定用的位置"不在一个地方：
     天台的另一个你就生在玩家脚下、仪式圈半径和判定半径差一倍、渗水点和水渍各算各的。 */
  if(id==='rite'){ var rp=aheadPoint(40); d.c={x:rp.x,y:rp.y}; srcX=rp.x; srcY=rp.y; }
  if(id==='moth'||id==='exercise'){ d.src={x:S.x,y:S.y}; }
  if(id==='necker'){ srcX=BOUND.x1*SC+16; srcY=S.y; }
  if(id==='twin'&&INTERIORS[S.room]){
    var RR=INTERIORS[S.room];
    var cxr=RR.ox+RR.w/2, cyr=RR.oy+RR.h/2;
    d.x=cxr-(S.x-cxr)*0.8; d.y=cyr-(S.y-cyr)*0.8;           /* 天台的另一头，正对着你 */
    if(solidAt(d.x,d.y)){ d.x=RR.ox+RR.w*0.22; d.y=RR.oy+RR.h*0.25; }
    d.room=S.room; srcX=d.x; srcY=d.y;
  }
  if(id==='leak'){
    d.pts=[];
    for(var i=0;i<5;i++){ var lp=aheadPoint(rnd(10,34)); d.pts.push({x:lp.x+rnd(-14,14),y:lp.y+rnd(-14,14)}); }
  }
  if(id==='hand'){ var hp=aheadPoint(8); srcX=hp.x; srcY=hp.y; }
  if(id==='roster'){ d.rx=S.x; d.ry=S.y; d.done=false; }
  try{ if(HAS_FX[id]) anfxSpawn(id, srcX, srcY); }catch(e){}
  AN.rained = AN.rained || (id==='rain');
  if(id==='chalk'){
    /* 黑板上写的是"下一次"的钟点：先把下一次的间隔掷出来，结束时照着兑现 */
    AN.preNext=anInterval();
    var mins=Math.round((16+AN.preNext)*rateAt(S.tsec)/60);
    d.until=S.tsec+mins;
    os('我：黑板上写着一个时间——'+fmtClock(d.until)+'。字迹和我的一模一样。',5);
  }
  if(id==='turn'){ d.chosen=null; }
  if(id==='hand'){ d.chosen=null; }
  if(id==='repeat'){ d.chosen=null; }
  if(id==='cold'){ d.chosen=null; }
  if(id==='shadow'){ d.acc=0; }
}

function anOff(id){ entClear(); try{ anfxClear(); }catch(e){} }

/* 非致命异象的"惩罚"：吓一下、扣 SAN，然后结束 */
function anHurt(msg,loss,opt){
  opt=opt||{};
  var k=(S.diff==='hard')?1.25:0.9;
  S.san=Math.max(0,S.san-loss*k);
  GLR.hurt=Math.max(GLR.hurt||0,0.65);
  if(!opt.quiet){                           /* quiet：不闪白、不加刺耳的音效，只留画面暗下去那一下 */
    GLR.flash=Math.max(GLR.flash||0,0.25);
    try{ SFX.sting&&SFX.sting(); }catch(e){}
  }
  os(msg,4.4);
  if(S.san<=0&&!S.dead){ kill('你一直撑着的那根弦，断了。','vignette'); return; }
  if(!opt.keep) anEnd();
}
/* 能躲雨的地方：屋里、柱廊下、车棚、连廊下 */
function underCover(){
  if(S.mode==='in') return true;
  if(USE.brollyShield) return true;
  var mx=S.x/SC, my=S.y/SC, i, o;
  for(i=0;i<OBJ.length;i++){
    o=OBJ[i];
    if(o.k==='link'&&mx>o.x&&mx<o.x+o.w&&my>o.y&&my<o.y+o.h) return true;
    if(o.open1f&&mx>o.x&&mx<o.x+o.w&&my>o.y+o.h&&my<o.y+o.h+12) return true;
    if(o.id==='shed'&&mx>o.x-3&&mx<o.x+o.w+3&&my>o.y-3&&my<o.y+o.h+3) return true;
  }
  return false;
}

function anTick(dt){
  if(!AN.active||AN.id===null) return;
  var id=AN.id, d=AN.data, hard=(S.diff==='hard');
  AN.t+=dt;
  if(AN.t>45){ anEnd(); return; }
  switch(id){
    case 'rain':
      if(underCover()){
        AN.acc=Math.max(0,AN.acc-dt*0.6);
        if(!d.cov&&S.mode==='out'){ d.cov=1; os('我：躲到了檐下。雨声一下子远了，可我还是能听见它在找我。',3.6); }
      }else{ AN.acc+=dt; S.san-=dt*0.7; d.cov=0; }
      if(AN.acc>(hard?9:14)) anKill('雨灌进了你的肺里。你听见自己在身体里晃，像一只装满水的桶。','drown');
      else if(AN.acc>(hard?5:8)&&!d.warn){ d.warn=1; os('我：喘不上气了。得找个有顶的地方——屋檐、柱廊、车棚，哪里都行。',3.6); }
      if(AN.t>26) anEnd();
      break;
    case 'moth':
      var dm=Math.sqrt(dist2(d.src.x,d.src.y,S.x,S.y));
      if(dm>120) AN.acc=Math.max(0,AN.acc-dt*1.4);
      else { AN.acc+=dt; S.san-=dt*1.6; }
      if(AN.acc>(hard?4.5:6.5)) anKill('蛾群把你裹住了。翅膀上的粉落进你的眼睛里，很痒。然后什么都不痒了。','swarm');
      if(AN.t>24) anEnd();
      break;
    case 'turn':
      if(d.chosen===null){
        if(AN.t>1.2&&!d.asked){
          d.asked=true;
          UI.choice('背后有只手，拍了一下我的肩膀。它还搭在那儿。',[
            {label:'不回头',fn:function(){ d.chosen='no'; UI.closeChoice(); }},
            {label:'回头看',fn:function(){ d.chosen='yes'; UI.closeChoice(); }}
          ]);
        } else if(d.asked&&d.chosen===null&&AN.t>11){ d.chosen='no'; UI.closeChoice(); }
      }else if(d.chosen==='yes'){
        AN.acc+=dt;
        if(AN.acc>0.5) anHurt('我回头了。它的脸离我只有一寸——没有五官，只有一层湿透的皮。下一秒，什么都没有了。肩膀上还是凉的。',26,{quiet:1});
      }else{
        AN.acc+=dt;
        if(AN.acc>=7.8){ S.san=Math.min(100,S.san+6); addClue('turn'); os('我：那只手慢慢松开了。我一直没有回头。',3.4); anEnd(); }
      }
      break;
    case 'broad':
      if(S.moving&&!S.seated){ AN.acc+=dt; }
      if(AN.acc>1.6) anHurt('广播停了一下。然后，它念出了我现在站着的位置——精确到哪一块地砖。',18);
      else if(AN.t>5.2){ os('广播：「……谢谢配合。」',2.6); anEnd(); }
      break;
    case 'bell13':
      if(S.seated&&S.room==='teach1'){ os('我：我坐回自己的位子上。钟声在第十二下停了。',3.4); anEnd(); break; }
      S.san-=dt*0.22;
      if(AN.t>15) anHurt('第十三下。我数得很清楚——可是我不记得自己是从哪一下开始数的。',20);
      break;
    case 'exercise':
      var de=Math.sqrt(dist2(d.src.x,d.src.y,S.x,S.y));
      if(de>120){ AN.acc=Math.max(0,AN.acc-dt*0.8); }
      else { AN.acc+=dt; }
      if(AN.acc>(hard?3.6:5.2)) anKill('你开始跟着做操。手臂抬起来的时候你才发现，你早就停不下来了。','follow');
      if(AN.t>22) anEnd();
      break;
    case 'bells':
      var db=nearObj('shed',0);
      if(db<110){ AN.acc+=dt; } else { AN.acc=Math.max(0,AN.acc-dt*1.2); }
      if(AN.acc>2.0) anHurt('所有车铃同时响的那一刻，耳朵里只剩下"嗡"的一声。过了很久，我才听见自己的心跳。',15);
      if(AN.t>18) anEnd();
      break;
    case 'hand':
      if(d.chosen===null){
        if(AN.t>1.6&&!d.asked){
          d.asked=true;
          UI.choice('隔间底下伸来一只手。手心朝上，像在等什么。',[
            {label:'不动',fn:function(){ d.chosen='no'; UI.closeChoice(); }},
            {label:'把手放上去',fn:function(){ d.chosen='yes'; UI.closeChoice(); }}
          ]);
        } else if(d.asked&&d.chosen===null&&AN.t>11){ d.chosen='no'; UI.closeChoice(); }
      }else if(d.chosen==='yes'){
        var lost=null;
        if(S.bag.length){ lost=S.bag[Math.floor(Math.random()*S.bag.length)]; removeItem(lost); }
        anHurt('它握住了我，握得很紧，指甲陷进肉里。等我把手抽回来——'+(lost?'口袋里的「'+ITEMS[lost].n+'」不见了。':'掌心多了一道指甲印，弯弯的，像在笑。'),20);
      }else{
        AN.acc+=dt;
        if(AN.acc>2.2){ addClue('hand'); os('我：那只手在原地停了很久，然后慢慢缩了回去。',3.2); anEnd(); }
      }
      break;
    case 'repeat':
      if(d.chosen===null){
        if(AN.t>1.0&&!d.asked){
          d.asked=true;
          var opts=[];
          if(S.bag.indexOf('hw')>=0) opts.push({label:'把作业本递过去',fn:function(){ d.chosen='hw'; UI.closeChoice(); }});
          opts.push({label:'不出声',fn:function(){ d.chosen='quiet'; UI.closeChoice(); }});
          opts.push({label:'说出一个名字',fn:function(){ d.chosen='name'; UI.closeChoice(); }});
          UI.choice('后桌：「你作业交了吗？」',opts);
        } else if(d.asked&&d.chosen===null&&AN.t>15){ d.chosen='quiet'; UI.closeChoice(); }
      }else if(d.chosen==='hw'){
        S.san=Math.min(100,S.san+12); removeItem('hw'); os('我：后面那只手接过了作业本，翻了一页，又翻了一页。然后安静了。',3.6); anEnd();
      }else if(d.chosen==='name'){
        anHurt('我说出了一个名字。全班同时应了一声——"到"。没有一个声音是我认识的。',20);
      }else{
        AN.acc+=dt;
        if(AN.acc>14){ S.san-=6; addClue('repeat'); os('我：他问了十四遍。第十五遍的时候，他叫的是我的名字。',3.6); anEnd(); }
      }
      break;
    case 'chalk':
      S.san-=dt*0.25;
      if(AN.t>16) anEnd();
      break;
    case 'loop':
      /* 以前出了教学楼它还在计时，最后在操场上念"门牌上的班号" */
      if(!corridorHere()){
        os(S.mode==='out'?'我：推开门，外面是校园。回头看，那条走廊又只有原来那么长了。':'我：我拐进了一间教室。身后的走廊安静下来，不再往前延伸了。',3.4);
        anEnd(); break;
      }
      if(KEY['shift']||KEY[' ']||S.run){ AN.acc+=dt*2.6; }
      else { AN.acc+=dt; }
      S.san-=dt*0.3;
      if(AN.acc>14){ os('我：门终于是另一扇了。门牌上的班号，比刚才大了一。',3.4); anEnd(); }
      break;
    case 'roster':
      if(d.done){ anEnd(); break; }
      if(AN.t>18) anEnd();
      break;
    case 'leak':
      if(d.hurt){ if(AN.t>20) anEnd(); break; }
      var on=false;
      for(var i=0;i<d.pts.length;i++){ if(dist2(d.pts[i].x,d.pts[i].y,S.x,S.y)<10*10) on=true; }
      if(on){ AN.acc+=dt; } else { AN.acc=Math.max(0,AN.acc-dt); }
      if(AN.acc>1.5){ d.hurt=1; anHurt('水滴进了我的衣领。是温的，有一股铁锈味。我抬头——天花板上那块水渍，形状像一个人趴在上面。',12,{keep:1}); }
      if(AN.t>20) anEnd();
      break;
    case 'rite':
      var dr=Math.sqrt(dist2(d.c.x,d.c.y,S.x,S.y));
      if(dr<19){ AN.acc+=dt; S.san-=dt*2.0; if(!d.warn){ d.warn=1; os('我：我踩到粉笔线了。蜡烛的火苗一起朝我这边歪。',3.0); } }
      else AN.acc=Math.max(0,AN.acc-dt*0.5);
      if(AN.acc>(hard?1.4:2.2)) anKill('你走进了那个圈。正中那个空着的位置，刚好是你的大小。','ring');
      if(AN.t>20) anEnd();
      break;
    case 'cold':
      if(d.chosen===null){
        if(AN.t>1.4&&!d.asked){
          d.asked=true;
          UI.choice('最东边那扇门后面，冷得像冰柜。门缝里有东西在敲，很有节奏。',[
            {label:'把门拉开一条缝',fn:function(){ d.chosen='near'; UI.closeChoice(); }},
            {label:'转身就走',fn:function(){ d.chosen='away'; UI.closeChoice(); }}
          ]);
        } else if(d.asked&&d.chosen===null&&AN.t>11){ d.chosen='near'; UI.closeChoice(); }
      }else if(d.chosen==='near'){
        S.san=Math.min(100,S.san+14);
        os('我：里面挂着一排冻硬的校服，袖子在风里互相敲。最外面那件的胸口，绣着我的名字。……我反而不怕了。',5.4);
        anEnd();
      }else{
        S.san=Math.max(0,S.san-16);
        os('我：我走了。那股冷气跟着我，一直贴在后颈上，走了很远都没散。',4.2);
        anEnd();
      }
      break;
    case 'shifting':
      S.san-=dt*0.5;
      if(AN.t>18){ os('我：楼停下来了。整片校园里，只有钟楼一直没动——它在看着别的楼。',4.6); anEnd(); }
      break;
    case 'stare':
      if(d.hit){ d.hitT+=dt; if(d.hitT>1.6) anEnd(); break; }   /* 墙上的眼睛全睁开，停一会儿再散 */
      if(!S.moving){ AN.acc+=dt; } else { AN.acc=Math.max(0,AN.acc-dt); }
      if(AN.acc>1.8){ d.hit=1; d.hitT=0; anHurt('我站住了。于是全班一起站了起来，椅子腿在地上刮出同一声。然后他们又一起坐下。',18,{keep:1}); }
      else if(AN.t>12){ os('我：他们慢慢地转回去了。最后转回去的，是我的同桌。',3.4); anEnd(); }
      break;
    case 'lamps':
      if(!S.moving){ AN.acc+=dt; } else { AN.acc=Math.max(0,AN.acc-dt*0.8); }
      if(AN.acc>1.6) anHurt('灯停在了我头顶，亮得发白。有一瞬间，我看见了自己手背里的骨头。',16);
      else if(AN.t>16){ os('我：灯一盏一盏地灭回去。最后一盏在我前面，灭得很慢，像在等我。',3.6); anEnd(); }
      break;
    case 'feast':
      if(!inCanteen()){ AN.acc=Math.max(0,AN.acc-dt*0.5); }
      else { AN.acc+=dt; }
      if(AN.acc>(S.talent==='stomach'?17:9)){
        S.tsec=((S.tsec+20)%1440+1440)%1440;
        anHurt('我回过神来的时候，嘴里有东西。我不记得自己坐下过。面前的碗是空的，上面那张纸条写着我的名字。',22);
      }
      if(AN.active&&AN.t>24) anEnd();
      break;
    case 'necker':
      var wallX=BOUND.x1*SC;
      var dToWall=Math.abs(wallX-S.x);
      if(dToWall<150*SC/2){ S.san-=dt*1.2; }
      if(dToWall<90*SC/2){ AN.acc+=dt; if(!d.warn){ d.warn=1; os('我：他停下来了。他在等我再走近一点。',3.0); } } else { AN.acc=Math.max(0,AN.acc-dt); }
      if(AN.acc>(hard?1.4:2.2)) anKill('他没有绕到校门口。他把脖子从围栏的缝里伸了进来，一直伸，一直伸。','neck');
      if(AN.t>20) anEnd();
      break;
    case 'shadow':
      if(underCover()){ AN.acc=Math.max(0,AN.acc-dt*0.6); }
      else { AN.acc+=dt; S.san-=dt*0.8; }
      if(AN.acc>10) anHurt('影子追上来了，和我叠在一起。有一瞬间，我分不清是谁先抬的手。',18);
      if(AN.active&&AN.t>22) anEnd();
      break;
    case 'twin':
      if(!INTERIORS[S.room]||S.room!==d.room){ os('我：我下了楼。楼梯上一直有第二个人的脚步声，比我慢半拍。',3.6); anEnd(); break; }
      var dtwin=Math.sqrt(dist2(d.x,d.y,S.x,S.y));
      /* 你不看他的时候，他就往你这边走 */
      var look=angDiff(Math.atan2(d.y-S.y,d.x-S.x),S.ang)<0.6;
      if(!look&&dtwin>16){
        var sp=(hard?26:18)*dt, ux=(S.x-d.x)/dtwin, uy=(S.y-d.y)/dtwin;
        d.x+=ux*sp; d.y+=uy*sp;
        if(!d.moved){ d.moved=1; os('我：……他刚才是不是动了？',2.6); }
      }
      if(dtwin<16) anKill('他走到了你面前。你们同时抬起手。他的手，是热的。','twin');
      if(AN.t>22){ os('我：他转身，从天台边上走了下去。没有声音。',3.4); anEnd(); }
      break;
    case 'raindots':
      S.san-=dt*0.4;
      if(AN.t>14){ os('我：地上的字写着——明天的天气：阴。明天的值日：你。',4.4); anEnd(); }
      break;
  }
}

function anKill(msg,fx){
  var f=fx||DFX_MAP[AN.id]||'vignette';
  kill(msg,f);
}

function anDrive(dt){
  if(S.fn&&S.fn.on&&S.fn.v<72){ return; }
  if(!AN.active){
    AN.next -= dt;
    if(AN.next<=0) anStart();
  } else {
    anTick(dt);
  }
}
