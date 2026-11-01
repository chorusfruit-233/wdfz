/* 里世界 3D · 物品与线索 */
'use strict';

var USE={torch:false,phone:false,brollyShield:false};
var PILL_SEC=30, PILL_RATE=2;              /* 药片：30 秒里每秒回 2 点 SAN（再吃一片从头算，不叠加） */
var OPENDOORS={};
var DOOR_LOCKS={'lab3:41:15':'roomkey'};
function doorLockNeed(R,c,r){ return DOOR_LOCKS[R.id+':'+c+':'+r]||null; }
function doorKeyAt(R,c,r){ return S.room+':'+c+':'+r; }
function doorKey(R,wx,wy){
  var c=Math.floor((wx-R.ox)/R.tw), r=Math.floor((wy-R.oy)/R.th);
  return doorKeyAt(R,c,r);
}
function doorIsOpen(R,wx,wy){ return !!OPENDOORS[doorKey(R,wx,wy)]; }

function hasItem(id){ return S.bag.indexOf(id)>=0; }
/* 手机只剩小游戏，不再当光源；USE.phone 留着只为兼容旧存档，始终为 false */
function syncUseState(){
  USE.torch=!!USE.torch&&hasItem('torch');
  USE.phone=false;
  USE.brollyShield=!!USE.brollyShield&&hasItem('brolly');
  Engine.torch(USE.torch);
}
function addItem(id){
  if(!id||id==='nothing') return false;
  if(S.bag.indexOf(id)>=0) return false;
  if(S.bag.length>=8){ os('我：装不下了。',2.4); return false; }
  S.bag.push(id);
  try{ SFX.pickup(); }catch(e){}
  os('我：拿到了「'+ITEMS[id].n+'」。',2.6);
  bagChanged();
  return true;
}
function removeItem(id){
  var i=S.bag.indexOf(id);
  if(i<0) return false;
  S.bag.splice(i,1);
  syncUseState();
  for(var k=0;k<2;k++) if(S.hot[k]===id) S.hot[k]=null;      /* 快捷栏里也取下来 */
  if(S.bagSel>=S.bag.length) S.bagSel=Math.max(0,S.bag.length-1);
  bagChanged();
  return true;
}
/* 背包变了：打开着的背包和快捷栏立刻重画（以前丢掉东西后格子还显示着） */
function bagChanged(){
  UI.bagDirty=true;
  var hot=document.getElementById('hot'); if(hot) hot._sig='';
  if(UI.openPanel==='bag') UI.renderBag(); else UI.renderHot();
}
function toggleTorch(){
  if(!hasItem('torch')){ toast('没有手电筒'); return; }
  USE.torch=!USE.torch;
  syncUseState();
  toast(USE.torch?'手电：开':'手电：关');
  SFX.click();
}
function useHot(i){
  var id=S.hot[i];
  if(!id){ toast('快捷栏 '+(i+1)+' 是空的 —— 打开手册背包，选中物品后点「放到快捷栏 '+(i+1)+'」'); return; }
  if(!hasItem(id)){ S.hot[i]=null; var el=document.getElementById('hot'); if(el) el._sig=''; toast('「'+ITEMS[id].n+'」已经不在了'); UI.renderHot(); return; }
  useItem(id);
}
/* 每种东西拿在手上「用」一下做什么。没写在这里的：能看的就看一眼说明，其余用不上 */
function useMaterial(id,nm){ os('我：'+nm+'。'+ITEMS[id].d+portalNeedText(),3.6); }
var ITEM_USE={
  torch:function(){ toggleTorch(); },
  phone:function(){ PHONE.start(); },
  leave:function(){ useLeave(); },
  brolly:function(){ USE.brollyShield=!USE.brollyShield; toast(USE.brollyShield?'撑开伞':'收起伞'); },
  pill:function(){ S.pillT=PILL_SEC; removeItem('pill'); os('我：药片很苦。手慢慢不抖了。',3); toast('药片 · '+PILL_SEC+' 秒内每秒 SAN +'+PILL_RATE); },
  snack:function(){ S.snackT=SNACK_SEC; removeItem('snack'); os('我：甜的。腿一下子轻了。',2.4); toast('士力架 · '+SNACK_SEC+' 秒内疾跑不耗体力'); },
  coin:function(){ throwCoin(); },
  atlas:function(){
    for(var i=0;i<SPOTS.length;i++) if(SPOTS[i].id!=='stall') S.spots[SPOTS[i].id]=1;
    UI.spotsDirty=true; addClue('atlas');
    os('我：总览图上用红笔圈了三处：行政楼五楼「校长办公室」，实验楼一楼「物理实验室」，还有钟楼——旁边写着「顶上能看见整个学校」。',6,OS_KEEP);
    UI.open('mapv');
  },
  elixir:function(){ os('我：留着。没有说明书，可我知道它什么时候该吃——到时候它自己会起作用。',3.2); },
  seal:function(){ os('我：符纸在口袋里很安静。等那个高个子盯上我的时候，它才会动。',3.2); },
  coil:useMaterial, lens:useMaterial, vial:useMaterial,
  watch:function(){ toast('现在是 '+fmtClock(S.tsec)); os('我：现在是 '+fmtClock(S.tsec)+'。',2.6); },
  compass:function(){ useCompass(); },
  memo:function(){
    S.spots.data=1; S.spots.comp=1; UI.spotsDirty=true;
    os('我：纸条上是一行潦草的字：「实验楼 3F 网络中心 → 行政楼 3F 门禁机 → 西小门。钥匙收到校长室去了。」最后一个字被划得很深。',6);
    toast('记下了：机房 · 数据终端');
  },
  map:function(){
    ['guard','garage','trash','wall'].forEach(function(k){ S.spots[k]=1; });
    UI.spotsDirty=true;
    os('我：平面图上有几个地方被反复描过：保安岗、车库、垃圾房、东围墙。',4.2);
    UI.open('mapv');
  }
};
/* 拿出来看一眼就收起来的东西 */
var ITEM_READ={card:1,notebook:1,hw:1,usb:1,key:1,roomkey:1,metronome:1,goggles:1,coat:1,battery:1,chalk:1,pen:1};
function useItem(id){
  if(!id||!hasItem(id)) return;
  var nm=ITEMS[id]?ITEMS[id].n:id;
  if(ITEM_USE.hasOwnProperty(id)){ ITEM_USE[id](id,nm); return; }
  if(ITEM_READ[id]){
    os('我：'+nm+'。'+ITEMS[id].d,3.0);
    toast(nm+(hasItem('notebook')&&hasItem('pen')?' · 线索会写进本子':''));
    return;
  }
  os('我：现在用不上「'+nm+'」。',2.2);
  toast('「'+nm+'」现在用不上');
}
/* 罗盘：室内指最近的门 / 楼梯，室外指还没去过的线索点（都去过了就指最近的校门） */
function useCompass(){
  var tx=null, ty=null, what='';
  if(S.mode==='in'){
    var R=INTERIORS[S.room], best=1e9, r, c;
    if(R) for(r=0;r<R.rows;r++) for(c=0;c<R.cols;c++){
      var ch=R.grid[r][c]; if(ch!=='O'&&ch!=='S'&&ch!=='L'&&ch!=='=') continue;
      var wx=R.ox+(c+0.5)*R.tw, wy=R.oy+(r+0.5)*R.th, d=dist2(wx,wy,S.x,S.y);
      if(d<best&&d>9*9){ best=d; tx=wx; ty=wy; what=(ch==='S'?'楼梯':ch==='O'?'出口':ch==='L'?'连廊':'门'); }
    }
  }else{
    var bd=1e18, i;
    for(i=0;i<SPOTS.length;i++){
      var sp=SPOTS[i]; if(S.spots[sp.id]) continue;
      var cx=(sp.x+sp.w/2)*SC, cy=(sp.y+sp.h/2)*SC, d2=dist2(cx,cy,S.x,S.y);
      if(d2<bd){ bd=d2; tx=cx; ty=cy; what='某个我还没去过的地方'; }
    }
    if(tx===null){
      var gs=[[GATE_N,'北门'],[GATE_W,'西小门'],[GATE_S,'南门']];
      for(i=0;i<gs.length;i++){ var gx=gs[i][0].x*SC, gy=gs[i][0].y*SC, d3=dist2(gx,gy,S.x,S.y); if(d3<bd){ bd=d3; tx=gx; ty=gy; what=gs[i][1]; } }
    }
  }
  if(tx===null){ os('我：指针在原地打转。',2.4); return; }
  var a=Math.atan2(ty-S.y,tx-S.x), rel=((a-S.ang+PI*3)%TAU)-PI;
  var dirs=['正前方','右前方','右边','右后方','正后方','左后方','左边','左前方'];
  var k=Math.round(rel/(PI/4)); k=((k%8)+8)%8;
  var m=Math.round(Math.sqrt(dist2(tx,ty,S.x,S.y))*U2M);
  toast('罗盘 → '+dirs[k]+' · 约 '+m+' 米');
  os('我：指针在抖，最后停在'+dirs[k]+'——'+what+'。',3.0);
}
function throwCoin(){
  if(S.mode!=='in'||S.room!=='garage1'){ os(S.room==='canteen1'?'我：要买饭就去打饭窗口，要买东西就去售货机。':'我：扔在这儿没意义。留着，食堂能用。',2.4); return; }
  var a=S.ang+rnd(-0.4,0.4), far=rnd(60,120);
  var R=INTERIORS.garage1, x=S.x, y=S.y;
  /* 沿投掷方向找到可落地的位置，避免诱饵落进墙里。 */
  for(var d=9;d<=far;d+=9){
    var nx=S.x+Math.cos(a)*d, ny=S.y+Math.sin(a)*d;
    if(solidAtInterior(R,nx,ny)) break;
    x=nx; y=ny;
  }
  RT.lure={x:x,y:y,t:8};
  ROAM.lureTold=0;
  removeItem('coin');
  os('我：硬币在地上滚了很远。',3);
  SFX.step();
}
function dropAt(i){
  if(!S.bag[i]) return;
  S.bagSel=i;
  dropSelected();
}
function dropSelected(){
  var id=S.bag[S.bagSel];
  if(!id){ return; }
  removeItem(id);
  /* 独有的门材料丢弃后可回原处重取，避免误丢断掉整条路线。 */
  if(id==='coil') RT.coilTaken=0;
  if(id==='lens') RT.lensTaken=0;
  if(id==='vial') RT.vialTaken=0;
  os('我：我把「'+ITEMS[id].n+'」放下了。',2.4);
  if(S.mode==='in'&&inToiletHere()&&S.room==='teach1'&&!RT.beastDrop){
    if(inBeastWindow()){
      RT.beastDrop=true;
      addClue('beast');
      os('我：东西刚落地，就被地砖缝里的什么接住了。很轻的一声："嗯。" 第三个隔间的门锁，自己弹开了。',4,OS_FORCE);
      autoSave();
    }
  }
}
function inBeastWindow(){ return S.tsec>=BEAST_T0&&S.tsec<BEAST_T1; }
function hasClock(){ return S.talent==='watch'||hasItem('watch'); }

function addClue(id){
  if(!S.clues[id]) S.clues[id]=S.day;
  RT.clue=(RT.clue||0)+1;
}
function hasClue(id){
  if(!S.clues[id]) return false;
  if(hasItem('notebook')&&hasItem('pen')) return true;
  return S.clues[id]===S.day;
}

/* ---------- 食堂：饭点以外投币买饭；售货机投币随机出东西 ---------- */
function mealNow(){ return MEALS.some(function(m){ return S.tsec>=m[0]&&S.tsec<m[1]; }); }
function canteenWindow(){
  if(!hasItem('coin')){ os('我：窗口里的人头也不抬：「饭点过了。要吃，拿钱来。」',3.2); return; }
  UI.choice('窗口里还剩一点饭菜。「一个硬币一份。」',[
    {label:'投一枚硬币买饭（SAN +24）',fn:function(){
      UI.closeChoice(); removeItem('coin');
      S.san=Math.min(100,S.san+24); restoreStamina(30);
      advanceGameTime(10);
      os('我：硬币落进铁盒子里，响了很久。饭是热的——这里第一次有热的东西。',3.8); toast('买饭 · SAN +24');
      try{ SFX.click(); }catch(e){}
    }},
    {label:'算了',fn:function(){ UI.closeChoice(); }}
  ]);
}
/* 售货机：一个硬币换一样东西，偶尔有好东西，也会吞币 */
var VEND_POOL=[['snack',24],['battery',18],['pill',14],['seal',10],['watch',7],['elixir',6],['torch',5],[null,16]];
function useVending(){
  if(!hasItem('coin')){ os('我：售货机的灯管一闪一闪。投币口旁边贴着：「只收硬币」。',3.0); return; }
  removeItem('coin');
  try{ SFX.click(); }catch(e){}
  var tot=0,i; for(i=0;i<VEND_POOL.length;i++) tot+=VEND_POOL[i][1];
  var r=Math.random()*tot, got=null;
  for(i=0;i<VEND_POOL.length;i++){ r-=VEND_POOL[i][1]; if(r<0){ got=VEND_POOL[i][0]; break; } }
  if(got&&hasItem(got)) got=null;
  if(!got){ os('我：硬币吞进去了。机器里咔哒响了一声，什么也没掉下来。玻璃后面，有一排东西转过来对着我。',4.2); return; }
  os('我：咔哒一声，掉下来一样东西——「'+ITEMS[got].n+'」。',3.0);
  addItem(got);
}
