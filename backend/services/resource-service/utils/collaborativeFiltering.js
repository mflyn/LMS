/**
 * 协同过滤推荐算法工具
 * 用于基于用户行为的资源推荐
 */

/**
 * 基于用户的协同过滤推荐算法
 * 通过分析用户之间的相似度，推荐相似用户喜欢的资源
 */
class UserBasedCF {
  /**
   * 构造函数
   * @param {Object} options - 配置选项
   * @param {number} options.similarityThreshold - 相似度阈值，默认0.3
   * @param {number} options.maxRecommendations - 最大推荐数量，默认10
   * @param {Object} options.logger - 日志记录器
   */
  constructor(options = {}) {
    this.similarityThreshold = options.similarityThreshold || 0.3;
    this.maxRecommendations = options.maxRecommendations || 10;
    this.logger = options.logger || console;
  }

  /**
   * 计算用户之间的相似度矩阵
   * @param {Array} userRatings - 用户评分数据，格式: [{userId, resourceId, rating}]
   * @returns {Object} 用户相似度矩阵
   */
  calculateUserSimilarity(userRatings) {
    // 构建用户-资源评分矩阵
    const userResourceMatrix = {};
    const userResources = {};
    
    userRatings.forEach(rating => {
      if (!userResourceMatrix[rating.userId]) {
        userResourceMatrix[rating.userId] = {};
        userResources[rating.userId] = new Set();
      }
      
      userResourceMatrix[rating.userId][rating.resourceId] = rating.rating;
      userResources[rating.userId].add(rating.resourceId);
    });
    
    // 计算用户间的相似度 (余弦相似度)
    const similarityMatrix = {};
    const users = Object.keys(userResourceMatrix);
    
    for (let i = 0; i < users.length; i++) {
      const user1 = users[i];
      similarityMatrix[user1] = {};
      
      for (let j = 0; j < users.length; j++) {
        const user2 = users[j];
        
        // 跳过自己
        if (user1 === user2) {
          similarityMatrix[user1][user2] = 1.0; // 自己和自己的相似度为1
          continue;
        }
        
        // 如果已经计算过，直接使用对称值
        if (similarityMatrix[user2] && similarityMatrix[user2][user1] !== undefined) {
          similarityMatrix[user1][user2] = similarityMatrix[user2][user1];
          continue;
        }
        
        // 找出两个用户共同评价的资源
        const user1Resources = userResources[user1];
        const user2Resources = userResources[user2];
        const commonResources = [...user1Resources].filter(resourceId => user2Resources.has(resourceId));
        
        // 如果没有共同评价的资源，相似度为0
        if (commonResources.length === 0) {
          similarityMatrix[user1][user2] = 0;
          continue;
        }
        
        // 计算余弦相似度
        let dotProduct = 0;
        let magnitude1 = 0;
        let magnitude2 = 0;
        
        // 只考虑共同评价的资源
        commonResources.forEach(resourceId => {
          const rating1 = userResourceMatrix[user1][resourceId];
          const rating2 = userResourceMatrix[user2][resourceId];
          
          dotProduct += rating1 * rating2;
          magnitude1 += rating1 * rating1;
          magnitude2 += rating2 * rating2;
        });
        
        magnitude1 = Math.sqrt(magnitude1);
        magnitude2 = Math.sqrt(magnitude2);
        
        const similarity = magnitude1 > 0 && magnitude2 > 0 ? 
          dotProduct / (magnitude1 * magnitude2) : 0;
        
        similarityMatrix[user1][user2] = similarity;
      }
    }
    
    return similarityMatrix;
  }

  /**
   * 为指定用户生成推荐
   * @param {string} userId - 目标用户ID
   * @param {Array} userRatings - 所有用户评分数据
   * @param {Array} resources - 所有资源数据
   * @returns {Array} 推荐资源列表，按推荐度排序
   */
  generateRecommendations(userId, userRatings, resources) {
    try {
      // 如果用户没有评分记录，返回空数组
      const userHasRatings = userRatings.some(rating => rating.userId === userId);
      if (!userHasRatings) {
        this.logger.info(`用户 ${userId} 没有评分记录，无法生成协同过滤推荐`);
        return [];
      }
      
      // 计算用户相似度矩阵
      const similarityMatrix = this.calculateUserSimilarity(userRatings);
      
      // 如果目标用户不在相似度矩阵中，返回空数组
      if (!similarityMatrix[userId]) {
        this.logger.info(`用户 ${userId} 不在相似度矩阵中，无法生成协同过滤推荐`);
        return [];
      }
      
      // 获取目标用户已评价的资源ID集合
      const userRatedResourceIds = new Set(
        userRatings
          .filter(rating => rating.userId === userId)
          .map(rating => rating.resourceId)
      );
      
      // 构建资源ID到资源对象的映射
      const resourceMap = {};
      resources.forEach(resource => {
        resourceMap[resource._id.toString()] = resource;
      });
      
      // 计算推荐分数
      const recommendationScores = {};
      const userSimilarities = similarityMatrix[userId];
      
      // 遍历所有用户
      Object.keys(userSimilarities).forEach(otherUserId => {
        // 跳过自己和相似度低于阈值的用户
        if (otherUserId === userId || userSimilarities[otherUserId] < this.similarityThreshold) {
          return;
        }
        
        // 获取该用户的评分记录
        const otherUserRatings = userRatings.filter(rating => rating.userId === otherUserId);
        
        // 遍历该用户的评分记录
        otherUserRatings.forEach(rating => {
          const resourceId = rating.resourceId;
          
          // 跳过目标用户已评价的资源
          if (userRatedResourceIds.has(resourceId)) {
            return;
          }
          
          // 计算加权评分
          const weightedRating = rating.rating * userSimilarities[otherUserId];
          
          if (!recommendationScores[resourceId]) {
            recommendationScores[resourceId] = {
              score: 0,
              weightSum: 0
            };
          }
          
          recommendationScores[resourceId].score += weightedRating;
          recommendationScores[resourceId].weightSum += userSimilarities[otherUserId];
        });
      });
      
      // 计算最终推荐分数并排序
      const recommendations = Object.keys(recommendationScores)
        .filter(resourceId => resourceMap[resourceId]) // 确保资源存在
        .map(resourceId => {
          const { score, weightSum } = recommendationScores[resourceId];
          const normalizedScore = weightSum > 0 ? score / weightSum : 0;
          
          return {
            resource: resourceMap[resourceId],
            score: normalizedScore,
            similarityScore: normalizedScore.toFixed(2)
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, this.maxRecommendations);
      
      this.logger.info(`为用户 ${userId} 生成了 ${recommendations.length} 个协同过滤推荐`);
      
      return recommendations;
    } catch (error) {
      this.logger.error(`生成协同过滤推荐时出错: ${error.message}`, error);
      return [];
    }
  }
}

/**
 * 基于物品的协同过滤推荐算法
 * 通过分析物品之间的相似度，推荐与用户喜欢的物品相似的其他物品
 */
class ItemBasedCF {
  /**
   * 构造函数
   * @param {Object} options - 配置选项
   * @param {number} options.similarityThreshold - 相似度阈值，默认0.3
   * @param {number} options.maxRecommendations - 最大推荐数量，默认10
   * @param {Object} options.logger - 日志记录器
   */
  constructor(options = {}) {
    this.similarityThreshold = options.similarityThreshold || 0.3;
    this.maxRecommendations = options.maxRecommendations || 10;
    this.logger = options.logger || console;
  }

  /**
   * 计算物品之间的相似度矩阵
   * @param {Array} userRatings - 用户评分数据，格式: [{userId, resourceId, rating}]
   * @returns {Object} 物品相似度矩阵
   */
  calculateItemSimilarity(userRatings) {
    // 构建资源-用户评分矩阵
    const resourceUserMatrix = {};
    const resourceUsers = {};
    
    userRatings.forEach(rating => {
      if (!resourceUserMatrix[rating.resourceId]) {
        resourceUserMatrix[rating.resourceId] = {};
        resourceUsers[rating.resourceId] = new Set();
      }
      
      resourceUserMatrix[rating.resourceId][rating.userId] = rating.rating;
      resourceUsers[rating.resourceId].add(rating.userId);
    });
    
    // 计算物品间的相似度 (余弦相似度)
    const similarityMatrix = {};
    const resources = Object.keys(resourceUserMatrix);
    
    for (let i = 0; i < resources.length; i++) {
      const resource1 = resources[i];
      similarityMatrix[resource1] = {};
      
      for (let j = 0; j < resources.length; j++) {
        const resource2 = resources[j];
        
        // 跳过自己
        if (resource1 === resource2) {
          similarityMatrix[resource1][resource2] = 1.0; // 自己和自己的相似度为1
          continue;
        }
        
        // 如果已经计算过，直接使用对称值
        if (similarityMatrix[resource2] && similarityMatrix[resource2][resource1] !== undefined) {
          similarityMatrix[resource1][resource2] = similarityMatrix[resource2][resource1];
          continue;
        }
        
        // 找出两个资源共同被评价的用户
        const resource1Users = resourceUsers[resource1];
        const resource2Users = resourceUsers[resource2];
        const commonUsers = [...resource1Users].filter(userId => resource2Users.has(userId));
        
        // 如果没有共同评价的用户，相似度为0
        if (commonUsers.length === 0) {
          similarityMatrix[resource1][resource2] = 0;
          continue;
        }
        
        // 计算余弦相似度
        let dotProduct = 0;
        let magnitude1 = 0;
        let magnitude2 = 0;
        
        // 只考虑共同评价的用户
        commonUsers.forEach(userId => {
          const rating1 = resourceUserMatrix[resource1][userId];
          const rating2 = resourceUserMatrix[resource2][userId];
          
          dotProduct += rating1 * rating2;
          magnitude1 += rating1 * rating1;
          magnitude2 += rating2 * rating2;
        });
        
        magnitude1 = Math.sqrt(magnitude1);
        magnitude2 = Math.sqrt(magnitude2);
        
        const similarity = magnitude1 > 0 && magnitude2 > 0 ? 
          dotProduct / (magnitude1 * magnitude2) : 0;
        
        similarityMatrix[resource1][resource2] = similarity;
      }
    }
    
    return similarityMatrix;
  }

  /**
   * 为指定用户生成推荐
   * @param {string} userId - 目标用户ID
   * @param {Array} userRatings - 所有用户评分数据
   * @param {Array} resources - 所有资源数据
   * @returns {Array} 推荐资源列表，按推荐度排序
   */
  generateRecommendations(userId, userRatings, resources) {
    try {
      // 获取用户的评分记录
      const userRatingList = userRatings.filter(rating => rating.userId === userId);
      
      // 如果用户没有评分记录，返回空数组
      if (userRatingList.length === 0) {
        this.logger.info(`用户 ${userId} 没有评分记录，无法生成基于物品的协同过滤推荐`);
        return [];
      }
      
      // 计算物品相似度矩阵
      const itemSimilarityMatrix = this.calculateItemSimilarity(userRatings);
      
      // 获取用户已评价的资源ID集合
      const userRatedResourceIds = new Set(userRatingList.map(rating => rating.resourceId));
      
      // 构建资源ID到资源对象的映射
      const resourceMap = {};
      resources.forEach(resource => {
        resourceMap[resource._id.toString()] = resource;
      });
      
      // 计算推荐分数
      const recommendationScores = {};
      
      // 遍历用户评价过的资源
      userRatingList.forEach(userRating => {
        const ratedResourceId = userRating.resourceId;
        const userRatingValue = userRating.rating;
        
        // 如果该资源不在相似度矩阵中，跳过
        if (!itemSimilarityMatrix[ratedResourceId]) {
          return;
        }
        
        // 遍历所有资源，找出与用户评价过的资源相似的资源
        Object.keys(itemSimilarityMatrix[ratedResourceId]).forEach(otherResourceId => {
          // 跳过用户已评价的资源
          if (userRatedResourceIds.has(otherResourceId)) {
            return;
          }
          
          const similarity = itemSimilarityMatrix[ratedResourceId][otherResourceId];
          
          // 跳过相似度低于阈值的资源
          if (similarity < this.similarityThreshold) {
            return;
          }
          
          // 计算加权评分
          const weightedRating = userRatingValue * similarity;
          
          if (!recommendationScores[otherResourceId]) {
            recommendationScores[otherResourceId] = {
              score: 0,
              weightSum: 0
            };
          }
          
          recommendationScores[otherResourceId].score += weightedRating;
          recommendationScores[otherResourceId].weightSum += similarity;
        });
      });
      
      // 计算最终推荐分数并排序
      const recommendations = Object.keys(recommendationScores)
        .filter(resourceId => resourceMap[resourceId]) // 确保资源存在
        .map(resourceId => {
          const { score, weightSum } = recommendationScores[resourceId];
          const normalizedScore = weightSum > 0 ? score / weightSum : 0;
          
          return {
            resource: resourceMap[resourceId],
            score: normalizedScore,
            similarityScore: normalizedScore.toFixed(2)
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, this.maxRecommendations);
      
      this.logger.info(`为用户 ${userId} 生成了 ${recommendations.length} 个基于物品的协同过滤推荐`);
      
      return recommendations;
    } catch (error) {
      this.logger.error(`生成基于物品的协同过滤推荐时出错: ${error.message}`, error);
      return [];
    }
  }
}

/**
 * 混合推荐系统
 * 结合基于用户和基于物品的协同过滤算法
 */
class HybridRecommender {
  /**
   * 构造函数
   * @param {Object} options - 配置选项
   * @param {number} options.userWeight - 基于用户推荐的权重，默认0.5
   * @param {number} options.itemWeight - 基于物品推荐的权重，默认0.5
   * @param {number} options.maxRecommendations - 最大推荐数量，默认10
   * @param {Object} options.logger - 日志记录器
   */
  constructor(options = {}) {
    this.userWeight = options.userWeight || 0.5;
    this.itemWeight = options.itemWeight || 0.5;
    this.maxRecommendations = options.maxRecommendations || 10;
    this.logger = options.logger || console;
    
    // 创建基于用户和基于物品的推荐器
    this.userBasedCF = new UserBasedCF({
      ...options,
      maxRecommendations: this.maxRecommendations * 2 // 获取更多候选项
    });
    
    this.itemBasedCF = new ItemBasedCF({
      ...options,
      maxRecommendations: this.maxRecommendations * 2 // 获取更多候选项
    });
  }

  /**
   * 生成混合推荐
   * @param {string} userId - 目标用户ID
   * @param {Array} userRatings - 所有用户评分数据
   * @param {Array} resources - 所有资源数据
   * @param {Object} filters - 过滤条件，如学科、年级等
   * @returns {Array} 推荐资源列表，按推荐度排序
   */
  generateRecommendations(userId, userRatings, resources, filters = {}) {
    try {
      // 获取基于用户的推荐
      const userBasedRecommendations = this.userBasedCF.generateRecommendations(
        userId, userRatings, resources
      );
      
      // 获取基于物品的推荐
      const itemBasedRecommendations = this.itemBasedCF.generateRecommendations(
        userId, userRatings, resources
      );
      
      // 合并推荐结果
      const recommendationMap = {};
      
      // 处理基于用户的推荐
      userBasedRecommendations.forEach(rec => {
        const resourceId = rec.resource._id.toString();
        recommendationMap[resourceId] = {
          resource: rec.resource,
          userBasedScore: rec.score * this.userWeight,
          itemBasedScore: 0,
          totalScore: rec.score * this.userWeight
        };
      });
      
      // 处理基于物品的推荐
      itemBasedRecommendations.forEach(rec => {
        const resourceId = rec.resource._id.toString();
        
        if (recommendationMap[resourceId]) {
          // 如果已存在，更新分数
          recommendationMap[resourceId].itemBasedScore = rec.score * this.itemWeight;
          recommendationMap[resourceId].totalScore += rec.score * this.itemWeight;
        } else {
          // 如果不存在，添加新记录
          recommendationMap[resourceId] = {
            resource: rec.resource,
            userBasedScore: 0,
            itemBasedScore: rec.score * this.itemWeight,
            totalScore: rec.score * this.itemWeight
          };
        }
      });
      
      // 应用过滤条件
      let recommendations = Object.values(recommendationMap);
      
      if (filters.subject) {
        recommendations = recommendations.filter(rec => 
          rec.resource.subject === filters.subject
        );
      }
      
      if (filters.grade) {
        recommendations = recommendations.filter(rec => 
          rec.resource.grade === filters.grade
        );
      }
      
      if (filters.type) {
        recommendations = recommendations.filter(rec => 
          rec.resource.type === filters.type
        );
      }
      
      // 排序并限制数量
      recommendations = recommendations
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, this.maxRecommendations)
        .map(rec => ({
          ...rec,
          similarityScore: rec.totalScore.toFixed(2)
        }));
      
      this.logger.info(`为用户 ${userId} 生成了 ${recommendations.length} 个混合推荐`);
      
      return recommendations;
    } catch (error) {
      this.logger.error(`生成混合推荐时出错: ${error.message}`, error);
      return [];
    }
  }
}

module.exports = {
  UserBasedCF,
  ItemBasedCF,
  HybridRecommender
};