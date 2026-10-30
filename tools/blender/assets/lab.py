"""实验楼、机房：物理实验台、化学实验台、教师演示台、学生机、挂图架、离心机、显微镜、杠杆和单摆、地球仪、
服务器机柜、控制台、通风橱、洗眼器。尺寸、朝向沿用 furniture.js / room.js 原来的局部坐标。"""
import math
import random

from mathutils import noise, Vector

from wdfz import asset, rrect
from assets._parts import rpanel, handle_bar, knob, screw, led, slats, STEEL, CHROME, BLACK
from assets.office import monitor, keyboard, mouse

C_DESK = 0x86653c


def cabinet_doors(A, x, y, z, w, h, col, n=2, handle=STEEL, gap=0.004):
    """柜子正面（朝 +z，z 是面所在位置）：n 扇门、门缝、拉手。"""
    if A.lo:
        if n == 2:
            A.box('dark', (x, y, z + 0.001), (0.004, h * 0.9, 0.002), 0x30383c, 1.0, proxy=False, name='gap')
        return
    dw = (w - gap * (n + 1)) / n
    for k in range(n):
        dx = x - w / 2 + gap + dw / 2 + k * (dw + gap)
        A.box('metal', (dx, y, z + 0.003), (dw, h - gap * 2, 0.006), col, 1.02, bev=0.002, name='door', proxy=False)
        hx = dx + (dw / 2 - 0.05) * (1 if k == 0 and n == 2 else -1) if n == 2 else dx + dw / 2 - 0.05
        handle_bar(A, (hx, y + h * 0.18, z + 0.006), 0.10, handle, axis='y', off=0.02)


def stone_top(A, c, s, col, shade=1.2):
    A.box('stone', c, s, col, shade, bev=0.006, name='stone_top')


def kick(A, x, z, w, col):
    """柜子底下凹进去的踢脚。"""
    A.box('metal', (x, 0.04, z), (w, 0.08, 0.004), col, 0.6, proxy=False, name='kick')


@asset('bench_physics', ao=0.35, inst=True)
def bench_physics(A):
    """物理实验台：铁皮柜（两扇门）、深色石台面、背后立着电源板（指示灯、插座、开关），台上一只电表。"""
    A.box('metal', (0, 0.48, -0.01), (0.86, 0.78, 0.68), 0x7d878c, 1.05, bev=0.008, name='body')
    A.box('metal', (0, 0.045, -0.03), (0.82, 0.09, 0.62), 0x4a5054, 0.8, name='plinth')
    cabinet_doors(A, 0, 0.48, 0.33, 0.84, 0.74, 0x828c91)
    stone_top(A, (0, 0.90, 0), (0.92, 0.05, 0.78), 0x4c5a60, 1.25)
    # 电源板
    A.box('metal', (0, 1.10, -0.30), (0.86, 0.36, 0.06), 0x55605f, 1.0, bev=0.01, name='panel')
    A.box('metal', (0, 1.275, -0.30), (0.88, 0.02, 0.08), 0x4a5453, 1.0, bev=0.004, name='panel_cap')
    led(A, (-0.25, 1.18, -0.27), 0xd84a3a, 0.035)
    if not A.lo:
        A.box('plastic', (-0.25, 1.18, -0.2705), (0.05, 0.05, 0.002), 0x2a2e30, 1.0, name='led_bezel', proxy=False)
        A.box('plastic', (-0.10, 1.12, -0.268), (0.05, 0.07, 0.006), 0x1a1d1f, 1.0, bev=0.002, name='switch', proxy=False)
        A.box('plastic', (-0.10, 1.13, -0.264), (0.02, 0.03, 0.006), 0xc83a32, 1.0, name='switch_rocker', proxy=False)
    for k, sx in enumerate((0.08, 0.22)):
        A.box('plastic', (sx, 1.06, -0.268), (0.09, 0.07, 0.008), 0xe0dcd0, 1.0, bev=0.003, name='socket')
        if not A.lo:
            for (hx, hy) in ((-0.02, 0.012), (0.02, 0.012), (0.0, -0.014)):
                A.box('dark', (sx + hx, 1.06 + hy, -0.2638), (0.004, 0.012, 0.002), 0x2a2a2a, 1.0, name='pin', proxy=False)
    # 电表
    with A.at(0.20, 0.925, 0.05, ry=-0.3):
        A.box('plastic', (0, 0.05, 0), (0.12, 0.10, 0.08), 0x2a2e30, 1.0, bev=0.006, name='meter')
        if not A.lo:
            A.box('plastic', (0, 0.065, 0.041), (0.10, 0.055, 0.002), 0xe8e4d8, 1.0, name='dial', proxy=False)
            A.box('dark', (0.01, 0.07, 0.0425), (0.002, 0.045, 0.001), 0x1a1a1a, 1.0, rot=(0, 0, 0.5), name='needle', proxy=False)
            for k, c in enumerate((0xc83a32, 0x1a1a1a)):
                A.cyl('plastic', (-0.025 + k * 0.05, 0.10, 0.02), 0.008, 0.008, 0.016, c, 1.0, seg=8, name='post', proxy=False)


@asset('desk_computer', ao=0.32, inst=True)
def desk_computer(A):
    """机房学生机：两侧板、桌面、主机箱（指示灯）、显示器（屏幕朝人 +z）、键盘鼠标。椅子另外摆。"""
    A.box('wood', (0, 0.7425, 0), (0.88, 0.035, 0.62), C_DESK, 1.05, bev=0.006, name='top')
    for s in (-1, 1):
        A.box('wood', (s * 0.40, 0.3625, 0), (0.04, 0.725, 0.56), C_DESK, 0.82, bev=0.004, name='side')
    A.box('wood', (0, 0.42, -0.255), (0.76, 0.30, 0.02), C_DESK, 0.76, bev=0.003, name='back')
    # 主机箱
    A.box('plastic', (0.26, 0.24, -0.04), (0.18, 0.42, 0.40), 0x2a3036, 1.0, bev=0.008, name='tower')
    led(A, (0.26, 0.40, 0.16), 0x3ad08a, 0.01)
    if not A.lo:
        A.box('plastic', (0.26, 0.36, 0.1605), (0.15, 0.06, 0.002), 0x1a1e22, 1.0, name='bay', proxy=False)
        A.cyl('plastic', (0.26, 0.42, 0.16), 0.009, 0.009, 0.004, 0x9aa2a8, 1.1, seg=10, dirn=(0, 0, 1), name='power', proxy=False)
        slats(A, 'plastic', (0.26, 0.14, 0.16), 0.14, 0.10, 6, 0x23292e)
    with A.at(0, 0, -0.13, ry=math.pi):
        monitor(A, (0, 1.06, 0), w=0.48, h=0.32, base_y=0.76, scrcol=0x7fb0c8, scrshade=0.8)
    keyboard(A, (0, 0.76, 0.08), w=0.40, d=0.13)
    mouse(A, (0.27, 0.772, 0.10))


@asset('map_stand', ao=0.4)
def map_stand(A):
    """地理挂图架：三脚架、顶上横杆，挂着一幅旧世界地图（上下两根木轴，海是浅蓝绿，陆地一块块，一个红笔圈）。"""
    for (bx, bz, tx) in ((-0.30, 0.22, -0.06), (0.30, 0.22, 0.06), (0.0, -0.30, 0.0)):
        A.rod('metal', (bx, 0.0, bz), (tx, 1.9, 0.0), 0.015, 0.012, 0x4a5450, 1.0, seg=8, name='leg')
        if not A.lo:
            A.cyl('plastic', (bx, 0.0, bz), 0.018, 0.016, 0.02, BLACK, 1.0, seg=8, name='foot', proxy=False)
    A.cyl('metal', (0, 1.84, 0), 0.03, 0.025, 0.08, 0x3a4440, 1.0, seg=10, name='head')
    A.box('wood', (0, 1.82, 0.03), (0.92, 0.04, 0.05), 0x5a4632, 1.0, bev=0.008, name='bar')
    # 地图：上下木轴、纸
    A.rod('wood', (-0.47, 1.79, 0.04), (0.47, 1.79, 0.04), 0.014, 0.014, 0x6a4a30, 1.0, seg=10, round_=0.004, name='roller')
    A.rod('wood', (-0.47, 0.60, 0.042), (0.47, 0.60, 0.042), 0.016, 0.016, 0x6a4a30, 1.0, seg=10, round_=0.004, name='roller')
    A.box('paper', (0, 1.195, 0.042), (0.86, 1.18, 0.003), 0xb9c8b8, 1.0, name='map')
    rnd = random.Random(7)
    land = [0xc8b88a, 0x9aaa7a, 0xb8a070, 0xa8b888]
    nl = 3 if A.lo else (7 if A.L == 2 else 11)
    for k in range(nl):
        cx = -0.32 + rnd.random() * 0.64
        cy = 0.80 + rnd.random() * 0.80
        rx = 0.05 + rnd.random() * 0.12
        ry = 0.04 + rnd.random() * 0.10
        m = 7 if A.lo else 14
        pts = []
        for i in range(m):
            a = i / m * 2 * math.pi
            rr = 1 + (rnd.random() - 0.5) * 0.5
            pts.append((cx + math.cos(a) * rx * rr, cy + math.sin(a) * ry * rr))
        A.prism('paper', (0, 0, 0.0442), pts, 0.0006, land[k % 4], 1.0, name='land', proxy=False)
    if not A.lo:
        # 经纬线
        for k in range(1, 6):
            A.box('paper', (-0.43 + k * 0.143, 1.195, 0.0437), (0.0012, 1.16, 0.0003), 0x8aa094, 1.0, name='grid', proxy=False)
        for k in range(1, 5):
            A.box('paper', (0, 0.61 + k * 0.234, 0.0437), (0.85, 0.0012, 0.0003), 0x8aa094, 1.0, name='grid', proxy=False)
    # 红笔圈
    m = 6 if A.lo else 16
    for i in range(m):
        a0, a1 = i / m * 2 * math.pi, (i + 1) / m * 2 * math.pi
        A.box('emit', (0.1 + math.cos((a0 + a1) / 2) * 0.03, 1.30 + math.sin((a0 + a1) / 2) * 0.03, 0.0448), (0.004, 0.012, 0.0004), 0xb02a22, 1.0, rot=(0, 0, (a0 + a1) / 2), name='circle', proxy=False)


@asset('centrifuge', ao=0.35)
def centrifuge(A):
    """落地离心机：圆角机身、转子仓的圆圈和盖子（带观察窗）、正面的控制面板（显示屏、按钮、红色急停）、四个脚。"""
    A.box('metal', (0, 0.32, 0), (0.78, 0.56, 0.78), 0x8a9298, 1.02, bev=0.06, name='body')
    for sx in (-1, 1):
        for sz in (-1, 1):
            A.cyl('plastic', (sx * 0.30, 0.0, sz * 0.30), 0.03, 0.035, 0.04, BLACK, 1.0, seg=10, name='foot')
    A.cyl('metal', (0, 0.60, 0), 0.36, 0.36, 0.06, 0xb4bcc0, 1.10, seg=28, round_=0.01, name='ring')
    A.lathe('plastic', (0, 0.66, 0), [(0, 0), (0.27, 0), (0.25, 0.02), (0.20, 0.035), (0, 0.035)], 0x2b3237, 1.0, seg=28, name='lid')
    if not A.lo:
        A.cyl('glass', (0, 0.694, 0), 0.10, 0.10, 0.004, 0x2a3a44, 1.2, seg=24, name='window', proxy=False)
        A.box('metal', (0.24, 0.67, 0), (0.06, 0.02, 0.10), 0x5a6266, 1.0, bev=0.006, name='latch', proxy=False)
    # 控制面板（朝 -z）
    with A.at(0, 0, -0.39, ry=math.pi):
        A.box('plastic', (0, 0.40, 0.005), (0.36, 0.22, 0.012), 0x1b2226, 1.0, bev=0.006, name='panel')
        A.box('emit', (-0.06, 0.45, 0.0115), (0.14, 0.05, 0.002), 0x5ad0a0, 0.7, name='display', proxy=False)
        led(A, (0.11, 0.46, 0.011), 0x7fd0a8, 0.012)
        A.cyl('plastic', (0.09, 0.37, 0.011), 0.025, 0.025, 0.02, 0xc85a4a, 1.3, seg=14, round_=0.004, dirn=(0, 0, 1), name='stop')
        if not A.lo:
            for k in range(3):
                A.box('plastic', (-0.11 + k * 0.05, 0.36, 0.0125), (0.03, 0.02, 0.006), 0x3a4248, 1.0, bev=0.002, name='btn', proxy=False)


@asset('microscope_stand', ao=0.3)
def microscope_stand(A):
    """显微镜（放在小柜子上）：底座带灯、弯的镜臂、粗细调焦旋钮、载物台和压片夹、物镜转换器（三个物镜）、斜着的目镜筒。"""
    A.box('metal', (0, 0.385, 0), (0.66, 0.75, 0.62), 0x6e7a80, 1.0, bev=0.008, name='cab')
    cabinet_doors(A, 0, 0.40, 0.31, 0.62, 0.66, 0x768288, n=1)
    stone_top(A, (0, 0.785, 0), (0.70, 0.03, 0.66), 0x9aa4a8, 1.12)
    y0 = 0.80
    if A.lo:
        A.box('metal', (0, y0 + 0.02, 0.02), (0.20, 0.05, 0.24), 0x2b3237, 1.05, name='base')
        A.rod('metal', (0, y0 + 0.04, 0.10), (0, y0 + 0.26, 0.06), 0.03, 0.028, 0x33383c, 1.0, seg=6, name='arm')
        A.rod('metal', (0, y0 + 0.28, 0.04), (0, y0 + 0.40, -0.05), 0.022, 0.018, 0x1f262a, 1.0, seg=8, name='tube')
        A.box('metal', (0, y0 + 0.15, -0.02), (0.16, 0.015, 0.13), 0x3a4247, 1.15, name='stage')
        return
    blk, wht = 0x1f262a, 0xe4e6e2
    # 底座（前低后高的圆角块）、灯
    A.prism('metal', (0, y0, 0.03), [(-0.11, 0), (0.11, 0), (0.11, 0.035), (0.06, 0.05), (-0.06, 0.05), (-0.11, 0.035)], 0.24, wht, 1.0, bev=0.008, axis='z', name='base')
    A.cyl('emit', (0, y0 + 0.05, -0.02), 0.022, 0.022, 0.004, 0xffe9b0, 0.9, seg=16, name='lamp', proxy=False)
    # 镜臂：从底座后面弯上来再往前
    A.tube('metal', [(0, y0 + 0.04, 0.11), (0, y0 + 0.20, 0.10), (0, y0 + 0.30, 0.03)], 0.025, wht, 1.0, seg=10, bend=0.07, ellip=0.6, name='arm')
    for s in (-1, 1):
        A.cyl('metal', (s * 0.03, y0 + 0.12, 0.09), 0.026, 0.026, 0.016, blk, 1.0, seg=16, round_=0.003, dirn=(s, 0, 0), name='coarse')
        A.cyl('metal', (s * 0.046, y0 + 0.12, 0.09), 0.014, 0.014, 0.012, blk, 1.0, seg=12, dirn=(s, 0, 0), name='fine')
    # 载物台、压片夹、玻片
    A.box('metal', (0, y0 + 0.15, -0.02), (0.15, 0.012, 0.13), blk, 1.0, bev=0.003, name='stage')
    A.box('metal', (0, y0 + 0.14, 0.05), (0.04, 0.03, 0.04), wht, 1.0, bev=0.004, name='stage_arm')
    for s in (-1, 1):
        A.box('metal', (s * 0.04, y0 + 0.158, -0.03), (0.008, 0.003, 0.05), 0x9aa2a8, 1.1, name='clip', proxy=False)
    A.box('glass', (0, y0 + 0.1585, -0.02), (0.075, 0.002, 0.025), 0xb8c8c0, 1.3, name='slide', proxy=False)
    # 物镜转换器和物镜
    A.cyl('metal', (0, y0 + 0.215, -0.01), 0.035, 0.032, 0.02, 0x9aa2a8, 1.1, seg=16, name='nose')
    for k, (ln, rr) in enumerate(((0.045, 0.009), (0.035, 0.010), (0.028, 0.011))):
        a = k / 3 * 2 * math.pi + 0.4
        bx, bz = math.cos(a) * 0.018, -0.01 + math.sin(a) * 0.018
        A.rod('metal', (bx, y0 + 0.215, bz), (bx * 1.2, y0 + 0.215 - ln, bz), rr, rr * 0.75, 0xc8ccd0, 1.15, seg=10, name='objective', proxy=False)
    # 目镜筒（斜着往人这边伸）
    A.rod('metal', (0, y0 + 0.235, -0.01), (0, y0 + 0.31, 0.02), 0.022, 0.022, wht, 1.0, seg=12, name='head')
    A.rod('metal', (0, y0 + 0.30, 0.02), (0, y0 + 0.38, -0.05), 0.016, 0.014, blk, 1.0, seg=12, round_=0.004, name='eyepiece')


@asset('physics_apparatus', ao=0.35)
def physics_apparatus(A):
    """杠杆和单摆：木底座、立柱、横梁、两个吊盘（右边放着砝码）、停在一个角度上的单摆。"""
    A.box('wood', (0, 0.06, 0), (0.80, 0.12, 0.72), 0x4a5450, 1.0, bev=0.012, name='base')
    if not A.lo:
        for sx in (-1, 1):
            for sz in (-1, 1):
                A.cyl('plastic', (sx * 0.34, 0.0, sz * 0.30), 0.02, 0.02, 0.01, BLACK, 1.0, seg=8, name='foot', proxy=False)
    A.cyl('metal', (0, 0.12, -0.06), 0.035, 0.03, 0.86, 0x8a9298, 1.05, seg=12, name='post')
    A.blob('metal', (0, 0.98, -0.06), (0.03, 0.03, 0.03), 0xb8c0c2, 1.1, seg=10, name='pivot')
    A.rod('metal', (-0.43, 0.98, -0.06), (0.43, 0.98, -0.06), 0.012, 0.012, 0xb8c0c2, 1.15, seg=10, round_=0.004, name='beam')
    if not A.lo:
        for k in range(-8, 9):
            if k == 0:
                continue
            A.box('dark', (k * 0.05, 0.992, -0.06), (0.002, 0.005, 0.025), 0x3a3a3a, 1.0, name='tick', proxy=False)
    for sx in (-1, 1):
        x = sx * 0.40
        A.cyl('metal', (x, 0.968, -0.06), 0.006, 0.006, 0.02, 0x8a9298, 1.0, seg=8, name='hook', proxy=False)
        for k in range(3):
            a = k / 3 * 2 * math.pi
            A.rod('metal', (x, 0.968, -0.06), (x + math.cos(a) * 0.085, 0.74, -0.06 + math.sin(a) * 0.085), 0.0015, 0.0015, 0x8a9298, 1.0, seg=4, caps=False, name='string', proxy=False)
        A.lathe('metal', (x, 0.72, -0.06), [(0, 0), (0.09, 0), (0.10, 0.02), (0.096, 0.02), (0.086, 0.004), (0, 0.004)], 0xa8b0a8, 1.1, seg=20, name='pan')
    y = 0.724
    for (r, h) in ((0.035, 0.03), (0.026, 0.025), (0.018, 0.02)):        # 一摞砝码
        A.cyl('metal', (0.40, y, -0.06), r, r, h, 0x8a7a52, 1.15, seg=14, round_=0.003, name='weight')
        y += h
    A.rod('metal', (0.06, 0.98, 0.02), (0.16, 0.42, 0.08), 0.0012, 0.0012, 0xd8d8d0, 1.0, seg=4, caps=False, name='pend_string', proxy=False)
    A.blob('metal', (0.16, 0.40, 0.08), (0.05, 0.05, 0.05), 0x6a5a3a, 1.2, seg=14, name='bob')


@asset('globe', ao=0.35)
def globe(A):
    """地球仪：木底座、立柱、半圈子午圈（斜 23.5°），球面上的海陆按噪声分（顶点色）。"""
    A.lathe('wood', (0, 0, 0), [(0, 0), (0.20, 0), (0.20, 0.03), (0.17, 0.06), (0.16, 0.08), (0, 0.08)], 0x4a3c2c, 1.0, seg=24, name='base')
    A.cyl('metal', (0, 0.08, 0), 0.025, 0.02, 0.565, 0x8a7a52, 1.05, seg=12, name='post')
    A.cyl('metal', (0, 0.615, 0), 0.026, 0.022, 0.025, 0xa8913f, 1.2, seg=12, round_=0.004, name='collar')
    tilt = math.radians(23.5)
    cy = 0.92
    with A.at(0, cy, 0, rz=tilt):
        n = 10 if A.lo else (24 if A.L == 2 else 40)
        pts = []
        for i in range(n + 1):
            a = -0.15 * math.pi + i / n * 1.3 * math.pi
            pts.append((math.sin(a) * 0.28, math.cos(a) * 0.28, 0))
        A.tube('metal', pts, 0.011, 0xa8913f, 1.2, seg=8, name='meridian')
        A.rod('metal', (0, -0.29, 0), (0, 0.29, 0), 0.005, 0.005, 0xa8913f, 1.2, seg=8, name='axis', proxy=False)
        # 球：顶点色按 3D 噪声分海和陆地
        seg = 16 if A.lo else (32 if A.L == 2 else 56)
        rings = seg // 2
        verts, faces, cols = [], [], []
        for j in range(rings + 1):
            ph = j / rings * math.pi
            for i in range(seg):
                th = i / seg * 2 * math.pi
                p = Vector((math.sin(ph) * math.cos(th), math.cos(ph), math.sin(ph) * math.sin(th)))
                verts.append(tuple(p * 0.24))
                nv = noise.noise(p * 1.8 + Vector((3.1, 1.7, 0.4))) + 0.5 * noise.noise(p * 4.1)
                lat = abs(p.y)
                if lat > 0.9:
                    c = (0.86, 0.88, 0.86)
                elif nv > 0.12:
                    g = min(1.0, (nv - 0.12) * 2.5)
                    c = (0.42 - 0.08 * g + 0.25 * lat, 0.56 - 0.1 * g, 0.29 - 0.03 * g)
                else:
                    c = (0.18, 0.37, 0.48 + 0.1 * nv)
                cols.append(c)
        for j in range(rings):
            for i in range(seg):
                i1 = (i + 1) % seg
                a, b, c2, d = j * seg + i, j * seg + i1, (j + 1) * seg + i1, (j + 1) * seg + i
                faces.append((a, b, c2, d))
        A.mesh('plastic', verts, faces, 0xffffff, 1.0, smooth=True, sharp=None, cols=cols, name='sphere')
        A.proxy_box((0, 0, 0), (0.40, 0.40, 0.40))


@asset('bench_demo', ao=0.35)
def bench_demo(A):
    """实验楼教师演示台：铁皮柜体、黑色石台面、两扇门；后面一排试剂架（四个试剂瓶），右边水槽和鹅颈龙头，左边一只烧杯。"""
    lw, ld = 1.30, 0.82
    A.box('metal', (0, 0.48, -0.01), (lw * 0.94, 0.78, ld * 0.88), 0x7d878c, 1.0, bev=0.008, name='body')
    A.box('metal', (0, 0.045, -0.03), (lw * 0.90, 0.09, ld * 0.84), 0x4a5054, 0.8, name='plinth')
    cabinet_doors(A, 0, 0.48, ld * 0.43, lw * 0.92, 0.74, 0x828c91)
    stone_top(A, (0, 0.90, 0), (lw, 0.06, ld), 0x333d3b, 1.16)
    # 试剂架
    for s in (-1, 1):
        A.rod('metal', (s * lw * 0.42, 0.93, -ld * 0.34), (s * lw * 0.42, 1.34, -ld * 0.34), 0.012, 0.012, 0x55605f, 1.0, seg=8, name='post')
    A.box('metal', (0, 1.34, -ld * 0.34), (lw * 0.90, 0.03, 0.14), 0x55605f, 1.0, bev=0.004, name='shelf')
    bc = [0x8ab8a0, 0xc8a24a, 0x9fb0c8, 0xbc8a8a]
    for k in range(4):
        reagent_bottle(A, (-lw * 0.30 + k * lw * 0.18, 1.355, -ld * 0.34), bc[k], 0.04, 0.15, k)
    # 水槽、龙头
    sink(A, (lw * 0.24, 0.93, ld * 0.10), 0.30, 0.24)
    gooseneck(A, (lw * 0.24, 0.93, -0.06), 0.29, 0.14)
    beaker(A, (-lw * 0.22, 0.93, ld * 0.08), 0.06, 0.13, 0x9fd0b8)


def reagent_bottle(A, c, col, r, h, k=0):
    """试剂瓶：玻璃瓶身、瓶肩、瓶塞，贴一张标签。"""
    x, y, z = c
    A.lathe('glass', (x, y, z), [(0, 0), (r, 0), (r, h * 0.66), (r * 0.55, h * 0.82), (r * 0.42, h * 0.86), (r * 0.42, h * 0.9), (0, h * 0.9)], col, 1.3, seg=16, name='bottle')
    A.cyl('plastic', (x, y + h * 0.88, z), r * 0.44, r * 0.40, h * 0.12, 0x2a2a2a, 1.0, seg=12, name='stopper', proxy=False)
    if not A.lo:
        A.lathe('paper', (x, y + h * 0.25, z), [(r * 1.004, 0), (r * 1.004, h * 0.28)], 0xe8e4d4, 1.0, seg=16, phase=-0.6, name='label', proxy=False)


def beaker(A, c, r, h, col):
    x, y, z = c
    A.lathe('glass', (x, y, z), [(0, 0), (r, 0), (r, h), (r * 1.04, h), (r * 0.97, h * 0.98), (r * 0.97, 0.004), (0, 0.004)], col, 1.25, seg=20, name='beaker')
    if not A.lo:
        A.cyl('glass', (x, y + 0.004, z), r * 0.95, r * 0.95, h * 0.45, 0x6ab08a, 1.0, seg=20, name='liquid', proxy=False)


def sink(A, c, w, d):
    """嵌在台面里的水槽：一圈不锈钢沿、深色的槽、下水口。"""
    x, y, z = c
    A.box('metal', (x, y + 0.004, z), (w, 0.008, d), 0x9aa2a6, 1.1, bev=0.003, name='sink_rim')
    A.box('dark', (x, y + 0.0085, z), (w - 0.04, 0.002, d - 0.04), 0x161d1c, 1.0, name='sink', proxy=False)
    if not A.lo:
        A.cyl('metal', (x, y + 0.0095, z), 0.02, 0.02, 0.001, 0x6a7276, 1.1, seg=12, name='drain', proxy=False)


def gooseneck(A, c, h, reach):
    """鹅颈水龙头：竖管弯过来朝下，带两个旋钮。"""
    x, y, z = c
    A.cyl('metal', (x, y, z), 0.022, 0.018, 0.03, 0xb8bdb8, 1.3, seg=12, name='faucet_base')
    A.tube('metal', [(x, y + 0.02, z), (x, y + h, z), (x, y + h, z + reach * 0.7), (x, y + h - 0.05, z + reach)], 0.011, 0xb8bdb8, 1.35, seg=10, bend=0.05, name='faucet')
    if not A.lo:
        for s in (-1, 1):
            A.rod('metal', (x, y + 0.06, z), (x + s * 0.05, y + 0.06, z), 0.006, 0.006, 0xb8bdb8, 1.3, seg=8, name='valve', proxy=False)
            A.cyl('plastic', (x + s * 0.05, y + 0.05, z), 0.012, 0.012, 0.02, 0xc83a32 if s < 0 else 0x2a6ab0, 1.1, seg=10, name='valve_knob', proxy=False)


@asset('bench_chem', ao=0.35, inst=True)
def bench_chem(A):
    """化学实验台：铁皮柜、深灰石台面、水槽和鹅颈龙头、后面的试剂架（三瓶）；前面一只圆凳。"""
    A.box('metal', (0, 0.46, -0.01), (0.86, 0.76, 0.58), 0x8b9498, 1.02, bev=0.008, name='body')
    A.box('metal', (0, 0.04, -0.03), (0.82, 0.08, 0.52), 0x4a5054, 0.8, name='plinth')
    cabinet_doors(A, 0, 0.46, 0.28, 0.84, 0.72, 0x909a9e)
    stone_top(A, (0, 0.88, 0), (0.92, 0.06, 0.70), 0x5b6a72, 1.28)
    sink(A, (-0.24, 0.91, 0.0), 0.28, 0.22)
    gooseneck(A, (-0.24, 0.91, -0.15), 0.17, 0.11)
    for s in (-1, 1):
        A.rod('metal', (s * 0.38, 0.91, -0.32), (s * 0.38, 1.26, -0.32), 0.015, 0.015, 0x59636a, 1.0, seg=8, name='post')
    A.box('metal', (0, 1.26, -0.32), (0.86, 0.03, 0.13), 0x59636a, 1.05, bev=0.004, name='shelf')
    for k, (x, r, h, c) in enumerate(((-0.26, 0.035, 0.20, 0x86b4c8), (0.03, 0.03, 0.18, 0xc6ae66), (0.28, 0.025, 0.16, 0xd8d2c4))):
        reagent_bottle(A, (x, 1.275, -0.32), c, r, h, k)
    lab_stool(A, (0.02, 0, 0.46))


def lab_stool(A, c):
    x, y, z = c
    if A.lo:
        A.cyl('wood', (x, 0, z), 0.10, 0.12, 0.42, 0x4a4034, 1.0, seg=8, name='stool')
        A.cyl('wood', (x, 0.42, z), 0.14, 0.14, 0.04, 0x6a5a44, 1.02, seg=10, name='stool_top')
        return
    A.cyl('wood', (x, 0.415, z), 0.15, 0.15, 0.035, 0x6a5a44, 1.02, seg=24, round_=0.01, name='stool_top')
    for k in range(4):
        a = k / 4 * 2 * math.pi + math.pi / 4
        A.rod('metal', (x + math.cos(a) * 0.07, 0.415, z + math.sin(a) * 0.07), (x + math.cos(a) * 0.13, 0.0, z + math.sin(a) * 0.13), 0.011, 0.011, 0x4a4034, 1.0, seg=8, name='stool_leg')
        A.cyl('plastic', (x + math.cos(a) * 0.13, 0, z + math.sin(a) * 0.13), 0.014, 0.013, 0.014, BLACK, 1.0, seg=8, name='stool_foot', proxy=False)
    A.lathe('metal', (x, 0.14, z), [(0.098, 0), (0.10, 0.006), (0.098, 0.012)], 0x4a4034, 1.0, seg=24, cap0=False, cap1=False, name='stool_ring', proxy=False)


@asset('server_rack', ao=0.3, inst=True)
def server_rack(A):
    """服务器机柜：两面网孔门、门把，前后两面各六台设备的指示灯（红绿黄），顶上散热孔。"""
    A.box('metal', (0, 1.06, 0), (0.74, 2.12, 0.78), 0x2b2f33, 1.02, bev=0.012, name='body')
    rnd = random.Random(11)
    for side in (-1, 1):
        fz = side * 0.392
        if not A.lo:
            A.box('metal', (0, 1.06, fz), (0.66, 1.96, 0.004), 0x1a1d20, 1.0, name='door', proxy=False)
            if A.hi:
                for k in range(40):
                    A.box('dark', (0, 0.12 + k * 0.047, fz + side * 0.0025), (0.62, 0.012, 0.001), 0x0a0b0c, 1.0, name='mesh', proxy=False)
        for q in range(6):
            qy = 0.30 + q * 0.30
            A.box('dark', (0, qy, fz + side * 0.001), (0.58, 0.09, 0.004), 0x2e1210, 1.0, name='unit', proxy=False)
            for j, col in enumerate(((0xd8543a if q % 2 else 0x4fd08a), 0xe0b040, 0x4fd08a)):
                if j == 2 and rnd.random() < 0.5:
                    continue
                A.box('emit', (-0.20 + j * 0.06, qy, fz + side * 0.0035), (0.03, 0.03, 0.002), col, 1.0, name='led', proxy=False)
    A.box('metal', (0.30, 1.06, 0.40), (0.02, 0.20, 0.02), 0x8a9298, 1.2, bev=0.004, name='handle')
    if not A.lo:
        A.box('dark', (0, 2.121, 0), (0.50, 0.002, 0.50), 0x0a0b0c, 1.0, name='vent', proxy=False)


@asset('server_console', ao=0.3)
def server_console(A):
    """门禁管理控制台：暗红柜体、台面、立着的屏幕（滚动的门禁记录）、键盘。人站在 +z。"""
    A.box('metal', (0, 0.62, 0), (0.80, 1.24, 0.70), 0x521c1a, 1.02, bev=0.012, name='body')
    A.box('metal', (0, 1.29, 0), (0.86, 0.08, 0.76), 0x2a0f0e, 1.0, bev=0.012, name='top')
    if not A.lo:
        A.box('dark', (0, 0.62, 0.351), (0.004, 1.10, 0.002), 0x1a0808, 1.0, name='gap', proxy=False)
        slats(A, 'metal', (0, 0.18, 0.35), 0.5, 0.12, 6, 0x3a1412)
    with A.at(0, 0, -0.02, ry=math.pi):
        monitor(A, (0, 1.60, 0), w=0.62, h=0.42, base_y=1.33, scr='emit', scrcol=0x5ad0a0, scrshade=0.9, neck_z=0.06)
    for k in range(8):
        rnd = random.Random(k * 13 + 5)
        A.box('emit', (-0.20 + rnd.random() * 0.1 + (0.09 + rnd.random() * 0.09) - 0.09, 1.72 - k * 0.035, -0.0075), (0.18 + rnd.random() * 0.18, 0.008, 0.002), 0x1a4a34, 1.0, name='text', proxy=False)
    keyboard(A, (0, 1.33, 0.18), w=0.50, d=0.16)


@asset('fume_hood', ao=0.45)
def fume_hood(A):
    """通风橱：下柜、台面、玻璃拉门（拉手）、里面黑的、上柜、顶上的排风管。正面朝 -z。"""
    A.box('metal', (0, 0.45, 0), (1.90, 0.90, 0.86), 0x6f7a80, 1.05, bev=0.01, name='base')
    with A.at(0, 0, -0.43, ry=math.pi):
        cabinet_doors(A, -0.48, 0.47, 0.0, 0.92, 0.80, 0x76828a)
        cabinet_doors(A, 0.48, 0.47, 0.0, 0.92, 0.80, 0x76828a)
    A.box('stone', (0, 0.92, 0), (1.94, 0.04, 0.88), 0x39434a, 1.0, bev=0.005, name='top')
    A.box('dark', (0, 1.42, 0.02), (1.70, 0.96, 0.76), 0x1a2026, 1.0, name='inside')
    for s in (-1, 1):
        A.box('metal', (s * 0.92, 1.42, 0), (0.10, 0.96, 0.88), 0x6f7a80, 1.02, bev=0.006, name='jamb')
    A.box('glass', (0, 1.42, -0.40), (1.60, 0.90, 0.02), 0x9fc4d8, 1.25, name='sash')
    A.box('metal', (0, 1.88, -0.42), (1.70, 0.03, 0.03), 0x4a545a, 1.1, bev=0.006, name='sash_handle')
    if not A.lo:
        for s in (-1, 1):
            A.box('metal', (s * 0.80, 1.42, -0.405), (0.02, 0.90, 0.025), 0x4a545a, 1.0, name='sash_frame', proxy=False)
        A.box('metal', (0, 0.975, -0.405), (1.60, 0.02, 0.025), 0x4a545a, 1.0, name='sash_frame', proxy=False)
    A.box('metal', (0, 2.10, 0), (1.94, 0.40, 0.90), 0x6f7a80, 1.05, bev=0.01, name='upper')
    A.cyl('metal', (0, 2.30, 0), 0.14, 0.12, 0.70, 0x8a9298, 1.0, seg=20, name='duct')
    if not A.lo:
        A.cyl('metal', (0, 2.62, 0), 0.15, 0.15, 0.04, 0x7a8288, 1.0, seg=20, name='duct_band', proxy=False)


@asset('eyewash', ao=0.3)
def eyewash(A):
    """洗眼器：地上立一根绿管，顶上一个碗口朝上的喷头，旁边一个推板。"""
    A.cyl('plastic', (0, 0, 0), 0.06, 0.06, 0.02, 0x4a8a6a, 1.0, seg=12, name='flange')
    A.rod('plastic', (0, 0, 0), (0, 0.98, 0), 0.03, 0.03, 0x5aa07a, 1.1, seg=12, caps=False, name='pipe')
    A.tube('plastic', [(0, 0.96, 0), (0, 1.0, 0), (0, 1.0, 0.16)], 0.026, 0x5aa07a, 1.1, seg=10, bend=0.04, name='arm')
    A.lathe('plastic', (0, 0.98, 0.20), [(0, 0), (0.03, 0), (0.12, 0.05), (0.125, 0.06), (0.115, 0.06), (0.03, 0.012), (0, 0.012)], 0x5aa07a, 1.1, seg=20, name='bowl')
    if not A.lo:
        A.cyl('plastic', (-0.03, 1.035, 0.20), 0.012, 0.01, 0.02, 0xe8e8e0, 1.0, seg=8, name='nozzle', proxy=False)
        A.cyl('plastic', (0.03, 1.035, 0.20), 0.012, 0.01, 0.02, 0xe8e8e0, 1.0, seg=8, name='nozzle', proxy=False)
        A.box('plastic', (0.16, 0.95, 0.10), (0.12, 0.06, 0.012), 0x4a8a6a, 1.0, bev=0.004, name='push', proxy=False)
