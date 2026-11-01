"""Record an uninterrupted, input-driven playthrough. Never changes game state."""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import subprocess
import time

from playwright.sync_api import sync_playwright
from capture import ROOT, game_server, launch_browser
from example import package_example


def probe(path):
    return json.loads(subprocess.check_output([
        'ffprobe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(path),
    ], text=True))


def encode(directory, audio):
    """Keep the entire browser video at its original speed; mux actual game audio."""
    video_info = probe(directory / 'gameplay.webm')
    duration = float(video_info['format']['duration'])
    # MediaRecorder's streaming WebM omits duration; remux to a seekable container.
    subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-n', '-i', str(directory / 'game-audio.webm'),
                    '-c', 'copy', str(directory / 'game-audio.mka')], check=True)
    audio_duration = float(probe(directory / 'game-audio.mka')['format']['duration'])
    # Align the separately captured streams at recording end, accounting for the
    # short time between stopping Web Audio and closing Playwright's screencast.
    delay = max(0, duration - audio_duration - audio['tail_seconds'])
    output = directory / 'playthrough.mp4'
    subprocess.run([
        'ffmpeg', '-nostdin', '-v', 'error', '-n', '-i', str(directory / 'gameplay.webm'),
        '-i', str(directory / 'game-audio.mka'), '-map', '0:v:0', '-map', '1:a:0',
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-pix_fmt', 'yuv420p',
        '-af', f'adelay={round(delay*1000)}:all=1,apad', '-c:a', 'aac', '-b:a', '128k',
        '-t', str(duration), '-movflags', '+faststart', str(output),
    ], check=True)
    info = probe(output)
    if {s['codec_type'] for s in info['streams']} != {'audio', 'video'}:
        raise RuntimeError('成片缺少画面或游戏原声')
    return {'file': output.name, 'duration': float(info['format']['duration']),
            'bytes': output.stat().st_size, 'sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
            'audio_delay_seconds': delay, 'streams': info['streams']}


def validate_success(result):
    """Do not publish an incomplete run, a fake ending, or a debug-assisted run."""
    state, checks = result.get('state', {}), result.get('runtime_checks', {})
    if (not state.get('finished') or state.get('failed') or state.get('dead')
            or state.get('screen') != 'end' or state.get('ending') != 'car'
            or result.get('error') or result.get('page_errors')):
        raise ValueError('未完成无页面错误的汽车通关')
    if any(checks.get(k) is not False for k in ('devOpen', 'godMode', 'fastMovement')):
        raise ValueError('调试功能被启用或未能验证')
    if checks.get('searchEnabled') is not True or checks.get('cutscenesEnabled') is not True:
        raise ValueError('搜查或过场演出被跳过')
    if not any(s.get('chase') and s['chase'].get('distance', 0) > 250 for s in result.get('observations', [])):
        raise ValueError('缺少实际驾驶过程')


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--out', type=Path, default=ROOT / 'video/build/playthrough')
    ap.add_argument('--timeout', type=int, default=1200)
    ap.add_argument('--quality', type=int, choices=range(5), default=0, help='游戏内画质档位（0–4）')
    ap.add_argument('--gpu', action='store_true', help='使用浏览器默认 GPU 后端，代替软件渲染')
    ap.add_argument('--no-video', action='store_true', help='验证路线，仅生成日志和末帧')
    args = ap.parse_args()
    if args.timeout < 30:
        ap.error('--timeout 必须至少为 30 秒')
    if args.out.is_symlink() or (args.out.exists() and (not args.out.is_dir() or any(args.out.iterdir()))):
        ap.error('输出目录必须是新的或空目录，且不能是符号链接')
    args.out.mkdir(parents=True, exist_ok=True)
    errors, samples = [], []
    result = {'state': {'finished': False, 'failed': '录制尚未开始'}, 'events': [], 'page_errors': errors}
    result['source_commit'] = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    result['source_dirty'] = bool(subprocess.check_output(['git', 'status', '--porcelain'], cwd=ROOT, text=True).strip())
    result['settings'] = {'quality': args.quality, 'difficulty': 'easy', 'viewport': [960, 540],
                          'automated_inputs': True, 'reads_map_and_state': True, 'speed': 1,
                          'fresh_browser_profile': True, 'route': 'car', 'software_renderer': not args.gpu}
    for filename in ('playthrough.js', 'playthrough.py', 'game-audio.js', 'capture.py', 'example.py', 'playthrough.html'):
        result.setdefault('generator_sha256', {})[filename] = hashlib.sha256((ROOT / 'video' / filename).read_bytes()).hexdigest()
    with game_server() as url, sync_playwright() as pw:
        browser = launch_browser(pw, software=not args.gpu)
        options = {'viewport': {'width': 960, 'height': 540}, 'device_scale_factor': 1}
        if not args.no_video:
            options.update(record_video_dir=str(args.out / 'raw'), record_video_size=options['viewport'])
        context = browser.new_context(**options)
        context.add_init_script("localStorage.setItem('zw3d_set'," + json.dumps(json.dumps({'q': args.quality, 'amb': 1, 'vol': 65})) + ");")
        if not args.no_video:
            context.add_init_script(path=str(ROOT / 'video/game-audio.js'))
        page = context.new_page()
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: print(m.text, flush=True) if m.text.startswith('PILOT ') else None)
        try:
            page.goto(url, wait_until='load')
            page.wait_for_function('typeof GLR!=="undefined" && !!GLR.renderer')
            page.wait_for_timeout(2000)
            # 主菜单：预知梦 → 选天赋（与已发布录像相同的「车感好」）→ 开始；新局开场 CG 由 Pilot 用回车跳过
            page.locator('#menu .mcard').first.click()
            page.locator('#tpcards .tpcard[data-id="drive"]').click()
            page.locator('#tpGo').click()
            page.wait_for_function("S.screen==='play'||(CUT.on&&CUT.id==='opening')", timeout=60000)
            page.add_script_tag(path=str(ROOT / 'video/playthrough.js'))
            page.evaluate('Pilot.start()')
            deadline = time.monotonic() + args.timeout
            while time.monotonic() < deadline:
                page.wait_for_timeout(1000)
                state = page.evaluate('Pilot.snapshot()')
                samples.append(state)
                game_error = page.locator('#errbox')
                if game_error.count():
                    errors.append(game_error.inner_text())
                    break
                if len(samples) % 15 == 0:
                    print('状态：' + json.dumps(state, ensure_ascii=False), flush=True)
                if state['finished'] or state['failed']:
                    break
            else:
                raise TimeoutError('游玩超时')
        except Exception as error:
            result['error'] = str(error)
        finally:
            if page.evaluate('typeof Pilot!=="undefined"'):
                page.evaluate('Pilot.stop()')
                result.update(state=page.evaluate('Pilot.snapshot()'), events=page.evaluate('Pilot.log'))
                result['runtime_checks'] = page.evaluate('''() => ({
                    devOpen:DEV.on, godMode:DEV.god, fastMovement:DEV.fast,
                    searchEnabled:SEARCH.on, cutscenesEnabled:CUT.enabled,
                    timeScale:typeof GAME_TIME_SCALE==='undefined'?null:GAME_TIME_SCALE,
                    finalEnding:RT.end, carDistance:RT.carChase?.distance,
                    actualSettings:{quality:QUALITY,volume:SET.vol},
                    endingCard:document.getElementById('ends')?.innerText||null
                })''')
            page.screenshot(path=str(args.out / 'last-frame.png'))
            video = page.video
            if not args.no_video:
                audio = page.evaluate('gameAudio.stop()')
                if audio.get('base64'):
                    (args.out / 'game-audio.webm').write_bytes(base64.b64decode(audio.pop('base64')))
                result['audio'] = audio
            context.close()
            if not args.no_video:
                result['audio']['tail_seconds'] = max(0, time.time() - audio.get('end', time.time()*1000)/1000)
            if video:
                video.save_as(args.out / 'gameplay.webm')
            browser.close()
    result['observations'] = samples
    manifest = args.out / 'run.json'
    manifest.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    try:
        validate_success(result)
    except ValueError as error:
        raise SystemExit(str(error) + '；失败记录保留于 ' + str(args.out))
    if not args.no_video:
        if result['audio'].get('error'):
            raise SystemExit('原声录制失败：' + result['audio']['error'])
        result['video'] = encode(args.out, result['audio'])
        manifest.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
        package_example(args.out, result)
    print('通关成功：', args.out, flush=True)


if __name__ == '__main__':
    main()
