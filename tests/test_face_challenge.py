"""白名单挑战的入口、重试、存档和触屏路径。"""
import re

from browser_case import BrowserCase


class FaceChallengeTest(BrowserCase):
    def test_gate_challenge_cannot_be_bypassed_and_survives_reload(self):
        for touch in (False, True):
            with self.subTest(touch=touch):
                page = self.page(touch=touch)
                page.evaluate("""S.diff='hard';RT.hacked=true;RT.data=true;S.spots.data=1;
                  S.mode='out';S.x=GATE_N.x*SC;S.y=GATE_N.y*SC;chooseIdea('white')""")
                self.assert_js(page, "!UI.chooseOpen&&!RT.end")
                page.evaluate("S.x=GATE_W.x*SC;S.y=GATE_W.y*SC;chooseIdea('white')")
                self.assert_js(page, "UI.chooseOpen&&RT.faceQuiz.done===0&&!RT.end")
                answer_of = lambda i: page.evaluate('i=>FACE_QUESTIONS[i].choices[FACE_QUESTIONS[i].answer]', i)
                first = page.evaluate('RT.faceQuiz.order[0]')
                wrong = page.locator('#choices button').filter(has_text='暂时离开')
                wrong.tap() if touch else wrong.click()
                self.assert_js(page, '!UI.chooseOpen&&!RT.end')
                page.evaluate('tryGateWest()')
                buttons = page.locator('#choices button')
                mistake = 0 if page.evaluate('FACE_QUESTIONS[RT.faceQuiz.order[0]].answer') != 0 else 1
                san = page.evaluate('S.san')
                buttons.nth(mistake).tap() if touch else buttons.nth(mistake).click()
                # 答错扣 SAN、换一道没出过的题，进度不变
                self.assert_js(page, "UI.chooseOpen&&RT.faceQuiz.done===0&&!RT.end")
                self.assertLess(page.evaluate('S.san'), san)
                swapped = page.evaluate('RT.faceQuiz.order[0]')
                self.assertNotEqual(swapped, first)
                self.assertEqual(len(set(page.evaluate('RT.faceQuiz.order'))), 3)
                first = swapped
                answer = page.locator('#choices button').filter(has_text=re.compile(r'^\s*\d+'+re.escape(answer_of(first))+r'\s*$')).first
                answer.tap() if touch else answer.click()
                self.assert_js(page, 'RT.faceQuiz.done===1&&loadGame().rt.faceQuiz.done===1')
                page.evaluate("UI.closeChoice();let saved=loadGame();freshState('hard');running=false;applySave(saved);tryGateWest()")
                self.assert_js(page, 'UI.chooseOpen&&RT.faceQuiz.done===1')
                for _ in range(2):
                    question = page.evaluate('RT.faceQuiz.order[RT.faceQuiz.done]')
                    answer = page.locator('#choices button').filter(has_text=re.compile(r'^\s*\d+'+re.escape(answer_of(question))+r'\s*$')).first
                    answer.tap() if touch else answer.click()
                self.assert_js(page, "RT.faceQuiz.done===3&&UI.chooseOpen&&!RT.end")
                page.locator('#choices button').filter(has_text='通过闸机').first.click()
                self.assert_js(page, "RT.end==='face'&&!!endsSeen().face&&!loadGame()")
