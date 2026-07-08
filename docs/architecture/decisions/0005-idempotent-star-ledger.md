# ADR-0005: 星星使用不可变幂等流水

**Status:** Accepted
**Date:** 2026-06-18

## Context

任务确认和奖励兑换可能因网络重试重复执行。直接修改余额容易重复加星、重复扣减或并发覆盖。

## Decision

星星余额由不可变 StarLedgerEntry 求和得到。`familyId + childId + sourceType + sourceId + type` 建立唯一索引。任务首次确认以 taskId 幂等发放 1 星；兑换在事务中写 spend 流水并更新奖励，额外使用 idempotencyKey。

## Alternatives

- 在 User 上维护 balance：读取快，但重试和并发一致性复杂。
- 仅依赖客户端避免重复提交：不能防止超时重试或恶意请求。

## Consequences

余额读取需要聚合或缓存，但审计和恢复清晰。任务确认跨服务失败时保留 `starAwardState=pending` 并允许安全重试。

## Validation

重复确认只产生一条 earn；重复兑换只产生一条 spend；余额不足不写流水；事务失败不留下半完成兑换。
