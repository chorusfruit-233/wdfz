"""建模开销统计：python tools/model_stats.py [输出.json]
按五档画质分别把所有房间和室外各建一遍，打印顶点、三角形、缓冲区字节数、网格数和建模耗时（中位数），
再在 10 个固定机位各画一帧（绘制次数、三角形）。实例化的网格按实例个数算顶点和三角形。
另记下模型包、贴图包的大小和每件模型各档的顶点、三角形数（没有资源包的旧版本跳过）。
环境变量 QS 指定只量哪几档，例如 QS=1,3；N 是每个场景建几遍取中位数（默认 3）；WDFZ_ROOT 换成别的检出目录（比如 main）。"""
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


def packs():
    """game3d/assets 下的模型包、贴图包的文件大小；模型包另记每一件这一档的顶点数、三角形数和是否实例化
    （直接读包里的元数据：ASSET_PACK(档, 元数据, base64)）"""
    out, models = {}, {}
    for f in sorted((ROOT / 'game3d' / 'assets').glob('*.js')):
        out[f.name] = {'bytes': f.stat().st_size}
        if not f.name.startswith('models_l'):
            continue
        src = f.read_text(encoding='utf-8')
        meta, _ = json.JSONDecoder().raw_decode(src, src.index('{', src.index('ASSET_PACK(')))
        lod = meta['lod']
        for name, a in meta['assets'].items():
            m = models.setdefault(name, {'inst': bool(a.get('i')), 'lods': {}})
            m['lods'][lod] = [sum(g[3] for g in a['g']), sum(g[5] for g in a['g']) // 3]
        out[f.name].update(lod=lod, assets=len(meta['assets']), verts=meta['nv'], tris=meta['ni'] // 3, raw=meta['raw'])
    return out, models


def mb(n):
    return f'{n / 1048576:.1f} MB'


def main():
    qs = [int(x) for x in os.environ.get('QS', '0,1,2,3,4').split(',')]
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
            res[q]['label'] = p.evaluate('Quality.get().label')
            res[q]['packs'] = p.evaluate("""typeof ASSETS==='undefined'?null:Object.keys(ASSETS.packs).map(function(l){
                var m=ASSETS.packs[l].meta; return {lod:+l,assets:Object.keys(m.assets).length,verts:m.nv,tris:m.ni/3,raw:m.raw}; })""")
            p.close()
        b.close()
    srv.shutdown()
    for q, r in res.items():
        t, o = r['total'], r['outdoor']
        print(f"画质 {q}（{r['label']}）：室内合计 网格 {t['meshes']} 顶点 {t['verts']} 三角形 {int(t['tris'])} 缓冲 {mb(t['bytes'])} 建模 {t['ms']:.0f} ms"
              f" ｜ 室外 网格 {o['meshes']} 顶点 {o['verts']} 三角形 {int(o['tris'])} 缓冲 {mb(o['bytes'])} 建模 {o['ms']:.0f} ms")
        ti, oi = t['inst'], o['inst']
        print(f"   其中实例化：室内 {ti['meshes']} 个网格 顶点 {ti['verts']} ｜ 室外 {oi['meshes']} 个网格 顶点 {oi['verts']}")
        heavy = sorted(r['rooms'].items(), key=lambda kv: -kv[1]['verts'])[:3]
        print('   顶点最多的场景：', '；'.join(f"{k} {v['verts']}（实例 {v['inst']['verts']}）" for k, v in heavy))
        print('   每帧（10 个机位）：绘制次数', [f['calls'] for f in r['frames']], ' 三角形', [f['tris'] for f in r['frames']])
    if len(sys.argv) > 1:
        files, models = packs()
        out = {'quality': res, 'files': files, 'models': models}
        Path(sys.argv[1]).write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding='utf-8')


if __name__ == '__main__':
    main()
