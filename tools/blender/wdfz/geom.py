"""几何小工具：向量运算、圆角折线、截面扫掠用的平行移动坐标系。全部是游戏坐标（米，y 朝上）。"""
import math
from mathutils import Vector, Matrix


def V(p):
    return Vector((float(p[0]), float(p[1]), float(p[2])))


def hexrgb(col, shade=1.0):
    """和游戏里 Kit 一样：十六进制颜色按 /255 直接当线性值用，再乘明暗。"""
    return (((col >> 16) & 255) / 255.0 * shade, ((col >> 8) & 255) / 255.0 * shade, (col & 255) / 255.0 * shade)


def rot_y(a):
    return Matrix.Rotation(a, 4, 'Y')


def euler(rx=0.0, ry=0.0, rz=0.0):
    """绕 x、y、z 依次转（和 three.js 的 'XYZ' 顺序一致：先 z 后 y 再 x 作用在点上）。"""
    return Matrix.Rotation(rx, 4, 'X') @ Matrix.Rotation(ry, 4, 'Y') @ Matrix.Rotation(rz, 4, 'Z')


def frame_from_dir(d, up_hint=None):
    """以 d 为局部 y 轴的正交坐标系（3×3）。用于把沿 y 建好的旋转体转到任意方向。"""
    d = V(d).normalized()
    up = V(up_hint) if up_hint is not None else (Vector((1, 0, 0)) if abs(d.x) < 0.9 else Vector((0, 0, 1)))
    x = up.cross(d)
    if x.length < 1e-6:
        up = Vector((0, 0, 1)) if abs(d.z) < 0.9 else Vector((1, 0, 0))
        x = up.cross(d)
    x.normalize()
    z = x.cross(d).normalized()
    m = Matrix.Identity(3)
    m.col[0] = x
    m.col[1] = d
    m.col[2] = z
    return m


def fillet_path(pts, radius, steps):
    """折线在拐角处倒成圆弧（弯管、椅子腿的弯头）。radius 可以是数或每个拐角一个数。"""
    pts = [V(p) for p in pts]
    if len(pts) < 3 or (not isinstance(radius, (list, tuple)) and radius <= 0):
        return pts
    out = [pts[0]]
    for i in range(1, len(pts) - 1):
        r = radius[i - 1] if isinstance(radius, (list, tuple)) else radius
        a, b, c = pts[i - 1], pts[i], pts[i + 1]
        u = (a - b)
        w = (c - b)
        la, lc = u.length, w.length
        if la < 1e-6 or lc < 1e-6 or r <= 0:
            out.append(b)
            continue
        u.normalize()
        w.normalize()
        cosang = max(-1.0, min(1.0, u.dot(w)))
        ang = math.acos(cosang)                 # 两段之间的夹角
        if ang > math.pi - 1e-3:                # 几乎是直线
            out.append(b)
            continue
        t = r / math.tan(ang / 2)               # 切点到拐角的距离
        t = min(t, la * 0.49, lc * 0.49)
        rr = t * math.tan(ang / 2)
        p0 = b + u * t
        p1 = b + w * t
        bis = (u + w).normalized()
        center = b + bis * (rr / math.sin(ang / 2))
        v0 = (p0 - center)
        v1 = (p1 - center)
        sweep = math.acos(max(-1.0, min(1.0, v0.normalized().dot(v1.normalized()))))
        n = max(1, int(round(steps * sweep / (math.pi / 2))))
        axis = v0.cross(v1)
        if axis.length < 1e-9:
            out.append(b)
            continue
        axis.normalize()
        for k in range(n + 1):
            q = Matrix.Rotation(sweep * k / n, 3, axis) @ v0
            out.append(center + q)
    out.append(pts[-1])
    # 去掉重合点
    res = [out[0]]
    for p in out[1:]:
        if (p - res[-1]).length > 1e-6:
            res.append(p)
    return res


def transport_frames(pts, up_hint=None):
    """沿路径的平行移动坐标系：每个点的切向 T、法向 N、副法向 B，截面不会拧麻花。"""
    n = len(pts)
    T = []
    for i in range(n):
        if i == 0:
            t = pts[1] - pts[0]
        elif i == n - 1:
            t = pts[-1] - pts[-2]
        else:
            t = (pts[i + 1] - pts[i]).normalized() + (pts[i] - pts[i - 1]).normalized()
        if t.length < 1e-9:
            t = pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]
        T.append(t.normalized())
    up = V(up_hint) if up_hint is not None else Vector((0, 1, 0))
    if abs(up.dot(T[0])) > 0.95:
        up = Vector((1, 0, 0)) if abs(T[0].x) < 0.9 else Vector((0, 0, 1))
    N0 = (up - T[0] * up.dot(T[0])).normalized()
    Ns = [N0]
    for i in range(1, n):
        a, b = T[i - 1], T[i]
        ax = a.cross(b)
        if ax.length < 1e-9:
            Ns.append(Ns[-1].copy())
            continue
        ang = math.acos(max(-1.0, min(1.0, a.dot(b))))
        Ns.append((Matrix.Rotation(ang, 3, ax.normalized()) @ Ns[-1]).normalized())
    Bs = [T[i].cross(Ns[i]).normalized() for i in range(n)]
    return T, Ns, Bs


def polyline_len(pts):
    return sum((pts[i + 1] - pts[i]).length for i in range(len(pts) - 1))


def lerp(a, b, t):
    return a + (b - a) * t


def smoothstep(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def rrect(w, h, r, n=4, cx=0.0, cy=0.0):
    """圆角矩形（逆时针），宽 w 高 h，圆角半径 r，每个角 n 段。"""
    r = min(r, w / 2 - 1e-5, h / 2 - 1e-5)
    pts = []
    if r <= 1e-5 or n <= 0:
        return [(cx - w / 2, cy - h / 2), (cx + w / 2, cy - h / 2), (cx + w / 2, cy + h / 2), (cx - w / 2, cy + h / 2)]
    for (ox, oy, a0) in ((w / 2 - r, -h / 2 + r, -math.pi / 2), (w / 2 - r, h / 2 - r, 0.0), (-w / 2 + r, h / 2 - r, math.pi / 2), (-w / 2 + r, -h / 2 + r, math.pi)):
        for k in range(n + 1):
            a = a0 + k / n * math.pi / 2
            pts.append((cx + ox + math.cos(a) * r, cy + oy + math.sin(a) * r))
    return pts


def arc_pts(cx, cy, r, a0, a1, n):
    return [(cx + math.cos(a0 + (a1 - a0) * k / n) * r, cy + math.sin(a0 + (a1 - a0) * k / n) * r) for k in range(n + 1)]
