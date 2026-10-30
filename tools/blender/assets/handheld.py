"""第一人称的手和手里的东西（右手；左手游戏里镜像）。
手照着真人手的照片量了比例（手背张开一张、侧面半握一张）：手指偏细长，最后一节略长；指甲剪得短，圆角长方形，
宽约指尖的七成、长约最后一节的一半，前缘一窄条浅色，根部和两侧压在皮肤褶下面。
皮肤用有符号距离场搭：每节手指是截面略扁的圆锥台，指腹、指节、掌骨头、大鱼际、小鱼际、腕部是椭球，手掌是圆角盒，
平滑并集揉成一整块。每根手指（含拇指）各自和手掌融合（指蹼、虎口），手指之间不融合（并拢处留一道缝）。
多边形化（surface nets）后投影回曲面、按画质等级减面。指甲是贴着指尖曲面的薄甲片，袖口、外套袖子是带厚度和翻边的套筒。
握手电 / 握伞柄时，四指第一节在自己的平面里弯到碰着筒身，后两节绕筒身的轴转，拇指顺着筒身压住；托手机时四指从背后扣住长边。
模型的原点是握持中心（grip 坐标：圆柱轴朝 -z、拇指那一面朝 +y、手背朝 +x），和 hands.js 一样，东西直接挂在手上。
Blender 这边把指缝、掌心、袖口里面的接触阴影烘进顶点色。"""
import hashlib
import math
import os
import pickle

import numpy as np
from mathutils import Vector

from wdfz import asset


def lin(h):
    """sRGB 十六进制 → 线性（hands.js 的 hCol 用 THREE.Color 换成线性值当顶点色）。"""
    def c(v):
        v /= 255.0
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return (c((h >> 16) & 255), c((h >> 8) & 255), c(h & 255))


# 颜色照着照片（按门板白平衡过）：手背浅暖肤色，掌心偏粉，指节皱褶处发红，指甲粉里带灰、前缘发白
SK = {k: np.array(lin(v)) for k, v in dict(
    back=0xdfb29a, palm=0xeac2ae, knuckle=0xd29b86, crease=0xc89380, tip=0xe9b4a3, fold=0xd99f8c,
    nail=0xe8c3ba, nail_edge=0xf5e6de, lunula=0xf0d8d0, cuff=0xd8dde0, cuff_in=0x8f9599,
    sleeve=0x1c2a3a, sleeve2=0x16212e, lining=0x0b1017).items()}

# 手的坐标（右手）：l 从手腕指向指根，n 手背朝外，w 指向拇指一侧；原点在手腕中心，单位米。换成右手系是 [l, n, -w]。
PALM_HALF = 0.0155   # 掌心到手掌中面的距离：握东西时筒身贴着掌心
FINGERS = [          # 指根关节（MCP）的 l、w、n，三节长度（MCP→PIP→DIP→指尖球心），四处半径（MCP、PIP、DIP、指尖）
    dict(l=0.0830, w=0.0272, n=-0.0010, len=(0.0430, 0.0250, 0.0165), r=(0.0104, 0.0092, 0.0084, 0.0077)),   # 食指
    dict(l=0.0870, w=0.0080, n=0.0000, len=(0.0470, 0.0290, 0.0175), r=(0.0107, 0.0095, 0.0086, 0.0079)),    # 中指
    dict(l=0.0830, w=-0.0115, n=-0.0015, len=(0.0440, 0.0280, 0.0165), r=(0.0100, 0.0088, 0.0080, 0.0073)),  # 无名指
    dict(l=0.0735, w=-0.0295, n=-0.0045, len=(0.0350, 0.0205, 0.0150), r=(0.0088, 0.0078, 0.0071, 0.0065)),  # 小指
]
THUMB = dict(cmc=(0.016, -0.008, 0.021), len=(0.044, 0.031, 0.0185), r=(0.0122, 0.0113, 0.0103, 0.0094))
POSES = dict(torch=dict(rc=0.0235, tilt=0.8, dev=0.5, ext=0.0), brolly=dict(rc=0.017, tilt=0.5, dev=0.3, ext=0.2), phone=dict(phone=True, dev=0.5, ext=-0.2))
SKIN_TRIS = (16000, 9500, 5600, 3000)    # 各档皮肤的三角形数（从细网格减面）
GRID_H = 0.0009                          # 多边形化的格子边长
GRIP_CUP = (0.0, 0.0, -0.002, -0.0045)   # 握着东西时无名指、小指的掌骨头往掌心收（掌弓）


def at(l, n, w):
    return Vector((l, n, -w))


def npv(v):
    return np.array((v[0], v[1], v[2]), np.float64)


# ====================================================================== 有符号距离场
def smin(a, b, k):
    """平滑并集（多项式）：k 是融合的宽度"""
    h = np.maximum(k - np.abs(a - b), 0.0) / k
    return np.minimum(a, b) - h * h * k * 0.25


def _rcone(Q, a, b, r1, r2, u, ku):
    """圆锥台（两头是球），截面沿 u 压扁到 ku 倍（手指背面平一点）"""
    if ku != 1.0:
        Q = Q + np.outer((Q - a) @ u, u) * (1.0 / ku - 1.0)
    ba = b - a
    l2 = ba @ ba
    rr = r1 - r2
    a2 = l2 - rr * rr
    il2 = 1.0 / l2
    pa = Q - a
    y = pa @ ba
    z = y - l2
    x = pa * l2 - np.outer(y, ba)
    x2 = np.einsum('ij,ij->i', x, x)
    y2 = y * y * l2
    z2 = z * z * l2
    k = np.sign(rr) * rr * rr * x2
    d = (np.sqrt(np.maximum(x2 * a2 * il2, 0.0)) + y * rr) * il2 - r1
    d = np.where(np.sign(y) * a2 * y2 < k, np.sqrt(x2 + y2) * il2 - r1, d)
    d = np.where(np.sign(z) * a2 * z2 > k, np.sqrt(x2 + z2) * il2 - r2, d)
    return d * (ku if ku < 1.0 else 1.0)


def _ell(Q, c, R, ax):
    """椭球（近似距离）：ax 的三行是局部三根轴"""
    p = (Q - c) @ ax.T
    k0 = np.linalg.norm(p / R, axis=1)
    k1 = np.linalg.norm(p / (R * R), axis=1)
    return k0 * (k0 - 1.0) / np.maximum(k1, 1e-12)


def _rbox(Q, c, b, r, ax):
    p = np.abs((Q - c) @ ax.T) - (b - r)
    return np.linalg.norm(np.maximum(p, 0.0), axis=1) + np.minimum(p.max(axis=1), 0.0) - r


def frame(d, up):
    d = npv(d)
    d /= np.linalg.norm(d)
    u = npv(up)
    u = u - d * (u @ d)
    u /= np.linalg.norm(u)
    return d, u, np.cross(d, u)


class Field:
    """手 = 手掌一组（平滑并集）+ 每根手指一组；每根手指和手掌平滑融合，手指之间取硬并集。"""

    def __init__(self):
        self.palm = []
        self.digits = []      # [(prims, 和手掌融合的宽度)]

    @staticmethod
    def prim(fn, args, k, lo, hi):
        return (fn, args, k, np.asarray(lo, np.float64), np.asarray(hi, np.float64))

    @staticmethod
    def rcone(a, b, r1, r2, k, up=None, ku=1.0):
        a, b = npv(a), npv(b)
        if up is None:
            u = np.zeros(3)
            ku = 1.0
        else:
            u = frame(b - a, up)[1]
        rm = max(r1, r2)
        return Field.prim(_rcone, (a, b, r1, r2, u, ku), k, np.minimum(a, b) - rm, np.maximum(a, b) + rm)

    @staticmethod
    def ell(c, R, d, up, k):
        dd, uu, ss = frame(d, up)
        ax = np.stack([dd, uu, ss])
        R = np.asarray(R, np.float64)
        c = npv(c)
        ext = np.abs(ax.T) @ R
        return Field.prim(_ell, (c, R, ax), k, c - ext, c + ext)

    @staticmethod
    def rbox(c, b, r, k):
        c = npv(c)
        b = np.asarray(b, np.float64)
        return Field.prim(_rbox, (c, b, r, np.eye(3)), k, c - b, c + b)

    # ---- 任意点
    @staticmethod
    def _union(prims, P, margin):
        F = np.full(len(P), 1.0)
        for fn, args, k, lo, hi in prims:
            m = k + margin
            sel = np.all((P >= lo - m) & (P <= hi + m), axis=1)
            if sel.any():
                F[sel] = smin(F[sel], fn(P[sel], *args), k)
        return F

    def parts(self, P, margin=0.004):
        Fp = self._union(self.palm, P, margin)
        return Fp, [self._union(pr, P, margin) for pr, _kw in self.digits]

    def __call__(self, P, margin=0.004):
        Fp, Fd = self.parts(P, margin)
        F = Fp.copy()
        for (pr, kw), fd in zip(self.digits, Fd):
            F = np.minimum(F, smin(Fp, fd, kw))
        return F

    def grad(self, P, e=5e-5):
        g = np.zeros_like(P)
        for i in range(3):
            o = np.zeros(3)
            o[i] = e
            g[:, i] = (self(P + o) - self(P - o)) / (2 * e)
        return g

    # ---- 规则格子：每个基元只算它外包盒附近的一块
    def bounds(self):
        lo = np.min([p[3] for p in self.palm] + [p[3] for pr, _ in self.digits for p in pr], axis=0)
        hi = np.max([p[4] for p in self.palm] + [p[4] for pr, _ in self.digits for p in pr], axis=0)
        return lo, hi

    @staticmethod
    def _union_grid(prims, org, h, shape, F, off):
        for fn, args, k, lo, hi in prims:
            m = k + 4 * h
            i0 = np.maximum(np.floor((lo - m - org) / h).astype(int), off)
            i1 = np.minimum(np.ceil((hi + m - org) / h).astype(int) + 1, off + np.array(F.shape))
            if np.any(i1 <= i0):
                continue
            ax = [org[i] + h * np.arange(i0[i], i1[i]) for i in range(3)]
            Q = np.stack(np.meshgrid(*ax, indexing='ij'), -1).reshape(-1, 3)
            s = tuple(slice(i0[i] - off[i], i1[i] - off[i]) for i in range(3))
            F[s] = smin(F[s], fn(Q, *args).reshape(F[s].shape), k)

    def grid(self, h):
        lo, hi = self.bounds()
        org = lo - 4 * h
        shape = np.ceil((hi + 4 * h - org) / h).astype(int) + 1
        zero = np.zeros(3, int)
        Fp = np.full(shape, 1.0)
        self._union_grid(self.palm, org, h, shape, Fp, zero)
        F = Fp.copy()
        for pr, kw in self.digits:
            m = max(kw, max(p[2] for p in pr)) + 4 * h
            dlo = np.min([p[3] for p in pr], axis=0) - m
            dhi = np.max([p[4] for p in pr], axis=0) + m
            i0 = np.maximum(np.floor((dlo - org) / h).astype(int), 0)
            i1 = np.minimum(np.ceil((dhi - org) / h).astype(int) + 1, shape)
            Fd = np.full(i1 - i0, 1.0)
            self._union_grid(pr, org, h, shape, Fd, i0)
            s = tuple(slice(i0[i], i1[i]) for i in range(3))
            F[s] = np.minimum(F[s], smin(Fp[s], Fd, kw))
        return F, org


def surface_nets(F, org, h):
    """每个跨过零面的小格放一个点（各条被切的棱上交点的平均），每条被切的棱连成一个四边形；朝外。"""
    ins = F < 0
    nx, ny, nz = F.shape
    C = [(i, j, k) for k in (0, 1) for j in (0, 1) for i in (0, 1)]
    E = [(0, 1), (2, 3), (4, 5), (6, 7), (0, 2), (1, 3), (4, 6), (5, 7), (0, 4), (1, 5), (2, 6), (3, 7)]

    def sl(c):
        return (slice(c[0], nx - 1 + c[0]), slice(c[1], ny - 1 + c[1]), slice(c[2], nz - 1 + c[2]))
    cnt = sum(ins[sl(c)].astype(np.int8) for c in C)
    act = (cnt > 0) & (cnt < 8)
    ia = np.nonzero(act)
    idx = -np.ones(act.shape, np.int64)
    idx[ia] = np.arange(len(ia[0]))
    acc = np.zeros((len(ia[0]), 3))
    num = np.zeros(len(ia[0]))
    for a, b in E:
        fa = F[sl(C[a])][ia]
        fb = F[sl(C[b])][ia]
        m = (fa < 0) != (fb < 0)
        t = fa[m] / (fa[m] - fb[m])
        pa, pb = np.array(C[a], float), np.array(C[b], float)
        acc[m] += pa + t[:, None] * (pb - pa)
        num[m] += 1
    V = (np.stack(ia, 1) + acc / num[:, None]) * h + org
    Q = []
    # x 方向的棱：周围四格 (i,j-1,k-1) (i,j,k-1) (i,j,k) (i,j-1,k)，按 +y、+z 走一圈法线是 +x
    s0, s1 = ins[:-1, 1:-1, 1:-1], ins[1:, 1:-1, 1:-1]
    i, j, k = np.nonzero(s0 != s1)
    j, k = j + 1, k + 1
    q = np.stack([idx[i, j - 1, k - 1], idx[i, j, k - 1], idx[i, j, k], idx[i, j - 1, k]], 1)
    Q.append(np.where(ins[i + 1, j, k][:, None], q[:, ::-1], q))
    # y 方向：(i-1,j,k-1) (i-1,j,k) (i,j,k) (i,j,k-1)，按 +z、+x 走一圈是 +y
    s0, s1 = ins[1:-1, :-1, 1:-1], ins[1:-1, 1:, 1:-1]
    i, j, k = np.nonzero(s0 != s1)
    i, k = i + 1, k + 1
    q = np.stack([idx[i - 1, j, k - 1], idx[i - 1, j, k], idx[i, j, k], idx[i, j, k - 1]], 1)
    Q.append(np.where(ins[i, j + 1, k][:, None], q[:, ::-1], q))
    # z 方向：(i-1,j-1,k) (i,j-1,k) (i,j,k) (i-1,j,k)，按 +x、+y 走一圈是 +z
    s0, s1 = ins[1:-1, 1:-1, :-1], ins[1:-1, 1:-1, 1:]
    i, j, k = np.nonzero(s0 != s1)
    i, j = i + 1, j + 1
    q = np.stack([idx[i - 1, j - 1, k], idx[i, j - 1, k], idx[i, j, k], idx[i - 1, j, k]], 1)
    Q.append(np.where(ins[i, j, k + 1][:, None], q[:, ::-1], q))
    Q = np.concatenate(Q)
    return V, Q[np.all(Q >= 0, axis=1)]


def project(field, V, it=4):
    """沿梯度把点推到零面上"""
    for _ in range(it):
        f = field(V)
        g = field.grad(V)
        V = V - (f / np.maximum(np.einsum('ij,ij->i', g, g), 1e-12))[:, None] * g
    return V


# ====================================================================== 姿势：关节位置
def axis_dist(P, c, g):
    v = P - c
    return (v - g * v.dot(g)).length


def wrap(M, L, r, rc, c, g):
    """第一节在手指自己的平面里往掌心弯，直到第二个关节碰到筒身；后两节绕筒轴转（顺着第一节前进的方向）。
    返回四个关节和每节手背朝向。"""
    R1 = rc + r[1] + 0.0004

    def p1(ph):
        return M + Vector((math.cos(ph), -math.sin(ph), 0)) * L[0]
    lo, hi = 0.0, None
    for k in range(1, 241):
        ph = k / 240 * 1.9
        if axis_dist(p1(ph), c, g) <= R1:
            hi = ph
            break
        lo = ph
    if hi is None:
        hi = 1.2
    else:
        for _ in range(40):
            mid = (lo + hi) / 2
            if axis_dist(p1(mid), c, g) <= R1:
                hi = mid
            else:
                lo = mid
    J = [M, p1(hi)]
    ph = hi
    ups = [Vector((math.sin(ph), math.cos(ph), 0))]
    sgn = None
    for Li, ri in ((L[1], r[2]), (L[2], r[3])):
        cur = J[-1]
        v = cur - c
        along = v.dot(g)
        rv = v - g * along
        Rn = rc + ri + 0.0004
        a = 2 * math.asin(min(1.0, Li / (rv.length + Rn)))
        if sgn is None:
            sgn = 1.0 if g.cross(rv).dot(J[1] - J[0]) > 0 else -1.0
        rot = rv * math.cos(sgn * a) + g.cross(rv) * math.sin(sgn * a)
        nxt = c + g * along + rot.normalized() * Rn
        mid = (cur + nxt) * 0.5 - c
        ups.append((mid - g * mid.dot(g)).normalized())
        J.append(nxt)
    return J, ups


def bend(M, L, ang, spread):
    p = M.copy()
    th = 0.0
    J, ups = [M.copy()], []
    for i in range(3):
        th += ang[i]
        d = Vector((math.cos(th) * math.cos(spread), -math.sin(th), -math.cos(th) * math.sin(spread)))
        p = p + d * L[i]
        J.append(p.copy())
        ups.append(Vector((math.sin(th), math.cos(th), 0)))
    return J, ups


def forearm(dev, ext):
    return -at(math.cos(dev) * math.cos(ext), -math.sin(ext), math.sin(dev)).normalized()


def pose_joints(name):
    """→ dict(digits=[(关节×4, 每节手背朝向×3, 半径×4)]（四指 + 拇指）, back=小臂方向, tf=grip 坐标变换(numpy), cup=掌弓)"""
    pose = POSES.get(name, {})
    digits = []
    if name != 'flat' and not pose.get('phone'):
        t = pose['tilt']
        rc = pose['rc']
        g = at(math.sin(t), 0, math.cos(t)).normalized()
        c = at(0.058, -(PALM_HALF + rc + 0.001), 0)
        for i, f in enumerate(FINGERS):
            J, ups = wrap(at(f['l'], f['n'] + GRIP_CUP[i], f['w']), f['len'], f['r'], rc, c, g)
            digits.append((J, ups, f['r']))
        # 拇指：贴着筒身的侧面顺着轴压住，指甲朝外
        top = g.cross(Vector((0, 1, 0))).normalized()
        if top.dot(at(-1, 0, 1)) < 0:
            top = -top
        cmc = at(*THUMB['cmc'])
        Rt = rc + THUMB['r'][2] + 0.0004
        base = c + top * Rt
        L0 = THUMB['len'][0]
        s = -0.010
        for _ in range(60):                                       # 掌骨长度对上：沿轴挪指根
            d = (base + g * s - cmc).length
            s += (L0 - d) * 0.5
        mcp = base + g * s + top * 0.002
        ip = base + g * (s + THUMB['len'][1])
        tip = base + g * (s + THUMB['len'][1] + THUMB['len'][2]) - top * 0.0012
        up0 = (at(0, 1, 0.5).normalized() + top).normalized()
        digits.append(([cmc, mcp, ip, tip], [up0, top, top], THUMB['r']))
        Z = -g
        Y = -(Z.cross(Vector((0, 1, 0))).normalized())
        if Y.dot(at(-1, 0, 1)) < 0:
            Y = -Y
        X = Y.cross(Z)
        R = np.array([npv(X), npv(Y), npv(Z)])
        c0 = npv(c)

        def tf(P):
            return (np.asarray(P) - c0) @ R.T
        cupd = GRIP_CUP
    elif name == 'flat':
        # 对照用（不出资源）：手背朝上、五指张开，和手背照片同一个姿势
        for i, f in enumerate(FINGERS):
            J, ups = bend(at(f['l'], f['n'], f['w']), f['len'], (0.05, 0.08, 0.06), (0.16, 0.02, -0.14, -0.38)[i])
            digits.append((J, ups, f['r']))
        J = [at(*THUMB['cmc'])]
        dirs = [at(0.62, -0.30, 0.72), at(0.75, -0.12, 0.65), at(0.80, -0.05, 0.60)]
        for k in range(3):
            J.append(J[-1] + dirs[k].normalized() * THUMB['len'][k])
        ups = [at(0.0, 1.0, -0.2).normalized(), at(-0.1, 0.9, -0.5).normalized(), at(-0.1, 0.9, -0.5).normalized()]
        digits.append((J, ups, THUMB['r']))

        def tf(P):
            return np.asarray(P)
        cupd = (0.0, 0.0, 0.0, 0.0)
        return dict(digits=digits, back=forearm(0.1, 0.0), tf=tf, cup=cupd)
    else:
        # 托手机：机背斜贴着四指第一、二节的掌面（先按自然弯曲量出这个平面和远边的走向），每根手指的远侧关节搭过远端的长边，
        # 最后一节往下贴住手机侧面（指尖只露在边上，不压屏幕）；长的手指远侧关节多越过去一点、第二个关节拱高一点。
        # 拇指顺着近端长边贴在屏幕边上
        PW, PL, PT = 0.068, 0.136, 0.008
        curl = [(0.52, 0.22, 1.30), (0.56, 0.24, 1.25), (0.62, 0.26, 1.25), (0.70, 0.28, 1.30)]
        rest = [bend(at(f['l'], f['n'], f['w']), f['len'], curl[i], (i - 1.5) * -0.05)[0] for i, f in enumerate(FINGERS)]
        cps = []
        for i, J in enumerate(rest):
            r = FINGERS[i]['r']
            for k in (0, 1):
                d, u, _ = frame(J[k + 1] - J[k], Vector((0, 1, 0)))
                cps.append(npv(J[k]) + d * (0.5 * (J[k + 1] - J[k]).length) - u * (r[k + 1] * 0.88))
        cps = np.array(cps)
        cen = cps.mean(axis=0)
        N = np.linalg.svd(cps - cen)[2][2]
        if N[1] < 0:
            N = -N                                                 # 朝手背（从手机指向手）
        dips = np.array([npv(J[2]) for J in rest])
        dp = dips - np.outer((dips - cen) @ N, N)
        e = np.linalg.svd(dp - dp.mean(axis=0))[2][0]
        e = e - N * (e @ N)
        e /= np.linalg.norm(e)
        if e[2] < 0:
            e = -e                                                 # 手机 +z 朝小指那边
        xp = np.cross(N, e)                                        # 朝指尖（远边）
        mcps = [npv(at(f['l'], f['n'], f['w'])) for f in FINGERS]

        def ik(M, T, L1, L2, upv):
            """两节的反解：第二个关节拱在手背一侧"""
            v = T - M
            dd = min(np.linalg.norm(v), L1 + L2 - 1e-4)
            v = v / np.linalg.norm(v)
            a = (L1 * L1 - L2 * L2 + dd * dd) / (2 * dd)
            h = math.sqrt(max(L1 * L1 - a * a, 0.0))
            w = upv - v * (upv @ v)
            w /= np.linalg.norm(w)
            return M + v * a + w * h, M + v * dd

        back = float(((cps - cen) @ N).min())

        def dip_target(i, xe, extra=0.0):
            f = FINGERS[i]
            return cen + N * (back + f['r'][2] * 0.95) + xp * (xe + f['r'][2] * 0.6 + extra) + e * float((mcps[i] - cen) @ e)
        lo_, hi_ = -0.05, 0.12                                     # 远边：够得最吃力的那根手指也只用到九成六的长度
        for _ in range(50):
            mid = (lo_ + hi_) / 2
            ok = all(np.linalg.norm(dip_target(i, mid) - mcps[i]) <= 0.96 * (FINGERS[i]['len'][0] + FINGERS[i]['len'][1]) for i in range(4))
            lo_, hi_ = (mid, hi_) if ok else (lo_, mid)
        xe = lo_
        digits = []
        for i, f in enumerate(FINGERS):
            slack = 0.96 * (f['len'][0] + f['len'][1]) - np.linalg.norm(dip_target(i, xe) - mcps[i])
            T = dip_target(i, xe, min(max(slack * 0.6, 0.0), 0.006))
            P, D = ik(mcps[i], T, f['len'][0], f['len'][1], N)
            tt = cen + N * (back - PT + 0.001) + xp * (xe + f['r'][3] * 0.85) + e * float((D - cen) @ e)
            tip = D + (tt - D) / np.linalg.norm(tt - D) * f['len'][2]
            J = [Vector(mcps[i]), Vector(P), Vector(D), Vector(tip)]
            ups = []
            for k in range(3):
                dk = npv(J[k + 1] - J[k])
                ref = xp if k == 2 else N
                uk = ref - dk * (ref @ dk) / (dk @ dk)
                ups.append(Vector(uk / np.linalg.norm(uk)))
            digits.append((J, ups, f['r']))
        far = cen + N * back + xp * xe
        t_bot = max(float((m - cen) @ e) for m in mcps) + 0.020    # 手机底端比小指多出一点
        pcn = far + e * (t_bot - PL / 2) - xp * (PW / 2) - N * (PT / 2)
        R = np.array([xp, N, e])
        # 拇指：从腕掌关节出来，贴着近端长边、在屏幕一侧往手机顶端伸，指肚压着边框
        near = pcn - xp * (PW / 2) - N * (PT / 2)                  # 近边、屏幕面
        Jt = [at(*THUMB['cmc'])]
        q1 = npv(near) - e * 0.004 - xp * 0.006 - N * 0.0115
        dirs = [q1 - npv(Jt[0]), -e + xp * 0.10 + N * 0.03, -e + xp * 0.30 + N * 0.12]
        for k in range(3):
            dv = dirs[k] / np.linalg.norm(dirs[k])
            Jt.append(Jt[-1] + Vector(dv) * THUMB['len'][k])
        upv = Vector(-N - xp * 0.3).normalized()
        digits.append((Jt, [upv, Vector(-N), Vector(-N)], THUMB['r']))

        def tf(P):
            return (np.asarray(P) - pcn) @ R.T
        cupd = (0.0, 0.0, 0.0, 0.0)
    return dict(digits=digits, back=forearm(pose['dev'], pose['ext']), tf=tf, cup=cupd)


# ====================================================================== 皮肤
def build_field(pj):
    F = Field()
    fp = F.palm
    cup = pj['cup']
    # 手掌：圆角盒打底，手背一层往外拱，掌心三块肉（大鱼际、小鱼际、指根下面一条）
    fp.append(F.rbox(at(0.046, -0.001, -0.001), (0.037, 0.0118, 0.035), 0.0105, 0.010))
    fp.append(F.ell(at(0.050, 0.0025, -0.001), (0.040, 0.0105, 0.035), (1, 0, 0), (0, 1, 0), 0.012))
    fp.append(F.ell(at(0.032, -0.0095, 0.019), (0.027, 0.0125, 0.016), at(0.8, 0, 0.45), (0, 1, 0), 0.012))      # 大鱼际
    fp.append(F.ell(at(0.042, -0.0085, -0.026), (0.033, 0.0105, 0.0125), (1, 0, 0), (0, 1, 0), 0.010))          # 小鱼际
    fp.append(F.ell(at(0.074, -0.0095 + cup[3] * 0.5, -0.001), (0.0115, 0.0075, 0.035), (1, 0, 0), (0, 1, 0), 0.008))
    # 腕骨、手腕、小臂（椭圆截面，顺着小臂方向）
    fp.append(F.ell(at(0.010, -0.0005, 0.0), (0.022, 0.0172, 0.0285), (1, 0, 0), (0, 1, 0), 0.012))
    back = pj['back']
    bup = (Vector((0, 1, 0)) - back * back.y).normalized()
    for i, d in enumerate((0.0, 0.026, 0.052, 0.078)):
        fp.append(F.ell(back * d, (0.022, 0.0175 + d * 0.05, 0.0270 + d * 0.04), back, bup, 0.012))
    # 掌骨头（拳峰）、手背的伸肌腱
    for i, f in enumerate(FINGERS):
        cn = cup[i]
        mcp = at(f['l'], f['n'] + cn, f['w'])
        sc = f['r'][0] / 0.0104
        fp.append(F.ell(mcp + at(-0.002, 0.0042, 0), (0.0088 * sc, 0.0080 * sc, 0.0090 * sc), (1, 0, 0), (0, 1, 0), 0.006))
        fp.append(F.rcone(at(0.022, 0.0092, f['w'] * 0.55), mcp + at(-0.008, 0.0098, 0), 0.0020, 0.0023, 0.004))
    # 手指
    for di, (J, ups, r) in enumerate(pj['digits']):
        thumb = di == 4
        pr = []
        ku = 0.84 if thumb else 0.88
        kj = 0.0028
        for s in range(3):
            a, b = J[s], J[s + 1]
            if thumb and s == 0:
                pr.append(F.rcone(a, b, r[0], r[1], 0.006, ups[0], 0.9))
                continue
            pr.append(F.rcone(a, b, r[s], r[s + 1], kj, ups[s], ku))
            d, u, sd = frame(b - a, ups[s])
            L = (b - a).length
            mid = npv(a) + d * (0.5 * L)
            # 指腹（掌面那一侧鼓出来的肉），最后一节的指尖肉更饱满、往前一点
            if s == 2:
                r3 = r[3]
                pr.append(F.ell(npv(a) + d * (0.62 * L) - u * (0.28 * r3), (0.55 * L + 0.2 * r3, 0.70 * r3, 0.86 * r3), d, u, 0.003))
                # 甲床：指尖手背一侧平而饱满，指甲才能平平地一直铺到前面
                pr.append(F.ell(npv(a) + d * (L + 0.05 * r3) + u * (0.25 * r3), (0.95 * r3, 0.66 * r3, 0.80 * r3), d, u, 0.003))
            else:
                pr.append(F.ell(mid - u * (0.30 * r[s + 1]), (0.42 * L, 0.60 * r[s + 1], 0.80 * r[s + 1]), d, u, 0.003))
            # 中间那个关节（PIP）两侧骨头略宽、手背一侧微微鼓
            if s == 1 and not thumb:
                rj = r[1]
                pr.append(F.ell(npv(a), (0.7 * rj, 0.86 * rj, 0.995 * rj), d, u, 0.0025))
                pr.append(F.ell(npv(a) + u * (0.50 * rj), (0.55 * rj, 0.40 * rj, 0.66 * rj), d, u, 0.0025))
        if thumb:
            # 大鱼际跟着拇指掌骨走（虎口、拇指根才不会细成一截脖子）
            d, u, sd = frame(J[1] - J[0], ups[0])
            L0 = (J[1] - J[0]).length
            pr.append(F.ell(npv(J[0]) + d * (0.42 * L0) - u * 0.0035, (0.60 * L0, 0.0150, 0.0175), d, u, 0.006))
            d, u, sd = frame(J[2] - J[1], ups[1])
            pr.append(F.ell(npv(J[1]) + u * (0.45 * r[1]), (0.55 * r[1], 0.42 * r[1], 0.8 * r[1]), d, u, 0.003))
        F.digits.append((pr, 0.011 if thumb else 0.0065))
    return F


def skin_colors(field, pj, V, Nr):
    Fp, Fd = field.parts(V)
    own = np.argmin(np.stack([Fp] + Fd), axis=0)            # 0 = 手掌，i = 第 i 根手指
    dors = Nr[:, 1].copy()                                  # 手掌：法线朝手背的程度
    knk = np.zeros(len(V))
    tipw = np.zeros(len(V))
    crease = np.zeros(len(V))
    fold = np.zeros(len(V))
    for di, (J, ups, r) in enumerate(pj['digits']):
        sel = own == di + 1
        if not sel.any():
            continue
        P = V[sel]
        best = np.full(len(P), 1e9)
        dd = np.zeros(len(P))
        for s in range(3):
            a, b = npv(J[s]), npv(J[s + 1])
            ab = b - a
            t = np.clip(((P - a) @ ab) / (ab @ ab), 0, 1)
            q = a + np.outer(t, ab)
            dist = np.linalg.norm(P - q, axis=1)
            u = frame(ab, ups[s])[1]
            m = dist < best
            best[m] = dist[m]
            dd[m] = (Nr[sel][m] @ u)
        dors[sel] = dd
        # 指节皱褶：手背一侧、关节前后几毫米；掌面一侧是关节横纹
        for s in (1, 2):
            a = npv(J[s])
            dax = frame(npv(J[s + 1]) - a, ups[s])[0]
            along = (P - a) @ dax
            rad = np.linalg.norm(P - a, axis=1)
            w = np.exp(-(along / (0.0055 if s == 1 else 0.004)) ** 2) * (rad < r[s] * 1.8)
            knk[sel] = np.maximum(knk[sel], w * np.clip(dd * 1.6, 0, 1) * (0.75 if s == 1 else 0.45))
            crease[sel] = np.maximum(crease[sel], np.exp(-(along / 0.0012) ** 2) * (rad < r[s] * 1.8) * np.clip(-dd * 1.6, 0, 1))
        tipw[sel] = np.exp(-(np.linalg.norm(P - npv(J[3]), axis=1) / (1.7 * r[3])) ** 2)
        # 甲沟：指甲轮廓外面一两毫米的皮肤发红一点
        nf = nail_frame(J, ups, r, di == 4)
        q = P - nf['D']
        rho = nail_rho(q @ nf['d'], q @ nf['s'], nf)
        fw = np.clip(1.0 - np.abs(rho - 1.06) / 0.2, 0, 1) * np.clip((q @ nf['u']) / (0.4 * r[3]), 0, 1)
        fold[sel] = fw
    # 拳峰（掌骨头）也有点发红
    for i, f in enumerate(FINGERS):
        mcp = npv(at(f['l'] - 0.001, f['n'] + pj['cup'][i] + 0.008, f['w']))
        w = np.exp(-(np.linalg.norm(V - mcp, axis=1) / 0.0075) ** 2) * (own == 0)
        knk = np.maximum(knk, w * 0.55)
    t = np.clip((dors + 0.35) / 0.7, 0, 1)
    t = t * t * (3 - 2 * t)
    col = SK['palm'][None, :] * (1 - t)[:, None] + SK['back'][None, :] * t[:, None]
    col = col + (SK['knuckle'] - col) * (0.65 * knk)[:, None]
    col = col + (SK['tip'] - col) * (0.55 * tipw * (1 - t * 0.6))[:, None]
    col = col + (SK['crease'] - col) * (0.6 * crease)[:, None]
    col = col + (SK['fold'] - col) * (0.6 * fold)[:, None]
    # 一点低频的深浅变化（皮肤不是一个颜色）
    n = np.sin(V[:, 0] * 310 + 1.3) * np.sin(V[:, 1] * 270 + 0.4) * np.sin(V[:, 2] * 290 + 2.1)
    col = col * (1.0 + 0.035 * n)[:, None]
    return np.clip(col, 0, 1)


_SKIN = {}


def skin_mesh(name):
    """多边形化的皮肤（和档位无关）：缓存在内存和 .cache 里，建模脚本改了才重算"""
    if name in _SKIN:
        return _SKIN[name]
    with open(__file__, 'rb') as f:
        key = hashlib.sha1(f.read() + name.encode()).hexdigest()[:16]
    cdir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.cache')
    cpath = os.path.join(cdir, 'handskin_%s.pkl' % name)
    if os.path.exists(cpath):
        with open(cpath, 'rb') as f:
            k, res = pickle.load(f)
        if k == key:
            _SKIN[name] = res
            return res
    pj = pose_joints(name)
    field = build_field(pj)
    F, org = field.grid(GRID_H)
    V, Q = surface_nets(F, org, GRID_H)
    V = project(field, V)
    g = field.grad(V)
    Nr = g / np.maximum(np.linalg.norm(g, axis=1), 1e-12)[:, None]
    # 面朝向再核一遍：四边形法线和梯度反着就倒过来
    a, b, c = V[Q[:, 0]], V[Q[:, 1]], V[Q[:, 2]]
    fn = np.cross(b - a, c - a) + np.cross(c - a, V[Q[:, 3]] - a)
    flip = np.einsum('ij,ij->i', fn, Nr[Q[:, 0]] + Nr[Q[:, 2]]) < 0
    Q[flip] = Q[flip][:, ::-1]
    C = skin_colors(field, pj, V, Nr)
    res = dict(V=V, Q=Q, C=C)
    os.makedirs(cdir, exist_ok=True)
    with open(cpath, 'wb') as f:
        pickle.dump((key, res), f)
    _SKIN[name] = res
    return res


# ====================================================================== 指甲
def raycast(field, O, D, far=0.05):
    t = np.zeros(len(O))
    for _ in range(160):
        f = field(O + D * t[:, None])
        t += np.where(f > 0, np.clip(f, 2e-6, 0.002), f) * 0.9   # 越过表面就往回退；离得远（场值只算附近的基元）时一步最多 2 毫米
        if np.all((np.abs(f) < 1e-6) | (t > far)):
            break
    return O + D * t[:, None]


def nail_frame(J, ups, r, thumb):
    """指甲在最后一节上的位置：甲根约在这一节一半处，前缘离指尖不到 1 毫米；宽约指尖的六成多，长宽比约 1.25。"""
    D, T = npv(J[2]), npv(J[3])
    d, u, s = frame(T - D, ups[2])
    Lt = np.linalg.norm(T - D) + r[3]
    hb = (0.68 if thumb else 0.62) * (r[2] + r[3]) / 2
    return dict(D=D, d=d, u=u, s=s, x0=0.45 * Lt, x1=0.965 * Lt, hb=hb)


def outline(th, nf):
    """圆角长方形的轮廓（超椭圆）：甲根那头圆一点，前缘方一点（剪过）"""
    cx, cy = math.cos(th), math.sin(th)
    p = 2.2 if cx < 0 else 3.6
    xc, ha = (nf['x0'] + nf['x1']) / 2, (nf['x1'] - nf['x0']) / 2
    return xc + ha * math.copysign(abs(cx) ** (2 / p), cx), nf['hb'] * math.copysign(abs(cy) ** (2 / p), cy), cx


def nail_rho(x, y, nf):
    """点在指甲轮廓里的「半径」（1 = 轮廓上）"""
    xc, ha = (nf['x0'] + nf['x1']) / 2, (nf['x1'] - nf['x0']) / 2
    ex = (x - xc) / ha
    p = np.where(ex < 0, 2.2, 3.6)
    return (np.abs(ex) ** p + np.abs(y / nf['hb']) ** p) ** (1 / p)


def nail(field, J, ups, r, L, thumb=False):
    """指甲片：轮廓从上往下投到皮肤上量出高度；后半段贴着皮肤，前半段顺着甲根的走势平着伸出去（不跟着指尖往下包），
    中间抬起一点；根部和两侧压进皮肤褶，前缘下面一圈窄边看得出厚度。"""
    nf = nail_frame(J, ups, r, thumb)
    D, d, u, s = nf['D'], nf['d'], nf['u'], nf['s']
    rings = ((0.0, 0.28, 0.52, 0.72, 0.86, 0.95, 1.0), (0.0, 0.35, 0.65, 0.86, 0.95, 1.0), (0.0, 0.45, 0.8, 0.95, 1.0), (0.0, 0.6, 0.93, 1.0))[L]
    nseg = (28, 20, 14, 10)[L]
    xs, ys, info = [], [], []
    xc = (nf['x0'] + nf['x1']) / 2
    for ri, rho in enumerate(rings):
        for k in range(1 if rho == 0 else nseg):
            ox, oy, cx = outline(k / nseg * 2 * math.pi, nf)
            xs.append(xc + rho * (ox - xc))
            ys.append(rho * oy)
            info.append((rho, cx))
    xs, ys = np.array(xs), np.array(ys)
    n = len(xs)
    xm = nf['x0'] + 0.45 * (nf['x1'] - nf['x0'])
    xa = nf['x0'] + 0.08 * (nf['x1'] - nf['x0'])

    def height(x, y):
        O = D + np.outer(x, d) + np.outer(y, s) + u * (r[2] + 0.008)
        H = raycast(field, O, np.tile(-u, (len(O), 1)))
        miss = np.abs(field(H)) > 1e-4
        if miss.any():
            H[miss] = project(field, O[miss] - u * (r[2] + 0.006), it=8)
        return (H - D) @ u
    h = height(np.concatenate([xs, np.full(n, xm), np.full(n, xa)]), np.concatenate([ys, ys, ys]))
    hs, hm, ha_ = h[:n], h[n:2 * n], h[2 * n:]
    slope = (hm - ha_) / (xm - xa)
    dx = np.maximum(xs - xm, 0.0)
    hp = np.where(xs > xm, np.maximum(hs, hm + slope * dx - 9.0 * dx * dx), hs)
    lift = (0.00034, 0.00042, 0.0005, 0.0007)[L]
    pts, cols, ref = [], [], []
    for i, (rho, cx) in enumerate(info):
        edge = cx > 0.3
        if rho >= 1.0:
            o = lift * 0.5 if edge else -0.00028
        elif rho >= 0.95:
            o = lift * (0.85 if edge else 0.6)
        else:
            o = lift
        pts.append(D + d * xs[i] + s * ys[i] + u * (hp[i] + o))
        c = SK['nail'].copy()
        if edge and rho >= 0.86:
            c = c + (SK['nail_edge'] - c) * (0.8 if rho >= 0.95 else 0.35)
        elif cx < -0.5 and 0.28 <= rho <= 0.72:
            c = c + (SK['lunula'] - c) * 0.18
        cols.append(c)
        ref.append(u)
    # 外缘往下一圈（前缘的厚度；甲根、两侧这一圈埋在皮肤里）
    base = len(pts)
    for i in range(n - nseg, n):
        rho, cx = info[i]
        ox = (xs[i] - xc) / max((nf['x1'] - nf['x0']) / 2, 1e-9)
        oy = ys[i] / nf['hb']
        pts.append(pts[i] - u * 0.0006)
        c = SK['nail_edge'] if cx > 0.3 else SK['nail']
        cols.append(c)
        on = d * ox + s * oy
        ref.append(on / max(np.linalg.norm(on), 1e-9))
    P = np.array(pts)
    starts = [0] + [1 + (ri - 1) * nseg for ri in range(1, len(rings))]
    faces = [(0, starts[1] + k, starts[1] + (k + 1) % nseg) for k in range(nseg)]
    for ri in range(1, len(rings) - 1):
        a0, b0 = starts[ri], starts[ri + 1]
        faces += [(a0 + k, b0 + k, b0 + (k + 1) % nseg, a0 + (k + 1) % nseg) for k in range(nseg)]
    a0 = starts[-1]
    faces += [(a0 + k, base + k, base + (k + 1) % nseg, a0 + (k + 1) % nseg) for k in range(nseg)]
    out = []
    for f in faces:
        a, b, c = P[f[0]], P[f[1]], P[f[2]]
        fn = np.cross(b - a, c - a)
        if len(f) == 4:
            fn = fn + np.cross(c - a, P[f[3]] - a)
        out.append(tuple(reversed(f)) if fn @ (ref[f[0]] + ref[f[-1]]) < 0 else f)
    return P, out, cols


# ====================================================================== 袖口、外套袖子
def sleeve(back, L):
    """白衬衫袖口和深蓝外套袖子：都有里外两层和前面一圈翻边（从袖口看进去不是空的）。"""
    up = (Vector((0, 1, 0)) - back * back.y).normalized()
    sd = back.cross(up).normalized()
    seg = (28, 22, 16, 12)[L]
    P, C, Fc, Nn = [], [], [], []

    def ring(d, a, b, col, nmode, lift=0.0):
        out = []
        for k in range(seg):
            th = k / seg * 2 * math.pi
            cs, sn = math.cos(th), math.sin(th)
            p = back * d + sd * (a * cs) + up * (b * sn + lift)
            n = (sd * (cs / a) + up * (sn / b)).normalized()
            if nmode == 'in':
                n = -n
            elif nmode == 'lip':
                n = (n * 0.35 - back).normalized()
            P.append(npv(p))
            C.append(col)
            Nn.append(npv(n))
            out.append(len(P) - 1)
        return out

    def join(r0, r1):
        for k in range(seg):
            k1 = (k + 1) % seg
            Fc.append((r0[k], r0[k1], r1[k1], r1[k]))

    def tube(prof):
        rs = [ring(*q) for q in prof]
        for i in range(len(rs) - 1):
            join(rs[i], rs[i + 1])
    # 袖口：里层 → 翻边 → 外层
    tube([(0.095, 0.0300, 0.0242, SK['cuff_in'], 'in'), (0.052, 0.0310, 0.0252, SK['cuff_in'], 'in'),
          (0.0485, 0.0327, 0.0268, SK['cuff'], 'lip'), (0.0505, 0.0343, 0.0283, SK['cuff'], 'out'),
          (0.068, 0.0350, 0.0290, SK['cuff'], 'out'), (0.095, 0.0356, 0.0296, SK['cuff'], 'out')])
    # 外套袖子：里子 → 袖口翻边 → 外面一圈圈褶
    prof = [(0.20, 0.041, 0.035, SK['lining'], 'in'), (0.071, 0.0410, 0.0350, SK['lining'], 'in'),
            (0.0665, 0.0435, 0.0375, SK['sleeve2'], 'lip'), (0.0695, 0.0462, 0.0402, SK['sleeve2'], 'out')]
    for i in range(1, 10):
        dd = 0.068 + i * 0.04
        wob = (0.004 if i % 2 else -0.002) if i < 9 else 0.0
        prof.append((dd, 0.046 + i * 0.0035 + wob, 0.040 + i * 0.0032 + wob * 0.6, SK['sleeve2'] if i % 2 else SK['sleeve'], 'out'))
    tube(prof)
    P = np.array(P)
    Nn = np.array(Nn)
    out = []
    for f in Fc:
        a, b, c = P[f[0]], P[f[1]], P[f[2]]
        fn = np.cross(b - a, c - a) + np.cross(c - a, P[f[3]] - a)
        out.append(tuple(reversed(f)) if fn @ (Nn[f[0]] + Nn[f[2]]) < 0 else f)
    return P, out, C


# ====================================================================== 组装
def hand(A, name):
    pj = pose_joints(name)
    tf = pj['tf']
    sk = skin_mesh(name)
    V = tf(sk['V'])
    p = A.mesh('dark', [tuple(v) for v in V], [tuple(q) for q in sk['Q']], (1.0, 1.0, 1.0), 1.0, smooth=True, sharp=None, name='skin',
               cols=[tuple(c) for c in sk['C']], ao=0.6)
    ratio = SKIN_TRIS[A.L] / (2.0 * len(sk['Q']))
    if ratio < 1.0:
        A.modifier(p, 'DECIMATE', ratio=ratio, use_collapse_triangulate=True)
    field = build_field(pj)
    for di, (J, ups, r) in enumerate(pj['digits']):
        P, F, C = nail(field, J, ups, r, A.L, thumb=(di == 4))
        A.mesh('dark', [tuple(v) for v in tf(P)], F, (1.0, 1.0, 1.0), 1.0, smooth=True, sharp=None, name='nail', cols=[tuple(c) for c in C], ao=0.6)
    P, F, C = sleeve(pj['back'], A.L)
    A.mesh('dark', [tuple(v) for v in tf(P)], F, (1.0, 1.0, 1.0), 1.0, smooth=True, sharp=None, name='sleeve', cols=[tuple(c) for c in C], ao=0.8)


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
