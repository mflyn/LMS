const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const bcrypt = require('bcryptjs');
const User = require('../../models/User');

// 增加超时时间
jest.setTimeout(60000);

describe('User 模型直接测试', () => {
  let mongoServer;

  beforeAll(async () => {
    // 创建内存数据库
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // 清理测试数据
    await User.deleteMany({});
  });

  it('应该创建并保存用户', async () => {
    // 手动哈希密码
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('Test123!@#', salt);

    const userData = {
      username: 'testuser',
      password: hashedPassword,
      email: 'test@example.com',
      role: 'student',
      name: '测试用户',
      // 学生特有字段
      grade: '三年级',
      class: '2班',
      studentId: 'S12345'
    };

    const user = new User(userData);
    await user.save();

    const savedUser = await User.findOne({ username: 'testuser' });
    expect(savedUser).not.toBeNull();
    expect(savedUser.username).toBe(userData.username);
    expect(savedUser.email).toBe(userData.email);
    expect(savedUser.role).toBe(userData.role);
    expect(savedUser.name).toBe(userData.name);
    expect(savedUser.grade).toBe(userData.grade);
    expect(savedUser.class).toBe(userData.class);
    expect(savedUser.studentId).toBe(userData.studentId);

    // 验证密码已被哈希
    expect(savedUser.password).toBe(hashedPassword);
  });

  it('应该验证必填字段', async () => {
    const invalidUser = new User({
      // 缺少必填字段
    });

    let error;
    try {
      await invalidUser.validate();
    } catch (err) {
      error = err;
    }

    expect(error).toBeDefined();
    expect(error.errors.username).toBeDefined();
    expect(error.errors.password).toBeDefined();
    expect(error.errors.email).toBeDefined();
    expect(error.errors.role).toBeDefined();
  });

  it('应该验证用户名唯一性', async () => {
    // 手动哈希密码
    const salt = await bcrypt.genSalt(10);
    const hashedPassword1 = await bcrypt.hash('Test123!@#', salt);
    const hashedPassword2 = await bcrypt.hash('Test456!@#', salt);

    // 创建第一个用户
    await User.create({
      username: 'testuser',
      password: hashedPassword1,
      email: 'test1@example.com',
      role: 'student',
      name: '测试用户1',
      // 学生特有字段
      grade: '三年级',
      class: '2班',
      studentId: 'S12345'
    });

    // 尝试创建具有相同用户名的第二个用户
    const duplicateUser = new User({
      username: 'testuser', // 重复的用户名
      password: hashedPassword2,
      email: 'test2@example.com',
      role: 'student',
      name: '测试用户2',
      // 学生特有字段
      grade: '三年级',
      class: '2班',
      studentId: 'S12346'
    });

    let error;
    try {
      await duplicateUser.save();
    } catch (err) {
      error = err;
    }

    expect(error).toBeDefined();
    expect(error.code).toBe(11000); // MongoDB 重复键错误代码
  });

  it('应该正确验证密码', async () => {
    // 手动哈希密码
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('Test123!@#', salt);

    // 创建用户
    const user = await User.create({
      username: 'testuser',
      password: hashedPassword,
      email: 'test@example.com',
      role: 'student',
      name: '测试用户',
      // 学生特有字段
      grade: '三年级',
      class: '2班',
      studentId: 'S12345'
    });

    // 验证正确的密码
    const isValidPassword = await bcrypt.compare('Test123!@#', user.password);
    expect(isValidPassword).toBe(true);

    // 验证错误的密码
    const isInvalidPassword = await bcrypt.compare('WrongPassword', user.password);
    expect(isInvalidPassword).toBe(false);
  });

  it('应该支持查询用户', async () => {
    // 手动哈希密码
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('Test123!@#', salt);

    // 创建多个用户
    await User.create([
      {
        username: 'student1',
        password: hashedPassword,
        email: 'student1@example.com',
        role: 'student',
        name: '学生1',
        // 学生特有字段
        grade: '三年级',
        class: '2班',
        studentId: 'S12345'
      },
      {
        username: 'student2',
        password: hashedPassword,
        email: 'student2@example.com',
        role: 'student',
        name: '学生2',
        // 学生特有字段
        grade: '三年级',
        class: '2班',
        studentId: 'S12346'
      },
      {
        username: 'teacher1',
        password: hashedPassword,
        email: 'teacher1@example.com',
        role: 'teacher',
        name: '教师1',
        // 教师特有字段
        teacherId: 'T12345',
        subjects: ['数学', '物理'],
        classesManaged: ['三年级2班', '三年级3班']
      }
    ]);

    // 查询所有用户
    const allUsers = await User.find();
    expect(allUsers.length).toBe(3);

    // 按角色查询
    const students = await User.find({ role: 'student' });
    expect(students.length).toBe(2);

    const teachers = await User.find({ role: 'teacher' });
    expect(teachers.length).toBe(1);
  });
});
