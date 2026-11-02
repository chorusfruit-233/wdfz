/* 里世界 3D · 粉笔记号（模块 chalk-marks）：逻辑与存档，不碰渲染对象
   背包或快捷栏里「用」粉笔：在面前的墙上（平视）或脚前的地上（低头）画一个记号——X、↑、O……
   记号跟着存档保留，进出房间、读档后还在。校园里、楼里、虚空迷宫里都能画。
   对着已有的记号再用粉笔，可以把它擦掉。粉笔不会用完。

   记号：{room, x, y（世界坐标）, h（地面高度或墙上记号中心离地的高度）, face:'floor'|'wall', a（朝向，弧度）, s（图案）, n（序号）}
     地上：a = 画的时候人面朝的方向（↑ 指向前方）；墙上：a = 墙面法线的方向（朝外）。 */
'use strict';

var CHALK_SYMS=[
  {id:'x',   label:'X',   desc:'叉'},
  {id:'up',  label:'↑',   desc:'箭头（地上指向前方，墙上指向上方）'},
  {id:'o',   label:'O',   desc:'圈'},
  {id:'left',label:'←',   desc:'向左的箭头'},
  {id:'right',label:'→',  desc:'向右的箭头'},
  {id:'tri', label:'△',   desc:'三角'},
  {id:'q',   label:'?',   desc:'问号'},
  {id:'bar', label:'正',  desc:'计数的「正」字'}
];
var CHALK_CFG={max:240, perRoom:80, reach:1.45, floorReach:2.0, eraseR:0.75, lookDown:-0.32};

var ChalkMarks=(function(){
  var marks=[], serial=0, presets={}, version=0;
  function placeKey(){ return S.mode==='in'?S.room:null; }
  function bump(){ version++; try{ if(typeof ChalkFx!=='undefined') ChalkFx.refresh(); }catch(e){} }
  function symById(id){ for(var i=0;i<CHALK_SYMS.length;i++) if(CHALK_SYMS[i].id===id) return CHALK_SYMS[i]; return null; }
  /* 某一点的地面高度：迷宫里按体素和楼梯，钟楼按旋梯，其余是 0；够不着（虚空）返回 null */
  function floorHere(wx,wy){
    if(S.mode==='in'&&typeof VoidMaze!=='undefined'&&S.room===MAZE_CFG.room) return VoidMaze.floorAt(wx,wy);
    return S.floorY||0;
  }
  /* 准星对着的地方：平视找墙，低头找地 */
  function target(){
    var U=(typeof U2M!=='undefined')?U2M:1/9, step=0.05/U, cos=Math.cos(S.ang), sin=Math.sin(S.ang);
    var pitch=S.pitch||0, eye=(S.eyeH||EYE);
    if(pitch>CHALK_CFG.lookDown){
      var last=0, hit=-1;
      for(var d=step;d<=CHALK_CFG.reach/U;d+=step){
        if(solidAt(S.x+cos*d,S.y+sin*d)){ hit=d; break; }
        last=d;
      }
      if(hit>0){
        var lo=last, hi=hit, k;
        for(k=0;k<10;k++){ var mid=(lo+hi)/2; if(solidAt(S.x+cos*mid,S.y+sin*mid)) hi=mid; else lo=mid; }
        var fx=S.x+cos*lo, fy=S.y+sin*lo, e=0.06/U;
        /* 墙面朝哪：沿 x 或 y 单独往前一点，哪个方向进了实心，墙就垂直于哪个方向 */
        var bx=solidAt(fx+cos*e,fy), by=solidAt(fx,fy+sin*e), ang;
        if(bx&&!by) ang=cos>0?Math.PI:0;
        else if(by&&!bx) ang=sin>0?-Math.PI/2:Math.PI/2;
        else ang=Math.abs(cos)>Math.abs(sin)?(cos>0?Math.PI:0):(sin>0?-Math.PI/2:Math.PI/2);
        var dist=lo*U, hgt=clamp(eye+Math.tan(pitch)*dist,0.35,2.3);
        return {face:'wall',x:fx,y:fy,h:hgt,a:ang,room:placeKey(),floor:S.floorY||0};
      }
      return null;
    }
    var down=Math.max(0.12,-pitch), dist2=Math.min(CHALK_CFG.floorReach,eye/Math.tan(down))/U;
    var px=S.x+cos*dist2, py=S.y+sin*dist2;
    for(var back=0;back<6&&solidAt(px,py);back++){ px-=cos*0.2/U; py-=sin*0.2/U; }    /* 低头对着墙根：往回挪到墙前 */
    if(solidAt(px,py)) return null;
    var fh=floorHere(px,py);
    if(fh===null) return {face:'void'};
    return {face:'floor',x:px,y:py,h:fh,a:S.ang,room:placeKey()};
  }
  function nearMark(t){
    if(!t||!(t.face==='floor'||t.face==='wall')) return -1;
    var best=-1, bd=(CHALK_CFG.eraseR/((typeof U2M!=='undefined')?U2M:1/9)), i, m;
    for(i=0;i<marks.length;i++){
      m=marks[i]; if(m.room!==t.room||m.face!==t.face) continue;
      var mh=m.face==='wall'?(m.f||0)+m.h:m.h, th=t.face==='wall'?(t.floor||0)+t.h:t.h;   /* 墙上的记号按绝对高度比 */
      if(Math.abs(mh-th)>(t.face==='wall'?0.8:0.6)) continue;
      var d=Math.hypot(m.x-t.x,m.y-t.y);
      if(d<bd){ bd=d; best=i; }
    }
    return best;
  }
  function place(sym,t){
    if(!symById(sym)||!t||(t.face!=='floor'&&t.face!=='wall')) return null;
    var m={room:t.room,x:+t.x.toFixed(2),y:+t.y.toFixed(2),h:+t.h.toFixed(3),face:t.face,a:+t.a.toFixed(4),s:sym,n:++serial,d:S.day||1};
    if(t.face==='wall') m.f=+(t.floor||0).toFixed(3);
    marks.push(m);
    var inRoom=marks.filter(function(q){ return q.room===m.room; });
    if(inRoom.length>CHALK_CFG.perRoom) marks.splice(marks.indexOf(inRoom[0]),1);
    while(marks.length>CHALK_CFG.max) marks.shift();
    bump();
    return m;
  }
  function erase(i){ if(i<0||i>=marks.length) return false; marks.splice(i,1); bump(); return true; }
  /* 用粉笔：选一个图案画上去，或者擦掉面前那个 */
  function open(){
    if(!hasItem('chalk')){ toast('没有粉笔'); return false; }
    var t=target();
    if(!t){ os('我：够不着能画的地方。走近一面墙，或者低头看着地面。',2.8); return false; }
    if(t.face==='void'){ os('我：那下面什么都没有。粉笔落不到任何东西上。',2.8); return false; }
    var near=nearMark(t), opts=[];
    CHALK_SYMS.forEach(function(s){
      opts.push({label:'画「'+s.label+'」',fn:function(){
        var m=place(s.id,t);
        if(m){ try{ SFX.chalk(); }catch(e){} os(t.face==='wall'?'我：在墙上画了个「'+s.label+'」。':'我：在地上画了个「'+s.label+'」。',2.2); autoSave(); }
      }});
    });
    if(near>=0) opts.push({label:'擦掉这里的「'+(symById(marks[near].s)||{label:'?'}).label+'」',fn:function(){
      erase(near); os('我：用袖子把记号擦掉了，只剩一片白印。',2.2); autoSave();
    }});
    opts.push({label:'算了',fn:function(){}});
    UI.choice(t.face==='wall'?'在墙上画什么？':'在地上画什么？',opts);
    return true;
  }
  /* 模块自带的、从一开始就在的旧记号（不存档，画得淡一点） */
  function preset(room,list){ presets[room||'out']=(list||[]).map(function(m,i){ return Object.assign({old:1,n:-1-i},m); }); bump(); }
  function visible(room){
    var key=room||null;
    return marks.filter(function(m){ return (m.room||null)===key; }).concat(presets[key||'out']||[]);
  }

  GameModules.persistent('chalk-marks',{
    save:function(){ return {v:1,serial:serial,marks:marks}; },
    load:function(d){
      if(!d||!Array.isArray(d.marks)) return;
      marks=d.marks.filter(function(m){
        return m&&symById(m.s)&&(m.face==='floor'||m.face==='wall')&&[m.x,m.y,m.h,m.a].every(Number.isFinite)&&(m.room===null||typeof m.room==='string');
      }).slice(-CHALK_CFG.max);
      serial=Number.isFinite(d.serial)?d.serial:marks.length;
      bump();
    },
    reset:function(){ marks=[]; serial=0; bump(); }
  });
  GameModules.on('itemUse',function(id){ if(id==='chalk'){ open(); return true; } return false; },{owner:'chalk-marks'});

  return {
    SYMS:CHALK_SYMS, target:target, place:place, erase:erase, open:open, nearMark:nearMark,
    preset:preset, visible:visible, symbol:symById,
    all:function(){ return marks.slice(); }, count:function(){ return marks.length; },
    version:function(){ return version; }
  };
})();
