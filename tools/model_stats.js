/* 建模开销统计：每个场景建一遍，量顶点、三角形、显存（顶点和索引缓冲的字节数）、网格数（≈ 绘制次数）、建模耗时。
   实例化的网格（InstancedMesh）按实例个数算顶点和三角形；共用的几何体在一个场景里只算一次缓冲，另加实例矩阵和实例颜色。
   用法见 tools/model_stats.py。只读、不改游戏状态（建完就销毁）。 */
var ModelStats=(function(){
  function measure(g){
    /* inst.draws：实例数按材质组各算一次（一件模型三个材质组、摆 10 次就算 30） */
    var r={meshes:0,verts:0,tris:0,bytes:0,inst:{meshes:0,draws:0,verts:0,tris:0,bytes:0},assets:{}}, seen=new Set();
    g.traverse(function(o){
      if(!o.geometry) return;
      var geo=o.geometry, k, n=geo.attributes.position?geo.attributes.position.count:0, t=geo.index?geo.index.count/3:n/3, b=0;
      if(!seen.has(geo)){
        seen.add(geo);
        for(k in geo.attributes) b+=geo.attributes[k].array.byteLength;
        if(geo.index) b+=geo.index.array.byteLength;
      }
      r.meshes++;
      if(o.isInstancedMesh){
        var c=o.count, a=o.userData.asset||'?';
        b+=o.instanceMatrix.array.byteLength+(o.instanceColor?o.instanceColor.array.byteLength:0);
        r.inst.meshes++; r.inst.draws+=c; r.inst.verts+=n*c; r.inst.tris+=t*c; r.inst.bytes+=b;
        r.assets[a]=(r.assets[a]||0)+n*c;
        n*=c; t*=c;
      }
      r.verts+=n; r.tris+=t; r.bytes+=b;
    });
    /* 实例顶点最多的几种模型 */
    r.top=Object.keys(r.assets).map(function(a){ return [a,r.assets[a]]; }).sort(function(x,y){ return y[1]-x[1]; }).slice(0,5);
    delete r.assets;
    return r;
  }
  function dispose(g){ g.traverse(function(o){ if(o.isInstancedMesh) o.dispose(); if(o.geometry) o.geometry.dispose(); }); }
  function time(fn,n){
    var ts=[], g=null, i;
    for(i=0;i<n;i++){ if(g) dispose(g); var t0=performance.now(); g=fn(); ts.push(performance.now()-t0); }
    ts.sort(function(a,b){ return a-b; });
    return {g:g,ms:ts[Math.floor(ts.length/2)]};
  }
  function room(id,n){
    var R=INTERIORS[id], savedPiano=S.__pianoPlaced;
    var t=time(function(){ return buildRoomGeometry(R); },n||3);
    S.__pianoPlaced=savedPiano;
    var m=measure(t.g); m.ms=+t.ms.toFixed(2); dispose(t.g); return m;
  }
  function outdoor(n){
    var saved=OUT_SOLID.slice();
    var t=time(function(){ return buildOutdoorGeometry(); },n||2);
    OUT_SOLID.length=0; saved.forEach(function(x){ OUT_SOLID.push(x); });
    var m=measure(t.g); m.ms=+t.ms.toFixed(2); dispose(t.g); return m;
  }
  var SUM=['meshes','verts','tris','bytes','ms'];
  function all(n){
    var out={rooms:{},outdoor:null,total:{meshes:0,verts:0,tris:0,bytes:0,ms:0,inst:{meshes:0,draws:0,verts:0,tris:0,bytes:0}}};
    Object.keys(INTERIORS).forEach(function(id){
      var m=out.rooms[id]=room(id,n);
      SUM.forEach(function(k){ out.total[k]+=m[k]; });
      Object.keys(m.inst).forEach(function(k){ out.total.inst[k]+=m.inst[k]; });
    });
    out.outdoor=outdoor(n);
    return out;
  }
  /* 几个固定机位实际画了多少：绘制次数、三角形（视锥剔除以后）。前 8 个和以前的统计一样，后 2 个是行政楼办公层
     （一层 167 套工位和转椅）：走廊一头往另一头看、一间办公室里往北看 */
  var VIEWS=[['teach1',[20,1.6,5.5],[-10,1.4,5.5]],['teach1',[-25,1.6,-4],[-28,1.0,-8]],['admin1',[-12,1.6,5],[-20,1,-3]],['garage1',[2,1.6,-2],[8,0.8,-8]],
             ['out',[124.6,2.2,232],[124.6,4,213]],['out',[114,2.5,30],[114,2,80]],['out',[60,6,90],[80,0,60]],['out',[150,1.7,150],[200,1.7,150]],
             ['admin2',[-24,1.6,8],[20,1.4,8]],['admin2',[3.5,1.6,4],[3.5,1.2,-9]]];
  function frames(){
    var r=GLR.renderer, out=[];
    r.info.autoReset=false;
    VIEWS.forEach(function(v){
      var room=v[0], c=v[1], t=v[2];
      if(room==='out'){ if(S.mode!=='out'){ S.mode='out';S.room=null;enterWorldOut(); } }
      else if(S.room!==room||S.mode!=='in'){ S.mode='in';S.room=room;doEnterRoom(room);running=false; }
      var cam=GLR.cam; cam.position.set(c[0],c[1],c[2]); cam.lookAt(t[0],t[1],t[2]); cam.updateMatrixWorld();
      r.setRenderTarget(GLR.rt); r.info.reset(); r.render(GLR.scene,cam);
      out.push({view:room+' '+c.join(','),calls:r.info.render.calls,tris:r.info.render.triangles});
    });
    r.info.autoReset=true; r.setRenderTarget(null);
    return out;
  }
  return {room:room,outdoor:outdoor,all:all,measure:measure,frames:frames};
})();
