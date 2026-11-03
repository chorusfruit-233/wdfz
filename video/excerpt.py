"""Extract the cyber ending from a verified full recording without changing it."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess

from playthrough import probe, validate_success


def extract_ending(directory):
    directory = Path(directory)
    run = json.loads((directory / 'run.json').read_text())
    validate_success(run)
    if run['state']['ending'] != 'cyber':
        raise ValueError('需要具有 serverCompleted 记录的网安仙人实录')
    movie = directory / 'playthrough.mp4'
    if hashlib.sha256(movie.read_bytes()).hexdigest() != run['video']['sha256']:
        raise ValueError('完整成片哈希不匹配')
    output, manifest = directory / 'ending.mp4', directory / 'ending-clip.json'
    if output.exists() or manifest.exists():
        raise ValueError('结局片段已存在，不覆盖已有文件')
    duration = run['video']['duration']
    offset = max(0, duration - run['state']['seconds'] - run.get('audio', {}).get('tail_seconds', 0))
    completed = next(e for e in run['events'] if e['kind'] == 'milestone' and e['detail'] == 'serverCompleted')
    card = next(e for e in run['events'] if e['kind'] == 'chapter' and e['detail'].startswith('真结局：'))
    # The UI callback can run after a slow scene setup; retain a few seconds
    # before the milestone so the recorded opening of the cutscene is included.
    start = max(0, completed['seconds'] + offset - 5)
    end = min(duration, card['seconds'] + offset + 8)
    if not 0 <= start < end <= duration:
        raise ValueError('结局片段时间范围无效')
    subprocess.run([
        'ffmpeg', '-nostdin', '-v', 'error', '-n', '-ss', str(start), '-i', str(movie),
        '-t', str(end - start), '-map', '0:v:0', '-map', '0:a:0',
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', str(output),
    ], check=True)
    info = probe(output)
    actual = float(info['format']['duration'])
    if abs(actual - (end - start)) > .15 or {s['codec_type'] for s in info['streams']} != {'video', 'audio'}:
        raise ValueError('结局片段的时长或音视频流不正确')
    result = {'source_video': movie.name, 'source_sha256': run['video']['sha256'],
              'source_commit': run['source_commit'], 'start_seconds': start, 'end_seconds': end,
              'duration_seconds': actual, 'sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
              'bytes': output.stat().st_size,
              'extractor_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
    manifest.write_text(json.dumps(result, ensure_ascii=False, indent=2))
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path, help='已成功录制且包含 run.json 的输出目录')
    print(json.dumps(extract_ending(parser.parse_args().directory), ensure_ascii=False, indent=2))
