const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Grade = require('./models/Grade');
const Homework = require('./models/Homework');
const ClassPerformance = require('./models/ClassPerformance');
const MistakeRecord = require('./models/MistakeRecord');
const config = require('./config');

const app = express();

// 中间件
app.use(cors());
app.use(express.json());

// 连接数据库
mongoose.connect(config.mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB连接成功'))
.catch(err => console.error('MongoDB连接失败:', err));

// 认证中间件
const authenticateToken = (req, res, next) => {
  // 从请求头获取用户信息（由API网关添加）
  if (!req.headers['x-user-id'] || !req.headers['x-user-role']) {
    return res.status(401).json({ message: '未认证' });
  }
  
  req.user = {
    id: req.headers['x-user-id'],
    role: req.headers['x-user-role']
  };
  
  next();
};

// 角色检查中间件
const checkRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: '未认证' });
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: '权限不足' });
    }
    
    next();
  };
};

// 导入路由
const routes = require('./routes');

// 使用路由
app.use('/api/data', routes);

// 健康检查
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'data-service' });
});

const PORT = process.env.PORT || 5002;
app.listen(PORT, () => {
  console.log(`数据服务运行在端口 ${PORT}`);
});