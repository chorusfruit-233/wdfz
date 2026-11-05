/* 里世界 3D · 成就定义与判定（纯规则）
   计划：docs/plan/成就系统.md。只记录、没有任何加成；这里不碰 DOM、存储和全局状态，只吃「事实」和模块整理好的只读视图。
   达成方法也按彩蛋处理（2026-11-03 用户要求）：how 是内部说明，只给开发和调试面板看，界面、Wiki 都不显示；
   玩家没解锁时只看到名字，解锁后看到 m —— 一句回忆式的话，写发生了什么，不写怎么做到。
   每条：t 档位（n 普通 / e 精英 / p 史诗 / h 隐藏）、scope（once 一次 / run 本局 / cross 跨局集合）、
   on 听哪种事实（gameFact 的 kind；room、mazeEvent 由成就模块转成同样的形状；'*' 表示任何一次解锁之后再看）、
   test(f, v) 返回 true 即达成、score:false 表示不计入本局积分（记录失败经历的那几条）、needs 依赖的模块（不在时不可达）。
   隐藏条目 secret:1：解锁前不出现、不计数，名称与说明不进 Wiki。 */
'use strict';
var ACH_TIERS={
  n:{name:'普通',pts:10,order:0},
  e:{name:'精英',pts:40,order:1},
  p:{name:'史诗',pts:100,order:2},
  h:{name:'隐藏',pts:60,order:3}
};
var ACH_ORIGINAL_ENDS=['car','face','portal','cyber'];
var ACH_PUBLIC_ENDS=ACH_ORIGINAL_ENDS.concat(['dismissal']);
/* 「踏遍校园」要走到的地方：三栋楼的每一层、食堂、南北宿舍各一层、车库、钟楼、保安岗、器材室、垃圾房（共 24 处） */
var ACH_EXPLORE_ROOMS=['teach1','teach2','teach3','teach4','teach5','teach6','admin1','admin2','admin3','admin4','admin5',
  'lab1','lab2','lab3','lab4','lab5','canteen1','garage1','bell1','guard1','gear1','trash1'];
var ACH_EXPLORE_ANY=[['dorm1','dorm2','dorm3'],['dorm4','dorm5','dorm6']];
var ACH_CFG={fastMs:900000};               /* 「赶在铃响前」：有效速通 15 分钟内（暂定，B0 校准） */

var AchievementRules=(function(){
  function legit(f){ return f.kind==='ending'&&f.legit===true; }
  function publicEnd(f){ return legit(f)&&ACH_PUBLIC_ENDS.indexOf(f.id)>=0; }
  function size(o){ return o?Object.keys(o).length:0; }
  function T(){ return true; }

  /* 跨局集合：哪种事实往哪个集合里加什么键；goal 由视图给出（取自注册表的实际数量） */
  var SETS={
    lethal:   {on:'anomaly',  key:function(f,v){ return f.phase==='end'&&f.survived&&f.lethal&&v.started===f.id?f.id:null; }},
    rest:     {on:'rest',     key:function(f){ return f.key?String(f.key):null; }},
    notes:    {on:'lesson',   key:function(f){ return f.correct?String(f.task):null; }},
    anomalies:{on:'anomaly',  key:function(f,v){ return f.phase==='start'&&v.publicAnomaly(f.id)?f.id:null; }},
    talents:  {on:'ending',   key:function(f,v){ return publicEnd(f)&&v.pickable(v.talent)?v.talent:null; }},
    hardEnds: {on:'ending',   key:function(f,v){ return publicEnd(f)&&v.diff==='hard'?f.id:null; }},
    mazeExits:{on:'maze',     key:function(f){ return f.what==='leave'&&f.exit?String(f.exit):null; }},
    mazeShadows:{on:'mazeEvent',key:function(f){ return f.what==='shadowShow'&&f.id?String(f.id):null; }}
  };

  function A(id,t,scope,n,how,on,test,extra){
    var a={id:id,t:t,scope:scope,n:n,how:how,m:'',on:on,test:test||T,score:true,secret:t==='h'?1:0,needs:null,set:null};
    if(extra) Object.keys(extra).forEach(function(k){ a[k]=extra[k]; });
    return a;
  }
  var LIST=[
    /* ---------- 普通 ---------- */
    A('n.opening','n','once','第四节','看完或跳过一次新局开场。','opening'),
    A('n.day2','n','run','熬过第一天','活着迎来第二天。','day',function(f){ return f.day===2; }),
    A('n.anomaly','n','once','看见了','第一次遭遇异象。','anomaly',function(f){ return f.phase==='start'; }),
    A('n.survive','n','once','还活着','一次危险异象结束时，你还活着。','anomaly',function(f,v){ return f.phase==='end'&&f.survived&&f.lethal&&v.started===f.id; }),
    A('n.lost','n','once','两短一长','被巡察者盯上以后，借着遮挡甩掉它。','patrol',function(f){ return f.what==='lost'; }),
    A('n.locker','n','once','柜子里很安静','躲进储物柜，等巡察者走远。','patrol',function(f){ return f.what==='locker'; }),
    A('n.inspection','n','once','按时到场','学生会检查时待在教室里。','inspection',function(f){ return !!f.compliant; }),
    A('n.desk','n','once','看课桌','上课看课桌，答对一次。','lesson',function(f){ return !!f.correct; }),
    A('n.rest','n','once','喘口气','完成一次恢复 SAN 的活动。','rest'),
    A('n.snake','n','once','一口一口','机房贪吃蛇一局吃到 7 个。','snake',function(f){ return (f.score|0)>=7; }),
    A('n.torch','n','once','照亮','在车库用手电照着那个东西，直到它退开。','garage',function(f){ return f.what==='torch'; }),
    A('n.seal','n','once','一张符纸','符纸替你挡下一次巡察者。','patrol',function(f){ return f.what==='banish'; }),
    A('n.register','n','once','登记在册','在自己教室的讲台登记外出。','register'),
    A('n.bell','n','once','钟声','白天在钟楼顶撞响那口钟。','exam',function(f){ return f.phase==='start'; }),
    A('n.exam','n','once','交卷','一场考试七成以上的时间坐在座位上，交卷。','exam',function(f){ return f.phase==='paper'&&!!f.pass; }),
    A('n.wake','n','once','梦里记得','在预知梦里死去，然后惊醒。','wake',T,{score:false}),
    A('n.saved','n','once','被替了一次','不知名药丸或天生免疫挡下一次致命的事。','protect',T,{score:false}),
    A('n.archive','n','once','第一份档案','死亡档案室记下第一份档案。','death',function(f){ return !!f.archiveNew; },{score:false}),
    A('n.chalk','n','once','记号','用粉笔画下一个记号。','chalk'),
    A('n.special','n','once','特别的一天','遇上一次校庆日或占课。','specialDay'),
    A('n.broadcast','n','once','核对','发现假广播并通过播音记录本核对。','broadcast',function(f){return f.what==='verified'&&f.real===false;},{needs:['broadcast']}),
    A('n.midnight','n','once','明天再来','熄灯后在食堂亮着的窗口吃了一碗。','midnightMeal',T,{needs:['campus-tales']}),
    /* ---------- 精英 ---------- */
    A('e.end_dismissal','e','once','《放学》','达成《放学》。','ending',function(f){return legit(f)&&f.id==='dismissal';},{needs:['broadcast']}),
    A('e.end_car','e','once','《闸门》','达成《闸门》。','ending',function(f){ return legit(f)&&f.id==='car'; }),
    A('e.end_face','e','once','《白名单》','达成《白名单》。','ending',function(f){ return legit(f)&&f.id==='face'; }),
    A('e.end_portal','e','once','《门》','达成《门》。','ending',function(f){ return legit(f)&&f.id==='portal'; }),
    A('e.end_cyber','e','once','《网安仙人》','达成《网安仙人》。','ending',function(f){ return legit(f)&&f.id==='cyber'; }),
    A('e.day1','e','run','当天离校','第一天就达成一个真结局。','ending',function(f,v){ return publicEnd(f)&&v.day===1; }),
    A('e.hard','e','run','梦魇','在梦魇难度达成一个真结局。','ending',function(f,v){ return publicEnd(f)&&v.diff==='hard'; }),
    A('e.nolaugh','e','run','笑时莫出声','第二天那几件「看起来很正常」的事，一次都没笑，熬到天黑。','fakeNormal',function(f,v){ return !!f.done&&v.run.laughs===0&&!v.run.legacy; }),
    A('e.attendance','e','run','全勤','同一天的两场学生会检查都待在教室里。','inspection',function(f,v){
      var d=v.run.insp[f.day]; if(!f.compliant||!d) return false;
      var ok=0, bad=0; Object.keys(d).forEach(function(k){ if(d[k]>0) ok++; else bad++; });
      return ok>=2&&bad===0;
    }),
    A('e.firstcar','e','run','一次就对','一辆错车都没试，直接开走那辆车。','garage',function(f){ return f.what==='drive'&&(f.tried|0)===0; }),
    A('e.whitelist','e','run','三道全对','白名单的三道验证题一道都没答错，通过闸机。','ending',function(f,v){ return legit(f)&&f.id==='face'&&v.run.faceWrong===0&&!v.run.legacy; }),
    A('e.allexam','e','run','全场交卷','撞钟那天，连着两场考试都合格交卷。','exam',function(f,v){
      var x=v.run.exams[f.day]; return f.phase==='paper'&&!!f.pass&&!!x&&x.pass>=2&&x.fail===0;
    }),
    A('e.permanent','e','run','甩不掉的','被持续追踪以后，仍然逃了出去。','ending',function(f,v){ return publicEnd(f)&&v.permanent; }),
    A('e.lethal4','e','cross','见识','七种危险异象里，活过其中四种。','anomaly',function(f,v){ return size(v.sets.lethal)>=4; },{set:'lethal',goal:4}),
    A('e.rest8','e','cross','八种喘息','八种恢复 SAN 的活动都做过。','rest',function(f,v){ return size(v.sets.rest)>=v.total.rest; },{set:'rest',goal:'rest'}),
    A('e.notes','e','cross','十张纸条','课桌上的十种任务都答对过。','lesson',function(f,v){ return size(v.sets.notes)>=v.total.notes; },{set:'notes',goal:'notes'}),
    A('e.explore','e','run','踏遍校园','一局里走过教学楼、行政楼、实验楼的每一层，还有食堂、南北宿舍、车库、钟楼、保安岗、器材室和垃圾房。','room',function(f,v){
      var r=v.run.rooms||{};
      if(v.run.legacy) return false;
      for(var i=0;i<ACH_EXPLORE_ROOMS.length;i++) if(!r[ACH_EXPLORE_ROOMS[i]]) return false;
      return ACH_EXPLORE_ANY.every(function(g){ return g.some(function(id){ return !!r[id]; }); });
    }),
    A('e.speedrun','e','once','计时','完成一次有效速通。','speedrun',function(f){ return f.status==='finished'; }),
    A('e.liftdoor','e','once','它比门慢','被巡察者看着走进电梯，在它碰到门之前把门关上。','patrol',function(f){ return f.what==='door'; }),
    /* ---------- 史诗 ---------- */
    A('p.routes','p','cross','四条路','《闸门》《白名单》《门》《网安仙人》都达成过。','ending',function(f,v){
      return ACH_ORIGINAL_ENDS.every(function(id){ return !!v.unlocked['e.end_'+id]; });
    }),
    A('p.five_routes','p','cross','五条路','五个公开真结局都达成过。','ending',function(f,v){return ACH_PUBLIC_ENDS.every(function(id){return !!v.unlocked['e.end_'+id];});},{needs:['broadcast']}),
    A('p.hard_routes','p','cross','梦魇里的五条路','在梦魇难度把五个公开真结局都达成过。','ending',function(f,v){ return ACH_PUBLIC_ENDS.every(function(id){return !!v.sets.hardEnds[id];}); },{set:'hardEnds',goal:5}),
    A('p.oneshot','p','run','一命','梦魇难度达成真结局，这一局从没被药丸或免疫救过。','ending',function(f,v){ return publicEnd(f)&&v.diff==='hard'&&!v.run.saved&&!v.run.legacy; }),
    A('p.hard_day1','p','run','梦魇·当天','梦魇难度，第一天就达成真结局。','ending',function(f,v){ return publicEnd(f)&&v.diff==='hard'&&v.day===1; }),
    A('p.archive','p','cross','档案齐了','死亡档案室的公开档案全部亲历过。','death',function(f,v){ return v.archive.pub>=v.archive.pubTotal&&v.archive.pubTotal>0; },{goal:'archive'}),
    A('p.anomalies','p','cross','异象图鉴','异象图鉴里的二十五种都亲历过。','anomaly',function(f,v){ return size(v.sets.anomalies)>=v.total.anomalies; },{set:'anomalies',goal:'anomalies'}),
    A('p.talents','p','cross','七种活法','七种天赋各用一次，达成真结局。','ending',function(f,v){ return size(v.sets.talents)>=v.total.talents; },{set:'talents',goal:'talents'}),
    A('p.fast','p','once','赶在铃响前','一次有效速通在 15 分钟内完成。','speedrun',function(f){
      return f.status==='finished'&&ACH_PUBLIC_ENDS.indexOf(f.route)>=0&&+f.ms>0&&+f.ms<=ACH_CFG.fastMs;
    }),
    A('p.all','p','cross','毕业','其余的普通、精英和史诗成就全部达成。','*',function(f,v){
      for(var i=0;i<LIST.length;i++){ var a=LIST[i]; if(a.secret||a.id==='p.all') continue; if(!v.unlocked[a.id]) return false; }
      return true;
    }),
    /* ---------- 隐藏（内部；解锁前不出现、不计数） ---------- */
    A('h.beast','h','once','《先辈》','跟着穿旧校服的人跑了出去。','ending',function(f){ return legit(f)&&f.id==='beast'; }),
    A('h.wrong_floor','h','once','不存在的楼层','电梯停在了一层不存在的楼。','maze',function(f){ return f.what==='enter'; },{needs:['void-maze']}),
    A('h.maze_exit','h','once','漏光的门','从那片白色的地方走了出来。','maze',function(f){ return f.what==='leave'; },{needs:['void-maze']}),
    A('h.maze_exits','h','cross','两扇出口','两扇门都推开过。','maze',function(f,v){ return size(v.sets.mazeExits)>=2; },{set:'mazeExits',goal:2,needs:['void-maze']}),
    A('h.maze_deaths','h','cross','迷失与坠落','在那里迷失过，也坠落过。','death',function(f,v){ return v.archive.maze>=2; },{needs:['void-maze']}),
    A('h.invert','h','once','虚空回望','盯着虚空太久，它也换了颜色。','mazeEvent',function(f){ return f.what==='invert'; },{needs:['void-maze-eggs']}),
    A('h.shadows','h','cross','它们一直在','五处站着的人都见过了。','mazeEvent',function(f,v){ return size(v.sets.mazeShadows)>=5; },{set:'mazeShadows',goal:5,needs:['void-maze-eggs']}),
    A('h.wuda','h','once','武大子弟','开局时口袋里多了一支手电。','opening',function(f,v){ return !!v.wuda; },{needs:['wuda-kid']}),
    A('h.cola','h','once','天降可乐','那只杯子之后，夜里又掉下来一样东西。','anomaly',function(f){ return f.phase==='start'&&f.id==='cola'; }),
    A('h.crowd','h','once','最后一个进来的人','电梯满员的时候，自己走了出去。','anomaly',function(f){ return f.phase==='end'&&f.id==='crowd'&&f.survived===true; },{needs:['lift-crowd']}),
    A('h.beast_run','h','once','追着旧校服','速通模式里，有效打通了那条隐藏路线。','speedrun',function(f){ return f.status==='finished'&&f.route==='beast'; })
  ];
  /* 解锁后显示的一句话：只写发生了什么 */
  var MEMO={
    'n.broadcast':'记录本里没有刚才那一条。喇叭里还在啸叫。',
    'n.midnight':'那一碗是热的。打饭的人一直没有回头。',
    'e.end_dismissal':'长铃还在响。我和同学一起走出了北门。',
    'p.five_routes':'最后一次，学校以为我只是放学回家。',
    'n.opening':'粉笔灰停在半空。我趴到桌上，又抬起了头。',
    'n.day2':'熄灯，换日。日历往后翻了一页。',
    'n.anomaly':'从那一刻起，我知道这所学校不对劲。',
    'n.survive':'它过去了。手还在发抖，但我还站着。',
    'n.lost':'灯还在闪。脚步声停在了拐角另一边。',
    'n.locker':'铁皮的缝里，光一条一条地暗下去，又亮起来。',
    'n.inspection':'黑影围成一圈，又散开。它们没有记下我。',
    'n.desk':'纸条上那一句，后来救过我。',
    'n.rest':'有那么一会儿，我忘了自己在哪儿。',
    'n.snake':'屏幕上那条蛇越来越长。机房里只有我这一台亮着。',
    'n.torch':'光打过去的时候，它往后退了一步。',
    'n.seal':'口袋里的纸烧成了灰，烫了一下手。',
    'n.register':'讲台上那张单子，多了我的名字。',
    'n.bell':'钟声一圈一圈荡开，广播里有人慢慢地念。',
    'n.exam':'监考的人收走卷子，没有看我。',
    'n.wake':'我猛地抬起头，后背全是汗。',
    'n.saved':'刚才那一下，像是有人替我挨了。',
    'n.archive':'档案柜里，多了一个写着我名字的抽屉。',
    'n.chalk':'墙上的记号是我画的。至少，我记得是我画的。',
    'n.special':'今天的广播，和平时不一样。',
    'e.end_car':'车灯照亮了北门。后视镜里，教学楼一层层暗下去。',
    'e.end_face':'闸机亮了一下。我的名字留在了最后一行。',
    'e.end_portal':'光圈合上之前，我回头看了一眼。',
    'e.end_cyber':'机柜一架架熄灭。天亮了。',
    'e.day1':'那一天还没结束，我就已经不在学校里了。',
    'e.hard':'没有惊醒，也没有第二次。我还是出来了。',
    'e.nolaugh':'那一天，我一直没有出声。',
    'e.attendance':'两次点名，我都在。',
    'e.firstcar':'引擎一下就着了。',
    'e.whitelist':'闸机没有犹豫。',
    'e.allexam':'卷子一张接一张收上去，都写满了。',
    'e.permanent':'它一直跟在后面。可我还是走出去了。',
    'e.lethal4':'有些东西，我见过不止一次了。',
    'e.rest8':'我找到了很多让自己缓过来的办法。',
    'e.notes':'桌肚里的纸条，我一张一张都记下了。',
    'e.explore':'这所学校的每一层，我都走过。',
    'e.speedrun':'表停下的那一刻，我还在跑。',
    'e.liftdoor':'门合上的时候，门缝里是它伸到一半的手指。',
    'p.routes':'我从这所学校出去过很多次，每一次走的路都不一样。',
    'p.hard_routes':'在最深的梦里，那些路我都走通了。',
    'p.oneshot':'从头到尾，没有人替我挡过一下。',
    'p.hard_day1':'最深的梦，最短的一天。',
    'p.archive':'档案柜的每一个抽屉都打开过了。',
    'p.anomalies':'这所学校能拿出来的东西，我都见过了。',
    'p.talents':'换了好几种活法，每一种都走出了校门。',
    'p.fast':'铃还没响，我已经在外面了。',
    'p.all':'该做的都做完了。我可以毕业了。',
    'h.beast':'穿旧校服的人回头看了我一眼。',
    'h.wrong_floor':'电梯停下来的那一层，楼层表上没有。',
    'h.maze_exit':'门缝里漏出来的光，是外面的光。',
    'h.maze_exits':'两扇门，我都推开过。',
    'h.maze_deaths':'我在那里走丢过，也掉下去过。',
    'h.invert':'我盯着它太久，它也盯了回来。',
    'h.shadows':'它们一直站在那里。我只是现在才看见。',
    'h.wuda':'口袋里多了一支手电，我不记得是谁给的。',
    'h.cola':'夜里，又有东西从上面掉了下来。',
    'h.crowd':'门合上以前我走了出来。显示屏上还是「满员」。',
    'h.beast_run':'我追着那个背影，一路没有停。'
  };
  LIST.forEach(function(a){ a.m=MEMO[a.id]||''; });
  var BY={}; LIST.forEach(function(a){ BY[a.id]=a; });

  return {
    list:function(){ return LIST.slice(); },
    get:function(id){ return BY[id]||null; },
    tiers:ACH_TIERS,
    sets:SETS,
    publicList:function(){ return LIST.filter(function(a){ return !a.secret; }); },
    /* 进度：跨局集合 / 档案计数（显示用），返回 {n, of} 或 null */
    progress:function(a,v){
      if(a.set){ var of=typeof a.goal==='number'?a.goal:(v.total[a.goal]||0); return {n:Math.min(size(v.sets[a.set]),of),of:of}; }
      if(a.goal==='archive') return {n:v.archive.pub,of:v.archive.pubTotal};
      return null;
    },
    /* 一条事实往跨局集合里加的键：{set:key} */
    setKeys:function(f,v){
      var out={};
      Object.keys(SETS).forEach(function(name){ var s=SETS[name]; if(s.on!==f.kind) return; var k=s.key(f,v); if(k) out[name]=k; });
      return out;
    },
    /* 这条事实可能让哪些成就达成（按表的顺序；'*' 的放最后另算） */
    candidates:function(f){ return LIST.filter(function(a){ return a.on===f.kind; }); },
    check:function(a,f,v){ try{ return !!a.test(f,v); }catch(e){ return false; } },
    /* 计入本局积分的档位分 */
    points:function(id){ var a=BY[id]; return a&&a.score!==false?ACH_TIERS[a.t].pts:0; }
  };
})();
