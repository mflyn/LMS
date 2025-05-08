// 设置测试环境
process.env.NODE_ENV = 'test';

const { UserBasedCF, ItemBasedCF, HybridRecommender } = require('../../utils/collaborativeFiltering');
const mongoose = require('mongoose');

describe('协同过滤推荐算法完整版测试', () => {
  // 模拟用户评分数据
  const mockUserRatings = [
    { userId: 'user1', resourceId: 'resource1', rating: 5 },
    { userId: 'user1', resourceId: 'resource2', rating: 4 },
    { userId: 'user1', resourceId: 'resource3', rating: 2 },
    { userId: 'user2', resourceId: 'resource1', rating: 4 },
    { userId: 'user2', resourceId: 'resource2', rating: 5 },
    { userId: 'user2', resourceId: 'resource4', rating: 3 },
    { userId: 'user3', resourceId: 'resource1', rating: 2 },
    { userId: 'user3', resourceId: 'resource3', rating: 5 },
    { userId: 'user3', resourceId: 'resource4', rating: 4 },
    { userId: 'user4', resourceId: 'resource2', rating: 3 },
    { userId: 'user4', resourceId: 'resource3', rating: 4 },
    { userId: 'user4', resourceId: 'resource5', rating: 5 }
  ];

  // 模拟资源数据
  const mockResources = [
    { _id: 'resource1', title: '资源1', subject: '数学', grade: '三年级', type: '习题' },
    { _id: 'resource2', title: '资源2', subject: '语文', grade: '三年级', type: '阅读' },
    { _id: 'resource3', title: '资源3', subject: '英语', grade: '四年级', type: '习题' },
    { _id: 'resource4', title: '资源4', subject: '数学', grade: '四年级', type: '视频' },
    { _id: 'resource5', title: '资源5', subject: '语文', grade: '五年级', type: '阅读' }
  ];

  // 模拟日志记录器
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  };

  describe('UserBasedCF 类测试', () => {
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

    test('应该正确计算用户相似度矩阵', () => {
      const similarityMatrix = userBasedCF.calculateUserSimilarity(mockUserRatings);

      // 验证相似度矩阵结构
      expect(similarityMatrix).toBeDefined();
      expect(Object.keys(similarityMatrix)).toHaveLength(4); // 4个用户

      // 验证自己和自己的相似度为1
      expect(similarityMatrix.user1.user1).toBe(1.0);
      expect(similarityMatrix.user2.user2).toBe(1.0);
      expect(similarityMatrix.user3.user3).toBe(1.0);
      expect(similarityMatrix.user4.user4).toBe(1.0);

      // 验证相似度的对称性
      expect(similarityMatrix.user1.user2).toBe(similarityMatrix.user2.user1);
      expect(similarityMatrix.user1.user3).toBe(similarityMatrix.user3.user1);
      expect(similarityMatrix.user2.user3).toBe(similarityMatrix.user3.user2);

      // 验证相似度计算的正确性（手动计算一个示例）
      // user1 和 user2 共同评价了 resource1 和 resource2
      // user1 的评分: [5, 4], user2 的评分: [4, 5]
      // 余弦相似度 = (5*4 + 4*5) / (sqrt(5^2 + 4^2) * sqrt(4^2 + 5^2)) = 40 / (sqrt(41) * sqrt(41)) ≈ 0.976
      expect(similarityMatrix.user1.user2).toBeCloseTo(0.976, 3);
    });

    test('应该为用户生成推荐', () => {
      const recommendations = userBasedCF.generateRecommendations('user1', mockUserRatings, mockResources);

      // 验证推荐结果
      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeLessThanOrEqual(3); // 最多3个推荐

      // 验证推荐不包含用户已评价的资源
      const recommendedResourceIds = recommendations.map(rec => rec.resource._id);
      expect(recommendedResourceIds).not.toContain('resource1');
      expect(recommendedResourceIds).not.toContain('resource2');
      expect(recommendedResourceIds).not.toContain('resource3');

      // 验证日志记录
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('生成了'));
    });

    test('用户没有评分记录时应该返回空数组', () => {
      const recommendations = userBasedCF.generateRecommendations('nonexistentUser', mockUserRatings, mockResources);

      // 验证推荐结果
      expect(recommendations).toEqual([]);

      // 验证日志记录
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('没有评分记录'));
    });

    test('应该处理错误情况', () => {
      // 模拟错误
      jest.spyOn(userBasedCF, 'calculateUserSimilarity').mockImplementation(() => {
        throw new Error('测试错误');
      });

      const recommendations = userBasedCF.generateRecommendations('user1', mockUserRatings, mockResources);

      // 验证推荐结果
      expect(recommendations).toEqual([]);

      // 验证错误日志
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('生成协同过滤推荐时出错'), expect.any(Error));
    });
  });

  describe('ItemBasedCF 类测试', () => {
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

    test('应该正确计算物品相似度矩阵', () => {
      const similarityMatrix = itemBasedCF.calculateItemSimilarity(mockUserRatings);

      // 验证相似度矩阵结构
      expect(similarityMatrix).toBeDefined();
      expect(Object.keys(similarityMatrix)).toHaveLength(5); // 5个资源

      // 验证自己和自己的相似度为1
      expect(similarityMatrix.resource1.resource1).toBe(1.0);
      expect(similarityMatrix.resource2.resource2).toBe(1.0);
      expect(similarityMatrix.resource3.resource3).toBe(1.0);

      // 验证相似度的对称性
      expect(similarityMatrix.resource1.resource2).toBe(similarityMatrix.resource2.resource1);
      expect(similarityMatrix.resource1.resource3).toBe(similarityMatrix.resource3.resource1);
      expect(similarityMatrix.resource2.resource3).toBe(similarityMatrix.resource3.resource2);
    });

    test('应该为用户生成推荐', () => {
      const recommendations = itemBasedCF.generateRecommendations('user1', mockUserRatings, mockResources);

      // 验证推荐结果
      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeLessThanOrEqual(3); // 最多3个推荐

      // 验证推荐不包含用户已评价的资源
      const recommendedResourceIds = recommendations.map(rec => rec.resource._id);
      expect(recommendedResourceIds).not.toContain('resource1');
      expect(recommendedResourceIds).not.toContain('resource2');
      expect(recommendedResourceIds).not.toContain('resource3');

      // 验证日志记录
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('生成了'));
    });

    test('用户没有评分记录时应该返回空数组', () => {
      const recommendations = itemBasedCF.generateRecommendations('nonexistentUser', mockUserRatings, mockResources);

      // 验证推荐结果
      expect(recommendations).toEqual([]);

      // 验证日志记录
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('没有评分记录'));
    });

    test('应该处理错误情况', () => {
      // 模拟错误
      jest.spyOn(itemBasedCF, 'calculateItemSimilarity').mockImplementation(() => {
        throw new Error('测试错误');
      });

      const recommendations = itemBasedCF.generateRecommendations('user1', mockUserRatings, mockResources);

      // 验证推荐结果
      expect(recommendations).toEqual([]);

      // 验证错误日志
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('生成基于物品的协同过滤推荐时出错'), expect.any(Error));
    });
  });

  describe('HybridRecommender 类测试', () => {
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

    test('应该为用户生成混合推荐', () => {
      const recommendations = hybridRecommender.generateRecommendations('user1', mockUserRatings, mockResources);

      // 验证推荐结果
      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeLessThanOrEqual(3); // 最多3个推荐

      // 验证推荐不包含用户已评价的资源
      const recommendedResourceIds = recommendations.map(rec => rec.resource._id);
      expect(recommendedResourceIds).not.toContain('resource1');
      expect(recommendedResourceIds).not.toContain('resource2');
      expect(recommendedResourceIds).not.toContain('resource3');

      // 验证日志记录
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('生成了'));
    });

    test('应该应用过滤条件', () => {
      const filters = { subject: '数学', grade: '四年级' };
      const recommendations = hybridRecommender.generateRecommendations('user1', mockUserRatings, mockResources, filters);

      // 验证推荐结果
      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);

      // 验证过滤条件被应用
      recommendations.forEach(rec => {
        expect(rec.resource.subject).toBe('数学');
        expect(rec.resource.grade).toBe('四年级');
      });
    });

    test('应该处理错误情况', () => {
      // 模拟错误
      jest.spyOn(hybridRecommender.userBasedCF, 'generateRecommendations').mockImplementation(() => {
        throw new Error('测试错误');
      });

      const recommendations = hybridRecommender.generateRecommendations('user1', mockUserRatings, mockResources);

      // 验证推荐结果
      expect(recommendations).toEqual([]);

      // 验证错误日志
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('生成混合推荐时出错'), expect.any(Error));
    });
  });
});
