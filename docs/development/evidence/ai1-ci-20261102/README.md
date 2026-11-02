# AI-1 双仓 CI 修订

本轮仅修复双仓 CI，用户授权验证、复评后推送原专用分支。不合并、不部署、不调用模型。
原冻结候选和历史失败不改写；QUALIFIED_COUNTER_PENDING、B/D/AI-1 OPEN、DEVICE_PENDING、
T4/T8 OPEN、Docker INCOMPLETE_FAILED、T5-NB-001/002 OPEN_NONBLOCKING及REMAINDER_DEFERRED保持。

## LMS 原失败与修复

- 原提交 `b898b513467fff501e37cf2b3faa340881644fd3`，
  [失败运行41446657081](https://github.com/mflyn/LMS/actions/runs/41446657081)。
- Task 11 模糊链接名称“记录”同时匹配导航“记录”和页面“讲解记录”，strict mode拒绝点击。
  原运行1 failed / 3 passed，不将失败归因于模型或掩盖为重跑通过。
- 本机原测试同样复现1 failed，exit1；日志SHA256
  `f026ba3737042e24fa0624a4d4f400df81146161ed99de8a6bab7d05582a6c61`。
- 修复仅限定到“家长导航”中的精确“记录”链接。永久保护要求页面讲解入口和导航成长记录入口各唯一、
  href分别为/app/tutor和/app/logs，并验证真实点击后URL。没有删除入口、使用first()、放宽超时或断言。
- 修订后原`playwright test --project=chromium`四条全部通过，17.9秒，exit0；日志SHA256
  `cc2b53c460e96732ae068871b2041502de67cea600a1ec6b65fc69e0f69f457c`。
  真实正式服务、临时Mongo和合成家庭，未mock页面成功；保留PIN失效、身份隔离及360px布局用例。
- 受影响文件ESLint、git diff --check通过。上述为开发验证，独立复评和新SHA CI另记，不预先宣称全量通过。

## DeepTutor 原失败分类

- 原提交 `8b71e281683dd5070a4d97ad4bf1582e8feb9560`，
  [失败运行41447420768](https://github.com/mflyn/DeepTutor/actions/runs/41447420768)。
- Ruff报告27项错误；修复验证单独记录，不用LMS的ESLint替代Python检查。
- 两个macOS作业取消的GitHub注释为hosted runner多次未分配及arm64容量不足；不是测试通过。
  Python全量矩阵因前置取消而skipped。保留矩阵，不通过删除macOS作业或忽略依赖失败取得绿灯。

原始日志及截图留本地，公开交付只含去标识化说明和摘要。新的CI结果以固定SHA的运行记录为准。

## LMS 独立复评

限定只读复评通过，未发现阻断问题或断言放宽。复评者重新计算两份日志摘要，
并检查Playwright transform cache的sourcesContent：红灯与b898b513测试源码一致，绿灯与修订源码一致。
node --check、diff检查及新增文档链接检查通过；独立复评没有重跑E2E或冒充新的全量结果。
讲解记录仅验证入口及目标地址，不把此用例当作讲解业务完整验收。允许提交新SHA进行CI重验，未关闭总门禁。
