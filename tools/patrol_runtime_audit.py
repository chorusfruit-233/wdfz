"""布置免追逐前提，实跑步行环路；比较远处 / 附近及同情境画质。不是真人通关。"""
from pathlib import Path
import sys,json,hashlib,os
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tests'))
from browser_case import BrowserCase
ROOT=Path(__file__).resolve().parents[1]

def source_digest():
 files=sorted((ROOT/'game3d/js').rglob('*.js'))+[ROOT/'game3d/manifest.js',ROOT/'game3d/module-contracts.js']
 digest=hashlib.sha256()
 for f in files:digest.update(str(f.relative_to(ROOT)).encode());digest.update(b'\0');digest.update(f.read_bytes())
 return digest.hexdigest()

RUN="""follow=>{
 freshState('hard');running=false;S.intro=0;PRO.on=false;AN.active=false;AN.next=1e8;S.tsec=700;
 RT.leaveUntil=gameClock()+100000;patReset();let t=0,covered=new Set(),samples=[],illegal=[],blinks=[],overspeed=[];
 const nodes=PATROL_ROUTE.nodes;
 while(PAT.cycle<1&&t<5000){
   S.mode=follow&&PAT.room==='out'?'out':'in';S.room=follow?(PAT.room==='out'?null:PAT.room):'lift_dream';
   S.x=PAT.x+40;S.y=PAT.y;S.floorY=PAT.fy;S.seated=false;
   const index=PAT.routeIndex,old={scene:PAT.room,x:PAT.x,y:PAT.y,fy:PAT.fy};PatrolWorld.tick(.1);t+=.1;
   if(old.scene===PAT.room){const d=Math.hypot(old.x-PAT.x,old.y-PAT.y,(old.fy-PAT.fy)/U2M);
     if(d>PAT_SPEED*.1+1e-6){
       if(PAT.room==='out')blinks.push({t,from:old,to:{scene:PAT.room,x:PAT.x,y:PAT.y}});
       else overspeed.push([t,PAT.room,d]);
     }
   }
   if(PAT.routeIndex!==index){covered.add([nodes[Math.max(0,index-1)],nodes[index]].sort().join('|'));samples.push([t,PAT.room,PAT.x,PAT.y,PAT.routeIndex]);}
   if(!PAT.transition&&StairWorld.config(PAT.room)&&StairWorld.depth(PAT.room,PAT.x,PAT.y,2.7,PAT.fy)>1e-6)illegal.push([t,PAT.room,PAT.x,PAT.y,PAT.fy]);
   if(!PAT.transition){const g=PatrolNav.grid(PAT.room);if(g&&!PatrolNav.free(PAT.room,Math.floor((PAT.x-g.ox)/g.step),Math.floor((PAT.y-g.oy)/g.step)))illegal.push([t,PAT.room,PAT.x,PAT.y]);}
 }
 const g=PatrolNav.graph(),required=g.patrolEdges.map(i=>[g.edges[i].a,g.edges[i].b].sort().join('|'));
 return {complete:PAT.cycle===1,activeSeconds:t,covered:covered.size,required:required.length,missing:required.filter(k=>!covered.has(k)),illegal:illegal.slice(0,10),blinks,overspeed,samples,
   stoppedAt:{scene:PAT.room,index:PAT.routeIndex,transition:PAT.transition,diagnostic:PAT.diagnostic},errors:Lifecycle.snapshot().errors};
}"""
if __name__=='__main__':
 BrowserCase.setUpClass();test=BrowserCase();test.setUp()
 try:
  p=test.page();off=p.evaluate(RUN,False);on=p.evaluate(RUN,True)
  test.set_quality(p,4);ultra=p.evaluate(RUN,False)
  # 玩家贴近时禁长瞬移，位置轨迹自然与远处不同；只有玩家情境相同才能比较画质。
  report={'kind':'conditioned browser simulation, not a natural playthrough','sourceSHA256':source_digest(),
    'fixedStepSeconds':.1,'offscreen':off,'nearPlayer':on,'highestQuality':ultra,
    'sameAuthorityForSamePlayerContext':off['samples']==ultra['samples']}
  dest=Path(os.environ.get('PATROL_AUDIT_DIR',str(ROOT/'docs/validation/巡察步行与区域报警')))/'路线运行.json';dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
  print(json.dumps({k:{f:(len(v) if f=='blinks' else v) for f,v in r.items() if f not in ['samples','errors']} if isinstance(r,dict) else r for k,r in report.items()},ensure_ascii=False))
  assert report['sameAuthorityForSamePlayerContext'] and not on['blinks']
  for r in [off,on,ultra]:assert r['complete'] and not r['missing'] and not r['illegal'] and not r['overspeed'] and not r['errors'],r['stoppedAt']
 finally:test.tearDown();BrowserCase.tearDownClass()
