"""把一件资产的零件变成游戏用的顶点数据：应用修改器 → 烘焙接触阴影（AO）到顶点 → 三角形 → 按材质分组 → 去重、量化。

输出每组（材质键 + 染色标签）：
  P  位置（米，资产坐标）       N  法线（-127..127）
  C  颜色（0..255，已乘 AO）    U  贴图坐标（米；游戏里再除以材质的平铺尺寸）
  I  索引
染色标签非空的组，颜色里只存 AO（灰度），游戏里乘上调用方给的颜色（车身色、被子色……）。"""
import math

import bpy
import numpy as np
from mathutils import Matrix, Vector

AO_STRENGTH = 0.82


def _world(dist):
    sc = bpy.context.scene
    if sc.world is None:
        sc.world = bpy.data.worlds.new('w')
    sc.world.light_settings.distance = dist
    try:
        sc.world.use_nodes = False
    except Exception:
        pass
    sc.world.color = (1.0, 1.0, 1.0)


def _plane(name, center, normal, size, coll):
    me = bpy.data.meshes.new(name)
    n = Vector(normal).normalized()
    t = Vector((1, 0, 0)) if abs(n.x) < 0.9 else Vector((0, 0, 1))
    u = n.cross(t).normalized()
    v = n.cross(u).normalized()
    c = Vector(center)
    h = size / 2
    vs = [c + (u * -h) + (v * -h), c + (u * h) + (v * -h), c + (u * h) + (v * h), c + (u * -h) + (v * h)]
    me.from_pydata([tuple(p) for p in vs], [], [(0, 1, 2, 3)])
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    return ob


def evaluate(A):
    """应用修改器（倒角、细分、蒙皮……），原零件删掉，换成求值后的网格。"""
    dg = bpy.context.evaluated_depsgraph_get()
    out = []
    for p in A.parts:
        if p.ob.hide_render:
            continue
        e = p.ob.evaluated_get(dg)
        me = bpy.data.meshes.new_from_object(e, preserve_all_data_layers=True, depsgraph=dg)
        me.transform(p.ob.matrix_world)
        uvm = p.ob.get('uvm')
        ob = bpy.data.objects.new(p.ob.name + '_e', me)
        A.coll.objects.link(ob)
        old = p.ob
        p.ob = ob
        if uvm is not None:
            ob['uvm'] = uvm
        odata = old.data
        bpy.data.objects.remove(old)
        if odata is not None and odata.users == 0:
            if isinstance(odata, bpy.types.Mesh):
                bpy.data.meshes.remove(odata)
            else:
                bpy.data.curves.remove(odata)
        out.append(p)
    # 切东西用的辅助物体：求值完就删掉，不参与烘焙
    for ob in A.aux:
        me = ob.data
        bpy.data.objects.remove(ob)
        bpy.data.meshes.remove(me)
    A.aux = []
    return out


def bake_ao(A, samples=48, dist=0.35):
    """Cycles 把环境光遮蔽烘到每个角点。临时放一块地面（墙面、吊顶）当遮挡，桌腿脚下、靠墙的一面才会暗。"""
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = samples
    sc.render.bake.target = 'VERTEX_COLORS'
    _world(dist)
    spec = A.spec
    tmp = []
    if spec.get('ground', True):
        tmp.append(_plane('ground', (0, -0.0005, 0), (0, 1, 0), 30, A.coll))
    if spec.get('wall') is not None:
        tmp.append(_plane('wall', (0, 1.5, spec['wall'] - 0.0005), (0, 0, 1), 30, A.coll))
    if spec.get('ceil') is not None:
        tmp.append(_plane('ceil', (0, spec['ceil'] + 0.0005, 0), (0, -1, 0), 30, A.coll))
    mat = bpy.data.materials.get('_bake') or bpy.data.materials.new('_bake')
    objs = []
    for p in A.parts:
        me = p.ob.data
        if len(me.polygons) == 0:
            continue
        ca = me.color_attributes.new('ao', 'FLOAT_COLOR', 'CORNER')
        me.color_attributes.active_color = ca
        if len(me.materials) == 0:
            me.materials.append(mat)
        objs.append(p.ob)
    for t in tmp:
        t.data.materials.append(mat)
    if objs:
        bpy.ops.object.select_all(action='DESELECT')
        for ob in objs:
            ob.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        bpy.ops.object.bake(type='AO')
    for t in tmp:
        me = t.data
        bpy.data.objects.remove(t)
        bpy.data.meshes.remove(me)


def _attr_corner(me, name, n):
    ca = me.color_attributes.get(name)
    if ca is None:
        return None
    buf = np.empty(len(ca.data) * 4, np.float32)
    # 字节颜色按写进去的原值读（bmesh 写的是 sRGB 字节，.color 会换成线性）；游戏里顶点色就是原值
    ca.data.foreach_get('color_srgb' if ca.data_type == 'BYTE_COLOR' else 'color', buf)
    buf = buf.reshape(-1, 4)
    if ca.domain == 'POINT':
        vi = np.empty(n, np.int32)
        me.loops.foreach_get('vertex_index', vi)
        return buf[vi]
    return buf


def extract(A):
    """→ {(mat, tag): dict(P, N, C, U, I)}，以及每组的颜色倍数"""
    spec = A.spec
    ground = spec.get('ground', True)
    ceil = spec.get('ceil')
    acc = {}
    for pi, p in enumerate(A.parts):
        me = p.ob.data
        if len(me.polygons) == 0:
            continue
        me.calc_loop_triangles()
        nt = len(me.loop_triangles)
        if nt == 0:
            continue
        nl = len(me.loops)
        tl = np.empty(nt * 3, np.int32)
        me.loop_triangles.foreach_get('loops', tl)
        tv = np.empty(nt * 3, np.int32)
        me.loop_triangles.foreach_get('vertices', tv)
        co = np.empty(len(me.vertices) * 3, np.float32)
        me.vertices.foreach_get('co', co)
        co = co.reshape(-1, 3)
        cn = np.empty(nl * 3, np.float32)
        me.corner_normals.foreach_get('vector', cn)
        cn = cn.reshape(-1, 3)
        P = co[tv]                       # 每个三角形角点
        N = cn[tl]
        # 三角形面法线：去掉贴地朝下 / 贴吊顶朝上的面；选贴图投影轴
        a, b, c = P[0::3], P[1::3], P[2::3]
        fn = np.cross(b - a, c - a)
        fl = np.linalg.norm(fn, axis=1)
        keep = fl > 1e-12
        fn = fn / np.maximum(fl, 1e-12)[:, None]
        if ground:
            ymax = np.maximum(np.maximum(a[:, 1], b[:, 1]), c[:, 1])
            keep &= ~((fn[:, 1] < -0.9) & (ymax <= 0.003))
        if ceil is not None:
            ymin = np.minimum(np.minimum(a[:, 1], b[:, 1]), c[:, 1])
            keep &= ~((fn[:, 1] > 0.9) & (ymin >= ceil - 0.003))
        if not keep.any():
            continue
        tk = np.repeat(keep, 3)
        # AO
        ao = _attr_corner(me, 'ao', nl)
        if ao is not None and not p.emit and p.ao > 0:
            # 同一个顶点的各个角点取平均：采样噪声不会把本该共用的顶点拆开
            lvi = np.empty(nl, np.int32)
            me.loops.foreach_get('vertex_index', lvi)
            nvv = len(me.vertices)
            sm = np.bincount(lvi, weights=ao[:, 0], minlength=nvv)
            ct = np.maximum(np.bincount(lvi, minlength=nvv), 1)
            av = (sm / ct)[lvi][tl]
            av = np.clip(av, 0, 1) ** 0.85
            shade = 1.0 - AO_STRENGTH * p.ao * (1.0 - av)
        else:
            shade = np.ones(nt * 3, np.float32)
        # 颜色
        if p.vcol:
            vc = _attr_corner(me, 'col', nl)
            base = vc[tl][:, :3] if vc is not None else np.tile(np.array(p.rgb, np.float32), (nt * 3, 1))
        else:
            base = np.tile(np.array(p.tag and (1.0, 1.0, 1.0) or p.rgb, np.float32), (nt * 3, 1))
        C = base * shade[:, None]
        # 贴图坐标（米）
        if p.uv == 'mesh' and me.uv_layers.active is not None:
            uvb = np.empty(nl * 2, np.float32)
            me.uv_layers.active.data.foreach_get('uv', uvb)
            U = uvb.reshape(-1, 2)[tl]
        else:
            uvm = p.ob.get('uvm')
            Q = P
            FN = np.repeat(fn, 3, axis=0)
            if uvm is not None:
                M = np.array(uvm, np.float32)
                Q = P @ M[:3, :3].T + M[:3, 3]
                FN = FN @ M[:3, :3].T
            ax = np.argmax(np.abs(FN), axis=1)
            g = {'box': 0, 'boxz': 2, 'boxy': 1}.get(p.uv, 0)
            U = np.empty((len(P), 2), np.float32)
            # 默认（纹理沿 x）：x 面用 (z, y)，y 面用 (x, z)，z 面用 (x, y)——和游戏里 GeoBuilder 一样
            for axis in range(3):
                m = ax == axis
                if not m.any():
                    continue
                others = [k for k in range(3) if k != axis]
                if g != axis and g in others:
                    uu = g
                    vv = [k for k in others if k != g][0]
                else:
                    uu, vv = {0: (2, 1), 1: (0, 2), 2: (0, 1)}[axis]
                U[m, 0] = Q[m, uu]
                U[m, 1] = Q[m, vv]
            # 每个零件的纹理错开一点，不要所有零件同一块花纹
            off = ((pi * 0.6180339) % 1.0) * 0.97
            U[:, 0] += off
            U[:, 1] += (pi * 0.4142135) % 1.0
        key = (p.mat, p.tag)
        d = acc.setdefault(key, {'P': [], 'N': [], 'C': [], 'U': []})
        d['P'].append(P[tk])
        d['N'].append(N[tk])
        d['C'].append(C[tk])
        d['U'].append(U[tk])
    groups = []
    for (mat, tag), d in acc.items():
        P = np.concatenate(d['P'])
        N = np.concatenate(d['N'])
        C = np.concatenate(d['C'])
        U = np.concatenate(d['U'])
        groups.append(dedupe(mat, tag, P, N, C, U))
    groups.sort(key=lambda g: (g['mat'], g['tag']))
    return groups


def dedupe(mat, tag, P, N, C, U):
    """相同的角点（位置、法线、颜色、贴图坐标都一样）合成一个顶点。"""
    cs = float(max(1.0, C.max()))
    qp = np.round(P * 20000).astype(np.int64)
    nn = N / np.maximum(np.linalg.norm(N, axis=1), 1e-9)[:, None]
    qn = np.clip(np.round(nn * 127), -127, 127).astype(np.int64)
    qc = np.clip(np.round(C / cs * 255), 0, 255).astype(np.int64)
    qu = np.clip(np.round(U * 1024), -32767, 32767).astype(np.int64)
    key = np.concatenate([qp, qn, qc, qu], axis=1)
    uniq, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
    inv = inv.reshape(-1)
    # 顶点按第一次出现的顺序排（缓存友好）
    order = np.argsort(first)
    rank = np.empty_like(order)
    rank[order] = np.arange(len(order))
    I = rank[inv].astype(np.int64)
    sel = first[order]
    return {'mat': mat, 'tag': tag, 'cs': cs,
            'P': P[sel].astype(np.float32), 'N': qn[sel].astype(np.int8), 'C': qc[sel].astype(np.uint8),
            'U': qu[sel].astype(np.int16), 'I': I}
