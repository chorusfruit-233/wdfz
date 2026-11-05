"""《校园怪谈创意提案》第二批：C4 值日表上的名字、C3 巡察日志残页、C5 镜中慢半拍（C6 由广播站模块实现，见 test_broadcast）。"""
from browser_case import BrowserCase


class CreativeBatch2Test(BrowserCase):
    def game(self):
        page = self.page()
        page.evaluate("Game.start('hard',{talent:'watch'})")
        page.wait_for_function("S.room==='teach1'&&GLR.roomMesh&&GLR.roomMesh.userData.roomData===INTERIORS.teach1")
        page.evaluate("clearIntroTimers();running=false;S.intro=0;S.day=2;S.tsec=900;AN.active=false;AN.next=1e6;PAT.next=1e6;patReset();DEV.god=false;S.seated=false;true;")
        return page

    def test_duty_roster_follows_assimilation_tiers(self):
        page = self.game()
        r = page.evaluate("""()=>{const maps=[];for(const tt of [0,25,45,65,90,10]){S.tt=tt;render(.05);maps.push(DutyRoster.F.list.map(e=>e.face.map&&e.face.map.uuid).join(','));}
          return {n:DutyRoster.F.list.length,maps,tiers:[0,25,45,65,90].map(v=>{S.tt=v;return DutyRoster.tier();})};}""")
        self.assertGreaterEqual(r['n'], 4)                    # 一层四间教室，每间一张
        self.assertEqual(r['tiers'], [0, 1, 2, 3, 4])
        self.assertEqual(len(set(r['maps'][:5])), 5)          # 每一档一张不同的表
        self.assertEqual(r['maps'][5], r['maps'][0])          # 回落到 0 档，换回原来的表

    def test_patrol_note_is_a_real_slice_of_the_route_and_fixed_per_run(self):
        page = self.game()
        r = page.evaluate("""()=>{const seq=PatrolNotes.rooms(),n=seq.length,ok=[0,1].map(i=>{const s=PatrolNotes.segment(i);
            for(let a=0;a<n;a++){if(s.every((x,k)=>seq[(a+k)%n]===x))return true;}return false;});
          const t0=PatrolNotes.text(0);doEnterRoom('guard1');const R=INTERIORS.guard1;S.x=R.ox+4.5*R.tw;S.y=R.oy+2.5*R.th;
          const hint=interactHint();tryInteract();const sub=document.getElementById('sub').innerText;
          autoSave();const sv=loadGame();freshState('hard');running=false;applySave(sv);
          return {ok,again:PatrolNotes.text(0)===t0,hint,sub,got:RT.patrolNotes,len:PatrolNotes.segment(0).length};}""")
        self.assertEqual(r['ok'], [True, True])
        self.assertTrue(r['again'])
        self.assertEqual(r['hint'], '撕下来的一页纸')
        self.assertIn('若有事，另行处置', r['sub'])
        self.assertIn('未离校', r['sub'])
        self.assertEqual(r['got'], {'guard': 1})
        self.assertEqual(r['len'], 6)

    def test_mirror_lags_by_tier_and_only_kills_after_it_moves_first_and_you_keep_looking(self):
        page = self.game()
        r = page.evaluate("""()=>{const out={};for(let f=1;f<=5;f++){const sp=MirrorLag.spots(INTERIORS['teach'+f]);if(sp.length){out.room='teach'+f;out.n=sp.length;break;}}return out;}""")
        self.assertIn('room', r)
        room = r['room']
        page.evaluate(f"doEnterRoom('{room}');true;")
        page.wait_for_function(f"GLR.roomMesh&&GLR.roomMesh.userData.roomData===INTERIORS['{room}']")
        r = page.evaluate("""()=>{const R=INTERIORS[S.room],m=MirrorLag.spots(R)[0];
          S.x=m.wx+m.nx*1.2/U2M;S.y=m.wy+m.nz*1.2/U2M;S.ang=Math.atan2(-m.nz,-m.nx);S.floorY=0;
          const out={tiers:[90,55,30,10].map(v=>{S.san=v;return MirrorLag.tier();})};
          S.san=90;for(let i=0;i<60;i++){update(1/30);render(1/30);}out.highRaise=MirrorLag.F.raise;out.deadHigh=S.dead;
          S.san=10;for(let i=0;i<45;i++){update(1/30);render(1/30);}out.raise=MirrorLag.F.raise;out.deadSoon=S.dead;
          S.ang+=Math.PI;for(let i=0;i<30;i++){update(1/30);render(1/30);}out.lookAway=S.dead;out.figFacing=MirrorLag.F.active&&MirrorLag.F.active.fig.rotation.y;
          S.ang-=Math.PI;for(let i=0;i<180;i++){update(1/30);if(S.dead)break;}out.dead=S.dead;out.death=S.death;
          out.arc=!!DeathArchive.state().unlocked.mirror;return out;}""")
        self.assertEqual(r['tiers'], [0, 1, 2, 3])
        self.assertEqual(r['highRaise'], 0)
        self.assertFalse(r['deadHigh'])
        self.assertGreater(r['raise'], 0.9)                  # 第四档：它先抬起手
        self.assertFalse(r['deadSoon'])
        self.assertFalse(r['lookAway'])                      # 转身走开就不会死
        self.assertEqual(r['figFacing'], 0)                  # 它还面向你
        self.assertTrue(r['dead'])
        self.assertEqual(r['death'], 'mirror')
        self.assertTrue(r['arc'])
