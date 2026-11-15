# AI-1 A 批本地交付证据

日期：2026-11-01。范围：本地领域模型、契约、权限、事务费用预留、人工修订/审核及合成结果组合。
状态：A_ACCEPTANCE_PENDING；AI-1总门禁OPEN。未调用DeepTutor/Provider，未注册生产路由，未提交/推送/部署。

- [候选文件及补丁hash](manifest.json)：基于固定HEAD的27份代码/测试/文档文件，包含之前未提交的AI-1设计稿。
- [完整候选补丁](candidate.patch)：含tracked差异及新增文件；不含本证据目录，避免自引用hash。
- [验证与独立复核摘要](verification.json)：准确区分开发、独立、全量非绿和修正环境后的定向结果。
- [主线门禁记录](../../family-self-directed-learning-mvp-gate.md#293-ai-1-设计批准与-a-批本地无模型实现2026-11-01)。

原全量：161通过/2失败套件，4980通过/2失败测试，退出1。失败均为旧x86 Git被PATH优先命中。
修正Node22/ARM Git后，原两失败套件连同AI-1及文档门禁共5套件461项通过，退出0。
这不是单次全量全绿证据；不覆盖原失败，不因本归档关闭总门禁。

独立首评发现URL形式绕过P2，补永久反例并保留两轮红灯：5失败/15通过、2失败/21通过。
最终独立契约复验23项通过（Node24），开发最终A批48项通过（Node22）。
两项额外覆盖缺口已补首次同命令竞争及竞争胜者版本链断言；未削弱原测试。
来源reader/结果为合成替身，真实临时Mongo副本集。无HTTP、浏览器、Provider或真实家庭验收。

原始日志不进入公开证据；下列JSON仅含脱敏计数和本机原始日志hash，不含凭据、真实题目或设备地址。
AI-0人工审核/修订限制、T4/T8 OPEN、T9 NOT_STARTED、DEVICE_PENDING、Docker INCOMPLETE_FAILED、
T5-NB-001/002 OPEN_NONBLOCKING、历史失败及高级恢复/新回收REMAINDER_DEFERRED保持不变。
