/* @module-capsule */
(function($imports){
/* 里世界 3D · 值日表上的名字（《校园怪谈创意提案》C4：同化的画面反馈）
   每间教室前墙的值日表（model/room.js 的 dutyTex，userData.decor='值日表'）随同化档位（S.tt 每 20 一档，和现有同化提醒同一套档位）改写：
   0 档：原样；1 档：「今天」那一栏多了你的名字；2 档：每一天都有你；3 档：每天两格是你；4 档以上：整张表只剩你的名字，
   字迹和别人的一模一样。你的名字和课桌上的名牌一样：看得出是个名字，认不出是什么字。不写数字；只在换档或换房间时重画。 */
'use strict';

var DutyRoster=(function(){
  var own={owner:'campus-tales'}, F={room:null,tier:-1,day:0,list:[]}, TEX={};
  function tier(){ return Math.max(0,Math.min(4,Math.floor(($imports.S.tt||0)/20))); }
  /* 名字：三个连笔的「字」，像名牌上那样认不出 */
  function scribble(g,x,y,w,rnd,same){
    g.save(); g.translate(x,y); g.lineWidth=same?2.2:2.6; g.lineCap='round';
    for(var k=0;k<3;k++){ var ox=k*w/3, r=rnd;
      g.beginPath(); g.moveTo(ox+2,-6+r()*3); g.bezierCurveTo(ox+8,-12,ox+12,8,ox+w/3-4,-2+r()*3); g.moveTo(ox+5,4); g.lineTo(ox+w/3-6,-8+r()*4); g.stroke(); }
    g.restore();
  }
  function rand(seed){ var s=seed>>>0||1; return function(){ s=(s*1664525+1013904223)>>>0; return s/4294967296; }; }
  function draw(t,today,key){
    if(TEX[key]) return TEX[key];
    var cv=document.createElement('canvas'), w=384, h=512; cv.width=w; cv.height=h;
    var g=cv.getContext('2d'), rnd=rand(key.length*97+t*13+today), font=(typeof $imports.SIGN_FONT!=='undefined'?$imports.SIGN_FONT:'sans-serif'), hand=(typeof $imports.SIGN_HAND!=='undefined'?$imports.SIGN_HAND:font);
    g.fillStyle='#e7e2d3'; g.fillRect(0,0,w,h); g.fillStyle='#3b6b47'; g.fillRect(0,0,w,64);
    g.fillStyle='#eef0e6'; g.textAlign='center'; g.textBaseline='middle'; g.font='700 32px '+font; g.fillText('值 日 表',w/2,33);
    g.font='500 15px '+font; g.fillStyle='#4a5a4a'; g.fillText('扫地 · 拖地 · 擦黑板 · 倒垃圾',w/2,82);
    var days=['周一','周二','周三','周四','周五'], names=(typeof $imports.DUTY_NAMES!=='undefined'?$imports.DUTY_NAMES:['王浩','李欣然','张一鸣']);
    for(var d=0;d<5;d++){
      var yy=102+d*78;
      g.strokeStyle='rgba(59,107,71,.5)'; g.lineWidth=1.2; g.strokeRect(16,yy,w-32,70);
      g.textAlign='left'; g.fillStyle='#3b6b47'; g.font='700 20px '+font; g.fillText(days[d],26,yy+35);
      for(var k=0;k<3;k++){
        var mine=t>=4||(t===3&&k<2)||(t===2&&k===0)||(t===1&&k===0&&d===today);
        g.strokeStyle=g.fillStyle='rgba(28,34,70,.85)';
        if(mine) scribble(g,100+k*88,yy+36,78,rnd,t>=4);
        else{ g.font='600 21px '+hand; g.fillText(names[(key.length*5+d*3+k)%names.length],100+k*88+rnd()*6,yy+36+(rnd()-.5)*5,82); }
      }
    }
    var tx=new $imports.THREE.CanvasTexture(cv); tx.colorSpace=$imports.THREE.SRGBColorSpace; tx.anisotropy=4; TEX[key]=tx; return tx;
  }
  function collect(){
    F.list=[];
    if(!$imports.GLR.roomMesh) return;
    $imports.GLR.roomMesh.traverse(function(o){
      if(o.userData&&o.userData.decor==='值日表'&&o.material){
        var mats=Array.isArray(o.material)?o.material:[o.material], face=mats[4]||mats[0];
        if(face&&!o.userData.dutyOrig) o.userData.dutyOrig=face.map;
        F.list.push({o:o,face:face});
      }
    });
  }
  function frame(){
    var R=$imports.S.mode==='in'?$imports.INTERIORS[$imports.S.room]:null;
    if(!R||R.host!=='teach'||!$imports.GLR.roomMesh){ F.room=null; return; }
    var key=$imports.S.room+':'+($imports.GLR.roomMesh.uuid||''), t=tier(), today=(($imports.S.day||1)-1)%5;
    if(F.room!==key){ F.room=key; F.tier=-1; collect(); }
    if(t===F.tier&&today===F.day) return;
    F.tier=t; F.day=today;
    F.list.forEach(function(e,i){
      if(!e.face) return;
      e.face.map=t===0?e.o.userData.dutyOrig:draw(t,today,'duty'+i+':'+t+':'+today);
      e.face.needsUpdate=true;
    });
  }
  GameModules.on('frame',frame,own);
  GameModules.on('clearWorld',function(){ F.room=null; F.list=[]; },own);
  return {F:F, tier:tier};
})();

/* @module-exports */
GameModules.publish("game3d/js/modules/campus-tales/duty.js",{
"DutyRoster":{get:function(){return DutyRoster;},set:function($value){DutyRoster=$value;}}
});
})(GameModules.imports("game3d/js/modules/campus-tales/duty.js"));
