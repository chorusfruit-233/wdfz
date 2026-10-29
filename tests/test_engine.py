"""画质、资源生命周期、碰撞和本地离线启动的浏览器集成回归。"""
from pathlib import Path
import re
import mimetypes
from urllib.parse import unquote, urlparse
from playwright.sync_api import Error
from browser_case import BrowserCase


class EngineTest(BrowserCase):
    def test_ultra_real_render_and_resource_release(self):
        page = self.page()
        gl_errors = []
        page.on('console', lambda msg: gl_errors.append(msg.text)
                if msg.type == 'error' else None)
        page.evaluate("""doEnterRoom('teach1');running=false;S.tsec=760;S.intro=0;
            Settings.q(3);syncCamera(0);render(.016);""")
        self.assert_js(page, "QUALITY===3&&GLR.rt.samples===Math.min(4,GLR.renderer.capabilities.maxSamples)")
        self.assert_js(page, "GLR.rt.depthTexture&&GLR.postMat.uniforms.uAO.value>0&&GLR.moon.shadow.mapSize.x===4096")
        self.assert_js(page, "GLR.roomLights.filter(l=>l.castShadow).length===1&&GLR.torch.shadow.mapSize.x===2048")
        self.assert_js(page, "MATS.plaster.map.image.width===1024&&!document.getElementById('errbox')")
        page.evaluate("""window.released={rt:0,texture:0,mesh:0};window.oldTarget=GLR.rt;
            GLR.rt.addEventListener('dispose',()=>released.rt++);
            MATS.plaster.map.addEventListener('dispose',()=>released.texture++);
            GLR.roomMesh.children.find(o=>o.geometry).geometry.addEventListener('dispose',()=>released.mesh++);
            Settings.q(0);render(.016);""")
        self.assertEqual(page.evaluate('released'), {'rt': 1, 'texture': 1, 'mesh': 1})
        self.assert_js(page, "GLR.rt!==oldTarget&&!GLR.rt.depthTexture&&!GLR.rt.samples&&!GLR.postMat.uniforms.uAO.value")
        self.assert_js(page, "MATS.plaster.map.image.width===256&&!SHADE.shadows&&GLR.roomLights.every(l=>!l.castShadow)")
        self.assertEqual(gl_errors, [])

    def test_quality_switch_preserves_live_story_and_actor_state(self):
        page = self.page()
        page.evaluate("""doEnterRoom('teach1');running=false;S.intro=0;
            AN.active=true;AN.id='moth';AN.t=12;AN.next=77;AN.data={src:{x:S.x+40,y:S.y},acc:3};
            anfxSpawn('moth',S.x+40,S.y);ANFX.t=9;
            ROAM.x=212;ROAM.y=420;ROAM.on=true;ROAM.litAcc=1.2;
            OPENDOORS['teach1:5:15']=true;NC.blocking=true;NC.t=17;
            window.oldNC=NC.grp;window.oldFX=ANFX.grp;
            window.snapshot=()=>JSON.stringify([S.x,S.y,S.tsec,S.san,S.viol,AN,ROAM,OPENDOORS,SP,PAT,
              NC.blocking,NC.t,NC.occ,NC.list.map(f=>f.position.toArray()),ANFX.t]);
            window.before=snapshot();window.collider=JSON.stringify([INTERIORS.teach1.foot,INTERIORS.teach1.propExtra,INTERIORS.teach1.stairExtra]);
            window.oldFigure=NC.list[0].children[0].geometry;""")
        for q in (3, 1, 2, 0):
            page.evaluate('q=>Settings.q(q)', q)
            self.assert_js(page, 'snapshot()===before&&NC.grp===oldNC&&ANFX.grp===oldFX')
            self.assert_js(page, 'JSON.stringify([INTERIORS.teach1.foot,INTERIORS.teach1.propExtra,INTERIORS.teach1.stairExtra])===collider')
            if q == 3:
                self.assert_js(page, 'NC.list[0].children[0].geometry.attributes.position.count>oldFigure.attributes.position.count')
        self.assert_js(page, 'NC.list[0].children[0].geometry===oldFigure')

    def test_outdoor_collision_is_identical_at_all_four_qualities(self):
        page = self.page()
        page.evaluate("""S.mode='out';S.room=null;enterWorldOut();window.colliders=JSON.stringify(OUT_SOLID);
            window.trees=OUTX.treeN;window.pos=[S.x,S.y];window.counts=[];""")
        for q in (0, 1, 2, 3, 0):
            page.evaluate('q=>Settings.q(q)', q)
            self.assert_js(page, 'JSON.stringify(OUT_SOLID)===colliders&&OUTX.treeN===trees&&S.x===pos[0]&&S.y===pos[1]')
            page.evaluate('counts.push(GLR.outMesh.children.reduce((n,o)=>n+(o.geometry?o.geometry.attributes.position.count:0),0))')
        self.assert_js(page, 'counts[3]>counts[2]&&counts[0]===counts[4]')

    def test_ultra_settings_persist_and_old_values_normalize(self):
        context = self.browser.new_context(viewport={'width': 800, 'height': 600})
        self.contexts.append(context)
        page = context.new_page()
        page.on('pageerror', lambda e: self.errors.append(str(e)))
        page.goto(self.url, wait_until='load')
        page.evaluate("PHOTO_TRIED=true;running=false")
        self.assert_js(page, "QUALITY===1&&document.querySelectorAll('#mq option').length===4&&document.querySelectorAll('#sQ button').length===4")
        page.select_option('#mq', '3')
        page.reload(wait_until='load')
        page.evaluate('PHOTO_TRIED=true;running=false')
        self.assert_js(page, "QUALITY===3&&SET.q===3&&document.getElementById('mq').value==='3'")
        for q, expected in ((0, 0), (1, 1), (2, 2), (3, 3), (99, 1), ('3', 1), (None, 1)):
            page.evaluate("q=>{localStorage.setItem('zw3d_set',JSON.stringify({q:q}));loadSet()}", q)
            self.assertEqual(page.evaluate('[QUALITY,SET.q]'), [expected, expected])

    def test_local_file_start_with_network_disabled(self):
        context = self.browser.new_context(offline=True, viewport={'width': 800, 'height': 600})
        self.contexts.append(context)
        page = context.new_page()
        page.on('pageerror', lambda e: self.errors.append(str(e)))
        remote = []
        page.on('request', lambda r: remote.append(r.url) if r.url.startswith(('http:', 'https:')) else None)
        try:
            page.goto((Path(__file__).resolve().parents[1] / 'index.html').as_uri(), wait_until='load')
        except Error as exc:
            if 'ERR_BLOCKED_BY_ADMINISTRATOR' in str(exc):
                self.skipTest('此环境的 Chromium 管理策略禁止 file://；另有断网本地资源加载测试')
            raise
        page.evaluate("PHOTO_TRIED=true;localStorage.setItem('wdfz_pro','1');Settings.q(3)")
        page.locator('#menu .mcard').first.click()
        page.wait_for_function("S.screen==='play'&&S.room==='teach1'")
        page.evaluate('clearIntroTimers();running=false;S.intro=0;render(.016)')
        self.assert_js(page, "Engine.ready()&&GLR.roomMesh&&QUALITY===3&&!document.getElementById('errbox')")
        self.assertEqual(remote, [])

    def test_packaged_assets_boot_with_network_offline(self):
        root = Path(__file__).resolve().parents[1]
        context = self.browser.new_context(offline=True, viewport={'width': 800, 'height': 600})
        self.contexts.append(context)
        def local_asset(route):
            relative = unquote(urlparse(route.request.url).path).lstrip('/') or 'index.html'
            file = (root / relative).resolve()
            if not file.is_relative_to(root) or not file.is_file():
                route.abort()
                return
            route.fulfill(body=file.read_bytes(), content_type=mimetypes.guess_type(file)[0] or 'application/octet-stream')
        context.route('http://wdfz.local/**', local_asset)
        page = context.new_page()
        page.on('pageerror', lambda e: self.errors.append(str(e)))
        failed = []
        page.on('requestfailed', lambda r: failed.append(r.url))
        page.goto('http://wdfz.local/index.html', wait_until='load')
        page.evaluate("PHOTO_TRIED=true;localStorage.setItem('wdfz_pro','1');Settings.q(3)")
        page.locator('#menu .mcard').first.click()
        page.wait_for_function("S.screen==='play'&&S.room==='teach1'")
        page.evaluate('clearIntroTimers();running=false;S.intro=0;render(.016)')
        self.assert_js(page, "Engine.ready()&&GLR.roomMesh&&QUALITY===3&&!document.getElementById('errbox')")
        self.assertEqual(failed, [])

    def test_sustained_low_fps_hint_requires_active_play_and_user_choice(self):
        page = self.page()
        page.evaluate("QUALITY=3;SET.q=3;QualityWatch.reset();for(let i=0;i<200;i++)QualityWatch.tick(.1,false)")
        self.assert_js(page, "document.getElementById('qualityHint').hidden")
        page.evaluate('for(let i=0;i<200;i++)QualityWatch.tick(1/60,true)')
        self.assert_js(page, "document.getElementById('qualityHint').hidden")
        page.evaluate('QualityWatch.reset();for(let i=0;i<160;i++)QualityWatch.tick(.1,true)')
        self.assert_js(page, "!document.getElementById('qualityHint').hidden&&QUALITY===3")
        page.get_by_role('button', name='降低一档').click()
        self.assert_js(page, "QUALITY===2&&SET.q===2&&document.getElementById('qualityHint').hidden")
        page.evaluate('QualityWatch.reset();QualityWatch.tick(30,true)')
        self.assert_js(page, "document.getElementById('qualityHint').hidden&&QualityWatch.elapsed===0")

    def test_circle_collision_corners_sliding_and_large_steps(self):
        page = self.page()
        # A controlled open outdoor space with one thin obstacle exercises the real move path.
        page.evaluate("""S.mode='out';S.room=null;window.savedObjects=OBJ;OBJ=[];
            OUT_SOLID=[{x0:500,y0:500,x1:501,y1:550}];S.x=990;S.y=1020;
            window.corner={x:997.8,y:997.8};window.cornerBlocked=!canStand(corner.x,corner.y);
            window.nearCornerBlocked=!canStand(998,998);moveBy(50,20,.25);
            window.slid=[S.x,S.y,canStand(S.x,S.y)];S.x=900;S.y=1020;moveBy(200,0,.25);
            window.stopped=S.x;OBJ=savedObjects;""")
        # sqrt(2)*2.2 > 3 is clear, whereas sqrt(2)*2 < 3 intersects the circular body.
        self.assert_js(page, '!cornerBlocked&&nearCornerBlocked')
        self.assert_js(page, 'slid[0]<=997.000001&&slid[1]>1039&&slid[2]&&stopped<=997.000001')
        self.assertEqual(page.evaluate('Physics.hz'), 240)

    def test_ultrawide_camera_near_plane_stays_inside_body(self):
        page = self.page()
        page.set_viewport_size({'width': 2800, 'height': 300})
        page.evaluate('resizeGL();syncCamera(0)')
        self.assert_js(page, "GLR.cam.near<.08&&GLR.cam.near*Math.sqrt(1+Math.pow(Math.tan(S.fov*PI/360),2)*(1+GLR.cam.aspect*GLR.cam.aspect))<PRAD*U2M")
        self.assert_js(page, 'GLR.postMat.uniforms.uNear.value===GLR.cam.near')

    def test_gameplay_modules_do_not_construct_renderer_objects(self):
        root = Path(__file__).resolve().parents[1] / 'game3d/js'
        for name in ('main', 'world', 'input', 'systems', 'anomaly', 'story', 'items', 'patrol', 'spiral', 'save', 'state', 'interact', 'prologue'):
            source = (root / f'{name}.js').read_text()
            self.assertIsNone(re.search(r'\b(?:THREE|GLR)\s*\.', source), name)
