/* @module-capsule */
(function($imports){
/* 里世界 3D · 物品与线索 */
'use strict';

var USE={torch:false,phone:false,brollyShield:false};
var PILL_SEC=30, PILL_RATE=2;              /* 药片：30 秒里每秒回 2 点 SAN（再吃一片从头算，不叠加） */
var OPENDOORS={};
var DOOR_LOCKS={'lab3:41:15':'roomkey'};
function doorLockNeed(R,c,r){ return DOOR_LOCKS[R.id+':'+c+':'+r]||null; }
function doorKeyAt(R,c,r){ return R.id+':'+c+':'+r; }
function doorKey(R,wx,wy){
  var c=Math.floor((wx-R.ox)/R.tw), r=Math.floor((wy-R.oy)/R.th);
  return doorKeyAt(R,c,r);
}
function doorIsOpen(R,wx,wy){ return !!OPENDOORS[doorKey(R,wx,wy)]; }

var Inventory={
  has:function(id){return $imports.InventoryRules.has($imports.S,id);},
  add:function(id){return inventoryAdd(id);},
  remove:function(id){return inventoryRemove(id);},
  use:function(id){return inventoryUse(id);},
  select:function(index){return $imports.InventoryRules.select($imports.S,index);},
  setHot:function(index,id){var ok=$imports.InventoryRules.setHot($imports.S,index,id);if(ok)bagChanged();return ok;},
  clear:function(){$imports.InventoryRules.clear($imports.S);syncUseState();bagChanged();},
  snapshot:function(){return {bag:$imports.S.bag.slice(),hot:$imports.S.hot.slice(),selected:$imports.S.bagSel};}
};
function hasItem(id){return Inventory.has(id);}
/* 手机只剩小游戏，不再当光源；USE.phone 留着只为兼容旧存档，始终为 false */
function normalizeUseState(){
  USE.torch=!!USE.torch&&hasItem('torch');
  USE.phone=false;
  USE.brollyShield=!!USE.brollyShield&&hasItem('brolly');
}
function syncUseState(){
  normalizeUseState();
  $imports.Engine.torch(USE.torch);
}
function addItem(id){return Inventory.add(id);}
function inventoryAdd(id){
  var result=$imports.InventoryRules.add($imports.S,id,Object.prototype.hasOwnProperty.call($imports.ITEMS,id));
  if(result==='full'){(0,$imports.os)('我：装不下了。',2.4);return false;}
  if(result!=='added')return false;
  try{ $imports.SFX.pickup(); }catch(e){}
  if(id==='phone'&&typeof $imports.PhoneNetwork!=='undefined')$imports.PhoneNetwork.acquire();
  (0,$imports.os)('我：拿到了「'+$imports.ITEMS[id].n+'」。',2.6);
  bagChanged();
  return true;
}
function removeItem(id){return Inventory.remove(id);}
function inventoryRemove(id){
  if(!$imports.InventoryRules.remove($imports.S,id))return false;
  syncUseState();
  bagChanged();
  return true;
}
/* 背包变了：打开着的背包和快捷栏立刻重画（以前丢掉东西后格子还显示着） */
function bagChanged(){
  $imports.UI.bagDirty=true;
  var hot=document.getElementById('hot'); if(hot) hot._sig='';
  if($imports.UI.openPanel==='bag') $imports.UI.renderBag(); else $imports.UI.renderHot();
}
function toggleTorch(){
  if(!hasItem('torch')){ (0,$imports.toast)('没有手电筒'); return; }
  USE.torch=!USE.torch;
  syncUseState();
  (0,$imports.toast)(USE.torch?'手电：开':'手电：关');
  $imports.SFX.click();
}
function useHot(i){
  var id=$imports.S.hot[i];
  if(!id){ (0,$imports.toast)('快捷栏 '+(i+1)+' 是空的 —— 打开手册背包，选中物品后点「放到快捷栏 '+(i+1)+'」'); return; }
  if(!hasItem(id)){ $imports.S.hot[i]=null; var el=document.getElementById('hot'); if(el) el._sig=''; (0,$imports.toast)('「'+$imports.ITEMS[id].n+'」已经不在了'); $imports.UI.renderHot(); return; }
  useItem(id);
}
/* 每种东西拿在手上「用」一下做什么。没写在这里的：能看的就看一眼说明，其余用不上 */
function useMaterial(id,nm){ (0,$imports.os)('我：'+nm+'。'+$imports.ITEMS[id].d+(0,$imports.portalNeedText)(),3.6); }
var ITEM_USE={
  torch:function(){ toggleTorch(); },
  phone:function(){ $imports.PHONE.start(); },
  leave:function(){ (0,$imports.useLeave)(); },
  brolly:function(){ USE.brollyShield=!USE.brollyShield; (0,$imports.toast)(USE.brollyShield?'撑开伞':'收起伞'); },
  pill:function(){ $imports.S.pillT=PILL_SEC; removeItem('pill'); (0,$imports.os)('我：药片很苦。手慢慢不抖了。',3); (0,$imports.toast)('药片咽下去了 · 作用持续 '+PILL_SEC+' 秒'); },
  snack:function(){ $imports.S.snackT=$imports.SNACK_SEC; removeItem('snack'); (0,$imports.os)('我：甜的。腿一下子轻了。',2.4); (0,$imports.toast)('士力架 · '+$imports.SNACK_SEC+' 秒内移速 ×1.5，疾跑不耗体力'); },
  coin:function(){ throwCoin(); },
  atlas:function(){
    for(var i=0;i<$imports.SPOTS.length;i++) if($imports.SPOTS[i].id!=='stall') $imports.S.spots[$imports.SPOTS[i].id]=1;
    $imports.UI.spotsDirty=true; addClue('atlas');
    (0,$imports.os)('我：总览图上用红笔圈了三处：行政楼五楼「校长办公室」，实验楼一楼「物理实验室」，还有钟楼——旁边写着「顶上能看见整个学校」。',6,$imports.OS_KEEP);
    $imports.UI.open('mapv');
  },
  elixir:function(){ (0,$imports.os)('我：留着。没有说明书，可我知道它什么时候该吃——到时候它自己会起作用。',3.2); },
  seal:function(){ (0,$imports.os)('我：符纸在口袋里很安静。等那个高个子盯上我的时候，它才会动。',3.2); },
  coil:useMaterial, lens:useMaterial, vial:useMaterial,
  watch:function(){ (0,$imports.toast)('现在是 '+(0,$imports.fmtClock)($imports.S.tsec)); (0,$imports.os)('我：现在是 '+(0,$imports.fmtClock)($imports.S.tsec)+'。',2.6); },
  compass:function(){ useCompass(); },
  memo:function(){
    $imports.S.spots.data=1; $imports.S.spots.comp=1; $imports.UI.spotsDirty=true;
    (0,$imports.os)('我：纸条上是一行潦草的字：「实验楼 3F 网络中心 → 行政楼 3F 门禁机 → 西小门。钥匙收到校长室去了。」最后一个字被划得很深。',6);
    (0,$imports.toast)('记下了：机房 · 数据终端');
  },
  map:function(){
    ['guard','garage','trash','wall'].forEach(function(k){ $imports.S.spots[k]=1; });
    $imports.UI.spotsDirty=true;
    (0,$imports.os)('我：平面图上有几个地方被反复描过：保安岗、车库、垃圾房、东围墙。',4.2);
    $imports.UI.open('mapv');
  }
};
/* 拿出来看一眼就收起来的东西 */
var ITEM_READ={card:1,notebook:1,hw:1,usb:1,key:1,roomkey:1,metronome:1,goggles:1,coat:1,battery:1,chalk:1,pen:1};
function useItem(id){return Inventory.use(id);}
function inventoryUse(id){
  if(!id||!hasItem(id)) return;
  if(GameModules.first('itemUse',id)) return;               /* 模块可以接管某件东西的用法（粉笔画记号、迷宫里的手表） */
  var nm=$imports.ITEMS[id]?$imports.ITEMS[id].n:id;
  if(ITEM_USE.hasOwnProperty(id)){ ITEM_USE[id](id,nm); return; }
  if(ITEM_READ[id]){
    if(id==='key'){(0,$imports.os)('我：钥匙环刻着「'+$imports.Investigation.carKey()+'」。要去车位前核对。',4,$imports.OS_KEEP);return;}
    (0,$imports.os)('我：'+nm+'。'+$imports.ITEMS[id].d,3.0);
    (0,$imports.toast)(nm+(hasItem('notebook')&&hasItem('pen')?' · 线索会写进本子':''));
    return;
  }
  (0,$imports.os)('我：现在用不上「'+nm+'」。',2.2);
  (0,$imports.toast)('「'+nm+'」现在用不上');
}
/* 罗盘：室内指最近的门 / 楼梯，室外指还没去过的线索点（都去过了就指最近的校门） */
function useCompass(){
  var tx=null, ty=null, what='';
  if($imports.S.mode==='in'){
    var R=$imports.INTERIORS[$imports.S.room], best=1e9, r, c;
    if(R) for(r=0;r<R.rows;r++) for(c=0;c<R.cols;c++){
      var ch=R.grid[r][c]; if(ch!=='O'&&ch!=='S'&&ch!=='L'&&ch!=='=') continue;
      var wx=R.ox+(c+0.5)*R.tw, wy=R.oy+(r+0.5)*R.th, d=(0,$imports.dist2)(wx,wy,$imports.S.x,$imports.S.y);
      if(d<best&&d>9*9){ best=d; tx=wx; ty=wy; what=(ch==='S'?'楼梯':ch==='O'?'出口':ch==='L'?'连廊':'门'); }
    }
  }else{
    var bd=1e18, i;
    for(i=0;i<$imports.SPOTS.length;i++){
      var sp=$imports.SPOTS[i]; if($imports.S.spots[sp.id]) continue;
      var cx=(sp.x+sp.w/2)*$imports.SC, cy=(sp.y+sp.h/2)*$imports.SC, d2=(0,$imports.dist2)(cx,cy,$imports.S.x,$imports.S.y);
      if(d2<bd){ bd=d2; tx=cx; ty=cy; what='某个我还没去过的地方'; }
    }
    if(tx===null){
      var gs=[[$imports.GATE_N,'北门'],[$imports.GATE_W,'西小门'],[$imports.GATE_S,'南门']];
      for(i=0;i<gs.length;i++){ var gx=gs[i][0].x*$imports.SC, gy=gs[i][0].y*$imports.SC, d3=(0,$imports.dist2)(gx,gy,$imports.S.x,$imports.S.y); if(d3<bd){ bd=d3; tx=gx; ty=gy; what=gs[i][1]; } }
    }
  }
  if(tx===null){ (0,$imports.os)('我：指针在原地打转。',2.4); return; }
  var a=Math.atan2(ty-$imports.S.y,tx-$imports.S.x), rel=((a-$imports.S.ang+$imports.PI*3)%$imports.TAU)-$imports.PI;
  var dirs=['正前方','右前方','右边','右后方','正后方','左后方','左边','左前方'];
  var k=Math.round(rel/($imports.PI/4)); k=((k%8)+8)%8;
  var m=Math.round(Math.sqrt((0,$imports.dist2)(tx,ty,$imports.S.x,$imports.S.y))*$imports.U2M);
  (0,$imports.toast)('罗盘 → '+dirs[k]+' · 约 '+m+' 米');
  (0,$imports.os)('我：指针在抖，最后停在'+dirs[k]+'——'+what+'。',3.0);
}
function throwCoin(){
  if($imports.S.mode!=='in'||$imports.S.room!=='garage1'){ (0,$imports.os)($imports.S.room==='canteen1'?'我：要买饭就去打饭窗口，要买东西就去售货机。':'我：扔在这儿没意义。留着，食堂能用。',2.4); return; }
  var a=$imports.S.ang+(0,$imports.rnd)(-0.4,0.4), far=(0,$imports.rnd)(60,120);
  var R=$imports.INTERIORS.garage1, x=$imports.S.x, y=$imports.S.y;
  /* 沿投掷方向找到可落地的位置，避免诱饵落进墙里。 */
  for(var d=9;d<=far;d+=9){
    var nx=$imports.S.x+Math.cos(a)*d, ny=$imports.S.y+Math.sin(a)*d;
    if((0,$imports.solidAtInterior)(R,nx,ny)) break;
    x=nx; y=ny;
  }
  $imports.RT.lure={x:x,y:y,t:8};
  $imports.ROAM.lureTold=0;
  removeItem('coin');
  (0,$imports.os)('我：硬币在地上滚了很远。',3);
  $imports.SFX.step();
}
function dropAt(i){
  if(!Inventory.select(i)) return;
  dropSelected();
}
function dropSelected(){
  var id=$imports.S.bag[$imports.S.bagSel];
  if(!id){ return; }
  removeItem(id);
  /* 独有的门材料丢弃后可回原处重取，避免误丢断掉整条路线。 */
  if(id==='coil') $imports.RT.coilTaken=0;
  if(id==='lens') $imports.RT.lensTaken=0;
  if(id==='vial') $imports.RT.vialTaken=0;
  (0,$imports.os)('我：我把「'+$imports.ITEMS[id].n+'」放下了。',2.4);
  if($imports.S.mode==='in'&&(0,$imports.inToiletHere)()&&$imports.S.room==='teach1'&&!$imports.RT.beastDrop){
    if(inBeastWindow()){
      $imports.RT.beastDrop=true;
      addClue('beast');
      (0,$imports.os)('我：东西刚落地，就被地砖缝里的什么接住了。很轻的一声："嗯。" 第三个隔间的门锁，自己弹开了。',4,$imports.OS_FORCE);
      (0,$imports.autoSave)();
    }
  }
}
function inBeastWindow(){ return $imports.S.tsec>=$imports.BEAST_T0&&$imports.S.tsec<$imports.BEAST_T1; }
function hasClock(){ return $imports.Talent.capability('clock').ok; }

function addClue(id){
  if(!$imports.S.clues[id]) $imports.S.clues[id]=$imports.S.day;
  $imports.RT.clue=($imports.RT.clue||0)+1;
}
function hasClue(id){
  if(!$imports.S.clues[id]) return false;
  if(hasItem('notebook')&&hasItem('pen')) return true;
  return $imports.S.clues[id]===$imports.S.day;
}

/* ---------- 食堂：饭点以外投币买饭；售货机投币随机出东西 ---------- */
function mealNow(){ return $imports.MEALS.some(function(m){ return $imports.S.tsec>=m[0]&&$imports.S.tsec<m[1]; }); }
function canteenWindow(){
  if(!hasItem('coin')){ (0,$imports.os)('我：窗口里的人头也不抬：「饭点过了。要吃，拿钱来。」',3.2); return; }
  $imports.UI.choice('窗口里还剩一点饭菜。「一个硬币一份。」',[
    {label:'投一枚硬币买饭（游戏时间 10 分钟）',fn:function(){
      $imports.UI.closeChoice(); removeItem('coin');
      $imports.PlayerStats.changeSan(24,'items',{max:100}); (0,$imports.restoreStamina)(30);
      (0,$imports.advanceGameTime)(10);
      (0,$imports.os)('我：硬币落进铁盒子里，响了很久。饭是热的——这里第一次有热的东西。',3.8); (0,$imports.toast)('吃过热饭了');
      try{ $imports.SFX.click(); }catch(e){}
    }},
    {label:'算了',fn:function(){ $imports.UI.closeChoice(); }}
  ]);
}
/* 售货机：一个硬币换一样东西，偶尔有好东西，也会吞币 */
var VEND_POOL=[['snack',24],['battery',18],['pill',14],['seal',10],['watch',7],['elixir',6],['torch',5],[null,16]];
function useVending(){
  if(!hasItem('coin')){ (0,$imports.os)('我：售货机的灯管一闪一闪。投币口旁边贴着：「只收硬币」。',3.0); return; }
  removeItem('coin');
  try{ $imports.SFX.click(); }catch(e){}
  var tot=0,i; for(i=0;i<VEND_POOL.length;i++) tot+=VEND_POOL[i][1];
  var r=$imports.GameRandom.next()*tot, got=null;
  for(i=0;i<VEND_POOL.length;i++){ r-=VEND_POOL[i][1]; if(r<0){ got=VEND_POOL[i][0]; break; } }
  if(got&&hasItem(got)) got=null;
  if(!got){ (0,$imports.os)('我：硬币吞进去了。机器里咔哒响了一声，什么也没掉下来。玻璃后面，有一排东西转过来对着我。',4.2); return; }
  (0,$imports.os)('我：咔哒一声，掉下来一样东西——「'+$imports.ITEMS[got].n+'」。',3.0);
  addItem(got);
}

/* @module-exports */
GameModules.publish("game3d/js/items.js",{
"USE":{get:function(){return USE;},set:function($value){USE=$value;}},
"PILL_SEC":{get:function(){return PILL_SEC;},set:function($value){PILL_SEC=$value;}},
"PILL_RATE":{get:function(){return PILL_RATE;},set:function($value){PILL_RATE=$value;}},
"OPENDOORS":{get:function(){return OPENDOORS;},set:function($value){OPENDOORS=$value;}},
"DOOR_LOCKS":{get:function(){return DOOR_LOCKS;},set:function($value){DOOR_LOCKS=$value;}},
"doorLockNeed":{get:function(){return doorLockNeed;},set:function($value){doorLockNeed=$value;}},
"doorKeyAt":{get:function(){return doorKeyAt;},set:function($value){doorKeyAt=$value;}},
"doorKey":{get:function(){return doorKey;},set:function($value){doorKey=$value;}},
"doorIsOpen":{get:function(){return doorIsOpen;},set:function($value){doorIsOpen=$value;}},
"Inventory":{get:function(){return Inventory;},set:function($value){Inventory=$value;}},
"hasItem":{get:function(){return hasItem;},set:function($value){hasItem=$value;}},
"normalizeUseState":{get:function(){return normalizeUseState;},set:function($value){normalizeUseState=$value;}},
"syncUseState":{get:function(){return syncUseState;},set:function($value){syncUseState=$value;}},
"addItem":{get:function(){return addItem;},set:function($value){addItem=$value;}},
"inventoryAdd":{get:function(){return inventoryAdd;},set:function($value){inventoryAdd=$value;}},
"removeItem":{get:function(){return removeItem;},set:function($value){removeItem=$value;}},
"inventoryRemove":{get:function(){return inventoryRemove;},set:function($value){inventoryRemove=$value;}},
"bagChanged":{get:function(){return bagChanged;},set:function($value){bagChanged=$value;}},
"toggleTorch":{get:function(){return toggleTorch;},set:function($value){toggleTorch=$value;}},
"useHot":{get:function(){return useHot;},set:function($value){useHot=$value;}},
"useMaterial":{get:function(){return useMaterial;},set:function($value){useMaterial=$value;}},
"ITEM_USE":{get:function(){return ITEM_USE;},set:function($value){ITEM_USE=$value;}},
"ITEM_READ":{get:function(){return ITEM_READ;},set:function($value){ITEM_READ=$value;}},
"useItem":{get:function(){return useItem;},set:function($value){useItem=$value;}},
"inventoryUse":{get:function(){return inventoryUse;},set:function($value){inventoryUse=$value;}},
"useCompass":{get:function(){return useCompass;},set:function($value){useCompass=$value;}},
"throwCoin":{get:function(){return throwCoin;},set:function($value){throwCoin=$value;}},
"dropAt":{get:function(){return dropAt;},set:function($value){dropAt=$value;}},
"dropSelected":{get:function(){return dropSelected;},set:function($value){dropSelected=$value;}},
"inBeastWindow":{get:function(){return inBeastWindow;},set:function($value){inBeastWindow=$value;}},
"hasClock":{get:function(){return hasClock;},set:function($value){hasClock=$value;}},
"addClue":{get:function(){return addClue;},set:function($value){addClue=$value;}},
"hasClue":{get:function(){return hasClue;},set:function($value){hasClue=$value;}},
"mealNow":{get:function(){return mealNow;},set:function($value){mealNow=$value;}},
"canteenWindow":{get:function(){return canteenWindow;},set:function($value){canteenWindow=$value;}},
"VEND_POOL":{get:function(){return VEND_POOL;},set:function($value){VEND_POOL=$value;}},
"useVending":{get:function(){return useVending;},set:function($value){useVending=$value;}}
});
})(GameModules.imports("game3d/js/items.js"));
