"""检查静态站点的模块边界；不需要 npm、浏览器或第三方 Python 依赖。"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
# 纯模块的完整清单：新领域模块自动接受同样约束。
PURE = ('game3d/js/domain/*.js', 'game3d/js/app/input-context.js',
        'game3d/js/adapters/storage.js')
FORBIDDEN = re.compile(r'\b(?:document|window|localStorage|THREE|GLR|S|RT|AN|PAT)\s*(?:\.|\[)')
# 此表约束启动时依赖；延迟调用的旧脚本依赖由浏览器集成测试覆盖。
BEFORE = {
    'game3d/js/input.js': ['game3d/js/app/input-context.js'],
    'game3d/js/world.js': ['game3d/js/app/lifecycle.js'],
    'game3d/js/systems.js': ['game3d/js/domain/player-stats.js', 'game3d/js/domain/game-time.js'],
    'game3d/js/items.js': ['game3d/js/domain/inventory.js'],
    'game3d/js/save.js': ['game3d/js/domain/save-data.js', 'game3d/js/adapters/storage.js'],
    'game3d/js/app/session.js': ['game3d/js/app/lifecycle.js', 'game3d/js/prologue.js', 'game3d/js/save.js'],
    'game3d/js/main.js': ['game3d/js/app/session.js'],
}
# 唯一例外：新局种子与存档恢复不是 gameplay 命令，不重放奖励/死亡副作用。
RESTORE_OWNERS = {'game3d/js/app/session.js', 'game3d/js/save.js'}
STAT_WRITE = re.compile(r'\bS\.(?:san|viol|tt|stam)\s*(?:\+\+|--|[+*/%-]?=(?!=))')


def code_only(source):
    """去掉注释及字符串，避免注释示例被误认为跨层访问；不是完整 JS AST。"""
    return re.sub(r'/\*[\s\S]*?\*/|//[^\n]*|"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|`(?:\\.|[^`\\])*`',
                  ' ', source)


def entry_scripts(root):
    """实际加载顺序：index.html 直接写的脚本；遇到模块清单 game3d/manifest.js 时，按清单里各模块 files 的先后展开
    （GameModules.boot 就是按这个顺序写入 <script> 的，见 docs/模块化与Mod规范.md）。"""
    out = []
    for src in re.findall(r'<script\b[^>]*\bsrc="([^"]+)"', (root / 'index.html').read_text(encoding='utf-8')):
        if src.endswith('game3d/manifest.js') and (root / src).is_file():
            manifest = code_only_keep_strings((root / src).read_text(encoding='utf-8'))
            for files in re.findall(r'\bfiles\s*:\s*\[([^\]]*)\]', manifest):
                out.extend(a or b for a, b in re.findall(r"'([^']+)'|\"([^\"]+)\"", files))
        else:
            out.append(src)
    return out


def code_only_keep_strings(source):
    """只去掉注释（清单里的文件名在字符串里）。"""
    return re.sub(r'/\*[\s\S]*?\*/|(?<![:\'"])//[^\n]*', ' ', source)


def check(root=ROOT):
    root = Path(root)
    scripts = entry_scripts(root)
    errors = []
    for path in scripts:
        if '://' in path:
            errors.append(f'运行时依赖外部脚本: {path}')
        elif not (root / path).is_file():
            errors.append(f'入口引用不存在的脚本: {path}')
    if len(scripts) != len(set(scripts)):
        errors.append('入口重复加载脚本')
    for path in (root / 'game3d/js').rglob('*.js'):
        name = path.relative_to(root).as_posix()
        if name not in scripts:
            errors.append(f'模块未接入启动入口: {name}')
        if name not in RESTORE_OWNERS and STAT_WRITE.search(code_only(path.read_text())):
            errors.append(f'绕过 PlayerStats 直接写入玩法数值: {name}')
    for pattern in PURE:
        for path in root.glob(pattern):
            if FORBIDDEN.search(code_only(path.read_text())):
                errors.append(f'纯模块依赖浏览器、渲染或全局状态: {path.relative_to(root)}')
    for consumer, dependencies in BEFORE.items():
        for dependency in dependencies:
            if consumer not in scripts or dependency not in scripts or scripts.index(dependency) >= scripts.index(consumer):
                errors.append(f'启动依赖顺序错误: {dependency} → {consumer}')
    return errors


if __name__ == '__main__':
    failures = check()
    for failure in failures:
        print(failure)
    if failures:
        raise SystemExit(1)
    print('模块入口、启动依赖、纯规则边界与数值写入归属检查通过。')
