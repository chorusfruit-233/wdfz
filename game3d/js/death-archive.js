/* 里世界 3D · 死亡档案室
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
/* 注册表：死因 ID → 演出 → 档案标题、一句记录 → 回放舞台。secret:1 的条目在解锁前完全不出现（目前没有）。 */
var DEATH_ARCHIVE=[
  {id:'patrol',       fx:'grip',     n:'点名',         d:'灯按拍子闪的时候，它就在这一层。一只手从后面按住了我的头顶。', stage:'teach1'},
  {id:'garage',       fx:'grip',     n:'车道中间',     d:'车库里没有灯。它一直站在车道中间，等我自己走过去。', stage:'garage1'},
  {id:'car_entry',    fx:'grip',     n:'后座',         d:'我拉开了车门。后视镜里，它就弯着腰站在后座上。', stage:'garage1'},
  {id:'car_chase',    fx:'grip',     n:'没开出去',     d:'路障、岔路、追上来的东西——那辆车没能开出这所学校。', stage:'out'},
  {id:'san',          fx:'vignette', n:'那根弦',       d:'理智耗尽。一圈没有脸的高个子，从暗处一个接一个走出来。', stage:'teach1'},
  {id:'assimilation', fx:'names',    n:'合身的椅子',   d:'我在自己的位子上坐好了。这一次，不用再起来了。', stage:'teach1'},
  {id:'trash',        fx:'trash',    n:'桶盖',         d:'桶盖合上了。外面有人敲了两下，像在确认里面有没有人。', stage:'trash1'},
  {id:'an:rain',      fx:'drown',    n:'雨',           d:'雨灌进了肺里。我听见自己在身体里晃。', stage:'out'},
  {id:'an:moth',      fx:'swarm',    n:'蛾群',         d:'翅膀上的粉落进眼睛里，很痒。然后什么都不痒了。', stage:'out'},
  {id:'an:exercise',  fx:'follow',   n:'课间操',       d:'我开始跟着做操。手臂抬起来的时候才发现，早就停不下来了。', stage:'out'},
  {id:'an:rite',      fx:'ring',     n:'粉笔圈',       d:'圈正中那个空着的位置，刚好是我的大小。', stage:'lab1'},
  {id:'an:necker',    fx:'neck',     n:'围栏的缝',     d:'他没有绕到校门口。他把脖子从围栏的缝里伸了进来。', stage:'out'},
  {id:'an:twin',      fx:'twin',     n:'天台的另一头', d:'他走到了我面前。我们同时抬起手。他的手是热的。', stage:'teach6'},
  {id:'an:cup',       fx:'floor',    n:'窗台上的杯子', d:'一只白色的杯子，画着二校门。它比我想象的要重。', stage:'out'},
  {id:'laugh',        fx:'laugh',    n:'笑出了声',     d:'灯前看字字如旧。我笑得停不下来，笑了很久。', stage:'teach1'},
  {id:'trap_out',     fx:'slit',     n:'正门',         d:'我从门缝里挤了出去。路的尽头还是一扇校门。', stage:'out'},
  {id:'trap_wall',    fx:'squeeze',  n:'墙外的墙',     d:'墙外面还有一道墙。我一直翻，翻到手指不再是手指的形状。', stage:'out'},
  {id:'trap_beg',     fx:'face',     n:'路过的人',     d:'他慢慢转过头——没有脸，只有一个很大的、在笑的洞。', stage:'out'}
];
var DEATH_ARCHIVE_BY_ID={};
DEATH_ARCHIVE.forEach(function(e,i){ e.no=i+1; DEATH_ARCHIVE_BY_ID[e.id]=e; });
/* 回放舞台：户外用操场边一块空地，室内用各房间的默认入口 */
var DEATH_STAGE_OUT={x:1580,y:1800,ang:-PI/2};
/* 当前这次 kill 的来源：调试面板的「实际死亡」把它设成 debug */
var KILL_CTX=null;

var DeathArchive={
  blank:function(){ return {version:1,unlocked:{},first:{},count:{},legacy:{},pending:0,migrated:0}; },
  read:function(){
    var d=null;
    try{ d=JSON.parse(localStorage.getItem(DEATH_ARCHIVE_KEY)||'null'); }catch(e){ d=null; }
    var out=DeathArchive.blank();
    if(!d||typeof d!=='object'||d.version!==1) return out;
    ['unlocked','first','count','legacy'].forEach(function(k){
      var src=d[k]; if(!src||typeof src!=='object') return;
      Object.keys(src).forEach(function(id){ if(DEATH_ARCHIVE_BY_ID[id]) out[k][id]=src[id]; });   /* 未知 ID 丢掉，不改成别的死法 */
    });
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
    if(KILL_CTX==='debug'||(typeof DEV!=='undefined'&&DEV.on)||(typeof ArchiveReplay!=='undefined'&&ArchiveReplay.on)) return null;
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
  /* 玩家能看到的条目：已解锁的全部，加上未解锁的公开条目（只显示「尚未记录」） */
  visible:function(d){ d=d||DeathArchive.state(); return DEATH_ARCHIVE.filter(function(e){ return d.unlocked[e.id]||!e.secret; }); },
  /* 死亡演出放完以后提示一次（不在致死那一刻打断） */
  notify:function(entry){
    if(!entry) return;
    try{ toast('死亡档案室 · 新记录：'+entry.n); }catch(e){}
  },

  /* ---------- 菜单里的档案室 ---------- */
  open:function(){
    var el=document.getElementById('archive'); if(!el) return;
    DeathArchive.paint(); el.hidden=false;
    try{ resetInputState(); releaseMouseLook(); }catch(e){}
    var first=el.querySelector('.arcard.open button')||document.getElementById('arBack');
    if(first) first.focus({preventScroll:true});
  },
  close:function(){
    var el=document.getElementById('archive'); if(el) el.hidden=true;
    var b=document.getElementById('btnarchive'); if(b) b.focus({preventScroll:true});
  },
  paint:function(){
    var d=DeathArchive.state(), list=DeathArchive.visible(d), got=list.filter(function(e){ return d.unlocked[e.id]; }).length;
    var head=document.getElementById('arCount');
    if(head) head.textContent='已记录 '+got+' / '+list.filter(function(e){ return !e.secret; }).length;
    var note=document.getElementById('arNote');
    if(note) note.textContent=d.pending?('另有 '+d.pending+' 条旧版本的死亡记录来源不明，没有计入。'):'';
    var box=document.getElementById('arcards'); if(!box) return;
    box.textContent='';
    var latest=null;
    Object.keys(d.first).forEach(function(id){ if(!latest||d.first[id]>d.first[latest]) latest=id; });
    list.forEach(function(e){
      var open=!!d.unlocked[e.id], card=document.createElement('div');
      card.className='arcard'+(open?' open':'')+(open&&e.id===latest?' latest':'');
      card.dataset.id=e.id;
      var no=document.createElement('em'); no.textContent=('0'+e.no).slice(-2); card.appendChild(no);
      var body=document.createElement('span');
      var t=document.createElement('b'), p=document.createElement('i');
      if(open){
        t.textContent=e.n; p.textContent=e.d;
        var meta=document.createElement('small');
        meta.textContent=(d.legacy[e.id]?'旧版本记录':'经历 '+(d.count[e.id]||1)+' 次')+(e.id===latest?' · 最近':'');
        body.appendChild(t); body.appendChild(p); body.appendChild(meta);
        card.appendChild(body);
        var btn=document.createElement('button'); btn.type='button'; btn.textContent='重看';
        btn.addEventListener('click',function(){ ArchiveReplay.play(e.id); });
        card.appendChild(btn);
      }else{
        t.textContent='尚未记录'; p.textContent='封存的档案。'; body.appendChild(t); body.appendChild(p); card.appendChild(body);
      }
      box.appendChild(card);
    });
  }
};

/* ---------- 回放：隔离的演出舞台 ----------
   只在主菜单里播。把人放到示范位置、搭好场景，然后用预览模式播放同一份死亡演出（镜头由演出接管），
   世界不更新（S.screen='replay'），不调用 kill / 存档 / 死亡日志；结束、跳过、出错都回到菜单。 */
var ArchiveReplay={on:false,id:null,timer:0,wait:0,snap:null,t0:0,
  play:function(id){
    var e=DEATH_ARCHIVE_BY_ID[id], d=DeathArchive.state();
    if(!e||!d.unlocked[id]||ArchiveReplay.on) return false;
    if(S.screen!=='menu') return false;
    ArchiveReplay.on=true; ArchiveReplay.id=id; ArchiveReplay.t0=performance.now();
    ArchiveReplay.snap={mode:S.mode,room:S.room,x:S.x,y:S.y,ang:S.ang,pitch:S.pitch,seated:S.seated,tsec:S.tsec,day:S.day};
    document.getElementById('archive').hidden=true;
    document.getElementById('menu').style.display='none';
    document.body.classList.add('cut','replaying');
    var cap=document.getElementById('arReplay'); if(cap){ cap.hidden=false; cap.querySelector('b').textContent=e.n; }
    S.screen='replay'; S.dead=false; S.death=null; S.seated=false; S.pitch=0; S.eyeLift=0;
    try{
      if(e.stage==='out'){
        S.x=DEATH_STAGE_OUT.x; S.y=DEATH_STAGE_OUT.y; S.ang=DEATH_STAGE_OUT.ang;
        if(S.mode!=='out'||!GLR.outMesh){ S.mode='out'; S.room=null; enterWorldOut(); }
      }else doEnterRoom(e.stage);
    }catch(err){ ArchiveReplay.stop(); return false; }
    running=true;
    ArchiveReplay.wait=setInterval(function(){
      var ready=(S.mode==='out'?!!GLR.outMesh:(GLR.roomMesh&&GLR.roomMesh.userData.roomData===INTERIORS[S.room]));
      if(!ArchiveReplay.on){ clearInterval(ArchiveReplay.wait); return; }
      if(!ready&&performance.now()-ArchiveReplay.t0<15000) return;
      clearInterval(ArchiveReplay.wait); ArchiveReplay.wait=0;
      if(!ready){ ArchiveReplay.stop(); try{ toast('档案读取失败，请稍后再试'); }catch(_e){} return; }
      ArchiveReplay.start(e);
    },60);
    return true;
  },
  start:function(e){
    S.screen='replay'; S.seated=false; S.pitch=0;
    try{ syncCamera(0); }catch(err){}
    try{ deathFX(e.fx,{preview:true}); }catch(err){}
    try{ SFX.resume(); SFX.deathFx(e.fx); }catch(err){}
    /* 按演出自己的进度收尾（低帧率时演出走得比墙上时钟慢，不能按墙钟截断）；墙钟只做一个宽松的上限 */
    var sec=Math.max(3.5,DeathTimeline.duration(e.fx)+0.6), w0=performance.now();
    ArchiveReplay.timer=setInterval(function(){
      if(ANFX.kind!=='death'||ANFX.t>=sec||performance.now()-w0>sec*4000) ArchiveReplay.stop();
    },100);
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
    try{ if(ANFX.kind==='death') anfxClear(); }catch(e){}
    try{ SFX.stopDeath&&SFX.stopDeath(); }catch(e){}
    GLR.flash=0; GLR.hurt=0; VisualState.flash=0; VisualState.hurt=0;
    var s=ArchiveReplay.snap; ArchiveReplay.snap=null;
    if(s){ S.ang=s.ang; S.pitch=s.pitch; S.seated=s.seated; S.tsec=s.tsec; S.day=s.day; }
    S.dead=false; S.death=null; S.eyeLift=0;
    S.screen='menu';
    document.body.classList.remove('cut','replaying');
    var cap=document.getElementById('arReplay'); if(cap) cap.hidden=true;
    document.getElementById('menu').style.display='block';
    var el=document.getElementById('archive'); if(el){ DeathArchive.paint(); el.hidden=false; }
    var again=document.querySelector('#arcards .arcard[data-id="'+(ArchiveReplay.id||'')+'"] button');
    if(again) again.focus({preventScroll:true});
    try{ syncCamera(0); }catch(e){}
  }
};
document.addEventListener('keydown',function(ev){
  if(ArchiveReplay.on){
    if(ev.key===' '||ev.key==='Enter'||ev.key==='Escape'){ ev.preventDefault(); ev.stopPropagation(); ArchiveReplay.skip(); }
    return;
  }
  var el=document.getElementById('archive');
  if(el&&!el.hidden&&ev.key==='Escape'){ ev.preventDefault(); ev.stopPropagation(); DeathArchive.close(); }
},true);
/* 点击 / 触摸结束回放由 input.js 处理（和跳过结局演出一样，吞掉松指后补发的 click，免得点到随后出现的「重看」） */
/* 启动时先把旧死亡日志迁一次：之后新写进旧日志的死亡不会被当成「旧版本记录」 */
try{ DeathArchive.state(); }catch(e){}
