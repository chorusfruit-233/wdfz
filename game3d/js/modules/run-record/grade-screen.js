/* @module-capsule */
(function($imports){
/* 里世界 3D · 九档结算画面
   结算页、CG 档案馆「结算画面」的重看、调试面板的预览共用。用画布现场画（项目离线可玩，不引入图片）：
   F 黑板上被擦糊的粉笔字、E 泡皱的成绩单盖蓝色「补考」章、D 档案袋贴「察看」条、C/B/A 成绩单上的红笔、
   S/SS 红色校印、SSS 晨光里的校门盖「准予离校」。揭示动画 1.1 秒（写字、圈、盖章），「减少动态效果」时直接画最后一帧；
   不频闪。揭示到一小半时按评级组播放音效（ui.grade.low / mid / high / top）。 */
'use strict';
var GradeScreen=(function(){
  function reduced(){ try{ return window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){ return false; } }
  function rng(seed){ var s=seed%2147483647||7; return function(){ s=(s*16807)%2147483647; return (s-1)/2147483646; }; }
  function ease(k){ return 1-Math.pow(1-Math.max(0,Math.min(1,k)),3); }
  function size(cv){
    var r=cv.getBoundingClientRect(), dpr=Math.min(2,window.devicePixelRatio||1);
    var w=Math.max(240,Math.round((r.width||640)*dpr)), h=Math.max(120,Math.round((r.height||220)*dpr));
    if(cv.width!==w||cv.height!==h){ cv.width=w; cv.height=h; }
    return {w:w,h:h,u:Math.min(w/640,h/220)};
  }
  function grain(c,W,H,col,n,seed){ var R=rng(seed); c.fillStyle=col; for(var i=0;i<n;i++) c.fillRect(R()*W,R()*H,1+R()*1.5,1+R()*1.5); }
  function paper(c,W,H,tint){
    c.fillStyle=tint||'#ddd5c2'; c.fillRect(0,0,W,H);
    grain(c,W,H,'rgba(90,70,40,.06)',W*H/900,11);
    var g=c.createRadialGradient(W/2,H/2,Math.min(W,H)*0.2,W/2,H/2,Math.max(W,H)*0.7);
    g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(40,28,16,.35)'); c.fillStyle=g; c.fillRect(0,0,W,H);
  }
  function lines(c,W,H,u){ c.strokeStyle='rgba(80,110,150,.22)'; c.lineWidth=1*u; for(var y=40*u;y<H;y+=26*u){ c.beginPath(); c.moveTo(30*u,y); c.lineTo(W-30*u,y); c.stroke(); } }
  function letter(c,txt,x,y,px,col,u,alpha){ c.save(); c.globalAlpha=alpha===undefined?1:alpha; c.fillStyle=col; c.font='700 '+Math.round(px*u)+'px "Noto Serif SC","Songti SC",serif';
    c.textAlign='center'; c.textBaseline='middle'; c.fillText(txt,x,y); c.restore(); }
  /* 只露出左边 k 的部分：写字、划线的「写出来」效果 */
  function reveal(c,x0,x1,k,fn){ c.save(); c.beginPath(); c.rect(0,0,x0+(x1-x0)*ease(k),9999); c.clip(); fn(); c.restore(); }
  function stamp(c,x,y,r,k,col,text,u,rot){
    var s=1+0.5*(1-ease(k)), a=Math.min(1,k*1.6);
    c.save(); c.translate(x,y); c.rotate(rot||-0.12); c.scale(s,s); c.globalAlpha=a*0.9;
    c.strokeStyle=col; c.lineWidth=4*u; c.beginPath(); c.arc(0,0,r,0,Math.PI*2); c.stroke();
    c.lineWidth=1.5*u; c.beginPath(); c.arc(0,0,r*0.8,0,Math.PI*2); c.stroke();
    c.fillStyle=col; c.font='700 '+Math.round(r*0.42)+'px "Noto Serif SC","Songti SC",serif'; c.textAlign='center'; c.textBaseline='middle';
    c.fillText(text,0,0); c.restore();
  }
  function rectStamp(c,x,y,w,h,k,col,text,u,rot){
    var s=1+0.4*(1-ease(k)), a=Math.min(1,k*1.6);
    c.save(); c.translate(x,y); c.rotate(rot||-0.14); c.scale(s,s); c.globalAlpha=a*0.85;
    c.strokeStyle=col; c.lineWidth=3*u; c.strokeRect(-w/2,-h/2,w,h);
    c.fillStyle=col; c.font='700 '+Math.round(h*0.55)+'px "Noto Serif SC","Songti SC",serif'; c.textAlign='center'; c.textBaseline='middle'; c.fillText(text,0,1*u);
    c.restore();
  }
  var RED='#b5332f';
  var ART={
    F:function(c,W,H,u,k){
      c.fillStyle='#1c2420'; c.fillRect(0,0,W,H); grain(c,W,H,'rgba(220,230,220,.05)',W*H/500,3);
      reveal(c,W/2-70*u,W/2+70*u,k*1.4,function(){ letter(c,'F',W/2,H/2,150,'rgba(236,236,226,.85)',u); });
      if(k>0.55){ var e=ease((k-0.55)/0.45); c.save(); c.globalAlpha=0.5*e; c.fillStyle='#1c2420';
        c.fillRect(W/2-90*u,H/2-30*u,180*u*e,46*u); c.fillStyle='rgba(220,220,210,.10)'; c.fillRect(W/2-96*u,H/2-34*u,200*u*e,54*u); c.restore(); }
    },
    E:function(c,W,H,u,k){
      paper(c,W,H,'#d3cfc0'); c.strokeStyle='rgba(60,60,50,.12)'; c.lineWidth=2*u;
      for(var i=0;i<5;i++){ c.beginPath(); c.moveTo(0,H*(0.15+i*0.18)); c.bezierCurveTo(W*0.3,H*(0.1+i*0.2),W*0.6,H*(0.25+i*0.15),W,H*(0.12+i*0.19)); c.stroke(); }
      letter(c,'E',W*0.36,H/2,130,'rgba(150,40,36,.8)',u);
      rectStamp(c,W*0.66,H*0.52,150*u,58*u,k,'#2f4f8f','补 考',u,-0.16);
    },
    D:function(c,W,H,u,k){
      c.fillStyle='#7a5a38'; c.fillRect(0,0,W,H); grain(c,W,H,'rgba(30,20,10,.12)',W*H/600,5);
      c.strokeStyle='rgba(30,20,10,.45)'; c.lineWidth=2*u; c.beginPath(); c.moveTo(0,0); c.lineTo(W/2,H*0.55); c.lineTo(W,0); c.stroke();
      letter(c,'D',W*0.3,H*0.62,110,'rgba(28,20,12,.75)',u);
      var y=H*0.5, x=W*0.62-60*u+(1-ease(k))*W*0.4;
      c.save(); c.globalAlpha=Math.min(1,k*1.5); c.fillStyle='#e8e2d2'; c.fillRect(x,y-22*u,170*u,44*u); c.strokeStyle=RED; c.lineWidth=2*u; c.strokeRect(x+4*u,y-18*u,162*u,36*u);
      c.fillStyle=RED; c.font='700 '+Math.round(24*u)+'px "Noto Serif SC",serif'; c.textAlign='center'; c.textBaseline='middle'; c.fillText('察 看',x+85*u,y); c.restore();
    },
    C:function(c,W,H,u,k){
      paper(c,W,H); lines(c,W,H,u);
      reveal(c,W/2-70*u,W/2+70*u,k*1.3,function(){ letter(c,'C',W/2,H/2,130,RED,u); });
      if(k>0.7){ reveal(c,W/2+70*u,W/2+120*u,(k-0.7)/0.3,function(){ c.strokeStyle=RED; c.lineWidth=4*u; c.beginPath(); c.moveTo(W/2+78*u,H/2+10*u); c.lineTo(W/2+92*u,H/2+26*u); c.lineTo(W/2+118*u,H/2-14*u); c.stroke(); }); }
    },
    B:function(c,W,H,u,k){
      paper(c,W,H); lines(c,W,H,u);
      reveal(c,W/2-70*u,W/2+70*u,k*1.4,function(){ letter(c,'B',W/2,H/2-6*u,130,RED,u); });
      if(k>0.6){ reveal(c,W/2-70*u,W/2+70*u,(k-0.6)/0.4,function(){ c.strokeStyle=RED; c.lineWidth=3*u;
        [0,10].forEach(function(o){ c.beginPath(); c.moveTo(W/2-62*u,H/2+58*u+o*u); c.lineTo(W/2+62*u,H/2+56*u+o*u); c.stroke(); }); }); }
    },
    A:function(c,W,H,u,k){
      paper(c,W,H); lines(c,W,H,u);
      letter(c,'A',W/2,H/2,120,RED,u,Math.min(1,k*2));
      c.strokeStyle=RED; c.lineWidth=3.5*u; c.beginPath(); c.ellipse(W/2,H/2,92*u,80*u,-0.2,-1.2,-1.2+Math.PI*2*ease(k)); c.stroke();
      if(k>0.75){ c.save(); c.globalAlpha=(k-0.75)/0.25; c.strokeStyle='rgba(40,40,60,.8)'; c.lineWidth=2*u; c.beginPath(); c.moveTo(W/2+120*u,H/2+60*u);
        c.bezierCurveTo(W/2+140*u,H/2+30*u,W/2+150*u,H/2+80*u,W/2+175*u,H/2+50*u); c.bezierCurveTo(W/2+185*u,H/2+40*u,W/2+200*u,H/2+70*u,W/2+225*u,H/2+55*u); c.stroke(); c.restore(); }
    },
    S:function(c,W,H,u,k){
      paper(c,W,H,'#e2d8c0'); letter(c,'S',W*0.4,H/2,130,'rgba(110,30,26,.85)',u);
      stamp(c,W*0.62,H*0.52,64*u,k,RED,'表 彰',u,-0.18);
    },
    SS:function(c,W,H,u,k){
      paper(c,W,H,'#e8dcbc');
      var g=c.createRadialGradient(W/2,H/2,10*u,W/2,H/2,W*0.5); g.addColorStop(0,'rgba(255,220,150,.28)'); g.addColorStop(1,'rgba(255,220,150,0)'); c.fillStyle=g; c.fillRect(0,0,W,H);
      letter(c,'SS',W*0.36,H/2,120,'rgba(110,30,26,.88)',u);
      stamp(c,W*0.6,H*0.55,58*u,Math.min(1,k*1.5),RED,'保 送',u,-0.2);
      stamp(c,W*0.74,H*0.45,52*u,Math.max(0,(k-0.35)/0.65),RED,'保 送',u,0.12);
    },
    SSS:function(c,W,H,u,k){
      var sky=c.createLinearGradient(0,0,0,H); sky.addColorStop(0,'#2b3550'); sky.addColorStop(0.55,'#c98a5a'); sky.addColorStop(1,'#f1d3a0');
      c.fillStyle=sky; c.fillRect(0,0,W,H);
      var sun=c.createRadialGradient(W*0.5,H*0.86,4*u,W*0.5,H*0.86,W*0.35); sun.addColorStop(0,'rgba(255,236,190,'+(0.55*ease(k))+')'); sun.addColorStop(1,'rgba(255,236,190,0)');
      c.fillStyle=sun; c.fillRect(0,0,W,H);
      c.fillStyle='#1a1512'; c.fillRect(0,H*0.86,W,H*0.14);
      c.fillRect(W*0.3,H*0.32,22*u,H*0.56); c.fillRect(W*0.7-22*u,H*0.32,22*u,H*0.56); c.fillRect(W*0.28,H*0.27,W*0.44,16*u);
      c.lineWidth=3*u; c.strokeStyle='#1a1512';
      for(var x=W*0.3+40*u;x<W*0.7-30*u;x+=22*u){ var open=ease(k)*W*0.12*(x<W/2?-1:1); c.beginPath(); c.moveTo(x+open,H*0.42); c.lineTo(x+open,H*0.86); c.stroke(); }
      letter(c,'SSS',W*0.5,H*0.2,52,'rgba(255,246,226,.92)',u);
      stamp(c,W*0.82,H*0.6,50*u,Math.max(0,(k-0.3)/0.7),'#c0392b','准予离校',u,-0.16);
    }
  };
  function draw(cv,g,k){
    var c=cv.getContext('2d'); if(!c) return;
    var d=size(cv), fn=ART[g]||ART.C;
    c.setTransform(1,0,0,1,0,0); c.clearRect(0,0,d.w,d.h);
    fn(c,d.w,d.h,d.u,k===undefined?1:k);
  }
  function play(cv,g,opts){
    opts=opts||{};
    if(cv._raf) cancelAnimationFrame(cv._raf);
    var dur=reduced()?0:1100, t0=performance.now(), fired=!!opts.silent;
    function step(){
      var k=dur?Math.min(1,(performance.now()-t0)/dur):1;
      draw(cv,g,k);
      if(!fired&&k>=0.35){ fired=true; try{ $imports.SFX.grade&&$imports.SFX.grade($imports.ScoreRules.band(g)); }catch(e){} }
      if(k<1) cv._raf=requestAnimationFrame(step); else cv._raf=0;
    }
    step();
  }
  return {draw:draw,play:play,art:ART};
})();

/* @module-exports */
GameModules.publish("game3d/js/modules/run-record/grade-screen.js",{
"GradeScreen":{get:function(){return GradeScreen;},set:function($value){GradeScreen=$value;}}
});
})(GameModules.imports("game3d/js/modules/run-record/grade-screen.js"));
