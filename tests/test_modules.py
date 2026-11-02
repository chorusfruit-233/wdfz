"""模块化与 Mod 入口：清单、导出、钩子、Mod 加载 / 上传 / 安全模式 / 出错隔离、模块状态存档。

规范见 docs/模块化与Mod规范.md。"""
import json
import re
import shutil
import subprocess
from pathlib import Path
import unittest

from browser_case import BrowserCase

ROOT = Path(__file__).resolve().parents[1]


def manifest():
    """用 node 读出清单（不启动浏览器）。"""
    node = shutil.which('node')
    if not node:
        raise unittest.SkipTest('需要 node')
    script = """const fs=require('fs');const out=[];global.GameModules={define:m=>out.push(m)};
      eval(fs.readFileSync('game3d/manifest.js','utf8'));console.log(JSON.stringify(out));"""
    return json.loads(subprocess.run([node, '-e', script], cwd=ROOT, check=True, capture_output=True, text=True).stdout)


class ManifestStaticTest(unittest.TestCase):
    def test_every_script_is_registered_once_and_index_uses_the_loader(self):
        mods = manifest()
        files = [f for m in mods for f in m['files']]
        self.assertEqual(len(files), len(set(files)), '同一个文件登记了两次')
        for f in files:
            self.assertTrue((ROOT / f).is_file(), f)
        on_disk = sorted(str(p.relative_to(ROOT)) for p in (ROOT / 'game3d/js').rglob('*.js'))
        on_disk.remove('game3d/js/modules.js')                     # 注册表本身由 index.html 直接加载
        self.assertEqual(sorted(f for f in files if f.startswith('game3d/js/')), on_disk, '有脚本没进清单')
        html = (ROOT / 'index.html').read_text(encoding='utf-8')
        self.assertEqual(re.findall(r'<script src="([^"]+)"', html), ['game3d/js/modules.js', 'game3d/manifest.js'])
        self.assertIn('GameModules.boot()', html)
        self.assertEqual(files[-1], 'game3d/js/main.js', '主循环必须最后加载')
        ids = [m['id'] for m in mods]
        self.assertEqual(len(ids), len(set(ids)))
        for m in mods:
            self.assertRegex(m['id'], r'^[a-z][a-z0-9-]*$')
            self.assertTrue(m.get('name') and m.get('desc') and m.get('exports'), m['id'])

    def test_feature_logic_files_do_not_touch_the_renderer(self):
        """新模块把逻辑和画面分开：逻辑文件里不出现 THREE / GLR。"""
        for rel in ('game3d/js/modules/void-maze/maze-data.js', 'game3d/js/modules/void-maze/maze.js',
                    'game3d/js/modules/chalk-marks/marks.js', 'game3d/js/modules.js'):
            src = (ROOT / rel).read_text(encoding='utf-8')
            self.assertIsNone(re.search(r'\b(?:THREE|GLR)\s*\.', src), rel)

    def test_declared_hooks_match_the_code(self):
        mods = manifest()
        emitted = {'reset', 'loaded'}                              # modules.js 自己发的
        for m in mods:
            src = '\n'.join((ROOT / f).read_text(encoding='utf-8') for f in m['files'] if f.endswith('.js') and 'lib/' not in f)
            for name in m.get('emits', []):
                self.assertRegex(src, r"GameModules\.(emit|first)\('" + name + "'", f"{m['id']} 声明发出 {name}，代码里没有")
                emitted.add(name)
            for name in re.findall(r"GameModules\.(?:emit|first)\('([A-Za-z]+)'", src):
                self.assertIn(name, m.get('emits', []), f"{m['id']} 发出了 {name}，清单没登记")
        for m in mods:
            for name in m.get('uses', []):
                self.assertIn(name, emitted, f"{m['id']} 用到的钩子 {name} 没有人发")
        spec = (ROOT / 'docs/模块化与Mod规范.md').read_text(encoding='utf-8')
        for name in emitted:
            self.assertIn('`' + name + '`', spec, f'规范里没写钩子 {name}')


class ModuleBrowserTest(BrowserCase):
    def open(self, query='', script=None):
        context = self.browser.new_context(viewport={'width': 1000, 'height': 700})
        self.contexts.append(context)
        context.add_init_script("localStorage.setItem('wdfz_pro','1');localStorage.setItem('zw3d_set',JSON.stringify({q:0,amb:0,vol:0}));")
        if script:
            context.add_init_script(script)
        page = context.new_page()
        page.on('pageerror', lambda e: self.errors.append(str(e)))
        page.goto(self.url + query, wait_until='load')
        page.evaluate("PHOTO_TRIED=true;running=false")
        return page

    def test_all_modules_load_and_verify_without_mods(self):
        page = self.open()
        result = page.evaluate("""()=>({bad:GameModules.modules().filter(m=>m.status!=='ok').map(m=>m.id),
          n:GameModules.modules().length, mods:GameModules.mods().length, errors:GameModules.errors(),
          hooks:GameModules.hookNames(), panel:!!document.getElementById('modTools'),
          devTab:DEV_TABS.indexOf('mods')>=0&&!!document.getElementById('dev-page-mods')})""")
        self.assertEqual(result['bad'], [])
        self.assertGreaterEqual(result['n'], 38)
        self.assertEqual(result['mods'], 0)
        self.assertEqual(result['errors'], [])
        for hook in ('interiors', 'tick', 'interact', 'itemUse', 'sceneBuilt', 'clearWorld', 'lightState'):
            self.assertIn(hook, result['hooks'])
        self.assertTrue(result['panel'] and result['devTab'])

    def test_url_mod_loads_and_safe_mode_skips_it(self):
        page = self.open('?mod=example-hello')
        mods = page.evaluate('GameModules.mods()')
        self.assertEqual([(m['id'], m['source'], m['status']) for m in mods], [('example-hello', 'builtin', 'active')])
        self.assert_js(page, "ITEMS.mod_note&&ITEMS.mod_note.n==='示例纸条'&&typeof ITEM_USE.mod_note==='function'")
        page = self.open('?mod=example-hello&nomod')
        self.assert_js(page, 'GameModules.safeMode()&&GameModules.mods().length===0&&!ITEMS.mod_note')

    def test_builtin_switch_and_upload_persist_across_reload(self):
        page = self.open()
        self.assert_js(page, "GameModules.builtinList().some(m=>m.id==='example-hello'&&!m.enabled)")
        bad = page.evaluate("GameModules.upload('x.js','console.log(1)')")
        self.assertFalse(bad['ok'])
        good = page.evaluate("""GameModules.upload('beep.js',
          "GameModules.mod({id:'beep',name:'哔',api:'1.0',init:function(api){window.__beep=api.version;api.on('enterRoom',function(id){window.__beepRoom=id;});}});")""")
        self.assertTrue(good['ok'])
        self.assertEqual(good['id'], 'beep')
        page.evaluate("GameModules.setBuiltin('example-hello',true)")
        page.reload(wait_until='load')
        page.evaluate("PHOTO_TRIED=true;running=false")
        result = page.evaluate("""()=>({mods:GameModules.mods().map(m=>m.id+':'+m.source+':'+m.status), beep:window.__beep,
          up:GameModules.uploaded().map(m=>m.id+':'+m.enabled)})""")
        self.assertIn('beep:upload:active', result['mods'])
        self.assertIn('example-hello:builtin:active', result['mods'])
        self.assertEqual(result['beep'], '1.0')
        self.assertEqual(result['up'], ['beep:true'])
        page.evaluate("GameModules.setUploaded('beep',false);GameModules.setBuiltin('example-hello',false)")
        page.reload(wait_until='load')
        page.evaluate("PHOTO_TRIED=true;running=false")
        self.assert_js(page, "GameModules.mods().length===0&&GameModules.uploaded()[0].enabled===false")
        page.evaluate("GameModules.removeUploaded('beep')")
        self.assert_js(page, 'GameModules.uploaded().length===0')

    def test_broken_mod_and_hook_errors_are_isolated(self):
        page = self.open()
        result = page.evaluate("""()=>{
          const m=GameModules.mod({id:'broken',api:'1.0',hooks:{tick:function(){}},init:function(){throw new Error('boom');}});
          const old=GameModules.mod({id:'oldapi',api:'0.1'});
          let after=0;
          GameModules.on('tick',function(){throw new Error('tick boom');},{owner:'t'});
          GameModules.on('tick',function(){after++;},{owner:'t2'});
          GameModules.emit('tick',0.016);
          const errs=GameModules.errors().map(e=>e.who+':'+e.message);
          return {status:m.status, old:old.status, after, errs, stillHooked:GameModules.hookNames().indexOf('tick')>=0};
        }""")
        self.assertEqual(result['status'], 'failed')
        self.assertEqual(result['old'], 'incompatible')
        self.assertEqual(result['after'], 1)
        self.assertIn('broken:boom', result['errs'])
        self.assertIn('t:tick boom', result['errs'])

    def test_module_state_is_saved_under_mods_and_reset_on_new_game(self):
        page = self.page()
        page.evaluate("""Game.start('hard');""")
        page.wait_for_function("S.room==='teach1'")
        result = page.evaluate("""()=>{
          running=false;let v=0;
          GameModules.mod({id:'counter',api:'1.0',init:function(api){api.store({save:()=>({v:v}),load:d=>{v=d.v;},reset:()=>{v=0;}});}});
          v=7;saveGame();const d=loadGame();
          freshState('hard');running=false;const afterNew=v;
          applySave(d);return {saved:d.mods['mod:counter'], afterNew, loaded:v, chalk:!!d.mods['chalk-marks']};
        }""")
        self.assertEqual(result['saved'], {'v': 7})
        self.assertEqual(result['afterNew'], 0)
        self.assertEqual(result['loaded'], 7)
        self.assertTrue(result['chalk'])

    def test_feature_modules_can_be_removed_from_the_manifest(self):
        """从清单里拿掉虚空迷宫、粉笔记号、Mod 管理三个功能模块，游戏照常启动；电梯退回原来的白色空间。"""
        context = self.browser.new_context(viewport={'width': 1000, 'height': 700})
        self.contexts.append(context)
        context.add_init_script("localStorage.setItem('wdfz_pro','1');localStorage.setItem('zw3d_set',JSON.stringify({q:0,amb:0,vol:0}));")
        src = (ROOT / 'game3d/manifest.js').read_text(encoding='utf-8')
        src = src.replace("].forEach(function(m){ GameModules.define(m); });",
                          "].filter(function(m){ return ['void-maze','chalk-marks','mod-manager'].indexOf(m.id)<0; }).forEach(function(m){ GameModules.define(m); });")
        context.route('**/game3d/manifest.js', lambda route: route.fulfill(status=200, content_type='text/javascript', body=src))
        page = context.new_page()
        page.on('pageerror', lambda e: self.errors.append(str(e)))
        page.goto(self.url, wait_until='load')
        page.evaluate("PHOTO_TRIED=true;running=false;CUT.enabled=false;Game.start('hard')")
        page.wait_for_function("S.room==='teach1'")
        result = page.evaluate("""()=>{running=false;clearIntroTimers();S.intro=0;AN.active=false;AN.next=1e5;PAT.next=1e5;RT.inspection=null;
          const n=GameModules.modules().length, bad=GameModules.modules().filter(m=>m.status!=='ok').length;
          doEnterRoom('lab1',Elevator.landing('lab',1));Math.random=()=>0;Elevator.board('lab',1);Elevator.enterDream('67');
          const inside=S.room, old=!INTERIORS.lift_dream.build&&INTERIORS.lift_dream.cols===18;
          S.x=INTERIORS.lift_dream.ox+15.5*9;S.y=INTERIORS.lift_dream.oy+5.5*9;S.ang=0;tryInteract();
          S.bag.push('chalk');useItem('chalk');
          return {n,bad,maze:typeof VoidMaze,chalk:typeof ChalkMarks,inside,old,back:S.room,panel:!!document.getElementById('modTools'),
            sub:document.getElementById('sub').innerText}}""")
        self.assertEqual(result['n'], 35)
        self.assertEqual(result['bad'], 0)
        self.assertEqual((result['maze'], result['chalk']), ('undefined', 'undefined'))
        self.assertEqual(result['inside'], 'lift_dream')
        self.assertTrue(result['old'])
        self.assertEqual(result['back'], 'lab1')
        self.assertFalse(result['panel'])
        self.assertIn('粉笔', result['sub'])                      # 没有记号模块：粉笔回到「看一眼说明」

    def test_mod_panel_imports_a_file_from_the_pause_menu(self):
        page = self.page()
        page.evaluate("Game.start('hard')")
        page.wait_for_function("S.room==='teach1'")
        page.evaluate("running=false;clearIntroTimers();S.intro=0;Game.pause()")
        self.assert_js(page, "PAUSE.on&&getComputedStyle(document.getElementById('pause')).display!=='none'")
        page.locator('#modTools > summary').click()
        page.wait_for_function("document.getElementById('modTools').open&&document.getElementById('modToolsBody').innerText.indexOf('个模块')>=0")
        page.locator('#modToolsBody input[type=file]').set_input_files(files=[{
            'name': 'note.js', 'mimeType': 'text/javascript',
            'buffer': "GameModules.mod({id:'note-mod',name:'便条',api:'1.0'});".encode('utf-8')}])
        page.wait_for_function("GameModules.uploaded().some(m=>m.id==='note-mod')")
        self.assertIn('note-mod', page.locator('#modToolsBody').inner_text())
        page.evaluate("GameModules.removeUploaded('note-mod')")


if __name__ == '__main__':
    unittest.main()
