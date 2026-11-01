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
