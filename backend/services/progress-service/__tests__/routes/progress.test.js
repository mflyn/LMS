const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const progressRouter = require('../../routes/progress');
const Progress = require('../../models/Progress');

// 创建测试应用
const app = express();
app.use(express.json());

// 模拟认证中间件
app.use((req, res, next) => {
  // 模拟用户信息
  req.user = {
    id: req.headers['x-user-id'] || '000000000000000000000001',
    role: req.headers['x-user-role'] || 'teacher'
  };
  next();
});

app.use('/api/progress', progressRouter);

// 使用内存数据库进行测试
beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/test-db', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe('进度路由测试', () => {
  beforeEach(async () => {
    await Progress.deleteMany({});
  });

  describe('GET /api/progress/:studentId', () => {
    it('应该返回学生进度', async () => {
      const mockStudentId = new mongoose.Types.ObjectId();
      const mockSubjectId = new mongoose.Types.ObjectId();
      const mockTeacherId = new mongoose.Types.ObjectId();
      
      // 创建测试数据
      await Progress.create({
        student: mockStudentId,
        subject: mockSubjectId,
        chapter: '第一章',
        section: '1.1',
        completionRate: 75,
        status: 'in_progress',
        createdBy: mockTeacherId,
        updatedBy: mockTeacherId
      });
      
      // 发送请求
      const response = await request(app)
        .get(`/api/progress/${mockStudentId}`)
        .set('x-user-id', mockTeacherId.toString())
        .set('x-user-role', 'teacher');
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('progress');
      expect(response.body.progress.length).toBe(1);
      expect(response.body.progress[0].chapter).toBe('第一章');
    });
    
    it('学生不应该能够查看其他学生的进度', async () => {
      const mockStudentId1 = new mongoose.Types.ObjectId();
      const mockStudentId2 = new mongoose.Types.ObjectId();
      const mockSubjectId = new mongoose.Types.ObjectId();
      const mockTeacherId = new mongoose.Types.ObjectId();
      
      // 创建测试数据
      await Progress.create({
        student: mockStudentId1,
        subject: mockSubjectId,
        chapter: '第一章',
        section: '1.1',
        completionRate: 75,
        status: 'in_progress',
        createdBy: mockTeacherId,
        updatedBy: mockTeacherId
      });
      
      // 发送请求 - 学生2尝试查看学生1的进度
      const response = await request(app)
        .get(`/api/progress/${mockStudentId1}`)
        .set('x-user-id', mockStudentId2.toString())
        .set('x-user-role', 'student');
      
      // 验证响应
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message', '权限不足');
    });
    
    it('学生应该能够查看自己的进度', async () => {
      const mockStudentId = new mongoose.Types.ObjectId();
      const mockSubjectId = new mongoose.Types.ObjectId();
      const mockTeacherId = new mongoose.Types.ObjectId();
      
      // 创建测试数据
      await Progress.create({
        student: mockStudentId,
        subject: mockSubjectId,
        chapter: '第一章',
        section: '1.1',
        completionRate: 75,
        status: 'in_progress',
        createdBy: mockTeacherId,
        updatedBy: mockTeacherId
      });
      
      // 发送请求
      const response = await request(app)
        .get(`/api/progress/${mockStudentId}`)
        .set('x-user-id', mockStudentId.toString())
        .set('x-user-role', 'student');
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('progress');
      expect(response.body.progress.length).toBe(1);
    });
  });
  
  describe('POST /api/progress/update', () => {
    it('教师应该能够更新学生进度', async () => {
      const mockStudentId = new mongoose.Types.ObjectId();
      const mockSubjectId = new mongoose.Types.ObjectId();
      const mockTeacherId = new mongoose.Types.ObjectId();
      
      // 发送请求
      const response = await request(app)
        .post('/api/progress/update')
        .set('x-user-id', mockTeacherId.toString())
        .set('x-user-role', 'teacher')
        .send({
          student: mockStudentId,
          subject: mockSubjectId,
          chapter: '第一章',
          section: '1.1',
          completionRate: 75,
          status: 'in_progress',
          comments: '进展良好'
        });
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '学习进度已更新');
      expect(response.body).toHaveProperty('progress');
      expect(response.body.progress.chapter).toBe('第一章');
      expect(response.body.progress.completionRate).toBe(75);
      
      // 验证数据库中的记录
      const progress = await Progress.findOne({ student: mockStudentId });
      expect(progress).toBeDefined();
      expect(progress.chapter).toBe('第一章');
      expect(progress.completionRate).toBe(75);
    });
    
    it('应该能够更新现有的进度记录', async () => {
      const mockStudentId = new mongoose.Types.ObjectId();
      const mockSubjectId = new mongoose.Types.ObjectId();
      const mockTeacherId = new mongoose.Types.ObjectId();
      
      // 创建测试数据
      await Progress.create({
        student: mockStudentId,
        subject: mockSubjectId,
        chapter: '第一章',
        section: '1.1',
        completionRate: 75,
        status: 'in_progress',
        createdBy: mockTeacherId,
        updatedBy: mockTeacherId
      });
      
      // 发送请求
      const response = await request(app)
        .post('/api/progress/update')
        .set('x-user-id', mockTeacherId.toString())
        .set('x-user-role', 'teacher')
        .send({
          student: mockStudentId,
          subject: mockSubjectId,
          chapter: '第一章',
          section: '1.2',
          completionRate: 85,
          status: 'in_progress',
          comments: '进展更好了'
        });
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '学习进度已更新');
      expect(response.body).toHaveProperty('progress');
      expect(response.body.progress.section).toBe('1.2');
      expect(response.body.progress.completionRate).toBe(85);
      
      // 验证数据库中的记录
      const progress = await Progress.findOne({ student: mockStudentId });
      expect(progress).toBeDefined();
      expect(progress.section).toBe('1.2');
      expect(progress.completionRate).toBe(85);
    });
    
    it('学生不应该能够更新进度', async () => {
      const mockStudentId = new mongoose.Types.ObjectId();
      const mockSubjectId = new mongoose.Types.ObjectId();
      
      // 发送请求
      const response = await request(app)
        .post('/api/progress/update')
        .set('x-user-id', mockStudentId.toString())
        .set('x-user-role', 'student')
        .send({
          student: mockStudentId,
          subject: mockSubjectId,
          chapter: '第一章',
          section: '1.1',
          completionRate: 75,
          status: 'in_progress'
        });
      
      // 验证响应
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message', '权限不足');
      
      // 验证数据库中没有记录
      const progress = await Progress.findOne({ student: mockStudentId });
      expect(progress).toBeNull();
    });
  });
});
