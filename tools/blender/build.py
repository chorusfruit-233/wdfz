"""生成游戏用的模型资源包。

  python tools/blender/build.py                 # 全部资产、四个档位
  python tools/blender/build.py --only desk,chair --lods 0,2

需要 Blender 的 Python 模块：pip install bpy==5.2.3（只支持 Python 3.13）。
每件资产按档位缓存在 tools/blender/.cache/（建模脚本或建模库改了才重建）；输出 game3d/assets/models_l<档>.js。"""
import argparse
import hashlib
import importlib
import inspect
import json
import os
import pickle
import sys
import time
import traceback

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)

import bpy  # noqa: E402

from wdfz import Asset, REGISTRY, ORDER  # noqa: E402
from wdfz import export as EX  # noqa: E402
from wdfz.pack import PackWriter  # noqa: E402

OUT = os.path.join(ROOT, 'game3d', 'assets')
CACHE = os.path.join(HERE, '.cache')
AO_SAMPLES = (96, 64, 40, 24)


def lib_hash():
    """建模库的指纹：改了建模、导出相关的代码才需要整批重建（打包格式 pack.py 不算）。"""
    h = hashlib.sha1()
    for fn in sorted(os.listdir(os.path.join(HERE, 'wdfz'))):
        if fn.endswith('.py') and fn != 'pack.py':
            with open(os.path.join(HERE, 'wdfz', fn), 'rb') as f:
                h.update(f.read())
    return h.hexdigest()


def load_modules():
    mods = {}
    adir = os.path.join(HERE, 'assets')
    for fn in sorted(os.listdir(adir)):
        if fn.endswith('.py') and not fn.startswith('_'):
            name = 'assets.' + fn[:-3]
            mods[name] = importlib.import_module(name)
    return mods


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def build_one(name, L):
    fn, spec = REGISTRY[name]
    A = Asset(name, L, spec)
    fn(A)
    EX.evaluate(A)
    EX.bake_ao(A, samples=AO_SAMPLES[L], dist=spec.get('ao', 0.35))
    groups = EX.extract(A)
    res = {'groups': groups, 'proxies': A.proxies, 'anchors': A.anchors, 'tints': spec.get('tints'), 'extra': A.meta or None}
    A.cleanup()
    for coll in (bpy.data.meshes, bpy.data.curves, bpy.data.materials):
        for d in list(coll):
            if d.users == 0:
                coll.remove(d)
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', default='')
    ap.add_argument('--lods', default='0,1,2,3')
    ap.add_argument('--force', action='store_true')
    args = ap.parse_args()
    reset()
    mods = load_modules()
    lh = lib_hash()
    only = set(x for x in args.only.split(',') if x)
    lods = [int(x) for x in args.lods.split(',')]
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(CACHE, exist_ok=True)
    src_hash = {}
    for name in ORDER:
        fn, _spec = REGISTRY[name]
        mod = inspect.getmodule(fn)
        if mod.__name__ not in src_hash:
            with open(mod.__file__, 'rb') as f:
                src_hash[mod.__name__] = hashlib.sha1(f.read()).hexdigest()
    t0 = time.time()
    fails = []
    proxies0 = {}       # 碰撞代理一律用最细的一档：换画质时占地、碰撞完全一样

    def canon_proxies(name, res):
        if name not in proxies0:
            L0 = min(REGISTRY[name][1].get('lods', (0, 1, 2, 3)))
            cpath = os.path.join(CACHE, '%s.L%d.pkl' % (name, L0))
            if os.path.exists(cpath):
                with open(cpath, 'rb') as f:
                    proxies0[name] = pickle.load(f)[1]['proxies']
        return proxies0.get(name, res['proxies'])

    for L in lods:
        pw = PackWriter(L)
        built = 0
        for name in ORDER:
            fn, spec = REGISTRY[name]
            if L not in spec.get('lods', (0, 1, 2, 3)):
                continue
            key = hashlib.sha1((lh + src_hash[inspect.getmodule(fn).__name__] + name + str(L)).encode()).hexdigest()[:16]
            cpath = os.path.join(CACHE, '%s.L%d.pkl' % (name, L))
            res = None
            if not args.force and os.path.exists(cpath) and (not only or name not in only):
                with open(cpath, 'rb') as f:
                    k, r = pickle.load(f)
                if k == key:
                    res = r
            if res is None:
                if only and name not in only and os.path.exists(cpath):
                    with open(cpath, 'rb') as f:
                        res = pickle.load(f)[1]
                else:
                    t = time.time()
                    try:
                        res = build_one(name, L)
                    except Exception:
                        traceback.print_exc()
                        fails.append((name, L))
                        reset()
                        continue
                    with open(cpath, 'wb') as f:
                        pickle.dump((key, res), f)
                    nv = sum(len(g['P']) for g in res['groups'])
                    nt = sum(len(g['I']) for g in res['groups']) // 3
                    print('  L%d %-24s %7d 顶点 %7d 三角形 %5.1fs' % (L, name, nv, nt, time.time() - t), flush=True)
                    built += 1
            if L == min(spec.get('lods', (0, 1, 2, 3))):
                proxies0[name] = res['proxies']
            pw.add(name, res['groups'], canon_proxies(name, res), res['anchors'], res['tints'], res['extra'], spec.get('inst', False))
        path = os.path.join(OUT, 'models_l%d.js' % L)
        nb, nj = pw.write(path, bpy.app.version_string)
        print('L%d：%d 件，新建 %d，顶点 %d，三角形 %d，二进制 %.1f KB，文件 %.1f KB' % (L, len(pw.meta), built, pw.nv, pw.ni // 3, nb / 1024, nj / 1024), flush=True)
    print('用时 %.1fs' % (time.time() - t0))
    if fails:
        print('失败：', fails)
        sys.exit(1)


if __name__ == '__main__':
    main()
