"""可玩性计划：实际浏览器的交互、状态边界和存档回归；不冒充真人盲玩。"""
from browser_case import BrowserCase


class PlayabilityTest(BrowserCase):
    def game(self, touch=False):
        page = self.page(touch=touch)
        page.evaluate("""Game.start('hard');clearIntroTimers();running=false;
          AN.active=false;AN.next=1000;PAT.next=1000;S.intro=0;S.talent='code';""")
        page.wait_for_function("S.room==='teach1'&&GLR.roomMesh&&GLR.roomMesh.userData.roomData===INTERIORS.teach1")
        page.evaluate('running=false;clearIntroTimers();updateHUD()')
        return page

    def test_opening_clue_keyboard_touch_full_bag_and_restore(self):
        for touch in (False, True):
            with self.subTest(touch=touch):
                page = self.game(touch)
                page.evaluate("S.bag=Object.keys(ITEMS).slice(0,8);updateHUD()")
                if touch:
                    page.locator('#investigateOpen').tap()
                else:
                    page.keyboard.press('r')
                self.assert_js(page, "Investigation.visible('desk')&&S.bag.length===8&&!LESSON.on")
                page.evaluate("""const R=INTERIORS.teach1;S.seated=false;
                  for(let r=0;r<R.rows;r++)for(let c=0;c<R.cols;c++)if(R.grid[r][c]==='T'){
                    S.x=R.ox+(c+.5)*R.tw;S.y=R.oy+(r+1.5)*R.th;S.ang=-Math.PI/2;}
                  tryInteract();""")
                self.assert_js(page,"UI.chooseOpen&&Investigation.visible('notice')")
                page.locator('#choices button').first.click()
                page.evaluate("let saved=loadGame();freshState('hard');running=false;applySave(saved);UI.open('note')")
                self.assertIn('行政楼五楼', page.locator('#notein').inner_text())
                self.assertNotIn('portalDiary', page.locator('#notein').inner_text())

    def test_concrete_lesson_memory_forgets_without_tools_but_progress_survives(self):
        page = self.game()
        page.evaluate("""RT.lessons={};LESSON.open();let r=LESSON.record();r.task=2;
          LESSON.answer(1);UI.renderNote();""")
        self.assertIn('车库里别关手电',page.locator('#notein').inner_text())
        page.evaluate("S.bag=[];S.day++;RT.portalSketch=1;UI.renderNote()")
        self.assertNotIn('车库里别关手电',page.locator('#notein').inner_text())
        self.assertIn('图纸齐全',page.locator('#notein').inner_text())
        page.evaluate("S.bag=['notebook','pen'];UI.renderNote()")
        self.assertIn('车库里别关手电',page.locator('#notein').inner_text())
        page.evaluate("let n=Object.keys(Investigation.state().entries).length;Investigation.migrate();Investigation.migrate();window.same=n===Object.keys(Investigation.state().entries).length")
        self.assert_js(page,'same')

    def test_car_key_record_vehicle_result_and_save_share_one_answer(self):
        page=self.game()
        page.evaluate("S.bag=['key'];window.plate=Investigation.carKey();window.cell=carRightCell();Investigation.parking();saveGame();let saved=loadGame();freshState('hard');running=false;applySave(saved)")
        self.assert_js(page,"carRightCell()===cell&&Investigation.carKey()===plate&&Investigation.state().entries.parking.text.includes(String(Number(cell.split(':')[1])+1))")
        page.evaluate("UI.renderNote()")
        self.assertIn(page.evaluate('plate'), page.locator('#notein').inner_text())

    def test_old_save_does_not_invent_lesson_success(self):
        page=self.game()
        page.evaluate("RT.lessons={'1:700':{task:2,done:true}};saveGame();let saved=loadGame();delete saved.rt.investigation;freshState('hard');running=false;applySave(saved)")
        self.assert_js(page,"Object.keys(Investigation.state().entries).length===0")

    def test_supply_choice_is_saved_optional_and_does_not_consume_when_full(self):
        page=self.game()
        page.evaluate("""Investigation.state().supply={site:'guard1',taken:false};doEnterRoom('guard1');
          S.bag=Object.keys(ITEMS).filter(k=>k!=='pill').slice(0,8);window.before=S.tsec;
          Investigation.supplyOffer(function(){});""")
        page.locator('#choices button').first.click()
        self.assert_js(page,"!Investigation.supply().taken&&S.tsec===before")
        page.evaluate("S.bag=['coin'];Investigation.supplyOffer(function(){})")
        page.locator('#choices button').nth(1).click()
        self.assert_js(page,"hasItem('pill')&&!hasItem('coin')&&S.tsec===before&&loadGame().rt.investigation.supply.taken")
        page.evaluate("window.follow=0;Investigation.supplyOffer(function(){follow++})")
        self.assert_js(page,"follow===1&&!UI.chooseOpen")

    def test_floor_map_uses_seen_geometry_pending_loot_and_resets(self):
        page=self.game()
        page.evaluate("ExplorationMap.observe();window.seen=Object.keys(RT.exploration.teach1);UI.open('mapv')")
        self.assert_js(page,"seen.length>0&&seen.length<INTERIORS.teach1.cols*INTERIORS.teach1.rows/2")
        self.assert_js(page,"document.querySelector('#mapfloor').options.length===2")
        page.evaluate("""const R=INTERIORS.teach1;window.desk=null;
          for(let r=0;r<R.rows&&!desk;r++)for(let c=0;c<R.cols&&!desk;c++)if(R.grid[r][c]==='d')desk=[c,r];
          var key=R.id+':'+desk.join(':');RT.pendingLoot[key]='coin';""")
        self.assert_js(page,"ExplorationMap.label(INTERIORS.teach1,...desk)==='留'")
        page.evaluate("delete RT.pendingLoot[key];RT.deskUsed[key]=1;saveGame();let d=loadGame();freshState('hard');running=false;applySave(d)")
        self.assert_js(page,"ExplorationMap.label(INTERIORS.teach1,...desk)==='✓'&&Object.keys(RT.exploration.teach1).length>=seen.length")
        page.evaluate("freshState('hard');running=false")
        self.assert_js(page,"Object.keys(ExplorationMap.state()).length===0")

    def test_same_death_effect_has_source_specific_memory(self):
        page=self.game()
        page.evaluate("localStorage.removeItem(DEATH_LOG_KEY);deathLogAdd('grip','car_entry');deathLogAdd('grip','car_entry');deathLogAdd('grip','patrol')")
        self.assertEqual(len(page.evaluate('deathHints()')),1)
        self.assertIn('拉车门',page.evaluate('deathHints()[0]'))
        self.assertNotIn('柜子',page.evaluate('deathHints()[0]'))
        page.evaluate("deathLogAdd('grip','patrol')")
        self.assertIn('柜子',page.evaluate('deathHints()[0]'))

    def test_settings_clamp_persist_and_reset(self):
        page=self.page()
        page.evaluate("Settings.comfort('mouseSense',200);Settings.comfort('touchSense',50);Settings.comfort('textSize',999);Settings.comfort('touchSize',NaN);saveSet();SET.mouseSense=100;loadSet()")
        self.assert_js(page,"SET.mouseSense===200&&SET.touchSense===50&&SET.textSize===150&&SET.touchSize===100")
        page.evaluate("Settings.resetComfort()")
        self.assert_js(page,"Object.keys(COMFORT_LIMITS).every(k=>SET[k]===100)&&SET.touchLayout===null")

    def test_touch_sensitivity_does_not_change_mouse_fallback(self):
        page=self.page(touch=True)
        page.evaluate("Settings.comfort('touchSense',50);Settings.comfort('mouseSense',200)")
        self.swipe(page,start=(205,290),end=(245,310))
        self.assertAlmostEqual(page.evaluate('S.ang'),40*.0042*.5,places=5)
        page.evaluate('S.ang=0;S.pitch=0')
        page.mouse.move(250,350);page.mouse.down();page.mouse.move(290,370);page.mouse.up()
        self.assertAlmostEqual(page.evaluate('S.ang'),40*.0042*2,places=5)

    def test_touch_layout_resizes_and_keeps_controls_in_view(self):
        page=self.page(touch=True)
        for w,h in [(390,844),(844,390),(320,568)]:
            page.set_viewport_size({'width':w,'height':h})
            page.evaluate("SET.touchLayout={stick:{x:50,y:90},tAct:{x:50,y:90},ttop:{x:50,y:90}};Settings.comfort('touchSize',125);TouchLayout.apply()")
            self.assert_js(page,"""Object.values(TouchLayout.rects).every(r=>r.x>=0&&r.y>=0&&r.x+r.w<=innerWidth&&r.y+r.h<=innerHeight&&r.w>=44&&r.h>=44)""")
            self.assert_js(page,"""(()=>{let rs=Object.values(TouchLayout.rects);return rs.every((r,i)=>rs.every((q,j)=>i===j||r.x+r.w<=q.x||q.x+q.w<=r.x||r.y+r.h<=q.y||q.y+q.h<=r.y));})()""")

    def test_portal_local_challenge_wrong_retry_order_and_restored_step(self):
        page=self.game()
        page.evaluate("RT.portalDiary=true;doEnterRoom('lab2');useFacility('K',INTERIORS.lab2)")
        page.locator('#choices button').nth(0).click()
        self.assert_js(page,"PortalExploration.count()===0&&!RT.portalSketch")
        page.evaluate("useFacility('K',INTERIORS.lab2)")
        page.locator('#choices button').nth(1).click()
        self.assert_js(page,"PortalExploration.count()===1")
        page.evaluate("doEnterRoom('lab5');useFacility('K',INTERIORS.lab5)")
        page.locator('#choices button').nth(1).click()
        page.evaluate("UI.closeChoice();let d=loadGame();freshState('hard');running=false;applySave(d);useFacility('K',INTERIORS.lab5)")
        self.assertIn('1/3',page.locator('#choices').inner_text())
        page.locator('#choices button').nth(2).click()
        page.locator('#choices button').nth(0).click()
        page.evaluate("doEnterRoom('lab4');useFacility('K',INTERIORS.lab4)")
        page.locator('#choices button').nth(2).click()
        self.assert_js(page,"RT.portalSketch&&PortalExploration.count()===3")

    def test_local_playtest_record_is_bounded_and_separate_from_save(self):
        page=self.game()
        page.evaluate("Playtest.toggle();window.before=S.tsec;Playtest.event('观察者记录','没有求助');")
        page.wait_for_timeout(50)
        page.evaluate("""Playtest.sample();for(let i=0;i<510;i++)Playtest.event('记录',String(i));
          saveGame();Playtest.toggle();window.report=Playtest.data;""")
        self.assert_js(page,"!report.recording&&report.events.length===500&&report.discardedEvents===12")
        self.assert_js(page,"S.tsec===before&&!loadGame().playtest&&report.seconds.play>0")

    def test_note_search_escapes_content_and_remembers_only_current_run(self):
        page=self.game()
        page.evaluate("Investigation.record('example','<img src=x onerror=alert(1)>','事实','图书角');UI.open('note')")
        page.locator('#notequery').fill('不存在的词')
        self.assertIn('没有找到',page.locator('#notein').inner_text())
        page.locator('#notequery').fill('图书角')
        self.assertEqual(page.locator('#notein img').count(),0)
        self.assertIn('<img',page.locator('#notein').inner_text())
        page.evaluate("freshState('hard');running=false;UI.open('note')")
        self.assertNotIn('图书角',page.locator('#notein').inner_text())

    def test_custom_touch_layout_does_not_cover_fullscreen(self):
        page=self.page(touch=True)
        for width,height in [(390,844),(844,390)]:
            page.set_viewport_size({'width':width,'height':height})
            page.evaluate("SET.touchLayout={ttop:{x:90,y:8}};TouchLayout.apply()")
            self.assert_js(page,"""(()=>{let b=document.getElementById('fullscreen-toggle').getBoundingClientRect();return Object.values(TouchLayout.rects).every(r=>r.x+r.w<=b.x||b.right<=r.x||r.y+r.h<=b.y||b.bottom<=r.y);})()""")

    def test_notebook_focus_follows_discovered_routes_without_restoring_forgotten_text(self):
        page=self.game()
        page.evaluate("Investigation.notice();UI.closeChoice();doEnterRoom('portal_tunnel');PortalExploration.readDiary();UI.open('note')")
        self.assertIn('实验楼二、四、五楼',page.evaluate('Investigation.goal()'))
        page.evaluate("S.bag=[];S.day++;UI.renderNote()")
        self.assertNotIn('实验楼二、四、五楼',page.evaluate('Investigation.goal()'))
        self.assertIn('重读',page.evaluate('Investigation.goal()'))
        page.evaluate("RT.hacked=true;RT.data=true;Investigation.record('whitelistSynced','已同步','验证');UI.renderNote()")
        self.assertIn('西小门',page.evaluate('Investigation.goal()'))
        page.locator('.investigation-focus button').filter(has_text='关注车辆').click()
        self.assert_js(page,"loadGame().rt.investigation.focus==='car'&&RT.data&&!RT.portalSketch")

    def test_mobile_floor_map_can_scroll_sideways(self):
        page=self.game(touch=True)
        page.evaluate("UI.open('mapv')")
        box=page.locator('.floor-scroll').bounding_box()
        y=box['y']+min(60,box['height']/2)
        self.swipe(page,start=(box['x']+box['width']-25,y),end=(box['x']+25,y))
        page.wait_for_timeout(150)
        self.assert_js(page,"document.querySelector('.floor-scroll').scrollLeft>20")
        self.assert_js(page,"!LOOKDRAG.on&&!TOUCH.active")

