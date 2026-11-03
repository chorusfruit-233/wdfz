/* @module-capsule */
(function($imports){
/* 校园随游戏时间变危险；只记本局到达过的最晚时刻，暂停和离线不计时。 */
'use strict';
var CampusPressure={
  /* 连续游戏分钟；22:30 换日，翌日 01:00 跳到 07:20。区间内线性过渡。 */
  curve:[
    {clock:1090,anomaly:1,danger:1,passive:1,rest:1},
    {clock:1350,anomaly:.55,danger:1.65,passive:.45,rest:.70},
    {clock:2790,anomaly:.42,danger:2,passive:.30,rest:.55},
    {clock:4230,anomaly:.32,danger:2.35,passive:.20,rest:.45},
    {clock:5670,anomaly:.28,danger:2.5,passive:.15,rest:.40}
  ],
  messages:[null,
    '我：天色暗下来后，走廊里的灯一盏盏暗了下去。出口得趁早找。',
    '我：又过了一天。歇过了，那阵嗡声还是没停。已经找到的东西还在。',
    '我：拖得越久，这里越不肯放人。药和已经查到的线索，得留给最后那段路。',
    '我：几乎没有喘息的空当了。要趁它们离开的间隙往出口走。',
    '我：校园已经彻底变了。但那些躲避它们的办法，应该还管用。'
  ],
  clock:function(){
    var saved=$imports.RT.pressureClock, now=(0,$imports.gameClock)();
    saved=Number.isFinite(saved)&&saved>=0?saved:700;
    if($imports.S.screen==='play'&&Number.isFinite(now))saved=Math.max(saved,now);
    return saved;
  },
  observe:function(){
    var saved=this.clock();
    $imports.RT.pressureClock=saved;
    return saved;
  },
  restore:function(){
    this.observe();
    var seen=$imports.RT.pressureSeen;
    $imports.RT.pressureSeen=Number.isInteger(seen)?(0,$imports.clamp)(seen,0,this.current().stage):0;
  },
  current:function(){
    /* HUD、灯光与音效可查询压力，但不因此写入权威状态。 */
    var clock=this.clock();
    if(this._clock===clock)return this._value;
    var value=$imports.GameTimeRules.pressure(this.curve,clock);
    this._clock=clock;this._value=value;
    return value;
  },
  restGain:function(base){return Math.round(base*this.current().rest*10)/10;},
  tick:function(){
    this.observe();
    var stage=this.current().stage;
    if(stage<=($imports.RT.pressureSeen||0)||$imports.S.dead||$imports.S.screen!=='play')return;
    /* 不抢剧情、检查或危险预警；多次跨日只补最新一条，不逐条轰炸。 */
    if($imports.PRO.on||$imports.PAUSE.on||$imports.UI.anyOpen()||$imports.DLG.open||$imports.PC.on||$imports.PHONE.on||$imports.LESSON.on||
      $imports.AN.active||($imports.AN.pre&&$imports.AN.next<=8)||$imports.PatrolWorld.localChase()||$imports.HIDE.on||$imports.Inspection.quiet())return;
    $imports.RT.pressureSeen=stage;
    (0,$imports.os)(this.messages[stage],5);
  }
};

/* @module-exports */
GameModules.publish("game3d/js/campus-pressure.js",{
"CampusPressure":{get:function(){return CampusPressure;},set:function($value){CampusPressure=$value;}}
});
})(GameModules.imports("game3d/js/campus-pressure.js"));
