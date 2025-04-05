const request = require('supertest');
const app = require('../../../common/app');
const Progress = require('../../../common/models/Progress');
const User = require('../../../common/models/User');

describe('学习进度服务测试', () => {
  let token;
  let studentToken;
  let teacherUser;
  let studentUser;
  let progressId;

  beforeEach(async () => {
    // 创建一个教师用户
    teacherUser = await User.create({
      username: 'testteacher',
      password: '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', // Test123!@#
      email: 'teacher@example.com',
      role: 'teacher',
      name: '测试教师'
    });

    // 创建一个学生用户
    studentUser = await User.create({
      username: 'teststudent',
      password: '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', // Test123!@#
      email: 'student@example.com',
      role: 'student',
      name: '测试学生'
    });

    // 获取教师token
    const teacherLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'testteacher',
        password: 'Test123!@#'
      });

    token = teacherLoginResponse.body.data.token;

    // 获取学生token
    const studentLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'teststudent',
        password: 'Test123!@#'
      });

    studentToken = studentLoginResponse.body.data.token;

    // 创建一个测试进度记录
    const progress = await Progress.create({
      studentId: studentUser._id,
      subject: '数学',
      chapter: '分数',
      section: '分数加减法',
      completionRate: 75,
      timeSpent: 45, // 分钟
      lastActivity: new Date(),
      exercises: [
        {
          id: '1',
          type: 'multiple-choice',
          question: '1/2 + 1/4 = ?',
          answer: '3/4',
          isCorrect: true,
          timeSpent: 30 // 秒
        },
        {
          id: '2',
          type: 'fill-blank',
          question: '2/3 - 1/6 = ?',
          answer: '1/2',
          isCorrect: false,
          timeSpent: 45 // 秒
        }
      ]
    });

    progressId = progress._id;
  });

  afterEach(async () => {
    // 清理测试数据
    await User.deleteMany({});
    await Progress.deleteMany({});
  });

  // 测试获取学生进度
  describe('GET /api/progress/student/:studentId', () => {
    it('教师应该能够获取学生的进度', async () => {
      const response = await request(app)
        .get(`/api/progress/student/${studentUser._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.progress.length).toBeGreaterThan(0);
      expect(response.body.data.progress[0].subject).toBe('数学');
      expect(response.body.data.progress[0].chapter).toBe('分数');
    });

    it('学生应该能够获取自己的进度', async () => {
      const response = await request(app)
        .get(`/api/progress/student/${studentUser._id}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.progress.length).toBeGreaterThan(0);
    });

    it('学生不应该能够获取其他学生的进度', async () => {
      // 创建另一个学生
      const anotherStudent = await User.create({
        username: 'anotherstudent',
        password: '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
        email: 'another@example.com',
        role: 'student',
        name: '另一个学生'
      });

      const response = await request(app)
        .get(`/api/progress/student/${anotherStudent._id}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(403);
      expect(response.body.status).toBe('error');
    });
  });

  // 测试更新学习进度
  describe('POST /api/progress', () => {
    it('学生应该能够更新自己的学习进度', async () => {
      const progressData = {
        subject: '语文',
        chapter: '古诗词',
        section: '唐诗赏析',
        completionRate: 60,
        timeSpent: 30,
        exercises: [
          {
            type: 'multiple-choice',
            question: '《静夜思》的作者是谁？',
            answer: '李白',
            isCorrect: true,
            timeSpent: 25
          }
        ]
      };

      const response = await request(app)
        .post('/api/progress')
        .set('Authorization', `Bearer ${studentToken}`)
        .send(progressData);

      expect(response.status).toBe(201);
      expect(response.body.status).toBe('success');
      expect(response.body.data.progress.subject).toBe('语文');
      expect(response.body.data.progress.chapter).toBe('古诗词');
      expect(response.body.data.progress.studentId.toString()).toBe(studentUser._id.toString());
    });

    it('应该验证进度数据的完整性', async () => {
      const invalidProgressData = {
        // 缺少必要字段
        subject: '语文'
      };

      const response = await request(app)
        .post('/api/progress')
        .set('Authorization', `Bearer ${studentToken}`)
        .send(invalidProgressData);

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
    });
  });

  // 测试获取进度详情
  describe('GET /api/progress/:progressId', () => {
    it('应该能够获取进度详情', async () => {
      const response = await request(app)
        .get(`/api/progress/${progressId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.progress._id.toString()).toBe(progressId.toString());
      expect(response.body.data.progress.subject).toBe('数学');
      expect(response.body.data.progress.exercises.length).toBe(2);
    });

    it('应该处理无效的进度ID', async () => {
      const invalidId = '60f1a5c5f0e8e82b8c9e1234'; // 有效但不存在的ID

      const response = await request(app)
        .get(`/api/progress/${invalidId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.status).toBe('error');
    });
  });

  // 测试生成进度报告
  describe('GET /api/progress/reports/student/:studentId', () => {
    it('应该能够生成学生的进度报告', async () => {
      const response = await request(app)
        .get(`/api/progress/reports/student/${studentUser._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.report).toBeDefined();
      expect(response.body.data.report.student).toBeDefined();
      expect(response.body.data.report.subjects).toBeDefined();
    });
  });
});