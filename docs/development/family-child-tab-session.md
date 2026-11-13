# 孩子端标签页会话隔离

## 当前交付状态（2026-11-13）

方案二及 `QA-CHILD-TABS-LOGIN-001` 已通过独立复评；该 P2 在本固定候选的本地合成工程验证范围内 **CLOSED**。用户随后授权提交、推送及合并，CI 与合并状态以对应 PR 的固定 SHA 记录为准，不将授权等同于 CI 已通过。

完整受评候选为基线 `a383eb3054b28cdfec914e716ebfe786b5b449da` 加 33 文件补丁，SHA-256：`5049f316842844af7bfeaa48795bd6227352c062ad1d2d6d566cd929b4d6c8e6`。交付仅增加当前关闭说明及脱敏证据索引，业务/测试文件与该候选相同。见[独立复评与历史证据索引](evidence/child-tab-session-20261113/README.md)。

下文的“待复评 / OPEN / 不提交”等是各开发批次当时的历史状态，不覆盖本节的最新授权和限定关闭结果。原始冻结补丁与日志保留于本地，公开文档不含本机临时目录。当前真人实例未升级，新功能真人接续、iPad 及其他总门禁不因此通过；T4/T8/AI-1 OPEN、SERVER_TIMING_UNVERIFIED、DEVICE_PENDING、Docker INCOMPLETE_FAILED、非阻断补测及后置状态保持。

## 范围与决定

- 2026-11-12：用户认可方案二，限定本地实现；独立评审与真人接续验收待完成。
- 基线：`a383eb3054b28cdfec914e716ebfe786b5b449da`。现有真人测试实例不替换、不重启。
- 孩子凭据与本页身份变更原因移至 `sessionStorage`；家长仍使用原 `localStorage` 会话。
- 新独立标签页不继承共享孩子凭据；刷新本页可继续。复制标签页/有 opener 的新页可能复制初始会话，不承诺浏览器配置文件级安全隔离。
- 登录页已有身份时提供“继续使用”和“切换孩子”，不自动跳转；顶部显示姓名和切换入口。切换须提示本地草稿清理，再退出原身份，由目标孩子重新 PIN 登录。
- 不提供免 PIN 账号切换，不保存多份孩子凭据，不新增后端接口/数据库模型。

## 安全与兼容

- 跨标签不广播新凭据，不自动换成其他孩子。显式退出/切换仅广播原 actor 的退出标记；相同孩子的其他标签页清理并要求重登，不影响不同孩子或家长。
- 孩子会话绑定登录时的退出标记；挂起页恢复、发送前及响应后复核，不能仅依赖 `storage` 事件到达。
- 过期仅失效当前会话，保留既定原命令恢复语义；显式退出按已有规则清原 actor 的完成/AI 命令及私有视图，不代表取消服务端持久意图。反思等未知写入保护仍按各模块既有规则保留，不以换号解除。
- 旧共享孩子凭据丢弃，不自动迁移；要求重登，不删除服务端记录，也不以迁移为由丢弃未知命令。新会话存储失败不得退回共享存储或继续发业务请求。
- 迟到成功/401、同 actor 重登、原命令恢复、私有图片清理及服务端家庭/孩子权限保持有效。
- 回滚仅撤回本批前端修改并重新构建；不做数据迁移。新旧存储不互相自动恢复凭据，回滚后要求孩子重新登录。

## 验证计划与状态

1. 永久反例：独立标签不继承、另一孩子登录不覆盖、同孩子退出标记清理/漏事件拒绝、不同孩子不受影响、旧共享会话不升级、存储失败关闭。
2. 组件：已登录入口可选择、显式切换提示和取消、重新 PIN、顶部身份；保留原迟到响应、命令和媒体隔离断言。
3. 共享层受影响测试及前端完整回归、构建；调整旧共享会话测试的前提，不放宽业务断言。
4. 独立合成正式 HTTP/浏览器双标签验证，使用现有 T2 服务工厂；不得操作正在进行真人测试的实例。
5. 完成开发自查后交测试/评审线程复评。自动验证不替代真人/iPad 验收。

## 开发验证记录（2026-11-12）

状态：本地实现、开发验证及自查完成；独立复评待进行，不关闭任何工程总门禁或真人验收项。
开发工作树为历史检出；已核实本批全部已有变更文件的基线与 `a383eb30` 一致，测试在该固定提交的独立归档副本加本批增量上运行，未复制其他旧页面或覆盖其他线程内容。

本轮证据与冻结交接包：`CHILD-TABS-DEV-20261112`（本地留存，目录不公开）。原始日志仅留本地，不能据此声称已独立复评或已公开归档。

| 开发验证 | 结果与记录 |
| --- | --- |
| 新会话永久反例红灯 | 原实现 11 失败 / 1 通过，`red-session.log` |
| 新 UI 永久反例红灯 | 修正测试 Router 配置后的 3 项功能失败，`red-switch-valid.log`；更早的 Router 警告失败另保留，不算功能红灯 |
| 新会话/UI 定向验证 | 2 套件 / 15 项通过，`green-new.log` |
| 前端完整默认回归 | 首轮 1 失败 / 73 通过套件、2 失败 / 1199 通过测试；命令计数改为精确命令键并保留正文和清除断言后，74 套件 / 1201 项通过，`frontend-full-r1.log`、`frontend-full-r2.log` |
| 构建及 lint | `build-final.log`、`lint-final.log`、`lint-final-completion.log`，退出 0；保留既有 Browserslist 数据陈旧提示，没有升级依赖或放宽规则 |
| 正式 HTTP + Chromium 完成/求助/订正恢复 | `browser-r3.log` 28 项通过；最终增加另一孩子不影响原未知提交的用例，`browser-sibling-final.log` 1 项通过；分批，不写成同一次 29 项 |
| 原 Task11 安全浏览器回归 | `task11-security.log` 3 项通过：兄弟姐妹及家长权限、真实 PIN 重置过期提示、360px 布局；保留既有 CRA 弃用提示 |
| WebKit 标签页专项 | `webkit-final.log` 3 项通过：双孩子与家长并存/复制窗口提示、未知提交不受另一孩子登录退出影响、同孩子退出隔离迟到媒体响应；不是 iPad 真机 |
| 视觉与源码一致性 | 桌面 1280、平板宽度 768、手机宽度 360 截图及无横向溢出断言；29 个源码/测试文件与实际验证副本逐文件一致 |

主要命令（在上述固定副本内、现有 Node 22 与依赖下执行）：

```sh
# frontend/web 目录；CI=true
node node_modules/react-scripts/bin/react-scripts.js test --watchAll=false --runInBand --testPathIgnorePatterns=src/__tests__/legacy
node node_modules/react-scripts/bin/react-scripts.js build
# 仓库根目录；T2_WEB_BUILD 指向该副本构建，Mongo 仅使用既有本机二进制，禁止运行时下载
node node_modules/@playwright/test/cli.js test --config=playwright.t2.config.js tests/e2e/t2/completion.spec.js tests/e2e/t2/help.spec.js tests/e2e/t2/ai2FormalRecovery.spec.js
node node_modules/@playwright/test/cli.js test --config=playwright.t2.config.js tests/e2e/t2/completion.spec.js --grep 'another child tab login'
node node_modules/@playwright/test/cli.js test --config=playwright.config.js tests/e2e/task11/family-growth-security.spec.js --reporter=list
node node_modules/@playwright/test/cli.js test --config=playwright.t2.config.js --browser=webkit tests/e2e/t2/completion.spec.js --grep 'one browser keeps|another child tab login|same-child logout'
```

### 自查与失败保留

- 孩子凭据和本页身份原因均按标签隔离；家长共享存储不变。共享退出标记绑定原 actor，发送前/响应后仍校验快照；漏掉 storage 事件也拒绝旧身份。
- 保留取消切换、存储抛错/静默写失败、同孩子新登录、损坏命令清理、未知结果保留、迟到成功/401 等断言。未修改后端接口、权限、持久命令或奖励逻辑。
- 原会话 API、媒体和草稿测试迁移存储夹具，原跨标签“自动换号”场景改为同孩子显式退出，保留私有内容、Blob 和迟到响应拒绝断言；不同孩子不受影响另有永久用例。
- 浏览器首轮在 Chromium MachPort 沙箱权限处失败并中断，保留 `browser-completion-r1.log`；改用受控本机执行上下文，不修改浏览器/业务断言。
- `browser-completion-r2.log` 保留 14 通过 / 1 失败：过期 JWT 夹具仍写旧共享存储。修正为按角色选存储，并要求夹具真实存在，未取消 401/重登/原 UUID 断言。
- 新增未知提交专项的两轮 Chromium 和一轮 WebKit 失败均保留：版本号原已可见，且重试入口在发送中暂时消失，二者都不能证明响应结束。最终等待真实 PATCH 200、正文版本及原命令清除，沿用原超时，无业务修改。不得将这些失败改写为一次全绿。
- 正式验证使用本机合成数据、真实用户/Gateway/任务/资源/进度工厂和既有 analytics/notification 应用。失效响应/丢响应为受控故障注入；新回收与真实模型关闭。Browser 插件不可用，复用项目 Playwright；未安装依赖。
- 本轮测试子进程已退出；原真人实例未替换或重启。独立复评、真人接续与 iPad 验证交测试/评审线程，不能把本开发验证记作独立结果。

保留历史失败、分批验证、T4/T8/AI-1 OPEN、SERVER_TIMING_UNVERIFIED、DEVICE_PENDING、Docker INCOMPLETE_FAILED、非阻断补测及后置范围。不调用真实模型、不操作服务器、不提交推送或部署。

## 在途 PIN 响应修订（2026-11-13）

问题 `QA-CHILD-TABS-LOGIN-001`：独立复评在匿名标签页收到同孩子退出前已签发、退出后才释放的 PIN 200 响应时，仍恢复身份。原组件 1 失败 / 3 对照通过；Chromium、WebKit 各 1 项真实 HTTP 反例失败。原 1201 项通过不覆盖此竞态，不替代本问题验收。

### 核实、聚焦方案与实施前自审

- 已核对原候选补丁 `db70f52bd281c3188df4a698581b35d9d925938d23ba8444a88aadb36977b5f3` 及独立反例。匿名页登录前后会话均为 null，退出事件按当前 actor 过滤，而保存响应时使用最新退出标记，故原 attempt/会话检查不足。
- 发起登录时绑定请求目标 childId/familyId 和共享退出标记；只规范化 ObjectId 大小写，不将其他孩子或家长的变更当成本次取消。成功、失败响应处理均先核对原 attempt/会话，再核对原标记。保存不得用最新标记重新包装旧响应。
- 读取标记失败必须显式拒绝，不复用将异常当 null 的通用存储读取器。响应身份须与请求目标一致；保存期间失效不得返回成功。新发起的 PIN 登录可绑定退出后的标记，不改变 PIN、家庭隔离或后端接口。
- 自审结论：范围限于现有会话工具和孩子 Context，复用现有测试及浏览器工厂；不新增框架。原命令清理/未知恢复政策和私有媒体生命周期不修改。回滚撤回本次前端修订即可，无数据迁移；原缺陷会重新出现，不能将回滚当作验收。
- 永久反例包含：事件到达/遗漏后的旧 200 拒绝、旧 401 不覆盖当前状态、其他 actor 不受影响、退出后新 PIN 可用、迟到成功/401 不替换较新同 actor 会话、标记读取失败。浏览器沿用真实已签发 200 的保持/释放屏障和原预算，不用等待时间替代处理完成。
- 状态：实施前方案自审通过，授权范围内继续本地修订；问题仍 OPEN，须以新候选提交独立复评。保留原失败归档，不替换/重启/清理当前真人实例，不关闭任何总门禁。

### 实施与开发自查

- 生产改动仅 `familySession.js` 和 `ChildAuthContext.js`。登录发起、响应处理及保存使用同一目标 actor/家庭/退出标记；保存前后复核，期间失效仅撤回本次序列化凭据，不能清除较新身份或主动取消未知命令。
- 标记读取失败有独立错误，不当作无标记；同孩子退出提示重新输入 PIN，旧请求的 401 不覆盖退出原因。保留原 attempt 与会话快照检查，新登录后旧成功/401 均不得污染新状态。
- 匿名页对旧 actor 的存储事件仍执行既有读取/清理，但不再用旧退出/过期元数据取消目标为另一孩子的 PIN 请求。已有身份的退出通知、本页显式退出和过期反馈不变。
- 新增 `ChildLoginRace.test.js` 17 项永久反例/对照及 `childLoginRace.spec.js` 两项正式 HTTP 浏览器用例。自查中依次补出旧 actor 的“显式退出”和“过期”残留反例，均先红后修，未放宽测试。
- 既有双孩子浏览器用例的合成任务由 UTC 日期落在北京时间前一天，导致“今天的任务”断言失败；只在该用例准备阶段通过原正式 API 对齐时区日期，保留区域、行、隐私、刷新、切换与零错误断言及原超时。不修改日期业务或共享种子。
- 本次增量为 6 文件：上述 2 个生产文件、2 个新增测试文件、既有 `completion.spec.js` 的日期夹具，以及本记录；完整交付继续包含原候选，不遗漏先前方案二实现。

### 本轮证据与验收边界

开发证据包：`CHILD-TABS-P2-DEV-20261113`（本地留存，目录不公开）。完整补丁、逐文件及证据哈希、相对旧候选的变更清单和补丁重建校验见该包 `freeze/manifest.json`；冻结本身不代表独立复评通过。固定基线仍为 `a383eb30`，未改动历史工作树其他旧文件。

| 分批开发验证 | 结果 / 证据 |
| --- | --- |
| 旧实现红灯 | `red-valid.json`：10 失败 / 5 对照通过；更早 `red.json` 含 3 项 React 测试装配时序错误，仅保留历史，不冒充功能反例 |
| 自查残留 actor 反例 | `selfreview-last-actor-red.json`：1 失败 / 15 通过；`selfreview-expired-actor-red.json`：1 失败 / 16 通过；均在预期身份断言失败 |
| 最终受影响回归 | `affected-final-r2.json`：25 套件 / 385 项通过，0 skipped；涵盖孩子页面、API、会话、未知命令、私有媒体及相关家长调用方，不称为全仓回归 |
| 最终构建 / lint | `build-final-r2.log`、`lint-final-r2.log`：退出 0；首轮 `build.log`/`lint.log` 的 no-ex-assign 失败保留，已改用局部错误变量，未放宽规则 |
| Chromium 最终专项 | `chromium-r2.json`：7 项通过；`chromium.json` 原 6 通过 / 1 日期夹具失败保留；中间通过的候选记录不覆盖最终源码证据 |
| WebKit 最终专项 | `webkit-r2.json`：7 项通过，0 skipped / flaky；先前候选 7 项通过仍保留为分批历史；不是 iPad 真机 |
| 原独立失败证据 | 121 项逐文件与 manifest 校验不变；manifest SHA-256 为 `88d8809a79cd79424e6a1faffcaa30ae21b5be8f1d6b0ab480c02a94c88b1ff6` |

自查确认：不新增后端接口/Schema/常驻服务，不将匿名事件过滤当作登录授权；最终接受仍需原目标标记和原 attempt/会话检查。原命令/媒体政策未改，测试使用真实用户、Gateway、任务、资源和进度应用及临时合成库；保持/释放真实已签发 200 是故障注入，不是 mock 登录成功。当前真人实例不替换、不重启、不清理。

当前问题状态仍 **OPEN / 修订后待独立复评**。原完整 1201 项和双引擎各 29 项属于上一候选的独立证据，本次只声明以上实际执行的受影响范围，不混计、不改写为全量一次通过。复评与真人接续由测试/评审线程处理。

保留 T4/T8/AI-1 OPEN、SERVER_TIMING_UNVERIFIED、DEVICE_PENDING、Docker INCOMPLETE_FAILED、历史失败、非阻断补测及后置范围。本轮不调用模型、不操作服务器/NAS、不安装、不提交推送合并或部署。
