"""人形（游戏里画成没有五官的剪影）：六种身材 / 姿势，正面朝 +z，原点在两脚中间的地面。
四肢是按肌肉起伏变粗细的椭圆截面扫掠（大腿上粗、膝盖细、小腿肚往后鼓、脚踝最细），躯干按胯、腰、胸、肩的截面放样，
校服外套下摆往外张、立领、鞋头鞋跟、头发的外轮廓、手指都在剪影上看得出来。
  tall    异象里的人影（约 2.5 米，手臂垂得很长）     roam    车库里那个（再高一点，手垂过膝盖）
  person  「假正常」里的路人                          teacher 讲台边的老师（偏高、偏瘦）
  sit     坐着、两只手平搭在课桌上的同学              neck    围墙外的行人（脖子长得不对）
异象里的几样「东西」（从地下伸出来的手、回头的头、突脸、笑脸、长脖子的头、压下来的钟、红灯笼）、
巡察者的大衣和帽子、清华紫的保温杯也在这里，它们画的时候用顶点色（不吃光），烘进去的明暗就是它们的立体感。"""
import math
import random

from mathutils import Vector

from wdfz import asset

SPEC = {
    'tall': dict(leg=1.20, torso=0.95, arm=1.32, head=0.26, w=0.44, neck=0.14, thin=0.85),
    'roam': dict(leg=1.22, torso=0.96, arm=1.55, head=0.25, w=0.42, neck=0.16, thin=0.80),
    'person': dict(leg=0.92, torso=0.62, arm=0.70, head=0.23, w=0.40, neck=0.08, thin=1.00),
    'teacher': dict(leg=1.30, torso=0.82, arm=1.10, head=0.25, w=0.42, neck=0.12, thin=0.90),
    'neck': dict(leg=1.20, torso=0.95, arm=1.32, head=0.26, w=0.44, neck=0.55, thin=0.80),
    'sit': dict(leg=0.44, torso=0.58, arm=0.62, head=0.21, w=0.36, neck=0.07, thin=1.00),
}
M = 'dark'
C = 0xffffff


def nseg(A, base):
    return max(5, int(round(base * (1.4, 1.0, 0.75, 0.55)[A.L])))


def limb(A, pts, radii, n, up=None, name='limb', caps=True):
    A.sweep(M, [Vector(p) for p in pts], radii, C, 1.0, n=n, cap0=caps, cap1=caps, up=up, name=name, proxy=False)


def shoe(A, x, z, k=1.0, yaw=0.0):
    """鞋：鞋跟、鞋身、往上翘一点的鞋头、比鞋面宽一圈的鞋底。"""
    n = nseg(A, 10)
    with A.at(x, 0, z, ry=yaw, s=k):
        limb(A, [(0, 0.045, -0.10), (0, 0.055, -0.04), (0, 0.05, 0.05), (0, 0.035, 0.12), (0, 0.03, 0.15)],
             [(0.042, 0.04), (0.048, 0.048), (0.05, 0.04), (0.044, 0.026), (0.03, 0.018)], n, up=(0, 1, 0), name='shoe')
        A.box(M, (0, 0.009, 0.02), (0.105, 0.018, 0.28), C, 1.0, bev=0.008, name='sole', proxy=False)


def hand(A, p, s, k, flat=False):
    """手：掌、四指（三节，往掌心弯）、拇指。flat：平放在桌面上，四指往前。"""
    x, y, z = p
    n = nseg(A, 6)
    if flat:
        with A.at(x, y, z):
            A.blob(M, (0, 0.012, 0.03), (0.042 * k, 0.016 * k, 0.05 * k), C, 1.0, seg=8, name='palm', proxy=False)
            if A.L <= 2:
                for i in range(4):
                    fx = (i - 1.5) * 0.017 * k * s
                    fl = (0.05 if i in (1, 2) else 0.04) * k
                    limb(A, [(fx, 0.014, 0.07 * k), (fx, 0.012, 0.07 * k + fl * 0.6), (fx, 0.006, 0.07 * k + fl)], [(0.0085 * k, 0.0075 * k), (0.008 * k, 0.007 * k), (0.006 * k, 0.005 * k)], n, name='finger')
                limb(A, [(s * 0.035 * k, 0.014, 0.0), (s * 0.05 * k, 0.012, 0.03 * k), (s * 0.055 * k, 0.008, 0.05 * k)], [(0.01 * k, 0.009 * k), (0.009 * k, 0.008 * k), (0.007 * k, 0.006 * k)], n, name='thumb')
        return
    with A.at(x, y, z):
        A.blob(M, (0, -0.045 * k, 0), (0.02 * k, 0.05 * k, 0.042 * k), C, 1.0, seg=8, name='palm', proxy=False)
        if A.lo:
            A.blob(M, (0, -0.1 * k, 0.005), (0.016 * k, 0.04 * k, 0.034 * k), C, 1.0, seg=6, name='mitten', proxy=False)
            return
        for i in range(4):
            fz = (0.027 - i * 0.018) * k
            fl = (0.078 if i in (1, 2) else 0.064) * k
            pts = [(0, -0.088 * k, fz), (-s * 0.004 * k, -0.088 * k - fl * 0.45, fz + 0.004 * k), (-s * 0.01 * k, -0.088 * k - fl * 0.8, fz + 0.008 * k), (-s * 0.014 * k, -0.088 * k - fl, fz + 0.002 * k)]
            limb(A, pts, [(0.0088 * k, 0.0085 * k), (0.0082 * k, 0.008 * k), (0.0072 * k, 0.007 * k), (0.0055 * k, 0.0055 * k)], n, name='finger')
        limb(A, [(-s * 0.012 * k, -0.03 * k, 0.03 * k), (-s * 0.018 * k, -0.06 * k, 0.045 * k), (-s * 0.018 * k, -0.08 * k, 0.05 * k)], [(0.011 * k, 0.01 * k), (0.01 * k, 0.009 * k), (0.008 * k, 0.007 * k)], n, name='thumb')


def head(A, hy, hz, H, kind):
    """头：脑壳、下颌和下巴、颧骨、鼻子、眉骨、耳朵，外面一层头发（顶上、后脑、两鬓，额前一点刘海）。"""
    sg = (14, 11, 8, 6)[A.L]
    A.blob(M, (0, hy, hz), (H * 0.39, H * 0.5, H * 0.43), C, 1.0, seg=sg, name='skull', proxy=False)
    A.blob(M, (0, hy - H * 0.27, hz + H * 0.08), (H * 0.25, H * 0.17, H * 0.27), C, 1.0, seg=sg - 2, name='jaw', proxy=False)
    if not A.lo:
        A.blob(M, (0, hy - H * 0.04, hz + H * 0.44), (H * 0.05, H * 0.1, H * 0.06), C, 1.0, seg=6, name='nose', proxy=False)
        A.blob(M, (0, hy + H * 0.09, hz + H * 0.34), (H * 0.29, H * 0.045, H * 0.07), C, 1.0, seg=6, name='brow', proxy=False)
        for s in (-1, 1):
            A.blob(M, (s * H * 0.39, hy - H * 0.02, hz - H * 0.02), (H * 0.05, H * 0.12, H * 0.08), C, 1.0, seg=6, name='ear', proxy=False)
            A.blob(M, (s * H * 0.24, hy - H * 0.08, hz + H * 0.30), (H * 0.09, H * 0.07, H * 0.08), C, 1.0, seg=6, name='cheek', proxy=False)
    # 头发
    A.blob(M, (0, hy + H * 0.08, hz - H * 0.07), (H * 0.43, H * 0.46, H * 0.43), C, 1.0, seg=sg, name='hair', proxy=False)
    if A.L <= 1:
        rnd = random.Random(len(kind) * 7)
        for k in range(9):
            a = -0.9 + k * 0.22
            A.blob(M, (math.sin(a) * H * 0.3, hy + H * 0.36 + rnd.random() * H * 0.04, hz + math.cos(a) * H * 0.18 - H * 0.08),
                   (H * 0.09, H * 0.07, H * 0.1), C, 1.0, seg=6, rot=(0.3, a, 0), name='tuft', proxy=False)
        A.blob(M, (0, hy + H * 0.22, hz + H * 0.32), (H * 0.3, H * 0.07, H * 0.08), C, 1.0, seg=7, rot=(0.25, 0, 0), name='fringe', proxy=False)


def human(A, kind):
    sp = SPEC[kind]
    t = sp['thin']
    sit = kind == 'sit'
    hipY = 0.535 if sit else sp['leg']
    sh = hipY + sp['torso']
    hx = sp['w'] / 2
    hk = sp['head'] / 0.23
    nl = nseg(A, 10)
    na = nseg(A, 9)
    # ---- 腿（裤子）
    for s in (-1, 1):
        lx = s * 0.095 * t
        if sit:
            limb(A, [(lx, hipY, -0.06), (lx, hipY + 0.015, 0.16), (lx, hipY + 0.02, 0.40)], [(0.085, 0.08), (0.078, 0.07), (0.06, 0.058)], nl, up=(0, 1, 0), name='thigh')
            A.blob(M, (lx, hipY + 0.012, 0.405), (0.06, 0.06, 0.062), C, 1.0, seg=8, name='knee', proxy=False)
            limb(A, [(lx, hipY + 0.02, 0.40), (lx * 1.03, hipY - 0.16, 0.405), (lx * 1.05, 0.28, 0.43), (lx * 1.05, 0.11, 0.44)],
                 [(0.056, 0.056), (0.058, 0.066), (0.047, 0.05), (0.048, 0.048)], nl, up=(0, 0, 1), name='shin')
            shoe(A, lx * 1.05, 0.48, hk * 0.98)
        else:
            kneeY = hipY * 0.52
            limb(A, [(lx, hipY + 0.02, 0.0), (lx * 1.02, hipY * 0.8, 0.008), (lx * 1.05, kneeY, 0.014)],
                 [(0.088 * t, 0.088 * t), (0.075 * t, 0.072 * t), (0.06 * t, 0.06 * t)], nl, up=(0, 0, 1), name='thigh')
            A.blob(M, (lx * 1.05, kneeY, 0.02), (0.058 * t, 0.064 * t, 0.06 * t), C, 1.0, seg=8, name='knee', proxy=False)
            limb(A, [(lx * 1.05, kneeY, 0.012), (lx * 1.07, kneeY * 0.68, -0.026), (lx * 1.09, kneeY * 0.35, -0.02), (lx * 1.1, 0.10, -0.01)],
                 [(0.058 * t, 0.06 * t), (0.058 * t, 0.066 * t), (0.046 * t, 0.048 * t), (0.05 * t, 0.05 * t)], nl, up=(0, 0, 1), name='shin')
            shoe(A, lx * 1.1, 0.04, hk * 0.98)
    # ---- 躯干：胯 → 腰 → 胸 → 肩（坐着往前趴一点）
    lean = 0.06 if sit else 0.0
    T = sp['torso']
    rings = [(hipY - 0.03, 0.0, 0.17, 0.115), (hipY + T * 0.22, lean * 0.3, 0.152, 0.102), (hipY + T * 0.5, lean * 0.6, 0.178, 0.112),
             (hipY + T * 0.78, lean * 0.9, 0.205, 0.118), (sh - 0.03, lean, 0.19, 0.105), (sh + 0.01, lean, 0.12, 0.08)]
    limb(A, [(0, y, z) for (y, z, a, b) in rings], [(a * t if i < 5 else a, b * t) for i, (y, z, a, b) in enumerate(rings)], nseg(A, 14), up=(0, 0, 1), name='torso')
    # 外套下摆：往外张一点的一圈（下口敞开）
    if not sit:
        A.sweep(M, [Vector((0, hipY + 0.12, 0)), Vector((0, hipY - 0.04, 0.004)), Vector((0, hipY - 0.07, 0.006))],
                [(0.178 * t, 0.12 * t), (0.19 * t, 0.13 * t), (0.195 * t, 0.134 * t)], C, 1.0, n=nseg(A, 14), cap0=False, cap1=False, up=(0, 0, 1), name='hem', proxy=False)
    # 立领、斜方肌、肩头
    A.cyl(M, (0, sh - 0.045, lean * 1.4), 0.078, 0.070, 0.075, C, 1.0, seg=nseg(A, 12), caps=False, name='collar', proxy=False)
    for s in (-1, 1):
        limb(A, [(s * 0.035, sh + 0.02, lean * 1.4), (s * hx * 0.5, sh - 0.005, lean), (s * hx * 0.82, sh - 0.035, lean)], [(0.045, 0.04), (0.05, 0.045), (0.055, 0.05)], na, name='trap')
        A.blob(M, (s * hx * 0.86, sh - 0.04, lean), (0.085, 0.075, 0.085), C, 1.0, seg=8, name='deltoid', proxy=False)
    # ---- 脖子、头
    nz = 0.10 if sit else 0.0
    limb(A, [(0, sh - 0.04, nz * 0.6), (0, sh + sp['neck'] * 0.5, nz * 0.85), (0, sh + sp['neck'] + 0.03, nz + 0.01)], [(0.055, 0.052), (0.05, 0.048), (0.048, 0.046)], na, up=(0, 0, 1), name='neck')
    H = sp['head']
    hy = sh + sp['neck'] + H * 0.5
    head(A, hy, nz + (0.04 if sit else 0.01), H, kind)
    # ---- 手臂（袖子到手腕微微放宽）
    for s in (-1, 1):
        ax = s * hx * 0.95
        up = sp['arm'] * 0.47
        fo = sp['arm'] * 0.53
        if sit:
            ex, ey, ez = s * hx * 1.02, sh - up * 0.75, 0.24
            limb(A, [(ax, sh - 0.06, 0.06), ((ax + ex) / 2, (sh - 0.06 + ey) / 2, 0.15), (ex, ey, ez)], [(0.052, 0.05), (0.05, 0.047), (0.043, 0.042)], na, name='upper_arm')
            A.blob(M, (ex, ey, ez), (0.046, 0.046, 0.048), C, 1.0, seg=7, name='elbow', proxy=False)
            limb(A, [(ex, ey, ez), ((ex + s * 0.10) / 2, (ey + 0.80) / 2, ez + 0.11), (s * 0.10, 0.80, ez + 0.22)], [(0.044, 0.042), (0.04, 0.037), (0.034, 0.03)], na, name='forearm')
            hand(A, (s * 0.09, 0.765, ez + 0.25), -s, hk * 0.95, flat=True)
        else:
            elx, ely = ax + s * 0.03 * t, sh - 0.05 - up
            limb(A, [(ax, sh - 0.05, 0.0), (ax + s * 0.02 * t, sh - 0.05 - up * 0.45, 0.012), (elx, ely, 0.02)], [(0.05 * t, 0.05 * t), (0.052 * t, 0.05 * t), (0.042 * t, 0.042 * t)], na, name='upper_arm')
            A.blob(M, (elx, ely, 0.015), (0.044 * t, 0.046 * t, 0.044 * t), C, 1.0, seg=7, name='elbow', proxy=False)
            wx, wy = elx + s * 0.01, ely - fo
            limb(A, [(elx, ely, 0.02), (elx + s * 0.006, ely - fo * 0.4, 0.03), (wx, wy + 0.03, 0.03), (wx, wy, 0.03)],
                 [(0.043 * t, 0.042 * t), (0.042 * t, 0.038 * t), (0.034 * t, 0.032 * t), (0.03 * t, 0.028 * t)], na, name='forearm')
            hand(A, (wx, wy, 0.03), s, hk * 0.95)
    A.proxy_box((0, (sh + sp['neck'] + H) / 2, 0.05 if sit else 0), (sp['w'] + 0.1, sh + sp['neck'] + H, 0.5 if sit else 0.3))


for _k in SPEC:
    asset('fig_' + _k, ao=0.15, ground=False)(lambda A, k=_k: human(A, k))


# ====================================================================== 异象里的东西（顶点色，不吃光）
@asset('fx_hand', ao=0.35, ground=False)
def fx_hand(A):
    """从地下伸出来的手：瘦得见骨的手背（几道筋）、五根往前抓的长手指（关节鼓起、指甲发黑）、后面一截小臂，手腕那圈带着土。"""
    SK = 0x6f6a63
    n = nseg(A, 8)
    A.sweep(M, [Vector((0, -0.02, -0.56)), Vector((0, -0.01, -0.3)), Vector((0, 0.0, -0.10))], [(0.07, 0.06), (0.062, 0.055), (0.06, 0.04)], SK, 0.95, n=n, cap0=False, name='forearm', proxy=False)
    A.blob(M, (0, -0.03, -0.45), (0.13, 0.04, 0.12), 0x2a2218, 1.0, seg=10, jit=0.35, seed=4, name='soil', proxy=False)
    A.cushion(M, (0, 0.0, 0.02), (0.20, 0.05, 0.22), SK, 1.0, puff=0.3, r=0.02, name='back_of_hand', proxy=False)
    for i in range(4):
        fx = -0.075 + i * 0.05
        fl = 0.10 + (0.025 if i in (1, 2) else 0.0)
        pts = [Vector((fx, 0.0, 0.11)), Vector((fx, 0.025, 0.11 + fl)), Vector((fx, 0.075, 0.11 + fl + 0.05)), Vector((fx, 0.085, 0.11 + fl + 0.10))]
        A.sweep(M, pts, [(0.017, 0.016), (0.016, 0.015), (0.014, 0.013), (0.009, 0.008)], SK, 1.0, n=n, name='finger', proxy=False)
        for q in pts[1:3]:
            A.blob(M, tuple(q), (0.019, 0.019, 0.019), 0x7a756c, 1.0, seg=6, name='knuckle', proxy=False)
        A.blob(M, tuple(pts[-1] + Vector((0, 0.004, 0.002))), (0.011, 0.006, 0.014), 0x1a1610, 1.0, seg=6, name='nail', proxy=False)
        if A.L <= 1:
            A.sweep(M, [Vector((fx * 0.8, 0.026, -0.08)), Vector((fx, 0.028, 0.10))], [(0.005, 0.004), (0.004, 0.003)], 0x7c776e, 1.0, n=5, name='tendon', proxy=False)
    A.sweep(M, [Vector((-0.10, 0.0, 0.02)), Vector((-0.145, 0.03, 0.10)), Vector((-0.135, 0.06, 0.155))], [(0.02, 0.018), (0.017, 0.015), (0.012, 0.01)], SK, 1.0, n=n, name='thumb', proxy=False)


@asset('fx_head', ao=0.35, ground=False)
def fx_head(A):
    """全体回头的那颗头：后脑（短发）、苍白的脸、两个深陷的黑眼窝、一道没有嘴唇的嘴、脖子和一截肩膀。"""
    HAIR = 0x2a2f33
    FACE = 0xb8b2a6
    A.blob(M, (0, 0.0, -0.01), (0.12, 0.14, 0.13), HAIR, 1.0, seg=12, name='skull')
    A.blob(M, (0, -0.012, 0.045), (0.098, 0.122, 0.092), FACE, 1.0, seg=12, name='face')
    A.blob(M, (0, -0.075, 0.062), (0.06, 0.04, 0.06), FACE, 0.95, seg=8, name='chin', proxy=False)
    for s in (-1, 1):
        A.blob(M, (s * 0.04, 0.02, 0.118), (0.027, 0.022, 0.022), 0x0a0d10, 1.0, seg=8, name='socket', proxy=False)
        A.blob(M, (s * 0.04, 0.045, 0.118), (0.035, 0.008, 0.02), 0x9a948a, 1.0, seg=6, name='brow', proxy=False)
    A.blob(M, (0, -0.005, 0.135), (0.012, 0.028, 0.016), 0xa8a296, 1.0, seg=6, name='nose', proxy=False)
    A.box(M, (0, -0.05, 0.128), (0.05, 0.004, 0.006), 0x2a1a18, 1.0, name='mouth', proxy=False)
    A.cyl(M, (0, -0.26, 0), 0.05, 0.048, 0.14, HAIR, 1.0, seg=10, name='neck')
    A.cushion(M, (0, -0.30, -0.02), (0.36, 0.10, 0.18), HAIR, 1.0, puff=0.2, r=0.04, name='shoulders')


def big_face(A, smile):
    """一张比人大的脸（原点在地上，脸中心离地 1.7 米左右）：额头、眉骨、颧骨、鼻梁、下巴都捏出来；
    突脸是两个黑洞的眼窝和嘴；笑脸是眯成缝的眼和咧到耳根的嘴、一排牙。"""
    SK = 0xd6cfc2 if smile else 0xcac2b4
    INK = 0x07090b
    cy = 1.72 if smile else 1.78
    W = 0.62 if smile else 0.55
    A.blob(M, (0, cy, 0), (W, 0.78, 0.13), SK, 1.0, seg=16, name='face')
    A.blob(M, (0, cy - 0.46, 0.0), (W * 0.55, 0.2, 0.112), SK, 0.97, seg=12, name='chin')
    for s in (-1, 1):
        A.blob(M, (s * 0.25, cy + 0.27, 0.08), (0.17, 0.04, 0.05), SK, 0.9, seg=8, name='brow')
        A.blob(M, (s * 0.31, cy - 0.06, 0.05), (0.15, 0.08, 0.05), SK, 1.02, seg=8, name='cheekbone')
    A.blob(M, (0, cy - 0.02, 0.11), (0.05, 0.16, 0.05), SK, 0.97, seg=8, name='nose')
    if smile:
        n = nseg(A, 8)
        for s in (-1, 1):
            pts = []
            for e in range(9):
                ex = (e / 8 - 0.5) * 0.30
                pts.append(Vector((s * 0.25 + ex, cy + 0.24 + 0.075 * (1 - (ex / 0.15) ** 2), 0.115)))
            A.sweep(M, pts, [(0.012 + 0.02 * math.sin(math.pi * k / 8), 0.012) for k in range(9)], INK, 1.0, n=n, up=(0, 0, 1), name='eye', proxy=False)
        # 嘴：一道咧到两边耳根的弧，中间张开、两头收尖；上面一排牙
        pts, rad = [], []
        nk = 21
        for k in range(nk):
            mx = (k / (nk - 1) - 0.5) * 1.0
            my = cy - 0.30 + 0.43 * (mx / 0.5) ** 2
            pts.append(Vector((mx, my, 0.112)))
            f = math.sin(math.pi * k / (nk - 1))
            rad.append((0.015 + 0.075 * f, 0.03))
        A.sweep(M, pts, rad, INK, 1.0, n=n, up=(0, 0, 1), name='mouth', proxy=False)
        for k in range(3, nk - 3):
            mx = (k / (nk - 1) - 0.5) * 1.0
            my = cy - 0.30 + 0.43 * (mx / 0.5) ** 2
            f = math.sin(math.pi * k / (nk - 1))
            A.box(M, (mx, my + 0.015 + 0.04 * f, 0.135), (0.04, 0.026 + 0.02 * f, 0.012), 0xeee8dc, 1.0, bev=0.004, rot=(0, 0, math.atan(0.43 * 2 * mx / 0.25) * 0.5), name='tooth', proxy=False)
    else:
        for s in (-1, 1):
            A.blob(M, (s * 0.24, cy + 0.18, 0.08), (0.11, 0.065, 0.06), INK, 1.0, seg=8, name='socket', proxy=False)
        A.blob(M, (0, cy - 0.30, 0.08), (0.24, 0.07, 0.05), INK, 1.0, seg=10, name='mouth', proxy=False)


asset('fx_bigface', ao=0.4, ground=False)(lambda A: big_face(A, False))
asset('fx_smile', ao=0.4, ground=False)(lambda A: big_face(A, True))


@asset('fx_neckhead', ao=0.35, ground=False)
def fx_neckhead(A):
    """长脖子那个人的头：暗红的皮肤、凹下去的两只黑眼、一道黑的嘴，头顶稀稀拉拉的头发。"""
    FL = 0x7c302c
    A.blob(M, (0, 0, 0), (0.22, 0.24, 0.22), FL, 1.0, seg=12, name='head')
    A.blob(M, (0, -0.12, 0.05), (0.14, 0.08, 0.15), FL, 0.95, seg=9, name='jaw', proxy=False)
    for s in (-1, 1):
        A.blob(M, (s * 0.09, 0.04, 0.185), (0.052, 0.046, 0.035), 0x0a0d10, 1.0, seg=8, name='eye', proxy=False)
    A.blob(M, (0, -0.10, 0.19), (0.085, 0.025, 0.022), 0x0a0d10, 1.0, seg=8, name='mouth', proxy=False)
    A.blob(M, (0, 0.13, -0.03), (0.2, 0.12, 0.19), 0x1a1210, 1.0, seg=9, jit=0.3, seed=3, name='hair', proxy=False)


@asset('fx_bell', ao=0.45, ground=False)
def fx_bell(A):
    """死亡演出里压下来的钟：横梁、蒲牢挂钩、钟身（几道箍、乳钉）、外翻的钟口、钟舌。"""
    A.box(M, (0, 2.72, 0), (1.5, 0.12, 0.5), 0x2a2018, 1.0, bev=0.02, name='beam')
    A.tube(M, [(-0.12, 2.66, 0), (-0.12, 2.52, 0), (0.12, 2.52, 0), (0.12, 2.66, 0)], 0.03, 0x3a2c1a, 1.0, seg=8, bend=0.08, name='hook')
    prof = [(0.0, 2.48), (0.36, 2.47), (0.46, 2.40), (0.55, 2.20), (0.60, 1.95), (0.66, 1.75), (0.78, 1.60), (0.92, 1.50), (0.93, 1.48), (0.0, 1.48)]
    A.lathe(M, (0, 0, 0), [(r, h - 0.0) for (r, h) in prof], 0x7a5a2a, 1.0, seg=24, sharp=60, name='bell')
    for (h, r) in ((2.30, 0.535), (2.0, 0.595), (1.72, 0.69)):
        A.lathe(M, (0, h, 0), [(r, -0.015), (r + 0.015, -0.008), (r + 0.015, 0.008), (r, 0.015)], 0x96703a, 1.05, seg=24, cap0=False, cap1=False, name='band', proxy=False)
    if not A.lo:
        for k in range(8):
            a = k * math.pi / 4
            for j in range(2):
                y = 2.12 - j * 0.1
                r = 0.575 + j * 0.02
                A.blob(M, (math.cos(a) * r, y, math.sin(a) * r), (0.022, 0.022, 0.022), 0x96703a, 1.1, seg=6, name='nipple', proxy=False)
    A.lathe(M, (0, 1.485, 0), [(0.0, 0.0), (0.88, 0.0), (0.0, 0.001)], 0x1a120a, 1.0, seg=24, name='mouth', proxy=False)
    A.rod(M, (0, 2.4, 0), (0, 1.40, 0), 0.03, 0.03, 0x3a2c1a, 1.0, seg=6, name='clapper_rod', proxy=False)
    A.blob(M, (0, 1.32, 0), (0.09, 0.11, 0.09), 0x3a2c1a, 1.0, seg=8, name='clapper')


@asset('fx_lantern', ao=0.4, ground=False)
def fx_lantern(A):
    """红灯笼：上下两个金色的盖、一瓣瓣鼓起的红纱（竖着的筋）、上面的挂绳、下面一绺穗子。"""
    RED = 0xc2352a
    GOLD = 0xe8c05a
    A.rod(M, (0, 2.68, 0), (0, 2.95, 0), 0.008, 0.008, GOLD, 1.0, seg=5, name='string', proxy=False)
    A.cyl(M, (0, 2.62, 0), 0.12, 0.12, 0.05, GOLD, 1.0, seg=14, round_=0.008, name='cap_top')
    prof = [(0.11, 2.62), (0.18, 2.58), (0.225, 2.48), (0.235, 2.40), (0.22, 2.30), (0.17, 2.22), (0.11, 2.19)]
    A.lathe(M, (0, 0, 0), [(r, h) for (r, h) in prof], RED, 1.0, seg=20, cap0=False, cap1=False, name='body')
    if not A.lo:
        for k in range(10):
            a = k * 2 * math.pi / 10
            pts = [(math.cos(a) * (r + 0.004), h, math.sin(a) * (r + 0.004)) for (r, h) in prof]
            A.tube(M, pts, 0.004, 0x8a1a14, 1.0, seg=4, name='rib', proxy=False)
    A.cyl(M, (0, 2.16, 0), 0.12, 0.12, 0.05, GOLD, 1.0, seg=14, round_=0.008, name='cap_bottom')
    A.rod(M, (0, 2.16, 0), (0, 2.08, 0), 0.025, 0.02, GOLD, 1.0, seg=8, name='knot', proxy=False)
    for k in range(10 if A.L <= 1 else 5):
        a = k * 2 * math.pi / 10
        A.rod(M, (math.cos(a) * 0.015, 2.08, math.sin(a) * 0.015), (math.cos(a) * 0.04, 1.86, math.sin(a) * 0.04), 0.006, 0.004, 0xd84a3a, 1.0, seg=4, name='tassel', proxy=False)


# ====================================================================== 巡察者的大衣、帽子；保温杯
@asset('pat_gear', ao=0.4, ground=False)
def pat_gear(A):
    """巡察者（老师那副身材，游戏里放大 1.12 倍）的行头：过膝的旧大衣（翻领、双排扣、腰带、垫肩、往下张开的下摆、开衩）、
    大檐帽（帽墙、帽顶、帽檐、发乌的帽徽）、左臂的红袖章、右手的夹板。顶点色。"""
    sp = SPEC['teacher']
    t = sp['thin']
    hipY = sp['leg']
    sh = hipY + sp['torso']
    hx = sp['w'] / 2
    hy = sh + sp['neck'] + sp['head'] * 0.5
    COAT = 0x1c2026
    n = nseg(A, 16)
    # 大衣：从领口到膝下的一筒，越往下越张开
    rings = [(sh + 0.01, 0.13, 0.095), (sh - 0.06, 0.215, 0.125), (sh - 0.3, 0.205, 0.13), (hipY + 0.12, 0.19, 0.135), (hipY - 0.1, 0.205, 0.15),
             (0.75, 0.235, 0.17), (0.48, 0.26, 0.19)]
    A.sweep(M, [Vector((0, y, 0)) for (y, a, b) in rings], [(a * t, b * t) for (y, a, b) in rings], COAT, 1.0, n=n, cap0=False, cap1=False, up=(0, 0, 1), name='coat')
    A.sweep(M, [Vector((0, 0.481, 0)), Vector((0, 0.49, 0))], [(0.26 * t, 0.19 * t), (0.25 * t, 0.18 * t)], COAT, 0.8, n=n, cap0=False, cap1=False, up=(0, 0, 1), name='hem_in', proxy=False)
    A.box(M, (0, 0.72, 0.17 * t + 0.005), (0.012, 0.5, 0.01), 0x050607, 1.0, name='vent', proxy=False)
    for s in (-1, 1):
        A.prism(M, (s * 0.06, sh - 0.12, 0.12 * t), [(0.0, 0.1), (0.07 * s, 0.02), (0.02 * s, -0.14), (-0.02 * s, -0.06)],
                0.012, 0x15181d, 1.0, rot=(0.15, 0, 0), name='lapel', proxy=False)
        A.blob(M, (s * hx * 0.86, sh - 0.02, 0), (0.1, 0.07, 0.1), COAT, 1.0, seg=8, name='pad', proxy=False)
        for k in range(4):
            A.cyl(M, (s * 0.07, sh - 0.25 - k * 0.15, 0.13 * t), 0.014, 0.014, 0.008, 0x8a7a50, 1.15, seg=8, dirn=(0, 0, 1), name='button', proxy=False)
    A.cyl(M, (0, hipY + 0.07, 0), 0.198 * t, 0.198 * t, 0.06, 0x050607, 1.0, seg=n, caps=False, name='belt', proxy=False)
    A.box(M, (0, hipY + 0.10, 0.2 * t * 0.7), (0.06, 0.05, 0.012), 0x6a6040, 1.1, name='buckle', proxy=False)
    A.cyl(M, (0, sh - 0.06, 0), 0.12, 0.085, 0.14, COAT, 1.0, seg=nseg(A, 12), caps=False, name='collar')
    # 大檐帽
    A.cyl(M, (0, hy + 0.04, 0), 0.128, 0.132, 0.075, 0x0a0c0f, 1.0, seg=nseg(A, 16), name='cap_band')
    A.lathe(M, (0, hy + 0.11, 0.01), [(0.0, 0.05), (0.13, 0.045), (0.17, 0.02), (0.165, 0.0), (0.0, 0.0)], 0x0d1014, 1.0, seg=nseg(A, 16), name='cap_crown')
    A.prism(M, (0, hy + 0.05, 0.14), [(-0.11, -0.008), (0.11, -0.008), (0.08, 0.008), (-0.08, 0.008)], 0.13, 0x050607, 1.0, rot=(0.25, 0, 0), axis='z', name='visor')
    A.box(M, (0, hy + 0.085, 0.133), (0.05, 0.035, 0.008), 0x5a4a1e, 1.0, bev=0.003, name='badge', proxy=False)
    # 红袖章、夹板
    ax = -hx * 0.95
    up = sp['arm'] * 0.47
    y0, y1 = sh - 0.05 - up * 0.25, sh - 0.05 - up * 0.55
    A.cyl(M, (ax - 0.008, y1, 0.006), 0.062 * t, 0.062 * t, y0 - y1, 0x7a120c, 1.0, seg=nseg(A, 12), caps=False, name='armband')
    A.box(M, (ax - 0.062 * t - 0.002, (y0 + y1) / 2, 0.01), (0.004, 0.05, 0.04), 0xb8a070, 1.0, name='armband_text', proxy=False)
    hxr = hx * 0.95 + 0.04
    hyr = sh - 0.05 - sp['arm'] - 0.05
    A.box(M, (hxr + 0.05, hyr + 0.14, 0.06), (0.018, 0.34, 0.25), 0x2a2118, 1.0, bev=0.005, name='clipboard')
    A.box(M, (hxr + 0.06, hyr + 0.12, 0.06), (0.004, 0.28, 0.21), 0x77736a, 1.0, name='paper', proxy=False)
    A.box(M, (hxr + 0.062, hyr + 0.29, 0.06), (0.012, 0.03, 0.09), 0x50565a, 1.0, bev=0.003, name='clip', proxy=False)


@asset('cup_tsinghua', ao=0.3, ground=False)
def cup_tsinghua(A):
    """清华紫的保温杯：银色杯底、紫色杯身（腰身微收）、一圈白色字带（细细的几道字划）、银色杯口圈、杯盖和盖顶。"""
    n = 20
    A.lathe(M, (0, 0, 0), [(0.0, 0.0), (0.038, 0.0), (0.041, 0.004), (0.041, 0.012)], 0xb8bec4, 1.1, seg=n, name='base')
    A.lathe(M, (0, 0, 0), [(0.042, 0.012), (0.044, 0.05), (0.043, 0.10), (0.044, 0.17), (0.044, 0.182)], 0x5b2a86, 1.0, seg=n, cap0=False, cap1=False, name='body')
    A.cyl(M, (0, 0.11, 0), 0.0448, 0.0448, 0.032, 0xf2eee6, 1.05, seg=n, caps=False, name='band')
    if not A.lo:
        for k in range(8):
            a = -0.5 + k * 0.14
            A.box(M, (math.sin(a) * 0.0452, 0.126, math.cos(a) * 0.0452), (0.006, 0.014, 0.001), 0x5b2a86, 1.0, rot=(0, a, 0), name='glyph', proxy=False)
    A.cyl(M, (0, 0.182, 0), 0.045, 0.045, 0.012, 0xb8bec4, 1.15, seg=n, caps=False, name='rim')
    A.lathe(M, (0, 0.194, 0), [(0.044, 0.0), (0.044, 0.035), (0.04, 0.045), (0.0, 0.045)], 0x4a2270, 0.95, seg=n, name='lid')
    A.cyl(M, (0, 0.239, 0), 0.026, 0.024, 0.012, 0xb8bec4, 1.1, seg=n, round_=0.003, name='lid_top')
