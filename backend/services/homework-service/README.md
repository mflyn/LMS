# 作业管理服务 (Homework Service)

作业管理服务是小学生学习追踪系统的核心微服务之一，负责处理与学生作业相关的所有功能，包括作业的发布、提交、批改和统计分析。本服务为教师提供高效的作业管理工具，同时为学生提供清晰的作业提交和反馈渠道。

## 功能特性

### 作业发布
- 多类型作业创建（文本、选择题、上传文件等）
- 作业模板管理和复用
- 定时发布和截止设置
- 个性化作业分配
- 批量作业发布

### 作业提交
- 多格式作业提交
- 在线作答功能
- 文件上传和管理
- 提交状态跟踪
- 截止时间提醒

### 作业批改
- 在线批改工具
- 批量评分功能
- 评语和反馈管理
- 自动评分（选择题等）
- 批改进度跟踪

### 作业分析
- 完成率统计
- 成绩分布分析
- 常见错误识别
- 难度评估
- 学生表现对比

## 技术架构

### 技术栈
- Node.js + Express.js
- MongoDB（作业数据存储）
- MinIO/S3（作业文件存储）
- Redis（缓存和任务队列）

### 目录结构
```
/homework-service
  ├── server.js           # 服务入口
  ├── package.json        # 依赖管理
  ├── models/             # 数据模型
  │   └── Homework.js     # 作业模型
  └── routes/             # API路由
      └── homework.js     # 作业相关路由
```

## API接口

### 作业管理接口

#### 创建作业
- **POST** `/api/homework`
- 请求头：`Authorization: Bearer {token}`
- 请求体：
  ```json
  {
    "title": "string",
    "description": "string",
    "classId": "string",
    "subjectId": "string",
    "dueDate": "date",
    "startDate": "date",
    "type": "string", // text, quiz, file, mixed
    "content": {
      "questions": [
        {
          "type": "string", // text, choice, file
          "question": "string",
          "options": ["string"], // for choice type
          "answer": "string", // optional, for auto-grading
          "points": "number"
        }
      ],
      "totalPoints": "number",
      "allowLateSubmission": "boolean",
      "visibleToStudents": "boolean"
    },
    "attachments": ["string"] // file URLs
  }
  ```
- 响应：创建的作业对象

#### 获取班级作业列表
- **GET** `/api/homework/class/{classId}`
- 请求头：`Authorization: Bearer {token}`
- 查询参数：
  - `status`: 作业状态（active/past/all，默认：active）
  - `subject`: 科目ID（可选）
  - `startDate`: 开始日期（可选）
  - `endDate`: 结束日期（可选）
- 响应：作业列表

#### 获取作业详情
- **GET** `/api/homework/{homeworkId}`
- 请求头：`Authorization: Bearer {token}`
- 响应：作业详细信息

### 作业提交接口

#### 提交作业
- **POST** `/api/homework/{homeworkId}/submissions`
- 请求头：`Authorization: Bearer {token}`
- 请求体：
  ```json
  {
    "answers": [
      {
        "questionId": "string",
        "answer": "string", // or array for multiple choice
        "fileUrl": "string" // for file type questions
      }
    ],
    "comment": "string",
    "attachments": ["string"] // additional file URLs
  }
  ```
- 响应：提交的作业对象

#### 获取学生作业提交
- **GET** `/api/homework/{homeworkId}/submissions/{studentId}`
- 请求头：`Authorization: Bearer {token}`
- 响应：学生提交的作业

### 作业批改接口

#### 批改作业
- **PUT** `/api/homework/{homeworkId}/submissions/{submissionId}/grade`
- 请求头：`Authorization: Bearer {token}`
- 请求体：
  ```json
  {
    "score": "number",
    "feedback": "string",
    "questionFeedback": [
      {
        "questionId": "string",
        "score": "number",
        "comment": "string"
      }
    ],
    "status": "string" // graded, returned, revised
  }
  ```
- 响应：更新后的作业提交对象

#### 获取班级作业统计
- **GET** `/api/homework/{homeworkId}/statistics`
- 请求头：`Authorization: Bearer {token}`
- 响应：作业统计数据

## 数据模型

### 作业模型 (Homework)
```javascript
{
  title: String,           // 作业标题
  description: String,     // 作业描述
  classId: ObjectId,       // 班级ID
  subjectId: ObjectId,     // 科目ID
  teacherId: ObjectId,     // 教师ID
  startDate: Date,         // 开始日期
  dueDate: Date,           // 截止日期
  type: String,            // 作业类型
  content: {
    questions: [{         // 问题列表
      type: String,        // 问题类型
      question: String,    // 问题内容
      options: [String],   // 选项（选择题）
      answer: String,      // 答案（可选）
      points: Number       // 分值
    }],
    totalPoints: Number,   // 总分
    allowLateSubmission: Boolean, // 允许迟交
    visibleToStudents: Boolean // 对学生可见
  },
  attachments: [String],   // 附件URL
  status: String,          // 状态
  submissions: [{          // 提交记录
    studentId: ObjectId,   // 学生ID
    submitDate: Date,      // 提交日期
    answers: [{            // 答案
      questionId: String,  // 问题ID
      answer: String,      // 答案内容
      fileUrl: String      // 文件URL
    }],
    comment: String,       // 学生评论
    attachments: [String], // 附加文件
    score: Number,         // 得分
    feedback: String,      // 教师反馈
    questionFeedback: [{   // 问题反馈
      questionId: String,  // 问题ID
      score: Number,       // 得分
      comment: String      // 评语
    }],
    status: String,        // 状态
    gradedBy: ObjectId,    // 批改教师
    gradedAt: Date         // 批改时间
  }],
  statistics: {            // 统计数据
    submissionCount: Number, // 提交数量
    averageScore: Number,  // 平均分
    highestScore: Number,  // 最高分
    lowestScore: Number,   // 最低分
    completionRate: Number // 完成率
  },
  meta: {
    createdAt: Date,      // 创建时间
    updatedAt: Date        // 更新时间
  }
}
```

## 开发指南

### 环境要求
- Node.js >= 14.x
- MongoDB >= 4.x
- MinIO/S3 兼容存储（用于文件上传）
- Redis >= 6.x（可选，用于缓存）

### 安装依赖
```bash
npm install
```

### 启动服务
```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

### 环境变量
- `PORT` - 服务端口（默认：3008）
- `MONGODB_URI` - MongoDB连接URI
- `MINIO_ENDPOINT` - MinIO服务端点
- `MINIO_ACCESS_KEY` - MinIO访问密钥
- `MINIO_SECRET_KEY` - MinIO秘密密钥
- `MINIO_BUCKET` - MinIO存储桶名称
- `REDIS_URL` - Redis连接URL（可选）
- `NODE_ENV` - 环境（development/production）

## 作业类型

### 文本作业
- 简答题
- 论述题
- 填空题
- 问答题

### 选择作业
- 单选题
- 多选题
- 判断题
- 匹配题

### 文件作业
- 文档上传
- 图片上传
- 音频录制
- 视频录制

### 混合作业
- 组合多种题型
- 分阶段完成
- 协作作业

## 批改功能

### 手动批改
- 在线评分工具
- 批注和标记
- 评语模板
- 分项评分

### 自动批改
- 选择题自动评分
- 关键词匹配评分
- 相似度检测
- 批量处理

## 通知集成

- 作业发布通知
- 截止日期提醒
- 作业批改通知
- 成绩发布通知

## 数据导出

- 作业成绩导出（CSV/Excel）
- 作业统计报告
- 学生提交汇总
- 批量打印功能

## 常见问题

1. **作业提交失败**
   - 检查文件大小和格式是否支持
   - 确认截止日期是否已过
   - 验证网络连接和服务状态

2. **批改功能问题**
   - 确认权限设置正确
   - 检查作业状态是否为已提交
   - 验证评分规则设置

3. **统计数据不准确**
   - 刷新统计缓存
   - 确认所有提交已处理
   - 检查计算逻辑和参数