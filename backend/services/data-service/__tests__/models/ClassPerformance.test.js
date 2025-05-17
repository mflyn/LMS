const mongoose = require('mongoose');
// const { MongoMemoryServer } = require('mongodb-memory-server'); // 由全局配置处理
const ClassPerformance = require('../../models/ClassPerformance');

// let mongoServer; // 由全局配置处理

const mockStudentId = new mongoose.Types.ObjectId();
const mockTeacherId = new mongoose.Types.ObjectId();
const mockUpdatedById = new mongoose.Types.ObjectId();

const basePerformanceData = {
  student: mockStudentId,
  recordedBy: mockTeacherId,
  type: 'positive',
  description: '积极回答问题',
  score: 2,
  date: new Date(),
  subject: '数学',
  updatedBy: mockUpdatedById
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
//   await ClassPerformance.deleteMany({});
// });

describe('ClassPerformance Model', () => {
  it('should create and save a class performance record successfully', async () => {
    const performance = new ClassPerformance(basePerformanceData);
    const savedPerformance = await performance.save();

    expect(savedPerformance._id).toBeDefined();
    expect(savedPerformance.student.toString()).toBe(mockStudentId.toString());
    expect(savedPerformance.recordedBy.toString()).toBe(mockTeacherId.toString());
    expect(savedPerformance.type).toBe('positive');
    expect(savedPerformance.description).toBe('积极回答问题');
    expect(savedPerformance.score).toBe(2);
    expect(savedPerformance.subject).toBe('数学');
    expect(savedPerformance.updatedBy.toString()).toBe(mockUpdatedById.toString());
    expect(savedPerformance.date).toEqual(basePerformanceData.date);
  });

  describe('Required Fields Validation', () => {
    const requiredFields = ['student', 'recordedBy', 'type', 'date', 'subject']; // description 和 score 是可选的
    requiredFields.forEach(field => {
      it(`should fail if ${field} is missing`, async () => {
        const performanceData = { ...basePerformanceData };
        delete performanceData[field];
        const performance = new ClassPerformance(performanceData);
        let err;
        try {
          await performance.save();
        } catch (error) {
          err = error;
        }
        expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
        expect(err.errors[field]).toBeDefined();
      });
    });
  });

  describe('Timestamps and updatedBy', () => {
    it('should have createdAt and updatedAt fields upon creation', async () => {
      const performance = new ClassPerformance(basePerformanceData);
      const savedPerformance = await performance.save();
      expect(savedPerformance.createdAt).toBeDefined();
      expect(savedPerformance.updatedAt).toBeDefined();
    });

    it('should update updatedAt field upon saving an existing document', async () => {
      const performance = new ClassPerformance(basePerformanceData);
      const savedPerformance = await performance.save();
      const initialUpdatedAt = savedPerformance.updatedAt;

      await new Promise(resolve => setTimeout(resolve, 10));
      savedPerformance.description = '更新后的描述';
      const updatedPerformance = await savedPerformance.save();

      expect(updatedPerformance.updatedAt).toBeDefined();
      expect(updatedPerformance.updatedAt.getTime()).toBeGreaterThan(initialUpdatedAt.getTime());
    });

    it('should save the updatedBy field', async () => {
      const performance = new ClassPerformance(basePerformanceData);
      const savedPerformance = await performance.save();
      expect(savedPerformance.updatedBy.toString()).toBe(mockUpdatedById.toString());
    });
  });

  describe('Score Validation', () => {
    it('should accept score within the range [-5, 5]', async () => {
      const scores = [-5, 0, 5, 3.5, -2.5];
      for (const score of scores) {
        const performance = new ClassPerformance({ ...basePerformanceData, score: score });
        const savedPerformance = await performance.save();
        expect(savedPerformance.score).toBe(score);
      }
    });

    it('should allow score to be optional (undefined)', async () => {
      const performanceData = { ...basePerformanceData };
      delete performanceData.score; // 移除 score
      const performance = new ClassPerformance(performanceData);
      const savedPerformance = await performance.save();
      expect(savedPerformance.score).toBeUndefined();
    });

    it('should reject score less than -5', async () => {
      const performance = new ClassPerformance({ ...basePerformanceData, score: -6 });
      let err;
      try { await performance.save(); } catch (e) { err = e; }
      expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
      expect(err.errors.score).toBeDefined();
    });

    it('should reject score greater than 5', async () => {
      const performance = new ClassPerformance({ ...basePerformanceData, score: 6 });
      let err;
      try { await performance.save(); } catch (e) { err = e; }
      expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
      expect(err.errors.score).toBeDefined();
    });
  });

  describe('Type Enum Validation', () => {
    // 假设的枚举值，请根据您的模型实际定义进行调整
    const validTypes = ['positive', 'negative', 'neutral', 'participation', 'effort', 'homework_completion', 'other'];
    validTypes.forEach(type => {
      it(`should accept valid type: ${type}`, async () => {
        const performance = new ClassPerformance({ ...basePerformanceData, type: type });
        const savedPerformance = await performance.save();
        expect(savedPerformance.type).toBe(type);
      });
    });

    it('should reject an invalid type', async () => {
      const performance = new ClassPerformance({ ...basePerformanceData, type: 'invalid_type_value' });
      let err;
      try { await performance.save(); } catch (e) { err = e; }
      expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
      expect(err.errors.type).toBeDefined();
    });
  });

  describe('Field Renaming (comments to description)', () => {
    it('should save the description field correctly', async () => {
      const performance = new ClassPerformance(basePerformanceData);
      const savedPerformance = await performance.save();
      expect(savedPerformance.description).toBe('积极回答问题');
    });

    it('should not save the old comments field if provided', async () => {
      const performanceDataWithOldField = {
        ...basePerformanceData,
        comments: '旧的评论字段内容' // 尝试提供旧字段
      };
      const performance = new ClassPerformance(performanceDataWithOldField);
      const savedPerformance = await performance.save();
      expect(savedPerformance.comments).toBeUndefined();
      const performanceObject = savedPerformance.toObject();
      expect(performanceObject.comments).toBeUndefined();
      expect(performanceObject.description).toBe(basePerformanceData.description); // 确保新字段已保存
    });
  });
}); 