"""房间里的建筑构件：门框和门牌、门扇（左右两款）、外墙出口的玻璃门、墙上的窗（1.5 / 1.8 米）、楼梯的一级踏步和栏杆立柱、
走廊储物柜、宣传栏、消防栓箱、黑板、黑板上方的高窗、广播喇叭、挂钟、黑板报、车库柱子的警示带、消防喷头。

局部坐标沿用 room.js：门洞在 x=-0.5..0.5、墙厚 1 米（z=-0.5..0.5）；门扇以合页轴为原点；
贴墙的东西背面在 z=0（个别注明的除外）。"""
import math
import random

from wdfz import asset, rrect
from assets._parts import rpanel, handle_bar, knob, screw, led, slats, STEEL, CHROME, BLACK

WALLH = 3.0
DTOP = 2.10
FRAME = 0x3d474e
TRIM = 0x4a545c


def door_frame(A, left, right):
    """门框：两侧门套（带挡门条）、顶上的门头、两面的门套线（线脚有个小圆边）、门槛石。"""
    for s, on in ((-1, left), (1, right)):
        if not on:
            continue
        A.box('wood', (s * 0.47, DTOP / 2, 0), (0.06, DTOP, 1.0), FRAME, 1.06, bev=0.006, name='jamb')
        if not A.lo:
            A.box('wood', (s * 0.432, DTOP / 2, 0.36), (0.016, DTOP - 0.02, 0.035), FRAME, 1.0, bev=0.003, name='stop', proxy=False)
        for z in (-0.507, 0.507):
            A.box('wood', (s * 0.53, (DTOP + 0.08) / 2, z), (0.07, DTOP + 0.08, 0.014), TRIM, 1.1, bev=0.004, name='casing')
    A.box('wood', (0, DTOP + 0.03, 0), (1.0, 0.06, 1.0), FRAME, 1.06, bev=0.004, name='head')
    for z in (-0.507, 0.507):
        A.box('wood', (0, DTOP + 0.11, z), (1.13, 0.07, 0.014), TRIM, 1.1, bev=0.004, name='casing_top')
    A.box('stone', (0, 0.01, 0), (0.94, 0.02, 1.0), 0x5a6268, 1.05, bev=0.004, name='sill')


@asset('door_frame_lr', ao=0.3, inst=True)
def door_frame_lr(A):
    door_frame(A, True, True)


@asset('door_frame_l', ao=0.3)
def door_frame_l(A):
    door_frame(A, True, False)


@asset('door_frame_r', ao=0.3)
def door_frame_r(A):
    door_frame(A, False, True)


@asset('door_frame_0', ao=0.3)
def door_frame_0(A):
    door_frame(A, False, False)


@asset('door_plate', ao=0.2, ground=False, wall=0.0)
def door_plate(A):
    """门牌（背面 z=0）：白色亚克力牌、深蓝的字条。中心在原点。"""
    rpanel(A, 'plastic', (0, 0, 0.01), 0.36, 0.14, 0.02, 0.012, 0xe8e4dc, 1.05, name='plate')
    A.box('dark', (0, 0, 0.0205), (0.26, 0.06, 0.001), 0x2a3a4a, 1.0, name='text', proxy=False)
    if A.hi:
        for x in (-0.15, 0.15):
            A.cyl('metal', (x, 0, 0.0205), 0.006, 0.006, 0.002, 0xb8c0c2, 1.1, seg=10, dirn=(0, 0, 1), name='screw', proxy=False)


def door_leaf(A, m):
    """门扇（原点在合页轴、门扇往 m 方向（+1 往 +x）伸 0.86 米，厚 0.045）：门板（四周一圈封边）、上面的小窗（玻璃 + 压条）、
    下面的不锈钢踢脚板、三个合页、两面的执手锁（圆座 + 把手），门上贴一张课程表。"""
    lw, lh, t = 0.86, 2.04, 0.045
    cx = m * lw / 2
    A.box('wood', (cx, lh / 2 + 0.01, 0), (lw, lh, t), 0x222a30, 1.0, bev=0.006, name='leaf', proxy=False)
    A.proxy_box((cx, lh / 2 + 0.01, 0), (lw, lh, t))
    wx = cx
    A.box('glass', (wx, 1.55, 0), (0.28, 0.42, t + 0.002), 0x5a7080, 1.0, name='glass', proxy=False)
    for z in (-1, 1):
        if not A.lo:
            for (x, y, w, h) in ((wx, 1.77, 0.32, 0.02), (wx, 1.33, 0.32, 0.02), (wx - 0.15, 1.55, 0.02, 0.46), (wx + 0.15, 1.55, 0.02, 0.46)):
                A.box('wood', (x, y, z * (t / 2 + 0.004)), (w, h, 0.008), 0x1a2026, 1.0, bev=0.002, name='bead', proxy=False)
    for z in (-1, 1):
        A.box('metal', (cx, 0.15, z * (t / 2 + 0.002)), (lw * 0.9, 0.22, 0.004), 0x6a7276, 1.1, bev=0.001, name='kick', proxy=False)
    if not A.lo:
        for y in (0.25, 1.05, 1.85):
            A.cyl('metal', (0, y, 0), 0.008, 0.008, 0.10, 0x8d9aa2, 1.2, seg=10, name='hinge', proxy=False)
    hx = m * (lw - 0.10)
    for z in (-1, 1):
        A.cyl('metal', (hx, 1.0, z * t / 2), 0.025, 0.025, 0.012, 0x8d9aa2, 1.25, seg=16, round_=0.003, dirn=(0, 0, z), name='rose', proxy=False)
        A.tube('metal', [(hx, 1.02, z * (t / 2 + 0.012)), (hx, 1.02, z * (t / 2 + 0.05)), (hx - m * 0.12, 1.02, z * (t / 2 + 0.05))], 0.0095, 0x8d9aa2, 1.25, seg=10, bend=0.015, name='lever', proxy=False)
        if not A.lo:
            A.cyl('metal', (hx, 0.92, z * t / 2), 0.012, 0.012, 0.006, 0x8d9aa2, 1.2, seg=12, dirn=(0, 0, z), name='keyhole', proxy=False)
    if not A.lo:
        A.box('paper', (cx + m * 0.05, 1.18, t / 2 + 0.0008), (0.21, 0.15, 0.001), 0xe8e4dc, 1.0, name='timetable', proxy=False)


@asset('door_leaf', ao=0.25, inst=True)
def door_leaf_r(A):
    door_leaf(A, 1)


@asset('door_leaf_m', ao=0.25, inst=True)
def door_leaf_m(A):
    door_leaf(A, -1)


@asset('exit_door', ao=0.35)
def exit_door(A):
    """外墙上的出口（局部 +z 朝外）：铝门框、两扇玻璃门（每扇四周铝框）、中间的门挺、推杠（带端盖）、外面透进来的天光、
    门里侧上方的安全出口灯、门外的一块水泥台。门头的墙由房间画。"""
    fc = 0x39424a
    for s in (-1, 1):
        A.box('metal', (s * 0.46, 1.15, 0.30), (0.08, 2.30, 0.16), fc, 1.05, bev=0.008, name='post')
    A.box('metal', (0, 2.26, 0.30), (1.0, 0.08, 0.16), fc, 1.05, bev=0.008, name='header')
    A.box('metal', (0, 1.12, 0.30), (0.04, 2.18, 0.05), fc, 1.0, bev=0.004, name='mullion')
    for s in (-1, 1):
        x = s * 0.215
        A.box('glass', (x, 1.12, 0.30), (0.36, 2.06, 0.012), 0x6a8a9a, 1.0, name='glass', proxy=False)
        if not A.lo:
            for (dx, y, w, h) in ((0, 2.18, 0.40, 0.06), (0, 0.10, 0.40, 0.14), (-0.19, 1.12, 0.03, 2.12), (0.19, 1.12, 0.03, 2.12)):
                A.box('metal', (x + dx, y, 0.30), (w, h, 0.04), fc, 1.1, bev=0.004, name='stile', proxy=False)
        A.proxy_box((x, 1.12, 0.30), (0.40, 2.12, 0.04))
        # 推杠
        A.rod('metal', (s * 0.40, 1.02, 0.24), (s * 0.04, 1.02, 0.24), 0.016, 0.016, 0xb8c0c2, 1.2, seg=12, round_=0.006, name='bar')
        for xx in (s * 0.38, s * 0.06):
            A.box('metal', (xx, 1.02, 0.265), (0.04, 0.05, 0.05), 0x5a6266, 1.0, bev=0.008, name='bar_mount', proxy=False)
    A.box('sky', (0, 1.12, 0.36), (0.86, 2.14, 0.004), 0xffffff, 0.55, name='sky', proxy=False)
    with A.at(0, 2.48, -0.505, ry=math.pi):
        A.box('plastic', (0, 0, -0.02), (0.42, 0.16, 0.04), 0xe8e8e2, 1.0, bev=0.006, name='sign')
        A.box('emit', (0, 0, 0.001), (0.38, 0.12, 0.002), 0x37c47a, 1.0, name='sign_face', proxy=False)
        A.box('emit', (-0.12, 0, 0.0025), (0.08, 0.10, 0.001), 0xe8ffe8, 1.0, name='sign_door', proxy=False)
    A.box('concrete', (0, 0.01, 0.35), (1.0, 0.02, 0.4), 0x7a7a72, 1.0, name='step')


def wall_window(A, w, y0, y1, mull):
    """墙上的推拉窗（局部 +z 朝屋里，墙面在 z=0）：外框、两扇窗扇（扇框、玻璃、勾企、月牙锁）、透进来的天光、石窗台。"""
    h = y1 - y0
    ym = (y0 + y1) / 2
    fc = 0x9aa4a8
    A.box('sky', (0, ym, 0.004), (w, h, 0.004), 0xffffff, 0.9, name='sky', proxy=False)
    A.box('metal', (0, y1 + 0.03, 0.03), (w + 0.10, 0.06, 0.06), fc, 1.05, bev=0.005, name='frame_top')
    A.box('stone', (0, y0 - 0.02, 0.07), (w + 0.16, 0.04, 0.14), 0xd8d4cc, 1.0, bev=0.006, name='sill')
    for s in (-1, 1):
        A.box('metal', (s * (w / 2 + 0.03), ym, 0.03), (0.06, h + 0.06, 0.06), fc, 1.05, bev=0.005, name='frame_side')
    A.box('metal', (0, y0 + 0.012, 0.03), (w, 0.024, 0.06), fc, 1.0, bev=0.003, name='frame_bottom')
    # 两扇推拉窗（一前一后）
    sw = w / mull
    for k in range(mull):
        x = -w / 2 + sw * (k + 0.5)
        z = 0.022 if k % 2 == 0 else 0.042
        A.box('glass', (x, ym, z), (sw - 0.03, h - 0.03, 0.006), 0x8aa0aa, 1.1, name='glass', proxy=False)
        if not A.lo:
            for (dx, y, ww, hh) in ((0, y1 - 0.02, sw, 0.035), (0, y0 + 0.035, sw, 0.04), (-sw / 2 + 0.015, ym, 0.03, h), (sw / 2 - 0.015, ym, 0.03, h)):
                A.box('metal', (x + dx, y, z), (ww, hh, 0.02), fc, 1.08, bev=0.003, name='sash', proxy=False)
        else:
            A.box('metal', (x - sw / 2 + 0.015, ym, z), (0.03, h, 0.02), fc, 1.08, name='sash', proxy=False)
    A.box('metal', (0, y0 + h * 0.62, 0.025), (w, 0.035, 0.04), fc, 1.05, bev=0.003, name='transom')
    if A.hi:
        A.box('metal', (-w / 2 + sw - 0.02, ym, 0.056), (0.012, 0.05, 0.012), 0xc8ccd0, 1.2, bev=0.003, name='latch', proxy=False)


@asset('window_in_150', ao=0.3, ground=False, wall=0.0, inst=True)
def window_in_150(A):
    wall_window(A, 1.5, 1.0, 2.25, 2)


@asset('window_in_180', ao=0.3, ground=False, wall=0.0, inst=True)
def window_in_180(A):
    wall_window(A, 1.8, 0.95, 2.40, 2)


@asset('stair_step', ao=0.3, ground=False, inst=True)
def stair_step(A):
    """一级楼梯（2 米宽）：水磨石踏面（前沿圆）、防滑铜条（两道凹槽）、白色踢面。原点在这一级踏面前沿下面、踢面底的中间；
    踏面往 -z 伸 0.26 米（局部 -z 是往上走的方向），高 0.158 米；踢面缩在踏面前沿下面 1.6 厘米。下面的实心由房间画。"""
    tread, rise, wid = 0.26, 0.158, 2.0
    A.box('terrazzo', (0, rise - 0.02, -tread / 2), (wid, 0.04, tread), 0xb8b4ad, 1.04, bev=0.006, name='tread')
    A.box('metal', (0, rise - 0.0005, -0.035), (wid * 0.96, 0.004, 0.05), 0x8a6a3a, 1.1, name='strip', proxy=False)
    if not A.lo:
        for dz in (-0.022, -0.048):
            A.box('dark', (0, rise + 0.0016, dz), (wid * 0.96, 0.001, 0.004), 0x3a2a1a, 1.0, name='groove', proxy=False)
    A.box('plaster', (0, (rise - 0.04) / 2, -0.016), (wid, rise - 0.04, 0.008), 0xd8d4cc, 1.0, name='riser')


@asset('stair_baluster', ao=0.3, ground=False, inst=True)
def stair_baluster(A):
    """栏杆立柱（0.92 米高）：底座法兰、方钢立柱、顶上托扶手的弯托。原点在柱底。"""
    A.cyl('metal', (0, 0, 0), 0.03, 0.028, 0.012, 0x5d6366, 1.0, seg=12, name='flange')
    if A.hi:
        for k in range(4):
            a = k * math.pi / 2 + math.pi / 4
            A.cyl('metal', (math.cos(a) * 0.02, 0.012, math.sin(a) * 0.02), 0.003, 0.003, 0.003, 0x8a9094, 1.1, seg=6, name='bolt', proxy=False)
    A.box('metal', (0, 0.46, 0), (0.022, 0.92, 0.022), 0x6d7376, 1.0, bev=0.003, name='post')
    A.tube('metal', [(0, 0.88, 0), (0, 0.90, 0), (0.0, 0.905, 0.0)], 0.009, 0x6d7376, 1.0, seg=8, name='saddle', proxy=False)


@asset('locker_bank_4', ao=0.35, inst=True)
def locker_bank_4(A):
    """走廊储物柜（一组四门，正面 +z）：柜体、底座、四扇门（门缝、上下两组百叶、号码牌、锁、拉手）。"""
    A.box('metal', (0, 0.88, 0), (0.86, 1.68, 0.42), 0x39424a, 0.98, bev=0.008, name='body')
    A.box('metal', (0, 0.025, 0.0), (0.84, 0.05, 0.40), 0x23292e, 0.8, name='plinth')
    for dk in range(4):
        x = -0.3225 + dk * 0.215
        A.box('metal', (x, 0.88, 0.2125), (0.205, 1.60, 0.006), 0x3f4851, 1.0, bev=0.002, name='door', proxy=False)
        if not A.lo:
            for (yy, n) in ((1.55, 4), (0.30, 3)):
                for k in range(n):
                    A.box('dark', (x, yy + k * 0.022, 0.2158), (0.12, 0.008, 0.002), 0x1a2026, 1.0, name='vent', proxy=False)
            A.box('metal', (x, 1.42, 0.2158), (0.05, 0.03, 0.001), 0xd8d4c4, 1.0, name='number', proxy=False)
            A.cyl('metal', (x + 0.06, 1.05, 0.2155), 0.008, 0.008, 0.004, 0xb8c0c2, 1.2, seg=10, dirn=(0, 0, 1), name='lock', proxy=False)
        A.box('metal', (x + 0.07, 0.98, 0.222), (0.02, 0.10, 0.012), 0x8a949a, 1.2, bev=0.004, name='pull', proxy=False)


@asset('board_bulletin', ao=0.35, ground=False, wall=0.0)
def board_bulletin(A):
    """走廊的宣传栏（背面 z=0，中心离地 1.85 米处为原点）：金属框、软木底板、几张贴着的通知（大小颜色不一、有一张卷边）、外面一层玻璃、两个合页和锁。"""
    rnd = random.Random(17)
    A.box('metal', (0, 0, 0.03), (2.6, 0.98, 0.06), 0x1a2126, 1.0, bev=0.008, name='frame')
    A.box('paper', (0, 0, 0.0605), (2.5, 0.90, 0.002), 0x8e9a94, 1.0, name='board', proxy=False)
    for i in range(7 if not A.lo else 4):
        x = -1.0 + i * (2.0 / (6 if not A.lo else 3)) + (rnd.random() - 0.5) * 0.1
        y = (rnd.random() - 0.5) * 0.3
        w, h = 0.22 + rnd.random() * 0.12, 0.30 + rnd.random() * 0.2
        c = (0xe8e4dc, 0xd8c8a8, 0xc8d8e0, 0xe8d0c8)[i % 4]
        A.box('paper', (x, y, 0.0622), (w, h, 0.001), c, 1.0, rot=(0, 0, (rnd.random() - 0.5) * 0.06), name='notice', proxy=False)
        if not A.lo:
            for k in range(5):
                A.box('dark', (x, y + h / 2 - 0.05 - k * 0.04, 0.0628), (w * 0.8, 0.008, 0.0005), 0x5a5a56, 1.0, rot=(0, 0, (rnd.random() - 0.5) * 0.06), name='text', proxy=False)
            A.cyl('plastic', (x, y + h / 2 - 0.015, 0.063), 0.006, 0.006, 0.004, 0xc83a32, 1.1, seg=8, dirn=(0, 0, 1), name='pin', proxy=False)
    A.box('glass', (0, 0, 0.068), (2.5, 0.90, 0.006), 0xb8c8d0, 1.1, name='glass', proxy=False)
    if not A.lo:
        A.box('metal', (1.20, -0.30, 0.07), (0.02, 0.06, 0.012), 0x8a949a, 1.2, bev=0.003, name='lock', proxy=False)


@asset('hydrant_box', ao=0.35, ground=False, wall=0.0)
def hydrant_box(A):
    """消防栓箱（背面 z=0，中心离地 0.95 米处为原点）：红色箱体、门框、玻璃窗里看得见盘着的水带、白字「消火栓」条、门把手。"""
    A.box('metal', (0, 0, 0.08), (0.70, 0.90, 0.16), 0x7a3a33, 1.0, bev=0.01, name='box')
    A.box('dark', (0, 0.05, 0.1505), (0.40, 0.50, 0.004), 0x2a1210, 1.0, name='window_back', proxy=False)
    if not A.lo:
        A.lathe('fabric', (0, 0.05, 0.12), [(0.06, -0.012), (0.17, -0.012), (0.17, 0.012), (0.06, 0.012)], 0xd8d0b8, 1.0, seg=24, dirn=(0, 0, 1), name='hose', proxy=False)
        A.cyl('metal', (0, 0.05, 0.11), 0.05, 0.05, 0.03, 0xc8a24a, 1.2, seg=16, dirn=(0, 0, 1), name='reel', proxy=False)
    A.box('glass', (0, 0.05, 0.161), (0.40, 0.50, 0.003), 0xb8c8d0, 1.1, name='glass', proxy=False)
    A.box('paper', (0, 0.38, 0.1615), (0.50, 0.08, 0.002), 0xe8e4dc, 1.0, name='label', proxy=False)
    if not A.lo:
        for k in range(3):
            A.box('emit', (-0.10 + k * 0.10, 0.38, 0.1628), (0.06, 0.05, 0.001), 0xc83a32, 0.8, name='glyph', proxy=False)
    A.box('metal', (0.30, -0.10, 0.165), (0.02, 0.08, 0.012), 0xb8c0c2, 1.2, bev=0.003, name='handle', proxy=False)


# ---------------------------------------------------------------- 教室前墙
BW = 7 * 0.72         # 黑板宽
HW = 7 * 0.82         # 高窗宽


@asset('blackboard', ao=0.35, ground=False, wall=0.0)
def blackboard(A):
    """黑板（背面 z=0；原点在墙上、板面中心高 1.70 米处）：铝框、墨绿的板面、粉笔槽（几截粉笔、粉笔灰）、板擦。字由游戏另贴。"""
    A.box('metal', (0, 0, 0.04), (BW + 0.12, 1.17, 0.06), 0x8a9298, 1.0, bev=0.012, name='frame')
    A.box('board', (0, 0, 0.0755), (BW, 1.05, 0.01), 0x2a3a34, 1.0, name='board', proxy=False)
    A.box('metal', (0, -0.55, 0.12), (BW + 0.12, 0.04, 0.14), 0x6a7276, 1.0, bev=0.006, name='tray')
    if not A.lo:
        A.box('metal', (0, -0.525, 0.185), (BW + 0.12, 0.03, 0.01), 0x6a7276, 1.0, bev=0.002, name='tray_lip', proxy=False)
        A.box('paper', (0, -0.529, 0.12), (BW * 0.9, 0.001, 0.10), 0xd8d8d0, 1.0, name='dust', proxy=False)
    for (x, z, c, l) in ((-0.6, 0.11, 0xe8e8e0, 0.08), (-0.5, 0.13, 0xd86a6a, 0.06), (-0.2, 0.12, 0xe8e8e0, 0.04), (0.35, 0.10, 0x6aa0d8, 0.05)):
        A.rod('plastic', (x - l / 2, -0.522, z), (x + l / 2, -0.522, z), 0.0055, 0.0055, c, 1.0, seg=8, name='chalk', proxy=False)
    A.box('wood', (0.8, -0.505, 0.12), (0.16, 0.05, 0.07), 0x3a3028, 1.0, bev=0.008, name='eraser')
    A.box('fabric', (0.8, -0.532, 0.12), (0.16, 0.006, 0.07), 0x3a3a3a, 1.0, name='felt', proxy=False)


@asset('window_high', ao=0.3, ground=False, wall=0.0)
def window_high(A):
    """黑板上方的一排高窗（背面 z=0；原点在墙上、窗中心高 2.63 米处）：上下框、五扇的竖梃、玻璃后面透进来的天光、一个开窗器。"""
    A.box('sky', (0, 0, 0.007), (HW, 0.46, 0.004), 0xffffff, 0.9, name='sky', proxy=False)
    A.box('glass', (0, 0, 0.022), (HW, 0.46, 0.006), 0x8aa0aa, 1.1, name='glass', proxy=False)
    A.box('metal', (0, 0.26, 0.03), (HW + 0.16, 0.06, 0.06), 0x39434a, 1.0, bev=0.005, name='top')
    A.box('metal', (0, -0.26, 0.05), (HW + 0.16, 0.06, 0.10), 0x39434a, 1.0, bev=0.005, name='bottom')
    for mu in range(1, 5):
        A.box('metal', (-HW / 2 + HW / 5 * mu, 0, 0.03), (0.045, 0.50, 0.05), 0x39434a, 1.05, bev=0.004, name='mullion')
    A.box('plastic', (0, -0.01, 0.06), (0.10, 0.03, 0.10), 0x2a2a2a, 1.0, bev=0.006, name='opener')


@asset('speaker_box', ao=0.3, ground=False, wall=0.0)
def speaker_box(A):
    """教室的广播喇叭（背面 z=0）：木纹箱体、布面、圆的喇叭轮廓、挂架。中心在原点。"""
    A.box('plastic', (0, 0, 0.07), (0.24, 0.32, 0.14), 0x2a2e32, 1.0, bev=0.02, name='box')
    A.box('fabric', (0, 0, 0.1405), (0.19, 0.26, 0.002), 0x1a1c1e, 1.0, name='grille', proxy=False)
    if not A.lo:
        A.lathe('fabric', (0, -0.02, 0.1418), [(0.07, 0.0), (0.074, 0.002), (0.07, 0.003)], 0x0e1012, 1.0, seg=24, dirn=(0, 0, 1), cap0=False, cap1=False, name='ring', proxy=False)
        A.box('metal', (0, 0.17, 0.02), (0.06, 0.02, 0.04), 0x5a5e62, 1.0, bev=0.004, name='bracket', proxy=False)


@asset('clock_wall', ao=0.3, ground=False, wall=0.0)
def clock_wall(A):
    """挂钟（背面 z=0；原点在钟心）：黑色塑料框、表盘（十二道刻度）、时针分针秒针、玻璃罩。"""
    A.lathe('plastic', (0, 0, 0), [(0, 0), (0.29, 0), (0.29, 0.05), (0.27, 0.07), (0.25, 0.07), (0.25, 0.05)], 0x1b1f22, 1.0, seg=40, dirn=(0, 0, 1), cap1=False, name='rim')
    A.cyl('paper', (0, 0, 0.0), 0.25, 0.25, 0.051, 0xc6cfcb, 1.0, seg=40, dirn=(0, 0, 1), name='face', proxy=False)
    if not A.lo:
        for k in range(12):
            a = k / 12 * 2 * math.pi
            l = 0.035 if k % 3 == 0 else 0.018
            A.box('dark', (math.sin(a) * (0.22 - l / 2), math.cos(a) * (0.22 - l / 2), 0.052), (0.008 if k % 3 == 0 else 0.004, l, 0.001), 0x22282a, 1.0, rot=(0, 0, -a), name='tick', proxy=False)
    A.box('dark', (0.0, 0.06, 0.054), (0.012, 0.13, 0.002), 0x22282a, 1.0, name='hour', proxy=False)
    A.box('dark', (0.05, 0.0, 0.056), (0.11, 0.008, 0.002), 0x22282a, 1.0, name='minute', proxy=False)
    if not A.lo:
        A.box('emit', (-0.03, -0.07, 0.058), (0.003, 0.17, 0.001), 0xb02a22, 0.8, rot=(0, 0, 0.4), name='second', proxy=False)
        A.cyl('metal', (0, 0, 0.052), 0.01, 0.01, 0.008, 0x22282a, 1.0, seg=10, dirn=(0, 0, 1), name='hub', proxy=False)
    A.cyl('glass', (0, 0, 0.065), 0.25, 0.25, 0.002, 0xc8d4d8, 1.2, seg=40, dirn=(0, 0, 1), name='glass', proxy=False)


@asset('board_news', ao=0.3, ground=False, wall=0.0)
def board_news(A):
    """后墙的黑板报（背面 z=0；原点在板面中心）：木框黑板、彩色粉笔的大标题、两栏小字、角上画的一朵花和一道彩带。"""
    A.box('board', (0, 0, 0.02), (2.2, 1.05, 0.04), 0x23302a, 1.0, bev=0.01, name='board')
    rnd = random.Random(23)
    cols = (0xe8e0c8, 0xd8a0a0, 0xa8c8e0, 0xe0d080, 0xa8d8a8)
    for k in range(6):
        A.box('emit', (-0.8 + k * 0.3, 0.32, 0.0405), (0.20 + rnd.random() * 0.06, 0.07, 0.001), cols[k % 5], 0.55, name='title', proxy=False)
    if not A.lo:
        for col in range(2):
            for k in range(9):
                A.box('emit', (-0.55 + col * 0.95 + (rnd.random() - 0.5) * 0.02, 0.15 - k * 0.06, 0.0405), (0.6 * (0.6 + rnd.random() * 0.4), 0.012, 0.001), cols[(col * 2 + k // 3) % 5], 0.4, name='text', proxy=False)
        for k in range(6):
            a = k / 6 * 2 * math.pi
            A.blob('emit', (0.85 + math.cos(a) * 0.05, -0.30 + math.sin(a) * 0.05, 0.0405), (0.035, 0.022, 0.001), 0xd8a0a0, 0.5, seg=8, rot=(0, 0, a), name='petal', proxy=False)
        for k in range(8):
            A.box('emit', (-0.95 + k * 0.05, 0.45 - (k % 2) * 0.03, 0.0405), (0.06, 0.012, 0.001), cols[k % 5], 0.5, rot=(0, 0, 0.5 if k % 2 else -0.5), name='ribbon', proxy=False)


@asset('pillar_bands', ao=0.2, ground=False, inst=True)
def pillar_bands(A):
    """车库柱子下部的警示带：黄黑相间四道（包在 1 米见方的柱子外面），棱角上一道护角。"""
    for kb in range(4):
        A.box('plastic', (0, 0.15 + kb * 0.25, 0), (1.02, 0.12, 1.02), 0x1a1a18 if kb % 2 else 0xc8a830, 1.0, bev=0.004, name='band')
    if not A.lo:
        for sx in (-1, 1):
            for sz in (-1, 1):
                A.box('plastic', (sx * 0.505, 0.55, sz * 0.505), (0.03, 1.0, 0.03), 0xd8b838, 1.0, bev=0.008, rot=math.pi / 4, name='corner', proxy=False)


@asset('sprinkler', ao=0.2, ground=False, ceil=2.935, inst=True)
def sprinkler(A):
    """消防喷淋头：从红色喷淋管上垂下来的一截短管、铜色的喷头和溅水盘。原点在管子下面的地面上（管子中心高 2.90）。"""
    A.rod('metal', (0, 2.90, 0), (0, 2.80, 0), 0.012, 0.012, 0xa83228, 1.0, seg=10, caps=False, name='drop')
    A.lathe('metal', (0, 2.76, 0), [(0.0, 0.0), (0.03, 0.006), (0.032, 0.01), (0.012, 0.012), (0.012, 0.04), (0.016, 0.04)], 0xc8b06a, 1.2, seg=16, name='head')
    if not A.lo:
        for s in (-1, 1):
            A.rod('metal', (s * 0.008, 2.775, 0), (s * 0.008, 2.80, 0), 0.0025, 0.0025, 0xc8b06a, 1.2, seg=6, name='frame', proxy=False)
