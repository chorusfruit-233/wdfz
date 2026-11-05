"""翻越、受伤与校园坠落（计划《校园直通、翻越受伤与国际交流》第 6 节、Q6）。"""
from browser_case import BrowserCase


class BodyTest(BrowserCase):
    def game(self):
        page = self.page()
        page.evaluate("Game.start('hard',{talent:'watch'})")
        page.wait_for_function("S.room==='teach1'&&GLR.roomMesh&&GLR.roomMesh.userData.roomData===INTERIORS.teach1")
        page.evaluate("clearIntroTimers();running=false;S.intro=0;S.day=2;S.tsec=900;AN.active=false;AN.next=1e6;PAT.next=1e6;patReset();DEV.god=false;S.seated=false;S.screen='play';RT.body=null;S.stam=80;true;")
        return page

    def at_edge(self, page, room, c, r, ang):
        page.evaluate("([room,c,r,ang])=>{doEnterRoom(room);const R=INTERIORS[room];S.x=R.ox+(c+0.5)*R.tw;S.y=R.oy+(r+0.5)*R.th;S.ang=ang;S.pitch=0;}", [room, c, r, ang])

    def test_link_railing_vault_needs_a_hold_and_lands_you_hurt_outside(self):
        page = self.game()
        self.at_edge(page, 'link1', 3, 10, 0)            # 面朝东侧栏杆
        r = page.evaluate("""()=>{const hint=interactHint();KEY[' ']=true;for(let i=0;i<4;i++)GameModules.emit('tick',.1);const early=!!Body.state().fall;
          KEY[' ']=false;GameModules.emit('tick',.1);const cancelled=Body.state().hold===0&&!Body.state().fall;
          const st0=S.stam;KEY[' ']=true;for(let i=0;i<7;i++)GameModules.emit('tick',.1);KEY[' ']=false;const started=!!Body.state().fall,cost=st0-S.stam;
          for(let i=0;i<12;i++)GameModules.emit('tick',.1);return {hint,early,cancelled,started,cost:Math.round(cost),mode:S.mode,inj:Body.injury(),dead:S.dead};}""")
        self.assertEqual(r['hint'], '翻过栏杆 · 外侧悬空（按住空格）')
        self.assertFalse(r['early'])                         # 0.4 秒不够
        self.assertTrue(r['cancelled'])                      # 松开就取消
        self.assertTrue(r['started'])
        self.assertEqual(r['cost'], 8)
        self.assertEqual((r['mode'], r['inj'], r['dead']), ('out', 45, False))

    def test_injury_slows_blocks_running_and_caps_stamina_and_medkit_heals(self):
        page = self.game()
        r = page.evaluate("""()=>{const o={};Body.state().injury=30;o.mul30=GameModules.first('moveSpeedMul');o.run30=GameModules.first('runBlocked')===true;
          Body.state().injury=70;o.mul70=GameModules.first('moveSpeedMul');o.run70=GameModules.first('runBlocked')===true;
          S.stam=100;GameModules.emit('tick',.1);o.cap=Math.round(S.stam);o.max=Math.round(PlayerStats.staminaMax());
          addItem('medkit');useItem('medkit');for(let i=0;i<41;i++)GameModules.emit('tick',.1);o.after=Body.injury();o.left=hasItem('medkit');return o;}""")
        self.assertEqual((r['mul30'], r['run30'], r['mul70'], r['run70']), (0.9, False, 0.8, True))
        self.assertEqual(r['cap'], r['max'] - 28)
        self.assertEqual((r['after'], r['left']), (30, False))

    def test_medkit_is_interrupted_by_moving_and_scrapes_heal_by_resting(self):
        page = self.game()
        r = page.evaluate("""()=>{Body.state().injury=50;addItem('medkit');useItem('medkit');GameModules.emit('tick',.5);S.moving=true;GameModules.emit('tick',.1);S.moving=false;
          const kept=hasItem('medkit')&&Body.injury()===50;Body.state().injury=10;for(let i=0;i<190;i++)GameModules.emit('tick',.1);const mid=Body.injury();
          for(let i=0;i<120;i++)GameModules.emit('tick',.1);return {kept,mid,end:Body.injury()};}""")
        self.assertTrue(r['kept'])
        self.assertEqual(r['mid'], 10)                       # 前 20 秒不回
        self.assertEqual(r['end'], 0)

    def test_clinic_gives_one_medkit_a_day(self):
        page = self.game()
        r = page.evaluate("""()=>{doEnterRoom('admin1');const R=INTERIORS.admin1,C=BODY_CFG.clinic;S.x=R.ox+C.c*R.tw;S.y=R.oy+(C.r-0.4)*R.th;const hint=interactHint();
          tryInteract();const a=hasItem('medkit');removeItem('medkit');tryInteract();const b=hasItem('medkit');S.day=3;tryInteract();return {hint,a,b,c:hasItem('medkit')};}""")
        self.assertEqual(r, {'hint': '医务室的药柜', 'a': True, 'b': False, 'c': True})

    def test_roof_vault_is_the_campus_fall_death(self):
        page = self.game()
        self.at_edge(page, 'teach6', 5, 1, -1.5708)        # 面朝北侧女儿墙
        r = page.evaluate("""()=>{const hint=interactHint();KEY[' ']=true;for(let i=0;i<7;i++)GameModules.emit('tick',.1);KEY[' ']=false;
          for(let i=0;i<16;i++)GameModules.emit('tick',.1);return {hint,dead:S.dead,arc:DEATH_ARCHIVE.filter(x=>x.id==='campus_fall').map(x=>x.n)[0],cg:DeathCG.has('campus_fall')};}""")
        self.assertEqual(r, {'hint': '翻过栏杆 · 外侧悬空（按住空格）', 'dead': True, 'arc': '中国人能飞', 'cg': True})
