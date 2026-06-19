# 家庭成长跟踪 API 契约

**Document status:** APPROVED
**Baseline candidate:** FGT-MVP-1
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

状态码约定：参数错误返回 `400`，未登录或凭据错误返回 `401`，越权返回 `403`，资源不存在返回 `404`，状态冲突返回 `409`，登录限流返回 `429`，跨域聚合暂不可用返回 `503`。错误 `code` 是稳定契约，`message` 只用于展示。

通用稳定错误码包括 `VALIDATION_ERROR`、`UNAUTHENTICATED`、`INVALID_IDENTITY_ENVELOPE`、`INVALID_SERVICE_CREDENTIAL`、`CHILD_ACCESS_DENIED`、`FIELD_ACCESS_DENIED`、`RESOURCE_NOT_FOUND`、`RESOURCE_CONFLICT`、`IDEMPOTENCY_KEY_REUSED`、`TASK_STATE_CONFLICT`、`REWARD_STATE_CONFLICT`、`REPEAT_RULE_NOT_SUPPORTED`、`INVALID_CHILD_CREDENTIALS`、`PIN_LOGIN_RATE_LIMITED`、`INSUFFICIENT_STARS`、`AGGREGATION_UNAVAILABLE` 和 `STAR_AWARD_PENDING`。接口可以定义更具体的稳定 code，但不得退回仅有 message 的错误响应。

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
| `POST /api/auth/child-pin-login` | 公开、限流 | `FR-CHILD-004`, `FR-CHILD-005` | 孩子 PIN 登录 |
| `POST /api/families` | 家长 | `FR-FAM-001`, `NFR-SEC-001` | 创建家庭 |
| `GET /api/families/me` | 家长 | `FR-FAM-002`, `NFR-SEC-001` | 获取家庭和孩子 |
| `PATCH /api/families/:familyId` | 家长 | `FR-FAM-002`, `NFR-SEC-001` | 修改自己的家庭 |
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
| `DELETE /api/growth-tasks/:taskId` | 家长 | `FR-TASK-006` | 删除未完成任务或归档已完成任务 |
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
| `POST /api/rewards` | 家长 | `FR-REWARD-002` | 创建家庭奖励 |
| `GET /api/rewards` | 家长、孩子本人 | `FR-REWARD-001`, `FR-REWARD-002` | 查询奖励、星星余额和流水 |
| `PATCH /api/rewards/:rewardId/redeem` | 家长 | `FR-REWARD-002` | 确认兑换并幂等扣减星星 |
| `GET /api/notifications/family` | 家长、孩子本人 | `FR-NOTIFY-001` | 派生家庭提醒 |
| `POST /api/internal/stars/award` | homework-service | `FR-REWARD-001`, `NFR-SEC-003`, `NFR-DATA-002` | 内部幂等星星发放，不通过 gateway |

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
  "timezone": "Asia/Shanghai"
}
```

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
      "timezone": "Asia/Shanghai"
    },
    "children": [
      {
        "childId": "child_001",
        "name": "小明",
        "grade": 3,
        "avatar": "",
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
  "priority": "medium"
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

## 4. Growth Logs

### 4.1 创建每日成长记录

`POST /api/growth-logs`

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
      "masteryLevel": "learning"
    }
  }
}
```

## 6. Mistakes

错题是智育专项能力。错题记录的 `dimension` 固定为 `academic`。

### 6.1 创建错题

`POST /api/mistakes`

请求：

```json
{
  "childId": "child_001",
  "subject": "数学",
  "knowledgePointName": "分数计算",
  "questionImageUrl": "https://example.com/uploads/question-001.jpg",
  "childAnswerImageUrl": "https://example.com/uploads/answer-001.jpg",
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
      "corrected": false,
      "reviewed": false,
      "mastered": false,
      "reviewReminderDate": "2026-06-21"
    }
  }
}
```

### 6.2 查询错题

`GET /api/mistakes?childId=child_001&subject=数学&reviewStatus=pending`

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

## 7. Weekly Reports

### 7.1 计算或读取成长周报

`GET /api/reports/weekly?childId=child_001&weekStart=2026-06-15`

`weekStart` 必须是家庭时区中的周一。该 GET 操作对调用者保持安全和幂等：统计字段由源数据确定性计算，可以更新内部缓存，但不得产生星星、提醒或其他业务副作用。缓存键为 `familyId + childId + weekStart`；源数据变化后必须失效或重新计算。

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
      "recordDays": 6,
      "totalDurationMinutes": 520,
      "taskCompletionRate": 80,
      "dimensionTaskStats": {
        "moral": { "completed": 4, "total": 7 },
        "academic": { "completed": 10, "total": 12 },
        "physical": { "completed": 4, "total": 5 },
        "artistic": { "completed": 3, "total": 3 },
        "labor": { "completed": 3, "total": 3 }
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
      "reviewKnowledgePoints": ["分数计算"],
      "nextWeekSuggestion": "保持数学错题复习，增加 2 次户外运动，固定周三和周六做劳动任务。"
    }
  }
}
```

## 8. Rewards

星星发放规则：第一阶段只有家长首次确认一个已完成任务时发放 1 颗星。以 `taskId` 作为幂等来源，同一任务重复确认不得重复发放。星星余额等于不可变流水中 `earn + adjust - spend` 的合计。若积分服务暂时不可用，确认接口返回 `503 STAR_AWARD_PENDING`；任务保留 `confirmed + starAwardState=pending`，客户端可以安全重试确认。

### 8.1 创建奖励

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

### 8.2 查询奖励、星星余额和流水

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

### 8.3 家长确认奖励兑换

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

### 8.4 内部星星发放命令

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

## 9. Notifications

### 9.1 查询家庭提醒

`GET /api/notifications/family?childId=child_001`

响应：

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "type": "task_due_today",
        "title": "今天还有 3 个成长任务",
        "dimension": "academic",
        "childId": "child_001"
      },
      {
        "type": "mistake_review",
        "title": "今天需要复习数学错题：分数计算",
        "dimension": "academic",
        "childId": "child_001"
      },
      {
        "type": "habit",
        "title": "今晚记得按时睡觉打卡",
        "dimension": "moral",
        "childId": "child_001"
      }
    ],
    "meta": {
      "partial": false,
      "unavailableSources": []
    },
    "page": 1,
    "pageSize": 20,
    "total": 3
  }
}
```

## 10. 权限验收规则

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
