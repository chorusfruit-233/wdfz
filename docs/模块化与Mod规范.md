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

当前 57 个功能模块（2026-11-03 完成文件级依赖收口时为 46 个，之后成就与积分评级新增 3 个；2026-11-05 校园怪谈创意提案新增「上一局的你」「校园怪谈」「手机相机」等）：原有代码分成的模块，main 模块化新增的「生命周期与输入策略」「纯规则」「会话」，功能模块「粉笔记号」「虚空迷宫」「虚空迷宫彩蛋（内部）」「Mod 管理」「声音试听」「隐藏天赋（内部）」，新增的常驻巡察世界与手机网络／服务器路线，游戏事实 `facts`、成就 `achievements`、积分评级与通关记录 `run-record`，以及最后加载的主循环。已新增 `stairwell`（真实楼梯）、`sensory`（只读感官、声音字幕及环境片段）、`lift-crowd`、`atmosphere`、`broadcast` 和 `last-life`；具体职责以清单为准。`tools/check_modules.py` 从清单展开实际加载顺序，检查每个脚本都被加载、启动依赖的先后、纯规则模块不碰浏览器和全局状态、四项核心数值只经 `PlayerStats` 写。

**改功能的做法**：先在清单里找到模块 → 只读它登记的文件和它 `uses` / `emits` 的钩子 → 改完跑这个模块对应的测试（见第 6 节）。跨模块改动先看对方的 `exports` 是否需要变；导出名字改了，同时改清单。

### 1.2 旧代码与新代码

- 文件按职责登记；2026-11-03 进一步把共享空间配方移到 `content/`，把主循环接线和 HUD 分开。旧 HTML、Mod、测试与录像所用的全局入口是兼容外观，实现和依赖位于文件闭包内。具体文件以清单及 `game3d/module-contracts.js` 为准。
- 新功能一律做成 `game3d/js/modules/<id>/` 下的独立模块，通过钩子、房间接口和清单接入，尽量不改旧文件。本轮的「粉笔记号」「虚空迷宫」「Mod 管理」就是这样加进来的，旧文件只加了钩子调用点。
- 功能模块要能**整块拿掉**：别的代码用到它时先判断 `typeof X!=='undefined'`，并保留原来的行为作兜底（例如没有 `void-maze` 时电梯回到原来的白色空间，没有 `chalk-marks` 时粉笔只「看一眼说明」；模块自己的死亡演出通过 `DeathCG.register` 接入，拿掉模块就没有这两段演出）。`tests/test_modules.py` 会把这三个功能模块从清单里拿掉再启动游戏验证。
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
| `tick` | `app/simulation.js`（`main.js` 的 `update()` 委托），每个模拟步（暂停、手册或选择框打开、前情提要、驾驶逃脱、死亡时不发） | emit | `dt`（秒） |
| `enterRoom` | `app/world-events.js` `onEnterRoom` | emit | `id, restoring` |
| `leaveRoom` | `world.js` `doEnterRoom` / `doExitRoom` 开头 | emit | `from`（房间 ID 或 `null` 表示室外）, `to` |
| `interact` | `interact.js` `tryInteract`（站起、出柜、名单之后，默认交互之前） | first | 返回 `true` 表示已处理 |
| `hint` | `interact.js` `interactHint` | first | 返回提示文字 |
| `itemUse` | `items.js` `useItem` 开头 | first | `id`；返回 `true` 表示已处理 |
| `clockText` | `ui/hud.js` `updateHUD` | first | 返回要显示的时间文字 |
| `periodText` | `ui/hud.js` `updateHUD`，学生会检查的说明之前（2026-11-05，体检日） | first | 返回要显示的时段说明（请假中不改写；检查、集合的说明仍然优先） |
| `phoneApp` | `phone.js` `PHONE.selectApp`（纸飞机以外的页） | emit | `app, tool`：往手机工具区加按钮（相机） |
| `phoneCopy` | `phone.js` `PHONE.paintApps` | first | `app`；返回这一页的说明文字 |
| `restAct` | `interact.js` `doSanAct`，冷却检查之后、推进时间之前（2026-11-05） | first | `key`（休息种类）；返回 `true` 表示这一次由模块处理（睡不着、做梦），不再照常结算 |
| `mapBlocked` | `ui.js` 打开地图页、`ui/hud.js` 小地图 | first | 返回字符串（独白）表示此处地图不能用 |
| `classmateScene` | `fx/classroom.js` 更新同学前 | first | `figure, dt`；返回 true 接管这名同学当帧表现，不能改玩家状态 |
| `patrolZoneActive` | `patrol-world/world.js` 判断条件报警区 | first | `zone`；带 `when` 的区域仅返回 true 时启用 |
| `patrolCamouflage` | `patrol-world/world.js` 感知和追踪前 | first | 返回 true 代表当前玩家由合法场景规则掩护（放学人群）；不改变巡察实体位置 |
| `lightState` | `lighting.js` `lightState()` 末尾 | emit | `st`：可改 `amb/hemi/dir/ptK`；`st.steady=true` 灯不闪；`st.fog={r,g,b,density}` 改雾 |
| `clearWorld` | `engine/scene.js` 换场景前 | emit | 撤掉模块自己加进场景的东西 |
| `sceneBuilt` | `engine/scene.js` 房间 / 室外场景建好后 | emit | `roomId`（室外为 `null`） |
| `devTab` | `dev.js` 切换调试面板页签 | emit | `id`；模块加的页签（`DEV_TABS.push`）在这里画内容 |
| `boundary` | `app/session.js`：`Lifecycle.boundary` 时（新局 `new-session`、回菜单 `menu`） | emit | `reason`；收掉上一局的画面效果、计时 |
| `newGame` | `app/session.js` `Game.start`，`freshState` 之后（只在新开局，读档不发） | emit | `{diff, mode}`（`mode` 为 `normal` / `speedrun`）；开局才给的东西（例如内部彩蛋天赋的手电） |
| `frame` | `app/presentation-loop.js` `render()`，每个画面帧 | emit | `dt`；表现层自己的动画（彩蛋的反色、黑影淡入淡出） |
| `soundscape` | `audio.js` 每帧 | first | 返回要用的整片环境声 ID（见第 4.1 节） |
| `stepSurface` | `audio.js` 每次脚步（自己、巡察者） | first | 返回脚下材质名，声音库里要有 `step.<名>`（例如异空间的 `void`）；没有就按原来的规则判断 |
| `bellTune` | `audio.js` `schoolBell`（每一遍上下课铃，2026-11-04） | first | `kind`（`start` / `end`）；返回 `{pitch, caption}` 让这一遍走调（氛围 A5），不返回就照常 |
| `liftBoard` | `elevator.js` `Elevator.enterCabin`，跨进轿厢、乘梯记录建好以后、存档之前（2026-11-04） | emit | `ride, host, floor`：别的模块在这一刻定自己的稀有事件（和错误的电梯互斥，写在 `ride` 上一起存档） |
| `liftDepart` | `elevator.js` `Elevator.depart` 开头：门关上、要出发之前（关门后自动出发和门本来就关着时按楼层都走这里） | first | `ride, host`；返回 `true` 表示先不出发（模块接管这一次关门） |
| `liftControls` | `elevator.js` `Elevator.controls` 开头、`Elevator.closeDoor`（独立关门键）开头 | first | `ride`；返回 `true` 表示操纵盘已处理（不弹楼层选项） |
| `mazeEvent` | `modules/void-maze-eggs/eggs.js`（内部彩蛋） | emit | `{kind, …}`：`invert / invertEnd / shadowShow / shadowHide` |
| `gameFact` | `app/facts.js` 的 `gameFact(kind, data)`；各系统在事实成立的那一刻调一次（2026-11-03） | emit | `{kind, …}`：`opening`、`day`、`anomaly`（`phase` 为 `start / hurt / end`）、`patrol`（`what` 为 `locked / lost / locker / banish / permanent`）、`inspection`、`register`、`exam`、`lesson`、`rest`、`snake`、`fakeNormal`、`garage`、`face`、`protect`、`wake`、`death`、`ending`（带 `legit`）、`speedrun`、`chalk`、`specialDay`、`maze`，以及调试面板打开时的 `debug`。只读：成就、本局积分、回放都只听它，不改玩法；可信与否（调试局、回放）由监听方判断 |
| `endingCard` | `story.js` 的 `showEndingCard`，结局卡加进页面以后（2026-11-03） | emit | `{el, id}`：往结局卡上加内容（成就的「本局新达成」、通关记录的「结算」按钮），插在「回到主菜单」之前 |
| `deathScreen` | `story.js` 的 `kill()`，死亡界面显示出来时（预知梦惊醒不发，2026-11-03） | emit | `{el, source}`：往死亡界面加一行（本局新达成、本局积分与探索度） |

| `tracesChanged` | `app/traces.js` 痕迹记录完成 | emit | 通知表现重建痕迹；记录本身不需要场景 |
| `dayAppearance` | `day-events.js` 日状态更新完成 | emit | 校庆装饰刷新；每帧也可重建，不修改日状态 |

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
- 所有一次性音效（包括音频时钟上尚未开始的声音）随 `boundary` 停止，不带入下一局。试听使用 `Lifecycle` 的 `sound-preview` 作用域管理句柄和完成计时器；停止或重开试听只淡出这次试听的声音，游戏声音继续，旧完成回调不能重置新试听。

环境声扩展：

- `SFX.scape(id, {build, tick, level, bed, quiet})`：登记一整片环境声。`build(A)` 返回 `{gain: GainNode, …}`；`tick(dt, A, nodes)` 放零星声音；`bed` 是原来的校园铺底保留多少（默认 0）；`quiet` 为真时停掉旋律、远处怪声、滴水和上下课铃。用哪一片由 `soundscape` 钩子决定（虚空迷宫的「宇宙空寂」就是这样接入的）。低 SAN 心跳、巡察者心跳、蛾群等和玩法有关的声音不受影响。
- `SFX.synth()`：`{ctx, master, out, reverb, tone, noise, noiseP, vowel, loopNoise, setG, now, bus, send, pan, noiseBuf}`，给模块搭持续的环境声；一次性音效请写成配方用 `SoundPlayer`。`SFX.scapeCut(sec)` 把当前整片环境声掐断几秒。随「音乐 / 环境」开关和音量设置。

### 4.2 死亡演出（`fx/death-cg.js`、`fx/death-timeline.js`）

2026-11-02 起模块可以加自己的死亡演出（虚空迷宫的「迷失」「坠落」就是这样接入的，见 `modules/void-maze/maze-death.js`）：

- `DeathCG.register(类型, {build(c), update(c, k, view)})`：登记一种演出，同名覆盖内置。`build` 搭模型，`update` 按经过的秒数 `k` 摆模型和镜头——所有位置只由 `k` 算，帧率高低结果一样。`c` 是演出上下文：`add / mesh / box / fig / fx / merged / inst`（建在「视线坐标系」里：原点在脚下，+z 是死的那一刻的视线方向，本地 +x 在画面左边）、`veil`（收束用的黑幕）、`cam(view, k, 偏航, 俯仰, 下沉)`（镜头；偏航为正往右转）、`shade`、`flash`（只闪一次，亮度封顶 0.5）、`cue`（声音到点只响一次）、`face`、`hideWorld()`（藏起当前房间或室外，场景里标了 `userData.worldPart` 的东西——例如粉笔记号——一起藏，清场时还原）。往 `c` 上挂自己的东西时别用它已有的字段名（`type F preview rand base shk flashed cued lift veilMesh`）。常用小工具在 `DeathCG.kit`：`seg / sm / ss / lerp3 / rng / mat / setI`。
- `DeathTimeline.define(类型, 秒)`：登记时长（四段式至少 3 秒；死亡界面在演出放完后出现）。
- 配套：死亡音写成声音库里的 `death.<类型>`（`SFX.deathFx` 会先放 `death.base`）；墓志铭 `DFX_EPI[类型]`、死因与复盘提示 `DEATH_SOURCES[来源] = {cause, hint}` 由模块的逻辑文件填；调试面板的预览列表 `DEV_DEATH.push([名字, 类型])`；死亡档案的条目登记在 `death-archive.js`（档案启动时就要认得全部 ID，所以写在那里；属于内部内容的标 `secret:1`，没死过不出现、不算总数；演出由模块注册的再标 `ext:1`，模块拿掉时这份档案不列出、「全部解锁」也不打开）。
- 性能与可读性约束由 `tests/test_death_timeline.py` 统一检查：每种演出在场景之外最多再加 30 次绘制、只用开局预热过的材质组合（不在死的那一刻现编着色器）、帧率无关、四个阶段画面不同、闪光不超过 0.5、关掉「镜头晃动」时不晃。

### 4.3 结局演出（`cutscene.js` 的 `CUT_DEF`）

模块可以往 `CUT_DEF` 加自己的结局演出（`modules/cyber-route/ending.js` 的《网安仙人》）：`{dur, setup(d), frame(k, d), clean(d)}`，`k` 是 0–1 的进度，一切位置只由 `k` 算；跳过和播完走同一个只执行一次的收尾。要在舞台上演就调 `Engine.beginOutsideStage()`（收尾自动 `endStage`）；临时对象用 `cutAdd` 挂进 `CUT.grp`，收尾统一释放（画布贴图在材质上标 `userData.disposeMap`）。需要别的天色时设 `VisualState.stageHour`（只影响天色、光照和环境声，`clean` 里置回 `null`）；室内布景的明暗用 `lightState` 钩子按 `CUT.id` 改，不要加实时点光源。几处布景开头一起 `GLR.renderer.compile(CUT.grp, GLR.cam, GLR.scene)`，中途切镜不现编着色器。

结局演出要在 CG 档案馆（原死亡档案室）「结局与开场」里能重看（2026-11-03），在 `death-archive.js` 的 `ARCHIVE_CUTS` 登记一条：`{id:'end:<结局ID>', cut:'<CUT_DEF 键>', end:'<结局ID>', n:标题, d:一句记录, stage:回放前先进的场景, at:可选的站位{c,r,ang}}`，隐藏结局加 `secret:1`。解锁看「已见结局」；回放用同一份 `CUT_DEF`、完成回调只回档案室，所以 `setup / frame / clean` 不能假定之后一定会出结局卡或改存档。`CUT_DEF` 里没有这个键（模块拿掉了）时，这条档案自动不列出。

CG 档案馆还可以由模块加整节（2026-11-03）：`DeathArchive.addSection({id, title, ids(), isOpen(id, d), count(d), cards(d), replay(id)})`。条目 ID 用 `x.` 开头，「全部解锁」同样只写 `granted`；模块拿掉时这一节不出现。现有用法是 `run-record` 的「结算画面」（F–SSS 九张，取得过该评级才点亮，重看打开结算页）。

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


## 常驻巡察与网络域接口（2026-11-02）

`PatrolNav` 读取生成的逻辑碰撞与显式连接；`PatrolWorld` 是唯一巡察状态拥有者。渲染缓存、换房间与质量切换不得调用世界 reset。旧 `patReset` 仅用于新会话／显式调试重置，`patEnd` 只解除普通追击。判定附近危险用 `localChase()`／`pressure()`，不要把实体存在或远距 `permanent` 当成本地危险。

`Mechanics.begin(dt)` 与 `finish(dt)` 包围每个被接受的模拟步（包含车辆、电梯提前返回），统一运行秒、能源及服务端仲裁。新增 UI 通过 `GamePolicy` 声明输入所有权；`TerminalUI` 不占 `PC.on`，文本事件不传给游戏按键。真实文档隐藏与软键盘焦点分别处理。

纯规则文件：`domain/phone-energy.js`、`domain/campus-terminal.js`、`domain/route-graph.js`。终端不应引入宿主 shell、网络连接或脚本执行。持久域为 `mechanics`、`patrolWorld`、`attendanceDuty`、`phoneDevice`、`terminalPuzzle`、`termination`；`RT.hacked` 与 `RT.data` 仍是原白名单唯一真值。

碰撞重建工具 `python tools/patrol_geometry.py`，路线工具 `python tools/patrol_route.py`（Playwright、NetworkX）。改变模型代理或地图后重建并核对 `docs/巡察路线生成报告.json`，不可拿渲染缓存有无作为离屏可达依据。最低权匹配与最优性仅限报告声明的骨架。

## 7. 文件依赖契约与编辑流程

每个有状态脚本在私有闭包内实现，通过 `GameModules.imports(文件)` 取得显式依赖，通过 `publish` 发布活绑定。跨文件替换状态或函数仍只更新同一份值；兼容全局没有复制出第二套 `S`／`RT`。`domain/` 中可独立运行的纯模块仍支持 Node 直接读取。

`game3d/module-contracts.js` 记录每个文件的所有者、层次、导出、导入、允许替换的绑定和表现层只读状态。不要手改此生成文件。编辑现有闭包中的实现，或新增普通脚本并登记清单，然后运行：

```bash
node tools/link_modules.cjs --write
python tools/check_modules.py
```

链接器使用仓库自带的 AST 工具，解析真实词法作用域，生成当前交付的普通脚本；无需 npm 安装或线上构建。第二条命令同时检查契约新鲜度、隐式依赖、别名写入、数值归属、独立随机流和碰撞代理数据。新功能不得直接通过 `window.S` 等绕过端口。

表现层经端口读取的 `S`／`RT`／`AN`／`PAT`／`HIDE`／`ROAM` 是活的只读视图；嵌套赋值、删除和数组修改会报错。需要交互时调用应用命令。Mod 原有稳定 API 保持 1.0，由 `app/mod-adapter.js` 接入；通用模块加载器不再读取物品表、地图和玩家状态。兼容全局供旧页面、调试和外部工具使用，不是新模块的隐式依赖来源，也不是安全沙箱。

共享尺寸或模型代理变化时先运行 `node tools/export_collision_data.cjs --write`，再运行链接器。空间规则使用独立碰撞代理及共享配方；加载哪个模型细节包都不重新决定物理占地。音效校准工具会在写出声音数据后自动更新模块契约。

## 本次空间与感官接口（2026-11-03）

- `ClassroomLayout` 为唯一座位、教室跨度和两扇门的位置源；检查用 `atMySeat()`，不以 `S.seated` 单字段判断。
- `STAIR_LAYOUT` 与 `StairGeometry` 描述七个楼梯井和走面。普通楼层的局部坐标与楼梯坐标在门槛转换；相机、人物、门外可见模型使用同一变换，建筑相对高度连续。`StairWorld` 维护玩法位置，`StairView` 只消费位置绘制。该模块是当前地图的必要组成，不属于可随意移除的外观插件。
- `ActiveEffects.begin(dt)` 在模拟管线起点递减士力架；`updatePlayer` 消费本步有效时长。直接调用移动步骤的测试需先调用起点，避免凭空延长或重复扣持续时间。
- `SensoryRules` 是无浏览器纯函数；`Sensory` 与 `SoundCaptions` 不写玩法状态，使用表现随机源。音效出口在声音检查前发布可感知事件，并把同一 `dispatch` ID 交给音频。音量 0–5 或 AudioContext 不可用时，自动声音字幕启用。
- `doorAction` 事实为 `{room,c,r,x,y,open}`，在真实开/关门后发送；环境片段只响应已完成的关闭，不改变门锁或物理碰撞。
- 检查事实带 `result: present|absent|excused` 与 `excused`；成就、积分和责任系统对免检不加减分、不触发缺席。
- 布局版本 2、天赋规则 3、机制规则 5、速通规则 4、巡察路线版本 3。旧档铁胃变无天赋；旧门开关迁移到两扇门；旧巡察路线重新归队但保留责任和静态情报。历史通关记录按原规则保存。


### 广播站的命令和表现边界（PR #41）

`broadcast` 模块将纯数据与存档裁剪放在 `domain/broadcast.js`；`broadcast.js` 拥有稿纸、功放、铃时和调查状态；`broadcast-ui.js` 发出朗读／停止命令，面板不暂停世界；`broadcast-view.js` 只绘制，`broadcast-cinematics.js` 注册隔离 CG。`mods.broadcast` 不存 DOM／Three.js 对象和回调；当前未播完的段落在恢复时重新开始。

区域调查通过 `patrolZoneActive` 启用固定区域，掩护通过 `patrolCamouflage` 查询；它们不向巡察者提供移动中的玩家坐标。`classmateScene` 仅接管同学的当帧表现，不写占座或检查判定。
