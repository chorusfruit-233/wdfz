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
        for(const frames of [[.016],[.3],[.5],[.2,.4,.7,.3],[.016,.5]]){
          let x=0,previous=frames[0],crossings=0,now=0,window=new nav.FrameWindow();
          for(let i=0;i<200&&Math.abs(12-x)>=1;i++){
            let d=12-x,dt=frames[i%frames.length];
            x+=Math.sign(d)*nav.throttle(Math.abs(d),21,window.update(now,previous))*21*dt;
            if(Math.sign(12-x)!==Math.sign(d))crossings++;
            previous=dt;now+=dt*1000;
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
    def test_fake_normal_dialog_is_answered_without_changing_game_rules(self):
        page = self.page()
        page.evaluate("""running=false;S.intro=0;AN.active=false;PAT.locked=false;RT.inspection=null;
          S.fn={on:true,v:0,left:4,used:{},next:0,n:0};fnTick(.1);""")
        page.add_script_tag(path=str(ROOT / 'video/playthrough.js'))
        self.assert_js(page, "UI.chooseOpen && document.getElementById('choices').innerText.includes('看起来是——')")
        page.evaluate("Pilot.defense().then(()=>window.handled=true)")
        page.wait_for_function('window.handled')
        self.assert_js(page, "!UI.chooseOpen && S.fn.v===5 && !S.dead")
        self.assertEqual(page.evaluate("Pilot.log.find(e=>e.kind==='decision').detail.option"), 2)

    def test_cyber_route_crosses_bridge_and_uses_student_pc_without_key(self):
        page = self.page()
        page.evaluate("""doEnterRoom('teach1');running=false;
          const R=INTERIORS.teach1;doEnterRoom('teach1',Object.assign(ClassroomLayout.anchor(R,ClassroomLayout.ownSeat),{seated:true}));
          S.intro=0;S.seated=true;S.bag=['phone'];RT.inspection=null;PAT.locked=false;AN.active=false;
          PhoneNetwork.acquire();PhoneNetwork.device.network=true;PhoneNetwork.device.download.status='complete';
          window.inputTargets=[];document.body.addEventListener('keydown',e=>{if(e.key==='e')inputTargets.push({room:S.room,target:nearWorld(24),hint:interactHint(),cool:S.enterCool});},true);
          window.pump=setInterval(()=>{dtG=.35;updatePlayer(.35);},80);""")
        for script in ('navigation.js', 'cyber.js', 'playthrough.js'):
            page.add_script_tag(path=str(ROOT / 'video' / script))
        page.evaluate("""(async()=>{
          await PilotCyber.bridge(Pilot,'lab');await Pilot.floor(3);
          await Pilot.nearest('nK',10);await Pilot.choose(3);
          if(!TerminalUI.on||hasItem('roomkey'))throw Error('普通学生机没有正常打开终端');
          document.querySelector('#campus-terminal [data-exit]').click();
          await PilotCyber.bridge(Pilot,'teach');await Pilot.floor(1);
          const R=INTERIORS.teach1;await Pilot.go({x:R.ox+48.5*R.tw,y:R.oy+6.5*R.th},11);await Pilot.tap('e');
        })().then(()=>window.result={ok:true},e=>window.result={ok:false,error:String(e)});""")
        page.wait_for_function('window.result', timeout=180000)
        self.assertEqual(page.evaluate('window.result'), {'ok': True},
                         page.evaluate("JSON.stringify({state:Pilot.snapshot(),inputs:inputTargets.slice(-8),events:Pilot.log.filter(e=>e.kind!=='input').slice(-4)})"))
        self.assert_js(page, "S.room==='teach1' && S.seated && atMySeat() && !TerminalUI.on && !hasItem('roomkey')")
        self.assertEqual(page.evaluate("Pilot.log.filter(e=>e.kind==='bridge').map(e=>e.detail.to)"), ['lab', 'teach'])
        page.evaluate('clearInterval(pump)')

    def test_portal_bench_tunnel_and_blueprint_use_real_interactions(self):
        page = self.page()
        page.evaluate("""ENTER_VIA='stair';doEnterRoom('lab1');running=false;
          S.intro=0;S.seated=false;S.bag=['roomkey'];RT.inspection=null;
          PAT.locked=false;AN.active=false;
          window.pump=setInterval(()=>{dtG=.35;updatePlayer(.35);},80);""")
        for script in ('navigation.js', 'playthrough.js'):
            page.add_script_tag(path=str(ROOT / 'video' / script))
        page.evaluate("""(async()=>{
          await Pilot.nearest('N',10);if(!hasItem('lens'))throw Error('没有操作到显微镜');
          await Pilot.nearest('K',10);await Pilot.choose(1);
          await new Promise(r=>setTimeout(r,1800));
          if(S.room!=='portal_tunnel')throw Error('没有进入隧道');
          await Pilot.nearest('u',10);if(!RT.portalDiary)throw Error('没有读到日记');
          await Pilot.interact(Pilot.cells('j').find(p=>p.r===0),12);
          await new Promise(r=>setTimeout(r,1200));
          await Pilot.stairs(true);await Pilot.nearest('K',10);await Pilot.choose(2);
        })().then(()=>window.result={ok:true},e=>window.result={ok:false,error:String(e)});""")
        page.wait_for_function('window.result', timeout=90000)
        self.assertEqual(page.evaluate('window.result'), {'ok': True})
        self.assert_js(page, "RT.portalDiary && RT.portalBlueprints[2] && hasItem('lens')")
        page.evaluate('clearInterval(pump)')

    def test_roster_cannot_be_mistaken_for_stair_direction(self):
        page = self.page()
        page.evaluate("""ENTER_VIA='stair';doEnterRoom('admin2');running=false;
          S.intro=0;S.seated=false;RT.inspection=null;PAT.locked=false;
          AN.active=true;AN.id='roster';AN.data={rx:S.x,ry:S.y,done:false};
          window.pump=setInterval(()=>{dtG=.35;updatePlayer(.35);},350);""")
        for script in ('navigation.js', 'playthrough.js'):
            page.add_script_tag(path=str(ROOT / 'video' / script))
        page.evaluate("Pilot.stairs(true).then(()=>window.result={ok:true},e=>window.result={ok:false,error:String(e)})")
        page.wait_for_function('window.result', timeout=90000)
        self.assertEqual(page.evaluate('window.result'), {'ok': True})
        self.assert_js(page, "S.room==='admin3' && AN.data.done")
        decisions = page.evaluate("Pilot.log.filter(e=>e.kind==='decision').map(e=>e.detail.text)")
        self.assertIn('红线', decisions[0])
        self.assertEqual(len(decisions),1)
        self.assert_js(page,"Pilot.log.some(e=>e.kind==='stairs'&&e.detail.to==='admin3'&&e.detail.method==='walk')")
        page.evaluate('clearInterval(pump)')

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
