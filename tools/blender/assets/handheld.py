"""第一人称的手和手里的东西（右手；左手游戏里镜像）。
手的搭法照搬 game3d/js/hands.js：手的坐标 l 从手腕指向指根、n 手背朝外、w 指向拇指一侧，换成右手系是 [l, n, -w]；
握手电 / 握伞柄时四指按圆柱绕上去、拇指顺着筒身压住，托手机时四指从背后扣住长边。
模型的原点是握持中心（grip 坐标：圆柱轴朝 -z、拇指那一面朝 +y、手背朝 +x），和 hands.js 一样，东西直接挂在手上。
Blender 这边把指缝、掌心、袖口里面的接触阴影烘进顶点色。"""
import math

from mathutils import Vector

from wdfz import asset


def lin(h):
    """sRGB 十六进制 → 线性（hands.js 的 hCol 用 THREE.Color 换成线性值当顶点色）。"""
    def c(v):
        v /= 255.0
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return (c((h >> 16) & 255), c((h >> 8) & 255), c(h & 255))


SKIN = {k: lin(v) for k, v in dict(skin=0xc9997c, dark=0xb8876c, palm=0xd2a58c, nail=0xdcb7aa, knuckle=0xbf8d73,
                                   cuff=0xd8dde0, sleeve=0x1c2a3a, sleeve2=0x16212e).items()}
FINGERS = [dict(l=0.084, w=0.026, len=(0.041, 0.024, 0.019), r=0.0089),
           dict(l=0.088, w=0.008, len=(0.045, 0.027, 0.020), r=0.0092),
           dict(l=0.085, w=-0.010, len=(0.042, 0.026, 0.019), r=0.0087),
           dict(l=0.077, w=-0.027, len=(0.033, 0.020, 0.017), r=0.0075)]
POSES = dict(torch=dict(rc=0.0235, tilt=0.8, dev=0.5, ext=0.0), brolly=dict(rc=0.017, tilt=0.5, dev=0.3, ext=0.2), phone=dict(phone=True, dev=0.5, ext=-0.2))


def V3(a):
    return Vector((a[0], a[1], a[2]))


def at(l, n, w):
    return Vector((l, n, -w))


class HM:
    """和 hands.js 的 HMesh 一样：一圈圈椭圆截面扫出管子、圆头收口、斜放的椭球；点先换到 grip 坐标。"""

    def __init__(self, tf):
        self.P, self.C, self.F = [], [], []
        self.tf = tf

    def v(self, p, c):
        if self.tf:
            p = self.tf(p)
        self.P.append(tuple(p))
        self.C.append(c)
        return len(self.P) - 1

    def ring(self, p, T, U, a, b, seg, col):
        Sd = T.cross(U)
        return [self.v(p + Sd * (a * math.cos(k / seg * 2 * math.pi)) + U * (b * math.sin(k / seg * 2 * math.pi)), col) for k in range(seg)]

    def join(self, r0, r1):
        n = len(r0)
        for k in range(n):
            k1 = (k + 1) % n
            self.F.append((r0[k], r0[k1], r1[k1], r1[k]))

    def cap(self, r, p, T, U, a, b, ln, seg, col):
        prev = r
        for i in range(1, 4):
            ph = i / 4 * math.pi / 2
            cs = math.cos(ph)
            rr = self.ring(p + T * (ln * math.sin(ph)), T, U, a * cs, b * cs, seg, col)
            self.join(prev, rr)
            prev = rr
        tip = self.v(p + T * ln, col)
        n = len(prev)
        for k in range(n):
            self.F.append((prev[k], prev[(k + 1) % n], tip))

    def sweep(self, pts, seg, cap0=0.0, cap1=0.0):
        n = len(pts)
        rings, Ts, Us = [], [], []
        for i in range(n):
            if i == 0:
                T = (pts[1]['p'] - pts[0]['p']).normalized()
            elif i == n - 1:
                T = (pts[-1]['p'] - pts[-2]['p']).normalized()
            else:
                T = (pts[i + 1]['p'] - pts[i - 1]['p']).normalized()
            up = pts[i].get('up', Vector((0, 1, 0)))
            U = (up - T * up.dot(T)).normalized()
            Ts.append(T)
            Us.append(U)
            rings.append(self.ring(pts[i]['p'], T, U, pts[i]['a'], pts[i]['b'], seg, pts[i]['c']))
            if i:
                self.join(rings[i - 1], rings[i])
        if cap0:
            q = pts[0]
            self.cap(list(reversed(rings[0])), q['p'], -Ts[0], Us[0], q['a'], q['b'], cap0 * (q['a'] + q['b']) / 2, seg, q['c'])
        if cap1:
            q = pts[-1]
            self.cap(rings[-1], q['p'], Ts[-1], Us[-1], q['a'], q['b'], cap1 * (q['a'] + q['b']) / 2, seg, q['c'])

    def ellipsoid(self, c, ax, ay, az, col, seg=10):
        rows = max(4, round(seg * 0.6))
        grid = []
        for j in range(rows + 1):
            ph = j / rows * math.pi
            grid.append([self.v(c + ax * (math.sin(ph) * math.cos(i / seg * 2 * math.pi)) + ay * math.cos(ph) + az * (math.sin(ph) * math.sin(i / seg * 2 * math.pi)), col) for i in range(seg)])
        for j in range(rows):
            for i in range(seg):
                i1 = (i + 1) % seg
                if j == 0:
                    self.F.append((grid[0][i], grid[1][i1], grid[1][i]))
                elif j == rows - 1:
                    self.F.append((grid[j][i], grid[j][i1], grid[j + 1][i]))
                else:
                    self.F.append((grid[j][i], grid[j][i1], grid[j + 1][i1], grid[j + 1][i]))


def finger(M, pts, dors, r, C, seg):
    seq = []
    n = len(pts)
    for i in range(n):
        k = i / (n - 1)
        rr = r * (1 - 0.2 * k)
        seq.append(dict(p=pts[i], a=rr * 1.08, b=rr * 0.92, up=dors[i], c=C['dark'] if i in (1, 2) else C['skin']))
        if i < n - 1:
            mid = pts[i].lerp(pts[i + 1], 0.5)
            rm = r * (1 - 0.2 * (i + 0.5) / (n - 1)) * 0.93
            seq.append(dict(p=mid, a=rm * 1.08, b=rm * 0.9, up=(dors[i] + dors[i + 1]).normalized(), c=C['skin']))
    M.sweep(seq, seg, 0, 0.9)
    d = (pts[-1] - pts[-2]).normalized()
    up = dors[-1]
    side = d.cross(up).normalized()
    rt = r * 0.8
    M.ellipsoid(pts[-2].lerp(pts[-1], 0.62) + up * (rt * 0.86), d * rt, up * (rt * 0.22), side * (rt * 0.8), C['nail'], 8)


def palm(M, C, seg):
    U = Vector((0, 1, 0))
    M.sweep([dict(p=at(-0.012, 0, 0), a=0.026, b=0.018, up=U, c=C['skin']), dict(p=at(0.012, 0, 0.002), a=0.034, b=0.0175, up=U, c=C['skin']),
             dict(p=at(0.040, 0, 0), a=0.040, b=0.016, up=U, c=C['skin']), dict(p=at(0.066, 0, -0.001), a=0.042, b=0.0145, up=U, c=C['skin']),
             dict(p=at(0.080, 0, -0.001), a=0.040, b=0.0125, up=U, c=C['skin'])], seg + 4, 0, 0.7)
    M.ellipsoid(at(0.026, -0.009, 0.022), at(0.026, 0, 0.006), at(0, 0.012, 0), at(-0.004, 0, 0.016), C['palm'], 10)
    M.ellipsoid(at(0.036, -0.007, -0.027), at(0.030, 0, 0), at(0, 0.011, 0), at(0, 0, 0.012), C['palm'], 10)
    for f in FINGERS:
        M.ellipsoid(at(f['l'] - 0.005, 0.003, f['w']), at(0.010, 0, 0), at(0, 0.0075, 0), at(0, 0, f['r'] * 1.05), C['knuckle'], 8)
    M.ellipsoid(at(-0.006, 0.004, -0.022), at(0.008, 0, 0), at(0, 0.007, 0), at(0, 0, 0.007), C['skin'], 6)


def thumb(M, pts, dors, C, seg):
    seq = [dict(p=pts[0], a=0.016, b=0.013, up=dors[0], c=C['palm']),
           dict(p=pts[0].lerp(pts[1], 0.5), a=0.0135, b=0.0115, up=(dors[0] + dors[1]).normalized(), c=C['skin']),
           dict(p=pts[1], a=0.0115, b=0.0105, up=dors[1], c=C['dark']),
           dict(p=pts[1].lerp(pts[2], 0.5), a=0.0105, b=0.0095, up=(dors[1] + dors[2]).normalized(), c=C['skin']),
           dict(p=pts[2], a=0.0105, b=0.0092, up=dors[2], c=C['dark']),
           dict(p=pts[3], a=0.0092, b=0.0078, up=dors[3], c=C['skin'])]
    M.sweep(seq, seg, 0, 0.9)
    d = (pts[3] - pts[2]).normalized()
    up = dors[3]
    side = d.cross(up).normalized()
    M.ellipsoid(pts[2].lerp(pts[3], 0.6) + up * 0.0072, d * 0.0085, up * 0.0018, side * 0.0072, C['nail'], 8)


def sleeve(M, back, C, seg):
    up = (Vector((0, 1, 0)) - back * back.y).normalized()

    def a(d):
        return back * d
    M.sweep([dict(p=a(-0.004), a=0.026, b=0.0185, up=up, c=C['skin']), dict(p=a(0.030), a=0.028, b=0.021, up=up, c=C['skin']),
             dict(p=a(0.062), a=0.031, b=0.024, up=up, c=C['skin'])], seg + 2, 0, 0)
    M.sweep([dict(p=a(0.048), a=0.0335, b=0.027, up=up, c=C['cuff']), dict(p=a(0.062), a=0.0345, b=0.028, up=up, c=C['cuff']),
             dict(p=a(0.078), a=0.035, b=0.029, up=up, c=C['cuff'])], seg + 4, 0, 0)
    seq = []
    for i in range(10):
        d = 0.068 + i * 0.04
        wob = ((0.004 if i % 2 else -0.002) if 0 < i < 9 else 0.0)
        seq.append(dict(p=a(d) + up * (0.002 if i % 3 == 1 else 0.0), a=0.046 + i * 0.0035 + wob, b=0.040 + i * 0.0032 + wob * 0.6, up=up, c=C['sleeve2'] if i % 2 else C['sleeve']))
    M.sweep(seq, seg + 6, 0, 0)
    M.sweep([dict(p=a(0.0685), a=0.046, b=0.040, up=up, c=C['sleeve2']), dict(p=a(0.0665), a=0.036, b=0.0295, up=up, c=C['sleeve2'])], seg + 6, 0, 0)


def wrap_finger(f, Cl, Cn, R):
    m = (f['l'], 0.0)
    pts = [at(f['l'] - 0.012, 0, f['w']), at(f['l'], 0, f['w'])]
    dors = [Vector((0, 1, 0)), Vector((0, 1, 0))]
    dx, dy = Cl - m[0], Cn - m[1]
    d = math.hypot(dx, dy)
    L1 = f['len'][0]
    a = (L1 * L1 - R * R + d * d) / (2 * d)
    h = math.sqrt(max(0.0, L1 * L1 - a * a))
    bx, by = m[0] + a * dx / d, m[1] + a * dy / d
    p1 = (bx + h * dy / d, by - h * dx / d)
    p1b = (bx - h * dy / d, by + h * dx / d)
    if p1b[0] > p1[0]:
        p1 = p1b
    ang = math.atan2(p1[1] - Cn, p1[0] - Cl)
    lst = [p1]
    for i in (1, 2):
        ang -= 2 * math.asin(min(1.0, f['len'][i] / (2 * R)))
        lst.append((Cl + R * math.cos(ang), Cn + R * math.sin(ang)))
    for q in lst:
        pts.append(at(q[0], q[1], f['w']))
        r = Vector((q[0] - Cl, q[1] - Cn, 0)).normalized()
        dors.append(Vector((r.x, r.y, 0)))
    dors[1] = (dors[1] + dors[2]).normalized()
    return pts, dors


def bend_finger(f, ang, spread):
    p = [f['l'], 0.0, f['w']]
    th = 0.0
    pts = [at(f['l'] - 0.012, 0, f['w']), at(p[0], p[1], p[2])]
    dors = [Vector((0, 1, 0)), Vector((0, 1, 0))]
    for i in range(3):
        th += ang[i]
        dl, dn, dw = math.cos(th) * math.cos(spread), -math.sin(th), math.cos(th) * math.sin(spread)
        p = [p[0] + dl * f['len'][i], p[1] + dn * f['len'][i], p[2] + dw * f['len'][i]]
        pts.append(at(*p))
        dors.append(Vector((math.sin(th), math.cos(th), 0)))
    dors[1] = (dors[1] + dors[2]).normalized()
    return pts, dors


def forearm(dev, ext):
    return -at(math.cos(dev) * math.cos(ext), -math.sin(ext), math.sin(dev)).normalized()


def hand(A, pose_name):
    pose = POSES[pose_name]
    seg = (12, 10, 8, 6)[A.L]
    C = SKIN
    if not pose.get('phone'):
        t = pose['tilt']
        g = at(math.sin(t), 0, math.cos(t)).normalized()
        c = at(0.058, -(0.0145 + pose['rc'] + 0.0015), 0)
        Z = -g
        Y = -(Z.cross(Vector((0, 1, 0))).normalized())
        if Y.dot(at(-1, 0, 1)) < 0:
            Y = -Y
        X = Y.cross(Z)
        c0 = c.copy()

        def tf(p):
            d = p - c0
            return Vector((d.dot(X), d.dot(Y), d.dot(Z)))
    else:
        pc = at(0.058, -0.026, 0.034)

        def tf(p):
            return p - pc
    M = HM(tf)
    palm(M, C, seg)
    if not pose.get('phone'):
        R0 = pose['rc']
        for f in FINGERS:
            s = (-f['w'] - c.z) / g.z
            pts, dors = wrap_finger(f, c.x + g.x * s, c.y, R0 + f['r'] * 1.02)
            finger(M, pts, dors, f['r'], C, seg)
        top = g.cross(Vector((0, 1, 0))).normalized()
        if top.dot(at(-1, 0, 1)) < 0:
            top = -top
        Rt = R0 + 0.0095
        base = c + top * Rt
        tp = [at(0.010, -0.010, 0.020), base + g * -0.004, base + g * 0.028, base + g * 0.052 + top * -0.002]
        td = [at(0, 1, 0.4).normalized(), top, top, top]
        thumb(M, tp, td, C, seg)
        sleeve(M, forearm(pose['dev'], pose['ext']), C, seg)
    else:
        for i, f in enumerate(FINGERS):
            pts, dors = bend_finger(f, (1.40 - i * 0.04, 1.62, 0.12 + i * 0.05), (i - 1.5) * -0.05)
            finger(M, pts, dors, f['r'], C, seg)
        thumb(M, [at(0.010, -0.010, 0.020), at(0.022, -0.030, 0.045), at(0.031, -0.040, 0.071), at(0.038, -0.041, 0.094)],
              [at(0, 1, 0.4).normalized(), at(0, -1, 0.6).normalized(), at(0, -1, 0.1).normalized(), at(0, -1, 0).normalized()], C, seg)
        sleeve(M, forearm(POSES['phone']['dev'], POSES['phone']['ext']), C, seg)
    A.mesh('dark', M.P, M.F, (1.0, 1.0, 1.0), 1.0, smooth=True, sharp=None, name='hand', cols=M.C, ao=0.5)


for _p in POSES:
    asset('hand_' + _p, ao=0.03, ground=False)(lambda A, p=_p: hand(A, p))


# ====================================================================== 手里的东西
@asset('torch_body', ao=0.02, ground=False)
def torch_body(A):
    """手电（沿 +y 建，游戏里转成朝前）：尾盖和挂绳孔、一圈圈滚花的握把、往前张开的灯头、灯头前沿的亮圈、红色开关、背面的挂绳扣。"""
    tp = [(0.0, 0.0), (0.017, 0.0), (0.021, 0.004), (0.0225, 0.012), (0.0225, 0.03)]
    for q in range(7):
        tp += [(0.0238, 0.036 + q * 0.019), (0.0222, 0.045 + q * 0.019)]
    tp += [(0.0225, 0.172), (0.0225, 0.182), (0.026, 0.196), (0.034, 0.222), (0.036, 0.236), (0.036, 0.248), (0.031, 0.250)]
    A.lathe('metal', (0, 0, 0), tp, lin(0x2a2e33), 1.0, seg=20, sharp=40, cap1=False, name='body')
    if A.hi:
        for k in range(24):
            a = k / 24 * 2 * math.pi
            A.box('metal', (math.cos(a) * 0.0236, 0.10, math.sin(a) * 0.0236), (0.0016, 0.12, 0.0016), lin(0x1a1d20), 1.0, rot=(0, -a, 0), name='knurl', proxy=False)
    A.cyl('metal', (0, 0.236, 0), 0.0365, 0.0365, 0.006, lin(0x4a4f55), 1.1, seg=20, caps=False, name='bezel')
    A.box('metal', (0.0232, 0.118, 0), (0.006, 0.016, 0.011), lin(0x7a2a22), 1.1, bev=0.002, name='switch')
    A.box('metal', (-0.0236, 0.06, 0), (0.003, 0.05, 0.006), lin(0x15181b), 1.0, name='clip')
    if not A.lo:
        A.tube('plastic', [(0.0, -0.004, 0.006), (0.0, -0.02, 0.012), (0.0, -0.035, 0.0), (0.0, -0.02, -0.012), (0.0, -0.004, -0.006)], 0.0018, lin(0x1a1a1a), 1.0, seg=5, bend=0.008, name='lanyard')


@asset('phone_body', ao=0.02, ground=False)
def phone_body(A):
    """手机（x 宽、z 长、y 厚，屏幕朝 -y；屏幕本身游戏里另画，会亮）：圆角机身、中框、屏幕黑边、背面的摄像头模组（两颗镜头、闪光灯）、侧键。"""
    from assets._parts import rpanel
    with A.at(0, 0, 0, rx=math.pi / 2):
        rpanel(A, 'plastic', (0, 0, 0), 0.068, 0.136, 0.008, 0.009, lin(0x15171a), 1.0, bev=0.002, name='body')
        rpanel(A, 'metal', (0, 0, 0), 0.0684, 0.1364, 0.0045, 0.009, lin(0x3a3d42), 1.05, bev=0.001, name='frame', proxy=False)
    A.box('plastic', (0, -0.0042, 0), (0.064, 0.0008, 0.132), lin(0x050607), 1.0, bev=0.0003, name='bezel', proxy=False)
    A.box('metal', (-0.018, 0.0046, -0.050), (0.022, 0.0016, 0.024), lin(0x22252a), 1.0, bev=0.004, name='camera_bump')
    for (x, z) in ((-0.023, -0.055), (-0.013, -0.045)):
        A.cyl('metal', (x, 0.0052, z), 0.0048, 0.0048, 0.0012, lin(0x5a5e62), 1.1, seg=12, name='lens_ring', proxy=False)
        A.cyl('dark', (x, 0.0058, z), 0.0036, 0.0036, 0.0008, lin(0x050607), 1.0, seg=12, name='lens', proxy=False)
    A.cyl('emit', (-0.023, 0.0056, -0.045), 0.0018, 0.0018, 0.0006, lin(0xd8d0b0), 0.6, seg=8, name='flash', proxy=False)
    for (z, L) in ((-0.02, 0.016), (0.01, 0.010)):
        A.box('metal', (0.0346, 0, z), (0.0016, 0.003, L), lin(0x2a2d31), 1.0, bev=0.0006, name='key', proxy=False)


@asset('umbrella', ao=0.04, ground=False)
def umbrella(A):
    """雨伞（伞柄是握持点，伞杆沿 -z）：J 形泡棉弯柄、伞杆、下巢、八根伞骨和撑杆、伞骨尖的小帽、伞顶，
    八片伞面在伞骨之间往下塌一点（两面都画），伞面边上一圈缝线。"""
    shaft, R, drop, ribN = 0.98, 0.62, 0.22, 8
    top = -shaft
    A.rod('metal', (0, 0, 0.05), (0, 0, top - 0.04), 0.0075, 0.0065, lin(0x3a3d40), 1.0, seg=8, name='shaft')
    A.rod('plastic', (0, 0, 0.055), (0, 0, -0.07), 0.016, 0.016, lin(0x22180f), 1.0, seg=12, round_=0.004, name='grip')
    A.tube('plastic', [(0, 0, 0.055), (0, 0, 0.09), (0.036, 0, 0.12), (0.072, 0, 0.09), (0.072, 0, 0.07)], 0.012, lin(0x22180f), 1.0, seg=10, bend=0.03, name='hook')
    A.cyl('metal', (0, 0, 0), 0.011, 0.011, 0.03, lin(0x55595e), 1.0, seg=10, dirn=(0, 0, -1), name='runner_low')
    run = top + 0.28
    A.cyl('metal', (0, 0, run + 0.02), 0.013, 0.013, 0.04, lin(0x3a3d40), 1.0, seg=10, dirn=(0, 0, -1), name='runner')
    for i in range(ribN):
        a = i / ribN * 2 * math.pi + math.pi / ribN
        cx, cy = math.cos(a), math.sin(a)
        A.rod('metal', (0, 0, top + 0.01), (cx * R * 0.98, cy * R * 0.98, top + drop), 0.003, 0.0025, lin(0x2b2d30), 1.0, seg=4, name='rib', proxy=False)
        A.rod('metal', (0, 0, run), (cx * R * 0.5, cy * R * 0.5, top + drop * 0.5 + 0.012), 0.0025, 0.0022, lin(0x2b2d30), 1.0, seg=4, name='stretcher', proxy=False)
        A.blob('plastic', (cx * R, cy * R, top + drop + 0.004), (0.007, 0.007, 0.009), lin(0x0e0f10), 1.0, seg=6, name='tip', proxy=False)
    A.cyl('plastic', (0, 0, top + 0.01), 0.012, 0.006, 0.05, lin(0x0e0f10), 1.0, seg=10, dirn=(0, 0, -1), name='ferrule')
    # 伞面
    seg, rows = (8, 6, 5, 3)[A.L], (9, 7, 5, 3)[A.L]
    dark, edge = lin(0x14202e), lin(0x101a26)
    verts, faces, cols = [], [], []
    for i in range(ribN):
        aa = i / ribN * 2 * math.pi + math.pi / ribN
        ab = (i + 1) / ribN * 2 * math.pi + math.pi / ribN
        base = len(verts)
        for r2 in range(rows + 1):
            u = r2 / rows
            for s2 in range(seg + 1):
                v = s2 / seg
                an = aa + (ab - aa) * v
                sag = math.sin(v * math.pi) * 0.035 * u
                rad = R * u * (1 - 0.06 * math.sin(v * math.pi) * u)
                verts.append((math.cos(an) * rad, math.sin(an) * rad, top + drop * u ** 1.35 + sag))
                cols.append(edge if u > 0.95 else dark)
        W = seg + 1
        for r2 in range(rows):
            for s2 in range(seg):
                q = (base + r2 * W + s2, base + r2 * W + s2 + 1, base + (r2 + 1) * W + s2 + 1, base + (r2 + 1) * W + s2)
                faces.append(q)
    A.mesh('fabric', verts, faces, (1.0, 1.0, 1.0), 1.0, smooth=True, sharp=None, name='canopy', cols=cols)
    # 背面另起一套点（bmesh 不让两个面共用一组点）
    n0 = len(verts)
    A.mesh('fabric', verts, [tuple(reversed(f)) for f in faces], (1.0, 1.0, 1.0), 1.0, smooth=True, sharp=None, name='canopy_in', cols=[(c[0] * 0.8, c[1] * 0.8, c[2] * 0.8) for c in cols])
