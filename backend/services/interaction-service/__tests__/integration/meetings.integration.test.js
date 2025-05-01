/**
 * 会议路由集成测试
 */

const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { connect, closeDatabase, clearDatabase } = require('../test-utils/db-handler');
const app = require('../../server');
const Meeting = require('../../models/Meeting');

// 创建测试用户
const testUsers = {
  teacher: {
    _id: new mongoose.Types.ObjectId(),
    name: '李老师',
    role: 'teacher'
  },
  parent1: {
    _id: new mongoose.Types.ObjectId(),
    name: '张爸爸',
    role: 'parent'
  },
  parent2: {
    _id: new mongoose.Types.ObjectId(),
    name: '王妈妈',
    role: 'parent'
  },
  student1: {
    _id: new mongoose.Types.ObjectId(),
    name: '张小明',
    role: 'student'
  },
  student2: {
    _id: new mongoose.Types.ObjectId(),
    name: '王小红',
    role: 'student'
  }
};

// 创建测试令牌
const createToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role, name: user.name },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
};

describe('会议路由集成测试', () => {
  let mongoServer;
  let teacherToken, parentToken;
  let testMeetings = [];

  beforeAll(async () => {
    // 连接到内存数据库
    await connect();

    // 创建测试令牌
    teacherToken = createToken(testUsers.teacher);
    parentToken = createToken(testUsers.parent1);

    // 创建测试会议
    const now = new Date();
    const meetings = [
      {
        title: '期中考试家长会',
        description: '讨论期中考试成绩',
        teacher: testUsers.teacher._id,
        parent: testUsers.parent1._id,
        student: testUsers.student1._id,
        startTime: new Date(now.getTime() + 24 * 60 * 60 * 1000), // 明天
        endTime: new Date(now.getTime() + 25 * 60 * 60 * 1000),
        location: '线上会议',
        status: '待确认',
        meetingType: '线上'
      },
      {
        title: '学习进度讨论',
        description: '讨论学生学习进度',
        teacher: testUsers.teacher._id,
        parent: testUsers.parent2._id,
        student: testUsers.student2._id,
        startTime: new Date(now.getTime() + 48 * 60 * 60 * 1000), // 后天
        endTime: new Date(now.getTime() + 49 * 60 * 60 * 1000),
        location: '学校会议室',
        status: '已确认',
        meetingType: '线下'
      }
    ];

    testMeetings = await Meeting.insertMany(meetings);
  });

  afterAll(async () => {
    // 断开数据库连接
    await closeDatabase();
  });

  beforeEach(async () => {
    // 清空数据库集合
    // 注意：我们不在这里清空数据库，因为我们需要保留测试会议
    // 如果需要清空数据库，可以使用 await clearDatabase();
  });

  describe('GET /api/interaction/meetings', () => {
    it('未认证用户应该返回401错误', async () => {
      const response = await request(app)
        .get('/api/interaction/meetings');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', '未认证');
    });

    it('认证用户应该能获取会议列表', async () => {
      const response = await request(app)
        .get('/api/interaction/meetings')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(2);
    });

    it('应该能根据会议类型过滤会议', async () => {
      const response = await request(app)
        .get('/api/interaction/meetings')
        .query({ meetingType: '线上' })
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].meetingType).toBe('线上');
    });
  });

  describe('POST /api/interaction/meetings', () => {
    it('教师应该能创建会议', async () => {
      const now = new Date();
      const newMeeting = {
        title: '新的家长会',
        description: '讨论学生表现',
        teacher: testUsers.teacher._id.toString(),
        parent: testUsers.parent1._id.toString(),
        student: testUsers.student1._id.toString(),
        startTime: new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString(), // 3天后
        endTime: new Date(now.getTime() + 73 * 60 * 60 * 1000).toISOString(),
        location: '线上会议',
        meetingType: '线上'
      };

      const response = await request(app)
        .post('/api/interaction/meetings')
        .send(newMeeting)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('_id');
      expect(response.body).toHaveProperty('title', newMeeting.title);
      expect(response.body).toHaveProperty('teacher', newMeeting.teacher);
      expect(response.body).toHaveProperty('parent', newMeeting.parent);
      expect(response.body).toHaveProperty('student', newMeeting.student);
      expect(response.body).toHaveProperty('status', '待确认');

      // 验证会议已保存到数据库
      const savedMeeting = await Meeting.findById(response.body._id);
      expect(savedMeeting).not.toBeNull();
      expect(savedMeeting.title).toBe(newMeeting.title);
    });

    it('家长不应该能创建班级会议', async () => {
      const now = new Date();
      const newMeeting = {
        title: '家长发起的会议',
        description: '讨论学生表现',
        teacher: testUsers.teacher._id.toString(),
        parent: testUsers.parent1._id.toString(),
        student: testUsers.student1._id.toString(),
        startTime: new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString(),
        endTime: new Date(now.getTime() + 73 * 60 * 60 * 1000).toISOString()
      };

      const response = await request(app)
        .post('/api/interaction/meetings')
        .send(newMeeting)
        .set('Authorization', `Bearer ${parentToken}`);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message', '只有教师和管理员可以创建会议');
    });

    it('缺少必要字段应该返回400错误', async () => {
      const invalidMeeting = {
        // 缺少title
        teacher: testUsers.teacher._id.toString(),
        parent: testUsers.parent1._id.toString(),
        student: testUsers.student1._id.toString()
        // 缺少startTime和endTime
      };

      const response = await request(app)
        .post('/api/interaction/meetings')
        .send(invalidMeeting)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '标题、教师、家长、学生、开始时间和结束时间不能为空');
    });
  });

  describe('GET /api/interaction/meetings/:id', () => {
    it('应该能获取特定会议', async () => {
      const meetingId = testMeetings[0]._id;

      const response = await request(app)
        .get(`/api/interaction/meetings/${meetingId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('_id', meetingId.toString());
      expect(response.body).toHaveProperty('title', testMeetings[0].title);
      expect(response.body).toHaveProperty('teacher');
      expect(response.body).toHaveProperty('parent');
      expect(response.body).toHaveProperty('student');
    });

    it('不存在的会议ID应该返回404错误', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .get(`/api/interaction/meetings/${nonExistentId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '会议不存在');
    });
  });

  describe('PUT /api/interaction/meetings/:id/status', () => {
    it('组织者应该能更新会议状态', async () => {
      // 创建一个新会议用于测试
      const meetingToUpdate = await Meeting.create({
        title: '待更新状态的会议',
        description: '测试更新状态',
        teacher: testUsers.teacher._id,
        parent: testUsers.parent1._id,
        student: testUsers.student1._id,
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() + 25 * 60 * 60 * 1000),
        status: '待确认',
        meetingType: '线上'
      });

      const response = await request(app)
        .put(`/api/interaction/meetings/${meetingToUpdate._id}/status`)
        .send({ status: '已确认' })
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', '已确认');

      // 验证数据库中的会议状态已更新
      const updatedMeeting = await Meeting.findById(meetingToUpdate._id);
      expect(updatedMeeting.status).toBe('已确认');
    });

    it('非组织者不应该能更新会议状态', async () => {
      const response = await request(app)
        .put(`/api/interaction/meetings/${testMeetings[1]._id}/status`)
        .send({ status: '已取消' })
        .set('Authorization', `Bearer ${parentToken}`);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message', '您没有权限更新此会议');
    });
  });

  describe('POST /api/interaction/meetings/:id/attend', () => {
    it('参与者应该能确认参加会议', async () => {
      // 创建一个新会议用于测试
      const meetingToAttend = await Meeting.create({
        title: '待确认参加的会议',
        description: '测试确认参加',
        teacher: testUsers.teacher._id,
        parent: testUsers.parent1._id,
        student: testUsers.student1._id,
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() + 25 * 60 * 60 * 1000),
        status: '待确认',
        meetingType: '线上'
      });

      const response = await request(app)
        .post(`/api/interaction/meetings/${meetingToAttend._id}/attend`)
        .set('Authorization', `Bearer ${parentToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', '已确认');

      // 验证数据库中的会议状态已更新
      const updatedMeeting = await Meeting.findById(meetingToAttend._id);
      expect(updatedMeeting.status).toBe('已确认');
    });

    it('非参与者不应该能确认参加会议', async () => {
      // 使用parent2的令牌尝试确认parent1的会议
      const parent2Token = createToken(testUsers.parent2);

      const response = await request(app)
        .post(`/api/interaction/meetings/${testMeetings[0]._id}/attend`)
        .set('Authorization', `Bearer ${parent2Token}`);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message', '您不是此会议的参与者');
    });
  });
});
