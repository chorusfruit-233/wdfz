"""穿模审查：python tools/clip_audit.py [房间 id …]  → 打印问题清单，并写 tools/clip_report.json"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json, os, shutil, sys, threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_a):
        pass

def main():
    rooms = sys.argv[1:]
    srv = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    with sync_playwright() as pw:
        exe = os.environ.get('CHROMIUM_EXECUTABLE') or shutil.which('chromium')
        b = pw.chromium.launch(executable_path=exe, headless=True, args=['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        p = b.new_page(viewport={'width': 640, 'height': 360})
        p.add_init_script("localStorage.setItem('wdfz_pro','1');localStorage.setItem('zw3d_set',JSON.stringify({q:%s,amb:0,vol:0}))" % os.environ.get('Q', '1'))
        p.goto(f'http://127.0.0.1:{srv.server_port}/index.html')
        p.wait_for_function('typeof GLR!=="undefined"&&!!GLR.renderer')
        p.evaluate("running=false")
        p.add_script_tag(path=str(ROOT / 'tools' / 'clip_audit.js'))
        if rooms:
            res = p.evaluate("ids=>ids.flatMap(id=>id==='out'?ClipAudit.outdoor():ClipAudit.room(id))", rooms)
        else:
            res = p.evaluate("ClipAudit.all()")
        b.close()
    srv.shutdown()
    (ROOT / 'tools' / 'clip_report.json').write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding='utf-8')
    by = {}
    for r in res:
        by.setdefault(r['type'], []).append(r)
    for t, L in by.items():
        print(f'== {t}: {len(L)}')
        for r in L[:400]:
            print('  ', r.get('room'), r.get('a'), '×', r.get('b', ''), r.get('ch', ''), r.get('depth', ''), r.get('at'))

if __name__ == '__main__':
    main()
