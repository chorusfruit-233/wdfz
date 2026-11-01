"""Isolated recorder navigation regressions, never published as gameplay footage."""
import json
from pathlib import Path
import subprocess
import unittest
from browser_case import BrowserCase

ROOT = Path(__file__).resolve().parents[1]


class SteeringMathTest(unittest.TestCase):
    def test_slow_and_variable_frames_brake_without_oscillating(self):
        program = """
        const nav=require('./video/navigation.js');
        const results=[];
        for(const frames of [[.016],[.3],[.5],[.2,.4,.7,.3]]){
          let x=0,previous=frames[0],crossings=0;
          for(let i=0;i<200&&Math.abs(12-x)>=1;i++){
            let d=12-x,dt=frames[i%frames.length];
            x+=Math.sign(d)*nav.throttle(Math.abs(d),21,previous)*21*dt;
            if(Math.sign(12-x)!==Math.sign(d))crossings++;
            previous=dt;
          }
          results.push({error:Math.abs(12-x),crossings});
        }
        console.log(JSON.stringify(results));
        """
        results = json.loads(subprocess.check_output(['node', '-e', program], cwd=ROOT, text=True))
        for result in results:
            self.assertLess(result['error'], 1)
            self.assertLessEqual(result['crossings'], 1)

    def test_oscillation_is_not_progress_but_shortcuts_are(self):
        program = """
        const nav=require('./video/navigation.js'),p=new nav.Progress(0,20);
        const stalled=[p.update(1000,18),p.update(3000,24),p.update(5000,18),p.update(7100,23)];
        const q=new nav.Progress(0,20);q.update(5000,10);
        console.log(JSON.stringify({stalled,recovered:q.update(9000,7),
          remaining:nav.remaining({x:0,y:0},[{x:3,y:4},{x:6,y:4}],0)}));
        """
        result = json.loads(subprocess.check_output(['node', '-e', program], cwd=ROOT, text=True))
        self.assertEqual(result, {'stalled': [False, False, False, True], 'recovered': False, 'remaining': 8})


class DoorwayNavigationTest(BrowserCase):
    def test_recorded_classroom_corner_exits_under_slow_physics_frames(self):
        page = self.page()
        # Reproduce the old recording's stuck location with a still-closed door.
        # Only the fixture setup writes state; the navigator uses normal inputs.
        page.evaluate("""doEnterRoom('teach1');running=false;
          S.x=1293.1947;S.y=1864.6978;S.seated=false;S.intro=0;
          AN.active=false;PAT.locked=false;RT.inspection=null;
          window.pump=setInterval(()=>{dtG=.35;updatePlayer(.35);},350);""")
        for script in ('navigation.js', 'playthrough.js'):
            page.add_script_tag(path=str(ROOT / 'video' / script))
        page.evaluate("""Pilot.nearest('O',16).then(()=>window.result={ok:true},
          e=>window.result={ok:false,error:String(e)});""")
        page.wait_for_function('window.result', timeout=45000)
        self.assertEqual(page.evaluate('window.result'), {'ok': True})
        self.assert_js(page, "S.mode==='out' && !TOUCH.active && !KEY.w && !S.dead")
        self.assertEqual(page.evaluate("Pilot.log.filter(e=>e.kind==='stuck').length"), 0)
        page.evaluate('clearInterval(pump)')
