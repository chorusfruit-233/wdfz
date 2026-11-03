"""网络路线全链路及生命周期验收。这里布置前置条件，不称为自然通关。"""
from browser_case import BrowserCase

PREPARE="""freshState('hard');running=false;S.intro=0;PRO.on=false;S.talent='none';AN.next=1e6;
  doEnterRoom('teach1',PatrolNav.tilePoint('teach1',48,6));S.seated=false;S.tsec=700;"""

# 从玩家可读取的档案计算答案，不调用生成器的私有答案。
SOLUTION=r"""() => {
 const p=TerminalUI.puzzle,site=CampusTerminal.read(p,'/school/site.txt');
 const zone=/试点区域=(\S+)/.exec(site)[1],batch=/当前运行批次=(\S+)/.exec(site)[1];
 const controller=CampusTerminal.read(p,'/school/assets.tsv').split('\n').slice(1).map(x=>x.split(' ')).filter(x=>x[1]===zone&&x[2]===batch&&x[3]==='controller'&&x[4]==='online')[0][0];
 const logs=CampusTerminal.read(p,'/school/runtime.log').split('\n').map(x=>Object.fromEntries(x.split(' ').map(v=>v.split('='))));
 const chain=logs.filter(x=>x.node===controller&&x.actor==='control').sort((a,b)=>Number(a.active)-Number(b.active));
 const commit=chain.at(-1),edges=CampusTerminal.read(p,'/school/services.txt').split('\n').filter(x=>/^\w+ -> \w+$/.test(x)).map(x=>x.split(' -> '));
 let order=[],current=edges.find(([a])=>!edges.some(([,b])=>a===b))[0];
 while(current!=='control'){order.push(current);current=edges.find(([a])=>a===current)[1];}
 const body=['controller='+controller,'transaction='+commit.tx,'token='+commit.token,'clock=active',...order.map(x=>'stop '+x)].join('\\n');
 return ['help','cat /school/site.txt','cat /school/assets.tsv','cat /school/runtime.log','cat /school/services.txt',
 'campusctl select '+controller+' /school/assets.tsv','campusctl trace '+commit.tx+' /school/runtime.log',
 'edit /work/shutdown "'+body+'"','campusctl validate /work/shutdown','campusctl shutdown --confirm'];
}"""

class NetworkLifecycleTest(BrowserCase):
    def game(self,touch=False):
        p=self.page(touch=touch);p.evaluate(PREPARE);return p
    def ready(self,p):
        p.evaluate("""addItem('phone');PhoneNetwork.startWireless();PhoneNetwork.device.wireless.target=180;PhoneNetwork.tick(240);
          window.pc={ch:'n',...PatrolNav.tilePoint('lab3',3,4)};doEnterRoom('lab3',PatrolNav.tilePoint('lab3',5,4));TerminalUI.open(pc);""")
        self.assert_js(p,'PhoneNetwork.device.network&&PhoneNetwork.device.download.status===\'complete\'&&TerminalUI.on')
    def test_wireless_container_commands_disconnect_and_public_ending(self):
        p=self.game();self.ready(p)
        for command in p.evaluate(SOLUTION):
            p.locator('#campus-command').fill(command);p.keyboard.press('Enter')
        self.assert_js(p,"Termination.state.status==='accepted'&&Termination.state.remaining===600&&TerminalUI.puzzle.validated")
        p.evaluate("TerminalUI.execute('campusctl shutdown --confirm');TerminalUI.close();PhoneNetwork.disconnect();PhoneNetwork.device.battery=0;PhoneNetwork.device.powered=false;Mechanics.begin(599.9);Mechanics.finish(599.9)")
        self.assert_js(p,"Termination.state.status==='accepted'&&S.screen==='play'")
        p.evaluate('Mechanics.begin(.1);Mechanics.finish(.1)')
        self.assert_js(p,"RT.end==='cyber'&&S.screen==='end'&&document.getElementById('ends').textContent.includes('您未能完全理解里世界')")
    def test_tech_boundary_recharge_and_download_are_not_a_soft_lock(self):
        p=self.game()
        self.assert_js(p,"""(()=>{S.talent='tech';addItem('phone');PhoneNetwork.startWireless();PhoneNetwork.device.wireless.target=600;PhoneNetwork.tick(600);
          const d=PhoneNetwork.device,boundary=d.network&&!d.powered&&d.battery===0&&d.download.elapsed===0;
          PhoneNetwork.tick(30);let boot=d.powered&&Math.abs(d.battery-5)<1e-7;
          PhoneNetwork.tick(60);return boundary&&boot&&d.download.status==='complete'&&d.battery>5;})()""")
    def test_all_pause_contexts_freeze_network_and_hidden_time_does_not_catch_up(self):
        p=self.game()
        result=p.evaluate("""()=>{
          addItem('phone');PhoneNetwork.startWireless();let results={};
          const modes={pause:()=>PAUSE.on=true,handbook:()=>UI.openPanel='note',choice:()=>{UI.chooseOpen=true;UI.openPanel='choices';},
            snake:()=>PC.on=true,intro:()=>S.intro=3,prologue:()=>PRO.on=true,cut:()=>S.screen='cut',debug:()=>{DEV.on=true;DEV.freeze=true;},hidden:()=>Object.defineProperty(document,'hidden',{value:true,configurable:true})};
          for(const [name,enter] of Object.entries(modes)){let before=Mechanics.activePlaySeconds,energy=PhoneNetwork.device.battery;enter();update(.1);
            results[name]=Mechanics.activePlaySeconds===before&&PhoneNetwork.device.battery===energy;
            PAUSE.on=false;UI.openPanel=null;UI.chooseOpen=false;PC.on=false;S.intro=0;PRO.on=false;S.screen='play';DEV.on=false;DEV.freeze=false;Object.defineProperty(document,'hidden',{value:false,configurable:true});}
          lastT=0;accum=.9;document.dispatchEvent(new Event('visibilitychange'));results.noCatchUp=accum===0&&lastT>0;return results;
        }""")
        self.assertTrue(all(result.values()),result)
    def test_mobile_terminal_buffer_soft_focus_and_immediate_exit(self):
        p=self.game(touch=True);self.ready(p)
        p.locator('#campus-command').fill('wasd 123 Ctrl <b>')
        p.keyboard.press('Control');p.evaluate("window.before=Mechanics.activePlaySeconds;window.pos=[S.x,S.y];window.dispatchEvent(new Event('blur'));update(.1)")
        self.assert_js(p,"TerminalUI.on&&!PAUSE.on&&Mechanics.activePlaySeconds>before&&S.x===pos[0]&&S.y===pos[1]&&Object.keys(KEY).length===0")
        p.locator('#campus-terminal [data-exit]').tap()
        self.assert_js(p,"!TerminalUI.on&&playerInputAllowed()&&TerminalUI.puzzle.buffer==='wasd 123 Ctrl <b>'")
        p.evaluate('TerminalUI.open(pc)')
        self.assertEqual(p.locator('#campus-command').input_value(),'wasd 123 Ctrl <b>')
    def test_phone_and_admin_whitelist_are_the_same_idempotent_action(self):
        p=self.game()
        self.assert_js(p,"""(()=>{addItem('phone');PhoneNetwork.device.network=true;let blocked=!PhoneNetwork.sync()&&!RT.data;
          RT.hacked=true;PhoneNetwork.sync();let first=JSON.stringify(RT.investigation);useData();
          doEnterRoom('admin3');useData();return blocked&&RT.data&&RT.dataSource==='phone'&&JSON.stringify(RT.investigation)===first&&loadGame().rt.data;})()""")
    def test_occupied_day_only_blocks_snake_and_not_maintenance(self):
        p=self.game();p.evaluate("S.day=3;RT.dayEvents={3:'occupied'}");self.ready(p)
        self.assert_js(p,"TerminalUI.on&&PhoneNetwork.connectedComputer()")
        p.evaluate("TerminalUI.close();window.beforeSan=S.san;doSanAct('pc')")
        self.assert_js(p,"!PC.on&&S.san===beforeSan&&PhoneNetwork.connectedComputer()")
    def test_real_rescue_and_dream_cancel_at_same_shutdown_boundary(self):
        for kind in ('elixir','immune','dream'):
            with self.subTest(kind=kind):
                p=self.game();self.ready(p)
                p.evaluate("commands=>commands.forEach(c=>TerminalUI.execute(c))",p.evaluate(SOLUTION))
                p.evaluate("""kind=>{TerminalUI.close();Termination.state.remaining=.1;PAT.permanent=true;S.talent=kind==='immune'?'immune':'none';if(kind==='dream')S.diff='easy';
                  if(kind==='elixir')addItem('elixir');Mechanics.begin(.1);kill('test','grip','patrol');Mechanics.finish(.1);}""",kind)
                if kind=='dream':
                    p.evaluate('DEATH_PENDING.finish()');p.wait_for_function('!S.dead&&RT.wakes===1')
                    self.assert_js(p,"Termination.state.status==='idle'&&RT.end!=='cyber'&&!PAT.permanent")
                else:self.assert_js(p,"!S.dead&&!PAT.permanent&&RT.end==='cyber'")
    def test_legacy_migration_and_corrupt_new_device_do_not_refill(self):
        p=self.game()
        self.assert_js(p,"""(()=>{S.bag=['phone'];S.day=1;saveGame();let d=loadGame();delete d.mods.mechanics;delete d.mods.phoneDevice;delete d.mods.patrolWorld;
          d.rt.outing={day:1,from:700,until:770};applySave(d);let legacy=PhoneNetwork.device.battery===100&&!SchoolDay.permit()&&AttendanceDuty.state.duties.length===0;
          PhoneNetwork.device.battery=23;saveGame();applySave(loadGame());let once=PhoneNetwork.device.battery===23;
          let bad=loadGame();delete bad.mods.phoneDevice;applySave(bad);return legacy&&once&&PhoneNetwork.device.battery===0&&!PhoneNetwork.device.powered;})()""")
    def test_day_two_old_permit_retains_deadline_without_new_obligation(self):
        p=self.game()
        self.assert_js(p,"""(()=>{S.day=2;S.tsec=700;saveGame();let d=loadGame();delete d.mods.mechanics;delete d.mods.attendanceDuty;d.rt.outing={day:2,from:690,until:770};
          applySave(d);return SchoolDay.permit()&&RT.outing.until===770&&AttendanceDuty.state.duties.length===0;})()""")
    def test_accepted_request_work_buffer_and_countdown_survive_reload(self):
        p=self.game();self.ready(p)
        p.evaluate("commands=>commands.forEach(c=>TerminalUI.execute(c))",p.evaluate(SOLUTION))
        p.locator('#campus-command').fill('cat /work/shutdown')
        p.evaluate('Mechanics.begin(17.25);TerminalUI.close();saveGame();window.snapshot=loadGame();applySave(snapshot)')
        self.assert_js(p,"!TerminalUI.on&&!PhoneNetwork.connection&&Termination.state.remaining===582.75&&TerminalUI.puzzle.acceptedRequestId===Termination.state.requestId&&TerminalUI.puzzle.buffer==='cat /work/shutdown'&&CampusTerminal.validate(TerminalUI.puzzle,'/work/shutdown').ok")
    def test_cabin_car_and_calendar_jumps_use_one_active_tick(self):
        p=self.game()
        self.assert_js(p,"""(()=>{addItem('phone');doEnterRoom('lab1',Elevator.landing('lab',1));
          doEnterRoom('lift_lab');RT.elevatorRide={host:'lab',origin:1,target:2,phase:'moving',t:1,weird:false};
          let before=Mechanics.activePlaySeconds,battery=PhoneNetwork.device.battery;update(.1);
          let cabin=Math.abs(Mechanics.activePlaySeconds-before-.1)<1e-7&&Math.abs(PhoneNetwork.device.battery-battery+.1/6)<1e-7;
          Elevator.cancel();CarChase.start();before=Mechanics.activePlaySeconds;battery=PhoneNetwork.device.battery;update(.1);
          let car=Math.abs(Mechanics.activePlaySeconds-before-.1)<1e-7&&Math.abs(PhoneNetwork.device.battery-battery+.1/6)<1e-7;
          before=Mechanics.activePlaySeconds;battery=PhoneNetwork.device.battery;advanceGameTime(25);
          return cabin&&car&&Mechanics.activePlaySeconds===before&&PhoneNetwork.device.battery===battery;})()""")
    def test_tech_is_a_selectable_start_and_gets_only_one_full_phone(self):
        p=self.page()
        p.evaluate("Game.start('hard',{talent:'tech'});clearIntroTimers();running=false")
        p.wait_for_function("S.room==='teach1'")
        self.assert_js(p,"Talent.has('tech')&&TAL_KEYS.includes('tech')&&S.bag.filter(x=>x==='phone').length===1&&PhoneNetwork.device.initialized&&PhoneNetwork.device.battery===100")
    def test_terminal_fits_short_mobile_visual_viewport(self):
        p=self.game(touch=True);self.ready(p)
        p.set_viewport_size(dict(width=390,height=340))
        p.wait_for_function("document.getElementById('campus-terminal').getBoundingClientRect().bottom<=innerHeight+1")
        box=p.locator('#campus-terminal').bounding_box();exitbox=p.locator('#campus-terminal [data-exit]').bounding_box()
        self.assertGreaterEqual(box['y'],-1);self.assertLessEqual(box['y']+box['height'],341)
        self.assertGreaterEqual(exitbox['y'],0);self.assertLess(exitbox['y']+exitbox['height'],340)
        p.locator('#campus-command').fill('pwd');p.locator('#campus-terminal button[type="submit"]').tap()
        self.assert_js(p,"TerminalUI.puzzle.history.at(-1)==='/school'&&TerminalUI.on")
        p.locator('#campus-terminal [data-exit]').tap();self.assert_js(p,'!TerminalUI.on&&playerInputAllowed()')

    def test_late_registration_keeps_older_duty_and_new_day_target(self):
        p=self.game()
        self.assert_js(p,"""(()=>{S.day=2;S.tsec=760;SchoolDay.grant(false);let first=AttendanceDuty.state.duties[0].dutyId;
          S.tsec=1080;SchoolDay.grant(false);SchoolDay.grant(false);let ds=AttendanceDuty.state.duties;
          return ds.length===2&&ds[0].dutyId===first&&ds[0].targetCheckId==='2:0'&&ds[1].targetCheckId==='3:0'&&!PAT.permanent;})()""")

    def test_terminal_forced_choice_retains_work_and_moving_away_disconnects(self):
        p=self.game();self.ready(p)
        p.locator('#campus-command').fill('cat /school/site.txt')
        p.evaluate("UI.choice('中断',[{label:'继续',fn:function(){}}]);TerminalUI.interrupt()")
        self.assert_js(p,"!TerminalUI.on&&TerminalUI.puzzle.buffer==='cat /school/site.txt'")
        p.evaluate('UI.closeChoice();TerminalUI.open(pc);S.x=pc.x+27;TerminalUI.interrupt()')
        self.assert_js(p,"!TerminalUI.on&&!PhoneNetwork.connection&&TerminalUI.puzzle.buffer==='cat /school/site.txt'")

    def test_region_notifications_are_fifo_across_offices_and_network_center(self):
        p=self.game()
        self.assert_js(p,"""(()=>{doEnterRoom('admin5',PatrolNav.tilePoint('admin5',5,14));PatrolWorld.tick(.1);
          doEnterRoom('admin5',PatrolNav.tilePoint('admin5',13,14));PatrolWorld.tick(.1);
          let first=PAT.investigation.regionId,next=PAT.queue.map(x=>x.regionId);
          doEnterRoom('lab3',PatrolNav.tilePoint('lab3',41,10));PatrolWorld.tick(.1);
          return first==='admin5:office0'&&next.join(',')==='admin5:office1'&&
            PAT.queue.map(x=>x.regionId).join(',')==='admin5:office1,lab3:control'&&PatrolWorld.region()==='lab3:control'&&!PAT.permanent;})()""")

    def test_night_save_does_not_roll_tomorrows_duty_a_second_day(self):
        p=self.game()
        self.assert_js(p,"""(()=>{S.day=2;S.tsec=1080;SchoolDay.grant(false);advanceGameTime(280);
          let night=S.day===3&&S.tsec===1360;saveGame();applySave(loadGame());
          let kept=AttendanceDuty.state.duties[0].targetCheckId==='3:0'&&Investigation.render().includes('第 3 天 12:50');
          AttendanceDuty.state.duties.push({dutyId:'old',status:'pending',targetCheckId:'2:1'});
          AttendanceDuty.cancel({day:2,slot:1});let rolled=AttendanceDuty.state.duties.every(x=>x.targetCheckId==='3:0');
          advanceGameTime(140);let morning=S.day===3&&S.tsec===440;
          AttendanceDuty.settle({day:3,slot:0,compliant:false});updateHUD();return night&&kept&&rolled&&morning&&PAT.permanent&&Investigation.render().includes('持续追踪仍生效')&&document.getElementById('period').textContent.includes('持续追踪');})()""")

    def test_container_pause_button_preserves_elapsed_time(self):
        p=self.game(touch=True)
        p.evaluate("addItem('phone');PhoneNetwork.startWireless();PhoneNetwork.device.wireless.target=180;PhoneNetwork.tick(185);PHONE.start()")
        p.locator('#phapps [data-app="container"]').tap()
        p.locator('#phtool [data-action="download"]').tap()
        p.evaluate('PhoneNetwork.tick(30)')
        self.assert_js(p,"PhoneNetwork.device.download.status==='paused'&&PhoneNetwork.device.download.elapsed===5")
        p.locator('#phtool [data-action="download"]').tap()
        p.evaluate('PhoneNetwork.tick(55)')
        self.assert_js(p,"PhoneNetwork.device.download.status==='complete'&&PhoneNetwork.device.download.elapsed===60&&document.querySelector('[data-action=download]').disabled")

    def test_location_updates_floor_transit_and_banish_then_stops_without_power(self):
        p=self.game();self.ready(p)
        self.assert_js(p,"""(()=>{TerminalUI.close();PAT.room='admin3';PAT.transition=null;PHONE.start();PHONE.selectApp('location');
          let text=()=>document.querySelector('#phtool [data-copy]').textContent;
          let floor=text()==='行政楼／3F';let g=PatrolNav.graph();
          PAT.transition={from:g.nodes['admin3:stairs'],to:g.nodes['admin4:stairs'],kind:'stairs',total:2,remaining:1};PHONE.paintApps();
          let transit=text()==='楼梯／3F→4F';PatrolWorld.banish();PHONE.paintApps();let absent=text()==='信号暂不可用';
          PhoneNetwork.device.battery=0;PhoneNetwork.device.powered=false;PHONE.checkInterrupt();
          PAT.state='walk';PAT.room='admin5';return floor&&transit&&absent&&!PHONE.on&&!PhoneNetwork.location().includes('行政楼');})()""")
