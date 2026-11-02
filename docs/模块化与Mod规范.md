# 模块化与 Mod 规范

> 2026-11-02 按用户手稿要求建立：把项目整理成模块化形式，以后更新时只改相关模块、不用遍历全部代码；新功能可以通过直接放入 / 上传文件插入，并提供 Mod 入口供测试和自制内容使用。本文是开发约定，也是写 Mod 的说明。实施计划与验收见 [虚空迷宫、粉笔记号与模块化](plan/虚空迷宫、粉笔记号与模块化.md)。
>
> 更深一层的解耦——会话生命周期、输入归属、数值写入入口、规则与表现分离、存档分阶段恢复——已按计划[项目解耦与模块化](plan/项目解耦与模块化.md)在 `main` 实施，接口见[模块边界与迁移](模块边界与迁移.md)（`Lifecycle`、`GamePolicy`、`PlayerStats`、`tools/check_modules.py`）。本文的清单、钩子、房间接口和 Mod 与之配合使用：重叠的地方一律以那份接口为准（2026-11-02 同步 main 时，PR #26 第二轮自建的会话作用域、按键路由表和九层目录搬家已撤掉）。

## 1. 总体结构

```text
index.html                      页面结构；只加载 modules.js、manifest.js，然后 GameModules.boot()
game3d/js/modules.js            模块注册表、钩子、模块状态存档、Mod 接口与加载器（最先加载，不依赖游戏脚本）
game3d/manifest.js              模块清单：全部脚本的唯一登记处，顺序 = 加载顺序
game3d/js/*.js、model/、engine/、fx/   原有代码，按清单分组成模块（文件位置不变）
game3d/js/app/、domain/、adapters/     main 模块化新增：会话与生命周期、输入策略；纯规则（数值、时间、背包、存档数据）；存储
game3d/js/modules/<id>/         新功能模块（每个功能一个目录）
game3d/mods/                    随游戏发布、默认关闭的 Mod；index.js 是登记表
```

加载过程：`index.html` → `modules.js`（定义 `GameModules`）→ `manifest.js`（逐个 `GameModules.define`）→ `GameModules.boot()` 按清单顺序用 `document.write` 写入全部 `<script>`（同步、保序，`file://` 双击打开也能用）→ 核对每个模块声明的导出 → 加载 Mod → `DOMContentLoaded` 时 `main.js` 的 `boot()` 启动游戏，末尾发 `boot` 钩子。

### 1.1 模块清单

`game3d/manifest.js` 每个模块一段：

| 字段 | 含义 |
| --- | --- |
| `id` | 模块 ID（小写、连字符），全局唯一 |
| `name` / `desc` | 中文名与职责：负责什么、和谁交互 |
| `files` | 这个模块的全部脚本，按加载顺序 |
| `exports` | 对外提供、别的模块会直接用的全局名字；加载后自动核对，缺了会记到「Mod 与模块」面板和 `GameModules.errors()` |
| `emits` | 这个模块在代码里发出的钩子（`GameModules.emit/first`） |
| `uses` | 这个模块监听的钩子 |

当前 44 个模块：原有代码分成的模块，main 模块化新增的「生命周期与输入策略」「纯规则」「会话」，功能模块「粉笔记号」「虚空迷宫」「虚空迷宫彩蛋（内部）」「Mod 管理」「声音试听」「隐藏天赋（内部）」，以及最后加载的主循环。具体职责以清单为准。`tools/check_modules.py` 从清单展开实际加载顺序，检查每个脚本都被加载、启动依赖的先后、纯规则模块不碰浏览器和全局状态、四项核心数值只经 `PlayerStats` 写。

**改功能的做法**：先在清单里找到模块 → 只读它登记的文件和它 `uses` / `emits` 的钩子 → 改完跑这个模块对应的测试（见第 6 节）。跨模块改动先看对方的 `exports` 是否需要变；导出名字改了，同时改清单。

### 1.2 旧代码与新代码

- 原有文件**位置不变**（测试、工具、录像脚本都按路径引用），按职责归入清单里的模块；加载顺序与改造前逐个相同（`tests/test_modules.py` 核对）。
- 新功能一律做成 `game3d/js/modules/<id>/` 下的独立模块，通过钩子、房间接口和清单接入，尽量不改旧文件。本轮的「粉笔记号」「虚空迷宫」「Mod 管理」就是这样加进来的，旧文件只加了钩子调用点。
- 功能模块要能**整块拿掉**：别的代码用到它时先判断 `typeof X!=='undefined'`，并保留原来的行为作兜底（例如没有 `void-maze` 时电梯回到原来的白色空间，没有 `chalk-marks` 时粉笔只「看一眼说明」）。`tests/test_modules.py` 会把这三个功能模块从清单里拿掉再启动游戏验证。
- 渲染对象（`THREE.*`、`GLR.*`）只出现在引擎、建模、特效类文件里；玩法逻辑文件不直接建渲染对象（`test_engine` 已有检查）。新模块同样拆成「逻辑」和「画面」两个文件，例如 `chalk-marks/marks.js` 与 `marks-fx.js`。
- 全局名字：一个模块尽量只导出一个命名空间对象（`VoidMaze`、`ChalkMarks`）加少量配置表（`MAZE_CFG`）；配置数值集中在配置表里，便于调参和测试。
- 和 main 的接口配合：SAN、违规、同化、体力只经 `PlayerStats` 写（例如虚空迷宫的流失与坠落用 `PlayerStats.changeSan`，被挡下的死亡回到 1，与 `settleSan()` 相同）；延时回调用 `Lifecycle.scope(名字).timeout / guard`，不要裸用 `setTimeout`；新局和回菜单时要收掉的东西听 `reset` / `boundary` 钩子（`app/session.js` 用 `Lifecycle.register('game-modules', …)` 发 `boundary`）；判断现在能不能操作、谁在接收按键，看 `GamePolicy`。

## 2. 钩子

`GameModules.on(name, fn, {owner, priority})` 挂监听；`emit` 全部调用；`first` 依次调用，第一个返回非 `undefined/null/false` 的值作数。某个监听抛错只记录（`GameModules.errors()`）并跳过，不影响其他监听和游戏。

| 钩子 | 发出位置 | 方式 | 参数 / 返回 |
| --- | --- | --- | --- |
| `interiors` | `map.js` `buildInteriorData` 末尾（只一次） | emit | 模块在这里新增或改写室内场景（`mkFloor`） |
| `boot` | `main.js` `boot()` 末尾 | emit | 界面、渲染都已就绪 |
| `loaded` | `modules.js`，全部脚本和 Mod 加载完 | emit | — |
| `reset` | `GameModules.resetAll()`（新局 `freshState` 末尾） | emit | 清本局状态 |
| `tick` | `main.js` `update()`，每个模拟步（暂停、手册或选择框打开、前情提要、驾驶逃脱、死亡时不发） | emit | `dt`（秒） |
| `enterRoom` | `main.js` `onEnterRoom` | emit | `id, restoring` |
| `leaveRoom` | `world.js` `doEnterRoom` / `doExitRoom` 开头 | emit | `from`（房间 ID 或 `null` 表示室外）, `to` |
| `interact` | `interact.js` `tryInteract`（站起、出柜、名单之后，默认交互之前） | first | 返回 `true` 表示已处理 |
| `hint` | `interact.js` `interactHint` | first | 返回提示文字 |
| `itemUse` | `items.js` `useItem` 开头 | first | `id`；返回 `true` 表示已处理 |
| `clockText` | `main.js` `updateHUD` | first | 返回要显示的时间文字 |
| `mapBlocked` | `ui.js` 打开地图页、`main.js` 小地图 | first | 返回字符串（独白）表示此处地图不能用 |
| `lightState` | `lighting.js` `lightState()` 末尾 | emit | `st`：可改 `amb/hemi/dir/ptK`；`st.steady=true` 灯不闪；`st.fog={r,g,b,density}` 改雾 |
| `clearWorld` | `engine/scene.js` 换场景前 | emit | 撤掉模块自己加进场景的东西 |
| `sceneBuilt` | `engine/scene.js` 房间 / 室外场景建好后 | emit | `roomId`（室外为 `null`） |
| `devTab` | `dev.js` 切换调试面板页签 | emit | `id`；模块加的页签（`DEV_TABS.push`）在这里画内容 |
| `boundary` | `app/session.js`：`Lifecycle.boundary` 时（新局 `new-session`、回菜单 `menu`） | emit | `reason`；收掉上一局的画面效果、计时 |
| `newGame` | `app/session.js` `Game.start`，`freshState` 之后（只在新开局，读档不发） | emit | `{diff, mode}`（`mode` 为 `normal` / `speedrun`）；开局才给的东西（例如内部彩蛋天赋的手电） |
| `frame` | `main.js` `render()`，每个画面帧 | emit | `dt`；表现层自己的动画（彩蛋的反色、黑影淡入淡出） |
| `soundscape` | `audio.js` 每帧 | first | 返回要用的整片环境声 ID（见第 4.1 节） |
| `stepSurface` | `audio.js` 每次脚步（自己、巡察者） | first | 返回脚下材质名，声音库里要有 `step.<名>`（例如异空间的 `void`）；没有就按原来的规则判断 |
| `mazeEvent` | `modules/void-maze-eggs/eggs.js`（内部彩蛋） | emit | `{kind, …}`：`invert / invertEnd / shadowShow / shadowHide` |

**加钩子的规则**：只在「多个模块都可能要插手」的流程点加；名字用小驼峰动词或名词；在清单里对应模块的 `emits` 登记；在本表补一行；`tests/test_modules.py` 会检查清单里的 `emits` 确实在该模块文件里发出、`uses` 的钩子确实有人发。热路径（碰撞、每帧移动）不用全局钩子，用下面的房间接口。

## 3. 房间接口

模块通过 `interiors` 钩子 `mkFloor(id, name, host, floor, grid)` 建房间后，可以给房间对象挂这些字段（只对这个房间生效，不进入别的房间的热路径）：

| 字段 | 调用处 | 作用 |
| --- | --- | --- |
| `R.build(R)` | `model/room.js` `buildRoomGeometry` | 返回整间房的 `THREE.Group`，不按网格建墙地 |
| `R.collide(x, y, r)` | `collision.js` | 额外嵌入深度（世界单位），与网格碰撞相加 |
| `R.solid(x, y)` | `world.js` `solidAtInterior` | 这一点是否实心（防卡位、粉笔找墙会用） |
| `R.moved()` | `world.js` `moveBy` 每一小步之后 | 更新高度（台阶、坠落） |
| `R.onEnter(spawn)` | `world.js` `doEnterRoom`，防卡位之前 | 定落点和高度；读档时 `spawn.restoreVisit` 为真 |
| `R.ownHeight` | `spiral.js` | 房间自己管 `S.floorY`，离开钟楼逻辑不清零 |
| `R.noMap` | `exploration-map.js` | 不画楼层草图 |
| `R.noClock` | `main.js` | 游戏钟不走，课表一栏显示 `???` |

灯光：往 `ROOM_LIGHTS[id]` 写 `[x, y, z, 颜色, 强度系数, 距离]`（场景米，房间中心为原点）。

## 4. 模块状态存档

`GameModules.persistent(id, {save, load, reset})`：`save()` 返回可 JSON 化的对象，存在存档的 `d.mods[id]`（Mod 用 `api.store` / `persist` 存的在 `d.mods['mod:'+它的 id]`，和模块分开）；读档时先 `reset()` 再 `load(data)`；新局只 `reset()`。不要往 `S`、`RT` 里塞模块自己的字段（除非确实是全局剧情状态），这样存档字段表 `SAVE_SCHEMA` 不用改，旧存档也不受影响。

临时停用模块或用 `?nomod` 排障后继续本局，未加载模块的数据仍原样保留，重新启用后可以恢复；开始新局时全部清空。存取均传递 JSON 副本，回调抛错时保留最后一份可序列化的数据。已注册的 `save()` 明确返回 `undefined` 才删除该项；返回 `null` 则保存 `null`。

### 4.1 声音（`sound-bank.js`、`fx/sound-player.js`、`audio.js`）

2026-11-02 全部音效重做后，一次性音效分三层：

- **声音库** `game3d/js/sound-bank.js`（只有数据）：`SOUND_CATS` 是 11 个类别和各自的响度目标（dBFS），`SOUND_BANK` 是全部配方，名字形如 `类别.名字`（`ui.click`、`step.tile`、`event.bellStart`、`death.drown`……）。配方由若干层组成：`tone`（振荡器，可滑音、颤音）、`noise`（滤波噪声，可扫频）、`bell`（钟的泛音组）、`vowel`（像人声的共振峰，`voice` 浊音、`breath` 气声）、`fm`（金属声）；每层可以重复（`n / every / accel / decay / fstep`）、振幅调制（`am`）、单独加混响或声像；整段也能重复（`rep`）。数值可以写 `[最小, 最大]`，每次播放重新取，所以同一声不会两次一样。字段说明见 `fx/sound-player.js` 开头。
- **响度校准** `game3d/js/sound-levels.js`：由 `python tools/sound_levels.py` 生成，不要手改。它在无头 Chromium 里离线渲染每个配方，量 K 加权的 100 毫秒最大响度，按「类别目标 + 配方的 `lv`」算出校准值，同时写出给人看的[音效响度表](音效响度表.md)。改了配方要重跑，`tests/test_sound_bank.py` 会核对表是不是最新的、校准后峰值不超过 −1 dBFS。
- **播放器** `SoundPlayer`（`fx/sound-player.js`）：`play(id, {k, pan, lp, pitch, at, len, wet})` 返回句柄；`stop(类别)` 淡出正在响的声音（`SFX.stopDeath()` 就是 `stop('death')`）；`length / measure / validate / ids / def / level`；Mod 用 `SoundPlayer.add(id, 配方)` 加自己的音效（同名覆盖内置）。响度倍率（`k`、随机浮动、校准）放在每个音效出口的增益上，不进包络——包络从 0.0001 起落，峰值一变曲线形状就变，校准会不准；写在单层上的混响（某一层的 `wet`）汇到这个音效自己的 `fx` 再发到混响，`fx` 的增益与出口相同，`stop()` / `fade(句柄, 时刻)` 两路一起淡出。延迟（`at`）由音频时钟排程，不开定时器。
- **接口** `SFX`（`audio.js`）：游戏里原有的调用名一个没改（`SFX.click / door / step / dread / deathFx / anomaly …`），只是改成按声音库播放；新增 `SFX.chalk`（粉笔画记号）、`SFX.deep`（掉进异空间的虚空）、`SFX.stopDeath`——以前代码里调了这三个却不存在，被 `try` 吞掉没有声音。`SFX.schoolBell(v, kind)`：`kind` 为 `'start'` 是上课铃，否则是下课铃。持续的环境层（铺底、风、雨、灯管嗡声、车库低频）还在 `audio.js` 里。
- 混音：每个类别一条总线（干声、混响各一条，增益是 `SOUND_CATS[类].gain`，默认 1）→ 主音量 → 压缩器；「真实」档的空间混响照旧。
- 调试面板「工具」页的「声音试听」（模块 `sound-board`）可以按类别挑音效试听、整类连放。

环境声扩展：

- `SFX.scape(id, {build, tick, level, bed, quiet})`：登记一整片环境声。`build(A)` 返回 `{gain: GainNode, …}`；`tick(dt, A, nodes)` 放零星声音；`bed` 是原来的校园铺底保留多少（默认 0）；`quiet` 为真时停掉旋律、远处怪声、滴水和上下课铃。用哪一片由 `soundscape` 钩子决定（虚空迷宫的「宇宙空寂」就是这样接入的）。低 SAN 心跳、巡察者心跳、蛾群等和玩法有关的声音不受影响。
- `SFX.synth()`：`{ctx, master, out, reverb, tone, noise, noiseP, vowel, loopNoise, setG, now, bus, send, pan, noiseBuf}`，给模块搭持续的环境声；一次性音效请写成配方用 `SoundPlayer`。`SFX.scapeCut(sec)` 把当前整片环境声掐断几秒。随「音乐 / 环境」开关和音量设置。

## 5. Mod

### 5.1 三种来源

1. **自带**：`game3d/mods/<id>.js`，在 `game3d/mods/index.js` 登记一行后，玩家可在暂停菜单「Mod 与模块」或调试面板「Mod」页打开（默认关闭，开关存在浏览器里，刷新生效）。
2. **网址**：`?mod=<id>`（多个用逗号）直接加载 `game3d/mods/<id>.js`，不用登记，适合测试。
3. **上传**：在「Mod 与模块」里选择本地 `.js` 文件，源码存进这台设备浏览器的 `localStorage`（键 `wdfz_mods`，单个上限 512 KB），可启用、停用、删除，刷新生效。不会上传到任何服务器。

网址加 `?nomod` 为**安全模式**：一个 Mod 都不加载（模块照常），用于 Mod 把游戏弄坏时恢复。Mod 只能是本地或本仓库的文件；上传的源码在页面里执行，权限与游戏脚本相同——只导入自己信得过的文件。

### 5.2 写法

文件里调用一次 `GameModules.mod({...})`：

```js
GameModules.mod({
  id:'my-mod',            // 必填：字母、数字、-、_，最多 48 位，全局唯一
  name:'我的 Mod', version:'1.0.0', author:'你的名字', desc:'一句话说明',
  api:'1.0',              // 依赖的接口大版本；与 GameModules.API_VERSION 大版本不同则不启用
  priority:0,             // 可选：hooks 里监听的优先级
  hooks:{ tick:function(dt){ /* … */ } },          // 可选：直接挂钩子
  persist:{ save:function(){ return {}; }, load:function(d){}, reset:function(){} },   // 可选：存档
  init:function(api){ /* 启动时调用一次 */ }
});
```

`init(api)` 拿到的稳定接口：

| 接口 | 说明 |
| --- | --- |
| `api.version` / `api.id` | 接口版本、自己的 ID |
| `api.on(name, fn, opt)` / `api.off(name, fn)` | 挂 / 摘钩子（自动记成这个 Mod 的） |
| `api.say(text, sec)` / `api.toast(text)` | 字幕 / 轻提示 |
| `api.state()` | 返回 `S`（直接读写，自担兼容风险） |
| `api.addItem(id, {name, desc, glyph, color, use})` | 新物品定义；`use` 是「用」的函数 |
| `api.giveItem(id)` | 放进背包（满了会提示） |
| `api.addRoom(id, {name, host, floor, grid, build, collide, solid, moved, onEnter, noMap, noClock})` | 新室内场景（需在 `boot` 之后调用） |
| `api.enterRoom(id, spawn)` | 带淡入淡出进入房间 |
| `api.store({save, load, reset})` | 存档里存这个 Mod 自己的状态 |
| `api.modules()` | 模块清单与核对状态 |

声音不在 `api` 里，直接用全局接口：一次性音效 `SoundPlayer.add(id, 配方)` 加、`SoundPlayer.play(id, opt)` 放（配方格式见第 4.1 节，名字建议用 `mod.<你的 id>.<名字>`）；整片环境声用 `SFX.scape()`。

示例见 `game3d/mods/example-hello.js`（进门提示、存档、加物品）。

### 5.3 出错与兼容

- Mod 的 `init` 抛错：这个 Mod 标记为「出错，已停用」，它挂的钩子和通过 `persist` / `api.store` 注册的存档回调全部摘掉，旧数据保留，游戏继续。
- 钩子运行时抛错：只跳过这一次并记录，其他监听照常。
- 接口大版本不同：不启用，记录原因。
- `api` 以外直接改全局变量的 Mod，不保证在游戏更新后继续可用。
- Mod 不得修改或绕开玩家 Wiki 的彩蛋保密规则；仓库自带的 Mod 不得包含隐藏结局、隐藏时刻或隐藏异常的内容。

## 6. 测试与文档约定

- 新模块：在清单登记 → `node --check` → 写 `tests/test_<模块>.py`（逻辑 + 浏览器回归）→ 跑 `tests/test_modules.py` 确认清单、导出、钩子一致 → 跑 `python tools/check_modules.py`（加载、启动顺序、纯规则边界、数值写入归属）。
- 改了声音库的配方：`python tools/sound_levels.py` 重新生成响度校准和[音效响度表](音效响度表.md)。
- 只改某个模块时，先跑它自己的测试和 `test_modules`，再按需要跑全量；改了建模或玩法才跑穿模检查（`python tools/clip_audit.py`）。
- 新增或改名钩子、房间接口、Mod 接口：同步本文第 2–5 节；Mod 接口有不兼容变化时把 `GameModules.API_VERSION` 的大版本加一。
- 文件结构说明见 [3D更新说明](3D更新说明.md) 开头；测试命令见 [测试说明](测试说明.md)。
