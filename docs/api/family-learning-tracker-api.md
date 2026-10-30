# 家庭成长跟踪 API 契约

**Document status:** APPROVED
**Baseline candidate:** FGT-MVP-1.7
**Normative requirements:** `docs/product/family-learning-tracker.md` section 10.4

## 1. 基本约定

第一阶段 API 服务于家庭成长跟踪 MVP，覆盖家长 Web 端和孩子简化入口。

基础约定：

- API 统一通过 `gateway` 暴露。
- 家长使用 `Authorization: Bearer <token>` 访问。
- 孩子使用 PIN 登录后获得孩子作用域 token。
- 家庭级数据必须携带 `familyId`。
- 孩子级数据必须携带 `familyId` 和 `childId`。
- 成长任务和成长记录必须携带 `dimension`。
- 客户端传入的 `familyId` 只用于定位，不作为授权依据；服务端必须从 token 和孩子归属关系推导并校验家庭范围。

成长维度枚举：

| 值 | 含义 |
| --- | --- |
| `moral` | 德育 |
| `academic` | 智育 |
| `physical` | 体育 |
| `artistic` | 美育 |
| `labor` | 劳育 |

通用响应格式：

```json
{
  "success": true,
  "data": {}
}
```

通用错误格式：

```json
{
  "success": false,
  "error": {
    "code": "CHILD_ACCESS_DENIED",
    "message": "无权访问该孩子的数据",
    "details": []
  }
}
```

状态码约定：参数错误返回 `400`，未登录或凭据错误返回 `401`，越权返回 `403`，资源不存在返回 `404`，状态冲突返回 `409`，检测到恶意内容返回 `422`，登录限流返回 `429`，跨域聚合或安全扫描暂不可用返回 `503`。错误 `code` 是稳定契约，`message` 只用于展示。

通用稳定错误码包括 `VALIDATION_ERROR`、`UNAUTHENTICATED`、`INVALID_IDENTITY_ENVELOPE`、`INVALID_SERVICE_CREDENTIAL`、`CHILD_ACCESS_DENIED`、`FIELD_ACCESS_DENIED`、`RESOURCE_NOT_FOUND`、`RESOURCE_CONFLICT`、`IDEMPOTENCY_KEY_REUSED`、`TASK_STATE_CONFLICT`、`REWARD_STATE_CONFLICT`、`REPEAT_RULE_NOT_SUPPORTED`、`INVALID_CHILD_CREDENTIALS`、`PIN_LOGIN_RATE_LIMITED`、`INSUFFICIENT_STARS`、`AGGREGATION_UNAVAILABLE`、`MEDIA_TYPE_NOT_ALLOWED`、`MEDIA_TOO_LARGE`、`PDF_INVALID`、`PDF_PAGE_LIMIT_EXCEEDED`、`PDF_ACTIVE_CONTENT_REJECTED`、`MALWARE_DETECTED`、`MALWARE_SCANNER_UNAVAILABLE`、`MEDIA_ATTACHMENT_LIMIT_EXCEEDED`、`MEDIA_REFERENCE_PENDING` 和 `STAR_AWARD_PENDING`。接口可以定义更具体的稳定 code，但不得退回仅有 message 的错误响应。

gateway 在代理前删除客户端提供的 `x-user-id`、`x-user-role`、`x-user-name` 和内部认证头。下游只接受 gateway 生成的签名身份信封；签名覆盖 HTTP 方法、规范化路径、用户 ID、角色、时间戳和 nonce。篡改、超过 5 分钟或 nonce 重放返回 `401 INVALID_IDENTITY_ENVELOPE`。该规则对应 `NFR-SEC-002`。

### 1.1 日期、时区和任务发生规则

- 家庭保存 IANA `timezone`，默认 `Asia/Shanghai`。
- `dueDate`、`GrowthLog.date`、`reviewReminderDate`、`weekStart` 等业务日期使用 `YYYY-MM-DD` 的 `LocalDate` 字符串。
- `scope=today` 按家庭时区计算；`scope=week` 从周一到周日，起止日均包含。
- `completedAt`、`confirmedAt` 等时间戳使用 UTC ISO 8601。
- 第一阶段每条成长任务只代表一次发生，不接受 `repeatRule`。每日或每周重复模板推迟到第二阶段；当前每日习惯由每天一条任务表达。

### 1.2 分页和列表响应

列表接口接受 `page` 和 `pageSize`，默认分别为 `1` 和 `20`，`pageSize` 最大为 `100`。列表响应统一返回 `items`、`page`、`pageSize` 和 `total`。

### 1.3 完整接口清单

| 接口 | 允许角色 | Requirement | 说明 |
| --- | --- | --- | --- |
| `POST /api/auth/register` | 公开 | `FR-FAM-003` | 注册家长 |
| `POST /api/auth/login` | 公开 | `FR-FAM-003` | 家长登录 |
| `POST /api/auth/logout` | 家长、孩子本人 | `FR-FAM-003`, `FR-UI-002` | 客户端清除 token；服务端返回幂等成功 |
| `POST /api/auth/child-pin-login` | 公开、限流 | `FR-CHILD-004`, `FR-CHILD-005` | 孩子 PIN 登录 |
| `POST /api/families` | 家长 | `FR-FAM-001`, `NFR-SEC-001` | 创建家庭 |
| `GET /api/families/me` | 家长 | `FR-FAM-002`, `NFR-SEC-001` | 获取家庭和孩子 |
| `PATCH /api/families/:familyId` | 家长 | `FR-FAM-002`, `NFR-SEC-001` | 修改自己的家庭 |
| `POST /api/families/:familyId/parent-invitations` | 家庭所有者 | `FR-FAM-004`, `NFR-DATA-003` | 创建第二家长一次性邀请 |
| `GET /api/families/:familyId/parent-invitations/active` | 家庭所有者 | `FR-FAM-004` | 查询有效邀请元数据 |
| `DELETE /api/families/:familyId/parent-invitations/:invitationId` | 家庭所有者 | `FR-FAM-005`, `NFR-DATA-003` | 撤销有效邀请 |
| `POST /api/parent-invitations/preview` | 已登录家长 | `FR-FAM-004` | 在脱敏请求体中提交 token 并预览邀请 |
| `POST /api/parent-invitations/accept` | 已登录家长 | `FR-FAM-004`, `NFR-DATA-003` | 在脱敏请求体中接受邀请并加入家庭 |
| `DELETE /api/families/:familyId/members/me` | 第二家长 | `FR-FAM-005`, `NFR-DATA-003` | 主动退出家庭 |
| `DELETE /api/families/:familyId/members/:parentId` | 家庭所有者 | `FR-FAM-005`, `NFR-DATA-003` | 移除第二家长 |
| `PATCH /api/families/:familyId/owner` | 家庭所有者 | `FR-FAM-005`, `NFR-DATA-003` | 转移家庭所有权 |
| `POST /api/children` | 家长 | `FR-CHILD-001`, `NFR-DATA-001` | 添加孩子 |
| `GET /api/children` | 家长 | `FR-CHILD-001`, `FR-CHILD-002` | 查询本家庭孩子 |
| `GET /api/children/:childId` | 家长、孩子本人 | `FR-CHILD-002`, `NFR-SEC-001` | 查看孩子档案 |
| `PATCH /api/children/:childId` | 家长 | `FR-CHILD-001`, `NFR-SEC-001` | 编辑孩子档案 |
| `POST /api/children/:childId/pin` | 家长 | `FR-CHILD-003`, `FR-CHILD-005` | 设置或重置孩子 PIN |
| `POST /api/growth-tasks` | 家长 | `FR-TASK-001`, `FR-TASK-002`, `FR-TASK-006` | 创建任务 |
| `GET /api/growth-tasks` | 家长、孩子本人 | `FR-TASK-003`, `NFR-TIME-001` | 查询任务 |
| `GET /api/growth-tasks/:taskId` | 家长、孩子本人 | `FR-TASK-003`, `NFR-SEC-001` | 查看任务 |
| `PATCH /api/growth-tasks/:taskId` | 家长 | `FR-TASK-002`, `FR-TASK-006` | 编辑任务 |
| `PATCH /api/growth-tasks/:taskId/complete` | 家长、孩子本人 | `FR-TASK-004` | 完成任务 |
| `PATCH /api/growth-tasks/:taskId/confirm` | 家长 | `FR-TASK-005`, `FR-REWARD-001` | 确认任务；Task 5 最终 MVP 幂等发放星星 |
| `DELETE /api/growth-tasks/:taskId` | 家长 | `FR-TASK-006` | 软取消 pending 或归档已完成任务 |
| `POST /api/growth-logs` | 家长、孩子本人 | `FR-LOG-001` | 创建成长记录 |
| `GET /api/growth-logs` | 家长、孩子本人 | `FR-LOG-001` | 查询成长记录 |
| `PATCH /api/growth-logs/:logId` | 按字段授权 | `FR-LOG-001` | 更新成长记录 |
| `POST /api/knowledge-points` | 家长 | `FR-POINT-001` | 创建知识点或能力点 |
| `GET /api/knowledge-points` | 家长、孩子本人 | `FR-POINT-001` | 查询知识点或能力点 |
| `PATCH /api/knowledge-points/:knowledgePointId` | 家长 | `FR-POINT-001` | 更新掌握程度 |
| `POST /api/mistakes` | 家长、孩子本人 | `FR-MISTAKE-001` | 创建错题 |
| `GET /api/mistakes` | 家长、孩子本人 | `FR-MISTAKE-001` | 查询错题 |
| `PATCH /api/mistakes/:mistakeId` | 按字段授权 | `FR-MISTAKE-001` | 更新订正和复习状态 |
| `GET /api/reports/weekly` | 家长、孩子本人 | `FR-REPORT-001` | 幂等计算或读取周报 |
| `PATCH /api/reports/weekly/:reportId/feedback` | 家长 | `FR-REPORT-001` | 更新周报反馈 |
| `POST /api/media` | 家长、孩子本人 | `FR-MEDIA-001`, `NFR-PRIVACY-001` | 上传私有图片或受限 PDF |
| `GET /api/media/:mediaId/access` | 家长、孩子本人 | `FR-MEDIA-001`, `NFR-PRIVACY-001` | 获取短时效授权读取地址 |
| `DELETE /api/media/:mediaId` | 家长、孩子本人 | `FR-MEDIA-002`, `NFR-PRIVACY-001` | 软删除私有媒体 |
| `POST /api/rewards` | 家长 | `FR-REWARD-002` | 创建家庭奖励 |
| `GET /api/rewards` | 家长、孩子本人 | `FR-REWARD-001`, `FR-REWARD-002` | 查询奖励、星星余额和流水 |
| `PATCH /api/rewards/:rewardId/redeem` | 家长 | `FR-REWARD-002` | 确认兑换并幂等扣减星星 |
| `GET /api/notifications/family` | 家长、孩子本人 | `FR-NOTIFY-001` | 派生家庭提醒 |
| `GET /api/notifications/settings` | 家长、孩子本人 | `FR-NOTIFY-002` | 查询家庭提醒设置 |
| `PATCH /api/notifications/settings` | 家长 | `FR-NOTIFY-002` | 更新家庭提醒设置 |
| `POST /api/internal/stars/award` | homework-service | `FR-REWARD-001`, `NFR-SEC-003`, `NFR-DATA-002` | 内部幂等星星发放，不通过 gateway |

`POST /api/auth/change-password` 是 `user-service` 暂时保留的账户兼容接口，成功时同样返回通用成功格式。该接口尚未进入家庭版 PRD 和 MVP 验收清单，不作为本基线中的承诺能力；后续如进入家庭端产品范围，必须先补充需求、角色约束和完整 API 契约。

## 2. Auth and Family

### 2.1 注册家长

`POST /api/auth/register`

请求：

```json
{
  "username": "parent_ming",
  "password": "parent123",
  "name": "小明妈妈",
  "email": "parent@example.com",
  "role": "parent"
}
```

响应：

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "parent_001",
      "username": "parent_ming",
      "name": "小明妈妈",
      "role": "parent"
    },
    "token": "jwt-token"
  }
}
```

### 2.2 家长登录

`POST /api/auth/login`

请求：

```json
{
  "username": "parent_ming",
  "password": "parent123"
}
```

响应：

```json
{
  "success": true,
  "data": {
    "token": "jwt-token",
    "user": {
      "id": "parent_001",
      "role": "parent",
      "name": "小明妈妈"
    }
  }
}
```

### 2.3 创建家庭

`POST /api/families`

请求：

```json
{
  "familyName": "小明的家",
  "timezone": "Asia/Shanghai",
  "familyRole": "guardian"
}
```

`familyRole` 可选，用于初始化创建者的家庭角色，允许值为
`father|mother|guardian|other`，默认 `guardian`。请求只接受
`familyName`、`timezone` 和 `familyRole`；`familyName` 去除首尾空白后必须为 1 至 50
个字符，`timezone` 必须是有效 IANA 名称。owner/member/childIds 等服务端字段会被拒绝。

响应：

```json
{
  "success": true,
  "data": {
    "family": {
      "familyId": "family_001",
      "familyName": "小明的家",
      "timezone": "Asia/Shanghai",
      "ownerParentId": "parent_001",
      "memberParentIds": ["parent_001"],
      "parents": [
        {
          "parentId": "parent_001",
          "name": "小明妈妈",
          "familyRole": "mother",
          "isOwner": true
        }
      ],
      "childIds": []
    }
  }
}
```

### 2.4 获取我的家庭

`GET /api/families/me`

响应：

```json
{
  "success": true,
  "data": {
    "family": {
      "familyId": "family_001",
      "familyName": "小明的家",
      "timezone": "Asia/Shanghai",
      "ownerParentId": "parent_001",
      "memberParentIds": ["parent_001"],
      "parents": [
        {
          "parentId": "parent_001",
          "name": "小明妈妈",
          "familyRole": "mother",
          "isOwner": true
        }
      ]
    },
    "children": [
      {
        "childId": "child_001",
        "name": "小明",
        "grade": 3,
        "avatarMediaId": null,
        "sportsPreferences": ["跳绳", "篮球"],
        "artInterests": ["钢琴"],
        "laborHabits": ["整理房间"],
        "moralGoals": ["按时睡觉"]
      }
    ],
    "defaultChildId": "child_001"
  }
}
```

### 2.5 添加孩子

`POST /api/children`

请求：

```json
{
  "name": "小明",
  "grade": 3,
  "school": "示例小学",
  "textbookVersion": "人教版",
  "interests": ["科学实验", "篮球"],
  "weakSubjects": ["数学"],
  "sportsPreferences": ["跳绳", "篮球"],
  "artInterests": ["钢琴"],
  "laborHabits": ["整理房间"],
  "moralGoals": ["按时睡觉"]
}
```

响应：

```json
{
  "success": true,
  "data": {
    "child": {
      "childId": "child_001",
      "familyId": "family_001",
      "name": "小明",
      "grade": 3,
      "sportsPreferences": ["跳绳", "篮球"],
      "artInterests": ["钢琴"],
      "laborHabits": ["整理房间"],
      "moralGoals": ["按时睡觉"]
    }
  }
}
```

### 2.6 设置或重置孩子 PIN

`POST /api/children/:childId/pin`

请求：

```json
{
  "pin": "4827"
}
```

PIN 必须为 4 至 6 位数字。服务端只保存带独立盐的密码哈希，不记录或返回明文 PIN。重置成功后必须增加孩子的 `tokenVersion`，使此前签发的孩子 token 失效。

响应：

```json
{
  "success": true,
  "data": {
    "childId": "child_001",
    "pinConfigured": true,
    "tokensRevoked": true
  }
}
```

### 2.7 孩子 PIN 登录

`POST /api/auth/child-pin-login`

请求：

```json
{
  "familyId": "family_001",
  "childId": "child_001",
  "pin": "1234"
}
```

安全规则：

- 按 `IP + familyId + childId` 限制 15 分钟内最多 5 次失败尝试；超限返回 `429 PIN_LOGIN_RATE_LIMITED`。
- 家庭、孩子或 PIN 任一错误统一返回 `401 INVALID_CHILD_CREDENTIALS`，不得暴露孩子是否存在。
- 成功后清除失败计数，孩子 token 有效期不超过 12 小时，并携带 `familyId`、`childId`、`role=student` 和 `tokenVersion`。

响应：

```json
{
  "success": true,
  "data": {
    "token": "child-scope-jwt-token",
    "child": {
      "childId": "child_001",
      "name": "小明"
    }
  }
}
```

### 2.8 退出、家庭更新和孩子档案契约

`POST /api/auth/logout` 无请求体，要求提供家长或孩子的 Bearer JWT，重复使用同一个仍有效的 token 调用均返回 `204` 且无响应体。JWT 第一阶段不维护服务端黑名单，客户端收到响应后必须删除对应家长或孩子 token；PIN 重置仍通过 `tokenVersion` 强制撤销孩子旧 token。缺少 token 返回 `401 UNAUTHENTICATED`，非家庭角色返回 `403 ACCESS_DENIED`。

`PATCH /api/families/:familyId` 只接受 `familyName`、`timezone`。`familyName` 去除首尾空白后必须为 1 至 50 个字符，`timezone` 必须是有效 IANA 名称；客户端不能修改 owner/member/childIds，也不能使用 `name` 别名。成功返回更新后的 family；跨家庭返回 `403 CHILD_ACCESS_DENIED`，目标不存在返回 `404 RESOURCE_NOT_FOUND`。

`GET /api/children?page=1&pageSize=20` 仅家长可用，返回标准分页结构；孩子调用返回 `403 CHILD_ACCESS_DENIED`。`GET /api/children/:childId` 对家长返回本人家庭孩子，对孩子只允许本人。

孩子详情的 `data.timezone` 返回经实时家庭归属验证的家庭 IANA 时区，供今日计划按家庭日期显示；
不从客户端时区或登录快照推断。该字段是只读元数据，不授权访问其他家庭或孩子。

`PATCH /api/children/:childId` 只允许家长修改 `name`、`avatarMediaId`、`grade`、`school`、`textbookVersion`、`interests`、`weakSubjects`、`sportsPreferences`、`artInterests`、`laborHabits`、`moralGoals`。`avatarMediaId` 必须是本家庭、同一 childId、`purpose=avatar` 的 active 媒体；不能修改 familyId、role、PIN 哈希或 tokenVersion，也不接受 `curriculumVersion`、`sportPreferences` 等别名。服务端在返回可用 avatarMediaId 前完成引用绑定；提交已保存但绑定暂未完成时返回 `503 MEDIA_REFERENCE_PENDING` 和 `details.resourceId`，相同 PATCH 可安全恢复。成功返回完整 child profile。

### 2.9 创建和查询第二家长邀请

`POST /api/families/:familyId/parent-invitations` 仅家庭所有者可用，请求体必须为
空对象或省略。家庭已有两位家长时返回 `409 FAMILY_PARENT_LIMIT_REACHED`；已有未过期
`pending` 邀请时返回 `409 FAMILY_INVITATION_ALREADY_ACTIVE`。服务端先把已超过
`expiresAt` 的 pending 行改为 `expired`，再创建一个 72 小时邀请。

成功响应只在本次请求返回明文 token：

```json
{
  "success": true,
  "data": {
    "invitation": {
      "invitationId": "invitation_001",
      "token": "one-time-base64url-token",
      "expiresAt": "2026-07-19T08:00:00.000Z"
    }
  }
}
```

客户端使用 token 构造 `/family/invitations#token=<token>` 链接。fragment 不随 HTTP
请求发送，因此不会进入 Gateway 或代理访问日志。服务端只保存 SHA-256 摘要，不得在
后续读取、请求体日志、错误或审计事件中返回 token 或摘要。

`GET /api/families/:familyId/parent-invitations/active` 仅所有者可用。存在有效邀请时返回：

```json
{
  "success": true,
  "data": {
    "invitation": {
      "invitationId": "invitation_001",
      "status": "pending",
      "createdAt": "2026-07-16T08:00:00.000Z",
      "expiresAt": "2026-07-19T08:00:00.000Z"
    }
  }
}
```

没有有效邀请时 `invitation` 为 `null`。

### 2.10 撤销第二家长邀请

`DELETE /api/families/:familyId/parent-invitations/:invitationId` 仅所有者可用。有效
pending 邀请进入 `revoked` 并返回 `204`。不存在、过期、已接受或已撤销统一返回
`409 FAMILY_INVITATION_NOT_ACTIVE`，且不生成重复撤销事件。

### 2.11 预览和接受邀请

`POST /api/parent-invitations/preview` 要求已登录家长，请求体只接受 `token`。token
字段必须进入日志脱敏名单。可用时返回最小预览：

```json
{
  "success": true,
  "data": {
    "invitation": {
      "familyName": "小明的家",
      "owner": { "name": "小明妈妈" },
      "expiresAt": "2026-07-19T08:00:00.000Z"
    }
  }
}
```

`POST /api/parent-invitations/accept` 请求：

```json
{
  "token": "one-time-base64url-token",
  "familyRole": "father"
}
```

`familyRole` 必须为 `father|mother|guardian|other`。加入身份只取认证家长，不接受
parentId、familyId、memberParentIds 或 children。成功返回更新后的 `family`，其
`parents` 包含两位安全摘要。家长 JWT 不需要刷新；后续服务通过实时 Family 关系授权。
两个邀请端点在解析 token 前先校验认证身份为家长；确认现有家庭归属时只查询权威的
`Family.ownerParentId/memberParentIds`，不使用兼容投影 `User.familyId`。

格式有效但未知、过期、撤销或已使用 token 对预览和接受均返回
`409 FAMILY_INVITATION_NOT_ACTIVE`。两端点及四种失效状态的 HTTP 状态、
`error.code`、`error.message` 和 `error.details` 必须完全一致，只有 `requestId` 可不同：

```json
{
  "success": false,
  "error": {
    "code": "FAMILY_INVITATION_NOT_ACTIVE",
    "message": "Invitation is not active",
    "details": []
  },
  "requestId": "request-specific-id"
}
```

失效 token 的判定先于接受账号的家庭资格校验；缺失或格式错误的 token 仍返回 `400`。
响应不得透露 token 是否曾存在、先前状态、家庭、创建者或接受者。账号已属于任一家庭返回
`409 PARENT_ALREADY_IN_FAMILY`；家庭已满返回 `409 FAMILY_PARENT_LIMIT_REACHED`。

### 2.12 第二家长退出

`DELETE /api/families/:familyId/members/me` 仅当前非所有者成员可用，成功原子清理成员
关系和 User 兼容投影并返回 `204`。所有者调用返回 `409 OWNER_TRANSFER_REQUIRED`。
历史业务记录和操作者 ID 保留。

### 2.13 所有者移除第二家长

`DELETE /api/families/:familyId/members/:parentId` 仅所有者可用，目标必须是当前非所有者
成员。成功返回 `204`。移除自己返回 `409 OWNER_TRANSFER_REQUIRED`；目标不是有效成员
返回 `404 FAMILY_MEMBER_NOT_FOUND`。被移除家长的下一次家庭请求立即失去权限。

### 2.14 转移家庭所有权

`PATCH /api/families/:familyId/owner` 仅所有者可用，请求：

```json
{
  "newOwnerParentId": "parent_002"
}
```

目标必须是当前第二家长。成功返回更新后的 family 和 parents；两位成员仍保留在
`memberParentIds`。目标无效返回 `404 FAMILY_MEMBER_NOT_FOUND`，非所有者调用返回
`403 FAMILY_GOVERNANCE_DENIED`。

### 2.15 成员治理错误和事务边界

创建、接受、撤销、退出、移除和转移都在事务副本集上执行。Family、User、邀请状态
和 `FamilyMembershipEvent` 必须全部提交或全部回滚；并发接受最多一个请求成功。
治理拒绝统一使用 `403 FAMILY_GOVERNANCE_DENIED`。邀请错误不得通过不同 code 或
message 暴露 token 曾经存在、由谁创建或由谁接受。

家长注册、登录和邀请接受不签发包含授权性 `familyId` 的 access token；Gateway 父级
身份信封同样只传递账户和角色身份。所有下游服务必须按认证 parent ID 实时查询
`Family.ownerParentId` 或 `Family.memberParentIds`。resource-service 必须忽略父级
`identity.familyId` 和旧 `User.familyId` 授权捷径；伪造或陈旧家庭声明不得扩大媒体访问。
因此接受邀请无需刷新 token，退出或移除后的下一次请求立即失权。孩子身份信封仍保留
`familyId`、`childId` 和 `tokenVersion`。

## 3. Growth Tasks

### 3.1 创建成长任务

`POST /api/growth-tasks`

请求：

```json
{
  "childId": "child_001",
  "dimension": "physical",
  "area": "跳绳",
  "title": "跳绳 500 个",
  "taskType": "exercise",
  "description": "分 3 组完成，注意热身",
  "dueDate": "2026-06-18",
  "estimatedMinutes": 20,
  "targetAmount": 500,
  "unit": "count",
  "priority": "medium",
  "attachmentMediaIds": ["media_task_001"]
}
```

响应：

```json
{
  "success": true,
  "data": {
    "task": {
      "taskId": "task_001",
      "familyId": "family_001",
      "childId": "child_001",
      "dimension": "physical",
      "area": "跳绳",
      "title": "跳绳 500 个",
      "status": "pending",
      "estimatedMinutes": 20,
      "targetAmount": 500,
      "unit": "count",
      "parentConfirmed": false
    }
  }
}
```

智育任务示例：

```json
{
  "childId": "child_001",
  "dimension": "academic",
  "subject": "数学",
  "area": "分数计算",
  "title": "完成分数计算练习",
  "taskType": "practice",
  "dueDate": "2026-06-18",
  "estimatedMinutes": 30,
  "targetAmount": 20,
  "unit": "questions"
}
```

请求中出现 `repeatRule` 时返回 `400 REPEAT_RULE_NOT_SUPPORTED`。第一阶段不静默忽略重复规则。

`attachmentMediaIds` 可选，最多 100 项；每项必须是本家庭、同一 childId、active、purpose=`task_attachment` 的图片或 PDF。该字段通过资源引用协议绑定，提交已保存但绑定暂未完成时返回 `503 MEDIA_REFERENCE_PENDING` 和 `details.resourceId`。不得接受任意 URL 或未验证元数据。任务带有稳定附件绑定时，完成、确认、取消或归档仍必须保留相同附件顺序和引用代次。

### 3.2 查询成长任务

`GET /api/growth-tasks?childId=child_001&scope=today&dimension=physical`

响应：

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "taskId": "task_001",
        "dimension": "physical",
        "area": "跳绳",
        "title": "跳绳 500 个",
        "dueDate": "2026-06-18",
        "status": "pending",
        "targetAmount": 500,
        "unit": "count"
      }
    ],
    "page": 1,
    "pageSize": 20,
    "total": 1
  }
}
```

### 3.3 完成成长任务

`PATCH /api/growth-tasks/:taskId/complete`

请求：

```json
{
  "actualMinutes": 18,
  "actualAmount": 520,
  "unit": "count",
  "difficulty": "normal",
  "needsHelp": false,
  "childNote": "最后一组有点累，但完成了"
}
```

响应：

```json
{
  "success": true,
  "data": {
    "task": {
      "taskId": "task_001",
      "status": "completed",
      "actualMinutes": 18,
      "actualAmount": 520,
      "difficulty": "normal",
      "needsHelp": false,
      "completedAt": "2026-06-18T10:00:00.000Z",
      "parentConfirmed": false
    }
  }
}
```

### 3.4 家长确认成长任务

`PATCH /api/growth-tasks/:taskId/confirm`

以下响应是 Task 5 完成后的最终 MVP 契约。Task 4 符合性只验证家长确认、反馈和状态转换；星星发放归属 `FR-REWARD-001`，在 Task 5 验收。

请求：

```json
{
  "parentFeedback": "完成得很认真，明天继续保持节奏"
}
```

响应：

```json
{
  "success": true,
  "data": {
    "task": {
      "taskId": "task_001",
      "status": "confirmed",
      "parentConfirmed": true,
      "parentFeedback": "完成得很认真，明天继续保持节奏",
      "confirmedAt": "2026-06-18T10:30:00.000Z",
      "starAwardState": "awarded"
    },
    "starAward": {
      "amount": 1,
      "starBalance": 42
    }
  }
}
```

### 3.5 任务详情、编辑和取消/归档

`GET /api/growth-tasks/:taskId` 返回与列表 item 相同的完整 task；家长只能访问本人家庭，孩子只能访问本人任务。

`PATCH /api/growth-tasks/:taskId` 仅家长可用，只接受创建接口中的可编辑计划字段：`dimension`、`area`、`subject`、`title`、`taskType`、`description`、`dueDate`、`estimatedMinutes`、`targetAmount`、`unit`、`priority`、`attachmentMediaIds`。只允许 `pending` 状态编辑；终态返回 `409 TASK_STATE_CONFLICT`。附件必须是本家庭、同一 childId、active 且 purpose 为 `task_attachment` 的媒体；替换先绑定新集合再解绑旧集合，未完成绑定按 `503 MEDIA_REFERENCE_PENDING` 恢复。

`DELETE /api/growth-tasks/:taskId` 无请求体。`pending` 转为 `cancelled` 并记录 `cancelledAt`；`completed|confirmed` 转为 `archived`；`cancelled|archived` 重试返回当前任务，不产生第二次状态变化。响应始终为 `200`：

```json
{
  "success": true,
  "data": {
    "deleted": false,
    "task": { "taskId": "task_001", "status": "cancelled", "cancelledAt": "2026-06-19T09:00:00.000Z" }
  }
}
```

任务状态枚举为 `pending|completed|confirmed|cancelled|archived`。任何家庭成长任务都不得物理删除。

## 4. Growth Logs

### 4.1 创建每日成长记录

`POST /api/growth-logs`

创建与更新使用同一字段权限：家长可提交全部业务字段；孩子只可提交 `childId`（且必须为本人）、`date`、`dimension`、`area`、`subject`、`content`、`durationMinutes`、`amount`、`unit`、`completedTaskIds`、`focusLevel`、`difficulty`、`physicalState`、`mood`、`childReflection`。孩子提交 `parentNote`、familyId 或审计字段返回 `403 FIELD_ACCESS_DENIED`，不能静默忽略。

请求：

```json
{
  "childId": "child_001",
  "date": "2026-06-18",
  "dimension": "artistic",
  "area": "钢琴",
  "content": "练习拜厄第 20 条",
  "durationMinutes": 30,
  "amount": 1,
  "unit": "practice",
  "completedTaskIds": ["task_003"],
  "focusLevel": "good",
  "difficulty": "normal",
  "physicalState": "normal",
  "mood": "happy",
  "childReflection": "今天节奏更稳了",
  "parentNote": "主动开始练习，状态不错"
}
```

响应：

```json
{
  "success": true,
  "data": {
    "log": {
      "logId": "log_001",
      "familyId": "family_001",
      "childId": "child_001",
      "date": "2026-06-18",
      "dimension": "artistic",
      "area": "钢琴",
      "durationMinutes": 30,
      "mood": "happy"
    }
  }
}
```

### 4.2 查询成长记录

`GET /api/growth-logs?childId=child_001&from=2026-06-17&to=2026-06-23`

响应：

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "logId": "log_001",
        "date": "2026-06-18",
        "dimension": "artistic",
        "area": "钢琴",
        "durationMinutes": 30,
        "mood": "happy"
      }
    ],
    "page": 1,
    "pageSize": 20,
    "total": 1
  }
}
```

查询参数：

- `childId`：家长必填；孩子 token 固定为本人，提交其他孩子返回 `403 CHILD_ACCESS_DENIED`。
- `from`、`to`：可选 LocalDate；同时提供时 `from` 不得晚于 `to`。
- `dimension`：可选五育枚举。
- `page`、`pageSize`：遵循通用分页约定。

### 4.3 更新成长记录

`PATCH /api/growth-logs/:logId`

家长可以更新所有业务字段。孩子只能更新 `content`、`durationMinutes`、`amount`、`unit`、`completedTaskIds`、`focusLevel`、`difficulty`、`physicalState`、`mood` 和 `childReflection`；提交 `parentNote`、归属字段或审计字段返回 `403 FIELD_ACCESS_DENIED`。

请求示例：

```json
{
  "durationMinutes": 35,
  "focusLevel": "good",
  "childReflection": "第二遍练习更流畅"
}
```

成功返回完整 `data.log`。不存在返回 `404 RESOURCE_NOT_FOUND`，其他家庭或兄弟姐妹访问返回 `403 CHILD_ACCESS_DENIED`。

## 5. Knowledge and Ability Points

### 5.1 创建知识点或能力点

`POST /api/knowledge-points`

请求：

```json
{
  "childId": "child_001",
  "dimension": "labor",
  "area": "家务",
  "name": "整理房间",
  "masteryLevel": "learning"
}
```

智育点必须提供 `subject`，其他维度必须提供 `area`。同一家庭、孩子、维度、subject、area 和 name 重复时返回 `409 RESOURCE_CONFLICT`。

### 5.2 查询知识点或能力点

`GET /api/knowledge-points?childId=child_001&dimension=labor&area=家务&masteryLevel=learning&page=1&pageSize=20`

家长可以查询本人家庭孩子，孩子只能查询本人。可按 `dimension`、`subject`、`area` 和 `masteryLevel` 筛选，返回通用列表结构。

### 5.3 更新知识点或能力点

`PATCH /api/knowledge-points/:knowledgePointId`

仅家长可更新 `masteryLevel`、`practiceCount`、`mistakeCount` 和 `lastReviewedAt`。计数必须为非负整数，`lastReviewedAt` 使用 UTC ISO 8601。孩子更新返回 `403 CHILD_ACCESS_DENIED`。

请求示例：

```json
{
  "masteryLevel": "skilled",
  "practiceCount": 8,
  "lastReviewedAt": "2026-06-18T12:00:00.000Z"
}
```

响应：

```json
{
  "success": true,
  "data": {
    "knowledgePoint": {
      "knowledgePointId": "kp_001",
      "familyId": "family_001",
      "childId": "child_001",
      "dimension": "labor",
      "area": "家务",
      "name": "整理房间",
      "masteryLevel": "skilled"
    }
  }
}
```

## 6. Mistakes

错题是智育专项能力。错题记录的 `dimension` 固定为 `academic`。

### 6.1 创建错题

`POST /api/mistakes`

家长可提交全部已记录的业务字段。孩子创建错题时必须提交 `subject` 和 `reason`，并可同时提交 `questionMediaIds`、`childAnswerMediaIds`、`corrected`、`reviewed`、`mastered`、`reviewReminderDate`、`childExplanation`；创建后孩子不能修改 `subject` 或 `reason`。`familyId` 与孩子调用时的 `childId` 必须由已验证的孩子 token 派生，不接受页面选择或覆盖。

请求：

```json
{
  "childId": "child_001",
  "subject": "数学",
  "knowledgePointName": "分数计算",
  "questionMediaIds": ["media_question_001", "media_question_002"],
  "childAnswerMediaIds": ["media_answer_001"],
  "correctAnswer": "3/4",
  "reason": "calculation",
  "corrected": false,
  "reviewReminderDate": "2026-06-21",
  "parentNote": "通分时漏了一步",
  "childExplanation": "我把分母看错了"
}
```

响应：

```json
{
  "success": true,
  "data": {
    "mistake": {
      "mistakeId": "mistake_001",
      "familyId": "family_001",
      "childId": "child_001",
      "dimension": "academic",
      "subject": "数学",
      "knowledgePointName": "分数计算",
      "reason": "calculation",
      "questionMediaIds": ["media_question_001", "media_question_002"],
      "childAnswerMediaIds": ["media_answer_001"],
      "questionMediaId": "media_question_001",
      "childAnswerMediaId": "media_answer_001",
      "corrected": false,
      "reviewed": false,
      "mastered": false,
      "reviewReminderDate": "2026-06-21"
    }
  }
}
```

`questionMediaIds` 与 `childAnswerMediaIds` 是规范字段，每组最多 10 个唯一 mediaId，保留首次出现顺序。历史单值请求 `questionMediaId`、`childAnswerMediaId` 仍可单独使用并归一化为数组；同一组不得同时提交数组和单值。响应始终返回两个规范数组，并把数组第一项投影到兼容单值字段；空数组时兼容字段省略。

### 6.2 查询错题

`GET /api/mistakes?childId=child_001&subject=数学&reviewStatus=pending`

`reviewStatus` 可选值为 `pending|reviewed|mastered`，且互斥：`pending` 表示 `mastered=false && reviewed=false`，`reviewed` 表示 `mastered=false && reviewed=true`，`mastered` 表示 `mastered=true`。复习日期范围是独立的家庭 LocalDate 筛选条件。

响应：

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "mistakeId": "mistake_001",
        "subject": "数学",
        "knowledgePointName": "分数计算",
        "reason": "calculation",
        "reviewReminderDate": "2026-06-21",
        "mastered": false
      }
    ],
    "page": 1,
    "pageSize": 20,
    "total": 1
  }
}
```

### 6.3 更新错题

`PATCH /api/mistakes/:mistakeId`

家长可更新 `knowledgePointId`、`knowledgePointName`、`questionMediaIds`、`childAnswerMediaIds`、对应历史单值别名、`correctAnswer`、`reason`、`corrected`、`reviewed`、`reviewReminderDate`、`mastered`、`parentNote`、`childExplanation`。孩子本人可更新两个规范附件数组或对应单值别名，以及 `corrected`、`reviewed`、`reviewReminderDate`、`mastered`、`childExplanation`；提交家长专属字段返回 `403 FIELD_ACCESS_DENIED`。媒体引用必须 active、属于同一 familyId/childId，且 purpose 分别匹配 `mistake_question|mistake_answer`。数组替换以顺序为契约：新增引用先绑定，业务对象和状态事件在本地事务中发布，移除引用最后释放；中断后相同请求可恢复。成功返回更新后的 mistake；非法状态或字段组合返回 `400 VALIDATION_ERROR`，每组超过 10 项返回 `400 MEDIA_ATTACHMENT_LIMIT_EXCEEDED`。

## 7. Weekly Reports

### 7.1 计算或读取成长周报

`GET /api/reports/weekly?childId=child_001&weekStart=2026-06-15`

`weekStart` 必须是家庭时区中的周一。该 GET 操作对调用者保持安全和幂等：统计字段由源数据确定性计算，可以更新内部缓存，但不得产生星星、提醒或其他业务副作用。缓存键为 `familyId + childId + weekStart`。当前周随源数据失效重算；已结束周首次生成后冻结。

固定公式：计划分母为 dueDate 在周内、周末前已创建且未在周末前取消的任务；完成分子还要求 completedAt 不晚于周末。分母为 0 时 `taskCompletionRate=null`；否则百分比按 half-up 规则最多保留两位小数，例如 `2/3` 返回 `66.67`。时长只汇总周内 GrowthLog.durationMinutes，不叠加任务 actualMinutes。取消、补完成或复习状态变化发生在周末之后时，不改写历史周。

响应：

```json
{
  "success": true,
  "data": {
    "report": {
      "reportId": "report_001",
      "familyId": "family_001",
      "childId": "child_001",
      "weekStart": "2026-06-15",
      "weekEnd": "2026-06-21",
      "statistics": {
        "recordDays": 6,
        "totalDurationMinutes": 520,
        "taskCompletionRate": 80,
        "dimensionTaskStats": {
          "moral": { "completed": 4, "planned": 7, "durationMinutes": 0 },
          "academic": { "completed": 10, "planned": 12, "durationMinutes": 300 },
          "physical": { "completed": 4, "planned": 5, "durationMinutes": 80 },
          "artistic": { "completed": 3, "planned": 3, "durationMinutes": 90 },
          "labor": { "completed": 3, "planned": 3, "durationMinutes": 50 }
        },
        "dimensionDurations": {
          "academic": 300,
          "physical": 80,
          "artistic": 90,
          "labor": 50
        },
        "mistakeCount": 3,
        "topMistakeReasons": [
          { "reason": "calculation", "count": 2 }
        ],
        "reviewKnowledgePoints": ["分数计算"]
      },
      "generatedSuggestion": "保持数学错题复习，增加 2 次户外运动。",
      "nextWeekSuggestion": "固定周三和周六做劳动任务。",
      "parentNote": "本周坚持得很好。"
    }
  }
}
```

### 7.2 更新周报反馈

`PATCH /api/reports/weekly/:reportId/feedback`

仅家长可提交 `parentNote` 和 `nextWeekSuggestion`，每项最多 1000 字；孩子提交返回 `403 FIELD_ACCESS_DENIED`。该操作不得修改统计字段、weekStart/weekEnd、familyId 或 childId。成功返回完整 report。孩子周反思通过成长记录的 `childReflection` 派生，MVP 不提供孩子修改 WeeklyReport 的接口。

周报统计刷新不得覆盖并发保存的家长反馈。已有反馈审计标记表示整份反馈已人工保存，因此即使
仅修改寄语，也保留当前下周建议（包括显式空串或与原系统建议相同的文本）；系统建议仍独立更新。
没有人工反馈且下周建议仍为默认值时，可随系统建议更新。历史非空自定义建议继续保留；没有审计
且为空/默认值的旧记录无法识别历史人工意图，不承诺自动恢复。上述规则不新增字段或请求格式。

## 8. Private Media

### 8.1 上传私有媒体

`POST /api/media` 使用 `multipart/form-data`，字段为 `file`、`purpose` 和可选 `childId`。允许 `image/jpeg|image/png|image/webp|application/pdf`，单文件最大 10 MiB；PDF 只允许用于 `task_attachment|mistake_question|mistake_answer`，最多 50 页。头像、任务完成证据和成长记录证据仍只允许图片。

服务端以文件签名和完整解析结果判断类型，不信任扩展名或客户端 MIME。图片会自动旋转、重新编码并移除 EXIF；PDF 必须未加密、结构完整且不包含脚本、自动动作、外部链接动作、嵌入文件、表单动作、多媒体或 3D 等主动内容，接受后复制页面并重新序列化、再次解析。孩子 token 的 childId 强制取认证身份，且 purpose 只允许 `task_completion|mistake_question|mistake_answer|growth_evidence`。家长只有在 `purpose=avatar` 时可以省略 childId；该媒体是 family-scoped，仅家长可获取授权地址或删除。其他 purpose 都要求本家庭有效 childId。

成功返回 `201`：

```json
{ "success": true, "data": { "media": { "mediaId": "media_001", "purpose": "mistake_question", "mimeType": "application/pdf", "displayName": "分数题.pdf", "sizeBytes": 245120, "pageCount": 2 } } }
```

部署安全配置是不可变的进程级边界。`trusted-local` 仅适用于可信家庭上传者和私有网络：仍执行上述全部静态校验与规范化，但不启动恶意软件扫描，内部审计状态记录为 `skipped_trusted_local`，不能声称文件已扫描。`secure-production` 对规范化后的每个图片和 PDF 调用私有 ClamAV，只接受 clean 结果；发现恶意内容返回 `422 MALWARE_DETECTED`，扫描器不可用、超时或协议异常返回 `503 MALWARE_SCANNER_UNAVAILABLE`，且不会自动降级。

### 8.2 获取授权读取地址

`GET /api/media/:mediaId/access` 在校验 familyId、childId 和 `status=active` 后返回最长 300 秒的授权 URL 与 `expiresAt`；`childId=null` 的 family-scoped avatar 只允许本家庭家长访问。响应禁止缓存：`Cache-Control: no-store`。不存在返回 `404 RESOURCE_NOT_FOUND`，跨家庭、兄弟姐妹或孩子访问 family-scoped avatar 返回 `403 CHILD_ACCESS_DENIED`。

### 8.3 删除私有媒体

`DELETE /api/media/:mediaId` 将状态置为 deleted 并记录 deletedAt，重复调用幂等返回 `204`。删除后授权读取与新引用均返回 `404 RESOURCE_NOT_FOUND`；已有业务绑定仍作为保留保护，直到业务对象显式解除引用。只有不存在业务绑定，且删除时间与最后一次解除引用时间两者都已满 30 天，才能物理清理对象。

## 9. Rewards

星星发放规则：第一阶段只有家长首次确认一个已完成任务时发放 1 颗星。以 `taskId` 作为幂等来源，同一任务重复确认不得重复发放。星星余额等于不可变流水中 `earn + adjust - spend` 的合计。若积分服务暂时不可用，确认接口返回 `503 STAR_AWARD_PENDING`；任务保留 `confirmed + starAwardState=pending`，客户端可以安全重试确认。

### 9.1 创建奖励

`POST /api/rewards`

请求：

```json
{
  "childId": "child_001",
  "title": "周末选择一次家庭活动",
  "requiredStars": 30
}
```

响应：

```json
{
  "success": true,
  "data": {
    "reward": {
      "rewardId": "reward_001",
      "childId": "child_001",
      "familyId": "family_001",
      "title": "周末选择一次家庭活动",
      "requiredStars": 30,
      "status": "active"
    }
  }
}
```

### 9.2 查询奖励、星星余额和流水

`GET /api/rewards?childId=child_001&rewardPage=1&rewardPageSize=20&ledgerPage=1&ledgerPageSize=20`

响应：

```json
{
  "success": true,
  "data": {
    "starBalance": 42,
    "rewards": {
      "items": [
        {
          "rewardId": "reward_001",
          "title": "周末选择一次家庭活动",
          "requiredStars": 30,
          "status": "active"
        }
      ],
      "page": 1,
      "pageSize": 20,
      "total": 1
    },
    "ledger": {
      "items": [
        {
          "ledgerEntryId": "ledger_001",
          "type": "earn",
          "amount": 1,
          "sourceType": "task_confirmation",
          "sourceId": "task_001",
          "createdAt": "2026-06-18T10:30:00.000Z"
        }
      ],
      "page": 1,
      "pageSize": 20,
      "total": 1
    }
  }
}
```

奖励和流水分别分页，默认页码和上限遵循通用分页约定。可选 `status` 只过滤奖励，不影响流水。

### 9.3 家长确认奖励兑换

`PATCH /api/rewards/:rewardId/redeem`

请求头：

```text
Idempotency-Key: redeem-reward-001-20260618
```

请求体为空。幂等键必填、最大 128 字符。

服务端必须在一个事务中检查余额、写入 `spend` 流水并将奖励改为 `redeemed`。重复使用同一幂等键返回第一次成功结果；余额不足返回 `409 INSUFFICIENT_STARS`。

响应：

```json
{
  "success": true,
  "data": {
    "rewardId": "reward_001",
    "status": "redeemed",
    "spentStars": 30,
    "starBalance": 12,
    "redeemedAt": "2026-06-18T11:00:00.000Z"
  }
}
```

### 9.4 内部星星发放命令

`POST /api/internal/stars/award`

该接口只在服务网络中挂载，不通过 gateway。请求必须包含至少 32 字节配置值对应的 `x-service-token`；普通用户 JWT 或 gateway 身份信封不能代替服务凭据。

请求：

```json
{
  "familyId": "family_001",
  "childId": "child_001",
  "taskId": "task_001",
  "confirmedByParentId": "parent_001"
}
```

首次成功：

```json
{
  "success": true,
  "data": {
    "awarded": true,
    "ledgerEntryId": "ledger_001",
    "starBalance": 42
  }
}
```

使用相同 taskId 重试返回同一 `ledgerEntryId`、`awarded=false` 和当前余额，不创建第二条流水。凭据缺失或错误返回 `401 INVALID_SERVICE_CREDENTIAL`；familyId、childId 或 taskId 非法返回 `400 VALIDATION_ERROR`；孩子不属于家庭返回 `403 CHILD_ACCESS_DENIED`。

## 10. Notifications

### 10.1 查询家庭提醒

`GET /api/notifications/family?childId=child_001`

响应：

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "reminderId": "task_overdue:child_001:2026-07-07:task_001",
        "type": "task_overdue",
        "childId": "child_001",
        "localDate": "2026-07-07",
        "sourceId": "task_001",
        "severity": "warning",
        "title": "完成分数练习",
        "message": "逾期任务：完成分数练习",
        "dimension": "academic",
        "source": "task"
      },
      {
        "reminderId": "task_today:child_001:2026-07-07:task_002",
        "type": "task_today",
        "childId": "child_001",
        "localDate": "2026-07-07",
        "sourceId": "task_002",
        "severity": "info",
        "title": "英语背诵",
        "message": "英语背诵",
        "dimension": "academic",
        "source": "task"
      },
      {
        "reminderId": "mistake_review:child_001:2026-07-07:mistake_001",
        "type": "mistake_review",
        "childId": "child_001",
        "localDate": "2026-07-07",
        "sourceId": "mistake_001",
        "severity": "info",
        "title": "分数计算",
        "message": "错题复习：分数计算",
        "dimension": "academic",
        "source": "mistake"
      }
    ],
    "meta": {
      "childId": "child_001",
      "familyId": "family_001",
      "localDate": "2026-07-07",
      "timezone": "Asia/Shanghai",
      "partial": false,
      "unavailableSources": []
    }
  }
}
```

### 10.2 查询和更新提醒设置

`GET /api/notifications/settings` 返回当前家庭唯一设置。首次读取尚无记录时创建并返回默认设置；后续读取返回同一设置。家长和孩子均可读取，孩子不能修改。

`PATCH /api/notifications/settings` 仅家长可用，接受各提醒布尔开关、`weeklyReportDay`（ISO 1 至 7）以及嵌套对象 `quietHours.start`/`quietHours.end`（`HH:mm`，两项必须同时提交）。成功返回完整设置；未知字段或无效时间返回 `400 VALIDATION_ERROR`。

请求片段：

```json
{
  "weeklyReportDay": 7,
  "quietHours": { "start": "21:00", "end": "07:00" },
  "taskReminderEnabled": true
}
```

`GET /api/notifications/family` 的 today、到期日、周报日和安静时段均按家庭时区计算。每项固定返回 `reminderId`、`type`、`childId`、`localDate`、`sourceId`、`severity`、`title`、`message`，适用时返回 `dimension`；`reminderId` 由 `type + childId + LocalDate + sourceId` 稳定生成并用同一组合去重。结果先按 `severity`（`warning` 在 `info` 前），再按批准的 type 顺序和 `sourceId` 稳定排序；关闭的类别不得返回。部分源失败仍返回 `200`，同时设置 `meta.partial=true` 和 `meta.unavailableSources`。

## 11. 权限验收规则

每个接口都必须满足：

1. 家长只能访问自己 `familyId` 下的孩子和数据。
2. 孩子只能访问自己 `childId` 下的数据。
3. 创建任务、奖励和修改家长反馈只能由家长完成。
4. 孩子可以完成自己的任务和填写自评。
5. 错题接口只接受 `dimension=academic`。
6. 查询接口必须支持按 `childId` 收敛，成长任务和成长记录必须支持按 `dimension` 筛选。
7. PIN 登录必须采用统一错误响应、失败限流和短期 token；重置 PIN 后旧 token 必须失效。
8. 任务确认发放星星和奖励兑换必须使用稳定幂等来源，重试不得重复记账。
9. 聚合接口必须报告部分失败；不得把缺失数据静默当作 0。
10. 图片和受限 PDF 必须先上传为私有 MediaAsset，业务接口只接受 mediaId；任何永久公开 URL 都不是有效契约。
11. 创建与更新接口使用相同的角色字段白名单；禁止字段返回 `403 FIELD_ACCESS_DENIED`，不得静默丢弃。
12. 两位家长的日常家庭权限相同；邀请、撤销、成员移除和所有权转移必须额外验证实时 owner 身份。
13. 家长退出或被移除后，未过期 JWT 不能继续访问家庭；邀请和成员事务失败不得留下部分关系或重复事件。

## 12. 相关设计文档

本节是 API 契约到产品、架构、详细设计和验收证据的反向导航，不改变前述接口
定义。逐 Requirement 的完整映射见
[设计资产索引](../development/family-growth-design-asset-index.md)。

### 12.1 产品与总体设计基线

| 资产 | 文档 | 用途 |
| --- | --- | --- |
| 产品需求 | [家庭成长跟踪 PRD](../product/family-learning-tracker.md) | 角色、德智体美劳范围、MVP 行为和验收标准 |
| 总体架构 | [家庭成长跟踪架构](../architecture/family-learning-tracker-architecture.md) | 服务边界、数据归属、组件/ER/状态机和权限规则 |
| 跨服务时序 | [核心流程时序图](../architecture/sequence-diagrams.md) | 公开 API、内部调用、失败降级和一致性保证 |
| Task 1~4 设计归档 | [Task 1~4 设计归档说明](../development/family-growth-task1-4-design-archive.md) | 早期任务的 PRD、架构、API、ADR 和 Task 4.5 评审映射 |
| 需求追踪 | [需求追踪矩阵](../development/family-growth-requirement-traceability.md) | Requirement 到代码、测试和发现关闭证据 |
| 当前已实现基线 | [FGT-MVP-1.6 基线清单](../development/family-growth-baseline-v1.6-manifest.md) | Task 1~11 范围、质量证据、风险和审批状态 |
| 当前实现候选 | [Task 12 第二家长共管设计](../superpowers/specs/2026-07-16-family-growth-task12-co-parent-design.md) | FGT-MVP-1.7 新增契约；实现证据见 Task 12 Gate |

### 12.2 Task 5~12 详细设计与验收

| Task | 详细设计 | 测试用例 | Gate |
| --- | --- | --- | --- |
| Task 5 | [Growth Logs、Knowledge Points、Stars and Rewards](../superpowers/specs/2026-06-19-family-growth-task5-design.md) | [Task 5 测试用例](../development/family-growth-task5-test-cases.md) | [Task 5 Gate](../development/family-growth-task5-gate.md) |
| Task 6 | [Private Media、Mistakes and Weekly Reports](../superpowers/specs/2026-06-20-family-growth-task6-design.md)；[媒体引用](../superpowers/specs/2026-06-21-family-growth-task6-phase3a-reference-release-design.md)、[孩子头像](../superpowers/specs/2026-06-21-family-growth-task6-phase3b-child-avatar-design.md)、[任务附件](../superpowers/specs/2026-06-22-family-growth-task6-phase3c-task-attachments-design.md)补充设计 | [Task 6 测试用例](../development/family-growth-task6-test-cases.md) | [Task 6 Gate](../development/family-growth-task6-gate.md) |
| Task 7 | [Lightweight Family Notifications](../superpowers/specs/2026-07-07-family-growth-task7-notifications-design.md) | [Task 7 测试用例](../development/family-growth-task7-test-cases.md) | [Task 7 Gate](../development/family-growth-task7-gate.md) |
| Task 8 | [Task 8~11 Frontend Design Baseline](../superpowers/specs/2026-07-09-family-growth-task8-task11-frontend-design.md) | [Task 8 测试用例](../development/family-growth-task8-test-cases.md) | [Task 8 Gate](../development/family-growth-task8-gate.md) |
| Task 9 | [Parent MVP Pages Design](../superpowers/specs/2026-07-10-family-growth-task9-parent-pages-design.md) | [Task 9 测试用例](../development/family-growth-task9-test-cases.md) | [Task 9 Gate](../development/family-growth-task9-gate.md) |
| Task 10 | [Child Web Entry Design](../superpowers/specs/2026-07-11-family-growth-task10-child-web-design.md) | [Task 10 测试用例](../development/family-growth-task10-test-cases.md) | [Task 10 Gate](../development/family-growth-task10-gate.md) |
| Task 11 | [Family End-to-End Design](../superpowers/specs/2026-07-12-family-growth-task11-e2e-design.md) | [Task 11 测试用例](../development/family-growth-task11-test-cases.md) | [Task 11 Gate](../development/family-growth-task11-gate.md) |
| Task 12 | [第二家长共管详细设计](../superpowers/specs/2026-07-16-family-growth-task12-co-parent-design.md) | [Task 12 测试用例](../development/family-growth-task12-test-cases.md) | [Task 12 Gate](../development/family-growth-task12-gate.md) |
| 错题 PDF 与多附件增量 | [详细设计](../superpowers/specs/2026-07-15-family-growth-mistake-pdf-multi-attachments-design.md) | [测试设计与用例](../development/family-growth-mistake-pdf-multi-attachments-test-cases.md) | [增量 Gate](../development/family-growth-mistake-pdf-multi-attachments-gate.md) |

## 13. 拟议 AI 学习 API 边界

[家庭 AI 学习管理平台完整设计](../architecture/family-ai-learning-platform-design.md#11-api-设计草案)
包含课程候选、诊断确认、讲解生成、订正审核、变式练习和掌握证据的增量 API 草案。
这些路由不属于本文的 `APPROVED` 契约，当前客户端和服务不得假设其存在。

将任一草案接口提升为正式契约前，至少需要：

1. 批准增量 PRD/架构和数据所有权；
2. 明确家长、孩子和内部服务的权限矩阵及拒绝路径；
3. 为 `familyId + childId`、私有媒体、幂等生成任务和人工审核状态增加测试；
4. 定义 schema/数据迁移、feature flag、备份和回滚；
5. 更新本契约、需求追踪、相关时序图和发布 Gate。

DeepTutor 和 K12 Graph API 不通过公共 Gateway 直接暴露给孩子；任何正式
集成只允许 LMS 通过受控内部适配器访问。

## 14. 自主学习 MVP 增量 API 契约（PLANNED）

本节是 `SL-01` 至 `SL-07` 的 T0 契约基线。所有路由和字段均为 `PLANNED`，当前服务不得被
描述为已经支持。实现和测试证据进入
[自主学习 MVP 增量 Gate](../development/family-self-directed-learning-mvp-gate.md)后，才能逐项提升状态。

### 14.1 通用规则

- 所有公开请求继续通过 Gateway；家长按实时 Family 成员关系授权，孩子只允许本人 scope。
- 请求中的 `familyId`、`childId`、actor、时间戳和审计字段均不可信，由服务端恢复或校验。
- 家长代录时响应可显示实际 actor，但 subject 始终是目标 `childId`。
- 新的版本字段均为非负整数。第一次改变对应内容的写入使用期望版本 0，成功后持久版本从 1
  开始；历史无媒体确认是唯一例外，只把缺失 `completionVersion` 持久化为 0，不改变作品内容。
- 版本过期统一返回 `409 VERSION_CONFLICT`；缺少新增写契约必填字段返回
  `400 CLIENT_UPGRADE_REQUIRED`，不能回退到旧的无版本写入。
- 实时授权和资源归属校验必须先于幂等结果查询。授权失败不得泄露已存响应或资源是否存在。
- 响应只返回稳定 mediaId；私有媒体显示时另行调用现有授权读取接口，不持久化签名 URL。

新增稳定错误码：

| HTTP | code | 含义 |
| --- | --- | --- |
| 400 | `CLIENT_UPGRADE_REQUIRED` | 新写路径缺少 operation 或 expected version 字段 |
| 400 | `CHECKLIST_ITEM_INVALID` | 清单项、勾选项或版本组合非法 |
| 400 | `MEDIA_ATTACHMENT_LIMIT_EXCEEDED` | 完成图片超过 10 张 |
| 403 | `CHILD_ACCESS_DENIED` | 孩子、兄弟姐妹或跨家庭 scope 不允许 |
| 409 | `VERSION_CONFLICT` | completion/checklist/help/plan 版本已变化 |
| 409 | `IDEMPOTENCY_KEY_REUSED` | 同一幂等作用域使用不同规范请求正文 |
| 409 | `LOCAL_DATE_NOT_WRITABLE` | 尝试修改非家庭当地今天的日计划 |
| 409 | `TASK_STATE_CONFLICT` | 任务状态不允许当前操作 |
| 409 | `MEDIA_OPERATION_EXPIRED` | 原完成命令的远端租约已确定过期终止；修正/重提使用新 operationId |
| 409 | `MEDIA_OPERATION_ABORTED` | 原完成命令已在远端确定终止；原命令重放相同失败 |
| 503 | `MEDIA_REFERENCE_PENDING` | 媒体引用结果未知，需要用原 operation 恢复 |

### 14.2 `SL-01`、`SL-03`：任务清单和完成作品

T2 新增恢复/回收契约见[补充设计](../superpowers/specs/2026-10-23-family-self-directed-learning-t2-recovery-retention-design.md)。
只读恢复发现及原 actor 显式恢复已在 T2-R 的 enabled 正式组合实现并获后端合成验收；内部回收屏障属于 T2-G 实施中范围，尚未正式装配。
默认配置仍关闭，不代表真实环境可用。下文历史 T1 实施边界保留；T2-R 最新证据见执行记录 §9。

#### T2-R 退出后发现与显式恢复

仅当前登录且有实时家庭/孩子权限的用户可访问，沿用 Gateway JWT 与签名身份。
服务端重新核验家庭成员、孩子归属及孩子 tokenVersion；失效孩子 token 返回 401 `STALE_CHILD_TOKEN`。
任务不存在/无权均返回 403 `CHILD_ACCESS_DENIED`；合法但非当前 actor 的命令和不存在命令均返回 404 `RESOURCE_NOT_FOUND`。
新路由在 `/:taskId` 前注册，legacy 不提供恢复能力，maintenance 返回 503 `COMPLETION_MAINTENANCE`。

| 方法与路径 | 输入 | 200 响应 data |
| --- | --- | --- |
| `GET /api/growth-tasks/completion-recoveries` | 可选 page/pageSize，默认 1/20；pageSize 最大 50；仅正安全整数；禁止 actorId/familyId/childId 等额外查询参数 | `{items:[{taskId,childId,operationId,targetCompletionVersion}],page,pageSize,hasMore}` |
| `GET /api/growth-tasks/:taskId/completion-recovery` | 无查询参数 | `{recovery:{state,operationId,targetCompletionVersion}}` |
| `POST /api/growth-tasks/:taskId/completion-operations/:operationId/recover` | 合法 UUID，无查询参数，无请求体或空对象；拒绝正文、版本、actor、远程标识覆盖 | 原完成命令持久化的 `{task:...}` 成功快照 |

所有成功响应沿用 `{success:true,data:...}`，恢复路由设置 `Cache-Control: no-store`。
发现接口在同一次只读快照事务中核对任务、owner、pending、本地账本、原 hash、完整集合及持久映射；不调用远程、不补写、不续租。
单任务 state：`none` 无活动意图；`recoverable` 当前 actor 自己且映射完整；`other_actor` 合法可看任务但不属于当前 actor。
只有 recoverable 返回原公开 operationId 和目标整数版本；其余两字段为 null，不返回其他 actor 信息、remoteOperationId、代次、待发布正文或签名地址。
任务侧标记丢失但存在未终态账本、标记/账本/集合不一致等损坏，明确返回 503 `MEDIA_REFERENCE_PENDING`，不伪报 none。

列表跨全部日期、仅当前 actor，按 taskId 稳定排序。服务端从实时家庭和孩子关系确定范围；快照中逐项核验，
另取一项计算 hasMore，该项损坏也拒绝本页。任务标记缺失的未终态账本也纳入候选，不能被静默漏掉。
并发完成会改变分页结果，须再读单任务发现；列表为空不证明历史提交失败，不代表历史作品库。

POST 只恢复指定原 scope 的命令：SUCCEEDED 返回固定历史成功快照；FAILED 重放稳定 4xx；非终态复用 T1 原状态机和最终 CAS。
它不新增 operation、UUID 或映射，不接管其他 actor/其他活动命令，也不恢复材料 pending。
同 UUID 不同 actor 独立；历史 A 重放时 B 即使活动也不推进/清除 B。结果未知仍返回503，沿用原 ID 显式重试。
404 不能被前端直接当作原 complete 已失败；须重新发现并 GET 当前任务，仍 pending 则继续阻断新提交。
历史成功响应后也须另 GET 当前任务。T2-R 后端批次当时不包含前端恢复 UI；2026-10-24 的 T2-2/4/5/6
已实现只读发现、原提交者显式恢复及合成环境浏览器验证，证据见
[T2 执行记录 §12](../development/family-self-directed-learning-t2-execution.md#12-mvp-页面闭环工程交付2026-10-24)。
当前为工程验收申请，T2 总门禁仍 OPEN、真实 iPad 为 DEVICE_PENDING，不代表跨设备真机验收或真实部署完成。

#### 家长创建或更新清单

现有 `POST /api/growth-tasks` 可选接受 `checklistSnapshot`。现有
`PATCH /api/growth-tasks/:taskId` 更新清单时必须额外携带 `expectedChecklistVersion`：

```json
{
  "expectedChecklistVersion": 2,
  "checklistSnapshot": [
    { "itemId": "read-question", "label": "再读一遍题目", "required": true },
    { "itemId": "check-unit", "label": "检查单位", "required": false }
  ]
}
```

清单为 0 至 5 项；`itemId` 在任务内唯一，`label` 为 1 至 100 字。创建任务时未提供或显式提供空清单，
服务端保存 `checklistSnapshot=[]`、`checklistVersion=0`；创建时提供非空有效清单，服务端保存
`checklistVersion=1`。老任务缺失字段时读取为 `checklistSnapshot=[]`、`checklistVersion=0`；
首次 PATCH 设置清单时携带期望版本 0，成功后版本为 1。只有家长可以修改 pending 任务清单。

T4 实施补充（工程验收仍 OPEN，见 Gate §24）：enabled 正式装配接受上述字段；legacy 解析
不放行新的清单写入。`itemId` 为非空、最多 100 字的字符串，大小写敏感且不自动改写；
`label` trim 后校验长度。每项仅允许 `itemId/label/required`，`required` 缺省为 false，提供时
必须是布尔值；拒绝重复 ID、null、错误类型和未知项字段（`CHECKLIST_ITEM_INVALID`）。
`required` 是重点提醒，不要求勾全，不改变独立求助或发星规则。

PATCH 中清单和 `expectedChecklistVersion` 必须成对出现；期望版本是非负安全整数且下一版
可安全表示，不接受客户端 `checklistVersion`。每次有效清单更新递增一次，即使正文相同；
未修改清单时应省略这两个字段。版本冲突返回 `409 VERSION_CONFLICT`，非 pending 返回
`409 TASK_STATE_CONFLICT`；活动完成/引用意图仍阻止写入，不隐式恢复他人的完成命令。

清单与 `attachmentMediaIds` 混合更新沿既有材料意图持久化原版本、目标版本和完整正文，
公开字段一起发布。发布后解绑尚未完成时，原 PATCH 按持久原意图接续，不能因公开清单已为
目标版本而重算基线或再递增。原意图正文不一致返回冲突。稳定完成后的 PATCH 不提供新的
恰好一次承诺：丢响应应先读取，不盲目将期望版本改为新版本重试。恢复和最终清锁核对公开
目标正文（包括显式 null）、完整有序材料集合及精确绑定代次；不一致时保留待恢复状态。
家长编辑未改变材料集合时也省略 `attachmentMediaIds`，避免旧页面快照覆盖共管家长的新材料。
实际携带材料字段且 taskId 已知的未知请求须保留原正文供显式接续；普通 GET 不暴露材料意图，
不能因读取到旧公开快照就断定原写入未发生、重定版本或解冻新编辑。

#### 完成任务

`PATCH /api/growth-tasks/:taskId/complete`

T1 第六批实现边界：下述增强契约目前仅由未注入生产的 homework 本地服务及 completion client
编排实现，尚未成为此 HTTP 端点的运行行为。旧路由、生产依赖与后台 worker 未接入新协议。
启用前必须单独完成所有相关写入口的 owner/引用状态锁、HTTP 契约与授权验收；不能让新服务
写真实任务的同时继续运行未改造的旧写入口。本批的 `read` 只读投影不触发恢复，内部 `recover`
按当前认证 actor 的完整作用域读取持久命令，不提供公开恢复端点。

增强请求：

```json
{
  "operationId": "4d979020-09c5-4c94-8a9f-90b8fc8f0d55",
  "expectedCompletionVersion": 1,
  "expectedChecklistVersion": 2,
  "checkedItemIds": ["read-question", "check-unit"],
  "completionMediaIds": ["media_001", "media_002"],
  "actualMinutes": 18,
  "difficulty": "normal",
  "needsHelp": false,
  "childNote": "检查后改正了单位"
}
```

规则：

- `completionMediaIds` 为有序唯一数组，最多 10 张 JPEG/PNG/WebP，每张沿用 10 MiB 上限；
  所有媒体必须 active、属于同一 `familyId + childId` 且 purpose 为 `task_completion`。
- `checkedItemIds` 只能引用请求版本的清单；未勾完允许如实提交，家长负责判断。
- pending 或 completed 任务可更新当前完成快照；confirmed、cancelled、archived 返回 409。
- 完成命令是完整快照，而非可选字段的部分更新：`actualMinutes`、`actualAmount`、`difficulty`、
  `needsHelp`、`childNote` 省略表示本次未填写；新版本在同一发布事务/CAS中清除对应旧顶层兼容值，
  与 `completionEvidence` 一致。页面清空数字后省略字段；0、false、空字符串仍是显式合法值，null不作为清空协议。
  命令哈希及恢复使用原规范正文，不补入旧值；已成功历史命令重放只返回原结果，不回写旧快照。
- 成功写入令 `completionVersion` 严格加 1；第一次写入以读取投影版本 0 为前提。
- 规范请求哈希覆盖所有影响结果的允许字段和目标版本，不覆盖服务端时间或签名 URL。
- 幂等作用域为 `familyId + childId + taskId + actorId + complete + operationId`。
- 同 scope、同哈希重放返回相同任务版本且不改写 `completedAt`；同 scope、不同哈希返回
  `409 IDEMPOTENCY_KEY_REUSED`。
- `remoteOperationId` 是服务端 UUID，不接受客户端传入，也不出现在公开成功响应中。
  公开完成请求包含此字段时，在命令占位前返回 `400 VALIDATION_ERROR`，不能静默采用或覆盖服务端值。
  远程标识与首次命令占位同事务持久化；每条命令（含无新增媒体）建立不可变映射，本地建立
  remoteOperationId 唯一索引并保留原业务幂等唯一索引。不同 actor 使用同一 UUID 必须分配不同远程标识。
  本地幂等键竞争重读已有命令；仅远程标识碰撞且占位事务确认回滚、没有远程调用才可重新分配。
  占位提交结果未知时先解决原事务结果/重读原命令，不得生成新映射或发送未确认持久化的标识。
  重试、进程重启和运维恢复均读取原映射；终态继续保留映射、不单独 TTL。映射缺失阻断并告警，
  不能用客户端 UUID 兜底。规范请求哈希不包含服务端生成的 remoteOperationId。
- 命令占位同时保存完成此次收敛所需的最小规范业务 patch 及其哈希，包括规范化后的
  `checkedItemIds`、完成自评/实际量字段和服务端认证 actor；不保存图片正文、签名 URL 或客户端
  时间。pending 期间可据此脱离客户端原请求恢复，成功或稳定失败后清除临时 patch，只在命令记录
  保留哈希、不可变成功响应投影 `successResponse` 或稳定失败结果及必要阶段信息。
- `successResponse` 保存下方完整固定成功响应体，与作品发布同事务持久化，命令 SUCCEEDED 后才能返回。
  版本前进、确认或归档后重放仍返回该投影，不从当前任务重建旧版本；当前状态需另行 GET。
  不保存备注、图片正文或签名 URL，媒体 ID 不授予额外访问权；投影随任务/命令保留，本轮不单独 TTL 清理。
- 每个任务最多一个活动完成命令：任务隐藏字段 `activeCompletionOperation` 存完整命令作用域，
  首次占位以该字段为空、期望版本/状态和引用可用做原子 CAS。占位起即 pending_recovery。
  服务端在完成新写、清单编辑、任务编辑、确认、取消和归档的最终原子写入中拒绝活动意图或待恢复引用，
  返回 `503 MEDIA_REFERENCE_PENDING`。同命令恢复校验完整 owner/阶段/目标版本；不同 actor 或新 id
  不能覆盖意图。鉴权、schema、同 key 异正文 409、已终态命令重放先于锁检查；独立 help 局部更新不受此锁影响。
  任务材料引用 pending 也阻止新完成占位。恢复结束后新写调用方重新 GET，不以旧版本自动提交。
- 服务端以旧稳定引用和目标 `completionMediaIds` 计算新增集合、保留集合和移除集合。只有新增集合
  prepare/commit；保留集合沿用原 `bindingOperationId`/代次；发布新稳定证据后只按精确旧代次
  unbind 移除集合。各阶段不发送空媒体命令；纯重排或只更新非媒体字段只发布本地 patch，仍递增
  `completionVersion`。删除部分或全部图片时虽跳过 prepare/commit，仍须解绑非空移除集合。
- 媒体恢复顺序固定为：先在本地事务中用版本 CAS 保存命令占位、pending 意图、目标引用代次
  和 `mediaRemoteOutcomeUncertain=false`；再用 CAS 把不确定标记置为 true；确认该 CAS 成功后
  才使用已保存的 remoteOperationId/代次调用 prepare 和 commit；随后原子发布新完成证据并按旧代次
  unbind 被替换引用。发布事务同时固化响应投影、递增版本并转入 `PUBLISHED_CLEANUP`；解绑完成前
  命令不算成功且仍持有 owner。公开任务在 commit 前返回上一份稳定证据，发布后返回新作品及
  pending_recovery；移除集合全部收敛后同事务置 SUCCEEDED/stable 并清除 pending 和 owner。
  无移除项可在发布事务直接终结；无新增项无需 commit。任何恢复更新均 CAS 当前 owner/阶段，禁止重复发布。
- 出现网络超时、5xx、畸形响应、数据库结果未知或 unbind 未完成时，保留 pending 意图并返回
  `503 MEDIA_REFERENCE_PENDING`。客户端只能以完全相同的 PATCH 正文和原 operationId 重放；
  GET 不触发恢复，受控运维恢复也只能重放已持久化命令，不能用新 id 猜测成功。
- schema、数量和重复 mediaId 等本地校验在创建命令前完成。仅首次进程内 prepare 直接返回经
  认证、结构完整且带匹配 commandHash 的 ABORTED 终态的稳定业务拒绝时，服务端才以
  事务/CAS 把命令收敛为失败、清除 pending 意图并恢复上一稳定引用状态。该路径不得递增 `completionVersion`，
  不得改写完成证据或 `completedAt`，也不得 bind/unbind。相同 scope、请求
  哈希和 operationId 重放相同失败；修正请求必须使用新的 `operationId`。不存在、跨 scope、
  错误 purpose 和不可用媒体沿用不可枚举的公开错误映射。恢复执行不得凭后来收到的稳定 4xx
  清理 pending 意图；裸 4xx 不证明远端终止，需按下述 status/abort 收敛。首次稳定拒绝后的本地
  事务结果未知时也返回 `503 MEDIA_REFERENCE_PENDING`，继续只允许原命令恢复。

本地实现补充（T1 第六批）：规范请求固定字段顺序，媒体 ID/UUID 转小写，媒体顺序保留，
checkedItemIds 按大小写敏感的原始 itemId 去重、排序，备注 trim；完整 scope 与规范正文一起生成 hash。
read/complete/recover 对合法格式但不存在或无权限的 taskId 统一返回 `403 CHILD_ACCESS_DENIED`，
不通过 404/403 差异泄露任务存在性。缺少 operationId/期望版本返回 CLIENT_UPGRADE_REQUIRED，
完成图片超限返回 MEDIA_ATTACHMENT_LIMIT_EXCEEDED，非法勾选集合返回 CHECKLIST_ITEM_INVALID；
畸形 operationId/版本、未知字段及远程标识注入仍返回 VALIDATION_ERROR，均在占位前拒绝。
旧任务缺失完成/清单版本时
读取为 0，不批量回填。最小恢复意图置于隐藏的 `completionPending`；上文描述的不确定标记在完成
协议中具体为 `completionPending.remoteOutcomeUncertain`，不复用旧材料流程的字段。
完成占位、映射、owner 同事务；每次阶段推进同时 CAS 任务与 operation 版本。已发布且仍待解绑的
任务读取新证据及 pending_recovery，但完成命令只有 SUCCEEDED 才返回固定成功投影。
经过完整校验的远程 ABORTED 业务拒绝中，RESOURCE_NOT_FOUND、CHILD_ACCESS_DENIED、
MEDIA_PURPOSE_MISMATCH、RESOURCE_CONFLICT 统一映射为公开 `404 RESOURCE_NOT_FOUND`，
不暴露媒体存在性或归属；MEDIA_OPERATION_EXPIRED/ABORTED 保持对应 409。
恢复只依赖 status/abort 返回的同摘要、同远程标识完整终态，不以裸 4xx 清锁。
未知本地提交结果一律保留原命令并返回 pending，下次重读原映射；无自动生成新命令的恢复路径。

HTTP 适配实施边界（T1 第十一批）：独立 `createGrowthTaskCompletionRouter` 仅适配
`PATCH /api/growth-tasks/:taskId/complete` 和 `/confirm`，由测试宿主显式挂载。
身份来自真实 authenticateGateway 验证后的 req.user，不读取正文中的 identity/actor；
现有服务继续负责实时家庭授权、规范命令校验、事务与恢复。成功返回服务原有固定投影，
异常交给公共 errorHandler，保持 `{success:false,error:{code,message,details}}`。
网络未知结果由相同 PATCH/原 operationId 恢复，不增加公开 recover 接口；每次请求的网关身份
信封须重新签发，不能复用 nonce。工厂不启动监听/数据库、不装配生产依赖；未替换生产路由。
本批不提供 GET/列表或完整 CRUD，不代表媒体删除、真实发星 HTTP、前端或生产全链路验收通过。

只读 HTTP 实施边界（T1 第十三批）：新增独立 `createGrowthTaskCompletionReadRouter` 与
`createGrowthTaskCompletionReadService`，仅测试 app 挂载 `GET /api/growth-tasks` 和 `/:taskId`。
详情返回 `{success:true,data:{task}}`，列表返回既有 items/page/pageSize/total；两者共用公开 task
投影，保留既有业务字段，增加 checklistSnapshot/checklistVersion、completionVersion、
completionMediaIds、completionEvidence、completionMediaReferenceState。历史缺字段投影为版本 0、
空清单/图片和 null evidence，不回填。evidence 仅含已发布勾选、实际量/自评、submittedByActor、
subjectChildId、childSubmittedAt 与图片 ID；不返回隐藏恢复 patch、owner、命令摘要、绑定代次或访问签名。
PREPUBLISH 读上一份稳定证据，PUBLISHED_CLEANUP 读新发布证据及 pending_recovery；GET 无远程
对账、解绑或恢复副作用。删除后的 ID 仍是原发布事实，读取接口不保证媒体仍可用，媒体访问另行授权。

列表家长必传 childId；孩子缺省取本人，显式其他 childId 返回 403，不静默覆盖请求。查询字段仅
childId/status/dimension/scope/page/pageSize，未知字段、空值、重复或结构化参数返回 400；
其余筛选/分页校验晚于合法 childId 的家庭授权。分页沿用默认 1/20、上限 100，页码及偏移须为安全整数。
today/week 沿用家庭时区，排序 dueDate/createdAt/_id 升序，最后的 _id 保证同时间任务分页顺序稳定。
授权、列表项与 total 在同一只读事务快照内读取，查询同时限定 familyId/childId。
合法但不存在/无权的 taskId 统一 403 CHILD_ACCESS_DENIED，非法格式 400；读取结果未知返回 503
MEDIA_REFERENCE_PENDING，不返回部分列表或清理任何意图。生产 GET 仍未替换，不能把本段视作生产已上线。

#### 内部引用状态对账（T1 计划契约）

实施边界（T1 第九批）：已提供独立 `createCompletionMediaReferencesRouter` 工厂，测试应用
显式注入现有服务凭据中间件及 operation service，经实际 loopback HTTP 验证五个命令。
工厂不自行创建数据库连接、不监听端口，宿主负责 JSON 解析和公共 errorHandler；
授权后的命令校验、事务与终态仍归 operation service，响应统一为 `{success:true,data}`。
错误经公共处理器返回 `{success:false,error:{code,message,details}}`；稳定 ABORTED 业务拒绝
返回 HTTP 200 的持久化终态证据，不转换为可误用的裸 4xx。
该工厂尚未在生产 server 或 Gateway 挂载；旧内部 router 不变、旧材料字段不由新工厂处理。
下述路径仍为待接入契约，不代表部署可用；第十批补独立协议分流，生产依赖注入及接入审批另行完成。

实施边界补充（T1 第十批，仍未生产挂载）：`createMediaReferenceProtocolRouter` 在服务凭据
校验后检查完整 references 集合，不依赖首条引用或是否提供 commandHash 猜测协议。

| 引用集合 | 动作 | 响应及限制 |
| --- | --- | --- |
| 全部为 growth_task.completionMediaIds | prepare/commit/abort/status/unbind | 新 operation 契约，保持终态、租约、代次及删除凭证校验 |
| 合法的旧材料/头像/错题字段 | prepare/commit/unbind | 原 `{success:true,data:{references}}`，不创建 operation |
| 混合新旧、未知字段、错误资源类型、空/损坏集合 | 任意动作 | `400 VALIDATION_ERROR`，不调用任一 provider |
| 旧字段携带 commandHash/mode/remoteOperationId，或旧字段调用 status/abort | 对应动作 | `400 VALIDATION_ERROR`，不静默降级 |

凭据错误优先返回 `401 INVALID_SERVICE_CREDENTIAL`；provider 异常继续交公共错误处理器，
不以错误响应触发协议回退。新 completion client 的 remoteOperationId 仍映射为 wire operationId；
此分流不改变摘要规则、完整引用集合或精确 unbind 的旧代次要求。

材料编排仅通过显式 `completionIsolation: true` 启用统一互斥，默认及生产装配未启用。
完成 owner/pending/恢复态存在时返回 `503 MEDIA_REFERENCE_PENDING`，不清理任一意图；
最终 owner/版本 CAS 失败也保留可恢复意图，不发布旧 patch。材料 pending 的隐藏
`mediaCompletionFence={completionVersion,checklistVersion}` 与占位同时保存，重启恢复核对原版本，
稳定结束后清除；该字段不是请求参数或公开 DTO，不允许客户端注入。
历史无 fence 的 pending 仅在两个版本为 0/缺失时以 CAS 补入基线；不明非零基线保留 pending，
待单独核查。材料保持旧协议的稳定首轮拒绝/回滚语义，不冒用新 operation 终态作为旧协议凭证。
本批内部 service 仍是已授权调用方的协作者，不新增或替代公开家庭/孩子权限校验。

第十批复审 P2 补充：旧材料 prepare 对同一 operation 的幂等重放可返回 prepared/bound；
编排逐条核对完整引用集合后，继续同一 operation 的 commit，且只有完整 bound 结果才进入本地
最终 CAS 发布。创建、修改和历史 pending 接续采用一致规则；不能将 prepare 的 bound 当作
可跳过 commit/最终 CAS 的成功凭证。released 或引用集合不匹配仍返回 `503 MEDIA_REFERENCE_PENDING`，
保留原恢复意图；commit 仍只接受 bound、unbind 仍只接受 released。此修订不改变旧协议 wire
请求/响应结构，也不将旧材料切换到 completion operation 协议。

`POST /api/internal/media/references/status`（只读）和
`POST /api/internal/media/references/abort`（写入）只注册在 resource-service 内部路由，使用现有
`MEDIA_REFERENCE_SERVICE_TOKEN`，不得经 Gateway 暴露。仅 `growth_task.completionMediaIds` 的新协议
采用 `MediaReferenceOperation`，其他已有引用字段保持既有协议。operation 模式 status 请求：

```json
{
  "mode": "operation",
  "familyId": "family_object_id",
  "childId": "child_object_id",
  "resourceType": "growth_task",
  "resourceId": "task_object_id",
  "operationId": "7fe39b20-2bc9-45fb-b2d1-a91ff15a62d8",
  "commandHash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "references": [
    { "mediaId": "media_object_id", "field": "completionMediaIds" }
  ]
}
```

prepare/commit/abort 使用上例去掉 mode 的请求体：相同 scope、operationId、commandHash 和完整非空
新增集合，references 均为 completionMediaIds，同命令各阶段不得改成移除集合。commandHash 是 64 位
小写十六进制 SHA-256，来源为 homework 对本地完整 scope（含 actor/action）及规范正文的摘要。
resource 同时持久化并校验规范引用集合摘要；同键异摘要/异集合返回 `409 MEDIA_OPERATION_CONFLICT`，
不改变原记录，不能将冲突响应视为本地失败终态。唯一键为 familyId/childId/resourceType/resourceId/field/operationId。
内部 operationId 必须取持久化 remoteOperationId：示例中的 `7fe39b20-2bc9-45fb-b2d1-a91ff15a62d8`
是服务端映射值，不是公开请求的 `4d979020-09c5-4c94-8a9f-90b8fc8f0d55`。内部字段名保持 operationId；
prepare/commit/abort/status(operation) 都使用此值，响应 operationId 也必须匹配此值，连同摘要/作用域
校验后才可驱动本地状态。不同 actor 的合法命令不再共享远程键；内部同键异摘要仍按不变量异常阻断并告警。
新增引用 bindingOperationId 使用当前 remoteOperationId；保留引用保留旧值。unbind 的命令 operationId
使用当前 remoteOperationId，但移除项 bindingOperationId 使用持久化的旧远程代次；releaseOperationId
只记录当前远程标识用于审计。纯删除也复用占位时保存的远程标识，不必创建空的远程 operation 记录。

operation 模式及三种写命令返回 `200 {success:true,data:{operation,references}}`。operation 字段为：
`operationId/state/commandHash/leaseExpiresAt/leaseExpired/failureCode`，state 为
`ABSENT|PREPARED|COMMITTED|ABORTED`。ABSENT 仅供 status 投影，commandHash=null；PREPARED 必含
leaseExpiresAt 和按服务器当前时钟计算的 leaseExpired；其他状态 lease 字段为 null。ABORTED 必含首次
持久化的 failureCode，其他状态为 null。references 逐项返回 mediaId/field/state 和存在行时必含的
bindingOperationId；absent 不带绑定代次。响应不返回内容、路径、URL，不按请求 operationId 隐藏其他代次。

只读 status 另有 `mode=references`：请求仅 scope 和非空 references（移除集合），不接受 operationId
或 commandHash；响应同一 envelope，operation=null，只报告实际引用状态。这一模式不能证明 operation
已终止，用于 PUBLISHED_CLEANUP。所有 mode 均须验证完整 scope、数量、字段白名单及内部服务凭据。

T1 第四批公共 client 实现说明（以下为当批历史边界；当前 enabled 装配进度见文末 R3 说明）：

- `mediaReferenceClient.js` 额外提供按需加载的 `createCompletionMediaReferenceClient`；原工厂和旧协议不变。
  新工厂支持 prepare/commit/abort 和 status 两种模式，返回完整 `{operation,references}`，不是旧引用数组。
- 仅在进程内 client 入参中使用 `remoteOperationId`，由调用者提供已持久化映射；client 将其转换为上例
  HTTP `operationId`，不接受公开 operationId 兜底，不生成 UUID。references 模式二者都不接受。
  这不改变内部 HTTP 契约，也不能代替后续 homework 首占位持久化和 actor 作用域校验。
- 请求只接受完整 scope、1..10 个不重复 completionMediaIds、适用模式的映射/摘要；ID 规范化为小写。
  响应必须是 200 成功 envelope，远程标识/摘要和引用集合完整匹配，无重复、漏项或额外项；
  绑定 UUID 为规范小写，严格验证终态/租约和可空精确隐私凭证，不接收路径/URL/正文等额外字段。
  commit/abort 仅接受 COMMITTED/ABORTED；prepare 可返回原终态，status 可报告 ABSENT。
- 历史终态后的 absent/其他代次如实保留，不推定可发布；PREPARED 必须是完整原代次 prepared。
  leaseExpired 使用服务端结果，不由客户端时钟重算；privacyDeletion 必须匹配请求资源、媒体、字段和
  operation 模式的远程代次，存在引用行时还须匹配当前绑定；普通 released/absent 不补造凭证。
- 裸 4xx/5xx、超时、错配/未知失败码或畸形响应统一为 503 MEDIA_REFERENCE_PENDING，且不暴露 Axios
  配置/内部凭据/远端错误内容、不自动重试、不跟随重定向。只有匹配的 200 ABORTED 作为数据返回；
  是否允许本地失败清锁由编排阶段判断，client 本身无本地状态副作用。
- 当前支持的持久 ABORTED 码为 MEDIA_OPERATION_EXPIRED、MEDIA_OPERATION_ABORTED、RESOURCE_NOT_FOUND、
  CHILD_ACCESS_DENIED、MEDIA_PURPOSE_MISMATCH、RESOURCE_CONFLICT；未来扩展须同步 client 契约及测试。
  第五批补充下述精确代次 unbind；生产路由和 homework 调用仍未接入，路由接入必须另获用户确认。

T1 第五批 unbind 契约（独立 service/client，生产入口尚不支持）：

- 请求为 scope、operationId、references；不接受 commandHash 或 mode。每项必须为
  `{mediaId,field:"completionMediaIds",bindingOperationId}`，1..10 项、媒体唯一、无稀疏空槽。
  client 入参只用 remoteOperationId 映射当前 operationId；各项旧 bindingOperationId 可不同。
- 同代次 bound 需验证旧 COMMITTED operation 的摘要/规范集合及引用归属，再以旧 operation 版本
  CAS 和引用代次/状态 CAS 整批事务释放；历史终态、terminalAt、摘要和集合不变。
  同代次 released 不覆盖首次 releasedAt/releaseOperationId；完整身份 absent 如实返回。
  其他代次或 prepared（包括租约过期）返回 409 RESOURCE_CONFLICT，任一项冲突整批回滚；
  损坏的旧 operation/引用关系返回 409 MEDIA_OPERATION_INCONSISTENT，不降级为普通释放。
- 不创建当前 operation，不生成隐私删除凭证，不删除资产。返回
  `200 {success:true,data:{operation:null,references}}`，逐项 state 仅 released/absent。
  released 的绑定必须匹配该请求项的旧代次；absent 不附带 bindingOperationId。
  privacyDeletion 若存在，必须匹配该项旧绑定代次（不是当前解绑 operationId），否则不得用作凭证。
- client 对裸错误、缺项/重复/稀疏数组、prepared/bound、代次或凭证错配统一 pending。
  absent 仅证明该次事务快照下完整身份无引用；发布后的 owner 锁和代次串行化仍由 homework 保证。

终止与提交必须竞争同一 operation 记录：prepare/commit/abort 都在 MongoDB 事务中按记录版本和状态
CAS，连同全部新增引用一起提交；唯一竞争/事务冲突重读，不能只读 operation 后仅更新引用。

| 当前 operation | prepare | commit | abort |
| --- | --- | --- | --- |
| ABSENT | 合法媒体原子建立 PREPARED；媒体业务拒绝原子保存 ABORTED 后返回 | 409 MEDIA_OPERATION_NOT_PREPARED | 原子创建 ABORTED 终止标记 |
| PREPARED 且未过期 | 原 lease，不续租 | 原子置 COMMITTED 和全部 bound | 原子置 ABORTED 并释放本 operation 的 prepared 引用 |
| PREPARED 且已过期 | 原子过期终止 | 原子过期终止 | 原子过期终止 |
| COMMITTED | 返回原终态，不重绑 | 返回原终态，不重绑 | 返回 COMMITTED，不解除 bound 引用 |
| ABORTED | 返回原终态，不创建引用 | 返回原终态，不提交 | 返回原终态 |

租约过期原子转为 ABORTED，failureCode=MEDIA_OPERATION_EXPIRED，以服务器 `now >= leaseExpiresAt`
为边界，同时释放该 operation 的 prepared 引用；默认租约 900 秒，重复 prepare 不续租。显式 abort
保存 MEDIA_OPERATION_ABORTED，prepare 媒体拒绝保存既有不可枚举公开码；终态失败码不可重写。
ABORTED 的 200 表示内部命令结果已确定，不表示业务完成成功。homework 映射 EXPIRED/ABORTED 为公开
`409` 同名 error.code，原 scope 哈希命令重放同一失败；其他媒体拒绝沿用原 HTTP/code 映射。
鉴权/schema 错误仍为 4xx，事务结果未知为 5xx，都不带可用于清锁的 ABORTED 证明。

过期处理在请求路径执行，不依赖 worker；新协议回收不能直接删除 prepared 行。终态记录不做 TTL 删除，
媒体清理保留最小 operation 终止标记，防止迟到请求复活。后续 unbind 不改变 COMMITTED，旧命令只返回终态。
操作记录与引用出现其他代次、意外 bound 或部分缺失等矛盾时整体拒绝、保留本地 pending 并告警。
内部一致性拒绝使用 `409 MEDIA_OPERATION_INCONSISTENT`，例如 PREPARED 引用缺失、出现意外代次/状态，
或同 operation 多出未登记引用；该错误不携带可用于清锁的终态证明，不得映射为已终止成功。
commit 获取资产写屏障后再次采样服务端时钟；若等待期间到达租约截止点，整组按 EXPIRED 终止。
prepare/abort 在异步引用完整性查询完成后、终态决策前重新采样时钟；已到期优先保存
MEDIA_OPERATION_EXPIRED，不能使用查询前的时间保存 MEDIA_OPERATION_ABORTED。
写命令响应与 status 均在最后一次引用读取后重新计算 leaseExpired，不复用终态决策时间。
若未过期决策后的响应读取期间才到期，可返回 PREPARED/leaseExpired=true；这不是有效租约或
提交成功的证明，不续租、不伪造终态，后续 commit/abort 仍重新检查并原子过期终止。
PREPARED 必须验证完整原代次引用组。已终态命令在后续合法解绑、清理或新代次重绑后仍返回持久终态，
references 如实反映当前 absent/新绑定，不复活旧引用；这不是本地发布凭证。PREPUBLISH 恢复仍须逐项核验
原 remoteOperationId 的 bound 或精确 privacyDeletion 凭证，其他代次/无凭证 absent 不得发布或清锁。
完成媒体隐私删除见下方专门契约：PREPARED 整组终止；COMMITTED 状态不反转，但目标媒体 bound
可凭精确删除凭证释放。仅改单条 prepared 不构成合法终止。
事务重试重新采样资源服务时间。新完成字段不允许绕过 operation 协议走旧 prepare/commit/回收逻辑。

受控引用状态对账必须先读本地命令阶段：

- PREPUBLISH：absent 不能作为失败终态证据；operation ABSENT 或 PREPARED 已过期时调用原 abort。
  未过期 PREPARED 继续 commit（该命令再次检查租约）；只有匹配摘要的 COMMITTED 且新增引用全部
  同代次 bound（或下述匹配隐私删除凭证）才发布最小规范业务 patch。只有匹配摘要的 ABORTED 才可本地 FAILED 并释放锁，
  保留上一作品和版本。abort 返回 COMMITTED 则继续发布，不能宣告失败。查询/终止结果未知或矛盾
  继续 pending 并告警；不得根据引用 absent/released 直接清除意图。
- 新增集合为空时不进行全称状态判断；直接发布本地 patch，再处理移除集合。
- `PUBLISHED_CLEANUP`：发布后不得回滚已发布作品，不再 prepare/commit 或递增 completionVersion。
  使用 references 模式对账移除集合，此阶段禁止 abort。
  对移除集合，bound 且与持久化旧 bindingOperationId 相同则用当前 remoteOperationId 重放 unbind；
  released 且旧代次相同、或完整身份 absent 视为已无待解绑引用。absent 的安全前提是活动命令锁
  阻止并发重绑；不声称释放操作身份。releaseOperationId 仅作内部审计，不是成功必需条件。
  其他代次或 prepared 阻断并告警；合法混合 bound/released/absent 逐项处理。移除集合全部收敛后
  才能在本地事务中终结成功并清除 owner；空移除集合直接终结，不发送空查询或 unbind。
- 本地提交结果未知时先读取命令阶段，已终态则重放结果；不能用远端新增集合猜测本地是否发布。
  查询失败继续 `503 MEDIA_REFERENCE_PENDING`。恢复不能绕过实时授权或直接清空 pending。

固定成功响应（也是命令的不可变投影，不含完整任务正文）：

```json
{
  "success": true,
  "data": {
    "task": {
      "taskId": "task_001",
      "status": "completed",
      "checklistVersion": 2,
      "completionVersion": 2,
      "completionMediaIds": ["media_001", "media_002"],
      "completionMediaReferenceState": "stable",
      "parentConfirmed": false,
      "completedAt": "2026-10-21T09:00:00.000Z"
    }
  }
}
```

#### 家长确认所见作品版本

T1 第七批实现边界：以下版本确认在独立 growthTaskCompletionConfirmationService 中实现，
未注入生产工厂或修改旧 HTTP handler。需在旧写入口统一锁及生产接入另获批准后，才启用增强端点。
内部服务返回明确选择的确认字段，不返回 owner、pending、绑定代次或远程映射。

`PATCH /api/growth-tasks/:taskId/confirm` 增加必填 `expectedCompletionVersion`：

```json
{
  "expectedCompletionVersion": 2,
  "parentFeedback": "步骤清楚，单位也检查了"
}
```

确认只允许 completed 且媒体引用稳定的任务。版本不匹配返回 `409 VERSION_CONFLICT`；存在
待恢复引用返回 `503 MEDIA_REFERENCE_PENDING`。确认与完成更新使用同一原子状态/版本条件，
最多一方成功。确认成功后完成证据冻结，星星仍由现有 Task 5 幂等命令发放。

历史 `completed` 任务缺少 `completionVersion` 时读取为 0；若同时没有完成媒体且缺少
`completionMediaReferenceState`，读取为 `stable`。新客户端以 `expectedCompletionVersion=0`
确认时，CAS 同时接受缺失或 0 的版本、把缺失版本持久化为 0，并转入 confirmed；确认本身不
递增 `completionVersion`。同一原子更新继续把 `starAwardState` 置为 pending，随后复用现有发星
恢复流程。版本初始化不单独发星，也不能使重复确认再次发星。

本地确认与 starAwardState=pending 同事务 CAS，发星调用必须在该事务提交确认之后；本地事务回滚
或结果未知时返回 `503 STAR_AWARD_PENDING`，不能提前调用远端。既有媒体/活动 owner 阻断仍返回
`503 MEDIA_REFERENCE_PENDING`，不在确认操作中隐式恢复完成命令或材料引用。
远程发星经既有 Task 5 client 与按 task_confirmation 去重的账本执行；失败、响应丢失或畸形确认
均保持 pending。随后重新鉴权、检查同版本及首次确认身份/时间，再 CAS pending→awarded。
同版本重试可由当前仍有权限的共管家长执行，远程 confirmedByParentId 使用当前请求者通过实时授权；
任务中的 confirmedByParentId、confirmedAt、parentFeedback 保留首次确认事实，不被重试正文覆盖。
已经 awarded 的同版本重试不再次调用发星。所有重试仍先授权、校验正文和版本；不存在或无权限任务
统一 403 CHILD_ACCESS_DENIED，孩子不能确认。其他版本返回 VERSION_CONFLICT，缺少期望版本返回
CLIENT_UPGRADE_REQUIRED，未知字段/非法类型返回 VALIDATION_ERROR。
缺失引用状态仅在无完成媒体/无绑定时投影 stable；非空完成媒体但状态/版本缺失不得套用旧数据兼容路径。

T1 第十四批验收边界：测试应用将独立确认服务通过既有 starAwardClient 连接真实 progress
`POST /api/internal/stars/award` 路由及 StarLedgerEntry，不再使用合成星星账本验证此组合。
覆盖远程账本成功后断开响应、畸形成功正文、本地确认/发星终结事务回滚或提交结果未知，以及
当前家长变化后的授权恢复；同一任务仍按既有 task_confirmation 唯一键发一颗星。
客户端配置允许的自动重试与公开同版本重试均复用原任务身份，不改首次确认人/时间/反馈。
测试仅挂载 loopback app，不表示生产确认路由已切换；临时库共享测试 Mongo 连接，未验收
独立服务进程/数据库部署、真实网关登录或完成图片到发星的三服务全链路。

T1 第十五批补齐带完成图片的三服务 HTTP 组合：独立测试应用串联 resource operation 路由、
homework 完成/详情读取/版本确认路由与 progress 真实发星路由。验证图片提交或发布后解绑
响应丢失时确认仍被阻断，GET 仅投影已发布版本、不触发恢复；原 PATCH 恢复后再确认并按任务去重发星。
纯重排保留绑定代次，删除全部图片先按 references 状态对账再精确解绑、不创建空远程 operation；
不同 actor 复用公开 UUID 不共用远程映射，旧成功投影重放不改最新任务或重复发星。
仍仅使用 loopback 与共享临时 Mongo 连接；媒体资产为合成元数据，不涵盖图片上传/字节读取、
真实网关登录、独立服务部署或生产路由接入。此组合不关闭已知稳定性问题或全量门禁。

#### 任务编辑与取消/归档互斥（独立服务，未生产接入）

T1 第八批 growthTaskCompletionMutationService 为后续 PATCH/DELETE 接入准备事务能力，
当前旧 HTTP handler 保持不变，不表示增强接口已开放。仅家长可调用，实时检查家庭/孩子归属；
不存在任务与无权限统一 403 CHILD_ACCESS_DENIED，先授权再校验编辑正文。
编辑复用现有任务字段白名单，只允许 pending 任务；不允许改 owner、状态、完成版本、证据、
确认审计或清单字段。本批不处理材料附件变更，attachmentMediaIds 显式返回 400 MEDIA_NOT_ENABLED；
repeatRule 仍返回 400 REPEAT_RULE_NOT_SUPPORTED，其他未知/非法字段返回 400 VALIDATION_ERROR。
编辑值沿用模型校验，在鉴权后、锁检查前执行；非法值不得被伪装为可重试的 pending。
字段先显式转换再校验；单字段或多字段全部转换失败同样返回 400 VALIDATION_ERROR，不得挂起。
仍按原请求字段校验必填 null，保留可选 null 的清空与空编辑无写入语义，不改变最终事务/CAS。

编辑、取消和归档均在最终事务写入检查无活动完成 owner/pending、两类引用非 pending，以及
当前状态、版本和 __v；冲突恢复状态返回 503 MEDIA_REFERENCE_PENDING，不在这些操作中恢复完成或材料。
pending 删除为 cancelled 并保留首次 cancelledAt；completed 删除为 archived；confirmed 仅在
starAwardState=awarded 时归档，pending 发星返回 409 STAR_AWARD_PENDING。cancelled/archived
重复删除仍需鉴权和检查锁，但不再次写入。不物理删除任务，不解绑媒体或删除账本。
成功响应为 {success:true,data:{task}}，删除另含 deleted:false，task 为显式公开投影，不含恢复元数据。
归档保留完成证据/版本/时间和首次确认审计，历史完成命令仍按原成功投影重放。
事务回滚或提交结果未知返回 503 MEDIA_REFERENCE_PENDING，不返回推测成功；重试重新读取当前状态。
普通任务编辑沿用无 operationId 的赋值语义，不承诺逐请求恰好一次；不得复用旧内存快照，
若期间任务已完成则拒绝编辑，重复删除不能改首次取消时间。
材料编排、清单编辑及旧入口统一切换仍需后续验收与生产接入批准。

T1 第十六批增加独立 `growthTaskCompletionMutation` router 工厂，在测试应用显式挂载
`PATCH /api/growth-tasks/:taskId` 和 `DELETE /api/growth-tasks/:taskId`。两入口固定使用
authenticateGateway，identity 仅取认证后的 req.user，再委托既有 mutation service；成功均为
200（DELETE 返回 deleted:false，不是物理删除的 204），异常交给公共 errorHandler。
本批不新增操作 ID/编辑恰好一次承诺，不开放材料或清单编辑，也不替换生产旧路由。
HTTP 验收覆盖真实完成 owner、确认事务已提交但尚未发星、事务回滚/提交后未知及公开丢响应。
确认/发星组合使用既有真实 progress HTTP；完成使用无图片路径，不重复声称媒体上传/独立部署验收。

T1 第十七批在既有三服务测试应用中组合上述独立 PATCH/DELETE 与真实完成引用、确认/发星 HTTP。
prepare/commit/unbind 的丢响应恢复期间，编辑/删除只能返回既定冲突错误，不能帮助恢复、清除意图、
解绑图片或发星；原完成命令恢复后才允许归档。归档不是隐私删除，保留完成图片引用及其绑定代次，
不修改历史 operation 或账本；归档丢响应由当前家长重试 DELETE 收敛，首次确认审计不变。
这是已有契约的组合验收，不增加公开接口、材料编辑或生产挂载，也不等于真实图片上传/独立部署验收。

#### 完成作品隐私删除（PLANNED）

仅 task_completion 扩展现有 `DELETE /api/media/:mediaId`，无请求体；当前家庭家长、孩子本人可用，
实时校验 familyId/childId，沿用媒体 scope 拒绝，不新增跨家庭存在性信息。确认/归档不阻止此操作。
首次成功和重试返回 204；非法 ID 400，未授权 401/403，不存在且无删除凭证 404；事务结果未知返回
503 MEDIA_REFERENCE_PENDING，客户端重试同一 DELETE，不能以未知结果宣告物理删除完成。

资源事务按[架构 §12.3](../architecture/family-learning-tracker-architecture.md#123-完成命令幂等与并发)
持久保存 MediaDeletionTombstone、使媒体禁读、整组终止 PREPARED、释放目标媒体的 COMMITTED bound。
COMMITTED 不反转；prepare 和删除共享实际资产 referenceFence 写屏障，不能仅以快照读取判定 active。
task_completion 的禁读/引用解除是新扩展；§12 既有媒体接口说明不能被误读为本功能已实现。

内部 status 的 references 每项新增可空 `privacyDeletion`：
`{mediaId, resourceType, resourceId, field, bindingOperationId, deletedAt, releasedAt}`，scope 由已验证请求
限定；只由持久删除凭证生成，不能由 released/absent 推测。operation 模式以匹配 remoteOperationId 和
commandHash 的 COMMITTED 加上“各新增项同代次 bound 或精确 privacyDeletion”允许完成原业务发布。
这不是重新上传/修改冻结证据，公开 mediaId 顺序、版本及旧成功响应仍保持原事实；UI 将读取 404 的项
显示“作品已删除/不可用”，不能展示缓存内容或称其仍待查看。其他 released/absent 仍不能用于 PREPUBLISH。

T1 第三批服务层采用 `MediaDeletionTombstone`（mediaId 唯一的首次删除事实）和
`MediaDeletionReceipt`（完整 scope/引用身份/bindingOperationId 唯一的释放事实）分别持久化。
新协议写命令重放也使用同一引用投影；没有精确凭证时 privacyDeletion=null，不接受客户端提供凭证。
未过期 PREPARED 因隐私删除整组终止时保存 RESOURCE_NOT_FOUND；若已到期则保存
MEDIA_OPERATION_EXPIRED。COMMITTED 仅递增 CAS version，保留 state、terminalAt、摘要和原引用集合。
本段仅描述独立服务实现，DELETE/status 等生产入口仍为 PLANNED，未在 server/Gateway 接入。

T1 第十二批 HTTP 实施边界：独立 `createCompletionMediaPrivacyRouter` 仅适配上述 DELETE，
测试 app 显式挂载，不替换生产 media router。固定 authenticateGateway，身份只来自 req.user；
拒绝非空 JSON 请求体（包括客户端 identity/删除凭证），空对象视作无业务请求体。
不读取正文中的任何删除参数，也不向旧删除服务回退；非 task_completion 返回 MEDIA_PURPOSE_MISMATCH。
宿主负责 JSON 解析和公共 errorHandler。工厂等待隐私事务及持久 journal 完成才发送空 204，
数据库已提交但日志失败仍为 503，重试同一 DELETE 使用新网关身份信封、保留首次删除事实。
真实 loopback HTTP 测试覆盖旧签名禁读、整组终止/精确凭证、丢响应及与完成恢复组合；
不代表生产切换、真实备份介质、前端缓存清除或立即物理删除已验收。

新 prepare 对 deleted 拒绝；内容读取立即拒绝，旧签名也不得绕过。重复 DELETE 不修改首次 actor/时间，
物理清理后仍按最小 tombstone 授权幂等响应。30 天从 deletedAt/最后释放时间较晚者起算，且必须无活跃引用；
清理实际执行才代表在线正文移除。删除凭证不 TTL，旧备份仍可能含正文；按架构的隔离恢复与最新删除日志
重放后才能开放，缺凭证不得上线。全量家庭数据导出/删除、立即清除所有备份不在本轮。
独立删除日志写入失败返回 503 MEDIA_REFERENCE_PENDING，资产保持禁读，重试沿用首次事实。
新删除事务同时设置内部 privacyDeletionRecorded 标记，旧清理跳过这些资产；无该标记的历史删除
不迁移、不停止旧清理。该标记不作为权限或隐私删除凭证，不从公开请求接收或在媒体描述中暴露。

### 14.3 `SL-02`：进行中独立求助

`PATCH /api/growth-tasks/:taskId/help`

请求帮助：

```json
{
  "action": "request",
  "expectedHelpVersion": 0,
  "helpType": "stuck_midway",
  "note": "做到第二步不知道该用哪一个公式"
}
```

家长处理：

```json
{
  "action": "resolve",
  "expectedHelpVersion": 1,
  "parentResponse": "先画图标出已知条件，再看公式表"
}
```

字段白名单：

- request：`action`、`expectedHelpVersion`、`helpType`、`note`；
- resolve：`action`、`expectedHelpVersion`、`parentResponse`；
- `helpType` 为 `instruction_unclear|cannot_start|stuck_midway|uncertain_result|fatigued|other`；
- `note` 和 `parentResponse` 最多 200 字。

孩子本人或家长可 request；只有家庭家长可 resolve。每个任务只保存一条当前求助，服务端记录
真实 actor 和时间。request 的安全重放必须同时满足：当前记录仍为 pending、
`currentHelpVersion === expectedHelpVersion + 1`、规范化后的 `helpType + note` 完全相同，且
认证 actor 与 `requestedByActor` 相同时，才重放当前结果而不创建第二条待处理项；其他旧版本
request 返回 `409 VERSION_CONFLICT`。resolve 严格使用版本 CAS；旧版本 resolve 返回 `409 VERSION_CONFLICT`，
客户端重新 GET，不自动重复用户动作。新的 request 或 resolve 成功后
`helpVersion` 加 1，旧 resolve 不能关闭更新后的 request。求助操作不改变任务 status、
completionVersion、星星、错题或掌握度；完成路由也不能清空当前求助。

家长任务列表增加 `helpStatus=pending|resolved` 过滤并沿用现有分页。取消/归档任务不作为可行动
求助返回；completed 任务上的未处理求助继续可见，直到家长显式处理。

T3 实施核对（2026-10-25）：新 request 仅在任务 pending 时允许；resolve 可处理
pending/completed/confirmed 上的待处理求助，confirmed 不因此解冻完成作品。
cancelled/archived 均拒绝求助写入和重放，返回 `409 TASK_STATE_CONFLICT`。
非取消/归档任务上的 request 安全重放仍按上述四条件判断，属于只读返回，不创建新求助。
resolve 没有待处理记录时返回 `409 TASK_STATE_CONFLICT`；版本不匹配优先返回
`409 VERSION_CONFLICT`。未知提交结果返回 `503 HELP_UPDATE_PENDING`，客户端保留原请求，
重新读取后显式重试；resolve 的旧版本重试仍冲突，不自动升级版本再次处理。

`expectedHelpVersion` 必须为非负安全整数；成功写入不能溢出安全整数。说明/回应省略时规范化为
空字符串；提供时必须是字符串，按 NFC 规范化并 trim，最多 200 个 Unicode 码点；不接受 null。
两端使用相同规则，不按 UTF-16 单元截断文字。
200 成功响应为 `{success:true,data:{task:...}}`，使用任务详情的公开投影。
详情/列表增加 `helpVersion`（旧缺失为 0）及 `helpRequest`（旧缺失为 null）：
`status`、`helpType`、`note`、`requestedByActor:{id,role}`、`requestedAt`，已处理时另含
`parentResponse`、`resolvedByActor:{id,role}`、`resolvedAt`。新 request 替换当前记录，清除旧处理字段。
GET 不补写；历史 needsHelp 不转换为独立求助。求助只更新上述字段及任务写入元数据，
不被活动完成/材料命令阻塞，也不修改或恢复这些命令。最终状态与 helpVersion CAS 保护并发。

### 14.4 `SL-04`：每日学习计划

`GET /api/children/:childId/daily-learning-plans/:localDate`

授权后的今天或历史计划不存在时返回 200，不写数据库；未来日期 GET 返回
`400 VALIDATION_ERROR`，本轮不提供未来计划：

```json
{
  "success": true,
  "data": {
    "plan": {
      "childId": "child_001",
      "localDate": "2026-10-21",
      "items": [],
      "version": 0
    }
  }
}
```

`PUT /api/children/:childId/daily-learning-plans/:localDate`

```json
{
  "expectedVersion": 0,
  "items": [
    { "taskId": "task_math", "childEstimatedMinutes": 20 },
    { "taskId": "task_reading", "childEstimatedMinutes": 15 }
  ]
}
```

- 家长可操作本人家庭孩子；孩子只能操作本人。
- `localDate` 按家庭时区解释，只允许写家庭当地今天；历史只读，未来计划本轮不支持。
- items 最多 20 项、taskId 唯一，估时为空或 1 至 240 的整数。
- PUT 是 items 全量替换，items 必填且允许 `[]`；item 省略 childEstimatedMinutes 或传 null
  均表示清空估时。仅排序时客户端必须保留各项当前分钟，不可只提交 taskId。缺少 expectedVersion
  返回 `400 CLIENT_UPGRADE_REQUIRED`，非法字段值返回 `400 VALIDATION_ERROR`。
- 短/中/长为 5/15/30 分钟快捷值，可留空或改分钟，不增加 estimateBand。childEstimatedMinutes
  是兼容名称，响应 item.estimateRecordedBy 为 `{actorId, role: parent|student}`，表示实际输入者。
  新增/改变分钟才由服务器记录当前 actor；同值/仅排序保留原归属，清空分钟同时清空归属。
  旧记录无归属返回 null，不能推断为孩子。家长代录 UI 明示“家长输入”，不解释为孩子独立判断。
- 响应 plan.updatedByActor 为 `{actorId, role: parent|student}`，记录最近一次成功写入的认证 actor；
  不存在记录的虚拟空计划(version 0)/旧记录缺失为 null。成功保存空 items 仍递增版本并记录 actor。
  客户端提交 estimateRecordedBy/updatedByActor 或 scope 字段返回 400 VALIDATION_ERROR；
  PUT 的 item 白名单仍仅 taskId/childEstimatedMinutes。CAS 冲突不写审计，重排不会篡改估时归属。
- 新加入项必须属于相同家庭和孩子且为 pending；已有同 scope 项可保留或移出，包含
  completed/confirmed/cancelled/archived；不可因保存计划重新打开终态任务。
- 日计划唯一索引为 `{familyId, childId, localDate}`；首次 PUT 要求 expectedVersion 0，成功为 1；
  后续 CAS 严格递增。唯一索引竞争和版本过期都返回 `409 VERSION_CONFLICT`。
- 日计划不修改任务 `dueDate`、status 或家长 `estimatedMinutes`；读取时按当前任务投影可行动状态。
- 响应 item 附 `task:{taskId,title,dimension,status,dueDate}` 的当前最小投影；同 scope 中已无法读取
  时返回 `task:null`，不做跨 scope 补查。该投影不存入计划，不恢复任务媒体；详情操作权限沿用原接口。
- Gateway 仅代理该精确路径，不得改变其他 `/api/children*` 路由归属。

### 14.5 `SL-05`：任务、错题与订正来源

现有创建错题请求增加可选 `sourceTaskId`；创建任务请求增加可选 `sourceTaskId` 或
`sourceMistakeId`。同一任务不能同时提交两个来源字段。

- `analytics-service` 接受 `sourceTaskId` 前，通过带内部服务凭据的 homework 最小读取验证
  来源任务属于相同 familyId 和 childId。
- `homework-service` 接受 `sourceMistakeId` 前，通过带内部服务凭据的 analytics 最小读取验证
  来源错题属于相同 familyId 和 childId。
- 普通调用者不能提交来源 familyId/childId 或内部验证结果。
- 服务所有者必须用 `sourceId + familyId + childId` 做单次 scope 查询。来源不存在、属于其他
  家庭或属于其他孩子，对公开调用统一返回相同的 `404 RESOURCE_NOT_FOUND` 响应；真实原因只写
  脱敏内部审计，不使用差异状态，不泄露资源是否存在、标题、媒体或所属孩子。
- 来源之后不可读取时，详情只返回 `sourceAvailable=false`，不得退回其他孩子内容。
- 两个创建步骤独立提交；一步成功、下一步失败时保留已保存资源并允许重试，不承诺跨服务事务。
- `task_completion` 媒体不能直接作为 `mistake_question` 或 `mistake_answer`。首版要求使用正确
  purpose 重新上传，不增加跨 purpose 复制接口。
- 复习继续使用现有 `reviewReminderDate` 和提醒；不自动写 corrected、mastered 或掌握事件。

T6 实施细化（2026-10-27，设计与实现状态见增量 Gate，不据此声明已交付）：

- 来源仅在创建时设定，PATCH 不接受来源字段；旧无来源对象不回填。
- 内部 GET `/api/internal/learning-sources/tasks/:sourceId`（homework）和
  `/api/internal/learning-sources/mistakes/:sourceId`（analytics），仅接受 familyId/childId 查询参数，
  用 `x-service-token` 验证 INTERNAL_SERVICE_TOKEN。Gateway 不向公开 API 代理这些内部路由。
- 最小响应为 `{success:true,data:{source:{id,familyId,childId,subject,title}}}`，不含媒体或正文。
  调用方验证来源 ID、scope 与响应形状；失败关闭，不跟随重定向。
  合法来源任务的 subject 缺省时规范化为空串，不新增来源必须为智育的限制。
- 来源缺失统一 `{success:false,error:{code:"RESOURCE_NOT_FOUND",message:"RESOURCE_NOT_FOUND",details:[]}}`。
  超时、配置/凭据错误和不合约响应返回 `503 SOURCE_SERVICE_UNAVAILABLE`，不泄露上游正文。
- 单对象详情才实时解析来源；创建/列表保留来源 ID，不引入列表跨服务逐条查询。
  确定不存在时 `sourceAvailable:false,source:null`；依赖故障返回 503，不假装永久不可用。
- 不新增创建全局幂等：响应未知先核对列表，已有明确 resourceId 的 pending 接续沿用原协议。
  两步骤分别保存，来源在首次验证之后消失不回滚已保存对象，不自动重新创建。
- 创建阶段明确的 SOURCE_SERVICE_UNAVAILABLE 发生在写入前，允许保留表单人工重试；媒体
  pending/传输未知可能已保存，必须保留已提交媒体，关闭或切换身份不删除它们。原对象媒体恢复
  不以来源再次可读为前提，不能因来源故障重新 POST。

实施设计：[T6 人工错题、订正与复习连接](../superpowers/specs/2026-10-27-family-self-directed-learning-t6-design.md)。

### 14.6 `SL-06`、`SL-07`：复用接口和部署边界

`SL-06` 不新增孩子修改 WeeklyReport 的接口。孩子反思继续使用现有 GrowthLog
`childReflection`，家长反馈继续使用现有周报反馈接口；历史周统计冻结规则不变。

`SL-07` 不新增业务 API。Ubuntu、iPad Safari、NAS 备份恢复和回滚证据记录在增量 Gate。
部署验收不得包含真实凭据、孩子姓名或作业正文。

### 14.7 数据升级、旧客户端和回滚

T1 第十八批为第 3 项提供独立 homework 只读预检 `assertGrowthTaskCompletionReadiness`，
不是 HTTP 端点或生产启动钩子。仅在运维已停写并显式传入 `writesPaused:true` 后检查本服务
实际 operation 集合的事务前提、完整唯一索引、禁止 TTL、缺失/非法远程映射与重复键。
索引枚举必须包含构建状态；构建中不得通过，额外 prepareUnique 窄键约束同样拒绝。
所有读取显式使用 primary，完整读取索引游标并关闭；不接受 UUID 尾随换行或其他字符。
失败抛出 `COMPLETION_PROTOCOL_NOT_READY` 和固定 `issues` 问题码，不暴露数据或原始数据库错误；
调用方不得把失败降级为旧写协议。不会自动建索引、回填/替换标识或删除记录。
此检查不验证 resource 端状态或备份一致性，也不能证明合法格式的映射从未被历史改写；
生产接入仍须单独批准，不以单次预检代替持续停写、完整发布和恢复门禁。

T1 第十九批增加 resource 侧独立 `assertMediaReferenceOperationReadiness`，仅检查自有
MediaReferenceOperation 账本的实际索引、事务前提、命令身份、完整引用摘要及租约/终态字段。
失败使用 `MEDIA_OPERATION_PROTOCOL_NOT_READY` 和固定 `issues`，不返回冲突行或原始错误。
过期 PREPARED 仍是合法待恢复状态，预检不续租、不转换状态、不修复或删除记录。
同样要求停写、primary 读取及索引构建状态校验；不读取 homework 数据库，不校验删除凭证、
媒体引用和墓碑之间的关联，也不替代恢复演练。仅账本 ready 不表示 resource 整体或生产发布已就绪。
账本 `_id` 与作用域身份必须为原生 ObjectId；集合默认排序规则必须是 simple（或未配置）。
非 simple 默认配置即使另有 simple 唯一索引也拒绝，返回 `OPERATION_COLLECTION_COLLATION_INVALID`：
运行时恢复查询继承集合默认规则，不能只修正预检聚合就宣布可安全启用；不自动迁移集合。

T1 第二十批独立 `assertCompletionPrivacyReadiness` 复用 operation 账本预检后，只读核验
删除证据相关的墓碑、精确代次凭证、媒体和引用。成功 scope 为 `privacy-evidence`，不是完整发布许可；
失败固定 `COMPLETION_PRIVACY_NOT_READY` 与问题码，不返回媒体身份或存储路径。
有证据的媒体若尚存在，必须与墓碑的家庭/孩子/删除时间一致且有 privacyDeletionRecorded 标记；
已清理的媒体允许不存在，但不得残留当前引用。凭证必须对应同 scope 的墓碑及 COMMITTED
operation 中包含的媒体/绑定代次；未清理时还须有相同代次、相同释放时间的隐私 released 引用。
同一完整 scope/media 不得同时存在不同绑定代次的删除凭证，清理后仍检查并以
`RECEIPT_GENERATION_CONFLICT` 阻断；同一媒体用于不同任务的合法多凭证不受影响。
普通解绑及整组 ABORTED 的 released 引用不是删除凭证；未绑定删除可以没有凭证。
要求停写、primary、simple 集合默认规则、已生效唯一索引及无 TTL；不回填证据，不执行清理。
旧的无新协议标记且无墓碑的删除记录保持兼容。非删除媒体的完整引用审计、持久日志介质、
跨服务快照一致性和备份恢复不由本检查证明，生产接入仍需单独授权。

T1 第二十一批独立 `assertCompletionReferenceReadiness` 先执行隐私证据及 operation 前提检查，
再校验所有 completionMediaIds 当前引用与媒体/operation 的双向一致性。成功 scope 为
`reference-consistency`，失败固定 `COMPLETION_REFERENCES_NOT_READY` 和问题码，不返回原始行。
PREPARED 必须保有全部原代次引用、相同租约和活动完成图片；租约到期本身不阻断，预检不恢复。
bound 对应 COMMITTED；released 对应 COMMITTED/ABORTED，后者释放标识必须等于原代次。
普通解绑的 releaseOperationId 只是审计标识，不要求另有 operation 账本。COMMITTED 历史
允许当前引用由合法新代次持有；缺失当前引用仅在媒体也已清理且存在同家庭/孩子墓碑时允许。
ABORTED 可能从未准备，不要求原集合仍有媒体/引用；旧协议字段和未引用上传不自动升级。
读取使用 primary、限时投影和关闭游标，调用者保证全程停写；不查 homework 数据库，
不验证日志介质或跨服务备份一致性，不自动修复、启用生产启动或切换路由。

T1 第二十二批补既有删除日志协议的文件系统故障验证，不新增接口或响应字段。
删除事务提交但文件同步/目录同步失败仍返回脱敏 `503 MEDIA_REFERENCE_PENDING`，即使日志文件
已可读取也不能提前返回 204。授权重试沿用数据库中的首次删除事实，匹配既有日志并重新确认同步；
不覆盖冲突日志。保留清理必须先确认日志，再移除在线正文与元数据；日志失败时不得开始物理清理。
进程中断遗留的临时文件不作为成功凭证，也不被普通重试自动删除。测试仅使用合成数据和临时目录，
不证明断电后的硬件持久性、日志完整性或 NAS/旧快照恢复；生产接入仍需单独确认。

T1 第二十三批在测试临时副本集内停掉三服务 HTTP 后进行 BSON 记录重建，再启动新的独立 app/client。
客户端只重放原公开命令；prepare/commit 未知结果、租约到期、发布后解绑继续使用持久化映射，
移除项仍按精确旧绑定代次处理。历史终态重放不改已发布版本或首次审计，共管发星恢复不重复记账。
缺失映射仍返回 503，不以客户端 UUID 回填或清锁。验证只涉及应用协议的停写快照重建，
不新增备份/恢复 API，不验证真实备份工具、跨库时点一致性或隐私删除日志恢复；生产仍未接入。

T1 第二十四批将删除后的 BSON 记录重建与真实临时日志、保留清理组合验证：PREPARED 删除后
整组保持 ABORTED；COMMITTED 完成恢复仅接受原完整引用集合及精确绑定代次的删除凭证。
保留期清理移除在线媒体/引用后仍保留墓碑、凭证和首次删除审计；缺失或错误代次凭证不得放行发布。
日志或文件删除失败后，重建 app/client 仍按原证据重试，不重绑已删媒体、不重复发星。
此测试不恢复删除前旧快照，不重放日志，不新增生产 API，也不代表旧快照防复活验收完成。

T1 第二十五批补测保留清理在正文已移除后、元数据事务回滚或提交确认丢失的恢复。
事务回滚时 deleted 媒体及 released 引用仍保留，正文缺失不能被误判为清理完成；重试幂等移除
缺失正文后收敛元数据。提交成功但确认丢失时不重复清理已移除记录。两条路径均保留删除凭证、
墓碑和原 operation 终态，重建后的完成恢复仍按原映射执行；不增加生产恢复接口。

T1 第二十六批验证清理失败后先恢复原完成命令、再重试清理的顺序。正文缺失、deleted/released
元数据因回滚仍保留时，COMMITTED 仍须凭原精确删除证据恢复，不能重绑；ABORTED 保持固定失败。
业务恢复后再清理不得改写任务版本、首次确认/删除审计或星星账本。该测试不新增清理 API，
不改变生产路由，不能作为真实数据库故障切换或旧备份恢复的验收。

1. 老任务缺失字段时只做读取默认投影，不在 GET 时写入。
2. 第一次相关写入在同一原子操作内按需原子初始化版本字段；不得批量重写全部 GrowthTask。
   历史 completed 无媒体记录按 `completionVersion=0`、`completionMediaReferenceState=stable`
   投影；确认使用 expected version 0，并只持久化缺失版本为 0，不递增作品版本。
3. `DailyLearningPlan`、`GrowthTaskCompletionOperation` 和 resource 的 `MediaReferenceOperation`
   在开放写入口前建立唯一索引并检查冲突。新资源协议、client、软删除与清理路径须匹配部署。
   本地同时校验 remoteOperationId 唯一索引及不可变映射；若发现缺失映射的试验命令则停止启用，
   单独评审修复，不得用客户端 UUID 回填或批量删除。T0 本身不迁移真实数据。
4. 新写路径必须携带 operation/version 字段；旧客户端缺失时返回
   `400 CLIENT_UPGRADE_REQUIRED`。前后端协调发布并提示刷新，不能静默兼容无版本写入。
5. 老数据仍可读；老任务仍可按现有规则取消/归档。旧数据可读不表示旧写客户端获准更新作品。
6. 回滚先关闭新页面和写入口，保留新字段、索引、本地及远端命令记录、媒体引用和日计划。
   保留 remoteOperationId 映射；未终结命令由支持映射和新协议的版本恢复，不能降级资源服务绕过终态保护。
7. 接收新写入后，不得回滚到绕过版本和冻结规则的旧后端继续写；优先前进修复。
8. 需要恢复旧快照时先停写、备份当前状态、列出预计丢失时间范围，并取得明确数据回退授权。

T1 R2 增加的是[独立运维命令](../deployment/completion-operations.md)，不是公开 API 或内部 HTTP 新路由。
预检成功的 `productionEnabled:false` 不授予业务调用权；缺停写声明、事务/索引/映射/隐私证据或存储不满足时失败退出。
保留清理只有显式 CLI `--execute` 调用，复用既有 30 天、精确凭证、日志先于正文删除的契约。
CLI 成功仅输出 ready 元信息或 cleaned 数量，失败输出固定 code，不外泄正文、路径或对象身份；生产接入仍须单独确认。

T1 R3 第 1–3 步已复审关闭（含单次响应 P3、材料快照及空更新 P2）；第 4 步正式链路实现提交复审。
maintenance 模式的 `/api/growth-tasks`、`/api/media` 及 `/api/internal/media/references` 全部阻断，
分别保留 Gateway 身份/内部凭据校验（无效身份仍为 401），通过后返回：

```json
{"success":false,"error":{"code":"COMPLETION_MAINTENANCE","message":"COMPLETION_MAINTENANCE","details":[]}}
```

HTTP 状态为 503；签名媒体 content 不经 Gateway JWT 验证，直接返回同一维护响应且不读取正文。
维护模式 `/health` 的 HTTP 200 只表示进程可达，返回 `status:maintenance`、`completion.mode:maintenance`、
`completion.ready:false`。resource/homework enabled 均在通过本服务预检和初始化后装配正式协议。
resource 内部引用按既有完整协议分流，混合/不完整字段拒绝；公共 DELETE 拒绝非空 body，按实时权限范围内的
Asset/Tombstone 选择删除服务，墓碑优先，不按客户端 purpose 或服务异常降级。移出家庭的孩子、外家庭和
不存在媒体统一 404；无 child 的 avatar 仍允许所属家庭家长删除。分类查询故障返回固定 `503 MEDIA_REFERENCE_PENDING`。
完成作品删除保持 204、精确凭证、整组终态和首次审计；清理后仍可用墓碑幂等重放。上传/签名内容契约不变。
homework enabled 的 GET 列表/详情不恢复材料或完成意图、不记星；成功响应只包含公开任务投影。
POST 严格创建；PATCH 显式包含 `attachmentMediaIds`（包括空数组）时走隔离材料编排，否则走普通编辑。
材料请求先检查实时家长/家庭/孩子归属再解析完整正文；普通字段和附件统一发布，错误不回退旧路由。
材料 pending 时重试必须保持原有序附件集合和普通字段 patch；异正文返回 `409 RESOURCE_CONFLICT`，不推进旧意图。
即使正文匹配，恢复重读的 operation/阶段/版本及完整意图快照也必须仍与首次验证一致；其他请求已推进或替换该状态时，
返回 `503 MEDIA_REFERENCE_PENDING`，不推进替代意图、不把其稳定结果当作本次成功。初次读取为稳定态的材料编辑同样受保护。
仅提交未变化的 `attachmentMediaIds` 且没有普通字段修改时，最终只读重读同样比较原快照；变化返回上述 503。
没有竞争的空更新仍返回 200，且不更新数据库版本、不调用媒体或发星接口。
此响应不是新意图执行权；调用者应重新读取当前任务（GET 无副作用），再按当前状态选择对应原意图恢复或另行编辑。
材料创建/修改的 `503 MEDIA_REFERENCE_PENDING` 保留 `error.details: {"resourceId":"<taskId>"}`，仅该经校验 ID 可公开。
创建已占位时用这个 ID 发仅含原 `attachmentMediaIds` 的 PATCH 恢复，不再次 POST；修改使用原完整 PATCH 恢复。
DELETE 走取消/归档而非物理删除，不隐式恢复确认记星；版本完成/确认仍使用上述新契约。
以上只在合成环境验证，不表示完整新功能可以开放，也不存在“enabled 但旧完成 writer 服务请求”的兼容模式。
缺 UUID/版本的 `CLIENT_UPGRADE_REQUIRED` 契约不变，前端适配仍归 T2；正式装配和真实启用边界见
[R3 批准方案](../architecture/family-self-directed-learning-r3-assembly-proposal.md)。

Gateway 不公开 `/api/internal/media/references` 或 `/api/internal/stars`，外部请求返回 404；
客户端 `x-service-token` 在公开入口统一移除，包括无需 JWT 的认证/签名内容路径，不能透传为服务间权限。
未携带、过期或无效 JWT 统一返回 `401 UNAUTHENTICATED`（修正旧Gateway的403认证失败语义）；服务实时检查孩子代次失败返回
`401 STALE_CHILD_TOKEN`；任务不在实时授权孩子范围返回 `403 CHILD_ACCESS_DENIED`。
客户端仅对当前请求身份的401进入过期/重登流程，保留原完成命令；普通403权限拒绝不注销。
迟到认证失败不能清除新会话。错误码沿用既有UNAUTHENTICATED，不新增凭据/角色协议。
媒体跨家庭或不存在仍统一 404，不将任务和媒体错误语义混为一谈。
第四步以实际 Gateway 和三服务正式工厂验证公开完成/确认响应丢失后重放、远程提交/记星响应丢失恢复、
共管首次确认审计和删除日志重放。读取不触发远程写，重试不新增账本或替换首次审计；合成通过不等于真实启用。

## T2-G 内部孤儿媒体屏障

用户已批准补充设计及只读 status 接口；实现和验收进度见 T2 执行记录 §10，不能据此部署真实环境。
仅 homework `enabled` 装配下可用，不由 Gateway 代理，不接受用户 JWT 或现有媒体/发星凭据替代。
两端独立配置 `COMPLETION_RETIREMENT_SERVICE_TOKEN`，使用 `x-service-token`，不得复用其他密钥。

| 接口 | 语义 | 成功状态 |
| --- | --- | --- |
| `POST /api/internal/completion-media-retirements` | 同事务检查实时家庭/孩子、全部任务使用和活动账本，建立持久退休屏障 | `granted` / `in_use` |
| `POST /api/internal/completion-media-retirements/status` | 同一只读事务验证实时家庭/孩子并读取精确 guard，不创建或更新数据 | `absent` / `available` / `retired` |

两者正文严格为四个字符串字段：`familyId`、`childId`、`mediaId`（规范 ObjectId）及 `retirementId`（UUID），不接受查询参数或附加字段。
成功均返回 HTTP 200：`{success:true,data:{familyId,childId,mediaId,retirementId,state}}`。
只有匹配原持久 retirementId 的 `retired` 才证明已退休；status 的 absent/available 中 retirementId 仅回显请求，绝不表示授予删除。
缺失/错误凭据返回401 INVALID_SERVICE_CREDENTIAL；不合法输入400 VALIDATION_ERROR；身份/退休标识冲突拒绝，
不得以无权/不存在家庭取得 granted。未知或畸形响应不能当作退休许可；client 对全 scope、ID、状态和响应结构逐项校验。
跨服务预检只调用 status，不能用写退休接口证明“零写”。内部状态不提供给浏览器。

新 `task_completion` 上传在 enabled 下固定资产身份并先持久上传记录，再进行元数据事务；设置 policy=1 和完整24小时宽限。
上传结果未知不补偿删除正文；删除终态/RETIRED guard 优先于缺失资产，不通过重试复活已删作品。
回收需额外显式开关与运维命令，默认关闭；没有新的公开回收、登记或恢复 API。旧客户端升级拒绝不变。
