/* 已走过的楼层草图。几何来自实际格网；墙和关门阻止记录视线后面的格子。 */
'use strict';
var ExplorationMap={selected:null,acc:0,
  state:function(){
    if(!RT.exploration||typeof RT.exploration!=='object'||Array.isArray(RT.exploration))RT.exploration={};
    return RT.exploration;
  },
  clear:function(){this.selected=null;this.acc=0;},
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
    var all=this.state(),known=all[R.id];
    if(!known||typeof known!=='object'||Array.isArray(known))known=all[R.id]={};
    var c=Math.floor((S.x-R.ox)/R.tw),r=Math.floor((S.y-R.oy)/R.th);
    for(var y=Math.max(0,r-6);y<=Math.min(R.rows-1,r+6);y++)for(var x=Math.max(0,c-6);x<=Math.min(R.cols-1,c+6);x++){
      if(Math.hypot(x-c,y-r)<=6&&this.visible(R,c,r,x,y))known[x+':'+y]=1;
    }
  },
  tick:function(dt){this.acc+=dt;if(this.acc>=.3){this.acc=0;this.observe();}},
  label:function(R,c,r){
    var key=R.id+':'+c+':'+r,ch=R.grid[r][c];
    if(RT.pendingLoot&&RT.pendingLoot[key])return '留';
    if(RT.deskUsed&&RT.deskUsed[key])return '✓';
    if(ch==='=')return OPENDOORS[key]?'开':doorLockNeed(R,c,r)?'锁':'门';
    if(ch==='V')return RT.carTried&&RT.carTried[c+':'+r]?'×':'车';
    if(ch==='K'&&R.host==='lab'&&(RT.portalBlueprints||{})[R.floor])return '✓';
    return {S:'梯',J:'电',L:'廊',O:'出',H:'藏',T:'台',K:'台',D:'机',Q:'服',u:'书',j:'门',M:'售',d:'柜',f:'柜',R:'架',q:'柜',k:'台',N:'镜',C:'仪',Y:'球',Z:'摆'}[ch]||'';
  },
  render:function(){
    this.observe();
    var all=this.state(),esc=Investigation.escape,tools=document.getElementById('maptools');
    var ids=Object.keys(all).filter(function(id){return !!INTERIORS[id];});
    if(this.selected===null)this.selected=S.mode==='in'?S.room:'campus';
    if(this.selected!=='campus'&&ids.indexOf(this.selected)<0)this.selected='campus';
    tools.innerHTML='<label for="mapfloor">查看地图</label> <select id="mapfloor"><option value="campus">校园总图</option>'+ids.map(function(id){return '<option value="'+esc(id)+'">'+esc(INTERIORS[id].name)+'</option>';}).join('')+'</select>';
    var select=document.getElementById('mapfloor');select.value=this.selected;
    select.onchange=function(){ExplorationMap.selected=this.value;UI.renderMap();};
    var box=document.getElementById('floormap'),campus=document.getElementById('mapc'),legend=document.querySelector('.maplegend');
    var R=INTERIORS[this.selected];box.hidden=!R;campus.hidden=!!R;if(legend)legend.hidden=!!R;
    if(!R)return false;
    var known=all[R.id],size=14,w=R.cols*size,h=R.rows*size;
    box.innerHTML='<p>'+esc(R.name)+' · 北 ↑ '+(S.mode==='in'&&S.room===R.id?' · ● 当前楼层':'')+'</p><div class="floor-scroll"><canvas width="'+w+'" height="'+h+'" aria-label="已探索楼层草图"></canvas></div><p class="floor-legend">● 你　梯 楼梯　电 电梯　廊 连廊　出 出口　锁 门锁　✓ 已搜索 / 已解决　留 有待取物　× 车钥匙不匹配<br>空白处尚未观察。台、柜、架等字表示已看到，未必已搜索。</p>';
    var ctx=box.querySelector('canvas').getContext('2d');ctx.fillStyle='#080e11';ctx.fillRect(0,0,w,h);
    ctx.font='10px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    Object.keys(known).forEach(function(key){
      var p=key.split(':').map(Number),c=p[0],r=p[1];if(!Number.isInteger(c)||!Number.isInteger(r)||!R.grid[r]||c<0||c>=R.cols)return;
      var ch=R.grid[r][c];ctx.fillStyle=ch==='#'?'#536268':'#202e32';ctx.fillRect(c*size,r*size,size-1,size-1);
      var mark=ExplorationMap.label(R,c,r);if(mark){ctx.fillStyle=mark==='留'?'#ffe49a':'#d9eee5';ctx.fillText(mark,(c+.5)*size,(r+.5)*size);}
    });
    if(S.mode==='in'&&S.room===R.id){ctx.fillStyle='#99f0bb';ctx.beginPath();ctx.arc((S.x-R.ox)/R.tw*size,(S.y-R.oy)/R.th*size,4,0,Math.PI*2);ctx.fill();}
    return true;
  }
};
