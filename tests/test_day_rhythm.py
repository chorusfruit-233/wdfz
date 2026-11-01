"""20 分钟一天：跨课时许可、集合优先级、存档与主动课堂快进。"""
from browser_case import BrowserCase


class DayRhythmTest(BrowserCase):
    def game(self, touch=False):
        page = self.page(touch=touch)
        page.evaluate("Game.start('hard');clearIntroTimers();running=false")
        page.wait_for_function("GLR.roomMesh&&GLR.roomMesh.userData.roomId==='teach1'")
        page.evaluate("S.intro=0;S.day=2;S.fn.on=false;S.talent='code';S.san=60;S.tt=0;AN.next=1e6;PAT.next=1e6;Investigation.openDesk();updateHUD()")
        return page

    def test_podium_grants_a_stable_pass_across_bells_and_reload(self):
        for touch in (False, True):
            page = self.game(touch)
            page.evaluate("S.tsec=800;Investigation.notice();window.bagBefore=S.bag.slice()")
            button = page.locator('#choices button').first
            button.tap() if touch else button.click()
            self.assert_js(page, "SchoolDay.excused()&&RT.outing.until===1070&&JSON.stringify(S.bag)===JSON.stringify(bagBefore)")
            page.evaluate("S.seated=false;S.viol=0;clockTick(150);violTick(150,needWhere(S.tsec),NEED_RULE[needWhere(S.tsec)],false);updateHUD();saveGame()")
            self.assert_js(page, "S.tsec>885&&SchoolDay.excused()&&patIgnores()&&S.viol===0&&/外出登记/.test(document.getElementById('period').textContent)")
            page.reload(wait_until='load')
            page.evaluate("Game.continue_();running=false;clearIntroTimers();S.intro=0")
            self.assert_js(page, "SchoolDay.excused()&&RT.outing.until===1070")
            page.evaluate("S.room='admin5'")
            self.assert_js(page, "!patIgnores()")
            page.evaluate("S.room='teach1';S.exam=true")
            self.assert_js(page, "!SchoolDay.excused()&&!patIgnores()")

    def test_expired_pass_does_not_renew_on_reload_and_old_notice_migrates_once(self):
        page = self.game()
        result = page.evaluate("""()=>{
          S.tsec=700;SchoolDay.grant(true);S.tsec=770;saveGame();let saved=loadGame();
          freshState('hard');applySave(saved);const expired=!SchoolDay.permit();
          S.tsec=700;SchoolDay.grant(true);S.day++;const dayExpired=!SchoolDay.permit();
          S.day--;S.tsec=699;const rewindExpired=!SchoolDay.permit();
          saved.tsec=800;delete saved.rt.dayRhythmVersion;delete saved.rt.outing;
          saved.rt.investigation={entries:{notice:{text:'移交单',kind:'事实',day:2}},recent:[]};
          freshState('hard');applySave(saved);const migrated=SchoolDay.permit()&&RT.outing.until===1070;
          S.tsec=1070;saveGame();saved=loadGame();freshState('hard');applySave(saved);
          return {expired,dayExpired,rewindExpired,migrated,once:!SchoolDay.permit()};
        }""")
        self.assertEqual(result, dict(expired=True, dayExpired=True, rewindExpired=True, migrated=True, once=True))

    def test_ordinary_absence_is_not_a_timer_and_exams_still_matter(self):
        page = self.game()
        page.evaluate("S.seated=false;S.viol=0;violTick(60,'教室',NEED_RULE['教室'],false);window.ordinary=S.viol;violTick(2,'教室',NEED_RULE['教室'],true)")
        self.assert_js(page, "ordinary===0&&S.viol>0")
        page.evaluate("S.viol=0;S.tsec=590;violTick(60,'操场',NEED_RULE['操场'],false)")
        self.assert_js(page, "S.viol===0")

    def test_patrol_records_one_violation_per_encounter_even_after_reload(self):
        page = self.game()
        result = page.evaluate("""()=>{
          S.seated=false;S.viol=0;S.bag=[];S.tsec=850;
          patReset();PAT.state='walk';PAT.room='teach1';PAT.x=S.x+60;PAT.y=S.y;
          PAT.tx=PAT.x;PAT.ty=PAT.y;PAT.lock=.99;PAT.walkT=0;PAT.step=100;PAT.blinkCD=100;
          const sees=patSees;patSees=()=>true;
          patTick(.1);const first=S.viol;
          PAT.locked=false;PAT.lock=.99;patTick(.1);const again=S.viol;
          saveGame();const saved=loadGame();freshState('hard');applySave(saved);
          PAT.locked=false;PAT.lock=.99;PAT.blinkCD=100;patTick(.1);
          patSees=sees;return {first,again,loaded:S.viol,cited:PAT.cited};
        }""")
        self.assertEqual(result, dict(first=8, again=8, loaded=8, cited=True))

    def test_inspection_cannot_be_bypassed_by_leave_and_only_compliance_renews(self):
        page = self.game()
        result = page.evaluate("""()=>{
          S.tsec=770;RT.leaveUntil=gameClock()+120;S.viol=30;S.moving=true;
          Inspection.start({day:2,slot:0});Inspection.tick(1);const motion=S.viol;
          S.moving=false;Inspection.finish(Inspection.state().current);
          const renewed=SchoolDay.permit()&&RT.outing.until===1070;
          const saved=loadGame().rt.outing.until===1070;
          Inspection.clearFx();S.tsec=1070;S.mode='out';S.room=null;
          S.viol=30;Inspection.start({day:2,slot:1});Inspection.finish(Inspection.state().current);
          return {motion,renewed,saved,missed:S.viol,expired:!SchoolDay.permit()};
        }""")
        self.assertEqual(result, dict(motion=32, renewed=True, saved=True, missed=40, expired=True))

    def test_warning_reserves_a_minute_and_defers_new_threats_and_choices(self):
        page = self.game()
        result = page.evaluate("""()=>{
          doEnterRoom('admin5');S.seated=false;S.tsec=INSPECT_WARN_TIMES[0]-.01;
          clockTick(.02);AN.next=0;PAT.next=0;anDrive(.1);patTick(.1);
          S.fn.on=true;S.fn.v=0;S.fn.next=0;S.fn.left=4;S.fn.used={};fnTick(.1);
          const held=!AN.active&&PAT.state==='idle'&&!UI.chooseOpen&&Inspection.upcoming();
          const seconds=realSecondsBetween(INSPECT_WARN_TIMES[0],770);
          S.fn.on=false;AN.active=true;AN.id='blackout';AN.t=0;AN.acc=0;AN.data={};anDrive(1);
          const activeProgresses=AN.t>0;anEnd();
          saveGame();const d=loadGame();freshState('hard');applySave(d);
          return {held,seconds,activeProgresses,restored:Inspection.upcoming()};
        }""")
        self.assertTrue(result['held'])
        self.assertAlmostEqual(result['seconds'], 60, places=6)
        self.assertTrue(result['activeProgresses'])
        self.assertTrue(result['restored'])

    def prepare_wait(self, page):
        page.evaluate("""S.tsec=850;S.seated=true;S.san=40;S.tt=20;S.pillT=3;
          RT.lessons={};RT.lessons[LESSON.currentKey()]={task:0,left:0,done:true};updateHUD();""")

    def test_wait_is_explicit_and_cancellable_on_mouse_and_touch(self):
        for touch in (False, True):
            page = self.game(touch)
            self.prepare_wait(page)
            button = page.locator('#lessonOpen')
            self.assertIn('整理到下课', button.inner_text())
            button.tap() if touch else button.click()
            self.assert_js(page, "UI.chooseOpen&&!LESSON.waiting")
            option = page.locator('#choices button').first
            option.tap() if touch else option.click()
            self.assert_js(page, "!!LESSON.waiting&&RT.lessons[LESSON.currentKey()].waitUsed")
            page.evaluate("LESSON.fastForward(.1);updateHUD()")
            self.assertIn('停止整理', button.inner_text())
            button.tap() if touch else page.keyboard.press('r')
            self.assert_js(page, "!LESSON.waiting&&!LESSON.canWait()&&RT.studySkipped>.49&&RT.studySkipped<.51")
            page.reload(wait_until='load')
            page.evaluate("Game.continue_();running=false;clearIntroTimers();S.intro=0")
            self.assert_js(page, "!LESSON.waiting&&!LESSON.canWait()")

    def test_wait_uses_normal_body_and_clock_accounting(self):
        page = self.game()
        self.prepare_wait(page)
        result = page.evaluate("""()=>{
          saveGame();const base=loadGame(),stats=()=>[S.tsec,S.san,S.tt,S.pillT,S.stam];
          for(let i=0;i<50;i++)update(.1);const natural=stats();
          freshState('hard');applySave(base);S.screen='play';S.intro=0;PRO.on=false;PAUSE.on=false;
          LESSON.startWait();for(let i=0;i<10;i++)LESSON.fastForward(.1);
          const fast=stats(),seconds=RT.studySkipped,before=S.tsec,raf=requestAnimationFrame;
          requestAnimationFrame=()=>0;running=true;lastT=0;accum=0;
          try{frame(1000/60+.00001);}finally{running=false;requestAnimationFrame=raf;}
          return {natural,fast,seconds,frameSeconds:realSecondsBetween(before,S.tsec)};
        }""")
        for natural, fast in zip(result['natural'], result['fast']):
            self.assertAlmostEqual(natural, fast, places=6)
        self.assertAlmostEqual(result['seconds'], 5, places=6)
        self.assertAlmostEqual(result['frameSeconds'], .1, places=6)  # 一帧的模拟实际推进六倍

    def test_wait_stops_at_a_bell_warning_danger_pause_or_death(self):
        for stop in ('bell', 'warning', 'anomaly', 'patrol', 'pause', 'freeze', 'death'):
            with self.subTest(stop=stop):
                page = self.game()
                self.prepare_wait(page)
                result = page.evaluate("""stop=>{
                  if(stop==='bell')S.tsec=884.99;
                  if(stop==='warning')S.tsec=INSPECT_WARN_TIMES[0]-.01;
                  RT.lessons[LESSON.currentKey()]={task:0,left:0,done:true};LESSON.startWait();
                  if(stop==='anomaly'){AN.active=true;AN.id='blackout';AN.data={};}
                  if(stop==='patrol'){PAT.state='warn';PAT.room=S.room;}
                  if(stop==='pause')PAUSE.on=true;
                  if(stop==='freeze'){DEV.on=true;DEV.freeze=true;}
                  if(stop==='death')S.dead=true;
                  const before=S.tsec;LESSON.fastForward(.1);
                  return {stopped:!LESSON.waiting,advanced:S.tsec-before,t:S.tsec};
                }""", stop)
                self.assertTrue(result['stopped'], result)
                if stop == 'bell':
                    self.assertAlmostEqual(result['t'], 885, places=6)
                elif stop == 'warning':
                    self.assertLess(result['advanced'], .1)
                else:
                    self.assertEqual(result['advanced'], 0)
