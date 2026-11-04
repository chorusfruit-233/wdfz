"""虚空迷宫的彩蛋（内部内容，不进玩家 Wiki）：凝视虚空的反色、三处黑影、迷宫的环境声，以及可以整块拿掉。"""
import json
from pathlib import Path

from browser_case import BrowserCase

ROOT = Path(__file__).resolve().parents[1]
SETUP = """
window.events=[];GameModules.on('mazeEvent',function(e){events.push(e.kind+(e.id?':'+e.id:'')+(e.how?':'+e.how:''));},{owner:'probe'});
window.goMaze=function(){doEnterRoom('teach1',Elevator.landing('teach',1));var r=Math.random;Math.random=function(){return 0;};
  Elevator.board('teach',1);Math.random=r;Elevator.enterDream('67');};
window.at=function(x,z,fy,ang,pitch){var w=VoidMaze.toWorld(x,z);S.x=w.x;S.y=w.y;S.floorY=fy;VoidMaze.MZ.air=false;S.ang=ang;S.pitch=pitch||0;S.moving=false;};
window.run=function(sec){for(var i=0;i<Math.round(sec*60);i++){update(1/60);GameModules.emit('frame',1/60);}};
0;
"""


class VoidMazeEggsTest(BrowserCase):
    def game(self):
        page = self.page()
        page.evaluate("Game.start('hard')")
        page.wait_for_function("S.room==='teach1'&&GLR.roomMesh")
        page.evaluate("""running=false;clearIntroTimers();S.intro=0;S.tsec=760;S.san=100;AN.active=false;AN.id=null;AN.next=1e5;
          patReset();PAT.next=1e5;RT.inspection=null;S.seated=false;S.eyeH=EYE;DEV.god=true;""" + SETUP)
        page.evaluate('goMaze()')
        return page

    def test_staring_into_the_void_inverts_the_picture_once_and_shows_someone_below(self):
        page = self.game()
        r = page.evaluate("""()=>{at(-0.6,-15,0,Math.PI,-1.05);run(1.5);const early=events.length;
          const moving=0;                                                        // 走动时 S.moving 为真，计时清零（见 tickInvert）
          at(-0.6,-15,0,-Math.PI/2,-1.05);run(4);const floor=events.length;      // 低头看的是桥面：不算
          at(-0.6,-15,0,Math.PI,-1.05);run(3.4);
          const k=GLR.postMat.uniforms.uInvert.value, abyss=!!VoidEggFx.abyss, below=VoidEggFx.abyss&&VoidEggFx.abyss.position.y<0;
          run(1.5);
          return {early,moving,floor,ev:events.slice(),k,abyss,below,after:GLR.postMat.uniforms.uInvert.value,gone:!VoidEggFx.abyss,
            cool:VoidMazeEggs.E.cool,again:(run(5),events.filter(e=>e==='invert').length)};}""")
        self.assertEqual([r['early'], r['moving'], r['floor']], [0, 0, 0])
        self.assertEqual(r['ev'][:2], ['invert', 'invertEnd'])
        self.assertGreater(r['k'], 0.95)
        self.assertTrue(r['abyss'] and r['below'])
        self.assertEqual(r['after'], 0)
        self.assertTrue(r['gone'])
        self.assertGreater(r['cool'], 100)
        self.assertEqual(r['again'], 1)                                # 冷却期内不再触发
        # 「镜头晃动」关掉：反得浅一点
        r = page.evaluate("""()=>{SHAKE_ON=false;VoidMazeEggs.E.cool=0;at(-0.6,-15,0,Math.PI,-1.05);run(3.6);
          const k=GLR.postMat.uniforms.uInvert.value;SHAKE_ON=true;run(2);return k;}""")
        self.assertAlmostEqual(r, 0.8, places=2)

    def test_three_shadows_appear_where_you_look_and_vanish_when_watched(self):
        page = self.game()
        r = page.evaluate("""()=>{const san=S.san;
          at(-3.5,-17,0,Math.PI/2,0);run(1);const wrongWay=events.length;          // 朝向不对：不出现
          at(-3.5,-17,0,Math.PI,0);run(0.3);const shown=!!(VoidEggFx.shadow&&VoidEggFx.shadow.g);
          run(1.6);const hidden=events.slice();
          at(-3.5,-17,0,Math.PI,0);run(2);const once=events.filter(e=>e.startsWith('shadowShow:bridge')).length;
          at(13,1,8,-Math.PI/2,-0.2);run(2);
          at(-3,28.2,-8,Math.PI/2,0);run(0.4);const exitShown=!!VoidEggFx.shadow;
          at(-3,31.5,-8,Math.PI/2,0);S.ang=0;run(0.3);                            // 背过身走近：走到 5.2 米内也会消失
          return {wrongWay,shown,hidden,once,ev:events.slice(),exitShown,dead:S.dead,lost:san-S.san};}""")
        self.assertEqual(r['wrongWay'], 0)
        self.assertTrue(r['shown'])
        self.assertEqual(r['hidden'], ['shadowShow:bridge', 'shadowHide:bridge:look'])
        self.assertEqual(r['once'], 1)
        self.assertIn('shadowShow:tower', r['ev'])
        self.assertIn('shadowHide:tower:look', r['ev'])
        self.assertTrue(r['exitShown'])
        self.assertIn('shadowHide:exit:near', r['ev'])
        self.assertFalse(r['dead'])
        self.assertLess(r['lost'], 1)                                   # 只有迷宫本来的流失，黑影不扣 SAN
        # 离开迷宫：画面清干净，下一趟重新算
        r = page.evaluate("""()=>{at(-3.5,-17,0,Math.PI,0);VoidMazeEggs.E.seen={};run(0.3);const on=!!VoidEggFx.shadow;
          doExitRoom();return {on,after:!!VoidEggFx.shadow,inv:GLR.postMat.uniforms.uInvert.value,seen:Object.keys(VoidMazeEggs.E.seen).length};}""")
        self.assertEqual(r, {'on': True, 'after': False, 'inv': 0, 'seen': 0})

    def test_void_has_its_own_quiet_soundscape(self):
        page = self.game()
        r = page.evaluate("""()=>{const inside=SFX.scapeNow(), surf=SFX.surface();doExitRoom();const out=SFX.scapeNow();
          return {inside,surf,out,outSurf:SFX.surface(),cfg:VOID_SOUND_CFG.drone.map(d=>d[0])};}""")
        self.assertEqual(r['inside'], 'void')
        self.assertEqual(r['surf'], 'void')                             # 脚下是白色结构：空心的脚步声
        self.assertIsNone(r['out'])
        self.assertNotEqual(r['outSurf'], 'void')
        self.assertEqual(r['cfg'][:2], [36, 36.6])

    def test_eggs_module_can_be_removed_without_breaking_the_maze(self):
        context = self.browser.new_context(viewport={'width': 1000, 'height': 700})
        self.contexts.append(context)
        context.add_init_script("localStorage.setItem('wdfz_pro','1');localStorage.setItem('zw3d_set',JSON.stringify({q:0,amb:0,vol:0}));")
        src = (ROOT / 'game3d/manifest.js').read_text(encoding='utf-8')
        src = src.replace("].forEach(function(m){ GameModules.define(m); });",
                          "].filter(function(m){ return m.id!=='void-maze-eggs'; }).forEach(function(m){ GameModules.define(m); });")
        context.route('**/game3d/manifest.js', lambda route: route.fulfill(status=200, content_type='text/javascript', body=src))
        page = context.new_page()
        page.on('pageerror', lambda e: self.errors.append(str(e)))
        page.goto(self.url, wait_until='load')
        page.wait_for_function('Engine.ready()&&Assets.ready()', timeout=60000)   # 和 BrowserCase.page 一样等渲染器和模型包
        page.evaluate("PHOTO_TRIED=true;running=false;CUT.enabled=false;Game.start('hard')")
        page.wait_for_function("S.room==='teach1'")
        page.evaluate("running=false;clearIntroTimers();S.intro=0;AN.active=false;AN.next=1e5;PAT.next=1e5;RT.inspection=null;" + SETUP)
        r = page.evaluate("""()=>{goMaze();at(-0.6,-15,0,Math.PI,-1.05);run(4);
          return {room:S.room,eggs:typeof VoidMazeEggs,events:events.length,scape:SFX.scapeNow()};}""")
        self.assertEqual(r, {'room': 'lift_dream', 'eggs': 'undefined', 'events': 0, 'scape': 'void'})

    def test_wiki_keeps_the_eggs_secret(self):
        text = (ROOT / 'wiki/index.html').read_text(encoding='utf-8')
        for word in ('反色', '虚空迷宫', 'void-maze', 'lift_dream', 'mazeEvent'):
            self.assertNotIn(word, text)

    def test_new_structures_have_their_own_shadows(self):
        page = self.game()
        r = page.evaluate("""()=>{at(19,-36.5,4,Math.atan2(-27.6+36.5,16.5-19),0);run(0.3);const cw=events.slice(-1)[0];run(1.5);
          at(9.5,16,0,Math.atan2(31.5-16,20-9.5),0);run(0.3);const ph=events.slice(-1)[0];
          at(17.5,30,0,0,0);run(0.3);
          return {cw,ph,ev:events.slice()};}""")
        self.assertEqual(r['cw'], 'shadowShow:catwalk')
        self.assertIn('shadowHide:catwalk:look', r['ev'])
        self.assertEqual(r['ph'], 'shadowShow:pillars')
        self.assertIn('shadowHide:pillars:near', r['ev'])               # 走进柱林 6 米内就不见了

