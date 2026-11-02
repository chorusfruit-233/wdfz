# 模块化与 Mod 规范

> 2026-11-02 按用户手稿建立（把项目整理成模块化形式，改哪块只动哪块；新功能能通过放入 / 上传文件插入；有 Mod 入口供测试和自制；写明规范），同日第二轮按计划[项目解耦与模块化](plan/项目解耦与模块化.md)第 4–5 节重排为**分层目录**，保留 Mod 结构。本文是开发约定，也是写 Mod 的说明。迁移进度见那份计划的第 10、11 节，自动生成的盘点见[模块依赖盘点](模块依赖盘点.md)。

## 1. 总体结构

```text
index.html                 页面结构；只加载 game3d/js/app/modules.js、game3d/manifest.js，然后 GameModules.boot()
game3d/manifest.js         分层定义（GameModules.layers）+ 模块清单（GameModules.define）；顺序 = 加载顺序
game3d/js/app/             应用流程：模块注册表与 Mod 加载（modules.js）、会话与场景生命周期（session.js）、主循环与启动（main.js）、
                           场景切换（world.js）、输入与键盘分派表（input.js）、速通、死亡档案室
game3d/js/content/         内容数据：常量与物品表（core.js）、房间网格（map.js）、虚空迷宫布局（void-maze-data.js）
game3d/js/domain/          游戏规则：状态、碰撞、SAN / 校规 / 压力、异象、巡察、电梯、物品、交互、剧情、天赋、迷宫与彩蛋判定、粉笔记号……
game3d/js/adapters/        平台适配：存档与设置（浏览器存储）、触屏 / 全屏 / 视口
game3d/js/engine/          渲染引擎：Engine 门面、three.js 后端、场景缓存、画质、灯光、阴影
game3d/js/model/           建模：材质、Kit、人物、房间 / 家具 / 楼 / 室外 / 传送门 / 电梯 / 迷宫模型
game3d/js/fx/              表现与音效：演出、异象画面、手、过场、声音（audio.js）、迷宫环境声与彩蛋画面、粉笔记号画面
game3d/js/ui/              界面：字幕与手册（ui.js）、小游戏界面、前情提要、楼层草图、Mod 管理面板
game3d/js/dev/             开发工具：调试面板、试玩记录
game3d/lib/                第三方库（three.js）
game3d/mods/               随游戏发布、默认关闭的 Mod（index.js 是登记表）
tools/module_audit.py      分层盘点与越界扫描，生成 docs/模块依赖盘点.md 和越界基线 tests/module_boundaries.json
```

加载过程：`index.html` → `app/modules.js`（定义 `GameModules`）→ `manifest.js`（`layers` + 逐个 `define`）→ `GameModules.boot()` 按清单顺序用 `document.write` 写入全部 `<script>`（同步、保序，`file://` 双击打开也能用）→ 核对每个模块声明的导出 → 加载 Mod → `DOMContentLoaded` 时 `main.js` 的 `boot()` 启动，末尾发 `boot` 钩子。

### 1.1 分层

| 层 | 目录 | 负责 | 不许直接用 |
| --- | --- | --- | --- |
| 应用流程 `app` | `game3d/js/app/` | 启动、主循环、会话与场景生命周期、模式切换、输入路由、Mod 加载 | `THREE`、`GLR` |
| 内容数据 `content` | `game3d/js/content/` | 常量、物品表、课表、房间网格、迷宫布局等配置 | `THREE`、`GLR`、`document`、浏览器存储、改写权威玩家状态 |
| 游戏规则 `domain` | `game3d/js/domain/` | 玩家状态、时间与压力、物品、天赋、异象、巡察、路线与结局判定 | `THREE`、`GLR`、`document`、浏览器存储 |
| 平台适配 `adapters` | `game3d/js/adapters/` | 存档与设置的浏览器存储、触屏 / 全屏 / 视口 | `THREE`、`GLR` |
| 渲染引擎 `engine` | `game3d/js/engine/` | Engine 门面、three.js 后端、场景缓存、画质、灯光与阴影 | 改写权威玩家状态 |
| 建模 `model` | `game3d/js/model/` | 材质、Kit、各类模型 | 改写权威玩家状态 |
| 表现与音效 `fx` | `game3d/js/fx/` | 演出、异象画面、手、过场、音效与环境声 | 改写权威玩家状态 |
| 界面 `ui` | `game3d/js/ui/` | 字幕、手册、选择框、小游戏界面、前情提要、Mod 面板 | `THREE`、`GLR` |
| 开发工具 `dev` | `game3d/js/dev/` | 调试面板、试玩记录 | — |

「改写权威玩家状态」指直接给 `S.san / S.dead / S.viol / S.stam / S.bag / S.hot / S.tsec / S.day / S.room / S.mode / S.x / S.y / S.floorY / S.seated / S.death` 赋值。规则写在清单 `GameModules.layers([...])` 的 `forbid` 里，`tools/module_audit.py` 去掉注释后静态扫描。**旧代码已有的越界记在 `tests/module_boundaries.json`（迁移待办，2026-11-02 基线 15 个文件、124 处），`tests/test_modules.py` 只许它减少、不许新增；新文件必须守住所在层的规则。**越界减少后运行 `python tools/module_audit.py --baseline` 更新基线。

### 1.2 模块

模块是一个功能或系统，可以跨层（例如虚空迷宫：`content/void-maze-data.js` 布局、`domain/void-maze.js` 碰撞与规则、`model/void-maze.js` 建模、`fx/void-maze-sound.js` 环境声）。`game3d/manifest.js` 每个模块一段：

| 字段 | 含义 |
| --- | --- |
| `id` | 模块 ID（小写、连字符），全局唯一 |
| `name` / `desc` | 中文名与职责 |
| `files` | 这个模块的全部脚本，按加载顺序；每个文件属于它所在目录那一层 |
| `exports` | 对外提供的全局名字；加载后自动核对，缺了记到「Mod 与模块」面板和 `GameModules.errors()` |
| `emits` / `uses` | 发出 / 监听的钩子 |

**改功能**：在清单里找到模块 → 只读它的文件和 `uses` / `emits` → 改完跑它的测试和 `test_modules`。**加功能**：按层把文件放进对应目录（逻辑放 `domain`，画面放 `fx` / `model`，配置放 `content`），清单里加一段；功能要能整块拿掉——别人用到它时先判断 `typeof X!=='undefined'` 并保留兜底（没有 `void-maze` 时电梯回到原白色空间；没有 `void-maze-eggs` 时迷宫照常；没有 `chalk-marks` 时粉笔只「看一眼说明」，测试会把它们从清单拿掉验证）。

### 1.3 旧路径对照（2026-11-02 第二轮）

文件名不变，只换目录：`main / world / input / speedrun / death-archive / modules` → `app/`；`core / map` → `content/`；`state / collision / spiral / patrol / portal / elevator / car-chase / talents / day-events / systems / campus-pressure / school-day / inspection / anomaly / dread / items / story / interact / investigation / mono` → `domain/`；`mobile / settings / save` → `adapters/`；`render / quality / lighting / shade` → `engine/`；`hands / cutscene / opening / audio` → `fx/`；`ui / pcgame / phone / lesson / exploration-map / prologue` → `ui/`；`dev / playtest` → `dev/`。第一轮的 `game3d/js/modules/<id>/` 拆进各层：`void-maze/maze-data.js` → `content/void-maze-data.js`，`maze.js` → `domain/void-maze.js`，`maze-model.js` → `model/void-maze.js`，`chalk-marks/marks.js` → `domain/chalk-marks.js`，`marks-fx.js` → `fx/chalk-marks.js`，`mod-manager/mod-manager.js` → `ui/mod-manager.js`。文档里的旧路径已按此表统一改过。

## 2. 钩子

`GameModules.on(name, fn, {owner, priority})` 挂监听；`emit` 全部调用；`first` 依次调用，第一个返回非 `undefined/null/false` 的值作数。某个监听抛错只记录（`GameModules.errors()`）并跳过。跨模块通知只用于「已经发生的事实」；需要立刻拿到判定结果的用 `first` 或明确的函数调用。

| 钩子 | 发出位置 | 方式 | 参数 / 返回 |
| --- | --- | --- | --- |
| `interiors` | `content/map.js` `buildInteriorData` 末尾（只一次） | emit | 模块在这里新增或改写室内场景 |
| `boot` | `app/main.js` `boot()` 末尾 | emit | 界面、渲染都已就绪 |
| `loaded` | `app/modules.js`，全部脚本和 Mod 加载完 | emit | — |
| `reset` | `GameModules.resetAll()`（新局 `freshState` 末尾） | emit | 清本局状态 |
| `sessionStart` / `sessionEnd` | `app/session.js`（`freshState` 开始一局；`Game.quit` 结束） | emit | `id, reason` |
| `sceneChange` | `app/session.js`（`doEnterRoom` / `doExitRoom` 开头） | emit | `sceneId, to` |
| `tick` | `app/main.js` `update()`，每个模拟步（暂停、手册或选择框打开、前情提要、驾驶逃脱、死亡时不发） | emit | `dt` |
| `frame` | `app/main.js` `render()`，每个画面帧（表现层的动画） | emit | `dt` |
| `enterRoom` | `app/main.js` `onEnterRoom` | emit | `id, restoring` |
| `leaveRoom` | `app/world.js` `doEnterRoom` / `doExitRoom` 开头 | emit | `from`（`null` 为室外）, `to` |
| `interact` | `domain/interact.js` `tryInteract`（站起、出柜、名单之后） | first | 返回 `true` 表示已处理 |
| `hint` | `domain/interact.js` `interactHint` | first | 返回提示文字 |
| `itemUse` | `domain/items.js` `useItem` 开头 | first | `id`；返回 `true` 表示已处理 |
| `clockText` | `app/main.js` `updateHUD` | first | 返回要显示的时间文字 |
| `mapBlocked` | `ui/ui.js` 打开地图页、`app/main.js` 小地图 | first | 返回字符串（独白）表示此处地图不能用 |
| `lightState` | `engine/lighting.js` `lightState()` 末尾 | emit | `st`：可改 `amb/hemi/dir/ptK`；`st.steady` 灯不闪；`st.fog` 改雾 |
| `soundscape` | `fx/audio.js` 每帧 | first | 返回要用的整片环境声 ID（见 4.3） |
| `clearWorld` | `engine/scene.js` 换场景前 | emit | 撤掉模块自己加进场景的东西 |
| `sceneBuilt` | `engine/scene.js` 房间 / 室外场景建好后 | emit | `roomId`（室外为 `null`） |
| `devTab` | `dev/dev.js` 切换调试面板页签 | emit | `id` |
| `mazeEvent` | `domain/void-maze-eggs.js`（内部彩蛋） | emit | `{kind, …}`：`invert / invertEnd / shadowShow / shadowHide` |

加钩子的规则：只在「多个模块都可能要插手」的流程点加；在清单对应模块的 `emits` 登记并在本表补一行（`test_modules` 会核对）。热路径（碰撞、每帧移动）用房间接口，不用全局钩子。

## 3. 房间接口

模块在 `interiors` 钩子里用 `mkFloor(id, name, host, floor, grid)` 建房间后，可以挂这些字段：`R.build(R)`（整间房的模型）、`R.collide(x, y, r)`（额外嵌入深度）、`R.solid(x, y)`、`R.moved()`（每一小步后更新高度）、`R.onEnter(spawn)`（防卡位之前定落点和高度，读档时 `spawn.restoreVisit` 为真）、`R.ownHeight`、`R.noMap`、`R.noClock`。灯光写 `ROOM_LIGHTS[id]`。

## 4. 生命周期、输入与声音

### 4.1 会话与场景（`app/session.js`）

- `Session.timeout(fn, ms, 'session'|'scene')`：会话结束、或（`scene`）换场景时自动取消，到点时再核对代号，过期的不执行。
- `Session.guard(fn, scope)`：包一层，过期就不执行。淡入淡出 `fadeTo` 已用它：淡出途中回了主菜单，旧的进房间回调作废，黑幕照常撤掉。
- 新模块一律用这里登记定时器，不直接 `setTimeout`；旧系统的定时器还没全部迁移（计划 A-02）。

### 4.2 键盘分派（`app/input.js` 的 `KEY_ROUTES`）

按下一个键时从上往下找第一个 `match` 的上下文接手，`run` 返回 `false` 表示交给下一层；最近一次接手的上下文记在 `INPUT.route`（调试面板状态页显示）。顺序：调试面板开关 → 放出鼠标 → 焦点在调试面板 → 调试冻结 → 输入框 → **过场（开场 CG、结局）** → 文字前情提要 → 死亡演出跳过 → 不在游玩 → Esc 链 → 按钮上的空格 → 电脑 / 课堂 / 手机小游戏 → 选择框 → 暂停等拦截 → 驾驶 → 手册页签 → 游玩。过场排在前情提要前面就是 A-01 的修复。新增按键上下文时在表里插一项，不要在别处另写 `keydown`。触屏、鼠标点击还在各自的监听里。

### 4.3 声音扩展（`fx/audio.js`）

- `SFX.scape(id, {build, tick, level, bed, quiet})`：登记一整片环境声。`build(A)` 返回 `{gain: GainNode, …}`；`tick(dt, A, nodes)` 放零星声音；`bed` 是原来的校园铺底保留多少（默认 0）；`quiet` 为真时停掉旋律、远处怪声、滴水和上下课铃。用哪一片由 `soundscape` 钩子决定。低 SAN 心跳、巡察者心跳、蛾群等和玩法有关的声音不受影响。
- `SFX.synth()`：`{ctx, master, out, reverb, tone, noise, noiseP, vowel, loopNoise, setG, now}`，给模块做一次性音效。
- `SFX.scapeCut(sec)`：把当前整片环境声掐断几秒（彩蛋的反色用）。
- 随「音乐 / 环境」开关和音量设置。

## 5. 模块状态存档

`GameModules.persistent(id, {save, load, reset})`：`save()` 的结果存在存档的 `d.mods[id]`（Mod 用 `api.store` / `persist` 存的在 `d.mods['mod:'+它的 id]`）；读档先 `reset()` 再 `load(data)`；新局只 `reset()`。不要往 `S`、`RT` 里塞模块自己的字段。

## 6. Mod（结构不变）

### 6.1 三种来源

1. **自带**：`game3d/mods/<id>.js`，在 `game3d/mods/index.js` 登记后，可在暂停菜单「Mod 与模块」或调试面板「Mod」页打开（默认关闭，刷新生效）。
2. **网址**：`?mod=<id>`（多个用逗号）直接加载 `game3d/mods/<id>.js`。
3. **上传**：「Mod 与模块」里选本地 `.js` 文件，源码存进这台设备浏览器的 `localStorage`（键 `wdfz_mods`，单个上限 512 KB），可启用、停用、删除，刷新生效。

网址加 `?nomod` 为**安全模式**：一个 Mod 都不加载。上传的源码在页面里执行，权限与游戏脚本相同——只导入自己信得过的文件。

### 6.2 写法

```js
GameModules.mod({
  id:'my-mod', name:'我的 Mod', version:'1.0.0', author:'你的名字', desc:'一句话说明',
  api:'1.0',              // 依赖的接口大版本
  hooks:{ tick:function(dt){ /* … */ } },
  persist:{ save:function(){ return {}; }, load:function(d){}, reset:function(){} },
  init:function(api){ /* 启动时调用一次 */ }
});
```

`init(api)` 的稳定接口：`api.version / id`、`api.on / off`（挂钩子，自动记成这个 Mod 的）、`api.say / toast`、`api.state()`（返回 `S`）、`api.addItem(id, {name, desc, glyph, color, use})`、`api.giveItem(id)`、`api.addRoom(id, {...})`（`boot` 之后）、`api.enterRoom(id, spawn)`、`api.store({save, load, reset})`、`api.modules()`。声音可以直接用 `SFX.synth()` / `SFX.scape()`，定时器用 `Session.timeout()`。示例见 `game3d/mods/example-hello.js`。

### 6.3 出错与兼容

`init` 抛错 → 这个 Mod 标记为「出错，已停用」，它挂的钩子全部摘掉；钩子运行时抛错只跳过并记录；接口大版本不同不启用；`api` 以外直接改全局变量的 Mod，不保证在游戏更新后继续可用。Mod 不得修改或绕开玩家 Wiki 的彩蛋保密规则；仓库自带的 Mod 不得包含隐藏结局、隐藏时刻或隐藏异常的内容。

## 7. 测试与文档约定

- 新文件：放进正确的层目录 → 清单登记 → `node --check` → 写 `tests/test_<模块>.py` → 跑 `tests/test_modules.py`（清单、导出、钩子、分层越界）。
- 只改某个模块时，先跑它自己的测试和 `test_modules`，再按需要跑全量；改了建模或玩法才跑穿模检查。
- 新增或改名钩子、房间接口、Mod 接口：同步本文；接口有不兼容变化时把 `GameModules.API_VERSION` 的大版本加一。
- 代码结构变了：`python tools/module_audit.py` 重新生成[模块依赖盘点](模块依赖盘点.md)。
