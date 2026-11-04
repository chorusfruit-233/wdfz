/* @module-capsule */
(function($imports){
/* 天赋：唯一的定义源和有限的能力接口（《天赋系统重构》M1）。
   名称、效果、限制、可选资格和试验数值都在这里；各模块只问「能不能 / 用什么方式 / 倍率多少」，不再各写一份 S.talent==='…'。
   S.talent 是当前 ID 的唯一来源；S.talentState 记规则版本、一次性消耗、计数和提醒去重，随存档保存。
   规则版本：1 = 重构前效果；2 = 试验效果；3 = 移除铁胃；4 = 加入顺风耳（2026-11-04）。其余旧天赋保留原规则。 */
'use strict';

var TALENT_RULES=4;
var TALENT_DEF={
  tech:{n:'科技党',pick:true,role:'随身带着一部旧手机。',does:'开局拥有满电手机。',v2:'',limit:'所有手机耗电永久翻倍；接入网络与服务器谜题仍需完成。',tags:['手机','服务器路线']},
  code:{n:'编程社',pick:true,role:'在电脑社团泡过三年。',
    does:'不带 U 盘也能直接操作网络中心的门禁终端。',
    v2:'西小门第一次答错时会对照后台核一遍，那一次不会受惊（仍然换题）。',
    limit:'不开机房的门锁，仍须通过实体终端或联网手机完成数据同步；闸机三道题还是要自己答对。',tags:['白名单路线','电子设备']},
  drive:{n:'车感好',pick:true,role:'家里人教过开车，也偷偷学过搭线。',
    does:'没有车钥匙也能在车库试着搭线启动。',
    v2:'搭线要蹲在车门边 4.8 秒（用钥匙 1.6 秒）；有钥匙时优先用钥匙。',
    limit:'车库的黑影照样会靠近，错车照样打不着，之后还要自己把车开出去。',tags:['车辆路线']},
  night:{n:'暗处适应',pick:true,old:'夜视',role:'从小怕黑，后来习惯了。',
    does:'在车库和熄灯后的室外，更能坚持。',
    v2:'',
    limit:'不会让暗处变亮——看不清的还是看不清，手电还是要带；黑影贴近、异象伤害照常。',tags:['车库','夜间']},
  watch:{n:'守时',pick:true,old:'秒表',role:'手腕上一直戴着一块旧表。',
    does:'不用找手表也能看到分钟时钟。',
    v2:'开饭、饭点结束和熄灯前会看一眼表，提醒一次。',
    limit:'只显示到分钟；不预告异象，也不替你请假。',tags:['时间']},
  immune:{n:'天生免疫',pick:true,role:'运气一直好得过分。',
    does:'每局一次：要命的事被绕开，能缓过气来，暂时摆脱过分的注意。',
    v2:'',
    limit:'只有一次，用掉不会再回来；身上有不知名药丸时先用药丸。',tags:['生存']},
  /* 顺风耳（2026-11-04，计划《电梯直通、新天赋、新结局与恐怖氛围》第 3 节）：补回铁胃删掉后的第 7 项 */
  ear:{n:'顺风耳',pick:true,role:'宿舍里谁翻个身，你都会醒。',
    does:'巡察者的脚步、门轴和远处的异响，在更远处就能听到（可闻距离 ×1.5），还分得出是楼上还是楼下；声音字幕多一档「很远」。',
    v2:'',
    limit:'假威胁也听得一清二楚：远处的动静来得更勤，大多什么也不会来。不分真假，不预告异象，不改变巡察者和异象的规则；关掉声音时，字幕给出同样多的信息。',tags:['声音','巡察者']},
  /* 旧档里的六项：名字保留，目前没有额外作用，新局不会出现 */
  map:{n:'过目不忘',legacy:true}, hand:{n:'手稳',legacy:true}, thin:{n:'瘦小',legacy:true},
  cold:{n:'血冷',legacy:true}, known:{n:'熟人',legacy:true}, crowd:{n:'藏在人群里',legacy:true},
  none:{n:'没有天赋',internal:true}
};
/* 兼容旧代码：TALENTS[id].n / .d，可选池由定义生成，不另维护一份 */
var TALENTS={}, TAL_KEYS=[];
Object.keys(TALENT_DEF).forEach(function(id){
  var d=TALENT_DEF[id]; if(d.internal) return;
  TALENTS[id]={n:d.n,d:d.legacy?'旧版特性，目前没有额外作用。':d.does};
  if(d.pick) TAL_KEYS.push(id);
});
/* 试验数值（规则版本 2 起生效） */
var TALENT_CFG={hotwireSec:4.8,keySec:1.6,feastNormal:9,darkMul:0.55,watchLead:20,earRange:1.5,earDread:0.8,earFar:18};

var Talent={
  def:function(id){ return TALENT_DEF[id]||TALENT_DEF.none; },
  id:function(){ var d=TALENT_DEF[$imports.S.talent]; return d?$imports.S.talent:'none'; },
  has:function(id){ return $imports.S.talent===id&&!!TALENT_DEF[id]&&!TALENT_DEF[id].legacy; },
  /* 规范化的状态：只允许定义里的键；非法值裁剪 */
  state:function(){
    var t=$imports.S.talentState;
    if(!t||typeof t!=='object'||Array.isArray(t)) t=$imports.S.talentState={};
    t.schemaVersion=1;
    t.rulesVersion=([1,2,3,4].includes(t.rulesVersion))?t.rulesVersion:1;
    t.origin=['selected','random','legacy','repair'].indexOf(t.origin)>=0?t.origin:'legacy';
    if(!t.consumed||typeof t.consumed!=='object'||Array.isArray(t.consumed)) t.consumed={};
    t.consumed={fatalProtection:!!t.consumed.fatalProtection,faceRemedy:!!t.consumed.faceRemedy};
    if(!t.notified||typeof t.notified!=='object'||Array.isArray(t.notified)) t.notified={};
    if(!Array.isArray(t.recent)) t.recent=[];
    t.recent=t.recent.filter(function(r){ return r&&typeof r.text==='string'; }).slice(-5);
    return t;
  },
  rules:function(){ return this.state().rulesVersion; },
  /* 新局：选择或随机；只在确认开始的时候调用 */
  begin:function(id,origin){
    $imports.S.talent=TALENT_DEF[id]&&TALENT_DEF[id].pick?id:TAL_KEYS[Math.floor($imports.GameRandom.next()*TAL_KEYS.length)];
    $imports.S.talentState={schemaVersion:1,rulesVersion:TALENT_RULES,origin:origin||'random',consumed:{},notified:{},recent:[]};
    this.state();
  },
  /* 读档：ID 不在定义里（或缺失）→ 确定地落到「没有天赋」，不沿用读档前的值，也不重抽 */
  normalizeSaved:function(d){
    var id=(d&&typeof d.talent==='string'&&TALENT_DEF[d.talent]&&!TALENT_DEF[d.talent].internal)?d.talent:'none';
    $imports.S.talent=id;
    if(d&&d.talent==='stomach')(0,$imports.saveReport)('talent','铁胃已移除，旧档按无天赋继续');
    var t=d&&d.talentState;
    if(t&&typeof t==='object'&&!Array.isArray(t)){
      $imports.S.talentState=JSON.parse(JSON.stringify(t));
      if($imports.S.talentState.rulesVersion>TALENT_RULES) $imports.S.talentState.rulesVersion=1;      /* 不认识的新版本：按最保守的旧规则跑 */
    }else{
      $imports.S.talentState={rulesVersion:1,origin:id==='none'?'repair':'legacy',consumed:{fatalProtection:!!(d&&d.immuneUsed)}};
    }
    this.state();
  },
  serialize:function(){ return JSON.parse(JSON.stringify(this.state())); },
  note:function(text){ var t=this.state(); t.recent.push({day:$imports.S.day,text:String(text)}); t.recent=t.recent.slice(-5); },

  /* 能力查询：同一个返回值给判定和提示用，免得提示和规则各写一份 */
  capability:function(ctx){
    if(ctx==='terminal'){
      var usb=(0,$imports.hasItem)('usb'), code=this.has('code');
      return {ok:usb||code, via:code?'talent':usb?'usb':null};
    }
    if(ctx==='car'){
      var key=(0,$imports.hasItem)('key'), drive=this.has('drive');
      return {ok:key||drive, via:key?'key':drive?'hotwire':null,
        sec:key?TALENT_CFG.keySec:(drive&&this.rules()>=2?TALENT_CFG.hotwireSec:TALENT_CFG.keySec)};
    }
    if(ctx==='ears') return {ok:this.has('ear'), via:this.has('ear')?'talent':null, far:TALENT_CFG.earFar};   /* 楼上楼下、「很远」那一档 */
    if(ctx==='clock') return {ok:this.has('watch')||(0,$imports.hasItem)('watch'), via:(0,$imports.hasItem)('watch')?'item':this.has('watch')?'talent':null};
    return {ok:false,via:null};
  },
  /* 来源级修正量：无匹配返回中性值 */
  modifier:function(source){
    if(source==='danger.garage'||source==='danger.night') return this.has('night')?TALENT_CFG.darkMul:1;
    if(source==='anomaly.feast') return TALENT_CFG.feastNormal;
    if(source==='activity.eat') return $imports.SAN_ACTS.eat.san;
    if(source==='hear.range') return this.has('ear')?TALENT_CFG.earRange:1;          /* 顺风耳：可闻距离 */
    if(source==='dread.cooldown') return this.has('ear')?TALENT_CFG.earDread:1;      /* 顺风耳的代价：假威胁更勤 */
    return 1;
  },
  /* 一次性保命：只决定能不能挡、消耗了什么；场景恢复和保存由外层结算 */
  tryPreventDeath:function(){
    var t=this.state();
    if(!this.has('immune')||t.consumed.fatalProtection) return null;
    t.consumed.fatalProtection=true;
    this.note('天生免疫挡下了一次致命的事');
    return {source:'immune'};
  },
  /* 编程社（规则 2）：第一次答错免掉那一次 SAN 损失 */
  faceRemedy:function(){
    var t=this.state();
    if(!this.has('code')||this.rules()<2||t.consumed.faceRemedy) return false;
    t.consumed.faceRemedy=true; this.note('编程社：核对后台，挡下了一次答错时的惊吓');
    return true;
  },
  /* 守时（规则 2）：开饭、饭点结束、熄灯前提醒一次。按公开课表的平均流速估提前量，只说「快到了」 */
  WATCH_MARKS:[[735,'午饭开饭了'],[800,'午饭时间快过了'],[1060,'晚饭开饭了'],[1090,'晚饭时间快过了'],[1340,'快熄灯了']],
  tickWatch:function(){
    if(!this.has('watch')||this.rules()<2||$imports.S.screen!=='play'||$imports.S.dead) return;
    var t=this.state(), p=(0,$imports.dayPhaseAt)($imports.S.tsec), perSec=(p[1]-p[0])/p[2], lead=perSec*TALENT_CFG.watchLead;
    for(var i=0;i<this.WATCH_MARKS.length;i++){
      var m=this.WATCH_MARKS[i], key=$imports.S.day+':'+m[0], ahead=m[0]-$imports.S.tsec;
      if(t.notified[key]) continue;
      if(ahead>0&&ahead<=lead){
        t.notified[key]=1;
        Object.keys(t.notified).forEach(function(k){ if(+k.split(':')[0]<$imports.S.day-1) delete t.notified[k]; });
        (0,$imports.os)('我：（看了一眼表）'+m[1]+'。',3.2); return;
      }
      if(ahead<=0&&ahead>-lead) t.notified[key]=1;       /* 跳时间过去的：不补播 */
    }
  },
  /* 暂停 / 手册 / 选择界面共用的说明：任何状态都给完整的新文本 */
  view:function(id){
    id=id===undefined?this.id():id;
    var d=this.def(id), rules=id===this.id()?this.rules():TALENT_RULES, out={id:id,name:d.n,does:'',limit:'',status:'',old:d.old||''};
    if(d.internal){ out.name='没有天赋'; out.does='存档里的天赋数据缺失或无法识别，本局按没有天赋处理。'; return out; }
    if(d.legacy){ out.does='旧版特性，目前没有额外作用。'; out.limit='新局不会再出现；不影响路线。'; return out; }
    out.does=d.does+(rules>=2&&d.v2?d.v2:'');
    out.limit=d.limit;
    if(id==='immune') out.status=this.state().consumed.fatalProtection&&id===this.id()?'已经用掉了':'还能用 1 次';
    if(id==='code'&&rules>=2&&id===this.id()) out.status=this.state().consumed.faceRemedy?'答错补救已用':'答错补救还在';
    return out;
  },
  pauseText:function(){
    var v=this.view();
    return '天赋 · '+v.name+(v.status?'（'+v.status+'）':'')+'　'+v.does+(v.limit?' '+v.limit:'');
  }
};
/* 旧字段 S.immuneUsed 只作别名，从新状态派生，不再是另一份可以单独改的值 */
Object.defineProperty($imports.S,'immuneUsed',{configurable:true,enumerable:false,
  get:function(){ return !!($imports.S.talentState&&$imports.S.talentState.consumed&&$imports.S.talentState.consumed.fatalProtection); },
  set:function(v){ Talent.state().consumed.fatalProtection=!!v; }});

/* 新局的天赋选择界面：卡片只负责选中，「开始」才真正开局；返回不碰存档 */
var TalentPick={diff:null,mode:'normal',sel:null,
  open:function(diff,mode){
    this.diff=diff; this.mode=mode||'normal'; this.sel=null;
    var box=document.getElementById('tpcards'), esc=function(s){ return String(s).replace(/[&<>"]/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); };
    box.innerHTML=TAL_KEYS.map(function(id){
      var v=Talent.view(id), d=Talent.def(id);
      return '<button type="button" class="tpcard" role="radio" aria-checked="false" data-id="'+id+'" onclick="TalentPick.choose(\''+id+'\')">'+
        '<b>'+esc(v.name)+(v.old?'<small>（原「'+esc(v.old)+'」）</small>':'')+'</b><em>'+esc(d.role)+'</em>'+
        '<span class="tpdo">'+esc(v.does)+'</span><span class="tplim"><small>限制</small>'+esc(v.limit)+'</span>'+
        '<span class="tptags">'+d.tags.map(function(t){ return '<i>'+esc(t)+'</i>'; }).join('')+'</span></button>';
    }).join('');
    document.getElementById('tpickDiff').textContent=(diff==='hard'?'梦魇':'预知梦')+(this.mode==='speedrun'?' · 速通':'');
    document.getElementById('tpGo').disabled=true;
    var el=document.getElementById('tpick'); el.hidden=false;
    var first=box.querySelector('.tpcard'); if(first) first.focus({preventScroll:true});
  },
  choose:function(id){
    if(TAL_KEYS.indexOf(id)<0) return;
    this.sel=id;
    Array.prototype.forEach.call(document.querySelectorAll('#tpcards .tpcard'),function(b){ var on=b.getAttribute('data-id')===id; b.classList.toggle('on',on); b.setAttribute('aria-checked',String(on)); });
    document.getElementById('tpGo').disabled=false;
  },
  close:function(){ document.getElementById('tpick').hidden=true; this.sel=null; },
  start:function(id,origin){
    var diff=this.diff, mode=this.mode; this.close();
    if(mode==='speedrun'&&typeof $imports.Speedrun!=='undefined') $imports.Speedrun.arm(diff);
    $imports.Game.start(diff,{talent:id,origin:origin,mode:mode==='speedrun'?'speedrun':'normal'});
  },
  confirm:function(){ if(this.sel) this.start(this.sel,'selected'); },
  random:function(){ this.start(TAL_KEYS[Math.floor($imports.GameRandom.next()*TAL_KEYS.length)],'random'); },
  key:function(e){
    var el=document.getElementById('tpick'); if(!el||el.hidden) return false;
    if(e.key==='Escape'){ e.preventDefault(); this.close(); return true; }
    if(['ArrowDown','ArrowRight','ArrowUp','ArrowLeft'].indexOf(e.key)>=0){
      var cards=Array.prototype.slice.call(document.querySelectorAll('#tpcards .tpcard')), i=cards.indexOf(document.activeElement);
      var step=(e.key==='ArrowDown'||e.key==='ArrowRight')?1:-1;
      cards[(i+step+cards.length)%cards.length].focus(); e.preventDefault(); return true;
    }
    return false;
  }
};
document.addEventListener('keydown',function(e){ if(TalentPick.key(e)) e.stopPropagation(); },true);

/* @module-exports */
GameModules.publish("game3d/js/talents.js",{
"TALENT_RULES":{get:function(){return TALENT_RULES;},set:function($value){TALENT_RULES=$value;}},
"TALENT_DEF":{get:function(){return TALENT_DEF;},set:function($value){TALENT_DEF=$value;}},
"TALENTS":{get:function(){return TALENTS;},set:function($value){TALENTS=$value;}},
"TAL_KEYS":{get:function(){return TAL_KEYS;},set:function($value){TAL_KEYS=$value;}},
"TALENT_CFG":{get:function(){return TALENT_CFG;},set:function($value){TALENT_CFG=$value;}},
"Talent":{get:function(){return Talent;},set:function($value){Talent=$value;}},
"TalentPick":{get:function(){return TalentPick;},set:function($value){TalentPick=$value;}}
});
})(GameModules.imports("game3d/js/talents.js"));
