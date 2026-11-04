/* @module-capsule */
(function($imports){
/* 里世界 3D · 全局氛围的画面（只读 atmos.js 和玩法状态，不改判定）
   · A2：每层走廊固定挑一部分楼层做「灯管坏掉的暗区」：走廊那盏灯只剩 35%（lighting.js 乘 atmosLampMul），
     楼梯口上方挂应急指示牌，绿光（自发光，不加实时光源）。按房间 ID 定，读档一致；路线、字幕和交互仍看得清。
   · A3：同学一起转头（0.6 秒转过来、停 1.5 秒、0.6 秒转回去），只在违规低于 35、没有「全体回头」异象时；
     空座位多一个：那间教室里按记录藏起一位同学（只是不画，占座和检查的判定不变）。
   · A4：教室北窗（磨砂玻璃）上映着窗外远处一个一动不动的人影（贴在玻璃上的一小块剪影）；看着它超过 0.8 秒，下一次移开视线它就不在了。
   · A6：走廊里一把拖把和一只水桶（没有碰撞的小物件，不挡门、不进楼梯口和电梯口）；当天这一层抽中时，
     在你离开 8 米以外、背对着的时候挪位置：被巡察者碰歪的顺着走廊推开并歪倒，没来由的整个转过来对着你。 */
'use strict';

var ATMOS_DARK={};                      /* 房间 ID → 要压暗的灯序号表 */
function atmosLampMul(i){ var d=$imports.S.mode==='in'?ATMOS_DARK[$imports.S.room]:null; return d&&d[i]?0.35:1; }

var AtmosFx=(function(){
  var F={grp:null,room:null,props:null,fig:null,stareFigs:null,signs:[]}, own={owner:'atmosphere'};
  function hash(s){ return $imports.Atmos.hash(s); }
  function scene(R,wx,wy){ return (0,$imports.worldToScene)(wx,wy,R); }
  function toWorld(R,x,z){ var half=R.cols*R.tw*$imports.U2M*0.5, hz=R.rows*R.th*$imports.U2M*0.5; return {x:R.ox+(x+half)/$imports.U2M, y:R.oy+(z+hz)/$imports.U2M}; }
  function lastDoorRow(R){ var d=-1; for(var y=0;y<R.rows;y++) if(R.grid[y].indexOf('=')>=0) d=y; return d; }
  function darkFloor(R){ return hash('dark:'+R.id)<0.5; }
  function clear(){
    if(F.grp){ if(F.grp.parent) F.grp.parent.remove(F.grp); try{ $imports.ThreeBackend.disposeGroup(F.grp); }catch(e){} }
    F.grp=null; F.room=null; F.props=null; F.fig=null; F.signs=[];
  }
  function mat(col,emit){ return emit?new $imports.THREE.MeshBasicMaterial({color:col,fog:true}):new $imports.THREE.MeshLambertMaterial({color:col}); }
  /* 应急指示牌：绿底白色小人和箭头（画在画布上） */
  var EXIT_TEX=null;
  function exitTex(){
    if(EXIT_TEX) return EXIT_TEX;
    var cv=document.createElement('canvas'); cv.width=128; cv.height=48; var g=cv.getContext('2d');
    g.fillStyle='#1fd16a'; g.fillRect(0,0,128,48); g.fillStyle='#eafff1';
    g.beginPath(); g.arc(30,12,5,0,6.283); g.fill();
    g.fillRect(26,18,7,14); g.save(); g.translate(30,30); g.rotate(0.5); g.fillRect(-2,0,5,14); g.restore(); g.save(); g.translate(30,30); g.rotate(-0.6); g.fillRect(-2,0,5,14); g.restore();
    g.beginPath(); g.moveTo(70,24); g.lineTo(96,10); g.lineTo(96,18); g.lineTo(116,18); g.lineTo(116,30); g.lineTo(96,30); g.lineTo(96,38); g.closePath(); g.fill();
    EXIT_TEX=new $imports.THREE.CanvasTexture(cv); EXIT_TEX.colorSpace=$imports.THREE.SRGBColorSpace; return EXIT_TEX;
  }
  function build(R){
    clear(); if(!R||!$imports.GLR.scene) return;
    F.room=R.id; F.grp=new $imports.THREE.Group(); F.grp.name='atmosphere'; $imports.GLR.scene.add(F.grp);
    var door=lastDoorRow(R), x, y;
    /* A2：暗区的楼层，楼梯口上方挂应急指示牌 */
    if(darkFloor(R)){
      for(y=door+1;y<R.rows;y++) for(x=0;x<R.cols;x++){
        if(R.grid[y][x]!=='S'||(R.grid[y][x-1]==='S')) continue;
        var p=scene(R,R.ox+(x+1)*R.tw,R.oy+y*R.th);
        var sg=new $imports.THREE.Mesh(new $imports.THREE.PlaneGeometry(0.36,0.135),new $imports.THREE.MeshBasicMaterial({map:exitTex(),toneMapped:false,fog:false}));
        sg.position.set(p.x,2.55,p.z-0.06); F.grp.add(sg); F.signs.push(sg);
        var glow=new $imports.THREE.Mesh(new $imports.THREE.PlaneGeometry(1.1,0.6),new $imports.THREE.MeshBasicMaterial({color:0x1fd16a,transparent:true,opacity:0.12,depthWrite:false,blending:$imports.THREE.AdditiveBlending,fog:false}));
        glow.position.set(p.x,2.5,p.z-0.05); F.grp.add(glow);
      }
    }
    /* A6：拖把和水桶，靠在走廊靠西那段的墙边（第一个空着的走廊格） */
    var spot=null;
    for(x=4;x<R.cols-4&&!spot;x++){
      y=door+1; if(R.grid[y]&&R.grid[y][x]==='.'&&R.grid[y][x+1]==='.'&&R.grid[y-1][x]==='#'&&R.grid[y-1][x+1]==='#'&&x>R.cols*0.3) spot={c:x,r:y};
    }
    if(spot){
      var w=R.ox+(spot.c+0.5)*R.tw, h=R.oy+(spot.r+0.18)*R.th, sp=scene(R,w,h);
      var g=new $imports.THREE.Group(); g.position.set(sp.x,0,sp.z); g.userData={home:{x:sp.x,z:sp.z}};
      var stick=new $imports.THREE.Mesh(new $imports.THREE.CylinderGeometry(0.012,0.012,1.3,6),mat(0x9a7a55)); stick.position.set(0,0.72,0); stick.rotation.z=0.18;
      var head=new $imports.THREE.Mesh(new $imports.THREE.CylinderGeometry(0.12,0.16,0.18,8),mat(0x8d8a80)); head.position.set(-0.11,0.09,0);
      var bucket=new $imports.THREE.Mesh(new $imports.THREE.CylinderGeometry(0.16,0.13,0.28,10),mat(0x3d6c9a)); bucket.position.set(0.32,0.14,0.02);
      g.add(stick); g.add(head); g.add(bucket); F.grp.add(g); F.props=g;
    }
    applyShift(R);
  }
  /* 当天这一层抽中的错位，读档后按记录摆 */
  function applyShift(R){
    var g=F.props; if(!g) return;
    var k=$imports.Atmos.peek().shift[$imports.S.day+':'+R.id], h=g.userData.home;
    g.rotation.set(0,0,0); g.position.set(h.x,0,h.z);
    if(k==='push'){ var dir=hash('push:'+$imports.S.day+':'+R.id)<0.5?-1:1; g.position.x=h.x+dir*0.9; g.position.z=h.z+0.55; g.rotation.y=dir*0.7; g.children[0].rotation.z=1.2; }
    else if(k==='face'){ g.position.z=h.z+1.4; g.userData.face=true; }
    g.userData.k=k||null;
  }
  function inView(px,pz,cone){
    var cam=$imports.GLR.cam; if(!cam) return false;
    var d=new $imports.THREE.Vector3(); cam.getWorldDirection(d);
    var vx=px-cam.position.x, vz=pz-cam.position.z, l=Math.hypot(vx,vz)||1;
    return (vx*d.x+vz*d.z)/l>Math.cos(cone||0.75);
  }
  /* 能不能挪：人离开 8 米外，而且没看着 */
  function canShift(minM){
    var g=F.props; if(!g||!$imports.GLR.cam) return false;
    var p=g.position, cam=$imports.GLR.cam.position;
    return Math.hypot(p.x-cam.x,p.z-cam.z)>minM&&!inView(p.x,p.z,0.9);
  }
  function seesShifted(){
    var g=F.props; if(!g||!g.userData.k||!$imports.GLR.cam) return false;
    return Math.hypot(g.position.x-$imports.GLR.cam.position.x,g.position.z-$imports.GLR.cam.position.z)<9&&inView(g.position.x,g.position.z,0.35);
  }
  /* A3：一起转头 */
  function stareFrame(dt){
    var st=$imports.Atmos.A.stare; if(!st||typeof $imports.NC==='undefined'||!$imports.NC.list||!$imports.NC.list.length){ return; }
    var R=$imports.INTERIORS[$imports.S.room]; if(!R){ $imports.Atmos.A.stare=null; return; }
    if(!st.figs){
      st.figs=$imports.NC.list.filter(function(f){ var u=f.userData||{}; if(u.teacher) return false; var w=toWorld(R,u.hx,u.hz); return $imports.Atmos.classAt(R,Math.floor((w.x-R.ox)/R.tw),Math.floor((w.y-R.oy)/R.th))===st.cls; });
      st.figs.forEach(function(f){ f.userData.stareBase=f.rotation.y||0; });
    }
    st.t+=dt;
    var T=$imports.ATMOS_CFG.stareTurn, H=$imports.ATMOS_CFG.stareHold, k=st.t<T?st.t/T:st.t<T+H?1:Math.max(0,1-(st.t-T-H)/T), e=k*k*(3-2*k);
    var p=(0,$imports.anfxW2S)($imports.S.x,$imports.S.y);
    st.figs.forEach(function(f){
      var base=f.userData.stareBase, want=Math.atan2(f.position.x-p.x,f.position.z-p.z);
      var d=((want-base+Math.PI*3)%(Math.PI*2))-Math.PI;
      f.rotation.y=base+d*e*0.85;                                            /* 上半身跟着转，转不到正后方 */
    });
    if(st.t>=2*T+H){ st.figs.forEach(function(f){ f.rotation.y=f.userData.stareBase; }); $imports.Atmos.A.stare=null; }
  }
  /* A3：空座位多了一个 */
  function seatFrame(){
    if(typeof $imports.NC==='undefined'||!$imports.NC.list||!$imports.NC.list.length||$imports.NC.room!==$imports.S.room) return;
    var R=$imports.INTERIORS[$imports.S.room], seats=$imports.Atmos.peek().seats, by={};
    $imports.NC.list.forEach(function(f){ var u=f.userData||{}; if(u.teacher||u.stood) return;
      var w=toWorld(R,u.hx,u.hz), cls=$imports.Atmos.classAt(R,Math.floor((w.x-R.ox)/R.tw),Math.floor((w.y-R.oy)/R.th)); if(!cls) return;
      (by[cls]=by[cls]||[]).push(f); });
    Object.keys(by).forEach(function(cls){
      var n=seats[$imports.S.day+':'+cls], list=by[cls];
      list.forEach(function(f,i){ f.visible=!(n&&i===(n%list.length)); });
    });
  }
  /* A4：窗外的人 */
  function windowFrame(dt){
    var w=$imports.Atmos.A.window, R=$imports.S.mode==='in'?$imports.INTERIORS[$imports.S.room]:null;
    if(!w||!R||w.room!==R.id||w.gone){ if(F.fig){ F.fig.visible=false; } return; }
    if(!F.fig){
      var g=new $imports.THREE.Group(), m=(0,$imports.figMesh)('person',new $imports.THREE.MeshBasicMaterial({color:0x101315,fog:false,transparent:true,opacity:0.82,depthWrite:false}),1); m.scale.z=0.05; g.add(m); g.scale.setScalar(0.12);
      F.fig=g; F.grp&&F.grp.add(g);
    }
    if(!w.pos){
      /* 教室北墙的窗是磨砂的：人影画成贴在玻璃上的一小块剪影（30 米外一个人看上去就这么大），在这间教室的窗下沿附近 */
      var r0=R.rows, c0=R.cols, c1=0, x, y;
      for(y=1;y<R.rows;y++) for(x=1;x<R.cols;x++) if(R.grid[y][x]!=='#'&&$imports.Atmos.classAt(R,x,y)===w.cls){ r0=Math.min(r0,y); c0=Math.min(c0,x); c1=Math.max(c1,x); }
      var cx=R.ox+(c0+(c1-c0+1)*(0.25+0.5*w.seed))*R.tw, face=(0,$imports.worldToScene)(cx,R.oy+r0*R.th,R);
      w.pos={x:face.x,y:1.18,z:face.z+0.035};
    }
    var f=F.fig; f.visible=true; f.position.set(w.pos.x,w.pos.y,w.pos.z);
    f.rotation.y=0;                                                        /* 正对着教室（面朝 +z） */
    var looking=inView(w.pos.x,w.pos.z,0.22);
    if(looking) w.seen+=dt; else if(w.seen>=0.8){ w.gone=true; f.visible=false; }
  }
  function frame(dt){
    var R=$imports.Atmos.floorRoom();
    if(!R||$imports.S.dead){ if(F.grp) clear(); return; }
    if(F.room!==R.id||!F.grp||!F.grp.parent) build(R);
    if(F.props&&F.props.userData.k!==($imports.Atmos.peek().shift[$imports.S.day+':'+R.id]||null)) applyShift(R);
    if(F.props&&F.props.userData.face&&$imports.GLR.cam){ var g=F.props; g.rotation.y=Math.atan2($imports.GLR.cam.position.x-g.position.x,$imports.GLR.cam.position.z-g.position.z); g.userData.face=false; }
    stareFrame(dt||0); seatFrame(); windowFrame(dt||0);
    var R2=$imports.INTERIORS[$imports.S.room]; if(R2&&!ATMOS_DARK[R2.id]&&darkFloor(R2)&&$imports.GLR.roomLights&&$imports.GLR.roomLights.length) markDark(R2);
  }
  /* 走廊里那几盏（门那一排以南的灯）记下序号，lighting.js 乘 0.35 */
  function markDark(R){
    var door=lastDoorRow(R), H=R.rows*R.th*$imports.U2M*0.5, set={};
    $imports.GLR.roomLights.forEach(function(L,i){ var r=Math.floor((L.position.z+H)/(R.th*$imports.U2M)); if(r>door&&r<R.rows-1) set[i]=1; });
    ATMOS_DARK[R.id]=set;
  }
  GameModules.on('frame',frame,own);
  GameModules.on('clearWorld',function(){ clear(); Object.keys(ATMOS_DARK).forEach(function(k){ delete ATMOS_DARK[k]; }); },own);
  GameModules.on('boundary',clear,own);
  return {F:F, canShift:canShift, seesShifted:seesShifted, darkFloor:darkFloor, clear:clear};
})();

/* @module-exports */
GameModules.publish("game3d/js/modules/atmosphere/atmos-fx.js",{
"ATMOS_DARK":{get:function(){return ATMOS_DARK;},set:function($value){ATMOS_DARK=$value;}},
"atmosLampMul":{get:function(){return atmosLampMul;},set:function($value){atmosLampMul=$value;}},
"AtmosFx":{get:function(){return AtmosFx;},set:function($value){AtmosFx=$value;}}
});
})(GameModules.imports("game3d/js/modules/atmosphere/atmos-fx.js"));
