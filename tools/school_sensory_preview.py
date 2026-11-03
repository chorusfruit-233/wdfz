"""Conditioned screenshots of both plans; software WebGL, not a playthrough or GPU benchmark."""
from pathlib import Path
import sys,json,argparse
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tests'))
from browser_case import BrowserCase
ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'pictures/双计划实施'

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--only',help='Only refresh this image filename');args=parser.parse_args()
    DEST.mkdir(parents=True,exist_ok=True)
    BrowserCase.setUpClass();case=BrowserCase();case.setUp();report=[]
    try:
        p=case.page()
        p.evaluate("freshState('hard');running=false;S.intro=0;PRO.on=false;S.tsec=700;AN.next=1e8;AN.active=false;S.san=100;SET.soundCaptions=1;clearIntroTimers()")
        def shot(name,setup):
            if args.only and name!=args.only:return
            state=p.evaluate("""code=>{eval(code);clearIntroTimers();document.getElementById('banner').style.display='none';
              SoundCaptions.reset();syncCamera(0);updateHUD();for(let i=0;i<30;i++)Sensory.frame(.1);render(.016);
              return {scene:S.room,x:S.x,y:S.y,fy:S.floorY,ang:S.ang,pitch:S.pitch,san:S.san,quality:QUALITY,
                view:Sensory.view(),torch:USE.torch,resources:GLR.renderer.info.memory,errors:GameModules.errors()};}""",setup)
            p.screenshot(path=str(DEST/name),timeout=120000);report.append(dict(file=name,**state));print(name,flush=True)
        shot('教室前后门.png',"const R=INTERIORS.teach1;doEnterRoom('teach1',{x:R.ox+48.5*9,y:R.oy+19.8*9,ang:-Math.PI/2});S.pitch=0;S.bag=['torch'];USE.torch=true;syncUseState()")
        shot('本人座位面向黑板.png',"S.bag=[];USE.torch=false;syncUseState();doEnterRoom('teach1',Object.assign(ClassroomLayout.anchor(INTERIORS.teach1,ClassroomLayout.ownSeat),{seated:true}));S.pitch=0")
        for san in [100,45,22,8]:
            shot('感官-'+str(san)+'.png',f"S.san={san};SET.distortion=2;Sensory.reset();")
        shot('关闭扭曲.png',"SET.distortion=0")
        shot('真实楼梯下跑.png',"S.san=100;SET.distortion=2;Sensory.reset();let q=StairWorld.point('stair_teach_w',{x:-1.25,z:0,h:0});doEnterRoom(q.scene,{x:q.x,y:q.y,ang:Math.PI/2,stairHeight:0});S.pitch=.15")
        shot('真实楼梯半层平台.png',"let q=StairWorld.point('stair_teach_w',{x:-1.25,z:6.3,h:1.6});doEnterRoom(q.scene,{x:q.x,y:q.y,ang:0,stairHeight:q.fy});S.pitch=0")
        shot('二楼出口连续视野.png',"let q=StairWorld.point('stair_teach_w',{x:0,z:-.3,h:3.2});doEnterRoom(q.scene,{x:q.x,y:q.y,ang:-Math.PI/2,stairHeight:q.fy});S.pitch=0")
        shot('车库楼梯校园出口.png',"let q=StairWorld.point('stair_garage',{x:0,z:-.3,h:3.2});doEnterRoom(q.scene,{x:q.x,y:q.y,ang:-Math.PI/2,stairHeight:q.fy});S.pitch=0")
        touch_page=None
        for w,h in [(320,640),(390,844),(844,390)]:
            name=f'触屏字幕-{w}x{h}.png'
            if args.only and name!=args.only:continue
            if touch_page is None:
                touch_page=case.page(touch=True);p=touch_page
            p.evaluate("freshState('hard');running=false;clearIntroTimers();S.intro=0;PRO.on=false;S.tsec=700;AN.next=1e8;AN.active=false;SET.soundCaptions=1;document.getElementById('banner').style.display='none'")
            p.set_viewport_size({'width':w,'height':h})
            p.evaluate("doEnterRoom('teach1',Object.assign(ClassroomLayout.anchor(INTERIORS.teach1,ClassroomLayout.ownSeat),{seated:true}));S.talent='none';running=false;useTouchInput();updateTouchUI();Settings.comfort('textSize',150);SoundCaptions.reset();SFX.dread('knock',{pan:-.7,behind:true,m:12,muffled:true});SFX.thunder&&SFX.thunder();updateHUD()")
            p.evaluate("async()=>{await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));syncCamera(0);render(.016);}")
            p.screenshot(path=str(DEST/name),timeout=120000);report.append({'file':name,'viewport':[w,h],'textSize':150,'volume':0,'touchContext':True})
        if args.only:
            old=json.loads((DEST/'画面记录.json').read_text());report=[r for r in old if r['file']!=args.only]+report
        (DEST/'画面记录.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    finally:
        case.tearDown();BrowserCase.tearDownClass()
