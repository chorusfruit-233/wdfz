/* @module-capsule */
(function($imports){
/* 草叶的 GPU 实例；校园布局配方见 content/outdoor-recipe.js。 */
'use strict';
function addGrass(grp){
  var N=$imports.Quality.get().grass; if(!N) return;
  /* 一丛草：7 根细长的草叶，从根部往外斜，根部深、叶尖浅；法线朝上（和地面一起受光，不会一根根反白）。
     每根只有朝外的一面（从哪边看都有一半的叶子朝着你，一丛还是满的），三角形只比以前多一倍 */
  var geo=new $imports.THREE.BufferGeometry();
  var P=[], C=[], NN=[], k;
  for(k=0;k<7;k++){
    var a=k*0.8976+0.3, r0=0.012+(k%3)*0.012, lean=0.05+(k%4)*0.025, hgt=0.13+((k*7)%5)*0.03, w=0.018;
    var ca=Math.cos(a), sa=Math.sin(a), bx=ca*r0, bz=sa*r0, px=-sa*w, pz=ca*w;
    P.push(bx+px,0,bz+pz, bx-px,0,bz-pz, bx+ca*lean,hgt,bz+sa*lean);
    C.push(0.32,0.40,0.26, 0.32,0.40,0.26, 0.80,0.90,0.62);
    NN.push(ca*0.3,0.95,sa*0.3, ca*0.3,0.95,sa*0.3, ca*0.4,0.9,sa*0.4);
  }
  geo.setAttribute('position',new $imports.THREE.Float32BufferAttribute(P,3));
  geo.setAttribute('color',new $imports.THREE.Float32BufferAttribute(C,3));
  geo.setAttribute('normal',new $imports.THREE.Float32BufferAttribute(NN,3));
  var mat=new $imports.THREE.MeshLambertMaterial({vertexColors:true});
  var im=new $imports.THREE.InstancedMesh(geo,mat,N);
  var m4=new $imports.THREE.Matrix4(), qq=new $imports.THREE.Quaternion(), sv=new $imports.THREE.Vector3(), pv=new $imports.THREE.Vector3(), up=new $imports.THREE.Vector3(0,1,0);
  var col=new $imports.THREE.Color(), n=0, tries=0, cells=new Map();
  while(n<N&&tries<N*4){
    tries++;
    var mx=$imports.BOUND.x0+6+$imports.PresentationRandom.next()*($imports.BOUND.x1-$imports.BOUND.x0-12), my=$imports.BOUND.y0+6+$imports.PresentationRandom.next()*($imports.BOUND.y1-$imports.BOUND.y0-12);
    if((0,$imports.inObj)(mx,my,2,false)||(0,$imports.onRoad)(mx,my,1)) continue;
    var skip=false;
    for(var i=0;i<$imports.OBJ.length;i++){ var a2=(0,$imports.apronOf)($imports.OBJ[i]); if(a2&&(0,$imports.inRect)(mx,my,a2,1)){ skip=true; break; } }
    if(skip) continue;
    pv.set((0,$imports.M)(mx),0,(0,$imports.M)(my));
    qq.setFromAxisAngle(up,$imports.PresentationRandom.next()*6.283);
    var s=0.7+$imports.PresentationRandom.next()*0.9; sv.set(s,s*(0.8+$imports.PresentationRandom.next()*0.6),s);
    m4.compose(pv,qq,sv);
    im.setMatrixAt(n,m4);
    col.setRGB(0.40+$imports.PresentationRandom.next()*0.14,0.52+$imports.PresentationRandom.next()*0.14,0.30+$imports.PresentationRandom.next()*0.08);
    im.setColorAt(n,col);
    var cell=Math.floor(pv.x/32)+','+Math.floor(pv.z/32);
    if(!cells.has(cell))cells.set(cell,[]);
    cells.get(cell).push(n);
    n++;
  }
  // Spatial batches retain every blade and its color. Each cell gets a conservative
  // sphere so camera and shadow frusta can reject off-screen grass independently.
  cells.forEach(function(indices,key){
    var batch=new $imports.THREE.InstancedMesh(geo,mat,indices.length);
    indices.forEach(function(index,j){
      batch.instanceMatrix.array.set(im.instanceMatrix.array.subarray(index*16,index*16+16),j*16);
      im.getColorAt(index,col);batch.setColorAt(j,col);
    });
    batch.instanceMatrix.needsUpdate=true;batch.instanceColor.needsUpdate=true;
    batch.computeBoundingSphere();batch.userData.grassCell=key;grp.add(batch);
  });
  im.dispose();
  if(!cells.size){geo.dispose();mat.dispose();}
}

/* @module-exports */
GameModules.publish("game3d/js/model/outdoor.js",{
"addGrass":{get:function(){return addGrass;},set:function($value){addGrass=$value;}}
});
})(GameModules.imports("game3d/js/model/outdoor.js"));
