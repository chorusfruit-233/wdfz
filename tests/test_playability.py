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
                self.assertNotIn('一条都没有', page.locator('#notein').inner_text())
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
        page.evaluate("S.bag=['key'];useItem('key');window.cell=carRightCell();window.plate=Investigation.state().entries.carKey.text")
        self.assert_js(page,"loadGame().rt.carRight===cell&&loadGame().rt.investigation.entries.carKey.text===plate")
        page.evaluate("Investigation.parking();let saved=loadGame();freshState('hard');running=false;applySave(saved)")
        self.assert_js(page,"carRightCell()===cell&&Investigation.state().entries.carKey.text===plate&&Investigation.state().entries.parking.text.includes(String(Number(cell.split(':')[1])+1))")
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
        page.evaluate("ExplorationMap.observe();window.seen=ExplorationMap.count('teach1');UI.open('mapv')")
        self.assert_js(page,"seen>0&&seen<INTERIORS.teach1.cols*INTERIORS.teach1.rows/2&&typeof RT.exploration.teach1==='string'")
        self.assert_js(page,"document.querySelector('#mapfloor').options.length===2")
        page.evaluate("""const R=INTERIORS.teach1;window.desk=null;
          for(let r=0;r<R.rows&&!desk;r++)for(let c=0;c<R.cols&&!desk;c++)if(R.grid[r][c]==='d')desk=[c,r];
          var key=R.id+':'+desk.join(':');RT.pendingLoot[key]='coin';""")
        self.assert_js(page,"ExplorationMap.label(INTERIORS.teach1,...desk)==='留'")
        page.evaluate("delete RT.pendingLoot[key];RT.deskUsed[key]=1;saveGame();let d=loadGame();freshState('hard');running=false;applySave(d)")
        self.assert_js(page,"ExplorationMap.label(INTERIORS.teach1,...desk)==='✓'&&ExplorationMap.count('teach1')>=seen")
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
            page.evaluate("TouchLayout.reset();window.nativeWidth=document.getElementById('stick').getBoundingClientRect().width")
            page.evaluate("SET.touchLayout={stick:{x:50,y:90},tAct:{x:50,y:90},ttop:{x:50,y:90}};Settings.comfort('touchSize',125);TouchLayout.apply()")
            self.assert_js(page,"TouchLayout.rects.stick.w>=nativeWidth")
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

    def test_custom_touch_controls_avoid_quick_slots_after_resize_and_restore(self):
        page=self.page(touch=True)
        for width,height in [(390,844),(844,390),(320,568)]:
            page.set_viewport_size({'width':width,'height':height})
            for size in (85,100,125):
                for control in ('stick','tAct','ttop'):
                    with self.subTest(viewport=(width,height),size=size,control=control):
                        page.evaluate("""([id,size])=>{
                          const hot=document.getElementById('hot').getBoundingClientRect();
                          SET.touchLayout={[id]:{x:(hot.x+hot.width/2)/innerWidth*100,y:(hot.y+hot.height/2)/innerHeight*100}};
                          Settings.comfort('touchSize',size);
                          SET.touchLayout=null;SET.touchSize=100;loadSet();
                        }""",[control,size])
                        self.assert_js(page,"""(()=>{
                          const hot=document.getElementById('hot').getBoundingClientRect();
                          return hot.width>0&&hot.height>0&&Object.values(TouchLayout.rects).every(r=>
                            r.x+r.w<=hot.x||hot.right<=r.x||r.y+r.h<=hot.y||hot.bottom<=r.y);
                        })()""")
                        self.assert_js(page,"""Object.values(TouchLayout.rects).every(r=>
                          r.x>=0&&r.y>=0&&r.x+r.w<=innerWidth&&r.y+r.h<=innerHeight)""")

    def test_custom_joystick_touch_does_not_consume_quick_items(self):
        page=self.page(touch=True)
        page.evaluate("""S.bag=['pill','snack'];S.hot=['pill','snack'];updateHUD();
          TouchLayout.pick('stick');TouchLayout.change('x',50);TouchLayout.change('y',73);
          SET.touchLayout=null;loadSet();""")
        stick=page.locator('#stick').bounding_box()
        x,y=stick['x']+stick['width']/2,stick['y']+stick['height']/2
        self.touch(page,'touchStart',[{'x':x,'y':y,'id':1}])
        self.touch(page,'touchMove',[{'x':x,'y':y-25,'id':1}])
        self.assert_js(page,"TOUCH.active&&TOUCH.dy<0&&INPUT.stickId!==null")
        self.touch(page,'touchEnd',[])
        self.assert_js(page,"S.bag.includes('pill')&&S.bag.includes('snack')&&!TOUCH.active")
        page.locator('#hot .hslot').nth(0).tap()
        self.assert_js(page,"!S.bag.includes('pill')&&S.bag.includes('snack')&&S.pillT>0")
        page.locator('#hot .hslot').nth(1).tap()
        self.assert_js(page,"!S.bag.includes('snack')&&S.snackT>0")

    def test_notebook_focus_follows_discovered_routes_without_restoring_forgotten_text(self):
        page=self.game()
        page.evaluate("Investigation.notice();UI.closeChoice();doEnterRoom('portal_tunnel');PortalExploration.readDiary();UI.open('note')")
        self.assertIn('实验楼二、四、五楼',page.evaluate('Investigation.goal()'))
        page.evaluate("S.bag=[];S.day++;UI.renderNote()")
        self.assertNotIn('实验楼二、四、五楼',page.evaluate('Investigation.goal()'))
        self.assertIn('重读',page.evaluate('Investigation.goal()'))
        page.evaluate("RT.hacked=true;RT.data=true;Investigation.record('whitelistSynced','已同步','验证');UI.renderNote()")
        self.assertIn('西小门',page.evaluate('Investigation.goal()'))
        page.locator('.investigation-focus button').filter(has_text='车辆').click()
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

    def test_scene_signs_are_lit_unique_and_released_with_the_room(self):
        page=self.game()
        info=page.evaluate("""(()=>{const g=buildRoomGeometry(INTERIORS.garage1);let plates=[],rows=0,basic=0,maps=new Set();
          g.traverse(o=>{const t=o.userData&&o.userData.wayfinding;if(!t)return;const ms=Array.isArray(o.material)?o.material:[o.material];
            if(ms.some(m=>m.isMeshBasicMaterial))basic++;if(/^鄂A·/.test(t))plates.push(t);if(/排$/.test(t))rows++;ms.forEach(m=>{if(m.map)maps.add(m.map);});});
          let disposed=0;maps.forEach(t=>t.addEventListener('dispose',()=>disposed++));ThreeBackend.disposeGroup(g);
          const cell=carRightCell().split(':').map(Number);
          return {plates,rows,basic,maps:maps.size,disposed,right:Investigation.carName(cell[0],cell[1])};})()""")
        self.assertEqual(info['basic'],0)
        self.assertEqual(len(info['plates']),16)
        self.assertEqual(len(set(info['plates'])),16)
        self.assertIn(info['right'],info['plates'])
        self.assertEqual(info['rows'],4)
        self.assertEqual(info['disposed'],info['maps'])
        signs=page.evaluate("""(()=>{const out={};['teach1','lab2','admin2','lift_teach'].forEach(id=>{const g=buildRoomGeometry(INTERIORS[id]);out[id]=[];
          g.traverse(o=>{if(o.userData&&o.userData.wayfinding)out[id].push(o.userData.wayfinding);});ThreeBackend.disposeGroup(g);});return out;})()""")
        self.assertEqual(sorted(signs['teach1']),sorted(['1F 楼梯','1F 楼梯','1F 电梯','移交单']))
        self.assertIn('连廊',signs['lab2'])
        self.assertIn('2F 楼梯',signs['admin2'])
        self.assertEqual(signs['lift_teach'],[])

    def test_only_own_classroom_podium_holds_the_handover_slip(self):
        page=self.game()
        page.evaluate("""const R=INTERIORS.teach1;window.ts=[];for(let r=0;r<R.rows;r++)for(let c=0;c<R.cols;c++)if(R.grid[r][c]==='T')ts.push([c,r]);""")
        self.assert_js(page,"ts.length===6&&ts.filter(t=>Investigation.isPodium(INTERIORS.teach1,t[0],t[1])).length===1&&Investigation.podium()[0]===48")
        page.evaluate("""const R=INTERIORS.teach1,t=ts[0];S.seated=false;S.bag=[];S.x=R.ox+(t[0]+.5)*R.tw;S.y=R.oy+(t[1]+1.5)*R.th;S.ang=-Math.PI/2;S.pitch=0;
          window.hint=interactHint();tryInteract();""")
        self.assert_js(page,"hint==='拿粉笔'&&hasItem('chalk')&&!Investigation.state().entries.notice&&!UI.chooseOpen")
        page.evaluate("""const R=INTERIORS.teach1,t=Investigation.podium();S.x=R.ox+(t[0]+.5)*R.tw;S.y=R.oy+(t[1]+1.5)*R.th;window.hint=interactHint();tryInteract();""")
        self.assert_js(page,"hint==='看移交单'&&UI.chooseOpen&&Investigation.visible('notice')")

    def test_floor_map_save_is_compact_and_reads_the_earlier_format(self):
        page=self.game()
        page.evaluate("""for(const id in INTERIORS){const b=ExplorationMap.seen(id);b.fill(1);RT.exploration[id]=ExplorationMap.pack(b);}
          window.size=JSON.stringify(RT.exploration).length;""")
        self.assert_js(page,"size<8000")
        page.evaluate("RT.exploration={teach1:{'3:2':1,'4:2':1,'bad':1,'999:1':1}};ExplorationMap.rt=null;")
        self.assert_js(page,"ExplorationMap.count('teach1')===2&&typeof RT.exploration.teach1==='string'")
        page.evaluate("saveGame();let d=loadGame();freshState('hard');running=false;applySave(d)")
        self.assert_js(page,"ExplorationMap.has(INTERIORS.teach1,3,2)&&ExplorationMap.has(INTERIORS.teach1,4,2)&&!ExplorationMap.has(INTERIORS.teach1,5,2)")

    def test_redone_panels_show_state_without_losing_notes(self):
        page=self.game()
        page.evaluate("Playtest.data=null;Playtest.paint();document.getElementById('playtestNote').value='卡住了';Playtest.note()")
        self.assert_js(page,"!Playtest.data&&document.getElementById('playtestNote').value==='卡住了'&&document.getElementById('playtestState').textContent==='未记录'")
        page.evaluate("Playtest.toggle();Playtest.note()")
        self.assert_js(page,"Playtest.data.events.some(e=>e.detail==='卡住了')&&document.getElementById('playtestState').textContent.startsWith('记录中')")
        page.evaluate("Playtest.toggle();Game.pause();UI.open('set');document.getElementById('layoutSettings').open=true;TouchLayout.pick('tAct')")
        self.assert_js(page,"document.getElementById('layoutTarget').value==='tAct'&&document.querySelector('#layoutSeg button.on').dataset.control==='tAct'&&document.querySelector('#layoutPreview i.on').dataset.control==='tAct'")
        page.evaluate("UI.close('set',false);Game.resume();Investigation.notice();UI.closeChoice();S.spots.comp=1;UI.open('note')")
        self.assert_js(page,"document.querySelector('.investigation-focus button.on').textContent==='车辆'&&document.querySelectorAll('#notein .inv-card').length>=3")

