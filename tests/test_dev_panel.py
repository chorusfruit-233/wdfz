"""调试面板的真实浏览器操作、场景切换和存档边界。"""
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
        page.evaluate('window.startTime=S.tsec;window.startVisual=VisualState.time;update(1)')
        self.assert_js(page,'DEV.freeze&&S.tsec===startTime&&VisualState.time===startVisual&&!playerInputAllowed()')
        self.assertIn('调试暂停',page.locator('#devrun').inner_text())
        page.locator('#devfreeze').click()
        page.evaluate('update(1)')
        self.assert_js(page,'!DEV.freeze&&S.tsec>startTime')
        page.keyboard.press('Escape')
        self.assert_js(page,'!DEV.on&&playerInputAllowed()')

    def test_pause_menu_and_focused_input_close_without_losing_pause(self):
        page = self.game()
        page.evaluate('Game.pause()')
        page.locator('#pause button').filter(has_text='调试').click()
        self.assertTrue(page.locator('#devfreeze').is_disabled())
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
        self.assert_js(page,"document.body.classList.contains('dev-open')&&document.getElementById('dev').getAttribute('aria-modal')==='true'")
        page.locator('.devclose').focus()
        page.keyboard.press('Shift+Tab')
        self.assertEqual(page.evaluate('document.activeElement.textContent'),'复活角色')
        page.keyboard.press('Tab')
        self.assertTrue(page.locator('.devclose').evaluate('(el)=>document.activeElement===el'))
        self.assert_js(page,"document.elementFromPoint(innerWidth-5,innerHeight-5).id==='devbackdrop'")
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
          Dev.previewDeath();anfxUpdate(1.2);window.previewY=GLR.cam.position.y;
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

    def test_debug_freeze_holds_ambient_events_but_allows_previews(self):
        page = self.game()
        self.open_panel(page)
        page.evaluate("""S.san=10;AN.active=false;PAT.locked=false;HALLU.next=10;APPAR.next=11;
          window.h=HALLU.next;window.a=APPAR.next;render(.5);""")
        self.assert_js(page,'HALLU.next===h&&APPAR.next===a')
        page.evaluate("Dev.triggerAnomaly('rain');window.fxTime=ANFX.t;render(.5)")
        self.assert_js(page,'ANFX.t===fxTime')
        page.evaluate("Dev.anomEnd();document.getElementById('devdeath').value='grip';Dev.previewDeath();render(.5)")
        self.assert_js(page,"ANFX.kind==='death'&&ANFX.t>.4")
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
          window.setTimeout=function(fn,ms){if(ms===3000||ms===2000){deathTimers.push({fn,ms});return 999;}return savedTimeout(fn,ms)};
          window.confirm=()=>true;S.day=2;S.diff='hard';S.talent='code';S.bag=[];
          document.getElementById('devdeath').value='neck';Dev.death();Dev.revive();
          document.getElementById('devdeath').value='vignette';Dev.death();
          document.getElementById('dieepi').textContent='新死亡';
          deathTimers.find(x=>x.ms===3000).fn();window.setTimeout=savedTimeout;""")
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

    def test_touch_layout_scrolls_at_narrow_and_landscape_sizes(self):
        for width,height in ((320,568),(390,844),(844,390)):
            with self.subTest(width=width,height=height):
                page = self.game(touch=True)
                page.set_viewport_size({'width':width,'height':height})
                page.evaluate('Game.pause()')
                page.locator('#pause button').filter(has_text='调试').tap()
                page.locator('#dev').wait_for(state='visible')
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
