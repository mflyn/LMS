# 家庭成长跟踪 API 文档

## 当前权威契约

- [家庭成长跟踪 API 契约](./family-learning-tracker-api.md)：定义家长、孩子、
  五育任务、成长记录、错题、周报、私有媒体、提醒、星星和奖励接口。
- [总体架构](../architecture/family-learning-tracker-architecture.md)：定义服务边界、
  数据归属、身份信任边界和状态机。
- [设计资产索引](../development/family-growth-design-asset-index.md)：从 Requirement
  反向导航到 API、设计、测试和 gate。

接口示例的结构会由
`backend/common/contracts/__tests__/apiExamples.test.js` 进行契约校验。修改公开请求、
响应、错误或权限规则时，必须同时更新 API 契约、对应详细设计、测试用例和需求
追踪记录。

## 历史边界

旧学校版的教师、班级、成绩、作业批改、公开资源和家校互动接口不属于当前家庭
成长 MVP 契约。不要使用历史示例域名、测试账号或通用 `code/message/data` 响应
替代当前契约。

## 拟议 AI 学习扩展

[家庭 AI 学习平台设计](../architecture/family-ai-learning-platform-design.md#11-api-设计草案)
包含课程映射、教学闭环和生成任务的 API 草案。这些路由目前**不是权威契约，也不代表
代码已实现**。只有完成独立设计批准、权限/拒绝路径测试、需求追踪和发布 Gate 后，才可
将相应接口移入本目录的当前权威契约。
