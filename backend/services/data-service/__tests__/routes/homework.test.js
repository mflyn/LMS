const request = require('supertest');
const express = require('express');
const homeworkRoutes = require('../../routes/homework');
const Homework = require('../../models/Homework');
const mongoose = require('mongoose');

// 模拟依赖
jest.mock('../../models/Homework');
jest.mock('mongoose', () => {
  const mockModel = {
    find: jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue([
        { _id: 'student1' },
        { _id: 'student2' }
      ])
    })
  };
  
  return {
    model: jest.fn().mockReturnValue(mockModel)
  };
});

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});

describe('Homework Routes', () => {
  let app;

  beforeEach(() => {
    // 创建Express应用
    app = express();
    app.use(express.json());
    
    // 添加用户信息中间件
    app.use((req, res, next) => {
      if (req.headers['x-user-id'] && req.headers['x-user-role']) {
        req.user = {
          id: req.headers['x-user-id'],
          role: req.headers['x-user-role']
        };
      }
      next();
    });
    
    app.use('/api/homework', homeworkRoutes);

    // 重置所有模拟
    jest.clearAllMocks();
  });

  describe('GET /api/homework/student/:studentId', () => {
    it('应该返回学生的作业', async () => {
      // 准备请求头
      const headers = {
        'x-user-id': 'student123',
        'x-user-role': 'student'
      };

      // 模拟Homework.find
      const mockHomework = [
        { _id: 'homework1', title: '作业1', subject: { name: '数学' } },
        { _id: 'homework2', title: '作业2', subject: { name: '语文' } }
      ];
      
      Homework.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValue(mockHomework)
      });

      // 发送请求
      const response = await request(app)
        .get('/api/homework/student/student123')
        .set(headers)
        .expect(200);

      // 验证响应
      expect(response.body).toEqual({
        homework: mockHomework
      });

      // 验证方法调用
      expect(Homework.find).toHaveBeenCalledWith({ student: 'student123' });
    });

    it('应该处理权限不足的请求', async () => {
      // 准备请求头（学生尝试访问其他学生的作业）
      const headers = {
        'x-user-id': 'student1',
        'x-user-role': 'student'
      };

      // 发送请求
      const response = await request(app)
        .get('/api/homework/student/student2')
        .set(headers)
        .expect(403);

      // 验证响应
      expect(response.body).toEqual({
        message: '权限不足'
      });
    });

    it('应该处理获取作业时的错误', async () => {
      // 准备请求头
      const headers = {
        'x-user-id': 'student123',
        'x-user-role': 'student'
      };

      // 模拟Homework.find抛出错误
      const error = new Error('数据库错误');
      Homework.find = jest.fn().mockImplementation(() => {
        throw error;
      });

      // 发送请求
      const response = await request(app)
        .get('/api/homework/student/student123')
        .set(headers)
        .expect(500);

      // 验证响应
      expect(response.body).toEqual({
        message: '服务器错误'
      });
    });
  });

  describe('POST /api/homework', () => {
    it('应该成功布置作业', async () => {
      // 准备请求头
      const headers = {
        'x-user-id': 'teacher123',
        'x-user-role': 'teacher'
      };

      // 准备测试数据
      const homeworkData = {
        title: '数学作业',
        description: '完成课本第10页习题',
        subject: 'subject1',
        class: 'class1',
        dueDate: '2023-12-31',
        attachments: ['file1.pdf']
      };

      // 模拟Homework.insertMany
      Homework.insertMany = jest.fn().mockResolvedValue([
        { _id: 'homework1', student: 'student1' },
        { _id: 'homework2', student: 'student2' }
      ]);

      // 发送请求
      const response = await request(app)
        .post('/api/homework')
        .set(headers)
        .send(homeworkData)
        .expect(201);

      // 验证响应
      expect(response.body).toEqual({
        message: '成功为2名学生布置作业'
      });

      // 验证方法调用
      expect(mongoose.model).toHaveBeenCalledWith('User');
      expect(mongoose.model().find).toHaveBeenCalledWith({ class: 'class1', role: 'student' });
      expect(Homework.insertMany).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({
          title: homeworkData.title,
          description: homeworkData.description,
          subject: homeworkData.subject,
          class: homeworkData.class,
          student: 'student1',
          dueDate: homeworkData.dueDate,
          attachments: homeworkData.attachments,
          status: 'assigned',
          assignedBy: 'teacher123',
          assignedDate: expect.any(Number)
        }),
        expect.objectContaining({
          student: 'student2'
        })
      ]));
    });

    it('应该处理权限不足的请求', async () => {
      // 准备请求头（学生尝试布置作业）
      const headers = {
        'x-user-id': 'student1',
        'x-user-role': 'student'
      };

      // 准备测试数据
      const homeworkData = {
        title: '数学作业',
        description: '完成课本第10页习题',
        subject: 'subject1',
        class: 'class1',
        dueDate: '2023-12-31'
      };

      // 发送请求
      const response = await request(app)
        .post('/api/homework')
        .set(headers)
        .send(homeworkData)
        .expect(403);

      // 验证响应
      expect(response.body).toEqual({
        message: '权限不足'
      });
    });
  });

  describe('PUT /api/homework/:id/submit', () => {
    it('应该成功提交作业', async () => {
      // 准备请求头
      const headers = {
        'x-user-id': 'student123',
        'x-user-role': 'student'
      };

      // 准备测试数据
      const submitData = {
        content: '作业内容',
        attachments: ['answer.pdf']
      };

      // 模拟Homework.findById
      const mockHomework = {
        _id: 'homework123',
        student: 'student123',
        title: '数学作业',
        content: '',
        attachments: [],
        status: 'assigned',
        save: jest.fn().mockResolvedValue({
          _id: 'homework123',
          student: 'student123',
          title: '数学作业',
          content: '作业内容',
          attachments: ['answer.pdf'],
          status: 'submitted',
          submittedDate: expect.any(Number)
        })
      };
      
      Homework.findById = jest.fn().mockResolvedValue(mockHomework);

      // 发送请求
      const response = await request(app)
        .put('/api/homework/homework123/submit')
        .set(headers)
        .send(submitData)
        .expect(200);

      // 验证响应
      expect(response.body).toEqual({
        message: '作业提交成功',
        homework: expect.objectContaining({
          _id: 'homework123',
          content: '作业内容',
          attachments: ['answer.pdf'],
          status: 'submitted'
        })
      });

      // 验证方法调用
      expect(Homework.findById).toHaveBeenCalledWith('homework123');
      expect(mockHomework.save).toHaveBeenCalled();
    });

    it('应该处理作业不存在的情况', async () => {
      // 准备请求头
      const headers = {
        'x-user-id': 'student123',
        'x-user-role': 'student'
      };

      // 模拟Homework.findById返回null
      Homework.findById = jest.fn().mockResolvedValue(null);

      // 发送请求
      const response = await request(app)
        .put('/api/homework/nonexistent/submit')
        .set(headers)
        .send({ content: '作业内容' })
        .expect(404);

      // 验证响应
      expect(response.body).toEqual({
        message: '作业不存在'
      });
    });
  });
});
