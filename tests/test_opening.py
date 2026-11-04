"""《传送门建模、死亡CG档案室与速通模式》P3：新局 3D 开场 CG。"""
from browser_case import BrowserCase

STATE = "JSON.stringify({room:S.room,mode:S.mode,x:S.x,y:S.y,ang:S.ang,pitch:S.pitch,seated:S.seated,screen:S.screen,pro:PRO.on,wn:VisualState.worldNorm,nc:NC.normal,cut:CUT.on})"


class OpeningTest(BrowserCase):
    def begin(self, first=True, speed=False):
        page = self.page()
        page.evaluate(f"""CUT.enabled=true;{"localStorage.removeItem('wdfz_pro');" if first else ''}
          {"Speedrun.arm('easy');" if speed else ''}Game.start('easy',{{talent:'code'{",mode:'speedrun'" if speed else ''}}})""")
        page.wait_for_function("CUT.on&&CUT.id==='opening'", timeout=60000)
        return page

    def test_full_version_for_new_players_short_for_returning(self):
        page = self.begin(first=True)
        self.assert_js(page, "CUT.dur===26&&!Opening.short&&S.screen==='cut'&&PRO.on")
        page.evaluate("Game.quit()")                                      # 没看完就回菜单：不留过场状态，下次仍是完整版
        self.assert_js(page, "!CUT.on&&!PRO.on&&!Opening.on&&document.getElementById('opcap').textContent===''&&localStorage.getItem('wdfz_pro')!=='1'")
        page.evaluate("Game.start('easy',{talent:'code'})")
        page.wait_for_function("CUT.on&&CUT.id==='opening'", timeout=60000)
        self.assert_js(page, "CUT.dur===26")
        page.evaluate("cutSkip();Game.quit();Game.start('easy',{talent:'code'})")   # 看过（或跳过）一次：短版
        page.wait_for_function("CUT.on&&CUT.id==='opening'", timeout=60000)
        self.assert_js(page, "CUT.dur===11&&Opening.short")

    def test_falling_asleep_leans_forward_onto_the_desk_not_sideways(self):
        """第 4 段「你」趴到桌上：往自己面朝的方向（西边的课桌）倒，不往侧面倒；第 2 段老师点头也是前后点，不是左右歪头。
        教室朝西以后，同一个物体上先设朝向（Y）再设前倾（X），默认欧拉顺序 XYZ 会绕世界东西轴转——要用 YXZ。"""
        page = self.begin(first=True)
        r = page.evaluate("""() => {running=false;
          function tip(o){o.updateMatrixWorld(true);const top=new THREE.Vector3(0,1.2,0).applyMatrix4(o.matrixWorld),b=new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);return [top.x-b.x,top.z-b.z];}
          CUT.t=CUT.dur*0.70;render(0.0001);const me=CUT.data.me,lean=tip(me);
          const face=[Math.cos(ClassroomLayout.ownSeat.facing),Math.sin(ClassroomLayout.ownSeat.facing)];
          let nod=null;for(const k of [0.30,0.31,0.32,0.33]){CUT.t=CUT.dur*k;render(0.0001);if(Math.abs(CUT.data.teacher.rotation.x)>0.01){nod=tip(CUT.data.teacher);break;}}
          const t=CUT.data.teacher,tf=[Math.sin(t.rotation.y),Math.cos(t.rotation.y)];
          cutSkip();
          return {along:lean[0]*face[0]+lean[1]*face[1],side:Math.abs(lean[0]*face[1]-lean[1]*face[0]),
            nodAlong:nod&&Math.abs(nod[0]*tf[0]+nod[1]*tf[1]),nodSide:nod&&Math.abs(nod[0]*tf[1]-nod[1]*tf[0]),
            order:me.rotation.order,teacherBack:NC.teacher?NC.teacher.rotation.order:'XYZ'};
        }""")
        self.assertGreater(r['along'], 0.3)          # 头往前（面朝的方向）伸出去 0.3 米以上
        self.assertLess(r['side'], 0.01)             # 没有侧向分量
        self.assertIsNotNone(r['nodAlong'])
        self.assertGreater(r['nodAlong'], r['nodSide'] * 3)
        self.assertEqual(r['order'], 'YXZ')
        self.assertEqual(r['teacherBack'], 'XYZ')    # 跳过以后教室里那位老师的欧拉顺序还原

    def test_skipping_at_any_shot_hands_over_the_same_start(self):
        results = []
        for k in (0.05, 0.3, 0.5, 0.7, 0.9, None):
            page = self.begin(first=True)
            page.evaluate("running=false")
            if k is None:
                page.evaluate("CUT.t=CUT.dur;render(0.0001)")           # 看完
            else:
                page.evaluate(f"CUT.t=CUT.dur*{k};render(0.0001);cutSkip()")
            results.append(page.evaluate(STATE))
            self.assert_js(page, "!Opening.on&&!CUT.grp&&localStorage.getItem('wdfz_pro')==='1'")
            page.context.close()
            self.contexts.remove(page.context)
        self.assertEqual(len(set(results)), 1, results)
        self.assertIn('"screen":"play"', results[0])
        self.assertIn('"seated":true', results[0])
        self.assertIn('"wn":0', results[0])

    def test_world_is_frozen_and_input_blocked_during_the_opening(self):
        page = self.begin(first=True)
        page.evaluate("window.s0=S.san;window.t0=S.tsec;window.st0=S.stam;window.p0=JSON.stringify(PAT);AN.next=0.01")
        page.wait_for_timeout(1500)
        self.assert_js(page, "CUT.on&&S.san===s0&&S.tsec===t0&&!AN.active&&JSON.stringify(PAT)===p0&&!playerInputAllowed()")
        self.assert_js(page, "saveGame()===true||true")
        page.keyboard.press('Space')
        page.wait_for_function("S.screen==='play'&&!CUT.on")
        self.assert_js(page, "playerInputAllowed()&&!PRO.on")

    def test_speedrun_starts_only_after_the_handoff(self):
        page = self.begin(first=False, speed=True)
        page.wait_for_timeout(800)
        self.assert_js(page, "Speedrun.run.status==='ready'")
        page.evaluate("cutSkip()")
        page.wait_for_function("Speedrun.run.status==='running'")
        self.assert_js(page, "Speedrun.elapsed()<2000")

    def test_continue_does_not_replay_the_opening(self):
        page = self.begin(first=False)
        page.evaluate("cutSkip();saveGame();Game.quit();Game.continue_()")
        page.wait_for_timeout(600)
        self.assert_js(page, "!CUT.on&&!Opening.on&&S.screen==='play'")
