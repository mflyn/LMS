const request = require('supertest');
const mongoose = require('mongoose');
const resourceApp = require('../../services/resource-service/server');
const homeworkApp = require('../../services/homework-service/server');
const progressApp = require('../../services/progress-service/server');
const analyticsApp = require('../../services/analytics-service/server');

describe('跨服务集成测试', () => {
  let teacherId;
  let studentId;
  let resourceId;
  let homeworkId;
  
  beforeAll(async () => {
    // 创建测试ID
    teacherId = new mongoose.Types.ObjectId();
    studentId = new mongoose.Types.ObjectId();
  });
  
  afterAll(async () => {
    await mongoose.connection.close();
  });
  
  it('教师应该能够上传资源并创建相关作业', async () => {
    // 1. 上传资源
    const resourceResponse = await request(resourceApp)
      .post('/api/resources')
      .field('title', '数学练习题')
      .field('subject', '数学')
      .field('grade', '三年级')
      .field('type', '习题')
      .field('uploaderId', teacherId.toString());
    
    expect(resourceResponse.status).toBe(201);
    resourceId = resourceResponse.body.data._id;
    
    // 2. 创建作业并引用资源
    const homeworkResponse = await request(homeworkApp)
      .post('/api/homework')
      .send({
        title: '数学作业',
        description: '完成上传的数学练习题',
        subject: '数学',
        class: '三年级一班',
        assignedBy: teacherId,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'draft',
        resources: [resourceId] // 引用上传的资源
      });
    
    expect(homeworkResponse.status).toBe(201);
    homeworkId = homeworkResponse.body.data._id;
    
    // 3. 分配作业给学生
    const assignResponse = await request(homeworkApp)
      .post(`/api/homework/${homeworkId}/assign`)
      .send({
        studentIds: [studentId.toString()]
      });
    
    expect(assignResponse.status).toBe(200);
  });
  
  it('学生完成作业后应该更新进度记录', async () => {
    // 1. 学生提交作业
    const submitResponse = await request(homeworkApp)
      .post(`/api/homework/${homeworkId}/submit`)
      .send({
        studentId: studentId.toString(),
        content: '已完成所有习题',
        attachments: []
      });
    
    expect(submitResponse.status).toBe(200);
    
    // 2. 教师更新学生进度
    const headers = {
      'x-user-id': teacherId.toString(),
      'x-user-role': 'teacher'
    };
    
    const progressResponse = await request(progressApp)
      .post('/api/progress/update')
      .set(headers)
      .send({
        student: studentId,
        subject: '数学',
        chapter: '第一章',
        section: '1.1',
        completionRate: 100,
        status: 'completed',
        comments: '已完成作业'
      });
    
    expect(progressResponse.status).toBe(200);
    
    // 3. 验证学生进度已更新
    const getProgressResponse = await request(progressApp)
      .get(`/api/progress/${studentId}`)
      .set(headers);
    
    expect(getProgressResponse.status).toBe(200);
    expect(getProgressResponse.body.progress[0].completionRate).toBe(100);
    expect(getProgressResponse.body.progress[0].status).toBe('completed');
  });
  
  it('教师批改作业后应该更新分析数据', async () => {
    // 1. 教师批改作业
    const gradeResponse = await request(homeworkApp)
      .post(`/api/homework/${homeworkId}/grade`)
      .send({
        studentId: studentId.toString(),
        score: 90,
        feedback: '做得很好，但有一些小错误'
      });
    
    expect(gradeResponse.status).toBe(200);
    
    // 2. 添加性能数据到分析服务
    const performanceResponse = await request(analyticsApp)
      .post('/api/analytics/performance/add')
      .send({
        student: studentId,
        subject: '数学',
        performanceData: {
          date: new Date(),
          score: 90,
          assessmentType: 'homework'
        }
      });
    
    expect(performanceResponse.status).toBe(200);
    
    // 3. 获取学生的趋势分析
    const trendsResponse = await request(analyticsApp)
      .get(`/api/analytics/trends/student/${studentId}`);
    
    expect(trendsResponse.status).toBe(200);
    expect(trendsResponse.body).toHaveProperty('data');
    expect(trendsResponse.body.data).toHaveProperty('trends');
  });
  
  it('学生应该能够查看和收藏资源', async () => {
    // 1. 学生查看资源
    const resourceResponse = await request(resourceApp)
      .get(`/api/resources/${resourceId}`);
    
    expect(resourceResponse.status).toBe(200);
    
    // 2. 学生收藏资源
    const collectionResponse = await request(resourceApp)
      .post('/api/resources/collections')
      .send({
        user: studentId,
        resource: resourceId,
        collectionName: '学习资料',
        notes: '有用的数学练习题'
      });
    
    expect(collectionResponse.status).toBe(201);
    
    // 3. 获取学生的收藏列表
    const collectionsResponse = await request(resourceApp)
      .get(`/api/users/${studentId}/collections`);
    
    expect(collectionsResponse.status).toBe(200);
    expect(collectionsResponse.body).toHaveProperty('data');
    expect(collectionsResponse.body.data.length).toBe(1);
  });
  
  it('学生应该能够获取综合学习报告', async () => {
    // 获取学生的综合报告
    const reportResponse = await request(analyticsApp)
      .get(`/api/analytics/reports/student/${studentId}`);
    
    expect(reportResponse.status).toBe(200);
    expect(reportResponse.body).toHaveProperty('data');
    expect(reportResponse.body.data).toHaveProperty('strengths');
    expect(reportResponse.body.data).toHaveProperty('weaknesses');
    expect(reportResponse.body.data).toHaveProperty('recommendations');
  });
});
