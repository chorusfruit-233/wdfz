# 原始验证日志

所有日志以 gzip 保存，包含初次失败和最终复测；不是删掉失败后拼成的一次全绿运行。逐项去重来源见[回归结果](../回归结果.json)。

| 日志 | 范围 |
| --- | --- |
| [wdfz-plans-final0.log.gz](wdfz-plans-final0.log.gz) | 263 项，2671.843 秒；passed=258, failed=5 |
| [wdfz-plans-final1.log.gz](wdfz-plans-final1.log.gz) | 396 项，4036.087 秒；passed=382, failed=13, skipped=1 |
| [wdfz-plans-rechecks1.log.gz](wdfz-plans-rechecks1.log.gz) | 15 项，161.536 秒；passed=15 |
| [wdfz-plans-rechecks2.log.gz](wdfz-plans-rechecks2.log.gz) | 3 项，75.396 秒；failed=1, passed=2 |
| [wdfz-plans-rechecks3.log.gz](wdfz-plans-rechecks3.log.gz) | 17 项，201.505 秒；passed=16, failed=1 |
| [wdfz-plans-rechecks4.log.gz](wdfz-plans-rechecks4.log.gz) | 11 项，140.894 秒；passed=11 |
| [wdfz-plans-rechecks5.log.gz](wdfz-plans-rechecks5.log.gz) | 12 项，271.007 秒；passed=10, failed=2 |
| [wdfz-plans-rechecks6.log.gz](wdfz-plans-rechecks6.log.gz) | 3 项，123.004 秒；failed=2, passed=1 |
| [wdfz-plans-rechecks7.log.gz](wdfz-plans-rechecks7.log.gz) | 2 项，126.793 秒；failed=1, passed=1 |
| [wdfz-plans-rechecks8.log.gz](wdfz-plans-rechecks8.log.gz) | 1 项，25.704 秒；passed=1 |
| [wdfz-plans-rechecks9.log.gz](wdfz-plans-rechecks9.log.gz) | 8 项，219.916 秒；passed=8 |
| [wdfz-plans-rechecks10.log.gz](wdfz-plans-rechecks10.log.gz) | 2 项，20.106 秒；passed=2 |
| [wdfz-plans-rechecks11.log.gz](wdfz-plans-rechecks11.log.gz) | 14 项，134.727 秒；passed=14 |
| [wdfz-plans-static-final.log.gz](wdfz-plans-static-final.log.gz) | 模块契约、168 个 JS 语法与文档链接 |
| [wdfz-plans-runtime-final4.log.gz](wdfz-plans-runtime-final4.log.gz) | 最终巡察路线 |
| [wdfz-plans-chase-final4.log.gz](wdfz-plans-chase-final4.log.gz) | 最终永久追踪 |
| [wdfz-plans-motion-final4.log.gz](wdfz-plans-motion-final4.log.gz) | 最终动态对照与资源往返 |

全量分片的日志首行保留模块列表；复测日志逐行保留完整测试 ID。可在根目录用 `python -m unittest discover -s tests -v` 重跑全部；单项可用 `PYTHONPATH=tests python -m unittest -v 完整测试ID`。实际验证调用游戏页面，但大部分用例布置场景或状态，不能称为自然通关。

完整分片启动时已经载入测试定义；运行中修正的旧坐标、旧菜单、旧感官接口和默认值断言由后续专项结果覆盖。两项巡察旧测试替换为真实梯段测试，逐项表只列现行名称。最后补入的声音和多圈转向检查来自专项。
