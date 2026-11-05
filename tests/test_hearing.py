"""Approved hearing talent: actual audible range, captions, cost and persisted rules."""
from browser_case import BrowserCase


class HearingTest(BrowserCase):
    def game(self):
        page=self.page()
        page.evaluate("freshState('hard');running=false;S.intro=0;PRO.on=false;S.screen='play';AN.active=false;AN.next=1e6;S.day=1;S.tsec=860;RT.inspection=null;Talent.begin('ear','selected')")
        return page

    def test_definition_rules_selection_and_save_are_consistent(self):
        page=self.game()
        self.assert_js(page,"TAL_KEYS.length===7&&TAL_KEYS[0]==='tech'&&Talent.rules()===4&&Talent.modifier('hear.range')===1.5&&Talent.modifier('dread.cooldown')===.8")
        page.evaluate("saveGame();const saved=loadGame();freshState('hard');running=false;applySave(saved);Game.pause()")
        self.assert_js(page,"S.talent==='ear'&&Talent.rules()===4")
        self.assertIn('顺风耳',page.locator('#ptalent').inner_text())
        page.evaluate("Game.resume();Talent.begin('code','selected')")
        self.assert_js(page,"Talent.modifier('hear.range')===1&&Talent.modifier('dread.cooldown')===1")

    def test_muted_captions_add_vertical_and_very_far_without_detecting_truth(self):
        page=self.game()
        result=page.evaluate("""()=>{
          SET.vol=0;SET.soundCaptions=0;SoundCaptions.reset();
          const event=SoundCaptions.publish('dread.steps',{place:{m:28,floor:'down',pan:0}});
          const hearing=event.text,visible=document.getElementById('soundcaptions').textContent;
          Talent.begin('code','selected');SoundCaptions.reset();
          const ordinary=SoundCaptions.publish('dread.steps',{place:{m:28,floor:'down',pan:0}}).text;
          return {hearing,visible,ordinary};
        }""")
        self.assertIn('楼下',result['hearing']);self.assertIn('很远',result['hearing']);self.assertIn('缓慢的脚步',result['visible'])
        self.assertNotIn('楼下',result['ordinary']);self.assertNotIn('很远',result['ordinary'])
        self.assertNotIn('巡察',result['hearing'])

    def test_real_patroller_is_heard_farther_without_changing_its_chase(self):
        page=self.game()
        rows=page.evaluate("""()=>{
          const calls=[],old=SFX.patStep;SFX.patStep=function(){calls.push([...arguments]);};
          const result=['code','ear'].map(talent=>{
            Talent.begin(talent,'selected');doEnterRoom('teach1');const a=PatrolNav.tilePoint('teach1',20,20),b=PatrolNav.tilePoint('teach1',48,20);
            S.x=a.x;S.y=a.y;S.seated=false;patReset();PatrolWorld.reset();
            Object.assign(PAT,{room:'teach1',x:b.x,y:b.y,fy:0,state:'walk',safety:0,warning:0,near:false,locked:false,afterBlink:0,step:0,transition:null});
            calls.length=0;PatrolWorld.tick(.01);
            return {calls:calls.length,place:calls[0]&&calls[0][4],x:PAT.x,y:PAT.y,locked:PAT.locked,warning:PAT.warning};
          });SFX.patStep=old;return result;
        }""")
        self.assertEqual(rows[0]['calls'],0);self.assertGreater(rows[1]['calls'],0)
        self.assertGreater(rows[1]['place']['m'],22)
        for key in ('x','y','locked','warning'):self.assertEqual(rows[0][key],rows[1][key])

    def test_false_threat_cooldown_is_eighty_percent_and_budget_stays_bounded(self):
        page=self.game()
        rows=page.evaluate("""()=>{
          S.mode='out';S.room=null;S.san=100;S.viol=0;GameRandom.bind(()=>.5);
          const old=Dread.falseThreat;Dread.falseThreat=()=>true;
          const result=['code','ear'].map(id=>{Talent.begin(id,'selected');Dread.reset();DREAD.t=100;DREAD.nextAmb=100;Dread.tick(10);return 100-DREAD.nextAmb;});
          Dread.falseThreat=old;return result;
        }""")
        self.assertAlmostEqual(rows[1]/rows[0],1.25,places=6)
