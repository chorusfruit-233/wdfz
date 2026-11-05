"""Broadcast commands, persistence, real-time reading, perception and public records."""
from browser_case import BrowserCase


class BroadcastTest(BrowserCase):
    def game(self, touch=False):
        p = self.page(touch=touch)
        p.evaluate("""freshState('hard');running=false;clearIntroTimers();S.intro=0;PRO.on=false;
          S.screen='play';S.day=2;S.tsec=1100;S.san=100;AN.active=false;AN.next=1e6;
          RT.inspection=null;DEV.god=false;DEV.fast=false;SEARCH.on=true;
          window.atRadio=(room,c,r)=>{doEnterRoom(room);const q=PatrolNav.tilePoint(room,c,r);S.x=q.x;S.y=q.y;S.seated=false;S.ang=0;};
          window.prepareRadio=()=>{atRadio('admin2',5,4.4);Broadcast.book();
            ['notice1','notice2','notice3','notice4','broadcastfuse'].forEach(addItem);Broadcast.install();};
          true;""")
        return p

    def test_rules_reject_invalid_save_and_use_the_eighth_class_window(self):
        p = self.game()
        self.assert_js(p, "!BroadcastRules.window(1,1100)&&!BroadcastRules.window(2,1039)&&BroadcastRules.window(2,1040)&&!BroadcastRules.window(2,1340)")
        r = p.evaluate("BroadcastRules.normalize({completed:99,phase:'bell',bell:Infinity,selected:'other',fakeSite:9,pianoFails:8,current:{id:1,room:'garbage'}})")
        self.assertEqual((r['completed'],r['phase'],r['selected'],r['fakeSite'],r['pianoFails'],r['current']), (3,'collect','notice1',None,3,None))

    def test_sources_are_physical_and_inventory_failure_preserves_items(self):
        p = self.game()
        p.evaluate("atRadio('admin5',6,3.2);tryInteract()")
        self.assert_js(p, "hasItem('archivekey')")
        p.evaluate("atRadio('admin1',46,3.2);Broadcast.takePage(0);searchTick(1.5)")
        self.assert_js(p, "Broadcast.state().archiveOpen&&!hasItem('archivekey')&&UI.anyOpen()")
        p.locator('#choices button').first.click()
        self.assert_js(p, "hasItem('notice1')")
        p.evaluate("atRadio('gear1',3,2.5);tryInteract()")
        self.assert_js(p, "hasItem('broadcastfuse')&&hasItem('snack')&&Broadcast.state().boxSnack")

    def test_guard_register_requires_night_and_gives_key_then_paper(self):
        p = self.game()
        p.evaluate("atRadio('guard1',3.1,4);Broadcast.takePage(2)")
        self.assert_js(p, "!SEARCH.job&&!hasItem('notice3')")
        p.evaluate("S.tsec=1350;tryInteract()")
        self.assert_js(p,"hasItem('broadcastkey')")
        p.evaluate("tryInteract();searchTick(1.5)")
        self.assert_js(p,"UI.anyOpen()")
        p.locator('#choices button').first.click()
        self.assert_js(p,"hasItem('notice3')")

    def test_piano_is_muted_accessible_and_errors_are_timed_and_nonlethal(self):
        p = self.game()
        p.evaluate("atRadio('lab5',5,2.2);Broadcast.piano()")
        self.assertIn('1 · 3 · 2 · 5',p.locator('#choices').inner_text())
        p.evaluate("UI.closeChoice();[1,3,2,5].forEach(n=>Broadcast.piano(n))")
        self.assertIn('蓝黑墨水',p.locator('#choices').inner_text())
        p.locator('#choices button').first.click()
        self.assert_js(p,"hasItem('notice2')")
        r = p.evaluate("""()=>{UI.closeChoice();const san=S.san,viol=S.viol;[2,2,2].forEach(n=>Broadcast.piano(n));UI.closeChoice();
          return {same:S.san===san&&S.viol===viol,fails:Broadcast.state().pianoFails,wait:Broadcast.state().pianoUntil-gameClock()};}""")
        self.assertTrue(r['same']);self.assertEqual(r['fails'],3);self.assertEqual(r['wait'],10)

    def test_roof_coin_and_back_to_stairs_are_both_required(self):
        p = self.game()
        p.evaluate("atRadio('teach6',20,3.2);Broadcast.takePage(3)")
        self.assert_js(p,"!SEARCH.job")
        p.evaluate("addItem('coin');const R=INTERIORS.teach6;S.ang=Math.atan2(R.oy+16.5*R.th-S.y,R.ox+12.5*R.tw-S.x);Broadcast.takePage(3)")
        self.assert_js(p,"!SEARCH.job")
        p.evaluate("S.ang+=Math.PI;Broadcast.takePage(3);searchTick(2.1)")
        self.assert_js(p,"UI.anyOpen()&&hasItem('coin')")
        p.locator('#choices button').first.click()
        self.assert_js(p,"hasItem('notice4')")

    def test_reading_is_nonmodal_and_release_restarts_only_current_segment(self):
        p = self.game()
        p.evaluate("prepareRadio();BroadcastUI.open()")
        self.assert_js(p,"!UI.anyOpen()&&GamePolicy.simulationAllowed(gameInputContext())&&!GamePolicy.playerAllowed(gameInputContext())")
        p.locator('#radio-read').dispatch_event('pointerdown',{'pointerId':1,'pointerType':'mouse','button':0})
        p.evaluate("Broadcast.tick(20.1);Broadcast.tick(5)")
        self.assert_js(p,"Broadcast.state().completed===1&&Broadcast.reading().progress===5")
        p.locator('#radio-read').dispatch_event('pointerup',{'pointerId':1,'pointerType':'mouse','button':0})
        self.assert_js(p,"Broadcast.state().completed===1&&Broadcast.reading().progress===0&&!Broadcast.reading().held")
        p.evaluate("saveGame();applySave(loadGame())")
        self.assert_js(p,"Broadcast.state().completed===1&&!Broadcast.reading().held&&Broadcast.ready()")

    def test_blackout_inspection_movement_and_blur_interrupt_without_losing_completed_pages(self):
        p = self.game()
        p.evaluate("prepareRadio();Broadcast.hold(true);Broadcast.tick(20.1);AN.active=true;AN.id='blackout';Broadcast.tick(1)")
        self.assert_js(p,"Broadcast.state().completed===1&&!Broadcast.reading().held")
        p.evaluate("AN.active=false;Broadcast.hold(true);S.x+=4;Broadcast.tick(.1)")
        self.assert_js(p,"!Broadcast.reading().held&&Broadcast.state().completed===1")
        p.evaluate("BroadcastUI.open();Broadcast.hold(true);window.dispatchEvent(new Event('blur'))")
        self.assert_js(p,"!Broadcast.reading().held")

    def test_world_clock_and_patroller_continue_while_holding_microphone(self):
        p = self.game()
        r = p.evaluate("""()=>{prepareRadio();BroadcastUI.open();Broadcast.hold(true);patReset();PatrolWorld.reset();
          PAT.state='idle';PAT.respawn=100;const clock=S.tsec,pat=PAT.respawn;
          for(let i=0;i<10;i++)update(.1);
          return {clock:S.tsec>clock,patrol:PAT.respawn<pat,reading:Broadcast.reading().held,progress:Broadcast.reading().progress};}""")
        self.assertTrue(r['clock'] and r['patrol'] and r['reading'])
        self.assertGreater(r['progress'],.9)
        p.evaluate("const old=Inspection.pending;Inspection.pending=()=>true;Broadcast.hold(true);Broadcast.tick(.1);Inspection.pending=old;true")
        self.assert_js(p,"!Broadcast.reading().held")

    def test_real_and_false_broadcasts_can_be_verified_and_false_one_allows_escape(self):
        p = self.game()
        p.evaluate("atRadio('teach1',20,19);Broadcast.announce(true,0)")
        self.assert_js(p,"Broadcast.state().calls.length===1&&!Broadcast.verify()")
        p.evaluate("Broadcast.announce(false,1);Broadcast.verify()")
        self.assert_js(p,"Broadcast.state().calls.length===1&&Achievements.state().got['n.broadcast']&&Broadcast.state().verified.length===1")
        p.evaluate("atRadio('lab2',15,17);Broadcast.tick(7)")
        self.assert_js(p,"S.san===100&&!S.dead&&Broadcast.state().current.arrived")
        p.evaluate("doEnterRoom('teach1');Broadcast.tick(2)")
        self.assert_js(p,"Broadcast.state().current.done&&!S.dead&&S.san===100")

    def test_reading_reports_only_station_region_and_stopping_does_not_erase_investigation(self):
        p = self.game()
        p.evaluate("prepareRadio();patReset();PatrolWorld.reset();PAT.state='idle';PAT.respawn=100;PatrolWorld.tick(.01)")
        self.assert_js(p,"!PAT.lastRegion")
        p.evaluate("Broadcast.hold(true);PatrolWorld.tick(.01)")
        self.assert_js(p,"PAT.lastRegion==='admin2:broadcast'&&PAT.queue.some(z=>z.regionId==='admin2:broadcast')")
        p.evaluate("Broadcast.stop();PatrolWorld.tick(.01)")
        self.assert_js(p,"!PAT.lastRegion&&PAT.queue.some(z=>z.regionId==='admin2:broadcast')")

    def test_long_bell_hides_only_the_player_in_the_crowd_and_then_expires(self):
        p = self.game()
        p.evaluate("prepareRadio();Broadcast.hold(true);for(let i=0;i<4;i++)Broadcast.tick(20.1)")
        self.assert_js(p,"Broadcast.state().phase==='bell'&&Broadcast.state().completed===4&&Broadcast.crowd()")
        p.evaluate("BroadcastUI.open();BroadcastUI.paint();doExitRoom();const q=Broadcast.crowd();S.x=q.x;S.y=q.y;PAT.permanent=true;PAT.locked=true;PAT.safety=10;PatrolWorld.tick(.01)")
        self.assert_js(p,"Broadcast.cover()&&!PAT.locked&&!PatrolWorld.localThreat()&&!BroadcastUI.isOpen()")
        p.evaluate("S.x+=100")
        self.assert_js(p,"!Broadcast.cover()")
        p.evaluate("Broadcast.tick(61)")
        self.assert_js(p,"Broadcast.state().phase==='collect'&&Broadcast.state().completed===0&&Broadcast.ready()&&hasItem('notice4')")
        p.evaluate("atRadio('admin2',5,4.4)")
        self.assert_js(p,"!Broadcast.hold(true)")
        p.evaluate("S.day++;S.tsec=1100")
        self.assert_js(p,"Broadcast.hold(true)")

    def test_all_ending_cg_shots_and_death_preview_preserve_player_state(self):
        p = self.game()
        result=p.evaluate("""()=>{prepareRadio();CUT.enabled=true;
          const before=JSON.stringify(S),old=VisualState.stageHour;playCut('dismissal',()=>{S.screen='play';});
          [1,4,4,4,4].forEach(dt=>cutTick(dt));cutSkip();
          const cutSame=JSON.stringify(S)===before&&VisualState.stageHour===old;
          const preview=JSON.stringify(S);deathFX('misread',{preview:true});[.5,1,1,1].forEach(anfxUpdate);anfxClear();
          return {cutSame,deathSame:JSON.stringify(S)===preview};}""")
        self.assertEqual(result,dict(cutSame=True,deathSame=True))

    def test_legitimate_exit_records_new_ending_score_and_archive(self):
        p = self.game()
        p.evaluate("prepareRadio();Broadcast.hold(true);for(let i=0;i<4;i++)Broadcast.tick(20.1);doExitRoom();Broadcast.state().bell=1;const q=Broadcast.crowd();S.x=q.x;S.y=q.y;Broadcast.tryExit()")
        self.assert_js(p,"RT.end==='dismissal'&&S.screen==='end'&&endsSeen().dismissal&&Achievements.state().got['e.end_dismissal']&&SPEEDRUN_ROUTES.dismissal&&SCORE_CFG.par.dismissal===1800")
        self.assertIn('明天见',p.locator('#ends').inner_text())

    def test_fake_page_death_has_public_source_and_replay(self):
        p = self.game()
        p.evaluate("prepareRadio();addItem('notice_fake');Broadcast.select('notice_fake');Broadcast.hold(true);Broadcast.tick(2.1)")
        self.assert_js(p,"S.dead&&S.death==='misread'&&DEATH_SOURCES.misread&&DeathTimeline.duration('misread')===4.1&&DeathCG.has('misread')&&CUT_DEF.dismissal.dur===18")

    def test_phone_panel_fits_portrait_and_landscape_and_touch_release_stops_reading(self):
        p = self.game(touch=True)
        p.evaluate("prepareRadio();BroadcastUI.open();BroadcastUI.paint()")
        for width,height in ((390,844),(844,390)):
            p.set_viewport_size({'width':width,'height':height})
            b=p.locator('#broadcast-panel').bounding_box()
            self.assertGreaterEqual(b['x'],0);self.assertLessEqual(b['x']+b['width'],width+1)
            self.assertGreaterEqual(b['y'],0);self.assertLessEqual(b['y']+b['height'],height+1)
        p.locator('#radio-read').dispatch_event('pointerdown',{'pointerId':4,'pointerType':'touch','button':0})
        self.assert_js(p,"Broadcast.reading().held")
        p.locator('#radio-read').dispatch_event('pointercancel',{'pointerId':4,'pointerType':'touch','button':0})
        self.assert_js(p,"!Broadcast.reading().held")
