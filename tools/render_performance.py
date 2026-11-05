"""Reproducible A/B of render work, timings and pixels; software GPU is NOT a device FPS claim.
Run: python tools/render_performance.py --output /tmp/render-performance
The baseline switches restore the pre-optimization clear/mipmap/indoor batching behavior.
"""
import argparse,json,sys,hashlib
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tests'))
from browser_case import BrowserCase

class Audit(BrowserCase):
    extra_browser_args=['--enable-unsafe-webgpu','--use-vulkan=swiftshader','--enable-features=Vulkan']

SETUP="""GameRandom.bind(RandomRules.create(1194).next);freshState('hard');running=false;clearIntroTimers();
S.intro=0;PRO.on=false;S.tsec=760;SET.grain=0;Engine.grain(0);S.bag=[];DEV.on=true;DEV.freeze=true;
window.originalSparse=Kit.prototype._mergeSparseInstances;
window.originalMipmaps=ThreeBackend.updateSceneMipmaps;
window.originalRender=GLR.renderer.render.bind(GLR.renderer);
window.originalPost=ThreeBackend.drawPost;
ThreeBackend.drawPost=function(){if(variant==='baseline')GLR.renderer.render(GLR.postScene,GLR.postCam);else originalPost()};
window.variant='optimized';
Kit.prototype._mergeSparseInstances=function(buckets){if(variant==='baseline')this.sparse=0;return originalSparse.call(this,buckets)};
ThreeBackend.updateSceneMipmaps=function(){if(variant==='baseline')GLR.rt.texture.mipmapsAutoUpdate=true;else originalMipmaps()};
GLR.renderer.render=function(scene,camera){if(variant==='baseline'&&(scene===GLR.scene||scene===GLR.handScene))this.clear();return originalRender(scene,camera)};
window.counts={mipmaps:0,passes:0};
if(GLR.renderer.backend){
 const utils=GLR.renderer.backend.textureUtils,old=utils.generateMipmaps.bind(utils);
 utils.generateMipmaps=(...args)=>{counts.mipmaps++;return old(...args)};
 const pass=GPUCommandEncoder.prototype.beginRenderPass;
 GPUCommandEncoder.prototype.beginRenderPass=function(...args){counts.passes++;return pass.apply(this,args)};
}else{const gl=GLR.renderer.getContext(),old=gl.generateMipmap.bind(gl);gl.generateMipmap=(...args)=>{counts.mipmaps++;return old(...args)}}
void 0;
"""
PREPARE="""async cfg=>{
 variant=cfg.variant;GameRandom.bind(RandomRules.create(1194).next);PresentationRandom.seed(1194);
 const old=GLR.roomMesh;if(old){GLR.scene.remove(old);ThreeBackend.disposeGroup(old);GLR.roomMesh=null;}
 sceneCacheClear();doEnterRoom('teach1',Object.assign(ClassroomLayout.anchor(INTERIORS.teach1,ClassroomLayout.ownSeat),{seated:true}));
 S.pitch=0;Engine.resetCamera();Sensory.reset();syncCamera(0);VisualState.time=12;GLR.dustT=12;
 const r=GLR.renderer;r.setRenderTarget(GLR.rt);await r.compileAsync(GLR.scene,GLR.cam);r.setRenderTarget(null);if(variant==='baseline')await r.compileAsync(GLR.postScene,GLR.postCam);else await ThreeBackend.compilePost();
 for(let i=0;i<3;i++){GLR.dustT=12;Engine.draw(0);if(r.backend)await r.backend.device.queue.onSubmittedWorkDone();else r.getContext().finish();}
} """
MEASURE="""async frames=>{
 const r=GLR.renderer,rows=[];counts={mipmaps:0,passes:0};
 for(let i=0;i<frames;i++){await new Promise(requestAnimationFrame);VisualState.time=12;GLR.dustT=12;syncCamera(0);
 const t=performance.now();Engine.draw(0);const submit=performance.now();
 if(r.backend)await r.backend.device.queue.onSubmittedWorkDone();else r.getContext().finish();
 rows.push({submitMs:submit-t,completeMs:performance.now()-t});}
 let vertices=0,meshes=0;GLR.roomMesh.traverse(o=>{if(o.isMesh){meshes++;vertices+=o.geometry.attributes.position.count}});
 return {variant,backend:Engine.status(),quality:QUALITY,counts:{...counts},metrics:Engine.metrics(),meshes,vertices,rows,
 physics:JSON.stringify([INTERIORS.teach1.foot,INTERIORS.teach1.propExtra,INTERIORS.teach1.stairExtra])};
}"""

def run(dest,frames,qualities):
    dest.mkdir(parents=True,exist_ok=True);Audit.setUpClass();case=Audit();case.setUp();rows=[]
    try:
        for pref,backend in [('webgl','webgl'),('auto','webgpu')]:
            p=case.page(renderer=pref)
            assert p.evaluate('Engine.status().backend')==backend
            p.evaluate(SETUP)
            for q in qualities:
                case.set_quality(p,q)
                for variant in ['baseline','optimized','optimized','baseline']:
                    p.evaluate(PREPARE,dict(variant=variant));row=p.evaluate(MEASURE,frames)
                    physics=row.pop('physics');row['physicsSHA256']=hashlib.sha256(physics.encode()).hexdigest()
                    image=f'{backend}-q{q}-{variant}.png';p.screenshot(path=str(dest/image));row['image']=image
                    rows.append(row)
                    print(json.dumps({k:v for k,v in row.items() if k!='rows'},ensure_ascii=False),flush=True)
                    (dest/'results.json').write_text(json.dumps({'environment':'Chromium SwiftShader software GPU; synchronized diagnostic timings; ABBA order','chromium':case.browser.version,'rows':rows},ensure_ascii=False,indent=2)+'\n')
            case.contexts[-1].close();case.contexts.pop()
        assert len({r['physicsSHA256'] for r in rows})==1,'Collision changed'
    finally:case.tearDown();Audit.tearDownClass()

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,required=True);parser.add_argument('--frames',type=int,default=12);parser.add_argument('--qualities',type=int,nargs='+',default=[0,3]);args=parser.parse_args()
    run(args.output,args.frames,args.qualities)
