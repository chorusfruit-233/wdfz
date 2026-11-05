/* @module-capsule */
(function($imports){
/* 里世界 3D · 手机相机（《校园怪谈创意提案》C11，已确认：拍照不额外耗电、所有异象都做）
   手机多一个「相机」应用。拍照＝把当前画面截一帧缩成小图，再叠一层只在照片里出现的东西：
   · 正在发生异象时，每种异象各有一张「照片里多出来的东西」（PHOTO 表，逐种都有；内部异象的照片内容只写在内部材料里，不进 Wiki）。
     没有异象时照片里什么也没有——不随机吓人，照片只说明你真的拍到了什么。
   · 照片存进本局的相册（RT.photos，最多 PHOTO_CFG.keep 张，小图跟着存档走），在相机里翻看；异象的照片同时记进手册的线索。
   · 闪光默认开，可以关。开着闪光时，如果巡察者和你在同一个场景、离得不太远而且看得见你（用现有的视线判定 PatrolNav.los），
     它会被闪光引过来：锁定进度直接推到快满，并记下你拍照的位置。关掉闪光就不会；不开闪光的照片更暗。
   · 拍照不耗电（只有手机没电、开不了机的时候拍不了），不改变任何异象的规则，也不能用来驱散异象。
   · 画面上的闪白遵守「减少闪光」：打开后只是轻微变亮。 */
'use strict';

var PHOTO_CFG={keep:6,w:192,h:108,quality:0.6,flashSee:1.6,flashLock:0.85};
/* kind：照片里叠的那一层画什么；cap：照片下面那句话（只写照片里多出来的东西，不写怎么应对） */
var PHOTO={
  blackout:{k:'eyes',cap:'黑暗里有很多双眼睛，都在同一个高度。'},
  rain:{k:'figure',cap:'雨幕后面站着一个没打伞的人，身上是干的。'},
  moth:{k:'face',cap:'蛾子聚成了一张脸。'},
  turn:{k:'behind',cap:'我肩膀后面有一个影子，比我高一个头。'},
  broad:{k:'text',cap:'喇叭下面的墙上写着我的名字。',text:'高二（二）班'},
  bell13:{k:'face',cap:'钟楼的窗口里，有一张脸贴在钟上。'},
  exercise:{k:'crowd',cap:'做操的人全都面朝镜头。'},
  bells:{k:'hands',cap:'每一个车铃上都按着一只手。'},
  hand:{k:'hands',cap:'隔间底下伸出来的不是一只手，是三只。'},
  repeat:{k:'figure',cap:'问我作业的那个人，脚下没有影子。'},
  chalk:{k:'text',cap:'黑板上多了一行：「拍照的那个」。',text:'拍照的那个'},
  loop:{k:'figure',cap:'走廊尽头站着一个人，穿着和我一样的校服。'},
  roster:{k:'text',cap:'名单上被划掉的那一行，写的是今天的日期。',text:'今天'},
  leak:{k:'face',cap:'天花板上的水渍，是一张往下看的脸。'},
  rite:{k:'crowd',cap:'围成一圈的人中间空着一个位置，正好是我站的地方。'},
  cold:{k:'figure',cap:'冷库最里面坐着一个人，在朝我招手。'},
  shifting:{k:'face',cap:'对面那栋楼，每一扇窗户里都有一个人。'},
  stare:{k:'eyes',cap:'所有人都在看镜头，包括我座位上的那个。'},
  lamps:{k:'figure',cap:'每一盏亮着的灯底下，都站着一个人。'},
  feast:{k:'seated',cap:'空着的餐桌边坐满了人，盘子里什么也没有。'},
  necker:{k:'face',cap:'围墙上方探出来的那个头，脖子很长。'},
  shadow:{k:'behind',cap:'地上我的影子，脸朝着镜头。'},
  twin:{k:'figure',cap:'天台边上的那个人，也举着手机在拍我。'},
  raindots:{k:'text',cap:'地上的雨点拼成了两个字：「别拍」。',text:'别拍'},
  cup:{k:'hands',cap:'窗台上的杯子旁边，有一只手正要推它。'},
  /* ---- 内部异象（照片内容只写内部材料，不进 Wiki） ---- */
  cola:{k:'figure',cap:'楼顶边上蹲着一个人，手里拿着一罐东西。',secret:1},
  crowd:{k:'crowd',cap:'电梯里挤满了人，全都面朝门。',secret:1}
};
var PhoneCamera=(function(){
  var own={owner:'phone-camera'};
  function flashOn(){ return !($imports.RT.cameraFlash===0); }
  function photos(){ if(!Array.isArray($imports.RT.photos)) $imports.RT.photos=[]; return $imports.RT.photos; }
  /* 现在镜头里的异象：正在发生的普通异象；电梯里的「满员」由它自己的模块报 */
  function subject(){
    try{ if(typeof $imports.LiftCrowd!=='undefined'&&$imports.LiftCrowd.active&&$imports.LiftCrowd.active()) return 'crowd'; }catch(e){}
    return $imports.AN.active&&PHOTO[$imports.AN.id]?$imports.AN.id:null;
  }
  function placeName(){ try{ return (0,$imports.currentPlaceName)(); }catch(e){ return $imports.S.mode==='in'?(($imports.INTERIORS[$imports.S.room]||{}).name||''):'校园'; } }
  /* ---------- 叠在照片上的那一层 ---------- */
  function rnd(seed){ var s=seed>>>0||7; return function(){ s=(s*1664525+1013904223)>>>0; return s/4294967296; }; }
  function person(g,x,y,h,a){ g.globalAlpha=a; g.beginPath(); g.arc(x,y-h*0.86,h*0.09,0,Math.PI*2); g.fill(); g.fillRect(x-h*0.11,y-h*0.76,h*0.22,h*0.46); g.fillRect(x-h*0.085,y-h*0.3,h*0.07,h*0.3); g.fillRect(x+h*0.015,y-h*0.3,h*0.07,h*0.3); }
  function overlay(g,kind,r,W,H,text){
    g.save(); g.fillStyle='rgba(10,10,12,1)';
    if(kind==='figure'){ person(g,W*(0.3+0.4*r()),H*0.86,H*0.55,0.62); }
    else if(kind==='behind'){ person(g,W*0.86,H*1.12,H*1.25,0.7); }
    else if(kind==='crowd'){ for(var i=0;i<9;i++) person(g,W*(0.08+i*0.105)+r()*4,H*(0.9+0.05*r()),H*(0.42+0.08*r()),0.5); }
    else if(kind==='seated'){ for(var j=0;j<6;j++) person(g,W*(0.12+j*0.15),H*0.78,H*0.36,0.48); }
    else if(kind==='eyes'){ g.fillStyle='rgba(235,232,215,.85)'; var y0=H*(0.42+0.05*r()); for(var k=0;k<7;k++){ var x0=W*(0.1+k*0.13)+r()*5; g.fillRect(x0,y0,2,1.4); g.fillRect(x0+5,y0,2,1.4); } }
    else if(kind==='face'){ g.globalAlpha=0.55; g.fillStyle='rgba(215,210,195,1)'; var fx=W*(0.35+0.3*r()), fy=H*0.38; g.beginPath(); g.ellipse(fx,fy,10,13,0,0,Math.PI*2); g.fill(); g.fillStyle='rgba(10,10,12,1)'; g.fillRect(fx-5,fy-3,3,2); g.fillRect(fx+2,fy-3,3,2); g.fillRect(fx-3,fy+5,6,1.5); }
    else if(kind==='hands'){ g.globalAlpha=0.6; g.fillStyle='rgba(210,204,190,1)'; for(var m=0;m<3;m++){ var hx=W*(0.25+m*0.22), hy=H*0.82; g.fillRect(hx,hy,12,7); for(var n=0;n<4;n++) g.fillRect(hx+n*3,hy-7-(n%2)*2,2,8); } }
    else if(kind==='text'){ g.globalAlpha=0.7; g.fillStyle='rgba(215,210,195,1)'; g.font='600 15px '+(typeof $imports.SIGN_HAND!=='undefined'?$imports.SIGN_HAND:'sans-serif'); g.textAlign='center'; g.fillText(text||'',W*0.5,H*0.45); }
    g.restore();
  }
  /* ---------- 拍照 ---------- */
  function capture(an,flash){
    var W=PHOTO_CFG.w, H=PHOTO_CFG.h, cv=document.createElement('canvas'); cv.width=W; cv.height=H; var g=cv.getContext('2d');
    g.fillStyle='#16181a'; g.fillRect(0,0,W,H);
    try{ if(typeof $imports.render==='function') (0,$imports.render)(0); g.drawImage($imports.GLR.renderer.domElement,0,0,W,H); }catch(e){}     /* 同一个任务里读画布，绘制缓冲还没被清掉 */
    if(flash){ var rg=g.createRadialGradient(W/2,H/2,4,W/2,H/2,W*0.6); rg.addColorStop(0,'rgba(255,252,240,.38)'); rg.addColorStop(1,'rgba(255,252,240,0)'); g.fillStyle=rg; g.fillRect(0,0,W,H); }
    else{ g.fillStyle='rgba(0,0,0,.42)'; g.fillRect(0,0,W,H); }
    var def=an&&PHOTO[an]; if(def) overlay(g,def.k,rnd((0,$imports.lhashStr)(an+':'+$imports.S.day+':'+Math.round($imports.S.tsec))*4294967296),W,H,def.text);
    var noise=rnd(Math.round($imports.S.tsec*7)+3); g.fillStyle='rgba(255,255,255,.06)'; for(var i=0;i<260;i++) g.fillRect(noise()*W,noise()*H,1,1);
    g.font='10px monospace'; g.fillStyle='rgba(255,190,90,.85)'; g.textAlign='right';
    g.fillText(((0,$imports.hasClock)()?(0,$imports.fmtClock)($imports.S.tsec):'--:--')+'  D'+$imports.S.day,W-5,H-5);
    try{ return cv.toDataURL('image/jpeg',PHOTO_CFG.quality); }catch(e){ return ''; }
  }
  /* 闪光：用巡察者现有的视线判定。同一场景、视线通、在可视距离的 1.6 倍以内就会被引过来 */
  function flashNotice(){
    try{
      if(!$imports.PatrolWorld.same()||$imports.PAT.state!=='walk'||$imports.HIDE.on) return false;
      var d=Math.hypot($imports.PAT.x-$imports.S.x,$imports.PAT.y-$imports.S.y);
      if(d>$imports.PAT_SEE*PHOTO_CFG.flashSee) return false;
      var me=$imports.PatrolNav.point($imports.S.mode==='in'?$imports.S.room:'out',$imports.S.x,$imports.S.y,$imports.S.floorY);
      if(!$imports.PatrolNav.los($imports.PatrolWorld.position(),me)) return false;
      $imports.PAT.lock=Math.max($imports.PAT.lock||0,PHOTO_CFG.flashLock); $imports.PAT.lastSeen=me; $imports.PAT.search=Math.max($imports.PAT.search||0,3);
      (0,$imports.gameFact)('patrol',{what:'flash'});
      return true;
    }catch(e){ return false; }
  }
  function flashScreen(){
    var el=document.getElementById('camflash');
    if(!el){ el=document.createElement('div'); el.id='camflash'; document.body.appendChild(el); }
    el.style.opacity=$imports.SET.reduceFlash?'0.18':'0.85'; el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
  }
  function shoot(){
    if(!$imports.PHONE.on||$imports.S.dead) return null;
    var an=subject(), flash=flashOn(), img=capture(an,flash), def=an&&PHOTO[an];
    var cap=def?'照片里，'+def.cap:'照片里什么也没有。';
    var p={an:an||'',cap:cap,img:img,day:$imports.S.day,t:Math.round($imports.S.tsec),place:placeName(),flash:flash?1:0};
    var list=photos(); list.unshift(p); while(list.length>PHOTO_CFG.keep) list.pop();
    if(flash) flashScreen();
    var seen=flash&&flashNotice();
    try{ $imports.SFX.click(); }catch(e){}
    (0,$imports.os)('我：咔嚓。'+(def?'我低头看了一眼照片。'+cap:'')+(seen?'\n闪光一亮，走廊那头的脚步停了一下，转了过来。':''),def?4.6:2.4,$imports.OS_FORCE);
    if(def&&!def.secret){ try{ $imports.Investigation.record('photo_'+an,'手机里的照片（'+p.place+'）：'+cap,'线索',p.place); }catch(e){} }
    (0,$imports.gameFact)('photo',{an:an||null,flash:!!flash,seen:!!seen});
    paint();
    return p;
  }
  /* ---------- 手机里的「相机」页 ---------- */
  var mountEl=null;
  function mount(tool){
    mountEl=tool;
    var shot=document.createElement('button'); shot.type='button'; shot.dataset.action='shoot'; shot.textContent='拍照'; shot.onclick=function(){ shoot(); };
    var fl=document.createElement('button'); fl.type='button'; fl.dataset.action='flash'; fl.onclick=function(){ $imports.RT.cameraFlash=flashOn()?0:1; paint(); };
    var album=document.createElement('div'); album.className='phalbum';
    tool.appendChild(shot); tool.appendChild(fl); tool.appendChild(album); paint();
  }
  function paint(){
    if(!mountEl||!mountEl.isConnected) return;
    try{ $imports.PHONE.paintApps(); }catch(e){}
    var fl=mountEl.querySelector('[data-action="flash"]'); if(fl){ fl.textContent='闪光：'+(flashOn()?'开':'关'); fl.setAttribute('aria-pressed',String(flashOn())); }
    var album=mountEl.querySelector('.phalbum'); if(!album) return;
    var key=photos().map(function(p){ return p.t+':'+p.day; }).join('|'); if(album.dataset.key===key) return; album.dataset.key=key;
    while(album.firstChild) album.removeChild(album.firstChild);
    photos().forEach(function(p){
      var f=document.createElement('figure'); if(p.img){ var im=document.createElement('img'); im.src=p.img; im.alt=p.cap; f.appendChild(im); }
      var c=document.createElement('figcaption'); c.textContent='第 '+p.day+' 天 · '+p.place+' · '+p.cap; f.appendChild(c); album.appendChild(f);
    });
  }
  function copy(){ return '拍照不耗电。闪光'+(flashOn()?'开着：照片亮一些，但巡察者看得见你的话，会被闪光引过来。':'关着：照片暗一些，不会引来巡察者。')+'\n相册（最近 '+PHOTO_CFG.keep+' 张）：'+(photos().length?photos().length+' 张':'还没有照片。'); }
  GameModules.on('phoneApp',function(app,tool){ if(app==='camera') mount(tool); },own);
  GameModules.on('phoneCopy',function(app){ return app==='camera'?copy():undefined; },own);
  return {shoot:shoot, capture:capture, subject:subject, flashNotice:flashNotice, photos:photos, flashOn:flashOn, PHOTO:PHOTO};
})();

/* @module-exports */
GameModules.publish("game3d/js/modules/phone-camera/camera.js",{
"PHOTO_CFG":{get:function(){return PHOTO_CFG;},set:function($value){PHOTO_CFG=$value;}},
"PHOTO":{get:function(){return PHOTO;},set:function($value){PHOTO=$value;}},
"PhoneCamera":{get:function(){return PhoneCamera;},set:function($value){PhoneCamera=$value;}}
});
})(GameModules.imports("game3d/js/modules/phone-camera/camera.js"));
