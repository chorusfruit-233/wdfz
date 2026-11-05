"""Rendering benchmark math, real backend identity, isolation and cancellation."""
import json
import subprocess
import unittest
from pathlib import Path
from browser_case import BrowserCase

ROOT=Path(__file__).resolve().parents[1]


class BenchmarkRulesTest(unittest.TestCase):
    def node(self, source):
        return json.loads(subprocess.check_output(['node','-e',"const C=require('./benchmark/core.js');"+source],cwd=ROOT,text=True))

    def test_statistics_keep_submission_completion_and_cadence_distinct(self):
        r=self.node("console.log(JSON.stringify(C.summary([{completeMs:10,submitMs:1,intervalMs:null,calls:5},{completeMs:20,submitMs:2,intervalMs:40,calls:5},{completeMs:30,submitMs:3,intervalMs:60,calls:5}])));")
        self.assertEqual(r['complete']['mean'],20)
        self.assertEqual(r['complete']['median'],20)
        self.assertEqual(r['complete']['p95'],29)
        self.assertEqual(r['submit']['mean'],2)
        self.assertEqual(r['cadenceFps'],20)

    def test_order_alternates_and_rejects_unfair_or_insufficient_comparisons(self):
        r=self.node("""const cfg=C.config({rounds:2,quality:99});
          const meta={quality:1,viewport:[640,360,1],drawingBuffer:[640,360],target:[448,252],samples:0,canvasSamples:0,canvasAntialias:false,sceneFingerprint:'fixed',camera:{}};
          const rows=['webgl','webgpu'].map(backend=>({scene:'classroom',backend,status:'ok',meta:{...meta},samples:Array.from({length:30},()=>({completeMs:backend==='webgl'?20:10,submitMs:1}))}));
          const same=C.compare(rows,'classroom',1);rows[1].meta.canvasAntialias=true;const canvas=C.compare(rows,'classroom',1);rows[1].meta.canvasAntialias=false;rows[1].meta.samples=4;
          console.log(JSON.stringify({quality:cfg.quality,order:C.schedule(cfg).map(x=>x.backend),same,canvas,different:C.compare(rows,'classroom',1),partial:C.compare(rows.slice(0,1),'classroom',1)}));""")
        self.assertEqual(r['quality'],4)
        self.assertEqual(r['order'],['webgl','webgpu','webgpu','webgl'])
        self.assertEqual(r['same']['reductionPercent'],50)
        self.assertFalse(r['different']['comparable'])
        self.assertFalse(r['canvas']['comparable'])
        self.assertFalse(r['partial']['comparable'])


class BenchmarkHarness:
    def bench(self, unavailable=False, touch=False):
        c=self.browser.new_context(viewport={'width':390 if touch else 1000,'height':844 if touch else 700},has_touch=touch,is_mobile=touch)
        self.contexts.append(c)
        c.add_init_script("localStorage.setItem('zw3d_save','my-save');localStorage.setItem('zw3d_set',JSON.stringify({q:2,renderer:'webgl',vol:75}));localStorage.setItem('wdfz3d_achievements_v1','my-achievements');sessionStorage.setItem('bench-sentinel','session');"+(
            "Object.defineProperty(navigator,'gpu',{value:undefined,configurable:true});" if unavailable else ''))
        p=c.new_page();p.on('pageerror',lambda e:self.errors.append(str(e)));p.goto(self.url+'benchmark/')
        p.wait_for_function('window.RenderBenchmark&&window.RenderBenchmarkCore')
        return p

    def quick(self, **kwargs):
        return dict(quality=0,width=640,height=360,warmMs=0,sampleMs=250,rounds=1,scenes=['classroom'],**kwargs)


class BenchmarkBrowserTest(BenchmarkHarness, BrowserCase):
    def test_fallback_is_not_a_webgpu_score_and_persistent_stores_are_untouched(self):
        p=self.bench(unavailable=True)
        before=p.evaluate("JSON.stringify([Object.entries(localStorage),Object.entries(sessionStorage)])")
        r=p.evaluate('config=>RenderBenchmark.run(config)',self.quick())
        self.assertEqual(r['status'],'complete',r)
        self.assertIn('webgpu',r['unavailable'])
        self.assertEqual([x['backend'] for x in r['runs']],['webgl'])
        row=r['runs'][0]
        self.assertEqual(row['meta']['backend']['backend'],'webgl')
        self.assertGreaterEqual(len(row['samples']),3)
        self.assertTrue(all(s['completeMs']>=s['submitMs']>=0 for s in row['samples']))
        after=p.evaluate("JSON.stringify([Object.entries(localStorage),Object.entries(sessionStorage)])")
        self.assertEqual(before,after)
        self.assertEqual(p.locator('iframe').count(),0)
        self.assertIn('不可用',p.locator('#results').inner_text())
        self.assertFalse(p.locator('#download').is_disabled())

    def test_stop_releases_the_frame_and_mobile_controls_fit(self):
        p=self.bench(touch=True,unavailable=True)
        self.assert_js(p,'document.documentElement.scrollWidth<=innerWidth')
        p.evaluate('config=>{window.benchmarkPending=RenderBenchmark.run(config)}',dict(self.quick(),sampleMs=10000))
        p.wait_for_function("document.getElementById('status').textContent.includes('预热与采样')&&!!document.querySelector('iframe')?.contentWindow.GLR?.renderer",timeout=60000)
        p.evaluate("window.releasedGL=document.querySelector('iframe').contentWindow.GLR.renderer.getContext()")
        p.locator('#stop').click()
        r=p.evaluate('benchmarkPending')
        self.assertEqual(r['status'],'canceled')
        p.wait_for_function('releasedGL.isContextLost()')
        self.assertEqual(p.locator('iframe').count(),0)
        self.assertFalse(p.locator('#start').is_disabled())
        self.assertTrue(p.locator('#stop').is_disabled())

    def test_background_run_is_canceled_and_cannot_give_a_complete_score(self):
        p=self.bench(unavailable=True)
        p.evaluate('config=>{window.benchmarkPending=RenderBenchmark.run(config)}',self.quick())
        p.evaluate("Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'))")
        r=p.evaluate('benchmarkPending')
        self.assertEqual(r['status'],'canceled')
        self.assertEqual(p.locator('iframe').count(),0)


class BenchmarkNativeTest(BenchmarkHarness, BrowserCase):
    extra_browser_args=['--enable-unsafe-webgpu','--use-vulkan=swiftshader','--enable-features=Vulkan']

    def test_real_webgpu_and_webgl_sample_the_same_scene(self):
        p=self.bench()
        r=p.evaluate('config=>RenderBenchmark.run(config)',dict(self.quick(),scenes=['classroom','stairs','outdoor'],rounds=2))
        self.assertEqual(r['status'],'complete',r)
        self.assertEqual(r['unavailable'],{})
        self.assertEqual([x['backend'] for x in r['runs']],['webgl']*3+['webgpu']*6+['webgl']*3)
        for scene in ('classroom','stairs','outdoor'):
            rows=[x for x in r['runs'] if x['scene']==scene]
            for row in rows:
                self.assertEqual(row['meta']['backend']['backend'],row['backend'])
                self.assertEqual(row['meta']['canvasSamples'],0)
                self.assertFalse(row['meta']['canvasAntialias'])
                for key in ('quality','viewport','drawingBuffer','target','samples','canvasSamples','canvasAntialias','sceneFingerprint','camera'):
                    self.assertEqual(rows[0]['meta'][key],row['meta'][key],(scene,key))
                self.assertTrue(all(s['completeMs']>=s['submitMs']>=0 for s in row['samples']))

    def test_z_high_quality_reports_actual_specification_and_never_mislabels_fallback(self):
        p=self.bench()
        for quality in (3,4):
            with self.subTest(quality=quality):
                r=p.evaluate('config=>RenderBenchmark.run(config)',dict(self.quick(),quality=quality))
                self.assertEqual(r['status'],'complete',r)
                self.assertNotIn('webgl',r['unavailable'])
                if 'webgpu' in r['unavailable']:
                    # Device startup has the game's finite deadline; a software adapter may time out.
                    # This is a real unavailable result, and must never produce a fake GPU row.
                    self.assertFalse(any(row['backend']=='webgpu' for row in r['runs']))
                    self.assertIn('不可用',p.locator('#results').inner_text())
                else:
                    self.assertTrue(any(row['backend']=='webgpu' for row in r['runs']))
                for row in r['runs']:
                    self.assertEqual(row['meta']['quality'],quality)
                    self.assertEqual(row['meta']['backend']['backend'],row['backend'])
                    self.assertEqual(row['meta']['canvasSamples'],0)
                    self.assertFalse(row['meta']['canvasAntialias'])
                    self.assertEqual(row['meta']['target'],row['meta']['drawingBuffer'])
                    self.assertGreaterEqual(len(row['samples']),3)
