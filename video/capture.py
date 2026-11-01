"""Shared local-game browser setup for the trailer and gameplay recorder."""
from contextlib import contextmanager
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os
import shutil
import threading

ROOT = Path(__file__).resolve().parents[1]


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


@contextmanager
def game_server():
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f'http://127.0.0.1:{server.server_port}/index.html'
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


def launch_browser(playwright, software=True):
    args = ['--no-sandbox']
    if software:
        args += ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
    return playwright.chromium.launch(
        executable_path=os.environ.get('CHROMIUM_EXECUTABLE') or shutil.which('chromium'),
        headless=True,
        args=args,
    )
