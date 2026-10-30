"""材质贴图：每种材质一张灰度颜色图 + 一张高度图（游戏里现算成法线贴图），无缝平铺，固定随机种子。

颜色仍然来自顶点色，贴图只管明暗细节，所以每种的平均亮度对齐原来游戏里现场画的那张（墙面 231、地砖 218、红砖 182……），
整体的明暗、配色不变，只是细节换成更像真东西的：
  墙面    滚涂乳胶漆的橘皮纹、大片的深浅（潮气、粉刷不匀）
  地砖    60 公分瓷砖，块与块深浅不同，釉面的细斑点，砖边倒角，灰缝里积灰
  水磨石  三种大小的碎石子（深灰、浅灰、白、米黄），铜分隔条
  吊顶    矿棉板的虫蛀纹和针孔，龙骨缝
  木头    年轮（顺着 u 方向），导管的细纹
  金属    拉丝，几道划痕，淡淡的锈斑
  布      平纹的经纬线，纱线粗细不匀
  红砖    一顺一丁的砖，每块深浅、表面麻点不同，边角磕掉一点，灰缝凹进去
  混凝土  深浅不匀，气孔，细裂缝
  石材    花岗岩的晶粒
  黑板    擦不干净的粉笔灰
  草地、叶丛、树皮、纸
做法：频谱合成的分形噪声（傅里叶空间按 1/f^β 滤白噪声，天生周期，拼起来没有缝）、周期性的细胞噪声（Worley）、
按网格排的砖和地砖、PIL 画的草叶和叶片（贴边的画四遍）；高度图凹下去的地方在颜色图上压暗一点（缝里积灰）。

输出 game3d/assets/textures_512.js（流畅、均衡、精细用）和 textures_1024.js（超精细、真实用），
图是 WebP（base64），脚本形式，双击 index.html 用 file:// 打开也能读。

  python3 tools/textures/build_textures.py                  # 需要 numpy、Pillow（带 WebP）
  python3 tools/textures/build_textures.py --preview 目录    # 另存 PNG 看效果
"""
import argparse
import base64
import io
import json
import math
import os

import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'game3d', 'assets')
N = 1024

# 每种的平均亮度（0–255），对齐原来的贴图
MEAN = dict(plaster=231, tile=218, terrazzo=213, ceiling=223, wood=213, metal=205, plain=220, fabric=208, brick=182,
            concrete=199, stone=206, board=74, grass=194, leaf=173, bark=167, paper=236)


def rng(seed):
    return np.random.default_rng(seed)


def _freqs(n):
    return np.fft.rfftfreq(n)[None, :] * n, np.fft.fftfreq(n)[:, None] * n


def noise(n, seed, beta=2.0, lo=1.0, hi=None, sx=1.0, sy=1.0):
    """周期的分形噪声（均值 0、标准差 1）。beta 越大越平滑；lo / hi 是每张贴图里的周期数范围；sx > 1 沿 x 拉长"""
    w = rng(seed).standard_normal((n, n))
    fx, fy = _freqs(n)
    f = np.sqrt((fx * sx) ** 2 + (fy * sy) ** 2)
    filt = np.zeros_like(f)
    m = f > 0
    filt[m] = f[m] ** (-beta / 2)
    filt[f < lo] = 0
    if hi:
        filt[f > hi] = 0
    out = np.fft.irfft2(np.fft.rfft2(w) * filt, s=(n, n))
    out -= out.mean()
    return out / (out.std() + 1e-12)


def blur(a, sigma):
    """周期的高斯模糊（sigma 以像素计）"""
    n = a.shape[0]
    fx, fy = _freqs(n)
    g = np.exp(-2 * (math.pi * sigma / n) ** 2 * (fx ** 2 + fy ** 2))
    return np.fft.irfft2(np.fft.rfft2(a) * g, s=a.shape)


def worley(n, cells, seed, jitter=0.9):
    """周期的细胞噪声：到最近、次近特征点的距离（以格为单位）和最近点的编号"""
    J = rng(seed).random((cells, cells, 2)) * jitter + (1 - jitter) * 0.5
    u = (np.arange(n) + 0.5) / n * cells
    X, Y = np.meshgrid(u, u)
    cx, cy = np.floor(X).astype(np.int64), np.floor(Y).astype(np.int64)
    F1 = np.full((n, n), 9.0)
    F2 = np.full((n, n), 9.0)
    ID = np.zeros((n, n), np.int64)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            gx, gy = cx + dx, cy + dy
            wx, wy = gx % cells, gy % cells
            d = np.hypot(X - (gx + J[wy, wx, 0]), Y - (gy + J[wy, wx, 1]))
            closer = d < F1
            F2 = np.where(closer, F1, np.minimum(F2, d))
            ID = np.where(closer, wy * cells + wx, ID)
            F1 = np.where(closer, d, F1)
    return F1, F2, ID


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def splat(n, shapes, ss=2):
    """PIL 画一堆形状（灰度、带不透明度地叠上去），贴边的再画到对面，超采样抗锯齿。
    shapes: [(kind, 几何, 值 0–1, 不透明度 0–1)]，kind 是 'ellipse'（外包盒）、'poly'（点列）、'line'（x0, y0, x1, y1, 宽）。
    返回 (预乘过的值, 覆盖率)：合成时 底色 × (1 − 覆盖率) + 值"""
    big = n * ss
    V = Image.new('RGB', (big, big), (0, 0, 0))
    C = Image.new('RGB', (big, big), (0, 0, 0))
    dv = ImageDraw.Draw(V, 'RGBA')
    dc = ImageDraw.Draw(C, 'RGBA')
    for kind, geom, val, op in shapes:
        a = int(round(op * 255))
        fv = (int(round(val * 255)),) * 3 + (a,)
        fc = (255, 255, 255, a)
        if kind == 'line':
            x0, y0, x1, y1, w = geom
            pts = [(x0 * ss, y0 * ss), (x1 * ss, y1 * ss)]
            pad = w * ss
        elif kind == 'ellipse':
            x0, y0, x1, y1 = geom
            pts = [(x0 * ss, y0 * ss), (x1 * ss, y1 * ss)]
            pad = 0
        else:
            pts = [(x * ss, y * ss) for x, y in geom]
            pad = 0
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        for ox in (-big, 0, big):
            if max(xs) + ox < -pad or min(xs) + ox > big + pad:
                continue
            for oy in (-big, 0, big):
                if max(ys) + oy < -pad or min(ys) + oy > big + pad:
                    continue
                q = [(x + ox, y + oy) for x, y in pts]
                for d, f in ((dv, fv), (dc, fc)):
                    if kind == 'line':
                        d.line(q, fill=f, width=max(1, int(round(geom[4] * ss))))
                    elif kind == 'ellipse':
                        d.ellipse((q[0][0], q[0][1], q[1][0], q[1][1]), fill=f)
                    else:
                        d.polygon(q, fill=f)
    v = np.asarray(V, np.float64)[..., 0] / 255.0
    c = np.asarray(C, np.float64)[..., 0] / 255.0
    return v.reshape(n, ss, n, ss).mean(axis=(1, 3)), c.reshape(n, ss, n, ss).mean(axis=(1, 3))


def cavity(h, sigma=3.0):
    c = np.clip(blur(h, sigma) - h, 0, None)
    return c / (c.max() + 1e-9)


# ====================================================================== 各种材质：返回 (颜色 0–1 浮点，平均值随意；高度 0–1)
def plaster(n):
    big = noise(n, 11, beta=3.4, lo=1, hi=30)                 # 大片的深浅：潮气、粉刷不匀
    mid = noise(n, 12, beta=2.0, lo=20, hi=160)
    fine = noise(n, 13, beta=0.5, lo=160)
    peel = noise(n, 14, beta=1.3, lo=50, hi=420)              # 滚涂的橘皮纹
    grit = noise(n, 15, beta=0.4, lo=260)
    # 补过的几块腻子：更平、略白
    patch = smooth(1.6, 2.4, noise(n, 16, beta=4.0, lo=1, hi=10))
    alb = 1 + 0.020 * big + 0.007 * mid + 0.008 * fine + 0.012 * patch
    h = 0.55 * peel * (1 - 0.6 * patch) + 0.05 * grit + 0.35 * big
    return alb, h


def tile(n):
    T = n // 2
    k = n / 1200.0                                            # 每毫米几像素（一张贴图 1.2 米，2×2 块 60 公分地砖）
    y, x = np.mgrid[0:n, 0:n] + 0.5
    lx, ly = x % T, y % T
    de = np.minimum(np.minimum(lx, T - lx), np.minimum(ly, T - ly))
    ti = (x // T).astype(int) + 2 * (y // T).astype(int)
    tone = np.array([0.0, 0.028, -0.022, 0.012])[ti]
    F1, F2, ID = worley(n, 90, 21)                            # 釉面下面的细斑
    spk = rng(22).random(90 * 90)
    speck = np.where(F1 < 0.16, (spk[ID] - 0.5) * 0.10, 0.0)
    mott = noise(n, 23, beta=2.6, lo=2, hi=40)
    alb = 1 + tone + 0.012 * mott + speck + 0.006 * noise(n, 24, beta=0.4, lo=200)
    bev = smooth(1.5 * k, 3.6 * k, de)                       # 砖边倒角
    grout = de < 1.5 * k
    dirt = 0.55 + 0.06 * noise(n, 25, beta=1.0, lo=100)
    alb = np.where(grout, dirt, alb * (0.86 + 0.14 * bev))
    # 砖边几处磕掉的小口
    chip = (noise(n, 26, beta=1.2, lo=40, hi=200) > 2.2) & (de < 4.5 * k)
    alb = np.where(chip & ~grout, alb * 0.9, alb)
    h = 0.12 + 0.88 * bev + 0.010 * noise(n, 27, beta=2.0, lo=4, hi=80) - 0.25 * chip
    h = np.where(grout, 0.02 + 0.03 * noise(n, 28, beta=0.5, lo=200), h)
    return alb, h


def terrazzo(n):
    k = n / 2000.0
    alb = 0.93 + 0.022 * noise(n, 31, beta=2.6, lo=1, hi=60) + 0.016 * noise(n, 32, beta=0.4, lo=220)
    h = 0.50 + 0.004 * noise(n, 33, beta=1.5, lo=60)                # 磨光的：几乎是平的
    tones = np.array([0.62, 0.76, 0.86, 1.06, 1.10, 0.97])
    probs = np.array([0.14, 0.18, 0.18, 0.24, 0.14, 0.12])
    for cells, gap, dens, seed in ((60, 0.26, 0.32, 34), (130, 0.24, 0.30, 35), (300, 0.22, 0.30, 36)):
        F1, F2, ID = worley(n, cells, seed)
        r = rng(seed + 50)
        tone = r.choice(tones, size=cells * cells, p=probs) * (1 + 0.05 * r.standard_normal(cells * cells))
        here = r.random(cells * cells) < dens
        e = F2 - F1
        chip = (e > gap + 0.06 * noise(n, seed + 7, beta=1.0, lo=cells, hi=cells * 6)) & here[ID]
        inner = smooth(gap, gap + 0.25, e)
        val = tone[ID] * (1 + 0.035 * noise(n, seed + 9, beta=0.6, lo=200)) * (0.96 + 0.04 * inner)
        alb = np.where(chip, val, alb)
        h = np.where(chip, 0.51 + 0.01 * inner, h)
    # 铜分隔条（每张贴图的 u = 0、v = 0 处）
    y, x = np.mgrid[0:n, 0:n] + 0.5
    dx = np.minimum(x, n - x)
    dy = np.minimum(y, n - y)
    strip = np.minimum(dx, dy) < 1.4 * k + 0.6
    alb = np.where(strip, 0.74 + 0.05 * noise(n, 37, beta=1.0, lo=60), alb)
    h = np.where(strip, 0.62, h)
    return alb, h


def ceiling(n):
    T = n // 2
    k = n / 1200.0
    y, x = np.mgrid[0:n, 0:n] + 0.5
    lx, ly = x % T, y % T
    de = np.minimum(np.minimum(lx, T - lx), np.minimum(ly, T - ly))
    rid = 1 - np.abs(noise(n, 41, beta=1.8, lo=25, hi=260))  # 虫蛀纹：脊状噪声的细缝
    rid2 = 1 - np.abs(noise(n, 42, beta=1.6, lo=40, hi=320))
    fiss = np.maximum(smooth(0.93, 0.985, rid), 0.7 * smooth(0.95, 0.99, rid2))
    fiss *= smooth(0.0, 1.0, noise(n, 43, beta=3.0, lo=2, hi=20) + 0.6)
    F1, F2, ID = worley(n, 150, 44, jitter=1.0)               # 针孔
    pin = smooth(0.17, 0.11, F1) * (rng(45).random(150 * 150) < 0.55)[ID]
    alb = 1 + 0.018 * noise(n, 46, beta=2.4, lo=1, hi=40) + 0.010 * noise(n, 47, beta=0.5, lo=200) - 0.20 * fiss - 0.30 * pin
    h = 0.75 + 0.02 * noise(n, 48, beta=1.8, lo=30, hi=200) - 0.40 * fiss - 0.45 * pin
    # 龙骨：板边一圈凹下去的缝和露出来的 T 形铝条
    bar = de < 6 * k
    gap = (de >= 6 * k) & (de < 9 * k)
    alb = np.where(bar, 0.93, np.where(gap, 0.62, alb))
    h = np.where(bar, 0.55, np.where(gap, 0.25, h))
    return alb, h


def wood(n):
    y = (np.mgrid[0:n, 0:n][0] + 0.5) / n
    warp = noise(n, 51, beta=3.2, lo=1, hi=10, sx=5)
    warp2 = noise(n, 52, beta=2.2, lo=3, hi=40, sx=8)
    ph = y * 44 + 0.9 * warp + 0.12 * warp2
    saw = ph - np.floor(ph)                                   # 一圈年轮里：早材慢慢过渡到晚材，晚材到下一圈早材是一下子变的
    amp = 0.55 + 0.45 * smooth(-1.2, 1.2, noise(n, 56, beta=2.4, lo=1, hi=16, sx=6))
    late = smooth(0.62, 0.93, saw) * (1 - smooth(0.93, 1.0, saw)) * amp
    pores = noise(n, 53, beta=0.6, lo=30, sx=14)              # 导管：顺着木纹的细短纹
    figure = noise(n, 54, beta=2.6, lo=1, hi=20, sx=3)
    alb = 1 - 0.075 * late + 0.020 * pores + 0.022 * figure + 0.008 * noise(n, 55, beta=0.4, lo=220)
    h = 0.5 - 0.20 * late + 0.20 * pores + 0.06 * figure
    return alb, h


def metal(n):
    brush = noise(n, 61, beta=0.7, lo=6, sx=45)               # 拉丝：沿 u 的细纹
    brush2 = noise(n, 62, beta=1.6, lo=2, hi=60, sx=20)
    r = rng(63)
    shapes = []
    for _ in range(26):                                       # 划痕
        x0, y0 = r.random() * n, r.random() * n
        a = r.normal(0, 0.5) if r.random() < 0.6 else r.random() * math.pi
        L = n * (0.04 + 0.22 * r.random())
        shapes.append(('line', (x0, y0, x0 + math.cos(a) * L, y0 + math.sin(a) * L, 0.6 + r.random() * 1.2), 1.0, 0.35 + 0.5 * r.random()))
    _scr, cov = splat(n, shapes)
    stain = smooth(1.0, 2.2, noise(n, 64, beta=3.2, lo=1, hi=14)) * (0.5 + 0.5 * smooth(-0.5, 1.5, noise(n, 65, beta=1.0, lo=60)))
    alb = 1 + 0.030 * brush + 0.020 * brush2 + 0.06 * cov - 0.07 * stain
    h = 0.5 + 0.30 * brush + 0.08 * brush2 - 0.30 * cov - 0.10 * stain
    return alb, h


def plain(n):
    alb = 1 + 0.008 * noise(n, 71, beta=2.6, lo=1, hi=24) + 0.006 * noise(n, 72, beta=0.4, lo=200)
    h = 0.5 + 0.3 * noise(n, 73, beta=0.6, lo=200)
    return alb, h


def fabric(n):
    period = 8                                                # 两根线一个周期（0.6 米 1024 像素：一根线约 2.3 毫米）
    y, x = np.mgrid[0:n, 0:n]
    cx, cy = x // (period // 2), y // (period // 2)
    over = (cx + cy) % 2 == 0                                 # 平纹：经线在上 / 纬线在上交替
    fx = ((x % (period // 2)) + 0.5) / (period // 2)
    fy = ((y % (period // 2)) + 0.5) / (period // 2)
    warp_prof = np.sin(math.pi * fx)                          # 经线（竖）截面
    weft_prof = np.sin(math.pi * fy)
    slub_w = noise(n, 81, beta=1.5, lo=4, hi=120, sy=0.05, sx=1)   # 纱线粗细不匀（沿线方向变）
    slub_f = noise(n, 82, beta=1.5, lo=4, hi=120, sx=0.05, sy=1)
    top = np.where(over, warp_prof * (1 + 0.15 * slub_w), weft_prof * (1 + 0.15 * slub_f))
    fuzz = noise(n, 83, beta=0.3, lo=200)
    alb = 0.90 + 0.10 * top + 0.02 * fuzz + 0.015 * noise(n, 84, beta=2.6, lo=1, hi=20)
    h = 0.25 + 0.6 * top + 0.05 * fuzz
    return alb, h


def brick(n):
    rows, per = 32, 8                                         # 一张 2.4 米：32 皮砖，每皮 8 块
    bh, bw = n / rows, n / per
    k = n / 2400.0
    y, x = np.mgrid[0:n, 0:n] + 0.5
    row = np.floor(y / bh).astype(int)
    off = np.where(row % 2 == 1, bw / 2, 0.0)
    col = np.floor((x + off) / bw).astype(int)
    lx = (x + off) - col * bw
    ly = y - row * bh
    col %= per
    m = 4.2 * k + 0.7                                        # 灰缝半宽（约 10 毫米宽）
    # 砖的边：加一点噪声，像磕过、砌得不齐
    wob = 1.6 * k * noise(n, 91, beta=1.0, lo=30, hi=300)
    de = np.minimum(np.minimum(lx, bw - lx), np.minimum(ly, bh - ly)) + wob
    inside = de > m
    bid = row * per + col
    r = rng(92)
    tone = 0.82 + 0.18 * r.random(rows * per) + 0.05 * r.standard_normal(rows * per)
    burnt = r.random(rows * per) < 0.12                     # 几块烧过火的深砖
    tone = np.where(burnt, tone * 0.78, tone)
    face = noise(n, 93, beta=1.2, lo=40, hi=400)
    pits = smooth(0.12, 0.06, worley(n, 260, 94)[0])        # 表面麻点
    alb_b = tone[bid] * (1 + 0.028 * face + 0.02 * noise(n, 95, beta=2.4, lo=8, hi=60)) * (1 - 0.10 * pits)
    edge = smooth(m, m + 3.5 * k + 1, de)
    alb_b = alb_b * (0.88 + 0.12 * edge)
    mortar = 1.16 + 0.04 * noise(n, 96, beta=0.8, lo=120)
    alb = np.where(inside, alb_b, mortar)
    h = np.where(inside, 0.55 + 0.35 * edge + 0.06 * face - 0.2 * pits, 0.08 + 0.04 * noise(n, 97, beta=0.6, lo=200))
    # 墙面上淡淡的水迹、泛碱
    alb = alb * (1 - 0.05 * smooth(0.8, 2.2, noise(n, 98, beta=3.0, lo=1, hi=8, sy=0.3)))
    return alb, h


def concrete(n):
    big = noise(n, 101, beta=3.0, lo=1, hi=24)
    mid = noise(n, 102, beta=1.8, lo=12, hi=160)
    agg = noise(n, 103, beta=0.4, lo=180)
    F1, F2, ID = worley(n, 120, 104, jitter=1.0)            # 气孔
    pore = smooth(0.16, 0.08, F1) * (rng(105).random(120 * 120) < 0.35)[ID]
    crack = smooth(0.985, 0.997, 1 - np.abs(noise(n, 106, beta=2.0, lo=3, hi=120)))
    crack *= smooth(1.0, 2.0, noise(n, 107, beta=3.0, lo=1, hi=8))
    stain = smooth(0.6, 2.2, noise(n, 108, beta=3.2, lo=1, hi=10))
    alb = 1 + 0.040 * big + 0.020 * mid + 0.025 * agg - 0.30 * pore - 0.25 * crack - 0.06 * stain
    h = 0.6 + 0.10 * big + 0.10 * mid + 0.04 * agg - 0.55 * pore - 0.45 * crack
    return alb, h


def stone(n):
    alb = 1.0 + 0.02 * noise(n, 111, beta=2.6, lo=1, hi=30)
    h = 0.6 + 0.01 * noise(n, 112, beta=1.8, lo=20, hi=200)
    for cells, seed, mix in ((300, 113, (0.62, 0.92, 1.12)), (520, 114, (0.55, 0.95, 1.15))):
        F1, F2, ID = worley(n, cells, seed)
        r = rng(seed + 9)
        pick = r.choice(np.array(mix), size=cells * cells, p=[0.22, 0.48, 0.30])
        grain = smooth(0.0, 0.10, F2 - F1)
        alb = alb * (0.78 + 0.22 * (pick[ID] * (0.94 + 0.06 * grain)))
        h = h - 0.01 * (1 - grain)
    return alb, h


def board(n):
    dust = smooth(-0.5, 2.0, noise(n, 121, beta=2.8, lo=1, hi=20))
    y, x = np.mgrid[0:n, 0:n] + 0.5
    r = rng(122)
    shapes = []
    for _ in range(40):                                       # 板擦一道道横着擦过去的印子（略带弧）
        cx, cy = r.random() * n, r.random() * n
        L = n * (0.15 + 0.35 * r.random())
        w = n * (0.02 + 0.04 * r.random())
        bow = (r.random() - 0.5) * 0.12
        pts = []
        for t in np.linspace(-0.5, 0.5, 12):
            pts.append((cx + t * L, cy + bow * L * (t * t - 0.25) - w / 2))
        for t in np.linspace(0.5, -0.5, 12):
            pts.append((cx + t * L, cy + bow * L * (t * t - 0.25) + w / 2))
        shapes.append(('poly', pts, 1.0, 0.08 + 0.12 * r.random()))
    _sw, cov = splat(n, shapes)
    cov = blur(cov, 6) * (0.7 + 0.3 * smooth(-1.0, 1.0, noise(n, 125, beta=1.6, lo=8, hi=80)))
    alb = 1 + 0.10 * dust + 0.30 * cov + 0.05 * noise(n, 123, beta=0.6, lo=160)
    h = 0.5 + 0.1 * noise(n, 124, beta=1.0, lo=100)
    return alb, h


def grass(n):
    r = rng(131)
    shapes = []
    clump = noise(n, 132, beta=2.6, lo=2, hi=30)
    for _ in range(14000):
        x0, y0 = r.random() * n, r.random() * n
        L = n * (0.006 + 0.012 * r.random())
        a = -math.pi / 2 + r.normal(0, 0.45)
        v = 0.72 + 0.28 * r.random()
        shapes.append(('line', (x0, y0, x0 + math.cos(a) * L, y0 + math.sin(a) * L, 0.9 + 0.8 * r.random()), v, 0.8))
    bl, cov = splat(n, shapes, ss=2)
    soil = 0.74 + 0.05 * noise(n, 133, beta=1.0, lo=60)
    base = soil * (1 - cov) + bl
    alb = base * (1 + 0.08 * clump)
    h = 0.2 + 0.7 * bl + 0.1 * clump
    return alb, h


def leaf(n):
    r = rng(141)
    shapes = []
    for i in range(5200):
        t = i / 5200
        x0, y0 = r.random() * n, r.random() * n
        a = r.random() * math.pi
        L = n * (0.010 + 0.010 * r.random())
        W = L * (0.38 + 0.15 * r.random())
        ca, sa = math.cos(a), math.sin(a)
        pts = []
        for s in np.linspace(0, 2 * math.pi, 14, endpoint=False):
            px, py = math.cos(s) * L, math.sin(s) * W * (1 - 0.3 * math.cos(s))
            pts.append((x0 + px * ca - py * sa, y0 + px * sa + py * ca))
        v = 0.62 + 0.25 * t + 0.18 * r.random()                 # 先画深的（里层），后画浅的
        shapes.append(('poly', pts, min(v, 1.0), 1.0))
    lv, cov = splat(n, shapes, ss=2)
    alb = 0.52 * (1 - cov) + lv
    h = 0.15 + 0.85 * lv
    return alb, h


def bark(n):
    # 竖向的深沟连成不规则的网，沟之间是一块块树皮（沿 v 拉长）；再加几道横裂
    rid = 1 - np.abs(noise(n, 151, beta=2.2, lo=3, hi=40, sx=0.30, sy=1))
    rid2 = 1 - np.abs(noise(n, 152, beta=2.0, lo=6, hi=80, sx=0.35, sy=1))
    furrow = np.maximum(smooth(0.80, 0.97, rid), 0.6 * smooth(0.84, 0.98, rid2))
    cross = smooth(0.90, 0.985, 1 - np.abs(noise(n, 155, beta=2.0, lo=6, hi=60, sx=1, sy=0.35))) * 0.5
    plate = noise(n, 153, beta=2.2, lo=3, hi=60, sx=0.5)
    fine = noise(n, 154, beta=0.8, lo=60, sx=0.4)
    cut = np.maximum(furrow, cross)
    alb = 1 - 0.45 * cut + 0.06 * plate + 0.05 * fine
    h = 0.85 - 0.75 * cut + 0.08 * plate + 0.06 * fine
    return alb, h


def paper(n):
    fibers = noise(n, 161, beta=1.0, lo=40, hi=500)
    r = rng(162)
    shapes = []
    lh = n / 26.0
    for i in range(22):                                       # 一行行字：一个个小的深色短划
        yy = n * 0.06 + i * lh
        xx = n * 0.06
        xe = n * (0.94 - 0.35 * r.random() * (i % 5 == 4))
        while xx < xe:
            w = n * (0.004 + 0.022 * r.random())
            if xx + w > xe:
                break
            shapes.append(('poly', [(xx, yy), (xx + w, yy), (xx + w, yy + lh * 0.24), (xx, yy + lh * 0.24)], 1.0, 0.30 + 0.25 * r.random()))
            xx += w + n * (0.004 + 0.003 * r.random())
    _ink, cov = splat(n, shapes)
    alb = 1 + 0.012 * fibers - 0.36 * cov
    h = 0.5 + 0.2 * fibers
    return alb, h


KINDS = dict(plaster=plaster, tile=tile, terrazzo=terrazzo, ceiling=ceiling, wood=wood, metal=metal, plain=plain, fabric=fabric,
             brick=brick, concrete=concrete, stone=stone, board=board, grass=grass, leaf=leaf, bark=bark, paper=paper)
FLAT = ('plain', 'board', 'paper')                           # 这几种游戏里不加法线，不出高度图
CAVITY = dict(tile=0.25, terrazzo=0.1, ceiling=0.2, brick=0.08, concrete=0.25, stone=0.1, grass=0.2, leaf=0.25, bark=0.3, fabric=0.15)


def make(kind, n=N):
    alb, h = KINDS[kind](n)
    h = (h - h.min()) / (h.max() - h.min() + 1e-12)
    if kind in CAVITY:
        alb = alb * (1 - CAVITY[kind] * cavity(h))
    alb = alb * (MEAN[kind] / 255.0) / alb.mean()
    return np.clip(alb, 0, 1), h


def webp(a, size, q):
    im = Image.fromarray(np.clip(a * 255 + 0.5, 0, 255).astype(np.uint8), 'L')
    if im.size[0] != size:
        im = im.resize((size, size), Image.LANCZOS)
    buf = io.BytesIO()
    im.convert('RGB').save(buf, 'WEBP', quality=q, method=6)
    return 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--preview', default='')
    ap.add_argument('--only', default='')
    args = ap.parse_args()
    kinds = [k for k in KINDS if not args.only or k in args.only.split(',')]
    packs = {512: {}, 1024: {}}
    for kind in kinds:
        alb, h = make(kind)
        if args.preview:
            os.makedirs(args.preview, exist_ok=True)
            Image.fromarray((alb * 255 + 0.5).astype(np.uint8)).save(os.path.join(args.preview, kind + '.png'))
            Image.fromarray((h * 255 + 0.5).astype(np.uint8)).save(os.path.join(args.preview, kind + '_h.png'))
        for size in packs:
            packs[size][kind] = [webp(alb, size, 82)] + ([] if kind in FLAT else [webp(h, size // 2, 80)])
        print('%-9s 平均 %.1f  起伏 %.1f' % (kind, alb.mean() * 255, alb.std() * 255))
    if args.only:
        return
    for size, data in packs.items():
        path = os.path.join(OUT, 'textures_%d.js' % size)
        with open(path, 'w') as f:
            f.write('/* 材质贴图（tools/textures/build_textures.py 生成，别手改）：每种 [灰度颜色图, 高度图]（不加法线的没有高度图），WebP */\n')
            f.write('TEX_PACK(%d,%s);\n' % (size, json.dumps(data, separators=(',', ':'))))
        print(path, '%.0f KB' % (os.path.getsize(path) / 1024))


if __name__ == '__main__':
    main()
