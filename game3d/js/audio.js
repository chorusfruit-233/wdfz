/* @module-capsule */
(function($imports){
/* 里世界 3D · 声音（Web Audio 合成） */
'use strict';

/* ================= 声音 =================
   全部用 Web Audio 现场合成，不加载任何文件（单文件、离线可玩）。
   一次性音效（2026-11-02 全部重做）：配方在 sound-bank.js，由 fx/sound-player.js 合成；这里只决定什么时候放、放哪一个。
   分类总线 ─┬─ 主音量 → 压缩器 → 扬声器
             └─ 混响（生成的冲激响应；「真实」档按空间换）
   持续层（留在这里）：低音铺底（BGM）· 室外风 · 室内灯管嗡声 · 车库低频 · 雨 */
var SFX=(function(){
  var ac=null,ready=false;
  function ensure(){
    if(ready) return ac;
    try{ ac=new (window.AudioContext||window.webkitAudioContext)(); ready=true; }catch(e){ ready=false; }
    return ac;
  }
  var mg=null, vol=0.7, rev=null, revIn=null, revG=null, NB=null, L=null, bgOn=false;
  function ctx(){ if(!ready) ensure(); if(ac&&ac.state==='suspended'){ try{ac.resume();}catch(e){} } return ac; }
  function master(){
    var a=ctx(); if(!a) return null;
    if(!mg){
      try{
        var comp=a.createDynamicsCompressor();
        comp.threshold.value=-18; comp.ratio.value=4; comp.attack.value=0.004; comp.release.value=0.25;
        comp.connect(a.destination);
        mg=a.createGain(); mg.gain.value=vol; mg.connect(comp);
        /* 混响：2.8 秒衰减的噪声做冲激 */
        rev=a.createConvolver();
        var len=Math.floor(a.sampleRate*2.8), ib=a.createBuffer(2,len,a.sampleRate), ch, i;
        for(ch=0;ch<2;ch++){ var dd=ib.getChannelData(ch); for(i=0;i<len;i++) dd[i]=($imports.PresentationRandom.next()*2-1)*Math.pow(1-i/len,2.6); }
        rev.buffer=ib;
        revIn=a.createGain(); revIn.gain.value=0.9;
        revG=a.createGain(); revG.gain.value=1;
        revIn.connect(rev); rev.connect(revG); revG.connect(mg);
      }catch(e){ return a.destination; }
    }
    return mg;
  }
  function out(wet){                      /* 返回一个接入点：直达 + 一点混响 */
    var a=ctx(); if(!a) return null;
    var d=master(); if(!d) return null;
    var g=a.createGain(); g.gain.value=1; g.connect(d);
    if(wet&&revIn){ var w=a.createGain(); w.gain.value=wet; g.connect(w); w.connect(revIn); }
    return g;
  }
  /* 「真实」档：按空间生成的混响。教室短而亮，走廊长、有来回的回声，车库和钟楼很空，宿舍闷，室外几乎只有远处的一点回响。
     两个卷积器轮流用，换地方时交叉淡入；其它档位仍是原来那一个通用混响。 */
  var SPACES={
    room:  {len:1.1,pw:3.2,damp:0.35,pre:0.008,er:[[0.011,0.5],[0.017,0.38],[0.026,0.3],[0.034,0.22]]},
    hall:  {len:2.6,pw:2.4,damp:0.28,pre:0.012,er:[[0.009,0.45],[0.021,0.4],[0.042,0.34],[0.063,0.28],[0.084,0.22],[0.105,0.16]]},
    garage:{len:3.6,pw:2.1,damp:0.22,pre:0.02,er:[[0.027,0.42],[0.051,0.34],[0.078,0.26]]},
    bell:  {len:4.8,pw:1.9,damp:0.30,pre:0.03,er:[[0.04,0.4],[0.083,0.32],[0.125,0.25]]},
    out:   {len:0.9,pw:4.5,damp:0.12,pre:0.045,er:[[0.06,0.18]]},
    dorm:  {len:0.8,pw:3.6,damp:0.30,pre:0.006,er:[[0.008,0.45],[0.014,0.32]]}
  };
  var SP_IR={}, spRev=null, spCur=null;
  function makeIR(a,sp){
    var sr=a.sampleRate, len=Math.floor(sr*sp.len), b=a.createBuffer(2,len,sr), ch, i;
    for(ch=0;ch<2;ch++){
      var d=b.getChannelData(ch), y=0, pre=Math.floor(sp.pre*sr);
      for(i=pre;i<len;i++){                      /* 尾巴：越往后高频衰减得越多 */
        var t=(i-pre)/(len-pre), k=0.85+(sp.damp-0.85)*t;
        y+=k*(($imports.PresentationRandom.next()*2-1)-y);
        d[i]=y*Math.pow(1-t,sp.pw)*0.6;
      }
      sp.er.forEach(function(e,j){                /* 早期反射：左右耳错开一点 */
        var at=Math.floor(e[0]*(1+(ch?0.07:-0.05)*((j%2)?1:-1))*sr);
        if(at<len) d[at]+=e[1]*(ch===j%2?1:0.7);
      });
    }
    return b;
  }
  function spaceKind(){
    if($imports.S.screen!=='play'||$imports.S.mode==='out'||$imports.S.room==='teach6') return 'out';
    if($imports.S.room==='garage1') return 'garage';
    if($imports.S.room==='bell1') return 'bell';
    var R=$imports.INTERIORS[$imports.S.room];
    if(R&&/^dorm/.test(R.host)) return 'dorm';
    if((0,$imports.corridorHere)()) return 'hall';
    return 'room';
  }
  function realRev(){
    var a=ac; if(!a||!revIn) return;
    var want=$imports.Quality.get().realAudio?spaceKind():null;
    if(want===spCur) return;
    spCur=want;
    if(!want){                                   /* 回到通用混响 */
      if(spRev) spRev.forEach(function(r){ setG(r.g.gain,0,0.25); });
      setG(revG.gain,1,0.25);
      return;
    }
    if(!spRev){
      spRev=[0,1].map(function(){ var c=a.createConvolver(), g=a.createGain(); g.gain.value=0; revIn.connect(c); c.connect(g); g.connect(mg); return {c:c,g:g}; });
      spRev.i=0;
    }
    var next=spRev[1-spRev.i];
    next.c.buffer=SP_IR[want]||(SP_IR[want]=makeIR(a,SPACES[want]));
    setG(next.g.gain,1,0.25); setG(spRev[spRev.i].g.gain,0,0.25); setG(revG.gain,0,0.25);
    spRev.i=1-spRev.i;
  }
  /* 有方位的声音：真实档用 HRTF（戴耳机能听出前后左右），其它档位是左右声像 */
  function panNode(a,pan){
    var p=(0,$imports.clamp)(pan||0,-1,1);
    if($imports.Quality.get().realAudio&&a.createPanner){
      var pz=a.createPanner(), az=p*$imports.PI/2;
      pz.panningModel='HRTF'; pz.distanceModel='inverse'; pz.refDistance=1; pz.rolloffFactor=0.6;
      var px=Math.sin(az)*1.6, py=0, pzz=-Math.cos(az)*1.6;
      if(pz.positionX){ pz.positionX.value=px; pz.positionY.value=py; pz.positionZ.value=pzz; } else pz.setPosition(px,py,pzz);
      return pz;
    }
    if(a.createStereoPanner){ var pn=a.createStereoPanner(); pn.pan.value=p; return pn; }
    return null;
  }
  function noiseBuf(){
    var a=ctx(); if(!a) return null;
    if(!NB){
      var n=a.sampleRate*2; NB=a.createBuffer(1,n,a.sampleRate);
      var d=NB.getChannelData(0); for(var i=0;i<n;i++) d[i]=$imports.PresentationRandom.next()*2-1;
    }
    return NB;
  }
  /* 下面几个是旧的底层合成函数：游戏里的音效都改用声音库了，只留给 SFX.synth()（模块、Mod 的环境声）用 */
  function tone(freq,dur,type,gain,slide,at,wet){
    var a=ctx(); if(!a) return;
    var o=a.createOscillator(), g=a.createGain(), t0=a.currentTime+(at||0);
    o.type=type||'sine'; o.frequency.setValueAtTime(freq,t0);
    if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(20,slide),t0+dur);
    g.gain.setValueAtTime(0.0001,t0);
    g.gain.exponentialRampToValueAtTime(gain||0.06,t0+Math.min(0.02,dur*0.2));
    g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
    o.connect(g); var _d=out(wet||0); if(_d) g.connect(_d);
    o.start(t0); o.stop(t0+dur+0.05);
  }
  function noise(dur,gain,filterFreq,at,type,q,wet,attack){
    var a=ctx(); if(!a) return;
    var b=noiseBuf(); if(!b) return;
    var s=a.createBufferSource(); s.buffer=b; s.loop=true;
    var t0=a.currentTime+(at||0);
    var f=a.createBiquadFilter(); f.type=type||'lowpass'; f.frequency.value=filterFreq||900; if(q) f.Q.value=q;
    var g=a.createGain();
    g.gain.setValueAtTime(0.0001,t0);
    g.gain.exponentialRampToValueAtTime(gain||0.05,t0+(attack||0.008));
    g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
    s.connect(f); f.connect(g); var _d=out(wet||0); if(_d) g.connect(_d);
    s.start(t0,$imports.PresentationRandom.next()*1.5); s.stop(t0+dur+0.05);
  }
  /* 带左右声道的噪声：pan -1 左 ~ 1 右 */
  function noiseP(dur,gain,filterFreq,at,type,q,pan,wet,attack){
    var a=ctx(); if(!a) return;
    var b=noiseBuf(); if(!b) return;
    var s=a.createBufferSource(); s.buffer=b; s.loop=true;
    var t0=a.currentTime+(at||0);
    var f=a.createBiquadFilter(); f.type=type||'lowpass'; f.frequency.value=filterFreq||900; if(q) f.Q.value=q;
    var g=a.createGain();
    g.gain.setValueAtTime(0.0001,t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002,gain||0.05),t0+(attack||0.008));
    g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
    s.connect(f); f.connect(g);
    var last=g;
    var pn=panNode(a,pan); if(pn){ g.connect(pn); last=pn; }
    var _d=out(wet||0); if(_d) last.connect(_d);
    s.start(t0,$imports.PresentationRandom.next()*1.5); s.stop(t0+dur+0.05);
  }
  /* 像人声的元音：锯齿过两个带通 */
  function vowel(f0,dur,gain,at,fm1,fm2,vib){
    var a=ctx(); if(!a) return;
    var t0=a.currentTime+(at||0);
    var o=a.createOscillator(); o.type='sawtooth'; o.frequency.value=f0;
    var lfo=a.createOscillator(), lg=a.createGain(); lfo.frequency.value=5.2; lg.gain.value=vib||f0*0.02;
    lfo.connect(lg); lg.connect(o.frequency);
    var g=a.createGain(); g.gain.setValueAtTime(0.0001,t0); g.gain.exponentialRampToValueAtTime(gain,t0+dur*0.3); g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
    var d=out(0.6); if(!d) return;
    [fm1||700,fm2||1150].forEach(function(fq){ var f=a.createBiquadFilter(); f.type='bandpass'; f.frequency.value=fq; f.Q.value=7; o.connect(f); f.connect(g); });
    g.connect(d);
    o.start(t0); lfo.start(t0); o.stop(t0+dur+0.1); lfo.stop(t0+dur+0.1);
  }
  /* 《月光》：钢琴的音色在声音库（music.piano），这里只排谱 */
  function moonlight(){
    var arp=[207.65, 277.18, 329.63];
    var bass=[69.30, 103.83, 92.50, 103.83, 69.30, 92.50];
    var mel=[415.30, 466.16, 523.25, 466.16, 415.30, 369.99, 415.30, 466.16, 523.25, 622.25, 554.37, 466.16];
    var step=0.155, t=0, bar, i, r;
    function pn(f,at,len,k){ P('music.piano',{pitch:f/440,at:at,len:len,k:k}); }
    for(bar=0;bar<24;bar++){
      var bf=bass[bar%bass.length];
      pn(bf, t, 3.0, 1.0); pn(bf*2, t, 2.4, 0.45);
      for(i=0;i<3;i++) for(r=0;r<3;r++) pn(arp[(i+r)%3], t+(i*3+r)*step, 1.0, 0.55);
      if(bar>=4){
        pn(mel[(bar-4)%mel.length], t+0.20, 1.9, 0.8);
        if(bar%4===2) pn(mel[((bar-4)%mel.length+3)%mel.length], t+1.6, 1.5, 0.6);
      }
      t += 9*step;
    }
  }

  /* ---------- 持续层 ---------- */
  function loopNoise(type,freq,q){
    var a=ctx(), s=a.createBufferSource(); s.buffer=noiseBuf(); s.loop=true;
    var f=a.createBiquadFilter(); f.type=type; f.frequency.value=freq; if(q) f.Q.value=q;
    var g=a.createGain(); g.gain.value=0;
    s.connect(f); f.connect(g); s.start(0,$imports.PresentationRandom.next());
    return {s:s,f:f,g:g};
  }
  /* ---- 整片环境声（soundscape）：模块用 SFX.scape(id, def) 登记，当前要哪一片由 soundscape 钩子决定 ----
     def.build(A) 返回 {gain:GainNode, …}（gain 由这里推子控制），def.tick(dt, A, nodes) 放零星的一次性声音；
     def.bed：原来的铺底、风、嗡声保留多少（默认 0，全换掉）；def.quiet：是否停掉旋律、远处怪声、滴水、上下课铃（默认停）。
     低 SAN 心跳、巡察者心跳、蛾群这些和玩法有关的声音不受影响。 */
  var SCAPES={}, SC_NODES={}, scapeCutUntil=0;
  /* 分类总线：每类声音一条（干声一条、混响一条），增益来自 SOUND_CATS[类].gain（默认 1） */
  var BUS={}, BUSW={};
  function catGain(c){ var C=(typeof $imports.SOUND_CATS!=='undefined')?$imports.SOUND_CATS[c]:null; return C&&typeof C.gain==='number'?C.gain:1; }
  function bus(c){
    var a=ctx(); if(!a) return null;
    var m=master(); if(!m) return null;
    if(!BUS[c]){ var g=a.createGain(); g.gain.value=catGain(c); g.connect(m); BUS[c]=g; }
    return BUS[c];
  }
  function send(c,w){
    var a=ctx(); if(!a||!(w>0)) return null;
    master(); if(!revIn) return null;
    if(!BUSW[c]){ var g=a.createGain(); g.gain.value=catGain(c); g.connect(revIn); BUSW[c]=g; }
    var s=a.createGain(); s.gain.value=w; s.connect(BUSW[c]); return s;
  }
  function synthApi(){
    return {ctx:ctx, master:master, out:out, reverb:function(){ master(); return revIn; }, tone:tone, noise:noise, noiseP:noiseP,
      vowel:vowel, loopNoise:loopNoise, setG:setG, now:function(){ return ac?ac.currentTime:0; },
      bus:bus, send:send, pan:function(p){ var a=ctx(); return a?panNode(a,p):null; }, noiseBuf:noiseBuf};
  }
  function P(id,opt){ if(typeof $imports.SoundCaptions!=='undefined'){var e=$imports.SoundCaptions.publish(id,opt);if(e)opt=Object.assign({},opt,{event:e.dispatch});} try{ return (typeof $imports.SoundPlayer!=='undefined')?$imports.SoundPlayer.play(id,opt):null; }catch(e){ return null; } }
  function scapeTick(dt,on,duck){
    var sid=on?GameModules.first('soundscape'):undefined, sd=sid&&SCAPES[sid]?SCAPES[sid]:null, cut=(L&&L.t<scapeCutUntil)?0:1;
    Object.keys(SCAPES).forEach(function(k){
      var def=SCAPES[k], want=!!sd&&k===sid, n=SC_NODES[k];
      if(want&&!n){ try{ n=SC_NODES[k]=def.build(synthApi()); }catch(e){ SCAPES[k]=null; delete SCAPES[k]; return; } }
      if(!n||!n.gain) return;
      setG(n.gain.gain,want?(def.level||0.06)*duck*cut:0,want?(cut?2.2:0.04):1.4);
      if(want&&cut&&def.tick){ try{ def.tick(dt,synthApi(),n); }catch(e){} }
    });
    return sd;
  }
  function buildLayers(){
    var a=ctx(); if(!a||L) return;
    var d=master(); if(!d) return;
    L={};
    /* BGM 铺底：三根略微走音的振荡器 + 低通，截止频率随紧张度走 */
    L.padF=a.createBiquadFilter(); L.padF.type='lowpass'; L.padF.frequency.value=260; L.padF.Q.value=4;
    L.padG=a.createGain(); L.padG.gain.value=0;
    L.padF.connect(L.padG); L.padG.connect(d);
    var wv=a.createGain(); wv.gain.value=0.35; L.padG.connect(wv); if(revIn) wv.connect(revIn);
    L.osc=[];
    [[55,'sawtooth',0],[82.4,'triangle',4],[55.6,'sawtooth',-6],[110,'sine',2]].forEach(function(p){
      var o=a.createOscillator(); o.type=p[1]; o.frequency.value=p[0]; o.detune.value=p[2];
      var og=a.createGain(); og.gain.value=p[1]==='sine'?0.5:0.33; o.connect(og); og.connect(L.padF); o.start();
      L.osc.push(o);
    });
    L.lfo=a.createOscillator(); L.lfo.frequency.value=0.07; var lg=a.createGain(); lg.gain.value=90;
    L.lfo.connect(lg); lg.connect(L.padF.frequency); L.lfo.start();
    /* 紧张层：小二度的高音簇，颤 */
    L.tenG=a.createGain(); L.tenG.gain.value=0; L.tenG.connect(d);
    var tw=a.createGain(); tw.gain.value=0.5; L.tenG.connect(tw); if(revIn) tw.connect(revIn);
    L.ten=[];
    [880,932.3,1396.9].forEach(function(f){ var o=a.createOscillator(); o.type='sine'; o.frequency.value=f; var og=a.createGain(); og.gain.value=0.33; o.connect(og); og.connect(L.tenG); o.start(); L.ten.push(o); });
    L.trem=a.createOscillator(); L.trem.frequency.value=6.5; var tg=a.createGain(); tg.gain.value=0.5;
    L.tremG=a.createGain(); L.tremG.gain.value=0.5; L.trem.connect(tg); tg.connect(L.tremG.gain);
    /* 风 / 雨 / 嗡声 / 车库低频 */
    L.wind=loopNoise('bandpass',420,0.7); L.wind.g.connect(d);
    L.windLfo=a.createOscillator(); L.windLfo.frequency.value=0.11; var wl=a.createGain(); wl.gain.value=180;
    L.windLfo.connect(wl); wl.connect(L.wind.f.frequency); L.windLfo.start();
    L.rain=loopNoise('lowpass',3600,0.4); L.rain.g.connect(d);
    L.rain2=loopNoise('highpass',5200,0.3); L.rain2.g.connect(d);
    L.humG=a.createGain(); L.humG.gain.value=0; L.humG.connect(d);
    [100,200,300].forEach(function(f,i){ var o=a.createOscillator(); o.type=i===1?'square':'sine'; o.frequency.value=f; var og=a.createGain(); og.gain.value=[0.5,0.06,0.15][i]; o.connect(og); og.connect(L.humG); o.start(); });
    L.rumble=loopNoise('lowpass',90,1.0); L.rumble.g.connect(d);
    L.t=0; L.nextMel=4; L.nextStinger=30; L.nextCricket=1; L.nextDrip=1; L.nextBeat=1; L.lastPeriod=null; L.nextThunder=6;
  }
  /* 脚下是什么：瓷砖、水磨石楼梯、车库水泥、天台碎石、草、塑胶跑道、球场、水泥路；模块可以用 stepSurface 钩子换（例如异空间的白色结构） */
  function stepSurface(){
    var hook; try{ hook=GameModules.first('stepSurface'); }catch(e){}
    if(hook&&typeof $imports.SOUND_BANK!=='undefined'&&$imports.SOUND_BANK['step.'+hook]) return hook;
    if($imports.S.mode==='in'){
      if($imports.S.room==='garage1') return 'garage';
      if($imports.S.room==='teach6') return 'roof';
      var R=$imports.INTERIORS[$imports.S.room];
      if(R&&R.spiral&&$imports.SP.state==='stair') return 'stair';
      return 'tile';
    }
    var mx=$imports.S.x/$imports.SC, my=$imports.S.y/$imports.SC, i, o, hit='road';
    for(i=0;i<$imports.OBJ.length;i++){
      o=$imports.OBJ[i]; if(!(mx>o.x&&mx<o.x+o.w&&my>o.y&&my<o.y+o.h)) continue;
      if(o.k==='court') return 'court';
      if(o.k==='track') hit='track';
      else if((o.k==='field'||o.k==='garden')&&hit==='road') hit='grass';
    }
    return hit;
  }
  function stepWet(){
    return $imports.AN.active&&($imports.AN.id==='rain'||$imports.AN.id==='raindots')&&$imports.S.mode==='out'&&!(0,$imports.underCover)();
  }
  /* 一步：k 是响度（跑起来更响），pan 左右，behind 背后（发闷），at 延迟。左右脚轮流：音高差一点、声像偏一点 */
  var foot=0;
  function stepSound(sf,k,pan,behind,wet,at,extra){
    foot=1-foot;
    var o={k:k,pan:(0,$imports.clamp)((pan||0)+(foot?0.05:-0.05),-1,1),lp:behind?0.55:1,at:at||0,pitch:foot?0.97:1};
    Object.assign(o,extra||{});P('step.'+sf,o);
    if(sf==='court'&&$imports.PresentationRandom.next()<0.12) P('step.squeak',{k:k,pan:o.pan,at:(at||0)+0.02});
    if(wet) P('step.wet',{k:k,pan:o.pan,lp:o.lp,at:o.at});
  }
  /* 混响量：按场景 */
  function spaceWet(){
    if($imports.S.screen!=='play') return 0.9;
    if($imports.S.mode==='out') return 0.35;
    if($imports.S.room==='garage1') return 1.7;
    if($imports.S.room==='bell1') return 1.9;
    if($imports.S.room==='teach6') return 0.4;
    var R=$imports.INTERIORS[$imports.S.room];
    return R&&R.cols*R.rows>900?1.15:0.9;              /* 大的楼层（走廊长）回声多一点 */
  }
  function setG(param,v,tc){ try{ param.setTargetAtTime(v,ac.currentTime,tc||0.6); }catch(e){} }
  var MEL=[[220,261.6,293.7,311.1,392,440,523.3],[207.7,246.9,277.2,311.1,370,415.3,493.9]];
  /* 远处的怪声：随机挑一种，随机方位；四成像是隔着楼板 / 墙 */
  var STINGERS=['dread.knock','dread.whisper','dread.steps','distant.slam','distant.tinnitus','distant.aah',
    'dread.chair','distant.ball','distant.giggle','dread.door','dread.run'];
  function stinger(){
    var id=STINGERS[Math.floor($imports.PresentationRandom.next()*STINGERS.length)];
    P(id,{pan:$imports.PresentationRandom.range(-0.9,0.9),k:$imports.PresentationRandom.range(0.75,1),lp:$imports.PresentationRandom.next()<0.4?0.4:1});
  }
  var lastPeriod=null;
  function tickSchoolBell(){
    if($imports.S.screen!=='play'||$imports.S.dead||$imports.PRO.on||$imports.CUT.on){lastPeriod=null;return;}
    var pp=(0,$imports.periodAt)($imports.S.tsec),sid=GameModules.first('soundscape');
    var quiet=sid&&SCAPES[sid]&&SCAPES[sid].quiet!==false;
    if(lastPeriod!==null&&pp[2]!==lastPeriod&&!quiet)schoolBell($imports.S.mode==='in'?1:.45,pp[3]==='教室'?'start':'end');
    lastPeriod=pp[2];
  }
  GameModules.on('boundary',function(){lastPeriod=null;},{owner:'audio'});
  GameModules.on('reset',function(){lastPeriod=null;},{owner:'audio'});
  function tick(dt){
    var a=ctx(); if(!a||!L) return;
    L.t+=dt;
    /* 骤静：环境声忽然全没了几秒，再慢慢回来 */
    var duck=(L.duckUntil&&L.t<L.duckUntil)?0.05:1, dtc=duck<1?0.18:null;
    var play=($imports.S.screen==='play');
    var on=play&&(typeof $imports.AMB_ON==='undefined'||$imports.AMB_ON)&&!$imports.S.dead;
    var out_=play&&$imports.S.mode==='out', night=1;
    try{ night=1-(0,$imports.sunAt)((0,$imports.hourNow)()).day; }catch(e){}
    var anomaly=$imports.AN.active, id=anomaly?$imports.AN.id:null;
    var san=play?(0,$imports.clamp)($imports.S.san,0,100):100;
    var sanityStress=(0,$imports.clamp)((75-san)/75,0,1);
    var tension=(0,$imports.clamp)((anomaly?0.55:0)+(100-san)/160+($imports.S.viol||0)/220,0,1);
    var garage=play&&$imports.S.mode==='in'&&$imports.S.room==='garage1';
    var scape=scapeTick(dt,on,duck), bedK=scape?(scape.bed||0):1, quietScape=!!scape&&scape.quiet!==false;
    var bd=duck*bedK, btc=bedK<1?0.8:null;            /* 整片环境声接管时：原来的铺底按 bed 缩放（默认全停） */
    /* 混响跟着空间走：车库、钟楼里很空，教室一般，室外几乎没有 */
    if(revIn) setG(revIn.gain,spaceWet(),0.4);
    /* 铺底 */
    setG(L.padG.gain,(on?0.045+0.05*tension:0)*bd,btc||dtc||1.2);
    setG(L.padF.frequency,on?(180+tension*700+(out_?0:-40)):200,1.5);
    var root=garage?41.2:(out_?(night>0.5?49:55):46.25);
    L.osc[0].frequency.setTargetAtTime(root,a.currentTime,2);
    L.osc[1].frequency.setTargetAtTime(root*1.5*(tension>0.6?0.944:1),a.currentTime,2);   /* 紧张时五度降成三全音 */
    L.osc[2].frequency.setTargetAtTime(root*(1.01+sanityStress*0.045),a.currentTime,2);
    L.osc[3].frequency.setTargetAtTime(root*(2-sanityStress*0.11),a.currentTime,2);
    setG(L.tenG.gain,(on?Math.max(0,tension-0.45)*0.05:0)*bd,btc||dtc||0.8);
    /* 环境 */
    var rainOn=on&&anomaly&&(id==='rain'||id==='raindots');
    var cover=rainOn&&$imports.S.mode==='in';
    setG(L.wind.g.gain,(on&&out_?0.020+0.012*night+(rainOn?0.02:0):(on&&$imports.S.room==='teach6'?0.03:0))*bd,btc||dtc||1.0);
    setG(L.rain.g.gain,rainOn?(cover?0.03:0.11):0,0.6);
    setG(L.rain2.g.gain,rainOn?(cover?0.005:0.035):0,0.6);
    setG(L.humG.gain,(on&&$imports.S.mode==='in'&&!garage&&$imports.S.room!=='bell1'&&$imports.S.room!=='teach6'?0.010+0.006*Math.abs(Math.sin(L.t*0.7)):0)*bd,btc||dtc||0.5);
    setG(L.rumble.g.gain,(on&&garage?0.09:(on&&id==='shifting'?0.12:0))*bd,btc||dtc||0.8);
    if(!on||duck<1) return;
    /* 八音盒一样的旋律：稀疏、不成调 */
    L.nextMel-=dt;
    if(L.nextMel<=0&&!quietScape){
      L.nextMel=$imports.PresentationRandom.range(5,11)*(1-tension*0.4);
      var sc=MEL[tension>0.5?1:0], n=1+Math.floor($imports.PresentationRandom.next()*3), j;
      for(j=0;j<n;j++){ var f=sc[Math.floor($imports.PresentationRandom.next()*sc.length)]*($imports.PresentationRandom.next()<0.3?2:1); P('music.box',{pitch:f/440,at:j*$imports.PresentationRandom.range(0.35,0.7)}); }
    }
    /* 夜里室外：虫鸣，偶尔整片同时停下 */
    if(out_&&night>0.6&&!rainOn&&!quietScape){
      L.nextCricket-=dt;
      if(L.nextCricket<=0){
        L.nextCricket=$imports.PresentationRandom.range(0.25,1.1);
        if(Math.sin(L.t*0.05)>-0.7) P('world.cricket',{pitch:$imports.PresentationRandom.range(0.9,1.1),pan:$imports.PresentationRandom.range(-0.8,0.8)});
      }
    }
    if(garage){ L.nextDrip-=dt; if(L.nextDrip<=0){ L.nextDrip=$imports.PresentationRandom.range(0.8,3.0); P('world.drip',{pan:$imports.PresentationRandom.range(-0.7,0.7),wet:0.9}); } }
    if(id==='leak'){ L.nextDrip-=dt; if(L.nextDrip<=0){ L.nextDrip=$imports.PresentationRandom.range(0.3,0.8); P('world.drip',{k:1.3,pan:$imports.PresentationRandom.range(-0.4,0.4)}); } }
    /* 雷声由 fx/weather.js 跟着闪电一起放（SFX.thunder）。打着伞：雨点敲在伞面上；檐下：水往下滴 */
    if(rainOn&&!cover&&$imports.USE.brollyShield){
      var nPat=Math.floor(dt*28+$imports.PresentationRandom.next());
      for(var pi_=0;pi_<nPat;pi_++) P('world.patter',{at:$imports.PresentationRandom.next()*dt,pan:$imports.PresentationRandom.range(-0.6,0.6)});
    }else if(rainOn&&!cover&&(0,$imports.underCover)()){
      L.nextDrip-=dt; if(L.nextDrip<=0){ L.nextDrip=$imports.PresentationRandom.range(0.15,0.6); P('world.drip',{k:0.7,pitch:1.2,pan:$imports.PresentationRandom.range(-0.6,0.6),wet:0.2}); }
    }
    if(id==='chalk'&&$imports.PresentationRandom.next()<dt*3) P('world.chalkScratch');
    if(id==='lamps'&&$imports.PresentationRandom.next()<dt*1.2) P('world.lampFlicker',{pan:$imports.PresentationRandom.range(-0.8,0.8)});
    if(id==='rite'&&$imports.PresentationRandom.next()<dt*0.4) P('world.chant');
    /* 蛾群：离得越近扑翅声越密、越响，左右乱飞 */
    if(id==='moth'){
      var md=(0,$imports.wxMothDist)(), mk=(0,$imports.clamp)(1-md/12,0,1);
      if($imports.PresentationRandom.next()<dt*(5+mk*40)) P('world.moth',{k:0.2+mk,pan:$imports.PresentationRandom.range(-1,1)});
      if(mk>0.6&&$imports.PresentationRandom.next()<dt*6) P('world.mothThump',{k:0.4+mk*0.6});   /* 贴脸时的一团闷响 */
    }
    /* 身体节拍由 Sensory 统一调度，静音和环境关闭仍派发字幕。 */
    L.nextStinger-=dt*(1+tension*1.5);
    if(L.nextStinger<=0&&!quietScape){
      L.nextStinger=$imports.PresentationRandom.range(16,40);
      /* 和 dread.js 的假威胁共用一份惊吓预算：同一片地方不连着响 */
      var okS=true; try{ if(typeof $imports.Dread!=='undefined') okS=!(0,$imports.dreadBusy)()&&$imports.Dread.allow(1); }catch(e){}
      if(okS){ stinger(); try{ if(typeof $imports.Dread!=='undefined') $imports.Dread.note('stinger',1); }catch(e){} }
    }
    /* 屋里夜里：不知道哪儿在滴水；偶尔一声暖气片 / 墙里的「咔」 */
    if(!out_&&!garage&&night>0.5&&!quietScape){
      L.nextIndoorDrip=(L.nextIndoorDrip||2)-dt;
      if(L.nextIndoorDrip<=0){ L.nextIndoorDrip=$imports.PresentationRandom.range(2.5,7); P('world.drip',{k:0.35,pitch:1.3,pan:$imports.PresentationRandom.range(-0.9,0.9),wet:1}); }
      if($imports.PresentationRandom.next()<dt*0.03) P('world.creak',{pan:$imports.PresentationRandom.range(-1,1)});
    }
  }
  /* kind：'start' 上课铃、'end' 下课铃（默认）；v 响度，室外给 0.45 时同时发闷 */
  function schoolBell(v,kind){
    v=v===undefined?1:v;
    var tune=null; try{ tune=GameModules.first('bellTune',kind||'end'); }catch(e){}   /* 模块可以让铃声走调（氛围 A5） */
    var o={k:v,lp:v<0.7?0.6:1};
    if(tune){if(tune.pitch>0)o.pitch=tune.pitch;if(tune.tail>0)o.tail=tune.tail;if(tune.tailLength>0)o.tailLength=tune.tailLength;if(tune.caption)o.caption=tune.caption;}
    return P(kind==='start'?'event.bellStart':'event.bellEnd',o);
  }
  function deathKinds(){
    var out=[]; if(typeof $imports.SoundPlayer==='undefined') return out;
    $imports.SoundPlayer.ids().forEach(function(id){ if(id.indexOf('death.')===0&&id!=='death.base'&&id!=='death.generic') out.push(id.slice(6)); });
    return out;
  }
  return {
    moonlight: moonlight,
    available:function(){return !!(ac&&ac.state==='running');},
    bodySound:function(kind,k){return P(kind==='chase'?'threat.heartPat':kind==='muffled'?'distant.tinnitus':kind==='breath'?'threat.breath':'threat.heartLow',{k:k||.5});},
    resume:function(){ ctx(); },
    ambient:function(){ var a=ctx(); if(!a) return; try{ buildLayers(); }catch(e){} bgOn=true; },
    /* 模块扩展点：整片环境声与一次性合成音（见文件中段 SCAPES 的说明） */
    scape:function(id,def){ if(id&&def&&typeof def.build==='function') SCAPES[id]=def; },
    scapeCut:function(sec){ var a=ctx(); if(!a) return; scapeCutUntil=(L?L.t:0)+Math.max(0,sec||0); Object.keys(SC_NODES).forEach(function(k){ var n=SC_NODES[k]; if(n&&n.gain) setG(n.gain.gain,0,0.03); }); },
    scapeNow:function(){ var sid=GameModules.first('soundscape'); return (sid&&SCAPES[sid])?sid:null; },
    synth:function(){ return synthApi(); },
    stopAmbient:function(){ bgOn=false; },
    tick:function(dt){
      if($imports.S.screen==='play'&&!$imports.GamePolicy.simulationAllowed((0,$imports.gameInputContext)()))return;
      try{ tickSchoolBell(); realRev(); }catch(e){}                       /* 空间混响不依赖背景音：关掉「音乐/环境」时脚步等音效也要跟着空间变 */
      try{ if(L) tick(dt); else if(bgOn) buildLayers(); }catch(e){}
    },
    setVol:function(v){ vol=Math.max(0,Math.min(1,v)); if(mg){ try{ mg.gain.value=vol; }catch(e){} } },
    getVol:function(){ return vol; },
    surface:function(){ return stepSurface(); },
    space:function(){ return spCur; },                /* 真实档当前用的混响空间（测试用） */
    step:function(){
      stepSound(stepSurface(),$imports.S.run?1.35:1,0,0,stepWet());
      /* 回访变化：这间屋子今天多了一层回声，像有人跟着你走，慢半拍 */
      try{ if(typeof $imports.DREAD!=='undefined'&&$imports.DREAD.echo) stepSound(stepSurface(),0.32,0.25,true,false,0.19); }catch(e){}
    },
    /* 有方位、有远近、隔墙发闷的环境声（dread.js 的假威胁）：p={pan,k,muffled,behind} */
    dread:function(kind,p){
      p=p||{pan:0,k:0.5,muffled:false,behind:false};
      return P('dread.'+kind,{pan:(0,$imports.clamp)(p.pan||0,-1,1),k:(0,$imports.clamp)(p.k||0.5,0.05,1),lp:(p.muffled?0.35:1)*(p.behind?0.7:1),wet:p.muffled?0.85:0.5,place:p});
    },
    /* 骤静 */
    duck:function(sec){ if(L) L.duckUntil=L.t+Math.max(0.5,sec||3); },
    ducking:function(){ return !!(L&&L.duckUntil&&L.t<L.duckUntil); },
    /* 异象前兆：低频的压迫感上来，耳朵里一点压力 */
    precursor:function(k){ return P('threat.precursor',{k:(0,$imports.clamp)(k===undefined?1:k,0.2,1)}); },
    /* 巡察者的脚步：按方位分左右，越近越响，背后的发闷 */
    patStep:function(pan,k,behind,locked,place){ stepSound(stepSurface(),(locked?1.5:1.1)*k,pan,behind,stepWet(),0,{lp:(place&&place.muffled?.35:1)*(behind?.55:1),patrol:true,source:'nearby-steps',place:Object.assign({pan:pan,behind:behind},place||{})}); },
    /* 灯管接触不良：噼啪 + 一下 50Hz 的嗡 */
    crackle:function(k,pan){ k=(0,$imports.clamp)(k,0,1); if(k<0.05) return null; return P('world.crackle',{k:k,pan:pan||0}); },
    /* 拍肩的笑脸：回头时是身后一串很轻的、憋着的笑；突脸时是一声尖叫贴着耳朵 */
    smile:function(mode){ return P(mode==='jump'?'threat.smileJump':'threat.smileBack',mode==='jump'?{}:{pan:0.3,lp:0.8}); },
    /* 清华水杯：往下掉的风声和哨音；落地按离你多远决定多响 */
    cupFall:function(dur){ return P('foley.cupFall',{len:Math.max(0.2,dur||1.2)}); },
    cupHit:function(missM){ return P('foley.cupHit',{k:(0,$imports.clamp)(1-missM/14,0.15,1)}); },
    /* 天降可乐：高处磕一下再滚（pan 一侧）；往下掉；落地「嘭」一声、长长的「嘶——」 */
    colaRattle:function(pan,dur){ return P('foley.colaRattle',{pan:pan||0,len:dur||1.6}); },
    colaFall:function(dur){ return P('foley.colaFall',{len:Math.max(0.2,dur||1.2)}); },
    colaHit:function(missM){ return P('foley.colaHit',{k:(0,$imports.clamp)(1-missM/14,0.15,1)}); },
    /* 雷：近的先一声炸裂再滚，远的只有闷闷的滚 */
    thunder:function(delay,str,muffled){
      str=(0,$imports.clamp)(str===undefined?1:str,0.2,1);
      return P(str>0.7?'event.thunder':'event.thunderFar',{at:delay||0,k:str,lp:muffled?0.45:1});
    },
    click:function(){ return P('ui.click'); },
    blink:function(){ return P('ui.blink'); },
    door:function(){ return P('foley.door'); },
    stairs:function(){ return P('foley.stairs'); },
    pickup:function(){ return P('ui.pickup'); },
    /* 成就四档（n / e / p / h）与结算画面四组评级（low / mid / high / top） */
    achieve:function(t){ return P('ui.achieve.'+({n:'normal',e:'elite',p:'epic',h:'hidden'}[t]||'normal')); },
    grade:function(band){ return P('ui.grade.'+(band||'mid')); },
    chalk:function(){ return P('foley.chalk'); },                     /* 用粉笔画记号 */
    deep:function(){ return P('void.fall'); },                        /* 掉进异空间的虚空 */
    anim:function(mode){ var dur=mode===2?3.0:(mode===3?2.6:2.4); $imports.VisualState.deathAnim={mode:mode,t:0,dur:dur}; },
    death:function(){ return P('death.generic'); },
    deathKinds:deathKinds,
    deathFx:function(type){ P('death.base'); return P('death.'+type); },
    stopDeath:function(){ return (typeof $imports.SoundPlayer!=='undefined')?$imports.SoundPlayer.stop('death'):0; },
    sting:function(){ return P('threat.sting'); },
    wake:function(){ return P('foley.wake'); },
    bell:function(){ return P('event.bell'); },
    bigBell:function(v){ return P('event.bigBell',{k:v===undefined?1:v}); },
    schoolBell:schoolBell,
    cue:function(id,opt){return P(id,opt);},
    vanish:function(){ return P('foley.vanish'); },                   /* 远处的人影不见了的那一下 */
    /* 结局演出：车库里点火；门那边装置充能的嗡声越来越高 */
    engine:function(){ return P('scene.engine'); },
    hum:function(){ return P('scene.hum'); },
    alarm:function(){ return P('ui.alarm'); },
    anomaly:function(id){
      P('anomaly.base');                                              /* 每次异象开头：一声很低的下沉 */
      var o={};
      if(id==='cup'){ try{ o.len=(typeof $imports.cupWobble==='function')?(0,$imports.cupWobble)():0.9; }catch(e){ o.len=0.9; } }   /* 叮当响在晃的那一段里，掉下来之前停 */
      return P('anomaly.'+id,o);
    },
    anomalyEnd:function(id){ return P('anomaly.end'); }
  };
})();

/* @module-exports */
GameModules.publish("game3d/js/audio.js",{
"SFX":{get:function(){return SFX;},set:function($value){SFX=$value;}}
});
})(GameModules.imports("game3d/js/audio.js"));
