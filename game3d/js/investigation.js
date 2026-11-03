/* @module-capsule */
(function($imports){
/* 调查记录只由实际交互写入；文字记忆沿用笔记本、笔和获得日规则。 */
'use strict';
var Investigation={
  state:function(){
    var j=$imports.RT.investigation;
    if(!j||typeof j!=='object'||Array.isArray(j))j=$imports.RT.investigation={};
    if(!j.entries||typeof j.entries!=='object'||Array.isArray(j.entries))j.entries={};
    if(!Array.isArray(j.recent))j.recent=[];
    return j;
  },
  escape:function(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});},
  record:function(id,text,kind,source){
    var j=this.state(),key='investigation:'+id;
    if(!j.entries[id])$imports.Playtest.event('首次发现',id);
    j.entries[id]={text:text,kind:kind||'事实',source:source||(0,$imports.currentPlaceName)(),day:$imports.S.day};
    $imports.S.clues[key]=$imports.S.day;
    if(id==='portalDiary'||id.indexOf('blueprint:')===0)j.focus='portal';
    else if(id==='whitelistWritten'||id==='whitelistSynced')j.focus='face';
    else if(id==='notice'||id==='parking'||id==='carKey')j.focus='car';
    j.recent=j.recent.filter(function(k){return k!==id;}).concat(id).slice(-8);
  },
  visible:function(id){return !!this.state().entries[id]&&(0,$imports.hasClue)('investigation:'+id);},
  idle:function(){return $imports.S.screen==='play'&&!$imports.S.dead&&!$imports.PRO.on&&!$imports.PAUSE.on&&!$imports.UI.anyOpen()&&!$imports.PC.on&&!$imports.PHONE.on&&!$imports.LESSON.on&&!$imports.HIDE.on&&!$imports.AN.active&&!$imports.PatrolWorld.localChase()&&!$imports.Inspection.pending()&&!($imports.S.intro>0);},
  deskAvailable:function(){
    var R=$imports.INTERIORS.teach1;
    return this.idle()&&$imports.S.mode==='in'&&$imports.S.room==='teach1'&&Math.hypot($imports.S.x-$imports.ClassroomLayout.anchor(R,$imports.ClassroomLayout.ownSeat).x,$imports.S.y-$imports.ClassroomLayout.anchor(R,$imports.ClassroomLayout.ownSeat).y)<24&&!this.visible('desk');
  },
  openDesk:function(){
    if(!this.deskAvailable())return false;
    this.record('desk','桌肚里夹着一张停车单，背面写着：「钥匙又被收走了。讲台上的移交单还没撕。」','事实','自己的课桌');
    (0,$imports.os)('我：停车单背面写着「讲台上的移交单还没撕」。先去教室前面的讲台看看。手册的笔记页能重读。',6,$imports.OS_KEEP);
    (0,$imports.autoSave)();return true;
  },
  notice:function(){
    $imports.S.spots.guard=1;$imports.S.spots.garage=1;$imports.UI.spotsDirty=true;
    this.record('notice','钥匙移交：行政楼五楼校长办公室。保安岗留有停车记录和备用手电；车库位于校园西侧。','事实','教学楼一楼 · 讲台移交单');
    this.record('carTheory','如果找到钥匙、核对停车记录，也许能开车离开。车库黑影怕持续照射，开门前先看清车道。','推测','移交单背面的手写字');
    this.record('timePressure','最好当天找到出口。首日晚间起异象越来越密，常驻巡察持续巡逻；第二天起危险区更耗精神，休息也更难恢复。睡觉不会让校园恢复安全；已拿到的通关物品还在。','事实','移交单 · 留校提醒');
    this.supply();
    var supply=this.state().supply;
    this.record('supply','临时补给箱移至'+(supply.site==='guard1'?'保安岗柜台':'食堂售货机旁')+'。可领取一份药片；封条能慢慢拆，也可投一枚硬币解锁。','事实','讲台移交单 · 补给附注');
    $imports.UI.choice('移交单：钥匙在行政楼五楼校长办公室；保安岗有停车记录和备用手电。车库在西侧。第一天不开放外出登记；第二天起许可可跨越普通课堂，但必须参加约定的下一次检查，缺席会被持续追踪。12:50、17:50 回教室集合，熄灯回宿舍。校长室、网络中心黄线报警区、考试和夜间仍要小心。尽量当天离校，第二天起校园更危险，休息效果也会减弱。',[
      {label:$imports.S.day===1?'阅读登记规定（次日起开放）':'登记外出，记下移交事项',fn:function(){$imports.SchoolDay.grant();$imports.RT.dayRhythmVersion=1;Investigation.record('outing','第二天起讲台可登记外出，不消耗物品；第一天禁手动和自动登记。许可跨越普通课堂，另外承担下一次检查的到场责任；错过约定检查会被持续追踪。17:50 后的责任是次日 12:50，熄灯仍回宿舍；校长室、考试和夜间不受许可保护。','事实','讲台 · 外出登记');(0,$imports.autoSave)();}},
      {label:'拿讲台上的粉笔',fn:function(){if(!(0,$imports.hasItem)('chalk'))(0,$imports.addItem)('chalk');(0,$imports.autoSave)();}}
    ]);
  },
  supply:function(){
    var j=this.state();
    if(!j.supply||['guard1','canteen1'].indexOf(j.supply.site)<0)j.supply={site:$imports.GameRandom.next()<.5?'guard1':'canteen1',taken:false};
    return j.supply;
  },
  supplyOffer:function(next){
    var s=this.supply();
    if(s.site!==$imports.S.room||s.taken){next();return;}
    function take(pay){
      if($imports.S.bag.length>=8||(0,$imports.hasItem)('pill')){(0,$imports.os)('我：先腾个位置。药片会留在箱里。',3);return;}
      if(pay&&!(0,$imports.hasItem)('coin')){(0,$imports.os)('我：没有硬币，可以慢慢拆开。',3);return;}
      if(!(0,$imports.addItem)('pill'))return;
      if(pay)(0,$imports.removeItem)('coin');else (0,$imports.advanceGameTime)(6);
      s.taken=true;Investigation.record('supplyTaken','已领取临时补给箱的药片。'+(pay?'用了一个硬币，省下拆封时间。':'花了六分钟拆封，保留了硬币。'),'验证');(0,$imports.autoSave)();
    }
    $imports.UI.choice('旁边有一只封好的临时补给箱。一次领取一份药片；硬币还可以留作买饭或车库诱饵。',[
      {label:'拆封领取（游戏时间 6 分钟）',fn:function(){take(false);}},
      {label:'投币领取（消耗 1 枚硬币）',fn:function(){take(true);}},
      {label:'先不取，继续查看设施',fn:next}
    ]);
  },
  /* 鄂A·字母 + 四位数：格子坐标决定，同一局、读档前后都一样 */
  carName:function(c,r){return '鄂A·'+'DFHKM'.charAt((c+r)%5)+String(3100+c*31+r);},
  /* 自己教室的讲台（座位所在那一间）：只有它上面压着移交单 */
  podium:function(){return $imports.ClassroomLayout.podium($imports.ClassroomLayout.ownSeat.classId);},
  isPodium:function(R,c,r){var p=this.podium();return !!(p&&R&&R.id==='teach1'&&p[0]===c&&p[1]===r);},
  carKey:function(){
    var cell=(0,$imports.carRightCell)().split(':').map(Number),label=this.carName(cell[0],cell[1]);
    this.record('carKey','钥匙环刻着车牌「'+label+'」。在车位前看车牌，再试钥匙。','事实','车钥匙');
    (0,$imports.autoSave)();
    return label;
  },
  parking:function(quiet){
    var cell=(0,$imports.carRightCell)().split(':').map(Number);
    this.record('parking','停车登记：可用车辆在车库靠西侧，第 '+(cell[1]+1)+' 排。记录的签名与教室停车单相同，离校栏却始终空着。','事实','保安岗 · 停车登记');
    this.record('garageSafety','车道上的黑影会靠近。手电持续照射能暂时逼退它；硬币可把它引开。拉车门前，先确认它离开车辆。','事实','保安岗 · 值班便签');
    if(!quiet)(0,$imports.os)('我：登记写着「靠西侧，第 '+(cell[1]+1)+' 排」。旁边的便签说：手电能暂时照退黑影，硬币能把它引开，开门前先确认车道。',6,$imports.OS_KEEP);
    (0,$imports.autoSave)();
  },
  carHint:function(h){
    var cell=h.c+':'+h.r;
    return this.carName(h.c,h.r)+($imports.RT.carTried&&$imports.RT.carTried[cell]?' · 已试，不匹配':' · 查看车辆');
  },
  inspectCar:function(c,r){
    var label=this.carName(c,r),tried=$imports.RT.carTried&&$imports.RT.carTried[c+':'+r];
    this.record('vehicle:'+c+':'+r,label+(tried?'：钥匙不匹配。':'：已看清车牌，尚未验证钥匙。'),tried?'验证':'事实','车库 · 第 '+(r+1)+' 排');
    $imports.UI.choice(label+(tried?'，这辆已经试过，钥匙不匹配。':'。车窗上倒映着身后的车道。'),[
      {label:'试钥匙 / 接线（原地 1.6 秒）',fn:function(){(0,$imports.useCar)(c,r);}},
      {label:'退开观察车道',fn:function(){}}
    ]);
  },
  currentFocus:function(){
    var j=this.state();
    return j.focus||(($imports.RT.portalDiary||$imports.RT.portalSketch||$imports.RT.portalOpen)?'portal':$imports.RT.hacked?'face':'car');
  },
  goal:function(){
    var focus=this.currentFocus();
    if(focus==='cyber')return $imports.Termination.state.status==='accepted'?'停机请求已提交。保持存活，手机可查看任务状态。':$imports.PhoneNetwork.device.download.status==='complete'?'连接实验楼三楼任意电脑，阅读维护终端中的资料。':'用手机接入学校无线网络，等待模拟容器安装。';
    if(focus==='portal'&&($imports.RT.portalDiary||$imports.RT.portalSketch||$imports.RT.portalOpen))return $imports.RT.portalOpen?'装置已启动，可以返回物理实验室的基座。':$imports.RT.portalSketch?'对照图纸准备材料。'+(0,$imports.portalNeedText)():this.visible('portalDiary')||(0,$imports.hasClue)('portalDiary')?'对照日记，调查实验楼二、四、五楼教师台；已得到 '+$imports.PortalExploration.count()+'/3 张图纸。':'造门调查还没结束；日记的文字记不清了，可以回隧道重读。';
    if(focus==='face'&&($imports.S.spots.comp||$imports.S.spots.data||$imports.RT.hacked))return $imports.RT.data?'数据已同步，前往西小门完成闸机验证。':$imports.RT.hacked?'网络中心已写入，前往行政楼三楼同步数据。':'调查实验楼三楼的网络中心；留意门锁和终端旁的说明。';
    if((0,$imports.hasItem)('key')&&!this.visible('notice'))return '已经有车钥匙。在背包中使用它，读清环上的牌号，再去车辆旁核对。';
    if(!this.visible('desk')&&!this.visible('notice'))return '先看看自己课桌上的停车单（靠近自己的座位，点「看停车单」或按 R），也可以自由探索。';
    if(!this.visible('notice'))return '停车单提到了教室前方的讲台。走近后交互，看看移交单。';
    var car=$imports.Talent.capability('car');
    if(!car.ok)return '钥匙被收到行政楼五楼校长办公室；出发前可以去保安岗取手电、查看停车记录。';
    if(car.via==='hotwire'){
      if(!this.visible('parking'))return '我会搭线，不用钥匙。保安岗的停车登记能缩小范围；搭线要在车门边蹲一阵，先处理车道上的黑影。';
      return '去西侧车库，按停车登记的排号找车；搭线要蹲一阵，先用手电或诱饵处理车道上的黑影。';
    }
    if(!this.visible('parking'))return '已有开车的办法。保安岗停车记录能缩小范围，钥匙上的牌号可供核对。';
    return '去西侧车库核对车牌；先用手电或诱饵处理车道上的黑影，再试车门。';
  },
  /* 笔记页上半部分：当前调查（案卷卡片）、关注路线、最近发现、按事实 / 推测 / 验证分组的记录、路线进度 */
  render:function(){
    var j=this.state(),esc=this.escape,me=this,KIND={'事实':'fact','推测':'guess','验证':'check'};
    var input=document.getElementById('notequery'),query=input?input.value.trim().toLowerCase():'';
    function hit(id){var e=j.entries[id];return me.visible(id)&&(!query||(e.text+' '+e.source).toLowerCase().indexOf(query)>=0);}
    function tag(kind){return '<i class="inv-kind k-'+KIND[kind]+'">'+kind+'</i>';}
    var routes=this.routes(),names={car:'车辆',face:'白名单',portal:'造门',cyber:'网安'},focus=this.currentFocus();
    /* 标签和高亮按钮要和上面那句目标一致：关注的路线还没发现时，目标文字落回车辆路线 */
    if(!routes.some(function(r){return r[0]===focus;}))focus=routes.some(function(r){return r[0]==='car';})?'car':'';
    var h='<section class="inv-case"><div class="inv-k"><span>当前调查</span>'+(focus?'<b>'+names[focus]+'路线</b>':'')+'</div>'+
      '<p class="nl goal">'+esc(this.goal())+'</p>';
    if(routes.length>1)h+='<div class="investigation-focus" role="group" aria-label="切换关注的路线"><span>关注</span>'+routes.map(function(route){
      var on=route[0]===focus;return '<button type="button"'+(on?' class="on" aria-pressed="true"':' aria-pressed="false"')+' onclick="Investigation.focus(\''+route[0]+'\')">'+route[1]+'</button>';}).join('')+'</div>';
    h+='</section>';
    var duty=$imports.AttendanceDuty.summary();
    if(duty||$imports.PAT.permanent)h+='<section class="inv-case"><h3>外出记录</h3><p>'+esc($imports.PAT.permanent?'登记后缺席：持续追踪仍生效。假条、重新登记和符纸不能解除。':'')+'</p>'+(duty?'<p>仍须到教室参加：'+esc(duty)+'。许可到期不免除责任；系统取消的检查会顺延。</p>':'')+'</section>';
    var ids=Object.keys(j.entries).filter(hit);
    if(query)h+='<p class="inv-found">'+(ids.length?'找到 '+ids.length+' 条':'没有找到仍能回忆的对应记录。')+'</p>';
    var recent=j.recent.filter(function(id){return !!j.entries[id]&&hit(id);}).slice(-3).reverse();
    if(recent.length&&!query)h+='<h3>最近发现</h3><ol class="inv-recent">'+recent.map(function(id){var e=j.entries[id];return '<li>'+tag(e.kind)+'<span>'+esc(e.text)+'</span></li>';}).join('')+'</ol>';
    ['事实','推测','验证'].forEach(function(kind){
      var list=ids.filter(function(id){return j.entries[id].kind===kind;});
      if(!list.length)return;
      h+='<h3>'+kind+'<small>'+list.length+'</small></h3>'+list.map(function(id){var e=j.entries[id];
        return '<div class="nl inv-card k-'+KIND[kind]+'"><div class="inv-src">'+(e.day?'第 '+esc(e.day)+' 天 · ':'')+esc(e.source)+'</div><p>'+esc(e.text)+'</p></div>';}).join('');
    });
    var progress=[];
    if(j.entries.notice||(0,$imports.hasItem)('key')||$imports.RT.carTried)progress.push(['车辆',($imports.RT.carUsed?'已驶离车库':$imports.Talent.capability('car').via==='key'?'有钥匙，能够试车门':$imports.Talent.capability('car').ok?'会搭线，能够试车':'尚无开车办法')+'；已试 '+Object.keys($imports.RT.carTried||{}).length+' 辆。',$imports.RT.carUsed]);
    if($imports.S.spots.comp||$imports.S.spots.data||$imports.RT.hacked)progress.push(['白名单',($imports.RT.hacked?'网络中心已写入':'网络中心尚未写入')+'；'+($imports.RT.data?'行政楼数据已同步':'行政楼尚未同步')+($imports.RT.faceQuiz?'；闸机验证 '+$imports.RT.faceQuiz.done+'/3':'')+'。',$imports.RT.data&&$imports.RT.faceQuiz&&$imports.RT.faceQuiz.done>=3]);
    if($imports.PhoneNetwork.device.initialized)progress.push(['网安仙人',$imports.Termination.state.status==='accepted'?'服务器已接受请求，保持存活。':$imports.PhoneNetwork.device.download.status==='complete'?'容器就绪，前往机房终端。':$imports.PhoneNetwork.device.network?'已接入学校网络。':'用手机接入学校网络。',$imports.Termination.state.status==='completed']);
    if($imports.RT.portalDiary||$imports.RT.portalSketch||$imports.RT.portalOpen)progress.push(['造门',($imports.RT.portalOpen?'装置已启动':$imports.RT.portalSketch?'图纸齐全；'+(0,$imports.portalNeedText)():'已获得 '+$imports.PortalExploration.count()+'/3 张图纸'+(this.visible('portalDiary')||(0,$imports.hasClue)('portalDiary')?'；还需调查实验楼 '+$imports.PORTAL_BLUEPRINT_FLOORS.filter(function(f){return !($imports.RT.portalBlueprints||{})[f];}).join('、')+' 楼教师台':'；日记的文字已模糊，可以回去重读'))+'。',$imports.RT.portalOpen]);
    if(progress.length)h+='<h3>路线进度</h3><div class="inv-progress">'+progress.map(function(p){return '<div class="'+(p[2]?'done':'')+'"><b>'+p[0]+'</b><span>'+esc(p[1])+'</span></div>';}).join('')+'</div>';
    return h;
  },
  routes:function(){
    var out=[],j=this.state();
    if(j.entries.notice||(0,$imports.hasItem)('key')||$imports.RT.carTried)out.push(['car','车辆']);
    if($imports.S.spots.comp||$imports.S.spots.data||$imports.RT.hacked)out.push(['face','白名单']);
    if($imports.RT.portalDiary||$imports.RT.portalSketch||$imports.RT.portalOpen)out.push(['portal','造门']);
    if((0,$imports.hasItem)('phone')||$imports.PhoneNetwork.device.initialized)out.push(['cyber','网安仙人']);
    return out;
  },
  focus:function(id){if(!this.routes().some(function(r){return r[0]===id;}))return;this.state().focus=id;$imports.UI.renderNote();(0,$imports.autoSave)();},
  migrate:function(){
    var j=this.state();
    Object.keys(j.entries).forEach(function(id){var e=j.entries[id];if(!e||typeof e.text!=='string'||['事实','推测','验证'].indexOf(e.kind)<0)delete j.entries[id];});
    j.recent=j.recent.filter(function(id){return typeof id==='string'&&!!j.entries[id];}).slice(-8);
    /* 只迁移能证明答对的课题。旧版 done 也包含错答和放弃，不能冒充学到。 */
    Object.keys($imports.RT.lessons||{}).forEach(function(k){var r=$imports.RT.lessons[k];if(r.correct&&$imports.LESSON_TASKS[r.task]&&!Investigation.state().entries['lesson:'+r.task]){
      var day=Number(k.split(':')[0]);Investigation.record('lesson:'+r.task,$imports.LESSON_TASKS[r.task].note,'事实','课堂提醒');
      $imports.S.clues['investigation:lesson:'+r.task]=day;Investigation.state().entries['lesson:'+r.task].day=day;
    }});
  }
};

/* @module-exports */
GameModules.publish("game3d/js/investigation.js",{
"Investigation":{get:function(){return Investigation;},set:function($value){Investigation=$value;}}
});
})(GameModules.imports("game3d/js/investigation.js"));
