"""纸飞机与飞纸飞机的人（计划《规则怪谈、纸飞机与窗内视线》M2／M4／M5）。"""
from browser_case import BrowserCase


class PaperPlaneTest(BrowserCase):
    def game(self):
        page = self.page()
        page.evaluate("Game.start('hard',{talent:'watch'})")
        page.wait_for_function("S.room==='teach1'&&GLR.roomMesh&&GLR.roomMesh.userData.roomData===INTERIORS.teach1")
        page.evaluate("window.__rnd=RandomRules.create(7).next;clearIntroTimers();running=false;S.intro=0;S.day=2;S.tsec=900;AN.active=false;AN.next=1e6;PAT.next=1e6;patReset();DEV.god=false;"
                      "S.seated=false;S.screen='play';RT.windowGaze={next:1e9,ev:null,n:0,escaped:0};RT.paper=null;doEnterRoom('admin2');true;")
        page.wait_for_function("S.room==='admin2'")
        return page

    def stand(self, page, n=5):
        """站在一扇看得见的窗前 n 格，脸朝它。"""
        return page.evaluate("""(n)=>{const R=INTERIORS.admin2;for(const w of WindowGaze.windows(R)){const sx=w.x,sy=w.y+w.nz*n*R.th;
            if(!canStand(sx,sy))continue;S.x=sx;S.y=sy;S.ang=Math.atan2(w.y-sy,w.x-sx);S.pitch=0;if(WindowGaze.clear(R,w))return {c:w.c,r:w.r};}return null;}""", n)

    def tick(self, page, sec, step=0.1):
        page.evaluate("([s,d])=>{for(let t=0;t<s-1e-9&&!S.dead;t+=d)GameModules.emit('tick',d);}", [sec, step])

    def test_roll_is_once_per_run_and_ten_percent(self):
        page = self.page()
        r = page.evaluate("""()=>{const hits={peace:0,danger:0},N=4000;let n=0;
          for(let i=0;i<N;i++){RT.paper=null;const q=[ (i+0.5)/N ];GameRandom.bind(()=>q.length?q.shift():0.99);const r=PaperPlane.roll();if(r.hit){n++;hits[r.kind]++;}}
          RT.paper=null;GameRandom.bind(()=>0.05);const a=PaperPlane.roll();GameRandom.bind(()=>0.99);const b=PaperPlane.roll();
          return {rate:n/N,hits,same:JSON.stringify(a)===JSON.stringify(b)};}""")
        self.assertAlmostEqual(r['rate'], 0.10, delta=0.002)
        self.assertEqual(r['hits']['peace'], r['hits']['danger'])
        self.assertTrue(r['same'])                            # 一局只抽一次

    def test_peaceful_plane_lands_and_gives_a_real_note(self):
        page = self.game()
        self.assertIsNotNone(self.stand(page))
        r = page.evaluate("()=>{GameRandom.bind(window.__rnd);return PaperPlane.start('peace');}")
        self.assertTrue(r)
        self.tick(page, 2.6)
        r = page.evaluate("""()=>{const e=PaperPlane.state().ev;S.x=e.lx;S.y=e.ly;const hint=interactHint();tryInteract();
          return {hint,item:hasItem('paper'),note:RT.paperNote,ev:PaperPlane.state().ev,sub:document.getElementById('sub').innerText};}""")
        self.assertEqual(r['hint'], '地上的纸飞机')
        self.assertTrue(r['item'])
        self.assertIn(r['note'], r['sub'])
        self.assertIsNone(r['ev'])

    def fly_to_window(self, page):
        """真实按键：对准窗投出，按方向键把纸飞机飞向窗。"""
        page.evaluate("""()=>{const e=PaperPlane.state().ev;S.x=e.lx;S.y=e.ly;tryInteract();}""")
        self.assertTrue(page.evaluate("()=>PaperPlane.state().ev.phase==='read'&&!document.getElementById('paperread').hidden&&!playerInputAllowed()"))
        page.keyboard.press('e')
        r = page.evaluate("""()=>{const e=PaperPlane.state().ev,w=PaperPlane.windowOf(e);S.ang=Math.atan2(w.y-S.y,w.x-S.x);S.pitch=0;tryInteract();return e.phase;}""")
        self.assertEqual(r, 'flight')
        # 自动驾驶只按键：偏右就按左，偏左就按右，低了按上，高了按下
        for _ in range(200):
            st = page.evaluate("""()=>{const e=PaperPlane.state().ev;if(!e||e.phase!=='flight')return null;const w=PaperPlane.windowOf(e),f=e.f;
              const a=Math.atan2(w.y-f.y,w.x-f.x),d=Math.atan2(Math.sin(a-f.yaw),Math.cos(a-f.yaw));return {d,h:f.h};}""")
            if st is None:
                break
            for k, on in (('ArrowLeft', st['d'] < -0.05), ('ArrowRight', st['d'] > 0.05), ('ArrowUp', st['h'] < 1.45), ('ArrowDown', st['h'] > 1.85)):
                page.keyboard.down(k) if on else page.keyboard.up(k)
            self.tick(page, 0.1, 0.05)
        for k in ('ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'):
            page.keyboard.up(k)

    def test_danger_plane_read_fold_aim_and_fly_back_by_keys(self):
        page = self.game()
        self.stand(page, 6)
        page.evaluate("()=>{GameRandom.bind(window.__rnd);PaperPlane.start('danger');}")
        self.tick(page, 2.6)
        facts = page.evaluate("()=>{window.__f=[];GameModules.on('gameFact',f=>{if(f&&f.kind==='paper')__f.push(f.what+(f.clean?':clean':''));},{owner:'test'});return true;}")
        self.fly_to_window(page)
        r = page.evaluate("()=>({ev:PaperPlane.state().ev,dead:S.dead,facts:__f,input:playerInputAllowed()})")
        self.assertIsNone(r['ev'])
        self.assertFalse(r['dead'])
        self.assertIn('returned', ' '.join(r['facts']))
        self.assertTrue(r['input'])                          # 送到以后操作还给主角

    def test_crash_or_timeout_brings_the_sender(self):
        page = self.game()
        self.stand(page, 6)
        page.evaluate("()=>{GameRandom.bind(window.__rnd);PaperPlane.start('danger');}")
        self.tick(page, 2.6)
        r = page.evaluate("""()=>{const e=PaperPlane.state().ev;S.x=e.lx;S.y=e.ly;tryInteract();PaperPlane.fold();const w=PaperPlane.windowOf(e);
          S.ang=Math.atan2(w.y-S.y,w.x-S.x)+Math.PI;tryInteract();const turned=e.phase;S.ang-=Math.PI;tryInteract();PaperPlane.keys.d=1;
          for(let i=0;i<80&&e.phase==='flight';i++)GameModules.emit('tick',.1);PaperPlane.keys.d=0;return {turned,phase:e.phase,why:e.why};}""")
        self.assertEqual(r['turned'], 'aim')                 # 没对准窗不能投
        self.assertEqual(r['phase'], 'hunt')
        self.assertIn(r['why'], ('floor', 'wall', 'timeout'))
        self.tick(page, 4.5)
        r = page.evaluate("()=>({dead:S.dead,arc:DEATH_ARCHIVE.some(x=>x.id==='paper_sender'),cg:DeathCG.has('paper_sender')})")
        self.assertEqual(r, {'dead': True, 'arc': True, 'cg': True})

    def test_ignoring_the_plane_also_brings_the_sender_and_reading_timer_does_not_reset(self):
        page = self.game()
        self.stand(page, 6)
        page.evaluate("()=>{GameRandom.bind(window.__rnd);PaperPlane.start('danger');}")
        self.tick(page, 2.6)
        r = page.evaluate("""()=>{const e=PaperPlane.state().ev;S.x=e.lx;S.y=e.ly;tryInteract();for(let i=0;i<50;i++)GameModules.emit('tick',.1);
          document.getElementById('paperread').hidden=true;render(.016);const reopened=!document.getElementById('paperread').hidden;
          for(let i=0;i<40;i++)GameModules.emit('tick',.1);return {reopened,phase:e.phase,why:e.why};}""")
        self.assertTrue(r['reopened'])
        self.assertEqual((r['phase'], r['why']), ('hunt', 'read'))
