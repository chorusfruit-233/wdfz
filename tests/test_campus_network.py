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

    def test_cyber_ending_storyboard_hits_its_beats_and_cleans_up(self):
        """《网安仙人》结局分镜：机房指示灯一架架灭完、日志打完；走廊的灯闪两轮后稳住、红色退掉、巡察者垂下去；
        档案三处矛盾都圈出来、最后一行出现；天亮那段回到舞台、颜色恢复、天色只在演出里改。
        不加实时灯光；三处布景的着色器在开头就编好，中途不再现编；跳过或播完后舞台时刻、红色、舞台都还原。"""
        p=self.game()
        r=p.evaluate("""()=>{
          CUT.enabled=true;const tsec=S.tsec;let done=0;
          playCut('cyber',()=>{done++;});const d=CUT.data;
          function at(t){CUT.t=t-0.05;cutTick(0.05);render(0);}
          function on(i){const m=new THREE.Matrix4(),q=new THREE.Vector3(),r=new THREE.Quaternion(),s=new THREE.Vector3();d.ledOn.getMatrixAt(i,m);m.decompose(q,r,s);return s.x;}
          const out={lights:0};CUT.grp.traverse(o=>{if(o.isLight)out.lights++;});
          at(0.3);out.a0={A:d.A.visible,B:d.B.visible,C:d.C.visible,stage:VisualState.stage.mesh.visible,lit:d.leds.filter((l,i)=>on(i)>0).length,hour:hourNow()};
          const programs=GLR.renderer.info.programs.length;                // 第一帧之后（基础场景的着色器此时都已编好）
          at(3.0);out.a1={lit:d.leds.filter((l,i)=>on(i)>0).length,log:d.log.key};
          at(3.5);out.b0={B:d.B.visible,red:VisualState.patrolRed};
          at(6.6);out.b1={red:VisualState.patrolRed,lamps:d.lamps.visible,slump:+d.fig.rotation.x.toFixed(2)};
          at(10.8);out.c={C:d.C.visible,key:d.arch.key,map:!!d.arch.mesh.material.userData.disposeMap};
          out.newPrograms=GLR.renderer.info.programs.length-programs;      // 切到走廊、档案时不现编：三处布景开头一起编好
          at(14.5);out.d={stage:VisualState.stage.mesh.visible,wn:+GLR.worldNorm.toFixed(2),hour:+hourNow().toFixed(2),boost:d.boost>1,A:d.A.visible};
          cutSkip();
          out.after={done,on:CUT.on,stage:!!VisualState.stage,hour:VisualState.stageHour,red:VisualState.patrolRed,tsec:S.tsec===tsec,clock:hourNow()===(((S.tsec%1440)+1440)%1440)/60};
          CUT.enabled=false;return out;}""")
        self.assertEqual(r['lights'], 0)
        self.assertEqual(r['a0'], {'A': True, 'B': False, 'C': False, 'stage': False, 'lit': 100, 'hour': 5.2})
        self.assertEqual(r['a1'], {'lit': 0, 'log': 6})                    # 十架机柜全灭，六行日志打完
        self.assertTrue(r['b0']['B'] and r['b0']['red'] > 0)               # 闪着的时候带红
        self.assertEqual(r['b1'], {'red': 0, 'lamps': True, 'slump': 0.12})
        self.assertTrue(r['c']['C'] and r['c']['map'])
        self.assertTrue(r['c']['key'].startswith('9:'))                    # 标题、两栏、三行、三处圈、最后一行
        self.assertEqual(r['newPrograms'], 0)
        self.assertTrue(r['d']['stage'] and not r['d']['A'] and r['d']['boost'])
        self.assertEqual(r['d']['wn'], 1)
        self.assertTrue(6.0 < r['d']['hour'] < 7.2, r['d']['hour'])
        self.assertEqual(r['after'], {'done': 1, 'on': False, 'stage': False, 'hour': None, 'red': 0, 'tsec': True, 'clock': True})

    def test_cyber_cutscene_uses_stage_and_preserves_player_position(self):
        p=self.game()
        self.assert_js(p,"""(() => {CUT.enabled=true;let old=[S.x,S.y,S.room,S.ang];playCut('cyber',function(){});for(let i=0;i<16;i++)cutTick(1);
          return !CUT.on&&old.every((x,i)=>x===[S.x,S.y,S.room,S.ang][i])&&Lifecycle.snapshot().errors.length===0;})()""")
