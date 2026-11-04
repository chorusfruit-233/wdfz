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

[复核截图](../../../pictures/电梯直通/)中的 `复核-01…04` 使用实际游戏渲染，覆盖桌面、触屏竖屏/横屏和 WebGPU 关门中。脚本设定场景、关闭颗粒并推进门计时；没有补灯，没有修改模型。`复核-截图与状态.json` 保存源码 SHA-256、实际渲染后端、门开度、位置、碰撞深度和模块/生命周期错误。截图拍自 `5fa30e9` 的运行代码。

运行环境为 Linux、Python 3.12、Playwright 与系统 Chromium；GPU 是软件适配器，触屏为浏览器模拟。结果不代表手机真机、自然长局、实际音频听感或硬件性能测试。完整回归仍按计划放在全部里程碑完成后执行。

独立关门按钮依据已有 Claude 方案补齐，视觉部分**等待 Claude 优化审核**；本轮未改死亡 CG。
