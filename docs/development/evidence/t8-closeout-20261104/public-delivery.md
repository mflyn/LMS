# T8 本地收口公开交付

日期：2026-11-05。基线：`7ff9b9d91fe46cd64e2e0eaaf3f39d79ef66fbd0`（AI-3 已合并的 main）。
状态：DRAFT_PR_DELIVERY / NO_MERGE / NO_DEPLOYMENT。

用户已授权将已验收的本地 T8 增量提交到专用分支、创建 Draft PR 并检查 CI。
本授权不包括合并、部署、真实模型调用或总门禁关闭。此前禁止 Git 写入的段落保留为历史权限快照。

## 提交范围

- 原批准的五个合成测试／演练文件，逐字保留冻结候选；累计补丁在当前 main 上直接应用，无业务实现修改。
- T8 本地准备索引、认证恢复、浏览器恢复、收口记录，以及 Gate §28.5–28.7 和计划的 T8 后续段。
- 本交付说明及公开文件／证据哈希清单；原始日志、数据库、媒体正文、备份包、截图和本机依赖链接不提交。
- 不包含已经合并的 AI-3 实现，不包含独立 AI-1／AI-2 状态文档增量；共享文件只提取上述 T8 章节。
  原混合工作区全部修改保留，不重置、不清理、不覆盖。

## 候选与证据核验

五文件与[批准候选](README.md#冻结候选)哈希全部一致；原累计补丁 SHA-256
`8a9831bc8fb51dc5905998fe6266ec21952990815c32abf1ebf54ecd0c1b66ee`不变。
认证64件、浏览器126件、本地收口97件及追加27件，共314件逐项大小／SHA-256核对通过。
各原索引摘要及五文件摘要见[公开交付清单](public-delivery-manifest.json)。原始文件保留在本机忽略目录，未重新生成历史报告。

本轮基于当前 main 实际执行：

| 验证 | 结果 |
| --- | --- |
| 原Jest配置，`--runInBand --no-cache --runTestsByPath`：familyBackupPreflight、familyDocumentationGate、localBackupDrillLifecycle、localProductRestoreSupport | 4套412项通过，0跳过，46.124秒 |
| 原Jest配置，`--runInBand --testMatch '**/familyLocalBackup.drill.js' '**/familyProductRestore.drill.js'` | 2套15项通过，0跳过，21.430秒 |
| `node scripts/check-family-docs.js` | 通过，保留42项AI-2状态探针、36项AI-3状态探针和412项契约夹具 |
| 五文件ESLint、`git diff --check` | 通过 |

测试使用 `env -i` 显式传既有 Node22、MongoDB8.0.10、Database Tools 和系统tar，禁用Mongo下载；
仅回环HTTP、临时合成库和临时存储，不继承模型凭据、不访问服务器或NAS。
本轮412项包含当前 main 新增文档测试，不能回写原408项历史记录。
当前未重新运行浏览器；历史两引擎各11项仍为开发实跑，独立复核与独立13项单测证据分别保留，
不冒称独立浏览器复验。完整发布回归以本PR最新SHA的CI为准，创建PR前不预先声称通过。

## 保留限制

迟到浏览器关闭失败传播P2为CLOSED / USER_APPROVED；本地批次为ACCEPTED / USER_APPROVED / LOCAL_SYNTHETIC_ONLY。
T4/T8/AI-1 OPEN、DEVICE_PENDING、Docker INCOMPLETE_FAILED、历史失败、非阻断补测、
QUALIFIED_COUNTER_PENDING、REMAINDER_DEFERRED和T9 NOT_STARTED均保持。
NAS/Restic、目标Ubuntu、独立服务重启、异机恢复、删除证据恢复、生产RPO/RTO、停写／回滚、真机及人工验收未完成。
严格删除恢复仍拒绝`LEGACY_USER_DELETION_EVIDENCE_INSUFFICIENT`，不扩展高级恢复或新回收。
本PR只保存已验收合成工程，不代表真实家庭可发布。
