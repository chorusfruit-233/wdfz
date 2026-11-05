/* @module-capsule */
(function($imports){
/* 里世界 3D · 体检日（《校园怪谈创意提案》C9）
   特殊校园日「体检」（day-events.js 定哪天）：早读广播，第三节课（10:20–11:05）到行政楼一楼的临时医务室（西头第一间办公室）体检。
   · 课间操时（10:00）再广播一次；HUD 时段写「体检 · 行政楼一楼医务室」。
   · 走廊里排着队、面朝墙的同学（只在体检时段，带碰撞，不能穿过去）。
   · 医务室里三样新东西（都在进门那条横过道上）：西墙的身高尺、地上的体重秤、东墙的视力表。量身高或称体重就算体检过了，拿到体检表（记进手册线索）：
     身高一栏是「—」，心率写着「0」。视力表最下面一行不是字母，是一行很小的字，提示当天的一种真实风险（按本局种子挑，读档一样）。
   · 不去：时段结束时记违规、扣 SAN，和学生会检查缺席一样（请假中免）。
   表现只读：模型、排队的人都在 frame 里按状态摆；判定和处罚在 tick／interact 里。 */
'use strict';

var CheckupDay=(function(){
  var own={owner:'campus-tales'};
  var CFG={room:'admin1',from:620,to:665,warn:600,violation:10,san:8,minutes:5,
    office:{c0:1,c1:8,r0:1,r1:15},door:{c:5,r:16},
    ruler:{c:1.0,r:15.45},scale:{c:2.7,r:15.45},chart:{c:9.0,r:15.45},   /* 都在进门那条横过道上（办公桌是高柜，别处会被挡住） */
    queue:[[1.45,17.32],[2.22,17.32],[3.0,17.32],[3.78,17.32],[4.55,17.32]]};
  /* 视力表最下面一行：都是公开的、当天确实存在的风险 */
  var LINES=['十二点五十 坐回座位','熄灯以后 别吃那碗饭','镜子先动 就别再看','喇叭叫你 先查记录本','电梯的门 不等人'];
  function today(){ return typeof $imports.DayEvents!=='undefined'&&$imports.DayEvents.is('checkup'); }
  function st(){ if(!$imports.RT.checkup||typeof $imports.RT.checkup!=='object') $imports.RT.checkup={done:{},missed:{},warned:{}}; return $imports.RT.checkup; }
  function inWindow(){ return $imports.S.tsec>=CFG.from&&$imports.S.tsec<CFG.to; }
  function done(){ return !!(($imports.RT.checkup||{}).done||{})[$imports.S.day]; }
  function line(){ var seed=Number.isFinite($imports.RT.runSeed)?$imports.RT.runSeed:0; return LINES[Math.floor((0,$imports.lhashStr)('checkup-line:'+seed)*LINES.length)%LINES.length]; }
  function R(){ return $imports.INTERIORS[CFG.room]; }
  function at(p){ var r=R(); return {x:r.ox+p.c*r.tw,y:r.oy+p.r*r.th}; }
  function near(p,k){ var r=R(); if(!r||$imports.S.mode!=='in'||$imports.S.room!==CFG.room) return false; var w=at(p); return Math.hypot($imports.S.x-w.x,$imports.S.y-w.y)<(k||1.4)*r.tw; }
  function queueOn(){ return today()&&$imports.S.tsec>=CFG.from-10&&$imports.S.tsec<CFG.to; }
  /* 排队的人挡路：房间碰撞钩子（Collision.depth 会调用 R.collide） */
  function collide(x,y,r){
    if(!queueOn()) return 0;
    var R0=R(), t=0;
    CFG.queue.forEach(function(q){ var c=at({c:q[0],r:q[1]}), hw=0.24*R0.tw, hh=0.17*R0.th;
      t+=$imports.Collision.rectDepth(x,y,r,c.x-hw,c.y-hh,c.x+hw,c.y+hh); });
    return t;
  }
  function hook(){ var r=R(); if(r&&!r.collide) r.collide=collide; }
  /* ---------- 判定 ---------- */
  function tick(){
    if($imports.S.screen!=='play'||$imports.S.dead||!today()) return;
    hook();
    var s=st(), d=$imports.S.day;
    if($imports.S.tsec>=CFG.warn&&$imports.S.tsec<CFG.from&&!s.warned[d]){
      s.warned[d]=1; (0,$imports.os)('广播：「第三节课体检。请各班同学到行政楼一楼医务室排队。」',5,$imports.OS_FORCE);
    }
    if($imports.S.tsec>=CFG.to&&!s.done[d]&&!s.missed[d]){
      s.missed[d]=1;
      if((0,$imports.onLeave)()){ (0,$imports.os)('我：体检的时间过了。我在请假，名单上我那一栏写着「缺」，后面画了个勾。',4); return; }
      $imports.PlayerStats.addViolation(CFG.violation,'checkup');
      $imports.PlayerStats.changeSan(-CFG.san,'checkup',{min:0});
      (0,$imports.os)('我：体检的时间过了。听说名单上只有我那一栏是空的。班主任在本子上记了一笔。',4.4);
      (0,$imports.gameFact)('checkup',{what:'missed'});
    }
  }
  function form(){
    return '体检表\n姓名：（三个认不出的字）　班级：高二（二）班\n身高：—　　体重：正常\n心率：0　　视力：5.0 / 5.0\n医生意见：合格。';
  }
  function hint(){
    if(!today()||$imports.S.mode!=='in'||$imports.S.room!==CFG.room) return undefined;
    if(near(CFG.chart,1.6)) return '视力表';
    if(near(CFG.ruler)||near(CFG.scale)){
      if(done()) return '再看一眼体检表';
      return inWindow()?'体检（量身高、称体重）':$imports.S.tsec<CFG.from?'体检还没开始':'体检已经结束';
    }
    return undefined;
  }
  function interact(){
    if(!today()||$imports.S.mode!=='in'||$imports.S.room!==CFG.room) return undefined;
    if(near(CFG.chart,1.6)){
      (0,$imports.os)('我：视力表最下面一行不是字母。是一行很小的字：\n「'+line()+'」',5,$imports.OS_FORCE);
      try{ $imports.Investigation.record('checkupChart','医务室视力表最下面一行：「'+line()+'」','线索','行政楼一楼医务室'); }catch(e){}
      return true;
    }
    if(!(near(CFG.ruler)||near(CFG.scale))) return undefined;
    if(done()){ (0,$imports.os)(form(),6,$imports.OS_FORCE); return true; }
    if($imports.S.tsec<CFG.from){ (0,$imports.os)('我：医务室里没有人。墙上贴着：「十点二十开始」。',3); return true; }
    if($imports.S.tsec>=CFG.to){ (0,$imports.os)('我：体检已经结束了。体重秤上的指针还没回到零。',3); return true; }
    (0,$imports.advanceGameTime)(CFG.minutes);
    st().done[$imports.S.day]=1;
    (0,$imports.os)('我：我站上去。没有人报数，尺子自己落下来，停在我头顶上方很高的地方。\n'+form(),7,$imports.OS_FORCE);
    try{ $imports.Investigation.record('checkupForm','体检表：身高「—」，心率「0」，医生意见「合格」。','线索','行政楼一楼医务室'); }catch(e){}
    (0,$imports.gameFact)('checkup',{what:'done'});
    try{ (0,$imports.autoSave)(); }catch(e){}
    return true;
  }
  GameModules.on('tick',tick,own);
  GameModules.on('hint',hint,own);
  GameModules.on('interact',interact,own);
  GameModules.on('periodText',function(){
    if(!today()||done()) return undefined;
    if($imports.S.tsec>=CFG.warn&&$imports.S.tsec<CFG.from) return '体检将至 · 行政楼一楼医务室';
    if(inWindow()) return '体检 · 行政楼一楼医务室';
    return undefined;
  },own);

  /* ---------- 表现：身高尺、体重秤、视力表、门边的纸、排队的人 ---------- */
  var F={grp:null,queue:null,key:''}, TEX={};
  function chartTex(text){
    if(TEX[text]) return TEX[text];
    var cv=document.createElement('canvas'); cv.width=256; cv.height=448; var g=cv.getContext('2d');
    g.fillStyle='#f1efe8'; g.fillRect(0,0,256,448); g.fillStyle='#1a1a1a'; g.textAlign='center'; g.textBaseline='middle';
    var sizes=[64,48,38,30,24,19,15,12], y=46, rnd=(0,$imports.lhashStr)(text);
    sizes.forEach(function(sz,i){
      var n=Math.min(6,1+i), w=sz*1.25;
      for(var k=0;k<n;k++){ g.save(); g.translate(128-(n-1)*w/2+k*w,y); g.rotate(Math.floor(((rnd*97+i*7+k*3)%4))*Math.PI/2); g.font='700 '+sz+'px sans-serif'; g.fillText('E',0,0); g.restore(); }
      y+=sz*1.35+6;
    });
    g.font='500 13px '+(typeof $imports.SIGN_FONT!=='undefined'?$imports.SIGN_FONT:'sans-serif'); g.fillText(text,128,y+10);
    var t=new $imports.THREE.CanvasTexture(cv); t.colorSpace=$imports.THREE.SRGBColorSpace; TEX[text]=t; return t;
  }
  function signTex(){
    if(TEX.sign) return TEX.sign;
    var cv=document.createElement('canvas'); cv.width=256; cv.height=128; var g=cv.getContext('2d');
    g.fillStyle='#f4f1ea'; g.fillRect(0,0,256,128); g.fillStyle='#2a2a2a'; g.textAlign='center'; g.textBaseline='middle';
    g.font='700 34px '+(typeof $imports.SIGN_FONT!=='undefined'?$imports.SIGN_FONT:'sans-serif'); g.fillText('医 务 室',128,48);
    g.font='500 20px sans-serif'; g.fillText('（体检）',128,92);
    var t=new $imports.THREE.CanvasTexture(cv); t.colorSpace=$imports.THREE.SRGBColorSpace; TEX.sign=t; return t;
  }
  function clear(){ if(F.grp){ if(F.grp.parent) F.grp.parent.remove(F.grp); try{ $imports.ThreeBackend.disposeGroup(F.grp); }catch(e){} } F.grp=null; F.queue=null; F.key=''; }
  function sp(p,dx,dy){ var r=R(), w=at({c:p.c+(dx||0),r:p.r+(dy||0)}); return (0,$imports.worldToScene)(w.x,w.y,r); }
  function build(){
    var T=$imports.THREE, g=new T.Group(); g.name='checkup-day';
    var white=new T.MeshLambertMaterial({color:0xe9e9e4,emissive:0x2e302e}), metal=new T.MeshLambertMaterial({color:0x8d9396}), dark=new T.MeshLambertMaterial({color:0x2c3033});
    /* 身高尺：贴西墙的竖板＋刻度＋一块能上下滑的横板 */
    var rp=sp(CFG.ruler,0.16,0), ruler=new T.Group();
    var board=new T.Mesh(new T.BoxGeometry(0.05,2.0,0.16),white); board.position.y=1.0; ruler.add(board);
    for(var i=0;i<20;i++){ var tick=new T.Mesh(new T.BoxGeometry(0.006,0.006,i%5?0.05:0.1),dark); tick.position.set(0.028,0.2+i*0.09,0); ruler.add(tick); }
    var head=new T.Mesh(new T.BoxGeometry(0.26,0.025,0.12),metal); head.position.set(0.14,1.92,0); ruler.add(head);    /* 停在头顶上方很高的地方 */
    var base=new T.Mesh(new T.BoxGeometry(0.34,0.04,0.36),metal); base.position.set(0.17,0.02,0); ruler.add(base);
    ruler.position.set(rp.x,0,rp.z); g.add(ruler);
    /* 体重秤：地上一块扁平的秤台，秤盘上一个表盘 */
    var spp=sp(CFG.scale), scale=new T.Group();
    var plate=new T.Mesh(new T.BoxGeometry(0.34,0.06,0.4),white); plate.position.y=0.03; scale.add(plate);
    var dial=new T.Mesh(new T.CylinderGeometry(0.06,0.06,0.012,20),new T.MeshLambertMaterial({color:0xf6f3e8,emissive:0x1a1a14})); dial.position.set(0,0.066,-0.12); scale.add(dial);
    var needle=new T.Mesh(new T.BoxGeometry(0.004,0.004,0.05),new T.MeshBasicMaterial({color:0xa02020})); needle.position.set(0.01,0.074,-0.13); needle.rotation.y=0.9; scale.add(needle);
    scale.position.set(spp.x,0,spp.z); g.add(scale);
    /* 视力表：东墙 */
    var cp=sp(CFG.chart,-0.16,0), chart=new T.Mesh(new T.PlaneGeometry(0.5,0.88),new T.MeshLambertMaterial({map:chartTex(line()),emissive:0x8a8a84,emissiveMap:chartTex(line())}));
    chart.position.set(cp.x,1.45,cp.z); chart.rotation.y=-Math.PI/2; g.add(chart);   /* 东墙，朝西：站在身高尺旁边正好看过去 */
    /* 门边贴的纸 */
    var dp=sp({c:CFG.door.c+2.0,r:CFG.door.r+1.14}), sign=new T.Mesh(new T.PlaneGeometry(0.36,0.18),new T.MeshLambertMaterial({map:signTex(),emissive:0x77756e,emissiveMap:signTex()}));
    sign.position.set(dp.x,1.55,dp.z); g.add(sign);
    /* 排队、面朝墙的同学 */
    var q=new T.Group(), mat=new T.MeshLambertMaterial({color:0x4a5668,emissive:0x252b35});   /* 走廊很暗：留一点轮廓，看得出是一排人 */
    CFG.queue.forEach(function(p,k){ var w=sp({c:p[0],r:p[1]}), f=(0,$imports.figMesh)('person',mat,0.96+0.03*((k*37)%3)); f.position.set(w.x,0,w.z); f.rotation.y=Math.PI; q.add(f); });
    g.add(q);
    $imports.GLR.scene.add(g); F.grp=g; F.queue=q;
  }
  function frame(){
    var on=today()&&$imports.S.mode==='in'&&$imports.S.room===CFG.room&&!!$imports.GLR.scene&&!!$imports.GLR.roomMesh&&$imports.S.screen!=='menu';
    if(!on){ if(F.grp) clear(); return; }
    var key=$imports.GLR.roomMesh.uuid+':'+$imports.S.day;
    if(!F.grp||!F.grp.parent||F.key!==key){ clear(); build(); F.key=key; }
    F.queue.visible=queueOn();
  }
  GameModules.on('frame',frame,own);
  GameModules.on('clearWorld',clear,own);
  GameModules.on('boundary',clear,own);
  return {CFG:CFG, F:F, LINES:LINES, today:today, line:line, done:done, collide:collide, hook:hook, queueOn:queueOn};
})();

/* @module-exports */
GameModules.publish("game3d/js/modules/campus-tales/checkup.js",{
"CheckupDay":{get:function(){return CheckupDay;},set:function($value){CheckupDay=$value;}}
});
})(GameModules.imports("game3d/js/modules/campus-tales/checkup.js"));
