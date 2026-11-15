# AI-3 限定合成工程验收准备

Status: CLOSED / USER_APPROVED / ENGINEERING_SYNTHETIC_ONLY。
2026-11-05用户批准AI3-E及后续工程验收、AI-3限定合成工程总门禁关闭，见[关闭批准记录](closure-review.md)。
系统Git优先的原家庭入口213套6408项一次通过，exit0。下文原候选、待批准描述和旧失败均为历史快照，不改写。

当前复审修订见[三处行为问题及回归入口补强](review-fixes.md)。下文完整回归、累计补丁和
“未发现阻断”均为原候选历史快照，不自动覆盖本次修订；最新冻结与验证以该补充记录为准。

**AI-3 gate:** CLOSED / USER_APPROVED / ENGINEERING_SYNTHETIC_ONLY
**AI3-E acceptance:** ACCEPTED / USER_APPROVED
**AI-3 scope:** LOCAL_SYNTHETIC_ONLY
**AI-3 real model:** NOT_AUTHORIZED / QUALIFIED_COUNTER_PENDING
**AI-3 device:** DEVICE_PENDING
**AI-3 retained gates:** T4 OPEN / T8 OPEN / AI-1 OPEN
**AI-3 Docker audit:** INCOMPLETE_FAILED
**AI-3 historical failures:** PRESERVED
**AI-3 nonblocking:** PRESERVED
**AI-3 deferred:** REMAINDER_DEFERRED
**AI-3 delivery:** NOT_AUTHORIZED / NO_GIT / NO_DEPLOY

## 当前完成与待验证

- 实现与分层证据见[集成记录](README.md)、[独立复评](independent-review.md)。
  家长历史和来源三态、周报跨周修订已具备定向复评；正式双来源/双引擎四组浏览器开发验证通过。
- 前端测试模块读取lint修订后71套1163项通过；原构建和业务源码未因该测试调整变化。
- 家庭完整回归历史一轮210套208过/2失败，6323项6320过/3失败，exit 1，971.519秒。
  原Task6启动两项和legacy冷加载一项均保留，不能标记为环境问题或全绿。
  最小可选locals与模型延迟加载修复后原两套及补充预检反例22项通过；
  最终家庭完整回归210套6331项全部通过、exit 0、1033.157秒，无跳过，不覆盖前述失败。
- DeepTutor AI1/AI3回归235过/1失败，默认off实际生命周期30秒超时。
  独立诊断确定存在父取消信号被吞掉的关闭竞态；四行修复与两个屏障反例后作者241项通过，
  独立242项通过（额外一项正常失去领导权探针），移除修复时两项永久反例均失败。原30秒超时未变。
- 延迟加载后的冷夹具漏注册删除恢复模型，独立原四项先1失败/3通过；显式注册并保留原断言后，
  全新进程独立四项通过。最新正式HTTP入口全套9套107项通过、exit 0、214.473秒；
  其中50项运行正式HTTP/应用，57项为效果快照断言helper反例，不能称为107项HTTP请求场景。
- 最后resource/夹具/DeepTutor修订后的正式双来源/双引擎浏览器四组通过、exit 0、116.21秒；
  这是开发实跑。所用构建84个可匹配本地源码条目与当前一致，不把源码对照当另一次构建。
- 现有文档门禁已加入11项AI3状态保护；四项永久测试及独立66个内存负向文档变体通过，
  不因此自动批准E或关闭AI-3。根lint退出0；状态和交付文档最终复评另列。

## 累计源码与验证身份

源码从各仓基线累计冻结，不依赖A至E的历史补丁链：

| 仓库 | 基线 | 文件 | 累计源码补丁SHA256 |
| --- | --- | --- | --- |
| LMS | `a4f051e26f3514da051910a3495e11b149a32c45` | 145 | `54c663146cc758aef93781fed5182e4c98c180faee4b4f15b46b92cb4c336c06` |
| DeepTutor | `a5e64ca49667ddba2a0ba80c02ac1c59959dc2f9` | 14 | `e9d7c05a1285f52feed4e59399c6fd65ce0413dee87c86858c4a450425e7f7be` |

159个源码/测试文件从基线实际重建，内容哈希及模式均一致；没有提交或暂存。
T8及AI1/AI2 postmerge增量分组排除，14个独立排除文件与前次范围记录一致；
共享gate/plan和checker按hunk区分，不能整文件提交覆盖其他线程修改。
checker工作区还含原AI2合并状态hunk，所选AI3候选保留该行基线值，两个哈希有意不同。

完整家庭回归启动后，仅T2夹具及其空集合断言两文件新增一行；该入口选中的八个项目不导入它们。
107项T2入口和最终四组浏览器均在此修订后启动；正式HTTP启动前至最终159文件对照零漂移。
这不是声称所有运行都使用同一个全仓快照，也不为两个未被家庭入口加载的夹具文件虚构全量覆盖。

## 已执行入口

- `npm run test:family-regression -- --json --outputFile=...`：210套6331项，exit 0。
- `npm run test:t2:integration -- --json --outputFile=...`：9套107项，exit 0，层级分解见上。
- `npm run test:ci --prefix frontend/web -- --runInBand`对应现有react-scripts入口：71套1163项，exit 0。
- 前端现有`react-scripts/scripts/build.js`生产构建入口，输出临时`web-build-history`，exit 0；
  保留Browserslist数据陈旧提示，未安装或自动更新依赖。最后浏览器使用这一构建。
- 现有Python环境执行`tests/e2e/t2/ai3_bridge_acceptance.py`：四组，exit 0；
  DeepTutor AI1/AI3与leader的精确命令/AnyIO环境说明见独立证据，不冒称全DeepTutor测试仓通过。
- `npm run lint`、`node scripts/check-family-docs.js`、`git diff --check`均退出0。

## 剩余验收动作

完整目标逐要求只读复核未发现新的功能、安全、契约或验证阻断；不是独立重跑全部测试。
最终文档/补丁引用核对及用户验收分开记录。提交用户验收E及后续工程候选并申请AI-3总门禁批准。
未获批准前保持上述OPEN及USER_REVIEW_PENDING；模型计数资格、真实费用授权、真机与部署仍为独立后续事项。

## 最后证据归档

本机私有归档为`release-gate-artifacts/ai3-integration-20261105/final-verification-v2`：
192个文件，19877353字节；`evidence-index.json` SHA256
`fea3c8c5aeeadd7d3001170c093525e788259533cd8bd7015ec1dfddfae38231`。
其中`source-freeze/`包含两仓累计补丁、逐文件清单和实际重建记录，`completion-audit/`为完整目标逐要求复核，
`main/`包含本轮/历史全量、最终HTTP/browser日志及源码漂移对照；其余目录绑定独立修订复验。
先前477文件进展归档及188文件followup归档保持原样，不合并计数或覆盖历史身份。
第一次归档受sandbox拒绝；获授权后读到测试FIFO而停滞，仅停止本轮归档进程(exit 143)，
不完整目录保留为INCOMPLETE。修正为仅普通文件且排除临时运行目录后产生上述新索引，未改测试结果。

当前未获Git交付授权。源码补丁之外还须配套AI3文档增量，尤其新文档状态校验器；
文档冻结与最后复核单独绑定，不把源码补丁独自称为可交付全仓。原始日志保留本机，不代表已通过公开发布审查。

## 回退与启用边界

未变更真实环境，既有默认off不变；回退仅针对所列AI3源码/文档增量，不执行全仓reset或覆盖T8等修改。
合成数据库、图片及Provider均不是用户数据，不执行真实迁移或数据恢复。真实启用仍需另行处理计数资格、
费用授权、真机与T8发布条件；本次不提供绕过凭据、UploadGuard、日志或索引预检的快捷入口。

## 验收边界

真实LMS应用、Gateway、本机HTTP、临时Mongo副本集及认证媒体；DeepTutor本地operation/store真实，
Provider/计数/价格为显式合成替身。正式浏览器从实际AI1人工修订批准、AI2订正审核起步；
服务级反例可明确seed已批准来源，不能冒称相同浏览器起点。
设备实测、真实模型计数及费用授权、Ubuntu/NAS和发布恢复不属于本轮完成声明。
全部工程证据齐备后再申请用户验收E及后续工程、批准AI-3总门禁；本页不自动授权。
