"""传送门隧道、日记、图纸、旧档和材料流程。"""
from browser_case import BrowserCase


class PortalExplorationTest(BrowserCase):
    def game(self, touch=False):
        page=self.page(touch=touch)
        page.evaluate("""S.diff='hard';S.day=2;S.tsec=760;S.talent='code';S.san=80;
          AN.active=false;AN.id=null;AN.next=1000;patReset();PAT.next=1000;
          RT.inspection=null;doEnterRoom('lab1');running=false;""")
        return page

    def test_full_exploration_and_existing_materials_reach_ending(self):
        page=self.game()
        page.evaluate('portalBench()')
        self.assert_js(page,"UI.chooseOpen&&!RT.portalSketch")
        page.locator('#choices button').filter(has_text='进入隧道').click()
        page.wait_for_function("S.room==='portal_tunnel'")
        self.assertIn('不想靠近',page.locator('#sub').inner_text())
        page.evaluate('window.oldSan=S.san;updateSystems(2)')
        self.assert_js(page,"dangerAt()==='tunnel'&&Math.abs(S.san-(oldSan-1.2))<1e-6")
        page.evaluate("""var R=INTERIORS.portal_tunnel;S.x=R.ox+2.5*9;S.y=R.oy+3.5*9;S.ang=-Math.PI/2;
          tryInteract();window.clueCount=RT.clue;PortalExploration.readDiary();""")
        self.assert_js(page,"RT.portalDiary&&RT.clue===clueCount&&!RT.portalSketch&&loadGame().rt.portalDiary")
        self.assertIn('实验楼二楼、四楼和五楼',page.locator('#sub').inner_text())
        page.evaluate("""S.x=R.ox+3.5*9;S.y=R.oy+1.5*9;S.ang=-Math.PI/2;tryInteract()""")
        page.wait_for_function("S.room==='lab1'")
        self.assert_js(page,"RT.portalBaseSeen&&Collision.depth(S.x,S.y,PRAD)<1e-7")
        page.evaluate("""S.bag=['coin','chalk','snack','battery','pill','pen','notebook','memo'];
          for(const f of [2,4,5]){doEnterRoom('lab'+f);useFacility('K',INTERIORS[S.room]);}""")
        self.assert_js(page,"RT.portalSketch&&PortalExploration.count()===3&&S.bag.length===8&&loadGame().rt.portalSketch")
        page.evaluate("doEnterRoom('lab1');S.bag=['coil','lens','vial','battery'];portalBench()")
        page.locator('#choices button').filter(has_text='把它们接起来').click()
        page.wait_for_function("RT.portalOpen&&UI.chooseOpen",timeout=6000)
        page.locator('#choices button').filter(has_text='走进去').click()
        self.assert_js(page,"RT.end==='portal'&&endsSeen().portal&&!loadGame()")

    def test_old_sketch_and_opened_portal_remain_usable(self):
        page=self.game()
        page.evaluate("RT.portalSketch=1;S.bag=['coil','lens','vial','battery'];portalBench()")
        self.assert_js(page,"UI.chooseOpen&&document.getElementById('choices').textContent.includes('把它们接起来')")
        page.evaluate("UI.closeChoice();RT.portalSketch=0;RT.portalOpen=1;portalBench()")
        self.assert_js(page,"UI.chooseOpen&&document.getElementById('choices').textContent.includes('走进去')")

    def test_inspection_waits_until_player_leaves_tunnel(self):
        page=self.game()
        page.evaluate("""PortalExploration.enter();""")
        page.wait_for_function("S.room==='portal_tunnel'")
        page.evaluate("Inspection.cross(S.day,769,771);Inspection.tick(1)")
        self.assert_js(page,"Inspection.pending()&&!Inspection.active()")
        page.evaluate("PortalExploration.leave({r:23})")
        page.wait_for_function("S.room==='lab1'")
        page.evaluate("Inspection.tick(.01)")
        self.assert_js(page,'Inspection.active()')

    def test_tunnel_damage_uses_death_protection_and_survives_save(self):
        page=self.game(touch=True)
        page.evaluate('portalBench()')
        page.locator('#choices button').filter(has_text='进入隧道').tap()
        page.wait_for_function("S.room==='portal_tunnel'")
        page.evaluate("S.san=.4;S.bag=['elixir'];updateSystems(1);saveGame()")
        self.assert_js(page,"!S.dead&&!hasItem('elixir')&&S.san>=45&&loadGame().room==='portal_tunnel'")
        page.evaluate("let saved=loadGame();freshState('hard');running=false;applySave(saved)")
        self.assert_js(page,"S.room==='portal_tunnel'&&dangerAt()==='tunnel'&&!!RT.portalReturn")
        page.evaluate("S.san=.1;updateSystems(1)")
        self.assert_js(page,"S.dead&&!loadGame()")
