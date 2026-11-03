# AI-1 三组输入冻结候选

日期：2026-11-02。状态：FROZEN_PENDING_REVIEW_NOT_AUTHORIZED。
用户已批准三组适配文本及整理冻结；本次候选待复审，冻结不是实际发送授权。

## 完整文本与请求

- [inputs.json](inputs.json)：完整共用system及三组user对象，逐字沿用本对话已批准适配稿。
- [requests.json](requests.json)：三组完整Provider JSON请求体，保存在各组的wireBodyUtf8字符串。
  先解析归档JSON，再取该字符串的UTF-8字节；不得把外层转义、排版、换行或本文件正文发给模型。
- [manifest.json](manifest.json)：输入文件、请求文件及每组system/user/messages/完整请求体的SHA256和字节数。
  user内容及完整body采用现有canonicalize规范序列化，不添加末尾换行。
- [验证记录](validation.md)：本地校验、自查及未执行范围。

完整body字段仅为model、messages、max_tokens=4096、stream=false、thinking.type=disabled；
三组共用当前ai1-prompt-v1，模型仅冻结为候选标识deepseek-v4-pro，不代表当前服务资格已核实。
不含tools、附件、教材、标准答案、家庭/孩子/来源ID、凭据、其他上下文或对话历史。
每组的messages完整包含system和规范user内容，不沿用AI-0旧system或压缩封装。

这是完整Provider请求**正文**候选，不是可执行的HTTP请求或远端operation信封。
未冻结Authorization、实际URL、合成来源记录、Job/operation标识、报价/profile/counter版本、
sendNotAfter、费用预留、生产generationInputHash/requestHash。后两项含额外运行字段，
不得以wireBodySha256替代。运行时只能经现有正式权限/预览/claim路径构建，不能直接重放本文件。
未来profile或正文发生变化须重新核对并冻结，不得悄悄替换本候选。

## 与原批准草案的准确差异

对照来源为2026-10-30 20:59:22完整原创草案及22:06:55用户批准，找回过程见
[测试方案§17.4](../../family-ai1-test-plan.md#174-已批准输入的只读找回与差异核对2026-11-02)。
manifest保存原消息摘要和历史封装摘要，两者对象不同，不声称逐字相同。

| 项目 | 本次已批准适配 |
| --- | --- |
| 输出范围 | 原短讲解、思考问题、两道变式题、单独家长答案，改为一份家长候选短讲解；保留理解性思考问题和不超过300字 |
| 变式要求 | 明确删除两道变式题及答案、一道保留中间0、钱够/不够各一道；不是继承旧封装的遗漏 |
| 概念组 | 保留完整文具室23盒、每盒124张情境及124×3、124×20拆分；明确十位2、部分积数位对齐，不能简单靠左 |
| 错因组 | 保留206×34及824+618=1442模拟错误；先提示不立即揭晓最终结果，再解释；原题正确计算放在同一短讲解末尾，以“家长核验：”标记，不建立孩子答案区 |
| 应用组 | 保留24套、78元、1900元和估成1920的错误判断；明确估大能/不能推出什么，可靠判断而非只报答案 |
| 数据结构 | questionText/answerText/parentContext分开承载原意；无模拟作答的概念组answerText为null；不注入家长标准答案 |
| 范围声明 | chapter为parent_declared、math、四年级上册；人教版具体版次家长核对，不宣称教材检索或已读取PDF |
| 模板与权限 | 使用现有AI-1 system，不沿用AI-0 system；无工具、链接、练习和检索声称；所有输出只供家长，文字标签不是访问控制 |

旧AI-0压缩封装省略的情境、提示顺序及估算边界已在本次user中明确恢复。
三个实际输入未加入新题目、标准答案、真实孩子资料或额外变式要求。
只用四年级可理解方法，不虚构页码、课程节点、掌握结论或与孩子的既往对话。

## 家长核验与发送边界

以下为人工核对依据，**不在请求正文**：concept为372+2480=2852；
mistake需区分206×3=618与206×30=6180，结果7004；
application为1872元，余28元，估大超预算不能据此推断实际不够。
审核还需核对数位、计数单位、提示顺序、分龄、短讲解范围；保留原输出及错误，
有错先修订，按实际查看版本批准，不把AI-0人工反馈继承为本轮输出验收。
审核通过也不新增孩子AI访问入口。

1556/1561/1551为正文UTF-8字节数，**不是token数或计费上界**；
300字为内容要求，不是自动费用限制。QUALIFIED_COUNTER_PENDING保持。
输入8192/输出4096及attemptLimit=1是既有协议条件，不证明供应商当前资格或已获费用授权。
当前价格、完整计数依据、家庭及实验额度、outstanding占用、发送截止点仍须核验并另行批准，
不继承AI-0的10元或剩余额度，不能保证限费就不发送。
未知结果停止新增生成，保留原Job/remoteOperationId、占用及发送槽，仅显式查询恢复；
不换UUID、不自动重发、不手工释放费用，不用新命令掩盖旧accepted。

本轮无模型调用、教材上传、密钥读取、服务器操作、提交推送或部署。
B/D/AI-1 OPEN；历史失败、DEVICE_PENDING、T4/T8 OPEN、T9 NOT_STARTED、
Docker INCOMPLETE_FAILED、T5-NB-001/002 OPEN_NONBLOCKING及
高级恢复/新回收REMAINDER_DEFERRED全部保留，不把文本冻结当门禁完成。
