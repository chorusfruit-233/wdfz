/* 学生会定时检查：游戏时刻触发，行为处罚按模拟运行秒结算。 */
'use strict';

/* warnLead：提前多少游戏分钟用校园广播提醒回教室（检查时只认教室，平时这两段是自由时间） */
/* lateLimit：到点以后最多推迟多少游戏分钟开始（被电梯、异象、选项拦住）；超过就作废，不按「不在教室」处罚 */
var INSPECT_CONFIG={times:[770,1070],warnLead:8,lateLimit:3,duration:8,moveEvery:1,moveViolation:2,gazeSan:2,
  goodSan:3,badSan:8,goodViolation:8,badViolation:10,assimilation:3};
var INSPECT_FX={group:null,room:null,points:null,scatter:null};
var Inspection={
  state:function(){
    if(!RT.inspection)RT.inspection={seen:{},queue:[],current:null};
    if(!RT.inspection.warned)RT.inspection.warned={};
    return RT.inspection;
  },
  clearFx:function(){
    if(INSPECT_FX.group){
      if(GLR.scene)GLR.scene.remove(INSPECT_FX.group);
      ThreeBackend.disposeGroup(INSPECT_FX.group);
    }
    INSPECT_FX.group=null;INSPECT_FX.room=null;INSPECT_FX.points=null;INSPECT_FX.scatter=null;
  },
  cross:function(day,before,after){
    if(S.screen!=='play'||after<=before)return;
    var st=Inspection.state();
    INSPECT_CONFIG.times.forEach(function(time,i){
      var key=day+':'+i, warn=time-INSPECT_CONFIG.warnLead;
      if(before<=warn&&after>=warn&&after<time&&!st.warned[key]){
        st.warned[key]=true;
        os('广播：「请各班同学注意，学生会将于'+(i?'五点五十':'十二点五十')+'到各班检查，请回到自己的教室。」',5.5,OS_FORCE);
        try{ SFX.click(); }catch(e){}
      }
      if(before<=time&&after>=time&&!st.seen[key]){
        st.seen[key]=true;st.warned[key]=true;st.queue.push({day:day,slot:i});
      }
    });
  },
  /* 广播之后、检查开始之前：这段时间的地点要求按教室显示 */
  upcoming:function(){
    if(!RT.inspection||Inspection.active())return false;
    var st=Inspection.state();
    return INSPECT_CONFIG.times.some(function(time,i){
      var key=S.day+':'+i;
      return st.warned[key]&&!st.seen[key]&&S.tsec>=time-INSPECT_CONFIG.warnLead&&S.tsec<time;
    });
  },
  stale:function(item){return item.day!==S.day||S.tsec>INSPECT_CONFIG.times[item.slot]+INSPECT_CONFIG.lateLimit;},
  active:function(){return !!(RT.inspection&&RT.inspection.current);},
  pending:function(){return !!((RT.inspection&&(RT.inspection.current||RT.inspection.queue.length))||INSPECT_FX.scatter);},
  points:function(){
    var result=[],n=20,i,j,angle,x,y;
    for(i=0;i<n&&result.length<6;i++){
      angle=i*TAU/n;
      for(j=0;j<4;j++){
        var dist=30+j*12;
        x=S.x+Math.cos(angle)*dist;y=S.y+Math.sin(angle)*dist;
        if(!canStand(x,y))continue;
        if(result.every(function(p){return Math.hypot(p.x-x,p.y-y)>15;}))result.push({x:x,y:y});
        break;
      }
    }
    return result;
  },
  buildFx:function(c){
    Inspection.clearFx();
    if(!GLR.scene)return;
    var group=new THREE.Group(),room=S.mode==='in'?INTERIORS[S.room]:null,player=worldToScene(S.x,S.y,room);
    c.points.forEach(function(point){
      var pos=worldToScene(point.x,point.y,room),figure=new THREE.Group();
      figure.add(figMesh('person',new THREE.MeshBasicMaterial({color:0x030405,fog:true,transparent:true,opacity:1}),1));
      figure.position.set(pos.x,0,pos.z);group.add(figure);
      var dx=pos.x-player.x,dz=pos.z-player.z,len=Math.hypot(dx,dz)||1;
      figure.userData.scatterX=dx/len;figure.userData.scatterZ=dz/len;
    });
    GLR.scene.add(group);INSPECT_FX.group=group;INSPECT_FX.room=c.room;INSPECT_FX.points=c.points;
  },
  lineClear:function(point){
    var dx=point.x-S.x,dy=point.y-S.y,n=Math.ceil(Math.hypot(dx,dy)/3),R=S.mode==='in'?INTERIORS[S.room]:null;
    for(var i=1;i<n;i++){
      var x=S.x+dx*i/n,y=S.y+dy*i/n;
      if(R){var tile=tileAt(R,x,y);if(tile==='#'||(tile==='='&&!doorIsOpen(R,x,y)))return false;}
      else if(solidAtOutdoor(x,y))return false;
    }
    return true;
  },
  looking:function(c){
    if(HIDE.on||Math.abs(S.pitch)>0.9)return false;
    return c.points.some(function(p){
      var dx=p.x-S.x,dy=p.y-S.y,d=Math.hypot(dx,dy);
      return d>1&&d<95&&angDiff(S.ang,Math.atan2(dy,dx))<0.42&&Inspection.lineClear(p);
    });
  },
  start:function(item){
    var st=Inspection.state(),c={day:item.day,slot:item.slot,t:0,look:0,move:0,
      compliant:inClassroomHere(),room:S.mode==='in'?S.room:'out',points:Inspection.points()};
    st.current=c;Inspection.buildFx(c);
    os('我：走廊里的声音一下子停了。一圈黑影站在附近——别动，也别看它们。',4.5,OS_FORCE);
  },
  cancel:function(){
    if(RT.inspection)RT.inspection.current=null;
    Inspection.clearFx();
  },
  scatterTick:function(dt){
    var animation=INSPECT_FX.scatter,group=INSPECT_FX.group;
    if(!animation||!group)return;
    if(INSPECT_FX.room!==(S.mode==='in'?S.room:'out')){Inspection.clearFx();return;}
    animation.t+=dt;var alpha=Math.max(0,1-animation.t/animation.duration);
    group.children.forEach(function(figure){
      figure.position.x+=figure.userData.scatterX*dt*1.5;
      figure.position.z+=figure.userData.scatterZ*dt*1.5;
      figure.traverse(function(o){if(o.material)o.material.opacity=alpha;});
    });
    if(animation.t>=animation.duration)Inspection.clearFx();
  },
  finish:function(c){
    var st=Inspection.state();if(st.current!==c)return;
    st.current=null;
    if(INSPECT_FX.group)INSPECT_FX.scatter={t:0,duration:.8};
    S.san=Math.max(0,S.san-(c.compliant?INSPECT_CONFIG.goodSan:INSPECT_CONFIG.badSan));
    addViolation(c.compliant?-INSPECT_CONFIG.goodViolation:INSPECT_CONFIG.badViolation,'inspection');
    S.tt=clamp(S.tt+(c.compliant?INSPECT_CONFIG.assimilation:-INSPECT_CONFIG.assimilation),0,100);
    os(c.compliant?'我：黑影散开了。我还在教室里。':'我：黑影散开了。它们已经记下我不在教室。',3.8,OS_FORCE);
    settleSan();if(!S.dead&&S.tt>=100)resolveAssimilation();
  },
  tick:function(dt){
    Inspection.scatterTick(dt);
    var st=Inspection.state(),c=st.current;
    if(!c){
      if(INSPECT_FX.scatter)return;
      if(S.room==='portal_tunnel')return;
      /* 排队太久的（玩家当时在电梯里、在异象里，没法回教室）作废 */
      while(st.queue.length&&Inspection.stale(st.queue[0]))st.queue.shift();
      if(st.queue.length&&!AN.active&&!UI.chooseOpen&&PAT.state==='idle'&&!LESSON.on){Inspection.start(st.queue.shift());}
      return;
    }
    if(S.dead||S.screen!=='play'){st.current=null;Inspection.clearFx();return;}
    var here=S.mode==='in'?S.room:'out';
    if(c.room!==here){c.room=here;c.points=Inspection.points();Inspection.buildFx(c);}
    else if(!INSPECT_FX.group||INSPECT_FX.points!==c.points)Inspection.buildFx(c);
    c.t+=dt;
    if(S.moving){
      c.move+=dt;
      while(c.move>=INSPECT_CONFIG.moveEvery){c.move-=INSPECT_CONFIG.moveEvery;addViolation(INSPECT_CONFIG.moveViolation,'inspection');}
    }
    if(Inspection.looking(c)){
      c.look+=dt;
      while(c.look>=1){c.look-=1;S.san=Math.max(0,S.san-INSPECT_CONFIG.gazeSan);VisualState.hurt=Math.max(VisualState.hurt||0,.2);}
    }
    if(c.t>=INSPECT_CONFIG.duration)Inspection.finish(c);
  }
};
