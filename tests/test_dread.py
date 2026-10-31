"""氛围（恐怖计划 P1）：惊吓预算、有方位的假威胁、骤静、异象前兆、回访变化、五分钟切片。"""
from browser_case import BrowserCase


class DreadTest(BrowserCase):
    def room(self, page):
        page.evaluate("""doEnterRoom('teach1');var R=INTERIORS.teach1;S.x=R.ox+30*R.tw;S.y=R.oy+18.5*R.th;
          S.ang=Math.PI;Dread.reset();void 0""")

    def test_scare_budget_spacing_and_safe_start(self):
        page = self.page()
        self.room(page)
        result = page.evaluate("""() => {
          for(let i=0;i<239;i++)Dread.tick(0.25);          // 开局头一分钟：什么都不加
          const early=DREAD.log.filter(e=>e.strength>=1).length;
          for(let i=0;i<4800;i++)Dread.tick(0.25);         // 再跑 20 分钟
          const ev=DREAD.log.filter(e=>e.strength>=1);
          let minMild=1e9,minStrong=1e9,last={};
          ev.forEach(e=>{const k=e.area+':'+(e.strength>=2?'s':'m');
            if(last[k]!==undefined){const g=e.t-last[k];if(e.strength>=2)minStrong=Math.min(minStrong,g);else minMild=Math.min(minMild,g);}
            last[k]=e.t;});
          // 预算本身：刚放过一个强的，同一区域两分钟内不许再来强的
          Dread.note('run',2);const blocked=!Dread.allow(2);DREAD.t+=130;const again=Dread.allow(2);
          return {early,count:ev.length,minMild,minStrong,blocked,again};
        }""")
        self.assertEqual(result['early'], 0)
        self.assertGreaterEqual(result['count'], 8)
        self.assertGreaterEqual(result['minMild'], 24)
        self.assertGreaterEqual(result['minStrong'], 120)
        self.assertTrue(result['blocked'])
        self.assertTrue(result['again'])

    def test_no_ambient_scares_while_something_else_is_happening(self):
        page = self.page()
        self.room(page)
        result = page.evaluate("""() => {
          DREAD.t=200;DREAD.nextAmb=0;
          const states=[()=>{AN.active=true},()=>{UI.chooseOpen=true},()=>{PAT.state='walk'},()=>{LESSON.on=true}];
          const fired=[];
          states.forEach((set,i)=>{const before=DREAD.log.length;set();for(let j=0;j<400;j++)Dread.tick(0.25);
            fired.push(DREAD.log.filter((e,k)=>k>=before&&e.strength>=1).length);
            AN.active=false;UI.chooseOpen=false;PAT.state='idle';LESSON.on=false;DREAD.nextAmb=0;});
          return fired;
        }""")
        self.assertEqual(result, [0, 0, 0, 0])

    def test_false_threats_have_direction_distance_and_walls(self):
        page = self.page()
        self.room(page)
        result = page.evaluate("""() => {
          S.ang=0;
          const right=dreadPlace(S.x+Math.cos(Math.PI/2)*40,S.y+Math.sin(Math.PI/2)*40);
          const left=dreadPlace(S.x+Math.cos(-Math.PI/2)*40,S.y+Math.sin(-Math.PI/2)*40);
          const behind=dreadPlace(S.x-60,S.y);
          const near=dreadPlace(S.x+20,S.y), far=dreadPlace(S.x+200,S.y);
          // 找一面墙：墙后面的点应该是发闷的
          const R=INTERIORS.teach1;let wall=null;
          for(let r=0;r<R.rows&&!wall;r++)for(let c=0;c<R.cols&&!wall;c++){
            if(R.grid[r][c]!=='#')continue;const x=R.ox+(c+0.5)*R.tw,y=R.oy+(r+0.5)*R.th;
            if(Math.hypot(x-S.x,y-S.y)*U2M>3)wall={x,y};}
          const throughWall=wall?dreadPlace(wall.x,wall.y).muffled:null;
          let ok=0;for(let i=0;i<20;i++){DREAD.t=1000+i*200;if(Dread.falseThreat('knock',1))ok++;}
          return {right:right.pan>0.5,left:left.pan<-0.5,behind:behind.behind,louder:near.k>far.k,throughWall,ok};
        }""")
        self.assertEqual(result, {'right': True, 'left': True, 'behind': True, 'louder': True,
                                  'throughWall': True, 'ok': 20})

    def test_silence_drop_and_anomaly_precursor(self):
        page = self.page()
        self.room(page)
        result = page.evaluate("""() => {
          SFX.ambient();SFX.duck(3);const ducking=SFX.ducking();
          DREAD.t=300;AN.active=false;AN.next=2.5;AN.next0=77;const before=DREAD.log.length;
          Dread.tick(0.1);Dread.tick(0.1);Dread.tick(0.1);
          const pre=DREAD.log.slice(before).filter(e=>e.kind==='precursor').length;
          AN.next0=78;Dread.tick(0.1);
          const pre2=DREAD.log.slice(before).filter(e=>e.kind==='precursor').length;
          return {ducking,pre,pre2};
        }""")
        self.assertEqual(result, {'ducking': True, 'pre': 1, 'pre2': 2})

    def test_returning_to_a_room_changes_it_slightly_and_reproducibly(self):
        page = self.page()
        result = page.evaluate("""() => {
          S.day=3;RT.visits={};
          doEnterRoom('teach1');const first=DREAD.visitFx;
          doExitRoom();doEnterRoom('teach1');const second=JSON.stringify(DREAD.visitFx);
          // 同一天、同一间、同样的第几次：读档后复现同一种变化
          RT.visits={'3:teach1':1};doExitRoom();RT.visits={'3:teach1':1};doEnterRoom('teach1');const again=JSON.stringify(DREAD.visitFx);
          // 坏灯：只影响选中的那一盏（要在屋里，屋里才有灯）
          DreadFx.lamp(0);const dead=GLR.roomLights.length>1&&dreadLampMul(0,0.5)<0.2&&dreadLampMul(1,0.5)===1;
          // 纸条：放在地上、能读到字，出门就收走（坏灯也一起恢复）
          DreadFx.note('你昨天也来过。',0.4);const placed=!!DREADFX.note&&GLR.scene.children.includes(DREADFX.note);
          const y=DREADFX.note.children[0].position.y;
          doExitRoom();const cleared=!DREADFX.note&&DREADFX.lamp===-1;
          return {first,second:JSON.parse(second).visit,same:second===again,placed,low:y<0.05,cleared,dead,saved:RT.visits['3:teach1']};
        }""")
        self.assertIsNone(result['first'])
        self.assertEqual(result['second'], 2)
        self.assertTrue(result['same'])
        self.assertTrue(result['placed'] and result['low'] and result['cleared'] and result['dead'])
        self.assertEqual(result['saved'], 2)

    def test_five_minute_slice_runs_its_beats_in_order(self):
        page = self.page()
        self.room(page)
        result = page.evaluate("""() => {
          DreadSlice.start(0.8);for(let i=0;i<1220;i++)Dread.tick(0.25);
          const beats=DREAD.log.filter(e=>e.kind.startsWith('slice:')).map(e=>[e.kind.slice(6),Math.round(e.t)]);
          const kinds=DREAD.log.map(e=>e.kind);
          return {beats,active:!!DREAD.slice,heard:['radio','steps','door'].every(k=>kinds.includes(k)),
                  paid:kinds.includes('pay:nothing'),trace:kinds.includes('trace'),dead:S.dead};
        }""")
        self.assertEqual(result['beats'], [['quiet', 0], ['listen', 60], ['risk', 120], ['pay', 195], ['rest', 255], ['end', 300]])
        self.assertFalse(result['active'])
        self.assertTrue(result['heard'] and result['paid'] and result['trace'])
        self.assertFalse(result['dead'])
