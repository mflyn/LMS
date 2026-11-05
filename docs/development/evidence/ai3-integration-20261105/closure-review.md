# AI-3 限定合成工程关闭批准

Status: CLOSED / USER_APPROVED / ENGINEERING_SYNTHETIC_ONLY。
批准日期：2026-11-05。用户在收到系统Git完整回归及总门禁关闭评审后回复“批准”。
本记录落实AI3-E及后续工程验收、三项行为修订和遗漏测试接入验收，以及AI-3限定合成工程总门禁关闭。
这不是Git提交、推送、合并、真实模型调用或部署授权。

## 批准范围

AI3-E及后续工程ACCEPTED / USER_APPROVED；AI-3限定合成工程CLOSED / USER_APPROVED。
范围为现有[28项需求矩阵](coverage.md)：少量题组准备、人工修订发布、孩子作答与私有图片、
按所见版本人工审核、孩子回看、错题及掌握证据写回、复习日期和周报、原命令恢复与权限竞争保护。
没有扩展高级恢复、新回收或真实模型验证。

本次关闭的三处行为问题及遗漏测试入口：

- 超限历史RESERVED在过期或报价变化时不得先退款；完整持久映射在业务写入和claim前检查。
- 临时pending不得卸载孩子草稿并丢失部分上传失败；手动/焦点刷新保留失败项及提交锁。
- 分页空页不得清除已知未决命令；原命令核验终态后解除对应锁，身份变化仍清理并隔离迟到响应。
- analytics效果、版本和启动收尾三套测试纳入原家庭入口，逐条移除入口可被永久反例拦截。

## 最新完整回归

2026-11-05北京时间09:48:10开始、10:04:53结束；Node v22.15.0 arm64。
实际Git为 `/usr/bin/git`，版本 `2.54.0 (Apple Git-157)`。执行原入口：

```sh
PATH=/usr/bin:/bin:/usr/local/bin:/usr/sbin:/sbin \
MONGOMS_RUNTIME_DOWNLOAD=false LOG_FILE_PATH="$EVIDENCE/logs" \
/usr/local/bin/npm run test:family-regression -- \
  --json --outputFile="$EVIDENCE/family-full.json"
```

`EVIDENCE`为本轮独立临时目录。八个原家庭项目串行运行，没有修改断言、超时或测试选择。
**213套、6408项全部通过，0失败、0跳过、0 todo，exit0**，Jest耗时1002.451秒。
含npm包装进程总时长1003.231秒；JSON正常导出，未中断、未更新快照。
此前两个Git失败文件包含在本次完整运行中，不再以定向106项替代全量。
原入口中后置恢复/回收测试通过，不代表这些能力获准启用或验收关闭。

## 候选和证据身份

运行前后核对LMS147个源码/测试文件、DeepTutor14个文件、18份文档、163份归档与50份旧证据无漂移，
双仓HEAD/index不变。批准后的文档和校验器变更是单独关闭增量，不能声称已包含在此前全量候选中。

| 身份 | 值 |
| --- | --- |
| LMS基线 | `a4f051e26f3514da051910a3495e11b149a32c45` |
| LMS累计源码补丁SHA256 | `5bff86cda287335568f67e790ec0ba510cf34645310cb9fe164de1b83ac2561f` |
| DeepTutor基线 | `a5e64ca49667ddba2a0ba80c02ac1c59959dc2f9` |
| DeepTutor未变补丁SHA256 | `e9d7c05a1285f52feed4e59399c6fd65ce0413dee87c86858c4a450425e7f7be` |
| 修订候选索引SHA256 | `b67e4dc3339a9cb3f50d50f5fc733404891b88c101a264741abe9e15495a9e67` |
| 新完整回归及独立复审索引SHA256 | `26eebbec0383157e9712138d72b329e6013b5b40a06e6e24bd1cff9a2472bf3f` |

本机证据目录：`release-gate-artifacts/ai3-integration-20261105/native-git-full-v1/`，共29份文件。
`full/run.json`绑定命令与退出，`full/family-full.log/.json`保留原结果；
`independent-review/`保存本轮独立复审实跑、探针和变异，索引逐文件绑定哈希。
这些归档中的OPEN/待批准状态是批准前快照，保持原字节；当前状态以上述批准及门禁唯一状态行为准。

## 验证分层和历史失败

| 层级 | 证据及限制 |
| --- | --- |
| 本轮独立修订复审 | 后端283项、相关前端399项、终态/身份/迟到响应12项通过；旧退款顺序与逐项遗漏入口变异被拦截 |
| 新完整后端 | 213套6408项一次全通过，非多次定向拼接 |
| 前端和构建 | 同修订候选开发71套1166项、生产构建及lint通过；本次关闭不冒称重跑 |
| 正式HTTP | 9套107项，其中50项正式应用/HTTP、57项效果断言helper，不合称107项真实HTTP场景 |
| 浏览器 | 双来源/双引擎四组通过、123.49秒，为开发实跑，不冒称独立浏览器复验或真机 |
| DeepTutor | 未变候选沿用独立242项及取消屏障变异，不调用真实Provider |

LMS应用、本机HTTP、临时Mongo和认证媒体真实；DeepTutor operation/store真实，Provider、计数、价格为合成替身。
更多分层见[修订记录](review-fixes.md)、[独立复评](independent-review.md)。
此前213套211通过/2失败、6408项6406通过/2失败、exit1，以及Git启动-86和循环引用JSON导出失败均保留。
原 `review-fixes-v1/main/family-full.log` 被新索引引用原哈希，不补造旧JSON、不改写旧结果。
更早启动、冷加载、DeepTutor取消、临时夹具和日志权限失败也继续保留。

## 不随关闭改变的事项

- T4/T8/AI-1 OPEN、DEVICE_PENDING、Docker INCOMPLETE_FAILED。
- 历史失败、非阻断补测、QUALIFIED_COUNTER_PENDING和REMAINDER_DEFERRED。
- 人工审核要求、真实输入计数资格、当前费用授权和真实价值验收边界。
- 真机、真实启用及T8发布条件待另行验收；默认关闭配置不变，不绕过凭据、媒体保护、索引或预检。
- 未提交推送合并，不部署；本地T8及AI1/AI2文档增量继续分组，关闭补丁不混入它们。

本次关闭仅更新记录和现有状态校验；不新增审批或测试框架，不启动其他开发任务。

## 关闭增量验证

状态校验器按已批准值更新，11个唯一状态与36项内部探针保留；原未获批准的关闭反例改为
拒绝批准后状态回退，计数资格越权和重复状态反例仍保留。先更新断言时2项预期失败，
同步文档及校验器后，原 `familyDocumentationGate.test.js` 全套317项通过，0失败/跳过，exit0，40.957秒。
`node scripts/check-family-docs.js`、两份JS文件ESLint、`git diff --check`及本次范围内部文件链接检查通过。
这317项是关闭增量定向验证，不改称又一次6408项全量；产品实现未变。

本次11文件关闭增量及验证单独保存在本机
`release-gate-artifacts/ai3-integration-20261105/approved-closure-v1/`，
不覆盖 `review-fixes-v1` 或 `native-git-full-v1` 的旧文档、源码或证据索引。
