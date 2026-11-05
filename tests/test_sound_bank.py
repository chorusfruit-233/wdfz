"""全部音效重做（2026-11-02）：声音库配方、调用点、按类别校准的响度、每次播放的随机变化、上下课铃、
脚下材质钩子、试听面板，以及以前调用了却不存在的 SFX.chalk / SFX.deep / SFX.stopDeath。"""
import math
import re
from pathlib import Path

from browser_case import BrowserCase

ROOT = Path(__file__).resolve().parents[1]
SPY = """window.played=[];(function(){const p=SoundPlayer.play;SoundPlayer.play=function(id,o){played.push([id,o||{}]);return p.apply(this,arguments);};})();0;"""


class SoundBankTest(BrowserCase):
    def game(self, start=False):
        page = self.page()
        if start:
            page.evaluate("Game.start('hard')")
            page.wait_for_function("S.room==='teach1'")
            page.evaluate("""running=false;clearIntroTimers();S.intro=0;AN.active=false;AN.id=null;AN.next=1e5;
              patReset();PAT.next=1e5;RT.inspection=null;S.dead=false;""")
        page.evaluate(SPY)
        return page

    def test_recipes_are_valid_and_every_call_site_has_a_sound(self):
        page = self.game()
        r = page.evaluate("""()=>({bad:SoundPlayer.validate(), ids:SoundPlayer.ids(), sfx:Object.keys(SFX),
          an:AN_ID.slice(), dfx:Object.values(DFX_MAP).filter(Boolean), kinds:SFX.deathKinds(),
          cats:Object.keys(SOUND_CATS), used:SoundPlayer.ids().map(id=>SoundPlayer.cat(id))})""")
        self.assertEqual(r['bad'], [])
        ids = set(r['ids'])
        self.assertGreaterEqual(len(ids), 120)
        src = {p: p.read_text(encoding='utf-8') for p in (ROOT / 'game3d/js').rglob('*.js')}
        # 代码里写死的音效名都在声音库里
        literal = set()
        for text in src.values():
            literal |= set(re.findall(r"(?:SoundPlayer\.play|\bP)\('([a-z]+\.[A-Za-z0-9]+)'", text))
        self.assertTrue(literal)
        self.assertEqual(sorted(literal - ids), [])
        # 拼出来的名字：每种异象、每种死因、每种假威胁、每种脚下材质都有
        self.assertEqual([a for a in r['an'] if 'anomaly.' + a not in ids], [])
        self.assertEqual(sorted({d for d in r['dfx'] if 'death.' + d not in ids}), [])
        for kind in ('knock', 'steps', 'chair', 'whisper', 'door', 'call', 'run', 'desk', 'radio'):
            self.assertIn('dread.' + kind, ids)
        for sf in ('tile', 'stair', 'garage', 'roof', 'grass', 'track', 'court', 'road', 'void', 'wet', 'squeak'):
            self.assertIn('step.' + sf, ids)
        self.assertEqual(len(r['kinds']), 33)                     # 28 种 + 虚空迷宫的迷失、坠落 + 电梯门（没关上的门）+ 满员（内部）+ 念错了
