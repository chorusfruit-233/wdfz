"""驾驶追逐的开场、路线、保护、存档与触屏操作。"""
from browser_case import BrowserCase


class CarChaseTest(BrowserCase):
    def setup_car(self, touch=False):
        page=self.page(touch=touch)
        page.evaluate("""S.diff='hard';S.day=2;S.talent='code';S.bag=[];AN.active=false;AN.id=null;
          RT.inspection=null;doEnterRoom('garage1');running=false;""")
        return page

    def test_skipping_opening_does_not_skip_the_drive(self):
        page=self.setup_car()
        page.evaluate("CUT.enabled=true;carDrive()")
        self.assert_js(page, "CUT.on&&!endsSeen().car&&!!loadGame()")
        page.evaluate('cutSkip()')
        self.assert_js(page, "CarChase.active()&&RT.carChase.distance===0&&!RT.end&&!endsSeen().car&&!!loadGame()")
        self.assertTrue(page.locator('#drivehud').is_visible())

    def test_full_distance_obstacles_and_forks_are_required(self):
        page=self.setup_car()
        result=page.evaluate("""()=>{
          CUT.enabled=false;carDrive();KEY.w=true;
          let steps=0;
          while(CarChase.active()&&steps++<1000){
            let d=RT.carChase,target=d.distance<53?2.7:d.distance<85?-2.7:d.distance<150?2.7:-2.7;
            KEY.a=d.x>target+.15;KEY.d=d.x<target-.15;CarChase.tick(.05);
          }
          return {end:RT.end,seen:!!endsSeen().car,dead:S.dead,steps,save:!!loadGame()};
        }""")
        self.assertEqual(result['end'],'car',result)
        self.assertTrue(result['seen'])
        self.assertFalse(result['dead'])
        self.assertFalse(result['save'])

    def test_wrong_fork_uses_protection_and_resume_state_survives_save(self):
        page=self.setup_car()
        result=page.evaluate("""()=>{
          CUT.enabled=false;carDrive();let d=RT.carChase;
          d.distance=149.9;d.speed=20;d.x=0;d.nextObstacle=3;S.bag=['elixir'];KEY.w=true;
          CarChase.tick(.1);let guarded=!S.dead&&!hasItem('elixir')&&d.distance===120&&!RT.end;
          saveGame();let save=loadGame();freshState('hard');running=false;applySave(save);
          return {guarded,resumed:CarChase.active()&&RT.carChase.distance===120,seen:!!endsSeen().car};
        }""")
        self.assertEqual(result,{'guarded':True,'resumed':True,'seen':False})

    def test_touch_joystick_accelerates_and_pause_freezes_distance(self):
        page=self.setup_car(touch=True)
        page.evaluate('CUT.enabled=false;carDrive();updateTouchUI()')
        rect=page.locator('#stick').bounding_box()
        cx=rect['x']+rect['width']/2;cy=rect['y']+rect['height']/2
        self.touch(page,'touchStart',[{'x':cx,'y':cy}])
        self.touch(page,'touchMove',[{'x':cx,'y':cy-35}])
        page.evaluate('update(1)')
        self.assert_js(page,'RT.carChase.distance>0')
        self.touch(page,'touchEnd',[])
        page.evaluate("Game.pause();window.pausedAt=RT.carChase.distance;update(2)")
        self.assert_js(page,'RT.carChase.distance===pausedAt')

    def test_unprotected_crash_cleans_up_the_driving_scene(self):
        page=self.setup_car()
        page.evaluate("""CUT.enabled=false;carDrive();let d=RT.carChase;
          d.pursuit=CAR_CHASE_CONFIG.pursuitLimit-.1;d.speed=0;S.bag=[];S.talent='code';CarChase.tick(1)""")
        self.assert_js(page,"S.dead&&!RT.carChase&&!CAR_VIS.group&&GLR.outMesh.visible&&!endsSeen().car&&!loadGame()&&Collision.depth(S.x,S.y,PRAD)<1e-7")

    def test_quit_and_continue_restore_the_driving_scene(self):
        page=self.setup_car()
        page.evaluate("""CUT.enabled=false;carDrive();KEY.w=true;CarChase.tick(2);
          window.savedDistance=RT.carChase.distance;Game.quit();Game.continue_();running=false;""")
        page.wait_for_function("CarChase.active()&&RT.carChase.distance===savedDistance")
        page.evaluate('CarChase.draw()')
        self.assert_js(page,"!!CAR_VIS.group&&!GLR.outMesh.visible&&document.body.classList.contains('driving')")

    def test_touch_dashboard_stays_clear_of_controls_and_subtitles(self):
        page=self.setup_car(touch=True)
        page.evaluate('CUT.enabled=false;carDrive();CarChase.draw();updateTouchUI()')
        for viewport in ({'width':390,'height':844},{'width':844,'height':390}):
            with self.subTest(viewport=viewport):
                page.set_viewport_size(viewport)
                hud=page.locator('#drivehud').bounding_box()
                stick=page.locator('#stick').bounding_box()
                sub=page.locator('#sub').bounding_box()
                def overlaps(a,b):
                    return (a and b and a['x']<b['x']+b['width'] and b['x']<a['x']+a['width'] and
                            a['y']<b['y']+b['height'] and b['y']<a['y']+a['height'])
                self.assertFalse(overlaps(hud,stick),(hud,stick))
                self.assertFalse(overlaps(hud,sub),(hud,sub))
