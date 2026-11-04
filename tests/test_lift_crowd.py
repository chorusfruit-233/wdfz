"""电梯里的「满员」（内部，计划《电梯直通、新天赋、新结局与恐怖氛围》第 6 节）：
抽签条件和互斥、牌子线索、蜂鸣重开、走出去化解（+20、隐藏成就）、留下死亡、隐藏死亡档案、存档。

内部测试；玩家 Wiki 不写这个事件（tests/test_wiki_secrets.py 有禁止词）。"""
from browser_case import BrowserCase

HELP = """
window.walk=(n,key)=>{for(let i=0;i<n;i++){if(key)KEY[key]=true;update(1/30);}if(key)KEY[key]=false;};
window.faceOut=R=>{const f=Elevator.frame(R);S.ang=Math.atan2(f.oy,f.ox);};
window.local=()=>Elevator.local(INTERIORS[S.room],S.x,S.y);
window.armed=(host,floor)=>{LiftCrowd.CR.run=120;const c0=LIFT_CROWD_CFG.chance,r0=ELEVATOR_CONFIG.rareChance;LIFT_CROWD_CFG.chance=1;ELEVATOR_CONFIG.rareChance=0;
  Elevator.board(host,floor);LIFT_CROWD_CFG.chance=c0;ELEVATOR_CONFIG.rareChance=r0;return RT.elevatorRide;};
window.trust=()=>{SEARCH.on=true;DEV.fast=false;DEV.god=false;Achievements.run().debug=0;Achievements.run().mod=0;};
true;
"""


class LiftCrowdTest(BrowserCase):
    def game(self):
        page = self.page()
        page.evaluate("""localStorage.removeItem('wdfz3d_death_archive_v1');Game.start('hard');""")
        page.wait_for_function("S.room==='teach1'&&GLR.roomMesh&&GLR.roomMesh.userData.roomData===INTERIORS.teach1")
        page.evaluate("""clearIntroTimers();running=false;S.intro=0;S.day=2;S.tsec=760;S.talent='code';S.san=80;AN.active=false;AN.id=null;
          AN.next=1e5;patReset();PAT.next=1e5;RT.inspection=null;""" + HELP)
        return page

    def test_roll_is_one_percent_exclusive_and_waits_for_the_first_minute(self):
        page = self.game()
        r = page.evaluate("""()=>{
          const out={chance:LIFT_CROWD_CFG.chance,open:LIFT_CROWD_CFG.open,minRun:LIFT_CROWD_CFG.minRun};
          LiftCrowd.CR.run=10;out.early=LiftCrowd.eligible({rare:false});
          LiftCrowd.CR.run=120;out.ok=LiftCrowd.eligible({rare:false});out.rare=LiftCrowd.eligible({rare:true});
          AN.active=true;out.anomaly=LiftCrowd.eligible({rare:false});AN.active=false;
          // 正常乘梯：1% 抽中、和错误的电梯互斥，写在乘梯记录里
          let n=0,both=0;const r0=GameRandom.next;
          for(let i=0;i<4000;i++){const ride={rare:Math.random()<ELEVATOR_CONFIG.rareChance};GameModules.emit('liftBoard',ride);if(ride.crowd===1)n++;if(ride.crowd===1&&ride.rare)both++;}
          out.rate=n/4000;out.both=both;
          // 跨进门那一刻定好、存档，读档不重抽
          const ride=armed('teach',2);out.armed=ride.crowd;out.saved=loadGame().rt.elevatorRide.crowd;
          return out;}""")
        self.assertEqual((r['chance'], r['open'], r['minRun']), (0.01, 6, 60))
        self.assertFalse(r['early'])
        self.assertTrue(r['ok'])
        self.assertFalse(r['rare'])
        self.assertFalse(r['anomaly'])
        self.assertGreater(r['rate'], 0.002)
        self.assertLess(r['rate'], 0.02)
        self.assertEqual(r['both'], 0)
        self.assertEqual((r['armed'], r['saved']), (1, 1))

    def test_every_cabin_has_the_notice_next_to_the_panel(self):
        page = self.game()
        for room in ['teach2', 'lab3']:
            page.evaluate(f"doEnterRoom('{room}')")
            page.wait_for_function(f"GLR.roomMesh&&GLR.roomMesh.userData.roomData===INTERIORS['{room}']")
            n = page.evaluate("()=>{let n=0,t='';GLR.roomMesh.traverse(o=>{if(o.userData&&o.userData.liftNotice){n++;t=o.userData.text;}});return [n,t]}")
            self.assertEqual(n, [1, '超载时，请最后进入的乘客离开。'], room)
        # 运行中的轿厢房间里也有
        page.evaluate("Elevator.board('teach',2);Elevator.press(4)")
        page.wait_for_function("S.room==='lift_teach'&&GLR.roomMesh&&GLR.roomMesh.userData.roomData===INTERIORS.lift_teach")
        n = page.evaluate("()=>{let n=0;GLR.roomMesh.traverse(o=>{if(o.userData&&o.userData.liftNotice)n++;});return n}")
        self.assertEqual(n, 1)

    def test_walking_out_resolves_it_and_the_lift_leaves_alone(self):
        page = self.game()
        r = page.evaluate("""()=>{trust();armed('teach',3);
          Elevator.press(5);const c=LiftCrowd.state(),lift=Elevator.state('teach');
          const out={phase:c&&c.phase,room:S.room,pending:RT.elevatorRide.pending,dir:lift.dir,sub:document.getElementById('sub').innerText};
          walk(30);render(0);out.door=Elevator.doorAmount('teach',3);out.breath=document.getElementById('sub').innerText;
          out.fx=!!LiftCrowdFx.F.grp;out.ptK=[0.2,0.8].map(t=>{LiftCrowd.state().age=t;return lightState().ptK;});
          tryInteract();out.panel=document.getElementById('sub').innerText;out.choose=!!UI.chooseOpen;Elevator.closeDoor();walk(3);out.closeKey=Elevator.doorAmount('teach',3);
          faceOut(INTERIORS.teach3);walk(45,'w');
          out.after={state:LiftCrowd.state()&&LiftCrowd.state().phase,ride:RT.elevatorRide,a:local().a};
          walk(60);render(0);
          out.gone={state:LiftCrowd.state(),phase:lift.phase,target:lift.target,fx:!!LiftCrowdFx.F.grp,sub:document.getElementById('sub').innerText};
          out.ach=!!Achievements.state().got['h.crowd'];out.items=JSON.stringify(RunScore.state().ledger.filter(i=>/满员/.test(JSON.stringify(i))));
          out.dead=S.dead;return out;}""")
        self.assertEqual((r['phase'], r['room'], r['pending'], r['dir']), ('full', 'teach3', 5, 1))
        self.assertIn('满员', r['sub'])
        self.assertEqual(r['door'], 1)                          # 门重新开足
        self.assertIn('很多人在呼吸', r['breath'])
        self.assertTrue(r['fx'])
        self.assertLess(min(r['ptK']), 0.5)                      # 灯一闪一闪
        self.assertIn('没有反应', r['panel'])
        self.assertFalse(r['choose'])
        self.assertEqual(r['closeKey'], 1)                      # 关门键也没反应
        self.assertEqual(r['after']['state'], 'gone')
        self.assertIsNone(r['after']['ride'])
        self.assertGreater(r['after']['a'], 0.45)
        g = r['gone']
        self.assertIsNone(g['state'])
        self.assertEqual((g['phase'], g['target']), ('waiting', 5))   # 电梯自己往上走
        self.assertFalse(g['fx'])
        self.assertIn('没有的楼层', g['sub'])
        self.assertFalse(r['dead'])
        self.assertTrue(r['ach'])
        self.assertIn('化解「满员」', r['items'])
        self.assertIn('20', r['items'])

    def test_staying_inside_dies_after_six_seconds(self):
        page = self.game()
        r = page.evaluate("""()=>{trust();armed('lab',2);Elevator.press(4);
          const out={};walk(150);out.mid={dead:S.dead,phase:LiftCrowd.state().phase,door:Elevator.doorAmount('lab',2)};
          walk(90);
          out.end={dead:S.dead,death:S.death,crowd:LiftCrowd.state(),ride:RT.elevatorRide,arc:DeathArchive.state().unlocked.crowd,
            msg:DEATH_MESSAGES.crowd,hint:DEATH_SOURCES.crowd.hint,dur:DeathTimeline.duration('crowd'),ach:!!Achievements.state().got['h.crowd']};
          return out;}""")
        self.assertEqual(r['mid'], {'dead': False, 'phase': 'full', 'door': 1})   # 5 秒时门还开着
        e = r['end']
        self.assertTrue(e['dead'])
        self.assertEqual(e['death'], 'crowd')
        self.assertIsNone(e['crowd'])
        self.assertIsNone(e['ride'])
        self.assertTrue(e['arc'])
        self.assertEqual(e['msg'], '电梯里一直很挤。')
        self.assertEqual(e['hint'], '满员的时候，最后进来的人要出去。')
        self.assertAlmostEqual(e['dur'], 4.2)
        self.assertFalse(e['ach'])

    def test_state_survives_save_and_load_mid_event(self):
        page = self.game()
        r = page.evaluate("""()=>{armed('teach',2);Elevator.press(3);walk(40);
          autoSave();const saved=loadGame();const t=LiftCrowd.state().t;freshState('hard');running=false;applySave(saved);
          const c=LiftCrowd.state();return {phase:c&&c.phase,t:c&&c.t,t0:t,room:S.room,ride:RT.elevatorRide&&RT.elevatorRide.crowd};}""")
        self.assertEqual((r['phase'], r['room'], r['ride']), ('full', 'teach2', 2))
        self.assertLessEqual(abs(r['t'] - r['t0']), 0.5)

    def test_archive_entry_is_secret_until_it_happens(self):
        page = self.page()
        page.evaluate("""localStorage.setItem('wdfz3d_death_archive_v1',JSON.stringify({version:1,unlocked:{},first:{},count:{},migrated:1}));
          S.screen='menu';document.getElementById('menu').style.display='block';running=true;true;""")
        page.locator('#btnarchive').click()
        ids = "()=>[...document.querySelectorAll('#arcards .arcard')].map(c=>c.dataset.id)"
        self.assertNotIn('crowd', page.evaluate(ids))
        self.assertNotIn('满员', page.evaluate("document.getElementById('archive').innerHTML"))
        self.assertTrue(page.evaluate("DeathCG.has('crowd')&&DEV_DEATH.some(d=>d[1]==='crowd')"))
        page.evaluate("DeathArchive.record('crowd','crowd');DeathArchive.paint();true;")
        self.assertIn('crowd', page.evaluate(ids))
        page.locator('#arcards .arcard[data-id="crowd"] button').click()
        page.wait_for_function("ArchiveReplay.on&&ANFX.kind==='death'&&ANFX.deathType==='crowd'", timeout=20000)
        page.wait_for_function("!ArchiveReplay.on", timeout=20000)
        self.assert_js(page, "S.screen==='menu'&&!document.getElementById('archive').hidden")
