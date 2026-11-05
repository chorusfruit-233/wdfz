/* 里世界 3D · 自带 DLC「规则怪谈」（计划《规则怪谈、纸飞机与窗内视线》第 4、10、11 节，M1／M6 首版）
   默认关着；暂停菜单「DLC 与模块」→ 自带的 DLC → 打开 → 刷新，之后的新局生效（本局的规则跟存档走）。
   · 全校十处载体（纸飞机内页、窗框标签、桌沿铅笔字、学生证背面、宿舍床板、食堂收据、电脑便笺、连廊检修牌、借书卡、值日表）上写着规则：
     有真的、假的、半真半假的。界面不标真假；读过的原文记进手册，可以自己标「可信／存疑」。另有几处证据（脚印、擦掉的画、缺席记录、门禁记录）。
   · 三个小切片：
     R05 宿舍敲门：熄灯后在宿舍，门外敲三下、问「在吗？查寝。」——应声会死（rules_knock「门外有你的名字」）；不出声就过去了。
     R06 多出来的餐券：饭点在食堂，托盘上多一张餐券——收下扣 5 SAN；原样放回没事；饭点过后托盘收走了，后半句不成立。
     R10 借用名字：上课时有人点你的名字，不是老师的声音——答应扣 5 SAN；不答应没事（但这句话管不了学生会检查）。
   · 记录：DLC 自己的记录存在本机（wdfz3d_rules_records_v1），不混进本体成就；本体成就照「启用 DLC 的局」规则处理。
   内部答案（真假）只写在计划和这份代码里，不进玩家 Wiki。 */
GameModules.mod({
  id:'campus-rules',
  name:'规则怪谈',
  version:'1.0.0',
  author:'wdfz',
  api:'1.0',
  desc:'校园里会出现一些相互矛盾的文字，部分会影响你的行动。新局生效。',
  init:function(api){
    var REC_KEY='wdfz3d_rules_records_v1';
    /* t：真 true／假 false／半真 half。where：载体放在哪（room、格子字符、第几个） */
    var RULES=[
      {id:'R01',carrier:'纸飞机内页',text:'有两次敲窗声的纸，要从来时那扇窗回去。\n不要让它在墙上留下折痕。',t:'true'},
      {id:'R02',carrier:'窗框内侧的标签',text:'听见窗后呼吸，低头退到立柱后。\n不要确认是谁。',t:'true',where:{room:'admin2',win:2}},
      {id:'R03',carrier:'桌沿的铅笔字',text:'看见它以后，低头就行。\n走开前一定要回头确认。',t:'half',where:{room:'teach2',ch:'P',k:0}},
      {id:'R04',carrier:'学生证背面的小纸条',text:'带着这张卡，检查时站在走廊也算在座。',t:'false',where:{room:'canteen1',ch:'t',k:6}},
      {id:'R05',carrier:'宿舍床板上的刻字',text:'熄灯后的第三声敲门不是来查寝的。\n请不要替上铺答应。',t:'true',where:{room:'dorm1',ch:'b',k:0}},
      {id:'R06',carrier:'食堂收据背面',text:'多出来的那份不是赠送。原样放回托盘即可；\n食堂关门以后也一样。',t:'half',where:{room:'canteen1',ch:'t',k:12}},
      {id:'R07',carrier:'电脑边的便笺',text:'没有信号的手机最安全，不可能告诉它你在哪。',t:'false',where:{room:'lab3',ch:'n',k:0}},
      {id:'R08',carrier:'连廊检修牌',text:'接到来历不明的纸，先找窗号。\n看不清来处时不要替别人寄。',t:'true',where:{room:'link2',ch:'.',k:4}},
      {id:'R09',carrier:'借书卡里夹的纸',text:'所有手写字都是假的。',t:'false',where:{room:'admin3',ch:'d',k:3}},
      {id:'R10',carrier:'值日表边上的字',text:'不答应的名字，不会算到你头上。\n检查开始时也可以不答应。',t:'half',where:{room:'teach3',ch:'P',k:0}}
    ];
    var EVID=[
      {id:'E02',rule:'R02',text:'走廊地上有一串很低的退行脚印，一直退到立柱后面。',where:{room:'admin2',ch:'.',k:120}},
      {id:'E03',rule:'R03',text:'桌面另一半被擦掉了，隐约能看出很多只重复画的眼睛——最后一只是从背后画的。',where:{room:'teach2',ch:'.',k:260}},
      {id:'E04',rule:'R04',text:'保安岗的缺席记录：持卡站在走廊的，一律记「缺」。',where:{room:'guard1',ch:'.',k:3}},
      {id:'E07',rule:'R07',text:'机房的终端记录：位置报告「已发送」，后面没有「已撤回」。',where:{room:'lab3',ch:'n',k:3}}
    ];
    var st=null;
    function fresh(){ return {on:0,v:1,read:{},marks:{},knock:{},ticket:{},name:{},nameAt:null}; }
    function S_(){ if(!st) st=fresh(); return st; }
    api.store({ save:function(){ return st; }, load:function(d){ st=d&&typeof d==='object'?Object.assign(fresh(),d):fresh(); }, reset:function(){ st=fresh(); } });
    api.on('newGame',function(){ st=fresh(); st.on=1; RT.rulesMode={v:1}; });
    function on(){ return !!(S_().on||(RT.rulesMode&&RT.rulesMode.v)); }
    function rec(k){ try{ var r=JSON.parse(localStorage.getItem(REC_KEY)||'{}'); if(!r[k]){ r[k]=Date.now(); localStorage.setItem(REC_KEY,JSON.stringify(r)); toast('【规则怪谈】记录：'+({knock:'没有人答应',reply:'门外的声音',sources:'字写在哪里',ticket:'原样放回'}[k]||k)); } }catch(e){} }
    function toast(t){ try{ api.toast(t); }catch(e){} }
    /* ---------- 载体的位置 ---------- */
    var POS={};
    function cellOf(w){
      var R=INTERIORS[w.room]; if(!R) return null;
      if(w.win!==undefined&&typeof WindowGaze!=='undefined'){ var ws=WindowGaze.windows(R), x=ws[Math.min(w.win,ws.length-1)]; if(!x) return null;
        return {room:w.room,x:x.x,y:x.y+x.nz*R.th*0.45,h:1.5}; }
      var n=0; for(var r=0;r<R.rows;r++) for(var c=0;c<R.cols;c++) if(R.grid[r][c]===w.ch){ if(n===w.k) return {room:w.room,x:R.ox+(c+0.5)*R.tw,y:R.oy+(r+0.5)*R.th,h:w.ch==='.'?0.03:w.ch==='b'?0.62:0.8}; n++; }
      return null;
    }
    function spots(){ var list=[]; RULES.concat(EVID).forEach(function(x){ if(!x.where) return; var p=POS[x.id]||(POS[x.id]=cellOf(x.where)); if(p) list.push({item:x,p:p}); }); return list; }
    function near(){
      if(!on()||S.mode!=='in') return null;
      var best=null,bd=1e9; spots().forEach(function(o){ if(o.p.room!==S.room) return; var R=INTERIORS[S.room], d=Math.hypot(S.x-o.p.x,S.y-o.p.y)/R.tw; if(d<1.35&&d<bd){ bd=d; best=o; } });
      return best;
    }
    function readRule(x){
      var s=S_(), first=!s.read[x.id]; s.read[x.id]=1;
      var isEv=!!x.rule;
      try{ Investigation.record('rule_'+x.id,(isEv?'':x.carrier+'：')+'「'+x.text.replace(/\n/g,'')+'」',isEv?'线索':'规则',(INTERIORS[S.room]||{}).name||''); }catch(e){}
      try{ gameFact('ruleObserved',{id:x.id,evidence:isEv}); }catch(e){}
      if(Object.keys(s.read).filter(function(k){ return k[0]==='R'; }).length>=5) rec('sources');
      if(isEv){ os('我：'+x.text,4.4,OS_FORCE); return; }
      UI.choice(x.carrier+'上写着：\n「'+x.text+'」'+(s.marks[x.id]?'\n（我标过：'+s.marks[x.id]+'）':''),[
        {label:'记为可信',fn:function(){ UI.closeChoice(); s.marks[x.id]='可信'; }},
        {label:'记为存疑',fn:function(){ UI.closeChoice(); s.marks[x.id]='存疑'; }},
        {label:'先不标',fn:function(){ UI.closeChoice(); }}
      ]);
    }
    api.on('hint',function(){ var o=near(); if(!o) return undefined; return o.item.rule?'仔细看看':o.item.carrier; });
    api.on('interact',function(){ var o=near(); if(!o) return undefined; readRule(o.item); return true; });
    /* 危险纸飞机的内页换成规则（R01） */
    api.on('paperText',function(kind){ if(!on()||kind!=='danger') return undefined; S_().read.R01=1; return '两次拍窗以后，纸从哪里来就回哪里去。返程不能碰墙。\n若字看不清，贴近玻璃再念一次。'; });
    /* ---------- 切片 ---------- */
    function day(){ return S.day; }
    function nightKey(){ return Math.floor((gameClock()-1000)/1440); }
    api.on('tick',function(dt){
      if(!on()||!(dt>0)||S.dead||S.screen!=='play'||UI.chooseOpen) return;
      var s=S_(), R=S.mode==='in'?INTERIORS[S.room]:null;
      /* R05 宿舍敲门：熄灯后在宿舍待满 8 秒，每晚一次 */
      if(R&&(R.host==='dormN'||R.host==='dormS')&&S.tsec>=LIGHTS_OUT){
        var nk=nightKey(); s.knockT=(s.knockT||0)+dt;
        if(!s.knock[nk]&&s.knockT>=8){ s.knock[nk]=1; knock(); }
      }else s.knockT=0;
      /* R06 多出来的餐券：饭点在食堂，每天一次 */
      if(R&&R.id==='canteen1'&&typeof mealNow==='function'&&mealNow()&&!s.ticket[day()]){ s.ticket[day()]=1; ticket(); }
      /* R10 借用名字：上课时在教学楼，每天一次，进教学楼后过一会儿 */
      if(R&&R.host==='teach'&&periodAt(S.tsec)[3]==='教室'&&!s.name[day()]){ s.nameT=(s.nameT||0)+dt; if(s.nameT>=25){ s.name[day()]=1; s.nameT=0; borrowed(); } }
    });
    function knock(){
      os('（门外敲了一下。）',1.6,OS_FORCE);
      Lifecycle.scope('scene').timeout(function(){ os('（又敲了一下。）',1.6,OS_FORCE); },1800);
      Lifecycle.scope('scene').timeout(function(){
        if(S.dead||S.screen!=='play') return;
        os('（第三下。）',1.4,OS_FORCE);
        UI.choice('门外有人问：「在吗？查寝。」',[
          {label:'应一声「在」',fn:function(){ UI.closeChoice(); rec('reply'); try{ gameFact('ruleResolved',{id:'R05',ok:false}); }catch(e){} kill('门外的人用我的声音，又说了一遍「在」。','rules_knock','rules_knock'); }},
          {label:'不出声',fn:function(){ UI.closeChoice(); rec('knock'); try{ gameFact('ruleResolved',{id:'R05',ok:true}); }catch(e){} os('我：我没有出声。敲门声停了。过了很久，走廊里也没有脚步声。',4); }}
        ]);
      },3600);
    }
    function ticket(){
      UI.choice('托盘上多了一张餐券。没人看着这边。',[
        {label:'原样放回托盘',fn:function(){ UI.closeChoice(); rec('ticket'); try{ gameFact('ruleResolved',{id:'R06',ok:true}); }catch(e){} os('我：我把餐券放回去。窗口里的人看了一眼，把它收走了。',3); }},
        {label:'收下',fn:function(){ UI.closeChoice(); PlayerStats.changeSan(-5,'rules',{min:0}); try{ gameFact('ruleResolved',{id:'R06',ok:false}); }catch(e){} os('我：我把餐券塞进口袋。口袋里一下子沉了，像装了一块湿的东西。',3.6); }}
      ]);
    }
    function borrowed(){
      UI.choice('有人在点名。点到的是我的名字——但不是老师的声音。',[
        {label:'答应',fn:function(){ UI.closeChoice(); PlayerStats.changeSan(-5,'rules',{min:0}); try{ gameFact('ruleResolved',{id:'R10',ok:false}); }catch(e){} os('我：「到。」整间教室的人一起回头看我。',3.4); }},
        {label:'不答应',fn:function(){ UI.closeChoice(); try{ gameFact('ruleResolved',{id:'R10',ok:true}); }catch(e){} os('我：我没有出声。那个声音又念了一遍，然后念了下一个名字。',3.4); }}
      ]);
    }
    /* ---------- 表现：载体上的小纸片（只读） ---------- */
    var F={grp:null,key:''};
    function clearFx(){ if(F.grp){ if(F.grp.parent) F.grp.parent.remove(F.grp); try{ ThreeBackend.disposeGroup(F.grp); }catch(e){} } F.grp=null; F.key=''; }
    api.on('frame',function(){
      var R=on()&&S.mode==='in'&&GLR.scene&&GLR.roomMesh?INTERIORS[S.room]:null, key=R?S.room+':'+GLR.roomMesh.uuid:'';
      if(key===F.key) return; clearFx(); if(!key) return;
      var g=new THREE.Group(); g.name='campus-rules'; var m=new THREE.MeshLambertMaterial({color:0xf2eee2,emissive:0x3a3830,side:THREE.DoubleSide});
      spots().forEach(function(o){ if(o.p.room!==S.room) return; var p=worldToScene(o.p.x,o.p.y,R), q=new THREE.Mesh(new THREE.PlaneGeometry(0.16,0.11),m);
        if(o.p.h<0.1||o.p.h<1){ q.rotation.x=-Math.PI/2; q.rotation.z=0.4; } q.position.set(p.x,o.p.h+0.012,p.z); g.add(q); });
      GLR.scene.add(g); F.grp=g; F.key=key;
    });
    api.on('clearWorld',clearFx); api.on('boundary',clearFx);
    /* ---------- 「门外有你的名字」死亡演出（rules_knock，约 7 秒） ---------- */
    if(typeof DeathCG!=='undefined'&&DeathCG.register){
      var U=DeathCG.kit, ss=U.ss, mat=U.mat;
      DeathCG.register('rules_knock',{
        build:function(c){
          c.hideWorld(); var fl=c.mesh(new THREE.PlaneGeometry(4,4),mat(0x191b1c),0,0.002,1); fl.rotation.x=-Math.PI/2;
          c.box(4,3,0.1,0x3a3f40,undefined,0,1.5,2.0); c.door=c.box(0.9,2.05,0.05,0x4c3e30,undefined,0,1.03,1.95);
          c.gap=c.box(0.88,0.02,0.01,0xcfc8b0,undefined,0,0.01,1.92,{fog:false});
          c.feet=[c.box(0.1,0.05,0.22,0x15181a,undefined,-0.1,0.025,2.1),c.box(0.1,0.05,0.22,0x15181a,undefined,0.1,0.025,2.1)];
          c.plate=c.box(0.3,0.1,0.01,0xe8e2cc,undefined,0,1.75,1.92,{fog:false}); c.ink=c.box(0.02,0.05,0.012,0x101010,undefined,-0.12,1.75,1.915);
          c.veil(0x000000);
        },
        update:function(c,k,view){
          c.cue('a',k,0.3,function(){ os('门外：「在。」——是我的声音。',2.6,OS_FORCE); });
          c.feet.forEach(function(f){ f.visible=k>2.0; });
          c.ink.scale.x=1+11*ss(k,4.0,5.6); c.ink.position.x=-0.12+0.11*ss(k,4.0,5.6);
          var look=k<2.0?-0.05:k<4.0?-0.55*ss(k,2.0,2.8):0.12*ss(k,4.0,4.6);
          c.cam(view,k,0,look,k<2.0?-0.5:0); c.shade(0.2+0.75*ss(k,5.8,7.0));
          c.cue('b',k,4.2,function(){ os('门牌上的名字，被人又描了一遍。',3,OS_FORCE); });
        }
      });
      try{ DeathTimeline.define('rules_knock',7); }catch(e){}
    }
    if(typeof DEATH_SOURCES!=='undefined') DEATH_SOURCES.rules_knock={cause:'熄灯后门外敲了三下，我应了一声。',hint:'规则怪谈：门外的敲门声，不一定是来查寝的。'};
    if(typeof DEATH_HINTS!=='undefined') DEATH_HINTS.rules_knock='别替门外的人答应。';
    window.CampusRules={RULES:RULES,EVID:EVID,state:S_,on:on,near:near,spots:spots,knock:knock,ticket:ticket,borrowed:borrowed};
  }
});
