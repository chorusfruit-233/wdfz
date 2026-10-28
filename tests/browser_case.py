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


class BrowserCase(unittest.TestCase):
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

    def page(self, touch=False, hybrid=False):
        context = self.browser.new_context(
            viewport={'width': 390, 'height': 844} if touch else {'width': 1000, 'height': 700},
            has_touch=touch, is_mobile=touch, device_scale_factor=1,
        )
        self.contexts.append(context)
        context.add_init_script("""
            localStorage.setItem('wdfz_pro','1');
            localStorage.setItem('zw3d_set',JSON.stringify({q:0,amb:0,vol:0}));
        """)
        if hybrid:
            context.add_init_script("""
                Object.defineProperty(navigator,'maxTouchPoints',{value:5,configurable:true});
                Object.defineProperty(window,'ontouchstart',{value:null,configurable:true});
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

