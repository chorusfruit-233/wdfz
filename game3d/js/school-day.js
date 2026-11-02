/* 固定集合点与跨课时外出登记；不占背包，不依赖随机假条。 */
'use strict';
var SchoolDay={
  deadline:function(){return S.tsec<770?770:S.tsec<1070?1070:LIGHTS_OUT;},
  permit:function(){
    var p=RT.outing;
    return !!(S.day>=2&&p&&p.day===S.day&&Number.isFinite(p.from)&&p.from>=440&&
      p.from<=S.tsec&&[770,1070,LIGHTS_OUT].indexOf(p.until)>=0&&
      p.until===(p.from<770?770:p.from<1070?1070:LIGHTS_OUT)&&S.tsec<p.until);
  },
  excused:function(){return this.permit()&&!examNow();},
  grant:function(quiet){
    if(S.dead)return false;
    if(S.day===1){if(!quiet)toast('第一天暂不开放外出登记 · 假条仍可使用');return false;}
    if(isNight()){if(!quiet)toast('熄灯后不能登记外出 · 请回宿舍');return false;}
    RT.outing={day:S.day,from:S.tsec,until:this.deadline()};
    AttendanceDuty.grant(quiet?'inspection':'manual');
    if(!quiet)toast('外出登记已记下 · '+this.returnLabel());
    return true;
  },
  returnLabel:function(){
    var until=this.permit()?RT.outing.until:this.deadline();
    return until===LIGHTS_OUT?'熄灯前回宿舍':fmtClock(until)+' 回教室';
  },
  restore:function(){
    /* 旧许可只恢复原期限，不补造检查责任。 */
    RT.dayRhythmVersion=1;
    if(!this.permit())RT.outing=null;
    if(RT.inspection)RT.inspection.calm=saveNum(RT.inspection.calm,0,8);
    RT.studySkipped=saveNum(RT.studySkipped,0,1e9);
  }
};
