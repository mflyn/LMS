# 家庭成长跟踪 API 契约

## 1. 基本约定

第一阶段 API 服务于家庭成长跟踪 MVP，覆盖家长 Web 端和孩子简化入口。

基础约定：

- API 统一通过 `gateway` 暴露。
- 家长使用 `Authorization: Bearer <token>` 访问。
- 孩子使用 PIN 登录后获得孩子作用域 token。
- 家庭级数据必须携带 `familyId`。
- 孩子级数据必须携带 `familyId` 和 `childId`。
- 成长任务和成长记录必须携带 `dimension`。

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
  "message": "无权访问该孩子的数据"
}
```

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
  "familyName": "小明的家"
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
      "familyName": "小明的家"
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

### 2.6 孩子 PIN 登录

`POST /api/auth/child-pin-login`

请求：

```json
{
  "familyId": "family_001",
  "childId": "child_001",
  "pin": "1234"
}
```

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
  "priority": "medium",
  "repeatRule": "daily"
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
      "confirmedAt": "2026-06-18T10:30:00.000Z"
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
    "total": 1
  }
}
```

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
    "total": 1
  }
}
```

## 7. Weekly Reports

### 7.1 生成或读取成长周报

`GET /api/reports/weekly?childId=child_001&weekStart=2026-06-15`

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
    ]
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
