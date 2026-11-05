"""隐藏结局《盗梦空间》（内部彩蛋，计划 docs/plan/盗梦空间.md）：陀螺、睡着与入梦的概率、梦里的陀螺、两条分支、失败醒来的结算。"""
from browser_case import BrowserCase

SETUP = ("window.__rnd=window.__rnd||RandomRules.create(7).next;clearIntroTimers();running=false;S.intro=0;S.day=2;AN.active=false;AN.next=1e6;PAT.next=1e6;patReset();DEV.god=false;"
         "S.seated=false;S.screen='play';RT.inception=null;S.actCool={};")


class InceptionTest(BrowserCase):
    def game(self):
        page = self.page()
        page.evaluate("Game.start('hard',{talent:'watch'})")
        page.wait_for_function("S.room==='teach1'&&GLR.roomMesh&&GLR.roomMesh.userData.roomData===INTERIORS.teach1")
        page.evaluate(SETUP + "true;")
        return page

    def bed(self, page, tsec, rolls):
        """在北宿舍一楼的床上睡一次；rolls 是依次给出的随机数。"""
        return page.evaluate("""([t,rolls])=>{S.tsec=t;doEnterRoom('dorm1');const q=rolls.slice();GameRandom.bind(()=>q.length?q.shift():0.99);
          const before={tsec:S.tsec,san:S.san};doSanAct('sleep');GameRandom.bind(window.__rnd);
          return {room:S.room,dt:S.tsec-before.tsec,san:S.san-before.san,st:JSON.parse(JSON.stringify(RT.inception||{})),sub:document.getElementById('sub').innerText};}""", [tsec, rolls])

    def test_top_is_on_the_dorm_desk_once(self):
        page = self.game()
        r = page.evaluate("""()=>{doEnterRoom('dorm2');const R=INTERIORS.dorm2,C=INCEPTION_CFG;S.x=R.ox+(C.topCell.c+0.5)*R.tw;S.y=R.oy+(C.topCell.r+1.2)*R.th;
          const hint=interactHint();tryInteract();const got=hasItem('top');const again=Inception.nearTop();return {hint,got,again,name:ITEMS.top.n};}""")
        self.assertEqual(r, {'hint': '桌上的陀螺', 'got': True, 'again': False, 'name': '陀螺'})

    def test_class_sleep_is_rolled_once_a_day_and_dream_needs_the_top(self):
        page = self.game()
        r = self.bed(page, 560, [0.5])                       # 第 2 节上课：20% 没抽中
        self.assertEqual((r['dt'], r['san'], r['st']['classDay']), (0, 0, {'2': 0}))
        self.assertIn('睡不着', r['sub'])
        r = self.bed(page, 630, [0.0, 0.0])                  # 同一天：不再抽，照样睡不着
        self.assertEqual((r['dt'], r['st']['classDay']), (0, {'2': 0}))
        page.evaluate("S.day=3;true;")
        r = self.bed(page, 560, [0.1, 0.0])                  # 第二天抽中 20%；没有陀螺 → 照常睡觉
        self.assertEqual(r['st']['classDay'].get('3'), 1)
        self.assertEqual(r['room'], 'dorm1')
        self.assertGreater(r['dt'], 40)
        page.evaluate("S.day=4;S.actCool={};addItem('top');true;")
        r = self.bed(page, 800, [0.06])                      # 午休不上课：5% 才进梦，0.06 不进
        self.assertEqual(r['room'], 'dorm1')
        page.evaluate("S.day=5;S.actCool={};true;")
        r = self.bed(page, 800, [0.04])
        self.assertEqual(r['st']['entered'], {'5': 1})
        page.wait_for_function("S.room==='dream_top'")
        r = page.evaluate("""()=>{const t=S.tsec,next=AN.next;for(let i=0;i<30;i++)updateSystems(.5,false);GameModules.emit('tick',.5);
          return {frozen:S.tsec===t,an:!AN.active,noMap:!!INTERIORS.dream_top.noMap};}""")
        self.assertEqual(r, {'frozen': True, 'an': True, 'noMap': True})

    def enter(self, page):
        page.evaluate("addItem('top');S.day=6;S.actCool={};true;")
        self.bed(page, 800, [0.0])
        page.wait_for_function("S.room==='dream_top'")

    def test_spin_is_rolled_once_and_standing_top_turns_a_fall_into_the_ending(self):
        page = self.game()
        self.enter(page)
        r = page.evaluate("""()=>{GameRandom.bind(()=>0.2);useItem('top');GameRandom.bind(()=>0.9);useItem('top');GameRandom.bind(window.__rnd);
          const spin=RT.inception.dream.spin;const p=Inception.at({c:Inception.EXIT.c,r:Inception.EXIT.r});S.x=p.x;S.y=p.y;GameModules.emit('tick',.1);
          const looped=S.room==='dream_top'&&!RT.end;const pit=Object.keys(Inception.PITS)[0].split(',');const q=Inception.at({c:+pit[0],r:+pit[1]});S.x=q.x;S.y=q.y;
          for(let i=0;i<20;i++)GameModules.emit('tick',.1);return {spin,looped,end:RT.end,screen:S.screen};}""")
        self.assertEqual(r['spin'], 'stand')
        self.assertTrue(r['looped'])                         # 不倒：出口后面还是这条走廊
        self.assertEqual(r['end'], 'inception')

    def test_fallen_top_needs_the_exit_and_a_fall_wakes_you_with_double_sleep_once(self):
        page = self.game()
        self.enter(page)
        r = page.evaluate("""()=>{GameRandom.bind(()=>0.8);useItem('top');GameRandom.bind(window.__rnd);const spin=RT.inception.dream.spin;
          const b={tsec:S.tsec,day:S.day,san:S.san=40,viol:S.viol=0};const gain=CampusPressure.restGain(26);
          const pit=Object.keys(Inception.PITS)[0].split(',');const q=Inception.at({c:+pit[0],r:+pit[1]});S.x=q.x;S.y=q.y;
          for(let i=0;i<20;i++)GameModules.emit('tick',.1);
          const out={spin,room:S.room,dt:(gameClock()-((b.day-1)*1440+b.tsec)),viol:S.viol,end:RT.end||null,cool:S.actCool.sleep>gameClock()};
          out.sanGain=S.san-40;out.expect=Math.min(60,CampusPressure.restGain(26)*2);const v=S.viol,t=S.tsec;Inception.wake(true);out.again=(S.viol===v&&S.tsec===t);return out;}""")
        self.assertEqual(r['spin'], 'fall')
        self.assertEqual(r['room'], 'dorm1')
        self.assertEqual(r['dt'], 90)
        self.assertEqual(r['viol'], 15)
        self.assertIsNone(r['end'])
        self.assertTrue(r['cool'])
        self.assertAlmostEqual(r['sanGain'], r['expect'], delta=0.01)
        self.assertTrue(r['again'])                          # 只结算一次

    def test_unspun_top_cannot_open_the_door_and_falling_counts_as_failure(self):
        page = self.game()
        self.enter(page)
        r = page.evaluate("""()=>{const p=Inception.at({c:Inception.EXIT.c,r:Inception.EXIT.r});S.x=p.x;S.y=p.y;GameModules.emit('tick',.1);
          const stay=S.room;const pit=Object.keys(Inception.PITS)[0].split(',');const q=Inception.at({c:+pit[0],r:+pit[1]});S.x=q.x;S.y=q.y;
          for(let i=0;i<20;i++)GameModules.emit('tick',.1);return {stay,room:S.room,end:RT.end||null};}""")
        self.assertEqual(r, {'stay': 'dream_top', 'room': 'dorm1', 'end': None})

    def test_fallen_top_exit_is_the_ending_and_ending_is_hidden_everywhere(self):
        page = self.game()
        self.enter(page)
        r = page.evaluate("""()=>{GameRandom.bind(()=>0.8);useItem('top');GameRandom.bind(window.__rnd);const p=Inception.at({c:Inception.EXIT.c,r:Inception.EXIT.r});S.x=p.x;S.y=p.y;
          GameModules.emit('tick',.1);const a=ARCHIVE_CUTS.filter(x=>x.id==='end:inception')[0];
          return {end:RT.end,cut:!!CUT_DEF.inception,dur:CUT_DEF.inception.dur,secret:a&&a.secret,ach:AchievementRules.list?AchievementRules.list().some(x=>x.id==='h.inception'&&x.secret):null};}""")
        self.assertEqual(r['end'], 'inception')
        self.assertTrue(r['cut'])
        self.assertTrue(18 <= r['dur'] <= 22)
        self.assertEqual(r['secret'], 1)
