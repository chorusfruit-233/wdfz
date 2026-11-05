"""国际交流与公开真结局《外国语学生》（计划《校园直通、翻越受伤与国际交流》第 8–9 节，Q1–Q4、Q8）。"""
from browser_case import BrowserCase


class ExchangeTest(BrowserCase):
    def game(self, multi=False):
        page = self.page()
        page.evaluate("Game.start('hard',{talent:'watch'})")
        page.wait_for_function("S.room==='teach1'&&GLR.roomMesh&&GLR.roomMesh.userData.roomData===INTERIORS.teach1")
        page.evaluate("""(m)=>{clearIntroTimers();running=false;S.intro=0;S.day=2;S.tsec=545;AN.active=false;AN.next=1e6;PAT.next=1e6;patReset();DEV.god=false;S.seated=false;S.screen='play';
          RT.exchange={hit:1,phase:'none',tries:{de:0,fr:0},passed:{de:0,fr:0},warned:0,lag:0};RT.multilingual={active:m?1:0};RT.leaveUntil=0;doExitRoom();true;}""", multi)
        return page

    def to_leader(self, page):
        page.evaluate("()=>{GameModules.emit('tick',.1);const l=Exchange.members()[0];S.x=l.x;S.y=l.y+12;S.ang=-Math.PI/2;}")

    def answer(self, page, right):
        """依次回答当前科目的 5 题，right 个答对（按 EXAM 和本局的选项顺序点按钮）。"""
        for i in range(5):
            page.evaluate("""([i,ok])=>{const btns=[...document.querySelectorAll('#choices button')];const txt=document.querySelector('#choices').innerText;
              const k=txt.indexOf('德语')>=0?'de':'fr',item=EXAM[k].q[i];const b=btns.find(x=>ok?x.textContent.trim().endsWith(item[1]):!x.textContent.trim().endsWith(item[1]));b.click();}""", [i, i < right])

    def test_rolls_are_five_and_fifteen_percent_and_speedrun_gets_no_multilingual(self):
        page = self.page()
        r = page.evaluate("""()=>{const out={};for(const u of [0.049,0.10,0.15]){GameRandom.bind(()=>u);GameModules.emit('newGame',{diff:'hard',mode:'normal'});out[u]=[RT.exchange.hit,RT.multilingual.active];}
          GameRandom.bind(()=>0);GameModules.emit('newGame',{diff:'hard',mode:'speedrun'});out.sr=RT.multilingual.active;return out;}""")
        self.assertEqual(r, {'0.049': [1, 1], '0.1': [0, 1], '0.15': [0, 0], 'sr': 0})   # 交流 5%、多语言 15%，各抽各的

    def test_multilingual_registers_directly_and_is_excused(self):
        page = self.game(True)
        self.to_leader(page)
        r = page.evaluate("""()=>{const hint=interactHint();tryInteract();const txt=document.querySelector('#choices').innerText;
          [...document.querySelectorAll('#choices button')][0].click();return {hint,heard:txt.indexOf('以前都听过')>=0,phase:Exchange.state().phase,leave:onLeave()};}""")
        self.assertEqual(r, {'hint': '国际交流接待登记', 'heard': True, 'phase': 'qualified', 'leave': True})

    def test_exams_need_four_of_five_with_one_retake_and_cost_san(self):
        page = self.game(False)
        self.to_leader(page)
        page.evaluate("()=>{S.san=80;tryInteract();[...document.querySelectorAll('#choices button')].find(b=>b.textContent.indexOf('德语')>=0).click();}")
        self.answer(page, 3)
        r = page.evaluate("()=>({san:S.san,passed:Exchange.state().passed.de,tries:Exchange.state().tries.de})")
        self.assertEqual(r, {'san': 74, 'passed': 0, 'tries': 1})
        page.evaluate("()=>{tryInteract();[...document.querySelectorAll('#choices button')].find(b=>b.textContent.indexOf('德语')>=0).click();}")
        self.answer(page, 4)
        page.evaluate("()=>{tryInteract();[...document.querySelectorAll('#choices button')].find(b=>b.textContent.indexOf('法语')>=0).click();}")
        self.answer(page, 5)
        r = page.evaluate("()=>({phase:Exchange.state().phase,how:Exchange.state().how,leave:onLeave()})")
        self.assertEqual(r, {'phase': 'qualified', 'how': 'exam', 'leave': True})

    def test_following_to_the_gate_is_the_true_ending(self):
        page = self.game(True)
        page.evaluate("()=>{Exchange.qualify('multilingual');Exchange.depart();}")
        r = page.evaluate("""()=>{const s=Exchange.state();let n=0;for(;n<6000&&s.phase==='escort'&&!S.dead;n++){const m=Exchange.members(),t=m[m.length-1];
            S.x=t.x;S.y=t.y;GameModules.emit('tick',.1);}return {phase:s.phase,end:RT.end||null,dead:S.dead,warned:s.warned,n};}""")
        self.assertEqual((r['phase'], r['end'], r['dead'], r['warned']), ('done', 'international', False, 0))

    def test_falling_behind_ends_the_chance_and_searchers_catch_you_alone(self):
        page = self.game(True)
        page.evaluate("()=>{Exchange.qualify('multilingual');Exchange.depart();}")
        r = page.evaluate("""()=>{const s=Exchange.state(),m=Exchange.members();S.x=m[0].x+7/U2M;S.y=m[0].y;for(let i=0;i<20;i++)GameModules.emit('tick',.1);
          const slow=s.phase==='escort'&&s.lag===0;S.x=m[0].x+40/U2M;for(let i=0;i<45;i++)GameModules.emit('tick',.1);return {slow,phase:s.phase};}""")
        self.assertTrue(r['slow'])
        self.assertEqual(r['phase'], 'over')
        page2 = self.game(True)
        page2.evaluate("()=>{Exchange.qualify('multilingual');Exchange.depart();}")
        r = page2.evaluate("""()=>{const s=Exchange.state(),h=s.search[0];const p=Exchange.at(s.prog+300);S.x=p.x;S.y=p.y;h.x=S.x+30;h.y=S.y;
          for(let i=0;i<40&&!S.dead;i++)GameModules.emit('tick',.1);return {dead:S.dead};}""")
        self.assertTrue(r['dead'])
