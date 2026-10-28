/* 里世界 3D · 基础：数学工具、常量、课表、物品与天赋 */
'use strict';

var TAU=Math.PI*2, PI=Math.PI, DEG=PI/180;
function clamp(v,a,b){return v<a?a:v>b?b:v;}
function lerp(a,b,t){return a+(b-a)*t;}
function rnd(a,b){return a+Math.random()*(b-a);}
function ri(a,b){return Math.floor(rnd(a,b+1));}
function pick(a){return a[Math.floor(Math.random()*a.length)];}
function dist2(ax,ay,bx,by){var dx=ax-bx,dy=ay-by;return dx*dx+dy*dy;}
function angDiff(a,b){return Math.abs(((a-b+PI*3)%TAU)-PI);}
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

var RATE={CLASS:80,BREAK:12,MEAL:14,ASSEM:30,FREE:37,NIGHT:17};
/* 上课 8:00–12:15、14:00–17:20；晚自习 18:10–19:40、20:00–22:00；22:20 熄灯 */
var SCHED=[
  [440,480,'早读',    '教室',RATE.CLASS],
  [480,525,'第 1 节','教室',RATE.CLASS],
  [525,540,'课间',    '自由',RATE.BREAK],
  [540,585,'第 2 节','教室',RATE.CLASS],
  [585,620,'课间操',  '操场',RATE.ASSEM],
  [620,665,'第 3 节','教室',RATE.CLASS],
  [665,690,'课间',    '自由',RATE.BREAK],
  [690,735,'第 4 节','教室',RATE.CLASS],
  [735,800,'午饭',    '自由',RATE.MEAL],
  [800,840,'午休',    '自由',RATE.MEAL],
  [840,885,'第 5 节','教室',RATE.CLASS],
  [885,890,'课间',    '自由',RATE.BREAK],
  [890,935,'第 6 节','教室',RATE.CLASS],
  [935,945,'课间',    '自由',RATE.BREAK],
  [945,990,'第 7 节','教室',RATE.CLASS],
  [990,995,'课间',    '自由',RATE.BREAK],
  [995,1040,'第 8 节','教室',RATE.CLASS],
  [1040,1060,'课外活动','自由',RATE.FREE],
  [1060,1090,'晚饭',  '自由',RATE.MEAL],
  [1090,1180,'晚自习一','教室',RATE.NIGHT],
  [1180,1200,'课间',  '自由',RATE.BREAK],
  [1200,1320,'晚自习二','教室',RATE.NIGHT],
  [1320,1340,'洗漱',  '自由',RATE.NIGHT],
  [1340,1500,'熄灯后','自由',RATE.NIGHT]
];
var MEALS=[[735,800],[1060,1090]];         /* 食堂开饭的时间段 */
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
/* 《先辈》：11:45:00–11:45:10 这 10 秒，时间慢到大约 15 个真实秒（流速单位是"游戏秒 / 真实秒"） */
var BEAST_T0=705, BEAST_T1=705+10/60, BEAST_RATE=10/15;
function rateAt(t){ return (t>=BEAST_T0&&t<BEAST_T1)?BEAST_RATE:periodAt(t)[4]; }
function isNight(){ return S.tsec>=LIGHTS_OUT||S.tsec<440; }

/* 预知梦：中等（第一天死了能醒三次，异象 40–64 秒一次，提前一点告诉你下一个是什么）
   梦魇：中上（不会醒，异象 24–40 秒一次，致死阈值更低，二选一的代价更重） */
var DIFV={ easy:{iv:1.0,san:0.82}, hard:{iv:1.0,san:1.15} };
function dif(){ return DIFV[S.diff]||DIFV.easy; }

var ITEMS={
  card:{n:'学生证',d:'照片上的人我不认识，班号是我们班。'},
  phone:{n:'手机',d:'还有电。锁屏是黑的。屏幕能当光源。'},
  chalk:{n:'粉笔',d:'半截。断口很新。'},
  map:{n:'平面图',d:'边角被翻烂了。能看懂这所学校。'},
  key:{n:'钥匙',d:'一串车钥匙。牌号刻在环上。'},
  torch:{n:'手电筒',d:'光很弱。但在地下车库里，它是唯一能定住东西的东西。'},
  brolly:{n:'雨伞',d:'伞骨断了一根，还能撑。'},
  coat:{n:'校服外套',d:'比我穿的那件大一号。'},
  pill:{n:'药片',d:'名字被撕掉了。吃下去能压住手抖。'},
  notebook:{n:'笔记本',d:'没写过的本子。有它，想到的事就不会忘。'},
  pen:{n:'笔',d:'一支笔。还能写。'},
  snack:{n:'士力架',d:'压在卷子底下的一条。吃下去，10 秒内怎么跑都不累。'},
  battery:{n:'电池',d:'两节。外壳上写着日期，很旧了。'},
  compass:{n:'罗盘',d:'指针不指北——指向最近的那扇门。'},
  metronome:{n:'节拍器',d:'摆锤自己在动，可是没有声音。'},
  goggles:{n:'护目镜',d:'镜片上有洗不掉的斑点。'},
  hw:{n:'作业本',d:'写完了的作业。字很工整，不是我的。'},
  coin:{n:'硬币',d:'边缘磨得很圆。食堂窗口和售货机都收；在车库里扔出去会有声音。'},
  usb:{n:'U 盘',d:'上面贴着「门禁」两个字。'},
  watch:{n:'手表',d:'带秒针。能数到秒。'},
  memo:{n:'纸条',d:'上面写着门禁和白名单的事。'},
  roomkey:{n:'机房钥匙',d:'铜的，磨得发亮。塑料标签上写着「机房」。'},
  /* 高级物品 */
  coil:{n:'铜线圈',d:'从服务器里抽出来的一卷。缠得很密，摸上去一直在发烫。（传送门材料）'},
  lens:{n:'透镜',d:'显微镜上拧下来的物镜。透过它看，墙后面像是还有一层。（传送门材料）'},
  vial:{n:'荧光试剂',d:'离心机甩出来的一管，颜色一直在变。（传送门材料）'},
  atlas:{n:'建筑总览图',d:'每栋楼每一层都画在上面。有几处用红笔圈着。'},
  elixir:{n:'不知名药丸',d:'没有说明书的一粒。要死的时候，它会把你拽回来一次。'},
  seal:{n:'符纸',d:'折成三角的黄纸。巡察者盯上你的时候，它替你挡一次。'}
};
var ITEM_GLYPH={
  card:'▣', phone:'▤', chalk:'▬', map:'▦', key:'⚿', torch:'▮', brolly:'☂',
  coat:'▧', pill:'◍', notebook:'▤', pen:'✎', snack:'▬', battery:'▮',
  compass:'◎', metronome:'⧗', goggles:'◉', hw:'▤', coin:'◉', usb:'▮',
  watch:'◷', memo:'▭', roomkey:'⚿',
  coil:'◎', lens:'◌', vial:'▯', atlas:'▦', elixir:'◍', seal:'△'
};
var ITEM_COL={
  coil:'#d08a4a', lens:'#a8d8e8', vial:'#7fe0a0', atlas:'#c8b88a', elixir:'#e0a0e0', seal:'#e0c040',
  torch:'#c8a24a', phone:'#7fb0c8', key:'#c8a24a', coin:'#c8a24a',
  pill:'#c86a6a', snack:'#b89a5a', battery:'#8ac8a4', compass:'#8aa8c8',
  roomkey:'#c8b060'
};
function itemGlyph(id){ return ITEM_GLYPH[id]||'▫'; }
function itemColor(id){ return ITEM_COL[id]||'#9fb8ab'; }

var TALENTS={
  code:{n:'编程社',d:'机房那套东西一眼就懂。'},
  drive:{n:'车感好',d:'我爸教过我怎么开车。'},
  map:{n:'过目不忘',d:'走过的路不会忘。'},
  stomach:{n:'铁胃',d:'胃比一般人结实。'},
  night:{n:'夜视',d:'暗的地方也看得清。'},
  hand:{n:'手稳',d:'扔东西很少失手。'},
  watch:{n:'秒表',d:'手腕上有块带秒针的表。'},
  thin:{n:'瘦小',d:'比同龄人瘦小一圈。'},
  cold:{n:'血冷',d:'不容易慌。'},
  known:{n:'熟人',d:'保安叫得出我的名字。'},
  immune:{n:'天生免疫',d:'总有一次要命的事会绕开我。'},
  crowd:{n:'藏在人群里',d:'人多的时候不显眼。'}
};
/* 已有存档仍可读取旧天赋；新局只随机有实际效果的天赋。 */
var TAL_KEYS=['code','drive','stomach','night','watch','thin','immune'];
