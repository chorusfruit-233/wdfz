# Claude 测试攻略

本文仅适用于 Claude，不对其他 AI 协作者设定要求。它帮助 Claude 快速定位代码、复现问题并选择回归检查，适用于当前 3D 游戏；项目约定不检查 2D 版。详细覆盖清单见[测试说明](测试说明.md)，产品规则和验收场景见[产品对齐文档](产品对齐文档.md)。以下命令均在仓库根目录执行。

## 1. 先确认环境和改动范围

```bash
git status --short
git log -1 --oneline
python3 --version
python3 -m playwright --version
command -v chromium
```

先阅读 `CLAUDE.md` 和改动涉及的现有代码、测试，保留工作区已有改动。页面入口是 `index.html`，`3d.html` 仅将查询参数和哈希一并转到首页；Wiki 位于 `wiki/`。静态页面无构建步骤，Three.js 和游戏素材在仓库内。

浏览器回归需要 Python 的 Playwright 和 Chromium。如果没有依赖，按[测试说明](测试说明.md)安装；若使用其他位置的 Chromium，设置 `CHROMIUM_EXECUTABLE=/浏览器/可执行文件`。测试优先采用该变量，然后寻找系统 `chromium`；两者都没有时交给 Playwright 使用其安装的浏览器。自动测试启动本地临时端口的 HTTP 服务，默认使用无头 Chromium 和 SwiftShader 软件 WebGL，不需要手动先启动服务。

## 2. 按改动选择测试

| 改动范围 | 先读的代码 | 有针对性的检查 |
| --- | --- | --- |
| 输入、菜单、触屏、存档、玩法、异象、结局 | `game3d/js/input.js`、`ui.js`、`mobile.js`、`save.js`、相关玩法模块 | `PYTHONPATH=tests python3 -m unittest test_controls -v`；再按用例名定位 |
| 渲染、画质、引擎、离线资源 | `game3d/js/engine/`、`render.js`、`quality.js`、`settings.js` | `PYTHONPATH=tests python3 -m unittest test_engine -v` |
| 模型包、贴图包、实例化与室外合批 | `game3d/js/model/assets.js`、`kit.js`、`materials.js`；建模脚本 `tools/blender/`，贴图 `tools/textures/` | `PYTHONPATH=tests python3 -m unittest test_assets test_asset_batching -v`；改了建模脚本要用 `python3 tools/blender/build.py [--only 名字]` 重新打包（需要 `pip install bpy==5.2.3`，只支持 Python 3.13），改了贴图脚本运行 `python3 tools/textures/build_textures.py` |
| 建模、碰撞、楼梯、空间可达性 | `game3d/js/model/`、`collision.js`、`spiral.js`、`world.js` | `PYTHONPATH=tests python3 -m unittest test_geometry test_model -v`；必要时做下面的几何扫描 |
| 穿模审查工具（仅建模或玩法更新时） | `tools/clip_audit.py`、`tools/clip_audit.js` | `PYTHONPATH=tests python3 -m unittest test_clip_audit -v` |
| 宣传片输出安全 | `video/render.py` | `PYTHONPATH=tests python3 -m unittest test_video -v` |

查找已有用例，避免重写同一场景；单项示例：

```bash
rg -n 'def test_.*(touch|save|quality|collision)' tests
PYTHONPATH=tests python3 -m unittest test_engine.EngineTest.test_ultra_real_render_and_resource_release -v
```

完成相关专项后，建模或玩法更新可运行全量检查并保留汇总；全量检查包含穿模检查，其他类型的更新不要运行全量命令，应选择不包含穿模检查的相关测试：

```bash
python3 -m unittest discover -s tests -v
```

测试数量以本次输出为准；不要把历史文档里的数量当作当前结果。报告通过、失败、跳过的实际数量和原因。`file://` 在部分环境可能因策略受阻并跳过；记录实际原因，不要把跳过写成通过。资源离线启动另有浏览器拦截测试，不能证明 `file://` 可用。

## 3. 本地人工复现

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

访问 `http://127.0.0.1:8000/`。确认主菜单显示，选择难度进入教室；桌面用 WASD、鼠标、Shift、E、Tab、Esc，触屏使用摇杆和滑动视角。检查开发者控制台异常及画面上的错误提示。旧入口用 `/3d.html`，Wiki 可从主菜单打开并返回游戏。手动测试结束后停止 HTTP 服务。

调试面板可用 F2 或暂停菜单的「调试」打开；密码在 `game3d/js/dev.js` 的 `Dev.open` 中。面板支持室内外传送、触发异象、调整时间、无敌和状态查看。它适合快速搭建场景，但传送或直接触发异象不能证明正常行走、触发条件或完整剧情链路可用；这些需求还要按玩家路径验证。

状态会影响复现：`wdfz3d` 是存档，`wdfz3d_ends` 是结局记录，`wdfz_pro` 控制前情提要，`zw3d_set` 保存设置。优先使用新的浏览器上下文或独立临时配置，避免覆盖已有玩家数据；不要直接清除用户浏览器的数据。localStorage 按来源隔离，不同端口可能有不同状态。修改画质、时间、角色位置、房间或事件时，记录初始状态和操作步骤。

## 4. 自动化复现与结果边界

`tests/browser_case.py` 是浏览器公共夹具：每个用例的新上下文监听 `pageerror`，预设看过前情、流畅画质和静音，并将 `running=false`，固定初始位置；换画质用 `self.set_quality(page, q)`，它会等这一档的模型包读好再返回；它使输入断言稳定，但不会自然推进游戏。需要验证正常启动、时间、声音、随机事件或真实渲染时，应建立对应条件并明确是否恢复循环，不要把注入状态的测试当作自然试玩通关。`Game.start('easy')` 会进入 `teach1`；如直接调用内部函数设置场景，应注明注入状态以及验证的边界。

桌面和触屏的浏览器模拟可验证布局与事件分发，不等同于实体设备；WebKit 接口模拟不等于真实 Safari/iPhone。SwiftShader 截图和耗时不代表真实 GPU、亮度或实际游戏帧率。涉及设备兼容、性能、完整剧情或音频时，说明尚未覆盖的实机检查。

## 5. 几何扫描与证据

只有更新了建模或玩法时才进行穿模检查，包括下列几何扫描和相关的自动化穿模用例；其他更新不运行这些检查。

指定输出到临时路径，避免默认覆盖仓库内的 `tools/clip_report.json`：

```bash
python3 tools/clip_audit.py bell1 --quality 3 --out /tmp/wdfz-bell1-clip.json
python3 tools/clip_audit.py --quality 3 --out /tmp/wdfz-all-clip.json
```

`out` 是室外，省略房间时扫描全校；画质为 0–4（4 是「真实」）。检查报告的 `scope`、`counts` 和 `issues`：成功退出不等于候选数为零，候选也不自动等于真实穿模，需结合场景和[第七轮 PR 审查](第七轮PR审查.md)判断。只扫描一个房间不能声称全校通过。

建模统计 `python3 tools/model_stats.py /tmp/wdfz-stats.json` 五档各建一遍全校、在 10 个固定机位各画一帧，实例化的按个数算顶点；对比别的版本时用 `WDFZ_ROOT=<检出目录>`。仓库里的 `docs/建模统计.json` 是记录，输出写到临时路径，别无意覆盖。

`tools/engine_compare.py` 会写入 `docs/引擎性能对照.json` 和 `pictures/引擎重构/` 下的截图；需要对比时先检查现有文件和工作区，在隔离副本中运行，勿无意覆盖证据。软件渲染的采样仅适合在相同环境和固定机位比较，不代表实机帧率。

按 `CLAUDE.md` 的约定，每次改动提交测试截图：放到 `pictures/<轮次或主题>/`，文件名描述画面，并在 `pictures/README.md` 添加索引。截图记录视口、设备/浏览器、画质、地点、操作和是否注入状态；视觉修改尽量在相同视角下保存前后图。截图只能证明所显示的场景，不能替代断言或完整游玩。

## 6. 交付记录

说明问题或需求、修改位置、复现与验证命令、实际结果和未验证范围。失败时保留报错、浏览器与环境、复现步骤；先区分依赖或环境限制与产品缺陷，不靠多次盲目重试。每次更新完成后逐一检查并对齐仓库中的所有文档，更新所有需要调整的内容，包括玩家 Wiki、产品文档和测试说明；历史记录保留当时背景和事实。代码改动按 `CLAUDE.md` 先提 PR，不要合并。
