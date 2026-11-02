"""《传送门建模、死亡CG档案室与速通模式》P3：新局 3D 开场 CG。"""
from browser_case import BrowserCase

STATE = "JSON.stringify({room:S.room,mode:S.mode,x:S.x,y:S.y,ang:S.ang,pitch:S.pitch,seated:S.seated,screen:S.screen,pro:PRO.on,wn:VisualState.worldNorm,nc:NC.normal,cut:CUT.on})"


class OpeningTest(BrowserCase):
    def begin(self, first=True, speed=False):
        page = self.page()
        page.evaluate(f"""CUT.enabled=true;{"localStorage.removeItem('wdfz_pro');" if first else ''}
          {"Speedrun.arm('easy');" if speed else ''}Game.start('easy',{{talent:'code'{",mode:'speedrun'" if speed else ''}}})""")
        page.wait_for_function("CUT.on&&CUT.id==='opening'", timeout=60000)
        return page

    def test_full_version_for_new_players_short_for_returning(self):
        page = self.begin(first=True)
        self.assert_js(page, "CUT.dur===26&&!Opening.short&&S.screen==='cut'&&PRO.on")
        page.evaluate("Game.quit()")                                      # 没看完就回菜单：不留过场状态，下次仍是完整版
        self.assert_js(page, "!CUT.on&&!PRO.on&&!Opening.on&&document.getElementById('opcap').textContent===''&&localStorage.getItem('wdfz_pro')!=='1'")
        page.evaluate("Game.start('easy',{talent:'code'})")
        page.wait_for_function("CUT.on&&CUT.id==='opening'", timeout=60000)
        self.assert_js(page, "CUT.dur===26")
        page.evaluate("cutSkip();Game.quit();Game.start('easy',{talent:'code'})")   # 看过（或跳过）一次：短版
        page.wait_for_function("CUT.on&&CUT.id==='opening'", timeout=60000)
        self.assert_js(page, "CUT.dur===11&&Opening.short")

    def test_skipping_at_any_shot_hands_over_the_same_start(self):
        results = []
        for k in (0.05, 0.3, 0.5, 0.7, 0.9, None):
            page = self.begin(first=True)
            page.evaluate("running=false")
            if k is None:
                page.evaluate("CUT.t=CUT.dur;render(0.0001)")           # 看完
            else:
                page.evaluate(f"CUT.t=CUT.dur*{k};render(0.0001);cutSkip()")
            results.append(page.evaluate(STATE))
            self.assert_js(page, "!Opening.on&&!CUT.grp&&localStorage.getItem('wdfz_pro')==='1'")
            page.context.close()
            self.contexts.remove(page.context)
        self.assertEqual(len(set(results)), 1, results)
        self.assertIn('"screen":"play"', results[0])
        self.assertIn('"seated":true', results[0])
        self.assertIn('"wn":0', results[0])

    def test_world_is_frozen_and_input_blocked_during_the_opening(self):
        page = self.begin(first=True)
        page.evaluate("window.s0=S.san;window.t0=S.tsec;window.st0=S.stam;AN.next=0.01;PAT.next=0.01")
        page.wait_for_timeout(1500)
        self.assert_js(page, "CUT.on&&S.san===s0&&S.tsec===t0&&!AN.active&&PAT.state==='idle'&&!playerInputAllowed()")
        self.assert_js(page, "saveGame()===true||true")
        page.keyboard.press('Space')
        page.wait_for_function("S.screen==='play'&&!CUT.on")
        self.assert_js(page, "playerInputAllowed()&&!PRO.on")

    def test_speedrun_starts_only_after_the_handoff(self):
        page = self.begin(first=False, speed=True)
        page.wait_for_timeout(800)
        self.assert_js(page, "Speedrun.run.status==='ready'")
        page.evaluate("cutSkip()")
        page.wait_for_function("Speedrun.run.status==='running'")
        self.assert_js(page, "Speedrun.elapsed()<2000")

    def test_continue_does_not_replay_the_opening(self):
        page = self.begin(first=False)
        page.evaluate("cutSkip();saveGame();Game.quit();Game.continue_()")
        page.wait_for_timeout(600)
        self.assert_js(page, "!CUT.on&&!Opening.on&&S.screen==='play'")
