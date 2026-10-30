"""楼外的构件：立面窗（窗套、窗台、铝合金推拉窗的外框和窗扇）、防盗网、空调外机、太阳能热水器、
楼顶的楼梯间 / 水箱 / 天线、雨水管的管卡和落水口、楼的大门（门斗、地弹门、台阶、雨棚）、小铁门、排油烟罩。
约定：游戏坐标（米，y 朝上）；贴墙的东西局部 +z 朝外，墙面在 z=0。楼体本身（砖墙、腰线、女儿墙）还是游戏里按楼的尺寸拼。"""
import math

from mathutils import Vector

from wdfz import asset, rrect, V
from assets._parts import STEEL, CHROME, BLACK, screw, led, slats

WHITEBAND = 0xe8e4de
WIN_DARK = 0x33454e
SILL = 0xd8d4cb
ALU = 0xb8bcbc
BRICK = 0xbe7d74
GLASS = 0x6a8494


def beam(A, mat, p, q, w, h, col, shade=1.0, bev=0.0, name='beam', proxy=True, roll=0.0):
    """方管、角钢一类：从 p 到 q 的长方体，截面 w（横）× h（竖）。碰撞代理按杆算。"""
    p, q = V(p), V(q)
    d = q - p
    L = d.length
    if L < 1e-6:
        return
    yaw = math.atan2(d.x, d.z)
    pitch = -math.asin(max(-1.0, min(1.0, d.y / L)))
    m = (p + q) / 2
    with A.at(m.x, m.y, m.z, ry=yaw):
        with A.at(0, 0, 0, rx=pitch, rz=roll):
            A.box(mat, (0, 0, 0), (w, h, L), col, shade, bev=bev, name=name, proxy=False)
    if proxy:
        A.proxy_rod(tuple(p), tuple(q), max(w, h) / 2)


# ====================================================================== 立面窗
# 窗洞中心是原点；墙面 z=0，往外 +z。由里往外：屋里的暗面（0–0.004）、亮灯的那层和窗帘（游戏里画，0.004–0.008）、
# 里轨窗扇（0.010–0.034）、外轨窗扇（0.036–0.060）、铝外框（0.008–0.062）、窗套（0–0.10）、窗台（挑到 0.17）。
FW, FD = 0.09, 0.10          # 窗套宽、挑出
FB = 0.04                    # 铝外框宽
FZ, FDP = 0.035, 0.054       # 外框中面、厚
SZ_IN, SZ_OUT, ST = 0.022, 0.048, 0.024     # 里轨、外轨窗扇中面，扇厚
WIN_SIZES = [(1.8, 1.2), (1.8, 1.25), (1.6, 1.25), (1.4, 1.2), (1.2, 1.1), (1.0, 2.0), (2.4, 1.8), (1.4, 1.0), (1.6, 0.9)]
GRILLE_SIZES = [(1.4, 1.2), (1.2, 1.1)]


def transom_y(wh):
    return wh / 2 - wh * 0.24


def facade_frame(A, ww, wh):
    hw, hh = ww / 2, wh / 2
    A.box('dark', (0, 0, 0.002), (ww, wh, 0.004), WIN_DARK, 1.0, name='inside', proxy=False)
    # 窗套：一整圈 U 形的白色线脚（下面落在窗台上），外沿、内沿都倒角
    prof = [(-hw - FW, -hh), (-hw, -hh), (-hw, hh), (hw, hh), (hw, -hh), (hw + FW, -hh), (hw + FW, hh + FW), (-hw - FW, hh + FW)]
    A.prism('plaster', (0, 0, FD / 2), prof, FD, WHITEBAND, 1.0, bev=0.012, name='trim', proxy=False)
    A.proxy_box((0, hh + FW / 2, FD / 2), (ww + 2 * FW, FW, FD))
    for s in (-1, 1):
        A.proxy_box((s * (hw + FW / 2), 0, FD / 2), (FW, wh, FD))
    # 窗台：石板往外挑、面上往外斜一点，前沿底下一道滴水槽
    with A.at(0, -hh - 0.035, 0.085, rx=0.035):
        A.box('stone', (0, 0, 0), (ww + 0.30, 0.07, 0.17), SILL, 1.05, bev=0.008, name='sill')
        if A.hi:
            A.box('dark', (0, -0.0352, 0.05), (ww + 0.24, 0.0012, 0.008), 0x6a6862, 1.0, name='drip', proxy=False)
    # 铝合金外框：四根型材、亮子横档；外框和窗套之间一道打胶的缝
    A.box('metal', (0, hh - FB / 2, FZ), (ww, FB, FDP), ALU, 1.05, bev=0.004, name='frame_t')
    A.box('metal', (0, -hh + FB / 2, FZ), (ww, FB, FDP), ALU, 1.0, bev=0.004, name='frame_b')
    for s in (-1, 1):
        A.box('metal', (s * (hw - FB / 2), 0, FZ), (FB, wh - 2 * FB, FDP), ALU, 1.0, bev=0.004, name='frame_s')
    ty = transom_y(wh)
    A.box('metal', (0, ty, FZ), (ww - 2 * FB, 0.035, FDP), ALU, 1.05, bev=0.004, name='transom')
    if A.hi:
        # 下框里的两条滑轨、外侧两个排水孔
        for dz in (SZ_IN - FZ, SZ_OUT - FZ):
            A.box('metal', (0, -hh + FB + 0.004, FZ + dz), (ww - 2 * FB, 0.008, 0.004), 0x9aa0a2, 1.0, name='track', proxy=False)
        for s in (-1, 1):
            A.box('dark', (s * ww * 0.3, -hh + 0.012, FZ + FDP / 2 + 0.0004), (0.03, 0.006, 0.001), 0x2a2e30, 1.0, name='weep', proxy=False)
        # 打胶缝：外框四周一圈深色细线
        for (x, y, w, h) in ((0, hh + 0.002, ww, 0.004), (0, -hh - 0.002, ww, 0.004), (-hw - 0.002, 0, 0.004, wh), (hw + 0.002, 0, 0.004, wh)):
            A.box('dark', (x, y, FZ + FDP / 2 - 0.004), (w, h, 0.006), 0x4a4c4a, 1.0, name='seal', proxy=False)
    # 亮子：固定玻璃，四周压条
    gy0, gy1 = ty + 0.0175, hh - FB
    A.box('glass', (0, (gy0 + gy1) / 2, SZ_OUT), (ww - 2 * FB, gy1 - gy0, 0.006), GLASS, 1.1, name='glass_top', proxy=False)
    if not A.lo:
        bw = 0.014
        for (x, y, w, h) in ((0, gy1 - bw / 2, ww - 2 * FB, bw), (0, gy0 + bw / 2, ww - 2 * FB, bw),
                             (-(hw - FB - bw / 2), (gy0 + gy1) / 2, bw, gy1 - gy0 - 2 * bw), (hw - FB - bw / 2, (gy0 + gy1) / 2, bw, gy1 - gy0 - 2 * bw)):
            A.box('metal', (x, y, SZ_OUT + 0.008), (w, h, 0.01), 0xa8aeb0, 1.0, name='bead', proxy=False)


def sash_dims(ww, wh):
    hh = wh / 2
    y0, y1 = -hh + FB, transom_y(wh) - 0.0175
    sw = (ww - 2 * FB) / 2 + 0.025
    return sw, y1 - y0, (y0 + y1) / 2


def facade_sash(A, ww, wh):
    """一扇推拉窗扇（原点在扇的中心、扇厚的中面）：四根扇框、玻璃、勾企那一边粗一点、毛条。"""
    sw, sh, _ = sash_dims(ww, wh)
    st = 0.035
    A.box('glass', (0, 0, 0), (sw - 0.04, sh - 0.04, 0.005), GLASS, 1.1, name='glass', proxy=False)
    for s in (-1, 1):
        A.box('metal', (0, s * (sh / 2 - st / 2), 0), (sw, st, ST), ALU, 1.06 if s > 0 else 1.0, bev=0.003, name='rail', proxy=False)
    A.box('metal', (-(sw / 2 - st / 2), 0, 0), (st, sh - 2 * st, ST), ALU, 1.0, bev=0.003, name='stile', proxy=False)
    A.box('metal', (sw / 2 - 0.022, 0, 0), (0.044, sh - 2 * st, ST + 0.004), ALU, 1.04, bev=0.003, name='interlock', proxy=False)
    if A.hi:
        A.box('dark', (sw / 2 + 0.0005, 0, 0), (0.002, sh - 2 * st, ST * 0.6), 0x202224, 1.0, name='brush', proxy=False)
        A.box('dark', (0, -sh / 2 + 0.0005, 0), (sw * 0.9, 0.002, ST * 0.5), 0x202224, 1.0, name='brush', proxy=False)
    A.proxy_box((0, 0, 0), (sw, sh, ST))


def grille(A, ww, wh):
    """一楼的防盗窗：方管焊的笼子往外凸 0.28 米，前面竖杆、几道横撑，两侧也是竖杆，底下三根托条，靠墙四个膨胀螺栓的角码。"""
    hw, hh = ww / 2, wh / 2
    x0, x1 = -hw - 0.18, hw + 0.18
    y0, y1 = -hh - 0.12, hh + FW + 0.06
    D = 0.28
    col = 0x4e5355
    t = 0.022
    # 外框：前面四边、两侧上下、靠墙两根竖的
    for (p, q) in (((x0, y0, D), (x1, y0, D)), ((x0, y1, D), (x1, y1, D)), ((x0, y0, D), (x0, y1, D)), ((x1, y0, D), (x1, y1, D)),
                   ((x0, y0, 0.01), (x0, y0, D)), ((x1, y0, 0.01), (x1, y0, D)), ((x0, y1, 0.01), (x0, y1, D)), ((x1, y1, 0.01), (x1, y1, D)),
                   ((x0, y0, 0.01), (x0, y1, 0.01)), ((x1, y0, 0.01), (x1, y1, 0.01))):
        beam(A, 'metal', p, q, t, t, col, 1.0, bev=0.002, name='frame')
    gap = (0.12, 0.13, 0.18, 0.30)[A.L]
    n = max(3, int(round((x1 - x0) / gap)))
    for k in range(1, n):
        x = x0 + (x1 - x0) * k / n
        beam(A, 'metal', (x, y0 + t / 2, D), (x, y1 - t / 2, D), 0.016, 0.016, col, 1.0, name='bar', proxy=False)
    nh = 2 if A.L <= 2 else 1
    for k in range(1, nh + 1):
        y = y0 + (y1 - y0) * k / (nh + 1)
        beam(A, 'metal', (x0, y, D + 0.012), (x1, y, D + 0.012), 0.02, 0.02, col, 1.0, name='rail', proxy=False)
    ns = max(1, int(round(D / gap)))
    for xs in (x0, x1):
        for k in range(1, ns + 1):
            z = 0.01 + (D - 0.01) * k / (ns + 1)
            beam(A, 'metal', (xs, y0 + t / 2, z), (xs, y1 - t / 2, z), 0.016, 0.016, col, 1.0, name='side_bar', proxy=False)
    for k in range(3):
        z = 0.06 + k * (D - 0.06) / 2
        beam(A, 'metal', (x0, y0, z), (x1, y0, z), 0.018, 0.018, col, 1.0, name='floor_bar', proxy=False)
    A.proxy_box(((x0 + x1) / 2, (y0 + y1) / 2, D), (x1 - x0, y1 - y0, 0.03))
    if not A.lo:
        for xs in (x0, x1):
            for ys in (y0, y1):
                A.box('metal', (xs, ys, 0.004), (0.06, 0.06, 0.008), col, 0.95, name='plate', proxy=False)
                if A.hi:
                    A.cyl('metal', (xs, ys, 0.008), 0.008, 0.008, 0.008, 0x8a9094, 1.1, seg=8, dirn=(0, 0, 1), name='bolt', proxy=False)


def _reg_windows():
    for (ww, wh) in WIN_SIZES:
        tag = '%d_%d' % (round(ww * 100), round(wh * 100))
        asset('fwin_' + tag, ao=0.3, ground=False, wall=0.0, inst=True, lods=(0, 1, 2))(lambda A, ww=ww, wh=wh: facade_frame(A, ww, wh))
        asset('fsash_' + tag, ao=0.2, ground=False, inst=True, lods=(0, 1, 2))(lambda A, ww=ww, wh=wh: facade_sash(A, ww, wh))
    for (ww, wh) in GRILLE_SIZES:
        tag = '%d_%d' % (round(ww * 100), round(wh * 100))
        asset('fgrille_' + tag, ao=0.25, ground=False, wall=0.0, inst=True, lods=(0, 1, 2))(lambda A, ww=ww, wh=wh: grille(A, ww, wh))


_reg_windows()


# ====================================================================== 空调外机
@asset('ac_outdoor', ao=0.35, inst=True)
def ac_outdoor(A):
    """空调外机（放在外走廊的栏板上，局部 +z 朝外，墙在 z=-0.28）：圆角机壳、正面的出风口（凸起的圈、
    一圈圈的防护网、后面三片扇叶）、右侧的阀门盖、左侧和背面的散热片、两根底脚和减震垫，
    铜管裹着白色保温带拐进墙洞，一根冷凝水管。"""
    W, H, D = 0.80, 0.56, 0.29
    y0 = 0.035
    cy = y0 + H / 2
    C = 0xdcd8d0
    A.box('plastic', (0, cy, 0), (W, H, D), C, 1.0, bev=0.014, name='casing')
    fx, R = -0.10, 0.20
    zf = D / 2
    # 出风口：深色的筒、扇叶、毂
    A.cyl('dark', (fx, cy, zf - 0.06), R, R, 0.062, 0x14181b, 1.0, seg=24, caps=False, dirn=(0, 0, 1), name='duct', proxy=False)
    A.cyl('dark', (fx, cy, zf - 0.062), R, R, 0.002, 0x0e1113, 1.0, seg=24, dirn=(0, 0, 1), name='duct_back', proxy=False)
    if not A.lo:
        A.cyl('plastic', (fx, cy, zf - 0.05), 0.045, 0.04, 0.03, 0x2a2e30, 1.0, seg=14, dirn=(0, 0, 1), name='hub', proxy=False)
        for k in range(3):
            a = k * 2 * math.pi / 3 + 0.3
            with A.at(fx, cy, zf - 0.035, rz=a):
                A.prism('plastic', (0, 0, 0), [(0.04, -0.03), (0.17, -0.06), (0.185, 0.0), (0.16, 0.05), (0.04, 0.035)], 0.006, 0x3a4044, 1.0,
                        rot=(0.35, 0, 0), name='blade', proxy=False)
    # 凸起的圈
    A.lathe('plastic', (fx, cy, zf), [(R - 0.002, 0.0), (R + 0.022, 0.0), (R + 0.026, 0.006), (R + 0.012, 0.012), (R - 0.002, 0.010)], C, 1.03,
            seg=28, dirn=(0, 0, 1), cap0=False, cap1=False, name='bezel', proxy=False)
    # 防护网：同心圈 + 辐条
    rings = (4, 3, 2, 1)[A.L]
    for k in range(rings):
        r = R * (k + 1) / rings
        pts = [(fx + math.cos(a) * r, cy + math.sin(a) * r, zf + 0.012) for a in [i / 20 * 2 * math.pi for i in range(20)]]
        A.tube('metal', pts, 0.0022, 0x2a2e30, 1.0, seg=4, closed=True, name='guard_ring', proxy=False)
    spokes = (6, 6, 4, 0)[A.L]
    for k in range(spokes):
        a = k / max(1, spokes) * 2 * math.pi
        A.rod('metal', (fx, cy, zf + 0.012), (fx + math.cos(a) * R, cy + math.sin(a) * R, zf + 0.012), 0.002, 0.002, 0x2a2e30, 1.0, seg=4, caps=False, name='spoke', proxy=False)
    # 右侧：阀门盖板；正面右上：铭牌
    A.box('plastic', (W / 2 + 0.005, cy - 0.10, zf - 0.07), (0.01, 0.20, 0.13), 0xc8c4bc, 1.0, bev=0.003, name='valve_cover')
    if not A.lo:
        A.box('metal', (W / 2 - 0.12, cy + H / 2 - 0.07, zf + 0.0008), (0.12, 0.03, 0.002), 0x9aa0a4, 1.1, name='badge', proxy=False)
        # 右边一溜竖的进风百叶
        with A.at(W / 2 - 0.12, cy + 0.02, zf, rz=math.pi / 2):
            slats(A, 'plastic', (0, 0, 0.0005), 0.36, 0.14, 6, C, depth=0.008, name='grill')
    # 左侧、背面：散热片（深色凹进去的面，上面一道道细缝）
    for (side, dirx) in (('l', -1), ('b', 0)):
        if dirx:
            with A.at(-W / 2, cy, -0.01, ry=-math.pi / 2):
                A.box('dark', (0, 0, 0.002), (D - 0.06, H - 0.08, 0.004), 0x2a2e30, 1.0, name='coil', proxy=False)
                if A.hi:
                    for k in range(14):
                        A.box('metal', (0, -H / 2 + 0.06 + k * (H - 0.12) / 13, 0.0045), (D - 0.07, 0.004, 0.002), 0x8a9094, 1.0, name='fin', proxy=False)
        else:
            with A.at(0, cy, -D / 2, ry=math.pi):
                A.box('dark', (0, 0, 0.002), (W - 0.08, H - 0.08, 0.004), 0x2a2e30, 1.0, name='coil', proxy=False)
    # 底脚、减震垫
    for s in (-1, 1):
        A.box('metal', (s * 0.30, y0 / 2 + 0.004, 0), (0.06, y0 - 0.008, D + 0.03), 0x9a9e9e, 1.0, bev=0.003, name='foot')
        if not A.lo:
            for zz in (-1, 1):
                A.box('plastic', (s * 0.30, 0.002, zz * 0.11), (0.05, 0.004, 0.05), BLACK, 1.0, name='pad', proxy=False)
    # 铜管 + 保温带：从右侧阀门出来，往后拐进墙洞
    px = W / 2 + 0.05
    A.tube('plastic', [(W / 2 - 0.01, cy - 0.12, zf - 0.07), (px, cy - 0.12, zf - 0.07), (px, cy - 0.12, -0.20), (px, cy + 0.12, -0.25), (px, cy + 0.14, -0.28)],
           0.022, 0xe6e4dc, 1.0, seg=8, bend=0.05, ellip=0.75, name='pipe')
    if not A.lo:
        A.cyl('plastic', (px, cy + 0.14, -0.28), 0.045, 0.045, 0.012, 0xe8e6e0, 1.0, seg=14, dirn=(0, 0, 1), name='wall_cap', proxy=False)
        A.tube('plastic', [(-W / 2 + 0.12, y0 + 0.01, 0.0), (-W / 2 + 0.12, 0.012, 0.06), (-W / 2 + 0.12, 0.009, 0.30)], 0.008, 0x7a7e80, 1.0, seg=6, bend=0.03, name='drain')


# ====================================================================== 太阳能热水器
@asset('solar_heater', ao=0.4, inst=True)
def solar_heater(A):
    """太阳能热水器（局部 -z 是水箱一侧、高；真空管朝 +z 斜下来）：不锈钢水箱（封头、两道箍）、一排真空管
    （外层玻璃、里面深蓝的吸热层、管尾的塑料托）、铝角钢支架（两侧三角架、后面的斜撑、底下的压块）、进出水管和排气管。"""
    w = 1.9
    ty, tz, tr = 1.05, -0.55, 0.20
    SS = 0xd8dcdc
    # 水箱：车削，两头封头
    A.lathe('metal', (-w / 2 - 0.04, ty, tz), [(0, 0), (tr * 0.7, 0.0), (tr * 0.95, 0.02), (tr, 0.05), (tr, w + 0.03), (tr * 0.95, w + 0.06), (tr * 0.7, w + 0.08), (0, w + 0.08)],
            SS, 1.1, seg=20, dirn=(1, 0, 0), name='tank')
    if not A.lo:
        for xx in (-w * 0.32, w * 0.32):
            A.cyl('metal', (xx - 0.015, ty, tz), tr + 0.006, tr + 0.006, 0.03, 0xb8bcbe, 1.0, seg=20, dirn=(1, 0, 0), name='band', proxy=False)
        A.cyl('metal', (w * 0.2, ty + tr - 0.01, tz), 0.012, 0.012, 0.12, 0x9aa0a4, 1.0, seg=8, name='vent', proxy=False)
        A.cyl('metal', (w * 0.2, ty + tr + 0.11, tz), 0.022, 0.0, 0.03, 0x9aa0a4, 1.0, seg=8, name='vent_cap', proxy=False)
    # 真空管
    n = (15, 12, 9, 6)[A.L]
    top = Vector((0, ty - 0.10, tz + 0.13))
    bot = Vector((0, 0.15, 0.75))
    dn = (bot - top).normalized()
    for k in range(n):
        tx = -w / 2 + 0.08 + k * (w - 0.16) / (n - 1)
        a = (tx, top.y, top.z)
        b = (tx, bot.y, bot.z)
        if A.lo:
            A.rod('dark', a, b, 0.028, 0.028, 0x2a3440, 1.0, seg=4, name='tube', proxy=False)
            continue
        A.rod('dark', a, b, 0.022, 0.022, 0x1c2a3a, 1.0, seg=6, caps=False, name='absorber', proxy=False)
        A.rod('glass', a, b, 0.029, 0.029, 0x9ab0bc, 1.15, seg=8, round_=0.012, name='tube_glass', proxy=False)
        if A.hi:
            A.cyl('plastic', (tx, top.y, top.z), 0.033, 0.033, 0.03, BLACK, 1.0, seg=10, dirn=tuple(dn), name='seal', proxy=False)
        A.cyl('plastic', (tx, bot.y - dn.y * 0.04, bot.z - dn.z * 0.04), 0.034, 0.034, 0.06, 0x2a2e30, 1.0, seg=10, dirn=tuple(dn), name='cup', proxy=False)
    A.proxy_box((0, (top.y + bot.y) / 2, (top.z + bot.z) / 2), (w, abs(top.y - bot.y), abs(top.z - bot.z)))
    # 支架：两侧三角架 + 托管尾的横梁 + 背后的斜撑
    FR = 0x9aa0a4
    for s in (-1, 1):
        x = s * w / 2
        beam(A, 'metal', (x, 0.02, 0.82), (x, ty - 0.05, tz + 0.04), 0.035, 0.035, FR, 1.0, bev=0.002, name='rail')
        beam(A, 'metal', (x, 0.02, tz), (x, ty - tr + 0.02, tz), 0.035, 0.035, FR, 1.0, bev=0.002, name='post')
        beam(A, 'metal', (x, 0.02, tz - 0.04), (x, 0.02, 0.86), 0.035, 0.035, FR, 0.95, bev=0.002, name='base')
        beam(A, 'metal', (x, 0.04, 0.2), (x, 0.66, tz + 0.02), 0.025, 0.025, FR, 0.95, bev=0.002, name='strut')
        for zz in (tz, 0.80):
            A.box('concrete', (x, 0.04, zz), (0.16, 0.08, 0.16), 0x9a968e, 1.0, bev=0.01, name='block')
    beam(A, 'metal', (-w / 2, bot.y - 0.02, bot.z + 0.02), (w / 2, bot.y - 0.02, bot.z + 0.02), 0.035, 0.035, FR, 1.0, bev=0.002, name='tail_bar')
    beam(A, 'metal', (-w / 2, ty - tr - 0.01, tz), (w / 2, ty - tr - 0.01, tz), 0.035, 0.035, FR, 1.0, bev=0.002, name='saddle')
    if not A.lo:
        beam(A, 'metal', (-w / 2, 0.08, tz), (w / 2, ty - tr - 0.05, tz), 0.004, 0.025, FR, 0.95, name='brace', proxy=False)
        beam(A, 'metal', (w / 2, 0.08, tz), (-w / 2, ty - tr - 0.05, tz), 0.004, 0.025, FR, 0.95, name='brace', proxy=False)
    # 进出水管（黑色保温管）从水箱两头下到屋面
    for s in (-1, 1):
        x = s * (w / 2 + 0.06)
        A.tube('plastic', [(s * (w / 2 + 0.03), ty - 0.06, tz), (x, ty - 0.06, tz), (x, 0.06, tz), (x, 0.04, tz - 0.4)], 0.022, 0x1a1c1e, 1.0, seg=8, bend=0.06, name='pipe')


# ====================================================================== 楼顶
@asset('roof_stairhouse', ao=0.5, inst=True)
def roof_stairhouse(A):
    """屋顶的楼梯间（局部 +z 是门）：砖墙、水泥墙裙、挑檐的屋面板（滴水线）、铁门（门框、两块凹板、执手、门槛）、
    门上的小雨棚和一盏灯、侧墙的百叶窗、背面上屋顶的爬梯。"""
    w, h, d = 3.2, 2.8, 3.0
    A.box('brick', (0, h / 2, 0), (w, h, d), BRICK, 0.96, bev=0.01, name='body')
    A.box('concrete', (0, 0.15, 0), (w + 0.04, 0.30, d + 0.04), 0x8e8a84, 1.0, bev=0.01, name='skirt')
    A.box('concrete', (0, h + 0.06, 0), (w + 0.2, 0.12, d + 0.2), 0xd8d4cc, 1.0, bev=0.012, name='slab')
    A.box('concrete', (0, h + 0.14, 0), (w + 0.04, 0.06, d + 0.04), 0xa8a49c, 1.0, bev=0.008, name='screed')
    if A.hi:
        for (x, z, sx, sz) in ((0, d / 2 + 0.07, w + 0.16, 0.012), (0, -d / 2 - 0.07, w + 0.16, 0.012), (w / 2 + 0.07, 0, 0.012, d + 0.16), (-w / 2 - 0.07, 0, 0.012, d + 0.16)):
            A.box('dark', (x, h - 0.0005, z), (sx, 0.002, sz), 0x5a5852, 1.0, name='drip', proxy=False)
    # 门
    dz = d / 2
    dw, dh = 0.9, 2.0
    FC = 0x3a4248
    for s in (-1, 1):
        A.box('metal', (s * (dw / 2 + 0.03), dh / 2 + 0.15, dz + 0.02), (0.06, dh + 0.06, 0.05), FC, 1.0, bev=0.004, name='door_frame')
    A.box('metal', (0, dh + 0.18, dz + 0.02), (dw + 0.12, 0.06, 0.05), FC, 1.0, bev=0.004, name='door_frame')
    A.box('metal', (0, dh / 2 + 0.15, dz + 0.012), (dw, dh, 0.03), 0x4a545a, 1.0, bev=0.004, name='door')
    if not A.lo:
        for yy in (0.62, 1.55):
            A.box('metal', (0, yy, dz + 0.0285), (dw - 0.22, 0.62, 0.004), 0x434c52, 1.0, bev=0.002, name='panel', proxy=False)
        A.box('metal', (dw / 2 - 0.09, 1.10, dz + 0.035), (0.03, 0.10, 0.012), 0x9aa0a4, 1.1, bev=0.003, name='escutcheon', proxy=False)
        A.rod('metal', (dw / 2 - 0.09, 1.12, dz + 0.04), (dw / 2 - 0.20, 1.12, dz + 0.05), 0.008, 0.008, 0xb8c0c2, 1.15, seg=8, round_=0.003, name='lever', proxy=False)
        A.box('metal', (0, 0.22, dz + 0.0285), (dw - 0.04, 0.12, 0.003), 0x8a9094, 1.05, name='kick', proxy=False)
    A.box('concrete', (0, dh + 0.42, dz + 0.25), (dw + 0.5, 0.07, 0.5), 0xc9c4bb, 1.0, bev=0.01, name='canopy')
    A.box('concrete', (0, 0.08, dz + 0.22), (dw + 0.4, 0.16, 0.44), 0x9a968e, 1.0, bev=0.01, name='step')
    A.box('plastic', (dw / 2 + 0.25, dh + 0.25, dz + 0.04), (0.16, 0.10, 0.08), 0x2a2e30, 1.0, bev=0.01, name='lamp')
    A.box('dead', (dw / 2 + 0.25, dh + 0.25, dz + 0.0805), (0.12, 0.07, 0.002), 0xd8d8d0, 1.0, name='lamp_lens', proxy=False)
    # 侧墙百叶窗
    with A.at(-w / 2, 2.0, 0.6, ry=-math.pi / 2):
        for (x, y, fw_, fh_) in ((0, 0.21, 0.62, 0.04), (0, -0.21, 0.62, 0.04), (-0.29, 0, 0.04, 0.38), (0.29, 0, 0.04, 0.38)):
            A.box('metal', (x, y, 0.012), (fw_, fh_, 0.024), 0x6a7074, 1.0, bev=0.003, name='louver_frame')
        slats(A, 'metal', (0, 0, 0.0205), 0.54, 0.38, 7 if A.hi else 4, 0x7a8084, depth=0.02, name='louver')
        A.proxy_box((0, 0, 0.012), (0.62, 0.46, 0.024))
    # 背面的爬梯
    lz = -d / 2 - 0.16
    for s in (-1, 1):
        A.box('metal', (0.6 + s * 0.2, (h + 0.9) / 2, lz), (0.04, h + 0.9, 0.03), 0x5a6064, 1.0, bev=0.003, name='stile')
        A.box('metal', (0.6 + s * 0.2, 1.2, lz + 0.08), (0.03, 0.03, 0.18), 0x5a6064, 1.0, name='bracket', proxy=False)
        A.box('metal', (0.6 + s * 0.2, h - 0.3, lz + 0.08), (0.03, 0.03, 0.18), 0x5a6064, 1.0, name='bracket', proxy=False)
    for k in range(int((h + 0.6) / 0.3)):
        A.rod('metal', (0.4, 0.35 + k * 0.3, lz), (0.8, 0.35 + k * 0.3, lz), 0.012, 0.012, 0x6a7074, 1.0, seg=8, name='rung', proxy=False)


@asset('roof_tank', ao=0.45, inst=True)
def roof_tank(A):
    """屋顶不锈钢水箱：两道水泥墩上一圈槽钢底座，立着的圆罐（焊缝箍、拱顶、人孔盖、通气帽），侧面的爬梯和液位管，底下的出水管和阀门。"""
    R, H0, H = 0.9, 0.34, 1.6
    for zz in (-0.45, 0.45):
        A.box('concrete', (0, 0.12, zz), (2.0, 0.24, 0.3), 0x9a968e, 1.0, bev=0.015, name='plinth')
    A.cyl('metal', (0, 0.24, 0), R + 0.04, R + 0.04, 0.10, 0x5a6064, 1.0, seg=24, name='base_ring')
    A.lathe('metal', (0, H0, 0), [(0, 0), (R, 0), (R, H), (R - 0.04, H + 0.04), (R * 0.6, H + 0.14), (0, H + 0.18)], 0xc8ccce, 1.08, seg=28, name='tank')
    if not A.lo:
        for yy in (0.55, 1.1):
            A.cyl('metal', (0, H0 + yy - 0.015, 0), R + 0.006, R + 0.006, 0.03, 0xb0b4b6, 1.0, seg=28, name='band', proxy=False)
        A.cyl('metal', (0.25, H0 + H + 0.10, 0.1), 0.24, 0.24, 0.06, 0xb8bcbe, 1.0, seg=18, round_=0.01, name='manhole')
        A.rod('metal', (0.12, H0 + H + 0.17, 0.1), (0.38, H0 + H + 0.17, 0.1), 0.008, 0.008, 0x9aa0a4, 1.0, seg=6, name='handle', proxy=False)
        A.cyl('metal', (-0.3, H0 + H + 0.08, -0.2), 0.03, 0.03, 0.22, 0x9aa0a4, 1.0, seg=8, name='vent')
        A.cyl('metal', (-0.3, H0 + H + 0.30, -0.2), 0.07, 0.02, 0.06, 0x9aa0a4, 1.0, seg=10, name='vent_cap', proxy=False)
        A.cyl('glass', (R + 0.03, H0 + 0.1, 0.3), 0.012, 0.012, H - 0.2, 0xa8b8c0, 1.1, seg=8, name='gauge', proxy=False)
    # 爬梯
    for s in (-1, 1):
        A.box('metal', (R + 0.12, (H0 + H + 0.5) / 2, s * 0.2), (0.03, H0 + H + 0.5, 0.04), 0x6a7074, 1.0, bev=0.003, name='stile')
    for k in range(int((H0 + H) / 0.3)):
        A.rod('metal', (R + 0.12, 0.3 + k * 0.3, -0.2), (R + 0.12, 0.3 + k * 0.3, 0.2), 0.011, 0.011, 0x7a8084, 1.0, seg=8, name='rung', proxy=False)
    # 出水管、阀门
    A.tube('metal', [(-R + 0.1, H0 + 0.08, 0.0), (-R - 0.15, H0 + 0.08, 0.0), (-R - 0.15, 0.05, 0.0), (-R - 0.15, 0.05, 0.6)], 0.035, 0x7a8084, 1.0, seg=10, bend=0.08, name='pipe')
    A.cyl('metal', (-R - 0.15, 0.25, -0.0), 0.05, 0.05, 0.10, 0xa83a2a, 1.0, seg=12, name='valve')


@asset('roof_antenna', ao=0.2, inst=True)
def roof_antenna(A):
    """楼梯间屋顶上的电视天线：底座、锈了的桅杆、两副八木天线（上面一副朝前、下面一副斜着），垂下来的馈线、三根拉线。"""
    RU = 0x6a625a
    A.box('concrete', (0, 0.06, 0), (0.4, 0.12, 0.4), 0x9a968e, 1.0, bev=0.01, name='base')
    A.cyl('metal', (0, 0.12, 0), 0.032, 0.018, 2.5, RU, 1.0, seg=10, name='mast')
    for (y, yaw, L, n) in ((2.45, 0.0, 1.3, 9), (1.85, 0.7, 0.9, 6)):
        with A.at(0, y, 0, ry=yaw):
            A.rod('metal', (0, 0, -0.35), (0, 0, L - 0.35), 0.012, 0.012, RU, 1.0, seg=6, name='boom', proxy=False)
            A.box('metal', (0, 0, 0), (0.05, 0.06, 0.06), 0x4a4440, 1.0, name='clamp', proxy=False)
            for k in range(n):
                z = -0.3 + k * (L - 0.1) / max(1, n - 1)
                half = 0.32 - k * 0.022 if k else 0.36
                A.rod('metal', (-half, 0, z), (half, 0, z), 0.0045, 0.0045, 0x8a847c, 1.0, seg=4, caps=False, name='element', proxy=False)
            if not A.lo:
                A.box('plastic', (0, -0.02, -0.18), (0.08, 0.04, 0.05), 0x2a2e30, 1.0, name='balun', proxy=False)
    A.proxy_box((0, 2.2, 0.3), (0.8, 0.8, 1.4))
    if not A.lo:
        A.tube('plastic', [(0.03, 2.4, -0.18), (0.06, 2.0, -0.05), (0.035, 1.2, 0.0), (0.05, 0.6, 0.02), (0.25, 0.14, 0.15)], 0.004, BLACK, 1.0, seg=4, bend=0.2, name='cable', proxy=False)
        for k in range(3):
            a = k * 2 * math.pi / 3 + 0.4
            A.rod('metal', (0, 1.9, 0), (math.cos(a) * 1.2, 0.02, math.sin(a) * 1.2), 0.0025, 0.0025, 0x7a746c, 1.0, seg=3, caps=False, name='guy', proxy=False)
            A.box('metal', (math.cos(a) * 1.2, 0.02, math.sin(a) * 1.2), (0.05, 0.04, 0.05), 0x5a5652, 1.0, name='anchor', proxy=False)


# ====================================================================== 雨水管
DP_Z = 0.16          # 管中心离墙
DP_R = 0.055
DP_COL = 0xd8d6d0


@asset('dp_clamp', ao=0.2, ground=False, wall=0.0, inst=True)
def dp_clamp(A):
    """雨水管的管卡（原点在这一道卡的高度、墙面上）：抱箍、两根撑到墙上的扁铁、墙上的底板和螺钉。"""
    col = 0x9a9e9e
    A.cyl('metal', (0, -0.02, DP_Z), DP_R + 0.006, DP_R + 0.006, 0.04, col, 1.0, seg=18, caps=False, name='band')
    A.cyl('metal', (0, -0.02, DP_Z), DP_R + 0.001, DP_R + 0.001, 0.04, col, 0.85, seg=18, caps=False, name='band_in', proxy=False)
    for s in (-1, 1):
        A.box('metal', (s * 0.03, 0, 0.055), (0.006, 0.035, 0.11), col, 1.0, name='strap', proxy=False)
    A.box('metal', (0, 0, 0.004), (0.10, 0.05, 0.008), col, 0.95, bev=0.002, name='plate')
    if A.hi:
        for s in (-1, 1):
            screw(A, (s * 0.038, 0, 0.008))


@asset('dp_shoe', ao=0.35, wall=0.0, inst=True)
def dp_shoe(A):
    """雨水管的下口（原点在墙脚）：管子在 0.32 米高处往外弯，出水口朝外斜下；底下一块水泥的接水簸箕。"""
    A.tube('plastic', [(0, 0.40, DP_Z), (0, 0.30, DP_Z), (0, 0.12, DP_Z + 0.16), (0, 0.10, DP_Z + 0.22)], DP_R, DP_COL, 1.0, seg=14, bend=0.10, caps=False, name='elbow')
    A.cyl('plastic', (0, 0.105, DP_Z + 0.215), DP_R + 0.004, DP_R + 0.004, 0.02, DP_COL, 0.95, seg=14, caps=False, dirn=(0, -0.3, 1), name='lip', proxy=False)
    A.cyl('dark', (0, 0.104, DP_Z + 0.218), DP_R - 0.004, DP_R - 0.004, 0.004, 0x1a1c1e, 1.0, seg=14, dirn=(0, -0.3, 1), name='mouth', proxy=False)
    A.prism('concrete', (0, 0, DP_Z + 0.32), [(-0.16, 0.0), (0.16, 0.0), (0.16, 0.06), (0.11, 0.06), (0.09, 0.02), (-0.09, 0.02), (-0.11, 0.06), (-0.16, 0.06)], 0.50,
            0xa8a49c, 1.0, bev=0.006, name='splash')


@asset('dp_head', ao=0.3, ground=False, wall=0.0, inst=True)
def dp_head(A):
    """雨水斗（原点在斗底、墙面上，管子从这里往下接）：上宽下窄的斗、上沿卷边，斗口接女儿墙的出水口。"""
    col = DP_COL
    A.loft('plastic', [[(-0.06, 0.0, DP_Z - 0.06), (0.06, 0.0, DP_Z - 0.06), (0.06, 0.0, DP_Z + 0.06), (-0.06, 0.0, DP_Z + 0.06)],
                       [(-0.14, 0.22, 0.01), (0.14, 0.22, 0.01), (0.14, 0.22, DP_Z + 0.10), (-0.14, 0.22, DP_Z + 0.10)]],
           col, 1.0, cap0=True, cap1=False, smooth=False, name='hopper')
    A.box('plastic', (0, 0.225, DP_Z / 2 + 0.05), (0.30, 0.018, DP_Z + 0.12), col, 1.04, bev=0.004, name='rim')
    A.box('dark', (0, 0.224, DP_Z / 2 + 0.04), (0.25, 0.004, DP_Z + 0.05), 0x1a1c1e, 1.0, name='hole', proxy=False)
    A.cyl('plastic', (0, -0.06, DP_Z), DP_R + 0.004, DP_R, 0.06, col, 0.98, seg=14, caps=False, name='socket')
    A.proxy_box((0, 0.11, DP_Z / 2 + 0.04), (0.28, 0.22, DP_Z + 0.1))


# ====================================================================== 楼的大门
def entrance(A, dw, dh, canopy, lh):
    """楼的大门（局部 +z 朝外，墙面在 z=0）：门斗（两侧石材门垛、门楣，门洞里暗）、铝合金地弹门两扇（推杠、踢脚板）、
    两侧固定玻璃、上亮子、安全出口灯；门口 lh 高的平台和台阶（防滑条）；canopy 时门斗上挑出雨棚（滴水线、筒灯、两根拉杆）。"""
    dep = 1.1
    W = dw + 0.5
    pw = 0.45
    STN = 0xd8d4cc
    FR = 0x2f363c
    lt = 0.30 if canopy else 0.20
    top = lh + dh
    # 门垛、门楣（石材，横竖分缝）
    for s in (-1, 1):
        A.box('stone', (s * (W / 2 + pw / 2), (top + lt) / 2, dep / 2), (pw, top + lt, dep), STN, 1.04, bev=0.012, name='pier')
    A.box('stone', (0, top + lt / 2, dep / 2), (W + 0.02, lt, dep), STN, 1.06, bev=0.012, name='lintel')
    if A.hi:
        for s in (-1, 1):
            for k in range(1, int((top + lt) / 0.6) + 1):
                A.box('dark', (s * (W / 2 + pw / 2), k * 0.6, dep + 0.0004), (pw - 0.01, 0.004, 0.002), 0x8a867e, 1.0, name='joint', proxy=False)
            A.box('dark', (s * (W / 2 + pw), (top + lt) / 2, dep / 2 + 0.3), (0.002, top + lt - 0.02, 0.004), 0x8a867e, 1.0, name='joint', proxy=False)
    # 门洞里：暗
    A.box('dark', (0, (lh + top) / 2, (dep - 0.16) / 2), (W, dh, dep - 0.16), 0x0e1316, 1.0, name='recess', proxy=False)
    # 门框
    zf = dep - 0.10
    for s in (-1, 1):
        A.box('metal', (s * (W / 2 - 0.04), (lh + top) / 2, zf), (0.08, dh, 0.10), FR, 1.02, bev=0.004, name='jamb')
    A.box('metal', (0, top - 0.04, zf), (W, 0.08, 0.10), FR, 1.02, bev=0.004, name='head')
    tr = top - 0.48
    A.box('metal', (0, tr, zf), (W - 0.16, 0.07, 0.10), FR, 1.02, bev=0.004, name='transom')
    dd = min(1.8, W * 0.46)
    for s in (-1, 1):
        A.box('metal', (s * (dd / 2 + 0.035), (lh + tr) / 2, zf), (0.07, tr - lh, 0.10), FR, 1.02, bev=0.004, name='mullion')
    # 上亮子、两侧固定玻璃
    A.box('glass', (0, (tr + 0.035 + top - 0.08) / 2, zf), (W - 0.16, top - 0.08 - tr - 0.035, 0.01), 0x5a7080, 1.0, name='glass_top', proxy=False)
    side = W / 2 - 0.08 - dd / 2 - 0.07
    for s in (-1, 1):
        cx = s * (dd / 2 + 0.07 + side / 2)
        A.box('metal', (cx, lh + 0.06, zf), (side, 0.12, 0.08), FR, 1.0, bev=0.003, name='side_rail')
        A.box('glass', (cx, (lh + 0.12 + tr - 0.035) / 2, zf), (side, tr - lh - 0.12 - 0.035, 0.01), 0x5a7080, 1.0, name='glass_side', proxy=False)
    # 两扇地弹门
    lw = dd / 2
    for s in (-1, 1):
        cx = s * lw / 2
        h0, h1 = lh + 0.004, tr - 0.04
        with A.at(cx, 0, zf + 0.01):
            for (x, y, w, h) in ((-lw / 2 + 0.05, (h0 + h1) / 2, 0.10, h1 - h0), (lw / 2 - 0.05, (h0 + h1) / 2, 0.10, h1 - h0),
                                 (0, h1 - 0.05, lw - 0.2, 0.10), (0, h0 + 0.11, lw - 0.2, 0.22)):
                A.box('metal', (x, y, 0), (w, h, 0.05), FR, 1.06, bev=0.004, name='leaf_frame', proxy=False)
            A.box('glass', (0, (h0 + 0.22 + h1 - 0.10) / 2, 0), (lw - 0.2, h1 - 0.10 - h0 - 0.22, 0.01), 0x5a7080, 1.0, name='leaf_glass', proxy=False)
            A.box('metal', (0, h0 + 0.11, 0.027), (lw - 0.22, 0.20, 0.002), 0xb8c0c2, 1.15, name='kick', proxy=False)
            A.rod('metal', (-lw / 2 + 0.12, lh + 1.0, 0.075), (lw / 2 - 0.12, lh + 1.0, 0.075), 0.016, 0.016, 0xc8ccd0, 1.2, seg=12, round_=0.006, name='push_bar', proxy=False)
            for xx in (-lw / 2 + 0.16, lw / 2 - 0.16):
                A.rod('metal', (xx, lh + 1.0, 0.025), (xx, lh + 1.0, 0.075), 0.01, 0.01, 0xb8c0c2, 1.1, seg=8, caps=False, name='standoff', proxy=False)
            if A.hi:
                A.box('metal', (s * (lw / 2 - 0.06), lh + 0.003, 0.0), (0.10, 0.004, 0.22), 0xb8c0c2, 1.1, name='floor_spring', proxy=False)
                A.cyl('metal', (-s * (lw / 2 - 0.06), lh + 1.0, 0.026), 0.012, 0.012, 0.01, 0xb8c0c2, 1.1, seg=10, dirn=(0, 0, 1), name='lock', proxy=False)
        A.proxy_box((cx, (h0 + h1) / 2, zf + 0.01), (lw, h1 - h0, 0.05))
    # 安全出口灯（门楣正面右边）
    A.box('plastic', (W * 0.26, top + lt / 2, dep + 0.025), (0.36, 0.14, 0.05), 0xe8e8e2, 1.0, bev=0.006, name='exit_box')
    A.box('emit', (W * 0.26, top + lt / 2, dep + 0.051), (0.32, 0.10, 0.002), 0x2fae6a, 1.0, name='exit_face', proxy=False)
    if not A.lo:
        A.box('emit', (W * 0.26 - 0.1, top + lt / 2, dep + 0.053), (0.06, 0.08, 0.001), 0xe8ffe8, 1.0, name='exit_man', proxy=False)
    # 平台、台阶（防滑条）
    fw = W + 2 * pw
    if lh > 0.01:
        A.box('stone', (0, lh / 2, (dep + 0.55) / 2), (fw, lh, dep + 0.55), 0xb8b2a8, 1.0, bev=0.01, name='landing')
        nst = max(1, int(round(lh / 0.15)))
        for k in range(1, nst):
            y = lh * (nst - k) / nst
            A.box('stone', (0, y / 2, dep + 0.55 + 0.32 * k - 0.16), (fw, y, 0.32), 0xb8b2a8, 1.0, bev=0.01, name='step')
        if not A.lo:
            for k in range(nst):
                y = lh * (nst - k) / nst
                z = dep + 0.55 + 0.32 * k - 0.04
                A.box('dark', (0, y + 0.0008, z), (fw - 0.2, 0.0016, 0.03), 0x3a3834, 1.0, name='nosing', proxy=False)
    # 雨棚
    if canopy:
        cy = top + lt + 0.11
        cd = dep + 0.9
        cw = fw + 0.6
        A.box('concrete', (0, cy, cd / 2), (cw, 0.22, cd), 0xc9c4bb, 1.04, bev=0.02, name='canopy')
        A.box('metal', (0, cy + 0.02, cd + 0.012), (cw + 0.02, 0.26, 0.024), 0x8a9298, 1.0, bev=0.004, name='fascia')
        A.box('plaster', (0, cy - 0.115, cd / 2), (cw - 0.1, 0.01, cd - 0.1), 0x8a5a52, 1.0, name='soffit', proxy=False)
        if A.hi:
            A.box('dark', (0, cy - 0.121, cd - 0.08), (cw - 0.2, 0.002, 0.01), 0x4a3a36, 1.0, name='drip', proxy=False)
        for s in (-1, 1):
            A.cyl('metal', (s * fw * 0.22, cy - 0.12, cd * 0.62), 0.07, 0.07, 0.008, 0x9aa0a4, 1.0, seg=14, dirn=(0, -1, 0), name='downlight', proxy=False)
            A.cyl('dead', (s * fw * 0.22, cy - 0.128, cd * 0.62), 0.055, 0.055, 0.002, 0xd8d8d0, 1.0, seg=14, dirn=(0, -1, 0), name='downlight_lens', proxy=False)
            if not A.lo:
                A.rod('metal', (s * fw * 0.36, cy + 1.25, 0.02), (s * fw * 0.36, cy + 0.08, cd - 0.15), 0.014, 0.014, 0x6a7074, 1.0, seg=8, name='tie_rod')
                A.box('metal', (s * fw * 0.36, cy + 1.25, 0.008), (0.10, 0.14, 0.016), 0x6a7074, 1.0, bev=0.003, name='tie_plate', proxy=False)
        A.tube('metal', [(cw / 2 - 0.15, cy, cd - 0.3), (cw / 2 + 0.12, cy - 0.04, cd - 0.3)], 0.025, 0x8a9298, 1.0, seg=8, name='spout', proxy=False)


ENTRANCES = [('entrance_col_420', 4.2, 2.4, False, 0.15), ('entrance_420', 4.2, 2.6, True, 0.30),
             ('entrance_300', 3.0, 2.6, True, 0.30), ('entrance_231', 2.31, 2.6, True, 0.30)]
for (_n, _dw, _dh, _cn, _lh) in ENTRANCES:
    asset(_n, ao=0.45, wall=0.0)(lambda A, dw=_dw, dh=_dh, cn=_cn, lh=_lh: entrance(A, dw, dh, cn, lh))


@asset('door_small_160', ao=0.4, wall=0.0)
def door_small_160(A):
    """平房的小铁门（局部 +z 朝外，墙面在 z=0）：门垛、门楣，子母门（凸起的门板花、执手和锁、合页），门上一块小雨棚，一级台阶。"""
    dw, dh, dep = 1.6, 2.15, 0.30
    STN = 0xd8d4cc
    for s in (-1, 1):
        A.box('stone', (s * (dw / 2 + 0.07), (dh + 0.16) / 2, dep / 2), (0.14, dh + 0.16, dep), STN, 1.04, bev=0.01, name='jamb')
    A.box('stone', (0, dh + 0.08, dep / 2), (dw + 0.28, 0.16, dep), STN, 1.05, bev=0.01, name='lintel')
    A.box('dark', (0, dh / 2, dep / 2 - 0.04), (dw, dh, dep - 0.08), 0x0e1316, 1.0, name='recess', proxy=False)
    zf = dep - 0.05
    FC, LC = 0x2e353c, 0x39424a
    big = dw * 0.64
    small = dw - big
    for (cx, w) in ((-dw / 2 + big / 2, big), (dw / 2 - small / 2, small)):
        A.box('metal', (cx, dh / 2, zf), (w - 0.012, dh - 0.02, 0.05), LC, 1.02, bev=0.004, name='leaf')
        if not A.lo:
            for (yy, hh) in ((0.55, 0.62), (1.45, 0.86)):
                A.box('metal', (cx, yy, zf + 0.027), (w - 0.18, hh, 0.006), 0x434c55, 1.04, bev=0.004, name='emboss', proxy=False)
                if A.hi:
                    A.box('metal', (cx, yy, zf + 0.031), (w - 0.26, hh - 0.08, 0.003), LC, 1.0, bev=0.002, name='emboss_in', proxy=False)
    A.box('metal', (-dw / 2 + big, dh / 2, zf + 0.03), (0.03, dh - 0.04, 0.012), FC, 1.0, name='astragal', proxy=False)
    hx = -dw / 2 + big - 0.08
    A.box('metal', (hx, 1.05, zf + 0.032), (0.045, 0.24, 0.012), 0xb8a060, 1.15, bev=0.004, name='escutcheon')
    A.rod('metal', (hx, 1.10, zf + 0.04), (hx - 0.12, 1.10, zf + 0.06), 0.009, 0.009, 0xc8b070, 1.2, seg=8, round_=0.004, name='lever', proxy=False)
    if A.hi:
        A.cyl('metal', (hx, 0.98, zf + 0.038), 0.011, 0.011, 0.006, 0xd8c890, 1.2, seg=10, dirn=(0, 0, 1), name='cylinder', proxy=False)
        for yy in (0.3, 1.0, 1.8):
            A.cyl('metal', (-dw / 2 + 0.02, yy, zf + 0.03), 0.012, 0.012, 0.12, 0x2a2f34, 1.0, seg=8, name='hinge', proxy=False)
    A.box('concrete', (0, dh + 0.30, 0.45), (dw + 0.8, 0.09, 0.9), 0xc9c4bb, 1.0, bev=0.012, name='canopy')
    if A.hi:
        A.box('dark', (0, dh + 0.2545, 0.86), (dw + 0.7, 0.001, 0.01), 0x5a5852, 1.0, name='drip', proxy=False)
    A.box('stone', (0, 0.07, 0.38), (dw + 0.9, 0.14, 0.76), 0xb8b2a8, 1.0, bev=0.01, name='step')


@asset('exhaust_hood', ao=0.4, ground=False, wall=0.0)
def exhaust_hood(A):
    """食堂外墙上的排油烟罩（原点在罩子底面中心的墙上）：不锈钢罩、前面的百叶、往上的风管（法兰、卡箍）、风帽，墙上两只角码，罩子底下一道油渍。"""
    SS = 0xb8bcbe
    A.box('metal', (0, 0.6, 0.4), (1.2, 1.2, 0.8), SS, 1.0, bev=0.02, name='hood')
    slats(A, 'metal', (0, 0.55, 0.8), 0.9, 0.7, 8 if A.hi else 4, 0x9aa0a4, depth=0.03, name='louver')
    A.cyl('metal', (0, 1.2, 0.4), 0.25, 0.25, 1.6, 0x9aa0a4, 1.0, seg=18, caps=False, name='duct')
    for yy in (1.22, 2.0, 2.78):
        A.cyl('metal', (0, yy, 0.4), 0.265, 0.265, 0.03, 0x8a9094, 1.0, seg=18, caps=False, name='flange', proxy=False)
    A.cyl('metal', (0, 2.82, 0.4), 0.36, 0.05, 0.18, 0x9aa0a4, 1.0, seg=18, name='cowl')
    for s in (-1, 1):
        A.box('metal', (s * 0.45, -0.18, 0.006), (0.06, 0.36, 0.012), 0x6a7074, 1.0, bev=0.002, name='bracket_plate', proxy=False)
        beam(A, 'metal', (s * 0.45, -0.34, 0.012), (s * 0.45, -0.01, 0.62), 0.04, 0.04, 0x6a7074, 1.0, bev=0.002, name='bracket', proxy=False)
        A.box('metal', (s * 0.45, -0.01, 0.40), (0.04, 0.02, 0.78), 0x6a7074, 1.0, name='bracket_arm', proxy=False)
