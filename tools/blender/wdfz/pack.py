"""资源包：每个档位一个 JS 文件（game3d/assets/models_l<档>.js），双击 index.html（file://）也能加载。

ASSET_PACK(档位, 元数据, base64 二进制)
数据（解压后）五种：
  POS  Uint16 ×3  位置，按每件资产的外包盒量化
  NRM  Int8   ×3  法线
  COL  Uint8  ×3  颜色（乘组的倍数 cs 还原）
  UV   Int16  ×2  贴图坐标，单位 1/1024 米
  IDX  Uint16     索引（组内从 0 开始；一组最多 65535 个顶点，超了拆成几组）
存的时候做了差分、拆字节面、deflate（见 write）。
元数据：{资产名: {b:[外包盒 6 个数], g:[[材质, 标签, 顶点起点, 顶点数, 索引起点, 索引数, 颜色倍数], ...], p:代理, a:锚点, t:默认染色, k:附加信息,
        i:1 表示一层楼里会重复很多次、游戏里用实例化画}}"""
import base64
import json
import zlib

import numpy as np


class PackWriter:
    def __init__(self, lod):
        self.lod = lod
        self.meta = {}
        self.pos, self.nrm, self.col, self.uv, self.idx = [], [], [], [], []
        self.nv = 0
        self.ni = 0

    def add(self, name, groups, proxies, anchors, tints, extra, inst=False):
        allP = [g['P'] for g in groups if len(g['P'])]
        if not allP:
            return
        P = np.concatenate(allP)
        lo = P.min(axis=0)
        hi = P.max(axis=0)
        ext = np.maximum(hi - lo, 1e-6)
        gm = []
        for g in groups:
            nv = len(g['P'])
            if nv == 0:
                continue
            # 超过 16 位索引就拆
            parts = _split(g) if nv > 65535 else [g]
            for h in parts:
                q = np.clip(np.round((h['P'] - lo) / ext * 65535), 0, 65535).astype(np.uint16)
                self.pos.append(q.reshape(-1))
                self.nrm.append(h['N'].reshape(-1))
                self.col.append(h['C'].reshape(-1))
                self.uv.append(h['U'].reshape(-1))
                self.idx.append(h['I'].astype(np.uint16))
                gm.append([h['mat'], h['tag'], self.nv, len(h['P']), self.ni, len(h['I']), round(float(h['cs']), 4)])
                self.nv += len(h['P'])
                self.ni += len(h['I'])
        rec = {'b': [round(float(x), 5) for x in list(lo) + list(hi)], 'g': gm}
        if proxies:
            rec['p'] = [_round(p) for p in proxies]
        if anchors:
            rec['a'] = {k: _round(v) for k, v in anchors.items()}
        if tints:
            rec['t'] = tints
        if extra:
            rec['k'] = extra
        if inst:
            rec['i'] = 1
        self.meta[name] = rec

    def write(self, path, header=''):
        """压缩：每组里顶点、索引都存和前一个的差（组内第一个存原值），各分量分开、16 位的拆成低字节面和高字节面，
        再整个 deflate。相邻顶点、相邻索引很接近，差值小，压得很好（「真实」档约 1/5）。游戏里同步解开（assets.js）。"""
        P = np.concatenate(self.pos).astype(np.uint16).reshape(-1, 3) if self.pos else np.zeros((0, 3), np.uint16)
        N = np.concatenate(self.nrm).astype(np.int8).reshape(-1, 3) if self.nrm else np.zeros((0, 3), np.int8)
        C = np.concatenate(self.col).astype(np.uint8).reshape(-1, 3) if self.col else np.zeros((0, 3), np.uint8)
        U = np.concatenate(self.uv).astype(np.int16).reshape(-1, 2) if self.uv else np.zeros((0, 2), np.int16)
        I = np.concatenate(self.idx).astype(np.uint16) if self.idx else np.zeros(0, np.uint16)
        dP, dN, dC, dU, dI = P.copy(), N.copy(), C.copy(), U.copy(), I.copy()
        for rec in self.meta.values():
            for g in rec['g']:
                v0, nv, i0, ni = g[2], g[3], g[4], g[5]
                if nv > 1:
                    dP[v0 + 1:v0 + nv] = P[v0 + 1:v0 + nv] - P[v0:v0 + nv - 1]
                    dN[v0 + 1:v0 + nv] = N[v0 + 1:v0 + nv] - N[v0:v0 + nv - 1]
                    dC[v0 + 1:v0 + nv] = C[v0 + 1:v0 + nv] - C[v0:v0 + nv - 1]
                    dU[v0 + 1:v0 + nv] = U[v0 + 1:v0 + nv] - U[v0:v0 + nv - 1]
                if ni > 1:
                    dI[i0 + 1:i0 + ni] = I[i0 + 1:i0 + ni] - I[i0:i0 + ni - 1]

        def planes(a):
            b = np.ascontiguousarray(a).view(np.uint8).reshape(-1, a.itemsize)
            return b.T.copy().tobytes()
        stream = b''.join(planes(np.ascontiguousarray(dP[:, k])) for k in range(3))
        stream += b''.join(np.ascontiguousarray(dN[:, k]).tobytes() for k in range(3))
        stream += b''.join(np.ascontiguousarray(dC[:, k]).tobytes() for k in range(3))
        stream += b''.join(planes(np.ascontiguousarray(dU[:, k])) for k in range(2))
        stream += planes(dI)
        import os
        if os.environ.get('PACK_DEBUG'):
            np.savez(path + '.debug.npz', P=P, N=N, C=C, U=U, I=I)
        co = zlib.compressobj(9, zlib.DEFLATED, -15, 9)
        z = co.compress(stream) + co.flush()
        meta = {'v': 2, 'lod': self.lod, 'nv': self.nv, 'ni': self.ni, 'raw': len(stream), 'assets': self.meta}
        buf = z
        b64 = base64.b64encode(bytes(buf)).decode('ascii')
        js = ('/* 自动生成：tools/blender/build.py（Blender %s）。不要手改，改 tools/blender/assets 里的建模脚本再重新生成。 */\n' % header +
              'ASSET_PACK(%d,%s,\n"%s");\n' % (self.lod, json.dumps(meta, ensure_ascii=False, separators=(',', ':')), b64))
        with open(path, 'w', encoding='utf-8') as f:
            f.write(js)
        return len(buf), len(js)


def _round(v):
    if isinstance(v, dict):
        return {k: _round(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [_round(x) for x in v]
    if isinstance(v, float):
        return round(v, 5)
    return v


def _split(g):
    """一组顶点太多：按三角形顺序切成几段，每段重新编号。"""
    I = g['I'].reshape(-1, 3)
    out = []
    start = 0
    while start < len(I):
        used = {}
        tris = []
        k = start
        while k < len(I):
            t = I[k]
            need = sum(1 for v in t if v not in used)
            if len(used) + need > 65535:
                break
            for v in t:
                if v not in used:
                    used[v] = len(used)
            tris.append([used[v] for v in t])
            k += 1
        src = np.empty(len(used), np.int64)
        for v, i in used.items():
            src[i] = v
        out.append({'mat': g['mat'], 'tag': g['tag'], 'cs': g['cs'], 'P': g['P'][src], 'N': g['N'][src], 'C': g['C'][src],
                    'U': g['U'][src], 'I': np.array(tris, np.int64).reshape(-1)})
        start = k
    return out
