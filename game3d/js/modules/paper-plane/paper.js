/* @module-capsule */
(function($imports){
/* 里世界 3D · 纸飞机与「飞纸飞机的人」（计划《规则怪谈、纸飞机与窗内视线》M2、M4、M5）
   · 10% 口径：每局开局只抽一次总资格（PAPER_CFG.chance），命中后平和、危险各半（计划第 3.1 节建议值）；读档不重抽。
   · 兑现：在有外窗的屋子里（窗位置和 window-gaze 同一套），离你 3–14 米、看得见的一扇窗，没有检查／追逐／异象／过场／手机／窗内视线时。
     纸飞机从那扇窗飞出来（约 2.4 秒），落在你身前一米多的地上。
   · 平和：地上一架纸飞机，捡起来是一张写着真实信息的纸（课表、检查、巡察路线），记进手册，留在背包（满了就留在地上）。
   · 危险（飞纸飞机的人）：窗后有一只手没收回去，拍窗两下（字幕）。
       等你捡：8 秒；没捡 → 脚步找上来。
       读：8 秒（读纸面板，倒计时条；「折好投回」或 E）。关掉不重置，扔掉就是失败。
       投出：4 秒，对准那扇窗按 E。
       飞：镜头跟在纸飞机后面，WASD／方向键（触屏是四个按钮）转向和抬头低头；碰墙、碰柜子、落地、撞顶、超时都算失败；
           从窗口那一面正确穿过去（窗宽 1.4 米、高 1.0–2.25 米）就是送到了。限时 = 直线距离 ÷ 速度 + 6 秒。
       送到：窗里的手接住纸，事件结束，之后 20 秒内不再出窗内视线。
       失败：字幕「脚步声越来越近」，4 秒后死于「飞纸飞机的人」（专属死亡演出在 paper-death.js）；药丸、免疫照旧挡一次。
   · 阅读和飞行时由这个模块接管操作（ownsPlayerInput），世界不暂停；真正暂停时一起停。 */
'use strict';

var PAPER_CFG={chance:0.10,danger:0.5,minRun:150,near:3,far:14,flyIn:2.4,wait:8,read:8,aim:4,speed:2.6,turn:1.7,pitchMax:0.35,sink:0.12,slack:6,hunt:4,calm:20,
  winHalf:0.7,winLow:1.0,winHigh:2.25};
var PaperPlane=(function(){
  var own={owner:'paper-plane'}, C=PAPER_CFG;
  var TALL={'#':1,'S':1,'=':1,'d':1,'K':1,'b':1,'f':1};
  var TIPS=['学生会十二点五十、五点五十各查一次座位。坐在自己的位子上就行。','食堂饭点以外，打饭窗口要一枚硬币。','熄灯以后别在走廊里待太久。巡察者夜里也在走。','听见窗后有呼吸声，就别往窗那边看。'];
  var DANGER_TEXT='他还在那扇窗后等。读完就折好，别留在手里。\n送回有缺角的那扇窗，转弯别碰墙。';
  function st(){ var s=$imports.RT.paper; if(!s||typeof s!=='object') s=$imports.RT.paper={roll:null,ev:null,used:0,calmUntil:0}; return s; }
  function now(){ return $imports.Mechanics?$imports.Mechanics.activePlaySeconds:0; }
  function room(){ return $imports.S.mode==='in'?$imports.INTERIORS[$imports.S.room]:null; }
  function windows(R){ return typeof $imports.WindowGaze!=='undefined'?$imports.WindowGaze.windows(R):[]; }
  function winOf(e){ var R=$imports.INTERIORS[e.room]; return windows(R).filter(function(w){ return w.c===e.c&&w.r===e.r; })[0]||null; }
  function ensureRoll(){ var s=st(); if(!s.roll){ var u=$imports.GameRandom.next(); s.roll={hit:u<C.chance?1:0,kind:u<C.chance*C.danger?'danger':'peace'}; } return s.roll; }
  function busy(){
    if($imports.AN.active||$imports.CUT.on||$imports.PHONE.on||$imports.HIDE.on||$imports.S.seated) return true;
    try{ if(typeof $imports.Inspection!=='undefined'&&$imports.Inspection.quiet()) return true; }catch(e){}
    try{ if($imports.PatrolWorld.localChase()) return true; }catch(e){}
    try{ if(typeof $imports.WindowGaze!=='undefined'&&$imports.WindowGaze.active()) return true; }catch(e){}
    return false;
  }
  function landing(R){
    for(var k=0;k<7;k++){ var a=$imports.S.ang+[0,0.5,-0.5,1,-1,1.6,-1.6][k], d=1.4/$imports.U2M, x=$imports.S.x+Math.cos(a)*d, y=$imports.S.y+Math.sin(a)*d;
      if((0,$imports.canStand)(x,y)) return {x:x,y:y}; }
    return null;
  }
  function start(kind,force){
    var R=room(); if(!R) return false;
    var cand=windows(R).filter(function(w){ var d=Math.hypot(w.x-$imports.S.x,w.y-$imports.S.y)*$imports.U2M; return d>=C.near&&d<=C.far&&$imports.WindowGaze.clear(R,w); });
    if(!cand.length) return false;
    var w=cand[Math.floor($imports.GameRandom.next()*cand.length)], land=landing(R); if(!land) return false;
    var s=st(); s.used=1;
    s.ev={kind:kind,room:R.id,c:w.c,r:w.r,phase:'fly',t:0,lx:land.x,ly:land.y,text:kind==='danger'?DANGER_TEXT:TIPS[Math.floor($imports.GameRandom.next()*TIPS.length)],id:'p'+Math.round(now())};
    (0,$imports.gameFact)('paper',{what:'delivery',kind:kind});
    if(kind==='danger'){ try{ $imports.SoundCaptions.publish('foley.door',{caption:'窗那边 · 两下拍窗'}); }catch(e){} }
    else { try{ $imports.SoundCaptions.publish('foley.door',{caption:'纸擦过地面的轻响'}); }catch(e){} }
    return true;
  }
  function end(why){
    var s=st(), e=s.ev; if(!e) return; closeRead(); s.ev=null; if(why==='returned') s.calmUntil=now()+C.calm;
  }
  /* ---------- 操作所有权：读纸和飞的时候主角不动 ---------- */
  GameModules.on('ownsPlayerInput',function(){ var e=st().ev; return e&&(e.phase==='read'||e.phase==='flight')&&$imports.S.mode==='in'&&$imports.S.room===e.room?true:undefined; },own);
  var KEYS={l:0,r:0,u:0,d:0};
  function key(e,down){
    var ev=st().ev; if(!ev) return;
    var k=e.key;
    if(ev.phase==='flight'){
      var m={ArrowLeft:'l',a:'l',A:'l',ArrowRight:'r',d:'r',D:'r',ArrowUp:'u',w:'u',W:'u',ArrowDown:'d',s:'d',S:'d'}[k];
      if(m){ KEYS[m]=down?1:0; e.preventDefault(); }
    }else if(ev.phase==='read'&&down&&(k==='e'||k==='E'||k==='Enter')){ fold(); e.preventDefault(); }
  }
  if(typeof window!=='undefined'){ window.addEventListener('keydown',function(e){ key(e,true); },true); window.addEventListener('keyup',function(e){ key(e,false); },true); }
  /* ---------- 读纸面板 ---------- */
  function openRead(){
    var e=st().ev, el=document.getElementById('paperread');
    if(!el){ el=document.createElement('div'); el.id='paperread'; el.setAttribute('role','dialog'); el.setAttribute('aria-label','纸上的字');
      el.innerHTML='<div class="pp-paper"><p class="pp-text"></p><div class="pp-bar"><i></i></div><div class="pp-btns"><button type="button" data-act="fold">折好投回（E）</button><button type="button" data-act="drop">扔掉</button></div></div>';
      document.body.appendChild(el);
      el.querySelector('[data-act="fold"]').onclick=function(){ fold(); };
      el.querySelector('[data-act="drop"]').onclick=function(){ fail('drop'); };
    }
    el.querySelector('.pp-text').textContent=e.text; el.hidden=false;
  }
  function closeRead(){ var el=document.getElementById('paperread'); if(el) el.hidden=true; }
  function fold(){ var e=st().ev; if(!e||e.phase!=='read') return; closeRead(); e.phase='aim'; e.t=0; (0,$imports.gameFact)('paper',{what:'read'}); (0,$imports.os)('我：我把纸按原来的折痕折好。那扇窗还开着一条缝。',3,$imports.OS_FORCE); }
  /* ---------- 捡、投 ---------- */
  function nearPaper(){ var e=st().ev; return !!e&&(e.phase==='ground'||e.phase==='wait')&&$imports.S.mode==='in'&&$imports.S.room===e.room&&Math.hypot($imports.S.x-e.lx,$imports.S.y-e.ly)*$imports.U2M<1.3; }
  function facing(e,w){ var dx=w.x-$imports.S.x, dy=w.y-$imports.S.y, a=Math.atan2(dy,dx), d=Math.atan2(Math.sin(a-$imports.S.ang),Math.cos(a-$imports.S.ang)); return Math.abs(d)<0.45; }
  GameModules.on('hint',function(){
    var e=st().ev; if(!e) return undefined;
    if(nearPaper()) return '地上的纸飞机';
    if(e.phase==='aim') return '对准那扇窗投出';
    return undefined;
  },own);
  GameModules.on('interact',function(){
    var e=st().ev; if(!e) return undefined;
    if(nearPaper()){
      if(e.kind==='peace'){
        if(!(0,$imports.addItem)('paper')){ (0,$imports.os)('我：背包满了。纸飞机还在地上。',2.4); return true; }
        $imports.RT.paperNote=e.text; (0,$imports.os)('我：纸飞机里面写着一行字：\n「'+e.text+'」',5,$imports.OS_FORCE);
        try{ $imports.Investigation.record('paperNote','窗口飞来的纸飞机：「'+e.text+'」','线索',(0,$imports.currentPlaceName)()); }catch(err){}
        (0,$imports.gameFact)('paper',{what:'received'}); end('peace'); return true;
      }
      e.phase='read'; e.t=0; openRead(); (0,$imports.gameFact)('paper',{what:'picked'}); return true;
    }
    if(e.phase==='aim'){ var w=winOf(e); if(!w){ fail('lost'); return true; }
      if(!facing(e,w)){ (0,$imports.os)('我：先对准那扇窗。',1.6,$imports.OS_FORCE); return true; }
      launch(e,w); return true; }
    return undefined;
  },own);
  function launch(e,w){
    var d=Math.hypot(w.x-$imports.S.x,w.y-$imports.S.y)*$imports.U2M;
    e.phase='flight'; e.t=0; e.limit=d/C.speed+C.slack;
    e.f={x:$imports.S.x+Math.cos($imports.S.ang)*0.45/$imports.U2M,y:$imports.S.y+Math.sin($imports.S.ang)*0.45/$imports.U2M,h:1.45,yaw:$imports.S.ang,pitch:0,clean:1};
    KEYS.l=KEYS.r=KEYS.u=KEYS.d=0;
    (0,$imports.gameFact)('paper',{what:'launch'});
  }
  /* ---------- 飞（物理在模拟步里） ---------- */
  function solid(R,x,y,h){
    var c=Math.floor((x-R.ox)/R.tw), r=Math.floor((y-R.oy)/R.th), ch=(R.grid[r]||[])[c];
    if(ch===undefined||TALL[ch]) return true;
    return h<0.85&&!!($imports.FURN_SOLID&&$imports.FURN_SOLID[ch]);
  }
  function flyStep(e,w,R,dt){
    var f=e.f, tl=(KEYS.r-KEYS.l)+(e.touch?(e.touch.r-e.touch.l):0), tu=(KEYS.u-KEYS.d)+(e.touch?(e.touch.u-e.touch.d):0);
    f.yaw+=Math.max(-1,Math.min(1,tl))*C.turn*dt;
    var target=Math.max(-1,Math.min(1,tu))*C.pitchMax; f.pitch+=Math.max(-1.5*dt,Math.min(1.5*dt,target-f.pitch));
    var v=C.speed/$imports.U2M, nx=f.x+Math.cos(f.yaw)*Math.cos(f.pitch)*v*dt, ny=f.y+Math.sin(f.yaw)*Math.cos(f.pitch)*v*dt, nh=f.h+(C.speed*Math.sin(f.pitch)-C.sink)*dt;
    /* 穿过窗那一面：w.y 是墙的内表面 */
    var crossed=w.nz>0?(f.y>w.y&&ny<=w.y):(f.y<w.y&&ny>=w.y);
    if(crossed){ var t=(w.y-f.y)/(ny-f.y), cx=f.x+(nx-f.x)*t, ch=f.h+(nh-f.h)*t;
      if(Math.abs(cx-w.x)*$imports.U2M<=C.winHalf&&ch>=C.winLow&&ch<=C.winHigh) return 'in'; }
    f.x=nx; f.y=ny; f.h=nh;
    if(f.h<0.05) return 'floor'; if(f.h>2.85) return 'ceiling';
    if(solid(R,f.x,f.y,f.h)) return 'wall';
    var px=-Math.sin(f.yaw)*0.3/$imports.U2M, py=Math.cos(f.yaw)*0.3/$imports.U2M;
    if(f.clean&&(solid(R,f.x+px,f.y+py,f.h)||solid(R,f.x-px,f.y-py,f.h))){ f.clean=0; try{ $imports.SoundCaptions.publish('foley.door',{caption:'纸翼擦着墙'}); }catch(err){} }
    return null;
  }
  function succeed(e){
    var clean=!!(e.f&&e.f.clean);
    (0,$imports.gameFact)('paper',{what:'returned',clean:clean});
    (0,$imports.os)('我：纸飞机钻进窗缝。窗后那只手接住了它，缩了回去。\n玻璃上留下一块雾，没有掌纹。',4.6,$imports.OS_FORCE);
    end('returned');
  }
  function fail(why){
    var e=st().ev; if(!e||e.phase==='hunt') return;
    closeRead(); e.phase='hunt'; e.t=0; e.why=why;
    (0,$imports.gameFact)('paper',{what:'failed',why:why});
    var line={wall:'纸飞机一头撞在墙上，折痕裂开了。',floor:'纸飞机栽到了地上。',ceiling:'纸飞机撞上了天花板。',timeout:'纸飞机在半空里停了一下，掉了下来。',drop:'我把纸扔在了地上。',wait:'我没有去捡那架纸飞机。',read:'我还没读完，纸在手里皱了。',aim:'我没能把纸投出去。',lost:'那扇窗不见了。'}[why]||'';
    (0,$imports.os)('我：'+line+'\n窗后那只手缩了回去。楼梯那边，脚步声响了起来。',4,$imports.OS_FORCE);
    try{ $imports.SoundCaptions.publish('dread.steps',{caption:'走廊那头 · 脚步声越来越近'}); }catch(err){}
  }
  GameModules.on('tick',function(dt){
    if(!(dt>0)||$imports.S.dead||$imports.S.screen!=='play') return;
    var s=st(), roll=ensureRoll(), e=s.ev;
    if(!e){
      if(roll.hit&&!s.used&&now()>=C.minRun&&!busy()) start(roll.kind);
      return;
    }
    e.t+=dt;
    var here=$imports.S.mode==='in'&&$imports.S.room===e.room, R=$imports.INTERIORS[e.room], w=winOf(e);
    if(e.phase==='fly'){ if(e.t>=C.flyIn){ e.phase=e.kind==='danger'?'wait':'ground'; e.t=0; } return; }
    if(e.phase==='ground'){ if(!here&&e.t>1) end('left'); return; }        /* 平和的纸：离开这间屋就算了 */
    if(e.phase==='wait'){ if(e.t>=C.wait) fail('wait'); return; }
    if(e.phase==='read'){ if(e.t>=C.read) fail('read'); return; }
    if(e.phase==='aim'){ if(e.t>=C.aim) fail('aim'); return; }
    if(e.phase==='flight'){
      if(!w||!R){ fail('lost'); return; }
      var n=4, res=null; for(var i=0;i<n&&!res;i++) res=flyStep(e,w,R,dt/n);
      if(res==='in'){ succeed(e); return; }
      if(res){ fail(res); return; }
      if(e.t>=e.limit) fail('timeout');
      return;
    }
    if(e.phase==='hunt'&&e.t>=C.hunt){
      end('death');
      (0,$imports.kill)('他来取回没有送到的东西。','paper_sender','paper_sender');
    }
  },own);
  GameModules.on('newGame',function(){ $imports.RT.paper=null; ensureRoll(); },own);
  /* ---------- 表现：纸飞机、窗里的手、跟拍镜头、触屏方向键 ---------- */
  var F={grp:null,plane:null,hand:null,key:'',pad:null};
  function planeGeo(){
    var T=$imports.THREE, g=new T.BufferGeometry(), v=new Float32Array([0,0,0.22, -0.11,0,-0.12, 0,-0.025,-0.1,  0,0,0.22, 0,-0.025,-0.1, 0.11,0,-0.12]);
    g.setAttribute('position',new T.BufferAttribute(v,3)); g.computeVertexNormals(); return g;
  }
  function clearFx(){ if(F.grp){ if(F.grp.parent) F.grp.parent.remove(F.grp); try{ $imports.ThreeBackend.disposeGroup(F.grp); }catch(e){} } F.grp=null; F.plane=null; F.hand=null; F.key=''; }
  function pad(show){
    if(!show){ if(F.pad) F.pad.hidden=true; return; }
    if(!F.pad){ var el=document.createElement('div'); el.id='paperpad'; el.innerHTML='<button type="button" data-k="l">◀</button><button type="button" data-k="u">▲</button><button type="button" data-k="d">▼</button><button type="button" data-k="r">▶</button>';
      el.querySelectorAll('button').forEach(function(b){ var k=b.dataset.k; function set(v){ var e=st().ev; if(e){ e.touch=e.touch||{l:0,r:0,u:0,d:0}; e.touch[k]=v; } }
        b.addEventListener('pointerdown',function(ev){ ev.preventDefault(); set(1); }); ['pointerup','pointercancel','pointerleave'].forEach(function(n){ b.addEventListener(n,function(){ set(0); }); }); });
      document.body.appendChild(el); F.pad=el; }
    F.pad.hidden=false;
  }
  function frame(){
    var e=st().ev, here=e&&$imports.S.mode==='in'&&$imports.S.room===e.room&&$imports.GLR.scene&&$imports.GLR.roomMesh;
    pad(!!(here&&e.phase==='flight'&&document.body.classList.contains('touch')));
    if(e&&e.phase==='read'&&here){ var el=document.getElementById('paperread'); if(!el||el.hidden) openRead(); var bar=document.querySelector('#paperread .pp-bar i'); if(bar) bar.style.width=Math.max(0,100*(1-e.t/C.read))+'%'; }
    var key=here&&e.phase!=='hunt'?e.id+':'+$imports.GLR.roomMesh.uuid:'';
    if(key!==F.key){ clearFx(); if(!key) return;
      var T=$imports.THREE, g=new T.Group(); g.name='paper-plane';
      F.plane=new T.Mesh(planeGeo(),new T.MeshLambertMaterial({color:0xf1eee4,emissive:0x2a2924,side:T.DoubleSide})); g.add(F.plane);
      F.hand=new T.Group(); var hm=new T.MeshLambertMaterial({color:0xcdbca6,emissive:0x1c1610});
      var palm=new T.Mesh(new T.BoxGeometry(0.09,0.11,0.03),hm); F.hand.add(palm);
      for(var i=0;i<4;i++){ var fg=new T.Mesh(new T.BoxGeometry(0.018,0.08,0.02),hm); fg.position.set(-0.033+i*0.022,0.09,0); F.hand.add(fg); }
      g.add(F.hand); $imports.GLR.scene.add(g); F.grp=g; F.key=key;
    }
    var R=$imports.INTERIORS[e.room], w=winOf(e); if(!w) return;
    var wp=(0,$imports.worldToScene)(w.x,w.y,R), lp=(0,$imports.worldToScene)(e.lx,e.ly,R);
    F.hand.visible=e.kind==='danger'&&e.phase!=='ground'; F.hand.position.set(wp.x+0.3,1.55,wp.z+w.nz*0.14);
    if(e.phase==='fly'){ var k=Math.min(1,e.t/C.flyIn); F.plane.visible=true;
      F.plane.position.set(wp.x+(lp.x-wp.x)*k,1.7-1.0*k*k+0.3*Math.sin(k*Math.PI)-0.67*k,wp.z+(lp.z-wp.z)*k); F.plane.rotation.set(0,Math.atan2(lp.x-wp.x,lp.z-wp.z),0.3*Math.sin(k*9)); }
    else if(e.phase==='ground'||e.phase==='wait'){ F.plane.visible=true; F.plane.position.set(lp.x,0.03,lp.z); F.plane.rotation.set(0,0.6,0.1); }
    else if(e.phase==='flight'&&e.f){ var fp=(0,$imports.worldToScene)(e.f.x,e.f.y,R); F.plane.visible=true;
      F.plane.position.set(fp.x,e.f.h,fp.z); F.plane.rotation.set(0,0,0); F.plane.rotation.order='YXZ'; F.plane.rotation.y=Math.atan2(Math.cos(e.f.yaw),Math.sin(e.f.yaw)); F.plane.rotation.x=-e.f.pitch;
      var cx=Math.cos(e.f.yaw), cz=Math.sin(e.f.yaw);                         /* 跟拍：纸飞机后上方 */
      $imports.GLR.cam.position.set(fp.x-cx*0.9,e.f.h+0.28,fp.z-cz*0.9); $imports.GLR.cam.lookAt(fp.x+cx*2,e.f.h+Math.sin(e.f.pitch)*2,fp.z+cz*2); }
    else F.plane.visible=false;
  }
  GameModules.on('frame',frame,own);
  GameModules.on('clearWorld',clearFx,own);
  GameModules.on('boundary',function(){ clearFx(); closeRead(); pad(false); },own);
  if(typeof $imports.ITEMS!=='undefined'&&!$imports.ITEMS.paper) $imports.ITEMS.paper={n:'纸飞机',d:'从窗口飞进来的。拆开是一张写了字的纸。'};
  if(typeof $imports.DEATH_SOURCES!=='undefined') $imports.DEATH_SOURCES.paper_sender={cause:'窗后飞来的纸飞机没有按时、按原路送回去。飞纸飞机的人自己来取了。',hint:'两下拍窗的纸要尽快读完、折好，对准原来那扇窗投回去，飞的时候别碰墙。'};
  if(typeof $imports.DEATH_HINTS!=='undefined') $imports.DEATH_HINTS.paper_sender='拍窗两下的纸：读完折好，从原来那扇窗送回去，别碰墙。';
  return {CFG:C, state:st, roll:ensureRoll, start:start, fold:fold, launch:launch, fail:fail, windowOf:winOf, keys:KEYS, nearPaper:nearPaper};
})();

/* @module-exports */
GameModules.publish("game3d/js/modules/paper-plane/paper.js",{
"PAPER_CFG":{get:function(){return PAPER_CFG;},set:function($value){PAPER_CFG=$value;}},
"PaperPlane":{get:function(){return PaperPlane;},set:function($value){PaperPlane=$value;}}
});
})(GameModules.imports("game3d/js/modules/paper-plane/paper.js"));
