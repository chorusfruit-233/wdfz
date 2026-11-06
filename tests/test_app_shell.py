"""安卓外壳与主菜单（2026-11-06）：?app=android 时没有全屏按钮、按设置让 App 锁横屏；「自动横屏」默认开；主菜单就有 BGM。"""
import json

from browser_case import BrowserCase


class AppShellTest(BrowserCase):
    def menu(self, query='', store=None):
        ctx = self.browser.new_context(viewport={'width': 900, 'height': 600})
        self.contexts.append(ctx)
        ctx.add_init_script("localStorage.setItem('zw3d_set',JSON.stringify(%s));" % json.dumps(store or {'q': 0, 'vol': 70, 'renderer': 'webgl', 'rv': 1}))
        page = ctx.new_page()
        self.sent = []
        page.route('**/__app/orientation*', lambda route: (self.sent.append(route.request.url.split('mode=')[1]), route.fulfill(status=204)))
        page.goto(self.url + query, wait_until='load')
        page.wait_for_function("typeof Game!=='undefined'&&Assets.ready()&&!!GLR.scene", timeout=60000)
        return page

    def test_android_shell_hides_fullscreen_and_locks_landscape_by_default(self):
        page = self.menu('?app=android')
        r = page.evaluate("()=>({hidden:document.getElementById('fullscreen-toggle').hidden,cls:document.body.classList.contains('app-android'),auto:SET.autoLand,shell:APP_SHELL})")
        self.assertEqual(r, {'hidden': True, 'cls': True, 'auto': 1, 'shell': 'android'})
        page.wait_for_timeout(300)
        self.assertEqual(self.sent[-1:], ['landscape'])                       # 一打开就告诉 App 锁横屏
        page.evaluate("()=>{Settings.openFromMenu();document.querySelector('#sAutoLand button:last-child').click();}")
        page.wait_for_timeout(300)
        self.assertEqual(self.sent[-1], 'any')                                 # 关掉：跟随系统
        self.assertEqual(page.evaluate("JSON.parse(localStorage.getItem('zw3d_set')).autoLand"), 0)

    def test_web_keeps_the_fullscreen_button_and_auto_landscape_is_on_in_settings(self):
        page = self.menu()
        page.evaluate("Settings.openFromMenu()")                               # 设置面板打开时才画按钮状态
        r = page.evaluate("()=>({hidden:document.getElementById('fullscreen-toggle').hidden,shell:APP_SHELL,auto:SET.autoLand,"
                          "on:document.querySelector('#sAutoLand button:first-child').classList.contains('on')||document.querySelector('#sAutoLand button:first-child').getAttribute('aria-pressed')==='true'})")
        self.assertEqual(r, {'hidden': False, 'shell': '', 'auto': 1, 'on': True})
        self.assertEqual(self.sent, [])                                        # 网页版不去找 App

    def test_main_menu_has_bgm_after_the_first_touch_and_it_follows_the_music_switch(self):
        page = self.menu()
        page.mouse.click(860, 300)                                             # 浏览器要先有一下用户操作
        page.wait_for_function("SFX.available()&&SFX.bgmLevel()>0.02", timeout=15000)
        self.assertEqual(page.evaluate("S.screen"), 'menu')
        page.evaluate("Settings.amb(0)")
        page.wait_for_function("SFX.bgmLevel()<0.01", timeout=15000)          # 关掉「音乐/环境」：静下来
