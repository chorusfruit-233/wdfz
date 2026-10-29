"""固定机位的 Three.js 重构前后截图与软件 WebGL 采样（不是硬件帧率承诺）。
python tools/engine_compare.py --before /path/to/old-checkout
默认只采样当前版本四档；报告输出 docs/引擎性能对照.json。
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from statistics import median
import argparse
import json
import os
import shutil
import threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass

def sample(browser, root, label, qualities, frames, pictures):
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(root)))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    rows = []
    try:
        for quality in qualities:
            context = browser.new_context(viewport={'width': 960, 'height': 540}, device_scale_factor=1)
            try:
                context.add_init_script("localStorage.setItem('wdfz_pro','1');localStorage.setItem('zw3d_set',JSON.stringify({q:%s,amb:0,vol:0}));" % quality)
                page = context.new_page()
                errors = []
                page.on('pageerror', lambda e: errors.append(str(e)))
                page.goto(f'http://127.0.0.1:{server.server_port}/', wait_until='load')
                page.evaluate('PHOTO_TRIED=true')
                page.locator('#menu .mcard').first.click()
                page.wait_for_function("S.room==='teach1'&&S.screen==='play'&&!!GLR.roomMesh&&S.ang===-Math.PI/2")
                page.evaluate("""clearIntroTimers();running=false;S.intro=0;S.san=90;
                    S.tsec=760;PAUSE.on=false;UI.closeChoice();UI.closePanelAll();
                    AN.active=false;GLR.time=12;S.dead=false;USE.torch=false;
                    document.getElementById('banner').style.opacity='0';
                    GLR.renderer.info.autoReset=false;
                    // 固定同学分布，排除程序随机人数造成的绘制量差异。
                    ncClear();NC.grp=new THREE.Group();NC.room='teach1';NC.normal=false;
                    NC.matS=new THREE.MeshBasicMaterial({color:0x080b0d,fog:true});
                    GLR.scene.add(NC.grp);let R=INTERIORS.teach1;
                    for(let row=2;row<=8;row+=2)for(let col=3;col<R.cols-2;col+=2){
                      if(R.grid[row][col]!=='d'||NC.list.length>=20)continue;
                      let p=worldToScene(R.ox+(col+.5)*R.tw,R.oy+(row+.82)*R.th,R);
                      let f=ncSeatFigure(NC.matS,p.x,0,p.z,0);NC.grp.add(f);NC.list.push(f);
                    }""")
                for scene in ('教室', '校园'):
                    if scene == '教室':
                        page.evaluate("""S.seated=true;S.x=INTERIORS.teach1.ox+48.5*9;
                            S.y=INTERIORS.teach1.oy+6.5*9;S.ang=-Math.PI/2;S.pitch=-.04;
                            S.eyeH=1.12;syncCamera(0);""")
                    else:
                        page.evaluate("""S.mode='out';S.room=null;S.seated=false;S.tsec=1080;
                            enterWorldOut();GLR.cam.position.set(66.7,2.2,133.3);
                            GLR.cam.lookAt(78,2.1,129.2);""")
                    page.evaluate('render(.016);GLR.renderer.getContext().readPixels(0,0,1,1,6408,5121,new Uint8Array(4))')
                    timings = page.evaluate("""n=>{let a=[];for(let i=0;i<n;i++){
                        GLR.renderer.info.reset();let t=performance.now();render(.016);
                        GLR.renderer.getContext().readPixels(0,0,1,1,6408,5121,new Uint8Array(4));a.push(performance.now()-t);}return a;}""", frames)
                    stats = page.evaluate("""()=>({calls:GLR.renderer.info.render.calls,
                        triangles:GLR.renderer.info.render.triangles,memory:GLR.renderer.info.memory,
                        target:[GLR.rt.width,GLR.rt.height],samples:GLR.rt.samples||0,
                        renderer:GLR.renderer.getContext().getParameter(GLR.renderer.getContext().RENDERER)})""")
                    path = pictures / f'{label}-{scene}-画质{quality}.png'
                    page.screenshot(path=str(path))
                    row = {'version': label, 'scene': scene, 'quality': quality,
                           'milliseconds': timings, 'median_ms': round(median(timings), 2),
                           'equivalent_fps': round(1000 / max(.01, median(timings)), 1), **stats}
                    rows.append(row)
                    print(json.dumps(row, ensure_ascii=False), flush=True)
                if errors:
                    raise RuntimeError('; '.join(errors))
            finally:
                context.close()
    finally:
        server.shutdown();server.server_close();thread.join()
    return rows

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--before', type=Path)
    parser.add_argument('--frames', type=int, default=5)
    args = parser.parse_args()
    if args.frames < 1:
        parser.error('--frames must be positive')
    pictures = ROOT / 'pictures' / '引擎重构'
    pictures.mkdir(parents=True, exist_ok=True)
    rows = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE') or shutil.which('chromium'),
            args=['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        try:
            if args.before:
                rows += sample(browser, args.before.resolve(), '重构前', (0, 1, 2), args.frames, pictures)
            rows += sample(browser, ROOT, '重构后', (0, 1, 2, 3), args.frames, pictures)
        finally:
            browser.close()
    report = {'viewport': [960, 540], 'dpr': 1, 'frames_per_case': args.frames,
              'method': 'Chromium SwiftShader; render + synchronous readPixels; 固定机位，冻结游戏逻辑；倒数为等效渲染帧率，非真实游玩 FPS',
              'before_root': str(args.before) if args.before else None, 'samples': rows}
    (ROOT / 'docs' / '引擎性能对照.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')

if __name__ == '__main__':
    main()
