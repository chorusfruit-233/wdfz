"""宿舍：上下铺铁架床（护栏和梯子在哪一侧分三种）、床垫加枕头、两种叠法的被子（染色）。
局部坐标沿用 furniture.js：床头朝 -z，床宽 0.92、床长 1.46（离墙留了 16 厘米），上铺高 1.86。"""
import math

from wdfz import asset
from assets._parts import BLACK

COL = 0x4a5058
BW, BL = 0.92, 1.46
HX, HZ = 0.44, BL / 2 - 0.03
TOP = 1.86
LV = (0.30, 1.38)


def frame(A, guard):
    """guard：+1 护栏和梯子在 +x，-1 在 -x，0 没有（两边都挨着别的床）。"""
    lo = A.lo
    # 四根方管立柱，顶上塑料帽、底下脚垫
    for lx in (-1, 1):
        for lz in (-1, 1):
            A.box('metal', (lx * HX, TOP / 2, lz * HZ), (0.04, TOP, 0.04), COL, 1.0, bev=0.004, name='post')
            if not lo:
                A.box('plastic', (lx * HX, TOP + 0.006, lz * HZ), (0.042, 0.012, 0.042), BLACK, 1.0, bev=0.004, name='cap', proxy=False)
                A.box('plastic', (lx * HX, 0.008, lz * HZ), (0.046, 0.016, 0.046), BLACK, 1.0, bev=0.003, name='foot', proxy=False)
    for y0 in LV:
        for lx in (-1, 1):
            A.box('metal', (lx * HX, y0 - 0.04, 0), (0.035, 0.06, BL - 0.08), COL, 1.0, bev=0.004, name='rail_long')
        for lz in (-1, 1):
            A.box('metal', (0, y0 - 0.04, lz * HZ), (BW * 0.9, 0.06, 0.03), COL, 1.0, bev=0.004, name='rail_end')
        # 床板：一条条木条
        if lo:
            A.box('wood', (0, y0, 0), (BW * 0.88, 0.02, BL - 0.10), 0x8a6a48, 1.0, name='board')
        else:
            n = 7
            for k in range(n):
                z = -(BL - 0.10) / 2 + (BL - 0.10) * (k + 0.5) / n
                A.box('wood', (0, y0, z), (BW * 0.88, 0.02, (BL - 0.10) / n - 0.015), 0x8a6a48, 1.0, bev=0.002, name='slat', proxy=False)
            A.proxy_box((0, y0, 0), (BW * 0.88, 0.02, BL - 0.10))
            A.box('metal', (0, y0 - 0.02, 0), (0.03, 0.02, BL - 0.10), COL, 0.9, name='spine', proxy=False)
    # 床头、床尾的横杆
    for lz in (-1, 1):
        for k in range(1 if lo else 3):
            A.box('metal', (0, 0.50 + k * 0.16 + (0 if lz < 0 else -0.08), lz * HZ), (BW * 0.86, 0.02, 0.02), COL, 1.0, bev=0.003, name='bar')
        A.box('metal', (0, TOP - 0.02, lz * HZ), (BW * 0.86, 0.035, 0.035), COL, 1.0, bev=0.004, name='bar_top')
    if not guard:
        return
    gs = guard
    A.box('metal', (gs * HX, 1.70, -BL * 0.15), (0.03, 0.03, BL * 0.66), COL, 1.0, bev=0.004, name='guard')
    A.box('metal', (gs * HX, 1.55, -BL * 0.15), (0.025, 0.025, BL * 0.66), COL, 1.0, bev=0.004, name='guard')
    if not lo:
        for k in range(4):
            A.box('metal', (gs * HX, 1.53, -BL * 0.45 + k * BL * 0.2), (0.02, 0.32, 0.02), COL, 1.0, bev=0.003, name='baluster')
    lad = BL / 2 - 0.28
    for s in (-1, 1):
        A.box('metal', (gs * HX, 0.95, lad + s * 0.15), (0.03, 1.80, 0.03), COL, 1.0, bev=0.004, name='stile')
    for k in range(4):
        A.box('metal', (gs * HX, 0.50 + k * 0.30, lad), (0.03, 0.025, 0.30), COL, 1.05, bev=0.004, name='rung')
        if A.hi:
            for j in range(5):
                A.box('dark', (gs * (HX + 0.0152), 0.50 + k * 0.30 + 0.0127, lad - 0.12 + j * 0.06), (0.001, 0.0008, 0.03), 0x2a2e33, 1.0, name='grip', proxy=False)


@asset('bunk_frame_r', ao=0.35, inst=True)
def bunk_frame_r(A):
    frame(A, 1)


@asset('bunk_frame_l', ao=0.35, inst=True)
def bunk_frame_l(A):
    frame(A, -1)


@asset('bunk_frame_n', ao=0.35, inst=True)
def bunk_frame_n(A):
    frame(A, 0)


@asset('bed_mattress', ao=0.3, ground=False, inst=True)
def bed_mattress(A):
    """床垫（四周一道包边）和枕头。原点在床板面上（局部 y=0 是床板中心）。"""
    A.cushion('fabric', (0, 0.07, 0), (BW * 0.84, 0.12, BL - 0.14), 0xd8d4c8, 1.05, puff=0.06, r=0.04, name='mattress')
    if not A.lo:
        for s in (-1, 1):
            A.box('fabric', (0, 0.07 + s * 0.052, 0), (BW * 0.845, 0.008, BL - 0.135), 0xc8c4b8, 1.0, bev=0.003, name='piping', proxy=False)
    A.cushion('fabric', (0, 0.175, -BL * 0.38), (BW * 0.56, 0.09, BL * 0.16), 0xe8e4d8, 1.1, puff=0.35, r=0.03, name='pillow')


@asset('quilt_folded', ao=0.3, ground=False, tints={'q': 0x7a8a96}, inst=True)
def quilt_folded(A):
    """叠成长条的被子：上面一层、对折处鼓起来、侧面看得见两层。原点同床垫。"""
    A.cushion('fabric', (0, 0.175, BL * 0.12), (BW * 0.80, 0.09, BL * 0.52), 0xffffff, 1.02, puff=0.12, r=0.04, tag='q', name='quilt')
    if not A.lo:
        A.cushion('fabric', (0, 0.225, BL * 0.12 + 0.02), (BW * 0.78, 0.03, BL * 0.46), 0xffffff, 0.94, puff=0.2, r=0.015, tag='q', name='fold', proxy=False)


@asset('quilt_block', ao=0.3, ground=False, tints={'q': 0x7a8a96}, inst=True)
def quilt_block(A):
    """叠成豆腐块的被子：方方正正，棱角捏出来。"""
    A.box('fabric', (0, 0.23, BL * 0.18), (BW * 0.40, 0.20, BL * 0.26), 0xffffff, 1.0, bev=0.02, tag='q', name='block')
    if not A.lo:
        A.box('fabric', (0, 0.23, BL * 0.18 + BL * 0.13 + 0.0005), (BW * 0.38, 0.004, 0.001), 0xffffff, 0.85, tag='q', name='crease', proxy=False)
