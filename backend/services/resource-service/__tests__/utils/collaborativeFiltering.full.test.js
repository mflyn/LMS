const { UserBasedCF, ItemBasedCF, HybridRecommender } = require('../../utils/collaborativeFiltering');
const mongoose = require('mongoose');

describe('协同过滤算法测试', () => {
  // 模拟数据
  const mockUserRatings = [
    { userId: 'user1', resourceId: 'resource1', rating: 5 },
    { userId: 'user1', resourceId: 'resource2', rating: 4 },
    { userId: 'user1', resourceId: 'resource3', rating: 3 },
    { userId: 'user2', resourceId: 'resource1', rating: 4 },
    { userId: 'user2', resourceId: 'resource2', rating: 5 },
    { userId: 'user2', resourceId: 'resource4', rating: 4 },
    { userId: 'user3', resourceId: 'resource1', rating: 2 },
    { userId: 'user3', resourceId: 'resource3', rating: 5 },
    { userId: 'user3', resourceId: 'resource5', rating: 5 }
  ];

  const mockResources = [
    { _id: { toString: () => 'resource1' }, title: '资源1', subject: '数学', grade: '三年级', type: '习题' },
    { _id: { toString: () => 'resource2' }, title: '资源2', subject: '语文', grade: '三年级', type: '教材' },
    { _id: { toString: () => 'resource3' }, title: '资源3', subject: '数学', grade: '四年级', type: '习题' },
    { _id: { toString: () => 'resource4' }, title: '资源4', subject: '语文', grade: '四年级', type: '教材' },
    { _id: { toString: () => 'resource5' }, title: '资源5', subject: '英语', grade: '三年级', type: '习题' }
  ];

  // 模拟日志记录器
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn()
  };

  describe('UserBasedCF 类', () => {
    let userBasedCF;

    beforeEach(() => {
      userBasedCF = new UserBasedCF({
        similarityThreshold: 0.3,
        maxRecommendations: 2,
        logger: mockLogger
      });
    });

    it('应该正确初始化', () => {
      expect(userBasedCF.similarityThreshold).toBe(0.3);
      expect(userBasedCF.maxRecommendations).toBe(2);
      expect(userBasedCF.logger).toBe(mockLogger);
    });

    it('应该计算用户相似度矩阵', () => {
      const similarityMatrix = userBasedCF.calculateUserSimilarity(mockUserRatings);

      // 验证相似度矩阵结构
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

      // 验证相似度范围
      for (const user1 in similarityMatrix) {
        for (const user2 in similarityMatrix[user1]) {
          expect(similarityMatrix[user1][user2]).toBeGreaterThanOrEqual(0);
          expect(similarityMatrix[user1][user2]).toBeLessThanOrEqual(1);
        }
      }
    });

    it('应该生成推荐', () => {
      const recommendations = userBasedCF.generateRecommendations('user1', mockUserRatings, mockResources);

      // 验证推荐结构
      expect(Array.isArray(recommendations)).toBe(true);
      if (recommendations.length > 0) {
        expect(recommendations[0]).toHaveProperty('resource');
        expect(recommendations[0]).toHaveProperty('score');
        expect(recommendations[0]).toHaveProperty('similarityScore');
      }

      // 验证推荐数量不超过最大值
      expect(recommendations.length).toBeLessThanOrEqual(userBasedCF.maxRecommendations);

      // 验证日志记录
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('当用户没有评分记录时应该返回空数组', () => {
      const recommendations = userBasedCF.generateRecommendations('nonexistentUser', mockUserRatings, mockResources);

      expect(recommendations).toEqual([]);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('没有评分记录')
      );
    });

    it('应该处理错误情况', () => {
      // 模拟错误
      const mockError = new Error('测试错误');
      jest.spyOn(userBasedCF, 'calculateUserSimilarity').mockImplementation(() => {
        throw mockError;
      });

      const recommendations = userBasedCF.generateRecommendations('user1', mockUserRatings, mockResources);

      expect(recommendations).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('生成协同过滤推荐时出错'),
        mockError
      );
    });
  });

  describe('ItemBasedCF 类', () => {
    let itemBasedCF;

    beforeEach(() => {
      itemBasedCF = new ItemBasedCF({
        similarityThreshold: 0.3,
        maxRecommendations: 2,
        logger: mockLogger
      });
    });

    it('应该正确初始化', () => {
      expect(itemBasedCF.similarityThreshold).toBe(0.3);
      expect(itemBasedCF.maxRecommendations).toBe(2);
      expect(itemBasedCF.logger).toBe(mockLogger);
    });

    it('应该计算物品相似度矩阵', () => {
      const similarityMatrix = itemBasedCF.calculateItemSimilarity(mockUserRatings);

      // 验证相似度矩阵结构
      expect(similarityMatrix).toHaveProperty('resource1');
      expect(similarityMatrix).toHaveProperty('resource2');
      expect(similarityMatrix).toHaveProperty('resource3');
      expect(similarityMatrix).toHaveProperty('resource4');
      expect(similarityMatrix).toHaveProperty('resource5');

      // 验证自己和自己的相似度为1
      expect(similarityMatrix.resource1.resource1).toBe(1.0);
      expect(similarityMatrix.resource2.resource2).toBe(1.0);
      expect(similarityMatrix.resource3.resource3).toBe(1.0);

      // 验证相似度的对称性
      expect(similarityMatrix.resource1.resource2).toBe(similarityMatrix.resource2.resource1);
      expect(similarityMatrix.resource1.resource3).toBe(similarityMatrix.resource3.resource1);
      expect(similarityMatrix.resource2.resource3).toBe(similarityMatrix.resource3.resource2);

      // 验证相似度范围
      for (const resource1 in similarityMatrix) {
        for (const resource2 in similarityMatrix[resource1]) {
          expect(similarityMatrix[resource1][resource2]).toBeGreaterThanOrEqual(0);
          expect(similarityMatrix[resource1][resource2]).toBeLessThanOrEqual(1);
        }
      }
    });

    it('应该生成推荐', () => {
      const recommendations = itemBasedCF.generateRecommendations('user1', mockUserRatings, mockResources);

      // 验证推荐结构
      expect(Array.isArray(recommendations)).toBe(true);
      if (recommendations.length > 0) {
        expect(recommendations[0]).toHaveProperty('resource');
        expect(recommendations[0]).toHaveProperty('score');
        expect(recommendations[0]).toHaveProperty('similarityScore');
      }

      // 验证推荐数量不超过最大值
      expect(recommendations.length).toBeLessThanOrEqual(itemBasedCF.maxRecommendations);

      // 验证日志记录
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('当用户没有评分记录时应该返回空数组', () => {
      const recommendations = itemBasedCF.generateRecommendations('nonexistentUser', mockUserRatings, mockResources);

      expect(recommendations).toEqual([]);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('没有评分记录')
      );
    });

    it('应该处理错误情况', () => {
      // 模拟错误
      const mockError = new Error('测试错误');
      jest.spyOn(itemBasedCF, 'calculateItemSimilarity').mockImplementation(() => {
        throw mockError;
      });

      const recommendations = itemBasedCF.generateRecommendations('user1', mockUserRatings, mockResources);

      expect(recommendations).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('生成基于物品的协同过滤推荐时出错'),
        mockError
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

    it('应该正确初始化', () => {
      expect(hybridRecommender.userWeight).toBe(0.6);
      expect(hybridRecommender.itemWeight).toBe(0.4);
      expect(hybridRecommender.maxRecommendations).toBe(3);
      expect(hybridRecommender.logger).toBe(mockLogger);
      expect(hybridRecommender.userBasedCF).toBeInstanceOf(UserBasedCF);
      expect(hybridRecommender.itemBasedCF).toBeInstanceOf(ItemBasedCF);
    });

    it('应该生成混合推荐', () => {
      const recommendations = hybridRecommender.generateRecommendations('user1', mockUserRatings, mockResources);

      // 验证推荐结构
      expect(Array.isArray(recommendations)).toBe(true);
      if (recommendations.length > 0) {
        expect(recommendations[0]).toHaveProperty('resource');
        expect(recommendations[0]).toHaveProperty('userBasedScore');
        expect(recommendations[0]).toHaveProperty('itemBasedScore');
        expect(recommendations[0]).toHaveProperty('totalScore');
        expect(recommendations[0]).toHaveProperty('similarityScore');
      }

      // 验证推荐数量不超过最大值
      expect(recommendations.length).toBeLessThanOrEqual(hybridRecommender.maxRecommendations);

      // 验证日志记录
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('应该应用过滤条件', () => {
      const filters = {
        subject: '数学',
        grade: '三年级'
      };

      const recommendations = hybridRecommender.generateRecommendations('user1', mockUserRatings, mockResources, filters);

      // 验证过滤条件被应用
      if (recommendations.length > 0) {
        for (const rec of recommendations) {
          if (rec.resource.subject) {
            expect(rec.resource.subject).toBe(filters.subject);
          }
          if (rec.resource.grade) {
            expect(rec.resource.grade).toBe(filters.grade);
          }
        }
      }
    });

    it('应该处理错误情况', () => {
      // 模拟错误
      const mockError = new Error('测试错误');
      jest.spyOn(hybridRecommender.userBasedCF, 'generateRecommendations').mockImplementation(() => {
        throw mockError;
      });

      const recommendations = hybridRecommender.generateRecommendations('user1', mockUserRatings, mockResources);

      expect(recommendations).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('生成混合推荐时出错'),
        mockError
      );
    });
  });
});
