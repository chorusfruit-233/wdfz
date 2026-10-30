# 武大附中 · 里世界 3D

3D 校园怪谈探索游戏。仓库首页 `index.html` 是游戏入口，原来的 `3d.html` 链接会自动跳转到首页。

[开始游戏](https://chorusfruit-233.github.io/wdfz/) · [游戏 Wiki](https://chorusfruit-233.github.io/wdfz/wiki/)

Wiki 收录操作、课表、地点、道具、异象和五个结局的攻略；异象详解与结局路线默认折叠，方便避开剧透。游戏主菜单也可以打开 Wiki。

本地运行时，在仓库目录执行 `python -m http.server 8000`，然后访问 `http://localhost:8000/`，也可以直接双击打开 `index.html`。游戏所需的脚本和素材均在仓库内：模型和贴图打包在 `game3d/assets/`，开局按画质读一档。模型在 Blender 里用脚本建（`tools/blender/`，改了以后运行 `python tools/blender/build.py` 重新打包，需要 `pip install bpy==5.2.3` 和 Python 3.13），贴图由 `tools/textures/build_textures.py` 离线生成。

桌面端使用 WASD 移动、鼠标环视、Shift 奔跑、E 交互；上课坐下时可按 R 查看课桌；Tab 打开背包，Esc 关闭面板或暂停。触屏设备使用左侧摇杆移动，滑动屏幕转动视角。页面右上角可切换全屏。

本轮草稿 PR 正在实施[校园压力重做计划](docs/计划-SAN与校园压力重做.md)：SAN 通过视听与身体反应提示，低 SAN 降低体力上限；每次课间 3 分钟，午晚活动各 8 分钟。

项目文档统一收录在 [文档目录](docs/)：包括[产品对齐文档](docs/产品对齐文档.md)、[3D 更新说明](docs/3D更新说明.md)、[3D 代码审查报告](docs/3D代码审查报告.md)、[建模统计](docs/建模统计.md)、[试玩记录](docs/试玩记录.md)、[测试说明](docs/测试说明.md)和仅适用于 Claude 的 [Claude 测试攻略](docs/AI测试攻略.md)。
