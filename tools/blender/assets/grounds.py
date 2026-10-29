"""校园里零碎的东西：LED 路灯、公园长椅、井盖、旗杆、宣传栏、花园的不锈钢雕塑、砖砌花坛。游戏坐标（米，y 朝上）。"""
import math
import random

from mathutils import Vector

from wdfz import asset
from assets._parts import BLACK, screw

POLE = 0x252c31


@asset('street_lamp', ao=0.35, inst=True)
def street_lamp(A):
    """LED 路灯（局部 +x 伸向路面）：带检修门和螺栓的铸铁底座、上细下粗的灯杆、一节节弯过去的灯臂、扁的灯头（下面是发光面，散热片朝上）。"""
    A.box('concrete', (0, 0.04, 0), (0.5, 0.08, 0.5), 0x8e8a84, 1.0, bev=0.012, name='footing')
    A.lathe('metal', (0, 0.08, 0), [(0.17, 0.0), (0.17, 0.05), (0.13, 0.09), (0.115, 0.56), (0.095, 0.60), (0.09, 0.62)], 0x3a4146, 1.0, seg=16, sharp=40, name='base')
    if not A.lo:
        A.box('metal', (0.117, 0.36, 0), (0.012, 0.30, 0.12), 0x30373c, 1.0, bev=0.003, name='hatch', proxy=False)
        if A.hi:
            screw(A, (0.124, 0.49, 0), (1, 0, 0), 0.005)
            screw(A, (0.124, 0.23, 0), (1, 0, 0), 0.005)
            for k in range(4):
                a = k * math.pi / 2 + math.pi / 4
                A.cyl('metal', (math.cos(a) * 0.15, 0.08, math.sin(a) * 0.15), 0.014, 0.014, 0.03, 0x5a6064, 1.0, seg=6, name='nut', proxy=False)
    A.lathe('metal', (0, 0.70, 0), [(0.085, 0.0), (0.05, 4.0), (0.045, 4.12), (0.0, 4.13)], POLE, 1.0, seg=14, name='pole')
    A.tube('metal', [(0, 4.70, 0), (0, 4.86, 0), (0.12, 4.97, 0), (0.62, 5.00, 0)], 0.036, POLE, 1.0, seg=10, bend=0.14, name='arm')
    A.cyl('metal', (0, 4.70, 0), 0.05, 0.045, 0.08, POLE, 1.0, seg=12, name='collar', proxy=False)
    # 灯头：上壳（散热片）、下面的发光面
    A.prism('metal', (0, 0, 0), [(0.56, 4.885), (1.27, 4.85), (1.33, 4.885), (1.25, 4.95), (0.62, 5.04)], 0.32, 0x2a3238, 1.0, bev=0.012, name='head')
    if A.hi:
        for k in range(6):
            A.box('metal', (0.75 + k * 0.08, 4.985 - k * 0.012, 0), (0.012, 0.03, 0.26), 0x2f383e, 1.0, name='fin', proxy=False)
    A.box('lamp', (0.95, 4.842, 0), (0.56, 0.012, 0.24), 0xffffff, 1.0, name='led', proxy=False)
    A.anchor('light', (0.95, 4.82, 0))


@asset('bench_park', ao=0.35, inst=True)
def bench_park(A):
    """公园长椅（人坐着面朝 +z）：两片铸铁的侧架（椅腿、扶手、靠背支撑一体，弯的）、四根坐板、三根靠背板（圆角、两头螺栓）、底下一根拉杆。"""
    IRON = 0x2a2622
    WOOD = 0x7a5434
    for s in (-1, 1):
        x = s * 0.85
        A.tube('metal', [(x, 0.0, 0.22), (x, 0.40, 0.18), (x, 0.42, -0.10), (x, 0.40, -0.24), (x, 0.0, -0.22)], 0.022, IRON, 1.0, seg=8, bend=0.06, ellip=0.6, name='side')
        A.tube('metal', [(x, 0.40, -0.22), (x, 0.62, -0.30), (x, 0.92, -0.36)], 0.02, IRON, 1.0, seg=8, bend=0.1, ellip=0.6, name='back_support')
        A.tube('metal', [(x, 0.42, -0.25), (x, 0.66, -0.12), (x, 0.66, 0.16), (x, 0.42, 0.22)], 0.018, IRON, 1.0, seg=8, bend=0.08, ellip=0.8, name='arm')
        for z in (0.22, -0.22):
            A.box('metal', (x, 0.01, z), (0.06, 0.02, 0.08), IRON, 0.9, bev=0.004, name='foot', proxy=False)
    A.rod('metal', (-0.85, 0.12, 0.0), (0.85, 0.12, 0.0), 0.012, 0.012, IRON, 1.0, seg=8, name='stretcher', proxy=False)
    for k in range(4):
        z = -0.17 + k * 0.115
        A.box('wood', (0, 0.445, z), (1.96, 0.035, 0.09), WOOD, 1.0 - (k % 2) * 0.05, bev=0.008, name='seat')
        if A.hi:
            for s in (-1, 1):
                A.cyl('metal', (s * 0.85, 0.463, z), 0.008, 0.008, 0.003, 0x8a9094, 1.1, seg=8, name='bolt', proxy=False)
    for k in range(3):
        y = 0.60 + k * 0.12
        z = -0.29 - k * 0.025
        A.box('wood', (0, y, z), (1.96, 0.085, 0.03), WOOD, 0.95, bev=0.008, rot=(-0.22, 0, 0), name='back')


@asset('manhole', ao=0.2, inst=True)
def manhole(A):
    """铸铁井盖：方形的边框、圆盖（一圈圈的筋、中间的字盘、两个撬孔），表面磨得发亮的花纹。"""
    IRON = 0x3a3c3e
    A.box('metal', (0, 0.006, 0), (0.86, 0.012, 0.86), 0x46484a, 1.0, bev=0.004, name='frame')
    A.cyl('metal', (0, 0.0, 0), 0.36, 0.36, 0.018, IRON, 1.0, seg=28, round_=0.004, name='cover')
    if not A.lo:
        for r in (0.30, 0.22, 0.14):
            pts = [(math.cos(a) * r, 0.0185, math.sin(a) * r) for a in [i / 28 * 2 * math.pi for i in range(28)]]
            A.tube('metal', pts, 0.006, 0x4a4c4e, 1.08, seg=4, closed=True, name='rib', proxy=False)
        A.cyl('metal', (0, 0.018, 0), 0.08, 0.08, 0.004, 0x505254, 1.1, seg=16, name='badge', proxy=False)
        for s in (-1, 1):
            A.box('dark', (s * 0.26, 0.0185, 0), (0.035, 0.002, 0.012), 0x101112, 1.0, name='pick_hole', proxy=False)
        if A.hi:
            for k in range(12):
                a = k / 12 * 2 * math.pi
                A.box('metal', (math.cos(a) * 0.18, 0.019, math.sin(a) * 0.18), (0.06, 0.004, 0.012), 0x55575a, 1.1, rot=(0, -a, 0), name='grip', proxy=False)


@asset('flagpole', ao=0.4)
def flagpole(A):
    """旗杆：两级石台、不锈钢杆（上细下粗）、金色顶球、滑轮、拉绳和绳栓；红旗垂着，被风吹起一点褶。"""
    A.box('stone', (0, 0.15, 0), (2.2, 0.30, 2.2), 0xb2ada4, 1.0, bev=0.04, name='base')
    A.box('stone', (0, 0.38, 0), (1.4, 0.16, 1.4), 0xc2bdb4, 1.0, bev=0.03, name='base2')
    A.lathe('metal', (0, 0.46, 0), [(0.10, 0.0), (0.09, 0.12), (0.07, 5.0), (0.05, 10.0), (0.0, 10.01)], 0xb8bcbe, 1.06, seg=16, name='pole')
    A.blob('metal', (0, 10.55, 0), (0.10, 0.10, 0.10), 0xc8a24a, 1.25, seg=12, name='ball')
    A.cyl('metal', (0, 10.40, 0), 0.03, 0.03, 0.06, 0x9aa0a4, 1.0, seg=10, dirn=(0, 0, 1), name='pulley', proxy=False)
    A.rod('metal', (0.06, 0.9, 0), (0.06, 10.4, 0), 0.004, 0.004, 0xd8d8d0, 1.0, seg=4, caps=False, name='rope', proxy=False)
    A.box('metal', (0.07, 1.2, 0), (0.03, 0.12, 0.03), 0x8a9094, 1.0, name='cleat', proxy=False)
    # 旗：一片有褶的布（沿 x 方向起伏）
    n = (16, 10, 6, 2)[A.L]
    verts, faces = [], []
    for i in range(n + 1):
        u = i / n
        x = 0.08 + u * 1.6
        dz = math.sin(u * math.pi * 2.2) * 0.08 * u
        sag = -0.12 * u * u
        for j, y in enumerate((9.1 + sag, 10.1 + sag * 0.6)):
            verts.append((x, y, dz))
    for i in range(n):
        a, b, c, d = 2 * i, 2 * i + 2, 2 * i + 3, 2 * i + 1
        faces.append((a, b, c, d))
        faces.append((d, c, b, a))
    A.mesh('fabric', verts, faces, 0xc0362c, 1.0, smooth=True, sharp=None, name='flag')


@asset('board_outdoor', ao=0.35)
def board_outdoor(A):
    """路边的宣传栏（正面 +z）：两根立柱、带铝边的框和玻璃、背板、顶上的红色雨檐；海报游戏里按位置贴。"""
    PC = 0x2a3238
    for s in (-1, 1):
        A.cyl('metal', (s * 2.0, 0, 0), 0.05, 0.05, 2.3, PC, 1.0, seg=12, name='post')
        A.cyl('concrete', (s * 2.0, 0, 0), 0.12, 0.12, 0.06, 0x8e8a84, 1.0, seg=12, name='foot')
    A.box('metal', (0, 1.35, -0.02), (4.1, 1.5, 0.06), PC, 1.0, bev=0.01, name='back')
    for (x, y, w, h) in ((0, 2.08, 4.1, 0.05), (0, 0.62, 4.1, 0.05), (-2.03, 1.35, 0.05, 1.5), (2.03, 1.35, 0.05, 1.5)):
        A.box('metal', (x, y, 0.06), (w, h, 0.06), 0x9aa0a4, 1.05, bev=0.006, name='frame')
    A.box('paper', (0, 1.35, 0.012), (3.9, 1.3, 0.004), 0xd8d2c4, 1.0, name='paper', proxy=False)
    A.box('glass', (0, 1.35, 0.08), (3.96, 1.38, 0.008), 0xb8c8d0, 1.1, name='glass', proxy=False)
    A.prism('plastic', (0, 2.20, 0), [(-2.25, -0.05), (2.25, -0.05), (2.25, 0.03), (0.0, 0.10), (-2.25, 0.03)], 0.5, 0x8b3a2e, 1.0, rot=(0, 0, 0), name='canopy')
    if A.hi:
        for s in (-1, 1):
            A.box('metal', (s * 1.0, 1.35, 0.088), (0.02, 0.02, 0.006), 0x8a9094, 1.1, name='lock', proxy=False)


@asset('sculpture_ring', ao=0.45)
def sculpture_ring(A):
    """花园里的不锈钢雕塑：石墩上两根斜撑托着一个大圆环（截面是圆的，抛光），环里一颗小球。"""
    SS = 0xb8c0c4
    A.box('stone', (0, 0.21, 0), (2.8, 0.42, 2.8), 0xa8a298, 1.0, bev=0.05, name='plinth')
    A.box('stone', (0, 0.45, 0), (2.2, 0.06, 2.2), 0xb8b2a8, 1.0, bev=0.02, name='plinth_top')
    A.tube('metal', [(0, 0.48, 0), (0.2, 1.6, 0.1), (0.4, 2.55, 0.2)], 0.11, SS, 1.12, seg=14, bend=0.4, r1=0.06, name='strut')
    A.tube('metal', [(0, 0.48, 0), (-0.3, 1.5, -0.15), (-0.55, 2.65, -0.3)], 0.10, SS, 1.08, seg=14, bend=0.4, r1=0.05, name='strut')
    pts = [(0.4 + math.cos(a) * 0.9, 3.4 + math.sin(a) * 0.9, 0.2) for a in [i / 32 * 2 * math.pi for i in range(32)]]
    A.tube('metal', pts, 0.07, 0xc8d0d4, 1.18, seg=14, closed=True, name='ring')
    A.blob('metal', (0.4, 3.4, 0.2), (0.16, 0.16, 0.16), 0xd8dde0, 1.2, seg=14, name='orb')


def flowerbed(A, n):
    """砖砌花坛（2.8×1.3）：四面砖墙（压顶砖）、土、一丛丛花（茎、叶、花头五种颜色）。"""
    BR = 0x8a8478
    for (x, z, sx, sz) in ((0, -0.65, 2.8, 0.12), (0, 0.65, 2.8, 0.12), (-1.34, 0, 0.12, 1.18), (1.34, 0, 0.12, 1.18)):
        A.box('brick', (x, 0.18, z), (sx, 0.36, sz), BR, 1.0, bev=0.006, name='wall')
        A.box('stone', (x, 0.38, z), (sx + 0.02, 0.04, sz + 0.03), 0xa09a8e, 1.04, bev=0.006, name='coping')
    A.box('concrete', (0, 0.36, 0), (2.56, 0.04, 1.18), 0x3a2b22, 1.0, name='soil', proxy=False)
    cols = [0xb24a4a, 0xc8a24a, 0xa85a8a, 0xd8d4e8, 0xc86a3a]
    rnd = random.Random(5)
    nrow = max(1, int(math.ceil(n / 7)))
    for k in range(n):
        x = -1.1 + (k % 7) * 0.36 + (rnd.random() - 0.5) * 0.08
        z = ((k // 7) / (nrow - 1) - 0.5) * 0.6 if nrow > 1 else 0.0
        z += (rnd.random() - 0.5) * 0.12
        h = 0.10 + rnd.random() * 0.08
        A.rod('leaf', (x, 0.38, z), (x + (rnd.random() - 0.5) * 0.04, 0.38 + h, z), 0.012, 0.008, 0x4a6a3a, 1.0, seg=4, caps=False, name='stem', proxy=False)
        if A.L == 0:
            for s in (-1, 1):
                A.blob('leaf', (x + s * 0.035, 0.40 + h * 0.4, z), (0.04, 0.012, 0.02), 0x3f6a36, 1.0, seg=4, rot=(0, s * 0.6, 0.3 * s), name='leaf', proxy=False)
        A.blob('leaf', (x, 0.40 + h, z), (0.07, 0.05, 0.07), cols[k % 5], 1.05, seg=5 if A.L <= 1 else 4, jit=0.35, seed=k, name='bloom', proxy=False)
    A.proxy_box((0, 0.2, 0), (2.8, 0.4, 1.3))


asset('flowerbed', ao=0.35, inst=True)(lambda A: flowerbed(A, (35, 28, 14, 7)[A.L]))
