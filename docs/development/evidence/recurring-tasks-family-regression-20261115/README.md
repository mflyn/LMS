# 重复计划完整家庭后端回归补验

状态：`FAMILY_REGRESSION_PASSED`；重复计划限定合成总门禁仍`OPEN / SYNTHETIC_GATE_REVIEW_PENDING`。本轮只执行用户授权的既有完整回归并更新证据，不自动关闭门禁。

## 候选及实际执行

- 已验收累计补丁：`dd58f6480900ab1bec1679043e7441ebae5cfb732a98f5569a5332df0807756b`，见[最终集成冻结清单](../recurring-tasks-final-integration-20261115/candidate-files.json)。当前批准记录及剩余条件见[测试方案§12至14](../../family-recurring-tasks-test-plan.md)。
- 本机Node v26.9.0，原系统Git优先PATH，已有依赖。开始2026-11-15 21:56:12、结束22:17:38（北京时间）。
- 实际原入口：`npm run test:family-regression -- --json --outputFile=<private-run>/jest.json`。只增加报告参数，没有修改测试范围、断言、配置、超时或并发。
- **215套件、6502项通过，退出码0，0失败、0跳过、0todo，Jest耗时1284.22秒。** 一次完整运行，未重跑掩盖失败。
- 8项目：family-common、user-service、homework-service、progress-service、resource-family、analytics-family、analytics-attachments、notification-family。原legacy排除不变；不是整个仓库所有测试。
- 重复计划核心51项及运行时43项已包含于6502，不能重复累计。T2正式HTTP及浏览器是其他入口，仍沿用之前分批/独立证据，本轮未重跑。

## 证据与自查

`verification.json`包含原命令、时刻、退出码、215套件逐项结果、运行前后44文件哈希和原始证据SHA-256。44文件为冻结候选34个非文档文件以及10个包脚本/入口配置；均未变。原始`run.log`、`jest.json`、`run.json`位于本机私有目录`/tmp/recurring-family-regression-20261115-r1`，本目录摘录不是原始字节。`archive-files.json`绑定本目录除自身外的文件。

部分原moduleNameMapper要求检出内node_modules，仅临时链接已有依赖目录；结束核验链接仍属于本轮后移除。无安装、无配置改动，不删除原依赖。原测试使用既有临时合成夹具，没有更新真人测试入口、访问真实服务器/数据或调用模型。

本次没有失败用例，故无修复或失败后补跑。旧Mongo驱动弃用警告、原负向用例日志留在原始日志，不将日志中的预期错误当成失败套件。早期历史红灯及失败记录继续保留；45个既有重复计划归档文件未改写。当前文档的合法状态增量不重新生成旧冻结补丁。

## 关闭评审边界

此前材料中的“完整家庭回归证据不足”已通过本轮实际执行补齐，未自动豁免。最终集成批及收尾P2已批准，但限定合成总门禁仍需用户另行批准。

自动timer连续多周期继续作为非阻断补测；真人/真机保持待验。保留T4/T8/AI-1 OPEN、SERVER_TIMING_UNVERIFIED、DEVICE_PENDING/MANUAL_PENDING、Docker INCOMPLETE_FAILED、历史失败及后置范围。后置模块出现在原回归中不代表其发布验收通过。未提交推送、部署或更新真人入口，本机结果不能替代Ubuntu资源、真实恢复或真实发布验证。
