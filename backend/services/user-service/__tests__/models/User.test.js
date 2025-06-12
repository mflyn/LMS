const mongoose = require('mongoose');
// const { MongoMemoryServer } = require('mongodb-memory-server'); // 由全局配置处理
const User = require('../../../../common/models/User'); // 修正：使用公共模型

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
      grade: 3, // 使用数字
      studentId: 'S12345' // 使用正确的字段名
    };

    const user = new User(studentData);
    const savedUser = await user.save();

    expect(savedUser._id).toBeDefined();
    expect(savedUser.name).toBe(studentData.name);
    expect(savedUser.username).toBe(studentData.username);
    // 密码应该被哈希
    expect(savedUser.password).toBeDefined();
    expect(savedUser.password).not.toBe(studentData.password);
    expect(savedUser.email).toBe(studentData.email);
    expect(savedUser.role).toBe(studentData.role);
    expect(savedUser.grade).toBe(studentData.grade);
    expect(savedUser.studentId).toBe(studentData.studentId);
    expect(savedUser.createdAt).toBeDefined();
    expect(savedUser.updatedAt).toBeDefined();
    expect(savedUser.status).toBe('active'); // 测试默认值
  });

  // 新增：手机号注册相关测试
  describe('手机号注册功能测试', () => {
    it('应该成功创建使用手机号注册的用户', async () => {
      const phoneUserData = {
        name: '手机号用户',
        username: 'phoneuser',
        password: 'password123',
        phone: '13800138000',
        role: 'student'
      };

      const user = new User(phoneUserData);
      const savedUser = await user.save();

      expect(savedUser._id).toBeDefined();
      expect(savedUser.phone).toBe(phoneUserData.phone);
      expect(savedUser.email).toBeUndefined();
      expect(savedUser.registrationType).toBe('phone');
    });

    it('应该成功创建使用邮箱注册的用户', async () => {
      const emailUserData = {
        name: '邮箱用户',
        username: 'emailuser',
        password: 'password123',
        email: 'email@example.com',
        role: 'student'
      };

      const user = new User(emailUserData);
      const savedUser = await user.save();

      expect(savedUser._id).toBeDefined();
      expect(savedUser.email).toBe(emailUserData.email);
      expect(savedUser.phone).toBeUndefined();
      expect(savedUser.registrationType).toBe('email');
    });

    it('应该成功创建使用混合注册的用户', async () => {
      const mixedUserData = {
        name: '混合用户',
        username: 'mixeduser',
        password: 'password123',
        email: 'mixed@example.com',
        phone: '13900139000',
        role: 'student'
      };

      const user = new User(mixedUserData);
      const savedUser = await user.save();

      expect(savedUser._id).toBeDefined();
      expect(savedUser.email).toBe(mixedUserData.email);
      expect(savedUser.phone).toBe(mixedUserData.phone);
      expect(savedUser.registrationType).toBe('mixed');
    });

    it('应该拒绝既没有邮箱也没有手机号的用户', async () => {
      const invalidUserData = {
        name: '无效用户',
        username: 'invaliduser',
        password: 'password123',
        role: 'student'
      };

      const user = new User(invalidUserData);
      let error;
      try {
        await user.save();
      } catch (err) {
        error = err;
      }
      expect(error).toBeDefined();
      expect(error.message).toContain('用户必须提供邮箱或手机号码');
    });

    it('应该拒绝无效格式的手机号', async () => {
      const invalidPhoneData = {
        name: '无效手机号用户',
        username: 'invalidphoneuser',
        password: 'password123',
        phone: '12345678901', // 无效格式
        role: 'student'
      };

      const user = new User(invalidPhoneData);
      let error;
      try {
        await user.save();
      } catch (err) {
        error = err;
      }
      expect(error.name).toBe('ValidationError');
      expect(error.errors.phone).toBeDefined();
    });

    it('应该拒绝重复的手机号', async () => {
      const phoneData1 = {
        name: '用户1',
        username: 'user1',
        password: 'password123',
        phone: '13800138000',
        role: 'student'
      };

      const phoneData2 = {
        name: '用户2',
        username: 'user2',
        password: 'password123',
        phone: '13800138000', // 重复的手机号
        role: 'student'
      };

      await new User(phoneData1).save();
      
      const secondUser = new User(phoneData2);
      let error;
      try {
        await secondUser.save();
      } catch (err) {
        error = err;
      }
      expect(error.code).toBe(11000);
    });

    it('应该验证手机号格式（中国手机号）', async () => {
      const validPhones = ['13800138000', '15912345678', '18888888888'];
      const invalidPhones = ['12800138000', '1380013800', '138001380001', 'abcdefghijk'];

      // 测试有效手机号
      for (let i = 0; i < validPhones.length; i++) {
        const userData = {
          name: `用户${i}`,
          username: `user${i}`,
          password: 'password123',
          phone: validPhones[i],
          role: 'student'
        };
        const user = new User(userData);
        await expect(user.save()).resolves.toBeDefined();
      }

      // 测试无效手机号
      for (let i = 0; i < invalidPhones.length; i++) {
        const userData = {
          name: `无效用户${i}`,
          username: `invaliduser${i}`,
          password: 'password123',
          phone: invalidPhones[i],
          role: 'student'
        };
        const user = new User(userData);
        await expect(user.save()).rejects.toThrow();
      }
    });
  });

  // 新增：findByEmailOrPhone 静态方法测试
  describe('findByEmailOrPhone 静态方法测试', () => {
    beforeEach(async () => {
      // 创建测试用户
      await new User({
        name: '邮箱用户',
        username: 'emailuser',
        password: 'password123',
        email: 'test@example.com',
        role: 'student'
      }).save();

      await new User({
        name: '手机号用户',
        username: 'phoneuser',
        password: 'password123',
        phone: '13800138000',
        role: 'student'
      }).save();
    });

    it('应该能通过邮箱找到用户', async () => {
      const user = await User.findByEmailOrPhone('test@example.com');
      expect(user).toBeDefined();
      expect(user.email).toBe('test@example.com');
      expect(user.username).toBe('emailuser');
    });

    it('应该能通过手机号找到用户', async () => {
      const user = await User.findByEmailOrPhone('13800138000');
      expect(user).toBeDefined();
      expect(user.phone).toBe('13800138000');
      expect(user.username).toBe('phoneuser');
    });

    it('对于无效格式的标识符应该返回null', async () => {
      const user = await User.findByEmailOrPhone('invalid-identifier');
      expect(user).toBeNull();
    });

    it('对于不存在的邮箱应该返回null', async () => {
      const user = await User.findByEmailOrPhone('notexist@example.com');
      expect(user).toBeNull();
    });

    it('对于不存在的手机号应该返回null', async () => {
      const user = await User.findByEmailOrPhone('13900139000');
      expect(user).toBeNull();
    });
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

    it('comparePassword方法应该正确工作', async () => {
      const userWithPassword = await User.findById(userId);
      expect(userWithPassword.password).toBeDefined();
      const isMatch = await userWithPassword.comparePassword(rawPassword);
      expect(isMatch).toBe(true);
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
    expect(error.name).toBe('ValidationError');
    expect(error.errors.username).toBeDefined();
  });

  it('应该拒绝无效角色的用户', async () => {
    const invalidUser = new User({ ...baseUserData, role: 'invalid_role' });
    let error;
    try { await invalidUser.save(); } catch (err) { error = err; }
    expect(error.name).toBe('ValidationError');
    expect(error.errors.role).toBeDefined();
  });

  it('应该拒绝重复的用户名', async () => {
    await new User({ ...baseUserData, username: 'duplicateuser', email: 'email1@example.com', role: 'student', grade: 1 }).save();
    const secondUser = new User({ ...baseUserData, username: 'duplicateuser', email: 'email2@example.com', role: 'student', grade: 2 });
    let error;
    try { await secondUser.save(); } catch (err) { error = err; }
    expect(error.code).toBe(11000);
  });

  it('应该拒绝重复的电子邮件', async () => {
    await new User({ ...baseUserData, username: 'user1', email: 'duplicate@example.com', role: 'student', grade: 1 }).save();
    const secondUser = new User({ ...baseUserData, username: 'user2', email: 'duplicate@example.com', role: 'student', grade: 2 });
    let error;
    try { await secondUser.save(); } catch (err) { error = err; }
    expect(error.code).toBe(11000);
  });

  describe('学生角色字段验证', () => {
    it('当角色为学生时，可以设置grade字段', async () => {
      const studentData = { ...baseUserData, role: 'student', grade: 3 };
      const user = new User(studentData);
      const savedUser = await user.save();
      expect(savedUser.grade).toBe(3);
    });

    it('当角色不是学生时，grade字段不是必填的', async () => {
      const teacherData = { ...baseUserData, role: 'teacher' };
      const teacher = new User(teacherData);
      await expect(teacher.save()).resolves.toBeDefined(); // 应该成功保存
      expect(teacher.grade).toBeUndefined();
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
    expect(savedTeacher.teacherId).toBeUndefined();
    expect(savedTeacher.subjects).toEqual([]);
  });

  it('应该成功创建教师用户并保存其特定可选字段', async () => {
    const teacherData = {
      ...baseUserData,
      username: 'fullteacher',
      email: 'fullteacher@example.com',
      role: 'teacher',
      teacherId: 'T98765'
    };
    const teacher = new User(teacherData);
    const savedTeacher = await teacher.save();
    expect(savedTeacher.teacherId).toBe('T98765');
    expect(savedTeacher.subjects).toEqual([]);
  });

  it('应该成功创建家长用户并关联孩子', async () => {
    const child1 = await new User({ ...baseUserData, username: 'child1', email: 'child1@example.com', role: 'student', grade: 1 }).save();
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
    expect(savedUserActive.status).toBe('active');

    const userInactive = new User({ ...baseUserData, username: 'inactiveUser', email: 'inactive@example.com', role: 'admin', status: 'inactive' });
    const savedUserInactive = await userInactive.save();
    expect(savedUserInactive.status).toBe('inactive');
  });

  // 测试字段保存
  it('应该正确保存用户字段', async () => {
    const userData = {
      ...baseUserData,
      username: 'fielduser',
      email: 'field@example.com',
      role: 'student',
      grade: 3,
      studentId: 'S12345'
    };
    const user = new User(userData);
    const savedUser = await user.save();

    expect(savedUser.grade).toBe(3);
    expect(savedUser.studentId).toBe('S12345');
  });
});
