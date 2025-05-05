const { 
  calculateSimilarity,
  getRecommendations
} = require('../../utils/collaborativeFiltering');

describe('协同过滤工具函数测试', () => {
  describe('calculateSimilarity', () => {
    it('应该正确计算两个用户的相似度', () => {
      const user1Ratings = {
        'resource1': 5,
        'resource2': 3,
        'resource3': 4
      };
      
      const user2Ratings = {
        'resource1': 4,
        'resource2': 2,
        'resource3': 5
      };
      
      const similarity = calculateSimilarity(user1Ratings, user2Ratings);
      
      // 相似度应该在-1到1之间
      expect(similarity).toBeGreaterThanOrEqual(-1);
      expect(similarity).toBeLessThanOrEqual(1);
      
      // 这两个用户的评分相似，所以相似度应该是正值且接近1
      expect(similarity).toBeGreaterThan(0.5);
    });
    
    it('当没有共同评分项时应该返回0', () => {
      const user1Ratings = {
        'resource1': 5,
        'resource2': 3
      };
      
      const user2Ratings = {
        'resource3': 4,
        'resource4': 2
      };
      
      const similarity = calculateSimilarity(user1Ratings, user2Ratings);
      
      expect(similarity).toBe(0);
    });
    
    it('当评分完全相同时应该返回1', () => {
      const user1Ratings = {
        'resource1': 5,
        'resource2': 3,
        'resource3': 4
      };
      
      const user2Ratings = {
        'resource1': 5,
        'resource2': 3,
        'resource3': 4
      };
      
      const similarity = calculateSimilarity(user1Ratings, user2Ratings);
      
      expect(similarity).toBe(1);
    });
    
    it('当评分完全相反时应该返回-1', () => {
      const user1Ratings = {
        'resource1': 5,
        'resource2': 5,
        'resource3': 5
      };
      
      const user2Ratings = {
        'resource1': 1,
        'resource2': 1,
        'resource3': 1
      };
      
      const similarity = calculateSimilarity(user1Ratings, user2Ratings);
      
      expect(similarity).toBeLessThan(0);
    });
  });
  
  describe('getRecommendations', () => {
    it('应该正确生成推荐列表', () => {
      const userRatings = {
        'user1': {
          'resource1': 5,
          'resource2': 3,
          'resource3': 4
        },
        'user2': {
          'resource1': 4,
          'resource2': 2,
          'resource4': 5
        },
        'user3': {
          'resource1': 2,
          'resource3': 5,
          'resource4': 4,
          'resource5': 5
        }
      };
      
      const targetUser = 'user1';
      const recommendations = getRecommendations(userRatings, targetUser);
      
      // 推荐列表应该是一个数组
      expect(Array.isArray(recommendations)).toBe(true);
      
      // 推荐列表应该包含用户未评分的资源
      const recommendedResources = recommendations.map(rec => rec.resource);
      expect(recommendedResources).toContain('resource4');
      expect(recommendedResources).toContain('resource5');
      
      // 推荐列表不应该包含用户已评分的资源
      expect(recommendedResources).not.toContain('resource1');
      expect(recommendedResources).not.toContain('resource2');
      expect(recommendedResources).not.toContain('resource3');
      
      // 推荐列表应该按预测评分降序排序
      for (let i = 1; i < recommendations.length; i++) {
        expect(recommendations[i-1].score).toBeGreaterThanOrEqual(recommendations[i].score);
      }
    });
    
    it('当没有其他用户时应该返回空数组', () => {
      const userRatings = {
        'user1': {
          'resource1': 5,
          'resource2': 3,
          'resource3': 4
        }
      };
      
      const targetUser = 'user1';
      const recommendations = getRecommendations(userRatings, targetUser);
      
      expect(recommendations).toEqual([]);
    });
    
    it('当目标用户不存在时应该返回空数组', () => {
      const userRatings = {
        'user1': {
          'resource1': 5,
          'resource2': 3
        },
        'user2': {
          'resource1': 4,
          'resource3': 5
        }
      };
      
      const targetUser = 'user3';
      const recommendations = getRecommendations(userRatings, targetUser);
      
      expect(recommendations).toEqual([]);
    });
  });
});
