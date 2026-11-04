# AI2-4 草稿刷新 P2 修订

当前状态：AI2-4 ACCEPTED（用户批准的限定合成批次）；草稿刷新P2 CLOSED / USER_APPROVED；
AI2-5 IMPLEMENTING、AI-2 OPEN。最新批准与主线程复验见本文末尾；以下修订、送审及冻结记录保留为历史快照。
仅本地合成验证，不调用模型、不提交推送或部署。保留DEVICE_PENDING、T4/T8/AI-1 OPEN、
Docker INCOMPLETE_FAILED、T5-NB-001/002 OPEN_NONBLOCKING及高级恢复/新回收REMAINDER_DEFERRED。

## 问题与最小修复

上一轮独立复审确认：两图上传一成功一失败，普通手动详情刷新或窗口focus刷新成功后，
共享mediaEpoch使草稿媒体重新挂载，失败队列消失并错误解锁提交。临时真实组件两例及生产构建/API替身浏览器均复现。

本次只修改Ai2LearningPage的媒体作用域：草稿沿用稳定的session/child/package身份作用域，
只读作品单独携带view/mediaEpoch。普通刷新不销毁草稿失败队列；只读作品仍重挂载并清除所见标记，
家长需重新认证读取及图片load后才可审核。拒绝、身份/孩子切换、终态clearDetails仍清除私有组件；
不改后端、媒体组件、原命令协议、审核版本、鉴权或旧断言。

回滚仅还原本次页面增量，不涉及数据迁移；回滚会重新引入已知P2，不能当作通过验收。

## 冻结候选

归档：`release-gate-artifacts/ai2-4-draft-refresh-20261103/`（本机、不纳入Git）。
基线仍为`4655d30f1b61b55f400b67f16f9143dd191de1d2`。

| 对象 | SHA-256 |
| --- | --- |
| candidate.json | `b1a52ef373fe8df1b3a7299e62be7c38f88786720cc674c549058805e63b9dc3` |
| code-candidate.patch | `45aa5852842829c94ef40e76a14f0ef183d4fe4dd683b386fca6259ffd0b1a22` |
| frontend-only.patch | `41183345203874153dbe5cb259a91c8e83653b904c4ec9ec88c5d3f9ced981f5` |
| p2-incremental.patch | `18714b38e09dcdd6d978d4b09251939c616658814eb13539afb71e2a18bd3eca` |

66个文件从基线加累计补丁重建并核对哈希；相对上一65文件候选，仅Ai2LearningPage.js修改，
新增Ai2DraftRefresh.test.js；其余64文件逐字节不变，包括AI2-3的49文件。
`p2-incremental.patch`仅用于查看本轮两文件差异，不能代替完整候选。
文档与执行证据分别列入document-manifest.json及evidence-manifest.json，不递归自哈希。
排除无关T8增量。旧`ai2-4-final-20261103`及其上游候选不覆盖。

## 永久反例与验证

新增Ai2DraftRefresh.test.js使用真实页面和真实Ai2Media，仅mock API边界：

1. 手动刷新：等详情响应实际落地后，成功图片、失败重试入口及提交锁均保留；显式忽略后解锁。
2. focus刷新：同上，不自动上传、提交或隐私删除。
3. 当前身份详情403：保留草稿仍应立即清除，之后迟到成功不能恢复私有内容。
4. 切换孩子：失败草稿和提交入口清除，旧详情成功不能污染新身份。

| 执行证据（validation/） | 结果及边界 |
| --- | --- |
| red.json/log | 初次测试夹具遗漏合成孩子name，4项准备失败；保留，不算有效产品红灯 |
| red-product.json/log | 修复夹具后旧实现2失败/2通过，两刷新均命中toBeDisabled断言 |
| targeted.json/log | 6套214通过，0失败/跳过；页面、媒体、API、命令及共享会话 |
| full.json/log | 修订后64套1000通过，0失败/跳过；原996加本批4例，不累计重叠214 |
| mutation.json/log、mutation-summary.json | 临时副本恢复共享mediaEpoch，2失败/2通过；命中同两提交锁，副本finally还原 |
| build.log、lint.log | 新生产构建、两个受影响JS的仓库ESLint exit0；未升级依赖 |
| browser-refresh/result.json | 新构建＋API替身，两种刷新均retryVisible=true、submitDisabled=true；显式忽略后解锁，未自动POST |
| browser-loop/result.json | 原替身发布/提交/审核/回看闭环通过，publish/submit/review各1、upload1、认证读取2；0未知API/外部请求/控制台错误警告 |

Browser插件不可用，复用已有Playwright；无安装。普通/触控/窄屏为浏览器模拟，不是真机。
构建保留既有Browserslist数据陈旧提示，不为本次修订升级依赖。
刷新负向浏览器仅有一次明确注入503的控制台网络错误；不冒称该负向场景零错误。
两浏览器入口finally关闭自己的浏览器与回环服务；所有API均替身，不冒称正式HTTP或AI2-5验收。

主要命令（frontend/web下，既有Node22；未改超时/skip）：

```sh
CI=true node node_modules/react-scripts/bin/react-scripts.js test --watchAll=false --runInBand --runTestsByPath src/__tests__/family/Ai2DraftRefresh.test.js
CI=true node node_modules/react-scripts/bin/react-scripts.js test --watchAll=false --runInBand --testPathIgnorePatterns=src/__tests__/legacy
CI=true BUILD_PATH=/private/tmp/ai24-draft-fix/build node node_modules/react-scripts/bin/react-scripts.js build
node /private/tmp/ai24-draft-fix/mutate.cjs
node /private/tmp/ai24-draft-fix/browser-refresh.cjs
node /private/tmp/ai24-draft-fix/browser-loop.cjs
```

完整stdout、JSON、执行脚本和截图留在新归档validation；命令实际使用既有/usr/local/bin/node。
上一轮独立复审的产品红灯/浏览器复现和996项复跑在review-history中另存；
原996全量与最后95定向仍按[历史索引](README.md)区分。原973通过/1超时失败、lint/fixture历史不删除。
本次1000通过仅是前端既定非legacy范围，不等于后端全量、发布门禁、正式端到端或AI-2总门禁通过。

## 自查与复审

自查：生产改动只分离生命周期，未更改鉴权、原命令、所见审核版本、上传/删除或后端协议；
永久反例先红后绿，变异只在临时副本进行。

独立评审Erdos（`01a1a125-64a2-72a1-90fe-3dcb95c9f04b`）核对66个候选文件哈希，
实际独立复跑3套84通过（页面28、媒体52、新组合4），无失败/跳过。
独立临时副本换回旧页面，原新增四例得到2失败/2通过，精确命中详情完成后的提交锁断言；
还原候选后，四永久例及六临时生命周期探针2套10通过。
六探针单跑6通过：手动/focus刷新中上传尚未结束、手动/focus刷新后只读图片须重新授权及load、
SUCCEEDED/FAILED终态清空草稿；旧图片detached load不能恢复审核资格，未自动写入或DELETE。
临时探针不是新增永久覆盖，也不与84/214/1000相加；其源码随证据归档。
独立报告为validation/independent-report.md/json及对应原始日志；结论限定本P2为FIXED_REVIEWED，
未发现新的可操作P1/P2。独立评审者未重跑主线程全量/构建/浏览器，不将主线程结果冒充独立执行。
状态校验、文档链接、增量及累计补丁重建和逐文件哈希通过；用户批次验收与AI-2总门禁仍待批准。

## 用户批准与最新主线程复验

2026-11-03，用户批准AI2-4限定合成批次验收及草稿刷新P2关闭：AI2-4 ACCEPTED，
本P2 CLOSED / USER_APPROVED；同批其他已修复并复审的P2也仅在该合成批次范围关闭。
这不是正式服务、真实浏览器端到端、真机或AI-2总门禁验收；上文待批准状态为当时快照，不回写历史哈希。

最新主线程（main）复审原始目录为`/private/tmp/ai24-p2-review-8PwilZ/`。
已只读核对summary与三组Jest JSON/log：

| 本次复验 | 结果与范围 |
| --- | --- |
| current | 4套90通过、0失败/跳过，exit0；页面28、媒体52、草稿刷新4、临时生命周期探针6；9.405秒 |
| mutant | 1套2失败/2通过、0跳过，exit1；手动/focus刷新均精确命中第64行提交按钮toBeDisabled断言；2.533秒 |
| restored | 候选还原后2套10通过、0失败/跳过，exit0；永久4例与临时6例；3.969秒 |

本次是主线程实际复验，文档更新者只读核验并归档，不冒称另一次独立执行；90/10及旧84/214/1000不相加。
summary候选哈希匹配上文`b1a52ef3...`；临时副本还原后的全部17个候选前端文件哈希与冻结清单一致。
日志无超时/unhandled rejection，变异失败不是准备错误；临时6例仍不计作永久覆盖。未在本次复验运行构建或浏览器。

新增归档位于原项目`release-gate-artifacts/ai2-4-draft-refresh-20261103/review/main-8PwilZ/`，
保留summary、三组JSON/log、临时探针及已还原页面/永久测试源码，共10份证据，由新`review-manifest.json`逐项绑定。
summary SHA-256为`500fcdee24fd3acb7c76cc378e889690f8ba79e829e1483462f03f2dc9cb960f`。
该manifest另绑定原candidate哈希；原candidate、document/evidence manifest及所有旧patch不覆盖。

用户同时授权开始AI2-5正式应用接线，状态IMPLEMENTING。接线契约见[设计§7](../../../superpowers/specs/2026-11-03-family-ai2-minimal-design.md#7-开关启用与回退)
及[测试方案§9](../../family-ai2-test-plan.md#9-ai2-5-正式应用接线)；实际测试结果由主线程后续追加，不预先记录通过。
AI-2/T4/T8/AI-1 OPEN、DEVICE_PENDING、Docker INCOMPLETE_FAILED、T5-NB-001/002 OPEN_NONBLOCKING、
高级恢复/新回收REMAINDER_DEFERRED与T9 NOT_STARTED保持；不调用模型、不提交推送或部署。
