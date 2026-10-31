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
function fnTick(dt){
  var f=S.fn;
  if(!f||!f.on){if(FN_P.grp)fnPeopleClear();return;}
  if(S.dead||S.screen!=='play') return;
  if(UI.chooseOpen) return;
  if(f.v>=100){
    f.on=false;
    fnPeopleClear();
    kill('你笑得停不下来。笑了很久。','laugh');
    return;
  }
  if(f.left===undefined) f.left=4;
  if(f.left<=0){
    f.on=false;
    try{ fnPeopleClear(); }catch(e){}
    try{ os('我：……天黑了。刚才那些都很正常，正常得不对。',4.6); }catch(e){}
    try{ VisualState.flash=Math.max(VisualState.flash||0,0.35); }catch(e){}
    return;
  }
  if(f.v>72&&!f.shown){
    f.shown=true;
    VisualState.hurt=Math.max(VisualState.hurt||0,0.45);
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
  if(AN.active||Inspection.pending()){os('我：现在走不开，先解决眼前的事。',2.5);return;}
  autoSave();
  os('我：引擎着了。车往前冲了出去。',4);
  playCut('car',function(){CarChase.start();});
}
function tryFaceRoute(){
  if(!RT.hacked){ os('我：得先进实验楼三楼机房里那间锁着的网络中心，再去行政楼三楼改数据。',3.8); return; }
  if(!RT.data){ os('我：白名单还没改完。',2.6); return; }
  if(S.mode!=='out'||dist2(GATE_W.x*SC,GATE_W.y*SC,S.x,S.y)>=70*70){
    os('我：还得去西小门的闸机前。',2.6);return;
  }
  tryGateWest();
}
/* 每局抽三道题并保存顺序和进度；离开后可继续。答错扣一点 SAN，并且换一道没出过的题——
   不能把三个选项挨个试过去。题目是高中各科的基础题。 */
var FACE_WRONG_SAN=4;
var FACE_QUESTIONS=[
  {text:'方程 x² − 5x + 6 = 0 的较大根是多少？',choices:['2','3','6'],answer:1},
  {text:'同时掷两枚均匀六面骰，点数之和不小于 10 的概率是多少？',choices:['1/12','1/6','1/4'],answer:1},
  {text:'等差数列首项为 2、公差为 3，第 8 项是多少？',choices:['20','23','26'],answer:1},
  {text:'函数 y = x² − 4x + 7 的最小值是多少？',choices:['3','4','7'],answer:0},
  {text:'sin 30° + cos 60° 等于多少？',choices:['1/2','1','√3'],answer:1},
  {text:'log₂ 32 等于多少？',choices:['4','5','16'],answer:1},
  {text:'自由落体 2 秒末的速度约是多少？（g 取 10 m/s²）',choices:['10 m/s','20 m/s','40 m/s'],answer:1},
  {text:'1 mol 水（H₂O）的质量约是多少克？',choices:['16','18','20'],answer:1},
  {text:'「先天下之忧而忧，后天下之乐而乐」出自哪一篇？',choices:['《岳阳楼记》','《醉翁亭记》','《出师表》'],answer:0},
  {text:'阻值 6 Ω 和 3 Ω 的两个电阻并联，总电阻是多少？',choices:['2 Ω','4.5 Ω','9 Ω'],answer:0}
];
var FaceChallenge={
  state:function(){
    var q=RT.faceQuiz;
    if(!q||!Array.isArray(q.order)||q.order.length!==3||new Set(q.order).size!==3||
       q.order.some(function(i){return !Number.isInteger(i)||!FACE_QUESTIONS[i];})){
      var pool=FACE_QUESTIONS.map(function(_,i){return i;}),order=[];
      while(order.length<3)order.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
      q=RT.faceQuiz={order:order,done:0,used:order.slice()};autoSave();
    }
    q.done=Number.isInteger(q.done)?clamp(q.done,0,3):0;
    if(!Array.isArray(q.used))q.used=q.order.slice();       /* 旧档没有这一项 */
    return q;
  },
  /* 答错：这一格换成一道没出过的题（题都出完了就留着原题） */
  swap:function(q){
    var left=FACE_QUESTIONS.map(function(_,i){return i;}).filter(function(i){return q.used.indexOf(i)<0&&q.order.indexOf(i)<0;});
    if(!left.length)return;
    var next=left[Math.floor(Math.random()*left.length)];
    q.order[q.done]=next;q.used.push(next);
  },
  open:function(){
    var q=FaceChallenge.state();
    if(q.done>=3){
      UI.choice('闸机亮起绿灯。外面的路安静得出奇。',[
        {label:'通过闸机',fn:function(){triggerEnding('face');}},
        {label:'暂时留下',fn:function(){}}
      ]);return;
    }
    var question=FACE_QUESTIONS[q.order[q.done]],opts=question.choices.map(function(label,i){
      return {label:label,fn:function(){
        if(i===question.answer){q.done++;autoSave();FaceChallenge.open();return;}
        S.san=Math.max(0,S.san-FACE_WRONG_SAN*dif().san);settleSan();
        FaceChallenge.swap(q);autoSave();
        if(S.dead)return;
        os('我：闸机长长地响了一声。屏幕上换了一道题，像是在嫌我慢。',3.2);
        FaceChallenge.open();
      }};
    });
    opts.push({label:'暂时离开',fn:function(){}});
    UI.choice('白名单验证 '+(q.done+1)+'/3：'+question.text,opts);
  }
};
function tryTrashRoute(){
  if(S.mode!=='in'||S.room!=='trash1'){ os('我：得先进垃圾房。',2.4); return; }
  addClue('trash');
  kill('桶盖合上了。外面有人敲了两下，像在确认里面有没有人。','trash');
}
function tryBeastRoute(){
  if(!inToiletHere()||S.room!=='teach1'){ os('我：得在教学楼一楼的厕所里，第三个隔间门口。',2.8); return; }
  useStall();
}
function useStall(){
  S.spots.stall=1; UI.spotsDirty=true;
  if(RT.beastDrop&&S.room==='teach1'){
    UI.choice('门后传来一个声音：「你愿意跟我一起走吗？」',[
      {label:'跟上',fn:function(){triggerEnding('beast');}},
      {label:'先等等',fn:function(){os('我：门后没有再催促。',2.5);}}
    ]);
    return;
  }
  addClue('stall');
  if(S.room==='teach1'){
    os('我：第三个隔间的门从里面锁着。门缝底下很暗，暗得不像有地面。',5.6,OS_KEEP);
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
  floor:'下面很宽敞。还有很多张课桌。', wall:'你比墙软。', vignette:'有人替你应了一声"到"。',
  trash:'外面又敲了两下。这次更近了。'
};
var DFX_SFX={laugh:'crack',shatter:'crack',grip:'slam',squeeze:'slam',bell:'bell',
  deep:'crack',freeze:'blink',voice:'blink',names:'blink',slit:'door',default:'blink'};
/* 反复死在同一种东西上：优先给可读的线索，而不是降低难度（恐怖计划 P2） */
var DEATH_LOG_KEY='wdfz3d_deaths';
var DEATH_HINTS={
  grip:'灯按拍子闪，是它要来了。先找柜子躲好；已经被它盯上，就背对它站着别动。',
  drown:'雨下大了，就往有顶的地方去：屋檐、柱廊、车棚都行。',
  swarm:'蛾群是从一个地方涌过来的。离那里远一点，它们就跟不上。',
  follow:'操场上那些人开始做操的时候，别站在原地看，走远一点。',
  ring:'实验楼地上的粉笔圈，别踩进去；踩到线就马上退出来。',
  neck:'围墙外那个人在等我靠近东边的墙。离墙远一点。',
  twin:'天台另一头那个人，只有在我不看他的时候才会动。',
  floor:'窗台上那只杯子掉下来，是对着我刚才站的地方。听见它掉，就换个地方，或者进楼。',
  names:'坐久了，椅子会留人。该站起来的时候，就站起来。',
  vignette:'撑不住的时候，吃药、吃饭、玩一会儿手机，都能缓过来一点。',
  trash:'垃圾房里那个桶，不是出口。'
};
function deathLogRead(){ try{ return JSON.parse(localStorage.getItem(DEATH_LOG_KEY)||'{}')||{}; }catch(e){ return {}; } }
function deathLogAdd(fx){
  var d=deathLogRead(); d.counts=d.counts||{}; d.counts[fx]=(d.counts[fx]||0)+1;
  d.last=(d.last||[]).concat([{fx:fx,day:S.day,where:S.mode==='in'?S.room:'out'}]).slice(-12);
  try{ localStorage.setItem(DEATH_LOG_KEY,JSON.stringify(d)); }catch(e){}
}
/* 死过两次以上、而且有对应线索的死法，最多三条，最近的在前 */
function deathHints(){
  var d=deathLogRead(), c=d.counts||{}, out=[], seen={}, i;
  var order=(d.last||[]).slice().reverse().map(function(e){ return e.fx; });
  for(i=0;i<order.length&&out.length<3;i++){
    var fx=order[i]; if(seen[fx]) continue; seen[fx]=1;
    if((c[fx]||0)>=2&&DEATH_HINTS[fx]) out.push(DEATH_HINTS[fx]);
  }
  return out;
}
function kill(msg,fx){
  if(typeof DEV!=='undefined'&&DEV.god){ try{ toast('【无敌】挡下了'); }catch(e){} return; }
  if(S.dead||S.death) return;
  if(hasItem('elixir')){ elixirSave(); return; }      /* 不知名药丸：替你死一次 */
  if(S.talent==='immune'&&!S.immuneUsed){ immuneSave(); return; }
  S.deathView={ang:S.ang,pitch:S.pitch,eyeLift:S.eyeLift||0};
  S.dead=true; S.death=fx||'vignette'; S.deadT=0; S.eyeLift=0;
  try{ deathLogAdd(S.death); }catch(e){}
  if(typeof Inspection!=='undefined')Inspection.cancel();
  if(typeof Elevator!=='undefined')Elevator.cancel();
  if(typeof CarChase!=='undefined'&&RT.carChase)CarChase.cancel();
  try{ deathFX(S.death); }catch(e){}
  DEATH_MESSAGES[S.death]=msg;
  var f=document.getElementById('flash');
  f.style.background='#1a0000'; f.style.opacity='0.9';
  setTimeout(function(){ f.style.opacity='0'; f.style.transition='opacity 1.2s'; },40);
  VisualState.hurt=0.45;                     /* 以前直接拉满，整屏一层粉，演出本身反而看不清 */
  try{ if(SFX.deathFx) SFX.deathFx(S.death); else SFX.death(); }catch(e){ try{ SFX.death(); }catch(_e){} }
  var _ep=(DFX_EPI[S.death]||'');
  var _hold=DeathTimeline.duration(S.death)*1000;
  /* 预知梦：第一天死掉，会在 11:40 的座位上惊醒（最多三次）。以前只有异象能"差点"，饿死、违规照样直接结束 */
  var wake=(S.diff==='easy'&&S.day===1&&(RT.wakes||0)<3);
  if(!wake) clearSave();                 /* 没有下一次了：不能再读档回来 */
  var _deadId=S.deadId=(S.deadId||0)+1, finished=false;
  /* 演出放完（或被跳过）只收一次：墓志铭、死亡界面或预知梦惊醒。旧的一次死亡被复活取消后不会再写回来 */
  function finish(){
    if(finished||S.deadId!==_deadId||!S.dead) return;
    finished=true; if(DEATH_PENDING&&DEATH_PENDING.id===_deadId) DEATH_PENDING=null;
    if(wake){ dreamWake(); return; }
    var e2=document.getElementById('dieepi'); if(e2) e2.textContent=_ep;
    var el=document.getElementById('die');
    document.getElementById('diem').textContent=msg;
    el.style.display='flex';
    try{ var rv=document.getElementById('dieRevive'); if(rv) rv.style.display=(typeof DEV!=='undefined'&&DEV.on)?'block':'none'; }catch(e){}
  }
  DEATH_PENDING={id:_deadId,finish:finish,at:performance.now()};
  os(msg,2.6,OS_FORCE);
  setTimeout(finish,_hold);
}
/* 死亡演出可以跳过：至少看 0.6 秒（避免本来想点别的、一下子把整段跳没了），之后点一下或按空格 / 回车直接到结果 */
var DEATH_PENDING=null;
function deathSkip(){
  if(!DEATH_PENDING||!S.dead) return false;
  if(performance.now()-DEATH_PENDING.at<600) return false;
  DEATH_PENDING.finish(); return true;
}

function elixirSave(){
  removeItem('elixir');
  survivalReset();
  os('我：……那粒药丸自己在舌根底下化开了。苦得发麻。我还站着——刚才那一下，像是有人替我挨了。',5.2,OS_FORCE);
  toast('不知名药丸 · 救了你一次');
}
function immuneSave(){
  S.immuneUsed=true;
  survivalReset();
  os('我：刚才那一下本该要了我的命。可它擦身而过，像是没有认出我。',5.2,OS_FORCE);
  toast('天生免疫 · 挡下了一次致命事件');
}
function survivalReset(){
  VisualState.flash=0.9; VisualState.hurt=0.4;
  S.san=Math.max(S.san,45); S.viol=Math.min(S.viol,40);
  try{ if(PAT.state!=='idle') patEnd(null); }catch(e){}
  try{ if(AN.active) anEnd(); }catch(e){}
  try{ if(ROAM.on){ ROAM.stage='wait'; ROAM.waitT=8; ROAM.x=-1e6; ROAM.y=-1e6; ROAM.litAcc=0; } }catch(e){}
  try{ SFX.wake&&SFX.wake(); }catch(e){}
}
function dreamWake(){
  RT.wakes=(RT.wakes||0)+1;
  var left=3-RT.wakes;
  eyelid(700,function(){
    try{ anfxClear(); }catch(e){}
    AN.active=false; AN.id=null; AN.data={}; AN.t=0; AN.acc=0; AN.pre=null; AN.preNext=0; AN.locked=false;
    AN.next=60;
    S.dead=false; S.death=null; S.deadT=0; S.eyeLift=0; S.pitch=0;S.deathView=null;
    S.tsec=700; S.san=78; S.viol=0; S.stam=100; S.snackT=0; S.tt=0; S.ttTier=0; S.hiddenLatch=false; S.hiddenAsked=false;
    VisualState.hurt=0; VisualState.flash=0;
    var f=document.getElementById('flash'); if(f){ f.style.transition='none'; f.style.opacity='0'; }
    UI.closeChoice(); PAUSE.on=false; ROAM.on=false;
    OPENDOORS={};                        /* 回到 11:40：开过的门也都关回去了 */
    examEnd();
    try{ patReset(); PAT.next=45; }catch(e){}
    var R1=INTERIORS['teach1'];
    doEnterRoom('teach1',{x:R1.ox+48.5*9, y:R1.oy+6.5*9, ang:-PI/2, seated:true});
    try{ SFX.wake&&SFX.wake(); }catch(e){}
  },function(){
    os('……我猛地抬起头，后背全是汗。我还坐在自己的位子上。\n刚才那些——是梦吗？可我记得每一条走廊。',5.5,OS_FORCE);
    toast(left>0?'预知梦 · 还能再醒 '+left+' 次':'预知梦 · 下一次，不会再醒了');
    autoSave();
  });
}

var ENDINGS={
  car:  {t:'《闸 门》', true:1,l:['你踩下油门的时候，雨刷自己动了起来。','后视镜里，教学楼的窗户一扇一扇地暗下去，像有人在挨个关灯。','开出校门很远，你才敢看一眼副驾。','那里放着一张学生证。照片上的人，你终于认得了。']},
  face: {t:'《白名单》', true:1,l:['闸机「嘀」地亮了一下绿光。','你走出去，回头看了一眼——','里面的天还是黑白的。所有窗口后面都站着一个人，在目送你。','你的名字从那天起，一直留在白名单的最后一行。']},
  /* 假结局：看起来逃出去了，其实又回到了座位上 */
  trash:{t:'《第三个桶》',fake:1,l:['桶盖在头顶合上。','黑暗里，你听见垃圾车发动的声音，越来越远，越来越颠。','车停了很久。有人在外面敲了两下桶壁。','是你自己的声音在问：「里面有人吗？」','……然后，上课铃响了。']},
  beast:{t:'《先 辈》',  l:['门是被从外面撞开的。','你看清了那个背影——穿着很多年前的校服，一直在往外跑。','你跟着他跑了出去。','整座学校，第一次有了颜色。']},
  /* 真结局：自己造一扇门 */
  portal:{t:'《门》',true:1,l:['光圈合上之前，你回头看了一眼。','实验台、显微镜、离心机，还有教室里那一排排低着的头——都在原地，一动不动。','你没有再回头。','门的那一边是一个普通的下午。铃响了，有人在走廊里叫你的名字，你答应了一声。']}
};
function triggerEnding(id,skipCut){
  if(S.screen==='cut'||S.screen==='end') return;
  if(id==='trash'){tryTrashRoute();return;}
  RT.end=id;
  var e=ENDINGS[id];
  endMark(id);
  if(!e.fake) clearSave();                    /* 假结局之后还能接着玩 */
  if(skipCut)showEndingCard(id);else playCut(id,function(){ showEndingCard(id); });
}
function showEndingCard(id){
  var e=ENDINGS[id];
  VisualState.flash=0.6;
  setTimeout(function(){ VisualState.flash=0; },600);
  /* 结局卡：样式在 game.css（#ends），和死亡、暂停同一套档案式界面 */
  var tag=e.fake?'<div class="etag fake">假 结 局</div>':(e.true?'<div class="etag">真 结 局</div>':'');
  var more=e.fake?'<button type="button" class="ewake" onclick="fakeWake()">……再睁开眼</button>':'';
  var html='<div id="ends">'+tag+
    '<div class="et">'+e.t+'</div>'+
    '<div class="el">'+e.l.join('<br>')+'</div>'+
    '<div class="emeta">第 '+S.day+' 天'+(hasClock()?' · '+fmtClock(S.tsec):'')+'</div>'+more+
    '<button type="button" class="equit" onclick="Game.quit()">回到主菜单</button></div>';
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
  VisualState.worldNorm=0;
  var R1=INTERIORS['teach1'];
  doEnterRoom('teach1',{x:R1.ox+48.5*9, y:R1.oy+6.5*9, ang:-PI/2, seated:true});
  S.seated=true;
  if(running){ lastT=performance.now(); accum=0; }
  os('我：……我在座位上醒过来。早读。衣服上有一股垃圾房的味道。\n那个桶没有把我送出去——它把我送回来了。',6,OS_FORCE);
}
