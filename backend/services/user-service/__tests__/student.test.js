const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../server');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const config = require('../config');

let mongoServer;

// 模拟认证中间件
jest.mock('../middleware/auth', () => {
  return {
    authenticateToken: (req, res, next) => {
      req.user = {
        id: '5f7d7e9c8f3d4e001c123456',
        role: 'admin'
      };
      next();
    },
    checkRole: (roles) => (req, res, next) => next()
  };
});

beforeAll(async () => {
  // 创建内存MongoDB实例
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
});

beforeEach(async () => {
  // 清空数据库
  await User.deleteMany({});
  
  // 创建测试数据
  await User.create([
    {
      name: '张三',
      username: 'student1',
      password: 'password123',
      email: 'student1@example.com',
      role: 'student',
      grade: '三年级',
      class: '1班',
      studentId: '20230001'
    },
    {
      name: '李四',
      username: 'student2',
      password: 'password123',
      email: 'student2@example.com',
      role: 'student',
      grade: '三年级',
      class: '2班',
      studentId: '20230002'
    },
    {
      name: '王五',
      username: 'teacher1',
      password: 'password123',
      email: 'teacher1@example.com',
      role: 'teacher'
    }
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('学生管理API测试', () => {
  // 生成测试用的JWT令牌
  const generateToken = (user) => {
    return jwt.sign(
      { id: user._id, role: user.role },
      config.jwtSecret,
      { expiresIn: '1h' }
    );
  };
  
  describe('GET /api/students', () => {
    it('应该返回学生列表', async () => {
      // 获取教师用户
      const teacher = await User.findOne({ role: 'teacher' });
      const token = generateToken(teacher);
      
      const response = await request(app)
        .get('/api/students')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('success');
      expect(response.body.data.items).toHaveLength(2);
      expect(response.body.data.total).toBe(2);
    });
    
    it('应该支持按班级筛选学生', async () => {
      // 获取教师用户
      const teacher = await User.findOne({ role: 'teacher' });
      const token = generateToken(teacher);
      
      const response = await request(app)
        .get('/api/students?class=1班')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.code).toBe(200);
      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.items[0].name).toBe('张三');
    });
    
    it('应该支持搜索功能', async () => {
      // 获取教师用户
      const teacher = await User.findOne({ role: 'teacher' });
      const token = generateToken(teacher);
      
      const response = await request(app)
        .get('/api/students?search=李四')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.code).toBe(200);
      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.items[0].name).toBe('李四');
    });
  });
  
  describe('GET /api/students/:id', () => {
    it('应该返回学生详情', async () => {
      // 获取教师用户和学生用户
      const teacher = await User.findOne({ role: 'teacher' });
      const student = await User.findOne({ role: 'student', name: '张三' });
      const token = generateToken(teacher);
      
      const response = await request(app)
        .get(`/api/students/${student._id}`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('success');
      expect(response.body.data.name).toBe('张三');
      expect(response.body.data.class).toBe('1班');
      expect(response.body.data.grade).toBe('三年级');
    });
    
    it('当学生不存在时应该返回404', async () => {
      // 获取教师用户
      const teacher = await User.findOne({ role: 'teacher' });
      const token = generateToken(teacher);
      
      const response = await request(app)
        .get('/api/students/5f7d7e9c8f3d4e001c123456')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(404);
      expect(response.body.code).toBe(404);
      expect(response.body.message).toBe('学生不存在');
    });
  });
});