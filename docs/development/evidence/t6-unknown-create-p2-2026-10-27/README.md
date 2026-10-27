# T6 孩子无 ID 未知创建 P2 修订与评审

状态：READY_FOR_REVIEW；T6 IN_PROGRESS / OPEN。仅本地合成，不提交、推送、合并或部署。

## 范围与候选

原候选为 [T6 工程冻结记录](../t6-engineering-2026-10-27/README.md)，原补丁 SHA-256
`b7a0ab2e674f82c8e8a2ea41ea54a5c0354453dfda213bd8e3335caa616f50c0`。
本次是增量修订，不覆盖原冻结文件或历史失败；新 [candidate.patch](./candidate.patch) 相对于该候选，
[validation.json](./validation.json) 记录逐文件前后哈希、补丁和本轮归档证据哈希。

本轮仅调整 ChildMistakesPage、前端永久反例、既有正式 HTTP/浏览器测试及相关设计/门禁。
未改变后端 API、数据库、来源鉴权、创建幂等契约或高级恢复范围。

## 修订与自查

1. 原 P2：无 ID 未知创建后关闭表单，旧列表不重读且新建重新可用。新增显式列表 GET，失败不解锁，成功后明确人工核对，不自动 POST。
2. 提交前保存按家庭/孩子隔离的 sessionStorage 单一未知位，不存私有正文、媒体、token 或原命令。关闭表单/刷新/同标签重登与切回保留标记；其他身份看不到旧内容。已知成功或明确拒绝才自动清除，失权仅清理视图。
3. 页面存储不可用时不发送创建。提交响应迟到，即使同孩子重新登录，也不能清除新会话保护。原 resourceId 恢复和 retainSubmitted 保持。
4. 自查发现首次列表替换实现会重置旧行草稿和未知 PATCH 锁，先补反例见红后改为仅合入新发现的行。旧行只能由其原详情重读解除未知锁。
5. 有过滤和分页的列表不是未提交证明；人工结束核对不会重发原请求。标签关闭/存储清除/跨设备的无 ID 持久恢复不在本次范围，不宣称全局幂等。
6. Parfit 非作者静态复核指出同身份迟到列表会重新加入读取期间刚掌握的旧行。永久反例复现 1 failed / 31 passed；合并同时排除读取开始时已有 ID 和当前 ID，避免恢复已移除的旧行。

## 验证证据

- 原实现永久反例：4 failed / 23 passed，分别覆盖关闭+失败读取、重挂载/切换迟到响应、403、跨孩子响应。
- 首个修订前端全量：52 suites / 674 tests passed；自查补强反例：1 failed / 30 passed，保留红灯。
- 自查草稿补强后的前端全量：52 suites / 675 tests passed；构建成功。追加迟到列表反例后最终结果见下面检查点。新增总计 9 个永久案例，原断言未删除或放宽。
- 正式来源 HTTP：5/5，通过实际 Gateway 与业务服务证明丢失 POST 响应后原记录能由 GET 发现、兄弟隔离和重复 GET 零写。
- 浏览器首轮：1 failed / 3 passed。失败为既有运行时拒绝 GET 故障注入 `T2_INVALID_FAULT`，非产品失败；改用浏览器网络中断，无 mock 成功响应或运行时扩容，修订轮 4/4 通过。
- 最终构建浏览器及完整正式 HTTP 结果见 validation.json 和下面最终检查点；不复用早期构建冒称最终验证。

最终检查点：完整前端 52 suites / 676 tests passed，构建成功；完整正式 HTTP 5 suites / 27 tests passed；
最终构建的 T6 Chromium 4/4 passed（26.6 秒）；文档状态检查通过，状态门禁定向
1 suite / 183 tests passed；受影响四文件 lint 和 diff 检查通过。原 675 项与早期浏览器结果均作为中间检查点保留。

作者自查完成；Parfit 非作者最终静态复核确认 `existingIds` 在 await 前捕获、只合入新增行、身份及 scope 校验未削弱，
在本次修订范围内无新增具体发现。该复核未运行重复测试，不冒称独立运行证据；本文件所有最终执行计数均为主线程实测。
实现与测试已提交本地复评，未代替用户批准关闭 P2 或 T6。

正式 HTTP/页面使用真实 Gateway、user、homework、resource、progress、analytics、notification、临时 Mongo 副本集和临时媒体。
POST 丢响应由现有合成代理注入，GET 断网由 Playwright route.abort 注入；组件测试 mock API。
浏览器验证含上传图片、POST 成功丢响应、关闭、GET 断网、刷新、真实退出/兄弟登录/原孩子重登、人工核对、单 POST 和绑定附件保留。
Browser plugin not available；复用仓库 Playwright，不新增测试框架。Chromium 不代表 WebKit 或真实 iPad。

## 复验命令

使用 Node 22.15.0 和现有依赖，前端命令在 frontend/web 下执行。

```sh
CI=true /usr/local/bin/node node_modules/react-scripts/scripts/test.js --watchAll=false --testPathIgnorePatterns=src/__tests__/legacy --runInBand
CI=true /usr/local/bin/node node_modules/react-scripts/scripts/build.js
/usr/local/bin/node node_modules/jest/bin/jest.js --config=backend/tests/t2/jest.config.js --runInBand
T2_WEB_BUILD="$PWD/frontend/web/build" /usr/local/bin/node node_modules/@playwright/test/cli.js test --config=playwright.t2.config.js tests/e2e/t2/learningSources.spec.js
/usr/local/bin/node scripts/check-family-docs.js
git diff --check
```

原始证据归档在忽略目录 `release-gate-artifacts/t6-unknown-create-p2-2026-10-27/`，不把本地日志误当公开提交内容。
历史家庭全量失败、Docker INCOMPLETE_FAILED、DEVICE_PENDING、两项 T5 非阻断补测和高级恢复/新回收 REMAINDER_DEFERRED 均保持。
不重跑未改变的完整后端历史套件，不宣称本轮全仓发布门禁通过；T6 总门禁不提前关闭。
