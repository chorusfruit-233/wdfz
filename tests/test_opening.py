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

    def test_camera_keeps_clear_of_walls_people_and_desks(self):
        """R2 开局 CG 重修：第三人称那几段（0–0.76）逐帧抽查机位——不在墙里、不低于 1.1 米、离同学的头和课桌有余量；
        第二段老师、第四段「你」都在画面里。"""
        page = self.begin(first=True)
        r = page.evaluate("""() => {running=false;const R=INTERIORS.teach1,bad=[],v=new THREE.Vector3();
          function grid(x,z){return {c:x/(R.tw*U2M)+R.cols/2,r:z/(R.th*U2M)+R.rows/2};}
          const heads=(NC.list||[]).filter(o=>!(o.userData&&o.userData.teacher)).map(o=>o.position.clone());
          function inFrame(p){v.copy(p).project(GLR.cam);return v.z<1&&Math.abs(v.x)<0.85&&Math.abs(v.y)<0.85;}
          const frames={teacher:[],me:[]};
          for(let k=0.0;k<=0.755;k+=0.01){
            CUT.t=CUT.dur*k;render(0.0001);GLR.cam.updateMatrixWorld();const c=GLR.cam.position,g=grid(c.x,c.z);
            const ch=R.grid[Math.floor(g.r)]&&R.grid[Math.floor(g.r)][Math.floor(g.c)];
            if(ch==='#')bad.push(['wall',k]);
            if(c.y<1.1)bad.push(['low',k,c.y]);
            for(const h of heads){if(Math.hypot(h.x-c.x,h.z-c.z)<0.45&&c.y<1.75)bad.push(['person',k]);}
            const F=R.foot[Math.floor(g.c)+','+Math.floor(g.r)];
            if(F&&c.y<1.3){const lx=c.x,lz=c.z;if(F.some(b=>lx>b.x0-0.1&&lx<b.x1+0.1&&lz>b.z0-0.1&&lz<b.z1+0.1))bad.push(['desk',k]);}
            if(k>0.25&&k<0.41)frames.teacher.push(inFrame(CUT.data.teacher.position.clone().add(new THREE.Vector3(0,1.5,0))));
            if(k>0.59&&k<0.72)frames.me.push(inFrame(CUT.data.me.position.clone().add(new THREE.Vector3(-0.15,0.95,0))));
          }
          cutSkip();return {bad:bad.slice(0,6),teacher:frames.teacher.every(Boolean),me:frames.me.every(Boolean),n:[frames.teacher.length,frames.me.length]};
        }""")
        self.assertEqual(r['bad'], [])
        self.assertTrue(r['teacher'], r)
        self.assertTrue(r['me'], r)

    def test_dust_sits_in_the_window_light_and_classmates_freeze_when_time_stops(self):
        """粉笔灰都在自己班教室里、离墙有余量（三扇北窗的光里和黑板前）；同学一、二段在动，第三段时间停住时定格，演完还原。"""
        page = self.begin(first=True)
        r = page.evaluate("""() => {running=false;const R=INTERIORS.teach1,L=ClassroomLayout,s=L.spans[L.ownSeat.classId];
          CUT.t=0;render(0.0001);const a=CUT.data.dustPts.geometry.attributes.position.array,out=[];
          for(let i=0;i<a.length;i+=3){const c=a[i]/(R.tw*U2M)+R.cols/2,r=a[i+2]/(R.th*U2M)+R.rows/2,y=a[i+1];
            if(c<s[0]+0.2||c>s[1]+1-0.2||r<L.rows[0]+0.2||r>L.rows[1]+1-0.2||y<0.8||y>2.6)out.push([c,r,y]);}
          const map=CUT.data.dustPts.material.map;
          const m=CUT.data.mates.find(x=>x.kind==='write');
          function rx(k){CUT.t=CUT.dur*k;render(0.0001);return m.o.rotation.x;}
          const moving=Math.abs(rx(0.10)-rx(0.13))>1e-4||Math.abs(rx(0.20)-rx(0.27))>1e-4, frozen=Math.abs(rx(0.48)-rx(0.56))<1e-9, rest=rx(0.74)===0;
          cutSkip();
          return {outside:out.length,count:a.length/3,round:!!map,moving,frozen,rest,back:m.o.rotation.order,x:m.o.rotation.x};
        }""")
        self.assertEqual(r['outside'], 0, r)
        self.assertGreater(r['count'], 80)
        self.assertTrue(r['round'])                 # 圆点贴图，不是方块
        self.assertTrue(r['moving'] and r['frozen'] and r['rest'], r)
        self.assertEqual(r['back'], 'XYZ'); self.assertEqual(r['x'], 0)

    def test_handoff_keeps_the_seated_eye_height(self):
        """交接以后下一帧视线就在坐姿眼高 1.12 米：以前从站姿 1.65 平滑降下来，交接后会往下沉一下。"""
        page = self.begin(first=True)
        r = page.evaluate("""() => {running=false;CUT.t=CUT.dur*0.97;render(0.0001);const last=GLR.cam.position.y;
          CUT.t=CUT.dur;render(0.0001);syncCamera(1/60);const first=GLR.cam.position.y;syncCamera(1/60);syncCamera(1/60);
          return {last,first,later:GLR.cam.position.y,seated:S.seated};}""")
        self.assertTrue(r['seated'])
        self.assertAlmostEqual(r['last'], 1.12, delta=0.01)
        self.assertAlmostEqual(r['first'], 1.12, delta=0.02)
        self.assertAlmostEqual(r['later'], 1.12, delta=0.02)

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
