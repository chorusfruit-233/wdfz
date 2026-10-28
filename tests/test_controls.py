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

    def test_touch_buttons_fire_once_and_running_toggles(self):
        page = self.page(touch=True)
        page.evaluate('window.actions=0;tryInteract=function(){actions++};void 0')
        page.locator('#tAct').tap()
        self.assert_js(page, 'actions===1')
        page.locator('#tRun').tap()
        self.assert_js(page, 'TOUCH.run')
        self.swipe(page)
        self.assert_js(page, 'TOUCH.run')
        page.locator('#tRun').tap()
        self.assert_js(page, '!TOUCH.run')

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
        page.locator('#pcgame button').click()
        self.assert_js(page, '!PC.on')

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


if __name__ == '__main__':
    unittest.main(verbosity=2)
