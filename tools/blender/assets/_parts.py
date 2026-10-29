"""各处共用的小零件：拉手、螺钉、脚轮、书、指示灯、百叶、圆角面板……
约定和资产一样：游戏坐标（米，y 朝上），「正面」朝 +z。"""
import math

from wdfz import rrect

STEEL = 0xb8c0c2
CHROME = 0xd0d6da
BLACK = 0x15181b


def rpanel(A, mat, c, w, h, t, r, col, shade=1.0, bev=0.002, rot=0.0, tag='', name='panel', proxy=True, axis='z'):
    """圆角矩形板：在 x-y 平面里，厚 t 沿 z。"""
    n = (6, 4, 3, 1)[A.L] if r > 0.004 else (2 if A.L <= 1 else 0)
    return A.prism(mat, c, rrect(w, h, r, n), t, col, shade, bev=bev, rot=rot, tag=tag, name=name, proxy=proxy, axis=axis)


def handle_bar(A, c, length, col=STEEL, axis='y', r=0.0055, off=0.028, name='handle'):
    """柜门、抽屉的拉手：两个支脚 + 一根杆，贴在朝 +z 的面上（c 是贴面的中心点）。"""
    x, y, z = c
    if A.lo:
        if axis == 'y':
            A.box('metal', (x, y, z + off / 2), (0.012, length, off), col, 1.15, name=name, proxy=False)
        else:
            A.box('metal', (x, y, z + off / 2), (length, 0.012, off), col, 1.15, name=name, proxy=False)
        return
    d = (0, length / 2, 0) if axis == 'y' else (length / 2, 0, 0)
    for s in (-1, 1):
        p = (x + d[0] * s * 0.82, y + d[1] * s * 0.82, z)
        A.rod('metal', p, (p[0], p[1], z + off), r * 0.9, r * 0.9, col, 1.1, seg=8, caps=False, name=name, proxy=False)
    A.rod('metal', (x - d[0], y - d[1], z + off), (x + d[0], y + d[1], z + off), r, r, col, 1.15, seg=10, round_=r * 0.5, name=name, proxy=False)
    A.proxy_box((x, y, z + off / 2), (0.014 if axis == 'y' else length, length if axis == 'y' else 0.014, off))


def knob(A, c, r=0.012, col=STEEL, name='knob'):
    """圆把手（朝 +z）。"""
    x, y, z = c
    A.lathe('metal', (x, y, z), [(0, 0), (r * 0.45, 0), (r * 0.45, r * 0.9), (r, r * 1.4), (r * 0.95, r * 1.9), (0, r * 2.0)], col, 1.15, seg=12, dirn=(0, 0, 1), proxy=False, name=name)


def screw(A, c, nrm=(0, 0, 1), r=0.004, col=0x9aa2a8):
    if not A.hi:
        return
    A.cyl('metal', c, r, r * 0.8, r * 0.5, col, 1.1, seg=8, dirn=nrm, proxy=False, name='screw')


def led(A, c, col, s=0.006, nrm=(0, 0, 1)):
    """指示灯：一粒发光的小方块（不吃光）。"""
    x, y, z = c
    d = 0.002
    if nrm == (0, 0, 1):
        A.box('emit', (x, y, z + d / 2), (s, s, d), col, 1.0, proxy=False, name='led')
    elif nrm == (0, 1, 0):
        A.box('emit', (x, y + d / 2, z), (s, d, s), col, 1.0, proxy=False, name='led')
    else:
        A.box('emit', (x + d / 2, y, z), (d, s, s), col, 1.0, proxy=False, name='led')


def slats(A, mat, c, w, h, n, col, depth=0.01, t=0.004, name='slat'):
    """百叶 / 散热孔：n 道横向的薄片（朝 +z 的面上）。"""
    x, y, z = c
    if A.lo:
        A.box('dark', (x, y, z + 0.001), (w, h, 0.002), 0x14181b, 1.0, proxy=False, name=name)
        return
    A.box('dark', (x, y, z - depth / 2 + 0.0005), (w, h, depth), 0x0e1113, 1.0, proxy=False, name=name)
    for k in range(n):
        yy = y - h / 2 + h * (k + 0.5) / n
        A.box(mat, (x, yy, z - 0.001), (w, t, depth * 0.9), col, 1.0, rot=(0.6, 0, 0), proxy=False, name=name)


def caster(A, x, z, col=0x16191c, yaw=0.0, h=0.06):
    """办公椅的双轮脚轮：叉架、两个轮子、转轴。"""
    with A.at(x, 0, z, ry=yaw):
        if A.lo:
            A.box('plastic', (0, h / 2, 0), (0.05, h, 0.04), col, 1.0, name='caster')
            return
        r = h * 0.42
        for s in (-1, 1):
            A.cyl('plastic', (s * 0.011, r, 0.006), r, r, 0.012, col, 1.0, seg=12 if A.hi else 8, round_=0.003 if A.hi else 0.0, dirn=(s, 0, 0), name='wheel', proxy=False)
        A.box('plastic', (0, r + 0.004, 0.0), (0.012, r * 1.5, r * 2.0), 0x23272b, 1.0, bev=0.004, name='fork', proxy=False)
        A.cyl('metal', (0, r * 1.6, -0.006), 0.006, 0.006, h - r * 1.6 + 0.01, 0x8c949a, 1.1, seg=8, name='stem', proxy=False)
        A.proxy_box((0, h / 2, 0), (0.05, h, 0.05))


BOOK_COLS = [0x6a2a2a, 0x2a4a6a, 0xc8b890, 0x3a5a3a, 0x8a6a2a, 0x5a3a6a, 0x2a5a5a, 0x9a4a32, 0x384048]


def book(A, c, w, h, d, col, ry=0.0, rz=0.0, name='book'):
    """一本书：封面（硬一点的板）、书页（米白，往里缩一点）、书脊。立着放：w 是厚度（x）、h 高（y）、d 宽（z）。"""
    x, y, z = c
    if A.lo:
        A.box('paper', c, (w, h, d), col, 1.0, rot=(0, ry, rz), name=name)
        return
    if A.L == 2:                       # 均衡：封皮一块、书页一块（三面露出米白的纸边）
        with A.at(x, y, z, ry=ry, rz=rz):
            A.box('paper', (0, 0, -0.002), (w, h, d - 0.004), col, 1.0, name=name + '_cover', proxy=False)
            A.box('paper', (0, 0, 0.0015), (w * 0.8, h - 0.006, d - 0.003), 0xe8e2d2, 1.0, name=name + '_pages', proxy=False)
            A.proxy_box((0, 0, 0), (w, h, d))
        return
    with A.at(x, y, z, ry=ry, rz=rz):
        ct = min(0.0025, w * 0.18)
        for s in (-1, 1):
            A.box('paper', (s * (w / 2 - ct / 2), 0, 0), (ct, h, d), col, 1.0, bev=0.0008, name=name + '_cover', proxy=False)
        A.box('paper', (0, 0, 0.0015), (w - ct * 2 + 0.0004, h - 0.006, d - 0.004), 0xe8e2d2, 1.0, name=name + '_pages', proxy=False)
        A.box('paper', (0, 0, -d / 2 + 0.0012), (w, h, 0.0024), col, 0.92, bev=0.0008, name=name + '_spine', proxy=False)
        if A.hi and h > 0.12:
            A.box('paper', (0, h * 0.28, -d / 2 - 0.0003), (w * 0.9, 0.012, 0.0008), 0xd8cfa8, 1.0, name=name + '_label', proxy=False)
        A.proxy_box((0, 0, 0), (w, h, d))
