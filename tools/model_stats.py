"""建模开销统计：python tools/model_stats.py [输出.json]
按四档画质分别把所有房间和室外各建一遍，打印顶点、三角形、缓冲区字节数、网格数和建模耗时（中位数）。
环境变量 QS 指定只量哪几档，例如 QS=1,3。"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json, os, shutil, sys, threading
from playwright.sync_api import sync_playwright

ROOT = Path(os.environ.get('WDFZ_ROOT') or Path(__file__).resolve().parents[1])
TOOLS = Path(__file__).resolve().parent


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_a):
        pass


def main():
    qs = [int(x) for x in os.environ.get('QS', '0,1,2,3').split(',')]
    srv = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    res = {}
    with sync_playwright() as pw:
        exe = os.environ.get('CHROMIUM_EXECUTABLE') or shutil.which('chromium')
        b = pw.chromium.launch(executable_path=exe, headless=True, args=['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        for q in qs:
            p = b.new_page(viewport={'width': 640, 'height': 360})
            p.add_init_script("localStorage.setItem('wdfz_pro','1');localStorage.setItem('zw3d_set',JSON.stringify({q:%d,amb:0,vol:0,engine:'three'}))" % q)
            p.goto(f'http://127.0.0.1:{srv.server_port}/index.html')
            p.wait_for_function('typeof GLR!=="undefined"&&!!GLR.renderer')
            p.evaluate('running=false')
            p.add_script_tag(path=str(TOOLS / 'model_stats.js'))
            res[q] = p.evaluate('ModelStats.all(%s)' % os.environ.get('N', '3'))
            res[q]['frames'] = p.evaluate('ModelStats.frames()')
            p.close()
        b.close()
    srv.shutdown()
    for q, r in res.items():
        t, o = r['total'], r['outdoor']
        print(f"画质 {q}：室内合计 网格 {t['meshes']} 顶点 {t['verts']} 三角形 {int(t['tris'])} 缓冲 {t['bytes']/1048576:.1f} MB 建模 {t['ms']:.0f} ms"
              f" ｜ 室外 网格 {o['meshes']} 顶点 {o['verts']} 三角形 {int(o['tris'])} 缓冲 {o['bytes']/1048576:.1f} MB 建模 {o['ms']:.0f} ms")
        print('   每帧（8 个机位）：绘制次数', [f['calls'] for f in r['frames']], ' 三角形', [f['tris'] for f in r['frames']])
    if len(sys.argv) > 1:
        Path(sys.argv[1]).write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding='utf-8')


if __name__ == '__main__':
    main()
