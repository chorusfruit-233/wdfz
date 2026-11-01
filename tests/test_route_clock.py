"""时间精度、交互锁存与死亡路线回归。"""
from browser_case import BrowserCase


class RouteClockTest(BrowserCase):
    def test_hidden_window_boundaries_and_saved_dialogue(self):
        page = self.page()
        result = page.evaluate("""() => {
          let values=[705+13.999/60,705+14/60,705+14.999/60,705+15/60];
          let valid=values.map(t=>{S.tsec=t;return inBeastWindow()});
          let R=INTERIORS.teach1;S.mode='in';S.room='teach1';
          S.x=R.ox+59.5*9;S.y=R.oy+17.5*9;S.tsec=BEAST_T0;S.bag=['chalk'];S.bagSel=0;
          RT.beastDrop=false;dropSelected();let saved=loadGame();
          freshState('hard');running=false;applySave(saved);S.tsec=BEAST_SLOW_T1+1;
          useStall();return {valid,retained:RT.beastDrop,bag:hasItem('chalk'),choice:UI.chooseOpen,end:RT.end};
        }""")
        self.assertEqual(result['valid'], [False, True, True, False])
        self.assertTrue(result['retained'])
        self.assertFalse(result['bag'])
        self.assertTrue(result['choice'])
        self.assertFalse(result['end'])

    def test_clock_visibility_and_ordinary_skip_card(self):
        page = self.page()
        result = page.evaluate("""() => {
          let out=[];
          for(let watch of [false,true])for(let talent of ['code','watch']){
            S.bag=watch?['watch']:[];S.talent=talent;S.tsec=BEAST_T0;updateHUD();timeSkipCard(5,'休息',S.tsec);
            out.push({clock:document.getElementById('clock').textContent,
              seconds:document.getElementById('secclock').hidden,
              card:document.querySelector('#skip i').textContent});
          }return out;
        }""")
        self.assertEqual(result[0]['clock'], '时间不明')
        self.assertNotRegex(result[0]['card'], r'\d{1,2}:\d{2}')
        for entry in result[1:]:
            self.assertEqual(entry['clock'], '11:45')
            self.assertEqual(entry['card'], '11:45')
        self.assertTrue(all(entry['seconds'] for entry in result))

    def test_clock_crossing_is_step_independent(self):
        page = self.page()
        result = page.evaluate("""() => {
          S.tsec=BEAST_SLOW_T0-.01;let start=S.tsec;
          clockTick(12);let whole=S.tsec;S.tsec=start;
          for(let i=0;i<120;i++)clockTick(.1);
          return Math.abs(S.tsec-whole);
        }""")
        self.assertLess(result, 1e-7)

    def test_hidden_window_survives_pause_and_next_day(self):
        """暂停时钟不走；第二天同一时刻窗口照样有效；跨越窗口的大步长不会跳过判定边界。"""
        page = self.page()
        result = page.evaluate("""() => {
          S.tsec=BEAST_T0-0.002;PAUSE.on=true;update(5);const paused=S.tsec===BEAST_T0-0.002;PAUSE.on=false;
          S.day=2;S.tsec=BEAST_T0;const day2=inBeastWindow();
          // 一步跨过整个慢速段：落点在慢速段之后，且慢速段按真实秒计
          S.tsec=BEAST_SLOW_T0-0.01;clockTick(30);const after=S.tsec>BEAST_SLOW_T1;
          return {paused,day2,after};
        }""")
        self.assertEqual(result, {'paused': True, 'day2': True, 'after': True})

    def test_game_text_never_hints_the_hidden_time(self):
        """游戏里的字（字幕、提示、物品说明、笔记、课桌小任务）不出现隐藏时刻或「几秒」的提示。"""
        import re
        from pathlib import Path
        root = Path(__file__).resolve().parents[1] / 'game3d/js'
        bad = []
        pattern = re.compile(r"11\s*[:：点]\s*45|45\s*[:：分]\s*14|十一点四十五|四十五分十四")
        for path in sorted(root.rglob('*.js')):
            if 'lib' in path.parts or path.name.startswith('models_'):
                continue
            for lineno, line in enumerate(path.read_text(encoding='utf-8').splitlines(), 1):
                code = re.sub(r'/\*.*?\*/', '', line)
                code = code.split('//')[0] if '://' not in code else code
                for literal in re.findall(r"'([^'\\]*(?:\\.[^'\\]*)*)'", code):
                    if pattern.search(literal):
                        bad.append(f'{path.name}:{lineno}')
        self.assertEqual(bad, [])

    def test_no_seconds_anywhere_on_screen_with_any_clock_source(self):
        """有表、有天赋、两者都有，在慢速段里屏幕上都只显示到分钟。"""
        page = self.page()
        result = page.evaluate("""() => {
          const out=[];
          for(const bag of [[],['watch']])for(const talent of ['code','watch']){
            S.bag=bag;S.talent=talent;S.tsec=BEAST_T0+0.3/60;updateHUD();
            const txt=document.getElementById('hud').innerText;
            out.push(/\\d{1,2}:\\d{2}:\\d{2}/.test(txt)||/\\d+\\s*秒/.test(txt));
          }
          return out;
        }""")
        self.assertEqual(result, [False, False, False, False])
