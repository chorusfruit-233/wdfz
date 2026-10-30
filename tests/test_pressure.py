"""校园压力规则、实时课表和持续运行的课堂互动。"""
from pathlib import Path
import shutil
import subprocess
import unittest
from browser_case import BrowserCase

ROOT=Path(__file__).resolve().parents[1]


class PressureClockTest(unittest.TestCase):
    def test_real_time_budgets_and_boundaries_are_step_independent(self):
        node=shutil.which('node')
        if not node:self.skipTest('需要 Node.js')
        script=r"""
const fs=require('fs'),vm=require('vm'),a=require('assert/strict');
const c={console,Math,Number,os:()=>{},setTimeout:()=>{},S:{tsec:440,day:1,mode:'out'}};
vm.createContext(c);
for(const f of ['core','systems'])vm.runInContext(fs.readFileSync('game3d/js/'+f+'.js','utf8'),c);
for(const p of c.SCHED.filter(p=>p[2]==='课间')){
 c.S.tsec=p[0];c.S.day=1;c.clockTick(180);a.ok(Math.abs(c.S.tsec-p[1])<1e-7);
}
c.S.tsec=735;c.clockTick(480);a.ok(Math.abs(c.S.tsec-840)<1e-7);
c.S.tsec=1040;c.clockTick(480);a.ok(Math.abs(c.S.tsec-1090)<1e-7);
c.S.tsec=705;c.clockTick(15);a.ok(Math.abs(c.S.tsec-c.BEAST_T1)<1e-7);
c.S.tsec=524.99;c.clockTick(1);a.ok(Math.abs(c.S.tsec-(525+(1-0.01*60/84)*5/60))<1e-7);
const duration=c.SCHED.reduce((n,p)=>n+(p[1]-p[0])*60/p[4],0)+15-10/84;
c.S.tsec=440;c.S.day=1;c.clockTick(duration);a.ok(Math.abs(c.S.tsec-440)<1e-6);a.equal(c.S.day,2);
c.S.tsec=440;c.S.day=1;let rest=duration;while(rest>1e-8){const d=Math.min(.1,rest);c.clockTick(d);rest-=d;}
a.ok(Math.abs(c.S.tsec-440)<1e-5);a.equal(c.S.day,2);
"""
        subprocess.run([node,'-e',script],cwd=ROOT,check=True,timeout=30)


class PressureBrowserTest(BrowserCase):
    def classroom(self, touch=False):
        page=self.page(touch=touch)
        page.evaluate("Game.start('hard');clearIntroTimers();running=false")
        page.wait_for_function("GLR.roomMesh&&GLR.roomMesh.userData.roomId==='teach1'&&GLR.roomMesh.userData.roomData===INTERIORS.teach1")
        page.evaluate("S.intro=0;S.day=2;S.talent='code';S.tt=0;S.san=70;S.bag=[];AN.active=false;PAT.locked=false;PAT.next=1000;updateHUD()")
        return page

    def test_absence_is_not_san_loss_but_danger_is(self):
        page=self.page()
        r=page.evaluate("""()=>{
          S.san=80;S.stam=100;S.tsec=700;S.day=2;S.seated=false;S.diff='hard';
          AN.active=false;PAT.state='idle';PAT.locked=false;HIDE.on=false;
          sanTick(5,NEED_RULE['教室'],true);let skipped=S.san;
          violTick(5,'教室',NEED_RULE['教室'],true);let violation=S.viol;
          S.mode='in';S.room='garage1';sanTick(2,NEED_RULE['自由'],false);dangerTick(2);settleSan();
          return {skipped,violation,danger:S.san,stamina:S.stam,max:staminaMax()};
        }""")
        self.assertEqual(r['skipped'],80)
        self.assertGreater(r['violation'],0)
        self.assertLess(r['danger'],80)
        self.assertLessEqual(r['stamina'],r['max'])

    def test_low_san_cap_can_recover_enough_to_sprint_and_snack_still_works(self):
        page=self.page()
        page.evaluate("""S.san=1;S.stam=100;S.snackT=0;capStamina();window.maxLow=staminaMax();
          S.stam=0;S.tired=true;KEY={};for(let i=0;i<240;i++)updatePlayer(1/60);""")
        self.assert_js(page,'S.stam===maxLow&&S.stam>STAM_BACK&&!S.tired&&S.stam<50')
        page.evaluate("S.snackT=5;S.stam=2;KEY={w:true,shift:true};updatePlayer(.1)")
        self.assert_js(page,'S.run&&S.stam===2&&S.snackT>0')
        page.evaluate("KEY={};S.san=100;capStamina()")
        self.assert_js(page,'S.stam===2&&staminaMax()===100')
        page.evaluate('S.san=10;S.stam=100;saveGame();Game.continue_();running=false')
        self.assert_js(page,'S.stam<=staminaMax()')

    def test_evening_blocks_all_violation_sources_and_has_clear_edges(self):
        page=self.page()
        page.evaluate("S.tsec=1040;S.viol=40;addViolation(18);addViolation(15);addViolation(8)")
        self.assert_js(page,'S.viol===40')
        page.evaluate("S.tsec=1089.9;addViolation(18)")
        self.assert_js(page,'S.viol===40')
        page.evaluate("S.tsec=1090;addViolation(18)")
        self.assert_js(page,'S.viol===58')
        page.evaluate("S.tsec=1050;AN.active=true;AN.id='roster';AN.data={done:false};anEnd()")
        self.assert_js(page,'S.viol===58')

    def test_assimilation_is_immediate_and_old_choices_do_not_return(self):
        page=self.classroom()
        page.evaluate("S.tt=100;S.hiddenLatch=true;S.hiddenAsked=true;S.hiddenWindow=2;saveGame();Game.continue_();running=false")
        self.assert_js(page,'!S.hiddenLatch&&!S.hiddenAsked&&!UI.chooseOpen')
        page.evaluate("ttTick(.01,'教室')")
        self.assert_js(page,"S.dead&&S.death==='names'&&!UI.chooseOpen&&!PAUSE.on")
        for protection in ('elixir','immune','god'):
            page=self.classroom()
            page.evaluate("""p=>{S.tt=100;S.bag=p==='elixir'?['elixir']:[];
              S.talent=p==='immune'?'immune':'code';S.immuneUsed=false;DEV.god=p==='god';ttTick(.01,'教室');}""",protection)
            self.assert_js(page,'!S.dead&&S.tt<100&&!UI.chooseOpen&&!PAUSE.on')
            if protection=='elixir':self.assert_js(page,"!hasItem('elixir')")
            if protection=='immune':self.assert_js(page,'S.immuneUsed')

    def test_patrol_blinks_respect_obstacles_and_night_is_outdoor_only(self):
        page=self.classroom()
        self.assert_js(page,"(S.room='admin5',S.tsec=1345,!patEligible())")
        self.assert_js(page,"(S.mode='out',patEligible())")
        page.evaluate("""S.mode='in';S.room='teach1';S.tsec=700;S.seated=false;
          PAT.room='teach1';PAT.state='walk';PAT.x=S.x+60;PAT.y=S.y;PAT.tx=S.x+90;PAT.ty=S.y;
          PAT.locked=false;PAT.lock=0;PAT.walkT=0;PAT.blinkCD=.8;PAT.still=0;patAddFig();
          window.old=[PAT.x,PAT.y];patTick(.1);""")
        self.assert_js(page,'PAT.x===old[0]&&PAT.y===old[1]&&!GLR.patFig.userData.eye')
        # 一个薄障碍：即便一跳可越过，沿途仍不能穿越。
        page.evaluate("""let r=INTERIORS.teach1;window.orig={grid:r.grid,foot:r.foot,extra:r.propExtra,stair:r.stairExtra};
          r.grid=Array.from({length:r.rows},()=>Array(r.cols).fill('.'));r.foot={};r.stairExtra=[];
          r.propExtra=[];r.patNav=null;PAT.x=r.cx-8;PAT.y=r.cy;PAT.tx=r.cx+20;PAT.ty=r.cy;
          patBlink(10);window.jumped=PAT.x>r.cx-8&&PAT.x<=r.cx+2.01;
          r.propExtra=[{x0:0,x1:.1,z0:-20,z1:20}];r.patNav=null;
          PAT.x=r.cx-8;PAT.y=r.cy;PAT.tx=r.cx+20;PAT.ty=r.cy;patBlink(34);
          window.blocked=PAT.x<r.cx-2.5&&Collision.depth(PAT.x,PAT.y,PAT_BODY/U2M,r)<1e-7;
          Object.assign(r,{grid:orig.grid,foot:orig.foot,propExtra:orig.extra,stairExtra:orig.stair});r.patNav=null;""")
        self.assert_js(page,'jumped&&blocked')

    def test_patrol_leaves_when_the_allowed_time_ends(self):
        page=self.classroom()
        for state in ('warn','walk'):
            with self.subTest(location='out',state=state):
                page.evaluate("""state=>{
                  patReset();S.mode='out';S.room=null;S.tsec=1499.99;S.day=3;
                  S.seated=false;S.dead=false;S.moving=true;
                  PAT.state=state;PAT.room='out';PAT.t=3.59;PAT.walkT=0;
                  PAT.locked=state==='walk';PAT.lock=PAT.locked?1:0;
                  PAT.x=S.x+8;PAT.y=S.y;PAT.tx=S.x;PAT.ty=S.y;
                  PAT.blinkCD=10;PAT.afterBlink=0;PAT.step=10;
                  VisualState.patrolFlick=1;VisualState.patrolRed=PAT.locked?1:0;
                  clockTick(.1);patTick(.1);
                }""",state)
                self.assert_js(page,"!isNight()&&S.tsec>=440&&PAT.state==='idle'&&!PAT.locked&&!S.dead")
                self.assert_js(page,'VisualState.patrolFlick===0&&VisualState.patrolRed===0')
            with self.subTest(location='classroom',state=state):
                page.evaluate("""state=>{
                  patReset();S.mode='in';S.room='teach1';S.tsec=524.99;
                  S.seated=false;S.dead=false;S.moving=true;
                  PAT.state=state;PAT.room='teach1';PAT.t=3.59;PAT.walkT=0;
                  PAT.locked=state==='walk';PAT.lock=PAT.locked?1:0;
                  PAT.x=S.x+8;PAT.y=S.y;PAT.tx=S.x;PAT.ty=S.y;
                  PAT.blinkCD=10;PAT.afterBlink=0;PAT.step=10;
                  clockTick(.1);patTick(.1);
                }""",state)
                self.assert_js(page,"needWhere(S.tsec)==='自由'&&PAT.state==='idle'&&!PAT.locked&&!S.dead")
            for room in ('teach1','admin5'):
                with self.subTest(location=room,transition='night',state=state):
                    page.evaluate("""({state,room})=>{
                      patReset();S.mode='in';S.room=room;S.tsec=1339.99;
                      S.seated=false;S.dead=false;S.moving=true;
                      PAT.state=state;PAT.room=room;PAT.t=3.59;PAT.walkT=0;
                      PAT.locked=state==='walk';PAT.lock=PAT.locked?1:0;
                      PAT.x=S.x+8;PAT.y=S.y;PAT.tx=S.x;PAT.ty=S.y;
                      PAT.blinkCD=10;PAT.afterBlink=0;PAT.step=10;
                      clockTick(.1);patTick(.1);
                    }""",{'state':state,'room':room})
                    self.assert_js(page,"isNight()&&PAT.state==='idle'&&!PAT.locked&&!S.dead")

    def test_patrol_does_not_disappear_just_because_player_is_exempt(self):
        page=self.classroom()
        for exemption in ('seat','leave'):
            with self.subTest(exemption=exemption):
                page.evaluate("""exemption=>{
                  patReset();S.tsec=700;S.mode='in';S.room='teach1';S.dead=false;
                  S.seated=exemption==='seat';RT.leaveUntil=exemption==='leave'?gameClock()+20:0;
                  PAT.state='walk';PAT.room='teach1';PAT.walkT=0;
                  PAT.x=S.x+80;PAT.y=S.y;PAT.tx=S.x;PAT.ty=S.y;
                  PAT.locked=true;PAT.lock=1;PAT.lost=0;PAT.still=0;
                  PAT.blinkCD=10;PAT.afterBlink=0;PAT.step=10;S.moving=true;
                  patTick(.1);
                }""",exemption)
                self.assert_js(page,"patEligible()&&patIgnores()&&PAT.state==='walk'&&PAT.locked&&PAT.lost>0")
        page.evaluate("""patReset();S.tsec=525;S.mode='in';S.room='admin5';
          PAT.room='admin5';PAT.state='warn';PAT.t=0;patTick(.1);""")
        self.assert_js(page,"patEligible()&&PAT.state==='warn'")

    def test_dawn_ends_patrol_before_it_can_drain_san(self):
        page=self.classroom()
        page.evaluate("""patReset();S.mode='out';S.room=null;S.tsec=1499.99;S.day=3;
          S.seated=false;S.dead=false;S.san=.02;S.talent='code';S.moving=true;
          PAT.state='walk';PAT.room='out';PAT.locked=true;PAT.lock=1;PAT.walkT=0;
          PAT.x=S.x+8;PAT.y=S.y;PAT.tx=S.x;PAT.ty=S.y;
          PAT.blinkCD=10;PAT.afterBlink=0;PAT.step=10;updateSystems(.1);""")
        self.assert_js(page,"!isNight()&&PAT.state==='idle'&&!S.dead&&S.san>0")

    def test_office_key_probability_and_full_bag(self):
        page=self.page()
        page.evaluate("""window.random=Math.random;Math.random=()=>.3;
          S.mode='in';S.room='admin5';S.bag=[];RT=newRT();doSearch(2,2);doSearch(3,2);Math.random=random;""")
        self.assert_js(page,"hasItem('key')&&hasItem('roomkey')")
        page.evaluate("S.bag=['coin','chalk','phone','pen','map','torch','pill','brolly'];doSearch(4,2)")
        self.assert_js(page,"!RT.deskUsed['admin5:4:2']")

    def test_lesson_keeps_time_and_survives_reload_without_duplicate_reward(self):
        for touch in (False,True):
            page=self.classroom(touch)
            (page.locator('#lessonOpen').tap() if touch else page.locator('#lessonOpen').click())
            self.assert_js(page,'LESSON.on&&!PAUSE.on&&!UI.anyOpen()&&!playerInputAllowed()')
            page.evaluate('window.before=S.tsec;window.pos=S.x;update(1);saveGame()')
            self.assert_js(page,'S.tsec>before&&S.x===pos&&LESSON.record().left===11')
            page.reload(wait_until='load')
            page.evaluate('Game.continue_();running=false;S.intro=0;updateHUD()')
            page.wait_for_function("S.room==='teach1'&&GLR.roomMesh")
            (page.locator('#lessonOpen').tap() if touch else page.locator('#lessonOpen').click())
            self.assert_js(page,'LESSON.record().left===11')
            answer=page.evaluate('LESSON_TASKS[LESSON.record().task].answer')
            page.evaluate('window.sanBefore=S.san')
            (page.locator('.lesson-options button').nth(answer).tap() if touch else page.locator('.lesson-options button').nth(answer).click())
            self.assert_js(page,'!LESSON.on&&playerInputAllowed()&&S.san===sanBefore+2')
            page.evaluate('LESSON.open()')
            self.assert_js(page,'!LESSON.on')
            page.evaluate('updateHUD()')
            self.assertTrue(page.locator('#lessonOpen').is_hidden())

    def test_lesson_interrupts_without_freezing_and_expires(self):
        page=self.classroom()
        page.evaluate("os('课桌旁的声音',4)")
        page.keyboard.press('r')
        self.assert_js(page,'LESSON.on')
        self.assertTrue(page.locator('#sub').is_hidden())
        page.evaluate("AN.active=true;AN.id='turn';LESSON.checkInterrupt()")
        self.assert_js(page,'!LESSON.on&&!LESSON.record().done')
        self.assertTrue(page.locator('#sub').is_visible())
        page.evaluate("AN.active=false;AN.id=null;updateHUD()")
        page.keyboard.press('r')
        page.evaluate('window.left=LESSON.record().left;Game.pause();update(.1)')
        self.assert_js(page,'!LESSON.on&&PAUSE.on&&LESSON.record().left===left')
        page.evaluate('Game.resume();LESSON.open();LESSON.tick(13);updateHUD()')
        self.assert_js(page,'!LESSON.on&&LESSON.record().done&&playerInputAllowed()')
        self.assertTrue(page.locator('#lessonOpen').is_hidden())

    def test_patrol_chase_and_blink_timer_survive_save_reload(self):
        page=self.classroom()
        page.evaluate("""S.seated=false;let r=INTERIORS.teach1;
          PAT.room='teach1';PAT.state='walk';PAT.x=r.ox+30.5*r.tw;PAT.y=r.oy+18.5*r.th;
          PAT.tx=PAT.x+18;PAT.ty=PAT.y;PAT.locked=true;PAT.lock=1;PAT.lost=.7;
          PAT.blinkCD=.42;PAT.afterBlink=.1;window.savedPose=[PAT.x,PAT.y];saveGame();""")
        saved=page.evaluate('savedPose')
        page.reload(wait_until='load')
        page.evaluate('Game.continue_();running=false')
        page.wait_for_function("GLR.roomMesh&&GLR.roomMesh.userData.roomId==='teach1'&&GLR.patFig")
        self.assertEqual(page.evaluate('[PAT.x,PAT.y]'),saved)
        self.assert_js(page,"PAT.locked&&PAT.lost===.7&&PAT.blinkCD===.42&&PAT.afterBlink===.1&&VisualState.patrolRed===1")

    def test_hiding_is_not_lost_when_restoring_a_patrol_save(self):
        page=self.classroom()
        page.evaluate("""S.seated=false;PAT.state='idle';hideIn({c:28,r:16});let r=INTERIORS.teach1;
          PAT.room='teach1';PAT.state='walk';PAT.x=r.ox+30.5*r.tw;PAT.y=r.oy+18.5*r.th;
          PAT.tx=PAT.x+18;PAT.ty=PAT.y;PAT.locked=false;PAT.lock=0;PAT.blinkCD=.55;
          window.hiddenPose=[S.x,S.y];saveGame();""")
        pos=page.evaluate('hiddenPose')
        page.reload(wait_until='load')
        page.evaluate('Game.continue_();running=false')
        page.wait_for_function("GLR.roomMesh&&GLR.roomMesh.userData.roomId==='teach1'&&GLR.patFig")
        self.assert_js(page,"HIDE.on&&!HIDE.seen&&HIDE.c===28&&HIDE.r===16&&PAT.blinkCD===.55")
        self.assertEqual(page.evaluate('[S.x,S.y]'),pos)
        self.assertTrue(page.locator('#hideslits').is_visible())
        page.evaluate('tryInteract()')
        self.assert_js(page,'!HIDE.on')

    def test_san_is_readable_when_muted_without_a_numeric_bar(self):
        page=self.page(touch=True)
        self.assertEqual(page.locator('#sanbar').count(),0)
        for value,text in ((100,'呼吸平稳'),(50,'有些恍惚'),(20,'心跳很乱'),(5,'快撑不住了')):
            page.evaluate('v=>{S.san=v;updateHUD();render(.2)}',value)
            self.assertEqual(page.locator('#sanfeel').inner_text(),text)
        self.assert_js(page,'Number.isFinite(GLR.postMat.uniforms.uSan.value)')

    def test_san_visual_resets_on_new_game_and_matches_loaded_save(self):
        page=self.classroom()
        page.evaluate('S.san=10;render(1)')
        self.assert_js(page,'GLR.sanSense<.5')
        page.evaluate("Game.start('hard');running=false;clearIntroTimers();render(0)")
        self.assert_js(page,'S.san===100&&GLR.sanSense===1&&GLR.postMat.uniforms.uSan.value===1')
        page.evaluate('S.san=25;saveGame();S.san=100;render(10);Game.continue_();running=false;render(0)')
        self.assert_js(page,'S.san===25&&GLR.sanSense===.25&&GLR.postMat.uniforms.uSan.value===.25')
        page.evaluate('S.san=75;render(.1)')
        self.assert_js(page,'GLR.sanSense>.25&&GLR.sanSense<.75')

    def test_lesson_physical_keys_work_with_non_latin_key_labels(self):
        page=self.classroom()
        page.evaluate("document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'к',code:'KeyR',bubbles:true}))")
        self.assert_js(page,'LESSON.on')
        page.evaluate("document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'§',code:'Digit3',bubbles:true}))")
        self.assert_js(page,'!LESSON.on&&LESSON.record().done&&playerInputAllowed()')
