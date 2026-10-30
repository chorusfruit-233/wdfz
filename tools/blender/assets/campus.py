"""校园设施：电动车棚（门式钢架、一米一段的波纹板屋面、充电箱）、篮球架、足球门、羽毛球网柱、
围墙（石柱、两米一段的铁艺栏杆）、校门（门柱、一段段的铁栅门、三辊闸、挂锁和铁链）、车库道闸的机箱、钟楼的钟面和尖拱窗。
游戏坐标（米，y 朝上）。"""
import math

from mathutils import Vector, Matrix

from wdfz import asset, V
from assets._parts import STEEL, CHROME, BLACK, screw, led
from assets.exterior import beam

PAINT = 0x2b343b


# ====================================================================== 电动车棚
SHED_HW = 4.0                      # 屋面半宽（棚宽 8 米）
SHED_COL = 3.36                    # 柱子离中线


def shed_roof_y(x):
    """屋面板顶（波峰）的高度：西高东低，坡度 5%。"""
    return 3.46 - 0.05 * (x + SHED_HW)


@asset('shed_frame', ao=0.4, inst=True)
def shed_frame(A):
    """车棚的一榀门式钢架（局部 x 横跨车棚，原点在两柱中间的地面）：圆钢管柱（混凝土墩、底板、地脚螺栓、柱帽）、
    矩形管斜梁（两头挑出）、两根斜撑、梁柱节点的加劲板。"""
    for s in (-1, 1):
        x = s * SHED_COL
        top = shed_roof_y(x) - 0.277
        A.box('concrete', (x, 0.06, 0), (0.45, 0.12, 0.45), 0x9a968e, 1.0, bev=0.015, name='footing')
        A.box('metal', (x, 0.13, 0), (0.30, 0.02, 0.30), PAINT, 1.0, bev=0.003, name='base_plate')
        if not A.lo:
            for (dx, dz) in ((-1, -1), (-1, 1), (1, -1), (1, 1)):
                A.cyl('metal', (x + dx * 0.11, 0.14, dz * 0.11), 0.012, 0.012, 0.03, 0x6a7074, 1.0, seg=6, name='bolt', proxy=False)
                if A.hi:
                    A.cyl('metal', (x + dx * 0.11, 0.14, dz * 0.11), 0.02, 0.02, 0.012, 0x5a6064, 1.0, seg=6, name='nut', proxy=False)
        A.cyl('metal', (x, 0.14, 0), 0.08, 0.08, top - 0.14, PAINT, 1.06, seg=16, name='column')
        A.box('metal', (x, top + 0.005, 0), (0.20, 0.01, 0.16), PAINT, 1.0, name='cap', proxy=False)
        # 斜撑
        kx = x - s * 1.1
        beam(A, 'metal', (x - s * 0.06, top - 0.75, 0), (kx, shed_roof_y(kx) - 0.30, 0), 0.05, 0.05, PAINT, 1.0, bev=0.003, name='knee')
        if A.hi:
            A.prism('metal', (x, top + 0.07, 0), [(-0.1, 0), (0.1, 0), (0.0, -0.18)], 0.01, PAINT, 1.0, name='gusset', proxy=False)
    # 斜梁（矩形管 80×150），两头比柱子挑出去
    xa, xb = -SHED_HW - 0.05, SHED_HW + 0.05
    beam(A, 'metal', (xa, shed_roof_y(xa) - 0.202, 0), (xb, shed_roof_y(xb) - 0.202, 0), 0.08, 0.15, PAINT, 1.04, bev=0.004, name='rafter')


@asset('shed_roof_1m', ao=0.3, ground=False, inst=True)
def shed_roof_1m(A):
    """一米长的一段车棚屋面（局部 x 沿棚长、z 横跨车棚；游戏里转 90° 放，一段段接满全棚，沿长度方向略拉伸）：
    压型钢板（梯形波，肋顺着坡往下）、五根 C 型檩条、低的一边的天沟、高的一边的包边。"""
    SH = 0x3a4a52
    slope = math.atan(0.05)
    p = (0.2, 0.2, 0.25, 0.5)[A.L]
    hr = 0.025 if not A.lo else 0.0
    t = 0.004
    if A.lo:
        prof = [(-0.5, -0.004), (0.5, -0.004), (0.5, 0.0), (-0.5, 0.0)]
    else:
        top = []
        n = int(round(1.0 / p))
        for k in range(n):
            u0 = -0.5 + k * p
            for (f, h) in ((0.0, 0.0), (0.4, 0.0), (0.5, hr), (0.9, hr)):
                top.append((u0 + f * p, h - hr))
        top.append((0.5, -hr))
        bot = [(u, v - t) for (u, v) in top]
        prof = top + list(reversed(bot))
    with A.at(0, shed_roof_y(0.0), 0, rx=slope):
        A.prism('metal', (0, 0, 0), prof, 2 * SHED_HW + 0.2, SH, 1.0, name='sheet', proxy=False)
    A.proxy_box((0, shed_roof_y(0.0) - 0.01, 0), (1.0, 0.42, 2 * SHED_HW + 0.2))
    # 檩条：C 型钢，沿棚长
    for z in (-3.9, -1.95, 0.0, 1.95, 3.9):
        y = shed_roof_y(z) - 0.027 - 0.05
        if A.L >= 2:
            A.box('metal', (0, y, z), (1.0, 0.10, 0.05), 0x5a6a72, 1.0, name='purlin', proxy=False)
        else:
            c = [(-0.025, -0.05), (0.025, -0.05), (0.025, -0.044), (-0.019, -0.044), (-0.019, 0.044), (0.025, 0.044), (0.025, 0.05), (-0.025, 0.05)]
            A.prism('metal', (0, y, z), c, 1.0, 0x5a6a72, 1.0, axis='x', name='purlin', proxy=False)
    # 天沟（低的一边）、包边（高的一边）
    gz = SHED_HW + 0.14
    gy = shed_roof_y(SHED_HW) - 0.10
    u = [(-0.08, 0.0), (0.08, 0.0), (0.08, 0.12), (0.07, 0.12), (0.07, 0.01), (-0.07, 0.01), (-0.07, 0.10), (-0.08, 0.10)]
    A.prism('metal', (0, gy, gz), u, 1.0, 0x8a9298, 1.0, axis='x', name='gutter', proxy=False)
    hz = -SHED_HW - 0.11
    A.box('metal', (0, shed_roof_y(hz) - 0.05, hz), (1.0, 0.14, 0.01), 0x8a9298, 1.0, name='flashing', proxy=False)


@asset('shed_charger', ao=0.35, inst=True)
def shed_charger(A):
    """车棚柱子上的充电箱（局部 +z 朝人，原点在柱子轴线的地面）：灰色铁箱、一排插座小门、指示灯、贴的二维码、
    顺着柱子上去的线管，两根垂下来的充电线。"""
    z0 = 0.08 + 0.065
    A.box('metal', (0, 1.30, z0), (0.36, 0.46, 0.13), 0x8a9094, 1.0, bev=0.008, name='box')
    A.box('metal', (0, 1.55, z0 + 0.01), (0.40, 0.03, 0.16), 0x7a8084, 1.0, bev=0.004, name='hood')
    for k in range(6):
        x = -0.12 + (k % 3) * 0.12
        y = 1.22 + (k // 3) * 0.12
        A.box('plastic', (x, y, z0 + 0.066), (0.08, 0.08, 0.004), 0x2a2e30, 1.0, bev=0.002, name='socket_door', proxy=False)
        led(A, (x + 0.03, y + 0.05, z0 + 0.066), 0x39c08a if k % 4 else 0xd84a3a, 0.006)
    if not A.lo:
        A.box('paper', (0.0, 1.45, z0 + 0.0656), (0.10, 0.10, 0.001), 0xf0f0ec, 1.0, name='qr', proxy=False)
        if A.hi:
            import random
            rnd = random.Random(7)
            for i in range(7):
                for j in range(7):
                    if rnd.random() < 0.5 or (i < 2 and j < 2) or (i > 4 and j < 2) or (i < 2 and j > 4):
                        A.box('dark', (-0.042 + i * 0.014, 1.408 + j * 0.014, z0 + 0.0662), (0.012, 0.012, 0.0005), 0x111111, 1.0, name='qr_px', proxy=False)
        A.cyl('metal', (0.0, 1.53, z0), 0.016, 0.016, 1.55, 0x9aa0a4, 1.0, seg=8, name='conduit', proxy=False)
        for (x, sag) in ((-0.12, 0.5), (0.12, 0.35)):
            A.tube('plastic', [(x, 1.18, z0 + 0.07), (x, 0.95, z0 + 0.12), (x + 0.05, 1.18 - sag - 0.3, z0 + 0.10), (x + 0.1, 1.0, z0 + 0.08)], 0.006, BLACK, 1.0, seg=6, bend=0.12, name='cable', proxy=False)


# ====================================================================== 球场
@asset('hoop_stand', ao=0.35, inst=True)
def hoop_stand(A):
    """篮球架（原点在立柱脚下，伸臂朝 +z）：混凝土墩、法兰和地脚螺栓、上细下粗的钢立柱（下半截包着防撞软包）、
    桁架伸臂、篮板（铝边框、白板面、红色边线和投篮框）、篮圈（底座、加强杆）、尼龙网（菱形网眼）。"""
    PC = 0x2f3a44
    A.box('concrete', (0, 0.06, 0), (0.75, 0.12, 0.75), 0x8a8a86, 1.0, bev=0.02, name='footing')
    A.cyl('metal', (0, 0.12, 0), 0.20, 0.20, 0.02, PC, 1.0, seg=20, name='flange')
    if not A.lo:
        for k in range(6):
            a = k * math.pi / 3
            A.cyl('metal', (math.cos(a) * 0.16, 0.14, math.sin(a) * 0.16), 0.014, 0.014, 0.025, 0x6a7074, 1.0, seg=6, name='nut', proxy=False)
    A.lathe('metal', (0, 0.14, 0), [(0.095, 0.0), (0.075, 3.25), (0.06, 3.27), (0.0, 3.28)], PC, 1.05, seg=18, name='pole')
    A.cyl('fabric', (0, 0.18, 0), 0.135, 0.135, 1.7, 0x23477a, 1.0, seg=18, round_=0.03, name='padding')
    # 伸臂：上下两根管 + 竖杆、斜杆
    for s in (-1, 1):
        x = s * 0.12
        A.rod('metal', (x, 2.95, 0.05), (x, 3.05, 1.12), 0.035, 0.035, PC, 1.0, seg=10, name='boom_low')
        A.rod('metal', (x, 3.40, 0.05), (x, 3.55, 1.12), 0.035, 0.035, PC, 1.0, seg=10, name='boom_high')
        for (za, zb) in ((0.35, 0.65), (0.65, 0.95)):
            A.rod('metal', (x, 2.95 + 0.1 * za / 1.07, za), (x, 3.40 + 0.15 * zb / 1.07, zb), 0.018, 0.018, PC, 1.0, seg=8, name='strut', proxy=False)
        A.rod('metal', (x, 2.97, 0.30), (x, 3.43, 0.30), 0.018, 0.018, PC, 1.0, seg=8, name='strut', proxy=False)
    for (y, z) in ((2.95, 0.05), (3.40, 0.05), (3.05, 1.12), (3.55, 1.12)):
        A.rod('metal', (-0.12, y, z), (0.12, y, z), 0.03, 0.03, PC, 1.0, seg=8, name='tie', proxy=False)
    # 篮板
    bz, by = 1.20, 3.425
    A.box('plastic', (0, by, bz), (1.8, 1.05, 0.04), 0xe8e8e4, 1.05, bev=0.006, name='board')
    for (x, y, w, h) in ((0, by + 0.525, 1.84, 0.04), (0, by - 0.525, 1.84, 0.04), (-0.92, by, 0.04, 1.09), (0.92, by, 0.04, 1.09)):
        A.box('metal', (x, y, bz), (w, h, 0.06), 0xb8bcbe, 1.0, bev=0.006, name='board_frame', proxy=False)
    RED = 0xb03a2a
    zf = bz + 0.0205
    for (x, y, w, h) in ((0, by + 0.475, 1.70, 0.05), (0, by - 0.475, 1.70, 0.05), (-0.85, by, 0.05, 1.0), (0.85, by, 0.05, 1.0),
                         (0, 3.05 + 0.45 - 0.025, 0.59, 0.05), (0, 3.05 + 0.025, 0.59, 0.05), (-0.27, 3.275, 0.05, 0.45), (0.27, 3.275, 0.05, 0.45)):
        A.box('plastic', (x, y, zf + 0.0006), (w, h, 0.0012), RED, 1.0, name='mark', proxy=False)
    # 篮圈
    R, rz, ry = 0.2286, bz + 0.02 + 0.151 + 0.2286, 3.05
    pts = [(math.cos(a) * R, ry, rz + math.sin(a) * R) for a in [k / 24 * 2 * math.pi for k in range(24)]]
    A.tube('metal', pts, 0.009, 0xd0582a, 1.1, seg=8, closed=True, name='rim')
    A.box('metal', (0, ry - 0.06, bz + 0.03), (0.30, 0.16, 0.012), 0xd0582a, 1.0, bev=0.003, name='rim_plate')
    for s in (-1, 1):
        A.rod('metal', (s * 0.07, ry - 0.12, bz + 0.03), (s * 0.05, ry - 0.005, rz - R + 0.01), 0.008, 0.008, 0xd0582a, 1.0, seg=6, name='rim_brace', proxy=False)
    A.rod('metal', (0, ry, bz + 0.03), (0, ry, rz - R), 0.009, 0.009, 0xd0582a, 1.0, seg=6, name='rim_neck', proxy=False)
    A.proxy_cyl((0, ry - 0.45, rz), R, R, 0.45)
    # 网
    NET = 0xe8e8e0
    if A.L <= 1:
        nk = 12
        levels = [(0.0, R), (-0.12, 0.205), (-0.24, 0.18), (-0.34, 0.16), (-0.42, 0.145)]
        def P(i, j):
            off = 0.5 if j % 2 else 0.0
            a = (i + off) / nk * 2 * math.pi
            return (math.cos(a) * levels[j][1], ry + levels[j][0], rz + math.sin(a) * levels[j][1])
        for j in range(len(levels) - 1):
            for i in range(nk):
                a = P(i, j)
                for di in ((0, -1) if j % 2 == 0 else (0, 1)):
                    b = P(i + di, j + 1)
                    A.rod('fabric', a, b, 0.003, 0.003, NET, 1.0, seg=3, caps=False, name='net', proxy=False)
    elif A.L == 2:
        for i in range(8):
            a = i / 8 * 2 * math.pi
            A.rod('fabric', (math.cos(a) * R, ry, rz + math.sin(a) * R), (math.cos(a) * R * 0.6, ry - 0.40, rz + math.sin(a) * R * 0.6), 0.004, 0.004, NET, 1.0, seg=3, caps=False, name='net', proxy=False)


@asset('soccer_goal', ao=0.3, inst=True)
def soccer_goal(A):
    """小足球门（球门口朝 +z，网兜往 -z）：白色圆管门柱和横梁（转角弯过去）、地上的底框、两根斜拉的后撑、
    网（后面一片往外鼓一点、两侧三角片），地钉。"""
    WHT = 0xe8e8e2
    w2, h, d = 1.6, 2.0, 0.9
    A.tube('metal', [(-w2, 0.0, 0), (-w2, h, 0), (w2, h, 0), (w2, 0.0, 0)], 0.05, WHT, 1.1, seg=14, bend=0.06, name='frame')
    for s in (-1, 1):
        A.tube('metal', [(s * w2, h - 0.05, 0), (s * w2, 0.03, -d)], 0.025, 0xc8ccc8, 1.0, seg=8, name='stay')
        A.rod('metal', (s * w2, 0.03, 0.0), (s * w2, 0.03, -d), 0.025, 0.025, 0xc8ccc8, 1.0, seg=8, name='ground_side')
    A.rod('metal', (-w2, 0.03, -d), (w2, 0.03, -d), 0.025, 0.025, 0xc8ccc8, 1.0, seg=8, name='ground_back')
    if not A.lo:
        for (x, z) in ((-w2, -d), (w2, -d)):
            A.cyl('metal', (x, 0.0, z), 0.012, 0.0, 0.04, 0x8a8e90, 1.0, seg=6, name='peg', proxy=False)
    NET = 0xd8dcd8
    if A.lo:
        A.quad('fabric', [(-w2, h, 0), (w2, h, 0), (w2, 0.03, -d), (-w2, 0.03, -d)], NET, 0.85, two=True, name='net')
        return
    m = (0.12, 0.16, 0.28)[A.L]

    def back(u, v):
        bulge = 0.10 * math.sin(math.pi * v) * (1 - (u / w2) ** 2)
        return (u, h - 0.04 + (0.03 - h + 0.04) * v, -d * v - bulge)
    nu = int(round(2 * w2 / m))
    nv = int(round(math.hypot(h, d) / m))
    for i in range(nu + 1):
        u = -w2 + 2 * w2 * i / nu
        A.tube('fabric', [back(u, v / 4) for v in range(5)], 0.003, NET, 1.0, seg=3, name='net', proxy=False)
    for j in range(1, nv):
        v = j / nv
        A.tube('fabric', [back(-w2 + 2 * w2 * k / 6, v) for k in range(7)], 0.003, NET, 1.0, seg=3, name='net', proxy=False)
    # 两侧的三角片：竖线从后撑落到底框
    for s in (-1, 1):
        n = int(round(d / m))
        for k in range(1, n):
            t = k / n
            top = (s * w2, h - 0.05 + (0.03 - h + 0.05) * t, -d * t)
            A.rod('fabric', top, (s * w2, 0.03, -d * t), 0.003, 0.003, NET, 1.0, seg=3, caps=False, name='net', proxy=False)
        for k in range(1, int(round(h / m))):
            y = h * k / round(h / m)
            zt = -d * (1 - (y - 0.03) / (h - 0.08))
            A.rod('fabric', (s * w2, y, 0.0), (s * w2, y, min(0.0, zt)), 0.003, 0.003, NET, 1.0, seg=3, caps=False, name='net', proxy=False)


@asset('badminton_post', ao=0.3, inst=True)
def badminton_post(A):
    """羽毛球网柱：带胶边的铸铁圆底座、钢管柱、柱上的绞盘（摇把）、柱顶的挂钩。"""
    PC = 0x3a3f44
    A.cyl('metal', (0, 0, 0), 0.22, 0.20, 0.06, 0x2a2e30, 1.0, seg=20, round_=0.01, name='base')
    if not A.lo:
        A.cyl('plastic', (0, 0.0, 0), 0.225, 0.225, 0.02, BLACK, 1.0, seg=20, caps=False, name='rubber', proxy=False)
    A.cyl('metal', (0, 0.06, 0), 0.022, 0.02, 1.49, PC, 1.05, seg=10, name='pole')
    A.cyl('plastic', (0, 1.55, 0), 0.026, 0.02, 0.03, BLACK, 1.0, seg=10, name='cap', proxy=False)
    A.box('metal', (0.035, 1.0, 0), (0.05, 0.08, 0.06), 0x5a6064, 1.0, bev=0.006, name='winch')
    if not A.lo:
        A.cyl('metal', (0.06, 1.0, 0.0), 0.006, 0.006, 0.05, 0x8a9094, 1.0, seg=6, dirn=(0, 0, 1), name='axle', proxy=False)
        A.rod('metal', (0.06, 1.0, 0.05), (0.06, 0.93, 0.05), 0.005, 0.005, 0x8a9094, 1.0, seg=6, name='crank', proxy=False)
        A.cyl('plastic', (0.06, 0.93, 0.05), 0.008, 0.008, 0.03, BLACK, 1.0, seg=6, dirn=(0, 0, 1), name='knob', proxy=False)
        A.tube('metal', [(0.0, 1.50, 0.02), (0.0, 1.53, 0.05), (0.0, 1.56, 0.03)], 0.004, 0x8a9094, 1.0, seg=6, name='hook', proxy=False)


# ====================================================================== 围墙
FENCE_GREEN = 0x2f5a3a
BASE_H, RAIL_H = 1.5, 1.5


@asset('fence_pillar', ao=0.35, inst=True)
def fence_pillar(A):
    """围墙的石柱（0.46×0.74，局部 z 垂直于墙）：基座、柱身（一道道凹缝的块石）、腰线、挑出的柱帽和压顶。"""
    STN = 0xa8a296
    H = BASE_H + RAIL_H + 0.25
    A.box('stone', (0, 0.15, 0), (0.54, 0.30, 0.82), 0x8f8a80, 1.0, bev=0.02, name='plinth')
    A.box('stone', (0, (H - 0.30) / 2 + 0.30, 0), (0.46, H - 0.30 - 0.20, 0.74), STN, 1.0, bev=0.012, name='shaft')
    if A.L == 0:
        y = 0.75
        while y < H - 0.4:
            for (x, z, sx, sz) in ((0, 0.3705, 0.44, 0.002), (0, -0.3705, 0.44, 0.002), (0.2305, 0, 0.002, 0.72), (-0.2305, 0, 0.002, 0.72)):
                A.box('dark', (x, y, z), (sx, 0.012, sz), 0x6a665e, 1.0, name='joint', proxy=False)
            y += 0.45
    A.box('stone', (0, H - 0.16, 0), (0.54, 0.08, 0.82), 0xb8b2a6, 1.04, bev=0.015, name='cornice')
    A.box('stone', (0, H - 0.06, 0), (0.50, 0.12, 0.78), 0xb8b2a6, 1.05, bev=0.03, name='cap')
    if not A.lo:
        A.prism('stone', (0, H, 0), [(-0.22, 0.0), (0.22, 0.0), (0.0, 0.10)], 0.70, 0xb0aa9e, 1.02, bev=0.008, name='coping')


def fence_panel(A, n):
    """一段 2 米长的铁艺栏杆（局部 x 沿墙，原点在墙中线的地面）：方钢立杆（顶上矛尖、套环）、上下两道横档。坐在围墙压顶上。"""
    y0 = BASE_H + 0.06
    y1 = BASE_H + RAIL_H + 0.12
    A.box('metal', (0, BASE_H + RAIL_H, 0), (2.0, 0.05, 0.05), FENCE_GREEN, 1.0, bev=0.004, name='rail_top')
    A.box('metal', (0, BASE_H + 0.30, 0), (2.0, 0.04, 0.04), FENCE_GREEN, 1.0, bev=0.003, name='rail_low')
    for k in range(n):
        x = -1.0 + (k + 0.5) * 2.0 / n
        A.box('metal', (x, (y0 + y1) / 2, 0), (0.018, y1 - y0, 0.018), FENCE_GREEN, 1.0, name='bar', proxy=False)
        if A.L <= 1:
            # 矛尖：套环 + 叶形尖（围墙上几百段，分段压到最少）
            A.lathe('metal', (x, y1, 0), [(0.0, 0.0), (0.015, 0.0), (0.015, 0.014), (0.006, 0.02), (0.02, 0.05), (0.0, 0.13)],
                    FENCE_GREEN, 1.05, seg=4, sharp=50, name='spear', proxy=False)
        else:
            A.cyl('metal', (x, y1, 0), 0.02, 0.0, 0.10, FENCE_GREEN, 1.0, seg=4, name='spear', proxy=False)
    A.proxy_box((0, (y0 + y1 + 0.12) / 2, 0), (2.0, y1 + 0.12 - y0, 0.05))


asset('fence_panel_200', ao=0.25, ground=False, inst=True, lods=(0, 1, 2))(lambda A: fence_panel(A, (16, 12, 8, 4)[A.L]))


# ====================================================================== 校门
def gate_pillar(A, ph, beam_top):
    """校门的门柱（0.70 见方）：基座、柱身（分缝）、腰线、柱帽；beam_top 给了的话柱身一直到门头梁的高度。"""
    pw = 0.70
    STN = 0xc9c2b4
    H = beam_top if beam_top else ph
    A.box('stone', (0, 0.2, 0), (pw + 0.12, 0.4, pw + 0.12), 0xa8a296, 1.0, bev=0.02, name='plinth')
    A.box('stone', (0, (H + 0.4) / 2, 0), (pw, H - 0.4, pw), STN, 1.05, bev=0.02, name='shaft')
    if A.hi:
        y = 1.0
        while y < H - 0.3:
            for (x, z, sx, sz) in ((0, pw / 2 + 0.0005, pw - 0.02, 0.002), (0, -pw / 2 - 0.0005, pw - 0.02, 0.002), (pw / 2 + 0.0005, 0, 0.002, pw - 0.02), (-pw / 2 - 0.0005, 0, 0.002, pw - 0.02)):
                A.box('dark', (x, y, z), (sx, 0.012, sz), 0x8a8478, 1.0, name='joint', proxy=False)
            y += 0.6
    A.box('stone', (0, H + 0.06, 0), (pw * 1.3, 0.12, pw * 1.3), 0xa8a296, 1.05, bev=0.02, name='cornice')
    A.box('stone', (0, H + 0.17, 0), (pw * 1.18, 0.10, pw * 1.18), 0xb8b2a6, 1.05, bev=0.03, name='cap')
    if not beam_top and not A.lo:
        A.lathe('stone', (0, H + 0.22, 0), [(0.0, 0.0), (0.22, 0.0), (0.24, 0.04), (0.16, 0.08), (0.10, 0.14), (0.14, 0.22), (0.0, 0.30)], 0xb8b2a6, 1.04, seg=12, name='finial')


asset('gate_pillar', ao=0.4, inst=True)(lambda A: gate_pillar(A, 3.0, None))
asset('gate_pillar_tall', ao=0.4, inst=True)(lambda A: gate_pillar(A, 4.6, 6.05))


@asset('gate_leaf_120', ao=0.3, inst=True)
def gate_leaf_120(A):
    """一段 1.2 米宽的铁栅门（游戏里一段段排满门洞，宽度略拉伸）：底下槽钢、上中两道横档、方钢竖杆（金色矛尖）、两头的边框，
    底下两只滑轮。"""
    GC = 0x2b333a
    GOLD = 0xc8a24a
    A.box('metal', (0, 0.20, 0), (1.2, 0.14, 0.12), 0x3d474f, 1.0, bev=0.006, name='bottom')
    for y in (1.30, 2.40):
        A.box('metal', (0, y, 0), (1.2, 0.06, 0.06), 0x3d474f, 1.0, bev=0.004, name='rail')
    for s in (-1, 1):
        A.box('metal', (s * 0.585, 1.35, 0), (0.03, 2.3, 0.05), 0x3d474f, 1.0, bev=0.003, name='stile', proxy=False)
    n = (8, 6, 4, 3)[A.L]
    for k in range(n):
        x = -0.6 + (k + 0.5) * 1.2 / n
        A.box('metal', (x, 1.38, 0), (0.022, 2.24, 0.022), GC, 1.0, bev=0.002, name='bar', proxy=False)
        if not A.lo:
            A.lathe('metal', (x, 2.50, 0), [(0.0, 0.0), (0.018, 0.0), (0.02, 0.012), (0.008, 0.02), (0.026, 0.06), (0.0, 0.16)], GOLD, 1.25, seg=6, sharp=50, name='spear', proxy=False)
        else:
            A.cyl('metal', (x, 2.5, 0), 0.04, 0.0, 0.12, GOLD, 1.2, seg=4, name='spear', proxy=False)
    if A.L == 0:
        for k in range(n - 1):
            x = -0.6 + (k + 1) * 1.2 / n
            pts = [(x + math.cos(a) * 0.05, 1.85 + math.sin(a) * 0.05, 0.0) for a in [i / 12 * 2 * math.pi for i in range(12)]]
            A.tube('metal', pts, 0.006, GOLD, 1.15, seg=4, closed=True, name='ring', proxy=False)
    if not A.lo:
        for s in (-1, 1):
            A.cyl('metal', (s * 0.4, 0.07, -0.02), 0.06, 0.06, 0.04, 0x5a6064, 1.0, seg=12, dirn=(0, 0, 1), name='wheel', proxy=False)
    A.proxy_box((0, 1.3, 0), (1.2, 2.6, 0.12))


@asset('turnstile', ao=0.35, inst=True)
def turnstile(A):
    """三辊闸（人沿 ±z 通过，拦杆伸向 +x）：不锈钢机箱（顶面往一头斜、四周倒圆）、顶上的刷卡区和箭头、叉指灯，
    侧面斜着的转盘和三根拦杆（一根横在通道上）。"""
    SS = 0xb8c0c4
    prof = [(-0.475, 0.0), (0.475, 0.0), (0.475, 0.96), (0.40, 1.02), (-0.40, 1.02), (-0.475, 0.98)]
    with A.at(0, 0, 0, ry=math.pi / 2):
        A.prism('metal', (0, 0, 0), prof, 0.28, SS, 1.08, bev=0.02, name='body')
    A.box('dark', (0, 1.022, 0.0), (0.22, 0.004, 0.70), 0x1d2a33, 1.0, name='top_glass', proxy=False)
    A.box('dark', (0, 1.025, -0.20), (0.12, 0.002, 0.12), 0x2b3b44, 1.0, name='reader', proxy=False)
    A.box('emit', (0, 1.026, 0.18), (0.06, 0.001, 0.10), 0x39c08a, 1.0, name='arrow', proxy=False)
    for s in (-1, 1):
        A.box('emit', (0, 0.80, s * 0.476), (0.10, 0.06, 0.002), 0x39c08a if s > 0 else 0xa83a2a, 0.8, name='lamp', proxy=False)
    # 转盘和三根拦杆：轴往下斜 45°，指向 +z 那头
    hub = Vector((0.16, 0.86, 0.0))
    ax = Vector((0.0, -0.7071, 0.7071))
    A.cyl('metal', tuple(hub - ax * 0.03), 0.07, 0.07, 0.07, SS, 1.15, seg=16, round_=0.01, dirn=tuple(ax), name='hub')
    d0 = Vector((1.0, 0.0, 0.0))
    for k in range(3):
        d = Matrix.Rotation(k * 2 * math.pi / 3, 3, ax) @ d0
        A.rod('metal', tuple(hub + ax * 0.04 + d * 0.05), tuple(hub + ax * 0.04 + d * 0.50), 0.019, 0.019, CHROME, 1.2, seg=12, round_=0.008, name='arm')


@asset('padlock_chain', ao=0.2, ground=False, inst=True)
def padlock_chain(A):
    """锁着侧门的铁链和挂锁（原点在锁的位置）：两扇门的边框上绕了一圈的铁链（一节节的环）、黄铜挂锁、锁梁。"""
    CH = 0x5a5650
    nl = (14, 10, 6, 0)[A.L]
    if nl:
        for k in range(nl):
            a = k / nl * 2 * math.pi
            c = (math.cos(a) * 0.07, 0.06 + math.sin(a) * 0.02, -0.03 + math.sin(a) * 0.05)
            with A.at(*c, ry=a + (math.pi / 2 if k % 2 else 0.0)):
                pts = [(math.cos(t) * 0.012, math.sin(t) * 0.02, 0.0) for t in [i / 8 * 2 * math.pi for i in range(8)]]
                A.tube('metal', pts, 0.0035, CH, 1.05, seg=4, closed=True, name='link', proxy=False)
    A.box('metal', (0, -0.035, 0.02), (0.05, 0.055, 0.022), 0xb8962e, 1.2, bev=0.006, name='body')
    A.tube('metal', [(-0.016, -0.01, 0.02), (-0.016, 0.02, 0.02), (0.016, 0.02, 0.02), (0.016, -0.01, 0.02)], 0.004, 0xb8c0c2, 1.2, seg=6, bend=0.012, name='shackle', proxy=False)
    if A.hi:
        A.box('dark', (0, -0.045, 0.0312), (0.008, 0.016, 0.001), 0x2a2010, 1.0, name='keyhole', proxy=False)


@asset('barrier_cabinet', ao=0.35, inst=True)
def barrier_cabinet(A):
    """车库道闸的机箱（拦杆朝 +z 伸出去，杆子游戏里按车道宽画）：米白色机箱、黄色警示条、检修门和锁、顶盖、侧面的转轴和杆座。"""
    A.box('metal', (0, 0.48, 0), (0.32, 0.96, 0.32), 0xd8d4cc, 1.0, bev=0.012, name='body')
    A.box('metal', (0, 0.99, 0), (0.36, 0.05, 0.36), 0xc8c4bc, 1.05, bev=0.012, name='lid')
    A.box('metal', (0, 0.85, 0.1605), (0.30, 0.06, 0.002), 0xd8a62a, 1.05, name='stripe', proxy=False)
    A.box('metal', (-0.1605, 0.45, 0), (0.002, 0.62, 0.26), 0xccc8c0, 1.0, name='door', proxy=False)
    if not A.lo:
        A.cyl('metal', (-0.162, 0.70, 0.08), 0.01, 0.01, 0.006, 0x8a9094, 1.1, seg=8, dirn=(-1, 0, 0), name='lock', proxy=False)
    A.cyl('metal', (0, 0.85, 0.16), 0.07, 0.07, 0.06, 0x8a9094, 1.1, seg=16, round_=0.01, dirn=(0, 0, 1), name='hub')
    A.box('metal', (0, 0.85, 0.24), (0.12, 0.14, 0.12), 0x6a7074, 1.0, bev=0.01, name='arm_seat')
