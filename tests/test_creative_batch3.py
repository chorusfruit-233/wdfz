"""《校园怪谈创意提案》第三批：C10 午夜食堂（C9 体检日、C11 手机相机另见各自用例）。"""
from browser_case import BrowserCase


class CreativeBatch3Test(BrowserCase):
    def game(self, diff='hard'):
        page = self.page()
        page.evaluate("Game.start('%s',{talent:'watch'})" % diff)
        page.wait_for_function("S.room==='teach1'&&GLR.roomMesh&&GLR.roomMesh.userData.roomData===INTERIORS.teach1")
        page.evaluate("clearIntroTimers();running=false;S.intro=0;S.day=2;S.tsec=900;AN.active=false;AN.next=1e6;PAT.next=1e6;patReset();DEV.god=false;S.seated=false;true;")
        return page

    def at_counter(self, page, tsec):
        page.evaluate("""(t)=>{S.tsec=t;doEnterRoom('canteen1');const R=INTERIORS.canteen1;S.x=R.ox+5.5*R.tw;S.y=R.oy+8.6*R.th;S.ang=-Math.PI/2;true;}""", tsec)
        page.wait_for_function("GLR.roomMesh&&GLR.roomMesh.userData.roomData===INTERIORS.canteen1")

    def test_midnight_canteen_is_only_open_after_lights_out_and_costs_assimilation(self):
        page = self.game()
        self.at_counter(page, 900)
        r = page.evaluate("()=>({hint:interactHint(),near:MidnightCanteen.near()})")
        self.assertFalse(r['near'])                           # 白天：还是平常的打饭台
        self.assertNotIn('亮着的窗口', r['hint'])
        self.at_counter(page, 1345)
        r = page.evaluate("""()=>{const out={};S.san=20;S.tt=10;S.ttTier=0;RT.midnightMeal=null;out.hint=interactHint();
          let rest=0;const off=GameModules.on('gameFact',f=>{if(f&&f.kind==='rest')rest++;},{owner:'test'});
          tryInteract();out.prompt=document.getElementById('choices')?document.getElementById('choices').innerText:'';
          const btn=[...document.querySelectorAll('#choices button')].find(b=>b.textContent.indexOf('吃一碗')>=0);btn.click();
          out.san=S.san;out.tt=S.tt;out.rest=rest;out.sub=document.getElementById('sub').innerText;out.meal=JSON.parse(JSON.stringify(RT.midnightMeal));
          // 到天亮前同化不回落：在食堂里站着（不在座位、不在宿舍）跑一会儿
          S.screen='play';const tt0=S.tt;for(let i=0;i<20;i++)updateSystems(.5,true);out.ttHold=S.tt>=tt0;
          // 同一晚再来：明天再来
          out.again=interactHint();tryInteract();out.sub2=document.getElementById('sub').innerText;
          return out;}""")
        self.assertEqual(r['hint'], '亮着的窗口')
        self.assertIn('香得不对', r['prompt'])
        self.assertEqual(r['san'], 60)                        # SAN 回 40
        self.assertAlmostEqual(r['tt'], 35, delta=0.01)       # 同化 +25
        self.assertEqual(r['rest'], 0)                        # 不计入恢复活动
        self.assertIn('明天早上不用闹钟', r['sub'])
        self.assertTrue(r['ttHold'])
        self.assertIn('明天再来', r['again'])
        self.assertIn('明天再来', r['sub2'])
        # 过了 22:30 换日也是同一晚；天亮以后同化恢复回落，下一晚能再吃
        r = page.evaluate("""()=>{const n=MidnightCanteen.night();advanceGameTime(30);const same=MidnightCanteen.night()===n&&MidnightCanteen.ate();
          advanceGameTime(200);const morning={tsec:S.tsec,full:MidnightCanteen.full(),open:MidnightCanteen.open()};
          S.tt=50;S.seated=false;for(let i=0;i<5;i++)updateSystems(.5,true);const decays=S.tt<50;
          S.tsec=1345;const next=!MidnightCanteen.ate();return {same,morning,decays,next};}""")
        self.assertTrue(r['same'])
        self.assertTrue(440 <= r['morning']['tsec'] < 600)        # 01:00 跳到 07:20，已经是早上
        self.assertEqual((r['morning']['full'], r['morning']['open']), (False, False))
        self.assertTrue(r['decays'])
        self.assertTrue(r['next'])

    def test_midnight_canteen_cannot_push_you_into_full_assimilation_and_is_open_on_easy(self):
        page = self.game('easy')
        self.at_counter(page, 1360)
        r = page.evaluate("""()=>{S.tt=88;RT.midnightMeal=null;tryInteract();[...document.querySelectorAll('#choices button')][0].click();
          return {tt:S.tt,dead:S.dead,ach:Achievements.has?Achievements.has('n.midnight'):null};}""")
        self.assertLessEqual(r['tt'], 95)
        self.assertFalse(r['dead'])

    def test_midnight_canteen_presentation_is_read_only_and_server_faces_away(self):
        page = self.game()
        self.at_counter(page, 1345)
        r = page.evaluate("""()=>{RT.midnightMeal=null;const before=JSON.stringify([S,RT,PAT]);render(.05);
          const F=MidnightCanteen.F,R=INTERIORS.canteen1,me=worldToScene(S.x,S.y,R),p=F.fig.position;
          const face=[Math.sin(F.fig.rotation.y),Math.cos(F.fig.rotation.y)],to=[me.x-p.x,me.z-p.z];
          const dot=face[0]*to[0]+face[1]*to[1];
          return {grp:!!F.grp,bowl:F.bowl.visible,away:dot<0,same:JSON.stringify([S,RT,PAT])===before};}""")
        self.assertTrue(r['grp'])
        self.assertTrue(r['bowl'])
        self.assertTrue(r['away'])                            # 背对着你
        self.assertTrue(r['same'])
        r = page.evaluate("()=>{S.tsec=900;render(.05);return !!MidnightCanteen.F.grp;}")
        self.assertFalse(r)                                   # 白天不画


class CheckupDayTest(BrowserCase):
    """C9 体检日：特殊日调度、医务室体检、缺席处罚、排队的人有碰撞。"""
    def game(self):
        page = self.page()
        page.evaluate("Game.start('hard',{talent:'watch'})")
        page.wait_for_function("S.room==='teach1'&&GLR.roomMesh&&GLR.roomMesh.userData.roomData===INTERIORS.teach1")
        page.evaluate("clearIntroTimers();running=false;S.intro=0;S.day=3;S.tsec=560;AN.active=false;AN.next=1e6;PAT.next=1e6;patReset();DEV.god=false;S.seated=false;S.screen='play';RT.dayEvents={3:'checkup'};RT.daySaid={3:1};true;")
        return page

    def test_checkup_day_is_rolled_after_the_old_kinds_and_never_on_day_two(self):
        page = self.page()
        r = page.evaluate("""()=>{const roll=(p)=>{DAY_EVENT_CFG.p=p;const out=[];for(const seed of [1,7,12345,99,2024,31337]){RT.runSeed=seed;RT.dayEvents={};
            const a=[];for(let d=1;d<=30;d++){S.day=d;a.push(DayEvents.ensure());}out.push(a);}return out;};
          const base=Object.assign({},window.__dayP), with_=roll(base), without=roll(Object.assign({},base,{checkup:0}));
          const same=with_.every((a,i)=>a.every((x,d)=>x==='checkup'?without[i][d]==='none':x===without[i][d]));
          const once=with_.every(a=>a.filter(x=>x==='checkup').length<=1), early=with_.some(a=>a[0]==='checkup'||a[1]==='checkup');
          const any=with_.some(a=>a.indexOf('checkup')>=0);DAY_EVENT_CFG.p={anniversary:0,occupied:0};return {same,once,early,any};}""")
        self.assertEqual(r, {'same': True, 'once': True, 'early': False, 'any': True})

    def test_going_to_the_checkup_gives_the_wrong_form_and_the_chart_line(self):
        page = self.game()
        r = page.evaluate("""()=>{const out={};S.tsec=605;GameModules.emit('tick',.1);out.warn=document.getElementById('sub').innerText;updateHUD();out.p1=document.getElementById('period').textContent;
          doEnterRoom('admin1');const R=INTERIORS.admin1,C=CheckupDay.CFG;S.tsec=625;GameModules.emit('tick',.1);updateHUD();out.p2=document.getElementById('period').textContent;
          // 排队的人挡路
          const q=C.queue[2],qx=R.ox+q[0]*R.tw,qy=R.oy+(q[1]+0.17)*R.th+PRAD*0.6;out.blocked=!canStand(qx,qy);S.tsec=700;out.freeAfter=canStand(qx,qy);S.tsec=625;
          S.x=R.ox+(C.ruler.c+0.6)*R.tw;S.y=R.oy+C.ruler.r*R.th;out.hint=interactHint();const v0=S.viol;tryInteract();out.form=document.getElementById('sub').innerText;out.done=CheckupDay.done();
          S.x=R.ox+(C.chart.c-1.2)*R.tw;S.y=R.oy+C.chart.r*R.th;out.chartHint=interactHint();tryInteract();out.chart=document.getElementById('sub').innerText;out.line=CheckupDay.line();
          S.tsec=670;GameModules.emit('tick',.1);out.viol=S.viol-v0;out.clues=Object.keys(Investigation.state?Investigation.state().notes||{}:{});return out;}""")
        self.assertIn('第三节课体检', r['warn'])
        self.assertEqual(r['p1'], '体检将至 · 行政楼一楼医务室')
        self.assertEqual(r['p2'], '体检 · 行政楼一楼医务室')
        self.assertTrue(r['blocked'])
        self.assertTrue(r['freeAfter'])
        self.assertEqual(r['hint'], '体检（量身高、称体重）')
        self.assertIn('身高：—', r['form'])
        self.assertIn('心率：0', r['form'])
        self.assertTrue(r['done'])
        self.assertEqual(r['chartHint'], '视力表')
        self.assertIn(r['line'], r['chart'])
        self.assertLessEqual(r['viol'], 0)                    # 去过了：时段结束不罚

    def test_missing_the_checkup_costs_like_missing_an_inspection_unless_on_leave(self):
        page = self.game()
        r = page.evaluate("""()=>{S.tsec=630;S.viol=0;S.san=80;GameModules.emit('tick',.1);const mid={viol:S.viol,san:S.san};
          S.tsec=666;GameModules.emit('tick',.1);const miss={viol:S.viol,san:S.san};GameModules.emit('tick',.1);const twice={viol:S.viol};
          return {mid,miss,twice};}""")
        self.assertEqual(r['mid'], {'viol': 0, 'san': 80})
        self.assertEqual(r['miss'], {'viol': 10, 'san': 72})
        self.assertEqual(r['twice'], {'viol': 10})
        r = page.evaluate("""()=>{RT.checkup=null;S.day=4;RT.dayEvents[4]='checkup';S.tsec=666;S.viol=0;S.san=80;S.leaveUntil=1e9;RT.leaveUntil=gameClock()+60;
          const on=onLeave();GameModules.emit('tick',.1);return {on,viol:S.viol,san:S.san};}""")
        if r['on']:
            self.assertEqual((r['viol'], r['san']), (0, 80))

    def test_checkup_presentation_is_read_only_and_queue_only_in_the_window(self):
        page = self.game()
        page.evaluate("doEnterRoom('admin1');true;")
        page.wait_for_function("GLR.roomMesh&&GLR.roomMesh.userData.roomData===INTERIORS.admin1")
        r = page.evaluate("""()=>{S.tsec=625;const before=JSON.stringify([S,RT,PAT]);render(.05);const a={grp:!!CheckupDay.F.grp,q:CheckupDay.F.queue.visible};
          S.tsec=700;render(.05);a.qAfter=CheckupDay.F.queue.visible;S.tsec=625;a.same=JSON.stringify([S,RT,PAT])===before;
          RT.dayEvents[3]='none';render(.05);a.goneOtherDay=!CheckupDay.F.grp;return a;}""")
        self.assertEqual(r, {'grp': True, 'q': True, 'qAfter': False, 'same': True, 'goneOtherDay': True})


class CreativeBatch3PropsTest(BrowserCase):
    """C9／C10 新加的模型（身高尺、体重秤、视力表、门边的纸、排队的人、打饭的人和碗）不伸进墙和家具。"""
    def test_new_props_stay_out_of_walls_and_furniture(self):
        page = self.page()
        page.evaluate("Game.start('hard',{talent:'watch'})")
        page.wait_for_function("S.room==='teach1'&&GLR.roomMesh")
        page.evaluate("clearIntroTimers();running=false;S.intro=0;S.day=3;S.tsec=625;AN.active=false;AN.next=1e6;PAT.next=1e6;patReset();S.seated=false;S.screen='play';RT.dayEvents={3:'checkup'};RT.daySaid={3:1};true;")
        check = """(grp)=>{const R=INTERIORS[S.room],bad=[];const meshes=[];grp.traverse(o=>{if(o.isMesh&&o.visible)meshes.push(o);});
          meshes.forEach(m=>{const b=new THREE.Box3().setFromObject(m),e=0.03;
            for(let x=b.min.x+e;x<=b.max.x-e+1e-9;x+=Math.max(0.05,(b.max.x-b.min.x-2*e)/4))for(let z=b.min.z+e;z<=b.max.z-e+1e-9;z+=Math.max(0.05,(b.max.z-b.min.z-2*e)/4)){
              const c=Math.floor(x+R.cols*0.5),r=Math.floor(z+R.rows*0.5),ch=(R.grid[r]||[])[c];
              if(ch===undefined||isSolidCh(ch)||(FURN_SOLID[ch]&&!(m.parent&&m.parent.name==='midnight-canteen'&&ch==='k')))bad.push([m.parent&&m.parent.name,ch,c,r]);}});
          return {n:meshes.length,bad:bad.slice(0,6)};}"""
        page.evaluate("doEnterRoom('admin1');true;")
        page.wait_for_function("GLR.roomMesh&&GLR.roomMesh.userData.roomData===INTERIORS.admin1")
        r = page.evaluate("()=>{render(.05);return (" + check + ")(CheckupDay.F.grp);}")
        self.assertGreater(r['n'], 20)
        self.assertEqual(r['bad'], [])
        page.evaluate("S.tsec=1345;doEnterRoom('canteen1');true;")
        page.wait_for_function("GLR.roomMesh&&GLR.roomMesh.userData.roomData===INTERIORS.canteen1")
        r = page.evaluate("()=>{render(.05);const g=MidnightCanteen.F.grp;const sub=new THREE.Group();[MidnightCanteen.F.fig].forEach(o=>sub.add(o.clone()));sub.name='x';return (" + check + ")(sub);}")
        self.assertEqual(r['bad'], [])
