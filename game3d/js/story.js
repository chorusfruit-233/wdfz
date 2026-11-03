/* @module-capsule */
(function($imports){
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
  if($imports.S.spots[id]) return;
  var sp=null;
  for(var i=0;i<SPOTS.length;i++) if(SPOTS[i].id===id) sp=SPOTS[i];
  if(!sp) return;
  $imports.S.spots[id]=1;
  (0,$imports.os)('我：（记下了「'+sp.n+'」）',3);
  $imports.UI.spotsDirty=true;
}
function spotTick(){
  if($imports.S.mode==='in'){
    var R=$imports.INTERIORS[$imports.S.room], ids=R&&SPOT_ROOM[R.host];
    if(ids) for(var k=0;k<ids.length;k++) spotMark(ids[k]);
    if(R&&R.host==='teach'&&(0,$imports.inToiletHere)()) spotMark('stall');   /* 隔间那条路只在教学楼 */
    return;
  }
  for(var i=0;i<SPOTS.length;i++){
    var sp=SPOTS[i];
    if($imports.S.spots[sp.id]||SPOT_INDOOR_ONLY[sp.id]) continue;
    var mx=$imports.S.x/$imports.SC,my=$imports.S.y/$imports.SC;
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
    if(!$imports.S.spots[it.need]) continue;
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
  if($imports.S.mode!=='in'||!$imports.S.room) return 'out';
  var R=$imports.INTERIORS[$imports.S.room]; if(!R) return 'out';
  if(R.id==='canteen1') return 'canteen';
  if(R.host==='dormN'||R.host==='dormS') return 'dorm';
  if(R.host==='admin') return 'admin';
  if(R.host==='lab') return 'lab';
  if(R.host==='teach') return 'teach';
  return 'out';
}
function fnTick(dt){
  var f=$imports.S.fn;
  if(!f||!f.on){if($imports.FN_P.grp)(0,$imports.fnPeopleClear)();return;}
  if($imports.S.dead||$imports.S.screen!=='play') return;
  if($imports.UI.chooseOpen) return;
  if(f.v>=100){
    f.on=false;
    (0,$imports.fnPeopleClear)();
    kill('你笑得停不下来。笑了很久。','laugh','laugh');
    return;
  }
  if(f.left===undefined) f.left=4;
  if(f.left<=0){
    f.on=false;
    try{ (0,$imports.fnPeopleClear)(); }catch(e){}
    try{ (0,$imports.os)('我：……天黑了。刚才那些都很正常，正常得不对。',4.6); }catch(e){}
    try{ $imports.VisualState.flash=Math.max($imports.VisualState.flash||0,0.35); }catch(e){}
    return;
  }
  if(f.v>72&&!f.shown){
    f.shown=true;
    $imports.VisualState.hurt=Math.max($imports.VisualState.hurt||0,0.45);
    (0,$imports.os)('我：……刚才那些，我是不是笑得太大声了。',4.4);
  }
  try{ (0,$imports.fnPeopleTick)(); }catch(e){}
  var tag=fnWhereNow(), pool=[], pi;
  f.used=f.used||{};
  for(pi=0;pi<FN_EVENTS.length;pi++){
    if(f.used[pi]) continue;
    var wz=FN_EVENTS[pi].where;
    if(wz.indexOf('any')>=0||wz.indexOf(tag)>=0) pool.push(pi);
  }
  if(!pool.length) return;
  if($imports.Inspection.quiet())return;
  f.next-=dt;
  if(f.next>0) return;
  f.next=22+$imports.GameRandom.next()*12;
  var pick=pool[Math.floor($imports.GameRandom.next()*pool.length)];
  f.used[pick]=1; f.n++;
  f.left=Math.max(0,(f.left===undefined?4:f.left)-1);
  var e=FN_EVENTS[pick];
  try{ $imports.SFX.click(); }catch(err){}
  $imports.UI.choice('看起来是——\n'+e.seen,[
    {label:'笑一下', fn:function(){
      $imports.UI.closeChoice(); f.v+=14;
      (0,$imports.os)('其实——'+e.real,4.6);
      try{ (0,$imports.toast)('（你笑出了声）'); }catch(err){}
    }},
    {label:'不笑，装作没这回事', fn:function(){
      $imports.UI.closeChoice(); f.v+=5;
      (0,$imports.os)('其实——'+e.real,4.6);
      try{ (0,$imports.toast)('（你忍住了）'); }catch(err){}
    }}
  ]);
}

function chooseIdea(id){
  var it=null,i;
  for(i=0;i<IDEAS.length;i++) if(IDEAS[i].id===id) it=IDEAS[i];
  if(!it) return;
  $imports.UI.close('think');
  if(it.route&&it.route.indexOf('trap_')===0){
    /* 以前在哪里选都会立刻触发；现在得真的站在那个地方 */
    var where=trapWhere(it.route);
    if(where){ (0,$imports.os)(where,3.0); return; }
    $imports.UI.choice('「'+it.n+'」——真的要这么做吗？',[
      {label:'再想想',fn:function(){ $imports.UI.closeChoice(); }},
      {label:'就这么办',fn:function(){
        $imports.UI.closeChoice();
        if(it.route==='trap_out') kill('你从门缝里挤了出去。外面是一条很长的马路，路尽头有一扇校门。你走进去——衣服上还有雨，教学楼里，铃刚刚响。','slit','trap_out');
        else if(it.route==='trap_wall') kill('你翻上了墙头。墙外面还有一道墙。再外面，还有一道。你一直翻，翻到手指不再是手指的形状。','squeeze','trap_wall');
        else kill('路过的那个人停了下来。他慢慢转过头——他没有脸，只有一个很大的、在笑的洞。然后他从墙里直接走了进来。','face','trap_beg');
      }}
    ]);
    return;
  }
  if(it.route==='car'){ tryCarRoute(); return; }
  if(it.route==='face'){ tryFaceRoute(); return; }
  if(it.route==='trash'){ tryTrashRoute(); return; }
  if(it.route==='beast'){ tryBeastRoute(); return; }
  if(it.route==='portal'){ (0,$imports.tryPortalRoute)(); return; }
}

/* 陷阱路线要在对应地点才能执行：返回 null 表示人在地方，否则返回提示 */
function trapWhere(route){
  var mx=$imports.S.x/$imports.SC, my=$imports.S.y/$imports.SC, out=($imports.S.mode==='out');
  if(route==='trap_out') return (out&&Math.hypot(mx-$imports.GATE_N.x,my-$imports.GATE_N.y)<60)?null:'我：正门在北边。要走，得先走到北门的闸机前面。';
  if(route==='trap_wall'){
    var sp=SPOTS.filter(function(s){ return s.id==='climb'; })[0];
    return (out&&sp&&mx>sp.x-20&&mx<sp.x+sp.w+20&&my>sp.y-20&&my<sp.y+sp.h+20)?null:'我：得先到车棚后面那段矮墙（攀爬点）去。';
  }
  return (out&&mx>$imports.BOUND.x1-70)?null:'我：得先走到东边的围墙底下。';
}
function tryCarRoute(){
  if(!$imports.Talent.capability('car').ok){ (0,$imports.os)('我：我没有钥匙。',2.6); return; }
  if($imports.S.mode!=='in'||$imports.S.room!=='garage1'){ (0,$imports.os)('我：得先下到车库去。',2.6); return; }
  (0,$imports.os)('我：牌号对得上的那两辆，油表不是零。',4);
}
/* 能开的那一辆：离入口最远的 8 辆里随机挑一辆（每局不同，存在 RT 里） */
function carRightCell(){
  if($imports.RT.carRight) return $imports.RT.carRight;
  var R=$imports.INTERIORS.garage1, cars=[], r, c;
  for(r=0;r<R.rows;r++) for(c=0;c<R.cols;c++) if(R.grid[r][c]==='V') cars.push([c,r]);
  cars.sort(function(a,b){ return a[0]-b[0]; });        /* 入口在东头：列号小的离得远 */
  var far=cars.slice(0,Math.max(1,Math.floor(cars.length/2)));
  var chosen=far[Math.floor($imports.GameRandom.next()*far.length)];
  $imports.RT.carRight=chosen[0]+':'+chosen[1];
  return $imports.RT.carRight;
}
function useCar(cx,cy){
  var cap=$imports.Talent.capability('car');
  if(!cap.ok){ (0,$imports.os)('我：车门锁着。',2.4); return; }
  if($imports.RT.carUsed){ (0,$imports.os)('我：已经开过一辆了。',2.4); return; }
  if((0,$imports.roamGuardsCar)()){
    kill('你拉开车门，钻进去，摸到钥匙孔。后视镜里，它就站在后座上，弯着腰，脸贴着车顶。','grip','car_entry');
    return;
  }
  var cell=cx+':'+cy;
  $imports.RT.carTried=$imports.RT.carTried||{};
  if($imports.RT.carTried[cell]){ (0,$imports.os)('我：这辆试过了。不是它。',1.8); return; }
  /* 拧钥匙要一会儿：站着别动，那东西还在车道上。搭线（车感好、没钥匙）要更久 */
  var wire=cap.via==='hotwire';
  (0,$imports.holdJob)(cap.sec,function(){
    if($imports.S.dead) return;
    if((0,$imports.roamGuardsCar)()){ kill(wire?'我还蹲在方向盘底下捏着两根线，车窗上就贴上来一张脸。':'钥匙还插在锁孔里，车窗上就贴上来一张脸。','grip','car_entry'); return; }
    if(cell!==carRightCell()){
      $imports.RT.carTried[cell]=1;
      $imports.Investigation.record('vehicle:'+cell,$imports.Investigation.carName(cx,cy)+(wire?'：已试，搭线打不着。':'：已试，钥匙不匹配。'),'验证','车库');
      (0,$imports.autoSave)();
      var n=Object.keys($imports.RT.carTried).length;
      (0,$imports.os)((0,$imports.pick)(wire?['我：线碰上了，仪表盘一点反应都没有。不是这辆。','我：电瓶是死的。下一辆。','我：火花跳了一下就没了。不是它。']
                  :['我：钥匙插进去，拧不动。不是这辆。','我：锁孔是对的，钥匙齿不对。下一辆。','我：车门开了一条缝，又自己合上了。不是它。'])+'（试过 '+n+' 辆）',2.6);
      return;
    }
    carDrive();
  });
  (0,$imports.os)(wire?'我：我弯下腰去摸方向盘底下的线……这要一会儿。':'我：我把钥匙插进锁孔，慢慢地拧……',cap.sec);
}
function carDrive(){
  if($imports.AN.active||$imports.Inspection.pending()){(0,$imports.os)('我：现在走不开，先解决眼前的事。',2.5);return;}
  (0,$imports.autoSave)();
  (0,$imports.os)('我：引擎着了。车往前冲了出去。',4);
  (0,$imports.playCut)('car',function(){$imports.CarChase.start();});
}
function tryFaceRoute(){
  if(!$imports.RT.hacked){ (0,$imports.os)('我：得先进实验楼三楼机房里那间锁着的网络中心，再去行政楼三楼改数据。',3.8); return; }
  if(!$imports.RT.data){ (0,$imports.os)('我：白名单还没改完。',2.6); return; }
  if($imports.S.mode!=='out'||(0,$imports.dist2)($imports.GATE_W.x*$imports.SC,$imports.GATE_W.y*$imports.SC,$imports.S.x,$imports.S.y)>=70*70){
    (0,$imports.os)('我：还得去西小门的闸机前。',2.6);return;
  }
  (0,$imports.tryGateWest)();
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
var FACE_EXPLANATIONS=[
  '分解为 (x−2)(x−3)=0，较大根是 3。',
  '满足条件的点数有 6 种，共 36 种等可能结果，所以是 1/6。',
  '第 8 项是 2+(8−1)×3=23。',
  '配方得到 (x−2)²+3，最小值是 3。',
  'sin 30° 和 cos 60° 都是 1/2，相加为 1。',
  '2 的 5 次方是 32，因此结果为 5。',
  '由 v=gt 得 10×2=20 m/s。',
  '两个氢加一个氧：2×1+16=18 g/mol。',
  '这是范仲淹《岳阳楼记》中的句子。',
  '并联电阻满足 1/R=1/6+1/3=1/2，所以是 2 Ω。'
];
var FaceChallenge={
  state:function(){
    var q=$imports.RT.faceQuiz;
    if(!q||!Array.isArray(q.order)||q.order.length!==3||new Set(q.order).size!==3||
       q.order.some(function(i){return !Number.isInteger(i)||!FACE_QUESTIONS[i];})){
      var pool=FACE_QUESTIONS.map(function(_,i){return i;}),order=[];
      while(order.length<3)order.push(pool.splice(Math.floor($imports.GameRandom.next()*pool.length),1)[0]);
      q=$imports.RT.faceQuiz={order:order,done:0,used:order.slice()};(0,$imports.autoSave)();
    }
    q.done=Number.isInteger(q.done)?(0,$imports.clamp)(q.done,0,3):0;
    if(!Array.isArray(q.used))q.used=q.order.slice();       /* 旧档没有这一项 */
    return q;
  },
  /* 答错：这一格换成一道没出过的题（题都出完了就留着原题） */
  swap:function(q){
    var left=FACE_QUESTIONS.map(function(_,i){return i;}).filter(function(i){return q.used.indexOf(i)<0&&q.order.indexOf(i)<0;});
    if(!left.length)return;
    var next=left[Math.floor($imports.GameRandom.next()*left.length)];
    q.order[q.done]=next;q.used.push(next);
  },
  open:function(){
    var q=FaceChallenge.state();
    if(q.done>=3){
      $imports.UI.choice('闸机亮起绿灯。外面的路安静得出奇。',[
        {label:'通过闸机',fn:function(){$imports.Speedrun.proof('face');triggerEnding('face');}},
        {label:'暂时留下',fn:function(){}}
      ]);return;
    }
    var questionId=q.order[q.done],question=FACE_QUESTIONS[questionId],opts=question.choices.map(function(label,i){
      return {label:label,fn:function(){
        if(i===question.answer){q.done++;(0,$imports.autoSave)();FaceChallenge.open();return;}
        var remedy=$imports.Talent.faceRemedy(), loss=remedy?0:FACE_WRONG_SAN*(0,$imports.dif)().san;   /* 编程社（规则 2）：第一次答错核对后台，不扣这一次 */
        $imports.PlayerStats.changeSan(-loss,'face-answer',{min:0});(0,$imports.settleSan)();
        var feedback=FACE_EXPLANATIONS[questionId];
        $imports.Investigation.record('face:'+questionId,feedback,'验证','西小门 · 验证反馈');
        FaceChallenge.swap(q);(0,$imports.autoSave)();
        if($imports.S.dead)return;
        $imports.UI.choice((remedy?'验证未通过。你对照门禁后台核了一遍，这次没有扣到你（编程社，只有一次）。':'验证未通过（SAN −'+loss+'）。')+feedback+' 已通过的题目仍然保留。',[
          {label:'继续验证',fn:function(){FaceChallenge.open();}},
          {label:'先离开',fn:function(){}}
        ]);
      }};
    });
    opts.push({label:'暂时离开',fn:function(){}});
    $imports.UI.choice('白名单验证 '+(q.done+1)+'/3：'+question.text,opts);
  }
};
function tryTrashRoute(){
  if($imports.S.mode!=='in'||$imports.S.room!=='trash1'){ (0,$imports.os)('我：得先进垃圾房。',2.4); return; }
  (0,$imports.addClue)('trash');
  kill('桶盖合上了。外面有人敲了两下，像在确认里面有没有人。','trash','trash');
}
function tryBeastRoute(){
  if(!(0,$imports.inToiletHere)()||$imports.S.room!=='teach1'){ (0,$imports.os)('我：得在教学楼一楼的厕所里，第三个隔间门口。',2.8); return; }
  useStall();
}
function useStall(){
  $imports.S.spots.stall=1; $imports.UI.spotsDirty=true;
  if($imports.RT.beastDrop&&$imports.S.room==='teach1'){
    $imports.UI.choice('门后传来一个声音：「你愿意跟我一起走吗？」',[
      {label:'跟上',fn:function(){$imports.Speedrun.proof('beast');triggerEnding('beast');}},
      {label:'先等等',fn:function(){(0,$imports.os)('我：门后没有再催促。',2.5);}}
    ]);
    return;
  }
  (0,$imports.addClue)('stall');
  if($imports.S.room==='teach1'){
    (0,$imports.os)('我：第三个隔间的门从里面锁着。门缝底下很暗，暗得不像有地面。',5.6,$imports.OS_KEEP);
  }else{
    (0,$imports.os)('我：隔间的门在里面锁着。门缝底下很暗，暗得不像有地面。',3.4);
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
var DEATH_SOURCES={
  patrol:{cause:'巡察者追到了你；灯光与脚步是它进入区域的信号。',hint:'灯按拍子闪时先找遮蔽。被锁定后尽快脱离它的视线；当着它的面钻进柜子会被记住。'},
  garage:{cause:'你与车道上的黑影接触了。',hint:'车库的黑影能被手电持续照射暂时逼退，也会被落地的硬币引开。先观察距离再穿过车道。'},
  car_entry:{cause:'试车门时，车库黑影仍守在车辆附近。',hint:'拉车门需要原地停留。先照退或引开车道上的黑影，确认车旁安全再拧钥匙。'},
  car_chase:{cause:'驾驶中的路障、岔路或追兵使这次逃离中断。',hint:'路口前看路牌并提前转向。可以向后拉摇杆或按 S 刹车；长时间停下会让追兵靠近。'},
  san:{cause:'你的理智已经耗尽；此前的危险与消耗累积到了极限。',hint:'留意呼吸和画面变化。恢复前先离开危险区域，再选择吃饭、药片或其他恢复活动。'},
  assimilation:{cause:'同化到达了极限。长期按要求坐着也有代价。',hint:'一直留在座位上会逐渐同化。安排离座探索，别只依赖上课恢复。'},
  trash:{cause:'那个垃圾桶是陷阱，合上的桶盖没有通向外面。',hint:'垃圾桶不能带你逃离学校；找其他有证据支持的办法。'}
};
var DEATH_HINTS={
  grip:'灯按拍子闪，是它要来了。先找柜子躲好；被盯上后应绕过遮挡离开视线，普通追踪会跟丢；登记后缺席引起的永久追踪不会。',
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
function deathLogAdd(fx,source){
  var d=deathLogRead(); d.counts=d.counts||{}; d.counts[fx]=(d.counts[fx]||0)+1;
  d.sources=d.sources||{};if(source)d.sources[source]=(d.sources[source]||0)+1;
  d.last=(d.last||[]).concat([{fx:fx,source:source||null,day:$imports.S.day,where:$imports.S.mode==='in'?$imports.S.room:'out'}]).slice(-12);
  try{ localStorage.setItem(DEATH_LOG_KEY,JSON.stringify(d)); }catch(e){}
}
/* 死过两次以上、而且有对应线索的死法，最多三条，最近的在前 */
function deathHints(){
  var d=deathLogRead(), c=d.counts||{}, out=[], seen={}, i;
  var order=(d.last||[]).slice().reverse();
  for(i=0;i<order.length&&out.length<3;i++){
    var entry=order[i],source=entry.source,fx=entry.fx,key=source||fx;
    if(seen[key])continue;seen[key]=1;
    if(source&&DEATH_SOURCES[source]){if((d.sources||{})[source]>=2)out.push(DEATH_SOURCES[source].hint);}
    else if(fx!=='grip'&&(source?(d.sources||{})[source]:c[fx]||0)>=2&&DEATH_HINTS[fx])out.push(DEATH_HINTS[fx]);
  }
  return out;
}
function kill(msg,fx,source){
  if(typeof $imports.DEV!=='undefined'&&$imports.DEV.god){ try{ (0,$imports.toast)('【无敌】挡下了'); }catch(e){} return; }
  if($imports.S.dead||$imports.S.death||$imports.S.screen==='cut'||$imports.S.screen==='end') return;
  if((0,$imports.hasItem)('elixir')){ elixirSave(); protectCommit(); return; }      /* 不知名药丸：替你死一次 */
  if($imports.Talent.tryPreventDeath()){ immuneSave(); protectCommit(); return; }
  var deathScope=$imports.Lifecycle.renew('death');
  $imports.S.deathView={ang:$imports.S.ang,pitch:$imports.S.pitch,eyeLift:$imports.S.eyeLift||0};
  $imports.Termination.cancel();$imports.PHONE.stop();$imports.TerminalUI.close();
  $imports.S.dead=true; $imports.S.death=fx||'vignette'; $imports.S.deadT=0; $imports.S.eyeLift=0;
  $imports.Playtest.event('死亡',source||$imports.S.death);
  var _arc=null; try{ _arc=$imports.DeathArchive.record(source,$imports.S.death); }catch(e){}   /* 死亡档案：这种死法第一次发生时解锁，演出放完再提示（先于死亡日志，免得把这一次当成旧记录迁进去） */
  try{ deathLogAdd($imports.S.death,source); }catch(e){}
  var cause=DEATH_SOURCES[source];
  if(cause)$imports.Investigation.record('failure:'+source,cause.cause,'验证','刚才的经历');
  if(typeof $imports.Inspection!=='undefined')$imports.Inspection.cancel();
  if(typeof $imports.Elevator!=='undefined')$imports.Elevator.cancel();
  if(typeof $imports.CarChase!=='undefined'&&$imports.RT.carChase)$imports.CarChase.cancel();
  try{ (0,$imports.deathFX)($imports.S.death); }catch(e){}
  DEATH_MESSAGES[$imports.S.death]=msg;
  var f=document.getElementById('flash');
  deathScope.own(function(){f.style.opacity='0';});
  f.style.background='#1a0000'; f.style.opacity='0.9';
  deathScope.timeout(function(){ f.style.opacity='0'; f.style.transition='opacity 1.2s'; },40);
  $imports.VisualState.hurt=0.45;                     /* 以前直接拉满，整屏一层粉，演出本身反而看不清 */
  try{ if($imports.SFX.deathFx) $imports.SFX.deathFx($imports.S.death); else $imports.SFX.death(); }catch(e){ try{ $imports.SFX.death(); }catch(_e){} }
  var _ep=(DFX_EPI[$imports.S.death]||'');
  var _hold=$imports.DeathTimeline.duration($imports.S.death)*1000;
  /* 预知梦：第一天死掉，会在 11:40 的座位上惊醒（最多三次）。以前只有异象能"差点"，饿死、违规照样直接结束 */
  var wake=($imports.S.diff==='easy'&&$imports.S.day===1&&($imports.RT.wakes||0)<3);
  if(!wake) (0,$imports.clearSave)();                 /* 没有下一次了：不能再读档回来 */
  var _sr=null; if(!wake){ try{ _sr=$imports.Speedrun.fail('failed',source||$imports.S.death); }catch(e){} }   /* 速通：死透了就停表、记未通关 */
  var _deadId=$imports.S.deadId=($imports.S.deadId||0)+1, finished=false;
  /* 演出放完（或被跳过）只收一次：墓志铭、死亡界面或预知梦惊醒。旧的一次死亡被复活取消后不会再写回来 */
  function finish(){
    if(finished||$imports.S.deadId!==_deadId||!$imports.S.dead) return;
    finished=true;deathScope.cancel(); if(DEATH_PENDING&&DEATH_PENDING.id===_deadId) DEATH_PENDING=null;
    try{ $imports.DeathArchive.notify(_arc); }catch(e){}
    if(wake){ dreamWake(); return; }
    var e2=document.getElementById('dieepi'); if(e2) e2.textContent=_ep;
    var el=document.getElementById('die');
    document.getElementById('diem').textContent=msg;
    document.getElementById('diecause').textContent=cause?cause.cause:'';
    var _dsr=document.getElementById('diesr'); if(_dsr){ _dsr.textContent=$imports.Speedrun.dieText(_sr); _dsr.hidden=!_sr; }
    el.style.display='flex';
    try{ var rv=document.getElementById('dieRevive'); if(rv) rv.style.display=(typeof $imports.DEV!=='undefined'&&$imports.DEV.on)?'block':'none'; }catch(e){}
  }
  DEATH_PENDING={id:_deadId,finish:finish,at:performance.now()};
  (0,$imports.os)(msg,2.6,$imports.OS_FORCE);
  deathScope.timeout(finish,_hold);
}
/* 死亡演出可以跳过：至少看 0.6 秒（避免本来想点别的、一下子把整段跳没了），之后点一下或按空格 / 回车直接到结果 */
var DEATH_PENDING=null;
function deathSkip(){
  if(!DEATH_PENDING||!$imports.S.dead) return false;
  if(performance.now()-DEATH_PENDING.at<600) return false;
  DEATH_PENDING.finish(); return true;
}

function elixirSave(){
  (0,$imports.removeItem)('elixir');
  survivalReset();
  (0,$imports.os)('我：……那粒药丸自己在舌根底下化开了。苦得发麻。我还站着——刚才那一下，像是有人替我挨了。',5.2,$imports.OS_FORCE);
  (0,$imports.toast)('不知名药丸 · 救了你一次');
}
/* 保命用掉以后要立刻落盘（以前没在跑异象时只改了内存，刷新就把免疫「退」回来了）。
   不在这里直接存：调用方后面还要把来源恢复完（驾驶回检查点、同化回落），这一轮同步代码跑完再存完整快照 */
var PROTECT_SAVE=0;
function protectCommit(){
  if(PROTECT_SAVE) return;
  PROTECT_SAVE=1;
  Promise.resolve().then(function(){
    PROTECT_SAVE=0;
    if($imports.S.screen!=='play'||$imports.S.dead) return;
    try{ (0,$imports.saveGame)(); }catch(e){ try{ (0,$imports.toast)('本次变化尚未保存'); }catch(_e){} }
  });
}
function immuneSave(){
  $imports.Playtest.event('天赋生效','immune');
  survivalReset();
  (0,$imports.os)('我：刚才那一下本该要了我的命。可它擦身而过，像是没有认出我。',5.2,$imports.OS_FORCE);
  (0,$imports.toast)('天生免疫 · 挡下了一次致命事件');
}
function survivalReset(){
  $imports.VisualState.flash=0.9; $imports.VisualState.hurt=0.4;
  $imports.PlayerStats.setSan($imports.S.san,'survival',{min:45}); $imports.PlayerStats.setViolation($imports.S.viol,'survival',{max:40});
  $imports.PatrolWorld.rescued();
  try{ if($imports.AN.active) (0,$imports.anEnd)(); }catch(e){}
  try{ if($imports.ROAM.on){ $imports.ROAM.stage='wait'; $imports.ROAM.waitT=8; $imports.ROAM.x=-1e6; $imports.ROAM.y=-1e6; $imports.ROAM.litAcc=0; } }catch(e){}
  try{ $imports.SFX.wake&&$imports.SFX.wake(); }catch(e){}
}
function dreamWake(){
  $imports.RT.wakes=($imports.RT.wakes||0)+1;
  var left=3-$imports.RT.wakes;
  (0,$imports.eyelid)(700,function(){
    try{ (0,$imports.anfxClear)(); }catch(e){}
    $imports.AN.active=false; $imports.AN.id=null; $imports.AN.data={}; $imports.AN.t=0; $imports.AN.acc=0; $imports.AN.pre=null; $imports.AN.preNext=0; $imports.AN.locked=false;
    $imports.AN.next=60;
    $imports.S.dead=false; $imports.S.death=null; $imports.S.deadT=0; $imports.S.eyeLift=0; $imports.S.pitch=0;$imports.S.deathView=null;
    $imports.S.tsec=700; $imports.PlayerStats.setSan(78,'dream-wake'); $imports.PlayerStats.setViolation(0,'dream-wake'); $imports.PlayerStats.setStamina(100,'dream-wake'); $imports.S.snackT=0; $imports.PlayerStats.setAssimilation(0,'dream-wake'); $imports.S.ttTier=0; $imports.S.hiddenLatch=false; $imports.S.hiddenAsked=false;
    $imports.VisualState.hurt=0; $imports.VisualState.flash=0;
    var f=document.getElementById('flash'); if(f){ f.style.transition='none'; f.style.opacity='0'; }
    $imports.UI.closeChoice(); $imports.PAUSE.on=false; $imports.ROAM.on=false;
    $imports.OPENDOORS={};                        /* 回到 11:40：开过的门也都关回去了 */
    (0,$imports.examEnd)();
    $imports.Mechanics.dream();
    var R1=$imports.INTERIORS['teach1'];
    (0,$imports.doEnterRoom)('teach1',{x:R1.ox+48.5*9, y:R1.oy+6.5*9, ang:-$imports.PI/2, seated:true});
    try{ $imports.SFX.wake&&$imports.SFX.wake(); }catch(e){}
  },function(){
    (0,$imports.os)('……我猛地抬起头，后背全是汗。我还坐在自己的位子上。\n刚才那些——是梦吗？可我记得每一条走廊。',5.5,$imports.OS_FORCE);
    (0,$imports.toast)(left>0?'预知梦 · 还能再醒 '+left+' 次':'预知梦 · 下一次，不会再醒了');
    (0,$imports.autoSave)();
  });
}

var ENDINGS={
  cyber:{t:'《网安仙人》',true:1,l:['服务器接受了最后一条指令。名单、门禁和巡察停止运行。','AnthroPrank AI（安抄派智能）的校园试点终止了。更早的纸质档案和断链后的回执，仍没有答案。','您未能完全理解里世界']},
  car:  {t:'《闸 门》', true:1,l:['你踩下油门的时候，雨刷自己动了起来。','后视镜里，教学楼的窗户一扇一扇地暗下去，像有人在挨个关灯。','开出校门很远，你才敢看一眼副驾。','那里放着一张学生证。照片上的人，你终于认得了。']},
  face: {t:'《白名单》', true:1,l:['闸机「嘀」地亮了一下绿光。','你走出去，回头看了一眼——','里面的天还是黑白的。所有窗口后面都站着一个人，在目送你。','你的名字从那天起，一直留在白名单的最后一行。']},
  /* 假结局：看起来逃出去了，其实又回到了座位上 */
  trash:{t:'《第三个桶》',fake:1,l:['桶盖在头顶合上。','黑暗里，你听见垃圾车发动的声音，越来越远，越来越颠。','车停了很久。有人在外面敲了两下桶壁。','是你自己的声音在问：「里面有人吗？」','……然后，上课铃响了。']},
  beast:{t:'《先 辈》',  l:['门是被从外面撞开的。','你看清了那个背影——穿着很多年前的校服，一直在往外跑。','你跟着他跑了出去。','整座学校，第一次有了颜色。']},
  /* 真结局：自己造一扇门 */
  portal:{t:'《门》',true:1,l:['光圈合上之前，你回头看了一眼。','实验台、显微镜、离心机，还有教室里那一排排低着的头——都在原地，一动不动。','你没有再回头。','门的那一边是一个普通的下午。铃响了，有人在走廊里叫你的名字，你答应了一声。']}
};
function triggerEnding(id,skipCut){
  if($imports.S.dead||$imports.S.screen==='cut'||$imports.S.screen==='end') return;
  if(id!=='cyber')$imports.Termination.cancel();
  if(id==='trash'){tryTrashRoute();return;}
  $imports.RT.end=id;
  $imports.Playtest.event('结局',id);
  var e=ENDINGS[id];
  (0,$imports.endMark)(id);
  if(!e.fake) (0,$imports.clearSave)();                    /* 假结局之后还能接着玩 */
  $imports.Speedrun.lastResult=e.fake?null:$imports.Speedrun.finish(id);   /* 速通在通关确认的这一刻停表，不等结局演出 */
  if(skipCut)showEndingCard(id);else (0,$imports.playCut)(id,function(){ showEndingCard(id); });
}
function showEndingCard(id){
  var e=ENDINGS[id];
  $imports.VisualState.flash=0.6;
  $imports.Lifecycle.scope('session').timeout(function(){ $imports.VisualState.flash=0; },600);
  /* 结局卡：样式在 game.css（#ends），和死亡、暂停同一套档案式界面 */
  var tag=e.fake?'<div class="etag fake">假 结 局</div>':(e.true?'<div class="etag">真 结 局</div>':'');
  var more=e.fake?'<button type="button" class="ewake" onclick="fakeWake()">……再睁开眼</button>':'';
  var echo='';
  if(id==='car'&&$imports.Investigation.state().entries.parking)echo='你想起停车登记上空着的离校栏。这一次，车没有回到原来的车位。';
  if(id==='face'&&$imports.RT.data)echo='闸机认出了那张照片。你离开了，但那个名字仍属于学校。';
  if(id==='portal'&&$imports.RT.portalDiary)echo='日记里的人一直在寻找校门。你终于明白，图纸画的是另一道边界。';
  var html='<div id="ends">'+tag+
    '<div class="et">'+e.t+'</div>'+
    '<div class="el">'+e.l.join('<br>')+(echo?'<br><br>'+echo:'')+'</div>'+
    '<div class="emeta">第 '+$imports.S.day+' 天'+((0,$imports.hasClock)()?' · '+(0,$imports.fmtClock)($imports.S.tsec):'')+'</div>'+(e.fake?'':$imports.Speedrun.cardHtml($imports.Speedrun.lastResult))+more+
    '<button type="button" class="equit" onclick="Game.quit()">回到主菜单</button></div>';
  var d=document.createElement('div');
  d.innerHTML=html;
  document.body.appendChild(d);
  $imports.S.screen='end';
}
/* 假结局之后：在第二天的早读醒来，东西都还在；垃圾桶这条路走不通了 */
function fakeWake(){
  var es=document.getElementById('ends'); if(es) es.remove();
  $imports.RT.end=null; $imports.RT.trashFake=1;
  $imports.S.screen='play'; $imports.S.dead=false; $imports.S.day=Math.max(2,$imports.S.day+1); $imports.S.tsec=441;
  $imports.VisualState.worldNorm=0;
  var R1=$imports.INTERIORS['teach1'];
  (0,$imports.doEnterRoom)('teach1',{x:R1.ox+48.5*9, y:R1.oy+6.5*9, ang:-$imports.PI/2, seated:true});
  $imports.S.seated=true;
  if($imports.running){ $imports.lastT=performance.now(); $imports.accum=0; }
  (0,$imports.os)('我：……我在座位上醒过来。早读。衣服上有一股垃圾房的味道。\n那个桶没有把我送出去——它把我送回来了。',6,$imports.OS_FORCE);
}

/* @module-exports */
GameModules.publish("game3d/js/story.js",{
"SPOTS":{get:function(){return SPOTS;},set:function($value){SPOTS=$value;}},
"SPOT_ROOM":{get:function(){return SPOT_ROOM;},set:function($value){SPOT_ROOM=$value;}},
"SPOT_INDOOR_ONLY":{get:function(){return SPOT_INDOOR_ONLY;},set:function($value){SPOT_INDOOR_ONLY=$value;}},
"spotMark":{get:function(){return spotMark;},set:function($value){spotMark=$value;}},
"spotTick":{get:function(){return spotTick;},set:function($value){spotTick=$value;}},
"IDEAS":{get:function(){return IDEAS;},set:function($value){IDEAS=$value;}},
"ideasAvailable":{get:function(){return ideasAvailable;},set:function($value){ideasAvailable=$value;}},
"FN_EVENTS":{get:function(){return FN_EVENTS;},set:function($value){FN_EVENTS=$value;}},
"fnWhereNow":{get:function(){return fnWhereNow;},set:function($value){fnWhereNow=$value;}},
"fnTick":{get:function(){return fnTick;},set:function($value){fnTick=$value;}},
"chooseIdea":{get:function(){return chooseIdea;},set:function($value){chooseIdea=$value;}},
"trapWhere":{get:function(){return trapWhere;},set:function($value){trapWhere=$value;}},
"tryCarRoute":{get:function(){return tryCarRoute;},set:function($value){tryCarRoute=$value;}},
"carRightCell":{get:function(){return carRightCell;},set:function($value){carRightCell=$value;}},
"useCar":{get:function(){return useCar;},set:function($value){useCar=$value;}},
"carDrive":{get:function(){return carDrive;},set:function($value){carDrive=$value;}},
"tryFaceRoute":{get:function(){return tryFaceRoute;},set:function($value){tryFaceRoute=$value;}},
"FACE_WRONG_SAN":{get:function(){return FACE_WRONG_SAN;},set:function($value){FACE_WRONG_SAN=$value;}},
"FACE_QUESTIONS":{get:function(){return FACE_QUESTIONS;},set:function($value){FACE_QUESTIONS=$value;}},
"FACE_EXPLANATIONS":{get:function(){return FACE_EXPLANATIONS;},set:function($value){FACE_EXPLANATIONS=$value;}},
"FaceChallenge":{get:function(){return FaceChallenge;},set:function($value){FaceChallenge=$value;}},
"tryTrashRoute":{get:function(){return tryTrashRoute;},set:function($value){tryTrashRoute=$value;}},
"tryBeastRoute":{get:function(){return tryBeastRoute;},set:function($value){tryBeastRoute=$value;}},
"useStall":{get:function(){return useStall;},set:function($value){useStall=$value;}},
"DEATH_MESSAGES":{get:function(){return DEATH_MESSAGES;},set:function($value){DEATH_MESSAGES=$value;}},
"DFX_EPI":{get:function(){return DFX_EPI;},set:function($value){DFX_EPI=$value;}},
"DFX_SFX":{get:function(){return DFX_SFX;},set:function($value){DFX_SFX=$value;}},
"DEATH_LOG_KEY":{get:function(){return DEATH_LOG_KEY;},set:function($value){DEATH_LOG_KEY=$value;}},
"DEATH_SOURCES":{get:function(){return DEATH_SOURCES;},set:function($value){DEATH_SOURCES=$value;}},
"DEATH_HINTS":{get:function(){return DEATH_HINTS;},set:function($value){DEATH_HINTS=$value;}},
"deathLogRead":{get:function(){return deathLogRead;},set:function($value){deathLogRead=$value;}},
"deathLogAdd":{get:function(){return deathLogAdd;},set:function($value){deathLogAdd=$value;}},
"deathHints":{get:function(){return deathHints;},set:function($value){deathHints=$value;}},
"kill":{get:function(){return kill;},set:function($value){kill=$value;}},
"DEATH_PENDING":{get:function(){return DEATH_PENDING;},set:function($value){DEATH_PENDING=$value;}},
"deathSkip":{get:function(){return deathSkip;},set:function($value){deathSkip=$value;}},
"elixirSave":{get:function(){return elixirSave;},set:function($value){elixirSave=$value;}},
"PROTECT_SAVE":{get:function(){return PROTECT_SAVE;},set:function($value){PROTECT_SAVE=$value;}},
"protectCommit":{get:function(){return protectCommit;},set:function($value){protectCommit=$value;}},
"immuneSave":{get:function(){return immuneSave;},set:function($value){immuneSave=$value;}},
"survivalReset":{get:function(){return survivalReset;},set:function($value){survivalReset=$value;}},
"dreamWake":{get:function(){return dreamWake;},set:function($value){dreamWake=$value;}},
"ENDINGS":{get:function(){return ENDINGS;},set:function($value){ENDINGS=$value;}},
"triggerEnding":{get:function(){return triggerEnding;},set:function($value){triggerEnding=$value;}},
"showEndingCard":{get:function(){return showEndingCard;},set:function($value){showEndingCard=$value;}},
"fakeWake":{get:function(){return fakeWake;},set:function($value){fakeWake=$value;}}
});
})(GameModules.imports("game3d/js/story.js"));
