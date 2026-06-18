# ADR-0002: 家庭数据隔离由身份和资源归属共同决定

**Status:** Accepted
**Date:** 2026-06-18

## Context

家庭版包含多个家庭和同一家庭内多个孩子。只检查角色或信任请求中的 familyId 会产生跨家庭和兄弟姐妹越权风险。

## Decision

客户端提供的 familyId 只用于定位，不能授权。服务端从已验证身份找到所属家庭，并验证资源同时匹配 `familyId + childId`。家长只能访问本人家庭；孩子只能访问本人 childId；所有孩子数据同时持有两个归属字段。

## Alternatives

- 只依赖角色：无法隔离同角色用户。
- 只依赖 childId：无法防止错误或伪造的跨家庭关联。

## Consequences

每个查询需要显式归属条件，代码略增，但隔离规则可统一测试。旧 `children`、`parentId` 和 `class` 字段仅兼容，不作为家庭授权依据。

## Validation

使用两个家庭和同家庭两个孩子测试列表、详情、修改、完成、确认和删除；伪造 familyId 必须失败。
