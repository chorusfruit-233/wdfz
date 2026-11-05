"""全局氛围 A1–A7（计划《电梯直通、新天赋、新结局与恐怖氛围》第 7 节）：只是氛围，不改判定；按天、按房间定，读档复现。"""
from browser_case import BrowserCase

HELP = """
window.inCls=(room,k)=>{const R=INTERIORS[room];let door=-1;for(let y=0;y<R.rows;y++)if(R.grid[y].indexOf('=')>=0){door=y;break;}
  for(let c=1;c<R.cols;c++)for(let r=1;r<door;r++){if(R.grid[r][c]==='.'&&Atmos.classAt(R,c,r)===room+':'+k){S.x=R.ox+(c+.5)*R.tw;S.y=R.oy+(r+.5)*R.th;const span=ClassroomLayout.spans[k];S.ang=Math.atan2(R.oy+11*R.th-S.y,R.ox+(span[0]+5)*R.tw-S.x);return true;}}return false;};
window.inCorr=(room,frac)=>{const R=INTERIORS[room];let door=-1;for(let y=0;y<R.rows;y++)if(R.grid[y].indexOf('=')>=0)door=y;
  const r=door+2,c=Math.floor(R.cols*frac);S.x=R.ox+(c+.5)*R.tw;S.y=R.oy+(r+.5)*R.th;};
window.step=(n,dt)=>{for(let i=0;i<n;i++){update(dt||.1);render(dt||.1);}};
true;
"""


class AtmosphereTest(BrowserCase):
    def game(self, day=2):
        page = self.page()
        page.evaluate("Game.start('hard',{talent:'watch'})")
        page.wait_for_function("S.room==='teach1'&&GLR.roomMesh")
        page.evaluate(f"""clearIntroTimers();running=false;S.intro=0;S.day={day};S.tsec=900;S.san=80;S.viol=0;AN.active=false;AN.id=null;
          AN.next=1e5;patReset();PAT.next=1e5;RT.inspection=null;Mechanics.runSeed=RT.runSeed='atmos-fixture-0';DREAD.t=300;S.screen='play';SET.soundCaptions=1;true;""" + HELP)
        return page

    def test_bells_detune_from_day_two_and_drag_before_lights_out(self):
        page = self.game(1)
        r = page.evaluate("""()=>{const out={};S.tsec=760;out.d1=Atmos.bellTune('end')||null;out.start=Atmos.bellTune('start')||null;
          S.day=2;out.d2=Atmos.bellTune('end');S.day=3;out.d3=Atmos.bellTune('end');S.day=2;S.tsec=1330;out.night=Atmos.bellTune('end');
          S.tsec=760;SoundCaptions.reset();SFX.schoolBell(1,'end');out.cap=SoundCaptions.events().map(e=>e.text);return out;}""")
        self.assertIsNone(r['d1'])
        self.assertIsNone(r['start'])
        self.assertAlmostEqual(r['d2']['tail'], 2 ** (-0.5 / 12), places=6)
        self.assertAlmostEqual(r['d3']['tail'], 2 ** (-1 / 12), places=6)
        self.assertAlmostEqual(r['night']['tail'], 2 ** (-2.1 / 12), places=6)
        self.assertIn('拖得很长', r['night']['caption'])
        self.assertEqual(r['cap'], ['下课铃，最后一个音低了一点'])

    def test_campus_noise_thins_out_and_the_hush_comes_before_some_anomalies(self):
        page = self.game(2)
        r = page.evaluate("""()=>{const out={kinds:[1,2,3,4].map(d=>{S.day=d;return Atmos.campusKinds();})};S.day=2;
          let v=0;for(;v<200;v++)if(Atmos.hash('hush:2:'+v)<.5)break;
          AN.next=5;AN.next0=v;SoundCaptions.reset();update(.05);
          out.cap=SoundCaptions.events().map(e=>e.text);out.log=DREAD.log.filter(e=>e.kind==='hush').length;out.hush=Atmos.A.hush>0;
          S.day=1;AN.next0=v+1000;Atmos.A.hushFor=null;update(.05);out.day1=DREAD.log.filter(e=>e.kind==='hush').length;
          return out;}""")
        self.assertEqual(r['kinds'], [['whistle', 'car', 'bird'], ['car', 'bird'], ['bird'], ['bird']])
        self.assertIn('周围突然安静了', r['cap'])
        self.assertEqual(r['log'], 1)
        self.assertTrue(r['hush'])
        self.assertEqual(r['day1'], 1)                       # 第一天不加

    def test_classmates_turn_together_once_per_room_per_day_and_never_on_day_one(self):
        page = self.game(2)
        page.evaluate("doEnterRoom('teach2');true;")
        page.wait_for_function("GLR.roomMesh&&GLR.roomMesh.userData.roomData===INTERIORS.teach2&&NC.list.length>0")
        r = page.evaluate("""()=>{let k=0;for(;k<4;k++)if(Atmos.hash('stare:2:teach2:'+k)<ATMOS_CFG.stareChance)break;
          const out={k};if(k>=4)return out;
          Atmos.state().shift['2:teach2']=0;                       // 别让同一层的物件错位先用掉惊吓预算
          inCorr('teach2',.5);step(2);inCls('teach2',k);step(1);
          out.started=!!Atmos.A.stare;out.cls=Atmos.A.stare&&Atmos.A.stare.cls;
          const figs=AtmosFx.F.stareFigs||[];
          const base=figs.map(f=>f.userData.stareBase);step(8,.1);
          out.turned=figs.length>0&&figs.some((f,i)=>Math.abs(f.rotation.y-base[i])>0.3);
          step(30,.1);out.back=figs.every((f,i)=>Math.abs(f.rotation.y-base[i])<1e-6);out.done=!Atmos.A.stare;
          inCorr('teach2',.5);step(2);inCls('teach2',k);step(2);out.again=!!Atmos.A.stare;
          out.saved=Atmos.state().stares['2:teach2:'+k];
          return out;}""")
        if r['k'] >= 4:
            self.fail('固定回归种子必须命中同学转头')
        self.assertTrue(r['started'])
        self.assertTrue(r['turned'])
        self.assertTrue(r['back'] and r['done'])
        self.assertFalse(r['again'])                          # 一间教室一天一次
        self.assertEqual(r['saved'], 1)
        r = page.evaluate("()=>{S.day=1;Atmos.A.lastCls=null;Atmos.state().stares={};inCorr('teach2',.5);step(2);inCls('teach2',0);step(1);return !!Atmos.A.stare;}")
        self.assertFalse(r)

    def test_dark_corridor_floors_have_exit_signs_and_dimmed_corridor_light(self):
        page = self.game(2)
        r = page.evaluate("""()=>{for(let f=1;f<=5;f++){if(AtmosFx.darkFloor(INTERIORS['teach'+f]))return 'teach'+f;}return null;}""")
        self.assertIsNotNone(r)
        page.evaluate(f"doEnterRoom('{r}');true;")
        page.wait_for_function(f"GLR.roomMesh&&GLR.roomMesh.userData.roomData===INTERIORS['{r}']")
        out = page.evaluate("""()=>{render(.1);render(.1);const d=ATMOS_DARK[S.room]||{};const idx=Object.keys(d).map(Number);
          return {n:idx.length,mul:idx.map(i=>atmosLampMul(i)),signs:AtmosFx.F.signs.length,other:atmosLampMul(0)};}""")
        self.assertGreater(out['n'], 0)
        self.assertTrue(all(abs(m - 0.35) < 1e-9 for m in out['mul']))
        self.assertGreater(out['signs'], 0)

    def test_props_shift_only_out_of_sight_and_reload_keeps_the_new_place(self):
        page = self.game(2)
        room = page.evaluate("()=>{for(let f=1;f<=5;f++)if(Atmos.hash('shift:2:teach'+f)<ATMOS_CFG.shiftChance)return 'teach'+f;return null;}")
        if not room:
            self.fail('固定回归种子必须命中物件错位')
        page.evaluate(f"doEnterRoom('{room}');true;")
        page.wait_for_function(f"GLR.roomMesh&&GLR.roomMesh.userData.roomData===INTERIORS['{room}']")
        r = page.evaluate("""()=>{render(.1);const g=AtmosFx.F.props,h={x:g.position.x,z:g.position.z};
          // 站在旁边看着它：不动
          const w=g.getWorldPosition(new THREE.Vector3());const R=INTERIORS[S.room];const half=R.cols*R.tw*U2M*.5,hz=R.rows*R.th*U2M*.5;
          S.x=R.ox+(w.x+2+half)/U2M;S.y=R.oy+(w.z+0.6+hz)/U2M;S.ang=Math.PI;step(3);const near=Atmos.state().shift['2:'+S.room];
          // 走到 12 米外、背对它
          S.x=R.ox+(w.x+12+half)/U2M;S.ang=0;step(3);
          const k=Atmos.state().shift['2:'+S.room];const moved=Math.hypot(g.position.x-h.x,g.position.z-h.z)>0.3||Math.abs(g.rotation.y)>0.1;
          autoSave();const saved=loadGame();freshState('hard');running=false;applySave(saved);
          return {near:near===undefined?null:near,k,moved,after:Atmos.state().shift['2:'+S.room]};}""")
        self.assertIsNone(r['near'])                          # 看着的时候不动
        self.assertIn(r['k'], ['push', 'face'])
        self.assertTrue(r['moved'])
        self.assertEqual(r['after'], r['k'])

    def test_dusk_comes_earlier_and_colder_from_day_two(self):
        page = self.game(1)
        r = page.evaluate("""()=>{S.tsec=16.75*60;const a=lightState();S.day=2;const b=lightState();S.day=3;const c=lightState();
          return {d1:a.day,d2:b.day,d3:c.day,amb1:a.amb,amb3:c.amb};}""")
        self.assertLess(r['d2'], r['d1'])
        self.assertLess(r['d3'], r['d2'])
        self.assertLess(r['amb3'], r['amb1'])

    def test_the_figure_outside_the_window_is_gone_after_a_second_look(self):
        page = self.game(2)
        page.evaluate("doEnterRoom('teach3');true;")
        page.wait_for_function("GLR.roomMesh&&GLR.roomMesh.userData.roomData===INTERIORS.teach3")
        r = page.evaluate("""()=>{inCls('teach3',1);Atmos.A.window={room:'teach3',cls:'teach3:1',seed:.5,seen:0,gone:false};render(.1);
          const f=AtmosFx.F.fig,R=INTERIORS.teach3,out={shown:!!f&&f.visible,behind:f&&f.position.z<0&&f.position.y>1};
          let best=0,bd=-2;S.pitch=0;for(let i=0;i<64;i++){S.ang=i/64*Math.PI*2;syncCamera(0);const d=new THREE.Vector3();GLR.cam.getWorldDirection(d);
            const c=GLR.cam.position,vx=f.position.x-c.x,vz=f.position.z-c.z,l=Math.hypot(vx,vz),dot=(vx*d.x+vz*d.z)/l;if(dot>bd){bd=dot;best=S.ang;}}
          S.ang=best;syncCamera(0);for(let i=0;i<12;i++){update(.1);render(.1);};out.still=f.visible;
          S.ang+=Math.PI;syncCamera(0);render(.1);update(.1);render(.1);out.after=f.visible;out.gone=Atmos.A.window.gone;return out;}""")
        self.assertTrue(r['shown'] and r['behind'])          # 在北墙的窗上
        self.assertTrue(r['still'])                           # 看着的时候还在
        self.assertFalse(r['after'])                          # 移开视线就不在了
        self.assertTrue(r['gone'])

    def test_detune_changes_only_last_note_and_keeps_piano_clue(self):
        page=self.game(2)
        r=page.evaluate("""()=>{const layer=SOUND_BANK['event.bellEnd'].layers[0],o=Atmos.bellTune('end');
          const notes=Array.from({length:8},(_,i)=>layer.f(o,i));
          return {first:notes.slice(0,7).every((n,i)=>n===BELL_TUNE[i]),last:notes[7]<BELL_TUNE[7],
            durations:Array.from({length:8},(_,i)=>layer.dur({tailLength:1.8},i))};}""")
        self.assertTrue(r['first'] and r['last'])
        self.assertEqual(r['durations'][:7],[2.4]*7)
        self.assertGreater(r['durations'][7],4)

    def test_vacancies_share_daily_cap_and_real_danger_blocks_changes(self):
        page=self.game(2)
        r=page.evaluate("""()=>{const a=Atmos.state();a.stares={'2:teach5:0':1,'2:teach5:1':1,'2:teach5:2':2};
          for(let k=0;k<4;k++){const cls='teach1:'+k;a.left=a.left||{};a.left[cls]=2;Atmos.A.lastCls=null;inCls('teach1',k);update(.05);}
          const capped=Object.keys(a.seats).length===0&&!Atmos.A.stare;
          a.stares={};AN.active=true;for(let k=0;k<4;k++){Atmos.A.lastCls=null;inCls('teach1',k);update(.05);}
          return {capped,hazard:Object.keys(a.seats).length===0&&!Atmos.A.stare};}""")
        self.assertEqual(r,dict(capped=True,hazard=True))

    def test_pause_freezes_turning_and_anomaly_cancels_it(self):
        page=self.game(2)
        r=page.evaluate("""()=>{inCls('teach1',3);Atmos.A.stare={room:'teach1',cls:'teach1:3',t:.5};render(.01);
          PAUSE.on=true;for(let i=0;i<10;i++){update(.1);render(.1);}const frozen=Atmos.A.stare.t===.5;
          PAUSE.on=false;AN.active=true;update(.1);render(.01);
          return {frozen,canceled:!Atmos.A.stare,restored:!AtmosFx.F.stareFigs};}""")
        self.assertEqual(r,dict(frozen=True,canceled=True,restored=True))
