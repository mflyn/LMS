/**
 * 资源推荐事件集成示例
 * 展示如何在资源推荐功能中集成事件总线
 */

const { HybridRecommender } = require('../../../services/resource-service/utils/collaborativeFiltering');
const { eventTypes } = require('../../eventBus');

/**
 * 创建资源推荐器并集成事件发布
 * @param {Object} options - 配置选项
 * @param {Object} logger - 日志记录器
 * @returns {Object} 推荐器实例
 */
function createResourceRecommender(options = {}, logger) {
  // 创建混合推荐器实例
  const recommender = new HybridRecommender({
    userWeight: options.userWeight || 0.5,
    itemWeight: options.itemWeight || 0.5,
    maxRecommendations: options.maxRecommendations || 10,
    similarityThreshold: options.similarityThreshold || 0.3,
    logger
  });
  
  // 扩展推荐器，添加事件发布功能
  return {
    /**
     * 生成推荐并发布事件
     * @param {string} userId - 目标用户ID
     * @param {Array} userRatings - 所有用户评分数据
     * @param {Array} resources - 所有资源数据
     * @param {Object} filters - 过滤条件
     * @param {Object} eventPublisher - 事件发布器
     * @returns {Array} 推荐资源列表
     */
    async generateRecommendationsWithEvents(userId, userRatings, resources, filters = {}, eventPublisher) {
      // 使用原始推荐器生成推荐
      const recommendations = recommender.generateRecommendations(
        userId, userRatings, resources, filters
      );
      
      // 如果有推荐结果且有事件发布器，则发布推荐事件
      if (recommendations.length > 0 && eventPublisher) {
        try {
          const eventData = {
            userId,
            timestamp: new Date().toISOString(),
            recommendationType: 'hybrid',
            filters: filters,
            recommendations: recommendations.map(rec => ({
              resourceId: rec.resource._id.toString(),
              title: rec.resource.title,
              score: rec.score,
              similarityScore: rec.similarityScore
            }))
          };
          
          await eventPublisher.publish(
            eventTypes.RESOURCE_EVENTS.RECOMMENDED,
            eventData
          );
          
          logger.info(`为用户 ${userId} 发布了资源推荐事件，包含 ${recommendations.length} 个推荐`);
        } catch (error) {
          logger.error(`发布资源推荐事件失败:`, error);
        }
      }
      
      return recommendations;
    },
    
    // 保留原始方法以便向后兼容
    generateRecommendations: recommender.generateRecommendations.bind(recommender)
  };
}

/**
 * 资源评分事件处理
 * 当用户对资源进行评分时发布事件
 * @param {Object} rating - 评分数据
 * @param {Object} eventPublisher - 事件发布器
 * @param {Object} logger - 日志记录器
 */
async function publishResourceRatedEvent(rating, eventPublisher, logger) {
  try {
    if (!eventPublisher) {
      logger.warn('无法发布资源评分事件: 事件发布器未配置');
      return false;
    }
    
    const eventData = {
      userId: rating.userId,
      resourceId: rating.resourceId,
      rating: rating.rating,
      timestamp: new Date().toISOString(),
      comment: rating.comment || ''
    };
    
    const published = await eventPublisher.publish(
      eventTypes.RESOURCE_EVENTS.RATED,
      eventData
    );
    
    if (published) {
      logger.info(`资源评分事件发布成功: 用户 ${rating.userId}, 资源 ${rating.resourceId}, 评分 ${rating.rating}`);
    } else {
      logger.warn(`资源评分事件发布失败`);
    }
    
    return published;
  } catch (error) {
    logger.error(`发布资源评分事件时出错:`, error);
    return false;
  }
}

/**
 * 资源查看事件处理
 * 当用户查看资源时发布事件
 * @param {string} userId - 用户ID
 * @param {string} resourceId - 资源ID
 * @param {Object} eventPublisher - 事件发布器
 * @param {Object} logger - 日志记录器
 */
async function publishResourceViewedEvent(userId, resourceId, eventPublisher, logger) {
  try {
    if (!eventPublisher) {
      logger.warn('无法发布资源查看事件: 事件发布器未配置');
      return false;
    }
    
    const eventData = {
      userId,
      resourceId,
      timestamp: new Date().toISOString(),
      viewType: 'detail' // 可以是 'list', 'detail', 'preview' 等
    };
    
    const published = await eventPublisher.publish(
      eventTypes.RESOURCE_EVENTS.VIEWED,
      eventData
    );
    
    if (published) {
      logger.debug(`资源查看事件发布成功: 用户 ${userId}, 资源 ${resourceId}`);
    }
    
    return published;
  } catch (error) {
    logger.error(`发布资源查看事件时出错:`, error);
    return false;
  }
}

/**
 * 资源下载事件处理
 * 当用户下载资源时发布事件
 * @param {string} userId - 用户ID
 * @param {string} resourceId - 资源ID
 * @param {Object} eventPublisher - 事件发布器
 * @param {Object} logger - 日志记录器
 */
async function publishResourceDownloadedEvent(userId, resourceId, eventPublisher, logger) {
  try {
    if (!eventPublisher) {
      logger.warn('无法发布资源下载事件: 事件发布器未配置');
      return false;
    }
    
    const eventData = {
      userId,
      resourceId,
      timestamp: new Date().toISOString()
    };
    
    const published = await eventPublisher.publish(
      eventTypes.RESOURCE_EVENTS.DOWNLOADED,
      eventData
    );
    
    if (published) {
      logger.info(`资源下载事件发布成功: 用户 ${userId}, 资源 ${resourceId}`);
    } else {
      logger.warn(`资源下载事件发布失败`);
    }
    
    return published;
  } catch (error) {
    logger.error(`发布资源下载事件时出错:`, error);
    return false;
  }
}

module.exports = {
  createResourceRecommender,
  publishResourceRatedEvent,
  publishResourceViewedEvent,
  publishResourceDownloadedEvent
};