const mongoose = require('mongoose');
// const { MongoMemoryServer } = require('mongodb-memory-server'); // 由全局配置处理
const Homework = require('../../models/Homework');

// let mongoServer; // 由全局配置处理

const mockStudentId1 = new mongoose.Types.ObjectId();
const mockStudentId2 = new mongoose.Types.ObjectId();
const mockTeacherId = new mongoose.Types.ObjectId();

const baseHomeworkData = {
  title: '第六单元测试',
  subject: '数学',
  description: '完成第六单元所有习题',
  grade: '五年级',
  assignedTo: [mockStudentId1],
  createdBy: mockTeacherId,
  dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 天后
  status: 'assigned',
  originalAttachments: [{
    fileName: 'unit6_questions.pdf',
    filePath: '/uploads/homework/unit6_questions.pdf',
    fileType: 'application/pdf',
    fileSize: 102400
  }]
};

// beforeAll(async () => { // 由全局配置处理
//   mongoServer = await MongoMemoryServer.create();
//   const mongoUri = mongoServer.getUri();
//   await mongoose.connect(mongoUri);
// });

// afterAll(async () => { // 由全局配置处理
//   await mongoose.disconnect();
//   await mongoServer.stop();
// });

// beforeEach(async () => { // 这个 beforeEach 由 __tests__/setup.js 中的全局 beforeEach 处理，如果内容相同则可移除
//   await Homework.deleteMany({}); // 清理逻辑已在 setup.js 中统一处理
// });

describe('Homework Model', () => {
  it('should create and save a homework successfully', async () => {
    const homework = new Homework(baseHomeworkData);
    const savedHomework = await homework.save();

    expect(savedHomework._id).toBeDefined();
    expect(savedHomework.title).toBe(baseHomeworkData.title);
    expect(savedHomework.subject).toBe(baseHomeworkData.subject);
    expect(savedHomework.description).toBe(baseHomeworkData.description);
    expect(savedHomework.grade).toBe(baseHomeworkData.grade);
    expect(savedHomework.assignedTo.length).toBe(1);
    expect(savedHomework.assignedTo[0].toString()).toBe(mockStudentId1.toString());
    expect(savedHomework.createdBy.toString()).toBe(mockTeacherId.toString());
    expect(savedHomework.dueDate).toEqual(baseHomeworkData.dueDate);
    expect(savedHomework.status).toBe('assigned');
    expect(savedHomework.originalAttachments.length).toBe(1);
    expect(savedHomework.originalAttachments[0].fileName).toBe('unit6_questions.pdf');
    expect(savedHomework.submissionAttachments.length).toBe(0); // 默认应为空
  });

  describe('Required Fields Validation', () => {
    const requiredFields = ['title', 'subject', 'grade', 'assignedTo', 'createdBy', 'dueDate', 'status'];
    // 'description' 通常也是必须的，但根据您的模型定义可能不同

    requiredFields.forEach(field => {
      it(`should fail if ${field} is missing`, async () => {
        const homeworkData = { ...baseHomeworkData };
        delete homeworkData[field];
        
        // 特殊处理 assignedTo，因为它是一个数组，需要确保它是 undefined 或空数组来触发验证
        if (field === 'assignedTo') {
            homeworkData.assignedTo = [];
        }


        const homework = new Homework(homeworkData);
        let err;
        try {
          await homework.save();
        } catch (error) {
          err = error;
        }
        expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
        if (field === 'assignedTo') {
          // Mongoose 对于空数组的 required 验证可能需要特定检查
          // 或者模型中对 assignedTo 有 minLength: 1 的验证
           expect(err.errors[field] || err.errors['assignedTo.0']).toBeDefined();
        } else {
           expect(err.errors[field]).toBeDefined();
        }
      });
    });

    it('should fail if assignedTo is an empty array (if model requires at least one student)', async () => {
        const homeworkData = { ...baseHomeworkData, assignedTo: [] };
        const homework = new Homework(homeworkData);
        let err;
        try {
          await homework.save();
        } catch (error) {
          err = error;
        }
        expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
        // 假设模型定义中 assignedTo: { type: [mongoose.Schema.Types.ObjectId], required: true, validate: [v => Array.isArray(v) && v.length > 0, 'assignedTo must not be empty'] }
        // 或者  assignedTo: { type: [mongoose.Schema.Types.ObjectId], required: true, default: undefined, minlength: 1 }
        expect(err.errors.assignedTo).toBeDefined();
    });
  });

  describe('Timestamps', () => {
    it('should have createdAt and updatedAt fields upon creation', async () => {
      const homework = new Homework(baseHomeworkData);
      const savedHomework = await homework.save();
      expect(savedHomework.createdAt).toBeDefined();
      expect(savedHomework.updatedAt).toBeDefined();
    });

    it('should update updatedAt field upon saving an existing document', async () => {
      const homework = new Homework(baseHomeworkData);
      const savedHomework = await homework.save();
      const initialUpdatedAt = savedHomework.updatedAt;

      await new Promise(resolve => setTimeout(resolve, 10)); // 确保时间有变化

      savedHomework.title = '新的单元测试标题';
      const updatedHomework = await savedHomework.save();

      expect(updatedHomework.updatedAt).toBeDefined();
      expect(updatedHomework.updatedAt.getTime()).toBeGreaterThan(initialUpdatedAt.getTime());
    });
  });

  describe('Status Enum Validation', () => {
    const validStatuses = ['assigned', 'submitted', 'pending_review', 'reviewing', 'completed', 'archived', 'resubmitted'];
    validStatuses.forEach(status => {
      it(`should accept valid status: ${status}`, async () => {
        const homework = new Homework({ ...baseHomeworkData, status: status });
        const savedHomework = await homework.save();
        expect(savedHomework.status).toBe(status);
      });
    });

    it('should reject an invalid status (e.g., "in_progress")', async () => {
      const homework = new Homework({ ...baseHomeworkData, status: 'in_progress' }); // 'in_progress' 已移除
      let err;
      try {
        await homework.save();
      } catch (error) {
        err = error;
      }
      expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
      expect(err.errors.status).toBeDefined();
    });
      
    it('should reject a completely random invalid status', async () => {
      const homework = new Homework({ ...baseHomeworkData, status: 'random_invalid_status' });
      let err;
      try {
        await homework.save();
      } catch (error) {
        err = error;
      }
      expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
      expect(err.errors.status).toBeDefined();
    });
  });

  describe('Attachments', () => {
    const sampleAttachment1 = { fileName: 'instruction.docx', filePath: '/docs/instruction.docx', fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', fileSize: 20480 };
    const sampleAttachment2 = { fileName: 'image.png', filePath: '/img/image.png', fileType: 'image/png', fileSize: 51200 };

    it('should save originalAttachments correctly with multiple attachments', async () => {
      const homework = new Homework({ ...baseHomeworkData, originalAttachments: [sampleAttachment1, sampleAttachment2] });
      const savedHomework = await homework.save();
      expect(savedHomework.originalAttachments.length).toBe(2);
      expect(savedHomework.originalAttachments[0].fileName).toBe(sampleAttachment1.fileName);
      expect(savedHomework.originalAttachments[1].filePath).toBe(sampleAttachment2.filePath);
    });

    it('should save submissionAttachments correctly', async () => {
      const homework = new Homework({ ...baseHomeworkData, submissionAttachments: [sampleAttachment1] });
      const savedHomework = await homework.save();
      expect(savedHomework.submissionAttachments.length).toBe(1);
      expect(savedHomework.submissionAttachments[0].fileName).toBe(sampleAttachment1.fileName);
    });

    it('should allow empty originalAttachments and submissionAttachments', async () => {
      const homeworkData = { ...baseHomeworkData };
      delete homeworkData.originalAttachments; // 测试模型是否正确处理 undefined
      
      const homework = new Homework({ ...homeworkData, submissionAttachments: [] });
      const savedHomework = await homework.save();
      expect(savedHomework.originalAttachments.length).toBe(0);
      expect(savedHomework.submissionAttachments.length).toBe(0);
    });
  });

  describe('Class Field Removal', () => {
    it('should not save the class field even if provided in input data', async () => {
      const homeworkDataWithClass = {
        ...baseHomeworkData,
        class: '五年级一班' // 尝试提供已移除的字段
      };
      const homework = new Homework(homeworkDataWithClass);
      const savedHomework = await homework.save();
      
      expect(savedHomework.class).toBeUndefined(); // 验证该字段未被保存
      // 也可以转换为普通对象检查
      const homeworkObject = savedHomework.toObject();
      expect(homeworkObject.class).toBeUndefined();
    });
  });

  describe('AssignedTo Field', () => {
    it('should accept an array of multiple student ObjectIds for assignedTo', async () => {
      const studentIds = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
      const homework = new Homework({ ...baseHomeworkData, assignedTo: studentIds });
      const savedHomework = await homework.save();
      expect(savedHomework.assignedTo.length).toBe(3);
      expect(savedHomework.assignedTo.map(id => id.toString())).toEqual(studentIds.map(id => id.toString()));
    });
  });
  
  // 你可以根据 Homework 模型的其他字段和逻辑添加更多测试用例
  // 例如，如果 description 是必填的，或者有最小/最大长度限制等
}); 