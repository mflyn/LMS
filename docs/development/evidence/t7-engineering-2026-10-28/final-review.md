# T7 最终候选独立归档复核

后续状态：2026-10-28 用户批准七项 P2 CLOSED，见 [关闭记录](p2-closure.md)。
以下仍是原冻结候选的独立复核快照；T4/T7 总门禁不随问题关闭，原哈希与结论不改写。

日期：2026-10-28。结论：PASS / PENDING_USER_ACCEPTANCE。
独立评审者：Beauvoir（01a17fcf-f93c-7ea0-a699-0049224cef22）。
本次是只读归档复核，不是重新执行全量测试，也不是用户验收或总门禁关闭批准。

## 冻结身份

- 基线：7d519d20b5f4409a4f6fb66a756a8f571e55b68b；未提交工作区不是该提交本身。
- candidate.patch SHA-256：61e4591c8eb4520395d9e27e029cf14b6c8918db333acb614e025f86f3d898f7。
- validation.json SHA-256：19ab93679c2695373efc5c9de5edffbed8f9f5cbbe1350f007dc698c85b8af8f。
- 候选排除本证据目录，避免补丁、索引和复核记录循环自引用。本记录不改变候选源码或原始证据。

## 独立核对

33/33 候选文件哈希、394/394 原始证据哈希及字节数一致；22 个跟踪修改和 11 个未跟踪文件
与证据目录外的实际工作区集合相同，没有遗漏或额外文件。274 份仍有临时原件的副本逐字节一致。
`patch --dry-run --reverse --fuzz=0 --batch -p1` 退出码 0，全部文件匹配；未实际应用补丁。
作者另执行 `git apply --reverse --check`，退出码 0；此项与独立工具核对分列。

独立读取结果和命令记录确认：家庭 153 suites / 4506 passed、正式 HTTP 6 suites / 35 passed、
Chromium 54 passed、Task11 HTTP 6 和浏览器 4 passed；前端 57 suites / 739 passed 沿用有效。
最终 docs/diff/source lint 退出码 0，状态门禁 268 passed。九个独立复验监测文件与最后一次
独立 HTTP 指纹一致；十六个前端源码/测试文件未变，固定构建 manifest、五个产物和九个实现
source map 均与索引及当前源码匹配。

完整 `release:family` 最终尝试退出码 1，44 项错误均为历史归档 JSX 解析；后续阶段未执行，
Docker 未启动。分项回归通过不能替代完整发布门禁、CI、Ubuntu 同限额或真实 iPad 验证。

作者对完整候选执行私钥标记、常见 GitHub/AWS/OpenAI 凭据模式扫描，未命中；复核 secret/password/
token/cookie 命中仅为合成测试值、请求字段或环境变量引用。不宣称完成通用安全审计。
原始日志和合成账号数据仍位于忽略目录，不作为公开材料；本轮无提交、推送、合并或部署。

## 保留状态

七项 P2 为 VERIFIED_FIXED / INDEPENDENT_REVIEW_PASSED，等待用户验收；历史红灯不覆盖。
T4 IN_PROGRESS / OPEN、T7 OPEN、DEVICE_PENDING、Docker INCOMPLETE_FAILED、
T5-NB-001/002 OPEN_NONBLOCKING、高级恢复和新回收 REMAINDER_DEFERRED 均不变。
可报告本地合成功能工程交付及最终归档复核完成，不报告完整发布门禁全绿或真实家庭启用。
