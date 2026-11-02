"""布置免追逐前提，实跑固定环路；比较离屏 / 可见 / 画质。不是自然通关记录。"""
from pathlib import Path
import sys,json
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tests'))
from browser_case import BrowserCase
ROOT=Path(__file__).resolve().parents[1]
RUN="""follow=>{
 freshState('hard');running=false;S.intro=0;PRO.on=false;AN.active=false;AN.next=1e8;S.tsec=700;
 RT.leaveUntil=gameClock()+100000;patReset();let t=0,covered=new Set(),samples=[],illegal=[];
 const nodes=PATROL_ROUTE.nodes;
 while(PAT.cycle<1&&t<5000){
   S.mode=follow&&PAT.room==='out'?'out':'in';S.room=follow?(PAT.room==='out'?null:PAT.room):'lift_dream';
   S.x=PAT.x+40;S.y=PAT.y;S.floorY=PAT.fy;S.seated=false;
   const index=PAT.routeIndex;PatrolWorld.tick(.5);t+=.5;
   if(PAT.routeIndex!==index){covered.add([nodes[Math.max(0,index-1)],nodes[index]].sort().join('|'));samples.push([t,PAT.room,PAT.x,PAT.y,PAT.routeIndex]);}
   if(!PAT.transition){const g=PatrolNav.grid(PAT.room);if(g&&!PatrolNav.free(PAT.room,Math.floor((PAT.x-g.ox)/g.step),Math.floor((PAT.y-g.oy)/g.step)))illegal.push([t,PAT.room,PAT.x,PAT.y]);}
 }
 const g=PatrolNav.graph(),required=g.patrolEdges.map(i=>[g.edges[i].a,g.edges[i].b].sort().join('|'));
 return {complete:PAT.cycle===1,activeSeconds:t,covered:covered.size,required:required.length,missing:required.filter(k=>!covered.has(k)),illegal:illegal.slice(0,10),samples,
   stoppedAt:{scene:PAT.room,index:PAT.routeIndex,transition:PAT.transition,diagnostic:PAT.diagnostic},errors:Lifecycle.snapshot().errors};
}"""
if __name__=='__main__':
 BrowserCase.setUpClass();test=BrowserCase();test.setUp()
 try:
  p=test.page();off=p.evaluate(RUN,False);on=p.evaluate(RUN,True)
  test.set_quality(p,4);ultra=p.evaluate(RUN,False)
  report={'kind':'conditioned browser simulation, not a natural playthrough','fixedStepSeconds':.5,'offscreen':off,'visible':on,'highestQuality':ultra,
    'sameAuthorityTrace':off['samples']==on['samples']==ultra['samples']}
  dest=ROOT/'docs/validation/巡察运行验证.json';dest.parent.mkdir(exist_ok=True);dest.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
  print(json.dumps({k:{f:v for f,v in r.items() if f not in ['samples','errors']} if isinstance(r,dict) else r for k,r in report.items()},ensure_ascii=False))
  assert report['sameAuthorityTrace']
  for r in [off,on,ultra]:assert r['complete'] and not r['missing'] and not r['illegal'] and not r['errors'],r['stoppedAt']
 finally:test.tearDown();BrowserCase.tearDownClass()
