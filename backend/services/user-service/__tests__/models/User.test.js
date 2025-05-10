const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../../models/User');

let mongoServer;

// 在所有测试之前设置内存数据库
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
});

// 在所有测试之后关闭连接
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

// 每个测试之前清理数据库
beforeEach(async () => {
  await User.deleteMany({});
});

describe('User 模型测试', () => {
  it('应该成功创建并保存用户', async () => {
    const userData = {
      name: '测试用户',
      username: 'testuser',
      password: 'password123',
      email: 'test@example.com',
      role: 'student',
      grade: '三年级',
      class: '1班',
      studentId: 'S12345'
    };

    const user = new User(userData);
    const savedUser = await user.save();

    // 验证保存的用户
    expect(savedUser._id).toBeDefined();
    expect(savedUser.name).toBe(userData.name);
    expect(savedUser.username).toBe(userData.username);
    expect(savedUser.password).toBe(userData.password);
    expect(savedUser.email).toBe(userData.email);
    expect(savedUser.role).toBe(userData.role);
    expect(savedUser.grade).toBe(userData.grade);
    expect(savedUser.class).toBe(userData.class);
    expect(savedUser.studentId).toBe(userData.studentId);
    expect(savedUser.createdAt).toBeDefined();
  });

  it('应该拒绝缺少必填字段的用户', async () => {
    const invalidUser = new User({
      name: '测试用户',
      // 缺少 username
      password: 'password123',
      email: 'test@example.com',
      role: 'student'
    });

    let error;
    try {
      await invalidUser.save();
    } catch (err) {
      error = err;
    }

    expect(error).toBeDefined();
    expect(error.name).toBe('ValidationError');
    expect(error.errors.username).toBeDefined();
  });

  it('应该拒绝无效角色的用户', async () => {
    const invalidUser = new User({
      name: '测试用户',
      username: 'testuser',
      password: 'password123',
      email: 'test@example.com',
      role: 'invalid_role' // 无效角色
    });

    let error;
    try {
      await invalidUser.save();
    } catch (err) {
      error = err;
    }

    expect(error).toBeDefined();
    expect(error.name).toBe('ValidationError');
    expect(error.errors.role).toBeDefined();
  });

  it('应该拒绝重复的用户名', async () => {
    // 先创建一个用户
    const firstUser = new User({
      name: '第一个用户',
      username: 'sameusername',
      password: 'password123',
      email: 'first@example.com',
      role: 'student',
      grade: '三年级',
      class: '1班',
      studentId: 'S12345'
    });
    await firstUser.save();

    // 尝试创建具有相同用户名的用户
    const secondUser = new User({
      name: '第二个用户',
      username: 'sameusername', // 相同的用户名
      password: 'password456',
      email: 'second@example.com',
      role: 'student',
      grade: '四年级',
      class: '2班',
      studentId: 'S67890'
    });

    let error;
    try {
      await secondUser.save();
    } catch (err) {
      error = err;
    }

    expect(error).toBeDefined();
    expect(error.name).toBe('MongoServerError');
    expect(error.code).toBe(11000); // 重复键错误
  });

  it('应该拒绝重复的电子邮件', async () => {
    // 先创建一个用户
    const firstUser = new User({
      name: '第一个用户',
      username: 'firstuser',
      password: 'password123',
      email: 'same@example.com',
      role: 'student',
      grade: '三年级',
      class: '1班',
      studentId: 'S12345'
    });
    await firstUser.save();

    // 尝试创建具有相同电子邮件的用户
    const secondUser = new User({
      name: '第二个用户',
      username: 'seconduser',
      password: 'password456',
      email: 'same@example.com', // 相同的电子邮件
      role: 'student',
      grade: '四年级',
      class: '2班',
      studentId: 'S67890'
    });

    let error;
    try {
      await secondUser.save();
    } catch (err) {
      error = err;
    }

    expect(error).toBeDefined();
    expect(error.name).toBe('MongoServerError');
    expect(error.code).toBe(11000); // 重复键错误
  });

  it('应该验证学生特有字段', async () => {
    const studentUser = new User({
      name: '学生用户',
      username: 'student',
      password: 'password123',
      email: 'student@example.com',
      role: 'student',
      // 缺少 grade, class, studentId
    });

    let error;
    try {
      await studentUser.save();
    } catch (err) {
      error = err;
    }

    expect(error).toBeDefined();
    expect(error.name).toBe('ValidationError');
    expect(error.errors.grade).toBeDefined();
    expect(error.errors.class).toBeDefined();
    expect(error.errors.studentId).toBeDefined();
  });

  it('应该验证教师特有字段', async () => {
    const teacherUser = new User({
      name: '教师用户',
      username: 'teacher',
      password: 'password123',
      email: 'teacher@example.com',
      role: 'teacher',
      // 缺少 teacherId, subjects, classesManaged
    });

    let error;
    try {
      await teacherUser.save();
    } catch (err) {
      error = err;
    }

    expect(error).toBeDefined();
    expect(error.name).toBe('ValidationError');

    // 检查至少有一个必填字段的验证错误
    expect(error.errors).toBeDefined();
    expect(
      error.errors.teacherId !== undefined ||
      error.errors.subjects !== undefined ||
      error.errors.classesManaged !== undefined
    ).toBe(true);
  });

  it('应该成功创建教师用户', async () => {
    const teacherData = {
      name: '教师用户',
      username: 'teacher',
      password: 'password123',
      email: 'teacher@example.com',
      role: 'teacher',
      teacherId: 'T12345',
      subjects: ['数学', '科学'],
      classesManaged: ['三年级1班', '三年级2班']
    };

    const teacher = new User(teacherData);
    const savedTeacher = await teacher.save();

    expect(savedTeacher._id).toBeDefined();
    expect(savedTeacher.name).toBe(teacherData.name);
    expect(savedTeacher.role).toBe('teacher');
    expect(savedTeacher.teacherId).toBe('T12345');
    expect(savedTeacher.subjects).toEqual(['数学', '科学']);
    expect(savedTeacher.classesManaged).toEqual(['三年级1班', '三年级2班']);
  });
});
