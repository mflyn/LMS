# 数据模型

## 目录说明
本目录包含系统的数据模型定义，使用 Mongoose 进行 MongoDB 数据库的建模。

## 目录结构
```
models/
├── User.js              # 用户模型
├── Grade.js             # 成绩模型
├── Homework.js          # 作业模型
├── ClassPerformance.js  # 课堂表现模型
├── MistakeRecord.js     # 错题记录模型
├── Resource.js          # 资源模型
├── Notification.js      # 通知模型
└── AuditLog.js          # 审计日志模型
```

## 模型说明

### 用户模型 (User.js)
- 用户基本信息
- 角色权限管理
- 账号状态管理
- 密码加密存储

### 成绩模型 (Grade.js)
- 学生成绩记录
- 考试类型
- 成绩分析
- 历史记录

### 作业模型 (Homework.js)
- 作业基本信息
- 作业内容
- 提交状态
- 批改记录

### 课堂表现模型 (ClassPerformance.js)
- 表现记录
- 评分标准
- 教师评语
- 改进建议

### 错题记录模型 (MistakeRecord.js)
- 错题内容
- 正确答案
- 错误分析
- 知识点关联

### 资源模型 (Resource.js)
- 资源信息
- 文件存储
- 访问权限
- 使用统计

### 通知模型 (Notification.js)
- 通知内容
- 接收对象
- 发送状态
- 阅读状态

### 审计日志模型 (AuditLog.js)
- 操作记录
- 用户行为
- 系统事件
- 安全审计

## 使用方法
在代码中引入并使用模型：

```javascript
const User = require('./models/User');
const Grade = require('./models/Grade');
const Homework = require('./models/Homework');
// ... 其他模型

// 使用模型
const user = new User({
  username: 'testuser',
  password: 'hashedPassword',
  role: 'student'
});

await user.save();
```

## 数据验证
所有模型都包含以下验证：
1. 必填字段验证
2. 数据类型验证
3. 数据格式验证
4. 唯一性验证
5. 关联性验证

## 索引优化
为提高查询性能，模型包含以下索引：
1. 主键索引
2. 外键索引
3. 复合索引
4. 文本索引
5. 地理空间索引

## 注意事项
1. 修改模型后需要更新数据库索引
2. 生产环境需要定期优化索引
3. 注意数据一致性和完整性
4. 定期备份重要数据 