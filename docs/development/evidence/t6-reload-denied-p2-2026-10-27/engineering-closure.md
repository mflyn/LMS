# T6 限定合成工程总门禁关闭记录

**T6 status:** CLOSED
**T6 gate:** CLOSED
**T6 scope:** ENGINEERING_SYNTHETIC_ONLY
**T6 Git:** NO_COMMIT / NO_PUSH / NO_MERGE / NO_DEPLOY
**T6 approval:** APPROVED
**T6 historical failures:** PRESERVED
**T6 device:** DEVICE_PENDING
**T6 Docker audit:** INCOMPLETE_FAILED
**T6 nonblocking:** T5-NB-001 OPEN_NONBLOCKING / T5-NB-002 OPEN_NONBLOCKING
**T6 deferred:** REMAINDER_DEFERRED
**T6 deployment:** T8_PENDING / NOT_AUTHORIZED

## 批准与范围

日期：2026-10-27。批准来源：本线程用户直接指令：

> 批准关闭 T6 限定合成范围的工程总门禁，同步更新门禁、评审记录、实施计划和状态校验，完成验证。保留历史失败证据、DEVICE_PENDING、Docker INCOMPLETE_FAILED、两项非阻断补测及后置范围，不提交、推送、合并或部署。

据此关闭 T6-1–T6-5 的来源契约、权限隔离、人工错题/订正/复习页面、异常边界及合成工程验收。
不把工程关闭解释为真实设备、家庭产品价值、发布流水线或生产环境验收。

## 证据与评审结论

逐项验收及剩余责任见批准前 [closure-review.md](./closure-review.md)，其 READY_FOR_APPROVAL / OPEN
是历史冻结状态；当前状态以本文及 Gate §26 头部、§26.6 为准。
原冻结补丁、validation.json、closure-evidence.json 和既有评审文档保持原字节，不回写历史状态或失败。

- 最终实现冻结补丁：`42d785fd363232f1888122199bcac8ff99e89f499420d9e1b4cf03e7bd47ecb9`。
- 最近独立复审：前端 52 suites / 678 tests、候选构建、真实七服务 Chromium 4/4；
  仅临时副本撤回修复为 2 failed / 32 passed，恢复后 34/34，确认拒绝清理、迟到响应及旧行保护有效。
- 后端修订全量 152 suites / 4388 tests、后续完整正式 HTTP 27 项按原候选归属；
  原完整浏览器 47 项不冒称后续修订后的完整发布验证，最新页面以 678 项和定向浏览器 4 项绑定。
- 普通重新加载拒绝优先 P2 已获用户批准关闭；本次接受全部已复审 T6 工程证据，不增加业务实现。
- 旧家庭全量首轮 3 failed / 149 passed suites、5 failed / 4380 passed tests，各轮永久反例红灯、
  GET 故障夹具错误、Docker INCOMPLETE_FAILED 全部保留，不将全量历史描述为全绿。

本次只更新文档、状态校验和永久状态反例；不重跑未改变的全部业务测试，不把原日志作为本次执行结果。
本次文档验证结果和当前文件哈希见 [engineering-closure-evidence.json](./engineering-closure-evidence.json)。

本次实际执行：`scripts/check-family-docs.js` 通过；`familyDocumentationGate.test.js` 250/250 通过，
无跳过。先用更新后的反例运行旧状态校验得到 79 failed / 171 passed，再更新校验得到全绿；
该红灯只属于状态规则升级，不替换任何历史业务失败。校验器和测试文件的定向 ESLint、
`git diff --check` 均通过。原业务实现未改变，未重复宣称执行前端/后端全量或浏览器验收。

## 状态校验与遗留责任

既有校验由“拒绝未授权关闭 T6”更新为“保持已批准的限定关闭”：唯一 CLOSED 当前任务行，
唯一状态/范围/批准/保留项，拒绝缺失、重复矛盾、回退或改成生产范围。继续拒绝擅自 Git 授权或启动 T7–T9。
没有删除状态门禁或跳过原反例；旧规则根据新批准替换，新边界补永久负向用例。

DEVICE_PENDING、Docker INCOMPLETE_FAILED、T5-NB-001/002 OPEN_NONBLOCKING 和 REMAINDER_DEFERRED 不关闭。
T4 既有状态不变；SL-05 仍 PLANNED，保留 T7 综合验收。Ubuntu/NAS/备份恢复/容量/回滚及 Kubernetes
配置属于 T8，家庭价值属于 T9。未自动启动任何后续任务，未操作真实数据。
不提交、推送、合并或部署；如后续要求 Git 交付或真实验证，须另行授权。
