"""假正常与前情切换的画面状态边界。"""
from browser_case import BrowserCase


class PresentationStatesTest(BrowserCase):
    def test_fake_normal_lighting_crosses_threshold_smoothly(self):
        page=self.page()
        result=page.evaluate("""()=>{
          doEnterRoom('teach1');S.tsec=1300;S.fn={on:true,v:71.9,next:999,left:4};
          GLR.fnNorm=1;let before=lightState();S.fn.v=72;let crossing=lightState();
          render(.1);let after=lightState();
          return {before:before.day,crossing:crossing.day,after:after.day,norm:GLR.fnNorm};
        }""")
        self.assertAlmostEqual(result['before'],result['crossing'])
        self.assertGreater(result['after'],0)
        self.assertLess(result['after'],result['before'])
        self.assertGreater(result['norm'],.8)

    def test_restarting_and_quitting_remove_fake_people_and_old_visual_state(self):
        page=self.page()
        result=page.evaluate("""()=>{
          doEnterRoom('teach1');S.fn={on:true,v:1,next:999,left:4};fnPeopleBuild();
          let old=FN_P.grp;GLR.fnNorm=1;VisualState.worldNorm=1;freshState('hard');running=false;
          let fresh=!FN_P.grp&&!GLR.scene.children.includes(old)&&GLR.fnNorm===0&&VisualState.worldNorm===0;
          doEnterRoom('teach1');S.fn={on:true,v:1,next:999,left:4};fnPeopleBuild();old=FN_P.grp;
          Game.quit();return {fresh,quit:!FN_P.grp&&!GLR.scene.children.includes(old)&&GLR.fnNorm===0};
        }""")
        self.assertEqual(result,{'fresh':True,'quit':True})

    def test_prologue_normal_world_and_wake_restore_visual_state(self):
        page=self.page()
        page.evaluate("doEnterRoom('teach1');S.fn={on:false,v:0};GLR.fnNorm=0;VisualState.worldNorm=0;window.worldBase=lightState().amb;proShow();render(.1)")
        self.assert_js(page,"PRO.on&&VisualState.worldNorm===1&&GLR.postMat.uniforms.uFx.value===1&&GLR.camLight.intensity>0")
        self.assert_js(page,'lightState().amb>worldBase*2')
        page.evaluate('proWake()')
        page.wait_for_function('PRO.woke&&PRO.see&&VisualState.worldNorm===0',timeout=4000)
        page.evaluate('render(.1)')
        self.assert_js(page,"GLR.postMat.uniforms.uFx.value===0&&GLR.camLight.intensity>0")
        page.evaluate('proEnd()')
        self.assert_js(page,'!PRO.on&&VisualState.worldNorm===0')

    def test_protected_fake_normal_death_does_not_leave_figures(self):
        page=self.page()
        page.evaluate("""doEnterRoom('teach1');S.diff='hard';S.talent='code';S.bag=['elixir'];
          S.fn={on:true,v:100,next:999,left:4};fnPeopleBuild();fnTick(.1)""")
        self.assert_js(page,"!S.dead&&!S.fn.on&&!FN_P.grp&&!hasItem('elixir')")

    def test_fake_people_do_not_remain_in_old_room_after_scene_change(self):
        page=self.page()
        page.evaluate("""doEnterRoom('teach1');S.fn={on:true,v:1,next:999,left:4,used:{}};
          fnPeopleBuild();window.oldFake=FN_P.grp;doEnterRoom('lab1');""")
        self.assert_js(page,"!FN_P.grp&&!GLR.scene.children.includes(oldFake)")
        page.evaluate('fnTick(.1)')
        self.assert_js(page,"FN_P.room==='lab1'&&!!FN_P.grp")
