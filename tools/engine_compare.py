"""两个渲染后端画同一个画面并对比：python tools/engine_compare.py 输出目录 [机位 …]
机位写法同 clip_view.py：房间:x:y:z:距离:朝向（房间 out 表示室外）。
每个机位出两张图（_three / _babylon），打印两边的平均亮度和每帧耗时（软件渲染下只能比相对快慢）。"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json, os, shutil, sys, threading, time
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
DEFAULT = ['game', 'teach2:-20.5:0.9:-4.2:3.2:0.4', 'out:124.667:2.5:213:13:1.45', 'admin1:-10:1.0:4:3:0.8', 'garage1:6:1.0:-4:4:0.5']


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_a):
        pass


def main():
    out = Path(sys.argv[1] if len(sys.argv) > 1 else 'engine_compare'); out.mkdir(parents=True, exist_ok=True)
    views = sys.argv[2:] or DEFAULT
    srv = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    rows = []
    with sync_playwright() as pw:
        exe = os.environ.get('CHROMIUM_EXECUTABLE') or shutil.which('chromium')
        b = pw.chromium.launch(executable_path=exe, headless=True, args=['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        p = b.new_page(viewport={'width': 800, 'height': 450})
        p.on('console', lambda m: m.type in ('error', 'warning') and 'deprecat' not in m.text and print('  [console]', m.text[:200]))
        p.on('response', lambda r: r.status >= 400 and print('  [404]', r.url))
        p.add_init_script("localStorage.setItem('wdfz_pro','1');localStorage.setItem('zw3d_set',JSON.stringify({q:%s,amb:0,vol:0,engine:'three'}))" % os.environ.get('Q', '3'))
        p.goto(f'http://127.0.0.1:{srv.server_port}/index.html')
        p.wait_for_function('typeof GLR!=="undefined"&&!!GLR.renderer')
        p.evaluate("Game.start('easy')")
        time.sleep(1.2)
        p.evaluate("clearIntroTimers();running=false;S.screen='play';document.getElementById('hud').style.display='none';"
                   "var st=document.createElement('style');st.textContent='#sub,#banner,.screen-control,#toast,#lookhint,#menu,#touch,#hud,#tip,#ehint,#status,#hot,#mini,.keys{display:none!important}';"
                   "document.head.appendChild(st);AN.next=1e9;PAT.next=1e9;S.tsec=%s;" % os.environ.get('TSEC', '760'))
        for i, spec in enumerate(views):
            if spec == 'game':                             # 不挪镜头：开局坐在自己座位上的那个画面
                room, x, y, z, dist, yaw = 'game', 0, 0, 0, 0, 0
            else:
                f = spec.split(':'); room = f[0]; x, y, z = map(float, f[1:4])
                dist = float(f[4]) if len(f) > 4 else 3.0; yaw = float(f[5]) if len(f) > 5 else 0.7
            for eng in ('three', 'babylon'):
                p.evaluate("e=>{SET.engine=e;GFX.select();}", eng)
                if eng == 'babylon':
                    p.wait_for_function("GFX.name()==='babylon'||!!GFX.failed.babylon", timeout=120000)
                    fail = p.evaluate("GFX.failed.babylon||''")
                    if fail:
                        print('Babylon 不可用：', fail); b.close(); srv.shutdown(); sys.exit(1)
                ms = p.evaluate("""([room,x,y,z,dist,yaw])=>{
                  if(room==='game'){ syncCamera(0); }
                  else{
                    if(room==='out'){ if(S.mode!=='out'||!GLR.outMesh){ S.mode='out';S.room=null;enterWorldOut(); } }
                    else if(S.room!==room||S.mode!=='in'){ S.mode='in';S.room=room;doEnterRoom(room);running=false; }
                    var c=GLR.cam; c.position.set(x+Math.cos(yaw)*dist,y+dist*0.25,z+Math.sin(yaw)*dist); c.lookAt(x,y,z);
                    c.fov=72; c.updateProjectionMatrix(); c.updateMatrixWorld();
                  }
                  S.tsec=%s; updateLighting();
                  render(0.016); render(0.016);
                  var t0=performance.now(), n=4; for(var k=0;k<n;k++) render(0.016);
                  return (performance.now()-t0)/n;
                }""" % os.environ.get('TSEC', '760'), [room, x, y, z, dist, yaw])
                if eng == 'babylon':
                    for _ in range(80):                    # Babylon 异步编译着色器：等它准备好
                        print("   等待", _, flush=True) if _ % 10 == 9 else None
                        if p.evaluate("render(0.016);GFX.cur.isReady&&GFX.cur.isReady()"): break
                        time.sleep(0.25)
                    p.evaluate("render(0.016);render(0.016)")
                time.sleep(0.3)
                path = out / f'{i:02d}_{room}_{eng}.png'
                p.screenshot(path=str(path))
                rows.append({'view': spec, 'engine': eng, 'ms': round(ms, 1), 'png': str(path)})
        b.close()
    srv.shutdown()
    try:
        from PIL import Image, ImageStat
        for r in rows:
            im = Image.open(r['png']).convert('L'); r['luma'] = round(ImageStat.Stat(im).mean[0], 1)
    except Exception as e:
        print('（没有 PIL，不算亮度）', e)
    for r in rows:
        print(f"{r['view']:<36} {r['engine']:<8} 每帧 {r['ms']:>7} ms  平均亮度 {r.get('luma', '-')}")
    (out / 'compare.json').write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding='utf-8')


if __name__ == '__main__':
    main()
