/* @module-capsule */
(function($imports){
/* 驾驶道路、仪表盘、镜头与提示音；不拥有车辆进度。 */
'use strict';
var CAR_VIS={group:null,dash:null,world:null,worldVisible:true,base:null,props:[],marks:[],signs:[],oldNorm:0};
var CarChaseView={
clearVisual:function(){
    if(CAR_VIS.group){$imports.GLR.scene.remove(CAR_VIS.group);$imports.ThreeBackend.disposeGroup(CAR_VIS.group);}
    if(CAR_VIS.dash){$imports.GLR.cam.remove(CAR_VIS.dash);$imports.ThreeBackend.disposeGroup(CAR_VIS.dash);}
    if(CAR_VIS.world)CAR_VIS.world.visible=CAR_VIS.worldVisible;
    if(CAR_VIS.group)$imports.GLR.worldNorm=CAR_VIS.oldNorm;
    CAR_VIS.group=null;CAR_VIS.dash=null;CAR_VIS.world=null;CAR_VIS.props=[];CAR_VIS.marks=[];CAR_VIS.signs=[];CAR_VIS.shades=[];CAR_VIS.step=0;
    document.body.classList.remove('driving');
    var hud=document.getElementById('drivehud');if(hud)hud.hidden=true;
  },
build:function(){
    if(!$imports.CarChase.active()||!$imports.GLR.scene||!$imports.GLR.cam)return;
    if(CAR_VIS.group&&CAR_VIS.world===$imports.GLR.outMesh)return;
    var originalNorm=CAR_VIS.group?CAR_VIS.oldNorm:($imports.GLR.worldNorm||0);
    CarChaseView.clearVisual();
    var p=(0,$imports.worldToScene)($imports.S.x,$imports.S.y,null),g=new $imports.THREE.Group();g.position.set(p.x,0,p.z);
    CAR_VIS.base=p;CAR_VIS.world=$imports.GLR.outMesh;CAR_VIS.worldVisible=$imports.GLR.outMesh?$imports.GLR.outMesh.visible:true;
    CAR_VIS.oldNorm=originalNorm;if($imports.GLR.outMesh)$imports.GLR.outMesh.visible=false;
    function box(w,h,d,color,x,y,z){
      var o=new $imports.THREE.Mesh(new $imports.THREE.BoxGeometry(w,h,d),new $imports.THREE.MeshBasicMaterial({color:color}));
      o.position.set(x,y,z);g.add(o);return o;
    }
    box(10,0.08,100,0x343b3b,0,-0.04,-49);
    box(.12,.03,100,0x9b9d85,-4.8,0.02,-49);box(.12,.03,100,0x9b9d85,4.8,0.02,-49);
    for(var i=0;i<13;i++)CAR_VIS.marks.push(box(.12,.025,3.5,0xb7b39b,0,.025,-i*8));
    $imports.CAR_CHASE_CONFIG.forks.forEach(function(fork){
      var board=box(2.0,.72,.12,0x426b68,0,3.0,-100);
      var arrow=new $imports.THREE.Mesh(new $imports.THREE.BoxGeometry(.82,.09,.04),new $imports.THREE.MeshBasicMaterial({color:0xf0f0dd}));
      arrow.position.set(-fork[1]*.1,0,.08);board.add(arrow);
      var tip=new $imports.THREE.Mesh(new $imports.THREE.ConeGeometry(.19,.38,3),new $imports.THREE.MeshBasicMaterial({color:0xf0f0dd}));
      tip.rotation.z=-fork[1]*Math.PI/2;tip.position.set(fork[1]*.46,0,.08);board.add(tip);
      CAR_VIS.signs.push(board);
    });
    $imports.CAR_CHASE_CONFIG.obstacles.forEach(function(ob){
      var b=box(1.55,1.25,1.2,0x5b3b32,ob[1],0.63,-100);
      var stripe=new $imports.THREE.Mesh(new $imports.THREE.BoxGeometry(1.56,.14,.08),new $imports.THREE.MeshBasicMaterial({color:0xd49a52}));
      stripe.position.set(0,.1,.64);b.add(stripe);CAR_VIS.props.push(b);
    });
    for(i=0;i<12;i++){
      var side=i%2?1:-1,offset=Math.floor(i/2)*16;
      var post=box(.24,2.6,.24,0x414c47,side*7,1.3,-offset);
      post.userData.roadOffset=offset;CAR_VIS.props.push(post);
    }
    $imports.GLR.scene.add(g);CAR_VIS.group=g;
    var dash=new $imports.THREE.Group(),dashBody=new $imports.THREE.Mesh(new $imports.THREE.BoxGeometry(2.4,.42,.45),new $imports.THREE.MeshBasicMaterial({color:0x353e3f}));
    dashBody.position.set(0,-.58,-1.1);dash.add(dashBody);
    var wheel=new $imports.THREE.Mesh(new $imports.THREE.TorusGeometry(.19,.025,8,20),new $imports.THREE.MeshBasicMaterial({color:0x77817c}));
    wheel.position.set(0,-.49,-.88);dash.add(wheel);
    var mirror=new $imports.THREE.Mesh(new $imports.THREE.BoxGeometry(.9,.18,.04),new $imports.THREE.MeshBasicMaterial({color:0x515b59}));
    mirror.position.set(0,.47,-1.15);dash.add(mirror);
    /* 后视镜里的黑影：追得越近越多、越大（draw 里按追影值调） */
    CAR_VIS.shades=[];
    for(i=0;i<5;i++){
      var shade=new $imports.THREE.Mesh(new $imports.THREE.BoxGeometry(.06,.08,.02),new $imports.THREE.MeshBasicMaterial({color:0x080a0a}));
      shade.position.set((i-2)*.15,.46,-1.12);shade.visible=false;dash.add(shade);CAR_VIS.shades.push(shade);
    }
    $imports.GLR.cam.add(dash);CAR_VIS.dash=dash;
    document.body.classList.add('driving');
    var hud=document.getElementById('drivehud');if(hud)hud.hidden=false;
  },
draw:function(){
    if(!$imports.CarChase.active())return;
    CarChaseView.build();if(!CAR_VIS.group)return;
    var d=$imports.RT.carChase,p=CAR_VIS.base;
    $imports.GLR.cam.position.set(p.x+d.x,1.35,p.z);$imports.GLR.cam.lookAt(p.x+d.x,1.15,p.z-24);
    $imports.GLR.worldNorm=(0,$imports.clamp)((d.distance-245)/75,0,1);
    CAR_VIS.marks.forEach(function(mark,i){mark.position.z=-(i*8-(d.distance%8));});
    $imports.CAR_CHASE_CONFIG.forks.forEach(function(fork,i){
      var delta=fork[0]-d.distance,sign=CAR_VIS.signs[i];sign.position.z=-delta;sign.visible=delta>2&&delta<85;
    });
    $imports.CAR_CHASE_CONFIG.obstacles.forEach(function(o,i){
      var delta=o[0]-d.distance,mesh=CAR_VIS.props[i];mesh.position.z=-delta;mesh.visible=delta>-3&&delta<95;
    });
    for(var i=$imports.CAR_CHASE_CONFIG.obstacles.length;i<CAR_VIS.props.length;i++){
      var prop=CAR_VIS.props[i];prop.position.z=-((prop.userData.roadOffset-d.distance%96+96)%96);
    }
    var near=d.pursuit/$imports.CAR_CHASE_CONFIG.pursuitLimit;
    (CAR_VIS.shades||[]).forEach(function(shade,i){
      shade.visible=near>i*.18+.04;
      var k=.6+near*.6+Math.sin(($imports.GLR.time||0)*7+i*1.7)*.05;shade.scale.set(k,k*(1+near*.4),1);   /* 最大约 0.15 米高，不超出镜面 */
    });
    var hud=document.getElementById('drivehud');
    if(hud){
      /* 路口往哪边走只看路牌，界面上不直接写出来；追影只说远近 */
      var near=d.pursuit/$imports.CAR_CHASE_CONFIG.pursuitLimit, chase=near>.75?'黑影就在车后':near>.4?'后视镜里的黑影越来越近':near>.1?'后面有东西跟着':'后视镜里暂时是空的';
      var hint=$imports.CAR_CHASE_CONFIG.forks.some(function(f){var dd=f[0]-d.distance;return dd>0&&dd<85;})?'前方路口，看清路牌':'避开路障，沿路前进';
      var brake=!!($imports.KEY.s||$imports.KEY.arrowdown)||($imports.TOUCH.active&&$imports.TOUCH.dy>.3);
      var text='驾驶 '+Math.floor(d.distance)+' / '+$imports.CAR_CHASE_CONFIG.distance+' 米 · 车辆 '+d.hp+'/3 · '+chase+'\n'+hint+' · '+(brake?'正在刹车':'车速 '+Math.round(d.speed))+'\n'+($imports.IS_TOUCH?'摇杆向前加速、左右转向、向后刹车':'W / ↑ 加速，A D / ← → 转向，S / ↓ 刹车');
      if(hud.textContent!==text)hud.textContent=text;
    }
  },
  sound:function(dt){
    var d=$imports.RT.carChase;if(!d)return;
    var near=d.pursuit/$imports.CAR_CHASE_CONFIG.pursuitLimit;
    CAR_VIS.step=(CAR_VIS.step||0)-dt;
    if(near>.08&&CAR_VIS.step<=0){CAR_VIS.step=(0,$imports.lerp)(.9,.28,near);try{$imports.SFX.patStep(($imports.PresentationRandom.next()-.5)*.6,.35+.65*near,true,near>.6);}catch(e){}}
  }
};

/* @module-exports */
GameModules.publish("game3d/js/fx/car-chase-view.js",{
"CAR_VIS":{get:function(){return CAR_VIS;},set:function($value){CAR_VIS=$value;}},
"CarChaseView":{get:function(){return CarChaseView;},set:function($value){CarChaseView=$value;}}
});
})(GameModules.imports("game3d/js/fx/car-chase-view.js"));
