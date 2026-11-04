# WebGPU 接入验证

2026-11-04，基于 `main@1b227c1`，首个实现提交 `c9e26b1`。后续提交修正原生颗粒、补充测试等待条件、文档和本目录证据。使用 Chromium 154.0.8037.57、Linux、SwiftShader/Vulkan 软件设备；原生路径确实创建 GPUAdapter/GPUDevice 并执行 WGSL，没有用 WebGL 冒充 WebGPU。

运行时代码 SHA-256：`6d88b30216a782456a25c3897adfbfd33f796ae9aaa812fc99f60f0419ea6f2f`。摘要包括所有 `game3d/js` 脚本、模块清单、契约和两个 Three.js 包；计算方式见 [`tools/renderer_audit.py`](../../../tools/renderer_audit.py)。生成截图时的摘要与最终运行时代码一致；此前回归和后续颗粒专项按增量覆盖记录。

## 范围与结果

本轮选择与渲染、输入、启动、资源、几何、存档及模块边界相关的测试，按当前测试 ID 去重为 **265 项：264 通过、1 项跳过**。采用分组运行和必要复测，未运行当前全仓的每个测试，也不是单次全量全绿。逐项最终结果、原始来源和初次失败记录见[回归结果](回归结果.json)及 [`logs/`](logs/)。

| 检查 | 覆盖与结果 |
| --- | --- |
| 原生与回退 | 15 项最终通过：真实出图、纹理读回、共享核心类型、五档画质、深度/MSAA、后期像素变化、颗粒分布、手持物、开场、天气异象、死亡预览；无 API、空适配器、申请失败、包加载失败、后期准备失败、初始化超时、迟到设备释放、设备丢失及触屏恢复。 |
| 渲染与规则回归 | 79 项，78 通过、1 跳过：画质、高 DPI、断网、模型包、合批、全校几何、楼梯、感官、纯规则及架构边界。跳过的是环境管理策略禁止的 `file://` 启动；HTTP 本地断网加载检查通过。 |
| 操作与生命周期 | 171 项最终通过：桌面捕获鼠标、混合设备、触屏、全屏、死亡与结局演出、开场、Mod、存档和表现状态。初次有 4 项失败，修订异步启动等待后复跑整个模块组及两项操作用例，共 13 项通过。 |
| 静态检查 | 模块契约、依赖层次、状态写入归属、碰撞数据生成一致性及 170 个运行时 JS 文件的语法检查通过。 |
| 生成包与 CI | 固定 Three.js 0.187.0 / esbuild 0.28.2，本地资源随仓库部署；GitHub 工作流重新构建并核对提交的包，再跑原生 WebGPU、WebGL 与感官回归。CI 状态以 [PR #44](https://github.com/wd-fz/wd-fz.github.io/pull/44/checks) 为准。 |

初次操作组的 4 项分别为：亮度设置重载后提前读取后期材质；两个模块用例提前读取场景或启动钩子生成的界面；一项页面加载超时。前三项补充 `Engine.ready()` / `Assets.ready()` 等待，模块组固定使用 GL；加载超时用例原样复测通过。原生专项继续独立执行，测试没有通过强制全局 GL 绕过 WebGPU。

开发中的原生预检查曾发现多采样深度绑定类型不匹配，已改为按采样数选择 WGSL 深度类型并取样本平均；后期初始化失败也有专门回退测试。最终原生专项和画面采集均通过。

截图复核还发现原生浮点颗粒随像素和时间偏移增大出现条纹；读回像素的 10 像素间隔相关性约为 0.60。WGSL 现用整数哈希，新增用例检查实际像素噪声和周期相关性；修正后的颗粒、手持合成及全画质专项共 3 项通过。采集脚本改为明确调用 `Engine.grain(0)`，并断言、记录每张截图的实际颗粒强度为零；此前仅改设置对象的截图已全部替换。

## 画面证据

下列图像由固定种子、同一机位和冻结模拟的脚本生成，开启手电、关闭颗粒；用于核对后端、方向、模型、手持物与高低画质。它们是受控渲染截图，不是自然游玩的实录。每张的实际后端、相机、绘制计数、渲染目标、MSAA、AO 及错误列表见[画面与后端](画面与后端.json)。

| 场景 / 画质 | WebGL | WebGPU |
| --- | --- | --- |
| 教室 / 0 | [截图](webgl-q0-room.png) | [截图](webgpu-q0-room.png) |
| 教室 / 4 | [截图](webgl-q4-room.png) | [截图](webgpu-q4-room.png) |
| 楼梯 / 0 | [截图](webgl-q0-stairs.png) | [截图](webgpu-q0-stairs.png) |
| 楼梯 / 4 | [截图](webgl-q4-stairs.png) | [截图](webgpu-q4-stairs.png) |

8 张图的后端均符合请求，无模块或生命周期错误。JSON 中的 `physicsSHA256` 只比较当时的房间占地字段 `foot/propExtra/stairExtra`，不是完整楼梯求解器的摘要；楼梯高度、路径和碰撞的验证来自浏览器回归。两种后端不承诺逐像素相同，截图与绘制计数也不用于宣称性能提升。

## 复跑

在仓库根目录运行，安装 Chromium 与 Python Playwright 后：

```bash
python tools/check_modules.py
PYTHONPATH=tests python -m unittest -v test_webgpu
PYTHONPATH=tests python -m unittest -v test_engine test_assets test_asset_batching test_geometry test_sensory test_school_rebuild test_architecture_core test_domain_rules test_architecture_contracts test_module_boundaries
PYTHONPATH=tests python -m unittest -v test_controls test_death_timeline test_opening test_modules test_module_persistence test_save_boundary test_presentation_states
python tools/renderer_audit.py
```

原生测试及采集脚本为 Chromium 开启 `--enable-unsafe-webgpu --use-vulkan=swiftshader --enable-features=Vulkan`；这些参数只属于自动验证，不是给玩家的浏览器配置要求。构建与部署步骤见[渲染说明](../../WebGPU与WebGL渲染.md)。

## 验证限制

未完成实体 Android/iPhone、Safari/Firefox、不同显卡驱动、长期设备丢失、真实功耗与温升、自然完整游玩的人工验收；不能据软件 GPU 推断实际性能。WebGL 回退需要 WebGL 2，升级后的 Three.js r187 不支持 WebGL 1。普通远程 HTTP 可能没有 WebGPU，仍可走 GL；生产建议 HTTPS。
