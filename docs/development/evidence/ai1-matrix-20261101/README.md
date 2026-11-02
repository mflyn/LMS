# AI-1 当前矩阵证据归并

状态：LOCAL_MATRIX_REVIEWED / ENGINEERING_REVIEW_READY；B/D/AI-1 OPEN。
manifest保留冻结时的PENDING状态，不回写为执行结果；本记录及verification.json承接后续结果。

本批为现有要求的7项证据缺口补证，不修改产品代码、不新增测试框架。
LMS基线`1d49abb11580172fa86a7e282cb31588bf682027`，DeepTutor基线`f7aed0744c36c5afef16a4261c31ebee1208cac2`。
增量依赖前一双端恢复候选及其既有依赖链；旧包保持不变。

- `manifest.json`：4个测试文件增量、68项当前源码指纹、原文件hash及重建PASS。
- `candidate.patch`：SHA256 `aefea19d6aaba833b2b8f693cdc32071fcc6d9e2ea57c36a80b9326a0319e855`。
- manifest SHA256：`7d67a6c535b0c85014bc4e6b36c30ffebff6aee1588248b6f10d8fa2b68b0fa2`。
- 当前需求逐项核对见[测试方案§17](../../family-ai1-test-plan.md#17-当前35项工程归并与外部待验2026-11-01)。

## 直接验证

LMS Service使用真实临时Mongo事务；来源读取与远端协议为替身。
新增9个执行案例：claim提交后撤权、结算提交确认丢失、截止claim/释放提交确认丢失、
当前价格过期/替换后原价结算、task/mistake学科改变、可靠未发送拒绝丢响应后的原ID收敛。
撤权实际保留dispatching/reserved与发送槽，不将其写成unknown/reserved_unknown。

DeepTutor使用真实SQLite/OperationService；凭据轮换场景运行实际SDK，网络为计数替身。
新增3个执行案例：旧凭据401后更换合成凭据并重建不能重发；accepted后撤销profile/增价
可靠拒绝，恢复旧profile也不能改历史终态。没有实际模型请求。

作者完整相关套件：LMS 50 passed（9.539秒、exit0）；DeepTutor 76 passed（1.64秒、2 warnings、exit0）。
上述为12个新增执行案例加原回归，不是12项新需求，也不等于35项端到端独立执行。
独立静态复核未发现本增量新P1/P2；独立串行复验LMS 50 passed（9.327秒、exit0）、
DeepTutor 76 passed（1.16秒、1 warning、exit0）。68项指纹前后完全一致，无超时、强制清理或所属存活进程。
没有独立重跑全部历史HTTP/browser、变异或两仓全量；对应旧证据按未改源码复用。

文档永久反例先验证缺少当前矩阵时报错（1 failed、312未选、exit1），再补当前35项表，
保留§11历史表；检查两个表分别精确覆盖原35个唯一ID及外部待验状态。
不修改历史失败、冻结补丁或旧结果的退出码。
首次文档整套检查因改名历史§11导致旧锚点失效：8 failed、305 passed、exit1；恢复原标题与旧锚点。
第二次1 failed、312 passed：当前矩阵Restore行缺少校验认可的HTTP层标识；补明确实际HTTP性质，未改断言。
修订后文档整套313 passed（38.541秒、exit0）；状态脚本及两仓diff检查通过，原两轮失败仍保留。

冻结准备第一次因旧重建目录不含完整LMS候选而ENOENT，第二次因工作树写权限EPERM停止；
随后从D5原补丁重建所需文件并验证旧hash，再使用获准本机写上下文生成候选。两次准备失败
不是业务反例，也不算独立复验。无生产/网络/Git操作。

## 继续保留

真实qualified输入计数、当前模型/价格和本轮预算授权、家长内容及价值验收未完成。
AI-0人工审核及修订限制保留，10元授权不转移；没有真实计数资格时enabled拒绝。
历史家庭161/2套件、4980/2用例失败不变；DeepTutor根pytest历史缺依赖不以定向通过覆盖。
T4/T8 OPEN、T9 NOT_STARTED、DEVICE_PENDING、Docker INCOMPLETE_FAILED、T5-NB-001/002
OPEN_NONBLOCKING及高级恢复/新回收REMAINDER_DEFERRED不变；不提交推送合并部署。
