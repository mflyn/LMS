# AI2-4 页面批次候选

当前状态：AI2-4 ACCEPTED（用户批准的限定合成批次），草稿刷新P2及本批其他已复审P2限定CLOSED；
AI2-5 IMPLEMENTING，AI-2 OPEN。最新批准与主线程复验见本文末尾，以下送审状态及冻结记录均为历史快照。

上一送审增量：用户复审发现普通/焦点刷新丢失部分上传失败的P2；修订候选和新证据见
[草稿刷新P2记录](draft-refresh-p2.md)。以下65文件、996/95项及哈希是保留的上一候选快照，
不能作为新66文件候选的当前哈希；AI2-4仍待用户批次验收，不因本次修复关闭AI-2。

状态：READY_FOR_ACCEPTANCE，待用户复审；AI2-2/3 ACCEPTED，AI2-5 NOT_STARTED，AI-2 OPEN。
本地合成范围；不调用模型、不提交推送或部署。保留T4/T8/AI-1 OPEN、DEVICE_PENDING、Docker INCOMPLETE_FAILED、
两项T5非阻断补测及高级恢复/新回收REMAINDER_DEFERRED。本文不是总门禁关闭或真实使用授权。

## 冻结范围

基线：`4655d30f1b61b55f400b67f16f9143dd191de1d2`。
最终本地归档：仓库的`release-gate-artifacts/ai2-4-final-20261103/`，不纳入Git。
原`ai2-4-20261103/`冻结保留为测试globalThis修订前快照，不覆盖。

| 对象 | SHA-256 |
| --- | --- |
| 最终candidate.json | `725d8017fe4b402f2a267c9afd8c26ee030d500aafeda71a5fa22283e2dc61d4` |
| 最终code-candidate.patch | `b7fd4a5719c28e3555b2f7c73df681db7176c2c33e4a80dd6da327129b906ee1` |
| 最终frontend-only.patch | `102aa67365246cad8f68b24db531d3286e3c4781aaf5f5a251b3fe5737eb1d8d` |
| 前一候选candidate.json | `cfe090a1def1c3afe543b51848d700ad9ea6a35c0a75e9cfc314784acda1aa51` |

累计候选65文件：原AI2-3的49文件逐字节保持，本批16个前端源码/测试文件；原基线加补丁已重建并核对全部哈希。
完整文件列表在candidate.json；排除工作区中无关T8恢复夹具/文档、临时node_modules链接及原始日志。
前后两AI2-4候选仅两个测试文件的global.fetch改为globalThis.fetch，断言、业务实现及其余63文件保持。
文档单独记录document-manifest.json，执行输出和脚本见evidence-manifest.json，不以递归自哈希描述清单。

## 已实现流程

- 家长AI1批准详情→孩子可见文本预览→显式发布；当前孩子列表/详情/历史、撤回及订正审核。
- 孩子今日入口→发布讲解→1–10张JPEG/PNG/WebP订正→提交→查看审核反馈/历史；submitted/approved只读。
- 认证blob预览、实际load后审核、过期重看、图片删除占位；部分上传失败保留成功项并阻断提交。
- 原命令完整暂存/同UUID重试、重登只读发现与显式恢复、当前拒绝优先、身份/孩子切换与迟到响应隔离。
- 新提交权限预读不升级版本；预读不是写确认；撤回后原命令最小确认不要求正文可读。

代码入口：`Ai2LearningPage.js`、`Ai2Media.js`、`ai2Api.js`、`ai2Commands.js`、`ai2MediaApi.js`；
均位于`frontend/web/src/`既有pages/components/services目录。原私有任务材料/错题/PDF组件不改。

## 执行证据

| 项目 | 原始证据 | 结果/范围 |
| --- | --- | --- |
| 页面永久例 | ai2-4-page-final.json/log | 28 passed，0 failed/skip |
| 页面六处变异 | page-mutations/summary.json及各JSON/log | 分别2/1/3/1/1/1预期失败；其余定向未选中不算通过 |
| 媒体拒绝优先 | ai2-4-media-p1-green-final.json及red/mutant | 原43+新增9=52通过；red和mutant均4失败/5通过 |
| 前端非legacy完整相关回归 | ai2-4-full-final.json/log | 63 suites、996 passed、0 failed/skip；在最后两测试globalThis机械修订前 |
| 最后两测试复验 | ai2-4-media-final.json/log | 2 suites、95 passed、0 failed/skip；最终文件版本 |
| 最终仓库ESLint | ai2-4-lint-fixed.log | 15个JS源码/测试文件，exit0；CSS不适用ESLint |
| 最终生产构建 | ai2-4-build-frozen.log | CI=true，exit0；此后仅两测试文件机械修订，生产源码未改 |
| 浏览器替身闭环 | browser-final/result.json、4张截图 | Chromium生产React，所有API为明确合成替身，不是正式HTTP验收 |
| 候选重建 | ai2-4-final-freeze.json、candidate.json | 65个重建文件与当前哈希匹配 |
| 最终独立核验 | ai2-4-final-independent-report.md/json | 最终65哈希、两文件23处机械差异、95项报告、lint退出码及文档证据边界匹配 |

全量运行使用项目已隔离的legacy范围，没有新增skip或放宽断言/超时。
`ai2-4-full-candidate`为机械修订过程中的另一轮996通过，只保留过渡证据，不作为同一冻结版本全量证明。
不把重叠95项与996项累加成独立覆盖数。后端历史回归未重跑；正式装配、metadata transport、Gateway真实权限及正式浏览器属于AI2-5。

主要实际命令（现有Node22，无安装；frontend命令在frontend/web运行，ESLint在仓库根运行）：

```sh
CI=true node node_modules/react-scripts/bin/react-scripts.js test --watchAll=false --runInBand --testPathIgnorePatterns=src/__tests__/legacy --json --outputFile=/private/tmp/ai2-4-full-final.json
CI=true node node_modules/react-scripts/bin/react-scripts.js test --watchAll=false --runInBand --runTestsByPath src/__tests__/shared/Ai2Media.test.js src/__tests__/shared/ai2MediaApi.test.js --json --outputFile=/private/tmp/ai2-4-media-final.json
CI=true BUILD_PATH=/private/tmp/lms-ai2-4-build node node_modules/react-scripts/bin/react-scripts.js build
node scripts/check-family-docs.js
git diff --check
```

本机实际显式使用既有`/usr/local/bin/node`与现有依赖NODE_PATH；逐次stdout、错误和退出结果保留，不将环境配置失败算作产品断言失败。
临时browser.cjs/page-mutations.cjs/freeze.cjs归档便于复核，不新增测试框架；浏览器只回环、禁止外部网络，退出在finally关闭。
桌面1366×900、触控820×1180及窄屏390×844已截图检查，无横向溢出；publish/submit/review各1次、upload1次、认证读取2次，
没有未知API、外部请求或控制台warning/error。图片是程序生成的合成算式，不含真实孩子数据。

## 自查、评审及历史失败

页面评审Erdos发现并复核焦点/所选孩子归属/终态GET失效/合法迟到成功反例，以及预读错误分层与撤回终态恢复，
媒体交叉评审Schrodinger发现并复核旧预览拒绝优先；API/store由Poincare另行静态复核。
本批问题FIXED_REVIEWED，待用户复审，不提前CLOSED；评审读取源码/变异及日志，不冒称评审者重跑全量。
详细修复表见[测试方案§8](../../family-ai2-test-plan.md#8-ai2-4-页面批次)，独立原文随本地证据归档。
独立候选核验从基线重建前一65文件候选，最终候选再以清单/补丁哈希和两文件机械等价核对；
主线程对最终累计补丁也完整重建65文件。两者方法区别保留，不冒称独立评审者重新运行了全量测试。

保留：模块缺失/fixture失败、页面自查red、媒体红灯、构建hooks/运算符lint错误、仓库global的23项lint错误。
早期`ai2-4-full-first`为973 passed/1 failed，原TaskHelpPanel长Unicode输入超过5000ms；不修改其代码、断言或超时，
之后串行996通过，不能抹除首次失败。客户端工作线程早期全量失败/截断输出另存client-history，明确原始工具结果不是Jest JSON。

## 下一批与人工事项

AI2-4仅提交候选验收。AI2-5仍需正式服务组合/启用门禁、跨进程metadata、真实登录鉴权与正式HTTP/浏览器闭环，
以及完整相关后端回归；不能用本批route fixture补足这些验收。
真机仍DEVICE_PENDING：iPad文件选择、触控预览/删除确认、切后台重验权限、弱网原命令恢复与布局需后续实测。
模型计数资格、AI0人工审核、NAS/真实部署、历史失败与高级恢复/新回收后置范围保持，不扩展本批范围。

## 用户批准与AI2-5接续

2026-11-03，用户批准AI2-4限定合成批次验收、草稿刷新P2及其他本批已复审P2限定关闭，
并授权AI2-5正式应用接线。AI2-4 ACCEPTED、草稿刷新P2 CLOSED、AI2-5 IMPLEMENTING、AI-2 OPEN。
批准绑定66文件修订候选`b1a52ef373fe8df1b3a7299e62be7c38f88786720cc674c549058805e63b9dc3`，
不把本索引上方65文件历史候选当作当前修订，也不改变旧冻结哈希。

最新主线程复验：4套90通过；旧行为变异2失败/2通过，准确命中两种刷新后的提交锁；还原后2套10通过，全部无skip。
这是源码/组件合成复验，不是正式服务或浏览器新验收；不与旧全量1000或独立84相加。
原始summary及JSON/log、临时探针和还原源码共10份已另存
`release-gate-artifacts/ai2-4-draft-refresh-20261103/review/main-8PwilZ/`，新`review-manifest.json`绑定，
不覆盖原manifest；详情见[批准与复验记录](draft-refresh-p2.md#用户批准与最新主线程复验)。

AI2-5按既有[设计§7](../../../superpowers/specs/2026-11-03-family-ai2-minimal-design.md#7-开关启用与回退)
实施正式runtime、连续仓库声明/启动预检、Gateway raw JSON及JWT、homework正式公共与内部媒体授权路由、
resource受服务凭据保护的metadata inspect；验证矩阵见[测试方案§9](../../family-ai2-test-plan.md#9-ai2-5-正式应用接线)。
当前仅记录开工及契约，实际测试/正式HTTP/浏览器结果待主线程追加，不新设审批框架。
T4/T8/AI-1 OPEN、DEVICE_PENDING、Docker INCOMPLETE_FAILED、T5-NB-001/002 OPEN_NONBLOCKING与后置范围不变。
