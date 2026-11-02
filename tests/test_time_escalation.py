"""留校越久越危险：真实规则接口、跨日持久化和玩家可见反馈。"""
from pathlib import Path
import shutil
import subprocess
import unittest

from browser_case import BrowserCase

ROOT = Path(__file__).resolve().parents[1]


class EscalationCurveTest(unittest.TestCase):
    def test_clock_curve_is_continuous_monotonic_capped_and_step_independent(self):
        node = shutil.which('node')
        if not node:
            self.skipTest('需要 Node.js')
        script = r"""
const fs=require('fs'),vm=require('vm'),a=require('assert/strict');
const c={console,Math,Number,os:()=>{},setTimeout:()=>{},RT:{},
  S:{screen:'play',tsec:700,day:1,mode:'out'}};
vm.createContext(c);
for(const f of ['core','domain/player-stats','domain/game-time','systems','campus-pressure'])
  vm.runInContext(fs.readFileSync('game3d/js/'+f+'.js','utf8'),c);
function at(clock){c.RT={pressureClock:clock};c.S.day=1;c.S.tsec=700;return c.CampusPressure.current();}
for(const clock of [700,850,1090]){
  const p=at(clock);for(const key of ['anomaly','danger','passive','rest'])a.equal(p[key],1);
}
let previous=at(1090);
for(let clock=1091;clock<=10000;clock++){
  const p=at(clock);a.ok(p.danger>=previous.danger);
  for(const key of ['anomaly','passive','rest'])a.ok(p[key]<=previous[key]&&p[key]>0);
  a.ok(p.danger-previous.danger<.01);previous=p;
}
const second=at(1350);a.equal(second.stage,2);
a.ok(second.anomaly<=.6&&second.danger>=1.6&&second.passive<=.5);
for(const boundary of [1090,1350,2790,4230,5670]){
  const left=at(boundary-.001),right=at(boundary+.001);
  for(const key of ['anomaly','danger','passive','rest'])a.ok(Math.abs(left[key]-right[key])<.0001);
}
for(const key of ['anomaly','danger','passive','rest'])a.equal(at(5670)[key],at(1e9)[key]);
// 既有 20 分钟自然日不改；大步跳时与逐帧到达同一时刻得到同样的压力。
let snapshots=[];
for(const step of [.25,13.7,1200]){
  c.RT={};c.S.day=1;c.S.tsec=440;let rest=2400;
  while(rest>1e-8){const dt=Math.min(step,rest);c.clockTick(dt);rest-=dt;}
  a.equal(c.S.day,3);a.ok(Math.abs(c.S.tsec-440)<1e-6);
  snapshots.push(c.CampusPressure.current());
}
for(const p of snapshots)for(const key of ['clock','anomaly','danger','passive'])
  a.ok(Math.abs(p[key]-snapshots[0][key])<1e-6);
c.RT={};c.S.day=1;c.S.tsec=1349;c.advanceGameTime(1);a.equal(c.S.day,2);
const night=c.CampusPressure.current();c.advanceGameTime(150);
a.equal(c.S.tsec,440);a.equal(c.S.day,2);a.ok(c.CampusPressure.current().danger>night.danger);
"""
        subprocess.run([node, '-e', script], cwd=ROOT, check=True, timeout=30)


class EscalationBrowserTest(BrowserCase):
    def test_scheduled_intervals_shrink_but_warning_and_chase_windows_survive(self):
        page = self.page()
        result = page.evaluate("""()=>{
          RT=newRT();S.day=1;S.tsec=700;S.diff='easy';S.san=100;S.viol=0;
          S.mode='in';S.room='teach1';AN.lastBig=false;
          const random=Math.random;Math.random=()=>.5;
          const base=[anInterval(),PAT_SPEED,PAT_CHASE];
          AN.pre='rain';AN.next=8;AN.preNext=27;AN.locked=true;
          patReset();PAT.warning=3.6;PAT.blinkCD=.75;PAT.afterBlink=.22;
          S.day=2;S.tsec=1350;
          const day2=[anInterval(),PAT_SPEED,PAT_CHASE];
          S.day=6;S.tsec=800;S.san=0;S.viol=100;S.diff='hard';S.room='admin5';
          const floor=[anInterval(),PAT_SPEED,PAT_CHASE];Math.random=random;
          return {base,day2,floor,an:[AN.next,AN.preNext,AN.pre,AN.locked],
            pat:[PAT.state,PAT.warning,PAT.blinkCD,PAT.afterBlink]};
        }""")
        self.assertEqual(result['base'], [52, 16, 31])
        self.assertAlmostEqual(result['day2'][0] / result['base'][0], .55)
        self.assertEqual(result['day2'][1:], [16, 31])
        self.assertEqual(result['floor'], [10, 16, 31])
        self.assertEqual(result['an'], [8, 27, 'rain', True])
        self.assertEqual(result['pat'], ['walk', 3.6, .75, .22])

    def test_danger_grows_and_passive_recovery_shrinks_without_nerfing_pills_or_talent(self):
        page = self.page()
        result = page.evaluate("""()=>{
          RT=newRT();S.day=1;S.tsec=700;S.san=20;S.pillT=0;
          AN.active=false;PAT.state='idle';PAT.locked=false;HIDE.on=false;
          sanTick(10,NEED_RULE['自由'],false);const firstRecovery=S.san-20;
          S.day=2;S.tsec=1350;S.mode='in';S.room='teach1';S.san=20;
          sanTick(10,NEED_RULE['自由'],false);const laterRecovery=S.san-20;
          S.san=20;S.pillT=10;AN.active=true;sanTick(10,NEED_RULE['自由'],false);
          const pill=S.san-20;
          S.mode='in';S.room='garage1';S.talent='code';S.san=80;dangerTick(10);
          const danger=80-S.san;
          S.talent='night';S.san=80;dangerTick(10);const night=80-S.san;
          return {firstRecovery,laterRecovery,pill,danger,night};
        }""")
        self.assertAlmostEqual(result['firstRecovery'], 8)
        self.assertAlmostEqual(result['laterRecovery'], 3.6)
        self.assertAlmostEqual(result['pill'], 20)
        self.assertAlmostEqual(result['danger'], 5.5 * 1.65)
        self.assertAlmostEqual(result['night'] / result['danger'], .55)

    def test_sleep_across_night_uses_arrival_pressure_and_keeps_cooldown(self):
        page = self.page()
        result = page.evaluate("""()=>{
          RT=newRT();S.day=1;S.tsec=1330;S.san=20;S.fn={note:true,n:1,on:false};
          S.actCool={};doSanAct('sleep');const san=S.san;
          const result={day:S.day,time:S.tsec,gain:san-20,clock:RT.pressureClock,
            expected:CampusPressure.restGain(SAN_ACTS.sleep.san),until:S.actCool.sleep};
          doSanAct('sleep');result.repeated=S.san!==san;return result;
        }""")
        self.assertEqual(result['day'], 2)
        self.assertEqual(result['time'], 1375)
        self.assertEqual(result['clock'], 1375)
        self.assertAlmostEqual(result['gain'], result['expected'])
        self.assertLess(result['gain'], 26 * .7)
        self.assertGreater(result['until'], 1375)
        self.assertFalse(result['repeated'])

    def test_repeatable_minigame_rewards_follow_pressure(self):
        page = self.page()
        result = page.evaluate("""()=>{
          RT=newRT();S.day=2;S.tsec=1350;S.san=20;PHONE.cool=0;PHONE.score=6;
          PHONE.end();const phone=PHONE.gain;const afterPhone=S.san;
          PHONE.end();const same=S.san===afterPhone;
          PC.on=true;PC.score=10;PCGAME.stop();
          return {phone,same,pc:S.san-afterPhone,time:S.tsec};
        }""")
        self.assertAlmostEqual(result['phone'], 4.2)
        self.assertAlmostEqual(result['pc'], 14)
        self.assertTrue(result['same'])
        self.assertEqual(result['time'], 1350)

    def test_pause_journal_and_frozen_space_do_not_age_world(self):
        page = self.page()
        result = page.evaluate("""()=>{
          RT=newRT();S.day=1;S.tsec=1200;CampusPressure.observe();
          const before=JSON.stringify(CampusPressure.current());
          PAUSE.on=true;update(60);PAUSE.on=false;
          UI.toggle('bag');update(60);UI.closePanelAll();
          PRO.on=true;update(60);PRO.on=false;
          // 通过正式入口初始化小游戏；单改 on 标志会留下空的蛇身，
          // 现在小游戏在应用更新中推进，不能用未初始化状态代替暂停场景。
          PCGAME.start();update(60);PCGAME.cancel();
          updateHUD();const unchanged=before===JSON.stringify(CampusPressure.current());
          // 压力不使用日期或浏览器墙钟；独立空间未推进游戏钟时也保持原值。
          doEnterRoom('lift_dream');update(30);CampusPressure.tick();
          return {unchanged,clock:RT.pressureClock,time:S.tsec};
        }""")
        self.assertEqual(result, dict(unchanged=True, clock=1200, time=1200))

    def test_save_rewind_and_old_save_migration_preserve_progress_and_pressure(self):
        page = self.page()
        result = page.evaluate("""()=>{
          RT=newRT();S.day=3;S.tsec=850;S.bag=['key','coil','pill'];
          RT.hacked=true;RT.data=true;RT.key=true;RT.portalDiary=true;
          RT.portalBlueprints={2:true};RT.portalWork={4:1};
          const danger=CampusPressure.current().danger;
          rewindGameTime(1000);saveGame();const saved=loadGame();
          freshState('hard');running=false;applySave(saved);
          const retained=CampusPressure.current().danger===danger&&RT.hacked&&RT.data&&RT.key&&
            RT.portalDiary&&PortalExploration.count()===1&&RT.portalWork[4]===1;
          const bag=S.bag.slice(), clock=RT.pressureClock;
          const old=[];
          for(const bad of [undefined,null,-1,'1',Infinity]){
            const d=JSON.parse(JSON.stringify(saved));d.day=4;d.tsec=800;
            d.rt.pressureClock=bad;d.rt.pressureSeen=99;
            freshState('hard');applySave(d);
            old.push(Number.isFinite(RT.pressureClock)&&RT.pressureClock>=gameClock()&&CampusPressure.current().stage>=4);
          }
          freshState('hard');running=false;
          return {retained,bag,clock,old,fresh:CampusPressure.current().stage,seen:RT.pressureSeen};
        }""")
        self.assertTrue(result['retained'])
        self.assertEqual(result['bag'], ['key', 'coil', 'pill'])
        self.assertEqual(result['clock'], 3730)
        self.assertTrue(all(result['old']))
        self.assertEqual(result['fresh'], 0)
        self.assertEqual(result['seen'], 0)

    def test_load_keeps_pending_anomaly_and_patrol_warning(self):
        page = self.page()
        result = page.evaluate("""()=>{
          RT=newRT();S.day=2;S.tsec=850;S.mode='in';S.room='teach1';
          AN.id=null;AN.active=false;AN.pre='rain';AN.next=6;AN.preNext=25;AN.locked=true;
          patReset();PAT.warning=2.1;PAT.near=true;
          saveGame();const d=loadGame();freshState('hard');running=false;applySave(d);
          return {stage:CampusPressure.current().stage,an:[AN.next,AN.preNext,AN.pre,AN.locked],
            pat:[PAT.state,PAT.warning,PAT.near]};
        }""")
        self.assertEqual(result['stage'], 2)
        self.assertEqual(result['an'], [6, 25, 'rain', True])
        self.assertEqual(result['pat'], ['walk', 2.1, True])

    def test_notice_waits_for_safe_gap_and_survives_reload_without_spam(self):
        page = self.page()
        result = page.evaluate("""()=>{
          RT=newRT();S.day=2;S.tsec=850;AN.active=false;AN.pre=null;
          patReset();PAT.room='out';PAT.x=S.x+12;PAT.y=S.y;PAT.safety=0;PAT.locked=true;clearIntroTimers();CampusPressure.tick();const blocked=RT.pressureSeen===0;
          PAT.state='idle';os('线索不能被覆盖',5,OS_KEEP);CampusPressure.tick();
          const dialogue=document.getElementById('sub').textContent;
          clearIntroTimers();CampusPressure.tick();const seen=RT.pressureSeen;
          saveGame();const d=loadGame();freshState('hard');running=false;applySave(d);
          clearIntroTimers();CampusPressure.tick();
          return {blocked,dialogue,seen,repeated:DLG.open};
        }""")
        self.assertTrue(result['blocked'])
        self.assertEqual(result['dialogue'], '线索不能被覆盖')
        self.assertEqual(result['seen'], 2)
        self.assertFalse(result['repeated'])

    def test_hud_explains_risk_on_desktop_and_touch(self):
        for touch in (False, True):
            with self.subTest(touch=touch):
                page = self.page(touch=touch)
                page.evaluate("S.day=2;S.tsec=1350;updateHUD()")
                self.assertIn('第 2 天 · 高危', page.locator('#campuspressure').inner_text())
                box = page.locator('#campuspressure').bounding_box()
                self.assertIsNotNone(box)
                self.assertGreaterEqual(box['x'], 0)
                self.assertLessEqual(box['x'] + box['width'], page.viewport_size['width'])
                page.evaluate('Investigation.notice()')
                self.assertIn('第二天起校园更危险', page.locator('#choices').inner_text())
                self.assert_js(page, "!!Investigation.state().entries.timePressure")

    def test_late_game_escape_and_registered_exploration_remain_possible(self):
        page = self.page()
        page.evaluate("""RT=newRT();S.day=6;S.tsec=850;S.san=100;S.diff='hard';
          RT.hacked=true;RT.data=true;S.spots.data=1;SchoolDay.grant(true);
          S.mode='in';S.room='lab1';S.seated=false;PAT.state='walk';PAT.locked=false;""")
        self.assert_js(page, 'CampusPressure.current().stage===5&&SchoolDay.excused()&&patIgnores()')
        page.evaluate("S.mode='out';S.room=null;S.x=GATE_W.x*SC;S.y=GATE_W.y*SC;tryGateWest()")
        for _ in range(3):
            answer = page.evaluate('FACE_QUESTIONS[RT.faceQuiz.order[RT.faceQuiz.done]].answer')
            page.locator('#choices button').nth(answer).click()
        page.locator('#choices button').filter(has_text='通过闸机').first.click()
        self.assert_js(page, "RT.end==='face'&&!!endsSeen().face&&!loadGame()")
