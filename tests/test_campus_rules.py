"""自带 DLC「规则怪谈」（计划《规则怪谈、纸飞机与窗内视线》M1／M6 首版）：默认关闭、载体与证据、三个切片、门外有你的名字。"""
from browser_case import BrowserCase


class CampusRulesTest(BrowserCase):
    def game(self, on=True, bundle='A'):
        ctx = self.browser.new_context(viewport={'width': 1000, 'height': 700})
        self.contexts.append(ctx)                              # 测完由 BrowserCase 关掉（以前一直开着，越往后越慢）
        page = ctx.new_page()
        page.add_init_script("localStorage.setItem('wdfz_pro','1');localStorage.setItem('zw3d_set',JSON.stringify({q:0,amb:0,vol:0,renderer:'webgl'}));localStorage.removeItem('wdfz3d_rules_records_v1');")
        self.errs = []
        page.on('pageerror', lambda e: self.errs.append(str(e)))
        page.goto(self.url + ('?mod=campus-rules' if on else ''), wait_until='load')
        page.wait_for_function("typeof Game!=='undefined'&&document.getElementById('menu')")
        page.evaluate("Game.start('hard',{talent:'watch'})")
        page.wait_for_function("S.room==='teach1'&&GLR.roomMesh")
        page.evaluate("clearIntroTimers();running=false;S.intro=0;S.day=2;S.tsec=900;AN.active=false;AN.next=1e6;PAT.next=1e6;patReset();DEV.god=false;S.seated=false;S.screen='play';true;")
        if on and bundle:
            page.evaluate(f"()=>{{CampusRules.state().bundle='{bundle}';RT.rulesMode.bundle='{bundle}';}}")   # 规则组按本局种子抽：用例固定一组
        return page

    def test_off_by_default_and_on_marks_the_run(self):
        page = self.game(False)
        self.assertFalse(page.evaluate("()=>typeof CampusRules!=='undefined'||!!RT.rulesMode"))
        page = self.game(True)
        r = page.evaluate("()=>({on:CampusRules.on(),mode:RT.rulesMode,n:CampusRules.RULES.length,kinds:[...new Set(CampusRules.RULES.map(x=>x.t))].sort(),spots:CampusRules.spots().length,listed:GameModules.mods().some(m=>m.id==='campus-rules'&&m.status==='active')})")
        self.assertEqual(r['on'], True)
        self.assertEqual(r['mode'], {'v': 1, 'ver': '1.1.0', 'bundle': 'A'})
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
        self.assertIn('rules.e.knock', r['rec'])               # 不出声度过一轮
        self.assertIn('rules.h.reply', r['rec'])               # 真的死于门外的声音（死亡事实里记）
        self.assertEqual(r['rec']['rules.e.knock']['ver'], '1.1.0')

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

    # ---------- T2：规则组相容性抽选（计划第 15.2 节） ----------
    def test_every_bundle_passes_the_compatibility_check_and_bad_ones_fail(self):
        page = self.game()
        r = page.evaluate("""()=>{const C=CampusRules,ok=Object.keys(C.BUNDLES).map(k=>[k,C.validBundle(C.BUNDLES[k])]);
          const all=C.BUNDLES.A,drop=ids=>all.filter(x=>ids.indexOf(x)<0);
          const bad={noR03:C.validBundle(drop(['R03'])),noR05:C.validBundle(drop(['R05'])),twoFalse:C.validBundle(drop(['R04','R07'])),
            twoHalf:C.validBundle(drop(['R06','R10'])),twoTrue:C.validBundle(drop(['R02','R08'])),noRefute:C.validBundle(drop(['R02','R05','R08']).concat(['R05'])),unknown:C.validBundle(all.concat(['R99']))};
          return {ok,bad};}""")
        self.assertEqual(r['ok'], [['A', True], ['B', True], ['C', True], ['D', True]])
        self.assertEqual(set(r['bad'].values()), {False}, r['bad'])   # 缺 R03／R05、真假半真不够、假规则没反证、没有的规则都不行

    def test_bundle_is_picked_from_the_run_seed_and_saved(self):
        page = self.game(bundle=None)
        r = page.evaluate("""()=>{const C=CampusRules,seen={};for(let i=0;i<400;i++)seen[C.pickBundle('s'+i)]=1;
          const same=C.pickBundle('abc')===C.pickBundle('abc');
          const b=C.bundle(),mode=RT.rulesMode.bundle;saveGame();const d=loadGame();
          C.state().bundle='Z';GameModules.loadAll(d.mods);const back=C.bundle();
          const old=JSON.parse(JSON.stringify(d.mods));delete old['mod:campus-rules'].bundle;GameModules.loadAll(old);
          return {seen:Object.keys(seen).sort(),same,b,mode,back,legacy:C.bundle()};}""")
        self.assertEqual(r['seen'], ['A', 'B', 'C', 'D'])
        self.assertTrue(r['same'])
        self.assertEqual(r['b'], r['mode'])
        self.assertEqual(r['back'], r['b'])                    # 读档不重抽
        self.assertEqual(r['legacy'], 'A')                     # 1.0.0 的存档没有组号：按 A

    def test_rules_outside_the_bundle_have_no_carrier_and_their_slice_stays_off(self):
        page = self.game(bundle='B')                           # B 组没有 R06（餐券）和 R09
        r = page.evaluate("""()=>{const ids=CampusRules.spots().map(o=>o.item.id);
          doEnterRoom('canteen1');S.tsec=760;const meal=mealNow();for(let i=0;i<3;i++)GameModules.emit('tick',1);
          return {r06:ids.indexOf('R06')>=0,r09:ids.indexOf('R09')>=0,r04:ids.indexOf('R04')>=0,e04:ids.indexOf('E04')>=0,meal,ticket:UI.chooseOpen&&document.getElementById('choices').innerText.indexOf('餐券')>=0};}""")
        self.assertEqual(r, {'r06': False, 'r09': False, 'r04': True, 'e04': True, 'meal': True, 'ticket': False})

    # ---------- T4：模式成就（计划第 11、15.2 节） ----------
    def test_old_record_keys_are_migrated_to_the_rules_namespace(self):
        page = self.game()
        r = page.evaluate("""()=>{localStorage.setItem('wdfz3d_rules_records_v1',JSON.stringify({knock:123,sources:456,ticket:789}));
          const rec=CampusRules.records();return {keys:Object.keys(rec).sort(),knock:rec['rules.e.knock'],stored:Object.keys(JSON.parse(localStorage.getItem('wdfz3d_rules_records_v1'))).sort()};}""")
        self.assertEqual(r['keys'], ['rules.e.knock', 'rules.e.sources', 'rules.n.ticket'])
        self.assertEqual(r['knock'], {'at': 123, 'ver': '1.0.0'})
        self.assertEqual(r['stored'], r['keys'])

    def test_mode_achievements_follow_what_actually_happened_this_run(self):
        page = self.game()
        r = page.evaluate("""()=>{const C=CampusRules,got=()=>Object.keys(C.records()).sort(),s=C.state(),out={};
          gameFact('gaze',{what:'escape'});out.escapeUnread=got();                       // 没读过反证就挣开：不算
          s.read.R03=1;s.read.E03=1;s.read.R02=1;gameFact('gaze',{what:'escape'});out.clauses=got();
          gameFact('ending',{id:'car',legit:true,fake:false});out.endEarly=got();         // 没被吸住、没送回纸飞机：不算读到最后
          gameFact('gaze',{what:'contact'});gameFact('paper',{what:'returned',clean:false});out.paper=got();
          s.read.R04=1;gameFact('ending',{id:'car',legit:true,fake:true});out.fake=got();
          gameFact('ending',{id:'car',legit:true,fake:false});out.survive=got();
          return out;}""")
        self.assertEqual(r['escapeUnread'], [])
        self.assertEqual(r['clauses'], ['rules.e.clauses'])
        self.assertEqual(r['endEarly'], ['rules.e.clauses'])
        self.assertEqual(r['paper'], ['rules.e.clauses', 'rules.e.paper_return'])
        self.assertEqual(r['fake'], r['paper'])                                            # 假结局不算
        self.assertEqual(r['survive'], ['rules.e.clauses', 'rules.e.paper_return', 'rules.p.survive'])

    def test_debug_runs_never_record_and_stay_untrusted(self):
        page = self.game()
        r = page.evaluate("""()=>{const C=CampusRules;DEV.on=true;const a=C.grant('rules.e.knock');DEV.on=false;
          const b=C.grant('rules.e.knock');saveGame();const d=loadGame();GameModules.loadAll(d.mods);
          return {a,b,trusted:C.trusted(),rec:Object.keys(C.records())};}""")
        self.assertEqual(r, {'a': False, 'b': False, 'trusted': False, 'rec': []})        # 标过调试的局一直不记，读档也一样


    # ---------- T1：读档守卫与独立普通槽（计划第 4.1、15.2 节） ----------
    def menu(self, page, q=''):
        page.goto(self.url + q, wait_until='load')
        page.wait_for_function("typeof Game!=='undefined'&&document.getElementById('menu')&&Assets.ready()")

    def labels(self, page):
        page.wait_for_function("UI.chooseOpen", timeout=8000)
        return page.evaluate("[...document.querySelectorAll('#choices button')].map(b=>b.textContent.replace(/^\\d/,''))")

    def test_a_rules_save_cannot_be_continued_without_the_dlc_and_a_plain_game_keeps_it(self):
        page = self.game()
        page.evaluate("()=>{S.day=3;saveGame();}")
        rules_save = page.evaluate("localStorage.getItem('wdfz3d')")
        self.menu(page)                                                           # DLC 关着回来
        page.evaluate("Game.continue_()")
        opts = self.labels(page)
        self.assertEqual(page.evaluate("S.screen"), 'menu')                      # 没有读档
        self.assertTrue(any('打开「规则怪谈」' in o for o in opts), opts)
        self.assertTrue(any('另开普通局' in o for o in opts), opts)
        self.assertFalse(any('普通存档槽里' in o for o in opts), opts)          # 普通槽还是空的
        self.assertTrue(page.evaluate("getComputedStyle(document.getElementById('choices')).zIndex>getComputedStyle(document.getElementById('menu')).zIndex"))
        page.evaluate("[...document.querySelectorAll('#choices button')].find(b=>b.textContent.indexOf('另开普通局')>=0).click()")
        page.evaluate("Game.start('easy',{talent:'watch'})")
        page.wait_for_function("S.room==='teach1'&&GLR.roomMesh")
        r = page.evaluate("()=>{saveGame();const p=JSON.parse(localStorage.getItem('wdfz3d_plain'));return {plain:SaveSlots.plain(),main:localStorage.getItem('wdfz3d'),rulesInPlain:!!(p.rt&&p.rt.rulesMode)};}")
        self.assertTrue(r['plain'])
        self.assertEqual(r['main'], rules_save)                                  # 规则存档原样留着
        self.assertFalse(r['rulesInPlain'])
        self.menu(page)                                                           # 再回来：可以接着玩普通槽那一局
        page.evaluate("Game.continue_()")
        opts = self.labels(page)
        self.assertTrue(any('普通存档槽里' in o for o in opts), opts)
        page.evaluate("[...document.querySelectorAll('#choices button')].find(b=>b.textContent.indexOf('普通存档槽里')>=0).click()")
        page.wait_for_function("S.screen==='play'&&GLR.roomMesh")
        self.assertEqual(page.evaluate("[!!RT.rulesMode,SaveSlots.plain()]"), [False, True])

    def test_safe_mode_offers_no_dlc_and_the_dlc_reads_its_own_save(self):
        page = self.game()
        page.evaluate("()=>{S.day=3;saveGame();}")
        self.menu(page, '?nomod')
        page.evaluate("Game.continue_()")
        opts = self.labels(page)
        self.assertFalse(any('打开「规则怪谈」' in o for o in opts), opts)     # 安全模式：只能另开普通局或回菜单
        page.evaluate("[...document.querySelectorAll('#choices button')].find(b=>b.textContent.indexOf('回主菜单')>=0).click()")
        self.assertEqual(page.evaluate("[UI.chooseOpen,S.screen,document.body.classList.contains('menuchoice')]"), [False, 'menu', False])
        self.menu(page, '?mod=campus-rules')                                     # DLC 开着：直接读
        page.evaluate("Game.continue_()")
        page.wait_for_function("S.screen==='play'&&GLR.roomMesh")
        self.assertEqual(page.evaluate("[RT.rulesMode.v,CampusRules.on(),S.day,SaveSlots.plain()]"), [1, True, 3, False])

    # ---------- T3：CG 档案馆「规则怪谈」一节 ----------
    def open_archive(self, page):
        page.evaluate("()=>{Game.quit&&Game.quit();}")
        page.wait_for_function("S.screen==='menu'")
        page.evaluate("DeathArchive.open()")
        page.wait_for_function("!document.getElementById('archive').hidden")

    def test_archive_has_its_own_rules_page_and_the_base_total_is_unchanged(self):
        page = self.game()
        self.open_archive(page)
        r = page.evaluate("""()=>{const sec=document.getElementById('arsec-rules'),head=document.querySelector('.arsec[data-sec="rules"]');
          const cards=[...sec.querySelectorAll('.arcard')];
          return {n:cards.length,count:head.textContent,hidden:cards[cards.length-1].textContent.indexOf('？？？')>=0,
            openN:cards.filter(c=>c.classList.contains('open')).length,base:DeathArchive.visible().some(e=>/rules/.test(e.id))};}""")
        self.assertEqual(r['n'], 8)                                   # 一份死亡档案 + 七条模式成就
        self.assertIn('已记录 0 / 8', r['count'])
        self.assertTrue(r['hidden'])                                  # 隐藏的那条没拿到前只显示 ？？？
        self.assertEqual(r['openN'], 0)
        self.assertFalse(r['base'])                                   # 本体档案不含 DLC 条目
        page.evaluate("()=>{localStorage.setItem('wdfz3d_rules_records_v1',JSON.stringify({'rules.h.reply':{at:Date.now(),ver:'1.1.0'},'rules.e.knock':{at:Date.now(),ver:'1.1.0',bundle:'C'}}));DeathArchive.open();}")
        r = page.evaluate("""()=>{const c=id=>document.querySelector('#arsec-rules .arcard[data-id="'+id+'"]');
          return {knock:c('x.rules.knock').classList.contains('open'),knockBtn:!!c('x.rules.knock').querySelector('button'),
            ach:c('x.rules.e.knock').classList.contains('open'),achBtn:!!c('x.rules.e.knock').querySelector('button'),meta:c('x.rules.e.knock').textContent,
            count:document.querySelector('.arsec[data-sec="rules"]').textContent};}""")
        self.assertEqual([r['knock'], r['knockBtn'], r['ach'], r['achBtn']], [True, True, True, False])   # 成就卡没有「重看」
        self.assertIn('规则组 C', r['meta'])
        self.assertIn('已记录 3 / 8', r['count'])                    # 死亡档案、门外的声音、没有人答应
        page.evaluate("document.querySelector('#arsec-rules .arcard[data-id=\"x.rules.knock\"] button').click()")
        page.wait_for_function("ArchiveReplay.on&&ANFX.kind==='death'", timeout=20000)   # 在宿舍舞台上重看「门外有你的名字」
        self.assertEqual(page.evaluate("[ArchiveReplay.id,S.room]"), ['x.rules.knock', 'dorm1'])
        page.evaluate("ArchiveReplay.stop()")
        self.assertEqual(self.errs, [])

    def test_without_the_dlc_the_archive_has_no_rules_page(self):
        page = self.game(False)
        self.open_archive(page)
        self.assertFalse(page.evaluate("!!document.getElementById('arsec-rules')"))

    # ---------- T5：模式成绩分开展示 ----------
    def test_a_rules_clear_is_recorded_on_its_own_and_kept_out_of_base_bests(self):
        page = self.game()
        r = page.evaluate("""()=>{localStorage.removeItem('wdfz3d_clears_v1');RunRecords._reset();
          gameFact('ending',{id:'car',legit:true,fake:false,trueEnd:true});
          const L=RunRecords.list(),x=L[0]||{};
          return {n:L.length,variant:x.variant,name:x.variantName,group:x.variantGroup,grades:Object.keys(RunRecords.grades()).length,best:RunRecords.bestGrade(S.diff,'car'),base:L.filter(RunRecords.base).length};}""")
        self.assertEqual(r['n'], 1)
        self.assertEqual([r['variant'], r['name'], r['group']], ['rules@1.1.0', '规则怪谈', 'A'])
        self.assertEqual(r['grades'], 0)                          # 不点亮本体的「评级取得」
        self.assertIsNone(r['best'])                              # 不占本体最佳
        self.assertEqual(r['base'], 0)
        page.evaluate("()=>{Game.quit&&Game.quit();RecordsUI.open();}")
        page.wait_for_function("!document.getElementById('records').hidden")
        r = page.evaluate("""()=>{const m=document.getElementById('rcMode'),base=document.querySelectorAll('#rcList .rcrow').length;
          m.value='rules@1.1.0';m.dispatchEvent(new Event('change'));
          const rows=[...document.querySelectorAll('#rcList .rcrow')];
          return {opts:[...m.options].map(o=>o.textContent),base,rows:rows.length,tag:rows[0]&&rows[0].textContent};}""")
        self.assertEqual(r['opts'], ['本体', '规则怪谈 · v1.1.0'])
        self.assertEqual(r['base'], 0)                            # 默认只看本体
        self.assertEqual(r['rows'], 1)
        self.assertIn('规则组 A', r['tag'])

    def test_an_untrusted_rules_clear_is_not_recorded(self):
        page = self.game()
        r = page.evaluate("""()=>{localStorage.removeItem('wdfz3d_clears_v1');RunRecords._reset();DEV.on=true;CampusRules.trusted();DEV.on=false;
          gameFact('ending',{id:'car',legit:true,fake:false,trueEnd:true});return RunRecords.list().length;}""")
        self.assertEqual(r, 0)

    # ---------- 主菜单的 DLC 入口（2026-11-06）与 Wiki 的 DLC 玩法 ----------
    def test_main_menu_has_a_dlc_entry_that_toggles_the_builtin_dlc(self):
        page = self.game(False)
        page.evaluate("()=>{Game.quit&&Game.quit();}")
        page.wait_for_function("S.screen==='menu'")
        r = page.evaluate("""()=>{const b=document.getElementById('btndlc'),row=b&&b.closest('.mctl');b.click();
          const ov=document.getElementById('dlcmenu'),cs=getComputedStyle(ov),body=document.getElementById('dlcMenuBody');
          const t=[...body.querySelectorAll('[data-mm="builtin"]')].find(x=>x.dataset.id==='campus-rules');
          const shown=cs.display!=='none'&&!ov.hidden,top=document.elementFromPoint(innerWidth/2,innerHeight/2);
          return {inRow:!!row,shown,onTop:ov.contains(top),simple:!body.querySelector('.mm-mods'),label:t&&t.textContent,
            link:ov.querySelector('a[href="wiki/index.html#dlc"]')!==null,beforeWiki:b.nextElementSibling&&b.nextElementSibling.classList.contains('mwiki')};}""")
        self.assertEqual(r, {'inRow': True, 'shown': True, 'onTop': True, 'simple': True, 'label': '打开', 'link': True, 'beforeWiki': True})
        page.evaluate("[...document.querySelectorAll('#dlcMenuBody [data-mm=\"builtin\"]')].find(x=>x.dataset.id==='campus-rules').click()")
        r = page.evaluate("()=>({on:GameModules.builtinList().find(m=>m.id==='campus-rules').enabled,label:[...document.querySelectorAll('#dlcMenuBody [data-mm=\"builtin\"]')].find(x=>x.dataset.id==='campus-rules').textContent,state:[...document.querySelectorAll('#dlcMenuBody [data-mm=\"builtin\"]')].find(x=>x.dataset.id==='campus-rules').closest('li').querySelector('small').textContent})")
        self.assertTrue(r['on'])
        self.assertIn('已开', r['label'])
        self.assertIn('刷新后载入', r['state'])                    # 这次还没载入：要刷新
        page.keyboard.press('Escape')
        self.assertEqual(page.evaluate("[document.getElementById('dlcmenu').hidden,document.activeElement.id,S.screen]"), [True, 'btndlc', 'menu'])
        self.assertEqual(self.errs, [])

    def test_wiki_explains_the_dlc_without_internal_answers(self):
        import pathlib
        html = (pathlib.Path(__file__).resolve().parents[1] / 'wiki' / 'index.html').read_text(encoding='utf-8')
        start = html.index('<section id="dlc">'); sec = html[start:html.index('</section>', start)]
        for need in ('主菜单底行的「DLC」', '从下一局开始生效', '可信', '证据', '每局不一样', '规则怪谈的存档只能在 DLC 打开时接着玩', '另有一条隐藏的', '?nomod'):
            self.assertIn(need, sec)
        self.assertIn('href="#dlc"', html)
        for secret in ('门外有你的名字', '门外的声音', '应一声', 'rules_knock', '查寝'):
            self.assertNotIn(secret, html)                          # DLC 的死法、隐藏成就、选项原文不进 Wiki
        for secret in ('不出声', '放回托盘', '不答应', '收下', 'R0', 'R10', '餐券', '敲门'):
            self.assertNotIn(secret, sec)                           # DLC 一节不写哪件事该怎么选
