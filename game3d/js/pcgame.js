/* 里世界 3D · 机房里的贪吃蛇 */
'use strict';

var PC={on:false,body:[],dir:{x:1,y:0},want:null,food:{x:3,y:3},score:0,dead:false,t:0};
var PCGAME={
  start:function(){
    PC.on=true; PC.dead=false; PC.score=0; PC.t=0; PC.cd=3.0;
    resetInputState();releaseMouseLook();
    PC.body=[{x:8,y:8}]; PC.dir={x:1,y:0}; PC.want=null; PC.food=this.rf();
    var el=document.getElementById('pcgame'); if(el) el.style.display='flex';
    var f=document.getElementById('pcf');
    if(f) f.textContent=IS_TOUCH?'方向键或在画面上滑动转向 · 右上角退出 · 得分越高 SAN 越多':'WASD / 方向键转向 · Esc 退出 · 得分越高 SAN 越多';
    this.draw();
    try{ SFX.click(); }catch(e){}
  },
  rf:function(){ return {x:(Math.random()*16)|0, y:(Math.random()*16)|0}; },
  stop:function(){
    var gain=Math.min(20, 6+PC.score*2);
    if(PC.score>0){ S.san=Math.min(100,S.san+gain); toast('SAN +'+gain+'（得分 '+PC.score+'）'); }
    PC.on=false;
    var el=document.getElementById('pcgame'); if(el) el.style.display='none';
    /* 以前这里再加 10*60 游戏分钟（整整 10 小时）。开电脑时已经按活动扣过时间，退出不再跳 */
    resetInputState();resumeMouseLook();
  },
  tick:function(dt){
    if(!PC.on) return;
    if(PC.dead) return;
    if(PC.cd>0){ PC.cd-=dt; this.draw(); return; }
    PC.t+=dt;
    if(PC.t<0.14) return;
    PC.t=0;
    var nd=null;
    if(KEY.w||KEY.arrowup) nd={x:0,y:-1};
    else if(KEY.s||KEY.arrowdown) nd={x:0,y:1};
    else if(KEY.a||KEY.arrowleft) nd={x:-1,y:0};
    else if(KEY.d||KEY.arrowright) nd={x:1,y:0};
    else if(PC.want){ nd=PC.want; PC.want=null; }
    /* 不能原地掉头：一按反方向就撞上自己，手机上滑歪一点就是这样 */
    if(nd&&!(PC.body.length>1&&nd.x===-PC.dir.x&&nd.y===-PC.dir.y)) PC.dir=nd;
    var h={x:PC.body[0].x+PC.dir.x, y:PC.body[0].y+PC.dir.y};
    if(h.x<0||h.y<0||h.x>=16||h.y>=16){ PC.dead=true; this.draw(); return; }
    for(var i=0;i<PC.body.length;i++) if(PC.body[i].x===h.x&&PC.body[i].y===h.y){ PC.dead=true; this.draw(); return; }
    PC.body.unshift(h);
    if(h.x===PC.food.x&&h.y===PC.food.y){ PC.score++; PC.food=this.rf(); }
    else PC.body.pop();
    this.draw();
  },
  draw:function(){
    var cv=document.getElementById('pccv'); if(!cv) return;
    var c=cv.getContext('2d'); if(!c) return;
    c.fillStyle='#0a1210'; c.fillRect(0,0,320,320);
    c.strokeStyle='rgba(120,200,170,.10)'; c.lineWidth=1;
    for(var g=0;g<=16;g++){ c.beginPath(); c.moveTo(g*20,0); c.lineTo(g*20,320); c.stroke();
      c.beginPath(); c.moveTo(0,g*20); c.lineTo(320,g*20); c.stroke(); }
    c.fillStyle='#c8554a'; c.fillRect(PC.food.x*20+3,PC.food.y*20+3,14,14);
    for(var i=0;i<PC.body.length;i++){
      c.fillStyle=i?'#5a9a7a':'#79c8a4';
      c.fillRect(PC.body[i].x*20+1,PC.body[i].y*20+1,18,18);
    }
    if(PC.cd>0){
      c.fillStyle='rgba(0,0,0,.6)'; c.fillRect(0,0,320,320);
      c.fillStyle='#dff5ea'; c.font='bold 64px sans-serif'; c.textAlign='center';
      c.fillText(String(Math.ceil(PC.cd)),160,180);
      c.font='11px sans-serif'; c.fillStyle='#9fe3c2';
      c.fillText('准备',160,212);
    }
    if(PC.dead){
      c.fillStyle='rgba(0,0,0,.72)'; c.fillRect(0,0,320,320);
      c.fillStyle='#e8f4ec'; c.font='15px sans-serif'; c.textAlign='center';
      c.fillText('结束 · 得分 '+PC.score,160,150);
      c.font='11px sans-serif'; c.fillStyle='#9fe3c2';
      c.fillText(IS_TOUCH?'点右上角离开':'按 Esc 离开',160,178);
    }
  }
};

/* 触屏：方向键（按下就转，不等松手）和在画面上滑动 */
function initPcTouch(){
  var pad=document.getElementById('pcpad'), cv=document.getElementById('pccv');
  if(pad) pad.addEventListener('pointerdown',function(e){
    var b=e.target.closest('button[data-d]'); if(!b) return;
    e.preventDefault();
    var d=b.getAttribute('data-d').split(',');
    PC.want={x:+d[0],y:+d[1]};
  });
  var sx=0,sy=0,sid=null;
  if(cv){
    cv.addEventListener('pointerdown',function(e){ sid=e.pointerId; sx=e.clientX; sy=e.clientY; });
    cv.addEventListener('pointermove',function(e){
      if(e.pointerId!==sid) return;
      var dx=e.clientX-sx, dy=e.clientY-sy;
      if(Math.max(Math.abs(dx),Math.abs(dy))<18) return;
      PC.want=Math.abs(dx)>Math.abs(dy)?{x:dx>0?1:-1,y:0}:{x:0,y:dy>0?1:-1};
      sx=e.clientX; sy=e.clientY;
    });
    cv.addEventListener('pointerup',function(){ sid=null; });
    cv.addEventListener('pointercancel',function(){ sid=null; });
  }
}
