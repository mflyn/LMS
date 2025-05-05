const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server');
const Progress = require('../../models/Progress');

describe('进度服务集成测试', () => {
  let studentId;
  let teacherId;
  let subjectId;
  
  beforeAll(async () => {
    // 创建测试ID
    studentId = new mongoose.Types.ObjectId();
    teacherId = new mongoose.Types.ObjectId();
    subjectId = new mongoose.Types.ObjectId();
    
    // 清理测试数据
    await Progress.deleteMany({});
  });
  
  afterAll(async () => {
    await mongoose.connection.close();
  });
  
  it('教师应该能够创建和更新学生进度', async () => {
    // 模拟教师认证
    const headers = {
      'x-user-id': teacherId.toString(),
      'x-user-role': 'teacher'
    };
    
    // 创建学生进度
    const createResponse = await request(app)
      .post('/api/progress/update')
      .set(headers)
      .send({
        student: studentId,
        subject: subjectId,
        chapter: '第一章',
        section: '1.1',
        completionRate: 75,
        status: 'in_progress',
        comments: '进展良好'
      });
    
    expect(createResponse.status).toBe(200);
    expect(createResponse.body).toHaveProperty('message', '学习进度已更新');
    
    // 更新学生进度
    const updateResponse = await request(app)
      .post('/api/progress/update')
      .set(headers)
      .send({
        student: studentId,
        subject: subjectId,
        chapter: '第一章',
        section: '1.2',
        completionRate: 85,
        status: 'in_progress',
        comments: '进展更好了'
      });
    
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body).toHaveProperty('message', '学习进度已更新');
    expect(updateResponse.body.progress.section).toBe('1.2');
    expect(updateResponse.body.progress.completionRate).toBe(85);
  });
  
  it('学生应该能够查看自己的进度', async () => {
    // 模拟学生认证
    const headers = {
      'x-user-id': studentId.toString(),
      'x-user-role': 'student'
    };
    
    // 查看进度
    const response = await request(app)
      .get(`/api/progress/${studentId}`)
      .set(headers);
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('progress');
    expect(Array.isArray(response.body.progress)).toBe(true);
    expect(response.body.progress.length).toBe(1);
    expect(response.body.progress[0].chapter).toBe('第一章');
    expect(response.body.progress[0].section).toBe('1.2');
  });
  
  it('学生不应该能够查看其他学生的进度', async () => {
    // 创建另一个学生ID
    const anotherStudentId = new mongoose.Types.ObjectId();
    
    // 模拟学生认证
    const headers = {
      'x-user-id': anotherStudentId.toString(),
      'x-user-role': 'student'
    };
    
    // 尝试查看其他学生的进度
    const response = await request(app)
      .get(`/api/progress/${studentId}`)
      .set(headers);
    
    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty('message', '权限不足');
  });
  
  it('教师应该能够查看所有学生的进度', async () => {
    // 模拟教师认证
    const headers = {
      'x-user-id': teacherId.toString(),
      'x-user-role': 'teacher'
    };
    
    // 查看学生进度
    const response = await request(app)
      .get(`/api/progress/${studentId}`)
      .set(headers);
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('progress');
    expect(Array.isArray(response.body.progress)).toBe(true);
  });
  
  it('教师应该能够批量更新多个学生的进度', async () => {
    // 创建多个学生ID
    const studentIds = [
      new mongoose.Types.ObjectId(),
      new mongoose.Types.ObjectId()
    ];
    
    // 模拟教师认证
    const headers = {
      'x-user-id': teacherId.toString(),
      'x-user-role': 'teacher'
    };
    
    // 批量更新进度
    const batchUpdateResponse = await request(app)
      .post('/api/progress/batch-update')
      .set(headers)
      .send({
        students: studentIds.map(id => id.toString()),
        subject: subjectId,
        chapter: '第二章',
        section: '2.1',
        completionRate: 50,
        status: 'in_progress',
        comments: '新章节开始'
      });
    
    expect(batchUpdateResponse.status).toBe(200);
    expect(batchUpdateResponse.body).toHaveProperty('message', '批量更新成功');
    expect(batchUpdateResponse.body).toHaveProperty('updatedCount', 2);
    
    // 验证更新结果
    for (const id of studentIds) {
      const checkResponse = await request(app)
        .get(`/api/progress/${id}`)
        .set(headers);
      
      expect(checkResponse.status).toBe(200);
      expect(checkResponse.body.progress[0].chapter).toBe('第二章');
      expect(checkResponse.body.progress[0].section).toBe('2.1');
    }
  });
});
