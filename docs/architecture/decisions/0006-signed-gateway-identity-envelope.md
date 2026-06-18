# ADR-0006: Gateway 使用签名身份信封调用下游

**Status:** Accepted
**Date:** 2026-06-18

## Context

下游服务当前读取 `x-user-id` 和 `x-user-role`。如果这些头可由客户端注入或直接访问下游伪造，攻击者可以冒充任意家长或孩子。

## Decision

gateway 在验证 JWT 前删除全部客户端身份和内部认证头，验证后生成 HMAC-SHA256 身份信封，覆盖 HTTP 方法、规范化路径、用户 ID、角色、时间戳和随机 nonce。下游使用独立服务密钥验签，拒绝超过 5 分钟、签名不匹配和已使用 nonce。内部命令使用另一组服务凭据。

## Alternatives

- 只依赖网络隔离：不能防止错误暴露、内部伪造或代理配置缺陷。
- 下游直接验证用户 JWT：安全边界清晰，但当前需要在所有服务重复 JWT 配置和迁移。
- mTLS：长期合适，但超出本地 MVP 部署复杂度。

## Consequences

下游不再信任裸 `x-user-*`。服务需要共享签名规范、短期 nonce 存储和时钟容差。未来可迁移到 mTLS 或下游 JWT 验证，业务授权接口不变。

## Validation

测试客户端伪造头被覆盖、直接下游伪造被拒绝、签名篡改被拒绝、过期被拒绝、nonce 重放被拒绝和合法 gateway 请求通过。任一失败为 BLOCKER。
