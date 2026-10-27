# T6 普通重新加载拒绝优先 P2 修订

状态：READY_FOR_REVIEW；T6 IN_PROGRESS / OPEN。仅本地合成验证，不提交、推送、合并或部署。

## 发现与修订

前一冻结候选见 [未知创建 P2 记录](../t6-unknown-create-p2-2026-10-27/README.md)，补丁 SHA-256
`8581711eb4bf106a6a284f6387f123ed07574e368201cec9a48c1b75faabaa4d`。
后续独立复审的临时反例为 1 failed / 32 passed：显式列表重读后，普通重新加载的 403 被 manualList 提前返回吞掉。
该失败不因原 676 项前端测试和浏览器 4/4 通过而消失，原冻结补丁、记录和证据不覆盖。

本次仅更改 ChildMistakesPage 的资源 effect：

1. 先检查当前身份；过期会话回调不执行视图更新。
2. 当前身份下的拒绝优先调用 clearPrivate，清理私有行、表单、来源和按钮，并使迟到回调失效。
3. 仅对普通成功数据使用 manualList 限制；保留旧行对象、草稿及未知 PATCH 锁，不恢复全列表替换。

未知创建标记不因拒绝而删除，重新挂载后仍要求读取核对；无自动 POST、无自动删除媒体。
不改变 API、数据库、服务凭据、共享会话层、后端恢复或回收范围。

## 永久反例

在既有 T6LearningSources.test.js 中增加两条，不新建测试框架：

- 初始列表 503，未知创建后显式重读成功，再由普通“重新加载数据”得到 403；断言私有错题、新建和人工解锁入口全部清理，POST 总数仍为 1，媒体未删除。
- 显式恢复后，普通重新加载与另一次显式读取并发；先返回 403，再放行显式读取成功；断言旧内容、新内容和人工解锁入口都不能恢复，重新挂载后未知标记仍保留。

永久用例在旧实现上真实运行结果为 2 failed / 32 passed；见本轮红灯归档。
既有失败保锁、账号切换、旧行草稿、未知 PATCH 锁和读取期间掌握旧行的反例全部保留。

## 验证与自查

| 项目 | 本轮结果 |
| --- | --- |
| 永久反例旧实现红灯 | 2 failed / 32 passed |
| 前端完整回归 | 52 suites / 678 tests passed |
| 生产构建 | 成功；保留既有 Browserslist 数据过期提示，未更新依赖 |
| 最终构建 T6 Chromium | 4/4 passed，29.5 秒 |
| 文档状态门禁 | 1 suite / 183 tests passed |
| 文档检查、两文件 lint、diff 检查 | 通过 |

自查结论：当前拒绝在 manualList 之前处理；clearPrivate 的 denied 标记使显式读取的迟到成功回调失效；
普通成功数据仍受 manualList 限制。旧行草稿、未知 PATCH 锁、账号切换和人工核对标记的原断言全部保留并通过。
未发现本次修订引入的新问题。此结论为开发自查，不冒称新的独立复评或用户关闭批准。
新增两条拒绝时序在组件层验证；浏览器四项复验既有真实闭环，不冒称浏览器已新增这两条故障时序。

实际验证命令（Node 22.15.0，前端命令在 frontend/web 执行）：

```sh
CI=true /usr/local/bin/node node_modules/react-scripts/scripts/test.js --watchAll=false --runInBand --testPathIgnorePatterns=src/__tests__/legacy
CI=true /usr/local/bin/node node_modules/react-scripts/scripts/build.js
T2_WEB_BUILD="$PWD/frontend/web/build" /usr/local/bin/node node_modules/@playwright/test/cli.js test --config=playwright.t2.config.js tests/e2e/t2/learningSources.spec.js
/usr/local/bin/node scripts/check-family-docs.js
git diff --check
```

复用既有依赖安装，未新增依赖；组件测试 mock API，浏览器使用真实七服务、临时数据库和合成媒体。
本次没有修改后端，不将此前 HTTP 27 项或家庭后端全量当成本轮重跑结果。
测试与自查不是独立复评批准，问题仍提交复评，不提前关闭 T6。

增量补丁和文件/证据哈希分别见 [candidate.patch](./candidate.patch)、[validation.json](./validation.json)。
原始日志归档于忽略目录 `release-gate-artifacts/t6-reload-denied-p2-2026-10-27/`。
保留历史失败、Docker INCOMPLETE_FAILED、DEVICE_PENDING、T5-NB-001/002 OPEN_NONBLOCKING、
高级恢复与新回收 REMAINDER_DEFERRED；无真机、真实服务器、Git 写入或部署。
