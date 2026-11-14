# 孩子专属入口 + PIN：限定本地工程候选

日期：2026-11-13；验收更新：2026-11-14。当前状态：**ACCEPTED / USER_APPROVED / LOCAL_SYNTHETIC_ONLY**。

## 2026-11-14 用户验收与专用分支交付

用户批准本批“专属入口 + PIN”工程验收，关闭 P2-UNMOUNT 与 P2-SETTLEMENT 两项测试保护缺口，并授权专用分支提交推送、Draft PR 和 CI。批准绑定原 28 文件候选，补丁 SHA-256 `16ec823756df48834d52ca11cf5366758c38aadb3f5f2a746f4a9d20e8d4cd4b`，原 manifest SHA-256 `bb7da8cbd90dd218fadaaf6ee120a8c22eb914a2d4899265fcd0dafb46a2caca`，以及下列独立报告及分批证据。

本轮通过 GitHub PR #45 查询及 `git fetch origin main` 核实 merge SHA `0ec8b746ef5a549bbae57c3f0289e6dec342556d`；其文件树与原实现基线 `f8073fcd52bc4d2b4b2c94b0a3e292d171d8d600` 均为 `2b0dc1a343d56bf6f92acc5ada6f0f9aeaa3d28d`。原“本地无法解析”是获取提交前的真实快照，保留不删。专用分支从当前 origin/main 建立，不修改原 main 或覆盖任何更新。

原 `candidate.patch` 与 `manifest.json` 冻结内容不重生成；当前验收记录是获批后的文档增量，当前交付哈希另见 `delivery.json`。下文“待验收／未提交”等均为批准前快照，不覆盖本节权限；不把开发实跑或本次批准改写为全量一次通过。

本次不授权合并、更新真人入口、模型调用、服务器操作或部署。T4/T8/AI-1 OPEN、SERVER_TIMING_UNVERIFIED、DEVICE_PENDING、Docker INCOMPLETE_FAILED、历史失败、非阻断补测及后置范围不变。

## 原候选与验证快照

## 范围与授权

用户已批准方案 A、最小设计、测试方案及未提交 PIN 归属的设计 P2 关闭，并授权限定本地实现。本记录不代替用户工程验收，不提交、推送、合并或部署，不改变真人测试实例。

已核实实现基线 `f8073fcd52bc4d2b4b2c94b0a3e292d171d8d600`。原设计引用的 PR #45/main 标签 `0ec8b746ef5a549bbae57c3f0289e6dec342556d` 在当前本地对象库无法解析；本批不声明两树等同或 GitHub 最新状态，也不据此拉取/切换分支。冻结补丁以实际 HEAD 重建，独立复评同样绑定此 HEAD。候选包含家长孩子行入口、孩子 PIN 页、窄 Context 请求归属检查、入口解析、样式、相关测试与文档；无后端、会话存储、原命令模型或 WP1/T8 执行器变更。

家长可打开/复制当前孩子的同源专属入口，孩子仅输入 PIN；通用入口保留显式手工表单。不同已登录孩子必须明确切换并重新输入 PIN；取消、入口变化和旧响应不能清除原命令或污染新身份。书签重登通过原 actor 显式恢复同一完成命令，不自动恢复、不换 UUID。

## 验证分批记录

| 分项 | 结果与性质 |
| --- | --- |
| 开发前端默认回归，最终组件候选 | 77 套件 / 1251 项通过，退出 0；包含全部默认前端调用方、原会话/媒体/命令反例。不是全仓历史回归。 |
| 孩子后端原相关套件 | `children.test.js` 1 套件 / 10 项通过，退出 0；本批未修改后端。 |
| 构建 | `BUILD_PATH` 指向本轮临时目录，最终产品构建成功，退出 0。无持久预览服务。 |
| Chromium 相关真实 HTTP 浏览器 | 22 项通过，退出 0：新入口 4、原 PIN 竞态 2、原完成/恢复 16。后续仅导航就绪/测试收尾小修订另补新入口专项，不冒充该批原样执行。 |
| Chromium 最终新入口专项 | 导航就绪和测试收尾修订后 4 项通过，退出 0；与前一批 22 项重叠，不相加为 26 个不同用例。 |
| WebKit 首轮 | 21 通过 / 1 失败，退出 1。失败为新入口用例过早整页刷新，今日计划请求被中断并触发原零浏览器错误断言。原 18 项竞态/完成回归均通过。 |
| WebKit 导航修订后专项 | 新入口 4 项通过，退出 0；等待实际今日计划及待办数据就绪后再导航，零错误断言不放宽、不加超时/重试。与首轮 18 项合并覆盖，不称一次 22 项全绿。 |
| 组件保护移除验证 | 临时副本 5 类变异均被拦截，子测试退出 1，驱动退出 0；工作区源文件不替换。 |
| 浏览器保存前保护移除 | 临时构建仅移除 Context 保存前的意图检查，真实 HTTP 反例 1 项失败、退出 1，明确在旧 A 会话非空断言处拦截；不是超时或后续 B 登录偶然失败。 |
| 静态与文档检查 | 新服务工具和浏览器文件纳入现有 lint，规则不变；lint、文档门禁、`git diff --check` 均退出 0。最后归档另校验文件哈希与补丁重建。 |
| 独立复评 | 两个新增组件套件独立执行：2 套件 / 33 项通过，退出 0；独立静态复评及变异证据核验通过，未发现新增实质问题。开发浏览器结果不冒充独立重跑。 |

原始输出在本地忽略目录 `release-gate-artifacts/child-entry-20261113-local/` 归档，公开候选仅保存文件/日志摘要与脱敏索引，不包含凭据、截图或原始业务响应。冻结文件与[候选补丁](candidate.patch)哈希以本批 [manifest.json](manifest.json) 为准，后续交付需重新核对；当前未形成 Git 提交或 CI 结果。

### 实际复用入口

```sh
# PATH 以系统 Git 和既有 Node 22 为准；不安装依赖。
CI=true npm run test:ci --prefix frontend/web -- --runInBand
BUILD_PATH="$RUN/build" npm run build --prefix frontend/web
npm run lint
npm run test:family-regression -- --runTestsByPath backend/services/user-service/__tests__/routes/children.test.js
# 显式使用已有 Mongo 二进制并关闭下载；RUN 为本轮独立临时目录。
T2_WEB_BUILD="$RUN/build" T2_BROWSER_OUTPUT="$RUN/chromium-final" npm run test:t2:e2e -- tests/e2e/t2/childEntry.spec.js tests/e2e/t2/childLoginRace.spec.js tests/e2e/t2/completion.spec.js
T2_WEB_BUILD="$RUN/build" T2_BROWSER_OUTPUT="$RUN/webkit" npm run test:t2:e2e -- --browser=webkit tests/e2e/t2/childEntry.spec.js tests/e2e/t2/childLoginRace.spec.js tests/e2e/t2/completion.spec.js
T2_WEB_BUILD="$RUN/build" T2_BROWSER_OUTPUT="$RUN/webkit-final" npm run test:t2:e2e -- --browser=webkit tests/e2e/t2/childEntry.spec.js
T2_WEB_BUILD="$RUN/build" T2_BROWSER_OUTPUT="$RUN/chromium-reviewed" npm run test:t2:e2e -- tests/e2e/t2/childEntry.spec.js
npm run docs:family:check
git diff --check
```

两引擎使用原 `playwright.t2.config.js`：workers=1、retries=0、test=120000ms、expect=10000ms、action=15000ms。浏览器逐批串行；同一 BrowserContext 下的不同孩子标签页，不用不同 Context 冒充隔离。360/768/1280px 截图和溢出检查为浏览器模拟，不是 iPad 实测。

正式应用工厂与真实回环 HTTP 覆盖 Gateway、user、homework(enabled)、resource(enabled)、progress；既有 analytics/notification 应用接线与临时副本集合成库沿用原 runtime，不替换 PIN 或完成成功响应。媒体采用既有 trusted-local 测试 profile，不宣称 ClamAV 验收。通过路由保持真实已签发响应、原远端丢响应注入验证恢复；组件层 API/Context 替身与浏览器实跑明确分开。

## 自查、评审与历史失败

- 设计 P2 已获用户批准关闭；工程批次仍待验收。第 7 节原设计快照和旧候选哈希保持，不改写为已实现。
- 自查发现 StrictMode 模拟卸载后意图重新绑定但提交闭包未刷新，首个 PIN 输入被丢弃。已修复生命周期重新绑定，增加首次输入成功永久正例；首轮 1 失败 / 94 通过保留。
- 独立首轮复评发现两项 P2 测试保护缺口，未确认产品逻辑缺陷：卸载被先行 ABA 掩盖、浏览器响应断言可能早于客户端处理。现独立覆盖卸载的 200/401；浏览器等待真实 XHR loadend 后下一任务，先断言旧身份未保存再登录 B。不用任意 sleep 或产品测试 hook。
- 组件变异分别移除 PIN 清理、发送前意图检查、保存前检查、不同身份分支及卸载失效；发送前变异需同时移除页面和 Context 两层相同检查，不谎称单层移除也必然红灯。卸载变异同时去掉 mounted 与意图失效，两个旧响应均被新反例拦截。
- 保留最初测试夹具缺 Router future flags 的失败、实施前真实行为红灯、家长组件未实现的 missing module、后端首次 EPERM（0 测试执行）、Chromium 首轮遗漏手工展开步骤（21 通过 / 1 失败），以及 WebKit 首轮失败。原测试仅增加显式手工导航，不删除原断言。
- 新文件接入现有 lint 后发现 `finally` 内 throw，被原规则拦截；已将重抛置于收尾之外，路由等待与错误传播保留，不放宽规则。记录初次文档检查因本索引尚未创建而失败，不将中途检查写为全绿。
- 最终基线自查发现原设计的 main 标签无法在本地解析，已收窄当前基线声明，不覆盖历史引用或把缓存引用冒充 GitHub 实时状态。该文档校正不改变已测代码、测试和独立复评基线；Git 交付前仍需核对届时真实 main。

### 独立复评回执

独立评审者在修订后的候选上实际运行 `ChildEntry.test.js`（21 项）和 `ChildEntryActions.test.js`（12 项），共 2 套件 / 33 项通过，退出 0；运行前后源码哈希一致。随后对导航与 ESLint 小修订另做静态复核，并读取开发侧浏览器日志与变异构建的 source map。

复评确认：两项 P2 测试保护缺口已解决，未发现新的实质问题。卸载反例在不改变 Provider/目标/attempt 的情况下有效；浏览器保存前检查单处移除后，客户端处理屏障已通过而匿名断言失败，B 的新请求尚未发出。保留首轮发现，不改写成一次通过。

- 最终独立报告 SHA-256：`6c36b6b0b78856968caed9f05b7a688b6fd7917471c2ea7a1f8fb9b6b09312bd`。
- 浏览器变异独立核验摘要 SHA-256：`7e5f7fabc07149398f7e5af66054b795989537df61289483f9f328e0adda9825`。
- 独立完整产物索引 SHA-256：`7b821b061ae0a0be06ce1deccafc788fb5d9ece9f794644d7d7fe123e1bf9d8a`。

原始报告、独立日志、14 项产物索引及前版归档保存于本地忽略目录的 `independent/`。独立浏览器未重跑，独立工作不冒充前端全量或后端全量；本批工程验收与问题最终关闭仍提交用户确认，不关闭现有总门禁。

## 待验收与保留边界

用户验收后再决定 Git 交付及真人入口升级；测试/评审线程继续自己的真人测试，本线程不重启、替换或清理其服务和数据。iPad 保存书签/主屏幕、系统复制、触控与真人易用性仍待验。

家长 localStorage 会话仍在同浏览器共享；新开孩子标签页不等于共享设备的家长权限隔离，交给孩子前仍应退出家长。专属链接只是定位不是凭据；相同 PIN 下用户主动选错链接的风险通过家长命名书签与使用验收处理，本批不新增账号体系。

T4/T8/AI-1 OPEN、SERVER_TIMING_UNVERIFIED、DEVICE_PENDING、Docker INCOMPLETE_FAILED、历史失败、非阻断补测及后置范围保持。不调用真实模型、不操作服务器/NAS、不扩展执行器，不关闭既有总门禁。撤回本前端增量仍可手工登录，PR #44 标签页保护、后端权限和原命令记录不撤回。
