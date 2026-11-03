# 武大附中 · 里世界 3D

3D 校园怪谈探索游戏。仓库首页 `index.html` 是游戏入口，原来的 `3d.html` 链接会自动跳转到首页。

[开始游戏](https://chorusfruit-233.github.io/wdfz/) · [游戏 Wiki](https://chorusfruit-233.github.io/wdfz/wiki/) · [游戏设计与机制总览](https://chorusfruit-233.github.io/wdfz/docs/game-design-overview.html)

[观看四条公开真结局实录](https://chorusfruit-233.github.io/wdfz/video/endings.html)：汽车逃脱、白名单验证、收集材料造门与《网安仙人》。录像保留各自录制版本的原速画面、游戏原声、章节与操作日志；《网安仙人》实录早于无线破解位置暴露规则，不能当作当前版本的通关示范。[生成代码和运行方法](video/游玩示例.md)。

Wiki 收录操作、课表、地点、道具、异象和公开结局路线的攻略；异象详解与结局路线默认折叠，方便避开剧透。游戏主菜单也可以打开 Wiki。

主菜单除了「预知梦」「梦魇」两种难度（开局前选一项天赋，新局先播一段可跳过的 3D 开场），还有「速通模式」（从第一次能操作计时到真结局，本机记录个人最佳，不占普通存档）和「死亡档案室」（每种死法第一次发生时记一份，可重看死亡演出；达成过的结局和看过的开场也能重看）。

[游戏设计与机制总览](https://chorusfruit-233.github.io/wdfz/docs/game-design-overview.html) 是面向人类阅读的图解入口：14 个章节（00–13）、16 幅编号图解，先讲机制用途与相互关系，再展开规则、数值和例外。包含章节搜索、独立剧透折叠、异象筛选和两项规则演示；[单文件 HTML](docs/game-design-overview.html) 可直接在浏览器打开。完整规则与评审材料仍以产品对齐文档和对应代码为准。

本地运行时，在仓库目录执行 `python -m http.server 8000`，然后访问 `http://localhost:8000/`，也可以直接双击打开 `index.html`。游戏所需的脚本和素材均在仓库内：模型和贴图打包在 `game3d/assets/`，开局按画质读一档。模型在 Blender 里用脚本建（`tools/blender/`，改了以后运行 `python tools/blender/build.py` 重新打包，需要 `pip install bpy==5.2.3` 和 Python 3.13），贴图由 `tools/textures/build_textures.py` 离线生成。

代码使用私有实现和显式依赖契约：全部脚本在 `game3d/manifest.js` 里按模块登记并按顺序加载，新功能做成 `game3d/js/modules/` 下的独立模块，通过钩子接入。游戏支持 Mod：暂停菜单「Mod 与模块」可导入本地 `.js`，网址加 `?mod=名字` 加载 `game3d/mods/` 里的 Mod，`?nomod` 为安全模式。共享空间配方可脱离渲染生成碰撞，玩法与画面／音效使用独立随机来源；接入边界见[模块边界与迁移](docs/模块边界与迁移.md)。约定与写法见[模块化与 Mod 规范](docs/模块化与Mod规范.md)。

桌面端使用 WASD 移动、鼠标环视、Shift 奔跑、E 交互；上课坐下时可按 R 查看课桌；Tab 打开背包，Esc 关闭面板或暂停；Alt 只放出鼠标、不暂停（点画面收回）。触屏设备使用左侧摇杆移动，滑动屏幕转动视角。页面右上角可切换全屏。

当前一天自然运行 **20 分钟**：三个连续阶段各 6 分钟，熄灯后 2 分钟。第二天起可在讲台登记外出，许可跨越普通课堂；每天 12:50、17:50 回教室集合，提前 1 分钟广播提醒。首日晚间开始持续升压，第二天起异象更密、危险区消耗更高、恢复更弱。SAN 通过视听与身体反应提示，低 SAN 降低体力上限。无线破解每累计 15 个有效运行秒向巡察者暴露一次静态位置，收起手机继续，暂停与断电接续计时。规则见[产品对齐文档](docs/产品对齐文档.md#survival)，计划状态见[计划目录](docs/plan/README.md)。

项目文档统一收录在 [文档目录](docs/)：包括[游戏设计与机制总览](https://chorusfruit-233.github.io/wdfz/docs/game-design-overview.html)、[产品对齐文档](docs/产品对齐文档.md)、[3D 更新说明](docs/3D更新说明.md)、[3D 代码审查报告](docs/3D代码审查报告.md)、[建模统计](docs/建模统计.md)、[试玩记录](docs/试玩记录.md)、[测试说明](docs/测试说明.md)、[调试面板说明](docs/调试面板说明.md)、[模块化与 Mod 规范](docs/模块化与Mod规范.md)和仅适用于 Claude 的 [Claude 测试攻略](docs/AI测试攻略.md)。
