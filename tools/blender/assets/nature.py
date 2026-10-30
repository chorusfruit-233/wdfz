"""树、灌木、绿篱。树按树种生成枝干骨架（树干、主枝、二级枝，梢头朝上弯），枝梢挂叶片卡；
叶片卡用游戏里那张「一簇叶子」的镂空贴图（foliage），每张卡两面都画，法线从树冠中心往外指（整团树冠受光连贯）。
流畅档没有叶片卡，用几团椭球（leaf 材质）。原点在树根的地面上。"""
import math
import random

import bmesh
import bpy
from mathutils import Vector, Matrix

from wdfz import asset, V

BARK = 0x4a3c2e


def leaf_cards(A, cards, center, col, shade=1.0, tag='f', name='leaves'):
    """cards：[(中心, 半边长, 朝向矩阵 3×3)]。每张一个正方形，两面；法线 = 顶点相对树冠中心的方向（竖向压扁一点）。"""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new('UVMap')
    nrm = []
    c0 = A.T @ V(center)
    UV = ((0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0))
    for (c, h, R) in cards:
        c = V(c)
        loc = [c + R @ Vector((-h, -h, 0)), c + R @ Vector((h, -h, 0)), c + R @ Vector((h, h, 0)), c + R @ Vector((-h, h, 0))]
        vs = [bm.verts.new(A.T @ p) for p in loc]
        vb = [bm.verts.new(A.T @ p) for p in loc]          # 背面另起一套顶点（bmesh 不让两个面共用同一组点），导出时会合回去
        for v in vs + vb:
            d = v.co - c0
            d = Vector((d.x, d.y * 1.3, d.z))
            nrm.append(d.normalized() if d.length > 1e-6 else Vector((0, 1, 0)))
        f1 = bm.faces.new(vs)
        f2 = bm.faces.new(list(reversed(vb)))
        for lp, uv in zip(f1.loops, UV):
            lp[uvl].uv = uv
        for lp, uv in zip(f2.loops, reversed(UV)):
            lp[uvl].uv = uv
    for f in bm.faces:
        f.smooth = True
    bm.to_mesh(me)
    bm.free()
    me.normals_split_custom_set_from_vertices(nrm)
    ob = A._obj(name, me)
    return A._add(ob, 'foliage', col, shade, tag, 'mesh', 0.8, name)


def card_frame(rnd, tilt=0.6):
    """一张叶片卡的朝向：随便转个方向，稍微往上仰。"""
    yaw = rnd.random() * 2 * math.pi
    pitch = (rnd.random() - 0.5) * tilt * 2
    roll = (rnd.random() - 0.5) * 0.8
    return (Matrix.Rotation(yaw, 3, 'Y') @ Matrix.Rotation(pitch, 3, 'X') @ Matrix.Rotation(roll, 3, 'Z'))


SPECIES = {
    # 香樟：矮干、四五根往外摊的主枝、圆而密的冠
    'camphor': dict(trunk=2.1, r0=0.21, mains=(5, 6), spread=(0.85, 1.2), mlen=(2.4, 3.0), bend=0.34, kids=3, klen=0.55, depth=2,
                    leaf=1.35, per=3, col=0x2f5530, core=0x1e3420, bark=0x4a3c2e),
    # 法国梧桐：高干分三杈，树冠大而疏，叶子浅
    'plane': dict(trunk=2.9, r0=0.24, mains=(3, 4), spread=(0.6, 0.95), mlen=(3.2, 4.0), bend=0.26, kids=3, klen=0.55, depth=2,
                  leaf=1.5, per=3, col=0x4d6a36, core=0x2c3e22, bark=0x8a8270),
    # 银杏：主枝往上斜着长，冠疏，十月底叶子黄了
    'ginkgo': dict(trunk=2.4, r0=0.18, mains=(4, 5), spread=(0.45, 0.75), mlen=(2.8, 3.6), bend=0.2, kids=2, klen=0.55, depth=2,
                   leaf=1.15, per=3, col=0xb09a3a, core=0x5a5020, bark=0x5a4c3c),
}


def grow(A, rnd, sp):
    """生成枝干（直接建几何）并返回枝梢点。"""
    P = SPECIES[sp]
    tips = []
    seg_t = (12, 9, 7, 5)[A.L]
    seg_b = (8, 6, 5, 4)[A.L]
    H = P['trunk'] * (0.9 + 0.2 * rnd.random())
    lean = Vector(((rnd.random() - 0.5) * 0.4, 0, (rnd.random() - 0.5) * 0.4))
    path = [Vector((0, 0, 0)), Vector((0, H * 0.35, 0)) + lean * 0.2, Vector((0, H * 0.7, 0)) + lean * 0.6, Vector((0, H, 0)) + lean]
    r0 = P['r0']
    A.sweep('bark', path, [(r0 * 1.35, r0 * 1.35), (r0, r0), (r0 * 0.9, r0 * 0.9), (r0 * 0.8, r0 * 0.8)], P['bark'], 1.0, n=seg_t, cap0=False, cap1=True, name='trunk')
    # 根部的鼓包
    if A.L <= 1:
        for k in range(5):
            a = k * 2 * math.pi / 5 + rnd.random() * 0.5
            d = Vector((math.cos(a), 0, math.sin(a)))
            A.sweep('bark', [d * r0 * 0.6 + Vector((0, 0.35, 0)), d * r0 * 1.25 + Vector((0, 0.06, 0)), d * r0 * 1.7 + Vector((0, -0.02, 0))],
                    [(r0 * 0.45, r0 * 0.45), (r0 * 0.35, r0 * 0.3), (r0 * 0.2, r0 * 0.15)], P['bark'], 0.95, n=6, cap0=False, cap1=True, name='root')
    top = path[-1]
    nm = rnd.randint(*P['mains'])
    up = Vector((0, 1, 0))

    def branch(p, d, L, r, depth):
        d = d.normalized()
        mid = p + d * (L * 0.5) + up * (L * P['bend'])
        end = p + d * L + up * (L * P['bend'] * 1.7)
        A.sweep('bark', [p, mid, end], [(r, r), (r * 0.7, r * 0.7), (r * 0.38, r * 0.38)], P['bark'], 1.0, n=seg_b if depth == 1 else max(4, seg_b - 2),
                cap0=False, cap1=True, name='branch')
        if depth < P['depth'] and A.L <= 2:
            for k in range(P['kids']):
                t = 0.55 + 0.4 * k / max(1, P['kids'] - 1)
                q = p + (mid - p) * (t * 2) if t < 0.5 else mid + (end - mid) * ((t - 0.5) * 2)
                yaw = (rnd.random() - 0.5) * 1.6 + (0.7 if k % 2 else -0.7)
                dd = Matrix.Rotation(yaw, 3, 'Y') @ d
                dd = (dd + up * (0.4 + rnd.random() * 0.4)).normalized()
                branch(q, dd, L * P['klen'] * (0.8 + rnd.random() * 0.4), r * 0.45, depth + 1)
        tips.append(end)
        tips.append(mid + (end - mid) * 0.4 + up * 0.2)
        if depth >= P['depth'] or A.L > 2:
            tips.append(p + (mid - p) * 0.7 + up * 0.15)

    for k in range(nm):
        a = k * 2 * math.pi / nm + rnd.random() * 0.6
        sp_ = P['spread'][0] + rnd.random() * (P['spread'][1] - P['spread'][0])
        d = Vector((math.cos(a) * math.sin(sp_), math.cos(sp_), math.sin(a) * math.sin(sp_)))
        L = P['mlen'][0] + rnd.random() * (P['mlen'][1] - P['mlen'][0])
        h0 = top - Vector((0, rnd.random() * 0.5, 0))
        branch(h0, d, L, r0 * 0.55, 1)
    # 顶上再一根往上的
    branch(top, Vector(((rnd.random() - 0.5) * 0.3, 1, (rnd.random() - 0.5) * 0.3)), P['mlen'][0] * 0.7, r0 * 0.45, 1)
    return tips


def foliage(A, rnd, sp, tips):
    P = SPECIES[sp]
    c = Vector((0, 0, 0))
    for t in tips:
        c += t
    c /= max(1, len(tips))
    lo = Vector((min(t.x for t in tips), min(t.y for t in tips), min(t.z for t in tips)))
    hi = Vector((max(t.x for t in tips), max(t.y for t in tips), max(t.z for t in tips)))
    ext = (hi - lo) / 2
    if A.lo:
        # 流畅：几团椭球
        for k, t in enumerate(tips[::2]):
            s = P['leaf'] * (1.1 + rnd.random() * 0.4)
            A.blob('leaf', tuple(t), (s, s * 0.8, s), P['col'], 0.93 + rnd.random() * 0.14, seg=6, jit=0.3, seed=k + 3, tag='f', name='crown', proxy=False)
        return c, ext
    # 冠心一团暗的（树冠中间不透光）
    A.blob('leaf', tuple(c + Vector((0, -0.1, 0))), (max(0.5, ext.x * 0.6), max(0.5, ext.y * 0.58), max(0.5, ext.z * 0.6)), P['core'], 0.75,
           seg=8, jit=0.25, seed=11, tag='', name='core', proxy=False)
    per = P['per'] + (1 if A.L == 0 else 0) - (1 if A.L == 2 else 0)
    cards = []
    for t in tips:
        for k in range(per):
            off = Vector(((rnd.random() - 0.5) * 0.9, (rnd.random() - 0.3) * 0.6, (rnd.random() - 0.5) * 0.9)) * P['leaf']
            s = P['leaf'] * (0.75 + rnd.random() * 0.5)
            cards.append((t + off, s / 2, card_frame(rnd)))
    # 外壳上再补一圈，冠的轮廓不缺口
    nshell = (40, 26, 14, 0)[A.L]
    for k in range(nshell):
        th = rnd.random() * 2 * math.pi
        ph = math.acos(1 - 1.6 * rnd.random())
        dirn = Vector((math.sin(ph) * math.cos(th), math.cos(ph), math.sin(ph) * math.sin(th)))
        p = c + Vector((dirn.x * ext.x * 0.95, dirn.y * ext.y * 0.9 + 0.3, dirn.z * ext.z * 0.95))
        cards.append((p, P['leaf'] * (0.4 + rnd.random() * 0.25), card_frame(rnd)))
    leaf_cards(A, cards, c, 0xffffff, 1.0, tag='f')
    return c, ext


def tree(A, sp, seed):
    rnd = random.Random(seed)
    tips = grow(A, rnd, sp)
    c, ext = foliage(A, rnd, sp, tips)
    A.proxy_cyl((0, 0, 0), SPECIES[sp]['r0'] * 1.3, SPECIES[sp]['r0'], 2.0)
    A.meta = {'h': round(c.y + ext.y, 2), 'r': round(max(ext.x, ext.z), 2)}


def metasequoia(A, seed):
    """水杉：主干一直到顶，一轮轮短枝从下往上越来越短，微微下垂，整体是个尖塔。"""
    rnd = random.Random(seed)
    H = 9.5 + rnd.random() * 1.5
    r0 = 0.19
    seg = (10, 8, 6, 5)[A.L]
    A.lathe('bark', (0, 0, 0), [(r0 * 1.4, 0.0), (r0, 0.4), (r0 * 0.75, H * 0.4), (r0 * 0.35, H * 0.8), (0.02, H)], 0x6a4a34, 1.0, seg=seg, name='trunk')
    col = 0x4a5a30
    cards = []
    tips = []
    y = 1.8
    k = 0
    while y < H - 0.4:
        f = (H - y) / (H - 1.8)
        L = 0.35 + 1.75 * f
        n = 4 if A.L <= 1 else 3
        for j in range(n):
            a = j * 2 * math.pi / n + k * 0.9 + rnd.random() * 0.4
            d = Vector((math.cos(a), -0.15 + rnd.random() * 0.1, math.sin(a)))
            p = Vector((0, y, 0))
            e = p + d * L
            if A.L <= 2:
                A.rod('bark', tuple(p), tuple(e), 0.035 * (0.5 + f), 0.012, 0x5a4030, 1.0, seg=4, caps=False, name='branch', proxy=False)
            tips.append(e)
            if not A.lo:
                nm = 3 if A.L == 0 else (2 if A.L == 1 else 1)
                for m in range(nm):
                    t = 0.35 + 0.6 * m / max(1, nm - 1) if nm > 1 else 0.6
                    q = p + (e - p) * t
                    cards.append((q + Vector((0, 0.05, 0)), 0.42 + 0.32 * f, Matrix.Rotation(a, 3, 'Y') @ Matrix.Rotation(-math.pi / 2 + 0.25, 3, 'X')))
                    cards.append((q + Vector((0, 0.14, 0)), 0.34 + 0.26 * f, card_frame(rnd, 0.9)))
        y += 0.42 if A.L <= 1 else 0.6
        k += 1
    c = Vector((0, H * 0.45, 0))
    if A.lo:
        for i in range(4):
            yy = 2.5 + i * (H - 3.0) / 4
            rr = 1.6 * (H - yy) / H + 0.3
            A.blob('leaf', (0, yy, 0), (rr, 0.9, rr), col, 0.95, seg=6, jit=0.25, seed=i + 1, tag='f', name='crown', proxy=False)
    else:
        A.lathe('leaf', (0, 1.9, 0), [(0.0, 0.0), (0.95, 0.3), (0.55, (H - 1.9) * 0.6), (0.0, H - 2.2)], 0x1c281a, 0.7, seg=8, name='core', proxy=False)
        leaf_cards(A, cards, c, 0xffffff, 1.0, tag='f')
    A.proxy_cyl((0, 0, 0), r0 * 1.4, r0, 2.0)
    A.meta = {'h': round(H, 2), 'r': 2.1}


for _sp, _tint in (('camphor', 0x2f5530), ('plane', 0x4d6a36), ('ginkgo', 0xb09a3a)):
    for _v, _seed in (('a', 11), ('b', 23)):
        asset('tree_%s_%s' % (_sp, _v), ao=0.5, inst=True, tints={'f': _tint})(lambda A, sp=_sp, seed=_seed: tree(A, sp, seed))
for _v, _seed in (('a', 5), ('b', 9)):
    asset('tree_meta_%s' % _v, ao=0.5, inst=True, tints={'f': 0x4a5a30})(lambda A, seed=_seed: metasequoia(A, seed))


@asset('shrub_cluster', ao=0.4, inst=True, tints={'f': 0x2f5232})
def shrub_cluster(A):
    """一丛灌木（三团挨着）：每团一个暗的芯、外面一层叶片卡。"""
    rnd = random.Random(31)
    for (x, z, s) in ((-0.42, -0.26, 0.85), (0.0, 0.30, 1.0), (0.42, -0.26, 0.7)):
        c = Vector((x, s * 0.45, z))
        A.blob('leaf', tuple(c), (s * 0.48, s * 0.38, s * 0.48), 0x1e3a24, 0.85, seg=7, jit=0.3, seed=int(s * 10), tag='' if not A.lo else 'f', name='core', proxy=False)
        if A.lo:
            continue
        cards = []
        n = (14, 10, 6, 0)[A.L]
        for k in range(n):
            th = rnd.random() * 2 * math.pi
            ph = math.acos(1 - 1.3 * rnd.random())
            d = Vector((math.sin(ph) * math.cos(th), math.cos(ph), math.sin(ph) * math.sin(th)))
            cards.append((c + Vector((d.x * s * 0.42, d.y * s * 0.32, d.z * s * 0.42)), s * (0.28 + rnd.random() * 0.12), card_frame(rnd, 0.8)))
        leaf_cards(A, cards, c - Vector((0, 0.15, 0)), 0xffffff, 1.0, tag='f')
    A.proxy_box((0, 0.4, 0), (1.6, 0.8, 1.2))


@asset('hedge_200', ao=0.45, inst=True, tints={'f': 0x2f5232})
def hedge_200(A):
    """两米一段的绿篱（沿 x，游戏里一段段拉伸接满）：修剪成方的暗绿芯，顶面和两侧密密的叶片卡，底下露一点土和枝。"""
    w, h, d = 2.0, 0.86, 0.72
    A.box('leaf', (0, h / 2 - 0.02, 0), (w, h - 0.04, d - 0.06), 0x24412a, 0.85, bev=0.08, name='core', tag='f' if A.lo else '')
    if A.lo:
        return
    rnd = random.Random(7)
    cards = []
    step = (0.22, 0.3, 0.45, 1)[A.L]
    nx = int(round(w / step))
    for i in range(nx):
        x = -w / 2 + (i + 0.5) * w / nx
        for s in (-1, 1):
            for yy in ((0.22, 0.58) if A.L <= 1 else (0.42,)):
                cards.append((Vector((x + (rnd.random() - 0.5) * 0.1, yy, s * (d / 2 - 0.02))), 0.2 + rnd.random() * 0.05,
                              Matrix.Rotation(0 if s > 0 else math.pi, 3, 'Y') @ Matrix.Rotation((rnd.random() - 0.5) * 0.6, 3, 'Z')))
        for zz in ((-0.18, 0.18) if A.L <= 1 else (0.0,)):
            cards.append((Vector((x + (rnd.random() - 0.5) * 0.1, h - 0.03, zz)), 0.21 + rnd.random() * 0.05,
                          Matrix.Rotation(rnd.random() * 6.28, 3, 'Y') @ Matrix.Rotation(-math.pi / 2 + (rnd.random() - 0.5) * 0.4, 3, 'X')))
    leaf_cards(A, cards, Vector((0, h * 0.35, 0)), 0xffffff, 1.0, tag='f')
    A.proxy_box((0, h / 2, 0), (w, h, d))
