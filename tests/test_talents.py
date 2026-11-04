"""《天赋系统重构》M0–M3：缺陷修复、统一定义、新局选择、反馈与试验效果。"""
from browser_case import BrowserCase


class TalentTest(BrowserCase):
    def game(self, talent='code', diff='hard'):
        page = self.page()
        page.evaluate(f"""Game.start('{diff}',{{talent:'{talent}'}});clearIntroTimers();running=false;
          AN.active=false;AN.next=1e6;PAT.next=1e6;S.intro=0;S.day=2;S.bag=[];""")
        page.wait_for_function("S.room==='teach1'&&GLR.roomMesh&&GLR.roomMesh.userData.roomData===INTERIORS.teach1")
        page.evaluate('running=false;clearIntroTimers()')
        return page

    def test_picker_only_starts_on_confirm_and_back_keeps_the_save(self):
        page = self.page()
        page.evaluate("S.screen='menu';document.getElementById('menu').style.display='block'")
        page.evaluate("localStorage.setItem('wdfz3d',JSON.stringify({keep:1}))")
        page.locator('#menu .mcard').first.click()
        self.assert_js(page, "!document.getElementById('tpick').hidden&&document.querySelectorAll('#tpcards .tpcard').length===7&&document.getElementById('tpGo').disabled")
        self.assert_js(page, "S.screen==='menu'&&JSON.parse(localStorage.getItem('wdfz3d')).keep===1")
        self.assertIn('暗处适应', page.locator('#tpcards').inner_text())
        self.assertIn('限制', page.locator('#tpcards').inner_text())
        page.keyboard.press('Escape')
        self.assert_js(page, "document.getElementById('tpick').hidden&&JSON.parse(localStorage.getItem('wdfz3d')).keep===1")
        page.locator('#menu .mcard').nth(1).click()
        page.locator('#tpcards .tpcard[data-id="watch"]').click()
        self.assert_js(page, "!document.getElementById('tpGo').disabled&&S.screen==='menu'")
        page.locator('#tpGo').click()
        page.wait_for_function("S.screen==='play'&&S.room==='teach1'")
        self.assert_js(page, "S.diff==='hard'&&S.talent==='watch'&&Talent.state().origin==='selected'&&Talent.rules()===4")
        page.evaluate("Game.quit&&Game.quit();S.screen='menu';document.getElementById('menu').style.display='block'")
        page.locator('#menu .mcard').first.click()
        page.locator('#tpRandom').click()
        page.wait_for_function("S.screen==='play'")
        self.assert_js(page, "TAL_KEYS.indexOf(S.talent)>=0&&Talent.state().origin==='random'")

    def test_immune_use_is_saved_at_once_and_pause_shows_it(self):
        page = self.game('immune')
        page.evaluate("S.screen='play';saveGame();AN.active=false;S.san=50;kill('测试','grip','patrol')")
        page.wait_for_timeout(50)
        self.assert_js(page, "!S.dead&&S.immuneUsed&&loadGame().talentState.consumed.fatalProtection===true&&loadGame().immuneUsed===true")
        page.evaluate("Game.pause()")
        self.assertIn('已经用掉了', page.locator('#ptalent').inner_text())
        page.evaluate("Game.resume();kill('又一次','grip','patrol')")
        self.assert_js(page, "S.dead")

    def test_unknown_or_missing_ids_load_as_no_talent_and_the_view_is_rebuilt(self):
        page = self.game('watch')
        page.evaluate("Game.pause()")
        self.assertIn('守时', page.locator('#ptalent').inner_text())
        page.evaluate("Game.resume();let d=loadGame()||{};saveGame();d=loadGame();d.talent='bogus';delete d.talentState;freshState('hard');running=false;applySave(d);Game.pause()")
        self.assert_js(page, "S.talent==='none'")
        self.assertNotIn('守时', page.locator('#ptalent').inner_text())
        self.assertIn('没有天赋', page.locator('#ptalent').inner_text())
        page.evaluate("Game.resume();S.talent='code';saveGame();let d=loadGame();delete d.talent;S.talent='night';applySave(d)")
        self.assert_js(page, "S.talent==='none'")
        page.evaluate("S.talent='map';Game.pause()")
        self.assertIn('旧版特性', page.locator('#ptalent').inner_text())

    def test_old_saves_keep_old_rules_and_consumed_protection(self):
        page = self.game('immune')
        page.evaluate("""saveGame();let d=loadGame();delete d.talentState;d.immuneUsed=true;d.talent='immune';
          freshState('hard');running=false;applySave(d)""")
        self.assert_js(page, "S.talent==='immune'&&S.immuneUsed&&Talent.rules()===1&&Talent.state().origin==='legacy'")
        page.evaluate("S.bag=[];kill('x','grip','patrol')")
        self.assert_js(page, "S.dead")

    def test_drive_without_key_hotwires_slower_and_hints_match(self):
        page = self.game('drive')
        page.evaluate("Investigation.notice();UI.closeChoice()")
        goal = page.evaluate('Investigation.goal()')
        self.assertIn('搭线', goal)
        self.assertNotIn('钥匙上的牌号', goal)
        self.assert_js(page, "Talent.capability('car').via==='hotwire'&&Talent.capability('car').sec===4.8")
        page.evaluate("S.bag=['key']")
        self.assert_js(page, "Talent.capability('car').via==='key'&&Talent.capability('car').sec===1.6")
        page.evaluate("S.bag=[];S.talent='code'")
        self.assert_js(page, "!Talent.capability('car').ok")

    def test_modifiers_apply_only_to_their_sources(self):
        page = self.game('night')
        self.assert_js(page, "Talent.modifier('danger.garage')===0.55&&Talent.modifier('danger.night')===0.55&&Talent.modifier('danger.trash')===1")
        page.evaluate("S.talent='stomach'")
        self.assert_js(page, "Talent.modifier('anomaly.feast')===9&&Talent.modifier('activity.eat')===18")
        page.evaluate("Talent.state().rulesVersion=1")
        self.assert_js(page, "Talent.modifier('activity.eat')===18&&Talent.modifier('anomaly.feast')===9")
        page.evaluate("S.talent='code';Talent.state().rulesVersion=2")
        self.assert_js(page, "Talent.modifier('activity.eat')===18&&Talent.modifier('anomaly.feast')===9&&Talent.modifier('danger.garage')===1")
        page.evaluate("S.talent='stomach';S.san=50;S.actCool={};doSanAct('eat')")
        # 旧铁胃不再有隐含加成；第二天恢复仍按原压力倍率结算。
        self.assert_js(page, "CampusPressure.current().rest<1&&S.san===50+CampusPressure.restGain(18)")

    def test_watch_reminds_once_and_never_for_skipped_marks(self):
        page = self.game('watch')
        page.evaluate("S.day=2;S.tsec=730;window.said=[];os=function(m){said.push(m)};Talent.tickWatch();Talent.tickWatch()")
        self.assertEqual(page.evaluate('said.length'), 1)
        self.assertIn('午饭开饭了', page.evaluate('said[0]'))
        page.evaluate("S.tsec=1100;Talent.tickWatch();S.tsec=1085;Talent.tickWatch()")
        self.assertEqual(page.evaluate('said.length'), 1)
        page.evaluate("S.talent='code';S.tsec=1335;Talent.tickWatch()")
        self.assertEqual(page.evaluate('said.length'), 1)
        self.assertNotRegex(page.evaluate("said.join('')"), r'\d{1,2}:\d{2}')

    def test_code_remedy_spares_one_wrong_answer_only(self):
        page = self.game('code')
        wrong = "(()=>{let q=FaceChallenge.state();return (FACE_QUESTIONS[q.order[q.done]].answer+1)%3;})()"
        page.evaluate("RT.hacked=true;RT.data=true;S.san=80;FaceChallenge.open()")
        page.locator('#choices button').nth(page.evaluate(wrong)).click()
        self.assert_js(page, "S.san===80&&Talent.state().consumed.faceRemedy")
        self.assertIn('编程社', page.locator('#choices').inner_text())
        page.evaluate("UI.closeChoice();FaceChallenge.open()")
        page.locator('#choices button').nth(page.evaluate(wrong)).click()
        self.assert_js(page, "S.san<80")

    def test_journal_lists_the_talent_with_limit_and_recent_use(self):
        page = self.game('immune')
        page.evaluate("kill('x','grip','patrol');UI.open('note')")
        text = page.locator('#notein').inner_text()
        self.assertIn('本局能力', text)
        self.assertIn('天生免疫', text)
        self.assertIn('已经用掉了', text)
        self.assertIn('挡下了一次', text)
