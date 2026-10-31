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
