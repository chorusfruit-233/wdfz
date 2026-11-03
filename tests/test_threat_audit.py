"""恐怖计划 P0 / P2 的回归：巡察者不可达时重规划而不消失、跟丢后去最后看见的地方、记得躲过的柜子；
SAN / 体力反馈在静音、低画质、触屏和不同帧率下一致；异象不连着重复；反复死在同一处给线索；
SAN 计划：钥匙保底、课桌短任务题库、坐着同化时的提醒。"""
from browser_case import BrowserCase


class ThreatAuditTest(BrowserCase):
    def patrol_room(self, page):
        page.evaluate("""S.tsec=700;doEnterRoom('teach2');var R=INTERIORS.teach2;
          for(var k=0;k<400;k++){var x=R.ox+Math.random()*R.w,y=R.oy+Math.random()*R.h;if(canStand(x,y)){S.x=x;S.y=y;break;}}
          S.seated=false;patReset();void 0""")

    def test_unreachable_permanent_patrol_replans_without_giving_up(self):
        page=self.page();self.patrol_room(page)
        result=page.evaluate("""() => {
          PAT.permanent=true;PAT.safety=0;let original=PatrolNav.route;PatrolNav.route=()=>null;
          for(let i=0;i<200;i++)patTick(.1);PatrolNav.route=original;
          return {permanent:PAT.permanent,present:PAT.state==='walk',diagnostic:!!PAT.diagnostic,dead:S.dead};
        }""")
        self.assertEqual(result,dict(permanent=True,present=True,diagnostic=True,dead=False))

    def test_patrol_searches_last_seen_but_does_not_know_an_unseen_locker(self):
        page=self.page();self.patrol_room(page)
        result=page.evaluate("""() => {
          doEnterRoom('teach2',PatrolNav.tilePoint('teach2',30,18));S.seated=false;
          patReset();PAT.room='teach2';PAT.x=S.x+70;PAT.y=S.y;PAT.safety=0;PAT.near=true;
          PAT.locked=true;PAT.lastSeen=PatrolNav.point('teach2',S.x,S.y);PAT.blinkCD=100;
          let point=JSON.stringify(PAT.lastSeen);const original=PatrolNav.los;PatrolNav.los=()=>false;
          hideIn({c:12,r:16});let unseen=!HIDE.seen;patTick(2.6);PatrolNav.los=original;
          return {unseen,safe:!S.dead,present:PAT.state==='walk',searching:!PAT.locked&&PAT.search>0,lastSeen:JSON.stringify(PAT.lastSeen)===point};
        }""")
        self.assertEqual(result,dict(unseen=True,safe=True,present=True,searching=True,lastSeen=True))

    def test_sanity_feedback_does_not_depend_on_sound_quality_or_input(self):
        for touch in (False, True):
            with self.subTest(touch=touch):
                page = self.page(touch=touch)
                result = page.evaluate("""() => {
                  Settings.vol(0);Settings.q(0);
                  const out=[];
                  for(const san of [90,50,20,5]){
                    S.san=san;Sensory.reset();updateHUD();render(0.05);
                    out.push({labels:!!document.getElementById('sanfeel')||!!document.body.dataset.san,
                      sense:+GLR.postMat.uniforms.uWarp.value.toFixed(2),stam:staminaMax()});
                  }
                  return out;
                }""")
                self.assertFalse(any(r['labels'] for r in result))
                self.assertEqual(len(set(r['sense'] for r in result)),4)
                self.assertTrue(all(r['stam'] >= 40 for r in result))      # 最低上限也高于喘匀的门槛 35
                self.assertLess(result[0]['sense'], result[-1]['sense'])

    def test_sanity_drain_is_frame_rate_independent(self):
        page = self.page()
        self.patrol_room(page)
        result = page.evaluate("""() => {
          function run(dt){S.san=80;PAT.state='walk';PAT.locked=true;PAT.room='teach2';HIDE.on=false;
            PAT.safety=0;PAT.transition=null;PAT.x=S.x+5;PAT.y=S.y;for(let t=0;t<10-1e-9;t+=dt)Mechanics.finish(dt);return S.san;}
          const a=run(1/20),b=run(1/60);patReset();return Math.abs(a-b);
        }""")
        self.assertLess(result, 1e-6)

    def test_anomalies_do_not_take_turns_forever(self):
        page = self.page()
        result = page.evaluate("""() => {
          const allow=window.anAllowed;window.anAllowed=id=>id==='turn'||id==='raindots';
          RT.anHist=['turn','raindots','turn','raindots'];
          const first=pickAnomaly(),hist1=RT.anHist.slice(-1)[0];
          const second=pickAnomaly();
          window.anAllowed=allow;
          return {first,hist1,second};
        }""")
        self.assertEqual(result, {'first': None, 'hist1': '_', 'second': 'turn'})

    def test_dying_the_same_way_twice_leaves_a_hint_next_time(self):
        page = self.page()
        result = page.evaluate("""() => {
          localStorage.removeItem('wdfz3d_deaths');
          deathLogAdd('drown');const one=deathHints().length;deathLogAdd('drown');deathLogAdd('grip');
          const hints=deathHints();UI.renderNote();
          return {one,hints:hints.length,first:hints[0],note:document.getElementById('notein').textContent.includes('梦里记得的事')};
        }""")
        self.assertEqual(result['one'], 0)
        self.assertEqual(result['hints'], 1)
        self.assertIn('有顶的地方', result['first'])
        self.assertTrue(result['note'])

    def test_principal_office_key_has_a_pity_timer(self):
        page = self.page()
        result = page.evaluate("""() => {
          doEnterRoom('admin5');const R=INTERIORS.admin5;S.bag=[];RT.deskUsed={};RT.keyMiss=0;
          const rnd=Math.random;Math.random=()=>0.99;            // 运气最差：概率永远不中
          const got=[];let n=0;
          for(let r=0;r<R.rows&&n<4;r++)for(let c=0;c<R.cols&&n<4;c++){
            if(!'dfRq'.includes(R.grid[r][c]))continue;doSearch(c,r);n++;got.push(hasItem('key')||hasItem('roomkey'));}
          Math.random=rnd;return {n,got};
        }""")
        self.assertEqual(result['n'], 4)
        self.assertEqual(result['got'], [False, False, False, True])

    def test_lesson_pool_and_seated_assimilation_warning(self):
        page = self.page()
        result = page.evaluate("""() => {
          const valid=LESSON_TASKS.every(t=>t.choices.length===3&&t.answer>=0&&t.answer<3&&t.note);
          S.tsec=700;doEnterRoom('teach1');S.seated=true;S.ttTier=2;S.tt=59.9;
          let said='';const old=window.os;window.os=(m)=>{said=m;};ttTick(0.5,'教室');window.os=old;
          return {count:LESSON_TASKS.length,valid,said};
        }""")
        self.assertEqual(result['count'], 10)
        self.assertTrue(result['valid'])
        self.assertIn('椅子', result['said'])
