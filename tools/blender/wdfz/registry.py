"""资产登记：@asset('名字', ground=True, ...) 装饰一个建模函数 fn(A)。

spec 里的常用项：
  ground  贴地（默认 True）：烘焙时垫一块地面，贴地朝下的面不导出
  wall    背面贴墙时墙面所在的 z（局部）；烘焙时立一面墙
  ceil    吊在顶上时吊顶的高度；烘焙时盖一块顶，贴顶朝上的面不导出
  ao      接触阴影的距离（米），默认 0.35
  lods    这件东西有哪几档（默认 0–3 全有）
  tints   染色标签的默认颜色 {标签: 0xRRGGBB}
  inst    一层楼里重复很多次（课桌椅、床、灯……）：游戏里用实例化画，不抄进房间的大网格"""
REGISTRY = {}
ORDER = []


def asset(name, **spec):
    def deco(fn):
        if name in REGISTRY:
            raise ValueError('重复的资产名：' + name)
        REGISTRY[name] = (fn, spec)
        ORDER.append(name)
        return fn
    return deco
