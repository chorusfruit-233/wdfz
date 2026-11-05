/* @module-capsule */
(function($imports){
/* 里世界 3D · 国际交流与公开真结局《外国语学生》（计划《校园直通、翻越受伤与国际交流》第 8–9 节，Q1–Q4、Q8 真人确认）
   · 抽取：新局各抽一次——国际交流 5%（RT.exchange.hit），隐藏天赋「多语言」15%（RT.multilingual，速通模式不发；可与武大子弟叠加）。
   · 第二天白天（09:00 起，遇检查／过场等强制流程顺延）：广播说有交流团来访、需要会德语法语的同学接待，到行政楼北门登记；
     带队老师和三位访客在行政楼北门外等到 17:20。
   · 登记（和带队老师交互）：有多语言 → 「我可以帮忙接待」直接通过；没有 → 德语、法语资格考核，各 5 题、答对 4 题合格，每科一次补考，
     不合格扣 SAN（实施取值 6），两科都用完补考仍不合格 → 这一局的接待机会结束。
   · 接待资格成立：拿到当天的接待外出许可（沿用请假：当天考试、学生会检查都免，Q3）；再和带队老师说「出发」，队伍沿真实路线走向北校门。
   · 跟随（Q8）：离队尾 ≤5 米算跟上；5–9 米队伍放慢、回头招手；超过 9 米持续 4 秒 → 脱队，这一局的机会结束（不传送、不即死）。
   · 全校搜查（Q8）：出发时广播名单核对，原巡察者之外最多 3 名搜查员沿路线前方巡查，可以在你看不见的地方瞬移到前面；
     你跟着队伍时它们不管你（名单上有你）；离开队伍被看见会追，被追上死于搜查（沿用抓取的死亡演出）。
   · 跟着队伍穿过北校门 → 公开真结局《外国语学生》（演出在 exchange-cut.js）。 */
'use strict';

var EXCHANGE_CFG={chance:0.05,multi:0.15,day:2,from:540,until:1040,pass:4,questions:5,examSan:6,follow:5,warn:9,grace:4,lead:0.9,slow:0.6,
  searchers:3,seeRange:14,catchR:1.2,chase:30,tpEvery:10,tpChance:0.25,gap:[1.2,2.4,3.6]};
var EXAM={
  de:{n:'德语',q:[['Bitte bleiben Sie bei der Gruppe.','请跟着队伍',['请在这里等','请出示证件']],['Wo ist der Ausgang?','出口在哪里',['厕所在哪里','现在几点']],
    ['Wir gehen jetzt zum Tor.','我们现在去校门',['我们现在去食堂','我们现在去上课']],['Nicht zurückbleiben!','别掉队',['别说话','别跑']],['Danke für Ihre Hilfe.','谢谢你的帮助',['请帮帮我','不需要帮忙']]]},
  fr:{n:'法语',q:[["Restez avec le groupe, s'il vous plaît.",'请跟着队伍',['请在这里等','请出示证件']],['Où est la sortie ?','出口在哪里',['厕所在哪里','现在几点']],
    ['Nous allons au portail.','我们去校门',['我们去食堂','我们去上课']],['Ne restez pas en arrière !','别掉队',['别说话','别跑']],['Merci pour votre aide.','谢谢你的帮助',['请帮帮我','不需要帮忙']]]}
};
var Exchange=(function(){
  var own={owner:'exchange'}, C=EXCHANGE_CFG;
  function st(){ var s=$imports.RT.exchange; if(!s||typeof s!=='object') s=$imports.RT.exchange={hit:0,phase:'none',tries:{de:0,fr:0},passed:{de:0,fr:0},warned:0,lag:0}; return s; }
  function peek(){ return $imports.RT.exchange||{phase:'none'}; }
  function multi(){ return !!($imports.RT.multilingual&&$imports.RT.multilingual.active); }
  function now(){ return $imports.Mechanics?$imports.Mechanics.activePlaySeconds:0; }
  function gather(){ var a=$imports.OBJ.filter(function(o){ return o.id==='admin'; })[0]; return a?{x:(a.x+a.w/2)*$imports.SC,y:(a.y-10)*$imports.SC}:{x:1069,y:1010}; }
  function gate(){ return {x:$imports.GATE_N.x*$imports.SC,y:$imports.GATE_N.y*$imports.SC}; }
  /* ---------- 抽取 ---------- */
  GameModules.on('newGame',function(d){
    var u=$imports.GameRandom.next(), v=$imports.GameRandom.next();
    $imports.RT.exchange={hit:u<C.chance?1:0,phase:'none',tries:{de:0,fr:0},passed:{de:0,fr:0},warned:0,lag:0};
    $imports.RT.multilingual=(d&&d.mode==='speedrun')||$imports.RUN_MODE==='speedrun'?{active:0}:{active:v<C.multi?1:0};
  },own);
  function busy(){
    if($imports.CUT.on||$imports.AN.active) return true;
    try{ if(typeof $imports.Inspection!=='undefined'&&$imports.Inspection.quiet()) return true; }catch(e){}
    return false;
  }
  /* ---------- 路线 ---------- */
  function route(){
    var s=st(); if(s.path) return s.path;
    var g=gather(), t=gate(), path=null;
    try{ path=$imports.PatrolNav.path($imports.PatrolNav.point('out',g.x,g.y,0),$imports.PatrolNav.point('out',t.x,t.y,0)); }catch(e){}
    var pts=(path&&path.length?path:[g,t]).map(function(p){ return [Math.round(p.x*10)/10,Math.round(p.y*10)/10]; });
    var acc=[0]; for(var i=1;i<pts.length;i++) acc.push(acc[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
    s.path={pts:pts,acc:acc,len:acc[acc.length-1]}; return s.path;
  }
  function at(dist){
    var r=route(), d=Math.max(0,Math.min(r.len,dist)), i=1; while(i<r.acc.length-1&&r.acc[i]<d) i++;
    var a=r.pts[i-1], b=r.pts[i], seg=(r.acc[i]-r.acc[i-1])||1, k=(d-r.acc[i-1])/seg;
    return {x:a[0]+(b[0]-a[0])*k,y:a[1]+(b[1]-a[1])*k,yaw:Math.atan2(b[1]-a[1],b[0]-a[0])};
  }
  function members(){                                       /* 带队老师在最前，三位访客跟在后面 */
    var s=peek(), base=s.phase==='escort'?s.prog:0, g=gather(), out=[];
    if(s.phase==='escort'){ out.push(at(base)); C.gap.forEach(function(m){ out.push(at(base-m/$imports.U2M)); }); }
    else{ out.push({x:g.x,y:g.y,yaw:Math.PI/2}); C.gap.forEach(function(m,i){ out.push({x:g.x+(i-1)*12,y:g.y-14,yaw:Math.PI/2}); }); }
    return out;
  }
  function tailDist(){
    if($imports.S.mode!=='out') return Infinity;
    var m=members(), t=m[m.length-1], best=Infinity;
    m.forEach(function(p){ best=Math.min(best,Math.hypot($imports.S.x-p.x,$imports.S.y-p.y)*$imports.U2M); });
    return Math.min(best,Math.hypot($imports.S.x-t.x,$imports.S.y-t.y)*$imports.U2M);
  }
  /* ---------- 登记与考核 ---------- */
  function nearLeader(){ var s=peek(); if($imports.S.mode!=='out'||!(s.phase==='waiting'||s.phase==='qualified')) return false; var l=members()[0]; return Math.hypot($imports.S.x-l.x,$imports.S.y-l.y)*$imports.U2M<2.6; }
  GameModules.on('hint',function(){ if(!nearLeader()) return undefined; return peek().phase==='qualified'?'跟带队老师说：出发':'国际交流接待登记'; },own);
  GameModules.on('interact',function(){
    if(!nearLeader()) return undefined;
    var s=st();
    if(s.phase==='qualified'){ depart(); return true; }
    var opts=[];
    if(multi()) opts.push({label:'「我可以帮忙接待。」（Ich helfe gern. / Je peux aider.）',fn:function(){ $imports.UI.closeChoice(); qualify('multilingual'); }});
    ['de','fr'].forEach(function(k){ if(!s.passed[k]&&s.tries[k]<2) opts.push({label:'参加'+EXAM[k].n+'资格考核（'+C.questions+' 题，答对 '+C.pass+' 题合格'+(s.tries[k]?'，补考':'')+'）',fn:function(){ $imports.UI.closeChoice(); exam(k); }}); });
    opts.push({label:'算了',fn:function(){ $imports.UI.closeChoice(); }});
    $imports.UI.choice((multi()?'登记表上印着德语和法语。这两种发音，我以前都听过。\n':'登记表上印着德语和法语。接待的同学要能听懂集合和跟队的话。\n')+'德语：'+(s.passed.de?'合格':'未考')+'　法语：'+(s.passed.fr?'合格':'未考'),opts);
    return true;
  },own);
  function order(k){                                       /* 每局每科一套固定的选项顺序（跟存档走） */
    var s=st(); s.order=s.order||{}; if(s.order[k]) return s.order[k];
    s.order[k]=EXAM[k].q.map(function(){ return Math.floor($imports.GameRandom.next()*3); }); return s.order[k];
  }
  function exam(k){
    var s=st(), q=EXAM[k].q, ord=order(k), right=0, i=0;
    s.tries[k]++;
    function ask(){
      if(i>=C.questions) return done();
      var item=q[i], opts=item[2].slice(), pos=ord[i]; opts.splice(pos,0,item[1]);
      $imports.UI.choice(EXAM[k].n+'考核 · 第 '+(i+1)+' 题（共 '+C.questions+' 题）\n「'+item[0]+'」是什么意思？',opts.map(function(t,j){ return {label:t,fn:function(){ $imports.UI.closeChoice(); if(j===pos) right++; i++; ask(); }}; }));
    }
    function done(){
      var ok=right>=C.pass; (0,$imports.gameFact)('exchange',{what:'exam',lang:k,right:right,ok:ok});
      if(ok){ s.passed[k]=1; (0,$imports.os)('我：'+EXAM[k].n+'答对了 '+right+' 题。带队老师点了点头。',3); }
      else{ $imports.PlayerStats.changeSan(-C.examSan,'exchange',{min:0}); (0,$imports.os)('我：'+EXAM[k].n+'只答对了 '+right+' 题。'+(s.tries[k]<2?'还能补考一次。':'没有机会了。'),3.4); }
      if(s.passed.de&&s.passed.fr){ qualify('exam'); return; }
      if((!s.passed.de&&s.tries.de>=2)||(!s.passed.fr&&s.tries.fr>=2)){ s.phase='over'; (0,$imports.os)('我：带队老师把登记表收了回去。这次接待轮不到我了。',3.4); (0,$imports.gameFact)('exchange',{what:'closed'}); }
    }
    ask();
  }
  function qualify(how){
    var s=st(); s.phase='qualified'; s.how=how;
    var end=($imports.S.day-1)*1440+$imports.LIGHTS_OUT;                          /* 当天的接待外出许可：免考试、免学生会检查（Q3） */
    $imports.RT.leaveUntil=Math.max($imports.RT.leaveUntil||0,end);
    (0,$imports.gameFact)('exchange',{what:'qualified',how:how});
    (0,$imports.os)('我：带队老师递给我一张临时接待证：「今天跟着我们。别掉队。」\n（当天的考试、学生会检查都已登记豁免。）',5,$imports.OS_FORCE);
  }
  function depart(){
    var s=st(); route(); s.phase='escort'; s.prog=0; s.lag=0; s.warned=0;
    s.search=[]; var r=route();
    for(var i=0;i<C.searchers;i++){ var p=at(r.len*(0.3+0.22*i)); s.search.push({x:p.x+20*(i-1),y:p.y+15,mode:'patrol',tp:0}); }
    (0,$imports.gameFact)('exchange',{what:'depart'});
    (0,$imports.os)('广播：「全校注意，现在核对离校名单。各区域开始检查。」',4,$imports.OS_FORCE);
  }
  function fail(why){ var s=st(); s.phase='over'; s.search=[]; (0,$imports.gameFact)('exchange',{what:'lost',why:why}); (0,$imports.os)('我：队伍拐过前面的楼角，不见了。我掉队了。',3.6,$imports.OS_FORCE); }
  function succeed(){
    var s=st(); s.phase='done'; s.search=[];
    (0,$imports.gameFact)('exchange',{what:'arrived',together:!s.warned,how:s.how});
    try{ $imports.Speedrun.proof('international'); }catch(e){}
    (0,$imports.triggerEnding)('international');
  }
  /* ---------- 模拟步 ---------- */
  GameModules.on('tick',function(dt){
    if(!(dt>0)||$imports.S.dead||$imports.S.screen!=='play') return;
    var s=st(); if(!s.hit) return;
    if(s.phase==='none'&&$imports.S.day===C.day&&$imports.S.tsec>=C.from&&$imports.S.tsec<C.until&&!busy()){
      s.phase='waiting'; (0,$imports.gameFact)('exchange',{what:'arrive'});
      (0,$imports.os)('广播：「今天有一个国际交流团来访。需要会德语、法语的同学协助接待，请到行政楼北门外登记。」',5.5,$imports.OS_FORCE);
      return;
    }
    if((s.phase==='waiting'||s.phase==='qualified')&&($imports.S.day!==C.day||$imports.S.tsec>=C.until)){ s.phase='over'; return; }
    if(s.phase!=='escort') return;
    var r=route(), d=tailDist(), v=C.lead*21*dt;                 /* 带队速度：未受伤步行的 90% */
    if(d<=C.follow){ s.lag=0; s.prog=Math.min(r.len,s.prog+v); }
    else if(d<=C.warn){ s.lag=0; s.prog=Math.min(r.len,s.prog+v*C.slow); if(!s.warnCap){ s.warnCap=1; try{ $imports.SoundCaptions.publish('distant.aah',{caption:'前面 · 访客回头招手'}); }catch(e){} } }
    else{ s.lag+=dt; s.warned=1; if(s.lag>=C.grace){ fail('lag'); return; } if(s.lag<dt*1.5) (0,$imports.os)('我：队伍在前面停了一下，有人回头找我。',2.4,$imports.OS_FORCE); }
    if(d<=C.follow) s.warnCap=0;
    if(s.prog>=r.len&&d<=C.follow){ succeed(); return; }
    searchTick(dt,d<=C.follow);
  },own);
  function searchTick(dt,withGroup){
    var s=st(); if(!s.search) return;
    var me=$imports.S.mode==='out'?$imports.PatrolNav.point('out',$imports.S.x,$imports.S.y,0):null;
    s.search.forEach(function(h,i){
      h.tp+=dt;
      var d=me?Math.hypot(h.x-$imports.S.x,h.y-$imports.S.y)*$imports.U2M:Infinity;
      var sees=false; try{ sees=!!me&&d<=C.seeRange&&$imports.PatrolNav.los($imports.PatrolNav.point('out',h.x,h.y,0),me); }catch(e){}
      if(sees&&!withGroup){ h.mode='chase'; }
      else if(withGroup&&h.mode==='chase'){ h.mode='patrol'; }
      if(h.mode==='chase'&&me){
        var a=Math.atan2($imports.S.y-h.y,$imports.S.x-h.x), step=C.chase*dt; h.x+=Math.cos(a)*step; h.y+=Math.sin(a)*step;
        if(Math.hypot(h.x-$imports.S.x,h.y-$imports.S.y)*$imports.U2M<C.catchR){ s.search=[]; (0,$imports.kill)('搜查员看了看名单，又看了看我。名单上没有我。','grip','search'); }
        return;
      }
      /* 巡查：在队伍前方的路线附近来回走；看不见的时候可能瞬移到更前面（Q8：概率瞬移） */
      var target=at(s.prog+(40+i*35)/$imports.U2M); var a2=Math.atan2(target.y-h.y,target.x-h.x), dd=Math.hypot(target.y-h.y,target.x-h.x);
      if(dd>4){ var st2=Math.min(dd,16*dt); h.x+=Math.cos(a2)*st2; h.y+=Math.sin(a2)*st2; }
      if(h.tp>=C.tpEvery){ h.tp=0; if($imports.GameRandom.next()<C.tpChance&&!sees){ var p=at(s.prog+(60+i*30)/$imports.U2M); h.x=p.x+18; h.y=p.y; } }
    });
  }
  /* 隐藏天赋的成就到本局结算（结局或死亡）才记，抽中那一刻不揭底（第 11.1 节） */
  GameModules.on('gameFact',function(f){
    if(!f||!(f.kind==='death'&&!f.wake||f.kind==='ending')) return;
    var w=false; try{ w=typeof $imports.WudaKid!=='undefined'&&$imports.WudaKid.active(); }catch(e){}
    if(multi()) (0,$imports.gameFact)('exchange',{what:'settle',multilingual:true,wuda:w});
  },own);
  return {CFG:C, EXAM:EXAM, state:st, multi:multi, route:route, at:at, members:members, tailDist:tailDist, qualify:qualify, depart:depart, exam:exam, nearLeader:nearLeader};
})();

/* @module-exports */
GameModules.publish("game3d/js/modules/exchange/exchange.js",{
"EXCHANGE_CFG":{get:function(){return EXCHANGE_CFG;},set:function($value){EXCHANGE_CFG=$value;}},
"EXAM":{get:function(){return EXAM;},set:function($value){EXAM=$value;}},
"Exchange":{get:function(){return Exchange;},set:function($value){Exchange=$value;}}
});
})(GameModules.imports("game3d/js/modules/exchange/exchange.js"));
