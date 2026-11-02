"""持久巡察与手机/服务器路线的浏览器集成回归；不冒充自然游玩平衡验收。"""
from browser_case import BrowserCase

class CampusNetworkTest(BrowserCase):
    def game(self,touch=False):
        p=self.page(touch=touch)
        p.evaluate("""freshState('hard');running=false;PRO.on=false;S.intro=0;S.talent='none';S.tsec=700;
          const R=INTERIORS.teach1;doEnterRoom('teach1',{x:R.ox+48.5*9,y:R.oy+6.5*9,seated:true});AN.next=1e6;""")
        return p

    def test_day_one_no_permit_then_independent_duty_and_missing_penalty(self):
        p=self.game()
        r=p.evaluate("""() => {
          let first=SchoolDay.grant(false);S.day=2;S.tsec=700;SchoolDay.grant(false);SchoolDay.grant(false);
          let count=AttendanceDuty.state.duties.length,id=AttendanceDuty.state.duties[0].targetCheckId;
          S.tsec=771;let expired=!SchoolDay.permit();Inspection.start({day:2,slot:0});let c=RT.inspection.current;c.compliant=false;
          Inspection.finish(c);let active=PAT.permanent;PatrolWorld.rescued();AttendanceDuty.settle(c);
          return {first,count,id,expired,active,replayed:PAT.permanent};
        }""")
        self.assertEqual(r,dict(first=False,count=1,id='2:0',expired=True,active=True,replayed=False))

    def test_stale_checks_roll_duties_without_punishment(self):
        p=self.game()
        self.assert_js(p,"""(() => {S.day=2;S.tsec=760;SchoolDay.grant(false);RT.inspection.queue=[{day:2,slot:0}];S.tsec=780;
          Inspection.discardStale();return AttendanceDuty.state.duties[0].targetCheckId==='2:1'&&!PAT.permanent;})()""")

    def test_remote_entity_does_not_block_inspection_or_drain_sanity(self):
        p=self.game()
        self.assert_js(p,"""(() => {PAT.permanent=true;PAT.locked=true;PAT.room='admin1';S.tsec=770;Inspection.state().queue=[{day:1,slot:0}];
          Inspection.tick(.01);return Inspection.active()&&PatrolWorld.pressure()===0&&!PatrolWorld.localChase();})()""")

    def test_one_world_entity_survives_scene_changes_and_door_keys_use_explicit_room(self):
        p=self.game()
        self.assert_js(p,"""(() => {let before=JSON.stringify(PAT);doEnterRoom('lab3');let after=JSON.stringify(PAT);
          const R=INTERIORS.lab3;return before===after&&doorKeyAt(INTERIORS.admin2,8,16)==='admin2:8:16'&&PAT.room==='admin1';})()""")

    def test_seal_banishes_once_and_respawns_at_fixed_point(self):
        p=self.game()
        self.assert_js(p,"""(() => {PAT.permanent=true;PAT.queue=[{regionId:'admin5:office0',sequence:1,enteredAt:0}];PatrolWorld.banish();
          PatrolWorld.tick(29.9);let missing=PAT.state==='idle'&&PhoneNetwork.location()!==undefined;
          PatrolWorld.tick(.1);const a=PatrolWorld.spawn();return missing&&PAT.state==='walk'&&PAT.room==='admin1'&&Math.hypot(PAT.x-a.x,PAT.y-a.y)<.01&&PAT.permanent&&PAT.queue.length===1;})()""")

    def test_region_queue_has_no_player_coordinates_and_ignores_corridor(self):
        p=self.game()
        self.assert_js(p,"""(() => {doEnterRoom('admin5',PatrolNav.tilePoint('admin5',5,14));PatrolWorld.tick(.01);
          let e=PAT.investigation||PAT.queue[0];S.x=INTERIORS.admin5.ox+5*9;S.y=INTERIORS.admin5.oy+19*9;PatrolWorld.tick(.01);
          return e.regionId==='admin5:office0'&&e.x===undefined&&e.y===undefined&&PatrolWorld.region()===null;})()""")

    def test_phone_background_device_identity_and_no_refill(self):
        p=self.game()
        self.assert_js(p,"""(() => {addItem('phone');PhoneNetwork.startWireless();const target=PhoneNetwork.device.wireless.target;
          PhoneNetwork.tick(60);PHONE.start();PHONE.stop();removeItem('phone');let battery=PhoneNetwork.device.battery,elapsed=PhoneNetwork.device.wireless.elapsed;
          PhoneNetwork.tick(10);addItem('phone');return PhoneNetwork.device.wireless.target===target&&PhoneNetwork.device.wireless.elapsed===elapsed&&PhoneNetwork.device.battery<battery;})()""")

    def test_charge_only_original_classroom_and_normal_empty_pc_stays_off(self):
        p=self.game()
        self.assert_js(p,"""(() => {addItem('phone');let d=PhoneNetwork.device;d.battery=0;d.powered=false;PhoneNetwork.tick(30);let home=d.powered&&Math.abs(d.battery-10)<.001;
          doEnterRoom('teach1',PatrolNav.tilePoint('teach1',16,18));d.battery=20;PhoneNetwork.tick(30);let corridor=Math.abs(d.battery-15)<.001;
          const hit={ch:'n',...PatrolNav.tilePoint('lab3',3,4)};doEnterRoom('lab3',hit);PhoneNetwork.connect(hit);d.battery=0;d.powered=false;PhoneNetwork.tick(60);
          return home&&corridor&&d.battery===0&&!d.powered;})()""")

    def test_phone_tools_work_in_danger_but_paperplane_does_not(self):
        p=self.game(touch=True)
        p.evaluate("addItem('phone');AN.active=true;AN.id='rain';PHONE.start();")
        self.assert_js(p,'PHONE.on')
        p.locator('#phapps [data-app="location"]').tap()
        self.assert_js(p,"PHONE.on&&PhoneNetwork.page==='location'&&!playerInputAllowed()")
        p.locator('#phapps [data-app="plane"]').tap()
        self.assert_js(p,"PhoneNetwork.page==='home'")
        p.locator('#phone .phx').tap()
        self.assert_js(p,'!PHONE.on&&playerInputAllowed()')

    def test_normal_load_keeps_tasks_and_disconnects_terminal(self):
        p=self.game()
        self.assert_js(p,"""(() => {addItem('phone');PhoneNetwork.startWireless();PhoneNetwork.tick(12);saveGame();let old=structuredClone(PhoneNetwork.device),seconds=Mechanics.activePlaySeconds;
          PhoneNetwork.connection={x:1,y:1};applySave(loadGame());return old.battery===PhoneNetwork.device.battery&&old.wireless.elapsed===PhoneNetwork.device.wireless.elapsed&&old.wireless.target===PhoneNetwork.device.wireless.target&&PhoneNetwork.connection===null&&Mechanics.activePlaySeconds===seconds;})()""")

    def test_dream_clears_new_route_but_preserves_legacy_whitelist_and_talent(self):
        p=self.game()
        self.assert_js(p,"""(() => {S.talent='tech';addItem('phone');RT.hacked=true;RT.data=true;PAT.permanent=true;PhoneNetwork.device.battery=10;
          PhoneNetwork.device.network=true;Termination.state={status:'accepted',requestId:'x',remaining:1};let attempt=Mechanics.attemptId;Mechanics.dream();
          return RT.hacked&&RT.data&&S.talent==='tech'&&!PAT.permanent&&!PhoneNetwork.device.network&&PhoneNetwork.device.battery===100&&Termination.state.status==='idle'&&Mechanics.attemptId===attempt+1;})()""")

    def test_terminal_text_input_and_escape_restore_first_operation(self):
        p=self.game(touch=True)
        p.evaluate("""addItem('phone');PhoneNetwork.device.network=true;PhoneNetwork.device.download.status='complete';
          const hit={ch:'n',...PatrolNav.tilePoint('lab3',3,4)};doEnterRoom('lab3',hit);TerminalUI.open(hit);""")
        self.assert_js(p,'TerminalUI.on&&!PC.on&&!playerInputAllowed()&&GamePolicy.simulationAllowed(gameInputContext())')
        p.locator('#campus-command').fill('cat /school/README')
        p.keyboard.press('Enter')
        self.assert_js(p,"TerminalUI.puzzle.history.some(x=>x.includes('校园维护环境'))&&Object.keys(KEY).length===0")
        p.keyboard.press('Escape')
        self.assert_js(p,'!TerminalUI.on&&playerInputAllowed()')

    def test_pause_and_no_clock_space_separate_active_seconds(self):
        p=self.game()
        self.assert_js(p,"""(() => {let start=Mechanics.activePlaySeconds;PAUSE.on=true;update(2);PAUSE.on=false;let pause=Mechanics.activePlaySeconds===start;
          doEnterRoom('lift_dream',VoidMaze.spawnPoint());let time=S.tsec;update(.1);return pause&&Mechanics.activePlaySeconds>start&&S.tsec===time;})()""")

    def test_shutdown_zero_waits_for_hazards_and_real_death_wins(self):
        p=self.game()
        self.assert_js(p,"""(() => {Termination.state={status:'accepted',requestId:'x',remaining:0};S.san=0;S.talent='none';settleSan();Mechanics.finish(.1);
          return S.dead&&S.screen!=='end'&&Termination.state.status==='cancelled';})()""")

    def test_rescue_preserves_shutdown_then_public_ending_has_final_line(self):
        p=self.game()
        self.assert_js(p,"""(() => {addItem('elixir');PAT.permanent=true;Termination.state={status:'accepted',requestId:'x',remaining:0};kill('test','grip','patrol');Mechanics.finish(.1);
          return !S.dead&&!PAT.permanent&&RT.end==='cyber'&&S.screen==='end'&&ENDINGS.cyber.l.at(-1)==='您未能完全理解里世界'&&SPEEDRUN_PUBLIC.includes('cyber');})()""")

    def test_cyber_cutscene_uses_stage_and_preserves_player_position(self):
        p=self.game()
        self.assert_js(p,"""(() => {CUT.enabled=true;let old=[S.x,S.y,S.room,S.ang];playCut('cyber',function(){});for(let i=0;i<16;i++)cutTick(1);
          return !CUT.on&&old.every((x,i)=>x===[S.x,S.y,S.room,S.ang][i])&&Lifecycle.snapshot().errors.length===0;})()""")
