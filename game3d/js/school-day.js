/* 固定集合点与跨课时外出登记；不占背包，不依赖随机假条。 */
'use strict';
var SchoolDay={
  deadline:function(){return S.tsec<770?770:S.tsec<1070?1070:LIGHTS_OUT;},
  permit:function(){
    var p=RT.outing;
    return !!(p&&p.day===S.day&&Number.isFinite(p.from)&&p.from>=440&&
      p.from<=S.tsec&&[770,1070,LIGHTS_OUT].indexOf(p.until)>=0&&
      p.until===(p.from<770?770:p.from<1070?1070:LIGHTS_OUT)&&S.tsec<p.until);
  },
  excused:function(){return this.permit()&&!examNow();},
  grant:function(quiet){
    if(S.dead)return false;
    if(isNight()){if(!quiet)toast('熄灯后不能登记外出 · 请回宿舍');return false;}
    RT.outing={day:S.day,from:S.tsec,until:this.deadline()};
    if(!quiet)toast('外出登记已记下 · '+this.returnLabel());
    return true;
  },
  returnLabel:function(){
    var until=this.permit()?RT.outing.until:this.deadline();
    return until===LIGHTS_OUT?'熄灯前回宿舍':fmtClock(until)+' 回教室';
  },
  restore:function(){
    /* 已看过移交单的旧档补登记一次；新档过期的许可绝不在读档时续签。 */
    if(!RT.dayRhythmVersion&&RT.investigation&&RT.investigation.entries&&RT.investigation.entries.notice)this.grant(true);
    RT.dayRhythmVersion=1;
    if(!this.permit())RT.outing=null;
    if(RT.inspection)RT.inspection.calm=saveNum(RT.inspection.calm,0,8);
    RT.studySkipped=saveNum(RT.studySkipped,0,1e9);
  }
};
