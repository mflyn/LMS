const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../server');
const Homework = require('../models/Homework');
const jwt = require('jsonwebtoken');

let mongoServer;
let testToken;

// 测试前设置
beforeAll(async () => {
  // 创建内存MongoDB实例用于测试
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);

  // 创建测试作业
  await Homework.create({
    title: '测试作业',
    description: '这是一个测试作业',
    subject: '数学',
    classId: 'class123',
    teacherId: 'teacher123',
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 一周后截止
    attachments: [],
    createdAt: new Date(),
  });

  // 创建测试令牌
  testToken = jwt.sign(
    { id: 'teacher123', username: 'testteacher', role: 'teacher' },
    process.env.JWT_SECRET || 'your_jwt_secret_key',
    { expiresIn: '1h' }
  );
});

// 测试后清理
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

// 每个测试后清理数据库
afterEach(async () => {
  // 保留测试作业，清理其他数据
  const testHomework = await Homework.findOne({ title: '测试作业' });
  await Homework.deleteMany({ _id: { $ne: testHomework._id } });
});

describe('作业API测试', () => {
  // 测试获取作业列表
  describe('GET /api/homework', () => {
    it('应返回作业列表', async () => {
      const res = await request(app)
        .get('/api/homework')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('homeworks');
      expect(Array.isArray(res.body.homeworks)).toBeTruthy();
      expect(res.body.homeworks.length).toBeGreaterThan(0);
    });

    it('应根据班级ID筛选作业', async () => {
      const res = await request(app)
        .get('/api/homework?classId=class123')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('homeworks');
      expect(Array.isArray(res.body.homeworks)).toBeTruthy();
      expect(res.body.homeworks.length).toBeGreaterThan(0);
      expect(res.body.homeworks[0].classId).toEqual('class123');
    });
  });

  // 测试创建新作业
  describe('POST /api/homework', () => {
    it('应成功创建新作业', async () => {
      const res = await request(app)
        .post('/api/homework')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          title: '新测试作业',
          description: '这是一个新的测试作业',
          subject: '语文',
          classId: 'class123',
          deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5天后截止
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('homework');
      expect(res.body.homework).toHaveProperty('title', '新测试作业');
      expect(res.body.homework).toHaveProperty('subject', '语文');
      expect(res.body.homework).toHaveProperty('teacherId', 'teacher123');

      // 验证作业已保存到数据库
      const savedHomework = await Homework.findOne({ title: '新测试作业' });
      expect(savedHomework).not.toBeNull();
    });

    it('应拒绝缺少必填字段的请求', async () => {
      const res = await request(app)
        .post('/api/homework')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          // 缺少标题
          description: '这是一个不完整的测试作业',
          subject: '英语',
          classId: 'class123',
        });

      expect(res.statusCode).toEqual(400);
    });

    it('应拒绝非教师用户创建作业', async () => {
      // 创建学生令牌
      const studentToken = jwt.sign(
        { id: 'student123', username: 'teststudent', role: 'student' },
        process.env.JWT_SECRET || 'your_jwt_secret_key',
        { expiresIn: '1h' }
      );

      const res = await request(app)
        .post('/api/homework')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          title: '学生创建的作业',
          description: '这是学生尝试创建的作业',
          subject: '科学',
          classId: 'class123',
          deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        });

      expect(res.statusCode).toEqual(403);
    });
  });

  // 测试获取单个作业详情
  describe('GET /api/homework/:id', () => {
    it('应返回作业详情', async () => {
      // 先获取测试作业的ID
      const homework = await Homework.findOne({ title: '测试作业' });

      const res = await request(app)
        .get(`/api/homework/${homework._id}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('title', '测试作业');
      expect(res.body).toHaveProperty('subject', '数学');
      expect(res.body).toHaveProperty('classId', 'class123');
    });

    it('应返回404状态码当作业不存在', async () => {
      const res = await request(app)
        .get('/api/homework/5f7d5dc5d7a2f3001c9a4321') // 不存在的ID
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.statusCode).toEqual(404);
    });
  });

  // 测试更新作业
  describe('PUT /api/homework/:id', () => {
    it('应成功更新作业', async () => {
      // 先获取测试作业的ID
      const homework = await Homework.findOne({ title: '测试作业' });

      const res = await request(app)
        .put(`/api/homework/${homework._id}`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          title: '更新后的测试作业',
          description: '这是更新后的测试作业描述',
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('title', '更新后的测试作业');
      expect(res.body).toHaveProperty('description', '这是更新后的测试作业描述');

      // 验证数据库中的作业已更新
      const updatedHomework = await Homework.findById(homework._id);
      expect(updatedHomework.title).toEqual('更新后的测试作业');
    });

    it('应拒绝非作业创建者的更新请求', async () => {
      // 创建另一个教师令牌
      const anotherTeacherToken = jwt.sign(
        { id: 'teacher456', username: 'anotherteacher', role: 'teacher' },
        process.env.JWT_SECRET || 'your_jwt_secret_key',
        { expiresIn: '1h' }
      );

      // 先获取测试作业的ID
      const homework = await Homework.findOne({ title: '测试作业' });

      const res = await request(app)
        .put(`/api/homework/${homework._id}`)
        .set('Authorization', `Bearer ${anotherTeacherToken}`)
        .send({
          title: '其他教师更新的作业',
        });

      expect(res.statusCode).toEqual(403);
    });
  });

  // 测试删除作业
  describe('DELETE /api/homework/:id', () => {
    it('应成功删除作业', async () => {
      // 先创建一个新作业用于删除测试
      const newHomework = await Homework.create({
        title: '待删除作业',
        description: '这个作业将被删除',
        subject: '英语',
        classId: 'class123',
        teacherId: 'teacher123',
        deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      });

      const res = await request(app)
        .delete(`/api/homework/${newHomework._id}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('message');
      expect(res.body.message).toContain('删除成功');

      // 验证作业已从数据库中删除
      const deletedHomework = await Homework.findById(newHomework._id);
      expect(deletedHomework).toBeNull();
    });

    it('应拒绝非作业创建者的删除请求', async () => {
      // 创建另一个教师令牌
      const anotherTeacherToken = jwt.sign(
        { id: 'teacher456', username: 'anotherteacher', role: 'teacher' },
        process.env.JWT_SECRET || 'your_jwt_secret_key',
        { expiresIn: '1h' }
      );

      // 先获取测试作业的ID
      const homework = await Homework.findOne({ title: '测试作业' });

      const res = await request(app)
        .delete(`/api/homework/${homework._id}`)
        .set('Authorization', `Bearer ${anotherTeacherToken}`);

      expect(res.statusCode).toEqual(403);

      // 验证作业未被删除
      const stillExistsHomework = await Homework.findById(homework._id);
      expect(stillExistsHomework).not.toBeNull();
    });
  });
});