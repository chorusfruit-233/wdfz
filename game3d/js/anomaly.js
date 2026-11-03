/* @module-capsule */
(function($imports){
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
    when:function(){return $imports.S.mode==='in'&&$imports.S.room!=='teach6';},
    tick:function(dt){
      if($imports.S.mode==='in'&&$imports.S.room!=='teach6')(0,$imports.sanDrain)(0.7,dt,'anomaly');
      if(AN.t>=24){(0,$imports.os)('我：灯管轻轻响了一声，又亮了。',3.2);anEnd();}
    }
  },
  rain:{w:0.26, lethal:1, warn:1, fx:1, rained:1, cool:260,
    cn:'下不完的雨', name:'大暴雨', dfx:'drown',
    msg:'我：天一下子暗了。雨不是从云里落下来的——它从很高的地方垂下来，像有人在上面一桶一桶地倒。',
    when:function(t,nw){ return $imports.S.mode==='out'&&nw!=='教室'; },
    tick:function(dt,d,hard){
      if(underCover()){
        AN.acc=Math.max(0,AN.acc-dt*0.6);
        if(!d.cov&&$imports.S.mode==='out'){ d.cov=1; (0,$imports.os)('我：躲到了檐下。雨声一下子远了，可我还是能听见它在找我。',3.6); }
      }else{ AN.acc+=dt; (0,$imports.sanDrain)(0.7,dt,'anomaly'); d.cov=0; }
      if(AN.acc>(hard?9:14)) anKill('雨灌进了你的肺里。你听见自己在身体里晃，像一只装满水的桶。','drown');
      else if(AN.acc>(hard?5:8)&&!d.warn){ d.warn=1; (0,$imports.os)('我：喘不上气了。得找个有顶的地方——屋檐、柱廊、车棚，哪里都行。',3.6); }
      if(AN.t>26) anEnd();
    }
  },
  moth:{w:0.24, lethal:1, warn:1, fx:1, late:1, rained:1, cool:200,
    cn:'蛾群', name:'蛾群', dfx:'swarm',
    msg:'我：灯下面聚了一团飞蛾。不对，不是一团。是一整面墙。它们在往我这边挪。',
    when:function(){ return AN.rained; },
    place:function(d){
      d.src={x:$imports.S.x,y:$imports.S.y};
    },
    tick:function(dt,d,hard){
      var dm=Math.sqrt((0,$imports.dist2)(d.src.x,d.src.y,$imports.S.x,$imports.S.y));
      if(dm>120) AN.acc=Math.max(0,AN.acc-dt*1.4);
      else { AN.acc+=dt; (0,$imports.sanDrain)(1.6,dt,'anomaly'); }
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
      d.smile=$imports.GameRandom.next()<TURN_SMILE_P;
      if(d.smile) (0,$imports.os)('我：背后有脚步声。很轻，一步一步走近……停在我身后。然后，有人拍了拍我的肩膀。很轻，像在叫我。',4.6,$imports.OS_FORCE);
    },
    tick:function(dt,d,hard){
      if(d.smile){ turnSmileTick(dt,d); return; }
      if(d.chosen===null){
        if(AN.t>1.2&&!d.asked){
          d.asked=true;
          $imports.UI.choice('背后有只手，拍了一下我的肩膀。它还搭在那儿。',[
            {label:'不回头',fn:function(){ d.chosen='no'; $imports.UI.closeChoice(); }},
            {label:'回头看',fn:function(){ d.chosen='yes'; $imports.UI.closeChoice(); }}
          ],anChoiceOptions(d));
        }
      }else if(d.chosen==='yes'){
        AN.acc+=dt;
        if(AN.acc>0.5) anHurt('我回头了。它的脸离我只有一寸——没有五官，只有一层湿透的皮。下一秒，什么都没有了。肩膀上还是凉的。',26,{quiet:1});
      }else{
        AN.acc+=dt;
        if(AN.acc>=7.8){ $imports.PlayerStats.changeSan(6,'anomaly',{max:100}); (0,$imports.addClue)('turn'); (0,$imports.os)('我：那只手慢慢松开了。我一直没有回头。',3.4); anEnd(); }
      }
    }
  },
  broad:{w:0.75, small:1, fx:1, exam:1,
    cn:'广播点名', name:'广播点名', dfx:'voice',
    msg:'广播：「沙……高二（二）班的同学，请你……留在原地。不要走动。」',
    when:function(){ return $imports.S.mode==='in'; },
    tick:function(dt,d,hard){
      if($imports.S.moving&&!$imports.S.seated){ AN.acc+=dt; }
      if(AN.acc>1.6) anHurt('广播停了一下。然后，它念出了我现在站着的位置——精确到哪一块地砖。',18);
      else if(AN.t>5.2){ (0,$imports.os)('广播：「……谢谢配合。」',2.6); anEnd(); }
    }
  },
  bell13:{w:0.85,
    cn:'钟敲十三下', name:'钟敲十三下', dfx:'bell',
    msg:'我：钟响了。一下，两下……我下意识地开始数。',
    when:function(){ return $imports.S.mode==='in'&&($imports.INTERIORS[$imports.S.room].host==='teach'||$imports.INTERIORS[$imports.S.room].host==='dormN'); },
    tick:function(dt,d,hard){
      if($imports.S.seated&&$imports.S.room==='teach1'){ (0,$imports.os)('我：我坐回自己的位子上。钟声在第十二下停了。',3.4); anEnd(); return; }
      (0,$imports.sanDrain)(0.22,dt,'anomaly');
      if(AN.t>15) anHurt('第十三下。我数得很清楚——可是我不记得自己是从哪一下开始数的。',20);
    }
  },
  exercise:{w:0.85, lethal:1, fx:1,
    cn:'操场做操的人', name:'操场做操', dfx:'follow',
    msg:'我：操场上有一群人在做操。动作整齐得过分。领操台上没有人。',
    when:function(){ return $imports.S.mode==='out'&&(0,$imports.onField)(); },
    place:function(d){
      d.src={x:$imports.S.x,y:$imports.S.y};
    },
    tick:function(dt,d,hard){
      var de=Math.sqrt((0,$imports.dist2)(d.src.x,d.src.y,$imports.S.x,$imports.S.y));
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
          $imports.UI.choice('隔间底下伸来一只手。手心朝上，像在等什么。',[
            {label:'不动',fn:function(){ d.chosen='no'; $imports.UI.closeChoice(); }},
            {label:'把手放上去',fn:function(){ d.chosen='yes'; $imports.UI.closeChoice(); }}
          ],anChoiceOptions(d));
        }
      }else if(d.chosen==='yes'){
        var lost=null;
        if($imports.S.bag.length){ lost=$imports.S.bag[Math.floor($imports.GameRandom.next()*$imports.S.bag.length)]; (0,$imports.removeItem)(lost); }
        anHurt('它握住了我，握得很紧，指甲陷进肉里。等我把手抽回来——'+(lost?'口袋里的「'+$imports.ITEMS[lost].n+'」不见了。':'掌心多了一道指甲印，弯弯的，像在笑。'),20);
      }else{
        AN.acc+=dt;
        if(AN.acc>2.2){ (0,$imports.addClue)('hand'); (0,$imports.os)('我：那只手在原地停了很久，然后慢慢缩了回去。',3.2); anEnd(); }
      }
    }
  },
  repeat:{w:0.9, fx:1, exam:1,
    cn:'你作业交了吗', name:'你作业交了吗', dfx:'gaze',
    msg:'后桌（贴着我的后脑勺）：「……你作业，交了吗？」',
    when:function(){ return (0,$imports.inClassroomHere)(); },
    begin:function(d){
      d.chosen=null;
    },
    tick:function(dt,d,hard){
      if(d.chosen===null){
        if(AN.t>1.0&&!d.asked){
          d.asked=true;
          var opts=[];
          if($imports.S.bag.indexOf('hw')>=0) opts.push({label:'把作业本递过去',fn:function(){ d.chosen='hw'; $imports.UI.closeChoice(); }});
          opts.push({label:'不出声',fn:function(){ d.chosen='quiet'; $imports.UI.closeChoice(); }});
          opts.push({label:'说出一个名字',fn:function(){ d.chosen='name'; $imports.UI.closeChoice(); }});
          $imports.UI.choice('后桌：「你作业交了吗？」',opts,anChoiceOptions(d));
        }
      }else if(d.chosen==='hw'){
        $imports.PlayerStats.changeSan(12,'anomaly',{max:100}); (0,$imports.removeItem)('hw'); (0,$imports.os)('我：后面那只手接过了作业本，翻了一页，又翻了一页。然后安静了。',3.6); anEnd();
      }else if(d.chosen==='name'){
        anHurt('我说出了一个名字。全班同时应了一声——"到"。没有一个声音是我认识的。',20);
      }else{
        AN.acc+=dt;
        if(AN.acc>14){ $imports.PlayerStats.changeSan(-(6),'anomaly'); (0,$imports.addClue)('repeat'); (0,$imports.os)('我：他问了十四遍。第十五遍的时候，他叫的是我的名字。',3.6); anEnd(); }
      }
    }
  },
  chalk:{w:0.42, small:1, fx:1, exam:1,
    cn:'黑板上的「下一次」', name:'黑板上的字', dfx:'chalk',
    msg:'我：黑板上，有人在写字。粉笔自己在动。',
    when:function(){ return $imports.S.mode==='in'; },
    begin:function(d){
      var next=pickAnomaly();
      if(AN_WARN[next]){
        AN.pre=next; AN.locked=true; AN.preNext=anInterval();
        var mins=Math.round((16+AN.preNext)*(0,$imports.rateAt)($imports.S.tsec)/60);
        d.until=$imports.S.tsec+mins;
        (0,$imports.os)('我：黑板上写着一个时间——'+(0,$imports.fmtClock)(d.until)+'。字迹和我的一模一样。',5);
      }else{
        AN.pre=null; AN.preNext=0;
        (0,$imports.os)('我：粉笔在黑板上写了几笔，又慢慢擦掉了。',5);
      }
    },
    tick:function(dt,d,hard){
      (0,$imports.sanDrain)(0.25,dt,'anomaly');
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
        (0,$imports.os)($imports.S.mode==='out'?'我：推开门，外面是校园。回头看，那条走廊又只有原来那么长了。':'我：我拐进了一间教室。身后的走廊安静下来，不再往前延伸了。',3.4);
        anEnd(); return;
      }
      if($imports.KEY['shift']||$imports.KEY[' ']||$imports.S.run){ AN.acc+=dt*2.6; }
      else { AN.acc+=dt; }
      (0,$imports.sanDrain)(0.3,dt,'anomaly');
      if(AN.acc>14){ (0,$imports.os)('我：门终于是另一扇了。门牌上的班号，比刚才大了一。',3.4); anEnd(); }
    }
  },
  roster:{w:0.42, small:1, fx:1, exam:1,
    cn:'被划掉的名字', name:'被划掉的名字', dfx:'names',
    msg:'我：墙上多了一张名单。纸是新的。上面有我的名字——被一道红线划掉了。',
    when:function(){ return $imports.S.mode==='in'; },
    place:function(d){
      d.rx=$imports.S.x; d.ry=$imports.S.y; d.done=false;
    },
    tick:function(dt,d,hard){
      if(d.done){ anEnd(); return; }
      if(AN.t>18) anEnd();
    }
  },
  leak:{w:0.55, small:1, fx:1,
    cn:'天花板渗水', name:'天花板渗水', dfx:'water',
    msg:'我：天花板在往下滴水。今天没有下雨。水是温的。',
    when:function(){ return $imports.S.mode==='in'; },
    place:function(d){
      d.pts=[];
      for(var i=0;i<5;i++){ var lp=aheadPoint((0,$imports.rnd)(10,34)); d.pts.push({x:lp.x+(0,$imports.rnd)(-14,14),y:lp.y+(0,$imports.rnd)(-14,14)}); }
    },
    tick:function(dt,d,hard){
      if(d.hurt){ if(AN.t>20) anEnd(); return; }
      var on=false;
      for(var i=0;i<d.pts.length;i++){ if((0,$imports.dist2)(d.pts[i].x,d.pts[i].y,$imports.S.x,$imports.S.y)<10*10) on=true; }
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
      var dr=Math.sqrt((0,$imports.dist2)(d.c.x,d.c.y,$imports.S.x,$imports.S.y));
      if(dr<19){ AN.acc+=dt; (0,$imports.sanDrain)(2.0,dt,'anomaly'); if(!d.warn){ d.warn=1; (0,$imports.os)('我：我踩到粉笔线了。蜡烛的火苗一起朝我这边歪。',3.0); } }
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
          $imports.UI.choice('最东边那扇门后面，冷得像冰柜。门缝里有东西在敲，很有节奏。',[
            {label:'把门拉开一条缝',fn:function(){ d.chosen='near'; $imports.UI.closeChoice(); }},
            {label:'转身就走',fn:function(){ d.chosen='away'; $imports.UI.closeChoice(); }}
          ],anChoiceOptions(d));
        }
      }else if(d.chosen==='near'){
        $imports.PlayerStats.changeSan(14,'anomaly',{max:100});
        (0,$imports.os)('我：里面挂着一排冻硬的校服，袖子在风里互相敲。最外面那件的胸口，绣着我的名字。……我反而不怕了。',5.4);
        anEnd();
      }else{
        $imports.PlayerStats.changeSan(-(16),'anomaly',{min:0});
        (0,$imports.os)('我：我走了。那股冷气跟着我，一直贴在后颈上，走了很远都没散。',4.2);
        anEnd();
      }
    }
  },
  shifting:{w:0.9, small:1, fx:1, exam:1,
    cn:'窗外的楼在动', name:'窗外的楼在动', dfx:'twin',
    msg:'我：窗外的楼……在动。很慢，一栋一栋地挪。',
    when:function(){ return (0,$imports.inClassroomHere)(); },
    tick:function(dt,d,hard){
      (0,$imports.sanDrain)(0.5,dt,'anomaly');
      if(AN.t>18){ (0,$imports.os)('我：楼停下来了。整片校园里，只有钟楼一直没动——它在看着别的楼。',4.6); anEnd(); }
    }
  },
  stare:{w:0.95, fx:1, exam:1,
    cn:'全体回头', name:'全体回头', dfx:'stare',
    msg:'我：全班同时回过头来看着我。没有人眨眼。',
    when:function(){ return (0,$imports.inClassroomHere)(); },
    tick:function(dt,d,hard){
      if(d.hit){ d.hitT+=dt; if(d.hitT>1.6) anEnd(); return; }   /* 墙上的眼睛全睁开，停一会儿再散 */
      if(!$imports.S.moving){ AN.acc+=dt; } else { AN.acc=Math.max(0,AN.acc-dt); }
      if(AN.acc>1.8){ d.hit=1; d.hitT=0; anHurt('我站住了。于是全班一起站了起来，椅子腿在地上刮出同一声。然后他们又一起坐下。',18,{keep:1}); }
      else if(AN.t>12){ (0,$imports.os)('我：他们慢慢地转回去了。最后转回去的，是我的同桌。',3.4); anEnd(); }
    }
  },
  lamps:{w:0.9, small:1, fx:1,
    cn:'熄灯后的走廊灯', name:'熄灯后的走廊灯', dfx:'lamps',
    msg:'我：走廊的灯一盏一盏亮了起来。它在跟着我。',
    when:function(){ return corridorHere()&&(0,$imports.isNight)(); },
    tick:function(dt,d,hard){
      if(!$imports.S.moving){ AN.acc+=dt; } else { AN.acc=Math.max(0,AN.acc-dt*0.8); }
      if(AN.acc>1.6) anHurt('灯停在了我头顶，亮得发白。有一瞬间，我看见了自己手背里的骨头。',16);
      else if(AN.t>16){ (0,$imports.os)('我：灯一盏一盏地灭回去。最后一盏在我前面，灭得很慢，像在等我。',3.6); anEnd(); }
    }
  },
  feast:{w:0.5, fx:1,
    cn:'食堂的盛宴', name:'食堂盛宴', dfx:'deep',
    msg:'我：食堂里摆了一长桌菜，还冒着热气。每一副碗筷前面，都有一张写着名字的纸条。',
    when:function(t){ return inCanteen()&&$imports.MEALS.some(function(m){ return t>=m[0]&&t<m[1]; }); },
    tick:function(dt,d,hard){
      if(!inCanteen()){ AN.acc=Math.max(0,AN.acc-dt*0.5); }
      else { AN.acc+=dt; }
      if(AN.acc>$imports.Talent.modifier('anomaly.feast')){
        (0,$imports.advanceGameTime)(20);
        anHurt('我回过神来的时候，嘴里有东西。我不记得自己坐下过。面前的碗是空的，上面那张纸条写着我的名字。',22);
      }
      if(AN.active&&AN.t>24) anEnd();
    }
  },
  necker:{w:0.7, lethal:1, fx:1, late:1,
    cn:'围墙外的行人', name:'围墙外的行人', dfx:'neck',
    msg:'我：围墙外面有个人在走。我走他也走，我停他也停。他的脖子……太长了。',
    when:function(){ return $imports.S.mode==='out'&&$imports.S.x>($imports.BOUND.x1-220)*$imports.SC; },
    place:function(d){
      return {x:$imports.BOUND.x1*$imports.SC+16,y:$imports.S.y};
    },
    tick:function(dt,d,hard){
      var wallX=$imports.BOUND.x1*$imports.SC;
      var dToWall=Math.abs(wallX-$imports.S.x);
      if(dToWall<150*$imports.SC/2){ (0,$imports.sanDrain)(1.2,dt,'anomaly'); }
      if(dToWall<90*$imports.SC/2){ AN.acc+=dt; if(!d.warn){ d.warn=1; (0,$imports.os)('我：他停下来了。他在等我再走近一点。',3.0); } } else { AN.acc=Math.max(0,AN.acc-dt); }
      if(AN.acc>(hard?1.4:2.2)) anKill('他没有绕到校门口。他把脖子从围栏的缝里伸了进来，一直伸，一直伸。','neck');
      if(AN.t>20) anEnd();
    }
  },
  shadow:{w:0.8, small:1, fx:1,
    cn:'影子慢一拍', name:'影子慢一拍', dfx:'shadow',
    msg:'我：我的影子慢了半拍。它刚刚，自己动了一下。',
    when:function(){ return $imports.S.mode==='out'&&(0,$imports.onField)(); },
    begin:function(d){
      d.acc=0;
    },
    tick:function(dt,d,hard){
      if(underCover()){ AN.acc=Math.max(0,AN.acc-dt*0.6); }
      else { AN.acc+=dt; (0,$imports.sanDrain)(0.8,dt,'anomaly'); }
      if(AN.acc>10) anHurt('影子追上来了，和我叠在一起。有一瞬间，我分不清是谁先抬的手。',18);
      if(AN.active&&AN.t>22) anEnd();
    }
  },
  twin:{w:0.55, lethal:1, fx:1, late:1,
    cn:'天台的第二个你', name:'天台的第二个你', dfx:'twin',
    msg:'我：天台的另一头站着一个人。穿着我们学校的校服。他站的姿势，和我一模一样。',
    when:function(){ return onRoof(); },
    place:function(d){
      if(!$imports.INTERIORS[$imports.S.room]) return;
      var RR=$imports.INTERIORS[$imports.S.room];
      var cxr=RR.ox+RR.w/2, cyr=RR.oy+RR.h/2;
      d.x=cxr-($imports.S.x-cxr)*0.8; d.y=cyr-($imports.S.y-cyr)*0.8;           /* 天台的另一头，正对着你 */
      if((0,$imports.solidAt)(d.x,d.y)){ d.x=RR.ox+RR.w*0.22; d.y=RR.oy+RR.h*0.25; }
      d.room=$imports.S.room; return {x:d.x,y:d.y};
    },
    tick:function(dt,d,hard){
      if(!$imports.INTERIORS[$imports.S.room]||$imports.S.room!==d.room){ (0,$imports.os)('我：我下了楼。楼梯上一直有第二个人的脚步声，比我慢半拍。',3.6); anEnd(); return; }
      var dtwin=Math.sqrt((0,$imports.dist2)(d.x,d.y,$imports.S.x,$imports.S.y));
      /* 你不看他的时候，他就往你这边走 */
      var look=(0,$imports.angDiff)(Math.atan2(d.y-$imports.S.y,d.x-$imports.S.x),$imports.S.ang)<0.6;
      if(!look&&dtwin>16){
        var sp=(hard?26:18)*dt, ux=($imports.S.x-d.x)/dtwin, uy=($imports.S.y-d.y)/dtwin;
        d.x+=ux*sp; d.y+=uy*sp;
        if(!d.moved){ d.moved=1; (0,$imports.os)('我：……他刚才是不是动了？',2.6); }
      }
      if(dtwin<16) anKill('他走到了你面前。你们同时抬起手。他的手，是热的。','twin');
      if(AN.t>22){ (0,$imports.os)('我：他转身，从天台边上走了下去。没有声音。',3.4); anEnd(); }
    }
  },
  raindots:{w:0.32, fx:1, rained:1,
    cn:'雨点落成的字', name:'雨点成字', dfx:'water',
    msg:'我：雨点落在地上，没有散开。它们在排队。',
    when:function(){ return AN.rained; },
    tick:function(dt,d,hard){
      (0,$imports.sanDrain)(0.4,dt,'anomaly');
      if(AN.t>14){ (0,$imports.os)('我：地上的字写着——明天的天气：阴。明天的值日：你。',4.4); anEnd(); }
    }
  },
  cup:{w:0.8, lethal:1, warn:1, fx:1, cool:150,
    cn:'清华水杯', name:'清华水杯', dfx:'floor',
    msg:'我：头顶上叮叮当当地响。抬头——四楼的窗台上，一只白色的杯子在晃，盖子是淡紫色的。',
    when:function(){ var cw=cupWall(); return !!cw&&cw.m<2.4&&!underRoof(); },
    place:function(d){
      d.wall=cupWall(); d.phase=0;
      d.wob=(0,$imports.cupWobble)();                                              /* 在窗台上晃多久才掉 */
      if(d.wall) return {x:d.wall.x*$imports.SC,y:d.wall.y*$imports.SC};
    },
    tick:function(dt,d,hard){
      if(!d.wall||($imports.S.mode!=='out'&&d.phase<2)){ anEnd(); return; }          /* 进了楼，就砸不到了 */
      if(d.phase===0&&AN.t>=d.wob){
        d.phase=1; d.tf=AN.t; d.lx=$imports.S.x; d.ly=$imports.S.y;                        /* 对准你这一刻站的地方往下掉 */
        if(!d.said){ d.said=1; (0,$imports.os)('我：它掉下来了——',1.6,$imports.OS_FORCE); }
        try{ $imports.SFX.cupFall&&$imports.SFX.cupFall((0,$imports.cupFallTime)()); }catch(e){}
      }
      if(d.phase===1&&AN.t-d.tf>=(0,$imports.cupFallTime)()){
        d.phase=2; d.tl=AN.t;
        var miss=Math.sqrt((0,$imports.dist2)(d.lx,d.ly,$imports.S.x,$imports.S.y))*$imports.U2M;                  /* 米 */
        try{ $imports.SFX.cupHit&&$imports.SFX.cupHit(miss); }catch(e){}
        if(miss<$imports.CUP_R&&!underRoof()){
          anKill('头顶上一声闷响。我最后看见的，是一只白色的杯子，杯身上画着清华的二校门，金色的两个字：清華。它比我想象的要重。','floor');
          return;
        }
        if(miss<$imports.CUP_R) (0,$imports.os)('我：「当」的一声，砸在头顶的雨棚上，又弹到了地上。',3.4);
        else if(miss<2.6){ $imports.PlayerStats.changeSan(-(hard?9:6),'anomaly'); (0,$imports.os)('我：就砸在我脚边。杯子摔瘪了，杯身上画着清华的二校门。淡紫色的杯盖滚开，里面的水还是热的。',4.4); }
        else (0,$imports.os)('我：不远处「哐」的一声，一只杯子在地上弹了两下。我不敢抬头。',3);
      }
      if(d.phase===2&&AN.t-d.tl>2.6) anEnd();
    }
  },
  /* 只由清华水杯欠下：见下面的 colaOwe / colaDrive。不进随机池、没有冷却、不上黑板预告。
     砸中只扣 SAN（伞、柱廊、雨棚都挡得住），自己不杀人；SAN 本来就见底时照常按 SAN 归零处理。 */
  cola:{w:0, warn:1, fx:1,
    cn:'天降可乐', name:'天降可乐', dfx:'floor',
    msg:'我：头顶很高的地方「哐啷」一声，像有人踢翻了一个易拉罐。它还在滚。',
    when:function(){ return false; },
    place:function(d){ d.phase=0; d.warn=$imports.COLA_WARN; d.pan=($imports.GameRandom.next()<0.5?-1:1)*(0,$imports.rnd)(0.35,0.8); return {x:$imports.S.x,y:$imports.S.y}; },
    begin:function(d){ try{ $imports.SFX.colaRattle&&$imports.SFX.colaRattle(d.pan||0,d.warn||$imports.COLA_WARN); }catch(e){} },
    tick:function(dt,d,hard){
      if($imports.S.mode!=='out'&&d.phase<2){ (0,$imports.os)('我：我钻进了楼里。外面「嘭」的一声，接着是很长很长的「嘶——」。',3.6); anEnd(); return; }
      if(d.phase===0&&AN.t>=(d.warn||$imports.COLA_WARN)){
        d.phase=1; d.tf=AN.t; d.lx=$imports.S.x; d.ly=$imports.S.y;                        /* 对准你这一刻站的地方 */
        (0,$imports.os)('我：有东西从天上掉下来了——',1.6,$imports.OS_FORCE);
        try{ $imports.SFX.colaFall&&$imports.SFX.colaFall((0,$imports.colaFallTime)()); }catch(e){}
      }
      if(d.phase===1&&AN.t-d.tf>=(0,$imports.colaFallTime)()){
        d.phase=2; d.tl=AN.t;
        var miss=Math.sqrt((0,$imports.dist2)(d.lx,d.ly,$imports.S.x,$imports.S.y))*$imports.U2M;
        try{ $imports.SFX.colaHit&&$imports.SFX.colaHit(miss); }catch(e){}
        if(miss<$imports.COLA_R&&underRoof()) (0,$imports.os)('我：「嘭」地砸在头顶的棚子上，滚下来，在我脚边打转。是一罐可乐。',3.6);
        else if(miss<$imports.COLA_R&&$imports.USE.brollyShield){ $imports.PlayerStats.changeSan(-(hard?4:2),'anomaly',{min:0}); (0,$imports.os)('我：伞面猛地一沉，有什么东西弹了出去——一罐可乐，摔瘪了，还在往外冒泡。',4.2); }
        else if(miss<$imports.COLA_R){ d.hit=1; anHurt('我：「嘭」——正砸在我肩膀上。是一罐可乐，冰的。罐子瘪了，泡沫顺着袖子往下淌。抬头，天上什么都没有。',13,{keep:1}); }
        else if(miss<2.4){ $imports.PlayerStats.changeSan(-(hard?5:3),'anomaly',{min:0}); (0,$imports.os)('我：就在我脚边炸开了。一罐可乐，瘪成一团，泡沫「嘶嘶」地往外冒。抬头——天上什么都没有。',4.4); }
        else (0,$imports.os)('我：不远处「嘭」的一声。一罐可乐在地上打转，泡沫喷了一地。',3.2);
      }
      if(d.phase===2&&AN.t-d.tl>2.8) anEnd();
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
  var o=(0,$imports.objById)(id); if(!o) return 99999;
  var cx=o.x*$imports.SC+o.w*$imports.SC/2, cy=o.y*$imports.SC+o.h*$imports.SC/2;
  return Math.sqrt((0,$imports.dist2)($imports.S.x,$imports.S.y,cx,cy));
}
function corridorHere(){
  if($imports.S.mode!=='in') return false;
  var R=$imports.INTERIORS[$imports.S.room];
  if(!R||R.host!=='teach'||R.floor>5) return false;
  var row=Math.floor(($imports.S.y-R.oy)/R.th);
  return row>=16&&row<=20;
}
function inLabHere(){ return $imports.S.mode==='in'&&$imports.INTERIORS[$imports.S.room]&&$imports.INTERIORS[$imports.S.room].host==='lab'; }
function inToiletHere(){
  if($imports.S.mode!=='in') return false;
  var R=$imports.INTERIORS[$imports.S.room]; if(!R) return false;
  var t=(0,$imports.tileAt)(R,$imports.S.x,$imports.S.y);
  if(t==='B'||t==='G') return true;
  if(R.host==='teach'){
    var c=Math.floor(($imports.S.x-R.ox)/R.tw), r=Math.floor(($imports.S.y-R.oy)/R.th);
    if(c>=58&&c<=61&&r>=16&&r<=19) return true;
  }
  return false;
}
function inCanteen(){ return $imports.S.mode==='in'&&$imports.S.room==='canteen1'; }
function onRoof(){ return $imports.S.mode==='in'&&$imports.S.room==='teach6'; }
/* 清华水杯：离你最近的那面高楼外墙（教学楼 / 行政楼 / 实验楼，都是五层）。
   返回墙上那一点（地图坐标）、朝外的法线、离墙几米；不在室外或离得远返回 null */
var CUP_BLD=['teach','admin','lab'];
function cupWall(){
  if($imports.S.mode!=='out') return null;
  var mx=$imports.S.x/$imports.SC, my=$imports.S.y/$imports.SC, best=null;
  CUP_BLD.forEach(function(id){
    var o=(0,$imports.objById)(id); if(!o) return;
    var px=(0,$imports.clamp)(mx,o.x,o.x+o.w), py=(0,$imports.clamp)(my,o.y,o.y+o.h), dd=Math.hypot(mx-px,my-py);
    if(dd>0.01&&(!best||dd<best.d)) best={x:px,y:py,d:dd,nx:(mx-px)/dd,ny:(my-py)/dd,id:id};
  });
  if(best) best.m=best.d*$imports.SC*$imports.U2M;
  return best;
}

function anAllowed(id){
  var a=AN_DEFS[id];
  return a?a.when($imports.S.tsec,(0,$imports.needWhere)($imports.S.tsec)):false;
}
function pickAnomaly(){
  var pool=[],i,id;
  for(i=0;i<AN_ID.length;i++){
    id=AN_ID[i];
    if(!anAllowed(id)) continue;
    if(AN_COOL[id]&&AN.cool[id]!==undefined&&((0,$imports.gameClock)()-AN.cool[id])<AN_COOL[id]) continue;
    pool.push(id);
  }
  if(!pool.length) return null;
  if((0,$imports.examNow)()){       /* 考试时只出教室里的那几种 */
    pool=pool.filter(function(a){ return EXAM_AN[a]; });
    if(!pool.length) return null;
  }
  var want=null;
  if((0,$imports.needWhere)($imports.S.tsec)==='教室') want=AN_SMALL;
  var pref=[];
  if(want){ for(i=0;i<pool.length;i++) if(want[pool[i]]) pref.push(pool[i]); }
  if(pref.length>=3&&$imports.GameRandom.next()<0.8) pool=pref;
  if($imports.S.day===1&&$imports.S.diff==='easy'){
    pool=pool.filter(function(a){ return !AN_DEFS[a].late; });
    if(!pool.length) return null;
  }
  /* 不再纯随机：同一种不连着来（只剩它就这次不来）；最近出过的少来，没见过的多来。
     以前室外路上几乎只剩「拍肩膀」，一局能连着拍九次。 */
  var hist=$imports.RT.anHist||[], last=hist[hist.length-1], seen=$imports.RT.anSeen||{};
  if(pool.length>1) pool=pool.filter(function(a){ return a!==last; });
  else if(pool[0]===last) return null;
  /* 最近四次里已经出过两次的，这次先不来；全被排掉就空一档（安静也是节奏） */
  var recent=hist.slice(-4);
  var fresh=pool.filter(function(a){ return recent.filter(function(h){ return h===a; }).length<2; });
  if(!fresh.length){ $imports.RT.anHist=hist.concat('_').slice(-6); return null; }
  pool=fresh;
  if(!hist.length&&pool.indexOf('chalk')>=0) return 'chalk';   /* 第一次总是黑板上的预告：先教会你看时间 */
  var tot=0,ws=[];
  for(i=0;i<pool.length;i++){
    var w=AN_W[pool[i]]||1;
    if(AN_SMALL[pool[i]]) w*=1.25;
    if(hist.slice(-4).indexOf(pool[i])>=0) w*=0.35;
    if(!seen[pool[i]]) w*=2.2;
    ws.push(w); tot+=w;
  }
  var r=$imports.GameRandom.next()*tot,acc=0;
  for(i=0;i<pool.length;i++){ acc+=ws[i]; if(r<acc) return pool[i]; }
  return pool[pool.length-1];
}

/* ---------- 异象节奏 ----------
   以前 AN.next 按游戏分钟倒数：上课时时间流速是下课的 6–7 倍，于是课上大约每 10 秒就来一次，
   一个接一个停不下来。现在按真实秒数计；SAN 越低、违规越多，来得越密。 */
function anInterval(){
  var hard=($imports.S.diff==='hard');
  var base=hard?(0,$imports.rnd)(24,40):(0,$imports.rnd)(40,64);
  base*=0.62+0.38*(0,$imports.clamp)($imports.S.san,0,100)/100;
  base*=1-(0,$imports.clamp)($imports.S.viol,0,100)/260;
  if(AN.lastBig) base*=1.25;                     /* 大的过去之后，给一口喘气的时间 */
  if($imports.S.mode==='in'&&$imports.INTERIORS[$imports.S.room]&&$imports.INTERIORS[$imports.S.room].principal) base*=0.5;   /* 校长办公室：异象频发 */
  return Math.max(10,base*$imports.CampusPressure.current().anomaly);
}
function anScheduleNext(){
  if(!AN.preNext||!AN.pre){ try{ AN.pre = pickAnomaly(); }catch(e){ AN.pre=null; } }
  AN.next=anInterval(); AN.next0=(AN.next0||0)+1;
  if(AN.preNext){ AN.next=AN.preNext; AN.preNext=0; }   /* 黑板上预告过的时间，要兑现 */
}
function anStart(){
  var id=null, planned=AN.pre;
  /* 进入考试后，之前预告的异象也必须受考试候选限制。 */
  var examRestricted=(0,$imports.examNow)();
  if(($imports.S.diff==='easy'||AN.locked||AN_WARN[AN.pre])&&AN.pre&&(!examRestricted||EXAM_AN[AN.pre])){
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
  if(id==='cup') colaOwe();
  $imports.RT.anHist=($imports.RT.anHist||[]).concat(id).slice(-6); $imports.RT.anSeen=$imports.RT.anSeen||{}; $imports.RT.anSeen[id]=1;
  AN.lastBig=!AN_SMALL[id];
  if(AN_COOL[id]!==undefined||AN_DEFS[id].rained) AN.cool[id]=(0,$imports.gameClock)();
  if(AN_DEFS[id].rained) AN.rained=true;
  (0,$imports.os)(AN_MSG[id]||'我：……',4.6);
  try{ $imports.SFX.anomaly&&$imports.SFX.anomaly(id); }catch(e){}
  anOn(id);
}
function anEnd(){
  if(!AN.active&&AN.id===null) return;
  var id=AN.id;
  anOff(id);
  if(id==='roster'&&!AN.data.done){
    (0,$imports.addViolation)(18);
    (0,$imports.os)('我：那张名单我没动。走开的时候，我听见身后有笔尖划过纸的声音。',4.0);
  }
  try{ (0,$imports.traceAdd)(id); }catch(e){}
  try{ $imports.SFX.anomalyEnd&&$imports.SFX.anomalyEnd(id); }catch(e){}
  var resume=(id==='cola'&&AN.data&&AN.data.resume)||null;
  AN.id=null; AN.active=false; AN.acc=0;
  if(resume) colaResume(resume); else anScheduleNext();
}

/* ---------- 天降可乐：清华水杯真正开始以后欠下的一次 ----------
   RT.colaPending={seq,day,clock}：只在 anStart 里水杯真正开场时写入（调试面板、宣传片、档案回放都不经过这里）；
   最多挂一个，连着几次水杯也只欠一罐。之后第一次「夜里、在室外、能安全开始」时直接开场，
   不经过随机抽取、冷却、预告和「刚出过」的过滤，所以不存在抽不到。
   开场时同一步里清掉 colaPending、记下 colaDone=seq：存档要么还欠着，要么已经在演，不会两样都有。 */
var COLA_SETTLE=2.5;      /* 夜里在室外连续「能开始」这么多秒才来：刚出门、刚结束别的异象，先缓一口气 */
function colaOwe(){
  if($imports.RT.colaPending) return;
  $imports.RT.colaSeq=($imports.RT.colaSeq||0)+1;
  $imports.RT.colaPending={seq:$imports.RT.colaSeq,day:$imports.S.day,clock:(0,$imports.gameClock)()};
}
/* 现在能不能开始：夜里、在室外、手上没有别的危险（异象、巡察、检查、躲柜、驾驶、过场、选择框、假正常） */
function colaSafe(){
  if(!$imports.RT.colaPending||$imports.S.dead||$imports.S.screen!=='play') return false;
  if(!(0,$imports.isNight)()||$imports.S.mode!=='out') return false;
  if(AN.active||$imports.PatrolWorld.localChase()||$imports.HIDE.on) return false;
  if($imports.S.fn&&$imports.S.fn.on) return false;
  if(typeof $imports.Inspection!=='undefined'&&($imports.Inspection.active()||$imports.Inspection.quiet())) return false;
  if(typeof $imports.CarChase!=='undefined'&&$imports.CarChase.active()) return false;
  if(typeof $imports.Elevator!=='undefined'&&$imports.Elevator.inRide()) return false;
  if(typeof $imports.CUT!=='undefined'&&$imports.CUT.on) return false;
  if($imports.UI.anyOpen()) return false;
  return true;
}
function colaDrive(dt){
  if(!colaSafe()){ $imports.RT.colaWait=0; return false; }
  $imports.RT.colaWait=($imports.RT.colaWait||0)+dt;
  if($imports.RT.colaWait<COLA_SETTLE) return false;
  return colaStart();
}
function colaStart(){
  var p=$imports.RT.colaPending; $imports.RT.colaWait=0;
  if(!p) return false;
  $imports.RT.colaPending=null;
  if(p.seq<=($imports.RT.colaDone||0)) return false;                 /* 这一号已经演过 */
  $imports.RT.colaDone=p.seq;
  /* 原来排好的下一个异象（包括黑板上预告过的）记下来，可乐结束后原样接上 */
  var resume={pre:AN.pre||null,next:AN.next,locked:!!AN.locked,lockWait:AN.lockWait||0,preNext:AN.preNext||0};
  AN.id='cola'; AN.t=0; AN.acc=0; AN.active=true; AN.data={seq:p.seq,owed:p.day,resume:resume}; AN.sub=0;
  $imports.RT.anHist=($imports.RT.anHist||[]).concat('cola').slice(-6); $imports.RT.anSeen=$imports.RT.anSeen||{}; $imports.RT.anSeen.cola=1;
  AN.lastBig=true;
  (0,$imports.os)(AN_MSG.cola,4.2);
  try{ $imports.Playtest.event('异象','cola'); }catch(e){}
  anOn('cola');
  return true;
}
function colaResume(r){
  AN.pre=r.pre||null; AN.locked=!!r.locked; AN.lockWait=r.lockWait||0; AN.preNext=r.preNext||0;
  AN.next=Math.max(Number.isFinite(r.next)?r.next:0,12);   /* 至少空十几秒再来下一个 */
}

/* 选一个在玩家前方、站得住的点（世界单位） */
function aheadPoint(dist){
  var a, k, tries=[0,0.6,-0.6,1.2,-1.2,$imports.PI];
  for(k=0;k<tries.length;k++){
    a=$imports.S.ang+tries[k];
    var x=$imports.S.x+Math.cos(a)*dist, y=$imports.S.y+Math.sin(a)*dist;
    if(!(0,$imports.solidAt)(x,y)) return {x:x,y:y};
  }
  return {x:$imports.S.x,y:$imports.S.y};
}
function anOn(id,silent){
  var d=AN.data, def=AN_DEFS[id]||{}, src=null;
  /* 以前好几个异象的"看得见的东西"和"判定用的位置"不在一个地方：
     天台的另一个你就生在玩家脚下、仪式圈半径和判定半径差一倍、渗水点和水渍各算各的。
     现在由各自的 place 布置判定点，表现就生在那里。 */
  if(def.place) src=def.place(d)||null;
  try{ if(HAS_FX[id]) (0,$imports.anfxSpawn)(id, src?src.x:$imports.S.x, src?src.y:$imports.S.y); }catch(e){}
  AN.rained = AN.rained || (id==='rain');
  if(def.begin) def.begin(d);
}

function anOff(id){ (0,$imports.entClear)(); try{ (0,$imports.anfxClear)(); }catch(e){} }

/* 非致命异象的"惩罚"：吓一下、扣 SAN，然后结束 */
function anHurt(msg,loss,opt){
  opt=opt||{};
  var k=($imports.S.diff==='hard')?1.25:0.9;
  $imports.PlayerStats.changeSan(-(loss*k),'anomaly',{min:0});
  $imports.VisualState.hurt=Math.max($imports.VisualState.hurt||0,0.65);
  if(!opt.quiet){                           /* quiet：不闪白、不加刺耳的音效，只留画面暗下去那一下 */
    $imports.VisualState.flash=Math.max($imports.VisualState.flash||0,0.25);
    try{ $imports.SFX.sting&&$imports.SFX.sting(); }catch(e){}
  }
  (0,$imports.os)(msg,4.4);
  if($imports.S.san<=0&&!$imports.S.dead){ (0,$imports.kill)('你一直撑着的那根弦，断了。','vignette','san'); return; }
  if(!opt.keep) anEnd();
}
/* 能躲雨的地方：屋里、柱廊下、车棚、连廊下 */
function underCover(){
  if($imports.S.mode==='in') return true;
  if($imports.USE.brollyShield) return true;
  return underRoof();
}
/* 头顶有没有真正的顶（柱廊、连廊、车棚）；伞不算 */
function underRoof(){
  if($imports.S.mode==='in') return true;
  var mx=$imports.S.x/$imports.SC, my=$imports.S.y/$imports.SC, i, o;
  for(i=0;i<$imports.OBJ.length;i++){
    o=$imports.OBJ[i];
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
  var id=AN.id, d=AN.data, hard=($imports.S.diff==='hard');
  AN.t+=dt;
  if(AN.t>45){ anEnd(); return; }
  AN_DEFS[id].tick(dt,d,hard);
}

/* 拍肩的另一种：脚步声 → 拍肩 → 要回头。回头损失少量 SAN；不回头时突脸、扣更多 SAN 并加违规。 */
function turnSmileTick(dt,d){
  if(!d.steps) d.steps=0;
  if(d.chosen===null&&!d.asked&&AN.t>d.steps*0.42&&d.steps<4){          /* 身后的脚步，越来越近 */
    d.steps++;
    try{ $imports.SFX.patStep(0,0.35+d.steps*0.15,true,false); }catch(e){}
  }
  if(d.chosen===null){
    if(AN.t>1.9&&!d.asked){
      d.asked=true;
      $imports.UI.choice('脚步声停在我身后。那只手拍了拍我的肩膀，没有拿开——像在等我回头。',[
        {label:'不回头',fn:function(){ d.chosen='no'; $imports.UI.closeChoice(); }},
        {label:'回头看',fn:function(){ d.chosen='yes'; $imports.UI.closeChoice(); }}
      ],anChoiceOptions(d));
    }
    return;
  }
  AN.acc+=dt;
  if(d.done) { if(AN.acc>2.2) anEnd(); return; }
  if(d.chosen==='yes'&&AN.acc>0.3){
    d.done=1; AN.acc=0;
    $imports.S.ang+=$imports.PI;                                                          /* 真的转过身去 */
    try{ (0,$imports.syncCamera)(0); }catch(e){}
    (0,$imports.smileShow)('behind');
    anHurt('我：我回头了。身后是一张很大很大的笑脸，眼睛弯成两道缝，嘴角一直咧到耳根。它冲我点了点头，就不见了。我的手心全是汗。',5,{quiet:1,keep:1});
  }else if(d.chosen==='no'&&AN.acc>1.0){
    d.done=1;
    (0,$imports.smileShow)('jump');
    (0,$imports.addViolation)(15);
    anHurt('我没有回头。它等不及了——那张脸从我肩膀上绕过来，贴着我的鼻尖，一点一点咧开了嘴。',30);
  }
}
function anKill(msg,fx){
  var f=fx||DFX_MAP[AN.id]||'vignette';
  (0,$imports.kill)(msg,f,'an:'+AN.id);
}

function anDrive(dt){
  if($imports.S.fn&&$imports.S.fn.on&&$imports.S.fn.v<72){ return; }
  if(!AN.active){
    if($imports.S.room==='portal_tunnel')return;
    if(colaDrive(dt))return;
    if(typeof $imports.Inspection!=='undefined'&&$imports.Inspection.quiet())return;
    AN.next -= dt;
    if(AN.next<=0) anStart();
  } else {
    anTick(dt);
  }
}

/* 首次看懂预警属于本局进度，由应用模拟提交；画面重建不写入这个标记。 */
function anNotifyWarning(visible){
  if(visible&&$imports.S.diff==='easy'&&AN.pre&&!$imports.RT.preTold){
    $imports.RT.preTold=1;
    (0,$imports.os)('我：这个时间……我梦见过。',3.4);
  }
}

/* @module-exports */
GameModules.publish("game3d/js/anomaly.js",{
"AN":{get:function(){return AN;},set:function($value){AN=$value;}},
"AN_DEFS":{get:function(){return AN_DEFS;},set:function($value){AN_DEFS=$value;}},
"AN_ID":{get:function(){return AN_ID;},set:function($value){AN_ID=$value;}},
"anTable":{get:function(){return anTable;},set:function($value){anTable=$value;}},
"AN_W":{get:function(){return AN_W;},set:function($value){AN_W=$value;}},
"AN_SMALL":{get:function(){return AN_SMALL;},set:function($value){AN_SMALL=$value;}},
"AN_COOL":{get:function(){return AN_COOL;},set:function($value){AN_COOL=$value;}},
"AN_CN":{get:function(){return AN_CN;},set:function($value){AN_CN=$value;}},
"AN_NAME":{get:function(){return AN_NAME;},set:function($value){AN_NAME=$value;}},
"DFX_MAP":{get:function(){return DFX_MAP;},set:function($value){DFX_MAP=$value;}},
"AN_MSG":{get:function(){return AN_MSG;},set:function($value){AN_MSG=$value;}},
"AN_LETHAL":{get:function(){return AN_LETHAL;},set:function($value){AN_LETHAL=$value;}},
"AN_WARN":{get:function(){return AN_WARN;},set:function($value){AN_WARN=$value;}},
"HAS_FX":{get:function(){return HAS_FX;},set:function($value){HAS_FX=$value;}},
"EXAM_AN":{get:function(){return EXAM_AN;},set:function($value){EXAM_AN=$value;}},
"nearObj":{get:function(){return nearObj;},set:function($value){nearObj=$value;}},
"corridorHere":{get:function(){return corridorHere;},set:function($value){corridorHere=$value;}},
"inLabHere":{get:function(){return inLabHere;},set:function($value){inLabHere=$value;}},
"inToiletHere":{get:function(){return inToiletHere;},set:function($value){inToiletHere=$value;}},
"inCanteen":{get:function(){return inCanteen;},set:function($value){inCanteen=$value;}},
"onRoof":{get:function(){return onRoof;},set:function($value){onRoof=$value;}},
"CUP_BLD":{get:function(){return CUP_BLD;},set:function($value){CUP_BLD=$value;}},
"cupWall":{get:function(){return cupWall;},set:function($value){cupWall=$value;}},
"anAllowed":{get:function(){return anAllowed;},set:function($value){anAllowed=$value;}},
"pickAnomaly":{get:function(){return pickAnomaly;},set:function($value){pickAnomaly=$value;}},
"anInterval":{get:function(){return anInterval;},set:function($value){anInterval=$value;}},
"anScheduleNext":{get:function(){return anScheduleNext;},set:function($value){anScheduleNext=$value;}},
"anStart":{get:function(){return anStart;},set:function($value){anStart=$value;}},
"anEnd":{get:function(){return anEnd;},set:function($value){anEnd=$value;}},
"COLA_SETTLE":{get:function(){return COLA_SETTLE;},set:function($value){COLA_SETTLE=$value;}},
"colaOwe":{get:function(){return colaOwe;},set:function($value){colaOwe=$value;}},
"colaSafe":{get:function(){return colaSafe;},set:function($value){colaSafe=$value;}},
"colaDrive":{get:function(){return colaDrive;},set:function($value){colaDrive=$value;}},
"colaStart":{get:function(){return colaStart;},set:function($value){colaStart=$value;}},
"colaResume":{get:function(){return colaResume;},set:function($value){colaResume=$value;}},
"aheadPoint":{get:function(){return aheadPoint;},set:function($value){aheadPoint=$value;}},
"anOn":{get:function(){return anOn;},set:function($value){anOn=$value;}},
"anOff":{get:function(){return anOff;},set:function($value){anOff=$value;}},
"anHurt":{get:function(){return anHurt;},set:function($value){anHurt=$value;}},
"underCover":{get:function(){return underCover;},set:function($value){underCover=$value;}},
"underRoof":{get:function(){return underRoof;},set:function($value){underRoof=$value;}},
"TURN_SMILE_P":{get:function(){return TURN_SMILE_P;},set:function($value){TURN_SMILE_P=$value;}},
"anChoiceOptions":{get:function(){return anChoiceOptions;},set:function($value){anChoiceOptions=$value;}},
"anTick":{get:function(){return anTick;},set:function($value){anTick=$value;}},
"turnSmileTick":{get:function(){return turnSmileTick;},set:function($value){turnSmileTick=$value;}},
"anKill":{get:function(){return anKill;},set:function($value){anKill=$value;}},
"anDrive":{get:function(){return anDrive;},set:function($value){anDrive=$value;}},
"anNotifyWarning":{get:function(){return anNotifyWarning;},set:function($value){anNotifyWarning=$value;}}
});
})(GameModules.imports("game3d/js/anomaly.js"));
