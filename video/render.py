"""逐帧渲染宣传片画面。

用法（在仓库根目录）：
    python video/render.py                # 渲染全部帧到 video/build/frames/
    python video/render.py --only cup     # 只渲染某个镜头（预览用）
    python video/render.py --step 6       # 每 6 帧取 1 帧（快速预览）

游戏页面用本地 HTTP 服务打开；video/trailer.js 注入页面后接管镜头，
每一帧用固定步长调一次游戏自己的 render()，再截图。和实时帧率无关，所以软件渲染也能出平滑的 24 帧。
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse
import json
import os
import shutil
import sys
import threading
import time

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
VIDEO = ROOT / 'video'


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', help='只渲染这个镜头 id')
    ap.add_argument('--step', type=int, default=1, help='每隔几帧取一帧')
    ap.add_argument('--out', default=str(VIDEO / 'build' / 'frames'))
    args = ap.parse_args()

    tl = json.loads((VIDEO / 'timeline.json').read_text(encoding='utf-8'))
    out = Path(args.out)
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)

    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f'http://127.0.0.1:{server.server_port}/index.html'

    with sync_playwright() as pw:
        exe = os.environ.get('CHROMIUM_EXECUTABLE') or shutil.which('chromium')
        browser = pw.chromium.launch(executable_path=exe, headless=True,
                                     args=['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        page = browser.new_page(viewport={'width': tl['width'], 'height': tl['height']}, device_scale_factor=1)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.add_init_script("localStorage.setItem('wdfz_pro','1');"
                             "localStorage.setItem('zw3d_set',JSON.stringify({q:2,amb:0,vol:0}));")
        page.goto(url, wait_until='load')
        page.wait_for_function('typeof GLR!=="undefined"&&!!GLR.renderer')
        page.add_script_tag(path=str(VIDEO / 'trailer.js'))
        total = page.evaluate('tl => trailerInit(tl)', tl)

        frames = range(0, total, args.step)
        if args.only:
            start = 0.0
            for sh in tl['shots']:
                if sh['id'] == args.only:
                    break
                start += sh['dur']
            else:
                sys.exit(f'没有镜头 {args.only}')
            a = round(start * tl['fps'])
            frames = range(a, a + round(sh['dur'] * tl['fps']), args.step)

        t0 = time.time()
        # 跳帧预览时，中间的帧也要走一遍（闪电衰减、眼睛一只只睁开都是逐帧累积的），只是不截图
        a, b = frames[0], frames[-1] + 1
        for n, i in enumerate(range(a, b)):
            page.evaluate(f'trailerFrame({i})')
            if (i - a) % args.step:
                continue
            page.screenshot(path=str(out / f'{i:05d}.jpg'), type='jpeg', quality=93)
            if n % 48 == 0:
                print(f'frame {i}/{total}  {time.time() - t0:.0f}s', flush=True)
        browser.close()
    server.shutdown()
    if errors:
        print('页面报错：', *errors[:5], sep='\n')
    print('done', len(frames), 'frames')


if __name__ == '__main__':
    main()
