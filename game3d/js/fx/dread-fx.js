/* 里世界 3D · 回访变化的画面（逻辑在 dread.js）
   · 坏掉的一盏灯：大部分时间灭着，偶尔抽一下；
   · 地上的纸条：一张平放的纸，手写一行字；不挡路、没有碰撞，出房间就收走。 */
'use strict';

var DREADFX={note:null,lamp:-1};
var DreadFx={
  clear:function(){
    if(DREADFX.note){
      if(DREADFX.note.parent) DREADFX.note.parent.remove(DREADFX.note);
      ThreeBackend.disposeGroup(DREADFX.note);
      DREADFX.note=null;
    }
    DREADFX.lamp=-1;
  },
  lamp:function(n){
    var count=GLR&&GLR.roomLights?GLR.roomLights.length:0;
    DREADFX.lamp=count?n%count:-1;
  },
  /* 灯坏了：大部分时间只剩一点余光，偶尔抽一下亮起来 */
  lampMul:function(i,tt){
    if(i!==DREADFX.lamp) return 1;
    var twitch=Math.sin(tt*7.3+1.1)>0.985||Math.sin(tt*2.9)>0.996;
    return twitch?0.85:0.06;
  },
  note:function(text,seed){
    if(!GLR||!GLR.scene||S.mode!=='in') return;
    var R=INTERIORS[S.room]; if(!R) return;
    if(DREADFX.note){ if(DREADFX.note.parent) DREADFX.note.parent.remove(DREADFX.note); ThreeBackend.disposeGroup(DREADFX.note); DREADFX.note=null; }
    /* 落点：视线前方 1.6–2.6 米能站人的地方；找不到就放脚边 */
    var spot=null, i;
    for(i=0;i<10&&!spot;i++){
      var a=S.ang+(i%2?1:-1)*i*0.16, m=(1.3+((seed*7+i)%1)*0.8)/U2M;
      var x=S.x+Math.cos(a)*m, y=S.y+Math.sin(a)*m;
      if(canStand(x,y)) spot={x:x,y:y};
    }
    if(!spot) spot={x:S.x+Math.cos(S.ang)*4,y:S.y+Math.sin(S.ang)*4};
    var cv=document.createElement('canvas'); cv.width=256; cv.height=176;
    var g=cv.getContext('2d');
    g.fillStyle='#d9d1bd'; g.fillRect(0,0,256,176);
    g.strokeStyle='rgba(120,130,150,.35)'; g.lineWidth=1;
    for(i=1;i<6;i++){ g.beginPath(); g.moveTo(10,i*29); g.lineTo(246,i*29); g.stroke(); }   /* 作业纸的横格 */
    g.fillStyle='#2b2622'; g.font='22px "Noto Serif SC","Songti SC","SimSun",serif'; g.textBaseline='middle';
    /* 一行写不下就折成两行 */
    var lines=[], cur='';
    for(i=0;i<text.length;i++){ var tryLine=cur+text[i]; if(g.measureText(tryLine).width>220&&cur){ lines.push(cur); cur=text[i]; } else cur=tryLine; }
    if(cur) lines.push(cur);
    lines.slice(0,3).forEach(function(l,j){ g.fillText(l,16,58+j*36); });
    var tex=new THREE.CanvasTexture(cv);
    /* 纸在暗处也反着一点光：带一层很淡的自发光，字还能看清 */
    var mesh=new THREE.Mesh(new THREE.PlaneGeometry(0.34,0.234),new THREE.MeshLambertMaterial({map:tex,emissive:0x8a8478,emissiveMap:tex,side:THREE.DoubleSide}));
    var p=worldToScene(spot.x,spot.y,R);
    mesh.rotation.x=-Math.PI/2; mesh.rotation.z=seed*TAU;
    mesh.position.set(p.x,0.006+(S.floorY||0),p.z);
    var grp=new THREE.Group(); grp.add(mesh); grp.userData.dreadNote=text;
    GLR.scene.add(grp); DREADFX.note=grp;
  }
};
function dreadLampMul(i,tt){ return DreadFx.lampMul(i,tt); }
