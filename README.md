# 武大附中 · 里世界 3D

3D 校园怪谈探索游戏。仓库首页 `index.html` 是游戏入口，原来的 `3d.html` 链接会自动跳转到首页。

[开始游戏](https://chorusfruit-233.github.io/wdfz/) · [游戏 Wiki](https://chorusfruit-233.github.io/wdfz/wiki/) · [游戏设计与机制总览](https://chorusfruit-233.github.io/wdfz/docs/game-design-overview.html)

[观看完整通关实录](https://chorusfruit-233.github.io/wdfz/video/playthrough.html)：7 分 57 秒，从全新开局到汽车真结局，脚本操作键鼠、原速无剪辑。提供[生成代码和操作日志](video/游玩示例.md)。

Wiki 收录操作、课表、地点、道具、异象和公开结局路线的攻略；异象详解与结局路线默认折叠，方便避开剧透。游戏主菜单也可以打开 Wiki。

[游戏设计与机制总览](https://chorusfruit-233.github.io/wdfz/docs/game-design-overview.html) 是面向人类阅读的图解入口：13 个章节、16 幅编号图解，先讲机制用途与相互关系，再展开规则、数值和例外。包含章节搜索、独立剧透折叠、异象筛选和两项规则演示；[单文件 HTML](docs/game-design-overview.html) 可直接在浏览器打开。完整规则与评审材料仍以产品对齐文档和对应代码为准。

本地运行时，在仓库目录执行 `python -m http.server 8000`，然后访问 `http://localhost:8000/`，也可以直接双击打开 `index.html`。游戏所需的脚本和素材均在仓库内：模型和贴图打包在 `game3d/assets/`，开局按画质读一档。模型在 Blender 里用脚本建（`tools/blender/`，改了以后运行 `python tools/blender/build.py` 重新打包，需要 `pip install bpy==5.2.3` 和 Python 3.13），贴图由 `tools/textures/build_textures.py` 离线生成。

桌面端使用 WASD 移动、鼠标环视、Shift 奔跑、E 交互；上课坐下时可按 R 查看课桌；Tab 打开背包，Esc 关闭面板或暂停；Alt 只放出鼠标、不暂停（点画面收回）。触屏设备使用左侧摇杆移动，滑动屏幕转动视角。页面右上角可切换全屏。

当前一天自然运行 **20 分钟**：三个连续阶段各 6 分钟，熄灯后 2 分钟。讲台可固定登记外出，许可跨越普通课堂；每天 12:50、17:50 回教室集合，提前 1 分钟广播提醒。SAN 通过视听与身体反应提示，低 SAN 降低体力上限。规则见[产品对齐文档](docs/产品对齐文档.md#survival)，计划状态见[计划目录](docs/plan/README.md)。

项目文档统一收录在 [文档目录](docs/)：包括[游戏设计与机制总览](https://chorusfruit-233.github.io/wdfz/docs/game-design-overview.html)、[产品对齐文档](docs/产品对齐文档.md)、[3D 更新说明](docs/3D更新说明.md)、[3D 代码审查报告](docs/3D代码审查报告.md)、[建模统计](docs/建模统计.md)、[试玩记录](docs/试玩记录.md)、[测试说明](docs/测试说明.md)、[调试面板说明](docs/调试面板说明.md)和仅适用于 Claude 的 [Claude 测试攻略](docs/AI测试攻略.md)。
