"""GPU work elision must preserve scene pixels, low-SAN blur and render-target contents."""
from browser_case import BrowserCase


class RenderWorkTest(BrowserCase):
    backend='webgl'

    def scene(self):
        p=self.page(renderer='auto' if self.backend=='webgpu' else 'webgl')
        self.assertEqual(p.evaluate('Engine.status().backend'),self.backend)
        p.evaluate("""freshState('hard');running=false;clearIntroTimers();S.intro=0;PRO.on=false;DEV.on=true;DEV.freeze=true;
          S.tsec=760;SET.grain=0;Engine.grain(0);doEnterRoom('teach1');S.pitch=0;syncCamera(0);Sensory.reset();""")
        return p

    def test_clear_and_mipmap_elision_preserves_pixels_and_blur(self):
        p=self.scene()
        r=p.evaluate("""async()=>{
          const r=GLR.renderer,read=async()=>{
            if(r.backend)return Array.from(await r.readRenderTargetPixelsAsync(GLR.rt,0,0,GLR.rt.width,GLR.rt.height));
            const a=new Uint8Array(GLR.rt.width*GLR.rt.height*4);r.readRenderTargetPixels(GLR.rt,0,0,GLR.rt.width,GLR.rt.height,a);return Array.from(a);
          };
          let n=0;const object=r.backend?r.backend.textureUtils:r.getContext(),key=r.backend?'generateMipmaps':'generateMipmap',mip=object[key].bind(object);
          object[key]=(...args)=>{n++;return mip(...args)};
          const draw=()=>{VisualState.time=12;GLR.dustT=12;Engine.draw(0)};
          draw();const off=GLR.rt.texture.mipmapsAutoUpdate;n=0;draw();const skipped=n,first=await read();
          const update=ThreeBackend.updateSceneMipmaps;ThreeBackend.updateSceneMipmaps=()=>{GLR.rt.texture.mipmapsAutoUpdate=true};
          const render=r.render.bind(r);r.render=(s,c)=>{if(s===GLR.scene)r.clear();return render(s,c)};
          draw();const original=await read();r.render=render;ThreeBackend.updateSceneMipmaps=update;
          let changed=0;for(let i=0;i<first.length;i++)if(first[i]!==original[i])changed++;
          const sense=Sensory.view;Sensory.view=()=>({warp:0,blur:0.8,focus:0,tunnel:0});n=0;draw();const active=GLR.rt.texture.mipmapsAutoUpdate,rebuilt=n;Sensory.view=sense;
          draw();const recovered=!GLR.rt.texture.mipmapsAutoUpdate;
          // Empty the world: automatic clearing must erase the previously occupied target.
          const visible=GLR.scene.children.map(o=>[o,o.visible]);visible.forEach(x=>x[0].visible=false);draw();const empty=await read();visible.forEach(x=>x[0].visible=x[1]);
          let erased=0;for(let i=0;i<empty.length;i++)if(empty[i]!==original[i])erased++;
          return {off,skipped,changed,active,rebuilt,recovered,erased,status:Engine.status(),errors:GameModules.errors()};
        }""")
        self.assertFalse(r['off'])
        self.assertEqual(r['skipped'],0)
        self.assertEqual(r['changed'],0)
        self.assertTrue(r['active'] and r['recovered'])
        self.assertGreater(r['rebuilt'],0)
        self.assertGreater(r['erased'],1000)
        self.assertEqual(r['status']['backend'],self.backend)
        self.assertEqual(r['errors'],[])

    def test_sparse_room_batching_preserves_triangles_and_reduces_draws(self):
        p=self.scene()
        r=p.evaluate("""()=>{
          const sparse=Kit.prototype._mergeSparseInstances,rows=[];
          function inspect(g){let triangles=0,meshes=0,instances=0;g.traverse(o=>{if(o.isMesh){meshes++;const count=o.isInstancedMesh?o.count:1;
            instances+=count;triangles+=(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)*count/3;}});return {triangles,meshes,instances};}
          for(const enabled of [false,true]){
            Kit.prototype._mergeSparseInstances=function(b){if(!enabled)this.sparse=0;return sparse.call(this,b)};
            PresentationRandom.seed(1194);const g=buildRoomGeometry(INTERIORS.teach1);rows.push(inspect(g));ThreeBackend.disposeGroup(g);
          }
          Kit.prototype._mergeSparseInstances=sparse;return rows;
        }""")
        self.assertAlmostEqual(r[0]['triangles'],r[1]['triangles'],places=5)
        self.assertLess(r[1]['meshes'],r[0]['meshes']*0.8)

    def test_grass_cells_keep_every_instance_and_can_be_culled(self):
        p=self.scene()
        r=p.evaluate("""()=>{
          const quality=QUALITY;QUALITY=1;PresentationRandom.seed(1194);const g=new THREE.Group();addGrass(g);QUALITY=quality;
          const cam=new THREE.PerspectiveCamera(72,1.5,.08,240);cam.position.set(175.56,1.65,200);cam.lookAt(175.56,1.65,199);cam.updateMatrixWorld();
          const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse));
          g.updateMatrixWorld(true);let count=0,visible=0,invalid=0;const cells=[];
          g.children.forEach(o=>{count+=o.count;if(frustum.intersectsObject(o))visible+=o.count;
            if(!o.frustumCulled||!o.boundingSphere||!Number.isFinite(o.boundingSphere.radius))invalid++;
            cells.push(o.userData.grassCell);const matrix=new THREE.Matrix4(),point=new THREE.Vector3();
            for(let i=0;i<o.count;i++){o.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix);if(!o.boundingSphere.containsPoint(point))invalid++;}
          });ThreeBackend.disposeGroup(g);return {count,visible,invalid,cells};
        }""")
        self.assertGreater(r['count'],3000)
        self.assertLess(r['visible'],r['count']*0.8)
        self.assertGreater(r['visible'],0)
        self.assertEqual(r['invalid'],0)
        self.assertEqual(len(r['cells']),len(set(r['cells'])))


class NativeRenderWorkTest(RenderWorkTest):
    backend='webgpu'
    extra_browser_args=['--enable-unsafe-webgpu','--use-vulkan=swiftshader','--enable-features=Vulkan']

    def test_direct_post_matches_linear_reference_and_eliminates_output_pass(self):
        p=self.scene()
        r=p.evaluate("""async()=>{
          Engine.draw(0);const r=GLR.renderer,u=GLR.postMat.uniforms,space=r.outputColorSpace;
          const linear=ThreeBackend.target(4,4,{type:THREE.FloatType,depthBuffer:false}),encoded=ThreeBackend.target(4,4,{depthBuffer:false});
          const diffuse=u.tDiffuse.value,texture=new THREE.DataTexture(new Uint8Array([0,0,0,255]),1,1);texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;texture.needsUpdate=true;
          u.tDiffuse.value=texture;u.uFx.value=1;u.uHands.value=0;u.uAO.value=0;u.uBloom.value=0;u.uGrain.value=0;
          let maxError=0;
          for(const value of [0,8,32,64,128,255]){
            texture.image.data.set([value,value,value,255]);texture.needsUpdate=true;
            r.setRenderTarget(linear);r.render(GLR.postScene,GLR.postCam);
            const a=await r.readRenderTargetPixelsAsync(linear,1,1,1,1);
            r.setRenderTarget(encoded);ThreeBackend.drawPost();const b=await r.readRenderTargetPixelsAsync(encoded,1,1,1,1);
            for(let i=0;i<3;i++){const srgb=a[i]<=.0031308?a[i]*12.92:1.055*Math.pow(a[i],1/2.4)-.055;
              maxError=Math.max(maxError,Math.abs(Math.round(Math.min(1,Math.max(0,srgb))*255)-b[i]));}
          }
          u.tDiffuse.value=diffuse;r.setRenderTarget(null);r.info.reset();r.render(GLR.postScene,GLR.postCam);const before=Engine.metrics().calls;
          r.info.reset();ThreeBackend.drawPost();const after=Engine.metrics().calls;
          await r.backend.device.queue.onSubmittedWorkDone();texture.dispose();linear.dispose();encoded.dispose();
          return {maxError,before,after,restored:r.outputColorSpace===space&&u.uOutputSRGB.value===0,status:Engine.status()};
        }""")
        self.assertLessEqual(r['maxError'],1)
        self.assertEqual(r['before']-r['after'],1)
        self.assertTrue(r['restored'])
        self.assertEqual(r['status']['backend'],'webgpu')
