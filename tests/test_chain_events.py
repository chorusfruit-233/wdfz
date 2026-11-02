"""《传送门建模、死亡CG档案室与速通模式》第 6 节：清华水杯前摇、连锁异象。
连锁异象按内部潜在彩蛋处理：只在内部测试里出现，不进玩家 Wiki。"""
from browser_case import BrowserCase


NIGHT_OUT = """S.tsec=1350;S.mode='out';S.room=null;S.x=560*SC;S.y=857*SC;S.san=100;S.dead=false;
  AN.active=false;AN.id=null;AN.data={};AN.next=1e6;PAT.state='idle';PAT.next=1e6;"""


class CupTimingTest(BrowserCase):
    def test_cup_wobble_is_shorter_and_keeps_the_difficulty_order(self):
        page = self.page()
        got = page.evaluate("""(()=>{let r={};['easy','hard'].forEach(function(df){
            S.diff=df;AN.data={};AN_DEFS.cup.place(AN.data);r[df]=AN.data.wob;});return r;})()""")
        self.assertEqual(got, {'easy': 0.85, 'hard': 0.40})
        self.assert_js(page, "CUP_WOB.normal===0.6&&cupFallTime()>1.4")

    def test_short_wobble_still_leaves_time_to_step_aside(self):
        """前摇短了，但「看到它掉」以后仍有约 1.5 秒真实下坠，侧移 1.6 米能躲开。"""
        page = self.page()
        page.evaluate("""S.diff='hard';S.x=560*SC;S.y=857*SC;S.san=100;AN.pre='cup';AN.locked=true;anStart();
            for(var i=0;i<40&&AN.data.phase<1;i++){ anTick(0.05); anfxUpdate(0.05); }""")
        self.assert_js(page, "AN.data.phase===1&&AN.t<0.5&&ANFX.cup.ring.visible")
        page.evaluate("S.y-=14;for(var i=0;i<120&&AN.active;i++){ anTick(0.05); anfxUpdate(0.05); }")
        self.assert_js(page, "!S.dead&&!AN.active")


class ColaChainTest(BrowserCase):
    def cup(self, page):
        page.evaluate("S.tsec=900;S.x=560*SC;S.y=857*SC;S.san=100;AN.pre='cup';AN.locked=true;anStart()")

    def run_until(self, page, cond, steps=600, dt=0.05):
        page.evaluate(f"""for(var i=0;i<{steps}&&!({cond});i++){{ anDrive({dt}); anfxUpdate({dt}); }}""")

    def test_only_a_real_cup_owes_one_cola_and_debug_does_not(self):
        page = self.page()
        page.evaluate("Dev.triggerAnomaly('cup');Dev.endActiveAnomaly()")
        self.assert_js(page, "!RT.colaPending")
        self.cup(page)
        self.assert_js(page, "RT.colaPending&&RT.colaPending.seq===1&&RT.colaPending.day===S.day")
        page.evaluate("anEnd();AN.pre='cup';AN.locked=true;anStart();anEnd()")
        self.assert_js(page, "RT.colaPending.seq===1&&RT.colaSeq===1")   # 只欠一罐
        self.assert_js(page, "!anAllowed('cola')&&pickAnomaly()!=='cola'")

    def test_daytime_and_indoors_keep_it_pending_until_a_safe_night_outdoors(self):
        page = self.page()
        self.cup(page)
        page.evaluate("anEnd();S.tsec=900;AN.next=1e6;PAT.next=1e6")
        self.run_until(page, 'AN.active', steps=200)
        self.assert_js(page, "!AN.active&&RT.colaPending")             # 白天不来
        page.evaluate("S.tsec=1350;doEnterRoom('teach1');running=false")
        self.run_until(page, 'AN.active', steps=200)
        self.assert_js(page, "!AN.active&&RT.colaPending")             # 夜里在楼里不来
        page.evaluate(NIGHT_OUT + "PAT.state='walk';PAT.room='out';PAT.x=S.x+35;PAT.y=S.y;PAT.locked=true;PAT.safety=0;PAT.transition=null;")
        self.run_until(page, 'AN.active', steps=200)
        self.assert_js(page, "!AN.active&&RT.colaPending")             # 本地实际追逐时先不来
        page.evaluate("PAT.state='idle'")
        self.run_until(page, 'AN.active', steps=200)
        self.assert_js(page, "AN.id==='cola'&&!RT.colaPending&&RT.colaDone===1&&ANFX.kind==='cola'")

    def test_cup_at_night_is_followed_by_cola_after_it_ends(self):
        page = self.page()
        page.evaluate(NIGHT_OUT + "AN.pre='cup';AN.locked=true;anStart()")
        self.assert_js(page, "AN.id==='cup'&&RT.colaPending")
        page.evaluate("""for(var i=0;i<40&&AN.data.phase<1;i++){ anTick(0.05); anfxUpdate(0.05); }
            S.y-=40;for(i=0;i<200&&AN.active;i++){ anTick(0.05); anfxUpdate(0.05); }""")
        self.assert_js(page, "!AN.active&&!S.dead")
        page.evaluate("AN.next=1e6")
        self.run_until(page, 'AN.active', steps=200)
        self.assert_js(page, "AN.id==='cola'&&AN.t<0.2")

    def test_cola_can_be_dodged_and_a_hit_only_costs_san(self):
        page = self.page()
        self.cup(page)
        page.evaluate("anEnd();" + NIGHT_OUT)
        self.run_until(page, 'AN.active', steps=200)
        self.run_until(page, 'AN.data.phase>=1', steps=100)
        self.assert_js(page, "AN.id==='cola'&&AN.data.phase===1&&ANFX.cola.core.visible")
        page.evaluate("S.y-=30")                                       # 约 3.5 米外：干净地躲开
        self.run_until(page, '!AN.active', steps=200)
        self.assert_js(page, "!S.dead&&S.san===100&&!RT.colaPending")
        # 擦着脚边落下：只吓一下、扣一点
        page.evaluate("RT.colaPending={seq:2,day:S.day,clock:0};" + NIGHT_OUT)
        self.run_until(page, 'AN.data&&AN.data.phase>=1', steps=300)
        page.evaluate("S.y-=14")
        self.run_until(page, '!AN.active', steps=200)
        self.assert_js(page, "!S.dead&&S.san<100&&S.san>=95")
        # 第二局：原地不动，砸中只扣 SAN
        page.evaluate("RT.colaPending={seq:3,day:S.day,clock:0};" + NIGHT_OUT)
        self.run_until(page, 'AN.data&&AN.data.phase===2', steps=300)
        self.assert_js(page, "AN.id==='cola'&&AN.data.hit===1&&!S.dead&&S.san<90&&S.san>80")

    def test_pending_and_running_cola_survive_save_without_repeating(self):
        page = self.page()
        self.cup(page)
        page.evaluate("anEnd();saveGame();RT.colaPending=null;applySave(loadGame())")
        self.assert_js(page, "RT.colaPending&&RT.colaPending.seq===1")
        page.evaluate(NIGHT_OUT)
        self.run_until(page, 'AN.active', steps=200)
        page.evaluate("anDrive(0.1);saveGame();anfxClear();Game.continue_();running=false")
        self.assert_js(page, "AN.id==='cola'&&!RT.colaPending&&RT.colaDone===1&&ANFX.kind==='cola'&&!!ANFX.cola")
        self.run_until(page, '!AN.active', steps=300)
        page.evaluate("AN.next=1e6")
        self.run_until(page, 'AN.active', steps=300)
        self.assert_js(page, "!AN.active")                               # 演过一次就不再来
        # 欠条号已演过（例如旧存档里残留），不会再开场
        page.evaluate("RT.colaPending={seq:1,day:S.day,clock:0}")
        self.run_until(page, 'AN.active', steps=200)
        self.assert_js(page, "!AN.active&&!RT.colaPending")

    def test_forecast_survives_the_cola(self):
        page = self.page()
        self.cup(page)
        page.evaluate("anEnd();" + NIGHT_OUT + "AN.pre='chalk';AN.locked=true;AN.next=30")
        self.run_until(page, 'AN.active', steps=200)
        self.assert_js(page, "AN.id==='cola'")
        page.evaluate("S.y-=40")
        self.run_until(page, '!AN.active', steps=300)
        self.assert_js(page, "AN.pre==='chalk'&&AN.locked&&AN.next>=12")
