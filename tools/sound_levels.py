"""音效响度校准：python tools/sound_levels.py [--check]

在无头 Chromium 里打开游戏页，用 SoundPlayer.measure 离线渲染声音库（sound-bank.js）里的每个音效
（不带校准、固定 4 个随机种子取平均），量 K 加权（60 Hz 高通 + 1.5 kHz 高架 +4 dB）的 100 毫秒最大响度，
按「类别目标 SOUND_CATS[类].target + 单个音效的 lv」算出校准值，写进：
  · game3d/js/sound-levels.js（游戏读这个）
  · docs/音效响度表.md（给人看：每个音效的原始响度、校准、校准后峰值）
--check：只核对，不写文件；响度表过期（相差超过 0.6 dB、缺项、多项）或校准后峰值高于 −1 dBFS 时返回 1。
改了配方以后跑一遍；测试 tests/test_sound_bank.py 会核对这个表是不是最新的。"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import subprocess
import argparse, json, os, re, shutil, sys, threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
LEVELS = ROOT / 'game3d/js/sound-levels.js'
TABLE = ROOT / 'docs/音效响度表.md'
SEEDS = 4
LIMIT = 30.0          # 校准最多 ±30 dB；超过说明配方本身太离谱，应该改配方
PEAK_MAX = -1.0       # 校准后峰值上限（dBFS）
TOLERANCE = 0.6


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_a):
        pass


def measure():
    srv = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as pw:
            exe = os.environ.get('CHROMIUM_EXECUTABLE') or shutil.which('chromium')
            b = pw.chromium.launch(executable_path=exe, headless=True, args=['--no-sandbox'])
            try:
                ctx = b.new_context()
                ctx.add_init_script("localStorage.setItem('wdfz_pro','1');localStorage.setItem('zw3d_set',JSON.stringify({q:0,amb:0,vol:0}))")
                p = ctx.new_page()
                p.goto(f'http://127.0.0.1:{srv.server_port}/index.html', wait_until='load')
                p.wait_for_function("typeof SoundPlayer!=='undefined'")
                p.evaluate('running=false')
                return p.evaluate("""async(seeds)=>{
                  const bad=SoundPlayer.validate(); if(bad.length) return {bad};
                  const rows=await SoundPlayer.measure(null,{seeds,raw:true});
                  const cats={}; Object.keys(SOUND_CATS).forEach(k=>cats[k]={name:SOUND_CATS[k].name,target:SOUND_CATS[k].target});
                  return {rows:rows.map(r=>Object.assign(r,{name:SoundPlayer.def(r.id).name,lv:SoundPlayer.def(r.id).lv||0})),cats,levels:SOUND_LEVELS};
                }""", SEEDS)
            finally:
                b.close()
    finally:
        srv.shutdown()


def plan(data):
    out, problems = [], []
    for r in data['rows']:
        target = data['cats'][r['cat']]['target'] + r['lv']
        corr = round(target - r['st'], 1)
        if abs(corr) > LIMIT:
            problems.append(f"{r['id']}：需要 {corr:+.1f} dB，超过 ±{LIMIT:.0f}，请直接改配方的 g")
            corr = max(-LIMIT, min(LIMIT, corr))
        peak = round(r['pk'] + corr, 1)
        if peak > PEAK_MAX:
            problems.append(f"{r['id']}：校准后峰值 {peak:.1f} dBFS，高于 {PEAK_MAX:.0f}")
        out.append(dict(r, target=target, corr=corr, peak=peak))
    return out, problems


def write(rows, cats):
    body = ',\n'.join(f"  '{r['id']}':{r['corr']:.1f}" for r in sorted(rows, key=lambda r: r['id']))
    LEVELS.write_text("/* 自动生成：python tools/sound_levels.py（不要手改）。每个音效相对配方原始响度的校准（dB），\n"
                      "   让同一类声音一样响：类别目标见 sound-bank.js 的 SOUND_CATS，单个音效再按 lv 调。 */\n"
                      "'use strict';\nvar SOUND_LEVELS={\n" + body + "\n};\n", encoding='utf-8')
    subprocess.run(['node', str(ROOT / 'tools/link_modules.cjs'), '--write'], cwd=ROOT, check=True)
    lines = ['# 音效响度表', '',
             '> 自动生成：`python tools/sound_levels.py`（不要手改）。改了 `game3d/js/sound-bank.js` 里的配方以后重跑。',
             '',
             f'测法：在无头 Chromium 里离线渲染（22050 Hz、单声道、不带混响和方位），每个音效用 {SEEDS} 个固定随机种子各渲染一次取平均；'
             '先过 K 加权的近似（60 Hz 高通 + 1.5 kHz 高架 +4 dB），再取 100 毫秒窗（每 25 毫秒滑一次）的最大有效值，单位 dBFS。'
             '「目标」= 类别目标 + 单个音效的 lv；「校准」写进 `game3d/js/sound-levels.js`，播放时乘上去。'
             f'校准后峰值不得高于 {PEAK_MAX:.0f} dBFS（游戏里还有主音量和压缩器）。',
             '', '| 类别 | 目标（dBFS） | 音效数 |', '|---|---:|---:|']
    for k, c in cats.items():
        n = sum(1 for r in rows if r['cat'] == k)
        if n:
            lines.append(f"| {c['name']}（`{k}`） | {c['target']} | {n} |")
    for k, c in cats.items():
        group = [r for r in rows if r['cat'] == k]
        if not group:
            continue
        lines += ['', f"## {c['name']}（`{k}`，目标 {c['target']} dBFS）", '',
                  '| 音效 | 说明 | 目标 | 原始 | 校准 | 校准后峰值 | 时长（秒） |', '|---|---|---:|---:|---:|---:|---:|']
        for r in sorted(group, key=lambda r: r['id']):
            lines.append(f"| `{r['id']}` | {r['name']} | {r['target']:.0f} | {r['st']:.1f} | {r['corr']:+.1f} | {r['peak']:.1f} | {r['len']:.2f} |")
    TABLE.write_text('\n'.join(lines) + '\n', encoding='utf-8')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--check', action='store_true', help='只核对，不写文件')
    args = ap.parse_args()
    data = measure()
    if data.get('bad'):
        print('配方自检没通过：\n  ' + '\n  '.join(data['bad']))
        return 1
    rows, problems = plan(data)
    if args.check:
        have = data['levels'] or {}
        stale = [r['id'] for r in rows if r['id'] not in have or abs(have[r['id']] - r['corr']) > TOLERANCE]
        extra = sorted(set(have) - {r['id'] for r in rows})
        for msg in problems:
            print(msg)
        if stale or extra:
            print('响度表过期：' + ', '.join(stale + [e + '（多余）' for e in extra]) + '\n请运行 python tools/sound_levels.py')
        return 1 if (stale or extra or problems) else 0
    write(rows, data['cats'])
    for msg in problems:
        print('注意：' + msg)
    print(f'已写入 {LEVELS.relative_to(ROOT)}、{TABLE.relative_to(ROOT)}：{len(rows)} 个音效')
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
