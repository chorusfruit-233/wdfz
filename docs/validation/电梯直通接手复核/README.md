# 电梯直通接手复核

2026-11-04，PR #41。复核基线 `a92cfbc`，本轮修复提交 `5fa30e9`。保留远端已完成的 M2 模型、死亡 CG、档案与成就，不用另一套本地电梯实现覆盖它。

## 问题与修复

1. 选择目标楼层后，`Elevator.tick()` 先切到运行场景，巡察更新随后清掉旧挡门状态，导致正常乘梯离开漏记成就和 +15。已改为门完全合上时先结算，之后才切场；重复调用和读档继续出发都只结算一次。
2. 计划 1.3 要求独立的触屏关门大按钮，已有面板只有楼层选项。现在按钮直接关门；桌面物理 V 同样可用，不打开选择框，E 仍操作面板。按钮随输入归属隐藏，新局与回菜单立即清理。
3. 挡门分支会用较短 ETA 覆盖已有预警，抓捕也没有检查剩余预警。现在保留已有时长并等待它结束，近距离普通抓捕同样遵守预警。
4. 挡门锁定没有走符纸分支，保命后旧挡门状态也可能残留。现在符纸照常生效，救援、照退、追逐解除与安静区域清理旧状态，不误发逃脱奖励。

## 验证

以下为本次独立运行的专项回归，合计 **93 个不同用例全部通过，无跳过**，不是完整游戏回归：

| 日志 | 用例数 | 范围 |
| --- | ---: | --- |
| [专项9](专项9.log) | 9 | 触屏两种方向、物理 V 与暂停/回菜单、选层出发结算、预警、符纸、救援、存档；原生 WebGPU 下流畅/超精细/真实三档乘梯与关门 |
| [回归44](回归44.log) | 44 | 原有电梯 11 项、巡察连续移动与跨场景追踪、存档边界 |
| [空间与架构40](空间与架构40.log) | 40 | 全校与超精细两项穿模审查、全校五档碰撞与可达性、模块与 Mod、无 DOM/WebGL 规则、架构边界、Wiki 隐藏内容检查 |

```bash
python tools/check_modules.py
PYTHONPATH=tests python -m unittest test_elevator_review test_webgpu.NativeWebGPUTest.test_direct_elevator_and_touch_close_remain_native_in_three_quality_tiers -v
PYTHONPATH=tests python -m unittest test_elevator test_patrol_world test_patrol_motion test_save_boundary -v
PYTHONPATH=tests python -m unittest test_geometry test_modules test_architecture_core test_domain_rules test_module_boundaries test_wiki_secrets -v
python tools/capture_elevator_controls.py
```

## 画面证据与限制

[复核截图](../../../pictures/电梯直通/)中的 `复核-01…04` 使用实际游戏渲染，覆盖桌面、触屏竖屏/横屏和 WebGPU 关门中。脚本设定场景、关闭颗粒并推进门计时；没有补灯，没有修改模型。`复核-截图与状态.json` 保存源码 SHA-256、实际渲染后端、门开度、位置、碰撞深度和模块/生命周期错误。截图已在同步 M3a 并修正横屏布局后重拍，实际运行源码以该 JSON 的 SHA-256 为准。

运行环境为 Linux、Python 3.12、Playwright 与系统 Chromium；GPU 是软件适配器，触屏为浏览器模拟。结果不代表手机真机、自然长局、实际音频听感或硬件性能测试。完整回归仍按计划放在全部里程碑完成后执行。

独立关门按钮依据已有 Claude 方案补齐，视觉部分**等待 Claude 优化审核**；本轮未改死亡 CG。


## 同步 M3a 后的复测与收尾

在 `6f642b4` 合入远端 `0d17cf1` 的过场与隐藏档案成果，三个文档追加冲突均保留双方内容，未改远端 CG。再次验证关门、过场进出、档案/速通、模块与 Wiki、原生 WebGPU：

- [同步后界面14](同步后界面14.log)：14 项全部通过。
- [同步后33](同步后33.log)：32 项通过，档案回放收尾一项在并行软件渲染下超过原 15 秒墙钟期限；单独重跑原用例正常通过。收尾测试改为推进到结束时间点，仍让真实浏览器帧执行换场和结束回调，保留档案隔离、只收尾一次及回菜单断言，没有放宽超时。
- 截图复核发现横屏新增按钮压住交互键；现将它放在交互键左侧、快捷格下方，并增加与摇杆、交互、手电、快捷格、小地图、顶部按钮及字幕不重叠的断言。覆盖 390×844、844×390、667×320，点击仍立即关门。
- [收尾复测2](收尾复测2.log)：上述两项最终均通过。

按每个用例的最新结果统计，本轮合计 **118 个不同用例通过，无跳过**；此前的超时原始日志保留，不能把这批结果称为全量回归。完整命令如下：

```bash
PYTHONPATH=tests python -m unittest test_elevator_review test_void_cut test_archive_speedrun -v
PYTHONPATH=tests python -m unittest test_modules test_wiki_secrets test_webgpu.NativeWebGPUTest.test_direct_elevator_and_touch_close_remain_native_in_three_quality_tiers -v
PYTHONPATH=tests python -m unittest test_elevator_review.ElevatorReviewTest.test_touch_close_is_immediate_without_a_choice_in_both_orientations test_void_cut.VoidCutTest.test_archive_cards_are_hidden_until_seen_and_replay_in_isolation -v
```
