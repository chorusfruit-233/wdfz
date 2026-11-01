"""调试面板的真实浏览器操作、场景切换和存档边界。"""
import json

from browser_case import BrowserCase


class DebugPanelTest(BrowserCase):
    def game(self, touch=False):
        page = self.page(touch=touch)
        page.evaluate("Game.start('hard');clearIntroTimers();running=false")
        page.wait_for_function("S.room==='teach1'&&GLR.roomMesh&&GLR.roomMesh.userData.roomData===INTERIORS.teach1")
        page.evaluate("S.intro=0;AN.active=false;PAT.next=1000;AN.next=1000;S.tt=0;S.talent='code'")
        # 密码校验由 test_debug_panel_requires_password 单独覆盖；其他测试只替代提示框输入。
        page.evaluate("window.prompt=()=>Dev.open.toString().match(/password!==(?:'|\")([^'\"]+)/)[1]")
        return page

    def open_panel(self, page):
        page.keyboard.press('F2')
        page.locator('#dev').wait_for(state='visible')

    def test_freeze_is_explicit_and_closing_restores_game_input(self):
        page = self.game()
        self.open_panel(page)
        self.assert_js(page,'!DEV.freeze&&playerInputAllowed()')
        page.evaluate('window.startTime=S.tsec;update(1)')
        self.assert_js(page,'S.tsec>startTime')
        page.locator('#devfreeze').click()
        page.evaluate('window.startTime=S.tsec;window.startVisual=VisualState.time;update(1)')
        self.assert_js(page,'DEV.freeze&&S.tsec===startTime&&VisualState.time===startVisual&&!playerInputAllowed()')
        self.assertIn('调试暂停',page.locator('#devrun').inner_text())
        page.locator('#devfreeze').click()
        page.evaluate('update(1)')
        self.assert_js(page,'!DEV.freeze&&S.tsec>startTime&&DEV.on&&playerInputAllowed()')
        page.keyboard.press('F2')
        self.assert_js(page,'!DEV.on&&playerInputAllowed()')

    def test_pause_menu_and_focused_input_close_without_losing_pause(self):
        page = self.game()
        page.evaluate('Game.pause()')
        page.locator('#pause button').filter(has_text='调试').click()
        self.assertFalse(page.locator('#devfreeze').is_disabled())
        self.assertIn('游戏菜单已暂停',page.locator('#devrun').inner_text())
        page.locator('[data-dev-tab="scene"]').click()
        page.locator('#devroomFilter').fill('教学')
        page.keyboard.press('F2')
        self.assert_js(page,"!DEV.on&&PAUSE.on&&UI.openPanel==='pause'")
        page.locator('#pause button').filter(has_text='调试').click()
        page.locator('[data-dev-tab="scene"]').click()
        page.locator('#devroomFilter').focus()
        page.keyboard.press('Escape')
        self.assert_js(page,"!DEV.on&&PAUSE.on&&UI.openPanel==='pause'")

    def test_keyboard_focus_stays_inside_and_quitting_cleans_up(self):
        page = self.game()
        self.open_panel(page)
        self.assert_js(page,"document.body.classList.contains('dev-open')&&document.getElementById('dev').getAttribute('aria-modal')==='false'")
        page.locator('.devclose').focus()
        page.keyboard.press('Shift+Tab')
        self.assertTrue(page.locator('.devreset').evaluate('(el)=>document.activeElement===el'))
        page.keyboard.press('Shift+Tab')
        self.assertTrue(page.locator('#devcollapse').evaluate('(el)=>document.activeElement===el'))
        page.keyboard.press('Shift+Tab')
        self.assertTrue(page.locator('#devdrag').evaluate('(el)=>document.activeElement===el'))
        page.keyboard.press('Shift+Tab')
        self.assertEqual(page.evaluate('document.activeElement.textContent'),'复活角色')
        page.keyboard.press('Tab')
        self.assertTrue(page.locator('#devdrag').evaluate('(el)=>document.activeElement===el'))
        page.keyboard.press('Tab')
        page.keyboard.press('Tab')
        page.keyboard.press('Tab')
        self.assertTrue(page.locator('.devclose').evaluate('(el)=>document.activeElement===el'))
        self.assert_js(page,"document.elementFromPoint(innerWidth-5,innerHeight-5).id==='cv'")
        page.evaluate('Game.quit()')
        self.assert_js(page,"!DEV.on&&S.screen==='menu'&&!document.body.classList.contains('dev-open')")

    def test_panel_can_close_during_death_and_prologue(self):
        page = self.game()
        page.evaluate('S.dead=true')
        self.open_panel(page)
        page.keyboard.press('Escape')
        self.assert_js(page,'!DEV.on&&S.dead')
        page.evaluate('S.dead=false;PRO.on=true')
        self.open_panel(page)
        page.keyboard.press('Escape')
        self.assert_js(page,'!DEV.on&&PRO.on')

    def test_open_window_allows_mouse_keyboard_interaction_and_inventory(self):
        page = self.game()
        page.evaluate("""const R=INTERIORS.teach1;S.seated=false;
          S.x=R.ox+30.5*R.tw;S.y=R.oy+19.5*R.th;S.ang=0;syncCamera(0);""")
        page.mouse.click(850,650)
        page.wait_for_function('pointerIsLocked()')
        self.open_panel(page)
        page.wait_for_function('!pointerIsLocked()')
        self.assert_js(page,'DEV.on&&!PAUSE.on&&!DEV.freeze')
        page.mouse.click(850,650)
        page.wait_for_function('pointerIsLocked()')
        page.evaluate('window.oldX=S.x;window.oldAngle=S.ang')
        page.keyboard.down('w')
        page.evaluate('update(.2)')
        page.keyboard.up('w')
        page.mouse.move(890,630)
        self.assert_js(page,'DEV.on&&S.x>oldX+.1&&Math.abs(S.ang-oldAngle)>.01')
        page.evaluate('S.seated=true')
        page.keyboard.press('e')
        self.assert_js(page,'!S.seated&&DEV.on')
        page.keyboard.press('Tab')
        page.wait_for_function("UI.openPanel==='bag'&&!pointerIsLocked()")
        self.assert_js(page,'DEV.on')
        page.keyboard.press('Escape')
        page.wait_for_function('!UI.anyOpen()&&pointerIsLocked()')
        page.keyboard.press('Escape')
        page.wait_for_function('PAUSE.on&&!pointerIsLocked()')
        self.assert_js(page,"DEV.on&&UI.openPanel==='pause'")
        page.keyboard.press('F2')
        self.assert_js(page,'!DEV.on&&PAUSE.on')

    def test_alt_frees_mouse_for_the_open_panel_without_pausing(self):
        page = self.game()
        self.open_panel(page)
        page.mouse.click(850,650)
        page.wait_for_function('pointerIsLocked()')
        page.keyboard.press('Alt')
        page.wait_for_function('!pointerIsLocked()')
        page.wait_for_timeout(150)
        self.assert_js(page,"DEV.on&&!PAUSE.on&&!UI.openPanel&&playerInputAllowed()")
        page.locator('#devfreeze').click()
        self.assert_js(page,'DEV.freeze&&!PAUSE.on')
        self.assertIn('Alt',page.locator('#devhelp').inner_text())

    def test_editing_panel_does_not_move_player_or_trigger_game_shortcuts(self):
        page = self.game()
        self.open_panel(page)
        page.locator('[data-dev-tab="scene"]').click()
        page.evaluate("KEY.w=true;S.seated=true;window.oldPlace=[S.x,S.y,S.ang];window.oldBag=JSON.stringify(S.bag)")
        page.locator('#devroomFilter').focus()
        self.assert_js(page,'!KEY.w&&!LOOKDRAG.on')
        page.keyboard.type('wasderfghjm123')
        page.evaluate('updatePlayer(.3)')
        self.assert_js(page,"DEV.on&&S.seated&&!UI.openPanel&&!LESSON.on&&oldBag===JSON.stringify(S.bag)&&[S.x,S.y,S.ang].every((n,i)=>n===oldPlace[i])")
        self.assertEqual(page.locator('#devroomFilter').input_value(),'wasderfghjm123')
        page.keyboard.press('Escape')
        self.assert_js(page,'!DEV.on&&!PAUSE.on')

    def test_resume_from_pause_keeps_window_open_and_touch_controls_work(self):
        for touch in (False, True):
            with self.subTest(touch=touch):
                page = self.game(touch=touch)
                page.evaluate('Game.pause()')
                button=page.locator('#pause button').filter(has_text='调试')
                button.tap() if touch else button.click()
                self.assert_js(page,'DEV.on&&PAUSE.on')
                button=page.locator('#devfreeze')
                self.assertEqual(button.inner_text(),'继续游戏')
                button.tap() if touch else button.click()
                self.assert_js(page,'DEV.on&&!PAUSE.on&&!UI.anyOpen()&&playerInputAllowed()')
                self.assertTrue(page.locator('#fullscreen-toggle').is_visible())
                if touch:
                    self.assertTrue(page.locator('#touch').is_visible())
                    page.evaluate('S.seated=true;window.oldAngle=S.ang')
                    page.locator('#tAct').tap()
                    self.assert_js(page,'!S.seated&&DEV.on')
                    self.swipe(page,(210,760),(240,735))
                    self.assert_js(page,'Math.abs(S.ang-oldAngle)>.01&&DEV.on')
                    rect=page.locator('#stick').bounding_box()
                    x,y=rect['x']+rect['width']/2,rect['y']+rect['height']/2
                    page.evaluate('window.beforeMove=[S.x,S.y]')
                    self.touch(page,'touchStart',[{'x':x,'y':y}])
                    self.touch(page,'touchMove',[{'x':x,'y':y-40}])
                    page.evaluate('updatePlayer(.3)')
                    self.touch(page,'touchEnd',[])
                    self.assert_js(page,'DEV.on&&Math.hypot(S.x-beforeMove[0],S.y-beforeMove[1])>.1')

    def test_continue_does_not_dismiss_an_anomaly_choice(self):
        page = self.game()
        self.open_panel(page)
        page.evaluate("UI.choice('保留选择',[{label:'等待',fn:()=>{}}]);Dev.refresh();Dev.toggleFreeze()")
        self.assertTrue(page.locator('#devfreeze').is_disabled())
        self.assert_js(page,'DEV.on&&UI.chooseOpen&&!DEV.freeze')

    def test_landscape_touch_controls_stay_reachable_while_panel_is_open(self):
        page = self.game(touch=True)
        page.set_viewport_size({'width':844,'height':390})
        page.evaluate('Game.pause()')
        page.locator('#pause button').filter(has_text='调试').tap()
        page.locator('#devfreeze').tap()
        self.assert_js(page,"DEV.on&&!PAUSE.on&&['stick','tAct'].every(id=>{const el=document.getElementById(id),r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})")
        page.evaluate('S.seated=true')
        page.locator('#tAct').tap()
        self.assert_js(page,'!S.seated&&DEV.on')

    def test_panel_clicks_do_not_skip_death_but_game_clicks_do(self):
        page = self.game()
        self.open_panel(page)
        # 此处只验证点击隔离；自动结束另有时间轴测试，不让机器负载抢先结束两秒演出。
        page.evaluate("""const schedule=window.setTimeout;let finishTimer;
          window.setTimeout=(fn,ms)=>{const id=schedule(fn,ms);if(ms===DeathTimeline.duration('vignette')*1000)finishTimer=id;return id;};
          try{S.day=2;S.bag=[];kill('测试死亡','vignette');}finally{window.setTimeout=schedule;clearTimeout(finishTimer);}
          DEATH_PENDING.at-=700;""")
        page.wait_for_timeout(2200)
        page.locator('[data-dev-tab="scene"]').click()
        self.assert_js(page,"!!DEATH_PENDING&&getComputedStyle(document.getElementById('die')).display==='none'")
        page.mouse.click(850,650)
        self.assert_js(page,"DEV.on&&!DEATH_PENDING&&getComputedStyle(document.getElementById('die')).display!=='none'")

    def test_minimize_is_a_tiny_ball_and_restores_panel_without_a_password(self):
        for touch in (False, True):
            with self.subTest(touch=touch):
                page = self.game(touch=touch)
                self.open_panel(page)
                page.locator('[data-dev-tab="scene"]').tap() if touch else page.locator('[data-dev-tab="scene"]').click()
                page.locator('#devroomFilter').fill('lab')
                page.evaluate('Dev.placePanel(40,60,true);document.getElementById("devbody").scrollTop=50;window.savedScroll=document.getElementById("devbody").scrollTop')
                old=page.locator('#dev').bounding_box()
                page.locator('#devcollapse').tap() if touch else page.locator('#devcollapse').click()
                self.assert_js(page,'DEV.on&&DEV.minimized&&!DEV.freeze&&playerInputAllowed()')
                self.assertFalse(page.locator('#devbody').is_visible())
                self.assertEqual(page.locator('#dev').bounding_box()['width'],44)
                self.assertLessEqual(page.locator('#devball span').bounding_box()['width'],20)
                page.evaluate("window.prompt=()=>{throw Error('展开不应再次询问密码')};S.seated=true")
                if touch:
                    page.locator('#tAct').tap()
                else:
                    page.keyboard.press('e')
                self.assert_js(page,'DEV.minimized&&!S.seated')
                page.locator('#devball').tap() if touch else page.locator('#devball').click()
                self.assert_js(page,'DEV.on&&!DEV.minimized&&!DEV.freeze')
                self.assertEqual(page.locator('#devroomFilter').input_value(),'lab')
                self.assert_js(page,'document.getElementById("devbody").scrollTop===savedScroll')
                self.assertAlmostEqual(page.locator('#dev').bounding_box()['x'],old['x'],delta=1)
                self.assertAlmostEqual(page.locator('#dev').bounding_box()['y'],old['y'],delta=1)
                page.keyboard.press('F2')
                self.assert_js(page,'!DEV.on')

    def test_ball_drag_does_not_expand_or_turn_camera_and_tap_still_works(self):
        for touch in (False, True):
            with self.subTest(touch=touch):
                page=self.game(touch=touch)
                self.open_panel(page)
                page.locator('#devcollapse').tap() if touch else page.locator('#devcollapse').click()
                page.evaluate('window.oldView=[S.ang,S.pitch];Dev.placePanel(25,150,true)')
                old=page.locator('#devball').bounding_box()
                x,y=old['x']+22,old['y']+22
                if touch:self.swipe(page,(x,y),(x+95,y+50))
                else:
                    page.mouse.move(x,y)
                    page.mouse.down()
                    page.mouse.move(x+95,y+50,steps=5)
                    page.mouse.up()
                self.assert_js(page,'DEV.minimized&&!DEV.drag&&S.ang===oldView[0]&&S.pitch===oldView[1]')
                moved=page.locator('#devball').bounding_box()
                self.assertGreater(moved['x'],old['x']+80)
                self.assertGreater(moved['y'],old['y']+40)
                page.locator('#devball').tap() if touch else page.locator('#devball').click()
                self.assert_js(page,'!DEV.minimized')
                page.locator('#devcollapse').tap() if touch else page.locator('#devcollapse').click()
                self.assertAlmostEqual(page.locator('#devball').bounding_box()['x'],moved['x'],delta=1)
                page.locator('#devball').focus()
                page.keyboard.press('ArrowRight')
                page.keyboard.press('Home')
                self.assert_js(page,"(()=>{const b=Dev.panelBounds(),r=document.getElementById('devball').getBoundingClientRect();return Math.abs(r.right-b.right)<1&&Math.abs(r.y-(b.top+(b.bottom-b.top-44)/2))<1})()")
                page.keyboard.press('Enter')
                self.assert_js(page,'!DEV.minimized')

    def test_ball_preserves_freeze_survives_orientation_and_closes_on_quit(self):
        page=self.game(touch=True)
        self.open_panel(page)
        page.locator('#devfreeze').tap()
        page.locator('#devcollapse').tap()
        page.evaluate('window.beforeTime=S.tsec;Dev.placePanel(999,999,true);update(1)')
        self.assert_js(page,'DEV.freeze&&DEV.minimized&&S.tsec===beforeTime&&!playerInputAllowed()')
        self.assertIn('暂停',page.locator('#devball').get_attribute('aria-label'))
        page.set_viewport_size({'width':844,'height':390})
        page.wait_for_function("(()=>{let r=document.getElementById('dev').getBoundingClientRect();return r.right<=innerWidth-7&&r.bottom<=innerHeight-7})()")
        ball=page.locator('#devball').bounding_box()
        self.touch(page,'touchStart',[{'x':ball['x']+22,'y':ball['y']+22}])
        self.touch(page,'touchCancel',[])
        self.assert_js(page,'!DEV.drag&&DEV.minimized')
        page.locator('#devball').tap()
        self.assert_js(page,'DEV.freeze&&!DEV.minimized')
        page.locator('#devfreeze').tap()
        page.locator('#devcollapse').tap()
        page.evaluate('Game.quit()')
        self.assertFalse(page.locator('#devball').is_visible())
        self.assert_js(page,'!DEV.on')

    def test_mobile_panel_is_compact_and_every_tab_has_reachable_controls(self):
        for width,height in ((320,568),(390,844),(844,390)):
            with self.subTest(width=width,height=height):
                page=self.game(touch=True)
                page.set_viewport_size({'width':width,'height':height})
                self.open_panel(page)
                rect=page.locator('#dev').bounding_box()
                self.assertLessEqual(rect['width'],300)
                self.assertLessEqual(rect['height'],height*(.74 if width>height else .62)+1)
                for tab in ('status','scene','items','events','tools'):
                    page.locator('[data-dev-tab="'+tab+'"]').tap()
                    self.assert_js(page,"document.getElementById('devbody').clientHeight>=70")
                    self.assert_js(page,"(()=>{let b=document.getElementById('devbody');return b.scrollWidth<=b.clientWidth})()")
                    self.assert_js(page,"Array.from(document.querySelectorAll('#dev button')).filter(e=>e.getClientRects().length).every(e=>e.getBoundingClientRect().height>=44)")
                page.locator('#devreportGo').tap()
                self.assertTrue(page.locator('#devreport').is_visible())
                page.locator('#devcollapse').tap()
                self.assertEqual(page.locator('#devball').bounding_box()['width'],44)

    def test_inventory_editor_respects_capacity_and_cleans_hand_and_hotbar(self):
        page=self.game()
        self.open_panel(page)
        page.evaluate("S.bag=['card'];S.hot=[null,null];bagChanged()")
        page.locator('[data-dev-tab="items"]').click()
        page.locator('#devitemFilter').fill('torch')
        page.locator('#devitemGo').click()
        self.assert_js(page,"hasItem('torch')&&S.bag.length===2")
        self.assertTrue(page.locator('#devitemGo').is_disabled())
        page.locator('#devitemHot1').click()
        page.evaluate("toggleTorch();Dev.refresh()")
        self.assert_js(page,"S.hot[0]==='torch'&&USE.torch")
        page.locator('#devitemRemove').click()
        self.assert_js(page,"!hasItem('torch')&&!USE.torch&&S.hot[0]===null")
        page.evaluate("S.bag=Object.keys(ITEMS).filter(k=>k!=='torch').slice(0,8);window.oldBag=JSON.stringify(S.bag);Dev.refresh()")
        self.assertTrue(page.locator('#devitemGo').is_disabled())
        page.evaluate("Dev.editItem('add')")
        self.assert_js(page,'JSON.stringify(S.bag)===oldBag')
        page.locator('#devitemFilter').fill('does-not-exist')
        for key in ('devitemGo','devitemRemove','devitemHot1','devitemHot2'):
            self.assertTrue(page.locator('#'+key).is_disabled())

    def test_compact_layout_does_not_jump_during_mouse_touch_switch(self):
        page=self.game(touch=True)
        self.open_panel(page)
        rect=page.locator('#dev').bounding_box()
        page.locator('[data-dev-tab="scene"]').click()
        self.assert_js(page,"DEV.tab==='scene'&&INPUT.mode==='mouse'")
        self.assertEqual(page.locator('#dev').bounding_box()['width'],rect['width'])
        page.locator('#devcollapse').click()
        self.assert_js(page,'DEV.minimized')
        page.locator('#devball').tap()
        self.assert_js(page,"!DEV.minimized&&INPUT.mode==='touch'&&DEV.tab==='scene'")
        self.assertEqual(page.locator('#dev').bounding_box()['width'],rect['width'])

    def test_exact_time_keeps_clock_rules_and_blocks_special_flows(self):
        page=self.game()
        self.open_panel(page)
        page.locator('[data-dev-tab="scene"]').click()
        page.evaluate('S.tsec=760;S.day=1;RT.inspection=null;S.fn.note=true')
        page.locator('#devtime').fill('12:50')
        page.locator('#devtimeGo').click()
        self.assert_js(page,'S.tsec===770&&Inspection.state().queue.length===1')
        page.evaluate("Dev.setTime('13:00')")
        self.assert_js(page,'S.tsec===770')
        page.evaluate('Dev.cancelInspection()')
        page.locator('#devtime').fill('22:40')
        page.locator('#devtimeGo').click()
        self.assert_js(page,'S.tsec===1360&&S.day===2')
        page.evaluate("Dev.setTime('00:30')")
        self.assert_js(page,'S.tsec===1470&&S.day===2')
        page.evaluate("Dev.setTime('03:00');Dev.setTime('25:00');Dev.setTime('bad');Dev.setTime('12:99')")
        self.assert_js(page,'S.tsec===1470&&S.day===2')
        page.evaluate("Dev.setTime('07:20')")
        self.assert_js(page,'S.tsec===440&&S.day===1&&!Inspection.pending()')
        page.evaluate("doEnterRoom('lift_teach');window.oldTime=S.tsec;Dev.setTime('12:00')")
        self.assert_js(page,'S.tsec===oldTime')

    def test_event_tools_prevent_overlap_and_inspection_uses_actual_rules(self):
        page=self.game()
        self.open_panel(page)
        page.locator('[data-dev-tab="events"]').click()
        page.evaluate('S.tsec=550;S.seated=false')
        page.locator('#devpatrolStart').click()
        self.assert_js(page,"PAT.state==='warn'")
        page.locator('#devinspectionStart').click()
        self.assert_js(page,'!Inspection.active()')
        page.locator('#devpatrolStop').click()
        page.evaluate('S.san=90;S.viol=30;S.tt=0;S.pitch=1.1;S.moving=false')
        page.locator('#devinspectionStart').click()
        self.assert_js(page,'Inspection.active()')
        page.evaluate('Inspection.tick(8)')
        self.assert_js(page,'!Inspection.active()&&S.san===87&&S.viol===22&&S.tt===3')
        page.locator('#devinspectionStop').click()
        page.locator('#devinspectionStart').click()
        page.evaluate('Inspection.state().queue.push({day:S.day,slot:0})')
        page.locator('#devinspectionStop').click()
        self.assert_js(page,'!Inspection.pending()&&!INSPECT_FX.group&&S.san===87&&S.viol===22')
        page.evaluate("Dev.triggerAnomaly('rain')")
        page.locator('#devpatrolStart').click()
        page.locator('#devinspectionStart').click()
        self.assert_js(page,"AN.active&&PAT.state==='idle'&&!Inspection.active()")
        page.evaluate('Dev.anomEnd();S.tsec=1370;Dev.startPatrol()')
        self.assert_js(page,"PAT.state==='idle'")
        page.evaluate('hideIn({c:28,r:16});Dev.stopPatrol()')
        self.assert_js(page,"HIDE.on&&PAT.state==='idle'")

    def test_stop_preview_leaves_anomalies_and_player_state_intact(self):
        page=self.game()
        self.open_panel(page)
        page.evaluate("window.oldPlayer=JSON.stringify(S);document.getElementById('devdeath').value='grip';Dev.previewDeath();Dev.anim(2);render(.5);Dev.stopPreview()")
        self.assert_js(page,'!DEV.previewFx&&!DEV.previewTimer&&!VisualState.deathAnim')
        self.assert_js(page,"S.ang===JSON.parse(oldPlayer).ang&&S.pitch===JSON.parse(oldPlayer).pitch&&S.eyeLift===JSON.parse(oldPlayer).eyeLift")
        page.evaluate("Dev.triggerAnomaly('rain');Dev.stopPreview()")
        self.assert_js(page,"AN.active&&AN.id==='rain'&&!!WX.rain")

    def test_diagnostic_export_does_not_modify_save_and_contains_current_state(self):
        page=self.game()
        self.open_panel(page)
        page.evaluate("saveGame();window.saved=localStorage.getItem('wdfz3d');window.beforeState=JSON.stringify(S);Dev.report('测试诊断')")
        page.locator('[data-dev-tab="tools"]').click()
        page.locator('#devreportGo').click()
        data=json.loads(page.locator('#devreport').input_value())
        self.assertEqual(data['game']['room'],'teach1')
        self.assertEqual(data['recentActions'][-1]['message'],'测试诊断')
        self.assertIn('memory',data['rendering'])
        with page.expect_download() as download:
            page.locator('#devreportDownload').click()
        result=download.value
        self.assertTrue(result.suggested_filename.endswith('.json'))
        with open(result.path(),encoding='utf-8') as f:
            self.assertEqual(json.load(f)['game']['room'],'teach1')
        self.assert_js(page,"JSON.stringify(S)===beforeState&&localStorage.getItem('wdfz3d')===saved")
        page.evaluate("for(let i=0;i<30;i++)Dev.report('操作 '+i);Dev.refresh()")
        self.assert_js(page,"DEV.history.length===20&&Dev.diagnosticSnapshot().recentActions.length===20")
        self.assertIn('操作 29',page.locator('#devhistory').inner_text())

    def test_filter_teleport_and_hiding_cleanup(self):
        page = self.game()
        self.open_panel(page)
        page.locator('[data-dev-tab="scene"]').click()
        page.locator('#devroomFilter').fill('no-such-room')
        self.assertTrue(page.locator('#devroomGo').is_disabled())
        page.locator('#devroomFilter').fill('admin5')
        self.assertEqual(page.locator('#devroom').input_value(),'admin5')
        page.evaluate("S.seated=false;hideIn({c:28,r:16})")
        page.locator('#devroomGo').click()
        page.wait_for_function("S.mode==='in'&&S.room==='admin5'")
        self.assert_js(page,"!HIDE.on&&document.getElementById('hideslits').style.display==='none'&&canStand(S.x,S.y)")
        self.assert_js(page,"loadGame().room==='admin5'")
        page.evaluate("doEnterRoom('teach1');S.seated=false;hideIn({c:28,r:16})")
        page.locator('#devoutFilter').fill('北门')
        page.locator('#devoutGo').click()
        self.assert_js(page,"S.mode==='out'&&!HIDE.on&&!S.seated&&document.getElementById('hideslits').style.display==='none'")

    def test_state_editor_is_validated_and_respects_stamina_cap(self):
        page = self.game()
        self.open_panel(page)
        page.locator('#devstatvalue').fill('-1')
        page.locator('#dev-page-status').get_by_role('button',name='设定',exact=True).click()
        self.assert_js(page,'S.san===100')
        self.assertIn('0–100',page.locator('#devmessage').inner_text())
        page.locator('#devstatvalue').fill('20')
        page.locator('#dev-page-status').get_by_role('button',name='设定',exact=True).click()
        self.assert_js(page,'S.san===20&&S.stam<=staminaMax()')
        self.assertEqual(page.locator('#devsanValue').inner_text(),'20')
        page.locator('#devstatkey').select_option('stam')
        page.locator('#devstatvalue').fill('100')
        page.locator('#dev-page-status').get_by_role('button',name='设定',exact=True).click()
        self.assert_js(page,'S.stam===staminaMax()&&S.stam===52')

    def test_preview_does_not_consume_protection_or_save_and_animation_clears(self):
        page = self.game()
        page.evaluate("S.bag=['elixir'];saveGame();window.saved=localStorage.getItem('wdfz3d')")
        self.open_panel(page)
        page.locator('[data-dev-tab="events"]').click()
        page.locator('#devdeath').select_option('vignette')
        page.locator('#devdeathGo').click()
        self.assert_js(page,"!S.dead&&hasItem('elixir')&&localStorage.getItem('wdfz3d')===saved&&ANFX.kind==='death'")
        page.evaluate("""window.disposed=0;let g=DEV.previewFx.children.find(x=>x.geometry&&!x.geometry.userData.shared).geometry;
          let dispose=g.dispose;g.dispose=function(){window.disposed++;dispose.call(this)};void 0""")
        page.wait_for_function("!DEV.previewFx&&ANFX.kind!=='death'",timeout=6000)
        self.assert_js(page,'disposed===1')
        page.locator('#devanim').select_option('2')
        page.locator('#dev-page-events .devrow').nth(1).locator('button').click()
        page.evaluate('render(.5)')
        self.assert_js(page,'GLR.postMat.uniforms.uDm.value===2&&GLR.postMat.uniforms.uDt.value>0')
        page.evaluate('render(5)')
        self.assert_js(page,'!VisualState.deathAnim&&GLR.postMat.uniforms.uDm.value===0')

    def test_every_death_preview_keeps_the_live_camera_state(self):
        page = self.game()
        self.open_panel(page)
        result=page.evaluate("""()=>{
          let failures=[],visual=[];SHAKE_ON=false;
          for(const [name,id] of DEV_DEATH){
            S.ang=.7;S.pitch=-.22;S.eyeLift=.12;syncCamera(0);
            const before=JSON.stringify(S),position=GLR.cam.position.clone(),rotation=GLR.cam.quaternion.clone();
            document.getElementById('devdeath').value=id;Dev.previewDeath();
            if(!DEV.previewFx){failures.push(id+':未创建');continue;}
            for(let i=0;i<6;i++)anfxUpdate(.5);
            if(JSON.stringify(S)!==before)failures.push(id+':预览期间修改玩家状态');
            if(GLR.cam.position.distanceTo(position)>1e-5||1-Math.abs(GLR.cam.quaternion.dot(rotation))>1e-5)visual.push(id);
            Dev.clearPreview();
            if(JSON.stringify(S)!==before)failures.push(id+':清理后状态改变');
          }
          return {count:DEV_DEATH.length,failures,visual};
        }""")
        self.assertGreaterEqual(result['count'],28)
        self.assertEqual(result['failures'],[])
        self.assertTrue({'neck','grip','shadow','follow'}.issubset(result['visual']))

    def test_preview_uses_visual_camera_and_keeps_later_player_input(self):
        page = self.game()
        self.open_panel(page)
        page.evaluate("""S.seated=false;S.ang=.4;S.pitch=-.2;S.eyeLift=0;SHAKE_ON=false;syncCamera(0);
          window.baseY=GLR.cam.position.y;document.getElementById('devdeath').value='grip';
          Dev.previewDeath();anfxUpdate(DeathTimeline.duration('grip')*.75);window.previewY=GLR.cam.position.y;
          S.ang=1.1;S.pitch=.15;S.eyeLift=.08;syncCamera(0);window.finalRotation=GLR.cam.quaternion.clone();
          anfxUpdate(.2);Dev.clearPreview();""")
        self.assert_js(page,"previewY<baseY-.5&&S.ang===1.1&&S.pitch===.15&&S.eyeLift===.08")
        self.assert_js(page,'Math.abs(GLR.cam.position.y-(S.eyeH+S.eyeLift+(S.floorY||0)))<1e-6')
        self.assert_js(page,'1-Math.abs(GLR.cam.quaternion.dot(finalRotation))<1e-8')

    def test_preview_timeout_does_not_clear_a_new_anomaly(self):
        page = self.game()
        self.open_panel(page)
        page.evaluate("""document.getElementById('devdeath').value='grip';Dev.previewDeath();anfxUpdate(1.2);
          S.ang=1.3;AN.active=true;AN.id='rain';AN.data={};anOn('rain');window.newFx=ANFX.grp;""")
        page.wait_for_function('!DEV.previewFx',timeout=6000)
        self.assert_js(page,"S.ang===1.3&&AN.active&&AN.id==='rain'&&ANFX.grp===newFx&&!!WX.rain")

    def test_preview_timeout_restores_camera_without_losing_player_input(self):
        page = self.game()
        self.open_panel(page)
        page.evaluate("""S.seated=false;SHAKE_ON=false;S.eyeLift=0;syncCamera(0);
          document.getElementById('devdeath').value='grip';Dev.previewDeath();anfxUpdate(1.2);
          S.ang=1.1;S.pitch=.15;S.eyeLift=.08;syncCamera(0);window.finalRotation=GLR.cam.quaternion.clone();anfxUpdate(.2);""")
        page.wait_for_function('!DEV.previewFx',timeout=6000)
        self.assert_js(page,"S.ang===1.1&&S.pitch===.15&&S.eyeLift===.08&&ANFX.kind!=='death'")
        self.assert_js(page,'1-Math.abs(GLR.cam.quaternion.dot(finalRotation))<1e-8')

    def test_preview_cleanup_does_not_remove_a_real_death(self):
        page = self.game()
        self.open_panel(page)
        page.evaluate("""S.day=2;S.diff='hard';S.talent='code';S.bag=[];S.ang=1.3;S.pitch=.2;S.eyeLift=.1;
          document.getElementById('devdeath').value='grip';Dev.previewDeath();anfxUpdate(1.2);
          kill('真实死亡','neck');window.realFx=ANFX.grp;Dev.clearPreview();""")
        self.assert_js(page,"S.dead&&S.death==='neck'&&ANFX.grp===realFx&&ANFX.kind==='death'&&!ANFX.preview")
        page.evaluate('anfxUpdate(2.5);Dev.revive()')
        self.assert_js(page,'!S.dead&&S.ang===1.3&&S.pitch===.2&&S.eyeLift===.1')

    def test_preview_is_cleared_when_teleporting_or_quitting(self):
        page = self.game()
        self.open_panel(page)
        page.evaluate("""S.eyeLift=.08;document.getElementById('devdeath').value='grip';
          Dev.previewDeath();anfxUpdate(1);document.getElementById('devout').value='0';Dev.tpo();""")
        self.assert_js(page,"S.mode==='out'&&S.eyeLift===.08&&S.ang===Math.PI/2&&!DEV.previewFx&&ANFX.kind!=='death'")
        page.evaluate("""document.getElementById('devdeath').value='neck';Dev.previewDeath();anfxUpdate(2.5);
          window.beforeQuit=[S.ang,S.pitch,S.eyeLift];Game.quit();""")
        self.assert_js(page,"S.screen==='menu'&&!DEV.previewFx&&ANFX.kind!=='death'&&[S.ang,S.pitch,S.eyeLift].every((v,i)=>v===beforeQuit[i])")

    def test_real_death_revive_restores_predeath_view(self):
        page = self.game()
        self.open_panel(page)
        for effect in ('neck','grip','shadow','follow'):
            with self.subTest(effect=effect):
                result=page.evaluate("""effect=>{
                  S.screen='play';S.dead=false;S.death=null;S.day=2;S.diff='hard';S.talent='code';S.bag=[];
                  S.ang=.7;S.pitch=-.22;S.eyeLift=.12;window.confirm=()=>true;
                  document.getElementById('devdeath').value=effect;Dev.death();
                  for(let i=0;i<6;i++)anfxUpdate(.5);
                  let changed=S.ang!==.7||S.pitch!==-.22||S.eyeLift!==.12;
                  Dev.revive();return {changed,ang:S.ang,pitch:S.pitch,eye:S.eyeLift,dead:S.dead};
                }""",effect)
                self.assertTrue(result['changed'])
                self.assertEqual((result['ang'],result['pitch'],result['eye'],result['dead']),(.7,-.22,.12,False))

    def test_teleport_ends_anomaly_and_cancels_its_pending_choice(self):
        page = self.game()
        self.open_panel(page)
        page.evaluate("Dev.triggerAnomaly('rain');AN.pre='rain';AN.preNext=33;AN.locked=true")
        self.assert_js(page,"AN.active&&AN.id==='rain'&&ANFX.kind==='rain'&&!!WX.rain")
        page.locator('[data-dev-tab="scene"]').click()
        page.locator('#devroom').select_option('admin5')
        page.locator('#devroomGo').click()
        page.wait_for_function("S.room==='admin5'")
        self.assert_js(page,"!AN.active&&AN.id===null&&!WX.rain&&ANFX.kind!=='rain'")
        self.assert_js(page,"AN.pre==='rain'&&AN.next===33&&AN.locked")
        page.evaluate("""S.tsec=700;S.viol=10;S.san=80;S.bag=[];Dev.triggerAnomaly('roster');useRoster(250);
          window.beforeSan=S.san;document.getElementById('devout').value='0';Dev.tpo();""")
        self.assert_js(page,"S.mode==='out'&&!AN.active&&AN.id===null&&!UI.chooseOpen&&!UI.choiceTimer&&S.viol===28")
        page.wait_for_timeout(350)
        self.assert_js(page,'S.san===beforeSan&&S.viol===28&&!UI.chooseOpen')

    def test_ending_or_replacing_anomaly_cancels_pending_choice(self):
        page = self.game()
        self.open_panel(page)
        for action in ('end','replace'):
            with self.subTest(action=action):
                page.evaluate("""action=>{
                  if(AN.active)Dev.anomEnd();S.tsec=700;S.san=80;S.viol=10;S.bag=[];
                  Dev.triggerAnomaly('roster');useRoster(150);
                  if(action==='end')Dev.anomEnd();else Dev.triggerAnomaly('rain');
                }""",action)
                self.assert_js(page,'!UI.chooseOpen&&!UI.choiceTimer&&S.viol===28&&S.san===80')
                if action=='end':self.assert_js(page,'!AN.active&&AN.id===null')
                else:self.assert_js(page,"AN.active&&AN.id==='rain'&&!!WX.rain")
                page.wait_for_timeout(220)
                self.assert_js(page,'S.viol===28&&S.san===80&&!UI.chooseOpen')

    def test_teleport_clears_a_finished_shoulder_visual(self):
        page = self.game()
        self.open_panel(page)
        page.evaluate("""Dev.triggerAnomaly('turn');smileShow('jump');anEnd();
          window.hadSmile=!!SMILE.grp;document.getElementById('devout').value='0';Dev.tpo();""")
        self.assert_js(page,"hadSmile&&S.mode==='out'&&!SMILE.grp&&!AN.active")

    def test_debug_freeze_holds_ambient_events_but_allows_previews(self):
        page = self.game()
        self.open_panel(page)
        page.locator('#devfreeze').click()
        page.evaluate("""S.san=10;AN.active=false;PAT.locked=false;HALLU.next=10;APPAR.next=11;
          window.h=HALLU.next;window.a=APPAR.next;render(.5);""")
        self.assert_js(page,'HALLU.next===h&&APPAR.next===a')
        page.evaluate("Dev.triggerAnomaly('rain');window.fxTime=ANFX.t;render(.5)")
        self.assert_js(page,'ANFX.t===fxTime')
        page.evaluate("Dev.anomEnd();document.getElementById('devdeath').value='grip';Dev.previewDeath();render(.5)")
        self.assert_js(page,"ANFX.kind==='death'&&ANFX.t>.4")
        page.evaluate("window.picked=0;window.frozenTime=S.tsec;UI.choice('限时选择',[{label:'确认',fn:function(){picked++}}],{timeoutMs:80})")
        page.wait_for_function('picked===1',timeout=2000)
        self.assert_js(page,'DEV.freeze&&S.tsec===frozenTime&&!UI.chooseOpen')
        page.evaluate('Dev.clearPreview();Dev.toggleFreeze();render(.5)')
        self.assert_js(page,'HALLU.next<h&&APPAR.next<a')

    def test_actual_death_confirms_and_revive_cancels_delayed_death_screen(self):
        page = self.game()
        page.evaluate("S.day=2;S.bag=[];S.talent='code';saveGame();window.saved=localStorage.getItem('wdfz3d');window.confirm=()=>false")
        self.open_panel(page)
        page.locator('[data-dev-tab="events"]').click()
        page.locator('.devdanger').click()
        self.assert_js(page,"!S.dead&&localStorage.getItem('wdfz3d')===saved")
        page.evaluate('window.confirm=()=>true')
        page.locator('.devdanger').click()
        self.assert_js(page,"S.dead&&localStorage.getItem('wdfz3d')===null")
        page.evaluate('S.san=0;S.tt=100')
        page.locator('[data-dev-tab="status"]').click()
        page.locator('#dev-page-status button').filter(has_text='复活').click()
        self.assert_js(page,'!S.dead&&S.san>0&&S.tt<100')
        page.wait_for_timeout(2900)
        self.assert_js(page,"!S.dead&&getComputedStyle(document.getElementById('die')).display==='none'")

    def test_revive_prevents_an_old_death_epitaph_overwriting_a_new_one(self):
        page = self.game()
        self.open_panel(page)
        page.evaluate("""window.savedTimeout=window.setTimeout;window.deathTimers=[];
          window.neckMs=DeathTimeline.duration('neck')*1000;
          window.setTimeout=function(fn,ms){if(ms===neckMs||ms===2000){deathTimers.push({fn,ms});return 999;}return savedTimeout(fn,ms)};
          window.confirm=()=>true;S.day=2;S.diff='hard';S.talent='code';S.bag=[];
          document.getElementById('devdeath').value='neck';Dev.death();Dev.revive();
          document.getElementById('devdeath').value='vignette';Dev.death();
          document.getElementById('dieepi').textContent='新死亡';
          deathTimers.find(x=>x.ms===neckMs).fn();window.setTimeout=savedTimeout;""")
        self.assert_js(page,"S.dead&&S.death==='vignette'&&document.getElementById('dieepi').textContent==='新死亡'")

    def test_effect_preview_does_not_leak_into_a_new_session(self):
        page = self.game()
        self.open_panel(page)
        page.evaluate('Dev.anim(2);render(.3)')
        self.assert_js(page,'GLR.postMat.uniforms.uDm.value===2')
        page.evaluate('Game.quit()')
        self.assert_js(page,'!VisualState.deathAnim&&GLR.postMat.uniforms.uDm.value===0&&GLR.postMat.uniforms.uDt.value===0')
        page.evaluate("SFX.anim(1);freshState('hard');running=false;render(0)")
        self.assert_js(page,'!VisualState.deathAnim&&GLR.postMat.uniforms.uDm.value===0')

    def test_cancelled_prologue_restart_keeps_current_save(self):
        page = self.game()
        page.evaluate("saveGame();window.saved=localStorage.getItem('wdfz3d');localStorage.setItem('wdfz_pro','1');window.confirm=()=>false")
        self.open_panel(page)
        page.locator('[data-dev-tab="tools"]').click()
        page.locator('#dev-page-tools button').filter(has_text='重看前情提要').click()
        self.assert_js(page,"DEV.on&&localStorage.getItem('wdfz3d')===saved&&localStorage.getItem('wdfz_pro')==='1'")

    def test_mouse_drag_is_bounded_and_position_can_be_reset(self):
        page = self.game()
        self.open_panel(page)
        panel=page.locator('#dev')
        initial=panel.bounding_box()
        handle=page.locator('#devdrag').bounding_box()
        page.mouse.move(handle['x']+25,handle['y']+20)
        page.mouse.down()
        page.mouse.move(980,680,steps=5)
        page.mouse.up()
        moved=panel.bounding_box()
        self.assertGreater(moved['x'],initial['x']+100)
        self.assertGreater(moved['y'],initial['y']+30)
        self.assertLessEqual(moved['x']+moved['width'],page.viewport_size['width']-7)
        self.assertLessEqual(moved['y']+moved['height'],page.viewport_size['height']-7)
        self.assert_js(page,"!DEV.drag&&!document.getElementById('dev').classList.contains('dragging')")
        page.keyboard.press('F2')
        self.open_panel(page)
        self.assertAlmostEqual(panel.bounding_box()['x'],moved['x'],delta=1)
        page.locator('.devreset').click()
        self.assertAlmostEqual(panel.bounding_box()['x'],initial['x'],delta=1)
        self.assertAlmostEqual(panel.bounding_box()['y'],initial['y'],delta=1)
        page.locator('.devclose').click()
        self.assert_js(page,'!DEV.on&&playerInputAllowed()')

    def test_keyboard_move_and_viewport_resize_keep_panel_reachable(self):
        page = self.game()
        self.open_panel(page)
        panel=page.locator('#dev')
        initial=panel.bounding_box()
        page.locator('#devdrag').focus()
        page.keyboard.press('ArrowRight')
        page.keyboard.press('Shift+ArrowDown')
        moved=panel.bounding_box()
        self.assertAlmostEqual(moved['x'],initial['x']+16,delta=1)
        self.assertAlmostEqual(moved['y'],initial['y']+48,delta=1)
        page.keyboard.press('Home')
        self.assertAlmostEqual(panel.bounding_box()['x'],initial['x'],delta=1)
        page.evaluate('Dev.placePanel(900,600,true)')
        page.set_viewport_size({'width':320,'height':568})
        page.wait_for_function("(()=>{let r=document.getElementById('dev').getBoundingClientRect();return r.right<=innerWidth-7&&r.bottom<=innerHeight-7})()")
        self.assertTrue(page.locator('.devclose').is_visible())
        page.locator('.devreset').click()
        self.assert_js(page,"(()=>{let r=document.getElementById('dev').getBoundingClientRect();return r.left>=8&&r.top>=8&&r.right<=innerWidth-7&&r.bottom<=innerHeight-7})()")

    def test_visual_viewport_constrains_keyboard_and_restores_position(self):
        page = self.game()
        self.open_panel(page)
        result=page.evaluate("""()=>{
          Dev.placePanel(420,100,true);
          const before=document.getElementById('dev').getBoundingClientRect();
          Object.defineProperty(window,'visualViewport',{configurable:true,value:{offsetLeft:40,offsetTop:25,width:330,height:250}});
          Dev.fitPanel();
          const r=document.getElementById('dev').getBoundingClientRect();
          const clipped={left:r.left,top:r.top,right:r.right,bottom:r.bottom,short:document.getElementById('dev').classList.contains('dev-short')};
          delete window.visualViewport;Dev.fitPanel();
          const restored=document.getElementById('dev').getBoundingClientRect();
          return {before:{left:before.left,top:before.top},clipped,restored:{left:restored.left,top:restored.top}};
        }""")
        self.assertGreaterEqual(result['clipped']['left'],48)
        self.assertGreaterEqual(result['clipped']['top'],33)
        self.assertLessEqual(result['clipped']['right'],362)
        self.assertLessEqual(result['clipped']['bottom'],267)
        self.assertTrue(result['clipped']['short'])
        self.assertAlmostEqual(result['restored']['left'],result['before']['left'],delta=1)
        self.assertAlmostEqual(result['restored']['top'],result['before']['top'],delta=1)

    def test_touch_drag_moves_window_without_interfering_with_scroll_or_buttons(self):
        page = self.game(touch=True)
        page.evaluate('Game.pause()')
        page.locator('#pause button').filter(has_text='调试').tap()
        panel=page.locator('#dev')
        initial=panel.bounding_box()
        handle=page.locator('#devdrag').bounding_box()
        self.swipe(page,(handle['x']+25,handle['y']+20),(handle['x']+90,handle['y']+100))
        moved=panel.bounding_box()
        self.assertGreater(moved['x'],initial['x']+10)
        self.assertGreater(moved['y'],initial['y']+50)
        self.assert_js(page,'!DEV.drag&&PAUSE.on')
        page.locator('[data-dev-tab="events"]').tap()
        body=page.locator('#devbody')
        rect=body.bounding_box()
        self.swipe(page,(rect['x']+20,rect['y']+rect['height']-15),(rect['x']+20,rect['y']+15))
        page.wait_for_timeout(250)
        self.assertGreater(body.evaluate('(el)=>el.scrollTop'),0)
        self.assertAlmostEqual(panel.bounding_box()['y'],moved['y'],delta=1)
        page.locator('.devreset').tap()
        self.assertAlmostEqual(panel.bounding_box()['x'],initial['x'],delta=1)
        self.assertAlmostEqual(panel.bounding_box()['y'],initial['y'],delta=1)
        page.locator('.devclose').tap()
        self.assert_js(page,"!DEV.on&&PAUSE.on&&UI.openPanel==='pause'")

    def test_touch_drag_cancel_and_orientation_change_release_the_pointer(self):
        page = self.game(touch=True)
        page.evaluate('Dev.open()')
        panel=page.locator('#dev')
        handle=page.locator('#devdrag').bounding_box()
        x,y=handle['x']+25,handle['y']+20
        self.touch(page,'touchStart',[{'x':x,'y':y,'id':1}])
        self.assert_js(page,'!!DEV.drag')
        self.touch(page,'touchMove',[{'x':x+20,'y':y+50,'id':1}])
        self.touch(page,'touchCancel',[])
        self.assert_js(page,"!DEV.drag&&!document.getElementById('dev').classList.contains('dragging')")
        moved=panel.bounding_box()
        self.assertGreater(moved['y'],20)
        handle=page.locator('#devdrag').bounding_box()
        self.touch(page,'touchStart',[{'x':handle['x']+25,'y':handle['y']+20,'id':2}])
        self.assert_js(page,'!!DEV.drag')
        page.set_viewport_size({'width':844,'height':390})
        page.wait_for_function("!DEV.drag&&(()=>{let r=document.getElementById('dev').getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight})()")
        self.touch(page,'touchEnd',[])
        page.locator('.devreset').tap()
        page.locator('.devclose').tap()
        self.assert_js(page,'!DEV.on&&playerInputAllowed()')

    def test_second_touch_cannot_take_over_a_drag(self):
        page = self.game(touch=True)
        page.evaluate('Dev.open()')
        panel=page.locator('#dev')
        handle=page.locator('#devdrag').bounding_box()
        x,y=handle['x']+20,handle['y']+20
        before=panel.bounding_box()
        page.evaluate("window.secondaryMoved=false;window.addEventListener('pointermove',e=>{if(e.pointerType==='touch'&&!e.isPrimary)window.secondaryMoved=true})")
        self.touch(page,'touchStart',[{'x':x,'y':y,'id':1}])
        self.touch(page,'touchStart',[{'x':x,'y':y,'id':1},{'x':x+30,'y':y+5,'id':2}])
        self.touch(page,'touchMove',[{'x':x,'y':y,'id':1},{'x':x+50,'y':y+45,'id':2}])
        page.wait_for_function('window.secondaryMoved')
        self.assertAlmostEqual(panel.bounding_box()['y'],before['y'],delta=1)
        self.touch(page,'touchMove',[{'x':x+15,'y':y+45,'id':1},{'x':x+50,'y':y+45,'id':2}])
        page.wait_for_function("y=>document.getElementById('dev').getBoundingClientRect().top>y+30",arg=before['y'])
        self.touch(page,'touchCancel',[])
        self.assert_js(page,'!DEV.drag&&DEV.on')

    def test_touch_layout_scrolls_at_narrow_and_landscape_sizes(self):
        for width,height in ((320,568),(390,844),(844,390)):
            with self.subTest(width=width,height=height):
                page = self.game(touch=True)
                page.set_viewport_size({'width':width,'height':height})
                page.evaluate('Game.pause()')
                page.locator('#pause button').filter(has_text='调试').tap()
                page.locator('#dev').wait_for(state='visible')
                self.assert_js(page,"(()=>{let r=document.getElementById('dev').getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight})()")
                self.assert_js(page,"Array.from(document.querySelectorAll('#dev .devstats strong')).every(el=>el.scrollWidth<=el.clientWidth)")
                self.assert_js(page,"parseFloat(getComputedStyle(document.getElementById('devstatvalue')).fontSize)>=16")
                panel=page.locator('#dev')
                before=panel.bounding_box()
                handle=page.locator('#devdrag').bounding_box()
                self.swipe(page,(handle['x']+20,handle['y']+20),(handle['x']+50,handle['y']+60))
                self.assertGreater(panel.bounding_box()['y'],before['y']+20)
                self.assert_js(page,"(()=>{let r=document.getElementById('dev').getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight})()")
                page.locator('[data-dev-tab="events"]').tap()
                body=page.locator('#devbody')
                self.assertTrue(page.locator('#devscroll').is_visible())
                rect=body.bounding_box()
                self.swipe(page,(rect['x']+20,rect['y']+rect['height']-15),(rect['x']+20,rect['y']+15))
                page.wait_for_timeout(250)
                self.assertGreater(body.evaluate('(e)=>e.scrollTop'),0)
                page.locator('.devclose').tap()
                self.assert_js(page,"!DEV.on&&PAUSE.on&&UI.openPanel==='pause'")
                page.evaluate('Game.resume()')
                self.assert_js(page,'playerInputAllowed()')
