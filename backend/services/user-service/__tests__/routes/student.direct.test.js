const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// 增加超时时间
jest.setTimeout(60000);

// 设置测试环境
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';

// 导入模型和路由
const User = require('../../models/User');
const studentRouter = require('../../routes/student');

describe('学生管理API测试', () => {
  let app;
  let mongoServer;
  let adminToken;
  let teacherToken;
  let studentToken;
  let adminUser;
  let teacherUser;
  let studentUser;
  let studentId;

  beforeAll(async () => {
    // 创建内存数据库
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    // 创建Express应用
    app = express();
    app.use(express.json());

    // 添加一个简单的认证中间件
    app.use((req, res, next) => {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          req.user = decoded;
        } catch (error) {
          return res.status(403).json({ status: 'error', message: '无效的令牌' });
        }
      }
      next();
    });

    // 添加路由
    app.use('/api/students', studentRouter);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // 清理测试数据
    await User.deleteMany({});

    // 手动哈希密码
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('Test123!@#', salt);

    // 创建测试用户
    adminUser = await User.create({
      username: 'testadmin',
      password: hashedPassword,
      email: 'admin@example.com',
      role: 'admin',
      name: '测试管理员'
    });

    teacherUser = await User.create({
      username: 'testteacher',
      password: hashedPassword,
      email: 'teacher@example.com',
      role: 'teacher',
      name: '测试教师',
      teacherId: 'T12345',
      subjects: ['数学', '物理'],
      classesManaged: ['三年级2班', '三年级3班']
    });

    studentUser = await User.create({
      username: 'teststudent',
      password: hashedPassword,
      email: 'student@example.com',
      role: 'student',
      name: '测试学生',
      grade: '三年级',
      class: '2班',
      studentId: 'S12345'
    });

    // 创建一个测试学生用于测试
    const student = await User.create({
      username: 'teststudent2',
      password: hashedPassword,
      email: 'student2@example.com',
      role: 'student',
      name: '测试学生2',
      grade: '三年级',
      class: '2班',
      studentId: 'S12346'
    });

    studentId = student._id;

    // 生成令牌
    adminToken = jwt.sign(
      { id: adminUser._id, role: 'admin', username: 'testadmin' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    teacherToken = jwt.sign(
      { id: teacherUser._id, role: 'teacher', username: 'testteacher' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    studentToken = jwt.sign(
      { id: studentUser._id, role: 'student', username: 'teststudent' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  // 测试获取学生列表
  describe('GET /api/students', () => {
    it('应该返回学生列表', async () => {
      const response = await request(app)
        .get('/api/students')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('success');
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data.items)).toBe(true);
      expect(response.body.data.items.length).toBeGreaterThan(0);
    });

    it('应该支持按班级筛选学生', async () => {
      const response = await request(app)
        .get('/api/students?class=2班')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('success');
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data.items)).toBe(true);
      expect(response.body.data.items.length).toBeGreaterThan(0);

      // 验证所有返回的学生都是2班的
      response.body.data.items.forEach(student => {
        expect(student.class).toBe('2班');
      });
    });

    it('应该支持搜索功能', async () => {
      const response = await request(app)
        .get('/api/students?search=测试学生2')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('success');
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data.items)).toBe(true);

      // 验证搜索结果包含关键词
      if (response.body.data.items.length > 0) {
        const hasMatch = response.body.data.items.some(student =>
          student.name.includes('测试学生2')
        );
        expect(hasMatch).toBe(true);
      }
    });
  });

  // 测试获取单个学生
  describe('GET /api/students/:id', () => {
    it('应该返回学生详情', async () => {
      const response = await request(app)
        .get(`/api/students/${studentId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('success');
      expect(response.body.data).toBeDefined();
      expect(response.body.data.id.toString()).toBe(studentId.toString());
      expect(response.body.data.name).toBe('测试学生2');
    });

    it('当学生不存在时应该返回404', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/students/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.code).toBe(404);
      expect(response.body.message).toBe('学生不存在');
    });
  });
});
