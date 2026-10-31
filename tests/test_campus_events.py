"""校园检查与停电：时间边界、处罚来源和场景表现。"""
from browser_case import BrowserCase


class CampusEventTest(BrowserCase):
    def game(self):
        page=self.page()
        page.evaluate("Game.start('hard');clearIntroTimers();running=false")
        page.wait_for_function("S.room==='teach1'&&GLR.roomMesh&&GLR.roomMesh.userData.roomData===INTERIORS.teach1")
        page.evaluate("S.intro=0;S.day=2;S.talent='code';S.san=80;S.viol=30;S.tt=10;AN.active=false;AN.id=null;AN.next=1000;patReset();PAT.next=1000")
        return page

    def test_schedule_crossings_are_once_per_day_and_survive_save(self):
        page=self.game()
        result=page.evaluate("""()=>{
          S.tsec=769.99;advanceGameTime(.02);let first=Inspection.state().queue.length;
          rewindGameTime(.02);advanceGameTime(.02);let again=Inspection.state().queue.length;
          S.tsec=1069.99;advanceGameTime(.02);let second=Inspection.state().queue.length;
          saveGame();let saved=loadGame();freshState('hard');running=false;applySave(saved);
          return {first,again,second,queue:Inspection.state().queue.length,seen:Object.keys(Inspection.state().seen).length};
        }""")
        self.assertEqual(result,{'first':1,'again':1,'second':2,'queue':2,'seen':2})

    def test_looking_and_motion_penalties_use_running_seconds(self):
        page=self.game()
        result=page.evaluate("""()=>{
          Inspection.start({day:2,slot:0});let c=Inspection.state().current;
          let p=c.points.find(Inspection.lineClear);if(!p)return {points:c.points.length,visible:false};
          S.pitch=0;S.ang=Math.atan2(p.y-S.y,p.x-S.x);S.moving=false;
          let san=S.san;Inspection.tick(.5);let half=S.san;Inspection.tick(.5);let whole=S.san;
          S.ang+=Math.PI;S.moving=true;let viol=S.viol;Inspection.tick(1);
          return {points:c.points.length,visible:true,half,whole,san,viol,after:S.viol,fx:!!INSPECT_FX.group};
        }""")
        self.assertTrue(result['visible'],result)
        self.assertGreater(result['points'],0)
        self.assertTrue(result['fx'])
        self.assertEqual(result['half'],result['san'])
        self.assertEqual(result['whole'],result['san']-2)
        self.assertEqual(result['after'],result['viol']+2)

    def test_evening_inspection_is_an_explicit_violation_exception(self):
        page=self.game()
        page.evaluate("S.tsec=1070;S.viol=30;addViolation(9);window.normal=S.viol;addViolation(9,'inspection');window.exception=S.viol")
        self.assert_js(page,'normal===30&&exception===39')
        page.evaluate("S.mode='out';S.room=null;S.san=80;S.viol=30;S.tt=10;Inspection.start({day:2,slot:1});Inspection.finish(Inspection.state().current)")
        self.assert_js(page,'S.san===72&&S.viol===40&&S.tt===7&&!Inspection.active()')

    def test_blackout_reduces_light_and_san_then_restores(self):
        page=self.game()
        result=page.evaluate("""()=>{
          S.san=80;AN.active=false;AN.id=null;updateLighting();
          let lit=GLR.camLight.intensity,normal=lightState().ptK;
          AN.active=true;AN.id='blackout';AN.t=0;AN.acc=0;AN.data={};updateLighting();
          let dim=GLR.camLight.intensity,dark=lightState().ptK;
          anTick(2);let san=S.san;
          AN.t=24;anTick(.01);updateLighting();
          return {lit,normal,dim,dark,san,active:AN.active,restored:GLR.camLight.intensity};
        }""")
        self.assertGreater(result['normal'],0)
        self.assertEqual(result['dark'],0)
        self.assertLess(result['dim'],result['lit']*.1)
        self.assertAlmostEqual(result['san'],78.6,places=5)
        self.assertFalse(result['active'])
        self.assertAlmostEqual(result['restored'],result['lit'],places=5)
