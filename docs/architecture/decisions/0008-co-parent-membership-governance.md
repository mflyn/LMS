# ADR-0008: 第二家长成员关系与治理

**Status:** Accepted
**Date:** 2026-07-16

## Context

Task 12 允许两位家长共同管理一个家庭，同时要求邀请可撤销、只能使用一次，成员变更
立即生效并保留审计历史。现有 `User.familyId` 和 `User.children` 被旧代码读取，但它们
可能与 `Family.memberParentIds`、`Family.childIds` 漂移。父级 JWT 或 Gateway 身份信封
中的家庭声明也不能成为授权依据，否则退出或被移除的家长可能在 token 过期前继续访问。

## Decision

- 邀请使用 256 位随机 opaque token，只保存 SHA-256 摘要和持久生命周期；不使用
  自包含 JWT 邀请。
- `Family.memberParentIds` 和 `Family.childIds` 分别是家长成员关系和孩子关系的权威源。
  `User.familyId`、`User.children` 和默认孩子仅是事务内同步的身份/兼容投影，授权不得
  读取 `User.children`。
- 邀请接受、退出、移除、所有权转移及相关投影和审计事件由 user-service 在同一
  MongoDB 副本集事务中提交。当前部署边界不采用跨服务 saga。
- 两位家长拥有相同日常业务权限；当前 owner 额外持有邀请、撤销、移除和所有权转移
  权限。成员历史通过不可变 `FamilyMembershipEvent` 保留。
- 父级 access token 和 Gateway 身份信封不携带可用于授权的 `familyId`。所有下游服务，
  包括 resource-service，都必须按已认证 parent ID 实时查询 Family 的 owner/member
  关系，并忽略客户端或旧 token 提供的父级家庭声明。
- 不在 user-service 启动时扫描全部关系。每次关系写入都事务同步投影；发布前修复命令
  提供 `--check` 模式，发现待修复项或冲突时返回非零。修复并通过检查后才能启用
  Task 12 路由和 UI。
- 邀请明文只进入 URL fragment 和脱敏 POST 请求体。登录或注册回跳使用 Router location
  保存 fragment，成功接受后替换历史记录，且不得写入浏览器持久存储。

## Alternatives

- JWT 邀请：无需数据库读取，但不能可靠支持单次使用、撤销和审计。
- 启动时全库断言：能较早发现漂移，但会让可修复历史数据阻断整个 user-service 启动，
  且启动成本随数据量增长。
- 只依赖 `User.familyId` 或 token `familyId`：读取便宜，但投影漂移或成员退出后会产生
  越权窗口。
- 跨服务 saga：适用于不同数据库的所有权边界，但当前成员、邀请、User 投影和事件均由
  user-service 的同一副本集持有，引入补偿状态没有收益。

## Consequences

成员变更要求事务型 MongoDB。普通家庭请求会承担一次实时 Family 关系查询；这是立即
撤权和统一授权语义的必要成本。兼容投影仍需维护和发布前检查，但漂移不会成为授权绕过。
未来删除旧投影或拆分数据库时，需要新的 ADR 和迁移方案。

## Validation

测试覆盖邀请摘要、统一失效响应、并发单赢家、事务回滚、两家长投影同步、`--check`
退出码、超过两位候选成员冲突、父级伪造/陈旧 `familyId`、移除后媒体访问拒绝，以及
登录/注册 fragment 保留和成功接受后的历史替换。
