/* @module-capsule */
(function($imports){
/* 里世界 3D · 基础：数学工具、常量、课表、物品与天赋 */
'use strict';

var TAU=Math.PI*2, PI=Math.PI, DEG=PI/180;
function clamp(v,a,b){return v<a?a:v>b?b:v;}
function lerp(a,b,t){return a+(b-a)*t;}
function rnd(a,b){return a+$imports.GameRandom.next()*(b-a);}
function ri(a,b){return Math.floor(rnd(a,b+1));}
function pick(a){return a[Math.floor($imports.GameRandom.next()*a.length)];}
function dist2(ax,ay,bx,by){var dx=ax-bx,dy=ay-by;return dx*dx+dy*dy;}
function angDiff(a,b){var d=Math.abs((a-b)%TAU);return Math.min(d,TAU-d);}
function fmtClockS(tsec){                  /* 带秒：手表 / 秒表天赋 */
  tsec=((tsec%1440)+1440)%1440;
  var s=Math.floor(tsec*60+1e-6)%60;
  return fmtClock(tsec)+':'+(s<10?'0':'')+s;
}
function fmtClock(tsec){
  tsec=((tsec%1440)+1440)%1440;
  var h=Math.floor(tsec/60), m=Math.floor(tsec%60);
  return (h<10?'0':'')+h+':'+(m<10?'0':'')+m;
}

var TTILE=9, SC=2.0;
var TCOLS=63, TROWS=26;
var EYE=1.65, WALLH=3.0, TILEM=1.0;

var KEEP={
  '#':'wall','S':'stair','O':'out','L':'link','M':'link','T':'podium',
  'K':'desk/bench','C':'centrifuge','N':'microscope','Z':'rig','Y':'globe',
  'd':'desk','P':'seat','B':'toilet','G':'toilet','R':'shelf','b':'bed',
  't':'table','k':'counter','f':'cabinet','l':'lab','w':'basin','v':'rack',
  'c':'car','D':'data','X':'trash','=':'door','.':'floor'
};
function isSolidCh(c){return c==='#'||c==='S';}   /* 楼梯占着一整格，人不能站进去 */

/* 课表保留世界钟表；现实预算由四个连续阶段决定，不随每次上下课突然变速。
   07:20→12:50、12:50→17:50、17:50→22:20 各 6 分钟，熄灯后 2 分钟。
   隐藏慢速窗口的 10 秒计入第一阶段，总计 1200 秒。 */
var BEAST_SLOW_T0=705, BEAST_SLOW_T1=705+20/60;
var BEAST_T0=705+14/60, BEAST_T1=705+15/60, BEAST_RATE=2;
var DAY_PHASES=[[440,770,360],[770,1070,360],[1070,1340,360],[1340,1500,120]];
function dayPhaseAt(t){
  return DAY_PHASES.find(function(p){return t>=p[0]&&t<p[1];})||DAY_PHASES[3];
}
/* 上课 8:00–12:15、14:00–17:20；晚自习 18:10–19:40、20:00–22:00；22:20 熄灯 */
var SCHED=[
  [440,480,'早读',    '教室'],
  [480,525,'第 1 节','教室'],
  [525,540,'课间',    '自由'],
  [540,585,'第 2 节','教室'],
  [585,620,'课间操',  '操场'],
  [620,665,'第 3 节','教室'],
  [665,690,'课间',    '自由'],
  [690,735,'第 4 节','教室'],
  [735,800,'午饭',    '自由'],
  [800,840,'午休',    '自由'],
  [840,885,'第 5 节','教室'],
  [885,890,'课间',    '自由'],
  [890,935,'第 6 节','教室'],
  [935,945,'课间',    '自由'],
  [945,990,'第 7 节','教室'],
  [990,995,'课间',    '自由'],
  [995,1040,'第 8 节','教室'],
  [1040,1060,'课外活动','自由'],
  [1060,1090,'晚饭',  '自由'],
  [1090,1180,'晚自习一','教室'],
  [1180,1200,'课间',  '自由'],
  [1200,1320,'晚自习二','教室'],
  [1320,1340,'洗漱',  '自由'],
  [1340,1500,'熄灯后','自由']
];
var MEALS=[[735,800],[1060,1090]];         /* 食堂开饭的时间段 */
function eveningActivity(t){ return t>=1040&&t<1090; }
var EVENING=1090;                           /* 晚自习开始 */
var LIGHTS_OUT=1340;                        /* 熄灯 22:20 */
function periodAt(t){
  for(var i=0;i<SCHED.length;i++){var s=SCHED[i]; if(t>=s[0]&&t<s[1])return s;}
  return SCHED[SCHED.length-1];
}
function needWhere(t){
  var p=periodAt(t);
  if(p[3]==='教室') return '教室';
  if(p[3]==='操场') return '操场';
  if(t>=LIGHTS_OUT) return '宿舍';
  return '自由';
}
/* 隐藏时段：慢速区间与实际判定窗口分别计量。 */
function rateAt(t){
  if(t>=BEAST_SLOW_T0&&t<BEAST_SLOW_T1)return BEAST_RATE;
  var p=dayPhaseAt(t),slow=p===DAY_PHASES[0]?BEAST_SLOW_T1-BEAST_SLOW_T0:0;
  return (p[1]-p[0]-slow)*60/(p[2]-slow*60/BEAST_RATE);
}
function clockBoundary(t){
  var end=Math.min(periodAt(t)[1],dayPhaseAt(t)[1]);
  if(t<BEAST_SLOW_T0)end=Math.min(end,BEAST_SLOW_T0);
  else if(t<BEAST_SLOW_T1)end=Math.min(end,BEAST_SLOW_T1);
  return end;
}
/* 单个自然日内的模拟秒，供课表验证、返程预警与主动整理共用。 */
function realSecondsBetween(from,to){
  var seconds=0;
  for(var t=from;t<to-1e-9;){
    var end=Math.min(to,clockBoundary(t));
    if(end<=t)break;
    seconds+=(end-t)*60/rateAt(t);t=end;
  }
  return seconds;
}
function clockTimeBefore(time,seconds){
  var lo=440,hi=time;
  for(var i=0;i<48;i++){
    var mid=(lo+hi)/2;
    if(realSecondsBetween(mid,time)>seconds)lo=mid;else hi=mid;
  }
  return (lo+hi)/2;
}
function isNight(){ return $imports.S.tsec>=LIGHTS_OUT||$imports.S.tsec<440; }

/* 预知梦：中等（第一天死了能醒三次，异象 40–64 秒一次，提前一点告诉你下一个是什么）
   梦魇：中上（不会醒，异象 24–40 秒一次，致死阈值更低，二选一的代价更重） */
var DIFV={ easy:{iv:1.0,san:0.82}, hard:{iv:1.0,san:1.15} };
function dif(){ return DIFV[$imports.S.diff]||DIFV.easy; }

var ITEMS={
  card:{n:'学生证',d:'照片上的人我不认识，班号是我们班。'},
  phone:{n:'手机',d:'可以查看网络工具，也能玩纸飞机。电量有限；回原教室充电，或连接机房电脑。收起后后台任务继续。'},
  chalk:{n:'粉笔',d:'半截。断口很新。'},
  map:{n:'平面图',d:'边角被翻烂了。能看懂这所学校。'},
  key:{n:'钥匙',d:'一串车钥匙。牌号刻在环上。'},
  torch:{n:'手电筒',d:'光很弱。但在地下车库里，它是唯一能定住东西的东西。'},
  brolly:{n:'雨伞',d:'伞骨断了一根，还能撑。'},
  coat:{n:'校服外套',d:'比我穿的那件大一号。'},
  pill:{n:'药片',d:'名字被撕掉了。吃下去后 30 秒内，视野和呼吸逐渐回稳。再吃一片会重新计时。'},
  notebook:{n:'笔记本',d:'没写过的本子。有它，想到的事就不会忘。'},
  pen:{n:'笔',d:'一支笔。还能写。'},
  snack:{n:'士力架',d:'压在卷子底下的一条。吃下去，30 个运行秒内，步行和奔跑速度变为 1.5 倍，疾跑不耗体力。'},
  battery:{n:'电池',d:'两节。外壳上写着日期，很旧了。'},
  compass:{n:'罗盘',d:'指针不指北——指向最近的那扇门。'},
  metronome:{n:'节拍器',d:'摆锤自己在动，可是没有声音。'},
  goggles:{n:'护目镜',d:'镜片上有洗不掉的斑点。戴着它摆弄离心机、显微镜，手会稳一些。'},
  hw:{n:'作业本',d:'写完了的作业。字很工整，不是我的。'},
  coin:{n:'硬币',d:'边缘磨得很圆。食堂窗口和售货机都收；在车库里扔出去会有声音。'},
  usb:{n:'U 盘',d:'上面贴着「门禁」两个字。'},
  watch:{n:'手表',d:'能看现在的时间，精确到分钟。'},
  memo:{n:'纸条',d:'上面写着门禁和白名单的事。'},
  roomkey:{n:'机房钥匙',d:'铜的，磨得发亮。塑料标签上写着「机房」。'},
  /* 高级物品 */
  coil:{n:'铜线圈',d:'从服务器里抽出来的一卷。缠得很密，摸上去一直在发烫。（传送门材料）'},
  lens:{n:'透镜',d:'显微镜上拧下来的物镜。透过它看，墙后面像是还有一层。（传送门材料）'},
  vial:{n:'荧光试剂',d:'离心机甩出来的一管，颜色一直在变。（传送门材料）'},
  atlas:{n:'建筑总览图',d:'每栋楼每一层都画在上面。有几处用红笔圈着。'},
  elixir:{n:'不知名药丸',d:'没有说明书的一粒。要死的时候，它会把你拽回来一次。'},
  seal:{n:'符纸',d:'折成三角的黄纸。附近巡察者即将锁定时自动烧掉，使它消失三十秒。不会撤销已登记的责任。'},
  leave:{n:'请假条',d:'班主任签过字，日期空着。用了能请两个小时的假：这段时间不用待在规定的地方，普通巡察不管你；不能豁免检查或解除持续追踪。违规记满了就批不下来。'}
};
var ITEM_GLYPH={
  card:'▣', phone:'▤', chalk:'▬', map:'▦', key:'⚿', torch:'▮', brolly:'☂',
  coat:'▧', pill:'◍', notebook:'▤', pen:'✎', snack:'▬', battery:'▮',
  compass:'◎', metronome:'⧗', goggles:'◉', hw:'▤', coin:'◉', usb:'▮',
  watch:'◷', memo:'▭', roomkey:'⚿',
  coil:'◎', lens:'◌', vial:'▯', atlas:'▦', elixir:'◍', seal:'△', leave:'▭'
};
var ITEM_COL={
  coil:'#d08a4a', lens:'#a8d8e8', vial:'#7fe0a0', atlas:'#c8b88a', elixir:'#e0a0e0', seal:'#e0c040', leave:'#e8d8a0',
  torch:'#c8a24a', phone:'#7fb0c8', key:'#c8a24a', coin:'#c8a24a',
  pill:'#c86a6a', snack:'#b89a5a', battery:'#8ac8a4', compass:'#8aa8c8',
  roomkey:'#c8b060'
};
function itemGlyph(id){ return ITEM_GLYPH[id]||'▫'; }
function itemColor(id){ return ITEM_COL[id]||'#9fb8ab'; }

/* 天赋的名称、效果和可选池见 game3d/js/talents.js（唯一定义源） */

var U2M=1/9;
/* @module-exports */
GameModules.publish("game3d/js/core.js",{
"TAU":{get:function(){return TAU;},set:function($value){TAU=$value;}},
"PI":{get:function(){return PI;},set:function($value){PI=$value;}},
"DEG":{get:function(){return DEG;},set:function($value){DEG=$value;}},
"clamp":{get:function(){return clamp;},set:function($value){clamp=$value;}},
"lerp":{get:function(){return lerp;},set:function($value){lerp=$value;}},
"rnd":{get:function(){return rnd;},set:function($value){rnd=$value;}},
"ri":{get:function(){return ri;},set:function($value){ri=$value;}},
"pick":{get:function(){return pick;},set:function($value){pick=$value;}},
"dist2":{get:function(){return dist2;},set:function($value){dist2=$value;}},
"angDiff":{get:function(){return angDiff;},set:function($value){angDiff=$value;}},
"fmtClockS":{get:function(){return fmtClockS;},set:function($value){fmtClockS=$value;}},
"fmtClock":{get:function(){return fmtClock;},set:function($value){fmtClock=$value;}},
"TTILE":{get:function(){return TTILE;},set:function($value){TTILE=$value;}},
"SC":{get:function(){return SC;},set:function($value){SC=$value;}},
"TCOLS":{get:function(){return TCOLS;},set:function($value){TCOLS=$value;}},
"TROWS":{get:function(){return TROWS;},set:function($value){TROWS=$value;}},
"EYE":{get:function(){return EYE;},set:function($value){EYE=$value;}},
"WALLH":{get:function(){return WALLH;},set:function($value){WALLH=$value;}},
"TILEM":{get:function(){return TILEM;},set:function($value){TILEM=$value;}},
"KEEP":{get:function(){return KEEP;},set:function($value){KEEP=$value;}},
"isSolidCh":{get:function(){return isSolidCh;},set:function($value){isSolidCh=$value;}},
"BEAST_SLOW_T0":{get:function(){return BEAST_SLOW_T0;},set:function($value){BEAST_SLOW_T0=$value;}},
"BEAST_SLOW_T1":{get:function(){return BEAST_SLOW_T1;},set:function($value){BEAST_SLOW_T1=$value;}},
"BEAST_T0":{get:function(){return BEAST_T0;},set:function($value){BEAST_T0=$value;}},
"BEAST_T1":{get:function(){return BEAST_T1;},set:function($value){BEAST_T1=$value;}},
"BEAST_RATE":{get:function(){return BEAST_RATE;},set:function($value){BEAST_RATE=$value;}},
"DAY_PHASES":{get:function(){return DAY_PHASES;},set:function($value){DAY_PHASES=$value;}},
"dayPhaseAt":{get:function(){return dayPhaseAt;},set:function($value){dayPhaseAt=$value;}},
"SCHED":{get:function(){return SCHED;},set:function($value){SCHED=$value;}},
"MEALS":{get:function(){return MEALS;},set:function($value){MEALS=$value;}},
"eveningActivity":{get:function(){return eveningActivity;},set:function($value){eveningActivity=$value;}},
"EVENING":{get:function(){return EVENING;},set:function($value){EVENING=$value;}},
"LIGHTS_OUT":{get:function(){return LIGHTS_OUT;},set:function($value){LIGHTS_OUT=$value;}},
"periodAt":{get:function(){return periodAt;},set:function($value){periodAt=$value;}},
"needWhere":{get:function(){return needWhere;},set:function($value){needWhere=$value;}},
"rateAt":{get:function(){return rateAt;},set:function($value){rateAt=$value;}},
"clockBoundary":{get:function(){return clockBoundary;},set:function($value){clockBoundary=$value;}},
"realSecondsBetween":{get:function(){return realSecondsBetween;},set:function($value){realSecondsBetween=$value;}},
"clockTimeBefore":{get:function(){return clockTimeBefore;},set:function($value){clockTimeBefore=$value;}},
"isNight":{get:function(){return isNight;},set:function($value){isNight=$value;}},
"DIFV":{get:function(){return DIFV;},set:function($value){DIFV=$value;}},
"dif":{get:function(){return dif;},set:function($value){dif=$value;}},
"ITEMS":{get:function(){return ITEMS;},set:function($value){ITEMS=$value;}},
"ITEM_GLYPH":{get:function(){return ITEM_GLYPH;},set:function($value){ITEM_GLYPH=$value;}},
"ITEM_COL":{get:function(){return ITEM_COL;},set:function($value){ITEM_COL=$value;}},
"itemGlyph":{get:function(){return itemGlyph;},set:function($value){itemGlyph=$value;}},
"itemColor":{get:function(){return itemColor;},set:function($value){itemColor=$value;}},
"U2M":{get:function(){return U2M;},set:function($value){U2M=$value;}}
});
})(GameModules.imports("game3d/js/core.js"));
