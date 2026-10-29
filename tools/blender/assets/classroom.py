"""教室：学生课桌、学生椅。尺寸和占地沿用 furniture.js 原来的（桌面顶 0.7575 米、四条腿在 ±0.35/±0.22，
椅面 0.44 米、人朝 -z 坐、靠背在 +z）。"""
import math

from wdfz import asset

C_DESK = 0x86653c      # 桌面
C_BOX = 0x6a4f30       # 桌斗
C_FRAME = 0x3a3f44     # 钢架
C_SEAT = 0x785b34      # 椅面、靠背
C_FOOT = 0x15181b      # 塑料脚套


def sq_tube(A, x, z, y0, y1, w, col, name='leg'):
    """竖着的方管（圆角）。"""
    A.box('metal', (x, (y0 + y1) / 2, z), (w, y1 - y0, w), col, 1.0, bev=w * 0.18, name=name)


def foot_cap(A, x, z, w):
    A.box('plastic', (x, 0.011, z), (w + 0.006, 0.022, w + 0.006), C_FOOT, 1.0, bev=0.004, name='foot')


def desk_student_low(A):
    """流畅档：桌面、四条腿、两根踏脚、一个实心桌斗（开口画成深色）。顶点数和原来的手机版相当。"""
    A.box('wood', (0, 0.7465, 0), (0.78, 0.022, 0.52), C_DESK, 1.06, name='top')
    for sx in (-1, 1):
        for sz in (-1, 1):
            A.box('metal', (sx * 0.35, 0.3675, sz * 0.22), (0.03, 0.735, 0.03), C_FRAME, 1.0, name='leg')
        A.box('metal', (sx * 0.35, 0.12, 0), (0.022, 0.022, 0.41), C_FRAME, 1.0, name='rail')
    A.box('wood', (0, 0.6745, 0.02), (0.64, 0.087, 0.40), C_BOX, 0.82, name='box')
    A.quad('dark', [(-0.30, 0.636, 0.2205), (0.30, 0.636, 0.2205), (0.30, 0.708, 0.2205), (-0.30, 0.708, 0.2205)], 0x1a1612, name='box_open')


@asset('desk_student', ao=0.3, inst=True)
def desk_student(A):
    if A.lo:
        return desk_student_low(A)
    top_y = 0.7575
    th = 0.022
    # 桌面：三厘米圆边的木纹板
    A.box('wood', (0, top_y - th / 2, 0), (0.78, th, 0.52), C_DESK, 1.06, bev=0.006, name='top')
    # 桌面下的钢框（矩形管），四边一圈
    fy = top_y - th - 0.012
    A.box('metal', (0, fy, -0.225), (0.70, 0.024, 0.02), C_FRAME, 1.0, bev=0.003, name='apron')
    A.box('metal', (0, fy, 0.225), (0.70, 0.024, 0.02), C_FRAME, 1.0, bev=0.003, name='apron')
    for s in (-1, 1):
        A.box('metal', (s * 0.35, fy, 0), (0.02, 0.024, 0.43), C_FRAME, 1.0, bev=0.003, name='apron')
    # 四条腿：下段粗管、上段细管插在里面（可调高度），调节旋钮朝里
    for sx in (-1, 1):
        for sz in (-1, 1):
            x, z = sx * 0.35, sz * 0.22
            sq_tube(A, x, z, 0.02, 0.43, 0.032, C_FRAME, 'leg_lo')
            sq_tube(A, x, z, 0.40, fy - 0.012, 0.026, C_FRAME, 'leg_hi')
            if not A.lo:
                # 接口处的塑料套
                A.box('plastic', (x, 0.425, z), (0.036, 0.012, 0.036), C_FOOT, 1.0, bev=0.003, name='collar')
                if A.hi:
                    A.cyl('metal', (x - sx * 0.016, 0.36, z), 0.006, 0.006, 0.008, 0x8c949a, 1.1, seg=10, dirn=(-sx, 0, 0), name='knob')
                    A.cyl('plastic', (x - sx * 0.024, 0.36, z), 0.011, 0.011, 0.012, C_FOOT, 1.0, seg=12, round_=0.003, dirn=(-sx, 0, 0), name='knob')
            foot_cap(A, x, z, 0.032)
    # 两侧的踏脚横撑
    for sx in (-1, 1):
        A.box('metal', (sx * 0.35, 0.12, 0), (0.022, 0.022, 0.41), C_FRAME, 1.0, bev=0.003, name='rail')
    # 桌斗：铁皮盒，开口朝人（+z），底板、背板、两侧板，前沿一道挡边
    by0, by1 = 0.630, fy - 0.012
    A.box('wood', (0, by0 + 0.005, 0.02), (0.64, 0.010, 0.40), C_BOX, 0.82, bev=0.002, name='box_bottom')
    A.box('wood', (0, (by0 + by1) / 2, -0.176), (0.64, by1 - by0, 0.008), C_BOX, 0.78, bev=0.002, name='box_back')
    for sx in (-1, 1):
        A.box('wood', (sx * 0.316, (by0 + by1) / 2, 0.02), (0.008, by1 - by0, 0.40), C_BOX, 0.80, bev=0.002, name='box_side')
    A.box('wood', (0, by0 + 0.018, 0.217), (0.64, 0.026, 0.008), C_BOX, 0.86, bev=0.002, name='box_lip')
    if A.hi:
        # 桌侧挂书包的钩子
        A.tube('metal', [(0.366, 0.66, 0.05), (0.392, 0.66, 0.05), (0.392, 0.69, 0.05)], 0.004, 0x8c949a, 1.1, seg=8, bend=0.01, name='hook')
        A.box('metal', (0.36, 0.66, 0.05), (0.008, 0.03, 0.02), C_FRAME, 1.0, bev=0.002, name='hook_plate')
        # 桌面下的螺钉
        for sx in (-1, 1):
            for sz in (-1, 1):
                A.cyl('metal', (sx * 0.30, fy - 0.0125, sz * 0.225), 0.005, 0.005, 0.002, 0x9aa2a8, 1.1, seg=8, dirn=(0, -1, 0), proxy=False, name='screw')


def chair_low(A, sy):
    A.box('wood', (0, sy - 0.012, -0.0275), (0.40, 0.022, 0.345), C_SEAT, 1.1, name='seat')
    A.box('wood', (0, sy + 0.30, 0.19), (0.40, 0.21, 0.016), C_SEAT, 1.0, name='back')
    for sx in (-1, 1):
        x = sx * 0.17
        A.rod('metal', (x, 0.0, 0.185), (x, sy + 0.405, 0.205), 0.012, 0.012, C_FRAME, 1.0, seg=4, caps=False, name='rear_leg')
        A.rod('metal', (x, 0.0, -0.172), (x, sy - 0.024, -0.152), 0.012, 0.012, C_FRAME, 1.0, seg=4, caps=False, name='front_leg')
    A.rod('metal', (-0.17, 0.16, -0.168), (0.17, 0.16, -0.168), 0.009, 0.009, C_FRAME, 1.0, seg=4, caps=False, name='cross')


def chair(A, sy):
    """学生椅：弯木椅面（前沿往下卷）、弯的靠背、圆钢管架（后腿一直伸上去托靠背）、横撑、脚套。"""
    if A.lo:
        return chair_low(A, sy)
    r = 0.0115
    # 椅面：侧面轮廓（z, y）沿 x 挤出；后高前低，前沿往下卷
    t = 0.016
    prof = []
    n = 10 if A.hi else (6 if A.L == 2 else 3)
    for i in range(n + 1):
        z = 0.145 - 0.345 * i / n
        y = sy + 0.004 * (1 - i / n)
        if z < -0.15:
            k = (-0.15 - z) / 0.05
            y -= 0.018 * k * k
        prof.append((z, y))
    top = prof
    bot = [(z, y - t) for (z, y) in reversed(prof)]
    poly = [(-z, y) for (z, y) in top + bot]          # prism 的 u 轴沿 x；这里转 90° 让轮廓落在 z-y 平面
    A.prism('wood', (0, 0, 0), poly, 0.40, C_SEAT, 1.1, bev=0.006, axis='x', name='seat')
    # 靠背：弯成弧（两边往人这边收 3.5 厘米），往后仰一点
    bh = 0.21
    bt = 0.013
    m = 12 if A.hi else (8 if A.L == 2 else 4)
    outer, inner = [], []
    for i in range(m + 1):
        x = -0.20 + 0.40 * i / m
        z = 0.205 - 0.9 * x * x
        outer.append((x, z + bt / 2))
        inner.append((x, z - bt / 2))
    band = outer + list(reversed(inner))
    # prism 的轮廓 (u,v)=(x,-z) 沿 y 挤出：绕 x 转 -90°
    A.prism('wood', (0, sy + 0.30, 0), [(u, -v) for (u, v) in band], bh, C_SEAT, 1.0, bev=0.005, rot=(-math.pi / 2 + 0.10, 0, 0), proxy=False, name='back')
    for i in range(4):                        # 碰撞代理：顺着弧的四块薄板
        xm = -0.15 + 0.10 * i
        A.proxy_box((xm, sy + 0.30, 0.205 - 0.9 * xm * xm), (0.10, bh, bt), a=math.atan2(1.8 * xm, 1.0))
    # 架子：两条后腿从地面一直弯上去到靠背顶上
    for sx in (-1, 1):
        x = sx * 0.17
        # 后腿：脚往后撇一点，过椅面后沿再顺着靠背的仰角上去，贴在靠背后面
        sg = 10 if A.hi else 6
        A.tube('metal', [(x, 0.02, 0.185), (x, sy - 0.03, 0.164), (x, sy + 0.405, 0.2085)], r, C_FRAME, 1.0, seg=sg, bend=0.06, name='rear_leg')
        A.tube('metal', [(x, 0.02, -0.172), (x, sy - 0.03, -0.152)], r, C_FRAME, 1.0, seg=sg, name='front_leg')
        A.rod('metal', (x, sy - 0.03, -0.152), (x, sy - 0.03, 0.164), r * 0.85, r * 0.85, C_FRAME, 1.0, seg=8, caps=False, name='seat_rail')
        A.rod('metal', (x, 0.16, -0.168), (x, 0.16, 0.18), r * 0.8, r * 0.8, C_FRAME, 1.0, seg=8, caps=False, name='side_rail')
        A.cyl('plastic', (x, 0.0, 0.185), r + 0.003, r + 0.002, 0.022, C_FOOT, 1.0, seg=10, round_=0.002, name='foot')
        A.cyl('plastic', (x, 0.0, -0.172), r + 0.003, r + 0.002, 0.022, C_FOOT, 1.0, seg=10, round_=0.002, name='foot')
        if A.hi:
            for yy in (sy + 0.255, sy + 0.345):
                zz = 0.164 + (yy - sy + 0.03) * 0.1 - r
                A.cyl('metal', (x, yy, zz), 0.0055, 0.0055, 0.003, 0x9aa2a8, 1.1, seg=8, dirn=(0, 0.1, -1), proxy=False, name='rivet')
    A.rod('metal', (-0.17, 0.16, -0.168), (0.17, 0.16, -0.168), r * 0.8, r * 0.8, C_FRAME, 1.0, seg=8, caps=False, name='cross')
    A.rod('metal', (-0.17, sy - 0.03, 0.13), (0.17, sy - 0.03, 0.13), r * 0.8, r * 0.8, C_FRAME, 1.0, seg=8, caps=False, name='cross')


@asset('chair_student', ao=0.3, inst=True)
def chair_student(A):
    chair(A, 0.44)


@asset('chair_student_tall', ao=0.3, inst=True)
def chair_student_tall(A):
    chair(A, 0.46)
