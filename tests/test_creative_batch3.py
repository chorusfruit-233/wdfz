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
