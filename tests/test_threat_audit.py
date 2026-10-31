"""恐怖计划 P0 / P2 的回归：巡察者卡住会放弃、跟丢后去最后看见的地方、记得躲过的柜子；
SAN / 体力反馈在静音、低画质、触屏和不同帧率下一致；异象不连着重复；反复死在同一处给线索；
SAN 计划：钥匙保底、课桌短任务题库、坐着同化时的提醒。"""
from browser_case import BrowserCase


class ThreatAuditTest(BrowserCase):
    def patrol_room(self, page):
        page.evaluate("""S.tsec=700;doEnterRoom('teach2');var R=INTERIORS.teach2;
          for(var k=0;k<400;k++){var x=R.ox+Math.random()*R.w,y=R.oy+Math.random()*R.h;if(canStand(x,y)){S.x=x;S.y=y;break;}}
          S.seated=false;patReset();void 0""")

    def test_locked_patrol_that_cannot_reach_gives_up(self):
        page = self.page()
        self.patrol_room(page)
        result = page.evaluate("""() => {
          patStart();for(let i=0;i<40;i++)patTick(0.1);           // 预警 → 出现
          PAT.locked=true;PAT.lock=1;
          const realPath=patPath;window.patPath=function(){return null;};   // 到不了你身边
          const sees=window.patSees;window.patSees=()=>true;              // 一直看得见
          let t=0;while(PAT.state!=='idle'&&t<20){patTick(0.1);t+=0.1;}
          window.patPath=realPath;window.patSees=sees;
          return {gaveUp:PAT.state==='idle',t:+t.toFixed(1),dead:S.dead};
        }""")
        self.assertTrue(result['gaveUp'], result)
        self.assertLessEqual(result['t'], 8)
        self.assertFalse(result['dead'])

    def test_patrol_checks_where_it_last_saw_you_and_the_locker_you_used(self):
        page = self.page()
        self.patrol_room(page)
        result = page.evaluate("""() => {
          const R=INTERIORS.teach2;let lock=null;
          for(let r=0;r<R.rows&&!lock;r++)for(let c=0;c<R.cols&&!lock;c++)if(R.grid[r][c]==='H')lock={c,r};
          // 记得你躲过的柜子：一出现就先去那个柜子门口，站一会儿
          RT.patMem={teach2:lock};patStart();for(let i=0;i<40;i++)patTick(0.1);
          const front=lockerFront(R,lock.c,lock.r);
          const goesToLocker=Math.hypot(PAT.tx-front.x,PAT.ty-front.y)<1&&PAT.linger>0;
          // 你就躲在那个柜子里，它没看见你钻进去：停在门口吓人，但抓不到
          hideIn(lock);HIDE.seen=false;let near=false;
          for(let i=0;i<520&&PAT.state!=='idle';i++){patTick(0.1);if(Math.hypot(PAT.x-front.x,PAT.y-front.y)<12)near=true;}
          const safe=!S.dead;hideOut();patReset();
          // 跟丢以后：去最后看见你的地方
          patStart();for(let i=0;i<40;i++)patTick(0.1);
          PAT.locked=true;PAT.lock=1;PAT.seenX=S.x;PAT.seenY=S.y;PAT.lost=2.4;
          const sees=window.patSees;window.patSees=()=>false;patTick(0.2);window.patSees=sees;
          return {goesToLocker,near,safe,lostTarget:PAT.tx===PAT.seenX&&PAT.ty===PAT.seenY&&PAT.linger>0&&!PAT.locked};
        }""")
        self.assertEqual(result, {'goesToLocker': True, 'near': True, 'safe': True, 'lostTarget': True})

    def test_sanity_feedback_does_not_depend_on_sound_quality_or_input(self):
        for touch in (False, True):
            with self.subTest(touch=touch):
                page = self.page(touch=touch)
                result = page.evaluate("""() => {
                  Settings.vol(0);Settings.q(0);
                  const out=[];
                  for(const san of [90,50,20,5]){
                    S.san=san;updateHUD();render(0.05);
                    out.push({text:document.getElementById('sanfeel').textContent,body:document.body.dataset.san,
                      sense:+GLR.postMat.uniforms.uSan.value.toFixed(2),stam:staminaMax()});
                  }
                  return out;
                }""")
                texts = [r['text'] for r in result]
                self.assertEqual(len(set(texts)), 4)
                self.assertEqual([r['body'] for r in result], ['0', '1', '2', '3'])
                self.assertTrue(all(r['stam'] >= 40 for r in result))      # 最低上限也高于喘匀的门槛 35
                self.assertGreaterEqual(result[0]['sense'], result[-1]['sense'])

    def test_sanity_drain_is_frame_rate_independent(self):
        page = self.page()
        self.patrol_room(page)
        result = page.evaluate("""() => {
          function run(dt){S.san=80;PAT.state='walk';PAT.locked=true;PAT.room='teach2';HIDE.on=false;
            const rule=NEED_RULE['自由'];for(let t=0;t<10-1e-9;t+=dt)sanTick(dt,{san:()=>{},there:()=>true},false);return S.san;}
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
          let said='';const old=window.os;window.os=(m)=>{said=m;};ttTick(0.2,'教室');window.os=old;
          return {count:LESSON_TASKS.length,valid,said};
        }""")
        self.assertEqual(result['count'], 10)
        self.assertTrue(result['valid'])
        self.assertIn('椅子', result['said'])
