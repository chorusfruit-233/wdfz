/* 已走过的楼层草图。几何来自实际格网；墙和关着的门挡住视线后面的格子。
   存档里每层楼只存一串压缩过的位（每个字符 6 格），全校走遍也只有几 KB；
   以前每格一个 "x:y" 键，走遍全校的存档要两百多 KB，每次自动保存都要整串序列化。 */
'use strict';
var EXPLORE_B64='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
var ExplorationMap={selected:null,acc:0,bits:{},rt:null,
  state:function(){
    if(!RT.exploration||typeof RT.exploration!=='object'||Array.isArray(RT.exploration))RT.exploration={};
    if(this.rt!==RT){this.rt=RT;this.bits={};}             /* 新开一局或读档后 RT 换了：解码缓存作废 */
    return RT.exploration;
  },
  clear:function(){this.selected=null;this.acc=0;this.bits={};this.rt=null;},
  /* 某层楼的「看见过」位图；兼容此前每格一个键的旧格式 */
  seen:function(id){
    var all=this.state(),R=INTERIORS[id];if(!R)return null;
    var b=this.bits[id];if(b)return b;
    var n=R.cols*R.rows,v=all[id];b=new Uint8Array(n);
    if(typeof v==='string'){
      for(var i=0;i<v.length;i++){var q=EXPLORE_B64.indexOf(v.charAt(i));if(q<0)continue;for(var k=0;k<6;k++)if(q&(1<<k)&&i*6+k<n)b[i*6+k]=1;}
    }else if(v&&typeof v==='object'&&!Array.isArray(v)){
      Object.keys(v).forEach(function(key){var p=key.split(':').map(Number);if(Number.isInteger(p[0])&&Number.isInteger(p[1])&&p[0]>=0&&p[0]<R.cols&&p[1]>=0&&p[1]<R.rows)b[p[1]*R.cols+p[0]]=1;});
      all[id]=this.pack(b);
    }else if(v!==undefined)delete all[id];
    return this.bits[id]=b;
  },
  pack:function(b){
    var out='';
    for(var i=0;i<b.length;i+=6){var q=0;for(var k=0;k<6&&i+k<b.length;k++)if(b[i+k])q|=1<<k;out+=EXPLORE_B64.charAt(q);}
    return out.replace(/A+$/,'');
  },
  has:function(R,c,r){var b=this.seen(R.id);return !!(b&&c>=0&&r>=0&&c<R.cols&&r<R.rows&&b[r*R.cols+c]);},
  count:function(id){var b=this.seen(id),n=0;if(b)for(var i=0;i<b.length;i++)n+=b[i];return n;},
  rooms:function(){var all=this.state(),me=this;return Object.keys(all).filter(function(id){return !!INTERIORS[id]&&me.count(id)>0;});},
  visible:function(R,c,r,tc,tr){
    var dx=tc-c,dy=tr-r,n=Math.max(Math.abs(dx),Math.abs(dy))*2;
    for(var i=1;i<n;i++){
      var x=Math.floor(c+.5+dx*i/n),y=Math.floor(r+.5+dy*i/n),ch=R.grid[y]&&R.grid[y][x];
      if(x===tc&&y===tr)break;
      if(ch==='#'||(ch==='='&&!OPENDOORS[R.id+':'+x+':'+y]))return false;
    }
    return true;
  },
  observe:function(){
    if(S.mode!=='in'||S.dead||S.screen!=='play')return;
    var R=INTERIORS[S.room];if(!R)return;
    var b=this.seen(R.id),changed=false;
    var c=Math.floor((S.x-R.ox)/R.tw),r=Math.floor((S.y-R.oy)/R.th);
    for(var y=Math.max(0,r-6);y<=Math.min(R.rows-1,r+6);y++)for(var x=Math.max(0,c-6);x<=Math.min(R.cols-1,c+6);x++){
      var i=y*R.cols+x;
      if(!b[i]&&Math.hypot(x-c,y-r)<=6&&this.visible(R,c,r,x,y)){b[i]=1;changed=true;}
    }
    if(changed||typeof this.state()[R.id]!=='string')this.state()[R.id]=this.pack(b);
  },
  tick:function(dt){this.acc+=dt;if(this.acc>=.3){this.acc=0;this.observe();}},
  label:function(R,c,r){
    var key=R.id+':'+c+':'+r,ch=R.grid[r][c];
    if(RT.pendingLoot&&RT.pendingLoot[key])return '留';
    if(RT.deskUsed&&RT.deskUsed[key])return '✓';
    if(ch==='=')return OPENDOORS[key]?'开':doorLockNeed(R,c,r)?'锁':'门';
    if(ch==='V')return RT.carTried&&RT.carTried[c+':'+r]?'×':'车';
    if(ch==='K'&&R.host==='lab'&&(RT.portalBlueprints||{})[R.floor])return '✓';
    return {S:'梯',J:'电',L:'廊',O:'出',H:'藏',T:'台',K:'台',D:'机',Q:'服',u:'书',j:'门',M:'售',d:'桌',f:'柜',R:'架',q:'柜',k:'台',N:'镜',C:'仪',Y:'球',Z:'摆'}[ch]||'';
  },
  /* 字的颜色分四类：路（梯电廊出）、要留意（锁、×、留）、已解决（✓、开）、其他陈设 */
  tone:function(mark){
    if(mark==='留')return 'brass';
    if(mark==='锁'||mark==='×')return 'seal';
    if(mark==='✓'||mark==='开')return 'done';
    if('梯电廊出'.indexOf(mark)>=0)return 'route';
    return 'prop';
  },
  render:function(){
    this.observe();
    var esc=Investigation.escape,tools=document.getElementById('maptools');
    var ids=this.rooms();
    if(this.selected===null)this.selected=S.mode==='in'?S.room:'campus';
    if(this.selected!=='campus'&&ids.indexOf(this.selected)<0)this.selected='campus';
    tools.innerHTML='<label for="mapfloor">查看</label><span class="mapsel"><select id="mapfloor"><option value="campus">校园总图</option>'+
      ids.map(function(id){return '<option value="'+esc(id)+'">'+esc(INTERIORS[id].name)+(S.mode==='in'&&S.room===id?'　· 你在这里':'')+'</option>';}).join('')+'</select></span>'+
      '<span class="mapcount">走过 '+ids.length+' 处室内</span>';
    var select=document.getElementById('mapfloor');select.value=this.selected;
    select.onchange=function(){ExplorationMap.selected=this.value;UI.renderMap();};
    var box=document.getElementById('floormap'),campus=document.getElementById('mapc'),legend=document.querySelector('.maplegend');
    var R=INTERIORS[this.selected];box.hidden=!R;campus.hidden=!!R;if(legend)legend.hidden=!!R;
    if(!R)return false;
    var here=S.mode==='in'&&S.room===R.id,b=this.seen(R.id),walk=0,seenWalk=0,i;
    for(i=0;i<b.length;i++)if(R.grid[Math.floor(i/R.cols)][i%R.cols]!=='#'){walk++;if(b[i])seenWalk++;}
    var avail=Math.max(200,(box.parentElement&&box.parentElement.clientWidth||600)-4);
    var size=Math.max(9,Math.min(22,Math.floor(avail/R.cols))),w=R.cols*size,h=R.rows*size,dpr=Math.min(2,window.devicePixelRatio||1);
    var legendRows=[['route','梯','楼梯'],['route','电','电梯'],['route','廊','连廊'],['route','出','出口'],
      ['seal','锁','门锁着'],['done','✓','已搜索 / 已解决'],['brass','留','有东西没拿'],['seal','×','钥匙不匹配']];
    box.innerHTML='<div class="fm-head"><b>'+esc(R.name)+'</b><span class="fm-n">北 ↑</span>'+(here?'<em>你在这一层</em>':'')+
      '<span class="fm-pct">已看清 '+(walk?Math.round(seenWalk/walk*100):0)+'%</span></div>'+
      '<div class="floor-scroll"><canvas aria-label="'+esc(R.name)+' 已探索草图" style="width:'+w+'px;height:'+h+'px" width="'+Math.round(w*dpr)+'" height="'+Math.round(h*dpr)+'"></canvas></div>'+
      '<div class="floor-legend">'+(here?'<span><i class="fm-me"></i>你和朝向</span>':'')+legendRows.map(function(l){return '<span><i class="fm-g '+l[0]+'">'+l[1]+'</i>'+l[2]+'</span>';}).join('')+
      '</div><p class="floor-note">空白处还没看到过。桌、柜、架等字表示看到过，不代表搜过。</p>';
    var ctx=box.querySelector('canvas').getContext('2d');if(!ctx)return true;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    /* 纸背：未观察的地方只有很淡的格点 */
    ctx.fillStyle='#14110e';ctx.fillRect(0,0,w,h);
    ctx.fillStyle='rgba(221,213,196,.07)';
    for(var gy=0;gy<R.rows;gy++)for(var gx=0;gx<R.cols;gx++)ctx.fillRect(gx*size+size/2-.5,gy*size+size/2-.5,1,1);
    var S0=this,G=function(c,r){return r>=0&&c>=0&&r<R.rows&&c<R.cols?R.grid[r][c]:'#';};
    /* 看见过的地面、墙块 */
    for(var r=0;r<R.rows;r++)for(var c=0;c<R.cols;c++){
      if(!b[r*R.cols+c])continue;var ch=R.grid[r][c];
      if(ch==='#'){ctx.fillStyle='#3a342c';ctx.fillRect(c*size,r*size,size,size);}
      else{ctx.fillStyle=((c+r)&1)?'#272119':'#2a241c';ctx.fillRect(c*size,r*size,size,size);}
    }
    /* 墙的轮廓：墙格挨着看见过的地面的那条边描一道墨线 */
    ctx.strokeStyle='#c2b596';ctx.lineWidth=Math.max(1.5,size/8);ctx.lineCap='square';ctx.beginPath();
    for(r=0;r<R.rows;r++)for(c=0;c<R.cols;c++){
      if(R.grid[r][c]!=='#'||!b[r*R.cols+c])continue;
      [[0,-1],[0,1],[-1,0],[1,0]].forEach(function(d){
        var nc=c+d[0],nr=r+d[1];if(G(nc,nr)==='#'||!S0.has(R,nc,nr))return;
        var x0=c*size,y0=r*size;
        if(d[1]===-1){ctx.moveTo(x0,y0);ctx.lineTo(x0+size,y0);}
        if(d[1]===1){ctx.moveTo(x0,y0+size);ctx.lineTo(x0+size,y0+size);}
        if(d[0]===-1){ctx.moveTo(x0,y0);ctx.lineTo(x0,y0+size);}
        if(d[0]===1){ctx.moveTo(x0+size,y0);ctx.lineTo(x0+size,y0+size);}
      });
    }
    ctx.stroke();
    /* 字：路、门锁、待取物等 */
    var colors={route:'#e6dcc4',seal:'#e0675c',brass:'#e2bd6a',done:'#8fa28a',prop:'#9c9384'};
    ctx.textAlign='center';ctx.textBaseline='middle';
    for(r=0;r<R.rows;r++)for(c=0;c<R.cols;c++){
      if(!b[r*R.cols+c])continue;var mark=this.label(R,c,r);if(!mark)continue;
      var tone=this.tone(mark),cx=(c+.5)*size,cy=(r+.5)*size;
      if(tone==='brass'||tone==='seal'){ctx.fillStyle=tone==='brass'?'rgba(214,177,95,.22)':'rgba(181,51,47,.28)';ctx.fillRect(c*size+1,r*size+1,size-2,size-2);}
      ctx.fillStyle=colors[tone];
      ctx.font=(tone==='prop'?'400 ':'700 ')+Math.round(size*(tone==='prop'?.62:.74))+'px "Noto Serif SC","Noto Serif CJK SC","Songti SC","SimSun",serif';
      ctx.fillText(mark,cx,cy+.5);
    }
    if(here){
      var px=(S.x-R.ox)/R.tw*size,py=(S.y-R.oy)/R.th*size,a=S.ang,L=Math.max(9,size*.9);
      ctx.fillStyle='#d9473e';ctx.strokeStyle='#14110e';ctx.lineWidth=2;ctx.beginPath();
      ctx.moveTo(px+Math.cos(a)*L,py+Math.sin(a)*L);
      ctx.lineTo(px+Math.cos(a+2.45)*L*.62,py+Math.sin(a+2.45)*L*.62);
      ctx.lineTo(px+Math.cos(a-2.45)*L*.62,py+Math.sin(a-2.45)*L*.62);
      ctx.closePath();ctx.stroke();ctx.fill();
      var sc=box.querySelector('.floor-scroll');if(sc&&sc.clientWidth<w)sc.scrollLeft=Math.max(0,px-sc.clientWidth/2);
    }
    return true;
  }
};
