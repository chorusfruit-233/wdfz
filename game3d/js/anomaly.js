/* 里世界 3D · 异象 */
'use strict';

var AN={
  id:null, t:0, acc:0, next:45, data:{}, rained:false,
  cool:{}, lastBig:false, active:false, sub:0
};
/* 每种异象一条：
     w 抽中的权重，small 小异象（上课时优先），cool 冷却（游戏分钟），cn 预报 / 线索里的叫法，name 调试面板里的名字，
     dfx 致死时的死亡演出，msg 出现时的那句话，lethal 会直接杀人，warn 出现前先预警，fx 有场景里的表现，
     exam 考试时也会出，late 第一天的预知梦不出，rained 下过雨（之后才会有蛾群、雨点成字）；
     when 能不能在当前位置 / 时间出现，place 布置判定点（返回表现生成的位置），begin 出现后的第一下，tick 每帧。 */
var AN_DEFS={
  blackout:{w:0.5, small:1, cool:180,
    cn:'楼里的灯全灭了', name:'停电', dfx:'lamps',
    msg:'我：灯一盏接一盏灭了。走廊尽头也暗下来，只剩自己的呼吸。',
    when:function(){return S.mode==='in'&&S.room!=='teach6';},
    tick:function(dt){
      if(S.mode==='in'&&S.room!=='teach6')S.san-=dt*0.7;
      if(AN.t>=24){os('我：灯管轻轻响了一声，又亮了。',3.2);anEnd();}
    }
  },
  rain:{w:0.26, lethal:1, warn:1, fx:1, rained:1, cool:260,
    cn:'下不完的雨', name:'大暴雨', dfx:'drown',
    msg:'我：天一下子暗了。雨不是从云里落下来的——它从很高的地方垂下来，像有人在上面一桶一桶地倒。',
    when:function(t,nw){ return S.mode==='out'&&nw!=='教室'; },
    tick:function(dt,d,hard){
      if(underCover()){
        AN.acc=Math.max(0,AN.acc-dt*0.6);
        if(!d.cov&&S.mode==='out'){ d.cov=1; os('我：躲到了檐下。雨声一下子远了，可我还是能听见它在找我。',3.6); }
      }else{ AN.acc+=dt; S.san-=dt*0.7; d.cov=0; }
      if(AN.acc>(hard?9:14)) anKill('雨灌进了你的肺里。你听见自己在身体里晃，像一只装满水的桶。','drown');
      else if(AN.acc>(hard?5:8)&&!d.warn){ d.warn=1; os('我：喘不上气了。得找个有顶的地方——屋檐、柱廊、车棚，哪里都行。',3.6); }
      if(AN.t>26) anEnd();
    }
  },
  moth:{w:0.24, lethal:1, warn:1, fx:1, late:1, rained:1, cool:200,
    cn:'蛾群', name:'蛾群', dfx:'swarm',
    msg:'我：灯下面聚了一团飞蛾。不对，不是一团。是一整面墙。它们在往我这边挪。',
    when:function(){ return AN.rained; },
    place:function(d){
      d.src={x:S.x,y:S.y};
    },
    tick:function(dt,d,hard){
      var dm=Math.sqrt(dist2(d.src.x,d.src.y,S.x,S.y));
      if(dm>120) AN.acc=Math.max(0,AN.acc-dt*1.4);
      else { AN.acc+=dt; S.san-=dt*1.6; }
      if(AN.acc>(hard?4.5:6.5)) anKill('蛾群把你裹住了。翅膀上的粉落进你的眼睛里，很痒。然后什么都不痒了。','swarm');
      if(AN.t>24) anEnd();
    }
  },
  turn:{w:0.5, small:1,
    cn:'有人在我背后拍了一下', name:'被拍肩膀', dfx:'gaze',
    msg:'……有人从后面拍了一下我的肩膀。很轻。手指是湿的。',
    when:function(){ return true; },
    begin:function(d){
      d.chosen=null;
      /* 小概率是另一种：先听见身后的脚步声走近，再被拍肩。这一次要回头 */
      d.smile=Math.random()<TURN_SMILE_P;
      if(d.smile) os('我：背后有脚步声。很轻，一步一步走近……停在我身后。然后，有人拍了拍我的肩膀。很轻，像在叫我。',4.6,OS_FORCE);
    },
    tick:function(dt,d,hard){
      if(d.smile){ turnSmileTick(dt,d); return; }
      if(d.chosen===null){
        if(AN.t>1.2&&!d.asked){
          d.asked=true;
          UI.choice('背后有只手，拍了一下我的肩膀。它还搭在那儿。',[
            {label:'不回头',fn:function(){ d.chosen='no'; UI.closeChoice(); }},
            {label:'回头看',fn:function(){ d.chosen='yes'; UI.closeChoice(); }}
          ],anChoiceOptions(d));
        }
      }else if(d.chosen==='yes'){
        AN.acc+=dt;
        if(AN.acc>0.5) anHurt('我回头了。它的脸离我只有一寸——没有五官，只有一层湿透的皮。下一秒，什么都没有了。肩膀上还是凉的。',26,{quiet:1});
      }else{
        AN.acc+=dt;
        if(AN.acc>=7.8){ S.san=Math.min(100,S.san+6); addClue('turn'); os('我：那只手慢慢松开了。我一直没有回头。',3.4); anEnd(); }
      }
    }
  },
  broad:{w:0.75, small:1, fx:1, exam:1,
    cn:'广播点名', name:'广播点名', dfx:'voice',
    msg:'广播：「沙……高二（二）班的同学，请你……留在原地。不要走动。」',
    when:function(){ return S.mode==='in'; },
    tick:function(dt,d,hard){
      if(S.moving&&!S.seated){ AN.acc+=dt; }
      if(AN.acc>1.6) anHurt('广播停了一下。然后，它念出了我现在站着的位置——精确到哪一块地砖。',18);
      else if(AN.t>5.2){ os('广播：「……谢谢配合。」',2.6); anEnd(); }
    }
  },
  bell13:{w:0.85,
    cn:'钟敲十三下', name:'钟敲十三下', dfx:'bell',
    msg:'我：钟响了。一下，两下……我下意识地开始数。',
    when:function(){ return S.mode==='in'&&(INTERIORS[S.room].host==='teach'||INTERIORS[S.room].host==='dormN'); },
    tick:function(dt,d,hard){
      if(S.seated&&S.room==='teach1'){ os('我：我坐回自己的位子上。钟声在第十二下停了。',3.4); anEnd(); return; }
      S.san-=dt*0.22;
      if(AN.t>15) anHurt('第十三下。我数得很清楚——可是我不记得自己是从哪一下开始数的。',20);
    }
  },
  exercise:{w:0.85, lethal:1, fx:1,
    cn:'操场做操的人', name:'操场做操', dfx:'follow',
    msg:'我：操场上有一群人在做操。动作整齐得过分。领操台上没有人。',
    when:function(){ return S.mode==='out'&&onField(); },
    place:function(d){
      d.src={x:S.x,y:S.y};
    },
    tick:function(dt,d,hard){
      var de=Math.sqrt(dist2(d.src.x,d.src.y,S.x,S.y));
      if(de>120){ AN.acc=Math.max(0,AN.acc-dt*0.8); }
      else { AN.acc+=dt; }
      if(AN.acc>(hard?3.6:5.2)) anKill('你开始跟着做操。手臂抬起来的时候你才发现，你早就停不下来了。','follow');
      if(AN.t>22) anEnd();
    }
  },
  bells:{w:0.75,
    cn:'车棚所有铃一起响', name:'车棚齐鸣', dfx:'shatter',
    msg:'我：车棚里所有的车铃，在同一刻响了起来。没有风。',
    when:function(){ return nearObj('shed',0)<320; },
    tick:function(dt,d,hard){
      var db=nearObj('shed',0);
      if(db<110){ AN.acc+=dt; } else { AN.acc=Math.max(0,AN.acc-dt*1.2); }
      if(AN.acc>2.0) anHurt('所有车铃同时响的那一刻，耳朵里只剩下"嗡"的一声。过了很久，我才听见自己的心跳。',15);
      if(AN.t>18) anEnd();
    }
  },
  hand:{w:0.9, small:1, fx:1,
    cn:'隔间底下伸来的手', name:'隔间递手', dfx:'hand',
    msg:'我：隔间底下的缝里，伸出来一只手。手心朝上，指甲缝里是黑的。',
    when:function(){ return inToiletHere(); },
    place:function(d){
      return aheadPoint(8);
    },
    begin:function(d){
      d.chosen=null;
    },
    tick:function(dt,d,hard){
      if(d.chosen===null){
        if(AN.t>1.6&&!d.asked){
          d.asked=true;
          UI.choice('隔间底下伸来一只手。手心朝上，像在等什么。',[
            {label:'不动',fn:function(){ d.chosen='no'; UI.closeChoice(); }},
            {label:'把手放上去',fn:function(){ d.chosen='yes'; UI.closeChoice(); }}
          ],anChoiceOptions(d));
        }
      }else if(d.chosen==='yes'){
        var lost=null;
        if(S.bag.length){ lost=S.bag[Math.floor(Math.random()*S.bag.length)]; removeItem(lost); }
        anHurt('它握住了我，握得很紧，指甲陷进肉里。等我把手抽回来——'+(lost?'口袋里的「'+ITEMS[lost].n+'」不见了。':'掌心多了一道指甲印，弯弯的，像在笑。'),20);
      }else{
        AN.acc+=dt;
        if(AN.acc>2.2){ addClue('hand'); os('我：那只手在原地停了很久，然后慢慢缩了回去。',3.2); anEnd(); }
      }
    }
  },
  repeat:{w:0.9, fx:1, exam:1,
    cn:'你作业交了吗', name:'你作业交了吗', dfx:'gaze',
    msg:'后桌（贴着我的后脑勺）：「……你作业，交了吗？」',
    when:function(){ return inClassroomHere(); },
    begin:function(d){
      d.chosen=null;
    },
    tick:function(dt,d,hard){
      if(d.chosen===null){
        if(AN.t>1.0&&!d.asked){
          d.asked=true;
          var opts=[];
          if(S.bag.indexOf('hw')>=0) opts.push({label:'把作业本递过去',fn:function(){ d.chosen='hw'; UI.closeChoice(); }});
          opts.push({label:'不出声',fn:function(){ d.chosen='quiet'; UI.closeChoice(); }});
          opts.push({label:'说出一个名字',fn:function(){ d.chosen='name'; UI.closeChoice(); }});
          UI.choice('后桌：「你作业交了吗？」',opts,anChoiceOptions(d));
        }
      }else if(d.chosen==='hw'){
        S.san=Math.min(100,S.san+12); removeItem('hw'); os('我：后面那只手接过了作业本，翻了一页，又翻了一页。然后安静了。',3.6); anEnd();
      }else if(d.chosen==='name'){
        anHurt('我说出了一个名字。全班同时应了一声——"到"。没有一个声音是我认识的。',20);
      }else{
        AN.acc+=dt;
        if(AN.acc>14){ S.san-=6; addClue('repeat'); os('我：他问了十四遍。第十五遍的时候，他叫的是我的名字。',3.6); anEnd(); }
      }
    }
  },
  chalk:{w:0.42, small:1, fx:1, exam:1,
    cn:'黑板上的「下一次」', name:'黑板上的字', dfx:'chalk',
    msg:'我：黑板上，有人在写字。粉笔自己在动。',
    when:function(){ return S.mode==='in'; },
    begin:function(d){
      var next=pickAnomaly();
      if(AN_WARN[next]){
        AN.pre=next; AN.locked=true; AN.preNext=anInterval();
        var mins=Math.round((16+AN.preNext)*rateAt(S.tsec)/60);
        d.until=S.tsec+mins;
        os('我：黑板上写着一个时间——'+fmtClock(d.until)+'。字迹和我的一模一样。',5);
      }else{
        AN.pre=null; AN.preNext=0;
        os('我：粉笔在黑板上写了几笔，又慢慢擦掉了。',5);
      }
    },
    tick:function(dt,d,hard){
      S.san-=dt*0.25;
      if(AN.t>16) anEnd();
    }
  },
  loop:{w:1.0, small:1,
    cn:'无尽的走廊', name:'无尽的走廊', dfx:'loop',
    msg:'我：走廊尽头那扇门……我已经第三次走到它面前了。',
    when:function(){ return corridorHere(); },
    tick:function(dt,d,hard){
      /* 以前出了教学楼它还在计时，最后在操场上念"门牌上的班号" */
      if(!corridorHere()){
        os(S.mode==='out'?'我：推开门，外面是校园。回头看，那条走廊又只有原来那么长了。':'我：我拐进了一间教室。身后的走廊安静下来，不再往前延伸了。',3.4);
        anEnd(); return;
      }
      if(KEY['shift']||KEY[' ']||S.run){ AN.acc+=dt*2.6; }
      else { AN.acc+=dt; }
      S.san-=dt*0.3;
      if(AN.acc>14){ os('我：门终于是另一扇了。门牌上的班号，比刚才大了一。',3.4); anEnd(); }
    }
  },
  roster:{w:0.42, small:1, fx:1, exam:1,
    cn:'被划掉的名字', name:'被划掉的名字', dfx:'names',
    msg:'我：墙上多了一张名单。纸是新的。上面有我的名字——被一道红线划掉了。',
    when:function(){ return S.mode==='in'; },
    place:function(d){
      d.rx=S.x; d.ry=S.y; d.done=false;
    },
    tick:function(dt,d,hard){
      if(d.done){ anEnd(); return; }
      if(AN.t>18) anEnd();
    }
  },
  leak:{w:0.55, small:1, fx:1,
    cn:'天花板渗水', name:'天花板渗水', dfx:'water',
    msg:'我：天花板在往下滴水。今天没有下雨。水是温的。',
    when:function(){ return S.mode==='in'; },
    place:function(d){
      d.pts=[];
      for(var i=0;i<5;i++){ var lp=aheadPoint(rnd(10,34)); d.pts.push({x:lp.x+rnd(-14,14),y:lp.y+rnd(-14,14)}); }
    },
    tick:function(dt,d,hard){
      if(d.hurt){ if(AN.t>20) anEnd(); return; }
      var on=false;
      for(var i=0;i<d.pts.length;i++){ if(dist2(d.pts[i].x,d.pts[i].y,S.x,S.y)<10*10) on=true; }
      if(on){ AN.acc+=dt; } else { AN.acc=Math.max(0,AN.acc-dt); }
      if(AN.acc>1.5){ d.hurt=1; anHurt('水滴进了我的衣领。是温的，有一股铁锈味。我抬头——天花板上那块水渍，形状像一个人趴在上面。',12,{keep:1}); }
      if(AN.t>20) anEnd();
    }
  },
  rite:{w:0.85, lethal:1, fx:1, late:1,
    cn:'实验楼仪式现场', name:'实验楼仪式', dfx:'ring',
    msg:'我：地上有一个粉笔画的圈，线还很新。圈里摆着四根白蜡烛。圈的正中，空着一个人的位置。',
    when:function(){ return inLabHere(); },
    place:function(d){
      var rp=aheadPoint(40); d.c={x:rp.x,y:rp.y}; return rp;
    },
    tick:function(dt,d,hard){
      var dr=Math.sqrt(dist2(d.c.x,d.c.y,S.x,S.y));
      if(dr<19){ AN.acc+=dt; S.san-=dt*2.0; if(!d.warn){ d.warn=1; os('我：我踩到粉笔线了。蜡烛的火苗一起朝我这边歪。',3.0); } }
      else AN.acc=Math.max(0,AN.acc-dt*0.5);
      if(AN.acc>(hard?1.4:2.2)) anKill('你走进了那个圈。正中那个空着的位置，刚好是你的大小。','ring');
      if(AN.t>20) anEnd();
    }
  },
  cold:{w:0.9, small:1, fx:1,
    cn:'冷库', name:'冷库', dfx:'freeze',
    msg:'我：食堂最东边那扇门后面冷得像冰柜。门缝里，有什么东西在轻轻地敲。',
    when:function(){ return inCanteen(); },
    begin:function(d){
      d.chosen=null;
    },
    tick:function(dt,d,hard){
      if(d.chosen===null){
        if(AN.t>1.4&&!d.asked){
          d.asked=true;
          UI.choice('最东边那扇门后面，冷得像冰柜。门缝里有东西在敲，很有节奏。',[
            {label:'把门拉开一条缝',fn:function(){ d.chosen='near'; UI.closeChoice(); }},
            {label:'转身就走',fn:function(){ d.chosen='away'; UI.closeChoice(); }}
          ],anChoiceOptions(d));
        }
      }else if(d.chosen==='near'){
        S.san=Math.min(100,S.san+14);
        os('我：里面挂着一排冻硬的校服，袖子在风里互相敲。最外面那件的胸口，绣着我的名字。……我反而不怕了。',5.4);
        anEnd();
      }else{
        S.san=Math.max(0,S.san-16);
        os('我：我走了。那股冷气跟着我，一直贴在后颈上，走了很远都没散。',4.2);
        anEnd();
      }
    }
  },
  shifting:{w:0.9, small:1, fx:1, exam:1,
    cn:'窗外的楼在动', name:'窗外的楼在动', dfx:'twin',
    msg:'我：窗外的楼……在动。很慢，一栋一栋地挪。',
    when:function(){ return inClassroomHere(); },
    tick:function(dt,d,hard){
      S.san-=dt*0.5;
      if(AN.t>18){ os('我：楼停下来了。整片校园里，只有钟楼一直没动——它在看着别的楼。',4.6); anEnd(); }
    }
  },
  stare:{w:0.95, fx:1, exam:1,
    cn:'全体回头', name:'全体回头', dfx:'stare',
    msg:'我：全班同时回过头来看着我。没有人眨眼。',
    when:function(){ return inClassroomHere(); },
    tick:function(dt,d,hard){
      if(d.hit){ d.hitT+=dt; if(d.hitT>1.6) anEnd(); return; }   /* 墙上的眼睛全睁开，停一会儿再散 */
      if(!S.moving){ AN.acc+=dt; } else { AN.acc=Math.max(0,AN.acc-dt); }
      if(AN.acc>1.8){ d.hit=1; d.hitT=0; anHurt('我站住了。于是全班一起站了起来，椅子腿在地上刮出同一声。然后他们又一起坐下。',18,{keep:1}); }
      else if(AN.t>12){ os('我：他们慢慢地转回去了。最后转回去的，是我的同桌。',3.4); anEnd(); }
    }
  },
  lamps:{w:0.9, small:1, fx:1,
    cn:'熄灯后的走廊灯', name:'熄灯后的走廊灯', dfx:'lamps',
    msg:'我：走廊的灯一盏一盏亮了起来。它在跟着我。',
    when:function(){ return corridorHere()&&isNight(); },
    tick:function(dt,d,hard){
      if(!S.moving){ AN.acc+=dt; } else { AN.acc=Math.max(0,AN.acc-dt*0.8); }
      if(AN.acc>1.6) anHurt('灯停在了我头顶，亮得发白。有一瞬间，我看见了自己手背里的骨头。',16);
      else if(AN.t>16){ os('我：灯一盏一盏地灭回去。最后一盏在我前面，灭得很慢，像在等我。',3.6); anEnd(); }
    }
  },
  feast:{w:0.5, fx:1,
    cn:'食堂的盛宴', name:'食堂盛宴', dfx:'deep',
    msg:'我：食堂里摆了一长桌菜，还冒着热气。每一副碗筷前面，都有一张写着名字的纸条。',
    when:function(t){ return inCanteen()&&MEALS.some(function(m){ return t>=m[0]&&t<m[1]; }); },
    tick:function(dt,d,hard){
      if(!inCanteen()){ AN.acc=Math.max(0,AN.acc-dt*0.5); }
      else { AN.acc+=dt; }
      if(AN.acc>(S.talent==='stomach'?17:9)){
        advanceGameTime(20);
        anHurt('我回过神来的时候，嘴里有东西。我不记得自己坐下过。面前的碗是空的，上面那张纸条写着我的名字。',22);
      }
      if(AN.active&&AN.t>24) anEnd();
    }
  },
  necker:{w:0.7, lethal:1, fx:1, late:1,
    cn:'围墙外的行人', name:'围墙外的行人', dfx:'neck',
    msg:'我：围墙外面有个人在走。我走他也走，我停他也停。他的脖子……太长了。',
    when:function(){ return S.mode==='out'&&S.x>(BOUND.x1-220)*SC; },
    place:function(d){
      return {x:BOUND.x1*SC+16,y:S.y};
    },
    tick:function(dt,d,hard){
      var wallX=BOUND.x1*SC;
      var dToWall=Math.abs(wallX-S.x);
      if(dToWall<150*SC/2){ S.san-=dt*1.2; }
      if(dToWall<90*SC/2){ AN.acc+=dt; if(!d.warn){ d.warn=1; os('我：他停下来了。他在等我再走近一点。',3.0); } } else { AN.acc=Math.max(0,AN.acc-dt); }
      if(AN.acc>(hard?1.4:2.2)) anKill('他没有绕到校门口。他把脖子从围栏的缝里伸了进来，一直伸，一直伸。','neck');
      if(AN.t>20) anEnd();
    }
  },
  shadow:{w:0.8, small:1, fx:1,
    cn:'影子慢一拍', name:'影子慢一拍', dfx:'shadow',
    msg:'我：我的影子慢了半拍。它刚刚，自己动了一下。',
    when:function(){ return S.mode==='out'&&onField(); },
    begin:function(d){
      d.acc=0;
    },
    tick:function(dt,d,hard){
      if(underCover()){ AN.acc=Math.max(0,AN.acc-dt*0.6); }
      else { AN.acc+=dt; S.san-=dt*0.8; }
      if(AN.acc>10) anHurt('影子追上来了，和我叠在一起。有一瞬间，我分不清是谁先抬的手。',18);
      if(AN.active&&AN.t>22) anEnd();
    }
  },
  twin:{w:0.55, lethal:1, fx:1, late:1,
    cn:'天台的第二个你', name:'天台的第二个你', dfx:'twin',
    msg:'我：天台的另一头站着一个人。穿着我们学校的校服。他站的姿势，和我一模一样。',
    when:function(){ return onRoof(); },
    place:function(d){
      if(!INTERIORS[S.room]) return;
      var RR=INTERIORS[S.room];
      var cxr=RR.ox+RR.w/2, cyr=RR.oy+RR.h/2;
      d.x=cxr-(S.x-cxr)*0.8; d.y=cyr-(S.y-cyr)*0.8;           /* 天台的另一头，正对着你 */
      if(solidAt(d.x,d.y)){ d.x=RR.ox+RR.w*0.22; d.y=RR.oy+RR.h*0.25; }
      d.room=S.room; return {x:d.x,y:d.y};
    },
    tick:function(dt,d,hard){
      if(!INTERIORS[S.room]||S.room!==d.room){ os('我：我下了楼。楼梯上一直有第二个人的脚步声，比我慢半拍。',3.6); anEnd(); return; }
      var dtwin=Math.sqrt(dist2(d.x,d.y,S.x,S.y));
      /* 你不看他的时候，他就往你这边走 */
      var look=angDiff(Math.atan2(d.y-S.y,d.x-S.x),S.ang)<0.6;
      if(!look&&dtwin>16){
        var sp=(hard?26:18)*dt, ux=(S.x-d.x)/dtwin, uy=(S.y-d.y)/dtwin;
        d.x+=ux*sp; d.y+=uy*sp;
        if(!d.moved){ d.moved=1; os('我：……他刚才是不是动了？',2.6); }
      }
      if(dtwin<16) anKill('他走到了你面前。你们同时抬起手。他的手，是热的。','twin');
      if(AN.t>22){ os('我：他转身，从天台边上走了下去。没有声音。',3.4); anEnd(); }
    }
  },
  raindots:{w:0.32, fx:1, rained:1,
    cn:'雨点落成的字', name:'雨点成字', dfx:'water',
    msg:'我：雨点落在地上，没有散开。它们在排队。',
    when:function(){ return AN.rained; },
    tick:function(dt,d,hard){
      S.san-=dt*0.4;
      if(AN.t>14){ os('我：地上的字写着——明天的天气：阴。明天的值日：你。',4.4); anEnd(); }
    }
  },
  cup:{w:0.8, lethal:1, warn:1, fx:1, cool:150,
    cn:'清华水杯', name:'清华水杯', dfx:'floor',
    msg:'我：头顶上叮叮当当地响。抬头——四楼的窗台上，一只紫色的保温杯在晃。',
    when:function(){ var cw=cupWall(); return !!cw&&cw.m<2.4&&!underRoof(); },
    place:function(d){
      d.wall=cupWall(); d.phase=0;
      d.wob=S.diff==='hard'?0.6:(S.diff==='easy'?1.3:0.9);          /* 在窗台上晃多久才掉 */
      if(d.wall) return {x:d.wall.x*SC,y:d.wall.y*SC};
    },
    tick:function(dt,d,hard){
      if(!d.wall||(S.mode!=='out'&&d.phase<2)){ anEnd(); return; }          /* 进了楼，就砸不到了 */
      if(d.phase===0&&AN.t>=d.wob){
        d.phase=1; d.tf=AN.t; d.lx=S.x; d.ly=S.y;                        /* 对准你这一刻站的地方往下掉 */
        if(!d.said){ d.said=1; os('我：它掉下来了——',1.6,OS_FORCE); }
        try{ SFX.cupFall&&SFX.cupFall(cupFallTime()); }catch(e){}
      }
      if(d.phase===1&&AN.t-d.tf>=cupFallTime()){
        d.phase=2; d.tl=AN.t;
        var miss=Math.sqrt(dist2(d.lx,d.ly,S.x,S.y))*U2M;                  /* 米 */
        try{ SFX.cupHit&&SFX.cupHit(miss); }catch(e){}
        if(miss<CUP_R&&!underRoof()){
          anKill('头顶上一声闷响。我最后看见的，是一只紫色的保温杯，杯身上印着四个字：清华大学。它比我想象的要重。','floor');
          return;
        }
        if(miss<CUP_R) os('我：「当」的一声，砸在头顶的雨棚上，又弹到了地上。',3.4);
        else if(miss<2.6){ S.san-=hard?9:6; os('我：就砸在我脚边。杯子摔瘪了，杯身上印着「清华大学」。杯盖滚开，里面的水还是热的。',4.4); }
        else os('我：不远处「哐」的一声，一只杯子在地上弹了两下。我不敢抬头。',3);
      }
      if(d.phase===2&&AN.t-d.tl>2.6) anEnd();
    }
  }
};
var AN_ID=Object.keys(AN_DEFS);
/* 旧的几张表从注册表派生出来：别的模块（预报、调试面板、读档、测试）还按这些名字读 */
function anTable(fn){ var o={}; AN_ID.forEach(function(id){ var v=fn(AN_DEFS[id]); if(v!==undefined) o[id]=v; }); return o; }
var AN_W=anTable(function(a){ return a.w; });
var AN_SMALL=anTable(function(a){ return a.small; });
var AN_COOL=anTable(function(a){ return a.cool; });
var AN_CN=anTable(function(a){ return a.cn; });
var AN_NAME=anTable(function(a){ return a.name; });
var DFX_MAP=anTable(function(a){ return a.dfx; });
var AN_MSG=anTable(function(a){ return a.msg; });
var AN_LETHAL=anTable(function(a){ return a.lethal; });
var AN_WARN=anTable(function(a){ return a.warn; });
var HAS_FX=anTable(function(a){ return a.fx; });
var EXAM_AN=anTable(function(a){ return a.exam; });

function nearObj(id,pad){
  var o=objById(id); if(!o) return 99999;
  var cx=o.x*SC+o.w*SC/2, cy=o.y*SC+o.h*SC/2;
  return Math.sqrt(dist2(S.x,S.y,cx,cy));
}
function corridorHere(){
  if(S.mode!=='in') return false;
  var R=INTERIORS[S.room];
  if(!R||R.host!=='teach'||R.floor>5) return false;
  var row=Math.floor((S.y-R.oy)/R.th);
  return row>=16&&row<=20;
}
function inLabHere(){ return S.mode==='in'&&INTERIORS[S.room]&&INTERIORS[S.room].host==='lab'; }
function inToiletHere(){
  if(S.mode!=='in') return false;
  var R=INTERIORS[S.room]; if(!R) return false;
  var t=tileAt(R,S.x,S.y);
  if(t==='B'||t==='G') return true;
  if(R.host==='teach'){
    var c=Math.floor((S.x-R.ox)/R.tw), r=Math.floor((S.y-R.oy)/R.th);
    if(c>=58&&c<=61&&r>=16&&r<=19) return true;
  }
  return false;
}
function inCanteen(){ return S.mode==='in'&&S.room==='canteen1'; }
function onRoof(){ return S.mode==='in'&&S.room==='teach6'; }
/* 清华水杯：离你最近的那面高楼外墙（教学楼 / 行政楼 / 实验楼，都是五层）。
   返回墙上那一点（地图坐标）、朝外的法线、离墙几米；不在室外或离得远返回 null */
var CUP_BLD=['teach','admin','lab'];
function cupWall(){
  if(S.mode!=='out') return null;
  var mx=S.x/SC, my=S.y/SC, best=null;
  CUP_BLD.forEach(function(id){
    var o=objById(id); if(!o) return;
    var px=clamp(mx,o.x,o.x+o.w), py=clamp(my,o.y,o.y+o.h), dd=Math.hypot(mx-px,my-py);
    if(dd>0.01&&(!best||dd<best.d)) best={x:px,y:py,d:dd,nx:(mx-px)/dd,ny:(my-py)/dd,id:id};
  });
  if(best) best.m=best.d*SC*U2M;
  return best;
}

function anAllowed(id){
  var a=AN_DEFS[id];
  return a?a.when(S.tsec,needWhere(S.tsec)):false;
}
function pickAnomaly(){
  var pool=[],i,id;
  for(i=0;i<AN_ID.length;i++){
    id=AN_ID[i];
    if(!anAllowed(id)) continue;
    if(AN_COOL[id]&&AN.cool[id]!==undefined&&(gameClock()-AN.cool[id])<AN_COOL[id]) continue;
    pool.push(id);
  }
  if(!pool.length) return null;
  if(examNow()){       /* 考试时只出教室里的那几种 */
    pool=pool.filter(function(a){ return EXAM_AN[a]; });
    if(!pool.length) return null;
  }
  var want=null;
  if(needWhere(S.tsec)==='教室') want=AN_SMALL;
  var pref=[];
  if(want){ for(i=0;i<pool.length;i++) if(want[pool[i]]) pref.push(pool[i]); }
  if(pref.length>=3&&Math.random()<0.8) pool=pref;
  if(S.day===1&&S.diff==='easy'){
    pool=pool.filter(function(a){ return !AN_DEFS[a].late; });
    if(!pool.length) return null;
  }
  /* 不再纯随机：同一种不连着来（只剩它就这次不来）；最近出过的少来，没见过的多来。
     以前室外路上几乎只剩「拍肩膀」，一局能连着拍九次。 */
  var hist=RT.anHist||[], last=hist[hist.length-1], seen=RT.anSeen||{};
  if(pool.length>1) pool=pool.filter(function(a){ return a!==last; });
  else if(pool[0]===last) return null;
  if(!hist.length&&pool.indexOf('chalk')>=0) return 'chalk';   /* 第一次总是黑板上的预告：先教会你看时间 */
  var tot=0,ws=[];
  for(i=0;i<pool.length;i++){
    var w=AN_W[pool[i]]||1;
    if(AN_SMALL[pool[i]]) w*=1.25;
    if(hist.slice(-4).indexOf(pool[i])>=0) w*=0.35;
    if(!seen[pool[i]]) w*=2.2;
    ws.push(w); tot+=w;
  }
  var r=Math.random()*tot,acc=0;
  for(i=0;i<pool.length;i++){ acc+=ws[i]; if(r<acc) return pool[i]; }
  return pool[pool.length-1];
}

/* ---------- 异象节奏 ----------
   以前 AN.next 按游戏分钟倒数：上课时时间流速是下课的 6–7 倍，于是课上大约每 10 秒就来一次，
   一个接一个停不下来。现在按真实秒数计；SAN 越低、违规越多，来得越密。 */
function anInterval(){
  var hard=(S.diff==='hard');
  var base=hard?rnd(24,40):rnd(40,64);
  base*=0.62+0.38*clamp(S.san,0,100)/100;
  base*=1-clamp(S.viol,0,100)/260;
  if(AN.lastBig) base*=1.25;                     /* 大的过去之后，给一口喘气的时间 */
  if(S.mode==='in'&&INTERIORS[S.room]&&INTERIORS[S.room].principal) base*=0.5;   /* 校长办公室：异象频发 */
  return Math.max(10,base);
}
function anScheduleNext(){
  if(!AN.preNext||!AN.pre){ try{ AN.pre = pickAnomaly(); }catch(e){ AN.pre=null; } }
  AN.next=anInterval(); AN.next0=(AN.next0||0)+1;
  if(AN.preNext){ AN.next=AN.preNext; AN.preNext=0; }   /* 黑板上预告过的时间，要兑现 */
}
function anStart(){
  var id=null, planned=AN.pre;
  /* 进入考试后，之前预告的异象也必须受考试候选限制。 */
  var examRestricted=examNow();
  if((S.diff==='easy'||AN.locked||AN_WARN[AN.pre])&&AN.pre&&(!examRestricted||EXAM_AN[AN.pre])){
    if(anAllowed(AN.pre)) id=AN.pre;
    else if(AN.locked&&!AN.lockWait){ AN.lockWait=1; AN.next=4; return; }   /* 预报过的那个，等你走到它能出现的地方 */
  }
  AN.locked=false; AN.lockWait=0;
  AN.pre=null;
  if(!id) id=pickAnomaly();
  if(!id){ anScheduleNext(); AN.next=Math.min(AN.next,6); return; }
  /* 位置变化可能让新抽到的危险异象没有预警，先给它完整的预警时间。 */
  if(AN_WARN[id]&&id!==planned){ AN.pre=id; AN.next=8; return; }
  AN.id=id; AN.t=0; AN.acc=0; AN.active=true; AN.data={}; AN.sub=0;
  RT.anHist=(RT.anHist||[]).concat(id).slice(-6); RT.anSeen=RT.anSeen||{}; RT.anSeen[id]=1;
  AN.lastBig=!AN_SMALL[id];
  if(AN_COOL[id]!==undefined||AN_DEFS[id].rained) AN.cool[id]=gameClock();
  if(AN_DEFS[id].rained) AN.rained=true;
  os(AN_MSG[id]||'我：……',4.6);
  try{ SFX.anomaly&&SFX.anomaly(id); }catch(e){}
  anOn(id);
}
function anEnd(){
  if(!AN.active&&AN.id===null) return;
  var id=AN.id;
  anOff(id);
  if(id==='roster'&&!AN.data.done){
    addViolation(18);
    os('我：那张名单我没动。走开的时候，我听见身后有笔尖划过纸的声音。',4.0);
  }
  try{ traceAdd(id); }catch(e){}
  try{ SFX.anomalyEnd&&SFX.anomalyEnd(id); }catch(e){}
  AN.id=null; AN.active=false; AN.acc=0;
  anScheduleNext();
}

/* 选一个在玩家前方、站得住的点（世界单位） */
function aheadPoint(dist){
  var a, k, tries=[0,0.6,-0.6,1.2,-1.2,PI];
  for(k=0;k<tries.length;k++){
    a=S.ang+tries[k];
    var x=S.x+Math.cos(a)*dist, y=S.y+Math.sin(a)*dist;
    if(!solidAt(x,y)) return {x:x,y:y};
  }
  return {x:S.x,y:S.y};
}
function anOn(id,silent){
  var d=AN.data, def=AN_DEFS[id]||{}, src=null;
  /* 以前好几个异象的"看得见的东西"和"判定用的位置"不在一个地方：
     天台的另一个你就生在玩家脚下、仪式圈半径和判定半径差一倍、渗水点和水渍各算各的。
     现在由各自的 place 布置判定点，表现就生在那里。 */
  if(def.place) src=def.place(d)||null;
  try{ if(HAS_FX[id]) anfxSpawn(id, src?src.x:S.x, src?src.y:S.y); }catch(e){}
  AN.rained = AN.rained || (id==='rain');
  if(def.begin) def.begin(d);
}

function anOff(id){ entClear(); try{ anfxClear(); }catch(e){} }

/* 非致命异象的"惩罚"：吓一下、扣 SAN，然后结束 */
function anHurt(msg,loss,opt){
  opt=opt||{};
  var k=(S.diff==='hard')?1.25:0.9;
  S.san=Math.max(0,S.san-loss*k);
  VisualState.hurt=Math.max(VisualState.hurt||0,0.65);
  if(!opt.quiet){                           /* quiet：不闪白、不加刺耳的音效，只留画面暗下去那一下 */
    VisualState.flash=Math.max(VisualState.flash||0,0.25);
    try{ SFX.sting&&SFX.sting(); }catch(e){}
  }
  os(msg,4.4);
  if(S.san<=0&&!S.dead){ kill('你一直撑着的那根弦，断了。','vignette'); return; }
  if(!opt.keep) anEnd();
}
/* 能躲雨的地方：屋里、柱廊下、车棚、连廊下 */
function underCover(){
  if(S.mode==='in') return true;
  if(USE.brollyShield) return true;
  return underRoof();
}
/* 头顶有没有真正的顶（柱廊、连廊、车棚）；伞不算 */
function underRoof(){
  if(S.mode==='in') return true;
  var mx=S.x/SC, my=S.y/SC, i, o;
  for(i=0;i<OBJ.length;i++){
    o=OBJ[i];
    if(o.k==='link'&&mx>o.x&&mx<o.x+o.w&&my>o.y&&my<o.y+o.h) return true;
    if(o.open1f&&mx>o.x&&mx<o.x+o.w&&my>o.y+o.h&&my<o.y+o.h+12) return true;
    if(o.id==='shed'&&mx>o.x-3&&mx<o.x+o.w+3&&my>o.y-3&&my<o.y+o.h+3) return true;
  }
  return false;
}

var TURN_SMILE_P=0.25;
function anChoiceOptions(d){
  var ms=Number.isFinite(d.choiceRemaining)?Math.max(1,d.choiceRemaining):5000;
  delete d.choiceRemaining;
  return {timeoutMs:ms};
}
function anTick(dt){
  if(!AN.active||AN.id===null) return;
  var id=AN.id, d=AN.data, hard=(S.diff==='hard');
  AN.t+=dt;
  if(AN.t>45){ anEnd(); return; }
  AN_DEFS[id].tick(dt,d,hard);
}

/* 拍肩的另一种：脚步声 → 拍肩 → 要回头。回头损失少量 SAN；不回头时突脸、扣更多 SAN 并加违规。 */
function turnSmileTick(dt,d){
  if(!d.steps) d.steps=0;
  if(d.chosen===null&&!d.asked&&AN.t>d.steps*0.42&&d.steps<4){          /* 身后的脚步，越来越近 */
    d.steps++;
    try{ SFX.patStep(0,0.35+d.steps*0.15,true,false); }catch(e){}
  }
  if(d.chosen===null){
    if(AN.t>1.9&&!d.asked){
      d.asked=true;
      UI.choice('脚步声停在我身后。那只手拍了拍我的肩膀，没有拿开——像在等我回头。',[
        {label:'不回头',fn:function(){ d.chosen='no'; UI.closeChoice(); }},
        {label:'回头看',fn:function(){ d.chosen='yes'; UI.closeChoice(); }}
      ],anChoiceOptions(d));
    }
    return;
  }
  AN.acc+=dt;
  if(d.done) { if(AN.acc>2.2) anEnd(); return; }
  if(d.chosen==='yes'&&AN.acc>0.3){
    d.done=1; AN.acc=0;
    S.ang+=PI;                                                          /* 真的转过身去 */
    try{ syncCamera(0); }catch(e){}
    smileShow('behind');
    anHurt('我：我回头了。身后是一张很大很大的笑脸，眼睛弯成两道缝，嘴角一直咧到耳根。它冲我点了点头，就不见了。我的手心全是汗。',5,{quiet:1,keep:1});
  }else if(d.chosen==='no'&&AN.acc>1.0){
    d.done=1;
    smileShow('jump');
    addViolation(15);
    anHurt('我没有回头。它等不及了——那张脸从我肩膀上绕过来，贴着我的鼻尖，一点一点咧开了嘴。',30);
  }
}
function anKill(msg,fx){
  var f=fx||DFX_MAP[AN.id]||'vignette';
  kill(msg,f);
}

function anDrive(dt){
  if(S.fn&&S.fn.on&&S.fn.v<72){ return; }
  if(!AN.active){
    if(S.room==='portal_tunnel')return;
    if(typeof Inspection!=='undefined'&&Inspection.pending())return;
    AN.next -= dt;
    if(AN.next<=0) anStart();
  } else {
    anTick(dt);
  }
}
