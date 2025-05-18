const request = require('supertest');
const app = require('../../server');
const User = require('../../models/User');
const Role = require('../../models/Role');

describe('用户服务测试 /api/users', () => {
  let adminToken, teacherToken, studentToken, parentToken;
  let adminUser, teacherUser, studentUser, parentUser;
  let testUserId;

  beforeAll(async () => {
    const roles = ['superadmin', 'admin', 'teacher', 'parent', 'student'];
    for (const roleName of roles) {
      await Role.findOneAndUpdate({ name: roleName }, { name: roleName, description: `${roleName} role` }, { upsert: true, new: true });
    }
  });

  beforeEach(async () => {
    adminUser = await User.create({
      username: 'testadmin_user_module',
      password: 'Password123!',
      email: 'admin_user_module@example.com',
      role: 'admin',
      firstName: '测试',
      lastName: '管理员',
      isActive: true,
    });

    teacherUser = await User.create({
      username: 'testteacher_user_module',
      password: 'Password123!',
      email: 'teacher_user_module@example.com',
      role: 'teacher',
      firstName: '测试',
      lastName: '教师',
      isActive: true,
      teacherDetails: {
        teacherIdNumber: 'T12345_user_module',
        subjectsTaught: ['Math', 'Science'],
      }
    });

    studentUser = await User.create({
      username: 'teststudent_user_module',
      password: 'Password123!',
      email: 'student_user_module@example.com',
      role: 'student',
      firstName: '测试',
      lastName: '学生',
      isActive: true,
      studentDetails: {
        studentIdNumber: 'S67890_user_module',
        grade: '5',
        studentClass: '3'
      }
    });
    
    parentUser = await User.create({
      username: 'testparent_user_module',
      password: 'Password123!',
      email: 'parent_user_module@example.com',
      role: 'parent',
      firstName: '测试',
      lastName: '家长',
      isActive: true,
      parentDetails: {
        children: [studentUser._id] 
      }
    });

    const loginAndGetToken = async (username, password) => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ username, password });
      return response.body.data.token;
    };

    adminToken = await loginAndGetToken('testadmin_user_module', 'Password123!');
    teacherToken = await loginAndGetToken('testteacher_user_module', 'Password123!');
    studentToken = await loginAndGetToken('teststudent_user_module', 'Password123!');
    parentToken = await loginAndGetToken('testparent_user_module', 'Password123!');

    const tempUser = await User.create({
      username: 'testuser_to_modify',
      password: 'Password123!',
      email: 'testuser_to_modify@example.com',
      role: 'student',
      firstName: '待修改',
      lastName: '用户',
      isActive: true,
      studentDetails: {
        studentIdNumber: 'S00000_user_module',
        grade: '1',
        studentClass: '1'
      }
    });
    testUserId = tempUser._id;
  });

  // 测试获取用户列表
  describe('GET /api/users', () => {
    it('管理员应该能够获取所有用户列表', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.users.length).toBeGreaterThanOrEqual(5);
    });

    it('教师应该能够获取所有用户列表 (根据路由设计，教师现在有此权限)', async () => {
      const response = await request(app)
        .get('/api/users?role=student')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.users.length).toBeGreaterThanOrEqual(2);
      
      response.body.data.users.forEach(user => {
        expect(user.role).toBe('student');
      });
    });
    
    it('家长不应该能够获取用户列表', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${parentToken}`);
      expect(response.status).toBe(403);
      expect(response.body.status).toBe('error');
    });

    it('学生不应该能够获取用户列表', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(403);
      expect(response.body.status).toBe('error');
    });
  });

  // 测试获取用户详情
  describe('GET /api/users/:userId', () => {
    it('管理员应该能够获取任何用户的详情', async () => {
      const response = await request(app)
        .get(`/api/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.user._id.toString()).toBe(testUserId.toString());
      expect(response.body.data.user.username).toBe('testuser_to_modify');
      expect(response.body.data.user.firstName).toBe('待修改');
    });

    it('用户应该能够获取自己的详情', async () => {
      const response = await request(app)
        .get(`/api/users/${studentUser._id}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.user._id.toString()).toBe(studentUser._id.toString());
      expect(response.body.data.user.username).toBe('teststudent_user_module');
      expect(response.body.data.user.studentDetails.grade).toBe('5');
    });
    
    it('家长应该能够获取自己孩子的详情', async () => {
      const childId = parentUser.parentDetails.children[0];
      const response = await request(app)
        .get(`/api/users/${childId}`)
        .set('Authorization', `Bearer ${parentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.user._id.toString()).toBe(childId.toString());
      expect(response.body.data.user.username).toBe('teststudent_user_module');
    });

    it('家长不应该能够获取非自己孩子的其他学生用户详情', async () => {
      const otherStudentId = testUserId;
      const response = await request(app)
        .get(`/api/users/${otherStudentId}`)
        .set('Authorization', `Bearer ${parentToken}`);
      expect(response.status).toBe(403);
      expect(response.body.status).toBe('error');
    });

    it('用户不应该能够获取其他用户的详情 (非自己，非管理员)', async () => {
      const response = await request(app)
        .get(`/api/users/${teacherUser._id}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(403);
      expect(response.body.status).toBe('error');
    });

    it('应该处理无效的用户ID', async () => {
      const invalidId = '60f1a5c5f0e8e82b8c9e1234';

      const response = await request(app)
        .get(`/api/users/${invalidId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.status).toBe('error');
    });
  });

  // 测试创建用户
  describe('POST /api/users', () => {
    it('管理员应该能够创建新用户 (例如，一个教师)', async () => {
      const userData = {
        username: 'newteacher_user_module',
        password: 'Password123!',
        email: 'newteacher_user_module@example.com',
        role: 'teacher',
        firstName: '新',
        lastName: '教师',
        teacherDetails: {
          teacherIdNumber: 'T99999_user_module',
          subjectsTaught: ['History']
        }
      };

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body.status).toBe('success');
      expect(response.body.data.user.username).toBe(userData.username);
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.user.role).toBe(userData.role);
      expect(response.body.data.user.firstName).toBe(userData.firstName);
      expect(response.body.data.user.teacherDetails.teacherIdNumber).toBe(userData.teacherDetails.teacherIdNumber);
    });
    
    it('管理员应该能够创建新学生用户', async () => {
      const userData = {
        username: 'newstudent_user_module',
        password: 'Password123!',
        email: 'newstudent_user_module@example.com',
        role: 'student',
        firstName: '新',
        lastName: '学生',
        studentDetails: {
          studentIdNumber: 'S11111_user_module',
          grade: '3',
          studentClass: '1'
        }
      };
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body.status).toBe('success');
      expect(response.body.data.user.username).toBe(userData.username);
      expect(response.body.data.user.studentDetails.grade).toBe(userData.studentDetails.grade);
    });

    it('非管理员不应该能够创建用户', async () => {
      const userData = {
        username: 'newuser_fail_user_module',
        password: 'Password123!',
        email: 'newuser_fail_user_module@example.com',
        role: 'student',
        firstName: '失败',
        lastName: '用户'
      };

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(userData);

      expect(response.status).toBe(403);
      expect(response.body.status).toBe('error');
    });

    it('应该验证用户数据的完整性 (例如缺少必填字段)', async () => {
      const invalidUserData = {
        username: 'incomplete_user_module',
        email: 'incomplete_user_module@example.com',
        role: 'student',
        firstName: '不完整',
      };

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidUserData);

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toMatch(/lastName is required/);
    });

    it('创建用户时角色特定字段也应该被验证 - 学生缺少学号', async () => {
      const userData = {
        username: 'student_no_id_user_module',
        password: 'Password123!',
        email: 'student_no_id_user_module@example.com',
        role: 'student',
        firstName: '学生',
        lastName: '缺学号',
        studentDetails: {
          grade: '4',
          studentClass: '2'
        }
      };
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(userData);
      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toMatch(/studentDetails.studentIdNumber is required/);
    });

    it('创建用户时角色特定字段也应该被验证 - 教师缺少教师ID', async () => {
      const userData = {
        username: 'teacher_no_id_user_module',
        password: 'Password123!',
        email: 'teacher_no_id_user_module@example.com',
        role: 'teacher',
        firstName: '教师',
        lastName: '缺ID',
        teacherDetails: {
          subjectsTaught: ['Art']
        }
      };
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(userData);
      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toMatch(/teacherDetails.teacherIdNumber is required/);
    });
  });

  // 测试更新用户
  describe('PATCH /api/users/:userId', () => {
    it('管理员应该能够更新任何用户 (例如，更新学生信息)', async () => {
      const updateData = {
        firstName: '更新的',
        lastName: '学生甲',
        email: 'updated_student_user_module@example.com',
        studentDetails: {
          grade: '6',
          studentClass: 'A'
        }
      };

      const response = await request(app)
        .patch(`/api/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.user.firstName).toBe(updateData.firstName);
      expect(response.body.data.user.email).toBe(updateData.email);
      expect(response.body.data.user.studentDetails.grade).toBe(updateData.studentDetails.grade);
      expect(response.body.data.user.studentDetails.studentClass).toBe(updateData.studentDetails.studentClass);
    });

    it('用户应该能够更新自己的信息 (例如，学生更新自己的姓氏)', async () => {
      const updateData = {
        lastName: '学生乙已更新',
      };

      const response = await request(app)
        .patch(`/api/users/${studentUser._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.user.lastName).toBe(updateData.lastName);
    });
    
    it('家长应该能够更新自己的信息', async () => {
      const updateData = {
        firstName: "家长已更新",
      };
      const response = await request(app)
        .patch(`/api/users/${parentUser._id}`)
        .set('Authorization', `Bearer ${parentToken}`)
        .send(updateData);
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.user.firstName).toBe(updateData.firstName);
    });

    it('家长不应该能够更新其孩子的信息 (路由层面)', async () => {
      const childId = parentUser.parentDetails.children[0];
      const updateData = { firstName: "孩子被家长更新" };
      const response = await request(app)
        .patch(`/api/users/${childId}`)
        .set('Authorization', `Bearer ${parentToken}`)
        .send(updateData);
      expect(response.status).toBe(403);
      expect(response.body.status).toBe('error');
    });

    it('用户不应该能够更新其他用户的信息', async () => {
      const updateData = { name: '尝试更新教师' };
      const response = await request(app)
        .patch(`/api/users/${teacherUser._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ firstName: '尝试更新教师First', lastName: '尝试更新教师Last' });

      expect(response.status).toBe(403);
      expect(response.body.status).toBe('error');
    });

    it('更新用户时不应允许修改角色', async () => {
      const updateData = { role: 'admin' };
      const response = await request(app)
        .patch(`/api/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.data.user.role).toBe('student');
    });
    
    it('更新用户时，如果提供了密码字段，密码应该被更新', async () => {
      const updateData = {
        password: 'newPassword123!'
      };
      const response = await request(app)
        .patch(`/api/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser_to_modify',
          password: 'newPassword123!'
        });
      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.data.token).toBeDefined();
    });

    it('用户自己更新密码时，需要提供旧密码 (此逻辑在 /api/auth/change-password，此处是管理员更新，不需要旧密码)', async () => {
      const updateData = { password: 'newPasswordForSelf123!' };
      const response = await request(app)
        .patch(`/api/users/${studentUser._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send(updateData);
      
      expect(response.status).toBe(200);
      
      const loginResponseOldPwd = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'teststudent_user_module',
          password: 'Password123!' 
        });
      expect(loginResponseOldPwd.status).toBe(200);

      const loginResponseNewPwd = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'teststudent_user_module',
          password: 'newPasswordForSelf123!' 
        });
      expect(loginResponseNewPwd.status).toBe(401);
    });
  });

  // 测试删除用户
  describe('DELETE /api/users/:userId', () => {
    it('管理员应该能够删除任何用户', async () => {
      let userToDelete = await User.create({
        username: 'user_to_delete_admin',
        password: 'Password123!',
        email: 'user_to_delete_admin@example.com',
        role: 'student',
        firstName: '待删除',
        lastName: '用户A'
      });

      const response = await request(app)
        .delete(`/api/users/${userToDelete._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(204);

      const deletedUser = await User.findById(userToDelete._id);
      expect(deletedUser).toBeNull();
    });

    it('非管理员不应该能够删除用户', async () => {
      let userNotToDelete = await User.create({
        username: 'user_not_to_delete_teacher',
        password: 'Password123!',
        email: 'user_not_to_delete_teacher@example.com',
        role: 'student',
        firstName: '不应删除',
        lastName: '用户B'
      });
      const response = await request(app)
        .delete(`/api/users/${userNotToDelete._id}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(response.status).toBe(403);
      expect(response.body.status).toBe('error');

      const stillExistsUser = await User.findById(userNotToDelete._id);
      expect(stillExistsUser).not.toBeNull();
    });

    it('用户不应该能够删除自己的账户 (通过此接口)', async () => {
      const response = await request(app)
        .delete(`/api/users/${studentUser._id}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(403);
      expect(response.body.status).toBe('error');
    });

    it('应该处理无效的用户ID (尝试删除不存在的用户)', async () => {
      const invalidId = '60f1a5c5f0e8e82b8c9e1234';
      const response = await request(app)
        .delete(`/api/users/${invalidId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.status).toBe('error');
    });
  });
});