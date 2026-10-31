"""死亡演出的注册、计时和资源回收回归。"""
from browser_case import BrowserCase


class DeathTimelineTest(BrowserCase):
    def test_reachable_effects_have_preview_and_timeline(self):
        page = self.page()
        result = page.evaluate("""() => {
          let preview=new Set(DEV_DEATH.map(x=>x[1]));
          let actual=new Set(Object.values(DFX_MAP).filter(Boolean));
          let absent=[...actual].filter(id=>!preview.has(id)||!DeathTimeline.durations[id]);
          let bad=DEV_DEATH.filter(([name,id])=>{
            let d=DeathTimeline.duration(id);
            return DeathTimeline.sample(id,0).phase!=='warning'||
              DeathTimeline.sample(id,d*.3).phase!=='contact'||
              DeathTimeline.sample(id,d*.7).phase!=='struggle'||
              DeathTimeline.sample(id,d).phase!=='end';
          }).map(x=>x[1]);
          return {absent,bad,hand:preview.has('hand')};
        }""")
        self.assertEqual(result, {'absent': [], 'bad': [], 'hand': True})

    def test_motion_depends_on_elapsed_time_not_frame_count(self):
        page = self.page()
        result = page.evaluate("""() => {
          function run(id,dt,n){
            deathFX(id);for(let i=0;i<n;i++)anfxUpdate(dt);
            let points=ANFX.items.map(o=>({x:o.position.x-o.userData.deathOrigin.x,
                                           y:o.position.y-o.userData.deathOrigin.y}));
            anfxClear();return points;
          }
          let failures=[];
          for(let id of ['water','chalk','loop']){
            let a=run(id,.1,10),b=run(id,.02,50);
            if(a.length!==b.length||a.some((p,i)=>Math.abs(p.x-b[i].x)>1e-7||
              Math.abs(p.y-b[i].y)>1e-7))failures.push(id);
          }
          return failures;
        }""")
        self.assertEqual(result, [])

    def test_all_death_models_have_finite_transforms_during_playback(self):
        page = self.page()
        failures = page.evaluate("""() => {
          let failures=[];
          for(const [,id] of DEV_DEATH){
            deathFX(id);
            for(const dt of [.15,.5,.9,.8]){
              anfxUpdate(dt);
              ANFX.grp.traverse(o=>{
                if(![o.position.x,o.position.y,o.position.z,o.scale.x,o.scale.y,o.scale.z,
                     o.quaternion.x,o.quaternion.y,o.quaternion.z,o.quaternion.w].every(Number.isFinite))
                  failures.push(id);
              });
            }
            anfxClear();
          }
          return [...new Set(failures)];
        }""")
        self.assertEqual(failures, [])

    def test_stall_hand_rises_then_reaches_player(self):
        page = self.page()
        result = page.evaluate("""() => {
          deathFX('hand',{preview:true});let hand=ANFX.items[0],start=hand.position.clone();
          anfxUpdate(.8);let raised=hand.position.clone();anfxUpdate(.8);let reached=hand.position.clone();
          let player=anfxW2S(S.x,S.y),horizontal=p=>Math.hypot(p.x-player.x,p.z-player.z);
          let r={raised:raised.y>start.y+.8,approached:horizontal(reached)<horizontal(raised),
                 phase:ANFX.timeline.phase};
          let group=ANFX.grp;anfxClear();ThreeBackend.disposeGroup(group);return r;
        }""")
        self.assertEqual(result, {'raised': True, 'approached': True, 'phase': 'struggle'})

    def test_bin_preview_closes_lid_without_mutating_player(self):
        page = self.page()
        result = page.evaluate("""() => {
          doEnterRoom('trash1');let world=GLR.roomMesh;
          let before=JSON.stringify(S);deathFX('trash',{preview:true});
          let hidden=!world.visible;
          let lid=ANFX.items.find(o=>o.userData.trashLid),start=lid.rotation.z;
          anfxUpdate(2.2);let end=lid.rotation.z,unchanged=JSON.stringify(S)===before;
          let group=ANFX.grp;anfxClear();ThreeBackend.disposeGroup(group);
          return {closed:end<start*.1,unchanged,hidden,restored:world.visible};
        }""")
        self.assertEqual(result, {'closed': True, 'unchanged': True, 'hidden': True, 'restored': True})

    def test_real_death_resources_are_released_once(self):
        page = self.page()
        result = page.evaluate("""() => {
          let old=ThreeBackend.disposeGroup,count=0;
          ThreeBackend.disposeGroup=function(g){count++;return old(g)};
          deathFX('hand');let group=ANFX.grp;anfxClear();anfxClear();
          ThreeBackend.disposeGroup=old;
          return {count,attached:GLR.scene.children.includes(group),timeline:ANFX.timeline};
        }""")
        self.assertEqual(result, {'count': 1, 'attached': False, 'timeline': None})

    def test_cutscene_skip_releases_resources_and_restores_visual_state(self):
        page = self.page()
        result = page.evaluate("""() => {
          CUT.enabled=true;GLR.worldNorm=.23;let complete=0,disposed=0;
          let old=ThreeBackend.disposeGroup;
          playCut('face',()=>{complete++;S.screen='play'});
          let group=CUT.grp;
          ThreeBackend.disposeGroup=function(g){if(g===group)disposed++;return old(g)};
          cutTick(4);GLR.worldNorm=.9;cutSkip();cutSkip();
          ThreeBackend.disposeGroup=old;
          return {complete,disposed,attached:GLR.scene.children.includes(group),worldNorm:GLR.worldNorm};
        }""")
        self.assertEqual(result, {'complete': 1, 'disposed': 1, 'attached': False, 'worldNorm': .23})

    def test_every_reachable_death_has_its_own_sound(self):
        """真实能触发的死亡类型都要有按死因配的死亡音（附录 A 盘点时缺 10 种）。"""
        page = self.page()
        result = page.evaluate("""() => {
          let kinds=new Set(SFX.deathKinds());
          let reachable=new Set(Object.values(DFX_MAP).filter(Boolean));
          ['vignette','grip','names','slit','squeeze','face','laugh','trash'].forEach(id=>reachable.add(id));
          let missing=[...reachable].filter(id=>!kinds.has(id)).sort();
          let errors=[];
          kinds.forEach(id=>{try{SFX.deathFx(id);}catch(e){errors.push(id+':'+e.message);}});
          return {missing,errors};
        }""")
        self.assertEqual(result, {'missing': [], 'errors': []})

    def test_board_deaths_stand_in_front_of_the_view(self):
        """黑板、名单这类立板要出现在视线正前方，不能固定在场景某个方向上（会跑到身后）。"""
        page = self.page()
        result = page.evaluate("""() => {
          let out={};
          for(const id of ['chalk','names']){
            out[id]=[0,1.6,3.2,4.7].map(a=>{
              S.ang=a;syncCamera(0);GLR.cam.updateMatrixWorld();deathFX(id,{preview:true});ANFX.grp.updateMatrixWorld(true);
              let box=new THREE.Box3().setFromObject(ANFX.items[0]),c=box.getCenter(new THREE.Vector3());
              let v=c.clone().applyMatrix4(GLR.cam.matrixWorldInverse);
              anfxClear();return v.z<-1;          /* 相机坐标里 -z 是前方 */
            });
          }
          return out;
        }""")
        self.assertEqual(result, {'chalk': [True]*4, 'names': [True]*4})

    def test_storyboarded_deaths_cover_every_reachable_type(self):
        """真实能触发的死法都要有分镜（四段式）或此前已单独重做；时长不少于 3 秒。"""
        page = self.page()
        result = page.evaluate("""() => {
          let reach=new Set(Object.values(DFX_MAP).filter(Boolean));
          ['vignette','grip','names','slit','squeeze','face','laugh','trash'].forEach(id=>reach.add(id));
          let earlier=new Set(['vignette','slit','squeeze','face','chalk','names','hand','trash']);
          let missing=[...reach].filter(id=>!earlier.has(id)&&!DeathCG.has(id)).sort();
          let short=DeathCG.types().filter(id=>DeathTimeline.duration(id)<3).sort();
          return {missing,short,count:DeathCG.types().length};
        }""")
        self.assertEqual(result['missing'], [])
        self.assertEqual(result['short'], [])
        self.assertGreaterEqual(result['count'], 20)

    def test_storyboards_are_frame_rate_independent_and_move_through_phases(self):
        """同样经过的时间，帧率不同结果一样（模型和镜头）；四个阶段的画面各不相同。"""
        page = self.page()
        result = page.evaluate("""() => {
          function snap(){
            let v=[];ANFX.grp.traverse(o=>{v.push(o.position.x,o.position.y,o.position.z,o.scale.x,o.scale.y,o.rotation.x,o.rotation.y,o.visible?1:0);});
            return v.concat([GLR.cam.position.y,GLR.cam.quaternion.x,GLR.cam.quaternion.y]);
          }
          function run(id,dt,n){ S.ang=.7;S.pitch=0;S.eyeLift=0;syncCamera(0);
            deathFX(id,{preview:true});for(let i=0;i<n;i++)anfxUpdate(dt);let s=snap();anfxClear();return s;}
          let drift=[],still=[];
          for(const id of DeathCG.types()){
            let a=run(id,.1,24),b=run(id,.02,120);
            if(a.length!==b.length||a.some((x,i)=>Math.abs(x-b[i])>1e-6))drift.push(id);
            let d=DeathTimeline.duration(id);
            let frames=[.12,.38,.7,.93].map(f=>run(id,d*f/30,30));
            for(let i=1;i<4;i++){
              if(frames[i].every((x,j)=>Math.abs(x-frames[i-1][j])<1e-4)){still.push(id+':'+i);break;}
            }
          }
          return {drift,still};
        }""")
        self.assertEqual(result, {'drift': [], 'still': []})

    def test_storyboards_respect_reduced_shake_and_cap_flash(self):
        page = self.page()
        result = page.evaluate("""() => {
          let flashes=[],shk=[];
          SHAKE_ON=false;
          for(const id of DeathCG.types()){
            GLR.flash=0;deathFX(id,{preview:true});
            if(ANFX.cg.shk!==0)shk.push(id);
            let peak=0;for(let i=0;i<40;i++){anfxUpdate(.1);peak=Math.max(peak,GLR.flash||0);}
            if(peak>0.5)flashes.push(id);
            anfxClear();
          }
          SHAKE_ON=true;
          return {flashes,shk};
        }""")
        self.assertEqual(result, {'flashes': [], 'shk': []})

    def test_camera_target_follows_death_lift(self):
        """镜头随演出下沉时，平视仍是平视（以前注视点留在原来的眼高，一沉就变成仰视）。"""
        page = self.page()
        result = page.evaluate("""() => {
          let out=[];
          for(const lift of [-1.4,0,1.2]){
            syncCamera(0,{ang:.3,pitch:0,eyeLift:lift});GLR.cam.updateMatrixWorld();
            let dir=new THREE.Vector3();GLR.cam.getWorldDirection(dir);out.push(Math.abs(dir.y)<1e-6);
          }
          syncCamera(0);return out;
        }""")
        self.assertEqual(result, [True, True, True])

    def test_real_storyboard_death_turns_camera_and_releases_once(self):
        """真实死亡（非预览）也走分镜：镜头量写在玩家状态上，结束时资源只释放一次。"""
        page = self.page()
        result = page.evaluate("""() => {
          S.ang=0;S.pitch=0;S.eyeLift=0;S.deathView={ang:0,pitch:0,eyeLift:0};
          let old=ThreeBackend.disposeGroup,count=0;
          ThreeBackend.disposeGroup=function(g){count++;return old(g)};
          deathFX('gaze');for(let i=0;i<20;i++)anfxUpdate(.1);
          let turned=Math.abs(S.ang-Math.PI)<0.05;
          deathFX('grip');for(let i=0;i<30;i++)anfxUpdate(.1);
          let sank=S.eyeLift<-1;
          anfxClear();anfxClear();ThreeBackend.disposeGroup=old;
          S.ang=0;S.pitch=0;S.eyeLift=0;S.deathView=null;
          return {turned,sank,count};
        }""")
        self.assertEqual(result, {'turned': True, 'sank': True, 'count': 2})

    def test_death_cinematic_can_be_skipped_once(self):
        """死亡演出至少看 0.6 秒，之后空格 / 回车 / Esc 直接到死亡界面；只结算一次，旧计时器不会再写一遍。"""
        page = self.page()
        page.evaluate("S.diff='hard';S.day=2;S.talent='code';S.bag=[];kill('一只手按住了我的头顶。','grip')")
        early = page.evaluate("deathSkip()")
        page.wait_for_timeout(700)
        page.keyboard.press('Space')
        result = page.evaluate("""() => ({shown:getComputedStyle(document.getElementById('die')).display!=='none',
          pending:DEATH_PENDING,epi:document.getElementById('dieepi').textContent})""")
        page.evaluate("document.getElementById('dieepi').textContent='改过'")
        page.keyboard.press('Enter')
        page.wait_for_timeout(int(page.evaluate("DeathTimeline.duration('grip')*1000")) + 300)
        after = page.evaluate("document.getElementById('dieepi').textContent")
        self.assertFalse(early)
        self.assertTrue(result['shown'])
        self.assertIsNone(result['pending'])
        self.assertTrue(result['epi'])
        self.assertEqual(after, '改过')

    def test_tapping_through_a_death_does_not_press_the_menu_button(self):
        page = self.page(touch=True)
        page.evaluate("S.diff='hard';S.day=2;S.talent='code';S.bag=[];kill('黑影围了上来。','vignette')")
        page.wait_for_timeout(700)
        page.touchscreen.tap(195, 420)
        page.wait_for_timeout(400)
        self.assert_js(page, "getComputedStyle(document.getElementById('die')).display!=='none'&&S.screen==='play'&&S.dead")

    def test_every_ending_storyboard_plays_through_and_finishes_once(self):
        page = self.page()
        result = page.evaluate("""() => {
          const out={};
          for(const id of ['car','face','beast','portal']){
            if(id==='car'){doEnterRoom('garage1');}else if(id==='beast'){doEnterRoom('teach1');}else if(id==='portal'){doEnterRoom('lab1');}
            CUT.enabled=true;let done=0;const bad=[];
            playCut(id,()=>{done++;S.screen='play';});
            const grp=CUT.grp;
            for(let i=0;i<120&&CUT.on;i++){cutTick(0.1);
              const p=GLR.cam.position;if(![p.x,p.y,p.z].every(Number.isFinite))bad.push(i);}
            cutSkip();cutSkip();
            out[id]={done,bad:bad.length,cleaned:!CUT.on&&!CUT.grp&&!GLR.scene.children.includes(grp),mode:S.mode};
          }
          CUT.enabled=false;return out;
        }""")
        for cut_id, r in result.items():
            self.assertEqual(r['done'], 1, cut_id)
            self.assertEqual(r['bad'], 0, cut_id)
            self.assertTrue(r['cleaned'], cut_id)
        self.assertEqual(result['car']['mode'], 'out')     # 开车那条从车库切到校门外
