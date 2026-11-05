"""Real WebGPU rasterization plus failure recovery; software Vulkan is used in CI."""
import json
from pathlib import Path
from browser_case import BrowserCase


class FallbackTest(BrowserCase):
    def boot_with(self, script='', block_library=False, corrupt_post=False):
        context=self.browser.new_context(viewport={'width':640,'height':480})
        self.contexts.append(context)
        context.add_init_script("localStorage.setItem('wdfz_pro','1');localStorage.setItem('zw3d_set',JSON.stringify({q:0,vol:0,amb:0}));"+script)
        if block_library:
            context.route('**/game3d/lib/three-webgpu.min.js',lambda route:route.abort())
        if corrupt_post:
            vendor=(Path(__file__).resolve().parents[1]/'game3d/lib/three-webgpu.min.js').read_text()
            context.route('**/game3d/lib/three-webgpu.min.js',lambda route:route.fulfill(content_type='text/javascript',
                body=vendor+";WdfzWebGPU=Object.assign({},WdfzWebGPU,{NodeMaterial:function(){throw Error('post setup denied');}});"))
        page=context.new_page();page.on('pageerror',lambda e:self.errors.append(str(e)))
        requests=[];page.on('request',lambda r:requests.append(r.url))
        page.goto(self.url,wait_until='load');page.evaluate('PHOTO_TRIED=true;running=false')
        page.wait_for_function("Engine.ready()||Engine.status().phase==='failed'",timeout=30000)
        return page,requests

    def assert_gl(self,page,reason):
        self.assertTrue(page.evaluate("Engine.ready()&&GLR.renderer.isWebGLRenderer"))
        self.assertEqual(page.evaluate('Engine.status().backend'),'webgl')
        self.assertEqual(page.evaluate('Engine.status().fallbackReason'),reason)
        self.assert_js(page,"!document.getElementById('menu').inert&&!document.getElementById('errbox')")

    def test_missing_api_uses_webgl_without_requesting_gpu_bundle(self):
        page,requests=self.boot_with("Object.defineProperty(navigator,'gpu',{value:undefined});")
        self.assert_gl(page,'gpu-unavailable')
        self.assertFalse(any('three-webgpu' in r for r in requests))

    def test_null_adapter_and_denied_device_fall_back(self):
        for adapter in ['null',"{features:new Set(),requestDevice:()=>Promise.reject(Error('device denied'))}"]:
            with self.subTest(adapter=adapter):
                page,_=self.boot_with("Object.defineProperty(navigator,'gpu',{value:{requestAdapter:async()=>("+adapter+")}});")
                self.assert_gl(page,'gpu-init-failed')

    def test_missing_optional_library_falls_back(self):
        page,_=self.boot_with("Object.defineProperty(navigator,'gpu',{value:{}});",block_library=True)
        self.assert_gl(page,'gpu-library-unavailable')

    def test_graphics_preference_is_separate_from_save_and_accepts_old_settings(self):
        page,_=self.boot_with("Object.defineProperty(navigator,'gpu',{value:undefined});")
        result=page.evaluate("""()=>{
          localStorage.setItem('zw3d_save','unchanged');loadSet();const old=SET.renderer;
          Settings.renderer('webgl');loadSet();const chosen=SET.renderer;
          SET.renderer='unknown';normalizeComfort();
          return {old,chosen,invalid:SET.renderer,save:localStorage.getItem('zw3d_save')};
        }""")
        self.assertEqual(result,dict(old='auto',chosen='webgl',invalid='auto',save='unchanged'))

    def test_both_apis_unavailable_provides_accessible_retry(self):
        page,_=self.boot_with("""Object.defineProperty(navigator,'gpu',{value:undefined});
          const get=HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext=function(kind,...args){return kind.startsWith('webgl')?null:get.call(this,kind,...args);};""")
        self.assertEqual(page.evaluate('Engine.status().phase'),'failed')
        self.assertTrue(page.locator('#rendererError').is_visible())
        self.assertTrue(page.get_by_role('button',name='重试兼容模式').is_visible())
        self.assertFalse(page.locator('#rendererLoading').is_visible())
        self.assert_js(page,"document.getElementById('menu').inert")


class NativeWebGPUTest(BrowserCase):
    # Uses actual GPUAdapter, GPUDevice, WGSL pipelines and texture readback, not a renderer mock.
    extra_browser_args=['--enable-unsafe-webgpu','--use-vulkan=swiftshader','--enable-features=Vulkan']

    def test_broadcast_panel_crowd_and_cinematics_remain_native(self):
        page=self.gpu(touch=True)
        for quality in (0,3,4):
            with self.subTest(quality=quality):
                self.set_quality(page,quality)
                page.evaluate("""S.day=2;S.tsec=1100;doEnterRoom('admin2');const R=INTERIORS.admin2;
                  S.x=R.ox+5.5*R.tw;S.y=R.oy+4.9*R.th;S.seated=false;S.pitch=0;
                  Broadcast.book();['notice1','notice2','notice3','notice4','broadcastfuse'].forEach(addItem);Broadcast.install();
                  BroadcastUI.open();BroadcastUI.paint();render(.01);""")
                self.assertTrue(page.locator('#radio-read').is_visible())
                page.evaluate("BroadcastUI.close();CUT.enabled=true;playCut('dismissal',()=>{S.screen='play';});")
                for dt in (1,4,4,4,4):
                    page.evaluate('dt=>{cutTick(dt);render(0)}',dt)
                    self.check_gpu(page)
                page.evaluate("cutSkip();deathFX('misread',{preview:true});anfxUpdate(2);render(0)")
                self.check_gpu(page)
                page.evaluate("anfxClear();S.screen='play';CUT.enabled=false;Broadcast.hold(true);for(let i=0;i<4;i++)Broadcast.tick(20.1);doExitRoom();render(0)")
                self.check_gpu(page)
                self.assert_js(page,"BroadcastView.crowd()&&BroadcastView.crowd().children.length===16&&GameModules.errors().length===0")
                page.evaluate("freshState('hard');S.screen='play';S.intro=0;PRO.on=false;running=false")

    def test_direct_elevator_and_touch_close_remain_native_in_three_quality_tiers(self):
        page=self.gpu(touch=True)
        page.evaluate("S.day=2;S.tsec=700;SEARCH.on=true;Talent.begin('tech','selected');GameRandom.bind(()=>.9)")
        for quality in (0,3,4):
            with self.subTest(quality=quality):
                self.set_quality(page,quality)
                page.evaluate("Elevator.board('lab',1);const s=Elevator.state('lab');s.door=1;s.dir=0;s.hold=4;S.pitch=.17;render(0)")
                self.assertTrue(page.locator('#lift-close').is_visible())
                page.locator('#lift-close').tap()
                self.assert_js(page,"Elevator.state('lab').dir===-1&&!UI.chooseOpen")
                page.evaluate("Elevator.press(5);Elevator.tick(1);render(0)")
                self.assert_js(page,"S.room==='lift_lab'&&S.pitch===.17")
                self.check_gpu(page)
                page.evaluate('Elevator.tick(6);Elevator.tick(.9);render(0)')
                self.assert_js(page,"S.room==='lab5'&&Elevator.inCabin()&&Collision.depth(S.x,S.y,PRAD)<1e-7&&S.pitch===.17")
                self.check_gpu(page)

    def gpu(self,touch=False):
        page=self.page(touch=touch,renderer='auto')
        state=page.evaluate('Engine.status()')
        self.assertEqual(state['backend'],'webgpu',state)
        page.evaluate("freshState('hard');running=false;S.intro=0;PRO.on=false;AN.active=false;AN.next=1e6;doEnterRoom('teach1');syncCamera(0)")
        return page

    def check_gpu(self,page):
        page.evaluate('async()=>{await GLR.renderer.backend.device.queue.onSubmittedWorkDone()}')
        self.assertEqual(page.evaluate('Engine.status().backend'),'webgpu',page.evaluate('Engine.status()'))
        self.assert_js(page,'GLR.renderer.isWebGPURenderer&&GLR.renderer.backend.isWebGPUBackend')
        self.assertEqual(page.evaluate('Lifecycle.snapshot().errors'),[])

    def test_native_backend_draws_scene_and_shares_core_types(self):
        page=self.gpu()
        before=page.evaluate('JSON.stringify({S,RT,PAT})')
        result=page.evaluate("""async()=>{
          render(0);const r=GLR.renderer;await r.backend.device.queue.onSubmittedWorkDone();
          const pixels=await r.readRenderTargetPixelsAsync(GLR.rt,0,0,GLR.rt.width,GLR.rt.height);
          let sum=0,hi=0,lo=255;for(let i=0;i<pixels.length;i+=4){sum+=pixels[i];hi=Math.max(hi,pixels[i]);lo=Math.min(lo,pixels[i]);}
          return {sum,hi,lo,shared:GLR.cam instanceof THREE.Camera&&GLR.postMat instanceof THREE.Material,
            kind:GLR.postMat.isNodeMaterial,metrics:Engine.metrics()};
        }""")
        self.assertGreater(result['sum'],1000);self.assertGreater(result['hi']-result['lo'],20)
        self.assertTrue(result['shared'] and result['kind'])
        self.assertGreater(result['metrics']['calls'],1)
        self.assertEqual(page.evaluate('JSON.stringify({S,RT,PAT})'),before)
        self.check_gpu(page)

    def test_all_quality_tiers_and_real_stair_scene_keep_gpu_and_collision(self):
        page=self.gpu()
        snapshot="()=>{const R=INTERIORS.teach1;SpaceLayout.ensureRoom(R);return JSON.stringify([R.foot,R.propExtra,R.stairExtra]);}"
        baseline=page.evaluate(snapshot)
        for quality in (0,1,2,3,4,0):
            with self.subTest(quality=quality):
                self.set_quality(page,quality)
                page.evaluate("doEnterRoom('teach1');syncCamera(0);render(0)")
                self.check_gpu(page)
                self.assertEqual(page.evaluate(snapshot),baseline)
                self.assertEqual(page.evaluate('GLR.rt.samples'),0 if quality<3 else page.evaluate('GLR.renderer.capabilities.maxSamples'))
                self.assert_js(page,'!!GLR.rt.depthTexture')
                self.assertEqual(page.evaluate('GLR.postMat.uniforms.uAO.value>0'),quality>=3)
        page.evaluate("const p=StairWorld.point('stair_teach_w',{x:-1.25,z:3.2,h:.8});doEnterRoom(p.scene,{x:p.x,y:p.y,stairHeight:p.fy});render(0)")
        self.check_gpu(page)

    def test_device_loss_preserves_session_camera_and_input_canvas(self):
        page=self.gpu()
        page.evaluate("""window.inputCanvas=document.getElementById('cv');window.scene=GLR.scene;window.cam=GLR.cam;
          window.facts=JSON.stringify({S,RT,PAT});window.oldRenderer=GLR.renderer;GLR.renderer.backend.device.destroy();""")
        page.wait_for_function("Engine.ready()&&Engine.status().backend==='webgl'",timeout=30000)
        self.assertEqual(page.evaluate('JSON.stringify({S,RT,PAT})'),page.evaluate('facts'))
        self.assert_js(page,"GLR.scene===scene&&GLR.cam===cam&&document.getElementById('cv')===inputCanvas&&GLR.renderer!==oldRenderer")
        self.assertEqual(page.evaluate('Engine.status().fallbackReason'),'gpu-device-lost')
        page.evaluate('render(0)')
        self.assert_js(page,"GLR.renderer.isWebGLRenderer&&document.querySelectorAll('.render-surface').length===1")
        self.assertEqual(page.evaluate('Lifecycle.snapshot().errors'),[])

    def test_post_setup_failure_uses_fresh_webgl_scene(self):
        page,_=FallbackTest.boot_with(self,corrupt_post=True)
        FallbackTest.assert_gl(self,page,'gpu-pipeline-failed')
        page.wait_for_function('Assets.ready()',timeout=60000)
        page.evaluate("freshState('hard');running=false;PRO.on=false;S.intro=0;doEnterRoom('teach1');render(0)")
        self.assert_js(page,'!!GLR.roomMesh&&GLR.postMat.isShaderMaterial')
        self.assertEqual(page.evaluate('Lifecycle.snapshot().errors'),[])

    def test_timed_out_adapter_is_disposed_when_it_arrives_late(self):
        page,_=FallbackTest.boot_with(self,"""
          const request=navigator.gpu.requestAdapter.bind(navigator.gpu);
          navigator.gpu.requestAdapter=options=>new Promise(resolve=>{
            window.finishAdapter=async()=>{
              const adapter=await request(options),make=adapter.requestDevice.bind(adapter);
              adapter.requestDevice=async options=>{const device=await make(options);window.lateDevice=device;
                device.lost.then(info=>window.lateReason=info.reason);return device;};
              resolve(adapter);
            };
          });
        """)
        FallbackTest.assert_gl(self,page,'gpu-timeout')
        page.evaluate("window.selected=GLR.renderer;window.inputCanvas=document.getElementById('cv');finishAdapter();")
        page.wait_for_function("window.lateReason==='destroyed'",timeout=30000)
        self.assert_js(page,"GLR.renderer===selected&&document.getElementById('cv')===inputCanvas&&document.querySelectorAll('.render-surface').length===1")
        FallbackTest.assert_gl(self,page,'gpu-timeout')

    def test_touch_look_works_immediately_after_device_loss(self):
        page=self.gpu(touch=True)
        page.evaluate('GLR.renderer.backend.device.destroy()')
        page.wait_for_function("Engine.ready()&&Engine.status().backend==='webgl'",timeout=30000)
        page.evaluate('window.angleBefore=S.ang')
        self.swipe(page)
        self.assert_js(page,'Math.abs(S.ang-angleBefore)>.02&&!LOOKDRAG.on&&INPUT.lookId===null')

    def test_opening_weather_death_preview_and_held_item_use_native_pipelines(self):
        page=self.gpu()
        page.evaluate('CUT.enabled=true;Opening.play();render(.1)')
        self.assert_js(page,'Opening.on&&CUT.on')
        self.check_gpu(page)
        page.evaluate('cutSkip();PRO.on=false;S.intro=0;render(0)')
        for kind in ('rain','moth','cup'):
            page.evaluate('kind=>{anfxSpawn(kind,S.x,S.y);render(1.2)}',kind)
            self.check_gpu(page)
        page.evaluate("anfxClear();DeathCG.warm();deathFX('neck',{preview:true});render(1.2)")
        self.check_gpu(page)
        page.evaluate("anfxClear();addItem('torch');USE.torch=true;render(0)")
        self.assert_js(page,'GLR.handRoot.visible&&GLR.postMat.uniforms.uHands.value===1')
        self.check_gpu(page)

    def test_post_hand_composition_and_inversion_change_real_pixels(self):
        page=self.gpu()
        result=page.evaluate("""async()=>{
          render(0);const r=GLR.renderer,post=GLR.postMat,u=post.uniforms;
          const out=ThreeBackend.target(32,32,{depthBuffer:false});
          const hand=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1);hand.needsUpdate=true;
          async function sample(){r.setRenderTarget(out);r.render(GLR.postScene,GLR.postCam);await r.backend.device.queue.onSubmittedWorkDone();const b=await r.readRenderTargetPixelsAsync(out,16,16,1,1);return Array.from(b);}
          const old=u.tHands.value;u.uHands.value=0;u.uGrain.value=0;const base=await sample();
          u.uInvert.value=1;const inverted=await sample();u.uInvert.value=0;
          u.tHands.value=hand;u.uHands.value=1;const held=await sample();
          u.tHands.value=old;u.uHands.value=0;r.setRenderTarget(null);hand.dispose();out.dispose();
          return {base,inverted,held};
        }""")
        self.assertGreater(sum(result['inverted'][:3]),sum(result['base'][:3])+200,result)
        self.assertGreater(sum(result['held'][:3]),sum(result['base'][:3])+100,result)
        self.check_gpu(page)

    def test_explicit_compatibility_mode_never_loads_webgpu_extension(self):
        page=self.page(renderer='webgl')
        self.assert_js(page,'GLR.renderer.isWebGLRenderer&&Engine.status().fallbackReason===null')
        self.assert_js(page,"!window.WdfzWebGPU&&!document.querySelector('script[src*=\"three-webgpu\"]')")

    def test_grain_changes_real_pixels_without_periodic_banding(self):
        page=self.gpu()
        result=page.evaluate("""async()=>{
          render(0);const r=GLR.renderer,u=GLR.postMat.uniforms;
          const out=ThreeBackend.target(1024,512,{depthBuffer:false});
          u.uHands.value=0;u.uAO.value=0;u.uBloom.value=0;u.uTime.value=12;
          async function pixels(){r.setRenderTarget(out);r.render(GLR.postScene,GLR.postCam);await r.backend.device.queue.onSubmittedWorkDone();
            return r.readRenderTargetPixelsAsync(out,450,200,96,64);}
          u.uGrain.value=0;const base=await pixels();u.uGrain.value=1;const noisy=await pixels();
          const delta=Array.from({length:96*64},(_,i)=>noisy[i*4]-base[i*4]);
          const mean=delta.reduce((a,b)=>a+b,0)/delta.length;
          const variance=delta.reduce((a,b)=>a+(b-mean)**2,0)/delta.length;
          const correlations=[4,8,10,16].map(offset=>{
            let cross=0,squareA=0,squareB=0;
            for(let y=0;y<64;y++)for(let x=0;x<96-offset;x++){
              const a=delta[y*96+x]-mean,b=delta[y*96+x+offset]-mean;
              cross+=a*b;squareA+=a*a;squareB+=b*b;
            }
            return cross/Math.sqrt(squareA*squareB);
          });
          r.setRenderTarget(null);out.dispose();return {variance,correlations};
        }""")
        self.assertGreater(result['variance'],0.05,result)
        self.assertTrue(all(abs(c)<.25 for c in result['correlations']),result)
        self.check_gpu(page)

    def test_low_san_view_closes_in_drains_and_warps_on_the_native_pipeline(self):
        # R3 第二轮：WGSL 那条后期和 WebGL 同一套 SAN 视觉（视野变小、褪色、扭曲、黑屏），不只是能编译
        page=self.gpu()
        result=page.evaluate("""async()=>{
          const r=GLR.renderer,u=GLR.postMat.uniforms,W=96,H=54,out=ThreeBackend.target(W,H,{depthBuffer:false});
          async function post(){r.setRenderTarget(out);r.render(GLR.postScene,GLR.postCam);await r.backend.device.queue.onSubmittedWorkDone();
            const b=await r.readRenderTargetPixelsAsync(out,0,0,W,H);r.setRenderTarget(null);return Array.from(b);}
          function stats(b){let inner=0,ni=0,outer=0,no=0,sat=0;
            for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4,l=.2126*b[i]+.7152*b[i+1]+.0722*b[i+2],mx=Math.max(b[i],b[i+1],b[i+2]),mn=Math.min(b[i],b[i+1],b[i+2]);
              sat+=mx>10?(mx-mn)/mx:0;const dx=Math.abs((x+.5)/W-.5),dy=Math.abs((y+.5)/H-.5);
              if(dx<.2&&dy<.2){inner+=l;ni++;}else if(Math.max(dx,dy)>.38){outer+=l;no++;}}
            return {inner:inner/ni,ratio:(outer/no)/Math.max(1e-6,inner/ni),sat:sat/(W*H)};}
          async function shot(san,dist){SET.distortion=dist;S.san=san;Sensory.reset();Sensory.frame(1/60);render(0);u.uGrain.value=0;return post();}
          const hi=stats(await shot(100,0)),lo=stats(await shot(8,0));
          await shot(8,2);['uTunnel','uBlur','uFocus','uDrain','uHalo','uGhost','uPulse','uBreath'].forEach(k=>u[k].value=0);
          u.uTime.value=1;const a=await post();u.uTime.value=3.7;const b=await post();
          let moved=0;for(let i=0;i<a.length;i+=4)moved+=Math.abs(a[i]-b[i]);moved/=a.length/4;
          u.uBlack.value=1;const dark=stats(await post());u.uBlack.value=0;
          out.dispose();return {hi,lo,moved,dark};
        }""")
        hi,lo=result['hi'],result['lo']
        self.assertGreater(lo['inner'],2,result)                       # 中间还看得见
        self.assertLess(lo['ratio'],hi['ratio']*.6,result)             # 外圈比中心暗得多：视野变小
        self.assertLess(lo['sat'],hi['sat'],result)                    # 褪色
        self.assertGreater(result['moved'],1,result)                   # 扭曲：同一帧两个时刻不一样
        self.assertLess(result['dark']['inner'],1.5,result)            # 黑屏
        self.check_gpu(page)
