/* @module-capsule */
(function($imports){
/* 里世界 3D · 通关记录界面：主菜单入口、列表与详情、地图回放、足迹图、速通排行
   地图回放（第一版，2026-11-03 已定）：在楼层草图与校园图上按时间轴播放足迹和事件，可暂停、拖动、倍速、跳事件；
   室内只画当时见过的格子（通关时存下的草图）；没有网格的场景不画地图，只写「？？？」。
   足迹图：每个到过的场景一张，路线按时间从浅到深，停留越久圆点越大，事件标在发生的位置；可以保存成图片。 */
'use strict';
var RecordsUI=(function(){
  var view={sort:'at',route:'',diff:''}, rp=null, fp=null;
  function el(id){ return document.getElementById(id); }
  function esc(t){ return String(t).replace(/[&<>"]/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function fmt(sec){ sec=Math.max(0,Math.round(sec||0)); var m=Math.floor(sec/60), s=sec%60; return (m<10?'0':'')+m+':'+(s<10?'0':'')+s; }
  function fmtDate(t){ var d=new Date(t); function p(n){ return (n<10?'0':'')+n; } return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes()); }
  function diffName(d){ return d==='hard'?'梦魇':'预知梦'; }
  function talentName(id){ try{ return ($imports.TALENTS[id]&&$imports.TALENTS[id].n)||''; }catch(e){ return ''; } }
  function gradeOrder(g){ return $imports.GRADES.map(function(x){ return x.g; }).indexOf(g); }
  function sceneName(id){ if(id==='out') return '校园'; var R=$imports.INTERIORS[id]; return R?(R.noMap?'？？？':(R.name||id)):id; }

  /* ---------- 菜单与列表 ---------- */
  function mount(){
    var extra=document.querySelector('#menu .mextra');
    if(extra){
      var b=document.createElement('button'); b.type='button'; b.className='mside'; b.id='btnrec';
      b.innerHTML='<b>通关记录</b><i id="btnrecSub"></i>'; b.addEventListener('click',open); extra.appendChild(b);
    }
    var box=document.createElement('div'); box.id='records'; box.className='mdialog'; box.hidden=true;
    box.setAttribute('role','dialog'); box.setAttribute('aria-modal','true'); box.setAttribute('aria-labelledby','rcTitle');
    box.innerHTML='<div class="mdbox wide"><div class="tphead"><b id="rcTitle">通关记录</b><i id="rcCount"></i></div>'+
      '<p class="tplead">每次通关记一条：评级、用时、积分明细和探索度。最近 10 次和每条路线、难度的最佳记录保留回放与足迹图；记录只存在这台设备的浏览器里。</p>'+
      '<div class="rcbar"><label>排序<select id="rcSort"><option value="at">最近</option><option value="grade">评级</option><option value="time">用时</option></select></label>'+
      '<label>路线<select id="rcRoute"></select></label><label>难度<select id="rcDiff"><option value="">全部</option><option value="easy">预知梦</option><option value="hard">梦魇</option></select></label></div>'+
      '<div class="arscroll"><div id="rcList" class="rclist"></div></div>'+
      '<div class="tpfoot"><button type="button" id="rcBack">返回</button></div></div>';
    document.body.appendChild(box);
    el('rcBack').addEventListener('click',close);
    ['rcSort','rcRoute','rcDiff'].forEach(function(id){ el(id).addEventListener('change',function(){ view.sort=el('rcSort').value; view.route=el('rcRoute').value; view.diff=el('rcDiff').value; paint(); }); });
    mountReplay(); mountFootprint(); paintMenu();
  }
  function paintMenu(){ var s=el('btnrecSub'); if(!s) return; var n=$imports.RunRecords.list().filter(function(x){ return x.source!=='debug'; }).length; s.textContent=n?('通关 '+n+' 次 · 评级与回放'):'通关以后，在这里回看'; }
  function open(){ paint(); el('records').hidden=false; try{ (0,$imports.resetInputState)(); (0,$imports.releaseMouseLook)(); }catch(e){} var f=el('rcSort'); if(f) f.focus({preventScroll:true}); }
  function close(){ el('records').hidden=true; var b=el('btnrec'); if(b) b.focus({preventScroll:true}); paintMenu(); }
  function routes(list){
    var ids=$imports.ACH_PUBLIC_ENDS.slice(); list.forEach(function(x){ if(ids.indexOf(x.route)<0) ids.push(x.route); });   /* 隐藏路线只有打通过的人才会有 */
    return ids;
  }
  function paint(){
    var all=$imports.RunRecords.list(), sel=el('rcRoute'), cur=view.route;
    sel.innerHTML='<option value="">全部</option>'+routes(all).map(function(r){ var x=all.filter(function(a){ return a.route===r; })[0];
      return '<option value="'+r+'"'+(r===cur?' selected':'')+'>'+esc(x?x.routeName:(($imports.ENDINGS[r]&&$imports.ENDINGS[r].t.replace(/\s+/g,''))||r))+'</option>'; }).join('');
    var list=all.filter(function(x){ return (!view.route||x.route===view.route)&&(!view.diff||x.diff===view.diff); });
    list.sort(view.sort==='grade'?function(a,b){ return (b.gradeScore-a.gradeScore); }:view.sort==='time'?function(a,b){ return a.time.used-b.time.used; }:function(a,b){ return b.at-a.at; });
    el('rcCount').textContent=all.filter(function(x){ return x.source!=='debug'; }).length+' 次通关';
    var box=el('rcList'); box.textContent='';
    if(!list.length){ box.innerHTML='<p class="rcempty">'+(all.length?'没有符合条件的记录。':'还没有通关记录。')+'</p>'; return; }
    list.forEach(function(x){
      var b=document.createElement('button'); b.type='button'; b.className='rcrow'; b.dataset.id=x.id;
      var tags=[]; if(x.mode==='speedrun') tags.push('速通'); if(x.source==='debug') tags.push('调试生成'); if(x.replay) tags.push('回放');
      b.innerHTML='<em class="g-'+x.grade+'">'+x.grade+'</em><span><b>'+esc(x.routeName)+' · '+diffName(x.diff)+(talentName(x.talent)?' · '+esc(talentName(x.talent)):'')+'</b>'+
        '<i>'+fmtDate(x.at)+' · 用时 '+fmt(x.time.used)+' · 积分 '+x.score.total+' · 探索度 '+x.explore.pct+'%</i></span>'+
        (tags.length?'<small>'+tags.join(' · ')+'</small>':'');
      b.addEventListener('click',function(){ detail(x.id); });
      box.appendChild(b);
    });
  }
  function detail(id){
    var m=$imports.RunRecords.get(id); if(!m) return;
    el('records').hidden=true;
    $imports.ResultsUI.open(m,{back:function(){ open(); var r=document.querySelector('#rcList [data-id="'+id+'"]'); if(r) r.focus({preventScroll:true}); },backLabel:'返回列表',silent:false});
  }

  /* ---------- 地图绘制（回放与足迹图共用） ---------- */
  function bits(sketch,R){
    var v=sketch&&sketch[R.id], n=R.cols*R.rows, b=new Uint8Array(n);
    if(typeof v==='string') for(var i=0;i<v.length;i++){ var q=$imports.EXPLORE_B64.indexOf(v.charAt(i)); if(q<0) continue; for(var k=0;k<6;k++) if(q&(1<<k)&&i*6+k<n) b[i*6+k]=1; }
    return b;
  }
  /* 场景底图画到离屏画布；返回 {cv, map(wx,wy)→[px,py]} */
  function base(scene,sketch,W,H){
    var cv=document.createElement('canvas'); cv.width=W; cv.height=H; var c=cv.getContext('2d');
    c.fillStyle='#0b0a09'; c.fillRect(0,0,W,H);
    if(scene==='out'){
      var bw=$imports.BOUND.x1-$imports.BOUND.x0, bh=$imports.BOUND.y1-$imports.BOUND.y0, sc=Math.min((W-20)/bw,(H-20)/bh), ox=(W-bw*sc)/2, oy=(H-bh*sc)/2;
      function X(v){ return ox+(v-$imports.BOUND.x0)*sc; } function Y(v){ return oy+(v-$imports.BOUND.y0)*sc; }
      c.strokeStyle='rgba(120,180,150,.35)'; c.strokeRect(X($imports.BOUND.x0),Y($imports.BOUND.y0),bw*sc,bh*sc);
      c.fillStyle='rgba(150,160,150,.14)'; $imports.ROADS.forEach(function(rd){ c.fillRect(X(rd[0]),Y(rd[1]),(rd[2]-rd[0])*sc,(rd[3]-rd[1])*sc); });
      $imports.OBJ.forEach(function(o){ c.fillStyle=o.k==='roof'?'#1c2a30':'#16241b'; c.fillRect(X(o.x),Y(o.y),o.w*sc,o.h*sc); c.strokeStyle='rgba(120,180,150,.25)'; c.strokeRect(X(o.x),Y(o.y),o.w*sc,o.h*sc); });
      return {cv:cv,map:function(wx,wy){ return [X(wx/$imports.SC),Y(wy/$imports.SC)]; },scale:sc};
    }
    var R=$imports.INTERIORS[scene];
    if(!R||R.noMap){ c.fillStyle='rgba(221,213,196,.5)'; c.font='20px serif'; c.textAlign='center'; c.fillText('？？？',W/2,H/2); return {cv:cv,map:null}; }
    var cs=Math.min((W-20)/R.cols,(H-20)/R.rows), ox2=(W-R.cols*cs)/2, oy2=(H-R.rows*cs)/2, b=bits(sketch,R);
    for(var y=0;y<R.rows;y++) for(var x=0;x<R.cols;x++){
      if(!b[y*R.cols+x]) continue;
      c.fillStyle=R.grid[y][x]==='#'?'#3a3a36':'#1d2421'; c.fillRect(ox2+x*cs,oy2+y*cs,Math.ceil(cs),Math.ceil(cs));
    }
    return {cv:cv,map:function(wx,wy){ return [ox2+(wx-R.ox)/R.tw*cs,oy2+(wy-R.oy)/R.th*cs]; },scale:cs};
  }
  var KIND_COL={anomaly:'#d9b46a',patrol:'#e0857a',inspection:'#9fb7d8',choice:'#a8c79a',exam:'#a8c79a',protect:'#c9a0dc',wake:'#c9a0dc',
    death:'#ff5a4e',achieve:'#f1eadc',ending:'#ffffff',garage:'#d9b46a',maze:'#a99bc9',rest:'#7fb0a0',day:'#8a8a80',room:'#5a5a52',score:'#d8cfbf'};

  /* ---------- 回放 ---------- */
  function mountReplay(){
    var box=document.createElement('div'); box.id='replayv'; box.className='mdialog'; box.hidden=true;
    box.setAttribute('role','dialog'); box.setAttribute('aria-modal','true'); box.setAttribute('aria-labelledby','rpTitle');
    box.innerHTML='<div class="mdbox wide rpbox"><div class="tphead"><b id="rpTitle">回放</b><i id="rpScene"></i></div>'+
      '<div class="rpmain"><canvas id="rpcv"></canvas><ol id="rpEvents" class="rpevents"></ol></div>'+
      '<div class="rpctl"><button type="button" id="rpPlay">播放</button><button type="button" id="rpPrev" aria-label="上一个事件">◀ 事件</button><button type="button" id="rpNext" aria-label="下一个事件">事件 ▶</button>'+
      '<select id="rpSpeed" aria-label="倍速"><option value="1">1×</option><option value="4" selected>4×</option><option value="16">16×</option><option value="64">64×</option></select>'+
      '<input type="range" id="rpTime" min="0" max="100" step="1" aria-label="时间"><span id="rpClock"></span></div>'+
      '<div class="tpfoot"><button type="button" id="rpBack">返回</button></div></div>';
    document.body.appendChild(box);
    el('rpBack').addEventListener('click',closeReplay);
    el('rpPlay').addEventListener('click',function(){ if(!rp) return; rp.playing=!rp.playing; if(rp.playing&&rp.t>=rp.end) rp.t=0; rp.last=performance.now(); el('rpPlay').textContent=rp.playing?'暂停':'播放'; });
    el('rpPrev').addEventListener('click',function(){ jump(-1); });
    el('rpNext').addEventListener('click',function(){ jump(1); });
    el('rpTime').addEventListener('input',function(){ if(rp){ rp.t=+this.value; frame(true); } });
    box.addEventListener('keydown',function(ev){
      if(!rp) return;
      if(ev.key===' '&&ev.target.tagName!=='BUTTON'&&ev.target.tagName!=='SELECT'){ ev.preventDefault(); el('rpPlay').click(); }
      else if(ev.key==='ArrowLeft'&&ev.target.tagName!=='INPUT'){ ev.preventDefault(); jump(-1); }
      else if(ev.key==='ArrowRight'&&ev.target.tagName!=='INPUT'){ ev.preventDefault(); jump(1); }
      else if(ev.key==='Escape'){ ev.preventDefault(); ev.stopPropagation(); closeReplay(); }
    });
  }
  function load(id){
    var m=$imports.RunRecords.get(id), d=id==='current'?$imports.RunLog.snapshot():$imports.RunRecords.replay(id);
    if(!d) return null;
    var s=$imports.RunTrack.decode(d.track);
    return {meta:m,data:d,samples:s,events:d.events||[],end:s.length?Math.max(s[s.length-1][0],(d.events||[]).reduce(function(a,e){ return Math.max(a,e[0]); },0)):0};
  }
  function replay(id){
    var L=load(id); if(!L||!L.samples.length){ try{ (0,$imports.toast)('这条记录没有回放数据'); }catch(e){} return false; }
    rp={L:L,t:0,end:L.end,playing:false,last:0,cache:{},scene:null,raf:0};
    el('rpTime').max=String(L.end); el('rpTime').value='0'; el('rpPlay').textContent='播放';
    var ol=el('rpEvents'); ol.textContent='';
    L.events.forEach(function(e,i){ if(e[1]==='room') return; var li=document.createElement('li'); li.dataset.i=i; li.dataset.t=e[0];
      li.innerHTML='<i>'+fmt(e[0]/10)+'</i><span style="--c:'+(KIND_COL[e[1]]||'#d8cfbf')+'">'+esc(e[2])+'</span>'+(e[3]?'<b>'+(e[3]>0?'+':'')+e[3]+'</b>':'');
      li.addEventListener('click',function(){ rp.t=e[0]; frame(true); }); ol.appendChild(li); });
    el('replayv').hidden=false; el('rpPlay').focus({preventScroll:true});
    loop();
    return true;
  }
  function closeReplay(){ if(rp&&rp.raf) cancelAnimationFrame(rp.raf); rp=null; el('replayv').hidden=true; }
  function jump(dir){
    if(!rp) return; var ev=rp.L.events.filter(function(e){ return e[1]!=='room'; }), t=rp.t, hit=null, i;
    if(dir>0){ for(i=0;i<ev.length;i++) if(ev[i][0]>t+1){ hit=ev[i]; break; } }
    else { for(i=ev.length-1;i>=0;i--) if(ev[i][0]<t-1){ hit=ev[i]; break; } }
    if(hit){ rp.t=hit[0]; frame(true); }
  }
  function loop(){
    if(!rp) return;
    var now=performance.now();
    if(rp.playing){ rp.t+=(now-rp.last)/100*(+el('rpSpeed').value||4); if(rp.t>=rp.end){ rp.t=rp.end; rp.playing=false; el('rpPlay').textContent='播放'; } }
    rp.last=now; frame(false);
    rp.raf=requestAnimationFrame(loop);
  }
  function fitCanvas(cv){ var r=cv.getBoundingClientRect(), w=Math.max(200,Math.round(r.width||600)), h=Math.max(160,Math.round(r.height||360)); if(cv.width!==w||cv.height!==h){ cv.width=w; cv.height=h; } return {w:w,h:h}; }
  function frame(force){
    if(!rp) return;
    var cv=el('rpcv'), c=cv.getContext('2d'), sz=fitCanvas(cv), L=rp.L, pos=$imports.RunTrack.at(L.samples,rp.t); if(!pos) return;
    var scene=L.data.scenes[pos[1]]||'out', key=scene+'|'+sz.w+'x'+sz.h;
    var B=rp.cache[key]||(rp.cache[key]=base(scene,L.data.sketch,sz.w,sz.h));
    c.drawImage(B.cv,0,0);
    if(B.map){
      /* 身后最近 60 秒的轨迹 */
      c.strokeStyle='rgba(224,133,122,.7)'; c.lineWidth=2; c.beginPath(); var started=false;
      L.samples.forEach(function(s){ if(s[0]>rp.t||s[0]<rp.t-600||L.data.scenes[s[1]]!==scene) { started=false; return; } var p=B.map(s[2]*2,s[3]*2); if(!started){ c.moveTo(p[0],p[1]); started=true; } else c.lineTo(p[0],p[1]); });
      c.stroke();
      L.events.forEach(function(e){ if(e[0]>rp.t||e[1]==='room'||L.data.scenes[e[4]]!==scene) return; var p=B.map(e[5]*2,e[6]*2); c.fillStyle=KIND_COL[e[1]]||'#d8cfbf'; c.beginPath(); c.arc(p[0],p[1],3.5,0,Math.PI*2); c.fill(); });
      var me=B.map(pos[2]*2,pos[3]*2), ang=pos[4]/64*Math.PI*2;
      c.save(); c.translate(me[0],me[1]); c.rotate(ang); c.fillStyle='#f1eadc'; c.beginPath(); c.moveTo(9,0); c.lineTo(-6,5); c.lineTo(-3,0); c.lineTo(-6,-5); c.closePath(); c.fill(); c.restore();
    }
    var clk=null; (L.data.clock||[]).forEach(function(k){ if(k[0]<=rp.t) clk=k; });
    el('rpScene').textContent=sceneName(scene);
    el('rpClock').textContent=fmt(rp.t/10)+' / '+fmt(rp.end/10)+(clk?' · 第 '+clk[1]+' 天 '+(0,$imports.fmtClock)(clk[2]):'');
    if(force||rp.playing) el('rpTime').value=String(Math.round(rp.t));
    var lis=el('rpEvents').children, curLi=null;
    for(var i=0;i<lis.length;i++){ var on=+lis[i].dataset.t<=rp.t; lis[i].classList.toggle('past',on); if(on) curLi=lis[i]; }
    if(curLi&&curLi!==rp.curLi){ rp.curLi=curLi; for(var j=0;j<lis.length;j++) lis[j].classList.remove('cur'); curLi.classList.add('cur'); if(rp.playing||force) curLi.scrollIntoView({block:'nearest'}); }
  }

  /* ---------- 足迹图 ---------- */
  function mountFootprint(){
    var box=document.createElement('div'); box.id='footv'; box.className='mdialog'; box.hidden=true;
    box.setAttribute('role','dialog'); box.setAttribute('aria-modal','true'); box.setAttribute('aria-labelledby','fpTitle');
    box.innerHTML='<div class="mdbox wide rpbox"><div class="tphead"><b id="fpTitle">足迹图</b><i id="fpInfo"></i></div>'+
      '<div class="fptabs" id="fpTabs" role="tablist"></div><canvas id="fpcv"></canvas>'+
      '<p class="rsnote">颜色从浅到深是时间先后；圆点越大，在那里停得越久。</p>'+
      '<div class="tpfoot"><button type="button" id="fpSave">保存图片</button><button type="button" id="fpBack">返回</button></div></div>';
    document.body.appendChild(box);
    el('fpBack').addEventListener('click',closeFoot);
    el('fpSave').addEventListener('click',function(){
      try{ var a=document.createElement('a'); a.href=el('fpcv').toDataURL('image/png'); a.download='足迹图-'+(fp&&fp.scene||'')+'.png'; document.body.appendChild(a); a.click(); a.remove(); }catch(e){}
    });
    box.addEventListener('keydown',function(ev){ if(ev.key==='Escape'){ ev.preventDefault(); ev.stopPropagation(); closeFoot(); } });
  }
  function footprint(id){
    var L=load(id); if(!L||!L.samples.length){ try{ (0,$imports.toast)('这条记录没有足迹数据'); }catch(e){} return false; }
    var time={}, order=[];
    for(var i=0;i<L.samples.length;i++){
      var s=L.samples[i], sc=L.data.scenes[s[1]]; if(order.indexOf(sc)<0) order.push(sc);
      var nx=L.samples[i+1]; if(nx&&nx[1]===s[1]) time[sc]=(time[sc]||0)+(nx[0]-s[0]);
    }
    fp={L:L,order:order,time:time,scene:order[0]};
    var tb=el('fpTabs'); tb.textContent='';
    order.forEach(function(sc){ var b=document.createElement('button'); b.type='button'; b.setAttribute('role','tab'); b.dataset.scene=sc;
      b.textContent=sceneName(sc)+' · '+fmt((time[sc]||0)/10); b.addEventListener('click',function(){ fp.scene=sc; drawFoot(); }); tb.appendChild(b); });
    el('footv').hidden=false; drawFoot();
    var f=tb.querySelector('button'); if(f) f.focus({preventScroll:true});
    return true;
  }
  function closeFoot(){ fp=null; el('footv').hidden=true; }
  function drawFoot(){
    if(!fp) return;
    var cv=el('fpcv'), c=cv.getContext('2d'), sz=fitCanvas(cv), L=fp.L, scene=fp.scene;
    Array.prototype.forEach.call(el('fpTabs').children,function(b){ b.setAttribute('aria-selected',String(b.dataset.scene===scene)); });
    var B=base(scene,L.data.sketch,sz.w,sz.h); c.drawImage(B.cv,0,0);
    el('fpInfo').textContent=sceneName(scene)+' · 停留 '+fmt((fp.time[scene]||0)/10);
    if(!B.map) return;
    var pts=L.samples.filter(function(s){ return L.data.scenes[s[1]]===scene; }), t0=L.samples[0][0], t1=L.samples[L.samples.length-1][0]||1;
    for(var i=1;i<pts.length;i++){
      var a=pts[i-1], b=pts[i]; if(b[0]-a[0]>600) continue;
      var u=(b[0]-t0)/Math.max(1,t1-t0), p=B.map(a[2]*2,a[3]*2), q=B.map(b[2]*2,b[3]*2);
      c.strokeStyle='hsla('+Math.round(48-40*u)+',70%,'+Math.round(78-40*u)+'%,.85)'; c.lineWidth=2; c.beginPath(); c.moveTo(p[0],p[1]); c.lineTo(q[0],q[1]); c.stroke();
    }
    /* 停留：同一处（两点之间几乎没动）累计的时间 */
    for(var j=1;j<pts.length;j++){
      var dt=pts[j][0]-pts[j-1][0]; if(dt<50) continue;
      var m=B.map(pts[j-1][2]*2,pts[j-1][3]*2); c.fillStyle='rgba(217,180,106,.35)'; c.beginPath(); c.arc(m[0],m[1],Math.min(18,3+Math.sqrt(dt/10)),0,Math.PI*2); c.fill();
    }
    L.events.forEach(function(e){ if(e[1]==='room'||L.data.scenes[e[4]]!==scene) return; var p=B.map(e[5]*2,e[6]*2); c.fillStyle=KIND_COL[e[1]]||'#d8cfbf'; c.strokeStyle='#0b0a09'; c.lineWidth=1.5; c.beginPath(); c.arc(p[0],p[1],5,0,Math.PI*2); c.fill(); c.stroke(); });
  }

  /* ---------- 速通排行（速通界面里） ---------- */
  var rank={diff:'easy',route:'car',by:'time'};
  function paintRanking(box){
    var all=$imports.RunRecords.list().filter(function(x){ return x.source!=='debug'&&x.mode==='speedrun'; });
    var rs=$imports.ACH_PUBLIC_ENDS.slice(); all.forEach(function(x){ if(rs.indexOf(x.route)<0) rs.push(x.route); });
    if(rs.indexOf(rank.route)<0) rank.route=rs[0];
    var rows=$imports.RunRecords.ranking(rank.diff,rank.route,rank.by);
    var name=function(r){ var x=all.filter(function(a){ return a.route===r; })[0]; return x?x.routeName:(($imports.ENDINGS[r]&&$imports.ENDINGS[r].t.replace(/\s+/g,''))||r); };
    var wrap=document.createElement('div'); wrap.className='srrank';
    wrap.innerHTML='<p class="srsub">排行</p><div class="rcbar"><select data-k="diff" aria-label="难度"><option value="easy">预知梦</option><option value="hard">梦魇</option></select>'+
      '<select data-k="route" aria-label="路线">'+rs.map(function(r){ return '<option value="'+r+'">'+esc(name(r))+'</option>'; }).join('')+'</select>'+
      '<select data-k="by" aria-label="排序"><option value="time">按用时</option><option value="grade">按评级</option></select></div>'+
      (rows.length?'<ol>'+rows.map(function(x){ return '<li data-id="'+x.id+'"><b>'+(0,$imports.fmtRun)(x.time.rta)+'</b><em class="g-'+x.grade+'">'+x.grade+'</em><span>积分 '+x.score.total+' · '+fmtDate(x.at)+'</span></li>'; }).join('')+'</ol>'
        :'<p class="rcempty">这个组合还没有带评级的有效成绩。</p>');
    box.appendChild(wrap);
    Array.prototype.forEach.call(wrap.querySelectorAll('select'),function(s){ s.value=rank[s.dataset.k]; s.addEventListener('change',function(){ rank[s.dataset.k]=s.value; $imports.Speedrun.paintRecords(); }); });
    Array.prototype.forEach.call(wrap.querySelectorAll('li[data-id]'),function(li){ li.tabIndex=0; li.addEventListener('click',function(){ var p=el('srpick'); if(p) p.hidden=true; $imports.ResultsUI.open($imports.RunRecords.get(li.dataset.id),{back:function(){ $imports.Speedrun.open(); },backLabel:'返回速通'}); }); });
  }
  document.addEventListener('keydown',function(ev){
    var b=el('records'); if(b&&!b.hidden&&ev.key==='Escape'){ ev.preventDefault(); ev.stopImmediatePropagation(); close(); }
  },true);
  GameModules.on('boundary',function(reason){ if(reason==='menu'){ paintMenu(); closeReplay(); closeFoot(); } },{owner:'run-record'});
  return {mount:mount,open:open,close:close,paint:paint,paintMenu:paintMenu,detail:detail,replay:replay,footprint:footprint,paintRanking:paintRanking,closeReplay:closeReplay,closeFoot:closeFoot};
})();

/* @module-exports */
GameModules.publish("game3d/js/modules/run-record/records-ui.js",{
"RecordsUI":{get:function(){return RecordsUI;},set:function($value){RecordsUI=$value;}}
});
})(GameModules.imports("game3d/js/modules/run-record/records-ui.js"));
