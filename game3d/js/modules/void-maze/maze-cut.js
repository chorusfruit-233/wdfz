/* @module-capsule */
(function($imports){
/* 里世界 3D · 异色空间的进出过场（内部，计划《电梯直通、新天赋、新结局与恐怖氛围》第 2 节）
   进入（7 秒）：按下那个按钮以后，楼层显示跳成一个不存在的符号；轿厢的灯一排一排熄灭，电梯没有动，却传来失重下坠的声音，
     颜色从画面边缘开始反过来；门开，门外是迷宫起点那块方地（轿厢挑面前最开阔的方向停，看得见远处的黑）；
     走出去，回头看：门在身后合上，然后整扇门消失。控制交还，人站在迷宫起点。
   离开（6 秒）：推开出口的门，门缝里的蓝光涌进来，迷宫的白从画面中心往外退，颜色复原；
     门后是电梯厅（exit1 上电梯的那一层，exit2 另一栋楼）；回头，身后是一扇普通的电梯门，门上的指示灯一格一格暗下去。
   规则：
   - 进入时人已经在迷宫里（VoidMaze.enter 先进房间、存好档），过场只在上面搭一节假的轿厢：读档直接在迷宫起点，不会重播；
     离开时到了白场那一下才真正换到电梯厅（Elevator.arrive 存档），跳过也走同一个只执行一次的换场。
   - 过场期间 S.screen==='cut'，世界不走：不掉 SAN、巡察者不动、不算危险。
   - 跳过和播完都走 cutFinish → 完成回调；完成回调里补做没做的换场，再说那句话、记「看过」（DeathArchive.markSeen）。
   - CG 档案馆「结局与开场」里有两张对应的隐藏卡（death-archive.js 的 cut:void_in / cut:void_out），没经历过不出现。
     回放时没有 VoidCut 的待办（P 为空）：进入直接在迷宫出生区域搭轿厢；离开站在出口 1 前，白场时换到教学楼二楼的电梯厅。
   - 只用 MeshBasicMaterial 和一层 CSS 叠加（mix-blend-mode:difference 做反色、screen 做蓝光），不加实时光源、不频闪；
     reduceFlash 打开时白场和蓝光的峰值压低。
   全是内部内容：名字和画面不进玩家 Wiki（tests/test_wiki_secrets.py 有禁止词）。 */
'use strict';

var VoidCut=(function(){
  var C=$imports.MAZE_CFG;
  var P=null;                  /* 正式游玩的待办：{kind:'in'|'out', id, move, say, moved}；回放时为空 */
  var IN_DUR=7, OUT_DUR=6;
  var CAB={w:1.5, d:2.05, h:2.4, door:0.47};      /* 和真电梯轿厢一样的尺寸（LIFT_GEO.cabinHalf×2、depth） */

  function flashK(){ try{ return (typeof $imports.SET!=="undefined"&&$imports.SET.reduceFlash)?0.55:1; }catch(e){ return 1; } }
  function shake(){ return (typeof $imports.SHAKE_ON!=='undefined'&&$imports.SHAKE_ON)?1:0; }
  function replaying(){ return typeof $imports.ArchiveReplay!=='undefined'&&$imports.ArchiveReplay.on; }

  /* ---------- 叠加层：反色（difference）和一层彩色光（screen），都带径向遮罩 ---------- */
  function overlay(){
    var el=document.getElementById('voidcutfx');
    if(!el){
      el=document.createElement('div'); el.id='voidcutfx';
      el.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:40;opacity:0;';
      var inv=document.createElement('div'); inv.className='inv';
      inv.style.cssText='position:absolute;inset:0;background:#fff;mix-blend-mode:difference;';
      var glow=document.createElement('div'); glow.className='glow';
      glow.style.cssText='position:absolute;inset:0;mix-blend-mode:screen;opacity:0;';
      el.appendChild(inv); el.appendChild(glow); document.body.appendChild(el);
    }
    return el;
  }
  /* 反色从边缘往里长：r 是中心没反色的半径（视口对角线的比例），0 就是整屏 */
  function invert(k,r){
    var el=overlay(), inv=el.querySelector('.inv');
    el.style.opacity=k>0?'1':'0';
    var a=Math.max(0,r*100), b=a+18;
    var m='radial-gradient(circle at 50% 50%, transparent '+a.toFixed(1)+'%, #000 '+b.toFixed(1)+'%)';
    inv.style.opacity=String((0,$imports.clamp)(k,0,1));
    inv.style.webkitMaskImage=m; inv.style.maskImage=m;
  }
  /* 彩色光：col 是 css 颜色；hole>0 时中心挖空（白从中心往外退） */
  function glow(k,col,hole){
    var el=overlay(), g=el.querySelector('.glow');
    if(k>0) el.style.opacity='1';
    g.style.opacity=String((0,$imports.clamp)(k,0,1)*flashK());
    g.style.background=col;
    var m=hole>0?'radial-gradient(circle at 50% 50%, transparent '+(hole*100).toFixed(1)+'%, #000 '+(hole*100+22).toFixed(1)+'%)':'none';
    g.style.webkitMaskImage=m; g.style.maskImage=m;
  }
  function clearOverlay(){
    var el=document.getElementById('voidcutfx'); if(!el) return;
    el.style.opacity='0';
    var inv=el.querySelector('.inv'), g=el.querySelector('.glow');
    if(inv) inv.style.opacity='0'; if(g) g.style.opacity='0';
  }

  /* ---------- 小零件 ---------- */
  function mat(col,op){ return new $imports.THREE.MeshBasicMaterial({color:col,fog:false,transparent:op!==undefined,opacity:op===undefined?1:op,depthWrite:op===undefined,side:$imports.THREE.DoubleSide}); }
  function box(g,w,h,d,col,x,y,z){ var m=new $imports.THREE.Mesh(new $imports.THREE.BoxGeometry(w,h,d),mat(col)); m.position.set(x,y,z); g.add(m); return m; }
  /* 楼层显示：七段数码管。sym 是要亮的段（a b c d e f g，再加两条斜线 h i 拼不存在的符号） */
  var SEGS={a:[0,0.5,0.8,0.12],b:[0.36,0.25,0.12,0.5],c:[0.36,-0.25,0.12,0.5],d:[0,-0.5,0.8,0.12],e:[-0.36,-0.25,0.12,0.5],f:[-0.36,0.25,0.12,0.5],g:[0,0,0.8,0.12]};
  var GLYPH={'1':'bc','2':'abged','3':'abgcd','4':'fgbc','5':'afgcd','6':'afedcg', X:'abcdefhi'};   /* X：一个框里两条斜线，没有这个数 */
  function digit(){
    var g=new $imports.THREE.Group(), parts={};
    Object.keys(SEGS).forEach(function(k){ var s=SEGS[k]; var m=new $imports.THREE.Mesh(new $imports.THREE.PlaneGeometry(s[2],s[3]),mat(0x2a0806)); m.position.set(s[0],s[1],0); g.add(m); parts[k]=m; });
    ['h','i'].forEach(function(k,i){ var m=new $imports.THREE.Mesh(new $imports.THREE.PlaneGeometry(1.15,0.1),mat(0x2a0806)); m.rotation.z=i?-1.05:1.05; g.add(m); parts[k]=m; });
    g.userData.parts=parts;
    g.userData.show=function(ch,on){
      var lit=GLYPH[ch]||'';
      Object.keys(parts).forEach(function(k){ parts[k].material.color.setHex(lit.indexOf(k)>=0&&on?0xff3a20:0x2a0806); });
    };
    return g;
  }

  /* 一节轿厢：局部坐标 +z 是门外，门在 z=0，里面是 z<0 */
  function cabin(){
    var g=new $imports.THREE.Group(), w=CAB.w, d=CAB.d, h=CAB.h, wall=[], lights=[];
    function W(m){ wall.push(m); return m; }
    W(box(g,w,0.04,d,0x3b4144,0,0,-d/2));                        /* 地 */
    W(box(g,w,0.04,d,0x9aa4a6,0,h,-d/2));                        /* 顶 */
    W(box(g,0.04,h,d,0x8a9599,-w/2,h/2,-d/2)); W(box(g,0.04,h,d,0x8a9599,w/2,h/2,-d/2));
    W(box(g,w,h,0.04,0x7f898c,0,h/2,-d));                         /* 后壁 */
    W(box(g,(w-2*CAB.door)/2+0.02,h,0.06,0x6d777a,-(w/2-((w-2*CAB.door)/4)),h/2,0));   /* 门两边的门框 */
    W(box(g,(w-2*CAB.door)/2+0.02,h,0.06,0x6d777a, (w/2-((w-2*CAB.door)/4)),h/2,0));
    W(box(g,2*CAB.door,h-2.1,0.06,0x6d777a,0,2.1+(h-2.1)/2,0));   /* 门楣 */
    W(box(g,0.05,0.9,0.5,0x5a6366,w/2-0.03,1.2,-0.45));            /* 按钮面板 */
    for(var i=0;i<3;i++){                                         /* 顶上三排灯 */
      var l=box(g,0.9,0.02,0.32,0xf4f1e6,0,h-0.03,-0.35-i*0.62); lights.push(l);
    }
    var L=box(g,CAB.door,2.1,0.03,0x8e979a,-CAB.door/2,1.05,0.02), R=box(g,CAB.door,2.1,0.03,0x8e979a,CAB.door/2,1.05,0.02);
    W(L); W(R);
    var dg=digit(); dg.scale.setScalar(0.12); dg.position.set(0,2.22,-0.03); dg.rotation.y=Math.PI; g.add(dg);
    g.userData={wall:wall,lights:lights,L:L,R:R,digit:dg};
    return g;
  }
  /* 灯 lit（0–1）：墙按灯的亮度变暗；每块墙记着自己的原色 */
  function dim(cab,k){
    cab.userData.wall.forEach(function(m){
      if(!m.userData.c0) m.userData.c0=m.material.color.clone();
      m.material.color.copy(m.userData.c0).multiplyScalar(0.06+0.94*k);
    });
  }
  function doors(cab,open){ var u=cab.userData; u.L.position.x=-CAB.door/2-open*CAB.door*0.98; u.R.position.x=CAB.door/2+open*CAB.door*0.98; }
  function fadeCab(cab,op){
    cab.traverse(function(o){ if(o.material){ o.material.transparent=op<1; o.material.opacity=op; o.material.depthWrite=op>=1; } });
    cab.visible=op>0.01;
  }

  /* ---------- 进入 ---------- */
  /* 轿厢放在起点身后：在当前位置和出生区域正中各试八个方向，身后 2.6 米要空着（墙不穿进轿厢），
     挑面前最开阔的那个（看得见虚空）；换了位置和朝向就直接写回玩家，交还控制时和最后一帧对得上 */
  function pickBack(){
    var fy=$imports.S.floorY||0, cur=$imports.VoidMaze.toScene($imports.S.x,$imports.S.y), best=null;
    [cur,{x:0,z:0}].forEach(function(p,pi){
      if($imports.VoidMaze.depthAt(p.x,p.z,$imports.PRAD*$imports.U2M+0.05,fy)>0) return;
      for(var i=0;i<8;i++){
        var a=i*Math.PI/4, fx=Math.cos(a), fz=Math.sin(a), ok=true, s, open=0;
        for(s=0.4;s<=2.6&&ok;s+=0.3){ if($imports.VoidMaze.depthAt(p.x-fx*s,p.z-fz*s,0.8,fy)>0) ok=false; }
        if(!ok) continue;
        for(s=0.5;s<=10;s+=0.5){ if($imports.VoidMaze.depthAt(p.x+fx*s,p.z+fz*s,0.3,fy)>0) break; open=s; }
        var score=open-pi*1.5;
        if(!best||score>best.score) best={x:p.x,z:p.z,ang:a,score:score};
      }
    });
    if(!best) best={x:cur.x,z:cur.z,ang:$imports.S.ang};
    return {x:best.x,z:best.z,y:fy,ang:best.ang};
  }
  $imports.CUT_DEF.void_in={dur:IN_DUR,
    setup:function(d){
      var b=pickBack(); d.b=b; d.f={x:Math.cos(b.ang),z:Math.sin(b.ang)};
      d.cab=(0,$imports.cutAdd)(cabin());
      /* 门在玩家身后 0.6 米：门外（局部 +z）朝玩家的方向 */
      d.cab.position.set(b.x-d.f.x*0.6,b.y,b.z-d.f.z*0.6);
      d.cab.rotation.y=Math.atan2(d.f.x,d.f.z);
      var w=$imports.VoidMaze.toWorld(b.x,b.z); $imports.S.x=w.x; $imports.S.y=w.y; $imports.S.ang=b.ang; $imports.S.pitch=0;
      d.cab.userData.digit.userData.show(String(P&&P.floor||2),true);
      d.snd={};
      invert(0,1); glow(0,'#000',0);
    },
    frame:function(k,d){
      var u=d.cab.userData, b=d.b, f=d.f, eye=$imports.EYE;
      /* 楼层显示：0.06 跳成那个符号，之后一直亮着它 */
      var sym=k>0.06;
      u.digit.userData.show(sym?'X':String(P&&P.floor||2),!(k>0.06&&k<0.09));
      /* 灯一排一排熄灭（0.14 / 0.22 / 0.30），墙跟着暗；门开以后外面的虚空不亮，轿厢只剩一点余光 */
      var off=[0.14,0.22,0.30], lit=0;
      u.lights.forEach(function(l,i){ var on=k<off[i]; l.material.color.setHex(on?0xf4f1e6:0x2b2d2e); if(on) lit++; });
      dim(d.cab,0.25+0.75*lit/3);
      if(k>0.16&&!d.snd.fall){ d.snd.fall=1; try{ $imports.SoundPlayer.play('void.fall',{k:0.8}); }catch(e){} }
      if(k>0.5&&!d.snd.ping){ d.snd.ping=1; try{ $imports.SoundPlayer.play('void.ping',{pitch:0.7}); }catch(e){} }   /* 门开：很远的地方一声细响 */
      /* 反色从边缘往里长（0.18–0.46），门开了慢慢退掉（0.5–0.66） */
      var grow=(0,$imports.cutPhase)(k,0.18,0.46), back=(0,$imports.cutPhase)(k,0.5,0.66);
      invert(0.9*grow*(1-back),1.0-0.62*grow);
      /* 门：0.46–0.56 打开；走出去（0.58–0.72）；回头（0.72–0.8）看门合上（0.8–0.86）、整扇门消失（0.86–0.92）；转回来（0.92–1） */
      var open=(0,$imports.cutPhase)(k,0.46,0.56)*(1-(0,$imports.cutPhase)(k,0.8,0.86));
      doors(d.cab,open);
      fadeCab(d.cab,1-(0,$imports.cutPhase)(k,0.86,0.92));
      var walk=(0,$imports.cutPhase)(k,0.58,0.72), look=(0,$imports.cutPhase)(k,0.72,0.8)*(1-(0,$imports.cutPhase)(k,0.92,1));
      var back0=-2.15;                                  /* 一开始站在轿厢靠里，门后 1.55 米，看得见门和门上的显示 */
      var s=(0,$imports.cutLerp)(back0,0,walk);
      var cx=b.x+f.x*s, cz=b.z+f.z*s;
      var a=b.ang+Math.PI*look;
      var sway=Math.sin(k*9)*0.012*shake()*(k>0.16&&k<0.46?1:0);
      var py=b.y+eye+sway, ly=b.y+eye-(k<0.5?0.05:0.18+0.12*(1-walk));
      if(k<0.12) ly=b.y+eye+0.42*(1-(0,$imports.cutPhase)(k,0.08,0.12));   /* 先抬头看那块显示 */
      (0,$imports.cutLook)(cx,py,cz, cx+Math.cos(a)*3,ly,cz+Math.sin(a)*3);
      (0,$imports.cutFade)(k<0.03?1-k/0.03:0);
    },
    clean:function(d){ clearOverlay(); }
  };

  /* ---------- 离开 ---------- */
  function exitOf(id){ for(var i=0;i<C.exits.length;i++) if(C.exits[i].id===id) return C.exits[i]; return C.exits[0]; }
  /* 回放时没有乘梯记录：换到教学楼二楼的电梯厅，站在门外背对电梯 */
  function replayHall(){
    var R=$imports.INTERIORS.teach2; if(!R) return;
    var f=$imports.Elevator.frame(R), q=$imports.Elevator.world(R,1.0,0);
    (0,$imports.doEnterRoom)(R.id,{x:q.x,y:q.y,ang:Math.atan2(f.oy,f.ox)});
  }
  function moveOut(d){
    if(d.moved) return; d.moved=1;
    if(P&&P.kind==='out'&&!P.moved){ P.moved=1; P.move(); }
    else if(!P) replayHall();
  }
  $imports.CUT_DEF.void_out={dur:OUT_DUR,
    setup:function(d){
      var e=exitOf(P&&P.id||'exit1'); d.e=e;
      d.door=(0,$imports.cutAdd)(new $imports.THREE.Group());
      /* 出口的暗门：盖在迷宫里那扇门前面的一块门板，推开时往门轴那边收窄（不穿进墙里），后面是一块越来越亮的蓝光 */
      var light=new $imports.THREE.Mesh(new $imports.THREE.PlaneGeometry(0.98,2.08),mat(0x0b0d10)); light.position.set(0,1.04,-0.024); d.door.add(light); d.light=light;
      var panel=new $imports.THREE.Mesh(new $imports.THREE.BoxGeometry(0.98,2.08,0.03),mat(0x15181c)); panel.position.set(0,1.04,0); d.door.add(panel); d.panel=panel;
      d.door.position.set(e.x-e.n[0]*0.02,e.h,e.z-e.n[1]*0.02); d.door.rotation.y=Math.atan2(e.n[0],e.n[1]);
      d.c0=new $imports.THREE.Color(0x0b0d10); d.c1=new $imports.THREE.Color(0xbfe4ff);
      d.snd={};
      invert(0,1); glow(0,'#000',0);
    },
    frame:function(k,d){
      var e=d.e, n={x:e.n[0],z:e.n[1]};
      if(k<0.44){
        /* 站在门前，推门：门往外开，门缝里的蓝光越来越亮，涌满画面 */
        var push=(0,$imports.cutPhase)(k,0.06,0.3), flood=(0,$imports.cutPhase)(k,0.12,0.4);
        var sw=Math.cos(1.2*push);
        d.panel.scale.x=Math.max(0.02,sw); d.panel.position.x=-0.49*(1-sw);
        d.light.material.color.copy(d.c0).lerp(d.c1,Math.min(1,push*1.4));
        if(k>0.06&&!d.snd.door){ d.snd.door=1; try{ $imports.SFX.door(); }catch(err){} }
        var dist=(0,$imports.cutLerp)(1.9,0.55,(0,$imports.cutPhase)(k,0,0.4));
        var cx=e.x+n.x*dist, cz=e.z+n.z*dist;
        (0,$imports.cutLook)(cx,e.h+$imports.EYE,cz, e.x,e.h+1.45,e.z);
        /* 蓝光涌进来；白从中心往外：先整屏白（0.34–0.44） */
        glow(0.85*flood,'radial-gradient(circle at 50% 50%, #eaf6ff 0%, #7fbfff 55%, #3d6fb0 100%)',0);
        (0,$imports.cutFade)(0);
        return;
      }
      if(!d.moved){ glow(1,'#eef6ff',0); moveOut(d); try{ (0,$imports.syncCamera)(0); }catch(err){} }
      /* 电梯厅：白从中心往外退（0.44–0.64），颜色复原；回头（0.62–0.8）；指示灯一格一格暗下去（0.78–0.96） */
      var R=$imports.INTERIORS[$imports.S.room], f=$imports.Elevator.frame(R);
      if(!d.hall&&R&&f){
        var p=(0,$imports.worldToScene)($imports.S.x,$imports.S.y,R), dc=$imports.Elevator.world(R,$imports.LIFT_GEO.landing+0.05,0), ds=(0,$imports.worldToScene)(dc.x,dc.y,R);
        d.hall={x:p.x,z:p.z,ang:$imports.S.ang,door:ds,f:{x:f.ox,z:f.oy},y:($imports.S.floorY||0)};
        /* 回头的同时往走廊里退一点（不撞墙），整扇门和门上的指示灯都在画面里；退到哪、朝哪，交还控制时人就在哪 */
        for(var ba=1.9;ba>=1.0;ba-=0.3){
          var bw=$imports.Elevator.world(R,ba,0);
          if(ba<=1.01||$imports.Collision.depth(bw.x,bw.y,$imports.PRAD)<1e-6){ var bs=(0,$imports.worldToScene)(bw.x,bw.y,R); d.hall.end={x:bw.x,y:bw.y,sx:bs.x,sz:bs.z,ang:$imports.S.ang+Math.PI}; break; }
        }
        var strip=new $imports.THREE.Group(); d.leds=[];
        for(var i=0;i<5;i++){ var m=new $imports.THREE.Mesh(new $imports.THREE.BoxGeometry(0.05,0.05,0.015),mat(0xffb04a)); m.position.set((i-2)*0.1,0,0); strip.add(m); d.leds.push(m); }
        strip.position.set(ds.x+f.ox*0.1,d.hall.y+2.42,ds.z+f.oy*0.1);   /* 贴在门上方那块楼层牌前面 */ strip.rotation.y=Math.atan2(f.ox,f.oy);
        d.strip=(0,$imports.cutAdd)(strip);
      }
      var recede=(0,$imports.cutPhase)(k,0.44,0.66);
      glow(1-recede,'#eef6ff',recede*0.75);
      if(!d.hall){ (0,$imports.cutFade)(0); return; }
      var h=d.hall, turn=(0,$imports.cutPhase)(k,0.62,0.8);
      var a=h.ang+Math.PI*turn, cx=(0,$imports.cutLerp)(h.x,h.end.sx,turn), cz=(0,$imports.cutLerp)(h.z,h.end.sz,turn);
      (0,$imports.cutLook)(cx,h.y+$imports.EYE,cz, cx+Math.cos(a)*3,h.y+$imports.EYE+0.3*turn,cz+Math.sin(a)*3);
      var gone=Math.floor((0,$imports.cutPhase)(k,0.78,0.96)*5.999);
      d.leds.forEach(function(m,i){ m.material.color.setHex(i<5-gone?0xffb04a:0x6a5a46); });
      if(k>0.78&&!d.snd.tick){ d.snd.tick=1; try{ $imports.SFX.blink(); }catch(err){} }
      (0,$imports.cutFade)(k>0.97?(k-0.97)/0.03*0.6:0);
    },
    clean:function(d){
      clearOverlay();
      if(P&&P.kind==='out'&&d.hall&&d.hall.end&&(0,$imports.cutPhase)($imports.CUT.t/$imports.CUT.dur,0.62,0.8)>0.5) P.end=d.hall.end;   /* 回过头了：交还时面朝电梯门 */
    }
  };

  function seen(id){ try{ if(!replaying()&&typeof $imports.DeathArchive!=='undefined') $imports.DeathArchive.markSeen(id); }catch(e){} }

  return {
    P:function(){ return P; },
    /* 进入：调用前人已经在迷宫起点（并存过档）。没有过场系统时返回 false，由调用方照旧说那句话 */
    enter:function(floor,say){
      if(typeof $imports.playCut!=='function'||!$imports.CUT_DEF.void_in) return false;
      P={kind:'in',floor:floor};
      var shown=$imports.CUT.enabled;                       /* 回归测试关掉过场时不算看过 */
      (0,$imports.playCut)('void_in',function(){
        P=null; clearOverlay();
        if($imports.S.screen==='cut') $imports.S.screen='play';     /* playCut 不管还给谁；这里直接回到游玩 */
        if(shown) seen('cut:void_in');
        try{ (0,$imports.syncCamera)(0); }catch(e){}
        if(say) say();
      });
      return true;
    },
    /* 离开：move 是真正的换场（只执行一次），say 是之后那句话 */
    leave:function(id,move,say){
      if(typeof $imports.playCut!=='function'||!$imports.CUT_DEF.void_out) return false;
      P={kind:'out',id:id,move:move,moved:false};
      var shown=$imports.CUT.enabled;
      (0,$imports.playCut)('void_out',function(){
        var p=P; P=null; clearOverlay();
        if($imports.S.screen==='cut') $imports.S.screen='play';
        if(p&&!p.moved){ p.moved=true; p.move(); }
        if(p&&p.end&&$imports.S.mode==='in'){ $imports.S.x=p.end.x; $imports.S.y=p.end.y; $imports.S.ang=p.end.ang; $imports.S.pitch=0; }
        if(shown) seen('cut:void_out');
        try{ (0,$imports.syncCamera)(0); }catch(e){}
        if(say) say();
      });
      return true;
    }
  };
})();

/* @module-exports */
GameModules.publish("game3d/js/modules/void-maze/maze-cut.js",{
"VoidCut":{get:function(){return VoidCut;},set:function($value){VoidCut=$value;}}
});
})(GameModules.imports("game3d/js/modules/void-maze/maze-cut.js"));
