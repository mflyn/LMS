/**
 * 会议路由单元测试
 */

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const Meeting = require('../../models/Meeting');

// 模拟Meeting模型
jest.mock('../../models/Meeting');

describe('会议路由单元测试', () => {
  let app;
  let router;

  beforeEach(() => {
    // 重置所有模拟
    jest.clearAllMocks();

    // 创建Express应用
    app = express();
    app.use(express.json());

    // 模拟认证中间件
    app.use((req, res, next) => {
      req.user = { id: 'test-user-id', name: 'Test User', role: 'teacher' };
      next();
    });

    // 导入路由
    router = require('../../routes/meetings');
    app.use('/api/interaction/meetings', router);

    // 设置模拟返回值
    const mockMeetings = [
      {
        _id: 'meeting-id-1',
        title: '会议1',
        description: '会议描述1',
        startTime: new Date('2023-01-01T10:00:00Z'),
        endTime: new Date('2023-01-01T11:00:00Z'),
        organizer: { _id: 'user1', name: '教师1', role: 'teacher' },
        participants: [
          { _id: 'user2', name: '学生1', role: 'student' },
          { _id: 'user3', name: '学生2', role: 'student' }
        ],
        class: { _id: 'class1', name: '一年级一班', grade: '一年级' },
        status: 'scheduled',
        createdAt: new Date('2022-12-30')
      },
      {
        _id: 'meeting-id-2',
        title: '会议2',
        description: '会议描述2',
        startTime: new Date('2023-01-02T10:00:00Z'),
        endTime: new Date('2023-01-02T11:00:00Z'),
        organizer: { _id: 'user1', name: '教师1', role: 'teacher' },
        participants: [
          { _id: 'user2', name: '学生1', role: 'student' },
          { _id: 'user3', name: '学生2', role: 'student' }
        ],
        class: { _id: 'class1', name: '一年级一班', grade: '一年级' },
        status: 'scheduled',
        createdAt: new Date('2022-12-31')
      }
    ];

    // 设置模拟方法
    Meeting.find.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(mockMeetings)
    });

    Meeting.countDocuments.mockResolvedValue(2);

    Meeting.findById.mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(mockMeetings[0])
    });

    Meeting.findByIdAndUpdate.mockResolvedValue(mockMeetings[0]);
    Meeting.findByIdAndDelete.mockResolvedValue(mockMeetings[0]);

    // 模拟Meeting构造函数
    Meeting.mockImplementation(() => ({
      save: jest.fn().mockResolvedValue({
        _id: 'new-meeting-id',
        title: '新会议',
        description: '新会议描述',
        startTime: new Date('2023-01-03T10:00:00Z'),
        endTime: new Date('2023-01-03T11:00:00Z'),
        organizer: 'test-user-id',
        participants: [],
        class: 'class1',
        status: 'scheduled',
        createdAt: new Date()
      })
    }));
  });

  describe('GET /api/interaction/meetings', () => {
    it('应该返回会议列表', async () => {
      // 发送请求
      const response = await request(app)
        .get('/api/interaction/meetings');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('meetings');
      expect(response.body.meetings).toHaveLength(2);
      expect(response.body).toHaveProperty('total', 2);
      expect(response.body).toHaveProperty('page', 1);
      expect(response.body).toHaveProperty('limit', 10);
      expect(response.body).toHaveProperty('totalPages', 1);
    });

    it('应该处理分页参数', async () => {
      // 发送请求
      const response = await request(app)
        .get('/api/interaction/meetings')
        .query({ page: 2, limit: 5 });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('page', 2);
      expect(response.body).toHaveProperty('limit', 5);

      // 验证Meeting.find被调用
      expect(Meeting.find).toHaveBeenCalled();
      expect(Meeting.find().skip).toHaveBeenCalledWith(5);
      expect(Meeting.find().limit).toHaveBeenCalledWith(5);
    });

    it('应该处理日期过滤', async () => {
      // 发送请求
      const response = await request(app)
        .get('/api/interaction/meetings')
        .query({
          startDate: '2023-01-01',
          endDate: '2023-01-31'
        });

      // 验证响应
      expect(response.status).toBe(200);

      // 验证Meeting.find被调用
      expect(Meeting.find).toHaveBeenCalled();
    });

    it('应该处理无效的日期格式', async () => {
      // 发送请求
      const response = await request(app)
        .get('/api/interaction/meetings')
        .query({
          startDate: 'invalid-date',
          endDate: 'invalid-date'
        });

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取会议列表失败');
    });

    it('应该处理数据库查询错误', async () => {
      // 模拟数据库查询错误
      Meeting.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(new Error('数据库查询错误'))
      });

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/meetings');

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取会议列表失败');
      expect(response.body).toHaveProperty('error', '数据库查询错误');
    });
  });

  describe('GET /api/interaction/meetings/:id', () => {
    it('应该返回单个会议', async () => {
      // 模拟mongoose.Types.ObjectId.isValid
      mongoose.Types.ObjectId = { isValid: jest.fn().mockReturnValue(true) };

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/meetings/meeting-id-1');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('_id', 'meeting-id-1');
      expect(response.body).toHaveProperty('title', '会议1');

      // 验证Meeting.findById被调用
      expect(Meeting.findById).toHaveBeenCalledWith('meeting-id-1');
    });

    it('应该处理无效的ID格式', async () => {
      // 模拟mongoose.Types.ObjectId.isValid
      mongoose.Types.ObjectId = { isValid: jest.fn().mockReturnValue(false) };

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/meetings/invalid-id');

      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '无效的会议ID');
    });

    it('应该处理会议不存在的情况', async () => {
      // 模拟mongoose.Types.ObjectId.isValid
      mongoose.Types.ObjectId = { isValid: jest.fn().mockReturnValue(true) };

      // 模拟Meeting.findById的返回值
      Meeting.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null)
      });

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/meetings/non-existent-id');

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议不存在');
    });

    it('应该处理数据库查询错误', async () => {
      // 模拟mongoose.Types.ObjectId.isValid
      mongoose.Types.ObjectId = { isValid: jest.fn().mockReturnValue(true) };

      // 模拟数据库查询错误
      Meeting.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(new Error('数据库查询错误'))
      });

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/meetings/meeting-id-1');

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取会议失败');
      expect(response.body).toHaveProperty('error', '数据库查询错误');
    });
  });

  describe('POST /api/interaction/meetings', () => {
    it('应该创建新会议', async () => {
      // 发送请求
      const response = await request(app)
        .post('/api/interaction/meetings')
        .send({
          title: '新会议',
          description: '新会议描述',
          startTime: '2023-01-03T10:00:00Z',
          endTime: '2023-01-03T11:00:00Z',
          class: 'class1',
          participants: ['user2', 'user3']
        });

      // 验证响应
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('_id', 'new-meeting-id');
      expect(response.body).toHaveProperty('title', '新会议');
      expect(response.body).toHaveProperty('organizer', 'test-user-id');

      // 验证Meeting构造函数被调用
      expect(Meeting).toHaveBeenCalledWith({
        title: '新会议',
        description: '新会议描述',
        startTime: expect.any(Date),
        endTime: expect.any(Date),
        organizer: 'test-user-id',
        class: 'class1',
        participants: ['user2', 'user3'],
        status: 'scheduled'
      });
    });

    it('应该验证必要参数', async () => {
      // 发送请求（不包含title）
      const response1 = await request(app)
        .post('/api/interaction/meetings')
        .send({
          description: '新会议描述',
          startTime: '2023-01-03T10:00:00Z',
          endTime: '2023-01-03T11:00:00Z',
          class: 'class1'
        });

      // 验证响应
      expect(response1.status).toBe(400);
      expect(response1.body).toHaveProperty('message', '标题、开始时间、结束时间和班级不能为空');

      // 发送请求（不包含startTime）
      const response2 = await request(app)
        .post('/api/interaction/meetings')
        .send({
          title: '新会议',
          description: '新会议描述',
          endTime: '2023-01-03T11:00:00Z',
          class: 'class1'
        });

      // 验证响应
      expect(response2.status).toBe(400);
      expect(response2.body).toHaveProperty('message', '标题、开始时间、结束时间和班级不能为空');
    });

    it('应该验证时间顺序', async () => {
      // 发送请求（结束时间早于开始时间）
      const response = await request(app)
        .post('/api/interaction/meetings')
        .send({
          title: '新会议',
          description: '新会议描述',
          startTime: '2023-01-03T11:00:00Z',
          endTime: '2023-01-03T10:00:00Z', // 早于开始时间
          class: 'class1'
        });

      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '结束时间必须晚于开始时间');
    });

    it('应该处理保存错误', async () => {
      // 模拟保存错误
      Meeting.mockImplementation(() => ({
        save: jest.fn().mockRejectedValue(new Error('保存错误'))
      }));

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/meetings')
        .send({
          title: '新会议',
          description: '新会议描述',
          startTime: '2023-01-03T10:00:00Z',
          endTime: '2023-01-03T11:00:00Z',
          class: 'class1'
        });

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '创建会议失败');
      expect(response.body).toHaveProperty('error', '保存错误');
    });
  });

  describe('PUT /api/interaction/meetings/:id', () => {
    it('应该更新会议', async () => {
      // 模拟mongoose.Types.ObjectId.isValid
      mongoose.Types.ObjectId = { isValid: jest.fn().mockReturnValue(true) };

      // 发送请求
      const response = await request(app)
        .put('/api/interaction/meetings/meeting-id-1')
        .send({
          title: '更新的会议',
          description: '更新的会议描述',
          startTime: '2023-01-03T10:00:00Z',
          endTime: '2023-01-03T11:00:00Z',
          status: 'completed'
        });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('_id', 'meeting-id-1');

      // 验证Meeting.findByIdAndUpdate被调用
      expect(Meeting.findByIdAndUpdate).toHaveBeenCalledWith(
        'meeting-id-1',
        {
          title: '更新的会议',
          description: '更新的会议描述',
          startTime: expect.any(Date),
          endTime: expect.any(Date),
          status: 'completed'
        },
        { new: true }
      );
    });

    it('应该处理无效的ID格式', async () => {
      // 模拟mongoose.Types.ObjectId.isValid
      mongoose.Types.ObjectId = { isValid: jest.fn().mockReturnValue(false) };

      // 发送请求
      const response = await request(app)
        .put('/api/interaction/meetings/invalid-id')
        .send({
          title: '更新的会议'
        });

      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '无效的会议ID');
    });

    it('应该验证时间顺序', async () => {
      // 模拟mongoose.Types.ObjectId.isValid
      mongoose.Types.ObjectId = { isValid: jest.fn().mockReturnValue(true) };

      // 发送请求（结束时间早于开始时间）
      const response = await request(app)
        .put('/api/interaction/meetings/meeting-id-1')
        .send({
          startTime: '2023-01-03T11:00:00Z',
          endTime: '2023-01-03T10:00:00Z' // 早于开始时间
        });

      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '结束时间必须晚于开始时间');
    });

    it('应该处理会议不存在的情况', async () => {
      // 模拟mongoose.Types.ObjectId.isValid
      mongoose.Types.ObjectId = { isValid: jest.fn().mockReturnValue(true) };

      // 模拟Meeting.findByIdAndUpdate的返回值
      Meeting.findByIdAndUpdate.mockResolvedValue(null);

      // 发送请求
      const response = await request(app)
        .put('/api/interaction/meetings/non-existent-id')
        .send({
          title: '更新的会议'
        });

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议不存在');
    });

    it('应该处理更新错误', async () => {
      // 模拟mongoose.Types.ObjectId.isValid
      mongoose.Types.ObjectId = { isValid: jest.fn().mockReturnValue(true) };

      // 模拟更新错误
      Meeting.findByIdAndUpdate.mockRejectedValue(new Error('更新错误'));

      // 发送请求
      const response = await request(app)
        .put('/api/interaction/meetings/meeting-id-1')
        .send({
          title: '更新的会议'
        });

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '更新会议失败');
      expect(response.body).toHaveProperty('error', '更新错误');
    });
  });

  describe('DELETE /api/interaction/meetings/:id', () => {
    it('应该删除会议', async () => {
      // 模拟mongoose.Types.ObjectId.isValid
      mongoose.Types.ObjectId = { isValid: jest.fn().mockReturnValue(true) };

      // 发送请求
      const response = await request(app)
        .delete('/api/interaction/meetings/meeting-id-1');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '会议已删除');

      // 验证Meeting.findByIdAndDelete被调用
      expect(Meeting.findByIdAndDelete).toHaveBeenCalledWith('meeting-id-1');
    });

    it('应该处理无效的ID格式', async () => {
      // 模拟mongoose.Types.ObjectId.isValid
      mongoose.Types.ObjectId = { isValid: jest.fn().mockReturnValue(false) };

      // 发送请求
      const response = await request(app)
        .delete('/api/interaction/meetings/invalid-id');

      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '无效的会议ID');
    });

    it('应该处理会议不存在的情况', async () => {
      // 模拟mongoose.Types.ObjectId.isValid
      mongoose.Types.ObjectId = { isValid: jest.fn().mockReturnValue(true) };

      // 模拟Meeting.findByIdAndDelete的返回值
      Meeting.findByIdAndDelete.mockResolvedValue(null);

      // 发送请求
      const response = await request(app)
        .delete('/api/interaction/meetings/non-existent-id');

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议不存在');
    });

    it('应该处理删除错误', async () => {
      // 模拟mongoose.Types.ObjectId.isValid
      mongoose.Types.ObjectId = { isValid: jest.fn().mockReturnValue(true) };

      // 模拟删除错误
      Meeting.findByIdAndDelete.mockRejectedValue(new Error('删除错误'));

      // 发送请求
      const response = await request(app)
        .delete('/api/interaction/meetings/meeting-id-1');

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '删除会议失败');
      expect(response.body).toHaveProperty('error', '删除错误');
    });
  });

  describe('GET /api/interaction/meetings/stats', () => {
    it('应该返回会议统计信息', async () => {
      // 模拟聚合结果
      const mockStats = [
        { _id: 'scheduled', count: 5 },
        { _id: 'completed', count: 3 },
        { _id: 'cancelled', count: 1 }
      ];

      // 模拟Meeting.aggregate
      Meeting.aggregate = jest.fn().mockResolvedValue(mockStats);

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/meetings/stats');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockStats);

      // 验证Meeting.aggregate被调用
      expect(Meeting.aggregate).toHaveBeenCalled();
    });

    it('应该处理聚合错误', async () => {
      // 模拟聚合错误
      Meeting.aggregate = jest.fn().mockRejectedValue(new Error('聚合错误'));

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/meetings/stats');

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取会议统计信息失败');
      expect(response.body).toHaveProperty('error', '聚合错误');
    });
  });

  describe('GET /api/interaction/meetings/history/:userId', () => {
    it('应该返回用户的会议历史', async () => {
      // 模拟数据
      const mockMeetings = [
        {
          _id: 'meeting-id-1',
          title: '历史会议1',
          description: '描述1',
          startTime: new Date(),
          endTime: new Date(),
          status: 'completed',
          participants: [{ user: 'user-id-1', role: 'student' }],
          organizer: 'teacher-id-1'
        }
      ];

      // 设置模拟函数的返回值
      const mockPopulate = jest.fn().mockReturnValue(mockMeetings);
      const mockSort = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: mockPopulate
        })
      });

      // 保存原始的Meeting.find
      const originalFind = Meeting.find;

      // 临时替换Meeting.find
      Meeting.find = jest.fn().mockReturnValue({
        sort: mockSort
      });

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/meetings/history/user-id-1');

      // 验证响应
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      // 验证Meeting.find被调用
      expect(Meeting.find).toHaveBeenCalled();

      // 恢复原始的Meeting.find
      Meeting.find = originalFind;
    });

    it('应该处理查询错误', async () => {
      // 保存原始的Meeting.find
      const originalFind = Meeting.find;

      // 临时替换Meeting.find
      Meeting.find = jest.fn().mockImplementation(() => {
        throw new Error('查询错误');
      });

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/meetings/history/user-id-1');

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取会议历史失败');
      expect(response.body).toHaveProperty('error', '查询错误');

      // 恢复原始的Meeting.find
      Meeting.find = originalFind;
    });
  });

  describe('PATCH /api/interaction/meetings/:id/status', () => {
    it('应该成功更新会议状态', async () => {
      // 模拟数据
      const mockMeeting = {
        _id: 'meeting-id-1',
        title: '测试会议',
        status: 'scheduled',
        organizer: 'test-user-id'
      };

      // 设置模拟函数的返回值
      Meeting.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockMeeting)
      });

      Meeting.findByIdAndUpdate.mockResolvedValue({
        ...mockMeeting,
        status: 'completed'
      });

      // 发送请求
      const response = await request(app)
        .patch('/api/interaction/meetings/meeting-id-1/status')
        .send({ status: 'completed' });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'completed');
    });

    it('应该验证必要参数', async () => {
      // 发送请求（不提供状态）
      const response = await request(app)
        .patch('/api/interaction/meetings/meeting-id-1/status')
        .send({});

      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '状态是必需的');
    });

    it('应该验证状态值', async () => {
      // 发送请求（提供无效状态）
      const response = await request(app)
        .patch('/api/interaction/meetings/meeting-id-1/status')
        .send({ status: 'invalid-status' });

      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '无效的状态值');
    });
  });

  describe('POST /api/interaction/meetings/:id/feedback', () => {
    it('应该成功添加会议反馈', async () => {
      // 模拟数据
      const mockMeeting = {
        _id: 'meeting-id-1',
        title: '测试会议',
        feedback: [],
        save: jest.fn().mockResolvedValue({
          _id: 'meeting-id-1',
          title: '测试会议',
          feedback: [{
            user: 'user-id-1',
            rating: 5,
            comment: '很好的会议'
          }]
        })
      };

      // 设置模拟函数的返回值
      Meeting.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockMeeting)
      });

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/meetings/meeting-id-1/feedback')
        .send({
          userId: 'user-id-1',
          rating: 5,
          comment: '很好的会议'
        });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body.feedback).toHaveLength(1);
      expect(response.body.feedback[0]).toHaveProperty('user', 'user-id-1');
      expect(response.body.feedback[0]).toHaveProperty('rating', 5);
      expect(response.body.feedback[0]).toHaveProperty('comment', '很好的会议');
    });

    it('应该验证必要参数', async () => {
      // 发送请求（不提供评分）
      const response = await request(app)
        .post('/api/interaction/meetings/meeting-id-1/feedback')
        .send({
          userId: 'user-id-1',
          comment: '很好的会议'
        });

      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '用户ID和评分是必需的');
    });

    it('应该验证评分范围', async () => {
      // 发送请求（评分超出范围）
      const response = await request(app)
        .post('/api/interaction/meetings/meeting-id-1/feedback')
        .send({
          userId: 'user-id-1',
          rating: 6,
          comment: '很好的会议'
        });

      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '评分必须在1到5之间');
    });

    it('应该处理会议不存在的情况', async () => {
      // 设置模拟函数的返回值
      Meeting.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null)
      });

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/meetings/non-existent-id/feedback')
        .send({
          userId: 'user-id-1',
          rating: 5,
          comment: '很好的会议'
        });

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议不存在');
    });

    it('应该处理保存错误', async () => {
      // 模拟数据
      const mockMeeting = {
        _id: 'meeting-id-1',
        title: '测试会议',
        feedback: [],
        save: jest.fn().mockRejectedValue(new Error('保存错误'))
      };

      // 设置模拟函数的返回值
      Meeting.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockMeeting)
      });

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/meetings/meeting-id-1/feedback')
        .send({
          userId: 'user-id-1',
          rating: 5,
          comment: '很好的会议'
        });

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '添加会议反馈失败');
      expect(response.body).toHaveProperty('error', '保存错误');
    });
  });

  describe('PUT /api/interaction/meetings/:id/cancel', () => {
    it('应该成功取消会议', async () => {
      // 模拟数据
      const mockMeeting = {
        _id: 'meeting-id-1',
        title: '测试会议',
        status: 'scheduled',
        save: jest.fn().mockResolvedValue({
          _id: 'meeting-id-1',
          title: '测试会议',
          status: 'cancelled',
          notes: '会议已取消'
        })
      };

      // 设置模拟函数的返回值
      Meeting.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockMeeting)
      });

      // 发送请求
      const response = await request(app)
        .put('/api/interaction/meetings/meeting-id-1/cancel')
        .send({ reason: '会议已取消' });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'cancelled');
      expect(response.body).toHaveProperty('notes', '会议已取消');
    });

    it('应该处理会议不存在的情况', async () => {
      // 设置模拟函数的返回值
      Meeting.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null)
      });

      // 发送请求
      const response = await request(app)
        .put('/api/interaction/meetings/non-existent-id/cancel')
        .send({ reason: '会议已取消' });

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议不存在');
    });

    it('应该处理已完成会议的情况', async () => {
      // 模拟数据
      const mockMeeting = {
        _id: 'meeting-id-1',
        title: '测试会议',
        status: 'completed'
      };

      // 设置模拟函数的返回值
      Meeting.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockMeeting)
      });

      // 发送请求
      const response = await request(app)
        .put('/api/interaction/meetings/meeting-id-1/cancel')
        .send({ reason: '会议已取消' });

      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '已结束的会议不能取消');
    });

    it('应该处理保存错误', async () => {
      // 模拟数据
      const mockMeeting = {
        _id: 'meeting-id-1',
        title: '测试会议',
        status: 'scheduled',
        save: jest.fn().mockRejectedValue(new Error('保存错误'))
      };

      // 设置模拟函数的返回值
      Meeting.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockMeeting)
      });

      // 发送请求
      const response = await request(app)
        .put('/api/interaction/meetings/meeting-id-1/cancel')
        .send({ reason: '会议已取消' });

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '取消会议失败');
      expect(response.body).toHaveProperty('error', '保存错误');
    });
  });

  describe('GET /api/interaction/meetings/upcoming/:userId', () => {
    it('应该返回用户即将到来的会议', async () => {
      // 模拟数据
      const mockMeetings = [
        {
          _id: 'meeting-id-1',
          title: '即将到来的会议1',
          startTime: new Date(Date.now() + 86400000), // 明天
          status: 'scheduled'
        }
      ];

      // 设置模拟函数的返回值
      Meeting.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockMeetings)
      });

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/meetings/upcoming/user-id-1')
        .query({ role: 'teacher', limit: 5 });

      // 验证响应
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body[0]).toHaveProperty('_id', 'meeting-id-1');
      expect(response.body[0]).toHaveProperty('status', 'scheduled');

      // 验证Meeting.find被调用
      expect(Meeting.find).toHaveBeenCalledWith({
        teacher: 'user-id-1',
        startTime: { $gt: expect.any(Date) },
        status: 'scheduled'
      });
    });

    it('应该验证必要参数', async () => {
      // 发送请求（不提供角色）
      const response = await request(app)
        .get('/api/interaction/meetings/upcoming/user-id-1');

      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '用户ID和角色不能为空');
    });

    it('应该处理查询错误', async () => {
      // 模拟查询错误
      Meeting.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(new Error('查询错误'))
      });

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/meetings/upcoming/user-id-1')
        .query({ role: 'teacher' });

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取即将到来的会议失败');
      expect(response.body).toHaveProperty('error', '查询错误');
    });

    it('应该处理不同角色', async () => {
      // 发送请求（家长角色）
      await request(app)
        .get('/api/interaction/meetings/upcoming/user-id-1')
        .query({ role: 'parent', limit: 5 });

      // 验证Meeting.find被调用
      expect(Meeting.find).toHaveBeenCalledWith({
        parent: 'user-id-1',
        startTime: { $gt: expect.any(Date) },
        status: 'scheduled'
      });

      // 发送请求（学生角色）
      await request(app)
        .get('/api/interaction/meetings/upcoming/user-id-1')
        .query({ role: 'student', limit: 5 });

      // 验证Meeting.find被调用
      expect(Meeting.find).toHaveBeenCalledWith({
        student: 'user-id-1',
        startTime: { $gt: expect.any(Date) },
        status: 'scheduled'
      });
    });
  });
});