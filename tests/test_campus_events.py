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

    def test_inspection_finishes_once_then_figures_scatter(self):
        page=self.game()
        result=page.evaluate("""()=>{
          Inspection.start({day:2,slot:0});let event=Inspection.state().current;
          let figure=INSPECT_FX.group.children[0],start=figure.position.clone();
          Inspection.finish(event);let san=S.san;Inspection.finish(event);
          Inspection.tick(.4);let moved=figure.position.distanceTo(start)>0;
          let fading=figure.children[0].material.opacity<1;
          Inspection.tick(.5);
          return {moved,fading,cleared:!INSPECT_FX.group,once:S.san===san,active:Inspection.active()};
        }""")
        self.assertEqual(result,{'moved':True,'fading':True,'cleared':True,'once':True,'active':False})

    def test_broadcast_warns_before_inspection_and_hud_asks_for_classroom(self):
        page=self.game()
        result=page.evaluate("""()=>{
          S.mode='out';S.room=null;S.tsec=760;updateHUD();let before=document.getElementById('period').textContent;
          let lines=[];let original=os;os=function(t){lines.push(t);return original.apply(this,arguments);};
          advanceGameTime(3);updateHUD();let during=document.getElementById('period').textContent;
          advanceGameTime(.5);let warnedOnce=lines.filter(t=>t.indexOf('学生会')>=0).length;
          S.tsec=769.99;advanceGameTime(.02);updateHUD();let after=Inspection.upcoming();
          os=original;
          return {before,during,warnedOnce,after,queued:Inspection.state().queue.length};
        }""")
        self.assertNotIn('教室', result['before'])
        self.assertIn('教室', result['during'])
        self.assertEqual(result['warnedOnce'],1)
        self.assertFalse(result['after'])
        self.assertEqual(result['queued'],1)

    def test_inspection_missed_inside_a_forced_flow_is_dropped_not_punished(self):
        """到点时玩家在电梯里或被异象拦住，太久以后不再补一场「不在教室」的检查。"""
        page=self.game()
        result=page.evaluate("""()=>{
          S.mode='out';S.room=null;S.san=80;S.viol=30;
          S.tsec=769.99;advanceGameTime(.02);let queued=Inspection.state().queue.length;
          AN.active=true;Inspection.tick(.1);let held=Inspection.active();
          advanceGameTime(4);AN.active=false;Inspection.tick(.1);
          let late={active:Inspection.active(),queue:Inspection.state().queue.length,san:S.san,viol:S.viol};
          S.tsec=1069.99;advanceGameTime(.02);advanceGameTime(1);Inspection.tick(.1);
          return {queued,held,late,soon:Inspection.active()};
        }""")
        self.assertEqual(result['queued'],1)
        self.assertFalse(result['held'])
        self.assertEqual(result['late'],{'active':False,'queue':0,'san':80,'viol':30})
        self.assertTrue(result['soon'])
