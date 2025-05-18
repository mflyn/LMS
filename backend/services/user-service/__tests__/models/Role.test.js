const mongoose = require('mongoose');
// const { MongoMemoryServer } = require('mongodb-memory-server'); // 由全局配置处理
const Role = require('../../models/Role');

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
//   await Role.deleteMany({});
// });

describe('Role 模型测试', () => {
  const baseRoleData = {
    name: 'student',
    description: '学生角色',
    permissions: ['read_resources', 'submit_homework']
  };

  it('应该成功创建并保存角色，并自动生成时间戳', async () => {
    const role = new Role(baseRoleData);
    const savedRole = await role.save();

    expect(savedRole._id).toBeDefined();
    expect(savedRole.name).toBe(baseRoleData.name);
    expect(savedRole.description).toBe(baseRoleData.description);
    expect(savedRole.permissions).toEqual(baseRoleData.permissions);
    expect(savedRole.createdAt).toBeDefined();
    expect(savedRole.updatedAt).toBeDefined();
  });

  it('保存角色时应该自动更新 updatedAt', async () => {
    const role = new Role(baseRoleData);
    let savedRole = await role.save();
    const firstUpdatedAt = savedRole.updatedAt;

    await new Promise(resolve => setTimeout(resolve, 10)); // 等待一小段时间

    savedRole.description = '更新后的学生角色描述';
    savedRole = await savedRole.save();
    
    expect(savedRole.updatedAt.getTime()).toBeGreaterThan(firstUpdatedAt.getTime());
  });

  it('应该拒绝缺少必填字段的角色 (例如 description)', async () => {
    const invalidRoleData = { ...baseRoleData };
    delete invalidRoleData.description;
    
    const invalidRole = new Role(invalidRoleData);
    let error;
    try { await invalidRole.save(); } catch (err) { error = err; }
    expect(error).toBeInstanceOf(mongoose.Error.ValidationError);
    expect(error.errors.description).toBeDefined();
  });

  it('应该拒绝缺少必填字段的角色 (例如 name)', async () => {
    const invalidRoleData = { ...baseRoleData };
    delete invalidRoleData.name;

    const invalidRole = new Role(invalidRoleData);
    let error;
    try { await invalidRole.save(); } catch (err) { error = err; }
    expect(error).toBeInstanceOf(mongoose.Error.ValidationError);
    expect(error.errors.name).toBeDefined();
  });

  it('应该拒绝无效的角色名称 (不在枚举列表中)', async () => {
    const invalidRole = new Role({
      ...baseRoleData,
      name: 'invalid_enum_role', 
    });
    let error;
    try { await invalidRole.save(); } catch (err) { error = err; }
    expect(error).toBeInstanceOf(mongoose.Error.ValidationError);
    expect(error.errors.name).toBeDefined();
  });

  it('应该拒绝重复的角色名称', async () => {
    await new Role({ name: 'unique_teacher', description: '教师角色' }).save();
    const secondRole = new Role({ name: 'unique_teacher', description: '另一个教师角色' });
    let error;
    try { await secondRole.save(); } catch (err) { error = err; }
    expect(error).toBeInstanceOf(mongoose.mongo.MongoServerError);
    expect(error.code).toBe(11000);
  });

  it('应该成功创建所有有效的角色类型', async () => {
    const rolesToTest = [
      { name: 'student', description: '学生', permissions: ['perm1'] },
      { name: 'parent', description: '家长', permissions: ['perm2'] },
      { name: 'teacher', description: '教师', permissions: ['perm3'] },
      { name: 'admin', description: '管理员', permissions: ['perm4'] },
      { name: 'superadmin', description: '超级管理员', permissions: ['perm_all'] }
    ];

    for (const roleData of rolesToTest) {
      const role = new Role(roleData);
      const savedRole = await role.save();
      expect(savedRole._id).toBeDefined();
      expect(savedRole.name).toBe(roleData.name);
    }
    const count = await Role.countDocuments();
    expect(count).toBe(rolesToTest.length);
  });

  it('应该允许空的权限数组 (permissions)', async () => {
    const roleWithEmptyPermissions = new Role({
      name: 'guest', // 使用一个有效的、未被占用的角色名
      description: '访客角色，权限为空',
      permissions: [] // 空权限数组
    });
    // 使用 try-catch 来处理可能的保存成功或失败，因为我们预期它会成功
    try {
      const savedRole = await roleWithEmptyPermissions.save();
      expect(savedRole).toBeDefined();
      expect(savedRole.permissions).toEqual([]);
    } catch (error) {
      // 如果这里发生错误，说明模型定义可能不允许空权限数组，或者其他验证失败
      // 为了这个测试的目的（验证允许空数组），我们不期望错误
      throw new Error(`保存具有空权限数组的角色失败: ${error.message}`);
    }
  });

  it('应该允许不提供 permissions 字段，此时默认为空数组', async () => {
    const roleWithoutPermissionsField = new Role({
        name: 'no_perm_role',
        description: '无权限字段角色'
        // permissions 字段未提供
    });
    const savedRole = await roleWithoutPermissionsField.save();
    expect(savedRole.permissions).toBeDefined();
    expect(savedRole.permissions).toEqual([]);
  });

});
