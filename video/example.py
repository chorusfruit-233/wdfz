"""Package a verified run with its player, chapter links, poster and audit log."""
import gzip
import hashlib
import json
from pathlib import Path
import shutil
import subprocess


def package_example(directory, result):
    directory = Path(directory)
    movie = directory / 'playthrough.mp4'
    if hashlib.sha256(movie.read_bytes()).hexdigest() != result['video']['sha256']:
        raise ValueError('成片与录制记录中的 SHA-256 不一致')
    names = ['index.html', 'playthrough-summary.json', 'playthrough-run.json.gz', 'playthrough-poster.jpg']
    if any((directory / name).exists() for name in names):
        raise ValueError('观看页面已存在，请使用新的输出目录')
    duration = result['video']['duration']
    # Chapters are navigation aids, rounded to seconds. Account for the menu and
    # browser startup before the pilot's relative clock starts.
    offset = max(0, duration - result['state']['seconds'] - result.get('audio', {}).get('tail_seconds', 0))
    chapters = [{'seconds': 0, 'title': '主菜单 · 全新开局'}]
    for e in result['events']:
        if e['kind'] == 'chapter':
            chapters.append({'seconds': min(duration, round(offset + e['seconds'])), 'title': e['detail']})
    summary = {'duration': duration, 'source_commit': result['source_commit'],
               'sha256': result['video']['sha256'], 'bytes': result['video']['bytes'],
               'ending': result['state']['ending'], 'talent': result['state']['talent'],
               'chapters': chapters}
    poster_time = next((c['seconds'] for c in chapters if c['title'] == '自己的课桌与讲台移交单'), 0)
    subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-n', '-ss', str(poster_time + 1),
                    '-i', str(movie), '-frames:v', '1', '-q:v', '3',
                    str(directory / 'playthrough-poster.jpg')], check=True)
    (directory / 'playthrough-summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding='utf-8')
    # mtime=0 keeps the compressed trace stable across copies of the same run.
    trace = json.dumps(result, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    (directory / 'playthrough-run.json.gz').write_bytes(gzip.compress(trace, mtime=0))
    shutil.copyfile(Path(__file__).with_name('playthrough.html'), directory / 'index.html')
    return summary
