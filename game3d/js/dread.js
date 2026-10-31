/* 里世界 3D · 氛围（恐怖计划 P1：声音先行、空间异化、惊吓预算）
   只管「气氛」：不改异象、巡察者、学生会检查、课表和隐藏触发的任何判定，不扣数值、不致死。
   · 惊吓预算：同一片区域、同一段时间里强制惊吓有上限，弱的也有间隔；
   · 假威胁：有方位、有远近、隔墙会发闷的环境声（敲门、脚步、拖椅子、低语、远处的门），多数时候什么都不会来；
   · 骤静：环境声忽然全没了几秒，再回来；
   · 声音先行：下一个异象到来前几秒，先有一点压迫的低频；
   · 回访变化：同一天回到同一个房间，房间会有一点点不一样（一盏灯坏了、地上多一张纸条、脚步多一层回声、
     进门时屋里刚有人离开的声音）；不改碰撞，读档按房间和次数复现；
   · 五分钟体验切片（调试用）：按「安静 → 先听后见 → 危险操作 → 兑现或落空 → 余韵」排一段。
   画面部分在 fx/dread-fx.js。 */
'use strict';

var DREAD_CFG={
  strongGap:45, strongArea:120,     /* 强惊吓：全局至少隔 45 秒，同一区域至少隔 120 秒 */
  mildGap:9, mildArea:24,           /* 弱的（远处的声音）：全局 9 秒，同一区域 24 秒 */
  ambMin:24, ambMax:52,             /* 环境假威胁的基础间隔（真实秒），越紧张越密 */
  safeStart:60,                     /* 开局头一分钟不加任何假威胁（新手安全） */
  preLead:3.2                       /* 异象前多少秒出前兆 */
};
var DREAD={t:0,last:{},areaLast:{},log:[],nextAmb:30,preFor:null,visitFx:null,slice:null,echo:false,started:false};

function dreadArea(){
  if(S.mode==='in') return 'in:'+S.room;
  return 'out:'+Math.floor(S.x/SC/150)+','+Math.floor(S.y/SC/150);
}
/* 正在被别的东西占着（异象、巡察、检查、选择、演出……）就不加戏，避免同帧叠加 */
function dreadBusy(){
  if(S.screen!=='play'||S.dead||(S.intro>0)) return true;
  if(typeof PRO!=='undefined'&&PRO.on) return true;
  if(AN.active) return true;
  if(typeof PAT!=='undefined'&&PAT.state&&PAT.state!=='idle') return true;
  if(typeof Inspection!=='undefined'&&Inspection.pending()) return true;
  if(UI.anyOpen()||(typeof PAUSE!=='undefined'&&PAUSE.on)) return true;
  if(typeof CUT!=='undefined'&&CUT.on) return true;
  if(typeof LESSON!=='undefined'&&LESSON.on) return true;
  if((typeof PC!=='undefined'&&PC.on)||(typeof PHONE!=='undefined'&&PHONE.on)) return true;
  if(typeof CarChase!=='undefined'&&CarChase.active()) return true;
  if(typeof Elevator!=='undefined'&&Elevator.inRide()) return true;
  if(S.room==='portal_tunnel') return true;
  if(S.fn&&S.fn.on) return true;                 /* 假正常有自己的一套 */
  return false;
}
/* 由 0 到 1 的紧张度：低 SAN、高违规、夜里更紧张（只影响假威胁的疏密，不影响规则） */
function dreadTension(){
  var night=0; try{ night=1-sunAt(hourNow()).day; }catch(e){}
  return clamp((100-S.san)/140+(S.viol||0)/260+night*0.25,0,1);
}
/* 声源到玩家之间有没有墙（室内按格子，室外按建筑） */
function dreadLineClear(x0,y0,x1,y1){
  var dx=x1-x0,dy=y1-y0,n=Math.max(1,Math.ceil(Math.hypot(dx,dy)/3)),R=S.mode==='in'?INTERIORS[S.room]:null,i;
  for(i=1;i<n;i++){
    var x=x0+dx*i/n,y=y0+dy*i/n;
    if(R){ var tile=tileAt(R,x,y); if(tile==='#'||(tile==='='&&!doorIsOpen(R,x,y))) return false; }
    else if(solidAtOutdoor(x,y)) return false;
  }
  return true;
}
/* 把一个世界里的点换成「左右、远近、背后、隔墙」 */
function dreadPlace(wx,wy){
  var dx=wx-S.x,dy=wy-S.y,d=Math.hypot(dx,dy)*U2M;
  var rel=Math.atan2(dy,dx)-S.ang;
  return {pan:clamp(Math.sin(rel),-1,1)*0.9,behind:Math.cos(rel)<-0.2,k:clamp(1-d/26,0.12,1),
    muffled:!dreadLineClear(S.x,S.y,wx,wy),m:d};
}
/* 室内：离玩家 4–16 米的门或墙边；室外：12–30 米外的一点 */
function dreadSpot(minM,maxM){
  var R=S.mode==='in'?INTERIORS[S.room]:null, best=[], r, c, i;
  if(R){
    for(r=0;r<R.rows;r++) for(c=0;c<R.cols;c++){
      var ch=R.grid[r][c]; if(ch!=='='&&ch!=='O'&&ch!=='#') continue;
      if(ch==='#'&&((r+c)%7)) continue;               /* 墙只取一部分，少算一点 */
      var x=R.ox+(c+0.5)*R.tw,y=R.oy+(r+0.5)*R.th,m=Math.hypot(x-S.x,y-S.y)*U2M;
      if(m>=minM&&m<=maxM) best.push({x:x,y:y,door:ch!=='#'});
    }
    var doors=best.filter(function(p){return p.door;});
    if(doors.length&&Math.random()<0.7) best=doors;
  }else{
    for(i=0;i<12;i++){
      var a=Math.random()*TAU,mm=(minM+Math.random()*(maxM-minM))/U2M;
      best.push({x:S.x+Math.cos(a)*mm,y:S.y+Math.sin(a)*mm});
    }
  }
  return best.length?best[Math.floor(Math.random()*best.length)]:null;
}

var Dread={
  reset:function(){
    DREAD.t=0;DREAD.last={};DREAD.areaLast={};DREAD.log=[];DREAD.nextAmb=30;DREAD.preFor=null;
    DREAD.visitFx=null;DREAD.slice=null;DREAD.echo=false;DREAD.started=true;
    try{ DreadFx.clear(); }catch(e){}
  },
  /* 惊吓预算：strength 1 弱、2 强 */
  allow:function(strength,area){
    var s=strength>=2?'s':'m', gap=strength>=2?DREAD_CFG.strongGap:DREAD_CFG.mildGap, ag=strength>=2?DREAD_CFG.strongArea:DREAD_CFG.mildArea;
    area=area||dreadArea();
    if(DREAD.last[s]!==undefined&&DREAD.t-DREAD.last[s]<gap) return false;
    var al=DREAD.areaLast[area+':'+s];
    if(al!==undefined&&DREAD.t-al<ag) return false;
    /* 强的也占用弱的额度，弱的不占强的 */
    if(s==='m'&&DREAD.last.s!==undefined&&DREAD.t-DREAD.last.s<DREAD_CFG.mildGap) return false;
    return true;
  },
  note:function(kind,strength,extra){
    var s=strength>=2?'s':'m', area=dreadArea();
    DREAD.last[s]=DREAD.t; DREAD.areaLast[area+':'+s]=DREAD.t;
    var e={t:+DREAD.t.toFixed(2),kind:kind,strength:strength,area:area,day:S.day,clock:S.tsec};
    if(extra) for(var k in extra) e[k]=extra[k];
    DREAD.log.push(e); if(DREAD.log.length>80) DREAD.log.shift();
    return e;
  },
  /* 一个有方位的假威胁。返回 true 表示真的放了 */
  falseThreat:function(kind,strength){
    strength=strength||1;
    if(!Dread.allow(strength)) return false;
    var p=null, spot=null;
    if(kind!=='silence'){
      spot=dreadSpot(kind==='whisper'?2:4,kind==='call'?40:16);
      if(!spot) return false;
      p=dreadPlace(spot.x,spot.y);
    }
    if(kind==='silence'){ try{ SFX.duck(3.2+Math.random()*1.8); }catch(e){} }
    else{ try{ SFX.dread(kind,p); }catch(e){} }
    Dread.note(kind,strength,p?{pan:+p.pan.toFixed(2),m:+p.m.toFixed(1),muffled:p.muffled,behind:p.behind}:null);
    return true;
  },
  /* 按场合挑一种：室内多是门、脚步、椅子；室外是脚步、远处的人声和门 */
  pickAmbient:function(){
    var t=dreadTension(), r=Math.random(), indoor=S.mode==='in';
    if(r<0.12) return 'silence';
    if(indoor){
      if(r<0.36) return 'knock';
      if(r<0.58) return 'steps';
      if(r<0.74) return 'chair';
      if(r<0.86+0.06*t) return 'whisper';
      return t>0.55&&Math.random()<0.5?'run':'door';
    }
    if(r<0.45) return 'steps';
    if(r<0.66) return 'call';
    if(r<0.84) return 'door';
    return t>0.55&&Math.random()<0.5?'run':'whisper';
  },
  /* 进房间：同一天第二次以后，房间会有一点点不一样 */
  enter:function(room){
    try{ DreadFx.clear(); }catch(e){}
    DREAD.visitFx=null; DREAD.echo=false;
    if(!room||!INTERIORS[room]) return;
    RT.visits=RT.visits||{};
    var key=S.day+':'+room, n=(RT.visits[key]||0)+1; RT.visits[key]=n;
    if(n<2||room==='portal_tunnel'||room==='lift_dream') return;
    var h=lhashStr(key+':'+n), kinds=['lamp','note','echo','left'], kind=kinds[Math.floor(h*kinds.length)];
    DREAD.visitFx={room:room,visit:n,kind:kind,seed:h};
    if(kind==='echo') DREAD.echo=true;
    if(kind==='lamp'){ try{ DreadFx.lamp(Math.floor(lhashStr(key+'L'+n)*64)); }catch(e){} }
    if(kind==='note'){ try{ DreadFx.note(DREAD_NOTES[Math.floor(lhashStr(key+'N'+n)*DREAD_NOTES.length)],lhashStr(key+'P'+n)); }catch(e){} }
    if(kind==='left'){ DREAD.leftAt=DREAD.t+0.8; }
    Dread.note('visit:'+kind,0,{room:room,visit:n});
  },
  /* 真实秒推进；只在正常游玩时调用 */
  tick:function(dt){
    if(!DREAD.started) Dread.reset();
    DREAD.t+=dt;
    if(DREAD.slice){ DreadSlice.tick(dt); }
    /* 回访：刚进门时，屋里传来有人刚离开的声音 */
    if(DREAD.leftAt&&DREAD.t>=DREAD.leftAt){
      DREAD.leftAt=0;
      var sp=dreadSpot(5,14); if(sp){ try{ SFX.dread('desk',dreadPlace(sp.x,sp.y)); }catch(e){} }
    }
    /* 声音先行：下一个异象到来前几秒，压一层低频上来（不是每次都准：有时候来的是别的，有时候什么也没来） */
    if(!AN.active&&AN.next>0&&AN.next<DREAD_CFG.preLead&&DREAD.preFor!==AN.next0){
      DREAD.preFor=AN.next0;
      if(!dreadBusy()){ try{ SFX.precursor(0.6+0.4*dreadTension()); }catch(e){} Dread.note('precursor',0,{an:AN.pre||null}); }
    }
    if(dreadBusy()||DREAD.slice) return;
    if(gameAge()<DREAD_CFG.safeStart) return;
    var t=dreadTension();
    DREAD.nextAmb-=dt*(0.75+t*0.9);
    if(DREAD.nextAmb>0) return;
    DREAD.nextAmb=rnd(DREAD_CFG.ambMin,DREAD_CFG.ambMax);
    var kind=Dread.pickAmbient(), strength=(kind==='run')?2:1;
    if(!Dread.falseThreat(kind,strength)) DREAD.nextAmb=rnd(6,12);   /* 预算不够：过一会儿再说 */
  },
  stats:function(){
    var byArea={}, minGap={}, i, counts={};
    DREAD.log.forEach(function(e){
      counts[e.kind]=(counts[e.kind]||0)+1;
      if(!(e.strength>=1)) return;
      var key=e.area+':'+(e.strength>=2?'s':'m');
      if(byArea[key]!==undefined){ var g=e.t-byArea[key]; minGap[key]=minGap[key]===undefined?g:Math.min(minGap[key],g); }
      byArea[key]=e.t;
    });
    return {counts:counts,minGap:minGap,n:DREAD.log.length};
  }
};
/* 地上的纸条：不是规则，也不是提示，只是有人来过 */
var DREAD_NOTES=['你昨天也来过。','这张纸条不是写给你的。','第二排靠窗的位子，今天也空着。',
  '我数过了，楼梯比早上多一级。','有人在等你先走。','如果你看到这张纸，就别再回来找它了。','他走路的声音，和你一样。'];
function lhashStr(s){ var h=2166136261>>>0,i; for(i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619)>>>0; } return (h%100000)/100000; }
/* 这一局已经玩了多少真实秒（新局从 0 开始；用来保证开局安静） */
function gameAge(){ return DREAD.t; }

/* ---------- 五分钟体验切片（调试面板「工具」页，自动化测试也用它） ----------
   0:00–1:00 安静：只有校园底噪；1:00–2:00 先听后见：失真的广播、方向会变的脚步、一声只是风的门轴；
   2:00–3:15 危险操作：翻柜子要停留，脚步从走廊那头靠近（可以躲、可以等、可以走）；
   3:15–4:15 兑现或落空：按种子决定是真的来一阵走廊灯异象，还是什么也没来；
   4:15–5:00 余韵：安静，地上留一张纸条。 */
var DreadSlice={
  BEATS:[[0,'quiet'],[60,'listen'],[120,'risk'],[195,'pay'],[255,'rest'],[300,'end']],
  start:function(seed){
    Dread.reset();
    DREAD.slice={t:0,beat:'quiet',seed:seed===undefined?Math.random():seed,done:{},beats:[]};
    DreadSlice.mark('quiet');
    os('我：走廊尽头的储物柜里，有我要找的东西。',4);
  },
  mark:function(b){ DREAD.slice.beat=b; DREAD.slice.beats.push({beat:b,t:+DREAD.slice.t.toFixed(1)}); Dread.note('slice:'+b,0); },
  stop:function(){ DREAD.slice=null; },
  tick:function(dt){
    var sl=DREAD.slice; sl.t+=dt;
    var i,b=sl.beat;
    for(i=DreadSlice.BEATS.length-1;i>=0;i--){ if(sl.t>=DreadSlice.BEATS[i][0]){ if(DreadSlice.BEATS[i][1]!==b) DreadSlice.mark(DreadSlice.BEATS[i][1]); break; } }
    b=sl.beat; var d=sl.done;
    if(b==='listen'){
      if(!d.radio&&sl.t>66){ d.radio=1; try{ SFX.dread('radio',{pan:-0.6,k:0.5,muffled:true,behind:false}); }catch(e){} Dread.note('radio',1); }
      if(!d.steps1&&sl.t>82){ d.steps1=1; try{ SFX.dread('steps',{pan:0.7,k:0.45,muffled:true,behind:true}); }catch(e){} Dread.note('steps',1); }
      if(!d.steps2&&sl.t>94){ d.steps2=1; try{ SFX.dread('steps',{pan:-0.7,k:0.5,muffled:true,behind:false}); }catch(e){} Dread.note('steps',1,{moved:true}); }
      if(!d.creak&&sl.t>108){ d.creak=1; try{ SFX.dread('door',{pan:0.2,k:0.35,muffled:false,behind:false}); }catch(e){} Dread.note('door',1,{nothing:true}); }
    }else if(b==='risk'){
      if(!d.near&&sl.t>150){ d.near=1; try{ SFX.dread('steps',{pan:0.3,k:0.75,muffled:false,behind:true}); }catch(e){} Dread.note('steps',1,{near:true}); }
    }else if(b==='pay'){
      if(!d.pay){
        d.pay=1;
        if(sl.seed<0.5&&!AN.active){ try{ Dev.lamps(); }catch(e){ try{ anStart(); }catch(_e){} } Dread.note('pay:anomaly',2); }
        else { try{ SFX.duck(4.5); }catch(e){} Dread.note('pay:nothing',1); }
      }
    }else if(b==='rest'){
      if(!d.note){ d.note=1; try{ DreadFx.note(DREAD_NOTES[0],sl.seed); }catch(e){} Dread.note('trace',0); }
    }else if(b==='end'){
      DreadSlice.stop();
    }
  }
};
