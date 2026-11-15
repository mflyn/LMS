# AI2-3 本地合成候选

基线 `4655d30f1b61b55f400b67f16f9143dd191de1d2`。AI2-2已获用户批次验收，原成功确认依赖媒体P2 CLOSED。
本批AI2-3 READY_FOR_ACCEPTANCE、尚待用户验收，AI-2 OPEN；不调用模型、不提交推送部署，不改变现有未关闭及后置状态。

## 范围与边界

- 合法AI2媒体类型、孩子持久submit/recover、完整引用与精确代次、owner/phase CAS、结果未知保锁及不可逆补偿。
- 私有图片认证正文、实时家庭/孩子权限、已删除占位、正常隐私删除和保留清理；不扩展高级恢复/孤儿回收。
- 独立工厂默认off；正式server/Gateway、跨进程metadata transport、页面与浏览器留AI2-4/5，不冒称生产装配完成。
- HTTP验证使用真实本机回环、临时Mongo副本集和签名身份信封，不是Gateway JWT登录。上传使用真实图片字节和文件存储；
  scanner故障、部分client单测使用明确替身。服务端权限检查为真实内部HTTP，部分包/Attempt历史为持久合成夹具。
- 补丁是相对上述HEAD的AI2-2＋AI2-3累计源码/测试/配置，不把AI2-2覆盖伪称本批新增；排除无关T8修改及前端依赖链接。
  AI2-2原冻结补丁及历史证据保持不变，见[前批索引](../ai2-2-20261103/README.md)。

## 修复与独立复核

Parfit/Fermat聚焦复核均无新增P1/P2阻断。混合未发布绑定P2及清理后deleted描述P2为FIXED_REVIEWED，待用户验收。
自查数组别名反例先红后绿；off/在途COMMITTED及清理未知保锁补为永久测试。
最终FAILED HTTP用例证明recover收敛及submit/recover重放，不宣称覆盖首次submit直接收敛FAILED。
独立评审是源码和现有证据复核，部分有有界模型断言，不冒称重跑完整Mongo/HTTP套件。

## 验证

| 验证 | 当前证据 |
| --- | --- |
| homework既定服务回归 | 44 suites / 1576 passed，0 failed/0 skipped |
| resource既定家庭回归 | 原45 suites / 1931 passed，0 failed/0 skipped，429.853秒；启动后追加的两套另跑，不声称单次47套 |
| 最终提交/恢复/权限专项 | 4 suites / 60 passed，0 failed/0 skipped；后续HTTP补强单独复跑 |
| 最后HTTP补强 | 1 suite / 3 passed，0 failed/0 skipped，4.762秒；pending:false、command不含payload |
| 新resource权限专项 | 2 suites / 49 passed，0 failed/0 skipped，已接入既定家庭清单 |
| resource worker扩展验证 | 7 suites / 160 passed，可核验JSON；与专项重叠不累计 |
| resource协议/日志worker验证 | 4 suites / 194 passed，仅工具输出，不冒称原始落盘日志 |
| 既有文档回归 | 1 suite / 313 passed，0 failed/0 skipped |
| ESLint/文档状态/diff | 原规则；无新增豁免，最终校验另随冻结记录 |

使用已有Node22及依赖，无安装。主要命令（Jest由已有依赖入口运行）：

```sh
jest --config=backend/services/homework-service/jest.config.js --runInBand --coverage=false
jest --config=backend/services/resource-service/jest.family.config.js --runInBand --coverage=false
jest --config=backend/jest.family-common.config.js --runInBand --coverage=false \
  --runTestsByPath backend/common/deployment/__tests__/familyDocumentationGate.test.js
node scripts/check-family-docs.js
git diff --check
```

首次误用旧resource jest.config的执行出现依赖路径及全局Mongo生命周期冲突，停止exit 130；日志保留，
没有修改setup/断言/超时来掩盖。初始fixture缺字段、数组别名及混合引用红灯也保留。
本机临时node_modules链接只用于解析已有依赖，不作为候选或交付文件。

## 冻结归档

归档位于原项目忽略目录 `release-gate-artifacts/ai2-3-20261103/`，仅本机存储。
`candidate.json`记录49个源码/测试/配置文件、补丁、原始日志/JSON及独立评审摘要哈希；
补丁已从基线重建并逐文件比较一致。原始日志含失败快照，不将历史全量写为全绿。

| 文件 | SHA-256 |
| --- | --- |
| code-candidate.patch | `6e8592dc1d19a14140b6756e112d90254c13e893cdfa277cca1fdf6616e63855` |
| candidate.json | `e9b4a27498841823a21fc72ce862564cb3e124ed2c3d0d008263ed7b7cc7dcd4` |

最终文档收尾另存`delivery-validation.json`，不回写初始候选或旧批证据。现有状态校验不覆盖全部AI2语义，
不能把文档313项当AI2业务验收；契约/范围由本批人工自查及聚焦评审共同核对。

保留T4/T8/AI-1 OPEN、DEVICE_PENDING、历史失败、Docker INCOMPLETE_FAILED、
T5-NB-001/002 OPEN_NONBLOCKING、高级恢复/新回收REMAINDER_DEFERRED、T9 NOT_STARTED。

## 永久反例P2后续候选

前述冻结候选及所有原始证据保留为历史快照；后续复审发现两个测试保护P2，不是新增业务代码缺陷。
当前只在`ai2Submission.test.js`新增三个永久反例，原44项不变、其余48个候选文件哈希不变。
实现细节、异常收尾意见及修订见[测试方案§7.4](../../family-ai2-test-plan.md#74-两项永久反例p2补强2026-11-03后续)。

新归档使用独立目录`release-gate-artifacts/ai2-3-p2-20261103/`，不覆盖上文旧patch/manifest。
已包含累计49文件候选、相对原冻结候选的单测试文件增量、历史复审漏检证据、本轮正常/逐项变异及异常收尾日志。
本轮4套63项通过；历史homework1576/resource1931并未重跑。原44项逐字节保留，其余48文件未变；累计补丁重建一致。
最终逐项变异为租约1 failed / 46 passed、模式2 failed / 45 passed；对应新增反例失败，全部无skip。
独立评审Raman核对源码、JSON与日志通过，未重新运行这些主线程测试；测试异常收尾意见已修正并复核。

| 新归档文件 | SHA-256 |
| --- | --- |
| code-candidate.patch | `e26e219e73281872d4ec4460f4075cb838d7d845bc97bb9cdb66f831b7dafec0` |
| test-only.patch | `6cceee13cc9a1c5c186e4b02e4dde4089e300697f55cd33d940ce327963c931b` |
| candidate.json | `180b4e5875e1b04714b947dee46d9f9ad924c805a131d9318127bf1722d00621` |

`candidate.json`绑定49文件及31份初始证据；最终文档/状态检查、收尾探针源文件和独立复核摘要由附加`validation.json`绑定，
不回写旧候选或本次已冻结的初始证据。两项测试P2和测试收尾意见为FIXED_REVIEWED，供用户复审。
文档检查首次依赖解析失败也保留；使用已有Node22/NODE_PATH后通过，不写成初次即全绿，无依赖安装或规则放宽。
两项测试P2不自动关闭，AI2-3仍待用户验收，AI-2 OPEN；所有历史失败、DEVICE_PENDING和后置范围不变。

## 用户批准与独立复验证据

上述为送审快照。用户已批准AI2-3限定本地合成验收，本次两项测试保护P2为CLOSED，AI2-3 ACCEPTED。
绑定上表新候选及独立复验目录`release-gate-artifacts/ai2-3-p2-review-20261103/`：
`manifest.json`保存12份原始JSON/日志的SHA-256与字节数；`review-audit.json`证明候选重建/增量还原，
`review-results.json`记录独立63通过、逐项变异1/2预期失败、异常收尾3预期失败及恢复后47通过。
旧日志/补丁/validation.json仍为不可覆盖历史，本次批准不改写其中送审状态。
AI2-4获准本地实施，AI2-5 NOT_STARTED、AI-2 OPEN；DEVICE_PENDING与其他未关闭/后置边界保持。
