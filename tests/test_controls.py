"""Input/fullscreen browser regressions. Run: python -m unittest discover -s tests -v"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os
import shutil
import threading
import unittest

from playwright.sync_api import sync_playwright


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


class ControlsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        root = Path(__file__).resolve().parents[1]
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(root)))
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = f'http://127.0.0.1:{cls.server.server_port}/'
        cls.playwright = sync_playwright().start()
        executable = os.environ.get('CHROMIUM_EXECUTABLE') or shutil.which('chromium')
        cls.browser = cls.playwright.chromium.launch(
            executable_path=executable,
            headless=True,
            args=['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
        )

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def setUp(self):
        self.contexts = []
        self.errors = []

    def tearDown(self):
        for context in self.contexts:
            context.close()
        self.assertEqual(self.errors, [], 'Unexpected page errors')

    def page(self, touch=False):
        context = self.browser.new_context(
            viewport={'width': 390, 'height': 844} if touch else {'width': 1000, 'height': 700},
            has_touch=touch, is_mobile=touch, device_scale_factor=1,
        )
        self.contexts.append(context)
        context.add_init_script("""
            localStorage.setItem('wdfz_pro','1');
            localStorage.setItem('zw3d_set',JSON.stringify({q:0,amb:0,vol:0}));
        """)
        page = context.new_page()
        page.on('pageerror', lambda e: self.errors.append(str(e)))
        page.goto(self.url, wait_until='load')
        # Freeze simulation so hazards and clocks cannot interfere with input assertions.
        # The final smoke test also creates and renders a real room.
        page.evaluate("""
            PHOTO_TRIED=true;running=false;document.getElementById('menu').style.display='none';
            S.screen='play';S.mode='out';S.room=null;
            S.x=1580;S.y=1800;S.ang=0;S.pitch=0;S.seated=false;S.intro=0;
            PRO.on=false;PAUSE.on=false;syncCamera(0);updateHUD();
            CUT.enabled=false;SEARCH.on=false;
        """)
        return page

    def assert_js(self, page, expression):
        self.assertTrue(page.evaluate(expression), expression)

    def touch(self, page, kind, points):
        session = getattr(page, '_controls_cdp', None)
        if session is None:
            session = page.context.new_cdp_session(page)
            page._controls_cdp = session
        session.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': points})

    def swipe(self, page, start=(205, 290), end=(250, 315)):
        self.touch(page, 'touchStart', [{'x': start[0], 'y': start[1]}])
        self.touch(page, 'touchMove', [{'x': end[0], 'y': end[1]}])
        self.touch(page, 'touchEnd', [])

    def test_homepage_and_legacy_3d_link(self):
        page = self.page()
        failed_assets = []
        page.on('response', lambda response: failed_assets.append(response.url)
                if '/game3d/' in response.url and response.status >= 400 else None)
        self.assertTrue(page.evaluate('saveGame()'))
        page.goto(self.url, wait_until='load')
        self.assert_js(page, "location.pathname==='/'&&!!GLR.renderer&&typeof Game.start==='function'")
        self.assertTrue(page.locator('#menu .mcard').first.is_visible())
        self.assertTrue(page.locator('#btncont').is_visible())
        page.goto(self.url+'3d.html?lang=zh#classroom', wait_until='load')
        page.wait_for_url('**/index.html?lang=zh#classroom')
        self.assert_js(page, "location.search==='?lang=zh'&&location.hash==='#classroom'&&!!GLR.renderer")
        self.assertTrue(page.locator('#menu .mcard').first.is_visible())
        self.assertTrue(page.locator('#btncont').is_visible())
        self.assertEqual(failed_assets, [])

    def test_wiki_entry_spoilers_and_return_to_game(self):
        for touch in (False, True):
            with self.subTest(touch=touch):
                page = self.page(touch=touch)
                self.assertTrue(page.evaluate('saveGame()'))
                saved = page.evaluate("localStorage.getItem('wdfz3d')")
                page.goto(self.url, wait_until='load')
                link = page.locator('#menu a.mwiki')
                if touch:
                    link.tap()
                else:
                    link.click()
                page.wait_for_url('**/wiki/index.html')
                self.assertTrue(page.get_by_role('heading', name='里世界游戏 Wiki').is_visible())
                spoiler = page.locator('#anomalies details')
                self.assertIsNone(spoiler.get_attribute('open'))
                self.assertFalse(spoiler.locator('table').is_visible())
                spoiler.locator('summary').click()
                self.assertTrue(spoiler.locator('table').is_visible())
                self.assertEqual(spoiler.locator('tbody tr').count(), 23)
                page.get_by_role('link', name='← 返回游戏').click()
                page.wait_for_url('**/index.html')
                self.assertTrue(page.locator('#btncont').is_visible())
                self.assertEqual(page.evaluate("localStorage.getItem('wdfz3d')"), saved)

    def test_fullscreen_enters_exits_and_updates_button(self):
        page = self.page()
        page.evaluate("S.screen='menu';syncFullscreenUI()")
        button = page.locator('#fullscreen-toggle')
        button.click()
        page.wait_for_function('!!document.fullscreenElement&&!FULLSCREEN.busy')
        self.assert_js(page, 'document.fullscreenElement===document.documentElement')
        self.assertEqual(button.inner_text(), '退出全屏')
        self.assertEqual(button.get_attribute('aria-pressed'), 'true')
        button.click()
        page.wait_for_function('!document.fullscreenElement&&!FULLSCREEN.busy')
        self.assertEqual(button.inner_text(), '进入全屏')
        self.assert_js(page, 'Math.abs(GLR.cam.aspect-innerWidth/innerHeight)<.001')

    def test_fullscreen_rejection_can_retry(self):
        page = self.page()
        page.evaluate("""
            window.nativeFullscreen=document.documentElement.requestFullscreen;
            document.documentElement.requestFullscreen=function(){return Promise.reject(new DOMException('Denied','NotAllowedError'));};
            void 0;
        """)
        button = page.locator('#fullscreen-toggle')
        button.click()
        page.wait_for_function('!FULLSCREEN.busy')
        self.assertIn('未能进入全屏', page.locator('#toast').inner_text())
        self.assertTrue(button.is_enabled())
        self.assert_js(page, '!document.fullscreenElement&&!document.getElementById("errbox")')
        page.evaluate('document.documentElement.requestFullscreen=nativeFullscreen;void 0')
        button.click()
        page.wait_for_function('!!document.fullscreenElement')

    def test_fullscreen_prefixed_api_and_external_exit(self):
        page = self.page()
        page.evaluate("""
            window.prefixedElement=null;window.fullscreenCalls=0;
            Object.defineProperty(document.documentElement,'requestFullscreen',{value:undefined,configurable:true});
            Object.defineProperty(document,'fullscreenElement',{get:()=>null,configurable:true});
            Object.defineProperty(document,'webkitFullscreenEnabled',{value:true,configurable:true});
            Object.defineProperty(document,'webkitFullscreenElement',{get:()=>prefixedElement,configurable:true});
            document.documentElement.webkitRequestFullscreen=function(){fullscreenCalls++;prefixedElement=this;document.dispatchEvent(new Event('webkitfullscreenchange'));};
            document.webkitExitFullscreen=function(){fullscreenCalls++;prefixedElement=null;document.dispatchEvent(new Event('webkitfullscreenchange'));};
            syncFullscreenUI();
        """)
        button = page.locator('#fullscreen-toggle')
        button.click()
        self.assert_js(page, 'fullscreenCalls===1&&!!fullscreenElement()')
        self.assertEqual(button.inner_text(), '退出全屏')
        button.click()
        self.assert_js(page, 'fullscreenCalls===2&&!fullscreenElement()')
        page.evaluate("prefixedElement=document.documentElement;document.dispatchEvent(new Event('webkitfullscreenchange'))")
        page.evaluate("prefixedElement=null;document.dispatchEvent(new Event('webkitfullscreenchange'))")
        self.assertEqual(button.inner_text(), '进入全屏')

    def test_fullscreen_unavailable_explains_and_standalone_is_detected(self):
        page = self.page(touch=True)
        page.evaluate("""
            S.screen='menu';document.getElementById('menu').style.display='block';
            Object.defineProperty(document.documentElement,'requestFullscreen',{value:undefined,configurable:true});
            Object.defineProperty(document.documentElement,'webkitRequestFullscreen',{value:undefined,configurable:true});
            syncFullscreenUI();
        """)
        button = page.locator('#fullscreen-toggle')
        self.assertEqual(button.inner_text(), '全屏说明')
        button.tap()
        self.assert_js(page, '!FULLSCREEN.busy&&!fullscreenElement()')
        self.assertIn('浏览器', page.locator('#toast').inner_text())
        self.assertTrue(page.locator('#mios').is_visible())
        page.evaluate("Object.defineProperty(navigator,'standalone',{value:true,configurable:true});syncFullscreenUI()")
        self.assertEqual(button.inner_text(), '全屏运行中')
        self.assertTrue(button.is_disabled())

    def test_touch_tap_never_locks_mouse_or_enters_fullscreen(self):
        page = self.page(touch=True)
        for _ in range(2):
            self.touch(page, 'touchStart', [{'x': 205, 'y': 290}])
            self.touch(page, 'touchEnd', [])
        self.assert_js(page, '!document.pointerLockElement&&!fullscreenElement()')
        self.swipe(page)
        self.assert_js(page, 'S.ang>.1&&S.pitch<-.05&&!document.pointerLockElement')

    def test_pointer_lock_error_does_not_cancel_touch_look(self):
        page = self.page(touch=True)
        self.touch(page, 'touchStart', [{'x': 205, 'y': 290}])
        page.evaluate("document.dispatchEvent(new Event('pointerlockerror'))")
        self.assert_js(page, 'LOOKDRAG.on')
        self.touch(page, 'touchMove', [{'x': 250, 'y': 310}])
        self.assert_js(page, 'S.ang>.1')
        self.touch(page, 'touchEnd', [])

    def test_touch_can_take_over_from_locked_mouse(self):
        page = self.page(touch=True)
        page.mouse.click(205, 290)
        page.wait_for_function('!!document.pointerLockElement')
        before = page.evaluate('S.ang')
        self.touch(page, 'touchStart', [{'x': 205, 'y': 290}])
        self.touch(page, 'touchMove', [{'x': 250, 'y': 310}])
        self.touch(page, 'touchEnd', [])
        page.wait_for_function('!document.pointerLockElement')
        self.assertGreater(page.evaluate('S.ang'), before + .1)
        self.assert_js(page, '!PAUSE.on&&INPUT.mode==="touch"')

    def test_two_finger_move_and_look_have_separate_owners(self):
        page = self.page(touch=True)
        rect = page.locator('#stick').bounding_box()
        x,y = rect['x']+rect['width']/2,rect['y']+rect['height']/2
        self.touch(page, 'touchStart', [{'x':x,'y':y,'id':1}])
        self.touch(page, 'touchStart', [{'x':x,'y':y,'id':1},{'x':205,'y':290,'id':2}])
        self.touch(page, 'touchMove', [{'x':x,'y':y-30,'id':1},{'x':245,'y':310,'id':2}])
        self.assert_js(page, 'TOUCH.active&&TOUCH.dy<-.5&&S.ang>.1&&LOOKDRAG.on')
        # CDP touchEnd lists the finger to lift; the movement finger stays down.
        self.touch(page, 'touchEnd', [{'x':245,'y':310,'id':2}])
        self.assert_js(page, 'TOUCH.active&&TOUCH.dy<-.5&&!LOOKDRAG.on')
        self.touch(page, 'touchEnd', [])
        self.assert_js(page, '!TOUCH.active&&INPUT.stickId===null')

    def test_lifting_movement_finger_preserves_view_finger(self):
        page = self.page(touch=True)
        rect = page.locator('#stick').bounding_box()
        x,y = rect['x']+rect['width']/2,rect['y']+rect['height']/2
        self.touch(page, 'touchStart', [{'x':205,'y':290,'id':2}])
        self.touch(page, 'touchStart', [{'x':x,'y':y,'id':1},{'x':205,'y':290,'id':2}])
        self.touch(page, 'touchEnd', [{'x':x,'y':y,'id':1}])
        self.assert_js(page, 'LOOKDRAG.on&&!TOUCH.active')
        self.touch(page, 'touchMove', [{'x':250,'y':315,'id':2}])
        self.assert_js(page, 'S.ang>.1')
        self.touch(page, 'touchEnd', [])

    def test_cancel_and_capture_loss_allow_next_gesture(self):
        page = self.page(touch=True)
        self.touch(page, 'touchStart', [{'x':205,'y':290}])
        self.touch(page, 'touchCancel', [])
        self.assert_js(page, '!LOOKDRAG.on&&INPUT.lookId===null')
        self.swipe(page)
        before = page.evaluate('S.ang')
        self.touch(page, 'touchStart', [{'x':205,'y':290}])
        page.evaluate("document.getElementById('cv').releasePointerCapture(INPUT.lookId)")
        self.touch(page, 'touchMove', [{'x':215,'y':300}])
        self.touch(page, 'touchEnd', [])
        self.swipe(page)
        self.assertGreater(page.evaluate('S.ang'), before + .1)

    def test_coordinate_jump_rebases_without_ending_drag(self):
        page = self.page(touch=True)
        self.touch(page, 'touchStart', [{'x':205,'y':290}])
        page.evaluate("""
            window.dispatchEvent(new PointerEvent('pointermove',{pointerId:INPUT.lookId,pointerType:'touch',clientX:500,clientY:600,buttons:1}));
            window.dispatchEvent(new PointerEvent('pointermove',{pointerId:INPUT.lookId,pointerType:'touch',clientX:520,clientY:610,buttons:1}));
        """)
        self.assert_js(page, 'LOOKDRAG.on&&Math.abs(S.ang-.084)<.001')
        self.touch(page, 'touchEnd', [])

    def test_touch_pause_resume_panels_and_fullscreen_recover_look(self):
        page = self.page(touch=True)
        page.locator('#tPause').tap()
        self.assert_js(page, 'PAUSE.on&&UI.openPanel==="pause"&&!TOUCH.run')
        page.locator('#pause button',has_text='继续').tap()
        self.assert_js(page, '!PAUSE.on&&!UI.anyOpen()')
        self.swipe(page)
        page.evaluate("UI.open('bag')")
        before = page.evaluate('S.ang')
        self.swipe(page)
        self.assertEqual(page.evaluate('S.ang'), before)
        page.locator('#bag .close').tap()
        self.swipe(page)
        self.assertGreater(page.evaluate('S.ang'), before + .1)
        page.locator('#fullscreen-toggle').tap()
        page.wait_for_function('!!document.fullscreenElement&&!FULLSCREEN.busy')
        before = page.evaluate('S.ang')
        self.swipe(page)
        self.assertGreater(page.evaluate('S.ang'), before + .1)
        self.assert_js(page, '!document.pointerLockElement&&!PAUSE.on')

    def test_touch_buttons_fire_once_and_stick_runs_without_button(self):
        page = self.page(touch=True)
        page.evaluate('window.actions=0;tryInteract=function(){actions++};void 0')
        page.locator('#tAct').tap()
        self.assert_js(page, 'actions===1')
        self.assert_js(page, "!document.getElementById('tRun')")
        page.evaluate("S.stam=100;S.tired=false;KEY={};TOUCH.active=true;TOUCH.dx=0;TOUCH.dy=-1;updatePlayer(.05)")
        self.assert_js(page, 'S.run')
        page.evaluate("TOUCH.dy=-.5;updatePlayer(.05);TOUCH.active=false")
        self.assert_js(page, '!S.run')

    def test_mouse_lock_modal_return_and_escape_pause(self):
        page = self.page()
        page.mouse.click(400,300)
        page.wait_for_function('!!document.pointerLockElement')
        page.keyboard.press('Tab')
        page.wait_for_function('!document.pointerLockElement')
        self.assert_js(page, 'UI.openPanel==="bag"&&!PAUSE.on')
        page.keyboard.press('Escape')
        page.wait_for_function('!!document.pointerLockElement')
        page.keyboard.press('Escape')
        page.wait_for_function('PAUSE.on&&!document.pointerLockElement')
        self.assert_js(page, 'UI.openPanel==="pause"')
        page.locator('#pause button',has_text='继续').click()
        page.wait_for_function('!!document.pointerLockElement&&!PAUSE.on')

    def test_mouse_drag_fallback_remains_available_after_rejection(self):
        page = self.page()
        page.evaluate("document.getElementById('cv').requestPointerLock=function(){return Promise.reject(new DOMException('Denied','NotAllowedError'))};void 0")
        page.mouse.click(400,300)
        page.mouse.move(400,300);page.mouse.down();page.mouse.move(460,325);page.mouse.up()
        self.assert_js(page, 'S.ang>.1&&!document.pointerLockElement&&!PAUSE.on')
        page.evaluate('updateInputUI()')
        self.assertTrue(page.locator('#lookhint').is_visible())

    def test_keyboard_actions_do_not_leak_into_panels_or_pause(self):
        page = self.page()
        page.evaluate('window.actions=0;tryInteract=toggleTorch=dropSelected=useHot=function(){actions++};void 0')
        page.keyboard.press('Tab')
        for key in ['e','f','g','1','2']:
            page.keyboard.press(key)
        self.assert_js(page, 'actions===0&&UI.openPanel==="bag"')
        page.keyboard.press('Escape')
        self.assert_js(page, '!UI.anyOpen()&&!PAUSE.on')
        page.keyboard.press('Escape')
        for key in ['e','f','g','1','2','Tab','h']:
            page.keyboard.press(key)
        self.assert_js(page, 'actions===0&&PAUSE.on&&UI.openPanel==="pause"')
        page.locator('#pause button',has_text='设置').click()
        page.keyboard.press('Escape')
        self.assert_js(page, 'PAUSE.on&&UI.openPanel==="pause"')
        page.locator('#pause button',has_text='继续').click()
        self.assert_js(page, '!UI.anyOpen()&&!PAUSE.on')

    def test_walking_running_analog_input_and_blur_reset(self):
        page = self.page()
        self.assert_js(page, """(()=>{
            KEY={w:true};updatePlayer(.5);var walk=S.x-1580;
            S.x=1580;S.stam=100;KEY={w:true,shift:true};updatePlayer(.5);var run=S.x-1580;
            S.x=1580;S.y=1800;KEY={w:true,d:true};S.stam=100;updatePlayer(.5);var diagonal=Math.hypot(S.x-1580,S.y-1800);
            S.x=1580;S.y=1800;KEY={};TOUCH.active=true;TOUCH.dx=.4;TOUCH.dy=0;TOUCH.run=false;updatePlayer(.5);var analog=Math.hypot(S.x-1580,S.y-1800);
            return Math.abs(walk-10.5)<.001&&run>walk*1.5&&Math.abs(diagonal-walk)<.001&&Math.abs(analog-4.2)<.001;
        })()""")
        page.evaluate("KEY={w:true,shift:true};TOUCH.run=true;window.dispatchEvent(new Event('blur'))")
        self.assert_js(page, 'PAUSE.on&&!KEY.w&&!TOUCH.active&&!TOUCH.run&&INPUT.lookId===null&&INPUT.stickId===null')
        page.locator('#pause button',has_text='继续').click()
        self.assert_js(page, '!S.moving&&!S.run&&accum===0&&lastT>0')

    def test_prologue_only_advances_on_space_or_enter(self):
        page = self.page()
        page.evaluate('PRO.on=true;PRO.i=0')
        page.keyboard.press('w');page.keyboard.press('Shift');page.keyboard.press('Tab')
        self.assert_js(page, 'PRO.i===0&&!KEY.w')
        page.keyboard.press('Space')
        self.assert_js(page, 'PRO.i===1')

    def test_computer_modal_releases_pointer_and_has_touch_exit(self):
        page = self.page()
        page.mouse.click(400,300)
        page.wait_for_function('!!document.pointerLockElement')
        page.evaluate('PCGAME.start()')
        page.wait_for_function('!document.pointerLockElement')
        self.assert_js(page, 'PC.on&&!playerInputAllowed()')
        page.keyboard.down('ArrowUp')
        page.evaluate('PC.cd=0;PCGAME.tick(.2)')
        page.keyboard.up('ArrowUp')
        self.assert_js(page, 'PC.dir.y===-1')
        page.locator('#pcexit').click()
        self.assert_js(page, '!PC.on')

    def test_computer_touch_dpad_exit_and_no_time_skip(self):
        page = self.page(touch=True)
        page.set_viewport_size({'width':844,'height':390})
        page.evaluate('S.tsec=760;PCGAME.start()')
        self.assertTrue(page.locator('#pcgame .pcx').is_visible())
        self.assertTrue(page.locator('#pcpad').is_visible())
        page.locator('#pcpad [data-d="0,-1"]').tap()
        page.evaluate('PC.cd=0;PCGAME.tick(.2)')
        self.assert_js(page, 'PC.dir.y===-1')
        page.locator('#pcgame .pcx').tap()
        self.assert_js(page, '!PC.on&&S.tsec===760')

    def test_snack_sprint_and_exhausted_stamina_does_not_stutter(self):
        page = self.page()
        page.evaluate("S.stam=0;S.tired=false;S.snackT=0;KEY.w=true;KEY.shift=true;updatePlayer(.05)")
        self.assert_js(page, '!S.run&&S.tired')
        page.evaluate("S.stam=10;updatePlayer(.05)")
        self.assert_js(page, '!S.run')
        page.evaluate("S.bag=['snack'];useItem('snack');S.stam=2;updatePlayer(.05)")
        self.assert_js(page, 'S.run&&S.stam===2&&S.snackT>9')
        page.evaluate("S.snackT=0;S.stam=STAM_BACK+1;updatePlayer(.05);KEY.w=false;KEY.shift=false")
        self.assert_js(page, 'S.run&&!S.tired')

    def test_ancestor_window_is_slowed_and_dropping_item_ends(self):
        page = self.page()
        self.assert_js(page, 'Math.abs((BEAST_T1-BEAST_T0)*60/rateAt(BEAST_T0+0.01)-15)<0.01')
        page.evaluate(
            "var R=INTERIORS.teach1;S.mode='in';S.room='teach1';S.x=R.ox+59.5*9;S.y=R.oy+17.5*9;"
            "S.dead=false;RT.beastDrop=false;S.tsec=BEAST_T0+0.05;S.bag=['chalk'];S.bagSel=0;dropSelected()")
        page.wait_for_function("RT.end==='beast'", timeout=5000)

    def test_bell_tower_spiral_stairs_and_exam_mode(self):
        page = self.page()
        page.evaluate(
            "var R=INTERIORS.bell1;S.mode='in';S.room='bell1';spiralReset();"
            "window.__ring=function(a,r){var x=SPIRAL.cx+Math.cos(a)*r,z=SPIRAL.cz+Math.sin(a)*r;"
            "  return [R.ox+(x+R.cols*0.5)*9,R.oy+(z+R.rows*0.5)*9];};"
            "var p=__ring(SPIRAL.th0+Math.PI,1.6);window.__blocked=solidAt(p[0],p[1]);"
            "for(var a=SPIRAL.th0;a<=SPIRAL.th0+SPIRAL.amax+0.4;a+=0.15){p=__ring(a,1.6);S.x=p[0];S.y=p[1];spiralUpdate();}")
        self.assert_js(page, "__blocked&&SP.state==='top'&&S.floorY===SPIRAL.topH&&bellReach()")
        page.evaluate("S.tsec=760;S.exam=false;useBell()")
        self.assert_js(page, 'S.exam&&!examNow()')
        page.evaluate("S.tsec=850;updateHUD()")
        self.assert_js(page, "examNow()&&document.getElementById('period').textContent.indexOf('考试')===0")
        page.evaluate("S.tsec=LIGHTS_OUT+5;updateSystems(.01)")
        self.assert_js(page, '!S.exam')

    def test_bell_tower_saves_restore_stairs_and_top(self):
        for stage in ('stair', 'top'):
            with self.subTest(stage=stage):
                page = self.page()
                saved = page.evaluate("""stage => {
                    doEnterRoom('bell1'); running=false; S.tsec=760;
                    const R=INTERIORS.bell1, end=SPIRAL.th0+(stage==='top'?SPIRAL.amax+0.4:7.2);
                    for(let a=SPIRAL.th0; a<=end; a+=0.12){
                      const x=SPIRAL.cx+Math.cos(a)*1.6, z=SPIRAL.cz+Math.sin(a)*1.6;
                      S.x=R.ox+(x+R.cols*0.5)*9; S.y=R.oy+(z+R.rows*0.5)*9;
                      spiralUpdate();
                    }
                    if(SP.state!==stage) throw Error('Could not reach '+stage);
                    const result={x:S.x,y:S.y,state:SP.state,a:SP.a,th:SP.th,height:S.floorY};
                    if(!saveGame()) throw Error('Save failed');
                    return result;
                }""", stage)
                page.reload(wait_until='load')
                page.locator('#btncont').click()
                page.wait_for_function("document.getElementById('banner').textContent==='钟楼'")
                restored = page.evaluate("""() => {
                    running=false; syncCamera(0);
                    return {x:S.x,y:S.y,state:SP.state,a:SP.a,th:SP.th,height:S.floorY,
                      camera:GLR.cam.position.y,blocked:solidAt(S.x,S.y),bell:bellReach(),
                      autosave:loadGame()};
                }""")
                self.assertEqual(restored['state'], saved['state'])
                for key in ('x', 'y', 'a', 'th', 'height'):
                    self.assertAlmostEqual(restored[key], saved[key], places=5, msg=key)
                self.assertFalse(restored['blocked'])
                self.assertGreater(restored['camera'], saved['height'])
                self.assertEqual(restored['autosave']['spiral']['state'], stage)
                if stage == 'top':
                    self.assertTrue(restored['bell'])
                    page.evaluate('tryInteract()')
                    self.assert_js(page, 'S.exam')
                    page.evaluate("""const R=INTERIORS.bell1, a=SPIRAL.th0-0.1;
                        S.x=R.ox+(SPIRAL.cx+Math.cos(a)*1.6+R.cols*0.5)*9;
                        S.y=R.oy+(SPIRAL.cz+Math.sin(a)*1.6+R.rows*0.5)*9;
                        spiralUpdate();""")
                    self.assert_js(page, "SP.state==='stair'&&S.floorY<SPIRAL.topH")

    def test_sprint_effect_and_exhaustion_survive_reload(self):
        page = self.page()
        page.evaluate("S.stam=20;S.tired=true;S.snackT=6;saveGame()")
        page.reload(wait_until='load')
        self.assertTrue(page.locator('#btncont').is_visible())
        page.evaluate('Game.continue_();running=false')
        self.assert_js(page, 'S.tired&&S.snackT===6')
        page.evaluate("S.snackT=0;KEY.w=true;KEY.shift=true;updatePlayer(.05)")
        self.assert_js(page, '!S.run&&S.tired')

    def test_older_save_without_new_state_loads_safely(self):
        page = self.page()
        page.evaluate("""doEnterRoom('bell1'); running=false; S.stam=4; saveGame();
            const old=loadGame(); delete old.spiral; delete old.snackT; delete old.tired;
            localStorage.setItem('wdfz3d',JSON.stringify(old));""")
        page.reload(wait_until='load')
        self.assertTrue(page.locator('#btncont').is_visible())
        page.evaluate('Game.continue_();running=false')
        page.wait_for_function("document.getElementById('banner').textContent==='钟楼'")
        self.assert_js(page, "SP.state==='ground'&&S.floorY===0&&S.tired&&S.snackT===0&&!solidAt(S.x,S.y)")

    def test_exam_ignores_non_exam_previews(self):
        page = self.page()
        for diff, locked in (('easy', False), ('hard', True)):
            with self.subTest(diff=diff, locked=locked):
                result = page.evaluate("""([diff,locked]) => {
                    S.diff=diff; S.day=2; S.tsec=700; S.exam=true;
                    S.mode='in'; S.room='teach1'; AN.active=false; AN.id=null;
                    AN.pre='turn'; AN.locked=locked; AN.lockWait=0; AN.cool={};
                    anStart();
                    return {active:AN.active,id:AN.id,allowed:!!EXAM_AN[AN.id]};
                }""", [diff, locked])
                self.assertTrue(result['active'], result)
                self.assertTrue(result['allowed'], result)

    def test_guard_flashlight_can_be_retried_after_full_bag(self):
        page = self.page()
        page.evaluate("""doEnterRoom('guard1'); running=false;
            const R=INTERIORS.guard1; S.x=R.ox+3.5*R.tw; S.y=R.oy+3.5*R.th;
            S.ang=Math.PI; S.bag=['roomkey','key','coin','chalk','snack','battery','pill','pen'];
            RT.guardKeysTold=1; tryInteract();""")
        self.assert_js(page, "!hasItem('torch')&&document.getElementById('sub').textContent.includes('装不下')")
        page.evaluate("removeItem('coin');tryInteract()")
        self.assert_js(page, "hasItem('torch')")

    def test_guard_flashlight_enables_garage_escape(self):
        page = self.page()
        page.evaluate("""doEnterRoom('guard1'); running=false;
            const R=INTERIORS.guard1; S.x=R.ox+3.5*R.tw; S.y=R.oy+3.5*R.th;
            S.ang=Math.PI; S.bag=[]; tryInteract();""")
        # 钥匙已经不在保安岗：只给手电，并指向校长办公室
        page.wait_for_function("hasItem('torch')", timeout=5000)
        self.assert_js(page, "!hasItem('roomkey')&&!hasItem('key')&&RT.guardKeysTold===1")
        page.evaluate("addItem('key')")
        page.evaluate("""doEnterRoom('garage1'); running=false; S.ang=0;
            ROAM.on=true; ROAM.stage='approach'; ROAM.x=S.x+40; ROAM.y=S.y;
            ROAM.cd=10; ROAM.litAcc=0; USE.torch=false; toggleTorch(); roamTick(1.7);""")
        self.assert_js(page, "ROAM.stage==='wait'&&!roamGuardsCar()")
        # 只有一辆能开：先试一辆错的，再试对的那辆；每次都要站着拧 1.6 秒
        page.evaluate("""var cs=carRightCell().split(':').map(Number);
            var R=INTERIORS.garage1, wrong=null;
            for(var r=0;r<R.rows&&!wrong;r++) for(var c=0;c<R.cols;c++) if(R.grid[r][c]==='V'&&(c+':'+r)!==RT.carRight){ wrong=[c,r]; break; }
            useCar(wrong[0],wrong[1]); searchTick(2);
            window.__wrong=!RT.carUsed&&Object.keys(RT.carTried).length===1;
            useCar(cs[0],cs[1]); searchTick(2);""")
        self.assert_js(page, '__wrong')
        page.wait_for_function("S.screen==='end'&&RT.end==='car'", timeout=5000)

    def test_auto_save_death_and_ending_history(self):
        page = self.page()
        page.evaluate("S.diff='hard';doEnterRoom('guard1');running=false")
        self.assert_js(page, "loadGame().room==='guard1'&&loadGame().mode==='in'")
        page.evaluate('doExitRoom()')
        self.assert_js(page, "loadGame().mode==='out'&&loadGame().room===null")
        page.evaluate("kill('测试死亡','vignette')")
        self.assert_js(page, 'S.dead&&!loadGame()')
        page.evaluate("Game.quit();freshState('hard');running=false;doEnterRoom('guard1');triggerEnding('face')")
        self.assert_js(page, "!loadGame()&&!!endsSeen().face")
        page.evaluate('Game.quit()')
        self.assertTrue(page.locator('#mends').is_visible())
        self.assertIn('白名单', page.locator('#mends').inner_text())

    def test_returned_menu_layout_on_short_and_touch_screens(self):
        for touch, width, height in ((False, 800, 450), (True, 844, 390), (True, 390, 844)):
            with self.subTest(touch=touch, width=width, height=height):
                page = self.page(touch=touch)
                page.set_viewport_size({'width':width, 'height':height})
                page.evaluate('Game.quit()')
                layout = page.evaluate("""() => {
                    const left=document.querySelector('#menu .mleft').getBoundingClientRect();
                    const keys=document.querySelector('#menu .mkeys').getBoundingClientRect();
                    const foot=document.querySelector('#menu .mfoot').getBoundingClientRect();
                    return {display:getComputedStyle(document.getElementById('menu')).display,
                      leftBottom:left.bottom,keysTop:keys.top,keysBottom:keys.bottom,footTop:foot.top};
                }""")
                self.assertEqual(layout['display'], 'block', layout)
                self.assertGreaterEqual(layout['keysTop'], layout['leftBottom'], layout)
                self.assertGreaterEqual(layout['footTop'], layout['keysBottom'], layout)

    def test_mobile_menu_panels_scroll_and_real_scene_renders(self):
        page = self.page(touch=True)
        page.evaluate("S.screen='menu';document.getElementById('menu').style.display='block';syncFullscreenUI()")
        self.assert_js(page, "document.querySelector('.mcard').getBoundingClientRect().right<=innerWidth")
        page.locator('#menu .mcard').first.tap()
        page.wait_for_timeout(350)
        page.evaluate('running=false;render(0)')
        self.assert_js(page, "S.room==='teach1'&&GLR.renderer.getContext().getError()===0&&!document.getElementById('errbox')")
        page.set_viewport_size({'width':844,'height':390})
        page.evaluate("Game.pause();UI.open('set')")
        page.wait_for_timeout(230)
        self.touch(page, 'touchStart', [{'x':770,'y':320}])
        self.touch(page, 'touchMove', [{'x':770,'y':100}])
        self.touch(page, 'touchEnd', [])
        page.wait_for_function("document.getElementById('set').scrollTop>0")
        self.assert_js(page, "getComputedStyle(document.body).touchAction!=='none'")


    # ---------- 第二轮优化清单 ----------
    def test_bag_drop_refreshes_open_panel_and_hotbar(self):
        page = self.page()
        page.evaluate("S.bag=['coin','chalk'];S.hot=['coin',null];S.bagSel=0;UI.open('bag');dropAt(0)")
        self.assert_js(page, "S.bag.join()==='chalk'&&S.hot[0]===null&&document.querySelectorAll('#bags .s .item').length===1")

    def test_search_takes_time_and_dev_toggle(self):
        page = self.page()
        page.evaluate("""doEnterRoom('teach1');running=false;SEARCH.on=true;S.bag=[];RT.deskUsed={};
            var R=INTERIORS.teach1,dc=-1,dr=-1;
            for(var r=1;r<15&&dc<0;r++) for(var c=1;c<R.cols;c++) if(R.grid[r][c]==='d'&&!ncOccupied(c,r)){ dc=c; dr=r; break; }
            S.x=R.ox+(dc+0.5)*9;S.y=R.oy+(dr+1.5)*9;Math.random=function(){return 0.30};
            searchContainer(dc,dr);window.__before=S.bag.length;searchTick(0.5);window.__mid=S.bag.length;searchTick(0.4);""")
        self.assert_js(page, "__before===0&&__mid===0&&S.bag.length===1&&!SEARCH.job")
        page.evaluate("Dev.search()")
        self.assert_js(page, "!SEARCH.on")

    def test_schedule_evening_until_ten_and_lights_out(self):
        page = self.page()
        self.assert_js(page, "periodAt(1250)[2]==='晚自习二'&&needWhere(1310)==='教室'&&needWhere(1330)==='自由'&&needWhere(1345)==='宿舍'")
        self.assert_js(page, "LIGHTS_OUT===1340&&periodAt(1339)[2]==='洗漱'")

    def test_anomaly_does_not_repeat_and_prefers_new(self):
        page = self.page()
        page.evaluate("window.__allow=['turn'];anAllowed=function(id){return __allow.indexOf(id)>=0};RT.anHist=['turn'];RT.anSeen={turn:1};S.diff='hard'")
        self.assert_js(page, "pickAnomaly()===null")
        page.evaluate("__allow=['turn','rain'];AN.cool={}")
        self.assert_js(page, "pickAnomaly()==='rain'")

    def test_trap_ideas_only_work_on_the_spot(self):
        page = self.page()
        page.evaluate("S.spots.front=1;S.mode='out';S.x=704*SC;S.y=900*SC;chooseIdea('front')")
        self.assert_js(page, "!UI.chooseOpen&&document.getElementById('sub').textContent.includes('北门')")
        page.evaluate("S.x=GATE_N.x*SC;S.y=(GATE_N.y+20)*SC;chooseIdea('front')")
        self.assert_js(page, "UI.chooseOpen")

    def test_patroller_locks_on_hides_and_back_turned_escape(self):
        page = self.page()
        page.evaluate("""doEnterRoom('teach1');running=false;S.tsec=860;S.seated=false;
            var R=INTERIORS.teach1;S.x=R.ox+30.5*9;S.y=R.oy+18.5*9;S.ang=0;S.moving=false;
            patReset();PAT.room='teach1';PAT.state='walk';PAT.walkT=0;PAT.x=S.x+70;PAT.y=S.y;PAT.tx=S.x;PAT.ty=S.y;
            for(var i=0;i<40&&!(PAT.locked&&GLR.patrolRed>0);i++) patTick(0.1);""")
        self.assert_js(page, "PAT.locked&&GLR.patrolRed>0&&!S.dead")
        # 背对它、一动不动 2.5 秒：它走过去
        page.evaluate("PAT.x=S.x+80;PAT.y=S.y;PAT.path=null;S.ang=Math.PI;for(var i=0;i<28;i++){S.moving=false;patTick(0.1);}")
        self.assert_js(page, "PAT.state==='idle'&&!S.dead")
        # 没被看见时躲进柜子：它不会锁定
        page.evaluate("""PAT.room='teach1';PAT.state='walk';PAT.locked=false;PAT.lock=0;PAT.walkT=0;
            hideIn({c:28,r:16});PAT.x=S.x+60;PAT.y=S.y+20;for(var i=0;i<20;i++) patTick(0.1);""")
        self.assert_js(page, "HIDE.on&&!HIDE.seen&&!PAT.locked&&!S.dead")
        page.evaluate("hideOut()")
        self.assert_js(page, "!HIDE.on")

    def test_principal_office_keys_and_guard_has_none(self):
        page = self.page()
        self.assert_js(page, "INTERIORS.admin5.principal&&INTERIORS.admin5.name.includes('校长')")
        page.evaluate("""doEnterRoom('admin5');running=false;S.bag=[];RT.deskUsed={};Math.random=function(){return 0.1};doSearch(3,2)""")
        self.assert_js(page, "hasItem('key')||hasItem('roomkey')")
        page.evaluate("""doEnterRoom('admin2');running=false;S.bag=[];RT.deskUsed={};Math.random=function(){return 0.05};doSearch(3,2)""")
        self.assert_js(page, "!hasItem('key')&&!hasItem('roomkey')")

    def test_portal_true_ending_from_lab_parts(self):
        page = self.page()
        page.evaluate("""doEnterRoom('lab1');running=false;S.bag=['coil','lens','vial','battery'];RT.portalSketch=1;portalBench()""")
        self.assert_js(page, "UI.chooseOpen")
        page.locator('#choices button').first.click()
        page.wait_for_function("UI.chooseOpen&&document.getElementById('choices').textContent.includes('走进去')", timeout=6000)
        page.locator('#choices button').first.click()
        page.wait_for_function("S.screen==='end'&&RT.end==='portal'", timeout=5000)
        self.assert_js(page, "!hasItem('coil')&&document.getElementById('ends').textContent.includes('真 结 局')")

    def test_trash_is_a_fake_ending_you_can_wake_from(self):
        page = self.page()
        page.evaluate("doEnterRoom('trash1');running=false;triggerEnding('trash')")
        self.assert_js(page, "S.screen==='end'&&document.getElementById('ends').textContent.includes('假 结 局')&&!!loadGame()")
        page.evaluate("fakeWake()")
        self.assert_js(page, "S.screen==='play'&&S.room==='teach1'&&RT.trashFake===1&&!document.getElementById('ends')")
        page.evaluate("doEnterRoom('trash1');running=false;S.tsec=1051;tryTrashRoute()")
        self.assert_js(page, "S.screen==='play'")

    def test_coin_buys_meal_and_vending_items(self):
        page = self.page()
        page.evaluate("doEnterRoom('canteen1');running=false;S.tsec=900;S.san=50;S.bag=['coin'];canteenWindow()")
        page.locator('#choices button').first.click()
        self.assert_js(page, "S.san===74&&!hasItem('coin')")
        page.evaluate("S.bag=['coin'];Math.random=function(){return 0.01};useVending()")
        self.assert_js(page, "hasItem('snack')&&!hasItem('coin')")

    def test_elixir_saves_once_and_seal_wards_patroller(self):
        page = self.page()
        page.evaluate("S.bag=['elixir'];S.dead=false;S.death=null;kill('x','grip')")
        self.assert_js(page, "!S.dead&&!hasItem('elixir')")
        page.evaluate("""doEnterRoom('teach1');running=false;S.tsec=860;S.seated=false;S.bag=['seal'];
            var R=INTERIORS.teach1;S.x=R.ox+30.5*9;S.y=R.oy+18.5*9;
            patReset();PAT.room='teach1';PAT.state='walk';PAT.walkT=0;PAT.x=S.x+50;PAT.y=S.y;PAT.tx=S.x;PAT.ty=S.y;
            for(var i=0;i<40&&hasItem('seal');i++) patTick(0.1);""")
        self.assert_js(page, "!hasItem('seal')&&PAT.state==='idle'&&!PAT.locked&&!S.dead")

    def test_held_items_show_in_hands(self):
        page = self.page()
        page.evaluate("S.bag=['torch','brolly','phone'];USE.torch=true;USE.brollyShield=true;USE.phone=true;handsTick(0)")
        self.assert_js(page, "HANDS.R.visible&&HANDS.L.visible&&HANDS.items.torch.parent===HANDS.R&&HANDS.items.brolly.parent===HANDS.L&&!HANDS.items.phone.visible")
        page.evaluate("USE.brollyShield=false;handsTick(0)")
        self.assert_js(page, "HANDS.items.phone.parent===HANDS.L&&HANDS.items.phone.visible")

    def test_ending_cutscene_plays_and_can_be_skipped(self):
        page = self.page()
        page.evaluate("doEnterRoom('teach1');running=false;CUT.enabled=true;triggerEnding('beast')")
        self.assert_js(page, "S.screen==='cut'&&CUT.on&&document.body.classList.contains('cut')")
        page.evaluate("cutTick(1);")
        self.assert_js(page, "CUT.on&&GLR.worldNorm>=0")
        page.keyboard.press('Space')
        self.assert_js(page, "!CUT.on&&S.screen==='end'&&RT.end==='beast'")

    def test_portal_materials_can_be_retried_after_full_bag_or_drop(self):
        page = self.page()
        page.evaluate("""doEnterRoom('lab3');running=false;S.seated=false;
            nearWorld=function(){return {ch:'Q'}};hit2_seatNear=function(){return false};
            S.bag=['coin','chalk','snack','battery','pill','pen','notebook','memo'];tryInteract();""")
        self.assert_js(page, "!RT.coilTaken&&!hasItem('coil')")
        page.evaluate("removeItem('coin');tryInteract()")
        self.assert_js(page, "RT.coilTaken&&hasItem('coil')")
        page.evaluate("dropAt(S.bag.indexOf('coil'));tryInteract()")
        self.assert_js(page, "RT.coilTaken&&hasItem('coil')")
        for ch, item, flag in [('N', 'lens', 'lensTaken'), ('C', 'vial', 'vialTaken')]:
            with self.subTest(item=item):
                page.evaluate("""({ch,flag})=>{ S.bag=['coin','chalk','snack','battery','pill','pen','notebook','memo'];
                    RT[flag]=0;S.actCool={};facRoll=function(){return 0};useFacility(ch,INTERIORS[S.room]); }""", {'ch': ch, 'flag': flag})
                self.assert_js(page, f"!RT.{flag}&&!hasItem('{item}')")
                page.evaluate("""({ch})=>{ removeItem('coin');useFacility(ch,INTERIORS[S.room]); }""", {'ch': ch})
                self.assert_js(page, f"RT.{flag}&&hasItem('{item}')")
                page.evaluate("""({ch,item})=>{ dropAt(S.bag.indexOf(item));S.actCool={};useFacility(ch,INTERIORS[S.room]); }""", {'ch': ch, 'item': item})
                self.assert_js(page, f"RT.{flag}&&hasItem('{item}')")

    def test_portal_remains_accessible_after_assembly_and_reload(self):
        page = self.page()
        page.evaluate("""doEnterRoom('lab1');running=false;RT.portalSketch=1;
            S.bag=['coil','lens','vial','battery'];portalBench();""")
        page.locator('#choices button').first.click()
        page.wait_for_function("UI.chooseOpen&&document.getElementById('choices').textContent.includes('走进去')", timeout=6000)
        page.locator('#choices button').last.click()
        page.evaluate("saveGame();Game.continue_();running=false;")
        self.assert_js(page, "RT.portalOpen&&S.room==='lab1'&&portalNeedText().includes('门已经打开')")
        page.evaluate("portalBench()")
        self.assert_js(page, "UI.chooseOpen&&document.getElementById('choices').textContent.includes('走进去')")
        page.locator('#choices button').first.click()
        self.assert_js(page, "S.screen==='end'&&RT.end==='portal'")

    def test_locker_position_and_patrol_end_stay_hidden_until_exit(self):
        page = self.page()
        page.evaluate("""doEnterRoom('teach1');running=false;S.tsec=860;S.seated=false;patReset();
            hideIn({c:28,r:16});window.__hiddenX=S.x;window.__hiddenY=S.y;render(0.6);""")
        self.assert_js(page, "HIDE.on&&S.x===__hiddenX&&S.y===__hiddenY&&document.getElementById('hideslits').style.display==='block'")
        page.evaluate("""PAT.room='teach1';PAT.state='walk';PAT.locked=true;PAT.lost=0;PAT.walkT=0;
            PAT.x=S.x+70;PAT.y=S.y+20;PAT.tx=S.x;PAT.ty=S.y;
            for(var i=0;i<30;i++) patTick(0.1);""")
        self.assert_js(page, "!PAT.locked&&HIDE.on")
        page.evaluate("patEnd(null)")
        self.assert_js(page, "HIDE.on&&S.x===__hiddenX&&S.y===__hiddenY")
        page.evaluate("tryInteract()")
        self.assert_js(page, "!HIDE.on&&canStand(S.x,S.y)&&document.getElementById('hideslits').style.display==='none'")
        page.evaluate("hideIn({c:28,r:16});saveGame();Game.quit()")
        self.assert_js(page, "!HIDE.on&&document.getElementById('hideslits').style.display==='none'")
        page.evaluate("Game.continue_();running=false")
        page.wait_for_function("S.room==='teach1'&&!HIDE.on&&!solidAt(S.x,S.y)")

    def test_patroller_reaches_seen_locker_without_crossing_walls(self):
        page = self.page()
        page.evaluate("""doEnterRoom('teach1');running=false;S.tsec=860;S.seated=false;patReset();
            hideIn({c:28,r:16});HIDE.seen=true;var R=INTERIORS.teach1;
            OPENDOORS['teach1:25:15']=1;PAT.room='teach1';PAT.state='walk';PAT.locked=true;
            PAT.lost=0;PAT.walkT=0;PAT.x=R.ox+25.5*R.tw;PAT.y=R.oy+13.5*R.th;PAT.path=null;
            window.__caught=false;window.__crossedWall=false;kill=function(){__caught=true};
            for(var i=0;i<160&&!__caught;i++){
              patTick(0.05);if(tileAt(R,PAT.x,PAT.y)==='#') __crossedWall=true;
            }""")
        self.assert_js(page, "__caught&&!__crossedWall")
        page.evaluate("""patReset();S.x=R.ox+29.5*R.tw;S.y=R.oy+13.5*R.th;OPENDOORS={};
            PAT.room='teach1';PAT.state='walk';PAT.locked=true;PAT.lost=0;PAT.walkT=0;
            PAT.x=R.ox+27.5*R.tw;PAT.y=R.oy+13.5*R.th;PAT.path=null;
            window.__caught=false;window.__crossedWall=false;
            for(var i=0;i<10;i++){patTick(0.1);if(tileAt(R,PAT.x,PAT.y)==='#') __crossedWall=true;}""")
        self.assert_js(page, "!__caught&&!__crossedWall")
        page.evaluate("""patReset();S.x=R.ox+29.5*R.tw-3;S.y=R.oy+13.5*R.th;OPENDOORS={};
            for(var c=0;c<R.cols;c++) if(R.grid[15][c]==='=') OPENDOORS['teach1:'+c+':15']=1;
            PAT.room='teach1';PAT.state='walk';PAT.locked=true;PAT.lost=0;PAT.walkT=0;
            PAT.x=R.ox+27.5*R.tw+3;PAT.y=R.oy+13.5*R.th;PAT.path=null;
            window.__caught=false;window.__crossedWall=false;
            for(var i=0;i<10;i++){patTick(0.1);if(tileAt(R,PAT.x,PAT.y)==='#') __crossedWall=true;}""")
        self.assert_js(page, "!__caught&&!__crossedWall")

    def test_portal_delayed_prompt_does_not_interrupt_other_contexts(self):
        page = self.page()
        page.evaluate("""doEnterRoom('lab1');running=false;RT.portalSketch=1;
            S.bag=['coil','lens','vial','battery'];window.__realTimeout=window.setTimeout;
            window.setTimeout=function(fn,ms){ if(ms===2600){window.__portalTimer=fn;return 0;} return __realTimeout(fn,ms); };
            portalBench();""")
        page.locator('#choices button').first.click()
        page.evaluate("""window.setTimeout=__realTimeout;S.room='lab2';__portalTimer();""")
        self.assert_js(page, "!UI.chooseOpen")
        page.evaluate("S.room='lab1';UI.open('bag');__portalTimer()")
        self.assert_js(page, "!UI.chooseOpen&&UI.openPanel==='bag'")
        page.evaluate("UI.closePanelAll();RT=newRT();__portalTimer()")
        self.assert_js(page, "!UI.chooseOpen")

    def test_full_bag_does_not_consume_searchable_key_or_usb(self):
        page = self.page()
        page.evaluate("""doEnterRoom('admin5');running=false;RT.deskUsed={};
            S.bag=['coin','chalk','snack','battery','pill','pen','notebook','memo'];
            Math.random=function(){return 0.1};doSearch(2,2);""")
        self.assert_js(page, "!RT.deskUsed['admin5:2:2']&&!hasItem('key')&&!hasItem('roomkey')")
        page.evaluate("removeItem('coin');doSearch(2,2)")
        self.assert_js(page, "RT.deskUsed['admin5:2:2']&&(hasItem('key')||hasItem('roomkey'))")
        page.evaluate("""doEnterRoom('lab3');running=false;RT.deskUsed={};
            S.bag=['coin','chalk','snack','battery','pill','pen','notebook','memo'];
            var R=INTERIORS.lab3, found=[];for(var r=0;r<R.rows;r++)for(var c=0;c<R.cols;c++)if(R.grid[r][c]==='R')found.push([c,r]);
            window.__shelf=found[0];doSearch(__shelf[0],__shelf[1]);""")
        self.assert_js(page, "!RT.deskUsed['lab3:'+__shelf[0]+':'+__shelf[1]]&&!hasItem('usb')")
        page.evaluate("removeItem('coin');doSearch(__shelf[0],__shelf[1])")
        self.assert_js(page, "hasItem('usb')")

    def test_search_job_is_cleared_when_quitting_or_starting_new_game(self):
        page = self.page()
        page.evaluate("""doEnterRoom('garage1');running=false;holdJob(1.6,function(){RT.carUsed=true});
            searchTick(0.5);Game.quit();""")
        self.assert_js(page, "!SEARCH.job&&document.getElementById('searchring').style.display==='none'")
        page.evaluate("freshState('normal')")
        self.assert_js(page, "!SEARCH.job&&!RT.carUsed")

    def test_fine_quality_shadows_window_shafts_and_light_pools(self):
        page = self.page()
        page.evaluate("Settings.q(2);doEnterRoom('teach1');running=false;S.tsec=760;updateLighting()")
        self.assert_js(page, "SHADE.shadows&&GLR.renderer.shadowMap.enabled&&GLR.moon.castShadow")
        self.assert_js(page, "INTERIORS.teach1.shafts.length>0&&!!SHADE.shaftGrp&&SHADE.shaftGrp.children.length===INTERIORS.teach1.shafts.length")
        self.assert_js(page, "SHADE.pools.length>0&&SHADE.shaftMat.opacity>0")
        # 光柱要落到地上，不能悬在半空
        self.assert_js(page, "SHADE.shaftGrp.children.every(function(m){var p=m.geometry.attributes.position.array;return p[7]<0.1})")
        page.evaluate("Settings.q(0);doEnterRoom('teach1');running=false;updateLighting()")
        self.assert_js(page, "!SHADE.shadows&&!GLR.renderer.shadowMap.enabled&&!SHADE.shaftGrp&&SHADE.pools.length>0")
        page.evaluate("Settings.q(2);S.mode='out';S.room=null;enterWorldOut();updateLighting()")
        self.assert_js(page, "!SHADE.shaftGrp&&SHADE.pools.length===0&&!!GLR.outMesh")

    def test_rain_streaks_splashes_lightning_and_cleanup(self):
        page = self.page()
        page.evaluate("""AN.active=true;AN.id='rain';AN.t=0;AN.acc=0;AN.data={};
            anfxSpawn('rain',S.x,S.y);for(var i=0;i<40;i++) anfxUpdate(0.05);""")
        self.assert_js(page, "WX.rain&&WX.rain.n===500&&WX.rain.puddles.length>0&&WX.rain.puddles[0].material.opacity>0")
        self.assert_js(page, "WX.rain.splash.some(function(m){return m.visible})")
        page.evaluate("GLR.flash=0;WX.rain.nextBolt=0;anfxUpdate(0.01)")
        self.assert_js(page, "GLR.flash>0.4&&WX.rain.nextBolt>5")
        page.evaluate("anfxClear()")
        self.assert_js(page, "WX.rain===null&&!ANFX.grp")

    def test_moth_swarm_closes_in_but_keeps_off_the_lens(self):
        page = self.page()
        page.evaluate("""AN.active=true;AN.id='moth';AN.t=0;AN.acc=0;AN.data={src:{x:S.x+60,y:S.y}};
            anfxSpawn('moth',S.x+60,S.y);for(var i=0;i<60;i++) anfxUpdate(0.05);window._d0=wxMothDist();
            AN.acc=6;for(i=0;i<80;i++) anfxUpdate(0.05);""")
        self.assert_js(page, "WX.moth.n===50&&wxMothDist()<_d0")
        self.assert_js(page, "WX.moth.ms.every(function(m){return m.p.distanceTo(GLR.cam.position)>0.3})")
        self.assert_js(page, "WX.moth.dp.some(function(v,i){return i%3===1&&v>0})")
        page.evaluate("anfxClear()")
        self.assert_js(page, "WX.moth===null&&wxMothDist()===99")

    def test_footstep_surfaces_and_light_crackle(self):
        page = self.page()
        page.evaluate("S.mode='out';S.room=null;S.x=300*SC;S.y=230*SC")
        self.assertEqual(page.evaluate("SFX.surface()"), 'grass')
        page.evaluate("S.x=340*SC;S.y=280*SC")
        self.assertEqual(page.evaluate("SFX.surface()"), 'court')
        page.evaluate("S.x=GATE_N.x*SC;S.y=(GATE_N.y-60)*SC")
        self.assertEqual(page.evaluate("SFX.surface()"), 'road')
        page.evaluate("doEnterRoom('garage1');running=false")
        self.assertEqual(page.evaluate("SFX.surface()"), 'garage')
        page.evaluate("doEnterRoom('teach1');running=false")
        self.assertEqual(page.evaluate("SFX.surface()"), 'tile')
        page.evaluate("""var L=GLR.roomLights[0];GLR.cam.position.set(L.position.x+1,1.6,L.position.z);
            FLK_PREV=[];FLK_LAST=-9;GLR.time=5;lightCrackle(0,1);lightCrackle(0,0.1);
            SFX.step();SFX.patStep(0.5,0.6,true,true);SFX.thunder(0.1,0.8,false);""")
        self.assert_js(page, "FLK_LAST===5")

    def test_patroller_has_its_own_uniform(self):
        page = self.page()
        page.evaluate("doEnterRoom('teach1');running=false;patAddFig()")
        self.assert_js(page, "GLR.patFig.children.length===4&&GLR.patFig.children[1].geometry.attributes.position.count>500")
        self.assert_js(page, "GLR.patFig.children[1].material.vertexColors===true")


if __name__ == '__main__':
    unittest.main(verbosity=2)
