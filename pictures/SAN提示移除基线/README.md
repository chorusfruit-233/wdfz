# SAN 提示移除：现状基线

2026-11-03 为 [PR #37](https://github.com/wd-fz/wd-fz.github.io/pull/37) 的[感官恐怖计划](../../docs/plan/SAN提示移除与感官恐怖深化.md)拍摄。代码为 main `d16aa5f`，实际检出 `ccc2c3f79ea64bb1c9bec68abd4432bd8db2930e`（只多一份计划骨架）。**全部是修改前的游戏画面。**

浏览器 Chromium 155.0.8059.79，无头、SwiftShader、device scale factor 1。桌面为 1280×720；触屏通过 Playwright `has_touch=True, is_mobile=True` 仿真，分别 390×844、844×390。静音、固定游戏状态，不是自然游玩、真人听感、真实 GPU 性能或实体手机测试。

| 文件 | 条件与用途 |
| --- | --- |
| [01-桌面-SAN100.png](01-桌面-SAN100.png) | 均衡档、亮度 100、晃动／颗粒开；左上角“第 2 天 · 高危”与“呼吸平稳”同时出现，说明校园压力与 SAN 是两套状态 |
| [01-桌面-SAN45.png](01-桌面-SAN45.png) | 同机位，“有些恍惚”；体力上限按现有规则降至 67 |
| [01-桌面-SAN22.png](01-桌面-SAN22.png) | 同机位，“心跳很乱”；体力上限 53.2 |
| [01-桌面-SAN8.png](01-桌面-SAN8.png) | 同机位，“快撑不住了”；体力上限 44.8；边缘色差／位移仍比标签变化轻 |
| [02-流畅-关闭晃动与颗粒-SAN8.png](02-流畅-关闭晃动与颗粒-SAN8.png) | 流畅档，两个开关关；`uSan=0.08`，当前晃动开关没有关闭 SAN 后期扭曲 |
| [03-触屏竖屏-SAN8.png](03-触屏竖屏-SAN8.png) | 390×844，流畅档、晃动／颗粒关，核对旧状态卡与触屏控件布局 |
| [03-触屏横屏-SAN8.png](03-触屏横屏-SAN8.png) | 844×390，其余同上；不是实体设备画面 |
| [04-恢复活动-SAN数值提示.png](04-恢复活动-SAN数值提示.png) | 调用现有吃饭活动后的时间跳跃卡；显示实际 toast “SAN +11.1 · 校园压力使休息效果减弱”。活动由脚本直接调用，不代表角色在该机位能正常吃饭 |

[基线记录.json](基线记录.json)保存场景坐标、设置、旧标签、shader 读数、截图哈希与浏览器错误数组（本次为空）。静态图不能验收卡片跳动、动态扭曲、字幕节奏或音效；它们属于后续录屏与真人／真机任务。

## 复现方法

可复用 `tests/browser_case.py` 的临时 HTTP 服务与 Chromium 启动参数，不需要改游戏文件。`BrowserCase.page()` 已冻结主循环、禁用开场并静音。进入场景后设置如下机位；等待 `Assets.ready()` 与 `GLR.roomMesh` 就绪，画质切换也等待资源加载。

```js
Game.start('hard'); clearIntroTimers(); running = false;
S.intro = 0; PRO.on = false; CUT.enabled = false;
// 资源就绪后：
S.seated = false; S.moving = false; S.run = false;
S.day = 2; S.tsec = 700; RT.pressureClock = 2140; RT.pressureSeen = 2;
S.tt = 0; S.viol = 0; AN.active = false; AN.next = 1000;
PAT.locked = false; PAT.state = 'idle';
const room = INTERIORS.teach1;
S.x = room.ox + 30.5 * room.tw; S.y = room.oy + 18.5 * room.th;
S.ang = 0; S.pitch = 0; VisualState.camera.eyeH = EYE;
DLG.open = false; DLG.queue = [];
document.getElementById('sub').style.display = 'none';
document.getElementById('toast').style.opacity = '0';
Settings.bright(100);
// 每一张：先设画质与开关，再设 SAN；不推进模拟。
S.san = 8; S.stam = 100; capStamina(); ThreeBackend.resetSan(S.san);
GLR.time = 20; syncCamera(0); render(0.016); updateHUD(); drawMini(1);
```

四个桌面值依次为 100、45、22、8，画质 `Settings.q(1)`；流畅档用 `Settings.q(0)`、`Settings.shake(true)`（参数是 off）、`Settings.grain(0)`。触屏图来自独立仿真上下文，使用相同布置。恢复图在桌面流畅档把 `S.san` 设为 40，再调用 `doSanAct('eat')`、`render(0.016)`，立即截图。

新局种子／天赋未固定，恢复量可能因抽到的天赋不同而变化；此处记录的是实际看到的 11.1，不将其当作固定规则断言。同页四档对照没有换机位／光照时刻；CSS 动画相位、临时提示及不同浏览器的像素可有差异，不要求逐字节重现哈希。
