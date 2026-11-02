/* 带权无向图：确定性最短路、奇点最小权匹配、欧拉巡回。最优性只针对输入骨架。 */
'use strict';
var RouteGraph={
  shortest:function(g,from,to){
    var dist={},prev={},todo=Object.keys(g.nodes).sort();dist[from]=0;
    while(todo.length){
      todo.sort(function(a,b){return ((dist[a]===undefined?Infinity:dist[a])-(dist[b]===undefined?Infinity:dist[b]))||a.localeCompare(b);});
      var a=todo.shift();if(dist[a]===undefined)break;if(a===to)break;
      g.edges.forEach(function(e,i){var b=e.a===a?e.b:e.b===a?e.a:null;if(!b||todo.indexOf(b)<0)return;
        var d=dist[a]+e.weight;if(dist[b]===undefined||d<dist[b]-1e-8){dist[b]=d;prev[b]={node:a,edge:i};}});
    }
    if(dist[to]===undefined)return null;
    var nodes=[to],edges=[],cur=to;while(cur!==from){var p=prev[cur];if(!p)return null;edges.unshift(p.edge);cur=p.node;nodes.unshift(cur);}
    return {weight:dist[to],nodes:nodes,edges:edges};
  },
  postman:function(g,start){
    var degree={},odd,paths={},self=this;Object.keys(g.nodes).forEach(function(n){degree[n]=0;});
    g.edges.forEach(function(e){if(!(e.weight>=0)||!Number.isFinite(e.weight))throw new Error('非法路线边 '+e.a);degree[e.a]++;degree[e.b]++;});
    odd=Object.keys(degree).filter(function(n){return degree[n]%2;}).sort();
    if(odd.length>22)throw new Error('骨架奇点超过精确匹配预算');
    odd.forEach(function(a,i){odd.forEach(function(b,j){if(i<j){var p=self.shortest(g,a,b);if(!p)throw new Error('巡逻图不连通');paths[i+':'+j]=p;}});});
    var memo={};function match(mask){if(!mask)return {weight:0,pairs:[]};if(memo[mask])return memo[mask];
      var i=0;while(!(mask&(1<<i)))i++;var best=null;
      for(var j=i+1;j<odd.length;j++)if(mask&(1<<j)){var rest=match(mask^(1<<i)^(1<<j)),p=paths[i+':'+j],w=rest.weight+p.weight;
        if(!best||w<best.weight-1e-8)best={weight:w,pairs:[[i,j]].concat(rest.pairs)};}
      return memo[mask]=best;
    }
    var matching=match((1<<odd.length)-1),copies=g.edges.map(function(e,i){return {a:e.a,b:e.b,edge:i};});
    matching.pairs.forEach(function(p){paths[p.join(':')].edges.forEach(function(i){var e=g.edges[i];copies.push({a:e.a,b:e.b,edge:i});});});
    var adj={},used={},stack=[{node:start,edge:null}],tour=[];Object.keys(g.nodes).forEach(function(n){adj[n]=[];});
    copies.forEach(function(e,i){adj[e.a].push({to:e.b,i:i});adj[e.b].push({to:e.a,i:i});});
    Object.keys(adj).forEach(function(n){adj[n].sort(function(a,b){return a.to.localeCompare(b.to)||a.i-b.i;});});
    while(stack.length){var top=stack[stack.length-1],next;while(adj[top.node].length){next=adj[top.node].shift();if(!used[next.i])break;next=null;}
      if(next){used[next.i]=1;stack.push({node:next.to,edge:copies[next.i].edge});}else tour.push(stack.pop());}
    if(Object.keys(used).length!==copies.length)throw new Error('巡逻图有不可达分量');
    tour.reverse();return {routeVersion:1,nodes:tour.map(function(x){return x.node;}),edges:tour.slice(1).map(function(x){return x.edge;}),
      baseWeight:g.edges.reduce(function(s,e){return s+e.weight;},0),extraWeight:matching.weight,
      totalWeight:g.edges.reduce(function(s,e){return s+e.weight;},0)+matching.weight,odd:odd,matching:matching.pairs.map(function(p){return p.map(function(i){return odd[i];});})};
  }
};
