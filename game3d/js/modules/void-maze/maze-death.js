/* 里世界 3D · 虚空迷宫：死在迷宫里的两段死亡演出（模块 void-maze，画面）
   用 DeathCG.register 接进死亡演出，DeathTimeline.define 登记时长，调试面板的死亡预览列表也在这里加；
   死因、墓志铭这些文字在 maze.js。两段都先把场景藏起来（Ctx.hideWorld），在视线坐标系里自己搭布景：
   原点在脚下，+z 是死的那一刻的视线方向；本地 +x 在画面左边，镜头 dAng 为正是往右转。
   四段式「前兆 → 接触／失控 → 临终视角 → 收束」；整段最多闪一次，不做频闪；镜头晃动跟着「镜头晃动」设置。

   · void（迷失：在迷宫里待到理智耗尽）
     前兆：白色走廊里往前走了两步，停下了——身后又响了一步。走廊尽头那扇门的门缝漏着淡蓝色的光。
     接触：那道光闪了两下，灭了，门合成一道缝，没了。身后很远的地方「叮」了一声。猛地转过身：
           两边的白墙上，一扇接一扇的门从一道缝里裂开，门缝亮起来，每一扇都一模一样。另一边又「叮」了一声。
     临终：慢慢坐下去，走廊往里收窄；门缝的光一格一格暗下去，像电梯的楼层灯。
     收束：正前方最后那一扇也暗了。黑。很远的地方，又「叮」了一声。
   · abyss（坠落：理智所剩无几时又掉进了虚空）
     前兆：抬头看着刚才那块平台的边越来越远；白色的碎块往上飞走。
     接触：身体翻过来，一块画着粉笔箭头的方块从面前升上去——过一会儿，同一块又升过去一次。
     临终：低头。很深的下面有一块方地，地上画着斜线，是一开始的地方；地上站着一个人。
           那块方块第三次从下面迎面冲上来，擦着脸过去。下面那个人抬起手电，光一点点抬上来，照到你脸上。
     收束：黑。「咚」——一声空心的落地。 */
'use strict';

(function(){
  if(typeof DeathCG==='undefined'||!DeathCG.register) return;
  var U=DeathCG.kit, seg=U.seg, ss=U.ss, mat=U.mat, setI=U.setI;
  var LOOK=MAZE_LOOK, GAP=0x8fd0ff;              /* 门缝的光比迷宫里的出口再蓝一点：画面整体去色以后还认得出是淡蓝 */
  function on(k,a,b){ return k>=a&&k<b; }
  /* 实例化网格建好时每个都在原点：先全部缩成 0，免得第一帧之前在脚下闪一下 */
  function hideAll(im,n){ for(var i=0;i<n;i++) setI(im,i,0,0,0,0,0,0,0,0,0); im.instanceMatrix.needsUpdate=true; return im; }

  /* ================= void：迷失 ================= */
  var HW=1.3, HL=9, HH=3.0;                      /* 走廊半宽、半长、高（米） */
  /* 门：w 在哪面墙（f 前方尽头 / b 身后尽头 / l 本地 +x / r 本地 −x），z 沿走廊；
     open 从一道缝裂开的时刻（−1 = 一开始就在），shut 合成一道缝的时刻，out 门缝的光灭掉的时刻 */
  var DOORS=[
    {w:'f',z:0,   open:-1,  shut:1.05,out:0.95},
    {w:'b',z:0,   open:-1,  out:3.12},
    {w:'r',z:-1.6,open:1.22,out:2.2},
    {w:'r',z:-5.3,open:1.4, out:2.35},
    {w:'r',z:3.3, open:1.3, out:2.5},
    {w:'l',z:-3.1,open:1.55,out:2.65},
    {w:'l',z:-6.7,open:1.65,out:2.8},
    {w:'l',z:2.4, open:1.75,out:2.95}
  ];                                             /* 2.1 秒前后八扇里七扇同时亮着；之后每 0.15 秒暗一扇（死亡音里的咔哒对得上） */
  /* 门的三层，从墙面往外：门套、门缝的光（比门板大一圈，露出一道光边）、门板 */
  var PART=[{h:2.26,w:1.26,d:0.06,y:1.13,z:0.03},{h:2.16,w:1.12,d:0.02,y:1.08,z:0.07},{h:2.06,w:0.96,d:0.04,y:1.08,z:0.10}];
  var HALL=0xd6dde2;                             /* 黑暗里的白墙：只有一点冷光，看上去是偏冷的暗灰 */

  function doorScale(d,k){
    if(d.open<0) return d.shut?1-ss(k,d.shut,d.shut+0.3):1;
    return ss(k,d.open,d.open+0.3);
  }
  function doorLit(d,k,s){
    if(s<0.6||k>=d.out) return false;
    if(d.open>=0&&k<d.open+0.32) return false;               /* 先是一道暗缝裂开成门，门缝的光再亮 */
    if(d.w==='f'&&(on(k,0.62,0.68)||on(k,0.8,0.85))) return false;   /* 前面那扇灭之前闪两下 */
    if(d.w==='b'&&on(k,3.0,3.04)) return false;
    return true;
  }

  DeathCG.register('void',{
    build:function(c){
      c.hideWorld();
      var W=HALL;
      c.hall=c.merged(function(K){
        var z, y, i=0;
        for(z=-HL+1;z<HL;z+=2,i++){
          K.box('plaster',0,-0.05,z,2*HW,0.1,2,W,0.15+0.015*((i*7)%3));          /* 地面一块块板 */
          K.box('plaster',0,HH+0.05,z,2*HW,0.1,2,W,0.07+0.01*((i*5)%3));         /* 顶 */
          for(y=0.75;y<HH;y+=1.5){
            K.box('plaster',HW+0.05,y,z,0.1,1.5,2,W,0.23+0.025*(((i*3+y*2)|0)%3)/2);   /* 两侧的白墙：方方正正的板，各有一点差别 */
            K.box('plaster',-HW-0.05,y,z,0.1,1.5,2,W,0.22+0.025*(((i*5+y*2)|0)%3)/2);
          }
        }
        K.box('plaster',0,HH/2,HL+0.05,2*HW,HH,0.1,W,0.2);                       /* 两头的墙 */
        K.box('plaster',0,HH/2,-HL-0.05,2*HW,HH,0.1,W,0.2);
      },0,0,0);
      var cols=[0x4a4c4b,GAP,LOOK.door];
      c.doors=PART.map(function(p,i){ return hideAll(c.inst(new THREE.BoxGeometry(p.w,p.h,p.d),mat(cols[i]),DOORS.length),DOORS.length); });
      c.veil(0x000000);
    },
    update:function(c,k,view){
      var walk=-0.6*ss(k,0,0.55);                                   /* 往前走了两步就停下 */
      var narrow=1-0.16*ss(k,2.0,3.2);                              /* 坐下去以后，走廊往里收 */
      c.hall.position.z=walk; c.hall.scale.x=narrow;
      DOORS.forEach(function(d,i){
        var s=doorScale(d,k), lit=doorLit(d,k,s), x=0, z=d.z+walk, ry=0;
        if(d.w==='f'){ z=HL+walk; ry=Math.PI; }
        else if(d.w==='b'){ z=-HL+walk; ry=0; }
        else if(d.w==='l'){ x=HW*narrow; ry=-Math.PI/2; }
        else { x=-HW*narrow; ry=Math.PI/2; }
        var sn=Math.sin(ry), cs=Math.cos(ry);
        PART.forEach(function(p,j){
          var sx=(j===1&&!lit)||s<0.02?0:s;                         /* 缩放为 0 = 藏起来（门还没裂开 / 门缝的光灭了） */
          setI(c.doors[j],i,x+p.z*sn,p.y,z+p.z*cs,0,ry,0,sx,sx?1:0,sx?1:0);
        });
      });
      c.doors.forEach(function(im){ im.instanceMatrix.needsUpdate=true; });
      var turn=Math.PI*ss(k,1.1,1.85);                              /* 身后「叮」了一声：猛地转过身去 */
      var look=0.25*Math.sin(Math.max(0,k-1.95)*2.4)*ss(k,1.95,2.3)*(1-ss(k,2.85,3.2));   /* 坐着，从一扇门看到另一扇 */
      var breath=0.015*Math.sin(k*3.1)*c.shk;
      c.cam(view,k,turn+look,-0.04+0.16*ss(k,2.1,2.8),-0.8*ss(k,1.95,2.7)+breath);
      c.shade(0.12+0.3*ss(k,2.0,3.0)+0.55*ss(k,3.1,3.45));
    }
  });

  /* ================= abyss：坠落 ================= */
  var IMPACT=3.05;
  function fallD(k){ return 6*k+2.6*k*k; }                         /* 已经掉了多远（米）：一开始就在掉，越掉越快 */
  function pitchAt(k){ return 1.15-1.25*ss(k,0.7,1.15)-1.22*ss(k,1.95,2.4); }   /* 抬头 → 翻过来平视 → 低头 */
  function yawAt(k){ return 0.6*ss(k,0.7,1.4)-0.35*ss(k,1.95,2.5); }
  /* 同一块方块三次从面前过。[a,b) 是它出现的时间段，两头都在画面外（换到下一次时不会跳）。
     前两次：t 那一刻正好升到眼前（往上的速度 v、离镜头 d、往左偏 l，方向取 t 那一刻的视线）；
     第三次：低头以后，从下面那块方地的方向顺着视线迎面冲上来，t 那一刻擦着左脸过去 */
  var PASS=[{a:0.88,b:1.32,t:1.1,v:9,d:1.9,l:0.25},{a:1.33,b:1.77,t:1.55,v:9,d:1.9,l:0.25},{a:2.05,b:2.42,t:2.45,v:9,l:0.95,rush:1}];
  var RUBBLE=36;
  var qa=null, qb=null, tv=null;
  function passAt(p,k,eye,out){
    var y0=yawAt(p.t), sy=Math.sin(y0), cy=Math.cos(y0), lx=cy*p.l, lz=sy*p.l;
    if(!p.rush) return out.set(-sy*p.d+lx,eye+(k-p.t)*p.v,cy*p.d+lz);
    var p0=pitchAt(p.t), u=(p.t-k)*p.v, cp=Math.cos(p0);
    return out.set(-sy*cp*u+lx,eye+Math.sin(p0)*u,cy*cp*u+lz);
  }

  DeathCG.register('abyss',{
    build:function(c){
      c.hideWorld();
      var r=c.rand, i, W=LOOK.white;
      /* 虚空：藏起迷宫以后，四周换成一整片黑（不画别的房间的天空渐变）。透明材质 + 最先画，只填没有东西的地方 */
      var sky=c.mesh(new THREE.SphereGeometry(80,16,10),mat(0x000000,1,{side:THREE.BackSide,fog:false}),0,0,0);
      sky.renderOrder=-10;
      if(!qa){ qa=new THREE.Quaternion(); qb=new THREE.Quaternion(); tv=new THREE.Vector3(); }
      /* 刚才掉下来的那块平台：在头顶前方，越来越远。底面暗，靠这边的侧面和上沿被上面的冷光照着一点 */
      c.ledge=c.merged(function(K){
        K.box('plaster',0,0.3,3.3,6,0.56,6,W,0.2);
        K.box('plaster',0,0.3,0.29,6,0.6,0.02,W,0.5);
        K.box('plaster',0,0.6,0.28,6,0.03,0.03,W,0.9);
      },0,0,0);
      /* 往上飞走的白色碎块（体素） */
      c.rub=hideAll(c.inst(new THREE.BoxGeometry(1,1,1),mat(0xcfcdc6),RUBBLE),RUBBLE);
      c.bits=[];
      for(i=0;i<RUBBLE;i++) c.bits.push({a:r()*6.283,d:2.0+r()*5.5,s:0.15+r()*0.5,y:r()*36,v:0.65+r()*0.35,w:(r()-0.5)*3,ph:r()*6.283});
      /* 画着粉笔箭头的那一块：箭头画在 +z 面上，用 c.face 转过来对着镜头 */
      c.mark=c.merged(function(K){
        K.box('plaster',0,0,0,1,1,1,W,0.8);
        var g=0x56585c, zf=0.515;
        K.rod('paper',0,-0.3,zf,0,0.33,zf,0.032,0.032,4,g,1);
        K.rod('paper',-0.2,0.12,zf,0,0.33,zf,0.032,0.032,4,g,1);
        K.rod('paper',0.2,0.12,zf,0,0.33,zf,0.032,0.032,4,g,1);
      },0,0,0);
      c.mark.visible=false;
      /* 很深的下面：一开始的那块方地（斜线方块，只有上面一点冷光，灰的），地上站着一个人，手里有手电 */
      c.pad=new THREE.Group(); c.add(c.pad,0,0,1.2);
      c.mesh(new THREE.BoxGeometry(4.8,0.3,4.8),mat(0x8f9294,undefined,{fog:false}),0,-0.15,0,c.pad);
      c.mesh((function(){
        var K=new Kit(), t, h=0.004, a=2.2;
        for(t=-2*a+0.35;t<2*a;t+=0.7){                                 /* 线 x − z = t 和方块相交的那一段 */
          var za=Math.max(-a,-a-t), zb=Math.min(a,a-t);
          if(zb-za<0.05) continue;
          var mx=t+(za+zb)/2, mz=(za+zb)/2;
          K.frame(mx,mz,-Math.PI/4,0); K.box('decal',0,h,0,(zb-za)*Math.SQRT2,0.003,0.04,LOOK.hatch,0.55); K.unframe();
        }
        [[0,-a,2*a,0.05],[0,a,2*a,0.05],[-a,0,0.05,2*a],[a,0,0.05,2*a]].forEach(function(b){ K.box('decal',b[0],h,b[1],b[2],0.003,b[3],LOOK.hatch,0.55); });   /* 方块的四条边 */
        return K.mergedGeometry();
      })(),new THREE.MeshBasicMaterial({vertexColors:true,fog:true}),0,0,0,c.pad);
      c.man=new THREE.Group(); c.man.add(figMesh('person',mat(0x0b0d10),1)); c.add(c.man,0.2,0,0.1,c.pad);
      c.beam=new THREE.Group(); c.add(c.beam,0.45,1.12,0.2,c.pad);
      var cone=new THREE.ConeGeometry(0.42,2.0,14,1,false); cone.translate(0,-1.0,0); cone.rotateX(-Math.PI/2);   /* 尖在手电上，朝 +z 张开 */
      c.mesh(cone,mat(0xf4f8fa,0.22,{fog:false}),0,0,0,c.beam);
      c.mesh(new THREE.CircleGeometry(0.06,12),mat(0xffffff,undefined,{fog:false}),0,0,0.01,c.beam);   /* 手电的灯头 */
      c.veil(0x000000);
    },
    update:function(c,k,view){
      var D=fallD(Math.min(k,IMPACT)), Dend=fallD(IMPACT), i;
      var buffet=0.04*Math.sin(k*23)*seg(k,0.7,1.9)*c.shk;          /* 翻过来的时候被风推着晃 */
      c.cam(view,k,yawAt(k),pitchAt(k)+buffet,0);
      var eye=c.camY();
      c.ledge.position.y=eye+2.2+D;
      c.bits.forEach(function(b,j){
        var y=((b.y+D*b.v)%36+36)%36-18;
        setI(c.rub,j,Math.cos(b.a)*b.d,eye+y,Math.sin(b.a)*b.d,b.ph+k*b.w,b.a,b.ph*0.5+k*b.w*0.6,b.s,b.s,b.s);
      });
      c.rub.instanceMatrix.needsUpdate=true;
      var mk=null;
      for(i=0;i<PASS.length;i++) if(k>=PASS[i].a&&k<PASS[i].b){ mk=PASS[i]; break; }
      c.mark.visible=!!mk;
      if(mk){ passAt(mk,k,eye,c.mark.position); c.mark.lookAt(GLR.cam.position); c.mark.rotateZ(0.12*Math.sin(k*2.1)); }   /* 画箭头的那面始终朝着镜头 */
      c.pad.position.y=eye-1.35-(Dend-D);
      c.man.rotation.y=Math.PI+0.4*Math.sin(k*0.9);
      /* 手电：先在地上找，2.45 秒起一点点抬起来，2.95 秒照到脸上 */
      c.pad.updateWorldMatrix(true,true);
      tv.set(1.1*Math.cos(k*1.7),0,0.6+1.1*Math.sin(k*1.7)); c.pad.localToWorld(tv);
      c.beam.lookAt(tv); qa.copy(c.beam.quaternion);
      c.beam.lookAt(GLR.cam.position); qb.copy(c.beam.quaternion);
      c.beam.quaternion.copy(qa).slerp(qb,ss(k,2.45,2.95));
      c.flash('glare',k,2.97,0.35);
      c.shade(0.1+0.85*ss(k,3.0,3.12));
    }
  });

  DeathTimeline.define('void',3.6);
  DeathTimeline.define('abyss',3.6);
  if(typeof DEV_DEATH!=='undefined') DEV_DEATH.push(['虚空迷宫·迷失','void'],['虚空迷宫·坠落','abyss']);
})();
