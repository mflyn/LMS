const request = require('supertest');
const mongoose = require('mongoose');
// const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../server');
const User = require('../models/User');
const Role = require('../models/Role');
// const jwt = require('jsonwebtoken');
// const config = require('../config');

// let mongoServer;

// 模拟认证中间件
// jest.mock('../middleware/auth', () => {
//   return {
//     authenticateToken: (req, res, next) => {
//       req.user = {
//         id: '5f7d7e9c8f3d4e001c123456',
//         role: 'admin'
//       };
//       next();
//     },
//     checkRole: (roles) => (req, res, next) => next()
//   };
// });

// beforeAll(async () => {
//   mongoServer = await MongoMemoryServer.create();
//   const mongoUri = mongoServer.getUri();
//   await mongoose.connect(mongoUri, {
//     useNewUrlParser: true,
//     useUnifiedTopology: true
//   });
// });

// beforeEach(async () => {
//   await User.deleteMany({});
//   await User.create([
//     {
//       name: '张三',
//       username: 'student1',
//       password: 'password123',
//       email: 'student1@example.com',
//       role: 'student',
//       grade: '三年级',
//       class: '1班',
//       studentId: '20230001'
//     },
//     {
//       name: '李四',
//       username: 'student2',
//       password: 'password123',
//       email: 'student2@example.com',
//       role: 'student',
//       grade: '三年级',
//       class: '2班',
//       studentId: '20230002'
//     },
//     {
//       name: '王五',
//       username: 'teacher1',
//       password: 'password123',
//       email: 'teacher1@example.com',
//       role: 'teacher'
//     }
//   ]);
// });

// afterAll(async () => {
//   await mongoose.disconnect();
//   await mongoServer.stop();
// });

describe('学生管理API测试', () => {
  let teacherToken;
  let adminToken;
  let studentUser1Id;
  let studentUser2Id;

  // 在所有测试开始前，创建必要的角色（如果它们不存在）
  beforeAll(async () => {
    const roles = ['student', 'teacher', 'admin', 'superadmin'];
    for (const roleName of roles) {
      const roleExists = await Role.findOne({ name: roleName });
      if (!roleExists) {
        await new Role({ name: roleName, description: `${roleName} role` }).save();
      }
    }
  });
  
  beforeEach(async () => {
    // 全局的 beforeEach 已经清理了数据库
    // 创建测试用户
    const teacherData = {
      name: '测试教师王',
      username: 'testteacher_students_api',
      password: 'password123',
      email: 'teacher_students_api@example.com',
      role: 'teacher',
      teacherIdNumber: 'T001STUDENTS'
    };
    const adminData = {
      name: '测试管理员李',
      username: 'testadmin_students_api',
      password: 'password123',
      email: 'admin_students_api@example.com',
      role: 'admin',
    };
    const student1Data = {
      name: '张三学生',
      username: 'student1_students_api',
      password: 'password123',
      email: 'student1_students_api@example.com',
      role: 'student',
      grade: '三年级',
      studentClass: '1班', // 新字段名
      studentIdNumber: 'S20230001' // 新字段名
    };
    const student2Data = {
      name: '李四学生',
      username: 'student2_students_api',
      password: 'password123',
      email: 'student2_students_api@example.com',
      role: 'student',
      grade: '三年级',
      studentClass: '2班', // 新字段名
      studentIdNumber: 'S20230002' // 新字段名
    };

    await User.create(teacherData);
    await User.create(adminData);
    const student1 = await User.create(student1Data);
    const student2 = await User.create(student2Data);
    studentUser1Id = student1._id;
    studentUser2Id = student2._id;

    // 登录以获取 token
    const teacherLoginResponse = await request(app)
      .post('/api/auth/login') // 假设 auth 路由在 user-service app 中
      .send({ username: teacherData.username, password: teacherData.password });
    teacherToken = teacherLoginResponse.body.data.token;

    const adminLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({ username: adminData.username, password: adminData.password });
    adminToken = adminLoginResponse.body.data.token;
  });

  describe('GET /api/students', () => {
    it('教师应该能够获取学生列表 (返回正确的字段名)', async () => {
      const response = await request(app)
        .get('/api/students')
        .set('Authorization', `Bearer ${teacherToken}`);
      
      expect(response.status).toBe(200);
      // 假设API返回的格式，如果您的API返回结构是 { code, message, data: { items, total } }
      // 请根据实际情况调整以下断言
      expect(response.body.data.items).toBeInstanceOf(Array);
      expect(response.body.data.items.length).toBeGreaterThanOrEqual(2);
      response.body.data.items.forEach(item => {
        expect(item.role).toBe('student');
        expect(item.studentClass).toBeDefined(); // 检查新字段名
        expect(item.studentIdNumber).toBeDefined(); // 检查新字段名
        expect(item.class).toBeUndefined(); // 确保旧字段名不存在
        expect(item.studentId).toBeUndefined(); // 确保旧字段名不存在
      });
    });

    it('管理员应该能够获取学生列表', async () => {
      const response = await request(app)
        .get('/api/students')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(response.status).toBe(200);
      expect(response.body.data.items.length).toBeGreaterThanOrEqual(2);
    });
    
    it('应该支持按班级筛选学生 (使用 studentClass)', async () => {
      const response = await request(app)
        .get('/api/students?studentClass=1班') // 使用新查询参数名
        .set('Authorization', `Bearer ${teacherToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.data.items.length).toBe(1);
      expect(response.body.data.items[0].name).toBe('张三学生');
      expect(response.body.data.items[0].studentClass).toBe('1班');
    });
    
    it('应该支持搜索功能 (例如按姓名)', async () => {
      const response = await request(app)
        .get('/api/students?search=李四学生')
        .set('Authorization', `Bearer ${teacherToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.data.items.length).toBe(1);
      expect(response.body.data.items[0].name).toBe('李四学生');
    });

    it('没有token或无效token的请求应该被拒绝', async () => {
      const response = await request(app).get('/api/students');
      expect(response.status).toBe(401); // 或 403，取决于中间件如何处理
    });
  });
  
  describe('GET /api/students/:id', () => {
    it('教师应该能够获取指定学生详情 (返回正确的字段名)', async () => {
      const response = await request(app)
        .get(`/api/students/${studentUser1Id}`)
        .set('Authorization', `Bearer ${teacherToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.data.name).toBe('张三学生');
      expect(response.body.data.studentClass).toBe('1班'); // 新字段名
      expect(response.body.data.studentIdNumber).toBe('S20230001'); // 新字段名
      expect(response.body.data.class).toBeUndefined(); // 旧字段名
      expect(response.body.data.studentId).toBeUndefined(); // 旧字段名
    });
    
    it('当学生ID无效或不存在时应该返回404', async () => {
      const invalidMongoId = new mongoose.Types.ObjectId().toString();
      const response = await request(app)
        .get(`/api/students/${invalidMongoId}`)
        .set('Authorization', `Bearer ${teacherToken}`);
      
      expect(response.status).toBe(404);
      // 调整期望的错误消息，如果您的API如此返回
      // expect(response.body.message).toMatch(/学生不存在|not found/i);
    });

    it('非教师或非管理员（如其他学生）不应获取学生详情（如果权限如此设定）', async () => {
      // 需要创建一个学生用户并获取其token
      const otherStudentData = { name: '路人甲学生', username: 'otherstudent_api', password: 'password123', email: 'otherstudent_api@example.com', role: 'student', grade: '二年级', studentClass: '3班', studentIdNumber: 'S900001' };
      await User.create(otherStudentData);
      const otherStudentLogin = await request(app).post('/api/auth/login').send({username: otherStudentData.username, password: otherStudentData.password});
      const otherStudentToken = otherStudentLogin.body.data.token;

      if(otherStudentToken) { // 确保获取到token
        const response = await request(app)
          .get(`/api/students/${studentUser1Id}`)
          .set('Authorization', `Bearer ${otherStudentToken}`);
        expect(response.status).toBe(403); // Forbidden
      } else {
        throw new Error("Failed to get token for otherStudent");
      }
    });
  });

  // TODO: 根据 student.js 路由中实际的 POST, PUT, DELETE 端点和权限，补充更多测试用例
  // 例如:
  // describe('POST /api/students', () => { ... }); // 如果允许通过此服务创建学生
  // describe('PUT /api/students/:id', () => { ... }); // 如果允许通过此服务更新学生
  // describe('DELETE /api/students/:id', () => { ... }); // 如果允许通过此服务删除学生
});