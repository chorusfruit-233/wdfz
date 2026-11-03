# 巡察步行与区域报警验证

基线：组织仓库 `wd-fz/wd-fz.github.io` 的 main `d16aa5f`，2026-11-03。最终游戏脚本摘要为 `1e0cdb552b0c51360dd7910cef2533717e3fd6d7647ebe86bb910c212977efb0`，算法见 `tools/patrol_runtime_audit.py` 的 `source_digest()`；不包含本文、日志及其他文档。

发布前同步 main `96641cc`（PR #37）；其改动只有计划文档与基线截图，不改变游戏脚本，源摘要与本次验证一致。

本次按最终用例 ID 去重为 **216 项通过，0 项未覆盖，0 项最终失败**，详见[最终结果](最终结果.json)。这是增量验证：保留先前通过且不受后续修改影响的用例，再针对改动和失败复测；不是一次执行全仓测试，也不是自然游玩或真机认证。环境为本地 Chromium、软件 WebGL，移动端使用触屏仿真。

## 改动与验证重点

- 室内巡逻、追逐、搜索、无线／区域调查与归队按 `speed × dt` 连续移动。检查每帧位移、30／60／144 Hz 一致性、关闭门洞的逐帧通过、门锁不被修改，以及普通步行不续期抓捕保护。
- 非栅格起点接入新路径时验证线段，不切墙角。迷宫和钟楼的逐帧步行检查支撑面、高度与速度。
- 室外普通巡逻允许沿道路长瞬移；追逐、调查和归队不允许；起止点避开附近玩家。检查成功后 8 秒冷却、落点安全及读档接续。
- 网络中心终端操作区、核心机房进入报警；走廊、门洞、学生机房不报警。区域通知只含区域／序号／时间，FIFO 去重，调查固定观察点 6 秒；停留不重复发报，离开不提供新坐标，读档不重播。
- 白天报警区不受普通课表和外出登记豁免；夜间仍沿用室内普通敌对资格限制。无线破解的每 15 秒静态位置暴露保持独立。
- 机制规则 4、速通规则 3；旧存档、旧行政楼队列继续恢复，旧速通记录不删除，个人最佳按版本隔离。

## 回归记录

| 记录 | 用例数 | 结果与复测 |
| --- | ---: | --- |
| [手机与旧巡察首轮](手机与旧巡察首轮.txt) | 48 | 47 通过；原测试以 `blinkCD=100` 冻结敌人、要求预警后仍不被抓，已改为验证完整预警与之后正常抓捕；最终无线整组通过。 |
| [旧系统集成首轮](旧系统集成首轮.txt) | 72 | 71 通过；「网络中心不报警」旧断言按本次明确需求改为验证办公室与网络中心跨区域 FIFO，最终巡察整组通过。 |
| [架构与边界](架构与边界.txt) | 30 | 全部通过；包含无 DOM／WebGL 碰撞、全场景表现不改玩法状态、显式模块端口及只读边界。 |
| [巡察与区域报警](巡察与区域报警.txt) | 69 | 全部通过；巡察世界、步行、区域、无线和网络生命周期，包含上述两处修订。 |
| [成就速通与存档](成就速通与存档.txt) | 44 | 全部通过；档案、成绩、成就、模块持久化及全校穿模扫描。 |
| [纯规则与 Wiki](纯规则与Wiki.txt) | 25 | 全部通过；最终规则、无渲染碰撞和 Wiki 保密检查。 |
| [特殊空间逐帧步行](特殊空间步行.txt) | 1 | 迷宫出口与钟楼顶层均到达，支撑面合法，无超速。 |

各组有重叠，不直接相加。最终结果表只统计当前存在的 216 个用例；被替换的旧「网络中心不报警」测试 ID 单列，不伪装成当前漏测，也不抹掉首轮日志。

## 完整路线与永久追踪

`python tools/patrol_runtime_audit.py` 生成[路线运行](路线运行.json)，固定 0.1 秒步进，布置免普通敌对条件：

| 玩家情境／画质 | 模拟运行秒 | 必经边覆盖 | 室外长瞬移 | 非法落点／室内超速 |
| --- | ---: | ---: | ---: | ---: |
| 玩家远处／流畅 | 1152.3 | 68 / 68 | 17 | 0 / 0 |
| 玩家附近／流畅 | 1581.9 | 68 / 68 | 0 | 0 / 0 |
| 玩家远处／最高画质 | 1152.3 | 68 / 68 | 17 | 0 / 0 |

同一玩家情境的两档画质轨迹完全一致。附近玩家会阻止长瞬移，因此其总时长与远处情境不同；这些数字不是自然玩家的路线耗时，也不证明长期平衡。

`python tools/patrol_chase_audit.py` 生成[永久追踪](永久追踪.json)，布置永久追踪与调试无敌，34 / 34 个常规／特殊空间测试目标可达，追踪策略保持，生命周期错误为空；不把调试无敌运行当作生存通关。

两份审计报告的源摘要与最终结果一致。`python tools/check_modules.py`、链接契约检查及 `git diff --check` 通过。桌面与 390×844 触屏仿真检查了入口告示和报点提示；未做 Android／iOS 真机、听感或真人长局平衡验收。

## 复跑相关用例

```bash
python tools/check_modules.py
PYTHONPATH=tests python -m unittest test_patrol_world test_patrol_motion test_patrol_zones test_wireless_signals test_network_lifecycle -v
PYTHONPATH=tests python -m unittest test_pressure test_threat_audit test_day_rhythm test_campus_events test_modules test_campus_network -v
PYTHONPATH=tests python -m unittest test_architecture_core test_domain_rules test_campus_network_rules test_architecture_contracts test_module_boundaries test_wiki_secrets -v
PYTHONPATH=tests python -m unittest test_archive_speedrun test_run_record test_achievements test_module_persistence test_geometry.GeometryTest.test_clip_audit_whole_school_is_clean -v
python tools/patrol_runtime_audit.py
python tools/patrol_chase_audit.py
```
