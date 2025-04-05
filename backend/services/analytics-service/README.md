# 数据分析服务 (Analytics Service)

数据分析服务是小学生学习追踪系统的核心微服务之一，负责对系统中收集的各类学习数据进行深度分析和可视化，为学生、教师和家长提供有价值的学习洞察和决策支持。本服务通过先进的数据处理和分析技术，挖掘学习数据中的模式和趋势。

## 功能特性

### 学习行为分析
- 学习时间和频率分析
- 学习习惯和模式识别
- 注意力和专注度评估
- 学习行为异常检测
- 学习策略有效性分析

### 学业表现分析
- 成绩趋势和波动分析
- 知识点掌握度热力图
- 错题模式和类型分析
- 班级和年级对比分析
- 学科间相关性分析

### 预测性分析
- 学习成果预测
- 学习风险预警
- 知识点掌握预测
- 学习瓶颈识别
- 个性化学习路径推荐

### 数据可视化
- 交互式仪表盘
- 个性化学习报告
- 多维数据图表
- 时间序列可视化
- 班级和个人对比图表

## 技术架构

### 技术栈
- Node.js + Express.js
- MongoDB（数据存储）
- Redis（缓存和实时计算）
- 数据分析库（TensorFlow.js, ml.js）
- 可视化库（D3.js, Chart.js）

### 目录结构
```
/analytics-service
  ├── server.js           # 服务入口
  ├── models/             # 数据模型
  │   ├── StudentPerformanceTrend.js # 学生表现趋势模型
  │   ├── ClassPerformance.js # 班级表现模型
  │   └── MistakeRecord.js # 错题记录分析模型
  ├── routes/             # API路由
  │   ├── trends.js       # 趋势分析路由
  │   ├── reports.js      # 报告生成路由
  │   ├── progress.js     # 进度分析路由
  │   ├── behavior.js     # 行为分析路由
  │   └── long-term-trends.js # 长期趋势分析路由
  └── utils/              # 工具函数
      └── visualization-helper.js # 可视化辅助函数
```

## API接口

### 趋势分析接口

#### 获取学生成绩趋势
- **GET** `/api/trends/student/{studentId}/grades`
- 请求头：`Authorization: Bearer {token}`
- 查询参数：
  - `subject`: 科目ID（可选）
  - `period`: 时间段（month/semester/year/all，默认：semester）
  - `groupBy`: 分组方式（day/week/month，默认：week）
- 响应：成绩趋势数据

#### 获取知识点掌握趋势
- **GET** `/api/trends/student/{studentId}/mastery`
- 请求头：`Authorization: Bearer {token}`
- 查询参数：
  - `subject`: 科目ID（可选）
  - `knowledgePoints`: 知识点ID数组（可选）
  - `period`: 时间段（默认：semester）
- 响应：知识点掌握度趋势数据

### 报告接口

#### 生成学生综合报告
- **GET** `/api/reports/student/{studentId}/comprehensive`
- 请求头：`Authorization: Bearer {token}`
- 查询参数：
  - `period`: 报告周期（week/month/semester，默认：month）
  - `format`: 报告格式（json/pdf/html，默认：json）
  - `includeRecommendations`: 是否包含建议（默认：true）
- 响应：综合报告数据或文件下载链接

#### 生成班级分析报告
- **GET** `/api/reports/class/{classId}/analysis`
- 请求头：`Authorization: Bearer {token}`
- 查询参数：
  - `subject`: 科目ID（可选）
  - `period`: 报告周期（默认：month）
  - `format`: 报告格式（默认：json）
- 响应：班级分析报告数据

### 行为分析接口

#### 获取学习行为分析
- **GET** `/api/behavior/student/{studentId}`
- 请求头：`Authorization: Bearer {token}`
- 查询参数：
  - `type`: 行为类型（time/pattern/focus，可多选，逗号分隔）
  - `period`: 时间段（默认：month）
- 响应：学习行为分析数据

#### 获取班级行为模式
- **GET** `/api/behavior/class/{classId}/patterns`
- 请求头：`Authorization: Bearer {token}`
- 查询参数：
  - `period`: 时间段（默认：month）
  - `groupBy`: 分组方式（student/behavior/time，默认：behavior）
- 响应：班级行为模式数据

## 数据模型

### 学生表现趋势模型 (StudentPerformanceTrend)
```javascript
{
  studentId: ObjectId,     // 学生ID
  subject: ObjectId,       // 科目ID（可选）
  period: String,          // 时间段
  trends: {
    grades: [{            // 成绩趋势
      date: Date,          // 日期
      value: Number,       // 成绩值
      examId: ObjectId,    // 考试ID
      type: String         // 考试类型
    }],
    mastery: [{            // 掌握度趋势
      date: Date,          // 日期
      knowledgePointId: ObjectId, // 知识点ID
      value: Number        // 掌握度值
    }],
    time: [{               // 学习时间趋势
      date: Date,          // 日期
      minutes: Number,     // 学习分钟数
      subjectId: ObjectId  // 科目ID
    }],
    mistakes: [{           // 错题趋势
      date: Date,          // 日期
      count: Number,       // 错题数量
      knowledgePointId: ObjectId, // 知识点ID
      mistakeType: String  // 错误类型
    }]
  },
  insights: [{             // 分析洞察
    type: String,          // 洞察类型
    description: String,   // 洞察描述
    confidence: Number,    // 置信度
    relatedData: Object    // 相关数据
  }],
  meta: {
    createdAt: Date,      // 创建时间
    updatedAt: Date,       // 更新时间
    dataPoints: Number     // 数据点数量
  }
}
```

### 班级表现模型 (ClassPerformance)
```javascript
{
  classId: ObjectId,       // 班级ID
  subject: ObjectId,       // 科目ID（可选）
  period: String,          // 时间段
  overall: {
    averageScore: Number,  // 平均分
    medianScore: Number,    // 中位数
    standardDeviation: Number, // 标准差
    highestScore: Number,   // 最高分
    lowestScore: Number,    // 最低分
    passRate: Number,       // 及格率
    excellentRate: Number   // 优秀率
  },
  distribution: {          // 分数分布
    ranges: [Number],      // 分数范围
    counts: [Number]       // 学生数量
  },
  knowledgePoints: [{      // 知识点掌握情况
    knowledgePointId: ObjectId, // 知识点ID
    name: String,          // 知识点名称
    averageMastery: Number, // 平均掌握度
    weakStudentCount: Number // 薄弱学生数量
  }],
  trends: {                // 班级趋势
    averageScores: [{      // 平均分趋势
      date: Date,          // 日期
      value: Number        // 平均分
    }],
    passRates: [{          // 及格率趋势
      date: Date,          // 日期
      value: Number        // 及格率
    }]
  },
  insights: [{             // 班级洞察
    type: String,          // 洞察类型
    description: String,   // 洞察描述
    confidence: Number,    // 置信度
    relatedData: Object    // 相关数据
  }],
  meta: {
    createdAt: Date,      // 创建时间
    updatedAt: Date,       // 更新时间
    studentCount: Number   // 学生数量
  }
}
```

## 开发指南

### 环境要求
- Node.js >= 14.x
- MongoDB >= 4.x
- Redis >= 6.x（用于缓存和实时计算）

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
- `PORT` - 服务端口（默认：3007）
- `MONGODB_URI` - MongoDB连接URI
- `REDIS_URL` - Redis连接URL
- `DATA_SERVICE_URL` - 数据服务API地址
- `PROGRESS_SERVICE_URL` - 进度服务API地址
- `NODE_ENV` - 环境（development/production）

## 分析算法

### 趋势分析
- 时间序列分析
- 移动平均和指数平滑
- 季节性和周期性检测
- 异常值检测和处理
- 趋势预测和外推

### 模式识别
- 聚类分析（K-means, DBSCAN）
- 关联规则挖掘
- 序列模式挖掘
- 行为模式识别
- 学习风格分类

### 预测模型
- 回归分析
- 决策树和随机森林
- 贝叶斯网络
- 简单神经网络
- 集成学习方法

## 报告类型

### 学生个人报告
- **周报**：每周学习概况和短期趋势
- **月报**：月度学习表现和进步分析
- **学期报告**：学期综合评估和长期趋势
- **专题报告**：针对特定学科或知识点的深入分析

### 班级报告
- **班级概览**：整体表现和分布情况
- **对比分析**：与历史数据或其他班级的对比
- **知识点分析**：班级知识点掌握情况
- **学生分组**：基于表现和特征的学生分组

## 数据可视化

### 图表类型
- 折线图：趋势和时间序列数据
- 柱状图：分类数据对比
- 饼图和环形图：比例和构成
- 雷达图：多维能力评估
- 热力图：知识点掌握度
- 散点图：相关性和分布
- 箱线图：数据分布和异常值

### 交互功能
- 时间范围选择
- 数据筛选和过滤
- 钻取和详情查看
- 多维度切换
- 导出和分享

## 数据安全和隐私

- 数据匿名化处理
- 敏感信息保护
- 基于角色的数据访问控制
- 数据聚合和脱敏
- 合规的数据使用政策

## 集成点

- **数据服务**：获取原始学习数据
- **进度服务**：获取学习进度数据
- **用户服务**：获取用户信息和权限
- **资源服务**：关联学习资源使用数据
- **通知服务**：发送分析报告和洞察

## 常见问题

1. **分析结果不准确**
   - 检查数据源是否完整和准确
   - 确认分析参数和时间范围设置
   - 考虑增加数据样本量
   - 调整分析算法参数

2. **报告生成失败**
   - 检查所需数据是否完整
   - 确认报告参数是否正确
   - 查看服务日志获取详细错误

3. **可视化图表不显示**
   - 检查浏览器兼容性
   - 确认数据格式是否正确
   - 尝试调整图表参数和大小