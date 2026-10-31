/* 死亡演出：按死因分镜。每种都是「前兆 → 接触／失控 → 临终视角 → 收束」四段，
   所有位置、镜头都只由经过的时间 k（秒）算出来，帧率高低结果一样。
   模型都放在「视线坐标系」里：原点在玩家脚下，+z 是死亡那一刻的视线方向，+y 向上。
   预览只改渲染镜头，不改玩家状态；真实死亡改 S 上的镜头量（死亡后玩家不能再操作）。 */
'use strict';

var DeathCG=(function(){
  function seg(k,a,b){ return k<=a?0:k>=b?1:(k-a)/(b-a); }
  function sm(x){ return x*x*(3-2*x); }
  function ss(k,a,b){ return sm(seg(k,a,b)); }
  function lerp3(o,a,b,t){ o.set(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,a.z+(b.z-a.z)*t); }
  /* 每种死法固定一个种子：同一种死法每次看起来一样，测试也能逐帧比对 */
  function rng(name){
    var s=7, i; for(i=0;i<name.length;i++) s=(s*31+name.charCodeAt(i))>>>0;
    return function(){ s=(s*1664525+1013904223)>>>0; return s/4294967296; };
  }
  function mat(col,op,opt){
    opt=opt||{};
    var m=new THREE.MeshBasicMaterial({color:col,transparent:op!==undefined,opacity:op===undefined?1:op,
      fog:opt.fog!==false,side:opt.side||THREE.FrontSide,depthTest:opt.over?false:true,depthWrite:!(opt.over||op!==undefined)});
    return m;
  }

  /* 每次死亡一份上下文 */
  function Ctx(type,grp,preview){
    var p=anfxW2S(S.x,S.y), F=new THREE.Group();
    F.position.set(p.x,S.floorY||0,p.z); F.rotation.y=Math.PI/2-S.ang; grp.add(F);
    this.type=type; this.F=F; this.preview=preview; this.rand=rng(type);
    this.base=preview?null:(S.deathView||{ang:S.ang,pitch:S.pitch,eyeLift:S.eyeLift||0});
    this.shk=(typeof SHAKE_ON==='undefined'||SHAKE_ON)?1:0;
    this.flashed={}; this.lift=0; this.veilMesh=null;
  }
  Ctx.prototype={
    /* 加到视线坐标系，并登记为动画对象 */
    add:function(o,x,y,z,parent){ o.position.set(x||0,y||0,z||0); (parent||this.F).add(o); ANFX.items.push(o); return o; },
    mesh:function(geo,m,x,y,z,parent){ return this.add(new THREE.Mesh(geo,m),x,y,z,parent); },
    box:function(w,h,d,col,op,x,y,z,opt){ return this.mesh(new THREE.BoxGeometry(w,h,d),mat(col,op,opt),x,y,z); },
    fig:function(kind,col,scale,x,z){
      var g=new THREE.Group(); g.add(figMesh(kind,mat(col),scale||1)); g.rotation.order='YXZ';
      return this.add(g,x,0,z);
    },
    fx:function(name,scale,x,y,z){
      var g=new THREE.Group(); g.add(fxMesh(name)); if(scale) g.scale.setScalar(scale); g.rotation.order='YXZ';
      return this.add(g,x,y,z);
    },
    /* 收束：贴着镜头的一层颜色，画在所有东西上面 */
    veil:function(col){
      var m=mat(col,0,{side:THREE.BackSide,over:true,fog:false});
      this.veilMesh=new THREE.Mesh(new THREE.SphereGeometry(0.3,12,8),m); this.veilMesh.renderOrder=999;
      this.F.add(this.veilMesh); return this.veilMesh;
    },
    camY:function(){ return EYE+this.lift; },
    /* 镜头：相对死亡那一刻的朝向；开头 0.4 秒从玩家原来的俯仰过渡过来 */
    cam:function(view,k,dAng,pitch,lift){
      var b=this.base||{ang:S.ang,pitch:S.pitch,eyeLift:S.eyeLift||0};
      this.lift=lift||0;
      view.ang=b.ang+(dAng||0);
      view.pitch=clamp((pitch||0)+(b.pitch||0)*(1-ss(k,0,0.4)),-1.45,1.45);
      view.eyeLift=this.lift;
      try{ syncCamera(0,this.preview?view:null); }catch(e){}
      if(this.veilMesh) this.veilMesh.position.set(0,this.camY(),0);
    },
    shade:function(v){ if(this.veilMesh) this.veilMesh.material.opacity=Math.min(0.94,v); },
    /* 只闪一次，亮度封顶（不做连续频闪） */
    flash:function(id,k,at,v){
      if(k>=at&&!this.flashed[id]){ this.flashed[id]=1; GLR.flash=Math.max(GLR.flash||0,Math.min(0.5,v)); }
    },
    /* 让一个东西的 +z 正面朝向镜头 */
    face:function(o){ o.rotation.y=Math.atan2(-o.position.x,-o.position.z); }
  };

  var CG={};

  /* ---- grip：脚下伸手（巡察者、驾驶追兵、白名单、车库） ---- */
  CG.grip={
    build:function(c){
      var i,r=c.rand;
      c.stain=c.mesh(new THREE.CircleGeometry(1,24),mat(0x030405,0.92),0,0.012,0);
      c.stain.rotation.x=-Math.PI/2;
      c.hands=[];
      for(i=0;i<12;i++){
        var h=c.fx('hand',1.0,0,-0.5,0);
        h.userData.g={a:i/12*6.283+(r()-0.5)*0.3,r:1.1+r()*0.9,d:0.55+((i*5)%12)*0.07};
        c.hands.push(h);
      }
      c.veil(0x010101);
    },
    update:function(c,k,view){
      var sink=ss(k,1.5,3.0);
      c.cam(view,k,0,-0.55*ss(k,0,0.6)*(1-sink)+0.3*sink+0.04*Math.sin(k*23)*c.shk*sink,-1.25*sink);
      c.stain.scale.setScalar(0.15+2.4*ss(k,0,1.4));
      var reach=ss(k,1.5,2.6), end=ss(k,2.6,3.2), cy=c.camY();
      c.hands.forEach(function(h,i){
        var g=h.userData.g, up=ss(k,g.d,g.d+0.5), rad=g.r*(1-reach*0.6);
        h.visible=k>g.d;
        h.position.set(Math.cos(g.a)*rad,-0.4+up*0.75+reach*0.7,Math.sin(g.a)*rad);
        if(i<3&&end>0){ h.position.lerp(new THREE.Vector3((i-1)*0.16,cy-0.08,0.32),end); }
        h.rotation.y=Math.atan2(-h.position.x,-h.position.z);
        h.rotation.x=-0.9*(1-up)-0.6*reach;               /* 先是手腕翻上来，然后手指朝上抓 */
      });
      c.shade(0.9*ss(k,2.8,3.2));
    }
  };

  /* ---- neck：围墙外的行人，脖子越伸越长，从墙头弯过来 ---- */
  CG.neck={
    build:function(c){
      var i;
      c.wall=c.box(7,2.3,0.3,0x4a4540,undefined,0,1.15,2.4);
      c.box(7.1,0.1,0.42,0x6a655d,undefined,0,2.33,2.4);
      var flesh=mat(0x7c302c);
      c.segs=[];
      for(i=0;i<12;i++){ c.segs.push(c.mesh(new THREE.CylinderGeometry(0.07,0.08,1,7),flesh,0,1.6,2.8)); }
      c.head=c.fx('neckhead',1,0,2.1,2.8);
      c.veil(0x050101);
    },
    update:function(c,k,view){
      var peek=ss(k,0,0.5), rise=ss(k,0.5,1.6), bend=ss(k,1.6,2.6), end=ss(k,2.6,3.4);
      var lift=1.3*end, cy=EYE+lift;
      var top=new THREE.Vector3(0,2.1+0.35*peek+2.6*rise,2.8);
      var near=new THREE.Vector3(0,cy+0.05,0.5-0.15*end);
      var hp=new THREE.Vector3(); lerp3(hp,top,near,bend); hp.y+=Math.sin(bend*Math.PI)*0.9;
      c.head.position.copy(hp);
      c.head.scale.setScalar(1+0.35*bend+0.6*end);
      c.head.rotation.y=Math.atan2(-hp.x,-hp.z)*bend+Math.PI*(1-bend);   /* 先是后脑勺对着墙这边，弯过来时转成正脸 */
      c.head.rotation.x=0.3*bend;
      /* 脖子：从墙后的肩膀沿一条弯线连到头 */
      var base=new THREE.Vector3(0,1.6,2.8), ctrl=new THREE.Vector3(0,Math.max(top.y,hp.y)+0.6*bend,2.8-0.2*bend);
      var prev=base.clone(), n=c.segs.length, up=new THREE.Vector3(0,1,0);
      c.segs.forEach(function(s,i){
        var t=(i+1)/n, a=(1-t)*(1-t), b=2*(1-t)*t, d=t*t;
        var pt=new THREE.Vector3(base.x*a+ctrl.x*b+hp.x*d, base.y*a+ctrl.y*b+hp.y*d, base.z*a+ctrl.z*b+hp.z*d);
        var dir=pt.clone().sub(prev), len=dir.length()||0.001;
        s.position.copy(prev).addScaledVector(dir,0.5);
        s.quaternion.setFromUnitVectors(up,dir.multiplyScalar(1/len));
        s.scale.set(1,len,1); s.visible=k>0.5; prev=pt;
      });
      /* 先抬头跟着它往上看，它弯下来时视线落回正前方，最后被拎离地面 */
      var look=Math.atan2(hp.y-cy,Math.max(0.3,hp.z));
      c.cam(view,k,0,look*(1-end)+0.25*end,lift);
      c.shade(0.9*ss(k,3.0,3.4));
    }
  };

  /* ---- shadow：影子慢一拍，最后从地上立起来，走进你身体里 ---- */
  CG.shadow={
    build:function(c){
      c.sh=c.fig('person',0x020304,1,0,0.35);
      c.sh.rotation.y=Math.PI;
      c.veil(0x000000);
    },
    update:function(c,k,view){
      var stretch=seg(k,0,0.8), stand=ss(k,0.8,1.6), walk=ss(k,1.6,2.6), end=ss(k,2.6,3.2);
      var o=c.sh;
      o.rotation.x=-Math.PI/2*(1-stand);
      o.scale.set(1,1+0.6*stretch*(1-stand),0.04+0.96*stand);
      o.position.x=0.12*Math.sin(Math.max(0,k-0.25)*3)*(1-stand);    /* 比你慢半拍地晃 */
      o.position.z=0.35+1.6*stand-1.2*walk-0.6*end;
      o.scale.multiplyScalar(1+0.15*end);
      c.cam(view,k,0,-0.6*ss(k,0,0.5)*(1-stand)-0.05*stand,0);
      c.shade(0.92*ss(k,2.8,3.2));
    }
  };

  /* ---- twin：另一个你，从远处一步步走过来，停在一臂远俯身看你，然后走进你 ---- */
  CG.twin={
    build:function(c){
      c.tw=c.fig('person',0x0b0d10,1,0,5.5);
      c.tw.rotation.y=Math.PI;
      c.veil(0x000000);
    },
    update:function(c,k,view){
      var walk=ss(k,0.8,2.0), reach=ss(k,2.0,2.6), end=ss(k,2.6,3.0);
      var z=5.5-4.3*walk-0.3*reach-0.55*end;
      c.tw.position.set(0,0.04*Math.abs(Math.sin(k*7))*seg(k,0.8,2.0)*(1-seg(k,1.9,2.0)),z);
      c.tw.rotation.z=0.14*ss(k,0.2,0.8)*(1-end);                       /* 歪头，和你一样的角度 */
      c.tw.rotation.x=0.22*reach;                                        /* 停在一臂远，俯身凑过来看你 */
      c.cam(view,k,0,-0.04,0);
      c.shade(0.92*ss(k,2.7,3.1));
    }
  };

  return {
    has:function(type){ return !!CG[type]; },
    types:function(){ return Object.keys(CG); },
    build:function(type,grp,preview){
      var c=new Ctx(type,grp,preview); CG[type].build(c); return c;
    },
    update:function(c,k,view){ CG[c.type].update(c,k,view); }
  };
})();
