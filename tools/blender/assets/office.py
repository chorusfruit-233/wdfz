"""行政楼和讲台一类：办公转椅、办公工位、大办公桌、讲台、数据终端、保安值班台。
尺寸、朝向沿用 furniture.js 原来的局部坐标。"""
import math

from wdfz import asset, rrect
from assets._parts import rpanel, handle_bar, screw, caster, led, book, STEEL, CHROME, BLACK

C_DESK = 0x86653c
C_DARKP = 0x2e3438


def office_chair(A, seat=0.46):
    """办公转椅：五星脚（带双轮脚轮）、气杆、底盘、坐垫、靠背（往后仰、腰部鼓一点）、扶手。人朝 -z 坐。"""
    if A.lo:
        for k in range(5):
            a = k / 5 * 2 * math.pi
            A.rod('metal', (0, 0.07, 0), (math.cos(a) * 0.27, 0.05, math.sin(a) * 0.27), 0.016, 0.012, 0x1d2226, 1.0, seg=4, caps=False, name='arm')
        A.cyl('metal', (0, 0.06, 0), 0.03, 0.025, 0.36, 0x1d2226, 1.0, seg=6, name='gas')
        A.box('fabric', (0, seat, 0), (0.46, 0.08, 0.44), C_DARKP, 1.0, name='seat')
        A.box('fabric', (0, seat + 0.34, 0.21), (0.44, 0.50, 0.07), C_DARKP, 1.02, name='back')
        return
    # 五星脚：中心的毂、五条往下斜的脚、脚轮
    A.cyl('plastic', (0, 0.07, 0), 0.05, 0.045, 0.05, 0x1a1d20, 1.0, seg=16, round_=0.006, name='hub')
    for k in range(5):
        a = k / 5 * 2 * math.pi + 0.3
        ex, ez = math.cos(a) * 0.27, math.sin(a) * 0.27
        A.rod('plastic', (math.cos(a) * 0.03, 0.09, math.sin(a) * 0.03), (ex, 0.068, ez), 0.021, 0.013, 0x1d2226, 1.0, seg=8 if A.hi else 6, round_=0.008 if A.hi else 0.0, name='arm')
        caster(A, ex, ez, yaw=-a + math.pi / 2, h=0.062)
    # 气杆：外面一节塑料护套，上面一截镀铬的杆
    A.cyl('plastic', (0, 0.10, 0), 0.029, 0.026, 0.17, 0x16191c, 1.0, seg=14, round_=0.003, name='shroud')
    if A.hi:
        for k in range(4):
            A.cyl('plastic', (0, 0.12 + k * 0.035, 0), 0.0305, 0.0305, 0.006, 0x101315, 1.0, seg=14, name='rib', proxy=False)
    A.cyl('metal', (0, 0.27, 0), 0.0145, 0.0145, seat - 0.34, CHROME, 1.15, seg=12, name='piston')
    # 底盘和调节杆
    A.box('metal', (0, seat - 0.065, 0.01), (0.20, 0.045, 0.24), 0x24292d, 1.0, bev=0.008, name='mech')
    A.rod('metal', (0.10, seat - 0.07, -0.04), (0.20, seat - 0.075, -0.07), 0.006, 0.006, 0x24292d, 1.0, seg=8, name='lever')
    A.blob('plastic', (0.205, seat - 0.075, -0.072), (0.014, 0.012, 0.02), 0x16191c, 1.0, seg=8 if A.hi else 6, name='lever_knob')
    # 坐垫：塑料底壳 + 软垫
    A.box('plastic', (0, seat - 0.035, 0), (0.46, 0.02, 0.43), 0x16191c, 1.0, bev=0.012, name='shell')
    A.cushion('fabric', (0, seat + 0.005, -0.005), (0.48, 0.075, 0.46), C_DARKP, 1.0, puff=0.18, r=0.03, name='seat')
    # 靠背：钢片从底盘后面弯上去，托着靠背
    A.tube('metal', [(0, seat - 0.06, 0.12), (0, seat - 0.05, 0.25), (0, seat + 0.16, 0.27)], 0.016, 0x24292d, 1.0, seg=8, bend=0.06, ellip=0.35, name='spine')
    with A.at(0, seat + 0.36, 0.235, rx=0.13):
        A.box('plastic', (0, 0, 0.022), (0.42, 0.48, 0.02), 0x16191c, 1.0, bev=0.02, name='back_shell')
        A.cushion('fabric', (0, 0, -0.004), (0.44, 0.52, 0.065), C_DARKP, 1.02, puff=0.16, r=0.03, name='back')
        if A.hi:
            A.cushion('fabric', (0, -0.12, -0.036), (0.36, 0.11, 0.02), C_DARKP, 0.95, puff=0.3, r=0.01, name='lumbar', proxy=False, cuts=2)
    # 扶手：从底盘两侧伸出来的 L 形
    if A.L <= 2:
        for s in (-1, 1):
            A.tube('plastic', [(s * 0.10, seat - 0.06, 0.06), (s * 0.255, seat - 0.05, 0.06), (s * 0.255, seat + 0.16, 0.04)], 0.014, 0x1a1d20, 1.0, seg=8, bend=0.04, ellip=0.6, name='arm_post')
            A.box('plastic', (s * 0.255, seat + 0.18, 0.03), (0.06, 0.028, 0.25), 0x1d2226, 1.0, bev=0.012, name='arm_pad')


@asset('chair_office', ao=0.3, inst=True)
def chair_office(A):
    office_chair(A)


def monitor(A, c, w=0.46, h=0.30, col=0x1d262b, stand=True, base_y=0.76, scr='sky', scrcol=0x9fc4dc, scrshade=0.9, neck_z=None):
    """显示器：窄边框、屏幕（不吃光，颜色跟着时间走）、后壳鼓起来、支架和底座。屏幕朝 -z。"""
    x, y, z = c
    if A.lo:
        A.box('plastic', (x, y, z), (w, h, 0.03), col, 1.0, name='bezel')
        A.box(scr, (x, y + 0.01, z - 0.017), (w - 0.04, h - 0.05, 0.004), scrcol, scrshade, name='screen', proxy=False)
        if stand:
            A.cyl('plastic', (x, base_y, z + 0.01), 0.06, 0.03, y - base_y - h / 2 + 0.02, 0x39434a, 1.0, seg=6, name='stand')
        return
    rpanel(A, 'plastic', (x, y, z), w, h, 0.022, 0.006, col, 1.0, bev=0.003, name='bezel')
    A.box(scr, (x, y + 0.008, z - 0.0115), (w - 0.022, h - 0.04, 0.002), scrcol, scrshade, name='screen', proxy=False)
    A.box('plastic', (x, y - h / 2 + 0.014, z - 0.0115), (w - 0.022, 0.016, 0.002), 0x111518, 1.0, name='chin', proxy=False)
    led(A, (x + w / 2 - 0.03, y - h / 2 + 0.012, z - 0.0125), 0x3a8ad0, 0.004)
    # 后壳
    A.box('plastic', (x, y - 0.01, z + 0.024), (w * 0.62, h * 0.6, 0.03), col, 0.92, bev=0.01, name='back')
    if stand:
        nz = z + 0.05 if neck_z is None else neck_z
        A.box('plastic', (x, (base_y + y) / 2 - 0.02, nz), (0.05, y - base_y - 0.02, 0.02), 0x2a3238, 1.0, bev=0.006, name='neck')
        rpanel(A, 'plastic', (x, base_y + 0.006, nz - 0.03), 0.22, 0.16, 0.012, 0.03, 0x2a3238, 1.0, rot=(math.pi / 2, 0, 0), name='foot')


def keyboard(A, c, w=0.36, d=0.12, col=0x2a3238):
    x, y, z = c
    A.box('plastic', (x, y + 0.008, z), (w, 0.016, d), col, 1.0, bev=0.004, name='kb')
    if A.hi:
        rows, cols = 5, 15
        kw = (w - 0.03) / cols
        kd = (d - 0.03) / rows
        for r in range(rows):
            for k in range(cols):
                if r == 4 and 4 <= k <= 10:
                    continue
                A.box('plastic', (x - w / 2 + 0.015 + (k + 0.5) * kw, y + 0.0175, z - d / 2 + 0.015 + (r + 0.5) * kd), (kw * 0.82, 0.004, kd * 0.82), 0x1a1f23, 1.0, proxy=False, name='key')
        A.box('plastic', (x, y + 0.0175, z - d / 2 + 0.015 + 4.5 * kd), (kw * 7 * 0.95, 0.004, kd * 0.82), 0x1a1f23, 1.0, proxy=False, name='space')
    elif not A.lo:
        A.box('dark', (x, y + 0.0165, z), (w - 0.03, 0.002, d - 0.03), 0x15191c, 1.0, proxy=False, name='keys')


def mouse(A, c, col=0x2a3238):
    if A.lo:
        return
    A.blob('plastic', c, (0.03, 0.018, 0.055), col, 1.0, seg=10 if A.L == 0 else 8, name='mouse')


@asset('cubicle_admin', ao=0.35, inst=True)
def cubicle_admin(A):
    """行政楼办公工位：人坐在北边（-z），面朝隔板（+z）。隔板、桌面、挡板、三抽屉柜、显示器、键盘鼠标、文件盘、旁边一个高文件柜。"""
    # 隔板：铝框包着布面，顶上一道压条
    if A.lo:
        A.box('plastic', (0, 0.73, 0.30), (0.98, 1.45, 0.06), 0x9aa4a8, 1.02, name='partition')
    else:
        A.box('fabric', (0, 0.73, 0.30), (0.94, 1.41, 0.05), 0x8a949a, 1.0, name='partition')
        for s in (-1, 1):
            A.box('metal', (s * 0.48, 0.73, 0.30), (0.02, 1.45, 0.06), 0xb8c0c2, 1.05, bev=0.004, name='frame')
        A.box('metal', (0, 0.015, 0.30), (0.94, 0.03, 0.06), 0xa0a8ac, 1.0, bev=0.003, name='frame')
    A.box('metal', (0, 1.46, 0.30), (1.00, 0.04, 0.09), 0xb8c0c2, 1.08, bev=0.012, name='cap')
    # 桌面、挡板
    A.box('wood', (0, 0.74, -0.06), (0.86, 0.04, 0.64), C_DESK, 1.06, bev=0.008, name='top')
    A.box('wood', (0, 0.50, 0.25), (0.80, 0.40, 0.02), 0x6a4c30, 0.92, bev=0.004, name='modesty')
    # 三抽屉柜（开口朝人）
    A.box('metal', (-0.26, 0.37, 0.06), (0.30, 0.70, 0.36), 0x8b867e, 0.95, bev=0.006, name='pedestal')
    for dk in range(3):
        y = 0.16 + dk * 0.22
        if not A.lo:
            A.box('metal', (-0.26, y, -0.1215), (0.28, 0.205, 0.004), 0x948f86, 0.98, bev=0.002, name='drawer', proxy=False)
        handle_bar(A, (-0.26, y + 0.06, -0.12), 0.12, 0xb8c0c2, axis='x', off=0.02)
    # 显示器（屏幕朝人）、键盘、鼠标、文件盘
    monitor(A, (0, 1.03, 0.12), base_y=0.76)
    keyboard(A, (0, 0.76, -0.14))
    mouse(A, (0.25, 0.76 + 0.012, -0.13))
    A.box('plastic', (0.30, 0.775, -0.04), (0.24, 0.03, 0.30), 0x2a3036, 1.0, bev=0.004, name='tray')
    if not A.lo:
        for k in range(3):
            A.box('paper', (0.30 + (k - 1) * 0.004, 0.794 + k * 0.004, -0.04 + k * 0.006), (0.21, 0.003, 0.297), [0xe8e6dc, 0xdedbd0, 0xeceae2][k], 1.0, name='paper', proxy=False)
    # 文件柜（门朝桌子这边，-x）
    A.box('metal', (0.46, 0.90, 0), (0.34, 1.80, 0.86), 0x6e7a80, 1.02, bev=0.008, name='cabinet')
    if not A.lo:
        A.box('dark', (0.2895, 0.90, 0), (0.002, 1.72, 0.004), 0x2a3236, 1.0, name='gap', proxy=False)
        for s in (-1, 1):
            A.box('metal', (0.2895, 0.90, s * 0.215), (0.002, 1.70, 0.40), 0x76828a, 1.0, name='door', proxy=False)
    with A.at(0.29, 0, -0.25, ry=-math.pi / 2):
        handle_bar(A, (0, 1.20, 0), 0.10, 0xb8c0c2, axis='y', off=0.02)
        handle_bar(A, (0, 0.60, 0), 0.10, 0xb8c0c2, axis='y', off=0.02)


@asset('desk_office', ao=0.35)
def desk_office(A):
    """行政楼的大办公桌：人坐在 +z、面朝 -z。左边三抽屉、右边一个窄柜、挡板；桌上一摞文件、茶杯、显示器。"""
    adw, add = 1.15, 0.86
    A.box('wood', (0, 0.72, 0), (adw, 0.05, add), 0x7a5a38, 1.08, bev=0.012, name='top')
    if A.hi:
        A.box('wood', (0, 0.7465, 0), (adw - 0.04, 0.003, add - 0.04), 0x82603c, 1.06, name='inlay', proxy=False)
    A.box('wood', (-adw * 0.34, 0.35, 0), (0.36, 0.64, add * 0.92), 0x6a4c30, 0.93, bev=0.006, name='ped_l')
    A.box('wood', (adw * 0.40, 0.35, 0), (0.22, 0.64, add * 0.92), 0x6a4c30, 0.93, bev=0.006, name='ped_r')
    A.box('wood', (0, 0.42, -add * 0.44), (adw * 0.90, 0.54, 0.02), 0x53401f, 0.86, bev=0.004, name='modesty')
    fz = add * 0.46
    for dk in range(3):
        y = 0.13 + dk * 0.20
        if not A.lo:
            A.box('wood', (-adw * 0.34, y, fz + 0.002), (0.34, 0.185, 0.006), 0x704f32, 0.96, bev=0.003, name='drawer', proxy=False)
        handle_bar(A, (-adw * 0.34, y + 0.05, fz + 0.005), 0.16, 0xb8a060, axis='x', off=0.018)
    if not A.lo:
        A.box('wood', (adw * 0.40, 0.35, fz + 0.002), (0.20, 0.60, 0.006), 0x704f32, 0.96, bev=0.003, name='door', proxy=False)
        handle_bar(A, (adw * 0.40 - 0.07, 0.50, fz + 0.005), 0.10, 0xb8a060, axis='y', off=0.018)
    # 桌上
    for k in range(4):
        A.box('paper', (adw * 0.16 + (k % 2) * 0.006, 0.7475 + k * 0.005, -add * 0.10 + k * 0.004), (0.30, 0.004, 0.22), [0xd8d4c6, 0xe6e2d6, 0xcfcab8, 0xe0dccf][k], 1.05, name='paper', proxy=k == 0)
    # 茶杯（带盖）
    cx, cz = adw * 0.02, -add * 0.24
    A.lathe('plastic', (cx, 0.745, cz), [(0, 0), (0.034, 0), (0.038, 0.004), (0.044, 0.10), (0.046, 0.105), (0, 0.105)], 0xe8e4dc, 1.0, seg=16, name='cup')
    if not A.lo:
        A.lathe('plastic', (cx, 0.849, cz), [(0, 0.012), (0.03, 0.012), (0.047, 0.004), (0.048, 0), (0, 0)], 0xe0dcd2, 1.0, seg=16, name='lid', proxy=False)
        A.blob('plastic', (cx, 0.866, cz), (0.008, 0.006, 0.008), 0xe0dcd2, 1.0, seg=8, name='lid_knob', proxy=False)
        A.tube('plastic', [(cx + 0.044, 0.82, cz), (cx + 0.068, 0.81, cz), (cx + 0.068, 0.77, cz), (cx + 0.045, 0.765, cz)], 0.006, 0xe8e4dc, 1.0, seg=8, bend=0.012, name='cup_handle', proxy=False)
    with A.at(-adw * 0.06, 0, -add * 0.18, ry=math.pi):
        monitor(A, (0, 1.06, 0), w=0.44, h=0.28, base_y=0.745)


@asset('podium', ao=0.3)
def podium(A):
    """讲台：木头柜体（正面朝学生 +z，带框和凹进去的面板），台面四周出沿；老师那面（-z）开口，里面一层隔板。台上教案、粉笔盒、板擦。"""
    if A.lo:
        A.box('wood', (0, 0.46, 0), (0.72, 0.92, 0.66), 0x765a35, 1.0, name='body')
        A.box('wood', (0, 0.955, 0), (0.82, 0.05, 0.76), 0x8a6a40, 1.1, name='top')
        A.box('wood', (0, 0.50, 0.335), (0.56, 0.62, 0.01), 0x5e4628, 1.0, name='panel')
        A.box('paper', (-0.1, 0.985, -0.05), (0.30, 0.01, 0.22), 0xe0dcd0, 1.0, name='plan')
        A.box('plastic', (0.22, 0.995, -0.12), (0.14, 0.03, 0.05), 0xd8d8d0, 1.0, name='chalkbox')
        return
    col, dk = 0x765a35, 0x5e4628
    # 两侧板、背（朝学生的正面）、底板、中隔板
    for s in (-1, 1):
        A.box('wood', (s * 0.345, 0.46, 0), (0.03, 0.92, 0.66), col, 0.97, bev=0.004, name='side')
    A.box('wood', (0, 0.46, 0.315), (0.66, 0.92, 0.03), col, 1.0, bev=0.003, name='front')
    A.box('wood', (0, 0.03, -0.01), (0.66, 0.06, 0.62), dk, 0.9, bev=0.003, name='bottom')
    A.box('wood', (0, 0.48, 0.0), (0.66, 0.02, 0.60), dk, 0.95, bev=0.002, name='shelf')
    if A.L >= 2:
        A.box('dark', (0, 0.48, -0.20), (0.62, 0.86, 0.36), 0x0e0c0a, 1.0, proxy=False, name='inside')
    # 正面：框和凹面板
    A.box('wood', (0, 0.50, 0.334), (0.56, 0.62, 0.006), dk, 1.0, bev=0.002, name='panel')
    if A.hi:
        for (x, y, w, h) in ((0, 0.83, 0.62, 0.04), (0, 0.17, 0.62, 0.04), (-0.30, 0.50, 0.04, 0.70), (0.30, 0.50, 0.04, 0.70)):
            A.box('wood', (x, y, 0.338), (w, h, 0.012), col, 1.04, bev=0.003, name='rail', proxy=False)
        A.box('wood', (0, 0.06, 0.336), (0.70, 0.12, 0.012), dk, 0.92, bev=0.003, name='plinth', proxy=False)
    # 台面
    A.box('wood', (0, 0.955, 0), (0.82, 0.05, 0.76), 0x8a6a40, 1.1, bev=0.01, name='top')
    # 教案（摊开）、粉笔盒、几根粉笔、板擦
    with A.at(-0.1, 0.981, -0.05, ry=0.06):
        A.box('paper', (-0.075, 0.003, 0), (0.15, 0.006, 0.21), 0xe0dcd0, 1.0, bev=0.001, name='plan')
        A.box('paper', (0.075, 0.004, 0), (0.15, 0.008, 0.21), 0xe4e0d4, 1.0, bev=0.001, name='plan')
        A.box('paper', (0, 0.0012, 0), (0.31, 0.0025, 0.215), 0x2a4a6a, 1.0, name='plan_cover', proxy=False)
    with A.at(0.22, 0.98, -0.12, ry=-0.2):
        A.box('paper', (0, 0.015, 0), (0.14, 0.03, 0.07), 0xd8d8d0, 1.0, bev=0.002, name='chalkbox')
        if A.hi:
            for k in range(5):
                A.rod('plastic', (-0.05, 0.034, -0.02 + k * 0.01), (0.03, 0.034, -0.02 + k * 0.01), 0.0045, 0.0045, [0xf2f2ec, 0xf2f2ec, 0xd86a6a, 0xf2f2ec, 0x6aa0d8][k], 1.0, seg=8, name='chalk', proxy=False)
    with A.at(0.05, 0.98, 0.18, ry=0.4):
        A.box('wood', (0, 0.014, 0), (0.15, 0.028, 0.055), 0x3a3028, 1.0, bev=0.004, name='eraser_top')
        A.box('fabric', (0, 0.003, 0), (0.15, 0.006, 0.055), 0x3a3a3a, 1.0, name='eraser_felt', proxy=False)


@asset('terminal_data', ao=0.3)
def terminal_data(A):
    """数据终端：铁皮机柜、斜面键盘托、显示器（屏幕发光，有一行光标）、U 盘口、贴着的便签。人站在 +z。"""
    A.box('metal', (0, 0.50, 0), (0.70, 1.00, 0.60), 0x8f9aa2, 1.05, bev=0.01, name='body')
    A.box('metal', (0, 1.02, 0), (0.74, 0.04, 0.64), 0x6a747c, 1.0, bev=0.006, name='top')
    if not A.lo:
        A.box('dark', (0, 0.50, 0.3015), (0.004, 0.86, 0.002), 0x3a444a, 1.0, name='gap', proxy=False)
        handle_bar(A, (-0.05, 0.70, 0.30), 0.10, STEEL, axis='y', off=0.018)
        handle_bar(A, (0.05, 0.70, 0.30), 0.10, STEEL, axis='y', off=0.018)
        for k in range(6):
            A.box('dark', (0, 0.12 + k * 0.025, 0.301), (0.40, 0.008, 0.002), 0x2a3236, 1.0, name='vent', proxy=False)
    with A.at(0, 0, -0.12, ry=math.pi):
        monitor(A, (0, 1.28, 0), w=0.52, h=0.38, stand=False, scr='emit', scrcol=0x3a6a8a, scrshade=0.8)
    A.box('emit', (-0.12, 1.36, -0.1072), (0.14, 0.012, 0.002), 0xc8e8f0, 1.0, name='cursor', proxy=False)
    A.box('plastic', (0, 1.13, -0.17), (0.08, 0.20, 0.04), 0x2a3238, 1.0, bev=0.006, name='arm')
    with A.at(0, 1.045, 0.12, rx=-0.12):
        keyboard(A, (0, 0, 0), w=0.44, d=0.16)
    A.box('plastic', (0.27, 0.80, 0.302), (0.06, 0.10, 0.01), 0x1a1e22, 1.0, bev=0.002, name='usb')
    if not A.lo:
        A.box('dark', (0.27, 0.80, 0.3075), (0.016, 0.006, 0.002), 0x050607, 1.0, name='usb_slot', proxy=False)
    A.box('paper', (-0.18, 0.90, 0.3015), (0.12, 0.08, 0.002), 0xe8d870, 1.0, name='note', proxy=False)


@asset('counter_guard', ao=0.35)
def counter_guard(A):
    """保安岗值班台：木柜体、台面、值班登记本和笔、监控显示器、前面挂一排钥匙。"""
    A.box('wood', (0, 0.48, 0), (0.86, 0.94, 0.80), 0x6a5a48, 1.0, bev=0.008, name='body')
    if A.hi:
        for s in (-1, 1):
            A.box('wood', (s * 0.21, 0.48, 0.401), (0.38, 0.80, 0.006), 0x625240, 1.0, bev=0.003, name='panel', proxy=False)
    A.box('wood', (0, 0.97, 0), (0.94, 0.04, 0.88), 0x8a7a62, 1.1, bev=0.01, name='top')
    with A.at(-0.1, 0.99, 0, ry=0.15):
        A.box('paper', (0, 0.004, 0), (0.32, 0.008, 0.24), 0xe0dcd0, 1.0, bev=0.001, name='log')
        A.box('paper', (0, 0.0015, 0), (0.325, 0.003, 0.245), 0x3a2a24, 1.0, name='log_cover', proxy=False)
        if not A.lo:
            for k in range(8):
                A.box('dark', (-0.06, 0.0085, -0.09 + k * 0.024), (0.16, 0.0005, 0.002), 0x5a5a5a, 1.0, name='line', proxy=False)
            A.rod('plastic', (0.04, 0.012, 0.02), (0.15, 0.012, -0.03), 0.004, 0.004, 0x2a4a8a, 1.0, seg=8, name='pen', proxy=False)
    with A.at(0.18, 0, -0.22, ry=math.pi):
        monitor(A, (0, 1.12, 0), w=0.34, h=0.24, base_y=0.99, scrcol=0x6a8a9a, scrshade=0.6)
    for hk in range(4):
        x = -0.30 + hk * 0.12
        A.cyl('metal', (x, 0.80, 0.40), 0.004, 0.004, 0.012, 0xc8a24a, 1.1, seg=8, dirn=(0, 0, 1), name='hook', proxy=False)
        A.tube('metal', [(x, 0.80, 0.412), (x, 0.775, 0.425), (x + 0.004, 0.752, 0.43)], 0.0028, 0xc8a24a, 1.15, seg=6, bend=0.008, name='ring', proxy=False)
        if not A.lo:
            A.prism('metal', (x + 0.004, 0.73, 0.43), [(-0.006, 0.0), (0.006, 0.0), (0.008, -0.03), (-0.006, -0.032)], 0.002, 0xb89a48, 1.15, name='key', proxy=False)
