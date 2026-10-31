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
