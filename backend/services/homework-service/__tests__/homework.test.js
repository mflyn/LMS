const request = require('supertest');
const app = require('../../../common/app');
const Homework = require('../../../common/models/Homework');
const User = require('../../../common/models/User');

describe('作业服务测试', () => {
  let teacherToken;
  let studentToken;
  let teacherUser;
  let studentUser;
  let homeworkId;

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

    teacherToken = teacherLoginResponse.body.data.token;

    // 获取学生token
    const studentLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'teststudent',
        password: 'Test123!@#'
      });

    studentToken = studentLoginResponse.body.data.token;

    // 创建一个测试作业
    const homework = await Homework.create({
      title: '数学作业 - 分数应用题',
      description: '完成课本第15页的习题1-5',
      subject: '数学',
      teacherId: teacherUser._id,
      classId: '60f1a5c5f0e8e82b8c9e1111', // 假设的班级ID
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 一周后截止
      questions: [
        {
          type: 'multiple-choice',
          content: '1/2 + 1/4 = ?',
          options: ['1/6', '3/4', '3/6', '2/6'],
          answer: '3/4',
          points: 10
        },
        {
          type: 'fill-blank',
          content: '2/3 - 1/6 = ?',
          answer: '1/2',
          points: 15
        }
      ],
      attachments: [],
      status: 'published'
    });

    homeworkId = homework._id;
  });

  afterEach(async () => {
    // 清理测试数据
    await User.deleteMany({});
    await Homework.deleteMany({});
  });

  // 测试创建作业
  describe('POST /api/homework', () => {
    it('教师应该能够创建新作业', async () => {
      const homeworkData = {
        title: '语文作业 - 作文',
        description: '以"我的家乡