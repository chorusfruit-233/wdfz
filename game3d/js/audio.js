/* 里世界 3D · 声音（Web Audio 合成） */
'use strict';

/* ================= 声音 =================
   全部用 Web Audio 现场合成，不加载任何文件（单文件、离线可玩）。
   master ─┬─ 直达
           └─ 混响（生成的冲激响应）
   持续层：低音铺底（BGM）· 室外风 / 夜里虫鸣 · 室内灯管嗡声 · 车库滴水 · 雨 · 心跳
   一次性：脚步（分室内外）、门、楼梯、拾取、铃、每种异象 / 死亡各自的声音、远处的怪声 */
var SFX=(function(){
  var ac=null,ready=false;
  function ensure(){
    if(ready) return ac;
    try{ ac=new (window.AudioContext||window.webkitAudioContext)(); ready=true; }catch(e){ ready=false; }
    return ac;
  }
  var mg=null, vol=0.7, rev=null, revIn=null, NB=null, L=null, bgOn=false;
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
        for(ch=0;ch<2;ch++){ var dd=ib.getChannelData(ch); for(i=0;i<len;i++) dd[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.6); }
        rev.buffer=ib;
        revIn=a.createGain(); revIn.gain.value=0.9;
        revIn.connect(rev); rev.connect(mg);
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
  function noiseBuf(){
    var a=ctx(); if(!a) return null;
    if(!NB){
      var n=a.sampleRate*2; NB=a.createBuffer(1,n,a.sampleRate);
      var d=NB.getChannelData(0); for(var i=0;i<n;i++) d[i]=Math.random()*2-1;
    }
    return NB;
  }
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
    s.start(t0,Math.random()*1.5); s.stop(t0+dur+0.05);
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
    if(a.createStereoPanner){ var pn=a.createStereoPanner(); pn.pan.value=clamp(pan||0,-1,1); g.connect(pn); last=pn; }
    var _d=out(wet||0); if(_d) last.connect(_d);
    s.start(t0,Math.random()*1.5); s.stop(t0+dur+0.05);
  }
  function note(freq, at, dur, gain, type, wet){ tone(freq,dur,type,gain,0,at,wet); }
  /* 铜钟：非整数倍泛音 */
  function bellHit(f0,gain,at,wet){
    var parts=[[0.5,1.0],[1.0,0.7],[1.19,0.45],[1.56,0.3],[2.0,0.35],[2.74,0.18],[3.76,0.1]];
    for(var i=0;i<parts.length;i++) tone(f0*parts[i][0],4.2-i*0.4,'sine',gain*parts[i][1],0,at||0,wet===undefined?0.5:wet);
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
  function moonlight(){
    var arp=[207.65, 277.18, 329.63];
    var bass=[69.30, 103.83, 92.50, 103.83, 69.30, 92.50];
    var mel=[415.30, 466.16, 523.25, 466.16, 415.30, 369.99, 415.30, 466.16, 523.25, 622.25, 554.37, 466.16];
    var step=0.155, t=0, bar, i, r;
    for(bar=0;bar<24;bar++){
      var bf=bass[bar%bass.length];
      note(bf, t, 3.0, 0.052, 'sine',0.3);
      note(bf*2, t, 2.4, 0.026, 'triangle',0.3);
      for(i=0;i<3;i++) for(r=0;r<3;r++) note(arp[(i+r)%3], t+(i*3+r)*step, 1.0, 0.034, 'sine',0.35);
      if(bar>=4){
        note(mel[(bar-4)%mel.length], t+0.20, 1.9, 0.040, 'sine',0.4);
        if(bar%4===2) note(mel[((bar-4)%mel.length+3)%mel.length], t+1.6, 1.5, 0.032, 'sine',0.4);
      }
      t += 9*step;
    }
  }

  /* ---------- 持续层 ---------- */
  function loopNoise(type,freq,q){
    var a=ctx(), s=a.createBufferSource(); s.buffer=noiseBuf(); s.loop=true;
    var f=a.createBiquadFilter(); f.type=type; f.frequency.value=freq; if(q) f.Q.value=q;
    var g=a.createGain(); g.gain.value=0;
    s.connect(f); f.connect(g); s.start(0,Math.random());
    return {s:s,f:f,g:g};
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
  /* 脚下是什么：瓷砖、水磨石楼梯、车库水泥、天台碎石、草、塑胶跑道、球场、水泥路 */
  function stepSurface(){
    if(S.mode==='in'){
      if(S.room==='garage1') return 'garage';
      if(S.room==='teach6') return 'roof';
      var R=INTERIORS[S.room];
      if(R&&R.spiral&&SP.state==='stair') return 'stair';
      return 'tile';
    }
    var mx=S.x/SC, my=S.y/SC, i, o, hit='road';
    for(i=0;i<OBJ.length;i++){
      o=OBJ[i]; if(!(mx>o.x&&mx<o.x+o.w&&my>o.y&&my<o.y+o.h)) continue;
      if(o.k==='court') return 'court';
      if(o.k==='track') hit='track';
      else if((o.k==='field'||o.k==='garden')&&hit==='road') hit='grass';
    }
    return hit;
  }
  function stepWet(){
    return AN.active&&(AN.id==='rain'||AN.id==='raindots')&&S.mode==='out'&&!underCover();
  }
  /* 一步：k 是响度（跑起来更响），pan 左右，behind 背后（发闷） */
  function stepSound(sf,k,pan,behind,wet){
    var lp=behind?0.55:1, j;
    if(sf==='tile'){ noiseP(0.07,0.036*k,1150*lp,0,'bandpass',1.2,pan,0.25); noiseP(0.02,0.018*k,3200*lp,0,'highpass',0.7,pan,0.2); }
    else if(sf==='stair'){ noiseP(0.08,0.04*k,800*lp,0,'bandpass',1.0,pan,0.5); tone(150,0.09,'sine',0.03*k,90,0,0.5); }
    else if(sf==='garage'){ noiseP(0.09,0.04*k,900*lp,0,'bandpass',1.0,pan,0.9); noiseP(0.03,0.02*k,2600*lp,0.01,'bandpass',2,pan,0.9); }
    else if(sf==='roof'){ for(j=0;j<3;j++) noiseP(0.035,0.022*k,rnd(2400,4200)*lp,j*0.025,'bandpass',1.5,pan,0.08); }
    else if(sf==='grass'){ noiseP(0.14,0.024*k,2600*lp,0,'bandpass',0.5,pan,0.03,0.04); noiseP(0.06,0.012*k,5000*lp,0.03,'highpass',0.5,pan,0); }
    else if(sf==='track'){ noiseP(0.08,0.045*k,300*lp,0,'lowpass',0.9,pan,0.03); }
    else if(sf==='court'){ noiseP(0.06,0.04*k,1400*lp,0,'bandpass',1.4,pan,0.1); if(Math.random()<0.12) tone(rnd(2200,2600),0.06,'sine',0.006*k,2700,0.02); }
    else { noiseP(0.11,0.042*k,420*lp,0,'lowpass',0.7,pan,0.05); }
    if(wet){ noiseP(0.12,0.03*k,1700*lp,0.01,'bandpass',0.8,pan,0.05,0.02); noiseP(0.05,0.012*k,4200*lp,0.04,'highpass',0.5,pan,0); }
  }
  /* 混响量：按场景 */
  function spaceWet(){
    if(S.screen!=='play') return 0.9;
    if(S.mode==='out') return 0.35;
    if(S.room==='garage1') return 1.7;
    if(S.room==='bell1') return 1.9;
    if(S.room==='teach6') return 0.4;
    var R=INTERIORS[S.room];
    return R&&R.cols*R.rows>900?1.15:0.9;              /* 大的楼层（走廊长）回声多一点 */
  }
  function setG(param,v,tc){ try{ param.setTargetAtTime(v,ac.currentTime,tc||0.6); }catch(e){} }
  var MEL=[[220,261.6,293.7,311.1,392,440,523.3],[207.7,246.9,277.2,311.1,370,415.3,493.9]];
  /* 远处的怪声：随机挑一种 */
  function stinger(){
    var k=Math.floor(Math.random()*11), i, pan=rnd(-0.9,0.9);
    if(k>=6){                                                                                          /* 新的几种：有方位（左右） */
      if(k===6){ for(i=0;i<3;i++) noiseP(rnd(0.5,0.9),0.035,rnd(220,360),i*rnd(0.9,1.4),'lowpass',2.5,pan,0.5,0.15); }   /* 楼上有人在拖椅子 */
      else if(k===7){ var t0=0, g0=0.05; for(i=0;i<9;i++){ noiseP(0.05,g0,600,t0,'lowpass',3,pan,0.6); t0+=0.42*Math.pow(0.78,i); g0*=0.82; } }   /* 一个球在地上弹，越弹越快、越轻 */
      else if(k===8){ for(i=0;i<4;i++) vowel(rnd(330,420),0.12,0.010,i*0.16,900,1500,6); }            /* 很轻的一串笑 */
      else if(k===9){ tone(95,1.6,'sawtooth',0.012,140,0,0.6); noiseP(1.4,0.02,700,0.1,'bandpass',4,pan,0.6,0.4); }   /* 一扇门慢慢被推开 */
      else { for(i=0;i<10;i++) noiseP(0.08,0.03,rnd(250,380),i*0.21,'lowpass',2,pan*(1-i/12),0.7); }   /* 头顶上有人跑过去 */
      return;
    }
    if(k===0){ for(i=0;i<3;i++) noise(0.09,0.06,260,i*0.32,'lowpass',2,0.7); }                     /* 三下敲门 */
    else if(k===1){ for(i=0;i<6;i++) noise(0.3,0.012,1800+Math.random()*900,i*0.18,'bandpass',6,0.8,0.12); } /* 低语 */
    else if(k===2){ for(i=0;i<5;i++) noise(0.12,0.03,380,i*0.52,'lowpass',1,0.6); }                 /* 背后有脚步 */
    else if(k===3){ noise(0.5,0.08,180,0,'lowpass',1,0.8); tone(70,0.6,'sine',0.06,40,0,0.6); }      /* 远处一扇门被摔上 */
    else if(k===4){ tone(1240,2.2,'sine',0.010,1180,0,0.9); tone(1310,2.2,'sine',0.008,1250,0.1,0.9); } /* 耳鸣 */
    else { vowel(240,1.6,0.012,0,500,900,8); }                                                     /* 一声很远的"啊——" */
  }
  function tick(dt){
    var a=ctx(); if(!a||!L) return;
    L.t+=dt;
    var play=(S.screen==='play');
    var on=play&&(typeof AMB_ON==='undefined'||AMB_ON)&&!S.dead;
    var out_=play&&S.mode==='out', night=1;
    try{ night=1-sunAt(hourNow()).day; }catch(e){}
    var anomaly=AN.active, id=anomaly?AN.id:null;
    var san=play?clamp(S.san,0,100):100;
    var tension=clamp((anomaly?0.55:0)+(100-san)/160+(S.viol||0)/220,0,1);
    var garage=play&&S.mode==='in'&&S.room==='garage1';
    /* 混响跟着空间走：车库、钟楼里很空，教室一般，室外几乎没有 */
    if(revIn) setG(revIn.gain,spaceWet(),0.4);
    /* 铺底 */
    setG(L.padG.gain,on?0.045+0.05*tension:0,1.2);
    setG(L.padF.frequency,on?(180+tension*700+(out_?0:-40)):200,1.5);
    var root=garage?41.2:(out_?(night>0.5?49:55):46.25);
    L.osc[0].frequency.setTargetAtTime(root,a.currentTime,2);
    L.osc[1].frequency.setTargetAtTime(root*1.5*(tension>0.6?0.944:1),a.currentTime,2);   /* 紧张时五度降成三全音 */
    L.osc[2].frequency.setTargetAtTime(root*1.01,a.currentTime,2);
    L.osc[3].frequency.setTargetAtTime(root*2,a.currentTime,2);
    setG(L.tenG.gain,on?Math.max(0,tension-0.45)*0.05:0,0.8);
    /* 环境 */
    var rainOn=on&&anomaly&&(id==='rain'||id==='raindots');
    var cover=rainOn&&S.mode==='in';
    setG(L.wind.g.gain,on&&out_?0.020+0.012*night+(rainOn?0.02:0):(on&&S.room==='teach6'?0.03:0),1.0);
    setG(L.rain.g.gain,rainOn?(cover?0.03:0.11):0,0.6);
    setG(L.rain2.g.gain,rainOn?(cover?0.005:0.035):0,0.6);
    setG(L.humG.gain,on&&S.mode==='in'&&!garage&&S.room!=='bell1'&&S.room!=='teach6'?0.010+0.006*Math.abs(Math.sin(L.t*0.7)):0,0.5);
    setG(L.rumble.g.gain,on&&garage?0.09:(on&&id==='shifting'?0.12:0),0.8);
    if(!on) return;
    /* 八音盒一样的旋律：稀疏、不成调 */
    L.nextMel-=dt;
    if(L.nextMel<=0){
      L.nextMel=rnd(5,11)*(1-tension*0.4);
      var sc=MEL[tension>0.5?1:0], n=1+Math.floor(Math.random()*3), j;
      for(j=0;j<n;j++){ var f=sc[Math.floor(Math.random()*sc.length)]*(Math.random()<0.3?2:1); note(f,j*rnd(0.35,0.7),2.6,0.016,'triangle',0.8); }
    }
    /* 夜里室外：虫鸣，偶尔整片同时停下 */
    if(out_&&night>0.6&&!rainOn){
      L.nextCricket-=dt;
      if(L.nextCricket<=0){
        L.nextCricket=rnd(0.25,1.1);
        if(Math.sin(L.t*0.05)>-0.7){ var cf=rnd(4200,5200); for(var c=0;c<3;c++) tone(cf,0.035,'sine',0.006,cf*0.98,c*0.06); }
      }
    }
    if(garage){ L.nextDrip-=dt; if(L.nextDrip<=0){ L.nextDrip=rnd(0.8,3.0); tone(rnd(900,1500),0.12,'sine',0.03,400,0,0.8); } }
    if(id==='leak'){ L.nextDrip-=dt; if(L.nextDrip<=0){ L.nextDrip=rnd(0.3,0.8); tone(rnd(700,1300),0.10,'sine',0.04,300,0,0.6); } }
    /* 雷声由 fx/weather.js 跟着闪电一起放（SFX.thunder）。打着伞：雨点敲在伞面上；檐下：水往下滴 */
    if(rainOn&&!cover&&USE.brollyShield){
      var nPat=Math.floor(dt*28+Math.random());
      for(var pi_=0;pi_<nPat;pi_++) tone(rnd(2600,4200),0.03,'sine',rnd(0.004,0.010),rnd(1800,2400),Math.random()*dt);
    }else if(rainOn&&!cover&&underCover()){
      L.nextDrip-=dt; if(L.nextDrip<=0){ L.nextDrip=rnd(0.15,0.6); tone(rnd(1100,1800),0.08,'sine',0.02,500,0,0.3); }
    }
    if(id==='chalk'&&Math.random()<dt*3) noise(rnd(0.08,0.2),0.015,3200,0,'bandpass',4);
    if(id==='lamps'&&Math.random()<dt*1.2){ noise(0.04,0.04,4000,0,'highpass'); tone(120,0.25,'square',0.012,118); }
    if(id==='rite'&&Math.random()<dt*0.4) vowel(rnd(98,110),3.2,0.02,0,520,860,1.5);
    /* 蛾群：离得越近扑翅声越密、越响，左右乱飞 */
    if(id==='moth'){
      var md=wxMothDist(), mk=clamp(1-md/12,0,1);
      if(Math.random()<dt*(5+mk*40)) noiseP(rnd(0.03,0.07),0.006+mk*0.03,rnd(1400,2800),0,'bandpass',3,rnd(-1,1),0.15);
      if(mk>0.6&&Math.random()<dt*6) noise(0.12,0.01+mk*0.02,rnd(180,260),0,'lowpass',2);   /* 贴脸时的一团闷响 */
    }
    /* 被巡察者盯上：心跳顶上来 */
    if(PAT.locked&&S.mode===(PAT.room==='out'?'out':'in')){
      L.nextPatBeat=(L.nextPatBeat||0)-dt;
      if(L.nextPatBeat<=0){ L.nextPatBeat=60/124; tone(60,0.16,'sine',0.09,40); tone(54,0.18,'sine',0.065,36,0.15); }
    }
    /* 低 SAN：心跳 */
    if(san<38){
      L.nextBeat-=dt;
      if(L.nextBeat<=0){
        var bpm=70+(38-san)*2.2; L.nextBeat=60/bpm;
        var hv=0.05+(38-san)/38*0.07;
        tone(58,0.18,'sine',hv,38); tone(52,0.2,'sine',hv*0.7,34,0.16);
      }
    }
    /* 上下课铃：时段一变就响 */
    try{
      var per=periodAt(S.tsec)[2];
      if(L.lastPeriod!==null&&per!==L.lastPeriod&&S.mode==='in'){ schoolBell(); }
      else if(L.lastPeriod!==null&&per!==L.lastPeriod){ schoolBell(0.4); }
      L.lastPeriod=per;
    }catch(e){}
    L.nextStinger-=dt*(1+tension*1.5);
    if(L.nextStinger<=0){ L.nextStinger=rnd(16,40); stinger(); }
    /* 屋里夜里：不知道哪儿在滴水；偶尔一声暖气片 / 墙里的「咔」 */
    if(!out_&&!garage&&night>0.5){
      L.nextIndoorDrip=(L.nextIndoorDrip||2)-dt;
      if(L.nextIndoorDrip<=0){ L.nextIndoorDrip=rnd(2.5,7); tone(rnd(1100,1700),0.10,'sine',0.010,500,0,0.9); }
      if(Math.random()<dt*0.03) noiseP(0.03,0.04,1800,0,'highpass',1,rnd(-1,1),0.7);
    }
  }
  function schoolBell(v){
    v=v===undefined?1:v;
    var a=ctx(); if(!a) return;
    var i; for(i=0;i<22;i++){ tone(i%2?1046:988,0.11,'square',0.010*v,0,i*0.11,0.5); }
    for(i=0;i<22;i++){ noise(0.05,0.006*v,3000,i*0.11,'bandpass',2,0.4); }
  }
  var DEATH_SND={
    drown:function(){ for(var i=0;i<14;i++) tone(rnd(300,700),0.12,'sine',0.05,rnd(900,1400),i*0.12+Math.random()*0.05,0.4); noise(2.4,0.10,600,0,'lowpass',0.5,0.5,0.6); },
    swarm:function(){ for(var i=0;i<40;i++) noise(0.06,0.03,rnd(1200,3000),i*0.05,'bandpass',3); },
    ring:function(){ vowel(98,3.4,0.05,0,520,860,1.5); vowel(147,3.4,0.03,0.2,600,1000,1.5); bellHit(196,0.05,0.4); },
    neck:function(){ for(var i=0;i<10;i++) noise(0.14,0.05,rnd(200,500),i*0.24,'lowpass',4,0.4); tone(80,2.4,'sawtooth',0.04,260,0.3,0.3); },
    laugh:function(){ for(var i=0;i<9;i++) vowel(220+i*12,0.22,0.05,i*0.24,800,1250,4); },
    bell:function(){ bellHit(110,0.1,0); bellHit(110,0.08,1.4); },
    voice:function(){ noise(1.6,0.05,2000,0,'bandpass',1.5,0.3); vowel(160,1.6,0.04,0.2,600,1700,6); },
    follow:function(){ for(var i=0;i<8;i++){ noise(0.08,0.07,300,i*0.5,'lowpass'); tone(i%4===0?440:330,0.1,'square',0.012,0,i*0.5); } },
    lamps:function(){ for(var i=0;i<8;i++) noise(0.05,0.05,5000,i*0.18,'highpass'); noise(0.4,0.12,1200,1.6,'lowpass',1,0.5); },
    gaze:function(){ tone(1800,1.4,'sawtooth',0.02,2400,0,0.6); tone(1900,1.4,'sawtooth',0.02,2550,0,0.6); },
    stare:function(){ for(var i=0;i<30;i++) noise(0.12,0.025,rnd(300,900),0.6+Math.random()*0.2,'lowpass',2,0.3); },
    freeze:function(){ for(var i=0;i<20;i++) tone(rnd(2500,4500),0.08,'sine',0.02,0,i*0.07,0.6); },
    shatter:function(){ for(var i=0;i<26;i++) tone(rnd(2000,5200),0.3,'triangle',0.03,0,i*0.03,0.5); },
    grip:function(){ noise(0.25,0.12,500,0); for(var i=0;i<6;i++) noise(0.2,0.04,250,0.3+i*0.2,'lowpass',2); },
    names:function(){ for(var i=0;i<12;i++) vowel(130+Math.random()*80,0.3,0.03,i*0.12,600,1000,2); }
  };
  return {
    moonlight: moonlight,
    resume:function(){ ctx(); },
    ambient:function(){ var a=ctx(); if(!a) return; try{ buildLayers(); }catch(e){} bgOn=true; },
    stopAmbient:function(){ bgOn=false; },
    tick:function(dt){ try{ if(L) tick(dt); else if(bgOn) buildLayers(); }catch(e){} },
    setVol:function(v){ vol=Math.max(0,Math.min(1,v)); if(mg){ try{ mg.gain.value=vol; }catch(e){} } },
    getVol:function(){ return vol; },
    surface:function(){ return stepSurface(); },
    step:function(){ stepSound(stepSurface(),S.run?1.35:1,0,0,stepWet()); },
    /* 巡察者的脚步：按方位分左右，越近越响，背后的发闷 */
    patStep:function(pan,k,behind,locked){ stepSound(stepSurface(),(locked?1.5:1.1)*k,pan,behind,stepWet()); },
    /* 灯管接触不良：噼啪 + 一下 50Hz 的嗡 */
    crackle:function(k,pan){
      k=clamp(k,0,1); if(k<0.05) return;
      var i, n=2+Math.floor(Math.random()*3);
      for(i=0;i<n;i++) noiseP(0.018,0.05*k,rnd(3500,6500),i*rnd(0.02,0.05),'highpass',0.7,pan,0.2);
      tone(100,0.14,'square',0.012*k,98,0,0.2);
    },
    /* 拍肩的笑脸：回头时是身后一串很轻的、憋着的笑；突脸时是一声尖叫贴着耳朵 */
    smile:function(mode){
      var i;
      if(mode==='jump'){
        tone(46,1.4,'sawtooth',0.12,28,0,0.3); noise(0.5,0.16,2400,0,'bandpass',0.7,0.4,0.004);
        vowel(520,0.9,0.09,0,900,2600,30); vowel(780,0.8,0.06,0.02,1100,3000,40);
      }else{
        for(i=0;i<5;i++) vowel(rnd(300,340),0.14,0.022,0.1+i*0.16,500,1700,4);
      }
    },
    /* 清华水杯：往下掉的风声和哨音；落地按离你多远决定多响 */
    cupFall:function(dur){
      tone(2200,dur,'sine',0.018,650,0,0.2);
      noise(dur,0.03,900,0,'bandpass',1.2,0.1,dur*0.8);
    },
    cupHit:function(missM){
      var k=clamp(1-missM/14,0.15,1);
      bellHit(620,0.035*k,0,0.4);                                     /* 不锈钢的「当」 */
      noise(0.18,0.16*k,1800,0,'bandpass',0.8,0.3);
      noise(0.5,0.09*k,240,0,'lowpass',1,0.4);
      for(var i=0;i<4;i++) tone(rnd(1400,2400),0.05,'triangle',0.02*k,0,0.25+i*rnd(0.12,0.2),0.3);   /* 杯盖滚开 */
    },
    /* 雷：近的先一声炸裂再滚，远的只有闷闷的滚 */
    thunder:function(delay,str,muffled){
      str=clamp(str===undefined?1:str,0.2,1); var lp=muffled?0.55:1;
      if(str>0.7) noise(0.35,0.16*str*lp,muffled?900:2400,delay,'lowpass',0.7,0.4,0.004);
      noise(3.6,0.20*str*lp,muffled?110:170,delay+0.05,'lowpass',0.8,0.7,0.25);
      noise(2.4,0.12*str*lp,muffled?80:110,delay+0.9,'lowpass',1.2,0.8,0.5);
      tone(38,2.8,'sine',0.06*str*lp,30,delay+0.1,0.5);
    },
    click:function(){ tone(880,0.05,'square',0.02,400); },
    blink:function(){ tone(1400,0.16,'sine',0.04,300); },
    door:function(){ tone(140,0.5,'sawtooth',0.018,260,0,0.3); noise(0.4,0.03,900,0.05,'bandpass',3,0.3,0.15); noise(0.07,0.06,600,0.48,'lowpass'); },
    stairs:function(){ for(var i=0;i<5;i++) noise(0.07,0.04,1000,i*0.16,'bandpass',1.2,0.6); },
    pickup:function(){ tone(1320,0.18,'sine',0.025,0,0,0.5); tone(1760,0.22,'sine',0.018,0,0.06,0.5); },
    anim:function(mode){ var dur=mode===2?3.0:(mode===3?2.6:2.4); VisualState.deathAnim={mode:mode,t:0,dur:dur}; },
    death:function(){ tone(70,1.6,'sawtooth',0.11,24); noise(1.4,0.07,240); },
    deathFx:function(type){
      tone(55,2.2,'sawtooth',0.10,22,0,0.3); noise(1.6,0.08,240,0,'lowpass',1,0.4);
      tone(1500,0.9,'sawtooth',0.018,900,0.05,0.6); tone(1590,0.9,'sawtooth',0.018,960,0.05,0.6);
      var f=DEATH_SND[type]; if(f) try{ f(); }catch(e){}
    },
    sting:function(){ tone(46,1.2,'sawtooth',0.08,30); tone(1250,0.6,'sawtooth',0.02,800,0,0.6); tone(1330,0.6,'sawtooth',0.02,850,0,0.6); noise(0.4,0.06,700,0,'lowpass',1,0.4); },
    wake:function(){ noise(0.6,0.05,1200,0,'lowpass',0.7,0.5,0.25); tone(220,1.8,'sine',0.03,110,0.1,0.8); },
    bell:function(){ bellHit(220,0.05,0); },
    bigBell:function(v){ bellHit(98,0.12*(v===undefined?1:v),0,0.7); },
    schoolBell:schoolBell,
    vanish:function(){ noise(0.5,0.035,140,0,'lowpass',1,0.7,0.05); tone(52,0.6,'sine',0.03,38,0,0.5); },   /* 远处的人影不见了的那一下 */
    alarm:function(){ tone(520,0.8,'square',0.05,180); },
    anomaly:function(id){
      var i;
      tone(41,2.6,'sine',0.08,30,0,0.5);               /* 每次异象开头：一声很低的下沉 */
      if(id==='rain'){ noise(3.0,0.14,180,0.2,'lowpass',0.8,0.6,0.3); }
      else if(id==='turn'){ noise(1.1,0.03,1400,0,'bandpass',2,0.1,0.5); }
      else if(id==='broad'){ tone(784,0.5,'sine',0.04,0,0,0.5); tone(622,0.8,'sine',0.04,0,0.45,0.5); noise(2.6,0.03,2200,0.9,'bandpass',1,0.2); vowel(150,2.2,0.03,1.0,620,1800,7); }
      else if(id==='bell13'){ for(i=0;i<13;i++) bellHit(98,0.06,i*1.12,0.6); }
      else if(id==='exercise'){ for(i=0;i<16;i++){ tone(i%4===0?523:392,0.09,'square',0.012,0,i*0.55,0.6); noise(0.05,0.03,800,i*0.55,'bandpass',2,0.6); } }
      else if(id==='bells'){ for(i=0;i<30;i++) tone(rnd(2200,3400),0.5,'triangle',0.012,0,Math.random()*1.6,0.4); }
      else if(id==='hand'){ noise(0.5,0.04,300,0.2,'lowpass',3,0.3,0.2); }
      else if(id==='repeat'){ for(i=0;i<5;i++) noise(0.25,0.02,2000,i*0.3,'bandpass',5,0.3,0.1); }
      else if(id==='loop'){ for(i=0;i<8;i++) noise(0.08,0.04,1100,i*0.45,'bandpass',1.2,0.9); }
      else if(id==='roster'){ for(i=0;i<4;i++) noise(0.2,0.03,4000,i*0.25,'highpass',0.5,0.2); }
      else if(id==='cold'){ for(i=0;i<6;i++) noise(0.08,0.05,320,i*0.6,'lowpass',2,0.6); }
      else if(id==='shifting'){ tone(36,6,'sawtooth',0.05,31,0,0.6); }
      else if(id==='stare'){ for(i=0;i<20;i++) noise(0.14,0.03,rnd(300,700),0.4+Math.random()*0.25,'lowpass',2,0.3); }
      else if(id==='feast'){ for(i=0;i<10;i++) tone(rnd(2400,3200),0.15,'triangle',0.01,0,Math.random()*3,0.6); }
      else if(id==='necker'){ for(i=0;i<10;i++) noise(0.1,0.035,350,i*0.6,'lowpass',1,0.2); }
      else if(id==='shadow'){ noise(1.8,0.04,500,0,'lowpass',1,0.4,1.6); }
      else if(id==='twin'){ for(i=0;i<6;i++) noise(0.08,0.04,900,i*0.5+0.25,'bandpass',1.2,0.5); }
      else if(id==='cup'){ for(i=0;i<7;i++) tone(rnd(2600,3400),0.06,'triangle',0.012,0,0.1+i*0.13+Math.random()*0.05,0.4); }   /* 窗台上叮叮当当 */
      else if(id==='moth'){ for(i=0;i<30;i++) noise(0.05,0.02,rnd(1500,2600),i*0.07,'bandpass',3); }
    },
    anomalyEnd:function(id){ tone(330,1.6,'sine',0.01,320,0,0.8); }
  };
})();
