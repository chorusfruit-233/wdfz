"""无线破解暴露：真实浏览器中的运行时钟、静态情报、调查与存档；布置场景，不是自然通关。"""
from browser_case import BrowserCase


class WirelessSignalTest(BrowserCase):
    def game(self, touch=False):
        p = self.page(touch=touch)
        p.evaluate("""freshState('hard');running=false;PRO.on=false;S.intro=0;S.talent='none';
          S.tsec=700;AN.active=false;AN.next=1e6;
          doEnterRoom('teach1',PatrolNav.tilePoint('teach1',48,6));S.seated=false;
          addItem('phone');PhoneNetwork.startWireless();PhoneNetwork.device.wireless.target=180;""")
        return p

    def test_first_signal_is_at_fifteen_seconds_and_does_not_force_lock(self):
        p = self.game()
        self.assert_js(p, """(()=>{PhoneNetwork.tick(14.99);const before=PAT.wirelessSignal===null;
          PhoneNetwork.tick(.01);const q=PAT.wirelessSignal;
          return before&&q.point.scene===S.room&&q.point.x===S.x&&q.point.y===S.y&&q.remaining===3&&
            !PAT.locked&&!PAT.permanent&&PAT.lastSeen===null&&PatrolWorld.pressure()===0;})()""")

    def test_background_signals_replace_old_snapshot_without_live_tracking(self):
        p = self.game()
        self.assert_js(p, """(()=>{PHONE.start();PHONE.stop();PhoneNetwork.tick(15);
          const first=JSON.stringify(PAT.wirelessSignal);doEnterRoom('lab3',PatrolNav.tilePoint('lab3',5,4));
          PhoneNetwork.tick(14.99);PatrolWorld.tick(.01);const staticPoint=JSON.stringify(PAT.wirelessSignal)===first;
          PhoneNetwork.tick(.01);return staticPoint&&!PHONE.on&&PAT.wirelessSignal.point.scene==='lab3'&&
            PAT.wirelessSignal.point.x===S.x&&!PAT.locked&&!PAT.permanent;})()""")

    def test_pause_loss_of_device_and_empty_battery_do_not_advance_signals(self):
        p = self.game()
        self.assert_js(p, """(()=>{PhoneNetwork.tick(14);PhoneNetwork.toggleWireless();PhoneNetwork.tick(40);
          const paused=!PAT.wirelessSignal&&PhoneNetwork.device.wireless.elapsed===14;
          PhoneNetwork.toggleWireless();removeItem('phone');PhoneNetwork.tick(40);
          const dropped=!PAT.wirelessSignal&&PhoneNetwork.device.wireless.elapsed===14;
          addItem('phone');doEnterRoom('lab3',PatrolNav.tilePoint('lab3',5,4));PhoneNetwork.device.battery=0;PhoneNetwork.device.powered=false;
          PhoneNetwork.tick(40);const off=!PAT.wirelessSignal&&PhoneNetwork.device.wireless.elapsed===14;
          doEnterRoom('teach1',PatrolNav.tilePoint('teach1',48,6));PhoneNetwork.tick(15);
          const boot=PhoneNetwork.device.powered&&!PAT.wirelessSignal;
          PhoneNetwork.tick(1);return paused&&dropped&&off&&boot&&!!PAT.wirelessSignal;})()""")

    def test_game_pause_freezes_both_progress_and_received_intelligence(self):
        p = self.game()
        self.assert_js(p, """(()=>{PhoneNetwork.tick(15);const before=JSON.stringify(PAT.wirelessSignal),elapsed=PhoneNetwork.device.wireless.elapsed;
          PAUSE.on=true;update(30);PAUSE.on=false;
          return PhoneNetwork.device.wireless.elapsed===elapsed&&JSON.stringify(PAT.wirelessSignal)===before;})()""")

    def test_save_load_keeps_snapshot_and_partial_interval_without_replaying_signal(self):
        p = self.game()
        self.assert_js(p, """(()=>{PhoneNetwork.tick(29.5);const first=JSON.stringify(PAT.wirelessSignal);saveGame();
          applySave(loadGame());const loaded=JSON.stringify(PAT.wirelessSignal)===first;
          doEnterRoom('lab3',PatrolNav.tilePoint('lab3',5,4));PhoneNetwork.tick(.49);
          const pending=JSON.stringify(PAT.wirelessSignal)===first;PhoneNetwork.tick(.01);
          return loaded&&pending&&PAT.wirelessSignal.point.scene==='lab3'&&PhoneNetwork.device.wireless.elapsed===30;})()""")

    def test_patrol_navigates_toward_old_location_after_unseen_scene_change(self):
        p = self.game()
        self.assert_js(p, """(()=>{doEnterRoom('teach1',PatrolNav.tilePoint('teach1',40,18));PhoneNetwork.tick(15);
          const goal=structuredClone(PAT.wirelessSignal.point),a=PatrolNav.tilePoint('teach1',4,18);
          Object.assign(PAT,{room:'teach1',x:a.x,y:a.y,fy:0,transition:null,safety:0,blinkCD:0});
          const before=Math.hypot(PAT.x-goal.x,PAT.y-goal.y);doEnterRoom('lab3',PatrolNav.tilePoint('lab3',5,4));
          PatrolWorld.tick(1.2);return Math.hypot(PAT.x-goal.x,PAT.y-goal.y)<before&&
            JSON.stringify(PAT.wirelessSignal.point)===JSON.stringify(goal)&&PAT.behavior==='investigate'&&!PAT.locked;})()""")

    def test_search_ends_at_snapshot_then_region_investigation_resumes(self):
        p = self.game()
        self.assert_js(p, """(()=>{doEnterRoom('teach1',PatrolNav.tilePoint('teach1',30,18));PhoneNetwork.tick(15);
          const q=PAT.wirelessSignal.point;Object.assign(PAT,{room:q.scene,x:q.x,y:q.y,fy:q.fy,safety:0,transition:null});
          PAT.investigation={regionId:'admin5:office0',remaining:6};
          PhoneNetwork.toggleWireless();doEnterRoom('lab3',PatrolNav.tilePoint('lab3',5,4));PatrolWorld.tick(2.9);
          const waiting=!!PAT.wirelessSignal&&PAT.investigation.remaining===6;PatrolWorld.tick(.2);
          return waiting&&!PAT.wirelessSignal&&PAT.investigation.remaining===6&&!PAT.permanent&&!PAT.locked;})()""")

    def test_wireless_search_overrides_seat_leave_and_night_immunity_but_keeps_warning(self):
        p = self.game()
        self.assert_js(p, """(()=>{const R=INTERIORS.teach1;S.x=R.ox+48.5*9;S.y=R.oy+6.5*9;
          S.seated=true;S.tsec=1400;RT.leaveUntil=gameClock()+120;
          const immune=PatrolWorld.exempt()&&!PatrolWorld.eligible()&&!PatrolWorld.hunting();PhoneNetwork.tick(15);
          Object.assign(PAT,{room:S.room,x:S.x,y:S.y+45,fy:0,transition:null,safety:0,near:false,blinkCD:100});
          PatrolWorld.tick(.1);const warning=PAT.warning>3&&!PAT.locked&&PatrolWorld.hunting();
          PatrolWorld.tick(4.5);return immune&&warning&&PAT.locked&&!S.dead&&!PAT.permanent;})()""")

    def test_signal_reveals_only_the_cabinet_occupied_at_that_moment(self):
        p = self.game()
        self.assert_js(p, """(()=>{doEnterRoom('teach1',PatrolNav.tilePoint('teach1',12,17));hideIn({c:12,r:16});PhoneNetwork.tick(15);
          const signal=structuredClone(PAT.wirelessSignal),f=lockerFront(INTERIORS.teach1,12,16);
          const target=signal.point.x===f.x&&signal.point.y===f.y&&signal.locker.c===12&&!HIDE.seen;
          hideOut();hideIn({c:28,r:16});PatrolWorld.tick(.1);
          return target&&JSON.stringify(PAT.wirelessSignal)===JSON.stringify(signal)&&!HIDE.seen&&!PAT.locked;})()""")

    def test_known_cabinet_can_be_found_and_seal_still_banishes(self):
        p = self.game()
        self.assert_js(p, """(()=>{doEnterRoom('teach1',PatrolNav.tilePoint('teach1',12,17));hideIn({c:12,r:16});PhoneNetwork.tick(15);
          const f=lockerFront(INTERIORS.teach1,12,16);addItem('seal');
          Object.assign(PAT,{room:'teach1',x:f.x,y:f.y+12,fy:0,transition:null,safety:0,warning:0,near:true,blinkCD:100});
          PatrolWorld.tick(1.1);return !hasItem('seal')&&PAT.state==='idle'&&!S.dead&&!PAT.permanent;})()""")

    def test_completion_stops_new_signals_without_retracting_last_one(self):
        p = self.game()
        self.assert_js(p, """(()=>{PhoneNetwork.tick(180);const last=JSON.stringify(PAT.wirelessSignal);
          doEnterRoom('lab3',PatrolNav.tilePoint('lab3',5,4));PhoneNetwork.tick(100);
          return PhoneNetwork.device.network&&PhoneNetwork.device.download.status==='complete'&&
            JSON.stringify(PAT.wirelessSignal)===last&&PAT.wirelessSignal.point.scene==='teach1';})()""")

    def test_legacy_and_malformed_signals_are_cleared_and_new_game_resets(self):
        p = self.game()
        self.assert_js(p, """(()=>{PhoneNetwork.tick(15);saveGame();const d=loadGame();delete d.mods.patrolWorld.wirelessSignal;applySave(d);
          const legacy=!PAT.wirelessSignal;
          for(const signal of [{point:{scene:'missing',x:0,y:0},remaining:3},{point:{scene:'teach1',x:'bad',y:0},remaining:3},
            {point:PatrolNav.tilePoint('teach1',48,6),remaining:99}]){
            d.mods.patrolWorld.wirelessSignal=signal;applySave(d);if(PAT.wirelessSignal)return false;}
          PhoneNetwork.tick(15);const restored=!!PAT.wirelessSignal;Mechanics.dream();const dream=!PAT.wirelessSignal;
          freshState('hard');running=false;return legacy&&restored&&dream&&!PAT.wirelessSignal&&PhoneNetwork.device.wireless.elapsed===0;})()""")

    def test_signal_preserves_connector_travel_and_permanent_tracking(self):
        p = self.game()
        self.assert_js(p, """(()=>{const g=PatrolNav.graph(),a=g.nodes['admin1:stairs'],b=g.nodes['admin2:stairs'];
          Object.assign(PAT,{room:a.scene,x:a.x,y:a.y,permanent:true,transition:{from:a,to:b,kind:'stairs',remaining:2,total:2}});
          PhoneNetwork.tick(15);const notified=PAT.transition.remaining===2&&PAT.permanent&&!PAT.locked;
          PatrolWorld.tick(1.9);const travelling=PAT.room==='admin1'&&PAT.transition.remaining>0;
          PatrolWorld.tick(.1);return notified&&travelling&&PAT.room==='admin2'&&!PAT.transition&&PAT.permanent&&!!PAT.wirelessSignal;})()""")

    def test_banishment_retains_snapshot_but_rescue_clears_it(self):
        p = self.game()
        self.assert_js(p, """(()=>{PhoneNetwork.tick(15);const before=JSON.stringify(PAT.wirelessSignal);PatrolWorld.banish();
          const banished=PAT.state==='idle'&&JSON.stringify(PAT.wirelessSignal)===before;
          PatrolWorld.rescued();return banished&&!PAT.wirelessSignal&&!PAT.permanent&&PAT.safety===3.6;})()""")

    def test_close_signal_keeps_full_warning_before_search_or_capture(self):
        p = self.game()
        self.assert_js(p, """(()=>{S.seated=true;PhoneNetwork.tick(15);const q=PAT.wirelessSignal.point;
          Object.assign(PAT,{room:q.scene,x:q.x,y:q.y,fy:q.fy,safety:0,transition:null,near:false,blinkCD:100});
          PatrolWorld.tick(3.1);const warning=PAT.warning>0&&!PAT.locked&&!S.dead&&PAT.wirelessSignal.remaining===3;
          PatrolWorld.tick(1.5);return warning&&S.dead;})()""")

    def test_phone_explains_exposure_and_countdown_on_mobile(self):
        p = self.game(touch=True)
        p.evaluate("PHONE.start();PHONE.selectApp('wireless');PhoneNetwork.tick(12)")
        copy = p.locator('#phtool [data-copy]').inner_text()
        self.assertIn('15 运行秒', copy)
        self.assertIn('下次暴露：3 秒', copy)
        p.locator('#phtool [data-action="wireless"]').tap()
        self.assertIn('已发出的位置信息不会撤回', p.locator('#phtool [data-copy]').inner_text())
        self.assert_js(p, 'PhoneNetwork.device.wireless.status===\'paused\'')
