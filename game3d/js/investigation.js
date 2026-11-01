/* 调查记录只由实际交互写入；文字记忆沿用笔记本、笔和获得日规则。 */
'use strict';
var Investigation={
  state:function(){
    var j=RT.investigation;
    if(!j||typeof j!=='object'||Array.isArray(j))j=RT.investigation={};
    if(!j.entries||typeof j.entries!=='object'||Array.isArray(j.entries))j.entries={};
    if(!Array.isArray(j.recent))j.recent=[];
    return j;
  },
  escape:function(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});},
  record:function(id,text,kind,source){
    var j=this.state(),key='investigation:'+id;
    if(!j.entries[id])Playtest.event('首次发现',id);
    j.entries[id]={text:text,kind:kind||'事实',source:source||currentPlaceName(),day:S.day};
    S.clues[key]=S.day;
    if(id==='portalDiary'||id.indexOf('blueprint:')===0)j.focus='portal';
    else if(id==='whitelistWritten'||id==='whitelistSynced')j.focus='face';
    else if(id==='notice'||id==='parking'||id==='carKey')j.focus='car';
    j.recent=j.recent.filter(function(k){return k!==id;}).concat(id).slice(-8);
  },
  visible:function(id){return !!this.state().entries[id]&&hasClue('investigation:'+id);},
  idle:function(){return S.screen==='play'&&!S.dead&&!PRO.on&&!PAUSE.on&&!UI.anyOpen()&&!PC.on&&!PHONE.on&&!LESSON.on&&!HIDE.on&&!AN.active&&!PAT.locked&&!Inspection.pending()&&!(S.intro>0);},
  deskAvailable:function(){
    var R=INTERIORS.teach1;
    return this.idle()&&S.mode==='in'&&S.room==='teach1'&&Math.hypot(S.x-(R.ox+48.5*9),S.y-(R.oy+6.5*9))<24&&!this.visible('desk');
  },
  openDesk:function(){
    if(!this.deskAvailable())return false;
    this.record('desk','桌肚里夹着一张停车单，背面写着：「钥匙又被收走了。讲台上的移交单还没撕。」','事实','自己的课桌');
    os('我：停车单背面写着「讲台上的移交单还没撕」。先去教室前面的讲台看看。手册的笔记页能重读。',6,OS_KEEP);
    autoSave();return true;
  },
  notice:function(){
    S.spots.guard=1;S.spots.garage=1;UI.spotsDirty=true;
    this.record('notice','钥匙移交：行政楼五楼校长办公室。保安岗留有停车记录和备用手电；车库位于校园西侧。','事实','教学楼一楼 · 讲台移交单');
    this.record('carTheory','如果找到钥匙、核对停车记录，也许能开车离开。车库黑影怕持续照射，开门前先看清车道。','推测','移交单背面的手写字');
    this.supply();
    var supply=this.state().supply;
    this.record('supply','临时补给箱移至'+(supply.site==='guard1'?'保安岗柜台':'食堂售货机旁')+'。可领取一份药片；封条能慢慢拆，也可投一枚硬币解锁。','事实','讲台移交单 · 补给附注');
    UI.choice('移交单：钥匙在行政楼五楼校长办公室；保安岗有停车记录和备用手电。车库在西侧。外出登记可跨越普通课堂；12:50、17:50 回教室集合，熄灯回宿舍。校长室、考试和夜间仍要小心。',[
      {label:'登记外出，记下移交事项',fn:function(){SchoolDay.grant();RT.dayRhythmVersion=1;Investigation.record('outing','讲台可以登记外出，不消耗物品。登记跨越普通课堂；12:50、17:50 必须回教室集合，合规后续签。熄灯回宿舍；校长室和考试不受外出登记保护。','事实','讲台 · 外出登记');autoSave();}},
      {label:'拿讲台上的粉笔',fn:function(){if(!hasItem('chalk'))addItem('chalk');autoSave();}}
    ]);
  },
  supply:function(){
    var j=this.state();
    if(!j.supply||['guard1','canteen1'].indexOf(j.supply.site)<0)j.supply={site:Math.random()<.5?'guard1':'canteen1',taken:false};
    return j.supply;
  },
  supplyOffer:function(next){
    var s=this.supply();
    if(s.site!==S.room||s.taken){next();return;}
    function take(pay){
      if(S.bag.length>=8||hasItem('pill')){os('我：先腾个位置。药片会留在箱里。',3);return;}
      if(pay&&!hasItem('coin')){os('我：没有硬币，可以慢慢拆开。',3);return;}
      if(!addItem('pill'))return;
      if(pay)removeItem('coin');else advanceGameTime(6);
      s.taken=true;Investigation.record('supplyTaken','已领取临时补给箱的药片。'+(pay?'用了一个硬币，省下拆封时间。':'花了六分钟拆封，保留了硬币。'),'验证');autoSave();
    }
    UI.choice('旁边有一只封好的临时补给箱。一次领取一份药片；硬币还可以留作买饭或车库诱饵。',[
      {label:'拆封领取（游戏时间 6 分钟）',fn:function(){take(false);}},
      {label:'投币领取（消耗 1 枚硬币）',fn:function(){take(true);}},
      {label:'先不取，继续查看设施',fn:next}
    ]);
  },
  /* 鄂A·字母 + 四位数：格子坐标决定，同一局、读档前后都一样 */
  carName:function(c,r){return '鄂A·'+'DFHKM'.charAt((c+r)%5)+String(3100+c*31+r);},
  /* 自己教室的讲台（座位所在那一间）：只有它上面压着移交单 */
  podium:function(){
    if(this._podium!==undefined)return this._podium;
    var R=INTERIORS.teach1,seat=null,best=null,r,c;
    for(r=0;r<R.rows;r++)for(c=0;c<R.cols;c++)if(R.grid[r][c]==='P')seat=[c,r];
    if(seat)for(r=0;r<R.rows;r++)for(c=0;c<R.cols;c++)if(R.grid[r][c]==='T'&&r<seat[1]&&(!best||Math.abs(c-seat[0])<Math.abs(best[0]-seat[0])))best=[c,r];
    return this._podium=best;
  },
  isPodium:function(R,c,r){var p=this.podium();return !!(p&&R&&R.id==='teach1'&&p[0]===c&&p[1]===r);},
  carKey:function(){
    var cell=carRightCell().split(':').map(Number),label=this.carName(cell[0],cell[1]);
    this.record('carKey','钥匙环刻着车牌「'+label+'」。在车位前看车牌，再试钥匙。','事实','车钥匙');
    autoSave();
    return label;
  },
  parking:function(quiet){
    var cell=carRightCell().split(':').map(Number);
    this.record('parking','停车登记：可用车辆在车库靠西侧，第 '+(cell[1]+1)+' 排。记录的签名与教室停车单相同，离校栏却始终空着。','事实','保安岗 · 停车登记');
    this.record('garageSafety','车道上的黑影会靠近。手电持续照射能暂时逼退它；硬币可把它引开。拉车门前，先确认它离开车辆。','事实','保安岗 · 值班便签');
    if(!quiet)os('我：登记写着「靠西侧，第 '+(cell[1]+1)+' 排」。旁边的便签说：手电能暂时照退黑影，硬币能把它引开，开门前先确认车道。',6,OS_KEEP);
    autoSave();
  },
  carHint:function(h){
    var cell=h.c+':'+h.r;
    return this.carName(h.c,h.r)+(RT.carTried&&RT.carTried[cell]?' · 已试，不匹配':' · 查看车辆');
  },
  inspectCar:function(c,r){
    var label=this.carName(c,r),tried=RT.carTried&&RT.carTried[c+':'+r];
    this.record('vehicle:'+c+':'+r,label+(tried?'：钥匙不匹配。':'：已看清车牌，尚未验证钥匙。'),tried?'验证':'事实','车库 · 第 '+(r+1)+' 排');
    UI.choice(label+(tried?'，这辆已经试过，钥匙不匹配。':'。车窗上倒映着身后的车道。'),[
      {label:'试钥匙 / 接线（原地 1.6 秒）',fn:function(){useCar(c,r);}},
      {label:'退开观察车道',fn:function(){}}
    ]);
  },
  currentFocus:function(){
    var j=this.state();
    return j.focus||((RT.portalDiary||RT.portalSketch||RT.portalOpen)?'portal':RT.hacked?'face':'car');
  },
  goal:function(){
    var focus=this.currentFocus();
    if(focus==='portal'&&(RT.portalDiary||RT.portalSketch||RT.portalOpen))return RT.portalOpen?'装置已启动，可以返回物理实验室的基座。':RT.portalSketch?'对照图纸准备材料。'+portalNeedText():this.visible('portalDiary')||hasClue('portalDiary')?'对照日记，调查实验楼二、四、五楼教师台；已得到 '+PortalExploration.count()+'/3 张图纸。':'造门调查还没结束；日记的文字记不清了，可以回隧道重读。';
    if(focus==='face'&&(S.spots.comp||S.spots.data||RT.hacked))return RT.data?'数据已同步，前往西小门完成闸机验证。':RT.hacked?'网络中心已写入，前往行政楼三楼同步数据。':'调查实验楼三楼的网络中心；留意门锁和终端旁的说明。';
    if(hasItem('key')&&!this.visible('notice'))return '已经有车钥匙。在背包中使用它，读清环上的牌号，再去车辆旁核对。';
    if(!this.visible('desk')&&!this.visible('notice'))return '先看看自己课桌上的停车单（靠近自己的座位，点「看停车单」或按 R），也可以自由探索。';
    if(!this.visible('notice'))return '停车单提到了教室前方的讲台。走近后交互，看看移交单。';
    if(!hasItem('key')&&S.talent!=='drive')return '钥匙被收到行政楼五楼校长办公室；出发前可以去保安岗取手电、查看停车记录。';
    if(!this.visible('parking'))return '已有开车的办法。保安岗停车记录能缩小范围，钥匙上的牌号可供核对。';
    return '去西侧车库核对车牌；先用手电或诱饵处理车道上的黑影，再试车门。';
  },
  /* 笔记页上半部分：当前调查（案卷卡片）、关注路线、最近发现、按事实 / 推测 / 验证分组的记录、路线进度 */
  render:function(){
    var j=this.state(),esc=this.escape,me=this,KIND={'事实':'fact','推测':'guess','验证':'check'};
    var input=document.getElementById('notequery'),query=input?input.value.trim().toLowerCase():'';
    function hit(id){var e=j.entries[id];return me.visible(id)&&(!query||(e.text+' '+e.source).toLowerCase().indexOf(query)>=0);}
    function tag(kind){return '<i class="inv-kind k-'+KIND[kind]+'">'+kind+'</i>';}
    var routes=this.routes(),names={car:'车辆',face:'白名单',portal:'造门'},focus=this.currentFocus();
    /* 标签和高亮按钮要和上面那句目标一致：关注的路线还没发现时，目标文字落回车辆路线 */
    if(!routes.some(function(r){return r[0]===focus;}))focus=routes.some(function(r){return r[0]==='car';})?'car':'';
    var h='<section class="inv-case"><div class="inv-k"><span>当前调查</span>'+(focus?'<b>'+names[focus]+'路线</b>':'')+'</div>'+
      '<p class="nl goal">'+esc(this.goal())+'</p>';
    if(routes.length>1)h+='<div class="investigation-focus" role="group" aria-label="切换关注的路线"><span>关注</span>'+routes.map(function(route){
      var on=route[0]===focus;return '<button type="button"'+(on?' class="on" aria-pressed="true"':' aria-pressed="false"')+' onclick="Investigation.focus(\''+route[0]+'\')">'+route[1]+'</button>';}).join('')+'</div>';
    h+='</section>';
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
    if(j.entries.notice||hasItem('key')||RT.carTried)progress.push(['车辆',(RT.carUsed?'已驶离车库':hasItem('key')||S.talent==='drive'?'能够试车门':'尚无开车办法')+'；已试 '+Object.keys(RT.carTried||{}).length+' 辆。',RT.carUsed]);
    if(S.spots.comp||S.spots.data||RT.hacked)progress.push(['白名单',(RT.hacked?'网络中心已写入':'网络中心尚未写入')+'；'+(RT.data?'行政楼数据已同步':'行政楼尚未同步')+(RT.faceQuiz?'；闸机验证 '+RT.faceQuiz.done+'/3':'')+'。',RT.data&&RT.faceQuiz&&RT.faceQuiz.done>=3]);
    if(RT.portalDiary||RT.portalSketch||RT.portalOpen)progress.push(['造门',(RT.portalOpen?'装置已启动':RT.portalSketch?'图纸齐全；'+portalNeedText():'已获得 '+PortalExploration.count()+'/3 张图纸'+(this.visible('portalDiary')||hasClue('portalDiary')?'；还需调查实验楼 '+PORTAL_BLUEPRINT_FLOORS.filter(function(f){return !(RT.portalBlueprints||{})[f];}).join('、')+' 楼教师台':'；日记的文字已模糊，可以回去重读'))+'。',RT.portalOpen]);
    if(progress.length)h+='<h3>路线进度</h3><div class="inv-progress">'+progress.map(function(p){return '<div class="'+(p[2]?'done':'')+'"><b>'+p[0]+'</b><span>'+esc(p[1])+'</span></div>';}).join('')+'</div>';
    return h;
  },
  routes:function(){
    var out=[],j=this.state();
    if(j.entries.notice||hasItem('key')||RT.carTried)out.push(['car','车辆']);
    if(S.spots.comp||S.spots.data||RT.hacked)out.push(['face','白名单']);
    if(RT.portalDiary||RT.portalSketch||RT.portalOpen)out.push(['portal','造门']);
    return out;
  },
  focus:function(id){if(!this.routes().some(function(r){return r[0]===id;}))return;this.state().focus=id;UI.renderNote();autoSave();},
  migrate:function(){
    var j=this.state();
    Object.keys(j.entries).forEach(function(id){var e=j.entries[id];if(!e||typeof e.text!=='string'||['事实','推测','验证'].indexOf(e.kind)<0)delete j.entries[id];});
    j.recent=j.recent.filter(function(id){return typeof id==='string'&&!!j.entries[id];}).slice(-8);
    /* 只迁移能证明答对的课题。旧版 done 也包含错答和放弃，不能冒充学到。 */
    Object.keys(RT.lessons||{}).forEach(function(k){var r=RT.lessons[k];if(r.correct&&LESSON_TASKS[r.task]&&!Investigation.state().entries['lesson:'+r.task]){
      var day=Number(k.split(':')[0]);Investigation.record('lesson:'+r.task,LESSON_TASKS[r.task].note,'事实','课堂提醒');
      S.clues['investigation:lesson:'+r.task]=day;Investigation.state().entries['lesson:'+r.task].day=day;
    }});
  }
};
