"""粉笔记号：在面前的墙上 / 脚前的地上画 X、↑、O 等，存档保留，可以擦掉；校园、楼里、虚空迷宫都能画。"""
from browser_case import BrowserCase


class ChalkMarksTest(BrowserCase):
    def game(self):
        page = self.page()
        page.evaluate("Game.start('hard')")
        page.wait_for_function("S.room==='teach1'&&GLR.roomMesh")
        page.evaluate("""running=false;clearIntroTimers();S.intro=0;S.tsec=760;AN.active=false;AN.id=null;AN.next=1e5;
          patReset();PAT.next=1e5;RT.inspection=null;S.seated=false;S.eyeH=EYE;if(!hasItem('chalk'))S.bag.push('chalk');
          window.corridor=function(){const R=INTERIORS.teach1;doEnterRoom('teach1',{x:R.ox+25.5*9,y:R.oy+20.2*9,ang:Math.PI/2});S.pitch=0;S.seated=false;};0""")
        return page

    def pick(self, page, label):
        page.locator('#choices button').filter(has_text=label).click()

    def test_draw_on_wall_and_floor_then_erase(self):
        page = self.game()
        page.evaluate('corridor();useItem("chalk")')
        labels = page.locator('#choices button').all_inner_texts()
        for sym in ('X', '↑', 'O', '←', '→', '△', '?'):
            self.assertTrue(any('画「' + sym + '」' in t for t in labels), sym)
        self.assertIn('在墙上画什么', page.locator('#choices').inner_text())
        self.pick(page, '画「X」')
        wall = page.evaluate('ChalkMarks.all()[0]')
        self.assertEqual((wall['face'], wall['s'], wall['room']), ('wall', 'x', 'teach1'))
        self.assertAlmostEqual(wall['a'], -1.5708, places=3)       # 南墙，法线朝北
        self.assertTrue(0.35 <= wall['h'] <= 2.3)
        page.evaluate('S.pitch=-0.9;S.ang=Math.PI/2+0.5;useItem("chalk")')
        self.assertIn('在地上画什么', page.locator('#choices').inner_text())
        self.pick(page, '画「↑」')
        r = page.evaluate("""()=>({n:ChalkMarks.count(), fx:ChalkFx.count(), floor:ChalkMarks.all()[1],
          free:!solidAt(ChalkMarks.all()[1].x,ChalkMarks.all()[1].y), sub:document.getElementById('sub').innerText})""")
        self.assertEqual((r['n'], r['fx']), (2, 2))
        self.assertEqual((r['floor']['face'], r['floor']['s'], r['floor']['h']), ('floor', 'up', 0))
        self.assertTrue(r['free'])
        self.assertIn('在地上画了个「↑」', r['sub'])
        # 对着同一处再用：多了「擦掉」
        page.evaluate('S.pitch=0;S.ang=Math.PI/2;useItem("chalk")')
        self.pick(page, '擦掉这里的「X」')
        self.assert_js(page, "ChalkMarks.count()===1&&ChalkMarks.all()[0].s==='up'&&ChalkFx.count()===1")

    def test_marks_survive_save_load_and_room_changes(self):
        page = self.game()
        page.evaluate('corridor();useItem("chalk")')
        self.pick(page, '画「O」')
        r = page.evaluate("""()=>{doExitRoom();const out=ChalkFx.count();doEnterRoom('teach1');const back=ChalkFx.count();
          saveGame();const d=loadGame();freshState('hard');running=false;const fresh=ChalkMarks.count();applySave(d);
          return {out, back, fresh, loaded:ChalkMarks.count(), saved:d.mods['chalk-marks'].marks.map(m=>m.s)}}""")
        self.assertEqual(r, {'out': 0, 'back': 1, 'fresh': 0, 'loaded': 1, 'saved': ['o']})
        # 读坏的存档字段被丢掉，不报错
        r = page.evaluate("""()=>{const d=loadGame();d.mods['chalk-marks'].marks.push({s:'zzz',x:1,y:2,h:0,a:0,face:'floor',room:null},null,{s:'x',x:NaN});
          freshState('hard');running=false;applySave(d);return ChalkMarks.count()}""")
        self.assertEqual(r, 1)

    def test_outdoors_and_nothing_to_draw_on(self):
        page = self.game()
        r = page.evaluate("""()=>{doExitRoom();const o=objById('teach');S.x=(o.x+o.w/2)*SC;S.y=(o.y+o.h)*SC+8;S.ang=-Math.PI/2;S.pitch=0;
          const wall=ChalkMarks.target();
          const f=objById('field');S.x=(f.x+f.w/2)*SC;S.y=(f.y+f.h/2)*SC;S.ang=0;const none=ChalkMarks.target();
          S.pitch=-0.8;const ground=ChalkMarks.target();
          return {wall:wall&&wall.face, room:wall&&wall.room, none, ground:ground&&ground.face}}""")
        self.assertEqual(r, {'wall': 'wall', 'room': None, 'none': None, 'ground': 'floor'})
        page.evaluate('S.pitch=0;useItem("chalk")')                 # 操场中间平视：面前没有墙
        self.assertFalse(page.evaluate('UI.chooseOpen'))
        self.assertIn('够不着能画的地方', page.locator('#sub').inner_text())

    def test_in_the_void_maze_floor_wall_and_void(self):
        page = self.game()
        r = page.evaluate("""()=>{doEnterRoom('teach1',Elevator.landing('teach',1));const m=Math.random;Math.random=()=>0;
          Elevator.board('teach',1);Math.random=m;Elevator.enterDream('67');
          let w=VoidMaze.toWorld(0,-15);S.x=w.x;S.y=w.y;S.floorY=0;VoidMaze.MZ.air=false;S.ang=Math.PI;S.pitch=-0.9;
          const over=ChalkMarks.target();
          S.ang=-Math.PI/2;const bridge=ChalkMarks.target();
          w=VoidMaze.toWorld(13,-9);S.x=w.x;S.y=w.y;S.floorY=5.5;S.ang=-Math.PI/2;S.pitch=0;const tower=ChalkMarks.target();
          return {over, bridge:bridge&&[bridge.face,bridge.h], tower:tower&&[tower.face,tower.floor]}}""")
        self.assertEqual(r['over'], {'face': 'void'})
        self.assertEqual(r['bridge'], ['floor', 0])
        self.assertEqual(r['tower'], ['wall', 5.5])
        page.evaluate("""()=>{let w=VoidMaze.toWorld(0,-15);S.x=w.x;S.y=w.y;S.floorY=0;S.ang=Math.PI;S.pitch=-0.9;useItem('chalk');}""")
        self.assertIn('什么都没有', page.locator('#sub').inner_text())
        page.evaluate("""()=>{let w=VoidMaze.toWorld(13,-9);S.x=w.x;S.y=w.y;S.floorY=5.5;S.ang=-Math.PI/2;S.pitch=0;useItem('chalk');}""")
        self.pick(page, '画「→」')
        r = page.evaluate("""()=>{const m=ChalkMarks.all()[0], mesh=ChalkFx.g.children.find(c=>c.material.opacity>0.9);
          return {room:m.room, f:m.f, y:mesh.position.y, n:ChalkFx.count()}}""")
        self.assertEqual(r['room'], 'lift_dream')
        self.assertEqual(r['f'], 5.5)
        self.assertGreater(r['y'], 5.5)                            # 画在 5.5 米高的平台那一层的墙上
        self.assertEqual(r['n'], 12)                               # 自己画的 1 个 + 迷宫里原有的 11 个旧记号

    def test_limits_keep_saves_small(self):
        page = self.game()
        r = page.evaluate("""()=>{corridor();const t=ChalkMarks.target();
          for(let i=0;i<CHALK_CFG.perRoom+5;i++)ChalkMarks.place('x',Object.assign({},t,{x:t.x+i*0.01}));
          return {n:ChalkMarks.count(), size:JSON.stringify(GameModules.saveAll()['chalk-marks']).length}}""")
        self.assertEqual(r['n'], 80)
        self.assertLess(r['size'], 12000)
