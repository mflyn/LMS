# AI-2 限定合成工程关闭评审材料

日期：2026-11-04。材料状态：APPROVED；AI2-5 CLOSED；AI-2 CLOSED（仅限定合成工程）。
用户明确批准关闭AI2-5汇总及AI-2限定合成范围工程总门禁。随后授权专用分支交付及PR #38合并，见[交付记录](delivery.md)和[合并后证据](postmerge.md)；真实模型发送、部署及本轮新的Git写入仍未授权。

**AI2-5 status:** CLOSED
**AI-2 gate:** CLOSED
**AI-2 approval:** USER_APPROVED
**AI-2 scope:** ENGINEERING_SYNTHETIC_ONLY
**AI-2 device:** DEVICE_PENDING
**AI-2 retained gates:** T4 OPEN / T8 OPEN / AI-1 OPEN
**AI-2 Docker audit:** INCOMPLETE_FAILED
**AI-2 nonblocking:** AI2-VIEW-NB-001 OPEN_NONBLOCKING / T5-NB-001 OPEN_NONBLOCKING / T5-NB-002 OPEN_NONBLOCKING
**AI-2 historical failures:** PRESERVED
**AI-2 deferred:** REMAINDER_DEFERRED
**AI-2 real model:** NOT_AUTHORIZED / QUALIFIED_COUNTER_PENDING
**AI-2 Git:** MERGED_DEFAULT_OFF / NO_NEW_GIT_AUTHORIZATION
**AI-2 deployment:** NOT_AUTHORIZED

以上为当前批准状态；本文件§1–6保留子批验收和关闭时的证据身份；旧Git禁止描述不覆盖随后限定PR及合并授权，关闭原始快照不回写。

## 1. 本轮批准与冻结绑定

用户在复审通过后明确批准PUB-02/VIEW-01及撤回历史、隐私删除竞争补验：两批均
ACCEPTED / USER_APPROVED / LOCAL_SYNTHETIC_ONLY。原AUTH等已批准批次及缺陷关闭不回退。
本轮矩阵首页摘要P3 CLOSED / USER_APPROVED，按批准修正为最新§12及31核心/0部分；仅修当前入口，不改旧计数或失败快照。
该摘要P3与此前AUTH异常收尾P3、仍OPEN_NONBLOCKING的AI2-VIEW-NB-001是不同事项。

| 冻结对象 | candidate SHA-256 | 累计patch SHA-256 |
| --- | --- | --- |
| PUB-02/VIEW-01 | `9f73c84f4281ee83d7752d4cbdfb86cc4e4aaa2a42a73eae8cead22de42eab44` | `2fe2a90931259ee10646de97ec7a0572a5d98d098980b1a773d4b458297eb51d` |
| WITHDRAW-01/02、MEDIA-04 | `4398c4efadfb6269f4e7a34edcf87c7f560a5fc30012a50f2e97eebf2efaae80` | `54308baf6746a225842f991b3e6c1e77561dedb6fcba1cb7fcba9f6b978bf8cb` |

增量patch分别为`34f9de018490561cb36632467916bece8308146cdcc82627f2d8a40817fd257c`和
`18b2b113bc2ae32c51b879aa616efbd78695a313bd237ff40f573281ecbc58b2`。
基线`4655d30f1b61b55f400b67f16f9143dd191de1d2`；最新94源码重建与工作树一致，无关T8排除。
两批各94源码，分别13/14文档与47/50证据文件原哈希核对通过；本轮文档批准另存快照，不回写旧manifest。

最新复审10份原始产物已逐字节从临时目录归档至原项目本机忽略目录
`release-gate-artifacts/ai2-5-approval-20261104/review/`，不复制重建源码或依赖。
`evidence-manifest.json` SHA-256：`15a5a342410128d28c2e9a08db4ea587f95769a4a34ba198bcd12ba9101f8935`。
这是本地证据索引，不代表已提交或公开上传。旧两批归档和全部历史失败原字节保留。

## 2. 独立复审与验证口径

| 证据 | 结果与边界 |
| --- | --- |
| `review/homework.json`、`.log` | 新补验合并选择3套9项通过，63未选中，22.812秒，退出0；覆盖PUB-02、VIEW-01、WITHDRAW-01/02 |
| `review/resource.json`、`.log` | MEDIA-04 1套3项通过，50未选中，5.046秒，退出0 |
| `review/hash-audit.json` | 两批冻结文件/补丁/文档/证据匹配；最新94源码从基线+patch独立重建并与工作树对齐 |
| `review/assertions.json` | 去掉本批新增声明后，两批共5次文件比较的原AST精确一致；没有削弱旧断言或修改业务 |
| `review/review.md` | 无新阻断P1/P2；首页P3摘要建议本轮修正，AI2-VIEW-NB-001继续非阻断；两测试进程openHandles为空、runtime-error=0 |
| 既有变异只读复核 | visibility三变异各1失败，withdrawal四变异2/1/2/1失败；均无runtime-error suite。隐私整组变异含一例业务一致性AppError，不写成全部matcher失败；本次不重跑变异 |

精确Jest命令使用既有Node22、Jest及固定MongoDB二进制，禁止下载；重建副本执行：

```sh
node "$LMS_DEPENDENCIES/jest/bin/jest.js" --config backend/services/homework-service/jest.config.js \
  --runInBand --detectOpenHandles --testPathPattern='ai2(Service|FormalHttp|SubmissionHttp).test' \
  --testNamePattern='PUB-02 invalid|PUB-02 real AI1 unknown|VIEW-01 formal|WITHDRAW-01 formal|WITHDRAW-02 withdrawal during'
node "$LMS_DEPENDENCIES/jest/bin/jest.js" --config backend/services/resource-service/jest.family.config.js \
  --runInBand --detectOpenHandles --testPathPattern=completionMediaClientContract --testNamePattern=MEDIA-04
```

9/3是上一轮独立实际复验，本轮批准记录更新只重新核对归档和源码并运行文档检查。
不与开发220/224项homework、53项resource契约或更早独立5/4/3混合累计。
正式HTTP为真实Gateway/homework/resource与合成AI1批准/JWT夹具；WITHDRAW-02为签名HTTP及真实resource协议、元数据夹具，
屏障延迟真实prepare结果交付。MEDIA-04为真实Mongo/文件、JSON transport适配器，不冒称HTTP或浏览器。

## 3. 剩余验收条件核对

按[测试方案§3](../../family-ai2-test-plan.md#3-执行与验收分层)及[矩阵§12](matrix-reconciliation.md#12-撤回历史与隐私竞争补验)核对：

| 条件 | 当前结论 | 证据及剩余动作 |
| --- | --- | --- |
| 31行核心合成要求 | CORE_PASS_SCOPED；31核心/0部分 | 原26行加本轮5行，全部补验子批获批准；不是新跑31例或全部层次组合 |
| 设计、事务/权限/媒体、页面、正式接线及浏览器子批 | 已限定合成批准 | AI2-2/3/4及AI2-5子批既有记录；没有发现本范围新增未解决P1/P2 |
| AI1人工修订/共管批准到AI2发布 | 已批准真实合成连接 | [连接记录](bridge-acceptance.md)：双来源×两浏览器4格，Provider仅前置替身；AI2阶段无新增模型/费用写调用 |
| 回归、构建及浏览器 | 有分层通过证据，未重跑成单一最终全量 | [矩阵§2](matrix-reconciliation.md#2-现有执行档案)：历史家庭185套5554、前端64套1003、生产构建、正式Chromium/WebKit；后续实现/夹具变化对应连接及定向回归，最新纯测试增量homework224/resource53；不得声明本轮全仓全绿 |
| 冻结一致性、复审与摘要 | 当前材料已具备 | 94源码与最新候选一致，增量原断言保留；本轮仅更新批准文档，旧证据不覆盖 |
| AI2-5汇总及AI-2总门禁关闭 | **CLOSED / USER_APPROVED** | 2026-11-04用户单独批准ENGINEERING_SYNTHETIC_ONLY；不延伸为真实启用、模型发送或发布授权 |
| 完整发布/Git clean/CI交付 | **未执行，不作发布就绪结论** | 当前脏工作区含无关T8；后续另行授权提交范围、敏感信息检查及CI，不自行提交或清理 |

限定合成工程范围内核心缺口已补齐，用户已批准关闭。后续仅按单独授权安排Git交付、真机或真实启用，
不自动扩建恢复、回收或模型功能。源码变化若产生新的风险，仍须按影响补验，不自动继承本冻结候选的结论。

## 4. 不随合成关闭改变的状态

- 真机iPad仍DEVICE_PENDING：文件选择/触控、上传失败与刷新恢复、切换身份和认证图片回看需真机验证，模拟浏览器不能替代。
- AI2-VIEW-NB-001及T5-NB-001/002仍OPEN_NONBLOCKING；不借本批关闭，也不将其扩大为当前核心开发阻断。
- T4/T8/AI-1仍OPEN；AI1计数资格QUALIFIED_COUNTER_PENDING、人工审核与真实发送授权限制保持，不调用真实模型。
- Docker INCOMPLETE_FAILED及全部历史失败保留，未运行完整发布，不声明发布全绿或真实环境可用。
- 高级恢复/新回收REMAINDER_DEFERRED，T9 NOT_STARTED；NAS/真实备份恢复及真实启用仍按T8单独验收。
- 默认关闭和既有启动预检不改；不提交、推送、合并、部署，不操作服务器、NAS或真实家庭数据。

## 5. 本轮文档自查

本轮仅更新8份Markdown并新增独立证据归档，不改源码/测试；最新94源码哈希仍匹配冻结候选。
使用现有依赖执行`node scripts/check-family-docs.js`通过（412 contract fixture cases、38 requirements），
`git diff --check`退出0；8文档339个本地链接目标存在、代码围栏闭合，当前摘要及保留状态逐项核对。
校验器通过不自动证明AI-2语义或批准关闭；核心覆盖依据仍是上述已复审证据。
本轮检查产物位于同归档`validation/`，修订文档独立保存于`documents/`及`document-manifest.json`，
不重写旧两批文档快照或本轮10份复审产物。旧候选、旧失败与新批准记录分开保留。

## 6. 总门禁关闭批准与校验

2026-11-04用户明确批准“关闭AI2-5汇总及AI-2限定合成范围工程总门禁”。
AI2-5与AI-2均CLOSED / USER_APPROVED，范围严格限定ENGINEERING_SYNTHETIC_ONLY；
这是在既有独立评审和批次验收基础上的总门禁批准，不是因文档检查通过自动关闭。
本文件§3原待批准状态已更新，原READY_FOR_REVIEW快照及原始证据保留在
`release-gate-artifacts/ai2-5-approval-20261104/`，不覆盖其manifest。

本轮更新10份Markdown和既有`scripts/check-family-docs.js`的状态检查，不改业务或业务测试。
复用原唯一声明规则保护13个当前状态字段：两个真实文档及一个合法夹具通过，
缺失/改值/重复各13例应拒绝，共42项状态探针。两项内存变异分别放宽唯一性或忽略状态值，
均被永久反例拒绝；未在工作树写入变异代码。原412个契约夹具和38项需求检查保留。
文档门禁、该脚本ESLint及`git diff --check`通过；本轮没有重跑业务全量、浏览器或调用真实模型。

本次关闭文档、校验脚本、验证输出及文件哈希单独归档于本机忽略目录
`release-gate-artifacts/ai2-closure-20261104/`。94个业务/测试候选源码哈希仍匹配§1最新冻结，
状态校验脚本作为本次关闭配套修订另列manifest，不冒称属于原已验收94源码补丁。
历史失败、DEVICE_PENDING、非阻断补测、T4/T8/AI-1 OPEN、Docker INCOMPLETE_FAILED及全部后置状态保留。
合成工程关闭不包含Git交付、模型资格、真实家庭试点、备份恢复或生产发布批准。
