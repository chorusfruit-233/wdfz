"""电梯楼层、等待、存档和特殊空间的浏览器回归。"""
from browser_case import BrowserCase


class ElevatorTest(BrowserCase):
    def game(self, touch=False):
        page = self.page(touch=touch)
        page.evaluate("""Game.start('hard');clearIntroTimers();running=false;S.intro=0;
          S.day=2;S.tsec=760;S.talent='code';S.san=80;AN.active=false;AN.id=null;
          AN.next=1000;patReset();PAT.next=1000;RT.inspection=null;""")
        page.wait_for_function("S.room==='teach1'&&GLR.roomMesh&&GLR.roomMesh.userData.roomData===INTERIORS.teach1")
        page.evaluate("clearIntroTimers();running=false;S.intro=0;S.day=2;S.tsec=760;S.talent='code';S.san=80;AN.active=false;AN.id=null;AN.next=1000;patReset();PAT.next=1000;RT.inspection=null")
        return page

    def test_wait_board_travel_and_restore_on_both_buildings(self):
        for host, touch in [('teach', False), ('lab', True)]:
            with self.subTest(host=host, touch=touch):
                page = self.game(touch)
                page.evaluate("""host=>{
                  doEnterRoom(host+'1',Elevator.landing(host,1));
                  window.normalRandom=Math.random;Math.random=()=>.9;tryInteract();
                }""", host)
                self.assert_js(page, f"Elevator.state('{host}').phase==='waiting'")
                page.evaluate('Elevator.tick(4);tryInteract()')
                self.assert_js(page, 'UI.chooseOpen')
                button = page.locator('#choices button').filter(has_text='走进电梯')
                button.tap() if touch else button.click()
                self.assert_js(page, f"S.room==='lift_{host}'&&RT.elevatorRide.phase==='cabin'")
                page.evaluate('Elevator.controls()')
                button = page.locator('#choices button').filter(has_text='5 层')
                button.tap() if touch else button.click()
                self.assert_js(page, "RT.elevatorRide.phase==='moving'&&loadGame().rt.elevatorRide.target===5")
                page.evaluate("let saved=loadGame();freshState('hard');running=false;applySave(saved);Elevator.tick(10)")
                self.assert_js(page, f"S.room==='{host}5'&&!RT.elevatorRide&&Elevator.state('{host}').floor===5")
                self.assert_js(page, 'Collision.depth(S.x,S.y,PRAD)<1e-7')
                page.evaluate('Math.random=window.normalRandom')

    def test_every_landing_has_collision_free_space(self):
        page = self.game()
        result = page.evaluate("""()=>{
          let bad=[];
          for(const host of ['teach','lab'])for(let floor=1;floor<=5;floor++){
            let room=host+floor;doEnterRoom(room,Elevator.landing(host,floor));
            if(Collision.depth(S.x,S.y,PRAD)>1e-7)bad.push(room);
          }return bad;
        }""")
        self.assertEqual(result, [])

    def test_dream_freezes_clock_but_allows_movement_and_return(self):
        page = self.game()
        page.evaluate("""doEnterRoom('lab1',Elevator.landing('lab',1));
          Math.random=()=>0;Elevator.board('lab',1);Elevator.controls();""")
        page.locator('#choices button').filter(has_text='67 层').click()
        self.assert_js(page, "S.room==='lift_dream'&&RT.elevatorRide.phase==='dream'&&S.san===75")
        result = page.evaluate("""()=>{
          let before=S.tsec,x=S.x;KEY.w=true;update(1);KEY.w=false;
          let r={before,after:S.tsec,moved:S.x>x,canSave:saveGame()};
          let save=loadGame();freshState('hard');running=false;applySave(save);
          r.restored=S.room==='lift_dream'&&RT.elevatorRide.phase==='dream';
          S.x=INTERIORS.lift_dream.ox+15.5*9;S.y=INTERIORS.lift_dream.oy+5.5*9;S.ang=0;tryInteract();
          r.returned=S.room==='lab1'&&!RT.elevatorRide;
          return r;
        }""")
        self.assertEqual(result['before'], result['after'])
        self.assertTrue(result['moved'])
        self.assertTrue(result['canSave'] and result['restored'] and result['returned'])
