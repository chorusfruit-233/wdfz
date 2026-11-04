"""PR #41: immediate cabin controls and patrol lifecycle across closed-door transfers."""
from browser_case import BrowserCase
import test_elevator as elevator_fixture


class ElevatorReviewTest(BrowserCase):
    game = elevator_fixture.ElevatorTest.game

    def prepare(self, page, b=-11, locked=True, warning=0):
        page.evaluate("""({b,locked,warning})=>{
          SEARCH.on=true;S.tsec=700;Talent.begin('tech','selected');GameRandom.bind(()=>.9);
          callAndWait('teach',2);Elevator.board('teach',2);
          const lift=Elevator.state('teach');lift.door=1;lift.dir=0;lift.hold=4;
          const R=INTERIORS.teach2,w=Elevator.world(R,2.5,b),sp=PatrolNav.snap(R.id,PatrolNav.point(R.id,w.x,w.y));
          patReset();PatrolWorld.reset();
          Object.assign(PAT,{room:R.id,x:sp.x,y:sp.y,fy:0,state:'walk',safety:0,warning,near:true,
            locked,lock:locked?1:0,lost:0,behavior:'chase',transition:null,afterBlink:0,
            lastSeen:locked?PatrolNav.point(R.id,S.x,S.y):null});
        }""", dict(b=b,locked=locked,warning=warning))

    def test_touch_close_is_immediate_without_a_choice_in_both_orientations(self):
        for width,height in [(390,844),(844,390),(667,320)]:
            with self.subTest(width=width,height=height):
                page=self.game(touch=True);page.set_viewport_size(dict(width=width,height=height))
                self.prepare(page);page.evaluate('render(0)')
                button=page.locator('#lift-close');self.assertTrue(button.is_visible())
                box=button.bounding_box();self.assertGreaterEqual(box['height'],44)
                self.assertGreaterEqual(box['x'],0);self.assertLessEqual(box['y']+box['height'],height)
                for other in page.locator('#stick,#tAct,#tTorch,#hot,#mini,#ttop,#sub').all():
                    if not other.is_visible():continue
                    rect=other.bounding_box()
                    overlap_x=min(box['x']+box['width'],rect['x']+rect['width'])-max(box['x'],rect['x'])
                    overlap_y=min(box['y']+box['height'],rect['y']+rect['height'])-max(box['y'],rect['y'])
                    self.assertFalse(overlap_x>0 and overlap_y>0,other.get_attribute('id'))
                button.tap()
                self.assert_js(page,"Elevator.peek('teach').dir===-1&&!UI.chooseOpen")
                page.evaluate('Elevator.tick(1)')
                self.assert_js(page,"Elevator.doorAmount('teach',2)===0")

    def test_physical_v_respects_pause_and_does_not_depend_on_keyboard_layout(self):
        page=self.game();self.prepare(page)
        page.evaluate("document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'м',code:'KeyV',bubbles:true}))")
        self.assert_js(page,"Elevator.peek('teach').dir===-1&&!UI.chooseOpen")
        page.evaluate("KEY={};Elevator.state('teach').dir=0;PAUSE.on=true;document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'v',code:'KeyV',bubbles:true}));render(0)")
        self.assert_js(page,"Elevator.peek('teach').dir===0&&ElevatorUI.node.hidden")
        page.evaluate('PAUSE.on=false;Game.quit()')
        self.assertTrue(page.locator('#elevator-controls').is_hidden())

    def test_queued_departure_settles_escape_before_changing_scene_exactly_once(self):
        page=self.game();self.prepare(page)
        result=page.evaluate("""()=>{
          PatrolWorld.tick(1/60);const armed=!!PAT.doorRush;Elevator.press(5);
          for(let i=0;i<40;i++)update(1/30);
          const scores=()=>RunLog.snapshot().events.filter(e=>e[2]==='电梯门在它面前合上').map(e=>e[3]);
          const before=scores();PatrolWorld.elevatorClosed('teach',2);PatrolWorld.elevatorClosed('teach',2);
          return {armed,room:S.room,before,after:scores(),dead:S.dead};
        }""")
        self.assertTrue(result['armed']);self.assertFalse(result['dead'])
        self.assertEqual(result['room'],'lift_teach');self.assertEqual(result['before'],[15]);self.assertEqual(result['after'],[15])

    def test_existing_approach_warning_is_not_shortened_or_bypassed(self):
        page=self.game();self.prepare(page,b=-8,warning=3.6)
        result=page.evaluate("""()=>{
          PatrolWorld.tick(1/60);const armed=!!PAT.doorRush,warning=PAT.warning;
          const w=Elevator.world(INTERIORS.teach2,.75,0);PAT.x=w.x;PAT.y=w.y;
          PatrolWorld.tick(.1);const protectedNow=!S.dead;
          PAT.warning=0;PatrolWorld.tick(.1);
          return {armed,warning,protectedNow,dead:S.dead,death:S.death};
        }""")
        self.assertTrue(result['armed']);self.assertGreater(result['warning'],3.5)
        self.assertTrue(result['protectedNow']);self.assertTrue(result['dead']);self.assertEqual(result['death'],'liftdoor')

    def test_close_range_original_capture_also_honors_its_warning(self):
        page=self.game();self.prepare(page,b=0,warning=3.6)
        page.evaluate("const w=Elevator.world(INTERIORS.teach2,.75,0);PAT.x=w.x;PAT.y=w.y;PatrolWorld.tick(.1)")
        self.assert_js(page,'!S.dead&&!PAT.doorRush')
        page.evaluate('PAT.warning=0;PatrolWorld.tick(.1)')
        self.assert_js(page,"S.dead&&S.death==='grip'")

    def test_seal_still_banishes_the_patroller_when_it_sees_the_cabin(self):
        page=self.game();self.prepare(page,b=0,locked=False)
        page.evaluate("addItem('seal');PatrolWorld.tick(1/60)")
        self.assert_js(page,"!hasItem('seal')&&PAT.state==='idle'&&!PAT.doorRush&&!S.dead")
        page.evaluate("Elevator.close('teach');Elevator.tick(1)")
        self.assert_js(page,"RunLog.snapshot().events.every(e=>e[2]!=='电梯门在它面前合上')")

    def test_rescue_cancels_the_old_rush_without_awarding_an_escape(self):
        page=self.game();self.prepare(page)
        page.evaluate("PatrolWorld.tick(1/60);window.armed=!!PAT.doorRush;PatrolWorld.rescued();Elevator.close('teach');Elevator.tick(1);PatrolWorld.tick(.1)")
        self.assert_js(page,"armed&&!PAT.doorRush&&!S.dead&&RunLog.snapshot().events.every(e=>e[2]!=='电梯门在它面前合上')")

    def test_saved_pending_departure_preserves_the_rush_and_awards_once(self):
        page=self.game();self.prepare(page)
        result=page.evaluate("""()=>{
          PatrolWorld.tick(1/60);Elevator.press(5);Elevator.tick(.4);const door=Elevator.doorAmount('teach',2);
          saveGame();const saved=loadGame();freshState('hard');running=false;applySave(saved);restoreSavePresentation();
          const restored=!!PAT.doorRush&&RT.elevatorRide.pending===5&&Elevator.doorAmount('teach',2)===door;
          for(let i=0;i<30;i++)update(1/30);
          return {restored,room:S.room,scores:RunLog.snapshot().events.filter(e=>e[2]==='电梯门在它面前合上').map(e=>e[3]),dead:S.dead};
        }""")
        self.assertTrue(result['restored']);self.assertEqual(result['room'],'lift_teach')
        self.assertEqual(result['scores'],[15]);self.assertFalse(result['dead'])
