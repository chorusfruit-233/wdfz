"""宣传片第二版：逐帧渲染画面。

用法（在仓库根目录）：
    python video/render.py                  # 全部帧 → video/build/frames/
    python video/render.py --only d2cup     # 只渲染某几个镜头（逗号分隔，预览用）
    python video/render.py --step 6         # 每 6 帧截 1 张（中间帧照样推进，只是不截图）
    python video/render.py --jobs 2         # 按镜头分给几个浏览器并行渲染
    python video/render.py --out DIR        # 输出到新的或空的目录
    python video/render.py --step 12 --sparse   # 只推进要截图的那几帧（粗看构图用，闪电、雨这种逐帧累积的效果会不准）

游戏页面用本地 HTTP 服务打开；video/shots.js 注入页面后接管镜头，每一帧用固定步长调一次游戏自己的 render()，
再截图。和实时帧率无关，所以软件渲染也能出平滑的 24 帧。每个镜头开始时固定随机种子并重新搭场景，
所以按镜头分给几个进程并行渲染，结果和一个进程从头渲染到尾一样。
"""
from concurrent.futures import ProcessPoolExecutor
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse
import json
import os
import re
import shutil
import sys
import threading
import time

VIDEO = Path(__file__).resolve().parent
ROOT = VIDEO.parent


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def shot_ranges(sb):
    """每个镜头的 [起始帧, 结束帧)。"""
    out, t = [], 0.0
    for sh in sb['shots']:
        a, b = round(t * sb['fps']), round((t + sh['dur']) * sb['fps'])
        out.append((sh['id'], a, b))
        t += sh['dur']
    return out


def render_frames(port, sb, frames, step, out, sparse=False):
    """在一个浏览器里渲染一段连续的帧（必须从某个镜头的第一帧开始，场景才搭得对）。"""
    from playwright.sync_api import sync_playwright
    errors = []
    with sync_playwright() as pw:
        exe = os.environ.get('CHROMIUM_EXECUTABLE') or shutil.which('chromium')
        browser = pw.chromium.launch(executable_path=exe, headless=True,
                                     args=['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        page = browser.new_page(viewport={'width': sb['width'], 'height': sb['height']}, device_scale_factor=1)
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.add_init_script("localStorage.setItem('wdfz_pro','1');"
                             "localStorage.setItem('zw3d_set',JSON.stringify({q:2,amb:0,vol:0}));")
        page.goto(f'http://127.0.0.1:{port}/index.html', wait_until='load')
        page.wait_for_function('typeof GLR!=="undefined"&&!!GLR.renderer')
        page.add_script_tag(path=str(VIDEO / 'shots.js'))
        page.evaluate('sb => trailerInit(sb)', sb)
        t0 = time.time()
        a, b = frames
        page.evaluate(f'trailerWarm({a})')          # 先搭好第一个镜头、画一遍，不推进时间
        page.wait_for_timeout(200)
        for n, i in enumerate(range(a, b)):
            if (i - a) % step:
                if not sparse:
                    page.evaluate(f'trailerFrame({i})')
                continue
            page.evaluate(f'trailerFrame({i})')
            page.screenshot(path=str(Path(out) / f'{i:05d}.jpg'), type='jpeg', quality=93)
            if n % 48 == 0:
                print(f'  帧 {i}（{a}–{b - 1}）  {time.time() - t0:.0f}s', flush=True)
        browser.close()
    return errors


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', help='只渲染这些镜头（id，逗号分隔）')
    ap.add_argument('--step', type=int, default=1, help='每隔几帧截一张')
    ap.add_argument('--jobs', type=int, default=1, help='并行的浏览器个数')
    ap.add_argument('--out', help='输出到一个新的或空的目录；默认 video/build/frames')
    ap.add_argument('--sparse', action='store_true', help='跳帧预览时不推进中间帧（只看构图）')
    args = ap.parse_args()
    if args.step < 1:
        ap.error('--step 必须大于 0')
    if args.jobs < 1:
        ap.error('--jobs 必须大于 0')

    sb = json.loads((VIDEO / 'storyboard.json').read_text(encoding='utf-8'))
    ranges = shot_ranges(sb)
    only = set(args.only.split(',')) if args.only else None
    if only and only - {r[0] for r in ranges}:
        ap.error('没有镜头 ' + '、'.join(sorted(only - {r[0] for r in ranges})))
    out = Path(args.out) if args.out else VIDEO / 'build' / 'frames'
    if out.is_symlink() or (not args.out and out.parent.is_symlink()):
        ap.error('输出目录不能是符号链接')
    if out.exists() and not out.is_dir():
        ap.error('输出路径不是目录')
    if args.out and out.exists() and any(out.iterdir()):
        ap.error('自定义输出目录必须为空，以免覆盖已有文件')
    out.mkdir(parents=True, exist_ok=True)
    if not args.out:
        # 默认目录只清理本脚本生成的帧，保留其他文件
        for frame in out.iterdir():
            if frame.is_file() and re.fullmatch(r'\d{5,}\.jpg', frame.name):
                frame.unlink()

    # 要渲染的镜头 → 按帧数尽量均分给几个进程（每段都从镜头开头起算）
    todo = [r for r in ranges if not only or r[0] in only]
    jobs = min(args.jobs, len(todo))
    total = sum(b - a for _, a, b in todo)
    groups, cur, acc = [], [], 0
    for r in todo:
        if cur and cur[-1][2] != r[1]:              # 不相邻的镜头各自成段
            groups.append(cur)
            cur = []
        cur.append(r)
        acc += r[2] - r[1]
        if len(groups) < jobs - 1 and acc >= total * (len(groups) + 1) / jobs:
            groups.append(cur)
            cur = []
    if cur:
        groups.append(cur)
    # 每段是连续的镜头，合成一段连续帧；段数多于进程数时排队
    spans = [(g[0][1], g[-1][2]) for g in groups]

    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    t0 = time.time()
    errors = []
    try:
        if len(spans) == 1 or jobs == 1:
            for sp in spans:
                errors += render_frames(server.server_port, sb, sp, args.step, str(out), args.sparse)
        else:
            with ProcessPoolExecutor(jobs) as ex:
                for errs in ex.map(render_frames, [server.server_port] * len(spans), [sb] * len(spans),
                                   spans, [args.step] * len(spans), [str(out)] * len(spans), [args.sparse] * len(spans)):
                    errors += errs
    finally:
        server.shutdown()
    if errors:
        print('页面报错：', *errors[:5], sep='\n')
        sys.exit(1)
    n = sum(len(range(a, b, args.step)) for a, b in spans)
    print(f'完成：{n} 帧，{time.time() - t0:.0f} 秒')


if __name__ == '__main__':
    main()
