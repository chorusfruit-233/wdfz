"""单文件版（tools/build_single_html.cjs）：用 file:// 直接打开一个 HTML 文件就能玩，不读任何零散文件。"""
import os
import subprocess
import tempfile
import unittest
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
CHROMIUM = os.environ.get('CHROMIUM_EXECUTABLE')


class SingleHtmlTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.out = Path(cls.tmp.name) / 'wdfz-3d.html'          # 放在仓库外面：读不到 game3d/ 里的零散文件
        r = subprocess.run(['node', str(ROOT / 'tools' / 'build_single_html.cjs'), str(cls.out)], capture_output=True, text=True)
        assert r.returncode == 0, r.stderr
        cls.pw = sync_playwright().start()
        kw = {'executable_path': CHROMIUM} if CHROMIUM else {}
        cls.browser = cls.pw.chromium.launch(args=['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'], **kw)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close(); cls.pw.stop(); cls.tmp.cleanup()

    def open(self, query=''):
        ctx = self.browser.new_context(viewport={'width': 1000, 'height': 700})
        self.addCleanup(ctx.close)
        ctx.add_init_script("localStorage.setItem('zw3d_set',JSON.stringify({q:0,amb:0,vol:0,renderer:'webgl',rv:1}));")
        page = ctx.new_page()
        self.errs, self.loose = [], []
        page.on('pageerror', lambda e: self.errs.append(str(e)))
        page.on('request', lambda q: self.loose.append(q.url) if q.url.startswith('file:') and not q.url.split('?')[0].endswith('wdfz-3d.html') else None)
        page.goto(self.out.as_uri() + query, wait_until='load')
        page.wait_for_function("typeof Game!=='undefined'&&Assets.ready()&&!!GLR.scene", timeout=90000)
        return page

    def test_the_single_file_opens_from_disk_and_plays(self):
        size = self.out.stat().st_size
        self.assertGreater(size, 5 * 1024 * 1024)                 # 模型包、贴图包都在里面
        page = self.open()
        r = page.evaluate("()=>({single:!!(window.WDFZ_BUNDLE&&WDFZ_BUNDLE.single),mods:GameModules.modules().filter(m=>m.status!=='ok').map(m=>m.id),errors:GameModules.errors().length})")
        self.assertEqual(r, {'single': True, 'mods': [], 'errors': 0})
        page.evaluate("Game.start('easy',{talent:'watch'})")
        page.wait_for_function("S.room==='teach1'&&GLR.roomMesh", timeout=90000)
        page.evaluate("()=>{clearIntroTimers();running=false;doEnterRoom('lab1');}")
        page.wait_for_function("GLR.roomMesh&&GLR.roomMesh.userData.roomData===INTERIORS.lab1", timeout=60000)
        page.evaluate("Settings.q(3)")                                # 运行中换画质：另一档模型包也从页面里读
        page.wait_for_function("Assets.has&&Object.keys(ASSETS.packs).length>=2", timeout=90000)
        self.assertEqual(self.errs, [])
        self.assertEqual(self.loose, [])                            # 没有去读任何零散文件

    def test_builtin_dlc_and_online_links_work_in_the_single_file(self):
        page = self.open('?mod=campus-rules')
        r = page.evaluate("()=>({dlc:typeof CampusRules!=='undefined',wiki:document.querySelector('#menu a.mwiki').href})")
        self.assertTrue(r['dlc'])
        self.assertEqual(r['wiki'], 'https://wd-fz.github.io/wiki/index.html')   # 另外的页面指向线上
        self.assertEqual(self.errs, [])
        self.assertEqual(self.loose, [])


if __name__ == '__main__':
    unittest.main()
