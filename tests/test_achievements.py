"""《成就系统》：定义表、可信解锁、本局与跨局、旧记录补发、成就页不写达成方法、提示时机与分档音效。

内部测试：这里会出现隐藏成就的 ID 与内部条件，用来核对它们不会漏到界面上。"""
import json
import unittest

from browser_case import BrowserCase


class AchievementTest(BrowserCase):
    def game(self, diff='easy', talent='tech'):
        page = self.page()
        page.evaluate(f"""localStorage.removeItem('wdfz3d_achievements_v1');
          Game.start('{diff}',{{talent:'{talent}'}});clearIntroTimers();running=false;
          AN.active=false;AN.next=1e6;PAT.next=1e6;S.intro=0;S.bag=[];""")
        page.wait_for_function("S.room==='teach1'&&S.screen==='play'")
        page.evaluate("""running=false;clearIntroTimers();SEARCH.on=true;DEV.fast=false;DEV.god=false;
          Achievements.clear();Achievements.run().debug=0;Achievements.run().mod=0;
          window.sounds=[];SFX.achieve=function(t){ sounds.push(t); };0""")   # 末尾不能是函数：Playwright 会顺手调用它
        return page

    def got(self, page):
        return page.evaluate("Object.keys(Achievements.state().got)")

    def test_rules_table_has_four_tiers_and_no_bonus_fields(self):
        page = self.page()
        r = page.evaluate("""()=>{const L=AchievementRules.list();
          const t={};L.forEach(a=>t[a.t]=(t[a.t]||0)+1);
          return {n:L.length,t,ids:new Set(L.map(a=>a.id)).size,pub:AchievementRules.publicList().length,
            secretOk:L.every(a=>(a.t==='h')===!!a.secret),texts:L.every(a=>a.n&&a.how&&a.m),
            keys:[...new Set(L.flatMap(a=>Object.keys(a)))].sort()}}""")
        self.assertEqual(r['n'], 56)
        self.assertEqual(r['t'], {'n': 20, 'e': 17, 'p': 9, 'h': 10})
        self.assertEqual(r['ids'], 56)
        self.assertEqual(r['pub'], 46)
        self.assertTrue(r['secretOk'] and r['texts'])
        # 只有判定与显示用的字段：没有任何奖励、加成之类的东西
        self.assertEqual(r['keys'], ['goal', 'how', 'id', 'm', 'n', 'needs', 'on', 'scope', 'score', 'secret', 'set', 't', 'test'])

    def test_facts_unlock_record_context_and_play_tier_sound_when_calm(self):
        page = self.game(diff='hard', talent='tech')
        page.evaluate("gameFact('inspection',{day:S.day,slot:0,compliant:true})")
        g = page.evaluate("Achievements.state().got['n.inspection']")
        self.assertEqual((g['diff'], g['talent'], g['day'], g['legacy']), ('hard', 'tech', 1, 0))
        self.assert_js(page, "Achievements.run().got.indexOf('n.inspection')>=0&&Achievements.run().queue.indexOf('n.inspection')>=0")
        # 紧张的时候不弹：异象进行中
        page.evaluate("AN.active=true;GameModules.emit('tick',0.5);GameModules.emit('tick',0.5)")
        self.assert_js(page, "document.getElementById('achtoast').hidden&&sounds.length===0")
        page.evaluate("AN.active=false;GameModules.emit('tick',0.1)")
        self.assert_js(page, "!document.getElementById('achtoast').hidden&&document.getElementById('achtoast').textContent.includes('按时到场')")
        self.assertEqual(page.evaluate("sounds"), ['n'])
        # 精英、隐藏各自的音效
        page.evaluate("""for(let i=0;i<12;i++)GameModules.emit('tick',0.5);
          Speedrun.proof('car');gameFact('ending',{id:'car',legit:true,fake:false,trueEnd:true});
          gameFact('anomaly',{id:'cola',phase:'start',lethal:false});S.screen='play';
          for(let i=0;i<120;i++)GameModules.emit('tick',0.5);""")
        # 梦魇第一天通关还会顺带达成几条史诗；队列依次放完，每档各自的音效
        self.assertEqual(page.evaluate("sounds.filter((x,i,a)=>a.indexOf(x)===i)"), ['n', 'e', 'p', 'h'])
        self.assert_js(page, "Achievements.run().queue.length===0")

    def test_debug_panel_mod_and_console_endings_do_not_count(self):
        page = self.game()
        page.evaluate("Dev.unlock();Dev.close();gameFact('inspection',{day:1,slot:0,compliant:true})")
        self.assertEqual(self.got(page), [])
        self.assert_js(page, "Achievements.debugRun()")
        page.evaluate("saveGame();applySave(loadGame());gameFact('lesson',{task:1,correct:true})")
        self.assertEqual(self.got(page), [])                       # 调试局标记跟存档
        # 新开一局，调试开关开着也不算
        page = self.game()
        page.evaluate("DEV.god=true;gameFact('lesson',{task:1,correct:true});DEV.god=false")
        self.assertEqual(self.got(page), [])
        # 启用了用户 Mod 的局
        page = self.game()
        page.evaluate("""const m=GameModules.mods;GameModules.mods=()=>[{id:'x',status:'active',source:'upload'}];
          GameModules.emit('newGame',{diff:'easy',mode:'normal'});GameModules.mods=m;gameFact('lesson',{task:1,correct:true})""")
        self.assertEqual(self.got(page), [])
        # 控制台直接调结局（没有正常路线登记）
        page = self.game()
        page.evaluate("triggerEnding('car',true)")
        self.assertNotIn('e.end_car', self.got(page))

    def test_run_conditions_and_cross_sets(self):
        page = self.game()
        page.evaluate("""gameFact('fakeNormal',{laugh:true});gameFact('fakeNormal',{done:true});
          gameFact('garage',{what:'drive',tried:2});
          gameFact('inspection',{day:2,slot:0,compliant:true});gameFact('inspection',{day:2,slot:1,compliant:true});
          gameFact('exam',{phase:'paper',pass:true,day:2});gameFact('exam',{phase:'paper',pass:true,day:2});
          ['run','shoot','eat','sleep','wash','piano','pc','view'].forEach(k=>gameFact('rest',{key:k}));""")
        got = self.got(page)
        self.assertNotIn('e.nolaugh', got)                         # 笑过一次就不成立
        self.assertNotIn('e.firstcar', got)                        # 试错过车
        for x in ('e.attendance', 'e.allexam', 'e.rest8', 'n.rest', 'n.exam'):
            self.assertIn(x, got)
        # 白名单答错一次，通关也不是「三道全对」；危险异象只认由 anStart 开场的那一次
        page.evaluate("""gameFact('face',{correct:false});Speedrun.proof('face');gameFact('ending',{id:'face',legit:true});
          gameFact('anomaly',{id:'rain',phase:'end',survived:true,lethal:true})""")
        got = self.got(page)
        self.assertIn('e.end_face', got)
        self.assertNotIn('e.whitelist', got)
        self.assertNotIn('n.survive', got)
        self.assert_js(page, "!Achievements.state().sets.lethal")

    def test_run_tracker_survives_save_and_load(self):
        page = self.game()
        page.evaluate("gameFact('fakeNormal',{laugh:true});gameFact('protect',{by:'elixir'});saveGame();applySave(loadGame())")
        r = page.evaluate("({l:Achievements.run().laughs,s:Achievements.run().saved,got:Achievements.run().got})")
        self.assertEqual((r['l'], r['s']), (1, 1))
        self.assertIn('n.saved', r['got'])

    def test_archive_unlock_all_and_legacy_backfill(self):
        page = self.page()
        # 档案室「全部解锁」不算亲历：档案类成就不补
        page.evaluate("localStorage.removeItem('wdfz3d_achievements_v1');DeathArchive.unlockAll()")
        page.reload(wait_until='load')
        page.wait_for_function("typeof Achievements!=='undefined'&&Achievements.state().migrated===1")
        got = self.got(page)
        self.assertNotIn('n.archive', got)
        self.assertNotIn('p.archive', got)
        # 旧记录补发：已见结局、真实的死亡档案、有效速通
        page.evaluate("""localStorage.removeItem('wdfz3d_achievements_v1');
          localStorage.setItem('wdfz3d_ends',JSON.stringify({car:1,face:1,portal:1,cyber:1}));
          const u={};DEATH_ARCHIVE.forEach(e=>u[e.id]=true);
          localStorage.setItem('wdfz3d_death_archive_v1',JSON.stringify({version:1,unlocked:u,first:{},count:{},migrated:1}));
          localStorage.setItem('wdfz3d_speedrun_v1',JSON.stringify({version:1,recent:[],best:{'r2|easy|car':{ms:800000,runId:'a',at:1,game:'x'}}}));""")
        page.reload(wait_until='load')
        page.wait_for_function("typeof Achievements!=='undefined'&&Achievements.state().migrated===1")
        r = page.evaluate("Achievements.state().got")
        for x in ('n.opening', 'e.end_car', 'e.end_cyber', 'p.routes', 'n.archive', 'p.archive', 'h.maze_deaths', 'e.speedrun', 'p.fast'):
            self.assertIn(x, r)
            self.assertEqual(r[x]['legacy'], 1)
        self.assertNotIn('e.hard', r)                              # 难度、天赋类没有可靠来源，不补
        page.locator('#btnach').click()
        self.assert_js(page, "document.querySelector('#accards [data-id=\"e.end_car\"] small').textContent==='已达成 · 旧记录'")

    def test_page_hides_methods_and_unseen_secret_entries(self):
        page = self.page()
        page.evaluate("localStorage.removeItem('wdfz3d_achievements_v1');Achievements.clear();S.screen='menu';document.getElementById('menu').style.display='block'")
        page.locator('#btnach').click()
        r = page.evaluate("""()=>{const box=document.getElementById('achieve'), html=box.innerHTML;
          return {count:document.getElementById('acCount').textContent,cards:box.querySelectorAll('.accard').length,
            tabs:[...box.querySelectorAll('.actabs button')].map(b=>b.textContent),
            how:AchievementRules.list().filter(a=>html.indexOf(a.how)>=0).map(a=>a.id),
            hidden:AchievementRules.list().filter(a=>a.secret&&html.indexOf(a.n)>=0).map(a=>a.id),
            locked:[...box.querySelectorAll('.accard:not(.got)')].every(c=>!c.querySelector('i')&&c.querySelector('small').textContent==='未达成')}}""")
        self.assertEqual(r['count'], '已达成 0 / 46')
        self.assertEqual(r['cards'], 46)
        self.assertEqual(r['tabs'], ['全部', '普通', '精英', '史诗'])
        self.assertEqual(r['how'], [])                             # 达成方法一条都不写
        self.assertEqual(r['hidden'], [])                          # 隐藏成就没解锁不在 DOM 里
        self.assertTrue(r['locked'])
        # 解锁一个隐藏的以后才出现「隐藏」页签与计数，说明写的是回忆，不是方法
        page.evaluate("""DeathArchive.close&&DeathArchive.close();AchievementsUI.close();S.screen='play';
          SEARCH.on=true;DEV.god=false;Achievements.run().debug=0;gameFact('anomaly',{id:'cola',phase:'start',lethal:false});S.screen='menu'""")
        page.locator('#btnach').click()
        r = page.evaluate("""()=>({count:document.getElementById('acCount').textContent,tabs:[...document.querySelectorAll('#actabs button')].map(b=>b.textContent),
          text:document.querySelector('#accards [data-id="h.cola"] i').textContent,how:AchievementRules.get('h.cola').how})""")
        self.assertEqual(r['count'], '已达成 1 / 46 · 隐藏 1')
        self.assertIn('隐藏', r['tabs'])
        self.assertNotEqual(r['text'], r['how'])

    def test_static_markup_never_names_secret_entries(self):
        from pathlib import Path
        root = Path(__file__).resolve().parents[1]
        html = (root / 'index.html').read_text(encoding='utf-8')
        page = self.page()
        names = page.evaluate("AchievementRules.list().filter(a=>a.secret).map(a=>a.n)")
        hows = page.evaluate("AchievementRules.list().map(a=>a.how)")
        for n in names:
            self.assertNotIn(n, html)
        wiki = (root / 'wiki' / 'index.html').read_text(encoding='utf-8')
        for h in hows:
            self.assertNotIn(h, wiki)                             # Wiki 不写达成方法


if __name__ == '__main__':
    unittest.main()
