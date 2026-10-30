"""里世界 3D 的离线建模库（Blender 5.2 的 Python 模块 bpy）。

建模脚本在 tools/blender/assets/，用游戏坐标（米，y 朝上）描述每件东西；
tools/blender/build.py 按四个细节档位生成、烘焙、导出到 game3d/assets/models_l*.js，
游戏运行时由 three.js 读进来（game3d/js/model/assets.js）。"""
from .asset import Asset
from .registry import asset, REGISTRY, ORDER
from .geom import V, hexrgb, euler, fillet_path, lerp, smoothstep, rrect, arc_pts
