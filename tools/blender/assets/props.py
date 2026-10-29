"""教室、走廊、宿舍、办公室里常见的小件：吊扇、吊装灯、吸顶灯盘、安全出口灯、应急灯、监控、烟感、开关插座、
饮水机、分类垃圾桶、卫生角、盆栽、柜式空调、投影机、窗帘、一排书、一摞书、水杯、墙上的画框、教室垃圾桶、地上的纸。

约定（和 props.js 一样）：贴墙的东西背面在局部 z=0，往 +z 长出来；吊在顶上的按吊顶 3.0 米建（ceil=3.0）。
灯面用标签 lamp 染色：亮着、熄着、快坏了由游戏换材质和颜色。"""
import math
import random

from mathutils import Vector

from wdfz import asset, rrect
from assets._parts import rpanel, handle_bar, knob, screw, led, slats, book, BOOK_COLS, STEEL, CHROME, BLACK

CEIL = 3.0


# ---------------------------------------------------------------- 吊扇、灯
@asset('fan_ceiling', ao=0.3, ground=False, ceil=CEIL, inst=True)
def fan_ceiling(A):
    """吊扇：吸顶罩、吊杆、电机罩、三片带一点倾角的扇叶（叶架用螺钉固定），底盖。扇叶离地 2.70 米。"""
    A.lathe('plastic', (0, CEIL - 0.07, 0), [(0.0, 0.0), (0.07, 0), (0.075, 0.035), (0.05, 0.07), (0, 0.07)], 0xe6e4de, 1.0, seg=16, name='canopy')
    A.rod('metal', (0, CEIL - 0.07, 0), (0, 2.80, 0), 0.013, 0.013, 0xd8d6d0, 1.05, seg=10, caps=False, name='downrod')
    A.lathe('plastic', (0, 2.67, 0), [(0.0, 0.0), (0.02, 0), (0.10, 0.015), (0.125, 0.05), (0.11, 0.10), (0.04, 0.13), (0.02, 0.135), (0, 0.135)], 0xe8e6e0, 1.02, seg=24, name='motor')
    if not A.lo:
        A.lathe('metal', (0, 2.715, 0), [(0.126, 0.0), (0.128, 0.006), (0.126, 0.012)], 0xb8bcbe, 1.1, seg=24, cap0=False, cap1=False, name='trim', proxy=False)
        A.lathe('plastic', (0, 2.655, 0), [(0.0, 0.0), (0.035, 0.0), (0.03, 0.015), (0, 0.016)], 0xd0cec8, 1.0, seg=16, name='cap')
    for k in range(3):
        with A.at(0, 0, 0, ry=k * 2 * math.pi / 3):
            A.box('metal', (0, 2.70, 0.17), (0.035, 0.012, 0.12), 0xb8bcbe, 1.1, bev=0.003, name='arm')
            if A.hi:
                for dz in (0.14, 0.20):
                    A.cyl('metal', (0, 2.706, dz), 0.005, 0.005, 0.004, 0x8c949a, 1.1, seg=8, name='screw', proxy=False)
            # 扇叶：根部窄、梢部宽、头上圆，绕自己的长轴转 8°
            prof = [(-0.045, 0.0), (0.045, 0.0), (0.062, 0.30), (0.06, 0.46), (0.045, 0.505), (0.0, 0.52), (-0.045, 0.505), (-0.06, 0.46), (-0.062, 0.30)]
            with A.at(0, 2.705, 0.20, rz=0.14):
                A.prism('plastic', (0, 0, 0), [(u, v) for (u, v) in prof], 0.008, 0xe2e0d8, 1.0, bev=0.002, rot=(math.pi / 2, 0, 0), name='blade', proxy=False)
            A.proxy_box((0, 2.705, 0.46), (0.12, 0.01, 0.52))


@asset('lamp_hang_120', ao=0.25, ground=False, ceil=CEIL, tints={'lamp': 0xe4f0f6}, inst=True)
def lamp_hang_120(A):
    """吊装的护眼灯（教室）：两根吊线和吸顶座、铝外壳、两头端盖、朝下的磨砂发光面（标签 lamp）、几道横向格栅。灯面离地 2.68 米。"""
    ln, wd, ly = 1.2, 0.22, 2.68
    hy = ly + 0.03
    for s in (-1, 1):
        A.rod('metal', (s * ln * 0.38, hy + 0.03, 0), (s * ln * 0.38, CEIL - 0.012, 0), 0.0025, 0.0025, 0x9aa0a4, 1.0, seg=6, caps=False, name='wire', proxy=False)
        A.cyl('metal', (s * ln * 0.38, CEIL - 0.022, 0), 0.025, 0.025, 0.022, 0xc8ccce, 1.05, seg=12, round_=0.004, name='rose')
        if not A.lo:
            A.cyl('metal', (s * ln * 0.38, hy + 0.035, 0), 0.008, 0.008, 0.02, 0x9aa0a4, 1.05, seg=8, name='grip', proxy=False)
    A.box('metal', (0, hy + 0.015, 0), (ln, 0.05, wd), 0xd8dcdc, 1.05, bev=0.012, name='housing')
    for s in (-1, 1):
        A.box('metal', (s * (ln / 2 + 0.004), hy + 0.01, 0), (0.01, 0.05, wd * 0.9), 0xa8aeb0, 1.0, bev=0.003, name='endcap')
    A.box('emit', (0, ly - 0.007, 0), (ln - 0.04, 0.006, wd - 0.03), 0xffffff, 1.0, tag='lamp', name='face', proxy=False)
    if not A.lo:
        n = 6
        for k in range(1, n):
            A.box('metal', (-ln / 2 + ln * k / n, ly - 0.012, 0), (0.012, 0.012, wd - 0.03), 0xc8ccce, 1.1, name='louver', proxy=False)
        for s in (-1, 1):
            A.box('metal', (0, ly - 0.012, s * (wd / 2 - 0.012)), (ln - 0.04, 0.012, 0.008), 0xc8ccce, 1.1, name='rim', proxy=False)


def ceiling_panel(A, lw, ld):
    """吸顶灯盘：铝框、磨砂发光面（标签 lamp）、两头的端盖。"""
    A.box('metal', (0, CEIL - 0.025, 0), (lw + 0.08, 0.05, ld + 0.08), 0x9aa4a8, 1.0, bev=0.008, name='frame')
    A.box('emit', (0, CEIL - 0.0525, 0), (lw, 0.004, ld), 0xffffff, 1.0, tag='lamp', name='face', proxy=False)
    if not A.lo:
        for s in (-1, 1):
            A.box('metal', (s * (lw / 2 + 0.01), CEIL - 0.053, 0), (0.02, 0.006, ld + 0.02), 0x8a9498, 1.0, name='endcap', proxy=False)
            A.box('metal', (0, CEIL - 0.053, s * (ld / 2 + 0.01)), (lw + 0.04, 0.006, 0.02), 0x8a9498, 1.0, name='edge', proxy=False)


@asset('light_panel_180', ao=0.2, ground=False, ceil=CEIL, tints={'lamp': 0xdcecf4}, inst=True)
def light_panel_180(A):
    ceiling_panel(A, 1.8, 0.24)


@asset('light_panel_120', ao=0.2, ground=False, ceil=CEIL, tints={'lamp': 0xdcecf4}, inst=True)
def light_panel_120(A):
    ceiling_panel(A, 1.2, 0.20)


def exit_sign(A, arrow):
    """安全出口灯：白色灯箱、绿色发光面、白色的门框和往门跑的人；arrow 时多一个箭头。中心在原点，背面 z=0。"""
    rpanel(A, 'plastic', (0, 0, 0.022), 0.40, 0.16, 0.044, 0.01, 0xe8e8e2, 1.0, name='box')
    A.box('emit', (0, 0, 0.0445), (0.36, 0.12, 0.002), 0x2fae6a, 1.0, name='face', proxy=False)
    A.box('emit', (-0.11, 0, 0.0465), (0.07, 0.09, 0.001), 0xe8fff0, 1.0, name='door', proxy=False)
    A.box('emit', (-0.11, 0, 0.0472), (0.045, 0.07, 0.001), 0x2fae6a, 1.0, name='door_in', proxy=False)
    if A.lo:
        A.box('emit', (-0.02, 0, 0.047), (0.04, 0.07, 0.001), 0xe8fff0, 1.0, name='man', proxy=False)
    else:
        A.blob('emit', (-0.025, 0.033, 0.0475), (0.011, 0.011, 0.002), 0xe8fff0, 1.0, seg=10, name='head', proxy=False)
        for (a, b, r) in (((-0.03, 0.02), (-0.015, -0.01), 0.008), ((-0.015, -0.01), (0.005, -0.04), 0.006), ((-0.015, -0.01), (-0.04, -0.035), 0.006),
                          ((-0.028, 0.012), (-0.002, 0.0), 0.005), ((-0.028, 0.012), (-0.05, 0.0), 0.005)):
            A.rod('emit', (a[0], a[1], 0.0475), (b[0], b[1], 0.0475), r, r * 0.9, 0xe8fff0, 1.0, seg=6, name='limb', proxy=False)
    if arrow:
        A.prism('emit', (0, 0, 0.0475), [(0.06, -0.008), (0.11, -0.008), (0.11, -0.022), (0.15, 0.0), (0.11, 0.022), (0.11, 0.008), (0.06, 0.008)], 0.001, 0xe8fff0, 1.0, name='arrow', proxy=False)


@asset('sign_exit', ao=0.25, ground=False, wall=0.0)
def sign_exit(A):
    exit_sign(A, False)


@asset('sign_exit_arrow', ao=0.25, ground=False, wall=0.0)
def sign_exit_arrow(A):
    exit_sign(A, True)


@asset('light_emergency', ao=0.25, ground=False, wall=0.0)
def light_emergency(A):
    """应急照明灯：白壳、充电指示灯、两个能转的圆灯头。中心在原点，背面 z=0。"""
    A.box('plastic', (0, 0, 0.04), (0.30, 0.10, 0.08), 0xeeeeea, 1.0, bev=0.012, name='body')
    led(A, (0.09, 0.015, 0.0805), 0x6ad08a, 0.008)
    if not A.lo:
        slats(A, 'plastic', (-0.06, 0.012, 0.080), 0.10, 0.03, 4, 0xe2e2de)
    for s in (-1, 1):
        A.cyl('plastic', (s * 0.11, -0.05, 0.06), 0.02, 0.02, 0.02, 0xd8d8d4, 1.0, seg=10, name='swivel')
        with A.at(s * 0.11, -0.065, 0.065, rx=0.5):
            A.cyl('plastic', (0, -0.03, 0), 0.035, 0.04, 0.05, 0xe2e2de, 1.0, seg=16, round_=0.006, name='head')
            A.cyl('emit', (0, -0.032, 0), 0.03, 0.03, 0.003, 0xf4f2e8, 0.85, seg=16, name='lens', proxy=False)


@asset('cam_dome', ao=0.2, ground=False, ceil=CEIL)
def cam_dome(A):
    """吸顶的半球监控：白色底座、深色半球罩（里面隐约一个镜头）。"""
    A.lathe('plastic', (0, CEIL - 0.03, 0), [(0, 0), (0.075, 0), (0.08, 0.03), (0, 0.03)], 0xeeeeea, 1.0, seg=24, name='base')
    A.lathe('dark', (0, CEIL - 0.10, 0), [(0.0, 0.0), (0.04, 0.012), (0.062, 0.04), (0.068, 0.07), (0, 0.07)], 0x15191c, 1.0, seg=24, name='dome')
    if not A.lo:
        A.cyl('dark', (0.0, CEIL - 0.095, 0.02), 0.012, 0.012, 0.01, 0x050607, 1.0, seg=10, dirn=(0, -1, 0.4), name='lens', proxy=False)
        led(A, (0.05, CEIL - 0.0305, 0.0), 0xd84a3a, 0.005, nrm=(0, 1, 0))


@asset('smoke_detector', ao=0.2, ground=False, ceil=CEIL, inst=True)
def smoke_detector(A):
    """烟感：白色圆盘，侧面一圈进烟孔，红色指示灯。"""
    A.lathe('plastic', (0, CEIL - 0.045, 0), [(0.0, 0), (0.045, 0.0), (0.06, 0.02), (0.06, 0.045), (0, 0.045)], 0xf0f0ec, 1.0, seg=24, name='body')
    if not A.lo:
        for k in range(12):
            a = k / 12 * 2 * math.pi
            A.box('dark', (math.cos(a) * 0.0605, CEIL - 0.03, math.sin(a) * 0.0605), (0.004, 0.008, 0.012), 0x8a8a86, 1.0, rot=-a, name='vent', proxy=False)
    A.box('emit', (0.03, CEIL - 0.0465, 0), (0.008, 0.002, 0.008), 0xd84a3a, 1.0, name='led', proxy=False)


@asset('switch_3', ao=0.2, ground=False, wall=0.0)
def switch_3(A):
    """三联开关面板：白面板、三个翘板（一个按下去的）。中心在原点，背面 z=0。"""
    w = 0.086
    rpanel(A, 'plastic', (0, 0, 0.005), w * 3 - 0.012, w, 0.01, 0.006, 0xf2f2ee, 1.0, name='plate')
    for k in range(3):
        A.box('plastic', ((k - 1) * (w - 0.006), 0, 0.0115), (0.03, 0.05, 0.004), 0xe4e4de, 1.0, bev=0.0015, rot=(0.08 if k == 1 else -0.08, 0, 0), name='rocker', proxy=False)


@asset('socket', ao=0.2, ground=False, wall=0.0)
def socket(A):
    """五孔插座：两孔加三孔。"""
    rpanel(A, 'plastic', (0, 0, 0.005), 0.086, 0.086, 0.01, 0.006, 0xf2f2ee, 1.0, name='plate')
    for (x, y, rz) in ((-0.016, 0.018, 0), (0.016, 0.018, 0), (-0.014, -0.016, 0.5), (0.014, -0.016, -0.5), (0.0, -0.03, 0)):
        A.box('dark', (x, y, 0.0102), (0.004, 0.012, 0.002), 0x2a2a2a, 1.0, rot=(0, 0, rz), name='hole', proxy=False)


# ---------------------------------------------------------------- 走廊、宿舍的设施
@asset('water_dispenser', ao=0.35)
def water_dispenser(A):
    """饮水机：机身、出水口凹槽、红蓝两个龙头、接水盘、两颗指示灯、上面倒扣的一桶水（蓝色的桶，里面水是满的）。正面 +z。"""
    A.box('plastic', (0, 0.48, 0), (0.32, 0.96, 0.32), 0xeceae4, 1.0, bev=0.02, name='body')
    A.box('dark', (0, 0.80, 0.150), (0.22, 0.14, 0.024), 0x2a3036, 1.0, bev=0.006, name='recess')
    for (x, c) in ((-0.05, 0xc83a32), (0.05, 0x2a6ab0)):
        A.box('plastic', (x, 0.835, 0.164), (0.03, 0.035, 0.016), c, 1.1, bev=0.004, name='tap')
        A.cyl('plastic', (x, 0.81, 0.165), 0.006, 0.005, 0.02, 0x2a2a2a, 1.0, seg=8, name='spout', proxy=False)
    A.box('metal', (0, 0.735, 0.17), (0.20, 0.015, 0.05), 0x8a9094, 1.05, bev=0.003, name='tray')
    led(A, (0.12, 0.92, 0.16), 0xd84a3a, 0.012)
    led(A, (0.12, 0.89, 0.16), 0x5ad08a, 0.012)
    if not A.lo:
        slats(A, 'plastic', (0, 0.25, 0.16), 0.20, 0.10, 5, 0xe0ded8)
        A.cyl('plastic', (0, 0.958, 0), 0.07, 0.07, 0.012, 0xd8d6d0, 1.0, seg=16, name='seat', proxy=False)
    A.lathe('glass', (0, 0.96, 0), [(0.03, 0), (0.03, 0.06), (0.12, 0.10), (0.135, 0.16), (0.135, 0.22), (0.13, 0.235), (0.135, 0.25), (0.135, 0.40), (0.12, 0.44), (0.0, 0.46)], 0x7ab4d8, 1.3, seg=24, name='bottle')


@asset('bin_pair', ao=0.35)
def bin_pair(A):
    """分类垃圾桶一组两个（可回收蓝、其他灰）：桶身、翻盖（推板）、白色标签和图标。正面 +z。"""
    cols = ((0x2a6ab0, 0xe8e8e2), (0x4a4e52, 0xe8e8e2))
    for k, x in enumerate((-0.21, 0.21)):
        c, lc = cols[k]
        A.prism('plastic', (x, 0, 0), [(-0.17, 0.0), (0.17, 0.0), (0.19, 0.66), (-0.19, 0.66)], 0.34, c, 1.0, bev=0.02, name='bin')
        A.box('plastic', (x, 0.68, -0.01), (0.40, 0.04, 0.36), c, 0.8, bev=0.012, name='lid')
        A.box('plastic', (x, 0.672, 0.155), (0.18, 0.024, 0.02), c, 0.7, bev=0.006, rot=(-0.3, 0, 0), name='flap')
        A.box('plastic', (x, 0.58, 0.172), (0.22, 0.004, 0.006), 0xffffff, 1.0, name='stripe', proxy=False)
        A.box('paper', (x, 0.44, 0.171), (0.16, 0.14, 0.004), lc, 1.0, rot=(0.03, 0, 0), name='label', proxy=False)
        if not A.lo:
            if k == 0:
                for a in range(3):
                    aa = a * 2 * math.pi / 3 + 0.5
                    A.box('paper', (x + math.cos(aa) * 0.025, 0.45 + math.sin(aa) * 0.025, 0.1735), (0.03, 0.008, 0.001), c, 1.0, rot=(0.03, 0, aa + math.pi / 2), name='icon', proxy=False)
            else:
                A.box('paper', (x, 0.45, 0.1735), (0.05, 0.05, 0.001), c, 1.0, rot=(0.03, 0, 0.78), name='icon', proxy=False)


@asset('cleaning_corner', ao=0.4, wall=0.0)
def cleaning_corner(A):
    """卫生角（靠墙，墙在 z=0）：蓝水桶（里面有半桶脏水、提手）、斜靠在墙上的拖把（布条头）、扫把、立着的簸箕。"""
    A.lathe('plastic', (-0.28, 0, 0.20), [(0, 0), (0.12, 0), (0.15, 0.28), (0.158, 0.285), (0.152, 0.29), (0.142, 0.285), (0.112, 0.012), (0, 0.012)], 0x2a6ab0, 1.0, seg=24, name='bucket')
    A.cyl('dark', (-0.28, 0.20, 0.20), 0.138, 0.138, 0.002, 0x2a3a48, 1.0, seg=20, name='water', proxy=False)
    A.tube('metal', [(-0.428, 0.27, 0.20), (-0.36, 0.40, 0.20), (-0.20, 0.40, 0.20), (-0.132, 0.27, 0.20)], 0.004, 0x9aa0a4, 1.0, seg=6, bend=0.05, name='bail', proxy=False)
    # 拖把：杆斜靠墙，布条头团在地上
    A.rod('wood', (0.02, 0.10, 0.10), (0.10, 1.30, 0.03), 0.012, 0.012, 0xb89a6a, 1.0, seg=8, name='mop_stick')
    A.cyl('plastic', (0.02, 0.07, 0.11), 0.03, 0.025, 0.05, 0x3a8a4a, 1.0, seg=10, dirn=(0.066, 1, -0.058), name='mop_clamp', proxy=False)
    if A.lo:
        A.blob('fabric', (0.02, 0.07, 0.12), (0.09, 0.07, 0.08), 0xb8b4a8, 1.0, seg=7, jit=0.3, seed=3, name='mop')
    else:
        rnd = random.Random(5)
        n = 18 if A.L <= 1 else 9
        for k in range(n):
            a = k / n * 2 * math.pi
            r = 0.02 + rnd.random() * 0.02
            ex, ez = math.cos(a) * (0.06 + rnd.random() * 0.05), math.sin(a) * (0.05 + rnd.random() * 0.04)
            A.tube('fabric', [(0.02 + math.cos(a) * r, 0.06, 0.12 + math.sin(a) * r), (0.02 + ex * 0.7, 0.03, 0.12 + ez * 0.7), (0.02 + ex, 0.008, 0.12 + ez)], 0.012, 0xb8b4a8, 0.9 + rnd.random() * 0.15, seg=5, bend=0.03, name='strand', proxy=False)
        A.proxy_box((0.02, 0.05, 0.12), (0.2, 0.1, 0.17))
    # 扫把
    A.rod('plastic', (0.26, 0.18, 0.12), (0.32, 1.20, 0.03), 0.011, 0.011, 0x3a8a4a, 1.0, seg=8, name='broom_stick')
    A.box('plastic', (0.255, 0.16, 0.13), (0.22, 0.04, 0.05), 0x2a5a34, 1.0, bev=0.008, name='broom_head')
    if A.lo:
        A.box('plastic', (0.255, 0.08, 0.13), (0.24, 0.12, 0.05), 0x5a4a30, 1.0, name='bristle')
    else:
        A.prism('plastic', (0.255, 0, 0.13), [(-0.11, 0.14), (0.11, 0.14), (0.14, 0.0), (-0.14, 0.0)], 0.045, 0x6a5a3a, 1.0, bev=0.004, name='bristle')
    A.box('plastic', (0.40, 0.16, 0.035), (0.24, 0.30, 0.035), 0x3a6aa0, 1.0, bev=0.008, name='dustpan')
    A.rod('plastic', (0.40, 0.31, 0.035), (0.40, 0.62, 0.035), 0.01, 0.01, 0x3a6aa0, 1.0, seg=8, name='dustpan_handle')


def plant(A, seed, money):
    """盆栽：陶盆（盆沿、托盘）、土；money=True 是发财树（编起来的三根干、分叉、掌状的叶团），否则是绿萝（藤上一片片心形叶）。"""
    A.lathe('plastic', (0, 0, 0), [(0, 0), (0.16, 0), (0.17, 0.02), (0.16, 0.02)], 0x6a4a32, 1.0, seg=24, name='saucer')
    A.lathe('plastic', (0, 0.02, 0), [(0, 0), (0.13, 0), (0.17, 0.30), (0.185, 0.32), (0.18, 0.34), (0.165, 0.33), (0.158, 0.30), (0, 0.30)], 0x8a5a3a, 1.0, seg=24, name='pot')
    A.cyl('dark', (0, 0.30, 0), 0.158, 0.158, 0.012, 0x2a2218, 1.0, seg=20, name='soil', proxy=False)
    rnd = random.Random(seed)
    leafc = (0x3f6e3a, 0x4c7c44, 0x365f32)
    if money:
        for k in range(3):
            a = k / 3 * 2 * math.pi
            pts = []
            for j in range(7):
                t = j / 6
                pts.append((math.cos(a + t * 3.0) * 0.022, 0.31 + t * 0.62, math.sin(a + t * 3.0) * 0.022))
            A.tube('bark', pts, 0.016, 0x7a6a4a, 1.0, seg=6, name='trunk', proxy=False)
        tops = [(0.0, 1.05, 0.0)]
        for k in range(5 if not A.lo else 3):
            a = k * 1.3 + rnd.random()
            tops.append((math.cos(a) * 0.22, 0.95 + rnd.random() * 0.25, math.sin(a) * 0.22))
        for (x, y, z) in tops:
            A.tube('bark', [(0, 0.92, 0), (x * 0.5, (0.92 + y) / 2, z * 0.5), (x, y, z)], 0.007, 0x5a6a3a, 1.0, seg=5, bend=0.05, name='twig', proxy=False)
            if A.L <= 1:
                n = 7
                for i in range(n):
                    aa = i / n * 2 * math.pi + rnd.random()
                    with A.at(x, y, z, ry=aa, rx=0.5 + rnd.random() * 0.4):
                        A.prism('leaf', (0, 0, 0.0), [(-0.02, 0.0), (0.0, -0.01), (0.02, 0.0), (0.028, 0.08), (0.0, 0.13), (-0.028, 0.08)], 0.002, leafc[i % 3], 1.0, rot=(math.pi / 2, 0, 0), name='leaf', proxy=False)
            else:
                A.blob('leaf', (x, y + 0.03, z), (0.14, 0.06, 0.14), leafc[0], 1.0, seg=8, jit=0.4, seed=seed, name='leafball', proxy=False)
        A.proxy_cyl((0, 0.32, 0), 0.25, 0.25, 0.9)
    else:
        n = 9 if A.L <= 1 else (5 if A.L == 2 else 3)
        for k in range(n):
            a = k / n * 2 * math.pi + rnd.random() * 0.5
            r = 0.05 + rnd.random() * 0.12
            top = 0.55 + rnd.random() * 0.45
            tx, tz = math.cos(a) * r, math.sin(a) * r
            A.tube('leaf', [(math.cos(a) * 0.03, 0.31, math.sin(a) * 0.03), (tx * 0.6, (0.31 + top) / 2, tz * 0.6), (tx, top, tz)], 0.006, 0x4a6a3a, 1.0, seg=5, bend=0.1, name='stem', proxy=False)
            if A.L <= 1:
                for i in range(6):
                    t = 0.35 + i * 0.12
                    px, py, pz = tx * (0.3 + t * 0.7), 0.31 + (top - 0.31) * t, tz * (0.3 + t * 0.7)
                    with A.at(px, py, pz, ry=a + i * 2.1, rx=0.9):
                        A.prism('leaf', (0, 0, 0), [(0.0, 0.0), (0.03, 0.03), (0.035, 0.065), (0.0, 0.10), (-0.035, 0.065), (-0.03, 0.03)], 0.002, leafc[(i + k) % 3], 1.0, rot=(math.pi / 2, 0, 0), name='leaf', proxy=False)
            else:
                A.blob('leaf', (tx, top + 0.04, tz), (0.12, 0.09, 0.12), leafc[k % 2], 1.0, seg=8, jit=0.4, seed=seed * 5 + k, name='leafball', proxy=False)
        A.proxy_cyl((0, 0.32, 0), 0.22, 0.22, 0.7)


@asset('plant_money', ao=0.35)
def plant_money(A):
    plant(A, 3, True)


@asset('plant_pothos', ao=0.35)
def plant_pothos(A):
    plant(A, 7, False)


@asset('ac_cabinet', ao=0.35, wall=0.0)
def ac_cabinet(A):
    """柜式空调（背靠墙，墙在 z=0）：圆角机身、上面的出风口和导风叶、显示屏、下面的进风格栅、底座。"""
    A.box('plastic', (0, 0.89, 0.15), (0.50, 1.74, 0.30), 0xeeece6, 1.0, bev=0.04, name='body')
    A.box('plastic', (0, 0.015, 0.15), (0.46, 0.03, 0.27), 0xc8c6c0, 1.0, bev=0.008, name='base')
    A.box('dark', (0, 1.48, 0.296), (0.40, 0.16, 0.012), 0x3a4046, 1.0, bev=0.004, name='outlet')
    for k in range(5):
        A.box('plastic', (0, 1.42 + k * 0.03, 0.303), (0.38, 0.006, 0.02), 0xd8d6d0, 1.0, rot=(0.5, 0, 0), name='vane', proxy=False)
    A.box('dark', (0, 1.22, 0.3005), (0.16, 0.06, 0.003), 0x1a2024, 1.0, name='display', proxy=False)
    A.box('emit', (0.03, 1.22, 0.3022), (0.04, 0.02, 0.001), 0x6ac0e8, 0.8, name='digits', proxy=False)
    led(A, (-0.05, 1.22, 0.302), 0x5ad08a, 0.006)
    A.box('dark', (0, 0.32, 0.3), (0.40, 0.40, 0.006), 0xb8b6b0, 1.0, name='intake', proxy=False)
    for k in range(9 if not A.lo else 4):
        A.box('plastic', (0, 0.15 + k * (0.36 / (9 if not A.lo else 4)), 0.304), (0.40, 0.012, 0.006), 0xe2e0da, 1.0, name='grille', proxy=False)


@asset('projector', ao=0.25, ground=False, ceil=CEIL)
def projector(A):
    """吊装投影机：吸顶盘、伸缩吊杆、托架、机身（散热孔、镜头朝 -z、对焦环）。机身底面离地 2.66 米。"""
    A.cyl('metal', (0, CEIL - 0.02, 0), 0.06, 0.06, 0.02, 0x9aa0a4, 1.0, seg=16, name='plate')
    A.rod('metal', (0, CEIL - 0.02, 0), (0, 2.85, 0), 0.02, 0.02, 0xa8aeb0, 1.05, seg=10, caps=False, name='pole')
    A.rod('metal', (0, 2.85, 0), (0, 2.775, 0), 0.016, 0.016, 0xc8ccce, 1.1, seg=10, caps=False, name='pole_in', proxy=False)
    A.box('metal', (0, 2.77, 0), (0.22, 0.012, 0.18), 0x8a9094, 1.0, bev=0.003, name='bracket')
    A.box('plastic', (0, 2.71, 0), (0.32, 0.10, 0.26), 0xeceae4, 1.0, bev=0.025, name='body')
    if not A.lo:
        for k in range(6):
            A.box('dark', (0.161, 2.70, -0.06 + k * 0.024), (0.002, 0.05, 0.008), 0x3a3e42, 1.0, name='vent', proxy=False)
        A.cyl('plastic', (0.08, 2.71, -0.13), 0.042, 0.042, 0.012, 0x2a2e32, 1.0, seg=20, dirn=(0, 0, -1), name='ring', proxy=False)
    A.cyl('dark', (0.08, 2.71, -0.13), 0.035, 0.03, 0.025, 0x1a1e22, 1.0, seg=20, dirn=(0, 0, -1), name='lens')
    A.cyl('glass', (0.08, 2.71, -0.154), 0.026, 0.026, 0.002, 0x5a7a9a, 1.3, seg=16, dirn=(0, 0, -1), name='glass', proxy=False)


@asset('curtains_150', ao=0.35, ground=False, wall=0.0, tints={'c': 0x5a7a9a})
def curtains_150(A):
    """窗帘（1.5 米宽的窗）：帘杆和两头的装饰头、挂钩，两边各一幅收起来的布（竖褶：截面是波浪），下摆略散开。"""
    w, y0, y1 = 1.5, 1.02, 2.42
    A.rod('metal', (-w / 2 - 0.25, y1, 0.10), (w / 2 + 0.25, y1, 0.10), 0.012, 0.012, 0xa8a49c, 1.0, seg=10, name='rod')
    for s in (-1, 1):
        A.blob('metal', (s * (w / 2 + 0.27), y1, 0.10), (0.022, 0.022, 0.022), 0x8a8478, 1.0, seg=10, name='finial', proxy=False)
        A.box('metal', (s * (w / 2 + 0.15), y1, 0.05), (0.02, 0.03, 0.10), 0x8a8478, 1.0, bev=0.004, name='bracket', proxy=False)
    nf = (14, 10, 6, 3)[A.L]
    ny = (10, 6, 3, 1)[A.L]
    for s in (-1, 1):
        cx = s * (w / 2 + 0.02)
        pw = 0.32
        # 一幅布：一张波浪形的厚片（前后两面）
        for face in (1, -1):
            verts, faces = [], []
            for j in range(ny + 1):
                t = j / ny
                y = y1 - 0.03 - (y1 - y0 - 0.04) * t
                spread = 1.0 + 0.25 * t * t
                for i in range(nf * 2 + 1):
                    u = (i / (nf * 2) - 0.5) * pw * spread
                    z = 0.10 + 0.022 * math.sin(i / 2 * math.pi) + face * 0.004
                    verts.append((cx + u, y, z))
            m = nf * 2 + 1
            for j in range(ny):
                for i in range(m - 1):
                    a = j * m + i
                    f = (a, a + 1, a + m + 1, a + m)
                    faces.append(f if face < 0 else f[::-1])
            A.mesh('fabric', verts, faces, 0xffffff, 1.0, smooth=True, sharp=None, tag='c', name='curtain')
        A.proxy_box((cx, (y0 + y1) / 2, 0.10), (pw * 1.2, y1 - y0, 0.06))
        if not A.lo:
            for i in range(5):
                x = cx + (i / 4 - 0.5) * pw
                A.tube('metal', [(x, y1 - 0.012, 0.10), (x, y1 - 0.03, 0.10)], 0.003, 0x8a8478, 1.0, seg=4, name='hook', proxy=False)


# ---------------------------------------------------------------- 书、杯子、画框
def books_row(A, length, seed):
    """课桌上的一排书：两片金属书立夹着，书一本本竖着（厚薄、高矮、深浅不一，偶尔一本斜靠）。沿局部 x 排开，书脊朝 -z。"""
    rnd = random.Random(seed)
    h0 = 0.0
    A.box('metal', (-length / 2, 0.07, 0), (0.004, 0.14, 0.14), 0x3a4046, 1.0, bev=0.001, name='bookend')
    A.box('metal', (-length / 2 + 0.035, 0.002, 0), (0.07, 0.004, 0.14), 0x3a4046, 1.0, name='bookend_foot')
    u = -length / 2 + 0.006
    k = 0
    while u < length / 2 - 0.03:
        t = 0.010 + rnd.random() * 0.022
        if A.lo:
            t *= 2
        h = 0.17 + rnd.random() * 0.09
        d = 0.12 + rnd.random() * 0.05
        if u + t > length / 2 - 0.01:
            break
        col = BOOK_COLS[(seed + k * 3) % len(BOOK_COLS)]
        book(A, (u + t / 2, h / 2 + 0.004, 0.005 + (0.15 - d) / 2 * 0), t, h, d, col, ry=0.0)
        u += t + 0.001
        k += 1
    A.box('metal', (u + 0.004, 0.07, 0), (0.004, 0.14, 0.14), 0x3a4046, 1.0, bev=0.001, name='bookend')
    A.meta['len'] = round(u + 0.006 + length / 2, 3)


ROW_LENS = (0.26, 0.32, 0.38, 0.44)
for _i, _len in enumerate(ROW_LENS):
    for _v in range(2):
        def _mk(i, ln, v):
            @asset('books_row_%d%s' % (int(round(ln * 100)), 'ab'[v]), ao=0.3, ground=False, inst=True)
            def f(A):
                books_row(A, ln, 11 + i * 7 + v * 31)
        _mk(_i, _len, _v)


def books_pile(A, n, seed):
    """一摞横放的书（大小不一，错开一点、转一点）。"""
    rnd = random.Random(seed)
    h = 0.0
    for i in range(n):
        t = 0.012 + rnd.random() * 0.02
        w = 0.19 + rnd.random() * 0.07
        d = 0.14 + rnd.random() * 0.06
        col = BOOK_COLS[(seed + i * 2) % len(BOOK_COLS)]
        with A.at((rnd.random() - 0.5) * 0.03, h + t / 2, (rnd.random() - 0.5) * 0.02, ry=(rnd.random() - 0.5) * 0.3, rz=math.pi / 2):
            book(A, (0, 0, 0), t, w, d, col)
        h += t
    A.meta['h'] = round(h, 4)


for _n in (2, 3, 4):
    def _mkp(n):
        @asset('books_pile_%d' % n, ao=0.3, ground=False, inst=True)
        def f(A):
            books_pile(A, n, 5 + n * 13)
    _mkp(_n)


@asset('bottle_water', ao=0.2, ground=False, tints={'b': 0x8ab8d8}, inst=True)
def bottle_water(A):
    """学生的水杯：磨砂塑料杯身（标签 b 染色）、杯身上一道防滑圈、深色的盖和提手。高 0.20 米。"""
    h = 0.20
    if A.lo:
        A.cyl('plastic', (0, 0, 0), 0.034, 0.034, h, 0xffffff, 1.1, seg=6, tag='b', name='body')
        return
    A.lathe('plastic', (0, 0, 0), [(0, 0), (0.031, 0.0), (0.034, 0.006), (0.035, 0.02), (0.035, h * 0.85), (0.03, h * 0.9), (0, h * 0.9)], 0xffffff, 1.1, seg=20, tag='b', name='body')
    A.lathe('plastic', (0, h * 0.35, 0), [(0.0352, 0), (0.0362, 0.004), (0.0362, 0.03), (0.0352, 0.034)], 0xffffff, 0.85, seg=20, cap0=False, cap1=False, tag='b', name='grip', proxy=False)
    A.lathe('plastic', (0, h * 0.9, 0), [(0, 0), (0.029, 0), (0.03, h * 0.10), (0.024, h * 0.13), (0, h * 0.13)], 0x2a3036, 1.0, seg=20, name='lid')
    A.tube('plastic', [(-0.012, h * 1.02, 0), (-0.012, h * 1.1, 0), (0.012, h * 1.1, 0), (0.012, h * 1.02, 0)], 0.004, 0x2a3036, 1.0, seg=6, bend=0.008, name='loop', proxy=False)


def poster(A, w, h, seed):
    """墙上的画框（背面 z=0）：木框、纸（标签 p）、彩色抬头（标签 h）、白字标题、一张小图、几行字。"""
    rnd = random.Random(seed)
    rpanel(A, 'wood', (0, 0, 0.012), w, h, 0.024, 0.004, 0x3a3028, 1.0, bev=0.003, name='frame')
    A.box('paper', (0, 0, 0.0245), (w - 0.05, h - 0.05, 0.002), 0xffffff, 0.80, tag='p', name='paper', proxy=False)
    A.box('paper', (0, h / 2 - 0.14, 0.0256), (w - 0.05, 0.16, 0.001), 0xffffff, 0.85, tag='h', name='header', proxy=False)
    iw = w - 0.12
    top = h / 2 - 0.06
    A.box('paper', (0, top - 0.07, 0.0263), (iw * 0.7, 0.05, 0.001), 0xf0ead8, 1.0, name='title', proxy=False)
    pic = rnd.random() > 0.4
    if pic:
        A.box('paper', (-iw * 0.25, 0.04, 0.0262), (iw * 0.42, h * 0.30, 0.001), (0x6a7a8a, 0x8a7a5a, 0x5a6a5a)[seed % 3], 1.0, name='picture', proxy=False)
    if A.lo:
        return
    n = max(3, int(round(h / 0.09)))
    for k in range(n):
        ly = top - 0.09 - k * (h - 0.20) / n
        if ly < -h / 2 + 0.06:
            break
        beside = pic and -0.11 < ly < 0.19
        lw = iw * 0.42 if beside else iw * (0.6 + rnd.random() * 0.3)
        A.box('paper', ((0.04 if rnd.random() > 0.5 else 0) + (iw * 0.24 if beside else 0), ly, 0.0262), (lw, 0.012, 0.001), 0x4a4a46, 1.0, name='line', proxy=False)
    A.box('glass', (0, 0, 0.0262), (w - 0.05, h - 0.05, 0.001), 0xb8c8d0, 1.1, name='glass', proxy=False)


for _k in range(4):
    def _mkf(k):
        @asset('frame_poster_%s' % 'abcd'[k], ao=0.3, ground=False, wall=0.0, tints={'p': 0xe8e4d8, 'h': 0xb8483a}, inst=True)
        def f(A):
            poster(A, 0.62, 0.82, 1 + k * 3)
    _mkf(_k)


@asset('bin_classroom', ao=0.35, tints={'b': 0x3a6a4a})
def bin_classroom(A):
    """教室后面的垃圾桶：上宽下窄的塑料桶（标签 b），口沿外翻一圈，里面套着垃圾袋（黑），袋口搭在沿上。"""
    A.lathe('plastic', (0, 0, 0), [(0, 0), (0.15, 0), (0.19, 0.55), (0.20, 0.56), (0.196, 0.565), (0.185, 0.55), (0.145, 0.012), (0, 0.012)], 0xffffff, 1.0, seg=24, tag='b', name='bin')
    A.cyl('dark', (0, 0.50, 0), 0.18, 0.18, 0.002, 0x1a1e1c, 1.0, seg=20, name='inside', proxy=False)
    if not A.lo:
        A.lathe('plastic', (0, 0.53, 0), [(0.186, 0.0), (0.205, 0.035), (0.21, 0.04), (0.204, 0.0), (0.2, -0.04)], 0x15181a, 1.0, seg=24, cap0=False, cap1=False, name='bag', proxy=False)


@asset('paper_floor', ao=0.15)
def paper_floor(A):
    """地上一张 A4 纸，边角微微卷起来。"""
    nx, nz = (8, 5, 2, 1)[A.L], (10, 6, 3, 1)[A.L]
    verts, faces = [], []
    for j in range(nz + 1):
        for i in range(nx + 1):
            u, v = i / nx - 0.5, j / nz - 0.5
            curl = 0.012 * max(0.0, (abs(u) * 2 - 0.7) / 0.3) ** 2 + 0.008 * max(0.0, (v * 2 - 0.75) / 0.25) ** 2
            verts.append((u * 0.21, 0.002 + curl, v * 0.297))
    m = nx + 1
    for j in range(nz):
        for i in range(nx):
            a = j * m + i
            faces.append((a, a + m, a + m + 1, a + 1))
    A.mesh('paper', verts, faces, 0xe8e4d8, 0.95, smooth=True, sharp=None, name='sheet')
    A.mesh('paper', verts, [f[::-1] for f in faces], 0xd8d4c8, 0.8, smooth=True, sharp=None, name='back')
