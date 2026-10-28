/* 里世界 3D · 物品与线索 */
'use strict';

var USE={torch:false,phone:false,brollyShield:false};
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
function addItem(id){
  if(!id||id==='nothing') return false;
  if(S.bag.indexOf(id)>=0) return false;
  if(S.bag.length>=8){ os('我：装不下了。',2.4); return false; }
  S.bag.push(id);
  try{ SFX.pickup(); }catch(e){}
  os('我：拿到了「'+ITEMS[id].n+'」。',2.6);
  UI.bagDirty=true;
  return true;
}
function removeItem(id){
  var i=S.bag.indexOf(id);
  if(i>=0){ S.bag.splice(i,1); UI.bagDirty=true; return true; }
  return false;
}
function toggleTorch(){
  if(!hasItem('torch')){ toast('没有手电筒'); return; }
  USE.torch=!USE.torch;
  GLR.torch.intensity=USE.torch?55:0;
  toast(USE.torch?'手电：开':'手电：关');
  SFX.click();
}
function useHot(i){
  var id=S.hot[i];
  if(!id){ toast('快捷栏 '+(i+1)+' 是空的 —— Tab 打开背包，点格子右上角 '+(i?'②':'①')); return; }
  if(!hasItem(id)){ S.hot[i]=null; var el=document.getElementById('hot'); if(el) el._sig=''; toast('「'+ITEMS[id].n+'」已经不在了'); UI.renderHot(); return; }
  useItem(id);
}
function useItem(id){
  if(!id||!hasItem(id)) return;
  var nm=ITEMS[id]?ITEMS[id].n:id;
  if(id==='torch'){ toggleTorch(); return; }
  if(id==='phone'){ USE.phone=!USE.phone; GLR.torch.intensity=USE.phone?22:(USE.torch?55:0); toast(USE.phone?'手机屏幕：亮':'手机屏幕：灭'); return; }
  if(id==='brolly'){ USE.brollyShield=!USE.brollyShield; toast(USE.brollyShield?'撑开伞':'收起伞'); return; }
  if(id==='pill'){ S.san=Math.min(100,S.san+18); removeItem('pill'); os('我：药片很苦。手不抖了。',3); toast('药片 · SAN +18'); return; }
  if(id==='snack'){ S.snackT=SNACK_SEC; removeItem('snack'); os('我：甜的。腿一下子轻了。',2.4); toast('士力架 · '+SNACK_SEC+' 秒内疾跑不耗体力'); return; }
  if(id==='coin'){ throwCoin(); return; }
  if(id==='watch'){ toast('现在是 '+fmtClock(S.tsec)); os('我：现在是 '+fmtClock(S.tsec)+'。',2.6); return; }
  if(id==='compass'){ useCompass(); return; }
  if(id==='memo'){
    S.spots.data=1; S.spots.comp=1; UI.spotsDirty=true;
    os('我：纸条上是一行潦草的字：「实验楼 3F 网络中心 → 行政楼 3F 门禁机 → 西小门。钥匙在保安室。」最后一个字被划得很深。',6);
    toast('记下了：机房 · 数据终端');
    return;
  }
  if(id==='map'){
    var mapIds=['guard','garage','trash','wall'], mk;
    for(mk=0;mk<mapIds.length;mk++) S.spots[mapIds[mk]]=1;
    UI.spotsDirty=true;
    os('我：平面图上有几个地方被反复描过：保安岗、车库、垃圾房、东围墙。',4.2);
    UI.open('mapv');
    return;
  }
  if(id==='card'||id==='map'||id==='notebook'||id==='memo'||id==='hw'||id==='usb'||id==='key'||id==='roomkey'||id==='metronome'||id==='goggles'||id==='coat'||id==='battery'||id==='chalk'||id==='pen'){
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
  if(S.mode!=='in'||S.room!=='garage1'){ os('我：扔在这儿没意义。',2); return; }
  var a=S.ang+rnd(-0.4,0.4), far=rnd(60,120);
  RT.lure={x:S.x+Math.cos(a)*far,y:S.y+Math.sin(a)*far,t:8};
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
  os('我：我把「'+ITEMS[id].n+'」放下了。',2.4);
  if(S.mode==='in'&&inToiletHere()&&!RT.beastDrop){
    if(inBeastWindow()&&S.room==='teach1'){
      RT.beastDrop=true;
      os('我：东西刚落地，就被地砖缝里的什么接住了。很轻的一声："嗯。" ——现在，去敲第三个隔间的门。',5);
      addClue('beast');
    }
  }
}
/* 《先辈》的时间窗：11:43–11:52。以前只有 11:45–11:46 一分钟（上课时流速下不到 1 秒），几乎不可能做到 */
function inBeastWindow(){ return S.tsec>=703&&S.tsec<=712; }

function addClue(id){
  if(!S.clues[id]) S.clues[id]=S.day;
  RT.clue=(RT.clue||0)+1;
}
function hasClue(id){
  if(!S.clues[id]) return false;
  if(hasItem('notebook')&&hasItem('pen')) return true;
  return S.clues[id]===S.day;
}
