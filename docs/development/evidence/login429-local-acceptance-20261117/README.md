# 登录 429 修订公开交付索引

本批已获限定本地验收，见[批准记录](../../login429-local-acceptance.md)。本次授权仅提交专用分支、创建 Draft PR 和检查 CI，不包含合并、服务器操作、真人入口更新或部署。

## 提交范围与冻结对应

- 基线：`7da928e7d4aee992eb1507e3b898572fcbb012ca`。
- [candidate.patch](candidate.patch) 是原冻结 8 文件补丁的逐字节副本，SHA256 为 `c35885423b6cdd1d5a11bc8517ac62f608906f22d8e9e05f6ebade7eeee4531b`；已检查无真实凭据、私人路径或服务器地址，无需改写补丁。
- [candidate-files.json](candidate-files.json) 是原 8 文件摘要副本，实际源码保持一致；原计划/自查文档的待评审表述是历史快照，后续结论单独追加在批准记录。
- [archive-index.json](archive-index.json) 保存原冻结包的文件摘要清单，不包含原始日志、截图或响应正文。其 SHA256 为 `abfba489374efbd243ec776578cf8c1050d915fc0955be883db4cc53a354dffb`，与原 manifest 一致。
- [review-receipt.json](review-receipt.json) 是本对话复审工具输出的摘要，不是原始日志，也不冒称测试线程另行重跑。
- [public-files.json](public-files.json) 绑定上述公开副本及复验摘要；不把公开摘要当作完整原始证据。

原始取证及开发日志继续留存于既有本机证据目录，不上传私人运行路径、原始诊断脚本、截图或完整响应。原始取证清单 SHA256 为 `83ba99c84132b64ffeae641ff18afe8eaabf8aa53d1177a33e71ca65cdf3aae8`。

本批排除原始目录的 SRS、使用指南、Ubuntu 前端更新记录及其共享文档增量。开发索引只增加本批链接；不包含 WP1/T8 执行器、运行配置、依赖、CI 流程或数据修改。

## 验证和剩余风险

- 开发完整前端回归 85 套件 / 1417 项通过；后端相关回归 1793 通过 / 2 失败，随后原两套件 106 项定向通过，保持分批结果。
- 开发 Chromium / WebKit 各 45 项通过；复审仅重跑新增登录用例，每引擎 1 项，以及 HTTP 4 项和前端专项 55 项。两组证据不可混写。
- 浏览器错误由拦截注入，成功对照使用正式应用合成登录；远端 AI Provider 为替身，不调用真实模型。
- 原红灯、Git 可执行文件失败、Chromium MachPort 失败及夹具首轮失败保留，不改写为全量一次通过。
- 普通和敏感限流仍分别为原默认 100 / 20 次及 15 分钟，来源键、代理信任和 PIN 保护不变。共享额度风险未解决，本地任务 PATCH 后登录拒绝反例不是现场根因归属。
- 8 次业务 503 保持 `OPEN / EVIDENCE_MISSING`；T4/T8/AI-1 OPEN、SERVER_TIMING_UNVERIFIED、DEVICE_PENDING/MANUAL_PENDING、历史失败、非阻断补测和后置范围不变。

回滚仅需在后续授权交付中撤回两份业务文件，不改数据、PIN 或计数；本次没有部署可供回滚。
