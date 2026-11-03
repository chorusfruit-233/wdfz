"""条件布置的永久追踪审计：所有常规场景及特殊空间落点，不是自然通关。"""
from pathlib import Path
import json,os
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tests'))
from browser_case import BrowserCase
from patrol_runtime_audit import source_digest

ROOT = Path(__file__).resolve().parents[1]
TARGETS = """()=>{
 const targets=[];
 for(const [scene,R] of Object.entries(INTERIORS)){
   if(R.host==='lift'||scene==='lift_dream'||scene==='bell1')continue;
   if(R.stairwell){const s=StairWorld.config(scene);targets.push(StairWorld.point(scene,{x:-1.25,z:3.2,h:s.rise*.25}));continue;}
   const p=PatrolNav.snap(scene,PatrolNav.tilePoint(scene,Math.min(R.cols-3,scene==='lab3'?41:5),Math.min(R.rows-3,5)));
   if(p)targets.push(p);else throw Error('目标未生成：'+scene);
 }
 targets.push(PatrolNav.graph().nodes['out:northgate']);
 for(const exit of MAZE_CFG.exits){const p=VoidMaze.toWorld(exit.x,exit.z);targets.push(PatrolNav.point('lift_dream',p.x,p.y,exit.h));}
 const R=INTERIORS.bell1,C=SPIRAL,r=(C.rIn+C.rOut)/2;
 targets.push(PatrolNav.point('bell1',R.cx+(C.cx+Math.cos(C.th0+1)*r)/U2M,R.cy+(C.cz+Math.sin(C.th0+1)*r)/U2M,C.topH));
 return targets;
}"""
RUN = """goal=>{
 freshState('hard');running=false;S.intro=0;PRO.on=false;AN.active=false;AN.next=1e8;S.talent='none';DEV.god=true;
 S.screen='play';S.mode=goal.scene==='out'?'out':'in';S.room=goal.scene==='out'?null:goal.scene;
 S.x=goal.x;S.y=goal.y;S.floorY=goal.fy||0;S.seated=false;
 patReset();PAT.permanent=true;PAT.mazeGateway={host:'teach',origin:1};let t=0;
 function near(){return PAT.room===goal.scene&&!PAT.transition&&Math.hypot(PAT.x-goal.x,PAT.y-goal.y)<28&&Math.abs(PAT.fy-(goal.fy||0))<.5;}
 while(!near()&&t<1500&&PAT.stuck<60){PatrolWorld.tick(.5);t+=.5;}
 return {goal,reached:near(),seconds:t,tracking:PAT.permanent,position:PatrolWorld.position(),diagnostic:PAT.diagnostic,errors:Lifecycle.snapshot().errors};
}"""


if __name__ == '__main__':
    BrowserCase.setUpClass(); case = BrowserCase(); case.setUp()
    try:
        p = case.page(); targets = p.evaluate(TARGETS); results = []
        for target in targets:
            result = p.evaluate(RUN, target); results.append(result)
            print(json.dumps({k: result[k] for k in ('goal', 'reached', 'seconds', 'diagnostic')}, ensure_ascii=False), flush=True)
        dest=Path(os.environ.get('PATROL_AUDIT_DIR',str(ROOT/'docs/validation/巡察步行与区域报警')))/'永久追踪.json'
        dest.parent.mkdir(parents=True,exist_ok=True)
        dest.write_text(json.dumps({
            'kind': 'conditioned simulation with debug invulnerability; not a natural playthrough',
            'sourceSHA256': source_digest(),
            'fixedStepSeconds': .5, 'results': results,
        }, ensure_ascii=False, indent=2) + '\n')
        assert all(r['reached'] and r['tracking'] and not r['errors'] for r in results)
    finally:
        case.tearDown(); BrowserCase.tearDownClass()
