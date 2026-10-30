"""稀疏模型批处理的画面等价性和室外绘制预算。"""
from browser_case import BrowserCase


class AssetBatchingTest(BrowserCase):
    def test_sparse_batch_preserves_transform_tint_uv_and_transparency(self):
        page = self.page()
        result = page.evaluate("""()=>{
          function make(sparse){
            let k=new Kit({inst:1,sparse:sparse});
            for(let i=0;i<2;i++)k.asset('car_sedan',2+i*.4,0,3,.65,
              {s:1.2,sx:1.3,shade:.8,tint:{body:0x82bc31}});
            return {first:k.build(),again:k.build()};
          }
          function flatten(group){
            const out={};
            group.traverse(o=>{
              if(!o.geometry)return;
              let key=o.userData.matKey,g=o.geometry,p=g.attributes.position,n=g.attributes.normal,
                  c=g.attributes.color,u=g.attributes.uv,entry=out[key]||(out[key]={values:[],triangles:0,instanced:false});
              let count=o.isInstancedMesh?o.count:1;entry.instanced||=!!o.isInstancedMesh;
              entry.triangles+=g.index.count/3*count;
              for(let j=0;j<count;j++){
                let matrix=new THREE.Matrix4(),normalMatrix=new THREE.Matrix3(),color=new THREE.Color(1,1,1);
                if(o.isInstancedMesh){o.getMatrixAt(j,matrix);o.getColorAt(j,color);}
                normalMatrix.getNormalMatrix(matrix);
                for(let i=0;i<p.count;i++){
                  let point=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(matrix);
                  let norm=new THREE.Vector3().fromBufferAttribute(n,i).applyNormalMatrix(normalMatrix);
                  entry.values.push(point.x,point.y,point.z,norm.x,norm.y,norm.z,
                                    c.getX(i)*color.r,c.getY(i)*color.g,c.getZ(i)*color.b,u.getX(i),u.getY(i));
                }
              }
            });
            return out;
          }
          let reference=make(0),batched=make(2),a=flatten(reference.first),b=flatten(batched.first),c=flatten(batched.again);
          let max=0,same=true,tri=true;
          for(let key of Object.keys(a)){
            if(!b[key]||!c[key]||a[key].values.length!==b[key].values.length||b[key].values.length!==c[key].values.length){same=false;continue;}
            tri&&=a[key].triangles===b[key].triangles&&b[key].triangles===c[key].triangles;
            for(let i=0;i<a[key].values.length;i++){
              max=Math.max(max,Math.abs(a[key].values[i]-b[key].values[i]),Math.abs(b[key].values[i]-c[key].values[i]));
            }
          }
          return {same,tri,max,transparentStillInstanced:b.glass&&b.glass.instanced,
                  opaqueMerged:!b.metal.instanced};
        }""")
        self.assertTrue(result['same'] and result['tri'], result)
        self.assertTrue(result['transparentStillInstanced'] and result['opaqueMerged'], result)
        self.assertLess(result['max'], 0.025, result)

    def test_outdoor_low_and_balanced_keep_draw_calls_bounded(self):
        page = self.page()
        for quality, mesh_limit, call_limit, triangle_limit in ((0, 200, 200, 300000), (1, 750, 700, 1100000)):
            self.set_quality(page, quality)
            stats = page.evaluate("""()=>{
              S.mode='out';S.room=null;enterWorldOut();running=false;
              let r=GLR.renderer,meshes=0,vertices=0;
              GLR.outMesh.traverse(o=>{
                if(!o.geometry)return;
                meshes++;vertices+=o.geometry.attributes.position.count*(o.isInstancedMesh?o.count:1);
              });
              r.info.autoReset=false;
              let views=[[[124.6,2.2,232],[124.6,4,213]],[[114,2.5,30],[114,2,80]]];
              let frames=views.map(([p,t])=>{
                GLR.cam.position.set(...p);GLR.cam.lookAt(...t);GLR.cam.updateMatrixWorld();
                r.setRenderTarget(GLR.rt);r.info.reset();r.render(GLR.scene,GLR.cam);
                return {calls:r.info.render.calls,tris:r.info.render.triangles};
              });
              r.info.autoReset=true;r.setRenderTarget(null);return {meshes,vertices,frames};
            }""")
            self.assertLess(stats['meshes'], mesh_limit, stats)
            for frame in stats['frames']:
                self.assertLess(frame['calls'], call_limit, stats)
                self.assertLess(frame['tris'], triangle_limit, stats)
            if quality == 0:
                self.assertLess(stats['vertices'], 450000, stats)
