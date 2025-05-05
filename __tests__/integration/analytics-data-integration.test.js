const request = require('supertest');
const mongoose = require('mongoose');
const analyticsApp = require('../../backend/services/analytics-service/server');
const dataApp = require('../../backend/services/data-service/server');
const Grade = require('../../backend/services/data-service/models/Grade');
const StudentPerformanceTrend = require('../../backend/services/analytics-service/models/StudentPerformanceTrend');

describe('分析服务和数据服务集成测试', () => {
  let mockStudentId;
  let mockSubjectId;
  let mockClassId;
  let mockTeacherId;

  beforeAll(async () => {
    // 连接到测试数据库
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/test-integration-db', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    // 创建测试数据的ID
    mockStudentId = new mongoose.Types.ObjectId();
    mockSubjectId = new mongoose.Types.ObjectId();
    mockClassId = new mongoose.Types.ObjectId();
    mockTeacherId = new mongoose.Types.ObjectId();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // 清理测试数据
    await Grade.deleteMany({});
    await StudentPerformanceTrend.deleteMany({});
  });

  describe('学生成绩分析流程', () => {
    it('应该能够在数据服务中录入成绩并在分析服务中查看分析结果', async () => {
      // 步骤1: 在数据服务中录入成绩
      const gradeData = {
        student: mockStudentId,
        subject: mockSubjectId,
        class: mockClassId,
        type: 'exam',
        score: 85,
        totalScore: 100,
        date: new Date(),
        comments: '期中考试',
        recordedBy: mockTeacherId
      };
      
      // 模拟教师身份
      const gradeResponse = await request(dataApp)
        .post('/api/data/grades')
        .set('x-user-id', mockTeacherId.toString())
        .set('x-user-role', 'teacher')
        .send(gradeData);
      
      expect(gradeResponse.status).toBe(201);
      expect(gradeResponse.body).toHaveProperty('grade');
      
      // 步骤2: 创建学生表现趋势数据
      const performanceTrendData = {
        student: mockStudentId,
        academicYear: '2023-2024',
        semester: '第一学期',
        subjectTrends: [
          {
            subject: '数学',
            scores: [
              {
                date: new Date(),
                score: 85,
                testType: '期中考试'
              }
            ],
            averageScore: 85,
            trend: '稳定',
            improvementRate: 0
          }
        ]
      };
      
      const performanceTrend = new StudentPerformanceTrend(performanceTrendData);
      await performanceTrend.save();
      
      // 步骤3: 在分析服务中查询学生进度分析
      const analyticsResponse = await request(analyticsApp)
        .get(`/api/analytics/progress/student/${mockStudentId}`)
        .query({ subject: '数学', period: 'semester' });
      
      expect(analyticsResponse.status).toBe(200);
      expect(analyticsResponse.body).toHaveProperty('studentId', mockStudentId.toString());
      expect(analyticsResponse.body).toHaveProperty('progressData');
      expect(analyticsResponse.body.progressData).toHaveProperty('数学');
      
      // 验证分析数据
      const mathData = analyticsResponse.body.progressData['数学'];
      expect(mathData).toHaveProperty('scores');
      expect(mathData).toHaveProperty('averageScore', 85);
      expect(mathData).toHaveProperty('trend', '稳定');
    });
    
    it('应该能够在数据服务中批量录入成绩并在分析服务中查看班级对比分析', async () => {
      // 步骤1: 在数据服务中批量录入班级成绩
      const batchGradeData = {
        grades: [
          {
            student: new mongoose.Types.ObjectId(),
            subject: mockSubjectId,
            class: mockClassId,
            type: 'exam',
            score: 80,
            totalScore: 100,
            date: new Date(),
            recordedBy: mockTeacherId
          },
          {
            student: new mongoose.Types.ObjectId(),
            subject: mockSubjectId,
            class: mockClassId,
            type: 'exam',
            score: 90,
            totalScore: 100,
            date: new Date(),
            recordedBy: mockTeacherId
          },
          {
            student: new mongoose.Types.ObjectId(),
            subject: mockSubjectId,
            class: mockClassId,
            type: 'exam',
            score: 75,
            totalScore: 100,
            date: new Date(),
            recordedBy: mockTeacherId
          }
        ]
      };
      
      // 模拟教师身份
      const batchResponse = await request(dataApp)
        .post('/api/data/grades/batch')
        .set('x-user-id', mockTeacherId.toString())
        .set('x-user-role', 'teacher')
        .send(batchGradeData);
      
      expect(batchResponse.status).toBe(201);
      expect(batchResponse.body).toHaveProperty('message', '成功录入3条成绩记录');
      
      // 步骤2: 在分析服务中查询班级对比分析
      const classAnalyticsResponse = await request(analyticsApp)
        .get(`/api/analytics/progress/class/${mockClassId}/comparison`)
        .query({ subject: '数学', period: 'semester' });
      
      expect(classAnalyticsResponse.status).toBe(200);
      expect(classAnalyticsResponse.body).toHaveProperty('classId', mockClassId.toString());
      expect(classAnalyticsResponse.body).toHaveProperty('subject', '数学');
      expect(classAnalyticsResponse.body).toHaveProperty('scoreDistribution');
      expect(classAnalyticsResponse.body).toHaveProperty('knowledgePoints');
      expect(classAnalyticsResponse.body).toHaveProperty('trendData');
    });
  });
});
