# T5 限定合成工程总门禁批准记录

日期：2026-10-27（Asia/Shanghai）。用户明确批准关闭 T5 限定合成范围工程总门禁。
当前裁决：**APPROVED / CLOSED / ENGINEERING_SYNTHETIC_ONLY**。
本记录接续 [关闭申请](closure-review.md)，不覆盖申请时 OPEN、冻结待复评或原失败快照。

## 批准内容与证据

- 完成今日计划、任务顺序和可选孩子估时的限定合成工程验收；数字输入 P2 与冲突图 P3 保持 CLOSED。
- 批准绑定的业务源候选 entries SHA256：
  `44f7011d0118108e9660e4b8ab6698e2968c65318d9bacb0ff0f882c34997b8e`。
- 对应七文件修复补丁 SHA256：
  `acdbdccae9267335dbcd46800f7d120af83318597e78716aedb144fd3425f119`。
- 复评报告 SHA256：`fa21a1f11bca3704735ac5750db5378dff59168d988f431cbfe1beec0e45bb2b`；
  复评归档 manifest SHA256：`c3620baac3152481b2cddb13a0b19ee66119625331f551912ba9280824334c31`。
- 报告和原始结果位于 `release-gate-artifacts/t5-numeric-fix-2026-10-27/review-r1/`；
  原开发及历史独立证据保持原样。证据执行者、覆盖范围和计数沿关闭申请，不累加重叠运行。
- 业务代码未变。本次只同步 Gate/计划/导航/架构状态/追踪和现有文档校验器及其永久反例；
  该记录层增量不冒称原冻结候选的新一轮全业务回归。

## 状态校验与验证

继续复用 scripts/check-family-docs.js 和 familyDocumentationGate.test.js，无新测试框架。
T5 必须只有一个 CLOSED 当前行、批准 APPROVED，并严格保留限定合成范围。
新增当前字段保护：ENGINEERING_SYNTHETIC_ONLY、历史失败 PRESERVED、两项建议
OPEN_NONBLOCKING；在 Gate 与计划两处分别覆盖篡改、缺失及冲突重复，共新增18项反例。
现有 DEVICE_PENDING、无部署/Git授权、后置状态、T4未批准关闭和T6–T9未启动保护继续保留。

先在旧检查器上运行6项新增负向反例得到 RED（其余174项按名称未选择，非修改/跳过测试），
再更新检查器，运行完整状态套件、文档审计、增量lint及diff检查。
最终命令、退出码、文件和历史证据哈希见 [批准验证索引](approved-closure-verification.json)，
原始输出归档于 `release-gate-artifacts/t5-numeric-fix-2026-10-27/approved-closure-validation/`。
不重跑未变化的业务代码，不宣称当前全量回归重新全绿。

## 仍保留的义务

| 项目 | 状态及边界 |
| --- | --- |
| 真机 | DEVICE_PENDING，iPad触控/软键盘/数字清空/切换/断网/午夜等仍待人工验证 |
| T5-NB-001 | OPEN_NONBLOCKING；无效输入后点击5/15/30快捷值的直接反例，未实施 |
| T5-NB-002 | OPEN_NONBLOCKING；save内部第二道校验的独立反例，未实施 |
| 历史失败 | PRESERVED；不修改原RED、后端失败、socket/401/D2B等历史记录 |
| T7/T9 | 综合验收及家庭价值/学习效果义务保留；SL-04总体仍PLANNED |
| T8 | T8_PENDING / NOT_AUTHORIZED，服务器限额、真实备份恢复、发布与回滚另行授权 |
| D01/T2-G及高级恢复/新回收 | REMAINDER_DEFERRED，仍关闭，不因本次工程关闭重新启用 |
| Git/外部系统 | 不提交、推送、合并、部署，不访问服务器/NAS/真实数据，不运行真实cleanup/restore |

本次不修改T4的批准状态，不自动启动T6或其他业务任务；T5工程关闭不是生产可用性或真机验收声明。
