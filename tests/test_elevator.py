"""电梯：直接走进走出、门的行为、楼层、存档和特殊空间的浏览器回归（计划《电梯直通、新天赋、新结局与恐怖氛围》第 1 节、12.10 节）。"""
from browser_case import BrowserCase

# 页面里的小工具：按真实移动走路（update），门的状态全部由 Elevator.tick 推进
HELP = """
window.walk=(n,key)=>{for(let i=0;i<n;i++){if(key)KEY[key]=true;update(1/30);}if(key)KEY[key]=false;};
window.faceDoor=R=>{const f=Elevator.frame(R);S.ang=Math.atan2(-f.oy,-f.ox);};   /* 面朝电梯门（往轿厢里走） */
window.faceOut=R=>{const f=Elevator.frame(R);S.ang=Math.atan2(f.oy,f.ox);};      /* 背对轿厢（往走廊走） */
window.local=()=>Elevator.local(INTERIORS[S.room],S.x,S.y);
window.callAndWait=(host,floor)=>{doEnterRoom(host+floor,Elevator.landing(host,floor));tryInteract();const L=Elevator.state(host);   /* 等到门刚好开足 */
  for(let i=0;i<200&&!(L.floor===floor&&L.phase==='idle'&&L.door>=1&&L.dir===0);i++)Elevator.tick(.05);};
true;
"""


class ElevatorTest(BrowserCase):
    def game(self, touch=False):
        page = self.page(touch=touch)
        page.evaluate("""Game.start('hard');clearIntroTimers();running=false;S.intro=0;
          S.day=2;S.tsec=760;S.talent='code';S.san=80;AN.active=false;AN.id=null;
          AN.next=1000;patReset();PAT.next=1000;RT.inspection=null;""")
        page.wait_for_function("S.room==='teach1'&&GLR.roomMesh&&GLR.roomMesh.userData.roomData===INTERIORS.teach1")
        page.evaluate("clearIntroTimers();running=false;S.intro=0;S.day=2;S.tsec=760;S.talent='code';S.san=80;AN.active=false;AN.id=null;AN.next=1000;patReset();PAT.next=1000;RT.inspection=null")
        page.evaluate(HELP)
        return page

    def test_walk_in_ride_and_walk_out_on_both_buildings(self):
        for host, touch in [('teach', False), ('lab', True)]:
            with self.subTest(host=host, touch=touch):
                page = self.game(touch)
                page.evaluate("""host=>{
                  window.normalRandom=Math.random;Math.random=()=>.9;
                  doEnterRoom(host+'1',Elevator.landing(host,1));tryInteract();
                }""", host)
                # 电梯就在一楼、门关着：按呼梯键直接开门；门开足以前门洞挡人
                self.assert_js(page, f"Elevator.state('{host}').dir===1&&Elevator.doorAmount('{host}',1)===0")
                page.evaluate(f"for(let i=0;i<10;i++)Elevator.tick(.1)")
                self.assert_js(page, f"Elevator.doorAmount('{host}',1)===1")
                # 走进去：不弹选项、不换场景，人在门后那节轿厢里，没有卡住
                page.evaluate(f"const R=INTERIORS['{host}1'];faceDoor(R);walk(60,'w')")
                self.assert_js(page, f"S.room==='{host}1'&&Elevator.inCabin()&&local().a<-0.8&&!UI.chooseOpen&&Collision.depth(S.x,S.y,PRAD)<1e-7")
                self.assert_js(page, f"RT.elevatorRide&&RT.elevatorRide.phase==='cabin'&&RT.elevatorRide.origin===1&&interactHint()==='关门 · 选楼层'")
                # 按操纵盘：门立刻开始关，选 5 层；门关上以后才换到运行中的轿厢房间
                page.evaluate("tryInteract()")
                self.assert_js(page, f"UI.chooseOpen&&Elevator.state('{host}').dir===-1")
                button = page.locator('#choices button').filter(has_text='5 层')
                button.tap() if touch else button.click()
                self.assert_js(page, f"S.room==='{host}1'&&RT.elevatorRide.pending===5")
                page.evaluate("walk(36)")
                self.assert_js(page, f"S.room==='lift_{host}'&&RT.elevatorRide.phase==='moving'&&loadGame().rt.elevatorRide.target===5")
                # 运行中读档，照样到站；到站后人在五楼门后的轿厢里，门打开
                page.evaluate("let saved=loadGame();freshState('hard');running=false;applySave(saved);for(let i=0;i<60;i++)update(.1)")
                self.assert_js(page, f"S.room==='{host}5'&&Elevator.inCabin()&&Elevator.state('{host}').floor===5&&Elevator.doorAmount('{host}',5)===1")
                self.assert_js(page, 'Collision.depth(S.x,S.y,PRAD)<1e-7')
                # 走出去：跨出层门就不算在电梯里了
                page.evaluate(f"faceOut(INTERIORS['{host}5']);walk(60,'w')")
                self.assert_js(page, f"S.room==='{host}5'&&!Elevator.inCabin()&&!RT.elevatorRide&&local().a>1")
                page.evaluate('Math.random=window.normalRandom')

    def test_door_rules_hold_auto_close_reopen_and_block(self):
        page = self.game()
        result = page.evaluate("""()=>{
          const r={},R=INTERIORS.teach2,lift=Elevator.state('teach');
          callAndWait('teach',2);r.opened=Elevator.doorAmount('teach',2);
          // 开足后 4 秒没人就关，1 秒关上
          for(let i=0;i<39;i++)Elevator.tick(.1);r.before4=Elevator.doorAmount('teach',2);
          for(let i=0;i<14;i++)Elevator.tick(.1);r.after5=Elevator.doorAmount('teach',2);
          // 关着时走过去被门挡住
          faceDoor(R);walk(45,'w');r.blockedAt=local().a;
          // 重新按开；站在门槛上，门一直不关
          tryInteract();for(let i=0;i<10;i++)Elevator.tick(.1);
          const p=Elevator.world(R,0,0);S.x=p.x;S.y=p.y;
          for(let i=0;i<100;i++)Elevator.tick(.1);r.threshold=Elevator.doorAmount('teach',2);
          // 退到门外一米多，等它开始关；关到一半时走到门口，门重新打开
          const q=Elevator.world(R,1.6,0);S.x=q.x;S.y=q.y;
          for(let i=0;i<45;i++)Elevator.tick(.1);r.closingDir=lift.dir;
          for(let i=0;i<4;i++)Elevator.tick(.1);r.half=Elevator.doorAmount('teach',2);
          const s=Elevator.world(R,0.75,0);S.x=s.x;S.y=s.y;Elevator.tick(.05);r.reopenDir=lift.dir;
          for(let i=0;i<12;i++)Elevator.tick(.1);r.reopened=Elevator.doorAmount('teach',2);
          return r;
        }""")
        self.assertEqual(result['opened'], 1)
        self.assertEqual(result['before4'], 1)
        self.assertEqual(result['after5'], 0)
        self.assertGreater(result['blockedAt'], 0.7)            # 层门在 0.40 米处，人半径 0.33 米
        self.assertEqual(result['threshold'], 1)
        self.assertEqual(result['closingDir'], -1)
        self.assertTrue(0 < result['half'] < 1, result)
        self.assertEqual(result['reopenDir'], 1)
        self.assertEqual(result['reopened'], 1)

    def test_unsafe_call_flashes_and_keeps_door_shut_but_riding_still_works(self):
        page = self.game()
        result = page.evaluate("""()=>{
          const r={},R=INTERIORS.teach3;
          doEnterRoom('teach3',Elevator.landing('teach',3));AN.active=true;
          tryInteract();for(let i=0;i<80;i++)Elevator.tick(.1);
          r.arrived=Elevator.state('teach').floor;r.door=Elevator.doorAmount('teach',3);
          r.text=document.getElementById('sub').innerText;
          tryInteract();r.flash=Elevator.state('teach').flash>0;r.door2=Elevator.doorAmount('teach',3);
          AN.active=false;
          // 已经在轿厢里时：异象照样，选本层就开门
          Elevator.board('teach',3);AN.active=true;Elevator.press(3);for(let i=0;i<10;i++)Elevator.tick(.1);
          r.inside=Elevator.doorAmount('teach',3);AN.active=false;
          return r;
        }""")
        self.assertEqual(result['arrived'], 3)
        self.assertEqual(result['door'], 0)
        self.assertIn('电梯没有反应', result['text'])
        self.assertTrue(result['flash'])
        self.assertEqual(result['door2'], 0)
        self.assertEqual(result['inside'], 1)

    def test_save_inside_the_car_keeps_position_door_and_wrong_elevator_roll(self):
        page = self.game()
        result = page.evaluate("""()=>{
          const R=INTERIORS.lab4;window.normalRandom=Math.random;
          callAndWait('lab',4);faceDoor(R);
          Math.random=()=>0;walk(50,'w');Math.random=window.normalRandom;
          const before={x:S.x,y:S.y,rare:RT.elevatorRide.rare,door:Elevator.state('lab').door};
          saveGame();const saved=loadGame();freshState('hard');running=false;applySave(saved);
          return {before,room:S.room,same:Math.hypot(S.x-before.x,S.y-before.y)<1e-6,rare:RT.elevatorRide&&RT.elevatorRide.rare,
            door:Elevator.state('lab').door,inside:Elevator.inCabin(),depth:Collision.depth(S.x,S.y,PRAD)};
        }""")
        self.assertEqual(result['room'], 'lab4')
        self.assertTrue(result['same'] and result['inside'])
        self.assertEqual(result['depth'], 0)
        self.assertTrue(result['before']['rare'] and result['rare'])     # 跨进门那一刻抽到，读档不重抽
        self.assertEqual(result['door'], result['before']['door'])

    def test_every_landing_and_car_has_collision_free_space(self):
        page = self.game()
        result = page.evaluate("""()=>{
          let bad=[];
          for(const host of ['teach','lab'])for(let floor=1;floor<=5;floor++){
            let room=host+floor;doEnterRoom(room,Elevator.landing(host,floor));
            if(Collision.depth(S.x,S.y,PRAD)>1e-7)bad.push(room);
            const R=INTERIORS[room],c=Elevator.world(R,-1.2,0);
            if(Collision.depth(c.x,c.y,PRAD)>1e-7||solidAt(c.x,c.y))bad.push(room+':car');
            const out=Elevator.world(R,-3,0);if(Collision.depth(out.x,out.y,PRAD)!==Infinity)bad.push(room+':beyond');
          }return bad;
        }""")
        self.assertEqual(result, [])

    def test_dream_freezes_clock_but_allows_movement_and_return(self):
        """错误的电梯：门外是虚空迷宫（模块 void-maze，专项见 test_void_maze）。这里只看电梯流程的衔接。"""
        page = self.game()
        page.evaluate("""doEnterRoom('lab1',Elevator.landing('lab',1));
          Math.random=()=>0;Elevator.board('lab',1);Elevator.controls();""")
        page.locator('#choices button').filter(has_text='67 层').click()
        self.assert_js(page, "S.room==='lift_dream'&&RT.elevatorRide.phase==='dream'&&S.san===75")
        self.assert_js(page, "INTERIORS.lift_dream.noClock&&INTERIORS.lift_dream.noMap&&typeof INTERIORS.lift_dream.build==='function'")
        self.assertIn('身后的电梯门合上了', page.locator('#sub').inner_text())
        self.assert_js(page, "typeof dreamFigTick==='undefined'&&!('uDream' in GLR.postMat.uniforms)")
        result = page.evaluate("""()=>{
          let before=S.tsec,x=S.x,y=S.y;S.ang=Math.PI/4;KEY.w=true;update(1);KEY.w=false;
          let r={before,after:S.tsec,moved:Math.hypot(S.x-x,S.y-y)>1,canSave:saveGame()};
          let save=loadGame();freshState('hard');running=false;applySave(save);
          r.restored=S.room==='lift_dream'&&RT.elevatorRide.phase==='dream';
          const e=MAZE_CFG.exits[0], w=VoidMaze.toWorld(e.x,e.z-0.8);
          doEnterRoom('lift_dream',{x:w.x,y:w.y,ang:Math.PI/2,maze:{fy:e.h}});tryInteract();
          /* 回到上电梯的那一层：推门出来站在走廊里，背对着关上的电梯门 */
          r.returned=S.room==='lab1'&&!RT.elevatorRide&&!Elevator.inCabin()&&Elevator.doorAmount('lab',1)===0&&S.floorY===0&&local().a>0.6;
          return r;
        }""")
        self.assertEqual(result['before'], result['after'])
        self.assertTrue(result['moved'])
        self.assertTrue(result['canSave'] and result['restored'] and result['returned'])
