const request = require('supertest');
const app = require('../../../common/app');
const User = require('../../../common/models/User');
const Grade = require('../../../common/models/Grade');
const Homework = require('../../../common/models/Homework');
const ClassPerformance = require('../../../common/models/ClassPerformance');
const MistakeRecord = require('../../../common/models/MistakeRecord');

describe('数据服务测试', () => {
  let teacherToken;
  let studentToken;
  let parentToken;
  let studentId;
  let classId;

  beforeEach(async () => {
    // 创建测试教师
    const teacher = await User.create({
      username: 'testteacher',
      password: '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
      email: 'teacher@example.com',
      role: 'teacher',
      name: '测试教师'
    });

    // 创建测试学生
    const student = await User.create({
      username: 'teststudent',
      password: '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
      email: 'student@example.com',
      role: 'student',
      name: '测试学生',
      classId: 'testclass'
    });
    studentId = student._id;
    classId = 'testclass';

    // 创建测试家长
    const parent = await User.create({
      username: 'testparent',
      password: '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
      email: 'parent@example.com',
      role: 'parent',
      name: '测试家长',
      children: [studentId]
    });

    // 获取教师token
    const teacherLogin = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'testteacher',
        password: 'Test123!@#'
      });
    teacherToken = teacherLogin.body.data.token;

    // 获取学生token
    const studentLogin = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'teststudent',
        password: 'Test123!@#'
      });
    studentToken = studentLogin.body.data.token;

    // 获取家长token
    const parentLogin = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'testparent',
        password: 'Test123!@#'
      });
    parentToken = parentLogin.body.data.token;
  });

  // 测试成绩管理
  describe('成绩管理', () => {
    it('教师应该能够添加学生成绩', async () => {
      const response = await request(app)
        .post('/api/grades')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          studentId,
          subject: '数学',
          score: 95,
          examType: '期中考试',
          examDate: new Date(),
          comment: '表现优秀'
        });

      expect(response.status).toBe(201);
      expect(response.body.status).toBe('success');
      expect(response.body.data.grade.score).toBe(95);
    });

    it('学生应该能够查看自己的成绩', async () => {
      // 先创建一条成绩记录
      await Grade.create({
        studentId,
        subject: '数学',
        score: 95,
        examType: '期中考试',
        examDate: new Date()
      });

      const response = await request(app)
        .get('/api/grades/student')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.grades).toHaveLength(1);
      expect(response.body.data.grades[0].score).toBe(95);
    });

    it('家长应该能够查看孩子的成绩', async () => {
      // 先创建一条成绩记录
      await Grade.create({
        studentId,
        subject: '数学',
        score: 95,
        examType: '期中考试',
        examDate: new Date()
      });

      const response = await request(app)
        .get('/api/grades/child')
        .set('Authorization', `Bearer ${parentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.grades).toHaveLength(1);
      expect(response.body.data.grades[0].score).toBe(95);
    });
  });

  // 测试作业管理
  describe('作业管理', () => {
    it('教师应该能够发布作业', async () => {
      const response = await request(app)
        .post('/api/homework')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          classId,
          subject: '数学',
          title: '单元测试',
          content: '完成第1-5页的练习题',
          deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        });

      expect(response.status).toBe(201);
      expect(response.body.status).toBe('success');
      expect(response.body.data.homework.title).toBe('单元测试');
    });

    it('学生应该能够查看作业', async () => {
      // 先创建一条作业记录
      await Homework.create({
        classId,
        subject: '数学',
        title: '单元测试',
        content: '完成第1-5页的练习题',
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });

      const response = await request(app)
        .get('/api/homework/student')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.homework).toHaveLength(1);
      expect(response.body.data.homework[0].title).toBe('单元测试');
    });
  });

  // 测试课堂表现
  describe('课堂表现', () => {
    it('教师应该能够记录学生课堂表现', async () => {
      const response = await request(app)
        .post('/api/class-performance')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          studentId,
          date: new Date(),
          behavior: '积极参与课堂讨论',
          score: 5,
          comment: '表现很好'
        });

      expect(response.status).toBe(201);
      expect(response.body.status).toBe('success');
      expect(response.body.data.performance.score).toBe(5);
    });

    it('家长应该能够查看孩子的课堂表现', async () => {
      // 先创建一条课堂表现记录
      await ClassPerformance.create({
        studentId,
        date: new Date(),
        behavior: '积极参与课堂讨论',
        score: 5,
        comment: '表现很好'
      });

      const response = await request(app)
        .get('/api/class-performance/child')
        .set('Authorization', `Bearer ${parentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.performance).toHaveLength(1);
      expect(response.body.data.performance[0].score).toBe(5);
    });
  });

  // 测试错题记录
  describe('错题记录', () => {
    it('学生应该能够添加错题记录', async () => {
      const response = await request(app)
        .post('/api/mistake-record')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          subject: '数学',
          question: '2 + 2 = ?',
          correctAnswer: '4',
          studentAnswer: '5',
          analysis: '计算错误',
          tags: ['计算', '加法']
        });

      expect(response.status).toBe(201);
      expect(response.body.status).toBe('success');
      expect(response.body.data.mistake.subject).toBe('数学');
    });

    it('学生应该能够查看错题记录', async () => {
      // 先创建一条错题记录
      await MistakeRecord.create({
        studentId,
        subject: '数学',
        question: '2 + 2 = ?',
        correctAnswer: '4',
        studentAnswer: '5',
        analysis: '计算错误',
        tags: ['计算', '加法']
      });

      const response = await request(app)
        .get('/api/mistake-record')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.mistakes).toHaveLength(1);
      expect(response.body.data.mistakes[0].subject).toBe('数学');
    });
  });
}); 