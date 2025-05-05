const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server');
const Homework = require('../../models/Homework');

describe('作业服务集成测试', () => {
  let teacherId;
  let classId;
  let subjectId;
  let studentIds = [];
  let homeworkId;
  
  beforeAll(async () => {
    // 创建测试ID
    teacherId = new mongoose.Types.ObjectId();
    classId = new mongoose.Types.ObjectId();
    subjectId = new mongoose.Types.ObjectId();
    
    // 创建多个学生ID
    for (let i = 0; i < 3; i++) {
      studentIds.push(new mongoose.Types.ObjectId());
    }
    
    // 清理测试数据
    await Homework.deleteMany({});
  });
  
  afterAll(async () => {
    await mongoose.connection.close();
  });
  
  it('教师应该能够创建作业', async () => {
    const response = await request(app)
      .post('/api/homework')
      .send({
        title: '数学作业',
        description: '完成课本第15页的习题1-5',
        subject: subjectId,
        class: classId,
        assignedBy: teacherId,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 一周后
        status: 'draft'
      });
    
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('message', '作业创建成功');
    expect(response.body).toHaveProperty('data');
    
    homeworkId = response.body.data._id;
  });
  
  it('教师应该能够分配作业给学生', async () => {
    const response = await request(app)
      .post(`/api/homework/${homeworkId}/assign`)
      .send({
        studentIds: studentIds.map(id => id.toString())
      });
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('message', '作业分配成功');
    expect(response.body).toHaveProperty('data');
    expect(response.body.data.status).toBe('assigned');
    expect(response.body.data.assignedTo.length).toBe(studentIds.length);
  });
  
  it('应该能够获取作业列表', async () => {
    const response = await request(app)
      .get('/api/homework');
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('data');
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBe(1);
    expect(response.body.data[0].title).toBe('数学作业');
  });
  
  it('应该能够获取单个作业详情', async () => {
    const response = await request(app)
      .get(`/api/homework/${homeworkId}`);
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('data');
    expect(response.body.data._id).toBe(homeworkId);
    expect(response.body.data.title).toBe('数学作业');
  });
  
  it('教师应该能够更新作业', async () => {
    const response = await request(app)
      .put(`/api/homework/${homeworkId}`)
      .send({
        title: '更新后的数学作业',
        description: '完成课本第15-16页的习题1-10',
        subject: subjectId,
        class: classId,
        assignedBy: teacherId,
        dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 十天后
        status: 'assigned'
      });
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('message', '作业更新成功');
    expect(response.body).toHaveProperty('data');
    expect(response.body.data.title).toBe('更新后的数学作业');
  });
  
  it('学生应该能够提交作业', async () => {
    const studentId = studentIds[0];
    
    const response = await request(app)
      .post(`/api/homework/${homeworkId}/submit`)
      .send({
        studentId: studentId.toString(),
        content: '已完成所有习题',
        attachments: [
          {
            name: '作业.pdf',
            path: '/uploads/homework.pdf',
            type: 'application/pdf'
          }
        ]
      });
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('message', '作业提交成功');
    
    // 验证作业状态已更新
    const getResponse = await request(app)
      .get(`/api/homework/${homeworkId}/submissions/${studentId}`);
    
    expect(getResponse.status).toBe(200);
    expect(getResponse.body).toHaveProperty('data');
    expect(getResponse.body.data.content).toBe('已完成所有习题');
  });
  
  it('教师应该能够批改作业', async () => {
    const studentId = studentIds[0];
    
    const response = await request(app)
      .post(`/api/homework/${homeworkId}/grade`)
      .send({
        studentId: studentId.toString(),
        score: 90,
        feedback: '做得很好，但有一些小错误'
      });
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('message', '作业批改成功');
    
    // 验证批改结果
    const getResponse = await request(app)
      .get(`/api/homework/${homeworkId}/submissions/${studentId}`);
    
    expect(getResponse.status).toBe(200);
    expect(getResponse.body).toHaveProperty('data');
    expect(getResponse.body.data.score).toBe(90);
    expect(getResponse.body.data.feedback).toBe('做得很好，但有一些小错误');
  });
  
  it('教师应该能够删除作业', async () => {
    const response = await request(app)
      .delete(`/api/homework/${homeworkId}`);
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('message', '作业删除成功');
    
    // 验证作业已被删除
    const getResponse = await request(app)
      .get(`/api/homework/${homeworkId}`);
    
    expect(getResponse.status).toBe(404);
  });
});
