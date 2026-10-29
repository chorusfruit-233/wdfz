"""其余家具：立式钢琴和琴凳、圆凳、食堂餐桌、打饭台、货架和上面的纸箱 / 球、带轮大垃圾桶、厕所隔间、
铜钟、供桌、连廊吊牌、洗手台、铁皮立柜、乒乓球台、篮球筐。尺寸沿用 furniture.js / room.js 的局部坐标。"""
import math
import random

from mathutils import noise, Vector

from wdfz import asset, rrect
from assets._parts import rpanel, handle_bar, knob, screw, led, slats, book, STEEL, CHROME, BLACK


# ---------------------------------------------------------------- 钢琴
WHITE_N = 52                    # 88 键：52 白 36 黑


@asset('piano_upright', ao=0.4)
def piano_upright(A):
    """立式钢琴：琴背靠墙（-z），人坐在 +z。琴身、顶盖、两侧托腮、键床、琴键（白键之间有缝，黑键高出来）、
    打开的琴键盖、谱架和摊开的谱子、三个铜踏板、底下的脚轮。"""
    bz = -0.19
    pD = 0.62
    body, dk = 0x23282b, 0x14181a
    # 琴身：下半截（键床以下）浅一点，上半截满深
    A.box('wood', (0, 0.36, bz - 0.03), (1.44, 0.72, pD - 0.06), body, 1.0, bev=0.008, name='lower')
    A.box('wood', (0, 0.98, bz), (1.44, 0.52, pD), body, 1.0, bev=0.01, name='upper')
    A.box('wood', (0, 1.25, bz), (1.48, 0.04, pD + 0.03), 0x2e3539, 1.08, bev=0.012, name='lid')
    for s in (-1, 1):
        A.box('wood', (s * 0.70, 0.40, bz + 0.36), (0.06, 0.80, 0.14), body, 1.0, bev=0.012, name='cheek')
        A.box('wood', (s * 0.70, 0.045, bz + 0.40), (0.07, 0.09, 0.20), dk, 1.0, bev=0.01, name='toe')
        if not A.lo:
            A.cyl('metal', (s * 0.62, 0.0, bz - 0.20), 0.025, 0.025, 0.02, 0xa8913f, 1.2, seg=10, name='caster', proxy=False)
    # 下半截的面板、键床
    if not A.lo:
        A.box('wood', (0, 0.40, bz + 0.274), (1.30, 0.56, 0.012), 0x1d2124, 1.0, bev=0.004, name='kneeboard', proxy=False)
    A.box('wood', (0, 0.70, bz + 0.39), (1.36, 0.07, 0.22), dk, 1.0, bev=0.006, name='keybed')
    kx0 = -0.611
    kw = 1.222 / WHITE_N
    if A.L <= 1:
        for k in range(WHITE_N):
            A.box('plastic', (kx0 + (k + 0.5) * kw, 0.745, bz + 0.40), (kw - 0.0012, 0.022, 0.15), 0xe8e4d8, 1.12, bev=0.0015 if A.L == 0 else 0, name='wkey', proxy=False)
    else:
        A.box('plastic', (0, 0.745, bz + 0.40), (1.222, 0.022, 0.15), 0xe8e4d8, 1.12, name='wkeys', proxy=False)
        if A.L == 2:
            for k in range(1, WHITE_N):
                A.box('dark', (kx0 + k * kw, 0.7562, bz + 0.40), (0.0012, 0.0005, 0.15), 0x6a6a64, 1.0, name='gap', proxy=False)
    A.proxy_box((0, 0.745, bz + 0.40), (1.222, 0.022, 0.15))
    # 黑键：A0 开始，按音名排（白键序号 k 对应 A B C D E F G）
    names = 'ABCDEFG'
    for k in range(WHITE_N - 1):
        n = names[(k) % 7]
        if n in 'BE':
            continue
        x = kx0 + (k + 1) * kw
        A.box('plastic', (x, 0.765, bz + 0.37), (kw * 0.56, 0.018 if A.lo else 0.02, 0.09), 0x101314, 0.9, bev=0.0015 if A.hi else 0, name='bkey', proxy=False)
    # 琴键盖（打开，竖着靠在后面）、琴名板
    A.box('wood', (0, 0.81, bz + 0.31), (1.30, 0.10, 0.016), body, 1.02, bev=0.004, name='fallboard', rot=(0.2, 0, 0))
    if A.hi:
        A.box('metal', (0, 0.81, bz + 0.3195), (0.12, 0.012, 0.001), 0xc8a85a, 1.2, rot=(0.2, 0, 0), name='brand', proxy=False)
    # 谱架和谱子
    A.box('wood', (0, 1.05, bz + 0.32), (0.92, 0.30, 0.02), 0x1a1f22, 1.02, bev=0.004, rot=(-0.12, 0, 0), name='desk')
    A.box('wood', (0, 0.905, bz + 0.34), (0.92, 0.02, 0.05), 0x1a1f22, 1.0, bev=0.004, name='desk_ledge')
    for s, c in ((-1, 0xe8e4d4), (1, 0xe2ddcc)):
        A.box('paper', (s * 0.135, 1.06, bz + 0.333), (0.26, 0.28, 0.003), c, 1.0, rot=(-0.12, s * 0.06, 0), name='sheet', proxy=False)
        if A.hi:
            for r in range(6):
                A.box('dark', (s * 0.135, 1.16 - r * 0.04, bz + 0.335 + (1.16 - r * 0.04 - 1.06) * 0.12), (0.22, 0.0012, 0.0005), 0x5a5a56, 1.0, rot=(-0.12, s * 0.06, 0), name='staff', proxy=False)
    # 踏板
    for k, x in enumerate((-0.07, 0.0, 0.07)):
        A.box('metal', (x, 0.09, bz + 0.37), (0.035, 0.012, 0.13), 0xa8913f, 1.25, bev=0.004, rot=(-0.12, 0, 0), name='pedal')
    if not A.lo:
        A.box('wood', (0, 0.06, bz + 0.31), (0.30, 0.10, 0.03), dk, 1.0, bev=0.004, name='pedal_box', proxy=False)


@asset('piano_bench', ao=0.35)
def piano_bench(A):
    """琴凳：皮面软垫、木框、四条带弧的腿。"""
    A.cushion('fabric', (0, 0.475, 0), (0.80, 0.05, 0.32), 0x1e1414, 1.0, puff=0.08, r=0.015, name='pad')
    A.box('wood', (0, 0.43, 0), (0.80, 0.05, 0.32), 0x5a4a36, 1.0, bev=0.006, name='frame')
    for sx in (-1, 1):
        for sz in (-1, 1):
            A.rod('wood', (sx * 0.34, 0.41, sz * 0.12), (sx * 0.355, 0.0, sz * 0.135), 0.022, 0.017, 0x4a3c2c, 1.0, seg=10, round_=0.005, name='leg')
    if not A.lo:
        A.rod('wood', (-0.34, 0.14, 0), (0.34, 0.14, 0), 0.012, 0.012, 0x4a3c2c, 1.0, seg=8, caps=False, name='stretcher')


@asset('stool_piano', ao=0.35, inst=True)
def stool_piano(A):
    """音乐教室的圆琴凳：木头鼓形凳身、软垫面。"""
    A.lathe('wood', (0, 0, 0), [(0, 0), (0.18, 0), (0.18, 0.02), (0.16, 0.05), (0.15, 0.36), (0.165, 0.40), (0.17, 0.42), (0, 0.42)], 0x4a3c2c, 1.0, seg=24, name='body')
    if A.lo:
        A.cyl('fabric', (0, 0.42, 0), 0.19, 0.19, 0.05, 0x3a1e1e, 1.0, seg=10, name='pad')
    else:
        A.lathe('fabric', (0, 0.42, 0), [(0, 0), (0.185, 0), (0.19, 0.02), (0.18, 0.04), (0.12, 0.052), (0, 0.055)], 0x3a1e1e, 1.0, seg=28, name='pad')


# ---------------------------------------------------------------- 食堂
@asset('canteen_table', ao=0.35, inst=True)
def canteen_table(A):
    """食堂连体餐桌：浅色台面（圆边）、中间的立柱和十字底座，四只连在钢臂上的红色圆凳。"""
    A.box('plastic', (0, 0.74, 0), (0.86, 0.04, 0.80), 0xc8c0b0, 1.02, bev=0.012, name='top')
    if not A.lo:
        A.box('metal', (0, 0.712, 0), (0.30, 0.016, 0.30), 0x6a6e72, 1.0, bev=0.003, name='plate')
    A.cyl('metal', (0, 0.02, 0), 0.06, 0.04, 0.70, 0x6a6e72, 1.0, seg=14, name='column')
    A.rod('metal', (-0.34, 0.025, 0), (0.34, 0.025, 0), 0.022, 0.022, 0x6a6e72, 1.0, seg=8, round_=0.006, name='base')
    A.rod('metal', (0, 0.025, -0.32), (0, 0.025, 0.32), 0.022, 0.022, 0x6a6e72, 1.0, seg=8, round_=0.006, name='base')
    for sx in (-1, 1):
        for sz in (-1, 1):
            A.tube('metal', [(sx * 0.05, 0.10, 0), (sx * 0.18, 0.10, sz * 0.12), (sx * 0.22, 0.24, sz * 0.46), (sx * 0.22, 0.41, sz * 0.52)], 0.016, 0x6a6e72, 1.0, seg=8, bend=0.08, name='arm')
            A.cyl('plastic', (sx * 0.22, 0.41, sz * 0.52), 0.13, 0.13, 0.035, 0x8a2a22, 1.0, seg=24, round_=0.012, name='stool')
            if not A.lo:
                A.cyl('metal', (sx * 0.22, 0.395, sz * 0.52), 0.06, 0.06, 0.015, 0x5a5e62, 1.0, seg=12, name='stool_plate', proxy=False)


@asset('counter_serving', ao=0.35)
def counter_serving(A):
    """不锈钢打饭台：柜体、台面上嵌两个方菜盆、一把大勺，上面是防喷溅玻璃罩和保温灯。菜由游戏里另外摆（按位置换菜色）。"""
    A.box('metal', (0, 0.45, 0), (0.86, 0.90, 0.80), 0xa8aeb0, 1.05, bev=0.008, name='body')
    if not A.lo:
        for s in (-1, 1):
            A.box('metal', (s * 0.21, 0.45, 0.401), (0.40, 0.80, 0.004), 0xb4babc, 1.0, bev=0.002, name='door', proxy=False)
            handle_bar(A, (s * 0.06, 0.62, 0.402), 0.10, CHROME, axis='y', off=0.018)
        A.box('metal', (0, 0.04, 0.38), (0.84, 0.08, 0.004), 0x6a7072, 1.0, name='kick', proxy=False)
    A.box('metal', (0, 0.915, 0), (0.90, 0.03, 0.84), 0xc8ced0, 1.15, bev=0.004, name='top')
    for k in (-1, 1):
        px = k * 0.20
        A.box('metal', (px, 0.925, 0.04), (0.36, 0.012, 0.50), 0xd8dcde, 1.2, bev=0.002, name='pan_rim')
        A.box('dark', (px, 0.928, 0.04), (0.32, 0.006, 0.46), 0x1a1c1e, 1.0, name='pan', proxy=False)
    # 大勺
    A.tube('metal', [(0.35, 0.94, 0.20), (0.32, 1.02, 0.25), (0.28, 1.12, 0.32)], 0.008, 0xc8ccce, 1.25, seg=8, bend=0.04, name='ladle')
    A.lathe('metal', (0.36, 0.925, 0.18), [(0.0, 0), (0.045, 0.01), (0.05, 0.035), (0.046, 0.035), (0.041, 0.012), (0, 0.004)], 0xc8ccce, 1.25, seg=16, name='ladle_cup')
    # 玻璃罩
    for s in (-1, 1):
        A.rod('metal', (s * 0.42, 0.93, -0.30), (s * 0.42, 1.42, -0.30), 0.012, 0.012, 0xc8ccce, 1.2, seg=10, name='post')
    A.box('glass', (0, 1.18, -0.30), (0.82, 0.46, 0.01), 0xb8c8c8, 1.2, name='guard')
    A.box('glass', (0, 1.42, -0.10), (0.86, 0.01, 0.40), 0xb8c8c8, 1.2, name='shelf')
    A.box('emit', (0, 1.405, -0.10), (0.70, 0.006, 0.04), 0xf8e8c8, 0.9, name='heatlamp', proxy=False)
    if not A.lo:
        A.box('metal', (0, 1.43, -0.10), (0.74, 0.02, 0.07), 0x9aa0a2, 1.0, bev=0.004, name='lamp_housing', proxy=False)


@asset('food_pan_fill', ao=0.2, ground=False, lods=(0, 1, 2, 3))
def food_pan_fill(A):
    """菜盆里的菜（一盆）：一团团堆着，颜色两种交错；用标签 a / b 染色。"""
    if A.lo:
        A.box('plastic', (0, 0.0, 0), (0.30, 0.01, 0.44), 0xffffff, 1.0, tag='a', name='food')
        return
    rnd = random.Random(3)
    n = 9 if A.L == 2 else 16
    for b in range(n):
        x = -0.11 + (b % 3) * 0.11 + (rnd.random() - 0.5) * 0.03
        z = -0.17 + (b // 3) * (0.34 / max(1, (n - 1) // 3)) + (rnd.random() - 0.5) * 0.03
        A.blob('plastic', (x, 0.0, z), (0.065, 0.026, 0.06), 0xffffff, 1.0, seg=10, jit=0.35, seed=b + 1, tag='a' if b % 2 == 0 else 'b', name='food', proxy=False)
    A.proxy_box((0, 0, 0), (0.32, 0.03, 0.46))


# ---------------------------------------------------------------- 货架、纸箱、球
@asset('shelf_metal', ao=0.35, inst=True)
def shelf_metal(A):
    """角钢货架：四根带孔的角钢立柱、四层带折边的层板、脚垫、斜拉条。"""
    col = 0xa8a196
    for sx in (-1, 1):
        for sz in (-1, 1):
            x, z = sx * 0.40, sz * 0.32
            if A.lo:
                A.box('metal', (x, 0.92, z), (0.04, 1.84, 0.04), col, 1.0, name='post')
                continue
            # L 形角钢：两片在外角合上
            A.box('metal', (x, 0.92, z + sz * 0.018), (0.04, 1.84, 0.004), col, 1.0, name='post', proxy=False)
            A.box('metal', (x + sx * 0.018, 0.92, z), (0.004, 1.84, 0.04), col, 0.95, name='post', proxy=False)
            A.proxy_box((x, 0.92, z), (0.04, 1.84, 0.04))
            if A.hi:
                for k in range(22):
                    A.box('dark', (x - sx * 0.004, 0.08 + k * 0.08, z + sz * 0.0202), (0.008, 0.02, 0.0006), 0x2a2a26, 1.0, name='hole', proxy=False)
            A.box('plastic', (x, 0.006, z), (0.05, 0.012, 0.05), BLACK, 1.0, bev=0.003, name='foot', proxy=False)
    for k in range(4):
        sy = 0.10 + k * 0.56
        A.box('metal', (0, sy, 0), (0.84, 0.012, 0.68), col, 1.05, name='shelf')
        if not A.lo:
            for sz in (-1, 1):
                A.box('metal', (0, sy - 0.012, sz * 0.335), (0.84, 0.03, 0.004), col, 1.0, name='lip', proxy=False)
            for sx in (-1, 1):
                A.box('metal', (sx * 0.415, sy - 0.012, 0), (0.004, 0.03, 0.68), col, 0.95, name='lip', proxy=False)
    if A.L <= 2:
        for sx in (-1, 1):
            A.rod('metal', (sx * 0.405, 0.15, -0.30), (sx * 0.405, 0.62, 0.30), 0.004, 0.004, col, 1.0, seg=6, caps=False, name='brace', proxy=False)


def carton(A, w, h, d, col, open_=False, seed=1):
    """纸箱：箱体、封箱胶带；open_ 时两片盖子翘着。"""
    A.box('paper', (0, h / 2, 0), (w, h, d), col, 1.0, bev=0.004, name='box')
    if A.lo:
        return
    A.box('plastic', (0, h + 0.0006, 0), (0.05, 0.0014, d + 0.002), 0xc8b88a, 1.05, name='tape', proxy=False)
    A.box('plastic', (0, h - 0.04, d / 2 + 0.0006), (0.05, 0.08, 0.0014), 0xc8b88a, 1.05, name='tape', proxy=False)
    if A.hi:
        rnd = random.Random(seed)
        A.box('paper', (w * 0.2, h * 0.55, d / 2 + 0.0005), (w * 0.3, h * 0.25, 0.0008), 0xe8e4d8, 1.0, name='label', proxy=False)
        A.box('dark', (-w * 0.25, h * 0.6, d / 2 + 0.0005), (0.04, 0.03, 0.0006), 0x3a3428, 1.0, name='mark', proxy=False)


for _i, (_w, _h, _d, _c) in enumerate(((0.24, 0.17, 0.40, 0xb8a07a), (0.20, 0.17, 0.40, 0xa89a80), (0.28, 0.16, 0.38, 0xc0a880))):
    def _mk(i, w, h, d, c):
        @asset('carton_%d' % i, ao=0.25, inst=True)
        def f(A):
            carton(A, w, h, d, c, seed=i + 1)
    _mk(_i, _w, _h, _d, _c)


def ball_mesh(A, r, kind):
    """球：篮球（橙、黑色缝线）、足球（黑白块）、排球（三色条）。用顶点色画花纹。"""
    seg = 12 if A.lo else (24 if A.L == 2 else 40)
    rings = seg // 2
    verts, faces, cols = [], [], []
    for j in range(rings + 1):
        ph = j / rings * math.pi
        for i in range(seg):
            th = i / seg * 2 * math.pi
            p = Vector((math.sin(ph) * math.cos(th), math.cos(ph), math.sin(ph) * math.sin(th)))
            verts.append((p.x * r, p.y * r + r, p.z * r))
            if kind == 'basket':
                line = min(abs(p.x), abs(p.y), abs(p.z * 0.7 + p.x * 0.7), abs(math.hypot(p.x, p.z) - 0.72))
                c = (0.08, 0.06, 0.05) if line < 0.035 else (0.76, 0.38, 0.17)
            elif kind == 'soccer':
                c = (0.08, 0.08, 0.08) if noise.cell(p * 2.2) < 0.18 else (0.9, 0.9, 0.88)
            else:
                band = (math.atan2(p.z, p.x) * 3 / math.pi + p.y * 1.5) % 3
                c = [(0.9, 0.88, 0.8), (0.2, 0.36, 0.7), (0.92, 0.78, 0.2)][int(band) % 3]
            cols.append(c)
    for j in range(rings):
        for i in range(seg):
            i1 = (i + 1) % seg
            faces.append((j * seg + i, j * seg + i1, (j + 1) * seg + i1, (j + 1) * seg + i))
    A.mesh('plastic', verts, faces, 0xffffff, 1.0, smooth=True, sharp=None, cols=cols, name='ball')
    A.proxies.append({'t': 'blob', 'c': list(A.P((0, r, 0))), 'r': [r, r, r], 'a': 0.0, 'jit': 0})


@asset('ball_basket', ao=0.2)
def ball_basket(A):
    ball_mesh(A, 0.12, 'basket')


@asset('ball_soccer', ao=0.2)
def ball_soccer(A):
    ball_mesh(A, 0.11, 'soccer')


@asset('ball_volley', ao=0.2)
def ball_volley(A):
    ball_mesh(A, 0.105, 'volley')


@asset('ball_crate', ao=0.4)
def ball_crate(A):
    """体育器材室角落的一筐球：铁框篮（网格）、里面四个篮球。"""
    col = 0x5a5f62
    if A.lo:
        A.box('metal', (0, 0.30, 0), (0.8, 0.6, 0.6), col, 1.0, name='crate')
    else:
        for (x, z, w, d) in ((0, -0.30, 0.8, 0.012), (0, 0.30, 0.8, 0.012), (-0.40, 0, 0.012, 0.6), (0.40, 0, 0.012, 0.6)):
            for k in range(5):
                A.box('metal', (x, 0.06 + k * 0.12, z), (w, 0.008, d), col, 1.0, name='wire', proxy=False)
        for sx in (-1, 1):
            for sz in (-1, 1):
                A.box('metal', (sx * 0.39, 0.31, sz * 0.29), (0.02, 0.62, 0.02), col, 1.0, name='corner', proxy=False)
        for k in range(7):
            A.box('metal', (-0.36 + k * 0.12, 0.31, -0.30), (0.008, 0.62, 0.008), col, 1.0, name='wire', proxy=False)
            A.box('metal', (-0.36 + k * 0.12, 0.31, 0.30), (0.008, 0.62, 0.008), col, 1.0, name='wire', proxy=False)
        A.box('metal', (0, 0.02, 0), (0.78, 0.01, 0.58), col, 0.9, name='floor', proxy=False)
        A.proxy_box((0, 0.31, 0), (0.80, 0.62, 0.60))
    for b in range(4):
        with A.at(-0.2 + (b % 2) * 0.4, 0.47, -0.15 + (b >> 1) * 0.3, ry=b * 1.3):
            ball_mesh(A, 0.12, 'basket')


# ---------------------------------------------------------------- 大垃圾桶
@asset('bin_wheelie', ao=0.4)
def bin_wheelie(A):
    """带轮大垃圾桶（660 升）：上宽下窄的桶身、加强筋、盖子没盖严（翘起一点）、后面的推把、四个万向轮、正面白色编号牌。"""
    col, dk = 0x2f5a3a, 0x24482e
    A.prism('plastic', (0, 0.12, 0), [(-0.36, 0.0), (0.36, 0.0), (0.40, 1.00), (-0.40, 1.00)], 0.74, col, 1.0, bev=0.03, name='body')
    if not A.lo:
        for s in (-1, 1):
            A.box('plastic', (s * 0.385, 0.62, 0.0), (0.03, 0.80, 0.70), col, 0.95, bev=0.01, rot=(0, 0, s * 0.04), name='rib', proxy=False)
        A.box('plastic', (0, 1.105, 0.0), (0.84, 0.04, 0.80), dk, 1.0, bev=0.012, name='rim')
    with A.at(0, 1.13, 0.40, rx=-0.06):
        A.box('plastic', (0, 0.03, -0.42), (0.86, 0.06, 0.84), dk, 1.0, bev=0.02, name='lid')
        if not A.lo:
            for s in (-1, 1):
                A.box('plastic', (s * 0.25, 0.065, -0.10), (0.08, 0.02, 0.12), dk, 0.9, bev=0.006, name='lid_grip', proxy=False)
    A.rod('plastic', (-0.36, 1.10, -0.44), (0.36, 1.10, -0.44), 0.02, 0.02, 0x1a2a1e, 1.0, seg=10, round_=0.006, name='handle')
    for s in (-1, 1):
        A.box('plastic', (s * 0.36, 1.06, -0.42), (0.03, 0.10, 0.06), 0x1a2a1e, 1.0, bev=0.008, name='handle_mount')
    for sx in (-1, 1):
        for sz in (-1, 1):
            x, z = sx * 0.27, sz * 0.27
            A.box('metal', (x, 0.105, z), (0.06, 0.03, 0.06), 0x3a3e42, 1.0, bev=0.004, name='castor_plate', proxy=False)
            A.box('metal', (x, 0.075, z - 0.012), (0.03, 0.04, 0.05), 0x3a3e42, 1.0, bev=0.004, name='castor_fork', proxy=False)
            A.cyl('plastic', (x - 0.012, 0.055, z - 0.02), 0.055, 0.055, 0.024, 0x111418, 1.0, seg=16, round_=0.006, dirn=(1, 0, 0), name='wheel')
    A.box('paper', (0, 0.85, 0.388), (0.30, 0.30, 0.004), 0xd8d4c6, 1.0, rot=(0.04, 0, 0), name='plate')
    # 「3」：三道横、一道竖（白底上的深色笔画）
    if A.lo:
        A.box('dark', (0, 0.85, 0.391), (0.10, 0.22, 0.002), 0x2a2a2a, 1.0, name='num')
    else:
        for y in (0.94, 0.85, 0.76):
            A.box('dark', (0.0, y, 0.3915), (0.11, 0.022, 0.002), 0x2a2a2a, 1.0, rot=(0.04, 0, 0), name='num', proxy=False)
        A.box('dark', (0.045, 0.85, 0.3915), (0.022, 0.20, 0.002), 0x2a2a2a, 1.0, rot=(0.04, 0, 0), name='num', proxy=False)


# ---------------------------------------------------------------- 厕所隔间
@asset('toilet_stall', ao=0.45, inst=True)
def toilet_stall(A):
    """厕所隔间（中国学校常见的蹲坑）：两侧抗倍特隔板（底下铝脚，离地 15 厘米）、顶上铝横杆、关着的门（合页、插销、红色「有人」），
    门缝底下看得见：高出地面的台阶、白瓷蹲便器、后墙的冲水管。里面很暗。"""
    pc = 0xb0aaa0
    for s in (-1, 1):
        A.box('plastic', (s * 0.47, 1.05, 0), (0.025, 1.80, 0.92), pc, 1.0, bev=0.006, name='side')
        if not A.lo:
            for zz in (-0.40, 0.40):
                A.cyl('metal', (s * 0.47, 0.0, zz), 0.016, 0.016, 0.15, 0xb8c0c2, 1.15, seg=10, name='foot', proxy=False)
    A.box('plastic', (0, 1.05, 0.44), (0.86, 1.70, 0.025), 0x8a948e, 1.0, bev=0.006, name='door')
    if not A.lo:
        A.box('metal', (0, 1.965, 0.44), (0.98, 0.03, 0.04), 0xb8c0c2, 1.1, bev=0.006, name='headrail')
        for y in (0.45, 1.65):
            A.box('metal', (-0.43, y, 0.455), (0.03, 0.10, 0.012), 0xb8c0c2, 1.15, bev=0.003, name='hinge', proxy=False)
        A.box('metal', (0.36, 1.05, 0.455), (0.09, 0.07, 0.01), 0xb8c0c2, 1.15, bev=0.003, name='lock', proxy=False)
    A.box('emit', (0.36, 1.05, 0.4615), (0.06, 0.04, 0.002), 0xc04a3a, 1.0, name='occupied', proxy=False)
    A.rod('metal', (0.27, 1.05, 0.455), (0.27, 1.05, 0.50), 0.012, 0.012, 0xb8c0c2, 1.2, seg=10, round_=0.004, name='pull')
    # 里面：台阶、蹲便器、冲水管
    A.box('tile', (0, 0.075, -0.06), (0.90, 0.15, 0.80), 0xd8dcda, 1.0, bev=0.006, name='step')
    A.box('emit', (0, 0.0035, 0.34), (0.86, 0.002, 0.16), 0x050506, 1.0, name='dark_floor', proxy=False)
    if not A.lo:
        A.prism('plastic', (0, 0.150, -0.10), rrect(0.36, 0.58, 0.16, 6 if A.hi else 3), 0.008, 0xf0f2f0, 1.05, rot=(math.pi / 2, 0, 0), name='pan_rim', proxy=False)
        A.prism('dark', (0, 0.151, -0.10), rrect(0.26, 0.46, 0.12, 6 if A.hi else 3), 0.006, 0x8a9294, 1.0, rot=(math.pi / 2, 0, 0), name='pan_bowl', proxy=False)
        A.rod('metal', (0, 0.15, -0.43), (0, 1.10, -0.43), 0.012, 0.012, 0xb8c0c2, 1.15, seg=10, name='flush_pipe', proxy=False)
        A.box('metal', (0, 1.12, -0.43), (0.10, 0.08, 0.03), 0xb8c0c2, 1.15, bev=0.006, name='flush_valve', proxy=False)


# ---------------------------------------------------------------- 铜钟
@asset('bell_bronze', ao=0.5)
def bell_bronze(A):
    """钟楼的铜钟（梵钟）：蒲牢挂钩、钟肩、钟身（上下几道箍、竖带分出的格子，格子里一排排乳钉）、撞座（莲花）、外翻的钟口、钟舌；
    旁边两根绳吊着的撞木。横梁另外画（长短看房间）。原点在钟正下方的地面。"""
    col = 0x6e5228
    rim = 1.40
    prof = [(0.0, 0.0), (0.66, 0.0), (0.70, 0.03), (0.69, 0.09), (0.64, 0.20), (0.61, 0.40), (0.58, 0.62), (0.55, 0.78), (0.48, 0.88), (0.36, 0.95), (0.0, 0.97)]
    prof = [(r, rim + h) for (r, h) in prof]
    A.lathe('metal', (0, 0, 0), prof, col, 1.05, seg=24, sharp=60, name='bell')
    A.lathe('dark', (0, rim + 0.002, 0), [(0.0, 0.0), (0.62, 0.0), (0.0, 0.0001)], 0x0a0806, 1.0, seg=24, name='mouth', proxy=False)
    # 箍
    for (h, r) in ((0.12, 0.665), (0.30, 0.625), (0.58, 0.588), (0.80, 0.54)):
        A.lathe('metal', (0, rim + h, 0), [(r, -0.015), (r + 0.012, -0.008), (r + 0.012, 0.008), (r, 0.015)], 0x7c5c2c, 1.1, seg=24, cap0=False, cap1=False, name='band', proxy=False)
    if not A.lo:
        # 竖带：四条
        for k in range(4):
            a = k * math.pi / 2 + math.pi / 4
            pts = []
            for (h, r) in ((0.30, 0.627), (0.45, 0.611), (0.58, 0.592)):
                pts.append((math.cos(a) * (r + 0.006), rim + h, -math.sin(a) * (r + 0.006)))
            A.tube('metal', pts, 0.012, 0x7c5c2c, 1.1, seg=6, name='vband', proxy=False)
        # 乳钉：每个格子 3×3
        for k in range(4):
            for i in range(3):
                for j in range(3):
                    a = k * math.pi / 2 + (i - 1) * 0.28
                    h = 0.62 + j * 0.06
                    r = 0.58 - (h - 0.58) * 0.5 + 0.012
                    A.blob('metal', (math.cos(a) * r, rim + h, -math.sin(a) * r), (0.016, 0.016, 0.016), 0x8a6a32, 1.2, seg=8, name='nipple', proxy=False)
        # 撞座（朝 +x，撞木那边）：莲花圆盘
        A.cyl('metal', (0.615, rim + 0.22, 0), 0.10, 0.09, 0.03, 0x8a6a32, 1.15, seg=20, round_=0.006, dirn=(1, 0, 0), name='seat', proxy=False)
        for k in range(8):
            a = k / 8 * 2 * math.pi
            A.blob('metal', (0.64, rim + 0.22 + math.sin(a) * 0.06, math.cos(a) * 0.06), (0.012, 0.028, 0.02), 0x8a6a32, 1.15, seg=8, rot=(a, 0, 0), name='petal', proxy=False)
    # 蒲牢（挂钩）：一个拱起的环
    top = rim + 0.97
    A.tube('metal', [(-0.16, top - 0.01, 0), (-0.14, top + 0.12, 0), (0.0, top + 0.20, 0), (0.14, top + 0.12, 0), (0.16, top - 0.01, 0)], 0.05, 0x5a4220, 1.0, seg=10, bend=0.08, name='loop')
    A.rod('metal', (0, top + 0.20, 0), (0, 2.72, 0), 0.04, 0.04, 0x2a2018, 1.0, seg=10, name='hanger')
    # 钟舌
    A.rod('metal', (0, top - 0.05, 0), (0, rim + 0.05, 0), 0.02, 0.02, 0x2a2018, 1.0, seg=8, name='clapper_rod', proxy=False)
    A.blob('metal', (0, rim + 0.03, 0), (0.07, 0.07, 0.07), 0x2a2018, 1.0, seg=12, name='clapper', proxy=False)
    # 撞木：两根绳吊着
    A.rod('wood', (0.75, 2.02, 0), (1.70, 1.95, 0), 0.09, 0.09, 0x5a4632, 1.0, seg=14, round_=0.03, name='striker')
    for x in (1.00, 1.50):
        A.rod('fabric', (x, 2.80, 0), (x, 2.02 if x < 1.2 else 1.98, 0), 0.008, 0.008, 0x8a8478, 1.0, seg=6, caps=False, name='rope', proxy=False)
        if not A.lo:
            A.lathe('fabric', (x, 1.93 if x < 1.2 else 1.89, 0), [(0.095, 0.0), (0.10, 0.03), (0.10, 0.10), (0.095, 0.13)], 0x8a8478, 1.0, seg=14, cap0=False, cap1=False, dirn=(0, 1, 0), name='sling', proxy=False)


# ---------------------------------------------------------------- 供桌
@asset('altar_table', ao=0.4)
def altar_table(A):
    """供桌：深红木桌、四条腿、垂下来的红桌围（有褶）；铜香炉插着两根香、两根白蜡烛（火苗发光）、
    一碗插着筷子的白饭、一个相框（照片上的脸被剪掉了）。"""
    A.box('wood', (0, 0.80, 0), (1.30, 0.06, 0.70), 0x5a2a20, 1.05, bev=0.008, name='top')
    for sx in (-1, 1):
        for sz in (-1, 1):
            A.box('wood', (sx * 0.58, 0.39, sz * 0.28), (0.07, 0.78, 0.07), 0x4a2018, 0.95, bev=0.006, name='leg')
    if not A.lo:
        A.box('wood', (0, 0.72, 0.30), (1.10, 0.08, 0.02), 0x4a2018, 0.95, bev=0.004, name='apron', proxy=False)
    # 红桌围：一道道竖褶（顶点按正弦起伏）
    nx = 12 if A.lo else (40 if A.L == 2 else 80)
    ny = 2 if A.lo else 8
    verts, faces = [], []
    for j in range(ny + 1):
        y = 0.77 - 0.46 * j / ny
        for i in range(nx + 1):
            x = -0.62 + 1.24 * i / nx
            z = 0.345 + 0.008 * math.sin(i * 0.9) * (0.3 + 0.7 * j / ny)
            verts.append((x, y, z))
    for j in range(ny):
        for i in range(nx):
            a = j * (nx + 1) + i
            faces.append((a, a + 1, a + nx + 2, a + nx + 1)[::-1])
    A.mesh('fabric', verts, faces, 0x8a2a22, 1.0, smooth=True, sharp=None, name='skirt')
    if not A.lo:
        A.box('fabric', (0, 0.52, 0.346), (1.24, 0.03, 0.006), 0xc8a24a, 1.0, name='skirt_band', proxy=False)
    A.proxy_box((0, 0.56, 0.345), (1.24, 0.46, 0.02))
    ty = 0.83
    # 香炉
    A.lathe('metal', (0, ty, -0.10), [(0, 0), (0.07, 0), (0.08, 0.01), (0.11, 0.05), (0.12, 0.09), (0.125, 0.10), (0.115, 0.10), (0.105, 0.085), (0, 0.085)], 0x6a5a3a, 1.1, seg=20, name='censer')
    if not A.lo:
        for k in range(3):
            a = k / 3 * 2 * math.pi
            A.cyl('metal', (math.cos(a) * 0.06, ty - 0.02, -0.10 + math.sin(a) * 0.06), 0.012, 0.009, 0.025, 0x5a4a2a, 1.0, seg=8, name='censer_foot', proxy=False)
        A.cyl('dark', (0, ty + 0.084, -0.10), 0.10, 0.10, 0.002, 0x7a7468, 1.0, seg=16, name='ash', proxy=False)
    for (x0, x1, h) in ((-0.03, -0.04, 0.22), (0.03, 0.05, 0.20)):
        A.rod('wood', (x0, ty + 0.07, -0.10), (x1, ty + 0.07 + h, -0.10), 0.0028, 0.0028, 0x9a7a4a, 1.0, seg=6, caps=False, name='incense', proxy=False)
        A.blob('emit', (x1, ty + 0.07 + h, -0.10), (0.004, 0.006, 0.004), 0xd84a2a, 1.0, seg=6, name='ember', proxy=False)
    # 蜡烛
    for s in (-1, 1):
        x = s * 0.45
        A.cyl('metal', (x, ty, 0), 0.05, 0.04, 0.03, 0x8a7a52, 1.1, seg=16, name='candle_tray')
        A.cyl('plastic', (x, ty + 0.03, 0), 0.03, 0.03, 0.27, 0xf0e8d8, 1.1, seg=14, name='candle')
        if not A.lo:
            A.blob('plastic', (x + 0.02, ty + 0.25, 0.022), (0.008, 0.03, 0.008), 0xf4ecdc, 1.1, seg=8, name='drip', proxy=False)
        A.rod('dark', (x, ty + 0.30, 0), (x, ty + 0.315, 0), 0.0015, 0.0015, 0x1a1a1a, 1.0, seg=4, caps=False, name='wick', proxy=False)
        A.blob('emit', (x, ty + 0.335, 0), (0.012, 0.03, 0.012), 0xffc860, 1.0, seg=10, name='flame', proxy=False)
    # 一碗饭、竖着的筷子
    A.lathe('plastic', (0.2, ty, 0.12), [(0, 0), (0.035, 0), (0.035, 0.008), (0.05, 0.02), (0.075, 0.06), (0.072, 0.062), (0.05, 0.022), (0, 0.02)], 0xe8e2d4, 1.1, seg=20, name='bowl')
    A.blob('fabric', (0.2, ty + 0.06, 0.12), (0.066, 0.03, 0.066), 0xf4f0e6, 1.0, seg=12, jit=0.15, seed=4, name='rice')
    for dx in (-0.005, 0.015):
        A.rod('wood', (0.2 + dx, ty + 0.04, 0.12), (0.2 + dx * 1.5, ty + 0.25, 0.12), 0.0035, 0.0028, 0x3a2a1a, 1.0, seg=6, name='chopstick', proxy=False)
    # 相框
    with A.at(-0.18, 0, 0.05, ry=0.25):
        A.box('wood', (0, 0.95, 0), (0.16, 0.22, 0.015), 0x2a2018, 1.0, bev=0.003, name='frame', rot=(-0.12, 0, 0))
        A.box('paper', (0, 0.95, 0.0085), (0.12, 0.17, 0.002), 0xd8d4c6, 1.0, rot=(-0.12, 0, 0), name='photo', proxy=False)
        A.box('dark', (0, 0.99, 0.0105), (0.06, 0.06, 0.001), 0x0a0a0a, 1.0, rot=(-0.12, 0, 0), name='cutout', proxy=False)
        A.box('wood', (0, 0.88, -0.04), (0.03, 0.14, 0.008), 0x2a2018, 1.0, rot=(0.5, 0, 0), name='stand', proxy=False)


# ---------------------------------------------------------------- 连廊吊牌、洗手台、铁皮柜、乒乓球台
@asset('sign_hanging', ao=0.3, ground=False, ceil=3.0)
def sign_hanging(A):
    """连廊入口的吊牌：一根吊杆、绿色牌子，正面一块发光的字面（字由游戏里另贴）。原点在地面。"""
    A.rod('metal', (0, 3.0, 0), (0, 2.85, 0), 0.006, 0.006, 0x6a6e72, 1.0, seg=8, caps=False, name='rod')
    A.cyl('metal', (0, 2.995, 0), 0.03, 0.03, 0.005, 0x6a6e72, 1.0, seg=10, name='plate', proxy=False)
    rpanel(A, 'plastic', (0, 2.75, 0), 0.70, 0.20, 0.03, 0.02, 0x2a6a4a, 1.0, name='sign')
    A.box('emit', (0, 2.75, 0.0155), (0.56, 0.12, 0.002), 0xd8f0e0, 0.8, name='face', proxy=False)
    A.box('emit', (0, 2.75, -0.0155), (0.56, 0.12, 0.002), 0xd8f0e0, 0.8, name='face', proxy=False)


@asset('washbasin', ao=0.4)
def washbasin(A):
    """洗手台：石台面、嵌着的白瓷面盆、台下的方柱、鹅颈龙头（一个旋钮）。"""
    A.box('stone', (0, 0.80, 0), (0.80, 0.06, 0.62), 0xc2c8cb, 1.05, bev=0.008, name='top')
    A.lathe('plastic', (0, 0.66, 0), [(0, 0), (0.12, 0.0), (0.16, 0.05), (0.20, 0.14), (0.205, 0.17), (0.19, 0.17), (0.15, 0.08), (0.1, 0.03), (0, 0.028)], 0xe8ecec, 1.05, seg=24, name='basin')
    A.cyl('metal', (0, 0.688, 0), 0.02, 0.02, 0.002, 0x8a9294, 1.1, seg=12, name='drain', proxy=False)
    A.box('stone', (0, 0.40, -0.04), (0.20, 0.77, 0.20), 0xb8bec0, 1.0, bev=0.006, name='column')
    A.cyl('metal', (0, 0.83, -0.22), 0.02, 0.018, 0.03, 0xc0c8cc, 1.3, seg=12, name='faucet_base')
    A.tube('metal', [(0, 0.84, -0.22), (0, 0.98, -0.22), (0, 0.98, -0.14), (0, 0.95, -0.11)], 0.011, 0xc0c8cc, 1.3, seg=10, bend=0.04, name='faucet')
    if not A.lo:
        A.rod('metal', (0, 0.88, -0.22), (0.05, 0.89, -0.22), 0.006, 0.006, 0xc0c8cc, 1.3, seg=8, name='lever', proxy=False)


@asset('cabinet_tall', ao=0.35)
def cabinet_tall(A):
    """铁皮立柜：两扇门、门缝、拉手、顶上的通风孔、底座。"""
    A.box('metal', (0, 0.85, 0), (0.70, 1.70, 0.55), 0x9aa0a4, 1.0, bev=0.008, name='body')
    if not A.lo:
        A.box('metal', (0, 0.04, 0), (0.66, 0.08, 0.50), 0x6a7074, 0.8, name='base', proxy=False)
        for s in (-1, 1):
            A.box('metal', (s * 0.172, 0.88, 0.2765), (0.338, 1.56, 0.004), 0xa2a8ac, 1.0, bev=0.002, name='door', proxy=False)
            handle_bar(A, (s * 0.04, 0.95, 0.278), 0.12, STEEL, axis='y', off=0.018)
            for k in range(5):
                A.box('dark', (s * 0.172, 1.50 + k * 0.025, 0.2795), (0.20, 0.008, 0.002), 0x3a4044, 1.0, name='vent', proxy=False)


@asset('pingpong_table', ao=0.45)
def pingpong_table(A):
    """乒乓球台：深蓝台面、白线、中间的网（网架、网格）、折叠台的钢架和四个带轮的脚。"""
    A.box('wood', (0, 0.76, 0), (1.52, 0.03, 2.74), 0x1f3f6e, 1.15, bev=0.004, name='top')
    A.box('paper', (0, 0.776, 0), (0.02, 0.002, 2.70), 0xe8e8e8, 1.0, name='line', proxy=False)
    for s in (-1, 1):
        A.box('paper', (s * 0.75, 0.776, 0), (0.02, 0.002, 2.70), 0xe8e8e8, 1.0, name='line', proxy=False)
        A.box('paper', (0, 0.776, s * 1.36), (1.50, 0.002, 0.02), 0xe8e8e8, 1.0, name='line', proxy=False)
    for lx in (-1, 1):
        for lz in (-1, 1):
            A.rod('metal', (lx * 0.62, 0.0, lz * 1.10), (lx * 0.62, 0.745, lz * 1.10), 0.025, 0.025, 0x3a3f42, 1.0, seg=10, name='leg')
            if not A.lo:
                A.cyl('plastic', (lx * 0.62, 0.0, lz * 1.10), 0.03, 0.03, 0.04, BLACK, 1.0, seg=10, name='foot', proxy=False)
        A.rod('metal', (lx * 0.62, 0.30, -1.10), (lx * 0.62, 0.30, 1.10), 0.015, 0.015, 0x3a3f42, 1.0, seg=8, caps=False, name='rail', proxy=False)
    for s in (-1, 1):
        A.rod('metal', (s * 0.80, 0.76, 0), (s * 0.80, 0.94, 0), 0.012, 0.012, 0x3a3f42, 1.0, seg=8, name='net_post')
    A.box('fabric', (0, 0.86, 0), (1.60, 0.15, 0.006), 0xd8d8d2, 0.95, name='net')
    if not A.lo:
        A.box('fabric', (0, 0.935, 0), (1.60, 0.012, 0.01), 0xf0f0ea, 1.0, name='net_tape', proxy=False)
