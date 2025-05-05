const request = require('supertest');
const mongoose = require('mongoose');
const analyticsApp = require('../../backend/services/analytics-service/server');
const dataApp = require('../../backend/services/data-service/server');
const homeworkApp = require('../../backend/services/homework-service/server');
const Grade = require('../../backend/services/data-service/models/Grade');
const Homework = require('../../backend/services/data-service/models/Homework');
const MistakeRecord = require('../../backend/services/data-service/models/MistakeRecord');

describe('学生学习流程集成测试', () => {
  let mockStudentId;
  let mockTeacherId;
  let mockClassId;
  let mockSubjectId;
  let mockHomeworkId;

  beforeAll(async () => {
    // 连接到测试数据库
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/test-integration-db', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    // 创建测试数据的ID
    mockStudentId = new mongoose.Types.ObjectId();
    mockTeacherId = new mongoose.Types.ObjectId();
    mockClassId = new mongoose.Types.ObjectId();
    mockSubjectId = new mongoose.Types.ObjectId();
    mockHomeworkId = new mongoose.Types.ObjectId();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // 清理测试数据
    await Grade.deleteMany({});
    await Homework.deleteMany({});
    await MistakeRecord.deleteMany({});
  });

  describe('完整学习周期', () => {
    it('应该能够完成从作业布置到成绩分析的完整流程', async () => {
      // 步骤1: 教师布置作业
      const homeworkData = {
        title: '数学练习',
        description: '完成第5章习题',
        subject: mockSubjectId,
        class: mockClassId,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 一周后
        createdBy: mockTeacherId
      };
      
      // 模拟教师身份
      const homeworkResponse = await request(homeworkApp)
        .post('/api/homework')
        .set('x-user-id', mockTeacherId.toString())
        .set('x-user-role', 'teacher')
        .send(homeworkData);
      
      expect(homeworkResponse.status).toBe(201);
      expect(homeworkResponse.body).toHaveProperty('homework');
      const homeworkId = homeworkResponse.body.homework._id;
      
      // 步骤2: 学生提交作业并记录错题
      const mistakeData = {
        student: mockStudentId,
        subject: mockSubjectId,
        question: '计算: 2x + 5 = 15, x = ?',
        correctAnswer: '5',
        studentAnswer: '6',
        analysis: '计算错误',
        tags: ['代数', '方程'],
        relatedHomework: homeworkId
      };
      
      // 模拟学生身份
      const mistakeResponse = await request(dataApp)
        .post('/api/data/mistake-record')
        .set('x-user-id', mockStudentId.toString())
        .set('x-user-role', 'student')
        .send(mistakeData);
      
      expect(mistakeResponse.status).toBe(201);
      expect(mistakeResponse.body).toHaveProperty('mistake');
      
      // 步骤3: 教师批改作业并录入成绩
      const gradeData = {
        student: mockStudentId,
        subject: mockSubjectId,
        class: mockClassId,
        type: 'homework',
        score: 85,
        totalScore: 100,
        date: new Date(),
        comments: '有几道题计算错误',
        recordedBy: mockTeacherId,
        relatedHomework: homeworkId
      };
      
      // 模拟教师身份
      const gradeResponse = await request(dataApp)
        .post('/api/data/grades')
        .set('x-user-id', mockTeacherId.toString())
        .set('x-user-role', 'teacher')
        .send(gradeData);
      
      expect(gradeResponse.status).toBe(201);
      expect(gradeResponse.body).toHaveProperty('grade');
      
      // 步骤4: 学生查看成绩
      const studentGradeResponse = await request(dataApp)
        .get(`/api/data/grades/student/${mockStudentId}`)
        .set('x-user-id', mockStudentId.toString())
        .set('x-user-role', 'student');
      
      expect(studentGradeResponse.status).toBe(200);
      expect(studentGradeResponse.body).toHaveProperty('grades');
      expect(studentGradeResponse.body.grades.length).toBe(1);
      expect(studentGradeResponse.body.grades[0].score).toBe(85);
      
      // 步骤5: 学生查看错题记录
      const mistakeRecordsResponse = await request(dataApp)
        .get('/api/data/mistake-record')
        .set('x-user-id', mockStudentId.toString())
        .set('x-user-role', 'student');
      
      expect(mistakeRecordsResponse.status).toBe(200);
      expect(mistakeRecordsResponse.body).toHaveProperty('mistakes');
      expect(mistakeRecordsResponse.body.mistakes.length).toBe(1);
      expect(mistakeRecordsResponse.body.mistakes[0].question).toBe('计算: 2x + 5 = 15, x = ?');
      
      // 步骤6: 学生查看学习进度分析
      const progressResponse = await request(analyticsApp)
        .get(`/api/analytics/progress/student/${mockStudentId}`)
        .query({ subject: '数学', period: 'semester' });
      
      expect(progressResponse.status).toBe(200);
      expect(progressResponse.body).toHaveProperty('studentId', mockStudentId.toString());
      expect(progressResponse.body).toHaveProperty('progressData');
    });
  });
});
