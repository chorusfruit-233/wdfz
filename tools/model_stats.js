/* 建模开销统计：每个场景建一遍，量顶点、三角形、显存（顶点和索引缓冲的字节数）、网格数（≈ 绘制次数）、建模耗时。
   用法见 tools/model_stats.py。只读、不改游戏状态（建完就销毁）。 */
var ModelStats=(function(){
  function measure(g){
    var r={meshes:0,verts:0,tris:0,bytes:0};
    g.traverse(function(o){
      if(!o.geometry) return;
      var geo=o.geometry, k, n=geo.attributes.position?geo.attributes.position.count:0;
      r.meshes++; r.verts+=n;
      r.tris+=geo.index?geo.index.count/3:n/3;
      for(k in geo.attributes) r.bytes+=geo.attributes[k].array.byteLength;
      if(geo.index) r.bytes+=geo.index.array.byteLength;
    });
    return r;
  }
  function dispose(g){ g.traverse(function(o){ if(o.geometry) o.geometry.dispose(); }); }
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
  function all(n){
    var out={rooms:{},outdoor:null,total:{meshes:0,verts:0,tris:0,bytes:0,ms:0}};
    Object.keys(INTERIORS).forEach(function(id){ var m=out.rooms[id]=room(id,n); ['meshes','verts','tris','bytes','ms'].forEach(function(k){ out.total[k]+=m[k]; }); });
    out.outdoor=outdoor(n);
    return out;
  }
  /* 几个固定机位实际画了多少：绘制次数、三角形（视锥剔除以后） */
  var VIEWS=[['teach1',[20,1.6,5.5],[-10,1.4,5.5]],['teach1',[-25,1.6,-4],[-28,1.0,-8]],['admin1',[-12,1.6,5],[-20,1,-3]],['garage1',[2,1.6,-2],[8,0.8,-8]],
             ['out',[124.6,2.2,232],[124.6,4,213]],['out',[114,2.5,30],[114,2,80]],['out',[60,6,90],[80,0,60]],['out',[150,1.7,150],[200,1.7,150]]];
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
