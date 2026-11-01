"""宣传片第二版：配乐和音效，全部用 numpy 现场合成（不用任何采样）。

用法：python video/score.py  → video/build/score.wav
时间轴来自 video/storyboard.json：每个声音都按「某个镜头开始后第几秒」摆放，改了镜头时长会自动跟着走。

三天的声音是同一套素材的变奏：
  第一天：校园铃（四音一组的报时调）、八音盒旋律（C 大调）、暖的和弦垫底、教室里的小动静。
  第二天：同一段铃声和旋律放慢、往下走调、换成小调；低频的小二度持续音进来；每个镜头的怪事各有一声。
  第三天：「第三天」的铃声卡住、倒回「第一天」；之后低频持续音压满，每个异象一声刺耳的切镜和它自己的声音。
  规则与出路：一个慢慢加快的低音脉冲；车、闸机、光圈各有自己的声音。
  结尾：死法闪切、一声巨响和钟、八音盒最后几个音、贴着耳朵的一句气声。
"""
from pathlib import Path
import json
import wave

import numpy as np

SR = 44100
VIDEO = Path(__file__).resolve().parent
rng = np.random.default_rng(2026)

sb = json.loads((VIDEO / 'storyboard.json').read_text(encoding='utf-8'))
START, DUR, t_ = {}, {}, 0.0
for sh in sb['shots']:
    START[sh['id']], DUR[sh['id']] = t_, sh['dur']
    t_ += sh['dur']
TOTAL = t_
N = int(TOTAL * SR)
dry = np.zeros((2, N))
wet = np.zeros((2, N))
T = np.arange(N) / SR


def at(sid, s=0.0):
    return START[sid] + s


# ---------- 零件 ----------
def tt(d):
    return np.arange(max(1, int(d * SR))) / SR


def env(d, a=0.005, decay=4.0, release=None):
    t = tt(d)
    e = np.minimum(1.0, t / max(a, 1e-4)) * np.exp(-decay * t / d)
    if release:
        e *= np.clip((d - t) / release, 0, 1)
    return e


def put(sig, when, gain=1.0, pan=0.0, send=0.3):
    """把单声道信号放到 when 秒；pan -1 左 … 1 右；send 进混响的量。"""
    i = int(when * SR)
    if i >= N or i + len(sig) <= 0:
        return
    if i < 0:
        sig, i = sig[-i:], 0
    sig = sig[:N - i] * gain
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    dry[0, i:i + len(sig)] += sig * l
    dry[1, i:i + len(sig)] += sig * r
    wet[0, i:i + len(sig)] += sig * l * send
    wet[1, i:i + len(sig)] += sig * r * send


def noise(d, lo, hi):
    """带通噪声：频谱遮罩，边沿柔一点。"""
    n = max(2, int(d * SR))
    X = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / SR)
    m = np.convolve(((f >= lo) & (f <= hi)).astype(float), np.hanning(48) / 24, 'same')
    y = np.fft.irfft(X * m, n)
    return y / (np.abs(y).max() + 1e-9)


def osc(freq, d, kind='sine'):
    t = tt(d)
    ph = 2 * np.pi * (np.cumsum(np.broadcast_to(freq, t.shape)) / SR)
    if kind == 'sine':
        return np.sin(ph)
    if kind == 'tri':
        return 2 / np.pi * np.arcsin(np.sin(ph))
    if kind == 'saw':
        return 2 * ((ph / (2 * np.pi)) % 1) - 1
    raise ValueError(kind)


def cents(c):
    return 2 ** (c / 1200)


def chime(when, f, gain, d=2.6, pan=0.0, detune=0.0):
    """校园广播的电子铃：一个亮的基音加两个泛音，带一点颤。"""
    t = tt(d)
    vib = 1 + 0.003 * np.sin(2 * np.pi * 5.2 * t)
    sig = (osc(f * vib * cents(detune), d) + 0.35 * osc(2 * f * vib, d) + 0.12 * osc(3.01 * f, d)) * env(d, 0.01, 3.2)
    put(sig, when, gain, pan, 0.55)


def bell(when, f0, gain, d=6.0, pan=0.0, detune=0.0, send=0.7):
    """铜钟：非整数倍泛音，各自衰减。"""
    parts = [(0.5, 1.0, 0.8), (1.0, 0.7, 1.2), (1.19, 0.45, 1.6), (1.56, 0.35, 2.0), (2.0, 0.3, 2.5), (2.74, 0.2, 3.3), (3.76, 0.12, 4.2)]
    sig = np.zeros(int(d * SR))
    for k, (m, a, dk) in enumerate(parts):
        sig += a * osc(f0 * m * (1 + detune * (1 if k % 2 else -1)), d) * env(d, 0.002, dk * 1.5)
    put(sig, when, gain, pan, send)


def mbox(when, f, gain=0.1, pan=0.0, send=0.7):
    """八音盒：三角波 + 两个高泛音，敲一下就衰减。"""
    d = 2.4
    sig = (osc(f, d, 'tri') + 0.32 * osc(f * 2.005, d) + 0.1 * osc(f * 4.17, d)) * env(d, 0.002, 4.5)
    put(sig, when, gain, pan, send)


def pad(when, d, freqs, gain, send=0.6, warm=True):
    """和弦垫底：几个略微走开的锯齿波过低通，慢起慢收。"""
    n = int(d * SR)
    out = np.zeros(n)
    for f in freqs:
        for dt_ in (-4, 4):
            out += osc(f * cents(dt_), d, 'saw')
    X = np.fft.rfft(out)
    fr = np.fft.rfftfreq(n, 1 / SR)
    out = np.fft.irfft(X * (1 / (1 + (fr / (900 if warm else 500)) ** 4)), n)
    out /= np.abs(out).max() + 1e-9
    t = tt(d)
    e = np.minimum(1, t / min(1.2, d / 3)) * np.clip((d - t) / min(1.0, d / 3), 0, 1)
    put(out * e, when, gain, 0, send)


def boom(when, gain=1.0, f0=46, d=3.0):
    t = tt(d)
    sig = osc(f0 * (1 + 1.7 * np.exp(-t * 9)), d) * env(d, 0.003, 3.2)
    sig += 0.45 * noise(d, 20, 240) * env(d, 0.002, 9)
    put(sig, when, gain, 0, 0.5)


def sting(when, gain=1.0):
    """切镜的刺：低频冲击 + 高音小二度锯齿往下滑 + 一声金属刮擦。"""
    boom(when, 0.8 * gain, 40, 2.4)
    for f, p in ((1180, -0.5), (1250, 0.5), (1770, 0.0)):
        d = 1.2
        put(osc(f * (1 - 0.3 * tt(d) / d), d, 'saw') * env(d, 0.002, 4.5) * 0.07, when, gain, p, 0.7)
    put(noise(0.8, 2600, 7500) * env(0.8, 0.002, 6), when, 0.22 * gain, 0, 0.6)


def heart(when, gain=0.8):
    for dt_, a in ((0, 1.0), (0.16, 0.7)):
        d = 0.3
        put(osc(60 * (1 + 0.8 * np.exp(-tt(d) * 30)), d) * env(d, 0.003, 7), when + dt_, gain * a, 0, 0.05)


def step(when, gain=0.4, pan=0.0, heavy=False, send=0.45):
    d = 0.22
    sig = noise(d, 60, 900 if heavy else 2400) * env(d, 0.002, 14)
    if heavy:
        sig += osc(68 * (1 + np.exp(-tt(d) * 25)), d) * env(d, 0.002, 10)
    put(sig, when, gain, pan, send)


def swell(when, d, lo, hi, gain, send=0.4):
    put(noise(d, lo, hi) * (tt(d) / d) ** 2.5, when, gain, 0, send)


def choir(when, d, gain, freqs=(98, 116.5, 146.8, 155.6)):
    """一群人张嘴的「啊——」：锯齿波过两个元音共振峰。"""
    n = int(d * SR)
    out = np.zeros(n)
    fr = np.fft.rfftfreq(n, 1 / SR)
    form = np.exp(-((fr - 700) / 120) ** 2) + 0.7 * np.exp(-((fr - 1150) / 160) ** 2)
    for i, f in enumerate(freqs):
        out += np.fft.irfft(np.fft.rfft(osc(f * (1 + 0.006 * np.sin(2 * np.pi * (5 + i * 0.3) * tt(d))), d, 'saw')) * form, n)
    out /= np.abs(out).max() + 1e-9
    e = np.minimum(1, tt(d) / (d * 0.6)) * np.clip((d - tt(d)) / 0.3, 0, 1)
    put(out * e, when, gain, 0, 0.9)


def auto(points):
    xs, ys = zip(*points)
    return np.interp(T, xs, ys)


# ---------- 旋律与铃声：三天用同一套 ----------
# 报时铃：四音一组（E C D G / G D E C），学校里最常见的那种
CHIME = [329.6, 261.6, 293.7, 196.0, 196.0, 293.7, 329.6, 261.6]
# 八音盒旋律（C 大调），第二天换成小调（E→E♭、A→A♭、B→B♭）
MEL = [659.3, 784.0, 1046.5, 987.8, 880.0, 784.0, 659.3, 587.3, 523.3]
MINOR = {659.3: 622.3, 880.0: 830.6, 987.8: 932.3}
MEL2 = [MINOR.get(f, f) for f in MEL]

# ===== 第一天 =====
for i, f in enumerate(CHIME):
    chime(at('d1card', 0.15 + i * 0.36), f, 0.24, pan=-0.2 + 0.05 * i)
pad(at('d1gate'), DUR['d1gate'] + DUR['d1class'] + DUR['d1hall'] + DUR['d1cup'], [130.8, 164.8, 196.0], 0.10)   # C 大三和弦
for i, f in enumerate(MEL):
    mbox(at('d1gate', 0.6 + i * 0.62), f, 0.16, pan=(-0.35 if i % 2 else 0.35))
put(noise(DUR['d1gate'], 1500, 6000) * 0.25, at('d1gate'), 0.05, 0.6, 0.2)          # 远处的风、树
for i, f in enumerate(MEL):                                                           # 走廊、窗台：旋律低八度再来一遍
    mbox(at('d1hall', 0.2 + i * 0.66), f / 2, 0.13, pan=(0.3 if i % 2 else -0.3))
for i in range(10):                                                                   # 教室：翻书、粉笔、椅子
    d = 0.07
    put(noise(d, 2500, 7000) * env(d, 0.002, 9), at('d1class', 0.3 + i * 0.42 + rng.random() * 0.2), 0.05, rng.uniform(-0.8, 0.8), 0.4)
put(noise(DUR['d1class'], 200, 900), at('d1class'), 0.06, 0, 0.2)                   # 一屋子人低声说话
for i in range(6):                                                                    # 走廊：远处的脚步
    step(at('d1hall', 0.3 + i * 0.5), 0.2, pan=0.4, send=0.7)
for i in range(3):                                                                    # 窗台上杯子轻轻一磕
    d = 0.12
    put(osc(3200 + 300 * i, d, 'tri') * env(d, 0.001, 9), at('d1cup', 1.2 + i * 0.7), 0.05, 0.2, 0.7)

# ===== 第二天：同一段，慢、低、走调 =====
for i, f in enumerate(CHIME[:5]):
    chime(at('d2card', 0.1 + i * 0.5), f * cents(-60), 0.2, pan=0.1, detune=-25 * i)
pad(at('d2gate'), DUR['d2gate'] + DUR['d2class'] + DUR['d2hall'], [130.8, 155.6, 196.0], 0.08, warm=False)   # C 小三和弦
for i, f in enumerate(MEL2[:6]):
    mbox(at('d2gate', 0.3 + i * 0.95), f * cents(-35 - 12 * i), 0.13, pan=(-0.3 if i % 2 else 0.3))
put(noise(DUR['d2gate'], 150, 700), at('d2gate'), 0.09, 0, 0.3)                      # 风
sting(at('d2gate', DUR['d2gate'] - 0.55), 0.8)                                       # 它贴到门上那一下
choir(at('d2class', 0.2), DUR['d2class'] - 0.1, 0.28)                                # 全班回头
boom(at('d2class', 2.4), 0.9, 40, 2.0)
hall_d = DUR['d2hall']
ht = tt(hall_d)
beat = (ht * 0.9) % 1
dark = ((beat < 0.08) | ((beat > 0.16) & (beat < 0.24)) | ((beat > 0.5) & (beat < 0.7))) & (ht > 0.6)
buzz = (osc(100, hall_d, 'saw') * 0.5 + noise(hall_d, 3000, 8000) * 0.3) * np.where(dark, 0.05, 1.0)
put(buzz * 0.05, at('d2hall'), 1.0, 0.2, 0.4)                                        # 灯管两短一长
for i in range(5):
    step(at('d2hall', 0.4 + i * 0.62), 0.18 + 0.05 * i, pan=0.3, heavy=True, send=0.7)
for i in range(9):                                                                    # 杯子在窗台上晃
    d = 0.08
    put(osc(rng.uniform(2600, 3500), d, 'tri') * env(d, 0.001, 8), at('d2cup', 0.15 + i * 0.13), 0.07, 0.2, 0.6)
FALL = np.sqrt(2 * 10.6 / 9.8)
d = FALL
put(osc(2300 * (600 / 2300) ** (tt(d) / d), d) * np.minimum(1, tt(d) / 0.2) * 0.5, at('d2cup', 1.35), 0.16, 0, 0.3)   # 下落的哨音
swell(at('d2cup', 1.35), FALL, 300, 3200, 0.22)
hit = at('d2cup', 1.35 + FALL)
bell(hit, 620, 0.2, 2.2, detune=0.04, send=0.5)                                       # 「当」
put(noise(0.25, 900, 6000) * env(0.25, 0.001, 8), hit, 0.75, 0, 0.4)
boom(hit, 1.0, 46, 2.0)
for i in range(6):                                                                    # 盖子滚开
    put(noise(0.05, 1200, 4000) * env(0.05, 0.001, 6), hit + 0.25 + i * 0.16, 0.12 * (1 - i / 7), 0.4, 0.3)

# ===== 第三天：铃声卡住，倒回第一天 =====
for i, f in enumerate(CHIME[:3]):
    chime(at('d3card', 0.1 + i * 0.36), f * cents(-90), 0.2, detune=-40)
for i in range(6):                                                                    # 卡住：同一个音一截一截地重复
    d = 0.07
    put(osc(CHIME[2] * cents(-90 - 30 * i), d) * env(d, 0.002, 2), at('d3card', 1.2 + i * 0.06), 0.12, 0, 0.3)
for i, f in enumerate(CHIME[:4]):                                                      # 又从头响起——是第一天的铃
    chime(at('d3card', 1.6 + i * 0.2), f, 0.06, pan=0.3)

# 低频持续音：小二度互相拍出颤动，按段落起伏
drone_amp = auto([(0, 0), (at('d2gate'), 0), (at('d2gate', 1), 0.25), (at('d2cup'), 0.45), (at('d3card'), 0.15),
                  (at('rain'), 0.75), (at('locker'), 0.85), (at('rule'), 0.05), (at('slip'), 0.3), (at('portal', 3), 0.6),
                  (at('deaths'), 0.9), (at('title') - 0.05, 0.95), (at('title'), 0), (at('title', 0.6), 0.4), (at('tag'), 0.0), (TOTAL, 0)])
drone = (0.5 * np.sin(2 * np.pi * 36.7 * T) + 0.3 * np.sin(2 * np.pi * 55.0 * T + 0.3) + 0.25 * np.sin(2 * np.pi * 38.9 * T)
         + 0.12 * np.sin(2 * np.pi * 110.3 * T) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.07 * T)))
dry += 0.34 * drone * drone_amp
wind = noise(TOTAL, 180, 700) * (0.55 + 0.45 * np.sin(2 * np.pi * 0.09 * T + 1))
dry[0] += 0.05 * wind * drone_amp
dry[1] += 0.05 * np.roll(wind, 9000) * drone_amp
# 紧张层：高音小二度簇，带颤音
ten_amp = auto([(0, 0), (at('rain'), 0.02), (at('locker'), 0.08), (at('rule'), 0), (at('deaths'), 0.06), (at('title') - 0.05, 0.12), (at('title'), 0), (TOTAL, 0)])
ten = (np.sin(2 * np.pi * 880 * T) + np.sin(2 * np.pi * 932.3 * T) + 0.6 * np.sin(2 * np.pi * 1396.9 * T)) * (0.6 + 0.4 * np.sin(2 * np.pi * 6.5 * T))
dry += ten * ten_amp * 0.45
wet += ten * ten_amp * 0.35

# 雨：瓢泼的雨声，两道闪电后的雷
rd = DUR['rain']
rain = noise(rd, 400, 9000) * 0.6 + noise(rd, 80, 400) * 0.5
put(rain, at('rain'), 0.4, -0.1, 0.2)
put(np.roll(rain, 5000), at('rain'), 0.4, 0.1, 0.2)
sting(at('rain'), 0.8)
for b in (0.5, 2.2):
    put(noise(0.4, 800, 6000) * env(0.4, 0.002, 7), at('rain', b), 0.42, 0, 0.4)
    put(noise(2.4, 25, 170) * env(2.4, 0.2, 2.5), at('rain', b + 0.3), 0.85, 0, 0.7)
# 蛾群：扑翅声越来越密
sting(at('moth'), 0.7)
for i in range(220):
    x = (i / 220) ** 0.6
    d = rng.uniform(0.02, 0.06)
    put(noise(d, 1200, 3200) * env(d, 0.003, 5), at('moth', x * DUR['moth']), 0.05 + 0.17 * x, rng.uniform(-1, 1), 0.2)
# 钟楼：钟敲下来，越敲越走调
sting(at('bell'), 0.6)
for i, w in enumerate((0.15, 1.15, 2.15)):
    bell(at('bell', w), 73.4, 0.25 + 0.03 * i, 5.0, pan=(-0.2, 0.2, 0)[i], detune=0.01 + 0.025 * i)
# 车库：滴水、手电、它站在那里
for i in range(6):
    d = 0.16
    put(osc(1300 * (1 - 0.5 * tt(d) / d), d) * env(d, 0.002, 12), at('garage', 0.3 + i * 0.5 + rng.random() * 0.2), 0.07, rng.uniform(-0.7, 0.7), 0.9)
put(noise(0.03, 1500, 5000) * env(0.03, 0.001, 5), at('garage', 0.05), 0.3, 0.3, 0.2)
sting(at('garage', 2.25), 0.95)
# 巡察者：沉重的脚步越来越近，灯一红就是心跳
pdur = DUR['patrol']
k = 0.3
while k < pdur - 0.15:
    step(at('patrol', k), 0.25 + 0.5 * k / pdur, heavy=True, send=0.6)
    k += 0.72 - 0.3 * k / pdur
sting(at('patrol', 1.2), 1.0)
for i in range(int((pdur - 1.4) / 0.46)):
    heart(at('patrol', 1.4 + i * 0.46), 0.7)
# 柜子里：闷住的心跳和呼吸，外面的脚步从左走到右
ld = DUR['locker']
for i in range(int(ld / 0.62)):
    heart(at('locker', 0.15 + i * 0.62), 0.45)
for i in range(2):
    b_ = noise(1.2, 200, 1500) * np.sin(np.pi * tt(1.2) / 1.2) ** 2
    put(b_, at('locker', 0.3 + i * 1.6), 0.07, 0, 0.1)
for i in range(6):
    step(at('locker', 0.35 + i * 0.58), 0.33, pan=-0.9 + i * 0.36, heavy=True, send=0.2)

# ===== 规则与出路 =====
boom(at('rule', 1.3), 0.9, 34, 2.6)
for i in range(4):                                                                    # 移交单：纸声、笔划
    put(noise(0.18, 1500, 6000) * np.sin(np.pi * tt(0.18) / 0.18), at('slip', 0.4 + i * 0.55), 0.06, rng.uniform(-0.4, 0.4), 0.3)
pulse_from, pulse_to = at('slip', 0.5), at('deaths')                                  # 低音脉冲：越来越快
k, bpm = pulse_from, 84.0
while k < pulse_to:
    d = 0.25
    put(osc(55 * (1 + 0.5 * np.exp(-tt(d) * 20)), d) * env(d, 0.003, 6), k, 0.35, 0, 0.1)
    bpm *= 1.025
    k += 60 / bpm
# 车：打火、发动机，车灯亮的那一下光里站着它
put(noise(0.6, 100, 900) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 9 * tt(0.6)))), at('car', 0.05), 0.12, 0, 0.1)
cd = DUR['car']
eng = osc(46 + 10 * np.minimum(1, tt(cd) / 1.5), cd, 'saw')
eng = np.fft.irfft(np.fft.rfft(eng) * (np.fft.rfftfreq(len(eng), 1 / SR) < 260), len(eng))
put(eng * np.minimum(1, tt(cd) / 0.5), at('car', 0.5), 0.2, 0, 0.15)
sting(at('car', 0.35), 0.9)
for i in range(7):
    step(at('car', 2.0 + i * 0.3), 0.18 + 0.03 * i, pan=rng.uniform(-0.6, 0.6), heavy=True, send=0.5)
# 闸机：两声「嘀」，然后门里的人一个个出来
for i in range(2):
    d = 0.09
    put(osc(1760, d, 'tri') * env(d, 0.002, 2), at('face', 0.48 + i * 0.13), 0.12, 0.2, 0.3)
choir(at('face', 1.4), DUR['face'] - 1.5, 0.16, freqs=(73.4, 87.3, 110.0, 116.5))
# 门：一个往上滑的发亮的音
pdur = DUR['portal']
for h, a in ((1, 1.0), (2, 0.5), (3, 0.3), (5, 0.18)):
    fr = 220 * h * 2 ** (1.4 * tt(pdur) / pdur)
    put(osc(fr, pdur) * a * np.minimum(1, tt(pdur) / 1.2), at('portal'), 0.055, (-0.3 if h % 2 else 0.3), 0.9)
swell(at('portal', 1.5), pdur - 1.5, 2000, 12000, 0.12)

# ===== 死法闪切 =====
clips = next(s for s in sb['shots'] if s['id'] == 'deaths')['clips']
cl = DUR['deaths'] / len(clips)
for i, c in enumerate(clips):
    w = at('deaths', i * cl)
    sting(w, 0.9)
    if c == 'follow':                                                                  # 一群人拖着脚步跟上来
        for j in range(14):
            step(w + 0.05 + j * 0.085, 0.16 + 0.01 * j, pan=rng.uniform(-0.9, 0.9), send=0.5)
    elif c == 'laugh':                                                                  # 一阵阵「哈」
        for j in range(7):
            d = 0.12
            put(noise(d, 600, 2600) * np.sin(np.pi * tt(d) / d) ** 2 * (1 + 0.5 * osc(210 + 30 * j, d)), w + 0.1 + j * 0.15, 0.25, rng.uniform(-0.7, 0.7), 0.5)
    elif c == 'floor':
        boom(w + 0.25, 1.0, 50, 1.6)
        bell(w + 0.25, 640, 0.15, 1.8, detune=0.05, send=0.4)
    elif c == 'grip':                                                                  # 地下伸出来的手：一声闷响，指甲刮地
        boom(w + 0.15, 0.9, 38, 1.4)
        for j in range(5):
            put(noise(0.18, 2500, 8000) * np.sin(np.pi * tt(0.18) / 0.18), w + 0.3 + j * 0.17, 0.12, rng.uniform(-0.6, 0.6), 0.3)
for i in range(int(DUR['deaths'] / 0.42)):
    heart(at('deaths', i * 0.42), 0.55)

# ===== 片名：一片寂静后一声巨响和钟，八音盒最后几个音 =====
boom(at('title', 0.5), 1.0, 33, 5.0)
bell(at('title', 0.5), 49, 0.42, 8.5, send=0.9)
for i, f in enumerate(MEL2[:5]):
    mbox(at('title', 3.0 + i * 0.8), f * cents(-20 * i), 0.07, pan=(-0.3 if i % 2 else 0.3))

# ===== 尾声：回到第一天的教室；耳边一句气声 =====
put(noise(DUR['tag'], 200, 900), at('tag'), 0.03, 0, 0.2)
pad(at('tag'), DUR['tag'] - 0.35, [130.8, 164.8, 196.0], 0.035)
for i in range(7):
    d = 0.15
    put(noise(d, 1800, 6500) * np.sin(np.pi * tt(d) / d) ** 2, at('tag', 1.0 + i * 0.16), 0.2, 0.85, 0.05)
d = 0.45
put(noise(d, 1500, 5000) * np.sin(np.pi * tt(d) / d) ** 3, at('tag', 1.0 + 7 * 0.16 + 0.05), 0.18, 0.85, 0.05)

# ---------- 混响：衰减噪声做冲激响应，左右声道去相关 ----------
irlen = int(3.0 * SR)
ir = rng.standard_normal((2, irlen)) * np.exp(-np.arange(irlen) / SR * 2.3)
ir[:, :int(0.012 * SR)] = 0
nfft = 1 << int(np.ceil(np.log2(N + irlen)))
rev = np.stack([np.fft.irfft(np.fft.rfft(wet[c], nfft) * np.fft.rfft(ir[c], nfft), nfft)[:N] for c in range(2)])
rev /= np.abs(rev).max() + 1e-9
mix = dry + rev * 0.32 * np.abs(dry).max()

# 尾声最后 0.35 秒和画面一起硬切成黑场：声音也一刀切；整体压一下峰值
cut = at('tag', DUR['tag'] - 0.35)
mix[:, int(cut * SR):] *= np.exp(-np.arange(N - int(cut * SR)) / (0.02 * SR))
mix = np.tanh(mix / (np.percentile(np.abs(mix), 99.95) + 1e-9) * 0.9)
mix *= 0.89 / (np.abs(mix).max() + 1e-9)

out = VIDEO / 'build'
out.mkdir(exist_ok=True)
pcm = (mix.T * 32767).astype(np.int16)
with wave.open(str(out / 'score.wav'), 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print('score.wav', f'{TOTAL:.1f}s')
