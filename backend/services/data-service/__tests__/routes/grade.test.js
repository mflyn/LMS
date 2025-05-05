const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const gradeRouter = require('../../routes/grade');
const Grade = require('../../models/Grade');

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

app.use('/api/data/grades', gradeRouter);

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

describe('成绩路由测试', () => {
  beforeEach(async () => {
    await Grade.deleteMany({});
  });

  describe('GET /api/data/grades/student/:studentId', () => {
    it('应该返回学生成绩', async () => {
      const mockStudentId = new mongoose.Types.ObjectId();
      const mockSubjectId = new mongoose.Types.ObjectId();
      const mockClassId = new mongoose.Types.ObjectId();
      const mockTeacherId = new mongoose.Types.ObjectId();
      
      // 创建测试数据
      await Grade.create({
        student: mockStudentId,
        subject: mockSubjectId,
        class: mockClassId,
        type: 'exam',
        score: 85,
        totalScore: 100,
        date: new Date(),
        recordedBy: mockTeacherId
      });
      
      // 发送请求
      const response = await request(app)
        .get(`/api/data/grades/student/${mockStudentId}`)
        .set('x-user-id', mockStudentId.toString())
        .set('x-user-role', 'student');
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('grades');
      expect(response.body.grades.length).toBe(1);
      expect(response.body.grades[0].score).toBe(85);
    });
    
    it('学生不应该能够查看其他学生的成绩', async () => {
      const mockStudentId1 = new mongoose.Types.ObjectId();
      const mockStudentId2 = new mongoose.Types.ObjectId();
      const mockSubjectId = new mongoose.Types.ObjectId();
      const mockClassId = new mongoose.Types.ObjectId();
      const mockTeacherId = new mongoose.Types.ObjectId();
      
      // 创建测试数据
      await Grade.create({
        student: mockStudentId1,
        subject: mockSubjectId,
        class: mockClassId,
        type: 'exam',
        score: 85,
        totalScore: 100,
        date: new Date(),
        recordedBy: mockTeacherId
      });
      
      // 发送请求 - 学生2尝试查看学生1的成绩
      const response = await request(app)
        .get(`/api/data/grades/student/${mockStudentId1}`)
        .set('x-user-id', mockStudentId2.toString())
        .set('x-user-role', 'student');
      
      // 验证响应
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message', '权限不足');
    });
    
    it('教师应该能够查看任何学生的成绩', async () => {
      const mockStudentId = new mongoose.Types.ObjectId();
      const mockSubjectId = new mongoose.Types.ObjectId();
      const mockClassId = new mongoose.Types.ObjectId();
      const mockTeacherId = new mongoose.Types.ObjectId();
      
      // 创建测试数据
      await Grade.create({
        student: mockStudentId,
        subject: mockSubjectId,
        class: mockClassId,
        type: 'exam',
        score: 85,
        totalScore: 100,
        date: new Date(),
        recordedBy: mockTeacherId
      });
      
      // 发送请求
      const response = await request(app)
        .get(`/api/data/grades/student/${mockStudentId}`)
        .set('x-user-id', mockTeacherId.toString())
        .set('x-user-role', 'teacher');
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('grades');
      expect(response.body.grades.length).toBe(1);
    });
  });
  
  describe('GET /api/data/grades/class/:classId', () => {
    it('教师应该能够查看班级成绩', async () => {
      const mockStudentId = new mongoose.Types.ObjectId();
      const mockSubjectId = new mongoose.Types.ObjectId();
      const mockClassId = new mongoose.Types.ObjectId();
      const mockTeacherId = new mongoose.Types.ObjectId();
      
      // 创建测试数据
      await Grade.create({
        student: mockStudentId,
        subject: mockSubjectId,
        class: mockClassId,
        type: 'exam',
        score: 85,
        totalScore: 100,
        date: new Date(),
        recordedBy: mockTeacherId
      });
      
      // 发送请求
      const response = await request(app)
        .get(`/api/data/grades/class/${mockClassId}`)
        .set('x-user-id', mockTeacherId.toString())
        .set('x-user-role', 'teacher');
      
      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('grades');
      expect(response.body.grades.length).toBe(1);
    });
    
    it('学生不应该能够查看班级成绩', async () => {
      const mockStudentId = new mongoose.Types.ObjectId();
      const mockClassId = new mongoose.Types.ObjectId();
      
      // 发送请求
      const response = await request(app)
        .get(`/api/data/grades/class/${mockClassId}`)
        .set('x-user-id', mockStudentId.toString())
        .set('x-user-role', 'student');
      
      // 验证响应
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message', '权限不足');
    });
  });
  
  describe('POST /api/data/grades', () => {
    it('教师应该能够录入成绩', async () => {
      const mockStudentId = new mongoose.Types.ObjectId();
      const mockSubjectId = new mongoose.Types.ObjectId();
      const mockClassId = new mongoose.Types.ObjectId();
      const mockTeacherId = new mongoose.Types.ObjectId();
      
      // 发送请求
      const response = await request(app)
        .post('/api/data/grades')
        .set('x-user-id', mockTeacherId.toString())
        .set('x-user-role', 'teacher')
        .send({
          student: mockStudentId,
          subject: mockSubjectId,
          class: mockClassId,
          type: 'exam',
          score: 85,
          totalScore: 100,
          comments: '表现良好'
        });
      
      // 验证响应
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', '成绩录入成功');
      expect(response.body).toHaveProperty('grade');
      expect(response.body.grade.score).toBe(85);
      expect(response.body.grade.recordedBy).toBe(mockTeacherId.toString());
      
      // 验证数据库中的记录
      const grades = await Grade.find();
      expect(grades.length).toBe(1);
      expect(grades[0].score).toBe(85);
    });
    
    it('学生不应该能够录入成绩', async () => {
      const mockStudentId = new mongoose.Types.ObjectId();
      const mockSubjectId = new mongoose.Types.ObjectId();
      const mockClassId = new mongoose.Types.ObjectId();
      
      // 发送请求
      const response = await request(app)
        .post('/api/data/grades')
        .set('x-user-id', mockStudentId.toString())
        .set('x-user-role', 'student')
        .send({
          student: mockStudentId,
          subject: mockSubjectId,
          class: mockClassId,
          type: 'exam',
          score: 85,
          totalScore: 100
        });
      
      // 验证响应
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message', '权限不足');
      
      // 验证数据库中没有记录
      const grades = await Grade.find();
      expect(grades.length).toBe(0);
    });
  });
  
  describe('POST /api/data/grades/batch', () => {
    it('教师应该能够批量录入成绩', async () => {
      const mockStudentId1 = new mongoose.Types.ObjectId();
      const mockStudentId2 = new mongoose.Types.ObjectId();
      const mockSubjectId = new mongoose.Types.ObjectId();
      const mockClassId = new mongoose.Types.ObjectId();
      const mockTeacherId = new mongoose.Types.ObjectId();
      
      // 发送请求
      const response = await request(app)
        .post('/api/data/grades/batch')
        .set('x-user-id', mockTeacherId.toString())
        .set('x-user-role', 'teacher')
        .send({
          grades: [
            {
              student: mockStudentId1,
              subject: mockSubjectId,
              class: mockClassId,
              type: 'exam',
              score: 85,
              totalScore: 100
            },
            {
              student: mockStudentId2,
              subject: mockSubjectId,
              class: mockClassId,
              type: 'exam',
              score: 90,
              totalScore: 100
            }
          ]
        });
      
      // 验证响应
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', '成功录入2条成绩记录');
      
      // 验证数据库中的记录
      const grades = await Grade.find();
      expect(grades.length).toBe(2);
      expect(grades.some(g => g.score === 85)).toBe(true);
      expect(grades.some(g => g.score === 90)).toBe(true);
    });
    
    it('应该验证批量录入的数据格式', async () => {
      const mockTeacherId = new mongoose.Types.ObjectId();
      
      // 发送请求 - 空数组
      const response = await request(app)
        .post('/api/data/grades/batch')
        .set('x-user-id', mockTeacherId.toString())
        .set('x-user-role', 'teacher')
        .send({
          grades: []
        });
      
      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '无效的数据格式');
      
      // 验证数据库中没有记录
      const grades = await Grade.find();
      expect(grades.length).toBe(0);
    });
  });
});
