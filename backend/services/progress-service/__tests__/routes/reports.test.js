const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const reportsRouter = require('../../routes/reports');
const Progress = require('../../models/Progress');

// 增加超时时间
jest.setTimeout(60000);

// 设置测试环境
process.env.NODE_ENV = 'test';

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

app.use('/api/reports', reportsRouter);

// 使用内存数据库进行测试
let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('报告路由测试', () => {
  beforeEach(async () => {
    await Progress.deleteMany({});
  });

  describe('GET /api/reports/class/:classId', () => {
    it('应该返回班级进度报告', async () => {
      const mockClassId = 'class123';
      const mockSubjectId = new mongoose.Types.ObjectId();
      const mockTeacherId = new mongoose.Types.ObjectId();
      const mockStudentId1 = new mongoose.Types.ObjectId();
      const mockStudentId2 = new mongoose.Types.ObjectId();

      // 创建测试数据
      await Progress.create([
        {
          student: mockStudentId1,
          subject: mockSubjectId,
          class: mockClassId,
          chapter: '第一章',
          section: '1.1',
          completionRate: 75,
          status: 'in_progress',
          createdBy: mockTeacherId,
          updatedBy: mockTeacherId
        },
        {
          student: mockStudentId2,
          subject: mockSubjectId,
          class: mockClassId,
          chapter: '第一章',
          section: '1.2',
          completionRate: 85,
          status: 'completed',
          createdBy: mockTeacherId,
          updatedBy: mockTeacherId
        }
      ]);

      // 模拟聚合函数
      const originalAggregate = Progress.aggregate;
      Progress.aggregate = jest.fn().mockResolvedValue([
        {
          _id: mockSubjectId,
          avgCompletionRate: 80,
          studentCount: 2,
          completedCount: 1
        }
      ]);

      // 发送请求
      const response = await request(app)
        .get(`/api/reports/class/${mockClassId}`)
        .set('x-user-id', mockTeacherId.toString())
        .set('x-user-role', 'teacher')
        .query({ subject: mockSubjectId.toString() });

      // 恢复原始函数
      Progress.aggregate = originalAggregate;

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('classId', mockClassId);
      expect(response.body).toHaveProperty('progressStats');
      expect(response.body.progressStats).toHaveLength(1);
      expect(response.body.progressStats[0]).toHaveProperty('avgCompletionRate', 80);
      expect(response.body.progressStats[0]).toHaveProperty('studentCount', 2);
      expect(response.body.progressStats[0]).toHaveProperty('completedCount', 1);
    });

    it('学生不应该能够查看班级报告', async () => {
      const mockClassId = 'class123';
      const mockStudentId = new mongoose.Types.ObjectId();

      // 发送请求
      const response = await request(app)
        .get(`/api/reports/class/${mockClassId}`)
        .set('x-user-id', mockStudentId.toString())
        .set('x-user-role', 'student');

      // 验证响应
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message', '权限不足');
    });
  });

  describe('GET /api/reports/comparison', () => {
    it('应该返回学生进度对比报告', async () => {
      const mockSubjectId = new mongoose.Types.ObjectId();
      const mockTeacherId = new mongoose.Types.ObjectId();
      const mockStudentId1 = new mongoose.Types.ObjectId();
      const mockStudentId2 = new mongoose.Types.ObjectId();

      // 创建测试数据
      await Progress.create([
        {
          student: mockStudentId1,
          subject: mockSubjectId,
          chapter: '第一章',
          section: '1.1',
          completionRate: 75,
          status: 'in_progress',
          createdBy: mockTeacherId,
          updatedBy: mockTeacherId
        },
        {
          student: mockStudentId2,
          subject: mockSubjectId,
          chapter: '第一章',
          section: '1.2',
          completionRate: 85,
          status: 'completed',
          createdBy: mockTeacherId,
          updatedBy: mockTeacherId
        }
      ]);

      // 模拟populate函数
      const originalFind = Progress.find;
      Progress.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValue([
          {
            _id: new mongoose.Types.ObjectId(),
            student: { _id: mockStudentId1, name: '学生1' },
            subject: { _id: mockSubjectId, name: '数学' },
            chapter: '第一章',
            section: '1.1',
            completionRate: 75,
            status: 'in_progress'
          },
          {
            _id: new mongoose.Types.ObjectId(),
            student: { _id: mockStudentId2, name: '学生2' },
            subject: { _id: mockSubjectId, name: '数学' },
            chapter: '第一章',
            section: '1.2',
            completionRate: 85,
            status: 'completed'
          }
        ])
      });

      // 发送请求
      const response = await request(app)
        .get('/api/reports/comparison')
        .set('x-user-id', mockTeacherId.toString())
        .set('x-user-role', 'teacher')
        .query({ 
          students: [mockStudentId1.toString(), mockStudentId2.toString()],
          subject: mockSubjectId.toString()
        });

      // 恢复原始函数
      Progress.find = originalFind;

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('progressData');
      expect(response.body.progressData).toHaveLength(2);
      expect(response.body.progressData[0].student.name).toBe('学生1');
      expect(response.body.progressData[1].student.name).toBe('学生2');
      expect(response.body.progressData[0].completionRate).toBe(75);
      expect(response.body.progressData[1].completionRate).toBe(85);
    });

    it('应该验证学生ID列表', async () => {
      const mockTeacherId = new mongoose.Types.ObjectId();

      // 发送请求（没有提供学生ID列表）
      const response = await request(app)
        .get('/api/reports/comparison')
        .set('x-user-id', mockTeacherId.toString())
        .set('x-user-role', 'teacher');

      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '请提供有效的学生ID列表');
    });

    it('学生不应该能够查看进度对比报告', async () => {
      const mockStudentId = new mongoose.Types.ObjectId();
      const mockStudentId1 = new mongoose.Types.ObjectId();
      const mockStudentId2 = new mongoose.Types.ObjectId();

      // 发送请求
      const response = await request(app)
        .get('/api/reports/comparison')
        .set('x-user-id', mockStudentId.toString())
        .set('x-user-role', 'student')
        .query({ 
          students: [mockStudentId1.toString(), mockStudentId2.toString()]
        });

      // 验证响应
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message', '权限不足');
    });
  });
});
