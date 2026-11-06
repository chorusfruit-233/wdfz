"""安卓版启动层的原生音乐 android/app/src/main/res/raw/splash_music.wav（2026-11-06，用户「从签名起就应该有音乐」）。
时间轴对齐 SignatureView 与 MainActivity：0–5.7 秒签名（科幻铺底、琶音、笔尖嗡声、火花、5.0 秒起故障卡顿），
5.7–8.3 秒黑场（低频持续音 + 手机扬声器听得到的泛音、心跳、门轮廓暗闪时的电流声），8.3 秒开门（吱呀 + 闷响），
之后是和主菜单 BGM 同调的不安铺底与稀疏八音盒，游戏画面出来时 App 渐弱 2.2 秒接上游戏 BGM。
用法：python3 tools/make_splash_music.py android/app/src/main/res/raw/splash_music.wav（22050 Hz 单声道 16 位，28 秒，随机种子固定）"""
import numpy as np, wave, sys
SR=22050; T=28.0; N=int(SR*T); t=np.arange(N)/SR
rng=np.random.default_rng(7)
out=np.zeros(N)
def env(t0,a,d,s,r,length):
    e=np.zeros(N); i0=int(t0*SR)
    seg=np.arange(int((length+r)*SR))/SR
    v=np.where(seg<a,seg/max(a,1e-4),np.where(seg<a+d,1-(1-s)*(seg-a)/max(d,1e-4),s))
    v=np.where(seg>length, v*np.clip(1-(seg-length)/max(r,1e-4),0,1),v)
    i1=min(N,i0+len(seg)); e[i0:i1]=v[:i1-i0]; return e
def win(t0,t1,fi=0.3,fo=0.5):
    return np.clip((t-t0)/fi,0,1)*np.clip((t1-t)/fo,0,1)
def lp(x,a):  # one-pole lowpass
    y=np.empty_like(x); acc=0.0
    for i in range(len(x)): acc+=a*(x[i]-acc); y[i]=acc
    return y
def noise(): return rng.standard_normal(N)
nz=noise()
# ---- 签名：科幻铺底（失谐锯齿 → 低通），E 小调，0.2–5.0
pad=np.zeros(N)
for f in (82.41,123.47,164.81,185.0,246.94):
    for d in (-0.35,0.35):
        ph=2*np.pi*(f*(1+d/100))*t; pad+= (2*((ph/(2*np.pi))%1)-1)*0.12
pad=lp(pad,0.06)*win(0.05,5.1,0.6,0.5)
out+=pad*0.55
# 闪烁的琶音（铃声：正弦 + 二倍频，短衰减，带回声）
notes=[659.25,783.99,987.77,1174.66,1318.51,987.77,783.99,1174.66]
for k in range(int((4.6-0.45)/0.18)):
    t0=0.45+k*0.18; f=notes[k%len(notes)]*(2 if k>14 else 1)
    e=env(t0,0.004,0.25,0.0,0.05,0.25)
    tone=(np.sin(2*np.pi*f*t)+0.3*np.sin(2*np.pi*f*2.01*t))*e*0.16
    out+=tone; 
    sh=int(0.27*SR); out[sh:]+=tone[:-sh]*0.45; sh2=int(0.54*SR); out[sh2:]+=tone[:-sh2]*0.2
# 笔尖嗡声（跟着书写，从左往右音高慢慢升）
pen=np.sin(2*np.pi*(880+220*np.clip((t-0.4)/3.3,0,1))*t+3*np.sin(2*np.pi*6*t))*win(0.4,3.75,0.2,0.15)*0.05
out+=pen
# 火花：随机的短促高频滴答
for k in range(70):
    t0=0.45+rng.random()*3.25; f=3000+rng.random()*4000
    e=env(t0,0.001,0.03,0,0.01,0.03); out+=np.sin(2*np.pi*f*t)*e*0.06
# 斜光扫过：带通噪声上扬的嘶声 + 一个亮的和弦
sw=win(3.6,4.6,0.4,0.4)
swn=nz*sw; swn=swn-lp(swn,0.02); out+=lp(swn,0.25)*0.18
for f in (1318.51,1567.98,1975.53,2637.02):
    out+=np.sin(2*np.pi*f*t)*env(3.75,0.01,1.2,0,0.3,1.2)*0.05
# 故障消散 5.0–5.7：把前面一小段反复卡顿、降采样
g0,g1=int(5.0*SR),int(5.7*SR); src=out[int(4.62*SR):int(4.66*SR)].copy()
for i in range(g0,g1,len(src)):
    seg=src[::1]; L=min(len(seg),g1-i)
    k=(i-g0)/(g1-g0); step=int(1+k*12)
    crushed=np.repeat(seg[::step],step)[:L]; crushed=np.round(crushed*(16-14*k))/(16-14*k)
    out[i:i+L]=crushed*(1-k)*1.4+(rng.random()<0.3)*nz[i:i+L]*0.05*(1-k)
out[g1:int(5.75*SR)]=0
# ---- 黑场 5.7–8.3：低频持续音、心跳、门轮廓暗闪时的电流声
dr=np.sin(2*np.pi*41.2*t)*0.5+np.sin(2*np.pi*41.9*t)*0.5
dr+=0.35*np.sin(2*np.pi*164.8*t)+0.25*np.sin(2*np.pi*166.1*t)+0.12*np.sin(2*np.pi*247.2*t)   # 手机扬声器听得到的泛音
out+=dr*win(5.8,8.6,0.8,0.3)*0.05
for hb in (6.35,6.62,7.55,7.82):
    e=env(hb,0.005,0.18,0,0.05,0.18); f0=52+18*np.exp(-(t-hb).clip(0)*30); out+=(np.sin(2*np.pi*f0*t)+0.6*np.sin(2*np.pi*f0*3*t)+0.35*np.sin(2*np.pi*f0*5*t))*e*0.22
for fl,dur in ((6.40,0.06),(7.08,0.07),(7.14,0.06),(7.26,0.08)):
    e=env(fl,0.002,dur,0.6,0.02,dur); buzz=np.sign(np.sin(2*np.pi*100*t))*0.5+nz*0.3; out+=lp(buzz*e,0.3)*0.08
# 高处一丝失谐的尖细声
out+=(np.sin(2*np.pi*2093*t)+np.sin(2*np.pi*2110*t))*win(6.0,8.3,1.2,0.3)*0.012
# ---- 开门 8.3：吱呀（调频的窄带噪声）+ 低沉的闷响
cr=env(8.3,0.05,0.9,0.4,0.25,0.95)
fm=420+260*np.sin(2*np.pi*3.3*(t-8.3))+90*np.sin(2*np.pi*11*(t-8.3))
creak=np.sin(2*np.pi*np.cumsum(fm)/SR)*(0.6+0.4*np.sign(np.sin(2*np.pi*23*t)))
out+=lp(creak*cr,0.35)*0.12
fb=46+30*np.exp(-(t-8.32).clip(0)*8); out+=(np.sin(2*np.pi*fb*t)+0.5*np.sin(2*np.pi*fb*3*t)+0.3*np.sin(2*np.pi*fb*4.2*t))*env(8.32,0.01,1.6,0,0.4,1.6)*0.36
out+=lp(nz*env(8.32,0.002,0.4,0,0.1,0.4),0.08)*0.5
# ---- 门开以后：和主菜单 BGM 同调的不安铺底（根音 43.65，五度压成三全音）+ 稀疏的八音盒
root=43.65
bed=(0.35*np.sin(2*np.pi*root*t)+0.25*np.sin(2*np.pi*root*1.414*t)+0.35*np.sin(2*np.pi*root*2*t)+0.2*np.sin(2*np.pi*root*2.83*t)+0.6*np.sin(2*np.pi*root*4*t)+0.5*np.sin(2*np.pi*root*5.657*t+0.3*np.sin(2*np.pi*0.07*t))+0.18*np.sin(2*np.pi*root*8.02*t))
breath=0.75+0.25*np.sin(2*np.pi*0.11*t)
out+=bed*breath*win(8.6,T,2.5,4.0)*0.11
bed2=lp(nz,0.004)*win(8.6,T,3,4)*1.6; out+=bed2*0.05
mb=[523.25,622.25,739.99,783.99,932.33,1046.5,739.99,622.25]
tt=10.2; k=0
while tt<T-4:
    for j in range(1+int(rng.random()*3)):
        f=mb[(k+j*2)%len(mb)]; e=env(tt+j*0.42,0.002,1.6,0,0.2,1.6)
        out+=(np.sin(2*np.pi*f*t)+0.25*np.sin(2*np.pi*f*3.01*t))*e*0.09
    k+=3; tt+=2.4+rng.random()*2.2
# 收尾、限幅、归一
out*=np.clip((T-t)/2.0,0,1)
out=np.tanh(out*1.3)/np.tanh(1.3)
out=out/np.max(np.abs(out))*0.89
pcm=(out*32767).astype('<i2')
with wave.open(sys.argv[1],'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print(len(pcm)/SR, 's')
