"""Capture real WebGL/WebGPU frames and record renderer/physics evidence; not a hardware benchmark."""
from pathlib import Path
import hashlib,json,sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tests'))
from browser_case import BrowserCase

ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'docs/validation/WebGPU接入'

def runtime_digest():
    paths=sorted((ROOT/'game3d/js').rglob('*.js'))+[ROOT/'game3d/manifest.js',ROOT/'game3d/module-contracts.js',
        ROOT/'game3d/lib/three.min.js',ROOT/'game3d/lib/three-webgpu.min.js']
    digest=hashlib.sha256()
    for p in paths:
        digest.update(str(p.relative_to(ROOT)).encode());digest.update(b'\0');digest.update(p.read_bytes())
    return digest.hexdigest()

class AuditCase(BrowserCase):
    extra_browser_args=['--enable-unsafe-webgpu','--use-vulkan=swiftshader','--enable-features=Vulkan']

if __name__=='__main__':
    DEST.mkdir(parents=True,exist_ok=True);AuditCase.setUpClass();case=AuditCase();case.setUp();rows=[]
    try:
        for requested,expected in [('webgl','webgl'),('auto','webgpu')]:
            p=case.page(renderer=requested)
            assert p.evaluate('Engine.status().backend')==expected,p.evaluate('Engine.status()')
            p.evaluate("""GameRandom.bind(RandomRules.create(1194).next);freshState('hard');running=false;
              clearIntroTimers();S.intro=0;PRO.on=false;S.tsec=760;SET.grain=0;SET.soundCaptions=2;
              S.bag=['torch'];USE.torch=true;VisualState.time=12;
              document.getElementById('banner').style.display='none';""")
            for quality in [0,4]:
                case.set_quality(p,quality)
                for scene in ['room','stairs']:
                    setup="doEnterRoom('teach1',Object.assign(ClassroomLayout.anchor(INTERIORS.teach1,ClassroomLayout.ownSeat),{seated:true}));"
                    if scene=='stairs':
                        setup="const pos=StairWorld.point('stair_teach_w',{x:-1.25,z:3.2,h:.8});doEnterRoom(pos.scene,{x:pos.x,y:pos.y,stairHeight:pos.fy,ang:Math.PI/2});"
                    p.evaluate(setup+"S.pitch=0;Sensory.reset();syncCamera(0);render(0)")
                    result=p.evaluate("""async()=>{
                      const r=GLR.renderer;
                      if(r.isWebGPURenderer)await r.backend.device.queue.onSubmittedWorkDone();
                      const R=INTERIORS[S.room];SpaceLayout.ensureRoom(R);
                      return {backend:Engine.status(),quality:QUALITY,scene:S.room,metrics:Engine.metrics(),
                        camera:{x:GLR.cam.position.x,y:GLR.cam.position.y,z:GLR.cam.position.z,fov:GLR.cam.fov},
                        physics:JSON.stringify([R.foot,R.propExtra,R.stairExtra]),
                        target:[GLR.rt.width,GLR.rt.height],samples:GLR.rt.samples,ao:GLR.postMat.uniforms.uAO.value,
                        hands:GLR.postMat.uniforms.uHands.value,errors:GameModules.errors(),lifecycle:Lifecycle.snapshot().errors};
                    }""")
                    assert result['backend']['backend']==expected and not result['errors'] and not result['lifecycle'],result
                    physics=result.pop('physics');result['physicsSHA256']=hashlib.sha256(physics.encode()).hexdigest()
                    filename=f'{expected}-q{quality}-{scene}.png';p.screenshot(path=str(DEST/filename),timeout=60000)
                    result['image']=filename;rows.append(result);print(json.dumps(result,ensure_ascii=False),flush=True)
            case.contexts[-1].close();case.contexts.pop()
        for scene in ['teach1','stair_teach_w']:
            assert len({r['physicsSHA256'] for r in rows if r['scene']==scene})==1,scene
        report={'kind':'conditioned software GPU render capture, not natural gameplay or a hardware performance benchmark',
            'sourceSHA256':runtime_digest(),'chromium':case.browser.version,'flags':AuditCase.extra_browser_args,'captures':rows}
        (DEST/'画面与后端.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    finally:
        case.tearDown();AuditCase.tearDownClass()
