"""操作、剧情与存档回归。"""
import unittest
from browser_case import BrowserCase


class ControlsTest(BrowserCase):
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
                rows = page.locator('#items tbody tr')
                self.assertIn('每秒回 2 SAN', rows.filter(has_text='药片').first.inner_text())
                self.assertIn('30 秒内奔跑不耗体力', rows.filter(has_text='士力架').first.inner_text())
                repo = page.locator('.topbar a.repo')
                self.assertTrue(repo.is_visible())
                self.assertEqual(repo.get_attribute('href'), 'https://github.com/chorusfruit-233/wdfz')
                spoiler = page.locator('#anomalies details')
                self.assertIsNone(spoiler.get_attribute('open'))
                self.assertFalse(spoiler.locator('table').is_visible())
                spoiler.locator('summary').click()
                self.assertTrue(spoiler.locator('table').is_visible())
                self.assertEqual(spoiler.locator('tbody tr').count(), 25)
                self.assertIn('模型加载失败', page.locator('#faq').inner_text())
                page.get_by_role('link', name='← 返回游戏').click()
                page.wait_for_url('**/index.html')
                self.assertTrue(page.locator('#btncont').is_visible())
                self.assertEqual(page.evaluate("localStorage.getItem('wdfz3d')"), saved)

    def test_goggles_make_lab_rolls_better(self):
        page = self.page()
        # 离心机、显微镜都是数字小的好：带着护目镜时两次里取小的
        page.evaluate("window.seq=[0.9,0.1];Math.random=()=>seq.shift();S.bag=[];window.plain=facRoll(100);"
                      "seq=[0.9,0.1];S.bag=['goggles'];window.withG=facRoll(100);")
        self.assertEqual(page.evaluate('[plain,withG]'), [90, 10])

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
        page.locator('#journal .jclose').tap()
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

    def test_touch_capable_desktop_uses_locked_mouse_and_rotates_view(self):
        page = self.page(hybrid=True)
        self.assert_js(page, "matchMedia('(pointer: fine)').matches&&navigator.maxTouchPoints>0")
        self.assert_js(page, "INPUT.mode==='mouse'&&!IS_TOUCH&&!document.body.classList.contains('touch')")
        page.mouse.click(400, 300)
        page.wait_for_function('!!document.pointerLockElement')
        page.evaluate('S.ang=0;S.pitch=0')
        page.mouse.move(460, 325)
        self.assert_js(page, "INPUT.mode==='mouse'&&!IS_TOUCH&&!PAUSE.on&&S.ang>.05&&S.pitch<-.02")
        self.assertFalse(page.locator('#touch').is_visible())

    def test_mouse_on_touch_joystick_does_not_start_touch_input(self):
        page = self.page(touch=True)
        rect = page.locator('#stick').bounding_box()
        page.mouse.click(rect['x']+rect['width']/2, rect['y']+rect['height']/2)
        self.assert_js(page, "INPUT.mode==='mouse'&&!IS_TOUCH&&!TOUCH.active&&INPUT.stickId===null")
        self.assertFalse(page.locator('#touch').is_visible())
        page.mouse.click(205, 290)
        page.wait_for_function('!!document.pointerLockElement')
        self.assert_js(page, "INPUT.mode==='mouse'&&!PAUSE.on")

    def test_mouse_and_touch_can_switch_after_pointer_lock(self):
        page = self.page(touch=True)
        page.mouse.click(205, 290)
        page.wait_for_function('!!document.pointerLockElement')
        self.assert_js(page, "INPUT.mode==='mouse'&&!IS_TOUCH&&!document.body.classList.contains('touch')")
        self.swipe(page)
        page.wait_for_function('!document.pointerLockElement')
        self.assert_js(page, "INPUT.mode==='touch'&&IS_TOUCH&&document.body.classList.contains('touch')&&S.ang>.1&&!PAUSE.on")
        self.assertTrue(page.locator('#touch').is_visible())
        page.mouse.click(205, 290)
        page.wait_for_function('!!document.pointerLockElement')
        self.assert_js(page, "INPUT.mode==='mouse'&&!IS_TOUCH&&!document.body.classList.contains('touch')&&!PAUSE.on")

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

    def test_snack_expires_while_hiding_but_not_while_game_is_paused(self):
        page = self.page()
        page.evaluate("""doEnterRoom('teach1');running=false;S.tsec=760;S.san=50;S.bag=['snack','pill'];
            S.intro=0;AN.active=false;AN.next=9999;PAT.next=9999;
            var R=INTERIORS.teach1,locker=null;
            for(var r=0;r<R.rows&&!locker;r++)for(var c=0;c<R.cols;c++)
                if(R.grid[r][c]==='H'){locker={c:c,r:r};break;}
            if(!locker) throw new Error('locker not found');
            useItem('snack');useItem('pill');hideIn(locker);window._hideClock=S.tsec;
            for(var i=0;i<600;i++)update(1/60);""")
        self.assert_js(page, "HIDE.on&&!S.dead&&S.tsec>_hideClock&&Math.abs(S.snackT-20)<.02&&Math.abs(S.pillT-20)<.02")
        page.evaluate("UI.open('bag');for(var i=0;i<300;i++)update(1/60)")
        self.assert_js(page, 'Math.abs(S.snackT-20)<.02&&Math.abs(S.pillT-20)<.02')
        page.evaluate("UI.closePanelAll();for(var i=0;i<1201;i++)update(1/60);hideOut();"
                      "S.stam=0;S.tired=true;KEY.w=true;KEY.shift=true;updatePlayer(1/60)")
        self.assert_js(page, 'S.snackT===0&&!S.run&&S.tired')

    def test_snack_and_world_time_keep_pace_at_low_frame_rates(self):
        for interval in (200, 1000):
            with self.subTest(frame_interval_ms=interval):
                page = self.page()
                result = page.evaluate("""interval => {
                    S.tsec=760;S.san=80;S.dead=false;S.intro=0;S.snackT=30;
                    AN.active=false;AN.next=9999;PAT.next=9999;HIDE.on=false;
                    const oldRaf=window.requestAnimationFrame,oldRender=render;
                    window.requestAnimationFrame=()=>0;render=()=>{};
                    lastT=0;accum=0;running=true;
                    try{
                        for(let t=interval;t<=10000;t+=interval)frame(t);
                        const elapsed={snack:S.snackT,clock:S.tsec,backlog:accum};
                        PAUSE.on=true;
                        for(let t=10000+interval;t<=12000;t+=interval)frame(t);
                        return {elapsed,paused:{snack:S.snackT,clock:S.tsec},dead:S.dead};
                    }finally{
                        running=false;PAUSE.on=false;window.requestAnimationFrame=oldRaf;render=oldRender;
                    }
                }""", interval)
                self.assertFalse(result['dead'])
                self.assertAlmostEqual(result['elapsed']['snack'], 20, delta=.02)
                self.assertAlmostEqual(result['elapsed']['clock'] - 760, 10 * page.evaluate('rateAt(760)') / 60, delta=.02)
                self.assertLess(result['elapsed']['backlog'], .017)
                self.assertEqual(result['paused']['snack'], result['elapsed']['snack'])
                self.assertEqual(result['paused']['clock'], result['elapsed']['clock'])

    def test_long_frame_has_bounded_catchup(self):
        page = self.page()
        result = page.evaluate("""() => {
            S.tsec=760;S.san=80;S.snackT=30;AN.active=false;AN.next=9999;PAT.next=9999;
            const oldRaf=window.requestAnimationFrame,oldRender=render;
            window.requestAnimationFrame=()=>0;render=()=>{};lastT=0;accum=0;running=true;
            try{frame(5000);return {snack:S.snackT,backlog:accum};}
            finally{running=false;window.requestAnimationFrame=oldRaf;render=oldRender;}
        }""")
        self.assertAlmostEqual(result['snack'], 29, delta=.02)
        self.assertLess(result['backlog'], .017)

    def test_ancestor_window_is_slowed_and_drop_requires_dialogue(self):
        page = self.page()
        self.assert_js(page, 'Math.abs((BEAST_SLOW_T1-BEAST_SLOW_T0)*60/rateAt(BEAST_T0)-10)<0.01')
        page.evaluate(
            "var R=INTERIORS.teach1;S.mode='in';S.room='teach1';S.x=R.ox+59.5*9;S.y=R.oy+17.5*9;"
            "S.dead=false;RT.beastDrop=false;S.tsec=BEAST_T0+0.001;S.bag=['chalk'];S.bagSel=0;dropSelected()")
        self.assert_js(page, "RT.beastDrop&&!RT.end&&!hasItem('chalk')")
        page.evaluate("S.tsec=BEAST_SLOW_T1+1;useStall()")
        self.assert_js(page, "UI.chooseOpen&&!RT.end")
        page.locator('#choices button').first.click()
        self.assert_js(page, "RT.end==='beast'")

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
        self.assert_js(page, "CarChase.active()&&!RT.end&&!endsSeen().car&&!!loadGame()")

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

    def test_trash_is_a_death_and_respects_survival_item(self):
        page = self.page()
        page.evaluate("doEnterRoom('trash1');running=false;S.diff='hard';S.talent='code';S.bag=['elixir'];tryTrashRoute()")
        self.assert_js(page, "!S.dead&&!hasItem('elixir')&&!endsSeen().trash")
        page.evaluate("tryTrashRoute()")
        self.assert_js(page, "S.dead&&S.death==='trash'&&!endsSeen().trash&&!loadGame()")

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
        # 手机只在玩小游戏时拿在手上
        page.evaluate("S.bag=['torch','brolly','phone'];USE.torch=true;USE.brollyShield=true;PHONE.on=true;handsTick(0)")
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
        page.wait_for_function("S.room==='teach1'&&HIDE.on")
        self.assert_js(page,"S.x===__hiddenX&&S.y===__hiddenY&&document.getElementById('hideslits').style.display==='block'")
        page.evaluate('tryInteract()')
        self.assert_js(page,'!HIDE.on&&canStand(S.x,S.y)')

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

    def test_duplicate_search_result_is_retained_and_saved(self):
        page = self.page()
        hit = page.evaluate("""() => {
            doEnterRoom('dorm1');running=false;RT.deskUsed={};RT.pendingLoot={};S.bag=['snack'];
            const R=INTERIORS.dorm1;let hit=null;
            for(let r=0;r<R.rows&&!hit;r++)for(let c=0;c<R.cols;c++)
                if(['d','f','R'].includes(R.grid[r][c])){hit={c,r};break;}
            if(!hit)throw new Error('searchable container not found');
            Math.random=()=>.30;searchContainer(hit.c,hit.r);return hit;
        }""")
        self.assert_js(page, "RT.pendingLoot['dorm1:%d:%d']==='snack'&&!RT.deskUsed['dorm1:%d:%d']"
                       % (hit['c'], hit['r'], hit['c'], hit['r']))
        self.assertIn('先把它留在这里', page.locator('#sub').inner_text())
        page.evaluate("hit => {Math.random=()=>.99;searchContainer(hit.c,hit.r);saveGame();}", hit)
        page.reload(wait_until='load')
        page.evaluate('Game.continue_();running=false;SEARCH.on=false')
        page.wait_for_function("S.mode==='in'&&S.room==='dorm1'&&!!GLR.roomMesh", timeout=8000)
        self.assert_js(page, "RT.pendingLoot['dorm1:%d:%d']==='snack'&&hasItem('snack')" % (hit['c'], hit['r']))
        page.evaluate("hit => {removeItem('snack');Math.random=()=>.99;searchContainer(hit.c,hit.r);}", hit)
        self.assert_js(page, "hasItem('snack')&&!RT.pendingLoot['dorm1:%d:%d']&&RT.deskUsed['dorm1:%d:%d']"
                       % (hit['c'], hit['r'], hit['c'], hit['r']))
        page.evaluate("hit => {removeItem('snack');searchContainer(hit.c,hit.r);}", hit)
        self.assertIn('翻过了', page.locator('#sub').inner_text())

        page.evaluate("""doEnterRoom('lab5');running=false;RT.deskUsed={};RT.pendingLoot={};S.bag=['snack'];
            Math.random=()=>.30;doSearch(3,2);""")
        self.assert_js(page, "RT.pendingLoot['lab5:3:2']==='snack'&&!RT.deskUsed['lab5:3:2']")
        page.evaluate("removeItem('snack');Math.random=()=>.99;doSearch(3,2)")
        self.assert_js(page, "hasItem('snack')&&RT.deskUsed['lab5:3:2']&&!RT.pendingLoot['lab5:3:2']")

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

    def test_outdoor_light_direction_survives_quality_downgrade(self):
        page = self.page()
        page.evaluate("""S.tsec=760;GLR.cam.position.set(120,1.6,100);
            Settings.q(2);updateLighting();
            window.__targetHigh=GLR.moon.target.position.clone();
            window.__dirHigh=GLR.moon.position.clone().sub(GLR.moon.target.position).normalize();
            Settings.q(1);updateLighting();""")
        self.assert_js(page, "__targetHigh.x===120&&__targetHigh.z===100&&!SHADE.shadows")
        self.assert_js(page, "GLR.moon.target.position.length()<1e-6&&GLR.moon.target.getWorldPosition(new THREE.Vector3()).length()<1e-6")
        self.assert_js(page, "GLR.moon.position.clone().sub(GLR.moon.target.position).normalize().distanceTo(__dirHigh)<1e-6")
        page.evaluate("Settings.q(2);updateLighting();Settings.q(0);updateLighting()")
        self.assert_js(page, "!SHADE.shadows&&GLR.moon.target.position.length()<1e-6")
        self.assert_js(page, "GLR.moon.position.clone().sub(GLR.moon.target.position).normalize().distanceTo(__dirHigh)<1e-6")

    def test_indoor_quality_switch_updates_shafts_without_reentering(self):
        page = self.page()
        page.evaluate("""Settings.q(0);doEnterRoom('teach1');running=false;S.tsec=760;updateLighting();
            window.__roomMesh=GLR.roomMesh;window.__poolCount=SHADE.pools.length;
            window.__pos=[S.x,S.y];""")
        self.assert_js(page, "!SHADE.shaftGrp&&__poolCount>0&&INTERIORS.teach1.shafts.length>0")
        page.evaluate("Settings.q(1);updateLighting()")
        self.assert_js(page, "SHADE.shaftGrp&&SHADE.shaftGrp.parent===GLR.scene&&SHADE.shaftGrp.children.length===INTERIORS.teach1.shafts.length")
        self.assert_js(page, "SHADE.shaftMat.opacity>0&&SHADE.pools.length===__poolCount&&GLR.roomMesh!==__roomMesh&&S.x===__pos[0]&&S.y===__pos[1]")
        page.evaluate("""window.__disposed=0;SHADE.shaftGrp.children[0].geometry.addEventListener('dispose',function(){__disposed++});
            Settings.q(0);updateLighting();""")
        self.assert_js(page, "!SHADE.shaftGrp&&SHADE.pools.length===__poolCount&&__disposed===1&&GLR.roomMesh!==__roomMesh")
        page.evaluate("Settings.q(2);updateLighting()")
        self.assert_js(page, "SHADE.shadows&&SHADE.shaftGrp&&SHADE.pools.length===__poolCount&&GLR.roomMesh!==__roomMesh")

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
        self.assert_js(page, "GLR.patFig.children.length===2&&!GLR.patFig.userData.eye&&GLR.patFig.children[1].geometry.attributes.position.count>500")
        self.assert_js(page, "GLR.patFig.children[1].material.vertexColors===true")

    def test_tsinghua_cup_only_falls_along_tall_outer_walls(self):
        page = self.page()
        page.evaluate("S.x=560*SC;S.y=857*SC")
        self.assert_js(page, "anAllowed('cup')&&cupWall().id==='teach'&&cupWall().m<2.4")
        page.evaluate("S.y=830*SC")                              # 离墙太远
        self.assert_js(page, "!anAllowed('cup')")
        page.evaluate("S.y=990*SC")                              # 教学楼南面柱廊下：头顶有顶
        self.assert_js(page, "!anAllowed('cup')")
        page.evaluate("S.y=857*SC;USE.brollyShield=true")        # 伞挡不住保温杯
        self.assert_js(page, "anAllowed('cup')")
        page.evaluate("USE.brollyShield=false;doEnterRoom('teach1');running=false")
        self.assert_js(page, "!anAllowed('cup')&&cupWall()===null")

    def test_tsinghua_cup_kills_if_you_stay_and_misses_if_you_move(self):
        page = self.page()
        page.evaluate("""S.x=560*SC;S.y=857*SC;AN.pre='cup';AN.locked=true;anStart();
            for(var i=0;i<80&&!S.dead;i++){ anTick(0.05); anfxUpdate(0.05); }""")
        self.assert_js(page, "S.dead")
        page = self.page()
        page.evaluate("""S.x=560*SC;S.y=857*SC;S.san=100;AN.pre='cup';AN.locked=true;anStart();
            for(var i=0;i<40&&AN.data.phase<1;i++){ anTick(0.05); anfxUpdate(0.05); }""")
        self.assert_js(page, "AN.id==='cup'&&AN.data.phase===1&&ANFX.cup.ring.visible")
        page.evaluate("""S.y-=14;                                   // 往外躲开约 1.6 米
            for(var i=0;i<120&&AN.active;i++){ anTick(0.05); anfxUpdate(0.05); }""")
        self.assert_js(page, "!S.dead&&!AN.active&&S.san<100&&RT.traces.some(function(t){return t.k==='cup'})")

    def test_tsinghua_cup_survives_save_and_leaves_trace_outdoors(self):
        page = self.page()
        page.evaluate("""S.x=560*SC;S.y=857*SC;AN.pre='cup';AN.locked=true;anStart();anTick(0.1);saveGame();
            anfxClear();Game.continue_();running=false;""")
        self.assert_js(page, "AN.id==='cup'&&AN.data.phase===0&&ANFX.kind==='cup'&&!!ANFX.cup&&ANFX.cup.cup.visible")
        page.evaluate("""for(var i=0;i<40&&AN.data.phase<1;i++){ anTick(0.05); anfxUpdate(0.05); }""")
        self.assert_js(page, "AN.data.phase===1&&ANFX.cup.ring.visible")
        # 落地后马上躲进楼里：杯子仍记在室外
        page.evaluate("""S.y-=14;for(var i=0;i<60&&AN.data.phase<2;i++){ anTick(0.05); anfxUpdate(0.05); }
            doEnterRoom('teach1');running=false;for(i=0;i<80&&AN.active;i++) anTick(0.05);""")
        self.assert_js(page, "!AN.active&&RT.traces.some(function(t){return t.k==='cup'&&t.room===null})")

    def test_brightness_setting_survives_reload(self):
        context = self.browser.new_context(viewport={'width': 1000, 'height': 700})
        self.contexts.append(context)
        page = context.new_page()
        page.on('pageerror', lambda e: self.errors.append(str(e)))
        page.goto(self.url, wait_until='load')
        page.evaluate('Settings.bright(150)')
        page.reload(wait_until='load')
        self.assert_js(page, "SET.bright===150&&GLR.postMat.uniforms.uBright.value===1.5&&document.getElementById('mb').value==='150'")
        page.evaluate('Settings.bright(60)')
        page.reload(wait_until='load')
        self.assert_js(page, "SET.bright===60&&GLR.postMat.uniforms.uBright.value===0.6&&document.getElementById('mb').value==='60'")

    def test_lights_share_priority_and_follow_removed_items(self):
        page = self.page()
        # 手机不再是光源：用它只会打开小游戏
        page.evaluate("S.bag=['torch','phone','brolly'];USE={torch:false,phone:false,brollyShield:false};toggleTorch();useItem('phone');PHONE.stop();useItem('brolly')")
        self.assert_js(page, 'USE.torch&&!USE.phone&&USE.brollyShield&&GLR.torch.intensity===55')
        page.evaluate('toggleTorch()')
        self.assert_js(page, '!USE.torch&&!USE.phone&&GLR.torch.intensity===0')
        page.evaluate("toggleTorch();removeItem('torch')")
        self.assert_js(page, '!USE.torch&&GLR.torch.intensity===0')
        page.evaluate("removeItem('brolly')")
        self.assert_js(page, '!USE.brollyShield&&GLR.torch.intensity===0')

    def test_light_and_cooldown_restore_and_old_save_defaults(self):
        page = self.page()
        page.evaluate("""S.day=1;S.tsec=700;S.san=50;S.actCool={};
            S.bag=['torch','phone','brolly'];USE={torch:false,phone:false,brollyShield:false};
            toggleTorch();useItem('brolly');doSanAct('wash');saveGame();""")
        page.reload(wait_until='load')
        page.evaluate('Game.continue_();running=false')
        self.assert_js(page, 'USE.torch&&!USE.phone&&USE.brollyShield&&GLR.torch.intensity===55&&S.actCool.wash>0')
        self.assert_js(page, "(() => { const san=S.san,t=S.tsec; doSanAct('wash'); return S.san===san&&S.tsec===t; })()")
        page.evaluate("""var old=loadGame();delete old.actCool;delete old.immuneUsed;old.bag=[];
            old.use={torch:true,phone:true,brollyShield:true};localStorage.setItem('wdfz3d',JSON.stringify(old));""")
        page.reload(wait_until='load')
        page.evaluate('Game.continue_();running=false')
        self.assert_js(page, '!USE.torch&&!USE.phone&&!USE.brollyShield&&GLR.torch.intensity===0&&Object.keys(S.actCool).length===0&&!S.immuneUsed')
        page.evaluate("S.actCool={wash:9999};S.immuneUsed=true;freshState('easy');running=false")
        self.assert_js(page, 'Object.keys(S.actCool).length===0&&!S.immuneUsed')

    def test_fixed_items_remain_after_full_or_duplicate_bag(self):
        page = self.page()
        for room, method, item, flag in [('lab4', "useFacility('Y',INTERIORS.lab4)", 'compass', 'geoCompass'),
                                          ('lab2', "useFacility('K',INTERIORS.lab2)", 'goggles', 'labReagent'),
                                          ('bell1', 'useAltar()', 'coin', 'altarCoin')]:
            with self.subTest(item=item):
                page.evaluate("""room => { S.mode='in';S.room=room;S.bag=['chalk','snack','battery','pill','pen','notebook','memo','phone'];
                    S.actCool={};RT=newRT(); }""", room)
                page.evaluate(method)
                self.assert_js(page, f"!RT.{flag}&&!hasItem('{item}')")
                page.evaluate(f"removeItem('phone');{method}")
                self.assert_js(page, f"RT.{flag}&&hasItem('{item}')")
                page.evaluate(f"RT=newRT();S.actCool={{}};{method}")
                self.assert_js(page, f"!RT.{flag}&&hasItem('{item}')")
                page.evaluate(f"removeItem('{item}');S.actCool={{}};{method}")
                self.assert_js(page, f"RT.{flag}&&hasItem('{item}')")

    def test_immune_talent_saves_once_and_persists(self):
        page = self.page()
        page.evaluate("""S.diff='hard';S.talent='immune';S.immuneUsed=false;S.bag=['elixir'];
            S.san=0;S.viol=100;kill('第一次','vignette');""")
        self.assert_js(page, '!S.dead&&!hasItem(\'elixir\')&&!S.immuneUsed&&S.san>=45&&S.viol<=40')
        page.evaluate("S.san=0;S.viol=100;kill('第二次','vignette');saveGame()")
        self.assert_js(page, '!S.dead&&S.immuneUsed&&S.san>=45&&S.viol<=40')
        page.reload(wait_until='load')
        page.evaluate('Game.continue_();running=false')
        self.assert_js(page, "S.talent==='immune'&&S.immuneUsed&&!S.dead")
        page.evaluate("kill('第三次','vignette')")
        self.assert_js(page, 'S.dead&&!loadGame()')

    def test_immune_talent_ends_a_lethal_anomaly(self):
        page = self.page()
        page.evaluate("""S.diff='hard';S.talent='immune';S.immuneUsed=false;S.bag=[];
            S.san=100;S.viol=0;AN.active=true;AN.id='moth';AN.t=1;AN.acc=4.6;
            AN.data={src:{x:S.x,y:S.y}};anTick(.1);""")
        self.assert_js(page, 'S.immuneUsed&&!S.dead&&!AN.active&&S.san>0')
        page.evaluate('for(var i=0;i<10;i++) update(.1)')
        self.assert_js(page, '!S.dead&&S.immuneUsed')
        page = self.page()
        page.evaluate("""S.diff='hard';S.talent='immune';S.immuneUsed=false;S.bag=[];
            S.x=560*SC;S.y=857*SC;AN.pre='cup';AN.locked=true;anStart();
            for(var i=0;i<80&&!S.immuneUsed;i++) anTick(.05);""")
        self.assert_js(page, "S.immuneUsed&&!S.dead&&!AN.active&&RT.traces.some(function(t){return t.k==='cup'})")

    def test_assimilation_death_can_be_prevented_without_a_choice(self):
        for protection in ('elixir', 'immune', 'god'):
            with self.subTest(protection=protection):
                page = self.page()
                page.evaluate("""protection => {
                    S.diff='hard';S.day=2;S.san=100;S.viol=0;S.tt=100;
                    S.hiddenLatch=true;S.hiddenAsked=true;S.hiddenWindow=0;
                    S.talent=protection==='immune'?'immune':'code';S.immuneUsed=false;
                    S.bag=protection==='elixir'?['elixir']:[];DEV.god=protection==='god';
                    AN.active=false;ROAM.on=false;resolveAssimilation();
                }""", protection)
                self.assert_js(page, '!S.dead&&!PAUSE.on&&!UI.chooseOpen&&S.tt===86&&!S.hiddenLatch&&!S.hiddenAsked')
                if protection == 'elixir':
                    self.assert_js(page, "!hasItem('elixir')")
                elif protection == 'immune':
                    self.assert_js(page, 'S.immuneUsed')
                page.evaluate('update(.1)')
                self.assert_js(page, '!PAUSE.on&&!UI.chooseOpen&&!S.dead&&S.tt<100')

        page = self.page()
        page.evaluate("""S.diff='hard';S.day=2;S.talent='code';S.bag=[];DEV.god=false;
            S.tt=100;S.hiddenLatch=true;S.hiddenAsked=true;resolveAssimilation();""")
        self.assert_js(page, "S.dead&&S.death==='names'&&!UI.chooseOpen")

    def test_lights_out_hud_debug_minutes_and_podium_text(self):
        page = self.page()
        page.evaluate('S.tsec=1339;updateHUD()')
        self.assertEqual(page.locator('#period').inner_text(), '洗漱 · 自由')
        page.evaluate('S.tsec=1345;updateHUD()')
        self.assertEqual(page.locator('#period').inner_text(), '熄灯后 · 宿舍')
        page.evaluate('S.tsec=700;Dev.time(30)')
        self.assertEqual(page.evaluate('fmtClock(S.tsec)'), '12:10')
        page.evaluate("""S.mode='in';S.room='teach1';S.seated=false;S.bag=[];RT=newRT();
            nearWorld=function(){return {ch:'T'}};hit2_seatNear=function(){return false};tryInteract();""")
        self.assert_js(page, "hasItem('chalk')&&document.getElementById('sub').textContent.includes('粉笔')")

    def test_exercise_includes_all_courts_and_night_dorm_accumulates_violations(self):
        page = self.page()
        for area in ('field', 'courtA', 'courtB', 'court2', 'track', 'bad2', 'bad3'):
            with self.subTest(area=area):
                self.assertTrue(page.evaluate("""id => { const o=objById(id);S.mode='out';S.room=null;
                    S.x=(o.x+o.w/2)*SC;S.y=(o.y+o.h/2)*SC;return onField(); }""", area))
        self.assert_js(page, "(() => { const o=objById('court2');S.y=(o.y+o.h/2)*SC;S.x=(o.x-5)*SC;const inside=onField();S.x=(o.x-6)*SC;return inside&&!onField(); })()")
        page.evaluate("""S.mode='in';S.room='dorm1';S.tsec=1345;S.day=2;S.san=80;S.viol=10;
            S.tt=0;S.hiddenLatch=false;updateSystems(1);""")
        self.assert_js(page, '!S.wrong&&S.viol>10&&S.san>80')

    def test_new_games_exclude_unimplemented_talents_but_old_saves_keep_them(self):
        page = self.page()
        self.assert_js(page, "TAL_KEYS.length===6&&TAL_KEYS.includes('immune')&&['map','hand','cold','known','crowd','thin'].every(x=>!TAL_KEYS.includes(x))")
        page.evaluate("S.talent='map';saveGame();Game.continue_();running=false")
        self.assert_js(page, "S.talent==='map'&&TALENTS[S.talent].n==='过目不忘'")

    def test_coin_lures_the_garage_follower_then_expires(self):
        page = self.page()
        page.evaluate("""S.mode='in';S.room='garage1';S.x=400;S.y=400;S.ang=Math.PI/2;
            S.bag=['coin'];S.enterCool=999;USE={torch:false,phone:false,brollyShield:false};
            RT=newRT();ROAM.on=true;ROAM.stage='approach';ROAM.x=500;ROAM.y=400;ROAM.cd=0;ROAM.litAcc=0;
            solidAtInterior=function(){return false};roamBlocked=function(){return false};
            Math.random=function(){return 0.5};throwCoin();roamTick(.1);""")
        self.assert_js(page, "!hasItem('coin')&&RT.lure&&ROAM.y>400&&ROAM.lureTold===1")
        page.evaluate("window.__y=ROAM.y;RT.lure.t=.01;ROAM.cd=0;roamTick(.1)")
        self.assert_js(page, 'RT.lure===null&&ROAM.y<__y')

    def test_debug_panel_requires_password(self):
        page = self.page()
        answers = iter(['wrong', '114514'])
        page.on('dialog', lambda dialog: dialog.accept(next(answers)))
        page.evaluate('Dev.open()')
        self.assert_js(page, '!DEV.on')
        page.evaluate('Dev.open()')
        self.assert_js(page, "DEV.on&&getComputedStyle(document.getElementById('dev')).display!=='none'")
        page.evaluate('Dev.close()')

    def test_anomaly_choice_uses_real_time_and_random_option(self):
        page = self.page()
        page.evaluate("""AN.id='turn';AN.active=true;AN.t=0;AN.acc=0;AN.data={chosen:null};
            Math.random=function(){return .99};anTick(1.3);""")
        self.assert_js(page, "UI.chooseOpen&&document.querySelector('.choice-timer').textContent.includes('5 秒')")
        page.wait_for_timeout(5200)
        self.assert_js(page, "!UI.chooseOpen&&AN.data.chosen==='yes'&&AN.t===1.3&&!UI.choiceTimer")
        page.evaluate("window.__late=false;UI.choice('x',[{label:'a',fn:function(){__late=true}}],{timeoutMs:80});UI.closeChoice()")
        page.wait_for_timeout(130)
        self.assert_js(page, '!__late&&!UI.chooseOpen')

    def test_continuous_days_and_cooldowns_across_time_skips(self):
        page = self.page()
        page.evaluate("""S.day=1;S.tsec=1330;S.fn=null;S.actCool={};S.san=50;doSanAct('sleep');""")
        self.assert_js(page, "S.day===2&&S.tsec===1375&&S.actCool.sleep===gameClock()+200")
        page.evaluate("S.day=2;S.tsec=1438;S.actCool={};doSanAct('wash')")
        self.assert_js(page, 'S.day===2&&S.tsec===1442')
        page.evaluate('S.day=2;S.tsec=1490;window.__clock=gameClock();advanceGameTime(20)')
        self.assert_js(page, 'S.day===2&&S.tsec===450&&gameClock()-__clock===400')
        page.evaluate('S.day=2;S.tsec=1349;advanceGameTime(2)')
        self.assert_js(page, 'S.day===3&&S.tsec===1351')
        page.evaluate("AN.cool.rain=gameClock();S.day=3;S.tsec=1490;advanceGameTime(20)")
        self.assert_js(page, 'gameClock()-AN.cool.rain>260')

    def test_skipped_time_fires_lights_out_and_first_day_story(self):
        page = self.page()
        page.evaluate("""S.day=1;S.tsec=1339;S.fn={note:false,on:false,n:0};S.exam=true;
            S.actCool={};doSanAct('wash');""")
        self.assert_js(page, 'S.tsec===1343&&S.day===1&&S.fn.note&&!S.exam')
        page.evaluate('advanceGameTime(8)')
        self.assert_js(page, 'S.tsec===1351&&S.day===2&&S.fn.on&&S.fn.left===4')

    def test_old_cooldown_timestamps_migrate_without_expiring_or_extending(self):
        page = self.page()
        page.evaluate("""S.day=2;S.tsec=700;S.actCool={wash:2*1440+720};AN.cool={rain:650};saveGame();
            var old=loadGame();delete old.clockVersion;localStorage.setItem('wdfz3d',JSON.stringify(old));""")
        page.reload(wait_until='load')
        page.evaluate('Game.continue_();running=false')
        self.assert_js(page, 'S.actCool.wash-gameClock()===20&&gameClock()-AN.cool.rain===50')

    def test_reload_keeps_follower_and_previews_and_discards_old_hidden_choice(self):
        page = self.page()
        page.evaluate("""doEnterRoom('garage1');running=false;S.tsec=760;S.day=2;
            ROAM.on=true;ROAM.stage='approach';ROAM.x=S.x+55;ROAM.y=S.y+12;ROAM.cd=3;ROAM.litAcc=.7;
            AN.active=false;AN.id=null;AN.pre='moth';AN.preNext=17;AN.locked=true;AN.lockWait=1;AN.next=19;
            S.hiddenLatch=true;S.hiddenAsked=false;S.hiddenWindow=1.7;saveGame();""")
        page.reload(wait_until='load')
        page.evaluate('Game.continue_();running=false')
        page.wait_for_function("document.getElementById('banner').textContent==='地下车库'")
        self.assert_js(page, "ROAM.on&&ROAM.stage==='approach'&&ROAM.x===S.x+55&&ROAM.y===S.y+12&&ROAM.cd===3&&ROAM.litAcc===.7")
        self.assert_js(page, "AN.pre==='moth'&&AN.preNext===17&&AN.locked&&AN.lockWait===1&&AN.next===19&&!S.hiddenLatch&&S.hiddenWindow===0")
        page.evaluate('S.tt=100;S.hiddenAsked=true;saveGame()')
        page.reload(wait_until='load')
        page.evaluate('Game.continue_();running=false')
        page.wait_for_function("document.getElementById('banner').textContent==='地下车库'")
        page.evaluate('updateSystems(.01)')
        self.assert_js(page, "S.dead&&S.death==='names'&&!UI.chooseOpen")

    def test_reload_restores_timed_anomaly_choice_and_indoor_effect(self):
        page = self.page()
        page.evaluate("""doEnterRoom('teach1');running=false;AN.id='turn';AN.active=true;AN.t=0;AN.acc=0;
            AN.data={chosen:null};anTick(1.3);saveGame();""")
        page.reload(wait_until='load')
        page.evaluate('Game.continue_();running=false')
        page.wait_for_function("document.getElementById('banner').textContent==='教学楼 1F'")
        page.evaluate('update(.01)')
        self.assert_js(page, "AN.id==='turn'&&UI.chooseOpen&&UI.choiceTimer&&AN.data.chosen===null")

        page.evaluate("""UI.closeChoice();AN.id='stare';AN.active=true;AN.t=2;AN.data={};saveGame();""")
        page.reload(wait_until='load')
        page.evaluate('Game.continue_();running=false')
        page.wait_for_function("document.getElementById('banner').textContent==='教学楼 1F'")
        self.assert_js(page, "AN.id==='stare'&&AN.active&&ANFX.kind==='stare'")

    def test_roster_anomaly_choice_is_timed_and_restored(self):
        page = self.page()
        page.evaluate("""doEnterRoom('teach1');running=false;S.bag=[];AN.id='roster';AN.active=true;AN.t=2;
            AN.data={done:false,rx:S.x,ry:S.y};useRoster();saveGame();""")
        self.assert_js(page, 'UI.chooseOpen&&UI.choiceTimer>0')
        page.reload(wait_until='load')
        page.evaluate('Game.continue_();running=false')
        page.wait_for_function("document.getElementById('banner').textContent==='教学楼 1F'&&UI.chooseOpen")
        self.assert_js(page, "AN.id==='roster'&&UI.choiceTimer>0&&document.getElementById('choices').textContent.includes('名单上')")
        page.evaluate("""UI.closeChoice();Math.random=function(){return .5};useRoster(80);""")
        # 按固定间隔轮询：无头浏览器在画面不变时很少刷新，按画面刷新轮询会偶尔等满 2 秒还没检查到。
        page.wait_for_function('!UI.chooseOpen&&AN.data.done', timeout=2000, polling=50)
        self.assert_js(page, '!UI.chooseOpen&&AN.data.done')

    def test_only_hard_to_prevent_anomalies_are_forecast(self):
        page = self.page()
        page.evaluate("S.tsec=760;AN.active=false;AN.next=5;AN.pre='turn';anwTick(.1)")
        self.assert_js(page, '!ANW.on')
        page.evaluate("AN.pre='rain';anwTick(.1)")
        self.assert_js(page, 'ANW.on')
        page.evaluate("S.mode='in';S.room='teach1';anwTick(.1)")
        self.assert_js(page, '!ANW.on')
        page.evaluate("AN.pre='rite';anwTick(.1)")
        self.assert_js(page, '!ANW.on')
        page.evaluate("""AN.pre=null;AN.next=0;S.diff='hard';pickAnomaly=function(){return 'rain'};
            anAllowed=function(){return true};anOn=function(){};anStart();""")
        self.assert_js(page, "!AN.active&&AN.pre==='rain'&&AN.next===8")
        page.evaluate('anStart()')
        self.assert_js(page, "AN.active&&AN.id==='rain'")

    def test_chalk_and_pendulum_only_announce_difficult_anomalies(self):
        page = self.page()
        page.evaluate("""S.mode='in';S.room='lab1';S.actCool={};AN.active=false;AN.pre='turn';AN.locked=false;
            useFacility('Z',INTERIORS.lab1);""")
        self.assert_js(page, "!AN.locked&&document.getElementById('sub').textContent.includes('没有给出危险预警')")
        page.evaluate("AN.pre='moth';AN.rained=true;S.actCool={};useFacility('Z',INTERIORS.lab1)")
        self.assert_js(page, "AN.locked&&document.getElementById('sub').textContent.includes('蛾群')")
        page.evaluate("""HAS_FX.chalk=0;AN.data={};pickAnomaly=function(){return 'turn'};anOn('chalk');""")
        self.assert_js(page, '!AN.pre&&!AN.preNext&&AN.data.until===undefined')
        page.evaluate("AN.data={};pickAnomaly=function(){return 'rain'};anOn('chalk')")
        self.assert_js(page, "AN.pre==='rain'&&AN.locked&&AN.preNext>0&&AN.data.until>S.tsec")

    def test_day_budget_reflects_three_minute_breaks_and_eight_minute_activities(self):
        page = self.page()
        mins = page.evaluate("""(()=>{var t=SCHED.reduce((n,p)=>n+(p[1]-p[0])/p[4],0);
            return t+(BEAST_SLOW_T1-BEAST_SLOW_T0)*(1/BEAST_RATE-1/RATE.CLASS);})()""")
        self.assertTrue(43.7 <= mins <= 43.9, mins)
        free = page.evaluate("SCHED.filter(p=>p[3]==='自由'&&p[0]<LIGHTS_OUT).reduce((n,p)=>n+(p[1]-p[0])/p[4],0)")
        self.assertGreaterEqual(free, 34)          # 六次课间加午、晚活动

    def test_full_violation_no_longer_kills_but_blocks_leave(self):
        page = self.page()
        page.evaluate("S.tsec=600;S.seated=false;S.viol=99.9;S.bag=['leave'];for(var i=0;i<10;i++) updateSystems(0.2)")
        self.assert_js(page, "!S.dead&&S.viol>=100&&RT.violFull")
        page.evaluate("useItem('leave')")
        self.assert_js(page, "hasItem('leave')&&!onLeave()")

    def test_leave_slip_excuses_schedule_and_patroller_then_expires(self):
        page = self.page()
        page.evaluate("doEnterRoom('teach1');running=false;S.tsec=600;S.seated=false;S.viol=0;S.bag=['leave'];useItem('leave')")
        self.assert_js(page, "onLeave()&&!hasItem('leave')&&patIgnores()&&/请假中/.test((updateHUD(),document.getElementById('period').textContent))")
        page.evaluate("for(var i=0;i<20;i++) updateSystems(0.5)")
        self.assert_js(page, "S.viol===0&&!S.wrong")
        page.evaluate("advanceGameTime(LEAVE_MIN+1);updateSystems(0.1)")
        self.assert_js(page, "!onLeave()&&!RT.leaveUntil&&!patIgnores()")

    def test_phone_only_plays_paper_plane_and_restores_a_little_san(self):
        page = self.page()
        page.evaluate("S.bag=['phone'];S.san=50;S.tsec=700;useItem('phone')")
        self.assert_js(page, "PHONE.on&&document.getElementById('phone').style.display==='flex'&&GLR.torch.intensity===0&&!playerInputAllowed()")
        page.evaluate("var t0=S.tsec,x0=S.x;KEY.w=true;update(0.5);KEY.w=false;window._t0=t0;window._x0=x0")
        self.assert_js(page, "S.tsec>_t0&&S.x===_x0")          # 世界照走，人站着不动
        page.keyboard.press('Space')
        self.assert_js(page, "PHONE.st==='fly'")
        page.evaluate("for(var i=0;i<200&&PHONE.st==='fly';i++) PHONE.tick(0.05)")
        self.assert_js(page, "PHONE.st==='over'")
        page.evaluate("window._s0=S.san;PHONE.reset();PHONE.st='fly';PHONE.score=9;PHONE.end()")
        self.assert_js(page, "Math.abs(S.san-_s0-6)<1e-9&&PHONE.cool>0")   # 一局最多 +6
        page.evaluate("window._s0=S.san;PHONE.reset();PHONE.st='fly';PHONE.score=9;PHONE.end()")
        self.assert_js(page, "S.san===_s0")                                 # 发烫：这局不回
        page.evaluate("AN.active=true;AN.id='broad';PHONE.tick(0.01)")
        self.assert_js(page, "!PHONE.on&&document.getElementById('phone').style.display==='none'")

    def test_phone_opens_from_inventory_on_mouse_and_touch(self):
        for touch in (False, True):
            with self.subTest(touch=touch):
                page = self.page(touch=touch)
                page.evaluate("S.bag=['phone'];S.tsec=700;S.san=90;UI.open('bag')")
                phone = page.locator('#bags .s').first
                if touch:
                    phone.tap()
                    self.assert_js(page, "!PHONE.on&&UI.openPanel==='bag'")
                    phone.tap()
                else:
                    phone.dblclick()
                self.assert_js(page, "PHONE.on&&!UI.anyOpen()&&document.getElementById('bag').style.display==='none'")
                self.assertTrue(page.locator('#phcv').is_visible())
                page.evaluate("window._t0=S.tsec;window._x0=S.x;S.stam=20;S.snackT=5;KEY.w=true;update(0.5)")
                self.assert_js(page, 'PHONE.on&&S.tsec>_t0&&S.x===_x0&&S.stam>20&&S.snackT<5')
                page.locator('#phcv').click()
                self.assert_js(page, "PHONE.st==='fly'")
                page.locator('#phone .phx').click()
                self.assert_js(page, '!PHONE.on&&playerInputAllowed()')

    def test_phone_yields_to_choice_anomaly_death_and_menu(self):
        for situation in ('choice', 'anomaly', 'death', 'menu'):
            with self.subTest(situation=situation):
                page = self.page()
                page.evaluate("S.diff='hard';S.day=2;S.tsec=700;S.bag=['phone'];S.san=80;AN.active=false;PAT.locked=false;useItem('phone')")
                if situation == 'choice':
                    page.evaluate("UI.choice('纸条', [{label:'收起',fn:function(){}}]);update(.1)")
                    self.assert_js(page, 'UI.chooseOpen&&!PHONE.on')
                elif situation == 'anomaly':
                    page.evaluate("spotTick=function(){};AN.pre='turn';AN.locked=true;anStart();window._message=document.getElementById('sub').textContent;update(.1)")
                    self.assert_js(page, "!PHONE.on&&AN.active&&document.getElementById('sub').textContent===_message")
                elif situation == 'death':
                    page.evaluate("S.san=0;update(.1)")
                    self.assert_js(page, 'S.dead&&!PHONE.on')
                else:
                    page.evaluate('Game.quit();update(.1)')
                    self.assert_js(page, "S.screen==='menu'&&!PHONE.on")
                self.assert_js(page, "document.getElementById('phone').style.display==='none'")

    def test_phone_reward_cooldown_survives_reload_and_old_saves(self):
        page = self.page()
        page.evaluate("S.bag=['phone'];S.san=50;useItem('phone');PHONE.score=6;PHONE.end();PHONE.stop();saveGame()")
        page.reload(wait_until='load')
        page.evaluate('Game.continue_();running=false')
        self.assert_js(page, 'PHONE.cool===PH_COOL')
        page.evaluate("S.san=50;useItem('phone');PHONE.score=6;PHONE.end()")
        self.assert_js(page, 'S.san===50')
        page.evaluate("PHONE.stop();var old=loadGame();delete old.phoneCool;localStorage.setItem('wdfz3d',JSON.stringify(old));Game.continue_();running=false")
        self.assert_js(page, 'PHONE.cool===0')

    def test_shoulder_tap_smile_variant_small_loss_for_turning_round(self):
        page = self.page()
        page.evaluate("""TURN_SMILE_P=1;S.san=60;S.viol=0;AN.pre='turn';AN.locked=true;anStart();
            for(var i=0;i<60&&!UI.chooseOpen;i++) anTick(0.05);""")
        self.assert_js(page, "AN.data.smile&&UI.chooseOpen&&/等我回头/.test(document.getElementById('choices').textContent)")
        page.evaluate("var a0=S.ang;window._a0=a0;AN.data.chosen='yes';UI.closeChoice();for(var i=0;i<20;i++){ anTick(0.05); smileTick(0.05); }")
        self.assert_js(page, "S.san===55.5&&Math.abs(S.ang-_a0-Math.PI)<1e-6&&SMILE.mode==='behind'")
        page.evaluate("for(var i=0;i<60&&AN.active;i++){ anTick(0.05); smileTick(0.05); }")
        self.assert_js(page, "!AN.active")
        page.evaluate("""S.san=60;S.viol=0;AN.pre='broad';anScheduleNext();AN.pre='turn';AN.locked=true;anStart();
            for(var i=0;i<60&&!UI.chooseOpen;i++) anTick(0.05);
            AN.data.chosen='no';UI.closeChoice();for(i=0;i<40&&!SMILE.mode;i++) anTick(0.05);""")
        self.assert_js(page, "SMILE.mode==='jump'&&S.san<40&&S.viol>=15&&!AN.active")

    def test_shoulder_smile_loss_uses_difficulty_and_can_be_fatal(self):
        page = self.page()
        page.evaluate("""S.diff='hard';S.day=2;S.san=60;S.viol=0;TURN_SMILE_P=1;
            AN.pre='turn';AN.locked=true;anStart();AN.data.chosen='yes';anTick(.31);""")
        self.assert_js(page, 'S.san===53.75&&!S.dead&&AN.active')
        page.evaluate("""anEnd();smileClear();S.san=5;S.bag=[];S.talent='code';DEV.god=false;
            AN.pre='turn';AN.locked=true;anStart();AN.data.chosen='yes';anTick(.31);""")
        self.assert_js(page, "S.dead&&S.death==='vignette'")

    def test_monologue_changes_with_san(self):
        page = self.page()
        page.evaluate("S.san=90")
        self.assert_js(page, "monoTier()==='calm'&&MONO_LINES.calm.outDay.concat(MONO_LINES.calm.outNight,MONO_LINES.calm.any).indexOf(monoPick())>=0")
        page.evaluate("S.san=10")
        self.assert_js(page, "monoTier()==='breaking'&&MONO_LINES.breaking.any.concat(MONO_LINES.breaking.outNight||[]).indexOf(monoPick())>=0")
        page.evaluate("DLG.open=false;AN.active=false;MONO.t=0;MONO.recent=[];monoTick(0.1)")
        self.assert_js(page, "MONO.recent.length===1&&document.getElementById('sub').textContent===MONO.recent[0]&&MONO.t>=40")

    def test_journal_tabs_share_one_panel_and_keys_switch_or_close(self):
        page = self.page()
        page.keyboard.press('Tab')
        self.assert_js(page, "UI.openPanel==='bag'&&document.getElementById('journal').style.display==='flex'&&document.querySelector('.jtabs .on').dataset.tab==='bag'")
        page.keyboard.press('h')
        self.assert_js(page, "UI.openPanel==='think'&&document.getElementById('bag').style.display==='none'&&document.getElementById('think').style.display==='block'")
        page.locator('#journal .jtabs button', has_text='地图').click()
        self.assert_js(page, "UI.openPanel==='mapv'&&!!document.getElementById('mapcv')")
        page.keyboard.press('m')
        self.assert_js(page, "!UI.anyOpen()&&document.getElementById('journal').style.display==='none'")

    def test_journal_hides_when_replaced_by_pause(self):
        page = self.page()
        page.keyboard.press('Tab')
        page.evaluate('Game.pause()')
        self.assertTrue(page.locator('#pause').is_visible())
        self.assertFalse(page.locator('#journal').is_visible())
        page.locator('#pause button', has_text='继续').click()
        page.evaluate("os('恢复后字幕可见',3)")
        self.assertTrue(page.locator('#sub').is_visible())
        self.assert_js(page, "!UI.anyOpen()&&!document.body.classList.contains('jopen')")

    def test_narrow_portrait_hotbar_is_visible_and_tappable(self):
        page = self.page(touch=True)
        for height in (568, 480):
            with self.subTest(height=height):
                page.set_viewport_size({'width': 320, 'height': height})
                page.evaluate("S.bag=['brolly','torch','watch'];S.hot=['brolly','torch'];USE.brollyShield=false;USE.torch=false;UI.renderHot();updateHUD()")
                status = page.locator('#status').bounding_box()
                book = page.locator('#tBook').bounding_box()
                clock = page.locator('#clock').bounding_box()
                self.assertLess(status['x']+status['width'], book['x'])
                self.assertLessEqual(clock['x']+clock['width'], status['x']+status['width'])
                stick = page.locator('#stick').bounding_box()
                for selector in ('#hot .hslot', '#tTorch'):
                    for control in page.locator(selector).all():
                        rect = control.bounding_box()
                        self.assertGreaterEqual(rect['x'], 0)
                        self.assertLessEqual(rect['x']+rect['width'], 320)
                        self.assertLess(rect['y']+rect['height'], stick['y'])
                page.locator('#hot .hslot').nth(0).tap()
                self.assert_js(page, 'USE.brollyShield')
                page.locator('#hot .hslot').nth(1).tap()
                self.assert_js(page, 'USE.torch')
                page.locator('#tBook').tap()
                self.assertTrue(page.locator('#journal').is_visible())
                page.locator('#journal .jclose').tap()

    def test_bell_platform_opening_clearance_and_collision(self):
        page = self.page()
        result = page.evaluate("""() => {
            doEnterRoom('bell1');running=false;
            const R=INTERIORS.bell1,s=SPIRAL;
            GLR.roomMesh.updateMatrixWorld(true);
            function point(a,r=1.6){
                return {x:s.cx+Math.cos(a)*r,z:s.cz+Math.sin(a)*r};
            }
            const a=s.th0+s.amax-3.5,p=point(a),floor=(s.amax-3.5)/TAU*s.turnH;
            const ray=new THREE.Raycaster(new THREE.Vector3(p.x,floor+.35,p.z),
                new THREE.Vector3(0,1,0),0,EYE-.35);
            const headHits=ray.intersectObject(GLR.roomMesh,true).length;
            SP.state='top';SP.a=s.amax;
            function blocked(offset){
                const p=point(s.th0+s.amax+offset);
                return spiralSolid(R,R.ox+(p.x+R.cols/2)*9,R.oy+(p.z+R.rows/2)*9);
            }
            const result={headHits,holeBlocked:blocked(-3.5),platformFree:!blocked(.5),
                stairFree:!blocked(-.2)};
            function world(a,r=1.6){const p=point(a,r);return {x:R.ox+(p.x+R.cols/2)*9,y:R.oy+(p.z+R.rows/2)*9};}
            function walk(target){
                for(let i=0;i<1000;i++){
                    const dx=target.x-S.x,dy=target.y-S.y,len=Math.hypot(dx,dy);
                    if(len<.02) return;
                    moveBy(dx/len*Math.min(len,.3),dy/len*Math.min(len,.3));spiralUpdate();
                }
                throw Error('Stairs blocked at '+JSON.stringify(target));
            }
            // Only the starting position is placed; ascent/descent must obey player collision.
            const start=world(s.th0,3);S.x=start.x;S.y=start.y;spiralReset();
            walk(world(s.th0));
            for(let a=s.th0+.04;a<s.th0+s.amax+.6;a+=.04) walk(world(a));
            result.reachedBell=bellReach()&&S.floorY===s.topH;
            for(let a=s.th0+s.amax+.55;a>s.th0+s.amax-.4;a-=.04) walk(world(a));
            result.descended=SP.state==='stair'&&S.floorY<s.topH;
            return result;
        }""")
        self.assertEqual(result, {'headHits': 0, 'holeBlocked': True,
                                  'platformFree': True, 'stairFree': True,
                                  'reachedBell': True, 'descended': True})

    def test_pill_effect_survives_reload_and_old_saves_default_to_zero(self):
        page = self.page()
        page.evaluate("S.tsec=760;S.san=10;S.bag=['pill'];useItem('pill');updateSystems(.5);saveGame()")
        saved = page.evaluate('({time:S.pillT,san:S.san})')
        page.reload(wait_until='load')
        page.evaluate('Game.continue_();running=false')
        self.assertEqual(page.evaluate('({time:S.pillT,san:S.san})'), saved)
        page.keyboard.press('Tab')
        page.evaluate('update(1)')
        self.assertEqual(page.evaluate('S.pillT'), saved['time'])
        page.keyboard.press('Tab')
        page.evaluate('updateSystems(.5)')
        self.assertAlmostEqual(page.evaluate('S.pillT'), saved['time']-.5)
        page.evaluate("const d=loadGame();delete d.pillT;localStorage.setItem('wdfz3d',JSON.stringify(d));Game.continue_();running=false")
        self.assert_js(page, 'S.pillT===0')

    def test_bag_detail_buttons_use_hotbar_and_drop(self):
        page = self.page()
        page.evaluate("S.bag=['coin','chalk'];S.hot=[null,null];S.bagSel=1;UI.open('bag')")
        self.assertEqual(page.locator('#bagname').inner_text(), '粉笔')
        page.locator('#bagacts button', has_text='放到快捷栏 2').click()
        self.assert_js(page, "S.hot[1]==='chalk'&&document.querySelector('#bags .s.on .hk').textContent==='2'")
        page.locator('#bagacts button', has_text='丢弃').click()
        self.assert_js(page, "S.bag.join()==='coin'&&S.hot[1]===null")

    def test_choice_number_keys_pick_option(self):
        page = self.page()
        page.evaluate("window.picked=0;UI.choice('选',[{label:'甲',fn:function(){picked=1}},{label:'乙',fn:function(){picked=2}}])")
        page.keyboard.press('2')
        self.assert_js(page, "picked===2&&!UI.chooseOpen")

    def test_touch_action_button_shows_current_action_and_book_opens_journal(self):
        page = self.page(touch=True)
        page.evaluate("S.seated=true;updateHUD()")
        self.assertEqual(page.locator('#tActL').inner_text(), '站起来')
        self.assert_js(page, "document.getElementById('tAct').classList.contains('live')")
        page.evaluate("S.seated=false;S.mode='out';S.x=1580;S.y=1800;updateHUD()")
        page.locator('#tBook').tap()
        self.assert_js(page, "UI.openPanel==='bag'")

    def test_slow_touch_action_still_fires_once(self):
        page = self.page(touch=True)
        # 处理按钮要大半秒（手机上坐下、进房间）时，浏览器补发的 click 不能再触发一次
        page.evaluate("window.actions=0;tryInteract=function(){actions++;var e=performance.now()+900;while(performance.now()<e){}};void 0")
        page.locator('#tAct').tap()
        page.wait_for_timeout(1200)
        self.assert_js(page, 'actions===1')

    def test_touch_action_with_slow_follow_up_still_fires_once(self):
        page = self.page(touch=True)
        # 处理本身很快，但排了一段很重的后续（进房间：淡出后建场景）。补发的 click 被拖过时间窗也不能再触发
        page.evaluate("""window.actions=0;tryInteract=function(){actions++;
          setTimeout(function(){var e=performance.now()+1200;while(performance.now()<e){}},0)};void 0""")
        page.locator('#tAct').tap()
        page.wait_for_timeout(2500)
        self.assert_js(page, 'actions===1')
        page.locator('#tAct').tap()
        page.wait_for_timeout(2500)
        self.assert_js(page, 'actions===2')

    def test_tap_does_not_click_what_appears_under_the_finger(self):
        page = self.page(touch=True)
        # 按钮处理后在手指下面弹出另一个能点的东西（开始游戏后出现前情提要）：补发的 click 不能点到它
        page.evaluate("""window.under=0;var d=document.createElement('div');d.id='underlay';
          d.style.cssText='position:fixed;inset:0;z-index:998;display:none';
          d.addEventListener('click',function(){under++});document.body.appendChild(d);
          var b=document.createElement('button');b.id='opener';b.textContent='开';
          b.style.cssText='position:fixed;left:40px;top:40px;width:200px;height:80px;z-index:999';
          b.onclick=function(){b.remove();d.style.display='block'};document.body.appendChild(b);void 0""")
        page.locator('#opener').tap()
        page.wait_for_timeout(600)
        self.assert_js(page, 'under===0')
        page.touchscreen.tap(120, 80)        # 再点一次是真的点在它上面
        page.wait_for_timeout(300)
        self.assert_js(page, 'under===1')

    def test_skipping_a_cutscene_does_not_press_the_button_behind_it(self):
        page = self.page(touch=True)
        page.evaluate("""window.hit=0;var b=document.createElement('button');b.id='behind';b.textContent='回到主菜单';
          b.style.cssText='position:fixed;inset:0;z-index:999;display:none';b.onclick=function(){hit++};
          document.body.appendChild(b);S.screen='cut';
          window.cutSkip=function(){S.screen='play';b.style.display='block'};void 0""")
        page.touchscreen.tap(200, 200)
        page.wait_for_timeout(600)
        self.assert_js(page, "hit===0&&S.screen==='play'")
        page.touchscreen.tap(200, 200)
        page.wait_for_timeout(300)
        self.assert_js(page, 'hit===1')

    def test_portrait_subtitle_uses_full_width(self):
        page = self.page(touch=True)
        page.evaluate("os('我：今天和昨天没有什么不一样。每一天，都和昨天没有什么不一样。',5)")
        self.assert_js(page, "document.getElementById('sub').getBoundingClientRect().width>300")

    def test_pill_heals_over_time_snack_lasts_thirty_seconds_and_day_is_brighter(self):
        page = self.page()
        # 午饭时间（自由时段）：先量 10 秒自然回复，再吃药片比较，多出来的就是药片的 2 点 / 秒
        page.evaluate("""S.tsec=760;S.san=20;for(var i=0;i<20;i++) updateSystems(0.5);window._base=S.san-20;
            S.tsec=760;S.san=20;S.bag=['pill','snack'];useItem('pill');for(i=0;i<20;i++) updateSystems(0.5);""")
        self.assert_js(page, "Math.abs((S.san-20)-_base-20)<0.01&&S.pillT===20")
        page.evaluate("S.san=10;for(var i=0;i<60;i++) updateSystems(0.5)")
        self.assert_js(page, "S.pillT===0&&S.san>=50")
        page.evaluate("useItem('snack')")
        self.assert_js(page, "SNACK_SEC===30&&S.snackT===30")
        page.evaluate("S.tsec=720;S.mode='out';updateLighting()")
        self.assert_js(page, "Math.abs(GLR.dayExpo-0.6)<0.03")


if __name__ == '__main__':
    unittest.main(verbosity=2)
