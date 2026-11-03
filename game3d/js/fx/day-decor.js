/* @module-capsule */
(function($imports){
/* 校庆横幅：教学楼正面二楼，红底黄字。只在校庆当天、人在室外时挂着（单独一组，不进室外合并网格，也不参与碰撞）。 */
var DayDecor={grp:null,
  sync:function(){
    var want=$imports.S.mode==='out'&&$imports.DayEvents.is('anniversary')&&typeof $imports.GLR!=='undefined'&&!!$imports.GLR.scene;
    if(want&&!DayDecor.grp) DayDecor.build();
    else if(!want&&DayDecor.grp) DayDecor.clear();
  },
  texture:function(){
    var cv=document.createElement('canvas'); cv.width=1024; cv.height=96;
    var g=cv.getContext('2d');
    g.fillStyle='#b3121b'; g.fillRect(0,0,1024,96);
    g.fillStyle='#8a0d14'; g.fillRect(0,0,1024,6); g.fillRect(0,90,1024,6);
    g.fillStyle='#f6d36b'; g.font='bold 58px "Noto Serif CJK SC","Source Han Serif SC",serif';
    g.textAlign='center'; g.textBaseline='middle';
    g.fillText('热烈庆祝武大附中建校纪念日',512,50);
    var t=new $imports.THREE.CanvasTexture(cv); t.anisotropy=4;
    return t;
  },
  build:function(){
    var o=(0,$imports.objById)('teach'); if(!o) return;
    var cx=(o.x+o.w/2)*$imports.SC*$imports.U2M, fz=(0,$imports.teachFrontZ)();
    var grp=new $imports.THREE.Group(), mat=new $imports.THREE.MeshLambertMaterial({map:DayDecor.texture(),side:$imports.THREE.DoubleSide});
    /* 二、三楼之间：上下两道楼板边各挑出约 0.75 米，横幅挂在它们外沿，仰头看不会被楼板边挡住 */
    var banner=new $imports.THREE.Mesh(new $imports.THREE.PlaneGeometry(13,1.1),mat);
    banner.position.set(cx,5.55,fz+0.82); grp.add(banner);
    var rope=new $imports.THREE.MeshLambertMaterial({color:0x6a5a48});
    [-6.6,6.6].forEach(function(dx){ var r=new $imports.THREE.Mesh(new $imports.THREE.BoxGeometry(0.04,2.6,0.04),rope); r.position.set(cx+dx,5.55,fz+0.8); grp.add(r); });
    grp.name='day-decor'; $imports.GLR.scene.add(grp); DayDecor.grp=grp;
  },
  clear:function(){
    var grp=DayDecor.grp; DayDecor.grp=null; if(!grp) return;
    try{ $imports.GLR.scene.remove(grp); }catch(e){}
    grp.traverse(function(o){
      if(o.geometry) o.geometry.dispose();
      if(o.material){ if(o.material.map) o.material.map.dispose(); o.material.dispose(); }
    });
  }
};

GameModules.on('frame',function(){DayDecor.sync();},{owner:'progression'});
GameModules.on('dayAppearance',function(){DayDecor.sync();},{owner:'progression'});

/* @module-exports */
GameModules.publish("game3d/js/fx/day-decor.js",{
"DayDecor":{get:function(){return DayDecor;},set:function($value){DayDecor=$value;}}
});
})(GameModules.imports("game3d/js/fx/day-decor.js"));
