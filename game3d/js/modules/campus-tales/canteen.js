/* @module-capsule */
(function($imports){
/* 里世界 3D · 午夜食堂（《校园怪谈创意提案》C10，已确认：梦魇也开放、不计入恢复活动）
   熄灯（22:20）以后，食堂中间的打饭台上方亮着一盏灯，打饭的人站在台子后面——你绕到哪边，它都背对着你。
   · 走近打饭台：先提示「闻起来很香。香得不对。」，吃或不吃由你选。
   · 吃一碗：游戏时间 10 分钟，SAN 回 MEAL.san（比任何恢复活动都多），同化立刻涨 MEAL.tt（最多到 MEAL.ttCap，不会因为这一碗直接融入），
     而且到天亮（07:20）之前同化不会自己回落——回宿舍躺下还会继续涨。吃完马上用一句话说明代价（和同化提醒同一套口吻）。
   · 每晚只有一碗：同一晚再来，「明天再来。」
   · 不发 rest 事实，不进恢复活动（成就「八种喘息」照旧是八种）；发 gameFact('midnightMeal')。
   · 熄灯后不在宿舍照样记违规、巡察者照样巡夜：这些代价不因为食堂开着而免掉。
   表现只读 S／RT：灯、碗和人影都在 frame 里按状态摆。 */
'use strict';

var MidnightCanteen=(function(){
  var own={owner:'campus-tales'}, MEAL={san:40,tt:25,ttCap:95,min:10,room:'canteen1'};
  var F={grp:null,fig:null,bowl:null,room:null};
  function R(){ return $imports.INTERIORS[MEAL.room]; }
  function open(){ return $imports.S.tsec>=$imports.LIGHTS_OUT; }                    /* 22:20 到 01:00；01:00 直接跳到 07:20 */
  /* 同一晚：22:20–22:30 还是前一天的日数，22:30 换日以后日数 +1；用连续游戏分钟错开 1000 分钟取整，一整晚落在同一个数上 */
  function night(){ return Math.floor(((0,$imports.gameClock)()-1000)/1440); }
  function morning(){ return (night()+1)*1440+440; }                                  /* 下一个 07:20 的连续分钟 */
  function ate(){ var m=$imports.RT.midnightMeal; return !!m&&m.night===night(); }
  function full(){ var m=$imports.RT.midnightMeal; return !!m&&(0,$imports.gameClock)()<m.until; }
  /* 打饭台：网格里的 k 格（一个 3×2 的岛台） */
  var CELLS=null;
  function cells(){
    var r=R(); if(!r) return [];
    if(CELLS&&CELLS.grid===r.grid) return CELLS.list;
    var list=[]; for(var y=0;y<r.rows;y++) for(var x=0;x<r.cols;x++) if(r.grid[y][x]==='k') list.push({c:x,r:y,wx:r.ox+(x+0.5)*r.tw,wy:r.oy+(y+0.5)*r.th});
    CELLS={grid:r.grid,list:list}; return list;
  }
  function center(){
    var l=cells(), x=0, y=0; if(!l.length) return null;
    l.forEach(function(k){ x+=k.wx; y+=k.wy; }); x/=l.length; y/=l.length;
    var minx=Math.min.apply(null,l.map(function(k){ return k.wx; })), maxy=Math.max.apply(null,l.map(function(k){ return k.wy; }));
    return {x:x,y:y,head:minx-R().tw*0.95,near:maxy};                                /* head：打饭台西头（排队的起点），打饭的人站在那儿；near：靠门那一排台面 */
  }
  function near(){
    if($imports.S.mode!=='in'||$imports.S.room!==MEAL.room||!open()) return false;
    var r=R(); return cells().some(function(k){ return Math.hypot($imports.S.x-k.wx,$imports.S.y-k.wy)<3.2*r.tw; });   /* 不比普通交互的够手距离短：夜里碰打饭台，一律是这个窗口（不会弹出饭点外投币） */
  }
  function eat(){
    $imports.UI.closeChoice();
    (0,$imports.advanceGameTime)(MEAL.min);
    $imports.PlayerStats.changeSan(MEAL.san,'midnight-canteen',{max:100});
    $imports.PlayerStats.changeAssimilation(MEAL.tt,'midnight-canteen',{max:Math.max(MEAL.ttCap,$imports.S.tt)});
    $imports.RT.midnightMeal={night:night(),until:morning(),n:(($imports.RT.midnightMeal||{}).n||0)+1};
    (0,$imports.restoreStamina)(30);
    (0,$imports.os)('我：吃完了。很好吃，是我在这里吃过最好吃的一顿。\n……我想不起来刚才为什么那么怕了。我想早点回宿舍，躺在自己的铺上。明天早上不用闹钟。',6);
    try{ (0,$imports.toast)('吃了一碗 · 到天亮前同化不会回落'); }catch(e){}
    (0,$imports.gameFact)('midnightMeal',{n:$imports.RT.midnightMeal.n});
    try{ $imports.SFX.click(); }catch(e){}
    try{ (0,$imports.autoSave)(); }catch(e){}
  }
  GameModules.on('hint',function(){ if(!near()) return undefined; return ate()?'窗口（「明天再来」）':'亮着的窗口'; },own);
  GameModules.on('interact',function(){
    if(!near()) return undefined;
    if(ate()){ (0,$imports.os)('我：窗口里的人没有回头。「明天再来。」',3.4); return true; }
    $imports.UI.choice('熄了灯的食堂，只有这一个窗口亮着。打饭的人背对着我，台子上放着一碗热的。\n闻起来很香。香得不对。',[
      {label:'吃一碗（游戏时间 '+MEAL.min+' 分钟）',fn:eat},
      {label:'不吃',fn:function(){ $imports.UI.closeChoice(); (0,$imports.os)('我：我往后退了一步。它还是没有回头。',3); }}
    ]);
    return true;
  },own);

  /* ---------- 表现：窗口的灯、一碗饭、背对你的人 ---------- */
  function clear(){ if(F.grp){ if(F.grp.parent) F.grp.parent.remove(F.grp); try{ $imports.ThreeBackend.disposeGroup(F.grp); }catch(e){} } F.grp=null; F.fig=null; F.bowl=null; F.room=null; }
  function build(){
    var r=R(), c=center(); if(!r||!c) return;
    var T=$imports.THREE, g=new T.Group(); g.name='midnight-canteen';
    var p=(0,$imports.worldToScene)(c.head+r.tw*0.9,c.y,r), back=(0,$imports.worldToScene)(c.head,c.y,r), dish=(0,$imports.worldToScene)(c.head+r.tw*0.75,c.near,r);
    var shade=new T.Mesh(new T.CylinderGeometry(0.12,0.42,0.28,16,1,true),new T.MeshBasicMaterial({color:0x2b2620,side:T.DoubleSide,fog:true}));
    shade.position.set(p.x,2.55,p.z);
    var bulb=new T.Mesh(new T.SphereGeometry(0.1,12,8),new T.MeshBasicMaterial({color:0xffe2a8,fog:false}));
    bulb.position.set(p.x,2.42,p.z);
    var pool=new T.Mesh(new T.CircleGeometry(2.2,32),new T.MeshBasicMaterial({color:0xffc070,transparent:true,opacity:0.16,depthWrite:false,blending:T.AdditiveBlending,fog:false}));
    pool.rotation.x=-Math.PI/2; pool.position.set(p.x,0.02,p.z);
    var cone=new T.Mesh(new T.CylinderGeometry(0.4,1.6,2.35,24,1,true),new T.MeshBasicMaterial({color:0xffd290,transparent:true,opacity:0.03,depthWrite:false,blending:T.AdditiveBlending,side:T.FrontSide,fog:false}));
    cone.position.set(p.x,1.24,p.z);
    var bowl=new T.Group(), bm=new T.MeshLambertMaterial({color:0xe9e3d6,emissive:0x4a3a26});
    var cup=new T.Mesh(new T.CylinderGeometry(0.11,0.07,0.08,16),bm); bowl.add(cup);
    var rice=new T.Mesh(new T.SphereGeometry(0.1,12,6,0,Math.PI*2,0,Math.PI/2),new T.MeshLambertMaterial({color:0xf4efe2,emissive:0x5a4a30})); rice.position.y=0.03; rice.scale.y=0.5; bowl.add(rice);
    bowl.position.set(dish.x,0.98,dish.z);
    var fig=(0,$imports.figMesh)('person',new T.MeshLambertMaterial({color:0x2a2a2c,emissive:0x0d0b08}),1);
    fig.position.set(back.x,0,back.z);
    var lamp=new T.PointLight(0xffc27a,14,7.5,1.6); lamp.position.set(p.x,2.3,p.z);   /* 整个食堂只有这一盏亮着 */
    g.add(shade); g.add(bulb); g.add(pool); g.add(cone); g.add(bowl); g.add(fig); g.add(lamp);
    $imports.GLR.scene.add(g); F.grp=g; F.fig=fig; F.bowl=bowl; F.room=MEAL.room;
  }
  function frame(){
    var on=$imports.S.mode==='in'&&$imports.S.room===MEAL.room&&open()&&!!$imports.GLR.scene&&!!$imports.GLR.roomMesh&&$imports.S.screen!=='menu';
    if(!on){ if(F.grp) clear(); return; }
    if(!F.grp||!F.grp.parent) build();
    if(!F.grp) return;
    var r=R(), fp=F.fig.position, me=(0,$imports.worldToScene)($imports.S.x,$imports.S.y,r);
    F.fig.rotation.y=Math.atan2(fp.x-me.x,fp.z-me.z);                                /* 背对你：脸朝和你相反的方向 */
    F.bowl.visible=!ate();
  }
  GameModules.on('frame',frame,own);
  GameModules.on('clearWorld',clear,own);
  GameModules.on('boundary',clear,own);
  return {MEAL:MEAL, F:F, near:near, open:open, ate:ate, full:full, night:night};
})();

/* @module-exports */
GameModules.publish("game3d/js/modules/campus-tales/canteen.js",{
"MidnightCanteen":{get:function(){return MidnightCanteen;},set:function($value){MidnightCanteen=$value;}}
});
})(GameModules.imports("game3d/js/modules/campus-tales/canteen.js"));
