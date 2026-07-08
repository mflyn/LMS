# ADR-0004: MVP 每条成长任务表示一次发生

**Status:** Accepted
**Date:** 2026-06-18

## Context

单一任务状态无法准确表达重复任务每次发生的完成、反馈和统计。直接增加 repeatRule 会让“本周完成 4/7 次”等状态产生歧义。

## Decision

MVP 的 GrowthTask 只表示一次发生，不包含 repeatRule。每日习惯由每天一条任务表达。重复能力进入后续阶段时使用独立模板生成 occurrence，每个 occurrence 拥有自己的状态和证据。

## Alternatives

- 在单条任务上保存 repeatRule 和一个状态：简单但丢失每次发生数据。
- MVP 同时实现模板和 occurrence：正确但超出当前闭环所需范围。

## Consequences

MVP 状态机和周报统计确定，创建重复规则返回 `400 REPEAT_RULE_NOT_SUPPORTED`。家长需要创建单次任务或由后续模板能力生成。

## Validation

模型不包含 repeatRule；创建和编辑接口拒绝该字段；任务完成和确认只影响一个 occurrence。
