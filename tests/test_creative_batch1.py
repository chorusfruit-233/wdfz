"""《校园怪谈创意提案》第一批：C2 上一局的你、C7 成绩单评语、C8 回放里的第二条轨迹。"""
from browser_case import BrowserCase


class CreativeBatch1Test(BrowserCase):
    def game(self):
        page = self.page()
        page.evaluate("localStorage.removeItem(LAST_LIFE_KEY);Game.start('hard',{talent:'watch'})")
        page.wait_for_function("S.room==='teach1'&&GLR.roomMesh")
        page.evaluate("clearIntroTimers();running=false;S.intro=0;S.day=1;S.tsec=556;AN.active=false;AN.next=1e6;PAT.next=1e6;DEV.god=false;true;")
        return page

    def test_last_life_marks_where_you_died_and_only_real_public_deaths_count(self):
        page = self.game()
        r = page.evaluate("""()=>{const out={};const x=S.x,y=S.y;
          kill('测试','grip','patrol');out.saved=LastLife.read();
          // 新开局：抄进本局，地上画出记号
          freshState('hard');GameModules.emit('newGame',{diff:'hard',mode:'normal'});out.rt=RT.lastLife;
          return out;}""")
        self.assertIsNotNone(r['saved'])
        self.assertEqual(r['saved']['scene'], 'teach1')
        self.assertEqual(r['saved']['tsec'], 556)
        self.assertEqual(r['rt']['scene'], 'teach1')
        page.evaluate("S.screen='play';S.dead=false;S.mode='in';S.room='teach1';doEnterRoom('teach1');true;")
        page.wait_for_function("GLR.roomMesh&&GLR.roomMesh.userData.roomData===INTERIORS.teach1")
        r = page.evaluate("()=>{render(.1);return {mark:!!LastLife.F.grp,key:LastLife.F.key}}")
        self.assertTrue(r['mark'])
        # 读档不重复生成：本局记录跟着存档；这一局的死亡不会改写本局显示的那条
        r = page.evaluate("""()=>{autoSave();const s=loadGame();freshState('hard');running=false;applySave(s);return JSON.stringify(RT.lastLife);}""")
        self.assertIn('teach1', r)
        # 预知梦惊醒、内部场景不留；通关清掉；设置里能清
        r = page.evaluate("""()=>{const out={};LastLife.write(null);
          GameModules.emit('gameFact',{kind:'death',source:'patrol',fx:'grip',wake:true});out.wake=LastLife.read();
          S.mode='in';S.room='lift_dream';GameModules.emit('gameFact',{kind:'death',source:'void_lost',fx:'void'});out.maze=LastLife.read();
          S.room='teach1';GameModules.emit('gameFact',{kind:'death',source:'patrol',fx:'grip'});out.real=!!LastLife.read();
          GameModules.emit('gameFact',{kind:'ending',id:'car',fake:false});out.afterEnd=LastLife.read();
          GameModules.emit('gameFact',{kind:'death',source:'patrol',fx:'grip'});document.getElementById('sLastLife').click();out.cleared=LastLife.read();
          return out;}""")
        self.assertEqual(r, {'wake': None, 'maze': None, 'real': True, 'afterEnd': None, 'cleared': None})

    def test_lost_and_found_has_the_blank_student_card(self):
        page = self.game()
        r = page.evaluate("""()=>{RT.lastLife={scene:'teach2',x:1,y:1,fy:0,tsec:556,day:1};doEnterRoom('guard1');const R=INTERIORS.guard1;
          S.x=R.ox+4.5*R.tw;S.y=R.oy+6.5*R.th;const hint=interactHint();tryInteract();return {hint,sub:document.getElementById('sub').innerText}}""")
        self.assertEqual(r['hint'], '失物招领箱')
        self.assertIn('照片那一栏是空的', r['sub'])
        self.assertIn('第 1 天 09:16', r['sub'])

    def test_report_card_writes_up_to_three_calm_lines_and_never_internal_things(self):
        page = self.game()
        r = page.evaluate("""()=>{const m={day:2,score:{items:[
            {cat:'应对 · 异象',text:'化解「雨」',pts:20,n:1},{cat:'校规与巡察',text:'学生会检查 · 在教室',pts:10,n:2},
            {cat:'校规与巡察',text:'躲在柜子里躲过',pts:15,n:1},{cat:'应对 · 异象',text:'化解「满员」',pts:20,n:1}]}};
          const a=ResultsUI.reportCard(m);const b=ResultsUI.reportCard({day:3,score:{items:[{cat:'应对 · 异象',text:'化解「满员」',pts:20,n:1}]}});
          return {a,b,html:ResultsUI.body(Object.assign({explore:{pct:1,place:1,sketch:1,clue:1},ach:{run:[]}},m,{score:Object.assign(m.score,{total:1,mult:1,sum:1})}))};}""")
        self.assertEqual(r['a'], ['该生在「雨」里没有回头。', '该生 2 次检查都在座位上。', '该生在柜子里待了很久。'])
        self.assertEqual(r['b'], ['该生第 3 天离开了学校。没有人看见是怎么走的。'])
        self.assertIn('成绩单', r['html'])
        self.assertNotIn('满员', ''.join(r['a'] + r['b']))

    def test_patrol_track_is_recorded_only_in_the_same_building_and_drawn_after_clearing(self):
        page = self.game()
        r = page.evaluate("""()=>{RunLog.discard();RunLog.state().run='t1';PAT.state='walk';PAT.room='teach1';PAT.x=S.x+30;PAT.y=S.y;
          S.screen='play';for(let i=0;i<5;i++)GameModules.emit('tick',1);const same=RunLog.state().pat.length;
          PAT.room='lab2';for(let i=0;i<5;i++)GameModules.emit('tick',1);const other=RunLog.state().pat.length-same;
          const snap=RunLog.snapshot();return {same,other,packed:snap.pat.length};}""")
        self.assertGreaterEqual(r['same'], 4)
        self.assertEqual(r['other'], 0)                       # 不在同一栋楼不记
        self.assertEqual(r['packed'], r['same'])
        # 游戏里没有任何地方显示它；回放里的按钮默认关着，打开才画
        r = page.evaluate("""()=>{RecordsUI.mount&&0;const ok=RecordsUI.replay('current');const b=document.getElementById('rpPat');
          const out={ok,hidden:b.hidden,pressed:b.getAttribute('aria-pressed')};b.click();out.after=b.getAttribute('aria-pressed');return out;}""")
        self.assertTrue(r['ok'])
        self.assertFalse(r['hidden'])
        self.assertEqual((r['pressed'], r['after']), ('false', 'true'))
