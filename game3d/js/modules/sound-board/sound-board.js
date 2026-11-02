/* 里世界 3D · 调试面板「工具」页里的「声音试听」（模块 sound-board）
   按类别挑声音库里的音效，点「试听」就在游戏的混音里放（带当前空间的混响）；「整类连放」把这一类从头到尾放一遍，再点一下停。
   每次播放都会在配方的范围里重新取值，所以连点几下听到的不完全一样。 */
'use strict';

var SoundBoard={
  playing:false,
  ids:function(c){ return SoundPlayer.ids().filter(function(id){ return SoundPlayer.cat(id)===c; }); },
  mount:function(){
    var page=document.getElementById('dev-page-tools');
    if(!page||document.getElementById('devsound')||typeof SoundPlayer==='undefined') return;
    var anchor=null;
    Array.prototype.forEach.call(page.querySelectorAll('.devsection h3'),function(h){ if(!anchor&&h.textContent==='运行诊断') anchor=h.parentNode.parentNode; });
    var box=document.createElement('div'); box.id='devsound';
    box.innerHTML='<div class="devsection"><div><h3>声音试听</h3><p>声音库 <b id="devsndN"></b> 个音效，全部现场合成；每次播放都有一点不同，响度按类别校准过</p></div></div>'+
      '<label for="devsndCat">类别</label><div class="devrow"><select id="devsndCat" style="min-width:0"></select><button type="button" id="devsndAll">整类连放</button></div>'+
      '<label for="devsnd">音效</label><div class="devrow"><select id="devsnd" style="min-width:0"></select><button type="button" id="devsndGo">试听</button></div>'+
      '<small id="devsndInfo"></small>';
    if(anchor) page.insertBefore(box,anchor); else page.appendChild(box);
    var cat=document.getElementById('devsndCat'), C=typeof SOUND_CATS!=='undefined'?SOUND_CATS:{};
    Object.keys(C).forEach(function(k){
      var n=SoundBoard.ids(k).length; if(!n) return;
      var o=document.createElement('option'); o.value=k; o.textContent=C[k].name+'（'+n+'）'; cat.appendChild(o);
    });
    document.getElementById('devsndN').textContent=SoundPlayer.ids().length;
    cat.onchange=SoundBoard.fill;
    document.getElementById('devsnd').onchange=SoundBoard.info;
    document.getElementById('devsndGo').onclick=SoundBoard.play;
    document.getElementById('devsndAll').onclick=SoundBoard.playAll;
    SoundBoard.fill();
  },
  fill:function(){
    var sel=document.getElementById('devsnd'), c=document.getElementById('devsndCat').value;
    sel.innerHTML='';
    SoundBoard.ids(c).forEach(function(id){ var o=document.createElement('option'); o.value=id; o.textContent=SoundPlayer.def(id).name; sel.appendChild(o); });
    SoundBoard.info();
  },
  info:function(){
    var id=document.getElementById('devsnd').value, el=document.getElementById('devsndInfo'); if(!id||!el) return;
    var lv=SoundPlayer.level(id), len=SoundPlayer.length(id);
    el.textContent=id+' · 校准 '+(lv===null?'未校准':(lv>0?'+':'')+lv.toFixed(1)+' dB')+' · 约 '+len.toFixed(1)+' 秒';
  },
  play:function(){
    try{ SFX.resume(); }catch(e){}
    var id=document.getElementById('devsnd').value; if(!id) return;
    SoundPlayer.play(id);
    try{ Dev.report('试听 '+id); }catch(e){}
  },
  playAll:function(){
    var b=document.getElementById('devsndAll');
    if(SoundBoard.playing){ SoundPlayer.stop(); SoundBoard.playing=false; b.textContent='整类连放'; return; }
    try{ SFX.resume(); }catch(e){}
    var c=document.getElementById('devsndCat').value, t=0;
    SoundBoard.ids(c).forEach(function(id){ SoundPlayer.play(id,{at:t}); t+=Math.min(4,SoundPlayer.length(id))+0.6; });
    SoundBoard.playing=true; b.textContent='停止';
    setTimeout(function(){ SoundBoard.playing=false; var bb=document.getElementById('devsndAll'); if(bb) bb.textContent='整类连放'; },t*1000);
  }
};
GameModules.on('boot',function(){ SoundBoard.mount(); },{owner:'sound-board'});
