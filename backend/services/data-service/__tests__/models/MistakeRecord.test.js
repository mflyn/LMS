const mongoose = require('mongoose');
// const { MongoMemoryServer } = require('mongodb-memory-server'); // 由全局配置处理
const MistakeRecord = require('../../models/MistakeRecord');

// let mongoServer; // 由全局配置处理

const mockStudentId = new mongoose.Types.ObjectId();
const mockTeacherId = new mongoose.Types.ObjectId(); // For createdBy
const mockUpdatedById = new mongoose.Types.ObjectId(); // For updatedBy

const baseMistakeData = {
  student: mockStudentId,
  subject: '物理',
  grade: '九年级',
  question: '请解释牛顿第二定律及其公式。',
  answer: 'F=ma',
  analysis: '学生混淆了力和加速度的矢量性。', // 原 comments
  tags: ['牛顿定律', '力学'], // 原 knowledgePoints
  source: '课堂测验',
  status: 'pending_review',
  createdBy: mockTeacherId, // 原 recordedBy
  updatedBy: mockUpdatedById,
  errorType: '概念混淆',
  difficulty: '中等',
  attachments: [{
    fileName: 'question_snapshot.png',
    filePath: '/uploads/mistakes/question_snapshot.png',
    fileType: 'image/png',
    fileSize: 51200
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

// beforeEach(async () => { // 清理逻辑已在 setup.js 中统一处理
//   await MistakeRecord.deleteMany({});
// });

describe('MistakeRecord Model', () => {
  it('should create and save a mistake record successfully', async () => {
    const mistake = new MistakeRecord(baseMistakeData);
    const savedMistake = await mistake.save();

    expect(savedMistake._id).toBeDefined();
    expect(savedMistake.student.toString()).toBe(mockStudentId.toString());
    expect(savedMistake.subject).toBe('物理');
    expect(savedMistake.question).toBe('请解释牛顿第二定律及其公式。');
    expect(savedMistake.analysis).toBe('学生混淆了力和加速度的矢量性。');
    expect(savedMistake.tags).toEqual(['牛顿定律', '力学']);
    expect(savedMistake.source).toBe('课堂测验');
    expect(savedMistake.status).toBe('pending_review');
    expect(savedMistake.createdBy.toString()).toBe(mockTeacherId.toString());
    expect(savedMistake.updatedBy.toString()).toBe(mockUpdatedById.toString());
    expect(savedMistake.attachments.length).toBe(1);
    expect(savedMistake.attachments[0].fileName).toBe('question_snapshot.png');
  });

  describe('Required Fields Validation', () => {
    // 假设的必填字段，请根据您的模型实际定义进行调整
    const requiredFields = ['student', 'subject', 'question', 'createdBy', 'status', 'source'];
    requiredFields.forEach(field => {
      it(`should fail if ${field} is missing`, async () => {
        const mistakeData = { ...baseMistakeData };
        delete mistakeData[field];
        const mistake = new MistakeRecord(mistakeData);
        let err;
        try { await mistake.save(); } catch (e) { err = e; }
        expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
        expect(err.errors[field]).toBeDefined();
      });
    });
  });

  describe('Timestamps and updatedBy', () => {
    it('should have createdAt and updatedAt fields upon creation', async () => {
      const mistake = new MistakeRecord(baseMistakeData);
      const savedMistake = await mistake.save();
      expect(savedMistake.createdAt).toBeDefined();
      expect(savedMistake.updatedAt).toBeDefined();
    });

    it('should update updatedAt field upon saving an existing document', async () => {
      const mistake = new MistakeRecord(baseMistakeData);
      const savedMistake = await mistake.save();
      const initialUpdatedAt = savedMistake.updatedAt;

      await new Promise(resolve => setTimeout(resolve, 10));
      savedMistake.analysis = '更新后的错题分析';
      const updatedMistake = await savedMistake.save();

      expect(updatedMistake.updatedAt).toBeDefined();
      expect(updatedMistake.updatedAt.getTime()).toBeGreaterThan(initialUpdatedAt.getTime());
    });

    it('should save the updatedBy field', async () => {
      const mistake = new MistakeRecord(baseMistakeData);
      const savedMistake = await mistake.save();
      expect(savedMistake.updatedBy.toString()).toBe(mockUpdatedById.toString());
    });
  });

  describe('Field Renaming Validation', () => {
    it('should use new field names: tags, analysis, createdBy', async () => {
      const mistake = new MistakeRecord(baseMistakeData);
      const savedMistake = await mistake.save();
      expect(savedMistake.tags).toEqual(baseMistakeData.tags);
      expect(savedMistake.analysis).toBe(baseMistakeData.analysis);
      expect(savedMistake.createdBy.toString()).toBe(baseMistakeData.createdBy.toString());
    });

    it('should not save old field names: knowledgePoints, comments, recordedBy', async () => {
      const mistakeDataWithOldFields = {
        ...baseMistakeData,
        knowledgePoints: ['旧知识点'],
        comments: '旧评论',
        recordedBy: new mongoose.Types.ObjectId() 
      };
      // 从 baseMistakeData 中移除新字段，以避免它们覆盖旧字段的测试
      delete mistakeDataWithOldFields.tags;
      delete mistakeDataWithOldFields.analysis;
      // createdBy 已经在 baseMistakeData 中，会覆盖 recordedBy, 这是Mongoose的行为，没法直接测不存在
      // 如果模型中没有定义旧字段，Mongoose 会直接忽略它们

      const mistake = new MistakeRecord(mistakeDataWithOldFields);
      const savedMistake = await mistake.save();
      const mistakeObject = savedMistake.toObject();

      expect(mistakeObject.knowledgePoints).toBeUndefined();
      expect(mistakeObject.comments).toBeUndefined();
      expect(mistakeObject.recordedBy).toBeUndefined(); 
      // 确保新字段已按 baseMistakeData 中的定义保存
      expect(savedMistake.tags).toEqual(baseMistakeData.tags); 
      expect(savedMistake.analysis).toBe(baseMistakeData.analysis);
      expect(savedMistake.createdBy.toString()).toBe(baseMistakeData.createdBy.toString());
    });
  });

  describe('Status Enum Validation', () => {
    // 请根据您的模型实际定义更新这些枚举值
    const validStatuses = ['pending_review', 'improvement_needed', 'mastered', 'archived', 'needs_discussion'];
    validStatuses.forEach(status => {
      it(`should accept valid status: ${status}`, async () => {
        const mistake = new MistakeRecord({ ...baseMistakeData, status: status });
        const savedMistake = await mistake.save();
        expect(savedMistake.status).toBe(status);
      });
    });

    it('should reject an invalid status', async () => {
      const mistake = new MistakeRecord({ ...baseMistakeData, status: 'invalid_status' });
      let err;
      try { await mistake.save(); } catch (e) { err = e; }
      expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
      expect(err.errors.status).toBeDefined();
    });
  });

  describe('Source Field', () => {
    it('should save the source field correctly', async () => {
      const mistake = new MistakeRecord({ ...baseMistakeData, source: '作业订正' });
      const savedMistake = await mistake.save();
      expect(savedMistake.source).toBe('作业订正');
    });
  });

  describe('Tags Field (formerly knowledgePoints)', () => {
    it('should save tags as an array of strings', async () => {
      const mistake = new MistakeRecord({ ...baseMistakeData, tags: ['代数', '方程求解', '应用题'] });
      const savedMistake = await mistake.save();
      expect(savedMistake.tags).toEqual(['代数', '方程求解', '应用题']);
    });

    it('should allow empty tags array', async () => {
      const mistake = new MistakeRecord({ ...baseMistakeData, tags: [] });
      const savedMistake = await mistake.save();
      expect(savedMistake.tags).toEqual([]);
    });
  });
  
  describe('Attachments for MistakeRecord', () => {
    const sampleAttachment = { fileName: 'error_detail.jpg', filePath: '/mistakes/error_detail.jpg', fileType: 'image/jpeg', fileSize: 30720 };
    it('should save attachments correctly', async () => {
      const mistake = new MistakeRecord({ ...baseMistakeData, attachments: [sampleAttachment] });
      const savedMistake = await mistake.save();
      expect(savedMistake.attachments.length).toBe(1);
      expect(savedMistake.attachments[0].fileName).toBe(sampleAttachment.fileName);
    });

    it('should allow empty attachments array', async () => {
      const mistakeData = { ...baseMistakeData };
      mistakeData.attachments = [];
      const mistake = new MistakeRecord(mistakeData);
      const savedMistake = await mistake.save();
      expect(savedMistake.attachments).toEqual([]);
    });
  });

}); 