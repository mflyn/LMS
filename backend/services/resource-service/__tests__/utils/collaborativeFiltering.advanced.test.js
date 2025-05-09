const { UserBasedCF, ItemBasedCF, HybridRecommender } = require('../../utils/collaborativeFiltering');
const mongoose = require('mongoose');

describe('高级协同过滤推荐算法测试', () => {
  // 模拟数据
  const mockUsers = [
    { _id: new mongoose.Types.ObjectId().toString() },
    { _id: new mongoose.Types.ObjectId().toString() },
    { _id: new mongoose.Types.ObjectId().toString() },
    { _id: new mongoose.Types.ObjectId().toString() }
  ];

  const mockResources = [
    { _id: new mongoose.Types.ObjectId().toString(), title: '资源1', subject: '数学', grade: '三年级', type: '习题' },
    { _id: new mongoose.Types.ObjectId().toString(), title: '资源2', subject: '数学', grade: '三年级', type: '习题' },
    { _id: new mongoose.Types.ObjectId().toString(), title: '资源3', subject: '语文', grade: '三年级', type: '课件' },
    { _id: new mongoose.Types.ObjectId().toString(), title: '资源4', subject: '英语', grade: '四年级', type: '视频' },
    { _id: new mongoose.Types.ObjectId().toString(), title: '资源5', subject: '数学', grade: '四年级', type: '习题' }
  ];

  // 模拟评分数据
  const mockRatings = [
    // 用户1的评分
    { userId: mockUsers[0]._id, resourceId: mockResources[0]._id, rating: 5 },
    { userId: mockUsers[0]._id, resourceId: mockResources[1]._id, rating: 4 },
    { userId: mockUsers[0]._id, resourceId: mockResources[2]._id, rating: 3 },

    // 用户2的评分
    { userId: mockUsers[1]._id, resourceId: mockResources[0]._id, rating: 4 },
    { userId: mockUsers[1]._id, resourceId: mockResources[1]._id, rating: 5 },
    { userId: mockUsers[1]._id, resourceId: mockResources[3]._id, rating: 4 },

    // 用户3的评分
    { userId: mockUsers[2]._id, resourceId: mockResources[0]._id, rating: 3 },
    { userId: mockUsers[2]._id, resourceId: mockResources[2]._id, rating: 5 },
    { userId: mockUsers[2]._id, resourceId: mockResources[3]._id, rating: 4 },
    { userId: mockUsers[2]._id, resourceId: mockResources[4]._id, rating: 5 },

    // 用户4的评分
    { userId: mockUsers[3]._id, resourceId: mockResources[1]._id, rating: 3 },
    { userId: mockUsers[3]._id, resourceId: mockResources[3]._id, rating: 5 },
    { userId: mockUsers[3]._id, resourceId: mockResources[4]._id, rating: 4 }
  ];

  // 模拟日志记录器
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  };

  describe('UserBasedCF 类', () => {
    let userBasedCF;

    beforeEach(() => {
      userBasedCF = new UserBasedCF({
        similarityThreshold: 0.3,
        maxRecommendations: 3,
        logger: mockLogger
      });
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('应该正确初始化配置选项', () => {
      expect(userBasedCF.similarityThreshold).toBe(0.3);
      expect(userBasedCF.maxRecommendations).toBe(3);
      expect(userBasedCF.logger).toBe(mockLogger);
    });

    it('应该使用默认配置选项', () => {
      const defaultCF = new UserBasedCF();
      expect(defaultCF.similarityThreshold).toBe(0.3);
      expect(defaultCF.maxRecommendations).toBe(10);
      expect(defaultCF.logger).toBe(console);
    });

    it('应该计算用户相似度矩阵', () => {
      const similarityMatrix = userBasedCF.calculateUserSimilarity(mockRatings);

      // 验证相似度矩阵结构
      expect(similarityMatrix).toBeDefined();
      mockUsers.forEach(user => {
        expect(similarityMatrix[user._id]).toBeDefined();
        mockUsers.forEach(otherUser => {
          expect(similarityMatrix[user._id][otherUser._id]).toBeDefined();
          expect(typeof similarityMatrix[user._id][otherUser._id]).toBe('number');

          // 自己和自己的相似度应该是1
          if (user._id === otherUser._id) {
            expect(similarityMatrix[user._id][otherUser._id]).toBe(1);
          }

          // 相似度应该在0到1之间
          expect(similarityMatrix[user._id][otherUser._id]).toBeGreaterThanOrEqual(0);
          expect(similarityMatrix[user._id][otherUser._id]).toBeLessThanOrEqual(1);

          // 相似度矩阵应该是对称的
          expect(similarityMatrix[user._id][otherUser._id]).toBe(similarityMatrix[otherUser._id][user._id]);
        });
      });
    });

    it('应该为用户生成推荐', () => {
      const recommendations = userBasedCF.generateRecommendations(
        mockUsers[0]._id, mockRatings, mockResources
      );

      // 验证推荐结果
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeLessThanOrEqual(3); // maxRecommendations = 3

      if (recommendations.length > 0) {
        // 验证推荐项的结构
        recommendations.forEach(rec => {
          expect(rec).toHaveProperty('resource');
          expect(rec).toHaveProperty('score');
          expect(rec).toHaveProperty('similarityScore');
          expect(typeof rec.score).toBe('number');
          expect(typeof rec.similarityScore).toBe('string');
        });

        // 验证推荐项已按分数排序
        for (let i = 1; i < recommendations.length; i++) {
          expect(recommendations[i-1].score).toBeGreaterThanOrEqual(recommendations[i].score);
        }

        // 验证不推荐用户已评价的资源
        const userRatedResourceIds = new Set(
          mockRatings
            .filter(rating => rating.userId === mockUsers[0]._id)
            .map(rating => rating.resourceId)
        );

        recommendations.forEach(rec => {
          expect(userRatedResourceIds.has(rec.resource._id)).toBe(false);
        });
      }

      // 验证日志记录
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(`为用户 ${mockUsers[0]._id} 生成了`)
      );
    });

    it('应该处理用户没有评分记录的情况', () => {
      const nonExistentUserId = new mongoose.Types.ObjectId().toString();
      const recommendations = userBasedCF.generateRecommendations(
        nonExistentUserId, mockRatings, mockResources
      );

      expect(recommendations).toEqual([]);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(`用户 ${nonExistentUserId} 没有评分记录`)
      );
    });

    it('应该处理错误情况', () => {
      // 模拟错误
      jest.spyOn(userBasedCF, 'calculateUserSimilarity').mockImplementation(() => {
        throw new Error('测试错误');
      });

      const recommendations = userBasedCF.generateRecommendations(
        mockUsers[0]._id, mockRatings, mockResources
      );

      expect(recommendations).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('生成协同过滤推荐时出错'),
        expect.any(Error)
      );
    });
  });

  describe('ItemBasedCF 类', () => {
    let itemBasedCF;

    beforeEach(() => {
      itemBasedCF = new ItemBasedCF({
        similarityThreshold: 0.3,
        maxRecommendations: 3,
        logger: mockLogger
      });
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('应该正确初始化配置选项', () => {
      expect(itemBasedCF.similarityThreshold).toBe(0.3);
      expect(itemBasedCF.maxRecommendations).toBe(3);
      expect(itemBasedCF.logger).toBe(mockLogger);
    });

    it('应该使用默认配置选项', () => {
      const defaultCF = new ItemBasedCF();
      expect(defaultCF.similarityThreshold).toBe(0.3);
      expect(defaultCF.maxRecommendations).toBe(10);
      expect(defaultCF.logger).toBe(console);
    });

    it('应该计算物品相似度矩阵', () => {
      const similarityMatrix = itemBasedCF.calculateItemSimilarity(mockRatings);

      // 验证相似度矩阵结构
      expect(similarityMatrix).toBeDefined();
      mockResources.forEach(resource => {
        const resourceId = resource._id.toString();
        // 只有被评价过的资源才会在矩阵中
        if (mockRatings.some(rating => rating.resourceId === resourceId)) {
          expect(similarityMatrix[resourceId]).toBeDefined();

          mockResources.forEach(otherResource => {
            const otherResourceId = otherResource._id.toString();
            if (mockRatings.some(rating => rating.resourceId === otherResourceId)) {
              expect(similarityMatrix[resourceId][otherResourceId]).toBeDefined();
              expect(typeof similarityMatrix[resourceId][otherResourceId]).toBe('number');

              // 自己和自己的相似度应该是1
              if (resourceId === otherResourceId) {
                expect(similarityMatrix[resourceId][otherResourceId]).toBe(1);
              }

              // 相似度应该在0到1之间
              expect(similarityMatrix[resourceId][otherResourceId]).toBeGreaterThanOrEqual(0);
              expect(similarityMatrix[resourceId][otherResourceId]).toBeLessThanOrEqual(1);

              // 相似度矩阵应该是对称的
              expect(similarityMatrix[resourceId][otherResourceId]).toBe(similarityMatrix[otherResourceId][resourceId]);
            }
          });
        }
      });
    });

    it('应该为用户生成推荐', () => {
      const recommendations = itemBasedCF.generateRecommendations(
        mockUsers[0]._id, mockRatings, mockResources
      );

      // 验证推荐结果
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeLessThanOrEqual(3); // maxRecommendations = 3

      if (recommendations.length > 0) {
        // 验证推荐项的结构
        recommendations.forEach(rec => {
          expect(rec).toHaveProperty('resource');
          expect(rec).toHaveProperty('score');
          expect(rec).toHaveProperty('similarityScore');
          expect(typeof rec.score).toBe('number');
          expect(typeof rec.similarityScore).toBe('string');
        });

        // 验证推荐项已按分数排序
        for (let i = 1; i < recommendations.length; i++) {
          expect(recommendations[i-1].score).toBeGreaterThanOrEqual(recommendations[i].score);
        }

        // 验证不推荐用户已评价的资源
        const userRatedResourceIds = new Set(
          mockRatings
            .filter(rating => rating.userId === mockUsers[0]._id)
            .map(rating => rating.resourceId)
        );

        recommendations.forEach(rec => {
          expect(userRatedResourceIds.has(rec.resource._id)).toBe(false);
        });
      }

      // 验证日志记录
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(`为用户 ${mockUsers[0]._id} 生成了`)
      );
    });

    it('应该处理用户没有评分记录的情况', () => {
      const nonExistentUserId = new mongoose.Types.ObjectId().toString();
      const recommendations = itemBasedCF.generateRecommendations(
        nonExistentUserId, mockRatings, mockResources
      );

      expect(recommendations).toEqual([]);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(`用户 ${nonExistentUserId} 没有评分记录`)
      );
    });

    it('应该处理错误情况', () => {
      // 模拟错误
      jest.spyOn(itemBasedCF, 'calculateItemSimilarity').mockImplementation(() => {
        throw new Error('测试错误');
      });

      const recommendations = itemBasedCF.generateRecommendations(
        mockUsers[0]._id, mockRatings, mockResources
      );

      expect(recommendations).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('生成基于物品的协同过滤推荐时出错'),
        expect.any(Error)
      );
    });
  });

  describe('HybridRecommender 类', () => {
    let hybridRecommender;

    beforeEach(() => {
      hybridRecommender = new HybridRecommender({
        userWeight: 0.6,
        itemWeight: 0.4,
        maxRecommendations: 3,
        logger: mockLogger
      });
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('应该正确初始化配置选项', () => {
      expect(hybridRecommender.userWeight).toBe(0.6);
      expect(hybridRecommender.itemWeight).toBe(0.4);
      expect(hybridRecommender.maxRecommendations).toBe(3);
      expect(hybridRecommender.logger).toBe(mockLogger);
      expect(hybridRecommender.userBasedCF).toBeInstanceOf(UserBasedCF);
      expect(hybridRecommender.itemBasedCF).toBeInstanceOf(ItemBasedCF);
    });

    it('应该使用默认配置选项', () => {
      const defaultRecommender = new HybridRecommender();
      expect(defaultRecommender.userWeight).toBe(0.5);
      expect(defaultRecommender.itemWeight).toBe(0.5);
      expect(defaultRecommender.maxRecommendations).toBe(10);
      expect(defaultRecommender.logger).toBe(console);
    });

    it('应该生成混合推荐', () => {
      // 模拟基于用户和基于物品的推荐结果
      const userBasedRecs = [
        { resource: mockResources[3], score: 0.8, similarityScore: '0.80' },
        { resource: mockResources[4], score: 0.6, similarityScore: '0.60' }
      ];

      const itemBasedRecs = [
        { resource: mockResources[4], score: 0.9, similarityScore: '0.90' },
        { resource: mockResources[3], score: 0.5, similarityScore: '0.50' }
      ];

      // 模拟基于用户和基于物品的推荐方法
      jest.spyOn(hybridRecommender.userBasedCF, 'generateRecommendations')
        .mockReturnValue(userBasedRecs);

      jest.spyOn(hybridRecommender.itemBasedCF, 'generateRecommendations')
        .mockReturnValue(itemBasedRecs);

      const recommendations = hybridRecommender.generateRecommendations(
        mockUsers[0]._id, mockRatings, mockResources
      );

      // 验证推荐结果
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeLessThanOrEqual(3); // maxRecommendations = 3

      if (recommendations.length > 0) {
        // 验证推荐项的结构
        recommendations.forEach(rec => {
          expect(rec).toHaveProperty('resource');
          expect(rec).toHaveProperty('userBasedScore');
          expect(rec).toHaveProperty('itemBasedScore');
          expect(rec).toHaveProperty('totalScore');
          expect(rec).toHaveProperty('similarityScore');
        });

        // 验证推荐项已按总分排序
        for (let i = 1; i < recommendations.length; i++) {
          expect(recommendations[i-1].totalScore).toBeGreaterThanOrEqual(recommendations[i].totalScore);
        }

        // 验证资源4的混合分数计算正确
        const resource4Rec = recommendations.find(rec => rec.resource._id === mockResources[3]._id);
        if (resource4Rec) {
          expect(resource4Rec.userBasedScore).toBeCloseTo(0.8 * 0.6, 5); // 用户权重0.6
          expect(resource4Rec.itemBasedScore).toBeCloseTo(0.5 * 0.4, 5); // 物品权重0.4
          expect(resource4Rec.totalScore).toBeCloseTo((0.8 * 0.6) + (0.5 * 0.4), 5);
        }

        // 验证资源5的混合分数计算正确
        const resource5Rec = recommendations.find(rec => rec.resource._id === mockResources[4]._id);
        if (resource5Rec) {
          expect(resource5Rec.userBasedScore).toBeCloseTo(0.6 * 0.6, 5); // 用户权重0.6
          expect(resource5Rec.itemBasedScore).toBeCloseTo(0.9 * 0.4, 5); // 物品权重0.4
          expect(resource5Rec.totalScore).toBeCloseTo((0.6 * 0.6) + (0.9 * 0.4), 5);
        }
      }

      // 验证日志记录
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(`为用户 ${mockUsers[0]._id} 生成了`)
      );
    });

    it('应该应用过滤条件', () => {
      // 模拟基于用户和基于物品的推荐结果
      const userBasedRecs = [
        { resource: mockResources[3], score: 0.8, similarityScore: '0.80' }, // 英语，四年级
        { resource: mockResources[4], score: 0.6, similarityScore: '0.60' }  // 数学，四年级
      ];

      const itemBasedRecs = [
        { resource: mockResources[4], score: 0.9, similarityScore: '0.90' }, // 数学，四年级
        { resource: mockResources[3], score: 0.5, similarityScore: '0.50' }  // 英语，四年级
      ];

      // 模拟基于用户和基于物品的推荐方法
      jest.spyOn(hybridRecommender.userBasedCF, 'generateRecommendations')
        .mockReturnValue(userBasedRecs);

      jest.spyOn(hybridRecommender.itemBasedCF, 'generateRecommendations')
        .mockReturnValue(itemBasedRecs);

      // 应用学科过滤条件
      const recommendations = hybridRecommender.generateRecommendations(
        mockUsers[0]._id, mockRatings, mockResources, { subject: '数学' }
      );

      // 验证推荐结果只包含数学学科
      expect(recommendations.length).toBe(1);
      expect(recommendations[0].resource._id).toBe(mockResources[4]._id);
      expect(recommendations[0].resource.subject).toBe('数学');

      // 应用年级过滤条件
      const gradeRecommendations = hybridRecommender.generateRecommendations(
        mockUsers[0]._id, mockRatings, mockResources, { grade: '四年级' }
      );

      // 验证推荐结果只包含四年级资源
      expect(gradeRecommendations.length).toBe(2);
      gradeRecommendations.forEach(rec => {
        expect(rec.resource.grade).toBe('四年级');
      });

      // 应用类型过滤条件
      const typeRecommendations = hybridRecommender.generateRecommendations(
        mockUsers[0]._id, mockRatings, mockResources, { type: '习题' }
      );

      // 验证推荐结果只包含习题类型
      typeRecommendations.forEach(rec => {
        expect(rec.resource.type).toBe('习题');
      });
    });

    it('应该处理错误情况', () => {
      // 模拟错误
      jest.spyOn(hybridRecommender.userBasedCF, 'generateRecommendations').mockImplementation(() => {
        throw new Error('测试错误');
      });

      const recommendations = hybridRecommender.generateRecommendations(
        mockUsers[0]._id, mockRatings, mockResources
      );

      expect(recommendations).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('生成混合推荐时出错'),
        expect.any(Error)
      );
    });
  });
});
