# T8 恢复后的真实浏览器闭环

> 2026-11-04后续：[当前main复验及本地交付分组](../t8-closeout-20261104/README.md)。下文保留原候选、失败和独立复核边界；不以新结果覆盖。

日期：2026-11-03。状态：LOCAL_SYNTHETIC_BROWSER_VERIFIED / RELEASE_NOT_READY；T8 OPEN。
用户授权优先完成本机合成恢复后的真实页面验证，无需等待 NAS。本轮不改业务实现，不访问服务器、
NAS 或真实家庭数据，不调用模型，不提交推送或部署。基线 `4655d30f1b61b55f400b67f16f9143dd191de1d2`。
接续[认证恢复补验](../t8-nonnas-20261103/README.md)，保留该轮冻结候选及失败，不改写旧快照。

## 已验证的流程

1. 源合成家庭通过正式 API 创建作品及待恢复命令，注入远端 commit 成功后丢响应，记录本地
   PREPUBLISH、远端 COMMITTED 和原 actor/operationId/remoteOperationId。页面所需提醒默认设置
   也在源库通过正式 API 初始化，不能在恢复后豁免快照差异。
2. 停止源 HTTP，实际 mongodump/tar，停止源实例；新建空副本集，实际 mongorestore/tar 解包。
   比较全部集合 BSON 与索引，正式装配和重新登录不得修改该快照，然后才启动真实浏览器。
3. 孩子使用真实 PIN 登录、退出、重登，从页面发现并显式继续原命令。请求必须命中原 operationId，
   发布版本为 1，原 remoteOperationId/完整媒体 binding 保留，只有一个 operation、尚无发星账本。
4. 刷新读取作品，浏览器解码图片，并将实际读取的图片字节 SHA-256 与备份前字节比较。
   家长真实登录查看版本 1；孩子从页面修改为版本 2。家长确认旧版本收到真实 409，账本仍为空；
   页面展示新版本及正文后再次确认，实际请求版本必须为 `[1, 2]`。
5. 审核后核对首次共管家长 actor、反馈和单条账本。孩子刷新可回看版本 2、图片及反馈，
   不显示修改/提交完成按钮。教学完成状态只读不等于禁止既有隐私删除。
6. 同一浏览器上下文第二标签退出并登录另一孩子，第一标签私有内容消失。持有的真实媒体 200 响应
   随后释放；本次两引擎均记录 `fulfillment=resolved`、`browserOutcome=finished`，随后未见旧图。
   另一孩子访问原任务收到 403，刷新禁用，数据库快照不变。

最后一项只证明网络请求完成后检查未出现私有视图，不宣称 React 回调已经消费响应或不存在瞬时闪现。
若请求实际取消，夹具必须单独记录取消及原因，不能写成成功送达；该取消分支本轮未实跑覆盖。
原十项真实 HTTP 验收仍覆盖跨家庭、第三孩子、失效身份、PIN 重置、撤权、同 UUID 不同 actor、
重复确认、首次审计、正常隐私删除及删除恢复拒绝。浏览器本轮未验新文件选择/上传或隐私删除按钮。

## 实际装配与边界

- 使用当前前端生产构建、既有 Playwright 1.61.1 的 Chromium/WebKit；无 token 注入或成功 API mock。
  Gateway、user、homework、resource、progress、analytics、notification 七个正式应用工厂走真实 HTTP，
  enabled 协议及原索引/目录/凭据预检保留；共用本机同一临时 Mongo 连接，不冒充七个独立容器重启。
- 仅故障注入丢弃源阶段真实 commit 响应；迟到响应拦截也先 `route.fetch()` 获取真实上游 200。
- macOS arm64、Node 22.15.0、MongoDB 8.0.10、Database Tools 100.12.1、系统 tar；禁止下载依赖。
  实例和页面仅绑定回环，根目录 0700，归档证据 0600。浏览器结束后不保留可访问测试站点。
- 1024x768 触控布局及 768x1024 孩子回看截图检查通过，无横向溢出、页面非空、图片解码/摘要正确。
  WebKit 模拟不是 iPad Safari 真机验收，DEVICE_PENDING 保留。
- 新孤儿回收关闭；严格删除恢复继续返回 `LEGACY_USER_DELETION_EVIDENCE_INSUFFICIENT`，不开放
  删除前快照，不执行高级恢复 writer。少量样本耗时不是生产 RPO/RTO。

## 验证与失败历史

前端构建：`CI=true GENERATE_SOURCEMAP=false BUILD_PATH=<private-build> <node22> node_modules/react-scripts/scripts/build.js`
在 `frontend/web` 执行，退出 0；保留 caniuse-lite 数据过旧提示，未更新依赖。构建输入和产物摘要另存 manifest。

```sh
LOG_LEVEL=error NODE_PATH=<existing-dependencies> \
MONGOMS_RUNTIME_DOWNLOAD=false MONGOMS_VERSION=8.0.10 \
T8_MONGOD_BINARY=<existing-mongod> T8_MONGODUMP_BINARY=<existing-mongodump> \
T8_MONGORESTORE_BINARY=<existing-mongorestore> T8_TAR_BINARY=<existing-tar> \
T8_BROWSER_RESTORE=true T8_BROWSER_ENGINE=<chromium-or-webkit> T8_WEB_BUILD=<private-build> \
<node22> <existing-dependencies>/jest/bin/jest.js \
  --config=backend/jest.family-common.config.js --runInBand \
  --testMatch '**/familyProductRestore.drill.js' --json --outputFile=<private-evidence>/engine-reviewed.json
```

| 轮次 | 结果 | 解释 |
| --- | --- | --- |
| browser-first | 1 failed / 10 passed | 页面读取提醒时创建默认设置，完整快照断言拦截；修订源库初始化，不删除集合或放宽比较 |
| browser-settings / chromium-final | 各 11 passed | 较早阶段候选，后者增加绿色合成图片及真实字节 SHA 校验；不替代最终收尾修订 |
| webkit-final | 1 failed / 10 passed | pageerror 三条 access-control 请求错误；未忽略或改成通过 |
| webkit-diagnostic | 11 passed | 增加时序记录后通过，不凭重跑推断历史错误不存在；首轮确切根因未完全复现 |
| webkit-owned | 1 failed / 10 passed | 新等待误拒绝缓存 304，伴随延迟拒绝警告，属测试逻辑错误；改为等待 200/304 完整结束并立即挂接拒绝处理 |
| webkit-reviewed | 11 passed，0 skipped，17.928 秒 | 当前冻结候选，浏览器流程及原 10 HTTP 项 |
| chromium-reviewed | 11 passed，0 skipped，16.162 秒 | 同一候选，串行运行 |
| http-default | 10 passed，0 skipped，11.771 秒 | 不设置浏览器开关，原路径单独复验 |
| support-final | 11 passed，0 skipped | 包含 4 项新浏览器收尾永久反例 |

两引擎 `pageErrors=[]`、无 console warning；console error 仅放行指定任务路径的预期 409/403，
其余错误仍失败。原始记录有导航取消请求，不称“零网络取消”。登录后的三项首页读取现在等待
response.finished 后才导航，不放宽页面健康断言；保留 WebKit 偶发失败证据，不宣称长期稳定性已证明。
全部最终报告 browser/owner/tools/HTTP/Mongo 收尾成功；默认关闭路径不启动浏览器。

最终四文件 ESLint、`node scripts/check-family-docs.js`、`git diff --check` 通过；文档与收尾定向
`--runTestsByPath` 执行 familyBackupPreflight、familyDocumentationGate、localBackupDrillLifecycle、
localProductRestoreSupport，共 4 suites / 406 passed、0 failed/0 skipped，39.423 秒。
未重跑完整 release、所有家庭后端或全部前端组件；前端源码未变，本轮使用重新构建产物真实浏览器验证。

## 自查与独立复核

独立只读审阅提出两项 P2，已修订并复核通过：

- 迟到响应未知错误不得吞掉；区分上游响应、fulfill、网络完成/取消，准确限制证据结论。
- 浏览器增加外层 owner，60 秒触发关闭并等待 helper；launch/字节 fetch/route fetch 分别限 10/5/10 秒。
  `afterAll` 先停止浏览器工作再停止工具、HTTP 和 Mongo。四项永久反例覆盖截止关闭并等待清理、
  取消后迟到 attach、超时不得报告成功、关闭失败传播。60 秒不是全部收尾必定完成的承诺。

reviewer `01a1a053-1466-7043-845c-48edf391230f` 核对四文件及上述原始报告，认为两项 P2 可关闭、
未发现新增 P1/P2。该复核未独立启动实例或运行测试；实跑均为本线程开发验证，不冒称独立浏览器复验。
本轮仅提交用户验收，不关闭 T8 或其他总门禁。

## 冻结与证据

本轮四文件相对上述 HEAD 的补丁含前序认证夹具增量，完整源码另存；不以其替代前序归档快照。
没有业务源码或前端源码变更；已有 AI-1 状态文档和前序归档工具修订保持原样。

| 对象 | SHA-256 |
| --- | --- |
| familyProductRestore.drill.js | `fb9edd398d9b8301a1a743bf19ee1c5b376684a9fccc68f595a5b5b82f96683b` |
| localProductRestoreBrowser.js | `f34661eb9a1d9ecd8b3a1fa4c540adbc3a1323cbdd55114014b86ab00f3af9f1` |
| localProductRestoreSupport.js | `3a14e1f7c10bf7870600e5bff0ead469def1451962954cf236d217488b06a12c` |
| localProductRestoreSupport.test.js | `f9d8caf78f57b7e3525d45da5c256bde3066b1bc1d7471320ee0ed6596bbf49a` |
| candidate.patch | `e5cf63ebf2fadab9e35c6e335e33b54fcb617297a734c5857d0f4257a1eb1642` |
| chromium-reviewed.json | `89eec544bd75c76de7832a8336d7e257e247b419e0eea91fd4d7077b4e95ff64` |
| webkit-reviewed.json | `75bc711fd64468d6bf9b1718b81180e6b4c09d5facc5ca45a6e612f32f0bb04e` |
| http-default.json | `14f78481874d39fefb16b075263c2b9d5d4140c22271965df27888fe3f2b1756` |
| support-final.json | `7e28b255611b2a3bb50aab596f83eda73d924d8c84eaf91fcd1722569810d89a` |
| web-build-manifest.json | `347ac927d05248dc6d7a3ddf4334db2dab1de00ca10f13755aa4d6f6db030554` |
| final-targeted.json（随后单独归档） | `2b51fed4d44d4ab4aa159be370a31ad16c7c554d6e51da8e3e10183ee2ed46e7` |

原始检出的 Git 忽略目录 `release-gate-artifacts/t8-browser-20261103/` 保存 126 件、3480523 bytes：
源码、补丁、逐轮 JSON、工具日志、备份 manifest、截图及构建摘要，不复制 DB 或媒体正文到公开目录。
私有 archive-index.json SHA-256 `ec1996bbbbf7e55da123dfa48c09900a32dcc5008b8157497db0d775cae2bc6a`。
同机证据副本不是异机备份；后续文档验证单独追加，不覆盖这份清单。

## 剩余发布条件

本机恢复后的登录、原命令提交、版本审核与回看已补齐；尚待：目标 Ubuntu/资源预算及独立服务重启、
NAS/Restic 真实上传及失败传播、异机恢复、删除证据安全恢复、约定数据量 RPO/RTO、停写/回滚、
真实 iPad 和人工验收。详细边界沿用[剩余发布条件](../t8-nonnas-20261103/README.md#剩余发布条件)。
T4/T8/AI-1 OPEN、DEVICE_PENDING、历史失败、Docker INCOMPLETE_FAILED、T5-NB-001/002
OPEN_NONBLOCKING、高级恢复与新回收 REMAINDER_DEFERRED、T9 NOT_STARTED 不变。
