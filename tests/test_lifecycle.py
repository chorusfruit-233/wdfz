"""会话退出、场景切换与渲染/模拟边界的回归。"""
import json
from pathlib import Path
import subprocess
import unittest
from browser_case import BrowserCase


class ScopeRulesTest(unittest.TestCase):
    def test_scope_cancellation_disposes_resources_and_rejects_stale_callbacks(self):
        source = Path(__file__).resolve().parents[1] / 'game3d/js/app/lifecycle.js'
        result = subprocess.run(['node', '-e', """
          const vm=require('vm'),fs=require('fs'),assert=require('assert');
          const c={setTimeout,clearTimeout};vm.createContext(c);
          vm.runInContext(fs.readFileSync(process.argv[1],'utf8'),c);
          let queued=[],cleared=[],calls=[];
          const timer={setTimeout(fn){queued.push(fn);return queued.length;},clearTimeout(id){cleared.push(id);}};
          let scope=c.LifecycleCore.scope('test',timer);
          scope.timeout(()=>calls.push('timeout'),20);
          const old=scope.guard(()=>calls.push('callback'));
          scope.own(()=>calls.push('dispose'));
          scope.cancel();scope.cancel();queued[0]();old();
          assert.deepStrictEqual(calls,['dispose']);assert.deepStrictEqual(cleared,[1]);
          assert.equal(scope.size(),0);assert.equal(scope.timeout(()=>{},2),null);
          scope.own(()=>calls.push('late-dispose'));
          assert.deepStrictEqual(calls,['dispose','late-dispose']);
          let live=c.LifecycleCore.scope('live',timer);live.timeout(()=>calls.push('live'),2);queued[1]();
          assert.equal(live.size(),0);live.cancel();assert.deepStrictEqual(cleared,[1]);
          console.log(JSON.stringify({ok:true}));
        """, str(source)], capture_output=True, text=True, check=True)
        self.assertTrue(json.loads(result.stdout)['ok'])


class SessionLifecycleTest(BrowserCase):
    def test_rendering_forecast_does_not_mark_first_notice(self):
        page=self.page()
        page.evaluate("S.diff='easy';S.tsec=760;AN.id=null;AN.active=false;AN.pre='rain';AN.next=5;AN.preNext=999;delete RT.preTold;PAT.next=999;render(.1);render(.1)")
        self.assert_js(page,"ANW.on&&!RT.preTold")
        page.evaluate('update(.01)')
        self.assert_js(page,'RT.preTold===1')

    def test_late_dialogue_and_skip_card_do_not_leak_into_new_session(self):
        page=self.page()
        page.evaluate("window.lateMessages=[];window.originalOs=os;os=function(m){lateMessages.push(m)};os2later('旧局留言',80);timeSkipCard(5,'休息',700);freshState('hard');running=false")
        page.wait_for_timeout(150)
        self.assert_js(page,"lateMessages.indexOf('旧局留言')===-1&&!document.getElementById('skip').classList.contains('on')")
        page.evaluate('os=originalOs')

    def test_quitting_cancels_computer_without_awarding_score(self):
        page=self.page()
        page.evaluate("PCGAME.start();PC.score=5;S.san=30;Game.quit();running=false")
        self.assert_js(page,"!PC.on&&S.san===30&&document.getElementById('pcgame').style.display==='none'")
        page.evaluate("PCGAME.start();freshState('hard');running=false")
        self.assert_js(page,"!PC.on&&S.san===100")

    def test_restart_cancels_death_flash_and_old_death_result(self):
        page=self.page()
        page.evaluate("S.talent='code';S.bag=[];S.diff='hard';kill('旧局','vignette');window.oldFinish=DEATH_PENDING.finish;freshState('hard');running=false;oldFinish()")
        self.assert_js(page,"!S.dead&&!DEATH_PENDING&&document.getElementById('flash').style.opacity==='0'&&document.getElementById('die').style.display==='none'")

    def test_render_does_not_tick_computer_or_intro_but_application_step_does(self):
        page=self.page()
        result=page.evaluate("""()=>{
          PCGAME.start();S.intro=3;PAUSE.on=true;
          render(.25);let rendered=PC.cd===3&&S.intro===3;
          update(.25);return {rendered,computer:PC.cd,intro:S.intro};
        }""")
        self.assertEqual(result,dict(rendered=True,computer=2.75,intro=2.75))

    def test_pending_room_transition_cannot_reenter_after_quit(self):
        page=self.page()
        page.evaluate("doEnterRoom('teach1');enterRoom('lab1');Game.quit();running=false")
        page.wait_for_timeout(260)
        self.assert_js(page,"S.screen==='menu'&&S.room!=='lab1'&&document.getElementById('fade').style.opacity==='0'")
        self.assert_js(page,"Lifecycle.snapshot().errors.length===0")

    def test_direct_scene_change_cancels_old_fade_destination(self):
        page=self.page()
        page.evaluate("doEnterRoom('teach1');enterRoom('lab1');doEnterRoom('dorm1')")
        page.wait_for_timeout(260)
        self.assert_js(page,"S.room==='dorm1'")

    def test_delayed_first_prologue_is_cancelled_when_leaving_new_game(self):
        page=self.page()
        page.evaluate("localStorage.removeItem('wdfz_pro');Game.start('hard');Game.quit();running=false")
        page.wait_for_timeout(450)
        self.assert_js(page,"!PRO.on&&S.screen==='menu'&&!document.body.classList.contains('pro')")

    def test_old_eyelid_callback_cannot_write_after_fresh_state(self):
        page=self.page()
        page.evaluate("window.oldWake=0;eyelid(20,()=>oldWake++,()=>oldWake++);freshState('hard');running=false")
        page.wait_for_timeout(750)
        self.assert_js(page,"oldWake===0&&document.getElementById('lidtop').style.height==='0px'")
        self.assert_js(page,"Lifecycle.snapshot().errors.length===0")

    def test_wall_repair_runs_only_during_simulation(self):
        page=self.page()
        result=page.evaluate("""()=>{
          doEnterRoom('teach1');S.seated=false;S.intro=0;S.stuckT=0;
          const R=INTERIORS.teach1;S.x=R.ox+R.tw*.5;S.y=R.oy+R.th*.5;
          const before={x:S.x,y:S.y};render(.6);
          let rendered=S.x===before.x&&S.y===before.y;
          PAUSE.on=true;update(.6);let paused=S.x===before.x&&S.y===before.y;
          PAUSE.on=false;update(.6);
          return {rendered,paused,repaired:!solidAt(S.x,S.y)};
        }""")
        self.assertEqual(result,dict(rendered=True,paused=True,repaired=True))
