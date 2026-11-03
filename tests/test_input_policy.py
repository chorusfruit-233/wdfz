"""输入归属和暂停矩阵：纯策略测试以及桌面 / 触屏交叉流程回归。"""
from pathlib import Path
import shutil
import subprocess
import unittest

from browser_case import BrowserCase


class InputPolicyUnitTest(unittest.TestCase):
    def test_pause_matrix_without_browser_or_renderer(self):
        node = shutil.which('node')
        if not node:
            self.skipTest('Node is required for the renderer-free policy check')
        root = Path(__file__).resolve().parents[1]
        script = r"""
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const sandbox = {};
vm.runInNewContext(fs.readFileSync('game3d/js/app/input-context.js', 'utf8'), sandbox);
const p = sandbox.GamePolicy;
// Contexts describe observable behavior, not the policy's implementation branches.
const cases = [
  [{screen:'menu'}, 'menu', 'inactive', false, false, false],
  [{screen:'play'}, 'play', 'player', true, true, true],
  [{screen:'play', prologue:true}, 'prologue', 'prologue', false, false, false],
  [{screen:'cut', prologue:true}, 'cutscene', 'cutscene', false, false, false],
  [{screen:'play', dead:true, deathPending:true}, 'death', 'death', false, false, true],
  [{screen:'play', dead:true}, 'death', 'inactive', false, false, true],
  [{screen:'play', paused:true, panelOpen:true}, 'play', 'pause', false, false, true],
  [{screen:'play', panelOpen:true}, 'play', 'panel', false, false, true],
  [{screen:'play', choice:true, panelOpen:true}, 'play', 'choice', false, false, true],
  [{screen:'play', computer:true}, 'play', 'computer', false, false, true],
  [{screen:'play', phone:true}, 'play', 'phone', false, true, true],
  [{screen:'play', lesson:true}, 'play', 'lesson', false, true, true],
  [{screen:'play', debugFrozen:true}, 'play', 'blocked', false, false, false],
  [{screen:'play', debugDragging:true}, 'play', 'blocked', false, true, true],
  [{screen:'play', targetDebug:true}, 'play', 'debug', true, true, true],
  [{screen:'play', editing:true}, 'play', 'text', true, true, true],
  [{screen:'play', intro:true}, 'play', 'blocked', false, false, true],
  [{screen:'play', terminal:true}, 'play', 'terminal', false, true, true],
  [{screen:'play', hidden:true}, 'play', 'player', false, false, false],
  [{screen:'play', driving:true}, 'play', 'driving', true, true, true],
];
for (const [context, mode, owner, player, simulation, presentation] of cases) {
  const before = JSON.stringify(context);
  assert.equal(p.mode(context), mode, before);
  assert.equal(p.inputOwner(context), owner, before);
  assert.equal(p.playerAllowed(context), player, before);
  assert.equal(p.simulationAllowed(context), simulation, before);
  assert.equal(p.presentationAllowed(context), presentation, before);
  assert.equal(JSON.stringify(context), before, 'Policy must not mutate its input');
}
// Focus in a debug text field belongs to the panel, even during a cutscene.
assert.equal(p.inputOwner({screen:'cut', targetDebug:true, editing:true}), 'debug');
// The policy loaded with no window, document, Three.js or live game globals.
"""
        subprocess.run([node, '-e', script], cwd=root, check=True, capture_output=True, text=True)


class InputPolicyBrowserTest(BrowserCase):
    def test_cutscene_skip_owns_keyboard_when_legacy_prologue_flag_is_set(self):
        page = self.page()
        page.evaluate("""
            S.screen='cut';PRO.on=true;PRO.i=0;
            window.__skipCalls=0;
            window.cutSkip=function(){window.__skipCalls++;};
            void 0;
        """)
        page.keyboard.down('Space')
        page.keyboard.down('Space')  # Repeated held key must not finish twice.
        page.keyboard.up('Space')
        self.assert_js(page, "__skipCalls===1&&PRO.i===0")
        page.keyboard.press('Enter')
        self.assert_js(page, "__skipCalls===2&&PRO.i===0")
        page.keyboard.press('Escape')
        self.assert_js(page, "__skipCalls===3&&PRO.i===0")
        page.locator('#pro').evaluate('(element)=>element.click()')
        self.assert_js(page, "__skipCalls===3&&PRO.i===0")

    def test_touch_skip_and_legacy_text_page_use_their_own_contexts(self):
        page = self.page(touch=True)
        page.evaluate("""
            S.screen='cut';PRO.on=true;PRO.i=0;
            window.__skipCalls=0;
            window.cutSkip=function(){window.__skipCalls++;S.screen='play';PRO.on=false;};
            void 0;
        """)
        self.touch(page, 'touchStart', [{'x': 190, 'y': 280}])
        self.touch(page, 'touchEnd', [])
        self.assert_js(page, "__skipCalls===1&&PRO.i===0&&playerInputAllowed()")
        page.evaluate("PRO.on=true;PRO.i=0;PRO.busy=false")
        page.keyboard.press('Enter')
        self.assert_js(page, "__skipCalls===1&&PRO.i===1")

    def test_context_exposes_debug_freeze_without_freezing_unfocused_panel(self):
        page = self.page()
        page.evaluate("Dev.open();DevLock.submit(DEV_CODE);DEV.freeze=false")
        self.assert_js(page, "GamePolicy.simulationAllowed(gameInputContext())&&playerInputAllowed()")
        page.evaluate("DEV.freeze=true")
        self.assert_js(page, "!GamePolicy.simulationAllowed(gameInputContext())&&!playerInputAllowed()")
        page.evaluate("DEV.freeze=false;DEV.drag={pointerId:999}")
        self.assert_js(page, "GamePolicy.simulationAllowed(gameInputContext())&&!playerInputAllowed()")
        page.evaluate("DEV.drag=null;Dev.close()")
        self.assert_js(page, "GamePolicy.inputOwner(gameInputContext())==='player'")


if __name__ == '__main__':
    unittest.main()
