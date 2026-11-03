# T8 本地备份准备记录

状态：LOCAL_IMPLEMENTATION / LOCAL_REVIEW_PASS / LOCAL_TECHNICAL_ACCEPTANCE_PASS；本地交付验收见文末，T8 总门禁 OPEN。
首批只授权本地说明/最小入口与测试；后续另行授权本机合成归档及正式 HTTP 恢复验证，见下文。
本批服务器执行、安装、挂载、真实数据备份恢复及部署未获授权；最新 Git 专用分支/PR 授权见文末，历史时点记录不覆盖。

## 范围

- `scripts/check-family-backup.js`：只读检查 NAS 精确挂载/来源、容量、私有暂存根、固定 Ubuntu 服务清单、
  停写状态、三类卷归属与使用、两次观察一致性；不采集、上传、恢复、停止或清理。
- Ubuntu 部署指南 §7.4：独立删除日志、跨服务一致性窗口、固定 backupId/snapshot ID、失败保留、隔离恢复。
- 既有 Jest/文档门禁：新增永久反例，更新 T8 仅本地准备授权；补记已完成的 PR #35 合并事实。
- 未修改业务代码、API、Compose 默认配置、旧客户端拒绝或高级恢复/回收实现。

## 测试与自查过程

1. 首次新增测试因入口尚未存在而失败，0 项执行；这只是缺少实现的证据，不冒充行为反例。
2. 首轮 49 项通过。自查补充的 bind 别名三种关系、Mongo 误挂媒体、健康时间戳变化五项出现红灯：
   5 failed/52 passed。修复后 57 项通过；恢复正常健康采样不影响身份校验，不放宽真实状态/来源变化。
3. 再补项目扫描与全局运行扫描间的应用重启、新同项目写入者、卷 Mountpoint 变化反例，
   定向运行 3 failed/58 未选中；随后修复。最终结果以下一节最终验证为准。
4. 文档新增授权状态的定向红灯 7 failed/299 未选中，原门禁尚无批准的 T8 本地准备状态。
   更新现有状态规则，保留 T4 OPEN、T9 NOT_STARTED 和 T8 不可伪造关闭/服务器授权的负向用例。
5. 定向 ESLint 曾报告控制字符正则错误，改为字符码检查，未放宽规则或添加忽略。
6. 自查补充本机 NAS 与远端 Docker context 混用的反例，1 failed/60 未选中；
   固定本机 Unix socket 并移除子进程 Docker 连接环境覆盖，真实 CLI 替身验证该边界。
7. 独立评审发现两项 P2：保护根的子挂载可导致归档遗漏；最后全局观察到 Mongo 停止仍可能通过。
   新增 14 项永久反例，定向运行 14 failed/61 未选中，均为预期抛错但未抛错。修复后 75 项通过。
   三根路径的 bind/volume/tmpfs 子挂载、HostConfig Tmpfs、最后 Mongo 停止/暂停/重启/镜像变化均覆盖。
8. 独立复核确认两项 P2 可关闭，2 suites/381 tests 通过，额外 19 项纯内存断言通过，未发现新增
   可复现 P1/P2。补查包含精确/深层 Tmpfs、Mongo 状态和挂载变化及正常排序；不将一次性断言算作
   新增永久测试。本地 reviewer ID：`01a18aa9-dec1-7373-9344-0ed795ac1eb2`。
9. 最后 lint 报告参数化测试调用换行问题，修复格式后全仓 lint 通过；没有关闭规则或削弱断言。

真实 CLI 子进程使用现有测试的依赖替身方式，替换平台标记、容量及 findmnt/Docker 观察输出；
临时目录/权限、子进程和退出码真实验证。没有连接服务器、Docker daemon、NAS 或数据库。
不能将这些测试作为 Linux/NAS/备份集成通过。

## 最终验证

Node 22.23.3；复用本机已存在的依赖，通过 NODE_PATH 指向该依赖目录，没有安装或加入依赖符号链接。
下列命令中的 `node`、`jest`、`eslint` 实际使用该 Node 和既有依赖的绝对路径调用：

```bash
node <existing-dependencies>/jest/bin/jest.js --config=backend/jest.family-common.config.js --runInBand --json --outputFile=<private-evidence>/t8-family-common-reviewed.json
node <existing-dependencies>/jest/bin/jest.js --config=backend/jest.family-common.config.js --runInBand --runTestsByPath backend/common/deployment/__tests__/familyBackupPreflight.test.js backend/common/deployment/__tests__/familyDocumentationGate.test.js --json --outputFile=<private-evidence>/t8-local-closeout.json
node <existing-dependencies>/eslint/bin/eslint.js .
node scripts/check-family-docs.js
git diff --check
```

- 两项 P2 修复后的公共回归：49 suites / 1330 tests passed，0 failed/0 skipped，退出 0，69.222 秒。
  这不是家庭后端全部项目、前端或完整发布门禁的重跑；没有修改这些业务实现。
- 独立复核定向回归：2 suites / 381 tests passed。最后仅更新本地复核状态为 LOCAL_PASS 后再执行
  相同两个套件：2 suites / 381 tests passed，0 failed/0 skipped，退出 0，32.824 秒。
- 全仓 lint、文档状态校验及 diff 格式检查通过；六份改动文档中的 241 个本地链接目标均存在。
- 初次公共回归在受限上下文因 backend/logs 创建 EPERM 失败：14 failed/35 passed suites，
  16 failed/1180 passed tests。随后仅使用受控本机测试权限，同一范围先通过 49/1316，
  再加入独立评审的 14 项反例后通过 49/1330；没有跳过测试或增加超时。
- 一次文档命令未指定 NODE_PATH 导致 dotenv 缺失，补回既有依赖路径后通过。该次是环境失败，
  不是文档校验成功。原红灯、环境失败与复验结果分别保留。

本机原始 JSON 位于私有临时证据目录，不复制带环境路径的原始输出到公开仓库。以下摘要绑定原件；
摘要不是远程运行证明，临时文件不等于持久异机归档。

| 原件名称 | SHA-256 |
| --- | --- |
| t8-family-common-final.json（首次环境失败） | `3619fb99e52da7e029239557443a14ee32e0c74c8f2407da11494d513af9b2a5` |
| t8-family-common-controlled.json（评审前 1316 项通过） | `08d17efe958ad1424058ef46d3f4d064e58f9a2ca8340679f2b3c0d88878accf` |
| t8-independent-p2-red.json | `1e91669e4cf83cb7b4660db432bd4201fe36a1ca9ad4c1fb327db75752a5be28` |
| t8-independent-p2-green.json | `557636a75ef81e9cdbb52957975c226f733a7d9a5cb07122defb6f56d2de3836` |
| t8-family-common-reviewed.json（1330 项通过） | `f00a005599b4034095653abe9e7082cef9b08fc4afc0034f66f9ef0803f90df2` |
| t8-local-closeout.json（最终状态 381 项通过） | `4584d3a091a25e46f50ebe2c232f381a4c77929725c10a0403623c397dc85665` |

候选实现 `scripts/check-family-backup.js` SHA-256：
`7db8f149f59be898d3681e44dd547153a468248a3c1c6385089a2af4cec316b6`。
永久测试 `familyBackupPreflight.test.js` SHA-256：
`1bcae05a42f6ea8cbfae3a2542f6b2a59812a8afc45991269e77c753a0f88639`。
本地基线 HEAD `9593d2890147c41eb3e4e87d07db16196ec760c0`；未创建本批 Git 提交。

## 剩余边界

只读前置检查不是维护锁，不证明外部写入者、业务未决意图或 NAS 配额/写权限已核实；Docker bind 来源
别名仅覆盖可观察路径关系，不能排除宿主机进程或全部文件系统别名。检查后仍需保持维护窗口。
当前脚本不提供备份采集/上传/恢复执行器；dump/归档/上传失败、真实镜像身份、删除证据恢复及预算
仍需后续获批的合成演练。不能为了前置检查通过而现在停止真实服务。

T4 OPEN、DEVICE_PENDING、历史失败、Docker INCOMPLETE_FAILED、T5-NB-001/002 OPEN_NONBLOCKING、
高级恢复/新回收 REMAINDER_DEFERRED、T9 NOT_STARTED 保留。真实部署和恢复单独批准。

## 本机合成归档预演

用户确认 NAS 暂无、先不做 NAS，继续本机可执行步骤。本节不覆盖前述本地前置检查的证据。
新增 `backend/common/deployment/fixtures/familyLocalBackup.drill.js`，只在显式 testMatch 下运行，
不改默认 CI 的真实工具运行范围、生产备份入口或高级恢复实现。独立复核：LOCAL_REVIEW_PASS，
两项收尾 P2 修复通过，限本地夹具代码和测试；不是 T8 总门禁关闭。

环境：macOS arm64、Node 22.23.3、现有 MongoDB 8.0.10、mongodump/mongorestore 100.12.1、系统 tar。
不下载二进制，不安装 Restic，不访问 Docker、服务器或 NAS。它自行创建源与目标临时副本集，
仅绑定 127.0.0.1，不接受外部 URI，源停止后才启动目标；每个实例 WiredTiger cache 设为 0.25 GiB。
该 cache 设置不是进程或整个测试的内存硬限额，不声称符合 Ubuntu 的 cgroup 资源验收。
临时根 0700；只停止本轮实例，不清空目录，保留合成归档、清单和错误日志。

复用已有 Jest，执行命令（工具路径须先确认已存在；不隐式安装）：

```bash
NODE_PATH=<existing-dependencies> \
MONGOMS_RUNTIME_DOWNLOAD=false MONGOMS_VERSION=8.0.10 \
T8_MONGOD_BINARY=<existing-mongod> \
T8_MONGODUMP_BINARY=<existing-mongodump> \
T8_MONGORESTORE_BINARY=<existing-mongorestore> \
T8_TAR_BINARY=<existing-tar> \
<node22> <existing-dependencies>/jest/bin/jest.js \
  --config=backend/jest.family-common.config.js --runInBand \
  --testMatch '**/familyLocalBackup.drill.js' --json \
  --outputFile=<private-evidence>/t8-local-artifact-drill-index-fixed.json
```

1. 源库中两条合成传输记录包含相同 UUID/不同 actor、不同 remote ID、引用代次、ObjectId、Long、
   Binary 和 Date；不是产品 schema/授权/终态有效性样本。核对 canonical BSON 和完整索引定义。
2. 使用真实 `mongodump --oplog --archive`、tar 和 `mongorestore --oplogReplay`，目标库开始为空。
   核对媒体样本及嵌套日志样本的字节。日志明确标记 `validDeletionEvidence:false`，不冒充删除凭证。
3. 恢复后两种唯一约束均实际拒绝重复写入；原合成记录不变。缺失日志归档及等长损坏的媒体归档
   均被完整性断言拒绝。真实损坏数据库归档、不可创建 dump 输出分别退出 1，恢复库不变。
4. 第一轮 3 passed/1 failed：误以为目录作为 dump 目标会失败，实际创建 `archive` 并退出 0。
   保留原断言和失败证据，改为普通文件下的子路径，真实触发不可创建目标，不用 mock 代替工具退出。
5. 第二轮 1 passed/3 failed：索引列表枚举顺序不同，字段/数据一致。仅排序索引列表外层，保留
   复合 key 顺序和全部 options；新增缺失、unique 变化及复合 key 反序反例。第三轮 5 passed/0 failed。

首三轮结果及代码摘要（原始日志和目录保留本机，不复制环境身份到公开记录）：

| 原件 | SHA-256 |
| --- | --- |
| t8-local-artifact-drill-first.json | `0fe2a2831a7a90ba48ce562151bc9efc59084b9fffff9571d561c4fd86a2a166` |
| t8-local-artifact-drill-fixed.json | `ab693b22a8d2ce980de838a2ed94a3d92f754b4f4ad758a54b26da5ad858d68c` |
| t8-local-artifact-drill-index-fixed.json | `7ae8bf8cf4bd6ed58859ee2cfe9b7f33b1105b0385c6689f97f4d8b24395957a` |
| familyLocalBackup.drill.js（第三轮历史候选） | `aeca6f45a686b2e75044c89119d4f8bd7e9322abd71db66366149f43418bf8a7` |

前三轮收尾均记录 instancesStopped=true，保留目录当时合计 du 分配量 8324 KiB；这是本机合成证据，
不计作服务器预算证明，也未删除历史对象。报告只写执行结束，是否通过以 Jest 实际退出和断言为准。

独立审查随后发现两项收尾 P2：旧代码未处理 MongoMemoryReplSet.stop() 返回 false，且启动 Promise
未结束时 afterAll 可能提前报告停止。前三轮正常路径记录不能证明这些故障路径；不覆盖原结果。
修复仅增加测试夹具 lifecycle：先持有实例再启动，跟踪启动/连接 Promise，最终收尾设置取消标志，
等待启动结束并禁止迟到连接和采集；stop 非 true 保留实例归属、拒绝启动下一实例，最终失败不写停止成功。
7 项永久反例从 7 failed 到 7 passed；首次反例编写还触发未消费断言 Promise 的进程退出，修正测试的
结果捕获方式后取得完整红灯 JSON，不把该次进程错误当作完整反例报告。

修复后的真实用例第四轮 5 passed/0 failed（5.128 秒），dump/恢复/两类 tar 命令均 exit 0，
损坏恢复与错误 dump 目标均 exit 1，最终实例停止记录为 true。该轮目录分配量 2872 KiB，
四轮合计 11196 KiB，未清理。新 fixture 单测进入原 common 测试范围；真实工具 drill 仍仅显式执行。
独立复核重跑 7 项 lifecycle 测试通过，并补查 6 项纯内存失败/取消场景；两项代码缺陷可关闭，
未发现新增可复现 P1/P2。pending 等待仍依赖底层启动/连接最终结束；永久挂起或外部强杀时不能
保证收尾完成或报告落盘，不声明这些未测试的故障已被覆盖。独立复核没有启动真实实例。

| 修复后原件/候选 | SHA-256 |
| --- | --- |
| t8-drill-lifecycle-red.json | `cd7eabc4a4f767d342ab468223a3ded3411298ee4e2c0ca6405cc648a1be843c` |
| t8-drill-lifecycle-green.json | `67363fb65c31a706e1a29d17c50c7c7808093e7342ed8e4da9a19198f28337ab` |
| t8-local-artifact-drill-final.json | `dec33425b8ce74bdc78626ae56fd2f9e0d52af129680ee24073f6cdb5208b463` |
| familyLocalBackup.drill.js | `29cc09237539af552ef1e0908b139d2d9b9aec4c24711011ecbfa1301408181f` |
| localBackupDrillLifecycle.js | `a81e15a33e2d0b41606cb5d84cbc8d31ca8933584fcf098f1038f8cd5d3690e6` |
| localBackupDrillLifecycle.test.js | `29e1277d7216d2e2062fd70573a8d2c2a0ce659f84ffcd143f15eecbcc5b512f` |
| t8-local-drill-final-regression.json | `e6a8eff5e6ab396f2949d8add33a723778281f5db2e3b9c24e212c42820a7a17` |

最后相关回归：沿用上节 Node22/Jest 命令，runTestsByPath 选择 familyBackupPreflight、
familyDocumentationGate 和 localBackupDrillLifecycle 三个 test.js，3 suites/388 tests 通过，
0 failed/0 skipped（33.943 秒）。本次新文件 ESLint、最终文档状态校验与 git diff --check 通过。
本轮没有重跑全部家庭业务/前端测试，未修改业务实现，不将上一批全量结果移作本轮执行结果。

未验证：Restic 加密/上传及上传失败传播、NAS/异机恢复、Ubuntu MongoDB 6.0.28 兼容、
正式应用恢复后的原命令/权限/发星、最新删除证据重放、产品 RPO/RTO。本机少量合成样本的计时
不是实际恢复业务可用所需时间，不提供 RPO/RTO 承诺。T8 总门禁保持 OPEN。

## 本机正式应用恢复验收

用户后续授权本机恢复结果接入既有正式应用验收，删除恢复若依赖后置能力只报告具体阻断。
本节更新上一节“正式应用恢复尚未验证”的限定状态，不覆盖原轮结果或扩大为全部恢复完成。
范围仅本机合成数据；无服务器、NAS、真实孩子数据、安装、Git 或部署操作。

### 执行与验证范围

沿用本机既有 Node22、MongoDB 8.0.10、Database Tools 100.12.1、tar；禁用 Mongo 自动下载。
显式运行，不加入默认真实工具 CI，不要求新测试框架：

```sh
NODE_PATH=<existing-dependencies> MONGOMS_RUNTIME_DOWNLOAD=false MONGOMS_VERSION=8.0.10 \
T8_MONGOD_BINARY=<existing-mongod> T8_MONGODUMP_BINARY=<existing-mongodump> \
T8_MONGORESTORE_BINARY=<existing-mongorestore> T8_TAR_BINARY=<existing-tar> \
<node22> <existing-dependencies>/jest/bin/jest.js \
  --config=backend/jest.family-common.config.js --runInBand \
  --testMatch '**/familyProductRestore.drill.js' --silent --json \
  --outputFile=<private-evidence>/t8-product-restore-reviewed.json
```

- 真实 Gateway、homework、resource、progress 正式应用工厂，真实 HTTP/provider/事务；enabled、
  cleanup=false，合成独立凭据、私有目录、上传保护和原启动预检均保留。没有 stub 成功结果。
- 测试内签发真实 JWT；user-service 未启动，登录/PIN、浏览器及真机不在本轮范围。四个工厂共用
  同一临时 Mongo 连接；不是独立 OS 服务/容器重启或生产部署。仅注入一次真实 commit 成功后丢响应。
- 源库明确创建模型和索引、真实上传三张不同图片，生成已确认作品和 PREPUBLISH/远程 COMMITTED
  未决命令；关闭 HTTP 后真实 dump，停止源实例，再启动全新空副本集 restore。文件归档均校验摘要。
- 目标库不运行自动建表/索引修复；canonical BSON 与完整索引字符串相等，预检及装配不改数据库。
  索引列表只按名称排序外层，保留复合 key 顺序。三张不同图片按 mediaId 比对正文，防止互换漏检。
- 六组场景覆盖已确认作品/反馈回看、confirmed 修改 409、只读 pending 发现、同 UUID 不同 actor
  终态隔离、持久 remoteOperationId 恢复、完整绑定代次和引用集合、旧审核版本 409、共管首次审核
  与账本单条幂等、匿名/过期/兄弟姐妹/跨家庭拒绝，以及恢复后的实时成员撤销。
- 正常 DELETE 后旧签名和访问接口 404，原教学和奖励不变；严格删除恢复检查只读、扫描 complete，
  精确返回 `LEGACY_USER_DELETION_EVIDENCE_INSUFFICIENT`，维护模式工厂读取返回 503。

### 失败与修订

| 轮次 | 实际结果 | 原因与处理 |
| --- | --- | --- |
| first | 0 passed / 6 failed | fault wrapper 用挂载后的 req.path 未命中；改 originalUrl，保留严格 503、错误码、单次丢响应和持久状态断言 |
| path-fixed | 0 passed / 6 failed | 同步 spawnSync 恢复停在索引阶段，30 秒 SIGTERM 后仍等待；仅对已核实自有工具 PID SIGKILL，保留 ETIMEDOUT/日志及收尾 |
| async | 4 passed / 2 failed | 异步工具恢复完成；测试默认 select:false 漏取绑定，撤权媒体误预期 404；改 native 读取和现有精确 403 契约 |
| contract-fixed | 6 passed / 0 failed | 9.036 秒；尚未包含最后补强及独立复核修订 |
| final（历史文件名） | 6 passed / 0 failed | 包含完整引用和 confirmed 只读补强；独立审查随后发现三项夹具缺口，不当作最终关闭证据 |
| reviewed | 6 passed / 0 failed | 9.310 秒；当前候选，三项夹具修订及不同内容图片均已接入 |

同步工具阻塞 Node 事件循环、不能持续消费自有 mongod 管道是第二轮等待的排查依据；改异步后真实
恢复在原预算内完成，不增加超时、降低断言或修改业务。30 秒工具截止改为 SIGKILL，只作用于本次
直接创建的子进程。原失败中手工精准停止的事实保留，不声称该轮自动截止有效。

独立审查发现三项 P2：工具结果晚于报告、并发 HTTP 关闭提前返回、Jest 对象比较漏掉复合索引 key 顺序。
只增加约 50 行测试辅助文件，不改变生产程序：工具登记自有 child 与完整记录 Promise，最终等待回调与
日志记录；HTTP 关闭共用 Promise，失败不可转成后续空 Map 的成功；索引使用 canonical EJSON 字符串。
7 项永久反例 6 failed/1 passed → 7 passed，涵盖延迟回调、取消失败、记录失败、并发/失败/正常关闭，
以及索引枚举顺序、缺失、unique 和复合 key 顺序。辅助反例进入既有 common Jest 范围。

### 候选与证据摘要

原始数据库、媒体、日志、私有 JSON/输出保留本机临时证据目录；公开索引不记录用户名、主机地址或
签名访问链接。`result.json` 是命令和收尾记录，不是测试通过判定；通过以 Jest 退出码与断言为准。

| 原件/候选 | SHA-256 |
| --- | --- |
| familyProductRestore.drill.js | `fcf58d0d1372c7fe11e3b5b0a8749afbb931d612c16c522cceb1a56f04e1fe02` |
| localProductRestoreSupport.js | `e24a4ba8cf1ea2c58ec22a860b4a5090f318550ae6933a7a2fd31931fea43d75` |
| localProductRestoreSupport.test.js | `3ca74f544f0e30f048b7b2b2473591c622da47d26e0cfcddc5d360fc154b765b` |
| t8-product-restore-first.json | `d509b8822cb457c74d97c21a8ed7de75b38a9304a0892eb9d5e3d32fd220bcde` |
| t8-product-restore-path-fixed.json | `bf5546e63244f5232aea76df40abe6e33fcffb00ea0a33865fadbe8ff84fe102` |
| t8-product-restore-async.json | `06542691547880ce8e5b30c1c8eb90537b97b56d073542680cc8aa96307a1871` |
| t8-product-restore-contract-fixed.json | `d1a9e4a72f8d8a1ac1ee3cec284a755c50d197d5c193260f08de659037e72784` |
| t8-product-restore-final.json | `6bbf0613d6e9e49093791fbf376cc660cbe2acb4163982394cca622704abb8a0` |
| t8-product-support-red.json | `89fa3bbf20d38177d48e7ca8ada0213bf5e38df036162e6ef4343f8333c11998` |
| t8-product-support-green.json | `2394b9e7bf39cc8a4fafe150096c2fb60b2fc701d4d8a226601131ffa46ce667` |
| t8-product-restore-reviewed.json | `893ee9dbbe0da83617145c21ff53aec925fad062505cb1d28448df2d9e531a74` |
| t8-product-restore-reviewed.log | `104410908b6ad7675072f688780a6bf0cf7f749a24ec4d6f968076f2c89407e1` |
| reviewed / result.json | `4cb59b50b5d8ada53b101ea01b076f4733b49fbb615432050183ca583e9accec` |
| reviewed / manifest.json | `3ff5b578ab942e83072ee85e448b224fcb95e2c05881e23f902d6c2302b89529` |
| t8-product-final-regression.json | `1eee6f412bfbc6d095aa16304b263f8572ac3c1427b204bf1ee26ada62f76f27` |

本批独立复核完成：重新运行 support 7 项永久反例和文档门禁，退出 0；核对三份源码及红绿/最终
JSON 共 11 项当时摘要全部匹配，未发现新增可复现 P1/P2，三项 fixture P2 关闭。独立复核没有
重跑真实 Mongo/HTTP drill；6/6 为开发实跑并经独立审阅的原始证据，不称为独立真实环境重验。
独立 7 项重跑及文档检查仅保留在独立线程工具输出，未单独落盘；上表 green JSON 属于开发自测，
不冒充独立重跑归档，独立输出没有可提供的文件哈希。
最后相关回归选择 familyBackupPreflight、familyDocumentationGate、localBackupDrillLifecycle、
localProductRestoreSupport 四套件：395 passed/0 failed/0 skipped，29.363 秒。新增三文件 ESLint、
文档状态校验和 git diff --check 通过。没有重跑全家庭或前端回归，业务源码未修改。

最终 result.json 的六次工具命令均 exit 0；instancesStopped/httpClosed/toolsStopped 均为 true。
收尾后只读进程核对未发现本批 mongod、工具或 Jest 残留。此前五轮原件未清理，不声称所有历史轮次
都具有当前修复后的收尾保护。永久挂起、OS 拒绝 kill 或外部强杀不在本批正常及替身验证结论内。

### 删除恢复阻断与未验收范围

正式 resource 装配只有 v1 删除日志，没有接入 v2 recoveryJournal；v1 缺少完整远程终态与 UploadGuard
恢复证据。正常 enabled 历史兼容与严格备份恢复是两个不同门槛。本批**未**将删除前快照重新开放，
未执行后置恢复 writer；只验证现状会被独立严格检查拒绝，不声称已有自动恢复编排能强制隔离。
TC-SL-PRIVACY-005、D2b 剩余、D3/D4/E 和新孤儿回收继续后置或阻断，不据此关闭。

仍待验证：NAS/Restic 加密上传和上传失败传播、异机/Ubuntu MongoDB 6.0.28 兼容、最新删除日志重放、
实际登录/PIN与浏览器/真机、生产 RPO/RTO。T8 OPEN、T4 OPEN、DEVICE_PENDING、历史失败、
Docker INCOMPLETE_FAILED、两项非阻断补测及 REMAINDER_DEFERRED 均保留。

## 本地交付验收与范围清单

2026-10-30 用户要求“先验收并整理当前 T8 本地交付”。本轮仅整理已有实现、证据与记录，
不新增业务或高级恢复；本地技术验收不等于 T8 总门禁关闭、服务器执行或 Git 授权。

### 完整候选范围

基线 HEAD 为 `9593d2890147c41eb3e4e87d07db16196ec760c0`。以下 16 个文件加本节配套
`delivery-manifest.json` 构成本地待交付包；manifest 记录逐文件 SHA-256，自身不递归列入。
没有业务服务实现、前端、Compose、依赖锁文件、AI/K12 或真实环境配置修改。

| 分组 | 文件（仓库相对路径） |
| --- | --- |
| 只读前置检查 | `scripts/check-family-backup.js`；`backend/common/deployment/__tests__/familyBackupPreflight.test.js` |
| 显式本机演练 | `backend/common/deployment/fixtures/familyLocalBackup.drill.js`；`backend/common/deployment/fixtures/familyProductRestore.drill.js` |
| 演练收尾与反例 | `backend/common/deployment/fixtures/localBackupDrillLifecycle.js`；`backend/common/deployment/fixtures/localProductRestoreSupport.js`；`backend/common/deployment/__tests__/localBackupDrillLifecycle.test.js`；`backend/common/deployment/__tests__/localProductRestoreSupport.test.js` |
| 既有文档门禁 | `scripts/check-family-docs.js`；`backend/common/deployment/__tests__/familyDocumentationGate.test.js` |
| 说明及状态 | `docs/deployment/local-ubuntu-deployment.md`；`docs/architecture/family-self-directed-learning-system-design.md`；`docs/development/README.md`；`docs/development/family-self-directed-learning-mvp-gate.md`；`docs/superpowers/plans/2026-10-21-family-self-directed-learning-mvp.md`；本 README |

### 验收边界

| 项目 | 本地验收依据 | 不包含 |
| --- | --- | --- |
| 只读检查 | 原 75 项反例、独立复核、真实 CLI 替身与文档契约 | 真实 NAS、停写锁或备份采集 |
| 合成归档 | 已冻结 5 项真实工具结果及 lifecycle 7 项反例 | Ubuntu 或产品删除凭证恢复 |
| 正式应用恢复 | 已冻结 6 项真实 HTTP 结果、完整集合与权限、support 7 项反例 | user-service 登录/PIN、浏览器、真机及独立 OS 服务启停 |
| 删除恢复 | 精确阻断 `LEGACY_USER_DELETION_EVIDENCE_INSUFFICIENT` 已验证并登记 | 删除前快照重新开放或后置 v2 writer |
| 状态记录 | T7 合并事实与 T8 本地授权一致，历史状态分段保留 | T4/T8 关闭、T9 启动或真实部署 |

本轮按现有摘要核对 33 项源码/原始结果，均匹配；其中一份“第三轮历史候选”源码摘要仅保留为
历史标识，不拿当前文件替代该旧源码。相同 result.json 摘要可能出现在多轮，最终收尾必须与
reviewed 的 manifest.json 同目录绑定，不能单凭相同摘要推断轮次。
本轮仅校正文档导航中仍称 T7 待合并的过时现状，不重写旧批准或失败记录。

### 本地归档与后续交付

原始结果和本轮校验输出复制到 Git 已忽略的 `release-gate-artifacts/t8-local-acceptance-20261030/`，
目录 0700、文件 0600。原件不移走、不覆盖；公开候选只带源码、摘要及说明，不带原始结果、数据库、
媒体、签名链接、主机路径或受保护配置。归档中的采集清单记录私有来源与副本哈希，摘要核对后才计入。
这只是同机证据归档，不是 NAS/异机备份；临时 Mongo 数据目录和媒体原件仍在原处，没有清理。
独立 7 项复核的工具输出没有独立文件，继续明确标注，不用开发日志代替。

后续提交前须重新核对本 manifest 与实际文件、敏感信息和 Git 差异；源码变化后按影响面重验。
本批未创建提交、分支、PR，未推送、合并或部署。T8/T4 OPEN、DEVICE_PENDING、历史失败、
Docker INCOMPLETE_FAILED、T5-NB-001/002 OPEN_NONBLOCKING、REMAINDER_DEFERRED 与 T9 NOT_STARTED 保留。

### 本轮验收结论

本地技术交付验收通过：既有代码、冻结结果和当前边界一致；未发现需要重开本批实现的问题。
文档轻量独立复核通过（只读范围/状态核验，没有重复运行真实演练）；归档与 manifest 由主线程实查，
不冒充独立复核在文件生成前已验证这些操作。

- 本轮重新执行上述四个 Jest 套件：4 suites / 395 passed / 0 failed / 0 skipped，退出 0，36.259 秒。
  结果 `t8-local-acceptance-regression.json` SHA-256：`9dd90f6259d28e3c29bca4b129e8ad2f2381a563651725ccde582d29f3e60fe9`。
- 10 个 JS 实现/测试文件定向 ESLint、文档状态检查和 diff 检查通过；最终 6 份文档的 246 个本地链接目标存在。
  本轮不宣称重跑全仓、业务或浏览器回归；既有两类真实演练源码哈希未变，采用原始结果核验。
- 当前 16 文件增量扫描未发现私钥块、常见真实 token/JWT 字面量或已知本机/服务器身份；结合范围审查，
  没有真实凭据或孩子数据进入候选。此项不是通用安全扫描，也不是未来公开推送的自动授权。
- 原始结果及本轮日志共 29 份、2625598 bytes 复制并逐份哈希相等，0700/0600 权限和 Git 忽略已核实。
  私有 `archive-index.json` SHA-256：`eec05a6193e1860f7a82c1ea2eba2f421106f4c4acda47916604a69f36aa5097`。
  首次归档因父目录不存在而 ENOENT，尚未复制任何文件；补建专用父目录后完成，不删除或覆盖原件。

该结论只接受当前本地准备和合成证据交付，不能解释为用户批准关闭 T8 或已解决删除恢复阻断。

### 专用分支与 PR 授权

用户随后明确授权提交推送至专用分支、创建 PR、检查 CI；范围为本批 17 文件，不合并、不部署。
当前 `delivery-manifest.json` 随授权记录刷新，Git 状态为 BRANCH_PR_ONLY / NO_MERGE / NO_DEPLOY。
原本地验收版本 manifest SHA-256 `e33209c785c853837dbac8b99dce878ed9e460a72c66029b496302a7e3792ffa`
及对应 17 文件保留在忽略归档的 `pre-git-candidate/`，不覆盖已冻结字节。此前不提交文字仅说明当时边界。
本次仅文档授权状态和相应状态校验/反例更新；检查入口、演练和收尾实现不变，原证据不冒称新 CI 结果。
原始证据和私有归档不公开提交，T8 总门禁 OPEN 与全部未验收/后置范围继续保留。
