"""Shared local-game browser setup for the trailer and gameplay recorder."""
from contextlib import contextmanager
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse
import os
import re
import shutil
import threading

ROOT = Path(__file__).resolve().parents[1]


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def send_head(self):
        # Browser video seeking needs byte ranges. SimpleHTTPRequestHandler alone
        # responds with the whole file and can silently restart playback at zero.
        path = Path(self.translate_path(self.path))
        self._remaining = None
        self._ranges_supported = path.is_file()
        header = self.headers.get('Range')
        if not header or not self._ranges_supported:
            return super().send_head()
        match = re.fullmatch(r'bytes=(\d*)-(\d*)', header.strip())
        size = path.stat().st_size
        if not match or not any(match.groups()) or size == 0:
            return self.invalid_range(size)
        first, last = match.groups()
        start = int(first) if first else max(0, size - int(last))
        end = min(size - 1, int(last)) if first and last else size - 1
        if start > end or start >= size:
            return self.invalid_range(size)
        try:
            source = path.open('rb')
        except OSError:
            self.send_error(404)
            return None
        source.seek(start)
        self._remaining = end - start + 1
        self.send_response(206)
        self.send_header('Content-Type', self.guess_type(str(path)))
        self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.send_header('Content-Length', str(self._remaining))
        self.end_headers()
        return source

    def invalid_range(self, size):
        self.send_response(416)
        self.send_header('Content-Range', f'bytes */{size}')
        self.send_header('Content-Length', '0')
        self.end_headers()
        return None

    def end_headers(self):
        if getattr(self, '_ranges_supported', False):
            self.send_header('Accept-Ranges', 'bytes')
        super().end_headers()

    def copyfile(self, source, output):
        try:
            if self._remaining is None:
                return super().copyfile(source, output)
            remaining = self._remaining
            while remaining:
                chunk = source.read(min(65536, remaining))
                if not chunk:
                    break
                output.write(chunk)
                remaining -= len(chunk)
        except (BrokenPipeError, ConnectionResetError):
            pass  # A video seek or closed page can cancel the previous response.


@contextmanager
def game_server(directory=ROOT):
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(directory)))
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


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='提供支持视频章节跳转的本地 HTTP 服务')
    parser.add_argument('--directory', type=Path, default=ROOT)
    parser.add_argument('--port', type=int, default=8000)
    options = parser.parse_args()
    server = ThreadingHTTPServer(('127.0.0.1', options.port), partial(Quiet, directory=str(options.directory.resolve())))
    print(f'http://127.0.0.1:{server.server_port}/ （Ctrl+C 停止）', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
