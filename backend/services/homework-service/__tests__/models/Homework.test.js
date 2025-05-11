const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Homework = require('../../models/Homework');

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

describe('Homework 模型测试', () => {
  beforeEach(async () => {
    await Homework.deleteMany({});
  });

  it('应该成功创建并保存作业记录', async () => {
    const mockTeacherId = new mongoose.Types.ObjectId();
    const mockSubjectId = new mongoose.Types.ObjectId();
    const mockClassId = new mongoose.Types.ObjectId();
    const mockStudentId = new mongoose.Types.ObjectId();

    const homeworkData = {
      title: '数学作业',
      description: '完成课本第15页的习题1-5',
      subject: mockSubjectId,
      class: mockClassId,
      assignedBy: mockTeacherId,
      assignedTo: [mockStudentId],
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 一周后
      status: 'assigned',
      attachments: ['/uploads/reference.pdf']
    };

    const homework = new Homework(homeworkData);
    const savedHomework = await homework.save();

    // 验证保存的数据
    expect(savedHomework._id).toBeDefined();
    expect(savedHomework.title).toBe('数学作业');
    expect(savedHomework.description).toBe('完成课本第15页的习题1-5');
    expect(savedHomework.subject.toString()).toBe(mockSubjectId.toString());
    expect(savedHomework.class.toString()).toBe(mockClassId.toString());
    expect(savedHomework.assignedBy.toString()).toBe(mockTeacherId.toString());
    expect(savedHomework.assignedTo.length).toBe(1);
    expect(savedHomework.assignedTo[0].toString()).toBe(mockStudentId.toString());
    expect(savedHomework.status).toBe('assigned');
    expect(savedHomework.attachments.length).toBe(1);
    expect(savedHomework.attachments[0]).toBe('/uploads/reference.pdf');
    expect(savedHomework.createdAt).toBeDefined();
    expect(savedHomework.updatedAt).toBeDefined();
  });

  it('缺少必填字段时应该验证失败', async () => {
    const invalidHomework = new Homework({
      // 缺少必填字段
      title: '数学作业',
      description: '完成课本第15页的习题1-5'
    });

    let validationError;
    try {
      await invalidHomework.save();
    } catch (error) {
      validationError = error;
    }

    expect(validationError).toBeDefined();
    expect(validationError.name).toBe('ValidationError');
    expect(validationError.errors.subject).toBeDefined();
    expect(validationError.errors.class).toBeDefined();
    expect(validationError.errors.assignedBy).toBeDefined();
    expect(validationError.errors.dueDate).toBeDefined();
  });

  it('应该正确验证枚举值', async () => {
    const mockTeacherId = new mongoose.Types.ObjectId();
    const mockSubjectId = new mongoose.Types.ObjectId();
    const mockClassId = new mongoose.Types.ObjectId();

    const invalidHomework = new Homework({
      title: '数学作业',
      description: '完成课本第15页的习题1-5',
      subject: mockSubjectId,
      class: mockClassId,
      assignedBy: mockTeacherId,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: 'invalid_status' // 无效的枚举值
    });

    let validationError;
    try {
      await invalidHomework.save();
    } catch (error) {
      validationError = error;
    }

    expect(validationError).toBeDefined();
    expect(validationError.name).toBe('ValidationError');
    expect(validationError.errors.status).toBeDefined();
  });

  it('应该使用默认状态', async () => {
    const mockTeacherId = new mongoose.Types.ObjectId();
    const mockSubjectId = new mongoose.Types.ObjectId();
    const mockClassId = new mongoose.Types.ObjectId();

    const homework = new Homework({
      title: '数学作业',
      description: '完成课本第15页的习题1-5',
      subject: mockSubjectId,
      class: mockClassId,
      assignedBy: mockTeacherId,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      // 不提供状态
    });

    const savedHomework = await homework.save();

    // 验证使用了默认状态
    expect(savedHomework.status).toBe('draft');
  });

  it('应该能够更新作业记录', async () => {
    const mockTeacherId = new mongoose.Types.ObjectId();
    const mockSubjectId = new mongoose.Types.ObjectId();
    const mockClassId = new mongoose.Types.ObjectId();

    const homework = new Homework({
      title: '数学作业',
      description: '完成课本第15页的习题1-5',
      subject: mockSubjectId,
      class: mockClassId,
      assignedBy: mockTeacherId,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: 'draft'
    });

    const savedHomework = await homework.save();

    // 更新作业记录
    savedHomework.title = '更新后的数学作业';
    savedHomework.status = 'assigned';
    const updatedHomework = await savedHomework.save();

    expect(updatedHomework.title).toBe('更新后的数学作业');
    expect(updatedHomework.status).toBe('assigned');
  });
});
