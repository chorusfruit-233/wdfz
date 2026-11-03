/* 权威导航：静态代理栅格 + 显式连接段。坐标必须携带 scene 和脚高，绝不使用当前玩家场景推断。 */
'use strict';
var PatrolNav=(function(){
  var grids={},graph=null,localCache={};
  function point(scene,x,y,fy){return {scene:scene,x:x,y:y,fy:fy||0};}
  function grid(id){
    if(grids[id])return grids[id];var d=PATROL_GEOMETRY[id];
    /* 移除可选迷宫模块时，电梯仍会进入原白色空间；直接从纯地图生成其墙体栅格。 */
    if(!d&&id==='lift_dream'&&typeof VoidMaze==='undefined'){
      var R=INTERIORS[id],W=R.cols*4,H=R.rows*4,step=R.tw/4,bytes=new Uint8Array(Math.ceil(W*H/8)),radius=.30/U2M;
      for(var y=0;y<H;y++)for(var x=0;x<W;x++){
        var wx=R.ox+(x+.5)*step,wy=R.oy+(y+.5)*step,c=Math.floor(x/4),r=Math.floor(y/4),blocked=false;
        for(var j=Math.max(0,r-1);j<=Math.min(R.rows-1,r+1);j++)for(var i=Math.max(0,c-1);i<=Math.min(R.cols-1,c+1);i++)
          if(R.grid[j][i]==='#'&&wx>R.ox+i*R.tw-radius&&wx<R.ox+(i+1)*R.tw+radius&&wy>R.oy+j*R.th-radius&&wy<R.oy+(j+1)*R.th+radius)blocked=true;
        if(blocked){var k=x+y*W;bytes[k>>3]|=1<<(k&7);}
      }
      return grids[id]={W:W,H:H,step:step,ox:R.ox,oy:R.oy,bytes:bytes};
    }
    if(!d)return null;
    var raw=atob(d.bits),bytes=new Uint8Array(raw.length);for(var i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
    return grids[id]=Object.assign({},d,{bytes:bytes});
  }
  function free(id,i,j){var g=grid(id);if(!g||i<0||j<0||i>=g.W||j>=g.H)return false;var k=i+j*g.W;if(g.bytes[k>>3]&(1<<(k&7)))return false;
    if(id==='bell1'){var R=INTERIORS.bell1,p=world(id,i,j),x=(p.x-R.cx)*U2M-SPIRAL.cx,z=(p.y-R.cy)*U2M-SPIRAL.cz,r=Math.hypot(x,z),angle=spWrap(Math.atan2(z,x)-SPIRAL.th0);
      if(r<SPIRAL.rIn+.30)return false;if(r<SPIRAL.rOut+.30&&(angle<SPIRAL.enter[0]||angle>SPIRAL.enter[1]))return false;}
    return true;}

  function cell(id,p){var g=grid(id);return [Math.floor((p.x-g.ox)/g.step),Math.floor((p.y-g.oy)/g.step)];}
  function world(id,i,j){var g=grid(id);return point(id,g.ox+(i+.5)*g.step,g.oy+(j+.5)*g.step);}
  function snap(id,p){
    var g=grid(id);if(!g)return null;var c=cell(id,p),best=null,bd=Infinity;
    for(var r=0;r<=12&&!best;r++)for(var y=-r;y<=r;y++)for(var x=-r;x<=r;x++){
      if(Math.max(Math.abs(x),Math.abs(y))!==r||!free(id,c[0]+x,c[1]+y))continue;
      var q=world(id,c[0]+x,c[1]+y),d=Math.hypot(q.x-p.x,q.y-p.y);if(d<bd){best=q;bd=d;}}
    return best;
  }
  function heap(){var a=[];return {push:function(v){a.push(v);var i=a.length-1;while(i){var p=(i-1)>>1;if(a[p].f<=v.f)break;a[i]=a[p];i=p;}a[i]=v;},pop:function(){if(!a.length)return null;var first=a[0],v=a.pop();if(a.length){var i=0;while(i*2+1<a.length){var c=i*2+1;if(c+1<a.length&&a[c+1].f<a[c].f)c++;if(a[c].f>=v.f)break;a[i]=a[c];i=c;}a[i]=v;}return first;},size:function(){return a.length;}};}
  var dirs=[[0,-1],[-1,0],[1,0],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]];
  function planar(a,b){
    if(a.scene!==b.scene)return null;var id=a.scene,g=grid(id);if(!g)return null;
    var s=snap(id,a),t=snap(id,b);if(!s||!t)return null;
    var sc=cell(id,s),tc=cell(id,t),start=sc[0]+sc[1]*g.W,end=tc[0]+tc[1]*g.W;
    var dist=new Float64Array(g.W*g.H);dist.fill(Infinity);dist[start]=0;
    var prev=new Int32Array(g.W*g.H);prev.fill(-1);var open=heap();open.push({k:start,f:0,cost:0});
    while(open.size()){
      var cur=open.pop(),k=cur.k;if(cur.cost>dist[k]+1e-9)continue;if(k===end)break;
      var x=k%g.W,y=(k-x)/g.W;
      dirs.forEach(function(d){var nx=x+d[0],ny=y+d[1];if(!free(id,nx,ny))return;
        if(d[0]&&d[1]&&(!free(id,x,ny)||!free(id,nx,y)))return;
        var nk=nx+ny*g.W,nd=dist[k]+Math.hypot(d[0],d[1]);
        if(nd<dist[nk]-1e-9){dist[nk]=nd;prev[nk]=k;open.push({k:nk,cost:nd,f:nd+Math.hypot(nx-tc[0],ny-tc[1])});}});
    }
    if(!Number.isFinite(dist[end]))return null;var out=[],at=end;
    while(at!==-1){out.push(world(id,at%g.W,Math.floor(at/g.W)));at=prev[at];}
    out.reverse();return out;
  }
  function maze(a,b){
    if(typeof VoidMaze==='undefined')return planar(a,b);
    /* 半米平面步长，脚高是节点的一部分；只沿体素顶面与 MAZE_WALK 连续表面走。 */
    function node(p){var q=VoidMaze.toScene(p.x,p.y);return {x:Math.round(q.x*2)/2,z:Math.round(q.z*2)/2,h:p.fy||0};}
    function key(p){return p.x+','+p.z+','+Math.round(p.h*1000);}
    function toW(p){var q=VoidMaze.toWorld(p.x,p.z);return point('lift_dream',q.x,q.y,p.h);}
    function h(p,t){return Math.hypot(p.x-t.x,p.z-t.z,p.h-t.h);}
    var start=node(a),goal=node(b),sk=key(start),open=heap(),seen={},prev={},nodes={},count=0,end=null;
    seen[sk]=0;nodes[sk]=start;open.push({k:sk,cost:0,f:h(start,goal)});
    while(open.size()&&count++<100000){var cur=open.pop(),p=nodes[cur.k];if(cur.cost>seen[cur.k]+1e-8)continue;
      if(h(p,goal)<.65){end=cur.k;break;}
      dirs.forEach(function(d){var x=p.x+d[0]*.5,z=p.z+d[1]*.5,g=VoidMaze.groundAt(x,z,p.h+MAZE_CFG.step);
        if(!Number.isFinite(g)||g<p.h-MAZE_CFG.snap||VoidMaze.depthAt(x,z,.30,g)>1e-7)return;
        /* 连线中点也验证，不跨过断桥、斜角或薄墙。 */
        var mx=(x+p.x)/2,mz=(z+p.z)/2,mh=VoidMaze.groundAt(mx,mz,Math.max(p.h,g)+MAZE_CFG.step);
        if(!Number.isFinite(mh)||Math.abs(mh-(p.h+g)/2)>.45||VoidMaze.depthAt(mx,mz,.30,mh)>1e-7)return;
        var q={x:x,z:z,h:g},k=key(q),cost=cur.cost+h(p,q);
        if(seen[k]===undefined||cost<seen[k]-1e-8){seen[k]=cost;nodes[k]=q;prev[k]=cur.k;open.push({k:k,cost:cost,f:cost+h(q,goal)});}
      });
    }
    if(!end)return null;var out=[];while(end){out.push(toW(nodes[end]));end=prev[end];}return out.reverse();
  }
  function bell(a,b){
    if(a.fy<.01&&b.fy<.01)return planar(a,b);
    var R=INTERIORS.bell1,C=SPIRAL,r=(C.rIn+C.rOut)/2;
    function p(angle){return point('bell1',R.cx+(C.cx+Math.cos(C.th0+angle)*r)/U2M,R.cy+(C.cz+Math.sin(C.th0+angle)*r)/U2M,angle/TAU*C.turnH);}
    function topArc(q,reverse){var polar=spPolar(R,q.x,q.y),angle=spWrap(polar.th-C.th0),steps=Math.ceil(Math.abs(angle)/.08),points=[];
      for(var j=0;j<=steps;j++){var th=C.th0+(steps?angle*j/steps:0);points.push(point('bell1',R.cx+(C.cx+Math.cos(th)*r)/U2M,R.cy+(C.cz+Math.sin(th)*r)/U2M,C.topH));}
      points.push(q);return reverse?points.reverse():points;
    }
    var out=[],aa=clamp((a.fy||0)/C.turnH*TAU,0,C.amax),bb=clamp((b.fy||0)/C.turnH*TAU,0,C.amax);
    if(aa===0){var start=planar(a,p(0));if(!start)return null;out=out.concat(start);}else if(aa===C.amax)out=topArc(a,true);else out.push(a,p(aa));
    var steps=Math.ceil(Math.abs(bb-aa)/.08);for(var i=1;i<=steps;i++)out.push(p(aa+(bb-aa)*i/steps));
    if(bb===0){var tail=planar(p(0),b);if(!tail)return null;out=out.concat(tail);}else if(bb===C.amax)out=out.concat(topArc(b,false));else out.push(b);
    return out;
  }
  function path(a,b){if(!a||!b||a.scene!==b.scene)return null;if(a.scene==='lift_dream')return maze(a,b);if(a.scene==='bell1')return bell(a,b);return planar(a,b);}
  function length(p){if(!p)return Infinity;var n=0;for(var i=1;i<p.length;i++)n+=Math.hypot(p[i].x-p[i-1].x,p[i].y-p[i-1].y,((p[i].fy||0)-(p[i-1].fy||0))/U2M);return n;}
  function tilePoint(id,c,r){var R=INTERIORS[id];return point(id,R.ox+(c+.5)*R.tw,R.oy+(r+.5)*R.th);}
  function entry(id,ch){var R=INTERIORS[id];for(var r=0;r<R.rows;r++)for(var c=0;c<R.cols;c++)if(R.grid[r][c]===ch){
    var q=snap(id,tilePoint(id,c,r));if(q)return q;}
    return snap(id,tilePoint(id,R.cols/2,R.rows-3));
  }
  function build(){
    if(graph)return graph;var g={nodes:{},edges:[],patrolEdges:[]};graph=g;
    function node(id,p){if(!p)throw new Error('无合法连接落点：'+id);g.nodes[id]=p;return id;}
    function edge(a,b,kind,base){
      var pa=g.nodes[a],pb=g.nodes[b],route=null,weight;
      if(kind==='stairs')weight=2;else if(pa.scene!==pb.scene)weight=kind==='bridge'?1:1.1;
      else{route=path(pa,pb);weight=length(route)/PAT_SPEED;}
      if(!Number.isFinite(weight))throw new Error('连接不可达：'+a+' → '+b);
      var e={a:a,b:b,kind:kind||'walk',weight:weight,points:route};g.edges.push(e);if(base)g.patrolEdges.push(g.edges.length-1);
    }
    ['admin','lab','teach','dormN','dormS'].forEach(function(host){var max=topFloorOf(host),last=null,lastEast=null;
      for(var f=1;f<=max;f++){var id=floorIdOf(host,f),R=INTERIORS[id],st=node(id+':stairs',entry(id,'S'));
        if(last)edge(last,st,'stairs',f<=5&&['admin','lab','teach'].includes(host));last=st;
        if(['admin','lab','teach'].includes(host)&&f<=5){
          var row=host==='teach'?18.5:host==='admin'?19:17;
          var east=node(id+':east',snap(id,tilePoint(id,host==='teach'?54:R.cols-5,row)));edge(st,east,'walk',true);
          if(host==='teach'){
            var right=null;for(var sr=0;sr<R.rows;sr++)for(var sc=R.cols-1;sc>=0;sc--)if(!right&&R.grid[sr][sc]==='S')right=snap(id,tilePoint(id,sc,sr));
            var eastStairs=node(id+':east-stairs',right);edge(east,eastStairs,'walk',true);
            if(lastEast)edge(lastEast,eastStairs,'stairs',true);lastEast=eastStairs;
          }
        }
        if(f===1){node(id+':entry',entry(id,'O'));edge(id+':entry',st,'walk',false);}
        if((host==='teach'||host==='lab')&&f<=5){var landing=Elevator.landing(host,f);node(id+':lift',snap(id,point(id,landing.x,landing.y)));edge(st,id+':lift','walk',false);}
      }
    });
    [['link1','admin2','lab2',true],['link2','lab2','teach2',false]].forEach(function(v){
      var id=v[0],a=v[1],b=v[2],R=INTERIORS[id],Ra=INTERIORS[a],Rb=INTERIORS[b];
      node(id+':north',snap(id,tilePoint(id,2,1)));node(id+':south',snap(id,tilePoint(id,2,R.rows-2)));edge(id+':north',id+':south','walk',true);
      node(a+':'+id,snap(a,tilePoint(a,v[3]?Ra.cols-3:2,a.startsWith('admin')?18:16)));
      node(b+':'+id,snap(b,tilePoint(b,v[3]?Rb.cols-3:2,b.startsWith('teach')?18:16)));
      edge(a+':'+id,id+':north','bridge',true);edge(b+':'+id,id+':south','bridge',true);
      edge(a+':stairs',a+':'+id,'walk',true);edge(b+':stairs',b+':'+id,'walk',true);
    });
    var exterior={teach:'teach1',bell:'bell1',dormN:'dorm1',dormS:'dorm4',canteen:'canteen1',trash:'trash1',guard:'guard1',gear:'gear1',garw:'garage1',garage:'garage1',admin:'admin1',lab:'lab1'};
    Object.keys(exterior).forEach(function(host){var id=exterior[host],pos=doorWorld(objById(host));
      node('out:'+host,snap('out',point('out',pos.x,pos.y)));
      if(!g.nodes[id+':entry'])node(id+':entry',entry(id,'O'));
      edge('out:'+host,id+':entry','entrance',false);
    });
    [['garden',534,992],['southgate',386,1276],['eastroad',704,750],['northgate',514,112],['playground',410,380],['westgate',220,624]].forEach(function(v){node('out:'+v[0],snap('out',point('out',v[1]*SC,v[2]*SC)));});
    var tour=['admin','garw','westgate','teach','bell','garden','dormN','canteen','dormS','southgate','trash','eastroad','northgate','guard','garage','playground','gear','lab','admin'];
    for(var i=1;i<tour.length;i++)edge('out:'+tour[i-1],'out:'+tour[i],'walk',true);
    /* 主路线进出行政与教学楼；其他入口为追逐适配。 */
    [['admin1:entry','admin1:stairs'],['teach1:entry','teach1:stairs'],['out:admin','admin1:entry'],['out:teach','teach1:entry']].forEach(function(v){
      var idx=g.edges.findIndex(function(e){return e.a===v[0]&&e.b===v[1]||e.b===v[0]&&e.a===v[1];});if(idx>=0&&!g.patrolEdges.includes(idx))g.patrolEdges.push(idx);
    });
    node('portal_tunnel:entry',entry('portal_tunnel','j'));node('lab1:portal',snap('lab1',tilePoint('lab1',6,2)));
    edge('lab1:stairs','lab1:portal','walk',false);edge('lab1:portal','portal_tunnel:entry','special',false);
    return g;
  }
  function localEdge(a,b){var k=a+'>'+b;if(localCache[k])return localCache[k];var g=build();return localCache[k]=path(g.nodes[a],g.nodes[b]);}
  /* 骨架图建好以后不再变：两个节点之间的最短路只算一次。以前跨场景追踪每次重规划都对起点、终点两组节点逐对重算，
     一次约 8 毫秒，其中三分之二花在这里，巡察者重新规划的那一帧会卡一下（手机上更明显）。结果和直接调用完全相同 */
  var shortCache={};
  function shortest(s,e){var k=s+'>'+e;if(!Object.prototype.hasOwnProperty.call(shortCache,k))shortCache[k]=RouteGraph.shortest(build(),s,e);return shortCache[k];}
  function nearestRoute(a,ids){
    var g=build(),best=null,targets=Array.from(new Set(ids)).sort();
    Object.keys(g.nodes).sort().forEach(function(s){if(g.nodes[s].scene!==a.scene)return;
      var lead=length(path(a,g.nodes[s]))/PAT_SPEED;if(!Number.isFinite(lead))return;
      targets.forEach(function(t){var mid=shortest(s,t);if(!mid)return;var cost=lead+mid.weight;
        if(!best||cost<best.cost-1e-8||Math.abs(cost-best.cost)<1e-8&&t<best.id)best={id:t,cost:cost};});});
    return best&&best.id;
  }
  function route(a,b){
    if(a.scene===b.scene)return {points:path(a,b),transition:null};var g=build(),starts=[],ends=[];
    Object.keys(g.nodes).forEach(function(k){if(g.nodes[k].scene===a.scene)starts.push(k);if(g.nodes[k].scene===b.scene)ends.push(k);});
    var best=null,tail={};ends.forEach(function(e){tail[e]=length(path(g.nodes[e],b))/PAT_CHASE;});
    starts.forEach(function(s){var approach=path(a,g.nodes[s]),lead=length(approach)/PAT_CHASE;if(!Number.isFinite(lead))return;
      ends.forEach(function(e){if(!Number.isFinite(tail[e]))return;var mid=shortest(s,e);if(!mid)return;var cost=lead+mid.weight+tail[e];
        if(!best||cost<best.cost){best={cost:cost,points:approach,nodes:mid.nodes,edges:mid.edges};}});});
    if(!best)return null;
    if(best.points.length>1&&length(best.points)>3)return {points:best.points,transition:null};
    var next=best.nodes[1];if(!next)return null;var edge=g.edges[best.edges[0]],target=g.nodes[next];
    if(a.scene===target.scene)return {points:path(a,target),transition:null};
    return {points:null,transition:{from:Object.assign({},a),to:Object.assign({},target),remaining:edge.weight,total:edge.weight,kind:edge.kind}};
  }
  function los(a,b){
    if(!a||!b||a.scene!==b.scene||Math.abs((a.fy||0)-(b.fy||0))>1.3)return false;
    var steps=Math.ceil(Math.hypot(a.x-b.x,a.y-b.y)/2),R=INTERIORS[a.scene];
    for(var i=1;i<steps;i++){
      var x=a.x+(b.x-a.x)*i/steps,y=a.y+(b.y-a.y)*i/steps;
      if(a.scene==='out'){if(PATROL_GEOMETRY.out.occluders.some(function(r){return x>r[0]&&x<r[2]&&y>r[1]&&y<r[3];}))return false;}
      else if(a.scene==='lift_dream'&&typeof VoidMaze!=='undefined'){var p=VoidMaze.toScene(x,y);if(VoidMaze.depthAt(p.x,p.z,0,a.fy||0))return false;}
      else {var tile=tileAt(R,x,y);if(tile==='#'||tile==='='&&!doorIsOpen(R,x,y))return false;}
    }
    return true;
  }
  function observedExit(from,to,seen){
    var g=build(),best=null;
    g.edges.forEach(function(e){var pairs=[[e.a,e.b],[e.b,e.a]];pairs.forEach(function(pair){var a=g.nodes[pair[0]],b=g.nodes[pair[1]];
      if(a.scene!==from||b.scene!==to)return;
      if(to==='out'&&INTERIORS[from]&&pair[1]!=='out:'+INTERIORS[from].host)return;
      var distance=length(path(seen,a));if(!best||distance<best.distance)best={distance:distance,to:b};
    });});return best&&Number.isFinite(best.distance)?best.to:null;
  }
  function approach(a,b,limit){
    function metric(p,d){return p&&p.length?{distance:length(p)+(d||0),direction:p[Math.min(4,p.length-1)]}:null;}
    if(a.scene===b.scene){if(Math.hypot(a.x-b.x,a.y-b.y)>limit)return null;return metric(path(a,b));}
    var g=build(),best=null;
    g.edges.forEach(function(e){[[e.a,e.b],[e.b,e.a]].forEach(function(pair){var x=g.nodes[pair[0]],y=g.nodes[pair[1]];
      if(x.scene!==a.scene||y.scene!==b.scene||Math.hypot(a.x-x.x,a.y-x.y)+Math.hypot(b.x-y.x,b.y-y.y)>limit)return;
      var m=metric(path(a,x),length(path(y,b))+e.weight*PAT_SPEED);if(m&&(!best||m.distance<best.distance))best=m;
    });});return best;
  }
  function doorAt(p){var R=INTERIORS[p.scene];if(!R)return null;var c=Math.floor((p.x-R.ox)/R.tw),r=Math.floor((p.y-R.oy)/R.th);return R.grid[r]&&R.grid[r][c]==='='?R.id+':'+c+':'+r:null;}
  return {doorAt:doorAt,point:point,grid:grid,free:free,snap:snap,path:path,length:length,entry:entry,tilePoint:tilePoint,graph:build,route:route,los:los,localEdge:localEdge,nearestRoute:nearestRoute,observedExit:observedExit,approach:approach};
})();
