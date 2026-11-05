"""自带 DLC「规则怪谈」（计划《规则怪谈、纸飞机与窗内视线》M1／M6 首版）：默认关闭、载体与证据、三个切片、门外有你的名字。"""
from browser_case import BrowserCase


class CampusRulesTest(BrowserCase):
    def game(self, on=True):
        page = self.browser.new_context(viewport={'width': 1000, 'height': 700}).new_page()
        page.add_init_script("localStorage.setItem('wdfz_pro','1');localStorage.setItem('zw3d_set',JSON.stringify({q:0,amb:0,vol:0,renderer:'webgl'}));localStorage.removeItem('wdfz3d_rules_records_v1');")
        self.errs = []
        page.on('pageerror', lambda e: self.errs.append(str(e)))
        page.goto(self.url + ('?mod=campus-rules' if on else ''), wait_until='load')
        page.wait_for_function("typeof Game!=='undefined'&&document.getElementById('menu')")
        page.evaluate("Game.start('hard',{talent:'watch'})")
        page.wait_for_function("S.room==='teach1'&&GLR.roomMesh")
        page.evaluate("clearIntroTimers();running=false;S.intro=0;S.day=2;S.tsec=900;AN.active=false;AN.next=1e6;PAT.next=1e6;patReset();DEV.god=false;S.seated=false;S.screen='play';true;")
        return page

    def test_off_by_default_and_on_marks_the_run(self):
        page = self.game(False)
        self.assertFalse(page.evaluate("()=>typeof CampusRules!=='undefined'||!!RT.rulesMode"))
        page = self.game(True)
        r = page.evaluate("()=>({on:CampusRules.on(),mode:RT.rulesMode,n:CampusRules.RULES.length,kinds:[...new Set(CampusRules.RULES.map(x=>x.t))].sort(),spots:CampusRules.spots().length,listed:GameModules.mods().some(m=>m.id==='campus-rules'&&m.status==='active')})")
        self.assertEqual(r['on'], True)
        self.assertEqual(r['mode'], {'v': 1})
        self.assertEqual(r['n'], 10)
        self.assertEqual(r['kinds'], ['false', 'half', 'true'])
        self.assertGreaterEqual(r['spots'], 12)              # 9 处有位置的规则 + 4 处证据
        self.assertTrue(r['listed'])
        self.assertEqual(self.errs, [])

    def test_reading_a_carrier_records_it_and_lets_you_mark_it(self):
        page = self.game()
        r = page.evaluate("""()=>{const o=CampusRules.spots().find(x=>x.item.id==='R04');doEnterRoom(o.p.room);S.x=o.p.x;S.y=o.p.y+3;
          const hint=interactHint();tryInteract();const txt=document.getElementById('choices').innerText;
          [...document.querySelectorAll('#choices button')].find(b=>b.textContent.indexOf('存疑')>=0).click();
          return {hint,shown:txt.indexOf('检查时站在走廊也算在座')>=0,mark:CampusRules.state().marks.R04,tf:/真|假/.test(txt)};}""")
        self.assertEqual(r, {'hint': '学生证背面的小纸条', 'shown': True, 'mark': '存疑', 'tf': False})   # 界面不标真假

    def test_knock_answering_kills_and_silence_passes(self):
        page = self.game()
        r = page.evaluate("""()=>{doEnterRoom('dorm1');S.tsec=1345;for(let i=0;i<9;i++)GameModules.emit('tick',1);return true;}""")
        page.wait_for_function("UI.chooseOpen&&document.getElementById('choices').innerText.indexOf('查寝')>=0", timeout=8000)
        page.evaluate("[...document.querySelectorAll('#choices button')].find(b=>b.textContent.indexOf('不出声')>=0).click()")
        self.assertFalse(page.evaluate("S.dead"))
        page.evaluate("()=>{CampusRules.knock();}")
        page.wait_for_function("UI.chooseOpen&&document.getElementById('choices').innerText.indexOf('查寝')>=0", timeout=8000)
        page.evaluate("[...document.querySelectorAll('#choices button')].find(b=>b.textContent.indexOf('应一声')>=0).click()")
        r = page.evaluate("()=>({dead:S.dead,cg:DeathCG.has('rules_knock'),rec:JSON.parse(localStorage.getItem('wdfz3d_rules_records_v1')||'{}')})")
        self.assertTrue(r['dead'])
        self.assertTrue(r['cg'])
        self.assertIn('knock', r['rec'])
        self.assertIn('reply', r['rec'])

    def test_ticket_and_borrowed_name_cost_five_san_only_if_you_take_or_answer(self):
        page = self.game()
        r = page.evaluate("""()=>{S.san=80;CampusRules.ticket();[...document.querySelectorAll('#choices button')].find(b=>b.textContent.indexOf('放回')>=0).click();const a=S.san;
          CampusRules.ticket();[...document.querySelectorAll('#choices button')].find(b=>b.textContent.indexOf('收下')>=0).click();const b=S.san;
          CampusRules.borrowed();[...document.querySelectorAll('#choices button')].find(b=>b.textContent.indexOf('不答应')>=0).click();const c=S.san;
          CampusRules.borrowed();[...document.querySelectorAll('#choices button')].find(b=>b.textContent==='答应'||b.textContent.trim().endsWith('答应')&&b.textContent.indexOf('不')<0).click();return [a,b,c,S.san];}""")
        self.assertEqual(r, [80, 75, 75, 70])

    def test_danger_paper_plane_carries_the_rule_text(self):
        page = self.game()
        r = page.evaluate("()=>GameModules.first('paperText','danger')")
        self.assertIn('纸从哪里来就回哪里去', r)
        self.assertIsNone(page.evaluate("()=>GameModules.first('paperText','peace')===undefined?null:1"))
