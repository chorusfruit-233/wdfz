/* @module-capsule */
(function($imports){
/* 里世界 3D · 交互：设施、楼梯、搜东西、终端 */
'use strict';

/* ---- 格子级遮挡（来自 PR #24，略作加固）----
   以前交互只按距离和朝向挑格子，隔着墙也能翻到隔壁教室的课桌、摸到走廊另一侧的柜子。
   现在沿玩家→目标采样：墙 '#'、实心楼梯格、关着的门都算挡住；目标自己那一格不参与遮挡
   （门、楼梯本身是实心格，不跳过的话会把自己挡掉）。
   斜着站时一条线容易擦到门边的墙角，所以除了目标中心，再试目标格里朝向玩家那两侧的点，任意一条通就算看得见。 */
function tileLOS(R,x0,y0,x1,y1,tc,tr){
  if(!R||!R.grid) return true;
  var dx=x1-x0, dy=y1-y0, len=Math.sqrt(dx*dx+dy*dy);
  if(len<0.001) return true;
  var step=Math.max(0.5,Math.min(R.tw,R.th)*0.25), n=Math.ceil(len/step), i;
  for(i=1;i<n;i++){
    var t=i/n, px=x0+dx*t, py=y0+dy*t;
    var c=Math.floor((px-R.ox)/R.tw), r=Math.floor((py-R.oy)/R.th);
    if(r<0||c<0||r>=R.rows||c>=R.cols) return false;
    if(c===tc&&r===tr) continue;
    var ch=R.grid[r][c];
    if(ch==='#'||(0,$imports.isSolidCh)(ch)) return false;
    if(ch==='='&&!(0,$imports.doorIsOpen)(R,px,py)) return false;
  }
  return true;
}
function tileVisible(R,hit){
  if(tileLOS(R,$imports.S.x,$imports.S.y,hit.x,hit.y,hit.c,hit.r)) return true;
  var ox=R.tw*0.42*($imports.S.x>hit.x?1:-1), oy=R.th*0.42*($imports.S.y>hit.y?1:-1);
  return tileLOS(R,$imports.S.x,$imports.S.y,hit.x+ox,hit.y,hit.c,hit.r)||tileLOS(R,$imports.S.x,$imports.S.y,hit.x,hit.y+oy,hit.c,hit.r);
}

function nearWorld(radius){
  if($imports.S.mode==='in'){
    var R=$imports.INTERIORS[$imports.S.room];
    if(!R) return null;
    if(R.spiral&&$imports.SP.state!=='ground') return null;   /* 在钟楼楼梯上，够不着地上的东西 */
    var hits=[];
    for(var r=0;r<R.rows;r++) for(var c=0;c<R.cols;c++){
      var ch=R.grid[r][c];
      if(ch==='#'||ch==='.') continue;
      var wx=R.ox+(c+0.5)*R.tw, wy=R.oy+(r+0.5)*R.th;
      var d=Math.sqrt((0,$imports.dist2)(wx,wy,$imports.S.x,$imports.S.y));
      if(d>=radius) continue;
      /* 以前只取最近的格子、不看朝向：终端被课桌围着时，按 E 永远在翻课桌。
         现在面前的东西优先，侧面、背后的要近得多才会被选中。 */
      var off=d<4?0:(0,$imports.angDiff)(Math.atan2(wy-$imports.S.y,wx-$imports.S.x),$imports.S.ang);
      if(off>.62&&d>3)continue;
      hits.push({ch:ch,c:c,r:r,x:wx,y:wy,d:d,score:off*32+d});
    }
    hits.sort(function(a,b){return a.score-b.score;});
    for(var k=0;k<hits.length;k++) if(tileVisible(R,hits[k])) return hits[k];   /* 隔着墙 / 关着的门的不算 */
    return null;
  }
  var best=null,bd=1e9;
  for(var i=0;i<$imports.OBJ.length;i++){
    var o=$imports.OBJ[i];
    if(o.k!=='roof') continue;
    var dw=(0,$imports.doorWorld)(o);
    var d2=Math.sqrt((0,$imports.dist2)(dw.x,dw.y,$imports.S.x,$imports.S.y));
    if(d2<70&&d2<bd){ bd=d2; best={obj:o,door:dw,d:d2}; }
  }
  return best;
}

var SAN_ACTS={
  run:   {n:'沿跑道跑两圈', san:14, min:12, cd:90,  msg:'我：跑完两圈。肺很疼，脑子清楚了一点。'},
  shoot: {n:'投几个球',     san:10, min:8,  cd:70,  msg:'我：球砸在框上，弹回来。声音很空。'},
  eat:   {n:'吃饭',         san:18, min:20, cd:140, msg:'我：饭是凉的。但我还是吃完了。'},
  sleep: {n:'躺一会儿',     san:26, min:45, cd:200, msg:'我：我闭了一下眼睛。醒来的时候，上铺的床板往下压着一个人的形状。'},
  wash:  {n:'洗把脸',       san:8,  min:4,  cd:50,  msg:'我：水很凉。镜子里那个人也洗了把脸。'},
  piano: {n:'弹一会儿琴',   san:16, min:10, cd:120, msg:'我：我弹了一段。走廊里没有人过来。'},
  pc:    {n:'玩一会儿电脑', san:12, min:15, cd:100, msg:'我：机房里只有我这一台亮着。屏幕右下角的时钟在走。'},
  view:  {n:'看看远处',     san:6,  min:6,  cd:40,  msg:'我：从这里能看见半个校园。都在雾里。雾的边上，一直是同一栋楼。'}
};
var FAC_CD={Z:70,C:90,N:45,Y:200,K:0};
function facClock(){ return (0,$imports.gameClock)(); }
function facRoll(n){
  var r=$imports.GameRandom.next(), r2=$imports.GameRandom.next();
  if((0,$imports.hasItem)('goggles')) r=Math.min(r,r2);              /* 护目镜：两次里取好的那次（离心机、显微镜都是数字小的好） */
  return Math.floor(r*n);
}
function useFacility(ch,R){
  if(ch==='K'&&$imports.PortalExploration.collect(R))return true;
  var cool=$imports.S.actCool||($imports.S.actCool={});
  var key='fac'+ch;
  var cd=FAC_CD[ch]||60;
  if(cool[key]&&facClock()<cool[key]){ (0,$imports.os)('我：刚弄过。等一会儿。',2.0); return true; }
  var rolled=false;
  if(ch==='Z'){
    /* 物理实验室：单摆会"预报"下一次异象 —— 说出来的那个就是真的会来的那个 */
    rolled=true;
    if(!$imports.AN.active&&$imports.AN.pre&&$imports.AN_WARN[$imports.AN.pre]&&(0,$imports.anAllowed)($imports.AN.pre)){
      $imports.AN.locked=true;
      var mins=Math.max(1,Math.round($imports.AN.next*(0,$imports.rateAt)($imports.S.tsec)/60));
      (0,$imports.os)('我：我把摆拉开、松手。它没有来回摆，而是慢慢停在一个方向上，像被什么吸住了。\n秤盘上的砝码排成了几个字——「'+($imports.AN_CN[$imports.AN.pre]||$imports.AN.pre)+'」。还有大约 '+mins+' 分钟。',6.5);
      (0,$imports.toast)('预报：'+($imports.AN_CN[$imports.AN.pre]||$imports.AN.pre));
      (0,$imports.addClue)('pendulum');
    }else if($imports.AN.active){
      $imports.PlayerStats.changeSan(-(4),'interact',{min:0});
      (0,$imports.os)('我：摆在乱转，转得越来越快。它在说：已经来了。',3.6);
    }else{
      $imports.PlayerStats.changeSan(5,'interact',{max:100});
      (0,$imports.os)('我：摆停在正中，一动不动。它没有给出危险预警。',3.4);
    }
    (0,$imports.advanceGameTime)(3);
  }else if(ch==='C'){
    rolled=true;
    var v2=facRoll(100);
    if(v2<46&&!$imports.RT.vialTaken){
      if(!(0,$imports.addItem)('vial')) return true;
      $imports.RT.vialTaken=1; (0,$imports.os)('我：转子转起来，液体分成两层。最底下沉着一线发光的东西，我把它倒进一支空管里。',4.2);
    }
    else if(v2<46){ $imports.PlayerStats.changeSan(7,'interact',{max:100}); (0,$imports.os)('我：转子转起来，液体分成两层。白的在上。',3.6); (0,$imports.toast)('转子停稳了'); }
    else if(v2<72){ $imports.PlayerStats.changeSan(2,'interact',{max:100}); (0,$imports.os)('我：离心机停了。管子里的东西还在转。',3.6); (0,$imports.toast)('液面平静下来'); }
    else { $imports.PlayerStats.changeSan(-(5),'interact',{min:0}); (0,$imports.os)('我：配平没配好，整台机器在桌上跳。',3.6); (0,$imports.toast)('机器猛烈震动'); }
    (0,$imports.advanceGameTime)(5);
  }else if(ch==='N'){
    rolled=true;
    if(!$imports.RT.lensTaken){                       /* 传送门材料：透镜 */
      if((0,$imports.addItem)('lens')){
        $imports.RT.lensTaken=1;
        (0,$imports.os)('我：镜片里有一只眼睛，它眨了一下，物镜就松了。我把它拧了下来，攥在手里是凉的。',4.4);
        cool[key]=facClock()+cd;
      }
      return true;
    }
    var v3=facRoll(100);
    if(v3<58){ $imports.PlayerStats.changeSan(4,'interact',{max:100}); (0,$imports.os)('我：调焦旋钮是热的。视野里有东西在慢慢游。',3.6); (0,$imports.toast)('重新看清了'); }
    else { $imports.PlayerStats.changeSan(-(4),'interact',{min:0}); (0,$imports.os)('我：镜片里有一只眼睛。它先眨了一下。',3.8); (0,$imports.toast)('镜片里有只眼睛'); }
  }else if(ch==='Y'){
    rolled=true;
    (0,$imports.addClue)('geo');
    if(!(0,$imports.hasItem)('compass')&&!$imports.RT.geoCompass){
      if(!(0,$imports.addItem)('compass')) return true;
      $imports.RT.geoCompass=1;
      (0,$imports.os)('我：地球仪上，学校的位置被铅笔描了很多遍，纸都描破了。底座的抽屉里有个罗盘。',4.6);
    }else{
      (0,$imports.os)('我：我转了一下地球仪。它转回来，停在原来那一面。',3.2);
    }
    $imports.PlayerStats.changeSan(2,'interact',{max:100});
  }else if(ch==='K'){
    if(R.host==='admin'){
      (0,$imports.os)('我：办公桌上摊着一叠表格。最上面那张的名字被涂掉了。',3.6);
      if(!$imports.RT.adminDesk){ $imports.RT.adminDesk=1; (0,$imports.addClue)('office'); (0,$imports.toast)('办公室 · 线索 +1'); }
    }else if(R.floor===1){
      (0,$imports.portalBench)(); return true;            /* 物理实验室的实验台：造传送门（portal.js） */
    }else{
      if(R.floor===5){ (0,$imports.os)('我：讲台上摊着谱子。第三乐章那一页被折了角。',3.4); }
      else if(R.floor===3){ (0,$imports.os)('我：教师台上摊着一本「机房钥匙借用登记」。最后一页是空的。',3.6); }
      else { (0,$imports.os)('我：教师台上还留着上一节课的东西。烧杯里的水是温的。',3.4); }
      if(R.floor===2&&!$imports.RT.labReagent){
        if((0,$imports.hasItem)('goggles')) (0,$imports.os)('我：台上还有一副护目镜，我已经带了一副。',3.2);
        else if((0,$imports.addItem)('goggles')) $imports.RT.labReagent=1;
      }
    }
  }
  if(rolled) cool[key]=facClock()+cd;
  try{ $imports.SFX.click(); }catch(e){}
  return true;
}
function sanActFor(R,hit){
  if($imports.S.mode==='in'){
    if(!hit||!R) return null;
    /* 饭点免费吃；饭点以外得投币（见 canteenWindow） */
    if(R.host==='canteen'&&(hit.ch==='k'||hit.ch==='t')&&(0,$imports.mealNow)()) return 'eat';
    if((R.host==='dormN'||R.host==='dormS')&&hit.ch==='b') return 'sleep';
    if(R.host==='lab'&&hit.ch==='p') return 'piano';
    if(R.host==='lab'&&hit.ch==='n') return 'pc';
    if(R.host==='teach'&&hit.ch==='w') return 'wash';
    return null;
  }
  if($imports.S.mode==='out'){
    var mx=$imports.S.x/$imports.SC, my=$imports.S.y/$imports.SC, i, o;
    for(i=0;i<$imports.OBJ.length;i++){
      o=$imports.OBJ[i];
      if(!(mx>o.x&&mx<o.x+o.w&&my>o.y&&my<o.y+o.h)) continue;
      if(o.k==='field') return 'run';
      if(o.k==='court') return 'shoot';
      if(o.k==='track') return 'run';
      if(o.k==='garden') return 'view';
    }
  }
  return null;
}
function doSanAct(key){
  var a=SAN_ACTS[key]; if(!a) return;
  if($imports.DayEvents.closed(key)){ (0,$imports.os)($imports.DayEvents.closedMsg(key),3.6); return; }   /* 占课：琴房、机房当天不开 */
  $imports.S.actCool=$imports.S.actCool||{};
  var clockNow=(0,$imports.gameClock)();
  if($imports.S.actCool[key]&&clockNow<$imports.S.actCool[key]){
    (0,$imports.os)('我：刚做过。现在没那个心情。',2.4); return;
  }
  if(GameModules.first('restAct',key)===true) return;       /* 模块可以接管这一次休息（睡不着、做梦）；不接管就照常结算 */
  var _before=$imports.S.tsec;
  (0,$imports.advanceGameTime)(a.min);
  var base=key==='eat'?$imports.Talent.modifier('activity.eat'):a.san;   /* 铁胃（规则 2）：正常吃饭多回一点 */
  var gain=$imports.CampusPressure.restGain(base);  /* 按休息结束时的压力结算，跨夜休息不能绕过衰减。 */
  $imports.PlayerStats.changeSan(gain,'interact',{max:100});
  $imports.S.actCool[key]=(0,$imports.gameClock)()+a.cd;
  (0,$imports.gameFact)('rest',{key:key});
  (0,$imports.restoreStamina)(25);
  if(key==='piano'){ try{ $imports.SFX.resume(); $imports.SFX.moonlight(); }catch(e){} }
  else if(key==='pc'){ try{ $imports.PCGAME.start(); }catch(e){} }
  if(a.min>=4){
    try{ timeSkipCard(a.min, a.n, $imports.S.tsec); }catch(e){}
  }
  (0,$imports.os)(a.msg,3.6);
  (0,$imports.toast)(a.n+' · 休息结束');
  try{ $imports.SFX.click(); }catch(e){}
}
var SKIP_T=null;
function timeSkipCard(mins,actName,tsec){
  var el=document.getElementById('skip');
  if(!el) return;
  var b=el.querySelector?el.querySelector('b'):null;
  var i=el.querySelector?el.querySelector('i'):null;
  var em=el.querySelector?el.querySelector('em'):null;
  if(b) b.textContent='…'+mins+' 分钟过去了';
  if(i) i.textContent=(0,$imports.hasClock)()?(0,$imports.fmtClock)(tsec):(0,$imports.periodAt)(tsec)[2];
  if(em) em.textContent=actName||'';
  el.classList.add('on');
  if(SKIP_T) clearTimeout(SKIP_T);
  var skipScope=$imports.Lifecycle.renew('time-skip');
  skipScope.own(function(){el.classList.remove('on');});
  SKIP_T=skipScope.timeout(function(){
    if(el) el.classList.remove('on');
  }, 760);
}
function nearRoster(){ return $imports.AN.active&&$imports.AN.id==='roster'&&$imports.AN.data&&!$imports.AN.data.done&&$imports.AN.data.rx!==undefined&&(0,$imports.dist2)($imports.S.x,$imports.S.y,$imports.AN.data.rx,$imports.AN.data.ry)<80*80; }
/* 被划掉的名单：以前没有任何办法"处理"它，16 秒后必扣 30 违规 */
function useRoster(timeoutMs){
  var d=$imports.AN.data;
  if((0,$imports.hasItem)('pen')||(0,$imports.hasItem)('chalk')){
    d.done=true;
    $imports.PlayerStats.changeSan(6,'interact',{max:100});
    (0,$imports.os)('我：我在那道红线旁边，把自己的名字一笔一画重新写了一遍。写完以后，红线淡了。',4.4);
    (0,$imports.addClue)('roster');
    return;
  }
  $imports.UI.choice('名单上，我的名字被一道红线划掉了。手边没有笔。',[
    {label:'把它撕下来',fn:function(){ $imports.UI.closeChoice(); d.done=true; (0,$imports.addViolation)(8); $imports.PlayerStats.changeSan(-(5),'interact',{min:0});
      (0,$imports.os)('我：纸撕下来的时候，下面还贴着一张。一模一样，连那道红线都是新的。……至少我把它撕了。',4.6); }},
    {label:'用指甲把名字刻回去',fn:function(){ $imports.UI.closeChoice(); d.done=true; $imports.PlayerStats.changeSan(-(10),'interact',{min:0});
      (0,$imports.os)('我：指甲劈了。名字刻上去了，歪歪扭扭的，渗着一点红。',4.0); }},
    {label:'不管它',fn:function(){ $imports.UI.closeChoice(); }}
  ],{timeoutMs:Number.isFinite(timeoutMs)?Math.max(1,timeoutMs):5000});
}
/* 准星下面那行「E 做什么」。判断顺序和下面的 tryInteract 一致：改了其中一个，另一个要对照着改。 */
function canteenHint(h,R){ return (R.host==='canteen'&&!(0,$imports.mealNow)())?((0,$imports.hasItem)('coin')?'投币买饭':'打饭窗口'):'翻找'; }
var TILE_HINT={
  '=':function(h,R){ var need=(0,$imports.doorLockNeed)(R,h.c,h.r); return (need&&!(0,$imports.hasItem)(need))?'开门（锁着）':$imports.OPENDOORS[(0,$imports.doorKeyAt)(R,h.c,h.r)]?'关门':'开门'; },
  O:'出去', H:'躲进柜子',
  M:function(){
    var j=$imports.Investigation.state(),sup=j.supply;
    if(j.entries.notice&&sup&&sup.site===$imports.S.room&&!sup.taken) return '看补给箱 / 售货机';   /* 只有补给箱真在这儿才这么写 */
    return (0,$imports.hasItem)('coin')?'投币（售货机）':'售货机';
  },
  k:function(h,R){ return R.host==='guard'?'查看值班台':canteenHint(h,R); }, t:canteenHint,
  L:'走连廊', Q:'看服务器终端', S:'沿楼梯行走', J:function(){return $imports.S.room==='lift_dream'?'走向门':'电梯';}, j:'打开门', u:'翻看日记', P:'坐下', c:'上车', V:function(h){return $imports.Investigation.carHint(h);},
  T:function(h,R){
    if($imports.Investigation.isPodium(R,h.c,h.r)) return $imports.Investigation.visible('notice')?'再看移交单':'看移交单';
    return $imports.S.room==='teach1'?'拿粉笔':'看讲台';
  },
  D:function(){ return ($imports.S.room==='lab3')?'门禁管理终端':'使用终端'; },
  X:'钻进去',
  K:function(h,R){ return (R&&R.host==='admin')?'看办公桌':'看实验台'; },
  Z:'放开单摆', C:'开离心机', N:'看显微镜', Y:'转地球仪', p:'弹琴', U:'撞钟', A:'看供桌', x:'看挂图',
  B:'隔间', G:'隔间', w:'洗把脸',
  b:function(h,R){ return sanActFor(R,h)?'躺一会儿':'床'; },
  n:'用电脑'
};
var GATE_HINT=[[$imports.GATE_N,'校门'],[$imports.GATE_W,'西小门'],[$imports.GATE_S,'南门']];
var InteractionQuery={pick:function(){return nearWorld(24);}};
function interactHint(){
  if($imports.S.dead||$imports.S.screen!=='play'||$imports.UI.anyOpen()||$imports.PAUSE.on) return '';
  var R=$imports.S.mode==='in'?$imports.INTERIORS[$imports.S.room]:null, h=R?nearWorld(24):null;
  var first=h&&(FAC_CD[h.ch]!==undefined||sanActFor(R,h));   /* 设施、恢复 SAN 的动作排在"坐下"前面 */
  if($imports.HIDE.on) return '出来';
  if((0,$imports.bellReach)()) return '撞钟';
  if(nearRoster()) return '那张名单';
  if($imports.S.seated) return '站起来';
  var _mh=GameModules.first('hint'); if(_mh) return String(_mh);
  if(h&&h.ch==='P')return $imports.S.room===$imports.ClassroomLayout.ownSeat.room&&h.c===$imports.MY_COL&&h.r===$imports.MY_ROW?'坐到自己的座位':'坐下（非本人座位）';
  if($imports.S.mode==='in'){
    if(!h) return '';
    var recovery=sanActFor(R,h);if(recovery)return SAN_ACTS[recovery].n+'（'+SAN_ACTS[recovery].min+' 分钟）';
    var th=TILE_HINT[h.ch];
    if(th===undefined) return '翻找';
    return (typeof th==='function')?th(h,R):th;
  }
  var nb=nearWorld(0), act=nb?null:sanActFor(null,null), i;
  if(nb) return nb.obj.id==='garw'?'沿楼梯下到车库':'进入 '+nb.obj.n;
  if(act) return SAN_ACTS[act].n+'（'+SAN_ACTS[act].min+' 分钟）';
  for(i=0;i<GATE_HINT.length;i++){
    var g=GATE_HINT[i][0];
    if(Math.sqrt((0,$imports.dist2)(g.x*$imports.SC,g.y*$imports.SC,$imports.S.x,$imports.S.y))<70) return GATE_HINT[i][1];
  }
  return '';
}
function tryInteract(){
  if($imports.S.screen!=='play'||$imports.S.dead||$imports.PAUSE.on||$imports.UI.anyOpen()) return;
  if(typeof $imports.CarChase!=='undefined'&&$imports.CarChase.active())return;
  if($imports.S.seated){ (0,$imports.leaveSeat)(); (0,$imports.os)('我站了起来。',1.6); $imports.S.enterCool=0.4; return; }
  if($imports.HIDE.on){ (0,$imports.hideOut)(); return; }
  if(nearRoster()){ useRoster(); return; }
  if(GameModules.first('interact')) return;          /* 模块的交互（虚空迷宫的出口、地上的粉笔）先于默认 */

  if($imports.S.mode==='out'){
    var nb=nearWorld(0);
    if(nb){
      var id=nb.obj.id;
      if(id==='garw'){(0,$imports.os)('我：入口就在前面，沿台阶走下去。',2);return;}
      var map={teach:'teach1',admin:'admin1',lab:'lab1',canteen:'canteen1',
        dormN:'dorm1',dormS:'dorm4',garage:'garage1',garw:'garage1',trash:'trash1',
        guard:'guard1',gear:'gear1',bell:'bell1'};

      if(map[id]){ $imports.ENTER_VIA='out'; try{ $imports.SFX.door(); }catch(e){} (0,$imports.enterRoom)(map[id]); return; }
      return;
    }
    var act=sanActFor(null,null);
    if(act){ doSanAct(act); return; }
    var gn=Math.sqrt((0,$imports.dist2)($imports.GATE_N.x*$imports.SC,$imports.GATE_N.y*$imports.SC,$imports.S.x,$imports.S.y));
    if(gn<70){ (0,$imports.os)('我：北门的闸机屏幕上显示：「查无此人」。门外的路上没有车，也没有声音，一直延伸到雾里。',4.2); (0,$imports.addClue)('gaten'); return; }
    var gw=Math.sqrt((0,$imports.dist2)($imports.GATE_W.x*$imports.SC,$imports.GATE_W.y*$imports.SC,$imports.S.x,$imports.S.y));
    if(gw<70){ tryGateWest(); return; }
    var gs=Math.sqrt((0,$imports.dist2)($imports.GATE_S.x*$imports.SC,$imports.GATE_S.y*$imports.SC,$imports.S.x,$imports.S.y));
    if(gs<70){ (0,$imports.os)('我：南门锁着，锁上全是锈。门缝外面——是另一个南门。',3.4); return; }
    (0,$imports.os)((0,$imports.pick)(['我：这里摸不到什么。','我：……什么都没有。可我总觉得刚刚有东西在这儿。','我：地上很凉。']),1.8);
    return;
  }

  var R=$imports.INTERIORS[$imports.S.room];
  if((0,$imports.bellReach)()){ useBell(); return; }
  var _sa=sanActFor(R,null), _hit0=nearWorld(24);
  if(_hit0&&FAC_CD[_hit0.ch]!==undefined){ if(useFacility(_hit0.ch,R)) return; }
  if(_hit0){ var _k=sanActFor(R,_hit0); if(_k){ doSanAct(_k); return; } }
  if(_hit0&&_hit0.ch==='P'){ sitDown(_hit0); return; }
  var hit=nearWorld(24);
  if(!hit){ (0,$imports.os)('我：这里什么都没有。',1.8); return; }
  var ch=hit.ch;
  if(ch==='='){
    var _need=(0,$imports.doorLockNeed)(R,hit.c,hit.r);
    if(_need&&!(0,$imports.hasItem)(_need)){
      (0,$imports.os)('我：门锁着。锁孔是圆的，很新。',2.8);
      (0,$imports.toast)('需要「'+$imports.ITEMS[_need].n+'」· 校长办公室可能有');
      (0,$imports.addClue)('roomkey');
      return;
    }
    if(!$imports.OPENDOORS[(0,$imports.doorKeyAt)(R,hit.c,hit.r)]){
      $imports.OPENDOORS[(0,$imports.doorKeyAt)(R,hit.c,hit.r)]=1;
      $imports.SFX.door(); (0,$imports.os)((0,$imports.pick)(['我：门开了。','我：门开了。合页的声音拖得很长。','我：门开了。里面比外面冷。']),1.8); $imports.S.enterCool=0.35;
      (0,$imports.roomDoorRefresh)(R,hit.c,hit.r);                   /* 只重建这一扇门（以前整层楼重建，同学还会重新随机坐） */
      GameModules.emit('doorAction',{room:R.id,c:hit.c,r:hit.r,x:hit.x,y:hit.y,open:true});
    }else{
      if(Math.abs($imports.S.x-hit.x)<R.tw/2+$imports.PRAD&&Math.abs($imports.S.y-hit.y)<R.th/2+$imports.PRAD){(0,$imports.os)('我：先让开门口。',1.4);return;}
      delete $imports.OPENDOORS[(0,$imports.doorKeyAt)(R,hit.c,hit.r)];$imports.SFX.door();(0,$imports.roomDoorRefresh)(R,hit.c,hit.r);
      GameModules.emit('doorAction',{room:R.id,c:hit.c,r:hit.r,x:hit.x,y:hit.y,open:false});
    }
    return;
  }
  if(ch==='O'){
    if(R.floor>1){ (0,$imports.os)('我：这是'+R.floor+'楼。这边的窗子封死了。',3.0); return; }
    (0,$imports.exitRoom)(); return;
  }
  if(ch==='S'){ stairGo(); return; }
  if(ch==='J'){ $imports.Elevator.interact(); return; }
  if(ch==='j'){ $imports.PortalExploration.leave(hit); return; }
  if(ch==='u'){ $imports.PortalExploration.readDiary(); return; }
  if(ch==='H'){ (0,$imports.hideIn)(hit); return; }
  if(ch==='L'){ useLink(R,hit.c,hit.r); return; }
  if(ch==='Q'){
    (0,$imports.addClue)('server');
    if(!$imports.RT.coilTaken){                       /* 传送门材料：铜线圈 */
      if((0,$imports.addItem)('coil')){
        $imports.RT.coilTaken=1;
        (0,$imports.os)('我：服务器在响，像很多人一起压着嗓子呼气。机柜背板松了，里面一卷铜线圈烫得发红——我把它抽了出来，机柜一下子安静了。',5.2);
      }
      return;
    }
    (0,$imports.os)('我：服务器在响，像很多人一起压着嗓子呼气。屏幕上滚着门禁记录——每一行的时间都是 11:40。',4.6);
    return;
  }
  if(ch==='q'){ searchContainer(hit.c,hit.r); return; }
  if(ch==='x'){ useGeoMap(); return; }
  if(ch==='U'){ useBell(); return; }
  if(ch==='A'){ useAltar(); return; }
  if(ch==='P'){ sitDown(); return; }
  if(ch==='d'||ch==='f'||ch==='R'){ searchContainer(hit.c,hit.r); return; }
  if(ch==='T'){
    if($imports.Investigation.isPodium(R,hit.c,hit.r)) $imports.Investigation.notice();          /* 自己教室的讲台：压着移交单 */
    else if($imports.S.room==='teach1'){
      if((0,$imports.hasItem)('chalk')) (0,$imports.os)('我：讲台上有一支粉笔，我已经带了一支。',2.8);
      else if((0,$imports.addItem)('chalk')) (0,$imports.os)('我：讲台上有一支粉笔。',2.8);
    }
    else (0,$imports.os)('我：讲台是空的。',2.2);
    return;
  }
  if(ch==='c'){ (0,$imports.useCar)(hit.c,hit.r); return; }
  if(ch==='V'){ $imports.Investigation.inspectCar(hit.c,hit.r); return; }
  if(ch==='D'){
    if($imports.S.room==='admin3') useData(); else useTerminal();
    return;
  }
  if(ch==='X'){ useTrash(); return; }
  if(ch==='p'){
    if($imports.S.tsec<$imports.EVENING) (0,$imports.os)('我：现在弹琴，走廊里的人都听得见。',3.0);
    $imports.SFX.moonlight();
    (0,$imports.os)('我：是《月光》。第一乐章。可是钢琴没有人在弹。',5.5);
    return;
  }
  if(ch==='b'){ (0,$imports.os)('我：床。可是现在不能睡。',2.4); return; }
  if(ch==='k'&&R.host==='guard'){
    guardSupplies();
    if($imports.Investigation.state().entries.notice)$imports.Investigation.supplyOffer(function(){});
    return;
  }
  if(R.host==='canteen'&&(ch==='t'||ch==='k')){ (0,$imports.canteenWindow)(); return; }
  if(ch==='M'){if($imports.Investigation.state().entries.notice)$imports.Investigation.supplyOffer($imports.useVending);else (0,$imports.useVending)();return;}
  if(ch==='t'||ch==='k'){ (0,$imports.os)('我：没有能吃的。',2.0); return; }
  if(ch==='B'||ch==='G'){ (0,$imports.useStall)(); return; }
  if(ch==='w'){ $imports.PlayerStats.changeSan(4,'interact',{max:100}); (0,$imports.os)('我：洗了把脸。',2.2); return; }
  (0,$imports.os)('我：用不上。',1.8);
}
function guardSupplies(){
    /* 钥匙以前就挂在这儿，太容易了；现在收到了校长办公室 */
    if(!$imports.RT.guardKeysTold){
      $imports.RT.guardKeysTold=1; (0,$imports.addClue)('keys'); $imports.Investigation.parking(true);
      var light=(0,$imports.hasItem)('torch')||(0,$imports.addItem)('torch');
      (0,$imports.os)('我：钥匙已上交行政楼五楼校长办公室。停车记录和避险便签记在手册里了。'+(light?'抽屉里的手电带好了，去车库前记得打开。':'手电还在抽屉里，装不下了，腾出一格再来拿。'),6,$imports.OS_KEEP);
      (0,$imports.autoSave)();
      return;
    }
    if(!(0,$imports.hasItem)('torch')){
      $imports.Investigation.parking(true);
      if((0,$imports.addItem)('torch')) (0,$imports.os)('我：柜台下面还有一把手电筒。去车库之前，把它带上。',4.2);
      return;
    }
    $imports.Investigation.parking();return;          /* 再来一次：重读登记（记忆按笔记本规则刷新） */
}

/* 地理实验室的挂图：每张会圈出一个你还没去过的地方 */
function useGeoMap(){
  $imports.RT.geoMaps=$imports.RT.geoMaps||0;
  var left=[], i;
  for(i=0;i<$imports.SPOTS.length;i++) if(!$imports.S.spots[$imports.SPOTS[i].id]) left.push($imports.SPOTS[i]);
  if(!left.length||$imports.RT.geoMaps>=4){ (0,$imports.os)('我：挂图上的路我都走过了。有一条是我没见过的——它通到围墙外面，然后被撕掉了。',4.2); return; }
  var sp=left[Math.floor($imports.GameRandom.next()*left.length)];
  $imports.RT.geoMaps++;
  $imports.S.spots[sp.id]=1; $imports.UI.spotsDirty=true;
  (0,$imports.os)('我：挂图是很多年前的校园平面图。有一处被红笔圈了好几圈，旁边写着「'+sp.n+'」。',4.6);
  (0,$imports.toast)('记下了：'+sp.n);
}
function useBell(){
  if($imports.AN.active&&$imports.AN.id==='bell13'){
    (0,$imports.os)('我：我抱住撞木，用力撞了一下。钟声和那第十三下撞在一起——两边都没了。',4.6);
    $imports.PlayerStats.changeSan(8,'interact',{max:100});
    try{ $imports.SFX.bigBell&&$imports.SFX.bigBell(); }catch(e){}
    (0,$imports.anEnd)(); return;
  }
  (0,$imports.addClue)('bell');
  if($imports.S.exam){ try{ $imports.SFX.bigBell&&$imports.SFX.bigBell(0.3); }catch(e){} (0,$imports.os)('我：钟还在嗡嗡地响。今天剩下的课，都是考试了。',3.4); return; }
  /* 钟楼顶上撞响这口钟：当天剩下的课全部改成考试（examStart 在 systems.js） */
  try{ $imports.SFX.bigBell&&$imports.SFX.bigBell(1); }catch(e){}
  (0,$imports.examStart)();
}
function useAltar(){
  (0,$imports.addClue)('altar');
  if(!$imports.RT.altarCoin){
    if((0,$imports.hasItem)('coin')){ (0,$imports.os)('我：香炉底下压着一枚硬币。我已经带了一枚。',3.6); return; }
    if(!(0,$imports.addItem)('coin')) return;
    $imports.RT.altarCoin=1;
    (0,$imports.os)('我：供桌上的饭还冒着气，筷子竖插在正中。照片上那张脸被剪掉了，校服是我们学校的。香炉底下压着一枚硬币。',5.6);
    return;
  }
  $imports.PlayerStats.changeSan(-(2),'interact',{min:0});
  (0,$imports.os)('我：照片里那个人的手，好像比刚才抬高了一点。',3.2);
}
function hit2_seatNear(R){var h=InteractionQuery.pick();return !!(R&&h&&h.ch==='P');}
function sitDown(hit){
  var R=$imports.INTERIORS[$imports.S.room],h=hit||InteractionQuery.pick();
  if(!R||!h||h.ch!=='P'||!tileVisible(R,h))return false;
  var seat=$imports.ClassroomLayout.seat(R.id,h.c,h.r),p=$imports.ClassroomLayout.anchor(R,seat);
  $imports.S.x=p.x;$imports.S.y=p.y;$imports.S.ang=p.ang;$imports.S.seated=true;$imports.S.seat=seat;$imports.S.enterCool=.5;
  $imports.VisualState.camera.eyeH=$imports.EYE;
  (0,$imports.os)(seat.seatId===$imports.ClassroomLayout.ownSeat.seatId?'我坐下了。这是我自己的位子。':'我坐下了。这个位子不是我的。',2.4);$imports.SFX.click();return true;
}
function spawnAtTile(id,r2,c2){
  var R=$imports.INTERIORS[id];
  return {x:R.ox+(c2+0.5)*R.tw, y:R.oy+(r2+0.5)*R.th};
}
function useLink(R,c,r){
  var id=R.id, host=R.host, f=R.floor;
  if(R.host==='c1'||R.host==='c2'){
    var to=linksOf(R.host);
    var dest=(r<=Math.floor(R.rows/2))?to.north:to.south;
    if(!dest){ (0,$imports.os)('我：那头封着。',2.0); return; }
    var DR=$imports.INTERIORS[dest.id];
    var sp=DR?{x:DR.ox+(dest.c+0.5)*DR.tw, y:DR.oy+(dest.r+0.5)*DR.th}:null;
    $imports.SFX.door();
    (0,$imports.enterRoom)(dest.id, sp);
    return;
  }
  if(f!==2){ (0,$imports.os)('我：连廊在二楼。',2.2); return; }
  var tgt=null;
  if(host==='admin') tgt={id:'link1', end:'north'};
  else if(host==='lab') tgt=(c>=R.cols*0.5)?{id:'link1', end:'south'}:{id:'link2', end:'north'};
  else if(host==='teach') tgt={id:'link2', end:'south'};
  if(!tgt){ (0,$imports.os)('我：这层没有连廊。',2.0); return; }
  var LR=$imports.INTERIORS[tgt.id];
  var sl=(tgt.end==='north')?1:LR.rows-2;
  $imports.SFX.door();
  (0,$imports.enterRoom)(tgt.id, spawnAtTile(tgt.id, sl, 2));
}
function linksOf(host){
  if(host==='c1'){
    var A=$imports.INTERIORS['admin2'], L=$imports.INTERIORS['lab2'];
    return {
      north:{id:'admin2', c:A?A.cols-3:0, r:18},
      south:{id:'lab2',  c:L?L.cols-3:0, r:16}
    };
  }
  var L2=$imports.INTERIORS['lab2'], T=$imports.INTERIORS['teach2'];
  return {
    north:{id:'lab2',  c:2, r:16},
    south:{id:'teach2',c:2, r:18}
  };
}
/* 楼梯：能上能下。以前行政楼 / 实验楼只能往上（顶层原地不动），南宿舍的楼梯直接把人送出楼外 */
function floorIdOf(host,f){
  if(host==='teach') return 'teach'+f;
  if(host==='admin') return 'admin'+f;
  if(host==='lab') return 'lab'+f;
  if(host==='dormN') return 'dorm'+f;
  if(host==='dormS') return 'dorm'+(f+3);
  return null;
}
function topFloorOf(host){ return host==='teach'?6:(host==='admin'||host==='lab')?5:(host==='dormN'||host==='dormS')?3:1; }
function stairGo(){
  if($imports.STAIR_LAYOUT.some(function(s){return s.rooms.includes($imports.S.room);})||$imports.StairWorld.here()){(0,$imports.os)('沿台阶走到下一层，门外就是走廊。',2);return;}

  var R=$imports.INTERIORS[$imports.S.room];
  if(!R){ (0,$imports.exitRoom)(); return; }
  var f=R.floor, host=R.host, top=topFloorOf(host);
  if(top<=1){ (0,$imports.exitRoom)(); return; }
  var up=(f<top)?floorIdOf(host,f+1):null, dn=(f>1)?floorIdOf(host,f-1):null;
  function upLabel(){ return (host==='teach'&&f+1===6)?'上天台':'上楼（'+(f+1)+'F）'; }
  if(up&&dn){
    $imports.UI.choice('楼梯间里很安静。扶手是凉的。',[
      {label:upLabel(),fn:function(){ $imports.UI.closeChoice(); $imports.SFX.stairs&&$imports.SFX.stairs(); $imports.ENTER_VIA='stair'; (0,$imports.enterRoom)(up); }},
      {label:'下楼（'+(f-1)+'F）',fn:function(){ $imports.UI.closeChoice(); $imports.SFX.stairs&&$imports.SFX.stairs(); $imports.ENTER_VIA='stair'; (0,$imports.enterRoom)(dn); }},
      {label:'算了',fn:function(){ $imports.UI.closeChoice(); }}
    ]);
    return;
  }
  try{ $imports.SFX.stairs&&$imports.SFX.stairs(); }catch(e){}
  if(up){ $imports.ENTER_VIA='stair'; (0,$imports.enterRoom)(up); return; }
  if(dn){ $imports.ENTER_VIA='stair'; (0,$imports.enterRoom)(dn); return; }
  (0,$imports.exitRoom)();
}
/* 实验楼各层抽屉里的东西（累计概率） */
var LAB_LOOT={
  1:[[0.22,'battery'],[0.40,'chalk'],[0.52,'pen']],
  2:[[0.20,'goggles'],[0.40,'pill'],[0.58,'battery']],
  3:[[0.20,'usb'],[0.40,'battery'],[0.52,'phone']],
  4:[[0.22,'compass'],[0.36,'map']],
  5:[[0.22,'metronome'],[0.36,'snack']]
};
function labLoot(floor){
  var r=$imports.GameRandom.next(), t=LAB_LOOT[floor];
  return t?rollLoot(t,r):null;
}
/* 翻找要花 0.8 秒：站着别动，准星外面那一圈走满才算翻完；走开就断了。DEV 里可以关掉 */
var SEARCH={on:true,dur:0.8,job:null};
function clearSearch(){
  SEARCH.job=null;
  var el=document.getElementById('searchring'); if(el) el.style.display='none';
}
function searchContainer(c,r){
  var key=$imports.S.room+':'+c+':'+r;
  if((0,$imports.ncOccupied)(c,r)){
    (0,$imports.os)('我：他坐在这儿。我不能翻他的抽屉。',3.0);
    return;
  }
  if($imports.RT.deskUsed[key]){ (0,$imports.os)('我：翻过了。',1.6); return; }
  if(SEARCH.on){
    if(!SEARCH.job){ SEARCH.job={c:c,r:r,room:$imports.S.room,x:$imports.S.x,y:$imports.S.y,t:0}; try{ $imports.SFX.click(); }catch(e){} }
    return;
  }
  doSearch(c,r);
}
function searchTick(dt){
  var j=SEARCH.job, el=document.getElementById('searchring');
  if(j&&($imports.S.dead||$imports.S.mode!=='in'||$imports.S.room!==j.room||Math.hypot($imports.S.x-j.x,$imports.S.y-j.y)>5)){
    SEARCH.job=null; (0,$imports.os)(j.done?'我：手一松，钥匙从锁孔里滑了出来。':'我：手一松，没翻完。',1.4); j=null;
  }
  if(el){ el.style.display=j?'block':'none'; if(j) el.style.setProperty('--p',Math.min(1,j.t/(j.dur||SEARCH.dur))); }
  if(!j) return;
  j.t+=dt;
  if(j.t>=(j.dur||SEARCH.dur)){ SEARCH.job=null; if(el) el.style.display='none'; if(j.done) j.done(); else doSearch(j.c,j.r); }
}
/* 别的"站着别动、等读条走满"的操作（比如在车库里一辆辆试钥匙）也用这一圈 */
function holdJob(dur,done){
  if(SEARCH.job) return false;
  SEARCH.job={room:$imports.S.room,x:$imports.S.x,y:$imports.S.y,t:0,dur:dur,done:done};
  return true;
}
/* 重复物品先留在原容器，保存首次抽到的结果，不能通过重试来重抽。 */
function searchLoot(key,id){
  if((0,$imports.hasItem)(id)){
    if(!$imports.RT.pendingLoot) $imports.RT.pendingLoot={};
    $imports.RT.pendingLoot[key]=id;
    delete $imports.RT.deskUsed[key];
    (0,$imports.os)('我：这里有「'+$imports.ITEMS[id].n+'」。我已经带着一份，先把它留在这里。',3.2);
    return;
  }
  if((0,$imports.addItem)(id)){
    $imports.RT.deskUsed[key]=1;
    if($imports.RT.pendingLoot) delete $imports.RT.pendingLoot[key];
  }
}
/* 普通抽屉、柜子、货架翻出来的东西：累计概率，没落在表里就是空的 */
var DESK_LOOT=[[0.16,'coin'],[0.28,'chalk'],[0.36,'snack'],[0.44,'battery'],[0.50,'pill'],[0.56,'pen'],[0.62,'notebook'],
  [0.66,'memo'],[0.70,'brolly'],[0.74,'coat'],[0.78,'torch'],[0.82,'phone'],[0.86,'watch'],[0.90,'compass'],[0.93,'leave']];
function rollLoot(table,roll){
  for(var i=0;i<table.length;i++) if(roll<table[i][0]) return table[i][1];
  return null;
}
function doSearch(c,r){
  var key=$imports.S.room+':'+c+':'+r;
  if($imports.RT.deskUsed[key]) return;
  /* 满包不能占用容器，否则钥匙或固定的 U 盘会消失。 */
  if($imports.S.bag.length>=8){ (0,$imports.os)('我：装不下了。先腾出一个空位再翻。',2.4); return; }
  if($imports.RT.pendingLoot&&$imports.RT.pendingLoot[key]){ searchLoot(key,$imports.RT.pendingLoot[key]); return; }
  $imports.RT.deskUsed[key]=1;
  var _R=$imports.INTERIORS[$imports.S.room];
  /* 车钥匙和机房钥匙：校长办公室的容器 45%，别的老师办公室 1%（以前直接挂在保安岗） */
  if(_R&&_R.host==='admin'){
    var miss=['key','roomkey'].filter(function(k){ return !(0,$imports.hasItem)(k); });
    var pity=_R.principal&&($imports.RT.keyMiss||0)>=3;              /* 保底：连着三次没翻到，这一次一定有 */
    if(miss.length&&(pity||$imports.GameRandom.next()<(_R.principal?0.45:0.01))){
      $imports.RT.keyMiss=0;
      var kk=miss[Math.floor($imports.GameRandom.next()*miss.length)];
      (0,$imports.os)(kk==='key'?'我：抽屉最里面压着一串车钥匙，牌号刻在环上。':'我：抽屉里有一把铜钥匙，塑料标签上写着「机房」。',3.6);
      (0,$imports.addItem)(kk); return;
    }
    if(miss.length&&_R.principal) $imports.RT.keyMiss=($imports.RT.keyMiss||0)+1;
    if(_R.principal){
      var pr=$imports.GameRandom.next();
      if(pr<0.12&&!(0,$imports.hasItem)('atlas')){ (0,$imports.os)('我：抽屉里卷着一大张图纸，是整个学校每一层的平面图。',3.4); (0,$imports.addItem)('atlas'); return; }
      if(pr<0.18&&!(0,$imports.hasItem)('elixir')){ (0,$imports.os)('我：一个空药盒里只剩一粒药丸，盒子上的字被刮掉了。',3.4); (0,$imports.addItem)('elixir'); return; }
    }
  }
  if($imports.S.room==='lab3'&&_R&&_R.grid[r]&&_R.grid[r][c]==='R'&&!(0,$imports.hasItem)('usb')){
    (0,$imports.os)('我：货架最上层有个文件盒，里面躺着一个 U 盘。标签上写着「门禁」。',3.6);
    (0,$imports.addItem)('usb'); return;
  }
  if(_R&&_R.host==='lab'){
    var lv=labLoot(_R.floor);
    if(lv) searchLoot(key,lv); else (0,$imports.os)('我：空的。抽屉里只有一层灰。',2.0);
    return;
  }
  var give=rollLoot(DESK_LOOT,$imports.GameRandom.next());
  if($imports.S.room==='teach1'&&!$imports.RT.hwTaken&&r>1&&r<14){
    $imports.RT.hwTaken=true; give='hw';
  }
  if(give) searchLoot(key,give);
  else (0,$imports.os)((0,$imports.pick)(['我：空的。只有一层灰。','我：空的。抽屉底下用圆珠笔写着一个名字，被涂黑了。','我：空的。最里面有一小撮头发。']),2.4);
}
function useTerminal(){
  if($imports.S.room!=='lab3'){ (0,$imports.os)('我：这台终端连不上。',2.2); return; }
  if($imports.RT.hacked){ (0,$imports.os)('我：白名单里已经有我那一行了。光标还在闪，像在等我再写点什么。',3.2); return; }
  /* 以前只有随机到「编程社」天赋才走得通；现在网络中心货架上的 U 盘也能做到 */
  var cap=$imports.Talent.capability('terminal');
  if(!cap.ok){
    (0,$imports.os)('我：屏幕上是一串我看不懂的东西。旁边贴着一张便签：「门禁 U 盘插这里」。',4.0);
    (0,$imports.addClue)('usb');
    return;
  }
  $imports.RT.hacked=true;
  (0,$imports.addClue)('comp');
  $imports.Investigation.record('whitelistWritten','网络中心已经写入我的学号。后台记录里，同一个名字对应着不同时期的照片。下一步要到行政楼三楼同步数据。','验证','实验楼三楼 · 网络中心');
  if(cap.via==='talent') (0,$imports.os)('我：我打开门禁后台，在白名单最后加了一行——我自己的学号。回车的时候，整排机柜同时闪了一下。',5,$imports.OS_KEEP);
  else (0,$imports.os)('我：U 盘插进去，屏幕自己跳出一个窗口，光标在最后一行闪。我输了自己的学号。机柜同时闪了一下。',5,$imports.OS_KEEP);
  os2later('我：还得去行政楼三楼，把数据同步过去。',5200);
}
function os2later(msg,ms){ $imports.Lifecycle.scope('session').timeout(function(){ if(!$imports.S.dead&&$imports.S.screen==='play') (0,$imports.os)(msg,3.6,$imports.OS_KEEP); },ms); }
function useTrash(){
  if($imports.S.room!=='trash1'){ (0,$imports.os)('我：这个桶太小了。',2.2); return; }
  (0,$imports.tryTrashRoute)();
}
function useData(){
  if($imports.S.room!=='admin3'){ (0,$imports.os)('我：这台机器不归我管。',2.2); return; }
  $imports.WhitelistSync.commit('terminal');
}
function tryGateWest(){
  if(!$imports.RT.hacked||!$imports.RT.data){ (0,$imports.os)('我：小门上挂着锁，旁边那台闸机的屏幕亮着：「未登记」。',3.0); (0,$imports.addClue)('gatew'); return; }
  $imports.FaceChallenge.open();
}

/* @module-exports */
GameModules.publish("game3d/js/interact.js",{
"tileLOS":{get:function(){return tileLOS;},set:function($value){tileLOS=$value;}},
"tileVisible":{get:function(){return tileVisible;},set:function($value){tileVisible=$value;}},
"nearWorld":{get:function(){return nearWorld;},set:function($value){nearWorld=$value;}},
"SAN_ACTS":{get:function(){return SAN_ACTS;},set:function($value){SAN_ACTS=$value;}},
"FAC_CD":{get:function(){return FAC_CD;},set:function($value){FAC_CD=$value;}},
"facClock":{get:function(){return facClock;},set:function($value){facClock=$value;}},
"facRoll":{get:function(){return facRoll;},set:function($value){facRoll=$value;}},
"useFacility":{get:function(){return useFacility;},set:function($value){useFacility=$value;}},
"sanActFor":{get:function(){return sanActFor;},set:function($value){sanActFor=$value;}},
"doSanAct":{get:function(){return doSanAct;},set:function($value){doSanAct=$value;}},
"SKIP_T":{get:function(){return SKIP_T;},set:function($value){SKIP_T=$value;}},
"timeSkipCard":{get:function(){return timeSkipCard;},set:function($value){timeSkipCard=$value;}},
"nearRoster":{get:function(){return nearRoster;},set:function($value){nearRoster=$value;}},
"useRoster":{get:function(){return useRoster;},set:function($value){useRoster=$value;}},
"canteenHint":{get:function(){return canteenHint;},set:function($value){canteenHint=$value;}},
"TILE_HINT":{get:function(){return TILE_HINT;},set:function($value){TILE_HINT=$value;}},
"GATE_HINT":{get:function(){return GATE_HINT;},set:function($value){GATE_HINT=$value;}},
"InteractionQuery":{get:function(){return InteractionQuery;},set:function($value){InteractionQuery=$value;}},
"interactHint":{get:function(){return interactHint;},set:function($value){interactHint=$value;}},
"tryInteract":{get:function(){return tryInteract;},set:function($value){tryInteract=$value;}},
"guardSupplies":{get:function(){return guardSupplies;},set:function($value){guardSupplies=$value;}},
"useGeoMap":{get:function(){return useGeoMap;},set:function($value){useGeoMap=$value;}},
"useBell":{get:function(){return useBell;},set:function($value){useBell=$value;}},
"useAltar":{get:function(){return useAltar;},set:function($value){useAltar=$value;}},
"hit2_seatNear":{get:function(){return hit2_seatNear;},set:function($value){hit2_seatNear=$value;}},
"sitDown":{get:function(){return sitDown;},set:function($value){sitDown=$value;}},
"spawnAtTile":{get:function(){return spawnAtTile;},set:function($value){spawnAtTile=$value;}},
"useLink":{get:function(){return useLink;},set:function($value){useLink=$value;}},
"linksOf":{get:function(){return linksOf;},set:function($value){linksOf=$value;}},
"floorIdOf":{get:function(){return floorIdOf;},set:function($value){floorIdOf=$value;}},
"topFloorOf":{get:function(){return topFloorOf;},set:function($value){topFloorOf=$value;}},
"stairGo":{get:function(){return stairGo;},set:function($value){stairGo=$value;}},
"LAB_LOOT":{get:function(){return LAB_LOOT;},set:function($value){LAB_LOOT=$value;}},
"labLoot":{get:function(){return labLoot;},set:function($value){labLoot=$value;}},
"SEARCH":{get:function(){return SEARCH;},set:function($value){SEARCH=$value;}},
"clearSearch":{get:function(){return clearSearch;},set:function($value){clearSearch=$value;}},
"searchContainer":{get:function(){return searchContainer;},set:function($value){searchContainer=$value;}},
"searchTick":{get:function(){return searchTick;},set:function($value){searchTick=$value;}},
"holdJob":{get:function(){return holdJob;},set:function($value){holdJob=$value;}},
"searchLoot":{get:function(){return searchLoot;},set:function($value){searchLoot=$value;}},
"DESK_LOOT":{get:function(){return DESK_LOOT;},set:function($value){DESK_LOOT=$value;}},
"rollLoot":{get:function(){return rollLoot;},set:function($value){rollLoot=$value;}},
"doSearch":{get:function(){return doSearch;},set:function($value){doSearch=$value;}},
"useTerminal":{get:function(){return useTerminal;},set:function($value){useTerminal=$value;}},
"os2later":{get:function(){return os2later;},set:function($value){os2later=$value;}},
"useTrash":{get:function(){return useTrash;},set:function($value){useTrash=$value;}},
"useData":{get:function(){return useData;},set:function($value){useData=$value;}},
"tryGateWest":{get:function(){return tryGateWest;},set:function($value){tryGateWest=$value;}}
});
})(GameModules.imports("game3d/js/interact.js"));
