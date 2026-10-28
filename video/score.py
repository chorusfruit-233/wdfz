"""合成宣传片配乐（纯 numpy，不用任何采样）。

用法：python video/score.py  → video/build/score.wav
按 video/timeline.json 的镜头时长对齐：每个镜头的音效都从镜头起点算时间。
"""
from pathlib import Path
import json
import wave

import numpy as np

SR = 44100
VIDEO = Path(__file__).resolve().parent
rng = np.random.default_rng(13)

tl = json.loads((VIDEO / 'timeline.json').read_text(encoding='utf-8'))
starts, s = {}, 0.0
for sh in tl['shots']:
    starts[sh['id']] = s
    s += sh['dur']
TOTAL = s                                      # 和画面一样长：最后 1.5 秒淡出
N = int(TOTAL * SR)
dry = np.zeros((2, N))
wet = np.zeros((2, N))


# ---------- 基本零件 ----------
def tt(dur):
    return np.arange(int(dur * SR)) / SR


def env(dur, a=0.01, r=None, curve=3.0):
    """起音 a 秒，然后按指数衰减到结尾。"""
    t = tt(dur)
    e = np.minimum(1, t / max(a, 1e-4))
    if r is None:
        e *= np.exp(-curve * t / dur)
    else:
        e *= np.clip((dur - t) / r, 0, 1)
    return e


def place(sig, at, gain=1.0, pan=0.0, send=0.25):
    """把单声道信号放到 at 秒处；pan -1 左 ~ 1 右；send 进混响的量。"""
    i = int(at * SR)
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


def shaped_noise(dur, lo, hi):
    """用频谱遮罩做带通噪声（比逐点 IIR 快得多）。"""
    n = int(dur * SR)
    x = rng.standard_normal(n)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    m = ((f >= lo) & (f <= hi)).astype(float)
    m = np.convolve(m, np.hanning(64) / 32, 'same')       # 边沿柔一点
    y = np.fft.irfft(X * m, n)
    return y / (np.abs(y).max() + 1e-9)


def osc(freq, dur, kind='sine', phase=0.0):
    t = tt(dur)
    if np.ndim(freq):
        ph = 2 * np.pi * np.cumsum(freq) / SR + phase
    else:
        ph = 2 * np.pi * freq * t + phase
    if kind == 'sine':
        return np.sin(ph)
    if kind == 'tri':
        return 2 / np.pi * np.arcsin(np.sin(ph))
    if kind == 'saw':
        return 2 * ((ph / (2 * np.pi)) % 1) - 1
    raise ValueError(kind)


def bell(at, f0, gain, dur=6.0, pan=0.0, send=0.6, detune=0.0):
    """铜钟：非整数倍泛音，每个泛音衰减速度不同。"""
    parts = [(0.5, 1.0, 0.8), (1.0, 0.7, 1.2), (1.19, 0.45, 1.6), (1.56, 0.35, 2.0),
             (2.0, 0.35, 2.4), (2.74, 0.2, 3.2), (3.76, 0.12, 4.0), (4.07, 0.08, 4.6)]
    sig = np.zeros(int(dur * SR))
    for k, (m, a, d) in enumerate(parts):
        f = f0 * m * (1 + detune * (k % 2 * 2 - 1))
        sig += a * osc(f, dur) * env(dur, 0.002, curve=d * 1.4)
    place(sig, at, gain, pan, send)


def boom(at, gain=1.0, f0=48, dur=3.0, send=0.5):
    """低频冲击：一下往下掉的正弦 + 一团低通噪声。"""
    t = tt(dur)
    f = f0 * (1 + 1.6 * np.exp(-t * 9))
    sig = osc(f, dur) * env(dur, 0.004, curve=3.2)
    sig += 0.5 * shaped_noise(dur, 20, 260) * env(dur, 0.002, curve=8)
    place(sig, at, gain, 0, send)


def stinger(at, gain=1.0):
    """刺耳的切镜：低频冲击 + 高音小二度簇 + 一声金属刮擦。"""
    boom(at, 0.9 * gain, 42, 2.6)
    for f, p in ((1250, -0.5), (1324, 0.5), (1873, 0.0)):
        d = 1.4
        fr = f * (1 - 0.25 * tt(d) / d)
        place(osc(fr, d, 'saw') * env(d, 0.003, curve=4) * 0.08, at, gain, p, 0.7)
    place(shaped_noise(0.9, 2500, 7000) * env(0.9, 0.002, curve=6), at, 0.25 * gain, 0, 0.6)


def heartbeat(at, gain=0.8):
    for dt_, a in ((0, 1.0), (0.17, 0.7)):
        d = 0.32
        f = 62 * (1 + 0.8 * np.exp(-tt(d) * 30))
        place(osc(f, d) * env(d, 0.004, curve=7), at + dt_, gain * a, 0, 0.05)


def step(at, gain=0.5, pan=0.0, heavy=False, send=0.45):
    d = 0.22
    sig = shaped_noise(d, 60, 900 if heavy else 2200) * env(d, 0.002, curve=14)
    if heavy:
        sig += osc(70 * (1 + np.exp(-tt(d) * 25)), d) * env(d, 0.002, curve=10)
    place(sig, at, gain, pan, send)


def music_box(at, freq, gain=0.12, pan=0.0):
    d = 3.2
    sig = (osc(freq, d, 'tri') + 0.35 * osc(freq * 2.01, d) + 0.12 * osc(freq * 4.2, d)) * env(d, 0.003, curve=4)
    place(sig, at, gain, pan, 0.8)


def swell(at, dur, lo, hi, gain, rise=True, send=0.4):
    """噪声起来（反向混响一样的吸气）。"""
    sig = shaped_noise(dur, lo, hi)
    e = (tt(dur) / dur) ** 2.5 if rise else np.exp(-4 * tt(dur) / dur)
    place(sig * e, at, gain, 0, send)


def choir(at, dur, gain, freqs=(98, 116.5, 146.8, 155.6)):
    """一群人的「啊——」：锯齿波过两个元音共振峰，微微走音。"""
    n = int(dur * SR)
    out = np.zeros(n)
    for i, f in enumerate(freqs):
        vib = f * (1 + 0.006 * np.sin(2 * np.pi * (5 + i * 0.3) * tt(dur)))
        s_ = osc(vib, dur, 'saw')
        X = np.fft.rfft(s_)
        fr = np.fft.rfftfreq(n, 1 / SR)
        form = np.exp(-((fr - 700) / 120) ** 2) + 0.7 * np.exp(-((fr - 1150) / 160) ** 2)
        out += np.fft.irfft(X * form, n)
    out /= np.abs(out).max() + 1e-9
    e = np.minimum(1, tt(dur) / (dur * 0.6)) * np.clip((dur - tt(dur)) / 0.3, 0, 1)
    place(out * e, at, gain, 0, 0.9)


def at_(sid, t=0.0):
    return starts[sid] + t


# ---------- 底层：小二度持续音，按段落起伏 ----------
def automation(points):
    xs, ys = zip(*points)
    return np.interp(np.arange(N) / SR, xs, ys)


drone_amp = automation([
    (0, 0), (1.5, 0.3), (at_('gate'), 0.55), (at_('class'), 0.65), (at_('hall'), 0.75), (at_('garage'), 0.85),
    (at_('card1'), 0.12), (at_('rain') - 0.01, 0.12), (at_('rain'), 0.55), (at_('patrol') + 5, 0.75),
    (at_('card2'), 0.1), (at_('locker'), 0.4), (at_('escape') + 4, 0.55), (at_('flurry'), 0.85),
    (at_('title') - 0.05, 0.9), (at_('title'), 0.0), (at_('title') + 0.7, 0.35), (at_('whisper'), 0.06), (TOTAL, 0)])
t_all = np.arange(N) / SR
drone = (0.5 * np.sin(2 * np.pi * 36.7 * t_all) + 0.35 * np.sin(2 * np.pi * 55.0 * t_all + 0.3)
         + 0.25 * np.sin(2 * np.pi * 38.9 * t_all)                            # 和 36.7 Hz 拍出小二度的颤
         + 0.12 * np.sin(2 * np.pi * 110.3 * t_all) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.07 * t_all)))
wind = shaped_noise(TOTAL, 180, 700) * (0.55 + 0.45 * np.sin(2 * np.pi * 0.09 * t_all + 1))
dry += 0.36 * drone * drone_amp
dry[0] += 0.05 * wind * drone_amp
dry[1] += 0.05 * np.roll(wind, 9000) * drone_amp

# 紧张层：高音小二度簇，带颤音（异象段和最后的闪切）
ten_amp = automation([(0, 0), (at_('rain'), 0), (at_('rain') + 1, 0.05), (at_('patrol') + 5, 0.09),
                      (at_('card2'), 0), (at_('flurry'), 0.04), (at_('title') - 0.05, 0.14), (at_('title'), 0), (TOTAL, 0)])
trem = 0.6 + 0.4 * np.sin(2 * np.pi * 6.5 * t_all)
ten = (np.sin(2 * np.pi * 880 * t_all) + np.sin(2 * np.pi * 932.3 * t_all) + 0.6 * np.sin(2 * np.pi * 1396.9 * t_all)) * trem
dry += ten * ten_amp * 0.5
wet += ten * ten_amp * 0.4

# ---------- 开场：黑场两行字 ----------
bell(at_('open', 0.4), 98, 0.28, 7, send=0.8)
MOTIF = [440, 523.3, 392, 311.1, 293.7]                  # 八音盒：不成调，最后落在一个不稳的音上
for i, f in enumerate(MOTIF):
    music_box(at_('open', 1.2 + i * 0.95), f, 0.09, pan=(-0.4 if i % 2 else 0.4))

# ---------- 北门：远处的上课铃走了调 ----------
for i in range(10):
    music_box(at_('gate', 1.0 + i * 0.16), 1046 * (0.97 if i % 2 else 1), 0.03, pan=0.6)
swell(at_('gate', 3), 3.5, 200, 900, 0.05, rise=False)
# ---------- 教学楼 / 教室：八音盒再来一遍，慢半拍 ----------
for i, f in enumerate(MOTIF[:4]):
    music_box(at_('facade', 0.8 + i * 1.2), f * 0.5, 0.1)
for i in range(9):                                         # 粉笔、翻书、有人咳嗽……很轻
    place(shaped_noise(0.08, 2500, 6000) * env(0.08, 0.002, curve=10), at_('class', 0.6 + i * 0.55 + rng.random() * 0.3), 0.04, rng.uniform(-0.8, 0.8), 0.5)
music_box(at_('class', 3.6), 311.1, 0.1)
# ---------- 走廊：脚步、灯管两短一长 ----------
for i in range(8):
    step(at_('hall', 0.3 + i * 0.58), 0.28, pan=(-0.15 if i % 2 else 0.15), send=0.7)
hall_t = tt(starts['bell'] - starts['hall'])
beat = (hall_t * 0.9) % 1
dark = ((beat < 0.08) | ((beat > 0.16) & (beat < 0.24)) | ((beat > 0.5) & (beat < 0.7))) & (hall_t > 1.2)
buzz = (osc(100, hall_t[-1] + 1 / SR, 'saw')[:len(hall_t)] * 0.5 + shaped_noise(len(hall_t) / SR, 3000, 8000)[:len(hall_t)] * 0.3)
buzz *= np.where(dark, 0.05, 1.0) * np.clip((hall_t - 0.3), 0, 1)
place(buzz * 0.06, at_('hall'), 1.0, 0.2, 0.4)
for k in np.where(np.diff(dark.astype(int)) == 1)[0][:6]:
    place(shaped_noise(0.05, 4000, 9000) * env(0.05, 0.001, curve=6), at_('hall') + k / SR, 0.25, 0.3, 0.3)
# ---------- 钟楼：钟敲下来，第三下走了调 ----------
bell(at_('bell', 0.3), 73.4, 0.24, 6)
bell(at_('bell', 1.9), 73.4, 0.22, 6, pan=-0.2)
bell(at_('bell', 3.5), 73.4, 0.27, 6, pan=0.2, detune=0.03)
# ---------- 车库：滴水、手电、它站在那儿 ----------
for i in range(7):
    d = 0.18
    place(osc(1300 * (1 - 0.5 * tt(d) / d), d) * env(d, 0.002, curve=12), at_('garage', 0.4 + i * 0.8 + rng.random() * 0.3), 0.07, rng.uniform(-0.7, 0.7), 0.9)
place(shaped_noise(0.03, 1500, 5000) * env(0.03, 0.001, curve=5), at_('garage', 0.05), 0.3, 0.3, 0.2)   # 手电开关
place(shaped_noise(5.5, 25, 90), at_('garage'), 0.18, 0, 0.3)
stinger(at_('garage', 3.55), 0.9)
# ---------- 「然后，异象开始了。」 ----------
heartbeat(at_('card1', 0.3), 0.7)
heartbeat(at_('card1', 1.2), 0.75)
swell(at_('card1', 1.3), 1.5, 300, 6000, 0.35)
# ---------- 雨：瓢泼雨声，两道闪电后的雷 ----------
rain = shaped_noise(starts['moth'] - starts['rain'], 400, 9000) * 0.6 + shaped_noise(starts['moth'] - starts['rain'], 80, 400) * 0.5
place(rain, at_('rain'), 0.42, -0.1, 0.2)
place(np.roll(rain, 5000), at_('rain'), 0.42, 0.1, 0.2)
stinger(at_('rain'), 0.8)
for b in (0.9, 3.0):
    place(shaped_noise(0.4, 800, 6000) * env(0.4, 0.002, curve=7), at_('rain', b), 0.45, 0, 0.4)  # 近处的炸裂
    place(shaped_noise(3.5, 25, 170) * env(3.5, 0.25, curve=2.5), at_('rain', b + 0.35), 0.9, 0, 0.7)
# ---------- 蛾群：扑翅声越来越密 ----------
stinger(at_('moth'), 0.7)
md = starts['stare'] - starts['moth']
for i in range(260):
    x = (i / 260) ** 0.6
    d = rng.uniform(0.02, 0.06)
    place(shaped_noise(d, 1200, 3200) * env(d, 0.003, curve=5), at_('moth', x * md), 0.05 + 0.18 * x, rng.uniform(-1, 1), 0.2)
# ---------- 全体回头：一群人的「啊——」，最后一声重击 ----------
stinger(at_('stare'), 0.7)
choir(at_('stare', 0.3), 3.6, 0.32)
boom(at_('stare', 2.8), 1.0, 40, 2.4)
place(shaped_noise(0.6, 600, 4000) * env(0.6, 0.002, curve=5), at_('stare', 2.8), 0.3, 0, 0.8)
# ---------- 清华水杯：窗台叮当、下落哨音、「当」 ----------
for i in range(10):
    d = 0.09
    place(osc(rng.uniform(2600, 3400), d, 'tri') * env(d, 0.002, curve=8), at_('cup', 0.3 + i * 0.13), 0.08, 0.15, 0.6)
FALL = np.sqrt(2 * 10.6 / 9.8)
d = FALL
place(osc(2300 * (650 / 2300) ** (tt(d) / d), d) * np.minimum(1, tt(d) / 0.2) * 0.5, at_('cup', 1.6), 0.18, 0, 0.3)
swell(at_('cup', 1.6), FALL, 300, 3000, 0.25)
hit = at_('cup', 1.6 + FALL)
bell(hit, 620, 0.22, 2.5, send=0.5, detune=0.04)
place(shaped_noise(0.25, 900, 6000) * env(0.25, 0.001, curve=8), hit, 0.8, 0, 0.4)
boom(hit, 1.1, 46, 2.0)
# ---------- 巡察者：沉重的脚步越来越近，灯一红就是心跳 ----------
pd_ = starts['card2'] - starts['patrol']
tk = 0.3
while tk < pd_ - 0.2:
    k_ = tk / pd_
    step(at_('patrol', tk), 0.25 + 0.5 * k_, pan=0.0, heavy=True, send=0.6)
    tk += 0.75 - 0.35 * k_
stinger(at_('patrol', 1.6), 1.0)
for i in range(int((pd_ - 1.8) / 0.48)):
    heartbeat(at_('patrol', 1.8 + i * 0.48), 0.75)
# ---------- 「规则只有一条：活过今天。」 ----------
boom(at_('card2', 1.3), 0.9, 36, 2.6)
# ---------- 柜子里：闷住的心跳、呼吸，外面的脚步从左走到右 ----------
ld = starts['portal'] - starts['locker']
for i in range(int(ld / 0.66)):
    heartbeat(at_('locker', 0.2 + i * 0.66), 0.5)
for i in range(3):
    b_ = shaped_noise(1.2, 200, 1500) * np.sin(np.pi * tt(1.2) / 1.2) ** 2
    place(b_, at_('locker', 0.3 + i * 1.5), 0.07, 0, 0.1)
for i in range(6):
    step(at_('locker', 0.4 + i * 0.7), 0.35, pan=-0.9 + i * 0.36, heavy=True, send=0.2)
# ---------- 门：一个往上滑的、发亮的音 ----------
pdur = starts['escape'] - starts['portal']
for h, a in ((1, 1.0), (2, 0.5), (3, 0.3), (5, 0.18)):
    fr = 220 * h * 2 ** (1.5 * tt(pdur) / pdur)
    place(osc(fr, pdur) * a * np.minimum(1, tt(pdur) / 1.5), at_('portal'), 0.06, (-0.3 if h % 2 else 0.3), 0.9)
swell(at_('portal', 2.5), pdur - 2.5, 2000, 12000, 0.12)
# ---------- 开车冲出去：发动机、胎噪，身后学校的铃 ----------
ed_ = starts['flurry'] - starts['escape']
eng = osc(48 + 6 * np.sin(2 * np.pi * 0.5 * tt(ed_)), ed_, 'saw')
eng = np.fft.irfft(np.fft.rfft(eng) * (np.fft.rfftfreq(len(eng), 1 / SR) < 260), len(eng))
place(eng * np.minimum(1, tt(ed_) / 0.4), at_('escape'), 0.2, 0, 0.15)
place(shaped_noise(ed_, 300, 1500), at_('escape'), 0.06, 0, 0.1)
for i in range(4):
    bell(at_('escape', 0.8 + i * 0.9), 196, 0.08 * (1 - i * 0.2), 3, pan=0, send=0.9)
# ---------- 闪切：心跳越来越快，每次闪白一下就一声 ----------
fd = starts['title'] - starts['flurry']
tk, bpm = 0.0, 130
while tk < fd:
    heartbeat(at_('flurry', tk), 0.9)
    bpm += 14
    tk += 60 / bpm
for n in range(int(fd / 0.3)):
    if n % 3 == 0:
        place(shaped_noise(0.25, 800, 8000) * env(0.25, 0.001, curve=7), at_('flurry', n * 0.3), 0.35, (-0.5 if n % 2 else 0.5), 0.5)
swell(at_('flurry'), fd, 400, 10000, 0.5)
# ---------- 片名：一片寂静后一声巨响和钟 ----------
boom(at_('title', 0.6), 1.0, 34, 5.0, send=0.9)
bell(at_('title', 0.6), 49, 0.42, 9, send=0.9)
for i, f in enumerate(MOTIF):
    music_box(at_('title', 3.6 + i * 0.9), f, 0.075, pan=(-0.3 if i % 2 else 0.3))
# ---------- 最后一句：贴着耳朵的气声 ----------
for i in range(7):
    d = 0.16
    place(shaped_noise(d, 1800, 6500) * np.sin(np.pi * tt(d) / d) ** 2, at_('whisper', 0.8 + i * 0.17), 0.22, 0.85, 0.05)
d = 0.5
place(shaped_noise(d, 1500, 5000) * np.sin(np.pi * tt(d) / d) ** 3, at_('whisper', 0.8 + 7 * 0.17 + 0.05), 0.2, 0.85, 0.05)

# ---------- 混响：衰减噪声做冲激响应，左右声道去相关 ----------
irlen = int(3.2 * SR)
ir = rng.standard_normal((2, irlen)) * np.exp(-np.arange(irlen) / SR * 2.2)
ir[:, :int(0.012 * SR)] = 0
nfft = 1 << int(np.ceil(np.log2(N + irlen)))
rev = np.stack([np.fft.irfft(np.fft.rfft(wet[c], nfft) * np.fft.rfft(ir[c], nfft), nfft)[:N] for c in range(2)])
rev /= np.abs(rev).max() + 1e-9
mix = dry + rev * 0.35 * np.abs(dry).max()

# 结尾：最后 1.5 秒淡出；整体压一下峰值
fade = np.clip((TOTAL - t_all) / 1.5, 0, 1)
mix *= fade
mix = np.tanh(mix / (np.percentile(np.abs(mix), 99.95) + 1e-9) * 0.9)
mix *= 0.89 / np.abs(mix).max()

out = VIDEO / 'build'
out.mkdir(exist_ok=True)
pcm = (mix.T * 32767).astype(np.int16)
with wave.open(str(out / 'score.wav'), 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print('score.wav', f'{TOTAL:.1f}s')
