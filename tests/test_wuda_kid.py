"""隐藏彩蛋天赋「武大子弟」（内部内容，不进玩家 Wiki）：主菜单连点三下校名切换；新开局自带手电、和正常天赋叠加；
不出现在天赋选择、随机池和暂停说明里；读档按存档、速通不给；从清单拿掉后游戏照常。"""
from pathlib import Path

from browser_case import BrowserCase

ROOT = Path(__file__).resolve().parents[1]
START = """(o)=>{Game.start('hard',o);}"""
READY = "S.room==='teach1'&&GLR.roomMesh"
QUIET = "running=false;clearIntroTimers();S.intro=0;AN.active=false;AN.next=1e5;PAT.next=1e5;RT.inspection=null;"


class WudaKidTest(BrowserCase):
    def start(self, page, **opt):
        page.evaluate(START, opt)
        page.wait_for_function(READY)
        page.evaluate(QUIET)

    def test_menu_school_name_toggles_it_with_three_quick_clicks(self):
        page = self.page()
        page.evaluate("document.getElementById('menu').style.display='block';S.screen='menu';localStorage.removeItem('wdfz_wuda')")
        name = page.locator('#menu .mschool')
        name.click()
        name.click()
        self.assertFalse(page.evaluate('WudaKid.armed()'))              # 两下不算
        name.click()
        r = page.evaluate("""()=>({armed:WudaKid.armed(),stored:localStorage.getItem('wdfz_wuda'),
          on:document.querySelector('#menu .mschool').classList.contains('wuda-on'),toast:document.getElementById('toast').textContent})""")
        self.assertEqual(r['armed'], True)
        self.assertEqual(r['stored'], '1')
        self.assertTrue(r['on'])
        self.assertIn('珞珈山', r['toast'])
        for _ in range(3):
            name.click()
        self.assertFalse(page.evaluate('WudaKid.armed()'))
        self.assertIsNone(page.evaluate("localStorage.getItem('wdfz_wuda')"))
        # 慢慢点（超过 1.6 秒）不算
        r = page.evaluate("""()=>{const el=document.querySelector('#menu .mschool');
          return [WudaKid.tap(el,1000),WudaKid.tap(el,2000),WudaKid.tap(el,3700),WudaKid.armed()];}""")
        self.assertEqual(r, [None, None, None, False])

    def test_new_game_brings_a_torch_and_stacks_with_the_chosen_talent(self):
        page = self.page()
        page.evaluate("localStorage.setItem('wdfz_wuda','1')")
        self.start(page, talent='night', origin='selected')
        r = page.evaluate("""()=>{const pick=(TalentPick.open('hard'),Array.from(document.querySelectorAll('#tpcards .tpcard')).map(b=>b.textContent).join('|'));
          TalentPick.close();
          return {talent:S.talent,bag:S.bag.slice(),hot:S.hot.slice(),active:WudaKid.active(),pause:Talent.pauseText(),
            pick,keys:TAL_KEYS.slice(),def:typeof TALENT_DEF.wuda};}""")
        self.assertEqual(r['talent'], 'night')                           # 正常天赋照旧
        self.assertEqual(r['bag'], ['torch'])                            # 叠加：开局自带手电
        self.assertEqual(r['hot'][0], 'torch')
        self.assertTrue(r['active'])
        for text in (r['pause'], r['pick'], ' '.join(r['keys'])):          # 隐藏：选择、随机池、暂停说明里都没有
            self.assertNotIn('武大', text)
        self.assertEqual(r['def'], 'undefined')
        # 走几秒后自言自语一句，只说一次
        r = page.evaluate("""()=>{const said=[];const o=window.os;window.os=function(t){said.push(t);return o.apply(this,arguments);};
          for(let i=0;i<60*9;i++)update(1/60);window.os=o;return said.filter(t=>t.indexOf('手电')>=0);}""")
        self.assertEqual(len(r), 1)
        self.assertIn('珞珈山', r[0])

    def test_off_by_default_never_in_speedrun_and_saves_follow_the_run(self):
        page = self.page()
        page.evaluate("localStorage.removeItem('wdfz_wuda')")
        self.start(page, talent='watch', origin='selected')
        self.assertEqual(page.evaluate('[S.bag.slice(),WudaKid.active()]'), [[], False])
        # 速通局：开着也不给
        page.evaluate("localStorage.setItem('wdfz_wuda','1')")
        self.start(page, talent='watch', origin='selected', mode='speedrun')
        self.assertEqual(page.evaluate('[S.bag.indexOf("torch"),WudaKid.active()]'), [-1, False])
        page.evaluate("Speedrun.disarm();RUN_MODE='normal'")
        # 读档按存档：开着开的局存档 → 关掉开关 → 继续上次，仍然生效；手电来自存档
        self.start(page, talent='watch', origin='selected')
        r = page.evaluate("""()=>{saveGame();const d=loadGame();localStorage.removeItem('wdfz_wuda');
          Game.continue_();return {saved:d.mods['wuda-kid'],active:WudaKid.active(),torch:S.bag.filter(i=>i==='torch').length};}""")
        self.assertEqual(r['saved']['on'], True)
        self.assertEqual((r['active'], r['torch']), (True, 1))
        # 没开时开的局：之后再打开开关、读档，也不会凭空多一支手电
        self.start(page, talent='watch', origin='selected')
        r = page.evaluate("""()=>{saveGame();localStorage.setItem('wdfz_wuda','1');Game.continue_();
          return {active:WudaKid.active(),bag:S.bag.slice(),saved:(loadGame().mods||{})['wuda-kid']};}""")
        self.assertEqual(r, {'active': False, 'bag': [], 'saved': None})

    def test_module_can_be_removed_and_wiki_keeps_the_secret(self):
        context = self.browser.new_context(viewport={'width': 1000, 'height': 700})
        self.contexts.append(context)
        context.add_init_script("localStorage.setItem('wdfz_pro','1');localStorage.setItem('zw3d_set',JSON.stringify({q:0,amb:0,vol:0}));localStorage.setItem('wdfz_wuda','1');")
        src = (ROOT / 'game3d/manifest.js').read_text(encoding='utf-8')
        src = src.replace("].forEach(function(m){ GameModules.define(m); });",
                          "].filter(function(m){ return m.id!=='wuda-kid'; }).forEach(function(m){ GameModules.define(m); });")
        context.route('**/game3d/manifest.js', lambda route: route.fulfill(status=200, content_type='text/javascript', body=src))
        page = context.new_page()
        page.on('pageerror', lambda e: self.errors.append(str(e)))
        page.goto(self.url, wait_until='load')
        page.evaluate("PHOTO_TRIED=true;running=false;CUT.enabled=false;Game.start('hard',{talent:'night',origin:'selected'})")
        page.wait_for_function("S.room==='teach1'")
        r = page.evaluate("({kid:typeof WudaKid,bag:S.bag.slice(),errors:GameModules.errors().length})")
        self.assertEqual(r, {'kid': 'undefined', 'bag': [], 'errors': 0})
        for path in (ROOT / 'wiki').rglob('*'):
            if path.is_file() and path.suffix in ('.html', '.css', '.js', '.json', '.md', '.txt'):
                text = path.read_text(encoding='utf-8')
                for word in ('武大子弟', '珞珈', 'wuda', 'wdfz_wuda'):
                    self.assertNotIn(word, text, path.name)
