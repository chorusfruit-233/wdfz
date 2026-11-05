/* @module-capsule */
(function($imports){
/* 电梯门动画；配方见 content/lift-recipe.js。 */
'use strict';
function liftLandingLeaves(c,cx,cz,rot){
  var s=$imports.EV_SPEC,R=c.R;
  var leafW=(s.doorW-s.doorGap)/2;
  [-1,1].forEach(function(sg){
    /* 按关着时的真实位置建模（穿模审查看到的就是它真正在的地方），开门只整体平移 */
    var LK=new $imports.Kit(); LK.frame(cx,cz,rot);
    var old=LK.sub(sg*(leafW/2+s.doorGap/2),$imports.LIFT_DOOR_Z,0,0);
    (0,$imports.liftLeaf)(LK,leafW,1,sg); LK.restore(old);
    var g=LK.build(), o=(0,$imports.liftToRoom)(0,0,rot,sg*(leafW+0.02),0);
    g.name='lift-leaf'; g.userData={liftLeaf:true,host:R.host,floor:R.floor,ox:o.x,oz:o.z};
    c.meshes.push(g);
  });
}
/* 楼层门后那节轿厢的两扇轿门：和层门一起开关；装饰面朝轿厢里面，滑开时藏进轿厢前壁 */
function liftCabinLeaves(c,cx,cz,rot,doorZ){
  var s=$imports.EV_SPEC,R=c.R;
  var leafW=(s.doorW-s.doorGap)/2;
  [-1,1].forEach(function(sg){
    var LK=new $imports.Kit(); LK.frame(cx,cz,rot);
    var old=LK.sub(sg*(leafW/2+s.doorGap/2),doorZ,0,0);
    (0,$imports.liftLeaf)(LK,leafW,-1,sg); LK.restore(old);
    var g=LK.build(), o=(0,$imports.liftToRoom)(0,0,rot,sg*(leafW+0.02),0);
    g.name='lift-car-leaf'; g.userData={liftLeaf:true,host:R.host,floor:R.floor,ox:o.x,oz:o.z};
    c.meshes.push(g);
  });
}
/* 轿厢操纵盘旁边的小告示（每台电梯、每节轿厢都贴着）：
   「超载时，请最后进入的乘客离开。」（内部：这是电梯里那个稀有事件平时就在的线索，见计划第 6 节；Wiki 不写它的用意）
   lx/lz 是轿厢局部坐标（liftToRoom 那一套），贴在 +x 侧壁上、字朝 −x（轿厢里面） */
var LIFT_NOTICE_TEX=null;
function liftNoticeTex(){
  if(LIFT_NOTICE_TEX) return LIFT_NOTICE_TEX;
  var cv=document.createElement('canvas'); cv.width=384; cv.height=224;
  var g=cv.getContext('2d'), w=cv.width, h=cv.height, font=(typeof $imports.SIGN_FONT!=='undefined'?$imports.SIGN_FONT:'sans-serif');
  g.fillStyle='#ecebe4'; g.fillRect(0,0,w,h);
  g.strokeStyle='#b8322a'; g.lineWidth=6; g.strokeRect(9,9,w-18,h-18);
  g.fillStyle='#b8322a'; g.fillRect(9,9,w-18,52);
  g.fillStyle='#f6f1e6'; g.textAlign='center'; g.textBaseline='middle'; g.font='700 32px '+font; g.fillText('乘 梯 须 知',w/2,36);
  g.fillStyle='#2a2522'; g.font='600 28px '+font;
  g.fillText('超载时，请最后进入的',w/2,104,w-40); g.fillText('乘客离开。',w/2,142,w-40);
  g.fillStyle='#6d655c'; g.font='500 19px '+font; g.fillText('额定载重 1000 kg · 13 人',w/2,186,w-40);
  for(var i=0;i<140;i++){ g.globalAlpha=0.05; g.fillStyle=i%2?'#000':'#fff'; g.fillRect((i*73)%w,(i*151)%h,3,3); }
  g.globalAlpha=1;
  LIFT_NOTICE_TEX=new $imports.THREE.CanvasTexture(cv); LIFT_NOTICE_TEX.colorSpace=$imports.THREE.SRGBColorSpace; LIFT_NOTICE_TEX.anisotropy=4;
  return LIFT_NOTICE_TEX;
}
function liftNotice(c,cx,cz,rot,lx,y,lz){
  var m=new $imports.THREE.Mesh(new $imports.THREE.PlaneGeometry(0.17,0.099),new $imports.THREE.MeshPhongMaterial({map:liftNoticeTex(),shininess:0,specular:0x000000}));
  var p=(0,$imports.liftToRoom)(cx,cz,rot,lx,lz);
  m.position.set(p.x,y,p.z); m.rotation.y=rot-Math.PI/2;
  m.name='lift-notice'; m.userData={liftNotice:true,text:'超载时，请最后进入的乘客离开。'};
  c.meshes.push(m);
}
var LiftDoors={mesh:null,list:[],k:0,
  tick:function(dt){
    var g=typeof $imports.GLR!=='undefined'?$imports.GLR.roomMesh:null;
    if(!g||$imports.S.mode!=='in'){ LiftDoors.mesh=null; LiftDoors.list=[]; return; }
    if(LiftDoors.mesh!==g){
      LiftDoors.mesh=g; LiftDoors.list=[];
      g.traverse(function(o){ if(o.userData&&o.userData.liftLeaf) LiftDoors.list.push(o); });
      LiftDoors.k=LiftDoors.target();                              /* 进房间时直接摆到位，不从关着开始滑 */
    }
    if(!LiftDoors.list.length) return;
    /* 开度由电梯的模拟状态给（开门 0.9 秒、关门 1 秒、门槛上有人不关），这里只负责摆 */
    LiftDoors.k=LiftDoors.target();
    var e=LiftDoors.k*LiftDoors.k*(3-2*LiftDoors.k);
    LiftDoors.list.forEach(function(o){
      var u=o.userData; o.position.x=u.ox*e; o.position.z=u.oz*e;
    });
  },
  target:function(){
    var R=$imports.INTERIORS[$imports.S.room];
    if(!R||typeof $imports.Elevator==='undefined'||!$imports.Elevator.doorAmount) return 0;
    return $imports.Elevator.doorAmount(R.host,R.floor);
  }
};

/* @module-exports */
GameModules.publish("game3d/js/model/lift.js",{
"liftLandingLeaves":{get:function(){return liftLandingLeaves;},set:function($value){liftLandingLeaves=$value;}},
"liftCabinLeaves":{get:function(){return liftCabinLeaves;},set:function($value){liftCabinLeaves=$value;}},
"LIFT_NOTICE_TEX":{get:function(){return LIFT_NOTICE_TEX;},set:function($value){LIFT_NOTICE_TEX=$value;}},
"liftNoticeTex":{get:function(){return liftNoticeTex;},set:function($value){liftNoticeTex=$value;}},
"liftNotice":{get:function(){return liftNotice;},set:function($value){liftNotice=$value;}},
"LiftDoors":{get:function(){return LiftDoors;},set:function($value){LiftDoors=$value;}}
});
})(GameModules.imports("game3d/js/model/lift.js"));
