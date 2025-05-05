const mongoose = require('mongoose');
const Progress = require('../../models/Progress');

// 使用内存数据库进行测试
beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/test-db', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe('Progress 模型测试', () => {
  beforeEach(async () => {
    await Progress.deleteMany({});
  });

  it('应该成功创建并保存进度记录', async () => {
    const mockStudentId = new mongoose.Types.ObjectId();
    const mockSubjectId = new mongoose.Types.ObjectId();
    const mockTeacherId = new mongoose.Types.ObjectId();
    
    const progressData = {
      student: mockStudentId,
      subject: mockSubjectId,
      chapter: '第一章',
      section: '1.1',
      completionRate: 75,
      status: 'in_progress',
      comments: '进展良好',
      createdBy: mockTeacherId,
      updatedBy: mockTeacherId
    };

    const progress = new Progress(progressData);
    const savedProgress = await progress.save();

    // 验证保存的数据
    expect(savedProgress._id).toBeDefined();
    expect(savedProgress.student.toString()).toBe(mockStudentId.toString());
    expect(savedProgress.subject.toString()).toBe(mockSubjectId.toString());
    expect(savedProgress.chapter).toBe('第一章');
    expect(savedProgress.section).toBe('1.1');
    expect(savedProgress.completionRate).toBe(75);
    expect(savedProgress.status).toBe('in_progress');
    expect(savedProgress.comments).toBe('进展良好');
    expect(savedProgress.createdBy.toString()).toBe(mockTeacherId.toString());
    expect(savedProgress.updatedBy.toString()).toBe(mockTeacherId.toString());
    expect(savedProgress.createdAt).toBeDefined();
    expect(savedProgress.updatedAt).toBeDefined();
  });

  it('缺少必填字段时应该验证失败', async () => {
    const invalidProgress = new Progress({
      // 缺少必填字段
      chapter: '第一章',
      section: '1.1',
      completionRate: 75
    });

    let validationError;
    try {
      await invalidProgress.save();
    } catch (error) {
      validationError = error;
    }

    expect(validationError).toBeDefined();
    expect(validationError.name).toBe('ValidationError');
    expect(validationError.errors.student).toBeDefined();
    expect(validationError.errors.subject).toBeDefined();
    expect(validationError.errors.createdBy).toBeDefined();
    expect(validationError.errors.updatedBy).toBeDefined();
  });

  it('应该正确验证枚举值', async () => {
    const mockStudentId = new mongoose.Types.ObjectId();
    const mockSubjectId = new mongoose.Types.ObjectId();
    const mockTeacherId = new mongoose.Types.ObjectId();
    
    const invalidProgress = new Progress({
      student: mockStudentId,
      subject: mockSubjectId,
      chapter: '第一章',
      section: '1.1',
      completionRate: 75,
      status: 'invalid_status', // 无效的枚举值
      createdBy: mockTeacherId,
      updatedBy: mockTeacherId
    });

    let validationError;
    try {
      await invalidProgress.save();
    } catch (error) {
      validationError = error;
    }

    expect(validationError).toBeDefined();
    expect(validationError.name).toBe('ValidationError');
    expect(validationError.errors.status).toBeDefined();
  });

  it('应该验证完成率范围', async () => {
    const mockStudentId = new mongoose.Types.ObjectId();
    const mockSubjectId = new mongoose.Types.ObjectId();
    const mockTeacherId = new mongoose.Types.ObjectId();
    
    const invalidProgress = new Progress({
      student: mockStudentId,
      subject: mockSubjectId,
      chapter: '第一章',
      section: '1.1',
      completionRate: 110, // 超出范围
      status: 'in_progress',
      createdBy: mockTeacherId,
      updatedBy: mockTeacherId
    });

    let validationError;
    try {
      await invalidProgress.save();
    } catch (error) {
      validationError = error;
    }

    expect(validationError).toBeDefined();
    expect(validationError.name).toBe('ValidationError');
    expect(validationError.errors.completionRate).toBeDefined();
  });

  it('应该能够更新进度记录', async () => {
    const mockStudentId = new mongoose.Types.ObjectId();
    const mockSubjectId = new mongoose.Types.ObjectId();
    const mockTeacherId = new mongoose.Types.ObjectId();
    
    const progress = new Progress({
      student: mockStudentId,
      subject: mockSubjectId,
      chapter: '第一章',
      section: '1.1',
      completionRate: 75,
      status: 'in_progress',
      createdBy: mockTeacherId,
      updatedBy: mockTeacherId
    });

    const savedProgress = await progress.save();
    
    // 更新进度记录
    savedProgress.completionRate = 100;
    savedProgress.status = 'completed';
    savedProgress.comments = '已完成';
    const updatedProgress = await savedProgress.save();
    
    expect(updatedProgress.completionRate).toBe(100);
    expect(updatedProgress.status).toBe('completed');
    expect(updatedProgress.comments).toBe('已完成');
  });
});
