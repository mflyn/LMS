# T7 MongoDB 4.4 索引兼容最小修订

日期：2026-10-28。用户批准先复现完整错误、移除冗余普通索引、保留唯一约束，
再冻结候选重跑 Docker 14–17。本记录为开发修复与自查证据，不代替独立复评或总门禁批准。

## 原因与修订

在独立 MongoDB 4.4.30 合成库，按修改前 Mongoose schema 的真实索引集合执行建索引，
返回 `IndexOptionsConflict / 85`。完整 errmsg 明确列出
`one_pending_parent_invitation_per_family`（unique、partial status=pending）与已有
`familyId_1`（普通索引）同键冲突。原始错误在 `mongo44-red.log` 和远端 red 命令证据中，
不是把上一轮仅有 code85 的日志补写成完整错误。

仅删除 `FamilyParentInvitation.familyId` 的 `index:true`，保留 `required:true`、
pending 条件唯一索引、全局 tokenDigest 唯一索引及 familyId/status/expiresAt 复合索引。
复合索引的 familyId 前缀继续支持家庭查询；检查用户服务调用方，没有普通索引名 hint 依赖。
没有 dropIndexes、syncIndexes、自动迁移或真实数据库操作。已有普通同键索引的历史 Mongo4.4
数据库不在本次空库初始化验证范围，若要调整需另行审核迁移，不宣称此修订会自动修复历史库。

## 永久反例与实际验证

复用 `backend/services/user-service/__tests__/models/FamilyMembership.test.js`，新增四项：

1. familyId 单字段仅保留指定条件唯一索引，复合查询索引存在。
2. 空集合建立索引并重放，完整索引清单不变且没有冗余 familyId_1。
3. 并发同家庭 pending 只成功一次；历史 accepted/revoked/expired 可各有多条，历史转 pending
   冲突拒绝且原状态不变；跨家庭不误限，旧 pending 终结后可创建新的 pending。
4. tokenDigest 在不同家庭、历史状态之间仍全局唯一。

旧模型运行新增测试：2 failed / 6 passed，两个结构/初始化断言准确拦截旧声明；旧四项测试全部保留。
修订后用户服务完整项目：13 suites / 178 tests PASS；`npm run test:task12:integration`：
1 suite / 2 tests PASS（真实服务共管 HTTP、失效邀请统一响应）；`npm run lint` 和
`git diff --check` 退出0。没有改规则、删断言、提高超时或跳过测试。

另用同一 Mongo4.4.30 镜像在第二个全新合成库验证修改后的 schema 索引：重复初始化、pending
重复11000、历史6条、跨家庭、历史重开拒绝及 tokenDigest 唯一性全部通过。远端探针使用
1 CPU/1024 MiB、memory-swap=memory、network=none、tmpfs，不开放端口、不借用现有卷。
这是实际4.4兼容证据；不把本地默认 MongoMemoryReplSet 测试声称为4.4执行。

## 冻结与收尾

新 R3 构建源码378文件，相对 R2 仅 `backend/common/models/FamilyParentInvitation.js` 改变。
修复补丁包含模型和永久测试，完整源码清单、补丁及工具哈希在 R3 `frozen-candidate.json`，
运行源码不包含测试、凭据或真实数据。原 smoke、Dockerfile、Compose、入口保持不变。

原始证据位于 `release-gate-artifacts/t7-index-compatibility-2026-10-28/`；
本目录 `evidence.json` 绑定日志、修改前后 schema、探针、清理和测试结果的文件哈希。
远端探针 red/green 的容器均已收尾，证据复制后逐项哈希复核，再仅删除自己的探针目录。
探针前后原11容器选定元数据及卷、网络、镜像集合一致，没有读取真实业务数据。

自查：变更只去掉冗余索引，唯一性/查询前缀/历史状态均有测试；未发现本修订新问题。
状态 `SELF_REVIEW_PASSED / INDEPENDENT_REVIEW_PENDING`。Docker R3 的实际结果另行记录，
不能由此推定14–17通过。T4/T7 OPEN、历史失败、DEVICE_PENDING、两项非阻断补测与
高级恢复/新回收 REMAINDER_DEFERRED 不变；不提交、推送、合并或部署。
