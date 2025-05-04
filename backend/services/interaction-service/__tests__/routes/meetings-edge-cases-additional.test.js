/**
 * 会议路由边缘情况额外测试
 */

const request = require('supertest');
const express = require('express');
const router = require('../../routes/meetings');

// 模拟 Meeting 模型
jest.mock('../../models/Meeting', () => {
  // 创建一个模拟的 Meeting 构造函数
  const mockMeeting = jest.fn().mockImplementation(function(data) {
    Object.assign(this, data);
    this.save = jest.fn().mockResolvedValue(this);
  });

  // 添加静态方法
  mockMeeting.find = jest.fn();
  mockMeeting.findById = jest.fn();
  mockMeeting.findOne = jest.fn();
  mockMeeting.findByIdAndUpdate = jest.fn();
  mockMeeting.findByIdAndDelete = jest.fn();
  mockMeeting.countDocuments = jest.fn();

  return mockMeeting;
});

describe('会议路由边缘情况额外测试', () => {
  let app;
  const Meeting = require('../../models/Meeting');

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/interaction/meetings', router);

    // 重置所有模拟函数
    jest.clearAllMocks();
  });

  describe('POST /api/interaction/meetings - 边缘情况', () => {
    it('应该处理可选字段为空的情况', async () => {
      // 模拟数据
      const meetingData = {
        title: '测试会议',
        teacher: 'teacher-id-1',
        parent: 'parent-id-1',
        student: 'student-id-1',
        startTime: '2023-01-15T10:00:00Z',
        endTime: '2023-01-15T11:00:00Z'
        // 不提供 description, location, meetingType, meetingLink
      };

      // 设置模拟函数的返回值
      Meeting.findOne.mockResolvedValue(null);

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/meetings')
        .send(meetingData);

      // 验证响应
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('title', meetingData.title);
      expect(response.body).toHaveProperty('description', '');
      expect(response.body).toHaveProperty('location', '');
      expect(response.body).toHaveProperty('meetingType', 'offline');
      expect(response.body).toHaveProperty('meetingLink', '');
    });
  });

  describe('PUT /api/interaction/meetings/:id - 边缘情况', () => {
    it('应该处理只更新开始时间的情况', async () => {
      // 模拟数据
      const mockMeeting = {
        _id: 'meeting-id-1',
        title: '测试会议',
        description: '测试描述',
        teacher: 'teacher-id-1',
        parent: 'parent-id-1',
        student: 'student-id-1',
        startTime: new Date('2023-01-15T10:00:00Z'),
        endTime: new Date('2023-01-15T11:00:00Z'),
        location: '线上',
        meetingType: 'online',
        meetingLink: 'https://meeting.com',
        status: 'scheduled',
        notes: '',
        feedback: '',
        save: jest.fn().mockResolvedValue({
          _id: 'meeting-id-1',
          title: '测试会议',
          description: '测试描述',
          teacher: 'teacher-id-1',
          parent: 'parent-id-1',
          student: 'student-id-1',
          startTime: new Date('2023-01-16T10:00:00Z'),
          endTime: new Date('2023-01-15T11:00:00Z'),
          location: '线上',
          meetingType: 'online',
          meetingLink: 'https://meeting.com',
          status: 'scheduled',
          notes: '',
          feedback: '',
          updatedAt: Date.now()
        })
      };

      // 设置模拟函数的返回值
      Meeting.findById.mockResolvedValue(mockMeeting);
      Meeting.findOne.mockResolvedValue(null);

      // 发送请求
      const response = await request(app)
        .put('/api/interaction/meetings/meeting-id-1')
        .send({
          startTime: '2023-01-16T10:00:00Z'
        });

      // 验证响应
      expect(response.status).toBe(200);
      // 验证开始时间已更新
      expect(response.body.startTime).toBeDefined();
      // 验证结束时间保持不变
      expect(new Date(response.body.endTime)).toEqual(mockMeeting.endTime);
    });

    it('应该处理只更新结束时间的情况', async () => {
      // 模拟数据
      const mockMeeting = {
        _id: 'meeting-id-1',
        title: '测试会议',
        description: '测试描述',
        teacher: 'teacher-id-1',
        parent: 'parent-id-1',
        student: 'student-id-1',
        startTime: new Date('2023-01-15T10:00:00Z'),
        endTime: new Date('2023-01-15T11:00:00Z'),
        location: '线上',
        meetingType: 'online',
        meetingLink: 'https://meeting.com',
        status: 'scheduled',
        notes: '',
        feedback: '',
        save: jest.fn().mockResolvedValue({
          _id: 'meeting-id-1',
          title: '测试会议',
          description: '测试描述',
          teacher: 'teacher-id-1',
          parent: 'parent-id-1',
          student: 'student-id-1',
          startTime: new Date('2023-01-15T10:00:00Z'),
          endTime: new Date('2023-01-15T12:00:00Z'),
          location: '线上',
          meetingType: 'online',
          meetingLink: 'https://meeting.com',
          status: 'scheduled',
          notes: '',
          feedback: '',
          updatedAt: Date.now()
        })
      };

      // 设置模拟函数的返回值
      Meeting.findById.mockResolvedValue(mockMeeting);
      Meeting.findOne.mockResolvedValue(null);

      // 发送请求
      const response = await request(app)
        .put('/api/interaction/meetings/meeting-id-1')
        .send({
          endTime: '2023-01-15T12:00:00Z'
        });

      // 验证响应
      expect(response.status).toBe(200);
      // 验证开始时间保持不变
      expect(new Date(response.body.startTime)).toEqual(mockMeeting.startTime);
      // 验证结束时间已更新
      expect(response.body.endTime).toBeDefined();
    });

    it('应该处理更新可选字段为空字符串的情况', async () => {
      // 模拟数据
      const mockMeeting = {
        _id: 'meeting-id-1',
        title: '测试会议',
        description: '测试描述',
        teacher: 'teacher-id-1',
        parent: 'parent-id-1',
        student: 'student-id-1',
        startTime: new Date('2023-01-15T10:00:00Z'),
        endTime: new Date('2023-01-15T11:00:00Z'),
        location: '线上',
        meetingType: 'online',
        meetingLink: 'https://meeting.com',
        status: 'scheduled',
        notes: '一些笔记',
        feedback: '',
        save: jest.fn().mockResolvedValue({
          _id: 'meeting-id-1',
          title: '测试会议',
          description: '',
          teacher: 'teacher-id-1',
          parent: 'parent-id-1',
          student: 'student-id-1',
          startTime: new Date('2023-01-15T10:00:00Z'),
          endTime: new Date('2023-01-15T11:00:00Z'),
          location: '',
          meetingType: 'online',
          meetingLink: '',
          status: 'scheduled',
          notes: '',
          feedback: '',
          updatedAt: Date.now()
        })
      };

      // 设置模拟函数的返回值
      Meeting.findById.mockResolvedValue(mockMeeting);

      // 发送请求
      const response = await request(app)
        .put('/api/interaction/meetings/meeting-id-1')
        .send({
          description: '',
          location: '',
          meetingLink: '',
          notes: ''
        });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body.description).toBe('');
      expect(response.body.location).toBe('');
      expect(response.body.meetingLink).toBe('');
      expect(response.body.notes).toBe('');
    });
  });

  describe('PUT /api/interaction/meetings/:id/cancel - 边缘情况', () => {
    it('应该处理取消原因为空的情况', async () => {
      // 模拟数据
      const mockMeeting = {
        _id: 'meeting-id-1',
        title: '测试会议',
        status: 'scheduled',
        notes: '一些笔记',
        save: jest.fn().mockResolvedValue({
          _id: 'meeting-id-1',
          title: '测试会议',
          status: 'cancelled',
          notes: '会议已取消',
          updatedAt: Date.now()
        })
      };

      // 设置模拟函数的返回值
      Meeting.findById.mockResolvedValue(mockMeeting);

      // 发送请求
      const response = await request(app)
        .put('/api/interaction/meetings/meeting-id-1/cancel')
        .send({});

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('cancelled');
      expect(response.body.notes).toBe('会议已取消');
    });
  });
});
