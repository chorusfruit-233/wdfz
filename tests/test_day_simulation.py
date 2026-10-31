"""一整天的规则推演：关掉异象和巡察者，只跑课表、SAN、违规、同化和学生会检查。

用来给 SAN 与校园压力计划的平衡提供数据：不是自然试玩，玩家不移动、不做活动、不用道具。"""
from browser_case import BrowserCase


class DaySimulationTest(BrowserCase):
    def simulate(self, profile):
        page = self.page()
        page.evaluate("Game.start('easy');clearIntroTimers();running=false;S.intro=0")
        page.wait_for_function("S.room==='teach1'&&GLR.roomMesh")
        return page.evaluate("""profile=>{
          /* 好学生：一直坐在自己座位上，熄灯后回宿舍；逃课生：整天待在室外操场边 */
          /* 从早读 07:20 跑到 01:00 跳回早上为止，就是自然推进的一整天 */
          S.tsec=440;let dt=0.25, real=0, log=[], prev=S.tsec, wrapped=false, minSan=S.san, maxViol=S.viol;
          if(profile==='truant'){S.seated=false;S.mode='out';S.room=null;S.x=290*SC;S.y=430*SC;}
          while(!wrapped&&real<4000&&!S.dead){
            AN.active=false;AN.next=1e9;PAT.next=1e9;patReset();
            if(profile==='good'&&S.tsec>=LIGHTS_OUT&&S.room!=='dorm1'){S.seated=false;S.mode='in';S.room='dorm1';
              let R=INTERIORS.dorm1;S.x=R.ox+R.cols*R.tw/2;S.y=R.oy+R.rows*R.th/2;}
            updateSystems(dt);real+=dt;if(S.tsec<prev)wrapped=true;prev=S.tsec;minSan=Math.min(minSan,S.san);maxViol=Math.max(maxViol,S.viol);
            if(Math.abs(real%300)<dt/2)log.push([Math.round(real),Math.round(S.tsec),Math.round(S.san),Math.round(S.viol),Math.round(S.tt)]);
          }
          return {real,dead:S.dead,minSan,maxViol,san:S.san,viol:S.viol,tt:S.tt,log,inspections:Object.keys((RT.inspection||{}).seen||{}).length};
        }""", profile)

    def test_full_compliance_dies_only_of_assimilation(self):
        """一直坐着上课：SAN 不会出问题，但同化会在晚自习满值、直接融入（现行规则，见 SAN 计划的推演记录）。"""
        r = self.simulate('good')
        self.assertGreater(r['minSan'], 90, r)
        if r['dead']:
            self.assertGreaterEqual(r['tt'], 99, r)
        print('\n一直坐着上课：', {k: (round(v, 1) if isinstance(v, float) else v) for k, v in r.items()})

    def test_truancy_does_not_drain_san_and_day_lasts_about_44_minutes(self):
        r = self.simulate('truant')
        self.assertFalse(r['dead'], r)
        # 逃课只加违规，不按时段扣 SAN；两次学生会检查不在教室各扣一次
        self.assertGreater(r['minSan'], 60, r)
        self.assertGreater(r['maxViol'], 50, r)
        self.assertEqual(r['inspections'], 2, r)
        self.assertGreater(r['real'], 41*60, r)
        self.assertLess(r['real'], 47*60, r)
        print('\n逃课一天：', {k: (round(v, 1) if isinstance(v, float) else v) for k, v in r.items()})
