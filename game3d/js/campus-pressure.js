/* 校园随游戏时间变危险；只记本局到达过的最晚时刻，暂停和离线不计时。 */
'use strict';
var CampusPressure={
  /* 连续游戏分钟；22:30 换日，翌日 01:00 跳到 07:20。区间内线性过渡。 */
  curve:[
    {clock:1090,anomaly:1,patrol:1,danger:1,passive:1,rest:1},
    {clock:1350,anomaly:.55,patrol:.60,danger:1.65,passive:.45,rest:.70},
    {clock:2790,anomaly:.42,patrol:.45,danger:2,passive:.30,rest:.55},
    {clock:4230,anomaly:.32,patrol:.35,danger:2.35,passive:.20,rest:.45},
    {clock:5670,anomaly:.28,patrol:.30,danger:2.5,passive:.15,rest:.40}
  ],
  labels:['尽早离校','危险渐近','高危','危险加剧','危机四伏','危机四伏'],
  messages:[null,
    '我：天色暗下来后，怪事越来越密。休息也不太管用了，最好今天就找到出口。',
    '我：又过了一天。校园更危险了，休息恢复得更慢。已经找到的东西还在，得尽快离开。',
    '我：拖得越久，这里越不肯放人。药和已经查到的线索，得留给最后那段路。',
    '我：几乎没有喘息的空当了。要趁它们离开的间隙往出口走。',
    '我：校园已经彻底变了。但那些躲避它们的办法，应该还管用。'
  ],
  clock:function(){
    var saved=RT.pressureClock, now=gameClock();
    saved=Number.isFinite(saved)&&saved>=0?saved:700;
    if(S.screen==='play'&&Number.isFinite(now))saved=Math.max(saved,now);
    return saved;
  },
  observe:function(){
    var saved=this.clock();
    RT.pressureClock=saved;
    return saved;
  },
  restore:function(){
    this.observe();
    var seen=RT.pressureSeen;
    RT.pressureSeen=Number.isInteger(seen)?clamp(seen,0,this.current().stage):0;
  },
  current:function(){
    /* HUD、灯光与音效可查询压力，但不因此写入权威状态。 */
    var clock=this.clock();
    if(this._clock===clock)return this._value;
    var value=GameTimeRules.pressure(this.curve,clock);
    this._clock=clock;this._value=value;
    return value;
  },
  restGain:function(base){return Math.round(base*this.current().rest*10)/10;},
  tick:function(){
    this.observe();
    var stage=this.current().stage;
    if(stage<=(RT.pressureSeen||0)||S.dead||S.screen!=='play')return;
    /* 不抢剧情、检查或危险预警；多次跨日只补最新一条，不逐条轰炸。 */
    if(PRO.on||PAUSE.on||UI.anyOpen()||DLG.open||PC.on||PHONE.on||LESSON.on||
      AN.active||(AN.pre&&AN.next<=8)||PAT.state!=='idle'||HIDE.on||Inspection.quiet())return;
    RT.pressureSeen=stage;
    os(this.messages[stage],5);
  },
  paint:function(){
    var el=document.getElementById('campuspressure');if(!el)return;
    var stage=this.current().stage, label='第 '+S.day+' 天 · '+this.labels[stage];
    if(el.textContent!==label)el.textContent=label;
    if(el.dataset.stage!==String(stage))el.dataset.stage=String(stage);
  }
};
