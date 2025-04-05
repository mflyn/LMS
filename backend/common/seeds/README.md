# 种子数据

## 目录说明
本目录包含系统初始化所需的种子数据，用于开发和测试环境。种子数据包括用户、班级、课程、资源等基础数据。

## 目录结构
```
seeds/
├── users/           # 用户数据
│   ├── admin.js    # 管理员账号
│   ├── teachers.js # 教师账号
│   ├── students.js # 学生账号
│   └── parents.js  # 家长账号
├── classes/        # 班级数据
│   └── classes.js  # 班级信息
├── courses/        # 课程数据
│   └── courses.js  # 课程信息
├── resources/      # 资源数据
│   └── resources.js # 学习资源
└── runSeeds.js     # 种子数据执行脚本
```

## 使用方法

### 环境配置
1. 复制环境变量文件
```bash
cp .env.example .env
```

2. 修改环境变量
```env
# 数据库配置
MONGODB_URI=mongodb://localhost:27017/education
MONGODB_USER=admin
MONGODB_PASSWORD=password

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=password

# 其他配置
NODE_ENV=development
```

### 执行所有种子数据
```bash
node runSeeds.js
```

### 执行特定类型的种子数据
```bash
# 只执行用户数据
node runSeeds.js --type users

# 只执行班级数据
node runSeeds.js --type classes

# 只执行课程数据
node runSeeds.js --type courses

# 只执行资源数据
node runSeeds.js --type resources
```

### 数据清理
```bash
# 清理所有种子数据
node runSeeds.js --clean

# 清理特定类型的种子数据
node runSeeds.js --clean --type users
```

## 数据说明

### 用户数据
```javascript
// admin.js
module.exports = {
  username: 'admin',
  password: 'admin123',
  role: 'admin',
  email: 'admin@example.com',
  status: 'active',
  permissions: ['all']
};

// teachers.js
module.exports = [
  {
    username: 'teacher1',
    password: 'teacher123',
    role: 'teacher',
    email: 'teacher1@example.com',
    subject: '数学',
    grade: '一年级',
    status: 'active'
  }
];

// students.js
module.exports = [
  {
    username: 'student1',
    password: 'student123',
    role: 'student',
    email: 'student1@example.com',
    classId: 'class1',
    grade: '一年级',
    status: 'active'
  }
];

// parents.js
module.exports = [
  {
    username: 'parent1',
    password: 'parent123',
    role: 'parent',
    email: 'parent1@example.com',
    children: ['student1'],
    status: 'active'
  }
];
```

### 班级数据
```javascript
// classes.js
module.exports = [
  {
    id: 'class1',
    name: '一年级一班',
    grade: '一年级',
    teacherId: 'teacher1',
    students: ['student1', 'student2'],
    status: 'active'
  }
];
```

### 课程数据
```javascript
// courses.js
module.exports = [
  {
    id: 'course1',
    name: '数学',
    grade: '一年级',
    teacherId: 'teacher1',
    description: '一年级数学课程',
    chapters: [
      {
        id: 'chapter1',
        name: '第一章：数字的认识',
        lessons: [
          {
            id: 'lesson1',
            name: '第一课：1-10的认识',
            content: '...'
          }
        ]
      }
    ],
    status: 'active'
  }
];
```

### 资源数据
```javascript
// resources.js
module.exports = [
  {
    id: 'resource1',
    name: '数学课件1',
    type: '课件',
    subject: '数学',
    grade: '一年级',
    fileUrl: '/resources/math1.pdf',
    size: 1024,
    status: 'active'
  }
];
```

## 数据验证

### 用户数据验证
```javascript
const validateUser = (user) => {
  const requiredFields = ['username', 'password', 'role', 'email'];
  const validRoles = ['admin', 'teacher', 'student', 'parent'];
  
  for (const field of requiredFields) {
    if (!user[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
  
  if (!validRoles.includes(user.role)) {
    throw new Error(`Invalid role: ${user.role}`);
  }
};
```

### 班级数据验证
```javascript
const validateClass = (classData) => {
  const requiredFields = ['id', 'name', 'grade', 'teacherId'];
  
  for (const field of requiredFields) {
    if (!classData[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
};
```

## 错误处理

### 数据库连接错误
```javascript
try {
  await mongoose.connect(process.env.MONGODB_URI);
} catch (error) {
  console.error('Database connection error:', error);
  process.exit(1);
}
```

### 数据插入错误
```javascript
try {
  await User.insertMany(users);
} catch (error) {
  if (error.code === 11000) {
    console.error('Duplicate key error:', error);
  } else {
    console.error('Insert error:', error);
  }
}
```

## 注意事项
1. 种子数据仅用于开发和测试环境
2. 执行前请确保数据库已正确配置
3. 生产环境请勿使用种子数据
4. 修改种子数据后需要重新执行脚本
5. 定期清理测试数据，避免数据堆积
6. 注意保护敏感信息，如密码等
7. 确保数据格式正确，避免插入错误
8. 定期备份重要数据

## 维护建议
1. 定期更新种子数据，保持与最新需求同步
2. 添加数据验证，确保数据质量
3. 实现数据清理功能，方便测试环境重置
4. 添加日志记录，方便问题排查
5. 实现数据版本控制，便于追踪变更
6. 添加数据导出功能，方便数据迁移
7. 实现数据恢复功能，应对意外情况
8. 定期检查数据完整性，确保系统稳定 