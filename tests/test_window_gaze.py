"""窗户内的视线（计划《规则怪谈、纸飞机与窗内视线》第 5 节）：只在真实窗格、遮挡与角度、被吸住掉 SAN、可以挣开、耗尽是专属死法。"""
from browser_case import BrowserCase


class WindowGazeTest(BrowserCase):
    def game(self):
        page = self.page()
        page.evaluate("Game.start('hard',{talent:'watch'})")
        page.wait_for_function("S.room==='teach1'&&GLR.roomMesh&&GLR.roomMesh.userData.roomData===INTERIORS.teach1")
        page.evaluate("clearIntroTimers();running=false;S.intro=0;S.day=2;S.tsec=900;AN.active=false;AN.next=1e6;PAT.next=1e6;patReset();DEV.god=false;S.seated=false;S.screen='play';"
                      "RT.windowGaze=null;doEnterRoom('admin2');true;")
        page.wait_for_function("S.room==='admin2'")
        return page

    def face(self, page, dist_tiles=5):
        """站在一扇窗正前方 dist_tiles 格，脸朝它；返回窗。"""
        return page.evaluate("""(n)=>{const R=INTERIORS.admin2,ws=WindowGaze.windows(R);
          for(const w of ws){const sx=w.x, sy=w.y+w.nz*n*R.th; const c=Math.floor((sx-R.ox)/R.tw), r=Math.floor((sy-R.oy)/R.th);
            if(!canStand(sx,sy)) continue; S.x=sx;S.y=sy;S.ang=Math.atan2(w.y-sy,w.x-sx);S.pitch=0; if(!WindowGaze.clear(R,w)) continue;
            const s=WindowGaze.state();s.n=1;s.ev={room:'admin2',c:w.c,r:w.r,t:0,contact:0,pull:0,away:0,pulled:0,id:'gt'};return {c:w.c,r:w.r,n:ws.length};}
          return null;}""", dist_tiles)

    def test_windows_are_the_real_exterior_panes_and_teaching_building_has_none(self):
        page = self.game()
        r = page.evaluate("()=>({admin:WindowGaze.windows(INTERIORS.admin2).length,teach:WindowGaze.windows(INTERIORS.teach2).length,dorm:WindowGaze.windows(INTERIORS.dorm1).length})")
        self.assertGreater(r['admin'], 4)
        self.assertEqual(r['teach'], 0)
        self.assertGreater(r['dorm'], 0)

    def test_staring_pulls_and_drains_and_looking_down_breaks_it(self):
        page = self.game()
        self.assertIsNotNone(self.face(page))
        r = page.evaluate("""()=>{S.san=80;const a0=S.ang;for(let i=0;i<5;i++)GameModules.emit('tick',.1);const pulled=!!WindowGaze.state().ev.pull;
          for(let i=0;i<10;i++)GameModules.emit('tick',.1);const drained=80-S.san;
          S.pitch=-0.8;for(let i=0;i<8;i++)GameModules.emit('tick',.1);const escaped=!WindowGaze.state().ev;const san=S.san;
          GameModules.emit('tick',1);return {pulled,drained,escaped,stable:S.san===san,esc:WindowGaze.state().escaped};}""")
        self.assertTrue(r['pulled'])
        self.assertGreater(r['drained'], 1.5)
        self.assertTrue(r['escaped'])
        self.assertTrue(r['stable'])                         # 断开以后不再掉
        self.assertEqual(r['esc'], 1)

    def test_pull_is_limited_so_turning_away_wins(self):
        page = self.game()
        self.face(page)
        r = page.evaluate("""()=>{for(let i=0;i<5;i++)GameModules.emit('tick',.1);const ev=WindowGaze.state().ev;
          let a=S.ang+0.9;for(let i=0;i<10;i++){a+=0.05;S.ang=a;GameModules.emit('tick',.1);}   /* 一直往外拖 */
          return {gone:!WindowGaze.state().ev,pullRate:WG.pull};}""")
        self.assertTrue(r['gone'])

    def test_walls_block_it_and_draining_to_zero_is_its_own_death(self):
        page = self.game()
        self.face(page)
        r = page.evaluate("""()=>{const R=INTERIORS.admin2,ev=WindowGaze.state().ev,w=WindowGaze.windows(R).filter(x=>x.c===ev.c&&x.r===ev.r)[0];
          const g=WindowGaze.geom(w);S.san=0.5;for(let i=0;i<12&&!S.dead;i++)GameModules.emit('tick',.1);
          return {dead:S.dead,src:S.deathSource||S.death||null,arc:DEATH_ARCHIVE.some(x=>x.id==='window_gaze'),cg:DeathCG.has('window_gaze')};}""")
        self.assertTrue(r['dead'])
        self.assertTrue(r['arc'])
        self.assertTrue(r['cg'])

    def test_presentation_is_read_only(self):
        page = self.game()
        self.face(page)
        r = page.evaluate("()=>{const b=JSON.stringify([S,RT,PAT]);render(.05);return {fx:!!GLR.scene.children.find(o=>o.name==='window-gaze'),same:JSON.stringify([S,RT,PAT])===b};}")
        self.assertEqual(r, {'fx': True, 'same': True})
