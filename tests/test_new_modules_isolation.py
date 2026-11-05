"""2026-11-05 新模块的表现层边界：纸飞机、窗内视线、梦、小刀、受伤、国际交流、体检、午夜食堂在渲染和提示时不写状态、不报错。"""
from browser_case import BrowserCase


class NewModulesIsolationTest(BrowserCase):
    def test_render_and_hints_neither_write_state_nor_throw(self):
        page = self.page()
        page.evaluate("Game.start('hard',{talent:'watch'})")
        page.wait_for_function("S.room==='teach1'&&GLR.roomMesh")
        r = page.evaluate("""()=>{clearIntroTimers();running=false;S.intro=0;S.day=2;S.tsec=900;AN.active=false;AN.next=1e6;PAT.next=1e6;patReset();S.screen='play';
          ['paper','windowGaze','inception','knife','body','exchange','checkup','midnightMeal'].forEach(k=>{delete RT[k];});
          const before=GameModules.errors().length,bad=[];
          for(const room of ['admin1','admin2','dorm2','gear1','teach6','link1','canteen1',null]){
            if(room)doEnterRoom(room);else doExitRoom();
            const snap=JSON.stringify([S,RT,PAT]);
            for(let i=0;i<3;i++){render(.05);updateHUD();interactHint();playerInputAllowed();}
            if(JSON.stringify([S,RT,PAT])!==snap)bad.push(room||'out');}
          return {errors:GameModules.errors().slice(before).map(e=>String(e.error||e.message||e).slice(0,120)),bad};}""")
        self.assertEqual(r['errors'], [])
        self.assertEqual(r['bad'], [])
