const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Grade = require('../../models/Grade');

// 增加超时时间
jest.setTimeout(60000);

let mongoServer;

// 使用内存数据库进行测试
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Grade 模型测试', () => {
  beforeEach(async () => {
    await Grade.deleteMany({});
  });

  it('应该成功创建并保存成绩记录', async () => {
    const mockStudentId = new mongoose.Types.ObjectId();
    const mockSubjectId = new mongoose.Types.ObjectId();
    const mockClassId = new mongoose.Types.ObjectId();
    const mockTeacherId = new mongoose.Types.ObjectId();

    const gradeData = {
      student: mockStudentId,
      subject: mockSubjectId,
      class: mockClassId,
      type: 'exam',
      score: 85,
      totalScore: 100,
      date: new Date(),
      comments: '表现良好',
      recordedBy: mockTeacherId
    };

    const grade = new Grade(gradeData);
    const savedGrade = await grade.save();

    // 验证保存的数据
    expect(savedGrade._id).toBeDefined();
    expect(savedGrade.student.toString()).toBe(mockStudentId.toString());
    expect(savedGrade.subject.toString()).toBe(mockSubjectId.toString());
    expect(savedGrade.class.toString()).toBe(mockClassId.toString());
    expect(savedGrade.type).toBe('exam');
    expect(savedGrade.score).toBe(85);
    expect(savedGrade.totalScore).toBe(100);
    expect(savedGrade.comments).toBe('表现良好');
    expect(savedGrade.recordedBy.toString()).toBe(mockTeacherId.toString());
    expect(savedGrade.createdAt).toBeDefined();
  });

  it('缺少必填字段时应该验证失败', async () => {
    const invalidGrade = new Grade({
      // 缺少必填字段
      score: 85,
      totalScore: 100
    });

    let validationError;
    try {
      await invalidGrade.save();
    } catch (error) {
      validationError = error;
    }

    expect(validationError).toBeDefined();
    expect(validationError.name).toBe('ValidationError');
    expect(validationError.errors.student).toBeDefined();
    expect(validationError.errors.subject).toBeDefined();
    expect(validationError.errors.class).toBeDefined();
    expect(validationError.errors.type).toBeDefined();
    expect(validationError.errors.date).toBeDefined();
    expect(validationError.errors.recordedBy).toBeDefined();
  });

  it('应该正确验证枚举值', async () => {
    const mockStudentId = new mongoose.Types.ObjectId();
    const mockSubjectId = new mongoose.Types.ObjectId();
    const mockClassId = new mongoose.Types.ObjectId();
    const mockTeacherId = new mongoose.Types.ObjectId();

    const invalidGrade = new Grade({
      student: mockStudentId,
      subject: mockSubjectId,
      class: mockClassId,
      type: 'invalid_type', // 无效的枚举值
      score: 85,
      totalScore: 100,
      date: new Date(),
      recordedBy: mockTeacherId
    });

    let validationError;
    try {
      await invalidGrade.save();
    } catch (error) {
      validationError = error;
    }

    expect(validationError).toBeDefined();
    expect(validationError.name).toBe('ValidationError');
    expect(validationError.errors.type).toBeDefined();
  });

  it('应该正确计算百分比', async () => {
    const mockStudentId = new mongoose.Types.ObjectId();
    const mockSubjectId = new mongoose.Types.ObjectId();
    const mockClassId = new mongoose.Types.ObjectId();
    const mockTeacherId = new mongoose.Types.ObjectId();

    const grade = new Grade({
      student: mockStudentId,
      subject: mockSubjectId,
      class: mockClassId,
      type: 'exam',
      score: 85,
      totalScore: 100,
      date: new Date(),
      recordedBy: mockTeacherId
    });

    const savedGrade = await grade.save();

    // 验证百分比计算
    expect(savedGrade.percentage).toBe('85.00');

    // 修改分数并再次验证
    savedGrade.score = 75;
    await savedGrade.save();
    expect(savedGrade.percentage).toBe('75.00');
  });
});
