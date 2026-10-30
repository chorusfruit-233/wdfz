"""钟楼：四面的钟（单位半径，游戏里按钟面大小缩放）、塔身上两道竖长的尖拱窗（两种宽度）。
贴墙，局部 +z 朝外，墙面在 z=0。钟里吊的铜钟用 misc.py 的 bell_bronze 放大。"""
import math

from wdfz import asset
from assets.exterior import WIN_DARK

GOLD = 0xc8a24a
INK = 0x1a1a1a

# 罗马数字的笔画：在 (宽, 高=1) 的格子里，(x0, y0, x1, y1)
GLYPH = {
    'I': (0.22, [(0.11, 0.0, 0.11, 1.0)]),
    'V': (0.62, [(0.0, 1.0, 0.31, 0.0), (0.62, 1.0, 0.31, 0.0)]),
    'X': (0.62, [(0.0, 1.0, 0.62, 0.0), (0.62, 1.0, 0.0, 0.0)]),
}
NUMERALS = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI']


def stroke(A, x0, y0, x1, y1, w, z, col, name):
    L = math.hypot(x1 - x0, y1 - y0)
    a = math.atan2(y1 - y0, x1 - x0)
    A.box('dark', ((x0 + x1) / 2, (y0 + y1) / 2, z), (L + w * 0.6, w, 0.004), col, 1.0, rot=(0, 0, a), name=name, proxy=False)


@asset('tower_clock', ao=0.3, ground=False, wall=0.0)
def tower_clock(A):
    """钟面（半径 1）：金色的线脚外框、米白的盘面、分钟刻度圈、罗马数字（四点写 IIII）、铁铲形的时针停在十二点、
    细长带配重的分针停在十八分、中间的轴帽。"""
    A.lathe('metal', (0, 0, 0), [(1.0, 0.0), (1.18, 0.0), (1.18, 0.028), (1.15, 0.048), (1.07, 0.058), (1.0, 0.054)], GOLD, 1.15,
            seg=48, dirn=(0, 0, 1), cap0=False, cap1=False, name='frame', proxy=False)
    A.cyl('plaster', (0, 0, 0.0), 1.0, 1.0, 0.05, 0xe8e2d0, 1.0, seg=48, dirn=(0, 0, 1), name='dial', proxy=False)
    A.proxy_box((0, 0, 0.03), (2.36, 2.36, 0.06))
    z = 0.052
    if not A.lo:
        for r in (0.935, 0.86):
            pts = [(math.cos(t) * r, math.sin(t) * r, z) for t in [i / 48 * 2 * math.pi for i in range(48)]]
            A.tube('dark', pts, 0.004, INK, 1.0, seg=3, closed=True, name='chapter', proxy=False)
    nt = 60 if A.L <= 1 else 12
    for k in range(nt):
        a = math.pi / 2 - k / nt * 2 * math.pi
        big = (k % 5 == 0) if nt == 60 else True
        r0, r1 = (0.862, 0.935) if big else (0.88, 0.92)
        stroke(A, math.cos(a) * r0, math.sin(a) * r0, math.cos(a) * r1, math.sin(a) * r1, 0.02 if big else 0.008, z, INK, 'tick')
    if A.L <= 1:
        h = 0.15
        for k, txt in enumerate(NUMERALS):
            th = math.pi / 2 - k * math.pi / 6
            gap = 0.07 * h
            width = sum(GLYPH[c][0] * h for c in txt) + gap * (len(txt) - 1)
            with A.at(math.cos(th) * 0.70, math.sin(th) * 0.70, 0, rz=th - math.pi / 2):
                x = -width / 2
                for c in txt:
                    gw, strokes = GLYPH[c]
                    for (x0, y0, x1, y1) in strokes:
                        stroke(A, x + x0 * h, y0 * h - h / 2, x + x1 * h, y1 * h - h / 2, 0.022, z, INK, 'numeral')
                    x += gw * h + gap
                if txt in ('XII', 'VI', 'III', 'IX') and A.L == 0:
                    for s in (-1, 1):
                        stroke(A, -width / 2 - 0.01, s * (h / 2 + 0.012), width / 2 + 0.01, s * (h / 2 + 0.012), 0.008, z, INK, 'serif')
    # 指针：时针十二点，分针十八分
    zh = 0.062
    with A.at(0, 0, zh):
        A.prism('dark', (0, 0, 0), [(-0.035, -0.12), (0.035, -0.12), (0.03, 0.30), (0.08, 0.38), (0.0, 0.52), (-0.08, 0.38), (-0.03, 0.30)],
                0.012, 0x15140f, 1.0, name='hour_hand', proxy=False)
    with A.at(0, 0, zh + 0.014, rz=-108 / 360 * 2 * math.pi):
        A.prism('dark', (0, 0, 0), [(-0.05, -0.24), (0.05, -0.24), (0.05, -0.16), (0.018, -0.12), (0.014, 0.80), (0.0, 0.86), (-0.014, 0.80), (-0.018, -0.12), (-0.05, -0.16)],
                0.01, 0x15140f, 1.0, name='minute_hand', proxy=False)
    A.cyl('metal', (0, 0, zh - 0.01), 0.05, 0.04, 0.05, GOLD, 1.2, seg=16, round_=0.008, dirn=(0, 0, 1), name='boss', proxy=False)


def arch_window(A, W, H):
    """尖拱窗（原点在窗台面的中心）：石材的窗套（两侧竖的、上面两段弧拼成尖拱、拱顶一块楔石）、窗台、
    里面的暗面和蒙尘的玻璃、铁窗棂（竖梃、一道道横档，拱里跟着弧收窄）。"""
    T, D = 0.20, 0.15
    rise = W * math.sqrt(3) / 2
    hs = H - rise
    STN = 0xd8d4cb
    n = (10, 7, 4, 3)[A.L]

    def arch_x(y, r):
        """拱里高 y 处，半径 r 的两条弧之间的半宽。"""
        if y <= hs:
            return W / 2 + (r - W)
        dy = y - hs
        if dy >= r:
            return 0.0
        return max(0.0, math.sqrt(r * r - dy * dy) - W / 2)
    # 暗面、玻璃：尖拱轮廓（右边的弧圆心在左起拱点，左边的弧圆心在右起拱点）
    outline = [(-W / 2, 0.0), (W / 2, 0.0), (W / 2, hs)]
    for k in range(1, n):
        t = (math.pi / 3) * k / n
        outline.append((-W / 2 + W * math.cos(t), hs + W * math.sin(t)))
    outline.append((0.0, H))
    for k in range(n - 1, 0, -1):
        t = math.pi - (math.pi / 3) * k / n
        outline.append((W / 2 + W * math.cos(t), hs + W * math.sin(t)))
    outline.append((-W / 2, hs))
    A.prism('dark', (0, 0, 0.005), outline, 0.01, WIN_DARK, 0.85, name='inside', proxy=False)
    A.prism('glass', (0, 0, 0.03), outline, 0.006, 0x5a6a70, 0.9, name='glass', proxy=False)
    A.proxy_box((0, H / 2, 0.05), (W + 2 * T, H, 0.1))
    # 窗套：两侧竖的
    for s in (-1, 1):
        A.box('stone', (s * (W / 2 + T / 2), hs / 2, D / 2), (T, hs, D), STN, 1.03, bev=0.012, name='jamb', proxy=False)
    # 尖拱：每边 n 段，每段一个四边形挤出（内弧半径 W，外弧半径 W+T，圆心在对面的起拱点）
    ro = W + T
    ta_o = math.acos(-(W / 2) / ro)
    for side in (-1, 1):
        for k in range(n):
            t0 = math.pi - (math.pi / 3) * k / n
            t1 = math.pi - (math.pi / 3) * (k + 1) / n
            u0 = math.pi - (math.pi - ta_o) * k / n
            u1 = math.pi - (math.pi - ta_o) * (k + 1) / n
            q = [(W / 2 + W * math.cos(t0), hs + W * math.sin(t0)), (W / 2 + ro * math.cos(u0), hs + ro * math.sin(u0)),
                 (W / 2 + ro * math.cos(u1), hs + ro * math.sin(u1)), (W / 2 + W * math.cos(t1), hs + W * math.sin(t1))]
            if side > 0:
                q = [(-x, y) for (x, y) in q]
            A.prism('stone', (0, 0, D / 2), q, D, STN, 1.05, name='arch', proxy=False)
    if not A.lo:
        A.prism('stone', (0, 0, D / 2 + 0.02), [(-0.13, H - 0.10), (0.13, H - 0.10), (0.17, H + 0.24), (-0.17, H + 0.24)], D + 0.04, 0xc8c2b6, 1.06,
                bev=0.01, name='keystone', proxy=False)
    # 窗台
    A.box('stone', (0, -0.06, 0.11), (W + 2 * T + 0.1, 0.12, 0.22), STN, 1.05, bev=0.012, name='sill', proxy=False)
    # 铁窗棂
    BAR = 0x2a2e30
    nm = 2 if W < 3 else 3
    for k in range(1, nm + 1):
        x = -W / 2 + W * k / (nm + 1)
        top = hs + math.sqrt(max(0.0, W * W - (W / 2 + abs(x)) ** 2))
        A.box('metal', (x, top / 2, 0.035), (0.035, top, 0.03), BAR, 1.0, name='mullion', proxy=False)
    y = 0.6
    while y < H - 0.2:
        hw = arch_x(y, W)
        if hw > 0.05:
            A.box('metal', (0, y, 0.035), (hw * 2, 0.03, 0.03), BAR, 1.0, name='transom', proxy=False)
        y += 0.6 if A.L <= 1 else 1.2


asset('tower_window_231', ao=0.3, ground=False, wall=0.0)(lambda A: arch_window(A, 2.31, 7.6))
asset('tower_window_418', ao=0.3, ground=False, wall=0.0)(lambda A: arch_window(A, 4.18, 7.6))


@asset('bell_roof', ao=0.5, ground=False)
def bell_roof(A):
    """钟楼亭子的庑殿顶（按钟楼 11.56×20.89 米的平面建，檐口 12.95×23.40，原点在檐板顶面中心）：
    四坡屋面（筒瓦一垄垄）、正脊和四条垂脊（脊筒、两头的鸱吻）、檐口封檐板、正中的宝顶。"""
    W, L, H = 12.95, 23.40, 4.0
    hw, hl = W / 2, L / 2
    rl = hl - hw                     # 正脊半长
    ROOF = 0x7a4c46
    RIDGE = 0x5e3a35
    t = 0.18
    # 四坡：两个梯形、两个三角形，各有厚度（挤出），坡面朝外
    faces = [
        [(-hw, 0, -hl), (-hw, 0, hl), (0, H, rl), (0, H, -rl)],
        [(hw, 0, hl), (hw, 0, -hl), (0, H, -rl), (0, H, rl)],
        [(-hw, 0, hl), (hw, 0, hl), (0, H, rl)],
        [(hw, 0, -hl), (-hw, 0, -hl), (0, H, -rl)],
    ]
    for f in faces:
        verts = list(f) + [(x, y - t, z) for (x, y, z) in f]
        n = len(f)
        fl = [list(range(n)), list(range(2 * n - 1, n - 1, -1))]
        for i in range(n):
            j = (i + 1) % n
            fl.append([i, n + i, n + j, j])
        A.mesh('concrete', verts, fl, ROOF, 1.0, smooth=False, name='roof')
    A.proxy_box((0, H / 2, 0), (W, H, L))
    # 筒瓦：顺坡一垄垄（长坡两面）
    gap = (0.30, 0.45, 0.9, 0)[A.L]
    if gap:
        for s in (-1, 1):
            k = 0
            z = -hl + gap / 2
            while z < hl:
                # 这一垄从檐口到它碰到的脊或垂脊
                zt = max(-rl, min(rl, z))
                hz = abs(z)
                if hz <= rl:
                    top = (0.0, H, z)
                else:
                    f = (hl - hz) / (hl - rl)
                    top = (s * hw * (1 - f), H * f, z)
                A.rod('concrete', (s * hw, 0.02, z), (top[0] + s * 0.02, top[1] + 0.02, top[2]), 0.045, 0.045, ROOF, 1.06 if k % 2 else 0.97, seg=4, caps=False, name='tile_row', proxy=False)
                z += gap
                k += 1
    # 正脊、垂脊
    A.rod('concrete', (0, H + 0.08, -rl - 0.1), (0, H + 0.08, rl + 0.1), 0.16, 0.16, RIDGE, 1.0, seg=8, name='ridge', proxy=False)
    for (sx, sz) in ((-1, -1), (-1, 1), (1, -1), (1, 1)):
        A.rod('concrete', (sx * (hw + 0.1), 0.08, sz * (hl + 0.1)), (0, H + 0.06, sz * rl), 0.12, 0.10, RIDGE, 1.0, seg=8, name='hip', proxy=False)
        if not A.lo:
            A.cyl('concrete', (sx * (hw + 0.1), 0.0, sz * (hl + 0.1)), 0.16, 0.10, 0.45, RIDGE, 1.0, seg=8, name='hip_end', proxy=False)
    if not A.lo:
        for sz in (-1, 1):
            A.prism('concrete', (0, H + 0.2, sz * (rl + 0.05)), [(-0.12, 0.0), (0.12, 0.0), (0.16, 0.25), (0.05, 0.75), (-0.1, 0.6), (-0.16, 0.3)], 0.22, RIDGE, 1.0,
                    rot=(0, math.pi / 2, 0), name='chiwen', proxy=False)
    # 封檐板
    for (x, z, sx, sz) in ((0, hl + 0.02, W + 0.06, 0.04), (0, -hl - 0.02, W + 0.06, 0.04), (hw + 0.02, 0, 0.04, L + 0.06), (-hw - 0.02, 0, 0.04, L + 0.06)):
        A.box('wood', (x, -0.08, z), (sx, 0.22, sz), 0x5a3a2a, 0.9, name='fascia', proxy=False)
    # 宝顶
    A.lathe('metal', (0, H + 0.2, 0), [(0.0, 0.0), (0.22, 0.0), (0.26, 0.1), (0.16, 0.3), (0.2, 0.5), (0.08, 0.8), (0.05, 1.3), (0.0, 1.45)], 0xc8a24a, 1.2, seg=12, name='finial')
