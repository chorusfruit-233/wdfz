/* @module-capsule */
(function($imports){
/* 学生会定时检查：游戏时刻触发，行为处罚按模拟运行秒结算。 */
'use strict';

/* warningSeconds：按自然运行秒预留返程；课表变速不能把广播压到最后几秒。 */
/* lateLimit：到点以后最多推迟多少游戏分钟开始（被电梯、异象、选项拦住）；超过就作废，不按「不在教室」处罚 */
var INSPECT_CONFIG={times:[770,1070],warningSeconds:60,lateLimit:3,duration:8,moveEvery:1,moveViolation:2,gazeSan:2,
  goodSan:3,badSan:8,goodViolation:8,badViolation:10,assimilation:3};
var INSPECT_WARN_TIMES=INSPECT_CONFIG.times.map(function(t){return (0,$imports.clockTimeBefore)(t,INSPECT_CONFIG.warningSeconds);});
var Inspection={
  state:function(){
    if(!$imports.RT.inspection)$imports.RT.inspection={seen:{},queue:[],current:null};
    if(!$imports.RT.inspection.warned)$imports.RT.inspection.warned={};
    return $imports.RT.inspection;
  },
  clearFx:function(){return $imports.InspectionView.clearFx.apply($imports.InspectionView,arguments); },
  cross:function(day,before,after){
    if($imports.S.screen!=='play'||after<=before)return;
    var st=Inspection.state();
    INSPECT_CONFIG.times.forEach(function(time,i){
      var key=day+':'+i, warn=INSPECT_WARN_TIMES[i];
      if(after>=warn&&after<time&&!st.warned[key]){
        st.warned[key]=true;
        (0,$imports.os)('广播：「请各班同学注意，学生会将于'+(i?'五点五十':'十二点五十')+'到各班检查，请坐回自己的座位。」',5.5,$imports.OS_FORCE);
        try{ $imports.SFX.click(); }catch(e){}
      }
      if(before<=time&&after>=time&&!st.seen[key]){
        st.seen[key]=true;st.warned[key]=true;st.queue.push({day:day,slot:i});
      }
    });
  },
  /* 广播之后、检查开始之前：这段时间的地点要求按教室显示 */
  upcoming:function(){
    if(Inspection.active())return false;
    var st=$imports.RT.inspection||{seen:{}};
    return INSPECT_CONFIG.times.some(function(time,i){
      var key=$imports.S.day+':'+i;
      return !st.seen[key]&&$imports.S.tsec>=INSPECT_WARN_TIMES[i]&&$imports.S.tsec<time;
    });
  },
  stale:function(item){return item.day!==$imports.S.day||$imports.S.tsec>INSPECT_CONFIG.times[item.slot]+INSPECT_CONFIG.lateLimit;},
  active:function(){return !!($imports.RT.inspection&&$imports.RT.inspection.current);},
  pending:function(){return !!(($imports.RT.inspection&&($imports.RT.inspection.current||$imports.RT.inspection.queue.length))||($imports.RT.inspection&&$imports.RT.inspection.scatter));},
  quiet:function(){return Inspection.upcoming()||Inspection.pending()||!!($imports.RT.inspection&&$imports.RT.inspection.calm>0);},
  points:function(){
    var result=[],n=20,i,j,angle,x,y;
    for(i=0;i<n&&result.length<6;i++){
      angle=i*$imports.TAU/n;
      for(j=0;j<4;j++){
        var dist=30+j*12;
        x=$imports.S.x+Math.cos(angle)*dist;y=$imports.S.y+Math.sin(angle)*dist;
        if(!(0,$imports.canStand)(x,y))continue;
        if(result.every(function(p){return Math.hypot(p.x-x,p.y-y)>15;}))result.push({x:x,y:y});
        break;
      }
    }
    return result;
  },
  buildFx:function(){return $imports.InspectionView.buildFx.apply($imports.InspectionView,arguments); },
  lineClear:function(point){
    var dx=point.x-$imports.S.x,dy=point.y-$imports.S.y,n=Math.ceil(Math.hypot(dx,dy)/3),R=$imports.S.mode==='in'?$imports.INTERIORS[$imports.S.room]:null;
    for(var i=1;i<n;i++){
      var x=$imports.S.x+dx*i/n,y=$imports.S.y+dy*i/n;
      if(R){var tile=(0,$imports.tileAt)(R,x,y);if(tile==='#'||(tile==='='&&!(0,$imports.doorIsOpen)(R,x,y)))return false;}
      else if((0,$imports.solidAtOutdoor)(x,y))return false;
    }
    return true;
  },
  looking:function(c){
    if($imports.HIDE.on||Math.abs($imports.S.pitch)>0.9)return false;
    return c.points.some(function(p){
      var dx=p.x-$imports.S.x,dy=p.y-$imports.S.y,d=Math.hypot(dx,dy);
      return d>1&&d<95&&(0,$imports.angDiff)($imports.S.ang,Math.atan2(dy,dx))<0.42&&Inspection.lineClear(p);
    });
  },
  start:function(item){
    var st=Inspection.state(),c={day:item.day,slot:item.slot,t:0,look:0,move:0,
      result:(0,$imports.onLeave)()?'excused':(0,$imports.atMySeat)()?'present':'absent',excused:(0,$imports.onLeave)(),compliant:(0,$imports.atMySeat)(),room:$imports.S.mode==='in'?$imports.S.room:'out',points:Inspection.points()};
    st.current=c;
    if(c.excused){c.compliant=false;c.points=[];Inspection.clearFx();Inspection.finish(c);return;}
    $imports.PHONE.stop();$imports.TerminalUI.close();Inspection.buildFx(c);
    (0,$imports.os)('我：走廊里的声音一下子停了。一圈黑影站在附近——别动，也别看它们。',4.5,$imports.OS_FORCE);
  },
  cancel:function(){
    if($imports.RT.inspection){$imports.AttendanceDuty.cancel($imports.RT.inspection.current);$imports.RT.inspection.current=null;$imports.RT.inspection.scatter=null;}
    Inspection.clearFx();
  },
  scatterTick:function(){return $imports.InspectionView.scatterTick.apply($imports.InspectionView,arguments); },
  finish:function(c){
    var st=Inspection.state();if(!c||st.current!==c)return;
    st.settled=st.settled||{};var key=c.day+':'+c.slot;st.current=null;
    if(st.settled[key])return;
    c.result=c.excused?'excused':c.compliant?'present':'absent';st.settled[key]=c.result;
    (0,$imports.gameFact)('inspection',{day:c.day,slot:c.slot,result:c.result,excused:!!c.excused,compliant:!!c.compliant&&!c.excused});
    if(c.excused){$imports.AttendanceDuty.settle(c);(0,$imports.os)('请假有效，本次检查已免检。',3.5,$imports.OS_KEEP);(0,$imports.autoSave)();return;}
    st.calm=8;st.calmRoom=c.room;
    st.scatter={t:0,duration:.8,room:c.room};$imports.InspectionView.finish(st.scatter);
    $imports.PlayerStats.changeSan(-((c.compliant?INSPECT_CONFIG.goodSan:INSPECT_CONFIG.badSan)),'inspection',{min:0});
    (0,$imports.addViolation)(c.compliant?-INSPECT_CONFIG.goodViolation:INSPECT_CONFIG.badViolation,'inspection');
    $imports.PlayerStats.changeAssimilation(c.compliant?INSPECT_CONFIG.assimilation:-INSPECT_CONFIG.assimilation,'inspection',{min:0,max:100});
    (0,$imports.os)(c.compliant?'我：黑影散开了。我一直坐在自己的座位上。':'我：黑影散开了。它们记下了那个空着的座位。',3.8,$imports.OS_FORCE);
    $imports.AttendanceDuty.settle(c);
    (0,$imports.settleSan)();if(!$imports.S.dead&&$imports.S.tt>=100)(0,$imports.resolveAssimilation)();
    if(c.compliant&&(0,$imports.atMySeat)()&&!$imports.S.dead)$imports.SchoolDay.grant(true);
    (0,$imports.autoSave)();
  },
  discardStale:function(){var st=this.state();while(st.queue.length&&this.stale(st.queue[0]))$imports.AttendanceDuty.cancel(st.queue.shift());},
  tick:function(dt){
    var st=Inspection.state(),c=st.current;
    if(st.scatter){
      st.scatter.t+=dt;$imports.InspectionView.scatterTick(dt,st.scatter);
      if(st.scatter.t>=st.scatter.duration||st.scatter.room!==($imports.S.mode==='in'?$imports.S.room:'out'))st.scatter=null;
    }
    st.calm=Math.max(0,(st.calm||0)-dt);
    if(!c){
      if(st.scatter)return;
      if($imports.S.room==='portal_tunnel'){Inspection.discardStale();return;}
      /* 排队太久的（玩家当时在电梯里、在异象里，没法回教室）作废 */
      while(st.queue.length&&Inspection.stale(st.queue[0]))$imports.AttendanceDuty.cancel(st.queue.shift());
      if(st.queue.length&&!$imports.AN.active&&!$imports.UI.chooseOpen&&!$imports.PatrolWorld.localChase()&&!$imports.LESSON.on){Inspection.start(st.queue.shift());}
      return;
    }
    if(c.excused){Inspection.finish(c);return;}
    if($imports.S.dead||$imports.S.screen!=='play'){st.current=null;Inspection.clearFx();return;}
    var here=$imports.S.mode==='in'?$imports.S.room:'out';
    if(c.room!==here){c.room=here;c.points=Inspection.points();Inspection.buildFx(c);}
    else $imports.InspectionView.sync(c);
    if(!(0,$imports.atMySeat)()){c.compliant=false;c.result='absent';}
    c.t+=dt;
    if($imports.S.moving){
      c.move+=dt;
      while(c.move>=INSPECT_CONFIG.moveEvery){c.move-=INSPECT_CONFIG.moveEvery;(0,$imports.addViolation)(INSPECT_CONFIG.moveViolation,'inspection');}
    }
    if(Inspection.looking(c)){
      c.look+=dt*$imports.DayEvents.drainMul();                      /* 校庆：注视扣 SAN 的速度也减半 */
      while(c.look>=1){c.look-=1;$imports.PlayerStats.changeSan(-(INSPECT_CONFIG.gazeSan),'inspection',{min:0});$imports.VisualState.hurt=Math.max($imports.VisualState.hurt||0,.2);}
    }
    if(c.t>=INSPECT_CONFIG.duration)Inspection.finish(c);
  }
};

/* @module-exports */
GameModules.publish("game3d/js/inspection.js",{
"INSPECT_CONFIG":{get:function(){return INSPECT_CONFIG;},set:function($value){INSPECT_CONFIG=$value;}},
"INSPECT_WARN_TIMES":{get:function(){return INSPECT_WARN_TIMES;},set:function($value){INSPECT_WARN_TIMES=$value;}},
"Inspection":{get:function(){return Inspection;},set:function($value){Inspection=$value;}}
});
})(GameModules.imports("game3d/js/inspection.js"));
