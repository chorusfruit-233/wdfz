"""异色空间（虚空迷宫）进出过场：进入 7 秒、离开 6 秒，可跳过，只收尾一次，不扣数值；CG 档案馆两张隐藏卡。

内部测试（计划《电梯直通、新天赋、新结局与恐怖氛围》第 2 节）；玩家 Wiki 不写这些内容。"""
from browser_case import BrowserCase

SETUP = """running=false;clearIntroTimers();S.intro=0;S.day=1;S.tsec=760;S.san=100;AN.active=false;AN.id=null;
  AN.next=1e5;patReset();PAT.next=1e5;RT.inspection=null;DEV.god=false;
  window.ride=function(host,floor){doEnterRoom(host+floor,Elevator.landing(host,floor));
    var r=Math.random;Math.random=function(){return 0;};Elevator.board(host,floor);Math.random=r;};
  window.toK=function(k){CUT.t=k*CUT.dur-0.016;cutTick(0.016);};
  window.atExit=function(id){var e=MAZE_CFG.exits.find(x=>x.id===id),w=VoidMaze.toWorld(e.x+e.n[0]*1.2,e.z+e.n[1]*1.2);
    S.x=w.x;S.y=w.y;S.floorY=e.h;S.ang=Math.atan2(-e.n[1],-e.n[0]);VoidMaze.MZ.air=false;};
  true;"""


class VoidCutTest(BrowserCase):
    def game(self):
        page = self.page()
        page.evaluate("localStorage.removeItem('wdfz3d_death_archive_v1');Game.start('hard');")
        page.wait_for_function("S.room==='teach1'&&GLR.roomMesh")
        page.evaluate(SETUP)
        return page

    def test_entering_plays_once_over_the_maze_without_drain_and_hands_back_at_the_spawn(self):
        page = self.game()
        r = page.evaluate("""()=>{ride('teach',3);S.san=80;CUT.enabled=true;Elevator.enterDream('67');
          const a={on:CUT.on,id:CUT.id,dur:CUT.dur,room:S.room,screen:S.screen,san:S.san,seen:!!DeathArchive.state().seen['cut:void_in']};
          for(let i=0;i<40;i++){toK(i/40);update(0.1);}                 // 过场里世界不走：迷宫不掉 SAN
          a.mid={san:S.san,t:VoidMaze.MZ.t,on:CUT.on,inv:document.getElementById('voidcutfx').style.opacity};
          toK(1);
          const sp=MAZE_CFG.spawn,p=VoidMaze.toScene(S.x,S.y);
          a.end={on:CUT.on,screen:S.screen,room:S.room,seen:DeathArchive.state().seen['cut:void_in'],
            inv:document.getElementById('voidcutfx').style.opacity,sub:document.getElementById('sub').innerText,
            free:Collision.depth(S.x,S.y,PRAD)<1e-7,inSpawn:Math.abs(p.x)<=4&&Math.abs(p.z)<=4,fy:S.floorY,
            yaw:Math.abs(Math.atan2(Math.sin(S.ang-Math.round(S.ang/(Math.PI/4))*(Math.PI/4)),1))<1e-6};
          return a;}""")
        self.assertTrue(r['on'])
        self.assertEqual((r['id'], r['dur'], r['room'], r['screen']), ('void_in', 7, 'lift_dream', 'cut'))
        self.assertEqual(r['san'], 75)                       # 按下那个键的 −5 照旧，过场本身不扣
        self.assertFalse(r['seen'])
        self.assertEqual(r['mid']['san'], 75)
        self.assertEqual(r['mid']['t'], 0)
        self.assertTrue(r['mid']['on'])
        e = r['end']
        self.assertFalse(e['on'])
        self.assertEqual((e['screen'], e['room'], e['seen'], e['inv'], e['fy']), ('play', 'lift_dream', 1, '0', 0))
        self.assertIn('方方正正的白色墙面', e['sub'])
        self.assertTrue(e['free'] and e['inSpawn'] and e['yaw'], e)
        # 读档：存档在迷宫里（进房间时存的），读出来直接在起点，不会重播
        r = page.evaluate("()=>{const ok=loadGame();return {ok,cut:CUT.on,room:S.room,screen:S.screen}}")
        self.assertEqual((r['cut'], r['room']), (False, 'lift_dream'))

    def test_skipping_the_entry_still_finishes_once(self):
        page = self.game()
        r = page.evaluate("""()=>{ride('lab',2);CUT.enabled=true;let said=0;const os0=window.os;
          Elevator.enterDream('89');toK(0.2);cutSkip();cutSkip();
          return {on:CUT.on,room:S.room,screen:S.screen,seen:DeathArchive.state().seen['cut:void_in'],
            sub:document.getElementById('sub').innerText,inv:document.getElementById('voidcutfx').style.opacity,grp:!!CUT.grp}}""")
        self.assertFalse(r['on'])
        self.assertEqual((r['room'], r['screen'], r['seen'], r['inv'], r['grp']), ('lift_dream', 'play', 1, '0', False))
        self.assertIn('方方正正的白色墙面', r['sub'])

    def test_leaving_switches_scene_once_at_the_white_and_turns_back_to_the_door(self):
        page = self.game()
        r = page.evaluate("""()=>{CUT.enabled=false;ride('teach',4);Elevator.enterDream('67');CUT.enabled=true;atExit('exit1');
          let n=0;const a0=Elevator.arrive;Elevator.arrive=function(){n++;return a0.apply(this,arguments);};
          const san=S.san;VoidMaze.leave('exit1');const out={on:CUT.on,id:CUT.id,dur:CUT.dur};
          toK(0.3);out.before={room:S.room,n};
          toK(0.5);out.after={room:S.room,n,ride:RT.elevatorRide};
          for(let k=0.52;k<1;k+=0.04)toK(k);toK(1);
          const R=INTERIORS[S.room],f=Elevator.frame(R),l=Elevator.local(R,S.x,S.y);
          out.end={on:CUT.on,n,room:S.room,screen:S.screen,san:S.san===san,a:l.a,b:l.b,
            facing:Math.cos(S.ang)*f.ox+Math.sin(S.ang)*f.oy,seen:DeathArchive.state().seen['cut:void_out'],
            free:Collision.depth(S.x,S.y,PRAD)<1e-7,sub:document.getElementById('sub').innerText};
          Elevator.arrive=a0;return out;}""")
        self.assertTrue(r['on'])
        self.assertEqual((r['id'], r['dur']), ('void_out', 6))
        self.assertEqual(r['before'], {'room': 'lift_dream', 'n': 0})
        self.assertEqual(r['after']['room'], 'teach4')
        self.assertEqual(r['after']['n'], 1)
        self.assertIsNone(r['after']['ride'])
        e = r['end']
        self.assertFalse(e['on'])
        self.assertEqual((e['n'], e['room'], e['screen'], e['seen']), (1, 'teach4', 'play', 1))
        self.assertTrue(e['san'] and e['free'])
        self.assertGreaterEqual(e['a'], 1.0)                 # 退到走廊里
        self.assertLess(e['facing'], -0.99)                  # 面朝电梯门
        self.assertIn('指示灯一格一格地暗下去', e['sub'])

    def test_skipping_the_exit_before_the_white_still_arrives_once(self):
        page = self.game()
        r = page.evaluate("""()=>{CUT.enabled=false;ride('teach',2);Elevator.enterDream('67');CUT.enabled=true;atExit('exit2');
          let n=0;const a0=Elevator.arrive;Elevator.arrive=function(){n++;return a0.apply(this,arguments);};
          VoidMaze.leave('exit2');toK(0.1);cutSkip();cutSkip();
          const R=INTERIORS[S.room],f=Elevator.frame(R);
          const out={n,room:S.room,on:CUT.on,ride:RT.elevatorRide,facing:Math.cos(S.ang)*f.ox+Math.sin(S.ang)*f.oy,
            seen:DeathArchive.state().seen['cut:void_out'],inv:document.getElementById('voidcutfx').style.opacity};
          Elevator.arrive=a0;return out;}""")
        self.assertEqual((r['n'], r['room'], r['on'], r['ride'], r['seen'], r['inv']), (1, 'lab2', False, None, 1, '0'))
        self.assertGreater(r['facing'], 0.99)               # 没回头就跳过：照旧背对电梯站着

    def test_with_cutscenes_off_nothing_is_marked_seen(self):
        page = self.game()
        r = page.evaluate("""()=>{ride('teach',3);CUT.enabled=false;Elevator.enterDream('67');atExit('exit1');VoidMaze.leave('exit1');
          return {room:S.room,seen:DeathArchive.state().seen}}""")
        self.assertEqual(r, {'room': 'teach3', 'seen': {}})

    def test_archive_cards_are_hidden_until_seen_and_replay_in_isolation(self):
        page = self.page()
        page.evaluate("""localStorage.setItem('wdfz3d_death_archive_v1',JSON.stringify({version:1,unlocked:{},first:{},count:{},migrated:1,seen:{'bogus':1}}));
          S.screen='menu';document.getElementById('menu').style.display='block';running=true;true;""")
        page.locator('#btnarchive').click()
        cards = "()=>[...document.querySelectorAll('#arcuts .arcard')].map(c=>c.dataset.id)"
        r = page.evaluate(cards)
        self.assertNotIn('cut:void_in', r)
        self.assertNotIn('cut:void_out', r)
        self.assertNotIn('不存在的那一层', page.evaluate("document.getElementById('archive').innerHTML"))
        self.assertEqual(page.evaluate("DeathArchive.state().seen"), {})      # 不认识的 ID 丢掉
        page.evaluate("DeathArchive.markSeen('cut:void_out');DeathArchive.markSeen('cut:opening');DeathArchive.paint();true;")
        r = page.evaluate(cards)
        self.assertIn('cut:void_out', r)
        self.assertNotIn('cut:void_in', r)
        r = page.evaluate("""()=>({meta:document.querySelector('#arcuts .arcard[data-id="cut:void_out"] small').textContent,
          head:document.getElementById('arCutCount').textContent,pub:ARCHIVE_CUTS.filter(e=>!e.secret).length})""")
        self.assertEqual(r['meta'], '已看过')
        self.assertTrue(r['head'].endswith(' · 隐藏 1'), r['head'])
        # 回放：迷宫做舞台，白场时换到教学楼二楼的电梯厅；不记新的「看过」、不写乘梯状态，结束回菜单
        page.locator('#arcuts .arcard[data-id="cut:void_out"] button').click()
        page.wait_for_function("ArchiveReplay.on&&CUT.on&&CUT.id==='void_out'", timeout=20000)
        self.assert_js(page, "S.room==='lift_dream'&&document.getElementById('arReplay').querySelector('i').textContent==='过场 · 回放'")
        page.evaluate("CUT.t=0.5*CUT.dur;true;")
        page.wait_for_function("S.room==='teach2'", timeout=5000)
        # Let real animation frames perform both transitions, without requiring three seconds
        # of simulation to fit a wall-clock deadline under concurrent software GPU rendering.
        page.evaluate("CUT.t=CUT.dur-0.01;true;")
        page.wait_for_function("!ArchiveReplay.on", timeout=5000)
        self.assert_js(page, "S.screen==='menu'&&!CUT.on&&RT.elevatorRide==null&&!DeathArchive.state().seen['cut:void_in']")
        # 「全部解锁」能打开进入那张
        page.evaluate("DeathArchive.unlockAll();true;")
        r = page.evaluate(cards)
        self.assertIn('cut:void_in', r)
        self.assertEqual(page.evaluate("document.querySelector('#arcuts .arcard[data-id=\"cut:void_in\"] small').textContent"), '直接解锁 · 没有亲历')
