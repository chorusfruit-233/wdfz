"""一整天的规则推演：关掉异象和巡察者，只跑课表、SAN、违规、同化和学生会检查。

用来给 SAN 与校园压力计划的平衡提供数据：不是自然试玩，玩家不移动、不做活动、不用道具。"""
from browser_case import BrowserCase


class DaySimulationTest(BrowserCase):
    def simulate(self, profile, days=1):
        page = self.page()
        page.evaluate("Game.start('easy');clearIntroTimers();running=false;S.intro=0;S.talent='none';S.bag=[]")
        page.wait_for_function("S.room==='teach1'&&GLR.roomMesh")
        return page.evaluate("""([profile,days])=>{
          /* 好学生：一直坐在自己座位上，熄灯后回宿舍；逃课生：整天待在室外操场边 */
          /* 从早读 07:20 跑到 01:00 跳回早上为止，就是自然推进的一整天 */
          S.tsec=440;let dt=0.25, real=0, log=[], prev=S.tsec, wraps=0, minSan=S.san, maxViol=S.viol, peak=[0], seat0={x:S.x,y:S.y};
          if(profile==='truant'){S.seated=false;S.mode='out';S.room=null;S.x=290*SC;S.y=430*SC;}
          while(wraps<days&&real<4000*days&&!S.dead){
            AN.active=false;AN.next=1e9;PAT.next=1e9;patReset();
            const night=S.tsec>=LIGHTS_OUT||S.tsec<440;
            if(profile==='good'&&night&&S.room!=='dorm1'){S.seated=false;S.mode='in';S.room='dorm1';
              let R=INTERIORS.dorm1;S.x=R.ox+R.cols*R.tw/2;S.y=R.oy+R.rows*R.th/2;}
            if(profile==='good'&&!night&&S.room!=='teach1'){S.mode='in';S.room='teach1';S.x=seat0.x;S.y=seat0.y;S.seated=true;}
            updateSystems(dt);real+=dt;if(S.tsec<prev){wraps++;peak.push(0);}prev=S.tsec;minSan=Math.min(minSan,S.san);maxViol=Math.max(maxViol,S.viol);
            peak[peak.length-1]=Math.max(peak[peak.length-1],S.tt);
            if(Math.abs(real%300)<dt/2)log.push([Math.round(real),Math.round(S.tsec),Math.round(S.san),Math.round(S.viol),Math.round(S.tt)]);
          }
          return {real,dead:S.dead,day:S.day,clock:S.tsec,minSan,maxViol,san:S.san,viol:S.viol,tt:S.tt,peak:peak.map(Math.round),log,inspections:Object.keys((RT.inspection||{}).seen||{}).length};
        }""", [profile, days])

    def test_full_compliance_survives_day_one_but_not_day_two(self):
        """一直坐着上课、熄灯回宿舍：第一天活下来，同化最高在 50–85 之间（听得到前几级提醒）；
        第二天早上继续坐满才会融入。SAN 不会出问题。（2026-10-31 调整同化速率后的规则，见 SAN 计划）"""
        r = self.simulate('good', days=2)
        self.assertGreater(r['minSan'], 90, r)
        self.assertGreaterEqual(r['peak'][0], 50, r)
        self.assertLess(r['peak'][0], 85, r)
        self.assertTrue(r['dead'], r)
        self.assertEqual(r['day'], 2, r)
        self.assertLess(r['clock'], 12*60, r)            # 第二天上午
        print('\n一直坐着上课两天：', {k: (round(v, 1) if isinstance(v, float) else v) for k, v in r.items() if k != 'log'})

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
