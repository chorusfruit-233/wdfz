"""车库的三厢轿车、挡车器，车棚的电动车。车头朝局部 +x。车身颜色用标签 body 染色。"""
import math

from wdfz import asset, lerp
from assets._parts import BLACK, CHROME

BODY = 0x39424a


def pw(pts, x):
    """分段线性插值。"""
    if x <= pts[0][0]:
        return pts[0][1]
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]
        if a[0] <= x <= b[0]:
            t = (x - a[0]) / (b[0] - a[0])
            return a[1] + (b[1] - a[1]) * t
    return pts[-1][1]


TOP = [(-1.89, 0.62), (-1.86, 0.80), (-1.74, 0.905), (-1.45, 0.93), (-1.25, 0.935), (0.95, 0.885), (1.35, 0.85), (1.62, 0.81), (1.80, 0.76), (1.89, 0.66)]
BOT = [(-1.89, 0.40), (-1.84, 0.33), (-1.70, 0.30), (1.70, 0.30), (1.84, 0.33), (1.89, 0.40)]
ROOF = [(-1.27, 0.93), (-1.10, 1.17), (-0.86, 1.385), (-0.50, 1.42), (-0.10, 1.425), (0.22, 1.39), (0.55, 1.15), (0.95, 0.875)]


def spline(pts, x):
    """单调三次插值（Fritsch–Carlson）：过每个点、不冲过头，轮廓线是顺的。"""
    n = len(pts)
    if x <= pts[0][0]:
        return pts[0][1]
    if x >= pts[-1][0]:
        return pts[-1][1]
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    d = [(ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]) for i in range(n - 1)]
    m = [d[0]] + [0.0] * (n - 2) + [d[-1]]
    for i in range(1, n - 1):
        m[i] = 0.0 if d[i - 1] * d[i] <= 0 else (d[i - 1] + d[i]) / 2
    for i in range(n - 1):
        if d[i] == 0:
            m[i] = m[i + 1] = 0
        else:
            a, b = m[i] / d[i], m[i + 1] / d[i]
            h = a * a + b * b
            if h > 9:
                t = 3 / math.sqrt(h)
                m[i], m[i + 1] = t * a * d[i], t * b * d[i]
    for i in range(n - 1):
        if xs[i] <= x <= xs[i + 1]:
            hh = xs[i + 1] - xs[i]
            t = (x - xs[i]) / hh
            h00, h10, h01, h11 = 2 * t ** 3 - 3 * t ** 2 + 1, t ** 3 - 2 * t ** 2 + t, -2 * t ** 3 + 3 * t ** 2, t ** 3 - t ** 2
            return h00 * ys[i] + h10 * hh * m[i] + h01 * ys[i + 1] + h11 * hh * m[i + 1]
    return ys[-1]


def half_w(x):
    """平面上的半宽：中间 0.88；车头、车尾按超椭圆收（前脸、后脸是平的、四角圆）。"""
    if x > 1.48:
        t = min(1.0, (x - 1.48) / 0.41)
    elif x < -1.52:
        t = min(1.0, (-1.52 - x) / 0.37)
    else:
        return 0.88
    return max(0.02, 0.88 * (1 - t ** 4) ** 0.25)


def arc(cz, cy, r, a0, a1, n):
    return [(cz + math.cos(a0 + (a1 - a0) * k / n) * r, cy + math.sin(a0 + (a1 - a0) * k / n) * r) for k in range(n + 1)]


def body_half(x, L):
    """车身截面的右半（z>0）：从底中间往外、圆的下角、侧面（中间略鼓、上面往里收）、圆的肩、略拱的顶面，到顶中间。"""
    na = (6, 4, 3, 1)[L]
    yb, yt, w = spline(BOT, x), spline(TOP, x), half_w(x)
    h = yt - yb
    rb = min(0.05, w * 0.4, h * 0.2)
    rt = min(0.13, w * 0.45, h * 0.45)
    tum = min(0.04, w * 0.1)
    pts = [(0.0, yb)]
    pts += [(w * 0.5, yb)]
    pts += arc(w - rb, yb + rb, rb, -math.pi / 2, 0, na)[0:]
    ns = (6, 4, 3, 2)[L]
    y0, y1 = yb + rb, yt - rt
    for k in range(1, ns):
        t = k / ns
        bul = 0.012 * math.sin(t * math.pi) * min(1.0, w / 0.5)
        pts.append((w - tum * t * t + bul, y0 + (y1 - y0) * t))
    pts += arc(w - tum - rt, yt - rt, rt, 0, math.pi / 2, na + 1)
    xt = w - tum - rt
    nt = (6, 4, 3, 1)[L]
    for k in range(1, nt):
        z = xt * (1 - k / nt)
        pts.append((z, yt + 0.014 * (1 - (z / max(xt, 1e-3)) ** 2)))
    pts.append((0.0, yt + 0.014))
    return pts


def ring_from_half(x, half, closed=True):
    """右半 → 整圈（先往 -z 那侧走上去，再从 +z 那侧下来：从外面看是逆时针，法线朝外）。"""
    left = [(x, y, -z) for (z, y) in half[1:-1]]
    right = [(x, y, z) for (z, y) in reversed(half[1:-1])]
    return [(x, half[0][1], 0.0)] + left + [(x, half[-1][1], 0.0)] + right


GL_W = 0.745


def glass_half(x, L):
    """车舱截面右半（不封底）：从腰线往上（侧窗往里收）、圆角、顶。返回点和各段的起止。"""
    yb = spline(TOP, x) - 0.012
    yr = max(yb + 0.002, spline(ROOF, x))
    # 车顶半宽 0.60；往前挡风玻璃、往后后窗的下端逐渐放宽到腰线宽，A、C 柱的根才落在车身边上
    if x > 0.22:
        k = min(1.0, (x - 0.22) / 0.73)
    elif x < -0.86:
        k = min(1.0, (-0.86 - x) / 0.41)
    else:
        k = 0.0
    wr = 0.60 + (GL_W - 0.03 - 0.60) * (k * k * (3 - 2 * k))
    h = yr - yb
    rc = min(0.07, h * 0.5)
    ns, nc, nt = (6, 4, 3, 2)[L], (5, 3, 2, 1)[L], (5, 3, 2, 1)[L]
    pts = []
    for k in range(ns):
        t = k / ns
        y = yb + (yr - rc - yb) * t
        pts.append((GL_W + (wr - GL_W) * t, y))
    pts += arc(wr - rc, yr - rc, rc, 0, math.pi / 2, nc)
    for k in range(1, nt):
        z = (wr - rc) * (1 - k / nt)
        pts.append((z, yr + 0.01 * (1 - (z / (wr - rc)) ** 2)))
    pts.append((0.0, yr + 0.01))
    return pts, ns, nc, nt


def open_ring(x, half):
    left = [(x, y, -z) for (z, y) in half[:-1]]
    right = [(x, y, z) for (z, y) in reversed(half[:-1])]
    return left + [(x, half[-1][1], 0.0)] + right


def stations(x0, x1, n, ends=True):
    xs = []
    for i in range(n + 1):
        t = i / n
        if ends:
            t = 0.5 - 0.5 * math.cos(t * math.pi)
        xs.append(x0 + (x1 - x0) * t)
    return xs


def offset_strip(rows, d):
    """一片放样面（若干行点）沿近似法线往外挪 d：贴在玻璃外面的车顶、B 柱。"""
    out = []
    for row in rows:
        r2 = []
        for i, p in enumerate(row):
            a = row[max(0, i - 1)]
            b = row[min(len(row) - 1, i + 1)]
            tz, ty = b[2] - a[2], b[1] - a[1]
            l = math.hypot(tz, ty) or 1.0
            nz, ny = ty / l, -tz / l
            if ny < 0 or (abs(ny) < 1e-6 and nz * p[2] < 0):
                nz, ny = -nz, -ny
            r2.append((p[0], p[1] + ny * d, p[2] + nz * d))
        out.append(r2)
    return out


def wheel(A, x, side, lo):
    """一个车轮：轮胎（胎侧鼓起、胎面三道沟）、五辐轮辋、轮毂盖、刹车盘。side=+1 外面朝 +z。"""
    z = side * 0.855
    with A.at(x, 0.33, z, ry=0 if side > 0 else math.pi):
        tire = [(0.215, -0.092), (0.29, -0.097), (0.318, -0.088), (0.33, -0.065), (0.332, -0.04)]
        if A.L <= 1:
            for g in (-0.025, 0.0, 0.025):
                tire += [(0.332, g - 0.007), (0.326, g - 0.005), (0.326, g + 0.005), (0.332, g + 0.007)]
        tire += [(0.332, 0.04), (0.33, 0.065), (0.318, 0.088), (0.29, 0.097), (0.215, 0.092)]
        A.lathe('dark', (0, 0, 0), tire, 0x15181b, 1.0, seg=28 if not lo else 12, sharp=50, dirn=(0, 0, 1), cap0=False, cap1=False, name='tire', proxy=False)
        A.lathe('metal', (0, 0, 0), [(0.215, 0.085), (0.222, 0.092), (0.214, 0.096), (0.196, 0.09), (0.19, 0.03)], 0x9aa2a8, 1.15, seg=28 if not lo else 12, dirn=(0, 0, 1), cap0=False, cap1=False, name='rim', proxy=False)
        A.cyl('dark', (0, 0, 0.0), 0.19, 0.19, 0.035, 0x1a1d20, 1.0, seg=24 if not lo else 10, dirn=(0, 0, 1), name='rim_back', proxy=False)
        if not lo:
            if A.L <= 2:
                A.cyl('metal', (0, 0, 0.008), 0.15, 0.15, 0.01, 0x5a6268, 1.0, seg=24, dirn=(0, 0, 1), name='disc', proxy=False)
            for k in range(5):
                a = k / 5 * 2 * math.pi + 0.3
                ca, sa = math.cos(a), math.sin(a)
                A.rod('metal', (ca * 0.05, sa * 0.05, 0.07), (ca * 0.195, sa * 0.195, 0.085), 0.024, 0.014, 0xb8c0c4, 1.2, seg=6, name='spoke', proxy=False)
            A.cyl('metal', (0, 0, 0.06), 0.06, 0.05, 0.03, 0x707880, 1.2, seg=16, round_=0.008, dirn=(0, 0, 1), name='hub', proxy=False)
            if A.hi:
                for k in range(5):
                    a = k / 5 * 2 * math.pi
                    A.cyl('metal', (math.cos(a) * 0.035, math.sin(a) * 0.035, 0.088), 0.007, 0.006, 0.008, 0xd0d6da, 1.2, seg=8, dirn=(0, 0, 1), name='nut', proxy=False)
        else:
            A.cyl('metal', (0, 0, 0.06), 0.18, 0.18, 0.03, 0x9aa2a8, 1.15, seg=10, dirn=(0, 0, 1), name='hubcap', proxy=False)


@asset('car_sedan', ao=0.6, tints={'body': BODY}, inst=True)
def car_sedan(A):
    """三厢轿车（长 3.78、宽 1.76、高 1.43）：圆角截面放样的车身（肩部圆、腰线以上往里收、前后脸平而四角圆），
    布尔切出的轮拱和黑色内衬；玻璃车舱（侧窗往里收），贴着玻璃的车顶、A/B/C 柱；门缝、门把、后视镜、
    嵌在车身里的大灯和尾灯、格栅、蓝牌、上下护板、雨刮、排气管；车里有仪表台、方向盘、前排座椅、后排长座。"""
    lo = A.lo
    L = A.L
    n = (64, 44, 28, 12)[L]
    xs = stations(-1.89, 1.89, n)
    rings = [ring_from_half(x, body_half(x, L)) for x in xs]
    body = A.loft('metal', rings, 0xffffff, 1.04, cap0=True, cap1=True, tag='body', name='body')
    for wx in (1.24, -1.20):
        A.cut_cylinder(body, (wx, 0.33, 0), 0.405, 2.4, axis='z', seg=56 if not lo else 16)
    for wx in (1.24, -1.20):
        for side in (-1, 1):
            m = 18 if not lo else 6
            verts, faces = [], []
            for i in range(m + 1):
                a = math.pi * i / m
                for z in (0.55, 0.875):
                    verts.append((wx + math.cos(a) * 0.40, 0.33 + math.sin(a) * 0.40, side * z))
            for i in range(m):
                a0, a1 = i * 2, (i + 1) * 2
                f = (a0, a0 + 1, a1 + 1, a1)
                faces.append(f if side > 0 else f[::-1])
            A.mesh('dark', verts, faces, 0x0c0e10, 1.0, smooth=True, sharp=None, name='liner')
    # 玻璃车舱
    gn = (40, 28, 16, 7)[L]
    gx = stations(-1.27, 0.95, gn, ends=False)
    G = [glass_half(x, L) for x in gx]
    A.loft('glass', [open_ring(x, g[0]) for x, g in zip(gx, G)], 0x141c24, 1.2, closed=False, name='glass')
    # 车顶：玻璃顶上那一段往外挪 6 毫米（车身色）
    rx = stations(-0.86, 0.22, (14, 10, 6, 3)[L], ends=False)
    rows = []
    for x in rx:
        half, ns, nc, nt = glass_half(x, L)
        top = half[ns + nc // 2:]
        rows.append([(x, y, -z) for (z, y) in top[:-1]] + [(x, top[-1][1], 0.0)] + [(x, y, z) for (z, y) in reversed(top[:-1])])
    A.loft('metal', offset_strip(rows, 0.006), 0xffffff, 1.06, closed=False, tag='body', name='roof')
    # A、C 柱：顺着玻璃的圆角走；B 柱：侧窗上的一条
    for s in (-1, 1):
        for (x0, x1, r, nm) in ((0.22, 0.94, 0.028, 'a_pillar'), (-1.26, -0.86, 0.045, 'c_pillar')):
            pts = []
            for x in stations(x0, x1, 8 if not lo else 3, ends=False):
                half, ns, nc, nt = glass_half(x, L)
                z, y = half[ns + nc // 2]
                pts.append((x, y + 0.006, s * (z + 0.006)))
            A.tube('metal', pts, r, 0xffffff, 1.0, seg=8 if not lo else 4, tag='body', name=nm, proxy=False, ellip=0.6)
        rows = []
        for x in (-0.345, -0.30, -0.255):
            half, ns, nc, nt = glass_half(x, L)
            side_pts = half[:ns + 1]
            rows.append([(x, y, s * z) for (z, y) in side_pts])
        strip = offset_strip([[(p[0], p[1], abs(p[2])) for p in r] for r in rows], 0.005)
        strip = [[(p[0], p[1], s * p[2]) for p in r] for r in strip]
        if s < 0:
            strip = [list(reversed(r)) for r in strip]
        A.loft('metal', strip, 0xffffff, 1.0, closed=False, tag='body', name='b_pillar')
        A.tube('plastic', [(-1.24, spline(TOP, -1.24) + 0.004, s * (GL_W + 0.012)), (0.0, spline(TOP, 0.0) + 0.004, s * (GL_W + 0.012)), (0.93, spline(TOP, 0.93) + 0.004, s * (GL_W + 0.012))], 0.008, 0x15191c, 1.0, seg=6, name='belt_trim', proxy=False)
    # 门缝、门把、侧裙、后视镜
    for s in (-1, 1):
        if not lo:
            for x in (-0.15, 0.88, -1.12):
                half = body_half(x, L)
                pts = [(x, y, s * (z + 0.0035)) for (z, y) in half if z > 0.5 and 0.40 < y < spline(TOP, x) - 0.03]
                if len(pts) >= 2:
                    pts.sort(key=lambda q: q[1])
                    A.tube('dark', pts, 0.0035, 0x0c0e10, 1.0, seg=4, name='seam', proxy=False)
        for x in (0.55, -0.68):
            A.box('metal', (x, 0.80, s * 0.876), (0.14, 0.025, 0.02), 0xffffff, 1.3, bev=0.006, tag='body', name='handle', proxy=False)
        A.box('plastic', (0.02, 0.335, s * 0.862), (1.92, 0.07, 0.04), 0x15191c, 1.0, bev=0.012, name='skirt', proxy=False)
        with A.at(0.80, 0.985, s * 0.94):
            A.cushion('plastic', (0, 0, 0), (0.12, 0.10, 0.15), 0xffffff, 0.75, puff=0.2, r=0.02, tag='body', name='mirror', proxy=False)
            A.box('glass', (-0.061, 0, 0), (0.004, 0.08, 0.12), 0x6a8090, 1.2, name='mirror_glass', proxy=False)
        A.rod('plastic', (0.84, 0.95, s * 0.86), (0.81, 0.975, s * 0.89), 0.014, 0.012, 0x15191c, 1.0, seg=6, name='mirror_arm', proxy=False)
    # 车灯（一半嵌在车身里，露出来的是灯罩）
    for s in (-1, 1):
        with A.at(1.82, 0.71, s * 0.62, ry=-s * 0.45):
            A.cushion('glass', (0, 0, 0), (0.16, 0.085, 0.30), 0xc8d4dc, 1.2, puff=0.1, r=0.02, name='headlamp', proxy=False)
            A.box('metal', (-0.02, 0, 0), (0.10, 0.06, 0.26), 0xb8c2c8, 1.2, bev=0.01, name='reflector', proxy=False)
            A.box('emit', (0.03, 0.0, 0.0), (0.02, 0.03, 0.10), 0xa8b0b4, 0.5, name='bulb', proxy=False)
        with A.at(-1.84, 0.80, s * 0.62, ry=s * 0.40):
            A.cushion('emit', (0, 0, 0), (0.12, 0.13, 0.30), 0x7a1c16, 1.0, puff=0.08, r=0.02, name='taillamp', proxy=False)
            if not lo:
                A.box('emit', (-0.045, -0.035, -s * 0.06), (0.04, 0.035, 0.10), 0x9a8a80, 0.6, name='reverse', proxy=False)
    # 格栅、车标、牌照、前后下护板、排气管、雨刮
    A.box('dark', (1.865, 0.55, 0), (0.06, 0.13, 0.78), 0x0d1013, 1.0, bev=0.01, name='grille', proxy=False)
    if not lo:
        for k in range(4):
            A.box('metal', (1.895, 0.505 + k * 0.03, 0), (0.006, 0.008, 0.74), 0x5a6266, 1.1, name='grille_bar', proxy=False)
        A.cyl('metal', (1.892, 0.625, 0), 0.04, 0.04, 0.01, 0xb8c0c4, 1.2, seg=16, dirn=(1, 0, 0), name='badge', proxy=False)
    for (x, y, dirx) in ((1.894, 0.40, 1), (-1.894, 0.50, -1)):
        A.box('paper', (x, y, 0), (0.01, 0.14, 0.44), 0x2a5a9a, 1.0, bev=0.002, name='plate', proxy=False)
        if L <= 2:
            for k in range(7):
                A.box('paper', (x + dirx * 0.0055, y, -0.17 + k * 0.056 + (0.015 if k > 1 else 0)), (0.002, 0.08, 0.034), 0xe8eef0, 1.0, name='char', proxy=False)
    A.box('plastic', (1.85, 0.345, 0), (0.07, 0.07, 1.10), 0x15191c, 1.0, bev=0.02, name='splitter', proxy=False)
    A.box('plastic', (-1.855, 0.39, 0), (0.07, 0.08, 1.10), 0x15191c, 1.0, bev=0.02, name='diffuser', proxy=False)
    A.rod('metal', (-1.84, 0.27, -0.55), (-1.95, 0.27, -0.55), 0.03, 0.03, 0x5a5e62, 1.0, seg=10, name='exhaust', proxy=False)
    for z0, z1 in ((-0.58, -0.06), (0.06, 0.58)):
        A.rod('dark', (0.97, 0.90, z0), (0.93, 0.925, z1), 0.008, 0.007, 0x0c0e10, 1.0, seg=5, name='wiper', proxy=False)
    for wx in (1.24, -1.20):
        for side in (-1, 1):
            wheel(A, wx, side, lo)
    # 车里
    if not lo:
        A.box('plastic', (0.66, 0.92, 0), (0.32, 0.12, 1.40), 0x15181b, 1.0, bev=0.03, name='dash', proxy=False)
        for s in (-1, 1):
            A.cushion('fabric', (0.18, 0.62, s * 0.36), (0.48, 0.12, 0.46), 0x24282c, 1.0, puff=0.15, r=0.03, name='seat', proxy=False)
            with A.at(-0.08, 0.92, s * 0.36, rz=0.18):
                A.cushion('fabric', (0, 0, 0), (0.10, 0.52, 0.44), 0x24282c, 1.0, puff=0.15, r=0.03, name='seat_back', proxy=False)
            A.cushion('fabric', (-0.10, 1.24, s * 0.36), (0.08, 0.14, 0.22), 0x24282c, 1.0, puff=0.2, r=0.02, name='headrest', proxy=False)
        A.cushion('fabric', (-0.76, 0.62, 0), (0.46, 0.12, 1.36), 0x24282c, 1.0, puff=0.12, r=0.03, name='bench', proxy=False)
        with A.at(-1.00, 0.92, 0, rz=0.2):
            A.cushion('fabric', (0, 0, 0), (0.10, 0.50, 1.36), 0x24282c, 1.0, puff=0.12, r=0.03, name='bench_back', proxy=False)
        with A.at(0.50, 1.00, 0.36, rz=1.2):
            m = 24 if L <= 1 else 12
            pts = [(math.cos(k / m * 2 * math.pi) * 0.17, 0, math.sin(k / m * 2 * math.pi) * 0.17) for k in range(m)]
            A.tube('plastic', pts, 0.016, 0x0c0e10, 1.0, seg=8, closed=True, name='steering', proxy=False)
            A.rod('plastic', (0, 0, 0), (0, -0.12, 0), 0.025, 0.03, 0x0c0e10, 1.0, seg=8, name='column', proxy=False)
    # 碰撞代理：车身、车舱、四个轮子
    A.proxy_box((0, 0.615, 0), (3.78, 0.63, 1.76))
    A.proxy_box((-0.16, 1.17, 0), (2.18, 0.52, 1.50))
    for wx in (1.24, -1.20):
        for side in (-1, 1):
            A.proxy_rod((wx, 0.33, side * 0.76), (wx, 0.33, side * 0.95), 0.33)


@asset('wheel_stop', ao=0.3, inst=True)
def wheel_stop(A):
    """挡车器：水泥块刷黄漆、两道黑色反光条、两颗地脚螺栓。长边沿 z。"""
    A.box('concrete', (0, 0.045, 0), (0.14, 0.09, 0.50), 0xc8a830, 1.0, bev=0.02, name='block')
    if not A.lo:
        for z in (-0.12, 0.12):
            A.box('paper', (0, 0.0905, z), (0.10, 0.002, 0.08), 0x1a1a18, 1.0, name='stripe', proxy=False)
            A.box('paper', (0.0705, 0.05, z), (0.002, 0.05, 0.08), 0x1a1a18, 1.0, name='stripe', proxy=False)
            A.box('paper', (-0.0705, 0.05, z), (0.002, 0.05, 0.08), 0x1a1a18, 1.0, name='stripe', proxy=False)
        for z in (-0.20, 0.20):
            A.cyl('metal', (0, 0.09, z), 0.012, 0.011, 0.008, 0x8a8a84, 1.0, seg=8, name='bolt', proxy=False)


@asset('ebike', ao=0.4, tints={'body': 0x3a4a5a}, inst=True)
def ebike(A):
    """电动车：后半截车身（座垫下面是电池仓）、前护板、踏板、两个小轮子（胎、轮毂、刹车鼓）、前叉、车把、把套、后视镜、大灯、尾灯。"""
    lo = A.lo
    A.prism('plastic', (0, 0, 0), [(-0.70, 0.34), (-0.10, 0.34), (-0.10, 0.56), (-0.30, 0.80), (-0.66, 0.80), (-0.76, 0.58)], 0.30, 0xffffff, 1.0, bev=0.05, tag='body', name='rear')
    A.prism('plastic', (0, 0, 0), [(0.30, 0.30), (0.52, 0.30), (0.60, 0.56), (0.52, 1.00), (0.42, 1.00), (0.34, 0.56)], 0.34, 0xffffff, 1.04, bev=0.05, tag='body', name='shield')
    A.box('plastic', (0.10, 0.33, 0), (0.44, 0.05, 0.30), 0x2a2e33, 1.0, bev=0.01, name='floor')
    if not lo:
        for k in range(5):
            A.box('plastic', (-0.05 + k * 0.07, 0.357, 0), (0.03, 0.004, 0.26), 0x1a1d20, 1.0, name='tread', proxy=False)
    A.cushion('fabric', (-0.40, 0.84, 0), (0.56, 0.08, 0.28), 0x1a1a1a, 1.0, puff=0.25, r=0.03, name='seat')
    A.box('emit', (-0.765, 0.70, 0), (0.012, 0.06, 0.16), 0x7a1c16, 1.0, name='taillight', proxy=False)
    A.box('emit', (0.566, 0.82, 0), (0.012, 0.08, 0.14), 0xd8e0e4, 0.7, name='headlight', proxy=False)
    if not lo:
        A.box('plastic', (-0.74, 0.62, 0), (0.06, 0.10, 0.20), 0x15181b, 1.0, bev=0.01, name='rear_rack', proxy=False)
        A.box('paper', (-0.77, 0.52, 0), (0.006, 0.08, 0.14), 0xd8c84a, 1.0, name='plate', proxy=False)
    for (wx, k) in ((-0.52, -1), (0.62, 1)):
        with A.at(wx, 0.24, 0):
            A.lathe('dark', (0, 0, 0), [(0.15, -0.045), (0.21, -0.05), (0.235, -0.04), (0.242, -0.015), (0.242, 0.015), (0.235, 0.04), (0.21, 0.05), (0.15, 0.045)], 0x111418, 1.0, seg=24 if not lo else 10, dirn=(0, 0, 1), cap0=False, cap1=False, name='tire', proxy=False)
            A.cyl('metal', (0, 0, -0.05), 0.15, 0.15, 0.10, 0x8a9298, 1.1, seg=20 if not lo else 8, dirn=(0, 0, 1), name='hub', proxy=False)
            if not lo:
                A.cyl('metal', (0, 0, -0.055), 0.07, 0.07, 0.11, 0x5a6066, 1.0, seg=16, dirn=(0, 0, 1), name='drum', proxy=False)
        A.proxy_rod((wx, 0.24, -0.05), (wx, 0.24, 0.05), 0.24)
    for s in (-1, 1):
        A.rod('metal', (0.62, 0.24, s * 0.07), (0.50, 0.70, s * 0.06), 0.016, 0.016, 0x2a2e33, 1.0, seg=8, name='fork', proxy=False)
    A.rod('metal', (0.48, 0.96, 0), (0.54, 1.10, 0), 0.02, 0.02, 0x2a2e33, 1.0, seg=8, name='stem')
    A.tube('metal', [(0.54, 1.10, -0.32), (0.56, 1.11, -0.15), (0.56, 1.11, 0.15), (0.54, 1.10, 0.32)], 0.012, 0x2a2e33, 1.0, seg=8, bend=0.05, name='bar')
    for s in (-1, 1):
        A.rod('plastic', (0.54, 1.10, s * 0.27), (0.54, 1.10, s * 0.37), 0.019, 0.019, 0x15181a, 1.0, seg=10, round_=0.006, name='grip')
        if not lo:
            A.rod('metal', (0.54, 1.10, s * 0.22), (0.50, 1.32, s * 0.26), 0.005, 0.005, 0x2a2e33, 1.0, seg=6, name='mirror_rod', proxy=False)
            A.cushion('plastic', (0.50, 1.34, s * 0.27), (0.03, 0.07, 0.11), 0x15181a, 1.0, puff=0.2, r=0.01, name='mirror', proxy=False)
            A.rod('metal', (0.53, 1.11, s * 0.22), (0.47, 1.10, s * 0.26), 0.004, 0.004, 0x9aa2a8, 1.1, seg=6, name='brake_lever', proxy=False)
    if not lo:
        A.box('plastic', (0.50, 1.05, 0), (0.10, 0.08, 0.20), 0x15181b, 1.0, bev=0.02, name='dash', proxy=False)
        A.box('emit', (0.53, 1.09, 0), (0.002, 0.03, 0.10), 0x3a6a8a, 0.5, rot=(0, 0, -0.6), name='display', proxy=False)
