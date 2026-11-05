/* @module-capsule */
(function($imports){
/* 里世界 3D · 翻越、受伤与校园坠落（计划《校园直通、翻越受伤与国际交流》第 6 节、Q6 真人确认）
   · 翻越点：教学楼天台四周的女儿墙（外侧悬空，翻过去就是从楼顶掉下去）、两条连廊两侧的栏杆（外侧悬空，下面是一层楼高的地面）。
     看着栏杆、站在一臂之内：提示「翻过栏杆 · 外侧悬空」。按住空格 0.6 秒，或按 E 再确认一次，才会翻；松开就取消。
     开始翻时扣 8 点体力（不够翻不动）；重伤翻不动；不加自由跳跃。
   · 下落：镜头往下坠（模拟步里推进），天台 → 致命坠落「中国人能飞」（campus_fall，专属死亡演出在 fall-death.js；药丸／免疫挡下时回到翻越前的地方）；
     连廊 → 落在连廊下面的室外地上，受伤 +45。
   · 伤势 injury 0–100（RT.body.injury，跟存档走）：0–24 擦伤（脱离危险、站着不动 20 秒后每秒回 1）；25–59 受伤（走跑 ×0.9）；
     60–99 重伤（步行 ×0.8，不能跑、不能翻）；体力上限 − 伤势 × 0.4（Q5「体力上限与受伤挂钩」，实施取值）。100 走 kill 保护链。
   · 急救包：用 4 秒（动了、被锁定就中断，不消耗），伤势 −40。行政楼一楼西头第一间办公室是医务室（Q6），墙上药柜每天能取一个。 */
'use strict';

var BODY_CFG={vaultHold:0.6,vaultCost:8,linkInjury:45,fallRoof:1.3,fallLink:0.9,medkit:40,medkitTime:4,restAfter:20,restRate:1,
  slow:[[60,0.8],[25,0.9]],noRun:60,stamPer:0.4,clinic:{room:'admin1',c:6.0,r:15.85}};
var Body=(function(){
  var own={owner:'body'}, C=BODY_CFG;
  function st(){ var s=$imports.RT.body; if(!s||typeof s!=='object') s=$imports.RT.body={injury:0,restT:0,treat:null,fall:null,medDay:{},hold:0}; s.medDay=s.medDay||{}; return s; }
  function injury(){ return st().injury||0; }
  function hurt(n,why){
    var s=st(); s.injury=Math.max(0,Math.min(100,s.injury+n)); s.restT=0;
    try{ $imports.VisualState.hurt=Math.min(0.8,($imports.VisualState.hurt||0)+0.5); }catch(e){}
    (0,$imports.gameFact)('injury',{amount:n,total:s.injury,source:why});
    if(s.injury>=100) (0,$imports.kill)('我摔得太重，爬不起来了。','campus_fall','campus_fall');
  }
  /* ---------- 翻越点 ---------- */
  function target(){
    if($imports.S.mode!=='in'||$imports.S.seated||$imports.HIDE.on) return null;
    var R=$imports.INTERIORS[$imports.S.room]; if(!R) return null;
    var kind=R.id==='teach6'?'roof':(R.host==='c1'||R.host==='c2')?'link':null; if(!kind) return null;
    var fx=Math.cos($imports.S.ang), fy=Math.sin($imports.S.ang), d=0.85*R.tw;
    var x=$imports.S.x+fx*d, y=$imports.S.y+fy*d, c=Math.floor((x-R.ox)/R.tw), r=Math.floor((y-R.oy)/R.th), ch=(R.grid[r]||[])[c];
    if(ch!=='#') return null;
    var edge=kind==='roof'?(r===0||r===R.rows-1||c===0||c===R.cols-1):(c===0||c===R.cols-1);
    if(!edge) return null;
    return {kind:kind,room:R.id,side:c===0?-1:c===R.cols-1?1:0,c:c,r:r};
  }
  function canVault(){
    if(injury()>=C.noRun){ (0,$imports.os)('我：腿使不上劲，翻不过去。',2.2); return false; }
    if(($imports.S.stam||0)<C.vaultCost){ (0,$imports.os)('我：喘不过气来，先歇一下。',2); return false; }
    return true;
  }
  function vault(t){
    if(!t||!canVault()) return false;
    var s=st();
    $imports.PlayerStats.changeStamina(-C.vaultCost,'vault',{min:0});
    s.fall={kind:t.kind,room:t.room,side:t.side,t:0,from:{x:$imports.S.x,y:$imports.S.y,ang:$imports.S.ang}};
    s.hold=0;
    (0,$imports.gameFact)('vault',{what:'start',kind:t.kind});
    return true;
  }
  GameModules.on('hint',function(){ var t=target(); return t?'翻过栏杆 · 外侧悬空（按住空格）':undefined; },own);
  GameModules.on('interact',function(){
    var t=target(); if(!t) return undefined;
    $imports.UI.choice(t.kind==='roof'?'栏杆外面什么都没有。往下看，是很远的地面。':'栏杆外面悬空，下面是一层楼高的地面。',[
      {label:'翻过去',fn:function(){ $imports.UI.closeChoice(); vault(target()||t); }},
      {label:'算了',fn:function(){ $imports.UI.closeChoice(); }}
    ]);
    return true;
  },own);
  /* ---------- 移动的限制 ---------- */
  GameModules.on('moveSpeedMul',function(){ var n=injury(); for(var i=0;i<C.slow.length;i++) if(n>=C.slow[i][0]) return C.slow[i][1]; return undefined; },own);
  GameModules.on('runBlocked',function(){ return injury()>=C.noRun?true:undefined; },own);
  GameModules.on('ownsPlayerInput',function(){ var s=st(); return s.fall||s.treat?true:undefined; },own);
  /* ---------- 模拟步 ---------- */
  function landOutside(f){
    var R=$imports.INTERIORS[f.room], o=(R&&$imports.OBJ.filter(function(x){ return x.id===R.host; })[0])||null;
    (0,$imports.doExitRoom)();
    if(o){
      var cx=(o.x+o.w/2)*$imports.SC, cy=(o.y+o.h/2)*$imports.SC, off=(o.w/2+5)*$imports.SC*(f.side||1);
      for(var k=0;k<12;k++){ var x=cx+off+(k%3-1)*6, y=cy+(Math.floor(k/3)-1.5)*10; if((0,$imports.canStand)(x,y)){ $imports.S.x=x; $imports.S.y=y; break; } }
    }
    $imports.S.floorY=0; try{ (0,$imports.syncCamera)(0); }catch(e){}
  }
  GameModules.on('tick',function(dt){
    if(!(dt>0)||$imports.S.dead||$imports.S.screen!=='play') return;
    var s=st();
    /* 按住空格翻越 */
    var t=!s.fall&&!s.treat?target():null;
    if(t&&$imports.KEY&&$imports.KEY[' ']){ s.hold+=dt; if(s.hold>=C.vaultHold) vault(t); } else s.hold=0;
    /* 下落 */
    if(s.fall){
      var f=s.fall, dur=f.kind==='roof'?C.fallRoof:C.fallLink; f.t+=dt;
      $imports.S.eyeLift=-Math.min(f.kind==='roof'?8:3.2,f.t*f.t*4.9);
      if(f.t>=dur){
        $imports.S.eyeLift=0; s.fall=null;
        if(f.kind==='roof'){
          (0,$imports.kill)('手离开了栏杆。楼下的地面一下子近了。','campus_fall','campus_fall');
          if(!$imports.S.dead){ $imports.S.x=f.from.x; $imports.S.y=f.from.y; $imports.S.ang=f.from.ang+Math.PI; try{ (0,$imports.syncCamera)(0); }catch(e){} }   /* 被救回：回到翻越前的地方，背对栏杆 */
        }else{
          landOutside(f); hurt(C.linkInjury,'fall');
          if(!$imports.S.dead){ (0,$imports.os)('我：我摔在地上。腿一阵剧痛，还能走。',3.4,$imports.OS_FORCE); (0,$imports.gameFact)('vault',{what:'landed',kind:'link'}); }
        }
      }
      return;
    }
    /* 急救包 */
    if(s.treat){
      if($imports.S.moving||($imports.PAT&&$imports.PAT.locked)){ s.treat=null; (0,$imports.os)('我：包扎到一半被打断了。',2); return; }
      s.treat.t+=dt;
      if(s.treat.t>=C.medkitTime){ s.treat=null; (0,$imports.removeItem)('medkit'); var before=s.injury; s.injury=Math.max(0,s.injury-C.medkit);
        (0,$imports.gameFact)('treated',{from:before,to:s.injury}); (0,$imports.os)('我：包扎好了。'+(s.injury>=25?'还疼，但能走了。':'好多了。'),2.6); }
      return;
    }
    /* 擦伤：站着不动、没有危险，20 秒后慢慢好 */
    if(s.injury>0&&s.injury<25){
      var safe=!$imports.S.moving&&!($imports.PAT&&$imports.PAT.locked)&&!$imports.AN.active;
      s.restT=safe?s.restT+dt:0;
      if(s.restT>=C.restAfter) s.injury=Math.max(0,s.injury-C.restRate*dt);
    }
    /* 体力上限跟着伤势降 */
    if(s.injury>0){ var cap=$imports.PlayerStats.staminaMax()-s.injury*C.stamPer; if($imports.S.stam>cap) $imports.PlayerStats.setStamina(Math.max(0,cap),'injury'); }
  },own);
  GameModules.on('itemUse',function(id){
    if(id!=='medkit') return undefined;
    var s=st(); if(s.injury<=0){ (0,$imports.os)('我：我没有受伤。',1.8); return true; }
    if(s.treat) return true;
    s.treat={t:0}; (0,$imports.os)('我：我蹲下来包扎。（4 秒，别动）',2.4); return true;
  },own);
  /* ---------- 医务室的药柜 ---------- */
  function nearClinic(){ var R=$imports.INTERIORS[C.clinic.room]; return !!R&&$imports.S.mode==='in'&&$imports.S.room===C.clinic.room&&Math.hypot($imports.S.x-(R.ox+C.clinic.c*R.tw),$imports.S.y-(R.oy+C.clinic.r*R.th))<1.3*R.tw; }
  GameModules.on('hint',function(){ return nearClinic()?'医务室的药柜':undefined; },own);
  GameModules.on('interact',function(){
    if(!nearClinic()) return undefined;
    var s=st(); if(s.medDay[$imports.S.day]){ (0,$imports.os)('我：药柜里今天的急救包已经拿过了。',2.2); return true; }
    if(!(0,$imports.addItem)('medkit')){ (0,$imports.os)('我：背包满了。',1.8); return true; }
    s.medDay[$imports.S.day]=1; (0,$imports.os)('我：药柜里有一个急救包。',2.2); return true;
  },own);
  /* 表现：药柜和门牌（只读） */
  var F={grp:null,key:''};
  function clearFx(){ if(F.grp){ if(F.grp.parent) F.grp.parent.remove(F.grp); try{ $imports.ThreeBackend.disposeGroup(F.grp); }catch(e){} } F.grp=null; F.key=''; }
  GameModules.on('frame',function(){
    var on=$imports.S.mode==='in'&&$imports.S.room===C.clinic.room&&$imports.GLR.scene&&$imports.GLR.roomMesh;
    var key=on?$imports.GLR.roomMesh.uuid:''; if(key===F.key) return; clearFx(); if(!key) return;
    var T=$imports.THREE, R=$imports.INTERIORS[C.clinic.room], g=new T.Group(); g.name='clinic';
    var p=(0,$imports.worldToScene)(R.ox+C.clinic.c*R.tw,R.oy+16*R.th,R);
    var cab=new T.Mesh(new T.BoxGeometry(0.6,0.7,0.22),new T.MeshLambertMaterial({color:0xeef0ee,emissive:0x2c2e2c})); cab.position.set(p.x,1.55,p.z-0.12); g.add(cab);
    var red=new T.MeshBasicMaterial({color:0xc02a2a,fog:false});
    var a=new T.Mesh(new T.BoxGeometry(0.2,0.06,0.01),red); a.position.set(p.x,1.6,p.z-0.235); g.add(a);
    var b=new T.Mesh(new T.BoxGeometry(0.06,0.2,0.01),red); b.position.set(p.x,1.6,p.z-0.235); g.add(b);
    $imports.GLR.scene.add(g); F.grp=g; F.key=key;
  },own);
  GameModules.on('clearWorld',clearFx,own);
  GameModules.on('boundary',clearFx,own);
  GameModules.on('newGame',function(){ $imports.RT.body=null; },own);
  if(typeof $imports.ITEMS!=='undefined'&&!$imports.ITEMS.medkit) $imports.ITEMS.medkit={n:'急救包',d:'绷带、碘伏和一卷胶布。包扎要蹲下来 4 秒，别动。'};
  if(typeof $imports.DEATH_SOURCES!=='undefined') $imports.DEATH_SOURCES.campus_fall={cause:'从楼上翻过栏杆，掉了下去。',hint:'「外侧悬空」的栏杆翻过去就是往下掉；天台的栏杆外面什么都没有。'};
  if(typeof $imports.DEATH_HINTS!=='undefined') $imports.DEATH_HINTS.campus_fall='天台栏杆外面什么都没有。';
  return {CFG:C, state:st, injury:injury, hurt:hurt, target:target, vault:vault};
})();

/* @module-exports */
GameModules.publish("game3d/js/modules/body/injury.js",{
"BODY_CFG":{get:function(){return BODY_CFG;},set:function($value){BODY_CFG=$value;}},
"Body":{get:function(){return Body;},set:function($value){Body=$value;}}
});
})(GameModules.imports("game3d/js/modules/body/injury.js"));
