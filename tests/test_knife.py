"""小刀与隐藏假结局（内部彩蛋；计划《校园直通、翻越受伤与国际交流》第 16 节）：被抓住后 1 秒内从背包拿出并使用。"""
from browser_case import BrowserCase


class KnifeTest(BrowserCase):
    def game(self):
        page = self.page()
        page.evaluate("Game.start('hard',{talent:'watch'})")
        page.wait_for_function("S.room==='teach1'&&GLR.roomMesh&&GLR.roomMesh.userData.roomData===INTERIORS.teach1")
        page.evaluate("clearIntroTimers();running=false;S.intro=0;S.day=2;S.tsec=900;AN.active=false;AN.next=1e6;PAT.next=1e6;patReset();DEV.god=false;S.seated=false;S.screen='play';RT.knife=null;true;")
        return page

    def take(self, page):
        return page.evaluate("""()=>{doEnterRoom('gear1');const R=INTERIORS.gear1,C=KNIFE_CFG;S.x=R.ox+(C.cell.c-0.3)*R.tw;S.y=R.oy+(C.cell.r+1.2)*R.th;
          const hint=interactHint();tryInteract();return {hint,has:hasItem('small_knife')};}""")

    def catch(self, page):
        """模拟巡察者真正抓到：走 patrol-world 的 grip 同一个入口。"""
        return page.evaluate("()=>{const took=GameModules.first('patrolCatch',{msg:'一只手按住了你的头顶。它在点名。'})===true;if(!took)kill('一只手按住了你的头顶。它在点名。','grip','patrol');return took;}")

    def test_knife_is_in_the_gear_room_once(self):
        page = self.game()
        self.assertEqual(self.take(page), {'hint': '旧工具抽屉', 'has': True})
        self.assertFalse(page.evaluate("()=>Knife.near()"))

    def test_taking_it_out_and_using_it_from_the_bag_within_one_second_is_the_fake_ending(self):
        page = self.game()
        self.take(page)
        self.assertTrue(self.catch(page))
        r = page.evaluate("""()=>{const blocked=!playerInputAllowed();UI.open('bag');const sim=GamePolicy.simulationAllowed(gameInputContext());
          GameModules.emit('tick',.3);useItem('small_knife');GameModules.emit('tick',.3);useItem('small_knife');
          return {blocked,sim,end:RT.end,dead:S.dead,has:hasItem('small_knife'),fake:!!ENDINGS.knife.fake};}""")
        self.assertEqual(r, {'blocked': True, 'sim': True, 'end': 'knife', 'dead': False, 'has': False, 'fake': True})

    def test_hotbar_late_or_pre_equipped_does_not_count(self):
        page = self.game()
        self.take(page)
        # 快捷栏
        self.catch(page)
        r = page.evaluate("()=>{S.hot[0]='small_knife';useHot(0);useHot(0);for(let i=0;i<12;i++)GameModules.emit('tick',.1);return {end:RT.end||null,dead:S.dead,src:S.deathSource||null};}")
        self.assertEqual((r['end'], r['dead']), (None, True))
        page2 = self.game()
        self.take(page2)
        # 超过 1 秒
        self.catch(page2)
        r = page2.evaluate("()=>{useItem('small_knife');for(let i=0;i<11;i++)GameModules.emit('tick',.1);useItem('small_knife');return {end:RT.end||null,dead:S.dead};}")
        self.assertEqual(r, {'end': None, 'dead': True})
        page3 = self.game()
        self.take(page3)
        # 抓之前就拿在手上
        page3.evaluate("useItem('small_knife');true;")
        self.assertFalse(self.catch(page3))
        self.assertTrue(page3.evaluate("()=>S.dead"))

    def test_wake_goes_to_own_seat_next_morning_without_touching_the_trash_route(self):
        page = self.game()
        self.take(page)
        self.catch(page)
        page.evaluate("()=>{useItem('small_knife');useItem('small_knife');}")
        page.evaluate("()=>{if(CUT.on)cutSkip();}")
        page.wait_for_function("document.querySelector('#ends .ewake')")
        page.evaluate("document.querySelector('#ends .ewake').click()")
        r = page.evaluate("()=>({day:S.day,tsec:S.tsec,room:S.room,seated:S.seated,trash:!!RT.trashFake,screen:S.screen,again:!!RT.knife.done})")
        self.assertEqual(r, {'day': 3, 'tsec': 441, 'room': 'teach1', 'seated': True, 'trash': False, 'screen': 'play', 'again': True})
