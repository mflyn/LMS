const mongoose = require('mongoose');
// const { MongoMemoryServer } = require('mongodb-memory-server'); // 由全局配置处理
const User = require('../../models/User');

// let mongoServer; // 由全局配置处理

// // 在所有测试之前设置内存数据库 // 由全局配置处理
// beforeAll(async () => {
//   mongoServer = await MongoMemoryServer.create();
//   const mongoUri = mongoServer.getUri();

//   await mongoose.connect(mongoUri, {
//     useNewUrlParser: true,
//     useUnifiedTopology: true,
//   });
// });

// // 在所有测试之后关闭连接 // 由全局配置处理
// afterAll(async () => {
//   await mongoose.disconnect();
//   await mongoServer.stop();
// });

// // 每个测试之前清理数据库 // 由全局 __tests__/setup.js 处理
// beforeEach(async () => {
//   await User.deleteMany({});
// });

describe('User 模型测试', () => {
  const baseUserData = {
    name: '测试用户',
    username: 'testuser',
    password: 'password123',
    email: 'test@example.com',
  };

  it('应该成功创建并保存学生用户，并自动生成时间戳', async () => {
    const studentData = {
      ...baseUserData,
      role: 'student',
      grade: '三年级',
      studentClass: '1班', // 新字段名
      studentIdNumber: 'S12345' // 新字段名
    };

    const user = new User(studentData);
    const savedUser = await user.save();

    expect(savedUser._id).toBeDefined();
    expect(savedUser.name).toBe(studentData.name);
    expect(savedUser.username).toBe(studentData.username);
    // 密码不应该直接返回，并且应该是哈希过的
    expect(savedUser.password).toBeUndefined(); // 因为 select: false
    expect(savedUser.email).toBe(studentData.email);
    expect(savedUser.role).toBe(studentData.role);
    expect(savedUser.grade).toBe(studentData.grade);
    expect(savedUser.studentClass).toBe(studentData.studentClass);
    expect(savedUser.studentIdNumber).toBe(studentData.studentIdNumber);
    expect(savedUser.createdAt).toBeDefined();
    expect(savedUser.updatedAt).toBeDefined();
    expect(savedUser.isActive).toBe(true); // 测试默认值
  });

  it('保存用户时应该自动更新 updatedAt', async () => {
    const user = new User({ ...baseUserData, role: 'admin' });
    let savedUser = await user.save();
    const firstUpdatedAt = savedUser.updatedAt;

    await new Promise(resolve => setTimeout(resolve, 10)); // 等待一小段时间

    savedUser.name = '更新后的测试用户';
    savedUser = await savedUser.save();
    
    expect(savedUser.updatedAt.getTime()).toBeGreaterThan(firstUpdatedAt.getTime());
  });

  it('应该在保存前哈希密码', async () => {
    const rawPassword = 'rawPassword123';
    const user = new User({ ...baseUserData, password: rawPassword, role: 'admin' });
    await user.save();

    // 从数据库中重新获取用户，并选择密码字段
    const userWithPassword = await User.findById(user._id).select('+password');
    expect(userWithPassword.password).toBeDefined();
    expect(userWithPassword.password).not.toBe(rawPassword);
  });

  describe('comparePassword 方法', () => {
    const rawPassword = 'password123';
    let userId;

    beforeEach(async () => {
      const user = new User({ ...baseUserData, password: rawPassword, role: 'teacher' });
      await user.save();
      userId = user._id;
    });

    it('对于正确的密码应该返回 true', async () => {
      const userWithPassword = await User.findById(userId).select('+password');
      expect(userWithPassword).toBeDefined();
      const isMatch = await userWithPassword.comparePassword(rawPassword);
      expect(isMatch).toBe(true);
    });

    it('对于错误的密码应该返回 false', async () => {
      const userWithPassword = await User.findById(userId).select('+password');
      expect(userWithPassword).toBeDefined();
      const isMatch = await userWithPassword.comparePassword('wrongpassword');
      expect(isMatch).toBe(false);
    });

    it('当用户对象没有密码字段时，comparePassword 应该抛出错误', async () => {
      const userWithoutPassword = await User.findById(userId); // 默认不选择密码
      expect(userWithoutPassword.password).toBeUndefined();
      try {
        await userWithoutPassword.comparePassword(rawPassword);
        // 如果没有抛出错误，则强制测试失败
        throw new Error('comparePassword did not throw an error when password was not selected'); 
      } catch (e) {
        expect(e.message).toContain('User password not available for comparison');
      }
    });
  });

  it('应该拒绝缺少必填字段的用户 (例如 username)', async () => {
    const invalidUserData = { ...baseUserData };
    delete invalidUserData.username;
    invalidUserData.role = 'student';
    
    const invalidUser = new User(invalidUserData);
    let error;
    try {
      await invalidUser.save();
    } catch (err) {
      error = err;
    }
    expect(error).toBeInstanceOf(mongoose.Error.ValidationError);
    expect(error.errors.username).toBeDefined();
  });

  it('应该拒绝无效角色的用户', async () => {
    const invalidUser = new User({ ...baseUserData, role: 'invalid_role' });
    let error;
    try { await invalidUser.save(); } catch (err) { error = err; }
    expect(error).toBeInstanceOf(mongoose.Error.ValidationError);
    expect(error.errors.role).toBeDefined();
  });

  it('应该拒绝重复的用户名', async () => {
    await new User({ ...baseUserData, username: 'duplicateuser', email: 'email1@example.com', role: 'student', grade: '一年级', studentClass: '1班' }).save();
    const secondUser = new User({ ...baseUserData, username: 'duplicateuser', email: 'email2@example.com', role: 'student', grade: '二年级', studentClass: '2班' });
    let error;
    try { await secondUser.save(); } catch (err) { error = err; }
    expect(error).toBeInstanceOf(mongoose.mongo.MongoServerError); // Mongoose 7+ specific error type
    expect(error.code).toBe(11000);
  });

  it('应该拒绝重复的电子邮件', async () => {
    await new User({ ...baseUserData, username: 'user1', email: 'duplicate@example.com', role: 'student', grade: '一年级', studentClass: '1班' }).save();
    const secondUser = new User({ ...baseUserData, username: 'user2', email: 'duplicate@example.com', role: 'student', grade: '二年级', studentClass: '2班' });
    let error;
    try { await secondUser.save(); } catch (err) { error = err; }
    expect(error).toBeInstanceOf(mongoose.mongo.MongoServerError);
    expect(error.code).toBe(11000);
  });

  describe('学生角色特定字段验证', () => {
    it('当角色为学生时，grade 和 studentClass 是必填的', async () => {
      const studentDataNoGrade = { ...baseUserData, role: 'student', studentClass: '1班' };
      const studentDataNoClass = { ...baseUserData, role: 'student', grade: '三年级' };

      const userNoGrade = new User(studentDataNoGrade);
      let errGrade;
      try { await userNoGrade.save(); } catch (e) { errGrade = e; }
      expect(errGrade).toBeInstanceOf(mongoose.Error.ValidationError);
      expect(errGrade.errors.grade).toBeDefined();

      const userNoClass = new User(studentDataNoClass);
      let errClass;
      try { await userNoClass.save(); } catch (e) { errClass = e; }
      expect(errClass).toBeInstanceOf(mongoose.Error.ValidationError);
      expect(errClass.errors.studentClass).toBeDefined();
    });

    it('当角色不是学生时，grade 和 studentClass 不是必填的', async () => {
      const teacherData = { ...baseUserData, role: 'teacher' };
      const teacher = new User(teacherData);
      await expect(teacher.save()).resolves.toBeDefined(); // 应该成功保存
      expect(teacher.grade).toBeUndefined();
      expect(teacher.studentClass).toBeUndefined();
    });
  });

  it('应该成功创建教师用户（可选字段未提供）', async () => {
    const teacherData = {
      ...baseUserData,
      username: 'newteacher',
      email: 'newteacher@example.com',
      role: 'teacher',
      // teacherIdNumber, subjectsTaught, classesOverseen 是可选的
    };
    const teacher = new User(teacherData);
    const savedTeacher = await teacher.save();
    expect(savedTeacher._id).toBeDefined();
    expect(savedTeacher.role).toBe('teacher');
    expect(savedTeacher.teacherIdNumber).toBeUndefined();
    expect(savedTeacher.subjectsTaught).toEqual([]);
    expect(savedTeacher.classesOverseen).toEqual([]);
  });

  it('应该成功创建教师用户并保存其特定可选字段', async () => {
    const teacherData = {
      ...baseUserData,
      username: 'fullteacher',
      email: 'fullteacher@example.com',
      role: 'teacher',
      teacherIdNumber: 'T98765',       // 新字段名
      subjectsTaught: ['物理', '化学'], // 新字段名
      classesOverseen: ['九年级3班']  // 新字段名
    };
    const teacher = new User(teacherData);
    const savedTeacher = await teacher.save();
    expect(savedTeacher.teacherIdNumber).toBe('T98765');
    expect(savedTeacher.subjectsTaught).toEqual(['物理', '化学']);
    expect(savedTeacher.classesOverseen).toEqual(['九年级3班']);
  });

  it('应该成功创建家长用户并关联孩子', async () => {
    const child1 = await new User({ ...baseUserData, username: 'child1', email: 'child1@example.com', role: 'student', grade: '1年级', studentClass: '1班' }).save();
    const parentData = {
      ...baseUserData,
      username: 'parent1',
      email: 'parent1@example.com',
      role: 'parent',
      children: [child1._id]
    };
    const parent = new User(parentData);
    const savedParent = await parent.save();
    expect(savedParent.role).toBe('parent');
    expect(savedParent.children.length).toBe(1);
    expect(savedParent.children[0].toString()).toBe(child1._id.toString());
  });

  it('isActive 字段应默认为 true 并可修改', async () => {
    const userActive = new User({ ...baseUserData, username: 'activeUser', email: 'active@example.com', role: 'admin' });
    const savedUserActive = await userActive.save();
    expect(savedUserActive.isActive).toBe(true);

    const userInactive = new User({ ...baseUserData, username: 'inactiveUser', email: 'inactive@example.com', role: 'admin', isActive: false });
    const savedUserInactive = await userInactive.save();
    expect(savedUserInactive.isActive).toBe(false);
  });

  // 测试旧字段名是否不再有效 （例如 studentId, class, teacherId, subjects, classesManaged）
  it('不应保存旧的字段名 (例如 studentId, class)', async () => {
    const userDataWithOldFields = {
      ...baseUserData,
      username: 'oldfielduser',
      email: 'oldfield@example.com',
      role: 'student',
      grade: '三年级',
      studentClass: '正确班级', // 新字段，用于对比
      class: '1班（旧字段）',       // 旧字段名
      studentId: 'S12345（旧字段）' // 旧字段名
    };
    const user = new User(userDataWithOldFields);
    const savedUser = await user.save();
    const userObject = savedUser.toObject();

    expect(userObject.class).toBeUndefined();
    expect(userObject.studentId).toBeUndefined();
    expect(savedUser.studentClass).toBe('正确班级'); // 确保新字段保存了
  });
});
