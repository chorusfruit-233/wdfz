"""Rule invariants without a browser, DOM, WebGL, clocks, or persistent storage."""
from pathlib import Path
import shutil
import subprocess
import unittest


class DomainRulesTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.root = Path(__file__).resolve().parents[1]
        cls.node = shutil.which('node')
        if not cls.node:
            raise unittest.SkipTest('Node is required for renderer-independent rule checks')

    def js(self, script):
        result = subprocess.run(
            [self.node, '-e', "const assert=require('node:assert/strict');\n" + script],
            cwd=self.root, text=True, capture_output=True, timeout=20,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_stats_preserve_frame_settlement_and_state_replacement(self):
        self.js("""
const {StatRules:R,PlayerStats:P}=require('./game3d/js/domain/player-stats.js');
let state={san:2,stam:90,viol:2,tt:0}, stats=P.create(()=>state);
stats.changeSan(-5,'hazard');
assert.equal(state.san,-3); // Do not move death settlement ahead of other effects in the same step.
stats.changeSan(7,'protected');stats.settle();
assert.equal(state.san,4);assert.equal(state.stam,42.4);
stats.changeSan(200,'reward',{max:100});assert.equal(state.san,100);
stats.changeSan(-200,'stare',{min:1});assert.equal(state.san,1);
state={san:NaN,stam:Infinity,viol:0,tt:0};stats.settle();
assert.equal(state.san,100);assert.equal(state.stam,0);
stats.restoreStamina(Infinity);assert.equal(state.stam,100);
stats.changeAssimilation(3,'classroom');assert.equal(state.tt,3);
assert.equal(stats.last.source,'classroom');
for(let san=-10;san<=110;san++){
  assert.equal(R.staminaMax(san),40+.6*Math.max(0,Math.min(100,san)));
  assert.equal(R.sanityStage(san),san>60?0:san>30?1:san>12?2:3);
}
""")

    def test_violation_exemption_keeps_inspection_exception(self):
        self.js("""
const {PlayerStats:P}=require('./game3d/js/domain/player-stats.js');
const state={san:50,stam:50,viol:95,tt:0},s=P.create(()=>state);
s.addViolation(20,'patrol',true);assert.equal(state.viol,95);
s.addViolation(20,'inspection',true);assert.equal(state.viol,100);
s.addViolation(-30,'decay',true);assert.equal(state.viol,70);
s.addViolation(-90,'decay',false);assert.equal(state.viol,0);
""")

    def test_calendar_matches_previous_boundary_and_cross_day_behavior(self):
        self.js("""
const T=require('./game3d/js/domain/game-time.js');
function oldForward(time,day,amount){
 let left=amount,trace=[];
 while(left>0){let from=time,used=Math.min(left,Math.max(0,1500-from));time+=used;left-=used;
  trace.push([day,from,time]);
  if((from<1350&&time>=1350)||(day===1&&from>=1350))day=(day||1)+1;
  if(time>=1500-1e-9)time=440;else if(used<=0)break;
 }return {time,day,trace};
}
function nextForward(time,day,amount){let left=amount,trace=[];
 while(left>0){let s=T.forwardSlice(time,day,left,1340);trace.push([day,s.from,s.to]);
  time=s.time;day=s.day;left=s.remaining;if(time===s.to&&s.used<=0)break;
 }return {time,day,trace};
}
function oldBack(time,day,left){while(left>0){if(time<=440)time=1500;let before=time,used=Math.min(left,time-440);time-=used;left-=used;if(before>=1350&&time<1350&&day>1)day--;}return {time,day};}
function nextBack(time,day,left){while(left>0){let s=T.backwardSlice(time,day,left,1340);time=s.to;day=s.day;left=s.remaining;}return {time,day};}
for(let day of [1,2,3,10])for(let time of [0,440,700,1340,1349.99,1350,1499.999,1500])for(let amount of [0,.001,1,20,240,1060,3000]){
 assert.deepEqual(nextForward(time,day,amount),oldForward(time,day,amount));
 assert.deepEqual(nextBack(time,day,amount),oldBack(time,day,amount));
 assert.equal(T.continuous(day,time,1340),(day-1-(time>=1350&&day>1?1:0))*1440+time);
}
assert.equal(T.amount(Infinity),0);assert.equal(T.amount(NaN),0);assert.equal(T.amount(-1),0);
""")

    def test_real_time_slices_preserve_special_window_and_remainder(self):
        self.js("""
const T=require('./game3d/js/domain/game-time.js');
for(let time of [440,700,705,705+1/6,705+14/60,1349.99])for(let end of [time,time+.01,time+20])for(let rate of [2,20,60,120])for(let seconds of [.001,1/60,.25,1,5]){
 const until=Math.max(0,(end-time)*60/rate),used=Math.min(seconds,until),s=T.realTimeSlice(time,seconds,end,rate);
 assert.equal(s.seconds,used);assert.equal(s.nudge,until<1e-9);
 assert.equal(s.minutes,until<1e-9?1e-8:(used===until?end-time:used*rate/60));
}
""")

    def test_pressure_curve_is_continuous_and_capped(self):
        self.js("""
const T=require('./game3d/js/domain/game-time.js');
const points=[{clock:1090,anomaly:1,patrol:1,danger:1,passive:1,rest:1},{clock:1350,anomaly:.55,patrol:.60,danger:1.65,passive:.45,rest:.70},{clock:2790,anomaly:.42,patrol:.45,danger:2,passive:.30,rest:.55}];
assert.equal(T.pressure(points,700).stage,0);
assert.equal(T.pressure(points,1090).danger,1);
assert.equal(T.pressure(points,1350).stage,2);
assert.equal(T.pressure(points,1350).danger,1.65);
assert.equal(T.pressure(points,100000).danger,2);
for(let t=1090;t<2790;t+=.25){assert.ok(T.pressure(points,t+.25).danger>=T.pressure(points,t).danger);assert.ok(T.pressure(points,t+.25).rest<=T.pressure(points,t).rest);}
""")

    def test_inventory_capacity_hotbar_and_consumption_without_ui(self):
        self.js("""
const I=require('./game3d/js/domain/inventory.js');
const s={bag:[],hot:[null,null],bagSel:0};
assert.equal(I.add(s,'nothing'),'invalid');assert.equal(I.add(s,'missing',false),'invalid');
for(let i=0;i<8;i++)assert.equal(I.add(s,'item'+i),'added');
assert.equal(I.add(s,'item0'),'duplicate');assert.equal(I.add(s,'overflow'),'full');
assert.equal(I.setHot(s,0,'item7'),true);assert.equal(I.setHot(s,1,'missing'),false);
assert.equal(I.select(s,7),true);assert.equal(I.select(s,8),false);
assert.equal(I.remove(s,'item7'),true);assert.equal(s.bagSel,6);assert.equal(s.hot[0],null);
assert.equal(I.remove(s,'item7'),false);assert.equal(s.bag.length,7);
I.clear(s);assert.deepEqual(s,{bag:[],hot:[null,null],bagSel:0});
assert.equal(I.select(s,7),true);assert.equal(s.bagSel,7); // UI permits selecting an empty slot
""")

    def test_pressure_query_does_not_write_persistent_state(self):
        self.js("""
const vm=require('node:vm'),fs=require('node:fs');
const c={RT:{pressureClock:700},S:{screen:'play'},GameTimeRules:require('./game3d/js/domain/game-time.js'),now:2000};
c.gameClock=()=>c.now;require('./tests/support/capsules.cjs').context(c);
vm.runInContext(fs.readFileSync('game3d/js/campus-pressure.js','utf8'),c);
const before=JSON.stringify(c.RT),value=c.CampusPressure.current();
assert.equal(value.clock,2000);assert.equal(JSON.stringify(c.RT),before);
c.CampusPressure.observe();assert.equal(c.RT.pressureClock,2000);
c.now=700;assert.equal(c.CampusPressure.current().clock,2000);
""")
