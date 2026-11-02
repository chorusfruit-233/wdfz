/* 外出许可是当前日历资格，检查责任是独立的、不可用续签推迟的承诺。 */
'use strict';
var AttendanceDuty={state:{seq:0,duties:[],processed:{}},
  reset:function(){this.state={seq:0,duties:[],processed:{}};},
  next:function(after){
    var day=after?after.day:S.day,slot;
    if(after){slot=after.slot+1;if(slot>1){day++;slot=0;}}
    else slot=S.tsec<770?0:S.tsec<1070?1:0;
    if(!after&&S.tsec>=1070)day++;
    var seen=Inspection.state().seen;
    while(seen[day+':'+slot]){slot++;if(slot>1){day++;slot=0;}}
    return {day:day,slot:slot,id:day+':'+slot};
  },
  grant:function(source){
    var target=this.next(),st=this.state;
    if(st.duties.some(function(d){return d.status==='pending'&&d.targetCheckId===target.id;}))return;
    st.duties.push({dutyId:'duty-'+(++st.seq),source:source,issuedAt:Mechanics.activePlaySeconds,targetCheckId:target.id,status:'pending'});
    this.prune();Mechanics.dirty=true;
  },
  settle:function(c){
    var key=c.day+':'+c.slot,st=this.state;
    var matching=st.duties.filter(function(d){return d.status==='pending'&&d.targetCheckId===key;});
    if(!matching.length||st.processed[key])return;
    /* 先记处罚已落账，再发一次事件；保命的清理不会重放这次缺席。 */
    st.processed[key]=c.compliant?'fulfilled':'absent';
    matching.forEach(function(d){d.status=c.compliant?'fulfilled':'absent';d.settledAt=Mechanics.activePlaySeconds;});
    if(!c.compliant){PatrolWorld.registeredAbsence(key);Playtest.event('登记后缺席',key);}
    Mechanics.dirty=true;this.prune();
  },
  cancel:function(c){
    if(!c)return;var old=c.day+':'+c.slot,next=this.next(c);
    if(next.day<S.day||next.day===S.day&&INSPECT_CONFIG.times[next.slot]<=S.tsec)next=this.next();
    this.state.duties.forEach(function(d){if(d.status==='pending'&&d.targetCheckId===old)d.targetCheckId=next.id;});
    Mechanics.dirty=true;
  },
  prune:function(){this.state.duties=this.state.duties.filter(function(d){return d.status==='pending';}).concat(this.state.duties.filter(function(d){return d.status!=='pending';}).slice(-20));},
  restore:function(){
    var self=this;
    this.state.duties.forEach(function(d){if(d.status!=='pending')return;var a=d.targetCheckId.split(':').map(Number),c={day:a[0],slot:a[1]};
      /* 正在结算或仍排队的检查继续；过期但从未执行的检查滚动，绝不追罚。 */
      var st=Inspection.state(),exists=(st.current&&st.current.day===c.day&&st.current.slot===c.slot)||st.queue.some(function(q){return q.day===c.day&&q.slot===c.slot;});
      if(!exists&&(c.day<S.day||c.day===S.day&&INSPECT_CONFIG.times[c.slot]<S.tsec))self.cancel(c);
    });
  }
};
GameModules.persistent('attendanceDuty',{
  reset:function(){AttendanceDuty.reset();},save:function(){return AttendanceDuty.state;},
  load:function(d){
    if(!d||!Array.isArray(d.duties)){saveReport('attendanceDuty','检查责任数据无效，未补造处罚');return;}
    var st=AttendanceDuty.state;st.seq=Math.floor(saveNum(d.seq,0,1e9));
    st.duties=d.duties.filter(function(x){return x&&typeof x.dutyId==='string'&&/^\d+:[01]$/.test(x.targetCheckId)&&['pending','fulfilled','absent'].includes(x.status);}).slice(-100);
    Object.keys(d.processed||{}).forEach(function(k){if(/^\d+:[01]$/.test(k)&&['fulfilled','absent'].includes(d.processed[k]))st.processed[k]=d.processed[k];});
    AttendanceDuty.restore();
  }
});
