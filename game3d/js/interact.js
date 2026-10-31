/* 里世界 3D · 交互：设施、楼梯、搜东西、终端 */
'use strict';

function nearWorld(radius){
  if(S.mode==='in'){
    var R=INTERIORS[S.room];
    if(!R) return null;
    if(R.spiral&&SP.state!=='ground') return null;   /* 在钟楼楼梯上，够不着地上的东西 */
    var hits=[];
    for(var r=0;r<R.rows;r++) for(var c=0;c<R.cols;c++){
      var ch=R.grid[r][c];
      if(ch==='#'||ch==='.') continue;
      var wx=R.ox+(c+0.5)*R.tw, wy=R.oy+(r+0.5)*R.th;
      var d=Math.sqrt(dist2(wx,wy,S.x,S.y));
      if(d>=radius) continue;
      /* 以前只取最近的格子、不看朝向：终端被课桌围着时，按 E 永远在翻课桌。
         现在面前的东西优先，侧面、背后的要近得多才会被选中。 */
      var off=d<4?0:angDiff(Math.atan2(wy-S.y,wx-S.x),S.ang);
      hits.push({ch:ch,c:c,r:r,x:wx,y:wy,d:d,score:d+off*10});
    }
    hits.sort(function(a,b){return a.score-b.score;});
    return hits[0]||null;
  }
  var best=null,bd=1e9;
  for(var i=0;i<OBJ.length;i++){
    var o=OBJ[i];
    if(o.k!=='roof') continue;
    var dw=doorWorld(o);
    var d2=Math.sqrt(dist2(dw.x,dw.y,S.x,S.y));
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
function facClock(){ return gameClock(); }
function facRoll(n){
  var r=Math.random(), r2=Math.random();
  if(hasItem('goggles')) r=Math.min(r,r2);              /* 护目镜：两次里取好的那次（离心机、显微镜都是数字小的好） */
  return Math.floor(r*n);
}
function useFacility(ch,R){
  var cool=S.actCool||(S.actCool={});
  var key='fac'+ch;
  var cd=FAC_CD[ch]||60;
  if(cool[key]&&facClock()<cool[key]){ os('我：刚弄过。等一会儿。',2.0); return true; }
  var rolled=false;
  if(ch==='Z'){
    /* 物理实验室：单摆会"预报"下一次异象 —— 说出来的那个就是真的会来的那个 */
    rolled=true;
    if(!AN.active&&AN.pre&&AN_WARN[AN.pre]&&anAllowed(AN.pre)){
      AN.locked=true;
      var mins=Math.max(1,Math.round(AN.next*rateAt(S.tsec)/60));
      os('我：我把摆拉开、松手。它没有来回摆，而是慢慢停在一个方向上，像被什么吸住了。\n秤盘上的砝码排成了几个字——「'+(AN_CN[AN.pre]||AN.pre)+'」。还有大约 '+mins+' 分钟。',6.5);
      toast('预报：'+(AN_CN[AN.pre]||AN.pre));
      addClue('pendulum');
    }else if(AN.active){
      S.san=Math.max(0,S.san-4);
      os('我：摆在乱转，转得越来越快。它在说：已经来了。',3.6);
    }else{
      S.san=Math.min(100,S.san+5);
      os('我：摆停在正中，一动不动。它没有给出危险预警。',3.4);
    }
    advanceGameTime(3);
  }else if(ch==='C'){
    rolled=true;
    var v2=facRoll(100);
    if(v2<46&&!RT.vialTaken){
      if(!addItem('vial')) return true;
      RT.vialTaken=1; os('我：转子转起来，液体分成两层。最底下沉着一线发光的东西，我把它倒进一支空管里。',4.2);
    }
    else if(v2<46){ S.san=Math.min(100,S.san+7); os('我：转子转起来，液体分成两层。白的在上。',3.6); toast('离心机 · SAN +7'); }
    else if(v2<72){ S.san=Math.min(100,S.san+2); os('我：离心机停了。管子里的东西还在转。',3.6); toast('离心机 · SAN +2'); }
    else { S.san=Math.max(0,S.san-5); os('我：配平没配好，整台机器在桌上跳。',3.6); toast('离心机 · SAN −5'); }
    advanceGameTime(5);
  }else if(ch==='N'){
    rolled=true;
    if(!RT.lensTaken){                       /* 传送门材料：透镜 */
      if(addItem('lens')){
        RT.lensTaken=1;
        os('我：镜片里有一只眼睛，它眨了一下，物镜就松了。我把它拧了下来，攥在手里是凉的。',4.4);
        cool[key]=facClock()+cd;
      }
      return true;
    }
    var v3=facRoll(100);
    if(v3<58){ S.san=Math.min(100,S.san+4); os('我：调焦旋钮是热的。视野里有东西在慢慢游。',3.6); toast('显微镜 · SAN +4'); }
    else { S.san=Math.max(0,S.san-4); os('我：镜片里有一只眼睛。它先眨了一下。',3.8); toast('显微镜 · SAN −4'); }
  }else if(ch==='Y'){
    rolled=true;
    addClue('geo');
    if(!hasItem('compass')&&!RT.geoCompass){
      if(!addItem('compass')) return true;
      RT.geoCompass=1;
      os('我：地球仪上，学校的位置被铅笔描了很多遍，纸都描破了。底座的抽屉里有个罗盘。',4.6);
    }else{
      os('我：我转了一下地球仪。它转回来，停在原来那一面。',3.2);
    }
    S.san=Math.min(100,S.san+2);
  }else if(ch==='K'){
    if(R.host==='admin'){
      os('我：办公桌上摊着一叠表格。最上面那张的名字被涂掉了。',3.6);
      if(!RT.adminDesk){ RT.adminDesk=1; addClue('office'); toast('办公室 · 线索 +1'); }
    }else if(R.floor===1){
      portalBench(); return true;            /* 物理实验室的实验台：造传送门（portal.js） */
    }else{
      if(R.floor===5){ os('我：讲台上摊着谱子。第三乐章那一页被折了角。',3.4); }
      else if(R.floor===3){ os('我：教师台上摊着一本「机房钥匙借用登记」。最后一页是空的。',3.6); }
      else { os('我：教师台上还留着上一节课的东西。烧杯里的水是温的。',3.4); }
      if(R.floor===2&&!RT.labReagent){
        if(hasItem('goggles')) os('我：台上还有一副护目镜，我已经带了一副。',3.2);
        else if(addItem('goggles')) RT.labReagent=1;
      }
    }
  }
  if(rolled) cool[key]=facClock()+cd;
  try{ SFX.click(); }catch(e){}
  return true;
}
function sanActFor(R,hit){
  if(S.mode==='in'){
    if(!hit||!R) return null;
    /* 饭点免费吃；饭点以外得投币（见 canteenWindow） */
    if(R.host==='canteen'&&(hit.ch==='k'||hit.ch==='t')&&mealNow()) return 'eat';
    if((R.host==='dormN'||R.host==='dormS')&&hit.ch==='b') return 'sleep';
    if(R.host==='lab'&&hit.ch==='p') return 'piano';
    if(R.host==='lab'&&hit.ch==='n') return 'pc';
    if(R.host==='teach'&&hit.ch==='w') return 'wash';
    return null;
  }
  if(S.mode==='out'){
    var mx=S.x/SC, my=S.y/SC, i, o;
    for(i=0;i<OBJ.length;i++){
      o=OBJ[i];
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
  S.actCool=S.actCool||{};
  var clockNow=gameClock();
  if(S.actCool[key]&&clockNow<S.actCool[key]){
    os('我：刚做过。现在没那个心情。',2.4); return;
  }
  S.san=Math.min(100,S.san+a.san);
  var _before=S.tsec;
  advanceGameTime(a.min);
  S.actCool[key]=gameClock()+a.cd;
  restoreStamina(25);
  if(key==='piano'){ try{ SFX.resume(); SFX.moonlight(); }catch(e){} }
  else if(key==='pc'){ try{ PCGAME.start(); }catch(e){} }
  if(a.min>=4){
    try{ timeSkipCard(a.min, a.n, S.tsec); }catch(e){}
  }
  os(a.msg,3.6);
  if(a.min<4) toast('SAN +'+a.san);
  try{ SFX.click(); }catch(e){}
}
var SKIP_T=null;
function timeSkipCard(mins,actName,tsec){
  var el=document.getElementById('skip');
  if(!el) return;
  var b=el.querySelector?el.querySelector('b'):null;
  var i=el.querySelector?el.querySelector('i'):null;
  var em=el.querySelector?el.querySelector('em'):null;
  if(b) b.textContent='…'+mins+' 分钟过去了';
  if(i) i.textContent=hasClock()?fmtClock(tsec):periodAt(tsec)[2];
  if(em) em.textContent=actName||'';
  el.classList.add('on');
  if(SKIP_T) clearTimeout(SKIP_T);
  SKIP_T=setTimeout(function(){
    if(el) el.classList.remove('on');
  }, 760);
}
function nearRoster(){ return AN.active&&AN.id==='roster'&&AN.data&&!AN.data.done&&AN.data.rx!==undefined&&dist2(S.x,S.y,AN.data.rx,AN.data.ry)<80*80; }
/* 被划掉的名单：以前没有任何办法"处理"它，16 秒后必扣 30 违规 */
function useRoster(timeoutMs){
  var d=AN.data;
  if(hasItem('pen')||hasItem('chalk')){
    d.done=true;
    S.san=Math.min(100,S.san+6);
    os('我：我在那道红线旁边，把自己的名字一笔一画重新写了一遍。写完以后，红线淡了。',4.4);
    addClue('roster');
    return;
  }
  UI.choice('名单上，我的名字被一道红线划掉了。手边没有笔。',[
    {label:'把它撕下来',fn:function(){ UI.closeChoice(); d.done=true; addViolation(8); S.san=Math.max(0,S.san-5);
      os('我：纸撕下来的时候，下面还贴着一张。一模一样，连那道红线都是新的。……至少我把它撕了。',4.6); }},
    {label:'用指甲把名字刻回去',fn:function(){ UI.closeChoice(); d.done=true; S.san=Math.max(0,S.san-10);
      os('我：指甲劈了。名字刻上去了，歪歪扭扭的，渗着一点红。',4.0); }},
    {label:'不管它',fn:function(){ UI.closeChoice(); }}
  ],{timeoutMs:Number.isFinite(timeoutMs)?Math.max(1,timeoutMs):5000});
}
/* 准星下面那行「E 做什么」。判断顺序和下面的 tryInteract 一致：改了其中一个，另一个要对照着改。 */
function canteenHint(h,R){ return (R.host==='canteen'&&!mealNow())?(hasItem('coin')?'投币买饭':'打饭窗口'):'翻找'; }
var TILE_HINT={
  '=':function(h,R){ var need=doorLockNeed(R,h.c,h.r); return (need&&!hasItem(need))?'开门（锁着）':'开门'; },
  O:'出去', H:'躲进柜子',
  M:function(){ return hasItem('coin')?'投币（售货机）':'售货机'; },
  k:canteenHint, t:canteenHint,
  L:'走连廊', Q:'看服务器终端', S:'上下楼', P:'坐下', c:'上车', V:'上车',
  D:function(){ return (S.room==='lab3')?'门禁管理终端':'使用终端'; },
  X:'钻进去',
  K:function(h,R){ return (R&&R.host==='admin')?'看办公桌':'看实验台'; },
  Z:'放开单摆', C:'开离心机', N:'看显微镜', Y:'转地球仪', p:'弹琴', U:'撞钟', A:'看供桌', x:'看挂图',
  B:'隔间', G:'隔间', w:'洗把脸',
  b:function(h,R){ return sanActFor(R,h)?'躺一会儿':'床'; },
  n:'用电脑'
};
var GATE_HINT=[[GATE_N,'校门'],[GATE_W,'西小门'],[GATE_S,'南门']];
function interactHint(){
  if(S.dead||S.screen!=='play'||UI.anyOpen()||PAUSE.on) return '';
  var R=S.mode==='in'?INTERIORS[S.room]:null, h=R?nearWorld(24):null;
  var first=h&&(FAC_CD[h.ch]!==undefined||sanActFor(R,h));   /* 设施、恢复 SAN 的动作排在"坐下"前面 */
  if(HIDE.on) return '出来';
  if(bellReach()) return '撞钟';
  if(nearRoster()) return '那张名单';
  if(S.seated) return '站起来';
  if(R&&!first&&hit2_seatNear(R)) return '坐下';
  if(S.mode==='in'){
    if(!h) return '';
    var th=TILE_HINT[h.ch];
    if(th===undefined) return '翻找';
    return (typeof th==='function')?th(h,R):th;
  }
  var nb=nearWorld(0), act=nb?null:sanActFor(null,null), i;
  if(nb) return '进入 '+nb.obj.n;
  if(act) return SAN_ACTS[act].n+'（SAN +'+SAN_ACTS[act].san+'，'+SAN_ACTS[act].min+' 分钟）';
  for(i=0;i<GATE_HINT.length;i++){
    var g=GATE_HINT[i][0];
    if(Math.sqrt(dist2(g.x*SC,g.y*SC,S.x,S.y))<70) return GATE_HINT[i][1];
  }
  return '';
}
function tryInteract(){
  if(S.screen!=='play'||S.dead||PAUSE.on||UI.anyOpen()) return;
  if(S.seated){ S.seated=false; os('我站了起来。',1.6); S.enterCool=0.4; return; }
  if(HIDE.on){ hideOut(); return; }
  if(nearRoster()){ useRoster(); return; }

  if(S.mode==='out'){
    var nb=nearWorld(0);
    if(nb){
      var id=nb.obj.id;
      var map={teach:'teach1',admin:'admin1',lab:'lab1',canteen:'canteen1',
        dormN:'dorm1',dormS:'dorm4',garage:'garage1',garw:'garage1',trash:'trash1',
        guard:'guard1',gear:'gear1',bell:'bell1'};

      if(map[id]){ ENTER_VIA='out'; try{ SFX.door(); }catch(e){} enterRoom(map[id]); return; }
      return;
    }
    var act=sanActFor(null,null);
    if(act){ doSanAct(act); return; }
    var gn=Math.sqrt(dist2(GATE_N.x*SC,GATE_N.y*SC,S.x,S.y));
    if(gn<70){ os('我：北门的闸机屏幕上显示：「查无此人」。门外的路上没有车，也没有声音，一直延伸到雾里。',4.2); addClue('gaten'); return; }
    var gw=Math.sqrt(dist2(GATE_W.x*SC,GATE_W.y*SC,S.x,S.y));
    if(gw<70){ tryGateWest(); return; }
    var gs=Math.sqrt(dist2(GATE_S.x*SC,GATE_S.y*SC,S.x,S.y));
    if(gs<70){ os('我：南门锁着，锁上全是锈。门缝外面——是另一个南门。',3.4); return; }
    os(pick(['我：这里摸不到什么。','我：……什么都没有。可我总觉得刚刚有东西在这儿。','我：地上很凉。']),1.8);
    return;
  }

  var R=INTERIORS[S.room];
  if(bellReach()){ useBell(); return; }
  var _sa=sanActFor(R,null), _hit0=nearWorld(24);
  if(_hit0&&FAC_CD[_hit0.ch]!==undefined){ if(useFacility(_hit0.ch,R)) return; }
  if(_hit0){ var _k=sanActFor(R,_hit0); if(_k){ doSanAct(_k); return; } }
  if(hit2_seatNear(R)){ sitDown(); return; }
  var hit=nearWorld(24);
  if(!hit){ os('我：这里什么都没有。',1.8); return; }
  var ch=hit.ch;
  if(ch==='='){
    var _need=doorLockNeed(R,hit.c,hit.r);
    if(_need&&!hasItem(_need)){
      os('我：门锁着。锁孔是圆的，很新。',2.8);
      toast('需要「'+ITEMS[_need].n+'」· 校长办公室可能有');
      addClue('roomkey');
      return;
    }
    if(!OPENDOORS[doorKeyAt(R,hit.c,hit.r)]){
      OPENDOORS[doorKeyAt(R,hit.c,hit.r)]=1;
      SFX.door(); os(pick(['我：门开了。','我：门开了。合页的声音拖得很长。','我：门开了。里面比外面冷。']),1.8); S.enterCool=0.35;
      roomDoorRefresh(R,hit.c,hit.r);                   /* 只重建这一扇门（以前整层楼重建，同学还会重新随机坐） */
    }else{
      os('我：门开着。',1.4);
    }
    return;
  }
  if(ch==='O'){
    if(R.floor>1){ os('我：这是'+R.floor+'楼。这边的窗子封死了。',3.0); return; }
    exitRoom(); return;
  }
  if(ch==='S'){ stairGo(); return; }
  if(ch==='H'){ hideIn(hit); return; }
  if(ch==='L'){ useLink(R,hit.c,hit.r); return; }
  if(ch==='Q'){
    addClue('server');
    if(!RT.coilTaken){                       /* 传送门材料：铜线圈 */
      if(addItem('coil')){
        RT.coilTaken=1;
        os('我：服务器在响，像很多人一起压着嗓子呼气。机柜背板松了，里面一卷铜线圈烫得发红——我把它抽了出来，机柜一下子安静了。',5.2);
      }
      return;
    }
    os('我：服务器在响，像很多人一起压着嗓子呼气。屏幕上滚着门禁记录——每一行的时间都是 11:40。',4.6);
    return;
  }
  if(ch==='q'){ searchContainer(hit.c,hit.r); return; }
  if(ch==='x'){ useGeoMap(); return; }
  if(ch==='U'){ useBell(); return; }
  if(ch==='A'){ useAltar(); return; }
  if(ch==='P'){ sitDown(); return; }
  if(ch==='d'||ch==='f'||ch==='R'){ searchContainer(hit.c,hit.r); return; }
  if(ch==='T'){
    if(S.room==='teach1'){
      if(hasItem('chalk')) os('我：讲台上有一支粉笔，我已经带了一支。',2.8);
      else if(addItem('chalk')) os('我：讲台上有一支粉笔。',2.8);
    }
    else os('我：讲台是空的。',2.2);
    return;
  }
  if(ch==='c'){ useCar(hit.c,hit.r); return; }
  if(ch==='V'){ useCar(hit.c,hit.r); return; }        /* 车库的车位格是 'V'，'c' 是教室椅子 */
  if(ch==='D'){
    if(S.room==='admin3') useData(); else useTerminal();
    return;
  }
  if(ch==='X'){ useTrash(); return; }
  if(ch==='p'){
    if(S.tsec<EVENING) os('我：现在弹琴，走廊里的人都听得见。',3.0);
    SFX.moonlight();
    os('我：是《月光》。第一乐章。可是钢琴没有人在弹。',5.5);
    return;
  }
  if(ch==='b'){ os('我：床。可是现在不能睡。',2.4); return; }
  if(ch==='k'&&R.host==='guard'){
    /* 钥匙以前就挂在这儿，太容易了；现在收到了校长办公室 */
    if(!RT.guardKeysTold){
      RT.guardKeysTold=1; addClue('keys');
      os('我：柜台下面的钥匙钩全空了。钩子旁边贴着一张条：「钥匙一律上交校长办公室（行政楼五楼）」。',4.8,OS_KEEP);
      if(!hasItem('torch')) setTimeout(function(){ if(!S.dead&&!hasItem('torch')&&addItem('torch')) os('我：抽屉里倒是有一把手电筒。去车库之前，把它带上。',3.8); },2600);
      return;
    }
    if(!hasItem('torch')){
      if(addItem('torch')) os('我：柜台下面还有一把手电筒。去车库之前，把它带上。',4.2);
      return;
    }
    os('我：柜台下面没有别的了。',2.0); return;
  }
  if(R.host==='canteen'&&(ch==='t'||ch==='k')){ canteenWindow(); return; }
  if(ch==='M'){ useVending(); return; }
  if(ch==='t'||ch==='k'){ os('我：没有能吃的。',2.0); return; }
  if(ch==='B'||ch==='G'){ useStall(); return; }
  if(ch==='w'){ S.san=Math.min(100,S.san+4); os('我：洗了把脸。',2.2); return; }
  os('我：用不上。',1.8);
}

/* 地理实验室的挂图：每张会圈出一个你还没去过的地方 */
function useGeoMap(){
  RT.geoMaps=RT.geoMaps||0;
  var left=[], i;
  for(i=0;i<SPOTS.length;i++) if(!S.spots[SPOTS[i].id]) left.push(SPOTS[i]);
  if(!left.length||RT.geoMaps>=4){ os('我：挂图上的路我都走过了。有一条是我没见过的——它通到围墙外面，然后被撕掉了。',4.2); return; }
  var sp=left[Math.floor(Math.random()*left.length)];
  RT.geoMaps++;
  S.spots[sp.id]=1; UI.spotsDirty=true;
  os('我：挂图是很多年前的校园平面图。有一处被红笔圈了好几圈，旁边写着「'+sp.n+'」。',4.6);
  toast('记下了：'+sp.n);
}
function useBell(){
  if(AN.active&&AN.id==='bell13'){
    os('我：我抱住撞木，用力撞了一下。钟声和那第十三下撞在一起——两边都没了。',4.6);
    S.san=Math.min(100,S.san+8);
    try{ SFX.bigBell&&SFX.bigBell(); }catch(e){}
    anEnd(); return;
  }
  addClue('bell');
  if(S.exam){ try{ SFX.bigBell&&SFX.bigBell(0.3); }catch(e){} os('我：钟还在嗡嗡地响。今天剩下的课，都是考试了。',3.4); return; }
  /* 钟楼顶上撞响这口钟：当天剩下的课全部改成考试（examStart 在 systems.js） */
  try{ SFX.bigBell&&SFX.bigBell(1); }catch(e){}
  examStart();
}
function useAltar(){
  addClue('altar');
  if(!RT.altarCoin){
    if(hasItem('coin')){ os('我：香炉底下压着一枚硬币。我已经带了一枚。',3.6); return; }
    if(!addItem('coin')) return;
    RT.altarCoin=1;
    os('我：供桌上的饭还冒着气，筷子竖插在正中。照片上那张脸被剪掉了，校服是我们学校的。香炉底下压着一枚硬币。',5.6);
    return;
  }
  S.san=Math.max(0,S.san-2);
  os('我：照片里那个人的手，好像比刚才抬高了一点。',3.2);
}
function hit2_seatNear(R){
  if(!R) return false;
  var c=Math.floor((S.x-R.ox)/R.tw), r=Math.floor((S.y-R.oy)/R.th);
  var dc, dr;
  for(dr=-1;dr<=1;dr++){
    for(dc=-1;dc<=1;dc++){
      var rr=r+dr, cc=c+dc;
      if(rr<0||cc<0||rr>=R.rows||cc>=R.cols) continue;
      if(R.grid[rr][cc]==='P') return true;
    }
  }
  return false;
}
function sitDown(){
  var R=INTERIORS[S.room];
  if(!R) return;
  var myCol=MY_COL, myRow=MY_ROW;
  var col=Math.floor((S.x-R.ox)/R.tw), row=Math.floor((S.y-R.oy)/R.th);
  var isMine=(S.room==='teach1'&&Math.abs(col-myCol)<=1&&Math.abs(row-myRow)<=1);
  /* 坐到旁边那把椅子上（椅子现在有碰撞，人站不到椅子格里去了） */
  var best=null, bd=1e9, dr, dc;
  for(dr=-1;dr<=1;dr++) for(dc=-1;dc<=1;dc++){
    var rr=row+dr, cc=col+dc;
    if(rr<0||cc<0||rr>=R.rows||cc>=R.cols||R.grid[rr][cc]!=='P') continue;
    var px=R.ox+(cc+0.5)*R.tw, py=R.oy+(rr+0.5)*R.th, d=Math.hypot(px-S.x,py-S.y);
    if(d<bd){ bd=d; best=[px,py]; }
  }
  if(best){ S.x=best[0]; S.y=best[1]; S.ang=-PI/2; }
  else{ S.x=R.ox+(col+0.5)*R.tw; S.y=R.oy+(row+0.5)*R.th; }
  S.seated=true; S.enterCool=0.5;
  S.eyeH=EYE;
  if(isMine) os('我坐下了。这是我自己的位子。',2.4);
  else os('我坐下了。这个位子不是我的。',2.4);
  SFX.click();
}
function spawnAtTile(id,r2,c2){
  var R=INTERIORS[id];
  return {x:R.ox+(c2+0.5)*R.tw, y:R.oy+(r2+0.5)*R.th};
}
function useLink(R,c,r){
  var id=R.id, host=R.host, f=R.floor;
  if(R.host==='c1'||R.host==='c2'){
    var to=linksOf(R.host);
    var dest=(r<=Math.floor(R.rows/2))?to.north:to.south;
    if(!dest){ os('我：那头封着。',2.0); return; }
    var DR=INTERIORS[dest.id];
    var sp=DR?{x:DR.ox+(dest.c+0.5)*DR.tw, y:DR.oy+(dest.r+0.5)*DR.th}:null;
    SFX.door();
    enterRoom(dest.id, sp);
    return;
  }
  if(f!==2){ os('我：连廊在二楼。',2.2); return; }
  var tgt=null;
  if(host==='admin') tgt={id:'link1', end:'north'};
  else if(host==='lab') tgt=(c>=R.cols*0.5)?{id:'link1', end:'south'}:{id:'link2', end:'north'};
  else if(host==='teach') tgt={id:'link2', end:'south'};
  if(!tgt){ os('我：这层没有连廊。',2.0); return; }
  var LR=INTERIORS[tgt.id];
  var sl=(tgt.end==='north')?1:LR.rows-2;
  SFX.door();
  enterRoom(tgt.id, spawnAtTile(tgt.id, sl, 2));
}
function linksOf(host){
  if(host==='c1'){
    var A=INTERIORS['admin2'], L=INTERIORS['lab2'];
    return {
      north:{id:'admin2', c:A?A.cols-3:0, r:18},
      south:{id:'lab2',  c:L?L.cols-3:0, r:16}
    };
  }
  var L2=INTERIORS['lab2'], T=INTERIORS['teach2'];
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
  var R=INTERIORS[S.room];
  if(!R){ exitRoom(); return; }
  var f=R.floor, host=R.host, top=topFloorOf(host);
  if(top<=1){ exitRoom(); return; }
  var up=(f<top)?floorIdOf(host,f+1):null, dn=(f>1)?floorIdOf(host,f-1):null;
  function upLabel(){ return (host==='teach'&&f+1===6)?'上天台':'上楼（'+(f+1)+'F）'; }
  if(up&&dn){
    UI.choice('楼梯间里很安静。扶手是凉的。',[
      {label:upLabel(),fn:function(){ UI.closeChoice(); SFX.stairs&&SFX.stairs(); ENTER_VIA='stair'; enterRoom(up); }},
      {label:'下楼（'+(f-1)+'F）',fn:function(){ UI.closeChoice(); SFX.stairs&&SFX.stairs(); ENTER_VIA='stair'; enterRoom(dn); }},
      {label:'算了',fn:function(){ UI.closeChoice(); }}
    ]);
    return;
  }
  try{ SFX.stairs&&SFX.stairs(); }catch(e){}
  if(up){ ENTER_VIA='stair'; enterRoom(up); return; }
  if(dn){ ENTER_VIA='stair'; enterRoom(dn); return; }
  exitRoom();
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
  var r=Math.random(), t=LAB_LOOT[floor];
  return t?rollLoot(t,r):null;
}
/* 翻找要花 0.8 秒：站着别动，准星外面那一圈走满才算翻完；走开就断了。DEV 里可以关掉 */
var SEARCH={on:true,dur:0.8,job:null};
function clearSearch(){
  SEARCH.job=null;
  var el=document.getElementById('searchring'); if(el) el.style.display='none';
}
function searchContainer(c,r){
  var key=S.room+':'+c+':'+r;
  if(ncOccupied(c,r)){
    os('我：他坐在这儿。我不能翻他的抽屉。',3.0);
    return;
  }
  if(RT.deskUsed[key]){ os('我：翻过了。',1.6); return; }
  if(SEARCH.on){
    if(!SEARCH.job){ SEARCH.job={c:c,r:r,room:S.room,x:S.x,y:S.y,t:0}; try{ SFX.click(); }catch(e){} }
    return;
  }
  doSearch(c,r);
}
function searchTick(dt){
  var j=SEARCH.job, el=document.getElementById('searchring');
  if(j&&(S.dead||S.mode!=='in'||S.room!==j.room||Math.hypot(S.x-j.x,S.y-j.y)>5)){
    SEARCH.job=null; os(j.done?'我：手一松，钥匙从锁孔里滑了出来。':'我：手一松，没翻完。',1.4); j=null;
  }
  if(el){ el.style.display=j?'block':'none'; if(j) el.style.setProperty('--p',Math.min(1,j.t/(j.dur||SEARCH.dur))); }
  if(!j) return;
  j.t+=dt;
  if(j.t>=(j.dur||SEARCH.dur)){ SEARCH.job=null; if(el) el.style.display='none'; if(j.done) j.done(); else doSearch(j.c,j.r); }
}
/* 别的"站着别动、等读条走满"的操作（比如在车库里一辆辆试钥匙）也用这一圈 */
function holdJob(dur,done){
  if(SEARCH.job) return false;
  SEARCH.job={room:S.room,x:S.x,y:S.y,t:0,dur:dur,done:done};
  return true;
}
/* 重复物品先留在原容器，保存首次抽到的结果，不能通过重试来重抽。 */
function searchLoot(key,id){
  if(hasItem(id)){
    if(!RT.pendingLoot) RT.pendingLoot={};
    RT.pendingLoot[key]=id;
    delete RT.deskUsed[key];
    os('我：这里有「'+ITEMS[id].n+'」。我已经带着一份，先把它留在这里。',3.2);
    return;
  }
  if(addItem(id)){
    RT.deskUsed[key]=1;
    if(RT.pendingLoot) delete RT.pendingLoot[key];
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
  var key=S.room+':'+c+':'+r;
  if(RT.deskUsed[key]) return;
  /* 满包不能占用容器，否则钥匙或固定的 U 盘会消失。 */
  if(S.bag.length>=8){ os('我：装不下了。先腾出一个空位再翻。',2.4); return; }
  if(RT.pendingLoot&&RT.pendingLoot[key]){ searchLoot(key,RT.pendingLoot[key]); return; }
  RT.deskUsed[key]=1;
  var _R=INTERIORS[S.room];
  /* 车钥匙和机房钥匙：校长办公室的容器 45%，别的老师办公室 1%（以前直接挂在保安岗） */
  if(_R&&_R.host==='admin'){
    var miss=['key','roomkey'].filter(function(k){ return !hasItem(k); });
    if(miss.length&&Math.random()<(_R.principal?0.45:0.01)){
      var kk=miss[Math.floor(Math.random()*miss.length)];
      os(kk==='key'?'我：抽屉最里面压着一串车钥匙，牌号刻在环上。':'我：抽屉里有一把铜钥匙，塑料标签上写着「机房」。',3.6);
      addItem(kk); return;
    }
    if(_R.principal){
      var pr=Math.random();
      if(pr<0.12&&!hasItem('atlas')){ os('我：抽屉里卷着一大张图纸，是整个学校每一层的平面图。',3.4); addItem('atlas'); return; }
      if(pr<0.18&&!hasItem('elixir')){ os('我：一个空药盒里只剩一粒药丸，盒子上的字被刮掉了。',3.4); addItem('elixir'); return; }
    }
  }
  if(S.room==='lab3'&&_R&&_R.grid[r]&&_R.grid[r][c]==='R'&&!hasItem('usb')){
    os('我：货架最上层有个文件盒，里面躺着一个 U 盘。标签上写着「门禁」。',3.6);
    addItem('usb'); return;
  }
  if(_R&&_R.host==='lab'){
    var lv=labLoot(_R.floor);
    if(lv) searchLoot(key,lv); else os('我：空的。抽屉里只有一层灰。',2.0);
    return;
  }
  var give=rollLoot(DESK_LOOT,Math.random());
  if(S.room==='teach1'&&!RT.hwTaken&&r>1&&r<14){
    RT.hwTaken=true; give='hw';
  }
  if(give) searchLoot(key,give);
  else os(pick(['我：空的。只有一层灰。','我：空的。抽屉底下用圆珠笔写着一个名字，被涂黑了。','我：空的。最里面有一小撮头发。']),2.4);
}
function useTerminal(){
  if(S.room!=='lab3'){ os('我：这台终端连不上。',2.2); return; }
  if(RT.hacked){ os('我：白名单里已经有我那一行了。光标还在闪，像在等我再写点什么。',3.2); return; }
  /* 以前只有随机到「编程社」天赋才走得通；现在网络中心货架上的 U 盘也能做到 */
  if(S.talent!=='code'&&!hasItem('usb')){
    os('我：屏幕上是一串我看不懂的东西。旁边贴着一张便签：「门禁 U 盘插这里」。',4.0);
    addClue('usb');
    return;
  }
  RT.hacked=true;
  addClue('comp');
  if(S.talent==='code') os('我：我打开门禁后台，在白名单最后加了一行——我自己的学号。回车的时候，整排机柜同时闪了一下。',5,OS_KEEP);
  else os('我：U 盘插进去，屏幕自己跳出一个窗口，光标在最后一行闪。我输了自己的学号。机柜同时闪了一下。',5,OS_KEEP);
  os2later('我：还得去行政楼三楼，把数据同步过去。',5200);
}
function os2later(msg,ms){ setTimeout(function(){ if(!S.dead&&S.screen==='play') os(msg,3.6,OS_KEEP); },ms); }
function useTrash(){
  if(S.room!=='trash1'){ os('我：这个桶太小了。',2.2); return; }
  tryTrashRoute();
}
function useData(){
  if(S.room!=='admin3'){ os('我：这台机器不归我管。',2.2); return; }
  if(!RT.hacked){ os('我：它要我输入一个我不该知道的东西。屏幕右下角写着：数据源 · 实验楼 3F 网络中心。',3.8); return; }
  if(RT.data){ os('我：已经同步过了。',2.0); return; }
  RT.data=true;
  os('我：进度条走完了。屏幕上弹出一张照片——是我。照片底下写着：已登记。西小门的闸机，现在认得我了。',5.2,OS_KEEP);
}
function tryGateWest(){
  if(!RT.hacked||!RT.data){ os('我：小门上挂着锁，旁边那台闸机的屏幕亮着：「未登记」。',3.0); addClue('gatew'); return; }
  FaceChallenge.open();
}
