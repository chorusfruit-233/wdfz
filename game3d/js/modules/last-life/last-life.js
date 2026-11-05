/* @module-capsule */
(function($imports){
/* 里世界 3D · 上一局的你（《校园怪谈创意提案》C2）
   新的一局里，上一局死去的地方，地上有一个淡淡的粉笔「×」和当时的时刻；保安岗的失物招领箱里多了一张学生证，照片那一栏是空的。
   · 死亡位置单独存一条（wdfz3d_last_life_v1：场景、位置、时刻、第几天），因为回放流水在死亡时会删掉。
   · 预知梦惊醒不算（还在同一局）；调试面板开着、内部场景（迷宫）和隐藏死亡档案的死法不留记号，避免泄密。
   · 新开局时把这条抄进本局（RT.lastLife），跟着存档走：读档不会重复生成，也不会被这一局的死亡改写；
     这一局真的死了，才把新的位置写进存储，下一局看到。通关以后清掉（上一局没有死）。
   · 速通模式也显示（已确认）。设置「声音与文字」里有「清除上一局的痕迹」。
   · 只给位置和时刻，不说死因（死因在 CG 档案馆里）。 */
'use strict';

var LAST_LIFE_KEY='wdfz3d_last_life_v1';
var LastLife=(function(){
  var own={owner:'last-life'}, F={grp:null,key:''};
  function read(){ try{ var d=JSON.parse(localStorage.getItem(LAST_LIFE_KEY)||'null'); return d&&d.v===1&&typeof d.scene==='string'&&Number.isFinite(d.x)&&Number.isFinite(d.y)?d:null; }catch(e){ return null; } }
  function write(d){ try{ if(d) localStorage.setItem(LAST_LIFE_KEY,JSON.stringify(d)); else localStorage.removeItem(LAST_LIFE_KEY); }catch(e){} }
  function scene(){ return $imports.S.mode==='in'?$imports.S.room:'out'; }
  function secret(source){
    try{ var e=$imports.DeathArchive.idFor(source,$imports.S.death); var arc=e&&$imports.DEATH_ARCHIVE.filter(function(x){ return x.id===e; })[0]; return !!(arc&&arc.secret); }catch(e2){ return false; }
  }
  function internal(id){ var R=$imports.INTERIORS[id]; return !!R&&(R.noMap||id==='lift_dream'||id==='portal_tunnel'); }
  function onFact(f){
    if(!f) return;
    if(f.kind==='death'){
      if(f.wake||(typeof $imports.DEV!=='undefined'&&$imports.DEV.on)) return;
      var sc=scene(); if(internal(sc)||secret(f.source)) return;
      write({v:1,scene:sc,x:$imports.S.x,y:$imports.S.y,fy:$imports.S.floorY||0,tsec:Math.round($imports.S.tsec),day:$imports.S.day,at:Date.now()});
    }else if(f.kind==='ending'&&!f.fake){ write(null); }
  }
  /* ---------- 画面：地上一个粉笔 ×，旁边写着时刻 ---------- */
  var TEX={};
  function tex(text){
    if(TEX[text]) return TEX[text];
    var cv=document.createElement('canvas'); cv.width=256; cv.height=128; var g=cv.getContext('2d');
    g.clearRect(0,0,256,128); g.strokeStyle='rgba(235,232,220,.85)'; g.lineCap='round'; g.lineWidth=9;
    g.beginPath(); g.moveTo(26,22); g.lineTo(98,104); g.moveTo(98,22); g.lineTo(30,100); g.stroke();
    g.fillStyle='rgba(235,232,220,.82)'; g.font='600 46px "Noto Sans SC",sans-serif'; g.textBaseline='middle'; g.fillText(text,118,66);
    for(var i=0;i<500;i++){ g.clearRect((i*53)%256,(i*97)%128,2,2); }          /* 粉笔的颗粒：擦掉一些点 */
    var t=new $imports.THREE.CanvasTexture(cv); t.colorSpace=$imports.THREE.SRGBColorSpace; TEX[text]=t; return t;
  }
  function clear(){ if(F.grp){ if(F.grp.parent) F.grp.parent.remove(F.grp); try{ $imports.ThreeBackend.disposeGroup(F.grp); }catch(e){} } F.grp=null; F.key=''; }
  function frame(){
    var d=$imports.RT.lastLife, sc=scene();
    var key=d&&d.scene===sc&&$imports.S.screen!=='menu'?sc+':'+d.x+','+d.y:'';
    if(key===F.key) return;
    clear(); if(!key||!$imports.GLR.scene) return;
    var R=$imports.S.mode==='in'?$imports.INTERIORS[sc]:null, p=(0,$imports.worldToScene)(d.x,d.y,R);
    var m=new $imports.THREE.Mesh(new $imports.THREE.PlaneGeometry(0.9,0.45),new $imports.THREE.MeshLambertMaterial({map:tex((0,$imports.fmtClock)(d.tsec)),transparent:true,opacity:0.7,depthWrite:false}));
    m.rotation.x=-Math.PI/2; m.position.set(p.x,(d.fy||0)+0.012,p.z);
    F.grp=new $imports.THREE.Group(); F.grp.name='last-life'; F.grp.add(m); $imports.GLR.scene.add(F.grp); F.key=key;
  }
  /* ---------- 保安岗的失物招领箱 ---------- */
  var BOX={room:'guard1',c:4,r:6};
  function nearBox(){ var R=$imports.INTERIORS[BOX.room]; return !!R&&$imports.S.mode==='in'&&$imports.S.room===BOX.room&&Math.hypot($imports.S.x-(R.ox+(BOX.c+0.5)*R.tw),$imports.S.y-(R.oy+(BOX.r+0.5)*R.th))<1.4*R.tw; }
  GameModules.on('hint',function(){ return $imports.RT.lastLife&&nearBox()?'失物招领箱':undefined; },own);
  GameModules.on('interact',function(){
    if(!$imports.RT.lastLife||!nearBox()) return undefined;
    var d=$imports.RT.lastLife;
    (0,$imports.os)('我：失物招领箱里有一张学生证。班号是我们班，照片那一栏是空的。\n背面用铅笔写着：第 '+d.day+' 天 '+(0,$imports.fmtClock)(d.tsec)+'。',5);
    try{ $imports.Investigation.record('lastLife','保安岗失物招领箱里的学生证：照片是空的，背面写着「第 '+d.day+' 天 '+(0,$imports.fmtClock)(d.tsec)+'」。','线索','保安岗'); }catch(e){}
    return true;
  },own);
  GameModules.on('newGame',function(){ var d=read(); $imports.RT.lastLife=d?{scene:d.scene,x:d.x,y:d.y,fy:d.fy||0,tsec:d.tsec,day:d.day}:null; },own);
  GameModules.on('gameFact',onFact,own);
  GameModules.on('frame',frame,own);
  GameModules.on('clearWorld',clear,own);
  GameModules.on('boundary',clear,own);
  /* 设置里的「清除上一局的痕迹」 */
  GameModules.on('boot',function(){
    var set=document.querySelector('#set .sgroup[aria-labelledby="sgSound"]'); if(!set||document.getElementById('sLastLife')) return;
    var row=document.createElement('div'); row.className='srow'; row.innerHTML='<span>上一局的痕迹</span><button type="button" id="sLastLife">清除</button>';
    set.appendChild(row);
    document.getElementById('sLastLife').addEventListener('click',function(){ write(null); $imports.RT.lastLife=null; clear(); try{ (0,$imports.toast)('已清除上一局的痕迹'); }catch(e){} });
  },own);
  return {read:read, write:write, F:F, nearBox:nearBox};
})();

/* @module-exports */
GameModules.publish("game3d/js/modules/last-life/last-life.js",{
"LAST_LIFE_KEY":{get:function(){return LAST_LIFE_KEY;},set:function($value){LAST_LIFE_KEY=$value;}},
"LastLife":{get:function(){return LastLife;},set:function($value){LastLife=$value;}}
});
})(GameModules.imports("game3d/js/modules/last-life/last-life.js"));
