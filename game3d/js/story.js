/* 里世界 3D · 线索点、逃生思路、假正常、结局与死亡 */
'use strict';

var SPOTS=[
  {id:'guard', n:'保安岗',    x:552,y:142,w:56, h:40},
  {id:'gate',  n:'北门',      x:480,y:100,w:80, h:50},
  {id:'data',  n:'数据终端',  x:400,y:515,w:270,h:90},
  {id:'comp',  n:'机房',      x:400,y:670,w:270,h:100},
  {id:'garage',n:'车库',      x:285,y:510,w:62, h:58},
  {id:'trash', n:'垃圾房',    x:740,y:1060,w:56,h:62},
  {id:'wall',  n:'东围墙',    x:790,y:400,w:40, h:500},
  {id:'climb', n:'攀爬点',    x:572,y:210,w:36, h:165},
  {id:'stall', n:'第三个隔间',x:452,y:865,w:218,h:120},
  {id:'office',n:'办公室',    x:400,y:515,w:270,h:90},
  {id:'front', n:'前台',      x:452,y:865,w:218,h:120},
  {id:'portal',n:'实验台上的草图', x:-9999,y:-9999,w:1,h:1}      /* 只能在物理实验室的实验台上发现 */
];
/* 室内坐标和室外地图不是一回事（教学楼室内正好压在"隔间""前台"的矩形上，
   以前坐在教室里就"记下了第三个隔间"）。室内按所在的楼算，厕所隔间要亲眼看到。 */
var SPOT_ROOM={guard:['guard'],garw:['garage'],trash:['trash'],admin:['data'],lab:['comp']};
var SPOT_INDOOR_ONLY={stall:1};
function spotMark(id){
  if(S.spots[id]) return;
  var sp=null;
  for(var i=0;i<SPOTS.length;i++) if(SPOTS[i].id===id) sp=SPOTS[i];
  if(!sp) return;
  S.spots[id]=1;
  os('我：（记下了「'+sp.n+'」）',3);
  UI.spotsDirty=true;
}
function spotTick(){
  if(S.mode==='in'){
    var R=INTERIORS[S.room], ids=R&&SPOT_ROOM[R.host];
    if(ids) for(var k=0;k<ids.length;k++) spotMark(ids[k]);
    if(R&&R.host==='teach'&&inToiletHere()) spotMark('stall');   /* 隔间那条路只在教学楼 */
    return;
  }
  for(var i=0;i<SPOTS.length;i++){
    var sp=SPOTS[i];
    if(S.spots[sp.id]||SPOT_INDOOR_ONLY[sp.id]) continue;
    var mx=S.x/SC,my=S.y/SC;
    if(mx>sp.x-30&&mx<sp.x+sp.w+30&&my>sp.y-30&&my<sp.y+sp.h+30) spotMark(sp.id);
  }
}

var IDEAS=[
  {id:'key',   n:'拿那串车钥匙',        need:'guard',  route:'car'},
  {id:'car',   n:'开车走',              need:'garage', route:'car'},
  {id:'white', n:'走闸机白名单',        need:'data',   route:'face'},
  {id:'bin',   n:'钻进第三个垃圾桶',    need:'trash',  route:'trash'},
  {id:'front', n:'从正门走',            need:'front',  route:'trap_out'},
  {id:'climb', n:'翻墙',                need:'climb',  route:'trap_wall'},
  {id:'beg',   n:'去东围墙等一个路过的人', need:'wall', route:'trap_beg'},
  {id:'beast', n:'把东西扔进第三个隔间', need:'stall',  route:'beast'},
  {id:'portal',n:'在物理实验室造一扇门', need:'portal', route:'portal'}
];
function ideasAvailable(){
  var out=[];
  for(var i=0;i<IDEAS.length;i++){
    var it=IDEAS[i];
    if(!S.spots[it.need]) continue;
    out.push(it);
  }
  return out;
}
var FN_EVENTS=[
  {where:['teach'],      seen:'有同学拍我肩膀，问我去不去打球。', real:'我回头。我后面那两排座位是空的。'},
  {where:['teach'],      seen:'课代表把作业收上来了，问我交没交。', real:'他手里那摞本子最上面一本，名字是我的。'},
  {where:['canteen'],    seen:'食堂阿姨多给我打了一勺菜。', real:'勺子下面那层一直是温的。窗户外面没有人在排队。'},
  {where:['out'],        seen:'保安在门口冲我点头。', real:'他点头的幅度和昨天一模一样。我数了：三下。'},
  {where:['teach'],      seen:'同桌借我的笔，说还挺好写。', real:'我借出去的笔。我手里的笔还在。'},
  {where:['teach','lab'],seen:'广播里念到我的名字，说我考得不错。', real:'念名字的那个人，一个字也没有换气。'},
  {where:['out'],        seen:'体育课点名，点到我的时候我答了一声。', real:'没有人记。名单上那一行本来就是空的。'},
  {where:['teach'],      seen:'走廊里有人喊我，说快点要上课了。', real:'那个声音是从我背后贴着我耳朵发出来的。'},
  {where:['any'],        seen:'手机收到一条消息：今天放学早。', real:'发消息的人没有头像。聊天记录里只有这一条。'},
  {where:['teach'],      seen:'黑板右上角写着今天的日期。', real:'日期没变过。昨天也是这一天。'},
  {where:['dorm'],       seen:'室友问我几点了，我说快熄灯了。', real:'宿舍里只有我一个人的床铺是铺开的。'},
  {where:['admin','teach'], seen:'老师叫我去办公室，说有事找我谈。', real:'办公室里所有的椅子都朝门摆着，没有人坐过。'}
];
function fnWhereNow(){
  if(S.mode!=='in'||!S.room) return 'out';
  var R=INTERIORS[S.room]; if(!R) return 'out';
  if(R.id==='canteen1') return 'canteen';
  if(R.host==='dormN'||R.host==='dormS') return 'dorm';
  if(R.host==='admin') return 'admin';
  if(R.host==='lab') return 'lab';
  if(R.host==='teach') return 'teach';
  return 'out';
}
var FN_P={grp:null,room:null,mat:null};
function fnPeopleClear(){
  if(FN_P.grp){ try{ GLR.scene.remove(FN_P.grp); }catch(e){} }
  FN_P.grp=null; FN_P.room=null;
}
function fnPeopleBuild(){
  fnPeopleClear();
  if(S.mode!=='in'||!S.room) return;
  var R=INTERIORS[S.room]; if(!R) return;
  if(!FN_P.mat) FN_P.mat=new THREE.MeshBasicMaterial({color:0x41505c,fog:true});
  var g=new THREE.Group();
  GLR.scene.add(g); FN_P.grp=g; FN_P.room=S.room;
  var p=anfxW2S(S.x,S.y), made=0, c,r2,tries=0;
  while(made<4&&tries++<160){
    c=1+Math.floor(Math.random()*(R.cols-2));
    r2=1+Math.floor(Math.random()*(R.rows-2));
    var ch=R.grid[r2][c];
    if(ch==='#'||ch==='='||ch==='O'||ch==='S'||ch==='L') continue;
    var w=worldToScene(R.ox+(c+0.5)*R.tw,R.oy+(r2+0.5)*R.th,R);
    var d=Math.hypot(w.x-p.x,w.z-p.z);
    if(d<2.2||d>7.5) continue;
    var fg=new THREE.Group();
    fg.add(figMesh('person',FN_P.mat,1));
    fg.position.set(w.x,0,w.z);
    fg.rotation.y=Math.atan2(p.x-w.x,p.z-w.z);                 /* 正面（+z）朝着你 */
    g.add(fg);
    made++;
  }
}
function fnPeopleTick(){
  var on=(S.fn&&S.fn.on&&S.fn.v<72);
  if(!on){ if(FN_P.grp) fnPeopleClear(); return; }
  if(FN_P.room!==S.room) fnPeopleBuild();
}
function fnTick(dt){
  var f=S.fn; if(!f||!f.on) return;
  if(S.dead||S.screen!=='play') return;
  if(UI.chooseOpen) return;
  if(f.v>=100){
    f.on=false;
    kill('你笑得停不下来。笑了很久。','laugh');
    return;
  }
  if(f.left===undefined) f.left=4;
  if(f.left<=0){
    f.on=false;
    try{ fnPeopleClear(); }catch(e){}
    try{ os('我：……天黑了。刚才那些都很正常，正常得不对。',4.6); }catch(e){}
    try{ GLR.flash=Math.max(GLR.flash||0,0.35); }catch(e){}
    return;
  }
  if(f.v>72&&!f.shown){
    f.shown=true;
    GLR.hurt=Math.max(GLR.hurt||0,0.45);
    os('我：……刚才那些，我是不是笑得太大声了。',4.4);
  }
  try{ fnPeopleTick(); }catch(e){}
  var tag=fnWhereNow(), pool=[], pi;
  f.used=f.used||{};
  for(pi=0;pi<FN_EVENTS.length;pi++){
    if(f.used[pi]) continue;
    var wz=FN_EVENTS[pi].where;
    if(wz.indexOf('any')>=0||wz.indexOf(tag)>=0) pool.push(pi);
  }
  if(!pool.length) return;
  f.next-=dt;
  if(f.next>0) return;
  f.next=22+Math.random()*12;
  var pick=pool[Math.floor(Math.random()*pool.length)];
  f.used[pick]=1; f.n++;
  f.left=Math.max(0,(f.left===undefined?4:f.left)-1);
  var e=FN_EVENTS[pick];
  try{ SFX.click(); }catch(err){}
  UI.choice('看起来是——\n'+e.seen,[
    {label:'笑一下', fn:function(){
      UI.closeChoice(); f.v+=14;
      os('其实——'+e.real,4.6);
      try{ toast('（你笑出了声）'); }catch(err){}
    }},
    {label:'不笑，装作没这回事', fn:function(){
      UI.closeChoice(); f.v+=5;
      os('其实——'+e.real,4.6);
      try{ toast('（你忍住了）'); }catch(err){}
    }}
  ]);
}

function chooseIdea(id){
  var it=null,i;
  for(i=0;i<IDEAS.length;i++) if(IDEAS[i].id===id) it=IDEAS[i];
  if(!it) return;
  UI.close('think');
  if(it.route&&it.route.indexOf('trap_')===0){
    /* 以前在哪里选都会立刻触发；现在得真的站在那个地方 */
    var where=trapWhere(it.route);
    if(where){ os(where,3.0); return; }
    UI.choice('「'+it.n+'」——真的要这么做吗？',[
      {label:'再想想',fn:function(){ UI.closeChoice(); }},
      {label:'就这么办',fn:function(){
        UI.closeChoice();
        if(it.route==='trap_out') kill('你从门缝里挤了出去。外面是一条很长的马路，路尽头有一扇校门。你走进去——衣服上还有雨，教学楼里，铃刚刚响。','slit');
        else if(it.route==='trap_wall') kill('你翻上了墙头。墙外面还有一道墙。再外面，还有一道。你一直翻，翻到手指不再是手指的形状。','squeeze');
        else kill('路过的那个人停了下来。他慢慢转过头——他没有脸，只有一个很大的、在笑的洞。然后他从墙里直接走了进来。','face');
      }}
    ]);
    return;
  }
  if(it.route==='car'){ tryCarRoute(); return; }
  if(it.route==='face'){ tryFaceRoute(); return; }
  if(it.route==='trash'){ tryTrashRoute(); return; }
  if(it.route==='beast'){ tryBeastRoute(); return; }
  if(it.route==='portal'){ tryPortalRoute(); return; }
}

/* 陷阱路线要在对应地点才能执行：返回 null 表示人在地方，否则返回提示 */
function trapWhere(route){
  var mx=S.x/SC, my=S.y/SC, out=(S.mode==='out');
  if(route==='trap_out') return (out&&Math.hypot(mx-GATE_N.x,my-GATE_N.y)<60)?null:'我：正门在北边。要走，得先走到北门的闸机前面。';
  if(route==='trap_wall'){
    var sp=SPOTS.filter(function(s){ return s.id==='climb'; })[0];
    return (out&&sp&&mx>sp.x-20&&mx<sp.x+sp.w+20&&my>sp.y-20&&my<sp.y+sp.h+20)?null:'我：得先到车棚后面那段矮墙（攀爬点）去。';
  }
  return (out&&mx>BOUND.x1-70)?null:'我：得先走到东边的围墙底下。';
}
function tryCarRoute(){
  if(!hasItem('key')&&S.talent!=='drive'){ os('我：我没有钥匙。',2.6); return; }
  if(S.mode!=='in'||S.room!=='garage1'){ os('我：得先下到车库去。',2.6); return; }
  os('我：牌号对得上的那两辆，油表不是零。',4);
}
/* 能开的那一辆：离入口最远的 8 辆里随机挑一辆（每局不同，存在 RT 里） */
function carRightCell(){
  if(RT.carRight) return RT.carRight;
  var R=INTERIORS.garage1, cars=[], r, c;
  for(r=0;r<R.rows;r++) for(c=0;c<R.cols;c++) if(R.grid[r][c]==='V') cars.push([c,r]);
  cars.sort(function(a,b){ return a[0]-b[0]; });        /* 入口在东头：列号小的离得远 */
  var far=cars.slice(0,Math.max(1,Math.floor(cars.length/2)));
  var chosen=far[Math.floor(Math.random()*far.length)];
  RT.carRight=chosen[0]+':'+chosen[1];
  return RT.carRight;
}
function useCar(cx,cy){
  if(!hasItem('key')&&S.talent!=='drive'){ os('我：车门锁着。',2.4); return; }
  if(RT.carUsed){ os('我：已经开过一辆了。',2.4); return; }
  if(roamGuardsCar()){
    kill('你拉开车门，钻进去，摸到钥匙孔。后视镜里，它就站在后座上，弯着腰，脸贴着车顶。','grip');
    return;
  }
  var cell=cx+':'+cy;
  RT.carTried=RT.carTried||{};
  if(RT.carTried[cell]){ os('我：这辆试过了。不是它。',1.8); return; }
  /* 拧钥匙要一会儿：站着别动，那东西还在车道上 */
  holdJob(1.6,function(){
    if(S.dead) return;
    if(roamGuardsCar()){ kill('钥匙还插在锁孔里，车窗上就贴上来一张脸。','grip'); return; }
    if(cell!==carRightCell()){
      RT.carTried[cell]=1;
      var n=Object.keys(RT.carTried).length;
      os(pick(['我：钥匙插进去，拧不动。不是这辆。','我：锁孔是对的，钥匙齿不对。下一辆。','我：车门开了一条缝，又自己合上了。不是它。'])+'（试过 '+n+' 辆）',2.6);
      return;
    }
    carDrive();
  });
  os(S.talent==='drive'?'我：我弯下腰去摸方向盘底下的线……':'我：我把钥匙插进锁孔，慢慢地拧……',1.6);
}
function carDrive(){
  RT.carUsed=true; RT.carLeaving=2.0;
  S.enterCool=2.0;
  os('我：引擎着了。车往前冲了出去。',4);
  triggerEnding('car');                       /* 开出去的那一段在 cutscene.js 里演 */
}
function tryFaceRoute(){
  if(!RT.hacked){ os('我：得先进实验楼三楼机房里那间锁着的网络中心，再去行政楼三楼改数据。',3.8); return; }
  if(!RT.data){ os('我：白名单还没改完。',2.6); return; }
  triggerEnding('face');
}
function tryTrashRoute(){
  if(RT.trashFake){ os('我：桶是空的，桶壁上有我自己敲出来的两个凹印。这不是出口——上一次，它把我送回了座位上。',4.4); return; }
  if(S.mode!=='in'||S.room!=='trash1'){ os('我：得先进垃圾房。',2.4); return; }
  var lo=1050,hi=1056;
  if(S.talent==='thin'){ lo=1048; hi=1058; }
  addClue('trash');
  if(S.tsec>=lo&&S.tsec<=hi){ triggerEnding('trash'); return; }
  /* 以前时间不对就直接死，而游戏里没有任何地方告诉你清运时间 */
  if(isNight()){ kill('桶盖合上了。今晚垃圾车不会来。外面有人敲了两下，像在确认里面有没有人。','deep'); return; }
  if(S.tsec>=lo-40&&S.tsec<lo){
    UI.choice('桶盖内侧用记号笔写着：「清运 17:30」。离那时候还有 '+Math.round(lo-S.tsec)+' 分钟。',[
      {label:'钻进去，等',fn:function(){
        UI.closeChoice();
        S.san=Math.max(1,S.san-12);
        var mins=Math.round(lo-S.tsec)+1;
        S.tsec=lo+1;
        try{ timeSkipCard(mins,'在桶里等',S.tsec); }catch(e){}
        setTimeout(function(){ if(!S.dead) triggerEnding('trash'); },900);
      }},
      {label:'先不了',fn:function(){ UI.closeChoice(); }}
    ]);
    return;
  }
  os('我：桶盖内侧用记号笔写着：「清运 17:30」。字是倒着写的，像是从里面写的。',4.4,OS_KEEP);
}
function tryBeastRoute(){
  if(!inToiletHere()||S.room!=='teach1'){ os('我：得在教学楼一楼的厕所里，第三个隔间门口。',2.8); return; }
  if(!inBeastWindow()){
    os(hasSeconds()?'我：门上刻的是 11:45:00 整。现在是 '+fmtClockS(S.tsec)+'。到点了就把东西放下（G）。'
                   :'我：门上刻的是 11:45:00 整——要精确到秒。我得有块带秒针的表。',3.8,OS_KEEP);
    return;
  }
  os('我：就是现在。放下一样东西（G）。',2.6,OS_KEEP);
}
/* 隔间：门上刻着时间（《先辈》的提示），时间对了、东西放过了，敲门就是那条路 */
function useStall(){
  S.spots.stall=1; UI.spotsDirty=true;
  if(RT.beastDrop&&inBeastWindow()&&S.room==='teach1'){ triggerEnding('beast'); return; }
  addClue('stall');
  if(S.room==='teach1'){
    os('我：第三个隔间的门从里面锁着。门板上有人用指甲刻了一行：「11:45:00　放下一样东西」。'+
       (hasSeconds()?'我看了一眼表。':'连秒都刻上了——得有块带秒针的表才行。'),5.6,OS_KEEP);
  }else{
    os('我：隔间的门在里面锁着。门缝底下很暗，暗得不像有地面。',3.4);
  }
}

var DEATH_MESSAGES={};
var DFX_EPI={
  laugh:'你自己也觉得好笑。', gaze:'你终于看清了。', swarm:'它们很轻。',
  water:'你没有挣扎。', shadow:'它等了你一整天。', hand:'那只手是温的。',
  face:'它一直在等你先动。', ring:'圈合上了。正中那个位置，从此有人了。', shatter:'你碎成了很多个自己。每一个都在找回去的路。',
  grip:'好几只手。都很有耐心。', deep:'下面比你想的宽敞。', slit:'缝在你身后合上了。',
  follow:'你跟上得很好。', drown:'你听见有人在岸上喊你的名字。', voice:'你应了一声。',
  bell:'第十三下。', names:'他们等这个名字等了很久。', squeeze:'你比墙软。',
  freeze:'你最后想的是：衣服确实挂得很整齐。', stare:'他们看得太整齐了。',
  chalk:'这一次写的是你的名字。', loop:'走廊没有尽头 —— 因为你一直在同一段里。',
  twin:'他转过来的时候，你正在转过去。', lamps:'灯停在你站的那一格上。',
  neck:'他根本没打算绕路。', mirror:'镜子里那个，先动的手。',
  floor:'下面很宽敞。还有很多张课桌。', wall:'你比墙软。', vignette:'有人替你应了一声"到"。'
};
var DFX_SFX={laugh:'crack',shatter:'crack',grip:'slam',squeeze:'slam',bell:'bell',
  deep:'crack',freeze:'blink',voice:'blink',names:'blink',slit:'door',default:'blink'};
function kill(msg,fx){
  if(typeof DEV!=='undefined'&&DEV.god){ try{ toast('【无敌】挡下了'); }catch(e){} return; }
  if(S.dead||S.death) return;
  if(hasItem('elixir')){ elixirSave(); return; }      /* 不知名药丸：替你死一次 */
  S.dead=true; S.death=fx||'vignette'; S.deadT=0; S.eyeLift=0;
  try{ deathFX(S.death); }catch(e){}
  DEATH_MESSAGES[S.death]=msg;
  var f=document.getElementById('flash');
  f.style.background='#1a0000'; f.style.opacity='0.9';
  setTimeout(function(){ f.style.opacity='0'; f.style.transition='opacity 1.2s'; },40);
  GLR.hurt=0.45;                     /* 以前直接拉满，整屏一层粉，演出本身反而看不清 */
  try{ if(SFX.deathFx) SFX.deathFx(S.death); else SFX.death(); }catch(e){ try{ SFX.death(); }catch(_e){} }
  var _ep=(DFX_EPI[S.death]||'');
  var _hold=(S.death==='neck')?3000:((S.death==='grip'||S.death==='gaze'||S.death==='stare'||S.death==='ring'||S.death==='lamps'||S.death==='follow')?2600:2000);
  /* 预知梦：第一天死掉，会在 11:40 的座位上惊醒（最多三次）。以前只有异象能"差点"，饿死、违规照样直接结束 */
  var wake=(S.diff==='easy'&&S.day===1&&(RT.wakes||0)<3);
  if(!wake) clearSave();                 /* 没有下一次了：不能再读档回来 */
  if(!wake) setTimeout(function(){
    var e2=document.getElementById('dieepi'); if(e2) e2.textContent=_ep;
  },_hold);
  os(msg,2.6,OS_FORCE);
  var _deadId=S.deadId=(S.deadId||0)+1;
  setTimeout(function(){
    if(S.deadId!==_deadId||!S.dead) return;
    if(wake){ dreamWake(); return; }
    var el=document.getElementById('die');
    document.getElementById('diem').textContent=msg;
    el.style.display='flex';
    try{ var rv=document.getElementById('dieRevive'); if(rv) rv.style.display=(typeof DEV!=='undefined'&&DEV.on)?'block':'none'; }catch(e){}
  },_hold);
}

function elixirSave(){
  removeItem('elixir');
  GLR.flash=0.9; GLR.hurt=0.4;
  S.san=Math.max(S.san,45); S.viol=Math.min(S.viol,40);
  try{ if(PAT.state!=='idle') patEnd(null); }catch(e){}
  try{ if(AN.active) anEnd(); }catch(e){}
  try{ if(ROAM.on){ ROAM.stage='wait'; ROAM.waitT=8; ROAM.x=-1e6; ROAM.y=-1e6; ROAM.litAcc=0; } }catch(e){}
  try{ SFX.wake&&SFX.wake(); }catch(e){}
  os('我：……那粒药丸自己在舌根底下化开了。苦得发麻。我还站着——刚才那一下，像是有人替我挨了。',5.2,OS_FORCE);
  toast('不知名药丸 · 救了你一次');
}
function dreamWake(){
  RT.wakes=(RT.wakes||0)+1;
  var left=3-RT.wakes;
  eyelid(700,function(){
    try{ anfxClear(); }catch(e){}
    AN.active=false; AN.id=null; AN.data={}; AN.t=0; AN.acc=0; AN.pre=null; AN.preNext=0; AN.locked=false;
    AN.next=60;
    S.dead=false; S.death=null; S.deadT=0; S.eyeLift=0; S.pitch=0;
    S.tsec=700; S.san=78; S.viol=0; S.stam=100; S.snackT=0; S.tt=0; S.ttTier=0; S.hiddenLatch=false; S.hiddenAsked=false;
    GLR.hurt=0; GLR.flash=0;
    var f=document.getElementById('flash'); if(f){ f.style.transition='none'; f.style.opacity='0'; }
    UI.closeChoice(); PAUSE.on=false; ROAM.on=false;
    OPENDOORS={};                        /* 回到 11:40：开过的门也都关回去了 */
    examEnd();
    try{ patReset(); PAT.next=45; }catch(e){}
    var R1=INTERIORS['teach1'];
    doEnterRoom('teach1',{x:R1.ox+48.5*9, y:R1.oy+6.5*9, ang:-PI/2, seated:true});
    try{ SFX.wake&&SFX.wake(); }catch(e){}
  },function(){
    os('……我猛地抬起头，后背全是汗。11:40。我还坐在自己的位子上。\n刚才那些——是梦吗？可我记得每一条走廊。',5.5,OS_FORCE);
    toast(left>0?'预知梦 · 还能再醒 '+left+' 次':'预知梦 · 下一次，不会再醒了');
    autoSave();
  });
}

var ENDINGS={
  car:  {t:'《闸 门》',  l:['你踩下油门的时候，雨刷自己动了起来。','后视镜里，教学楼的窗户一扇一扇地暗下去，像有人在挨个关灯。','开出校门很远，你才敢看一眼副驾。','那里放着一张学生证。照片上的人，你终于认得了。']},
  face: {t:'《白名单》', l:['闸机「嘀」地亮了一下绿光。','你走出去，回头看了一眼——','里面的天还是黑白的。所有窗口后面都站着一个人，在目送你。','你的名字从那天起，一直留在白名单的最后一行。']},
  /* 假结局：看起来逃出去了，其实又回到了座位上 */
  trash:{t:'《第三个桶》',fake:1,l:['桶盖在头顶合上。','黑暗里，你听见垃圾车发动的声音，越来越远，越来越颠。','车停了很久。有人在外面敲了两下桶壁。','是你自己的声音在问：「里面有人吗？」','……然后，上课铃响了。']},
  beast:{t:'《先 辈》',  l:['门是被从外面撞开的。','你看清了那个背影——穿着很多年前的校服，一直在往外跑。','你跟着他跑了出去。','整座学校，第一次有了颜色。']},
  /* 真结局：自己造一扇门 */
  portal:{t:'《门》',true:1,l:['光圈合上之前，你回头看了一眼。','实验台、显微镜、离心机，还有教室里那一排排低着的头——都在原地，一动不动。','你没有再回头。','门的那一边是一个普通的下午。铃响了，有人在走廊里叫你的名字，你答应了一声。']}
};
function triggerEnding(id){
  if(S.screen==='cut'||S.screen==='end') return;
  RT.end=id;
  var e=ENDINGS[id];
  endMark(id);
  if(!e.fake) clearSave();                    /* 假结局之后还能接着玩 */
  playCut(id,function(){ showEndingCard(id); });
}
function showEndingCard(id){
  var e=ENDINGS[id];
  GLR.flash=0.6;
  setTimeout(function(){ GLR.flash=0; },600);
  var tag=e.fake?'<div style="font-size:11px;letter-spacing:6px;color:#c8a24a">假 结 局</div>':(e.true?'<div style="font-size:11px;letter-spacing:6px;color:#9fe3c2">真 结 局</div>':'');
  var more=e.fake?'<button onclick="fakeWake()" style="font-family:inherit;font-size:12px;letter-spacing:3px;'+
    'padding:11px 36px;background:rgba(20,48,38,.5);color:#cfe9dc;border:1px solid rgba(130,180,155,.5);cursor:pointer">……再睁开眼</button>':'';
  var html='<div id="ends" style="position:fixed;inset:0;z-index:75;display:flex;align-items:center;'+
    'justify-content:center;flex-direction:column;gap:22px;background:rgba(3,5,4,.96);text-align:center">'+tag+
    '<div style="font-size:28px;letter-spacing:14px;color:#cfe9dc">'+e.t+'</div>'+
    '<div style="font-size:14px;line-height:2.4;opacity:.82;max-width:560px">'+e.l.join('<br>')+'</div>'+
    '<div style="font-size:11px;opacity:.4;letter-spacing:2px;margin-top:10px">'+
 '第 '+S.day+' 天 · '+fmtClock(S.tsec)+'</div>'+more+
    '<button onclick="Game.quit()" style="font-family:inherit;font-size:12px;letter-spacing:3px;'+
    'padding:11px 36px;background:transparent;color:#b6d4c5;border:1px solid rgba(130,180,155,.34);'+
    'cursor:pointer;margin-top:8px">回到主菜单</button></div>';
  var d=document.createElement('div');
  d.innerHTML=html;
  document.body.appendChild(d);
  S.screen='end';
}
/* 假结局之后：在第二天的早读醒来，东西都还在；垃圾桶这条路走不通了 */
function fakeWake(){
  var es=document.getElementById('ends'); if(es) es.remove();
  RT.end=null; RT.trashFake=1;
  S.screen='play'; S.dead=false; S.day=Math.max(2,S.day+1); S.tsec=441;
  GLR.worldNorm=0;
  var R1=INTERIORS['teach1'];
  doEnterRoom('teach1',{x:R1.ox+48.5*9, y:R1.oy+6.5*9, ang:-PI/2, seated:true});
  S.seated=true;
  if(running){ lastT=performance.now(); accum=0; }
  os('我：……我在座位上醒过来。早读。衣服上有一股垃圾房的味道。\n那个桶没有把我送出去——它把我送回来了。',6,OS_FORCE);
}
