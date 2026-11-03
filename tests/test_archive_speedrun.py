"""《传送门建模、死亡CG档案室与速通模式》P1 死亡档案室、P2 速通模式。"""
import re
from pathlib import Path

from browser_case import BrowserCase

ROOT = Path(__file__).resolve().parents[1]


class DeathArchiveTest(BrowserCase):
    def game(self, diff='hard', talent='code'):
        page = self.page()
        page.evaluate(f"""Game.start('{diff}',{{talent:'{talent}'}});clearIntroTimers();running=false;
          AN.active=false;AN.next=1e6;PAT.next=1e6;S.intro=0;S.day=2;S.bag=[];""")
        page.wait_for_function("S.room==='teach1'&&GLR.roomMesh&&GLR.roomMesh.userData.roomData===INTERIORS.teach1")
        page.evaluate("running=false;clearIntroTimers();localStorage.removeItem('wdfz3d_death_archive_v1');localStorage.removeItem('wdfz3d_deaths')")
        return page

    def test_every_kill_call_maps_to_an_archive_entry(self):
        """静态审计：所有真实 kill() / anKill() 调用的死因都在注册表里（调试面板的除外）。"""
        page = self.page()
        ids = set(page.evaluate("DEATH_ARCHIVE.map(e=>e.id)"))
        fx_of = page.evaluate("Object.fromEntries(DEATH_ARCHIVE.map(e=>[e.id,e.fx]))")
        found = set()
        for path in (ROOT / 'game3d' / 'js').rglob('*.js'):          # 连同 modules/ 里的功能模块（虚空迷宫）
            if path.name == 'dev.js':
                continue
            text = path.read_text(encoding='utf-8')
            for m in re.finditer(r"\bkill\((?:[^;]*?),'([a-z]+)','([a-z_:]+)'\)", text):
                found.add(m.group(2))
                if m.group(2) in fx_of:
                    self.assertEqual(fx_of[m.group(2)], m.group(1), m.group(0)[:60])
            for m in re.finditer(r"anKill\('[^']*','([a-z]+)'\)", text):
                pass
        # anKill 的来源是 an:<异象>：从注册表里找出所有会杀人的异象
        lethal = page.evaluate("AN_ID.filter(id=>AN_DEFS[id].lethal)")
        for an in lethal:
            found.add('an:' + an)
        self.assertTrue(found)
        self.assertEqual(sorted(found - ids), [])
        self.assertEqual(len(ids), len(page.evaluate("DEATH_ARCHIVE")))   # ID 不重复

    def test_first_real_death_unlocks_once_and_repeats_only_count(self):
        page = self.page()
        page.evaluate("localStorage.removeItem('wdfz3d_death_archive_v1');localStorage.removeItem('wdfz3d_deaths')")
        got = page.evaluate("""(()=>{
          let a=DeathArchive.record('patrol','grip'), b=DeathArchive.record('patrol','grip'), c=DeathArchive.record('garage','grip');
          let d=DeathArchive.state();
          return {a:a&&a.id,b,c:c&&c.id,count:d.count.patrol,n:Object.keys(d.unlocked).length};})()""")
        self.assertEqual(got, {'a': 'patrol', 'b': None, 'c': 'garage', 'count': 2, 'n': 2})

    def test_protection_debug_and_preview_do_not_unlock(self):
        page = self.game(talent='immune')
        page.evaluate("kill('x','grip','patrol')")                         # 天生免疫挡下
        self.assert_js(page, "!S.dead&&!DeathArchive.state().unlocked.patrol")
        page.evaluate("S.bag=['elixir'];kill('x','drown','an:rain')")      # 药丸挡下
        self.assert_js(page, "!S.dead&&!DeathArchive.state().unlocked['an:rain']")
        page.evaluate("DEV.on=true;kill('x','grip','garage');DEV.on=false")  # 调试面板开着
        self.assert_js(page, "S.dead&&!DeathArchive.state().unlocked.garage")
        page.evaluate("Dev.revive&&Dev.revive();S.dead=false;S.death=null;KILL_CTX='debug';kill('x','trash','trash');KILL_CTX=null")
        self.assert_js(page, "!DeathArchive.state().unlocked.trash")
        page.evaluate("S.dead=false;S.death=null;deathFX('floor',{preview:true});anfxClear()")
        self.assert_js(page, "Object.keys(DeathArchive.state().unlocked).length===0")

    def test_dream_wake_death_still_unlocks_and_toast_waits_for_the_cg(self):
        page = self.game(diff='easy', talent='code')
        page.evaluate("S.day=1;RT.wakes=0;window.toasts=[];toast=function(m){toasts.push(m)};kill('x','drown','an:rain')")
        self.assert_js(page, "S.dead&&DeathArchive.state().unlocked['an:rain']")
        self.assert_js(page, "!toasts.some(t=>t.indexOf('死亡档案室')>=0)")       # 致死那一刻不弹
        page.wait_for_timeout(700)
        page.evaluate("deathSkip()")
        page.wait_for_function("toasts.some(t=>t.indexOf('死亡档案室')>=0)")

    def test_legacy_log_migrates_only_sourced_records(self):
        page = self.page()
        page.evaluate("""localStorage.removeItem('wdfz3d_death_archive_v1');
          localStorage.setItem('wdfz3d_deaths',JSON.stringify({counts:{grip:3,floor:2,vignette:1},sources:{patrol:2,'an:cup':2,bogus:1}}))""")
        # 启动时已经迁过一次（那时没有旧日志）；这里模拟「第一次带着旧日志打开新版本」
        got = page.evaluate("(()=>{let d=DeathArchive.state();return {u:Object.keys(d.unlocked).sort(),legacy:d.legacy,pending:d.pending,again:Object.keys(DeathArchive.state().unlocked).length};})()")
        self.assertEqual(got['u'], ['an:cup', 'patrol'])
        self.assertEqual(got['pending'], 2)       # 6 次里 4 次有来源
        self.assertEqual(got['again'], 2)         # 只迁一次
        # 坏数据、未知 ID 安全降级
        page.evaluate("localStorage.setItem('wdfz3d_death_archive_v1','{bad json')")
        self.assert_js(page, "Object.keys(DeathArchive.read().unlocked).length===0")
        page.evaluate("localStorage.setItem('wdfz3d_death_archive_v1',JSON.stringify({version:1,unlocked:{patrol:true,removed_id:true},migrated:1}))")
        self.assert_js(page, "JSON.stringify(Object.keys(DeathArchive.read().unlocked))==='[\"patrol\"]'")

    def test_menu_lists_locked_entries_without_spoilers_and_replays_in_isolation(self):
        page = self.page()
        page.evaluate("""localStorage.setItem('wdfz3d',JSON.stringify({keep:1}));
          localStorage.setItem('wdfz3d_death_archive_v1',JSON.stringify({version:1,unlocked:{'an:cup':true},first:{'an:cup':1},count:{'an:cup':1},migrated:1}));
          S.screen='menu';document.getElementById('menu').style.display='block';running=true""")
        page.locator('#btnarchive').click()
        self.assert_js(page, "!document.getElementById('archive').hidden")
        text = page.locator('#archive').inner_text()
        self.assertIn('窗台上的杯子', text)
        self.assertIn('尚未记录', text)
        self.assertNotIn('课间操', text)          # 锁着的不露标题
        self.assertNotIn('粉笔圈', page.locator('#archive').inner_html())
        page.locator('#arcards .arcard.open button').click()
        page.wait_for_function("ArchiveReplay.on&&ANFX.kind==='death'&&ANFX.preview", timeout=20000)
        self.assert_js(page, "S.screen==='replay'&&!S.dead&&document.body.classList.contains('cut')")
        page.wait_for_timeout(500)
        page.mouse.click(500, 350)
        page.wait_for_function("!ArchiveReplay.on")
        self.assert_js(page, "S.screen==='menu'&&ANFX.kind!=='death'&&!document.getElementById('archive').hidden")
        self.assert_js(page, "JSON.parse(localStorage.getItem('wdfz3d')).keep===1&&!localStorage.getItem('wdfz3d_deaths')")
        self.assert_js(page, "DeathArchive.state().count['an:cup']===1")
        page.keyboard.press('Escape')
        self.assert_js(page, "document.getElementById('archive').hidden")


    def archive_menu(self, page, ends='{}', archive=None):
        """回到主菜单、打开档案室；ends 是「已见结局」记录，archive 是档案室存档。"""
        page.evaluate(f"""localStorage.setItem('wdfz3d_ends','{ends}');
          localStorage.setItem('wdfz3d_death_archive_v1',JSON.stringify({archive or "{version:1,unlocked:{},first:{},count:{},migrated:1}"}));
          S.screen='menu';document.getElementById('menu').style.display='block';running=true""")
        page.locator('#btnarchive').click()
        self.assert_js(page, "!document.getElementById('archive').hidden")

    def cut_cards(self, page):
        return page.evaluate("[...document.querySelectorAll('#arcuts .arcard')].map(c=>c.dataset.id+(c.classList.contains('open')?'+':'-'))")

    def test_endings_and_opening_are_archived_and_replay_in_isolation(self):
        """档案室也收结局和开场的演出：达成过的结局（已见结局记录）、看过的开场可以重看；隐藏结局没达成就不出现。
        回放用正式的过场，在隔离舞台上播，结束回档案室——不出结局卡、不记结局、不动存档和过场开关。"""
        page = self.page()
        page.evaluate("localStorage.setItem('wdfz3d',JSON.stringify({keep:1}))")
        self.archive_menu(page, ends='{"car":1}')
        self.assertEqual(self.cut_cards(page), ['cut:opening+', 'end:car+', 'end:face-', 'end:portal-', 'end:cyber-'])
        self.assert_js(page, "document.getElementById('arCutCount').textContent==='已解锁 2 / 5'")
        html = page.locator('#archive').inner_html()
        self.assertNotIn('先辈', html)                       # 隐藏结局：没达成过就完全不出现
        self.assertIn('尚未达成', page.locator('#arcuts').inner_text())
        page.locator('#arcuts .arcard[data-id="end:car"] button').scroll_into_view_if_needed()
        box = page.locator('#arcuts .arcard[data-id="cut:opening"] button').bounding_box()   # 回放结束、档案室回来以后，这里正好是另一张「重看」
        page.locator('#arcuts .arcard[data-id="end:car"] button').click()
        page.wait_for_function("ArchiveReplay.on&&CUT.on&&CUT.id==='car'", timeout=20000)
        self.assert_js(page, "S.screen==='cut'&&document.getElementById('arReplay').textContent.includes('结局档案')")
        page.wait_for_timeout(600)
        # 鼠标点在档案室回来后正好是另一张「重看」的位置：按下结束回放，松开的那一下不能再开一段
        page.mouse.click(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
        page.wait_for_function("!ArchiveReplay.on")
        page.wait_for_timeout(300)
        self.assert_js(page, "!ArchiveReplay.on&&S.screen==='menu'&&!CUT.on&&CUT.enabled===false&&!document.getElementById('archive').hidden")
        self.assert_js(page, "!document.getElementById('ends')&&!RT.end&&localStorage.getItem('wdfz3d_ends')==='{\"car\":1}'")
        self.assert_js(page, "JSON.parse(localStorage.getItem('wdfz3d')).keep===1")
        self.assert_js(page, "document.activeElement&&document.activeElement.closest('[data-id=\"end:car\"]')!==null")
        # 回放里按下、拖开没产生 click：之后用回车按出来的 click 照常重看，不被误吞
        page.evaluate("ArchiveReplay.eat=true")
        page.keyboard.press('Enter')
        page.wait_for_function("ArchiveReplay.on&&CUT.on&&CUT.id==='car'", timeout=20000)
        page.wait_for_timeout(500)
        page.keyboard.press('Escape')
        page.wait_for_function("!ArchiveReplay.on&&S.screen==='menu'")
        # 开场：档案里看完整版，按键也能结束
        page.locator('#arcuts .arcard[data-id="cut:opening"] button').click()
        page.wait_for_function("ArchiveReplay.on&&CUT.on&&CUT.id==='opening'&&CUT.dur===OPENING_DUR.full", timeout=20000)
        page.wait_for_timeout(600)
        page.keyboard.press('Escape')
        page.wait_for_function("!ArchiveReplay.on")
        self.assert_js(page, "S.screen==='menu'&&!CUT.on&&Opening.short===false&&document.getElementById('opcap').textContent===''")

    def test_unlock_all_needs_the_debug_password_and_does_not_fake_progress(self):
        """「全部解锁」：在页面里的数字键盘上输调试密码，死亡和演出（包括隐藏的）全部打开，只记成「直接解锁」：
        不写死亡次数、不写已见结局；之后真的死一次照样算新记录。Esc 只关键盘，不关档案室。"""
        page = self.page()
        self.archive_menu(page)
        page.locator('#arAll').click()
        page.locator('#devlock').wait_for(state='visible')
        self.assert_js(page, "document.getElementById('devlockTitle').textContent.includes('解锁全部')")
        page.keyboard.press('Escape')
        self.assert_js(page, "!DevLock.on&&!document.getElementById('archive').hidden&&document.activeElement.id==='arAll'")
        page.locator('#arAll').click()
        for d in '0000':
            page.locator(f'#devlock [data-k="{d}"]').click()
        page.locator('#devlock [data-k="ok"]').click()
        self.assert_js(page, "DevLock.on&&document.getElementById('arCount').textContent==='已记录 0 / 18'")
        for d in page.evaluate('DEV_CODE'):
            page.locator(f'#devlock [data-k="{d}"]').click()
        page.locator('#devlock [data-k="ok"]').click()
        self.assert_js(page, "!DevLock.on&&!DEV.on")                   # 只解锁档案，不会顺带打开调试面板
        r = page.evaluate("""()=>({deaths:document.getElementById('arCount').textContent,cuts:document.getElementById('arCutCount').textContent,
          open:document.querySelectorAll('#archive .arcard.open').length,btn:document.getElementById('arAll').disabled,
          beast:document.querySelector('#arcuts .arcard[data-id="end:beast"] small').textContent,
          maze:!!document.querySelector('#arcards .arcard.open[data-id="void_lost"]'),
          ends:localStorage.getItem('wdfz3d_ends'),state:DeathArchive.state()})""")
        self.assertEqual(r['deaths'], '已记录 18 / 18 · 隐藏 2')
        self.assertEqual(r['cuts'], '已解锁 5 / 5 · 隐藏 1')
        self.assertEqual(r['open'], 26)
        self.assertTrue(r['btn'] and r['maze'])
        self.assertEqual(r['beast'], '直接解锁 · 没有亲历')
        self.assertEqual(r['ends'], '{}')
        self.assertEqual((r['state']['unlocked'], r['state']['count']), ({}, {}))
        self.assertEqual(len(r['state']['granted']), 25)                   # 开场在测试环境里已经看过，本来就开着
        # 之后真的死一次：照样是新记录、计次数
        r = page.evaluate("()=>{const e=DeathArchive.record('patrol','grip');DeathArchive.paint();return {fresh:!!e,meta:document.querySelector('#arcards .arcard[data-id=\"patrol\"] small').textContent};}")
        self.assertEqual(r, {'fresh': True, 'meta': '经历 1 次 · 最近'})
        # 隐藏结局也能重看
        page.locator('#arcuts .arcard[data-id="end:beast"] button').click()
        page.wait_for_function("ArchiveReplay.on&&CUT.on&&CUT.id==='beast'", timeout=20000)
        page.evaluate("cutSkip()")
        page.wait_for_function("!ArchiveReplay.on&&S.screen==='menu'")

    def test_archive_fits_short_landscape_screens(self):
        """手机横屏矮屏：档案室整块在屏幕里，底部「全部解锁 / 返回」不用滚外层就点得到，卡片区自己滚。"""
        page = self.page(touch=True)
        self.archive_menu(page)
        for w, h in ((844, 390), (740, 360), (390, 844)):
            page.set_viewport_size({'width': w, 'height': h})
            page.wait_for_timeout(150)
            r = page.evaluate("""()=>{const a=document.getElementById('archive'),f=document.querySelector('#archive .tpfoot').getBoundingClientRect(),
              s=document.querySelector('#archive .arscroll');
              return {outer:a.scrollHeight>a.clientHeight,foot:f.bottom<=innerHeight,inner:s.scrollHeight>s.clientHeight,h:s.clientHeight}}""")
            self.assertFalse(r['outer'], (w, h, r))
            self.assertTrue(r['foot'], (w, h, r))
            self.assertTrue(r['inner'] and r['h'] >= 96, (w, h, r))
        page.locator('#arAll').tap()
        page.locator('#devlock').wait_for(state='visible')
        page.locator('#devlock [data-k="cancel"]').tap()
        self.assert_js(page, "!DevLock.on&&!document.getElementById('archive').hidden")


class SpeedrunTest(BrowserCase):
    def menu(self, page):
        page.evaluate("S.screen='menu';document.getElementById('menu').style.display='block';localStorage.removeItem('wdfz3d_speedrun_v1')")

    def start_run(self, page, diff='easy'):
        self.menu(page)
        page.locator('#btnspeed').click()
        page.locator(f'#srpick [data-diff="{diff}"]').click()
        page.locator('#tpcards .tpcard').first.click()
        page.locator('#tpGo').click()
        page.wait_for_function("S.screen==='play'&&S.room==='teach1'&&GLR.roomMesh")
        page.evaluate("clearIntroTimers();S.intro=0;AN.next=1e6;PAT.next=1e6")

    def test_menu_flow_arms_a_run_and_starts_on_first_control(self):
        page = self.page()
        page.evaluate("localStorage.setItem('wdfz3d',JSON.stringify({keep:1}))")
        self.start_run(page, 'hard')
        self.assert_js(page, "RUN_MODE==='speedrun'&&Speedrun.run.diff==='hard'")
        page.evaluate("running=false;Speedrun.arm('hard');PRO.on=true;update(1/60)")
        self.assert_js(page, "Speedrun.run.status==='ready'")            # 前情提要期间不起表
        page.evaluate("PRO.on=false;running=false;update(1/60)")
        self.assert_js(page, "Speedrun.run.status==='running'")
        page.evaluate("saveGame()")
        self.assert_js(page, "JSON.parse(localStorage.getItem('wdfz3d')).keep===1&&!!localStorage.getItem('wdfz3d_speedrun_slot')")
        page.evaluate("render(1/60)")
        self.assert_js(page, "!document.getElementById('srclock').hidden")

    def test_clock_is_rta_and_survives_a_stalled_monotonic_clock(self):
        page = self.page()
        page.evaluate("Speedrun.arm('easy');S.screen='play';Speedrun.run.status='running';Speedrun.run.p0=performance.now()-5000;Speedrun.run.w0=Date.now()-9000")
        self.assertGreaterEqual(page.evaluate("Speedrun.elapsed()"), 9000)   # 休眠时单调时钟停走：取墙上时钟
        page.evaluate("Speedrun.run.w0=Date.now()+60000")
        self.assertGreaterEqual(page.evaluate("Speedrun.elapsed()"), 5000)   # 墙上时钟往回拨缩不短
        self.assertEqual(page.evaluate("fmtRun(3723456)"), '01:02:03.45')

    def test_finish_on_real_route_records_pb_once_and_not_on_direct_call(self):
        page = self.page()
        self.start_run(page)
        page.evaluate("running=false;update(1/60);Speedrun.run.p0-=60000;Speedrun.run.w0-=60000")
        page.evaluate("Speedrun.proof('face');triggerEnding('face',true)")
        self.assert_js(page, "Speedrun.run.status==='finished'&&Speedrun.run.route==='face'")
        ms = page.evaluate("Speedrun.run.ms")
        self.assertGreaterEqual(ms, 60000)
        self.assertIn('速通', page.locator('#ends').inner_text())
        self.assertIn('新的个人最佳', page.locator('#ends').inner_text())
        page.evaluate("Speedrun.finish('face');triggerEnding('face',true)")    # 重复结算不再记
        self.assert_js(page, "Speedrun.read().recent.length===1&&Speedrun.best('easy','face')===Speedrun.run.ms")
        page.evaluate("Game.quit()")
        self.assert_js(page, "RUN_MODE==='normal'&&!localStorage.getItem('wdfz3d_speedrun_slot')")
        # 第二次：直接在控制台调结局 → 无效，不进个人最佳
        page.locator('#ends button.equit').count()
        self.start_run(page)
        page.evaluate("running=false;update(1/60);triggerEnding('car',true)")
        self.assert_js(page, "Speedrun.run.status==='invalid'&&Speedrun.run.reason==='ending_direct'&&Speedrun.best('easy','car')===null")

    def test_debug_death_quit_and_continue_never_make_a_pb(self):
        page = self.page()
        self.start_run(page, 'hard')
        page.evaluate("running=false;update(1/60);Speedrun.invalidate('debug');Speedrun.proof('portal');triggerEnding('portal',true)")
        self.assert_js(page, "Speedrun.run.status==='invalid'&&Speedrun.best('hard','portal')===null")
        page.evaluate("Game.quit()")
        self.start_run(page, 'hard')
        page.evaluate("running=false;update(1/60);S.bag=[];kill('x','grip','patrol')")
        self.assert_js(page, "Speedrun.run.status==='failed'&&Speedrun.read().recent[0].status==='failed'")
        page.wait_for_timeout(700)
        page.evaluate("deathSkip()")
        page.wait_for_function("document.getElementById('die').style.display==='flex'")
        self.assertIn('未通关', page.locator('#diesr').inner_text())
        page.evaluate("Game.quit()")
        self.start_run(page, 'hard')
        page.evaluate("running=false;update(1/60);Game.quit()")
        self.assert_js(page, "Speedrun.read().recent[0].status==='abandoned'&&RUN_MODE==='normal'")
        page.evaluate("Game.continue_()")
        self.assert_js(page, "RUN_MODE==='normal'&&!Speedrun.run")

    def test_debug_switches_left_on_in_a_normal_game_do_not_carry_into_a_run(self):
        """普通局里开的快跑 / 无敌 / 关读条，关面板、开新局都不复位：开速通时要清掉，带着它们不能记成绩。"""
        page = self.page()
        page.evaluate("DEV.fast=true;DEV.god=true;SEARCH.on=false")      # 普通局里开过，面板已经关了
        self.start_run(page)
        self.assert_js(page, "!DEV.fast&&!DEV.god&&SEARCH.on&&!Dev.modifiersActive()")
        page.evaluate("running=false;update(1/60);Speedrun.run.p0-=60000;Speedrun.run.w0-=60000")
        page.evaluate("Speedrun.proof('car');triggerEnding('car',true)")
        self.assert_js(page, "Speedrun.run.status==='finished'&&Speedrun.best('easy','car')===Speedrun.run.ms")
        page.evaluate("Game.quit()")
        # 跑的途中不开面板、从控制台打开：结算时判无效，不进个人最佳
        self.start_run(page)
        page.evaluate("running=false;update(1/60);DEV.god=true;Speedrun.proof('face');triggerEnding('face',true)")
        self.assert_js(page, "Speedrun.run.status==='invalid'&&Speedrun.run.reason==='debug'&&Speedrun.best('easy','face')===null")

    def test_dream_wake_keeps_the_clock_running(self):
        page = self.page()
        self.start_run(page, 'easy')
        page.evaluate("running=false;update(1/60);S.day=1;RT.wakes=0;S.bag=[];kill('x','grip','patrol')")
        self.assert_js(page, "Speedrun.run.status==='running'")

    def test_secret_route_stays_hidden_until_reached(self):
        page = self.page()
        self.menu(page)
        page.evaluate("localStorage.removeItem('wdfz3d_ends')")
        page.locator('#btnspeed').click()
        html = page.locator('#srpick').inner_html()
        self.assertNotIn(page.evaluate("ENDINGS.beast.t"), html)
        self.assertNotIn('隐藏', page.locator('#srpick').inner_text())
        self.assertIn('《闸门》', html)


class TouchFlowTest(BrowserCase):
    def mobile(self):
        context = self.browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)
        self.contexts.append(context)
        context.add_init_script("localStorage.setItem('wdfz_pro','1');localStorage.setItem('zw3d_set',JSON.stringify({q:0,amb:0,vol:0}))")
        page = context.new_page()
        page.on('pageerror', lambda e: self.errors.append(str(e)))
        page.goto(self.url, wait_until='load')
        page.wait_for_function('typeof GLR!=="undefined"&&!!GLR.renderer')
        page.evaluate("if(typeof WUDA_KID_CFG!=='undefined')WUDA_KID_CFG.chance=0")   # 隐藏天赋的 3% 手电不打乱背包
        return page

    def test_speedrun_clock_does_not_cover_touch_buttons(self):
        page = self.mobile()
        page.evaluate("CUT.enabled=false;Speedrun.arm('easy');Game.start('easy',{talent:'code',mode:'speedrun'})")
        page.wait_for_function("S.screen==='play'&&S.room==='teach1'&&GLR.roomMesh", timeout=60000)
        page.evaluate("updateHUD();render(1/60)")
        got = page.evaluate("""(()=>{function rc(id){var r=document.getElementById(id).getBoundingClientRect();return r;}
          var c=rc('srclock'),hit=[];['tBook','tPause','fullscreen-toggle','mini','tAct','stick'].forEach(function(id){
            var e=document.getElementById(id);if(!e||e.offsetParent===null)return;var r=e.getBoundingClientRect();
            if(r.width&&c.left<r.right&&c.right>r.left&&c.top<r.bottom&&c.bottom>r.top)hit.push(id);});
          return {hit:hit,tag:document.querySelector('#srclock i').textContent,shown:!document.getElementById('srclock').hidden};})()""")
        self.assertTrue(got['shown'])
        self.assertEqual(got['hit'], [])
        self.assertIn('预知梦', got['tag'])

    def test_touch_ending_a_replay_does_not_restart_it(self):
        page = self.mobile()
        page.evaluate("""localStorage.setItem('wdfz3d_death_archive_v1',JSON.stringify({version:1,unlocked:{patrol:true},first:{patrol:1},count:{patrol:1},migrated:1}));
          window.plays=0;var o=ArchiveReplay.play;ArchiveReplay.play=function(id){plays++;return o.call(ArchiveReplay,id)};0""")
        page.wait_for_timeout(800)
        page.locator('#btnarchive').tap()
        page.locator('#arcards .arcard.open button').tap()
        page.wait_for_function("ArchiveReplay.on&&ANFX.kind==='death'", timeout=30000)
        page.wait_for_timeout(500)
        page.touchscreen.tap(195, 300)
        page.wait_for_timeout(1500)
        self.assert_js(page, "!ArchiveReplay.on&&plays===1&&!document.getElementById('archive').hidden")

    def test_touch_skip_of_the_opening_then_one_tap_fires_once(self):
        page = self.mobile()
        page.evaluate("Game.start('easy',{talent:'code'})")
        page.wait_for_function("CUT.on&&CUT.id==='opening'", timeout=60000)
        page.touchscreen.tap(195, 420)
        page.wait_for_function("S.screen==='play'&&!CUT.on")
        page.evaluate("window.acts=0;tryInteract=function(){acts++};0")
        page.wait_for_timeout(300)
        page.locator('#tAct').tap()
        page.wait_for_timeout(800)
        self.assert_js(page, 'acts===1')
