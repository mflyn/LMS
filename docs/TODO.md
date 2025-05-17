# 后端功能待办事项 (Backend TODO)

## 认证与用户管理 (Auth & User Management)
- [ ] 实现密码重置功能 (Forgot Password / Reset Password Flow)
  - [ ] 更新 User 模型添加 `passwordResetToken` 和 `passwordResetExpires` 字段。
  - [ ] `UserService`: 添加 `forgotPassword` 方法 (生成令牌、保存用户、模拟邮件发送)。
  - [ ] `UserService`: 添加 `resetPassword` 方法 (验证令牌、更新密码)。
  - [ ] `AuthController`: 添加 `forgotPassword` 和 `resetPassword` 控制器方法。
  - [ ] `auth.js` (路由): 添加 `/forgot-password` 和 `/reset-password/:token` 路由。

## 其他待办
- [ ] (在此处添加其他未来功能或改进项) 