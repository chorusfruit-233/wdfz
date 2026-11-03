"""《积分、评级与通关记录》：积分与评级规则、结算页与九档结算画面、死亡一行、调试局、通关记录与回放、
足迹图、速通排行、调试面板「档案」页签、CG 档案馆「结算画面」、探索度、手机版面。"""
import unittest

from browser_case import BrowserCase


class RunRecordTest(BrowserCase):
    def game(self, diff='easy', talent='tech'):
        page = self.page()
        page.evaluate(f"""localStorage.removeItem('wdfz3d_clears_v1');localStorage.removeItem('wdfz3d_runlog_cur');
          Game.start('{diff}',{{talent:'{talent}'}});clearIntroTimers();running=false;
          AN.active=false;AN.next=1e6;PAT.next=1e6;S.intro=0;S.bag=[];""")
        page.wait_for_function("S.room==='teach1'&&S.screen==='play'")
        page.evaluate("""running=false;clearIntroTimers();SEARCH.on=true;DEV.fast=false;DEV.god=false;RunRecords._reset();
          Achievements.run().debug=0;Achievements.run().mod=0;window.grades=[];SFX.grade=function(b){ grades.push(b); };0""")
        return page

    def menu(self, page):
        page.evaluate("S.screen='menu';document.getElementById('menu').style.display='block';running=true")

    def test_score_rules(self):
        page = self.page()
        r = page.evaluate("""()=>({
          t:[ScoreRules.timeScore(1200,1200),ScoreRules.timeScore(400,1200),ScoreRules.timeScore(9600,1200),ScoreRules.timeScore(0,1200)],
          g:[0,399,400,999,1000,1449,1450].map(v=>ScoreRules.gradeOf(v).g),
          capEasy:ScoreRules.rate(1300,300,1200,{diff:'easy',saved:0,wakes:0}),
          capSaved:ScoreRules.rate(1300,300,1200,{diff:'hard',saved:1,wakes:0}).grade,
          sss:ScoreRules.rate(1300,300,1200,{diff:'hard',saved:0,wakes:0}).grade,
          ex:ScoreRules.explore({places:10,placesTotal:20,cells:300,cellsTotal:1000,clues:5,cluesTotal:10}),
          tot:ScoreRules.total([{cat:'应对 · 异象',text:'x',pts:20},{cat:'应对 · 异象',text:'x',pts:20}],{ending:true,diff:'hard',san:80,minSan:10,explore:{pct:150}}),
          samples:GRADES.map(g=>{const par=1200,s=ScoreRules.sample(g.g,'car',par);return ScoreRules.rate(s.total,s.sec,par,{diff:s.diff,saved:0,wakes:0}).grade;})
        })""")
        self.assertEqual(r['t'], [400, 600, 100, 0])
        self.assertEqual(r['g'], ['F', 'F', 'E', 'B', 'A', 'SS', 'SSS'])
        self.assertEqual((r['capEasy']['grade'], r['capEasy']['capped']), ('SS', True))   # SSS 门槛：梦魇、没被救过、没惊醒过
        self.assertEqual(r['capSaved'], 'SS')
        self.assertEqual(r['sss'], 'SSS')
        self.assertEqual(r['ex'], {'pct': 44, 'place': 50, 'sketch': 30, 'clue': 50})   # 50%×0.5 + 30%×0.3 + 50%×0.2
        # 300 + 40 + SAN 80 − 30 − 30 + 探索封顶 200 = 560，梦魇 ×1.2
        self.assertEqual((r['tot']['sum'], r['tot']['total']), (560, 672))
        self.assertIn({'cat': '应对 · 异象', 'text': 'x', 'pts': 20, 'n': 2}, r['tot']['items'])
        self.assertEqual(r['samples'], ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'])

    def test_ending_rates_saves_record_and_shows_grade_screen(self):
        page = self.game(diff='easy')
        page.evaluate("""gameFact('anomaly',{id:'broad',phase:'start',lethal:false});gameFact('anomaly',{id:'broad',phase:'end',survived:true,lethal:false});
          gameFact('anomaly',{id:'turn',phase:'start',lethal:false});gameFact('anomaly',{id:'turn',phase:'hurt',loss:26});gameFact('anomaly',{id:'turn',phase:'end',survived:true,lethal:false});
          gameFact('inspection',{day:1,slot:0,compliant:false});gameFact('fakeNormal',{laugh:false});
          Mechanics.activePlaySeconds=600;GameModules.emit('tick',0.6);Speedrun.proof('portal');triggerEnding('portal',true)""")
        r = page.evaluate("""()=>{const m=RunScore.result();return {rated:m.rated,id:m.id,grade:m.grade,items:m.score.items.map(i=>i.text+':'+i.pts),
          rec:!!RunRecords.get(m.id),replay:RunRecords.get(m.id).replay,grades:RunRecords.grades(),
          time:m.time,ts:m.timeScore,btn:!!document.querySelector('#ends .eres')}}""")
        self.assertTrue(r['rated'] and r['rec'] and r['btn'])
        self.assertEqual(r['replay'], 1)
        self.assertIn(r['grade'], r['grades'])
        self.assertEqual((r['time']['used'], r['time']['par']), (600, 1320))
        self.assertEqual(r['ts'], 600)                                   # 不到标准用时的三分之二：封顶
        for want in ('化解「广播点名」:20', '「被拍肩膀」受伤后脱身:-10', '学生会检查 · 缺席:-30', '忍住了没笑:15'):
            self.assertTrue(any(i.startswith(want.split(':')[0]) and i.endswith(':' + want.split(':')[1]) for i in r['items']), (want, r['items']))
        page.locator('#ends .eres').click()
        page.wait_for_function("!document.getElementById('results').hidden")
        # 动画按真实时间播 1.1 秒、35% 处放音效；满载时帧会变慢，等音效放过、动画播完再看（不用固定等待）
        page.wait_for_function("grades.length>0&&!document.getElementById('rscv')._raf", timeout=20000)
        r = page.evaluate("""()=>{const cv=document.getElementById('rscv'),c=cv.getContext('2d'),d=c.getImageData(0,0,cv.width,cv.height).data;let lit=0;
          for(let i=0;i<d.length;i+=400) if(d[i]+d[i+1]+d[i+2]>60) lit++;
          return {lit,letter:document.getElementById('rsLetter').textContent,grades:grades.slice(),body:document.getElementById('rsBody').textContent,
            foot:!document.getElementById('rsFoot').hidden}}""")
        self.assertGreater(r['lit'], 50)                                  # 画面真的画出来了
        self.assertEqual(r['grades'], [page.evaluate("ScoreRules.band(RunScore.result().grade)")])   # 评级音效只放一次
        self.assertIn('探索度', r['body'])
        self.assertTrue(r['foot'])
        page.locator('#rsFoot').click()
        page.wait_for_function("!document.getElementById('footv').hidden")
        self.assert_js(page, "document.querySelectorAll('#fpTabs button').length>=1")

    def test_death_shows_one_line_no_grade_no_record(self):
        page = self.game(diff='hard')
        page.evaluate("gameFact('lesson',{task:1,correct:true});kill('x','drown','an:rain')")
        page.wait_for_timeout(500)
        page.evaluate("deathSkip()")
        page.wait_for_function("document.getElementById('die').style.display==='flex'")
        r = page.evaluate("({line:(document.getElementById('diescore')||{}).textContent,recs:RunRecords.list().length,log:localStorage.getItem('wdfz3d_runlog_cur'),res:RunScore.result()})")
        self.assertTrue(r['line'].startswith('本局积分 '))
        self.assertIn('探索度', r['line'])
        self.assertEqual((r['recs'], r['log'], r['res']), (0, None, None))

    def test_debug_run_is_not_rated(self):
        page = self.game()
        page.evaluate("Dev.unlock();Dev.close();Speedrun.proof('car');triggerEnding('car',true)")
        r = page.evaluate("({rated:RunScore.result().rated,note:(document.querySelector('#ends .enote')||{}).textContent,btn:!!document.querySelector('#ends .eres'),recs:RunRecords.list().length})")
        self.assertEqual(r, {'rated': False, 'note': '调试局 · 不评级，不进通关记录', 'btn': False, 'recs': 0})

    def test_records_caps_keep_best_and_replay_budget(self):
        page = self.page()
        r = page.evaluate("""()=>{localStorage.removeItem('wdfz3d_clears_v1');RunRecords._reset();
          const base=DebugArchiveTab.sampleMeta('C','car','easy');
          for(let i=0;i<56;i++){ const m=JSON.parse(JSON.stringify(base)); m.source='play'; m.at=1000+i; m.gradeScore=700+(i===3?900:0); m.grade=i===3?'SSS':'C';
            m.time.used=1000+(i===7?-900:i); RunRecords.add(m,{v:1,track:'',events:[],scenes:[],clock:[],sketch:{}}); }
          const L=RunRecords.list();
          return {n:L.length,best:L.some(x=>x.grade==='SSS'),fast:L.some(x=>x.time.used===100),replays:L.filter(x=>x.replay).length,
            grades:RunRecords.grades().C.count,sss:RunRecords.grades().SSS.count}}""")
        self.assertEqual(r['n'], 50)
        self.assertTrue(r['best'] and r['fast'])                          # 最高评级、最快用时都留下
        self.assertLessEqual(r['replays'], 12)                            # 最近 10 次 + 最佳
        self.assertEqual((r['grades'], r['sss']), (55, 1))                # 评级取得摘要不随删旧记录减少
        # 写不下回放：先删旧的回放，再不行只存元数据
        r = page.evaluate("""()=>{const w=GameStorage.write;GameStorage.write=(k,v)=>k.indexOf('wdfz3d_clear_')===0?false:w(k,v);
          const id=RunRecords.add(DebugArchiveTab.sampleMeta('B','car','easy'),{v:1,track:'',events:[],scenes:[],clock:[],sketch:{}});GameStorage.write=w;
          return {rp:RunRecords.get(id).replay,left:RunRecords.list().filter(x=>x.replay).length}}""")
        self.assertEqual(r, {'rp': 0, 'left': 0})

    def test_replay_player_and_footprint(self):
        page = self.page()
        self.menu(page)
        page.evaluate("localStorage.removeItem('wdfz3d_clears_v1');RunRecords._reset();window.rid=DebugArchiveTab.generate('B','car','easy',true)")
        page.locator('#btnrec').click()
        page.locator('#rcList .rcrow').first.click()
        page.wait_for_function("!document.getElementById('results').hidden")
        page.locator('#rsReplay').click()
        page.wait_for_function("!document.getElementById('replayv').hidden")
        r = page.evaluate("()=>{const before=+document.getElementById('rpTime').value;document.getElementById('rpNext').click();document.getElementById('rpNext').click();return {before,after:+document.getElementById('rpTime').value,scene:document.getElementById('rpScene').textContent,cur:!!document.querySelector('#rpEvents li.cur')}}")
        self.assertLess(r['before'], r['after'])
        self.assertEqual(r['scene'], '教学楼 1F')
        self.assertTrue(r['cur'])
        page.locator('#rpPlay').click(); page.wait_for_timeout(400)
        self.assert_js(page, "+document.getElementById('rpTime').value>0&&document.getElementById('rpPlay').textContent==='暂停'")
        page.keyboard.press('Escape')
        self.assert_js(page, "document.getElementById('replayv').hidden&&!document.getElementById('results').hidden")
        page.locator('#rsFoot').click()
        r = page.evaluate("()=>{const t=[...document.querySelectorAll('#fpTabs button')].map(b=>b.textContent);let saved=null;const a=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){saved=this.download+'|'+this.href.slice(0,22);};document.getElementById('fpSave').click();HTMLAnchorElement.prototype.click=a;return {t,saved}}")
        self.assertEqual(len(r['t']), 2)
        self.assertTrue(r['saved'].startswith('足迹图-teach1.png|data:image/png'))
        page.keyboard.press('Escape'); page.keyboard.press('Escape')
        self.assert_js(page, "document.getElementById('results').hidden&&!document.getElementById('records').hidden")   # 回到列表

    def test_speedrun_ranking_and_best_grade(self):
        page = self.page()
        self.menu(page)
        page.evaluate("""localStorage.removeItem('wdfz3d_clears_v1');localStorage.removeItem('wdfz3d_speedrun_v1');RunRecords._reset();
          [['A',500000],['SS',700000],['C',300000]].forEach(([g,ms])=>{const m=DebugArchiveTab.sampleMeta(g,'car','easy');m.source='play';m.mode='speedrun';m.diff='easy';m.time.rta=ms;RunRecords.add(m,null);});
          const d=DebugArchiveTab.sampleMeta('S','car','easy');d.mode='speedrun';d.time.rta=100000;RunRecords.add(d,null);""")
        page.locator('#btnspeed').click()
        r = page.evaluate("""()=>({pb:[...document.querySelectorAll('#srrecords tbody tr')][0].lastChild.textContent,
          rows:[...document.querySelectorAll('.srrank li')].map(l=>l.querySelector('em').textContent)})""")
        self.assertEqual(r['pb'], 'SS')                                   # 最佳评级（调试生成的不算）
        self.assertEqual(r['rows'], ['C', 'A', 'SS'])                     # 按用时
        page.locator('.srrank select[data-k="by"]').select_option('grade')
        self.assert_js(page, "[...document.querySelectorAll('.srrank li em')].map(e=>e.textContent).join()==='SS,A,C'")
        self.assert_js(page, "Speedrun.attachScore('nope',{score:1,grade:'F',rules:1})===false")

    def test_debug_tab_previews_generates_and_archive_section(self):
        page = self.page()
        self.menu(page)
        page.evaluate("localStorage.removeItem('wdfz3d_clears_v1');RunRecords._reset();localStorage.removeItem('wdfz3d_death_archive_v1');DevLock.ask();DevLock.submit(DEV_CODE)")
        page.wait_for_function("DEV.on")
        self.assert_js(page, "DEV_TABS.indexOf('archive')>=0&&!!document.querySelector('#dev [data-dev-tab=\"archive\"]')")
        page.locator('#dev [data-dev-tab="archive"]').click()
        page.locator('#dvaGrade').select_option('SSS')
        page.locator('#dvaPreview').click()
        page.wait_for_function("!document.getElementById('results').hidden&&document.getElementById('rsLetter').textContent==='SSS'")
        self.assert_js(page, "RunRecords.list().length===0")              # 预览不写记录
        page.evaluate("ResultsUI.close()")
        page.locator('#dvaGenAll').click()
        r = page.evaluate("()=>({g:RunRecords.list().map(x=>x.grade).sort().join(),src:RunRecords.list().every(x=>x.source==='debug'),real:Object.keys(RunRecords.grades()).length,ach:Object.keys(Achievements.state().got).filter(id=>!Achievements.state().got[id].legacy).length})")
        self.assertEqual(r['g'], ','.join(sorted(['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'])))
        self.assertTrue(r['src'])
        self.assertEqual((r['real'], r['ach']), (0, 0))                   # 不点亮真实的评级取得、不计成就
        page.evaluate("Dev.close()")
        page.locator('#btnarchive').click()
        r = page.evaluate("""()=>({title:document.getElementById('arTitle').textContent,count:document.querySelector('[data-sec="grades"] i').textContent,
          cards:[...document.querySelectorAll('#arsec-grades .arcard')].map(c=>c.classList.contains('open')),
          meta:document.querySelector('#arsec-grades .arcard small').textContent})""")
        self.assertEqual(r['title'], 'CG 档案馆')
        self.assertEqual(r['count'], '已解锁 9 / 9')
        self.assertTrue(all(r['cards']))
        self.assertEqual(r['meta'], '直接解锁 · 没有亲历')
        page.locator('#arsec-grades .arcard[data-id="x.grade.A"] button').click()
        page.wait_for_function("!document.getElementById('results').hidden&&document.getElementById('rsLetter').textContent==='A'")
        page.locator('#rsBack').click()
        self.assert_js(page, "!document.getElementById('archive').hidden")
        self.assertEqual(page.evaluate("RunRecords.removeDebug()"), 9)

    def test_real_grade_lights_archive_card_and_unlock_all(self):
        page = self.page()
        self.menu(page)
        page.evaluate("""localStorage.removeItem('wdfz3d_clears_v1');RunRecords._reset();localStorage.removeItem('wdfz3d_death_archive_v1');
          const m=DebugArchiveTab.sampleMeta('A','face','easy');m.source='play';RunRecords.add(m,null);""")
        page.locator('#btnarchive').click()
        r = page.evaluate("""()=>({count:document.querySelector('[data-sec="grades"] i').textContent,
          a:document.querySelector('#arsec-grades .arcard[data-id="x.grade.A"] small').textContent,
          locked:document.querySelectorAll('#arsec-grades .arcard:not(.open)').length})""")
        self.assertEqual(r['count'], '已解锁 1 / 9')
        self.assertTrue(r['a'].startswith('第一次取得') and '取得 1 次' in r['a'] and '《白名单》' in r['a'])
        self.assertEqual(r['locked'], 8)
        page.evaluate("DeathArchive.unlockAll()")
        self.assert_js(page, "document.querySelector('[data-sec=\"grades\"] i').textContent==='已解锁 9 / 9'")
        page.reload(wait_until='load')                                     # granted 的 x. 条目重启后还在
        page.wait_for_function("typeof DeathArchive!=='undefined'")
        self.assert_js(page, "!!DeathArchive.state().granted['x.grade.F']")

    def test_explore_metric_and_handbook_line(self):
        page = self.game()
        r = page.evaluate("""()=>{const t=RunScore.totals();const a=RunScore.explore();
          S.clues={bell:1,stall:1,beast:1};gameFact('chalk',{});RunScore.state().zones.field=1;
          const b=RunScore.explore();
          return {rooms:t.rooms.length,hidden:t.rooms.indexOf('lift_dream'),zones:t.zones.length,a,b}}""")
        self.assertEqual(r['rooms'], 40)  # 33 existing explorable rooms plus seven stairwells
        self.assertEqual(r['hidden'], -1)                                 # 隐藏场景不进分母
        self.assertGreaterEqual(r['zones'], 10)
        self.assertGreater(r['b']['place'], r['a']['place'])
        self.assertEqual(r['b']['clue'], round(100 / 21))                 # 隐藏路线的线索不算
        page.evaluate("UI.open('mapv')")
        self.assert_js(page, "document.getElementById('mapExplore').textContent.startsWith('本局探索度 ')")
        # 室内看的是楼层草图（校园总图的图例这时是隐藏的）：这一行在顶部工具行里、看得见；换楼层重绘后还在
        self.assert_js(page, "!!document.querySelector('#maptools #mapExplore')&&document.getElementById('mapExplore').getBoundingClientRect().width>0")
        page.evaluate("ExplorationMap.selected='campus';UI.renderMap()")
        self.assert_js(page, "!!document.querySelector('#maptools #mapExplore')&&document.getElementById('mapExplore').getBoundingClientRect().width>0")

    def test_run_log_samples_persist_and_resume(self):
        page = self.game()
        r = page.evaluate("""()=>{for(let i=0;i<30;i++){S.x+=6;Mechanics.activePlaySeconds+=0.5;GameModules.emit('tick',0.5);}
          for(let i=0;i<22;i++){Mechanics.activePlaySeconds+=0.5;GameModules.emit('tick',0.5);}
          const cur=JSON.parse(localStorage.getItem('wdfz3d_runlog_cur'));
          saveGame();const id=RunScore.run();applySave(loadGame());
          for(let i=0;i<4;i++){S.x+=6;Mechanics.activePlaySeconds+=0.5;GameModules.emit('tick',0.5);}
          return {pts:RunTrack.decode(cur.track).length,run:cur.run===id,partial:RunLog.state().partial,after:RunLog.state().samples.length}}""")
        self.assertGreaterEqual(r['pts'], 25)
        self.assertTrue(r['run'])
        self.assertEqual(r['partial'], 0)                                 # 同一局：接着记
        self.assertGreater(r['after'], r['pts'])
        # 编码来回一致；30 分钟的采样体积在预算内
        r = page.evaluate("""()=>{const s=[];for(let i=0;i<3600;i++)s.push([i*5,i<1800?0:1,10000+Math.round(Math.sin(i/9)*300),20000+i%400,i%64]);
          const e=RunTrack.encode(s),d=RunTrack.decode(e);return {same:JSON.stringify(d)===JSON.stringify(s),kb:e.length/1024}}""")
        self.assertTrue(r['same'])
        self.assertLess(r['kb'], 40)

    def test_dialogs_fit_phone_screens(self):
        page = self.page(touch=True)
        self.menu(page)
        page.evaluate("localStorage.removeItem('wdfz3d_clears_v1');RunRecords._reset();DebugArchiveTab.generate('S','car','easy',true)")
        for w, h in ((844, 390), (740, 360), (390, 844)):
            page.set_viewport_size({'width': w, 'height': h})
            for opener, box in (("AchievementsUI.open()", 'achieve'), ("RecordsUI.open()", 'records'),
                                ("ResultsUI.open(RunRecords.list()[0],{back:null,backLabel:'返回'})", 'results')):
                page.evaluate(opener)
                page.wait_for_timeout(120)
                r = page.evaluate(f"""()=>{{const a=document.getElementById('{box}'),f=a.querySelector('.tpfoot').getBoundingClientRect();
                  return {{outer:a.scrollHeight>a.clientHeight+1,foot:f.bottom<=innerHeight+1,sw:document.documentElement.scrollWidth<=innerWidth}}}}""")
                self.assertEqual(r, {'outer': False, 'foot': True, 'sw': True}, (w, h, box))
                page.evaluate(f"document.getElementById('{box}').hidden=true")


if __name__ == '__main__':
    unittest.main()
