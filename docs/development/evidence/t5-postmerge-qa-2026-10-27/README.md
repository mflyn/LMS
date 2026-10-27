# T5 合并后独立 QA 修订交接

## 状态与范围

- 候选：工作区 HEAD `d28a30c0199428f5d193fe97cb1747e37934f780` 上的未提交增量；
  HEAD tree 与合并 main `557eb23d24937a099bee0e426514a384874199b9` 一致。
- 原独立 QA 使用 `3858093e3cd0bbf7bb26ccf3157cf1f072638168`；与当前 HEAD 仅五份 AI/K12 文档不同。
- 2026-10-27 复审通过并获用户批准：LINK-001 CLOSED；PAGEERROR-002 CLOSED / TEST_NAVIGATION_ONLY；异常收尾 P2 CLOSED。关闭依据见末节，不声称原生引擎问题消失。
- 不提交、推送、合并、部署；T6 不启动。保留历史失败、DEVICE_PENDING、两项非阻断补测及后置范围。
- 以下开发、候选及检查清单保留批准前快照；其 OPEN / 待复评描述不覆盖末节的当前批准状态。

## 核实、方案及自查顺序

开发过程记录在独立开发证据目录 `t5-p2-dev-20261027/INVESTIGATION.md`。
两项均先核实并记录聚焦方案及自查，再改测试；没有改生产代码、CORS、凭据、超时、重试或资源预算。

1. LINK-001：两个合法入口共存。新增各区域唯一且精确 href 的断言，保留旧点击在 Chromium/
   WebKit 各得到 strict-mode 红灯；之后只将点击限定到“今天的任务”。
2. PAGEERROR-002：partial-body 的 hard/SPA/正常完成三个诊断均通过，不作为关闭证据。
   原业务用例加事件诊断也通过，但未发出日计划请求，不能覆盖原失败。
3. 持有真实替换文档响应，在旧文档调用真实日计划刷新处理器，复现相同 pageerror；
   此前正常读取和 UI 对照成功，错误阶段没有新 API ingress。首次诊断把合法 304 误判为失败，
   修正诊断对照并增加 UI 已接受计划断言，原失败仍保留。
4. [Playwright 官方问题 #43120](https://github.com/microsoft/playwright/issues/43120) 的成员分析与该机制一致；
   外部记录只作机制佐证，不代替本项目运行证据，也不证明已安装引擎存在修复。
5. 业务导航改为点击现有“家长导航 / 任务”链接，校验唯一、href 和到达 URL；
   保留原登录、刷新、重登、焦点、媒体、账本、权限及零错误断言。pageerror 记录完整消息，未过滤。
6. 新永久用例使用真实 Gateway 响应，分别在响应 pending 和已完成时导航；旧 helper 两项均因
   文档身份丢失而失败，修订后均通过。验证没有文档替换、迟到响应不恢复旧视图、返回今日页和
   reload 可重读、数据库/文件快照无变化（不是数据库命令级零写审计）。请求拦截仅延迟真实响应，不制造成功响应。
7. 独立静态复核 Zeno（`01a17c13-134e-7091-b61c-da9bee422a08`）确认上述边界，但发现
   新测试 finally 中 unroute/attach 抛错会跳过 stop。修复前永久注入反例 3 failed / 1 passed，
   修复后 4 passed：三步收尾全部尝试、逐步 await、AggregateError 保留全部错误。
   同步等待用例单独对移除 await 的临时副本做变异验证，生产和当前候选文件未改为变异版本。
8. 收尾修复后的 WebKit 全套出现新的真实失败：43 passed / 1 failed，清单求助投影用例的
   childErrors 含孩子资料、today 任务和提醒三个 native access-control 错误；原日志和四文件
   源码快照保留，不能沿用前一候选 40 passed 声称最终通过。
   同一清单文件两个孩子业务入口改走已有“今日计划 / 其他待办”链接；原任务固定历史日期
   不变，第一次误选精确今天列表的定位失败也保留。准确入口下保留旧硬跳转产生文档身份红灯，
   再改为 click；保留唯一性、href、URL、文档身份和全部原业务断言。专门的直接访问/越权用例未变。

独立静态复审已确认：收尾 P2 已按其发现修复，最新孩子导航未发现新增 P1/P2/P3。
这是 Zeno 的只读代码/证据审查，不是独立运行浏览器或 Ubuntu 验收；其完整返回记录随开发归档保存。

边界：新用例证明实际 SPA 导航与正常 reload；不宣称覆盖任意硬跳转期间旧文档新请求。
该原生 WebKit 失败保留为诊断反例，独立 QA 必须显式判断是否接受测试导航修订，不能静默降级关闭。

## 验证与候选归档

本轮使用 Node 22.15.0、仓库 Playwright 1.61.1、Mac Chromium/WebKit，正式应用工厂、
临时 Mongo 副本集/存储、合成数据和新构建 `/tmp/lms-t5-p2-current-build`。
不是 Ubuntu 同限额独立验收，不是 Safari 真机；未重建或改动真实服务器。

运行入口沿用 `playwright.t2.config.js`，诊断配置只指定绝对 testDir、输出目录及 browserName；
workers=1、retries=0、test=120000、expect=10000、action=15000 均未改变。
原 38 个用例全部保留，新加 2 个导航和 4 个收尾用例；最新同一测试源码的完整回归：
WebKit `full-webkit-r2` 44 passed，Chromium `full-chromium-final` 44 passed，均退出 0，
没有 skipped、flaky 或 unexpected。收尾修复前两引擎各 40 passed、收尾修复后 WebKit
`full-webkit-final` 43 passed / 1 failed 保留为前一候选，不以新结果覆盖原失败。

实际完整运行命令形态为：

```sh
T2_WEB_BUILD=/tmp/lms-t5-p2-current-build \
T2_BROWSER_OUTPUT=<本轮独立输出目录> T5_DEV_ENGINE=webkit \
node node_modules/@playwright/test/cli.js test \
  --config=/tmp/t5-p2-current.config.cjs --reporter=list,json
```

Chromium 使用 `T5_DEV_ENGINE=chromium`。实际 Node 可执行文件为 `/usr/local/bin/node`，
每轮完整命令、时间和退出码在 `development/<run>/run.json`，JSON/list 报告及配置一起归档。
受影响测试 ESLint、`node scripts/check-family-docs.js`、`git diff --check` 和新增文件空白检查通过。
未改生产源码，不将之前的全后端/组件结果冒称本轮重跑；本轮没有新增后端或组件代码。

已完成：链接反例两引擎红灯；定位修订后 Chromium 原完整业务用例 1 passed；
WebKit 同一轮在原零错误断言失败并保留（`link-green-webkit` 是运行目录名，不表示通过）；
导航永久反例 WebKit 2 failed → 2 passed；受影响四文件 ESLint 与 `git diff --check` 通过。
构建成功，保留已有 Browserslist 版本提示与测试进程 NO_COLOR/FORCE_COLOR 提示，不冒充页面错误。
另保留初始 grep 未选中用例、诊断 304 误判、孩子入口匹配错误及沙箱 WebKit 启动失败记录；
它们分别属于运行配置/诊断问题，不伪装成业务反例或产品通过。沙箱启动失败和首次构建只有
当时工具输出及过程记录，其余完整命令/退出码/日志均在开发归档，不重建不存在的原日志。

最终补丁/文件哈希、原始完整日志、诊断脚本/事件和截图另归档到
`release-gate-artifacts/t5-postmerge-qa-2026-10-27-r1/`，不覆盖原独立 QA 413 份证据。
`candidate.json` 绑定补丁及六份文件哈希；`validation-summary.json` 区分所有完整批次，
`original-qa-verification.json` 核验原 413 份证据；`archive-manifest.json` 记录归档文件的字节数和哈希。
本文件和 Gate 由独立复评核对后才能追加关闭记录，开发自查不等于独立批准。

## 独立复评清单（批准前快照）

1. 核对候选补丁/文件 SHA256、基线以及实际 diff；对照原独立失败报告。
2. 审阅两个入口和业务导航的改动是否保留原意图；明确 PAGEERROR-002 的原生文档替换边界。
3. 固定候选运行原完整 38 项加新增 2 项导航/4 项收尾 Chromium/WebKit，原预算与零错误断言不变；
   在授权 Ubuntu 2 CPU / 3 GiB / 无 swap 隔离环境复验，不复用临时旧服务或真实数据。
4. 保留所有失败和收尾证据；无新的用户关闭批准前不关闭两项新 P2。
5. 8 项真机 DEVICE_PENDING、T5-NB-001/002 OPEN_NONBLOCKING、T7/T9、T8 及
   D01/T2-G/高级恢复/新回收 REMAINDER_DEFERRED 不随此修订关闭。

## 批准关闭与最终串行证据

2026-10-27，用户明确“复审通过”，批准关闭双入口定位、WebKit 测试导航及异常收尾问题。
当前 LINK-001、异常收尾 P2 均 CLOSED；PAGEERROR-002 为 CLOSED / TEST_NAVIGATION_ONLY。
门禁当前声明见 [Gate §25.9](../../family-self-directed-learning-mvp-gate.md#259-合并后-qa-修订复审通过与批准关闭2026-10-27)。
关闭仅接受真实 SPA 业务导航及正常刷新验证，不把 WebKit 原生硬文档替换限制写成已修复。

冻结测试基线为 `d28a30c0199428f5d193fe97cb1747e37934f780`，六文件补丁 SHA256 为
`dba6c4cf9cd14f30f5624c0281173e804aac06f1753885d5ffa5892d82bf2160`。
原候选、开发 428 项归档、原独立 QA 413 项归档不改写；本次两份批准后文档与原候选哈希不同是
明确的记录增量，四份测试源码保持冻结字节。原报告中的“关闭建议/未更新门禁”也是当时快照，
由本节记录后续用户批准，不回写原报告。

本线程已批准的串行归档根目录（375 项，与末节测试／评审线程的独立 R2 分别记账；不是 Git 提交或服务器部署路径）：

`/Users/linmingfeng/.codex/visualizations/2026/06/17/019ed5ee-e8a7-77d1-a482-f09f88decc2b/t5-independent-review-20261027-serial-r2/`

| 证据文件 | SHA256 |
| --- | --- |
| manifest.json（375 项，排除自身） | eca661748d6657414365eded37c6614b5f723d8ec3cd81c2bc97bd1e12cfcc32 |
| REVIEW.md | bb88914afd36f10341745dd016ab072ef427cd30af01ac914ac67b0fb8140c2d |
| verification-summary.json | d67eee6c1dad6eddf8801d50ad3040fcaed694426a4bfe05aae153eea3128df9 |
| server-reports/serial-isolation-verification.json | 6469c63f1116771b3587b6157d805e2c33d14439654290275450132f1924a744 |

| 最终串行复验 | 结果 |
| --- | --- |
| WebKit 完整 T2–T5 | 44 passed；原 38 无缺失，新增导航 2 + 收尾 4 |
| Chromium 完整 T2–T5 | 44 passed；原 38 无缺失，新增导航 2 + 收尾 4 |
| 原健康脚本，两引擎前后各一次 | 4/4 passed；Linux 平台及零警告/错误断言不变 |
| 桥接契约 | 两引擎均通过 |
| 收尾永久反例及独立去 await 变异 | 4 passed；变异按预期 exit 1，命中原等待断言，不累计为额外唯一覆盖数 |

实际命令、退出码、预算和原始报告在 `server-reports/browser-*-serial-r2/run.json`、
`results.json` 及对应日志；不使用无 serial-r2 后缀的首轮结果替代最终验收。
Ubuntu 服务为 Node 22.23.4、UID 1000、临时 Mongo 副本集，2 CPU / 3 GiB / swap 0；
workers=1、retries=0、test=120000、expect=10000、action=15000 未变。
Mac Chromium/WebKit 经 SSH 回环访问正式合成应用，不冒称 Linux 浏览器或真机验证。

### 失败、审计及授权边界

- 原 37/1 两套失败、开发 43/1、首轮并行 QA 和全部容器集合审计失败均保留；相邻
  `t5-independent-review-20261027-concurrent-r1/` 不能作为最终关闭依据。
- 用户授权协调后，另一批协调器 COMPLETE、客户端清理 PASS、线程确认不再启动测量；
  本轮八阶段前后均只存在原十个常驻服务，原 1764 文件及服务身份/配置/挂载一致。
- Docker 历史事件回溯仍为 **INCOMPLETE_FAILED**：返回历史不足以覆盖完整串行时段，
  不改绿、不删除其失败断言，不声称完整事件审计或独占主机性能基准。
- 另一 QA 线程 WebKit health-post 的 Bridge RPC timeout 保留在其原批次，不替其改判或拼接通过。
- 原生 WebKit 硬文档替换诊断限制、历史失败 PRESERVED、8 项 DEVICE_PENDING、
  T5-NB-001/002 OPEN_NONBLOCKING、T8_PENDING / NOT_AUTHORIZED、T7/T9 及
  D01/T2-G/高级恢复/新回收 REMAINDER_DEFERRED 不变；本次没有扩展测试或业务范围。
- 本次授权仅更新门禁与评审记录并做文档/状态校验，不沿用历史 Git 交付授权；
  不提交、推送、合并、部署，不启动 T6。本轮文档验证不冒称重新执行浏览器或服务器测试。

### 测试／评审线程最终独立 R2 补充绑定

2026-10-27，用户要求将独立结论同步给开发线程完成 T5 收尾。测试／评审线程
`019ed96b-6785-7492-bf22-9f7fd60fbfb5` 的最终结论为 **PASS_R2_LIMITED_ENGINEERING_SYNTHETIC**。
该线程在上述串行轮次结束且资源退出后，使用全新 QA 目录、同一冻结候选独立运行，
不是复用本线程运行结果；两份证据互相独立，不拼接或累加重叠覆盖数。

该线程独立 R2 冻结证据根（只读）：

`/Users/linmingfeng/.codex/visualizations/2026/06/18/019ed96b-6785-7492-bf22-9f7fd60fbfb5/t5-p2-followup-2026-10-27/r2/`

| 证据文件 | SHA256 |
| --- | --- |
| REPORT.md | bb43907f8520d2f28a1cce3d63aabac5c101cbbc0becfded92ad208023e0ff32 |
| verification.json | 13e3ea4bcbb7fa36ad12dc35d0ec5cb49ce5cf7cd8f64fc9386fd572d3d98b45 |
| manifest.json（325 项，排除自身） | 658a2b45d086a3d9cccae1d16a503184d81c01ff6be090b39ecb67cf0f062b92 |

实际独立 R2 结果：Chromium/WebKit 各 44/44，原 38 无缺失、新增导航 2/收尾 4，零失败、
跳过、flaky 或重试；原健康 4/4。两引擎各一项旧全页点击、两项旧 goto，共六项反例按预期
断言失败，非环境失败；原生机制独立见证复现且新 API ingress 为 0，仅证明保留限制，不表示引擎修复。
15 个阶段前/中/后守卫通过；实际 Node 22.23.4、Mongo 7.0.14 临时副本集、非 root、
2 CPU / 3 GiB / swap 0，原 120000/10000/15000、workers=1/retries=0 和零错误断言未改。
仍是 Mac Chromium/WebKit 经 SSH 回环访问 Ubuntu 正式合成服务，不是真机或 Linux 浏览器认证。

独立源快照仍为 1764 文件，sourceDigest
`b14a493cd9352a153049ec4860ba105a11372f449eee0199cca88d2a480abada`，基线/补丁与前节一致。
该线程已单独核对用户关闭批准、两份批准后文档增量和四份测试源码不变；本次再补证据引用也是
文档增量，不能冒称与原六文件候选哈希完全相同或参加过原冻结 Linux 测试。
其 `archive-quality.json` / `verification.json` 记录 252 份远程输入、287 份归档输入和
107 个 JSON 状态/计数/耗时指纹核验；本线程本次逐份核验 325 项归档及上述三个指定哈希一致。

该线程 R1 的 326 项冻结记录保持 NOT_ACCEPTED，桥接超时及并行负载记录保留。
R1 Bridge RPC timeout / 后探针 ECONNRESET 在其新 R2 未复现，不宣称准确根因已完全定位，
更不直接归因于并发。原 37/1、开发 43/1、413/428/326/375 项归档均不改绿；
本线程附加 Docker 历史审计继续 INCOMPLETE_FAILED，不被该线程 15 阶段守卫替换为完整事件审计。

该线程记录自身容器、两个 broker/浏览器、租约、正逆转发、私有配置、本轮 tmp 和专用 SSH
均已实际收尾，原十个服务身份/启动/镜像/挂载/配置及 HTTP 200、1764 源文件不变；
同步消息确认其自动化 `t5-p2` 已删除。本线程只记录事实，不重启服务器、SSH 或测试。
三项关闭状态和 ENGINEERING_SYNTHETIC_ONLY 范围不变；8 项 MANUAL_PENDING/DEVICE_PENDING、
T5-NB-001/002 OPEN_NONBLOCKING、T7/T8/T9 及高级恢复/新回收等后置边界保持，新恢复/回收继续关闭。
不提交、推送、合并、部署，不启动 T6，不操作真实数据、NAS、原 27017 或真实 cleanup/restore。

### 后续 Git 交付授权

用户于上述关闭记录完成后授权提交、推送和合并；执行边界见
[Gate §25.10](../../family-self-directed-learning-mvp-gate.md#2510-收尾-git-交付授权2026-10-27)。
本次只交付四份冻结测试源码及两份更新文档，不上传私有运行配置或临时媒体。
原证据、哈希与当时禁止 Git 的授权快照保持不变；交付增量不冒称参加过原冻结复验。
CI 通过后允许 merge commit 合并，仍不部署、不删除分支、不启动 T6。

交付前本地命令首次遗漏 `T2_WEB_BUILD`，40 项浏览器用例在创建运行环境前失败，
4 项独立收尾用例通过（exit 1）；这是本轮命令配置错误，不覆盖原独立 R2。
原输出保留于 `/tmp/lms-t2-browser-results`；补齐既有合成构建路径后使用独立
`/tmp/t5-closeout-delivery-chromium-20261027` 输出目录验证，未修改断言、预算或重试次数。
修正命令环境后的完整 Chromium 44/44 通过（3.9 分钟，exit 0）；受影响四文件 ESLint、
文档门禁和暂存差异检查通过，459 行初始暂存新增内容的凭据模式检查零命中。
这是合并前本机合成回归，不代替上文 Ubuntu 同限额独立验收，也不表示本轮重跑 WebKit。
