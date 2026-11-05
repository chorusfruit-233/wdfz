/* @module-capsule */
(function($imports){
/* 里世界 3D · 死亡档案室（2026-11-03 起界面上叫「CG 档案馆」：死亡、结局与开场、结算画面三节；代码里的名字不变）
   每一种真实死因第一次发生时，永久解锁一份档案；同一种再死只记次数，不再多解锁。
   - 稳定 ID 按真实死因（kill 的 source）定，不按演出：同样用「伸手」演出的巡察者、车库黑影、车门、驾驶是四份不同的档案；
     没有 source 的（假正常里笑出声、三条看着像出口的「主意」）在 story.js 里补了明确的 source。
   - 只有 kill() 通过了救命药丸、天生免疫、调试无敌之后、真正进入死亡分支时才解锁；
     调试面板开着（含 Dev.death）、档案室回放、演出预览都不算。预知梦第一天死了会惊醒，也算真实经历过。
   - 独立存储 wdfz3d_death_archive_v1，不跟存档、结局记录一起删；旧的 wdfz3d_deaths 只迁入有明确死因来源的记录，
     来源不明的（可能来自调试面板）只记一个「待核验」数，不解锁。
   - 回放在主菜单里用隔离的舞台播：不走 kill()、不存档、不写死亡日志，结束后回到菜单。 */
'use strict';

var DEATH_ARCHIVE_KEY='wdfz3d_death_archive_v1';
/* 注册表：死因 ID → 演出 → 档案标题、一句记录 → 回放舞台。secret:1 的条目在解锁前完全不出现，也不算进「已记录 x / y」的总数
   （目前是虚空迷宫里的两种死法，演出由 void-maze 模块用 DeathCG.register 提供，回放舞台就是迷宫；和电梯里的「满员」，演出由 lift-crowd 模块提供）。
   ext:1 表示演出由模块注册：模块拿掉了，这一份就不列出（见 DeathArchive.avail）。 */
var DEATH_ARCHIVE=[
  {id:'misread',fx:'misread',n:'念错了',d:'第二行开始，喇叭里已经不是我的声音。播音中的红灯熄了。',stage:'admin2',ext:1},
  {id:'patrol',       fx:'grip',     n:'点名',         d:'灯按拍子闪的时候，它就在这一层。一只手从后面按住了我的头顶。', stage:'teach1'},
  {id:'garage',       fx:'grip',     n:'车道中间',     d:'车库里没有灯。它一直站在车道中间，等我自己走过去。', stage:'garage1'},
  {id:'car_entry',    fx:'grip',     n:'后座',         d:'我拉开了车门。后视镜里，它就弯着腰站在后座上。', stage:'garage1'},
  {id:'car_chase',    fx:'grip',     n:'没开出去',     d:'路障、岔路、追上来的东西——那辆车没能开出这所学校。', stage:'out'},
  {id:'san',          fx:'vignette', n:'那根弦',       d:'理智耗尽。一圈没有脸的高个子，从暗处一个接一个走出来。', stage:'teach1'},
  {id:'assimilation', fx:'names',    n:'合身的椅子',   d:'我在自己的位子上坐好了。这一次，不用再起来了。', stage:'teach1'},
  {id:'trash',        fx:'trash',    n:'桶盖',         d:'桶盖合上了。外面有人敲了两下，像在确认里面有没有人。', stage:'trash1'},
  {id:'liftdoor',     fx:'liftdoor', n:'没关上的门',   d:'门只剩一掌宽的时候，四根手指伸了进来。楼层灯停在这一层，门合上，轿厢里没有人。', stage:'teach2'},
  {id:'an:rain',      fx:'drown',    n:'雨',           d:'雨灌进了肺里。我听见自己在身体里晃。', stage:'out'},
  {id:'an:moth',      fx:'swarm',    n:'蛾群',         d:'翅膀上的粉落进眼睛里，很痒。然后什么都不痒了。', stage:'out'},
  {id:'an:exercise',  fx:'follow',   n:'课间操',       d:'我开始跟着做操。手臂抬起来的时候才发现，早就停不下来了。', stage:'out'},
  {id:'an:rite',      fx:'ring',     n:'粉笔圈',       d:'圈正中那个空着的位置，刚好是我的大小。', stage:'lab1'},
  {id:'an:necker',    fx:'neck',     n:'围栏的缝',     d:'他没有绕到校门口。他把脖子从围栏的缝里伸了进来。', stage:'out'},
  {id:'an:twin',      fx:'twin',     n:'天台的另一头', d:'他走到了我面前。我们同时抬起手。他的手是热的。', stage:'teach6'},
  {id:'an:cup',       fx:'floor',    n:'窗台上的杯子', d:'一只白色的杯子，画着二校门。它比我想象的要重。', stage:'out'},
  {id:'mirror',       fx:'mirror',   n:'镜子',         d:'镜子里那个人先抬起了手。我还看着它，看了很久。', stage:'teach1'},
  {id:'laugh',        fx:'laugh',    n:'笑出了声',     d:'灯前看字字如旧。我笑得停不下来，笑了很久。', stage:'teach1'},
  {id:'trap_out',     fx:'slit',     n:'正门',         d:'我从门缝里挤了出去。路的尽头还是一扇校门。', stage:'out'},
  {id:'trap_wall',    fx:'squeeze',  n:'墙外的墙',     d:'墙外面还有一道墙。我一直翻，翻到手指不再是手指的形状。', stage:'out'},
  {id:'trap_beg',     fx:'face',     n:'路过的人',     d:'他慢慢转过头——没有脸，只有一个很大的、在笑的洞。', stage:'out'},
  {id:'void_lost',    fx:'void',     n:'哪一扇门',     d:'白墙上的门一扇扇裂开、亮起来，又一格一格暗下去。我想不起自己是从哪一扇进来的。', stage:'lift_dream', secret:1, ext:1},
  {id:'crowd',        fx:'crowd',    n:'满员',         d:'门合上，蜂鸣停了。肩膀上搭上来的手越来越多，楼层灯一路往上跳。门再打开时，轿厢里只有一张学生证。', stage:'teach2', secret:1, ext:1},
  {id:'void_fall',    fx:'abyss',    n:'往下',         d:'我一直往下掉。下面那块画着斜线的白色方地上站着一个人，抬起手电照我。', stage:'lift_dream', secret:1, ext:1}
];
var DEATH_ARCHIVE_BY_ID={};
DEATH_ARCHIVE.forEach(function(e,i){ e.no=i+1; DEATH_ARCHIVE_BY_ID[e.id]=e; });
/* 结局与开场的演出（2026-11-03）：达成过的结局、看过的开场也收在档案室里，可以重看。
   cut 是过场 ID（CUT_DEF 的键）；解锁看真实记录——结局看 endsSeen()（「已见结局」那份），开场看 proSeen()——
   或者「全部解锁」。《先辈》是隐藏结局，标 secret：没达成过（也没全部解锁）就完全不出现。
   stage：回放前先进的场景（演出自己切室外舞台的，用教学楼一楼当底）；at：站在场景的哪一格、朝哪（《闸门》站在两排车之间的车道上朝西，
   车灯顺着车道照出去——真实结局里是玩家站在车旁的位置和朝向）；hour：回放时的天色（VisualState.stageHour，只影响画面，不改 S.tsec），
   开场固定在新局开始的 11:40（第四节），不跟着菜单里残留的上一局时刻变成夜里 */
var ARCHIVE_CUTS=[
  {id:'cut:opening', cut:'opening',            n:'开场 · 第四节', d:'粉笔灰停在半空，你趴到桌上。再睁开眼，教室里坐满了人，没有一个人在呼吸。', stage:'teach1', hour:700/60},
  {id:'end:car',     cut:'car',     end:'car',    n:'《闸门》',     d:'车灯闪了两下，光里站着它。冲出北门回头，黑影从门里追了出来。', stage:'garage1', at:{c:44.5,r:6.5,ang:Math.PI}},
  {id:'end:face',    cut:'face',    end:'face',   n:'《白名单》',   d:'闸机的红灯「嘀」地变白。走出门回头，门里一个接一个站满了目送的人。', stage:'teach1'},
  {id:'end:portal',  cut:'portal',  end:'portal', n:'《门》',       d:'导轨一段段闭合，光圈撑开。退了半步，然后走了进去。', stage:'lab1'},
  {id:'end:cyber',   cut:'cyber',   end:'cyber',  n:'《网安仙人》', d:'机柜一架架熄灭，走廊里的高个子不再动。档案对照完，天亮了。', stage:'teach1'},
  {id:'end:dismissal',cut:'dismissal',end:'dismissal',n:'《放学》',d:'几十把椅子同时挪开，长铃里的人流从北门离校。登记簿上写着：放学 · 全体。',stage:'teach1'},
  {id:'end:beast',   cut:'beast',   end:'beast',  n:'《先辈》',     d:'隔间的门缝里漏出光。穿旧校服的人看了你一眼就往外跑，你跟了出去，学校有了颜色。', stage:'teach1', secret:1},
  /* 异色空间的进出过场（内部，2026-11-04）：演出由 void-maze 模块的 maze-cut.js 注册；解锁看 seen 记录（DeathArchive.markSeen），
     没经历过完全不出现、不计数；回放舞台都是迷宫（离开那段在白场时自己换到教学楼二楼的电梯厅） */
  {id:'cut:void_in', cut:'void_in', seen:1, n:'不存在的那一层', d:'楼层显示跳成一个不认识的符号，灯一排排灭了。门开，外面什么都没有，只有一块方地浮着。', stage:'lift_dream', secret:1},
  {id:'cut:void_out',cut:'void_out',seen:1, n:'回来',         d:'门缝里的蓝光涌进来，白色一点点退开。回头，是一扇普通的电梯门，指示灯一格一格暗了。', stage:'lift_dream', secret:1}
];
ARCHIVE_CUTS.forEach(function(e,i){ e.no=i+1; });
/* 档案室里全部条目（死亡 + 演出），按 ID 查 */
var ARCHIVE_BY_ID={};
DEATH_ARCHIVE.concat(ARCHIVE_CUTS).forEach(function(e){ ARCHIVE_BY_ID[e.id]=e; });
/* 模块登记进来的节（2026-11-03，例如通关记录模块的「结算画面」）：
   {id, title, ids(), isOpen(id,d), count(d), cards(d), replay(id)}；条目 ID 用 x. 开头，「全部解锁」同样写 granted。
   模块拿掉时这一节不出现，档案馆其余部分照常 */
var ARCHIVE_SECTIONS=[];
/* 回放舞台：户外用操场边一块空地，室内用各房间的默认入口 */
var DEATH_STAGE_OUT={x:1580,y:1800,ang:-$imports.PI/2};
/* 当前这次 kill 的来源：调试面板的「实际死亡」把它设成 debug */
var KILL_CTX=null;

var DeathArchive={
  /* granted：「全部解锁」直接打开的条目（死亡和演出都记在这里），和真的经历过分开：不计次数、不算「新记录」、不写结局记录 */
  blank:function(){ return {version:1,unlocked:{},first:{},count:{},legacy:{},granted:{},seen:{},pending:0,migrated:0}; },
  read:function(){
    var d=null;
    try{ d=JSON.parse(localStorage.getItem(DEATH_ARCHIVE_KEY)||'null'); }catch(e){ d=null; }
    var out=DeathArchive.blank();
    if(!d||typeof d!=='object'||d.version!==1) return out;
    ['unlocked','first','count','legacy'].forEach(function(k){
      var src=d[k]; if(!src||typeof src!=='object') return;
      Object.keys(src).forEach(function(id){ if(DEATH_ARCHIVE_BY_ID[id]) out[k][id]=src[id]; });   /* 未知 ID 丢掉，不改成别的死法 */
    });
    if(d.granted&&typeof d.granted==='object') Object.keys(d.granted).forEach(function(id){ if((ARCHIVE_BY_ID[id]||/^x\.[A-Za-z0-9_.-]{1,40}$/.test(id))&&d.granted[id]) out.granted[id]=1; });
    if(d.seen&&typeof d.seen==='object') Object.keys(d.seen).forEach(function(id){ var e=ARCHIVE_BY_ID[id]; if(e&&e.seen&&d.seen[id]) out.seen[id]=1; });
    out.pending=Number.isFinite(d.pending)?Math.max(0,d.pending|0):0;
    out.migrated=d.migrated?1:0;
    return out;
  },
  write:function(d){ try{ localStorage.setItem(DEATH_ARCHIVE_KEY,JSON.stringify(d)); return true; }catch(e){ return false; } },
  /* kill() 的 source（或演出）→ 档案 ID；不认识的返回 null */
  idFor:function(source,fx){
    if(source&&DEATH_ARCHIVE_BY_ID[source]) return source;
    if(!source&&fx==='laugh') return 'laugh';
    return null;
  },
  /* 由 kill() 在保命判定之后调用。返回新解锁的条目（已解锁过返回 null） */
  record:function(source,fx){
    if(KILL_CTX==='debug'||(typeof $imports.DEV!=='undefined'&&$imports.DEV.on)||(typeof ArchiveReplay!=='undefined'&&ArchiveReplay.on)) return null;
    var id=DeathArchive.idFor(source,fx); if(!id) return null;
    var d=DeathArchive.migrate(DeathArchive.read()), fresh=!d.unlocked[id];
    d.count[id]=(d.count[id]||0)+1;
    if(fresh){ d.unlocked[id]=true; d.first[id]=Date.now(); }
    DeathArchive.write(d);
    return fresh?DEATH_ARCHIVE_BY_ID[id]:null;
  },
  /* 旧死亡日志：只迁有明确来源的；只做一次 */
  migrate:function(d){
    if(d.migrated) return d;
    var old=null;
    try{ old=JSON.parse(localStorage.getItem('wdfz3d_deaths')||'null'); }catch(e){ old=null; }
    d.migrated=1;
    if(!old||typeof old!=='object') return d;
    var src=(old.sources&&typeof old.sources==='object')?old.sources:{}, known=0;
    Object.keys(src).forEach(function(s){
      var n=src[s]|0; if(n<=0) return;
      if(DEATH_ARCHIVE_BY_ID[s]){ known+=n; if(!d.unlocked[s]){ d.unlocked[s]=true; d.legacy[s]=1; } d.count[s]=Math.max(d.count[s]||0,n); }
    });
    var total=0, c=(old.counts&&typeof old.counts==='object')?old.counts:{};
    Object.keys(c).forEach(function(k){ total+=Math.max(0,c[k]|0); });
    d.pending=Math.max(0,total-known);           /* 来源不明（可能是调试面板）的旧记录：只计数，不解锁 */
    return d;
  },
  state:function(){ var d=DeathArchive.migrate(DeathArchive.read()); DeathArchive.write(d); return d; },
  /* 这一份档案打开了没有：真的经历过（死亡记录、达成的结局、看过的开场），或者「全部解锁」过 */
  real:function(e,d){
    if(e.cut) return e.seen?!!(d&&d.seen&&d.seen[e.id]):(e.end?!!(0,$imports.endsSeen)()[e.end]:(0,$imports.proSeen)());
    return !!d.unlocked[e.id];
  },
  isOpen:function(e,d){ d=d||DeathArchive.state(); return !!d.granted[e.id]||DeathArchive.real(e,d); },
  /* 这一份的演出现在有没有：结局 / 开场看过场在不在（《网安仙人》由 campus-network 模块登记），
     ext 的死法看 DeathCG 里注册了没有（迷宫两种死法由 void-maze 模块注册）。模块拿掉了，这一份就不列出、不计数、「全部解锁」也不开 */
  avail:function(e){
    if(e.cut) return typeof $imports.CUT_DEF!=='undefined'&&!!$imports.CUT_DEF[e.cut];
    if(e.ext) return typeof $imports.DeathCG!=='undefined'&&$imports.DeathCG.has(e.fx);
    return true;
  },
  /* 玩家能看到的条目：打开了的全部，加上没打开的公开条目（只显示「尚未记录」）；演出不在的不列 */
  visible:function(d){ d=d||DeathArchive.state(); return DEATH_ARCHIVE.filter(function(e){ return DeathArchive.avail(e)&&(DeathArchive.isOpen(e,d)||!e.secret); }); },
  visibleCuts:function(d){ d=d||DeathArchive.state(); return ARCHIVE_CUTS.filter(function(e){ return DeathArchive.avail(e)&&(DeathArchive.isOpen(e,d)||!e.secret); }); },
  /* 「全部解锁」能打开的：演出在、还没打开的 */
  locked:function(d){
    var out=DEATH_ARCHIVE.concat(ARCHIVE_CUTS).filter(function(e){ return DeathArchive.avail(e)&&!DeathArchive.isOpen(e,d); });
    ARCHIVE_SECTIONS.forEach(function(sec){ sec.ids().forEach(function(id){ if(!sec.isOpen(id,d)) out.push({id:id}); }); });
    return out;
  },
  addSection:function(def){
    if(!def||!def.id||typeof def.cards!=='function'||typeof def.ids!=='function'||typeof def.isOpen!=='function') return false;
    ARCHIVE_SECTIONS=ARCHIVE_SECTIONS.filter(function(s){ return s.id!==def.id; }); ARCHIVE_SECTIONS.push(def); return true;
  },
  /* 「全部解锁」：死亡和演出（包括隐藏的）全部打开，只记在 granted 里。
     要先在页面里画的数字键盘上输调试密码（和调试面板同一个），普通游玩里不会被随手点开，隐藏内容不会因此泄露 */
  askUnlockAll:function(){
    if(typeof $imports.DevLock==='undefined') return false;
    var btn=document.getElementById('arAll');
    return $imports.DevLock.ask({title:'输入调试密码 · 解锁全部 CG',onOk:DeathArchive.unlockAll,
      onCancel:function(){ if(btn) btn.focus({preventScroll:true}); }});
  },
  unlockAll:function(){
    var d=DeathArchive.state(), left=DeathArchive.locked(d), n=left.length;
    left.forEach(function(e){ d.granted[e.id]=1; });
    DeathArchive.write(d); DeathArchive.paint();
    try{ (0,$imports.toast)(n?'已解锁全部 CG（直接解锁 '+n+' 份，不计经历次数）':'全部 CG 都已经解锁了'); }catch(e){}
    var first=document.querySelector('#arcuts .arcard.open button')||document.getElementById('arBack');
    if(first) first.focus({preventScroll:true});
    return n;
  },
  /* 过场看过了（异色空间进出这类只在游玩中出现一次的演出）：记进 seen；档案室回放不算。返回是不是第一次 */
  markSeen:function(id){
    var e=ARCHIVE_BY_ID[id]; if(!e||!e.seen) return false;
    if(typeof ArchiveReplay!=='undefined'&&ArchiveReplay.on) return false;
    var d=DeathArchive.state(); if(d.seen[id]) return false;
    d.seen[id]=1; DeathArchive.write(d); return true;
  },
  /* 死亡演出放完以后提示一次（不在致死那一刻打断） */
  notify:function(entry){
    if(!entry) return;
    try{ (0,$imports.toast)('CG 档案馆 · 新的死亡档案：'+entry.n); }catch(e){}
  },

  /* ---------- 菜单里的档案室 ---------- */
  open:function(){
    var el=document.getElementById('archive'); if(!el) return;
    DeathArchive.paint(); el.hidden=false;
    try{ (0,$imports.resetInputState)(); (0,$imports.releaseMouseLook)(); }catch(e){}
    var first=el.querySelector('.arcard.open button')||document.getElementById('arBack');
    if(first) first.focus({preventScroll:true});
  },
  close:function(){
    var el=document.getElementById('archive'); if(el) el.hidden=true;
    var b=document.getElementById('btnarchive'); if(b) b.focus({preventScroll:true});
  },
  /* 一张卡：打开的有标题、一句记录、说明和「重看」；没打开的只显示封存 */
  card:function(e,open,meta,latest,locked,onReplay){
    var card=document.createElement('div');
    card.className='arcard'+(open?' open':'')+(latest?' latest':'');
    card.dataset.id=e.id;
    var no=document.createElement('em'); no.textContent=('0'+e.no).slice(-2); card.appendChild(no);
    var body=document.createElement('span'), t=document.createElement('b'), p=document.createElement('i');
    if(open){
      t.textContent=e.n; p.textContent=e.d;
      var m=document.createElement('small'); m.textContent=meta;
      body.appendChild(t); body.appendChild(p); body.appendChild(m); card.appendChild(body);
      var btn=document.createElement('button'); btn.type='button'; btn.textContent='重看';
      btn.addEventListener('click',function(){ if(onReplay) onReplay(e.id); else ArchiveReplay.play(e.id); });
      card.appendChild(btn);
    }else{
      t.textContent=locked[0]; p.textContent=locked[1]; body.appendChild(t); body.appendChild(p); card.appendChild(body);
    }
    return card;
  },
  /* 「已记录 x / 公开总数」，打开过的隐藏条目另记「隐藏 n」，不把公开的总数撑破 */
  countText:function(list,d,word){
    var pub=list.filter(function(e){ return !e.secret; }), got=pub.filter(function(e){ return DeathArchive.isOpen(e,d); }).length;
    var hid=list.length-pub.length;
    return word+' '+got+' / '+pub.length+(hid?' · 隐藏 '+hid:'');
  },
  paint:function(){
    var d=DeathArchive.state(), list=DeathArchive.visible(d), cuts=DeathArchive.visibleCuts(d);
    var head=document.getElementById('arCount');
    if(head) head.textContent=DeathArchive.countText(list,d,'已记录');
    var ch=document.getElementById('arCutCount');
    if(ch) ch.textContent=DeathArchive.countText(cuts,d,'已解锁');
    var note=document.getElementById('arNote');
    if(note) note.textContent=d.pending?('另有 '+d.pending+' 条旧版本的死亡记录来源不明，没有计入。'):'';
    var all=document.getElementById('arAll');
    if(all){ var left=DeathArchive.locked(d).length>0; all.disabled=!left; all.textContent=left?'全部解锁':'已全部解锁'; }
    var box=document.getElementById('arcards'); if(!box) return;
    box.textContent='';
    var latest=null;
    Object.keys(d.first).forEach(function(id){ if(!latest||d.first[id]>d.first[latest]) latest=id; });
    list.forEach(function(e){
      var real=DeathArchive.real(e,d), open=real||!!d.granted[e.id];
      var meta=real?(d.legacy[e.id]?'旧版本记录':'经历 '+(d.count[e.id]||1)+' 次')+(e.id===latest?' · 最近':''):'直接解锁 · 没有亲历';
      box.appendChild(DeathArchive.card(e,open,meta,real&&e.id===latest,['尚未记录','封存的档案。']));
    });
    var cb=document.getElementById('arcuts'); if(!cb) return;
    cb.textContent='';
    cuts.forEach(function(e){
      var real=DeathArchive.real(e,d), open=real||!!d.granted[e.id];
      var meta=real?(e.end?'已达成':'已看过'):'直接解锁 · 没有亲历';
      cb.appendChild(DeathArchive.card(e,open,meta,false,e.end?['尚未达成','封存的结局。']:['尚未观看','封存的演出。']));
    });
    var ex=document.getElementById('arextra'); if(!ex) return;
    ex.textContent='';
    ARCHIVE_SECTIONS.forEach(function(sec){
      var h=document.createElement('div'); h.className='arsec'; h.dataset.sec=sec.id;
      var hb=document.createElement('b'), hi=document.createElement('i'); hb.textContent=sec.title; hi.textContent=sec.count(d); h.appendChild(hb); h.appendChild(hi);
      var box=document.createElement('div'); box.className='arcards'; box.id='arsec-'+sec.id;
      sec.cards(d).forEach(function(c){ box.appendChild(DeathArchive.card(c,c.open,c.meta,false,c.locked||['尚未取得','封存的画面。'],sec.replay)); });
      ex.appendChild(h); ex.appendChild(box);
    });
  }
};

/* ---------- 回放：隔离的演出舞台 ----------
   只在主菜单里播。把人放到示范位置、搭好场景，然后用预览模式播放同一份死亡演出（镜头由演出接管），
   世界不更新（S.screen='replay'），不调用 kill / 存档 / 死亡日志；结束、跳过、出错都回到菜单。 */
var ArchiveReplay={on:false,id:null,timer:0,wait:0,snap:null,t0:0,cut:null,
  play:function(id){
    var e=ARCHIVE_BY_ID[id], d=DeathArchive.state();
    if(!e||!DeathArchive.avail(e)||!DeathArchive.isOpen(e,d)||ArchiveReplay.on) return false;
    if($imports.S.screen!=='menu') return false;
    ArchiveReplay.on=true; ArchiveReplay.id=id; ArchiveReplay.t0=performance.now();
    ArchiveReplay.snap={mode:$imports.S.mode,room:$imports.S.room,x:$imports.S.x,y:$imports.S.y,ang:$imports.S.ang,pitch:$imports.S.pitch,seated:$imports.S.seated,tsec:$imports.S.tsec,day:$imports.S.day};
    document.getElementById('archive').hidden=true;
    document.getElementById('menu').style.display='none';
    document.body.classList.add('cut','replaying');
    var cap=document.getElementById('arReplay');
    if(cap){ cap.hidden=false; cap.querySelector('b').textContent=e.n; cap.querySelector('i').textContent=e.cut?(e.end?'结局档案 · 回放':(e.seen?'过场 · 回放':'开场 · 回放')):'死亡档案 · 回放'; }
    $imports.S.screen='replay'; $imports.S.dead=false; $imports.S.death=null; $imports.S.seated=false; $imports.S.pitch=0; $imports.S.eyeLift=0;
    if(e.hour!==undefined) $imports.VisualState.stageHour=e.hour;          /* 先定天色再搭场景：窗光、灯这些按搭建时的时刻 */
    try{
      if(e.stage==='out'){
        $imports.S.x=DEATH_STAGE_OUT.x; $imports.S.y=DEATH_STAGE_OUT.y; $imports.S.ang=DEATH_STAGE_OUT.ang;
        if($imports.S.mode!=='out'||!$imports.GLR.outMesh){ $imports.S.mode='out'; $imports.S.room=null; (0,$imports.enterWorldOut)(); }
      }else if(e.at){ var R=$imports.INTERIORS[e.stage]; (0,$imports.doEnterRoom)(e.stage,{x:R.ox+e.at.c*R.tw,y:R.oy+e.at.r*R.th,ang:e.at.ang}); }
      else (0,$imports.doEnterRoom)(e.stage);
    }catch(err){ ArchiveReplay.stop(); return false; }
    $imports.running=true;
    ArchiveReplay.wait=setInterval(function(){
      var ready=($imports.S.mode==='out'?!!$imports.GLR.outMesh:($imports.GLR.roomMesh&&$imports.GLR.roomMesh.userData.roomData===$imports.INTERIORS[$imports.S.room]));
      if(!ArchiveReplay.on){ clearInterval(ArchiveReplay.wait); return; }
      if(!ready&&performance.now()-ArchiveReplay.t0<15000) return;
      clearInterval(ArchiveReplay.wait); ArchiveReplay.wait=0;
      if(!ready){ ArchiveReplay.stop(); try{ (0,$imports.toast)('档案读取失败，请稍后再试'); }catch(_e){} return; }
      ArchiveReplay.start(e);
    },60);
    return true;
  },
  start:function(e){
    if(e.cut) return ArchiveReplay.startCut(e);
    $imports.S.screen='replay'; $imports.S.seated=false; $imports.S.pitch=0;
    try{ (0,$imports.syncCamera)(0); }catch(err){}
    try{ (0,$imports.deathFX)(e.fx,{preview:true}); }catch(err){}
    try{ $imports.SFX.resume(); $imports.SFX.deathFx(e.fx); }catch(err){}
    /* 按演出自己的进度收尾（低帧率时演出走得比墙上时钟慢，不能按墙钟截断）；墙钟只做一个宽松的上限 */
    var sec=Math.max(3.5,$imports.DeathTimeline.duration(e.fx)+0.6), w0=performance.now();
    ArchiveReplay.timer=setInterval(function(){
      if($imports.ANFX.kind!=='death'||$imports.ANFX.t>=sec||performance.now()-w0>sec*4000) ArchiveReplay.stop();
    },100);
  },
  /* 结局和开场：用正式的过场（同一份 CUT_DEF）在这个舞台上播，完成回调只回档案室——不出结局卡、不记结局、不清存档、不停速通表。
     过场期间 S.screen 是 'cut'，点击 / 空格 / 回车 / Esc 走过场自己的跳过 */
  startCut:function(e){
    if(typeof $imports.CUT_DEF==='undefined'||!$imports.CUT_DEF[e.cut]){ ArchiveReplay.stop(); return; }
    ArchiveReplay.cut={enabled:$imports.CUT.enabled,dur:$imports.CUT_DEF.opening?$imports.CUT_DEF.opening.dur:null,short:typeof $imports.Opening!=='undefined'?$imports.Opening.short:false};
    $imports.CUT.enabled=true;
    if(e.cut==='opening'&&typeof $imports.Opening!=='undefined'){                /* 档案里看完整版；同学先换回正常的样子，演到第四段再褪成里世界 */
      $imports.Opening.short=false; $imports.CUT_DEF.opening.dur=$imports.OPENING_DUR.full;
      try{ (0,$imports.ncRestore)(); }catch(err){}
    }
    try{ $imports.SFX.resume(); }catch(err){}
    try{ (0,$imports.syncCamera)(0); }catch(err){}
    (0,$imports.playCut)(e.cut,function(){ ArchiveReplay.stop(); });
  },
  skip:function(){
    if(!ArchiveReplay.on) return false;
    if(performance.now()-ArchiveReplay.t0<400) return true;      /* 刚点开的那一下不算跳过 */
    ArchiveReplay.stop(); return true;
  },
  stop:function(){
    if(!ArchiveReplay.on) return;
    clearInterval(ArchiveReplay.timer); clearInterval(ArchiveReplay.wait); ArchiveReplay.timer=0; ArchiveReplay.wait=0;
    ArchiveReplay.on=false;
    if(typeof $imports.CUT!=='undefined'&&$imports.CUT.on){ $imports.CUT.done=null; (0,$imports.cutFinish)(); }    /* 结局 / 开场回放中途结束：先收掉过场（完成回调已摘掉，不会再进来） */
    var c=ArchiveReplay.cut; ArchiveReplay.cut=null;
    var ent=ARCHIVE_BY_ID[ArchiveReplay.id];
    if(ent&&ent.hour!==undefined) $imports.VisualState.stageHour=null;         /* 回放指定的天色收回（场景没搭好就结束时也收） */
    if(c){
      $imports.CUT.enabled=c.enabled;
      if(c.dur!==null&&$imports.CUT_DEF.opening) $imports.CUT_DEF.opening.dur=c.dur;
      if(typeof $imports.Opening!=='undefined') $imports.Opening.short=c.short;
      try{ (0,$imports.openingCap)(''); }catch(e){}
      try{ $imports.SoundPlayer.stop('scene'); }catch(e){}                     /* 点火、充能这些演出声音跟着收掉，不带回档案室 */
    }
    try{ if($imports.ANFX.kind==='death') (0,$imports.anfxClear)(); }catch(e){}
    try{ $imports.SFX.stopDeath&&$imports.SFX.stopDeath(); }catch(e){}
    $imports.GLR.flash=0; $imports.GLR.hurt=0; $imports.VisualState.flash=0; $imports.VisualState.hurt=0;
    var s=ArchiveReplay.snap; ArchiveReplay.snap=null;
    if(s){ $imports.S.ang=s.ang; $imports.S.pitch=s.pitch; $imports.S.seated=s.seated; $imports.S.tsec=s.tsec; $imports.S.day=s.day; }
    $imports.S.dead=false; $imports.S.death=null; $imports.S.eyeLift=0;
    $imports.S.screen='menu';
    document.body.classList.remove('cut','replaying');
    var cap=document.getElementById('arReplay'); if(cap) cap.hidden=true;
    document.getElementById('menu').style.display='block';
    var el=document.getElementById('archive'); if(el){ DeathArchive.paint(); el.hidden=false; }
    ArchiveReplay.refocus();
    try{ (0,$imports.syncCamera)(0); }catch(e){}
  },
  /* 焦点回到刚重看的那张卡的「重看」上 */
  refocus:function(){
    var again=document.querySelector('#archive .arcard[data-id="'+(ArchiveReplay.id||'')+'"] button');
    if(again) again.focus({preventScroll:true});
  }
};
document.addEventListener('keydown',function(ev){
  if(typeof $imports.DevLock!=='undefined'&&$imports.DevLock.on) return;            /* 「全部解锁」的密码键盘开着：按键给键盘（Esc 只关键盘，不关档案室） */
  if(ArchiveReplay.on&&ArchiveReplay.cut) return;                  /* 结局 / 开场回放：按键走过场自己的跳过 */
  if(ArchiveReplay.on){
    if(ev.key===' '||ev.key==='Enter'||ev.key==='Escape'){ ev.preventDefault(); ev.stopPropagation(); ArchiveReplay.skip(); }
    return;
  }
  var el=document.getElementById('archive');
  if(el&&!el.hidden&&ev.key==='Escape'){ ev.preventDefault(); ev.stopPropagation(); DeathArchive.close(); }
},true);
/* 点击 / 触摸结束回放由 input.js 处理（和跳过结局演出一样，吞掉松指后补发的 click，免得点到随后出现的「重看」）。
   那边只管触屏：鼠标按下的那一刻回放就结束、档案室回来了，松开时的 click 会落在档案室的卡片上（正好是另一张「重看」就又开一段）。
   这里在 input.js 之前（脚本加载时就注册）记下「这次按下发生在回放里」，随后那一下 click 吞掉 */
window.addEventListener('pointerdown',function(){ ArchiveReplay.eat=ArchiveReplay.on; },{capture:true,passive:true});
window.addEventListener('keydown',function(){ ArchiveReplay.eat=false; },{capture:true,passive:true});   /* 拖动没产生 click 时，之后用回车 / 空格按出来的 click 不能被误吞 */
document.addEventListener('click',function(ev){
  if(!ArchiveReplay.eat||!ev.isTrusted) return;
  ArchiveReplay.eat=false;
  if(!ArchiveReplay.on){ ev.preventDefault(); ev.stopImmediatePropagation(); ArchiveReplay.refocus(); }   /* 按下那一刻焦点可能跟着落到下面的卡上，放回来 */
},true);
/* 启动时先把旧死亡日志迁一次：之后新写进旧日志的死亡不会被当成「旧版本记录」 */
try{ DeathArchive.state(); }catch(e){}

/* @module-exports */
GameModules.publish("game3d/js/death-archive.js",{
"DEATH_ARCHIVE_KEY":{get:function(){return DEATH_ARCHIVE_KEY;},set:function($value){DEATH_ARCHIVE_KEY=$value;}},
"DEATH_ARCHIVE":{get:function(){return DEATH_ARCHIVE;},set:function($value){DEATH_ARCHIVE=$value;}},
"DEATH_ARCHIVE_BY_ID":{get:function(){return DEATH_ARCHIVE_BY_ID;},set:function($value){DEATH_ARCHIVE_BY_ID=$value;}},
"ARCHIVE_CUTS":{get:function(){return ARCHIVE_CUTS;},set:function($value){ARCHIVE_CUTS=$value;}},
"ARCHIVE_BY_ID":{get:function(){return ARCHIVE_BY_ID;},set:function($value){ARCHIVE_BY_ID=$value;}},
"ARCHIVE_SECTIONS":{get:function(){return ARCHIVE_SECTIONS;},set:function($value){ARCHIVE_SECTIONS=$value;}},
"DEATH_STAGE_OUT":{get:function(){return DEATH_STAGE_OUT;},set:function($value){DEATH_STAGE_OUT=$value;}},
"KILL_CTX":{get:function(){return KILL_CTX;},set:function($value){KILL_CTX=$value;}},
"DeathArchive":{get:function(){return DeathArchive;},set:function($value){DeathArchive=$value;}},
"ArchiveReplay":{get:function(){return ArchiveReplay;},set:function($value){ArchiveReplay=$value;}}
});
})(GameModules.imports("game3d/js/death-archive.js"));
