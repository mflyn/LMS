# PR #31 CI 修订证据

**Base:** ed1dc894154f83f01f57b704e3cbbbc2898753f3
**Scope:** BRANCH_PR_ONLY / NO_MERGE / NO_DEPLOY
**Validation scope:** LOCAL_SYNTHETIC_ONLY

## 问题与修复

1. 旧 Task 11 用例按全页任务名称找链接，T5 新增同名入口后歧义。
   定位改为“今天的任务”可访问区域；断言该区域及“今日计划”分别只有一个目标链接、href 相同，
   不以 first() 隐藏歧义，不删除原作品/PDF/审核断言。
2. PIN 重置后的真实 401 可先在旧页面被处理，随后刷新重建 Provider 时内存提示归零。
   已有 student session-change 标记保存 expired 原因；仅当没有有效孩子会话时读此原因恢复通用提示。
   不恢复 token/孩子数据，不修改标记写入、退出清理、原命令或家庭权限。显式退出与新登录覆盖原因，
   迟到旧 401 仍被原快照检查拒绝。没有新增存储协议或会话恢复框架。

## 验证记录

原 CI [40436134961](https://github.com/mflyn/LMS/actions/runs/40436134961) 失败不覆盖。
本轮使用 Node 22.15.0、合成家庭、临时 MongoDB、真实正式应用 HTTP；Browser plugin 未列出，
复用现有 Playwright 工具。浏览器模拟不是 iPad 真机。

| 记录 | 命令/范围 | 结果 |
| --- | --- | --- |
| baseline-e2e | `npm run test:family-flow:e2e`，未修复候选 | 1 failed / 3 passed；同名链接失败，本轮 PIN 时序未触发 |
| context-red | 新 ChildAuthContext 永久用例 | 1 failed / 5 passed；重建后提示缺失 |
| expiry-red | 初版请求屏障真实 PIN 探针 | 1 failed；处理 401 后刷新提示缺失 |
| e2e-green | 初版五用例尝试 | 2 failed / 3 passed；一次性拦截可能选中取消请求，新增夹具累计触发共享 429；保留失败 |
| frontend | `npm --prefix frontend/web run test:ci -- --runInBand` | 50 suites / 634 passed |
| e2e-final | 复用原四用例、扩展 PIN 断言 | 4 passed |
| permanent-mutation | 临时将 Provider 错误初始化恢复为 null，运行最终 PIN 用例 | 1 failed，原第 98 行过期提示断言拦截；不是扩大超时或依赖重跑 |
| restored-e2e | 恢复修复后完整 Task 11 浏览器 | 4 passed |
| t5-browser | 当前构建 `npm run test:t2:e2e -- dailyLearningPlan.spec.js` | 9 passed |
| build | `npm --prefix frontend/web run build` | exit 0，既有工具链警告保留 |

最终永久浏览器用例不再拦截请求、不新增家庭夹具。在原 PIN 流程已验证退出和提示之后再次刷新，
建立“401 在刷新前已处理”的确定前提；随后验证无私有导航、旧 PIN 拒绝、新 PIN 登录及家长页面保留。
原四个用例全部保留。新增六个组件用例覆盖重建提示、父会话不变、主动退出、新账号与迟到 401、
缺失/损坏变更标记，不放宽旧断言、规则、超时或限流。

## 自查和独立复核

自查确认：只新增非秘密状态读取和初始提示；身份鉴别、授权与原响应快照检查不变。
Nash 对五个相关文件完成独立静态复核，无可执行发现；对最终浏览器用例再复核，确认全部原断言保留。
其早期拦截测试描述由后续复核取代。独立复核未执行测试，运行结果属于开发线程，不混称独立测试。
哈希、红绿结果、复核摘要与归档位置见 [验证索引](validation.json)；原日志/截图保留在
`release-gate-artifacts/t5-ci-fix-2026-10-27/`，Git 仅纳入摘要与索引。旧冻结候选、补丁和关闭记录不重签。

## 保留边界与回滚

保留历史失败、DEVICE_PENDING、T5-NB-001/002 OPEN_NONBLOCKING、SL-04 PLANNED、
T8_PENDING / NOT_AUTHORIZED 和高级恢复/新回收 REMAINDER_DEFERRED，默认关闭配置不变。
不合并、不部署、不操作真实数据。本修订无 schema 或真实数据变更；如需回滚，撤回本修订提交即可，
但会重新出现已记录的 UI/CI 缺陷，不会因此恢复已失效会话。完整 CI 结论以新提交 Actions 为准。
