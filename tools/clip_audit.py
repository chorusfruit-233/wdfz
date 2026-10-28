"""穿模候选审查：python tools/clip_audit.py [房间 id …] [--out 报告路径]。"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse, json, os, shutil, sys, threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_a):
        pass

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('rooms', nargs='*', help='房间 id，out 表示室外；省略则扫描全校')
    parser.add_argument('--out', type=Path, default=ROOT / 'tools' / 'clip_report.json')
    parser.add_argument('--quality', type=int, choices=(0, 1, 2), default=os.environ.get('Q', '1'))
    args = parser.parse_args()
    srv = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
    thread = threading.Thread(target=srv.serve_forever, daemon=True)
    thread.start()
    try:
        with sync_playwright() as pw:
            exe = os.environ.get('CHROMIUM_EXECUTABLE') or shutil.which('chromium')
            b = pw.chromium.launch(executable_path=exe, headless=True, args=['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
            try:
                p = b.new_page(viewport={'width': 640, 'height': 360})
                errors = []
                p.on('pageerror', lambda e: errors.append(str(e)))
                p.add_init_script("localStorage.setItem('wdfz_pro','1');localStorage.setItem('zw3d_set',JSON.stringify({q:%s,amb:0,vol:0}))" % args.quality)
                p.goto(f'http://127.0.0.1:{srv.server_port}/index.html')
                p.wait_for_function('typeof GLR!=="undefined"&&!!GLR.renderer')
                p.evaluate("running=false")
                available = p.evaluate("Object.keys(INTERIORS).concat('out')")
                rooms = list(dict.fromkeys(args.rooms)) or available
                unknown = [r for r in rooms if r not in available]
                if unknown:
                    raise ValueError('未知房间：' + ', '.join(unknown))
                p.add_script_tag(path=str(ROOT / 'tools' / 'clip_audit.js'))
                if args.rooms:
                    res = p.evaluate("ids=>ids.flatMap(id=>id==='out'?ClipAudit.outdoor():ClipAudit.room(id))", rooms)
                else:
                    res = p.evaluate("ClipAudit.all()")
                if errors:
                    raise RuntimeError('浏览器报错：' + '; '.join(errors))
            finally:
                b.close()
    except Exception as exc:
        print(f'审查失败，未覆盖报告：{exc}', file=sys.stderr)
        return 1
    finally:
        srv.shutdown()
        srv.server_close()
        thread.join()
    by = {}
    for r in res:
        by.setdefault(r['type'], []).append(r)
    report = {'version': 1, 'scope': {'quality': args.quality, 'rooms': rooms},
              'counts': {t: len(rows) for t, rows in by.items()}, 'issues': res}
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'扫描 {len(rooms)} 个场景，画质 {args.quality}；候选 {len(res)} 条；报告：{args.out}')
    for t, L in by.items():
        print(f'== {t}: {len(L)}')
        for r in L[:400]:
            print('  ', r.get('room'), r.get('a'), '×', r.get('b', ''), r.get('ch', ''), r.get('depth', ''), r.get('at'))
    return 1 if by.get('error') else 0

if __name__ == '__main__':
    sys.exit(main())
