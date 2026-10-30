"""模型资源失败恢复、画质切换以及压缩包完整性。"""
from pathlib import Path
import shutil
import subprocess
import unittest

from browser_case import BrowserCase

ROOT = Path(__file__).resolve().parents[1]


class AssetLoadingTest(BrowserCase):
    def new_menu(self, quality):
        context = self.browser.new_context(viewport={'width': 1000, 'height': 700})
        self.contexts.append(context)
        context.add_init_script(
            "localStorage.setItem('wdfz_pro','1');"
            "localStorage.setItem('zw3d_set',JSON.stringify({q:%d,amb:0,vol:0}));" % quality
        )
        page = context.new_page()
        page.on('pageerror', lambda e: self.errors.append(str(e)))
        return context, page

    def test_touch_settings_without_quality_boot_the_selected_model_pack(self):
        context = self.browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)
        self.contexts.append(context)
        context.add_init_script("""localStorage.setItem('wdfz_pro','1');
            localStorage.setItem('zw3d_set',JSON.stringify({vol:35,amb:0}));""")
        page = context.new_page()
        page.on('pageerror', lambda e: self.errors.append(str(e)))
        page.goto(self.url, wait_until='load')
        self.assert_js(page, "QUALITY===1&&Assets.want()===2&&Assets.ready(2)")

    def test_missing_boot_pack_stays_in_menu_and_retry_restores_collision(self):
        context, page = self.new_menu(1)
        pattern = '**/game3d/assets/models_l2.js'
        context.route(pattern, lambda route: route.abort())
        page.goto(self.url, wait_until='load')
        page.locator('#assetNotice').wait_for(state='visible')
        self.assert_js(page, "!ASSETS.loading[2]&&ASSETS.errors[2]&&!Assets.anyReady()")
        page.locator('#menu .mcard').first.click()
        page.wait_for_function("!ASSETS.loading[2]&&ASSETS.errors[2]", timeout=10000)
        self.assert_js(page, "S.screen==='menu'&&!GLR.roomMesh&&!Assets.anyReady()")
        self.assertIn('失败', page.locator('#assetNoticeText').inner_text())

        context.unroute(pattern)
        page.locator('#assetRetry').click()
        page.wait_for_function("Assets.ready(2)&&document.getElementById('assetNotice').hidden", timeout=30000)
        page.locator('#menu .mcard').first.click()
        page.wait_for_function("S.screen==='play'&&GLR.roomMesh&&GLR.roomMesh.userData.roomId==='teach1'", timeout=30000)
        self.assert_js(page, "INTERIORS.teach1.foot['5,2']&&INTERIORS.teach1.foot['5,2'].length>0")

    def test_touch_can_retry_a_missing_boot_pack(self):
        context = self.browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)
        self.contexts.append(context)
        context.add_init_script("localStorage.setItem('wdfz_pro','1');"
                                "localStorage.setItem('zw3d_set',JSON.stringify({q:0,amb:0,vol:0}));")
        page = context.new_page()
        page.on('pageerror', lambda e: self.errors.append(str(e)))
        pattern = '**/game3d/assets/models_l3.js'
        context.route(pattern, lambda route: route.abort())
        page.goto(self.url, wait_until='load')
        page.locator('#assetNotice').wait_for(state='visible')
        context.unroute(pattern)
        page.locator('#assetRetry').scroll_into_view_if_needed()
        page.locator('#assetRetry').tap()
        page.wait_for_function("Assets.ready(3)&&document.getElementById('assetNotice').hidden", timeout=30000)

    def test_failed_quality_load_can_retry_without_accumulating_callbacks(self):
        context, page = self.new_menu(0)
        page.goto(self.url, wait_until='load')
        page.evaluate("PHOTO_TRIED=true;Game.start('easy');clearIntroTimers()")
        page.wait_for_function("S.screen==='play'&&GLR.roomMesh&&GLR.roomMesh.userData.roomId==='teach1'", timeout=30000)
        page.evaluate("""running=false;window.collisionBefore=JSON.stringify(INTERIORS.teach1.foot);
            window.originalApply=ThreeBackend.applyQuality;window.applyCount=0;
            ThreeBackend.applyQuality=function(){window.applyCount++;return originalApply.apply(this,arguments);};0;""")
        pattern = '**/game3d/assets/models_l1.js'
        context.route(pattern, lambda route: route.abort())
        for _ in range(3):
            page.evaluate('Settings.q(3)')
            page.wait_for_function("ASSETS.errors[1]&&!ASSETS.loading[1]", timeout=10000)
            self.assert_js(page, "!ASSETS.waiters[1]&&JSON.stringify(INTERIORS.teach1.foot)===collisionBefore")
        self.assertEqual(page.evaluate('applyCount'), 3)

        context.unroute(pattern)
        page.evaluate('Settings.q(3)')
        page.wait_for_function("Assets.ready(1)&&!ASSETS.loading[1]", timeout=30000)
        self.assertEqual(page.evaluate('applyCount'), 5)
        self.assert_js(page, "QUALITY===3&&JSON.stringify(INTERIORS.teach1.foot)===collisionBefore")

    def test_held_items_follow_loaded_quality_and_release_old_geometry(self):
        context, page = self.new_menu(0)
        page.goto(self.url, wait_until='load')
        page.evaluate("PHOTO_TRIED=true;Game.start('easy');clearIntroTimers()")
        page.wait_for_function("S.screen==='play'&&GLR.roomMesh", timeout=30000)
        page.evaluate("""running=false;S.bag=['torch','brolly','phone'];
            USE.torch=true;USE.brollyShield=true;handsTick(.016);
            window.oldItems=Object.assign({},HANDS.items);window.disposed={};
            Object.keys(oldItems).forEach(k=>{
              oldItems[k].children[0].geometry.addEventListener('dispose',()=>{disposed[k]=(disposed[k]||0)+1;});
            });""")
        self.set_quality(page, 3)
        page.evaluate("handsTick(.016)")
        self.assert_js(page, """HANDS.items.torch!==oldItems.torch&&HANDS.items.brolly!==oldItems.brolly&&
            HANDS.items.torch.userData.assetLod===1&&HANDS.items.brolly.userData.assetLod===1&&
            HANDS.items.torch.parent===HANDS.R&&HANDS.items.brolly.parent===HANDS.L&&
            disposed.torch===1&&disposed.brolly===1&&USE.torch""")
        page.evaluate("USE.torch=false;USE.brollyShield=false;PHONE.on=true;handsTick(.016)")
        self.assert_js(page, "HANDS.items.phone!==oldItems.phone&&HANDS.items.phone.userData.assetLod===1&&disposed.phone===1")

    def test_rapid_quality_changes_apply_a_delayed_pack_only_once(self):
        context, page = self.new_menu(0)
        page.goto(self.url, wait_until='load')
        page.evaluate("PHOTO_TRIED=true;Game.start('easy');clearIntroTimers()")
        page.wait_for_function("S.screen==='play'&&GLR.roomMesh&&GLR.roomMesh.userData.roomId==='teach1'", timeout=30000)
        page.evaluate("""running=false;window.originalApply=ThreeBackend.applyQuality;window.applyCount=0;
            ThreeBackend.applyQuality=function(){applyCount++;return originalApply.apply(this,arguments);};0;""")
        pending = []
        context.route('**/game3d/assets/models_l1.js', lambda route: pending.append(route))
        page.evaluate('Settings.q(3)')
        for _ in range(100):
            if pending:
                break
            page.wait_for_timeout(50)
        self.assertEqual(len(pending), 1)
        page.evaluate('Settings.q(0);Settings.q(3)')
        before = page.evaluate('applyCount')
        pending[0].continue_()
        page.wait_for_function("Assets.ready(1)", timeout=30000)
        self.assertEqual(page.evaluate('applyCount'), before+1)
        self.assert_js(page, "QUALITY===3")


class PackedAssetsTest(unittest.TestCase):
    def test_all_packs_decode_like_zlib_and_truncated_streams_fail(self):
        node = shutil.which('node')
        if not node:
            self.skipTest('校验压缩包需要 Node.js')
        script = r"""
            const fs=require('fs'),vm=require('vm'),zlib=require('zlib'),assert=require('assert');
            const decoder=vm.createContext({Uint8Array,Uint16Array,Int8Array,Int16Array,Number,Math,Object,setTimeout});
            vm.runInContext(fs.readFileSync('game3d/js/model/assets.js','utf8'),decoder);
            for(let i=0;i<4;i++){
              let meta,b64;
              vm.runInNewContext(fs.readFileSync('game3d/assets/models_l'+i+'.js','utf8'),
                {ASSET_PACK:(lod,m,b)=>{meta=m;b64=b;}});
              const src=Buffer.from(b64,'base64'),expected=zlib.inflateRawSync(src),out=new Uint8Array(meta.raw);
              assert.equal(decoder.INFL(src,out),meta.raw);
              assert.deepEqual(Buffer.from(out),expected);
              let failed=false;
              try{failed=decoder.INFL(src.subarray(0,Math.floor(src.length/2)),new Uint8Array(meta.raw))!==meta.raw;}
              catch(_){failed=true;}
              assert.ok(failed,'truncated L'+i);
            }
            assert.throws(()=>decoder.INFL(new Uint8Array([7]),new Uint8Array(4)));
        """
        subprocess.run([node, '-e', script], cwd=ROOT, check=True, timeout=30)
