/* 里世界 3D · 特殊校园日
   每个游戏日按本局种子定一次，记在 RT.dayEvents[day]，跟着存档走：读档、跳时、重开同一个存档都是同一个结果。
     校庆 anniversary —— 当天所有「每秒往下掉」的 SAN 速度减半（异象逐秒、巡察、危险区、车道上的东西、学生会注视），
                        一次性扣除、恢复、上限和 SAN 归零照旧；一局最多一次。教学楼正面挂横幅，早上有广播。
     占课 occupied   —— 音乐课、信息课被主科占了：琴房、机房当天不开；课桌上的短互动答对多回一点 SAN。
                        不加集合、不收外出登记、不改课表，也不动每天 1200 秒的连续探索预算。
   「当天」按上学的那一段算：07:20 到熄灯后 22:30 换日为止；前一晚的宿舍时间不算。第一天（11:40 开局的半天）不会是特殊日。
   概率、首个可能的日子和占课的具体内容都是实施取值，不是用户定下的数，集中在 DAY_EVENT_CFG。 */
'use strict';

var DAY_EVENT_CFG={
  firstDay:2,
  p:{anniversary:0.18, occupied:0.22},
  drain:{anniversary:0.5},
  occupied:{closed:['piano','pc'], lessonBonus:2}
};
var DAY_EVENT_DEF={
  anniversary:{n:'校庆', tag:'校庆日',
    say:'广播：「今天是我校建校纪念日。各班照常上课，课间可以去教学楼前看看校庆横幅。」——喇叭里的声音很高兴。我也跟着松了一点。'},
  occupied:{n:'占课', tag:'占课',
    say:'广播：「今天的音乐课、信息课改上数学，琴房和机房不开。」——教室里响起一片很轻的叹气。',
    closed:{piano:'我：琴房的门锁着。门上贴着一张纸：「今天的音乐课改上数学。」',
            pc:'我：机房的门锁着。玻璃上贴着课表，信息课那一格被人用红笔改成了「数学」。'}}
};
function dayHash(seed,day){
  var h=(seed^Math.imul((day|0)+0x9e37,0x85ebca6b))>>>0;
  h^=h>>>13; h=Math.imul(h,0xc2b2ae35)>>>0; h^=h>>>16;
  return (h>>>0)/4294967296;
}
var DayEvents={
  seed:function(){
    if(!Number.isFinite(RT.runSeed)) RT.runSeed=Math.floor(Math.random()*4294967296)>>>0;
    return RT.runSeed;
  },
  had:function(id){ var m=RT.dayEvents||{}; return Object.keys(m).some(function(k){ return m[k]===id; }); },
  roll:function(day){
    if(day<DAY_EVENT_CFG.firstDay) return 'none';
    var u=dayHash(DayEvents.seed(),day), p=DAY_EVENT_CFG.p, ev=RT.dayEvents||{};
    if(u<p.anniversary) return DayEvents.had('anniversary')?'none':'anniversary';
    if(u<p.anniversary+p.occupied) return ev[day-1]==='occupied'?'none':'occupied';   /* 不连着两天占课 */
    return 'none';
  },
  /* 当天还没定就定下来（只定一次） */
  ensure:function(){
    RT.dayEvents=RT.dayEvents||{};
    var d=S.day||1;
    if(RT.dayEvents[d]===undefined) RT.dayEvents[d]=DayEvents.roll(d);
    return RT.dayEvents[d];
  },
  /* 上学的那一段（07:20–22:30）才算「当天」 */
  schoolHours:function(){ return S.tsec>=440&&S.tsec<LIGHTS_OUT+10; },
  today:function(){
    if(!DayEvents.schoolHours()) return 'none';
    var id=RT.dayEvents&&RT.dayEvents[S.day];
    return DAY_EVENT_DEF[id]?id:'none';
  },
  is:function(id){ return DayEvents.today()===id; },
  drainMul:function(){ var m=DAY_EVENT_CFG.drain[DayEvents.today()]; return Number.isFinite(m)?m:1; },
  closed:function(act){ return DayEvents.is('occupied')&&DAY_EVENT_CFG.occupied.closed.indexOf(act)>=0; },
  closedMsg:function(act){ return DAY_EVENT_DEF.occupied.closed[act]||'我：门锁着。'; },
  lessonBonus:function(){ return DayEvents.is('occupied')?DAY_EVENT_CFG.occupied.lessonBonus:0; },
  tag:function(){ var d=DAY_EVENT_DEF[DayEvents.today()]; return d?d.tag:''; },
  tick:function(){
    if(S.screen!=='play'||S.dead) return;
    DayEvents.ensure();
    var id=DayEvents.today();
    RT.daySaid=RT.daySaid||{};
    if(id!=='none'&&!RT.daySaid[S.day]&&!(S.intro>0)&&!(typeof PRO!=='undefined'&&PRO.on)){
      RT.daySaid[S.day]=1;
      os(DAY_EVENT_DEF[id].say,6);
      try{ Playtest.event('特殊日',id); }catch(e){}
    }
    try{ DayDecor.sync(); }catch(e){}
  },
  /* 旧存档：读进来的那一天不补特殊日（免得半天里突然变成校庆）；之后的日子照常按种子定 */
  afterLoad:function(d){
    var rt=d&&d.rt||{};
    if(!rt.dayEvents||typeof rt.dayEvents!=='object'){ RT.dayEvents={}; RT.dayEvents[S.day||1]='none'; }
    if(!Number.isFinite(rt.runSeed)){
      var src=String(d&&d.diff||'')+'|'+((rt.carPlates||[]).join(','))+'|'+(d&&d.day||1);
      var h=2166136261>>>0;
      for(var i=0;i<src.length;i++){ h^=src.charCodeAt(i); h=Math.imul(h,16777619)>>>0; }
      RT.runSeed=h;
    }
  }
};
/* 每秒往下掉的 SAN 统一走这里：速度 × 当天的倍率（校庆 0.5）。一次性扣除不要用它。 */
function sanDrain(rate,dt,source){ if(rate>0&&dt>0) PlayerStats.changeSan(-(dt*rate*DayEvents.drainMul()),source||'drain'); }   /* 写入走 PlayerStats（模块边界） */

/* 校庆横幅：教学楼正面二楼，红底黄字。只在校庆当天、人在室外时挂着（单独一组，不进室外合并网格，也不参与碰撞）。 */
var DayDecor={grp:null,
  sync:function(){
    var want=S.mode==='out'&&DayEvents.is('anniversary')&&typeof GLR!=='undefined'&&!!GLR.scene;
    if(want&&!DayDecor.grp) DayDecor.build();
    else if(!want&&DayDecor.grp) DayDecor.clear();
  },
  texture:function(){
    var cv=document.createElement('canvas'); cv.width=1024; cv.height=96;
    var g=cv.getContext('2d');
    g.fillStyle='#b3121b'; g.fillRect(0,0,1024,96);
    g.fillStyle='#8a0d14'; g.fillRect(0,0,1024,6); g.fillRect(0,90,1024,6);
    g.fillStyle='#f6d36b'; g.font='bold 58px "Noto Serif CJK SC","Source Han Serif SC",serif';
    g.textAlign='center'; g.textBaseline='middle';
    g.fillText('热烈庆祝武大附中建校纪念日',512,50);
    var t=new THREE.CanvasTexture(cv); t.anisotropy=4;
    return t;
  },
  build:function(){
    var o=objById('teach'); if(!o) return;
    var cx=(o.x+o.w/2)*SC*U2M, fz=teachFrontZ();
    var grp=new THREE.Group(), mat=new THREE.MeshLambertMaterial({map:DayDecor.texture(),side:THREE.DoubleSide});
    /* 二、三楼之间：上下两道楼板边各挑出约 0.75 米，横幅挂在它们外沿，仰头看不会被楼板边挡住 */
    var banner=new THREE.Mesh(new THREE.PlaneGeometry(13,1.1),mat);
    banner.position.set(cx,5.55,fz+0.82); grp.add(banner);
    var rope=new THREE.MeshLambertMaterial({color:0x6a5a48});
    [-6.6,6.6].forEach(function(dx){ var r=new THREE.Mesh(new THREE.BoxGeometry(0.04,2.6,0.04),rope); r.position.set(cx+dx,5.55,fz+0.8); grp.add(r); });
    grp.name='day-decor'; GLR.scene.add(grp); DayDecor.grp=grp;
  },
  clear:function(){
    var grp=DayDecor.grp; DayDecor.grp=null; if(!grp) return;
    try{ GLR.scene.remove(grp); }catch(e){}
    grp.traverse(function(o){
      if(o.geometry) o.geometry.dispose();
      if(o.material){ if(o.material.map) o.material.map.dispose(); o.material.dispose(); }
    });
  }
};
