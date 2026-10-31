/* 驾驶逃脱：距离、碰撞、路口与追兵使用模拟运行秒和世界距离。 */
'use strict';

var CAR_CHASE_CONFIG={distance:320,maxSpeed:22,accel:9,brake:15,drag:2,steer:4.2,edge:3.2,
  pursuitLimit:80,obstacles:[[45,0],[78,2.7],[108,-2.7],[190,0],[225,2.7],[290,0]],
  forks:[[150,1],[255,-1]]};
var CAR_VIS={group:null,dash:null,world:null,worldVisible:true,base:null,props:[],marks:[],signs:[],oldNorm:0};
var CarChase={
  active:function(){return !!(RT.carChase&&S.mode==='out'&&!S.dead);},
  start:function(){
    S.screen='play';S.mode='out';S.room=null;S.seated=false;
    S.x=GATE_N.x*SC;S.y=(GATE_N.y+40)*SC;S.ang=-Math.PI/2;S.pitch=0;
    enterWorldOut();resetInputState();releaseMouseLook();
    showBanner('校外道路');
    RT.carUsed=true;RT.carChase={distance:0,x:0,speed:0,hp:3,pursuit:0,nextObstacle:0,nextFork:0};
    CarChase.build();autoSave();updateTouchUI();
    os('我：按住前进，避开障碍。看清路牌，再选路。',4,OS_FORCE);
  },
  clearVisual:function(){
    if(CAR_VIS.group){GLR.scene.remove(CAR_VIS.group);ThreeBackend.disposeGroup(CAR_VIS.group);}
    if(CAR_VIS.dash){GLR.cam.remove(CAR_VIS.dash);ThreeBackend.disposeGroup(CAR_VIS.dash);}
    if(CAR_VIS.world)CAR_VIS.world.visible=CAR_VIS.worldVisible;
    if(CAR_VIS.group)GLR.worldNorm=CAR_VIS.oldNorm;
    CAR_VIS.group=null;CAR_VIS.dash=null;CAR_VIS.world=null;CAR_VIS.props=[];CAR_VIS.marks=[];CAR_VIS.signs=[];CAR_VIS.shades=[];CAR_VIS.step=0;
    document.body.classList.remove('driving');
    var hud=document.getElementById('drivehud');if(hud)hud.hidden=true;
  },
  cancel:function(){
    CarChase.clearVisual();RT.carChase=null;RT.carUsed=false;resetInputState();
  },
  build:function(){
    if(!CarChase.active()||!GLR.scene||!GLR.cam)return;
    if(CAR_VIS.group&&CAR_VIS.world===GLR.outMesh)return;
    var originalNorm=CAR_VIS.group?CAR_VIS.oldNorm:(GLR.worldNorm||0);
    CarChase.clearVisual();
    var p=worldToScene(S.x,S.y,null),g=new THREE.Group();g.position.set(p.x,0,p.z);
    CAR_VIS.base=p;CAR_VIS.world=GLR.outMesh;CAR_VIS.worldVisible=GLR.outMesh?GLR.outMesh.visible:true;
    CAR_VIS.oldNorm=originalNorm;if(GLR.outMesh)GLR.outMesh.visible=false;
    function box(w,h,d,color,x,y,z){
      var o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshBasicMaterial({color:color}));
      o.position.set(x,y,z);g.add(o);return o;
    }
    box(10,0.08,100,0x343b3b,0,-0.04,-49);
    box(.12,.03,100,0x9b9d85,-4.8,0.02,-49);box(.12,.03,100,0x9b9d85,4.8,0.02,-49);
    for(var i=0;i<13;i++)CAR_VIS.marks.push(box(.12,.025,3.5,0xb7b39b,0,.025,-i*8));
    CAR_CHASE_CONFIG.forks.forEach(function(fork){
      var board=box(2.0,.72,.12,0x426b68,0,3.0,-100);
      var arrow=new THREE.Mesh(new THREE.BoxGeometry(.82,.09,.04),new THREE.MeshBasicMaterial({color:0xf0f0dd}));
      arrow.position.set(-fork[1]*.1,0,.08);board.add(arrow);
      var tip=new THREE.Mesh(new THREE.ConeGeometry(.19,.38,3),new THREE.MeshBasicMaterial({color:0xf0f0dd}));
      tip.rotation.z=-fork[1]*Math.PI/2;tip.position.set(fork[1]*.46,0,.08);board.add(tip);
      CAR_VIS.signs.push(board);
    });
    CAR_CHASE_CONFIG.obstacles.forEach(function(ob){
      var b=box(1.55,1.25,1.2,0x5b3b32,ob[1],0.63,-100);
      var stripe=new THREE.Mesh(new THREE.BoxGeometry(1.56,.14,.08),new THREE.MeshBasicMaterial({color:0xd49a52}));
      stripe.position.set(0,.1,.64);b.add(stripe);CAR_VIS.props.push(b);
    });
    for(i=0;i<12;i++){
      var side=i%2?1:-1,offset=Math.floor(i/2)*16;
      var post=box(.24,2.6,.24,0x414c47,side*7,1.3,-offset);
      post.userData.roadOffset=offset;CAR_VIS.props.push(post);
    }
    GLR.scene.add(g);CAR_VIS.group=g;
    var dash=new THREE.Group(),dashBody=new THREE.Mesh(new THREE.BoxGeometry(2.4,.42,.45),new THREE.MeshBasicMaterial({color:0x353e3f}));
    dashBody.position.set(0,-.58,-1.1);dash.add(dashBody);
    var wheel=new THREE.Mesh(new THREE.TorusGeometry(.19,.025,8,20),new THREE.MeshBasicMaterial({color:0x77817c}));
    wheel.position.set(0,-.49,-.88);dash.add(wheel);
    var mirror=new THREE.Mesh(new THREE.BoxGeometry(.9,.18,.04),new THREE.MeshBasicMaterial({color:0x515b59}));
    mirror.position.set(0,.47,-1.15);dash.add(mirror);
    /* 后视镜里的黑影：追得越近越多、越大（draw 里按追影值调） */
    CAR_VIS.shades=[];
    for(i=0;i<5;i++){
      var shade=new THREE.Mesh(new THREE.BoxGeometry(.06,.08,.02),new THREE.MeshBasicMaterial({color:0x080a0a}));
      shade.position.set((i-2)*.15,.46,-1.12);shade.visible=false;dash.add(shade);CAR_VIS.shades.push(shade);
    }
    GLR.cam.add(dash);CAR_VIS.dash=dash;
    document.body.classList.add('driving');
    var hud=document.getElementById('drivehud');if(hud)hud.hidden=false;
  },
  draw:function(){
    if(!CarChase.active())return;
    CarChase.build();if(!CAR_VIS.group)return;
    var d=RT.carChase,p=CAR_VIS.base;
    GLR.cam.position.set(p.x+d.x,1.35,p.z);GLR.cam.lookAt(p.x+d.x,1.15,p.z-24);
    GLR.worldNorm=clamp((d.distance-245)/75,0,1);
    CAR_VIS.marks.forEach(function(mark,i){mark.position.z=-(i*8-(d.distance%8));});
    CAR_CHASE_CONFIG.forks.forEach(function(fork,i){
      var delta=fork[0]-d.distance,sign=CAR_VIS.signs[i];sign.position.z=-delta;sign.visible=delta>2&&delta<85;
    });
    CAR_CHASE_CONFIG.obstacles.forEach(function(o,i){
      var delta=o[0]-d.distance,mesh=CAR_VIS.props[i];mesh.position.z=-delta;mesh.visible=delta>-3&&delta<95;
    });
    for(var i=CAR_CHASE_CONFIG.obstacles.length;i<CAR_VIS.props.length;i++){
      var prop=CAR_VIS.props[i];prop.position.z=-((prop.userData.roadOffset-d.distance%96+96)%96);
    }
    var near=d.pursuit/CAR_CHASE_CONFIG.pursuitLimit;
    (CAR_VIS.shades||[]).forEach(function(shade,i){
      shade.visible=near>i*.18+.04;
      var k=.6+near*.6+Math.sin((GLR.time||0)*7+i*1.7)*.05;shade.scale.set(k,k*(1+near*.4),1);   /* 最大约 0.15 米高，不超出镜面 */
    });
    var hud=document.getElementById('drivehud');
    if(hud){
      /* 路口往哪边走只看路牌，界面上不直接写出来；追影只说远近 */
      var near=d.pursuit/CAR_CHASE_CONFIG.pursuitLimit, chase=near>.75?'黑影就在车后':near>.4?'后视镜里的黑影越来越近':near>.1?'后面有东西跟着':'后视镜里暂时是空的';
      var hint=CAR_CHASE_CONFIG.forks.some(function(f){var dd=f[0]-d.distance;return dd>0&&dd<85;})?'前方路口，看清路牌':'避开路障，沿路前进';
      var text='驾驶 '+Math.floor(d.distance)+' / '+CAR_CHASE_CONFIG.distance+' 米 · 车辆 '+d.hp+'/3 · '+chase+'\n'+hint+'\nW / ↑ 前进，A D / ← → 转向；触屏用摇杆';
      if(hud.textContent!==text)hud.textContent=text;
    }
  },
  fail:function(message,checkpoint){
    var d=RT.carChase;if(!d)return;
    kill(message,'grip');
    if(S.dead)return;
    d.distance=checkpoint;d.speed=0;d.hp=3;d.pursuit=0;
    d.nextObstacle=CAR_CHASE_CONFIG.obstacles.filter(function(o){return o[0]<=checkpoint;}).length;
    d.nextFork=CAR_CHASE_CONFIG.forks.filter(function(f){return f[0]<=checkpoint;}).length;
    autoSave();os('我：车身猛地一震。我还抓着方向盘，得重新找路。',3,OS_FORCE);
  },
  tick:function(dt){
    var d=RT.carChase;if(!CarChase.active()||!d)return;
    var throttle=!!(KEY.w||KEY.arrowup)||(TOUCH.active&&TOUCH.dy<-.25);
    var braking=!!(KEY.s||KEY.arrowdown)||(TOUCH.active&&TOUCH.dy>.3);
    var steering=(KEY.d||KEY.arrowright?1:0)-(KEY.a||KEY.arrowleft?1:0)+(TOUCH.active?TOUCH.dx:0);
    d.speed=clamp(d.speed+(throttle?CAR_CHASE_CONFIG.accel:-CAR_CHASE_CONFIG.drag)*dt-(braking?CAR_CHASE_CONFIG.brake*dt:0),0,CAR_CHASE_CONFIG.maxSpeed);
    d.x=clamp(d.x+clamp(steering,-1,1)*CAR_CHASE_CONFIG.steer*dt,-CAR_CHASE_CONFIG.edge,CAR_CHASE_CONFIG.edge);
    d.pursuit=clamp(d.pursuit+(d.speed<7?3:-2.5)*dt,0,CAR_CHASE_CONFIG.pursuitLimit);
    d.distance+=d.speed*dt;
    var near=d.pursuit/CAR_CHASE_CONFIG.pursuitLimit;
    CAR_VIS.step=(CAR_VIS.step||0)-dt;
    if(near>.08&&CAR_VIS.step<=0){
      CAR_VIS.step=lerp(.9,.28,near);
      try{ SFX.patStep((Math.random()-.5)*.6,.35+.65*near,true,near>.6); }catch(e){}
    }
    if(d.pursuit>=CAR_CHASE_CONFIG.pursuitLimit){CarChase.fail('黑影追上了车。后窗上全是贴上来的手。',Math.max(0,d.distance-30));return;}
    while(d.nextObstacle<CAR_CHASE_CONFIG.obstacles.length&&d.distance>=CAR_CHASE_CONFIG.obstacles[d.nextObstacle][0]){
      var o=CAR_CHASE_CONFIG.obstacles[d.nextObstacle++];
      if(Math.abs(d.x-o[1])<1.25){
        d.hp--;d.speed*=.55;toast('撞上路障');
        if(d.hp<=0){CarChase.fail('车撞在路障上，黑影从破碎的窗户里伸进手。',Math.max(0,o[0]-25));return;}
      }
    }
    while(d.nextFork<CAR_CHASE_CONFIG.forks.length&&d.distance>=CAR_CHASE_CONFIG.forks[d.nextFork][0]){
      var fork=CAR_CHASE_CONFIG.forks[d.nextFork];
      if(d.x*fork[1]<1.0){CarChase.fail('路牌在后视镜里倒了过来。前面的路又通回学校。',fork[0]-30);return;}
      d.nextFork++;autoSave();
    }
    if(d.distance>=CAR_CHASE_CONFIG.distance&&d.nextFork===CAR_CHASE_CONFIG.forks.length){
      CarChase.clearVisual();RT.carChase=null;triggerEnding('car',true);return;
    }
  }
};
