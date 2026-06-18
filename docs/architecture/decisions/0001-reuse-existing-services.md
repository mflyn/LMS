# ADR-0001: MVP 复用现有服务和共享 MongoDB

**Status:** Accepted
**Date:** 2026-06-18

## Context

项目已有 user、homework、progress、analytics、notification、resource 和 gateway 服务。家庭版需要尽快形成稳定闭环，同时避免为尚未验证的规模增加新服务和数据库运维成本。

## Decision

MVP 复用现有服务目录和共享 MongoDB。每个服务仍是其集合的唯一写入方；跨域聚合只通过受限只读仓储读取带 `familyId + childId` 条件的最小投影。内部命令使用服务认证，不通过公开 gateway 暴露。

## Alternatives

- 新建 family-service：边界直观，但增加部署、迁移和联调成本。
- 允许服务直接导入其他服务模型写入：实现快，但破坏所有权和未来拆库能力。

## Consequences

共享数据库降低 MVP 成本，但必须通过代码审查和测试约束写入边界。未来拆库时只读仓储替换为内部 API 或事件读模型，公开契约不变。

## Validation

审查跨服务导入；测试只读仓储强制 familyId、childId、投影和超时；确认每个集合只有一个写入服务。
