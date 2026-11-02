/* 里世界 3D · 音效播放器（模块 audio）
   读 sound-bank.js 的配方现场合成。每次播放都在配方给的范围里重新取值（音高、响度、时间、滤波都差一点），
   同一声不会两次一模一样；再乘上 sound-levels.js 的响度校准（tools/sound_levels.py 生成），让同一类声音一样响。
   同一份代码既往游戏的混音里放（分类总线 → 主音量 → 压缩器，带混响和方位），也往离线渲染里放（测响度、出试听）。

   配方（一层）：t 种类 tone / noise / bell / vowel / fm；at 开始；dur 长度；g 峰值；atk 起音；hold 保持；
     f 频率（noise 是滤波中心）；to 滑到；glide 滑多久；type 波形 / 滤波类型；q；lp 再过一道低通；vib [速率, 深度]；
     am [速率, 深度, 波形] 振幅调制；wet 这一层额外的混响；pan 声像偏移；panK 跟随 opt.pan 的比例；
     n 重复次数；every 间隔；accel 间隔倍率；decay 响度倍率；fstep 频率倍率；jit 时间抖动；panTo 重复时声像扫到；
     ratio / index（fm）；partials（bell）；f1 f2 f3 fq voice breath（vowel）；p:false 不随音高变化。
   数值可以写成 [最小, 最大]（每次随机取）或 function(opt, i, rng)。
   opt：k 响度倍率、pan −1…1、lp 发闷（1 = 不闷）、pitch 音高倍率、at 延迟（秒）、len 长度（配方里用 o.len）、wet 混响。 */
'use strict';

var SoundPlayer=(function(){
  var rng=Math.random, active=[], extra={};
  var CAT_WET={ui:0.04,step:0.22,foley:0.3,world:0.6,distant:0.6,threat:0.4,event:0.5,death:0.4,scene:0.35,music:0.45,void:0.9};
  var LAYER_T={tone:1,noise:1,bell:1,vowel:1,fm:1};
  var BELL=[[0.5,0.9,1],[1,0.75,0.8],[1.19,0.5,0.6],[1.5,0.32,0.5],[2,0.42,0.45],[2.51,0.22,0.3],[2.99,0.16,0.25],[4.17,0.09,0.16]];

  function def(id){ return extra[id]||(typeof SOUND_BANK!=='undefined'?SOUND_BANK[id]:null)||null; }
  function cat(id){ var d=def(id); return d?d.cat:null; }
  function ids(){
    var out=Object.keys(typeof SOUND_BANK!=='undefined'?SOUND_BANK:{});
    Object.keys(extra).forEach(function(k){ if(out.indexOf(k)<0) out.push(k); });
    return out;
  }
  function dB(x){ return Math.pow(10,x/20); }
  function lvl(id,raw){
    if(raw) return 1;
    var t=(typeof SOUND_LEVELS!=='undefined')?SOUND_LEVELS[id]:undefined;
    return typeof t==='number'?dB(t):1;
  }
  function pick(v,o,i){
    if(typeof v==='function') return v(o,i,rng);
    if(Array.isArray(v)) return v[0]+(v[1]-v[0])*rng();
    return v;
  }
  function num(v,o,i,dflt){ var x=pick(v,o,i); return (typeof x==='number'&&isFinite(x))?x:dflt; }
  function mulberry(seed){
    var a=seed>>>0;
    return function(){ a=(a+0x6D2B79F5)>>>0; var t=a; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; };
  }

  /* ---------- 一层的一次发声 ---------- */
  function envelope(p,t,atk,hold,dur,peak){
    peak=Math.max(0.00012,peak);
    atk=Math.max(0.0008,Math.min(atk,dur*0.9));
    p.value=0.0001;                     /* 先静音：增益默认是 1，起音前那一个采样会漏出来变成「咔」 */
    p.setValueAtTime(0.0001,t);
    p.exponentialRampToValueAtTime(peak,t+atk);
    if(hold>0&&atk+hold<dur*0.95) p.setValueAtTime(peak,t+atk+hold);
    p.exponentialRampToValueAtTime(0.0001,t+dur);
  }
  function amNode(E,L,t,dur,o,i){
    var a=E.ctx, am=L.am; if(!am) return null;
    var rate=num(am[0],o,i,8), depth=Math.max(0,Math.min(1,num(am[1],o,i,0.5)));
    var g=a.createGain(); g.gain.value=1-depth/2;
    var lfo=a.createOscillator(); lfo.type=am[2]||'sine'; lfo.frequency.value=rate;
    var lg=a.createGain(); lg.gain.value=depth/2; lfo.connect(lg); lg.connect(g.gain);
    lfo.start(t); lfo.stop(t+dur+0.06);
    return g;
  }
  function vibrato(E,L,param,f,t,dur,o,i){
    if(!L.vib) return;
    var a=E.ctx, lfo=a.createOscillator(), lg=a.createGain();
    lfo.frequency.value=num(L.vib[0],o,i,5); lg.gain.value=f*num(L.vib[1],o,i,0.01);
    lfo.connect(lg); lg.connect(param); lfo.start(t); lfo.stop(t+dur+0.06);
  }
  /* 一层的输出：[am] → [低通] → 包络 → 目标；wet 另开一路混响（经 ch.send，和干声一样吃出口增益） */
  function tail(E,ch,L,src,t,atk,hold,dur,peak,dst,o,i){
    var a=E.ctx, node=src, am=amNode(E,L,t,dur,o,i);
    if(am){ node.connect(am); node=am; }
    if(L.lp){ var lp=a.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=num(L.lp,o,i,2000); node.connect(lp); node=lp; }
    var g=a.createGain(); envelope(g.gain,t,atk,hold,dur,peak); node.connect(g); g.connect(dst);
    var w=num(L.wet,o,i,0); if(w>0){ var s=ch.send(w); if(s) g.connect(s); }
    return g;
  }
  function voice(E,ch,L,t,peak,fk,dst,o,i){
    var a=E.ctx, dur=Math.max(0.01,num(L.dur,o,i,0.2)), atk, hold=num(L.hold,o,i,0), f, to, glide, j, nyq=a.sampleRate*0.45;
    if(L.t==='tone'){
      f=Math.min(nyq,num(L.f,o,i,440)*fk); to=num(L.to,o,i,0); glide=num(L.glide,o,i,dur);
      var osc=a.createOscillator(); osc.type=L.type||'sine'; osc.frequency.setValueAtTime(f,t);
      if(to) osc.frequency.exponentialRampToValueAtTime(Math.min(nyq,Math.max(16,to*fk)),t+Math.max(0.01,glide));
      vibrato(E,L,osc.frequency,f,t,dur,o,i);
      atk=num(L.atk,o,i,Math.min(0.01,dur*0.2));
      tail(E,ch,L,osc,t,atk,hold,dur,peak,dst,o,i);
      osc.start(t); osc.stop(t+dur+0.06);
    }else if(L.t==='noise'){
      var src=a.createBufferSource(); src.buffer=E.noise(); src.loop=true;
      var fl=a.createBiquadFilter(); fl.type=L.type||'bandpass';
      var fq=L.p===false?1:fk;
      f=num(L.f,o,i,1000)*fq; fl.frequency.setValueAtTime(Math.min(f,nyq),t);
      to=num(L.to,o,i,0); glide=num(L.glide,o,i,dur);
      if(to) fl.frequency.exponentialRampToValueAtTime(Math.min(Math.max(20,to*fq),nyq),t+Math.max(0.01,glide));
      fl.Q.value=num(L.q,o,i,1);
      src.connect(fl);
      atk=num(L.atk,o,i,0.004);
      tail(E,ch,L,fl,t,atk,hold,dur,peak,dst,o,i);
      src.start(t,rng()*1.6); src.stop(t+dur+0.06);
    }else if(L.t==='bell'){
      f=num(L.f,o,i,220)*fk;
      var parts=L.partials||BELL, bw=num(L.wet,o,i,0), bsend=bw>0?ch.send(bw):null;
      for(j=0;j<parts.length;j++){
        var pf=f*parts[j][0]; if(pf>nyq) continue;
        var po=a.createOscillator(); po.type='sine'; po.frequency.value=pf*(1+(rng()-0.5)*0.002);
        var pd=Math.max(0.05,dur*parts[j][2]);
        var pg=a.createGain(); envelope(pg.gain,t,num(L.atk,o,i,0.002),0,pd,peak*parts[j][1]);
        po.connect(pg); pg.connect(dst);
        if(bsend) pg.connect(bsend);
        po.start(t); po.stop(t+pd+0.06);
      }
    }else if(L.t==='vowel'){
      f=num(L.f,o,i,200)*fk; to=num(L.to,o,i,0);
      var sum=a.createGain(); sum.gain.value=1;
      var vo=num(L.voice,o,i,1), br=num(L.breath,o,i,0);
      if(vo>0){
        var vs=a.createOscillator(); vs.type='sawtooth'; vs.frequency.setValueAtTime(f,t);
        if(to) vs.frequency.exponentialRampToValueAtTime(Math.max(16,to*fk),t+dur);
        vibrato(E,L,vs.frequency,f,t,dur,o,i);
        var vg=a.createGain(); vg.gain.value=vo; vs.connect(vg); vg.connect(sum); vs.start(t); vs.stop(t+dur+0.06);
      }
      if(br>0){
        var bsrc=a.createBufferSource(); bsrc.buffer=E.noise(); bsrc.loop=true;
        var bgn=a.createGain(); bgn.gain.value=br*2.2; bsrc.connect(bgn); bgn.connect(sum); bsrc.start(t,rng()*1.6); bsrc.stop(t+dur+0.06);
      }
      var form=a.createGain(); form.gain.value=1;
      [L.f1||700,L.f2||1150,L.f3].forEach(function(ff,k){
        if(!ff) return;
        var bp=a.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=Math.min(nyq,num(ff,o,i,800)); bp.Q.value=num(L.fq,o,i,7);
        var bg=a.createGain(); bg.gain.value=k===0?1:(k===1?0.7:0.4);
        sum.connect(bp); bp.connect(bg); bg.connect(form);
      });
      atk=num(L.atk,o,i,dur*0.3);
      tail(E,ch,L,form,t,atk,hold,dur,peak,dst,o,i);
    }else if(L.t==='fm'){
      f=Math.min(nyq,num(L.f,o,i,300)*fk);
      var car=a.createOscillator(), mod=a.createOscillator(), mg=a.createGain();
      car.type='sine'; car.frequency.value=f; mod.type='sine'; mod.frequency.value=f*num(L.ratio,o,i,1.4);
      var idx=num(L.index,o,i,2)*f;
      mg.gain.setValueAtTime(idx,t); mg.gain.exponentialRampToValueAtTime(Math.max(1,idx*0.05),t+dur*num(L.idecay,o,i,0.6));
      mod.connect(mg); mg.connect(car.frequency);
      atk=num(L.atk,o,i,0.002);
      tail(E,ch,L,car,t,atk,hold,dur,peak,dst,o,i);
      car.start(t); mod.start(t); car.stop(t+dur+0.06); mod.stop(t+dur+0.06);
    }
    return t+dur;
  }
  /* 一层：可能重复 n 次。gk 只是整段重复（rep）的衰减；rp 是整段重复带来的声像偏移。
     响度倍率（opt.k、随机浮动、校准）不进包络，放在出口的增益上：包络从 0.0001 起落，峰值一变曲线形状就变，校准会不准 */
  function layer(E,ch,L,t0,gk,pk,o,plan,rp){
    var n=Math.max(1,Math.round(num(L.n,o,0,1))), accel=num(L.accel,o,0,1), decay=num(L.decay,o,0,1),
        fstep=num(L.fstep,o,0,1), end=t0, at=num(L.at,o,0,0), dt=0, g=1, fm=1, i;
    var own=L.pan!==undefined||L.panTo!==undefined||rp!==null;
    for(i=0;i<n;i++){
      var t=t0+at+dt+(L.jit?num(L.jit,o,i,0)*(rng()*2-1):0);
      var peak=num(L.g,o,i,0.05)*gk*g, fk=(L.p===false?1:pk)*fm;
      if(plan) end=Math.max(end,t+Math.max(0.01,num(L.dur,o,i,0.2)));
      else{
        var dst=ch.input;
        if(own){
          var p0=num(L.pan,o,i,0), p1=L.panTo!==undefined?num(L.panTo,o,i,p0):p0, pp=n>1?p0+(p1-p0)*i/(n-1):p0;
          var ap=Math.max(-1,Math.min(1,(o.pan||0)*(L.panK===undefined?1:L.panK)+pp+(rp||0)));
          var pn=E.pan(ap,ch.raw); dst=pn||ch.raw;
        }
        end=Math.max(end,voice(E,ch,L,Math.max(t,E.now()),peak,fk,dst,o,i));
      }
      dt+=num(L.every,o,i,0.2)*Math.pow(accel,i); g*=decay; fm*=fstep;
    }
    return end;
  }
  /* 一个音效的出口：input →（整体声像）→ mix；各自带声像的层走 raw → mix；mix →（发闷）→ 分类总线 + 混响。
     写在单层上的混响（配方里某一层的 wet，例如钟的泛音）另走 fx：增益和 mix 一样是 gk（opt.k、随机浮动、响度校准），
     发闷时同样过低通，stop() 淡出时连它一起——以前直接接到混响发送，会漏掉校准、k=0 时还听得见、也停不掉。 */
  function chain(E,D,o,gk){
    var a=E.ctx, out=E.dry(D.cat); if(!out) return null;
    var input=a.createGain(), raw=a.createGain(), mix=a.createGain(), last=mix, lp=o.lp===undefined?1:o.lp;
    mix.gain.value=gk;
    var pan=Math.abs(o.pan||0)>0.01?E.pan(o.pan,mix):null;
    if(pan) input.connect(pan); else input.connect(mix);
    raw.connect(mix);
    if(lp<0.98){ var mf=a.createBiquadFilter(); mf.type='lowpass'; mf.frequency.value=350+9000*lp*lp; mf.Q.value=0.7; mix.connect(mf); last=mf; }
    last.connect(out);
    var wet=o.wet!==undefined?o.wet:(D.wet!==undefined?D.wet:(CAT_WET[D.cat]||0.3));
    if(wet>0){ var s=E.send(D.cat,wet); if(s) last.connect(s); }
    var ch={cat:D.cat,input:input,raw:raw,mix:mix,fx:null,send:null};
    var fxState=0;                                   /* 0 还没建；1 建好；-1 这个环境没有混响 */
    ch.send=function(w){
      if(fxState===0){
        var to=E.send(D.cat,1);
        if(!to) fxState=-1;
        else{
          var fx=a.createGain(); fx.gain.value=gk;
          if(lp<0.98){ var mf2=a.createBiquadFilter(); mf2.type='lowpass'; mf2.frequency.value=350+9000*lp*lp; mf2.Q.value=0.7; fx.connect(mf2); mf2.connect(to); }
          else fx.connect(to);
          ch.fx=fx; fxState=1;
        }
      }
      if(fxState<0) return null;
      var g=a.createGain(); g.gain.value=w; g.connect(ch.fx); return g;
    };
    return ch;
  }
  /* ---------- 一个音效 ---------- */
  function render(E,id,opt,plan){
    var D=def(id); if(!D||!D.layers) return plan?0:null;
    var o={}, k; opt=opt||{}; for(k in opt) o[k]=opt[k];
    if(o.len===undefined) o.len=D.len||1;
    var v=D.vary||{}, pk=(o.pitch||1)*(1+(v.p?(rng()*2-1)*v.p:0));
    var gk=(o.k===undefined?1:Math.max(0,o.k))*(1+(v.g?(rng()*2-1)*v.g:0))*lvl(id,o.raw);
    var t0=(plan?0:E.now())+(o.at||0), end=t0, ch=null;
    if(!plan){ ch=chain(E,D,o,gk); if(!ch) return null; }
    var R=D.rep||{}, rn=Math.max(1,Math.round(num(R.n,o,0,1))), rdt=0, rg=1, r;
    for(r=0;r<rn;r++){
      var tr=t0+rdt+(R.jit?num(R.jit,o,r,0)*(rng()*2-1):0);
      var rp=R.pan?R.pan[0]+(R.pan[1]-R.pan[0])*(rn>1?r/(rn-1):0):null;
      for(k=0;k<D.layers.length;k++){
        var L=D.layers[k]; if(!LAYER_T[L.t]) continue;
        if(plan) end=Math.max(end,layer(E,null,L,tr,rg,pk,o,true,rp));
        else{ try{ end=Math.max(end,layer(E,ch,L,tr,rg,pk,o,false,rp)); }catch(e){ if(E.strict) throw e; } }
      }
      rdt+=num(R.every,o,r,0.3)*Math.pow(num(R.accel,o,0,1),r); rg*=num(R.decay,o,0,1);
    }
    if(plan) return end;
    return {id:id,cat:D.cat,gain:ch.mix,fx:ch.fx,end:end};
  }

  /* ---------- 游戏里的输出：SFX 的分类总线、混响、方位 ---------- */
  function liveEnv(){
    if(typeof SFX==='undefined'||!SFX.synth) return null;
    var A=SFX.synth(), a=A.ctx(); if(!a) return null;
    return {ctx:a, now:function(){ return a.currentTime; }, noise:A.noiseBuf,
      dry:function(c){ return A.bus(c); },
      send:function(c,w){ return A.send(c,w); },
      pan:function(p,dst){ if(Math.abs(p||0)<0.01) return null; var n=A.pan(p); if(n&&dst) n.connect(dst); return n; }};
  }
  function play(id,opt){
    var D=def(id); if(!D) return null;
    var E=liveEnv(); if(!E) return null;
    var h=null;
    try{ h=render(E,id,opt,false); }catch(e){ return null; }
    if(h){
      var now=E.now(); active=active.filter(function(x){ return x.end>now; });
      active.push(h);
    }
    return h;
  }
  /* 从 at 秒起 0.04 秒淡出一个正在响的音效：干声和它自己的混响（fx）一起 */
  function fade(h,at){
    if(!h) return false;
    [h.gain,h.fx].forEach(function(n){
      if(!n) return;
      try{ n.gain.cancelScheduledValues(at); n.gain.setTargetAtTime(0,at,0.04); }catch(e){}
    });
    return true;
  }
  /* 停掉某一类（或全部）正在响的声音 */
  function stop(c){
    if(typeof SFX==='undefined'||!SFX.synth) return 0;
    var a=SFX.synth().ctx(), n=0; if(!a) return 0;
    active=active.filter(function(h){
      if(c&&h.cat!==c) return h.end>a.currentTime;
      if(fade(h,a.currentTime)) n++;
      return false;
    });
    return n;
  }
  function length(id,opt){ var D=def(id); if(!D) return 0; return render(null,id,opt||{},true); }

  /* ---------- 离线：测响度（K 加权近似：60 Hz 高通 + 1.5 kHz 高架 +4 dB；100 毫秒窗的最大有效值） ---------- */
  function seededNoise(a,seed){
    var r=mulberry(seed||7), n=a.sampleRate*2, b=a.createBuffer(1,n,a.sampleRate), d=b.getChannelData(0), i;
    for(i=0;i<n;i++) d[i]=r()*2-1;
    return b;
  }
  function loudness(kw,raw,sr){
    var win=Math.max(1,Math.round(sr*0.1)), hop=Math.max(1,Math.round(sr*0.025)), best=0, pk=0, i, j, acc;
    for(i=0;i<raw.length;i++){ var v=Math.abs(raw[i]); if(v>pk) pk=v; }
    for(i=0;i+win<=kw.length;i+=hop){ acc=0; for(j=i;j<i+win;j++) acc+=kw[j]*kw[j]; acc=Math.sqrt(acc/win); if(acc>best) best=acc; }
    if(kw.length<win){ acc=0; for(j=0;j<kw.length;j++) acc+=kw[j]*kw[j]; best=Math.sqrt(acc/Math.max(1,win)); }
    var db=function(x){ return x>0?Math.round(200*Math.log10(x))/10:-120; };
    return {st:db(best),pk:db(pk)};
  }
  function measureOne(id,o,seed){
    var sr=o.sr||22050, keep=rng;
    rng=mulberry(seed);
    var len=Math.min(o.maxLen||20,length(id,o.opt)+0.35);
    rng=mulberry(seed);
    var a=new OfflineAudioContext(2,Math.max(256,Math.ceil(len*sr)),sr);
    var raw=a.createGain(), hp=a.createBiquadFilter(), hs=a.createBiquadFilter(), mer=a.createChannelMerger(2);
    hp.type='highpass'; hp.frequency.value=60; hp.Q.value=0.5; hs.type='highshelf'; hs.frequency.value=1500; hs.gain.value=4;
    raw.connect(hp); hp.connect(hs); hs.connect(mer,0,0); raw.connect(mer,0,1); mer.connect(a.destination);
    var nb=seededNoise(a,seed*31+7);
    var E={ctx:a, now:function(){ return 0; }, noise:function(){ return nb; }, strict:true,
      dry:function(){ return raw; }, send:function(){ return null; }, pan:function(){ return null; }};
    var opt={}, k; for(k in (o.opt||{})) opt[k]=o.opt[k]; opt.raw=!!o.raw;
    try{ render(E,id,opt,false); }finally{ rng=keep; }
    return a.startRendering().then(function(buf){
      var m=loudness(buf.getChannelData(0),buf.getChannelData(1),sr); m.len=Math.round(len*100)/100; return m;
    });
  }
  /* 每个音效用 seeds 个种子各渲染一次，取 dB 平均（随机变化不会让校准忽高忽低） */
  function measure(list,o){
    o=o||{}; list=list||ids();
    var seeds=o.seeds||3, out=[], i=0;
    function next(){
      if(i>=list.length) return Promise.resolve(out);
      var id=list[i++], acc={st:0,pk:-120,len:0}, s=0;
      function one(){
        if(s>=seeds){ out.push({id:id,cat:cat(id),st:Math.round(acc.st/seeds*10)/10,pk:acc.pk,len:acc.len}); return next(); }
        return measureOne(id,o,1000+s*17+(o.seed||0)).then(function(m){ acc.st+=m.st; acc.pk=Math.max(acc.pk,m.pk); acc.len=Math.max(acc.len,m.len); s++; return one(); });
      }
      return one();
    }
    return next();
  }
  /* 配方自检：未知字段、类别、层的种类、数值范围 */
  var LKEYS='t at dur g atk hold f to glide type q lp vib am wet pan panK n every accel decay fstep jit panTo ratio index idecay partials f1 f2 f3 fq voice breath p'.split(' '),
      SKEYS='cat name lv vary wet len rep layers'.split(' ');
  function validate(){
    var bad=[], C=typeof SOUND_CATS!=='undefined'?SOUND_CATS:{};
    ids().forEach(function(id){
      var D=def(id);
      if(!D||!C[D.cat]) bad.push(id+': 类别不对');
      if(!D||!Array.isArray(D.layers)||!D.layers.length){ bad.push(id+': 没有层'); return; }
      if(!D.name) bad.push(id+': 缺名字');
      Object.keys(D).forEach(function(k){ if(SKEYS.indexOf(k)<0) bad.push(id+': 字段 '+k); });
      D.layers.forEach(function(L,j){
        if(!LAYER_T[L.t]) bad.push(id+'#'+j+': 种类 '+L.t);
        Object.keys(L).forEach(function(k){ if(LKEYS.indexOf(k)<0) bad.push(id+'#'+j+': 字段 '+k); });
        if(typeof L.g==='number'&&(L.g<=0||L.g>1)) bad.push(id+'#'+j+': g');
      });
      var len=length(id,{});
      if(!(len>0&&len<20)) bad.push(id+': 长度 '+len);
    });
    return bad;
  }
  return {
    play:play, stop:stop, fade:fade, render:render, length:length, has:function(id){ return !!def(id); }, def:def, cat:cat, ids:ids,
    level:function(id){ var t=typeof SOUND_LEVELS!=='undefined'?SOUND_LEVELS[id]:undefined; return typeof t==='number'?t:null; },
    measure:measure, validate:validate, loudness:loudness,
    active:function(){ var a=(typeof SFX!=='undefined'&&SFX.synth)?SFX.synth().ctx():null, now=a?a.currentTime:0; return active.filter(function(h){ return h.end>now; }).map(function(h){ return h.id; }); },
    /* Mod 用：加一个自己的音效（同名覆盖内置）；配方格式见文件开头 */
    add:function(id,d){ if(!id||!d||!Array.isArray(d.layers)) return false; extra[id]=d; return true; },
    seed:function(s){ rng=s===undefined||s===null?Math.random:mulberry(s); }
  };
})();
