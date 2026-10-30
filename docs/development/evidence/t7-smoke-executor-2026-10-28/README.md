# T7 隔离 smoke 执行器最小修订

日期：2026-10-28。用户授权只修正执行器，补齐实际请求、失败退出和未执行拒绝的永久反例；
不修改存储业务逻辑或原smoke断言。本轮仅本机合成验证，没有新启动Ubuntu容器、重新构建或部署。
状态 `LOCAL_EXECUTOR_FIX_VERIFIED / SERVER_REVALIDATION_PENDING / INDEPENDENT_REVIEW_PENDING`。

## 修订范围

- 新增 `scripts/run-isolated-compose-smoke.sh`：接收冻结原smoke源码及预期SHA-256，先拒绝空
  源码/摘要不匹配，再以0700临时目录中的真实 `.cjs` 文件执行。保留原CLI主入口及其全部断言。
- 保留Node子进程的非0退出码；退出0时仍必须有且仅有一条原成功输出且字节数为正数，否则报
  `SMOKE_NOT_EXECUTED`。临时源码和日志在成功/失败后清理，不将无关输出或空日志当通过。
- [runtime-candidate.py](runtime-candidate.py)从R4冻结执行器派生，仅给job增加smoke分支，
  stage17显式启用，以`sh -c`传入辅助脚本、原源码摘要，stdin仍是原源码。Bootstrap维持node stdin。
- [prepare-candidate.js](prepare-candidate.js)从R4准备器派生，只改新R5证据目录并将辅助脚本
  加入传输白名单。原smoke、正式release脚本、Dockerfile、服务代码、Compose和默认配置未变。

候选是接续用证据，不是新增生产发布框架。runtime保留R4项目路径作为补丁基准，不能直接执行
或复用R4项目名；下次需通过prepare生成新的唯一项目，再按原流程替换runtime的root并冻结其哈希。
本轮没有执行prepare候选，也未生成或声称已有R5服务器结果。

## 永久反例及实际证据

复用 `backend/common/deployment/__tests__/composeFamilySmoke.test.js`，保留原函数测试：

1. 原源码通过旧node stdin运行，退出0、输出为空、HTTP请求0次；随后同一源码通过新入口，
   对本机回环HTTP合成服务依次发出注册、建家庭、建孩子、上传、建任务、取签名、读图片共7次请求。
2. 使用与隔离容器相同的`sh -c`、argv、stdin约定，实际请求7次并产生原成功输出。
3. 注册503返回非0，且保留原错误；最终内容类型错误也返回非0，不能跳过原最后一步断言。
4. 禁用主入口、仅输出无关文本、空源码均拒绝，不因子进程退出0而计通过。
5. 源码摘要漂移在发请求前拒绝；打印成功标记但退出7时仍返回7。
6. 每个成功/失败用例检查临时目录清空；测试HTTP服务显式监听127.0.0.1，收尾用finally清理。

原smoke不被mock或改写来通过正向测试，执行真实Node CLI、fetch和HTTP；后端响应由本机合成
HTTP夹具提供，**不是正式多服务服务器验收**。故不能将这些测试写成Ubuntu阶段17通过。

初次新增辅助脚本前红灯8 failed/1 passed保留；最终相关smoke/releaseGate/releaseIsolation
三套测试36项通过，其中smoke套件10项。未删除旧断言、提高超时、跳过用例或新增测试框架。
`npm run lint`、`sh -n`、准备器Node语法和执行器Python AST校验、`git diff --check`通过。
AST接线自查确认stage17显式smoke=True、sh入口/原源码摘要/0.1 CPU与128 MiB限额一致、
Bootstrap仍走node；该检查没有执行Docker。

## 冻结、自查与保留项

`candidate.patch`绑定仓库辅助脚本和永久反例；`runtime.patch`、`prepare.patch`绑定相对R4
的执行器和传输入口增量。`evidence.json`记录文件哈希和日志；原始记录位于
`release-gate-artifacts/t7-smoke-executor-2026-10-28/`。R4的378项运行源码逐项复核未变，
新辅助脚本是下一候选的新增文件，不把原源码快照篡改为包含它。

自查确认原CLI真正运行、错误码向外传播、未执行零退出被拒绝、哈希绑定且无存储逻辑变更。
独立复评待进行；附加Health字段快照问题本轮不扩展修复，失败记录继续保留。
R4的17原始退出0/空日志及INVALID_EVIDENCE裁决不改写，本轮没有重新执行服务器14–17。
下一步是用修订后固定候选进行实际服务器验证，证据具备前17和完整release不得记PASS。

T4/T7 OPEN、DEVICE_PENDING、Docker INCOMPLETE_FAILED、历史失败、两项非阻断补测和
高级恢复/新回收REMAINDER_DEFERRED保持；未提交、推送、合并或部署。
