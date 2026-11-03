"""Render a fixed-view sensory A/B and measure resource reuse; no natural-play or real-GPU claim."""
from pathlib import Path
import argparse,json,sys,tempfile,subprocess
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tests'))
from browser_case import BrowserCase
from patrol_runtime_audit import source_digest
ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'pictures/双计划实施'
REPORT=ROOT/'docs/validation/双计划实施'

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--motion-only',action='store_true');args=parser.parse_args()
    BrowserCase.setUpClass();c=BrowserCase();c.setUp();DEST.mkdir(parents=True,exist_ok=True);REPORT.mkdir(parents=True,exist_ok=True)
    try:
        p=c.page();p.set_viewport_size({'width':640,'height':360})
        p.evaluate("freshState('hard');running=false;clearIntroTimers();S.intro=0;PRO.on=false;AN.active=false;AN.next=1e8;S.tsec=700;doEnterRoom('teach1',Object.assign(ClassroomLayout.anchor(INTERIORS.teach1,ClassroomLayout.ownSeat),{seated:true}));document.getElementById('banner').style.display='none';SET.grain=0;SHAKE_ON=false;SET.soundCaptions=0;SET.vol=70")
        motion=[]
        with tempfile.TemporaryDirectory(prefix='wdfz-sensory-') as tmp:
            n=0
            for name,san,distortion in [('normal',100,2),('standard',8,2),('reduced',8,1),('off',8,0),('recovering',100,2)]:
                p.evaluate('p=>{S.san=p.san;SET.distortion=p.distortion}',dict(san=san,distortion=distortion))
                for i in range(24):
                    state=p.evaluate("()=>{VisualState.time+=.1;render(.1);return {view:Sensory.view(),body:Sensory.state().body}}")
                    p.screenshot(path=f'{tmp}/{n:04d}.jpg',type='jpeg',quality=85,timeout=60000)
                    motion.append(dict(frame=n,section=name,**state));n+=1
                print('motion '+name,flush=True)
            subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-framerate','10','-i',f'{tmp}/%04d.jpg','-an','-c:v','libx264','-crf','22','-pix_fmt','yuv420p','-movflags','+faststart',str(DEST/'感官动态对照.mp4')],check=True)
        previous=json.loads((REPORT/'感官动态与资源.json').read_text()) if args.motion_only else None
        resources=previous['resources'] if previous else []
        resource_digest=previous.get('resourcesSourceSHA256',previous['sourceSHA256']) if previous else source_digest()
        for i in range(0 if args.motion_only else 25):
            q=i%5;c.set_quality(p,q)
            p.evaluate("const s=StairWorld.point('stair_teach_w',{x:-1.25,z:3.2,h:.8});doEnterRoom(s.scene,{x:s.x,y:s.y,ang:Math.PI/2,stairHeight:s.fy});render(.016)")
            p.evaluate("doEnterRoom('teach1');Sensory.reset();SensoryScenes.cancel();SoundCaptions.reset();render(.016)")
            # Let the software GPU consume this frame before another scene rebuild.
            p.screenshot(type='jpeg',quality=30,timeout=60000)
            r=p.evaluate("()=>({quality:QUALITY,memory:GLR.renderer.info.memory,programs:GLR.renderer.info.programs.length,captions:SoundCaptions.events().length,errors:GameModules.errors()})")
            resources.append(dict(iteration=i,**r));print('resources '+str(i)+' '+json.dumps(r),flush=True)
        for q in range(5):
            a,b=resources[15+q],resources[20+q]
            assert a['memory']==b['memory'],(a,b)
            assert not b['errors'] and b['captions']==0,b
        (REPORT/'感官动态与资源.json').write_text(json.dumps(dict(kind='conditioned software WebGL; video has no audio; not a real-GPU performance benchmark',sourceSHA256=source_digest(),resourcesSourceSHA256=resource_digest,fps=10,sections='each 2.4 seconds: normal / standard low / reduced low / off low / recovering',motion=motion,resources=resources),ensure_ascii=False,indent=2)+'\n')
    finally:c.tearDown();BrowserCase.tearDownClass()
