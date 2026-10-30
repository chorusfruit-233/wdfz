"""资产建模上下文：一件东西（课桌、轿车、一棵树、一个人）由若干零件组成。

坐标：游戏坐标，米，y 朝上；家具的「正面」按 furniture.js 的约定（例如学生椅人朝 -z 坐）。
档位 L：0 = 真实、1 = 超精细、2 = 均衡/精细、3 = 流畅。分段、倒角、细小零件按档位取舍，外形和尺寸各档一致。
每个零件是一个 Blender 物体，记下材质键（对应游戏 materials.js 的 MAT_DEF）、颜色、贴图投影方式和碰撞代理。
碰撞代理（盒 / 圆柱 / 杆 / 椭球）和游戏里穿模审查、家具占地用的形状是同一套。"""
import math
from contextlib import contextmanager

import bmesh
import bpy
from mathutils import Matrix, Vector

from .geom import V, hexrgb, euler, frame_from_dir, fillet_path, transport_frames

SEG_K = (1.7, 1.2, 0.8, 0.55)       # 圆周分段倍数
BEV_SEG = (3, 2, 1, 1)               # 倒角最多几段
BEV_MIN = (0.0, 0.002, 0.006, 0.02)  # 比这还小的倒角在这一档省掉


class Part:
    __slots__ = ('ob', 'mat', 'tag', 'rgb', 'uv', 'ao', 'name', 'vcol', 'emit')

    def __init__(self, ob, mat, tag, rgb, uv, ao=1.0, name='', vcol=False):
        self.ob, self.mat, self.tag, self.rgb, self.uv, self.ao, self.name, self.vcol = ob, mat, tag, rgb, uv, ao, name, vcol
        self.emit = False


class Asset:
    """一件资产在某个档位下的建模过程。"""

    def __init__(self, name, L, spec):
        self.name = name
        self.L = L
        self.spec = spec
        self.parts = []
        self.proxies = []
        self.anchors = {}
        self.meta = {}
        self.T = Matrix.Identity(4)
        self._n = 0
        self.aux = []
        self.coll = bpy.data.collections.new('asset_' + name)
        bpy.context.scene.collection.children.link(self.coll)

    # ------------------------------------------------------------------ 档位
    @property
    def hi(self):
        return self.L <= 1

    @property
    def lo(self):
        return self.L >= 3

    def seg(self, n, lo=4):
        return max(lo, int(round(n * SEG_K[self.L])))

    def bev(self, w):
        """倒角宽度、段数。流畅档小倒角直接省掉。"""
        if w <= 0:
            return 0.0, 0
        if w < BEV_MIN[self.L]:
            return 0.0, 0
        # 小倒角不用分那么多段（3 毫米以下一段、6 毫米两段……）
        return w, max(1, min(BEV_SEG[self.L], int(round(w / 0.0028))))

    def detail(self, size):
        """这么大的小零件这一档要不要：真实全要、超精细 4 毫米以上、均衡 1.5 厘米以上、流畅 4 厘米以上。"""
        return size >= (0.0, 0.004, 0.015, 0.04)[self.L]

    # ------------------------------------------------------------------ 坐标
    @contextmanager
    def at(self, x=0.0, y=0.0, z=0.0, ry=0.0, rx=0.0, rz=0.0, s=1.0):
        old = self.T
        m = Matrix.Translation((x, y, z)) @ euler(rx, ry, rz)
        if s != 1.0:
            m = m @ Matrix.Scale(s, 4)
        self.T = old @ m
        try:
            yield
        finally:
            self.T = old

    def P(self, p):
        return self.T @ V(p)

    def yaw(self):
        """当前坐标系绕 y 的转角（只用于碰撞代理；有俯仰/侧倾时代理按外包盒算）。"""
        m = self.T.to_3x3()
        return math.atan2(m[0][2], m[0][0])

    def tilted(self):
        m = self.T.to_3x3()
        return abs(m[1][1] - 1.0) > 1e-4

    # ------------------------------------------------------------------ 零件
    def _obj(self, name, me):
        self._n += 1
        ob = bpy.data.objects.new('%s_%03d_%s' % (self.name, self._n, name or 'p'), me)
        self.coll.objects.link(ob)
        return ob

    def _add(self, ob, mat, col, shade, tag, uv, ao, name, vcol=False):
        rgb = col if isinstance(col, tuple) else hexrgb(col, shade)
        p = Part(ob, mat, tag, rgb, uv, ao, name, vcol)
        if mat in ('emit', 'emitDying', 'lamp', 'litwin', 'sky'):
            p.emit = True
        self.parts.append(p)
        return p

    def _bm_to_obj(self, bm, name, smooth=True):
        me = bpy.data.meshes.new(name or 'm')
        for f in bm.faces:
            f.smooth = smooth
        bm.normal_update()
        bm.to_mesh(me)
        bm.free()
        return self._obj(name, me)

    # ---- 盒子（可倒角）。rot 可以是绕 y 的角度，或 (rx, ry, rz)
    def box(self, mat, c, s, col, shade=1.0, bev=0.0, rot=0.0, tag='', uv='box', proxy=True, ao=1.0, name='box', bseg=None):
        sx, sy, sz = s
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        R = euler(*rot) if isinstance(rot, (tuple, list)) else euler(0, rot, 0)
        M = self.T @ Matrix.Translation(c) @ R
        for v in bm.verts:
            v.co = M @ Vector((v.co.x * sx, v.co.y * sy, v.co.z * sz))
        if M.determinant() < 0:
            bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
        for e in bm.edges:
            e.smooth = False
        ob = self._bm_to_obj(bm, name)
        ob['uvm'] = [list(r) for r in M.inverted()]
        w, n = self.bev(bev)
        w = min(w, 0.45 * min(sx, sy, sz))
        if w > 1e-4 and n > 0:
            md = ob.modifiers.new('bv', 'BEVEL')
            md.width = w
            md.segments = bseg if bseg is not None else n
            md.limit_method = 'ANGLE'
            md.angle_limit = math.radians(30)
            md.harden_normals = True
            md.profile = 0.5
        p = self._add(ob, mat, col, shade, tag, uv, ao, name)
        if proxy:
            self._proxy_box(Matrix.Translation(c) @ R, (sx / 2, sy / 2, sz / 2), isinstance(rot, (tuple, list)) and (abs(rot[0]) > 1e-6 or abs(rot[2]) > 1e-6))
        return p

    def _proxy_box(self, Mloc, h, tilted):
        M = self.T @ Mloc
        c = M.to_translation()
        if tilted or self.tilted():
            # 有俯仰或侧倾：碰撞代理用外包盒
            pts = [M @ Vector((sx * h[0], sy * h[1], sz * h[2])) for sx in (-1, 1) for sy in (-1, 1) for sz in (-1, 1)]
            lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
            hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
            self.proxies.append({'t': 'box', 'c': list((lo + hi) / 2), 'h': list((hi - lo) / 2), 'a': 0.0})
            return
        m = M.to_3x3()
        a = math.atan2(m[0][2], m[0][0])
        self.proxies.append({'t': 'box', 'c': list(c), 'h': list(h), 'a': a})

    # ---- 旋转体：prof = [(半径, 高度), ...]，绕局部 y 轴。base 是轴上 y=0 的点；dirn 给定时轴朝 dirn
    def lathe(self, mat, base, prof, col, shade=1.0, seg=12, sharp=35.0, tag='', uv='cyl', proxy=True, ao=1.0, name='lathe', dirn=None, cap0=True, cap1=True, phase=0.0, smooth=True):
        n = self.seg(seg, 5 if self.L >= 3 else 6)
        prof = [(float(r), float(h)) for r, h in prof]
        if dirn is not None:
            F = frame_from_dir(dirn).to_4x4()
        else:
            F = Matrix.Identity(4)
        M = self.T @ Matrix.Translation(base) @ F
        bm = bmesh.new()
        rings = []
        for (r, h) in prof:
            if r < 1e-5:
                rings.append([bm.verts.new(M @ Vector((0, h, 0)))])
            else:
                ring = []
                for k in range(n):
                    a = phase + k / n * 2 * math.pi
                    ring.append(bm.verts.new(M @ Vector((math.cos(a) * r, h, -math.sin(a) * r))))
                rings.append(ring)
        # 轮廓上每个折点是不是硬棱
        sharpk = []
        for i in range(len(prof)):
            if i == 0 or i == len(prof) - 1:
                sharpk.append(False)
                continue
            a = Vector((prof[i][0] - prof[i - 1][0], prof[i][1] - prof[i - 1][1]))
            b = Vector((prof[i + 1][0] - prof[i][0], prof[i + 1][1] - prof[i][1]))
            if a.length < 1e-9 or b.length < 1e-9:
                sharpk.append(True)
                continue
            ang = math.degrees(a.angle(b))
            sharpk.append(ang > sharp)
        for i in range(len(prof) - 1):
            A, B = rings[i], rings[i + 1]
            if len(A) == 1 and len(B) == 1:
                continue
            for k in range(n):
                k1 = (k + 1) % n
                if len(A) == 1:
                    f = bm.faces.new((A[0], B[k1], B[k]))
                elif len(B) == 1:
                    f = bm.faces.new((A[k], A[k1], B[0]))
                else:
                    f = bm.faces.new((A[k], A[k1], B[k1], B[k]))
        bm.verts.ensure_lookup_table()
        # 两头封口
        if cap0 and len(rings[0]) > 1:
            c = bm.verts.new(M @ Vector((0, prof[0][1], 0)))
            for k in range(n):
                bm.faces.new((rings[0][(k + 1) % n], rings[0][k], c))
            for k in range(n):
                e = bm.edges.get((rings[0][k], rings[0][(k + 1) % n]))
                if e:
                    e.smooth = False
        if cap1 and len(rings[-1]) > 1:
            c = bm.verts.new(M @ Vector((0, prof[-1][1], 0)))
            for k in range(n):
                bm.faces.new((rings[-1][k], rings[-1][(k + 1) % n], c))
            for k in range(n):
                e = bm.edges.get((rings[-1][k], rings[-1][(k + 1) % n]))
                if e:
                    e.smooth = False
        for i, sk in enumerate(sharpk):
            if sk and len(rings[i]) > 1:
                for k in range(n):
                    e = bm.edges.get((rings[i][k], rings[i][(k + 1) % n]))
                    if e:
                        e.smooth = False
        if uv == 'cyl':
            self._lathe_uv(bm, prof, rings, n, phase)
            uv = 'mesh'
        ob = self._bm_to_obj(bm, name, smooth=smooth)
        p = self._add(ob, mat, col, shade, tag, uv, ao, name)
        if proxy:
            for i in range(len(prof) - 1):
                (r0, h0), (r1, h1) = prof[i], prof[i + 1]
                if abs(h1 - h0) < 0.004 or max(r0, r1) < 0.002:
                    continue
                if dirn is None and not self.tilted():
                    lo, hi = (r0, h0), (r1, h1)
                    if h0 > h1:
                        lo, hi = hi, lo
                    cc = M @ Vector((0, lo[1], 0))
                    self.proxies.append({'t': 'cyl', 'c': list(cc), 'rb': lo[0], 'rt': hi[0], 'hh': hi[1] - lo[1]})
                else:
                    a = M @ Vector((0, h0, 0))
                    b = M @ Vector((0, h1, 0))
                    self.proxies.append({'t': 'rod', 'a': list(a), 'b': list(b), 'r0': r0, 'r1': r1})
        return p

    def _lathe_uv(self, bm, prof, rings, n, phase):
        ul = bm.loops.layers.uv.new('UVMap')
        acc = [0.0]
        for i in range(1, len(prof)):
            acc.append(acc[-1] + math.hypot(prof[i][0] - prof[i - 1][0], prof[i][1] - prof[i - 1][1]))
        rmax = max(1e-3, max(r for r, _h in prof))
        per = 2 * math.pi * rmax
        vi = {}
        for i, ring in enumerate(rings):
            for k, v in enumerate(ring):
                vi[v] = (i, k)
        for f in bm.faces:
            ks = [vi[lp.vert][1] for lp in f.loops if lp.vert in vi and len(rings[vi[lp.vert][0]]) > 1]
            wrap = ks and max(ks) == n - 1 and min(ks) == 0
            kc = sum(ks) / len(ks) if ks else 0
            for lp in f.loops:
                if lp.vert in vi:
                    i, k = vi[lp.vert]
                    if len(rings[i]) == 1:
                        k = kc
                    kk = k + n if (wrap and k == 0) else k
                    lp[ul].uv = (kk / n * per, acc[i])
                else:   # 封口中心
                    lp[ul].uv = (per * kc / n, 0.0)

    def cyl(self, mat, base, rb, rt, h, col, shade=1.0, seg=12, caps=True, round_=0.0, tag='', uv='cyl', proxy=True, ao=1.0, name='cyl', dirn=None):
        """竖直的圆柱/圆台（base 是底面中心）。round_ > 0 时两头的棱倒成圆角。"""
        prof = []
        f = round_ if self.L <= 2 else 0.0
        # 圆角分几段：档位越高越多，但几毫米的小圆角一两段就够了
        steps = max(1, min(3 if self.L == 0 else (2 if self.L == 1 else 1), int(round(f / 0.0025))))
        if caps and rb > 1e-4:
            prof.append((0.0, 0.0))
        if f > 1e-4 and rb > 1e-4 and caps:
            for k in range(steps + 1):
                a = k / steps * math.pi / 2
                prof.append((rb - f + f * math.sin(a), f - f * math.cos(a)))
        else:
            prof.append((rb, 0.0))
        if f > 1e-4 and rt > 1e-4 and caps:
            for k in range(steps, -1, -1):
                a = k / steps * math.pi / 2
                prof.append((rt - f + f * math.sin(a), h - f + f * math.cos(a)))
        else:
            prof.append((rt, h))
        if caps and rt > 1e-4:
            prof.append((0.0, h))
        return self.lathe(mat, base, prof, col, shade, seg, 35.0, tag, uv, proxy, ao, name, dirn=dirn, cap0=False, cap1=False)

    def rod(self, mat, a, b, r0, r1, col, shade=1.0, seg=8, caps=True, round_=0.0, tag='', uv='cyl', proxy=True, ao=1.0, name='rod'):
        """两点之间的杆（任意方向）。"""
        a, b = V(a), V(b)
        d = b - a
        L = d.length
        if L < 1e-6:
            return None
        prof = []
        f = min(round_, L * 0.3) if self.L <= 2 else 0.0
        st = max(1, min(2, int(round(f / 0.0025))))        # 圆角几段（不含和杆身相接的那一点）
        if caps:
            prof.append((0.0, 0.0))
        if f > 1e-4 and caps:
            prof += [(r0 - f + f * math.sin(t * math.pi / 2 / st), f - f * math.cos(t * math.pi / 2 / st)) for t in range(st)]
        prof.append((r0, f if (f > 1e-4 and caps) else 0.0))
        prof.append((r1, L - (f if (f > 1e-4 and caps) else 0.0)))
        if f > 1e-4 and caps:
            prof += [(r1 - f + f * math.sin(t * math.pi / 2 / st), L - f + f * math.cos(t * math.pi / 2 / st)) for t in range(st - 1, -1, -1)]
        if caps:
            prof.append((0.0, L))
        p = self.lathe(mat, a, prof, col, shade, seg, 35.0, tag, uv, False, ao, name, dirn=d, cap0=False, cap1=False)
        if proxy:
            self.proxies.append({'t': 'rod', 'a': list(self.P(a)), 'b': list(self.P(b)), 'r0': r0, 'r1': r1})
        return p

    # ---- 沿路径扫圆截面（弯管）。pts 是折线，bend 是拐角圆弧半径
    def tube(self, mat, pts, r, col, shade=1.0, seg=8, bend=0.0, caps=True, tag='', uv='cyl', proxy=True, ao=1.0, name='tube', closed=False, r1=None, ellip=1.0):
        steps = (8, 6, 4, 2)[self.L]
        path = fillet_path(pts, bend, steps) if bend > 0 else [V(p) for p in pts]
        if closed:
            path = path + [path[0]]
        n = self.seg(seg, 5 if self.L >= 3 else 6)
        rr = [r + ((r1 if r1 is not None else r) - r) * (i / max(1, len(path) - 1)) for i in range(len(path))]
        return self.sweep(mat, path, [(x, x * ellip) for x in rr], col, shade, n, caps and not closed, caps and not closed, tag, uv, proxy, ao, name)

    def sweep(self, mat, path, radii, col, shade=1.0, n=8, cap0=True, cap1=True, tag='', uv='cyl', proxy=True, ao=1.0, name='sweep', up=None, cols=None):
        """沿路径扫椭圆截面：radii[i] = (a 侧向, b 上向)。cols 给每圈一个颜色（顶点色）。"""
        path = [V(p) for p in path]
        T, N, B = transport_frames(path, up)
        bm = bmesh.new()
        rings = []
        for i, p in enumerate(path):
            a, b = radii[i]
            ring = []
            for k in range(n):
                t = k / n * 2 * math.pi
                q = p + B[i] * (math.cos(t) * a) - N[i] * (math.sin(t) * b)
                ring.append(bm.verts.new(self.T @ q))
            rings.append(ring)
        for i in range(len(rings) - 1):
            A, Bv = rings[i], rings[i + 1]
            for k in range(n):
                k1 = (k + 1) % n
                bm.faces.new((A[k], A[k1], Bv[k1], Bv[k]))

        def cap(ring, p, t, flip):
            c = bm.verts.new(self.T @ p)
            for k in range(n):
                k1 = (k + 1) % n
                f = bm.faces.new((ring[k1], ring[k], c) if not flip else (ring[k], ring[k1], c))
            for k in range(n):
                e = bm.edges.get((ring[k], ring[(k + 1) % n]))
                if e:
                    e.smooth = False
        if cap0:
            cap(rings[0], path[0], -T[0], False)
        if cap1:
            cap(rings[-1], path[-1], T[-1], True)
        if uv == 'cyl':
            ul = bm.loops.layers.uv.new('UVMap')
            acc = [0.0]
            for i in range(1, len(path)):
                acc.append(acc[-1] + (path[i] - path[i - 1]).length)
            vi = {}
            for i, ring in enumerate(rings):
                per = 2 * math.pi * max(radii[i])
                for k, v in enumerate(ring):
                    vi[v] = (i, k, per)
            for f in bm.faces:
                ks = [vi[lp.vert][1] for lp in f.loops if lp.vert in vi]
                wrap = ks and max(ks) == n - 1 and min(ks) == 0
                for lp in f.loops:
                    if lp.vert in vi:
                        i, k, per = vi[lp.vert]
                        kk = k + n if (wrap and k == 0) else k
                        lp[ul].uv = (kk / n * per, acc[i])
                    else:
                        lp[ul].uv = (0.0, 0.0)
            uv = 'mesh'
        if cols:
            lay = bm.loops.layers.color.new('col')
            vi = {}
            for i, ring in enumerate(rings):
                for v in ring:
                    vi[v] = cols[i]
            for f in bm.faces:
                for lp in f.loops:
                    c = vi.get(lp.vert)
                    if c is None:
                        c = cols[0] if (lp.vert.co - (self.T @ path[0])).length < (lp.vert.co - (self.T @ path[-1])).length else cols[-1]
                    lp[lay] = (c[0], c[1], c[2], 1.0)
        ob = self._bm_to_obj(bm, name)
        p = self._add(ob, mat, col, shade, tag, uv, ao, name, vcol=bool(cols))
        if proxy:
            # 每段一根杆
            acc = 0.0
            last = 0
            for i in range(1, len(path)):
                acc += (path[i] - path[i - 1]).length
                if acc > 0.12 or i == len(path) - 1:
                    a0 = path[last]
                    a1 = path[i]
                    r0 = max(radii[last])
                    r1 = max(radii[i])
                    self.proxies.append({'t': 'rod', 'a': list(self.P(a0)), 'b': list(self.P(a1)), 'r0': r0, 'r1': r1})
                    last = i
                    acc = 0.0
        return p

    # ---- 挤出体：prof 是局部 (u, v) 多边形（u 沿 x、v 沿 y，逆时针），沿 z 挤出 depth（以 c.z 为中心）
    def prism(self, mat, c, prof, depth, col, shade=1.0, bev=0.0, tag='', uv='box', proxy=True, ao=1.0, name='prism', rot=0.0, axis='z'):
        area = sum(prof[i][0] * prof[(i + 1) % len(prof)][1] - prof[(i + 1) % len(prof)][0] * prof[i][1] for i in range(len(prof)))
        if area < 0:
            prof = list(reversed(prof))
        bm = bmesh.new()
        R = euler(*rot) if isinstance(rot, (tuple, list)) else euler(0, rot, 0)
        if axis == 'x':
            R = R @ euler(0, math.pi / 2, 0)
        M = self.T @ Matrix.Translation(c) @ R
        hz = depth / 2
        front = [bm.verts.new(M @ Vector((u, v, hz))) for (u, v) in prof]
        back = [bm.verts.new(M @ Vector((u, v, -hz))) for (u, v) in prof]
        n = len(prof)
        bm.faces.new(front)
        bm.faces.new(list(reversed(back)))
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((front[i], back[i], back[j], front[j]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        for e in bm.edges:
            if len(e.link_faces) == 2:
                a, b = e.link_faces
                if a.normal.angle(b.normal, 0) > math.radians(30):
                    e.smooth = False
            else:
                e.smooth = False
        ob = self._bm_to_obj(bm, name)
        ob['uvm'] = [list(r) for r in M.inverted()]
        w, s = self.bev(bev)
        if w > 1e-4 and s > 0:
            md = ob.modifiers.new('bv', 'BEVEL')
            md.width = w
            md.segments = s
            md.limit_method = 'ANGLE'
            md.angle_limit = math.radians(30)
            md.harden_normals = True
        p = self._add(ob, mat, col, shade, tag, uv, ao, name)
        if proxy:
            us = [q[0] for q in prof]
            vs = [q[1] for q in prof]
            cc = Vector(((min(us) + max(us)) / 2, (min(vs) + max(vs)) / 2, 0))
            tilted = isinstance(rot, (tuple, list)) and (abs(rot[0]) > 1e-6 or abs(rot[2]) > 1e-6)
            self._proxy_box(Matrix.Translation(c) @ R @ Matrix.Translation(cc), ((max(us) - min(us)) / 2, (max(vs) - min(vs)) / 2, hz), tilted)
        return p

    # ---- 软的东西（枕头、床垫、被子、坐垫）：细分过的盒子往外鼓一点再平滑
    def cushion(self, mat, c, s, col, shade=1.0, puff=0.12, r=0.02, rot=0.0, tag='', uv='box', proxy=True, ao=1.0, name='cushion', sag=0.0, cuts=None):
        sx, sy, sz = s
        cuts = (4, 3, 2, 0)[self.L] if cuts is None else (min(cuts, (4, 3, 2, 0)[self.L]) if self.L < 3 else 0)
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        if cuts:
            bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=cuts, use_grid_fill=True)
        R = euler(*rot) if isinstance(rot, (tuple, list)) else euler(0, rot, 0)
        M = self.T @ Matrix.Translation(c) @ R
        for v in bm.verts:
            x, y, z = v.co.x, v.co.y, v.co.z           # -0.5..0.5
            # 鼓起来：离中心越近越鼓（上下两面），四周的边收一点
            bx = 1 - (2 * x) ** 2
            bz = 1 - (2 * z) ** 2
            py = y * (1 + puff * bx * bz * 2) if cuts else y
            sg = -sag * bx * bz if (cuts and y > 0) else 0.0
            v.co = M @ Vector((x * sx, py * sy + sg, z * sz))
        ob = self._bm_to_obj(bm, name)
        if self.L <= 2:
            md = ob.modifiers.new('ss', 'SUBSURF')
            md.levels = 1
        else:
            w, n = self.bev(r)
            if w > 0:
                md = ob.modifiers.new('bv', 'BEVEL')
                md.width = min(w, 0.4 * min(sx, sy, sz))
                md.segments = 1
        p = self._add(ob, mat, col, shade, tag, uv, ao, name)
        if proxy:
            self._proxy_box(Matrix.Translation(c) @ R, (sx / 2, sy / 2, sz / 2), isinstance(rot, (tuple, list)) and (abs(rot[0]) > 1e-6 or abs(rot[2]) > 1e-6))
        return p

    # ---- 椭球（可抖动成一团）
    def blob(self, mat, c, r, col, shade=1.0, seg=10, jit=0.0, seed=1, tag='', uv='box', proxy=True, ao=1.0, name='blob', rot=0.0):
        import random
        rnd = random.Random(seed)
        n = self.seg(seg, 6)
        rings = max(3, int(round(n * 0.55)))
        R = euler(*rot) if isinstance(rot, (tuple, list)) else euler(0, rot, 0)
        M = self.T @ Matrix.Translation(c) @ R
        bm = bmesh.new()
        top = bm.verts.new(M @ Vector((0, r[1], 0)))
        bot = bm.verts.new(M @ Vector((0, -r[1], 0)))
        grid = []
        for j in range(1, rings):
            ph = j / rings * math.pi
            row = []
            for i in range(n):
                th = i / n * 2 * math.pi
                k = 1.0 + (rnd.random() - 0.5) * jit if jit else 1.0
                row.append(bm.verts.new(M @ Vector((math.sin(ph) * math.cos(th) * r[0] * k, math.cos(ph) * r[1] * k, -math.sin(ph) * math.sin(th) * r[2] * k))))
            grid.append(row)
        for i in range(n):
            i1 = (i + 1) % n
            bm.faces.new((top, grid[0][i], grid[0][i1]))
            bm.faces.new((bot, grid[-1][i1], grid[-1][i]))
        for j in range(len(grid) - 1):
            for i in range(n):
                i1 = (i + 1) % n
                bm.faces.new((grid[j][i], grid[j + 1][i], grid[j + 1][i1], grid[j][i1]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        ob = self._bm_to_obj(bm, name)
        p = self._add(ob, mat, col, shade, tag, uv, ao, name)
        if proxy:
            cc = self.P(c)
            a = self.yaw() + (rot if not isinstance(rot, (tuple, list)) else rot[1])
            self.proxies.append({'t': 'blob', 'c': list(cc), 'r': list(r), 'a': a, 'jit': jit})
        return p

    # ---- 任意网格（顶点、面），局部坐标
    def mesh(self, mat, verts, faces, col, shade=1.0, smooth=True, sharp=40.0, tag='', uv='box', ao=1.0, name='mesh', cols=None, uvs=None):
        bm = bmesh.new()
        vs = [bm.verts.new(self.T @ V(p)) for p in verts]
        fl = []
        for f in faces:
            try:
                fl.append(bm.faces.new([vs[i] for i in f]))
            except ValueError:
                pass
        bm.normal_update()
        if sharp is not None:
            for e in bm.edges:
                if len(e.link_faces) == 2:
                    a, b = e.link_faces
                    if a.normal.angle(b.normal, 0) > math.radians(sharp):
                        e.smooth = False
                else:
                    e.smooth = False
        if cols is not None:
            bm.verts.index_update()
            lay = bm.loops.layers.color.new('col')
            for f in bm.faces:
                for lp in f.loops:
                    c = cols[lp.vert.index]
                    lp[lay] = (c[0], c[1], c[2], 1.0)
        if uvs is not None:
            ul = bm.loops.layers.uv.new('UVMap')
            for fi, f in enumerate(bm.faces):
                for k, lp in enumerate(f.loops):
                    lp[ul].uv = uvs[fi][k]
        ob = self._bm_to_obj(bm, name, smooth=smooth)
        return self._add(ob, mat, col, shade, tag, uv if uvs is None else 'mesh', ao, name, vcol=cols is not None)

    def quad(self, mat, pts, col, shade=1.0, tag='', uv='box', ao=1.0, name='quad', two=False, uvs=None):
        faces = [(0, 1, 2, 3)]
        u = [uvs] if uvs else None
        p = self.mesh(mat, pts, faces, col, shade, smooth=False, sharp=None, tag=tag, uv=uv, ao=ao, name=name, uvs=u)
        if two:
            self.mesh(mat, list(reversed(pts)), faces, col, shade, smooth=False, sharp=None, tag=tag, uv=uv, ao=ao, name=name, uvs=[list(reversed(uvs))] if uvs else None)
        return p

    # ---- 有机形体：骨架节点 + 半径，Skin 修改器长出连续的皮，再细分
    def skin(self, mat, nodes, edges, col, shade=1.0, sub=None, tag='', uv='box', ao=1.0, name='skin', root=0, smooth_shade=True):
        me = bpy.data.meshes.new(name)
        bm = bmesh.new()
        vs = [bm.verts.new(self.T @ V(p)) for (p, _r) in nodes]
        for a, b in edges:
            bm.edges.new((vs[a], vs[b]))
        bm.to_mesh(me)
        bm.free()
        ob = self._obj(name, me)
        sk = ob.modifiers.new('skin', 'SKIN')
        sk.use_smooth_shade = smooth_shade
        sc = self.T.to_scale()[0]
        for i, (_p, r) in enumerate(nodes):
            rr = r if isinstance(r, (tuple, list)) else (r, r)
            me.skin_vertices[0].data[i].radius = (rr[0] * sc, rr[1] * sc)
        me.skin_vertices[0].data[root].use_root = True
        levels = sub if sub is not None else (2, 2, 1, 0)[self.L]
        if levels > 0:
            ss = ob.modifiers.new('ss', 'SUBSURF')
            ss.levels = levels
            ss.render_levels = levels
        return self._add(ob, mat, col, shade, tag, uv, ao, name)

    # ---- 放样：一串截面（每圈点数一样，游戏坐标），相邻两圈连成四边形；cap 时两头封口
    def loft(self, mat, rings, col, shade=1.0, cap0=False, cap1=False, closed=True, sub=None, tag='', uv='box', ao=1.0, name='loft', smooth=True, sharp=None, faces_filter=None):
        verts, faces = loft_mesh(rings, cap0, cap1, closed)
        if faces_filter is not None:
            faces = [f for f in faces if faces_filter([verts[i] for i in f])]
        p = self.mesh(mat, verts, faces, col, shade, smooth=smooth, sharp=sharp, tag=tag, uv=uv, ao=ao, name=name)
        levels = sub if sub is not None else 0
        if levels > 0:
            md = p.ob.modifiers.new('ss', 'SUBSURF')
            md.levels = levels
        return p

    # ---- 布尔切掉一块（轮拱这类）：cutter 只用来切，不导出、不烘焙
    def cut_cylinder(self, part, c, r, length, axis='z', seg=32):
        me = bpy.data.meshes.new('cutter')
        bm = bmesh.new()
        n = max(16, seg)
        d = {'x': Vector((1, 0, 0)), 'y': Vector((0, 1, 0)), 'z': Vector((0, 0, 1))}[axis]
        F = frame_from_dir(d).to_4x4()
        M = self.T @ Matrix.Translation(c) @ F
        top, bot = [], []
        for k in range(n):
            a = k / n * 2 * math.pi
            bot.append(bm.verts.new(M @ Vector((math.cos(a) * r, -length / 2, math.sin(a) * r))))
            top.append(bm.verts.new(M @ Vector((math.cos(a) * r, length / 2, math.sin(a) * r))))
        for k in range(n):
            k1 = (k + 1) % n
            bm.faces.new((bot[k], bot[k1], top[k1], top[k]))
        bm.faces.new(list(reversed(bot)))
        bm.faces.new(top)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        bm.to_mesh(me)
        bm.free()
        ob = bpy.data.objects.new('cutter', me)
        self.coll.objects.link(ob)
        ob.hide_render = True
        self.aux.append(ob)
        md = part.ob.modifiers.new('cut', 'BOOLEAN')
        md.object = ob
        md.operation = 'DIFFERENCE'
        md.solver = 'EXACT'
        return ob

    def modifier(self, part, kind, **kw):
        md = part.ob.modifiers.new(kind.lower(), kind)
        for k, v in kw.items():
            setattr(md, k, v)
        return md

    # ------------------------------------------------------------------ 代理与锚点
    def proxy_box(self, c, s, a=0.0):
        self._proxy_box(Matrix.Translation(c) @ euler(0, a, 0), (s[0] / 2, s[1] / 2, s[2] / 2), False)

    def proxy_cyl(self, base, rb, rt, h):
        self.proxies.append({'t': 'cyl', 'c': list(self.P(base)), 'rb': rb, 'rt': rt, 'hh': h})

    def proxy_rod(self, a, b, r0, r1=None):
        self.proxies.append({'t': 'rod', 'a': list(self.P(a)), 'b': list(self.P(b)), 'r0': r0, 'r1': r1 if r1 is not None else r0})

    def anchor(self, name, p, d=None):
        self.anchors[name] = {'p': list(self.P(p))}
        if d is not None:
            dd = (self.T.to_3x3() @ V(d))
            self.anchors[name]['d'] = list(dd)

    def cleanup(self):
        for ob in self.aux:
            try:
                me = ob.data
                bpy.data.objects.remove(ob)
                bpy.data.meshes.remove(me)
            except ReferenceError:
                pass
        self.aux = []
        for p in self.parts:
            me = p.ob.data
            bpy.data.objects.remove(p.ob)
            if me and me.users == 0:
                if isinstance(me, bpy.types.Mesh):
                    bpy.data.meshes.remove(me)
                else:
                    bpy.data.curves.remove(me)
        bpy.data.collections.remove(self.coll)


def loft_mesh(rings, cap0=False, cap1=False, closed=True):
    """rings: [[(x,y,z), ...], ...]；返回 (verts, faces)。closed：每圈首尾相连。"""
    verts = []
    idx = []
    for ring in rings:
        idx.append(list(range(len(verts), len(verts) + len(ring))))
        verts.extend([tuple(p) for p in ring])
    faces = []
    for i in range(len(rings) - 1):
        A, B = idx[i], idx[i + 1]
        n = len(A)
        m = n if closed else n - 1
        for k in range(m):
            k1 = (k + 1) % n
            faces.append((A[k], A[k1], B[k1], B[k]))
    if cap0:
        faces.append(tuple(reversed(idx[0])))
    if cap1:
        faces.append(tuple(idx[-1]))
    return verts, faces
