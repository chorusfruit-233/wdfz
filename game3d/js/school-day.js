/* @module-capsule */
(function($imports){
/* 固定集合点与跨课时外出登记；不占背包，不依赖随机假条。 */
'use strict';
var SchoolDay={
  deadline:function(){return $imports.S.tsec<770?770:$imports.S.tsec<1070?1070:$imports.LIGHTS_OUT;},
  permit:function(){
    var p=$imports.RT.outing;
    return !!($imports.S.day>=2&&p&&p.day===$imports.S.day&&Number.isFinite(p.from)&&p.from>=440&&
      p.from<=$imports.S.tsec&&[770,1070,$imports.LIGHTS_OUT].indexOf(p.until)>=0&&
      p.until===(p.from<770?770:p.from<1070?1070:$imports.LIGHTS_OUT)&&$imports.S.tsec<p.until);
  },
  excused:function(){return this.permit()&&!(0,$imports.examNow)();},
  grant:function(quiet){
    if($imports.S.dead)return false;
    if($imports.S.day===1){if(!quiet)(0,$imports.toast)('第一天暂不开放外出登记 · 假条仍可使用');return false;}
    if((0,$imports.isNight)()){if(!quiet)(0,$imports.toast)('熄灯后不能登记外出 · 请回宿舍');return false;}
    $imports.RT.outing={day:$imports.S.day,from:$imports.S.tsec,until:this.deadline()};
    $imports.AttendanceDuty.grant(quiet?'inspection':'manual');
    if(!quiet)(0,$imports.toast)('外出登记已记下 · '+this.returnLabel()+'；到场责任：'+$imports.AttendanceDuty.summary());
    return true;
  },
  returnLabel:function(){
    var until=this.permit()?$imports.RT.outing.until:this.deadline();
    return until===$imports.LIGHTS_OUT?'熄灯前回宿舍':(0,$imports.fmtClock)(until)+' 回教室';
  },
  restore:function(){
    /* 旧许可只恢复原期限，不补造检查责任。 */
    $imports.RT.dayRhythmVersion=1;
    if(!this.permit())$imports.RT.outing=null;
    if($imports.RT.inspection)$imports.RT.inspection.calm=(0,$imports.saveNum)($imports.RT.inspection.calm,0,8);
    $imports.RT.studySkipped=(0,$imports.saveNum)($imports.RT.studySkipped,0,1e9);
  }
};

/* @module-exports */
GameModules.publish("game3d/js/school-day.js",{
"SchoolDay":{get:function(){return SchoolDay;},set:function($value){SchoolDay=$value;}}
});
})(GameModules.imports("game3d/js/school-day.js"));
