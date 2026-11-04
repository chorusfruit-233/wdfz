"""Controlled PR #41 screenshots of the real cabin controls, with rendering/state evidence."""
from pathlib import Path
import hashlib
import json
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tests'))
from test_elevator_review import ElevatorReviewTest


class CaptureCase(ElevatorReviewTest):
    renderer='webgl'
    extra_browser_args=['--enable-unsafe-webgpu','--use-vulkan=swiftshader','--enable-features=Vulkan']

    def page(self,*args,**kwargs):
        kwargs['renderer']=self.renderer
        return super().page(*args,**kwargs)


def fingerprint():
    digest=hashlib.sha256()
    paths=sorted((ROOT/'game3d/js').rglob('*.js'))+sorted((ROOT/'game3d/css').glob('*.css'))
    for p in paths+[ROOT/'game3d/manifest.js',ROOT/'game3d/module-contracts.js']:
        digest.update(str(p.relative_to(ROOT)).encode());digest.update(b'\0');digest.update(p.read_bytes())
    return digest.hexdigest()


if __name__=='__main__':
    dest=ROOT/'pictures/电梯直通';dest.mkdir(parents=True,exist_ok=True)
    CaptureCase.setUpClass();case=CaptureCase();case.setUp();captures=[]
    try:
        for name,width,height,touch,renderer in [
            ('复核-01-桌面关门快捷键',1000,700,False,'webgl'),
            ('复核-02-触屏竖屏关门',390,844,True,'webgl'),
            ('复核-03-触屏横屏关门',844,390,True,'webgl'),
            ('复核-04-WebGPU触屏关门中',390,844,True,'auto'),
        ]:
            case.renderer=renderer;page=case.game(touch=touch);page.set_viewport_size(dict(width=width,height=height))
            case.prepare(page);page.evaluate("faceOut(INTERIORS[S.room]);Engine.grain(0);syncCamera(0);render(0)")
            if renderer=='auto':page.locator('#lift-close').tap();page.evaluate('Elevator.tick(.5);render(0)')
            page.evaluate('async()=>{if(GLR.renderer.isWebGPURenderer)await GLR.renderer.backend.device.queue.onSubmittedWorkDone()}')
            row=page.evaluate("""()=>({renderer:Engine.status(),quality:QUALITY,room:S.room,
              position:[S.x,S.y],angle:S.ang,pitch:S.pitch,door:Elevator.doorAmount('teach',2),
              choice:UI.chooseOpen,buttonVisible:!ElevatorUI.node.hidden,depth:Collision.depth(S.x,S.y,PRAD),
              moduleErrors:GameModules.errors(),lifecycleErrors:Lifecycle.snapshot().errors})""")
            assert row['renderer']['backend']==('webgpu' if renderer=='auto' else 'webgl'),row
            assert row['buttonVisible'] and not row['choice'] and row['depth']<1e-7,row
            assert not row['moduleErrors'] and not row['lifecycleErrors'],row
            row.update(image=name+'.png',viewport=[width,height]);page.screenshot(path=str(dest/row['image']))
            captures.append(row);print(json.dumps(row,ensure_ascii=False),flush=True)
            case.contexts[-1].close();case.contexts.pop()
        (dest/'复核-截图与状态.json').write_text(json.dumps(dict(
            kind='Controlled screenshots of actual runtime, software GPU; not natural gameplay or physical-device verification',
            runtimeSHA256=fingerprint(),chromium=case.browser.version,captures=captures),ensure_ascii=False,indent=2)+'\n')
    finally:
        case.tearDown();CaptureCase.tearDownClass()
