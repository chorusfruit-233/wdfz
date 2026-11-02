"""模块分层盘点（计划「项目解耦与模块化」M0 / M5）。

用法：
  python tools/module_audit.py               # 生成 docs/模块依赖盘点.md
  python tools/module_audit.py --baseline    # 同时重写越界基线 tests/module_boundaries.json（只在确认越界减少后用）

读 game3d/manifest.js（用 node 执行，取 GameModules.layers / define 的参数），按每层的 forbid 规则静态扫描文件：
  THREE / GLR       直接用渲染对象
  DOM               document.*（直接读写页面）
  storage           localStorage / sessionStorage
  stateWrite        直接改写权威玩家状态 S.san / S.dead / S.room …（只对表现层和内容层算越界）
注释先去掉再扫。这是静态的模式扫描，不等于完整依赖图；数字用于发现新增越界和跟踪迁移进度。
"""
from pathlib import Path
import argparse, json, re, shutil, subprocess, sys

ROOT = Path(__file__).resolve().parents[1]
RULES = {
    'THREE': re.compile(r'\bTHREE\s*\.'),
    'GLR': re.compile(r'\bGLR\s*\.'),
    'DOM': re.compile(r'\bdocument\s*\.'),
    'storage': re.compile(r'\b(?:localStorage|sessionStorage)\b'),
    'stateWrite': re.compile(r'\bS\.(?:san|dead|viol|stam|bag|hot|tsec|day|room|mode|x|y|floorY|seated|death)\s*(?:=(?!=)|\+=|-=|\+\+|--)'),
}
STATE_WRITE = re.compile(r'\bS\.([A-Za-z_]\w*)\s*(?:=(?!=)|\+=|-=|\*=|/=|\+\+|--)')
RULE_NAME = {'THREE': 'three.js 对象', 'GLR': '渲染全局 GLR', 'DOM': '页面 document', 'storage': '浏览器存储', 'stateWrite': '改写权威玩家状态'}


def manifest():
    node = shutil.which('node')
    if not node:
        raise SystemExit('需要 node')
    script = """const fs=require('fs');const out={layers:[],modules:[]};
      global.GameModules={layers:l=>{out.layers=l;},define:m=>out.modules.push(m)};
      eval(fs.readFileSync('game3d/manifest.js','utf8'));console.log(JSON.stringify(out));"""
    return json.loads(subprocess.run([node, '-e', script], cwd=ROOT, check=True, capture_output=True, text=True).stdout)


def strip(src):
    src = re.sub(r'/\*.*?\*/', '', src, flags=re.S)
    return re.sub(r'(?m)(?<![:\'"])//.*$', '', src)


def layer_of(path, layers):
    for l in layers:
        if path.startswith(l['dir']):
            return l
    return None


def scan(data=None):
    """返回 {文件: {规则: 次数}}，只列所在层禁止的规则里出现过的。"""
    data = data or manifest()
    out = {}
    for m in data['modules']:
        for f in m['files']:
            if f.startswith('game3d/lib/'):
                continue
            layer = layer_of(f, data['layers'])
            if not layer:
                out.setdefault(f, {})['noLayer'] = 1
                continue
            code = strip((ROOT / f).read_text(encoding='utf-8'))
            for rule in layer['forbid']:
                n = len(RULES[rule].findall(code))
                if n:
                    out.setdefault(f, {})[rule] = n
    return out


def state_writers(data):
    writers = {}
    for m in data['modules']:
        for f in m['files']:
            if f.startswith('game3d/lib/'):
                continue
            for field in STATE_WRITE.findall(strip((ROOT / f).read_text(encoding='utf-8'))):
                writers.setdefault(field, {}).setdefault(f, 0)
                writers[field][f] += 1
    return writers


def calls_in(path, header):
    src = strip((ROOT / path).read_text(encoding='utf-8'))
    i = src.find(header)
    if i < 0:
        return []
    depth, j, body = 0, src.index('{', i), ''
    for k in range(j, len(src)):
        ch = src[k]
        depth += ch == '{'
        depth -= ch == '}'
        if depth == 0:
            body = src[j:k]
            break
    names = re.findall(r'\b([A-Za-z_][\w.]*)\s*\(', body)
    skip = {'if', 'for', 'while', 'function', 'return', 'catch', 'switch', 'typeof'}
    seen = []
    for n in names:
        if n not in skip and n not in seen:
            seen.append(n)
    return seen


def key_routes():
    src = (ROOT / 'game3d/js/app/input.js').read_text(encoding='utf-8')
    return re.findall(r"\{id:'([\w-]+)', desc:'([^']*)'", src[src.find('var KEY_ROUTES'):])


def write_doc(data, violations):
    L = []
    L.append('# 模块依赖盘点')
    L.append('')
    L.append('> 由 `python tools/module_audit.py` 从 `game3d/manifest.js` 和源码静态扫描生成，对应计划[项目解耦与模块化](plan/项目解耦与模块化.md)的 M0 盘点与 M5 边界检查。不要手改；代码变了重新生成。')
    L.append('> 扫描先去掉注释，按模式匹配，不等于完整依赖图；「越界」是迁移待办，不代表已有运行故障。')
    L.append('')
    L.append('## 1. 分层与文件')
    L.append('')
    L.append('| 层 | 目录 | 职责 | 不许直接用 | 文件 |')
    L.append('| --- | --- | --- | --- | --- |')
    by_layer = {}
    for m in data['modules']:
        for f in m['files']:
            l = layer_of(f, data['layers'])
            by_layer.setdefault(l['id'] if l else '?', []).append(f)
    for l in data['layers']:
        files = by_layer.get(l['id'], [])
        names = '、'.join('`' + f.replace(l['dir'], '') + '`' for f in files)
        forbid = '、'.join(RULE_NAME[r] for r in l['forbid']) or '—'
        L.append(f"| {l['name']}（`{l['id']}`） | `{l['dir']}` | {l['desc']} | {forbid} | {names} |")
    L.append('')
    L.append('## 2. 越界基线（迁移待办）')
    L.append('')
    L.append('旧代码里存在的越界记在 `tests/module_boundaries.json`，`tests/test_modules.py` 检查只许减少、不许新增。新文件必须守住所在层的规则。')
    L.append('')
    L.append('| 文件 | 越界 | 次数 |')
    L.append('| --- | --- | --- |')
    for f in sorted(violations):
        for rule, n in sorted(violations[f].items()):
            L.append(f'| `{f}` | {RULE_NAME.get(rule, rule)} | {n} |')
    total = sum(sum(v.values()) for v in violations.values())
    L.append('')
    L.append(f'合计 {len(violations)} 个文件、{total} 处。')
    L.append('')
    L.append('## 3. 状态写入者（`S` 的顶层字段）')
    L.append('')
    L.append('同一字段被多个文件直接改写，就是计划 5.2 要收拢的对象。按写入文件数从多到少列前 25 个字段。')
    L.append('')
    L.append('| 字段 | 写入文件数 | 写入者（次数） |')
    L.append('| --- | --- | --- |')
    writers = state_writers(data)
    for field, files in sorted(writers.items(), key=lambda kv: (-len(kv[1]), kv[0]))[:25]:
        who = '、'.join(f"`{Path(f).parent.name}/{Path(f).name}`({n})" for f, n in sorted(files.items(), key=lambda kv: -kv[1]))
        L.append(f'| `S.{field}` | {len(files)} | {who} |')
    L.append('')
    L.append('## 4. 清理路径（各入口直接调用的函数）')
    L.append('')
    L.append('计划 A-02：每多一个系统，就要记得改这几条路径。生命周期收口以后，这些清单应当变短。')
    L.append('')
    for title, path, header in [('新局 / 继续 `freshState()`', 'game3d/js/app/main.js', 'function freshState('),
                                ('回主菜单 `Game.quit()`', 'game3d/js/app/main.js', 'quit:function('),
                                ('进房间 `doEnterRoom()`', 'game3d/js/app/world.js', 'function doEnterRoom('),
                                ('出到室外 `doExitRoom()`', 'game3d/js/app/world.js', 'function doExitRoom('),
                                ('读档 `applySave()`', 'game3d/js/adapters/save.js', 'function applySave(')]:
        calls = calls_in(path, header)
        L.append(f'- **{title}**（{len(calls)} 个）：' + '、'.join('`' + c + '`' for c in calls))
    L.append('')
    L.append('## 5. 键盘输入优先级（`KEY_ROUTES`，从上到下）')
    L.append('')
    L.append('| 顺序 | 上下文 | 说明 |')
    L.append('| --- | --- | --- |')
    for i, (rid, desc) in enumerate(key_routes(), 1):
        L.append(f'| {i} | `{rid}` | {desc} |')
    L.append('')
    L.append('触屏、鼠标点击还在各自的监听里，尚未并入同一张表。')
    L.append('')
    L.append('## 6. 钩子')
    L.append('')
    L.append('| 模块 | 层 | 发出 | 用到 |')
    L.append('| --- | --- | --- | --- |')
    for m in data['modules']:
        if not (m.get('emits') or m.get('uses')):
            continue
        layers = sorted({(layer_of(f, data['layers']) or {}).get('id', '?') for f in m['files']})
        L.append(f"| `{m['id']}` | {'、'.join(layers)} | {'、'.join('`'+h+'`' for h in m.get('emits', [])) or '—'} | {'、'.join('`'+h+'`' for h in m.get('uses', [])) or '—'} |")
    L.append('')
    (ROOT / 'docs/模块依赖盘点.md').write_text('\n'.join(L) + '\n', encoding='utf-8')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--baseline', action='store_true', help='重写 tests/module_boundaries.json')
    args = ap.parse_args()
    data = manifest()
    violations = scan(data)
    if args.baseline:
        (ROOT / 'tests/module_boundaries.json').write_text(json.dumps(violations, ensure_ascii=False, indent=1, sort_keys=True) + '\n', encoding='utf-8')
    write_doc(data, violations)
    print(f'{len(violations)} 个文件有越界，共 {sum(sum(v.values()) for v in violations.values())} 处；已写 docs/模块依赖盘点.md' + ('、tests/module_boundaries.json' if args.baseline else ''))
    return 0


if __name__ == '__main__':
    sys.exit(main())
