const cfModule = require('../../utils/collaborativeFiltering');
const UserBasedCF = cfModule.UserBasedCF;
const ItemBasedCF = cfModule.ItemBasedCF;
const HybridRecommender = cfModule.HybridRecommender;

describe('协同过滤算法单元测试', () => {
  // 模拟日志记录器
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn()
  };

  // 测试数据
  const testUserId = 'user1';
  const testUserRatings = [
    { userId: 'user1', resourceId: 'resource1', rating: 5 },
    { userId: 'user1', resourceId: 'resource2', rating: 4 },
    { userId: 'user1', resourceId: 'resource3', rating: 3 },
    { userId: 'user2', resourceId: 'resource1', rating: 4 },
    { userId: 'user2', resourceId: 'resource2', rating: 5 },
    { userId: 'user2', resourceId: 'resource4', rating: 4 },
    { userId: 'user3', resourceId: 'resource2', rating: 2 },
    { userId: 'user3', resourceId: 'resource3', rating: 4 },
    { userId: 'user3', resourceId: 'resource5', rating: 5 }
  ];

  const testResources = [
    { _id: 'resource1', title: '资源1', subject: '数学' },
    { _id: 'resource2', title: '资源2', subject: '数学' },
    { _id: 'resource3', title: '资源3', subject: '语文' },
    { _id: 'resource4', title: '资源4', subject: '数学' },
    { _id: 'resource5', title: '资源5', subject: '语文' }
  ];

  describe('UserBasedCF', () => {
    let userBasedCF;

    beforeEach(() => {
      userBasedCF = new UserBasedCF({
        similarityThreshold: 0.3,
        maxRecommendations: 10,
        logger: mockLogger
      });
    });

    it('应该正确初始化', () => {
      expect(userBasedCF.similarityThreshold).toBe(0.3);
      expect(userBasedCF.maxRecommendations).toBe(10);
      expect(userBasedCF.logger).toBe(mockLogger);
    });

    it('应该使用默认值初始化', () => {
      const defaultCF = new UserBasedCF();
      expect(defaultCF.similarityThreshold).toBe(0.3);
      expect(defaultCF.maxRecommendations).toBe(10);
      expect(defaultCF.logger).toBe(console);
    });

    it('calculateUserSimilarity 应该计算正确的用户相似度矩阵', () => {
      const similarityMatrix = userBasedCF.calculateUserSimilarity(testUserRatings);

      // 验证矩阵结构
      expect(similarityMatrix).toHaveProperty('user1');
      expect(similarityMatrix).toHaveProperty('user2');
      expect(similarityMatrix).toHaveProperty('user3');

      // 验证自己和自己的相似度为1
      expect(similarityMatrix.user1.user1).toBe(1.0);
      expect(similarityMatrix.user2.user2).toBe(1.0);
      expect(similarityMatrix.user3.user3).toBe(1.0);

      // 验证相似度的对称性
      expect(similarityMatrix.user1.user2).toBe(similarityMatrix.user2.user1);
      expect(similarityMatrix.user1.user3).toBe(similarityMatrix.user3.user1);
      expect(similarityMatrix.user2.user3).toBe(similarityMatrix.user3.user2);

      // 验证相似度的范围在[-1, 1]之间
      for (const user1 in similarityMatrix) {
        for (const user2 in similarityMatrix[user1]) {
          expect(similarityMatrix[user1][user2]).toBeGreaterThanOrEqual(-1);
          expect(similarityMatrix[user1][user2]).toBeLessThanOrEqual(1);
        }
      }
    });

    it('generateRecommendations 应该生成正确的推荐', () => {
      const recommendations = userBasedCF.generateRecommendations(
        testUserId, testUserRatings, testResources
      );

      // 验证返回结果是数组
      expect(Array.isArray(recommendations)).toBe(true);

      // 验证推荐不包含用户已评价的资源
      const userRatedResourceIds = new Set(['resource1', 'resource2', 'resource3']);
      recommendations.forEach(rec => {
        expect(userRatedResourceIds.has(rec.resource._id)).toBe(false);
      });

      // 验证推荐按分数降序排序
      for (let i = 1; i < recommendations.length; i++) {
        expect(recommendations[i-1].score).toBeGreaterThanOrEqual(recommendations[i].score);
      }

      // 验证推荐数量不超过最大限制
      expect(recommendations.length).toBeLessThanOrEqual(userBasedCF.maxRecommendations);

      // 验证日志记录
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('当用户没有评分记录时，应该返回空数组', () => {
      const recommendations = userBasedCF.generateRecommendations(
        'nonexistentUser', testUserRatings, testResources
      );

      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBe(0);
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('当发生错误时，应该捕获并返回空数组', () => {
      // 模拟错误
      jest.spyOn(userBasedCF, 'calculateUserSimilarity').mockImplementation(() => {
        throw new Error('测试错误');
      });

      const recommendations = userBasedCF.generateRecommendations(
        testUserId, testUserRatings, testResources
      );

      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBe(0);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('ItemBasedCF', () => {
    let itemBasedCF;

    beforeEach(() => {
      itemBasedCF = new ItemBasedCF({
        similarityThreshold: 0.3,
        maxRecommendations: 10,
        logger: mockLogger
      });
    });

    it('应该正确初始化', () => {
      expect(itemBasedCF.similarityThreshold).toBe(0.3);
      expect(itemBasedCF.maxRecommendations).toBe(10);
      expect(itemBasedCF.logger).toBe(mockLogger);
    });

    it('calculateItemSimilarity 应该计算正确的物品相似度矩阵', () => {
      const similarityMatrix = itemBasedCF.calculateItemSimilarity(testUserRatings);

      // 验证矩阵结构
      expect(similarityMatrix).toHaveProperty('resource1');
      expect(similarityMatrix).toHaveProperty('resource2');
      expect(similarityMatrix).toHaveProperty('resource3');

      // 验证自己和自己的相似度为1
      expect(similarityMatrix.resource1.resource1).toBe(1.0);
      expect(similarityMatrix.resource2.resource2).toBe(1.0);
      expect(similarityMatrix.resource3.resource3).toBe(1.0);

      // 验证相似度的对称性
      expect(similarityMatrix.resource1.resource2).toBe(similarityMatrix.resource2.resource1);
      expect(similarityMatrix.resource1.resource3).toBe(similarityMatrix.resource3.resource1);
      expect(similarityMatrix.resource2.resource3).toBe(similarityMatrix.resource3.resource2);

      // 验证相似度的范围在[-1, 1]之间
      for (const res1 in similarityMatrix) {
        for (const res2 in similarityMatrix[res1]) {
          expect(similarityMatrix[res1][res2]).toBeGreaterThanOrEqual(-1);
          expect(similarityMatrix[res1][res2]).toBeLessThanOrEqual(1);
        }
      }
    });

    it('generateRecommendations 应该生成正确的推荐', () => {
      const recommendations = itemBasedCF.generateRecommendations(
        testUserId, testUserRatings, testResources
      );

      // 验证返回结果是数组
      expect(Array.isArray(recommendations)).toBe(true);

      // 验证推荐不包含用户已评价的资源
      const userRatedResourceIds = new Set(['resource1', 'resource2', 'resource3']);
      recommendations.forEach(rec => {
        expect(userRatedResourceIds.has(rec.resource._id)).toBe(false);
      });

      // 验证推荐按分数降序排序
      for (let i = 1; i < recommendations.length; i++) {
        expect(recommendations[i-1].score).toBeGreaterThanOrEqual(recommendations[i].score);
      }

      // 验证推荐数量不超过最大限制
      expect(recommendations.length).toBeLessThanOrEqual(itemBasedCF.maxRecommendations);

      // 验证日志记录
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('当用户没有评分记录时，应该返回空数组', () => {
      const recommendations = itemBasedCF.generateRecommendations(
        'nonexistentUser', testUserRatings, testResources
      );

      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBe(0);
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('当发生错误时，应该捕获并返回空数组', () => {
      // 模拟错误
      jest.spyOn(itemBasedCF, 'calculateItemSimilarity').mockImplementation(() => {
        throw new Error('测试错误');
      });

      const recommendations = itemBasedCF.generateRecommendations(
        testUserId, testUserRatings, testResources
      );

      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBe(0);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('HybridRecommender', () => {
    let hybridRecommender;

    beforeEach(() => {
      hybridRecommender = new HybridRecommender({
        userWeight: 0.6,
        itemWeight: 0.4,
        maxRecommendations: 10,
        logger: mockLogger
      });

      // 重置 mock
      mockLogger.info.mockClear();
      mockLogger.error.mockClear();
    });

    it('应该正确初始化', () => {
      expect(hybridRecommender.userWeight).toBe(0.6);
      expect(hybridRecommender.itemWeight).toBe(0.4);
      expect(hybridRecommender.maxRecommendations).toBe(10);
      expect(hybridRecommender.logger).toBe(mockLogger);
      expect(hybridRecommender.userBasedCF).toBeInstanceOf(UserBasedCF);
      expect(hybridRecommender.itemBasedCF).toBeInstanceOf(ItemBasedCF);
    });

    it('应该使用默认值初始化', () => {
      const defaultHybrid = new HybridRecommender();
      expect(defaultHybrid.userWeight).toBe(0.5);
      expect(defaultHybrid.itemWeight).toBe(0.5);
      expect(defaultHybrid.maxRecommendations).toBe(10);
      expect(defaultHybrid.logger).toBe(console);
    });

    it('generateRecommendations 应该生成混合推荐', () => {
      // 模拟基于用户和基于物品的推荐结果
      jest.spyOn(hybridRecommender.userBasedCF, 'generateRecommendations').mockReturnValue([
        { resource: testResources[3], score: 0.8, similarityScore: '0.80' }, // resource4
        { resource: testResources[4], score: 0.6, similarityScore: '0.60' }  // resource5
      ]);

      jest.spyOn(hybridRecommender.itemBasedCF, 'generateRecommendations').mockReturnValue([
        { resource: testResources[3], score: 0.7, similarityScore: '0.70' }, // resource4
        { resource: testResources[4], score: 0.5, similarityScore: '0.50' }  // resource5
      ]);

      const recommendations = hybridRecommender.generateRecommendations(
        testUserId, testUserRatings, testResources
      );

      // 验证返回结果是数组
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(0);

      // 验证混合推荐包含正确的资源
      const recommendedResources = recommendations.map(rec => rec.resource._id);
      expect(recommendedResources).toContain('resource4');
      expect(recommendedResources).toContain('resource5');

      // 验证推荐按总分数降序排序
      for (let i = 1; i < recommendations.length; i++) {
        expect(recommendations[i-1].totalScore).toBeGreaterThanOrEqual(recommendations[i].totalScore);
      }

      // 验证推荐数量不超过最大限制
      expect(recommendations.length).toBeLessThanOrEqual(hybridRecommender.maxRecommendations);
    });

    it('应该能够应用过滤条件', () => {
      // 模拟基于用户和基于物品的推荐结果
      jest.spyOn(hybridRecommender.userBasedCF, 'generateRecommendations').mockReturnValue([
        { resource: testResources[3], score: 0.8, similarityScore: '0.80' }, // resource4 (数学)
        { resource: testResources[4], score: 0.6, similarityScore: '0.60' }  // resource5 (语文)
      ]);

      jest.spyOn(hybridRecommender.itemBasedCF, 'generateRecommendations').mockReturnValue([
        { resource: testResources[3], score: 0.7, similarityScore: '0.70' }, // resource4 (数学)
        { resource: testResources[4], score: 0.5, similarityScore: '0.50' }  // resource5 (语文)
      ]);

      // 应用科目过滤条件
      const recommendations = hybridRecommender.generateRecommendations(
        testUserId, testUserRatings, testResources, { subject: '数学' }
      );

      // 验证只返回数学科目的资源
      expect(recommendations.length).toBeGreaterThan(0);
      recommendations.forEach(rec => {
        expect(rec.resource.subject).toBe('数学');
      });

      // 验证不包含语文科目的资源
      const recommendedResources = recommendations.map(rec => rec.resource._id);
      expect(recommendedResources).toContain('resource4');
      expect(recommendedResources).not.toContain('resource5');
    });

    it('当发生错误时，应该捕获并返回空数组', () => {
      // 模拟错误
      jest.spyOn(hybridRecommender.userBasedCF, 'generateRecommendations').mockImplementation(() => {
        throw new Error('测试错误');
      });

      const recommendations = hybridRecommender.generateRecommendations(
        testUserId, testUserRatings, testResources
      );

      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBe(0);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});
